import type { Locale } from "../i18n";

const en = {
  pageTitle: "World Cup",
  pageIntro:
    "Pit two tracks against each other and pick the winner. Survivors advance, the final champion is your one absolute favorite from the batch. Pick a mode that frames the question you actually want to answer.",

  categoryTitle: "Pick a category",

  // Self-bracket modes — the product purpose. `library` is the headline.
  catLibraryLabel: "Random from my library",
  catLibraryHint:
    "Uniform-random sample from your WHOLE library — every corner of your taste gets a fair shot. Reshuffles every visit.",
  catRecentLabel: "Most-recently liked",
  catRecentHint:
    "Sampled from your newest likes (by YouTube Music's save order, not play count). Best for ranking the songs you've added recently.",
  catForgottenLabel: "Forgotten gems",
  catForgottenHint:
    "Random sample from the older half of your library — rediscover songs you haven't surfaced in a while.",

  // Genre keeps its own runner + card UI.
  catGenreLabel: "Find your favorite genre",
  catGenreHint: "Bracket of your genres — each card has sample tracks of yours.",

  // vs-the-world modes — still here but ranked below self-bracket.
  catDiscoverLabel: "Taste discovery",
  catDiscoverHint: "Fresh recommendations head-to-head — meet your next obsession.",
  catMixLabel: "Mix",
  catMixHint: "Old favorites vs. new picks. Half library, half discovery.",

  // Legacy — kept for the alias label fallback; never rendered in the picker.
  catLikedLabel: "From what I've liked",
  catLikedHint: "Your library, narrowed down to one absolute favorite.",

  catComingSoon: "Coming soon",

  sizeTitle: "Bracket size",
  sizeStart: "Start",
  sizeRoundCount: (rounds: number) => `${rounds} rounds`,

  notEnough: (have: number, need: number) =>
    `Need at least ${need} candidates for this size — you have ${have}. Try a smaller bracket or sync more songs.`,
  backToCategories: "← Categories",

  inProgressTitle: "Continue where you left off",
  inProgressResume: "Resume",
  inProgressDismiss: "Discard",
  inProgressRoundLabel: (round: number, total: number) =>
    `Round ${round} / ${total}`,
  inProgressPairLabel: (idx: number, of: number) =>
    `Pair ${idx} / ${of}`,

  // ── HomeHeroRow ──────────────────────────────────────────────────
  catCurateLabel: "AI-curated",
  // Bracket-size button suffix (e.g. "8강" in KO; nothing in EN).
  sizeSuffix: "",
  myCardHeader: "🏆 My music worldcup",
  myCardHint: "Library / forgotten / genre / AI-curated — pick one and a size",
  discoverHeader: "🧭 Discover new",
  discoverHint: "Tournament with fresh picks outside your usual taste",
  communityHeader: "🌐 Community",
  communityHint: "Worldcups made by others",

  // ── CommunityStatsBar ────────────────────────────────────────────
  // Suffix strings only — the bold number node is kept in JSX so the
  // count stays visually emphasised; these append the unit after it.
  pulseTitle: "Community pulse",
  pulseWorldcupsSuffix: " worldcups",
  pulseTotalPlaysSuffix: " total plays",
  pulseThisWeekPrefix: "this week ",
  pulseThisWeekSuffix: "",
  pulseTopChampions: "👑 Top champions",
  pulseTopCreators: "🧑‍🎤 Top creators",
  // creator-chip title tooltip: "<count> worldcups · <plays> plays"
  pulseCreatorTooltip: (worldcups: number, plays: number) =>
    `${worldcups} worldcups · ${plays.toLocaleString()} plays`,

  // ── community/page (list) ────────────────────────────────────────
  listBackHome: "Worldcup home",
  listTitle: "Community worldcups",
  listSearchChip: (q: string) => `search: "${q}"`,
  listClearAll: "Clear all",
  listIntro: "Tournaments other people made. Anyone can play.",
  listRecent: "🏁 Recent",
  listCreate: "+ Create",
  listSearchPlaceholder: "Search title / tags / description…",
  listClear: "Clear",
  listSortPopular: "🏆 Popular",
  listSortTrending: "📈 Trending",
  listSortNew: "🆕 New",
  listNoMatches: (q: string) => `No matches for "${q}".`,
  listBeFirstWithQuery: (q: string) =>
    `+ Be the first to make a "${q}" worldcup`,
  listEmpty: "No worldcups yet — be the first to make one.",
  listItemCount: (n: number) => `${n}-slot`,
  listItemPlays: (n: number) => `${n.toLocaleString()} plays`,

  // ── CreateForm ───────────────────────────────────────────────────
  createDraftRestored: "Restored your previous draft.",
  createStartFresh: "Start fresh",
  createTitleLabel: "Title",
  createTitlePlaceholder: "e.g. 90s K-Rock greatest hits",
  createDescLabel: "Description (optional)",
  createTagsLabel: "Tags (optional, up to 5)",
  createTagsPlaceholder: "Comma-separated · e.g. k-pop, idol, 2020s",
  createTagsHint:
    "Tagged worldcups can be filtered together on the community list.",
  createSizeLabel: "Bracket size",
  createImportTitle: "📋 Import from YouTube playlist",
  createImportHint:
    "Public or unlisted playlists only. Your personal Liked / Watch Later lists are off-limits to third-party API access.",
  createImportLoading: "Loading…",
  createImportLoad: "Load",
  createImportPickAtLeastOne: "Pick at least one.",
  createImportSummary: (total: number, picked: number) =>
    `${total} videos · ${picked} picked`,
  createImportSelectAll: "Select all",
  createImportClear: "Clear",
  createImportFill: "Fill into rows",
  createUrlsLabel: (valid: number, size: number) =>
    `YouTube URLs · ${valid} / ${size}`,
  createBasicMode: "Basic",
  createOverrideThumbnails: "Override thumbnails",
  createUrlsHint:
    "youtube.com / youtu.be / shorts URLs all work. 11-character video ID also fine.",
  createAdvancedHint:
    "Paste a thumbnail URL (album cover etc.) next to each row to override the default YouTube thumbnail. Empty = auto.",
  createThumbnailPlaceholder: "Thumbnail URL (optional)",
  createSubmitting: "Creating…",
  createSubmit: "Create",

  // ── CurateForm ───────────────────────────────────────────────────
  curateLensFavourites: "All-time favourites",
  curateLensRecent: "Recent obsessions",
  curateLensForgotten: "Forgotten gems",
  curateLensSad: "Sad / melancholic",
  curateLensPumpup: "Pump-up energy",
  curateLensLatenight: "Late-night chill",
  curateLensGuilty: "Guilty pleasures",
  curateLensBadge: "Lens",
  curateChangeLens: "Change lens",
  curateCustom: "Custom",
  curateCustomPlaceholder:
    "e.g. songs for rainy afternoons / songs I drove around with in 2019",
  curateBusy: "Curating…",
  curateBuild: (size: number) => `Build ${size}-bracket`,

  // ── RecentResultsFeed ────────────────────────────────────────────
  recentJustNow: "just now",
  recentMinAgo: (n: number) => `${n}m ago`,
  recentHrAgo: (n: number) => `${n}h ago`,
  recentDayAgo: (n: number) => `${n}d ago`,
  recentEmpty: "No results yet. Finished worldcups will show up here.",
  recentLoadingMore: "Loading more…",
  recentEndOfFeed: "End of feed",
  recentRefreshToLoad: "Refresh to load more",

  // ── Bracket (champion / promote / like buttons / round strip) ────
  // Suffix appended after the bold remaining-count node in JSX.
  bracketRemainSuffix: " remain",
  promoteOpen: "📤 Publish this bracket as a community worldcup",
  promoteTitleLabel: "Community worldcup title",
  promotePublishing: "Publishing…",
  promotePublish: "Publish",
  promoteCancel: "Cancel",
  likeSpotifySaved: "Saved to Spotify",
  likeSpotifyReconnect: "↻ Reconnect Spotify",
  likeSpotifySaving: "Saving…",
  likeSpotifySave: "♥ Save to Spotify",
  likeYtMusic: "Like in YT Music ↗",
  shareChampionShared: "Shared",
  shareChampionCopied: "Copied",
  shareChampionFailed: "Share failed",
  shareChampion: "Share",
  shareChampionText: (subject: string, url: string) =>
    `🏆 My World Cup champion: ${subject}\n${url}`,
};

