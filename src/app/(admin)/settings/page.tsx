import { PageHeader, UnderConstruction } from "@/components/ui";

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="설정" description="어드민 운영 설정을 관리합니다." />
      <UnderConstruction description="로그인 비밀번호는 현재 서버 환경변수 ADMIN_PASSWORD로 관리됩니다." />
    </>
  );
}
