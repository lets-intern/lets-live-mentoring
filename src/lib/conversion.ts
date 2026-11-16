import "server-only";
import { fetchRedashResult, INFLOW_QUERY, JOURNEY_QUERY, type RedashRow } from "./redash";

/**
 * 전환 관리 대시보드: 1:1 LIVE 멘토링 결제 유입경로 (Redash 쿼리 479, GA4)
 * + 결제자의 결제 전 30일 사이트 탐색 (Redash 쿼리 480, GA4).
 * GA 기준이라 광고 차단 등으로 실제 결제보다 적게 잡힐 수 있다. 결제 한 건이 한 줄이다.
 * 480 은 479 와 결제 판별이 같아 주문번호로 합치고, 479 에 있는 결제만 쓴다(내부 유입 제외 기준을 맞춘다).
 */

/** 결제 한 건의 결제 전 탐색 (480) */
export type Journey = {
  type: string;
  hoursToPurchase: number | null;
  sessions: number;
  visitDays: number;
  pageViews: number;
  detailViews: number;
  distinctDetails: number;
  checkoutSessions: number;
  visitedCatalog: boolean;
  visitedBigfirm: boolean;
  visitedCoupon: boolean;
  visitedOtherPrograms: boolean;
  path: string | null;
};

export type Purchase = {
  orderId: string | null;
  at: string;
  program: string;
  amount: number;
  channel: string;
  route: string;
  campaign: string | null;
  sitePath: string;
  lastPage: string | null;
  journey: Journey | null;
};

/** count 는 0원 결제를 포함한 전체 건수, free 는 그중 0원 결제 건수. */
export type Group = { label: string; count: number; free: number; amount: number };

/** 유료 / 0원 결제자 묶음별 결제 전 탐색 요약 */
export type JourneySegment = {
  label: "유료" | "0원";
  /** 탐색 기록이 있는 결제 수 */
  n: number;
  types: { label: string; count: number }[];
  median: {
    daysToPurchase: number | null;
    sessions: number | null;
    visitDays: number | null;
    pageViews: number | null;
    detailViews: number | null;
    distinctDetails: number | null;
  };
  /** 결제 페이지에 2개 이상 세션에서 들어간 결제 수 (이탈 후 복귀) */
  checkoutRetry: number;
  visited: { catalog: number; bigfirm: number; coupon: number; otherPrograms: number };
};

/** 결제 직전 단계 흐름 (GA4 경로 탐색처럼 -3 → -2 → -1 → 결제). columns[i] 는 i 번째 열의 노드. */
export type FlowData = {
  total: number;
  columns: { label: string; count: number }[][];
  links: { col: number; from: string; to: string; count: number }[];
};

export type FlowSegment = "all" | "paid" | "free";

export type JourneySummary =
  | {
      ok: true;
      retrievedAt: string;
      segments: JourneySegment[];
      flows: Record<FlowSegment, FlowData>;
    }
  | { ok: false; message: string };

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
      journey: JourneySummary;
      recent: Purchase[];
    }
  | { ok: false; message: string };

const RECENT_LIMIT = 20;
const SITE_PATH_ORDER = ["멘토링 목록 경유", "대기업 멘토관 경유", "상세 직접 진입", "세션 경로 없음"];
const JOURNEY_TYPE_ORDER = ["첫 방문에 결제", "당일 재방문 후 결제", "여러 날 재방문 후 결제", "탐색 기록 없음"];
const FLOW_STEPS = 3;
/** 한 열에 보여줄 노드 수. 나머지는 '그 외' 로 묶는다. */
const FLOW_TOP_NODES = 7;
const CHECKOUT = "결제";
const PURCHASE = "결제 완료";

const str = (v: RedashRow[string]) => (v === null || v === undefined || v === "" ? null : String(v));
const num = (v: RedashRow[string]) => (v === null || v === undefined || v === "" ? null : Number(v));
const bool = (v: RedashRow[string] | boolean) => v === true || v === "true" || v === 1;

function toPurchase(r: RedashRow): Purchase | null {
  const at = str(r["결제_일시"]);
  if (!at) return null;
  return {
    orderId: str(r["주문번호"]),
    at,
    program: str(r["구매_프로그램명"]) ?? "상품명 미확인",
    amount: Number(r["결제금액"]) || 0,
    channel: str(r["유입채널"]) ?? "미확인",
    route: str(r["구매_유입경로"]) ?? "",
    campaign: str(r["구매_캠페인"]),
    sitePath: str(r["사이트내_경로"]) ?? "세션 경로 없음",
    lastPage: str(r["결제직전_페이지"]),
    journey: null,
  };
}

