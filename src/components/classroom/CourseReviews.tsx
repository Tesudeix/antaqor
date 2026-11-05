"use client";
import { useCallback, useEffect, useState } from "react";

/* ─── Курсын үнэлгээ (2026-10-09 UX шинэчлэл) ─────────────────────────────
   Өмнө нь course-player.module.css-д БАЙХГҮЙ анги (`reviews`, `stars`,
   `reviewForm`…) ашигладаг байсан тул бүхэлдээ загваргүй — од нь саарал
   цэг, шошго нь талбарын хажууд хөвж байв. Одоо бие даасан Tailwind:

   1) Дүгнэлт — дундаж оноо том тоогоор + 5 од + тоо.
   2) Од сонгогч — 44px товчнууд (хуруунд), hover-оор урьдчилж харуулна,
      сонгосон түвшний үгэн тайлбар ("Маш сайн").
   3) Сэтгэгдэл — бүтэн өргөн талбар + тэмдэгтийн тоолуур.
   4) Үнэлгээнүүд — аватар үсэг, нэр, од, огноо, текст.
   Өнгө нь хуудасны (.page) харанхуй хувьсагчдаас. */

type Review = { _id: string; name: string; rating: number; comment: string; createdAt: string };

const GOLD = "#F5B83D";
const WORDS = ["", "Муу", "Дунд зэрэг", "Сайн", "Маш сайн", "Гайхалтай"];

function Star({ on, size = 18 }: { on: boolean; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden style={{ color: on ? GOLD : "rgba(255,255,255,0.18)" }}>
      <path fill="currentColor" d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" />
    </svg>
  );
}

