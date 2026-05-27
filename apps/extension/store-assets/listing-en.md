# Chrome Web Store listing — English

## Item name (≤ 75 chars)

Earprint — Music Zodiac + Taste DNA for YouTube Music

## Short description (≤ 132 chars)

Turn your YouTube Music liked songs into a Music Zodiac archetype, Taste DNA, interactive artist map, and personal song recommendations.

## Detailed description (≤ 16,000 chars)

**Earprint reads your own YouTube Music "Liked music" list and turns it into a portrait of how you actually listen — not the playlists the algorithm pushes at you, the music *you* picked.**

### What you get

After one sync (about 5–10 minutes for a 1,500-song library), the Earprint web app builds:

- **Music Zodiac** — your taste pattern matched to one of twelve archetypes (e.g. Riff Architect, Velvet Collector, Dream Diver). Reads like a personality card and pulls from real signals in your library: genre distribution, audio character, album immersion, recency tilt.
- **Taste DNA** — a research-grounded breakdown of your listening: novelty vs comfort, nostalgia window (which years anchor your taste), genre constellation, audio feel radar.
- **Interactive Artist Map** — your artists drawn as a constellation. Drag to explore, click an artist to see what they share with your favourites, drop in recommendations to fill the gaps.
- **Personal song recommendations** — Tinder-style rating loop. Liked tracks fold back into your library; passes drop the artist from future picks.
- **Music World Cup** — bracket your own library (random sample of 32 / 64 / 128 / 256) and find your real #1, or run a genre bracket to settle "do I actually prefer indie pop or city pop?".

### What this extension does

The extension is intentionally minimal:

1. You open YouTube Music's "Liked music" page in your own logged-in browser tab.
2. You click "Sync" in the extension popup.
3. The extension scrolls the page and reads the songs YouTube already displays to you — title, artist, album, like-order.
4. Your sync token (issued the first time you sign in on the website) sends those rows to your own Earprint account.

That's the whole permission model.

### What the extension never does

- **No password access.** Earprint never sees your Google or YouTube password — sign-in happens on the website via standard Google OAuth, the extension only ever uses a token tied to your own account.
- **No watch / play / search history.** We only read the songs you've explicitly marked as liked.
- **No background scraping.** Sync only fires when you click Sync.
- **No selling data, no ad networks, no analytics SDKs.** The Privacy Policy at earprint.kwanho.dev/privacy spells out every byte that leaves your browser.
- **Append-only.** Un-liking a song on YouTube Music doesn't erase it from your Earprint history — Earprint is "everything you've ever liked", not a live mirror.

### Why an extension at all?

YouTube Music doesn't expose a public "my liked songs" API the way Spotify does. The only way to read your own liked-music list is to be logged in to music.youtube.com and read the page YouTube already shows you. That's what the extension does, on your tab, on your click.

### Pricing

Free for everyone with a 500-song library cap. Paid tiers unlock larger libraries, the full AI psychology profile, and unlimited bracket runs. Pricing is in KRW for Korea and USD elsewhere — no subscription, you only pay when you choose to run a deeper analysis.

### Open & transparent

- Privacy Policy: https://earprint.kwanho.dev/privacy
- Terms of Service: https://earprint.kwanho.dev/terms
- Security & contact: https://earprint.kwanho.dev/security
- Source: https://github.com/KKWANH/earprint

### Permissions justification

- `storage` — saves your sync token locally so you don't re-paste it every time.
- `tabs` — finds your music.youtube.com tab when you click Sync.
- `host_permissions: music.youtube.com` — reads the rendered "Liked music" page on your tab.
- `host_permissions: *.kwanho.dev` — uploads the captured list to your Earprint account.

We do not request `<all_urls>`, `webRequest`, `cookies`, `history`, `bookmarks`, or anything outside the two specific hosts above.

### Built for

YouTube Music users who want the "Spotify Wrapped" feeling without leaving YouTube Music — and want it more often than once a year, with more depth, and with privacy you can actually verify.

---

**Languages**: English, Korean.

**Sync footprint**: A 1,500-song library uploads ~150 KB total. No background traffic between syncs.

**Open beta**. Feedback and bug reports: kwanho0096@gmail.com or via the GitHub Issues link above.
