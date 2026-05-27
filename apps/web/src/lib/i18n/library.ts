import type { Locale } from "../i18n";

const en = {
  // page.tsx
  loginGoogle: "Sign in with Google",
  pageTitle: "Library Analysis",
  logout: "Log out",
  statLikedTracks: "Liked tracks",
  statAnalyzed: "Analyzed",
  statArtists: "Artists",
  statAlbumDepth: "Album immersion",
  topArtistsTitle: "Most-liked artists",
  topArtistsEmpty: "No data yet.",
  familyTitle: "Genre families",
  familyEmpty: "No tagged genres yet — run an analysis.",
  recentArtistsTitle: "Recently liked artists",
  genreTitle: "Genre distribution",
  genreEmpty: "Run an analysis to fill in genres.",
  viewAllGenres: "View all genres →",
  moodTitle: "Mood distribution",
  moodEmpty: "Run an analysis to fill in moods.",
  instrumentsTitle: "Frequently appearing instruments",
  instrumentsEmpty: "Run an audio-feature analysis to fill this in.",
  albumsTitlePrefix: "Deepest-dived albums — liked tracks per album",
  albumsTitleDeep: (n: number) => `(${n} albums with 3+ tracks)`,
  albumsEmpty: "No album with multiple liked tracks yet.",
  excludedTitle: (n: number) => `Excluded artists (${n})`,
  tracksTitle: (n: number) => `Likes (newest ${n})`,
  thTitle: "Title",
  thArtist: "Artist",
  thGenre: "Genre",
  thMood: "Mood",
  searchPlaceholder: "Search by title or artist…",
  searchClear: "Clear",
  searchResultCount: (shown: number, total: number) =>
    `${shown.toLocaleString()} of ${total.toLocaleString()}`,
  searchNoMatch: "No matches.",
  pagePrev: "← Previous",
  pageNext: "Next →",
  pageOf: (cur: number, total: number) => `Page ${cur} / ${total}`,
  // FeelCard
  feelEnergy: "Energy",
  feelEnergyLo: "Calm",
  feelEnergyHi: "Intense",
  feelTempo: "Tempo",
  feelTempoLo: "Slow",
  feelTempoHi: "Fast",
  feelSound: "Sound",
  feelSoundLo: "Electronic",
  feelSoundHi: "Acoustic",
  feelTitle: "Audio characteristics",
  feelAverage: (n: string) => `· average of ${n} tracks`,
  // AnalyzePanel
  analyzeLoading: "Track analysis — loading…",
  analyzeTitle: "Track analysis",
  analyzeDesc:
    "Two-step pipeline: each track is matched against music databases for canonical metadata, then Gemini estimates genres, moods and audio feel. You can close this tab — the job keeps running in the background.",
  analyzeComplete: "Done",
  analyzeStop: "Stop",
  analyzeResume: "Resume",
  analyzeStart: "Start analysis",
  phaseEnrich: "Step 1 of 2 · Matching tracks with music databases (Deezer · Last.fm)",
  phaseAi: "Step 2 of 2 · Estimating genres, moods and audio feel for each track",
  phaseDone: "Done",
  progressTracks: (done: string, total: string, pct: number) =>
    `${done} / ${total} tracks (${pct}%)`,
  runningHint:
    "⚙ Keep this window open to go faster. It keeps running in the background if you close it — come back later to see your finished analysis. 🎧",
  completeHint:
    "🎉 Analysis complete — your taste profile is ready to view above and share with friends.",
  cappedNote:
    "🌙 AI analysis is paused — today's shared analysis limit was reached. It resumes automatically tomorrow; the data collected so far is kept.",
  noSyncedTracks: "No synced tracks.",
  errorPrefix: "Error:",
  errorCode: (code: number) => `Error ${code}`,
  // ExcludeButton
  excludeIncludeTitle:
    "Include this artist in stats again. The tracks were never removed from your library — only filtered out of the top-artists / genres / moods rollups.",
  excludeExcludeTitle:
    "Hide this artist from stats. Their tracks stay in your library and analysis history; they just stop counting toward top-artists / genres / moods aggregates and recommendation seeds. Reversible from the Excluded section below.",
  excludeRestore: "Restore",
  excludeMark: "Hide",
  // PreviewButton
  previewTitle: "30-second preview",
  // Data confidence rollup — header line above the stats grid. Coverage
  // is `enriched/total`. Confidence bucket maps to coverage:
  //   ≥95% → high · 70–94% → medium · <70% → low.
  // The bucket name is rendered in colour so the user gets the gist at a
  // glance; the parenthetical numbers let them dig in.
  confidenceLabel: "Data confidence",
  confidenceHigh: "high",
  confidenceMedium: "medium",
  confidenceLow: "low",
  confidenceBuilding: "building (not analyzed yet)",
  confidenceSummary: (liked: string, analyzed: string, pct: number) =>
    `${liked} liked · ${analyzed} analyzed (${pct}%)`,
  // Album-immersion interpretation — rendered under the Album immersion
  // % stat. The number alone is unintuitive ("is 35% high or low?");
  // these phrases anchor it to listener behaviour. Buckets sit at 15%
  // and 35% to match the natural split between singles-only / mixed /
  // album-listener listening styles.
  albumImmersionSingles: "You mostly collect individual tracks rather than full albums.",
  albumImmersionMixed:
    "You mix album-deep listening with one-off picks — some albums caught you, some songs stand alone.",
  albumImmersionDeep: (deepN: number) =>
    `You sit with full albums — most of your likes come from ${deepN.toLocaleString()} albums you've genuinely lived in.`,
  // Audio feel one-line interpretation by axis + value. Each axis returns
  // a short read of where the listener sits on that spectrum.
  feelEnergyLow: "Calmer end — you reach for music that settles you down.",
  feelEnergyMid: "Comfortable middle — energy depends on the song, not a fixed mood.",
  feelEnergyHigh: "Hot end — you favour music with drive and impact.",
  feelTempoLow: "Slower-paced listening — ballads, downtempo, atmospheric.",
  feelTempoMid: "Mid-tempo home — flexible across pop, rock, indie speeds.",
  feelTempoHigh: "Faster pulse — dance, punk, drum-led tracks land hardest.",
  feelAcousticLow: "Electronic-leaning sound — synths, programmed beats, processed textures.",
  feelAcousticMid: "Hybrid sound palette — acoustic and electronic share the room.",
  feelAcousticHigh: "Acoustic-forward — voices and live instruments dominate.",
  dataDisclaimer:
    "Stats are derived from your YouTube Music library — track matching and genre/mood data are best-effort, so figures are approximate.",
  dangerZoneTitle: "Delete account",
  dangerZoneDesc:
    "Permanently delete your account and all associated data — liked tracks, analysis, recommendations and your psychology profile.",
  deleteAccount: "Delete my account & data",
  deleteConfirmWarn: "This is permanent and cannot be undone. Are you sure?",
  deleteConfirmYes: "Yes, delete everything",
  deleteCancel: "Cancel",
};

