"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";

/* ─── Нүүрний PROMPT хэсэг — UB Korean Food Scout ─────────────────────────

   ГУРВАН ШИЙДВЭР ЭНД ХАТУУ БАЙНА:

   1. БҮРТГЭЛТЭЙ ХҮНД. Агент хүн бүрийн ой дээр суралцдаг болсон тул
      нэргүй хэрэглэгчид өгөх зүйл нь бүтээгдэхүүний хагас нь. Зочинд
      хаалттай гэдгийг НУУХГҮЙ — юу байгааг нь харуулаад нэг товч тавина.

   2. ТЕКСТ БИШ, ХЯНАЛТ. Тайлбар догол мөр байхгүй. Хүн "энэ юу вэ"
      гэдгийг гурван үгээр ойлгодог; үлдсэн зай нь хэрэгслийнх. Дүүрэг,
      хүний тоо, төсөв нь ГУРВАН СОНГОЛТ болж дээр нь сууна — тэдгээр нь
      хадгалагдана, өөрөөр хэлбэл дараагийн удаа дахин бичих шаардлагагүй.

   3. БАЙРШИЛ НЬ ҮР ДҮНГИЙН ГОЛ. Хүн эцсийн эцэст тэр газар руу ЯВНА.
      Тиймээс карт бүр байршлаа бүтнээр (дүүрэг · хороолол · хаяг) ба
      газрын зурагны холбоосыг эхний эгнээнд харуулна.                    */

interface Card {
  id: string;
  name: string;
  nameMn: string;
  district: string;
  area: string;
  address: string;
  location: string;
  pricePerPerson: number;
  hours: string;
  parking: boolean;
  soloFriendly: boolean;
  rating: number | null;
  phone: string;
  mapUrl: string;
  verified: boolean;
  tags: string[];
}

interface Turn {
  q: string;
  a: string;
  cards: Card[];
}

interface Profile {
  district: string;
  area: string;
  budgetPerPerson: number;
  partySize: number;
  likes: string[];
  dislikes: string[];
  totalQueries: number;
}

interface Meta {
  total: number;
  verified: number;
  districts: string[];
  profile: Profile | null;
  isLoggedIn: boolean;
}

const SUGGESTIONS = ["Хямдхан BBQ", "Ганцаараа суумаар", "Зогсоолтой", "Хамгийн хямд кимчи жигэ"];

const DISTRICT_MN: Record<string, string> = {
  "Khan-Uul": "Хан-Уул",
  Sukhbaatar: "Сүхбаатар",
  Bayanzurkh: "Баянзүрх",
  Chingeltei: "Чингэлтэй",
  Bayangol: "Баянгол",
  Songinokhairkhan: "Сонгинохайрхан",
  Nalaikh: "Налайх",
  // Байршил нь нотлогдоогүй мөр. "Unknown" гэж түүхий үг харуулах нь юу ч
  // хэлэхгүй — юу мэдэхгүй байгаагаа шулуухан хэл.
  Unknown: "Байршил бүртгэгдээгүй",
};

const BUDGETS = [0, 20000, 30000, 40000, 60000, 100000];
const PARTIES = [0, 1, 2, 3, 4, 6, 8];

const selectCls =
  "cursor-pointer appearance-none border border-[#1E1E1E] bg-[#0A0A0A] py-1.5 pl-2.5 pr-6 text-[12px] font-semibold text-[#F2F2F4] outline-none transition hover:border-[#333333] focus:border-[#2E29FF]";

function Money({ v }: { v: number }) {
  return <span style={{ fontVariantNumeric: "tabular-nums" }}>{v.toLocaleString("en-US")}₮</span>;
}

