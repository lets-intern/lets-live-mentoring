// GA4 경로 탐색처럼 단계별 노드와 그 사이 흐름을 그리는 생키 차트. 서버에서 SVG 로 그린다.

export type StepFlowData = {
  total: number;
  columns: { label: string; count: number }[][];
  links: { col: number; from: string; to: string; count: number }[];
};

const LABEL_W = 150; // 막대 왼쪽 라벨 자리
const COL_GAP = 210; // 열 사이 간격(막대 왼쪽 끝 기준)
const BAR_W = 14;
const SLOT_MIN = 36; // 라벨 두 줄이 들어갈 최소 높이
const NODE_GAP = 8;
const TOP = 28; // 열 제목 자리
const MAX_LABEL = 13;

const NODE = "#6b9cf2";
const LINK = "rgba(107, 156, 242, 0.22)";

type Placed = { label: string; count: number; y: number; h: number; inOff: number; outOff: number };

const clip = (s: string) => (s.length > MAX_LABEL ? `${s.slice(0, MAX_LABEL)}…` : s);

export function StepFlow({ data, headers }: { data: StepFlowData; headers: string[] }) {
  if (data.total === 0) return <p className="py-6 text-center text-sm text-zinc-500">데이터가 없습니다.</p>;

  const maxColTotal = Math.max(...data.columns.map((c) => c.reduce((n, x) => n + x.count, 0)));
  const unit = Math.max(2, Math.min(7, 300 / maxColTotal));

  // 열마다 노드를 위에서부터 쌓는다. 작은 노드도 라벨이 들어가도록 최소 높이만큼 자리를 둔다.
  const placed: Map<string, Placed>[] = data.columns.map((col) => {
    let y = TOP;
    const m = new Map<string, Placed>();
    for (const n of col) {
      const h = Math.max(3, n.count * unit);
      m.set(n.label, { ...n, y, h, inOff: 0, outOff: 0 });
      y += Math.max(h, SLOT_MIN) + NODE_GAP;
    }
    return m;
  });
  const height = Math.max(...placed.map((m) => Math.max(TOP, ...[...m.values()].map((p) => p.y + Math.max(p.h, SLOT_MIN))))) + 8;
  const barX = (c: number) => LABEL_W + c * COL_GAP;
  const width = barX(data.columns.length - 1) + BAR_W + 8;

  // 흐름이 엇갈리지 않게: 나가는 쪽은 도착 노드 위치 순, 들어오는 쪽은 출발 노드 위치 순으로 쌓는다.
  const bands = data.links
    .map((l) => ({ ...l, src: placed[l.col].get(l.from)!, dst: placed[l.col + 1].get(l.to)!, t: l.count * unit }))
    .filter((b) => b.src && b.dst);
  const outY = new Map<(typeof bands)[number], number>();
  const inY = new Map<(typeof bands)[number], number>();
  [...bands]
    .sort((a, b) => a.col - b.col || a.src.y - b.src.y || a.dst.y - b.dst.y)
    .forEach((b) => {
      outY.set(b, b.src.y + b.src.outOff);
      b.src.outOff += b.t;
    });
  [...bands]
    .sort((a, b) => a.col - b.col || a.dst.y - b.dst.y || a.src.y - b.src.y)
    .forEach((b) => {
      inY.set(b, b.dst.y + b.dst.inOff);
      b.dst.inOff += b.t;
    });

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        className="max-w-none"
        role="img"
        aria-label="결제 직전 단계별 페이지 흐름"
      >
        {headers.map((h, c) => (
          <text key={h} x={barX(c) + BAR_W / 2} y={14} textAnchor="middle" className="fill-zinc-500 text-[11px]">
            {h}
          </text>
        ))}

        {bands.map((b, i) => {
          const x0 = barX(b.col) + BAR_W;
          const x1 = barX(b.col + 1);
          const xm = (x0 + x1) / 2;
          const y0 = outY.get(b)!;
          const y1 = inY.get(b)!;
          return (
            <path
              key={i}
              d={`M${x0},${y0} C${xm},${y0} ${xm},${y1} ${x1},${y1} L${x1},${y1 + b.t} C${xm},${y1 + b.t} ${xm},${y0 + b.t} ${x0},${y0 + b.t} Z`}
              fill={LINK}
            >
              <title>{`${b.from} → ${b.to}: ${b.count}건`}</title>
            </path>
          );
        })}

        {placed.map((m, c) =>
          [...m.values()].map((n) => (
            <g key={`${c}-${n.label}`}>
              <rect x={barX(c)} y={n.y} width={BAR_W} height={n.h} fill={NODE}>
                <title>{`${n.label}: ${n.count}건`}</title>
              </rect>
              <text
                x={barX(c) - 6}
                y={n.y + 12}
                textAnchor="end"
                className="fill-zinc-700 text-[12px]"
                stroke="white"
                strokeWidth={3}
                paintOrder="stroke"
              >
                {clip(n.label)}
                <title>{n.label}</title>
              </text>
              <text
                x={barX(c) - 6}
                y={n.y + 27}
                textAnchor="end"
                className="fill-zinc-900 text-[12px] font-semibold"
                stroke="white"
                strokeWidth={3}
                paintOrder="stroke"
              >
                {n.count}
              </text>
            </g>
          )),
        )}
      </svg>
    </div>
  );
}
