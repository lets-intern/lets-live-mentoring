import type { Metadata } from "next";
import { PageHeader, UnderConstruction } from "@/components/ui";

export const metadata: Metadata = { title: "품질 관리" };

export default function QualityDashboardPage() {
  return (
    <>
      <PageHeader title="품질 관리" description="멘토링이 약속대로 진행되고 만족스러웠는지 봅니다." />
      <UnderConstruction />
    </>
  );
}
