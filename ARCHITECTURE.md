# Playlist Analyzer — 아키텍처 설계서

> 유튜브 뮤직 "좋아요" 곡을 추출해 음악 특성(BPM/Genre/Mood/Singer/Instrument)을
> 분석하고, music-map 시각화 + 곡 추천을 제공하는 공개 서비스.
> 장기적으로 라이선스 기반 작곡(생성) 모듈로 확장.
>
> _최종 갱신: 2026-05-20 (시장조사 반영)_

---

## 0. 결정된 전제

| 항목 | 결정 |
|---|---|
| 제품 형태 | 백엔드 중심 하이브리드 (얇은 크롬 확장 + 웹앱 + Python 분석 서비스) |
| 분석 깊이 | 외부 API 조합 + 자체 MIR(ML) 모델 |
| 사용 범위 | 공개 서비스 (멀티유저, 인증, rate-limit 대응 필요) |
| 확장 목표 | 취향 프로필 기반 작곡 — **자체 모델 학습 금지, 라이선스 생성 API 연동** |

### 제품 포지셔닝 (시장조사 반영)

4개 기능을 동등하게 두지 않는다. 시장조사 결과 무게중심을 다음과 같이 둔다:

- **핵심 wedge** — "유튜브 뮤직 취향 분석기 + music-map". 시장의 진짜 빈틈.
- **추천** — 헤드라인이 아닌 *하나의 기능*. (추천 전용 시장은 쇠퇴 중)
- **작곡** — 차별화 add-on. 자체 생성 모델이 아닌 **라이선스된 생성 API** 연동.

---

## 1. 기술적 현실 (설계를 좌우하는 제약)

- **유튜브 뮤직 공식 API 없음.** "좋아요" 곡은 내부 `LM` 플레이리스트에 존재 → 확장이
  `music.youtube.com`에서 내부 `youtubei/v1/browse` 응답을 가로채(또는 DOM 파싱) 수집.
- **Spotify Audio Features API는 2024-11-27 신규 앱 대상 폐지** (Audio Features/Analysis/
  Recommendations/Related Artists/Featured Playlists). 공식 대체 없음 → 의존 불가.
- **Deezer API**: 무료/무인증, `bpm`·장르·30초 미리듣기 MP3 제공. 핵심 보강 소스.
- **Last.fm API**: 장르/무드 크라우드 태그, 유사곡, 청취 통계.
- **MusicBrainz**: 정규 메타데이터 + 악기/연주자 크레딧(relationship) — Singer/Instrument에 유용. (1 req/s 제한)
- **iTunes Search API**: 미리듣기 폴백 소스.
- "한 방에 특성을 주는 API"는 없음 → **여러 소스를 매칭·보강하는 파이프라인**이 설계의 핵심.

### 법적/ToS 주의 (공개 서비스라 중요)
- YT Music 스크래핑은 ToS 그레이존. 확장이 **사용자 본인 세션에서 본인 데이터**에 접근하는
  방식이 그나마 위험이 가장 낮음 → 서버 측 대량 스크래핑 금지.
- 미리듣기 오디오는 **분석 후 즉시 폐기**, 추출된 특성·임베딩만 저장. (ToS 리스크 ↓, 저장비 ↓)
- 작곡 모듈은 자체 모델 학습 시 저작권 소송 리스크(RIAA v. Suno/Udio 진행 중) → **라이선스 생성 API만 사용**.

---

## 2. 시장 분석 요약 (2026-05 조사)

### 경쟁 지형

| 영역 | 대표 서비스 | 포화도 |
|---|---|---|
| 취향 시각화 (Spotify Top-N) | stats.fm, Obscurify, Receiptify, Instafest | 포화 |
| 곡별 오디오 분석 (단건 조회) | Tunebat, Songdata.io, Cyanite(B2B) | 중간 |
| 플레이리스트 이전 | TuneMyMusic, Soundiiz, FreeYourMusic | 포화 (분석 아님) |
| 추천 전용 서비스 | Gnoosic, Spotalike, Moodagent(B2C 중단) | 쇠퇴 |
| AI 작곡 | Suno, Udio | 생성 레이어 포화 |