function Chevron() {
  return (
    <span aria-hidden className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-[#E2E4E8]">
      ▾
    </span>
  );
}

export default function ScoutPrompt() {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [gate, setGate] = useState<"auth" | "membership" | "">("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const outRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/scout")
      .then((r) => r.json())
      .then((d) => { if (alive && typeof d?.total === "number") setMeta(d as Meta); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  /* Профайл нь СЕРВЕР дээр хадгалагдана, зөвхөн энэ хуудсанд биш —
     тиймээс дараагийн удаа, өөр төхөөрөмжөөс ч хэвээрээ. */
  const saveProfile = useCallback((patch: Partial<Profile>) => {
    setMeta((m) => (m && m.profile ? { ...m, profile: { ...m.profile, ...patch } } : m));
    void fetch("/api/scout", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).catch(() => {});
  }, []);

  async function ask(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    setBusy(true);
    setErr("");
    setGate("");
    setQ("");

    // Өмнөх ээлжүүдийг дамжуулна — "тэдний аль нь дээр вэ" гэж
    // үргэлжлүүлэх боломж энэ мөрөөс гарна.
    const history = turns.flatMap((t) => [
      { role: "user" as const, content: t.q },
      { role: "assistant" as const, content: t.a },
    ]);

    try {
      const res = await fetch("/api/scout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...history, { role: "user", content: question }] }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data?.error || "Түр доголдов.");
        if (data?.needsAuth) setGate("auth");
        else if (data?.needsMembership) setGate("membership");
        setQ(question);
        return;
      }
      setTurns((prev) => [...prev, { q: question, a: data.reply || "", cards: data.cards || [] }]);
      setLeft(typeof data.freeRemainingToday === "number" ? data.freeRemainingToday : null);
      requestAnimationFrame(() => outRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch {
      setErr("Сүлжээний алдаа.");
      setQ(question);
    } finally {
      setBusy(false);
    }
  }

  const p = meta?.profile;
  const locked = meta ? !meta.isLoggedIn : false;

  return (
    <section
      aria-label="Korean Food Scout"
      className="border-t border-[#1E1E1E] bg-[#0A0A0A] px-5 py-9 md:px-12 md:py-12"
    >
      <div className="mx-auto max-w-3xl">
        {/* ─── Толгой ───────────────────────────────────────────────────
            Шошго нь гарчгийн ХАЖУУД биш ДЭЭР нь. Өмнө нь хоёулаа нэг
            `flex` мөрөнд байсан тул утсан дээр "AI SCOUT" нь хоёр үг
            хоёр мөр болж шахагдаад гарчигтай мөргөлддөг байв. Мөн энэ нь
            нүүрний бусад хэсэгтэй (AGENTS) нэг хэвд орно: шошго → гарчиг
            → тайлбар. */}
        <div className="chrome text-[10px] font-bold tracking-[0.18em] text-[#2E29FF]">
          AI SCOUT
        </div>
        <h2 className="mt-2 text-balance text-[19px] font-extrabold tracking-[-0.02em] text-[#F2F2F4] md:text-[23px]">
          Солонгос хоол. <span className="text-[#2E29FF]">30 секундэд.</span>
        </h2>
        {/* Тоолуур: БАТАЛГААЖСАН нь 0 бол ХАРУУЛАХГҮЙ. Тэг нь нотолгоо
            биш — "0 баталгаажсан" гэж бичих нь зочинд итгэл төрүүлэхийн
            оронд эсрэгээр нь ажиллана. Тоо гарах өдөр өөрөө эргэж ирнэ. */}
        {meta && meta.total > 0 && (
          <div
            className="chrome mt-1.5 text-[10px] font-bold tracking-[0.12em] text-[#E2E4E8]"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {meta.total} РЕСТОРАН
            {meta.verified > 0 ? ` · ${meta.verified} БАТАЛГААЖСАН` : ""}
          </div>
        )}

        {/* ─── Зочны хаалт — нэг мөр, нэг товч ─── */}
        {locked ? (
          <div
            className="mt-5 flex flex-wrap items-center justify-between gap-4 border border-[#1E1E1E] bg-[#0A0A0A] px-4 py-4"
            style={{ borderRadius: 4 }}
          >
            <p className="text-[13.5px] leading-[1.5] text-[#E2E4E8]">
              Агент таны байршил, төсөв, амтыг санаж, ашиглах тусам илүү нарийн
              санал болгоно. Үүнд бүртгэл шаардана.
            </p>
            <button
              type="button"
              onClick={() => void signIn(undefined, { callbackUrl: "/scout" })}
              className="press h-[var(--h-standard)] shrink-0 bg-[#2E29FF] px-6 text-[14px] font-bold text-[#0A0A0A] transition hover:bg-[#1F1AD9]"
              style={{ borderRadius: 4 }}
            >
              Нэвтрэх
            </button>
          </div>
        ) : (
          <>
            {/* ─── Хадгалагддаг нөхцөл — дахин бичих шаардлагагүй ─── */}
            {p && (
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <div className="relative">
                  <select
                    aria-label="Дүүрэг"
                    value={p.district}
                    onChange={(e) => saveProfile({ district: e.target.value })}
                    className={selectCls}
                    style={{ borderRadius: 4 }}
                  >
                    <option value="">Дүүрэг сонгох</option>
                    {(meta?.districts || []).map((d) => (
                      <option key={d} value={d}>{DISTRICT_MN[d] || d}</option>
                    ))}
                  </select>
                  <Chevron />
                </div>

                <div className="relative">
                  <select
                    aria-label="Хүний тоо"
                    value={String(p.partySize)}
                    onChange={(e) => saveProfile({ partySize: Number(e.target.value) })}
                    className={selectCls}
                    style={{ borderRadius: 4 }}
                  >
                    {PARTIES.map((n) => (
                      <option key={n} value={n}>{n === 0 ? "Хэдэн хүн" : `${n} хүн`}</option>
                    ))}
                  </select>
                  <Chevron />
                </div>

                <div className="relative">
                  <select
                    aria-label="Төсөв"
                    value={String(p.budgetPerPerson)}
                    onChange={(e) => saveProfile({ budgetPerPerson: Number(e.target.value) })}
                    className={selectCls}
                    style={{ borderRadius: 4 }}
                  >
                    {BUDGETS.map((n) => (
                      <option key={n} value={n}>
                        {n === 0 ? "Төсөв" : `${n.toLocaleString("en-US")}₮ / хүн`}
                      </option>
                    ))}
                  </select>
                  <Chevron />
                </div>

                {p.totalQueries > 2 && (
                  <span className="chrome ml-auto text-[10px] font-bold tracking-[0.1em] text-[#E2E4E8]">
                    {p.totalQueries} АСУУЛТ СУРСАН
                  </span>
                )}
              </div>
            )}

            {/* ─── Оролт ─── */}
            <div className="mt-3 border border-[#1E1E1E] bg-[#0A0A0A]" style={{ borderRadius: 4 }}>
              <textarea
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void ask(q);
                  }
                }}
                rows={2}
                maxLength={700}
                placeholder="Юу хайж байна?"
                className="w-full resize-none bg-transparent px-4 py-3.5 text-[15px] leading-[1.5] text-[#F2F2F4] outline-none placeholder:text-[#E2E4E8]"
              />
              <div className="flex items-center justify-between gap-3 border-t border-[#1E1E1E] px-3 py-2.5">
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={busy}
                      onClick={() => void ask(s)}
                      className="border border-[#1E1E1E] px-2.5 py-1 text-[11.5px] font-medium text-[#E2E4E8] transition hover:border-[#2E29FF] hover:text-[#F2F2F4] disabled:opacity-40"
                      style={{ borderRadius: 4 }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => void ask(q)}
                  disabled={busy || !q.trim()}
                  className="shrink-0 bg-[#2E29FF] px-4 py-2 text-[12px] font-bold tracking-[0.06em] text-[#0A0A0A] transition disabled:cursor-not-allowed disabled:bg-[#1E1E1E] disabled:text-[#E2E4E8]"
                  style={{ borderRadius: 4 }}
                >
                  {busy ? "ХАЙЖ БАЙНА…" : "ОЛОХ"}
                </button>
              </div>
            </div>

            {left !== null && left <= 2 && (
              <p className="mt-2 text-[11px] font-semibold text-[#E2E4E8]">
                Өнөөдөр {left} үнэгүй асуулт үлдлээ ·{" "}
                <a href="/pricing" className="text-[#2E29FF] underline">гишүүн болох</a>
              </p>
            )}
          </>
        )}

        {err && (
          <div
            className="mt-4 flex flex-wrap items-center gap-3 border border-[#3A2320] bg-[#160E0D] px-4 py-3 text-[13px] text-[#FD8E86]"
            style={{ borderRadius: 4 }}
          >
            <span>{err}</span>
            {gate === "auth" && (
              <button type="button" onClick={() => void signIn()} className="font-bold text-[#2E29FF] underline">
                Нэвтрэх
              </button>
            )}
            {gate === "membership" && (
              <a href="/pricing" className="font-bold text-[#2E29FF] underline">
                Гишүүн болох
              </a>
            )}
          </div>
        )}

        {/* ─── Хариултууд ─── */}
        <div ref={outRef} className="mt-7 flex flex-col gap-7">
          {turns.map((t, i) => (
            <div key={i} className="border-t border-[#1E1E1E] pt-5">
              <p className="text-[13px] font-semibold text-[#E2E4E8]">{t.q}</p>
              <p className="mt-3 whitespace-pre-wrap text-[15px] leading-[1.65] text-[#F2F2F4]">{t.a}</p>

              {t.cards.length > 0 && (
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {t.cards.map((c) => (
                    <div
                      key={c.id}
                      className="flex flex-col border border-[#1E1E1E] bg-[#0A0A0A] p-4"
                      style={{ borderRadius: 4 }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 text-[14px] font-bold leading-snug text-[#F2F2F4]">
                          {c.nameMn || c.name}
                        </div>
                        {!c.verified && (
                          <span
                            className="shrink-0 border border-[#333333] px-1.5 py-0.5 text-[9px] font-bold text-[#E2E4E8]"
                            style={{ borderRadius: 4 }}
                            title="Үнэ, цэс нь бидний зүгээс баталгаажаагүй"
                          >
                            ≈
                          </span>
                        )}
                      </div>

                      {/* Байршил — картын хамгийн чухал мөр, тиймээс нэрийн ЯГ доор */}
                      <div className="mt-1.5 text-[11.5px] leading-[1.45] text-[#E2E4E8]">
                        {[
                          c.district === "Unknown" ? "" : DISTRICT_MN[c.district] || c.district,
                          c.area,
                          c.address,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "Байршил бүртгэгдээгүй"}
                      </div>

                      <div className="mt-3 text-[18px] font-extrabold leading-none tracking-[-0.02em] text-[#2E29FF]">
                        <Money v={c.pricePerPerson} />
                        <span className="ml-1 text-[11px] font-bold text-[#E2E4E8]">/ хүн</span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {[c.hours, c.parking ? "Зогсоол" : null, c.soloFriendly ? "Ганцаараа OK" : null]
                          .filter(Boolean)
                          .map((x) => (
                            <span
                              key={String(x)}
                              className="border border-[#1E1E1E] px-1.5 py-0.5 text-[10px] font-semibold text-[#E2E4E8]"
                              style={{ borderRadius: 4 }}
                            >
                              {x}
                            </span>
                          ))}
                      </div>

                      <div className="mt-auto flex gap-3 pt-3">
                        {c.mapUrl && (
                          <a
                            href={c.mapUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-bold text-[#2E29FF] transition hover:underline"
                          >
                            Газрын зураг →
                          </a>
                        )}
                        {c.phone && (
                          <a href={`tel:${c.phone}`} className="text-[11px] font-bold text-[#E2E4E8] transition hover:text-[#2E29FF]">
                            Залгах
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
