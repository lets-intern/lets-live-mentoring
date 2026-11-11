import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// 어드민 로그인은 자체 쿠키 방식이라 Supabase Auth 를 쓰지 않는다.
// 서버에서만 service role 키로 접근하고, 테이블은 RLS 로 외부 접근을 막아 둔다.
let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

export const SUPABASE_NOT_CONFIGURED =
  "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않았습니다.";
