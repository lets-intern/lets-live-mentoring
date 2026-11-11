"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import type { PromotionMentor } from "@/lib/promotions";
import { getSupabase, SUPABASE_NOT_CONFIGURED } from "@/lib/supabase";

const LIST_PATH = "/marketing/promotions";

export type PromotionFormState = { error?: string };

async function assertAuthed() {
  if (!(await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value))) {
    redirect("/login");
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseMentors(raw: string): PromotionMentor[] | null {
  try {
    const parsed: unknown = JSON.parse(raw || "[]");
    if (!Array.isArray(parsed)) return null;
    const seen = new Set<string>();
    const mentors: PromotionMentor[] = [];
    for (const m of parsed) {
      if (!m || typeof m.mentorId !== "string" || typeof m.mentorName !== "string") return null;
      if (seen.has(m.mentorId)) continue;
      seen.add(m.mentorId);
      mentors.push({ mentorId: m.mentorId, mentorName: m.mentorName, isFocus: m.isFocus === true });
    }
    return mentors;
  } catch {
    return null;
  }
}

function isHttpUrl(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export async function savePromotion(_prev: PromotionFormState, formData: FormData): Promise<PromotionFormState> {
  await assertAuthed();

  const id = String(formData.get("id") ?? "") || null;
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const detailUrl = String(formData.get("detailUrl") ?? "").trim();
  const startsOn = String(formData.get("startsOn") ?? "");
  const endsOn = String(formData.get("endsOn") ?? "");
  const mentors = parseMentors(String(formData.get("mentors") ?? ""));

  if (!title) return { error: "한 줄 컨셉을 입력해 주세요." };
  if (!DATE_RE.test(startsOn) || !DATE_RE.test(endsOn)) return { error: "프로모션 기간을 입력해 주세요." };
  if (endsOn < startsOn) return { error: "종료일은 시작일보다 빠를 수 없습니다." };
  if (detailUrl && !isHttpUrl(detailUrl)) return { error: "상세페이지 URL은 http:// 또는 https:// 로 시작해야 합니다." };
  if (!mentors) return { error: "소개 멘토 정보가 올바르지 않습니다. 새로고침 후 다시 시도해 주세요." };

  const supabase = getSupabase();
  if (!supabase) return { error: SUPABASE_NOT_CONFIGURED };

  const { error } = await supabase.rpc("save_promotion", {
    p_id: id,
    p_title: title,
    p_description: description || null,
    p_detail_url: detailUrl || null,
    p_starts_on: startsOn,
    p_ends_on: endsOn,
    p_mentors: mentors,
  });
  if (error) {
    console.error("프로모션 저장 실패", error);
    return { error: error.code === "P0002" ? "이미 삭제된 프로모션입니다." : "저장하지 못했습니다. 잠시 후 다시 시도해 주세요." };
  }

  revalidatePath(LIST_PATH);
  redirect(LIST_PATH);
}

export async function deletePromotion(id: string): Promise<PromotionFormState> {
  await assertAuthed();

  const supabase = getSupabase();
  if (!supabase) return { error: SUPABASE_NOT_CONFIGURED };

  const { error } = await supabase.from("promotions").delete().eq("id", id);
  if (error) {
    console.error("프로모션 삭제 실패", error);
    return { error: "삭제하지 못했습니다. 잠시 후 다시 시도해 주세요." };
  }

  revalidatePath(LIST_PATH);
  redirect(LIST_PATH);
}
