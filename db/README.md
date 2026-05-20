# DB

Postgres 15+ / pgvector 단일 DB로 관계형 + 벡터를 함께 다룬다.

```bash
psql "$DATABASE_URL" -f db/schema.sql
```

Phase 0 에서는 raw SQL 스키마만 둔다. 스키마가 안정화되면
마이그레이션 도구(예: `dbmate`, `drizzle-kit`) 도입을 검토한다.

## 테이블 개요

| 테이블 | 역할 |
|---|---|
| `users` | 사용자 (Google OAuth) |
| `tracks` | 전역 공유 canonical 트랙 |
| `track_sources` | 트랙별 외부 플랫폼 식별자 (YT videoId 등) |
| `user_tracks` | 사용자별 좋아요 관계 |
| `analysis` | 트랙별 특성 분석 결과 (버전 관리) |
| `embeddings` | 트랙별 오디오 임베딩 벡터 |
| `taste_profiles` | 사용자별 집계 취향 프로필 |
| `analysis_jobs` | 분석 작업 큐 추적 |
