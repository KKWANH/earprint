import type { LibraryStats } from "./library";

/**
 * Music zodiac — each of the twelve signs maps to a musical archetype.
 * The user's top genres and moods are matched against each sign's keyword
 * list; the highest-scoring sign wins. Pure data, no fabricated metric.
 *
 * Each sign also carries a simplified constellation pattern (normalised to
 * a 0..100 viewBox) that the card renders as a cosmic-background overlay.
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

export interface MusicZodiac {
  zodiac: Zodiac;
  matched: string[]; // genre/mood names from the user's library that scored
}

export const ALL_ZODIACS: Zodiac[] = [
  {
    sign: "aries",
    symbol: "♈",
    nameKo: "양자리",
    nameEn: "Aries",
    archetypeKo: "강렬한 로커",
    archetypeEn: "Hard Rocker",
    blurbKo: "크고 빠르고 거침없는 사운드.",
    blurbEn: "Loud, fast, fearless.",
    genres: ["rock", "hard rock", "punk", "metal", "heavy metal", "garage rock", "post-punk", "grunge"],
    moods: ["energetic", "aggressive", "intense", "raw"],
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
    archetypeEn: "Mellow Acoustic",
    blurbKo: "따뜻한 목소리와 어쿠스틱 사운드.",
    blurbEn: "Warm voices, acoustic textures.",
    genres: ["folk", "acoustic", "country", "singer-songwriter", "ballad", "americana"],
    moods: ["warm", "cozy", "calm", "gentle", "soft"],
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
    archetypeEn: "Eclectic Pop",
    blurbKo: "장르를 넘나드는 다채로운 팝.",
    blurbEn: "Pop in many colours.",
    genres: ["pop", "k-pop", "j-pop", "dance-pop", "electropop", "art pop", "indie pop", "synth-pop", "synthpop", "britpop", "pop rock"],
    moods: ["playful", "upbeat", "fun", "bright", "cheerful"],
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
    genres: ["indie", "indie pop", "indie rock", "bedroom pop", "lo-fi"],
    moods: ["melancholic", "nostalgic", "emotional", "tender", "introspective"],
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
    archetypeKo: "무대의 디스코",
    archetypeEn: "Stage Disco",
    blurbKo: "조명 아래 빛나는 펑크·소울·디스코.",
    blurbEn: "Funk, soul and disco under the lights.",
    genres: ["disco", "funk", "soul", "r&b", "neo-soul", "motown"],
    moods: ["groovy", "confident", "danceable", "celebratory"],
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
    archetypeKo: "정제된 재즈",
    archetypeEn: "Refined Jazz",
    blurbKo: "복잡함을 우아하게 풀어내는 사운드.",
    blurbEn: "Complexity, tuned to elegance.",
    genres: ["jazz", "bebop", "swing", "vocal jazz", "classical", "neo-classical", "baroque"],
    moods: ["sophisticated", "refined", "complex", "elegant"],
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
    archetypeKo: "균형의 시티팝",
    archetypeEn: "Balanced City Pop",
    blurbKo: "도시의 밤, 매끈한 균형감.",
    blurbEn: "Smooth, balanced, after-dark city.",
    genres: ["city pop", "soft rock", "smooth jazz", "lounge", "bossa nova", "yacht rock"],
    moods: ["smooth", "mellow", "balanced", "refined"],
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
    archetypeKo: "어두운 일렉트로닉",
    archetypeEn: "Dark Electronic",
    blurbKo: "묵직하고 어두운 전자음.",
    blurbEn: "Heavy, brooding electronics.",
    genres: ["electronic", "techno", "industrial", "darkwave", "edm", "house", "trance"],
    moods: ["dark", "intense", "mysterious", "brooding"],
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
    genres: ["world", "latin", "afrobeat", "reggae", "ska", "gypsy", "world music"],
    moods: ["adventurous", "free", "expansive"],
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
    archetypeKo: "클래식 록 빌더",
    archetypeEn: "Classic Builder",
    blurbKo: "구조 있고 무게 있는 정통 사운드.",
    blurbEn: "Built to last — heavy and structured.",
    genres: ["classic rock", "progressive rock", "blues rock", "blues", "opera", "psychedelic rock"],
    moods: ["structured", "serious", "monumental", "traditional"],
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
    archetypeKo: "실험 앰비언트",
    archetypeEn: "Experimental Ambient",
    blurbKo: "공기 같은, 실험적인 사운드.",
    blurbEn: "Airy, experimental textures.",
    genres: ["ambient", "experimental", "idm", "post-rock", "drone", "minimal"],
    moods: ["ethereal", "abstract", "atmospheric", "futuristic"],
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
    archetypeKo: "슈게이즈 드리머",
    archetypeEn: "Shoegaze Dreamer",
    blurbKo: "리버브에 잠긴 꿈결.",
    blurbEn: "Reverb-drenched daydream.",
    genres: ["shoegaze", "dream pop", "chillwave"],
    moods: ["dreamy", "hazy", "romantic"],
    constellation: {
      stars: [{ x: 14, y: 30 }, { x: 32, y: 22 }, { x: 50, y: 40 }, { x: 68, y: 22 }, { x: 86, y: 30 }],
      edges: [[0, 1], [1, 2], [2, 3], [3, 4]],
    },
  },
];

/** Picks the best-matching zodiac for a listener. */
export function getMusicZodiac(stats: LibraryStats): MusicZodiac | null {
  if (stats.topGenres.length === 0 && stats.topMoods.length === 0) return null;

  let best: { z: Zodiac; score: number; matched: string[] } | null = null;
  for (const z of ALL_ZODIACS) {
    let score = 0;
    const matched: string[] = [];
    for (const g of stats.topGenres) {
      const name = g.name.toLowerCase();
      if (z.genres.some((zg) => name === zg || name.includes(zg) || zg.includes(name))) {
        score += g.count;
        matched.push(g.name);
      }
    }
    for (const m of stats.topMoods) {
      const name = m.name.toLowerCase();
      if (z.moods.some((zm) => name === zm || name.includes(zm) || zm.includes(name))) {
        score += m.count;
        matched.push(m.name);
      }
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { z, score, matched };
    }
  }
  if (!best) return null;
  return { zodiac: best.z, matched: best.matched };
}
