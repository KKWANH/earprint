import type { LibraryStats } from "./library";

/**
 * Music zodiac — twelve listener archetypes derived from the user's top
 * genres and moods. The label set was tuned with the user (May 2026) so
 * each sign reads as a recognisable *role* rather than a personality
 * description: "Rap Circuit", "Reverb Field", etc. Genre lists carry
 * the matching signal; the archetype + blurb carry the framing.
 *
 * Genre attribution is single-winner — each user genre is attributed
 * to the one sign with the most specific matching keyword, so e.g.
 * "indie rock" doesn't double-count into both `indie` (Cancer) and
 * `rock` (Capricorn).
 *
 * Per-sign breakdown is computed too so the UI can show "how much of
 * you" lands on every sign, not just the winner.
 */
export interface Star {
  x: number;
  y: number;
}
export interface Constellation {
  stars: Star[];
  edges: [number, number][];
}

/** Sub-flavor cluster within one zodiac. Most signs contain several
 *  recognisably different musical worlds (Virgo's jazz vs. classical,
 *  Aquarius's house vs. dnb, etc.) and the user usually sits firmly in
 *  one of them. Surfacing that gives a more honest read than the umbrella
 *  archetype alone. */
export interface ZodiacFlavor {
  key: string;
  nameKo: string;
  nameEn: string;
  /** Subset of the parent zodiac's `genres` list this flavor claims. */
  genres: string[];
}

export interface Zodiac {
  sign: string;
  symbol: string;
  nameKo: string;
  nameEn: string;
  archetypeKo: string;
  archetypeEn: string;
  blurbKo: string;
  blurbEn: string;
  genres: string[];
  moods: string[];
  /** Optional sub-archetypes. The matcher picks the flavor whose genre
   *  share of the winning sign's matches is largest, with a margin
   *  threshold so we don't over-claim on a single track. */
  flavors?: ZodiacFlavor[];
  constellation: Constellation;
}

export interface ZodiacMatched {
  name: string;
  type: "genre" | "mood";
}

export interface SignBreakdown {
  sign: string;
  share: number; // 0..1 of total matched + unmatched signal
  matched: ZodiacMatched[];
}

export interface FlavorShare {
  key: string;
  nameKo: string;
  nameEn: string;
  /** This flavor's share of the winning sign's matched genre signal
   *  (i.e. share within the sign, not against the whole library). */
  share: number;
}

export interface MusicZodiac {
  zodiac: Zodiac;
  matched: ZodiacMatched[];
  share: number;
  breakdown: SignBreakdown[];
  /** Picked flavor within the winning zodiac (or null when the share is
   *  too even to call). Display as a suffix to the main archetype. */
  flavor: FlavorShare | null;
  /** Every flavor with a non-zero share inside the winning sign, sorted
   *  desc. Used by the UI to draw a breakdown chart so a Virgo split
   *  between Jazz (55%) and Classical (45%) reads as the near-tie that
   *  it is, not a clean win. Empty when the sign has no flavors defined
   *  or no matches landed in any flavor. */
  flavorBreakdown: FlavorShare[];
}

