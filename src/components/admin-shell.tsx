"use client";

import { useEffect, useState } from "react";
import Sidebar from "./sidebar";
import { Icon } from "./icons";

const STORAGE_KEY = "llm_admin_sidebar_collapsed";

export default function AdminShell({
  children,
  logoutAction,
}: {
  children: React.ReactNode;
  logoutAction: () => Promise<void>;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // 축소 상태는 브라우저별로 기억
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {}
  }, []);

  const toggle = () => {
    // 모바일에서는 드로어 열고 닫기, 데스크톱에서는 축소/확장
    if (window.matchMedia("(min-width: 768px)").matches) {
      setCollapsed((prev) => {
        try {
          localStorage.setItem(STORAGE_KEY, prev ? "0" : "1");
        } catch {}
        return !prev;
      });
    } else {
      setMobileOpen((prev) => !prev);
    }
  };

  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onNavigate={() => setMobileOpen(false)}
        logoutAction={logoutAction}
      />
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-zinc-900/30 md:hidden" onClick={() => setMobileOpen(false)} />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center border-b border-zinc-200 bg-white px-4 md:px-5">
          <button
            type="button"
            onClick={toggle}
            aria-label="사이드바 접기/펼치기"
            title="사이드바 접기/펼치기"
            className="rounded-md p-1.5 text-zinc-700 hover:bg-zinc-100"
          >
            <Icon name="panel" />
          </button>
        </header>
        <main className="flex flex-1 flex-col p-4 md:px-5 md:py-6">{children}</main>
      </div>
    </div>
  );
}
