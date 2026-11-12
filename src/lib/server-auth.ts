import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySessionToken } from "./auth";

/** 서버 액션 진입 시 로그인 확인. middleware 를 거치지 않는 액션 호출도 막는다. */
export async function assertAuthed() {
  if (!(await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value))) {
    redirect("/login");
  }
}
