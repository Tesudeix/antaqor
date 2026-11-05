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
  /** Unix seconds. Wire intents live only ~10 минут. */
  expires_at?: number;
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

/* ─── ҮХСЭН INTENT-ИЙН УРХИ (2026-09-08-нд зассан) ────────────────────────
   Wire-ийн payment_intent нь үүссэнээс хойш ЯГ 600 СЕКУНДЫН дараа
   `canceled` болно. Харин `checkout/sessions` нь зөвхөн төлбөр хүлээж
   байгаа intent дээр үүсдэг — үхсэн дээр нь `payment_intent_unexpected_state`
   (HTTP 400) буцаана.

   Идемпотенси түлхүүр нь `pi-<paymentId>` байсан бөгөөд `/api/clan/join` нь
   ижил тариф+дүнтэй pending төлбөрийг ДАХИН АШИГЛАДАГ тул paymentId нь
   хэзээ ч өөрчлөгддөггүй. Үр дүнд нь: 10 минутын дотор QPay-гээ төлж
   амжаагүй хүн ДАХИЖ ХЭЗЭЭ Ч эхлүүлж чадахгүй болно — түлхүүр нь үүрд
   үхсэн intent рүү зааж, товч дарах бүрт `provider_error` буцаана.
   (pm2 log дээр 2026-09-08-нд нэг хэрэглэгч 10 удаа оролдсон нь харагдсан.)

   Засвар: intent-ийг ашиглахаас өмнө төлөвийг нь ШАЛГАНА. Үхсэн бол
   тухайн үхсэн intent-ийн id-аас гаралтай ШИНЭ түлхүүр үүсгэнэ. Түлхүүр нь
   санамсаргүй биш, тодорхойлогдмол тул зэрэг ирсэн хоёр хүсэлт нэг л шинэ
   intent үүсгэнэ (давхар нэхэмжлэх гарахгүй). */

/** Checkout session үүсгэж болох төлвүүд — өөр бүх төлөв нь үхсэнд тооцогдоно. */
const PAYABLE_STATUSES = new Set([
  "requires_payment_method",
  "requires_action",
  "requires_confirmation",
  "processing",
]);

/** Үүнээс бага хугацаа үлдсэн intent-ийг дахин ашиглахгүй — худалдан авагчид
    хормын дотор хүчингүй болох QR өгөх нь өгөөгүйтэй адил. */
const MIN_REMAINING_MS = 90_000;

function intentIsPayable(intent: WireIntent): boolean {
  if (!PAYABLE_STATUSES.has(String(intent.status).toLowerCase())) return false;
  if (
    typeof intent.expires_at === "number" &&
    intent.expires_at * 1000 - Date.now() < MIN_REMAINING_MS
  ) {
    return false;
  }
  return true;
}

async function createIntent(json: unknown, idempotencyKey: string): Promise<WireIntent> {
  try {
    return await wireFetch<WireIntent>("/v1/payment_intents", {
      method: "POST",
      idempotencyKey,
      json,
    });
  } catch (e) {
    /* `idempotency_key_in_use` — ижил түлхүүр ӨӨР агуулгатай (тарифын үнэ
       эсвэл худалдан авагчийн нэр хооронд нь өөрчлөгдсөн). Энэ тохиолдолд
       давхар intent үүсгэх нь эрсдэлгүй: төлөгдөөгүй intent 10 минутын
       дараа өөрөө устдаг, мөнгө хөдлөхгүй. Хүнийг гацаахаас хамаагүй дээр. */
    if (e instanceof Error && e.message.includes("idempotency_key_in_use")) {
      return await wireFetch<WireIntent>("/v1/payment_intents", {
        method: "POST",
        idempotencyKey: `${idempotencyKey}-${randomUUID().slice(0, 8)}`,
        json,
      });
    }
    throw e;
  }
}

