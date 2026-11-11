// 페이지 공통 UI 조각
import { Icon } from "./icons";

export function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{title}</h1>
      {description && <p className="mt-1.5 text-[15px] text-zinc-500">{description}</p>}
    </div>
  );
}

/** 아직 기획/구현되지 않은 영역 표시 */
export function UnderConstruction({
  title = "구현 중",
  description = "구체적 구성은 별도 기획에서 정의합니다.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex min-h-[420px] flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 px-4 text-center">
      <Icon name="hammer" className="h-7 w-7 text-zinc-500" />
      <p className="mt-3 text-base font-semibold text-zinc-900">{title}</p>
      <p className="mt-1.5 text-sm text-zinc-500">{description}</p>
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-zinc-200 bg-white p-5 ${className}`}>{children}</div>;
}

const BADGE: Record<string, string> = {
  예정: "bg-blue-50 text-blue-700",
  완료: "bg-emerald-50 text-emerald-700",
  취소: "bg-zinc-100 text-zinc-500",
  노쇼: "bg-red-50 text-red-700",
  활동중: "bg-emerald-50 text-emerald-700",
  휴면: "bg-zinc-100 text-zinc-500",
};

export function Badge({ label }: { label: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${BADGE[label] ?? "bg-zinc-100"}`}>
      {label}
    </span>
  );
}

export function Table({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-zinc-200 bg-zinc-50 text-xs text-zinc-500">
          <tr>
            {headers.map((h) => (
              <th key={h} className="whitespace-nowrap px-4 py-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {rows.map((cells, i) => (
            <tr key={i} className="hover:bg-zinc-50">
              {cells.map((c, j) => (
                <td key={j} className="whitespace-nowrap px-4 py-3 text-zinc-700">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
