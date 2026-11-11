import { PageHeader, Table } from "@/components/ui";
import { mentees } from "@/lib/mock-data";

export default function MenteesPage() {
  return (
    <>
      <PageHeader title="멘티 관리" description="멘토링을 신청한 사용자 목록입니다." />
      <Table
        headers={["ID", "이름", "이메일", "가입일", "신청 세션"]}
        rows={mentees.map((m) => [m.id, m.name, m.email, m.joined, m.sessions])}
      />
    </>
  );
}
