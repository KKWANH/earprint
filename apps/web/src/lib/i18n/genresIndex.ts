import type { Locale } from "../i18n";

const en = {
  loginGoogle: "Sign in with Google",
  back: "← Library",
  pageTitle: "All genres",
  subtitle: (n: number) => `${n} genres tagged across your library`,
  empty: "Run a library analysis to fill in genres.",
};

const ko: typeof en = {
  loginGoogle: "Google 로 로그인",
  back: "← 라이브러리",
  pageTitle: "전체 장르",
  subtitle: (n: number) => `라이브러리에 태그된 ${n}개 장르`,
  empty: "라이브러리 분석을 돌리면 장르가 채워집니다.",
};

export function genresIndexDict(locale: Locale) {
  return locale === "ko" ? ko : en;
}
