// 회사명·직무 비교용 정규화와 직무 동의어. 서버·브라우저 양쪽에서 쓴다.

/** 비교용 정규화: 소문자, 법인 표기·공백·기호 제거 */
export function normalize(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .replace(/\(주\)|㈜|주식회사|\(유\)|유한회사|\bco\.,?\s*ltd\b\.?|\b(?:inc|corp|ltd)\b\.?/g, "")
    .replace(/[\s\-_.,·•/\\|()[\]{}<>【】〈〉'"`~!@#$%^&*+=:;?]/g, "");
}

export type CompanyMatch = "exact" | "partial" | null;

/**
 * 회사 일치 정도.
 * - exact: 정규화 후 같거나, 멘토 쪽이 공고 회사를 포함 (예: 멘토 "삼성전자 DS부문" ⊇ 공고 "삼성전자")
 * - partial: 공고 회사가 멘토 회사를 포함 (예: 공고 "카카오뱅크" ⊇ 멘토 "카카오") → 계열사일 수 있어 절반만 인정
 */
export function companyMatch(postingCompany: string | null | undefined, mentorCompany: string | null | undefined): CompanyMatch {
  const p = normalize(postingCompany);
  const m = normalize(mentorCompany);
  if (p.length < 2 || m.length < 2) return null;
  if (p === m || m.includes(p)) return "exact";
  if (p.includes(m)) return "partial";
  return null;
}

/**
 * 직무 동의어 묶음. 같은 묶음에 걸리면 같은 직무로 본다.
 * 영문 3글자 이하 약어(pm, ux, hr 등)는 단어 단위로만 찾는다(부분 문자열 오탐 방지).
 * 필요하면 여기에 묶음을 추가한다.
 */
export const ROLE_GROUPS: { label: string; aliases: string[] }[] = [
  { label: "PM·서비스기획", aliases: ["pm", "po", "프로덕트매니저", "프로덕트오너", "productmanager", "productowner", "서비스기획", "프로덕트기획", "앱기획", "웹기획"] },
  { label: "백엔드", aliases: ["백엔드", "backend", "be", "서버개발", "서버엔지니어"] },
  { label: "프론트엔드", aliases: ["프론트엔드", "프론트", "frontend", "fe", "웹개발", "웹퍼블리셔"] },
  { label: "풀스택", aliases: ["풀스택", "fullstack"] },
  { label: "앱 개발", aliases: ["ios", "android", "안드로이드", "앱개발", "모바일개발", "flutter", "플러터"] },
  { label: "데이터 분석", aliases: ["데이터분석", "데이터애널리스트", "dataanalyst", "데이터사이언티스트", "datascientist", "데이터사이언스", "비즈니스애널리스트", "businessanalyst"] },
  { label: "데이터 엔지니어", aliases: ["데이터엔지니어", "dataengineer"] },
  { label: "AI·ML", aliases: ["ai", "ml", "머신러닝", "딥러닝", "인공지능", "machinelearning", "llm"] },
  { label: "디자인", aliases: ["디자이너", "디자인", "ux", "ui", "uxui", "uiux", "productdesigner", "프로덕트디자이너", "bx", "gui"] },
  { label: "마케팅", aliases: ["마케팅", "마케터", "marketing", "marketer", "그로스", "growth", "퍼포먼스", "crm", "브랜드매니저", "브랜딩"] },
  { label: "영업·사업개발", aliases: ["영업", "세일즈", "sales", "bd", "사업개발", "businessdevelopment", "기술영업", "해외영업"] },
  { label: "전략·사업기획", aliases: ["전략기획", "사업기획", "경영기획", "경영전략", "strategy", "사업전략"] },
  { label: "인사·HR", aliases: ["인사", "hr", "hrd", "hrm", "채용담당", "리크루터", "recruiter", "피플팀", "조직문화"] },
  { label: "재무·회계", aliases: ["재무", "회계", "finance", "세무", "ir", "fp&a", "자금", "accounting"] },
  { label: "MD·상품기획", aliases: ["md", "머천다이저", "상품기획", "바이어", "buyer"] },
  { label: "컨설팅", aliases: ["컨설턴트", "컨설팅", "consultant", "consulting"] },
  { label: "연구개발", aliases: ["연구개발", "r&d", "rnd", "연구원", "researcher"] },
  { label: "품질·생산", aliases: ["품질", "qa", "qc", "생산관리", "공정", "생산기술"] },
  { label: "SCM·구매", aliases: ["scm", "구매", "물류", "공급망", "purchasing"] },
  { label: "법무", aliases: ["법무", "legal", "변호사", "컴플라이언스", "compliance"] },
  { label: "콘텐츠·PR", aliases: ["콘텐츠", "에디터", "pr", "홍보", "커뮤니케이션"] },
];

/** 한글 별칭이 다른 단어의 일부로 쓰이는 경우 (예: "인사" ⊂ "인사이트") — 이 단어들을 지운 뒤 찾는다 */
const ALIAS_EXCLUDES: Record<string, string[]> = {
  인사: ["인사이트"],
  공정: ["공정거래"],
  구매: ["구매자", "구매전환", "구매율"],
  영업: ["영업이익", "영업일"],
  자금: ["자금조달"],
  디자인: ["시스템디자인", "디자인패턴"],
};

const isShortLatin = (alias: string) => /^[a-z&]{1,3}$/.test(alias);
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\&]/g, "\\$&");

