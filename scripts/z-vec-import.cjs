/* /z voice санах ой: 1percent_mindset_dataset.jsonl → zvecs (kind "voice").
   Пост бүрийг хувийн мэдээлэлгүй болгож (lib/z/vectors.ts scrub-тэй ижил),
   векторжуулна. Давтаж ажиллуулахад аюулгүй (ref-ээр upsert). */
const fs = require("fs");
const mongoose = require("mongoose");
/* node scripts/z-vec-import.cjs <file> [openai|gemini] — орон зай бүр тусдаа ref-тэй (gemini: «g:voice:…»),
   lib/z/vectors.ts SPACES-тэй ижил. Квот/кредит дуусвал зогсоно; дахин ажиллуулахад үлдсэнийг нь хийнэ. */
const PROVIDER = process.argv[3] === "gemini" ? "gemini" : "openai";
const SP = PROVIDER === "gemini"
  ? { model: "google/gemini-embedding-001@512", prefix: "g:", url: "https://generativelanguage.googleapis.com/v1beta/openai/embeddings", key: process.env.GEMINI_API_KEY, api: "gemini-embedding-001", batch: 64 }
  : { model: "openai/text-embedding-3-small@512", prefix: "", url: "https://api.openai.com/v1/embeddings", key: process.env.OPENAI_API_KEY, api: "text-embedding-3-small", batch: 96 };
const EMB_MODEL = SP.model;
const file = process.argv[2];

const scrub = (t) => t
  .replace(/https?:\/\/\S+|www\.\S+/gi, "[линк]")
  .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[имэйл]")
  .replace(/(^|[^\w])@[\w.]{2,}/g, "$1[хаяг]")
  .replace(/\b\d{10,}\b/g, "[тоо]")
  .replace(/(\+?976[\s-]?)?\b[5-9]\d{3}[\s-]?\d{4}\b/g, "[утас]")
  .replace(/(намайг|миний нэрийг|миний нэр)\s+[А-ЯӨҮЁA-Z][\p{L}-]{1,20}/giu, "$1 [нэр]");

const norm = (v) => { let s = 0; for (const x of v) s += x * x; const n = Math.sqrt(s) || 1; return v.map((x) => x / n); };

async function embed(texts) {
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(SP.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${SP.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: SP.api, input: texts, dimensions: 512 }),
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok) return d.data.map((x) => norm(x.embedding));
    if (attempt >= 6 || /quota|credit|billing/i.test(String(d?.error?.message))) throw new Error(`embedding ${r.status}: ${String(d?.error?.message).slice(0, 200)}`);
    await new Promise((res) => setTimeout(res, 3000 * (attempt + 1)));
  }
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const col = mongoose.connection.db.collection("zvecs");
  const rows = [];
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    const p = JSON.parse(line);
    const text = scrub(String(p.text || "")).replace(/\s+/g, " ").trim().slice(0, 1200);
    if (text.length < 60) continue;
    rows.push({
      ref: `${SP.prefix}voice:${p.id}`,
      text,
      meta: {
        pid: p.id,
        focus: p.mindset?.focus || [],
        archetype: p.mindset?.archetype || null,
        stage: p.mindset?.stage || null,
        blocks: p.mindset?.blocks || [],
        script: p.voice?.script || null,
        date: p.date || null,
      },
    });
  }
  const have = new Set((await col.find({ kind: "voice", embModel: EMB_MODEL }, { projection: { ref: 1 } }).toArray()).map((d) => d.ref));
  const todo = rows.filter((r) => !have.has(r.ref));
  console.log(PROVIDER, "posts", rows.length, "already", have.size, "todo", todo.length);
  let done = 0;
  for (let i = 0; i < todo.length; i += SP.batch) {
    const batch = todo.slice(i, i + SP.batch);
    const vecs = await embed(batch.map((r) => r.text));
    const now = new Date();
    await col.bulkWrite(batch.map((r, j) => ({
      updateOne: {
        filter: { ref: r.ref },
        update: { $set: { kind: "voice", user: null, text: r.text, meta: r.meta, vector: vecs[j], embModel: EMB_MODEL, updatedAt: now }, $setOnInsert: { createdAt: now } },
        upsert: true,
      },
    })));
    done += batch.length;
    if (done % (SP.batch * 10) === 0 || done === todo.length) console.log("embedded", done);
  }
  await col.createIndex({ ref: 1 }, { unique: true, sparse: true });
  await col.createIndex({ kind: 1, user: 1 });
  console.log("total voice", PROVIDER, await col.countDocuments({ kind: "voice", embModel: EMB_MODEL }));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
