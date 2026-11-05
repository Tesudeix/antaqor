import { spawn, execFile } from "child_process";
import fs from "fs/promises";
import path from "path";
import YtJob, { IYtJob, YtInfo } from "@/models/YtJob";
import { YT_DIR, storedPath, refundJob, sweepFiles } from "@/lib/ytgrab";

/* ─── СЕРВЕРЭЭС ШУУД ТАТАХ (2026-10-24) ────────────────────────────────
   Droplet-ийн IP-г YouTube "bot" гэж хаадаг (2026-10-05, 10-24 дахин
   хэмжсэн). Cloudflare WARP-ийг ЗӨВХӨН proxy горимоор (127.0.0.1:40000)
   суулгасан — серверийн бусад урсгал хэвээр, зөвхөн yt-dlp WARP-аар гарна.
   Хэмжилт: 3.5 мин дуу → MP3 13с, 720p (30 MB) 4.5с.

   YT_PROXY тохируулагдсан бол хэрэглэгч agent суулгах шаардлагагүй: ажил
   энд гүйж, файл .ytfiles-д (нийтийн биш) хадгалагдаж, эзэн нь хөтчөөрөө
   татна. Хэрэглэгчийн холбоос shell-д хэзээ ч орохгүй — массив аргумент. */

const YTDLP = "/usr/local/bin/yt-dlp";
/** Droplet 2 CPU — бусад 9 аппыг дарахгүйн тулд зэрэг 2 ажил */
const MAX_PARALLEL = 2;
/** Серверийн горимын хязгаар: диск, CPU-г хамгаална */
export const SERVER_MAX_HEIGHT = 1080;
const MAX_VIDEO_SEC = 40 * 60;
const MAX_AUDIO_SEC = 3 * 3600;
const KILL_MS = 15 * 60_000;
const BUDGET = 8_000_000_000;
const AUDIO_ABR_CAP = 200;

export function serverMode(): boolean {
  return /^(socks5h?|https?):\/\/[^\s]+$/.test(process.env.YT_PROXY || "");
}

function humanError(raw: string): string {
  const s = String(raw || "");
  if (/not a bot|Sign in to confirm/i.test(s)) return "YouTube түр хаалаа — хэдэн минутын дараа дахин оролдоорой.";
  if (/HTTP Error 403/i.test(s)) return "Эх сайт татахыг зөвшөөрсөнгүй (403). Дахин оролдоорой.";
  if (/Private video/i.test(s)) return "Хувийн видео — татах боломжгүй.";
  if (/members-only|join this channel/i.test(s)) return "Зөвхөн гишүүдэд зориулсан видео.";
  if (/age|Confirm your age/i.test(s)) return "Насны хязгаартай видео — татах боломжгүй.";
  if (/Video unavailable/i.test(s)) return "Видео байхгүй болсон эсвэл хаалттай.";
  if (/does not pass filter|duration/i.test(s)) return "Хэт урт — видео 40 мин, MP3 3 цаг хүртэл.";
  if (/Unsupported URL/i.test(s)) return "Энэ холбоосыг уншиж чадсангүй.";
  if (/login required|requires authentication|only works when logged/i.test(s)) return "Энэ сайт нэвтрэлт шаардаж байна.";
  const line = s.split("\n").map((x) => x.trim()).filter((x) => /^ERROR/i.test(x))[0];
  return (line || "Татаж чадсангүй.").replace(/^ERROR:\s*(\[[^\]]+\]\s*[\w-]+:\s*)?/i, "").slice(0, 200);
}

