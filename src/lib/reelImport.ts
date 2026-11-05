import { spawn } from "child_process";
import { mkdir, unlink, writeFile, stat } from "fs/promises";
import path from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { checkTikTokUrl } from "@/lib/ttgrab";
import { listMetaTargets } from "@/lib/socialPublish";
import { AgentConn } from "@/models/AgentWorkspace";
import { probeDuration, trimVideo } from "@/lib/hfMedia";

/* ─── Reel / TikTok → Genjutsu-гийн эх видео (2026-10-24) ─────────────────
   Шалгасан баримт (droplet-ээс):
   · Instagram бусдын Reel-ийг серверээс татахыг ХОРИГЛОДОГ — yt-dlp 2026.10.21 ч «empty media
     response», embed хуудсанд mp4 алга, Business Discovery нь апп-д зөвшөөрөлгүй (#10).
   · Харин ӨӨРИЙН холбосон IG аккаунтын Reel Graph API-аар media_url өгнө (18-аас 17 —
     зохиогчийн эрхтэй дуутай Reel-д Instagram media_url-ийг нуудаг).
   · TikTok yt-dlp-ээр шууд татагдана (/tools/tiktok-той ижил).
   Тиймээс: Instagram холбоос → өөрийн аккаунтын Reel-ээс shortcode-оор хайна → олдохгүй бол
   yt-dlp (заримдаа ажиллана) → бүтэлгүйтвэл ойлгомжтой заавар. Хуурамч амлалт өгөхгүй. */

const YTDLP = "/usr/local/bin/yt-dlp";
const G = "https://graph.facebook.com/v21.0";
type IgAcc = { igId: string; token: string; label: string };

async function igAccounts(ws: string): Promise<IgAcc[]> {
  if (ws === "main") return (await listMetaTargets()).filter((t) => t.igId && t.igToken).map((t) => ({ igId: t.igId, token: t.igToken, label: t.label }));
  const rows = await AgentConn.find({ ws, platform: "meta", igId: { $ne: "" } }).select("+pageToken igId label").lean<{ igId: string; pageToken: string; label: string }[]>();
  return rows.filter((r) => r.pageToken).map((r) => ({ igId: r.igId, token: r.pageToken, label: r.label }));
}
type IgMedia = { id: string; permalink?: string; media_type?: string; media_url?: string; thumbnail_url?: string; caption?: string; timestamp?: string };
async function igMedia(a: IgAcc, limit = 50): Promise<IgMedia[]> {
  const r = await fetch(`${G}/${a.igId}/media?fields=id,permalink,media_type,media_url,thumbnail_url,caption,timestamp&limit=${limit}&access_token=${a.token}`, { signal: AbortSignal.timeout(20000) }).then((x) => x.json()).catch(() => ({}));
  return Array.isArray(r.data) ? r.data : [];
}

/** Холбосон Instagram-ын татаж болох видеонууд (зураг сонгогчид) */
export async function ownReels(ws: string) {
  const out: { id: string; permalink: string; thumb: string; caption: string; at: string; account: string }[] = [];
  for (const a of await igAccounts(ws)) {
    for (const m of await igMedia(a, 30)) {
      if (m.media_type === "VIDEO" && m.media_url) out.push({ id: m.id, permalink: m.permalink || "", thumb: m.thumbnail_url || "", caption: (m.caption || "").slice(0, 90), at: m.timestamp || "", account: a.label });
    }
  }
  return out.slice(0, 36);
}

function ytdlp(url: string, out: string): Promise<{ ok: boolean; err: string }> {
  return new Promise((resolve) => {
    const p = spawn(YTDLP, ["--no-playlist", "-f", "b[height>0][ext=mp4]/b[height>0]/b", "--max-filesize", "300M", "-o", out, url], { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    const t = setTimeout(() => p.kill("SIGKILL"), 150_000);
    p.stderr.on("data", (d: Buffer) => { if (err.length < 8000) err += d.toString(); });
    p.on("close", (code) => { clearTimeout(t); resolve({ ok: code === 0, err }); });
    p.on("error", (e) => { clearTimeout(t); resolve({ ok: false, err: String(e) }); });
  });
}
async function fetchTo(url: string, file: string) {
  const r = await fetch(url, { signal: AbortSignal.timeout(150_000) });
  if (!r.ok) throw new Error(`Видео татаж чадсангүй (${r.status})`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > 300 * 1024 * 1024) throw new Error("Видео хэт том (300MB+)");
  await writeFile(file, buf);
}

/** Instagram Reel / TikTok холбоос → /uploads/agent-ref-*.mp4 (15с хүртэл, H.264) */
export async function importReel(ws: string, raw: string): Promise<{ url: string; dur: number; via: string }> {
  let u: URL;
  try { u = new URL(String(raw || "").trim()); } catch { throw new Error("Холбоос буруу байна"); }
  if (!/^https?:$/.test(u.protocol)) throw new Error("Холбоос буруу байна");
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  const id = randomUUID();
  const tmp = path.join(tmpdir(), `reel-${id}.src`);
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  const dst = path.join(dir, `agent-ref-${id}.mp4`);
  let via = "";
  try {
    if (host === "instagram.com" || host.endsWith(".instagram.com")) {
      const code = /\/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/.exec(u.pathname)?.[1];
      if (!code) throw new Error("Энэ нь Instagram Reel-ийн холбоос биш байна");
      for (const a of await igAccounts(ws)) {
        const hit = (await igMedia(a, 100)).find((m) => m.permalink?.includes(`/${code}`) && m.media_url);
        if (hit?.media_url) { await fetchTo(hit.media_url, tmp); via = `instagram · ${a.label}`; break; }
      }
      if (!via && (await ytdlp(u.toString(), tmp)).ok) via = "instagram";
      if (!via) throw new Error("Instagram бусдын Reel-ийг серверээс татахыг хориглодог. Reel-ээ утсандаа хадгалаад «Видео оруулах»-аар оруулна уу — эсвэл өөрийн холбосон Instagram-ын Reel-ээс «Миний Reels»-ээр сонгоно уу.");
    } else {
      if (!/(^|\.)tiktok\.com$/.test(host)) throw new Error("Instagram Reel эсвэл TikTok холбоос оруулна уу");
      checkTikTokUrl(u.toString());
      const y = await ytdlp(u.toString(), tmp);
      if (!y.ok) throw new Error(/private|login/i.test(y.err) ? "Хаалттай TikTok видео — нээлттэй видео оруулна уу" : "TikTok видеог татаж чадсангүй — холбоосоо шалгана уу");
      via = "tiktok";
    }
    if (!(await stat(tmp).catch(() => null))?.size) throw new Error("Видео хоосон ирлээ");
    await trimVideo(tmp, dst, 15);
  } finally { await unlink(tmp).catch(() => {}); }
  const dur = await probeDuration(dst);
  if (!dur) { await unlink(dst).catch(() => {}); throw new Error("Видео уншиж чадсангүй"); }
  return { url: `/uploads/agent-ref-${id}.mp4`, dur, via };
}
