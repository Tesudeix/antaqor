import { createHmac } from "crypto";

const BASE_URL = process.env.KLING_BASE_URL || "https://api-singapore.klingai.com";

function base64url(input: Buffer | string): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function signJWT(): string {
  const ak = process.env.KLING_ACCESS_KEY;
  const sk = process.env.KLING_SECRET_KEY;
  if (!ak || !sk) {
    throw new Error("KLING_ACCESS_KEY / KLING_SECRET_KEY not configured");
  }
  const now = Math.floor(Date.now() / 1000);
  const headerB64 = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payloadB64 = base64url(JSON.stringify({ iss: ak, exp: now + 1800, nbf: now - 5 }));
  const data = `${headerB64}.${payloadB64}`;
  const sig = base64url(createHmac("sha256", sk).update(data).digest());
  return `${data}.${sig}`;
}

export interface Image2VideoArgs {
  imageUrl: string;
  prompt: string;
  negativePrompt?: string;
  duration: "5" | "10";
  mode: "std" | "pro";
  aspectRatio: "16:9" | "9:16" | "1:1";
  cfgScale?: number;
  modelName?: string;
}

export interface KlingResponse<T = unknown> {
  code: number;
  message: string;
  request_id?: string;
  data?: T;
}

export interface KlingTask {
  task_id: string;
  task_status: "submitted" | "processing" | "succeed" | "failed";
  task_status_msg?: string;
  task_result?: {
    videos?: { id: string; url: string; duration?: string }[];
  };
  created_at?: number;
  updated_at?: number;
}

export async function startImage2Video(args: Image2VideoArgs): Promise<KlingResponse<KlingTask>> {
  const token = signJWT();
  const body = {
    model_name: args.modelName || "kling-v1-6",
    image: args.imageUrl,
    prompt: args.prompt,
    negative_prompt: args.negativePrompt || "",
    cfg_scale: args.cfgScale ?? 0.5,
    mode: args.mode,
    duration: args.duration,
    aspect_ratio: args.aspectRatio,
  };
  const res = await fetch(`${BASE_URL}/v1/videos/image2video`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  return (await res.json()) as KlingResponse<KlingTask>;
}

export async function getImage2VideoStatus(taskId: string): Promise<KlingResponse<KlingTask>> {
  const token = signJWT();
  const res = await fetch(`${BASE_URL}/v1/videos/image2video/${taskId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return (await res.json()) as KlingResponse<KlingTask>;
}

// ── Text-to-video (no source image) ──
export interface Text2VideoArgs {
  prompt: string;
  negativePrompt?: string;
  duration: "5" | "10";
  mode: "std" | "pro";
  aspectRatio: "16:9" | "9:16" | "1:1";
  cfgScale?: number;
  modelName?: string;
}

export async function startText2Video(args: Text2VideoArgs): Promise<KlingResponse<KlingTask>> {
  const token = signJWT();
  const body = {
    model_name: args.modelName || "kling-v1-6",
    prompt: args.prompt,
    negative_prompt: args.negativePrompt || "",
    cfg_scale: args.cfgScale ?? 0.5,
    mode: args.mode,
    duration: args.duration,
    aspect_ratio: args.aspectRatio,
  };
  const res = await fetch(`${BASE_URL}/v1/videos/text2video`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return (await res.json()) as KlingResponse<KlingTask>;
}

export async function getText2VideoStatus(taskId: string): Promise<KlingResponse<KlingTask>> {
  const token = signJWT();
  const res = await fetch(`${BASE_URL}/v1/videos/text2video/${taskId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return (await res.json()) as KlingResponse<KlingTask>;
}
