# 1:1 LIVE 멘토링 Admin

1:1 LIVE 멘토링 서비스 운영용 어드민 (Next.js 15 App Router + Tailwind).

## 실행

```bash
cp .env.example .env.local   # ADMIN_PASSWORD, ADMIN_SESSION_SECRET 입력
npm install
npm run dev                   # http://localhost:3000
```

## 로그인 방식
- 운영팀(3~5명)이 **하나의 공용 비밀번호**(`ADMIN_PASSWORD`)로 로그인합니다.
- 로그인 성공 시 서명된 httpOnly 쿠키(7일 유효)를 발급하고, `src/middleware.ts`가 모든 페이지를 보호합니다.
- 비밀번호를 바꾸려면 환경변수를 수정하고 서버를 재시작하면 됩니다. `ADMIN_SESSION_SECRET`을 바꾸면 기존 로그인이 모두 풀립니다.

## 구조
```
src/
  middleware.ts            # 미로그인 시 /login 리다이렉트
  lib/auth.ts              # 비밀번호 확인 / 세션 토큰 서명·검증
  lib/mock-data.ts         # 임시 데이터 (DB 연결 시 교체)
  components/              # 사이드바, 공통 UI
  app/login/               # 로그인 페이지 + 서버 액션
  app/(admin)/             # 로그인 후 영역
    page.tsx               # 대시보드
    sessions/ mentors/ mentees/ settings/
```
