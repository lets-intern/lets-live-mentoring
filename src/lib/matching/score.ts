// 공고 ↔ 멘토 추천 점수. 서버·브라우저 양쪽에서 쓰는 순수 함수.
import { companyMatch, roleMatches, type CompanyMatch } from "./text";

export type MatchingWeights = {
  currentCompany: number;
  careerCompany: number;
  passCompany: number;
  currentRole: number;
  careerRole: number;
  passRole: number;
  desiredRole: number;
  focus: number;
};

export type MatchingSettings = {
  weights: MatchingWeights;
  recommendCount: number;
};

export const DEFAULT_SETTINGS: MatchingSettings = {
  weights: {
    currentCompany: 50,
    careerCompany: 30,
    passCompany: 20,
    currentRole: 30,
    careerRole: 20,
    passRole: 10,
    desiredRole: 15,
    focus: 25,
  },
  recommendCount: 2,
};

export const WEIGHT_MIN = 0;
export const WEIGHT_MAX = 100;
export const RECOMMEND_COUNT_MIN = 1;
export const RECOMMEND_COUNT_MAX = 5;

/** 설정 화면·추천 근거에 쓰는 항목 이름. 묶음(group) 안에서는 가장 높은 점수 하나만 반영한다. */
export const WEIGHT_FIELDS: { key: keyof MatchingWeights; label: string; source: string; group: "company" | "role" | "desired" | "focus" }[] = [
  { key: "currentCompany", label: "현직 회사 일치", source: "멘토 DB 재직 기업", group: "company" },
  { key: "careerCompany", label: "경력 회사 일치", source: "멘토 DB 경력 사항의 회사", group: "company" },
  { key: "passCompany", label: "서류 합격 회사 일치", source: "멘토 DB 서류 합격 이력의 회사", group: "company" },
  { key: "currentRole", label: "현직 직무 일치", source: "멘토 DB 직무", group: "role" },
  { key: "careerRole", label: "경력 직무 일치", source: "멘토 DB 경력 사항의 직무·직함", group: "role" },
  { key: "passRole", label: "서류 합격 직무 일치", source: "멘토 DB 서류 합격 이력의 직무", group: "role" },
  { key: "desiredRole", label: "멘토링 희망 직무 일치", source: "멘토 DB 멘토링 희망 직무", group: "desired" },
  { key: "focus", label: "집중 판매 멘토", source: "진행 중 프로모션의 집중 판매 표시", group: "focus" },
];

const LABEL = Object.fromEntries(WEIGHT_FIELDS.map((f) => [f.key, f.label])) as Record<keyof MatchingWeights, string>;

/** 추천 후보: 진행 중 프로모션의 소개 멘토 + 멘토 DB 정보 */
export type CandidateMentor = {
  mentorId: string;
  name: string;
  detail: string; // 재직 기업 · 직무 (화면 표시용)
  company: string | null;
  jobRole: string | null;
  desiredJobRoles: string | null;
  careers: { company: string | null; jobRole: string | null; jobTitle: string | null }[];
  documentPasses: { company: string | null; jobRole: string | null }[];
  isFocus: boolean; // 진행 중 프로모션 중 하나라도 집중 판매로 표시
  promotions: { id: string; title: string; isFocus: boolean }[];
  inMentorDb: boolean; // 멘토 DB 에서 못 찾으면 false (점수는 집중 판매만 반영)
};

export type ScoredMentor = {
  mentorId: string;
  mentorName: string;
  score: number;
  reasons: string[];
};

export type PostingKey = { company: string; jobRole: string };

/** 회사가 "유사"(공고 회사명이 멘토 회사명을 포함, 예: 카카오뱅크 ⊇ 카카오)일 때 인정 비율 */
export const PARTIAL_COMPANY_RATIO = 0.5;

type Hit = { key: keyof MatchingWeights; points: number; partial?: boolean };

/** 묶음 안에서 일치한 항목 중 점수가 가장 높은 것 하나 */
function best(hits: Hit[]): Hit | null {
  let top: Hit | null = null;
  for (const h of hits) if (top === null || h.points > top.points) top = h;
  return top;
}

function companyHit(key: keyof MatchingWeights, level: CompanyMatch, weights: MatchingWeights): Hit | null {
  if (!level) return null;
  const partial = level === "partial";
  return { key, partial, points: partial ? Math.round(weights[key] * PARTIAL_COMPANY_RATIO) : weights[key] };
}

/** 여러 값 중 가장 잘 맞는 회사 일치 정도 */
const bestCompanyLevel = (posting: string, values: (string | null)[]): CompanyMatch => {
  const levels = values.map((v) => companyMatch(posting, v));
  return levels.includes("exact") ? "exact" : levels.includes("partial") ? "partial" : null;
};

