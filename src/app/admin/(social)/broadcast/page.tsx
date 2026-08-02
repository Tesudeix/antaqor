"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { T, Card, Btn, Spinner } from "@/components/admin/kit";

// ── Types ────────────────────────────────────────────────────────────────
interface FlowLite { _id: string; name: string }
interface Broadcast {
  _id: string;
  name: string;
  platform: "instagram" | "messenger" | "both";
  account: string;
  contentType: "flow" | "text";
  text: string;
  imageUrl: string;
  flowId?: string | null;
  status: "draft" | "sending" | "paused" | "done" | "failed";
  stats: { targeted: number; accepted: number; failed: number; skipped: number };
  lastError?: string;
  createdAt: string;
}

const INP = "w-full rounded-none border bg-[#0E0E12] px-3 py-2.5 text-[13px] outline-none focus:border-[rgba(16,128,202,0.5)]";

// Ready-made messages a shop owner can send in one tap. Kept deliberately
// short and benefit-led — the "[Реклам]" label is added automatically by the
// server when content is promotional (Mongolian Advertising Law).
const PRESETS: { label: string; text: string }[] = [
  { label: "🆕 Шинэ бараа", text: "Сайн байна уу 👋 Шинэ бараа ирлээ! Дэлгэрэнгүйг харах бол энд бичээрэй." },
  { label: "🔥 Хямдрал", text: "Энэ долоо хоногт онцгой хямдрал 🔥 Сонирхвол бидэнд бичээрэй, дэлгэрэнгүйг илгээе." },
  { label: "📦 Захиалга сануулга", text: "Захиалгаа аваагүй байгаа бол сануулж байна 📦 Бид танд туслахад бэлэн." },
  { label: "🙏 Баярлалаа", text: "Биднийг сонгосон танд баярлалаа 🙏 Танд хэрэгтэй зүйл байвал хэдийд ч бичээрэй." },
];

const STATUS_LABEL: Record<Broadcast["status"], { t: string; c: string }> = {
  draft: { t: "Ноорог", c: T.faint },
  sending: { t: "Илгээж байна…", c: T.primary },
  paused: { t: "Зогссон", c: T.warn },
  done: { t: "Дууссан", c: T.ok },
  failed: { t: "Алдаа", c: T.bad },
};

