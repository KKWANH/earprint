import type { Locale } from "../i18n";

const en = {
  metaTitle: "Taste DNA — Earprint",
  loginButton: "Sign in with Google",

  pageTitle: "Taste DNA",
  pageIntroLead: "Not what you listen to, but",
  pageIntroWhy: "why",
  pageIntroMid: "you love it — and where you are in your",
  pageIntroEm: "musical life",
  pageIntroTail: ".",

  citationPrefix: "Source research · Reminiscence bump:",
  citationFrontiers: "Frontiers in Psychology (2024)",
  citationPredictionLabel: "Prediction and reward:",
  citationGold: "Gold et al., J. Neuroscience (2019)",
  citationSalimpoor: "Salimpoor et al., Nature Neuroscience (2011)",
  citationPersonalityLabel: "Taste and personality:",
  citationRentfrow: "Rentfrow & Gosling (2003)",

  stageDiggingTitle: "Active digger",
  stageDiggingBody:
    "Recent music makes up a large share of your library. A pattern of strong discovery drive (openness) — regardless of age, you keep exploring new sounds.",
  stageImprintTitle: "Imprinted",
  stageImprintBody:
    "Music from your late teens to early twenties forms the backbone of your library. Songs etched into your neural wiring alongside the strong emotions of that era still dominate your taste.",
  stageBalancedTitle: "Balanced",
  stageBalancedBody:
    "Music from your imprint years and newer music are evenly mixed. You hold on to your roots while never stopping your exploration.",
  stageUnknownTitle: "Not enough data",
  stageUnknownBody:
    "There are still few songs with a release year. Running more track analysis will make this more accurate.",

  imprintHeading: "🧬 Imprint core — reminiscence bump",
  imprintIntro:
    "Music heard between ages 15 and 25 (emotional peak ≈ 17) is etched strongly into the brain alongside adolescent hormones. We look for that window in your library's release years.",
  birthYearLabel: (year: number) => `Birth year: ${year}`,
  birthYearPrompt: "Enter your birth year to see your imprint window",

  noYearDataWarning:
    'There is no release-year data yet. Use the button below to fetch each track’s release year from Deezer. ("Track analysis" only fills genre and mood — release year is separate.)',
  yearCoverage: (count: string) => `${count} tracks with a confirmed release year · `,
  yearCoveragePctSuffix: "% of all likes",
  yearCoverageLowNote: " — tracks not matched on Deezer have an unknown year",

  statImprintShare: "Imprint share",
  statImprintShareSub: (start: number, end: number) => `${start}–${end}`,
  statImprintShareNoYear: "Birth year needed",
  statRecent: "Last 3 years",
  statRecentSub: "Active digging",
  statCentroid: "Taste centroid",
  statCentroidYear: (year: number) => `${year}`,
  statCentroidSub: (age: number) => `around when you were ${age}`,
  statCentroidSubFallback: "median of your songs",
  statPeak: "Peak release year",
  statPeakYear: (year: number) => `${year}`,
  statPeakSub: (count: string) => `based on ${count} tracks`,
  emDash: "—",

  histTooltipUnit: (count: number) => `${count} tracks`,
  histLegend: (start: number, end: number) =>
    `■ Green bars = ${start}–${end} (your ages 15–25 imprint window)`,

  noveltyHeading: "🎯 Prediction · novelty index",
  noveltyIntroLead: "Musical pleasure peaks when",
  noveltyIntroEm: "predictions land just right — or miss in a pleasing way",
  noveltyIntroTail:
    ". We look at where your taste sits between the familiar and the fresh.",
  noveltyAxisFamiliar: "Familiar · predictable",
  noveltyAxisSweet: "Sweet spot",
  noveltyAxisNovel: "Fresh · adventurous",
  noveltyTopGenre: (name: string, share: number, distinct: number, analyzed: string) =>
    `Largest genre: ${name} (${share}%) · ${distinct} distinct genres · ${analyzed} analyzed tracks`,

  // BirthYearInput
  birthYearError: "Please double-check the year (e.g. 1996)",
  birthYearSaveError: "Failed to save",
  birthYearPlaceholder: "Year you were born (e.g. 1996)",
  birthYearEdit: "Edit",
  birthYearSave: "Save",

  // YearBackfill
  backfillDoneSome: (count: number) => `✅ Fetched release years for ${count} new tracks.`,
  backfillDoneNone:
    "✅ All release years are up to date (every Deezer-matched track is confirmed).",
  backfillRunning: (done: number, remaining: number) =>
    `Fetching… ${done} tracks (${remaining} remaining)`,
  backfillStart: "Fetch release years",
  backfillMore: "Fetch more release years",
  backfillHelp:
    "Fetches original (not remaster) release years from MusicBrainz — it can take a few minutes depending on the number of tracks, so keep the window open.",
};