/**
 * Create (or reuse) a Wire hosted-checkout for a pending Payment.
 *
 * `existingIntentId`-г дамжуулбал түүнийг эхлээд шалгана: амьд бол дахин
 * ашиглана, төлөгдсөн бол `alreadyPaid`, үхсэн бол шинийг үүсгэнэ.
 */
export async function createWireCheckoutForPayment(opts: {
  paymentId: string;
  amountTugrik: number;
  plan: string;
  userId: string;
  description?: string;
  /** Төлбөр дууссаны дараа буцах хаяг. Өгөөгүй бол WIRE_RETURN_URL. */
  successUrl?: string;
  /** Энэ төлбөрт өмнө үүсгэсэн intent (Payment.wireIntentId). */
  existingIntentId?: string | null;
}): Promise<{ intentId: string; url: string | null; alreadyPaid?: boolean }> {
  const intentBody = {
    amount: opts.amountTugrik, // whole MNT ₮ (hosted page verified)
    currency: "MNT",
    description: opts.description ?? "",
    automatic_operator: true,
    /* ЗӨВХӨН QPAY. Хоосон массив нь "Wire-ийн дэмждэг БҮХ оператор"
       гэсэн утгатай байсан — тэр нь худалдан авагчид сонголтын дэлгэц
       үзүүлж, QPay хүссэн хүнийг нэг илүү алхам хийлгэдэг. Оператор
       бүрийн нэрийг API-аас баталгаажуулсан (2026-09-04): бодит
       гүйлгээнүүд `selected_operator: "qpay"` гэж бичигдсэн байна. */
    allowed_operators: ["qpay"],
    metadata: {
      app: "antaqor",
      paymentId: opts.paymentId,
      plan: opts.plan,
      userId: opts.userId,
    },
  };

  /* Өмнөх intent байвал шинийг үүсгэхийн өмнө түүнийг шалгана. Уншилт
     амжилтгүй болбол (устсан/танигдахгүй id) зүгээр л шинээр эхэлнэ. */
  let candidate: WireIntent | null = null;
  if (opts.existingIntentId) {
    candidate = await wireFetch<WireIntent>(
      `/v1/payment_intents/${opts.existingIntentId}`
    ).catch(() => null);
  }

  let intent: WireIntent | null = null;
  let keySuffix = "";
  /* Хамгийн ихдээ гурван оролдлого: (1) өмнөх intent, (2) идемпотенси нь
     үхсэнийг эргүүлж өгсөн тохиолдол, (3) шинэ түлхүүрээр үүсгэсэн нь. */
  for (let attempt = 0; attempt < 3; attempt++) {
    if (!candidate) {
      candidate = await createIntent(intentBody, `pi-${opts.paymentId}${keySuffix}`);
    }
    if (String(candidate.status).toLowerCase() === "succeeded") {
      /* Аль хэдийн төлөгдсөн. Дахин нэхэмжлэх үүсгэвэл хоёр дахь удаагаа
         төлүүлэх эрсдэлтэй — статусын асуулт нь эрхийг нь өөрөө нээнэ. */
      return { intentId: candidate.id, url: null, alreadyPaid: true };
    }
    if (intentIsPayable(candidate)) {
      intent = candidate;
      break;
    }
    keySuffix = `-r${candidate.id.slice(-10)}`;
    candidate = null;
  }
  if (!intent) throw new Error("wire_error: no_payable_intent");

  const session = await wireFetch<WireSession>("/v1/checkout/sessions", {
    method: "POST",
    idempotencyKey: `sess-${intent.id}-${randomUUID().slice(0, 8)}`,
    json: { payment_intent: intent.id, success_url: opts.successUrl || SUCCESS_URL },
  });
  return { intentId: intent.id, url: session.url ?? null };
}

/** Raw lowercase intent status ("succeeded", "requires_payment_method", …). */
export async function getWireIntentStatus(intentId: string): Promise<string> {
  const intent = await wireFetch<WireIntent>(`/v1/payment_intents/${intentId}`);
  return String(intent.status).toLowerCase();
}
