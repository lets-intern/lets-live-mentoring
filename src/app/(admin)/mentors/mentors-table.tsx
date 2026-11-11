"use client";

import { useDeferredValue, useState } from "react";
import { Icon } from "@/components/icons";
import type { Mentor, MentorCareer, MentorDocumentPass } from "@/lib/lets-operation";

// 표시 규칙은 LetsOperation 멘토 DB 화면(domain/mentor.ts)과 맞춘다.
const joinFilled = (parts: (string | null)[]) => parts.filter(Boolean).join(" · ");
const formatCareer = (c: MentorCareer) => joinFilled([c.company, c.jobRole, c.jobTitle, c.years]);
const formatDocumentPass = (p: MentorDocumentPass) => joinFilled([p.company, p.jobRole]);
const activeLabel = (active: boolean) => (active ? "활성" : "비활성");

function snsLabel(link: string) {
  try {
    return new URL(link).hostname.replace(/^www\./, "");
  } catch {
    return link;
  }
}

/** 표의 모든 칸 글자를 하나로 모아 찾는다. 낱말마다 모두 들어 있어야 걸린다. */
function searchableText(m: Mentor) {
  return [
    activeLabel(m.active),
    m.realName,
    m.activityName,
    ...m.snsLinks,
    m.company,
    m.jobRole,
    m.desiredJobRoles,
    ...m.careers.map(formatCareer),
    ...m.documentPasses.map(formatDocumentPass),
    ...m.programs,
    m.note,
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
}

const HEADERS = [
  "활성화",
  "본명",
  "활동명",
  "SNS 계정",
  "현재 재직 기업",
  "직무",
  "멘토링 희망 직무",
  "재직 이력",
  "서류 합격 이력",
  "핵심 프로그램",
  "비고",
];

export function MentorsTable({ mentors }: { mentors: Mentor[] }) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const terms = deferredQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown =
    terms.length === 0
      ? mentors
      : mentors.filter((m) => {
          const text = searchableText(m);
          return terms.every((t) => text.includes(t));
        });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Icon
            name="search"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="표의 모든 칸에서 찾기"
            aria-label="멘토에서 찾기"
            className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-zinc-400"
          />
        </div>
        <span className="text-xs text-zinc-500">
          {terms.length > 0 ? `${shown.length}명 / 전체 ${mentors.length}명` : `${mentors.length}명`}
        </span>
      </div>

      <div className="w-0 min-w-full overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        {shown.length === 0 ? (
          <p className="py-12 text-center text-sm text-zinc-500">
            {mentors.length === 0 ? "등록된 멘토가 없습니다." : "조건에 맞는 멘토가 없습니다."}
          </p>
        ) : (
          <table className="w-full min-w-[90rem] text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs text-zinc-500">
              <tr>
                {HEADERS.map((h) => (
                  <th key={h} className="whitespace-nowrap px-4 py-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-zinc-700">
              {shown.map((m) => (
                <MentorRow key={m.mentorId} mentor={m} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function MentorRow({ mentor: m }: { mentor: Mentor }) {
  return (
    <tr className="align-top hover:bg-zinc-50">
      <td className="whitespace-nowrap px-4 py-3">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            m.active ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-500"
          }`}
        >
          {activeLabel(m.active)}
        </span>
      </td>
      <th scope="row" className="whitespace-nowrap px-4 py-3 font-medium text-zinc-900">
        {m.url ? (
          <a href={m.url} target="_blank" rel="noreferrer" title={m.url} className="underline underline-offset-2">
            {m.realName}
          </a>
        ) : (
          m.realName
        )}
      </th>
      <td className="whitespace-nowrap px-4 py-3">{m.activityName || "-"}</td>
      <td className="whitespace-nowrap px-4 py-3">
        {m.snsLinks.length === 0
          ? "-"
          : m.snsLinks.map((link) => (
              <a
                key={link}
                href={link}
                target="_blank"
                rel="noreferrer"
                title={link}
                className="block underline underline-offset-2"
              >
                {snsLabel(link)}
              </a>
            ))}
      </td>
      <td className="whitespace-nowrap px-4 py-3">{m.company || "-"}</td>
      <td className="whitespace-nowrap px-4 py-3">{m.jobRole || "-"}</td>
      <td className="min-w-36 break-words px-4 py-3">{m.desiredJobRoles || "-"}</td>
      <td className="min-w-52 px-4 py-3">
        <Lines lines={m.careers.map(formatCareer)} />
      </td>
      <td className="min-w-44 px-4 py-3">
        <Lines lines={m.documentPasses.map(formatDocumentPass)} />
      </td>
      <td className="min-w-64 px-4 py-3">{m.programs.length === 0 ? "-" : m.programs.join(" · ")}</td>
      <td className="min-w-40 whitespace-pre-wrap break-words px-4 py-3">{m.note || "-"}</td>
    </tr>
  );
}

function Lines({ lines }: { lines: string[] }) {
  const filled = lines.filter(Boolean);
  if (filled.length === 0) return "-";
  return filled.map((line, i) => (
    <p key={i} className="break-words [&:not(:last-child)]:mb-1">
      {line}
    </p>
  ));
}
