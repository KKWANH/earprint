/**
 * Pre-baked editorial content per music genre. Keyed by lowercase
 * genre name (the same shape getGenreDetail uses when querying
 * analysis.genres). Lives as a typed TS file rather than a JSON
 * import so:
 *
 *   1. TypeScript checks every entry has the required fields (no
 *      half-filled rows shipping to prod).
 *   2. `pnpm tsc` flags string-literal typos before a deploy.
 *   3. The bundler tree-shakes unused entries on the client side
 *      (each `/genre/[name]` only ships the one it actually renders).
 *
 * To extend, either hand-edit this file or run:
 *   pnpm tsx apps/web/scripts/seed-genre-content.mjs
 *
 * The seed script reads the top-N genres in the live DB by user-track
 * count, asks Gemini to fill any genre not already present here, and
 * appends them — never overwriting hand-curated entries. After running
 * it, review the diff and commit.
 */

export interface GenreContent {
  /** Single emoji rendered in the hero. Pick one that's unambiguous;
   *  avoid skin-tone or compound ZWJ sequences because they render
   *  inconsistently across OSes. */
  emoji: string;
  /** Era label — short. Both langs optional but encouraged. */
  eraEn?: string;
  eraKo?: string;
  /** Region / cultural origin. Short, not "from the United States and
   *  later spreading worldwide" — that goes into history. */
  originEn?: string;
  originKo?: string;
  /** History blurb. 2-4 sentences. The page renders this below the
   *  short Gemini description from genre_info.description_*, so think
   *  of it as the layer of detail beneath the one-line elevator pitch:
   *  origin story + key turning point + why it sounds the way it does
   *  today. */
  historyEn: string;
  historyKo: string;
  /** Optional accent hue (0-360) — overrides genreHue() for the
   *  banner gradient. Set when the auto-hashed colour for the genre
   *  name happens to clash with the emoji or feels off. */
  accentHue?: number;
}

