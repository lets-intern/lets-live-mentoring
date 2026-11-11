// 임시 목업 데이터. 실제 DB/API 연결 시 이 파일을 대체한다.

export type SessionStatus = "예정" | "완료" | "취소" | "노쇼";

export const sessions = [
  { id: "S-1024", date: "2026-11-12 19:00", mentor: "김지훈", mentee: "이서연", topic: "PM 포트폴리오 리뷰", status: "예정" as SessionStatus },
  { id: "S-1023", date: "2026-11-11 20:00", mentor: "박민지", mentee: "최도윤", topic: "마케팅 직무 상담", status: "예정" as SessionStatus },
  { id: "S-1022", date: "2026-11-10 19:30", mentor: "김지훈", mentee: "정하은", topic: "면접 대비", status: "완료" as SessionStatus },
  { id: "S-1021", date: "2026-11-09 21:00", mentor: "오세진", mentee: "한유진", topic: "개발자 커리어", status: "노쇼" as SessionStatus },
  { id: "S-1020", date: "2026-11-08 18:00", mentor: "박민지", mentee: "윤재민", topic: "자소서 첨삭", status: "취소" as SessionStatus },
];
