// 대시보드(공급·수요·전환·품질) 페이지가 함께 쓰는 조각
import { Card } from "./ui";

export const formatTime = (iso: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));

export const pct = (num: number, den: number) => (den > 0 ? `${((num / den) * 100).toFixed(1)}%` : "—");

export const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;

export function Kpi({
  label,
  value,
  sub,
  basis,
  error,
  pending,
}: {
  label: string;
  value: string | null;
  sub?: string;
  basis: string;
  error?: string | null;
  pending?: string;
}) {
  return (
    <Card className="flex flex-col">
      <p className="text-sm font-medium text-zinc-500">{label}</p>
      {value !== null ? (
        <p className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 tabular-nums">{value}</p>
      ) : (
        <p className="mt-3 inline-flex w-fit rounded-full bg-zinc-100 px-2.5 py-1 text-sm font-medium text-zinc-500">
          {error ? "불러오지 못함" : (pending ?? "—")}
        </p>
      )}
      {sub && <p className="mt-1.5 text-sm text-zinc-700">{sub}</p>}
      <p className="mt-auto pt-3 text-xs leading-relaxed text-zinc-500">{error ?? basis}</p>
    </Card>
  );
}

export function Section({
  title,
  description,
  children,
  flush,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  flush?: boolean;
}) {
  return (
    <section className={flush ? "" : "mt-8"}>
      <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
      <p className="mb-3 mt-1 text-sm text-zinc-500">{description}</p>
      {children}
    </section>
  );
}

export function Empty({ message }: { message: string }) {
  return <p className="py-6 text-center text-sm text-zinc-500">{message || "데이터가 없습니다."}</p>;
}

export function LoadError({ title, message }: { title: string; message: string }) {
  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
      <p className="font-medium">{title}</p>
      <p className="mt-1">{message}</p>
    </div>
  );
}

/** 가로 막대 목록. 값 기준으로 길이를 맞추고, 오른쪽에 숫자와 보조 값을 붙인다. */
export function BarList({
  rows,
  highlight = 0,
  labelWidth = "7rem",
}: {
  rows: { label: string; value: number; display?: string; sub?: string }[];
  /** 위에서부터 진하게 표시할 개수 */
  highlight?: number;
  labelWidth?: string;
}) {
  if (rows.length === 0) return <Empty message="" />;
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2">
      {rows.map((r, i) => (
        <li
          key={r.label}
          className="grid items-center gap-3 text-sm"
          style={{ gridTemplateColumns: `${labelWidth} 1fr auto` }}
        >
          <span className="truncate text-zinc-700" title={r.label}>
            {r.label}
          </span>
          <span className="h-3 rounded-sm bg-zinc-100">
            <span
              className={`block h-3 rounded-sm ${i < highlight ? "bg-zinc-800" : "bg-zinc-400"}`}
              style={{ width: `${(r.value / max) * 100}%` }}
            />
          </span>
          <span className="whitespace-nowrap text-right tabular-nums text-zinc-700">
            {r.display ?? r.value}
            {r.sub && <span className="ml-1.5 text-xs text-zinc-500">{r.sub}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
