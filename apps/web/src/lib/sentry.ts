/**
 * Minimal Sentry capture for Cloudflare Workers — no SDK dependency.
 *
 * `@sentry/cloudflare` works, but the bundle cost and OpenNext-specific
 * worker-wrapping integration aren't worth it for a service that's mostly
 * "catch and log" right now. This helper does the smallest correct thing:
 * parses SENTRY_DSN, builds a Sentry event envelope, and POSTs it via
 * the Workers fetch. ~50 lines, no install.
 *
 * Opt-in via `SENTRY_DSN` env var. When unset every call is a no-op so
 * production code can litter capture sites freely.
 *
 * When we eventually want performance traces, swap to `@sentry/cloudflare`
 * — the call sites (`captureError`) won't change.
 */

interface ParsedDsn {
  endpoint: string;
  publicKey: string;
  projectId: string;
}

let _parsed: ParsedDsn | null | undefined; // undefined = not yet parsed

function parseDsn(): ParsedDsn | null {
  if (_parsed !== undefined) return _parsed;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    _parsed = null;
    return null;
  }
  try {
    // DSN form: https://<publicKey>@<host>/<projectId>
    const u = new URL(dsn);
    const publicKey = u.username;
    const projectId = u.pathname.replace(/^\/+/, "");
    if (!publicKey || !projectId) {
      _parsed = null;
      return null;
    }
    const endpoint = `${u.protocol}//${u.host}/api/${projectId}/envelope/`;
    _parsed = { endpoint, publicKey, projectId };
    return _parsed;
  } catch {
    _parsed = null;
    return null;
  }
}

/** Capture an exception. Fire-and-forget — never throws, never blocks.
 *
 *  `severity: "critical"` also routes a short message to ALERT_WEBHOOK_URL
 *  (Slack or Discord — both accept POSTs with a JSON body that has a
 *  `content` / `text` field). Use sparingly; webhook receivers don't
 *  thank you for one-per-minute noise. */
export function captureError(
  err: unknown,
  ctx?: {
    tag?: string;
    extra?: Record<string, unknown>;
    severity?: "error" | "critical";
  },
): void {
  const dsn = parseDsn();
  if (dsn) {
    const event = {
      event_id: crypto.randomUUID().replace(/-/g, ""),
      timestamp: Date.now() / 1000,
      platform: "javascript",
      level: ctx?.severity === "critical" ? "fatal" : "error",
      // Explicit SENTRY_ENVIRONMENT wins; otherwise fall back to a
      // strict AUTH_URL equality check. `.includes()` would misroute
      // any future staging subdomain (stage.earprint.kwanho.dev) into
      // the production bucket — strict eq sidesteps that.
      environment:
        process.env.SENTRY_ENVIRONMENT ??
        (process.env.AUTH_URL === "https://earprint.kwanho.dev"
          ? "production"
          : "development"),
      tags: ctx?.tag ? { source: ctx.tag } : undefined,
      extra: ctx?.extra,
      exception: {
        values: [
          {
            type: err instanceof Error ? err.name : "Error",
            value: err instanceof Error ? err.message : String(err),
            stacktrace:
              err instanceof Error && err.stack
                ? { frames: parseStack(err.stack) }
                : undefined,
          },
        ],
      },
    };
    const envelope =
      JSON.stringify({ event_id: event.event_id, sent_at: new Date().toISOString() }) +
      "\n" +
      JSON.stringify({ type: "event" }) +
      "\n" +
      JSON.stringify(event) +
      "\n";
    void fetch(dsn.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-sentry-envelope",
        "X-Sentry-Auth": `Sentry sentry_version=7,sentry_key=${dsn.publicKey}`,
      },
      body: envelope,
    }).catch(() => {
      /* swallow — capture is best-effort */
    });
  }
  if (ctx?.severity === "critical") {
    const msg = err instanceof Error ? err.message : String(err);
    sendAlert(`🚨 ${ctx.tag ?? "earprint"} — ${msg.slice(0, 200)}`, ctx.tag);
  }
}

/** Post a short message to a Slack/Discord webhook, chosen by tag.
 *
 *  Routing config lives in env var `ALERT_WEBHOOK_ROUTES` as JSON:
 *      { "analyzer.": "https://discord.com/.../engineering",
 *        "payments":  "https://discord.com/.../ops",
 *        "*":         "https://discord.com/.../general" }
 *  Keys are tag prefixes (matched left-anchored); "*" is the catch-all
 *  default. Both Slack and Discord accept a JSON body with `content`
 *  (Discord) and `text` (Slack), so we set both and let the receiver
 *  use whichever it recognises.
 *
 *  Legacy `ALERT_WEBHOOK_URL` (single URL) is still honoured as the
 *  catch-all default if `ALERT_WEBHOOK_ROUTES` isn't set. No-op when
 *  neither env is configured. */
export function sendAlert(message: string, tag?: string): void {
  const url = resolveWebhook(tag);
  if (!url) return;
  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: message, text: message }),
  }).catch(() => {
    /* swallow — alerts are best-effort */
  });
}

let _routes: Array<{ prefix: string; url: string }> | null | undefined;

function resolveWebhook(tag: string | undefined): string | null {
  if (_routes === undefined) _routes = parseRoutes();
  if (_routes && _routes.length > 0) {
    const t = tag ?? "";
    // Match by longest prefix first so "analyzer.upload" beats "analyzer."
    // even when both are configured. "*" matches everything (last resort).
    for (const r of _routes) {
      if (r.prefix === "*") continue;
      if (t.startsWith(r.prefix)) return r.url;
    }
    const star = _routes.find((r) => r.prefix === "*");
    if (star) return star.url;
  }
  return process.env.ALERT_WEBHOOK_URL ?? null;
}

function parseRoutes(): Array<{ prefix: string; url: string }> | null {
  const raw = process.env.ALERT_WEBHOOK_ROUTES;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return Object.entries(parsed)
      .map(([prefix, url]) => ({ prefix, url }))
      .sort((a, b) => b.prefix.length - a.prefix.length);
  } catch {
    return null;
  }
}

/** Best-effort parser for V8/JS stack traces into Sentry's frame shape. */
function parseStack(stack: string): Array<{
  filename: string;
  function: string;
  lineno: number;
  colno: number;
}> {
  const out: ReturnType<typeof parseStack> = [];
  for (const line of stack.split("\n")) {
    const m = line.match(/at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?$/);
    if (!m) continue;
    out.push({
      function: m[1] ?? "<anonymous>",
      filename: m[2]!,
      lineno: Number(m[3]),
      colno: Number(m[4]),
    });
  }
  // Sentry expects oldest frame first.
  return out.reverse();
}