export const ALL_ZODIACS: Zodiac[] = [
  {
    sign: "aries",
    symbol: "♈",
    nameKo: "양자리",
    nameEn: "Aries",
    archetypeKo: "비트 드라이브",
    archetypeEn: "Rap Circuit",
    blurbKo: "랩과 비트의 타격감으로 움직이는 청취.",
    blurbEn: "Rap and beats — built around the hit of the kick.",
    genres: [
      "hip-hop", "hip hop", "rap", "trap", "conscious rap",
      "alternative hip hop", "alt-hip-hop", "boom bap", "drill", "mumble rap",
      "lyrical hip hop", "gangsta rap", "west coast hip hop",
      "east coast hip hop", "southern hip hop", "korean hip hop", "k-rap",
      "k-hiphop", "cloud rap", "emo rap", "uk drill", "phonk", "hyperphonk",
      "plugg", "rage rap", "grime", "road rap", "jersey drill",
      "brooklyn drill", "chicago drill", "j-hip-hop", "j-rap",
      "latin trap", "afro-rap", "abstract hip hop",
    ],
    moods: ["confident", "fierce", "gritty", "swagger", "hype", "narrative"],
    constellation: {
      stars: [{ x: 10, y: 75 }, { x: 32, y: 50 }, { x: 60, y: 35 }, { x: 88, y: 48 }],
      edges: [[0, 1], [1, 2], [2, 3]],
    },
  },
  {
    sign: "taurus",
    symbol: "♉",
    nameKo: "황소자리",
    nameEn: "Taurus",
    archetypeKo: "어쿠스틱 라인",
    archetypeEn: "Acoustic Room",
    blurbKo: "통기타와 한 목소리 — 가사가 들리는 청취.",
    blurbEn: "One guitar, one voice — songs where the words land.",
    genres: [
      "folk", "acoustic", "country", "alt-country", "country pop",
      "outlaw country", "singer-songwriter", "ballad", "americana",
      "indie folk", "folk rock", "folk pop", "bluegrass", "k-ballad",
      "trot", "acoustic pop", "neo-folk", "anti-folk", "contemporary folk",
      "japanese folk",
    ],
    moods: ["warm", "cozy", "calm", "gentle", "soft", "intimate", "peaceful", "tender"],
    constellation: {
      stars: [{ x: 18, y: 18 }, { x: 38, y: 38 }, { x: 50, y: 60 }, { x: 62, y: 38 }, { x: 82, y: 18 }],
      edges: [[0, 1], [1, 2], [2, 3], [3, 4]],
    },
  },
  {
    sign: "gemini",
    symbol: "♊",
    nameKo: "쌍둥이자리",
    nameEn: "Gemini",
    archetypeKo: "팝 스위치",
    archetypeEn: "Pop Switch",
    blurbKo: "장르를 자유로이 옮겨 다니는 후크 중심의 팝.",
    blurbEn: "Hook-driven pop, channel-flipped across genres.",
    genres: [
      "k-pop", "j-pop", "c-pop", "mandopop", "v-pop", "t-pop", "latin pop",
      "dance-pop", "electropop", "art pop", "synth-pop", "synthpop",
      "hyperpop", "bubblegum pop", "teen pop", "alt-pop", "chamber pop",
      "power pop", "twee pop", "future pop", "kawaii pop", "indo-pop",
      "korean pop ballad", "k-pop ballad",
    ],
    moods: ["playful", "upbeat", "fun", "bright", "cheerful", "catchy", "uplifting"],
    constellation: {
      stars: [
        { x: 28, y: 18 }, { x: 28, y: 50 }, { x: 28, y: 82 },
        { x: 72, y: 18 }, { x: 72, y: 50 }, { x: 72, y: 82 },
      ],
      edges: [[0, 1], [1, 2], [3, 4], [4, 5], [0, 3]],
    },
  },
  {
    sign: "cancer",
    symbol: "♋",
    nameKo: "게자리",
    nameEn: "Cancer",
    archetypeKo: "인디 무드",
    archetypeEn: "Indie Afterglow",
    blurbKo: "조용한 인디, 감정선이 길게 남는 청취.",
    blurbEn: "Bedroom-quiet indie that lingers.",
    genres: [
      "indie", "indie pop", "indie rock", "bedroom pop", "lo-fi",
      "slowcore", "sadcore", "emo", "emo revival", "midwest emo",
      "jangle pop", "korean indie", "japanese indie", "indie folk pop",
      "indie sleaze", "indie ballad", "indie soul",
    ],
    moods: [
      "melancholic", "nostalgic", "emotional", "introspective", "sad",
      "wistful", "bittersweet", "longing", "yearning", "reflective",
    ],
    constellation: {
      stars: [{ x: 28, y: 22 }, { x: 72, y: 22 }, { x: 50, y: 50 }, { x: 50, y: 82 }],
      edges: [[0, 2], [1, 2], [2, 3]],
    },
  },
  {
    sign: "leo",
    symbol: "♌",
    nameKo: "사자자리",
    nameEn: "Leo",
    archetypeKo: "그루브 라인",
    archetypeEn: "Groove Line",
    blurbKo: "그루브와 보컬 중심 — 소울·펑크·R&B.",
    blurbEn: "Groove first, voice front — soul, funk, R&B in motion.",
    genres: [
      "disco", "funk", "soul", "r&b", "neo-soul", "motown", "nu-disco",
      "post-disco", "future funk", "electro-funk", "jazz funk", "funk rock",
      "g-funk", "afrobeats", "alternative r&b", "contemporary r&b",
      "hip-hop soul", "rare groove", "boogie", "blue-eyed soul",
      "modern soul", "deep soul", "southern soul", "philly soul",
      "k-r&b", "korean soul", "italo disco",
    ],
    moods: ["groovy", "confident", "danceable", "celebratory", "joyful", "smooth", "lively", "festive"],
    constellation: {
      stars: [
        { x: 18, y: 32 }, { x: 30, y: 16 }, { x: 50, y: 16 },
        { x: 66, y: 30 }, { x: 76, y: 55 }, { x: 70, y: 82 },
      ],
      edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]],
    },
  },
  {
    sign: "virgo",
    symbol: "♍",
    nameKo: "처녀자리",
    nameEn: "Virgo",
    archetypeKo: "디테일 스코어",
    archetypeEn: "Detail Lab",
    blurbKo: "연주력·편곡·구조에 까다로운 귀.",
    blurbEn: "Where playing and arrangement matter — jazz, classical, prog.",
    genres: [
      "jazz", "bebop", "swing", "vocal jazz", "cool jazz", "hard bop",
      "acid jazz", "nu-jazz", "modal jazz", "spiritual jazz", "latin jazz",
      "gypsy jazz", "jazz piano", "jazz manouche", "classical",
      "neo-classical", "baroque", "contemporary classical",
      "modern classical", "big band", "fusion jazz", "jazz fusion",
      "post-bop", "free jazz", "chamber music", "minimalism",
      "modern composition", "orchestral", "impressionism", "romanticism",
      "progressive rock", "prog rock", "art rock", "math rock",
      "progressive metal", "krautrock",
    ],
    moods: ["sophisticated", "refined", "complex", "elegant", "intricate", "cerebral"],
    constellation: {
      stars: [{ x: 14, y: 22 }, { x: 30, y: 38 }, { x: 50, y: 50 }, { x: 70, y: 60 }, { x: 86, y: 75 }],
      edges: [[0, 1], [1, 2], [2, 3], [3, 4]],
    },
  },
  {
    sign: "libra",
    symbol: "♎",
    nameKo: "천칭자리",
    nameEn: "Libra",
    archetypeKo: "소프트 밸런스",
    archetypeEn: "Soft Focus",
    blurbKo: "세련되고 부드러운 결 — 시티팝·소프트락.",
    blurbEn: "Smooth, refined — city pop, soft rock, lounge.",
    genres: [
      "city pop", "soft rock", "smooth jazz", "lounge", "bossa nova",
      "yacht rock", "easy listening", "japanese city pop", "soft pop",
      "adult contemporary", "quiet storm", "aor", "sophisti-pop",
      "kayokyoku", "japanese smooth jazz", "soft jazz", "smooth soul",
      "smooth pop", "lo-fi soul", "chillhop",
    ],
    moods: ["smooth", "mellow", "balanced", "refined", "sleek", "laid-back", "chill"],
    constellation: {
      stars: [{ x: 50, y: 15 }, { x: 20, y: 50 }, { x: 80, y: 50 }, { x: 50, y: 85 }],
      edges: [[0, 1], [0, 2], [1, 3], [2, 3]],
    },
  },
  {
    // Scorpio NO LONGER metal — restructured (May 2026) to the dark-but-
    // not-heavy quadrant: post-punk, darkwave, industrial, trip-hop.
    // Metal in all its forms moved to Capricorn (Guitar Axis) since the
    // user's taste model groups guitar-band genres together.
    sign: "scorpio",
    symbol: "♏",
    nameKo: "전갈자리",
    nameEn: "Scorpio",
    archetypeKo: "다크 텍스처",
    archetypeEn: "Night Current",
    blurbKo: "어둡고 밀도 있는 텍스처 — 포스트펑크·다크웨이브·인더스트리얼.",
    blurbEn: "Dark current — post-punk, darkwave, industrial, trip-hop.",
    genres: [
      "post-punk", "gothic rock", "deathrock", "coldwave", "no-wave",
      "no wave", "darkwave", "ethereal wave", "dark cabaret",
      "industrial", "industrial rock", "ebm",
      "trip-hop", "trip hop", "downtempo",
      "witch house", "hauntology", "minimal wave", "post-industrial",
      "neofolk", "neo-folk-dark", "dark folk", "dark ambient",
    ],
    moods: ["dark", "brooding", "intense", "moody", "menacing", "hypnotic"],
    constellation: {
      stars: [
        { x: 18, y: 18 }, { x: 28, y: 32 }, { x: 38, y: 44 },
        { x: 52, y: 50 }, { x: 68, y: 50 }, { x: 80, y: 60 },
        { x: 76, y: 76 }, { x: 60, y: 80 },
      ],
      edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7]],
    },
  },
  {
    sign: "sagittarius",
    symbol: "♐",
    nameKo: "사수자리",
    nameEn: "Sagittarius",
    archetypeKo: "보더 믹스",
    archetypeEn: "Border Radio",
    blurbKo: "경계 너머의 라디오 — 월드·라틴·아프로·사이키.",
    blurbEn: "Crossing borders — world, latin, afro, with psychedelic edges.",
    genres: [
      "world", "latin", "afrobeat", "reggae", "dancehall", "ska", "gypsy",
      "world music", "salsa", "samba", "bossa", "bachata", "merengue",
      "kuduro", "k-traditional", "k-folk", "cumbia", "flamenco", "tango",
      "calypso", "soca", "ethiopian", "balkan", "celtic", "global pop",
      "highlife", "arabic pop", "persian pop", "indian pop", "bhangra",
      "qawwali", "j-folk", "asian folk", "andean", "moroccan",
      "psychedelic rock", "psych-folk", "psychedelic pop", "neo-psychedelia",
    ],
    moods: ["adventurous", "free", "expansive", "exotic", "festive"],
    constellation: {
      stars: [
        { x: 20, y: 42 }, { x: 38, y: 28 }, { x: 60, y: 28 },
        { x: 80, y: 42 }, { x: 70, y: 64 }, { x: 30, y: 64 },
      ],
      edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0]],
    },
  },
  {
    // Capricorn restructured (May 2026): now absorbs all metal subgenres
    // that used to live in Scorpio. The unifying signal is "guitar-led
    // band sound" — rock, alt-rock, punk, classic rock, metal in every
    // form. Post-punk moved OUT to Scorpio (it's the dark-texture
    // sibling, not the riff-architecture one).
    sign: "capricorn",
    symbol: "♑",
    nameKo: "염소자리",
    nameEn: "Capricorn",
    archetypeKo: "기타 드라이브",
    archetypeEn: "Guitar Axis",
    blurbKo: "기타 중심의 밴드 사운드 — 록·올터·펑크·메탈.",
    blurbEn: "Guitar-led, band-shaped — rock, alt-rock, punk, metal.",
    genres: [
      // Rock cluster
      "rock", "hard rock", "classic rock", "alternative rock", "modern rock",
      "punk rock", "punk", "pop-punk", "pop punk", "skate punk",
      "post-hardcore", "grunge", "post-grunge", "garage rock",
      "new wave", "blues rock", "blues",
      "pop rock", "southern rock", "stoner rock", "roots rock", "britpop",
      "alt-rock", "korean rock", "rock and roll", "rockabilly", "surf rock",
      "glam rock", "indie rock revival",
      // Metal cluster (moved from Scorpio)
      "metal", "heavy metal", "death metal", "black metal", "thrash",
      "thrash metal", "speed metal", "power metal", "doom", "doom metal",
      "sludge", "sludge metal", "stoner metal", "post-metal", "metalcore",
      "deathcore", "hardcore", "hardcore punk", "screamo", "grindcore",
      "djent", "symphonic metal", "melodic death metal",
      "technical death metal", "blackened death metal", "atmospheric black metal",
      "depressive black metal", "post-black metal", "viking metal",
      "pagan metal", "folk metal", "gothic metal", "funeral doom",
      "drone metal", "mathcore", "glam metal", "nu-metal", "nu metal",
    ],
    moods: ["energetic", "raw", "powerful", "dramatic", "passionate", "anthemic", "aggressive", "heavy"],
    constellation: {
      stars: [{ x: 22, y: 70 }, { x: 50, y: 22 }, { x: 78, y: 70 }],
      edges: [[0, 1], [1, 2], [2, 0]],
    },
  },
  {
    sign: "aquarius",
    symbol: "♒",
    nameKo: "물병자리",
    nameEn: "Aquarius",
    archetypeKo: "시그널 비트",
    archetypeEn: "Signal Room",
    blurbKo: "전자음과 신스의 신호 — 일렉트로니카·하우스·테크노·DnB.",
    blurbEn: "Synths and signals — electronic, house, techno, DnB.",
    genres: [
      "electronic", "electronica", "techno", "minimal techno", "tech house",
      "house", "deep house", "progressive house", "tropical house",
      "future house", "slap house", "bass house", "melodic house",
      "melodic techno", "organic house", "edm", "big room", "trance",
      "psy-trance", "uplifting trance", "progressive trance",
      "industrial techno", "synthwave", "electro", "electroclash",
      "indie dance", "italo house",
      "dnb", "drum and bass", "liquid drum and bass", "neurofunk",
      "dubstep", "future bass", "future garage", "uk garage", "2-step",
      "breakbeat", "footwork", "juke", "jungle", "hard techno",
      "hardstyle", "gabber", "acid house", "gqom", "baltimore club",
      "jersey club", "afro-house",
    ],
    moods: ["electric", "hypnotic", "futuristic", "pulsing", "driving"],
    constellation: {
      stars: [
        { x: 28, y: 30 }, { x: 50, y: 42 }, { x: 72, y: 30 },
        { x: 40, y: 62 }, { x: 60, y: 62 }, { x: 50, y: 82 },
      ],
      edges: [[0, 1], [1, 2], [1, 3], [1, 4], [3, 5], [4, 5]],
    },
  },
  {
    sign: "pisces",
    symbol: "♓",
    nameKo: "물고기자리",
    nameEn: "Pisces",
    archetypeKo: "리버브 레이어",
    archetypeEn: "Reverb Field",
    blurbKo: "잔향과 공간감의 레이어 — 드림팝·슈게이즈·앰비언트.",
    blurbEn: "Reverb-soaked fields — dream pop, shoegaze, ambient.",
    genres: [
      "shoegaze", "dream pop", "chillwave", "nu-gaze",
      "blackgaze", "dreamgaze", "post-shoegaze", "ambient",
      "ambient electronic", "ambient pop", "ambient techno", "drone",
      "drone ambient", "experimental", "idm", "post-rock", "minimal",
      "vaporwave", "chillout", "lo-fi hip hop",
      "lo-fi beats", "modular synth", "new age", "kankyo ongaku",
      "post-metal-atmos",
    ],
    moods: ["dreamy", "hazy", "romantic", "surreal", "ethereal", "abstract", "atmospheric", "spacious"],
    constellation: {
      stars: [{ x: 14, y: 30 }, { x: 32, y: 22 }, { x: 50, y: 40 }, { x: 68, y: 22 }, { x: 86, y: 30 }],
      edges: [[0, 1], [1, 2], [2, 3], [3, 4]],
    },
  },
];