function toJourney(r: RedashRow): Journey {
  return {
    type: str(r["결제_유형"]) ?? "탐색 기록 없음",
    hoursToPurchase: num(r["결제까지_시간"]),
    sessions: num(r["방문_세션수"]) ?? 0,
    visitDays: num(r["방문_일수"]) ?? 0,
    pageViews: num(r["페이지뷰"]) ?? 0,
    detailViews: num(r["멘토링상세_조회수"]) ?? 0,
    distinctDetails: num(r["본_멘토링상세_수"]) ?? 0,
    checkoutSessions: num(r["결제페이지_진입_세션수"]) ?? 0,
    visitedCatalog: bool(r["멘토링목록_방문"]),
    visitedBigfirm: bool(r["대기업멘토관_방문"]),
    visitedCoupon: bool(r["쿠폰_방문"]),
    visitedOtherPrograms: bool(r["다른프로그램_방문"]),
    path: str(r["탐색_경로"]),
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

function median(values: (number | null)[]): number | null {
  const v = values.filter((x): x is number => x !== null && Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

function summarizeSegment(label: JourneySegment["label"], items: Purchase[]): JourneySegment {
  const js = items.map((p) => p.journey).filter((j): j is Journey => j !== null && j.sessions > 0);
  const typeCounts = new Map<string, number>();
  for (const p of items) {
    const t = p.journey?.type ?? "탐색 기록 없음";
    typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);
  }
  return {
    label,
    n: js.length,
    types: [...typeCounts.entries()]
      .map(([t, count]) => ({ label: t, count }))
      .sort((a, b) => JOURNEY_TYPE_ORDER.indexOf(a.label) - JOURNEY_TYPE_ORDER.indexOf(b.label)),
    median: {
      daysToPurchase: median(js.map((j) => (j.hoursToPurchase === null ? null : j.hoursToPurchase / 24))),
      sessions: median(js.map((j) => j.sessions)),
      visitDays: median(js.map((j) => j.visitDays)),
      pageViews: median(js.map((j) => j.pageViews)),
      detailViews: median(js.map((j) => j.detailViews)),
      distinctDetails: median(js.map((j) => j.distinctDetails)),
    },
    checkoutRetry: js.filter((j) => j.checkoutSessions >= 2).length,
    visited: {
      catalog: js.filter((j) => j.visitedCatalog).length,
      bigfirm: js.filter((j) => j.visitedBigfirm).length,
      coupon: js.filter((j) => j.visitedCoupon).length,
      otherPrograms: js.filter((j) => j.visitedOtherPrograms).length,
    },
  };
}

/**
 * 탐색 경로(같은 페이지 연속은 이미 하나로 줄여 둠)에서 결제 직전 N단계를 뽑는다.
 * 끝에 붙은 결제(주문) 페이지는 거의 모든 경로에 있어 단계에서 빼고, 마지막 열을 '결제 완료' 하나로 둔다.
 * 단계가 모자라면 앞쪽을 null 로 채운다(그 열에 노드가 없다).
 */
function lastSteps(path: string | null): (string | null)[] {
  const steps = path ? path.split(" → ") : [];
  while (steps.at(-1) === CHECKOUT) steps.pop();
  const tail = steps.slice(-FLOW_STEPS);
  return [...Array<null>(FLOW_STEPS - tail.length).fill(null), ...tail, PURCHASE];
}

function buildFlow(paths: (string | null)[][]): FlowData {
  const cols = FLOW_STEPS + 1;
  // 열마다 상위 노드만 남기고 나머지는 '그 외'
  const keep = Array.from({ length: cols }, (_, c) => {
    const counts = new Map<string, number>();
    for (const p of paths) if (p[c]) counts.set(p[c]!, (counts.get(p[c]!) ?? 0) + 1);
    return new Set([...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, FLOW_TOP_NODES).map(([l]) => l));
  });
  const mapped = paths.map((p) => p.map((l, c) => (l === null ? null : keep[c].has(l) ? l : "그 외")));

  const columns = Array.from({ length: cols }, (_, c) => {
    const counts = new Map<string, number>();
    for (const p of mapped) if (p[c]) counts.set(p[c]!, (counts.get(p[c]!) ?? 0) + 1);
    return [...counts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => (a.label === "그 외" ? 1 : b.label === "그 외" ? -1 : b.count - a.count));
  });

  const linkCounts = new Map<string, { col: number; from: string; to: string; count: number }>();
  for (const p of mapped) {
    for (let c = 0; c < cols - 1; c++) {
      const from = p[c];
      const to = p[c + 1];
      if (!from || !to) continue;
      const key = `${c}|${from}|${to}`;
      const l = linkCounts.get(key) ?? { col: c, from, to, count: 0 };
      l.count += 1;
      linkCounts.set(key, l);
    }
  }
  return { total: paths.length, columns, links: [...linkCounts.values()] };
}

async function attachJourneys(purchases: Purchase[]): Promise<JourneySummary> {
  try {
    const { rows, retrievedAt } = await fetchRedashResult(JOURNEY_QUERY);
    const byOrder = new Map<string, Journey>();
    for (const r of rows) {
      const id = str(r["주문번호"]);
      if (id) byOrder.set(id, toJourney(r));
    }
    for (const p of purchases) p.journey = p.orderId ? (byOrder.get(p.orderId) ?? null) : null;

    const withPath = purchases.filter((p) => p.journey?.path);
    const flowOf = (items: Purchase[]) => buildFlow(items.map((p) => lastSteps(p.journey?.path ?? null)));

    return {
      ok: true,
      retrievedAt,
      segments: [
        summarizeSegment("유료", purchases.filter((p) => p.amount > 0)),
        summarizeSegment("0원", purchases.filter((p) => p.amount === 0)),
      ],
      flows: {
        all: flowOf(withPath),
        paid: flowOf(withPath.filter((p) => p.amount > 0)),
        free: flowOf(withPath.filter((p) => p.amount === 0)),
      },
    };
  } catch (error) {
    console.error("Redash 결제 전 탐색 조회 실패", error);
    return { ok: false, message: error instanceof Error ? error.message : "Redash 에 연결하지 못했습니다." };
  }
}

export async function fetchConversionDashboard(): Promise<ConversionDashboard> {
  try {
    const { rows, retrievedAt } = await fetchRedashResult(INFLOW_QUERY);
    const purchases = rows
      .map(toPurchase)
      .filter((p): p is Purchase => p !== null)
      .sort((a, b) => b.at.localeCompare(a.at));
    const journey = await attachJourneys(purchases);

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
      journey,
      recent: purchases.slice(0, RECENT_LIMIT),
    };
  } catch (error) {
    console.error("Redash 결제 유입경로 조회 실패", error);
    return { ok: false, message: error instanceof Error ? error.message : "Redash 에 연결하지 못했습니다." };
  }
}