### 확인된 빈틈 (whitespace)
1. **YT Music + 오디오 레벨 분석은 거의 무주공산.** 진지한 분석/시각화 도구는 전부 Spotify 우선.
   YT Music 도구는 이전 유틸 아니면 기초 Top-list뿐.
2. **개인 라이브러리 임베딩 맵이 제품화 안 됨.** GitHub 토이/1인 사이드 프로젝트(Spotiverse)로만 존재.
3. **취향 조건부 AI 작곡은 부재.** Suno "My Taste"는 앱 내 이력만 학습, 외부 라이브러리 조건화 불가.
4. **Spotify API 폐지가 경쟁장을 비움.** 자체 오디오 분석 파이프라인 보유 = 새로 생긴 해자.

### 리스크 (→ 9장 상세)
- 이 분야 "서비스 무덤": Every Noise(2023 동결), AcousticBrainz(2022 중단), Moodagent B2C(2022 중단).
  공통점 = 플랫폼 데이터/호의 의존 → **자체 분석 파이프라인 보유가 생존 조건.**
- 플랫폼 사업자 경쟁: YT Music 2025 Recap에 대화형 AI 취향 분석 내장·무료.

---

## 3. 시스템 구성도

```
┌────────────────────┐
│  Capture Extension │  music.youtube.com에서 LM 플레이리스트 가로채기 → 정규화 → 백엔드 전송
│  (MV3, TypeScript) │
└─────────┬──────────┘
          │ HTTPS (사용자 토큰)
┌─────────▼──────────┐      ┌──────────────────┐
│   Web App / BFF    │◄────►│   Postgres        │ users, tracks, user_tracks,
│  (Next.js, TS)     │      │   + pgvector      │ analysis, embeddings, taste_profiles
│  인증·대시보드·    │      └──────────────────┘
│  music-map·추천 UI │      ┌──────────────────┐
└─────────┬──────────┘      │   Redis          │ 큐 / rate-limit 예산 / 캐시
          │ 분석 요청(enqueue)└────────┬─────────┘
┌─────────▼──────────────────────────▼─────────┐   ┌─────────────────┐
│        Analysis Service (Python/FastAPI)      │──►│  Object Storage │
│  Track Resolver → API Enricher → MIR Workers  │   │  (R2): 모델·산출물│
└───────────────────────────────────────────────┘   └─────────────────┘
          │ 외부 호출 (rate-limited)
   Deezer · Last.fm · MusicBrainz · iTunes
```

### 핵심 데이터 원칙
**트랙 데이터는 전역 공유, 좋아요 관계는 사용자별.**
한 번 분석한 트랙은 모든 사용자가 재사용 → 공개 서비스에서 API 호출/컴퓨팅 대폭 절감.
- `tracks` : 정규 트랙 (canonical key = MusicBrainz Recording ID 우선)
- `user_tracks` : (user_id, track_id, source, liked_at) — 사용자별 좋아요
- `analysis` : track_id별 특성 결과 + `analysis_version` (모델 개선 시 재분석)
- `embeddings` : track_id별 오디오 임베딩 벡터 (pgvector)
- `taste_profiles` : user_id별 집계 취향 벡터 + 분포 (추천·미래 작곡의 conditioning 입력)

---

## 4. 컴포넌트별 책임

### 4.1 Capture Extension (Manifest V3, TypeScript)
- 의도적으로 **얇게**, 교체 가능하게. 수집 외 로직 없음.
- `youtubei/v1/browse` 응답 가로채기(주) + DOM 파싱(폴백)으로 LM 목록 추출.
- title/artist/album/videoId/duration 정규화 → 백엔드로 전송.
- 증분 동기화(이미 보낸 곡 스킵).

### 4.2 Web App / BFF (Next.js App Router, TypeScript)
- 인증(Google OAuth, Auth.js), 라이브러리 브라우저, music-map, 추천 UI.
- 분석 작업 enqueue, 진행 상태 표시.
- 초기엔 Next route handler가 BFF 겸함. 부하 커지면 별도 Node 서비스로 분리.

