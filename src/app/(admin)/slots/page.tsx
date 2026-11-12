import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { fetchSlots } from "@/lib/slots";
import { SlotsBoard } from "./slots-board";

export const metadata: Metadata = { title: "슬롯 오픈" };

// Redash 결과가 갱신되면 바로 보이도록 매 요청마다 가져온다.
export const dynamic = "force-dynamic";

const formatRetrievedAt = (iso: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));

export default async function SlotsPage() {
  const result = await fetchSlots();

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="슬롯 오픈"
          description="멘토가 연 1:1 멘토링 슬롯과 예약 현황을 읽기 전용으로 보여줍니다."
        />
        {result.ok && (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-500">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Redash 기준 {formatRetrievedAt(result.retrievedAt)} 갱신 · 읽기 전용
          </span>
        )}
      </div>

      {result.ok ? (
        <SlotsBoard slots={result.slots} now={result.now} />
      ) : (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          <p className="font-medium">슬롯 현황을 불러오지 못했습니다.</p>
          <p className="mt-1">{result.message}</p>
        </div>
      )}
    </>
  );
}
