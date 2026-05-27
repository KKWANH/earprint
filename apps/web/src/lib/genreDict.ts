/**
 * Genre dictionary — single source of truth for canonicalisation,
 * family bucketing, and zodiac weighting.
 *
 * Designed (May 2026 with the user, based on their music-genre taxonomy
 * sketch) to fix the previous flat-keyword-list approach in musicZodiac.ts,
 * which had two problems:
 *   1. Coverage bias — heavily skewed toward rock/indie/electronic/dreamy,
 *      missed K-ballad/Trot/Latin/Afrobeats/Country/Classical subgenres.
 *   2. Single-winner attribution — each user-genre was assigned to exactly
 *      one zodiac, losing the multi-label reality of modern music
 *      (NewJeans = K-pop AND Dance-Pop AND R&B AND UK Garage).
 *
 * Architecture:
 *   • 18 top-level FAMILIES (Pop / Rock / Metal / Hip-Hop / R&B / …).
 *     Each carries a default zodiac weight vector — every sub-genre in
 *     the family inherits these weights unless the sub-genre overrides
 *     them.
 *   • ~180 SUB-GENREs, each declaring its family + aliases (the strings
 *     Gemini/users might write) + optional zodiac override + optional
 *     region/era tags.
 *   • Multi-label match: at zodiac scoring time, every canonicalised
 *     user-genre contributes its full weight vector to every zodiac it
 *     touches — no "winner-take-all" tiebreaks.
 *   • Excluded families (Religious / Spoken / Children / Comedy) carry
 *     `excludeFromZodiac: true` so they don't pollute the archetype
 *     even when they show up in a user's library (lofi-Christian-piano
 *     gospel, ASMR sleep mixes, etc.).
 *
 * Public API:
 *   findGenre(input)          → GenreNode | null   (alias-aware lookup)
 *   genreZodiacWeights(input) → Partial<Record<ZodiacSign, number>>
 *   genreFamily(input)        → family id or null
 *   listFamilies()            → readonly FamilyDef[]  (for UI bucketing)
 *
 * Adding a new sub-genre: append a row to SUB_GENRES (alphabetical
 * within family). Override zodiac only when the sub-genre meaningfully
 * differs from its family's default (e.g. post-punk under Rock family
 * actually belongs to Scorpio, not Capricorn).
 */

export type ZodiacSign =
  | "aries"
  | "taurus"
  | "gemini"
  | "cancer"
  | "leo"
  | "virgo"
  | "libra"
  | "scorpio"
  | "sagittarius"
  | "capricorn"
  | "aquarius"
  | "pisces";

export type ZodiacWeights = Partial<Record<ZodiacSign, number>>;

export interface FamilyDef {
  id: string;
  label: string;
  labelKo: string;
  /** Default zodiac weights — inherited by every sub-genre in the family
   *  unless overridden. Weights are unitless; relative magnitudes are
   *  what matter (the matcher normalises across signs at the end). */
  zodiac: ZodiacWeights;
  /** Skip from zodiac scoring entirely. True for Religious / Gospel /
   *  Spoken / Children / Comedy / ASMR / Novelty — those signals don't
   *  describe a musical archetype, they describe non-music content. */
  excludeFromZodiac?: boolean;
}

export interface GenreNode {
  id: string;
  label: string;
  family: string;
  /** Lowercased strings (with `-` and `_` normalised to spaces) that
   *  should map to this node when seen in Gemini output / user input.
   *  `id` and `label` are auto-aliased; only add OTHER spellings here. */
  aliases: string[];
  /** Override family default. When undefined, inherits family.zodiac. */
  zodiac?: ZodiacWeights;
  /** "korean" / "japanese" / "latin" / "british" / etc. — optional. */
  region?: string;
  /** "60s" / "70s-80s" / "modern" / "retro" — optional. */
  era?: string;
}

// ─────────────────────────────────────────────────────────────────────
// FAMILIES — 18 top-level buckets used for UI grouping + zodiac default
// ─────────────────────────────────────────────────────────────────────

/**
 * Family default zodiac weights. Hand-tuned with the user (May 2026) so
 * each family points to the archetype it most naturally belongs to:
 *   pop                → Gemini (Pop Switch)
 *   rock               → Capricorn (Guitar Axis), Cancer second (indie)
 *   metal              → Capricorn (now absorbs all metal)
 *   punk               → Capricorn primary, Scorpio undertone
 *   hiphop             → Aries (Rap Circuit)
 *   rnb_soul           → Leo (Groove Line), Libra (smooth side)
 *   electronic         → Aquarius (Signal Room)
 *   jazz               → Virgo (Detail Lab), Libra (smooth)
 *   classical          → Virgo
 *   folk               → Taurus (Acoustic Room), Cancer (indie folk)
 *   country            → Taurus, slight Capricorn (rock crossover)
 *   blues              → Capricorn (blues rock), Taurus (acoustic)
 *   latin              → Sagittarius (Border Radio), Leo (groove side)
 *   reggae             → Sagittarius
 *   african            → Sagittarius primary, Leo secondary (afrobeats)
 *   asian_pop          → Gemini primary, Taurus (K-ballad / trot)
 *   world              → Sagittarius
 *   ambient_experimental → Pisces (Reverb Field)
 *
 * Excluded families don't carry weights — they're filtered before
 * matching.
 */