### 4.3 Analysis Service (Python, FastAPI + 워커)
파이프라인 (트랙당):
1. **Resolve/정규화** — "artist - title"로 Deezer + MusicBrainz 검색, 퍼지 매칭 → MBID 부여.
2. **API 보강** — Deezer(장르·bpm·gain·preview), Last.fm(무드/장르 태그·유사곡), MusicBrainz(악기/연주자 크레딧).
3. **오디오 확보** — 30초 미리듣기 MP3 (Deezer 주, iTunes 폴백). 임시 처리.
4. **MIR 추론** (Essentia + librosa, CPU로 충분):
   - BPM/tempo (Deezer 값과 교차검증)
   - **Key/Scale** (작곡 확장에 필수 — 지금부터 저장)
   - Mood (mood_happy/sad/aggressive/relaxed/party, valence·arousal)
   - Genre (Discogs-EffNet 임베딩 → 장르 분류기)
   - Danceability, Voice/Instrumental
   - Instrument 멀티라벨 (MTG-Jamendo instrument 모델)
   - **임베딩 벡터** (Discogs-EffNet / MusiCNN) — music-map·유사도의 핵심
5. **특성 융합** — API 신호 + 모델 출력을 정규화, 필드별 confidence 부여.
6. 오디오 폐기, 특성·임베딩만 DB 저장.

### 4.4 Job Queue + Workers
- 분석은 느림(다운로드+추론) → 전부 비동기. Redis + RQ/Celery.
- MusicBrainz 1 req/s 등 외부 rate-limit을 Redis 토큰버킷으로 전역 관리.

### 4.5 데이터 스토어
- **Postgres + pgvector** — 관계형 + 벡터를 한 DB로 (Supabase/Neon). 단순함 우선.
- **Cloudflare R2** — 모델 아티팩트, 생성된 맵 이미지 등.
- **Redis** — 큐, rate-limit 예산, 중복제거 캐시.

---

## 5. Music-map

- 사용자 좋아요 곡들의 임베딩 → **UMAP**으로 2D 좌표화.
- **HDBSCAN**으로 취향 클러스터 탐지.
- 인터랙티브 2D 맵(deck.gl / regl-scatterplot): 점 = 곡, 색 = 클러스터/장르/무드,
  호버 시 미리듣기 재생.
- 개인 맵 + (멀티유저 축적 후) 전역 맵.

---

## 6. 추천 엔진

1. **콘텐츠 기반** — pgvector 코사인 최근접 이웃 + BPM/무드/장르 재랭킹.
   콜드스타트에 강하고 설명 가능("좋아한 X와 무드·BPM 유사").
2. **협업 신호** — Last.fm `track.getSimilar` + (유저 축적 후) 라이브러리 동시출현.
3. **하이브리드 재랭커** — 점수 혼합 + 사용자 컨트롤("더 신나게", "비슷하지만 새 장르").
4. **신곡 후보 소싱** — Last.fm 유사곡 / Deezer 차트를 매칭 장르 내에서 수집 →
   동일 파이프라인으로 분석 후 추천.

> 주의: music-map(2D)은 *시각화 전용*. 추천 점수는 2D 좌표가 아니라
> 원본 임베딩(고차원)에서 계산한다 — 2D는 정보 손실로 추천에 부적합.

### 6.1 추천 근거(explainability) — 1급 기능

추천마다 "왜 이 곡인가"를 데이터로 남기고 UI로 보여준다. 경쟁작 대비 차별점.

- **근거 데이터** — 추천 결과에 기여 요인을 함께 저장:
  - 가장 가까운 좋아요 곡 top-N (앵커곡) + 각 유사도
  - 특성별 일치도 (무드/BPM/장르/key)
  - 점수 분해 (콘텐츠 유사도 vs Last.fm 협업 신호 비중)
- **시각화** —
  - music-map 위에 추천곡을 점으로 찍고, 앵커곡들과 연결선 표시
  - 앵커곡 vs 추천곡 특성 비교 레이더/바 차트
  - 점수 기여도 분해 막대
  - 자연어 한 줄 ("좋아한 〈A〉·〈B〉와 무드 0.9 유사, BPM 124≈128, 같은 시티팝")

---

## 7. 작곡 확장을 위한 선설계 (지금 해둘 것)

미래에 재설계 없이 생성 모듈을 붙이기 위해:
- **구조적/심볼릭 특성 지금부터 저장** — key, scale, tempo, time signature, (가능하면)
  코드 진행 추정. 오디오 임베딩만으로는 작곡이 안 됨.
