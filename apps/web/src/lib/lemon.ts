/**
 * Thin Lemon Squeezy client. We don't pull the official SDK because it
 * depends on Node `crypto` and would balloon the Cloudflare Workers bundle —
 * a couple of fetch() calls and Web Crypto are enough.
 *
 * Env vars expected on Cloudflare:
 *   LEMON_API_KEY            — Bearer token (Settings → API)
 *   LEMON_STORE_ID           — numeric store ID
 *   LEMON_VARIANT_MONTHLY    — Variant ID for the $3 subscription
 *   LEMON_VARIANT_LIFETIME   — Variant ID for the $25 lifetime
 *   LEMON_WEBHOOK_SECRET     — Signing secret you set on the webhook
 */

const API_BASE = "https://api.lemonsqueezy.com/v1";

function apiKey(): string {
  const k = process.env.LEMON_API_KEY;
  if (!k) throw new Error("LEMON_API_KEY not configured");
  return k;
}

interface CheckoutInput {
  variantId: string;
  email: string;
  /** Earprint user ID — round-tripped via custom_data so the webhook can find the user. */
  userId: string;
  /** Where Lemon Squeezy should bounce the user after checkout. */
  redirectUrl: string;
}

interface LemonCheckoutResponse {
  data: {
    id: string;
    attributes: { url: string };
  };
}

/**
 * Creates a hosted checkout URL. The returned URL is what we redirect users
 * to — Lemon Squeezy handles card collection / 3DS / receipts / VAT.
 */
export async function createCheckoutUrl(input: CheckoutInput): Promise<string> {
  const storeId = process.env.LEMON_STORE_ID;
  if (!storeId) throw new Error("LEMON_STORE_ID not configured");

  const body = {
    data: {
      type: "checkouts",
      attributes: {
        checkout_data: {
          email: input.email,
          custom: { user_id: input.userId },
        },
        product_options: {
          // After successful payment LS redirects here; we land on /account
          // so the user immediately sees their new Pro status.
          redirect_url: input.redirectUrl,
          receipt_button_text: "Back to Earprint",
        },
      },
      relationships: {
        store: { data: { type: "stores", id: storeId } },
        variant: { data: { type: "variants", id: input.variantId } },
      },
    },
  };

  const res = await fetch(`${API_BASE}/checkouts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Lemon checkout failed: ${res.status} ${t.slice(0, 200)}`);
  }
  const json = (await res.json()) as LemonCheckoutResponse;
  return json.data.attributes.url;
}

/**
 * Returns the customer portal URL where the user can update card, view
 * invoices and cancel subscriptions.
 */
export async function getCustomerPortalUrl(
  customerId: string,
): Promise<string> {
  const res = await fetch(`${API_BASE}/customers/${customerId}`, {
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      Accept: "application/vnd.api+json",
    },
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Lemon customer fetch failed: ${res.status} ${t.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    data: { attributes: { urls: { customer_portal: string } } };
  };
  return json.data.attributes.urls.customer_portal;
}

/**
 * HMAC-SHA256 signature check for incoming webhooks. Lemon Squeezy sends
 * the signature in `X-Signature`; reject anything that doesn't match.
 */
export async function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
): Promise<boolean> {
  const secret = process.env.LEMON_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(rawBody));
  const expected = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time compare to avoid timing leaks.
  if (expected.length !== signatureHeader.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signatureHeader.charCodeAt(i);
  }
  return diff === 0;
}

/** Shape of the webhook events Earprint cares about. */
export type LemonWebhookEvent =
  | "order_created"
  | "subscription_created"
  | "subscription_updated"
  | "subscription_cancelled"
  | "subscription_expired"
  | "subscription_resumed"
  | "subscription_payment_success"
  | "subscription_payment_failed";

export interface LemonWebhookPayload {
  meta: {
    event_name: LemonWebhookEvent;
    custom_data?: { user_id?: string };
  };
  data: {
    id: string;
    type: string;
    attributes: Record<string, unknown> & {
      status?: string;
      customer_id?: number;
      renews_at?: string | null;
      ends_at?: string | null;
      variant_id?: number;
      user_email?: string;
      first_order_item?: { variant_id?: number };
    };
  };
}
