import type { Metadata } from "next";
import { PageHeader, UnderConstruction } from "@/components/ui";

export const metadata: Metadata = { title: "수요 관리" };

export default function DemandDashboardPage() {
  return (
    <>
      <PageHeader title="수요 관리" description="멘티 유입과 멘토링 수요가 어디서 얼마나 생기는지 봅니다." />
      <UnderConstruction />
    </>
  );
}
