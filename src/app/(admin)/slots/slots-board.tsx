"use client";

import { useMemo, useState } from "react";
import type { Slot } from "@/lib/slots";

type View = "schedule" | "matrix" | "list";
type StatusFilter = "all" | "open" | "booked";

// 멘토를 한눈에 구분하기 위한 색. 이름 순서대로 돌려 쓴다.
const MENTOR_COLORS = [
  "bg-sky-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-teal-500",
  "bg-indigo-500",
  "bg-lime-600",
  "bg-fuchsia-500",
  "bg-orange-500",
  "bg-cyan-600",
];

const formatDate = (date: string, weekday: string) => {
  const [, m, d] = date.split("-");
  return `${Number(m)}월 ${Number(d)}일${weekday ? ` (${weekday})` : ""}`;
};

/** 합쳐진 예약은 여러 슬롯을 차지하므로 줄 수가 아니라 슬롯 수로 센다. */
const countSlots = (list: Slot[]) =>
  list.reduce((sum, s) => sum + s.slotCount, 0);

/** 멘토 × 날짜 칸 색. 적게 연 날은 #EEF0FF, 가장 많이 연 날은 #8288F8 로 이어진다. */
const LIGHT = [0xee, 0xf0, 0xff];
const DARK = [0x82, 0x88, 0xf8];
const cellColor = (ratio: number) =>
  `rgb(${LIGHT.map((l, i) => Math.round(l + (DARK[i] - l) * Math.min(1, Math.max(0, ratio)))).join(", ")})`;

/** 예약은 슬롯 시작 24시간 전에 마감된다. */
const BOOKING_CUTOFF_HOURS = 24;

/** KST "YYYY-MM-DD HH:mm" 에 시간을 더한다. 시간대 변환 없이 문자열 그대로 계산한다. */
const addHours = (at: string, hours: number) =>
  new Date(Date.parse(`${at.replace(" ", "T")}:00Z`) + hours * 3_600_000)
    .toISOString()
    .slice(0, 16)
    .replace("T", " ");

const percent = (part: number, total: number) =>
  total === 0 ? 0 : Math.round((part / total) * 100);

type Props = { slots: Slot[]; now: string };

