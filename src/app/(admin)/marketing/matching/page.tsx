import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { getMatchingSettings, listMatchings, loadCandidatePool, type MatchingSummary } from "@/lib/matching/data";
import { ErrorBox } from "../promotions/shared";
import { formatDateTime, PoolNotice } from "./shared";
import { MatchingWorkbench } from "./workbench";

export const metadata: Metadata = { title: "공고&멘토 매칭" };
export const dynamic = "force-dynamic";

export default async function MarketingMatchingPage() {
  const [pool, settings, history] = await Promise.all([loadCandidatePool(), getMatchingSettings(), listMatchings()]);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="공고&멘토 매칭"
          description="공고 메시지를 붙여넣으면 진행 중 프로모션의 소개 멘토 중 공고별로 어울리는 멘토를 추천합니다."
        />
        <Link href="/settings" className="shrink-0 rounded-lg px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100">
          추천 점수 설정
        </Link>
      </div>

      <div className="flex flex-col gap-8">
        {!pool.ok ? (
          <ErrorBox title="추천 후보를 불러오지 못했습니다." message={pool.message} />
        ) : !settings.ok ? (
          <ErrorBox title="추천 점수 설정을 불러오지 못했습니다." message={settings.message} />
        ) : (
          <div className="flex flex-col gap-4">
            <PoolNotice pool={pool.data} />
            <MatchingWorkbench
              candidates={pool.data.candidates}
              settings={settings.data}
              knownCompanies={pool.data.knownCompanies}
            />
          </div>
        )}

        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-zinc-900">매칭 이력</h2>
          {!history.ok ? (
            <ErrorBox title="매칭 이력을 불러오지 못했습니다." message={history.message} />
          ) : history.data.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-200 py-10 text-center text-sm text-zinc-500">
              저장된 매칭이 없습니다.
            </div>
          ) : (
            <HistoryTable matchings={history.data} />
          )}
        </section>
      </div>
    </>
  );
}

function HistoryTable({ matchings }: { matchings: MatchingSummary[] }) {
  return (
    <div className="w-0 min-w-full overflow-x-auto rounded-xl border border-zinc-200 bg-white">
      <table className="w-full min-w-[48rem] text-left text-sm">
        <thead className="border-b border-zinc-200 bg-zinc-50 text-xs text-zinc-500">
          <tr>
            {["저장 일시", "공고", "확정 멘토"].map((h) => (
              <th key={h} className="whitespace-nowrap px-4 py-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 text-zinc-700">
          {matchings.map((m) => {
            const mentors = [...new Set(m.postings.flatMap((p) => p.selectedNames))];
            return (
              <tr key={m.id} className="align-top hover:bg-zinc-50">
                <td className="whitespace-nowrap px-4 py-3">
                  <Link
                    href={`/marketing/matching/${m.id}`}
                    className="font-medium text-zinc-900 underline-offset-2 hover:underline"
                  >
                    {formatDateTime(m.updatedAt)}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span className="text-zinc-500">{m.postings.length}건 · </span>
                  {m.postings
                    .slice(0, 3)
                    .map((p) => [p.company, p.jobRole].filter(Boolean).join(" ") || p.title)
                    .join(", ")}
                  {m.postings.length > 3 && <span className="text-zinc-500"> 외 {m.postings.length - 3}건</span>}
                </td>
                <td className="px-4 py-3">{mentors.length === 0 ? "-" : mentors.join(", ")}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
