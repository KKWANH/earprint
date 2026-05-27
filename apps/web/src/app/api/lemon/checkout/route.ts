import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureConnection } from "@/lib/connection";
import { PAYMENTS_ENABLED } from "@/lib/constants";
import { createCheckoutUrl } from "@/lib/lemon";

/**
 * Generates a Lemon Squeezy hosted checkout URL and redirects the user to
 * it. Called from /pricing's "Buy analysis" CTA.
 *
 * Query: ?variant=analysis (default; only SKU currently sold).
 *        ?variant=monthly is supported defensively for when the paused Pro
 *        subscription gets re-enabled — no UI links to it today.
 */
export async function GET(req: NextRequest) {
  if (!PAYMENTS_ENABLED) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Default changed from "monthly" → "analysis" (May 2026) — monthly was
  // paused and the only UI CTA passes `variant=analysis` explicitly, so
  // hitting this endpoint without a param now does what 100% of real
  // callers want.
  const variantParam = new URL(req.url).searchParams.get("variant") ?? "analysis";
  const variantId =
    variantParam === "analysis"
      ? process.env.LEMON_VARIANT_ANALYSIS
      : variantParam === "triple"
        ? process.env.LEMON_VARIANT_TRIPLE
        : variantParam === "monthly"
          ? process.env.LEMON_VARIANT_MONTHLY
          : undefined;
  if (!variantId) {
    return NextResponse.json(
      { error: `unknown or unconfigured variant: ${variantParam}` },
      { status: 400 },
    );
  }

  const { userId } = await ensureConnection();
  const origin = process.env.AUTH_URL ?? new URL(req.url).origin;

  try {
    const url = await createCheckoutUrl({
      variantId,
      email: session.user.email,
      userId,
      redirectUrl: `${origin}/account?upgraded=1`,
    });
    return NextResponse.redirect(url);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
