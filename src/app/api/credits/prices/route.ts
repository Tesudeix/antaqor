import { NextResponse } from "next/server";
import { hfCost } from "@/lib/hfMedia";
import { creditsFor } from "@/lib/creditEconomics";
import { getEcon } from "@/lib/creditEconomicsServer";

/* AI Studio-ийн нэг үйлдлийн кредит үнэ (1 кр = 1₮) — /credits/buy, сануулга.
   Сервертэй ЯГ ижил томьёо: ceil10(Higgsfield өртөг$ × ханш × markup). */
export const dynamic = "force-dynamic";

export async function GET() {
  const e = await getEcon();
  const c = (usd: number) => creditsFor(usd, e);
  const items: { label: string; credits: number; kind: "image" | "video" | "twin" }[] = [
    { label: "AI зураг · Z-Image Turbo", credits: c(hfCost("zimage", { res: "1k", dur: 0 })), kind: "image" },
    { label: "AI зураг · GPT Image 2 · Сайн", credits: c(hfCost("gpt2", { res: "1k", dur: 0, q: "medium" })), kind: "image" },
    { label: "AI зураг · GPT Image 2 · Хурдан", credits: c(hfCost("gpt2", { res: "1k", dur: 0, q: "low" })), kind: "image" },
    { label: "AI зураг · GPT Image 2.5 · Сайн", credits: c(hfCost("gpt25", { res: "1k", dur: 0, q: "medium" })), kind: "image" },
    { label: "AI ихэр · нэг sheet", credits: c(hfCost("flare", { res: "medium", dur: 0 })), kind: "twin" },
    { label: "AI видео · Wan 3.0 · 5с · 720p", credits: c(hfCost("wan3", { res: "720p", dur: 5 })), kind: "video" },
    { label: "AI видео · Kling 4.0 · 5с · 720p", credits: c(hfCost("kling4", { res: "720p", dur: 5 })), kind: "video" },
    { label: "AI видео · Kling 4.0 · 5с · 1080p", credits: c(hfCost("kling4", { res: "1080p", dur: 5 })), kind: "video" },
  ];
  return NextResponse.json(
    { items, image: items[1].credits, video: items[6].credits, lowAt: e.lowAt },
    { headers: { "Cache-Control": "public, s-maxage=300" } }
  );
}
