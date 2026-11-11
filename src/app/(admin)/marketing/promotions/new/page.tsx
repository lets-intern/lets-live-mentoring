import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { loadMentorOptions } from "../mentor-options";
import { PromotionForm } from "../promotion-form";

export const metadata: Metadata = { title: "프로모션 추가" };
export const dynamic = "force-dynamic";

export default async function NewPromotionPage() {
  const { options, error } = await loadMentorOptions();

  return (
    <>
      <PageHeader title="프로모션 추가" description="새 프로모션의 컨셉, 기간, 상세페이지와 소개 멘토를 등록합니다." />
      <PromotionForm mentorOptions={options} mentorLoadError={error} />
    </>
  );
}
