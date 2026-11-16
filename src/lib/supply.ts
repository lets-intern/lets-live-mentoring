import "server-only";
import { fetchMentors, type Mentor } from "./lets-operation";
import { BOOKINGS_QUERY, fetchRedashResult, type RedashRow } from "./redash";
import { fetchSlots, nowKst, type Slot } from "./slots";

/**
 * 공급 관리 대시보드 지표.
 *
 * 지금 데이터의 한계 (기획 문서 '데이터 출처 현황' 참고):
 * - 쿼리 446 은 오늘 이후 슬롯만 담는다. 그래서 활성 멘토·소진율은 "아직 남은 슬롯" 기준이다.
 * - 쿼리 348 은 신청 단위 예약만 있고 멘토링 진행 시각이 없다. 집중도만 여기서 낸다.
 * - 검색 실패율은 상세 페이지 방문 로그가 없어 계산하지 않는다.
 */

const ACTIVE_WINDOW_DAYS = 14;
const BOOKABLE_AFTER_HOURS = 24;
const TOP_SHARE = 0.2;
const CHALLENGE = "챌린지 피드백";
const UNKNOWN_JOB = "직무 미확인";

export const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"] as const;

export type MentorSupply = {
  name: string;
  nickname: string | null;
  jobRole: string | null;
  /** 30분 슬롯 단위 */
  openSlots: number;
  bookedSlots: number;
  /** 지금부터 24시간 이후 시작하는 예약 가능 슬롯 */
  bookableSlots: number;
  /** 348 기준 누적 예약(신청) 건수 */
  bookings: number;
  /** 최근 14일 안에 등록한 슬롯이 남아 있는지 */
  active: boolean;
};

export type HeatCell = { weekday: string; hour: number; open: number; booked: number };

export type Section<T> = { ok: true; data: T } | { ok: false; message: string };

export type SupplyDashboard = {
  now: string;
  slots: Section<{
    retrievedAt: string;
    activeMentors: number;
    mentorsWithSlots: number;
    openSlots: number;
    bookedSlots: number;
    zeroBookableMentors: number;
    heatmap: HeatCell[];
    hours: number[];
    byJob: { jobRole: string; openSlots: number; bookedSlots: number; mentors: number }[];
  }>;
  bookings: Section<{
    retrievedAt: string;
    total: number;
    mentors: number;
    topCount: number;
    topBookings: number;
    from: string | null;
    to: string | null;
  }>;
  registeredMentors: Section<number>;
  mentors: MentorSupply[];
};

const errorMessage = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

