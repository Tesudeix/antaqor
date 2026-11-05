import { NextResponse } from "next/server";
import { loadVideoPricing } from "@/lib/videoPricingServer";
import { VIDEO_RESOLUTIONS, VIDEO_MODELS } from "@/lib/videoPricing";

// GET — видео студийн нийтийн үнийн жагсаалт (загвар тутмын секундын
// кредит, дэмжигдэх харьцаа, хугацаа). Нэвтрэх шаардлагагүй: үнэ бол
// маркетинг, нууц биш.
export async function GET() {
  const pricing = await loadVideoPricing();
  return NextResponse.json({
    perSecond: pricing.perSecond,
    models: VIDEO_MODELS.map((m) => ({
      id: m.id,
      label: m.label,
      sub: m.sub,
      supportsImage: m.supportsImage,
      supportsAudio: m.supportsAudio,
      ratios: Object.keys(m.ratios),
      durations: m.durations,
    })),
    resolutions: VIDEO_RESOLUTIONS,
  });
}

export const dynamic = "force-dynamic";