const ko: typeof en = {
  pageTitle: "월드컵",
  pageIntro:
    "두 곡을 붙여 놓고 더 듣고 싶은 쪽을 고르세요. 이긴 곡은 다음 라운드로 진출하고, 마지막에 남은 우승곡이 이번 판의 절대 1픽. 진짜 답하고 싶은 질문에 맞는 모드를 고르세요.",

  categoryTitle: "카테고리 선택",

  catLibraryLabel: "내 라이브러리 전체에서 랜덤",
  catLibraryHint:
    "전체 라이브러리에서 균등 랜덤 추출 — 취향의 모든 구석이 공평하게 등장. 방문할 때마다 셔플됩니다.",
  catRecentLabel: "최근에 좋아요한 곡",
  catRecentHint:
    "YouTube Music에 저장한 순서 기준 최신 좋아요들 (재생 횟수 아님). 최근에 추가한 곡들 사이에서 1픽 가릴 때.",
  catForgottenLabel: "잊고 있던 명곡",
  catForgottenHint:
    "라이브러리 오래된 절반에서 랜덤 추출 — 한동안 안 떴던 곡을 다시 만납니다.",

  catGenreLabel: "최애 장르 찾기",
  catGenreHint: "내 장르들 끼리 토너먼트 — 카드마다 본인 라이브러리 곡 샘플 노출.",

  catDiscoverLabel: "취향 찾기",
  catDiscoverHint: "새 추천끼리 정면 비교 — 다음 빠질 곡을 발견.",
  catMixLabel: "섞기",
  catMixHint: "라이브러리 곡 vs 새 추천. 반반 섞어서.",

  catLikedLabel: "내가 들어본 노래 중",
  catLikedHint: "내 라이브러리에서 절대 1픽 가리기.",

  catComingSoon: "곧 추가",

  sizeTitle: "토너먼트 크기",
  sizeStart: "시작",
  sizeRoundCount: (rounds: number) => `${rounds}라운드`,

  notEnough: (have: number, need: number) =>
    `이 크기로 진행하려면 최소 ${need}곡 필요 — 현재 ${have}곡. 더 작은 크기를 고르거나 좋아요를 더 sync 하세요.`,
  backToCategories: "← 카테고리로",

  inProgressTitle: "이어서 하기",
  inProgressResume: "이어하기",
  inProgressDismiss: "버리기",
  inProgressRoundLabel: (round: number, total: number) =>
    `${total}라운드 중 ${round}라운드`,
  inProgressPairLabel: (idx: number, of: number) =>
    `${of}쌍 중 ${idx}쌍째`,

  // ── HomeHeroRow ──────────────────────────────────────────────────
  catCurateLabel: "AI 큐레이션",
  sizeSuffix: "강",
  myCardHeader: "🏆 내 음악 월드컵",
  myCardHint: "라이브러리·잊은 명곡·장르·AI 큐레이션 — 한 곳에서 시작",
  discoverHeader: "🧭 새 곡 디깅",
  discoverHint: "내 취향 밖 곡들로 토너먼트",
  communityHeader: "🌐 커뮤니티",
  communityHint: "다른 사람이 만든 월드컵",

  // ── CommunityStatsBar ────────────────────────────────────────────
  pulseTitle: "사람들 통계",
  pulseWorldcupsSuffix: "개 월드컵",
  pulseTotalPlaysSuffix: "회 진행",
  pulseThisWeekPrefix: "이번 주 ",
  pulseThisWeekSuffix: "회",
  pulseTopChampions: "👑 우승 TOP",
  pulseTopCreators: "🧑‍🎤 메이커 TOP",
  pulseCreatorTooltip: (worldcups: number, plays: number) =>
    `${worldcups}개 · ${plays.toLocaleString()}회`,

  // ── community/page (list) ────────────────────────────────────────
  listBackHome: "월드컵 홈",
  listTitle: "커뮤니티 월드컵",
  listSearchChip: (q: string) => `"${q}" 검색`,
  listClearAll: "모두 해제",
  listIntro: "다른 사람이 만든 토너먼트. 누구든 플레이 가능.",
  listRecent: "🏁 최근 결과",
  listCreate: "+ 만들기",
  listSearchPlaceholder: "제목·태그·설명 검색…",
  listClear: "지우기",
  listSortPopular: "🏆 인기",
  listSortTrending: "📈 트렌딩",
  listSortNew: "🆕 새로 나온",
  listNoMatches: (q: string) => `"${q}" 검색 결과 없음.`,
  listBeFirstWithQuery: (q: string) => `+ "${q}" 키워드로 첫 월드컵 만들기`,
  listEmpty: "아직 만들어진 월드컵이 없습니다. 첫 번째로 만들어 보세요.",
  listItemCount: (n: number) => `${n}강`,
  listItemPlays: (n: number) => `${n.toLocaleString()}회 진행`,

  // ── CreateForm ───────────────────────────────────────────────────
  createDraftRestored: "이전에 작성하던 초안을 불러왔습니다.",
  createStartFresh: "초안 비우기",
  createTitleLabel: "제목",
  createTitlePlaceholder: "예: 90년대 한국 록 명곡 월드컵",
  createDescLabel: "설명 (선택)",
  createTagsLabel: "태그 (선택, 최대 5개)",
  createTagsPlaceholder: "쉼표로 구분 · 예: k-pop, idol, 2020s",
  createTagsHint: "태그가 있으면 커뮤니티 목록에서 같은 태그끼리 묶여 노출돼요.",
  createSizeLabel: "토너먼트 크기",
  createImportTitle: "📋 유튜브 플리에서 가져오기",
  createImportHint:
    "공개 / 미공개(unlisted) 플리만 가능. 개인 '좋아요'·'나중에 볼 동영상'은 YouTube가 외부 API로 못 열어요.",
  createImportLoading: "가져오는 중…",
  createImportLoad: "불러오기",
  createImportPickAtLeastOne: "1개 이상 골라 주세요.",
  createImportSummary: (total: number, picked: number) =>
    `총 ${total}개 · ${picked}개 선택됨`,
  createImportSelectAll: "전체 선택",
  createImportClear: "전체 해제",
  createImportFill: "URL 칸에 채우기",
  createUrlsLabel: (valid: number, size: number) =>
    `YouTube URL · ${valid} / ${size}`,
  createBasicMode: "기본 모드",
  createOverrideThumbnails: "썸네일 직접 지정",
  createUrlsHint:
    "youtube.com / youtu.be / shorts URL 모두 OK. 11자 영상 ID 만 붙여도 됩니다.",
  createAdvancedHint:
    "각 행 옆에 썸네일 이미지 URL(앨범 커버 등)을 직접 넣으면 기본 YouTube 썸네일 대신 그걸 씁니다. 비워두면 자동.",
  createThumbnailPlaceholder: "썸네일 URL (선택)",
  createSubmitting: "만드는 중…",
  createSubmit: "만들기",

  // ── CurateForm ───────────────────────────────────────────────────
  curateLensFavourites: "최애 / 올타임 베스트",
  curateLensRecent: "요즘 빠진 곡",
  curateLensForgotten: "잊고있던 명곡",
  curateLensSad: "슬픈 / 우울한",
  curateLensPumpup: "기운 차리는",
  curateLensLatenight: "심야 청취",
  curateLensGuilty: "남몰래 좋아하는",
  curateLensBadge: "렌즈",
  curateChangeLens: "렌즈 바꾸기",
  curateCustom: "직접 입력",
  curateCustomPlaceholder: "예: 비 오는 날 듣고 싶은 곡 / 운전할 때 트는 노래",
  curateBusy: "AI 가 고르는 중…",
  curateBuild: (size: number) => `${size}곡 토너먼트 만들기`,

  // ── RecentResultsFeed ────────────────────────────────────────────
  recentJustNow: "방금",
  recentMinAgo: (n: number) => `${n}분 전`,
  recentHrAgo: (n: number) => `${n}시간 전`,
  recentDayAgo: (n: number) => `${n}일 전`,
  recentEmpty: "아직 결과가 없어요. 누군가 월드컵을 끝내면 여기에 표시됩니다.",
  recentLoadingMore: "더 가져오는 중…",
  recentEndOfFeed: "끝까지 봤어요",
  recentRefreshToLoad: "더 보려면 새로고침",

  // ── Bracket (champion / promote / like buttons / round strip) ────
  bracketRemainSuffix: "곡 남음",
  promoteOpen: "📤 이 토너먼트를 커뮤니티에 공개",
  promoteTitleLabel: "공개 토너먼트 제목",
  promotePublishing: "공개 중…",
  promotePublish: "공개",
  promoteCancel: "취소",
  likeSpotifySaved: "Spotify에 저장됨",
  likeSpotifyReconnect: "↻ Spotify 다시 연결",
  likeSpotifySaving: "저장 중…",
  likeSpotifySave: "♥ Spotify에 저장",
  likeYtMusic: "YT Music에서 좋아요",
  shareChampionShared: "공유 완료",
  shareChampionCopied: "복사됨",
  shareChampionFailed: "공유 실패",
  shareChampion: "공유",
  shareChampionText: (subject: string, url: string) =>
    `🏆 내 월드컵 우승: ${subject}\n${url}`,
};

export function worldcupDict(locale: Locale) {
  return locale === "ko" ? ko : en;
}
