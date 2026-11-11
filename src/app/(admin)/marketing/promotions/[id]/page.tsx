import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge, PageHeader } from "@/components/ui";
import { getPromotion, promotionStatus } from "@/lib/promotions";
import { loadMentorOptions } from "../mentor-options";
import { PromotionForm } from "../promotion-form";
import { ErrorBox, formatPeriod } from "../shared";

export const metadata: Metadata = { title: "프로모션 수정" };
export const dynamic = "force-dynamic";

export default async function EditPromotionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [result, mentors] = await Promise.all([getPromotion(id), loadMentorOptions()]);

  if (!result.ok) {
    return (
      <>
        <PageHeader title="프로모션 수정" />
        <ErrorBox title="프로모션을 불러오지 못했습니다." message={result.message} />
      </>
    );
  }
  if (!result.data) notFound();
  const promotion = result.data;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-2 text-sm text-zinc-500">
        <Badge label={promotionStatus(promotion)} />
        <span>{formatPeriod(promotion.startsOn, promotion.endsOn)}</span>
      </div>
      <PageHeader title="프로모션 수정" description={promotion.title} />
      <PromotionForm promotion={promotion} mentorOptions={mentors.options} mentorLoadError={mentors.error} />
    </>
  );
}