/* ── мета: agent-ийн lib.js qualities()/summary()-тай ижил хэлбэр ── */
type Fmt = { height?: number; vcodec?: string; acodec?: string; filesize?: number; filesize_approx?: number; tbr?: number; abr?: number; fps?: number };
function summary(info: Record<string, unknown>): YtInfo {
  const fmts = (Array.isArray(info.formats) ? info.formats : []) as Fmt[];
  const sizeOf = (f: Fmt) => f.filesize || f.filesize_approx || 0;
  let audioBest = 0, audioCompat = 0;
  for (const f of fmts) {
    if (f.height || !f.acodec || f.acodec === "none") continue;
    audioBest = Math.max(audioBest, sizeOf(f));
    if (String(f.acodec).startsWith("mp4a") && (Number(f.abr) || 0) <= AUDIO_ABR_CAP) audioCompat = Math.max(audioCompat, sizeOf(f));
  }
  if (!audioCompat) audioCompat = audioBest;
  const byH = new Map<number, { height: number; size: number; tbr: number; fps: number; avc: boolean; progressive: boolean }>();
  for (const f of fmts) {
    if (!f.height || !f.vcodec || f.vcodec === "none") continue;
    const q = byH.get(f.height) || { height: f.height, size: 0, tbr: -1, fps: 0, avc: false, progressive: false };
    const tbr = Number(f.tbr) || 0;
    if (tbr > q.tbr) { q.tbr = tbr; q.size = sizeOf(f); q.progressive = !!(f.acodec && f.acodec !== "none"); }
    if (String(f.vcodec).startsWith("avc1")) q.avc = true;
    if ((f.fps || 0) > q.fps) q.fps = Math.round(f.fps || 0);
    byH.set(f.height, q);
  }
  return {
    id: String(info.id || ""), title: String(info.title || ""), uploader: String(info.uploader || info.channel || ""),
    duration: Number(info.duration) || 0, thumbnail: String(info.thumbnail || ""), live: !!info.is_live,
    qualities: [...byH.values()].filter((q) => q.height >= 144 && q.height <= SERVER_MAX_HEIGHT).sort((a, b) => b.height - a.height)
      .map((q) => ({ height: q.height, fps: q.fps, avc: q.avc, videoBytes: q.size, progressive: q.progressive })),
    audioBest, audioCompat,
  };
}

function selector(height: number, mode: string): string {
  const h = Math.min(Number(height) || 1080, SERVER_MAX_HEIGHT);
  if (mode === "best") return `bv*[height<=${h}]+ba/b[height<=${h}]`;
  return [
    `bv*[height<=${h}][vcodec^=avc1]+ba[acodec^=mp4a][abr<=${AUDIO_ABR_CAP}]`,
    `bv*[height<=${h}][vcodec^=avc1]+ba[acodec^=mp4a]`,
    `bv*[height<=${h}][ext=mp4]+ba[ext=m4a]`,
    `b[height<=${h}][ext=mp4]`, `bv*[height<=${h}]+ba`, `b[height<=${h}]`,
  ].join("/");
}

const base = () => ["--proxy", process.env.YT_PROXY || "", "--no-playlist", "--no-warnings", "--retries", "5", "--fragment-retries", "10"];

function probe(url: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    execFile(YTDLP, [...base(), "-J", url], { maxBuffer: 128 * 1024 * 1024, timeout: 90_000 }, (err, stdout, stderr) => {
      if (stdout && stdout.trim().startsWith("{")) { try { return resolve(JSON.parse(stdout)); } catch { /* доош */ } }
      reject(new Error(humanError(stderr || (err && err.message) || "")));
    });
  });
}

async function usedBytes(): Promise<number> {
  let names: string[];
  try { names = await fs.readdir(YT_DIR); } catch { return 0; }
  let sum = 0;
  for (const n of names) { try { sum += (await fs.stat(path.join(YT_DIR, n))).size; } catch { /* дараагийнх */ } }
  return sum;
}

const MARK = "__YTFILE__";
const TMARK = "__YTTITLE__";
function download(j: IYtJob, onProgress: (pct: number, stage: string) => void, onTitle: (t: string) => void): Promise<{ file: string; size: number }> {
  const id = String(j._id);
  const mp3 = j.mode === "mp3";
  const tmpl = path.join(YT_DIR, `${id}.work.%(ext)s`);
  const args = mp3
    ? ["-f", "ba/b", "-x", "--audio-format", "mp3", "--audio-quality", `${j.abr || 192}K`, "--embed-metadata", "--embed-thumbnail", "--convert-thumbnails", "jpg", "--match-filter", `duration<=${MAX_AUDIO_SEC}`]
    : ["-f", selector(j.height, j.mode), "--merge-output-format", "mp4", "--match-filter", `duration<=${MAX_VIDEO_SEC}`];
  const all = [...base(), ...args, "-N", "4", "--newline", "--progress", "--no-mtime", "-o", tmpl, "--print", `before_dl:${TMARK}%(title)s`, "--print", `after_move:${MARK}%(filepath)s`, j.url];
  return new Promise((resolve, reject) => {
    const p = spawn(YTDLP, all, { stdio: ["ignore", "pipe", "pipe"] });
    const kill = setTimeout(() => p.kill("SIGKILL"), KILL_MS);
    let tail = "", file = "", pct = 0, last = 0;
    const onChunk = (buf: Buffer) => {
      const text = buf.toString();
      tail = (tail + text).slice(-6000);
      for (const line of text.split(/\r?\n|\r/)) {
        if (!line) continue;
        const mk = line.indexOf(MARK);
        if (mk !== -1) { file = line.slice(mk + MARK.length).trim(); continue; }
        const tk = line.indexOf(TMARK);
        if (tk !== -1) { onTitle(line.slice(tk + TMARK.length).trim()); continue; }
        const m = line.match(/\[download\]\s+([\d.]+)%/);
        if (m) {
          pct = Math.max(pct, Math.min(97, Number(m[1]) || 0));
          if (Date.now() - last > 1200) { last = Date.now(); onProgress(pct, "Татаж байна"); }
        } else if (/\[ExtractAudio\]/.test(line)) onProgress(98, "MP3 болгож байна");
        else if (/\[Merger\]/.test(line)) onProgress(98, "Нэгтгэж байна");
      }
    };
    p.stdout.on("data", onChunk);
    p.stderr.on("data", onChunk);
    p.on("error", (e) => { clearTimeout(kill); reject(new Error("yt-dlp ажиллуулж чадсангүй: " + e.message)); });
    p.on("close", async (code) => {
      clearTimeout(kill);
      if (code === 0 && file) {
        try { const st = await fs.stat(file); return resolve({ file, size: st.size }); } catch { /* доош */ }
      }
      reject(new Error(code === null ? "Хугацаа хэтэрлээ (15 мин)" : humanError(tail)));
    });
  });
}

