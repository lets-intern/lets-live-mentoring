import type { Metadata } from "next";
import Link from "next/link";
import { Badge, PageHeader } from "@/components/ui";
import { listPromotions, promotionStatus, todayKst, type Promotion, type PromotionStatus } from "@/lib/promotions";
import { ErrorBox, formatPeriod } from "./shared";

export const metadata: Metadata = { title: "프로모션 관리" };
export const dynamic = "force-dynamic";

const STATUS_ORDER: Record<PromotionStatus, number> = { "진행 중": 0, 예정: 1, 종료: 2 };

export default async function PromotionsPage() {
  const result = await listPromotions();
  const today = todayKst();

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="프로모션 관리"
          description="프로모션 상세페이지, 기간, 컨셉과 소개 멘토(집중 판매 멘토 포함)를 관리합니다."
        />
        <Link
          href="/marketing/promotions/new"
          className="inline-flex shrink-0 items-center rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          프로모션 추가
        </Link>
      </div>

      {!result.ok ? (
        <ErrorBox title="프로모션 목록을 불러오지 못했습니다." message={result.message} />
      ) : result.data.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-200 py-16 text-center text-sm text-zinc-500">
          등록된 프로모션이 없습니다.
        </div>
      ) : (
        <PromotionTable
          promotions={result.data
            .map((p) => ({ ...p, status: promotionStatus(p, today) }))
            .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])}
        />
      )}
    </>
  );
}

function PromotionTable({ promotions }: { promotions: (Promotion & { status: PromotionStatus })[] }) {
  return (
    <div className="w-0 min-w-full overflow-x-auto rounded-xl border border-zinc-200 bg-white">
      <table className="w-full min-w-[64rem] text-left text-sm">
        <thead className="border-b border-zinc-200 bg-zinc-50 text-xs text-zinc-500">
          <tr>
            {["상태", "컨셉", "기간", "집중 판매 멘토", "소개 멘토", "상세페이지"].map((h) => (
              <th key={h} className="whitespace-nowrap px-4 py-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 text-zinc-700">
          {promotions.map((p) => {
            const focus = p.mentors.filter((m) => m.isFocus);
            const others = p.mentors.filter((m) => !m.isFocus);
            return (
              <tr key={p.id} className={`align-top hover:bg-zinc-50 ${p.status === "종료" ? "text-zinc-400" : ""}`}>
                <td className="whitespace-nowrap px-4 py-3">
                  <Badge label={p.status} />
                </td>
                <th scope="row" className="min-w-56 px-4 py-3 font-normal">
                  <Link
                    href={`/marketing/promotions/${p.id}`}
                    className="font-medium text-zinc-900 underline-offset-2 hover:underline"
                  >
                    {p.title}
                  </Link>
                  {p.description && <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{p.description}</p>}
                </th>
                <td className="whitespace-nowrap px-4 py-3">{formatPeriod(p.startsOn, p.endsOn)}</td>
                <td className="min-w-40 px-4 py-3">
                  {focus.length === 0 ? (
                    "-"
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {focus.map((m) => (
                        <span key={m.mentorId} className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                          ★ {m.mentorName}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="min-w-48 px-4 py-3">
                  {others.length === 0 ? "-" : others.map((m) => m.mentorName).join(", ")}
                </td>
                <td className="max-w-56 px-4 py-3">
                  {p.detailUrl ? (
                    <a
                      href={p.detailUrl}
                      target="_blank"
                      rel="noreferrer"
                      title={p.detailUrl}
                      className="block truncate underline underline-offset-2"
                    >
                      {p.detailUrl.replace(/^https?:\/\//, "")}
                    </a>
                  ) : (
                    "-"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
