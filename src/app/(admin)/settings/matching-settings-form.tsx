"use client";

import { useActionState } from "react";
import {
  DEFAULT_SETTINGS,
  RECOMMEND_COUNT_MAX,
  RECOMMEND_COUNT_MIN,
  WEIGHT_FIELDS,
  WEIGHT_MAX,
  WEIGHT_MIN,
  type MatchingSettings,
} from "@/lib/matching/score";
import { saveMatchingSettings, type SettingsFormState } from "./actions";

const inputClass =
  "w-24 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-right text-sm tabular-nums outline-none focus:border-zinc-400";

const GROUP_NOTE: Record<string, string> = {
  company: "회사 일치 — 셋 중 가장 높은 점수 하나만 반영",
  role: "직무 일치 — 셋 중 가장 높은 점수 하나만 반영",
  desired: "추가 가점",
  focus: "추가 가점",
  slot: "추가 가점 — 슬롯을 연 멘토를 우선 추천",
};

export function MatchingSettingsForm({ settings }: { settings: MatchingSettings }) {
  const [state, action, pending] = useActionState<SettingsFormState, FormData>(saveMatchingSettings, {});
  const groups = [...new Set(WEIGHT_FIELDS.map((f) => f.group))];

  return (
    <form action={action} className="flex flex-col gap-5">
      {/* 저장된 값이 바뀌면(초기화 포함) 입력칸을 새 값으로 다시 그린다 */}
      {/* 실패 시에는 입력한 값을 유지한다 (React 가 액션 후 폼을 초기화하므로 defaultValue 로 되살린다) */}
      <div key={JSON.stringify([settings, state.values])} className="flex flex-col gap-5">
        {groups.map((g) => (
          <fieldset key={g} className="flex flex-col gap-2">
            <legend className="mb-1 text-xs font-medium text-zinc-500">{GROUP_NOTE[g]}</legend>
            {WEIGHT_FIELDS.filter((f) => f.group === g).map((f) => (
              <div key={f.key} className="flex items-center gap-3">
                <label htmlFor={f.key} className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-zinc-800">{f.label}</span>
                  <span className="block text-xs text-zinc-500">
                    {f.source} · 기본값 {DEFAULT_SETTINGS.weights[f.key]}
                  </span>
                </label>
                <input
                  id={f.key}
                  name={f.key}
                  type="number"
                  inputMode="numeric"
                  min={WEIGHT_MIN}
                  max={WEIGHT_MAX}
                  step={1}
                  required
                  defaultValue={state.values?.[f.key] ?? settings.weights[f.key]}
                  className={inputClass}
                />
                <span className="w-4 text-sm text-zinc-500">점</span>
              </div>
            ))}
          </fieldset>
        ))}

        <fieldset className="flex flex-col gap-2 border-t border-zinc-100 pt-4">
          <div className="flex items-center gap-3">
            <label htmlFor="recommendCount" className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-zinc-800">공고별 추천 인원</span>
              <span className="block text-xs text-zinc-500">점수가 0점보다 큰 멘토 중 상위 N명을 추천합니다.</span>
            </label>
            <input
              id="recommendCount"
              name="recommendCount"
              type="number"
              inputMode="numeric"
              min={RECOMMEND_COUNT_MIN}
              max={RECOMMEND_COUNT_MAX}
              step={1}
              required
              defaultValue={state.values?.recommendCount ?? settings.recommendCount}
              className={inputClass}
            />
            <span className="w-4 text-sm text-zinc-500">명</span>
          </div>
        </fieldset>
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      {!state.error && state.savedAt && (
        <p role="status" className="text-sm text-emerald-700">
          저장했습니다. 공고&멘토 매칭에 바로 반영됩니다.
        </p>
      )}

      <p className="text-xs text-zinc-500">
        회사명이 한쪽만 포함하는 경우(예: 공고 &lsquo;카카오뱅크&rsquo; ↔ 멘토 &lsquo;카카오&rsquo;)는 &lsquo;유사&rsquo;로 보고 회사 점수의 절반만 줍니다.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60"
        >
          {pending ? "저장 중..." : "저장"}
        </button>
        <button
          type="submit"
          name="intent"
          value="reset"
          formNoValidate
          disabled={pending}
          className="rounded-lg px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100 disabled:opacity-60"
        >
          기본값으로 되돌리기
        </button>
      </div>
    </form>
  );
}
