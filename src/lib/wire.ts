import { randomUUID } from "crypto";

/**
 * Wire (api.wire.mn) — live Mongolian payment gateway, used on /pricing for
 * instant plan payments. Amounts are MNT MINOR UNITS: 2,900₮ → 290000.
 * All POSTs (including cancel) require an Idempotency-Key header.
 */

const BASE_URL = process.env.WIRE_API_URL || "https://api.wire.mn";
const SUCCESS_URL = process.env.WIRE_RETURN_URL || "https://antaqor.com/pricing?wire=1";

export function wireEnabled(): boolean {
  return Boolean(process.env.WIRE_API_KEY);
}

interface WireIntent {
  id: string;
  status: string;
}

interface WireSession {
  id: string;
  url?: string;
}

interface WireErrorBody {
  error?: { code?: string; message?: string };
}

async function wireFetch<T>(
  path: string,
  init?: { method?: string; json?: unknown; idempotencyKey?: string }
): Promise<T> {
  const key = process.env.WIRE_API_KEY;
  if (!key) throw new Error("wire_not_configured");
  const headers: Record<string, string> = { Authorization: `Bearer ${key}` };
  if (init?.idempotencyKey) headers["Idempotency-Key"] = init.idempotencyKey;
  let body: string | undefined;
  if (init?.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(init.json);
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method: init?.method ?? "GET",
    headers,
    body,
    signal: AbortSignal.timeout(20_000),
  });
  const parsed = (await res.json().catch(() => ({}))) as T & WireErrorBody;
  if (!res.ok) {
    throw new Error(
      `wire_error: ${parsed?.error?.code || parsed?.error?.message || res.status}`
    );
  }
  return parsed;
}

/**
 * Create (or idempotently reuse) a Wire hosted-checkout for a pending Payment.
 * Idempotency keys are derived from the payment id, so retries never create
 * duplicate intents.
 */
export async function createWireCheckoutForPayment(opts: {
  paymentId: string;
  amountTugrik: number;
  plan: string;
  userId: string;
  description?: string;
}): Promise<{ intentId: string; url: string | null }> {
  const intent = await wireFetch<WireIntent>("/v1/payment_intents", {
    method: "POST",
    idempotencyKey: `pi-${opts.paymentId}`,
    json: {
      amount: opts.amountTugrik, // whole MNT ₮ (hosted page verified)
      currency: "MNT",
      description: opts.description ?? "",
      automatic_operator: true,
      allowed_operators: [],
      metadata: {
        app: "antaqor",
        paymentId: opts.paymentId,
        plan: opts.plan,
        userId: opts.userId,
      },
    },
  });
  const session = await wireFetch<WireSession>("/v1/checkout/sessions", {
    method: "POST",
    idempotencyKey: `sess-${intent.id}-${randomUUID().slice(0, 8)}`,
    json: { payment_intent: intent.id, success_url: SUCCESS_URL },
  });
  return { intentId: intent.id, url: session.url ?? null };
}

/** Raw lowercase intent status ("succeeded", "requires_payment_method", …). */
export async function getWireIntentStatus(intentId: string): Promise<string> {
  const intent = await wireFetch<WireIntent>(`/v1/payment_intents/${intentId}`);
  return String(intent.status).toLowerCase();
}
