import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureConnection } from "@/lib/connection";
import { PAYMENTS_ENABLED } from "@/lib/constants";
import { getSql } from "@/lib/db";
import { getCustomerPortalUrl } from "@/lib/lemon";

/** Redirects an existing customer into the Lemon Squeezy hosted portal
 * where they can update card, see invoices, or cancel. */
export async function GET(req: NextRequest) {
  if (!PAYMENTS_ENABLED) {
    return NextResponse.redirect(new URL("/account", req.url));
  }
  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  const { userId } = await ensureConnection();
  const sql = getSql();
  const rows = await sql`
    SELECT ls_customer_id FROM users WHERE id = ${userId}`;
  const customerId = rows[0]?.ls_customer_id as string | undefined;
  if (!customerId) {
    return NextResponse.redirect(new URL("/pricing", req.url));
  }
  try {
    const url = await getCustomerPortalUrl(customerId);
    return NextResponse.redirect(url);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
