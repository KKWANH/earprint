// E2E seed (R40b). Idempotently creates ONE clearly-marked test user
// with a small synced + analyzed library, so Playwright's authed suite
// has deterministic data to render (dashboard, worldcup, psychology).
//
// Safe by construction: every write is scoped to TEST_EMAIL / fixed
// test-track UUIDs and is upsert/ON CONFLICT, so re-running is a no-op
// and it never touches real users' rows. Run against a throwaway DB or
// a dev branch — NEVER production.
//
//   node --env-file=.dev.vars scripts/e2e-seed.mjs
//
// Prints "E2E_SEED_OK <userId>" on success.

import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set (run with --env-file=.dev.vars)");
  process.exit(1);
}
const sql = neon(url);

// Keep in sync with CURRENT_TOS_VERSION in src/lib/constants.ts — the
// onboarded gate checks tos_version === CURRENT_TOS_VERSION.
const TOS_VERSION = "2026-05-28";
export const TEST_EMAIL = "e2e-test@earprint.dev";

// Fixed UUIDs → re-runnable. Famous tracks with real Deezer ids so the
// preview button works in the authed worldcup too.
const TRACKS = [
  { id: "e2e00000-0000-4000-8000-000000000001", title: "Bohemian Rhapsody", artist: "Queen", deezer: 2347110115, genres: { rock: 0.9, "classic rock": 0.6 }, moods: { epic: 0.8 } },
  { id: "e2e00000-0000-4000-8000-000000000002", title: "Billie Jean", artist: "Michael Jackson", deezer: 3129779, genres: { pop: 0.9, funk: 0.5 }, moods: { groovy: 0.8 } },
  { id: "e2e00000-0000-4000-8000-000000000003", title: "Hey Jude", artist: "The Beatles", deezer: 116348412, genres: { rock: 0.7, pop: 0.6 }, moods: { uplifting: 0.7 } },
  { id: "e2e00000-0000-4000-8000-000000000004", title: "Smells Like Teen Spirit", artist: "Nirvana", deezer: 2179489, genres: { rock: 0.8, grunge: 0.9 }, moods: { angsty: 0.8 } },
  { id: "e2e00000-0000-4000-8000-000000000005", title: "Get Lucky", artist: "Daft Punk", deezer: 12166290, genres: { "electronic": 0.8, disco: 0.7, funk: 0.6 }, moods: { groovy: 0.9 } },
  { id: "e2e00000-0000-4000-8000-000000000006", title: "Rolling in the Deep", artist: "Adele", deezer: 68496703, genres: { pop: 0.9, soul: 0.6 }, moods: { powerful: 0.8 } },
  { id: "e2e00000-0000-4000-8000-000000000007", title: "Dynamite", artist: "BTS", deezer: 997764782, genres: { "k-pop": 0.9, pop: 0.7, disco: 0.5 }, moods: { happy: 0.9 } },
  { id: "e2e00000-0000-4000-8000-000000000008", title: "Dreams", artist: "Fleetwood Mac", deezer: 136284842, genres: { rock: 0.7, "soft rock": 0.6 }, moods: { dreamy: 0.8 } },
];

async function main() {
  // 1) Onboarded test user (tos + age confirmed + ai consent).
  const u = await sql`
    INSERT INTO users (email, display_name, tos_accepted_at, tos_version, age_confirmed_at, ai_consent_at)
    VALUES (${TEST_EMAIL}, 'E2E Test', now(), ${TOS_VERSION}, now(), now())
    ON CONFLICT (email) DO UPDATE SET
      display_name = 'E2E Test',
      tos_accepted_at = now(),
      tos_version = ${TOS_VERSION},
      age_confirmed_at = now(),
      ai_consent_at = now()
    RETURNING id`;
  const userId = u[0].id;

  // 2) Tracks + analysis + user_tracks (all idempotent).
  for (let i = 0; i < TRACKS.length; i++) {
    const t = TRACKS[i];
    await sql`
      INSERT INTO tracks (id, title, artist, deezer_id, resolved)
      VALUES (${t.id}, ${t.title}, ${t.artist}, ${t.deezer}, true)
      ON CONFLICT (id) DO NOTHING`;
    await sql`
      INSERT INTO analysis (track_id, genres, moods, danceability, valence, arousal, bpm, voice_instrumental)
      VALUES (${t.id}, ${JSON.stringify(t.genres)}::jsonb, ${JSON.stringify(t.moods)}::jsonb,
              0.6, 0.6, 0.6, 120, 'voice')
      ON CONFLICT (track_id, analysis_version) DO NOTHING`;
    await sql`
      INSERT INTO user_tracks (user_id, track_id, source, liked_at, captured_at)
      VALUES (${userId}, ${t.id}, 'ytmusic', now() - (${i} || ' hours')::interval,
              now() - (${i} || ' hours')::interval)
      ON CONFLICT (user_id, track_id) DO NOTHING`;
  }

  console.log(`E2E_SEED_OK ${userId} tracks=${TRACKS.length}`);
}

main().catch((e) => {
  console.error("E2E_SEED_FAIL", e);
  process.exit(1);
});