export function scoreMentor(posting: PostingKey, mentor: CandidateMentor, weights: MatchingWeights): ScoredMentor {
  const picked: Hit[] = [];

  const company = best(
    [
      companyHit("currentCompany", companyMatch(posting.company, mentor.company), weights),
      companyHit("careerCompany", bestCompanyLevel(posting.company, mentor.careers.map((c) => c.company)), weights),
      companyHit("passCompany", bestCompanyLevel(posting.company, mentor.documentPasses.map((d) => d.company)), weights),
    ].filter((h): h is Hit => h !== null),
  );
  if (company) picked.push(company);

  const roleHits: Hit[] = [];
  if (roleMatches(posting.jobRole, mentor.jobRole)) roleHits.push({ key: "currentRole", points: weights.currentRole });
  if (
    mentor.careers.some(
      // 직함(jobTitle)은 "매니저"·"인턴" 같은 일반 값이 많아 동의어 묶음으로만 본다
      (c) => roleMatches(posting.jobRole, c.jobRole) || roleMatches(posting.jobRole, c.jobTitle, { groupsOnly: true }),
    )
  ) {
    roleHits.push({ key: "careerRole", points: weights.careerRole });
  }
  if (mentor.documentPasses.some((d) => roleMatches(posting.jobRole, d.jobRole))) {
    roleHits.push({ key: "passRole", points: weights.passRole });
  }
  const role = best(roleHits);
  if (role) picked.push(role);

  if (roleMatches(posting.jobRole, mentor.desiredJobRoles)) picked.push({ key: "desiredRole", points: weights.desiredRole });
  if (mentor.isFocus) picked.push({ key: "focus", points: weights.focus });

  const counted = picked.filter((h) => h.points > 0);
  return {
    mentorId: mentor.mentorId,
    mentorName: mentor.name,
    score: counted.reduce((sum, h) => sum + h.points, 0),
    reasons: counted.map((h) => `${h.partial ? LABEL[h.key].replace("일치", "유사") : LABEL[h.key]} +${h.points}`),
  };
}

/** 근거가 집중 판매 가점뿐인지 (회사·직무가 하나도 안 맞음) */
export const isFocusOnly = (m: ScoredMentor) => m.reasons.length > 0 && m.reasons.every((r) => r.startsWith(LABEL.focus));

/** 점수 높은 순. 같으면 집중 판매 멘토 먼저, 그다음 이름순. */
export function rankMentors(posting: PostingKey, candidates: CandidateMentor[], weights: MatchingWeights) {
  const focus = new Map(candidates.map((c) => [c.mentorId, c.isFocus]));
  return candidates
    .map((c) => scoreMentor(posting, c, weights))
    .sort(
      (a, b) =>
        b.score - a.score ||
        Number(focus.get(b.mentorId)) - Number(focus.get(a.mentorId)) ||
        a.mentorName.localeCompare(b.mentorName, "ko"),
    );
}

export type OverallMentor = {
  mentorId: string;
  mentorName: string;
  /** 회사·직무가 맞은 공고들의 점수 합 */
  total: number;
  /** 회사·직무가 맞은 공고 번호 (1부터) */
  postingNumbers: number[];
};

/**
 * 메시지 전체에서 1명만 추천할 때의 순위.
 * 공고별 점수를 더하되, 회사·직무가 하나도 안 맞는 공고(집중 판매 가점뿐)는 빼서
 * 공고가 많을수록 집중 판매 멘토가 저절로 1위가 되는 것을 막는다.
 * 같으면 맞은 공고 수 → 집중 판매 → 이름순.
 */
export function rankOverall(rankedPerPosting: ScoredMentor[][], candidates: CandidateMentor[]): OverallMentor[] {
  const focus = new Map(candidates.map((c) => [c.mentorId, c.isFocus]));
  const byId = new Map<string, OverallMentor>();
  rankedPerPosting.forEach((list, idx) => {
    for (const m of list) {
      if (m.score <= 0 || isFocusOnly(m)) continue;
      const e = byId.get(m.mentorId) ?? { mentorId: m.mentorId, mentorName: m.mentorName, total: 0, postingNumbers: [] };
      e.total += m.score;
      e.postingNumbers.push(idx + 1);
      byId.set(m.mentorId, e);
    }
  });
  return [...byId.values()].sort(
    (a, b) =>
      b.total - a.total ||
      b.postingNumbers.length - a.postingNumbers.length ||
      Number(focus.get(b.mentorId)) - Number(focus.get(a.mentorId)) ||
      a.mentorName.localeCompare(b.mentorName, "ko"),
  );
}

/** 점수가 0보다 큰 상위 N명 */
export function recommend(posting: PostingKey, candidates: CandidateMentor[], settings: MatchingSettings): ScoredMentor[] {
  return rankMentors(posting, candidates, settings.weights)
    .filter((m) => m.score > 0)
    .slice(0, settings.recommendCount);
}

/** 저장된 값(jsonb)을 안전하게 설정으로 바꾼다. 빠지거나 잘못된 칸은 기본값. */
export function parseSettings(raw: unknown): MatchingSettings {
  const obj = (raw && typeof raw === "object" ? raw : {}) as { weights?: Record<string, unknown>; recommendCount?: unknown };
  const weights = { ...DEFAULT_SETTINGS.weights };
  for (const f of WEIGHT_FIELDS) {
    const v = obj.weights?.[f.key];
    if (typeof v === "number" && Number.isInteger(v) && v >= WEIGHT_MIN && v <= WEIGHT_MAX) weights[f.key] = v;
  }
  const rc = obj.recommendCount;
  const recommendCount =
    typeof rc === "number" && Number.isInteger(rc) && rc >= RECOMMEND_COUNT_MIN && rc <= RECOMMEND_COUNT_MAX
      ? rc
      : DEFAULT_SETTINGS.recommendCount;
  return { weights, recommendCount };
}
