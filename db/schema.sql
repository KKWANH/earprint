-- Playlist Analyzer — DB 스키마 (Postgres 15+ / pgvector)
-- 적용: psql "$DATABASE_URL" -f db/schema.sql
--
-- 설계 원칙: 트랙 데이터는 전역 공유, 좋아요 관계는 사용자별.
-- 한 번 분석한 트랙은 모든 사용자가 재사용 → API 호출/컴퓨팅 절감.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- ── 사용자 ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         TEXT UNIQUE NOT NULL,
  display_name  TEXT,
  google_sub    TEXT UNIQUE,                       -- Google OAuth subject
  sync_token    TEXT UNIQUE,                       -- 확장 ↔ 백엔드 인증용 토큰 (Phase 1)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 트랙 (전역 공유 canonical) ────────────────────────
CREATE TABLE IF NOT EXISTS tracks (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mbid             TEXT UNIQUE,                    -- MusicBrainz Recording ID (canonical, nullable)
  title            TEXT NOT NULL,
  artist           TEXT NOT NULL,
  album            TEXT,
  duration_ms      INTEGER,
  isrc             TEXT,
  deezer_id        BIGINT,
  resolved         BOOLEAN NOT NULL DEFAULT false, -- 정규화/매칭 완료 여부
  match_confidence REAL,                           -- 0..1
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tracks_artist_title ON tracks (lower(artist), lower(title));

-- ── 트랙 소스 식별자 (한 트랙이 여러 플랫폼 ID 보유) ──
CREATE TABLE IF NOT EXISTS track_sources (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  track_id    UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  source      TEXT NOT NULL,                       -- 'ytmusic' | 'deezer' | 'itunes' ...
  source_id   TEXT NOT NULL,                       -- 예: YouTube videoId
  raw_title   TEXT,                                -- 정규화 전 원문 (디버깅/재매칭용)
  raw_artist  TEXT,
  UNIQUE (source, source_id)
);

-- ── 좋아요 관계 (사용자별) ────────────────────────────
CREATE TABLE IF NOT EXISTS user_tracks (
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  track_id    UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  source      TEXT NOT NULL DEFAULT 'ytmusic',
  liked_at    TIMESTAMPTZ,                         -- 플랫폼상 좋아요 시각 (알 수 있으면)
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, track_id)
);
CREATE INDEX IF NOT EXISTS idx_user_tracks_user ON user_tracks (user_id);

-- ── 특성 분석 결과 (버전 관리) ────────────────────────
CREATE TABLE IF NOT EXISTS analysis (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  track_id           UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  analysis_version   INTEGER NOT NULL DEFAULT 1,   -- 모델 개선 시 재분석
  -- 리듬 / 조성 (작곡 확장에 필요한 구조적 특성)
  bpm                REAL,
  music_key          TEXT,                         -- 'C', 'F#' ...
  music_scale        TEXT,                         -- 'major' | 'minor'
  time_signature     TEXT,
  -- 분류 (JSONB: label -> probability)
  genres             JSONB,                        -- {"rock": 0.7, "pop": 0.2}
  moods              JSONB,                        -- {"happy": 0.8, "relaxed": 0.3}
  instruments        JSONB,                        -- {"guitar": 0.9, "piano": 0.4}
  danceability       REAL,
  valence            REAL,
  arousal            REAL,
  voice_instrumental TEXT,                         -- 'voice' | 'instrumental'
  -- 메타
  confidence         JSONB,                        -- 필드별 신뢰도
  source_flags       JSONB,                        -- 필드별 출처 (api vs model)
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (track_id, analysis_version)
);