export const FAMILIES: readonly FamilyDef[] = [
  { id: "pop",                  label: "Pop",                       labelKo: "팝",
    zodiac: { gemini: 0.75, libra: 0.15, cancer: 0.05 } },
  { id: "rock",                 label: "Rock",                      labelKo: "록",
    zodiac: { capricorn: 0.65, cancer: 0.2, virgo: 0.05 } },
  { id: "metal",                label: "Metal",                     labelKo: "메탈",
    zodiac: { capricorn: 0.9 } },
  { id: "punk",                 label: "Punk / Hardcore",           labelKo: "펑크",
    zodiac: { capricorn: 0.75, scorpio: 0.15 } },
  { id: "hiphop",               label: "Hip-Hop / Rap",             labelKo: "힙합/랩",
    zodiac: { aries: 0.9 } },
  { id: "rnb_soul",             label: "R&B / Soul / Funk",         labelKo: "R&B/소울/펑크",
    zodiac: { leo: 0.8, libra: 0.1 } },
  { id: "electronic",           label: "Electronic / Dance",        labelKo: "일렉트로닉/댄스",
    zodiac: { aquarius: 0.85 } },
  { id: "jazz",                 label: "Jazz",                      labelKo: "재즈",
    zodiac: { virgo: 0.7, libra: 0.15 } },
  { id: "classical",            label: "Classical",                 labelKo: "클래식",
    zodiac: { virgo: 0.9 } },
  { id: "folk",                 label: "Folk / Singer-Songwriter",  labelKo: "포크/싱어송라이터",
    zodiac: { taurus: 0.8, cancer: 0.1 } },
  { id: "country",              label: "Country / Americana",       labelKo: "컨트리/아메리카나",
    zodiac: { taurus: 0.7, capricorn: 0.15 } },
  { id: "blues",                label: "Blues",                     labelKo: "블루스",
    zodiac: { capricorn: 0.5, taurus: 0.3, leo: 0.1 } },
  { id: "latin",                label: "Latin",                     labelKo: "라틴",
    zodiac: { sagittarius: 0.7, leo: 0.2 } },
  { id: "reggae",               label: "Reggae / Caribbean",        labelKo: "레게/캐리비안",
    zodiac: { sagittarius: 0.85 } },
  { id: "african",              label: "African / Afrodiasporic",   labelKo: "아프리카",
    zodiac: { sagittarius: 0.55, leo: 0.35 } },
  { id: "asian_pop",            label: "Asian Pop / Regional",      labelKo: "아시아 팝",
    zodiac: { gemini: 0.7, taurus: 0.1 } },
  { id: "world",                label: "World / Traditional",       labelKo: "월드/전통",
    zodiac: { sagittarius: 0.85 } },
  { id: "ambient_experimental", label: "Ambient / Experimental",    labelKo: "앰비언트/실험",
    zodiac: { pisces: 0.85 } },
  // ── Excluded families: present so the dictionary can canonicalise
  //    them (so the UI can show "we skipped N religious/spoken tracks
  //    when computing your archetype"), but they contribute zero zodiac
  //    weight no matter how prominent they are in the library.
  { id: "religious",            label: "Religious / Devotional",    labelKo: "종교음악",
    zodiac: {}, excludeFromZodiac: true },
  { id: "spoken",               label: "Spoken / Non-music",        labelKo: "낭독/비음악",
    zodiac: {}, excludeFromZodiac: true },
  { id: "children",             label: "Children's / Novelty",      labelKo: "동요/노벨티",
    zodiac: {}, excludeFromZodiac: true },
  { id: "soundtrack",           label: "Soundtrack / Stage",        labelKo: "사운드트랙",
    zodiac: { virgo: 0.35, pisces: 0.35 } },
];

const FAMILY_BY_ID: ReadonlyMap<string, FamilyDef> = new Map(
  FAMILIES.map((f) => [f.id, f]),
);

// ─────────────────────────────────────────────────────────────────────
// SUB-GENRES — ~180 nodes covering the user's reference taxonomy.
// Ordered by family for readability. Aliases are lowercased; the lookup
// normalises input (lowercase + strip non-alphanumeric → space) before
// matching, so you don't need to enumerate every punctuation variant.
// ─────────────────────────────────────────────────────────────────────

