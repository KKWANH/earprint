# Playlist Analyzer

A web service + Chrome extension that extracts your YouTube Music "liked"
songs, **analyzes their characteristics (genre, mood)**, generates an
**AI music-psychology profile**, and serves **rated song recommendations**.

> Demo: `https://playlist-analyzer-web.kwanho0096.workers.dev`
> (Google OAuth is in test mode — when self-hosting, use your own account.)

See [ARCHITECTURE.md](./ARCHITECTURE.md) for design decisions and
[DEPLOY.md](./DEPLOY.md) for deployment.

---

## Supported services

| Music service | Supported | Notes |
|---|---|---|
| **YouTube Music** | ✅ | Liked-songs (LM) collected via the Chrome extension |
| Spotify | ❌ | Not supported |
| Apple Music | ❌ | Not supported |

YouTube Music has no public API, so the Chrome extension intercepts the
internal `youtubei` responses within the user's own session to collect the
liked-songs list. (Personal / educational tool.)

## Features — development status

| Phase | Feature | Status |
|---|---|---|
| 1 | Chrome extension — collect liked songs → store in backend | ✅ |
| 2 | Track enrichment — Deezer (album, preview) + Last.fm (genre/mood tags) | ✅ |
| B | AI fallback — Gemini fills empty tracks; MV/compilation channels re-mapped to the real artist | ✅ |
| 1 | Stats dashboard — top artists / genre / mood distribution, artist exclusion | ✅ |
| A | AI music-psychology analysis — Gemini generates personality, taste, digging score, improvement guide | ✅ |
| C | Recommendations — similar-song picks → preview → like/dislike/comment rating with feedback loop | ✅ |
| — | Admin — app stats (owner only) | ✅ |
| D | Listening-history collection (beyond likes) | ⛔ Not implemented |
| 3 | BPM / audio features (MIR) — self-hosted Essentia analysis | ⛔ Not implemented (low priority) |
| 4 | music-map — embedding-based 2D taste visualization | ⛔ Not implemented (depends on MIR) |

### Limitations
- **No BPM analysis** — Deezer's BPM data is sparse, so it is deferred. Reliable
  BPM needs Essentia MIR (a separate Python service), which is low priority.
- **Genre coverage** — even with Last.fm + Gemini, some obscure tracks may have
  no genre.
- **Recommendation playback** — Deezer 30-second previews plus a YouTube Music
  link, not full-track playback.

## Architecture

```
Chrome ext (MV3)  →  Web app + API (Next.js / Cloudflare Workers)  →  Postgres (Neon)
 collect likes        auth · analysis · recommend · dashboard          likes · analysis · recs
                              │
                    External APIs: Deezer · Last.fm · Gemini
```

Everything is **serverless** — it runs on Cloudflare Workers with no
always-on server. The AI calls Google Gemini's hosted API; no model is
self-hosted.

## Tech stack

- **Extension**: Manifest V3, TypeScript, Vite + CRXJS
- **Web app / API**: Next.js (App Router), TypeScript, Tailwind, Auth.js (Google OAuth)
- **Hosting**: Cloudflare Workers (OpenNext adapter)
- **DB**: Postgres + pgvector (Neon)
- **External APIs**: Deezer (no auth) · Last.fm · Google Gemini
- **Monorepo**: pnpm workspaces + Turborepo

## Self-hosting

1. Create a Neon Postgres database → apply `db/schema.sql` (via `psql` or the script).
2. Get your own keys: Google OAuth, Last.fm API, Google Gemini API.
3. Deploy `apps/web` to Cloudflare Workers (`pnpm run deploy`) and register secrets.
4. Build `apps/extension` and load it unpacked in Chrome.

Full steps are in [DEPLOY.md](./DEPLOY.md). Self-hosters use **their own API keys**.

## License

MIT