export default function CourseReviews({ courseId, readOnly = false }: { courseId: string; readOnly?: boolean }) {
  const [data, setData] = useState<{ reviews: Review[]; average: number; count: number } | null>(null);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [hadMine, setHadMine] = useState(false);

  const load = useCallback(async (initial = false) => {
    try {
      const res = await fetch(`/api/classroom/courses/${courseId}/reviews?page=${page}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Үнэлгээ ачаалсангүй");
      setData(body);
      if (initial) {
        setRating(body.mine?.rating || 0);
        setComment(body.mine?.comment || "");
        setHadMine(!!body.mine?.rating);
      }
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "Сүлжээний алдаа" });
    }
  }, [courseId, page]);

  useEffect(() => { void load(true); }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!rating) return;
    setSaving(true); setMessage(null);
    try {
      const res = await fetch(`/api/classroom/courses/${courseId}/reviews`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rating, comment }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Хадгалж чадсангүй");
      await load();
      setHadMine(true);
      setMessage({ ok: true, text: "Баярлалаа! Таны үнэлгээ хадгалагдлаа." });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "Сүлжээний алдаа" });
    } finally { setSaving(false); }
  }

  const shown = hover || rating;
  const avg = data?.average ?? 0;

  return (
    <section aria-label="Курсын үнэлгээ" className="flex flex-col gap-4 p-4" style={{ color: "var(--ink, #14151C)" }}>
      {/* 1 · Дүгнэлт */}
      <div className="flex items-center gap-4 rounded-[4px] p-4" style={{ background: "var(--surface-2, #F1F2F7)", border: "1px solid var(--line, rgba(255,255,255,0.12))" }}>
        <div className="text-[40px] font-extrabold leading-none tabular-nums">{data?.count ? avg.toFixed(1) : "—"}</div>
        <div className="min-w-0">
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => <Star key={n} on={n <= Math.round(avg)} />)}
          </div>
          <div className="mt-1 text-[13px]" style={{ color: "var(--dim, #565967)" }}>
            {data?.count ? `${data.count} суралцагчийн үнэлгээ` : "Үнэлгээ алга — анхных нь та бол"}
          </div>
        </div>
      </div>

      {/* 2–3 · Үнэлгээ өгөх */}
      {!readOnly && (
        <form onSubmit={save} className="flex flex-col gap-3 rounded-[4px] p-4" style={{ border: "1px solid var(--line, rgba(255,255,255,0.12))" }}>
          <div className="text-[15px] font-bold">{hadMine ? "Таны үнэлгээ" : "Энэ курс танд хэр таалагдсан бэ?"}</div>
          <div className="flex items-center gap-3">
            <div role="radiogroup" aria-label="Од" className="flex" onMouseLeave={() => setHover(0)}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={rating === n}
                  aria-label={`${n} од — ${WORDS[n]}`}
                  onClick={() => setRating(n)}
                  onMouseEnter={() => setHover(n)}
                  className="flex h-11 w-11 items-center justify-center rounded-[4px] transition hover:scale-110"
                >
                  <Star on={n <= shown} size={30} />
                </button>
              ))}
            </div>
            <span className="text-[14px] font-semibold" style={{ color: shown ? GOLD : "var(--dim, #9C9CA6)" }}>
              {shown ? WORDS[shown] : "Од сонгоно уу"}
            </span>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold" style={{ color: "var(--muted, #565967)" }}>
              Сэтгэгдэл <span style={{ color: "var(--dim, #565967)", fontWeight: 400 }}>· заавал биш</span>
            </span>
            <textarea
              value={comment}
              maxLength={2000}
              rows={4}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Юу сурсан, юуг сайжруулж болохыг хуваалцаарай…"
              className="w-full resize-y rounded-[4px] px-3.5 py-3 text-[14.5px] leading-[1.55] outline-none transition focus:border-[#2E29FF]"
              style={{ background: "var(--surface-2, #F1F2F7)", border: "1px solid var(--line, rgba(255,255,255,0.12))", color: "var(--ink, #14151C)" }}
            />
            <span className="self-end text-[11.5px] tabular-nums" style={{ color: "var(--dim, #565967)" }}>{comment.length}/2000</span>
          </label>

          <button
            type="submit"
            disabled={!rating || saving}
            className="h-12 w-full rounded-[4px] text-[15px] font-bold transition disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: "#2E29FF", color: "#FFFFFF" }}
          >
            {saving ? "Хадгалж байна…" : hadMine ? "Үнэлгээ шинэчлэх" : "Үнэлгээ илгээх"}
          </button>
          {message && (
            <p role="status" className="rounded-[4px] px-3 py-2 text-[13px]"
              style={message.ok ? { background: "rgba(46,41,255,0.10)", color: "#2E29FF" } : { background: "rgba(216,27,74,0.12)", color: "#FF6E86" }}>
              {message.text}
            </p>
          )}
        </form>
      )}

      {/* 4 · Үнэлгээнүүд */}
      {!!data?.reviews.length && (
        <div className="flex flex-col gap-2.5">
          {data.reviews.map((r) => (
            <article key={r._id} className="rounded-[4px] p-3.5" style={{ background: "var(--surface-2, #F1F2F7)" }}>
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-bold" style={{ background: "rgba(46,41,255,0.2)", color: "#2E29FF" }}>
                  {(r.name || "?").charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold">{r.name}</div>
                  <div className="flex items-center gap-2">
                    <span className="flex" aria-label={`${r.rating} од`}>{[1, 2, 3, 4, 5].map((n) => <Star key={n} on={n <= r.rating} size={13} />)}</span>
                    <time className="text-[11.5px]" style={{ color: "var(--dim, #565967)" }}>{new Date(r.createdAt).toLocaleDateString("mn-MN")}</time>
                  </div>
                </div>
              </div>
              {r.comment && <p className="mt-2 whitespace-pre-wrap text-[14px] leading-[1.55]" style={{ color: "var(--muted, #565967)" }}>{r.comment}</p>}
            </article>
          ))}
        </div>
      )}

      {!!data && data.count > 10 && (
        <div className="flex items-center justify-between text-[13px]">
          <button type="button" disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="h-9 rounded-[4px] px-3 disabled:opacity-40" style={{ background: "var(--surface-2, #F1F2F7)" }}>← Өмнөх</button>
          <span className="tabular-nums" style={{ color: "var(--dim, #565967)" }}>{page} / {Math.ceil(data.count / 10)}</span>
          <button type="button" disabled={page * 10 >= data.count} onClick={() => setPage((p) => p + 1)} className="h-9 rounded-[4px] px-3 disabled:opacity-40" style={{ background: "var(--surface-2, #F1F2F7)" }}>Дараах →</button>
        </div>
      )}
    </section>
  );
}