export function SlotsBoard({ slots, now }: Props) {
  const [view, setView] = useState<View>("schedule");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [mentor, setMentor] = useState<string | null>(null);

  const today = now.slice(0, 10);

  // 아직 예약을 받을 수 있는(시작까지 24시간 넘게 남은) 빈 슬롯이 그날 딱 1개 남은 멘토.
  // 상태 필터와 상관없이 전체 슬롯으로 판단한다.
  const closingSoon = useMemo(() => {
    const cutoff = addHours(now, BOOKING_CUTOFF_HOURS);
    const open = new Map<string, number>();
    for (const s of slots) {
      if (s.booked || `${s.date} ${s.start}` <= cutoff) continue;
      const key = `${s.date}|${s.mentorName}`;
      open.set(key, (open.get(key) ?? 0) + s.slotCount);
    }
    return new Set([...open].filter(([, n]) => n === 1).map(([key]) => key));
  }, [slots, now]);

  const mentors = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const s of slots)
      if (!map.has(s.mentorName)) map.set(s.mentorName, s.mentorNickname);
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b, "ko"))
      .map(([name, nickname], i) => ({
        name,
        nickname,
        color: MENTOR_COLORS[i % MENTOR_COLORS.length],
      }));
  }, [slots]);
  const colorOf = useMemo(
    () => new Map(mentors.map((m) => [m.name, m.color])),
    [mentors],
  );

  // 기간·멘토까지만 거른 범위. 요약 수치는 상태 필터와 무관하게 이 범위로 센다.
  const scoped = useMemo(
    () => slots.filter((s) => !mentor || s.mentorName === mentor),
    [slots, mentor],
  );
  const shown = useMemo(
    () =>
      scoped.filter(
        (s) => status === "all" || (status === "booked" ? s.booked : !s.booked),
      ),
    [scoped, status],
  );

  const bookedList = scoped.filter((s) => s.booked);
  const totalCount = countSlots(scoped);
  const bookedCount = countSlots(bookedList);
  const openCount = totalCount - bookedCount;
  const mentorCount = new Set(scoped.map((s) => s.mentorName)).size;

  return (
    <div className="flex flex-col gap-5">
      {/* 요약 */}
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        <Stat
          label="예정 슬롯"
          value={totalCount}
          unit="개"
          sub={`멘토 ${mentorCount}명`}
        />
        <Stat
          label="예약 완료"
          value={bookedCount}
          unit="개"
          sub={`예약 ${bookedList.length}건`}
          tone="booked"
        />
        <Stat label="예약 가능" value={openCount} unit="개" tone="open" />
        <div className="min-w-0 rounded-xl border border-zinc-200 bg-white p-3 sm:p-4">
          <p className="truncate text-[11px] font-medium text-zinc-500 sm:text-xs">
            예약률
          </p>
          <p className="mt-1 text-lg font-bold tabular-nums text-[#4D55F5] sm:text-2xl">
            {percent(bookedCount, totalCount)}
            <span className="ml-0.5 text-sm font-medium text-[#4D55F5]/70">
              %
            </span>
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100">
            <div
              className="h-full rounded-full bg-[#4D55F5] transition-all"
              style={{ width: `${percent(bookedCount, totalCount)}%` }}
            />
          </div>
        </div>
      </div>

      {/* 필터 */}
      <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50/60 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: "schedule", label: "일정" },
              { value: "matrix", label: "멘토 × 날짜" },
              { value: "list", label: "목록" },
            ]}
          />
          <span className="mx-1 hidden h-5 w-px bg-zinc-200 sm:block" />
          <Segmented
            value={status}
            onChange={setStatus}
            options={[
              { value: "all", label: "전체" },
              { value: "open", label: "예약 가능" },
              { value: "booked", label: "예약 완료" },
            ]}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Chip active={mentor === null} onClick={() => setMentor(null)}>
            전체 멘토
          </Chip>
          {mentors.map((m) => (
            <Chip
              key={m.name}
              active={mentor === m.name}
              onClick={() => setMentor(mentor === m.name ? null : m.name)}
            >
              <span className={`h-2 w-2 rounded-full ${m.color}`} />
              {m.name}
              {m.nickname && (
                <span className="text-zinc-400">· {m.nickname}</span>
              )}
            </Chip>
          ))}
        </div>
      </div>

      <Legend />

      {shown.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-200 py-16 text-center text-sm text-zinc-500">
          조건에 맞는 슬롯이 없습니다.
        </div>
      ) : view === "schedule" ? (
        <ScheduleView
          slots={shown}
          today={today}
          colorOf={colorOf}
          closingSoon={closingSoon}
        />
      ) : view === "matrix" ? (
        <MatrixView slots={shown} mentors={mentors} today={today} />
      ) : (
        <ListView slots={shown} colorOf={colorOf} />
      )}
    </div>
  );
}

/* ───────────────────────── 일정 보기 ───────────────────────── */

