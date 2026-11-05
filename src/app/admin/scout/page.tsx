"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

/* ─── /admin/scout — агентын сурлагын самбар ───────────────────────────────
   Энэ хуудас "AI хэр ухаантай вэ" гэдгийг хэмждэггүй. Хэмждэг зүйл нь:
   хүмүүс юу асуусан, бид хэдэн удаа ХАРИУЛЖ ЧАДААГҮЙ вэ. Хоёр дахь тоо нь
   бүтээгдэхүүний жинхэнэ явцын үзүүлэлт — түүнийг буулгах цорын ганц арга
   бол /admin/restaurants дээр өгөгдөл нэмэх.                              */

interface Gap { _id: string; question: string; createdAt: string }
interface Recent {
  _id: string; question: string; reply: string; resultCount: number;
  createdAt: string; ms: number; provider: string;
  user?: { name?: string; email?: string } | null;
}
interface Data {
  kpi: {
    total: number; last7: number; last30: number; zeroTotal: number;
    users: number; restaurants: number; verified: number; avgMs: number; gapRate: number;
  };
  gaps: Gap[];
  recent: Recent[];
  districts: { _id: string; n: number }[];
  tools: { _id: string; n: number }[];
}

function Tile({ label, value, sub, warn }: { label: string; value: string | number; sub?: string; warn?: boolean }) {
  return (
    <div className="border border-[#1E1E1E] bg-[#0A0A0A] px-4 py-3.5" style={{ borderRadius: 4 }}>
      <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#E2E4E8]">{label}</div>
      <div
        className={`mt-1.5 text-[24px] font-extrabold leading-none tracking-[-0.03em] ${warn ? "text-[#2E29FF]" : "text-[#F2F2F4]"}`}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </div>
      {sub && <div className="mt-1 text-[10.5px] text-[#E2E4E8]">{sub}</div>}
    </div>
  );
}

function when(iso: string) {
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 60) return `${mins}м`;
  if (mins < 1440) return `${Math.round(mins / 60)}ц`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function AdminScout() {
  const [d, setD] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    () =>
      fetch("/api/admin/scout")
        .then((r) => r.json())
        .then((j) => {
          if (j?.kpi) setD(j as Data);
          setLoading(false);
        })
        .catch(() => setLoading(false)),
    []
  );
  useEffect(() => { void load(); }, [load]);

  return (
    <div className="px-4 py-6 md:px-8">
      <div className="border-b border-[#1E1E1E] pb-5">
        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#2E29FF]">SCOUT · LEARNING</div>
        <h1 className="mt-1 text-[22px] font-extrabold tracking-[-0.02em] text-[#F2F2F4]">Агент юу сурч байна</h1>
        <p className="mt-1 max-w-2xl text-[12px] leading-[1.6] text-[#E2E4E8]">
          Хамгийн чухал тоо нь &ldquo;хариулт олдоогүй&rdquo;. Тэр жагсаалт бол дараа юу
          нэмэхийг ТААМАГЛАХ биш, ХЭМЖИХ арга.{" "}
          <Link href="/admin/restaurants" className="text-[#2E29FF] underline">Ресторан сан →</Link>
        </p>
      </div>

      {loading && <p className="mt-6 text-[13px] text-[#E2E4E8]">Уншиж байна…</p>}

      {d && (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <Tile label="Асуулт · 7 хоног" value={d.kpi.last7} sub={`нийт ${d.kpi.total}`} />
            <Tile label="Хариулт олдоогүй" value={`${d.kpi.gapRate}%`} sub={`${d.kpi.zeroTotal} / 30 хоног`} warn={d.kpi.gapRate > 20} />
            <Tile label="Профайлтай хүн" value={d.kpi.users} sub="ой хуримтлуулж буй" />
            <Tile label="Ресторан" value={d.kpi.restaurants} sub={`${d.kpi.verified} баталгаажсан`} warn={d.kpi.verified === 0} />
            <Tile label="Дундаж хугацаа" value={`${(d.kpi.avgMs / 1000).toFixed(1)}с`} sub="7 хоног" />
            <Tile label="Хэрэгсэл дуудалт" value={d.tools.reduce((s, t) => s + t.n, 0)} sub="30 хоног" />
          </div>

          <div className="mt-7 grid gap-6 lg:grid-cols-2">
            {/* ─── Нүх ─── */}
            <div>
              <h2 className="text-[13px] font-extrabold text-[#F2F2F4]">
                Хариулт олдоогүй асуултууд
                <span className="ml-2 text-[11px] font-bold text-[#E2E4E8]">← энэ бол хийх ажлын жагсаалт</span>
              </h2>
              <div className="mt-3 flex flex-col">
                {d.gaps.length === 0 && (
                  <p className="text-[12.5px] text-[#E2E4E8]">Одоогоор нүх алга. Сан асуултуудыг хангаж байна.</p>
                )}
                {d.gaps.map((g) => (
                  <div key={g._id} className="flex items-start justify-between gap-3 border-b border-[#141414] py-2.5">
                    <span className="text-[13px] leading-[1.5] text-[#F2F2F4]">{g.question}</span>
                    <span className="shrink-0 text-[10.5px] text-[#E2E4E8]">{when(g.createdAt)}</span>
                  </div>
                ))}
              </div>

              {d.districts.length > 0 && (
                <>
                  <h2 className="mt-7 text-[13px] font-extrabold text-[#F2F2F4]">
                    Хэрэглэгчид хаана байдаг вэ
                  </h2>
                  <div className="mt-3 flex flex-col">
                    {d.districts.map((x) => (
                      <div key={x._id} className="flex items-center justify-between border-b border-[#141414] py-2">
                        <span className="text-[13px] text-[#F2F2F4]">{x._id}</span>
                        <span className="text-[13px] font-bold text-[#E2E4E8]" style={{ fontVariantNumeric: "tabular-nums" }}>{x.n}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* ─── Сүүлийн асуултууд ─── */}
            <div>
              <h2 className="text-[13px] font-extrabold text-[#F2F2F4]">Сүүлийн асуултууд</h2>
              <div className="mt-3 flex flex-col">
                {d.recent.length === 0 && (
                  <p className="text-[12.5px] text-[#E2E4E8]">Хараахан асуулт алга.</p>
                )}
                {d.recent.map((r) => (
                  <div key={r._id} className="border-b border-[#141414] py-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-[13px] font-semibold leading-[1.5] text-[#F2F2F4]">{r.question}</span>
                      <span className="shrink-0 text-[10.5px] text-[#E2E4E8]">{when(r.createdAt)}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[10.5px] text-[#E2E4E8]">
                      <span>{r.user?.name || r.user?.email || "?"}</span>
                      <span>·</span>
                      <span className={r.resultCount === 0 ? "font-bold text-[#2E29FF]" : ""}>
                        {r.resultCount} үр дүн
                      </span>
                      <span>·</span>
                      <span>{(r.ms / 1000).toFixed(1)}с</span>
                      <span>·</span>
                      <span>{r.provider}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
