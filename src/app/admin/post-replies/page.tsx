"use client";

import { useCallback, useEffect, useState } from "react";

interface Acct { key: string; label: string }
interface Post {
  id: string; network: "facebook" | "instagram";
  caption: string; image: string; permalink: string; at: string;
}
interface Reply {
  postId: string; label: string; dmText: string; imageUrl: string;
  commentReply: string; buttons: { label: string; url: string }[];
  enabled: boolean; hitCount: number; promptSlug?: string;
}
interface Magnet {
  slug: string; title: string; description: string;
  requiredPlan: string; freeSlides: number; slideCount: number; copies: number;
}

const MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace";
const INP =
  "w-full rounded-[4px] border border-[rgba(255,255,255,0.12)] bg-[#0A0A0A] px-2.5 py-2 text-[12px] text-[#E8E8E8] outline-none focus:border-[rgba(46,41,255,0.5)]";

export default function PostRepliesPage() {
  const [accounts, setAccounts] = useState<Acct[]>([]);
  const [account, setAccount] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [magnets, setMagnets] = useState<Magnet[]>([]);
  const [replies, setReplies] = useState<Record<string, Reply>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState("");

  // Draft state for the row being edited — kept separate so typing never
  // mutates the saved copy until Save is pressed.
  const [draft, setDraft] = useState<{ dmText: string; btnLabel: string; btnUrl: string; commentReply: string; promptSlug: string }>({
    dmText: "", btnLabel: "", btnUrl: "", commentReply: "", promptSlug: "",
  });

  const load = useCallback(async (acct?: string) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/post-replies${acct ? `?account=${encodeURIComponent(acct)}` : ""}`, { cache: "no-store" });
      const d = await r.json();
      if (Array.isArray(d.accounts)) setAccounts(d.accounts);
      if (d.account) setAccount(d.account);
      if (Array.isArray(d.posts)) setPosts(d.posts);
      if (Array.isArray(d.prompts)) setMagnets(d.prompts);
      const map: Record<string, Reply> = {};
      for (const x of (d.replies || []) as Reply[]) map[x.postId] = x;
      setReplies(map);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const say = (m: string) => { setFlash(m); setTimeout(() => setFlash(""), 3000); };

  // Picking a magnet fills the whole answer in one action. Typing a URL by hand
  // was the step where a post quietly ended up pointing at nothing.
  function chooseMagnet(slug: string) {
    if (!slug) { setDraft((d) => ({ ...d, promptSlug: "" })); return; }
    const m = magnets.find((x) => x.slug === slug);
    if (!m) return;
    const paid = m.requiredPlan && m.requiredPlan !== "free";
    setDraft((d) => ({
      ...d,
      promptSlug: slug,
      btnLabel: "Промт авах ⚡",
      btnUrl: `https://antaqor.com/prompts/${slug}`,
      dmText:
        d.dmText.trim() ||
        `Сайн байна уу! 👋\n\n«${m.title}» — доорх товчоор шууд аваарай.` +
          (paid ? `\n\nЭхний ${m.freeSlides} нь үнэгүй нээлттэй ⚡` : "\n\nБүрэн үнэгүй ⚡"),
    }));
  }

  function startEdit(p: Post) {
    const ex = replies[p.id];
    setDraft({
      dmText: ex?.dmText || "",
      btnLabel: ex?.buttons?.[0]?.label || "",
      btnUrl: ex?.buttons?.[0]?.url || "",
      commentReply: ex?.commentReply || "",
      promptSlug: ex?.promptSlug || "",
    });
    setOpen(p.id);
  }

  async function save(p: Post) {
    const body = {
      account, postId: p.id,
      label: p.caption || p.id,
      dmText: draft.dmText,
      commentReply: draft.commentReply,
      promptSlug: draft.promptSlug,
      buttons: draft.btnLabel && draft.btnUrl ? [{ label: draft.btnLabel, url: draft.btnUrl }] : [],
      enabled: true,
    };
    const r = await fetch("/api/admin/post-replies", {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (r.ok) { say("Хадгаллаа ✓"); setOpen(null); void load(account); }
    else { const d = await r.json().catch(() => ({})); say(d.error || "Алдаа гарлаа"); }
  }

  async function remove(postId: string) {
    if (!confirm("Энэ постын тусгай хариуг устгах уу?")) return;
    const r = await fetch(`/api/admin/post-replies?account=${encodeURIComponent(account)}&postId=${encodeURIComponent(postId)}`, { method: "DELETE" });
    if (r.ok) { say("Устгалаа"); void load(account); }
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-5">
        <div className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#2E29FF]">Post replies</div>
        <h1 className="mt-0.5 text-[22px] font-bold text-[#E8E8E8]">Пост тус бүрийн хариу</h1>
        <p className="mt-1 text-[12px] leading-relaxed text-[#E2E4E8]">
          Түлхүүр үг нь <b>хэзээ</b> хариулахыг, энэ хуудас нь тухайн пост дээр <b>юу</b> илгээхийг шийднэ.
          Тохируулаагүй пост триггерийн ерөнхий хариугаараа явна.
        </p>
      </div>

      {accounts.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {accounts.map((a) => (
            <button key={a.key} onClick={() => { setAccount(a.key); void load(a.key); }}
              className="rounded-[4px] px-3 py-1.5 text-[12px] font-semibold"
              style={account === a.key
                ? { background: "rgba(46,41,255,0.15)", color: "#2E29FF" }
                : { background: "rgba(255,255,255,0.05)", color: "#30333F" }}>
              {a.label}
            </button>
          ))}
        </div>
      )}

      {flash && (
        <div className="mb-4 rounded-[4px] border border-[rgba(74,222,128,0.3)] bg-[rgba(74,222,128,0.08)] px-3 py-2 text-[12px] text-[#4ADE80]">
          {flash}
        </div>
      )}

      {loading && <div className="text-[12px] text-[#E2E4E8]">Постуудыг татаж байна…</div>}

      {!loading && posts.length === 0 && (
        <div className="rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] p-6 text-center text-[12px] text-[#E2E4E8]">
          Пост олдсонгүй. Token эсвэл эрх дутуу байж болзошгүй — Холболтын эрүүл мэнд хуудсыг шалгана уу.
        </div>
      )}

      <div className="space-y-2">
        {posts.map((p) => {
          const ex = replies[p.id];
          const editing = open === p.id;
          return (
            <div key={p.id} className="rounded-[4px] border p-3"
              style={{ borderColor: ex ? "rgba(74,222,128,0.35)" : "rgba(255,255,255,0.08)", background: "#F8F9FD" }}>
              <div className="flex items-start gap-3">
                {p.image
                  ? <img src={p.image} alt="" className="h-14 w-14 shrink-0 rounded-[4px] object-cover" />
                  : <div className="h-14 w-14 shrink-0 rounded-[4px] bg-[#0A0A0A]" />}

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-[3px] px-1.5 py-0.5 text-[9px] font-bold uppercase"
                      style={{ background: p.network === "instagram" ? "rgba(225,48,108,0.15)" : "rgba(24,119,242,0.15)",
                               color: p.network === "instagram" ? "#E1306C" : "#4E94D0" }}>
                      {p.network}
                    </span>
                    <span className="text-[10px] text-[#E2E4E8]" style={{ fontFamily: MONO }}>
                      {p.at ? p.at.slice(0, 10) : ""}
                    </span>
                    {ex && (
                      <span className="text-[10px] text-[#4ADE80]">
                        ✓ {ex.promptSlug ? magnets.find((m) => m.slug === ex.promptSlug)?.title || ex.promptSlug : "тохируулсан"}
                        {ex.hitCount ? ` · ${ex.hitCount} удаа` : ""}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 truncate text-[12px] text-[#E8E8E8]">{p.caption || "(тайлбаргүй)"}</div>
                </div>

                <div className="flex shrink-0 gap-1.5">
                  <button onClick={() => (editing ? setOpen(null) : startEdit(p))}
                    className="rounded-[4px] bg-[rgba(255,255,255,0.07)] px-2.5 py-1.5 text-[11px] text-[#E8E8E8] hover:bg-[rgba(255,255,255,0.12)]">
                    {editing ? "Хаах" : ex ? "Засах" : "Тохируулах"}
                  </button>
                  {ex && (
                    <button onClick={() => remove(p.id)}
                      className="rounded-[4px] bg-[rgba(46,41,255,0.12)] px-2.5 py-1.5 text-[11px] text-[#4C47FF] hover:bg-[rgba(46,41,255,0.2)]">
                      Устгах
                    </button>
                  )}
                </div>
              </div>

              {editing && (
                <div className="mt-3 space-y-2 border-t border-[rgba(255,255,255,0.06)] pt-3">
                  <label className="block text-[11px] text-[#E2E4E8]">
                    Аль lead magnet-ийг өгөх вэ
                    <select className={INP + " mt-1"} value={draft.promptSlug}
                      onChange={(e) => chooseMagnet(e.target.value)}>
                      <option value="">— гараар бичих —</option>
                      {magnets.map((m) => (
                        <option key={m.slug} value={m.slug}>
                          {m.title} · {m.requiredPlan === "free" ? "үнэгүй" : m.requiredPlan} · {m.slideCount} слайд
                        </option>
                      ))}
                    </select>
                  </label>
                  {magnets.length === 0 && (
                    <div className="rounded-[4px] border border-[rgba(251,191,36,0.35)] bg-[rgba(251,191,36,0.08)] px-2.5 py-2 text-[11px] text-[#FBBF24]">
                      Нийтлэгдсэн промт алга. <a href="/admin/prompts" className="underline">Эхлээд промт нэмээрэй</a> — эс бөгөөс DM хоосон хуудас руу заана.
                    </div>
                  )}

                  <label className="block text-[11px] text-[#E2E4E8]">
                    DM-ээр илгээх текст
                    <textarea rows={4} className={INP + " mt-1"} value={draft.dmText}
                      onChange={(e) => setDraft({ ...draft, dmText: e.target.value })}
                      placeholder="Энэ постын промтыг доорх товчоор аваарай 👇" />
                  </label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="block text-[11px] text-[#E2E4E8]">
                      Товчны нэр
                      <input className={INP + " mt-1"} value={draft.btnLabel} maxLength={20}
                        onChange={(e) => setDraft({ ...draft, btnLabel: e.target.value })} placeholder="Промт авах ⚡" />
                    </label>
                    <label className="block text-[11px] text-[#E2E4E8]">
                      Товчны холбоос
                      <input className={INP + " mt-1"} value={draft.btnUrl}
                        onChange={(e) => setDraft({ ...draft, btnUrl: e.target.value })} placeholder="https://antaqor.com/prompts/..." />
                    </label>
                  </div>
                  <label className="block text-[11px] text-[#E2E4E8]">
                    Сэтгэгдэлд бичих ил хариу <span className="text-[#E2E4E8]">(хоосон бол триггерийнхийг ашиглана)</span>
                    <input className={INP + " mt-1"} value={draft.commentReply}
                      onChange={(e) => setDraft({ ...draft, commentReply: e.target.value })}
                      placeholder="{{username}} танд DM илгээлээ 📩" />
                  </label>
                  <div className="flex items-center gap-2 pt-1">
                    <button onClick={() => save(p)}
                      className="rounded-[4px] bg-[#2E29FF] px-4 py-2 text-[12px] font-bold text-white hover:bg-[#1E1E1E]">
                      Хадгалах
                    </button>
                    {p.permalink && (
                      <a href={p.permalink} target="_blank" rel="noreferrer" className="text-[11px] text-[#E2E4E8] hover:text-[#E8E8E8]">
                        Постыг харах ↗
                      </a>
                    )}
                    <span className="ml-auto text-[10px] text-[#E2E4E8]" style={{ fontFamily: MONO }}>{p.id}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
