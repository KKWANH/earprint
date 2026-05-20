# Playlist Analyzer

YouTube Music 의 "좋아요" 곡을 추출해 **음악 특성(장르·무드)을 분석**하고,
**AI 음악 심리분석**과 **곡 추천(평가형)** 을 제공하는 웹 서비스 + 크롬 확장.

> 데모: `https://playlist-analyzer-web.kwanho0096.workers.dev`
> (Google OAuth 테스트 모드 — 셀프호스팅 시 본인 계정으로 사용)

설계 배경·의사결정은 [ARCHITECTURE.md](./ARCHITECTURE.md), 배포는 [DEPLOY.md](./DEPLOY.md) 참고.

---

## 지원 현황

| 음악 서비스 | 지원 | 비고 |
|---|---|---|
| **YouTube Music** | ✅ | 크롬 확장으로 "좋아요(LM)" 곡 수집 |
| Spotify | ❌ | 미지원 |
| Apple Music | ❌ | 미지원 |

YouTube Music 은 공식 API 가 없어, 크롬 확장이 사용자 본인 세션에서 내부
`youtubei` 응답을 가로채 좋아요 목록을 수집한다. (개인·교육용 도구)

## 기능 — 개발 현황

| 단계 | 기능 | 상태 |
|---|---|---|
| 1 | 크롬 확장 — 좋아요 곡 수집 → 백엔드 저장 | ✅ |
| 2 | 트랙 보강 — Deezer(앨범·미리듣기) + Last.fm(장르·무드 태그) | ✅ |
| B | AI 보강 폴백 — 빈 곡을 Gemini 로 추론, 뮤비/모음 채널은 원곡 아티스트 재매핑 | ✅ |
| 1 | 통계 대시보드 — 최다 아티스트·장르·무드 분포, 아티스트 제외 기능 | ✅ |
| A | AI 음악 심리분석 — Gemini 가 성격·취향·디깅 점수·취향 보강 가이드 생성 | ✅ |
| C | 추천 — 유사곡 추천 → 미리듣기 → 좋아요/별로/코멘트 평가, 피드백 반영 | ✅ |
| — | 어드민 — 앱 통계 (관리자 전용) | ✅ |
| D | 청취 history 수집 (좋아요 외 재생 기록) | ⛔ 미구현 |
| 3 | BPM·음향 특성(MIR) — Essentia 자체 분석 | ⛔ 미구현 (우선순위 하) |
| 4 | music-map — 임베딩 기반 취향 2D 시각화 | ⛔ 미구현 (MIR 의존) |

### 한계
- **BPM 분석 없음** — Deezer 의 BPM 데이터가 희박해 보류. 정확한 BPM 은 Essentia MIR
  (별도 Python 서비스)이 필요하며 우선순위가 낮아 미구현.
- **장르 커버리지** — Last.fm + Gemini 조합으로도 일부 비주류 곡은 장르가 빌 수 있음.
- **추천 재생** — 전곡이 아닌 Deezer 30초 미리듣기 + YouTube Music 링크.

## 아키텍처

```
크롬 확장(MV3)  →  웹앱 + API (Next.js / Cloudflare Workers)  →  Postgres(Neon)
  좋아요 수집         인증·분석·추천·대시보드                     좋아요·분석·추천
                            │
                  외부 API: Deezer · Last.fm · Gemini
```

전부 **서버리스** — Cloudflare Workers 위에서 동작하며 상시 가동 서버가 없다.
AI 는 Google Gemini 의 호스팅 API 를 호출할 뿐 자체 모델을 돌리지 않는다.

## 기술 스택

- **확장**: Manifest V3, TypeScript, Vite + CRXJS
- **웹앱/API**: Next.js (App Router), TypeScript, Tailwind, Auth.js (Google OAuth)
- **호스팅**: Cloudflare Workers (OpenNext 어댑터)
- **DB**: Postgres + pgvector (Neon)
- **외부 API**: Deezer(무인증) · Last.fm · Google Gemini
- **모노레포**: pnpm workspaces + Turborepo

## 셀프호스팅

1. Neon Postgres 생성 → `psql`/스크립트로 `db/schema.sql` 적용
2. 본인 키 발급: Google OAuth · Last.fm API · Google Gemini API
3. `apps/web` 를 Cloudflare Workers 에 배포 (`pnpm run deploy`), 시크릿 등록
4. `apps/extension` 빌드 후 크롬에 압축해제 로드

상세 절차는 [DEPLOY.md](./DEPLOY.md). 셀프호스터는 **각자의 API 키**를 사용한다.

## 라이선스

MIT
