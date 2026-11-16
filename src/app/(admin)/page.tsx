import { redirect } from "next/navigation";

// 대시보드는 하위 페이지로 구성되므로 첫 하위 페이지로 보낸다
export default function DashboardPage() {
  redirect("/dashboard/supply");
}