/**
 * Sub-flavor clusters per zodiac. The matcher uses these to refine the
 * winning sign into a more specific archetype — e.g. someone whose Virgo
 * signal is mostly bebop tags reads as "Virgo · Jazz" rather than the
 * umbrella "Detail Lab". A flavor sticks only when ≥2 supporting tracks
 * fall in it AND it owns the dominant share within the winning sign's
 * genre matches; otherwise the UI shows just the umbrella.
 *
 * Flavor keyword matching uses the same substring rules as the main
 * matcher (longest keyword wins) so we don't double-count overlaps.
 * Signs absent from this map silently fall back to no flavor.
 */
const FLAVORS: Record<string, ZodiacFlavor[]> = {
  aries: [
    { key: "boom", nameKo: "붐뱁 키드", nameEn: "Boom-Bap Kid",
      genres: ["boom bap", "lyrical hip hop", "conscious rap", "alternative hip hop", "alt-hip-hop", "abstract hip hop", "east coast hip hop"] },
    { key: "trap", nameKo: "트랩 마니아", nameEn: "Trap Loyalist",
      genres: ["trap", "latin trap", "cloud rap", "emo rap", "mumble rap"] },
    { key: "drill", nameKo: "드릴 마니아", nameEn: "Drill Devotee",
      genres: ["drill", "uk drill", "phonk", "hyperphonk", "rage rap", "grime", "road rap", "jersey drill", "brooklyn drill", "chicago drill", "plugg"] },
    { key: "krap", nameKo: "한국 힙합", nameEn: "K-Rap Loyal",
      genres: ["korean hip hop", "k-rap", "k-hiphop"] },
  ],
  taurus: [
    { key: "kballad", nameKo: "한국 발라드", nameEn: "K-Ballad",
      genres: ["k-ballad", "ballad", "korean pop ballad", "k-pop ballad", "trot"] },
    { key: "folk", nameKo: "포크 어쿠스틱", nameEn: "Folk Acoustic",
      genres: ["folk", "indie folk", "folk rock", "folk pop", "americana", "bluegrass", "neo-folk", "contemporary folk", "japanese folk", "anti-folk"] },
    { key: "country", nameKo: "컨트리", nameEn: "Country",
      genres: ["country", "alt-country", "country pop", "outlaw country"] },
  ],
  gemini: [
    { key: "kpop", nameKo: "K팝", nameEn: "K-Pop",
      genres: ["k-pop", "korean pop ballad", "k-pop ballad"] },
    { key: "jpop", nameKo: "J팝", nameEn: "J-Pop",
      genres: ["j-pop", "kawaii pop"] },
    { key: "synth", nameKo: "신스팝", nameEn: "Synth-Pop",
      genres: ["synth-pop", "synthpop", "electropop", "hyperpop", "future pop"] },
    { key: "chamber", nameKo: "챔버팝", nameEn: "Chamber Pop",
      genres: ["art pop", "chamber pop", "twee pop", "alt-pop"] },
  ],
  cancer: [
    { key: "bedroom", nameKo: "베드룸 팝", nameEn: "Bedroom Pop",
      genres: ["bedroom pop", "lo-fi"] },
    { key: "emo", nameKo: "이모", nameEn: "Emo",
      genres: ["emo", "emo revival", "midwest emo"] },
    { key: "indie", nameKo: "감성 인디", nameEn: "Tender Indie",
      genres: ["indie", "indie pop", "indie rock", "indie folk pop", "korean indie", "japanese indie", "jangle pop", "slowcore", "sadcore", "indie sleaze", "indie ballad", "indie soul"] },
  ],
  leo: [
    { key: "funk", nameKo: "펑크", nameEn: "Funk",
      genres: ["funk", "funk rock", "g-funk", "electro-funk", "jazz funk", "future funk"] },
    { key: "soul", nameKo: "소울", nameEn: "Soul",
      genres: ["soul", "neo-soul", "modern soul", "deep soul", "southern soul", "philly soul", "blue-eyed soul", "hip-hop soul", "korean soul", "rare groove"] },
    { key: "disco", nameKo: "디스코", nameEn: "Disco",
      genres: ["disco", "nu-disco", "post-disco", "italo disco", "boogie"] },
    { key: "rnb", nameKo: "R&B", nameEn: "R&B",
      genres: ["r&b", "alternative r&b", "contemporary r&b", "k-r&b"] },
  ],
  virgo: [
    { key: "jazz", nameKo: "재즈", nameEn: "Jazz",
      genres: ["jazz", "bebop", "swing", "vocal jazz", "cool jazz", "hard bop", "acid jazz", "nu-jazz", "modal jazz", "spiritual jazz", "latin jazz", "gypsy jazz", "jazz piano", "jazz manouche", "big band", "fusion jazz", "jazz fusion", "post-bop", "free jazz"] },
    { key: "classical", nameKo: "클래식", nameEn: "Classical",
      genres: ["classical", "neo-classical", "baroque", "contemporary classical", "modern classical", "chamber music", "minimalism", "modern composition", "orchestral", "impressionism", "romanticism"] },
    { key: "prog", nameKo: "프로그/매스", nameEn: "Prog & Math",
      genres: ["progressive rock", "prog rock", "art rock", "math rock", "progressive metal", "krautrock"] },
  ],
  libra: [
    { key: "citypop", nameKo: "시티팝", nameEn: "City Pop",
      genres: ["city pop", "japanese city pop", "kayokyoku"] },
    { key: "smooth", nameKo: "스무스 재즈", nameEn: "Smooth Jazz",
      genres: ["smooth jazz", "lounge", "bossa nova", "japanese smooth jazz", "soft jazz", "chillhop", "lo-fi soul"] },
    { key: "soft", nameKo: "소프트 록", nameEn: "Soft Rock",
      genres: ["soft rock", "yacht rock", "aor", "sophisti-pop", "easy listening", "adult contemporary"] },
  ],
  scorpio: [
    { key: "postpunk", nameKo: "포스트펑크", nameEn: "Post-Punk",
      genres: ["post-punk", "gothic rock", "deathrock", "coldwave", "no-wave", "no wave", "minimal wave"] },
    { key: "darkwave", nameKo: "다크웨이브", nameEn: "Darkwave",
      genres: ["darkwave", "ethereal wave", "dark cabaret", "witch house"] },
    { key: "industrial", nameKo: "인더스트리얼", nameEn: "Industrial",
      genres: ["industrial", "industrial rock", "ebm", "post-industrial"] },
    { key: "triphop", nameKo: "트립합", nameEn: "Trip-Hop",
      genres: ["trip-hop", "trip hop", "downtempo"] },
  ],
  sagittarius: [
    { key: "latin", nameKo: "라틴", nameEn: "Latin",
      genres: ["latin", "salsa", "samba", "bossa", "bachata", "merengue", "cumbia", "flamenco", "tango", "calypso", "soca"] },
    { key: "afro", nameKo: "아프로", nameEn: "Afro",
      genres: ["afrobeat", "highlife", "kuduro", "ethiopian"] },
    { key: "asia", nameKo: "아시아 전통", nameEn: "Asian Traditional",
      genres: ["k-traditional", "k-folk", "j-folk", "asian folk", "bhangra", "qawwali", "indian pop"] },
    { key: "carib", nameKo: "캐리비안", nameEn: "Caribbean",
      genres: ["reggae", "dancehall", "ska"] },
    { key: "psych", nameKo: "사이키델릭", nameEn: "Psychedelic",
      genres: ["psychedelic rock", "psych-folk", "psychedelic pop", "neo-psychedelia"] },
  ],
  capricorn: [
    { key: "classic", nameKo: "클래식 록", nameEn: "Classic Rock",
      genres: ["rock", "classic rock", "hard rock", "rock and roll", "rockabilly", "surf rock", "glam rock", "british invasion"] },
    { key: "alt", nameKo: "얼터너티브", nameEn: "Alternative",
      genres: ["alternative rock", "alt-rock", "modern rock", "grunge", "post-grunge", "indie rock revival", "britpop"] },
    { key: "punk", nameKo: "펑크", nameEn: "Punk",
      genres: ["punk", "punk rock", "pop-punk", "skate punk", "post-hardcore", "hardcore punk"] },
    { key: "metal", nameKo: "메탈", nameEn: "Metal",
      genres: ["metal", "heavy metal", "thrash", "thrash metal", "speed metal", "power metal", "death metal", "black metal", "doom", "doom metal", "sludge", "sludge metal", "stoner metal", "post-metal", "metalcore", "deathcore", "screamo", "grindcore", "djent", "symphonic metal", "melodic death metal", "technical death metal", "blackened death metal", "atmospheric black metal", "depressive black metal", "post-black metal", "viking metal", "pagan metal", "folk metal", "gothic metal", "funeral doom", "drone metal", "mathcore", "glam metal", "nu-metal", "nu metal"] },
    { key: "blues", nameKo: "블루스 록", nameEn: "Blues Rock",
      genres: ["blues rock", "blues", "southern rock", "stoner rock"] },
  ],
  aquarius: [
    { key: "techno", nameKo: "테크노", nameEn: "Techno",
      genres: ["techno", "minimal techno", "industrial techno", "melodic techno", "hard techno"] },
    { key: "house", nameKo: "하우스", nameEn: "House",
      genres: ["house", "deep house", "progressive house", "tropical house", "future house", "slap house", "bass house", "melodic house", "organic house", "tech house", "italo house", "acid house", "afro-house"] },
    { key: "dnb", nameKo: "DnB", nameEn: "DnB",
      genres: ["dnb", "drum and bass", "liquid drum and bass", "neurofunk", "jungle"] },
    { key: "trance", nameKo: "트랜스", nameEn: "Trance",
      genres: ["trance", "psy-trance", "uplifting trance", "progressive trance"] },
    { key: "bass", nameKo: "베이스", nameEn: "Bass",
      genres: ["dubstep", "future bass", "future garage", "uk garage", "2-step", "breakbeat", "footwork", "juke"] },
    { key: "synthwave", nameKo: "신스웨이브", nameEn: "Synthwave",
      genres: ["synthwave", "electro", "electroclash", "indie dance"] },
  ],
  pisces: [
    { key: "shoegaze", nameKo: "슈게이즈", nameEn: "Shoegaze",
      genres: ["shoegaze", "dream pop", "nu-gaze", "blackgaze", "dreamgaze", "post-shoegaze"] },
    { key: "ambient", nameKo: "앰비언트", nameEn: "Ambient",
      genres: ["ambient", "ambient electronic", "ambient pop", "ambient techno", "drone", "drone ambient", "new age", "kankyo ongaku"] },
    { key: "vapor", nameKo: "베이퍼웨이브", nameEn: "Vaporwave",
      genres: ["vaporwave", "chillwave"] },
    { key: "lofi", nameKo: "로파이", nameEn: "Lo-Fi",
      genres: ["lo-fi hip hop", "lo-fi beats", "chillout"] },
    { key: "postrock", nameKo: "포스트록", nameEn: "Post-Rock",
      genres: ["post-rock", "post-metal-atmos"] },
  ],
};

