# Worldcup Roadmap (live document)

> This is a **living plan** — agents working on the worldcup product
> area are expected to keep this file in sync without requiring user
> approval for every status update. Every commit that touches
> `apps/web/src/app/worldcup/**`, `apps/web/src/app/api/worldcup/**`,
> the community schema, or the BracketCard / GenreCard runners must
> revisit the "Status" column below.
>
> Last updated: 2026-05-28 (R24d)

## Vision

A piku.co.kr-class music tournament product on top of Earprint's
library + YouTube embedding capability. Three orthogonal entry
points so a returning user always has something fresh:

| Track | One-line product | Built on |
|---|---|---|
| **A** | "Find my absolute favourites" — AI-curated bracket from MY library | Library + Gemini |
| **B** | "Try something new" — discover bracket from recommendations | recommend engine |
| **C** | "Play someone else's" — community-made brackets (UGC) | community_worldcups |

All three share the same `Bracket` runner + `BracketCard` shell:
big tap target, YT iframe inline, side-by-side at every viewport,
keyboard arrows + final-round amber treatment + champion pop-in.
No fork, no parallel implementations — when we add an animation to
BracketCard, all three benefit immediately.

## Player priority (shared rule across A/B/C)

In order, on click of the big centre play disc:

1. **YT iframe** — full song, no time limit. Default whenever
   yt-search returned a videoId, OR the candidate carries one
   directly (UGC always does).
2. **Deezer 30 s preview** — fallback for library/recommend tracks
   where yt-search resolved nothing.
3. **External YT search** — last resort.

Source pill in the top-right (YT / 30s / ↗) tells the user up-front
which one will fire.

## Hand-off to YouTube Music (every champion)

When a bracket reaches its winner, the champion view should give
the user a one-tap path back into YouTube Music so they can "like
it for real". No YT Music API exists, so:

- **R19a (shipped):** champion view now has both "watch on YouTube"
  AND an explicit "♥ Like in YT Music ↗" button. The button deep-
  links to `music.youtube.com/search?q=<artist>+<title>` in a new
  tab — the user lands on the search result, one tap to the heart
  icon. Same affordance fires for both song champions (Tracks A/B)
  and genre champions (Track C); genre champions search by genre
  name alone.
- **Future (if usage warrants):** the existing Chrome extension
  already runs on `music.youtube.com`; could auto-inject a
  "Like via Earprint" affordance that detects the search target
  and clicks the heart for the user. Substantial extension scope,
  defer until track A / B / C engagement justifies it.

## Track A — AI-curated "favourites" bracket  *(planned)*

### Product
The user picks a *lens* ("all-time favourites", "guilty pleasures",
"last 3 months obsessions", "songs I keep coming back to") and
Earprint composes a 16-slot bracket using Gemini against the
user's library + audio_feel + recency signals. Not just a SQL
filter — Gemini picks emotionally coherent groupings the user
would recognise as their own taste.

### What exists today
- Built-in modes shipped at `/worldcup/[cat]/[size]`:
  `random` / `recent` / `forgotten` / `genre` / `discover` / `mix`.
- All of them are SQL filters. None of them are LLM-curated.

### Gap
No "tell Gemini what mood/lens you want, then build the bracket"
flow. The closest existing thing is the bracket pattern picker
(random / favorites / opposites / cross) which only re-orders
candidates within a pre-picked set.

### Plan
1. New route `POST /api/worldcup/curate` — body: `{lens: string,
   size: 4|8|16|32}`. Server fetches a wide sample of the user's
   library (top-200 by recency-weighted score), asks Gemini "pick
   the 16 tracks that best fit this lens, return canonical
   indexes". Caches per (user, lens) for 24 h so re-rolling is
   free.
