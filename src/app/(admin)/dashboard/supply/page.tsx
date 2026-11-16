import type { Metadata } from "next";
import { BarList, Empty, formatTime, Kpi, pct, Section } from "@/components/dashboard";
import { Card, PageHeader } from "@/components/ui";
import { fetchSupplyDashboard, WEEKDAYS, type HeatCell, type MentorSupply } from "@/lib/supply";

export const metadata: Metadata = { title: "공급 관리" };

// Redash·멘토 DB 결과가 갱신되면 바로 보이도록 매 요청마다 가져온다.
export const dynamic = "force-dynamic";

export default async function SupplyDashboardPage() {
  const d = await fetchSupplyDashboard();
  const s = d.slots.ok ? d.slots.data : null;
  const b = d.bookings.ok ? d.bookings.data : null;
  const registered = d.registeredMentors.ok ? d.registeredMentors.data : null;

  return (
    <>
      <PageHeader title="공급 관리" description="멘토·슬롯 공급이 예약을 막고 있는지, 막는다면 어디서인지 봅니다. 읽기 전용." />

      {/* 1. KPI 카드 */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="활성 멘토 수"
          value={s ? `${s.activeMentors}명` : null}
          sub={registered !== null ? `멘토 DB 활동중 ${registered}명 대비` : "멘토 DB 미연결"}
          basis="최근 14일 안에 등록한 슬롯이 아직 남아 있는 멘토 (지난 슬롯은 쿼리에 없음)"
          error={d.slots.ok ? null : d.slots.message}
        />
        <Kpi
          label="슬롯 소진율"
          value={s ? pct(s.bookedSlots, s.openSlots) : null}
          sub={s ? `오픈 ${s.openSlots} · 예약 ${s.bookedSlots} (30분 슬롯)` : undefined}
          basis="오늘 이후 슬롯 기준. 아직 판매 중인 슬롯이라 기간 소진율보다 낮게 나옵니다"
          error={d.slots.ok ? null : d.slots.message}
        />
        <Kpi
          label="멘토별 예약 집중도"
          value={b ? pct(b.topBookings, b.total) : null}
          sub={b ? `상위 ${b.topCount}명 / ${b.mentors}명이 ${b.topBookings}건 / ${b.total}건` : undefined}
          basis={b ? `예약 신청 ${b.from ?? "?"} ~ ${b.to ?? "?"}, 테스트 프로그램 제외` : "쿼리 348"}
          error={d.bookings.ok ? null : d.bookings.message}
        />
        <Kpi
          label="검색 실패율"
          value={null}
          pending="데이터 준비 중"
          sub={s ? `대체 지표: 24시간 이후 예약 가능 슬롯 0개인 멘토 ${s.zeroBookableMentors}/${s.mentorsWithSlots}명` : undefined}
          basis="상세 페이지 진입 로그가 있어야 계산할 수 있습니다"
        />
      </div>

      <Sources slotsAt={s?.retrievedAt} bookingsAt={b?.retrievedAt} />

      {/* 2. 멘토별 공급 */}
      <Section title="멘토별 공급" description="쏠림과 공급 0 멘토를 함께 봅니다. 누적 예약 많은 순.">
        <MentorTable mentors={d.mentors} />
      </Section>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        {/* 3. 예약 집중도 */}
        <Section title="멘토별 예약 건수" description="상위 20% 멘토를 진하게 표시합니다." flush>
          <Card>
            {b ? <BarList
                highlight={b.topCount}
                labelWidth="6rem"
                rows={d.mentors
                  .filter((m) => m.bookings > 0)
                  .sort((x, y) => y.bookings - x.bookings)
                  .map((m) => ({ label: m.name, value: m.bookings }))}
              /> : <Empty message={d.bookings.ok ? "" : d.bookings.message} />}
          </Card>
        </Section>

        {/* 5. 직무별 공급 */}
        <Section title="직무별 공급" description="멘토 DB 직무 기준 (이름으로 매칭). 오늘 이후 슬롯." flush>
          <Card>
            {s ? <JobTable rows={s.byJob} /> : <Empty message={d.slots.ok ? "" : d.slots.message} />}
          </Card>
        </Section>
      </div>

      {/* 4. 요일×시간대 */}
      <Section title="요일·시간대별 공급" description="칸의 숫자는 오픈 30분 슬롯 수, 괄호는 그중 예약. 수요(기간 소진율)는 집계 쿼리가 생기면 추가합니다.">
        <Card>{s ? <Heatmap cells={s.heatmap} hours={s.hours} /> : <Empty message={d.slots.ok ? "" : d.slots.message} />}</Card>
      </Section>
    </>
  );
}

function Sources({ slotsAt, bookingsAt }: { slotsAt?: string; bookingsAt?: string }) {
  return (
    <p className="mt-3 text-xs text-zinc-500">
      출처: 슬롯 Redash 446{slotsAt && ` (${formatTime(slotsAt)} 갱신)`} · 예약 Redash 348
      {bookingsAt && ` (${formatTime(bookingsAt)} 갱신)`} · 멘토 DB LetsOperation
    </p>
  );
}

function MentorTable({ mentors }: { mentors: MentorSupply[] }) {
  if (mentors.length === 0) return <Card><Empty message="" /></Card>;
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-zinc-200 bg-zinc-50 text-xs text-zinc-500">
          <tr>
            <th className="whitespace-nowrap px-4 py-3 font-medium">멘토</th>
            <th className="whitespace-nowrap px-4 py-3 font-medium">직무</th>
            <Num>오픈 슬롯</Num>
            <Num>예약 슬롯</Num>
            <Num>소진율</Num>
            <Num>24h 이후 예약 가능</Num>
            <Num>누적 예약(건)</Num>
            <th className="whitespace-nowrap px-4 py-3 font-medium">최근 14일 오픈</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {mentors.map((m) => (
            <tr key={m.name} className="hover:bg-zinc-50">
              <td className="whitespace-nowrap px-4 py-3 font-medium text-zinc-900">
                {m.name}
                {m.nickname && <span className="ml-1.5 font-normal text-zinc-500">{m.nickname}</span>}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-zinc-700">{m.jobRole ?? <span className="text-zinc-400">—</span>}</td>
              <NumCell>{m.openSlots}</NumCell>
              <NumCell>{m.bookedSlots}</NumCell>
              <NumCell>{pct(m.bookedSlots, m.openSlots)}</NumCell>
              <NumCell warn={m.bookableSlots === 0}>{m.bookableSlots}</NumCell>
              <NumCell>{m.bookings}</NumCell>
              <td className="whitespace-nowrap px-4 py-3">
                {m.active ? (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">활성</span>
                ) : (
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">없음</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const Num = ({ children }: { children: React.ReactNode }) => (
  <th className="whitespace-nowrap px-4 py-3 text-right font-medium">{children}</th>
);

const NumCell = ({ children, warn }: { children: React.ReactNode; warn?: boolean }) => (
  <td className={`whitespace-nowrap px-4 py-3 text-right tabular-nums ${warn ? "font-semibold text-red-600" : "text-zinc-700"}`}>
    {children}
  </td>
);

function JobTable({ rows }: { rows: { jobRole: string; openSlots: number; bookedSlots: number; mentors: number }[] }) {
  if (rows.length === 0) return <Empty message="" />;
  return (
    <table className="w-full text-left text-sm">
      <thead className="text-xs text-zinc-500">
        <tr>
          <th className="pb-2 font-medium">직무</th>
          <th className="pb-2 text-right font-medium">멘토</th>
          <th className="pb-2 text-right font-medium">오픈 슬롯</th>
          <th className="pb-2 text-right font-medium">예약 슬롯</th>
          <th className="pb-2 text-right font-medium">소진율</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-zinc-100">
        {rows.map((r) => (
          <tr key={r.jobRole}>
            <td className="py-2 text-zinc-900">{r.jobRole}</td>
            <td className="py-2 text-right tabular-nums text-zinc-700">{r.mentors}</td>
            <td className="py-2 text-right tabular-nums text-zinc-700">{r.openSlots}</td>
            <td className="py-2 text-right tabular-nums text-zinc-700">{r.bookedSlots}</td>
            <td className="py-2 text-right tabular-nums text-zinc-700">{pct(r.bookedSlots, r.openSlots)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Heatmap({ cells, hours }: { cells: HeatCell[]; hours: number[] }) {
  const byKey = new Map(cells.map((c) => [`${c.weekday}|${c.hour}`, c]));
  const max = Math.max(1, ...cells.map((c) => c.open));
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-1 text-center text-xs">
        <thead>
          <tr>
            <th className="w-8" />
            {hours.map((h) => (
              <th key={h} className="font-medium text-zinc-500">
                {h}시
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {WEEKDAYS.map((w) => (
            <tr key={w}>
              <th className="font-medium text-zinc-500">{w}</th>
              {hours.map((h) => {
                const c = byKey.get(`${w}|${h}`);
                const open = c?.open ?? 0;
                return (
                  <td
                    key={h}
                    title={`${w} ${h}시: 오픈 ${open} · 예약 ${c?.booked ?? 0}`}
                    className={`h-9 min-w-10 rounded tabular-nums ${open === 0 ? "bg-zinc-50 text-zinc-300" : open / max > 0.5 ? "text-white" : "text-zinc-800"}`}
                    style={open ? { backgroundColor: `rgba(24, 24, 27, ${0.12 + (open / max) * 0.78})` } : undefined}
                  >
                    {open || "·"}
                    {c?.booked ? <span className="opacity-80"> ({c.booked})</span> : null}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
