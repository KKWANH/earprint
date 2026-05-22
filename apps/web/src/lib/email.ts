import type { LibraryStats } from "./library";

/**
 * Transactional email via Resend (https://resend.com/docs/api-reference).
 * No-op when RESEND_API_KEY is unset, so the app runs fine without it.
 *
 * Set in apps/web with:  wrangler secret put RESEND_API_KEY
 * With no verified domain, Resend only allows from=onboarding@resend.dev and
 * delivery to the account owner's address — which is exactly our use case.
 */
const RESEND_ENDPOINT = "https://api.resend.com/emails";
const FROM = "Earprint <onboarding@resend.dev>";
// Replies to report emails land in a real inbox the owner monitors.
const REPLY_TO = "kwanho0096@gmail.com";
const APP_URL = "https://earprint.kwanho.dev";

interface SendArgs {
  to: string;
  subject: string;
  html: string;
}

/**
 * Result of a send attempt:
 *  - "sent"    delivered to Resend
 *  - "skipped" RESEND_API_KEY not configured (don't retry)
 *  - "failed"  transient error (safe to retry)
 */
export type SendResult = "sent" | "skipped" | "failed";

/** Sends one email. Never throws. */
export async function sendEmail({ to, subject, html }: SendArgs): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return "skipped";

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ from: FROM, to, subject, html, reply_to: REPLY_TO }),
      signal: AbortSignal.timeout(15000),
    });
    return res.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** A compact chip row for a list of {name,count}. */
function chips(items: { name: string; count: number }[], limit: number): string {
  return items
    .slice(0, limit)
    .map(
      (i) =>
        `<span style="display:inline-block;background:#1f1f23;color:#e5e5e5;border-radius:9999px;padding:5px 12px;margin:3px 4px 3px 0;font-size:13px;">${esc(
          i.name,
        )} <span style="color:#888;">${i.count}</span></span>`,
    )
    .join("");
}

/**
 * Builds the "analysis complete" report email — a snapshot of the user's
 * taste profile that stands on its own without opening the app.
 */
export function buildCompletionEmail(stats: LibraryStats): { subject: string; html: string } {
  const feel = stats.audioFeel;
  const pct = (n: number) => Math.round(n * 100);

  const feelBlock = feel
    ? `<table role="presentation" width="100%" style="margin:8px 0;border-collapse:collapse;">
        ${[
          ["에너지", pct(feel.energy)],
          ["템포", pct(feel.tempo)],
          ["어쿠스틱", pct(feel.acousticness)],
        ]
          .map(
            ([label, v]) => `<tr>
              <td style="color:#aaa;font-size:13px;padding:4px 0;width:80px;">${label}</td>
              <td style="padding:4px 0;">
                <div style="background:#1f1f23;border-radius:9999px;height:8px;width:100%;">
                  <div style="background:#34d399;border-radius:9999px;height:8px;width:${v}%;"></div>
                </div>
              </td>
              <td style="color:#e5e5e5;font-size:13px;padding:4px 0 4px 10px;width:38px;text-align:right;">${v}</td>
            </tr>`,
          )
          .join("")}
      </table>`
    : "";

  const html = `<!doctype html>
<html><body style="margin:0;background:#0a0a0b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" style="background:#0a0a0b;padding:32px 0;">
    <tr><td align="center">
      <table role="presentation" width="560" style="max-width:560px;background:#121214;border-radius:16px;overflow:hidden;">
        <tr><td style="padding:32px 32px 8px;">
          <p style="margin:0;color:#34d399;font-size:13px;font-weight:600;letter-spacing:0.04em;">PLAYLIST ANALYZER</p>
          <h1 style="margin:8px 0 4px;color:#fff;font-size:22px;">취향 분석이 완료됐어요 ✨</h1>
          <p style="margin:0;color:#999;font-size:14px;line-height:1.6;">
            좋아요한 곡 ${stats.total.toLocaleString()}곡, 아티스트 ${stats.distinctArtists.toLocaleString()}명을
            모두 분석했습니다. 아래는 요약이에요.
          </p>
        </td></tr>

        <tr><td style="padding:16px 32px 0;">
          <p style="margin:0 0 6px;color:#fff;font-size:15px;font-weight:600;">🎤 자주 듣는 아티스트</p>
          <div>${chips(stats.topArtists, 8)}</div>
        </td></tr>

        <tr><td style="padding:16px 32px 0;">
          <p style="margin:0 0 6px;color:#fff;font-size:15px;font-weight:600;">🎵 핵심 장르</p>
          <div>${chips(stats.topGenres, 8)}</div>
        </td></tr>

        <tr><td style="padding:16px 32px 0;">
          <p style="margin:0 0 6px;color:#fff;font-size:15px;font-weight:600;">🌙 무드</p>
          <div>${chips(stats.topMoods, 8)}</div>
        </td></tr>

        ${
          feelBlock
            ? `<tr><td style="padding:16px 32px 0;">
                 <p style="margin:0 0 2px;color:#fff;font-size:15px;font-weight:600;">🔊 오디오 특성</p>
                 ${feelBlock}
               </td></tr>`
            : ""
        }

        <tr><td style="padding:24px 32px 32px;">
          <a href="${APP_URL}/profile" style="display:inline-block;background:#34d399;color:#0a0a0b;font-weight:700;font-size:15px;text-decoration:none;padding:13px 26px;border-radius:10px;">
            전체 심리 분석 보기 →
          </a>
          <p style="margin:16px 0 0;color:#666;font-size:12px;">
            Earprint · <a href="${APP_URL}" style="color:#888;">earprint.kwanho.dev</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return { subject: `🎧 취향 분석 완료 — ${stats.total.toLocaleString()}곡 분석됨`, html };
}
