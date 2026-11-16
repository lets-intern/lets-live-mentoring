import type { Metadata } from "next";
import Link from "next/link";
import { BarList, formatTime, Kpi, LoadError, pct, Section, won } from "@/components/dashboard";
import { StepFlow } from "@/components/step-flow";
import { Card, PageHeader } from "@/components/ui";
import {
  fetchConversionDashboard,
  type FlowSegment,
  type Group,
  type JourneySegment,
  type JourneySummary,
  type Purchase,
} from "@/lib/conversion";

export const metadata: Metadata = { title: "전환 관리" };

// Redash 결과가 갱신되면 바로 보이도록 매 요청마다 가져온다.
export const dynamic = "force-dynamic";

const TOP_CAMPAIGNS = 10;

export default async function ConversionDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ flow?: string }>;
}) {
  const { flow: flowParam } = await searchParams;
  const flow: FlowSegment = flowParam === "paid" || flowParam === "free" ? flowParam : "all";
  const d = await fetchConversionDashboard();

  return (
    <>
      <PageHeader title="전환 관리" description="1:1 LIVE 멘토링 결제가 어디서 들어와 어떤 경로로 결제됐는지 봅니다. 읽기 전용." />

      {!d.ok ? (
        <LoadError title="결제 유입경로를 불러오지 못했습니다." message={d.message} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi
              label="결제 건수"
              value={`${d.total}건`}
              sub={`유료 ${d.total - d.free}건 · 0원 ${d.free}건`}
              basis={`${d.from ?? "?"} ~ ${d.to ?? "?"}, GA4 purchase 기준. 광고 차단 등으로 실제보다 적게 잡힐 수 있습니다`}
            />
            <Kpi
              label="결제 금액"
              value={won(d.amount)}
              sub={d.total > d.free ? `유료 결제 건당 평균 ${won(d.amount / (d.total - d.free))}` : undefined}
              basis="GA4 purchase_revenue 합계. 0원 결제(쿠폰 전액 할인 등)는 평균에서 뺍니다"
            />
            <TopShareKpi label="1위 유입채널" groups={d.byChannel} total={d.total} basis="구매 직전 non-direct 유입 → 구매 세션 유입 순으로 귀속" />
            <TopShareKpi label="1위 사이트 내 경로" groups={d.bySitePath} total={d.total} basis="구매 세션 안에서 결제 전에 거친 페이지 기준" />
          </div>

          <p className="mt-3 text-xs text-zinc-500">
            출처: Redash 479 ({formatTime(d.retrievedAt)} 갱신, 3시간마다) · GA4 BigQuery
          </p>

          <div className="mt-8 grid gap-6 xl:grid-cols-2">
            <Section title="유입채널별 결제" description="건수 기준 막대(0원 결제 포함), 오른쪽은 금액과 0원 결제 건수." flush>
              <Card>
                <BarList highlight={1} rows={groupRows(d.byChannel, d.total)} />
              </Card>
            </Section>
            <Section title="사이트 내 경로별 결제" description="결제 전에 목록·대기업 멘토관을 거쳤는지, 상세로 바로 들어왔는지." flush>
              <Card>
                <BarList highlight={1} labelWidth="9rem" rows={groupRows(d.bySitePath, d.total)} />
              </Card>
            </Section>
          </div>

          <Section title="유입채널 × 사이트 내 경로" description="채널마다 결제까지 어떤 경로를 탔는지 건수로 봅니다.">
            <Matrix {...d.matrix} />
          </Section>

          <div className="mt-8 grid gap-6 xl:grid-cols-2">
            <Section title="프로그램별 결제" description="건수 기준(0원 결제 포함), 오른쪽은 금액과 0원 결제 건수." flush>
              <Card>
                <BarList labelWidth="12rem" rows={groupRows(d.byProgram, d.total)} />
              </Card>
            </Section>
            <Section title={`캠페인별 결제 (상위 ${TOP_CAMPAIGNS})`} description="UTM 캠페인이 잡힌 결제만." flush>
              <Card>
                <BarList labelWidth="12rem" rows={groupRows(d.byCampaign.slice(0, TOP_CAMPAIGNS), d.total)} />
              </Card>
            </Section>
          </div>

          <JourneySection journey={d.journey} flow={flow} />

          <Section title="최근 결제" description={`최근 ${d.recent.length}건. 결제자 정보는 표시하지 않습니다.`}>
            <RecentTable rows={d.recent} />
          </Section>
        </>
      )}
    </>
  );
}

