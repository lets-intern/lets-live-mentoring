import "server-only";
import { fetchMentors } from "@/lib/lets-operation";
import { listPromotions, promotionStatus, todayKst, type Result } from "@/lib/promotions";
import { bookingCutoff, isBookable } from "@/lib/slot-time";
import { fetchSlots } from "@/lib/slots";
import { getSupabase, SUPABASE_NOT_CONFIGURED } from "@/lib/supabase";
import { DEFAULT_SETTINGS, parseSettings, type CandidateMentor, type MatchingSettings, type ScoredMentor } from "./score";

/** 추천 점수 설정. 저장된 값이 없으면 기본값. */
export async function getMatchingSettings(): Promise<Result<MatchingSettings>> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, message: SUPABASE_NOT_CONFIGURED };

  const { data, error } = await supabase.from("matching_settings").select("settings").eq("id", 1).maybeSingle();
  if (error) {
    console.error("매칭 설정 조회 실패", error);
    return { ok: false, message: "추천 점수 설정을 불러오지 못했습니다." };
  }
  return { ok: true, data: data ? parseSettings(data.settings) : DEFAULT_SETTINGS };
}

export type CandidatePool = {
  candidates: CandidateMentor[];
  activePromotions: { id: string; title: string }[];
  /** 멘토 DB 를 못 불러왔을 때 경고 (후보는 이름·집중 판매만으로 계산) */
  mentorDbWarning?: string;
  /** 슬롯 현황(Redash)을 못 불러왔을 때 경고 (슬롯 오픈 가점 없이 계산) */
  slotWarning?: string;
  /** 회사명 추출 보조용: 멘토 DB 전체의 회사명 */
  knownCompanies: string[];
};

/**
 * 추천 후보 = 진행 중인 모든 프로모션의 소개 멘토(중복 제거).
 * 멘토 DB 에서 비활성인 멘토는 뺀다.
 * 슬롯 현황은 멘토 ID 가 없어 본명(또는 활동명 = 슬롯의 닉네임)으로 잇는다.
 */
export async function loadCandidatePool(): Promise<Result<CandidatePool>> {
  const [promotions, mentors, slots] = await Promise.all([listPromotions(), fetchMentors(), fetchSlots()]);
  if (!promotions.ok) return promotions;

  // 이름 → 아직 예약받을 수 있는 빈 슬롯 수
  const openByName = new Map<string, number>();
  if (slots.ok) {
    const cutoff = bookingCutoff(slots.now);
    for (const s of slots.slots) {
      if (!isBookable(s, cutoff)) continue;
      for (const name of new Set([s.mentorName, s.mentorNickname])) {
        if (name) openByName.set(name, (openByName.get(name) ?? 0) + s.slotCount);
      }
    }
  }
  const openSlotsOf = (...names: (string | null | undefined)[]) =>
    Math.max(0, ...names.map((n) => (n ? openByName.get(n.trim()) ?? 0 : 0)));

  const today = todayKst();
  const active = promotions.data.filter((p) => promotionStatus(p, today) === "진행 중");
  const mentorById = new Map(mentors.ok ? mentors.mentors.map((m) => [m.mentorId, m]) : []);

  const byId = new Map<string, CandidateMentor>();
  for (const p of active) {
    for (const pm of p.mentors) {
      const m = mentorById.get(pm.mentorId);
      if (m && !m.active) continue;

      const existing = byId.get(pm.mentorId);
      if (existing) {
        existing.isFocus ||= pm.isFocus;
        if (!existing.promotions.some((x) => x.id === p.id)) {
          existing.promotions.push({ id: p.id, title: p.title, isFocus: pm.isFocus });
        }
        continue;
      }
      byId.set(pm.mentorId, {
        mentorId: pm.mentorId,
        name: m ? (m.activityName ? `${m.realName}(${m.activityName})` : m.realName) : pm.mentorName,
        detail: m ? [m.company, m.jobRole].filter(Boolean).join(" · ") : "",
        company: m?.company ?? null,
        jobRole: m?.jobRole ?? null,
        desiredJobRoles: m?.desiredJobRoles ?? null,
        careers: (m?.careers ?? []).map((c) => ({ company: c.company, jobRole: c.jobRole, jobTitle: c.jobTitle })),
        documentPasses: (m?.documentPasses ?? []).map((d) => ({ company: d.company, jobRole: d.jobRole })),
        isFocus: pm.isFocus,
        promotions: [{ id: p.id, title: p.title, isFocus: pm.isFocus }],
        inMentorDb: Boolean(m),
        openSlots: m ? openSlotsOf(m.realName, m.activityName) : openSlotsOf(pm.mentorName),
      });
    }
  }

  const knownCompanies = new Set<string>();
  if (mentors.ok) {
    for (const m of mentors.mentors) {
      for (const c of [m.company, ...m.careers.map((x) => x.company), ...m.documentPasses.map((x) => x.company)]) {
        if (c && c.trim().length >= 2) knownCompanies.add(c.trim());
      }
    }
  }

  return {
    ok: true,
    data: {
      candidates: [...byId.values()],
      activePromotions: active.map((p) => ({ id: p.id, title: p.title })),
      mentorDbWarning: mentors.ok ? undefined : mentors.message,
      slotWarning: slots.ok ? undefined : slots.message,
      knownCompanies: [...knownCompanies],
    },
  };
}