-- ── 오디오 임베딩 (music-map / 유사도 추천) ───────────
-- 차원은 모델에 맞춤. Discogs-EffNet = 1280.
CREATE TABLE IF NOT EXISTS embeddings (
  track_id   UUID PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
  model      TEXT NOT NULL,                        -- 'discogs-effnet' ...
  vector     vector(1280),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_embeddings_vector
  ON embeddings USING hnsw (vector vector_cosine_ops);

-- ── 취향 프로필 (추천 / 미래 작곡 conditioning) ───────
CREATE TABLE IF NOT EXISTS taste_profiles (
  user_id       UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  centroid      vector(1280),                      -- 좋아요 곡 평균 임베딩
  genre_dist    JSONB,
  mood_dist     JSONB,
  bpm_histogram JSONB,
  key_dist      JSONB,
  track_count   INTEGER NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 분석 작업 큐 추적 ─────────────────────────────────
CREATE TABLE IF NOT EXISTS analysis_jobs (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  track_id   UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'pending',      -- pending|running|done|failed
  attempts   INTEGER NOT NULL DEFAULT 0,
  error      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_status ON analysis_jobs (status);

-- ── Phase 1: 좋아요 동기화 (확장 → 백엔드) ────────────
-- 확장이 보낸 트랙 배열(jsonb)을 멱등하게 반영한다. 한 번의 호출 = 한 트랜잭션.
-- 입력 원소 키: videoId, title, artist, album, durationMs, likedAt
-- 정규화 전 단계라 videoId 1개당 tracks 1행을 만든다(resolved=false).
-- Phase 2 resolver 가 canonical 트랙으로 병합·정규화한다.
CREATE OR REPLACE FUNCTION sync_liked_tracks(p_user_id uuid, p_tracks jsonb)
RETURNS TABLE(new_tracks int, new_likes int, total int) AS $$
DECLARE
  rec        jsonb;
  v_track_id uuid;
BEGIN
  new_tracks := 0;
  new_likes  := 0;
  total      := 0;
  FOR rec IN SELECT jsonb_array_elements(p_tracks) LOOP
    total := total + 1;

    SELECT track_id INTO v_track_id
      FROM track_sources
      WHERE source = 'ytmusic' AND source_id = rec->>'videoId';

    IF v_track_id IS NULL THEN
      INSERT INTO tracks (title, artist, album, duration_ms)
        VALUES (rec->>'title',
                rec->>'artist',
                NULLIF(rec->>'album', ''),
                NULLIF(rec->>'durationMs', '')::int)
        RETURNING id INTO v_track_id;
      INSERT INTO track_sources (track_id, source, source_id, raw_title, raw_artist)
        VALUES (v_track_id, 'ytmusic', rec->>'videoId',
                rec->>'title', rec->>'artist');
      new_tracks := new_tracks + 1;
    END IF;

    INSERT INTO user_tracks (user_id, track_id, source, liked_at)
      VALUES (p_user_id, v_track_id, 'ytmusic',
              NULLIF(rec->>'likedAt', '')::timestamptz)
      ON CONFLICT (user_id, track_id) DO NOTHING;
    IF FOUND THEN
      new_likes := new_likes + 1;
    END IF;
  END LOOP;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- ── Phase 2: 마이그레이션 ─────────────────────────────
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS preview_url TEXT;  -- Deezer 30초 미리듣기

-- ── Phase 2: API 보강 결과 일괄 저장 ──────────────────
-- p_rows 원소 키: trackId, deezerId, album, previewUrl, bpm, genres, matchConfidence
CREATE OR REPLACE FUNCTION save_enrichments(p_rows jsonb)
RETURNS int AS $$
DECLARE
  rec jsonb;
  n   int := 0;
BEGIN
  FOR rec IN SELECT jsonb_array_elements(p_rows) LOOP
    UPDATE tracks SET
      deezer_id        = COALESCE(NULLIF(rec->>'deezerId', '')::bigint, deezer_id),
      album            = COALESCE(album, NULLIF(rec->>'album', '')),
      preview_url      = COALESCE(NULLIF(rec->>'previewUrl', ''), preview_url),
      resolved         = true,
      match_confidence = NULLIF(rec->>'matchConfidence', '')::real,
      updated_at       = now()
    WHERE id = (rec->>'trackId')::uuid;

    INSERT INTO analysis (track_id, analysis_version, bpm, genres, moods, source_flags)
    VALUES (
      (rec->>'trackId')::uuid, 1,
      NULLIF(rec->>'bpm', '')::real,
      CASE WHEN jsonb_typeof(rec->'genres') = 'object' THEN rec->'genres' ELSE NULL END,
      CASE WHEN jsonb_typeof(rec->'moods')  = 'object' THEN rec->'moods'  ELSE NULL END,
      '{"genres":"lastfm","moods":"lastfm","album":"deezer"}'::jsonb
    )
    ON CONFLICT (track_id, analysis_version) DO UPDATE SET
      bpm          = EXCLUDED.bpm,
      genres       = EXCLUDED.genres,
      moods        = EXCLUDED.moods,
      source_flags = EXCLUDED.source_flags;

    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$ LANGUAGE plpgsql;

-- ── 분석 제외 아티스트 (사용자별) ─────────────────────
-- 너무 옛날 아티스트 / 뮤비·모음 채널 등을 통계·분석에서 제외.
CREATE TABLE IF NOT EXISTS excluded_artists (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  artist     TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, artist)
);

-- ── taste_profiles: AI 생성 심리·취향 프로파일 ────────
ALTER TABLE taste_profiles ADD COLUMN IF NOT EXISTS ai_profile      jsonb;
ALTER TABLE taste_profiles ADD COLUMN IF NOT EXISTS ai_generated_at TIMESTAMPTZ;

-- ── Phase B: AI 보강 결과 저장 ────────────────────────
-- API 가 못 채운 곡을 Gemini 추론으로 보강. realArtist 가 있으면 원곡 아티스트로 재매핑.
-- p_rows 원소 키: trackId, genres, moods, realArtist, realTitle
CREATE OR REPLACE FUNCTION save_ai_enrichments(p_rows jsonb)
RETURNS int AS $$
DECLARE
  rec jsonb;
  n   int := 0;
BEGIN
  FOR rec IN SELECT jsonb_array_elements(p_rows) LOOP
    -- 뮤비/모음 채널 → 원곡 아티스트 재매핑
    IF NULLIF(rec->>'realArtist', '') IS NOT NULL THEN
      UPDATE tracks SET
        artist     = rec->>'realArtist',
        title      = COALESCE(NULLIF(rec->>'realTitle', ''), title),
        updated_at = now()
      WHERE id = (rec->>'trackId')::uuid;
    END IF;

    UPDATE analysis SET
      genres       = CASE WHEN jsonb_typeof(rec->'genres') = 'object'
                          THEN rec->'genres' ELSE '{}'::jsonb END,
      moods        = CASE WHEN jsonb_typeof(rec->'moods') = 'object'
                          THEN rec->'moods'  ELSE moods END,
      source_flags = '{"genres":"gemini","moods":"gemini"}'::jsonb
    WHERE track_id = (rec->>'trackId')::uuid AND analysis_version = 1;

    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$ LANGUAGE plpgsql;

-- ── Phase C: 추천 + 평가(이상형 월드컵) ───────────────
CREATE TABLE IF NOT EXISTS recommendations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  artist      TEXT NOT NULL,
  title       TEXT NOT NULL,
  album       TEXT,
  deezer_id   BIGINT,
  preview_url TEXT,
  seed_track  TEXT,                              -- 추천 근거: 어떤 좋아요 곡에서 파생
  rating      TEXT,                              -- NULL | 'like' | 'dislike' | 'pass'
  comment     TEXT,                              -- 주로 'dislike' 사유
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  rated_at    TIMESTAMPTZ,
  UNIQUE (user_id, artist, title)
);
CREATE INDEX IF NOT EXISTS idx_recommendations_unrated
  ON recommendations (user_id) WHERE rating IS NULL;

-- 추천 후보 일괄 저장. p_rows 키: artist, title, album, deezerId, previewUrl, seedTrack
CREATE OR REPLACE FUNCTION save_recommendations(p_user uuid, p_rows jsonb)
RETURNS int AS $$
DECLARE
  rec jsonb;
  n   int := 0;
BEGIN
  FOR rec IN SELECT jsonb_array_elements(p_rows) LOOP
    INSERT INTO recommendations (user_id, artist, title, album, deezer_id, preview_url, seed_track)
    VALUES (
      p_user, rec->>'artist', rec->>'title', NULLIF(rec->>'album', ''),
      NULLIF(rec->>'deezerId', '')::bigint,
      NULLIF(rec->>'previewUrl', ''), NULLIF(rec->>'seedTrack', '')
    )
    ON CONFLICT (user_id, artist, title) DO NOTHING;
    IF FOUND THEN n := n + 1; END IF;
  END LOOP;
  RETURN n;
END;
$$ LANGUAGE plpgsql;
