-- 프로모션 관리 (마케팅 집행 > 프로모션 관리)
-- main 에 머지되면 Supabase GitHub 연동이 운영 DB 에 자동 적용한다.

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  title text not null,                -- 한 줄 컨셉(프로모션 이름)
  description text,                   -- 상세 컨셉 설명
  detail_url text,                    -- 프로모션 상세페이지 URL
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint promotions_period_check check (ends_on >= starts_on)
);

-- 프로모션에서 소개하는 멘토. mentor_id 는 LetsOperation 멘토 DB 의 mentorId.
create table if not exists public.promotion_mentors (
  promotion_id uuid not null references public.promotions(id) on delete cascade,
  mentor_id text not null,
  mentor_name text not null,          -- 저장 시점 이름(멘토 DB 에서 빠져도 보이도록)
  is_focus boolean not null default false, -- 잘 팔아야 하는(집중 판매) 멘토
  sort_order int not null default 0,
  primary key (promotion_id, mentor_id)
);

-- 서버(service role)만 접근한다. 정책을 두지 않아 anon/authenticated 키로는 읽기·쓰기 불가.
alter table public.promotions enable row level security;
alter table public.promotion_mentors enable row level security;

-- 프로모션 + 소개 멘토를 한 트랜잭션으로 저장한다. p_id 가 null 이면 새로 만든다.
create or replace function public.save_promotion(
  p_id uuid,
  p_title text,
  p_description text,
  p_detail_url text,
  p_starts_on date,
  p_ends_on date,
  p_mentors jsonb -- [{ "mentorId": "...", "mentorName": "...", "isFocus": true }]
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_id is null then
    insert into promotions (title, description, detail_url, starts_on, ends_on)
    values (p_title, p_description, p_detail_url, p_starts_on, p_ends_on)
    returning id into v_id;
  else
    update promotions
       set title = p_title,
           description = p_description,
           detail_url = p_detail_url,
           starts_on = p_starts_on,
           ends_on = p_ends_on,
           updated_at = now()
     where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'promotion % not found', p_id using errcode = 'P0002';
    end if;
    delete from promotion_mentors where promotion_id = v_id;
  end if;

  insert into promotion_mentors (promotion_id, mentor_id, mentor_name, is_focus, sort_order)
  select v_id, m.value->>'mentorId', m.value->>'mentorName', coalesce((m.value->>'isFocus')::boolean, false), m.ordinality::int
    from jsonb_array_elements(coalesce(p_mentors, '[]'::jsonb)) with ordinality as m(value, ordinality);

  return v_id;
end;
$$;

revoke execute on function public.save_promotion(uuid, text, text, text, date, date, jsonb) from public, anon, authenticated;
