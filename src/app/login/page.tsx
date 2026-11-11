import { BRAND_NAME, LogoMark } from "@/components/logo";
import LoginForm from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm">
        <LogoMark className="h-12 w-12 -ml-1" />
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-zinc-950">{BRAND_NAME}</h1>
        <p className="mt-2 text-[15px] text-zinc-500">팀 공용 비밀번호를 입력하세요.</p>
        <LoginForm next={next ?? "/"} />
      </div>
    </main>
  );
}