export default function BroadcastPage() {
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<Broadcast[]>([]);
  const [flows, setFlows] = useState<FlowLite[]>([]);
  const [flash, setFlash] = useState("");

  // Compose form
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState<"instagram" | "messenger" | "both">("both");
  const [account, setAccount] = useState("antaqor");
  const [contentType, setContentType] = useState<"flow" | "text">("text");
  const [text, setText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [flowId, setFlowId] = useState("");
  const [hotOnly, setHotOnly] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [counting, setCounting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const showFlash = (m: string) => { setFlash(m); setTimeout(() => setFlash(""), 3500); };

  const load = useCallback(async () => {
    try {
      const [rb, rf] = await Promise.all([
        fetch("/api/admin/meta/broadcast"),
        fetch("/api/admin/flows").catch(() => null),
      ]);
      const db = await rb.json();
      if (db.broadcasts) setList(db.broadcasts);
      if (rf && rf.ok) {
        const df = await rf.json();
        const fl = (df.flows || df.items || []) as Array<{ _id: string; name: string }>;
        setFlows(fl.map((f) => ({ _id: f._id, name: f.name })));
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Live recipient-count preview whenever audience inputs change.
  const intentLabels = useMemo(() => (hotOnly ? ["hot"] : []), [hotOnly]);
  useEffect(() => {
    let cancelled = false;
    setCounting(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch("/api/admin/meta/broadcast", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ preview: true, platform, account, contentType, intentLabels }),
        });
        const d = await r.json();
        if (!cancelled) setCount(typeof d.count === "number" ? d.count : null);
      } catch { if (!cancelled) setCount(null); }
      finally { if (!cancelled) setCounting(false); }
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [platform, account, contentType, intentLabels]);

  // Poll while any broadcast is sending.
  useEffect(() => {
    if (!list.some((b) => b.status === "sending")) return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [list, load]);

  const uploadImage = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok && data.url) setImageUrl(data.url);
      else showFlash(data.error || "Зураг оруулах амжилтгүй");
    } catch { showFlash("Сүлжээний алдаа"); }
    finally { setUploading(false); }
  };

  const create = async (): Promise<string | null> => {
    setSubmitting(true);
    try {
      const r = await fetch("/api/admin/meta/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, platform, account, contentType, text, imageUrl, flowId, intentLabels }),
      });
      const d = await r.json();
      if (!r.ok) { showFlash(d.error || "Алдаа гарлаа"); return null; }
      return d.broadcast?._id || null;
    } finally { setSubmitting(false); }
  };

  const createAndSend = async () => {
    if (!count) { showFlash("Хүлээн авагч алга — 24 цагийн дотор чатласан хэрэглэгч байхгүй байна."); return; }
    const who = `${count} хүнд илгээх үү?\n\nЗөвхөн сүүлийн 24 цагт танд бичсэн хүмүүст очно (Meta-гийн дүрэм).`;
    if (!confirm(who)) return;
    const id = await create();
    if (!id) return;
    const r = await fetch(`/api/admin/meta/broadcast/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "send" }),
    });
    if (r.ok) {
      showFlash("Илгээж эхэллээ 🚀");
      setName(""); setText(""); setImageUrl(""); setFlowId("");
      load();
    } else {
      const d = await r.json().catch(() => ({}));
      showFlash(d.error || "Илгээх амжилтгүй");
    }
  };

  const saveDraft = async () => {
    const id = await create();
    if (id) { showFlash("Ноорог хадгаллаа ✓"); setName(""); setText(""); setImageUrl(""); setFlowId(""); load(); }
  };

  const pause = async (id: string) => {
    await fetch(`/api/admin/meta/broadcast/${id}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "pause" }),
    });
    load();
  };
  const resume = async (id: string) => {
    await fetch(`/api/admin/meta/broadcast/${id}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "send" }),
    });
    load();
  };
  const remove = async (id: string) => {
    if (!confirm("Устгах уу?")) return;
    await fetch(`/api/admin/meta/broadcast/${id}`, { method: "DELETE" });
    load();
  };

  const canSend = !!name.trim() && (contentType === "text" ? !!text.trim() : !!flowId) && !!count;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {flash && (
        <div className="rounded-none border-l-2 px-4 py-2.5 text-[12px]" style={{ borderColor: T.primary, background: "rgba(16,128,202,0.06)", color: T.primary }}>
          {flash}
        </div>
      )}

      {/* ── COMPOSE ── */}
      <Card className="p-5 space-y-4">
        <div>
          <div className="text-[13px] font-bold" style={{ color: T.text }}>Шинэ broadcast</div>
          <div className="mt-0.5 text-[11px]" style={{ color: T.faint }}>Олон харилцагч руу нэг мессеж зэрэг илгээх</div>
        </div>

        <div>
          <div className="mb-1.5 text-[11px] font-semibold" style={{ color: T.muted }}>Кампанит ажлын нэр</div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ж: 12 сарын шинэ бараа"
            className={INP} style={{ borderColor: T.border, color: T.text }} maxLength={120} />
        </div>

        {/* Хуудас — эхлээд аль хуудас руу илгээхээ сонго */}
        <div>
          <div className="mb-1.5 text-[11px] font-semibold" style={{ color: T.muted }}>Хуудас</div>
          <div className="flex flex-wrap gap-1.5">
            {([["antaqor", "Antaqor · IG + FB"], ["joymassage", "Joy Massage"], ["joybilliard", "Joy Billiard"]] as const).map(([v, l]) => (
              <button key={v} onClick={() => setAccount(v)}
                className="rounded-[4px] px-3.5 py-2 text-[12px] font-semibold transition"
                style={account === v ? { background: T.primary, color: "#1080CA" } : { background: T.surface, color: T.muted }}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Platform */}
        <div>
          <div className="mb-1.5 text-[11px] font-semibold" style={{ color: T.muted }}>Суваг</div>
          <div className="flex flex-wrap gap-1.5">
            {([["both", "Бүгд"], ["instagram", "Instagram"], ["messenger", "Messenger"]] as const).map(([v, l]) => (
              <button key={v} onClick={() => setPlatform(v)}
                className="rounded-none px-3.5 py-2 text-[12px] font-semibold transition"
                style={platform === v ? { background: T.primary, color: "#fff" } : { background: T.surface, color: T.muted }}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Content type toggle */}
        <div>
          <div className="mb-1.5 text-[11px] font-semibold" style={{ color: T.muted }}>Агуулга</div>
          <div className="flex flex-wrap gap-1.5">
            {([["text", "Текст / зураг"], ["flow", "Flow"]] as const).map(([v, l]) => (
              <button key={v} onClick={() => setContentType(v)}
                className="rounded-none px-3.5 py-2 text-[12px] font-semibold transition"
                style={contentType === v ? { background: T.secondary, color: "#06222a" } : { background: T.surface, color: T.muted }}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {contentType === "text" ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button key={p.label} onClick={() => setText(p.text)}
                  className="rounded-none border px-2.5 py-1 text-[11px] font-medium transition hover:border-[rgba(16,128,202,0.5)]"
                  style={{ borderColor: T.border, color: T.muted }}>
                  {p.label}
                </button>
              ))}
            </div>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={1000}
              placeholder="Илгээх мессеж…"
              className="w-full resize-none rounded-none border bg-[#0E0E12] px-3 py-2.5 text-[13px] outline-none focus:border-[rgba(16,128,202,0.5)]"
              style={{ borderColor: T.border, color: T.text }} />
            <div className="flex items-center gap-3">
              {imageUrl ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrl} alt="" className="h-16 w-16 rounded-none border object-cover" style={{ borderColor: T.border }} />
                  <button onClick={() => setImageUrl("")} className="absolute right-1 top-1 rounded-none px-1 text-[10px] font-bold" style={{ background: "rgba(14,23,38,0.65)", color: "#fff" }}>×</button>
                </div>
              ) : (
                <label className="flex h-16 w-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-none border border-dashed text-[10px]" style={{ borderColor: T.borderHi, color: T.faint }}>
                  {uploading ? <Spinner className="h-4 w-4" /> : (<><span className="text-[16px] leading-none">＋</span><span>Зураг</span></>)}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); }} />
                </label>
              )}
              <div className="text-[10px]" style={{ color: T.faint }}>Зураг сонгомол — текстийн өмнө илгээгдэнэ.</div>
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-1.5 text-[11px] font-semibold" style={{ color: T.muted }}>Аль flow-г илгээх вэ</div>
            <select value={flowId} onChange={(e) => setFlowId(e.target.value)}
              className={`${INP} cursor-pointer`} style={{ borderColor: T.border, color: T.text }}>
              <option value="">— Flow сонгох —</option>
              {flows.map((f) => <option key={f._id} value={f._id}>{f.name}</option>)}
            </select>
            <div className="mt-1.5 text-[10px]" style={{ color: T.faint }}>Flow-н эхний карт (зураг + товчнууд) илгээгдэнэ.</div>
          </div>
        )}

        {/* Audience */}
        <div>
          <div className="mb-1.5 text-[11px] font-semibold" style={{ color: T.muted }}>Хэнд илгээх</div>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setHotOnly(false)}
              className="rounded-none border px-3.5 py-2 text-[12px] font-medium transition"
              style={!hotOnly ? { borderColor: T.primary, color: T.primary, background: "rgba(16,128,202,0.06)" } : { borderColor: T.border, color: T.muted }}>
              Сүүлд чатлсан бүгд
            </button>
            <button onClick={() => setHotOnly(true)}
              className="rounded-none border px-3.5 py-2 text-[12px] font-medium transition"
              style={hotOnly ? { borderColor: T.primary, color: T.primary, background: "rgba(16,128,202,0.06)" } : { borderColor: T.border, color: T.muted }}>
              🔥 Халуун лийд
            </button>
          </div>
        </div>

        {/* Recipient count */}
        <div className="flex items-center justify-between rounded-none px-3 py-2.5" style={{ background: T.surface }}>
          <span className="text-[12px]" style={{ color: T.muted }}>Хүлээн авах хүн</span>
          <span className="text-[16px] font-bold" style={{ color: count ? T.primary : T.faint }}>
            {counting ? "…" : count == null ? "—" : count}
          </span>
        </div>

        {/* Compliance note */}
        <div className="rounded-none border px-3 py-2.5 text-[11px] leading-relaxed" style={{ borderColor: "rgba(251,191,36,0.3)", background: "rgba(251,191,36,0.06)", color: "#a16207" }}>
          ⚠ Meta-гийн дүрмээр зөвхөн <strong>сүүлийн 24 цагт</strong> танд бичсэн хүмүүст л илгээгдэнэ. “Зогс” гэж бичсэн хүн жагсаалтаас автоматаар хасагдана. Нэг хүнд 24 цагт нэг л удаа очно.
        </div>

        <div className="flex justify-end gap-2">
          <Btn variant="ghost" onClick={saveDraft} loading={submitting} disabled={!name.trim()}>Ноорог хадгалах</Btn>
          <Btn variant="primary" onClick={createAndSend} loading={submitting} disabled={!canSend}>
            Илгээх{count ? ` (${count})` : ""}
          </Btn>
        </div>
      </Card>

      {/* ── HISTORY ── */}
      <div>
        <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: T.faint }}>Түүх</div>
        {loading ? (
          <div className="flex items-center gap-2 text-[13px]" style={{ color: T.faint }}><Spinner className="h-4 w-4" /> Уншиж байна…</div>
        ) : list.length === 0 ? (
          <Card className="px-6 py-10 text-center">
            <div className="text-[13px] font-semibold" style={{ color: T.text }}>Broadcast алга</div>
            <div className="mt-1 text-[12px]" style={{ color: T.faint }}>Дээрээс эхний кампанит ажлаа үүсгэнэ үү.</div>
          </Card>
        ) : (
          <div className="space-y-2">
            {list.map((b) => {
              const st = STATUS_LABEL[b.status];
              return (
                <Card key={b._id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-semibold" style={{ color: T.text }}>{b.name}</div>
                      <div className="mt-0.5 text-[11px]" style={{ color: T.faint }}>
                        {b.platform === "both" ? "Бүгд" : b.platform} · {b.contentType === "flow" ? "Flow" : "Текст"} · {new Date(b.createdAt).toLocaleDateString("mn-MN")}
                      </div>
                    </div>
                    <span className="shrink-0 text-[11px] font-bold" style={{ color: st.c }}>{st.t}</span>
                  </div>

                  {b.text && <div className="mt-2 line-clamp-2 text-[12px]" style={{ color: T.muted }}>{b.text}</div>}

                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]" style={{ color: T.muted }}>
                    <span>🎯 {b.stats.targeted}</span>
                    <span style={{ color: T.ok }}>✓ {b.stats.accepted}</span>
                    {b.stats.failed > 0 && <span style={{ color: T.bad }}>✕ {b.stats.failed}</span>}
                    {b.stats.skipped > 0 && <span style={{ color: T.faint }}>↷ {b.stats.skipped}</span>}
                  </div>

                  {b.lastError && b.status !== "done" && (
                    <div className="mt-2 rounded-none px-2 py-1 text-[10px]" style={{ background: "rgba(78,148,208,0.08)", color: T.bad }}>{b.lastError}</div>
                  )}

                  <div className="mt-3 flex justify-end gap-2">
                    {b.status === "sending" && <Btn variant="ghost" size="sm" onClick={() => pause(b._id)}>Зогсоох</Btn>}
                    {b.status === "paused" && <Btn variant="secondary" size="sm" onClick={() => resume(b._id)}>Үргэлжлүүлэх</Btn>}
                    {(b.status === "draft" || b.status === "failed" || b.status === "done") && (
                      <Btn variant="ghost" size="sm" onClick={() => remove(b._id)}>Устгах</Btn>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
