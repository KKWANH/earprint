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

export interface MusicZodiac {
  zodiac: Zodiac;
  matched: ZodiacMatched[];
  share: number;
  breakdown: SignBreakdown[];
}

export const ALL_ZODIACS: Zodiac[] = [
  {
    sign: "aries",
    symbol: "♈",
    nameKo: "양자리",
    nameEn: "Aries",
    archetypeKo: "록커",
    archetypeEn: "Rocker",
    blurbKo: "기타가 울려야 사는 사람.",
    blurbEn: "Lives for the sound of a guitar.",
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
    moods: ["energetic", "raw", "fierce", "powerful", "dramatic", "passionate"],
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
    archetypeKo: "어쿠스틱 발라더",
    archetypeEn: "Acoustic Wanderer",
    blurbKo: "따뜻한 목소리와 어쿠스틱 사운드.",
    blurbEn: "Warm voices, acoustic textures.",
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
    archetypeKo: "다채로운 팝",
    archetypeEn: "Pop Chameleon",
    blurbKo: "장르를 넘나드는 다채로운 팝.",
    blurbEn: "Pop in many colours.",
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
    archetypeKo: "감성 인디",
    archetypeEn: "Tender Indie",
    blurbKo: "조용한 방의 감정을 담은 인디.",
    blurbEn: "Bedroom-quiet, heart on sleeve.",
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
    archetypeKo: "그루브의 별",
    archetypeEn: "Groove Star",
    blurbKo: "디스코·펑크·소울의 그루브.",
    blurbEn: "Disco, funk and soul on the move.",
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
    archetypeKo: "정제된 재즈·클래식",
    archetypeEn: "Refined Jazz · Classical",
    blurbKo: "복잡함을 우아하게 풀어내는 사운드.",
    blurbEn: "Complexity, tuned to elegance.",
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
    archetypeKo: "도시의 밤 사운드",
    archetypeEn: "After-dark City",
    blurbKo: "도시의 밤, 매끈한 균형감.",
    blurbEn: "Smooth, balanced, after-dark city.",
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
    archetypeKo: "메탈헤드",
    archetypeEn: "Metalhead",
    blurbKo: "묵직하고 거센 사운드.",
    blurbEn: "Heavy, ferocious sound.",
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
    archetypeKo: "월드 익스플로러",
    archetypeEn: "World Explorer",
    blurbKo: "국경을 넘는 사운드.",
    blurbEn: "Sounds without borders.",
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
    archetypeKo: "힙합 스토리텔러",
    archetypeEn: "Hip-hop Storyteller",
    blurbKo: "비트 위에 펼치는 이야기.",
    blurbEn: "Stories laid down over the beat.",
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
    moods: ["confident", "narrative", "gritty", "swagger", "hype"],
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
    archetypeKo: "전자음의 여행자",
    archetypeEn: "Electronic Voyager",
    blurbKo: "댄스플로어를 누비는 전자음.",
    blurbEn: "Electronic sound for the dance-floor.",
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
    archetypeKo: "공간의 드리머",
    archetypeEn: "Atmospheric Dreamer",
    blurbKo: "리버브에 잠긴, 공기 같은 사운드.",
    blurbEn: "Reverb-soaked, airy textures.",
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
 * Picks the best-matching zodiac and computes per-sign breakdown so the UI
 * can show every sign's share, not just the winner.
 */
export function getMusicZodiac(stats: LibraryStats): MusicZodiac | null {
  if (stats.topGenres.length === 0 && stats.topMoods.length === 0) return null;

  const scores = new Map<string, number>();
  const matched = new Map<string, ZodiacMatched[]>();

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
  return {
    zodiac: z,
    matched: matched.get(bestSign) ?? [],
    share: bestScore / totalCount,
    breakdown,
  };
}
