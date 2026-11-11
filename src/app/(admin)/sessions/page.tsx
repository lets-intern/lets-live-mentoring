import { Badge, PageHeader, Table } from "@/components/ui";
import { sessions } from "@/lib/mock-data";

export default function SessionsPage() {
  return (
    <>
      <PageHeader title="멘토링 세션" description="예약된 세션과 진행 이력을 관리합니다." />
      <Table
        headers={["ID", "일시", "멘토", "멘티", "주제", "상태"]}
        rows={sessions.map((s) => [s.id, s.date, s.mentor, s.mentee, s.topic, <Badge key={s.id} label={s.status} />])}
      />
    </>
  );
}