2. New page `/worldcup/curate/[size]` — lens chip picker
   ("✨ All-time favourites" / "💔 Sad songs" / "🔥 Pump-up" /
   "🌙 Late-night" / "🌱 Recent" / "📼 Forgotten" / custom textarea
   for the user's own prompt). Selecting a chip fires the curate
   endpoint and routes into the standard Bracket runner.
3. Gemini cost: ~$0.01 per curation call (uses flash-lite). Free
   tier gets 3/day; Pro unlimited. Counts against the existing
   per-user Gemini cap.

### Status
- ✅ shipped (R19b)
- Route: `/worldcup/curate/[size]` — lens picker (7 pre-baked
  chips + a custom textarea) → calls `POST /api/worldcup/curate`
  → Gemini picks `size` track-indexes from a 200-track recency-
  weighted candidate pool → hands off to the existing Bracket
  runner. Worldcup home gets a top-row 3-card hero highlighting
  the new Track A entry alongside Track B (Discover) + Track C
  (Community).

## Track B — Discovery bracket  *(partially shipped)*

### Product
Random new-to-user tracks pulled from Earprint recommendations.
Designed for "I'm bored of my own library, surprise me". piku-style
"swipe through new stuff" with the bracket structure as a forcing
function ("you must rank them, no skipping").

### What exists today
- `/worldcup/discover/[size]` route shipped
- `/worldcup/mix/[size]` (library × discover) shipped
- Candidates pulled from the `recommendations` table

### Gap
- No "fresh batch" button if the user disliked the initial mix
  (have to refresh-and-pray for new candidates)
- Champion shows "Watch on YT" but no "♥ Like in YT Music" path
- No "save bracket to community" — a discovery bracket the user
  loved is private to them, can't share with friends

### Plan
1. Add **"♥ Like in YT Music ↗"** button to the champion view
   (see "Hand-off" section above).
2. **"Save & share as community bracket"** — one-click promote
   to the community section so the user can give the bracket a
   title and publish for their friends.
3. **"Re-roll batch"** — calls `/api/recommend?regenerate=1`
   then restarts the bracket with the new set.

### Status
- ✅ basic shipped
- ❌ "Like in YT Music" hand-off
- ❌ "save as community" promote
- ❌ "re-roll batch" affordance

## Track C — Community / UGC brackets  *(MVP shipped)*

### Product
Anyone (signed in) can compose a bracket from YouTube URLs and
publish it for the whole-world to play. Anonymous play encouraged
— stats accumulate per item (appearance / win / champion). piku's
defining feature; the social hook that makes the product
embeddable on Reddit / DC Inside / Twitter.

### What exists today
- DB: `community_worldcups` + `community_worldcup_items` schema
- API: `POST /api/worldcup/community/create` (4-32 YT URLs,
  oEmbed-fetched title/thumbnail), `POST .../[id]/finish`
  (IP rate-limited, bumps appearance/win/champion counts)
- Pages: `/worldcup/community` (list, ordered by play_count),
  `/worldcup/community/create` (form with validity per-row
  green ✓ / red ×), `/worldcup/community/[id]` (CommunityRunner
  uses Bracket with pre-supplied ytVideoId so no yt-search
  lookup), `/worldcup/community/[id]/stats` (per-item win-rate
  and champion-rate)

### Gap
- **Sharing**: no native share-sheet button on `/community/[id]`
  finish; user manually copies the URL.
- **Discoverability**: list page has no filter / sort other than
  play_count desc. No "trending today" vs "all-time".
- **Embeddable**: no `<iframe>`-embeddable mini-player so a
  worldcup can be dropped into a blog post.
- **Champion → YT Music**: same gap as Track B.
- **Bulk-import**: power users want to paste a YouTube *playlist*
  URL and have Earprint dump every video in as candidates. Today
  they paste 16 individual URLs.
- **Cover/thumbnail flexibility**: today uses YT's own oEmbed
  thumbnail. For music tracks, the user might prefer the album
  cover — possible upgrade: optional Deezer-cover override.
- ~~**Categorisation/tags**: no genre/region tagging~~ → ✅
  Shipped R20: `tags TEXT[]` column on community_worldcups (GIN
  indexed), comma-separated input on create form, tag filter
  strip + chip display on `/worldcup/community?tag=k-pop`.

### Plan
1. **Native share** on champion view: `navigator.share()` with
   fallback to clipboard. (Pattern already in use on `/library`.)
2. **Trending tab**: `/community?trending=24h` filters worldcups
   by `play_count` delta in the last 24 hours.
3. **♥ Like in YT Music** button on champion (see "Hand-off").
4. **Playlist URL bulk-import**: `/worldcup/community/create`
   gets a second tab "Import from YouTube playlist URL". Server
   fetches the playlist via the existing oEmbed-only pattern
   (no API key needed for playlist itemList yet — needs
   investigation; might require YouTube Data API after all).
5. **Embeddable mini-player**: `/worldcup/community/[id]/embed`
   that renders a stripped-down BracketRunner suitable for an
   `<iframe>`. CORS-friendly, no nav header.

### Status
- ✅ MVP shipped (commits 88a8122)
- ✅ trending sort, share button, YT Music hand-off,
  playlist bulk-import (R23b), embed mode

## Common UX patterns (piku-inspired)

| Pattern | Status | Where |
|---|---|---|
| Side-by-side cards (no vertical scroll between options) | ✅ | `Bracket.tsx` grid-cols-2 default |
| Big centre play button | ✅ | `BracketCard.tsx` `.absolute inset-0` |
| Round indicator + "X remain" | ✅ | `Bracket.tsx` round label |
| Final-round amber emphasis | ✅ | `Bracket.tsx` `isFinal` branch |
| Pair fade-in on advance | ✅ | `pa-fade-in` keyed on round-pairIdx |
| Champion pop-in + soft pulse | ✅ | `ChampionView` pa-pop-in / pa-pulse-soft |
| Keyboard ← → vote, ESC close player | ✅ | `Bracket.tsx` keydown listener |
| Resume in-progress brackets | ✅ | `/worldcup/InProgressCard.tsx` |
| Per-bracket stats (UGC) | ✅ | `/worldcup/community/[id]/stats` |
| **Champion → YT Music deep-link** | ✅ | `LikeInYtMusicButton` in Bracket.tsx |
| **Trending / time-windowed lists** | ✅ | `/worldcup/community?sort=trending\|popular\|new` |
| **AI-curated bracket lens** | ✅ | `/worldcup/curate/[size]` + `/api/worldcup/curate` |
| **Native share on result** | ✅ | `ShareChampionButton` (was shipped earlier; verified) |
| **Embeddable iframe** | ✅ | `/worldcup/community/[id]/embed` + EmbedCodeButton |
| **Community pulse on home (totals + top champions)** | ✅ | `/worldcup` `CommunityStatsBar` (R23a) |
| **Rolling-window plays + creator leaderboard** | ✅ | `community_worldcup_finishes` + `CommunityStatsBar` (R24d) |
| **Inline trending row on home** | ✅ | `/worldcup` `TrendingCommunityRow` (R23a) |
| **Bulk-import from YT playlist** | ✅ | `/api/worldcup/community/resolve-playlist` + import panel in CreateForm (R23b) |

## Anti-goals (deliberately NOT doing)

- **Vote on individual matches** (Reddit-style upvote per pair):
  conflates "I like this song" with "I beat this song". piku
  doesn't do it; we don't either.
- **Real-time multi-player brackets** (two users vote on the same
  bracket simultaneously, see each other's picks): cool but not
  in scope for music recap product.
- **Comments on community brackets**: comments need moderation,
  spam control, abuse reports — too much surface area for the
  current team size.

## How to use this document

When you ship a worldcup change, edit this file in the same PR:

1. If you closed a "Plan" item under Track A/B/C: move it from
   "Plan" to "What exists today" within that track, mark ✅ in
   the patterns table if applicable.
2. If you discovered a new gap during implementation: append it
   to the relevant "Gap" section.
3. Bump the "Last updated" date at top.
4. Update the "Status" line for the affected track.
