"use client";

import { useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// Open marketplace: any signed-in user can list a prompt — membership not
// required. Photo upload goes through /api/upload (free tier has its own
// rate limits there).

const PRICE_CHIPS = [0, 5000, 10000, 25000, 50000];

export default function SellPromptPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [form, setForm] = useState({ title: "", summary: "", description: "", price: "", coverImage: "", tags: "" });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const uploadPhoto = async (file: File) => {
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "Зураг оруулахад алдаа гарлаа");
        return;
      }
      setForm((f) => ({ ...f, coverImage: d.url }));
    } catch {
      setError("Сүлжээний алдаа");
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || uploading) return;
    if (!form.title.trim() || !form.description.trim()) { setError("Гарчиг болон промтоо бичнэ үү"); return; }
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/market", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          summary: form.summary.trim(),
          description: form.description.trim(),
          coverImage: form.coverImage.trim(),
          price: Number(form.price) || 0,
          tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
          category: "Prompt",
        }),
      });
      const d = await res.json();
      if (res.ok) { setDone(true); setTimeout(() => router.push(d.product?.slug ? `/market/${d.product.slug}` : "/market"), 1200); }
      else setError(d.error || "Алдаа гарлаа");
    } catch { setError("Сүлжээний алдаа"); } finally { setSaving(false); }
  };

  if (status === "loading") return <div className="flex min-h-[50vh] items-center justify-center"><div className="h-2 w-2 animate-pulse rounded-full bg-[#1080CA]" /></div>;
  if (!session) return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-[20px] font-bold text-[#F2F2F4]">Промт зарахын тулд нэвтэрнэ үү</h1>
      <p className="mt-2 text-[13px] text-[#B4B4BA]">Бүртгэл үнэгүй — гишүүнчлэл шаардлагагүй.</p>
      <Link href="/auth/signin?next=/market/sell" className="mt-6 inline-block rounded-none bg-[#1080CA] px-6 py-2.5 text-[13px] font-bold text-[#0E0E10] transition hover:bg-[#4FA8E8]">Нэвтрэх</Link>
    </div>
  );

  const inputCls =
    "w-full rounded-none border border-[rgba(255,255,255,0.10)] bg-[#1E1E21] px-4 py-3 text-[14px] text-[#F2F2F4] outline-none transition focus:border-[rgba(16,128,202,0.6)] placeholder:text-[#84848C]";

  return (
    <div className="mx-auto max-w-2xl px-4 pb-20 pt-6">
      <div className="mb-6">
        <div className="flex items-center gap-2"><div className="h-[2px] w-4 bg-[#1080CA]" /><span className="text-[11px] font-bold uppercase tracking-[2px] text-[#0E0E10]">Промт зарах</span></div>
        <h1 className="mt-3 text-[28px] font-black tracking-tight text-[#F2F2F4]">Промтоо бүтээгдэхүүн болго</h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-[#B4B4BA]">
          Хэн ч зарж болно — гишүүнчлэл шаардлагагүй. Сайн нэр, тод зураг, ойлгомжтой тайлбар = илүү борлуулалт.
        </p>
      </div>

      {done ? (
        <div className="rounded-none border border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.06)] p-8 text-center">
          <div className="text-[32px]">✓</div>
          <div className="mt-2 text-[16px] font-bold text-[#F2F2F4]">Зар нийтлэгдлээ</div>
          <p className="mt-1 text-[13px] text-[#B4B4BA]">Бүтээгдэхүүний хуудас руу шилжиж байна…</p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          {/* Cover photo — the #1 conversion lever, so it leads the form */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); e.target.value = ""; }}
          />
          {form.coverImage ? (
            <div className="group relative overflow-hidden rounded-none border border-[rgba(255,255,255,0.10)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={form.coverImage} alt="Cover" className="aspect-video w-full object-cover" />
              <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/55 opacity-0 transition group-hover:opacity-100">
                <button type="button" onClick={() => fileRef.current?.click()} className="rounded-none bg-[#1080CA] px-4 py-2 text-[12px] font-bold text-[#0E0E10]">Солих</button>
                <button type="button" onClick={() => setForm((f) => ({ ...f, coverImage: "" }))} className="rounded-none border border-[rgba(255,255,255,0.3)] px-4 py-2 text-[12px] font-bold text-white">Устгах</button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex aspect-[3/1] w-full flex-col items-center justify-center gap-2 rounded-none border border-dashed border-[rgba(255,255,255,0.16)] bg-[#1E1E21] text-[#B4B4BA] transition hover:border-[rgba(16,128,202,0.5)] hover:text-[#F2F2F4] disabled:opacity-60"
            >
              {uploading ? (
                <span className="text-[13px] font-bold">Зураг оруулж байна…</span>
              ) : (
                <>
                  <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <rect x="3" y="3" width="18" height="18" rx="3" />
                    <circle cx="9" cy="9" r="2" />
                    <path d="M21 15l-5-5L5 21" />
                  </svg>
                  <span className="text-[13px] font-bold">Cover зураг нэмэх</span>
                  <span className="text-[11px] text-[#84848C]">Үр дүнгийн жишээ зураг хамгийн сайн зарагддаг</span>
                </>
              )}
            </button>
          )}

          <input value={form.title} onChange={set("title")} placeholder="Промтын гарчиг * (жишээ: Instagram Reels скрипт промт)" className={inputCls} />
          <input value={form.summary} onChange={set("summary")} placeholder="Богино тайлбар — юу хийж өгдөг вэ?" className={inputCls} />
          <textarea value={form.description} onChange={set("description")} rows={8} placeholder="Промтын бүрэн агуулга / хэрэглэх заавар *" className={`${inputCls} resize-none leading-relaxed`} />

          {/* Price */}
          <div className="rounded-none border border-[rgba(255,255,255,0.10)] bg-[#1E1E21] p-4">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-[1.5px] text-[#84848C]">Үнэ</div>
            <div className="flex flex-wrap items-center gap-2">
              {PRICE_CHIPS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, price: String(p) }))}
                  className={`rounded-none px-3 py-1.5 text-[12px] font-bold transition ${
                    Number(form.price) === p && form.price !== ""
                      ? "bg-[#1080CA] text-[#0E0E10]"
                      : "border border-[rgba(255,255,255,0.10)] text-[#B4B4BA] hover:text-[#F2F2F4]"
                  }`}
                >
                  {p === 0 ? "Үнэгүй" : `₮${p.toLocaleString()}`}
                </button>
              ))}
              <div className="flex min-w-[140px] flex-1 items-center gap-1.5 rounded-none border border-[rgba(255,255,255,0.10)] px-3 py-1.5">
                <span className="text-[13px] font-black text-[#1080CA]">₮</span>
                <input value={form.price} onChange={set("price")} type="number" min="0" placeholder="Өөр үнэ" className="w-full bg-transparent text-[13px] text-[#F2F2F4] outline-none placeholder:text-[#84848C]" />
              </div>
            </div>
          </div>

          <input value={form.tags} onChange={set("tags")} placeholder="Tags — таслалаар (marketing, зураг, видео…)" className={inputCls} />

          {error && (
            <p className="rounded-none border border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.08)] px-3 py-2 text-[12px] text-[#fbbf24]">{error}</p>
          )}
          <button type="submit" disabled={saving || uploading} className="w-full rounded-none bg-[#1080CA] px-6 py-3.5 text-[14px] font-black text-[#0E0E10] transition hover:bg-[#4FA8E8] hover:shadow-[0_0_24px_rgba(16,128,202,0.3)] disabled:opacity-50">
            {saving ? "Нийтэлж байна…" : "Зар нийтлэх"}
          </button>
          <p className="text-center text-[11px] text-[#84848C]">Нийтэлснээр маркетын журмыг зөвшөөрсөнд тооцно. Борлуулалтын 20% платформын шимтгэл.</p>
        </form>
      )}
    </div>
  );
}