/** 영문 약어는 영문·숫자 경계에서만 (예: "6pm", "npm" 안의 pm 은 제외) */
export function containsAlias(raw: string, alias: string): boolean {
  if (isShortLatin(alias)) {
    return new RegExp(`(^|[^a-z0-9])${escape(alias)}([^a-z0-9]|$)`).test(raw.toLowerCase());
  }
  let hay = normalize(raw);
  for (const ex of ALIAS_EXCLUDES[alias] ?? []) hay = hay.replaceAll(ex, " ");
  return hay.includes(normalize(alias));
}

/** 텍스트가 걸리는 직무 묶음 이름들 */
export function roleGroupsOf(value: string | null | undefined): string[] {
  if (!value) return [];
  return ROLE_GROUPS.filter((g) => g.aliases.some((a) => containsAlias(value, a))).map((g) => g.label);
}

/** 개발 직군 묶음. "SDK 개발자", "서비스 개발"처럼 세부 분야 없이 "개발"만 있는 직무는 이 중 하나와 일치로 본다. */
const DEV_GROUPS = new Set(["백엔드", "프론트엔드", "풀스택", "앱 개발", "AI·ML", "데이터 엔지니어"]);
/** "개발"이 들어가도 소프트웨어 개발이 아닌 직무 */
const NON_DEV_DEVELOPMENT = /사업개발|연구개발|상품개발|제품개발|교육개발|조직개발|콘텐츠개발|메뉴개발|신약개발|인재개발|businessdevelopment/g;
const DEV_WORD = /개발|developer|programmer|프로그래머|software|소프트웨어|sdk/;

/** 개발 직군인가: 개발 묶음(백엔드 등)에 걸리거나, 비개발 "○○개발"을 뺀 뒤 "개발" 류 단어가 남으면 */
function isDevRole(value: string): boolean {
  if (roleGroupsOf(value).some((g) => DEV_GROUPS.has(g))) return true;
  return DEV_WORD.test(normalize(value).replace(NON_DEV_DEVELOPMENT, ""));
}

/** 세부 분야 없이 "개발"만 있는 직무 (예: "SDK 개발자", "서비스 개발", "개발자") */
function isGenericDevRole(value: string): boolean {
  return roleGroupsOf(value).length === 0 && isDevRole(value);
}

/** 직무 비교 전에 빼는 일반 직함·수식어. 이것만으로 일치시키면 "인턴" 경력이 모든 인턴 공고에 걸린다. */
const GENERIC_ROLE_WORDS =
  /인턴십|인턴|체험형|전환형|매니저|사원|엔지니어링|엔지니어|개발자|개발|담당자|담당|신입|경력|직무|팀장|팀원|주니어|시니어|전문가|manager|engineering|engineer|developer|intern|specialist|junior|senior/g;

const roleCore = (value: string) => normalize(value).replace(GENERIC_ROLE_WORDS, "");

/**
 * 직무 일치: 같은 동의어 묶음에 속하거나, 일반 직함을 뺀 핵심어가 서로 포함 관계면 일치.
 * groupsOnly 면 동의어 묶음으로만 판단한다 (경력의 직함처럼 일반적인 값에 쓴다).
 */
export function roleMatches(
  postingRole: string | null | undefined,
  mentorRole: string | null | undefined,
  { groupsOnly = false } = {},
): boolean {
  if (!postingRole || !mentorRole) return false;
  const a = roleGroupsOf(postingRole);
  if (a.length > 0) {
    const b = new Set(roleGroupsOf(mentorRole));
    if (a.some((g) => b.has(g))) return true;
  }
  // 한쪽이 세부 분야 없는 "개발"이면 다른 쪽이 개발 직군이기만 하면 일치 (예: "SDK 개발자" ↔ "BE")
  if (
    (isGenericDevRole(postingRole) && isDevRole(mentorRole)) ||
    (isGenericDevRole(mentorRole) && isDevRole(postingRole))
  ) {
    return true;
  }
  if (groupsOnly) return false;
  const x = roleCore(postingRole);
  const y = roleCore(mentorRole);
  if (x.length < 2 || y.length < 2) return false;
  // 짧은 쪽이 긴 쪽의 절반 이상일 때만 (예: "인사" ⊂ "데이터인사이트분석" 같은 우연한 포함 제외)
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return long.includes(short) && short.length * 2 >= long.length;
}