// Bind flavors back onto ALL_ZODIACS so the Zodiac object exposes them
// directly. The map exists separately only to keep ALL_ZODIACS readable.
for (const z of ALL_ZODIACS) {
  const f = FLAVORS[z.sign];
  if (f) z.flavors = f;
}

/** Returns the full flavor breakdown for a sign and the dominant pick
 *  (or null when the signal is too thin / too even to commit to one). */
function flavorAnalysis(
  sign: string,
  signGenreCounts: Map<string, number>,
): { flavor: FlavorShare | null; breakdown: FlavorShare[] } {
  const flavors = FLAVORS[sign];
  if (!flavors || signGenreCounts.size === 0) {
    return { flavor: null, breakdown: [] };
  }

  const flavorScore = new Map<string, number>();
  let attributed = 0;
  for (const [name, count] of signGenreCounts) {
    let bestKey: string | null = null;
    let bestLen = 0;
    for (const f of flavors) {
      for (const kw of f.genres) {
        if (name === kw || name.includes(kw) || kw.includes(name)) {
          if (kw.length > bestLen) {
            bestKey = f.key;
            bestLen = kw.length;
          }
        }
      }
    }
    if (bestKey) {
      flavorScore.set(bestKey, (flavorScore.get(bestKey) ?? 0) + count);
      attributed += count;
    }
  }
  if (attributed === 0) return { flavor: null, breakdown: [] };

  const breakdown: FlavorShare[] = flavors
    .map((f) => ({
      key: f.key,
      nameKo: f.nameKo,
      nameEn: f.nameEn,
      share: (flavorScore.get(f.key) ?? 0) / attributed,
    }))
    .filter((f) => f.share > 0)
    .sort((a, b) => b.share - a.share);

  const top = breakdown[0];
  // Dominant pick has to clear a margin AND have ≥2 tracks supporting it,
  // otherwise we'd label single-track noise as a sub-archetype.
  const topCount = top ? flavorScore.get(top.key) ?? 0 : 0;
  const flavor =
    top && topCount >= 2 && top.share >= 0.4 ? top : null;

  return { flavor, breakdown };
}