async function cleanWork(id: string) {
  let names: string[] = [];
  try { names = await fs.readdir(YT_DIR); } catch { return; }
  await Promise.all(names.filter((n) => n.startsWith(`${id}.work`)).map((n) => fs.unlink(path.join(YT_DIR, n)).catch(() => {})));
}

const safeName = (s: string) => s.replace(/[\\/:*?"<>|\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 140);

async function run(j: IYtJob) {
  const id = String(j._id);
  const progress = (pct: number, stage: string) => { void YtJob.updateOne({ _id: id, status: "working" }, { $set: { pct, stage } }).exec(); };
  try {
    if (j.kind === "probe") {
      const info = summary(await probe(j.url));
      await YtJob.updateOne({ _id: id }, { $set: { status: "done", pct: 100, stage: "Бэлэн", info, title: info.title.slice(0, 300), error: "" } });
      return;
    }
    await fs.mkdir(YT_DIR, { recursive: true });
    if ((await usedBytes()) > BUDGET) { await sweepFiles(); if ((await usedBytes()) > BUDGET) throw new Error("Сервер завгүй байна — хэдэн минутын дараа дахин оролдоорой."); }
    progress(1, "Эхлэв");
    /* гарчиг татаж эхлэхээс өмнө ирнэ — жагсаалтад шууд харагдана */
    let title = j.title || "";
    const { file, size } = await download(j, progress, (t) => {
      if (!t || title) return;
      title = t.slice(0, 300);
      void YtJob.updateOne({ _id: id }, { $set: { title } }).exec();
    });
    await fs.rename(file, storedPath(id));
    const nice = safeName(title) || (j.mode === "mp3" ? "audio" : "video");
    const fileName = j.mode === "mp3" ? `${nice}.mp3` : `${nice} ${j.height}p.mp4`;
    await YtJob.updateOne({ _id: id }, { $set: { status: "done", pct: 100, stage: "Бэлэн", stored: true, fileSize: size, fileName, title, error: "" } });
  } catch (e) {
    await cleanWork(id);
    const fresh = await YtJob.findById(id);
    if (fresh) { fresh.status = "error"; fresh.error = String((e as Error).message || "Татаж чадсангүй").slice(0, 300); await refundJob(fresh); await fresh.save(); }
  }
}

/* Нэг процесс доторх идэвхтэй ажил. Хуудас нээгдэх, ажил үүсэх бүрт дуудагдана —
   cron шаардахгүй. Сервер дахин асвал "working" ажлыг failStalled буцаана (кредит ч буцна). */
let active = 0;
export async function pumpServer(): Promise<void> {
  if (!serverMode()) return;
  while (active < MAX_PARALLEL) {
    const j = await YtJob.findOneAndUpdate(
      { runner: "server", status: "queued" },
      { $set: { status: "working", claimedAt: new Date(), stage: "Эхлэв", pct: 0 } },
      { sort: { createdAt: 1 }, new: true },
    );
    if (!j) return;
    active++;
    void run(j).finally(() => { active--; void pumpServer(); });
  }
}

