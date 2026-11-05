#!/usr/bin/env node
"use strict";

/* ─── ANTAQOR YTGRAB AGENT (нэг файлт) ──────────────────────────────────
   antaqor.com/tools/youtube хуудсанд ажил нийлүүлэхэд ЭНЭ компьютер нь
   татацыг гүйцэтгэнэ. Татац Antaqor-ын сервер дээр гүйдэггүй: дата
   центрийн IP-г YouTube хааж, медиа хаяг нь уншсан IP-д хүлэгддэг.
   Тиймээс чиний өөрийн сүлжээ л энэ ажлыг хийж чадна.

   Шаардлага:  node, yt-dlp, ffmpeg
     macOS:  brew install node yt-dlp ffmpeg
   Ажиллуулах: node antaqor-ytgrab.js
   Нууцыг нэг удаа асууж ~/.ytgrab.json (0600) дотор хадгална.

   Энэ файлыг tools/ytgrab/build-single.js үүсгэсэн — гараар засах бол
   эх нь lib.js ба agent.js. */

const yt = (() => {

/* ─── YTGRAB — хуваалцсан логик ─────────────────────────────────────────
   server.js (орон нутгийн интерфейс) ба agent.js (antaqor.com-ын ажил
   гүйцэтгэгч) хоёулаа эндээс татна. Хэрэглэгчийн текст ХЭЗЭЭ Ч shell-д
   орохгүй — yt-dlp нь массив аргументаар л дуудагдана. */

const { spawn, execFile } = require("child_process");
const path = require("path");
const fs = require("fs");

function findBin(name) {
  const dirs = ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", ...(process.env.PATH || "").split(":")];
  for (const d of dirs) {
    if (!d) continue;
    const p = path.join(d, name);
    try { fs.accessSync(p, fs.constants.X_OK); return p; } catch { /* дараагийнх */ }
  }
  return null;
}

const YTDLP = findBin("yt-dlp");
const FFMPEG = findBin("ffmpeg");

const HOSTS = new Set([
  "youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be", "youtube-nocookie.com",
  "tiktok.com", "vm.tiktok.com",
  "instagram.com", "facebook.com", "fb.watch",
  "vimeo.com", "player.vimeo.com",
  "x.com", "twitter.com",
]);

const HEIGHTS = [144, 240, 360, 480, 720, 1080, 1440, 2160, 4320];

/* MP3-ийн чанар (kbps). 192 нь утас, чихэвчинд ялгаагүй, файл нь 320-оос 40% жижиг. */
const MP3_KBPS = [128, 192, 320];

/* Тохиромжтой режимийн аудионы хязгаар (kbps). YouTube-ийн 388 kbps
   5.1 хальс нь эвлүүлэгчид хэрэггүй бөгөөд файлыг 3 дахин хийсвэл. */
const AUDIO_ABR_CAP = 200;

function checkUrl(raw) {
  let u;
  try { u = new URL(String(raw || "").trim()); } catch { throw new Error("Холбоос буруу байна."); }
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("Зөвхөн http эсвэл https холбоос.");
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  if (!HOSTS.has(host)) throw new Error("Дэмжээгүй сайт: " + host);
  return u.toString();
}

/* Провайдерын алдааг хүнд ойлгомжтой болгоно. */
function humanError(raw) {
  const s = String(raw || "");
  if (/not a bot|Sign in to confirm/i.test(s))
    return "YouTube энэ сүлжээг робот гэж үзэв. VPN/прокси унтраагаад дахин үзээрэй.";
  if (/HTTP Error 403/i.test(s))
    return "YouTube татахыг зөвшөөрсөнгүй (403). yt-dlp-ээ шинэчил: brew upgrade yt-dlp";
  if (/Private video/i.test(s)) return "Хувийн видео — татах боломжгүй.";
  if (/members-only|join this channel/i.test(s)) return "Зөвхөн гишүүдэд зориулсан видео.";
  if (/age|Confirm your age/i.test(s)) return "Насны хязгаартай видео — нэвтрэлт шаардана.";
  if (/Video unavailable/i.test(s)) return "Видео байхгүй болсон эсвэл тус улсад хаалттай.";
  if (/Unsupported URL/i.test(s)) return "Энэ холбоосыг уншиж чадсангүй.";
  if (/only works when logged|login required|requires authentication/i.test(s))
    return "Энэ сайт нэвтрэлт шаардаж байна.";
  if (/No space left/i.test(s)) return "Диск дүүрсэн — зай сулруул.";
  const line = s.split("\n").map((x) => x.trim()).filter((x) => /^ERROR/i.test(x))[0];
  return (line || "Татаж чадсангүй.").replace(/^ERROR:\s*/i, "").slice(0, 200);
}

function probe(url) {
  return new Promise((resolve, reject) => {
    execFile(YTDLP, ["-J", "--no-warnings", "--no-playlist", url],
      { maxBuffer: 128 * 1024 * 1024, timeout: 150000 },
      (err, stdout, stderr) => {
        if (stdout && stdout.trim().startsWith("{")) {
          try { return resolve(JSON.parse(stdout)); } catch { /* доошоо */ }
        }
        reject(new Error(humanError(stderr || (err && err.message) || "")));
      });
  });
}

function qualities(info) {
  const fmts = Array.isArray(info.formats) ? info.formats : [];
  const sizeOf = (f) => f.filesize || f.filesize_approx || 0;

  /* Аудиог хоёр тусад нь — "тохиромжтой" режимд стерео AAC-ээр
     хязгаарлаж, таамаглалыг яг татагдах хальстай нийцүүлнэ. */
  let audioBest = 0, audioCompat = 0;
  for (const f of fmts) {
    if (f.height || !f.acodec || f.acodec === "none") continue;
    const sz = sizeOf(f);
    audioBest = Math.max(audioBest, sz);
    if (String(f.acodec).startsWith("mp4a") && (Number(f.abr) || 0) <= AUDIO_ABR_CAP) {
      audioCompat = Math.max(audioCompat, sz);
    }
  }
  if (!audioCompat) audioCompat = audioBest;

  const byH = new Map();
  for (const f of fmts) {
    if (!f.height || !f.vcodec || f.vcodec === "none") continue;
    const q = byH.get(f.height) || { height: f.height, size: 0, tbr: -1, fps: 0, avc: false, progressive: false };
    /* Хэмжээг ХАМГИЙН ӨНДӨР bitrate-тэй хальснаас — yt-dlp-ийн `bv*`
       яг түүнийг сонгодог. */
    const tbr = Number(f.tbr) || 0;
    if (tbr > q.tbr) {
      q.tbr = tbr;
      q.size = sizeOf(f);
      q.progressive = !!(f.acodec && f.acodec !== "none");
    }
    if (String(f.vcodec).startsWith("avc1")) q.avc = true;
    if ((f.fps || 0) > q.fps) q.fps = Math.round(f.fps || 0);
    byH.set(f.height, q);
  }

  const list = [...byH.values()]
    .filter((q) => q.height >= 144)
    .sort((a, b) => b.height - a.height)
    .map((q) => ({
      height: q.height, fps: q.fps, avc: q.avc,
      videoBytes: q.size, progressive: q.progressive,
    }));
  return { list, audioBest, audioCompat };
}

/* Мета + чанарыг сервер рүү явуулахад тохирсон хэлбэрт хурааж авна. */
function summary(info) {
  const q = qualities(info);
  return {
    id: info.id || "",
    title: info.title || "",
    uploader: info.uploader || info.channel || "",
    duration: info.duration || 0,
    thumbnail: info.thumbnail || "",
    live: !!info.is_live,
    qualities: q.list,
    audioBest: q.audioBest,
    audioCompat: q.audioCompat,
  };
}

function selector(height, mode) {
  const h = Number(height);
  if (mode === "best") return `bv*[height<=${h}]+ba/b[height<=${h}]`;
  /* Засварын программд тохиромжтой: H.264 + AAC-ийг эрэмбэлж хайна. */
  return [
    `bv*[height<=${h}][vcodec^=avc1]+ba[acodec^=mp4a][abr<=${AUDIO_ABR_CAP}]`,
    `bv*[height<=${h}][vcodec^=avc1]+ba[acodec^=mp4a]`,
    `bv*[height<=${h}][ext=mp4]+ba[ext=m4a]`,
    `b[height<=${h}][ext=mp4]`,
    `bv*[height<=${h}]+ba`,
    `b[height<=${h}]`,
  ].join("/");
}

const MARK = "__YTGRAB_FILE__";

/* Татна. `onProgress(pct, stage)` нь дэлгэц/сервер рүү явцыг хэлнэ.
   Resolve → { file, size }.

   403 ДЭЭР НЭГ УДАА ДАХИН ОРОЛДОНО. Яагаад: YouTube-ийн медиа хаяг нь
   хугацаатай бөгөөд нэг видеог дараалан татахад түр зуур 403 өгдгийг
   хэмжиж харсан — тэр үед ШИНЭЭР уншвал (шинэ хаяг) бүтдэг. Үүнгүй бол
   түр зуурын хаалт нь ажлыг сүйтгэж, хэрэглэгчийн кредит эргэлдэнэ.
   `--retries` нь үүнд тус болохгүй: тэр нь нэг л хаягийг давтдаг. */
async function download(args) {
  try {
    return await downloadOnce(args);
  } catch (e) {
    if (!/403|Requested format is not available/i.test(String(e && e.message))) throw e;
    if (args.onProgress) args.onProgress(0, "Дахин оролдож байна");
    await new Promise((r) => setTimeout(r, 3000));
    return downloadOnce(args);
  }
}

/* yt-dlp-ийн аргумент. `-N 4` — DASH хэсгүүдийг 4 зэрэг татна (2–3 дахин хурдан).
   MP3: зөвхөн дууны хальсыг татаж (видеогоос 10–30 дахин бага), ffmpeg-ээр mp3
   болгоод нэр, зураачийг (metadata) болон нүүр зургийг шингээнэ. */
function argsFor({ url, height, mode, kbps, outDir }) {
  const common = [
    "--no-playlist", "--no-warnings", "--newline", "--progress",
    "--no-mtime", "--retries", "5", "--fragment-retries", "10", "-N", "4",
    "--print", "after_move:" + MARK + "%(filepath)s",
  ];
  if (mode === "mp3") {
    const k = MP3_KBPS.includes(Number(kbps)) ? Number(kbps) : 192;
    return [
      "-f", "ba/b", "-x", "--audio-format", "mp3", "--audio-quality", k + "K",
      "--embed-metadata", "--embed-thumbnail", "--convert-thumbnails", "jpg",
      "-o", path.join(outDir, "%(title).140B [%(id)s].%(ext)s"),
      ...common, url,
    ];
  }
  return [
    "-f", selector(height, mode),
    "--merge-output-format", "mp4",
    "-o", path.join(outDir, "%(title).140B [%(id)s] %(height)sp.%(ext)s"),
    ...common, url,
  ];
}

function downloadOnce({ url, height, mode, kbps, outDir, onProgress }) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(outDir, { recursive: true });

    const args = argsFor({ url, height, mode, kbps, outDir });

    const p = spawn(YTDLP, args, { stdio: ["ignore", "pipe", "pipe"] });
    let tail = "";
    let file = "";
    let pct = 0;

    const onChunk = (buf) => {
      const text = buf.toString();
      tail = (tail + text).slice(-6000);
      for (const line of text.split(/\r?\n|\r/)) {
        if (!line) continue;

        const mark = line.indexOf(MARK);
        if (mark !== -1) { file = line.slice(mark + MARK.length).trim(); continue; }

        const m = line.match(/\[download\]\s+([\d.]+)%/);
        if (m) {
          const v = Math.min(99, Number(m[1]) || 0);
          /* Видео + аудио тус тусдаа 0→100 болдог тул хойш буцахгүй. */
          if (v >= pct || v > 95) pct = Math.max(pct, v);
          if (onProgress) onProgress(pct, "Татаж байна");
          continue;
        }
        if (/\[Merger\]|\[VideoRemuxer\]/.test(line)) {
          pct = Math.max(pct, 99);
          if (onProgress) onProgress(pct, "Нэгтгэж байна");
        }
        if (/\[ExtractAudio\]/.test(line)) {
          pct = Math.max(pct, 99);
          if (onProgress) onProgress(pct, "MP3 болгож байна");
        }
      }
    };

    p.stdout.on("data", onChunk);
    p.stderr.on("data", onChunk);
    p.on("error", (e) => reject(new Error("yt-dlp ажиллуулж чадсангүй: " + e.message)));
    p.on("close", (code) => {
      if (code === 0 && file && fs.existsSync(file)) {
        let size = 0;
        try { size = fs.statSync(file).size; } catch { /* хамаагүй */ }
        resolve({ file, size });
      } else {
        reject(new Error(humanError(tail) || "yt-dlp " + code + " кодоор гарав"));
      }
    });
  });
}

