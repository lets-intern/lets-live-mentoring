import "server-only";

/**
 * 실서비스 운영DB 는 Redash 쿼리를 통해서만 읽는다. 이 어드민은 결과를 보여주기만 한다.
 *
 * 결과 API 는 **마지막으로 실행된 결과**를 돌려준다. 부를 때마다 쿼리가 도는 게 아니라
 * Redash 쪽 Refresh Schedule 이 돌려둔 값을 받으므로, 화면에 갱신 시각을 함께 보여준다.
 */

/** 결과 한 줄. 쿼리가 한글 별칭으로 컬럼을 내보내므로 그대로 받는다. */
export type RedashRow = Record<string, string | number | null>;

export type RedashResult = {
  rows: RedashRow[];
  /** 저쪽에서 쿼리가 실제로 돌아간 시각(ISO). */
  retrievedAt: string;
};

/** API 키가 쿼리마다 따로 나오므로 ID 와 키 환경변수 이름을 짝으로 둔다. */
export type RedashQuery = { idEnv: string; keyEnv: string };

/** 쿼리 446. 멘토별 1:1 멘토링 슬롯과 예약 현황. */
export const SLOTS_QUERY: RedashQuery = {
  idEnv: "REDASH_SLOTS_QUERY_ID",
  keyEnv: "REDASH_SLOTS_API_KEY",
};

const TIMEOUT_MS = 15_000;

type RedashResponse = {
  query_result?: { retrieved_at?: string; data?: { rows?: RedashRow[] } };
};

export async function fetchRedashResult(query: RedashQuery): Promise<RedashResult> {
  const base = process.env.REDASH_BASE_URL;
  const queryId = process.env[query.idEnv];
  const key = process.env[query.keyEnv];
  if (!base || !queryId || !key) {
    throw new Error(`환경변수 REDASH_BASE_URL · ${query.idEnv} · ${query.keyEnv} 가 필요합니다.`);
  }

  const url = `${base.replace(/\/+$/, "")}/api/queries/${encodeURIComponent(queryId)}/results.json`;
  const res = await fetch(`${url}?api_key=${encodeURIComponent(key)}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`Redash 응답 오류 (${res.status})`);
  }

  const body = (await res.json()) as RedashResponse;
  const rows = body.query_result?.data?.rows;
  const retrievedAt = body.query_result?.retrieved_at;
  if (!Array.isArray(rows) || !retrievedAt) {
    throw new Error("Redash 응답에서 결과를 찾지 못했습니다.");
  }
  return { rows, retrievedAt };
}