/**
 * Picks the best-matching zodiac and computes per-sign breakdown so the UI
 * can show every sign's share, not just the winner.
 */
export function getMusicZodiac(stats: LibraryStats): MusicZodiac | null {
  if (stats.topGenres.length === 0 && stats.topMoods.length === 0) return null;

  const scores = new Map<string, number>();
  const matched = new Map<string, ZodiacMatched[]>();
  // Per-sign genre name → count. Used downstream by pickFlavor() to score
  // sub-archetypes (e.g. how much of the user's Virgo signal is jazz vs.
  // classical). Mood matches don't contribute to flavors — flavors are
  // strictly about which corner of the sign's musical world dominates.
  const signGenreCounts = new Map<string, Map<string, number>>();

  const assign = (name: string, original: string, count: number, kind: "genre" | "mood") => {
    let bestSign: string | null = null;
    let bestLen = 0;
    for (const z of ALL_ZODIACS) {
      for (const kw of z[kind === "genre" ? "genres" : "moods"]) {
        if (name === kw || name.includes(kw) || kw.includes(name)) {
          if (kw.length > bestLen) {
            bestSign = z.sign;
            bestLen = kw.length;
          }
        }
      }
    }
    if (bestSign) {
      scores.set(bestSign, (scores.get(bestSign) ?? 0) + count);
      const arr = matched.get(bestSign) ?? [];
      arr.push({ name: original, type: kind });
      matched.set(bestSign, arr);
      if (kind === "genre") {
        let m = signGenreCounts.get(bestSign);
        if (!m) { m = new Map(); signGenreCounts.set(bestSign, m); }
        m.set(name, (m.get(name) ?? 0) + count);
      }
    }
  };

  let totalCount = 0;
  for (const g of stats.topGenres) {
    totalCount += g.count;
    assign(g.name.toLowerCase(), g.name, g.count, "genre");
  }
  for (const m of stats.topMoods) {
    totalCount += m.count;
    assign(m.name.toLowerCase(), m.name, m.count, "mood");
  }
  if (scores.size === 0 || totalCount === 0) return null;

  let bestSign: string | null = null;
  let bestScore = 0;
  for (const [s, sc] of scores) {
    if (sc > bestScore) {
      bestSign = s;
      bestScore = sc;
    }
  }
  if (!bestSign) return null;

  const breakdown: SignBreakdown[] = ALL_ZODIACS.map((z) => ({
    sign: z.sign,
    share: (scores.get(z.sign) ?? 0) / totalCount,
    matched: matched.get(z.sign) ?? [],
  })).sort((a, b) => b.share - a.share);

  const z = ALL_ZODIACS.find((x) => x.sign === bestSign)!;
  const { flavor, breakdown: flavorBreakdown } = flavorAnalysis(
    bestSign,
    signGenreCounts.get(bestSign) ?? new Map(),
  );
  return {
    zodiac: z,
    matched: matched.get(bestSign) ?? [],
    share: bestScore / totalCount,
    breakdown,
    flavor,
    flavorBreakdown,
  };
}
