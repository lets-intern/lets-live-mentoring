// 공용 비밀번호 기반의 단순 세션.
// 쿠키 값 = "<만료시각(ms)>.<HMAC 서명>" 형태이며, Edge(middleware)에서도 동작하도록 Web Crypto만 사용한다.

export const SESSION_COOKIE = "llm_admin_session";
export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7; // 7일

const encoder = new TextEncoder();

function getSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("ADMIN_SESSION_SECRET 환경변수가 설정되지 않았습니다.");
  return secret;
}

async function hmac(value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionToken(): Promise<string> {
  const expiresAt = String(Date.now() + SESSION_MAX_AGE_SEC * 1000);
  return `${expiresAt}.${await hmac(expiresAt)}`;
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const [expiresAt, sig] = token.split(".");
  if (!expiresAt || !sig) return false;
  if (Number(expiresAt) < Date.now()) return false;
  return safeEqual(sig, await hmac(expiresAt));
}

export async function checkPassword(input: string): Promise<boolean> {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) throw new Error("ADMIN_PASSWORD 환경변수가 설정되지 않았습니다.");
  // 길이 노출을 줄이기 위해 해시끼리 비교
  return safeEqual(await hmac(input), await hmac(expected));
}
