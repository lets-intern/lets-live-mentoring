// 붙여넣은 메시지를 공고 단위로 나누고 회사명·직무를 뽑는다. 규칙 기반이라 틀릴 수 있어
// 화면에서 운영자가 고칠 수 있게 하고, 나누기가 애매하면 공고 사이에 "---" 줄을 넣도록 안내한다.
import { containsAlias, normalize, ROLE_GROUPS } from "./text";

export type ParsedPosting = {
  title: string;
  company: string;
  jobRole: string;
  body: string;
};

/** 운영자가 직접 넣는 공고 구분선: --- 또는 === (3개 이상) */
const SEPARATOR = /^\s*(?:-{3,}|={3,})\s*$/;
/** 카카오톡 등에서 꾸밈용으로 쓰는 줄 (━━━, ───, ~~~, ***, ··· 등) — 무시한다 */
const DECORATION = /^\s*([━─_~*·•＝])\1{2,}\s*$/;

/** 새 공고의 시작으로 볼 수 있는 머리 표시 */
const HEADER_KINDS: RegExp[] = [
  /^\s*(?:\d{1,2}\s*[.)]|\(\d{1,2}\)|\[\d{1,2}\])\s*\S/, // 1. / 1) / (1) / [1]
  /^\s*[①-⑳]\s*\S/,
  /^\s*[【[][^\]】\d][^\]】]{0,30}[\]】]\s*\S/, // [회사] 직무
];

const HEADER_PREFIX =
  /^\s*(?:\d{1,2}\s*[.)]|\(\d{1,2}\)|\[\d{1,2}\]|[①-⑳]|[■□▶▷►◆◇●○★☆•\-*]|\p{Extended_Pictographic}\uFE0F?)\s*/u;

/** 줄 맨 앞의 기호·이모지 (■, 📍, ⚙️ 등) */
const LEADING_SYMBOL = /^\s*([■□▶▷►◆◇●○★☆]|\p{Extended_Pictographic})\uFE0F?\s*\S/u;
/** 공고 머리로 흔히 쓰는 기호. 이 밖의 기호(✅, ⚙️, 🔗 등)는 공고 안 항목에도 많이 써서 빈 줄 뒤에 올 때만 머리로 본다. */
const HEADER_SYMBOLS = new Set(["■", "□", "▶", "▷", "►", "◆", "◇", "●", "○", "★", "☆", "📌", "📍", "📢", "🔥", "💼", "🏢"]);
/** 제목·직무에서 지우는 이모지 */
const EMOJI = /[\p{Extended_Pictographic}\uFE0F\u200D]/gu;

/**
 * 기호·이모지로 시작하는 줄을 기호별로 모은다. 공고마다 "📍 제목 / ⚙️ 근무 형태 / 🔗 링크"처럼
 * 여러 기호를 섞어 쓰므로 기호마다 따로 본다.
 */
function symbolHeaderStarts(lines: string[]): number[][] {
  const bySymbol = new Map<string, number[]>();
  lines.forEach((l, i) => {
    const sym = l.match(LEADING_SYMBOL)?.[1];
    if (sym) bySymbol.set(sym, [...(bySymbol.get(sym) ?? []), i]);
  });
  return [...bySymbol.entries()]
    .filter(([sym, starts]) => HEADER_SYMBOLS.has(sym) || starts.every((i) => i === 0 || lines[i - 1].trim() === ""))
    .map(([, starts]) => starts);
}

function splitBlocks(text: string): string[] {
  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => (DECORATION.test(l) ? "" : l));

  // 1) 운영자가 넣은 구분선이 있으면 구분선으로만 나눈다
  if (lines.some((l) => SEPARATOR.test(l))) {
    const blocks: string[][] = [[]];
    for (const l of lines) {
      if (SEPARATOR.test(l)) blocks.push([]);
      else blocks[blocks.length - 1].push(l);
    }
    return blocks.map((b) => b.join("\n"));
  }

  // 2) 머리 표시가 2번 이상인 종류 중 "가장 먼저 나오는" 종류를 바깥 단위로 본다.
  //    (■ 공고 안의 "1. 자격요건" 같은 번호 목록에 끌려가지 않도록)
  let chosen: number[] | null = null;
  const candidates = [
    ...HEADER_KINDS.map((kind) => lines.flatMap((l, i) => (kind.test(l) ? [i] : []))),
    ...symbolHeaderStarts(lines),
  ];
  for (const starts of candidates) {
    if (starts.length >= 2 && (!chosen || starts[0] < chosen[0])) chosen = starts;
  }
  if (chosen) {
    // 첫 머리 앞 내용(인사말 등)은 공고가 아니므로 버린다
    const starts = chosen;
    return starts.map((s, idx) => lines.slice(s, starts[idx + 1] ?? lines.length).join("\n"));
  }

  // 3) 빈 줄로 나뉜 덩어리마다 공고
  return lines.join("\n").split(/\n\s*\n/);
}

const clean = (s: string) =>
  s
    .replace(/\s+/g, " ")
    .replace(/^[\s\-:|/·,]+|[\s\-:|/·,]+$/g, "")
    .trim();

