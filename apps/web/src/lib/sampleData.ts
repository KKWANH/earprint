import type { LibraryStats } from "./library";
import type { AiProfile } from "./profile";

/**
 * Hand-crafted sample library + AI profile for the public /demo page. The
 * numbers are realistic for a 25-year-old indie/dream-pop listener — chosen
 * to land on Cancer (Indie Afterglow) so the zodiac card shows a strong match
 * rather than scattering across signs.
 *
 * NOT a real user — the page banner makes that clear.
 */
export const SAMPLE_STATS: LibraryStats = {
  total: 487,
  enriched: 463,
  missingGenres: 24,
  distinctArtists: 142,
  recentArtists: [
    { name: "Phoebe Bridgers", count: 12 },
    { name: "Mitski", count: 9 },
    { name: "Beabadoobee", count: 7 },
    { name: "Faye Webster", count: 6 },
    { name: "Big Thief", count: 5 },
  ],
  topArtists: [
    { name: "Mac DeMarco", count: 28 },
    { name: "Beach House", count: 24 },
    { name: "Phoebe Bridgers", count: 21 },
    { name: "Mitski", count: 19 },
    { name: "Boy Pablo", count: 17 },
    { name: "Cigarettes After Sex", count: 16 },
    { name: "Tame Impala", count: 14 },
    { name: "Clairo", count: 13 },
    { name: "Snail Mail", count: 11 },
    { name: "Soccer Mommy", count: 10 },
  ],
  topGenres: [
    { name: "indie pop", count: 92 },
    { name: "dream pop", count: 71 },
    { name: "bedroom pop", count: 58 },
    { name: "shoegaze", count: 44 },
    { name: "indie rock", count: 39 },
    { name: "slowcore", count: 28 },
    { name: "lo-fi", count: 24 },
    { name: "jangle pop", count: 21 },
    { name: "indie folk", count: 18 },
    { name: "alternative rock", count: 16 },
  ],
  topMoods: [
    { name: "nostalgic", count: 142 },
    { name: "dreamy", count: 118 },
    { name: "melancholic", count: 96 },
    { name: "romantic", count: 71 },
    { name: "introspective", count: 64 },
    { name: "wistful", count: 52 },
    { name: "bittersweet", count: 39 },
    { name: "hazy", count: 28 },
  ],
  topInstruments: [
    { name: "guitar", count: 312 },
    { name: "synthesizer", count: 198 },
    { name: "drums", count: 156 },
    { name: "bass", count: 134 },
    { name: "vocals (soft)", count: 89 },
  ],
  topAlbums: [
    { name: "Salad Days", count: 9 },
    { name: "Teen Dream", count: 8 },
    { name: "Punisher", count: 7 },
    { name: "Be the Cowboy", count: 6 },
    { name: "Bloom", count: 5 },
  ],
  topFamilies: [
    { id: "pop", label: "Pop", labelKo: "팝", count: 171,
      sample: ["indie pop", "bedroom pop", "jangle pop"] },
    { id: "ambient_experimental", label: "Ambient / Experimental", labelKo: "앰비언트/실험",
      count: 139, sample: ["dream pop", "shoegaze", "lo-fi"] },
    { id: "rock", label: "Rock", labelKo: "록", count: 83,
      sample: ["indie rock", "slowcore", "alternative rock"] },
    { id: "folk", label: "Folk / Singer-Songwriter", labelKo: "포크/싱어송라이터",
      count: 18, sample: ["indie folk"] },
  ],
  audioFeel: {
    analyzed: 463,
    energy: 0.42,
    tempo: 0.51,
    acousticness: 0.58,
  },
  albumDepth: {
    deepAlbums: 11,
    concentration: 0.34,
  },
  excludedArtists: [],
  tracks: [],
};

export const SAMPLE_PROFILE: AiProfile = {
  headline: "The Reverb-Drenched Romantic",
  personality:
    "You gravitate toward records that feel like a bedroom at 2 AM — soft-focus guitars, vocals half-buried in tape hiss, a kind of beautiful sadness that's also a kind of comfort. There's a clear thread of late-2010s indie running through your library, and you reach for it most when you want to feel something specific rather than be distracted.",
  traits: ["Introspective", "Nostalgic", "Texture-driven", "Quietly intense"],
  diggingScore: 76,
  diggingComment:
    "You go deeper than the algorithm's first-page picks — 142 distinct artists across 487 likes means you're not just looping the same five.",
  favoriteGenres: ["dream pop", "bedroom pop", "shoegaze", "indie folk"],
  avoidedGenres: ["EDM", "trap", "country"],
  unexploredGenres: ["post-punk", "ambient", "jazz fusion"],
  moodProfile:
    "Your mood map runs cool and reflective — nostalgia and dreamy textures dominate, with melancholy in close third. Almost no aggressive or party-mode energy, which tracks for a library built around late-night listening rather than gym playlists.",
  improvementTips: [
    "Try post-punk pioneers (Joy Division, The Cure's Faith era) — same emotional register as shoegaze, different harmonic palette.",
    "Ambient masters like Brian Eno or Stars of the Lid would extend your 'dreamy' core into pure-atmosphere territory.",
    "Modern jazz fusion (BadBadNotGood, Hiatus Kaiyote) intersects with the texture-driven side of dream pop more than people realize.",
  ],
  persona: {
    emoji: "🌫️",
    archetype: "Dream-pop romantic",
    name: "Reverb-Drenched Romantic",
    tagline: "Late-night feelings turned all the way up, vocals all the way down.",
  },
};
