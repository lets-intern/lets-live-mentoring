// 프로모션 페이지들이 함께 쓰는 작은 조각

export function formatPeriod(startsOn: string, endsOn: string) {
  const fmt = (d: string) => d.replaceAll("-", ".");
  return `${fmt(startsOn)} ~ ${fmt(endsOn)}`;
}

export function ErrorBox({ title, message }: { title: string; message: string }) {
  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
      <p className="font-medium">{title}</p>
      <p className="mt-1">{message}</p>
    </div>
  );
}