- **취향 프로필을 1급 엔티티로** — 사용자별 집계 벡터 + 장르/무드/key/BPM 분포.
  생성 모듈이 이를 conditioning 입력으로 소비.
- **버전된 특성 스키마** — `analysis_version`으로 더 나은 모델 재분석 허용.
- **서비스 경계 분리** — 미래 `generation-service`가 `analysis-service`의 형제로,
  같은 트랙/특성 DB·큐 인프라를 공유하도록.
- **생성 백엔드는 라이선스 API** — 자체 모델 학습은 저작권 소송 리스크(RIAA v. Suno/Udio).
  라이선스된 생성 API(예: 합의 완료된 Suno/Udio 상용 API)를 어댑터 패턴으로 연동.
- 모노레포 + 명확한 서비스 경계 → 생성 모듈 추가가 가산적(additive).

---

## 8. 기술 스택 (추천 확정안)

| 영역 | 선택 |
|---|---|
| 저장소 구조 | 모노레포 (pnpm workspaces + Turborepo, Python 패키지 별도) |
| 확장 | Manifest V3, TypeScript, Vite + CRXJS |
| 웹앱/BFF | Next.js (App Router), TypeScript, Tailwind, Auth.js |
| 분석 서비스 | Python 3.11+, FastAPI, essentia-tensorflow, librosa |
| 큐/워커 | Redis + RQ (또는 Celery) |
| DB | Postgres + pgvector (Supabase 또는 Neon) |
| 오브젝트 스토리지 | Cloudflare R2 |
| 호스팅 | 웹앱: Vercel / 분석서비스: 컨테이너 호스트(Fly.io·Railway·Render, GPU 불필요) |
| 인증 | Google OAuth (Auth.js) |

---

## 9. 단계별 로드맵

| Phase | 내용 | 산출물 |
|---|---|---|
| 0 | 모노레포·DB 스키마·인증 골격 | 빈 골격 + 배포 파이프 |
| 1 | 확장이 LM 목록 가로채 → 백엔드 저장 | 좋아요 원본 수집 동작 |
| 2 | 트랙 정규화 + API 메타데이터 보강 (ML 전) | 장르/BPM 있는 라이브러리 뷰 |
| 3 | MIR 워커 + Essentia 모델 + 임베딩 → pgvector | 정밀 특성 분석 |
| 4 | UMAP + HDBSCAN + 인터랙티브 music-map | **핵심 wedge 출시** |
| 5 | 콘텐츠 기반 + Last.fm 하이브리드 추천 | 추천 (기능으로) |
| 6 | 공개 서비스 다듬기 (온보딩, rate-limit 강화, 필요시 과금) | 공개 출시 |
| 7 | 작곡 모듈 — 취향 프로필을 라이선스 생성 API에 전달하는 generation-service | 생성 add-on |

각 Phase가 독립적으로 가치를 출시함. **Phase 4(music-map)가 시장 진입 지점.**

---

## 10. 주요 리스크

| 리스크 | 대응 |
|---|---|
| YT Music 내부 API 변경/ToS | 확장을 얇게·교체 가능하게, DOM 파싱 폴백, 본인 세션 수집만 |
| 트랙 매칭 실패(리믹스/라이브/표기 차이) | 퍼지 매칭 + confidence + 수동 보정 UI |
| 외부 API rate-limit | 전역 트랙 캐시 + Redis 토큰버킷 + 큐 |
| Essentia 모델 정확도 | confidence 부여, API 신호와 교차검증, `analysis_version` 재분석 |
| 미리듣기 오디오 ToS | 분석 후 즉시 폐기, 특성만 저장 |
| 플랫폼 사업자 경쟁 (YT Music 2025 Recap) | 구글 내장 기능보다 명백히 더 시각적·실행가능하게 (music-map) |
| 작곡 저작권 소송 (RIAA v. Suno/Udio) | 자체 모델 학습 금지, 라이선스 생성 API만 어댑터로 연동 |
| "서비스 무덤" 패턴 (플랫폼 데이터 의존) | 자체 분석 파이프라인·자체 DB 보유로 플랫폼 독립성 확보 |
