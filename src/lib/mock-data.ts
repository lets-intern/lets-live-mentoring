// 임시 목업 데이터. 실제 DB/API 연결 시 이 파일을 대체한다.

export type SessionStatus = "예정" | "완료" | "취소" | "노쇼";

export const sessions = [
  { id: "S-1024", date: "2026-11-12 19:00", mentor: "김지훈", mentee: "이서연", topic: "PM 포트폴리오 리뷰", status: "예정" as SessionStatus },
  { id: "S-1023", date: "2026-11-11 20:00", mentor: "박민지", mentee: "최도윤", topic: "마케팅 직무 상담", status: "예정" as SessionStatus },
  { id: "S-1022", date: "2026-11-10 19:30", mentor: "김지훈", mentee: "정하은", topic: "면접 대비", status: "완료" as SessionStatus },
  { id: "S-1021", date: "2026-11-09 21:00", mentor: "오세진", mentee: "한유진", topic: "개발자 커리어", status: "노쇼" as SessionStatus },
  { id: "S-1020", date: "2026-11-08 18:00", mentor: "박민지", mentee: "윤재민", topic: "자소서 첨삭", status: "취소" as SessionStatus },
];

export const mentors = [
  { id: "M-01", name: "김지훈", field: "PM/기획", company: "IT 스타트업", sessions: 18, rating: 4.9, status: "활동중" },
  { id: "M-02", name: "박민지", field: "마케팅", company: "커머스", sessions: 12, rating: 4.8, status: "활동중" },
  { id: "M-03", name: "오세진", field: "개발", company: "플랫폼 대기업", sessions: 7, rating: 4.7, status: "휴면" },
];

export const mentees = [
  { id: "U-301", name: "이서연", email: "seoyeon@example.com", joined: "2026-10-28", sessions: 2 },
  { id: "U-302", name: "최도윤", email: "doyun@example.com", joined: "2026-11-01", sessions: 1 },
  { id: "U-303", name: "정하은", email: "haeun@example.com", joined: "2026-10-15", sessions: 3 },
  { id: "U-304", name: "한유진", email: "yujin@example.com", joined: "2026-11-03", sessions: 1 },
];