/** 제목·직무에서 지우는 군더더기 (날짜, D-day, 채용/모집, 신입·경력·인턴 구분 등) */
const NOISE =
  /\(?\s*(?:~\s*)?\d{1,2}\s*[./월]\s*\d{1,2}\s*일?\s*(?:\([^)]*\))?\s*(?:까지|마감)?\s*\)?|(?<![a-z])d\s*-\s*\d+(?![0-9])|(?:찾|구|모시|채용합|모집합)습니다|채용\s*공고|채용(?!\s*담당)|공고|모집|마감\s*임박|상시|수시|\(?\s*(?:신입|경력|신입\s*\/\s*경력|경력무관|체험형|전환형|인턴십|인턴)\s*직?\s*\)?|\(주\)|㈜/gi;
/** 회사명을 뺀 뒤 앞에 남는 조사 */
const LEADING_PARTICLE = /^(?:에서|의|은|는|이|가|에)\s+/;

const LABELED_COMPANY = /(?:^|\n)\s*[-•*]?\s*(?:회사명?|기업명?|company)\s*[:：]\s*([^\n]+)/i;
const LABELED_ROLE =
  /(?:^|\n)\s*[-•*]?\s*(?:모집\s*(?:직무|분야|부문|포지션)|채용\s*(?:직무|분야|부문|포지션)|직무|포지션|position|role)\s*[:：]\s*([^\n]+)/i;
const BRACKET = /[【[〈<]([^\]】〉>]{1,30})[\]】〉>]/;
const BRACKET_NOT_COMPANY = /채용|공고|모집|마감|신입|경력|인턴|d-\d|^\d+$|추천|^(?:new|hot)$|급구/i;

/** 회사명 사전에서 빼는 일반 명칭 */
const GENERIC_COMPANY = /^(?:프리랜서|스타트업|대기업|중견기업|중소기업|외국계|공기업|공공기관|무관|없음|기타|미정|n\/a|-)$/i;

/** text 안에서 알려진 회사명을 찾는다. 가장 먼저 나오는 것(같은 위치면 긴 것)을 고른다. */
function findKnownCompany(text: string, knownCompanies: string[]): string {
  const lower = text.toLowerCase();
  const hay = normalize(text);
  let best = { name: "", pos: Infinity };
  for (const c of knownCompanies) {
    if (GENERIC_COMPANY.test(c.trim())) continue;
    let pos = -1;
    if (/^[a-z0-9&.\s]+$/i.test(c)) {
      // 영문 회사명은 단어 경계에서만 (task 안의 SK, algorithm 안의 LG 제외)
      const m = new RegExp(`(^|[^a-z0-9])${c.trim().toLowerCase().replace(/[.*+?^${}()|[\]\\&]/g, "\\$&")}([^a-z0-9]|$)`).exec(lower);
      if (m) pos = m.index;
    } else {
      const n = normalize(c);
      if (n.length >= 2) pos = hay.indexOf(n);
    }
    if (pos >= 0 && (pos < best.pos || (pos === best.pos && c.length > best.name.length))) best = { name: c.trim(), pos };
  }
  return best.name;
}

function findRoleGroup(text: string): string {
  return ROLE_GROUPS.find((g) => g.aliases.some((a) => containsAlias(text, a)))?.label ?? "";
}

function extract(block: string, knownCompanies: string[]): ParsedPosting {
  const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
  const title = clean((lines[0] ?? "").replace(HEADER_PREFIX, "").replace(EMOJI, ""));

  // 회사: 라벨 → 제목의 [대괄호] → 제목 속 알려진 회사명 → 제목 구분자 앞부분 → 제목 첫 단어 → 본문 속 알려진 회사명
  let company = clean(block.match(LABELED_COMPANY)?.[1] ?? "");
  const bracket = title.match(BRACKET);
  if (!company && bracket && !BRACKET_NOT_COMPANY.test(bracket[1].trim())) company = clean(bracket[1]);
  if (!company) company = findKnownCompany(title, knownCompanies);
  if (!company) {
    const head = title.split(/\s+[|/–-]\s+|\s*[|｜]\s*/)[0];
    if (head && head !== title && head.length <= 20) company = clean(head);
  }
  if (!company) {
    // "현대자동차 전략기획" 처럼 구분자 없이 "회사 직무" 인 짧은 제목: 나머지가 직무 사전에 걸리면 첫 단어를 회사로 본다
    const words = clean(title.replace(BRACKET, " ").replace(NOISE, " ")).split(/\s+/);
    const rest = words.slice(1).join(" ");
    if (words.length >= 2 && words.length <= 6 && words[0].length >= 2 && !findRoleGroup(words[0]) && findRoleGroup(rest)) {
      company = words[0];
    }
  }
  if (!company) company = findKnownCompany(lines.slice(1).join("\n"), knownCompanies);

  // 직무: 라벨 → 제목에서 회사·군더더기를 뺀 나머지 → 제목·본문 순으로 동의어 사전
  let jobRole = clean(block.match(LABELED_ROLE)?.[1] ?? "");
  if (!jobRole) {
    let rest = title.replace(BRACKET, " ");
    if (company) rest = rest.replace(company, " ");
    rest = clean(rest.replace(NOISE, " ").replace(/^[|/–-]+|[|/–-]+$/g, "")).replace(LEADING_PARTICLE, "");
    if (rest && rest.length <= 40) jobRole = rest;
  }
  if (!jobRole) jobRole = findRoleGroup(title) || findRoleGroup(block);

  return { title: title || company || "공고", company, jobRole, body: block.trim() };
}

/** 메시지 → 공고 목록. knownCompanies 는 회사명 추출 보조용(멘토 DB 회사명). */
export function parsePostings(text: string, knownCompanies: string[] = []): ParsedPosting[] {
  return splitBlocks(text)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b) => extract(b, knownCompanies));
}
