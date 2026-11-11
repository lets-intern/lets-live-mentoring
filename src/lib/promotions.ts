import "server-only";
import { getSupabase, SUPABASE_NOT_CONFIGURED } from "./supabase";

export type PromotionMentor = {
  mentorId: string;
  mentorName: string;
  isFocus: boolean;
};

export type Promotion = {
  id: string;
  title: string;
  description: string | null;
  detailUrl: string | null;
  startsOn: string; // YYYY-MM-DD
  endsOn: string; // YYYY-MM-DD
  mentors: PromotionMentor[];
};

export type PromotionStatus = "진행 중" | "예정" | "종료";

type Row = {
  id: string;
  title: string;
  description: string | null;
  detail_url: string | null;
  starts_on: string;
  ends_on: string;
  promotion_mentors: { mentor_id: string; mentor_name: string; is_focus: boolean; sort_order: number }[];
};

const SELECT = "id, title, description, detail_url, starts_on, ends_on, promotion_mentors(mentor_id, mentor_name, is_focus, sort_order)";

function toPromotion(r: Row): Promotion {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    detailUrl: r.detail_url,
    startsOn: r.starts_on,
    endsOn: r.ends_on,
    mentors: [...r.promotion_mentors]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((m) => ({ mentorId: m.mentor_id, mentorName: m.mentor_name, isFocus: m.is_focus })),
  };
}

/** 운영 기준(한국 시간) 오늘 날짜 YYYY-MM-DD */
export function todayKst(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

export function promotionStatus(p: Pick<Promotion, "startsOn" | "endsOn">, today = todayKst()): PromotionStatus {
  if (p.startsOn > today) return "예정";
  if (p.endsOn < today) return "종료";
  return "진행 중";
}

export type Result<T> = { ok: true; data: T } | { ok: false; message: string };

export async function listPromotions(): Promise<Result<Promotion[]>> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, message: SUPABASE_NOT_CONFIGURED };

  const { data, error } = await supabase.from("promotions").select(SELECT).order("starts_on", { ascending: false });
  if (error) {
    console.error("프로모션 목록 조회 실패", error);
    return { ok: false, message: "프로모션 목록을 불러오지 못했습니다." };
  }
  return { ok: true, data: (data as Row[]).map(toPromotion) };
}

export async function getPromotion(id: string): Promise<Result<Promotion | null>> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, message: SUPABASE_NOT_CONFIGURED };

  const { data, error } = await supabase.from("promotions").select(SELECT).eq("id", id).maybeSingle();
  if (error) {
    // 잘못된 uuid 형식은 "없음"으로 취급
    if (error.code === "22P02") return { ok: true, data: null };
    console.error("프로모션 조회 실패", error);
    return { ok: false, message: "프로모션을 불러오지 못했습니다." };
  }
  return { ok: true, data: data ? toPromotion(data as Row) : null };
}
