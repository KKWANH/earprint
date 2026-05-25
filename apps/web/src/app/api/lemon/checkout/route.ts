import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureConnection } from "@/lib/connection";
import { PAYMENTS_ENABLED } from "@/lib/constants";
import { createCheckoutUrl } from "@/lib/lemon";

/**
 * Generates a Lemon Squeezy hosted checkout URL and redirects the user to
 * it. Called from /pricing and /account upgrade buttons.
 *
 * Query: ?variant=monthly|lifetime
 */
export async function GET(req: NextRequest) {
  if (!PAYMENTS_ENABLED) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  const variantParam = new URL(req.url).searchParams.get("variant") ?? "monthly";
  const variantId =
    variantParam === "lifetime"
      ? process.env.LEMON_VARIANT_LIFETIME
      : process.env.LEMON_VARIANT_MONTHLY;
  if (!variantId) {
    return NextResponse.json(
      { error: `LEMON_VARIANT_${variantParam.toUpperCase()} not configured` },
      { status: 500 },
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
