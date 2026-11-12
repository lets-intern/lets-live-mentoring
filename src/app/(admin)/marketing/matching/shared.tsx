import type { CandidatePool } from "@/lib/matching/data";

/** 후보 멘토 풀 상태 안내 (진행 중 프로모션 없음, 멘토 DB 오류 등) */
export function PoolNotice({ pool }: { pool: CandidatePool }) {
  if (pool.activePromotions.length === 0) {
    return (
      <Notice>
        진행 중인 프로모션이 없어 추천할 후보 멘토가 없습니다. 프로모션 관리에서 기간과 소개 멘토를 확인해 주세요.
      </Notice>
    );
  }
  if (pool.candidates.length === 0) {
    return <Notice>진행 중인 프로모션에 등록된 (활성) 소개 멘토가 없습니다.</Notice>;
  }
  if (pool.mentorDbWarning) {
    return (
      <Notice>
        멘토 DB를 불러오지 못해 회사·직무 점수를 계산할 수 없습니다. 지금은 집중 판매·슬롯 오픈 여부만 반영됩니다. (
        {pool.mentorDbWarning})
      </Notice>
    );
  }
  if (pool.slotWarning) {
    return (
      <Notice>슬롯 현황을 불러오지 못해 슬롯 오픈 가점 없이 추천합니다. ({pool.slotWarning})</Notice>
    );
  }
  return null;
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800">
      {children}
    </div>
  );
}

export function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}
