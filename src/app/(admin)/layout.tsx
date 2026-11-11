import AdminShell from "@/components/admin-shell";
import { logout } from "@/app/login/actions";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell logoutAction={logout}>{children}</AdminShell>;
}