const ko: typeof en = {
  loginGoogle: "Google 로 로그인",
  pageTitle: "라이브러리 분석",
  logout: "로그아웃",
  statLikedTracks: "좋아요 곡",
  statAnalyzed: "분석된 곡",
  statArtists: "아티스트",
  statAlbumDepth: "앨범 몰입도",
  topArtistsTitle: "주요 아티스트",
  topArtistsEmpty: "데이터 없음.",
  familyTitle: "장르 계열",
  familyEmpty: "아직 태그된 장르가 없습니다 — 분석을 실행하세요.",
  recentArtistsTitle: "최근에 좋아요한 아티스트",
  genreTitle: "장르 분포",
  genreEmpty: "분석을 돌리면 채워집니다.",
  viewAllGenres: "전체 장르 보기 →",
  moodTitle: "무드 분포",
  moodEmpty: "분석을 돌리면 채워집니다.",
  instrumentsTitle: "주요 악기",
  instrumentsEmpty: "오디오 특성 분석을 돌리면 채워집니다.",
  albumsTitlePrefix: "주요 앨범 · 앨범당 좋아요 곡 수",
  albumsTitleDeep: (n: number) => `(3곡 이상 앨범 ${n}개)`,
  albumsEmpty: "한 앨범에서 여러 곡을 좋아한 경우 없음.",
  excludedTitle: (n: number) => `제외된 아티스트 (${n})`,
  tracksTitle: (n: number) => `좋아요한 순서 · 최신 ${n}곡`,
  thTitle: "제목",
  thArtist: "아티스트",
  thGenre: "장르",
  thMood: "무드",
  searchPlaceholder: "제목 또는 아티스트 검색…",
  searchClear: "지우기",
  searchResultCount: (shown: number, total: number) =>
    `전체 ${total.toLocaleString()}곡 중 ${shown.toLocaleString()}곡 표시`,
  searchNoMatch: "검색 결과 없음.",
  pagePrev: "← 이전",
  pageNext: "다음 →",
  pageOf: (cur: number, total: number) => `${total}페이지 중 ${cur}페이지`,
  feelEnergy: "에너지",
  feelEnergyLo: "차분",
  feelEnergyHi: "격렬",
  feelTempo: "템포",
  feelTempoLo: "느림",
  feelTempoHi: "빠름",
  feelSound: "사운드",
  feelSoundLo: "전자음",
  feelSoundHi: "생악기",
  feelTitle: "오디오 특성",
  feelAverage: (n: string) => `· ${n}곡 평균`,
  analyzeLoading: "곡 분석 불러오는 중…",
  analyzeTitle: "곡 분석",
  analyzeDesc:
    "두 단계 파이프라인: 먼저 음악 DB 에서 곡의 표준 메타데이터를 매칭하고, 다음으로 Gemini 가 장르·무드·오디오 특성을 추정합니다. 창을 닫아도 백그라운드에서 계속 진행됩니다.",
  analyzeComplete: "완료",
  analyzeStop: "중지",
  analyzeResume: "이어서 시작",
  analyzeStart: "분석 시작",
  phaseEnrich: "1/2단계 · 곡을 음악 DB(Deezer · Last.fm)와 매칭하는 중",
  phaseAi: "2/2단계 · 곡별 장르·무드·오디오 특성을 추정하는 중",
  phaseDone: "완료",
  progressTracks: (done: string, total: string, pct: number) =>
    `${done} / ${total}곡 (${pct}%)`,
  runningHint:
    "⚙ 창을 열어두면 더 빠릅니다. 닫아도 백그라운드에서 계속 진행되고, 나중에 다시 와서 완성된 분석을 확인할 수 있어요. 🎧",
  completeHint: "🎉 분석 완료 — 취향 프로파일이 준비되었습니다. 위에서 바로 확인하고 친구와 공유해 보세요.",
  cappedNote:
    "🌙 오늘 공용 AI 한도가 다 찼습니다. 내일 자동으로 이어집니다 (지금까지 모은 데이터는 그대로).",
  noSyncedTracks: "동기화된 곡 없음.",
  errorPrefix: "오류:",
  errorCode: (code: number) => `오류 ${code}`,
  excludeIncludeTitle:
    "이 아티스트를 다시 통계에 포함합니다. 곡 자체는 처음부터 라이브러리에서 제거되지 않았고, top-아티스트/장르/무드 집계에서만 빠져 있었습니다.",
  excludeExcludeTitle:
    "이 아티스트를 통계에서 숨깁니다. 곡은 라이브러리와 분석 기록에 그대로 남고, top-아티스트/장르/무드 집계와 추천 시드에서만 제외됩니다. 아래 '제외된 아티스트' 섹션에서 언제든 복원할 수 있습니다.",
  excludeRestore: "복원",
  excludeMark: "숨김",
  previewTitle: "30초 미리듣기",
  confidenceLabel: "데이터 신뢰도",
  confidenceHigh: "높음",
  confidenceMedium: "보통",
  confidenceLow: "낮음",
  confidenceBuilding: "준비 중 (아직 분석 안 됨)",
  confidenceSummary: (liked: string, analyzed: string, pct: number) =>
    `좋아요 ${liked} · 분석 완료 ${analyzed} (${pct}%)`,
  albumImmersionSingles: "주로 앨범보다 개별 곡 단위로 모으는 편이에요.",
  albumImmersionMixed:
    "앨범을 깊게 들은 것과 한 곡씩 고른 것이 섞여 있어요 — 어떤 앨범은 통째로 꽂혔고, 어떤 곡은 그 자체로 살아남았어요.",
  albumImmersionDeep: (deepN: number) =>
    `앨범에 머무는 편이에요 — 좋아요 대부분이 깊게 파고든 ${deepN.toLocaleString()}장의 앨범에서 나옵니다.`,
  feelEnergyLow: "잔잔한 쪽 — 마음을 가라앉히는 음악을 찾습니다.",
  feelEnergyMid: "중간 자리 — 곡에 따라 에너지가 달라지는 유연한 취향.",
  feelEnergyHigh: "에너지 높은 쪽 — 추진력과 임팩트 있는 사운드를 선호.",
  feelTempoLow: "느린 호흡 — 발라드·다운템포·앰비언트 위주.",
  feelTempoMid: "중간 템포 홈 — 팝·록·인디 전반에 잘 맞는 속도.",
  feelTempoHigh: "빠른 비트 — 댄스·펑크·드럼 중심 트랙이 더 잘 들어옵니다.",
  feelAcousticLow: "전자음 쪽 — 신스·프로그래밍 비트·가공된 텍스처 선호.",
  feelAcousticMid: "혼합 사운드 — 어쿠스틱과 전자음이 균형 잡혀 있어요.",
  feelAcousticHigh: "어쿠스틱 쪽 — 목소리·생악기가 중심.",
  dataDisclaimer:
    "통계는 YouTube Music 라이브러리에서 가져온 어림값입니다. 곡 매칭·장르·무드 데이터에 한계가 있어 정확하지 않을 수 있습니다.",
  dangerZoneTitle: "계정 삭제",
  dangerZoneDesc:
    "계정과 모든 데이터(좋아요 곡·분석·추천·심리분석)를 영구 삭제합니다.",
  deleteAccount: "내 계정·데이터 삭제",
  deleteConfirmWarn: "영구 삭제되며 되돌릴 수 없습니다. 정말 삭제할까요?",
  deleteConfirmYes: "네, 전부 삭제",
  deleteCancel: "취소",
};

export function libraryDict(locale: Locale) {
  return locale === "ko" ? ko : en;
}
