import { Badge, PageHeader, Table } from "@/components/ui";
import { mentors } from "@/lib/mock-data";

export default function MentorsPage() {
  return (
    <>
      <PageHeader title="멘토 관리" description="멘토 정보와 활동 현황을 관리합니다." />
      <Table
        headers={["ID", "이름", "분야", "소속", "진행 세션", "평점", "상태"]}
        rows={mentors.map((m) => [
          m.id, m.name, m.field, m.company, m.sessions, m.rating.toFixed(1), <Badge key={m.id} label={m.status} />,
        ])}
      />
    </>
  );
}
