# Streaming-service integrations

Status of (and roadmap for) pulling library data from streaming services
other than YouTube Music. Written May 2026 as a design doc — none of
this is shipped yet.

## Current state

| Service | Status | Method |
|---|---|---|
| YouTube Music | ✅ shipped | Chrome extension DOM scrape |
| YouTube (Data API path) | ❌ removed | Only exposed ~25% of YT Music likes |
| Spotify | 📋 planned (this doc) | Web API OAuth |
| Apple Music | 📋 planned (this doc) | MusicKit JS + Apple Music API |

## Spotify

### What's possible
Spotify Web API has a `GET /v1/me/tracks` endpoint that returns the
user's "Liked Songs" with pagination — exactly what we need. No DOM
scraping required, no quota mystery, no "1,400 → 325 silent drop"
problem we hit on YT Data API.

Endpoint:  `https://api.spotify.com/v1/me/tracks?limit=50&offset=0`
Scopes:    `user-library-read`
Auth:      OAuth 2 PKCE (works from a browser, no client secret)
Rate:      "soft" — Spotify doesn't publish numbers but a paginated
           sweep of 5,000 tracks at 50/page = 100 calls, well below
           the throttle ceiling in practice.

Each track row includes: track name, artists, album, popularity (0-100),
release date, duration, ISRC, preview URL (30 s MP3). All the fields
our Deezer enrichment is currently fetching — meaning **Spotify-imported
tracks could skip Phase 1 entirely** since the data is already there.

### Implementation sketch

1. **OAuth flow**
   - User clicks "Connect Spotify" on `/connect`.
   - Browser PKCE → redirect to `accounts.spotify.com/authorize`
     with `scope=user-library-read`.
   - Callback at `/api/spotify/callback` exchanges code → access +
     refresh token. Both stored in `users.spotify_tokens jsonb`.

2. **Sync route** (`/api/sync/spotify`)
   - Auth: Bearer earprint sync_token (same shape as the extension).
   - Loops `me/tracks` until `next` is null, accumulating up to
     `FREE_LIMITS.librarySize` (500) for free / unlimited for Pro.
   - Posts the result into the same `sync_liked_tracks(p_user_id,
     p_tracks)` function the extension uses — completely shared
     downstream path. canon_key dedups against extension imports
     so a user who connects both services doesn't get duplicates.

3. **Source flag** on track_sources: `source='spotify'` alongside the
   existing `'ytmusic'`. Lets us show "synced from Spotify" badges
   and tell the user "Earprint sees X tracks from Spotify + Y from
   YT Music".

4. **Token refresh**: a small `lib/spotifyAuth.ts` helper that uses
   the stored refresh_token to mint a fresh access token when the
   stored one is within 5 min of expiry. Runs from any caller; no
   cron required because syncs are user-initiated.

### Limitations to flag upfront

- Spotify "Liked Songs" is a different mental model from YT Music's
  "좋아요한 음악". Some users keep playlists as their library and
  rarely heart anything. We should surface "you have 3 tracks in
  Liked Songs — also import from your top playlist?" once a user
  connects but the sync returns very few tracks.

- Region-locked tracks: ISRC + popularity are global but `available
  _markets` varies. We ignore for now (Earprint isn't a playback
  product).

## Apple Music

### What's possible
Apple Music API requires both:
1. A **developer token** signed with the operator's Apple Developer
   private key (10-min validity, refreshed server-side).
2. A **user music token** obtained via MusicKit JS in the browser
   after the user signs in with their Apple ID.

Endpoint: `https://api.music.apple.com/v1/me/library/songs`

Quota:    Documented as "unlimited within reason", in practice 1,000
          songs / req with cursor pagination.

### Implementation sketch

1. **MusicKit setup** in the client: load `https://js-cdn.music.apple
   .com/musickit/v3/musickit.js`, configure with our developer JWT.

2. **User auth**: `MusicKit.getInstance().authorize()` returns the
   user music token. Stash in `users.apple_music_token`.

3. **Sync route** (`/api/sync/apple`): server-side call to
   `me/library/songs` with both tokens, paginate, push into
   `sync_liked_tracks`. Same downstream path as Spotify + YT Music.

### Cost

- Apple Developer Program: $99 / year. Justifiable if Apple Music
  users become a meaningful import path.
- Server-side dev-token signing: ES256 with the private key kept as
  a Cloudflare secret. ~10 lines of code (`jose` library).

### Why this is "later" vs "soon"

- Most Earprint users today come from a K-pop / J-pop / indie
  Korean audience — Spotify is huge in KR; Apple Music is small but
  not negligible. Spotify should ship first.
- The $99/yr developer fee is a real ongoing cost — only worth it
  once Spotify connector is shipped and we have evidence that
  multi-service users are a meaningful slice.

## Shared design notes

### Unifying the source

`sync_liked_tracks()` already accepts any `source` string. The
shared insertion path means:

- Top Artists / Top Genres / dashboards work identically regardless
  of where the track came from.
- Per-source counters available via `track_sources.source` if we
  ever want to show "60% from Spotify, 40% from YT Music".
- Append-only contract: connecting Spotify and re-syncing YT
  Music doesn't erase the Spotify tracks (and vice versa).

### Pricing impact

The 500-track free cap is global (libraries combine), not per-
service. Users who connect both will fill their free quota faster.
The Pro tier (when re-enabled with analysis-history) lifts that
cap so multi-service users get the whole picture.

### Order of integration

1. Spotify Web API (PKCE OAuth, free, large user base)
2. Apple Music API (needs $99 developer + MusicKit JS, smaller
   user base but high-quality data)
3. Tidal / Deezer / Amazon Music — defer indefinitely (small share,
   each has different API quirks)