function ScheduleView({
  slots,
  today,
  colorOf,
  closingSoon,
}: {
  slots: Slot[];
  today: string;
  colorOf: Map<string, string>;
  closingSoon: Set<string>;
}) {
  const days = useMemo(() => {
    const byDate = new Map<string, Map<string, Slot[]>>();
    for (const s of slots) {
      const day = byDate.get(s.date) ?? new Map<string, Slot[]>();
      day.set(s.mentorName, [...(day.get(s.mentorName) ?? []), s]);
      byDate.set(s.date, day);
    }
    return [...byDate.entries()].map(([date, byMentor]) => ({
      date,
      weekday: byMentor.values().next().value?.[0]?.weekday ?? "",
      mentors: [...byMentor.entries()].sort(([, a], [, b]) =>
        a[0].start.localeCompare(b[0].start),
      ),
    }));
  }, [slots]);

  return (
    <div className="flex flex-col gap-4">
      {days.map((day) => {
        const all = day.mentors.flatMap(([, s]) => s);
        const total = countSlots(all);
        const booked = countSlots(all.filter((s) => s.booked));
        const isToday = day.date === today;
        const weekend = day.weekday === "토" || day.weekday === "일";
        return (
          <section
            key={day.date}
            className={`overflow-hidden rounded-xl border bg-white ${isToday ? "border-zinc-900" : "border-zinc-200"}`}
          >
            <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-zinc-100 bg-zinc-50/70 px-4 py-2.5">
              <h2
                className={`text-[15px] font-semibold ${weekend ? "text-rose-600" : "text-zinc-900"}`}
              >
                {formatDate(day.date, day.weekday)}
              </h2>
              {isToday && (
                <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[11px] font-medium text-white">
                  오늘
                </span>
              )}
              <span className="ml-auto text-xs tabular-nums text-zinc-500">
                슬롯 {total} · 예약{" "}
                <b className="font-semibold text-zinc-600">{booked}</b> · 가능{" "}
                <b className="font-semibold text-[#4A4FC4]">{total - booked}</b>
              </span>
            </header>
            <ul className="divide-y divide-zinc-100">
              {day.mentors.map(([name, list]) => {
                const urgent = closingSoon.has(`${day.date}|${name}`);
                return (
                  <li
                    key={name}
                    className={`flex flex-col gap-2 px-4 py-3 sm:flex-row sm:gap-4 ${urgent ? "bg-[#FBFAFF] shadow-[inset_3px_0_0_#7177F7]" : ""}`}
                  >
                    <div className="flex w-40 shrink-0 items-start gap-2 pt-1">
                      <span
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${colorOf.get(name)}`}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-zinc-900">
                          {name}
                        </p>
                        {list[0].mentorNickname && (
                          <p className="truncate text-xs text-zinc-500">
                            {list[0].mentorNickname}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-1 flex-wrap gap-1.5">
                      {list.map((s, i) => (
                        <SlotChip key={`${s.start}-${i}`} slot={s} />
                      ))}
                    </div>
                    {urgent && (
                      <span
                        title="예약은 슬롯 시작 24시간 전에 마감됩니다. 아직 예약받을 수 있는 빈 슬롯이 1개 남았습니다."
                        className="inline-flex shrink-0 items-center gap-1 self-start rounded-full bg-[#7177F7] px-2.5 py-1 text-[11px] font-semibold text-white sm:self-center"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-white" />
                        마감 임박 · 1자리
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function SlotChip({ slot: s }: { slot: Slot }) {
  const title = [
    `${formatDate(s.date, s.weekday)} ${s.start}–${s.end} (${s.minutes}분)`,
    s.booked ? `${s.kind}${s.mentee ? ` · ${s.mentee}` : ""}` : "예약 가능",
    s.program,
  ]
    .filter(Boolean)
    .join("\n");

  if (s.booked) {
    return (
      <span
        title={title}
        className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-400"
      >
        <span className="tabular-nums">
          {s.start}
          {s.slotCount > 1 && `–${s.end}`}
        </span>
        {s.mentee && (
          <span className="max-w-24 truncate border-l border-zinc-200 pl-1.5 font-normal">
            {s.mentee}
          </span>
        )}
      </span>
    );
  }
  return (
    <span
      title={title}
      className="inline-flex items-center rounded-lg border border-[#7177F7] bg-[#F0F1FE] px-2.5 py-1 text-xs font-semibold tabular-nums text-[#4D55F5] transition-colors hover:bg-[#E2E4FE]"
    >
      {s.start}
    </span>
  );
}

/* ───────────────────────── 멘토 × 날짜 ───────────────────────── */

function MatrixView({
  slots,
  mentors,
  today,
}: {
  slots: Slot[];
  mentors: { name: string; nickname: string | null; color: string }[];
  today: string;
}) {
  const { dates, cells, rows } = useMemo(() => {
    const dateMap = new Map<string, string>();
    const cells = new Map<string, { total: number; booked: number }>();
    for (const s of slots) {
      dateMap.set(s.date, s.weekday);
      const key = `${s.mentorName}|${s.date}`;
      const c = cells.get(key) ?? { total: 0, booked: 0 };
      c.total += s.slotCount;
      if (s.booked) c.booked += s.slotCount;
      cells.set(key, c);
    }
    const present = new Set(slots.map((s) => s.mentorName));
    return {
      dates: [...dateMap.entries()].sort(([a], [b]) => a.localeCompare(b)),
      cells,
      rows: mentors.filter((m) => present.has(m.name)),
    };
  }, [slots, mentors]);

  const max = Math.max(1, ...[...cells.values()].map((c) => c.total));

  return (
    <div className="w-0 min-w-full overflow-x-auto rounded-xl border border-zinc-200 bg-white">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 w-px whitespace-nowrap border-b border-zinc-200 bg-zinc-50 px-3 sm:px-4 py-2.5 text-left text-xs font-medium text-zinc-500">
              멘토
            </th>
            {dates.map(([date, weekday]) => {
              const [, m, d] = date.split("-");
              const weekend = weekday === "토" || weekday === "일";
              return (
                <th
                  key={date}
                  className={`border-b border-zinc-200 px-1 py-2 text-center text-[11px] font-medium ${
                    date === today
                      ? "bg-zinc-900 text-white"
                      : "bg-zinc-50 " +
                        (weekend ? "text-rose-500" : "text-zinc-500")
                  }`}
                >
                  <div className="tabular-nums">
                    {Number(m)}/{Number(d)}
                  </div>
                  <div>{weekday}</div>
                </th>
              );
            })}
            <th className="w-px whitespace-nowrap border-b border-zinc-200 bg-zinc-50 px-3 py-2.5 text-right text-xs font-medium text-zinc-500">
              합계
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => {
            let total = 0;
            let booked = 0;
            return (
              <tr key={m.name}>
                <th className="sticky left-0 z-10 w-px whitespace-nowrap border-b border-zinc-100 bg-white px-3 sm:px-4 py-2 text-left font-medium text-zinc-900">
                  <span className="inline-flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${m.color}`} />
                    {m.name}
                  </span>
                </th>
                {dates.map(([date]) => {
                  const c = cells.get(`${m.name}|${date}`);
                  if (c) {
                    total += c.total;
                    booked += c.booked;
                  }
                  return (
                    <td
                      key={date}
                      className="border-b border-zinc-100 p-0.5 sm:p-1"
                    >
                      {c ? (
                        <div
                          title={`${m.name} · ${date}\n슬롯 ${c.total} · 예약 ${c.booked} · 가능 ${c.total - c.booked}`}
                          className="relative flex h-10 w-full min-w-10 flex-col items-center justify-center overflow-hidden rounded-md border border-[#7177F7] text-[11px] tabular-nums"
                          style={{ backgroundColor: cellColor(c.total / max) }}
                        >
                          <span
                            className={`font-semibold ${c.total / max > 0.55 ? "text-white" : "text-[#4D55F5]"}`}
                          >
                            {c.total}
                          </span>
                          {c.booked > 0 && (
                            <span className="rounded bg-white/85 px-1 text-[10px] font-medium leading-tight text-zinc-500">
                              예약 {c.booked}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex h-10 w-full min-w-10 items-center justify-center text-zinc-300">
                          ·
                        </div>
                      )}
                    </td>
                  );
                })}
                <td className="w-px whitespace-nowrap border-b border-zinc-100 px-3 py-2 text-right text-xs tabular-nums text-zinc-600">
                  <b className="text-sm font-semibold text-zinc-900">{total}</b>
                  <span className="ml-1 text-zinc-400">({booked})</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="border-t border-zinc-100 px-4 py-2 text-xs text-zinc-500">
        칸의 숫자는 그날 연 슬롯 수, 색이 진할수록 많이 열린 날입니다. 합계
        괄호는 예약 완료 수.
      </p>
    </div>
  );
}

/* ───────────────────────── 목록 보기 ───────────────────────── */

const LIST_HEADERS = [
  "날짜",
  "시간",
  "멘토",
  "상태",
  "예약 멘티",
  "프로그램",
  "슬롯 등록일시",
];

function ListView({
  slots,
  colorOf,
}: {
  slots: Slot[];
  colorOf: Map<string, string>;
}) {
  return (
    <div className="w-0 min-w-full overflow-x-auto rounded-xl border border-zinc-200 bg-white">
      <table className="w-full min-w-[56rem] text-left text-sm">
        <thead className="border-b border-zinc-200 bg-zinc-50 text-xs text-zinc-500">
          <tr>
            {LIST_HEADERS.map((h) => (
              <th key={h} className="whitespace-nowrap px-4 py-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 text-zinc-700">
          {slots.map((s, i) => (
            <tr
              key={i}
              className={
                s.booked ? "bg-zinc-50 text-zinc-400" : "hover:bg-zinc-50"
              }
            >
              <td className="whitespace-nowrap px-4 py-2.5">
                {formatDate(s.date, s.weekday)}
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">
                {s.start}–{s.end}
              </td>
              <td className="whitespace-nowrap px-4 py-2.5">
                <span className="inline-flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${colorOf.get(s.mentorName)}`}
                  />
                  <span className="font-medium text-zinc-900">
                    {s.mentorName}
                  </span>
                  {s.mentorNickname && (
                    <span className="text-xs text-zinc-400">
                      {s.mentorNickname}
                    </span>
                  )}
                </span>
              </td>
              <td className="whitespace-nowrap px-4 py-2.5">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    s.booked
                      ? "bg-zinc-100 text-zinc-400"
                      : "bg-[#F0F1FE] text-[#4D55F5]"
                  }`}
                >
                  {s.booked ? s.kind : "예약 가능"}
                </span>
              </td>
              <td className="whitespace-nowrap px-4 py-2.5">
                {s.mentee ?? "-"}
              </td>
              <td className="min-w-64 px-4 py-2.5">{s.program ?? "-"}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-xs tabular-nums text-zinc-500">
                {s.createdAt ?? "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ───────────────────────── 공통 조각 ───────────────────────── */

function Stat({
  label,
  value,
  unit,
  sub,
  tone,
}: {
  label: string;
  value: number;
  unit: string;
  sub?: string;
  tone?: "booked" | "open";
}) {
  const dot =
    tone === "booked" ? "bg-zinc-400" : tone === "open" ? "bg-[#7177F7]" : null;
  return (
    <div className="min-w-0 rounded-xl border border-zinc-200 bg-white p-3 sm:p-4">
      <p className="flex items-center gap-1.5 whitespace-nowrap text-[11px] font-medium text-zinc-500 sm:text-xs">
        {dot && <span className={`h-2 w-2 rounded-full ${dot}`} />}
        {label}
      </p>
      <p className="mt-1 text-lg font-bold tabular-nums sm:text-2xl text-zinc-900">
        {value.toLocaleString()}
        <span className="ml-0.5 text-sm font-medium text-zinc-500">{unit}</span>
      </p>
      {sub && (
        <p className="mt-1 truncate text-[11px] text-zinc-500 sm:text-xs">
          {sub}
        </p>
      )}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-5 rounded border border-[#7177F7] bg-[#F0F1FE]" />{" "}
        예약 가능
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-5 rounded bg-zinc-100" /> 예약 완료
      </span>
      <span className="text-zinc-400">
        슬롯에 마우스를 올리면 상세 정보가 보입니다.
      </span>
    </div>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div
      role="radiogroup"
      className="inline-flex rounded-lg border border-zinc-200 bg-white p-0.5"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            value === o.value
              ? "bg-zinc-900 text-white"
              : "text-zinc-600 hover:bg-zinc-100"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? "border-zinc-900 bg-zinc-900 text-white"
          : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400"
      }`}
    >
      {children}
    </button>
  );
}
