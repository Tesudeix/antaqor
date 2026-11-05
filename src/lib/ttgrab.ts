import { spawn } from "child_process";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

/* ─── TTGRAB — TikTok → mp4, СЕРВЕР ДЭЭР ───────────────────────────────
   YouTube-ээс ялгаатай нь TikTok droplet-ийн IP-г блоклодоггүй (шалгасан
   2026-10-12: 1080p шууд татагдана). Тиймээс энд agent хэрэггүй — сервер
   өөрөө татаж, хэрэглэгчид хавсралт болгон гардуулна.

   Douyin (cookie шаарддаг), Instagram (хоосон хариу) серверээс АЖИЛЛАХГҮЙ
   — тиймээс зөвхөн TikTok-ийн хостуудыг зөвшөөрнө. Хуурамч амлалт өгөхгүй.

   yt-dlp-г үргэлж МАССИВ аргументаар дуудна — холбоос хэзээ ч shell-д
   орохгүй. Ажлын төлөв нь процессын санах ойд (pm2 fork_mode, нэг
   инстанц); файл нь диск дээр 1 цаг хадгалагдаад арчигдана. */

const YTDLP = "/usr/local/bin/yt-dlp";
export const TT_DIR = path.join(process.cwd(), ".ttfiles");
const KEEP_MS = 60 * 60_000;
const MAX_ACTIVE = 3;          // серверийн нийт зэрэг татац
const MAX_PER_USER = 2;
const PROBE_TIMEOUT_MS = 45_000;
const FETCH_TIMEOUT_MS = 6 * 60_000;

const HOSTS = new Set(["tiktok.com", "m.tiktok.com", "vm.tiktok.com", "vt.tiktok.com"]);

