import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { json, readJsonBody } from "@/lib/http";
import { sendEmail } from "@/lib/email";

/**
 * Submission endpoint for /security. The form body is JSON; an optional
 * screenshot is base64-encoded (small images only — the worker's request
 * size cap rejects anything large). The report is emailed to the project
 * maintainer rather than exposed inline, so no personal address appears
 * on the public security page.
 *
 * Sign-in is not required — security researchers shouldn't have to make
 * an account to report a vulnerability. We do add the signed-in email
 * when available so we can reply.
 */
const MAX_TITLE = 200;
const MAX_BODY = 8_000;
const MAX_EMAIL = 200;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB raw, ~2.7 MB base64
/** Total request body cap. Covers ~2.7 MB base64 image + the text fields.
 *  Anything beyond this is rejected before JSON parse so a 100MB body
 *  can't OOM the isolate. */
const MAX_REPORT_BYTES = 4 * 1024 * 1024;
const MAX_IMAGE_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

type Category = "security" | "billing" | "account" | "bug" | "general";
const CATEGORIES = new Set<Category>([
  "security",
  "billing",
  "account",
  "bug",
  "general",
]);

/** Subject prefix per category — the maintainer's inbox uses these for
 *  filter rules. Refund/billing has a separate prefix so it surfaces
 *  faster than a general inquiry. */
const SUBJECT_PREFIX: Record<Category, string> = {
  security: "[Security]",
  billing: "[Billing]",
  account: "[Account]",
  bug: "[Bug]",
  general: "[Inquiry]",
};

interface ReportBody {
  category?: string;
  title?: string;
  body?: string;
  email?: string;
  imageBase64?: string;
  imageMime?: string;
  imageName?: string;
}

export async function POST(req: NextRequest) {
  const parsed = await readJsonBody<ReportBody>(req, MAX_REPORT_BYTES);
  if (!parsed.ok) return parsed.response;
  const payload = parsed.data;

  const rawCategory = String(payload.category ?? "general");
  const category: Category = CATEGORIES.has(rawCategory as Category)
    ? (rawCategory as Category)
    : "general";
  const title = String(payload.title ?? "").trim().slice(0, MAX_TITLE);
  const body = String(payload.body ?? "").trim().slice(0, MAX_BODY);
  const replyEmail = String(payload.email ?? "").trim().slice(0, MAX_EMAIL);
  if (!title || !body) {
    return json({ error: "title and body required" }, 400);
  }

  // Billing / account messages can't be actioned without an address — bail
  // early so the user gets a clear error rather than us silently dropping it.
  if ((category === "billing" || category === "account") && !replyEmail) {
    return json({ error: "email required for this category" }, 400);
  }

  // Cheap email validity check — not strict, just rules out obvious typos.
  if (replyEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyEmail)) {
    return json({ error: "invalid email" }, 400);
  }

  // Optional image attachment validation.
  let attachment:
    | { filename: string; content: string; contentType: string }
    | undefined;
  if (payload.imageBase64 && payload.imageMime) {
    if (!MAX_IMAGE_MIME.has(payload.imageMime)) {
      return json({ error: "unsupported image type" }, 400);
    }
    // base64 length × 3/4 ≈ raw byte length.
    const rawBytes = Math.floor((payload.imageBase64.length * 3) / 4);
    if (rawBytes > MAX_IMAGE_BYTES) {
      return json({ error: "image too large (max 2MB)" }, 413);
    }
    attachment = {
      filename: String(payload.imageName ?? "screenshot").slice(0, 80),
      content: payload.imageBase64,
      contentType: payload.imageMime,
    };
  }

  const session = await auth();
  const signedInEmail = session?.user?.email ?? null;
  const fromHeader = req.headers.get("user-agent") ?? "unknown";

  // Plain-text email body so it renders fine in any mail client.
  const text =
    `Earprint inbound message\n\n` +
    `Category: ${category}\n` +
    `Title: ${title}\n` +
    `Reply-to: ${replyEmail || "(not provided)"}\n` +
    `Signed-in as: ${signedInEmail || "(anonymous)"}\n` +
    `User-Agent: ${fromHeader}\n` +
    `Received: ${new Date().toISOString()}\n` +
    `\n----- BODY -----\n${body}\n----- END -----\n`;

  try {
    await sendEmail({
      subject: `${SUBJECT_PREFIX[category]} ${title}`,
      text,
      replyTo: replyEmail || undefined,
      attachments: attachment ? [attachment] : undefined,
    });
  } catch (e) {
    return json({ error: `delivery failed: ${String(e)}` }, 502);
  }

  return json({ ok: true }, 200);
}
