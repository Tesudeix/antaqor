import dbConnect from "@/lib/mongodb";
import AiBudget from "@/models/AiBudget";
import AiImage from "@/models/AiImage";
import AiVideo from "@/models/AiVideo";
import { AgentMedia } from "@/models/AgentStudio";
import { flatUsd } from "@/lib/imagePricing";
import { videoProviderUsd } from "@/lib/videoPricing";

/* ─── AI provider-ийн үлдэгдэл ба хязгаар (2026-10-18) ────────────────────
   үлдэгдэл = Σ цэнэглэлт − (анхны цэнэглэлтээс хойшхи бодит зарцуулалт)
   хязгаар  = үлдэгдэл / нэг зургийн(видеоны) дундаж өртөг
   төлөв    = тухайн provider-ийн хамгийн сүүлийн оролдлого: амжилттай эсвэл
              төлбөрийн алдаа ("depleted", "quota", "billing", "insufficient"). */

type P = "openai" | "gemini" | "higgsfield";
const BILLING = /depleted|quota|billing|insufficient|credit balance|exceeded your current|payment/i;
const LABEL: Record<P, string> = { openai: "OpenAI · ChatGPT Image", gemini: "Google · Nano Banana", higgsfield: "Higgsfield · AI видео" };
const HOME: Record<P, string> = { openai: "https://platform.openai.com/settings/organization/billing", gemini: "https://aistudio.google.com/projects", higgsfield: "https://cloud.higgsfield.ai" };

function vidUsd(v: { duration?: number; ratio?: string }) {
  return videoProviderUsd(v.duration || 5, "720p", v.ratio && v.ratio !== "adaptive" ? v.ratio : "16:9");
}

export async function budget() {
  await dbConnect();
  const docs = await AiBudget.find({}).lean();
  const out = [];
  for (const p of ["gemini", "openai", "higgsfield"] as P[]) {
    const d = docs.find((x) => x.provider === p);
    const topups = (d?.topups || []).map((t) => ({ usd: t.usd, note: t.note, at: t.at }));
    const total = topups.reduce((a, t) => a + (t.usd || 0), 0);
    const since = topups.length ? new Date(Math.min(...topups.map((t) => +new Date(t.at)))) : null;

    let spent = 0, lastOk: Date | null = null, lastErr: { at: Date; msg: string } | null = null;
    let units: { label: string; usd: number }[] = [];
    if (p === "higgsfield") {
      const done = await AiVideo.find({ status: "done", ...(since ? { createdAt: { $gte: since } } : {}) }).select("duration ratio createdAt").lean();
      spent = done.reduce((a, v) => a + vidUsd(v), 0);
      /* Antaqor Agent-ийн медиа (зураг/видео/Genjutsu) — ижил Higgsfield данс */
      const ag = await AgentMedia.aggregate([{ $match: { status: "done", ...(since ? { createdAt: { $gte: since } } : {}) } }, { $group: { _id: null, usd: { $sum: "$usd" } } }]);
      spent += ag[0]?.usd || 0;
      const ok = await AiVideo.findOne({ status: "done" }).sort({ createdAt: -1 }).select("createdAt").lean();
      const bad = await AiVideo.findOne({ status: "failed" }).sort({ createdAt: -1 }).select("createdAt error").lean();
      lastOk = ok?.createdAt || null; if (bad) lastErr = { at: bad.createdAt, msg: bad.error || "" };
      units = [5, 10].map((s) => ({ label: `${s}с видео (720p)`, usd: videoProviderUsd(s, "720p", "16:9") }));
    } else {
      const agg = await AiImage.aggregate([{ $match: { provider: p, status: "done", ...(since ? { createdAt: { $gte: since } } : {}) } }, { $group: { _id: null, usd: { $sum: "$usd" } } }]);
      spent = agg[0]?.usd || 0;
      const ok = await AiImage.findOne({ provider: p, status: "done" }).sort({ createdAt: -1 }).select("createdAt").lean();
      const bad = await AiImage.findOne({ provider: p, status: "failed" }).sort({ createdAt: -1 }).select("createdAt error").lean();
      lastOk = ok?.createdAt || null; if (bad) lastErr = { at: bad.createdAt, msg: bad.error || "" };
      if (p === "openai") units = [{ label: "ChatGPT Image · энгийн", usd: flatUsd("gpt", false).usd }, { label: "ChatGPT Image · HD", usd: flatUsd("gpt", true).usd }];
      else {
        /* Nano Banana-гийн бодит дундаж (токен дээр суурилсан) — загвар бүрээр */
        const per = await AiImage.aggregate([{ $match: { provider: "gemini", status: "done", usd: { $gt: 0 } } }, { $sort: { createdAt: -1 } }, { $limit: 300 }, { $group: { _id: "$modelId", usd: { $avg: "$usd" }, n: { $sum: 1 } } }]);
        const name: Record<string, string> = { nano2: "Nano Banana 2.1", nanoPro: "Nano Banana Pro", nanoLite: "Nano Banana 2 Lite", nano: "Nano Banana (legacy)" };
        units = per.filter((x) => x.n >= 1).map((x) => ({ label: name[x._id] || x._id, usd: Math.round(x.usd * 10000) / 10000 }));
        if (!units.length) units = [{ label: "Nano Banana 2.1", usd: 0.067 }];
      }
    }
    const billingBlocked = !!lastErr && BILLING.test(lastErr.msg) && (!lastOk || +new Date(lastErr.at) > +new Date(lastOk));
    const remaining = Math.max(0, total - spent);
    out.push({
      provider: p, label: LABEL[p], home: HOME[p],
      status: billingBlocked ? "blocked" : lastOk ? "ok" : "unknown",
      lastError: billingBlocked ? lastErr!.msg.slice(0, 160) : "",
      lastOkAt: lastOk, topups, total: round(total), spent: round(spent), remaining: round(remaining), hasLedger: topups.length > 0,
      capacity: units.map((u) => ({ ...u, count: u.usd > 0 && topups.length ? Math.floor(remaining / u.usd) : null })),
    });
  }
  return out;
}
const round = (n: number) => Math.round(n * 100) / 100;

export async function addTopup(provider: P, usd: number, note: string) {
  await dbConnect();
  await AiBudget.updateOne({ provider }, { $push: { topups: { usd, note: note.slice(0, 80), at: new Date() } } }, { upsert: true });
}
export async function removeTopup(provider: P, index: number) {
  await dbConnect();
  const d = await AiBudget.findOne({ provider });
  if (!d || !d.topups[index]) return;
  d.topups.splice(index, 1); await d.save();
}