/** "YYYY-MM-DD HH:mm" (KST) 에 시간을 더한다. 문자열 비교로 쓰려고 같은 모양으로 돌려준다. */
function shiftKst(kst: string, hours: number): string {
  const d = new Date(`${kst.replace(" ", "T")}:00+09:00`);
  d.setTime(d.getTime() + hours * 3_600_000);
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

type BookingRow = { mentorName: string; at: string | null };

/** 348 결과에서 집계에 필요한 두 값만 남긴다. 연락처·이메일 등은 여기서 버린다. */
function toBookings(rows: RedashRow[]): BookingRow[] {
  return rows
    .filter((r) => !String(r["프로그램명"] ?? "").includes("테스트"))
    .map((r) => ({ mentorName: String(r["멘토명"] ?? ""), at: r["신청일시"] ? String(r["신청일시"]) : null }))
    .filter((r) => r.mentorName);
}

export async function fetchSupplyDashboard(): Promise<SupplyDashboard> {
  const [slotsResult, bookingsResult, mentorsResult] = await Promise.all([
    fetchSlots(),
    fetchRedashResult(BOOKINGS_QUERY).then(
      (r) => ({ ok: true as const, rows: toBookings(r.rows), retrievedAt: r.retrievedAt }),
      (e) => {
        console.error("Redash 예약 조회 실패", e);
        return { ok: false as const, message: errorMessage(e, "Redash 에 연결하지 못했습니다.") };
      },
    ),
    fetchMentors(),
  ]);

  const mentorByName = new Map<string, Mentor>();
  if (mentorsResult.ok) for (const m of mentorsResult.mentors) mentorByName.set(m.realName, m);
  const jobOf = (name: string) => mentorByName.get(name)?.jobRole ?? null;

  const rows = new Map<string, MentorSupply>();
  const row = (name: string, nickname: string | null = null) => {
    let r = rows.get(name);
    if (!r) {
      r = { name, nickname, jobRole: jobOf(name), openSlots: 0, bookedSlots: 0, bookableSlots: 0, bookings: 0, active: false };
      rows.set(name, r);
    }
    if (!r.nickname && nickname) r.nickname = nickname;
    return r;
  };

  // --- 슬롯 (446) ---
  let slots: SupplyDashboard["slots"];
  const now = slotsResult.ok ? slotsResult.now : nowKst();
  if (slotsResult.ok) {
    // 챌린지 피드백도 같은 슬롯 테이블을 쓰지만 1:1 멘토링 공급이 아니므로 뺀다.
    const live: Slot[] = slotsResult.slots.filter((s) => s.kind !== CHALLENGE);
    const bookableFrom = shiftKst(now, BOOKABLE_AFTER_HOURS);
    const activeFrom = shiftKst(now, -24 * ACTIVE_WINDOW_DAYS);

    const heat = new Map<string, HeatCell>();
    const jobs = new Map<string, { openSlots: number; bookedSlots: number; mentors: Set<string> }>();
    for (const s of live) {
      const r = row(s.mentorName, s.mentorNickname);
      r.openSlots += s.slotCount;
      if (s.booked) r.bookedSlots += s.slotCount;
      else if (`${s.date} ${s.start}` >= bookableFrom) r.bookableSlots += s.slotCount;
      if (s.createdAt && s.createdAt >= activeFrom) r.active = true;

      const hour = Number(s.start.slice(0, 2));
      const key = `${s.weekday}|${hour}`;
      const cell = heat.get(key) ?? { weekday: s.weekday, hour, open: 0, booked: 0 };
      cell.open += s.slotCount;
      if (s.booked) cell.booked += s.slotCount;
      heat.set(key, cell);

      const job = r.jobRole ?? UNKNOWN_JOB;
      const j = jobs.get(job) ?? { openSlots: 0, bookedSlots: 0, mentors: new Set<string>() };
      j.openSlots += s.slotCount;
      if (s.booked) j.bookedSlots += s.slotCount;
      j.mentors.add(s.mentorName);
      jobs.set(job, j);
    }

    const withSlots = [...rows.values()];
    const hourList = [...heat.values()].map((c) => c.hour);
    const minHour = hourList.length ? Math.min(...hourList) : 9;
    const maxHour = hourList.length ? Math.max(...hourList) : 22;
    slots = {
      ok: true,
      data: {
        retrievedAt: slotsResult.retrievedAt,
        activeMentors: withSlots.filter((r) => r.active).length,
        mentorsWithSlots: withSlots.length,
        openSlots: withSlots.reduce((n, r) => n + r.openSlots, 0),
        bookedSlots: withSlots.reduce((n, r) => n + r.bookedSlots, 0),
        zeroBookableMentors: withSlots.filter((r) => r.bookableSlots === 0).length,
        heatmap: [...heat.values()],
        hours: Array.from({ length: maxHour - minHour + 1 }, (_, i) => minHour + i),
        byJob: [...jobs.entries()]
          .map(([jobRole, j]) => ({ jobRole, openSlots: j.openSlots, bookedSlots: j.bookedSlots, mentors: j.mentors.size }))
          .sort((a, b) => b.openSlots - a.openSlots),
      },
    };
  } else {
    slots = { ok: false, message: slotsResult.message };
  }

  // --- 예약 (348) ---
  let bookings: SupplyDashboard["bookings"];
  if (bookingsResult.ok) {
    for (const b of bookingsResult.rows) row(b.mentorName).bookings += 1;
    const counts = [...rows.values()].map((r) => r.bookings).filter((n) => n > 0).sort((a, b) => b - a);
    const total = counts.reduce((n, c) => n + c, 0);
    const topCount = Math.ceil(counts.length * TOP_SHARE);
    const dates = bookingsResult.rows.map((b) => b.at).filter((d): d is string => !!d).sort();
    bookings = {
      ok: true,
      data: {
        retrievedAt: bookingsResult.retrievedAt,
        total,
        mentors: counts.length,
        topCount,
        topBookings: counts.slice(0, topCount).reduce((n, c) => n + c, 0),
        from: dates[0]?.slice(0, 10) ?? null,
        to: dates.at(-1)?.slice(0, 10) ?? null,
      },
    };
  } else {
    bookings = { ok: false, message: bookingsResult.message };
  }

  return {
    now,
    slots,
    bookings,
    registeredMentors: mentorsResult.ok
      ? { ok: true, data: mentorsResult.mentors.filter((m) => m.active).length }
      : { ok: false, message: mentorsResult.message },
    mentors: [...rows.values()].sort((a, b) => b.bookings - a.bookings || b.openSlots - a.openSlots),
  };
}
