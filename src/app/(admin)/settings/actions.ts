"use server";

import { revalidatePath } from "next/cache";
import {
  DEFAULT_SETTINGS,
  RECOMMEND_COUNT_MAX,
  RECOMMEND_COUNT_MIN,
  WEIGHT_FIELDS,
  WEIGHT_MAX,
  WEIGHT_MIN,
  type MatchingSettings,
} from "@/lib/matching/score";
import { assertAuthed } from "@/lib/server-auth";
import { getSupabase, SUPABASE_NOT_CONFIGURED } from "@/lib/supabase";

/** values: 저장에 실패했을 때 입력한 값을 그대로 다시 보여주기 위한 값 */
export type SettingsFormState = { error?: string; savedAt?: number; values?: Record<string, string> };

function toInt(value: FormDataEntryValue | null): number | null {
  const s = String(value ?? "").trim();
  if (!/^\d+$/.test(s)) return null;
  return Number(s);
}

async function upsert(settings: MatchingSettings): Promise<SettingsFormState> {
  const supabase = getSupabase();
  if (!supabase) return { error: SUPABASE_NOT_CONFIGURED };

  const { error } = await supabase
    .from("matching_settings")
    .upsert({ id: 1, settings, updated_at: new Date().toISOString() });
  if (error) {
    console.error("매칭 설정 저장 실패", error);
    return { error: "저장하지 못했습니다. 잠시 후 다시 시도해 주세요." };
  }

  revalidatePath("/settings");
  revalidatePath("/marketing/matching", "layout");
  return { savedAt: Date.now() };
}

export async function saveMatchingSettings(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  await assertAuthed();

  if (formData.get("intent") === "reset") return upsert(DEFAULT_SETTINGS);

  const values = Object.fromEntries(
    [...WEIGHT_FIELDS.map((f) => f.key), "recommendCount"].map((k) => [k, String(formData.get(k) ?? "")]),
  );
  const fail = (error: string): SettingsFormState => ({ error, values });

  const weights = { ...DEFAULT_SETTINGS.weights };
  for (const f of WEIGHT_FIELDS) {
    const v = toInt(formData.get(f.key));
    if (v === null || v < WEIGHT_MIN || v > WEIGHT_MAX) {
      return fail(`'${f.label}' 점수는 ${WEIGHT_MIN}~${WEIGHT_MAX} 사이 정수로 입력해 주세요.`);
    }
    weights[f.key] = v;
  }
  const recommendCount = toInt(formData.get("recommendCount"));
  if (recommendCount === null || recommendCount < RECOMMEND_COUNT_MIN || recommendCount > RECOMMEND_COUNT_MAX) {
    return fail(`추천 인원은 ${RECOMMEND_COUNT_MIN}~${RECOMMEND_COUNT_MAX}명 사이로 입력해 주세요.`);
  }

  const result = await upsert({ weights, recommendCount });
  return result.error ? fail(result.error) : result;
}
