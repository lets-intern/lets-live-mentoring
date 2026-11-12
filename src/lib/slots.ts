import "server-only";
import { fetchRedashResult, SLOTS_QUERY, type RedashRow } from "./redash";

/** Redash 쿼리 446 한 줄을 화면에서 쓰기 좋은 모양으로 옮긴 것. 시각은 KST 문자열 그대로 둔다. */
export type Slot = {
  mentorName: string;
  mentorNickname: string | null;
  /** "YYYY-MM-DD" */
  date: string;
  /** "HH:mm" */
  start: string;
  end: string;
  minutes: number;
  /** 합쳐진 30분 슬롯 수. 같은 멘티가 이어서 예약한 슬롯은 한 줄로 합친다. */
  slotCount: number;
  weekday: string;
  booked: boolean;
  /** 예약구분 원문 (예약가능 / 1:1 멘토링 …) */
  kind: string;
  mentee: string | null;
  program: string | null;
  createdAt: string | null;
};

export type SlotsResult =
  | { ok: true; slots: Slot[]; retrievedAt: string; now: string }
  | { ok: false; message: string };

const AVAILABLE = "예약가능";

const str = (v: RedashRow[string]) => (v === null || v === undefined || v === "" ? null : String(v));

/** 지금 KST 를 "YYYY-MM-DD HH:mm" 로. 쿼리의 `시점` 은 쿼리가 돈 시각 기준이라 직접 다시 판단한다. */
function nowKst(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

function toSlot(row: RedashRow): Slot | null {
  const startAt = str(row["슬롯시작"]);
  const endAt = str(row["슬롯종료"]);
  const mentorName = str(row["멘토명"]);
  if (!startAt || !endAt || !mentorName) return null;

  const kind = str(row["예약구분"]) ?? AVAILABLE;
  return {
    mentorName,
    mentorNickname: str(row["멘토닉네임"]),
    date: startAt.slice(0, 10),
    start: startAt.slice(11, 16),
    end: endAt.slice(11, 16),
    minutes: Number(row["길이(분)"]) || 0,
    slotCount: 1,
    weekday: str(row["요일"]) ?? "",
    booked: kind !== AVAILABLE,
    kind,
    mentee: str(row["예약멘티"]),
    program: str(row["프로그램명"]),
    createdAt: str(row["슬롯등록일시"]),
  };
}

/**
 * 쿼리는 30분 슬롯마다 한 줄을 내보낸다. 한 멘티가 이어진 슬롯 여러 개를 한 번에 예약하면
 * (예: 21:00–21:30, 21:30–22:00) 실제로는 한 번의 예약이므로 한 줄로 합친다.
 * 완전히 같은 줄이 두 번 오는 경우도 있어 함께 걸러낸다.
 */
function mergeSlots(slots: Slot[]): Slot[] {
  const groupKey = (s: Slot) =>
    s.booked
      ? [s.mentorName, s.date, s.kind, s.mentee ?? "", s.program ?? ""].join("|")
      : [s.mentorName, s.date, s.start].join("|");
  const sorted = [...slots].sort((a, b) =>
    groupKey(a) === groupKey(b) ? a.start.localeCompare(b.start) : groupKey(a).localeCompare(groupKey(b)),
  );

  const merged: Slot[] = [];
  for (const s of sorted) {
    const last = merged.at(-1);
    if (last && groupKey(last) === groupKey(s)) {
      // 이미 덮는 구간이면 중복 줄이다.
      if (s.start >= last.start && s.end <= last.end) continue;
      // 이어지는 예약이면 끝 시각을 늘린다.
      if (s.booked && s.start === last.end) {
        last.end = s.end;
        last.minutes += s.minutes;
        last.slotCount += s.slotCount;
        continue;
      }
    }
    merged.push({ ...s });
  }
  return merged;
}

export async function fetchSlots(): Promise<SlotsResult> {
  try {
    const { rows, retrievedAt } = await fetchRedashResult(SLOTS_QUERY);
    const now = nowKst();
    // 이미 끝난 슬롯은 보여주지 않는다. 이어진 예약은 합친 뒤 끝 시각으로 판단한다.
    const slots = mergeSlots(rows.map(toSlot).filter((s): s is Slot => s !== null))
      .filter((s) => `${s.date} ${s.end}` > now)
      .sort((a, b) =>
        a.date === b.date
          ? a.start === b.start
            ? a.mentorName.localeCompare(b.mentorName, "ko")
            : a.start.localeCompare(b.start)
          : a.date.localeCompare(b.date),
      );
    return { ok: true, slots, retrievedAt, now };
  } catch (error) {
    console.error("Redash 슬롯 조회 실패", error);
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Redash 에 연결하지 못했습니다.",
    };
  }
}