export function checkTikTokUrl(raw: unknown): string {
  let u: URL;
  try { u = new URL(String(raw ?? "").trim()); }
  catch { throw new Error("Холбоос буруу байна."); }
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("Зөвхөн http эсвэл https холбоос.");
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  if (!HOSTS.has(host)) throw new Error("Зөвхөн TikTok холбоос дэмжинэ.");
  if (/\/photo\//.test(u.pathname)) throw new Error("Зургийн слайд биш, видео холбоос оруул.");
  /* TikTok Short Drama (/shortdrama/episode/…) — ангиуд нь TikTok-д
     НЭВТЭРСЭН хүнд л тоглогдоно; нийтийн API видео файлыг огт өгдөггүй
     ("No video formats found", 2026-10-12 шалгасан), серверийн IP-г бол
     /foryou руу шилжүүлдэг. Нэвтрэлтийн хаалтыг тойрохгүй — тодорхой хэлнэ. */
  if (/^\/shortdrama\//.test(u.pathname)) {
    throw new Error("TikTok Short Drama-гийн анги нь TikTok-д нэвтэрсэн хүнд л тоглогддог тул татах боломжгүй. Энгийн видео холбоос (tiktok.com/@…/video/…) оруулна уу.");
  }
  return u.toString();
}

export type Quality = "best" | "compat";

/* best  = хамгийн өндөр нягтрал (ихэвчлэн 1080p H.265)
   compat = H.264 — Windows, хуучин Android, Premiere бүгд уншина.
   `[height>0]` шүүлтүүр нь өндөргүй "download" форматыг (усан тэмдэгтэй)
   хасна; бусад нь бүтэлгүйтвэл л түүн рүү буцна. */
const SELECTOR: Record<Quality, string> = {
  best: "b[height>0]/b",
  compat: "b[vcodec^=h264][height>0]/b[vcodec^=avc][height>0]/b[height>0]/b",
};

function run(args: string[], timeoutMs: number, onLine?: (l: string) => void): Promise<{ code: number; out: string; err: string }> {
  return new Promise((resolve) => {
    const p = spawn(YTDLP, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "", buf = "";
    const t = setTimeout(() => p.kill("SIGKILL"), timeoutMs);
    p.stdout.on("data", (d: Buffer) => {
      const s = d.toString();
      if (onLine) {
        buf += s;
        const lines = buf.split(/\r?\n|\r/);
        buf = lines.pop() || "";
        lines.forEach(onLine);
      } else if (out.length < 8_000_000) out += s;
    });
    p.stderr.on("data", (d: Buffer) => { if (err.length < 20_000) err += d.toString(); });
    p.on("close", (code) => { clearTimeout(t); resolve({ code: code ?? 1, out, err }); });
    p.on("error", (e) => { clearTimeout(t); resolve({ code: 1, out, err: String(e) }); });
  });
}

function cleanErr(err: string): string {
  const line = err.split("\n").reverse().find((l) => l.includes("ERROR")) || "";
  if (/private|login|log in/i.test(line)) return "Хаалттай эсвэл нэвтрэлт шаардсан видео.";
  if (/Unsupported URL/i.test(line)) return "Энэ холбоосоос видео олдсонгүй. Видеоны шууд холбоос эсэхийг шалга.";
  if (/not available|removed|404/i.test(line)) return "Видео устсан эсвэл хүртээмжгүй.";
  if (/max-filesize|larger than/i.test(line)) return "Файл хэт том (500 MB-аас их).";
  return "Татаж чадсангүй. Дахин оролдоно уу.";
}

/* ─── Шалгах ─────────────────────────────────────────────────────────── */
interface RawFmt { format_id?: string; vcodec?: string; height?: number; width?: number; filesize?: number; filesize_approx?: number }

export interface TtInfo {
  id: string; title: string; uploader: string; duration: number; thumbnail: string;
  best: { height: number; codec: string; bytes: number } | null;
  compat: { height: number; codec: string; bytes: number } | null;
}

export async function probe(url: string): Promise<TtInfo> {
  const r = await run(["-J", "--no-playlist", "--no-warnings", "--socket-timeout", "15", "--", url], PROBE_TIMEOUT_MS);
  if (r.code !== 0) throw new Error(cleanErr(r.err));
  let d: Record<string, unknown>;
  try { d = JSON.parse(r.out); } catch { throw new Error("Мэдээлэл уншиж чадсангүй."); }

  const fmts = ((d.formats as RawFmt[]) || []).filter((f) => f.height && f.vcodec && f.vcodec !== "none");
  const pick = (list: RawFmt[]) => {
    const f = [...list].sort((a, b) => (b.height! - a.height!) || ((b.filesize || 0) - (a.filesize || 0)))[0];
    return f ? { height: Math.min(f.height!, f.width || f.height!), codec: /h265|hevc|bytevc1/i.test(f.vcodec!) ? "H.265" : "H.264", bytes: f.filesize || f.filesize_approx || 0 } : null;
  };
  const avc = fmts.filter((f) => /^(h264|avc)/i.test(f.vcodec!));

  return {
    id: String(d.id || ""),
    title: String(d.title || d.description || "TikTok видео").slice(0, 200),
    uploader: String(d.uploader || d.channel || ""),
    duration: Number(d.duration) || 0,
    thumbnail: String(d.thumbnail || ""),
    best: pick(fmts),
    compat: pick(avc),
  };
}

/* ─── Татах ажил ─────────────────────────────────────────────────────── */
export interface TtJob {
  id: string; user: string; url: string; quality: Quality; title: string;
  status: "working" | "done" | "error"; pct: number; error: string;
  file: string; size: number; createdAt: number;
}

const g = globalThis as unknown as { __ttJobs?: Map<string, TtJob> };
const jobs: Map<string, TtJob> = g.__ttJobs || (g.__ttJobs = new Map());

export function getJob(id: string, user: string): TtJob | null {
  const j = jobs.get(id);
  return j && j.user === user ? j : null;
}

export function userJobs(user: string): TtJob[] {
  return [...jobs.values()].filter((j) => j.user === user).sort((a, b) => b.createdAt - a.createdAt);
}

export function publicJob(j: TtJob) {
  return { id: j.id, title: j.title, quality: j.quality, status: j.status, pct: j.pct, error: j.error, size: j.size, createdAt: j.createdAt };
}

export function safeName(title: string): string {
  return (title.replace(/[^\p{L}\p{N} _-]/gu, "").trim().replace(/\s+/g, "-").slice(0, 70) || "tiktok") + ".mp4";
}

export function startFetch(user: string, url: string, quality: Quality, title: string): TtJob {
  const active = [...jobs.values()].filter((j) => j.status === "working");
  if (active.filter((j) => j.user === user).length >= MAX_PER_USER) throw new Error("Өмнөх татац дуусахыг хүлээнэ үү.");
  if (active.length >= MAX_ACTIVE) throw new Error("Сервер завгүй байна. Хэдэн секундын дараа дахин оролдоорой.");

  const id = crypto.randomBytes(12).toString("hex");
  const job: TtJob = {
    id, user, url, quality, title: title.slice(0, 200) || "TikTok видео",
    status: "working", pct: 0, error: "", file: path.join(TT_DIR, id + ".mp4"), size: 0, createdAt: Date.now(),
  };
  jobs.set(id, job);

  void (async () => {
    await fs.mkdir(TT_DIR, { recursive: true });
    const r = await run(
      [
        "-f", SELECTOR[quality], "-S", "res,br",
        "--no-playlist", "--no-warnings", "--no-part", "--socket-timeout", "15",
        "--max-filesize", "500M", "--merge-output-format", "mp4",
        "--newline", "--progress-template", "download:PCT %(progress._percent_str)s",
        "-o", job.file, "--", url,
      ],
      FETCH_TIMEOUT_MS,
      (l) => { const m = /PCT\s+([\d.]+)%/.exec(l); if (m) job.pct = Math.min(99, Math.round(Number(m[1]))); },
    );
    try {
      if (r.code !== 0) throw new Error(cleanErr(r.err));
      job.size = (await fs.stat(job.file)).size;
      job.pct = 100;
      job.status = "done";
    } catch (e) {
      job.status = "error";
      job.error = (e as Error).message || "Татаж чадсангүй.";
      await fs.rm(job.file, { force: true }).catch(() => {});
    }
  })();

  return job;
}

/* Хуучирсан файл + ажлыг арчина. Cron шаардахгүй — хүсэлт бүр дээр. */
export async function sweep(): Promise<void> {
  const now = Date.now();
  for (const [id, j] of jobs) {
    if (j.status !== "working" && now - j.createdAt > KEEP_MS) {
      jobs.delete(id);
      await fs.rm(j.file, { force: true }).catch(() => {});
    }
  }
  /* Процесс дахин асахад Map хоосорно — дискэн дээр үлдсэнийг mtime-аар. */
  const names = await fs.readdir(TT_DIR).catch(() => [] as string[]);
  for (const n of names) {
    const p = path.join(TT_DIR, n);
    const st = await fs.stat(p).catch(() => null);
    if (st && now - st.mtimeMs > KEEP_MS && !jobs.has(n.replace(/\.mp4$/, ""))) await fs.rm(p, { force: true }).catch(() => {});
  }
}
