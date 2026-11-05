import { NextRequest, NextResponse } from "next/server";
import type { Model } from "mongoose";
import dbConnect from "@/lib/mongodb";
import { TuqorConfig, TuqorPost, TuqorVec } from "@/models/Tuqor";
import { AgentNote, AgentAudience, AgentProduct, AgentRule, AgentMedia, AgentPersona } from "@/models/AgentStudio";
import { AgentWorkspace, AgentConn } from "@/models/AgentWorkspace";
import SocialPost from "@/models/SocialPost";
import ThreadsToken from "@/models/ThreadsToken";
import MetaOAuthToken from "@/models/MetaOAuthToken";
import MetaPage from "@/models/MetaPage";
import { listMetaTargets } from "@/lib/socialPublish";
import { getConfig, lessons, ASKS } from "@/lib/tuqor";
import { createVariants, postOp, planWeek, buildCognitive, agentTick, hourly, ensureRules, polish, embedNotes, GENERIC_DEFAULT, mediaCreate, imageGen, googleDown, mediaToPost, mediaDelete, pollMedia, spentToday, studioRun, studioPack, motionRun, productMainImage, analyzeImage, personaCreate, personaOp, twinAnalyze, twinCreate, twinDress, twinRegen, twinProfileSave, wardrobeFor } from "@/lib/agentStudio";
import { AgentWardrobe } from "@/models/AgentStudio";
import { importReel, ownReels } from "@/lib/reelImport";
import { HF_PUBLIC, hfReady, hfModel } from "@/lib/hfMedia";
import { wsContext, canWrite, saveBusiness, trialSeats, wsConns, planOf, gensLeft, MAIN, TRIAL_MEDIA_USD, BUSINESS_MEDIA_USD, BUSINESS_PRICE, BUSINESS_DAYS, type WsCtx } from "@/lib/agentWs";
import { EMB_MODEL } from "@/lib/embeddings";
import { DAY, ub } from "@/lib/contentAgentRules";
import User from "@/models/User";
import { getEcon } from "@/lib/creditEconomicsServer";
import { refundFailedStudio } from "@/lib/studioCredits";

/* Antaqor Agent — нэг API (/content-agent). 2026-10-24: олон байгууллага (workspace).
   2026-10-26: эзэн/админ → "main"; бизнес багц (99,000₮/сар) → бүх боломж;
   Antaqor-ийн төлбөртэй гишүүн → зөвхөн AI зураг + AI ихэр (MEMBER_OK). */
export const dynamic = "force-dynamic";
export const maxDuration = 300;
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });
const str = (v: unknown, n = 2000) => String(v ?? "").slice(0, n);
const arr = (v: unknown, n = 8) => (Array.isArray(v) ? v : []).map((x) => str(x, 400)).filter(Boolean).slice(0, n);
const prof = (v: unknown) => { const o = (v || {}) as Record<string, unknown>; return { gender: str(o.gender, 20), age: str(o.age, 40), eyeColor: str(o.eyeColor, 60), hair: str(o.hair, 200), skin: str(o.skin, 200), build: str(o.build, 200), dna: str(o.dna, 1600) }; };
const FB = "https://graph.facebook.com/v21.0";

/* Хуучин (Tuqor үеийн) постуудад шинэ талбарууд алга — клиент хэзээ ч undefined-д унахгүй */
type Row = Record<string, unknown> & { _id: unknown };
function normPost(p: Row) {
  return {
    kind: "text", imageUrl: "", videoUrl: "", mediaId: "", mediaState: "", queued: false, fixes: [], generic: [], origin: { src: "", sid: "" }, angle: "", variantGroup: "",
    audience: "", metaAccount: "", threadsUserId: "", infographic: null, snaps: { h1: -1, h6: -1, h24: -1 }, idea: "", holdReason: "", day: "",
    ...p,
    pred: { score: 0, novelty: 1, base: 0, nn: [], ...((p.pred as object) || {}) },
    metrics: { likes: 0, comments: 0, shares: 0, views: 0, score: 0, at: null, ...((p.metrics as object) || {}) },
    results: Array.isArray(p.results) ? p.results : [], platforms: Array.isArray(p.platforms) ? p.platforms : [],
    _id: String(p._id),
  };
}

