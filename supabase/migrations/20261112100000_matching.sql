-- 공고&멘토 매칭 (마케팅 집행 > 공고&멘토 매칭) + 추천 점수 설정 (설정)
-- main 에 머지되면 Supabase GitHub 연동이 운영 DB 에 자동 적용한다.

-- 추천 점수 설정. 행은 하나(id = 1)만 둔다. 값이 없으면 코드의 기본값을 쓴다.
create table if not exists public.matching_settings (
  id smallint primary key default 1,
  settings jsonb not null,            -- { "weights": { ... }, "recommendCount": 2 }
  updated_at timestamptz not null default now(),
  constraint matching_settings_singleton check (id = 1)
);

-- 매칭 1건 = 운영자가 붙여넣은 메시지 하나
create table if not exists public.matchings (
  id uuid primary key default gen_random_uuid(),
  raw_text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 메시지에서 나눈 공고 하나와 그 공고의 추천/확정 멘토
create table if not exists public.matching_postings (
  id uuid primary key default gen_random_uuid(),
  matching_id uuid not null references public.matchings(id) on delete cascade,
  sort_order int not null default 0,
  title text not null default '',
  company text not null default '',
  job_role text not null default '',
  body text not null default '',
  -- 저장 시점의 자동 추천 결과 [{ mentorId, mentorName, score, reasons[] }]
  recommendations jsonb not null default '[]'::jsonb,
  -- 운영자가 확정한 멘토 [{ mentorId, mentorName, score, reasons[] }]
  selected jsonb not null default '[]'::jsonb
);

create index if not exists matching_postings_matching_id_idx on public.matching_postings (matching_id, sort_order);

-- 서버(service role)만 접근한다. 정책을 두지 않아 anon/authenticated 키로는 읽기·쓰기 불가.
alter table public.matching_settings enable row level security;
alter table public.matchings enable row level security;
alter table public.matching_postings enable row level security;

-- 매칭 + 공고 목록을 한 트랜잭션으로 저장한다. p_id 가 null 이면 새로 만든다.
create or replace function public.save_matching(
  p_id uuid,
  p_raw_text text,
  p_postings jsonb -- [{ "title", "company", "jobRole", "body", "recommendations": [...], "selected": [...] }]
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_id is null then
    insert into matchings (raw_text) values (p_raw_text) returning id into v_id;
  else
    update matchings set raw_text = p_raw_text, updated_at = now() where id = p_id returning id into v_id;
    if v_id is null then
      raise exception 'matching % not found', p_id using errcode = 'P0002';
    end if;
    delete from matching_postings where matching_id = v_id;
  end if;

  insert into matching_postings (matching_id, sort_order, title, company, job_role, body, recommendations, selected)
  select v_id,
         p.ordinality::int,
         coalesce(p.value->>'title', ''),
         coalesce(p.value->>'company', ''),
         coalesce(p.value->>'jobRole', ''),
         coalesce(p.value->>'body', ''),
         coalesce(p.value->'recommendations', '[]'::jsonb),
         coalesce(p.value->'selected', '[]'::jsonb)
    from jsonb_array_elements(coalesce(p_postings, '[]'::jsonb)) with ordinality as p(value, ordinality);

  return v_id;
end;
$$;

revoke execute on function public.save_matching(uuid, text, jsonb) from public, anon, authenticated;
