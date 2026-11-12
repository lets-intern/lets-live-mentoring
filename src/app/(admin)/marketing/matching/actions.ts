"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SavedPosting } from "@/lib/matching/data";
import { MAX_POSTINGS, MAX_RAW_TEXT } from "@/lib/matching/limits";
import type { ScoredMentor } from "@/lib/matching/score";
import { assertAuthed } from "@/lib/server-auth";
import { getSupabase, SUPABASE_NOT_CONFIGURED } from "@/lib/supabase";

const LIST_PATH = "/marketing/matching";
const MAX_TEXT = MAX_RAW_TEXT;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type MatchingActionState = { error?: string };

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

function parseMentors(raw: unknown): ScoredMentor[] | null {
  if (!Array.isArray(raw)) return null;
  const out: ScoredMentor[] = [];
  const seen = new Set<string>();
  for (const m of raw) {
    if (!m || typeof m.mentorId !== "string" || typeof m.mentorName !== "string") return null;
    if (seen.has(m.mentorId)) continue;
    seen.add(m.mentorId);
    out.push({
      mentorId: m.mentorId,
      mentorName: m.mentorName.slice(0, 100),
      score: typeof m.score === "number" && Number.isFinite(m.score) ? m.score : 0,
      reasons: Array.isArray(m.reasons) ? m.reasons.filter((r: unknown) => typeof r === "string").slice(0, 10) : [],
    });
  }
  return out;
}

function parsePostings(raw: unknown): SavedPosting[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_POSTINGS) return null;
  const out: SavedPosting[] = [];
  for (const p of raw) {
    if (!p || typeof p !== "object") return null;
    const recommendations = parseMentors(p.recommendations);
    const selected = parseMentors(p.selected);
    if (!recommendations || !selected) return null;
    out.push({
      title: str(p.title, 300).trim(),
      company: str(p.company, 100).trim(),
      jobRole: str(p.jobRole, 100).trim(),
      body: str(p.body, MAX_TEXT),
      recommendations,
      selected,
    });
  }
  return out;
}

export async function saveMatching(input: { id?: string; rawText: string; postings: unknown }): Promise<MatchingActionState> {
  await assertAuthed();

  if (!input || typeof input !== "object") return { error: "요청이 올바르지 않습니다." };
  if (input.id && !UUID_RE.test(input.id)) return { error: "매칭 정보가 올바르지 않습니다." };
  if (typeof input.rawText !== "string") return { error: "공고 메시지가 올바르지 않습니다." };
  if (input.rawText.length > MAX_TEXT) return { error: `공고 메시지는 ${MAX_TEXT.toLocaleString()}자까지 저장할 수 있습니다.` };
  if (Array.isArray(input.postings) && input.postings.length > MAX_POSTINGS) {
    return { error: `공고는 한 번에 ${MAX_POSTINGS}개까지 저장할 수 있습니다.` };
  }
  const rawText = input.rawText;
  const postings = parsePostings(input.postings);
  if (!postings) return { error: "공고 정보가 올바르지 않습니다. 새로고침 후 다시 시도해 주세요." };
  if (postings.length === 0) return { error: "저장할 공고가 없습니다." };

  const supabase = getSupabase();
  if (!supabase) return { error: SUPABASE_NOT_CONFIGURED };

  const { data, error } = await supabase.rpc("save_matching", {
    p_id: input.id || null,
    p_raw_text: rawText,
    p_postings: postings,
  });
  if (error) {
    console.error("매칭 저장 실패", error);
    return { error: error.code === "P0002" ? "이미 삭제된 매칭입니다." : "저장하지 못했습니다. 잠시 후 다시 시도해 주세요." };
  }

  revalidatePath(LIST_PATH);
  redirect(`${LIST_PATH}/${data as string}?saved=1`);
}

export async function deleteMatching(id: string): Promise<MatchingActionState> {
  await assertAuthed();

  const supabase = getSupabase();
  if (!supabase) return { error: SUPABASE_NOT_CONFIGURED };

  if (!UUID_RE.test(id)) return { error: "매칭 정보가 올바르지 않습니다." };
  const { data, error } = await supabase.from("matchings").delete().eq("id", id).select("id");
  if (!error && data.length === 0) return { error: "이미 삭제된 매칭입니다." };
  if (error) {
    console.error("매칭 삭제 실패", error);
    return { error: "삭제하지 못했습니다. 잠시 후 다시 시도해 주세요." };
  }

  revalidatePath(LIST_PATH);
  redirect(LIST_PATH);
}