async function accounts(c: WsCtx) {
  if (c.ws === MAIN) {
    const [metas, threads] = await Promise.all([
      listMetaTargets().catch(() => []),
      ThreadsToken.find({}).select("threadsUserId username status").lean<{ threadsUserId: string; username?: string; status?: string }[]>(),
    ]);
    return { meta: metas.map((m) => ({ key: m.key, label: m.label, facebook: !!m.pageId, instagram: !!m.igId, igUsername: "" })), threads: threads.map((t) => ({ id: t.threadsUserId, username: t.username || "", ok: t.status !== "reconnect_needed" })) };
  }
  const w = await wsConns(c.ws);
  return { meta: w.meta.map((m) => ({ key: m.key, label: m.label, facebook: true, instagram: !!m.igId, igUsername: m.igUsername })), threads: w.threads.map((t) => ({ id: t.id, username: t.username, ok: t.status !== "reconnect_needed" })) };
}
function me(c: WsCtx) {
  const w = c.workspace;
  return {
    ws: c.ws, plan: c.plan, mode: c.mode, isMember: c.isMember, daysLeft: c.daysLeft, superAdmin: c.superAdmin, name: c.name, email: c.email, viewingAs: c.viewingAs,
    business: w?.business || null, trialEndsAt: w?.trialEndsAt || null, paidUntil: w?.paidUntil || null,
    gensLeft: gensLeft(c), price: BUSINESS_PRICE, days: BUSINESS_DAYS,
  };
}

/** Кредит (2026-10-26): үлдэгдэл + үнэ тооцох параметр. Эзэн/админ үнэгүй. */
async function creditInfo(c: WsCtx) {
  const [e, u] = await Promise.all([getEcon(), User.findById(c.userId).select("credits").lean<{ credits?: number }>()]);
  return { balance: u?.credits || 0, fx: e.fx, markup: e.markup, lowAt: e.lowAt, free: c.admin };
}

