"use client";

import { useEffect, useState } from "react";

interface Category {
  _id: string;
  slug: string;
  name: string;
  color: string;
  iconPath: string;
  order: number;
}

const NEON = "#2E29FF";

export default function AdminCategoriesPage() {
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#2E29FF");
  const [iconPath, setIconPath] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const refresh = () => {
    setLoading(true);
    fetch("/api/categories")
      .then((r) => r.json())
      .then((d) => setCats(d.categories || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { refresh(); }, []);

  const add = async () => {
    setErr("");
    if (!name.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          color,
          iconPath: iconPath.trim(),
          order: cats.length,
        }),
      });
      const d = await res.json();
      if (res.ok) {
        setName("");
        setIconPath("");
        refresh();
      } else {
        setErr(d.error || "Алдаа");
      }
    } finally {
      setBusy(false);
    }
  };

  const remove = async (slug: string) => {
    if (!confirm(`"${slug}" категорийг устгах уу?`)) return;
    await fetch(`/api/admin/categories?slug=${encodeURIComponent(slug)}`, { method: "DELETE" });
    refresh();
  };

  return (
    <div className="mx-auto max-w-[700px] pb-16">
      <div className="mb-6">
        <span className="rounded-[4px] bg-[rgba(46,41,255,0.12)] px-2 py-0.5 text-[11px] font-black tracking-[0.18em]" style={{ color: NEON }}>
          ADMIN · CATEGORIES
        </span>
        <h1 className="mt-2 text-[24px] font-black text-white sm:text-[28px]">Категори удирдах</h1>
        <p className="mt-1 text-[12px] text-[#E2E4E8]">Постын категорийн жагсаалт. Нэмэх, устгах боломжтой.</p>
      </div>

      {/* Add new */}
      <div className="mb-5 rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] p-4">
        <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#E2E4E8]">Шинэ категори</div>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="судалгаа"
            maxLength={50}
            className="flex-1 rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2 text-[13px] text-[#E8E8E8] placeholder-[#62666F] outline-none focus:border-[rgba(46,41,255,0.4)]"
          />
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-[36px] w-[44px] shrink-0 cursor-pointer rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A]"
          />
          <button
            type="button"
            onClick={add}
            disabled={busy || !name.trim()}
            className="rounded-[4px] bg-[#2E29FF] px-4 py-2 text-[12px] font-black text-white transition hover:bg-[#1F1AD9] disabled:opacity-50"
          >
            {busy ? "..." : "Нэмэх"}
          </button>
        </div>
        <input
          value={iconPath}
          onChange={(e) => setIconPath(e.target.value)}
          placeholder="SVG path (заавал биш) — heroicons-аас d=&quot;...&quot; хуул"
          className="mt-2 w-full rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2 font-mono text-[11px] text-[#E2E4E8] placeholder-[#62666F] outline-none focus:border-[rgba(46,41,255,0.4)]"
        />
        {err && <p className="mt-2 text-[11px] text-[#2E29FF]">{err}</p>}
      </div>

      {/* List */}
      {loading ? (
        <p className="text-[12px] text-[#E2E4E8]">Татаж байна…</p>
      ) : (
        <div className="overflow-hidden rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0A0A0A]">
          {cats.map((c, i) => (
            <div
              key={c._id}
              className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-[rgba(255,255,255,0.04)]" : ""}`}
            >
              <span
                className="inline-flex h-7 items-center gap-1.5 rounded-[4px] px-2 text-[11px] font-black"
                style={{ background: `${c.color}1F`, color: c.color }}
              >
                {c.iconPath ? (
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d={c.iconPath} />
                  </svg>
                ) : null}
                {c.name}
              </span>
              <span className="text-[10px] text-[#E2E4E8]">slug: {c.slug}</span>
              <span className="ml-auto text-[10px] tabular-nums text-[#E2E4E8]">#{c.order}</span>
              <button
                type="button"
                onClick={() => remove(c.slug)}
                className="text-[10px] font-bold text-[#E2E4E8] transition hover:text-[#2E29FF]"
              >
                Устгах
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
