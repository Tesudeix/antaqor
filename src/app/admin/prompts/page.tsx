"use client";

import { useEffect, useState } from "react";

interface TrendingPrompt {
  _id: string;
  label: string;
  text: string;
  order: number;
  active: boolean;
  createdAt?: string;
}

const NEON = "#2E29FF";

export default function AdminPromptsPage() {
  const [prompts, setPrompts] = useState<TrendingPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const refresh = () => {
    setLoading(true);
    fetch("/api/admin/trending-prompts")
      .then((r) => r.json())
      .then((d) => setPrompts(d.prompts || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { refresh(); }, []);

  const add = async () => {
    if (!label.trim() || !text.trim()) return;
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/admin/trending-prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim(), text: text.trim(), order: prompts.length }),
      });
      const d = await res.json();
      if (res.ok) { setLabel(""); setText(""); refresh(); }
      else setErr(d.error || "Алдаа");
    } finally { setBusy(false); }
  };

  const toggle = async (p: TrendingPrompt) => {
    await fetch("/api/admin/trending-prompts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: p._id, active: !p.active }),
    });
    refresh();
  };

  const remove = async (p: TrendingPrompt) => {
    if (!confirm(`"${p.label}" устгах уу?`)) return;
    await fetch(`/api/admin/trending-prompts?id=${p._id}`, { method: "DELETE" });
    refresh();
  };

  return (
    <div className="mx-auto max-w-[700px] pb-16">
      <div className="mb-6">
        <span className="rounded-[4px] bg-[rgba(46,41,255,0.12)] px-2 py-0.5 text-[11px] font-black tracking-[0.18em]" style={{ color: NEON }}>
          ADMIN · TRENDING PROMPTS
        </span>
        <h1 className="mt-2 text-[24px] font-black text-white sm:text-[28px]">Trending промпт</h1>
        <p className="mt-1 text-[12px] text-[#E2E4E8]">Хэрэглэгчдэд харагдах урт жагсаалт. Идэвхтэйг л nano-banano хуудсанд харуулна.</p>
      </div>

      {/* Add new */}
      <div className="mb-5 rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] p-4">
        <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#E2E4E8]">Шинэ промпт</div>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (chip text) — e.g. Cyber portrait"
          maxLength={40}
          className="mb-2 w-full rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2 text-[13px] text-[#E8E8E8] placeholder-[#62666F] outline-none focus:border-[rgba(46,41,255,0.4)]"
        />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Бүтэн промпт текст…"
          rows={3}
          className="mb-2 w-full resize-y rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2 text-[13px] leading-relaxed text-[#E8E8E8] placeholder-[#62666F] outline-none focus:border-[rgba(46,41,255,0.4)]"
        />
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[#E2E4E8]">{text.length} тэмдэгт</span>
          <button
            type="button"
            onClick={add}
            disabled={busy || !label.trim() || !text.trim()}
            className="rounded-[4px] bg-[#2E29FF] px-4 py-2 text-[12px] font-black text-white transition disabled:opacity-50"
          >
            {busy ? "..." : "Нэмэх"}
          </button>
        </div>
        {err && <p className="mt-2 text-[11px] text-[#2E29FF]">{err}</p>}
      </div>

      {loading ? (
        <p className="text-[12px] text-[#E2E4E8]">Татаж байна…</p>
      ) : prompts.length === 0 ? (
        <p className="text-[12px] text-[#E2E4E8]">Промпт алга. Дээрээс нэмнэ үү.</p>
      ) : (
        <div className="overflow-hidden rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0A0A0A]">
          {prompts.map((p, i) => (
            <div key={p._id} className={`px-4 py-3 ${i > 0 ? "border-t border-[rgba(255,255,255,0.04)]" : ""}`}>
              <div className="flex items-baseline justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-flex items-center gap-1 rounded-[4px] px-1.5 py-0.5 text-[10px] font-black"
                      style={{
                        background: p.active ? "rgba(46,41,255,0.12)" : "rgba(255,255,255,0.04)",
                        color: p.active ? NEON : "#30333F",
                      }}
                    >
                      {p.active && <span className="h-1 w-1 rounded-full" style={{ background: NEON }} />}
                      {p.label}
                    </span>
                    <span className="text-[11px] text-[#E2E4E8]">#{p.order}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-[#E2E4E8]">{p.text}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => toggle(p)}
                    className="text-[10px] font-bold text-[#E2E4E8] transition hover:text-[#E8E8E8]"
                  >
                    {p.active ? "Унтраах" : "Нээх"}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(p)}
                    className="text-[10px] font-bold text-[#E2E4E8] transition hover:text-[#2E29FF]"
                  >
                    Устгах
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