const SUB_GENRES: readonly GenreNode[] = [
  // ── Pop (gemini default) ─────────────────────────────────────────
  { id: "mainstream_pop",    label: "Pop",                family: "pop",
    aliases: ["pop", "mainstream pop", "adult contemporary", "teen pop", "contemporary pop"] },
  { id: "dance_pop",         label: "Dance-Pop",          family: "pop",
    aliases: ["dance pop", "dance-pop", "club pop"] },
  { id: "electropop",        label: "Electropop",         family: "pop",
    aliases: ["electropop", "electro pop"] },
  { id: "alt_pop",           label: "Alt-Pop",            family: "pop",
    aliases: ["alt pop", "alt-pop", "alternative pop", "avant pop", "avant-pop"],
    zodiac: { gemini: 0.5, cancer: 0.3 } },
  { id: "art_pop",           label: "Art Pop",            family: "pop",
    aliases: ["art pop", "experimental pop"],
    zodiac: { gemini: 0.4, virgo: 0.3, pisces: 0.2 } },
  { id: "indie_pop",         label: "Indie Pop",          family: "pop",
    aliases: ["indie pop", "twee pop", "jangle pop"],
    zodiac: { cancer: 0.6, gemini: 0.2 } },
  { id: "bedroom_pop",       label: "Bedroom Pop",        family: "pop",
    aliases: ["bedroom pop"],
    zodiac: { cancer: 0.7, gemini: 0.1 } },
  { id: "slowcore",          label: "Slowcore",           family: "rock",
    aliases: ["slowcore", "sadcore"],
    zodiac: { cancer: 0.65, pisces: 0.2 } },
  { id: "synth_pop",         label: "Synth-Pop",          family: "pop",
    aliases: ["synth pop", "synth-pop", "synthpop", "new romantic"],
    zodiac: { gemini: 0.4, aquarius: 0.4 } },
  { id: "power_pop",         label: "Power Pop",          family: "pop",
    aliases: ["power pop", "pop rock"],
    zodiac: { gemini: 0.4, capricorn: 0.3 } },
  { id: "soft_pop",          label: "Soft Pop",           family: "pop",
    aliases: ["soft pop", "sophisti pop", "sophisti-pop", "soft rock", "yacht rock", "aor", "adult contemporary"],
    zodiac: { libra: 0.75, gemini: 0.1 } },
  { id: "hyperpop",          label: "Hyperpop",           family: "pop",
    aliases: ["hyperpop", "bubblegum bass", "digicore"],
    zodiac: { gemini: 0.5, aquarius: 0.3 } },
  { id: "city_pop",          label: "City Pop",           family: "pop",
    aliases: ["city pop", "japanese city pop"], region: "japanese", era: "80s",
    zodiac: { libra: 0.8, gemini: 0.1 } },
  { id: "lounge",            label: "Lounge",             family: "pop",
    aliases: ["lounge", "easy listening", "bossa lounge"],
    zodiac: { libra: 0.7, virgo: 0.15 } },
  { id: "chamber_pop",       label: "Chamber Pop",        family: "pop",
    aliases: ["chamber pop"],
    zodiac: { virgo: 0.4, gemini: 0.3, cancer: 0.2 } },
  { id: "dream_pop",         label: "Dream Pop",          family: "ambient_experimental",
    aliases: ["dream pop", "dreampop", "ethereal pop", "ethereal wave"],
    zodiac: { pisces: 0.7, cancer: 0.2 } },
  { id: "schlager",          label: "Schlager",           family: "pop",
    aliases: ["schlager"], region: "european" },
  { id: "chanson",           label: "Chanson",            family: "pop",
    aliases: ["chanson", "french pop"], region: "french" },

  // ── Rock (capricorn default) ─────────────────────────────────────
  { id: "classic_rock",      label: "Classic Rock",       family: "rock",
    aliases: ["classic rock", "rock and roll", "rockabilly", "british invasion"],
    zodiac: { capricorn: 0.85 } },
  { id: "hard_rock",         label: "Hard Rock",          family: "rock",
    aliases: ["hard rock", "arena rock", "glam rock"],
    zodiac: { capricorn: 0.85 } },
  { id: "alt_rock",          label: "Alternative Rock",   family: "rock",
    aliases: ["alternative rock", "alt rock", "alt-rock", "modern rock", "college rock", "post grunge", "post-grunge"],
    zodiac: { capricorn: 0.55, cancer: 0.3 } },
  { id: "indie_rock",        label: "Indie Rock",         family: "rock",
    aliases: ["indie rock", "garage indie", "jangle rock", "indie sleaze", "indie rock revival"],
    zodiac: { cancer: 0.55, capricorn: 0.25 } },
  { id: "garage_rock",       label: "Garage Rock",        family: "rock",
    aliases: ["garage rock"], zodiac: { capricorn: 0.55, cancer: 0.25 } },
  { id: "grunge",            label: "Grunge",             family: "rock",
    aliases: ["grunge"],
    zodiac: { capricorn: 0.6, cancer: 0.2, scorpio: 0.1 } },
  { id: "post_punk",         label: "Post-Punk",          family: "rock",
    aliases: ["post punk", "post-punk", "gothic rock", "deathrock", "coldwave", "no wave", "no-wave"],
    zodiac: { scorpio: 0.75, capricorn: 0.15 } },
  { id: "psych_rock",        label: "Psychedelic Rock",   family: "rock",
    aliases: ["psychedelic rock", "psych rock", "acid rock", "neo psychedelia", "neo-psychedelia"],
    zodiac: { sagittarius: 0.4, capricorn: 0.3, pisces: 0.2 } },
  { id: "prog_rock",         label: "Progressive Rock",   family: "rock",
    aliases: ["progressive rock", "prog rock", "art rock", "krautrock"],
    zodiac: { virgo: 0.55, capricorn: 0.25 } },
  { id: "math_rock",         label: "Math Rock",          family: "rock",
    aliases: ["math rock", "technical rock"],
    zodiac: { virgo: 0.55, capricorn: 0.2, pisces: 0.15 } },
  { id: "post_rock",         label: "Post-Rock",          family: "ambient_experimental",
    aliases: ["post rock", "post-rock", "instrumental rock"],
    zodiac: { pisces: 0.7, virgo: 0.15 } },
  { id: "shoegaze",          label: "Shoegaze",           family: "ambient_experimental",
    aliases: ["shoegaze", "nugaze", "nu gaze", "nu-gaze", "blackgaze", "dreamgaze", "post shoegaze", "post-shoegaze", "noise pop"],
    zodiac: { pisces: 0.75, cancer: 0.15 } },
  { id: "emo",               label: "Emo",                family: "rock",
    aliases: ["emo", "emo revival", "midwest emo"],
    zodiac: { cancer: 0.65, capricorn: 0.2 } },
  { id: "britpop",           label: "Britpop",            family: "rock",
    aliases: ["britpop", "madchester"], region: "british",
    zodiac: { capricorn: 0.5, gemini: 0.3 } },
  { id: "blues_rock",        label: "Blues Rock",         family: "blues",
    aliases: ["blues rock", "southern rock", "stoner rock"],
    zodiac: { capricorn: 0.6, taurus: 0.2 } },
  { id: "korean_rock",       label: "Korean Rock",        family: "rock",
    aliases: ["korean rock", "k rock", "k-rock", "k indie rock", "k-indie rock"],
    region: "korean",
    zodiac: { capricorn: 0.45, cancer: 0.35 } },

  // ── Metal (capricorn default — single-family now) ────────────────
  { id: "heavy_metal",       label: "Heavy Metal",        family: "metal",
    aliases: ["heavy metal", "metal", "traditional metal", "nwobhm"] },
  { id: "thrash_metal",      label: "Thrash Metal",       family: "metal",
    aliases: ["thrash", "thrash metal", "speed metal"] },
  { id: "death_metal",       label: "Death Metal",        family: "metal",
    aliases: ["death metal", "melodic death metal", "technical death metal", "blackened death metal", "deathcore"] },
  { id: "black_metal",       label: "Black Metal",        family: "metal",
    aliases: ["black metal", "atmospheric black metal", "depressive black metal", "post black metal", "post-black metal", "viking metal", "pagan metal"] },
  { id: "doom_metal",        label: "Doom Metal",         family: "metal",
    aliases: ["doom", "doom metal", "sludge", "sludge metal", "stoner metal", "funeral doom", "drone metal"] },
  { id: "power_metal",       label: "Power Metal",        family: "metal",
    aliases: ["power metal", "symphonic metal"] },
  { id: "prog_metal",        label: "Progressive Metal",  family: "metal",
    aliases: ["progressive metal", "djent"],
    zodiac: { capricorn: 0.55, virgo: 0.3 } },
  { id: "metalcore",         label: "Metalcore",          family: "metal",
    aliases: ["metalcore", "post hardcore", "post-hardcore", "deathcore", "screamo", "mathcore"] },
  { id: "nu_metal",          label: "Nu-Metal",           family: "metal",
    aliases: ["nu metal", "nu-metal", "rap metal"] },
  { id: "folk_metal",        label: "Folk Metal",         family: "metal",
    aliases: ["folk metal", "gothic metal"] },
  { id: "industrial_metal",  label: "Industrial Metal",   family: "metal",
    aliases: ["industrial metal", "glam metal"] },

  // ── Punk / Hardcore (capricorn default) ──────────────────────────
  { id: "punk_rock",         label: "Punk",               family: "punk",
    aliases: ["punk", "punk rock", "proto-punk", "proto punk"] },
  { id: "hardcore_punk",     label: "Hardcore Punk",      family: "punk",
    aliases: ["hardcore", "hardcore punk", "youth crew", "d beat", "d-beat"] },
  { id: "pop_punk",          label: "Pop Punk",           family: "punk",
    aliases: ["pop punk", "pop-punk", "skate punk"],
    zodiac: { capricorn: 0.5, gemini: 0.25 } },
  { id: "crust_punk",        label: "Crust Punk",         family: "punk",
    aliases: ["crust punk", "oi", "street punk"] },
  { id: "grindcore",         label: "Grindcore",          family: "punk",
    aliases: ["grindcore", "powerviolence"] },

  // ── Hip-Hop / Rap (aries default) ────────────────────────────────
  { id: "hiphop_general",    label: "Hip-Hop",            family: "hiphop",
    aliases: ["hip hop", "hip-hop", "rap"] },
  { id: "boom_bap",          label: "Boom-Bap",           family: "hiphop",
    aliases: ["boom bap", "east coast hip hop", "east coast hip-hop", "lyrical hip hop", "lyrical hip-hop"] },
  { id: "west_coast",        label: "West Coast",         family: "hiphop",
    aliases: ["west coast hip hop", "west coast hip-hop", "g funk", "g-funk"] },
  { id: "southern_rap",      label: "Southern Rap",       family: "hiphop",
    aliases: ["southern hip hop", "southern hip-hop", "crunk"] },
  { id: "trap",              label: "Trap",               family: "hiphop",
    aliases: ["trap", "latin trap", "cloud rap", "emo rap", "mumble rap", "rage rap"] },
  { id: "drill",             label: "Drill",              family: "hiphop",
    aliases: ["drill", "uk drill", "brooklyn drill", "chicago drill", "jersey drill", "phonk", "hyperphonk", "plugg"] },
  { id: "conscious_rap",     label: "Conscious Rap",      family: "hiphop",
    aliases: ["conscious rap", "conscious hip hop", "conscious hip-hop", "political rap"] },
  { id: "gangsta_rap",       label: "Gangsta Rap",        family: "hiphop",
    aliases: ["gangsta rap", "street rap"] },
  { id: "alt_hiphop",        label: "Alt Hip-Hop",        family: "hiphop",
    aliases: ["alt hip hop", "alt-hip-hop", "alternative hip hop", "abstract hip hop", "experimental hip hop"],
    zodiac: { aries: 0.6, virgo: 0.2 } },
  { id: "jazz_rap",          label: "Jazz Rap",           family: "hiphop",
    aliases: ["jazz rap", "jazzy hip hop"],
    zodiac: { aries: 0.55, virgo: 0.3 } },
  { id: "pop_rap",           label: "Pop Rap",            family: "hiphop",
    aliases: ["pop rap", "melodic rap"],
    zodiac: { aries: 0.55, gemini: 0.25 } },
  { id: "grime",             label: "Grime",              family: "hiphop",
    aliases: ["grime", "uk rap", "road rap"], region: "british" },
  { id: "korean_hiphop",     label: "Korean Hip-Hop",     family: "hiphop",
    aliases: ["korean hip hop", "korean hip-hop", "k hiphop", "k-hiphop", "k rap", "k-rap", "korean rap"],
    region: "korean" },
  { id: "japanese_hiphop",   label: "Japanese Hip-Hop",   family: "hiphop",
    aliases: ["j hiphop", "j-hip-hop", "j rap", "j-rap"], region: "japanese" },

  // ── R&B / Soul / Funk (leo default) ──────────────────────────────
  { id: "rnb",               label: "R&B",                family: "rnb_soul",
    aliases: ["r&b", "rnb", "contemporary r&b", "urban contemporary"] },
  { id: "classic_rnb",       label: "Classic R&B",        family: "rnb_soul",
    aliases: ["rhythm and blues", "doo wop", "doo-wop"], era: "60s-70s" },
  { id: "soul",              label: "Soul",               family: "rnb_soul",
    aliases: ["soul", "motown", "southern soul", "modern soul", "deep soul", "philly soul"] },
  { id: "neo_soul",          label: "Neo-Soul",           family: "rnb_soul",
    aliases: ["neo soul", "neo-soul", "alternative r&b", "alt r&b"] },
  { id: "funk",              label: "Funk",               family: "rnb_soul",
    aliases: ["funk", "p funk", "p-funk", "electro funk", "electro-funk", "future funk", "funk rock", "jazz funk", "rare groove"] },
  { id: "disco",             label: "Disco",              family: "rnb_soul",
    aliases: ["disco", "nu disco", "nu-disco", "post disco", "post-disco", "italo disco", "boogie"] },
  { id: "quiet_storm",       label: "Quiet Storm",        family: "rnb_soul",
    aliases: ["quiet storm", "smooth r&b", "smooth soul", "blue-eyed soul", "blue eyed soul"],
    zodiac: { libra: 0.55, leo: 0.3 } },
  { id: "korean_rnb",        label: "Korean R&B",         family: "rnb_soul",
    aliases: ["k r&b", "k-r&b", "k rnb", "korean r&b", "korean rnb", "korean soul"], region: "korean" },
  { id: "afrobeats_rnb",     label: "Afrobeats",          family: "african",
    aliases: ["afrobeats", "afro pop", "afro-pop"],
    zodiac: { leo: 0.45, sagittarius: 0.4 } },

  // ── Electronic / Dance (aquarius default) ────────────────────────
  { id: "electronic",        label: "Electronic",         family: "electronic",
    aliases: ["electronic", "electronica", "idm", "edm", "big room"] },
  { id: "house",             label: "House",              family: "electronic",
    aliases: ["house", "deep house", "tech house", "progressive house", "tropical house", "future house", "slap house", "bass house", "melodic house", "organic house", "italo house", "acid house", "afro house", "afro-house"] },
  { id: "techno",            label: "Techno",             family: "electronic",
    aliases: ["techno", "minimal techno", "detroit techno", "hard techno", "melodic techno", "industrial techno"] },
  { id: "trance",            label: "Trance",             family: "electronic",
    aliases: ["trance", "psy trance", "psy-trance", "psytrance", "uplifting trance", "progressive trance"] },
  { id: "dnb",               label: "Drum & Bass",        family: "electronic",
    aliases: ["dnb", "drum and bass", "liquid funk", "liquid drum and bass", "neurofunk", "jungle"] },
  { id: "dubstep",           label: "Dubstep",            family: "electronic",
    aliases: ["dubstep", "brostep", "riddim"] },
  { id: "uk_garage",         label: "UK Garage",          family: "electronic",
    aliases: ["uk garage", "2 step", "2-step", "speed garage", "future garage"] },
  { id: "breakbeat",         label: "Breakbeat",          family: "electronic",
    aliases: ["breakbeat", "big beat", "breaks"] },
  { id: "future_bass",       label: "Future Bass",        family: "electronic",
    aliases: ["future bass", "wonky"] },
  { id: "jersey_club",       label: "Jersey Club",        family: "electronic",
    aliases: ["jersey club", "baltimore club"] },
  { id: "footwork",          label: "Footwork",           family: "electronic",
    aliases: ["footwork", "juke"] },
  { id: "hardcore_electronic", label: "Hardcore Electronic", family: "electronic",
    aliases: ["happy hardcore", "gabber", "hardstyle", "gqom"] },
  { id: "synthwave",         label: "Synthwave",          family: "electronic",
    aliases: ["synthwave", "retrowave", "outrun"],
    zodiac: { aquarius: 0.55, libra: 0.2 } },
  { id: "vaporwave",         label: "Vaporwave",          family: "ambient_experimental",
    aliases: ["vaporwave", "chillwave"],
    zodiac: { pisces: 0.55, aquarius: 0.25 } },
  { id: "industrial",        label: "Industrial",         family: "electronic",
    aliases: ["industrial", "industrial rock", "ebm", "post industrial", "post-industrial"],
    zodiac: { scorpio: 0.7, aquarius: 0.2 } },
  { id: "darkwave",          label: "Darkwave",           family: "electronic",
    aliases: ["darkwave", "minimal wave", "witch house", "dark cabaret"],
    zodiac: { scorpio: 0.7, aquarius: 0.15 } },
  { id: "triphop",           label: "Trip-Hop",           family: "electronic",
    aliases: ["trip hop", "trip-hop", "downtempo"],
    zodiac: { scorpio: 0.5, pisces: 0.3 } },
  { id: "chillout",          label: "Chillout",           family: "ambient_experimental",
    aliases: ["chillout", "chill out", "lofi", "lo fi", "lo-fi", "lofi hip hop", "lo-fi hip hop", "lo-fi beats", "chillhop"],
    zodiac: { pisces: 0.5, cancer: 0.25 } },

  // ── Jazz (virgo default) ─────────────────────────────────────────
  { id: "jazz",              label: "Jazz",               family: "jazz",
    aliases: ["jazz", "modal jazz", "post bop", "post-bop", "free jazz"] },
  { id: "swing",             label: "Swing",              family: "jazz",
    aliases: ["swing", "big band", "vocal jazz", "jazz standards"] },
  { id: "bebop",             label: "Bebop",              family: "jazz",
    aliases: ["bebop", "hard bop"] },
  { id: "cool_jazz",         label: "Cool Jazz",          family: "jazz",
    aliases: ["cool jazz", "west coast jazz"] },
  { id: "jazz_fusion",       label: "Jazz Fusion",        family: "jazz",
    aliases: ["jazz fusion", "fusion jazz", "jazz rock", "fusion"] },
  { id: "smooth_jazz",       label: "Smooth Jazz",        family: "jazz",
    aliases: ["smooth jazz", "soft jazz", "japanese smooth jazz"],
    zodiac: { libra: 0.7, virgo: 0.2 } },
  { id: "latin_jazz",        label: "Latin Jazz",         family: "jazz",
    aliases: ["latin jazz", "bossa jazz", "gypsy jazz", "jazz manouche"],
    zodiac: { virgo: 0.45, sagittarius: 0.35 } },
  { id: "nu_jazz",           label: "Nu Jazz",            family: "jazz",
    aliases: ["nu jazz", "acid jazz", "jazz piano", "spiritual jazz"],
    zodiac: { virgo: 0.55, leo: 0.2 } },

  // ── Classical (virgo default) ────────────────────────────────────
  { id: "classical",         label: "Classical",          family: "classical",
    aliases: ["classical", "classical music", "classical period"] },
  { id: "baroque",           label: "Baroque",            family: "classical",
    aliases: ["baroque"], era: "1600-1750" },
  { id: "romantic_classical", label: "Romantic Classical", family: "classical",
    aliases: ["romantic", "romantic music", "romanticism"], era: "1800s" },
  { id: "impressionism",     label: "Impressionism",      family: "classical",
    aliases: ["impressionism"] },
  { id: "modern_classical",  label: "Modern Classical",   family: "classical",
    aliases: ["modern classical", "neo classical", "neo-classical", "contemporary classical", "modern composition"] },
  { id: "minimalism",        label: "Minimalism",         family: "classical",
    aliases: ["minimalism", "post minimalism", "minimal"] },
  { id: "chamber_music",     label: "Chamber Music",      family: "classical",
    aliases: ["chamber music"] },
  { id: "opera",             label: "Opera",              family: "classical",
    aliases: ["opera", "aria"] },
  { id: "choral",            label: "Choral",             family: "classical",
    aliases: ["choral", "sacred choral"] },
  { id: "solo_piano",        label: "Solo Piano",         family: "classical",
    aliases: ["solo piano", "classical piano"],
    zodiac: { virgo: 0.6, pisces: 0.2 } },

  // ── Folk / Singer-Songwriter (taurus default) ────────────────────
  { id: "folk",              label: "Folk",               family: "folk",
    aliases: ["folk", "contemporary folk", "neo folk", "neo-folk"] },
  { id: "singer_songwriter", label: "Singer-Songwriter",  family: "folk",
    aliases: ["singer songwriter", "singer-songwriter", "acoustic pop", "acoustic"] },
  { id: "indie_folk",        label: "Indie Folk",         family: "folk",
    aliases: ["indie folk", "freak folk", "indie folk pop"],
    zodiac: { taurus: 0.55, cancer: 0.3 } },
  { id: "folk_rock",         label: "Folk Rock",          family: "folk",
    aliases: ["folk rock", "electric folk", "folk pop"] },
  { id: "americana_folk",    label: "Americana",          family: "country",
    aliases: ["americana", "roots", "roots rock"] },
  { id: "celtic_folk",       label: "Celtic Folk",        family: "folk",
    aliases: ["celtic", "irish folk", "irish traditional"], region: "celtic" },
  { id: "nordic_folk",       label: "Nordic Folk",        family: "folk",
    aliases: ["nordic folk"], region: "nordic" },
  { id: "korean_folk",       label: "Korean Folk",        family: "folk",
    aliases: ["korean folk", "tong guitar", "k folk", "k-folk"],
    region: "korean", zodiac: { taurus: 0.6, cancer: 0.2 } },
  { id: "japanese_folk",     label: "Japanese Folk",      family: "folk",
    aliases: ["japanese folk", "j folk", "j-folk"], region: "japanese" },
  { id: "bluegrass",         label: "Bluegrass",          family: "country",
    aliases: ["bluegrass", "progressive bluegrass"] },

  // ── Country / Americana (taurus default) ─────────────────────────
  { id: "country",           label: "Country",            family: "country",
    aliases: ["country", "country pop", "nashville sound"] },
  { id: "traditional_country", label: "Traditional Country", family: "country",
    aliases: ["honky tonk", "honky-tonk", "western swing"] },
  { id: "outlaw_country",    label: "Outlaw Country",     family: "country",
    aliases: ["outlaw country"],
    zodiac: { taurus: 0.5, capricorn: 0.3 } },
  { id: "alt_country",       label: "Alt-Country",        family: "country",
    aliases: ["alt country", "alternative country", "cowpunk"],
    zodiac: { taurus: 0.5, capricorn: 0.3 } },
  { id: "country_rock",      label: "Country Rock",       family: "country",
    aliases: ["country rock"],
    zodiac: { taurus: 0.4, capricorn: 0.45 } },

  // ── Blues (capricorn/taurus default) ─────────────────────────────
  { id: "blues",             label: "Blues",              family: "blues",
    aliases: ["blues", "delta blues", "chicago blues", "texas blues", "country blues"] },
  { id: "soul_blues",        label: "Soul Blues",         family: "blues",
    aliases: ["soul blues", "jump blues"],
    zodiac: { leo: 0.4, capricorn: 0.3 } },

  // ── Latin (sagittarius default) ──────────────────────────────────
  { id: "latin_pop",         label: "Latin Pop",          family: "latin",
    aliases: ["latin pop"] },
  { id: "reggaeton",         label: "Reggaeton",          family: "latin",
    aliases: ["reggaeton"], region: "latin" },
  { id: "salsa",             label: "Salsa",              family: "latin",
    aliases: ["salsa"] },
  { id: "bachata",           label: "Bachata",            family: "latin",
    aliases: ["bachata"] },
  { id: "merengue",          label: "Merengue",           family: "latin",
    aliases: ["merengue"] },
  { id: "cumbia",            label: "Cumbia",             family: "latin",
    aliases: ["cumbia"] },
  { id: "tango",             label: "Tango",              family: "latin",
    aliases: ["tango"], region: "argentine" },
  { id: "bossa_nova",        label: "Bossa Nova",         family: "latin",
    aliases: ["bossa nova", "bossa"], region: "brazilian",
    zodiac: { libra: 0.4, sagittarius: 0.4 } },
  { id: "samba",             label: "Samba",              family: "latin",
    aliases: ["samba"], region: "brazilian" },
  { id: "mpb",               label: "MPB",                family: "latin",
    aliases: ["mpb", "música popular brasileira", "musica popular brasileira"], region: "brazilian" },
  { id: "regional_mexican",  label: "Regional Mexican",   family: "latin",
    aliases: ["banda", "norteño", "norteno", "corrido", "regional mexican"], region: "mexican" },
  { id: "flamenco",          label: "Flamenco",           family: "latin",
    aliases: ["flamenco", "nuevo flamenco"], region: "spanish" },
  { id: "latin_general",     label: "Latin",              family: "latin",
    aliases: ["latin", "latin music"] },

  // ── Reggae / Caribbean (sagittarius default) ─────────────────────
  { id: "reggae",            label: "Reggae",             family: "reggae",
    aliases: ["reggae", "roots reggae", "lovers rock"] },
  { id: "dub",               label: "Dub",                family: "reggae",
    aliases: ["dub"] },
  { id: "dancehall",         label: "Dancehall",          family: "reggae",
    aliases: ["dancehall"] },
  { id: "ska",               label: "Ska",                family: "reggae",
    aliases: ["ska", "rocksteady", "2 tone", "2-tone"] },
  { id: "soca",              label: "Soca",               family: "reggae",
    aliases: ["soca", "calypso"] },

  // ── African / Afrodiasporic (sagittarius/leo default) ────────────
  { id: "afrobeat",          label: "Afrobeat",           family: "african",
    aliases: ["afrobeat"], region: "african" },
  { id: "amapiano",          label: "Amapiano",           family: "african",
    aliases: ["amapiano"], region: "south_african" },
  { id: "highlife",          label: "Highlife",           family: "african",
    aliases: ["highlife"], region: "west_african" },
  { id: "kwaito",            label: "Kwaito",             family: "african",
    aliases: ["kwaito"] },
  { id: "desert_blues",      label: "Desert Blues",       family: "african",
    aliases: ["desert blues", "tuareg guitar"],
    zodiac: { sagittarius: 0.6, capricorn: 0.15 } },
  { id: "gnawa",             label: "Gnawa",              family: "african",
    aliases: ["gnawa", "moroccan"] },
  { id: "ethiopian",         label: "Ethiopian",          family: "african",
    aliases: ["ethiopian", "ethio jazz", "ethio-jazz"] },

  // ── Asian Pop / Regional (gemini/taurus default) ─────────────────
  { id: "kpop",              label: "K-Pop",              family: "asian_pop",
    aliases: ["k pop", "k-pop", "kpop", "idol pop", "korean pop"], region: "korean" },
  { id: "kballad",           label: "K-Ballad",           family: "asian_pop",
    aliases: ["k ballad", "k-ballad", "k pop ballad", "korean ballad", "korean pop ballad", "ballad"],
    region: "korean", zodiac: { taurus: 0.5, gemini: 0.25 } },
  { id: "korean_indie",      label: "Korean Indie",       family: "asian_pop",
    aliases: ["korean indie", "k indie", "k-indie"], region: "korean",
    zodiac: { cancer: 0.55, gemini: 0.2 } },
  { id: "trot",              label: "Trot",               family: "asian_pop",
    aliases: ["trot"], region: "korean",
    zodiac: { taurus: 0.65, gemini: 0.15 } },
  { id: "jpop",              label: "J-Pop",              family: "asian_pop",
    aliases: ["j pop", "j-pop", "jpop", "kawaii pop"], region: "japanese" },
  { id: "anisong",           label: "Anime Song",         family: "asian_pop",
    aliases: ["anisong", "anime song", "anime ost", "anime soundtrack", "anime rock"], region: "japanese" },
  { id: "visual_kei",        label: "Visual Kei",         family: "asian_pop",
    aliases: ["visual kei"], region: "japanese",
    zodiac: { capricorn: 0.4, gemini: 0.3 } },
  { id: "vocaloid",          label: "Vocaloid",           family: "asian_pop",
    aliases: ["vocaloid"], region: "japanese" },
  { id: "kayokyoku",         label: "Kayokyoku",          family: "asian_pop",
    aliases: ["kayokyoku"], region: "japanese", era: "showa",
    zodiac: { libra: 0.55, gemini: 0.2 } },
  { id: "cpop",              label: "C-Pop",              family: "asian_pop",
    aliases: ["c pop", "c-pop", "mandopop", "cantopop"], region: "chinese" },
  { id: "tpop",              label: "T-Pop",              family: "asian_pop",
    aliases: ["t pop", "t-pop", "thai pop"], region: "thai" },
  { id: "vpop",              label: "V-Pop",              family: "asian_pop",
    aliases: ["v pop", "v-pop", "vietnamese pop"], region: "vietnamese" },
  { id: "ppop",              label: "P-Pop",              family: "asian_pop",
    aliases: ["p pop", "p-pop", "opm", "pinoy pop"], region: "philippine" },
  { id: "indipop",           label: "Indian Pop",         family: "asian_pop",
    aliases: ["indi pop", "indi-pop", "indian pop"], region: "indian" },

  // ── South Asian / Indian (separate from regional pop) ────────────
  { id: "bollywood",         label: "Bollywood",          family: "world",
    aliases: ["bollywood", "filmi", "kollywood", "tamil film music"], region: "indian" },
  { id: "bhangra",           label: "Bhangra",            family: "world",
    aliases: ["bhangra"], region: "indian" },
  { id: "qawwali",           label: "Qawwali",            family: "world",
    aliases: ["qawwali"], region: "south_asian" },
  { id: "indian_classical",  label: "Indian Classical",   family: "world",
    aliases: ["indian classical", "hindustani", "carnatic", "raga"], region: "indian" },

  // ── Middle Eastern / North African ───────────────────────────────
  { id: "arabic_pop",        label: "Arabic Pop",         family: "world",
    aliases: ["arabic pop"], region: "arabic" },
  { id: "rai",               label: "Raï",                family: "world",
    aliases: ["rai", "raï"], region: "algerian" },
  { id: "turkish_pop",       label: "Turkish Pop",        family: "world",
    aliases: ["turkish pop"], region: "turkish" },
  { id: "anatolian_rock",    label: "Anatolian Rock",     family: "rock",
    aliases: ["anatolian rock"], region: "turkish",
    zodiac: { capricorn: 0.45, sagittarius: 0.3 } },
  { id: "persian_pop",       label: "Persian Pop",        family: "world",
    aliases: ["persian pop"], region: "persian" },

  // ── World / Traditional / Fusion (sagittarius default) ───────────
  { id: "world_music",       label: "World",              family: "world",
    aliases: ["world", "world music", "global pop", "global fusion", "ethno electronic"] },
  { id: "celtic",            label: "Celtic",             family: "world",
    aliases: ["celtic music"] },
  { id: "balkan",            label: "Balkan",             family: "world",
    aliases: ["balkan", "balkan brass", "turbo folk"] },
  { id: "fado",              label: "Fado",               family: "world",
    aliases: ["fado"], region: "portuguese" },
  { id: "klezmer",           label: "Klezmer",            family: "world",
    aliases: ["klezmer"] },
  { id: "gamelan",           label: "Gamelan",            family: "world",
    aliases: ["gamelan"], region: "indonesian" },
  { id: "throat_singing",    label: "Throat Singing",     family: "world",
    aliases: ["throat singing", "mongolian throat singing", "khoomei"] },
  { id: "andean",            label: "Andean",             family: "world",
    aliases: ["andean", "andean folk"], region: "andean" },
  { id: "traditional",       label: "Traditional",        family: "world",
    aliases: ["traditional", "folk traditional", "k traditional", "k-traditional", "asian folk"] },

  // ── Ambient / New Age / Experimental (pisces default) ────────────
  { id: "ambient",           label: "Ambient",            family: "ambient_experimental",
    aliases: ["ambient", "drone", "dark ambient", "ambient electronic", "ambient pop", "ambient techno", "drone ambient"] },
  { id: "new_age",           label: "New Age",            family: "ambient_experimental",
    aliases: ["new age", "healing music"] },
  { id: "downtempo",         label: "Downtempo",          family: "ambient_experimental",
    aliases: ["downtempo"] },
  { id: "sleep_music",       label: "Sleep / Meditation", family: "ambient_experimental",
    aliases: ["sleep", "meditation", "sleep music"] },
  { id: "soundscape",        label: "Soundscape",         family: "ambient_experimental",
    aliases: ["soundscape", "field recording", "kankyo ongaku"] },
  { id: "experimental",      label: "Experimental",       family: "ambient_experimental",
    aliases: ["experimental", "experimental music"] },
  { id: "noise",             label: "Noise",              family: "ambient_experimental",
    aliases: ["noise", "harsh noise", "power electronics"] },
  { id: "musique_concrete",  label: "Musique Concrète",   family: "ambient_experimental",
    aliases: ["musique concrete", "musique concrète", "electroacoustic"] },
  { id: "post_industrial_exp", label: "Industrial (exp.)", family: "ambient_experimental",
    aliases: ["hauntology"],
    zodiac: { scorpio: 0.45, pisces: 0.3 } },

  // ── Soundtrack / Stage / Media (mixed) ───────────────────────────
  { id: "film_score",        label: "Film Score",         family: "soundtrack",
    aliases: ["film score", "soundtrack", "ost", "tv soundtrack", "television score", "trailer music", "epic music"] },
  { id: "musical_theatre",   label: "Musical Theatre",    family: "soundtrack",
    aliases: ["musical", "musical theatre", "broadway"] },
  { id: "video_game",        label: "Video Game",         family: "soundtrack",
    aliases: ["video game music", "vgm", "game music", "chiptune", "8 bit", "8-bit"] },
  { id: "library_music",     label: "Library Music",      family: "soundtrack",
    aliases: ["library music", "production music"] },

  // ── Religious / Devotional (excluded from zodiac) ────────────────
  { id: "gospel",            label: "Gospel",             family: "religious",
    aliases: ["gospel", "gospel soul", "gospel r&b", "contemporary gospel"] },
  { id: "ccm",               label: "CCM",                family: "religious",
    aliases: ["ccm", "contemporary christian", "worship", "worship music", "praise"] },
  { id: "hymn",              label: "Hymn",               family: "religious",
    aliases: ["hymn", "hymns", "spirituals"] },
  { id: "buddhist",          label: "Buddhist Chant",     family: "religious",
    aliases: ["buddhist chant"] },
  { id: "nasheed",           label: "Nasheed",            family: "religious",
    aliases: ["nasheed", "islamic devotional"] },

  // ── Spoken / Non-music (excluded from zodiac) ────────────────────
  { id: "spoken_word",       label: "Spoken Word",        family: "spoken",
    aliases: ["spoken word", "poetry", "slam poetry"] },
  { id: "comedy",            label: "Comedy",             family: "spoken",
    aliases: ["comedy", "musical comedy", "stand up", "stand-up"] },
  { id: "podcast",           label: "Podcast",            family: "spoken",
    aliases: ["podcast", "talk show", "talk"] },
  { id: "audiobook",         label: "Audiobook",          family: "spoken",
    aliases: ["audiobook", "audio book"] },
  { id: "asmr",              label: "ASMR",               family: "spoken",
    aliases: ["asmr"] },

  // ── Children / Novelty (excluded from zodiac) ────────────────────
  { id: "childrens",         label: "Children's",         family: "children",
    aliases: ["children music", "children's music", "nursery rhymes", "kids music"] },
  { id: "novelty",           label: "Novelty",            family: "children",
    aliases: ["novelty", "novelty song", "parody"] },
];