export const GENRE_CONTENT: Record<string, GenreContent> = {
  "k-pop": {
    emoji: "💖",
    eraEn: "1992 — today",
    eraKo: "1992년 — 현재",
    originEn: "South Korea",
    originKo: "대한민국",
    historyEn:
      "K-pop crystallised in 1992 when Seo Taiji and Boys fused hip-hop, rock, and Korean pop on national TV, breaking the long-running ballad monopoly. Through the late-90s idol-system pioneered by SM Entertainment and three later expansions (BoA's Japan crossover, the 2nd-gen export wave led by Girls' Generation and Wonder Girls, and BTS's global breakout), K-pop became an export industry built on rigorous training, tight choreography, and weaponised social media.",
    historyKo:
      "1992년 서태지와 아이들이 힙합·록·발라드를 한꺼번에 깨부수며 시작. SM이 만든 아이돌 시스템과 보아 일본 진출, 2세대 소녀시대·원더걸스의 해외 진출, BTS의 글로벌 폭발까지 — 빡센 트레이닝, 칼군무, SNS 활용까지 다 묶은 수출형 산업으로 자리잡음.",
    accentHue: 330,
  },
  "j-pop": {
    emoji: "🌸",
    eraEn: "1960s — today",
    eraKo: "1960년대 — 현재",
    originEn: "Japan",
    originKo: "일본",
    historyEn:
      "J-pop traces from 1960s kayōkyoku — Japanese popular song shaped by Western pop and enka — through the city-pop boom of the 70s-80s (Tatsuro Yamashita, Mariya Takeuchi), into the producer-led 90s Komuro Tetsuya era, and onward to today's anime-driven J-pop where artists like Yoasobi and Ado dominate both streaming and global TikTok charts.",
    historyKo:
      "60년대 가요곡에서 출발 → 7~80년대 시티팝(타츠로 야마시타, 타케우치 마리야) → 90년대 코무로 테츠야 프로듀서 시대 → 현재 애니메이션과 결합한 요아소비·Ado의 글로벌 챔. 한 노선이 아니라 매 10년마다 모양이 바뀐 장르.",
    accentHue: 350,
  },
  "indie pop": {
    emoji: "🌿",
    eraEn: "1980s — today",
    eraKo: "1980년대 — 현재",
    originEn: "UK / US (independent labels)",
    originKo: "영국 · 미국 (인디 레이블)",
    historyEn:
      "Indie pop named itself in mid-80s Britain — the C86 cassette from NME canonised jangly guitars, twee melodies, and lo-fi production as a deliberate rejection of polished major-label rock. The 2000s blog-era (Belle and Sebastian, The Postal Service) and the streaming-era bedroom-pop revival (Clairo, beabadoobee) both inherit the same anti-bombast DNA.",
    historyKo:
      "80년대 영국에서 C86 카세트로 정체성 굳힘 — 짤랑거리는 기타, 풋풋한 멜로디, 로파이 사운드로 메이저 록의 화려함에 일부러 반대. 2000년대 블로그 시대(벨앤세바스천)와 스트리밍 시대 베드룸팝(클레어로)까지 같은 DNA.",
  },
  "hip hop": {
    emoji: "🎤",
    eraEn: "1973 — today",
    eraKo: "1973년 — 현재",
    originEn: "South Bronx, New York",
    originKo: "뉴욕 사우스 브롱크스",
    historyEn:
      "Hip-hop started at a 1973 block party in the South Bronx where DJ Kool Herc looped funk breaks for B-boys. From the four pillars (DJing, MCing, B-boying, graffiti) it exploded through golden-age NY (Run-DMC, Public Enemy), the 90s East-West rivalry, the southern crunk/trap takeover, and SoundCloud rap's democratised distribution — becoming the dominant global pop language by the 2010s.",
    historyKo:
      "1973년 사우스 브롱크스 블록 파티에서 DJ 쿨 헉이 펑크 브레이크 루핑하면서 시작. DJ·MC·비보잉·그래피티 4대 요소에서 출발해 80년대 골든에이지 → 90년대 동서부 대결 → 남부 크렁크/트랩 → 사운드클라우드 랩까지. 2010년대 들어 글로벌 팝의 디폴트 언어가 됨.",
    accentHue: 30,
  },
  "rock": {
    emoji: "🎸",
    eraEn: "1950s — today",
    eraKo: "1950년대 — 현재",
    originEn: "United States / United Kingdom",
    originKo: "미국 · 영국",
    historyEn:
      "Rock 'n' roll fused 50s rhythm & blues with country into a teenage soundtrack via Chuck Berry, Elvis, and Little Richard. The 60s British Invasion (Beatles, Stones) made it global; 70s splintered it into prog, glam, punk, and metal; alt-rock and grunge dominated the 90s. Even after streaming demoted rock from pop's centre, every decade since has had a guitar revival.",
    historyKo:
      "50년대 R&B와 컨트리가 만나 척 베리·엘비스·리틀 리처드 손에서 청춘 사운드로 폭발. 60년대 비틀즈·스톤즈의 영국 침공이 글로벌화시키고, 70년대 프록·글램·펑크·메탈로 갈라졌고 90년대 얼터너티브·그런지가 한 번 더 점령. 스트리밍 시대에 자리 좁아졌지만 매 10년마다 기타 부활이 돌아옴.",
  },
  "ballad": {
    emoji: "💌",
    eraEn: "1970s — today (Korean ballad)",
    eraKo: "1970년대 — 현재 (한국 발라드)",
    originEn: "Korea / global (slow love song lineage)",
    originKo: "한국 (글로벌 슬로 러브송 계보 위)",
    historyEn:
      "In Korea, balladry crystallised in the 80s with Lee Moon-se, Yoo Jae-ha, and Byun Jin-sub setting the template: piano-led, vocal-forward, emotionally restrained. The 90s (Kim Gun-mo, Shin Seung-hun) commercialised it; the 2000s OST boom (Lee Soo-young, Baek Ji-young) wedded ballad to K-drama; today's IU and 10cm carry the lineage with more modern production.",
    historyKo:
      "한국 발라드는 80년대 이문세·유재하·변진섭이 피아노·보컬 중심의 정제된 감정선이라는 공식을 만듦. 90년대 김건모·신승훈이 대중화, 2000년대 OST 붐(이수영·백지영)이 드라마와 결합, 현재 아이유·10cm가 모던한 프로덕션으로 계보 이어감.",
    accentHue: 290,
  },
  "r&b": {
    emoji: "🌙",
    eraEn: "1940s — today",
    eraKo: "1940년대 — 현재",
    originEn: "African American communities, US",
    originKo: "미국 흑인 사회",
    historyEn:
      "R&B started as a 40s post-war term for African American popular music — gospel + blues + jazz fused into something danceable. Through Motown (60s soul), Philly soul (70s), New Jack Swing (late 80s), and contemporary R&B (Mariah, Whitney, Boyz II Men), it kept reinventing the same core: vocal acrobatics over groove. PartyNextDoor, SZA, and Frank Ocean stretch it further today.",
    historyKo:
      "40년대 미국 흑인 대중음악 통칭으로 시작 — 가스펠+블루스+재즈가 댄서블하게 합쳐진 것. 모타운(60s 소울), 필리 소울, 뉴잭스윙(80s 후반), 컨템포러리 R&B(머라이어·휘트니)까지 핵심은 같음: 그루브 위 보컬 곡예. 지금은 SZA·프랭크 오션이 또 새 모양으로 늘림.",
    accentHue: 250,
  },
  "jazz": {
    emoji: "🎷",
    eraEn: "1900s — today",
    eraKo: "1900년대 — 현재",
    originEn: "New Orleans, US",
    originKo: "미국 뉴올리언스",
    historyEn:
      "Jazz coalesced in early-1900s New Orleans from blues, ragtime, and brass-band traditions in Black communities. From the 20s swing era (Louis Armstrong, Duke Ellington), through bebop's 40s revolution (Charlie Parker), cool jazz (Miles Davis), free jazz (Coltrane), and fusion (Weather Report) — jazz has functioned for a century as the working musician's grammar of improvisation, exported into every other genre that uses chord substitutions.",
    historyKo:
      "1900년대 초 뉴올리언스 흑인 사회에서 블루스·래그타임·브라스 밴드가 합쳐져 결정화. 20년대 스윙(루이 암스트롱·듀크 엘링턴), 40년대 비밥(찰리 파커), 쿨재즈(마일스 데이비스), 프리재즈(콜트레인), 퓨전까지 — 100년간 즉흥연주의 문법 그 자체. 코드 대체를 쓰는 모든 장르가 빚지고 있음.",
    accentHue: 200,
  },
  "electronic": {
    emoji: "🎛️",
    eraEn: "1970s — today",
    eraKo: "1970년대 — 현재",
    originEn: "Germany / UK / US",
    originKo: "독일 · 영국 · 미국",
    historyEn:
      "Electronic music has two parallel lineages: art-side (Stockhausen, Kraftwerk pioneering synthesised composition in the 60s-70s) and club-side (Chicago house and Detroit techno emerging in the mid-80s from disco's wake). Through the 90s rave era, the 2000s EDM mainstream (Deadmau5, Skrillex, Avicii), and today's hyperpop and IDM revivals, electronic music keeps absorbing every other genre while exporting its production tools to all of pop.",
    historyKo:
      "두 갈래 — 아트(슈톡하우젠·크라프트베르크가 60~70년대에 신디 작곡 개척)와 클럽(80년대 중반 시카고 하우스·디트로이트 테크노). 90년대 레이브, 2000년대 EDM 메인스트림(데드마우스·스크릴렉스·아비치), 현재 하이퍼팝·IDM까지. 다른 장르를 흡수하면서 동시에 자기 프로덕션 도구를 모든 팝에 수출 중.",
    accentHue: 180,
  },
  "city pop": {
    emoji: "🌃",
    eraEn: "1978 — 1988 (revival 2017—)",
    eraKo: "1978 — 1988년 (2017년 재발견)",
    originEn: "Tokyo, Japan",
    originKo: "일본 도쿄",
    historyEn:
      "City pop bloomed in the urbane-bubble 80s Tokyo — slick session players, AOR-influenced production, and lyrics about driving the bayshore at night. Tatsuro Yamashita, Mariya Takeuchi, and Anri defined it. After the bubble burst it faded — then in 2017, Mariya Takeuchi's \"Plastic Love\" went viral on YouTube algorithm, kicking off a global vaporwave-adjacent revival that's still ongoing.",
    historyKo:
      "버블 경제기 도쿄에서 활짝 — 능숙한 세션 연주자들의 매끈한 AOR 사운드, 가사는 밤바다 드라이브. 타츠로 야마시타·마리야 타케우치·안리가 정의함. 버블 붕괴 후 사라졌다가 2017년 \"Plastic Love\"가 유튜브 알고리즘 타고 글로벌 바이럴 — 베이퍼웨이브와 엮인 부활이 지금도 진행 중.",
    accentHue: 220,
  },
};

/** Returns pre-baked content for a genre, normalising the lookup key. */
export function getGenreContent(name: string): GenreContent | null {
  if (!name) return null;
  const key = name.toLowerCase().trim();
  return GENRE_CONTENT[key] ?? null;
}
