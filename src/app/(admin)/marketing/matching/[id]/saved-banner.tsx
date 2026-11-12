"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

/** 저장 직후 한 번만 보여주고, 새로고침해도 다시 뜨지 않게 주소에서 ?saved=1 을 지운다 */
export function SavedBanner() {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    router.replace(pathname, { scroll: false });
  }, [router, pathname]);

  return (
    <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm text-emerald-800">
      저장했습니다.
    </div>
  );
}
