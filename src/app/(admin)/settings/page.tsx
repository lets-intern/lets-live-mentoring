import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { getMatchingSettings } from "@/lib/matching/data";
import { ROLE_GROUPS } from "@/lib/matching/text";
import { ErrorBox } from "../marketing/promotions/shared";
import { MatchingSettingsForm } from "./matching-settings-form";

export const metadata: Metadata = { title: "설정" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const result = await getMatchingSettings();

  return (
    <>
      <PageHeader title="설정" description="어드민 운영 설정을 관리합니다." />

      <div className="flex max-w-3xl flex-col gap-6">
        <section className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">공고&멘토 매칭 추천 점수</h2>
            <p className="mt-1 text-sm text-zinc-500">
              진행 중 프로모션의 소개 멘토마다 공고의 회사·직무와 비교해 점수를 더하고, 높은 순으로 추천합니다.
              0점으로 두면 그 항목은 반영하지 않습니다.
            </p>
          </div>
          {result.ok ? (
            <MatchingSettingsForm settings={result.data} />
          ) : (
            <ErrorBox title="추천 점수 설정을 불러오지 못했습니다." message={result.message} />
          )}
        </section>

        <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-5">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">직무 동의어</h2>
            <p className="mt-1 text-sm text-zinc-500">
              아래 묶음 안의 표현은 같은 직무로 보고 점수를 줍니다. 묶음 추가·수정은 개발팀에 요청해 주세요.
            </p>
          </div>
          <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
            {ROLE_GROUPS.map((g) => (
              <div key={g.label} className="contents">
                <dt className="font-medium text-zinc-800">{g.label}</dt>
                <dd className="text-zinc-500">{g.aliases.join(", ")}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-base font-semibold text-zinc-900">로그인 비밀번호</h2>
          <p className="mt-1 text-sm text-zinc-500">서버 환경변수 ADMIN_PASSWORD로 관리됩니다.</p>
        </section>
      </div>
    </>
  );
}