return {
  YTDLP, FFMPEG, HEIGHTS, AUDIO_ABR_CAP, MP3_KBPS,
  findBin, checkUrl, humanError, probe, qualities, summary, selector, argsFor, download,
};

})();


/* ─── YTGRAB AGENT ──────────────────────────────────────────────────────
   antaqor.com дээрх /tools/youtube нь ажлыг бүртгэдэг, НЭГ Ч ТАТАЦ
   СЕРВЕР ДЭЭР ГҮЙХГҮЙ. Энэ процесс л тэр ажлуудыг аваад ЭНЭ MAC-ийн
   гэрийн IP-гаар гүйцэтгэнэ.

   Тохиргоо: ~/.ytgrab.json
     { "base": "https://antaqor.com", "token": "…", "outDir": "/Users/…/Downloads" }
   Нууц нь зөвхөн энэ файлд — репод ч, серверийн клиент код руу ч
   хэзээ ч орохгүй. */

const fs = require("fs");
const os = require("os");
const path = require("path");
const https = require("https");
const http = require("http");
const readline = require("readline");


/* 1.1 (2026-10-24): MP3 горим + 4 зэрэг хэсэгчилсэн татац. Сервер MP3-ыг зөвхөн ≥1.1-д өгнө. */
const VERSION = "1.1";
const CFG_PATH = path.join(os.homedir(), ".ytgrab.json");

