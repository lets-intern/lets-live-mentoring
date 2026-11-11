import Image from "next/image";

export const BRAND_NAME = "LetsMentoring";

/** 브랜드 로고 마크 (Letscareer 로고 이미지) */
export function LogoMark({ className = "h-5 w-5" }: { className?: string }) {
  return <Image src="/logo.png" alt="" width={336} height={336} className={`object-contain ${className}`} priority />;
}
