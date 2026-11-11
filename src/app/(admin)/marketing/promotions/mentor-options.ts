import "server-only";
import { fetchMentors } from "@/lib/lets-operation";
import type { MentorOption } from "./promotion-form";

/** 멘토 DB 전체를 폼에서 쓸 가벼운 선택지로 바꾼다. 활성 멘토가 먼저 온다. */
export async function loadMentorOptions(): Promise<{ options: MentorOption[]; error?: string }> {
  const result = await fetchMentors();
  if (!result.ok) return { options: [], error: result.message };

  const options = result.mentors
    .map((m) => ({
      mentorId: m.mentorId,
      name: m.activityName ? `${m.realName}(${m.activityName})` : m.realName,
      detail: [m.company, m.jobRole].filter(Boolean).join(" · "),
      active: m.active,
    }))
    .sort((a, b) => Number(b.active) - Number(a.active));
  return { options };
}