function readConfig() {
  let c = {};
  try { c = JSON.parse(fs.readFileSync(CFG_PATH, "utf8")); }
  catch { /* шинэ тохиргоо болно */ }
  return {
    base: (process.env.YTGRAB_BASE || c.base || "https://antaqor.com").replace(/\/+$/, ""),
    token: process.env.YTGRAB_AGENT_TOKEN || c.token || "",
    outDir: process.env.YTGRAB_DIR || c.outDir || path.join(os.homedir(), "Downloads"),
  };
}

/* Нууцгүй бол нэг удаа асууна. Командын мөрөнд бичүүлбэл shell-ийн
   түүхэнд үлдэх тул асуулт хэлбэрээр авч, 0600 файлд шууд бичнэ. */
function askToken() {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      console.error("✗ Нууц олдсонгүй. " + CFG_PATH + " дотор {\"token\":\"…\"} байх ёстой.");
      process.exit(1);
    }
    console.log("\n  Нэг удаагийн тохируулга.");
    console.log("  antaqor.com/tools/youtube хуудсаас нууцаа авч энд тавь.\n");
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question("  Нууц: ", (ans) => { rl.close(); resolve(String(ans || "").trim()); });
  });
}

async function loadConfig() {
  const c = readConfig();
  if (c.token) return c;
  const token = await askToken();
  if (!/^[a-f0-9]{64}$/i.test(token)) {
    console.error("\n✗ Нууц 64 тэмдэгтийн hex байх ёстой. Хуудаснаасаа бүтнээр хуулаарай.");
    process.exit(1);
  }
  c.token = token.toLowerCase();
  fs.writeFileSync(CFG_PATH, JSON.stringify({ base: c.base, token: c.token, outDir: c.outDir }, null, 2) + "\n", { mode: 0o600 });
  console.log("  ✓ Хадгаллаа: " + CFG_PATH + "\n");
  return c;
}

