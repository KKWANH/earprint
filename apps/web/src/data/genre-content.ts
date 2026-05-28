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
  /** Optional cover image — rendered as a full-bleed 16:9 panel
   *  above the gradient hero. Use stable hosts (Wikimedia Commons,
   *  flickr CC, the artist's own band camp / press kit) so the URL
   *  doesn't rot. NEVER upload to our own storage; we don't want to
   *  become an image host.
   *
   *  Curation rule of thumb: pick a representative *moment* in the
   *  genre, not a generic stock photo. K-pop = a defining stage shot;
   *  jazz = Coltrane / Davis at the mic; city pop = an actual 12"
   *  jacket. The image should make a fan nod, not bore them.
   *
   *  Licensing: ONLY images that are CC-licensed, Public Domain, or
   *  explicit press-kit "OK to use with credit" sources. The `credit`
   *  string is required and rendered below the image. */
  coverImage?: {
    url: string;
    /** Short descriptive alt text for screen readers + image search. */
    alt: string;
    /** "Photo: <author>, CC BY-SA 4.0" or similar. Rendered below the image. */
    credit: string;
  };
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
    // TODO(cover image): paste a Wikimedia Commons / CC-licensed URL.
    // Example shape:
    //   coverImage: {
    //     url: "https://upload.wikimedia.org/wikipedia/commons/…",
    //     alt: "BTS performing at the 63rd Annual Grammy Awards",
    //     credit: "Photo: Recording Academy, CC BY-SA 4.0",
    //   },
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

  // ─── seeded by scripts/seed-genre-content.mjs on 2026-05-29 ───
  "indie rock": {
    emoji: "🎸",
    eraEn: "1980s — today",
    eraKo: "1980년대 — 오늘날",
    originEn: "United Kingdom, United States",
    originKo: "영국, 미국",
    historyEn:
      "Emerging from the post-punk and new wave scenes of the late 1970s and early 1980s, indie rock initially signified music produced independently from major record labels. Its defining characteristic became its DIY ethos, raw production, and often introspective or unconventional lyrical themes, differentiating it from the more polished sound of mainstream rock.",
    historyKo:
      "1970년대 후반과 1980년대 초반의 포스트 펑크 및 뉴웨이브 씬에서 등장한 인디 록은 처음에는 메이저 음반사에서 독립적으로 제작된 음악을 의미했습니다. DIY 정신, 거친 프로덕션, 종종 내성적이거나 비범한 가사 테마가 특징이 되었으며, 이는 주류 록의 세련된 사운드와 차별화되었습니다.",
  },
  "alternative rock": {
    emoji: "🎸",
    eraEn: "1970s — today",
    eraKo: "1970년대 — 오늘날",
    originEn: "United Kingdom, United States",
    originKo: "영국, 미국",
    historyEn:
      "Emerging from the independent music scenes of the 1970s and 80s, alternative rock became a major force in the 1990s, challenging the dominance of mainstream rock and pop. Its sound is characterized by its rejection of commercial polish, often featuring distorted guitars, unconventional song structures, and introspective or socially conscious lyrics. This spirit of experimentation and authenticity continues to define its diverse subgenres today.",
    historyKo:
      "1970년대와 80년대 인디 음악 씬에서 등장한 얼터너티브 록은 1990년대 주류 록과 팝의 판도를 뒤흔들며 주요 장르로 부상했습니다. 상업적인 완성도를 거부하는 특징을 가지며, 왜곡된 기타 사운드, 실험적인 곡 구성, 성찰적이거나 사회 비판적인 가사가 자주 사용됩니다. 이러한 실험 정신과 진정성은 오늘날 다양한 하위 장르를 정의하는 기반이 되고 있습니다.",
  },
  "pop rock": {
    emoji: "🎸",
    eraEn: "1950s — today",
    eraKo: "1950년대 — 현재",
    originEn: "United States",
    originKo: "미국",
    historyEn:
      "Pop rock emerged in the mid-1950s as rock and roll began to incorporate more melodic and accessible elements from pop music. By the 1960s and 70s, bands like The Beatles and Fleetwood Mac refined this fusion, creating polished, radio-friendly songs with strong hooks. Today, pop rock continues to evolve, blending catchy melodies and accessible structures with diverse rock instrumentation and production techniques.",
    historyKo:
      "팝 록은 1950년대 중반 로큰롤이 팝 음악의 멜로디적이고 대중적인 요소를 흡수하면서 등장했습니다. 1960년대와 70년대에는 비틀즈, 플리트우드 맥과 같은 밴드들이 이 융합을 세련되게 다듬어 강한 중독성을 가진 라디오 친화적인 곡들을 만들었습니다. 오늘날 팝 록은 다양한 록 악기와 프로덕션 기법에 귀에 맴도는 멜로디와 접근하기 쉬운 구조를 결합하며 계속 진화하고 있습니다.",
  },
  "synth-pop": {
    emoji: "🎤",
    eraEn: "1970s — today",
    eraKo: "1970년대 — 현재",
    originEn: "United Kingdom",
    originKo: "영국",
    historyEn:
      "Synth-pop emerged in the late 1970s and early 1980s, driven by the increasing accessibility of synthesizers and electronic music technology. Key artists like Depeche Mode and The Human League popularized the genre, blending catchy pop melodies with futuristic electronic soundscapes. Today, synth-pop continues to evolve, influencing electronic dance music and modern pop with its distinctive synthesized textures and danceable rhythms.",
    historyKo:
      "신스팝은 1970년대 후반과 1980년대 초반, 신디사이저와 전자음악 기술의 접근성이 높아지면서 등장했습니다. 데페쉬 모드, 휴먼 리그와 같은 주요 아티스트들은 귀에 꽂히는 팝 멜로디와 미래지향적인 전자 사운드스케이프를 결합하여 이 장르를 대중화했습니다. 오늘날 신스팝은 그 특유의 신디사이저 질감과 댄서블한 리듬으로 일렉트로닉 댄스 음악과 현대 팝에 영향을 미치며 계속 진화하고 있습니다.",
  },
  "hard rock": {
    emoji: "🎸",
    eraEn: "1960s — today",
    eraKo: "1960년대 — 오늘날",
    originEn: "United Kingdom and United States",
    originKo: "영국 및 미국",
    historyEn:
      "Emerging in the late 1960s, hard rock built upon blues-rock and psychedelic rock, featuring heavier guitar riffs, powerful vocals, and driving rhythms. Key turning points included bands like Led Zeppelin and Deep Purple, who amplified their sound with distortion and a focus on instrumental prowess. Today, it's characterized by its raw energy, prominent guitar solos, and anthemic choruses, influencing countless subgenres.",
    historyKo:
      "1960년대 후반에 등장한 하드 록은 블루스 록과 사이키델릭 록을 기반으로 더 강렬한 기타 리프, 파워풀한 보컬, 역동적인 리듬을 특징으로 합니다. 레드 제플린, 딥 퍼플과 같은 밴드들이 디스토션과 뛰어난 연주력으로 사운드를 증폭시키며 중요한 전환점을 만들었습니다. 오늘날 하드 록은 날것의 에너지, 두드러지는 기타 솔로, 앤썸 코러스를 특징으로 하며 수많은 하위 장르에 영향을 미쳤습니다.",
  },
  "dream pop": {
    emoji: "☁️",
    eraEn: "1980s — today",
    eraKo: "1980년대 — 현재",
    originEn: "United Kingdom",
    originKo: "영국",
    historyEn:
      "Emerging in the mid-1980s from the UK's post-punk and shoegaze scenes, dream pop is characterized by its ethereal soundscapes, often created with heavily processed guitars and synthesizers. Its defining feature is a dreamy, atmospheric quality, achieved through layers of reverb, delay, and shimmering melodies, evoking a sense of escapism and introspection.",
    historyKo:
      "1980년대 중반 영국 포스트 펑크와 슈게이징 씬에서 등장한 드림 팝은 주로 이펙터로 처리된 기타와 신디사이저를 사용하여 몽환적인 사운드스케이프를 특징으로 합니다. 리버브, 딜레이, 반짝이는 멜로디의 레이어를 통해 달아나는 듯한 느낌과 내면을 탐구하는 듯한 분위기를 자아내는 것이 특징입니다.",
  },
  "dance-pop": {
    emoji: "🕺",
    eraEn: "1970s — today",
    eraKo: "1970년대 — 오늘날",
    originEn: "United States",
    originKo: "미국",
    historyEn:
      "Dance-pop emerged in the late 1970s and early 1980s, evolving from disco and incorporating elements of synth-pop and R&B. Its key turning point was the rise of MTV, which allowed visually engaging artists to reach a global audience. Today, dance-pop is characterized by its infectious beats, catchy melodies, and polished production, designed for maximum radio play and club success.",
    historyKo:
      "댄스 팝은 1970년대 후반과 1980년대 초반에 디스코에서 진화하여 신스팝과 R&B 요소를 통합하면서 등장했습니다. MTV의 부상은 시각적으로 매력적인 아티스트들이 전 세계적인 인지도를 얻을 수 있게 한 결정적인 전환점이었습니다. 오늘날 댄스 팝은 최대의 라디오 플레이와 클럽 성공을 목표로 하는 중독성 있는 비트, 귀에 맴도는 멜로디, 세련된 프로덕션으로 특징지어집니다.",
  },
  "modern rock": {
    emoji: "🎸",
    eraEn: "1980s — today",
    eraKo: "1980년대 — 현재",
    originEn: "United States and United Kingdom",
    originKo: "미국 및 영국",
    historyEn:
      "Modern rock emerged in the late 1980s and early 1990s as a more accessible and diverse evolution of punk and new wave. Key artists like R.E.M. and U2 blended melodic sensibilities with a harder edge, while grunge pioneers Nirvana and Pearl Jam brought raw emotion and anthemic power. This led to a widespread commercial appeal, incorporating elements from alternative, indie, and even pop, shaping the mainstream rock sound for decades.",
    historyKo:
      "모던 록은 1980년대 후반과 1990년대 초반, 펑크와 뉴웨이브의 더욱 접근하기 쉽고 다양한 진화로 등장했습니다. R.E.M.과 U2 같은 주요 아티스트들은 멜로디 감각과 거친 에지를 결합했고, 그런지의 선구자인 너바나와 펄 잼은 날것의 감정과 앤섬적인 파워를 가져왔습니다. 이는 얼터너티브, 인디, 심지어 팝의 요소를 통합하며 수십 년 동안 주류 록 사운드를 형성하며 폭넓은 상업적 성공을 거두었습니다.",
  },
  "punk rock": {
    emoji: "🎸",
    eraEn: "1970s — today",
    eraKo: "1970년대 — 오늘날",
    originEn: "United States, United Kingdom",
    originKo: "미국, 영국",
    historyEn:
      "Emerging in the mid-1970s, punk rock was a raw reaction against the perceived excesses of mainstream rock and the societal norms of the time. Its stripped-down, aggressive sound, often characterized by fast tempos, short songs, and minimalist instrumentation, became a defining element of its ethos. This DIY (Do It Yourself) spirit continues to influence countless subgenres and independent music scenes.",
    historyKo:
      "1970년대 중반 등장한 펑크 록은 주류 록의 과잉과 당시 사회 규범에 대한 날카로운 반작용이었습니다. 간결하고 공격적인 사운드는 빠른 템포, 짧은 곡 길이, 미니멀한 악기 구성으로 특징지어졌으며, 이는 펑크의 정신을 정의하는 요소가 되었습니다. 이러한 DIY(Do It Yourself) 정신은 수많은 하위 장르와 독립 음악 씬에 계속해서 영향을 미치고 있습니다.",
  },
  "korean indie": {
    emoji: "🇰🇷",
    eraEn: "1990s — today",
    eraKo: "1990년대 — 오늘",
    originEn: "South Korea",
    originKo: "대한민국",
    historyEn:
      "Korean indie music emerged in the late 1990s and early 2000s, driven by a desire for creative freedom outside the dominant K-pop industry. Early bands often drew inspiration from Western indie and punk scenes, establishing a DIY ethos. Today, Korean indie encompasses a vast spectrum of sounds, from energetic rock and folk to electronic and R&B-infused styles, reflecting a diverse and evolving artistic landscape.",
    historyKo:
      "한국 인디 음악은 지배적인 K팝 산업 밖에서의 창의적 자유를 추구하며 1990년대 후반과 2000년대 초반에 등장했습니다. 초기 밴드들은 종종 서구 인디 및 펑크 씬에서 영감을 받아 DIY 정신을 확립했습니다. 오늘날 한국 인디는 활기찬 록과 포크부터 일렉트로닉, R&B 요소를 가미한 스타일까지 광범위한 사운드를 포괄하며, 다양하고 진화하는 예술적 풍경을 반영합니다.",
  },
  "trap": {
    emoji: "🔊",
    eraEn: "1990s — today",
    eraKo: "1990년대 — 현재",
    originEn: "Atlanta, Georgia, USA",
    originKo: "미국 조지아주 애틀랜타",
    historyEn:
      "Trap music originated in the Southern United States in the early 1990s, drawing heavily from Southern hip hop. Its distinctive sound evolved with the rise of Atlanta as a hub, incorporating 808 drum machines, layered synths, and often lyrical themes focused on drug dealing and street life. Today, trap is a dominant force in hip hop and has influenced electronic dance music significantly.",
    historyKo:
      "트랩 음악은 1990년대 초 미국 남부에서 시작되어 서던 힙합의 영향을 크게 받았습니다. 특히 애틀랜타를 중심으로 발전하면서 808 드럼 머신, 레이어링된 신스 사운드, 그리고 마약 거래나 거리 생활을 다루는 가사가 특징이 되었습니다. 오늘날 트랩은 힙합의 주요 흐름이며 EDM에도 상당한 영향을 미치고 있습니다.",
  },
  "korean hip hop": {
    emoji: "🎤",
    eraEn: "1992 — today",
    eraKo: "1992 — 현재",
    originEn: "South Korea",
    originKo: "대한민국",
    historyEn:
      "Korean hip-hop emerged in the early 1990s, heavily influenced by American hip-hop culture. Seo Taiji and Boys' 1992 debut is widely considered a pivotal moment, introducing rap and hip-hop elements into the mainstream Korean music scene. Today, K-hip-hop is characterized by its diverse sounds, often blending traditional Korean musical elements with modern trap, R&B, and electronic influences, featuring complex lyricism and a strong emphasis on social commentary.",
    historyKo:
      "한국 힙합은 1990년대 초 미국 힙합 문화의 영향을 받아 탄생했습니다. 1992년 서태지와 아이들의 데뷔는 랩과 힙합 요소를 한국 주류 음악계에 소개하며 결정적인 전환점이 되었습니다. 오늘날 K-힙합은 복잡한 가사와 사회 비평에 대한 강한 강조를 특징으로 하며, 전통적인 한국 음악 요소와 현대적인 트랩, R&B, 일렉트로닉 사운드를 혼합한 다양한 스타일을 선보입니다.",
  },
  "funk": {
    emoji: "🕺",
    eraEn: "1960s — today",
    eraKo: "1960년대 — 현재",
    originEn: "United States",
    originKo: "미국",
    historyEn:
      "Funk music emerged in the mid-1960s, pioneered by artists like James Brown, who emphasized rhythmic groove over melody and harmony. Its defining characteristic is the syncopated bassline and drum beat, creating an irresistible urge to dance. Funk heavily influenced disco, hip-hop, and contemporary R&B, laying the foundation for much of modern popular music.",
    historyKo:
      "1960년대 중반 제임스 브라운과 같은 아티스트들이 멜로디와 화음보다 리듬감을 강조하며 펑크 음악이 탄생했습니다. 펑크의 가장 큰 특징은 춤을 추고 싶은 충동을 일으키는 싱코페이션(당김음) 베이스라인과 드럼 비트입니다. 펑크는 디스코, 힙합, 현대 R&B에 큰 영향을 미쳤으며, 오늘날 대중음악의 많은 부분을 위한 토대를 마련했습니다.",
  },
  "synthpop": {
    emoji: "🎹",
    eraEn: "1970s — today",
    eraKo: "1970년대 — 현재",
    originEn: "United Kingdom",
    originKo: "영국",
    historyEn:
      "Synth-pop emerged in the late 1970s and early 1980s, heavily influenced by the accessibility of synthesizers and electronic production. It gained mainstream popularity through bands like Depeche Mode and The Human League, characterized by catchy melodies, electronic instrumentation, and often detached vocal styles. Today, synth-pop continues to evolve, influencing numerous subgenres and modern pop music with its blend of electronic textures and pop sensibilities.",
    historyKo:
      "신스팝은 1970년대 후반과 1980년대 초반, 신디사이저와 전자 음악 제작 기술의 발달과 함께 등장했습니다. 디페쉬 모드, 휴먼 리그 같은 밴드들이 대중적인 인기를 얻으며 신스팝은 전자 악기 사운드, 간결한 멜로디, 종종 차분한 보컬 스타일을 특징으로 삼았습니다. 오늘날 신스팝은 끊임없이 발전하며 전자적인 질감과 팝적인 감성을 결합한 사운드로 수많은 하위 장르와 현대 팝 음악에 영향을 미치고 있습니다.",
  },
  "neo-soul": {
    emoji: "🎤",
    eraEn: "1990s — today",
    eraKo: "1990년대 — 현재",
    originEn: "United States",
    originKo: "미국",
    historyEn:
      "Neo-soul emerged in the late 1990s as a conscious effort by artists to revive the spirit and musicality of classic soul, while infusing it with contemporary R&B, jazz, hip hop, and funk influences. Key artists like Erykah Badu and D'Angelo eschewed the polished, mainstream R&B sound for more organic instrumentation, introspective lyrics, and a laid-back, improvisational feel. This fusion created a sound that is both nostalgic and modern, prioritizing groove, vocal prowess, and lyrical depth over typical pop structures.",
    historyKo:
      "네오 소울은 1990년대 후반, 클래식 소울의 정신과 음악성을 부활시키면서도 현대 R&B, 재즈, 힙합, 펑크를 융합하려는 아티스트들의 의도적인 노력으로 탄생했습니다. 에리카 바두, 딜런젤로와 같은 주요 아티스트들은 정제되고 주류적인 R&B 사운드 대신 유기적인 악기 구성, 성찰적인 가사, 여유롭고 즉흥적인 느낌을 추구했습니다. 이러한 융합은 향수를 불러일으키면서도 현대적인 사운드를 만들어냈으며, 일반적인 팝 구조보다 그루브, 보컬 역량, 가사의 깊이를 우선시했습니다.",
  },
  "j-rock": {
    emoji: "🎸",
    eraEn: "1960s — today",
    eraKo: "1960년대 — 현재",
    originEn: "Japan",
    originKo: "일본",
    historyEn:
      "J-rock, or Japanese rock, emerged in the 1960s and 1970s, heavily influenced by Western rock and roll and pop music. Its defining characteristic is the blending of diverse musical elements, from punk and metal to pop and electronic, often creating a unique visual aesthetic that emphasizes theatricality and fashion. Today, J-rock continues to evolve, embracing global influences while maintaining its distinct Japanese identity, celebrated for its energetic performances and genre-bending creativity.",
    historyKo:
      "J-rock, 또는 일본 록은 1960년대와 1970년대에 서양의 록앤롤과 팝 음악의 영향을 크게 받아 탄생했습니다. 펑크, 메탈부터 팝, 일렉트로닉까지 다양한 음악 요소를 혼합하는 것이 특징이며, 종종 연극성과 패션을 강조하는 독특한 시각적 미학을 만들어냅니다. 오늘날 J-rock은 전 세계적인 영향을 수용하면서도 독특한 일본의 정체성을 유지하며 계속 진화하고 있으며, 에너지 넘치는 공연과 장르를 넘나드는 창의성으로 찬사를 받고 있습니다.",
  },
  "classic rock": {
    emoji: "🎸",
    eraEn: "1960s — 1990s",
    eraKo: "1960년대 — 1990년대",
    originEn: "United States and United Kingdom",
    originKo: "미국 및 영국",
    historyEn:
      "Classic rock emerged in the late 1960s and early 1970s, evolving from blues and psychedelic rock. It's characterized by its guitar-driven sound, often featuring blues-based riffs, powerful vocals, and extended instrumental solos. This era saw the solidification of the album as a primary artistic statement, moving away from single-focused pop.",
    historyKo:
      "클래식 록은 1960년대 후반과 1970년대 초반에 블루스와 사이키델릭 록에서 발전했습니다. 기타 중심의 사운드, 블루스 기반 리프, 파워풀한 보컬, 그리고 긴 연주 솔로가 특징입니다. 이 시기에는 싱글 중심에서 벗어나 앨범 자체가 주요 예술적 표현으로 자리 잡게 되었습니다.",
  },
  "psychedelic rock": {
    emoji: "🍄",
    eraEn: "1960s — present",
    eraKo: "1960년대 — 현재",
    originEn: "United States / United Kingdom",
    originKo: "미국 / 영국",
    historyEn:
      "Psychedelic rock emerged in the mid-1960s in the United States and the United Kingdom, heavily influenced by the counterculture movement and the use of psychedelic drugs. Key turning points included the Monterey Pop Festival and the \"Summer of Love,\" which cemented its popularity. The genre is characterized by distorted guitars, echo effects, and unconventional song structures, aiming to replicate or enhance the mind-altering experiences associated with psychedelics.",
    historyKo:
      "사이키델릭 록은 1960년대 중반 미국과 영국에서 반문화 운동과 환각제 사용의 영향으로 등장했습니다. 몬터레이 팝 페스티벌과 '사랑의 여름'이 중요한 전환점이 되어 인기를 확고히 했습니다. 이 장르는 환각 경험을 재현하거나 향상시키기 위해 왜곡된 기타 사운드, 에코 효과, 비정형적인 곡 구조를 특징으로 합니다.",
  },
  "korean rock": {
    emoji: "🎸",
    eraEn: "1970s — today",
    eraKo: "1970년대 — 현재",
    originEn: "South Korea",
    originKo: "대한민국",
    historyEn:
      "Korean rock music emerged in the late 1960s and early 1970s, heavily influenced by Western rock and folk. A significant turning point came in the 1980s with the rise of 'Sanullim' and their unique psychedelic sound, blending Korean traditional melodies with rock elements. This fusion paved the way for diverse subgenres today, from indie rock to heavy metal, often incorporating distinctly Korean lyrical themes and instrumentation.",
    historyKo:
      "한국 록 음악은 1960년대 후반과 70년대 초 서구 록과 포크 음악의 영향을 받아 탄생했습니다. 1980년대 '산울림'의 등장과 함께 한국 전통 선율과 록 요소를 결합한 독특한 사이키델릭 사운드로 중요한 전환점을 맞이했습니다. 이러한 융합은 오늘날 인디 록부터 헤비메탈까지 다양한 하위 장르의 길을 열었으며, 종종 한국적인 가사 주제와 악기 편성을 포함합니다.",
  },
  "classical": {
    emoji: "🏛️",
    eraEn: "c. 1000 — today",
    eraKo: "c. 1000 — 현재",
    originEn: "Europe",
    originKo: "유럽",
    historyEn:
      "Classical music emerged in Europe, primarily during the Baroque, Classical, and Romantic eras, evolving from earlier religious and secular traditions. Its development was shaped by innovations in musical notation, instrument technology, and the patronage of the church and aristocracy. This rich history, characterized by complex compositional forms like symphonies and operas, and a focus on harmonic and melodic development, continues to influence contemporary music.",
    historyKo:
      "고전 음악은 유럽에서 주로 바로크, 고전, 낭만 시대를 거치며 발전했으며, 이전의 종교 및 세속 음악 전통에서 기원했습니다. 악보, 악기 기술의 혁신, 교회와 귀족의 후원이 발전의 주요 요인이었습니다. 교향곡, 오페라와 같은 복잡한 형식과 화성, 선율 발전에 중점을 둔 이러한 풍부한 역사는 오늘날에도 현대 음악에 영향을 미치고 있습니다.",
  },
  "blues rock": {
    emoji: "🎸",
    eraEn: "1960s — today",
    eraKo: "1960년대 — 현재",
    originEn: "United States / United Kingdom",
    originKo: "미국 / 영국",
    historyEn:
      "Blues rock emerged in the mid-1960s as British and American musicians fused blues structures and scales with rock and roll's energy and instrumentation. Key figures like Eric Clapton and Jimi Hendrix pushed the genre forward with extended guitar solos and a heavier, more distorted sound. This evolution cemented blues rock's characteristic blend of raw emotion, virtuosic guitar work, and driving rhythms.",
    historyKo:
      "블루스 록은 1960년대 중반, 영국과 미국의 음악가들이 블루스의 구조와 스케일에 록앤롤의 에너지와 악기 편성을 융합하면서 등장했습니다. 에릭 클랩튼, 지미 헨드릭스와 같은 핵심 인물들은 길고 격렬한 기타 솔로와 더 무겁고 왜곡된 사운드로 장르를 발전시켰습니다. 이러한 진화는 블루스 록 특유의 거친 감정, 뛰어난 기타 연주, 역동적인 리듬의 결합을 확고히 했습니다.",
  },
  "soul": {
    emoji: "❤️",
    eraEn: "1950s — today",
    eraKo: "1950년대 — 현재",
    originEn: "United States",
    originKo: "미국",
    historyEn:
      "Emerging in the late 1950s and early 1960s in the United States, soul music blended African-American gospel music, rhythm and blues, and jazz. Its distinctive sound is characterized by passionate vocal performances, often featuring call-and-response patterns and improvisational elements. Soul music became a powerful voice for Black identity and social change during the Civil Rights Movement, evolving into diverse subgenres that continue to influence music today.",
    historyKo:
      "1950년대 후반과 1960년대 초 미국에서 등장한 소울 음악은 아프리카계 미국인의 가스펠, 리듬 앤 블루스, 재즈를 혼합했습니다. 열정적인 보컬 퍼포먼스, 콜 앤 리스폰스 패턴, 즉흥 연주 요소가 특징입니다. 소울 음악은 민권 운동 동안 흑인 정체성과 사회 변화의 강력한 목소리가 되었으며, 오늘날에도 음악에 영향을 미치는 다양한 하위 장르로 발전했습니다.",
  },
  "folk rock": {
    emoji: "🎸",
    eraEn: "1960s — today",
    eraKo: "1960년대 — 현재",
    originEn: "United States",
    originKo: "미국",
    historyEn:
      "Folk rock emerged in the mid-1960s, blending the acoustic instrumentation and storytelling of folk music with the electric guitars and rhythms of rock. Key artists like Bob Dylan and The Byrds pioneered the sound, electrifying folk standards and introducing more complex lyrical themes. This fusion created a more accessible and energetic platform for social commentary and personal reflection, influencing generations of musicians.",
    historyKo:
      "1960년대 중반에 등장한 포크 록은 포크 음악의 어쿠스틱 악기와 스토리텔링에 록의 일렉트릭 기타와 리듬을 결합했습니다. 밥 딜런과 더 버즈 같은 주요 아티스트들이 포크 스탠더드를 전기화하고 더 복잡한 가사 주제를 소개하며 이 사운드를 개척했습니다. 이러한 융합은 사회 비평과 개인적인 성찰을 위한 더 접근하기 쉽고 에너지 넘치는 플랫폼을 만들었으며, 후대 음악가들에게 영향을 미쳤습니다.",
  },
  "britpop": {
    emoji: "🇬🇧",
    eraEn: "1992 — today",
    eraKo: "1992 — 오늘날",
    originEn: "United Kingdom",
    originKo: "영국",
    historyEn:
      "Emerging in the mid-1990s, Britpop was a reaction against the grunge scene and the perceived dominance of American alternative rock. Spearheaded by bands like Blur and Oasis, it celebrated distinctly British culture, catchy melodies, and guitar-driven anthems. This focus on local identity and accessible songwriting cemented its place as a significant cultural movement.",
    historyKo:
      "1990년대 중반에 등장한 브릿팝은 그런지 씬과 미국 얼터너티브 록의 지배력에 대한 반발이었습니다. 블러, 오아시스와 같은 밴드를 선두로 영국 문화, 귀에 꽂히는 멜로디, 기타 중심의 앤섬을 찬양했습니다. 이러한 지역적 정체성과 쉬운 작곡에 대한 집중은 브릿팝을 중요한 문화 운동으로 자리매김하게 했습니다.",
  },
  "disco": {
    emoji: "🕺",
    eraEn: "1970s — today",
    eraKo: "1970년대 — 현재",
    originEn: "New York City, USA",
    originKo: "미국 뉴욕시",
    historyEn:
      "Disco emerged in the early 1970s from urban nightlife, particularly gay and Black communities in New York City. It exploded in popularity by the mid-70s with hits like Gloria Gaynor's 'I Will Survive,' becoming a global phenomenon. Its sound is characterized by a steady four-on-the-floor beat, syncopated basslines, lush orchestration, and often soaring vocals, designed for dancing.",
    historyKo:
      "디스코는 1970년대 초 뉴욕시의 도시 밤문화, 특히 게이 및 흑인 커뮤니티에서 탄생했습니다. 1970년대 중반 글로리아 게이너의 'I Will Survive'와 같은 히트곡으로 인기가 폭발하며 전 세계적인 현상이 되었습니다. 디스코 사운드는 꾸준한 4/4박자, 싱코페이션된 베이스라인, 풍성한 오케스트레이션, 그리고 종종 솟아오르는 보컬이 특징이며, 춤추기 위해 만들어졌습니다.",
  },
  "heavy metal": {
    emoji: "🤘",
    eraEn: "1970s — today",
    eraKo: "1970년대 — 현재",
    originEn: "United Kingdom",
    originKo: "영국",
    historyEn:
      "Emerging in the late 1960s and early 1970s from blues rock and psychedelic rock, heavy metal is characterized by distorted guitars, emphatic rhythms, and aggressive vocals. Bands like Black Sabbath, Led Zeppelin, and Deep Purple pioneered its foundational sound. Its development saw a diversification into subgenres like thrash, death, and black metal, each pushing the boundaries of speed, intensity, and thematic content, solidifying its enduring, powerful sonic identity.",
    historyKo:
      "1960년대 후반과 1970년대 초반 블루스 록과 사이키델릭 록에서 탄생한 헤비메탈은 디스토션 기타, 강렬한 리듬, 공격적인 보컬이 특징입니다. 블랙 사바스, 레드 제플린, 딥 퍼플과 같은 밴드가 그 기초를 다졌습니다. 이후 스래시, 데스, 블랙 메탈 등 다양한 하위 장르로 발전하며 속도, 강렬함, 주제 콘텐츠의 경계를 넓혔고, 이는 오늘날까지 지속되는 강력한 사운드 정체성을 확립했습니다.",
  },
  "k-indie": {
    emoji: "🎵",
    eraEn: "1990s — today",
    eraKo: "1990년대 — 현재",
    originEn: "South Korea",
    originKo: "대한민국",
    historyEn:
      "K-indie emerged in the late 1990s and early 2000s as a reaction against the dominant mainstream idol music in South Korea. Early pioneers embraced DIY ethics and diverse influences, leading to a sound that today is characterized by its lyrical depth, eclectic instrumentation, and genre-bending experimentation.",
    historyKo:
      "1990년대 후반부터 2000년대 초반, 한국의 주류 아이돌 음악에 대한 반작용으로 K-인디 씬이 태동했습니다. 초기 선구자들은 DIY 정신과 다양한 장르를 포용하며, 오늘날 K-인디의 특징인 서정적인 깊이, 다채로운 악기 편성, 장르를 넘나드는 실험적인 사운드를 구축했습니다.",
  },
  "pop punk": {
    emoji: "🤘",
    eraEn: "1970s — today",
    eraKo: "1970년대 — 현재",
    originEn: "United States",
    originKo: "미국",
    historyEn:
      "Pop punk emerged in the late 1970s and early 1980s, blending the catchy melodies of pop music with the fast tempos and rebellious attitude of punk rock. Bands like Green Day and Blink-182 propelled the genre into mainstream success in the late 1990s and early 2000s, characterized by its upbeat yet often angsty lyrics, driving guitar riffs, and energetic drum beats.",
    historyKo:
      "팝펑크는 1970년대 후반과 1980년대 초반에 팝 음악의 귀에 맴도는 멜로디와 펑크 록의 빠른 템포 및 반항적인 태도를 혼합하며 등장했습니다. 그린 데이, 블링크-182와 같은 밴드들은 1990년대 후반과 2000년대 초반에 이 장르를 주류 성공으로 이끌었으며, 경쾌하면서도 종종 불안한 가사, 파워풀한 기타 리프, 에너지 넘치는 드럼 비트가 특징입니다.",
  },
  "soundtrack": {
    emoji: "🎬",
    eraEn: "1927 — today",
    eraKo: "1927 — 현재",
    originEn: "United States",
    originKo: "미국",
    historyEn:
      "Soundtrack music, also known as film scores, emerged with the advent of synchronized sound in cinema in the late 1920s. Initially, scores were composed to enhance the emotional impact of silent films and later to guide the narrative and atmosphere of 'talkies'. Today, soundtrack music encompasses a vast array of styles, often blending orchestral arrangements with electronic elements to create immersive sonic landscapes that define cinematic experiences.",
    historyKo:
      "영화 음악 또는 필름 스코어라고도 불리는 사운드트랙 음악은 1920년대 후반 동시 녹음 기술의 발달과 함께 등장했습니다. 처음에는 무성 영화의 감정적 효과를 증폭시키기 위해 작곡되었고, 이후 유성 영화의 서사 및 분위기를 이끌어가는 역할을 했습니다. 오늘날 사운드트랙 음악은 오케스트라 편곡과 전자 음악 요소를 혼합하여 영화적 경험을 정의하는 몰입감 있는 사운드 풍경을 만드는 등 매우 다양한 스타일을 포괄합니다.",
  },
  "instrumental": {
    emoji: "🎵",
    eraEn: "Antiquity — today",
    eraKo: "고대 — 오늘날",
    originEn: "Global",
    originKo: "전 세계",
    historyEn:
      "Instrumental music, lacking vocals, has existed for centuries, from classical symphonies to jazz improvisations. The 20th century saw its evolution through film scores and the rise of ambient and electronic music, which further explored texture and atmosphere over traditional song structures. Today, it encompasses a vast array of styles, often prioritizing mood, narrative, or technical prowess.",
    historyKo:
      "보컬이 없는 기악 음악은 수세기 동안 존재해 왔으며, 클래식 교향곡부터 재즈 즉흥 연주까지 다양합니다. 20세기에는 영화 음악과 앰비언트, 전자 음악의 발전과 함께 진화했으며, 이는 전통적인 곡 구조보다 질감과 분위기를 탐구하는 데 중점을 두었습니다. 오늘날 기악 음악은 분위기, 내러티브 또는 기교를 우선시하는 방대한 스타일을 포괄합니다.",
  },
  "contemporary r&b": {
    emoji: "🎤",
    eraEn: "1989 — today",
    eraKo: "1989년 — 현재",
    originEn: "United States",
    originKo: "미국",
    historyEn:
      "Contemporary R&B emerged in the late 1980s and early 1990s, blending traditional R&B with elements of hip hop and soul. A key turning point was the rise of producers like Teddy Riley, who infused R&B with New Jack Swing's energetic beats and synthesizers. This fusion created a smoother, more polished sound with prominent drum machine rhythms and layered vocal harmonies, which continues to influence the genre today.",
    historyKo:
      "컨템포러리 R&B는 1980년대 후반과 1990년대 초반에 전통적인 R&B에 힙합과 소울의 요소를 융합하며 등장했습니다. 테디 라일리와 같은 프로듀서들이 뉴 잭 스윙의 역동적인 비트와 신디사이저를 R&B에 접목시킨 것이 중요한 전환점이었습니다. 이러한 퓨전은 드럼 머신 리듬과 풍부한 보컬 하모니가 돋보이는 더 부드럽고 세련된 사운드를 만들어냈으며, 이는 오늘날까지 장르에 영향을 미치고 있습니다.",
  },
  "ambient": {
    emoji: "☁️",
    eraEn: "1970s — today",
    eraKo: "1970년대 — 현재",
    originEn: "United Kingdom",
    originKo: "영국",
    historyEn:
      "Ambient music emerged in the mid-1970s, pioneered by Brian Eno, who sought to create 'easy listening' music that could be ignored or actively listened to. It developed from minimalist and electronic music, drawing influence from environmental sounds and musique concrète. The genre emphasizes atmosphere, texture, and sonic space over traditional musical structures, creating immersive and often introspective listening experiences.",
    historyKo:
      "앰비언트 음악은 1970년대 중반 브라이언 이노에 의해 개척되었으며, 무시되거나 적극적으로 들을 수 있는 '쉬운 감상' 음악을 만들고자 했습니다. 미니멀리즘과 전자 음악에서 발전했으며, 환경음과 구체 음악의 영향을 받았습니다. 이 장르는 전통적인 음악 구조보다 분위기, 질감, 공간감을 강조하여 몰입감 있고 종종 성찰적인 청취 경험을 만듭니다.",
  },
  "pop": {
    emoji: "🎤",
    eraEn: "1950s — today",
    eraKo: "1950년대 – 오늘",
    originEn: "United States",
    originKo: "미국",
    historyEn:
      "Pop music emerged in the mid-1950s as a derivative of rock and roll, incorporating influences from R&B and country. Its defining characteristic is its accessibility, aiming for widespread appeal with catchy melodies and relatable lyrics. Today, pop continues to evolve, absorbing elements from various genres like electronic dance music, hip-hop, and Latin music, constantly reinventing itself to remain relevant.",
    historyKo:
      "팝 음악은 1950년대 중반 로큰롤에서 파생되어 R&B와 컨트리의 영향을 흡수하며 등장했습니다. 특징은 누구나 쉽게 즐길 수 있는 접근성과 귀에 맴도는 멜로디, 공감 가는 가사입니다. 오늘날 팝은 일렉트로닉 댄스 음악, 힙합, 라틴 음악 등 다양한 장르의 요소를 흡수하며 끊임없이 진화하고 관련성을 유지하고 있습니다.",
  },
  "korean pop": {
    emoji: "🎤",
    eraEn: "1992 — today",
    eraKo: "1992 — 현재",
    originEn: "South Korea",
    originKo: "대한민국",
    historyEn:
      "Emerging in the early 1990s, K-pop, or Korean pop music, rapidly evolved from its roots in traditional Korean music and Western pop influences. The debut of groups like Seo Taiji and Boys in 1992 is often considered a pivotal moment, introducing innovative music styles and performance concepts. Today, K-pop is characterized by its highly polished production, intricate choreography, and a blend of diverse musical genres, making it a global phenomenon.",
    historyKo:
      "1990년대 초반에 등장한 K팝은 한국 전통 음악과 서구 팝의 영향을 받아 빠르게 발전했습니다. 1992년 서태지와 아이들의 데뷔는 혁신적인 음악 스타일과 퍼포먼스 컨셉을 도입하며 중요한 전환점으로 여겨집니다. 오늘날 K팝은 세련된 프로덕션, 복잡한 안무, 다양한 장르의 융합으로 특징지어지며 세계적인 현상이 되었습니다.",
  },
  "electropop": {
    emoji: "🎶",
    eraEn: "1970s — today",
    eraKo: "1970년대 — 현재",
    originEn: "United States / United Kingdom",
    originKo: "미국 / 영국",
    historyEn:
      "Electropop emerged in the late 1970s and early 1980s, evolving from disco and synth-pop. Its key turning point was the widespread adoption of synthesizers and drum machines, making electronic sounds accessible. Today, it's characterized by catchy melodies, prominent electronic instrumentation, and often a danceable beat, blending pop sensibilities with futuristic sonic textures.",
    historyKo:
      "일렉트로팝은 1970년대 후반과 1980년대 초반 디스코와 신스팝에서 진화하여 등장했습니다. 신디사이저와 드럼 머신의 보급으로 전자음악 사운드가 대중화된 것이 주요 전환점이었습니다. 오늘날 일렉트로팝은 중독성 있는 멜로디, 두드러진 전자 악기 연주, 춤추기 좋은 비트가 특징이며, 팝 감성과 미래적인 사운드 질감을 결합합니다.",
  },
  "pop rap": {
    emoji: "🎤",
    eraEn: "1980s — today",
    eraKo: "1980년대 — 현재",
    originEn: "United States",
    originKo: "미국",
    historyEn:
      "Pop rap emerged in the late 1980s as hip-hop began to cross over into the mainstream. Artists started incorporating catchy melodies, R&B hooks, and more accessible lyrical themes, moving away from the more hardcore or socially conscious sounds of earlier hip-hop. This blend of rap's rhythmic delivery with pop's melodic sensibilities became a dominant force, shaping much of the popular music landscape.",
    historyKo:
      "팝 랩은 1980년대 후반 힙합이 주류로 부상하면서 등장했습니다. 아티스트들은 더 캐치한 멜로디, R&B 후렴구, 그리고 더 접근하기 쉬운 가사 테마를 통합하기 시작하며 이전 힙합의 하드코어하거나 사회 의식적인 사운드에서 벗어났습니다. 랩의 리듬감 있는 전달과 팝의 멜로디 감각의 결합은 대중음악 지형의 많은 부분을 형성하며 지배적인 힘이 되었습니다.",
  },
  "arena rock": {
    emoji: "🎤",
    eraEn: "1970s — today",
    eraKo: "1970년대 — 현재",
    originEn: "United States",
    originKo: "미국",
    historyEn:
      "Arena rock emerged in the early 1970s, characterized by bombastic soundscapes and anthemic choruses designed for large venues. Bands like Queen and Journey pioneered this style, using powerful vocals, prominent guitars, and keyboards to create a sound that could fill stadiums. Its enduring appeal lies in its singalong quality and grand, often optimistic, thematic scope.",
    historyKo:
      "아레나 록은 1970년대 초 거대한 공연장을 염두에 둔 웅장한 사운드와 찬가 같은 후렴구로 특징지어지며 등장했습니다. 퀸, 저니와 같은 밴드들은 강력한 보컬, 두드러진 기타, 키보드를 사용하여 스타디움을 채울 수 있는 사운드를 만들어 이 스타일을 개척했습니다. 시대를 초월하는 매력은 따라 부르기 쉬운 특성과 종종 낙관적인 주제의 장대함에 있습니다.",
  },
  "soft rock": {
    // Gemini returned "Soft Rock" (text) instead of an emoji here —
    // hand-fixed to 🎶 on paste so the hero renders correctly.
    emoji: "🎶",
    eraEn: "1960s — today",
    eraKo: "1960년대 — 현재",
    originEn: "United States",
    originKo: "미국",
    historyEn:
      "Soft rock emerged in the mid-1960s as a smoother, more accessible offshoot of rock and roll, influenced by folk and pop. It gained significant traction in the 1970s with artists emphasizing melodic songwriting, lush arrangements, and polished production. This focus on accessibility and emotional resonance continues to define its sound today, often incorporating elements from adult contemporary and pop.",
    historyKo:
      "소프트 록은 1960년대 중반 포크와 팝의 영향을 받아 록앤롤에서 파생된 부드럽고 대중적인 장르로 탄생했습니다. 1970년대에 멜로디 라인, 풍성한 편곡, 세련된 프로덕션에 집중한 아티스트들이 큰 인기를 얻었습니다. 이러한 접근성과 감성적인 울림에 대한 집중은 오늘날까지 이어져 어덜트 컨템포러리와 팝의 요소를 통합하며 소프트 록의 사운드를 정의하고 있습니다.",
  },
  "piano solo": {
    emoji: "🎹",
    eraEn: "1600s — today",
    eraKo: "1600년대 — 현재",
    originEn: "Europe",
    originKo: "유럽",
    historyEn:
      "Piano solo music has a long and rich history, dating back to the Baroque era. It evolved through the Classical and Romantic periods, with composers like Bach, Mozart, and Chopin pushing the boundaries of piano composition. Today, it continues to be a vital genre, encompassing a wide range of styles from classical to contemporary, and celebrated for its emotional depth and technical brilliance.",
    historyKo:
      "피아노 솔로 음악은 바흐, 모차르트, 쇼팽과 같은 작곡가들이 피아노 작곡의 경계를 넓히면서 바로크 시대부터 클래식, 낭만 시대를 거쳐 발전해왔습니다. 오늘날 이 장르는 고전에서 현대에 이르기까지 폭넓은 스타일을 아우르며, 감정의 깊이와 기교적인 탁월함으로 계속해서 중요한 음악 장르로 자리매김하고 있습니다.",
  },
  "boom bap": {
    emoji: "🎤",
    eraEn: "1980s — today",
    eraKo: "1980년대 — 현재",
    originEn: "New York City",
    originKo: "뉴욕 시티",
    historyEn:
      "Boom bap emerged in the late 1980s, largely pioneered by producers like DJ Premier and Pete Rock. Its defining characteristic is its percussive, often sample-heavy production, with a prominent kick drum and snare, creating a 'boom bap' sound. This style became a cornerstone of East Coast hip-hop, known for its gritty beats and lyrical focus.",
    historyKo:
      "붐뱁은 1980년대 후반 DJ 프리미어와 피트 록 같은 프로듀서들이 주도하여 탄생했습니다. 킥 드럼과 스네어의 강렬한 타격감으로 '붐뱁' 사운드를 만들어내는 샘플 중심의 프로덕션이 특징입니다. 이 스타일은 거친 비트와 가사에 집중하는 이스트 코스트 힙합의 초석이 되었습니다.",
  },
  "acoustic pop": {
    emoji: "🎸",
    eraEn: "1990s — today",
    eraKo: "1990년대 — 현재",
    originEn: "United States",
    originKo: "미국",
    historyEn:
      "Acoustic pop emerged as a stripped-down alternative to the heavily produced pop music of the late 20th century. Artists began to embrace simpler arrangements featuring acoustic guitars and pianos, emphasizing vocal melodies and relatable lyrics. This focus on organic instrumentation and heartfelt delivery defines its sound, offering a more intimate and authentic listening experience.",
    historyKo:
      "20세기 후반의 과도하게 프로듀싱된 팝 음악에 대한 간결한 대안으로 어쿠스틱 팝이 등장했습니다. 아티스트들은 어쿠스틱 기타와 피아노를 특징으로 하는 단순한 편곡을 수용하여 보컬 멜로디와 공감할 수 있는 가사를 강조하기 시작했습니다. 이러한 유기적인 악기 연주와 진심 어린 전달에 대한 집중은 어쿠스틱 팝의 사운드를 정의하며, 보다 친밀하고 진정성 있는 청취 경험을 제공합니다.",
  },
};

/** Returns pre-baked content for a genre, normalising the lookup key. */
export function getGenreContent(name: string): GenreContent | null {
  if (!name) return null;
  const key = name.toLowerCase().trim();
  return GENRE_CONTENT[key] ?? null;
}
