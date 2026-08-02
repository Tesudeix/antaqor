// PiAPI adapter — Seedance video generation (https://piapi.ai).
// Unified task API: POST /api/v1/task → poll GET /api/v1/task/{id}.
// Video URL on completion: data.output.video

const BASE_URL = "https://api.piapi.ai/api/v1";

function apiKey(): string {
  const k = process.env.PIAPI_KEY;
  if (!k) throw new Error("PIAPI_KEY not configured");
  return k;
}

// SFW tiers only — the /ai feed is public.
export type SeedanceTier = "mini" | "fast" | "pro";
export const SEEDANCE_TASK_TYPES: Record<SeedanceTier, string> = {
  mini: "seedance-2-mini",
  fast: "seedance-2-fast",
  pro: "seedance-2",
};

export interface SeedanceArgs {
  tier: SeedanceTier;
  prompt: string;
  imageUrl?: string; // start frame → first_last_frames mode
  duration: number; // 4-15s
  aspectRatio: "21:9" | "16:9" | "4:3" | "1:1" | "3:4" | "9:16";
  resolution: "480p" | "720p" | "1080p"; // 1080p = pro only
}

export interface PiapiTask {
  task_id: string;
  status: string; // pending | processing | staged | completed | failed (case varies)
  output?: { video?: string } | null;
  error?: { message?: string; raw_message?: string } | null;
}

interface PiapiEnvelope {
  code: number;
  message?: string;
  data?: PiapiTask;
}

export async function createSeedanceTask(args: SeedanceArgs): Promise<PiapiTask> {
  const input: Record<string, unknown> = {
    prompt: args.prompt.slice(0, 4000),
    mode: args.imageUrl ? "first_last_frames" : "text_to_video",
    duration: Math.min(15, Math.max(4, Math.round(args.duration))),
    aspect_ratio: args.aspectRatio,
    resolution: args.tier === "pro" ? args.resolution : (args.resolution === "1080p" ? "720p" : args.resolution),
  };
  if (args.imageUrl) input.image_urls = [args.imageUrl];

  const res = await fetch(`${BASE_URL}/task`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey() },
    body: JSON.stringify({ model: "seedance", task_type: SEEDANCE_TASK_TYPES[args.tier], input }),
  });
  const data = (await res.json()) as PiapiEnvelope;
  if (data.code !== 200 || !data.data?.task_id) {
    throw new Error(data.data?.error?.message || data.message || "PiAPI task үүсгэж чадсангүй");
  }
  return data.data;
}

export async function getPiapiTask(taskId: string): Promise<PiapiTask> {
  const res = await fetch(`${BASE_URL}/task/${taskId}`, { headers: { "x-api-key": apiKey() } });
  const data = (await res.json()) as PiapiEnvelope;
  if (data.code !== 200 || !data.data) throw new Error(data.message || "PiAPI status алдаа");
  return data.data;
}

export function piapiStatus(task: PiapiTask): "processing" | "done" | "failed" {
  const s = (task.status || "").toLowerCase();
  if (s === "completed" || s === "success") return "done";
  if (s === "failed" || s === "cancelled") return "failed";
  return "processing";
}

export function piapiVideoUrl(task: PiapiTask): string {
  return task.output?.video || "";
}
