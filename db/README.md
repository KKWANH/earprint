# DB

A single Postgres 15+ / pgvector database holds both relational data and vectors.

```bash
psql "$DATABASE_URL" -f db/schema.sql
```

No `psql`? Use the bundled script:

```bash
cd apps/web && DATABASE_URL=... node scripts/apply-schema.mjs ../../db/schema.sql
```

The schema is plain SQL for now. Once it stabilizes, a migration tool
(e.g. `dbmate`, `drizzle-kit`) can be introduced.

## Tables

| Table | Role |
|---|---|
| `users` | Users (Google OAuth) |
| `tracks` | Globally shared canonical tracks |
| `track_sources` | External platform identifiers per track (YT videoId, etc.) |
| `user_tracks` | Per-user like relationships |
| `analysis` | Per-track feature analysis results (versioned) |
| `embeddings` | Per-track audio embedding vectors (Phase 3) |
| `taste_profiles` | Per-user aggregated taste profile + AI analysis |
| `analysis_jobs` | Analysis job queue tracking (Phase 3) |
| `excluded_artists` | Artists a user excluded from stats |
| `recommendations` | Generated recommendations + user ratings |

## Functions

| Function | Role |
|---|---|
| `sync_liked_tracks` | Idempotently apply a batch of captured likes |
| `save_enrichments` | Bulk-save Deezer/Last.fm enrichment results |
| `save_ai_enrichments` | Bulk-save Gemini enrichment results |
| `save_recommendations` | Bulk-insert recommendation candidates |
