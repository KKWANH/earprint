import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { json } from "@/lib/http";
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
const MAX_IMAGE_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

interface ReportBody {
  title?: string;
  body?: string;
  email?: string;
  imageBase64?: string;
  imageMime?: string;
  imageName?: string;
}

export async function POST(req: NextRequest) {
  let payload: ReportBody;
  try {
    payload = (await req.json()) as ReportBody;
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const title = String(payload.title ?? "").trim().slice(0, MAX_TITLE);
  const body = String(payload.body ?? "").trim().slice(0, MAX_BODY);
  const replyEmail = String(payload.email ?? "").trim().slice(0, MAX_EMAIL);
  if (!title || !body) {
    return json({ error: "title and body required" }, 400);
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
    `Earprint security report\n\n` +
    `Title: ${title}\n` +
    `Reply-to: ${replyEmail || "(not provided)"}\n` +
    `Signed-in as: ${signedInEmail || "(anonymous)"}\n` +
    `User-Agent: ${fromHeader}\n` +
    `Received: ${new Date().toISOString()}\n` +
    `\n----- BODY -----\n${body}\n----- END -----\n`;

  try {
    await sendEmail({
      subject: `[Security] ${title}`,
      text,
      replyTo: replyEmail || undefined,
      attachments: attachment ? [attachment] : undefined,
    });
  } catch (e) {
    return json({ error: `delivery failed: ${String(e)}` }, 502);
  }

  return json({ ok: true }, 200);
}
