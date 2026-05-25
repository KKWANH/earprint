import type { NextRequest } from "next/server";
import { getSql } from "@/lib/db";
import { json } from "@/lib/http";
import {
  type LemonWebhookEvent,
  type LemonWebhookPayload,
  verifyWebhookSignature,
} from "@/lib/lemon";

/**
 * Lemon Squeezy webhook receiver. The user's plan/state is derived solely
 * from these events — we never trust the redirect from checkout.
 *
 * The webhook URL (you'll paste into the LS dashboard):
 *   https://earprint.kwanho.dev/api/lemon/webhook
 *
 * Reliability: we always return 200 once signature passes, so LS doesn't
 * retry. Internal failures get logged but don't bubble to the dashboard.
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const sig = req.headers.get("x-signature");

  const ok = await verifyWebhookSignature(raw, sig);
  if (!ok) return json({ error: "bad signature" }, 401);

  let payload: LemonWebhookPayload;
  try {
    payload = JSON.parse(raw) as LemonWebhookPayload;
  } catch {
    return json({ error: "bad json" }, 400);
  }

  const event = payload.meta.event_name as LemonWebhookEvent;
  const userId = payload.meta.custom_data?.user_id;
  const attrs = payload.data.attributes;
  const customerId = attrs.customer_id ? String(attrs.customer_id) : null;
  const lifetimeVariantId = process.env.LEMON_VARIANT_LIFETIME;

  // Try the custom_data user_id first; fall back to looking up by stored
  // customer_id (set on first order). The fallback covers later events
  // (subscription_updated, subscription_payment_success) that don't carry
  // our custom_data because they're emitted by LS, not from checkout.
  const sql = getSql();
  let resolvedUserId = userId ?? null;
  if (!resolvedUserId && customerId) {
    const rows = await sql`
      SELECT id FROM users WHERE ls_customer_id = ${customerId}`;
    resolvedUserId = (rows[0]?.id as string | undefined) ?? null;
  }
  if (!resolvedUserId) {
    // Unknown user — accept the webhook so LS doesn't retry forever, but log
    // for investigation.
    console.warn("[lemon] webhook for unknown user", { event, customerId });
    return json({ ok: true, ignored: true }, 200);
  }

  // Variant ID lets us tell monthly vs lifetime purchases apart.
  const variantId = String(
    attrs.variant_id ?? attrs.first_order_item?.variant_id ?? "",
  );
  const isLifetimePurchase =
    !!lifetimeVariantId && variantId === lifetimeVariantId;
  const subscriptionId = payload.data.type === "subscriptions"
    ? payload.data.id
    : null;

  switch (event) {
    case "order_created": {
      // One-shot purchase (lifetime) OR initial subscription order. For
      // lifetime we set is_lifetime=true; the subscription path also fires
      // subscription_created which sets plan_until.
      if (isLifetimePurchase) {
        await sql`
          UPDATE users
             SET plan           = 'pro',
                 is_lifetime    = true,
                 ls_customer_id = COALESCE(${customerId}, ls_customer_id),
                 updated_at     = now()
           WHERE id = ${resolvedUserId}`;
      } else if (customerId) {
        await sql`
          UPDATE users
             SET ls_customer_id = ${customerId},
                 updated_at     = now()
           WHERE id = ${resolvedUserId}`;
      }
      break;
    }
    case "subscription_created":
    case "subscription_resumed":
    case "subscription_payment_success":
    case "subscription_updated": {
      const renewsAt = attrs.renews_at ?? attrs.ends_at ?? null;
      await sql`
        UPDATE users
           SET plan               = 'pro',
               plan_until         = ${renewsAt},
               ls_customer_id     = COALESCE(${customerId}, ls_customer_id),
               ls_subscription_id = COALESCE(${subscriptionId}, ls_subscription_id),
               updated_at         = now()
         WHERE id = ${resolvedUserId}`;
      break;
    }
    case "subscription_cancelled": {
      // User cancelled but the sub is still active until ends_at. Keep them
      // on Pro until then; only "expired" actually drops them.
      const endsAt = attrs.ends_at ?? null;
      await sql`
        UPDATE users
           SET plan_until = ${endsAt},
               updated_at = now()
         WHERE id = ${resolvedUserId}`;
      break;
    }
    case "subscription_expired":
    case "subscription_payment_failed": {
      // Lifetime users keep Pro even if a (non-existent) sub fails — but
      // monthly users drop to free immediately on expire.
      await sql`
        UPDATE users
           SET plan       = CASE WHEN is_lifetime THEN 'pro' ELSE 'free' END,
               plan_until = NULL,
               updated_at = now()
         WHERE id = ${resolvedUserId}`;
      break;
    }
    default:
      // Unknown event — accept silently.
      break;
  }

  return json({ ok: true }, 200);
}