export async function GET(req: NextRequest) {
  await dbConnect();
  const c = await wsContext(req);
  const seats = await trialSeats();
  if (!c) return NextResponse.json({ error: "UNAUTH", seats }, { status: 401 });
  /* Супер админ — туршилтын байгууллагууд */
  if (req.nextUrl.searchParams.get("admin") === "1") {
    if (!c.superAdmin) return fail("Зөвхөн эзэн", 403);
    const list = await AgentWorkspace.find({}).sort({ createdAt: -1 }).lean();
    const ids = list.map((w) => w.wsId);
    const [posts, pubs, conns] = await Promise.all([
      TuqorPost.aggregate([{ $match: { ws: { $in: ids }, status: { $ne: "deleted" } } }, { $group: { _id: "$ws", n: { $sum: 1 } } }]),
      TuqorPost.aggregate([{ $match: { ws: { $in: ids }, status: "published" } }, { $group: { _id: "$ws", n: { $sum: 1 } } }]),
      AgentConn.aggregate([{ $match: { ws: { $in: ids } } }, { $group: { _id: { ws: "$ws", p: "$platform" }, n: { $sum: 1 } } }]),
    ]);
    const n = (arr: { _id: unknown; n: number }[], ws: string) => arr.find((x) => x._id === ws)?.n || 0;
    return NextResponse.json({
      seats,
      workspaces: list.map((w) => ({
        wsId: w.wsId, name: w.name, ownerEmail: w.ownerEmail, ownerName: w.ownerName, plan: planOf(w as never).plan, daysLeft: planOf(w as never).daysLeft, rawPlan: w.plan,
        trialEndsAt: w.trialEndsAt, createdAt: w.createdAt, lastActiveAt: w.lastActiveAt, about: w.business?.about || "", adminNote: w.adminNote || "",
        posts: n(posts, w.wsId), published: n(pubs, w.wsId), gensTotal: w.usage?.total || 0,
        meta: conns.filter((x) => x._id.ws === w.wsId && x._id.p === "meta").reduce((a, x) => a + x.n, 0), threads: conns.filter((x) => x._id.ws === w.wsId && x._id.p === "threads").reduce((a, x) => a + x.n, 0),
      })),
    });
  }
  /* Гишүүнчлэлгүй, бизнес багцгүй → сонголтын дэлгэц (гишүүн болох / бизнес 99,000₮) */
  if (!c.ws) return NextResponse.json({ paywall: true, me: { ...me(c), credit: await creditInfo(c) }, seats });
  /* Бизнес багц идэвхжсэн боловч профайлаа бөглөөгүй → онбординг (төлбөрийн дараа) */
  if (c.mode === "business" && c.ws !== MAIN && !c.viewingAs && c.plan !== "expired" && !c.workspace?.business?.about) return NextResponse.json({ onboarding: true, me: me(c), seats });

  const ws = c.ws;
  await refundFailedStudio().catch(() => 0);
  await ensureRules(ws);
  const cfg = await getConfig(ws);
  if (ws === MAIN) {
    /* анхны audience, бүтээгдэхүүн (хуучин Tuqor-ын санал) */
    if (!(await AgentAudience.exists({ ws }))) await AgentAudience.insertMany([
      { ws, name: "Эхлэгч AI creator", isDefault: true, who: "18–30 насны, контент хийж эхэлж буй, ChatGPT-г хааяа ашигладаг залуус", pains: "AI-г зөвхөн чатлахад ашигладаг, систем алга, юунаас эхлэхээ мэдэхгүй, цаг дутдаг", desires: "AI-аар контент, зураг, видео, брэнд хурдан бүтээж орлого олох", level: "Анхан–дунд" },
      { ws, name: "Бизнес эрхлэгч / маркетер", who: "Жижиг бизнес, брэндийн эзэд, маркетерууд", pains: "Контент тогтмол гаргах хүн хүч, цаг алга; агентлагийн зардал өндөр", desires: "AI-аар маркетингийн контентоо автоматжуулж борлуулалт өсгөх", level: "AI-г ашиглаж эхэлсэн" },
    ]);
    if (!(await AgentProduct.exists({ ws })) && cfg.offers?.length) await AgentProduct.insertMany(cfg.offers.map((o) => ({ ws, name: o.name, pitch: o.pitch, cta: o.cta, link: "antaqor.com", active: true })));
  }
  const now = Date.now();
  const [posts, others, notes, audiences, products, rules, top, vectors, learned, acc, media, spent, personas, wardrobe] = await Promise.all([
    TuqorPost.find({ ws, status: { $ne: "deleted" } }).sort({ createdAt: -1 }).limit(240).lean(),
    ws === MAIN
      ? SocialPost.find({ ws: { $in: ["", null] }, state: { $in: ["scheduled", "publishing", "published"] }, brief: { $not: /^\[(TUQOR|ANTAQOR AGENT)/ }, $or: [{ scheduledAt: { $gte: new Date(now - 7 * DAY), $lte: new Date(now + 21 * DAY) } }, { scheduledAt: null, createdAt: { $gte: new Date(now - 7 * DAY) } }] }).select("text brief platforms state scheduledAt createdAt").limit(120).lean()
      : Promise.resolve([]),
    AgentNote.find({ ws }).sort({ updatedAt: -1 }).limit(300).lean(),
    AgentAudience.find({ ws }).sort({ createdAt: 1 }).lean(),
    AgentProduct.find({ ws }).sort({ createdAt: 1 }).lean(),
    AgentRule.find({ ws }).sort({ hour: 1, minute: 1 }).lean(),
    TuqorVec.find({ ws, source: "own" }).sort({ score: -1 }).limit(40).select("key text score likes comments views postedAt platform").lean(),
    TuqorVec.countDocuments({ ws, embModel: EMB_MODEL }),
    lessons(ws),
    accounts(c),
    AgentMedia.find({ ws }).sort({ createdAt: -1 }).limit(120).select("-job").lean(),
    spentToday(ws),
    AgentPersona.find({ ws }).sort({ createdAt: 1 }).lean(),
    wardrobeFor(ws),
  ]);
  const pub = posts.filter((p) => p.status === "published" && p.evaluated);
  const avg = (a: number[]) => (a.length ? Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10 : 0);
  return NextResponse.json({
    now: new Date(), ask: ws === MAIN ? ASKS[ub(new Date()).wd % ASKS.length] : "Өнөөдөр юуны тухай нийтлэх вэ? Шинэ бүтээгдэхүүн, хэрэгтэй зөвлөгөө, үйлчлүүлэгчийн асуулт — аль нь ч болно.",
    me: { ...me(c), credit: await creditInfo(c) }, seats,
    cfg: { auto: cfg.auto, channels: cfg.channels, examples: cfg.examples || [], generic: cfg.generic?.length ? cfg.generic : GENERIC_DEFAULT, spellFix: cfg.spellFix !== false, runHour: cfg.runHour, cognitive: cfg.cognitive?.summary ? cfg.cognitive : null, accounts: cfg.accounts || { metaAccount: "", threadsUserId: "" }, lastHourlyAt: cfg.lastHourlyAt, lastSyncAt: cfg.lastSyncAt, media: cfg.media },
    posts: posts.map((p) => normPost(p as unknown as Row)),
    others: others.map((o) => ({ _id: String(o._id), at: o.scheduledAt || o.createdAt, text: o.text, brief: o.brief, platforms: o.platforms, state: o.state })),
    notes: notes.map((n) => ({ ...n, _id: String(n._id) })),
    audiences: audiences.map((a) => ({ ...a, _id: String(a._id) })),
    products: products.map((a) => ({ ...a, _id: String(a._id) })),
    rules: rules.map((a) => ({ ...a, _id: String(a._id) })),
    top: top.map((t) => ({ key: t.key, text: t.text, score: t.score, likes: t.likes, comments: t.comments, views: t.views, postedAt: t.postedAt, platform: t.platform })),
    stats: { vectors, published: posts.filter((p) => p.status === "published").length, avgActual: avg(pub.map((p) => p.metrics?.score || 0)), avgPred: avg(pub.map((p) => p.pred?.score || 0)), evaluated: pub.length },
    learned,
    accounts: acc,
    media: media.map((m) => ({ ...m, _id: String(m._id) })),
    personas: personas.map((x) => ({ _id: String(x._id), name: x.name, photos: x.photos, sheetUrl: x.sheetUrl, status: x.status, error: x.error, isDefault: x.isDefault, faces: x.faces || [], bodies: x.bodies || [], hands: x.hands || [], styleRef: x.styleRef || "", profile: x.profile || null, style: x.style || "hyper", palette: x.palette || "dark_blue", expr: x.expr || "calm", outfit: x.outfit || [], outfitLabels: x.outfitLabels || [], sheets: x.sheets || [] })),
    wardrobe,
    hf: { ready: hfReady(), spentToday: spent, models: HF_PUBLIC, google: !(await googleDown()) },
  });
}

/* Бичих эрх шаардахгүй үйлдлүүд (туршилт дууссан ч хийж болно) */
const FREE = new Set(["business", "conn-pages", "conn-meta", "conn-remove", "media-poll", "config", "reel-list"]);
/* Гишүүний горимд зөвшөөрөгдөх үйлдлүүд — AI зураг + AI ихэр (2026-10-26). Бусад нь бизнес багц. */
const MEMBER_OK = new Set(["image-gen", "media", "media-poll", "media-del", "twin-analyze", "twin-create", "twin-dress", "twin-regen", "twin-profile", "wardrobe", "persona"]);

export async function POST(req: NextRequest) {
  await dbConnect();
  const c = await wsContext(req);
  if (!c) return fail("UNAUTH", 401);
  const b = await req.json().catch(() => ({}));
  try {
    /* ── онбординг: шинэ байгууллага ── */
    if (b.action === "onboard") {
      /* 2026-10-26: туршилтгүй — профайлыг зөвхөн бизнес багц идэвхжсэний дараа бөглөнө */
      if (c.admin && !c.viewingAs) return fail("Админ эзний workspace-ийг ашиглана");
      if (!c.ws || c.mode !== "business" || c.ws === MAIN) return fail("Эхлээд бизнес багцаа идэвхжүүлнэ үү", 402);
      const d = b.business || {};
      if (str(d.name, 80).trim().length < 2 || str(d.about, 1500).trim().length < 10) return fail("Бизнесийн нэр, юу хийдгээ товч бичнэ үү");
      const biz = await saveBusiness(c.ws, { name: str(d.name, 80), about: str(d.about, 1500), audience: str(d.audience, 600), tone: str(d.tone, 120), brandColor: str(d.brandColor, 7), logoUrl: str(d.logoUrl, 300), website: str(d.website, 200), contact: str(d.contact, 200) });
      await getConfig(c.ws);
      if (biz.audience && !(await AgentAudience.exists({ ws: c.ws }))) await AgentAudience.create({ ws: c.ws, name: "Миний хэрэглэгчид", who: biz.audience, isDefault: true });
      await ensureRules(c.ws);
      return NextResponse.json({ ok: true, ws: c.ws });
    }
    /* ── супер админ: туршилт удирдах ── */
    if (b.action === "ws-admin") {
      if (!c.superAdmin) return fail("Зөвхөн эзэн", 403);
      const id = str(b.wsId, 40), op = str(b.op, 20);
      const set: Record<string, unknown> = op === "extend" ? { plan: "trial", trialEndsAt: new Date(Math.max(Date.now(), +new Date((await AgentWorkspace.findOne({ wsId: id }).select("trialEndsAt").lean())?.trialEndsAt || Date.now())) + 7 * DAY) }
        : op === "activate" ? { plan: "active", paidUntil: new Date(Date.now() + BUSINESS_DAYS * DAY) } : op === "expire" ? { plan: "expired" } : op === "admit" ? { plan: "trial", trialEndsAt: new Date(Date.now() + 14 * DAY) } : op === "note" ? { adminNote: str(b.note, 500) } : {};
      if (!Object.keys(set).length) return fail("Үйлдэл буруу");
      await AgentWorkspace.updateOne({ wsId: id }, { $set: set });
      return NextResponse.json({ ok: true });
    }
    if (!c.ws) return fail("Гишүүнчлэл эсвэл бизнес багц шаардлагатай", 402);
    const ws = c.ws;
    /* гишүүнд «media» зөвхөн AI видео (Kling 4.0 гэх мэт, кредитээр) — Genjutsu/засвар бизнест */
    if (c.mode === "member" && b.action === "media" && (hfModel(str(b.model, 40))?.kind !== "video" || b.personaId)) return fail(`Энэ бол бизнес багцын боломж — ${BUSINESS_PRICE.toLocaleString("en-US")}₮/сар`, 402);
    if (c.mode === "member" && (!MEMBER_OK.has(b.action) || (b.action === "persona" && b.op === "create"))) return fail(`Энэ бол бизнес багцын боломж — ${BUSINESS_PRICE.toLocaleString("en-US")}₮/сар`, 402);
    if (!FREE.has(b.action)) { const deny = canWrite(c); if (deny) return fail(deny, 402); }

    switch (b.action) {
      case "create": return NextResponse.json({ ok: true, ...(await createVariants({ ...(b.input || {}), ws })) });
      case "post": return NextResponse.json({ ok: true, ...(await postOp(str(b.id, 40), str(b.op, 20), { ...b, ws })) });
      case "plan": return NextResponse.json({ ok: true, ...(await planWeek({ ws, prompt: str(b.prompt, 2000), platforms: Array.isArray(b.platforms) ? b.platforms : ["threads"], perDay: Number(b.perDay) || 2, audienceId: b.audienceId || undefined, days: Number(b.days) || 7 })) });
      case "polish": { const cfg = await getConfig(ws); const [r] = await polish([str(b.text, 3000)], { spell: true, generic: cfg.generic?.length ? cfg.generic : GENERIC_DEFAULT }); return NextResponse.json({ ok: true, ...r }); }
      case "cognitive": return NextResponse.json({ ok: true, cognitive: await buildCognitive(ws) });
      case "run": return NextResponse.json({ ok: true, ...(ws === MAIN ? { hourly: await hourly(true), tick: await agentTick() } : {}) });
      case "image-gen": return NextResponse.json({ ok: true, ...(await imageGen({ ws, model: str(b.model, 20), prompt: str(b.prompt, 2000), enhance: b.enhance !== false, ratio: str(b.ratio, 10), res: str(b.res, 10), q: str(b.q, 10), count: Number(b.count) || 1, refs: (Array.isArray(b.refs) ? b.refs : []).map((x: unknown) => str(x, 300)).filter(Boolean), personaIds: (Array.isArray(b.personaIds) ? b.personaIds : []).map((x: unknown) => str(x, 40)).filter(Boolean) })) });
      case "media": return NextResponse.json({ ok: true, ...(await mediaCreate({ ws, personaId: str(b.personaId, 40) || undefined, model: str(b.model, 40), prompt: str(b.prompt, 2000), enhance: b.enhance !== false, ratio: str(b.ratio, 10), res: str(b.res, 10), dur: Number(b.dur) || undefined, imageUrl: str(b.imageUrl, 300) || undefined, videoUrl: str(b.videoUrl, 300) || undefined, imageUrls: (Array.isArray(b.imageUrls) ? b.imageUrls : []).map((x: unknown) => str(x, 300)).filter(Boolean), refDur: Number(b.refDur) || undefined })) });
      case "media-poll": return NextResponse.json({ ok: true, ...(await pollMedia()) });
      case "media-post": return NextResponse.json({ ok: true, ...(await mediaToPost(str(b.id, 40), { ws, idea: str(b.idea, 1500), count: Number(b.count) || 1, audienceId: b.audienceId || undefined, platforms: Array.isArray(b.platforms) ? b.platforms : undefined })) });
      case "media-del": return NextResponse.json({ ok: true, ...(await mediaDelete(str(b.id, 40), ws)) });
      /* ── бүтээгдэхүүний студи ── */
      case "studio": return NextResponse.json({ ok: true, ...(await studioRun({ ws, preset: str(b.preset, 30), imageUrl: str(b.imageUrl, 400), productId: str(b.productId, 40) || undefined, hq: !!b.hq, note: str(b.note, 300), items: (Array.isArray(b.items) ? b.items : []).map((x: unknown) => str(x, 300)), category: str(b.category, 20), personaId: str(b.personaId, 40) || undefined })) });
      case "studio-pack": return NextResponse.json({ ok: true, ...(await studioPack({ ws, imageUrl: str(b.imageUrl, 400), productId: str(b.productId, 40) || undefined, category: str(b.category, 20), items: (Array.isArray(b.items) ? b.items : []).map((x: unknown) => str(x, 300)) })) });
      case "analyze": return NextResponse.json({ ok: true, analysis: await analyzeImage({ ws, imageUrl: str(b.imageUrl, 400), productId: str(b.productId, 40) || undefined, force: !!b.force }) });
      /* ── AI ихэр ── */
      case "twin-analyze": return NextResponse.json({ ok: true, profile: await twinAnalyze({ ws, faces: arr(b.faces), bodies: arr(b.bodies) }) });
      case "twin-create": return NextResponse.json({ ok: true, ...(await twinCreate({ ws, ok: !!b.ok, name: str(b.name, 40), faces: arr(b.faces), bodies: arr(b.bodies), hands: arr(b.hands), styleRef: str(b.styleRef, 400), profile: prof(b.profile), style: b.style, palette: b.palette, expr: b.expr, outfit: arr(b.outfit), outfitLabels: arr(b.outfitLabels), sheets: arr(b.sheets) as ("head" | "body" | "sculpt")[] })) });
      case "twin-dress": return NextResponse.json({ ok: true, ...(await twinDress({ ws, id: str(b.id, 40), items: arr(b.items), labels: arr(b.labels), mode: b.mode === "photo" ? "photo" : "outfit", scene: str(b.scene, 400), save: !!b.save })) });
      case "twin-regen": return NextResponse.json({ ok: true, ...(await twinRegen({ ws, id: str(b.id, 40), kind: ["head", "body", "sculpt"].includes(b.kind) ? b.kind : "body", style: b.style || undefined, palette: b.palette || undefined, expr: b.expr || undefined })) });
      case "twin-profile": return NextResponse.json({ ok: true, ...(await twinProfileSave(ws, str(b.id, 40), prof(b.profile), str(b.name, 40))) });
      case "wardrobe": {
        if (b.op === "remove") { await AgentWardrobe.deleteOne({ _id: str(b.id, 40), ws }); return NextResponse.json({ ok: true }); }
        const url = str(b.url, 400);
        if (!/^\/uploads\//.test(url)) return fail("Зураг буруу");
        await AgentWardrobe.create({ ws, url, label: str(b.label, 60) || "Хувцас", part: str(b.part, 20) });
        return NextResponse.json({ ok: true });
      }
      case "persona": return NextResponse.json({ ok: true, ...(b.op === "create" ? await personaCreate({ ws, name: str(b.name, 40), photos: (Array.isArray(b.photos) ? b.photos : []).map((x: unknown) => str(x, 400)) }) : await personaOp(ws, str(b.id, 40), str(b.op, 20), { name: str(b.name, 40) })) });
      case "motion": return NextResponse.json({ ok: true, ...(await motionRun({ ws, preset: str(b.preset, 30), imageUrl: str(b.imageUrl, 400), productId: str(b.productId, 40) || undefined, dur: Number(b.dur) || 5, note: str(b.note, 300) })) });
      case "product-main": return NextResponse.json({ ok: true, ...(await productMainImage(ws, str(b.productId, 40), str(b.url, 400))) });
      case "gallery-remove": { await AgentProduct.updateOne({ _id: str(b.productId, 40), ws }, { $pull: { gallery: { url: str(b.url, 400) } } }); return NextResponse.json({ ok: true }); }
      /* ── Reel / TikTok → Genjutsu ── */
      case "reel-import": return NextResponse.json({ ok: true, ...(await importReel(ws, str(b.url, 600))) });
      case "reel-list": return NextResponse.json({ ok: true, reels: await ownReels(ws) });
      case "note": {
        if (b.op === "delete") { await AgentNote.deleteOne({ _id: str(b.id, 40), ws }); embedNotes(ws).catch(() => {}); return NextResponse.json({ ok: true }); }
        const doc = { title: str(b.title, 200), body: str(b.body, 20000), tags: (Array.isArray(b.tags) ? b.tags : []).map((t: unknown) => str(t, 40)).filter(Boolean).slice(0, 12) };
        const n = b.id ? await AgentNote.findOneAndUpdate({ _id: str(b.id, 40), ws }, { $set: doc }, { new: true }).lean() : (await AgentNote.create({ ...doc, ws })).toObject();
        if (!n) return fail("Тэмдэглэл олдсонгүй");
        embedNotes(ws).catch(() => {});
        return NextResponse.json({ ok: true, note: { ...n, _id: String(n._id) } });
      }
      case "audience": case "product": case "rule": {
        /* Mongoose-ийн 3 моделийг union болгож cast хийх нь TypeScript-ийг (build) санах ойгоор дүүргэдэг — unknown-оор дамжуулна */
        const M = (b.action === "audience" ? AgentAudience : b.action === "product" ? AgentProduct : AgentRule) as unknown as Model<Record<string, unknown>>;
        if (b.op === "delete") { await M.deleteOne({ _id: str(b.id, 40), ws }); return NextResponse.json({ ok: true }); }
        const d = b.doc || {};
        let doc: Record<string, unknown>;
        if (b.action === "audience") doc = { name: str(d.name, 80), who: str(d.who, 600), pains: str(d.pains, 600), desires: str(d.desires, 600), level: str(d.level, 200), isDefault: !!d.isDefault };
        else if (b.action === "product") doc = { name: str(d.name, 120), pitch: str(d.pitch, 1500), price: str(d.price, 120), link: str(d.link, 300), cta: str(d.cta, 300), imageUrl: str(d.imageUrl, 300), active: d.active !== false };
        else doc = { name: str(d.name, 120), active: d.active !== false, days: (Array.isArray(d.days) ? d.days : []).map(Number).filter((x: number) => x >= 0 && x <= 6), hour: Math.max(0, Math.min(23, Number(d.hour) || 0)), minute: Math.max(0, Math.min(59, Number(d.minute) || 0)), format: ["spark", "value", "offer", "infographic", "image", "video"].includes(d.format) ? d.format : "spark", source: ["auto", "notebook", "top", "product"].includes(d.source) ? d.source : "auto", topic: str(d.topic, 500), audienceId: str(d.audienceId, 40), productId: str(d.productId, 40), platforms: (Array.isArray(d.platforms) ? d.platforms : ["threads"]).filter((p: string) => ["threads", "facebook", "instagram"].includes(p)) };
        if (!doc.name) return fail("Нэр оруулна уу");
        if (b.action === "audience" && doc.isDefault) await AgentAudience.updateMany({ ws }, { $set: { isDefault: false } });
        const saved = b.id ? await M.findOneAndUpdate({ _id: str(b.id, 40), ws }, { $set: doc }, { new: true }).lean() : (await M.create({ ...doc, ws })).toObject();
        if (!saved) return fail("Олдсонгүй");
        return NextResponse.json({ ok: true, doc: { ...saved, _id: String((saved as { _id?: unknown })?._id) } });
      }
      case "config": {
        const cc = b.config || {}; const set: Record<string, unknown> = {};
        if (typeof cc.auto === "boolean") set.auto = cc.auto;
        if (typeof cc.spellFix === "boolean") set.spellFix = cc.spellFix;
        if (Array.isArray(cc.channels)) set.channels = cc.channels.filter((x: string) => ["threads", "facebook", "instagram"].includes(x));
        if (Array.isArray(cc.examples)) set.examples = cc.examples.map((x: unknown) => str(x, 600)).filter(Boolean).slice(0, 16);
        if (Array.isArray(cc.generic)) set.generic = cc.generic.map((x: unknown) => str(x, 80).trim().toLowerCase()).filter(Boolean).slice(0, 80);
        if (cc.runHour !== undefined) set.runHour = Math.max(0, Math.min(23, Number(cc.runHour) || 8));
        if (cc.accounts) set.accounts = { metaAccount: str(cc.accounts.metaAccount, 80), threadsUserId: str(cc.accounts.threadsUserId, 80) };
        if (cc.media) {
          const cur = (await getConfig(ws)).media;
          /* туршилтын хэрэглэгч медиа зардлын хязгаарыг өөрөө өсгөхгүй (эзний Higgsfield данс) */
          /* бизнес багц өдөрт $2 хүртэл (эзний Higgsfield данс); эзэн 200 хүртэл */
          const dailyUsd = ws === MAIN ? Math.max(0, Math.min(200, Number(cc.media.dailyUsd) || 0)) : c.plan === "active" ? Math.max(0, Math.min(BUSINESS_MEDIA_USD, Number(cc.media.dailyUsd) || 0)) : Math.min(TRIAL_MEDIA_USD, cur.dailyUsd);
          set.media = { imageModel: str(cc.media.imageModel, 40) || "soul2", videoModel: str(cc.media.videoModel, 40) || "wan3", videoRes: str(cc.media.videoRes, 10) || "720p", videoDur: Math.max(2, Math.min(30, Number(cc.media.videoDur) || 5)), ratio: str(cc.media.ratio, 10) || "9:16", dailyUsd };
        }
        if (set.auto === true && c.plan === "expired") return fail("Туршилт дууссан — автомат асаах боломжгүй", 402);
        await getConfig(ws); await TuqorConfig.updateOne({ key: ws }, { $set: set });
        return NextResponse.json({ ok: true });
      }
      case "business": {
        if (ws === MAIN) return fail("Эзний workspace-д бизнесийн профайл хэрэггүй");
        const d = b.business || {};
        const business = { name: str(d.name, 80), about: str(d.about, 1500), audience: str(d.audience, 600), tone: str(d.tone, 120), brandColor: /^#[0-9a-f]{6}$/i.test(str(d.brandColor, 7)) ? str(d.brandColor, 7) : "", logoUrl: str(d.logoUrl, 300), website: str(d.website, 200), contact: str(d.contact, 200) };
        if (business.name.trim().length < 2) return fail("Нэр оруулна уу");
        await AgentWorkspace.updateOne({ wsId: ws }, { $set: { business, name: business.name } });
        return NextResponse.json({ ok: true });
      }
      /* ── сошиал холболт ── */
      case "conn-pages": {
        const row = await MetaOAuthToken.findOne({ email: c.email }).lean<{ userToken: string; expiresAt: Date }>();
        if (!row?.userToken || (row.expiresAt && +new Date(row.expiresAt) < Date.now())) return NextResponse.json({ ok: true, pages: [], needsAuth: true });
        const acc = await fetch(`${FB}/me/accounts?fields=id,name,picture%7Burl%7D,instagram_business_account%7Bid,username%7D&limit=100&access_token=${encodeURIComponent(row.userToken)}`).then((r) => r.json()).catch(() => ({}));
        if (!Array.isArray(acc.data)) return NextResponse.json({ ok: true, pages: [], needsAuth: true, error: String(acc.error?.message || "") });
        const have = ws === MAIN ? new Set((await MetaPage.find({}).select("pageId").lean<{ pageId: string }[]>()).map((x) => x.pageId)) : new Set((await AgentConn.find({ ws, platform: "meta" }).select("pageId").lean<{ pageId: string }[]>()).map((x) => x.pageId));
        return NextResponse.json({ ok: true, pages: acc.data.map((p: { id: string; name?: string; picture?: { data?: { url?: string } }; instagram_business_account?: { id?: string; username?: string } }) => ({ id: String(p.id), name: p.name || p.id, picture: p.picture?.data?.url || "", igId: p.instagram_business_account?.id || "", igUsername: p.instagram_business_account?.username || "", connected: have.has(String(p.id)) })) });
      }
      case "conn-meta": {
        const pageId = str(b.pageId, 40).trim();
        const row = await MetaOAuthToken.findOne({ email: c.email }).lean<{ userToken: string }>();
        if (!pageId || !row?.userToken) return fail("Эхлээд Facebook-ээр нэвтэрнэ үү");
        const list = await fetch(`${FB}/me/accounts?fields=id,access_token&limit=100&access_token=${encodeURIComponent(row.userToken)}`).then((r) => r.json()).catch(() => ({}));
        const pageToken = String((Array.isArray(list.data) ? list.data.find((p: { id: string }) => String(p.id) === pageId) : null)?.access_token || "");
        if (!pageToken) return fail("Энэ хуудасны эрх олдсонгүй — Facebook-ээр дахин холбоно уу");
        const info = await fetch(`${FB}/${pageId}?fields=name,instagram_business_account%7Bid,username%7D&access_token=${encodeURIComponent(pageToken)}`).then((r) => r.json()).catch(() => ({}));
        const name = String(info.name || pageId), igId = String(info.instagram_business_account?.id || ""), igUsername = String(info.instagram_business_account?.username || "");
        if (ws === MAIN) {
          /* эзэн — хуучин MetaPage (DM бот УНТРААЛТТАЙ, түлхүүрийг дарж бичихгүй) */
          await MetaPage.findOneAndUpdate({ pageId }, { $setOnInsert: { key: pageId }, pageId, name, igBusinessId: igId, pageAccessToken: pageToken, enabled: true, connectedByEmail: c.email }, { new: true, upsert: true, setDefaultsOnInsert: true });
        } else {
          await AgentConn.findOneAndUpdate({ platform: "meta", key: `${ws}:${pageId}` }, { ws, platform: "meta", key: `${ws}:${pageId}`, label: name, pageId, igId, igUsername, pageToken, status: "active", connectedBy: c.email }, { upsert: true, new: true });
        }
        const cfg = await getConfig(ws);
        await TuqorConfig.updateOne({ key: ws }, { $set: { channels: Array.from(new Set([...(cfg.channels || []), "facebook", ...(igId ? ["instagram"] : [])])), ...(cfg.accounts?.metaAccount ? {} : { "accounts.metaAccount": ws === MAIN ? pageId : `${ws}:${pageId}` }) } });
        return NextResponse.json({ ok: true, name, instagram: !!igId });
      }
      case "conn-remove": {
        if (ws === MAIN) return fail("Эзний холболтыг Админ → Холболт хэсгээс удирдана");
        const key = str(b.key, 80);
        await AgentConn.deleteOne({ ws, key, platform: b.platform === "threads" ? "threads" : "meta" });
        return NextResponse.json({ ok: true });
      }
      default: return fail("Үйлдэл буруу");
    }
  } catch (e) { return fail((e as Error).message || "Алдаа"); }
}
