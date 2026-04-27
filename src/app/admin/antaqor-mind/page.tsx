"use client";

import { useEffect, useRef, useState } from "react";

interface Fact {
  _id: string;
  topic: string;
  content: string;
  weight: number;
  active: boolean;
  updatedAt: string;
}

const TOPIC_SUGGESTIONS = [
  "membership", "founder", "launch", "policy", "pricing",
  "course", "event", "promo", "story", "warning", "vision",
];

export default function AdminAntaqorMindPage() {
  const [facts, setFacts] = useState<Fact[]>([]);
  const [loading, setLoading] = useState(true);
  const [topic, setTopic] = useState("");
  const [content, setContent] = useState("");
  const [weight, setWeight] = useState(5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = async () => {
    const r = await fetch("/api/admin/companion-knowledge");
    const d = await r.json();
    if (Array.isArray(d.facts)) setFacts(d.facts);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const add = async () => {
    if (!topic.trim() || !content.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/admin/companion-knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, content, weight, active: true }),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error || "Алдаа");
        return;
      }
      setTopic(""); setContent(""); setWeight(5);
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (f: Fact) => {
    await fetch(`/api/admin/companion-knowledge/${f._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !f.active }),
    });
    refresh();
  };

  const updateWeight = async (f: Fact, w: number) => {
    await fetch(`/api/admin/companion-knowledge/${f._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weight: w }),
    });
    setFacts((arr) => arr.map((x) => x._id === f._id ? { ...x, weight: w } : x));
  };

  const remove = async (f: Fact) => {
    if (!confirm(`"${f.topic}" — устгах уу?`)) return;
    await fetch(`/api/admin/companion-knowledge/${f._id}`, { method: "DELETE" });
    refresh();
  };

  return (
    <div className="mx-auto max-w-[860px]">
      <div className="mb-6">
        <h1 className="text-[26px] font-black text-[#E8E8E8]">Antaqor · Mind</h1>
        <p className="mt-1 text-[12px] text-[#888]">
          Энд бичсэн баримт болгон Antaqor-ын system prompt-руу шууд орно. ~60 секундын дотор тэр
          энэ мэдээллийг ашиглаж эхэлнэ. Жишээ нь: шинэ хичээл, акц, өнөөдрийн live, бодлогын
          өөрчлөлт.
        </p>
      </div>

      <AvatarUploader />


      {/* Add new fact */}
      <div className="mb-6 rounded-[4px] border border-[rgba(239,44,88,0.2)] bg-gradient-to-br from-[rgba(239,44,88,0.04)] to-[#0F0F10] p-4">
        <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.15em] text-[#EF2C58]">
          Шинэ баримт нэмэх
        </div>
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Сэдэв (e.g. membership, launch, course)"
          maxLength={60}
          list="topic-suggestions"
          className="mb-2 w-full rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2 text-[13px] text-[#E8E8E8] placeholder-[#555] outline-none focus:border-[rgba(239,44,88,0.4)]"
        />
        <datalist id="topic-suggestions">
          {TOPIC_SUGGESTIONS.map((t) => <option key={t} value={t} />)}
        </datalist>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Antaqor-ийн мэдэх ёстой бодит мэдээ. Жнь: '3 сарын 15-аас Pro гишүүнчлэлд +50% bonus credit өгнө.'"
          rows={3}
          maxLength={500}
          className="mb-2 w-full resize-y rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2 text-[13px] text-[#E8E8E8] placeholder-[#555] outline-none focus:border-[rgba(239,44,88,0.4)]"
        />
        <div className="mb-3 flex items-center gap-3 text-[11px] text-[#888]">
          <label className="flex items-center gap-2">
            Жин (priority):
            <input
              type="range"
              min={1}
              max={10}
              value={weight}
              onChange={(e) => setWeight(parseInt(e.target.value))}
              className="accent-[#EF2C58]"
            />
            <span className="w-6 text-right font-black text-[#EF2C58]">{weight}</span>
          </label>
          <span className="text-[10px] text-[#555] ml-auto">{content.length}/500</span>
        </div>
        {error && (
          <div className="mb-2 text-[11px] text-[#EF4444]">{error}</div>
        )}
        <button
          onClick={add}
          disabled={!topic.trim() || !content.trim() || busy}
          className="rounded-[4px] bg-[#EF2C58] px-4 py-2 text-[12px] font-black text-white transition hover:bg-[#D4264E] disabled:opacity-40"
        >
          {busy ? "Хадгалж байна..." : "+ Antaqor-ын ой ухаан руу нэмэх"}
        </button>
      </div>

      {/* Facts list */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[14px] font-black text-[#E8E8E8]">
          Баримтууд ({facts.length})
        </h2>
        <span className="text-[10px] text-[#666]">
          Идэвхтэй жин ↑ → Antaqor илүү дурд
        </span>
      </div>

      {loading ? (
        <div className="py-12 text-center text-[12px] text-[#666]">Ачаалж байна...</div>
      ) : facts.length === 0 ? (
        <div className="rounded-[4px] border-2 border-dashed border-[rgba(255,255,255,0.08)] p-8 text-center text-[12px] text-[#666]">
          Хараахан баримт байхгүй. Дээрээс эхний баримтаа нэмнэ үү.
        </div>
      ) : (
        <div className="space-y-2">
          {facts.map((f) => (
            <div
              key={f._id}
              className={`rounded-[4px] border p-3 ${
                f.active
                  ? "border-[rgba(239,44,88,0.2)] bg-[#0F0F10]"
                  : "border-[rgba(255,255,255,0.05)] bg-[#0A0A0A] opacity-50"
              }`}
            >
              <div className="mb-1.5 flex items-center gap-2">
                <span className="rounded-[4px] bg-[rgba(239,44,88,0.12)] px-1.5 py-0.5 text-[9px] font-black tracking-wider text-[#EF2C58]">
                  {f.topic}
                </span>
                <span className="text-[9px] font-black text-[#666]">w{f.weight}</span>
                <span className="ml-auto text-[9px] text-[#555]">
                  {new Date(f.updatedAt).toLocaleDateString("mn-MN")}
                </span>
              </div>
              <p className="text-[13px] leading-relaxed text-[#E8E8E8]">{f.content}</p>
              <div className="mt-2 flex items-center justify-between gap-2 border-t border-[rgba(255,255,255,0.04)] pt-2">
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="text-[#666]">Жин:</span>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={f.weight}
                    onChange={(e) => updateWeight(f, parseInt(e.target.value))}
                    className="accent-[#EF2C58]"
                  />
                  <span className="w-6 font-black text-[#EF2C58]">{f.weight}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleActive(f)}
                    className={`rounded-[4px] px-2.5 py-1 text-[10px] font-black transition ${
                      f.active
                        ? "border border-[rgba(255,255,255,0.1)] text-[#888]"
                        : "bg-[#EF2C58] text-white"
                    }`}
                  >
                    {f.active ? "Унтраах" : "Идэвхжүүлэх"}
                  </button>
                  <button
                    onClick={() => remove(f)}
                    className="rounded-[4px] border border-[rgba(239,68,68,0.3)] px-2.5 py-1 text-[10px] font-black text-[#EF4444] transition hover:bg-[rgba(239,68,68,0.1)]"
                  >
                    Устгах
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-6 text-center text-[10px] text-[#444]">
        Live news + classroom courses Antaqor автомат уншина. Энд зөвхөн админы оруулсан тусгай мэдээ.
      </p>
    </div>
  );
}

function AvatarUploader() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState<number>(() => Date.now());
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setSuccess(false);
    if (!file.type.startsWith("image/")) {
      setError("Зөвхөн зургийн файл");
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      setError("Зураг 6MB-аас бага байх ёстой");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/admin/companion-avatar", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error || "Хадгалах алдаа");
        return;
      }
      setVersion(Date.now());
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2400);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="mb-6 rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0F0F10] p-4">
      <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.15em] text-[#888]">
        Antaqor Profile Image
      </div>
      <div className="flex items-center gap-4">
        {/* Live preview — cache-busted */}
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[4px] bg-gradient-to-br from-[#EF2C58] to-[#A855F7]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/antaqorr.png?v=${version}`}
            alt="Antaqor"
            className="h-full w-full object-cover"
          />
        </div>
        <div className="flex-1">
          <p className="text-[12px] text-[#CCC]">
            Шинэ зураг сонгоход <code className="rounded-[3px] bg-[rgba(239,44,88,0.1)] px-1 text-[#EF2C58]">/antaqorr.png</code> +{" "}
            <code className="rounded-[3px] bg-[rgba(239,44,88,0.1)] px-1 text-[#EF2C58]">/antaqor.png</code> хоёрууланг шинэчилнэ.
            512×512 square PNG болж хадгалагдана.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-[4px] bg-[#EF2C58] px-3 py-1.5 text-[11px] font-black text-white transition hover:bg-[#D4264E] disabled:opacity-40"
            >
              {busy ? "Хадгалж байна..." : "Зураг оруулах"}
            </button>
            {success && <span className="text-[11px] font-bold text-[#EF2C58]">✓ Шинэчлэгдлээ</span>}
            {error && <span className="text-[11px] text-[#EF4444]">{error}</span>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={onPick} className="hidden" />
        </div>
      </div>
    </div>
  );
}
