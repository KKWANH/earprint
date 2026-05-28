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
  -- Incremental YouTube Data API authorisation. Populated when the user
  -- explicitly opts into API-mode sync (/api/yt-oauth/*) so the YT scope
  -- isn't requested during the default Google sign-in (which would trigger
  -- the "unverified app" warning for every visitor).
  yt_access_token       TEXT,
  yt_refresh_token      TEXT,
  yt_token_expires_at   TIMESTAMPTZ,
  -- Paywall state. `plan` is the effective tier ('free' | 'pro'); for
  -- monthly subscriptions `plan_until` is the renewal cutoff; for one-off
  -- lifetime purchases `is_lifetime` is true and `plan_until` ignored.
  -- The two ls_* columns link back to the Lemon Squeezy customer/sub so
  -- webhook events can resolve which user to update.
  plan                  TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  plan_until            TIMESTAMPTZ,
  is_lifetime           BOOLEAN NOT NULL DEFAULT false,
  -- One-shot analysis credits. New users get 1 (the free first analysis);
  -- additional credits are bought via the per-analysis SKU and refilled by
  -- the Lemon Squeezy webhook on order_created. Pro subscribers ignore
  -- credits entirely (unlimited analyses).
  credits               INT NOT NULL DEFAULT 1,
  ls_customer_id        TEXT,
  ls_subscription_id    TEXT,
  -- Consent + retention bookkeeping. ToS / age get set during onboarding;
  -- ai_consent_at is independently revocable from /account. last_seen_at
  -- powers the inactivity-driven account deletion cron.
  tos_accepted_at       TIMESTAMPTZ,
  tos_version           TEXT,
  age_confirmed_at      TIMESTAMPTZ,
  ai_consent_at         TIMESTAMPTZ,
  last_seen_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_ls_customer ON users(ls_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_users_tos_accepted ON users(tos_accepted_at)
  WHERE tos_accepted_at IS NULL;

-- Last extension-sync telemetry — surfaced on /connect so the user can
-- tell at a glance whether their most recent sync replaced their library
-- (complete=true, removed N stale tracks) or just appended (complete=false,
-- meaning the scrape didn't reach the bottom of YT Music's liked-music
-- page). Without these the only place this info lives is the extension
-- popup, which doesn't help web-only checks.
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_sync_at        TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_sync_complete  BOOLEAN;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_sync_captured  INT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_sync_expected  INT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_sync_removed   INT;

-- ── Pro-gating (May 2026) ─────────────────────────────────────────
-- purchases_count: lifetime count of one-shot purchases (Single
-- Analysis + 3-pack each increment by 1). Drives the "you've paid
-- at least once → sync cap lifted" gate without coupling to the
-- legacy `plan` / `is_lifetime` columns. Rationale: one purchase
-- is a strong-enough signal that the user values the product to
-- justify removing the 500-track sync ceiling for the rest of
-- their account lifetime. No retention tax.
ALTER TABLE users ADD COLUMN IF NOT EXISTS purchases_count INT NOT NULL DEFAULT 0;

-- ── Sync token hash (May 2026 hardening, audit P0-1) ──────────────
-- The extension's bearer token (`users.sync_token`) was stored as
-- plaintext: a DB backup leak → immediately-usable credentials.
-- Migration plan:
--
--   Phase 1 (this column landing): add sync_token_hash. Generation
--   path writes BOTH plaintext and hash; verification path tries
--   hash first then falls back to plaintext, AND if the fallback
--   succeeds it back-fills the hash so future requests take the
--   fast path. Existing tokens keep working — no forced re-pairing.
--
--   Phase 2 (separate commit, after cron has back-filled every row):
--   drop the plaintext `sync_token` column. By then the extension
--   has been re-pairing via /connect for long enough that every
--   active token has a hash row.
--
-- HMAC-SHA256 with a server-side secret (env SYNC_TOKEN_HMAC_SECRET)
-- is the chosen primitive: deterministic (= indexable single-row
-- lookup, no need to scan + compare like bcrypt would), fast on
-- Workers Web Crypto, and a single-secret leak compromises every
-- token at once — acceptable trade because the secret lives in
-- Cloudflare's secret store, NOT in the same DB dump that would
-- otherwise be the attack surface. If raised exposure becomes a
-- concern, swap HMAC for PBKDF2 with per-row salt later (the
-- hash column type stays TEXT).
ALTER TABLE users ADD COLUMN IF NOT EXISTS sync_token_hash TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS ux_users_sync_token_hash
  ON users(sync_token_hash) WHERE sync_token_hash IS NOT NULL;
-- Phase 2 drop (operator runs MANUALLY after admin/backfill-token-hashes
-- reports `{ remaining: 0 }` and Cloudflare logs show no plaintext-
-- fallback hits for ≥1 deploy cycle). Don't add UNCOMMENTED here — it
-- would break in-flight extension installs that still authenticate via
-- the plaintext column.
--
--   ALTER TABLE users DROP COLUMN IF EXISTS sync_token;
--   DROP INDEX IF EXISTS users_sync_token_key;

-- Per-user, per-day counters for paywalled features (free tier daily caps).
CREATE TABLE IF NOT EXISTS user_usage (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,
  usage_date DATE NOT NULL,
  count      INT  NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, kind, usage_date)
);

-- Tracks when each periodic maintenance task last ran. The cron-tick guard
-- reads this to fire daily-cadence work (retention sweep) at most once per
-- 24h regardless of how often the per-minute tick fires.
CREATE TABLE IF NOT EXISTS cron_state (
  task     TEXT PRIMARY KEY,
  last_run TIMESTAMPTZ NOT NULL DEFAULT now()
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

-- Zero-based index in the user's Liked Music list at last sync time.
-- YT serves likes newest-first, so position 0 is the most recently liked
-- song; higher numbers are older. Used as a recency-weighting input by
-- the taste profile and recommendation queries — "current taste" tracks
-- get more pull than five-year-old likes.
ALTER TABLE user_tracks ADD COLUMN IF NOT EXISTS list_position INT;
CREATE INDEX IF NOT EXISTS idx_user_tracks_user_pos
  ON user_tracks (user_id, list_position)
  WHERE list_position IS NOT NULL;

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

-- ── Track canonicalization ────────────────────────────
-- Canonical key from (artist, title) collapses live versions, re-uploads,
-- and the typical YouTube/streaming-edition noise into one row per song.
--
-- Cleanups, in order:
--   • artist  — strip a trailing " - Topic" (YT auto-channel suffix)
--   • title   — drop bracket content first:    "(Live)" "[Official Video]" "[Lyric]"
--   • title   — drop "feat." onward
--   • title   — drop a dash-tail edition / mix marker:
--                  "- Remastered 2011" "- Radio Edit" "- Single Version"
--                  "- Live at Wembley" "- Acoustic" "- Mono" "- Deluxe"
--                  "- 2011" (bare year)
-- Then both sides are lowercased and stripped of non-alphanumeric.
-- CJK keeps its codepoints so 한국·일본 곡 들도 정상 매칭됨.
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS canon_key TEXT;

-- Note on the regex: Postgres ARE doesn't treat `\b` the way PCRE does,
-- so the dash-tail pattern uses `\s+[-–—]\s+` (whitespace required on both
-- sides of the dash) plus a trailing `.*$` — the explicit whitespace
-- already establishes the word boundary without needing `\b`.
CREATE OR REPLACE FUNCTION track_canon_key(p_artist text, p_title text)
RETURNS text AS $$
  SELECT
    lower(regexp_replace(
      regexp_replace(coalesce(p_artist, ''), '\s*-\s*topic\s*$', '', 'i'),
      '[^[:alnum:]가-힣ぁ-んァ-ヶ一-龯]', '', 'g'))
    || '|' ||
    lower(regexp_replace(
      regexp_replace(
        regexp_replace(coalesce(p_title, ''),
          '\s+[-–—]\s+(remaster(ed)?|live|acoustic|radio edit|single version|album version|extended|deluxe|edition|version|mono|stereo|bonus|special|anniversary|original|original mix|original version|\d{4}).*$',
          '', 'i'),
        '\(.*?\)|\[.*?\]|feat\.?.*$', '', 'gi'),
      '[^[:alnum:]가-힣ぁ-んァ-ヶ一-龯]', '', 'g'));
$$ LANGUAGE sql IMMUTABLE;

CREATE INDEX IF NOT EXISTS idx_tracks_canon ON tracks (canon_key);

-- Race-safe dedup: two concurrent INSERTs for the same (artist, title) used
-- to be able to slip past the SELECT-then-INSERT pattern inside sync /
-- add_liked_tracks and create duplicate rows for the same canonical track.
-- A UNIQUE index turns that race into a deterministic ON CONFLICT path —
-- harmless to the call site and impossible to produce duplicates.
--
-- WHERE clause excludes (a) NULL canon_key (legacy rows pre-backfill, since
-- migrated) and (b) the trivial "|" value the canonicaliser returns when
-- both artist and title were unparseable. Without the WHERE, those non-
-- meaningful keys would all collide with each other.
CREATE UNIQUE INDEX IF NOT EXISTS ux_tracks_canon_key
  ON tracks (canon_key)
  WHERE canon_key IS NOT NULL AND canon_key <> '|';

-- ── Artist aliases (cross-script / multi-spelling dedup) ──────────────
-- The track-level canon_key only normalizes punctuation; it cannot merge
-- "BTS" with "방탄소년단" or "BLACKPINK" with "블랙핑크" because these are
-- entirely different strings. This table maps raw artist strings (any
-- lowercased variant) to a single canonical display name so artist counts,
-- the artist map and per-artist stats treat them as one.
--
-- source:
--   'manual'  — hand-curated (seed below + admin additions)
--   'deezer'  — auto-suggested from tracks sharing a deezer_artist_id
CREATE TABLE IF NOT EXISTS artist_aliases (
  raw        TEXT PRIMARY KEY,             -- lowercased raw artist string
  canonical  TEXT NOT NULL,                -- canonical display name
  source     TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Deezer-side artist linkage: captured during Phase 1 enrichment from the
-- search hit's `artist` subobject. Two tracks with the same deezer_artist_id
-- are the same artist regardless of how YouTube spelled the name — the
-- basis for the auto-merge fallback below.
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS deezer_artist_id   BIGINT;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS deezer_artist_name TEXT;
CREATE INDEX IF NOT EXISTS idx_tracks_deezer_artist
  ON tracks (deezer_artist_id) WHERE deezer_artist_id IS NOT NULL;

-- Canonicalize an artist string for grouping / display. Resolution order:
--   1. Explicit alias in artist_aliases (operator-curated, always wins).
--   2. Auto-merge by shared deezer_artist_id — pick the most common raw
--      name among all tracks sharing that ID (tie-break: shortest).
--   3. Fall back to the raw input unchanged.
-- The Deezer arg is optional: when callers don't have it handy, only the
-- alias table is consulted (still useful for hand-curated dedup).
CREATE OR REPLACE FUNCTION artist_canon(p_raw text, p_deezer_artist_id bigint DEFAULT NULL)
RETURNS text AS $$
DECLARE
  result text;
BEGIN
  -- 1. Explicit alias.
  SELECT canonical INTO result FROM artist_aliases
    WHERE raw = lower(coalesce(p_raw, ''))
    LIMIT 1;
  IF result IS NOT NULL THEN RETURN result; END IF;

  -- 2. Same Deezer artist ID → most-common raw name for that ID.
  IF p_deezer_artist_id IS NOT NULL THEN
    SELECT artist INTO result FROM tracks
     WHERE deezer_artist_id = p_deezer_artist_id
     GROUP BY artist
     ORDER BY count(*) DESC, length(artist) ASC
     LIMIT 1;
    IF result IS NOT NULL THEN RETURN result; END IF;
  END IF;

  RETURN p_raw;
END;
$$ LANGUAGE plpgsql STABLE;

-- Seed manual aliases for common KO↔EN pairs so dedup works retroactively on
-- the existing ~1,400 tracks (which were enriched before deezer_artist_id
-- was captured). Add more rows here or via /account when needed.
INSERT INTO artist_aliases (raw, canonical, source) VALUES
  ('방탄소년단',             'BTS',              'manual'),
  ('뉴진스',                 'NewJeans',         'manual'),
  ('아이브',                 'IVE',              'manual'),
  ('에스파',                 'aespa',            'manual'),
  ('르세라핌',               'LE SSERAFIM',      'manual'),
  ('블랙핑크',               'BLACKPINK',        'manual'),
  ('투모로우바이투게더',     'TXT',              'manual'),
  ('스트레이 키즈',          'Stray Kids',       'manual'),
  ('세븐틴',                 'SEVENTEEN',        'manual'),
  ('엔하이픈',               'ENHYPEN',          'manual'),
  ('아이유',                 'IU',               'manual'),
  ('레드벨벳',               'Red Velvet',       'manual'),
  ('소녀시대',               'Girls'' Generation','manual'),
  ('빅뱅',                   'BIGBANG',          'manual'),
  ('투피엠',                 '2PM',              'manual'),
  ('동방신기',               'TVXQ',             'manual'),
  ('엑소',                   'EXO',              'manual'),
  ('갓세븐',                 'GOT7',             'manual'),
  ('마마무',                 'MAMAMOO',          'manual'),
  ('트와이스',               'TWICE',            'manual'),
  -- Indie rock / band names commonly written in both scripts. Added
  -- May 2026 after a tester noticed "Crying Nut" and "크라잉넛" were
  -- showing up as two separate artists on the dashboard.
  ('크라잉넛',               'Crying Nut',       'manual'),
  ('자우림',                 'Jaurim',           'manual'),
  ('국카스텐',               'Guckkasten',       'manual'),
  ('넬',                     'Nell',             'manual'),
  ('잔나비',                 'JANNABI',          'manual'),
  ('혁오',                   'HYUKOH',           'manual'),
  ('새소년',                 'SE SO NEON',       'manual'),
  ('실리카겔',               'Silica Gel',       'manual'),
  ('소란',                   'SORAN',            'manual'),
  ('데이브레이크',           'Daybreak',         'manual'),
  ('잠비나이',               'Jambinai',         'manual'),
  ('악동뮤지션',             'AKMU',             'manual'),
  ('볼빨간사춘기',           'Bolbbalgan4',      'manual'),
  ('십센치',                 '10cm',             'manual'),
  ('어반자카파',             'Urban Zakapa',     'manual'),
  ('한로로',                 'Hanroro',          'manual'),
  ('체리필터',               'Cherry Filter',    'manual'),
  ('윤하',                   'YOUNHA',           'manual'),
  ('아이묭',                 'aimyon',           'manual'),
  ('요네즈 켄시',            'Kenshi Yonezu',    'manual'),
  ('요네즈 켄지',            'Kenshi Yonezu',    'manual'),
  ('비비',                   'BIBI',             'manual'),
  ('헤이즈',                 'Heize',            'manual'),
  ('백예린',                 'Yerin Baek',       'manual'),
  ('데이식스',               'DAY6',             'manual'),
  ('엔플라잉',               'N.Flying',         'manual'),
  ('더로즈',                 'The Rose',         'manual')
ON CONFLICT (raw) DO NOTHING;

-- ── Like sync (extension → backend) ───────────────────
-- Tracks are canonical — every videoId of one song (live versions, re-uploads,
-- repeat likes) maps to a single tracks row; videoIds live in track_sources.
--
-- APPEND-ONLY model (post-PIVOT-1):
-- Every successful sync inserts new tracks and refreshes list_position on
-- existing ones. We NEVER delete user_tracks rows in response to a sync,
-- even if the user has un-liked the song on YouTube Music since the last
-- one. Earprint is "everything you've ever liked", not a live mirror of
-- YT Music's Liked Music page. Reasons:
--   1. A scrape that stalls mid-list silently destroying the user's
--      library is the worst possible failure mode. Append-only makes
--      that class of bug impossible by construction.
--   2. The "self-bracket" / Worldcup product expects deep historical
--      library; un-liking a song shouldn't erase it from the user's
--      Earprint history.
--   3. Users who want to remove specific tracks can use the Exclude
--      controls on /library — those filter from stats but keep the
--      underlying user_tracks row.
--
-- Signature kept at 3 args (with p_complete defaulted) for compatibility
-- with the previous deploy, but the flag is now ignored. Document the
-- deprecation; a follow-up will drop it.
--
-- DROP first because the old function had an INT-only return; we're
-- staying compatible with the 4-column shape (removed always 0) so the
-- /api/sync code that destructures `removed` doesn't crash mid-deploy.
DROP FUNCTION IF EXISTS sync_liked_tracks(uuid, jsonb, boolean);
DROP FUNCTION IF EXISTS sync_liked_tracks(uuid, jsonb);
CREATE OR REPLACE FUNCTION sync_liked_tracks(
  p_user_id  uuid,
  p_tracks   jsonb,
  p_complete boolean DEFAULT false  -- IGNORED; kept for arg-shape stability
)
RETURNS TABLE(new_tracks int, new_likes int, total int, removed int) AS $$
DECLARE
  rec        jsonb;
  v_pos      int;
  v_ck       text;
  v_track_id uuid;
BEGIN
  new_tracks := 0;
  new_likes  := 0;
  total      := 0;
  -- WITH ORDINALITY hands us the array index, which the extension
  -- guarantees lines up with the user's Liked Music order (newest-first).
  -- We store that as list_position so downstream recency-weighting reads
  -- it directly — no per-user "newest captured_at" wrangling needed.
  FOR rec, v_pos IN SELECT value, (ord - 1)::int
                    FROM jsonb_array_elements(p_tracks) WITH ORDINALITY t(value, ord) LOOP
    total := total + 1;
    v_ck := track_canon_key(rec->>'artist', rec->>'title');

    SELECT id INTO v_track_id FROM tracks WHERE canon_key = v_ck LIMIT 1;
    IF v_track_id IS NULL THEN
      INSERT INTO tracks (title, artist, album, duration_ms, canon_key)
        VALUES (rec->>'title', rec->>'artist',
                NULLIF(rec->>'album', ''),
                NULLIF(rec->>'durationMs', '')::int, v_ck)
        RETURNING id INTO v_track_id;
      new_tracks := new_tracks + 1;
    ELSE
      -- Backfill the album from YouTube's own metadata when we now have it
      -- (more reliable than Deezer's fuzzy match for indie / non-Western releases).
      IF NULLIF(rec->>'album', '') IS NOT NULL THEN
        UPDATE tracks SET album = rec->>'album' WHERE id = v_track_id;
      END IF;
    END IF;

    -- videoId is optional (Takeout CSV import has artist/title but no id).
    IF NULLIF(rec->>'videoId', '') IS NOT NULL THEN
      INSERT INTO track_sources (track_id, source, source_id, raw_title, raw_artist)
        VALUES (v_track_id, 'ytmusic', rec->>'videoId', rec->>'title', rec->>'artist')
        ON CONFLICT (source, source_id) DO NOTHING;
    END IF;

    -- Insert when new, refresh list_position when already liked. Split
    -- into two statements so `new_likes` only counts genuine inserts —
    -- ON CONFLICT DO UPDATE makes FOUND ambiguous between the two.
    INSERT INTO user_tracks (user_id, track_id, source, liked_at, list_position)
      VALUES (p_user_id, v_track_id, 'ytmusic',
              NULLIF(rec->>'likedAt', '')::timestamptz,
              v_pos)
      ON CONFLICT (user_id, track_id) DO NOTHING;
    IF FOUND THEN
      new_likes := new_likes + 1;
    ELSE
      -- Already liked — bump the recency position so the taste profile
      -- sees this as a current pick. A track that moved up the user's
      -- list (re-liked, etc.) should weight more now than its first sync.
      UPDATE user_tracks SET list_position = v_pos
        WHERE user_id = p_user_id AND track_id = v_track_id;
    END IF;
  END LOOP;

  -- Append-only: no DELETE branch. `removed` always 0; column kept in
  -- the return shape for caller-side compatibility.
  removed := 0;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- App-wide tuning knobs (single-row table). Updated via:
--   UPDATE app_settings SET recency_alpha = 1.5;
-- We read the dial through SQL rather than env vars so a tweak doesn't
-- need a Workers redeploy — change in Neon, next query picks it up.
CREATE TABLE IF NOT EXISTS app_settings (
  id              int  PRIMARY KEY DEFAULT 1,
  -- α controls how aggressively recent likes outweigh old ones.
  --   0.0 → recency disabled, every track weighted equally (legacy)
  --   1.0 → default: newest = 2× oldest (linear)
  --   2.0 → newest = 3× oldest (steeper)
  -- Settings above 3.0 start ignoring most of the library.
  --
  -- Briefly retuned to 0.2 (May 2026) but reverted at user request —
  -- the punchier 1.0→2.0 spread gives a more visible "what I'm into
  -- now" lift on dashboards, and the half-life impact on older
  -- tracks (1.0×) is acceptable.
  recency_alpha   real NOT NULL DEFAULT 1.0,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (id = 1)
);
INSERT INTO app_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
-- Restore the original default for any deployment that ran the
-- short-lived 0.2 migration. Idempotent on re-run.
UPDATE app_settings SET recency_alpha = 1.0 WHERE id = 1 AND recency_alpha = 0.2;

-- Recency weight from list_position. Linear: newest = 1.0 + α, oldest = 1.0.
-- α defaults to the current app_settings value, so every call site auto-
-- picks up tuning changes. NULL position (legacy syncs from before this
-- column) falls back to a flat 1.0.
--
-- Used by topArtists / topGenres / recommend seeds / taste centroid to
-- surface current taste over the average of everything ever liked.
CREATE OR REPLACE FUNCTION recency_weight(p_pos int, p_total int)
RETURNS real AS $$
  SELECT CASE
    WHEN p_pos IS NULL OR p_total IS NULL OR p_total <= 0 THEN 1.0::real
    ELSE (1.0 + COALESCE(
      (SELECT recency_alpha FROM app_settings WHERE id = 1),
      1.0::real
    ) * greatest(0.0, 1.0 - p_pos::real / p_total::real))::real
  END;
$$ LANGUAGE sql STABLE;

-- ── Add liked tracks outside a full sync (map "discover", recommendations) ──
-- Not replace-mode: these likes survive a later YouTube re-sync (source='discover').
-- p_tracks element keys: artist, title, album
CREATE OR REPLACE FUNCTION add_liked_tracks(p_user_id uuid, p_tracks jsonb)
RETURNS int AS $$
DECLARE
  rec        jsonb;
  v_ck       text;
  v_track_id uuid;
  n          int := 0;
BEGIN
  FOR rec IN SELECT jsonb_array_elements(p_tracks) LOOP
    v_ck := track_canon_key(rec->>'artist', rec->>'title');
    IF v_ck IS NULL OR v_ck = '|' THEN CONTINUE; END IF;

    SELECT id INTO v_track_id FROM tracks WHERE canon_key = v_ck LIMIT 1;
    IF v_track_id IS NULL THEN
      INSERT INTO tracks (title, artist, album, canon_key)
        VALUES (rec->>'title', rec->>'artist', NULLIF(rec->>'album', ''), v_ck)
        RETURNING id INTO v_track_id;
    END IF;

    INSERT INTO user_tracks (user_id, track_id, source, liked_at)
      VALUES (p_user_id, v_track_id, 'discover', now())
      ON CONFLICT (user_id, track_id) DO NOTHING;
    IF FOUND THEN n := n + 1; END IF;
  END LOOP;
  RETURN n;
END;
$$ LANGUAGE plpgsql;

-- ── One-time dedup of pre-canonical data ──────────────
-- Backfills canon_key, then merges duplicate tracks (same canonical key) into
-- one keeper, repointing sources / likes / analysis. Safe to re-run.
CREATE OR REPLACE FUNCTION dedup_existing_tracks()
RETURNS int AS $$
DECLARE
  grp    RECORD;
  keeper uuid;
  dups   uuid[];
  merged int := 0;
BEGIN
  UPDATE tracks SET canon_key = track_canon_key(artist, title) WHERE canon_key IS NULL;

  FOR grp IN
    SELECT canon_key, array_agg(id ORDER BY resolved DESC, created_at) AS ids
    FROM tracks
    WHERE canon_key IS NOT NULL AND canon_key <> '|'
    GROUP BY canon_key HAVING count(*) > 1
  LOOP
    keeper := grp.ids[1];
    dups   := grp.ids[2:array_length(grp.ids, 1)];

    UPDATE track_sources SET track_id = keeper WHERE track_id = ANY(dups);

    -- repoint likes, dropping ones that would collide with the keeper's like
    DELETE FROM user_tracks ut
      WHERE ut.track_id = ANY(dups)
        AND EXISTS (SELECT 1 FROM user_tracks k
                    WHERE k.user_id = ut.user_id AND k.track_id = keeper);
    UPDATE user_tracks SET track_id = keeper WHERE track_id = ANY(dups);

    -- give the keeper an analysis row if it has none, then drop the rest
    UPDATE analysis SET track_id = keeper
      WHERE id = (SELECT id FROM analysis WHERE track_id = ANY(dups) LIMIT 1)
        AND NOT EXISTS (SELECT 1 FROM analysis WHERE track_id = keeper);
    DELETE FROM analysis WHERE track_id = ANY(dups);

    DELETE FROM tracks WHERE id = ANY(dups);
    merged := merged + array_length(dups, 1);
  END LOOP;
  RETURN merged;
END;
$$ LANGUAGE plpgsql;

-- ── Phase 2: migration ────────────────────────────────
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS preview_url  TEXT;   -- Deezer 30-second preview
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS release_year INT;    -- original release year (Deezer)
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS deezer_rank  BIGINT; -- Deezer popularity rank (mainstream-ness)

-- Listener's birth year — drives the reminiscence-bump ("imprint core") analysis.
ALTER TABLE users  ADD COLUMN IF NOT EXISTS birth_year   INT;

-- Backfill release_year / deezer_rank for tracks already enriched without them.
-- p_rows element keys: trackId, releaseYear, rank
CREATE OR REPLACE FUNCTION save_track_meta(p_rows jsonb)
RETURNS int AS $$
DECLARE rec jsonb; n int := 0;
BEGIN
  FOR rec IN SELECT jsonb_array_elements(p_rows) LOOP
    UPDATE tracks SET
      release_year = COALESCE(NULLIF(rec->>'releaseYear', '')::int, release_year),
      deezer_rank  = COALESCE(NULLIF(rec->>'rank', '')::bigint, deezer_rank),
      updated_at   = now()
    WHERE id = (rec->>'trackId')::uuid;
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$ LANGUAGE plpgsql;

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
      deezer_id          = COALESCE(NULLIF(rec->>'deezerId', '')::bigint, deezer_id),
      deezer_artist_id   = COALESCE(NULLIF(rec->>'deezerArtistId', '')::bigint, deezer_artist_id),
      deezer_artist_name = COALESCE(NULLIF(rec->>'deezerArtistName', ''), deezer_artist_name),
      album              = COALESCE(album, NULLIF(rec->>'album', '')),
      preview_url        = COALESCE(NULLIF(rec->>'previewUrl', ''), preview_url),
      release_year       = COALESCE(NULLIF(rec->>'releaseYear', '')::int, release_year),
      deezer_rank        = COALESCE(NULLIF(rec->>'rank', '')::bigint, deezer_rank),
      resolved           = true,
      match_confidence   = NULLIF(rec->>'matchConfidence', '')::real,
      updated_at         = now()
    WHERE id = (rec->>'trackId')::uuid;

    -- Auto-populate artist_aliases when Deezer normalised the artist
    -- string to a canonical name that differs from the raw input
    -- (May 2026). Replaces the manual seed-row maintenance pattern —
    -- every "크라잉넛" track that gets enriched against Deezer's
    -- "Crying Nut" automatically writes that pair, so the next user
    -- with the same raw spelling gets it canonicalised without any
    -- human curation. Confidence threshold matches the stats filter
    -- (0.65) — sub-threshold matches are probably wrong artist and
    -- would pollute the alias table with garbage pairs. Read the raw
    -- name from the existing tracks row so we never alias a track
    -- whose own raw value got renamed mid-enrichment.
    INSERT INTO artist_aliases (raw, canonical, source)
    SELECT lower(t.artist),
           rec->>'deezerArtistName',
           'auto:deezer'
    FROM tracks t
    WHERE t.id = (rec->>'trackId')::uuid
      AND NULLIF(rec->>'deezerArtistName', '') IS NOT NULL
      AND lower(t.artist) <> lower(rec->>'deezerArtistName')
      AND COALESCE(NULLIF(rec->>'matchConfidence', '')::real, 0) >= 0.65
    ON CONFLICT (raw) DO NOTHING;

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

-- ── Per-artist preference weight (graduated "how much do you like them") ──
-- weight: 1 = normal like (default, unstored) · 2 = 좋아함 · 3 = 최애.
-- Feeds map node size and recommendation seed weighting.
CREATE TABLE IF NOT EXISTS artist_affinity (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  artist     TEXT NOT NULL,
  weight     REAL NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, artist)
);

-- ── Last.fm similar-artist cache (shared; speeds up the artist map) ──
-- artist is the lowercased seed name; payload is the similar-artist list.
CREATE TABLE IF NOT EXISTS lastfm_similar (
  artist     TEXT PRIMARY KEY,
  payload    JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── External-API response caches (shared) — recommendations & enrichment ──
-- Cuts repeat Last.fm / Deezer calls: faster, and avoids rate-limit flakiness.
CREATE TABLE IF NOT EXISTS lastfm_cache (
  cache_key  TEXT PRIMARY KEY,
  payload    JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS deezer_match (
  cache_key  TEXT PRIMARY KEY,
  payload    JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- YouTube Data API search cache: keyed by lowercased "artist|title" so the
-- same recommendation across users hits the cache. video_id is nullable —
-- a stored NULL means "we searched and found nothing", which avoids burning
-- the daily search quota (100 search calls/day on the default key) on the
-- same dead-end query over and over.
CREATE TABLE IF NOT EXISTS yt_search_cache (
  cache_key  TEXT PRIMARY KEY,
  video_id   TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── taste_profiles: AI-generated psychology / taste profile ──
ALTER TABLE taste_profiles ADD COLUMN IF NOT EXISTS ai_profile      jsonb;
ALTER TABLE taste_profiles ADD COLUMN IF NOT EXISTS ai_generated_at TIMESTAMPTZ;
ALTER TABLE taste_profiles ADD COLUMN IF NOT EXISTS ai_locale       TEXT; -- language the profile text was generated in
-- The profile is stored in both languages at generation time, so switching
-- the UI language needs no extra Gemini call. ai_profile/ai_locale stay for
-- backward compatibility with rows generated before this.
ALTER TABLE taste_profiles ADD COLUMN IF NOT EXISTS ai_profile_en   jsonb; -- profile text in English
ALTER TABLE taste_profiles ADD COLUMN IF NOT EXISTS ai_profile_ko   jsonb; -- profile text in Korean
-- Unguessable id for the public read-only share page (/s/<share_id>).
ALTER TABLE taste_profiles ADD COLUMN IF NOT EXISTS share_id        TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_taste_profiles_share
  ON taste_profiles (share_id);

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
ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS score     REAL;  -- predicted fit (0..1)
ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS cover_url TEXT;  -- Deezer album cover
ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS blurb     TEXT;  -- AI history/significance (lazy)
ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS rec_type  TEXT DEFAULT 'similar';  -- 'similar' | 'explore'
-- rating values: NULL | 'superlike' | 'like' | 'pass' | 'dislike' | 'strong_dislike' | 'known'

-- ── Worldcup tournament results (per-user history) ──
-- Records the champion of every completed /worldcup bracket so the user
-- can look back at "what was my absolute pick on June 5" etc. The card
-- payload is denormalized (artist/title/cover_url stored inline) so
-- displaying history doesn't require a join back to tracks — and so
-- the row survives even if the source track/rec gets later deleted.
CREATE TABLE IF NOT EXISTS tournament_results (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category    TEXT NOT NULL,                  -- 'liked' | 'discover' | 'mix' | 'genre'
  size        INT  NOT NULL,                  -- 8 / 16 / 32 / 64 / 128 / 256
  pattern     TEXT NOT NULL DEFAULT 'random', -- random | favorites | opposites | cross
  champion    JSONB NOT NULL,                 -- denormalized card: { artist, title, coverUrl, ... }
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tournament_results_user
  ON tournament_results (user_id, created_at DESC);

-- Bulk-save recommendation candidates. p_rows keys: artist, title, album, deezerId, previewUrl, seedTrack
CREATE OR REPLACE FUNCTION save_recommendations(p_user uuid, p_rows jsonb)
RETURNS int AS $$
DECLARE
  rec jsonb;
  n   int := 0;
BEGIN
  FOR rec IN SELECT jsonb_array_elements(p_rows) LOOP
    INSERT INTO recommendations
      (user_id, artist, title, album, deezer_id, preview_url, cover_url, seed_track, score, rec_type)
    VALUES (
      p_user, rec->>'artist', rec->>'title', NULLIF(rec->>'album', ''),
      NULLIF(rec->>'deezerId', '')::bigint,
      NULLIF(rec->>'previewUrl', ''), NULLIF(rec->>'coverUrl', ''),
      NULLIF(rec->>'seedTrack', ''), NULLIF(rec->>'score', '')::real,
      COALESCE(NULLIF(rec->>'recType', ''), 'similar')
    )
    ON CONFLICT (user_id, artist, title) DO NOTHING;
    IF FOUND THEN n := n + 1; END IF;
  END LOOP;
  RETURN n;
END;
$$ LANGUAGE plpgsql;

-- ── Audio feel (Gemini-estimated listening characteristics) ──────────
-- audio_feel jsonb: { energy, tempo, acousticness (0..1), instruments[] }
ALTER TABLE analysis ADD COLUMN IF NOT EXISTS audio_feel JSONB;

-- ── Multi-label genre taxonomy (May 2026) ────────────────────────────
-- The legacy `genres jsonb` flat map ("indie pop": 1, "dream pop": 0.8)
-- stays as-is for backward compatibility — every existing analysis row
-- has data there. The five new columns below carry the multi-label
-- structure agreed with the user, populated from a new wave of Gemini
-- analyses:
--
--   primary_genre — single canonical sub-genre id (matches the `id`
--     field in lib/genreDict.ts SUB_GENRES, e.g. "indie_pop", "drill",
--     "neo_soul"). The "headline" genre — what we'd say if forced to
--     pick one. NULL when Gemini wasn't confident enough to commit.
--
--   sub_genres — additional sub-genre ids beyond the primary. Lets
--     a NewJeans track land on ["dance_pop", "rnb", "uk_garage",
--     "jersey_club"] rather than choosing one. Each value should
--     also be a canonical id; aliases are normalised by genreDict
--     at write time.
--
--   style_tags — free-form descriptors that aren't genres
--     ("guitar-driven", "melodic", "nostalgic", "anthemic"). Used to
--     improve flavor/archetype matching beyond pure genre labels.
--
--   region_tags — geographic / scene tags ("korean", "british",
--     "latin", "japanese"). Lets the UI surface "X% of your
--     library is Korean music" without inferring from genre names
--     alone.
--
--   era_tags — decade or epoch tags ("2000s", "2020s", "80s",
--     "modern"). Feeds the reminiscence-bump / imprint-core
--     calculation more directly than parsing release year alone.
--
-- All TEXT[] (arrays of short strings) except primary_genre which is
-- a single TEXT. NULL is meaningful (= Gemini didn't supply it /
-- legacy row before this schema landed).
ALTER TABLE analysis ADD COLUMN IF NOT EXISTS primary_genre TEXT;
ALTER TABLE analysis ADD COLUMN IF NOT EXISTS sub_genres    TEXT[];
ALTER TABLE analysis ADD COLUMN IF NOT EXISTS style_tags    TEXT[];
ALTER TABLE analysis ADD COLUMN IF NOT EXISTS region_tags   TEXT[];
ALTER TABLE analysis ADD COLUMN IF NOT EXISTS era_tags      TEXT[];

-- Index the primary_genre for the common "what's the dominant genre
-- across user X's library" query (currently does jsonb_object_keys
-- on the legacy `genres` field — the new column lets that become a
-- direct GROUP BY primary_genre once the migration finishes).
CREATE INDEX IF NOT EXISTS idx_analysis_primary_genre
  ON analysis(primary_genre)
  WHERE primary_genre IS NOT NULL;
-- GIN indexes on sub_genres / region_tags / era_tags for cheap
-- containment lookups (`WHERE 'korean' = ANY(region_tags)` etc).
CREATE INDEX IF NOT EXISTS idx_analysis_sub_genres
  ON analysis USING GIN (sub_genres);
CREATE INDEX IF NOT EXISTS idx_analysis_region_tags
  ON analysis USING GIN (region_tags);
CREATE INDEX IF NOT EXISTS idx_analysis_era_tags
  ON analysis USING GIN (era_tags);

CREATE OR REPLACE FUNCTION save_audio_feel(p_rows jsonb)
RETURNS int AS $$
DECLARE
  rec jsonb;
  n   int := 0;
BEGIN
  FOR rec IN SELECT jsonb_array_elements(p_rows) LOOP
    UPDATE analysis SET
      audio_feel = CASE WHEN jsonb_typeof(rec->'audioFeel') = 'object'
                        THEN rec->'audioFeel' ELSE '{}'::jsonb END
    WHERE track_id = (rec->>'trackId')::uuid AND analysis_version = 1;
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$ LANGUAGE plpgsql;

-- ── AI analysis: merge Gemini genres/moods + store audio feel ────────
-- p_rows keys (legacy):  trackId, genres, moods, audioFeel
-- p_rows keys (May 2026): + primaryGenre, subGenres, styleTags, regionTags, eraTags
-- Gemini genres/moods are merged into existing (Last.fm) ones, not replaced.
-- The new multi-label columns are OVERWRITTEN per-row (no merge) — Gemini
-- is the only writer for those, so re-analysing replaces them outright.
-- Each new field is optional in the JSONB; missing → column stays
-- whatever it was (NULL on first write, previous value on re-analysis).
CREATE OR REPLACE FUNCTION save_ai_analysis(p_rows jsonb)
RETURNS int AS $$
DECLARE
  rec jsonb;
  n   int := 0;
BEGIN
  FOR rec IN SELECT jsonb_array_elements(p_rows) LOOP
    UPDATE analysis SET
      genres = COALESCE(genres, '{}'::jsonb)
               || CASE WHEN jsonb_typeof(rec->'genres') = 'object'
                       THEN rec->'genres' ELSE '{}'::jsonb END,
      moods  = COALESCE(moods, '{}'::jsonb)
               || CASE WHEN jsonb_typeof(rec->'moods') = 'object'
                       THEN rec->'moods' ELSE '{}'::jsonb END,
      audio_feel = CASE WHEN jsonb_typeof(rec->'audioFeel') = 'object'
                        THEN rec->'audioFeel' ELSE '{}'::jsonb END,
      -- Multi-label fields: write through when present in payload,
      -- preserve current value otherwise. Empty-array vs NULL is
      -- significant — caller sends `[]` for "Gemini ran but found
      -- nothing", null/missing for "didn't ask".
      primary_genre = COALESCE(NULLIF(rec->>'primaryGenre', ''), primary_genre),
      sub_genres    = CASE WHEN jsonb_typeof(rec->'subGenres') = 'array'
                           THEN ARRAY(SELECT jsonb_array_elements_text(rec->'subGenres'))
                           ELSE sub_genres END,
      style_tags    = CASE WHEN jsonb_typeof(rec->'styleTags') = 'array'
                           THEN ARRAY(SELECT jsonb_array_elements_text(rec->'styleTags'))
                           ELSE style_tags END,
      region_tags   = CASE WHEN jsonb_typeof(rec->'regionTags') = 'array'
                           THEN ARRAY(SELECT jsonb_array_elements_text(rec->'regionTags'))
                           ELSE region_tags END,
      era_tags      = CASE WHEN jsonb_typeof(rec->'eraTags') = 'array'
                           THEN ARRAY(SELECT jsonb_array_elements_text(rec->'eraTags'))
                           ELSE era_tags END,
      source_flags = COALESCE(source_flags, '{}'::jsonb) || '{"ai":"gemini"}'::jsonb
    WHERE track_id = (rec->>'trackId')::uuid AND analysis_version = 1;

    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$ LANGUAGE plpgsql;

-- ── MIR results ingest (Essentia + Discogs-EffNet — Phase 5) ──
-- Mirrors save_enrichments / save_ai_analysis: takes a JSONB array
-- emitted by services/analysis/app/pipeline/enricher.py:mir_batch and
-- updates tracks (bpm/key/scale), analysis (danceability + mood + voice),
-- and embeddings (1280-d vector via pgvector) in one tx per row.
--
-- The embedding cast: a JSONB array `[0.12, -0.05, ...]` has a text
-- representation `[0.12, -0.05, ...]` that pgvector accepts when cast
-- with `::vector` — no parsing in the function body needed.
CREATE OR REPLACE FUNCTION save_mir_analysis(p_rows jsonb)
RETURNS int AS $$
DECLARE
  rec jsonb;
  n   int := 0;
BEGIN
  FOR rec IN SELECT jsonb_array_elements(p_rows) LOOP
    UPDATE tracks SET
      bpm         = COALESCE(NULLIF(rec->>'bpm', '')::real, bpm),
      music_key   = COALESCE(NULLIF(rec->>'musicKey', ''), music_key),
      music_scale = COALESCE(NULLIF(rec->>'musicScale', ''), music_scale)
    WHERE id = (rec->>'trackId')::uuid;

    UPDATE analysis SET
      danceability       = COALESCE(NULLIF(rec->>'danceability', '')::real, danceability),
      valence            = COALESCE(NULLIF(rec->>'valence', '')::real, valence),
      arousal            = COALESCE(NULLIF(rec->>'arousal', '')::real, arousal),
      voice_instrumental = COALESCE(NULLIF(rec->>'voiceInstrumental', ''), voice_instrumental),
      source_flags       = COALESCE(source_flags, '{}'::jsonb) || '{"mir":"essentia"}'::jsonb
    WHERE track_id = (rec->>'trackId')::uuid AND analysis_version = 1;

    -- Only insert the embedding when the analyzer actually produced one.
    -- A schema-failed track would have null `embedding` and we don't
    -- want to occupy the HNSW index with garbage rows.
    IF jsonb_typeof(rec->'embedding') = 'array' THEN
      INSERT INTO embeddings (track_id, model, vector)
      VALUES (
        (rec->>'trackId')::uuid,
        COALESCE(NULLIF(rec->>'embeddingModel', ''), 'unknown'),
        ((rec->'embedding')::text)::vector
      )
      ON CONFLICT (track_id) DO UPDATE SET
        vector = EXCLUDED.vector,
        model  = EXCLUDED.model;
    END IF;

    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$ LANGUAGE plpgsql;

-- Recomputes a user's taste centroid as the mean of their liked tracks'
-- embeddings. Called by the Fly worker after each MIR batch finishes so
-- the recommendation embedding pool (lib/recommend.ts:embeddingPool)
-- stays current as new audio features land. Cheap: pgvector's avg()
-- runs in a single scan and we always upsert one row.
CREATE OR REPLACE FUNCTION update_taste_centroid(p_user_id uuid) RETURNS void AS $$
DECLARE
  v_centroid vector(1280);
  v_count    int;
BEGIN
  SELECT avg(e.vector)::vector(1280), count(*)::int
    INTO v_centroid, v_count
  FROM embeddings e
  JOIN user_tracks ut ON ut.track_id = e.track_id
  WHERE ut.user_id = p_user_id;

  IF v_count = 0 THEN RETURN; END IF;

  INSERT INTO taste_profiles (user_id, centroid, track_count, updated_at)
  VALUES (p_user_id, v_centroid, v_count, now())
  ON CONFLICT (user_id) DO UPDATE SET
    centroid    = EXCLUDED.centroid,
    track_count = EXCLUDED.track_count,
    updated_at  = now();
END;
$$ LANGUAGE plpgsql;

-- ── Background jobs (cron-driven enrichment that survives tab close) ──
-- kind:   'analyze'  (single 2-phase job: enrich → ai analysis)
-- status: 'running' | 'stopped' | 'done'
CREATE TABLE IF NOT EXISTS background_jobs (
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'running',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  notified_at TIMESTAMPTZ,                          -- completion email sent at
  PRIMARY KEY (user_id, kind)
);
ALTER TABLE background_jobs ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;
-- Worker mutex. Set to now()+TTL before a batch starts, NULL (or now-past)
-- when free. Lets cron and /api/jobs/tick race the same user without
-- both burning Gemini/Deezer on the same tracks. TTL self-heals when a
-- worker dies mid-batch — next call sees an expired lock and proceeds.
ALTER TABLE background_jobs ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_background_jobs_running
  ON background_jobs (status) WHERE status = 'running';

-- ── API usage counters — a global daily cap on paid calls (Gemini) so a
--    public launch can't run away with cost. One row per (day, kind). ──
CREATE TABLE IF NOT EXISTS api_usage (
  day   DATE NOT NULL,
  kind  TEXT NOT NULL,
  count INT  NOT NULL DEFAULT 0,
  PRIMARY KEY (day, kind)
);

-- ── Whitelist — these emails bypass the daily Gemini cap entirely, so the
--    owner and trusted accounts always have full AI access. ──
CREATE TABLE IF NOT EXISTS app_whitelist (
  email    TEXT PRIMARY KEY,                       -- lowercased
  added_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Genre info — built once per genre (AI description + Last.fm top
--    artists/tracks) and cached, so the genre detail page just loads it. ──
CREATE TABLE IF NOT EXISTS genre_info (
  genre          TEXT PRIMARY KEY,                  -- lowercased
  description_en TEXT,
  description_ko TEXT,
  top_artists    JSONB,                             -- string[]
  top_tracks     JSONB,                             -- {artist,title}[]
  generated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Community-created worldcups (May 2026) ───────────────────────────
-- User-generated tournaments: anyone signed in can compose a 4-32-slot
-- bracket from YouTube video URLs, publish it under their account, and
-- the whole-world (signed-in or anonymous) can play through it. Stats
-- accumulate over time so the most-played brackets surface as
-- community favourites and per-item win/champion rates show "which
-- song actually wins this tournament most of the time".
--
-- visibility:
--   public    — listed on /worldcup/community, indexable.
--   unlisted  — accessible by direct URL only; not in the list.
-- (No 'private' yet — these are share-first by design.)
CREATE TABLE IF NOT EXISTS community_worldcups (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  description   TEXT,
  visibility    TEXT NOT NULL DEFAULT 'public'
                  CHECK (visibility IN ('public', 'unlisted')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Aggregate counters maintained by the finish endpoint. Cheap to
  -- bump per-finish vs. computing live every page load.
  play_count    INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_community_worldcups_listed
  ON community_worldcups (visibility, created_at DESC)
  WHERE visibility = 'public';
CREATE INDEX IF NOT EXISTS idx_community_worldcups_owner
  ON community_worldcups (owner_user_id, created_at DESC);

-- Tags (May 2026) — free-form short labels for categorisation +
-- discovery on the community list. Lowercased, max 12 chars each,
-- ~5 per worldcup. GIN index for cheap `WHERE 'k-pop' = ANY(tags)`
-- filter queries. NULL-safe default = '{}'.
ALTER TABLE community_worldcups
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_community_worldcups_tags
  ON community_worldcups USING GIN (tags);

CREATE TABLE IF NOT EXISTS community_worldcup_items (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  worldcup_id       UUID NOT NULL REFERENCES community_worldcups(id) ON DELETE CASCADE,
  position          INT NOT NULL,
  -- YouTube videoId — kept minimal (no full URL, no track/artist
  -- canonicalisation; UGC brackets are about videos, not music
  -- metadata). title/subtitle/thumbnail come from oEmbed at create
  -- time; we cache them so re-watching doesn't require a YT call.
  yt_video_id       TEXT NOT NULL,
  title             TEXT NOT NULL,
  subtitle          TEXT,
  thumbnail_url     TEXT,
  -- Per-item stats. Updated by /api/worldcup/community/[id]/finish:
  --   appearance += bracket_size / 2 for round-0 entries, then -1 per
  --     round survived (effectively "how many times shown")
  --   win        += 1 per round won
  --   champion   += 1 per final win
  appearance_count  INT NOT NULL DEFAULT 0,
  win_count         INT NOT NULL DEFAULT 0,
  champion_count    INT NOT NULL DEFAULT 0,
  UNIQUE (worldcup_id, position)
);
CREATE INDEX IF NOT EXISTS idx_cwi_worldcup ON community_worldcup_items(worldcup_id);

-- ─────────────────────────────────────────────────────────────────────────
-- Data migrations
-- Run AFTER every CREATE TABLE so a fresh install can apply the whole file
-- in one go without 'relation does not exist'. Re-running them is a no-op
-- (DELETE on already-deleted rows just touches 0 rows).
-- ─────────────────────────────────────────────────────────────────────────

-- Obsolete per-phase job rows (replaced by the single 'analyze' job).
DELETE FROM background_jobs WHERE kind IN ('enrich', 'ai_enrich', 'audio_feel');