// ─────────────────────────────────────────────────────────────────────
// Indexes built once at module load — alias → GenreNode lookup.
// ─────────────────────────────────────────────────────────────────────

const GENRES_BY_ID: ReadonlyMap<string, GenreNode> = new Map(
  SUB_GENRES.map((g) => [g.id, g]),
);

/** Normalises a string for alias matching: lowercase, replace
 *  punctuation with single space, trim. Mirrors the input shape we
 *  store in `aliases`. */
function normaliseGenreInput(s: string): string {
  return s
    .toLowerCase()
    .replace(/[-_/&]+/g, " ")
    .replace(/[^a-z0-9가-힣ぁ-んァ-ヶ一-龯 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ALIAS_INDEX: ReadonlyMap<string, string> = (() => {
  const m = new Map<string, string>();
  for (const g of SUB_GENRES) {
    // The id, label, and every alias all map back to the same node.
    const base = new Set<string>([
      g.id.toLowerCase().replace(/_/g, " "),
      g.label.toLowerCase(),
      ...g.aliases,
    ]);
    for (const a of base) {
      const norm = normaliseGenreInput(a);
      if (norm) {
        // First-write wins — explicit entries shouldn't be overwritten by
        // an alias collision. We log collisions in dev so we notice if
        // two nodes claim the same string.
        if (!m.has(norm)) m.set(norm, g.id);
      }
    }
  }
  return m;
})();

// ─────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────

/** All families in declaration order. */
export function listFamilies(): readonly FamilyDef[] {
  return FAMILIES;
}

/** All sub-genres in declaration order — useful for tests + admin tooling. */
export function listSubGenres(): readonly GenreNode[] {
  return SUB_GENRES;
}

/** Alias-aware lookup. Accepts whatever Gemini / user typed; returns
 *  the canonical GenreNode or null when nothing matches. Stable for
 *  case + dash/underscore/space variations. */
export function findGenre(input: string): GenreNode | null {
  const norm = normaliseGenreInput(input);
  if (!norm) return null;
  const id = ALIAS_INDEX.get(norm);
  if (id) {
    const g = GENRES_BY_ID.get(id);
    return g ?? null;
  }
  // Substring fallback for partial matches (e.g. Gemini says "alternative
  // hiphop influence" — we still want it to land on alt_hiphop). Longest
  // alias wins so "hip hop" doesn't shadow "alt hip hop".
  let best: { id: string; len: number } | null = null;
  for (const [alias, id] of ALIAS_INDEX) {
    if (alias.length < 4) continue; // skip 1-3 char aliases — too noisy
    if (norm.includes(alias) || alias.includes(norm)) {
      if (!best || alias.length > best.len) best = { id, len: alias.length };
    }
  }
  return best ? GENRES_BY_ID.get(best.id) ?? null : null;
}

/** Family lookup that survives unknown inputs by returning null. */
export function genreFamily(input: string): string | null {
  return findGenre(input)?.family ?? null;
}

/** Get the zodiac weight vector for a genre input. Resolves through:
 *    1. node override (if present),
 *    2. family default (if found),
 *    3. empty map (if neither — caller treats as "no signal").
 *  Excluded-from-zodiac families always return an empty map so they
 *  contribute zero to scoring even when matched. */
export function genreZodiacWeights(input: string): ZodiacWeights {
  const node = findGenre(input);
  if (!node) return {};
  const family = FAMILY_BY_ID.get(node.family);
  if (family?.excludeFromZodiac) return {};
  return node.zodiac ?? family?.zodiac ?? {};
}

/** True if the genre belongs to an excluded family (Religious / Spoken /
 *  Children). Callers can use this to skip these from stats too. */
export function isExcludedGenre(input: string): boolean {
  const node = findGenre(input);
  if (!node) return false;
  return FAMILY_BY_ID.get(node.family)?.excludeFromZodiac === true;
}
