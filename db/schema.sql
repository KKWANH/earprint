-- Playlist Analyzer — DB schema (Postgres 15+ / pgvector)
-- Apply: psql "$DATABASE_URL" -f db/schema.sql
--
-- Design principle: track data is globally shared, like relationships are per-user.
-- A track analyzed once is reused by all users → saves API calls / compute.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- ── Users ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         TEXT UNIQUE NOT NULL,
  display_name  TEXT,
  google_sub    TEXT UNIQUE,                       -- Google OAuth subject
  sync_token    TEXT UNIQUE,                       -- token for extension ↔ backend auth (Phase 1)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Tracks (globally shared canonical) ────────────────
CREATE TABLE IF NOT EXISTS tracks (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mbid             TEXT UNIQUE,                    -- MusicBrainz Recording ID (canonical, nullable)
  title            TEXT NOT NULL,
  artist           TEXT NOT NULL,
  album            TEXT,
  duration_ms      INTEGER,
  isrc             TEXT,
  deezer_id        BIGINT,
  resolved         BOOLEAN NOT NULL DEFAULT false, -- whether normalization/matching is done
  match_confidence REAL,                           -- 0..1
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tracks_artist_title ON tracks (lower(artist), lower(title));

-- ── Track source identifiers (one track can hold multiple platform IDs) ──
CREATE TABLE IF NOT EXISTS track_sources (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  track_id    UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  source      TEXT NOT NULL,                       -- 'ytmusic' | 'deezer' | 'itunes' ...
  source_id   TEXT NOT NULL,                       -- e.g. YouTube videoId
  raw_title   TEXT,                                -- original text before normalization (for debugging/rematching)
  raw_artist  TEXT,
  UNIQUE (source, source_id)
);

-- ── Like relationships (per-user) ─────────────────────
CREATE TABLE IF NOT EXISTS user_tracks (
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  track_id    UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  source      TEXT NOT NULL DEFAULT 'ytmusic',
  liked_at    TIMESTAMPTZ,                         -- like time on the platform (if known)
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, track_id)
);
CREATE INDEX IF NOT EXISTS idx_user_tracks_user ON user_tracks (user_id);

-- ── Feature analysis results (versioned) ──────────────
CREATE TABLE IF NOT EXISTS analysis (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  track_id           UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  analysis_version   INTEGER NOT NULL DEFAULT 1,   -- re-analysis when the model improves
  -- Rhythm / tonality (structural features needed for composition extensions)
  bpm                REAL,
  music_key          TEXT,                         -- 'C', 'F#' ...
  music_scale        TEXT,                         -- 'major' | 'minor'
  time_signature     TEXT,
  -- Classification (JSONB: label -> probability)
  genres             JSONB,                        -- {"rock": 0.7, "pop": 0.2}
  moods              JSONB,                        -- {"happy": 0.8, "relaxed": 0.3}
  instruments        JSONB,                        -- {"guitar": 0.9, "piano": 0.4}
  danceability       REAL,
  valence            REAL,
  arousal            REAL,
  voice_instrumental TEXT,                         -- 'voice' | 'instrumental'
  -- Meta
  confidence         JSONB,                        -- per-field confidence
  source_flags       JSONB,                        -- per-field source (api vs model)
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (track_id, analysis_version)
);

-- ── Audio embeddings (music-map / similarity recommendations) ──
-- Dimension matches the model. Discogs-EffNet = 1280.
CREATE TABLE IF NOT EXISTS embeddings (
  track_id   UUID PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
  model      TEXT NOT NULL,                        -- 'discogs-effnet' ...
  vector     vector(1280),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_embeddings_vector
  ON embeddings USING hnsw (vector vector_cosine_ops);

-- ── Taste profiles (recommendations / future composition conditioning) ──
CREATE TABLE IF NOT EXISTS taste_profiles (
  user_id       UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  centroid      vector(1280),                      -- average embedding of liked tracks
  genre_dist    JSONB,
  mood_dist     JSONB,
  bpm_histogram JSONB,
  key_dist      JSONB,
  track_count   INTEGER NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Analysis job queue tracking ───────────────────────
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

-- ── Phase 1: like sync (extension → backend) ──────────
-- Idempotently applies the track array (jsonb) sent by the extension. One call = one transaction.
-- Input element keys: videoId, title, artist, album, durationMs, likedAt
-- This is pre-normalization, so it creates one tracks row per videoId (resolved=false).
-- The Phase 2 resolver merges and normalizes them into canonical tracks.
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

-- ── Phase 2: migration ────────────────────────────────
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS preview_url TEXT;  -- Deezer 30-second preview

-- ── Phase 2: bulk-save API enrichment results ─────────
-- p_rows element keys: trackId, deezerId, album, previewUrl, bpm, genres, matchConfidence
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

-- ── Artists excluded from analysis (per-user) ─────────
-- Excludes very old artists / music-video and compilation channels from stats and analysis.
CREATE TABLE IF NOT EXISTS excluded_artists (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  artist     TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, artist)
);

-- ── taste_profiles: AI-generated psychology / taste profile ──
ALTER TABLE taste_profiles ADD COLUMN IF NOT EXISTS ai_profile      jsonb;
ALTER TABLE taste_profiles ADD COLUMN IF NOT EXISTS ai_generated_at TIMESTAMPTZ;

-- ── Phase B: save AI enrichment results ───────────────
-- Enriches tracks the APIs couldn't fill via Gemini inference. If realArtist is present, remaps to the original artist.
-- p_rows element keys: trackId, genres, moods, realArtist, realTitle
CREATE OR REPLACE FUNCTION save_ai_enrichments(p_rows jsonb)
RETURNS int AS $$
DECLARE
  rec jsonb;
  n   int := 0;
BEGIN
  FOR rec IN SELECT jsonb_array_elements(p_rows) LOOP
    -- Music-video/compilation channel → remap to original artist
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

-- ── Phase C: recommendations + rating (ideal-type tournament) ──
CREATE TABLE IF NOT EXISTS recommendations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  artist      TEXT NOT NULL,
  title       TEXT NOT NULL,
  album       TEXT,
  deezer_id   BIGINT,
  preview_url TEXT,
  seed_track  TEXT,                              -- recommendation basis: which liked track it derives from
  rating      TEXT,                              -- NULL | 'like' | 'dislike' | 'pass'
  comment     TEXT,                              -- mostly the 'dislike' reason
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  rated_at    TIMESTAMPTZ,
  UNIQUE (user_id, artist, title)
);
CREATE INDEX IF NOT EXISTS idx_recommendations_unrated
  ON recommendations (user_id) WHERE rating IS NULL;

-- Bulk-save recommendation candidates. p_rows keys: artist, title, album, deezerId, previewUrl, seedTrack
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
