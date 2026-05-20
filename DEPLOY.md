# 임시 배포 가이드 (Phase 1)

웹앱을 **Cloudflare Workers**(OpenNext 어댑터)에, DB는 **Neon**(서버리스 Postgres)에 둔다.
분석 서비스(Python)는 Phase 3 전까지 배포하지 않는다.

## 1. 데이터베이스 — Neon

1. <https://neon.tech> 에서 프로젝트 생성 → 연결 문자열(`DATABASE_URL`) 확보.
2. 스키마 적용:
   ```bash
   psql "$DATABASE_URL" -f db/schema.sql
   ```
   `vector` / `uuid-ossp` 확장이 자동 생성된다 (Neon 은 pgvector 지원).

## 2. Google OAuth

1. Google Cloud Console → 사용자 인증 정보 → OAuth 클라이언트 ID(웹 애플리케이션).
2. **승인된 리디렉션 URI** 에 추가 (배포 URL 확정 후 — 4단계 뒤 다시 등록):
   - `https://<worker-url>/api/auth/callback/google`
   - 로컬: `http://localhost:3000/api/auth/callback/google`
3. 클라이언트 ID / 시크릿 → `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`.

## 3. Cloudflare 배포

```bash
cd apps/web
pnpm install
npx wrangler login

# 첫 배포 — 워커 URL 확인용
pnpm deploy
# → https://playlist-analyzer-web.<계정서브도메인>.workers.dev
```

확정된 URL 로 마무리:

1. `apps/web/wrangler.jsonc` 의 `vars.AUTH_URL` 을 실제 워커 URL 로 수정.
2. 2단계 Google 리디렉션 URI 에 `https://<worker-url>/api/auth/callback/google` 등록.
3. 시크릿 등록:
   ```bash
   npx wrangler secret put DATABASE_URL
   npx wrangler secret put AUTH_SECRET          # openssl rand -base64 32
   npx wrangler secret put AUTH_GOOGLE_ID
   npx wrangler secret put AUTH_GOOGLE_SECRET
   ```
4. 재배포: `pnpm deploy`

> 로컬 미리보기: `cp .dev.vars.example .dev.vars` 후 값 채우고 `pnpm preview`.

## 4. 확장 로드

```bash
cd apps/extension
pnpm install
pnpm build          # dist/ 생성
```

크롬 → `chrome://extensions` → 개발자 모드 → "압축해제된 확장 프로그램 로드"
→ `apps/extension/dist` 선택.

확장 팝업에서:
- **백엔드 URL** = 배포된 워커 URL
- **동기화 토큰** = 웹앱 `/connect` 페이지에서 발급된 값

## 배포 후 흐름

1. 워커 URL 접속 → Google 로그인 → `/connect` 에서 토큰 복사.
2. 확장 팝업에 URL · 토큰 입력 후 저장.
3. `music.youtube.com/playlist?list=LM` (좋아요 곡) 페이지 열기.
4. 확장 팝업 → "좋아요 동기화" → `/connect` 새로고침으로 결과 확인.
