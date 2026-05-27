import type { LibraryStats } from "./library";

/**
 * Music zodiac — twelve signs, each mapping to a distinct musical tribe.
 * The user's top genres and moods are matched against each sign's keyword
 * list. To avoid double-counting (e.g. "indie rock" matching both "indie
 * rock" and a generic "rock"), each user genre is attributed to a single
 * sign — the one with the most specific matching keyword.
 *
 * The result also includes a per-sign breakdown so the UI can show "how
 * much of you" lands on every sign, not just the winning one.
 */
export interface Star {
  x: number;
  y: number;
}
export interface Constellation {
  stars: Star[];
  edges: [number, number][];
}

/** Sub-genre cluster within one zodiac. Most signs contain several
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
   *  between Jazz Maven (55%) and Classical Listener (45%) reads as the
   *  near-tie that it is, not a clean win. Empty when the sign has no
   *  flavors defined or no matches landed in any flavor. */
  flavorBreakdown: FlavorShare[];
}

export const ALL_ZODIACS: Zodiac[] = [
  {
    sign: "aries",
    symbol: "♈",
    nameKo: "양자리",
    nameEn: "Aries",
    archetypeKo: "프론트라인 MC",
    archetypeEn: "Frontline MC",
    blurbKo: "에너지 그대로, 비트 위에 정면돌파하는 라임.",
    blurbEn: "Pure energy — rhymes that charge the beat head-on.",
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
    archetypeKo: "벨벳 컬렉터",
    archetypeEn: "Velvet Collector",
    blurbKo: "따뜻한 음색을 닳도록 반복해서 듣는 컬렉터.",
    blurbEn: "Warm voices, played until they wear in.",
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
    archetypeKo: "스위치보드 리스너",
    archetypeEn: "Switchboard Listener",
    blurbKo: "장르 채널을 자유롭게 옮겨 다니는 호기심.",
    blurbEn: "Channel-flipping curiosity across genres.",
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
    archetypeKo: "메모리 다이버",
    archetypeEn: "Memory Diver",
    blurbKo: "조용한 방, 향수와 감정선 위로 곱씹는 곡들.",
    blurbEn: "Quiet rooms, nostalgia, songs that stay with you.",
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
    archetypeKo: "앤섬 시커",
    archetypeEn: "Anthem Seeker",
    blurbKo: "큰 후렴과 무대감 있는, 누구나 따라 부를 사운드.",
    blurbEn: "Big choruses, stage-sized sound — songs that fill a room.",
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
    archetypeKo: "디테일 큐레이터",
    archetypeEn: "Detail Curator",
    blurbKo: "편곡과 연주력에 까다로운 귀, 복잡함을 우아하게.",
    blurbEn: "Arrangement and chops matter more than hooks — complexity, tuned.",
    genres: [
      "jazz", "bebop", "swing", "vocal jazz", "cool jazz", "hard bop",
      "acid jazz", "nu-jazz", "modal jazz", "spiritual jazz", "latin jazz",
      "gypsy jazz", "jazz piano", "jazz manouche", "classical",
      "neo-classical", "baroque", "contemporary classical",
      "modern classical", "big band", "fusion jazz", "jazz fusion",
      "post-bop", "free jazz", "chamber music", "minimalism",
      "modern composition", "orchestral", "impressionism", "romanticism",
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
    archetypeKo: "무드 밸런서",
    archetypeEn: "Mood Balancer",
    blurbKo: "한쪽으로 기울지 않는 세련된 흐름.",
    blurbEn: "Smooth, balanced, never tilting too far.",
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
    sign: "scorpio",
    symbol: "♏",
    nameKo: "전갈자리",
    nameEn: "Scorpio",
    archetypeKo: "딥컷 헌터",
    archetypeEn: "Deep Cut Hunter",
    blurbKo: "어두운 구석의 숨은 명곡에 깊게 몰입하는 청자.",
    blurbEn: "Dark corners, deep immersion, hidden gems over hits.",
    genres: [
      "metal", "heavy metal", "death metal", "black metal", "thrash",
      "thrash metal", "speed metal", "power metal", "doom", "doom metal",
      "sludge", "sludge metal", "stoner metal", "post-metal", "metalcore",
      "deathcore", "hardcore", "hardcore punk", "screamo", "grindcore",
      "djent", "symphonic metal", "progressive metal", "melodic death metal",
      "technical death metal", "blackened death metal", "atmospheric black metal",
      "depressive black metal", "post-black metal", "viking metal",
      "pagan metal", "folk metal", "gothic metal", "funeral doom",
      "drone metal", "mathcore", "glam metal", "nu-metal", "nu metal",
    ],
    moods: ["aggressive", "dark", "intense", "brooding", "heavy", "menacing"],
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
    archetypeKo: "보더 크로서",
    archetypeEn: "Border Crosser",
    blurbKo: "국경과 장르를 가로지르는 탐험가의 귀.",
    blurbEn: "Sounds without borders — an explorer's ear.",
    genres: [
      "world", "latin", "afrobeat", "reggae", "dancehall", "ska", "gypsy",
      "world music", "salsa", "samba", "bossa", "bachata", "merengue",
      "kuduro", "k-traditional", "k-folk", "cumbia", "flamenco", "tango",
      "calypso", "soca", "ethiopian", "balkan", "celtic", "global pop",
      "highlife", "arabic pop", "persian pop", "indian pop", "bhangra",
      "qawwali", "j-folk", "asian folk", "andean", "moroccan",
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
    sign: "capricorn",
    symbol: "♑",
    nameKo: "염소자리",
    nameEn: "Capricorn",
    archetypeKo: "리프 아키텍트",
    archetypeEn: "Riff Architect",
    blurbKo: "기타와 드럼이 쌓아 올린, 구조감 있는 록의 무게.",
    blurbEn: "Guitar, drum, the weight of structure.",
    genres: [
      "hard rock", "classic rock", "alternative rock", "modern rock",
      "punk rock", "punk", "pop-punk", "pop punk", "skate punk",
      "post-hardcore", "grunge", "post-grunge", "garage rock", "post-punk",
      "new wave", "psychedelic rock", "blues rock", "blues",
      "progressive rock", "prog rock", "art rock", "krautrock", "pop rock",
      "southern rock", "stoner rock", "roots rock", "britpop", "alt-rock",
      "korean rock", "rock and roll", "rockabilly", "surf rock", "glam rock",
      "indie rock revival", "post-rock-ish",
    ],
    moods: ["energetic", "raw", "powerful", "dramatic", "passionate", "anthemic"],
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
    archetypeKo: "시그널 시프터",
    archetypeEn: "Signal Shifter",
    blurbKo: "신스와 실험성, 미래적 질감으로 짜인 사운드.",
    blurbEn: "Synths, experiments, futurist textures.",
    genres: [
      "electronic", "electronica", "techno", "minimal techno", "tech house",
      "house", "deep house", "progressive house", "tropical house",
      "future house", "slap house", "bass house", "melodic house",
      "melodic techno", "organic house", "edm", "big room", "trance",
      "psy-trance", "uplifting trance", "progressive trance",
      "industrial", "industrial techno", "darkwave", "synthwave", "ebm",
      "electro", "electroclash", "indie dance", "italo disco", "italo house",
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
    archetypeKo: "드림 레이어",
    archetypeEn: "Dream Layer",
    blurbKo: "잔향과 공간감으로 쌓아 올린, 몽환의 레이어.",
    blurbEn: "Reverb-soaked layers — dreamy, spacious, airy.",
    genres: [
      "shoegaze", "dream pop", "chillwave", "nu-gaze", "ethereal wave",
      "blackgaze", "dreamgaze", "post-shoegaze", "ambient", "dark ambient",
      "ambient electronic", "ambient pop", "ambient techno", "drone",
      "drone ambient", "experimental", "idm", "post-rock", "minimal",
      "vaporwave", "downtempo", "trip-hop", "chillout", "lo-fi hip hop",
      "lo-fi beats", "lo-fi", "modular synth", "new age", "kankyo ongaku",
      "math rock", "post-metal-atmos", "hauntology", "witch house",
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
 * signal is mostly bebop tags reads as "Virgo · Jazz Maven" rather than
 * the umbrella "Refined Jazz · Classical". A flavor sticks only when ≥2
 * supporting tracks fall in it AND it owns the dominant share within the
 * winning sign's genre matches; otherwise the UI shows just the umbrella.
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
    { key: "kballad", nameKo: "한국 발라드 마니아", nameEn: "K-Ballad Heart",
      genres: ["k-ballad", "ballad", "korean pop ballad", "k-pop ballad", "trot"] },
    { key: "folk", nameKo: "포크 어쿠스틱", nameEn: "Folk Wanderer",
      genres: ["folk", "indie folk", "folk rock", "folk pop", "americana", "bluegrass", "neo-folk", "contemporary folk", "japanese folk", "anti-folk"] },
    { key: "country", nameKo: "컨트리 로드", nameEn: "Country Road",
      genres: ["country", "alt-country", "country pop", "outlaw country"] },
  ],
  gemini: [
    { key: "kpop", nameKo: "K팝 추종자", nameEn: "K-Pop Devotee",
      genres: ["k-pop", "korean pop ballad", "k-pop ballad"] },
    { key: "jpop", nameKo: "J팝 여행자", nameEn: "J-Pop Voyager",
      genres: ["j-pop", "kawaii pop"] },
    { key: "synth", nameKo: "신스팝 마니아", nameEn: "Synth-Pop Maven",
      genres: ["synth-pop", "synthpop", "electropop", "hyperpop", "future pop"] },
    { key: "chamber", nameKo: "챔버팝 청자", nameEn: "Chamber-Pop Lover",
      genres: ["art pop", "chamber pop", "twee pop", "alt-pop"] },
  ],
  cancer: [
    { key: "bedroom", nameKo: "베드룸 시인", nameEn: "Bedroom Poet",
      genres: ["bedroom pop", "lo-fi"] },
    { key: "emo", nameKo: "이모 키드", nameEn: "Emo Kid",
      genres: ["emo", "emo revival", "midwest emo"] },
    { key: "indie", nameKo: "감성 인디", nameEn: "Tender Indie",
      genres: ["indie", "indie pop", "indie rock", "indie folk pop", "korean indie", "japanese indie", "jangle pop", "slowcore", "sadcore", "indie sleaze", "indie ballad", "indie soul"] },
  ],
  leo: [
    { key: "funk", nameKo: "펑크 마스터", nameEn: "Funk Master",
      genres: ["funk", "funk rock", "g-funk", "electro-funk", "jazz funk", "future funk"] },
    { key: "soul", nameKo: "소울 가수", nameEn: "Soul Singer",
      genres: ["soul", "neo-soul", "modern soul", "deep soul", "southern soul", "philly soul", "blue-eyed soul", "hip-hop soul", "korean soul", "rare groove"] },
    { key: "disco", nameKo: "디스코 댄서", nameEn: "Disco Dancer",
      genres: ["disco", "nu-disco", "post-disco", "italo disco", "boogie"] },
    { key: "rnb", nameKo: "R&B 컬렉터", nameEn: "R&B Collector",
      genres: ["r&b", "alternative r&b", "contemporary r&b", "k-r&b"] },
  ],
  virgo: [
    { key: "jazz", nameKo: "재즈 마니아", nameEn: "Jazz Maven",
      genres: ["jazz", "bebop", "swing", "vocal jazz", "cool jazz", "hard bop", "acid jazz", "nu-jazz", "modal jazz", "spiritual jazz", "latin jazz", "gypsy jazz", "jazz piano", "jazz manouche", "big band", "fusion jazz", "jazz fusion", "post-bop", "free jazz"] },
    { key: "classical", nameKo: "클래식 청자", nameEn: "Classical Listener",
      genres: ["classical", "neo-classical", "baroque", "contemporary classical", "modern classical", "chamber music", "minimalism", "modern composition", "orchestral", "impressionism", "romanticism"] },
  ],
  libra: [
    { key: "citypop", nameKo: "시티팝 로맨틱", nameEn: "City-Pop Romantic",
      genres: ["city pop", "japanese city pop", "kayokyoku"] },
    { key: "smooth", nameKo: "스무스 재즈", nameEn: "Smooth Jazz",
      genres: ["smooth jazz", "lounge", "bossa nova", "japanese smooth jazz", "soft jazz", "chillhop", "lo-fi soul"] },
    { key: "soft", nameKo: "소프트 록", nameEn: "Soft Rock",
      genres: ["soft rock", "yacht rock", "aor", "sophisti-pop", "easy listening", "adult contemporary"] },
  ],
  scorpio: [
    { key: "death", nameKo: "데스 메탈헤드", nameEn: "Death Metalhead",
      genres: ["death metal", "melodic death metal", "technical death metal", "blackened death metal", "deathcore"] },
    { key: "black", nameKo: "블랙 메탈헤드", nameEn: "Black Metalhead",
      genres: ["black metal", "atmospheric black metal", "depressive black metal", "post-black metal"] },
    { key: "core", nameKo: "하드코어 키드", nameEn: "Hardcore Kid",
      genres: ["metalcore", "hardcore", "hardcore punk", "screamo", "mathcore", "djent"] },
    { key: "doom", nameKo: "둠 메탈러", nameEn: "Doom Metaller",
      genres: ["doom", "doom metal", "sludge", "sludge metal", "stoner metal", "funeral doom", "drone metal"] },
    { key: "classic", nameKo: "클래식 메탈헤드", nameEn: "Classic Metalhead",
      genres: ["metal", "heavy metal", "thrash", "thrash metal", "speed metal", "power metal", "progressive metal", "symphonic metal"] },
  ],
  sagittarius: [
    { key: "latin", nameKo: "라틴 댄서", nameEn: "Latin Dancer",
      genres: ["latin", "salsa", "samba", "bossa", "bachata", "merengue", "cumbia", "flamenco", "tango", "calypso", "soca"] },
    { key: "afro", nameKo: "아프로 그루버", nameEn: "Afro Groover",
      genres: ["afrobeat", "highlife", "kuduro", "ethiopian"] },
    { key: "asia", nameKo: "아시아 전통", nameEn: "Asian Traditional",
      genres: ["k-traditional", "k-folk", "j-folk", "asian folk", "bhangra", "qawwali", "indian pop"] },
    { key: "carib", nameKo: "캐리비안 사운드", nameEn: "Caribbean Sound",
      genres: ["reggae", "dancehall", "ska"] },
  ],
  capricorn: [
    { key: "punk", nameKo: "펑크 록커", nameEn: "Punk Rocker",
      genres: ["punk", "punk rock", "pop-punk", "skate punk", "post-hardcore"] },
    { key: "prog", nameKo: "프로그 록커", nameEn: "Prog Rocker",
      genres: ["progressive rock", "prog rock", "art rock", "psychedelic rock", "krautrock"] },
    { key: "blues", nameKo: "블루스 록커", nameEn: "Blues Rocker",
      genres: ["blues rock", "blues", "southern rock", "stoner rock"] },
    { key: "alt", nameKo: "얼터너티브 록커", nameEn: "Alt Rocker",
      genres: ["alternative rock", "alt-rock", "modern rock", "grunge", "post-grunge", "indie rock revival"] },
  ],
  aquarius: [
    { key: "techno", nameKo: "테크노 헤드", nameEn: "Techno Head",
      genres: ["techno", "minimal techno", "industrial techno", "melodic techno", "hard techno"] },
    { key: "house", nameKo: "하우스 댄서", nameEn: "House Dancer",
      genres: ["house", "deep house", "progressive house", "tropical house", "future house", "slap house", "bass house", "melodic house", "organic house", "tech house", "italo house", "acid house", "afro-house"] },
    { key: "dnb", nameKo: "D&B 마니아", nameEn: "D&B Maven",
      genres: ["dnb", "drum and bass", "liquid drum and bass", "neurofunk", "jungle"] },
    { key: "trance", nameKo: "트랜스 마니아", nameEn: "Trance Lover",
      genres: ["trance", "psy-trance", "uplifting trance", "progressive trance"] },
    { key: "bass", nameKo: "베이스 마니아", nameEn: "Bass Head",
      genres: ["dubstep", "future bass", "future garage", "uk garage", "2-step", "breakbeat", "footwork", "juke"] },
    { key: "synthwave", nameKo: "신스웨이브", nameEn: "Synthwave Dreamer",
      genres: ["synthwave", "darkwave", "ebm", "electro", "electroclash", "indie dance"] },
  ],
  pisces: [
    { key: "shoegaze", nameKo: "슈게이즈 마니아", nameEn: "Shoegaze Romantic",
      genres: ["shoegaze", "dream pop", "nu-gaze", "ethereal wave", "blackgaze", "dreamgaze", "post-shoegaze"] },
    { key: "ambient", nameKo: "앰비언트 청자", nameEn: "Ambient Listener",
      genres: ["ambient", "dark ambient", "ambient electronic", "ambient pop", "ambient techno", "drone", "drone ambient", "new age", "kankyo ongaku"] },
    { key: "vapor", nameKo: "베이퍼웨이브", nameEn: "Vaporwave Dreamer",
      genres: ["vaporwave", "chillwave", "hauntology", "witch house"] },
    { key: "lofi", nameKo: "로파이 청자", nameEn: "Lo-Fi Listener",
      genres: ["lo-fi hip hop", "lo-fi beats", "lo-fi", "trip-hop", "downtempo", "chillout"] },
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
