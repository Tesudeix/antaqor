/* Higgsfield · Seedance 2.5 text-to-video — жишээ / шалгалт (2026-10-13).
   Ажиллуулах:
     ./node_modules/.bin/esbuild scripts/higgsfield-seedance.ts --bundle --platform=node --format=cjs --packages=external --outfile=.hf-run.cjs && node .hf-run.cjs; rm -f .hf-run.cjs
   HF_CREDENTIALS-ийг .env.local-аас уншина (key-id:key-secret). Утгыг ХЭЗЭЭ Ч хэвлэхгүй.
   АНХААР: ажиллуулах бүр төлбөртэй үүсгэлт. */
import { readFileSync } from "node:fs";
import { config, higgsfield } from "@higgsfield/client/v2";

function loadEnv(file: string) {
  try {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* файл алга */
  }
}
loadEnv(".env.local");

if (!process.env.HF_CREDENTIALS) {
  console.error("HF_CREDENTIALS тохируулаагүй байна (.env.local).");
  process.exit(1);
}

config({ credentials: process.env.HF_CREDENTIALS });

async function main() {
  const result = (await higgsfield.subscribe("bytedance/seedance-2.5/text-to-video", {
    input: {
      prompt: "A cinematic scene at sunset",
      duration: 5,
      resolution: "720p",
      aspect_ratio: "16:9",
    },
    withPolling: true,
  })) as unknown as Record<string, unknown>;

  const status = String(result?.status ?? "");
  const video =
    (result?.video as { url?: string } | undefined)?.url ||
    (result?.jobs as { results?: { raw?: { url?: string } } }[] | undefined)?.[0]?.results?.raw?.url;

  if (status === "completed" && video) {
    console.log("COMPLETED");
    console.log("VIDEO_URL", video);
    return;
  }
  // failed / canceled / nsfw (moderated) / бусад — амжилт гэж ХЭЛЭХГҮЙ.
  console.error("NOT_COMPLETED status=" + (status || "unknown"), JSON.stringify(result).slice(0, 600));
  process.exit(2);
}

main().catch((e: unknown) => {
  const err = e as { name?: string; message?: string };
  console.error("ERROR", err?.name || "Error", String(err?.message || e).slice(0, 400));
  process.exit(3);
});
