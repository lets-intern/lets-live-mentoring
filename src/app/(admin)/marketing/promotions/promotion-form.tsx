"use client";

import Link from "next/link";
import { useActionState, useDeferredValue, useState, useTransition } from "react";
import { Icon } from "@/components/icons";
import type { Promotion, PromotionMentor } from "@/lib/promotions";
import { deletePromotion, savePromotion, type PromotionFormState } from "./actions";

/** 멘토 DB 에서 고를 수 있는 멘토 (서버에서 필요한 칸만 추려 넘긴다) */
export type MentorOption = {
  mentorId: string;
  name: string;
  detail: string; // 재직 기업 · 직무 등 검색/구분용
  active: boolean;
};

const inputClass =
  "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400";

type Props = {
  promotion?: Promotion;
  mentorOptions: MentorOption[];
  mentorLoadError?: string;
};

export function PromotionForm({ promotion, mentorOptions, mentorLoadError }: Props) {
  const [state, action, pending] = useActionState<PromotionFormState, FormData>(savePromotion, {});
  const [selected, setSelected] = useState<PromotionMentor[]>(promotion?.mentors ?? []);

  return (
    <form action={action} className="flex max-w-3xl flex-col gap-6">
      {promotion && <input type="hidden" name="id" value={promotion.id} />}
      <input type="hidden" name="mentors" value={JSON.stringify(selected)} />

      <Section title="컨셉">
        <Field label="한 줄 컨셉" htmlFor="title" required>
          <input
            id="title"
            name="title"
            required
            defaultValue={promotion?.title}
            placeholder="예) 상반기 공채 대비 현직자 1:1 LIVE 멘토링"
            className={inputClass}
          />
        </Field>
        <Field label="상세 설명" htmlFor="description">
          <textarea
            id="description"
            name="description"
            rows={4}
            defaultValue={promotion?.description ?? ""}
            placeholder="타깃, 메시지, 혜택 등 프로모션 컨셉을 자세히 적어 주세요."
            className={inputClass}
          />
        </Field>
      </Section>

      <Section title="기간 · 상세페이지">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="시작일" htmlFor="startsOn" required>
            <input id="startsOn" name="startsOn" type="date" required defaultValue={promotion?.startsOn} className={inputClass} />
          </Field>
          <Field label="종료일" htmlFor="endsOn" required>
            <input id="endsOn" name="endsOn" type="date" required defaultValue={promotion?.endsOn} className={inputClass} />
          </Field>
        </div>
        <Field label="상세페이지 URL" htmlFor="detailUrl">
          <input
            id="detailUrl"
            name="detailUrl"
            type="url"
            defaultValue={promotion?.detailUrl ?? ""}
            placeholder="https://"
            className={inputClass}
          />
        </Field>
      </Section>

      <Section
        title="소개 멘토"
        description="멘토 DB에서 골라 추가하고, 잘 팔아야 하는 멘토는 '집중 판매'로 표시해 주세요."
      >
        <MentorPicker
          options={mentorOptions}
          loadError={mentorLoadError}
          selected={selected}
          onChange={setSelected}
        />
      </Section>

      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60"
        >
          {pending ? "저장 중..." : "저장"}
        </button>
        <Link href="/marketing/promotions" className="rounded-lg px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100">
          취소
        </Link>
        {promotion && <DeleteButton id={promotion.id} />}
      </div>
    </form>
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
            const result = await deletePromotion(id);
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

function MentorPicker({
  options,
  loadError,
  selected,
  onChange,
}: {
  options: MentorOption[];
  loadError?: string;
  selected: PromotionMentor[];
  onChange: (next: PromotionMentor[]) => void;
}) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const selectedIds = new Set(selected.map((m) => m.mentorId));
  const terms = deferredQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const candidates =
    terms.length === 0
      ? []
      : options
          .filter((o) => !selectedIds.has(o.mentorId))
          .filter((o) => {
            const text = `${o.name}\n${o.detail}`.toLowerCase();
            return terms.every((t) => text.includes(t));
          })
          .slice(0, 8);

  const add = (o: MentorOption) => {
    onChange([...selected, { mentorId: o.mentorId, mentorName: o.name, isFocus: false }]);
    setQuery("");
  };
  const toggleFocus = (id: string) =>
    onChange(selected.map((m) => (m.mentorId === id ? { ...m, isFocus: !m.isFocus } : m)));
  const remove = (id: string) => onChange(selected.filter((m) => m.mentorId !== id));

  return (
    <div className="flex flex-col gap-3">
      {loadError ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          멘토 DB를 불러오지 못해 새 멘토를 추가할 수 없습니다. ({loadError})
        </p>
      ) : (
        <div className="relative">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault(); // 검색창에서 엔터로 폼이 제출되지 않게
                if (candidates[0]) add(candidates[0]);
              }
            }}
            placeholder="이름, 활동명, 기업, 직무로 멘토 찾기"
            aria-label="추가할 멘토 찾기"
            className={`${inputClass} pl-9`}
          />
          {terms.length > 0 && (
            <ul className="absolute inset-x-0 top-full z-10 mt-1 max-h-72 overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
              {candidates.length === 0 ? (
                <li className="px-3 py-2 text-sm text-zinc-500">조건에 맞는 멘토가 없습니다.</li>
              ) : (
                candidates.map((o) => (
                  <li key={o.mentorId}>
                    <button
                      type="button"
                      onClick={() => add(o)}
                      className="flex w-full items-baseline gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-50"
                    >
                      <span className="font-medium text-zinc-900">{o.name}</span>
                      <span className="truncate text-xs text-zinc-500">{o.detail}</span>
                      {!o.active && <span className="ml-auto shrink-0 text-xs text-zinc-400">비활성</span>}
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      )}

      {selected.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-200 py-6 text-center text-sm text-zinc-500">
          아직 추가한 멘토가 없습니다.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white">
          {selected.map((m) => (
            <li key={m.mentorId} className="flex items-center gap-3 px-3 py-2.5 text-sm">
              <span className="font-medium text-zinc-900">{m.mentorName}</span>
              <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-zinc-700">
                <input
                  type="checkbox"
                  checked={m.isFocus}
                  onChange={() => toggleFocus(m.mentorId)}
                  className="h-4 w-4 accent-amber-500"
                />
                집중 판매
              </label>
              <button
                type="button"
                onClick={() => remove(m.mentorId)}
                aria-label={`${m.mentorName} 빼기`}
                className="rounded-md px-2 py-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
              >
                빼기
              </button>
            </li>
          ))}
        </ul>
      )}
      {selected.length > 0 && (
        <p className="text-xs text-zinc-500">
          소개 멘토 {selected.length}명 · 집중 판매 {selected.filter((m) => m.isFocus).length}명
        </p>
      )}
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5">
      <div>
        <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
        {description && <p className="mt-1 text-sm text-zinc-500">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  htmlFor,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-zinc-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}