const groupRows = (groups: Group[], total: number) =>
  groups.map((g) => ({
    label: g.label,
    value: g.count,
    display: `${g.count}건 · ${pct(g.count, total)}`,
    sub: g.free === g.count ? "전부 0원" : g.free ? `${won(g.amount)} · 0원 ${g.free}건` : won(g.amount),
  }));

function TopShareKpi({ label, groups, total, basis }: { label: string; groups: Group[]; total: number; basis: string }) {
  const top = groups[0];
  return (
    <Kpi
      label={label}
      value={top ? top.label : null}
      sub={top ? `${top.count}건 · ${pct(top.count, total)}` : undefined}
      basis={basis}
    />
  );
}

function Matrix({ channels, paths, counts }: { channels: string[]; paths: string[]; counts: Record<string, Record<string, number>> }) {
  const max = Math.max(1, ...channels.flatMap((c) => paths.map((p) => counts[c]?.[p] ?? 0)));
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white p-4">
      <table className="w-full border-separate border-spacing-1 text-center text-sm">
        <thead>
          <tr>
            <th />
            {paths.map((p) => (
              <th key={p} className="whitespace-nowrap px-2 pb-1 text-xs font-medium text-zinc-500">
                {p}
              </th>
            ))}
            <th className="px-2 pb-1 text-xs font-medium text-zinc-500">합계</th>
          </tr>
        </thead>
        <tbody>
          {channels.map((c) => {
            const rowTotal = paths.reduce((n, p) => n + (counts[c]?.[p] ?? 0), 0);
            return (
              <tr key={c}>
                <th className="whitespace-nowrap pr-2 text-left text-sm font-medium text-zinc-700">{c}</th>
                {paths.map((p) => {
                  const n = counts[c]?.[p] ?? 0;
                  return (
                    <td
                      key={p}
                      className={`h-9 min-w-20 rounded tabular-nums ${n === 0 ? "bg-zinc-50 text-zinc-300" : n / max > 0.5 ? "text-white" : "text-zinc-800"}`}
                      style={n ? { backgroundColor: `rgba(24, 24, 27, ${0.12 + (n / max) * 0.78})` } : undefined}
                    >
                      {n || "·"}
                    </td>
                  );
                })}
                <td className="tabular-nums font-medium text-zinc-900">{rowTotal}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RecentTable({ rows }: { rows: Purchase[] }) {
  const headers = [
    "결제 일시",
    "프로그램",
    "금액",
    "유입채널",
    "유입경로 (source / medium)",
    "캠페인",
    "사이트 내 경로",
    "결제 전 탐색",
    "결제 직전 페이지",
  ];
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-zinc-200 bg-zinc-50 text-xs text-zinc-500">
          <tr>
            {headers.map((h) => (
              <th key={h} className={`whitespace-nowrap px-4 py-3 font-medium ${h === "금액" ? "text-right" : ""}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {rows.map((p, i) => (
            <tr key={`${p.at}-${i}`} className="hover:bg-zinc-50">
              <td className="whitespace-nowrap px-4 py-3 tabular-nums text-zinc-700">{p.at.slice(0, 16)}</td>
              <td className="max-w-64 truncate px-4 py-3 text-zinc-900" title={p.program}>
                {p.program}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-zinc-700">
                {p.amount === 0 ? (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">0원</span>
                ) : (
                  won(p.amount)
                )}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-zinc-700">{p.channel}</td>
              <td className="whitespace-nowrap px-4 py-3 text-zinc-500">{p.route}</td>
              <td className="whitespace-nowrap px-4 py-3 text-zinc-500">{p.campaign ?? "—"}</td>
              <td className="whitespace-nowrap px-4 py-3 text-zinc-700">{p.sitePath}</td>
              <td className="whitespace-nowrap px-4 py-3 text-zinc-700" title={p.journey?.path ?? ""}>
                {p.journey && p.journey.sessions > 0
                  ? `${p.journey.visitDays}일 · ${p.journey.sessions}세션 · 상세 ${p.journey.distinctDetails}개`
                  : "—"}
              </td>
              <td className="max-w-48 truncate px-4 py-3 text-zinc-500" title={p.lastPage ?? ""}>
                {p.lastPage ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const fmt = (v: number | null, unit: string, digits = 0) =>
  v === null ? "—" : `${v.toLocaleString("ko-KR", { maximumFractionDigits: digits })}${unit}`;

const share = (count: number, n: number) => `${count}건 (${pct(count, n)})`;

const FLOW_TABS: { key: FlowSegment; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "paid", label: "유료" },
  { key: "free", label: "0원" },
];

/** 유료·0원 결제자의 결제 전 30일 탐색: 지표 비교표 + 결제 직전 단계 흐름. */
function JourneySection({ journey, flow }: { journey: JourneySummary; flow: FlowSegment }) {
  return (
    <Section
      title="결제 전 탐색 (결제자 한정)"
      description="결제 전 30일 동안 같은 기기에서 본 페이지 기준 (Redash 480). 다른 기기에서 본 탐색은 잡히지 않습니다."
    >
      {!journey.ok ? (
        <LoadError title="결제 전 탐색을 불러오지 못했습니다." message={journey.message} />
      ) : (
        <>
          <JourneyTable segments={journey.segments} />
          <Card className="mt-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-zinc-900">결제 직전 단계별 흐름</p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  결제(주문) 페이지는 단계에서 빼고 맨 오른쪽 &lsquo;결제 완료&rsquo;로 모읍니다. 같은 종류 페이지가 이어지면 한 단계로
                  셉니다. 열마다 상위 7개 외에는 &lsquo;그 외&rsquo;.
                </p>
              </div>
              <nav className="flex shrink-0 rounded-lg border border-zinc-200 p-0.5 text-sm" aria-label="결제 구분">
                {FLOW_TABS.map((t) => (
                  <Link
                    key={t.key}
                    href={t.key === "all" ? "?" : `?flow=${t.key}`}
                    scroll={false}
                    className={`rounded-md px-3 py-1 ${
                      flow === t.key ? "bg-zinc-900 font-medium text-white" : "text-zinc-600 hover:bg-zinc-100"
                    }`}
                  >
                    {t.label} {journey.flows[t.key].total}
                  </Link>
                ))}
              </nav>
            </div>
            <div className="mt-4">
              <StepFlow data={journey.flows[flow]} headers={["-3단계", "-2단계", "-1단계", "결제"]} />
            </div>
            <p className="mt-3 text-xs text-zinc-500">탐색 {formatTime(journey.retrievedAt)} 갱신</p>
          </Card>
        </>
      )}
    </Section>
  );
}

function JourneyTable({ segments }: { segments: JourneySegment[] }) {
  const rows: { label: string; value: (s: JourneySegment) => string }[] = [
    { label: "결제 수 (탐색 기록 있음)", value: (s) => `${s.n}건` },
    ...["첫 방문에 결제", "당일 재방문 후 결제", "여러 날 재방문 후 결제"].map((t) => ({
      label: t,
      value: (s: JourneySegment) => share(s.types.find((x) => x.label === t)?.count ?? 0, s.n),
    })),
    { label: "첫 탐색 → 결제 (중앙값)", value: (s) => fmt(s.median.daysToPurchase, "일", 1) },
    { label: "방문 세션 / 방문 일수 (중앙값)", value: (s) => `${fmt(s.median.sessions, "회", 1)} / ${fmt(s.median.visitDays, "일", 1)}` },
    { label: "페이지뷰 (중앙값)", value: (s) => fmt(s.median.pageViews, "", 1) },
    { label: "멘토링 상세 조회 (중앙값)", value: (s) => fmt(s.median.detailViews, "회", 1) },
    { label: "본 멘토링 상세 수 (중앙값)", value: (s) => fmt(s.median.distinctDetails, "개", 1) },
    { label: "결제 페이지 재진입 (2세션 이상)", value: (s) => share(s.checkoutRetry, s.n) },
    { label: "멘토링 목록 방문", value: (s) => share(s.visited.catalog, s.n) },
    { label: "대기업 멘토관 방문", value: (s) => share(s.visited.bigfirm, s.n) },
    { label: "쿠폰 페이지 방문", value: (s) => share(s.visited.coupon, s.n) },
    { label: "다른 프로그램 방문", value: (s) => share(s.visited.otherPrograms, s.n) },
  ];
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-zinc-200 bg-zinc-50 text-xs text-zinc-500">
          <tr>
            <th className="px-4 py-3 font-medium">지표</th>
            {segments.map((s) => (
              <th key={s.label} className="whitespace-nowrap px-4 py-3 text-right font-medium">
                {s.label} 결제자
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {rows.map((r) => (
            <tr key={r.label}>
              <td className="px-4 py-2.5 text-zinc-700">{r.label}</td>
              {segments.map((s) => (
                <td key={s.label} className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-zinc-900">
                  {r.value(s)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
