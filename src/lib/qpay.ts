const QPAY_BASE_URL = process.env.QPAY_BASE_URL || "https://merchant.qpay.mn";
const QPAY_USERNAME = process.env.QPAY_USERNAME!;
const QPAY_PASSWORD = process.env.QPAY_PASSWORD!;
const QPAY_INVOICE_CODE = process.env.QPAY_INVOICE_CODE!;

interface QPayTokenResponse {
  token_type: string;
  refresh_expires_in: number;
  refresh_token: string;
  access_token: string;
  expires_in: number;
}

interface QPayInvoiceResponse {
  invoice_id: string;
  qr_text: string;
  qr_image: string;
  qPay_shortUrl: string;
  urls: Array<{
    name: string;
    description: string;
    logo: string;
    link: string;
  }>;
}

interface QPayPaymentCheckResponse {
  count: number;
  paid_amount: number;
  rows: Array<{
    payment_id: string;
    payment_status: string;
    payment_amount: number;
  }>;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const res = await fetch(`${QPAY_BASE_URL}/v2/auth/token`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${QPAY_USERNAME}:${QPAY_PASSWORD}`).toString("base64"),
    },
  });

  if (!res.ok) {
    throw new Error(`QPay auth failed: ${res.status}`);
  }

  const data: QPayTokenResponse = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };

  return data.access_token;
}

export async function createInvoice(params: {
  invoiceDescription: string;
  senderCode: string;
  amount: number;
  callbackUrl: string;
}): Promise<QPayInvoiceResponse> {
  const token = await getAccessToken();

  const res = await fetch(`${QPAY_BASE_URL}/v2/invoice`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      invoice_code: QPAY_INVOICE_CODE,
      sender_invoice_no: params.senderCode,
      invoice_receiver_code: "terminal",
      invoice_description: params.invoiceDescription,
      amount: params.amount,
      callback_url: params.callbackUrl,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`QPay invoice creation failed: ${err}`);
  }

  return res.json();
}

export async function checkPayment(invoiceId: string): Promise<QPayPaymentCheckResponse> {
  const token = await getAccessToken();

  const res = await fetch(`${QPAY_BASE_URL}/v2/payment/check`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      object_type: "INVOICE",
      object_id: invoiceId,
    }),
  });

  if (!res.ok) {
    throw new Error(`QPay payment check failed: ${res.status}`);
  }

  return res.json();
}