const ko: typeof en = {
  metaTitle: "취향 DNA — Earprint",
  loginButton: "Google 로 로그인",

  pageTitle: "취향 DNA",
  pageIntroLead: "단순히",
  pageIntroWhy: "무엇을",
  pageIntroMid: "듣는지가 아니라,",
  pageIntroEm: "왜",
  pageIntroTail:
    " 좋아하는지를 봅니다. 그리고 음악 인생의 어디쯤에 있는지도.",

  citationPrefix: "근거 연구 · 회상 효과:",
  citationFrontiers: "Frontiers in Psychology (2024)",
  citationPredictionLabel: "예측과 보상:",
  citationGold: "Gold et al., J. Neuroscience (2019)",
  citationSalimpoor: "Salimpoor et al., Nature Neuroscience (2011)",
  citationPersonalityLabel: "취향과 성격:",
  citationRentfrow: "Rentfrow & Gosling (2003)",

  stageDiggingTitle: "탐험가형",
  stageDiggingBody:
    "최근에 나온 음악의 비중이 큽니다. 나이와 상관없이 새로운 사운드를 계속 찾아 듣는 타입. 음악 심리학에서 '개방성'이 높은 패턴입니다.",
  stageImprintTitle: "각인형",
  stageImprintBody:
    "라이브러리의 중심이 10대 후반~20대 초반의 음악입니다. 그 시절의 감정과 함께 뇌에 새겨진 곡들이 지금의 취향을 만듭니다.",
  stageBalancedTitle: "균형형",
  stageBalancedBody:
    "각인기 음악과 새 음악이 골고루 섞여 있습니다. 뿌리를 지키면서도 새로운 것을 계속 찾는 타입입니다.",
  stageUnknownTitle: "데이터 부족",
  stageUnknownBody:
    "발매연도가 확인된 곡이 아직 적습니다. 곡 분석을 더 돌리면 정확해집니다.",

  imprintHeading: "🧬 각인 코어 · 회상 효과",
  imprintIntro:
    "15~25세에 들었던 음악은 사춘기 호르몬과 함께 뇌에 강하게 새겨집니다. 특히 17세 무렵, 정서가 가장 강렬할 때. 라이브러리의 발매연도에서 그 시기를 찾아봅니다.",
  birthYearLabel: (year: number) => `출생연도: ${year}년`,
  birthYearPrompt: "출생연도를 입력하면 각인 시기를 표시합니다",

  noYearDataWarning:
    "발매연도 데이터가 없습니다. 아래 버튼으로 Deezer 에서 곡별 발매연도를 가져오세요. (곡 분석은 장르·무드만 다루고, 발매연도는 별도로 가져옵니다.)",
  yearCoverage: (count: string) => `확인된 발매연도 ${count}곡 · 전체 좋아요의 `,
  yearCoveragePctSuffix: "%",
  yearCoverageLowNote: " — Deezer 매칭 실패 곡은 연도 미상",

  statImprintShare: "각인기 비중",
  statImprintShareSub: (start: number, end: number) => `${start}~${end}년`,
  statImprintShareNoYear: "출생연도 입력 필요",
  statRecent: "최근 3년",
  statRecentSub: "현재진행형",
  statCentroid: "취향 무게중심",
  statCentroidYear: (year: number) => `${year}년`,
  statCentroidSub: (age: number) => `${age}세 즈음`,
  statCentroidSubFallback: "곡의 중앙값",
  statPeak: "정점 연도",
  statPeakYear: (year: number) => `${year}년`,
  statPeakSub: (count: string) => `${count}곡 기준`,
  emDash: "—",

  histTooltipUnit: (count: number) => `${count}곡`,
  histLegend: (start: number, end: number) =>
    `■ 초록 막대 = ${start}~${end}년 (15~25세 각인기)`,

  noveltyHeading: "🎯 예측 · 신선함 지수",
  noveltyIntroLead: "음악의 쾌감은",
  noveltyIntroEm: "예측이 적당히 맞거나 기분 좋게 빗나갈 때",
  noveltyIntroTail:
    " 가장 큽니다. 익숙함과 신선함 사이 어디쯤인지 봅니다.",
  noveltyAxisFamiliar: "익숙함 · 예측 가능",
  noveltyAxisSweet: "스위트 스폿",
  noveltyAxisNovel: "신선함 · 모험",
  noveltyTopGenre: (name: string, share: number, distinct: number, analyzed: string) =>
    `최다 장르: ${name} (${share}%) · 장르 ${distinct}종 · 분석 곡 ${analyzed}곡`,

  // BirthYearInput
  birthYearError: "연도를 다시 확인하세요 (예: 1996)",
  birthYearSaveError: "저장 실패",
  birthYearPlaceholder: "태어난 해 (예: 1996)",
  birthYearEdit: "수정",
  birthYearSave: "저장",

  // YearBackfill
  backfillDoneSome: (count: number) => `✅ ${count}곡의 발매연도를 새로 가져왔습니다.`,
  backfillDoneNone: "✅ 모든 발매연도가 최신 상태입니다.",
  backfillRunning: (done: number, remaining: number) =>
    `가져오는 중… ${done}곡 (남은 ${remaining})`,
  backfillStart: "발매연도 가져오기",
  backfillMore: "발매연도 더 가져오기",
  backfillHelp:
    "MusicBrainz 에서 원곡(리마스터 아닌) 발매연도를 가져옵니다. 곡 수에 따라 몇 분 걸리니 창을 닫지 마세요.",
};

export function dnaDict(locale: Locale) {
  return locale === "ko" ? ko : en;
}