let CFG = readConfig();

/* ─── Сервертэй ярих ────────────────────────────────────────────────── */
function api(payload) {
  return new Promise((resolve, reject) => {
    const body = Buffer.from(JSON.stringify(payload));
    const u = new URL(CFG.base + "/api/agent/ytgrab");
    const mod = u.protocol === "http:" ? http : https;
    const req = mod.request({
      hostname: u.hostname, port: u.port || undefined, path: u.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": body.length,
        "x-ytgrab-token": CFG.token,
      },
      timeout: 30000,
    }, (res) => {
      const parts = [];
      res.on("data", (c) => parts.push(c));
      res.on("end", () => {
        const text = Buffer.concat(parts).toString();
        if (res.statusCode === 403) return reject(new Error("Нууц таарсангүй (403)"));
        try { resolve(JSON.parse(text)); }
        catch { reject(new Error("Хариу уншиж чадсангүй: " + text.slice(0, 120))); }
      });
    });
    req.on("timeout", () => req.destroy(new Error("Хугацаа дууслаа")));
    req.on("error", reject);
    req.end(body);
  });
}

/* Файлыг урсгалаар дамжуулна — 1 GB-ийг санд барихгүй. */
function uploadFile(id, filePath, type) {
  return new Promise((resolve, reject) => {
    const size = fs.statSync(filePath).size;
    const u = new URL(CFG.base + "/api/agent/ytgrab/upload?id=" + encodeURIComponent(id));
    const mod = u.protocol === "http:" ? http : https;
    const req = mod.request({
      hostname: u.hostname, port: u.port || undefined, path: u.pathname + u.search,
      method: "POST",
      headers: {
        "Content-Type": type || "video/mp4",
        "Content-Length": size,
        "x-ytgrab-token": CFG.token,
      },
      /* Гэрийн uplink удаан — 250 MB нь хэдэн минут болно. */
      timeout: 40 * 60_000,
    }, (res) => {
      const parts = [];
      res.on("data", (c) => parts.push(c));
      res.on("end", () => {
        if (res.statusCode === 200) return resolve();
        reject(new Error("Хуулж чадсангүй (" + res.statusCode + "): " + Buffer.concat(parts).toString().slice(0, 140)));
      });
    });
    req.on("timeout", () => req.destroy(new Error("Хуулах хугацаа дууслаа")));
    req.on("error", reject);
    fs.createReadStream(filePath).on("error", reject).pipe(req);
  });
}

