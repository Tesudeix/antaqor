"use client";

import { useEffect, useState, useCallback } from "react";

interface Card {
  _id: string;
  section: "ai_solution" | "resource" | "tool";
  title: string;
  desc: string;
  emoji: string;
  coverImage: string;
  href: string;
  order: number;
  enabled: boolean;
}

const SECTIONS = [
  { value: "ai_solution" as const, label: "AI ШИЙДЭЛ" },
  { value: "resource" as const,    label: "ЭХ СУРВАЛЖ" },
  { value: "tool" as const,        label: "ХЕРЕГСЕЛ" },
];

export default function AdminHomepageCardsPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/homepage-cards?admin=1");
      const data = await res.json();
      setCards(data.cards || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Уншихад алдаа гарлаа");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (id: string, patch: Partial<Card>) => {
    const res = await fetch(`/api/homepage-cards/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) { setError("Хадгалах амжилтгүй"); return; }
    await load();
  };

  const remove = async (id: string) => {
    if (!confirm("Энэ картыг устгах уу?")) return;
    const res = await fetch(`/api/homepage-cards/${id}`, { method: "DELETE" });
    if (!res.ok) { setError("Устгах амжилтгүй"); return; }
    await load();
  };

  const add = async (section: "ai_solution" | "resource" | "tool") => {
    const title = window.prompt("Гарчиг:");
    if (!title) return;
    const href = window.prompt("Холбоос (/чат, /tools/..., https://...):") || "/";
    const emoji = window.prompt("Эможи:") || "✨";
    const desc = window.prompt("Тайлбар:") || "";
    const res = await fetch("/api/homepage-cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section, title, href, emoji, desc, order: 100 }),
    });
    if (!res.ok) { setError("Үүсгэх амжилтгүй"); return; }
    await load();
  };

  const uploadCover = (id: string) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const fd = new FormData();
      fd.append("file", file);
      try {
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (res.ok && data.url) {
          await save(id, { coverImage: data.url });
        } else {
          setError(data.error || "Зураг илгээх амжилтгүй");
        }
      } catch {
        setError("Сүлжээний алдаа");
      }
    };
    input.click();
  };

  if (loading) return <div className="p-6 text-[12px] text-[#E2E4E8]">Уншиж байна...</div>;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-[20px] font-black text-[#E8E8E8]">Нүүр хуудасны карт</h1>
        <p className="mt-1 text-[12px] text-[#E2E4E8]">AI Шийдэл болон Эх сурвалж картуудыг засварлах. Эрэмбэ нь жижигээс эхэлж жагсаалтын дарааллыг тогтооно.</p>
      </div>

      {error && (
        <div className="rounded-[4px] border border-[#2E29FF]/30 bg-[#2E29FF]/10 p-3 text-[12px] text-[#4C47FF]">{error}</div>
      )}

      {SECTIONS.map((s) => {
        const items = cards.filter((c) => c.section === s.value).sort((a, b) => a.order - b.order);
        return (
          <section key={s.value} className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-[13px] font-black tracking-[0.1em] text-[#2E29FF]">{s.label} <span className="ml-2 text-[#E2E4E8]">({items.length})</span></h2>
              <button
                type="button"
                onClick={() => add(s.value)}
                className="rounded-[4px] bg-[#2E29FF] px-3 py-1.5 text-[11px] font-bold text-white transition hover:brightness-110"
              >
                + Шинэ карт
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-[12px]">
                <thead className="text-[10px] uppercase tracking-wider text-[#E2E4E8]">
                  <tr>
                    <th className="px-2 py-1 text-left">Cover</th>
                    <th className="px-2 py-1 text-left">Эможи</th>
                    <th className="px-2 py-1 text-left">Эрэмбэ</th>
                    <th className="px-2 py-1 text-left">Гарчиг</th>
                    <th className="px-2 py-1 text-left">Тайлбар</th>
                    <th className="px-2 py-1 text-left">Холбоос</th>
                    <th className="px-2 py-1 text-center">Идэвх</th>
                    <th className="px-2 py-1"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((c) => (
                    <tr key={c._id} className="border-t border-[rgba(255,255,255,0.06)]">
                      <td className="p-1">
                        <button
                          type="button"
                          onClick={() => uploadCover(c._id)}
                          className="relative block h-10 w-16 overflow-hidden rounded border border-dashed border-[rgba(255,255,255,0.20)] bg-[#0A0A0A] transition hover:border-[#2E29FF]"
                          title={c.coverImage ? "Зураг солих" : "Зураг оруулах"}
                        >
                          {c.coverImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={c.coverImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
                          ) : (
                            <span className="absolute inset-0 flex items-center justify-center text-[10px] text-[#E2E4E8]">+</span>
                          )}
                        </button>
                      </td>
                      <td className="p-1">
                        <input
                          className="w-12 rounded bg-[#0A0A0A] px-2 py-1 text-center text-[14px]"
                          defaultValue={c.emoji}
                          onBlur={(e) => e.target.value !== c.emoji && save(c._id, { emoji: e.target.value })}
                        />
                      </td>
                      <td className="p-1">
                        <input
                          type="number"
                          className="w-16 rounded bg-[#0A0A0A] px-2 py-1 tabular-nums"
                          defaultValue={c.order}
                          onBlur={(e) => Number(e.target.value) !== c.order && save(c._id, { order: Number(e.target.value) })}
                        />
                      </td>
                      <td className="p-1">
                        <input
                          className="w-full rounded bg-[#0A0A0A] px-2 py-1"
                          defaultValue={c.title}
                          onBlur={(e) => e.target.value !== c.title && save(c._id, { title: e.target.value })}
                        />
                      </td>
                      <td className="p-1">
                        <input
                          className="w-full rounded bg-[#0A0A0A] px-2 py-1"
                          defaultValue={c.desc}
                          onBlur={(e) => e.target.value !== c.desc && save(c._id, { desc: e.target.value })}
                        />
                      </td>
                      <td className="p-1">
                        <input
                          className="w-full rounded bg-[#0A0A0A] px-2 py-1 font-mono text-[11px]"
                          defaultValue={c.href}
                          onBlur={(e) => e.target.value !== c.href && save(c._id, { href: e.target.value })}
                        />
                      </td>
                      <td className="p-1 text-center">
                        <input
                          type="checkbox"
                          defaultChecked={c.enabled}
                          onChange={(e) => save(c._id, { enabled: e.target.checked })}
                        />
                      </td>
                      <td className="p-1">
                        <button
                          type="button"
                          onClick={() => remove(c._id)}
                          className="rounded bg-[#2E29FF]/20 px-2 py-1 text-[10px] font-bold text-[#4C47FF] transition hover:bg-[#2E29FF]/30"
                        >
                          Устгах
                        </button>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr><td colSpan={8} className="p-4 text-center text-[11px] text-[#E2E4E8]">Хоосон. "+ Шинэ карт" дарж нэмнэ үү.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
