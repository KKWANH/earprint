# UX Audit & Hardening — R37

A use-case → feature mapping for general (non-power) users, plus the
edge-case findings + fixes from this round. Living doc; update when
the gaps below close.

## Part 1 — General-user use cases vs current features

Rated by how well Earprint serves the *casual* user who just wants
something fun, not the data nerd.

| # | Use case ("I want to…") | Feature | Fit | Gap |
|---|---|---|---|---|
| 1 | "See what my music taste says about me" | /profile AI psychology + Music Zodiac | ✅ strong | Needs YT Music sync first — high barrier (extension install) |
| 2 | "Find my #1 favorite song" | /worldcup library bracket | ✅ strong | — |
| 3 | "Kill 5 minutes with a fun music game" | /worldcup community brackets | ✅ strong | Discovery: need more seeded community content (R34 samples help) |
| 4 | "Discover new music I'll like" | /recommend Tinder-swipe | ✅ strong | Cold-start: needs library first |
| 5 | "Share my result with friends" | Champion OG image + share button | ✅ good | Worldcup champion share works; profile share works |
| 6 | "Browse music by genre / learn about a genre" | /genres + /genre/[name] + Wikipedia | ✅ good (R37) | Was buried; now in nav (R32f) |
| 7 | "Make a bracket about MY favorite artist" | /worldcup/community/create + YT playlist import | ✅ good | 128/256 now supported (R34); draft autosave (R36) |
| 8 | "Use it without installing anything" | ❌ | ⚠️ weak | Extension OR Spotify required. Spotify currently disabled (Premium). A demo mode exists (/demo) but isn't personalized |
| 9 | "Come back and see what's new" | Trending row + recent results feed | ✅ good (R33/R35) | No push/email re-engagement (by design — no Resend) |
| 10 | "Compete / compare with others" | Creator leaderboard + /u profiles | 🟡 partial | No head-to-head; no "your taste vs friend" compare |

### Biggest casual-user gap: **onboarding friction (use case #8)**
The entire value chain requires a synced library, which requires the
Chrome extension (or Spotify, currently off). A casual visitor who
won't install an extension hits a wall. Candidate fixes (not done
this round):
- A richer /demo that runs the whole flow on a sample library so a
  visitor experiences worldcup + profile before committing.
- "Paste your YT Music Liked playlist URL" one-shot import (needs
  the YT Data API playlist path we already built for community).

## Part 2 — Edge cases found + fixed this round

### 2.1 Genre weight cast could 500 the genre pages (FIXED)
`/genres` + `/genre/[name]` filtered on `(value)::text::float >=
0.30`. Postgres does **not** guarantee `AND` short-circuits, so a
single legacy row with a non-numeric genre weight (string value)
would throw and 500 the whole page. Wrapped the cast in a
`CASE WHEN jsonb_typeof(value)='number'` guard + try/catch around
`getAllGenres` (degrades to empty list).

### 2.2 Genre alias fragmentation (FIXED — the headline R37 work)
`analysis.genres` JSONB stores RAW Gemini keys, so "synthpop" and
"synth-pop" appeared as separate rows in /genres. Now canonicalized
through genreDict at read time (canonicalGenreKey / Label) and
re-aggregated, and /genre/[name] alias-matches every spelling
variant. Family grouping added.

### 2.3 Genre dict dead nodes (FIXED via tests)
The new vitest suite caught 5 candidate sub-genre additions
(arena_rock, contemporary_rnb, soundtrack_score, acoustic,
modern_rock) whose aliases already resolved to pre-existing entries
— they'd have been unreachable dead nodes. Removed. Also caught a
duplicate-id typo (synthwave) before it shipped; added a
module-load duplicate-id guard so it can't regress.

### 2.4 Swipe gesture hijacked form controls (FIXED in R36)
Bracket SwipeArea started a drag even on textarea/button taps.
Now early-returns on form-control targets.

## Part 3 — Open edge cases (NOT yet fixed — backlog)

- **EC-1**: `/worldcup/community/recent` infinite scroll uses
  `finished_at < cursor`. Two finishes at the exact same timestamp
  on a page boundary could skip a row. Low impact; would need a
  composite (finished_at, id) cursor to fully fix.
- **EC-2**: Community create form draft (R36) is per-browser
  localStorage — switching device loses it. Acceptable.
- **EC-3**: `genre_views` counter increments on every render incl.
  the owner's own repeat visits + bots. Not deduped. Inflates
  counts; harmless for a vanity metric.
- **EC-4**: Spotify sync `MAX_LIKED_PAGES=20` (1000 tracks) silently
  caps; user with a 5000-song library must re-run 5×. The UI does
  surface "more to fetch — click again" so it's not silent, but a
  one-click "sync everything" loop would be friendlier.
- **EC-5**: `/recommend` auto-pick "best mode" needs ≥5 ratings in
  a mode; brand-new users never see it. By design but worth a
  "rate a few to unlock" hint.
- **EC-6**: Worldcup bracket localStorage resume keys
  (`pa-wc:cat:size:firstId`) never expire — a user who abandons
  dozens of brackets accumulates cruft. InProgressCard shows them
  all. Minor.

## Part 4 — Test coverage added (R37)

vitest installed; `pnpm test`. Pure-function suites:
- `genreDict.test.ts` (32 tests) — alias resolution, variant
  merging, canonical label/key, match keys, family mapping,
  dedup integrity, the alias-conflict fixes.
- `youtubeId.test.ts` (11) — all URL shapes + rejection cases.
- `youtube-playlist.test.ts` (9) — playlist id extraction + the
  private-playlist (LM/WL) guard.

### Test backlog (need DB mocking or are integration-shaped):
- deezer scoreMatch / confidence weighting (pure — easy add next)
- recommend candidate dedup/filter logic (needs refactor to
  extract pure core from the SQL-coupled generateRecommendations)
- the genre weight-floor SQL (needs a test DB / pglite)
- end-to-end "test user" flows (needs a seeded test DB + Playwright)