/* ─── Нэг ажил ──────────────────────────────────────────────────────── */
async function handle(job) {
  const tag = job.kind === "probe" ? "мета" : job.mode === "mp3" ? "MP3 " + (job.abr || 192) + "k" : job.height + "p";
  console.log("→ " + tag + "  " + job.url);

  if (job.kind === "probe") {
    const info = await yt.probe(job.url);
    await api({ action: "result", id: job.id, ok: true, info: yt.summary(info) });
    console.log("  ✓ " + (info.title || "").slice(0, 60));
    return;
  }

  /* Явцыг хэт олон удаа илгээхгүй — секунд тутамд нэг л хангалттай. */
  let lastSent = 0, lastPct = -1;
  const { file, size } = await yt.download({
    url: job.url, height: job.height, mode: job.mode, kbps: job.abr, outDir: CFG.outDir,
    onProgress: (pct, stage) => {
      const now = Date.now();
      if (now - lastSent < 1000 || Math.round(pct) === lastPct) return;
      lastSent = now; lastPct = Math.round(pct);
      api({ action: "progress", id: job.id, pct, stage }).catch(() => {});
    },
  });

  if (job.wantUpload) {
    await api({ action: "progress", id: job.id, pct: 99, stage: "Сервер рүү хуулж байна" }).catch(() => {});
    console.log("  ↑ сервер рүү хуулж байна (" + Math.round(size / 1048576) + " MB)…");
    await uploadFile(job.id, file, job.mode === "mp3" ? "audio/mpeg" : "video/mp4");
  }

  await api({
    action: "result", id: job.id, ok: true,
    fileName: path.basename(file), macPath: file, fileSize: size,
  });
  console.log("  ✓ " + path.basename(file) + "  (" + Math.round(size / 1048576) + " MB)");
}

/* ─── Гол гогцоо ────────────────────────────────────────────────────── */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!yt.YTDLP) { console.error("✗ yt-dlp олдсонгүй.  brew install yt-dlp"); process.exit(1); }
  if (!yt.FFMPEG) { console.error("✗ ffmpeg олдсонгүй.  brew install ffmpeg"); process.exit(1); }
  CFG = await loadConfig();

  console.log("\n  YTGRAB AGENT  →  " + CFG.base);
  console.log("  Файл бууна: " + CFG.outDir);
  console.log("  Зогсоох: Ctrl+C\n");

  let quiet = 0;
  for (;;) {
    try {
      const { job } = await api({ action: "claim", version: VERSION, outDir: CFG.outDir });
      if (!job) {
        /* Ажилгүй үед 2 секунд. Сервер нь "online" гэж үзэх цонх 25
           секунд тул энэ нь хангалттай зузаан нөөцтэй. */
        if (++quiet % 150 === 0) console.log("  … хүлээж байна");
        await sleep(2000);
        continue;
      }
      quiet = 0;
      try {
        await handle(job);
      } catch (e) {
        console.error("  ✗ " + e.message);
        await api({ action: "result", id: job.id, ok: false, error: e.message }).catch(() => {});
      }
    } catch (e) {
      /* Сүлжээ унасан, эсвэл нууц буруу. Хурдан давтаж сервер зовоохгүй. */
      console.error("  ✗ " + e.message);
      if (/403/.test(e.message)) { console.error("    ~/.ytgrab.json доторх token-оо шалга."); process.exit(1); }
      await sleep(8000);
    }
  }
}

main();