export type SavedPosting = {
  title: string;
  company: string;
  jobRole: string;
  body: string;
  recommendations: ScoredMentor[];
  selected: ScoredMentor[];
};

export type Matching = {
  id: string;
  rawText: string;
  createdAt: string;
  updatedAt: string;
  postings: SavedPosting[];
};

type Row = {
  id: string;
  raw_text: string;
  created_at: string;
  updated_at: string;
  matching_postings: {
    sort_order: number;
    title: string;
    company: string;
    job_role: string;
    body: string;
    recommendations: ScoredMentor[];
    selected: ScoredMentor[];
  }[];
};

const SELECT =
  "id, raw_text, created_at, updated_at, matching_postings(sort_order, title, company, job_role, body, recommendations, selected)";

function toMatching(r: Row): Matching {
  return {
    id: r.id,
    rawText: r.raw_text,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    postings: [...r.matching_postings]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((p) => ({
        title: p.title,
        company: p.company,
        jobRole: p.job_role,
        body: p.body,
        recommendations: Array.isArray(p.recommendations) ? p.recommendations : [],
        selected: Array.isArray(p.selected) ? p.selected : [],
      })),
  };
}

/** 이력 목록용 요약 (원문·본문은 빼고 가져온다) */
export type MatchingSummary = {
  id: string;
  updatedAt: string;
  postings: { company: string; jobRole: string; title: string; selectedNames: string[] }[];
};

type SummaryRow = {
  id: string;
  updated_at: string;
  matching_postings: { sort_order: number; title: string; company: string; job_role: string; selected: ScoredMentor[] }[];
};

export async function listMatchings(limit = 30): Promise<Result<MatchingSummary[]>> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, message: SUPABASE_NOT_CONFIGURED };

  const { data, error } = await supabase
    .from("matchings")
    .select("id, updated_at, matching_postings(sort_order, title, company, job_role, selected)")
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("매칭 이력 조회 실패", error);
    return { ok: false, message: "매칭 이력을 불러오지 못했습니다." };
  }
  return {
    ok: true,
    data: (data as SummaryRow[]).map((r) => ({
      id: r.id,
      updatedAt: r.updated_at,
      postings: [...r.matching_postings]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((p) => ({
          title: p.title,
          company: p.company,
          jobRole: p.job_role,
          selectedNames: Array.isArray(p.selected) ? p.selected.map((s) => s.mentorName) : [],
        })),
    })),
  };
}

export async function getMatching(id: string): Promise<Result<Matching | null>> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, message: SUPABASE_NOT_CONFIGURED };

  const { data, error } = await supabase.from("matchings").select(SELECT).eq("id", id).maybeSingle();
  if (error) {
    if (error.code === "22P02") return { ok: true, data: null };
    console.error("매칭 조회 실패", error);
    return { ok: false, message: "매칭을 불러오지 못했습니다." };
  }
  return { ok: true, data: data ? toMatching(data as Row) : null };
}
