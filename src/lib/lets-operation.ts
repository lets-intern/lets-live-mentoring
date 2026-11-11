// LetsOperation(멘토 DB 원본) 연동. 이 어드민은 읽기만 하고, 추가·수정·삭제는 원본 화면에서 한다.

const DEFAULT_BASE_URL = "https://letscareer-operation.vercel.app";

export const LETS_OPERATION_BASE_URL = (process.env.LETS_OPERATION_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
export const LETS_OPERATION_MENTOR_DB_URL = `${LETS_OPERATION_BASE_URL}/mentors/db`;

export type MentorCareer = {
  company: string | null;
  jobRole: string | null;
  jobTitle: string | null;
  years: string | null;
};

export type MentorDocumentPass = {
  company: string | null;
  jobRole: string | null;
};

/** LetsOperation domain/mentor-store.ts 의 MentorRow 와 같은 모양. */
export type Mentor = {
  mentorId: string;
  realName: string;
  activityName: string | null;
  active: boolean;
  snsLinks: string[];
  url: string | null;
  company: string | null;
  jobRole: string | null;
  desiredJobRoles: string | null;
  careers: MentorCareer[];
  documentPasses: MentorDocumentPass[];
  programs: string[];
  note: string | null;
};

export type MentorsResult = { ok: true; mentors: Mentor[] } | { ok: false; message: string };

export async function fetchMentors(): Promise<MentorsResult> {
  const token = process.env.LETS_OPERATION_API_TOKEN;
  if (!token) {
    return { ok: false, message: "LETS_OPERATION_API_TOKEN 환경변수가 설정되지 않았습니다." };
  }

  try {
    const res = await fetch(`${LETS_OPERATION_BASE_URL}/api/external/mentors`, {
      headers: { Authorization: `Bearer ${token}` },
      // 원본에서 방금 고친 내용이 바로 보여야 한다.
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    if (res.status === 401) {
      return { ok: false, message: "LetsOperation 인증에 실패했습니다. API 토큰을 확인해 주세요." };
    }
    if (!res.ok) {
      return { ok: false, message: `LetsOperation 응답 오류 (${res.status})` };
    }

    const body = (await res.json()) as { mentors?: Mentor[] };
    if (!Array.isArray(body.mentors)) {
      return { ok: false, message: "LetsOperation 응답 형식이 올바르지 않습니다." };
    }
    return { ok: true, mentors: body.mentors };
  } catch (error) {
    console.error("LetsOperation 멘토 목록 조회 실패", error);
    return { ok: false, message: "LetsOperation에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요." };
  }
}
