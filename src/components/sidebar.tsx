"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./icons";
import { BRAND_NAME, LogoMark } from "./logo";

type NavChild = { href: string; label: string };
type NavItem =
  | { type: "link"; href: string; label: string; icon: IconName }
  | { type: "group"; label: string; icon: IconName; children: NavChild[] };

const NAV: NavItem[] = [
  { type: "link", href: "/", label: "대시보드", icon: "dashboard" },
  {
    type: "group",
    label: "멘토링 운영",
    icon: "calendar",
    children: [{ href: "/sessions", label: "멘토링 세션" }],
  },
  {
    type: "group",
    label: "멘토 관리",
    icon: "users",
    children: [{ href: "/mentors", label: "멘토 DB" }],
  },
  { type: "link", href: "/settings", label: "설정", icon: "settings" },
];

const isActive = (pathname: string, href: string) =>
  href === "/" ? pathname === "/" : pathname.startsWith(href);

type Props = {
  collapsed: boolean; // 데스크톱: 아이콘만 보이는 축소 상태
  mobileOpen: boolean; // 모바일: 드로어 열림 상태
  onNavigate: () => void;
  logoutAction: () => Promise<void>;
};

export default function Sidebar({ collapsed, mobileOpen, onNavigate, logoutAction }: Props) {
  const pathname = usePathname();
  // 축소 시(데스크톱) 숨길 요소
  const hideWhenCollapsed = collapsed ? "md:hidden" : "";
  const rowBase = `flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[15px] ${
    collapsed ? "md:justify-center md:px-0" : ""
  }`;

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-zinc-200 bg-zinc-50 transition-all duration-200
        ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
        md:sticky md:top-0 md:h-screen md:translate-x-0 ${collapsed ? "md:w-16" : "md:w-60"}`}
    >
      {/* 로고 */}
      <div className={`flex h-16 shrink-0 items-center gap-2.5 px-4 ${collapsed ? "md:justify-center md:px-0" : ""}`}>
        <Logo />
        <span className={`truncate text-[15px] font-bold text-zinc-900 ${hideWhenCollapsed}`}>
          {BRAND_NAME}
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-4">
        <p className={`px-3 pb-2 pt-4 text-xs text-zinc-500 ${hideWhenCollapsed}`}>운영</p>
        <ul className="space-y-0.5">
          {NAV.map((item) => {
            if (item.type === "link") {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    title={collapsed ? item.label : undefined}
                    className={`${rowBase} ${
                      active ? "bg-zinc-200/60 font-medium text-zinc-900" : "text-zinc-700 hover:bg-zinc-100"
                    }`}
                  >
                    <Icon name={item.icon} />
                    <span className={hideWhenCollapsed}>{item.label}</span>
                  </Link>
                </li>
              );
            }

            const groupActive = item.children.some((c) => isActive(pathname, c.href));
            return (
              <li key={item.label}>
                {/* 그룹 헤더: 펼친 상태에서는 라벨, 축소 상태에서는 첫 하위 메뉴로 이동하는 아이콘 */}
                <Link
                  href={item.children[0].href}
                  onClick={onNavigate}
                  title={collapsed ? item.label : undefined}
                  className={`${rowBase} text-zinc-700 hover:bg-zinc-100 ${
                    collapsed && groupActive ? "md:bg-zinc-200/60 md:text-zinc-900" : ""
                  }`}
                >
                  <Icon name={item.icon} />
                  <span className={hideWhenCollapsed}>{item.label}</span>
                </Link>
                <ul className={`ml-[21px] mt-0.5 space-y-0.5 border-l border-zinc-200 pl-2 ${hideWhenCollapsed}`}>
                  {item.children.map((child) => {
                    const active = isActive(pathname, child.href);
                    return (
                      <li key={child.href}>
                        <Link
                          href={child.href}
                          onClick={onNavigate}
                          className={`block rounded-lg px-3 py-2 text-[15px] ${
                            active ? "bg-zinc-200/60 font-medium text-zinc-900" : "text-zinc-700 hover:bg-zinc-100"
                          }`}
                        >
                          {child.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* 하단 고정: 로그아웃 */}
      <div className="shrink-0 border-t border-zinc-200 px-2 py-3">
        <form action={logoutAction}>
          <button
            type="submit"
            title={collapsed ? "로그아웃" : undefined}
            className={`${rowBase} text-zinc-700 hover:bg-zinc-100`}
          >
            <Icon name="logout" />
            <span className={hideWhenCollapsed}>로그아웃</span>
          </button>
        </form>
      </div>
    </aside>
  );
}

function Logo() {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-zinc-200">
      <LogoMark />
    </span>
  );
}
