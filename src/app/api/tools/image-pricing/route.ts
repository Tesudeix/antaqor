import { NextResponse } from "next/server";
import { loadImagePricing } from "@/lib/imagePricingServer";
import { IMAGE_MODELS } from "@/lib/imagePricing";

// GET — public price list for the image studio (credits per model, HD
// multiplier, like→credit ratio). No auth: prices are marketing, not secrets.
export async function GET() {
  const pricing = await loadImagePricing();
  return NextResponse.json({
    ...pricing,
    // 2026-10-13: студи зөвхөн Nano Banana 2.1 + ChatGPT Image-ийг санал болгоно.
    models: IMAGE_MODELS.filter((m) => m.id === "nano2" || m.id === "gpt").map((m) => ({ id: m.id, label: m.label, sub: m.sub, provider: m.provider })),
  });
}

export const dynamic = "force-dynamic";
