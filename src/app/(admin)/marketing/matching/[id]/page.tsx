import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { getMatching, getMatchingSettings, loadCandidatePool } from "@/lib/matching/data";
import { ErrorBox } from "../../promotions/shared";
import { formatDateTime, PoolNotice } from "../shared";
import { SavedBanner } from "./saved-banner";
import { MatchingWorkbench } from "../workbench";

export const metadata: Metadata = { title: "매칭 결과" };
export const dynamic = "force-dynamic";

export default async function MatchingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const [{ id }, { saved }] = await Promise.all([params, searchParams]);
  const [matching, pool, settings] = await Promise.all([getMatching(id), loadCandidatePool(), getMatchingSettings()]);

  if (!matching.ok) {
    return (
      <>
        <PageHeader title="매칭 결과" />
        <ErrorBox title="매칭을 불러오지 못했습니다." message={matching.message} />
      </>
    );
  }
  if (!matching.data) notFound();
  const m = matching.data;

  return (
    <>
      <PageHeader
        title="매칭 결과"
        description={`${formatDateTime(m.createdAt)} 작성 · ${formatDateTime(m.updatedAt)} 마지막 저장 · 공고 ${m.postings.length}건`}
      />
      <div className="flex flex-col gap-4">
        {saved && <SavedBanner />}
        {!pool.ok ? (
          <ErrorBox title="추천 후보를 불러오지 못했습니다." message={pool.message} />
        ) : !settings.ok ? (
          <ErrorBox title="추천 점수 설정을 불러오지 못했습니다." message={settings.message} />
        ) : (
          <>
            <PoolNotice pool={pool.data} />
            <MatchingWorkbench
              key={m.updatedAt}
              candidates={pool.data.candidates}
              settings={settings.data}
              knownCompanies={pool.data.knownCompanies}
              initial={m}
            />
          </>
        )}
      </div>
    </>
  );
}
