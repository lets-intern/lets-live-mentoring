import "server-only";
import { fetchRedashResult, INFLOW_QUERY, type RedashRow } from "./redash";

/**
 * 전환 관리 대시보드: 1:1 LIVE 멘토링 결제 유입경로 (Redash 쿼리 479, GA4).
 * GA 기준이라 광고 차단 등으로 실제 결제보다 적게 잡힐 수 있다. 결제 한 건이 한 줄이다.
 */

export type Purchase = {
  at: string;
  program: string;
  amount: number;
  channel: string;
  route: string;
  campaign: string | null;
  sitePath: string;
  lastPage: string | null;
};

/** count 는 0원 결제를 포함한 전체 건수, free 는 그중 0원 결제 건수. */
export type Group = { label: string; count: number; free: number; amount: number };

export type ConversionDashboard =
  | {
      ok: true;
      retrievedAt: string;
      from: string | null;
      to: string | null;
      total: number;
      /** 0원 결제(쿠폰 전액 할인 등) 건수 */
      free: number;
      amount: number;
      byChannel: Group[];
      bySitePath: Group[];
      byProgram: Group[];
      byCampaign: Group[];
      /** 유입채널 × 사이트 내 경로 건수 */
      matrix: { channels: string[]; paths: string[]; counts: Record<string, Record<string, number>> };
      recent: Purchase[];
    }
  | { ok: false; message: string };

const RECENT_LIMIT = 20;
const SITE_PATH_ORDER = ["멘토링 목록 경유", "대기업 멘토관 경유", "상세 직접 진입", "세션 경로 없음"];

const str = (v: RedashRow[string]) => (v === null || v === undefined || v === "" ? null : String(v));

function toPurchase(r: RedashRow): Purchase | null {
  const at = str(r["결제_일시"]);
  if (!at) return null;
  return {
    at,
    program: str(r["구매_프로그램명"]) ?? "상품명 미확인",
    amount: Number(r["결제금액"]) || 0,
    channel: str(r["유입채널"]) ?? "미확인",
    route: str(r["구매_유입경로"]) ?? "",
    campaign: str(r["구매_캠페인"]),
    sitePath: str(r["사이트내_경로"]) ?? "세션 경로 없음",
    lastPage: str(r["결제직전_페이지"]),
  };
}

function groupBy(items: Purchase[], key: (p: Purchase) => string | null): Group[] {
  const map = new Map<string, Group>();
  for (const p of items) {
    const label = key(p);
    if (!label) continue;
    const g = map.get(label) ?? { label, count: 0, free: 0, amount: 0 };
    g.count += 1;
    if (p.amount === 0) g.free += 1;
    g.amount += p.amount;
    map.set(label, g);
  }
  return [...map.values()].sort((a, b) => b.count - a.count || b.amount - a.amount);
}

export async function fetchConversionDashboard(): Promise<ConversionDashboard> {
  try {
    const { rows, retrievedAt } = await fetchRedashResult(INFLOW_QUERY);
    const purchases = rows
      .map(toPurchase)
      .filter((p): p is Purchase => p !== null)
      .sort((a, b) => b.at.localeCompare(a.at));

    const byChannel = groupBy(purchases, (p) => p.channel);
    const bySitePath = groupBy(purchases, (p) => p.sitePath).sort(
      (a, b) => SITE_PATH_ORDER.indexOf(a.label) - SITE_PATH_ORDER.indexOf(b.label),
    );

    const channels = byChannel.map((g) => g.label);
    const paths = bySitePath.map((g) => g.label);
    const counts: Record<string, Record<string, number>> = {};
    for (const p of purchases) {
      counts[p.channel] ??= {};
      counts[p.channel][p.sitePath] = (counts[p.channel][p.sitePath] ?? 0) + 1;
    }

    return {
      ok: true,
      retrievedAt,
      from: purchases.at(-1)?.at.slice(0, 10) ?? null,
      to: purchases[0]?.at.slice(0, 10) ?? null,
      total: purchases.length,
      free: purchases.filter((p) => p.amount === 0).length,
      amount: purchases.reduce((n, p) => n + p.amount, 0),
      byChannel,
      bySitePath,
      byProgram: groupBy(purchases, (p) => p.program),
      // (organic)·(not set)·(direct) 같은 GA 기본값은 캠페인이 아니므로 뺀다.
      byCampaign: groupBy(purchases, (p) => (p.campaign && !/^\(.*\)$/.test(p.campaign) ? p.campaign : null)),
      matrix: { channels, paths, counts },
      recent: purchases.slice(0, RECENT_LIMIT),
    };
  } catch (error) {
    console.error("Redash 결제 유입경로 조회 실패", error);
    return { ok: false, message: error instanceof Error ? error.message : "Redash 에 연결하지 못했습니다." };
  }
}
