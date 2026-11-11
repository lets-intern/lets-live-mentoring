export const BRAND_NAME = "LetsMentoring";

/** 브랜드 로고 마크 (보라 그라데이션) */
export function LogoMark({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <defs>
        <linearGradient id="logo-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#818cf8" />
          <stop offset="1" stopColor="#6d28d9" />
        </linearGradient>
      </defs>
      <path
        fill="url(#logo-gradient)"
        d="M4 19c0-5 2-11 4.5-11 1.4 0 1.8 2.5 2.3 4.5C11.4 9 12.6 4 15 4c2.6 0 5 8 5 13.5 0 1.4-1 2.5-2.5 2.5h-11C4.9 20 4 19.6 4 19z"
      />
    </svg>
  );
}
