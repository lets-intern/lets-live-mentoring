// 슬롯 시각 계산. 서버·브라우저 양쪽에서 쓰는 순수 함수.
// 시각은 모두 KST "YYYY-MM-DD HH:mm" 문자열로 다루고, 문자열 비교로 앞뒤를 판단한다.

/** 예약은 슬롯 시작 24시간 전에 마감된다. */
export const BOOKING_CUTOFF_HOURS = 24;

/** KST "YYYY-MM-DD HH:mm" 에 시간을 더한다. 시간대 변환 없이 문자열 그대로 계산한다. */
export const addHours = (at: string, hours: number) =>
  new Date(Date.parse(`${at.replace(" ", "T")}:00Z`) + hours * 3_600_000).toISOString().slice(0, 16).replace("T", " ");

/** 이 시각 이후에 시작하는 빈 슬롯만 아직 예약을 받을 수 있다. */
export const bookingCutoff = (now: string) => addHours(now, BOOKING_CUTOFF_HOURS);

/** 아직 예약을 받을 수 있는 빈 슬롯인지 (마감 전) */
export const isBookable = (slot: { booked: boolean; date: string; start: string }, cutoff: string) =>
  !slot.booked && `${slot.date} ${slot.start}` > cutoff;
