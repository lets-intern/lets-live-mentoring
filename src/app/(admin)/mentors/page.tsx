import type { Metadata } from "next";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/ui";
import { fetchMentors, LETS_OPERATION_MENTOR_DB_URL } from "@/lib/lets-operation";
import { MentorsTable } from "./mentors-table";

export const metadata: Metadata = { title: "멘토 DB" };

// 원본(LetsOperation)에서 방금 고친 내용이 바로 보이도록 매 요청마다 가져온다.
export const dynamic = "force-dynamic";

export default async function MentorsPage() {
  const result = await fetchMentors();

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="멘토 DB"
          description="LetsOperation 멘토 DB를 읽기 전용으로 보여줍니다. 추가·수정은 LetsOperation에서 해 주세요."
        />
        <a
          href={LETS_OPERATION_MENTOR_DB_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          LetsOperation에서 추가·수정
          <Icon name="external" className="h-4 w-4" />
        </a>
      </div>

      {result.ok ? (
        <MentorsTable mentors={result.mentors} />
      ) : (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          <p className="font-medium">멘토 목록을 불러오지 못했습니다.</p>
          <p className="mt-1">{result.message}</p>
        </div>
      )}
    </>
  );
}
