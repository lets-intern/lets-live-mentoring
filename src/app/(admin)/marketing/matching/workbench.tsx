"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import type { Matching } from "@/lib/matching/data";
import { parsePostings } from "@/lib/matching/parse";
import { MAX_RAW_TEXT } from "@/lib/matching/limits";
import { isBonusOnly, rankMentors, rankOverall, type OverallMentor, type CandidateMentor, type MatchingSettings, type ScoredMentor } from "@/lib/matching/score";
import { deleteMatching, saveMatching } from "./actions";

const inputClass =
  "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400";

type WorkPosting = {
  key: string;
  title: string;
  company: string;
  jobRole: string;
  body: string;
  /** 운영자가 멘토를 직접 바꿨으면 true. false 면 확정 멘토 = 자동 추천 */
  touched: boolean;
  selected: ScoredMentor[];
};

type Props = {
  candidates: CandidateMentor[];
  settings: MatchingSettings;
  knownCompanies: string[];
  initial?: Matching;
};

let seq = 0;
const newKey = () => `p${++seq}`;

export function MatchingWorkbench({ candidates, settings, knownCompanies, initial }: Props) {
  const [rawText, setRawText] = useState(initial?.rawText ?? "");
  const [postings, setPostings] = useState<WorkPosting[]>(
    () =>
      // 서버 렌더와 key(→ 입력칸 id)가 같아야 하므로 처음 목록은 순번으로 key 를 만든다
      initial?.postings.map((p, i) => ({
        key: `init-${i}`,
        title: p.title,
        company: p.company,
        jobRole: p.jobRole,
        body: p.body,
        // 저장된 확정 멘토는 그대로 유지한다 (후보·점수가 바뀌어도 덮어쓰지 않음)
        touched: true,
        selected: p.selected,
      })) ?? [],
  );
  // 나눈 뒤 공고를 고치거나 더하거나 뺐으면 true — 다시 나누기 전에 확인한다
  const [dirty, setDirty] = useState(Boolean(initial));
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const candidateById = useMemo(() => new Map(candidates.map((c) => [c.mentorId, c])), [candidates]);

  const update = (key: string, patch: Partial<WorkPosting>) => {
    setDirty(true);
    setPostings((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  };

  const split = () => {
    if (postings.length > 0 && dirty && !window.confirm("다시 나누면 공고별로 고친 내용이 사라집니다. 계속할까요?")) {
      return;
    }
    setDirty(false);
    setError(undefined);
    setPostings(
      parsePostings(rawText, knownCompanies).map((p) => ({ ...p, key: newKey(), touched: false, selected: [] })),
    );
  };

  // 공고별 순위·추천 계산 (입력이 바뀔 때마다 즉시 다시 계산)
  const ranked = useMemo(
    () =>
      new Map(
        postings.map((p) => {
          const all = rankMentors({ company: p.company, jobRole: p.jobRole }, candidates, settings.weights);
          const recommended = all.filter((m) => m.score > 0).slice(0, settings.recommendCount);
          return [p.key, { all, recommended }];
        }),
      ),
    [postings, candidates, settings],
  );

  const overall = useMemo(
    () => rankOverall(postings.map((p) => ranked.get(p.key)?.all ?? []), candidates),
    [postings, ranked, candidates],
  );

  const selectedOf = (p: WorkPosting): ScoredMentor[] => {
    const r = ranked.get(p.key);
    if (!p.touched) return r?.recommended ?? [];
    // 현재 점수로 갱신해 보여주되, 후보에서 빠진 멘토는 저장된 값을 그대로 둔다
    return p.selected.map((s) => r?.all.find((m) => m.mentorId === s.mentorId) ?? s);
  };

  const save = () => {
    setError(undefined);
    const payload = postings.map((p) => ({
      title: p.title,
      company: p.company,
      jobRole: p.jobRole,
      body: p.body,
      recommendations: ranked.get(p.key)?.recommended ?? [],
      selected: selectedOf(p),
    }));
    startTransition(async () => {
      const result = await saveMatching({ id: initial?.id, rawText, postings: payload });
      if (result?.error) setError(result.error);
    });
  };

  const focusCount = candidates.filter((c) => c.isFocus).length;
  const openSlotCount = candidates.filter((c) => c.openSlots > 0).length;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-5">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">공고 메시지</h2>
          <p className="mt-1 text-sm text-zinc-500">
            공고 여러 개가 담긴 메시지를 그대로 붙여넣으세요. 번호(1. 2.), [회사명], 빈 줄 등으로 공고를 나눕니다.
            잘못 나뉘면 공고 사이에 <code className="rounded bg-zinc-100 px-1">---</code> 줄을 넣어 주세요.
          </p>
        </div>
        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          rows={10}
          maxLength={MAX_RAW_TEXT}
          aria-label="공고 메시지"
          placeholder={"예)\n1. [토스] 프로덕트 디자이너 (~11/30)\n2. [네이버] 백엔드 개발자 신입\n3. 카카오 | 데이터 분석가"}
          className={`${inputClass} font-mono text-[13px] leading-relaxed`}
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={split}
            disabled={!rawText.trim()}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40"
          >
            {postings.length > 0 ? "다시 나누고 추천받기" : "공고 나누고 추천받기"}
          </button>
          <p className="text-xs text-zinc-500">
            후보: 진행 중 프로모션 소개 멘토 {candidates.length}명 (집중 판매 {focusCount}명 · 슬롯 오픈 {openSlotCount}명) · 공고별 {settings.recommendCount}명 추천
          </p>
        </div>
      </section>

      {postings.length > 0 && (
        <section className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-base font-semibold text-zinc-900">공고별 추천 멘토 ({postings.length})</h2>
            <p className="text-xs text-zinc-500">회사·직무를 고치면 추천이 바로 다시 계산됩니다.</p>
          </div>

          <OverallPick overall={overall} postingCount={postings.length} candidateById={candidateById} />

          {postings.map((p, idx) => (
            <PostingCard
              key={p.key}
              index={idx + 1}
              posting={p}
              selected={selectedOf(p)}
              all={ranked.get(p.key)?.all ?? []}
              candidateById={candidateById}
              onChange={(patch) => update(p.key, patch)}
              onSelect={(next) => update(p.key, { touched: true, selected: next })}
              onReset={() => update(p.key, { touched: false, selected: [] })}
              onRemove={() => {
                setDirty(true);
                setPostings((prev) => prev.filter((x) => x.key !== p.key));
              }}
            />
          ))}

          <button
            type="button"
            onClick={() => {
              setDirty(true);
              setPostings((prev) => [
                ...prev,
                { key: newKey(), title: "", company: "", jobRole: "", body: "", touched: false, selected: [] },
              ]);
            }}
            className="rounded-xl border border-dashed border-zinc-300 py-3 text-sm text-zinc-600 hover:bg-zinc-50"
          >
            공고 직접 추가
          </button>
        </section>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      {(postings.length > 0 || initial) && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={save}
            disabled={pending || postings.length === 0}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60"
          >
            {pending ? "저장 중..." : initial ? "변경 내용 저장" : "매칭 결과 저장"}
          </button>
          {initial && (
            <>
              <Link href="/marketing/matching" className="rounded-lg px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100">
                목록으로
              </Link>
              <DeleteButton id={initial.id} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function PostingCard({
  index,
  posting,
  selected,
  all,
  candidateById,
  onChange,
  onSelect,
  onReset,
  onRemove,
}: {
  index: number;
  posting: WorkPosting;
  selected: ScoredMentor[];
  all: ScoredMentor[];
  candidateById: Map<string, CandidateMentor>;
  onChange: (patch: Partial<WorkPosting>) => void;
  onSelect: (next: ScoredMentor[]) => void;
  onReset: () => void;
  onRemove: () => void;
}) {
  const selectedIds = new Set(selected.map((m) => m.mentorId));
  // 1명만 추천한다면 고를 멘토: 전체 후보 중 1위 (동점이면 집중 판매 → 이름순)
  const top = all[0] && all[0].score > 0 ? all[0] : undefined;
  const tiedCount = top ? all.filter((m) => m.score === top.score).length : 0;
  const addable = all.filter((m) => !selectedIds.has(m.mentorId));
  const id = (name: string) => `${posting.key}-${name}`;

  return (
    <article className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5">
      <div className="flex items-start gap-3">
        <span className="mt-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-600">
          {index}
        </span>
        <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-[2fr_1fr_1fr]">
          <LabeledInput id={id("title")} label="공고" value={posting.title} onChange={(v) => onChange({ title: v })} />
          <LabeledInput
            id={id("company")}
            label="회사"
            value={posting.company}
            placeholder="회사명"
            onChange={(v) => onChange({ company: v })}
          />
          <LabeledInput
            id={id("role")}
            label="직무"
            value={posting.jobRole}
            placeholder="직무"
            onChange={(v) => onChange({ jobRole: v })}
          />
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`${index}번 공고 빼기`}
          className="mt-6 shrink-0 rounded-md px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
        >
          빼기
        </button>
      </div>

      {posting.body && (
        <details className="ml-9 text-sm">
          <summary className="cursor-pointer text-xs text-zinc-500">공고 원문 보기</summary>
          <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-zinc-50 p-3 font-sans text-[13px] text-zinc-700">
            {posting.body}
          </pre>
        </details>
      )}

      <div className="ml-9 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-zinc-700">{posting.touched ? "확정 멘토" : "추천 멘토"}</h3>
          {posting.touched && (
            <button type="button" onClick={onReset} className="text-xs text-zinc-500 underline underline-offset-2">
              자동 추천으로 되돌리기
            </button>
          )}
        </div>

        {top && !selectedIds.has(top.mentorId) && (
          <p className="text-xs text-zinc-600">
            1명만 추천한다면: <span className="font-medium text-zinc-900">{top.mentorName}</span> ({top.score}점)
            {tiedCount > 1 && <span className="text-zinc-500"> · 동점 {tiedCount}명 중 집중 판매·이름순</span>}
          </p>
        )}

        {selected.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-200 py-4 text-center text-sm text-zinc-500">
            {posting.touched ? "선택한 멘토가 없습니다." : "점수가 있는 후보 멘토가 없습니다. 회사·직무를 확인해 주세요."}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {selected.map((m) => (
              <MentorRow
                key={m.mentorId}
                mentor={m}
                candidate={candidateById.get(m.mentorId)}
                topNote={m.mentorId === top?.mentorId ? (tiedCount > 1 ? `동점 ${tiedCount}명 중 집중 판매·이름순` : "") : undefined}
                onRemove={() => onSelect(selected.filter((s) => s.mentorId !== m.mentorId))}
              />
            ))}
          </ul>
        )}

        {addable.length > 0 && (
          <select
            value=""
            onChange={(e) => {
              const m = addable.find((x) => x.mentorId === e.target.value);
              if (m) onSelect([...selected, m]);
            }}
            aria-label={`${index}번 공고에 멘토 추가`}
            className={`${inputClass} text-zinc-600 sm:max-w-sm`}
          >
            <option value="">다른 후보 멘토 추가…</option>
            {addable.map((m) => (
              <option key={m.mentorId} value={m.mentorId}>
                {m.mentorName} · {m.score}점{candidateById.get(m.mentorId)?.isFocus ? " · ★집중" : ""}
                {candidateById.get(m.mentorId)?.openSlots ? " · 슬롯 오픈" : ""}
              </option>
            ))}
          </select>
        )}
      </div>
    </article>
  );
}

/** 메시지 전체에서 딱 1명만 추천한다면 */
function OverallPick({
  overall,
  postingCount,
  candidateById,
}: {
  overall: OverallMentor[];
  postingCount: number;
  candidateById: Map<string, CandidateMentor>;
}) {
  const [top, ...rest] = overall;
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-zinc-900 bg-zinc-50 px-5 py-4">
      <h3 className="text-xs font-medium text-zinc-500">전체에서 1명만 추천한다면</h3>
      {!top ? (
        <p className="text-sm text-zinc-600">회사·직무가 맞는 후보 멘토가 없습니다.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-base font-semibold text-zinc-900">{top.mentorName}</span>
            {candidateById.get(top.mentorId)?.detail && (
              <span className="text-xs text-zinc-500">{candidateById.get(top.mentorId)?.detail}</span>
            )}
            {candidateById.get(top.mentorId)?.isFocus && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">★ 집중 판매</span>
            )}
            <span className="ml-auto text-sm font-semibold tabular-nums text-zinc-900">합계 {top.total}점</span>
          </div>
          <p className="text-xs text-zinc-600">
            공고 {postingCount}건 중 {top.postingNumbers.length}건 일치 ({top.postingNumbers.map((n) => `${n}번`).join(", ")})
          </p>
          {rest.length > 0 && (
            <p className="text-xs text-zinc-500">
              다음 순위:{" "}
              {rest
                .slice(0, 2)
                .map((m) => `${m.mentorName} ${m.total}점(${m.postingNumbers.length}건)`)
                .join(" · ")}
            </p>
          )}
        </>
      )}
      <p className="text-[11px] text-zinc-400">
        공고별 점수 합계 기준. 회사·직무가 하나도 안 맞는 공고의 점수(집중 판매 가점만 있는 경우)는 더하지 않습니다.
      </p>
    </div>
  );
}

function MentorRow({
  mentor,
  candidate,
  topNote,
  onRemove,
}: {
  mentor: ScoredMentor;
  candidate?: CandidateMentor;
  /** 1순위 멘토면 정의됨 (동점이면 정한 기준 설명, 아니면 빈 문자열) */
  topNote?: string;
  onRemove: () => void;
}) {
  return (
    <li className="flex items-start gap-3 rounded-lg border border-zinc-200 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          {topNote !== undefined && (
            <span
              title={topNote || "이 공고에서 점수가 가장 높은 멘토"}
              className="rounded-full bg-zinc-900 px-2 py-0.5 text-xs font-medium text-white"
            >
              1순위
            </span>
          )}
          <span className="font-medium text-zinc-900">{mentor.mentorName}</span>
          {topNote && <span className="text-xs text-zinc-500">({topNote})</span>}
          {candidate?.detail && <span className="text-xs text-zinc-500">{candidate.detail}</span>}
          {candidate && candidate.openSlots > 0 && (
            <span
              title="아직 예약받을 수 있는(시작 24시간 전 마감 전) 빈 슬롯 수"
              className="rounded-full border border-[#7177F7] bg-[#F0F1FE] px-2 py-0.5 text-xs font-medium text-[#4D55F5]"
            >
              슬롯 오픈 {candidate.openSlots}개
            </span>
          )}
          {candidate && !candidate.inMentorDb && <span className="text-xs text-amber-700">멘토 DB에 없음</span>}
          {!candidate && <span className="text-xs text-zinc-400">현재 후보 아님 (저장 당시 값)</span>}
          {isBonusOnly(mentor) && <span className="text-xs text-amber-700">회사·직무 일치 없음</span>}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {mentor.reasons.map((r) => (
            <span key={r} className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
              {r}
            </span>
          ))}
          {candidate?.promotions.map((p) => (
            <span
              key={p.id}
              className={`rounded-full px-2 py-0.5 text-xs ${p.isFocus ? "bg-amber-50 font-medium text-amber-800" : "bg-blue-50 text-blue-700"}`}
            >
              {p.isFocus ? "★ " : ""}
              {p.title}
            </span>
          ))}
        </div>
      </div>
      <span className="shrink-0 text-sm font-semibold tabular-nums text-zinc-900">{mentor.score}점</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`${mentor.mentorName} 빼기`}
        className="shrink-0 rounded-md px-2 py-0.5 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
      >
        빼기
      </button>
    </li>
  );
}

function LabeledInput({
  id,
  label,
  value,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-zinc-500">
        {label}
      </label>
      <input id={id} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={inputClass} />
    </div>
  );
}

function DeleteButton({ id }: { id: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="ml-auto rounded-lg px-4 py-2 text-sm text-red-600 hover:bg-red-50"
      >
        삭제
      </button>
    );
  }

  return (
    <div className="ml-auto flex items-center gap-2 text-sm">
      {error && <span className="text-red-600">{error}</span>}
      <span className="text-zinc-600">정말 삭제할까요?</span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await deleteMatching(id);
            if (result?.error) setError(result.error);
          })
        }
        className="rounded-lg bg-red-600 px-3 py-1.5 font-medium text-white hover:bg-red-700 disabled:opacity-60"
      >
        {pending ? "삭제 중..." : "삭제"}
      </button>
      <button type="button" onClick={() => setConfirming(false)} className="rounded-lg px-3 py-1.5 text-zinc-700 hover:bg-zinc-100">
        취소
      </button>
    </div>
  );
}
