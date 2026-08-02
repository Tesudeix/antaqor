import type { Metadata } from "next";
import Link from "next/link";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

export const metadata: Metadata = {
  title: "Founding 100 · Antaqor",
  description: "Эхний 100 гишүүн — Edgerunners-ийн анхдагч. The first hundred who believed in Antaqor before it was a name.",
  openGraph: {
    title: "Founding 100 · Antaqor",
    description: "The first 100 founders of Edgerunners. Lifetime tier · Permanent wall.",
    type: "website",
    url: "https://antaqor.com/founders",
  },
};

// ISR — re-render the wall every 60s so the count stays roughly live without
// hammering the DB on every page view.
export const revalidate = 60;

const FOUNDING_CAP = 100;

interface FounderLean {
  _id: { toString(): string };
  name: string;
  avatar?: string;
  clanJoinedAt?: Date;
  level?: number;
}

export default async function FoundersPage() {
  await dbConnect();
  const raw = await User.find({ clan: { $ne: "" } })
    .sort({ clanJoinedAt: 1, createdAt: 1 })
    .limit(FOUNDING_CAP)
    .select("name avatar clanJoinedAt level")
    .lean();
  const founders = raw as unknown as FounderLean[];
  const claimed = founders.length;
  const remaining = Math.max(0, FOUNDING_CAP - claimed);
  const filledPct = Math.round((claimed / FOUNDING_CAP) * 100);
  const nextSeat = String(claimed + 1).padStart(3, "0");

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 md:py-12">
      <div className="space-y-6">
        {/* ─── HUD status strip ─── */}
        <div className="flex items-center justify-between rounded-none border border-[rgba(15,23,38,0.08)] bg-[#ffffff] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-[#6b7280]">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#1080CA]" />
              FOUNDING 100
            </span>
            <span className="hidden sm:inline text-[#6b7280]">· EDGERUNNERS</span>
          </div>
          <div className="flex items-center gap-2 tabular-nums">
            <span className="text-[#0e1726]">{claimed}/{FOUNDING_CAP}</span>
            <span className="text-[#94a3b8]">·</span>
            <span className="text-[#1080CA]">{remaining} ҮЛДСЭН</span>
          </div>
        </div>

        {/* ─── Title + manifesto ─── */}
        <div className="space-y-3">
          <h1 className="text-[44px] font-black leading-[0.95] tracking-tight text-[#0e1726] md:text-[72px]">
            FOUNDING <span className="text-[#1080CA]">100</span>
            <span className="text-[#1080CA]">.</span>
          </h1>
          <p className="max-w-2xl text-[14px] leading-relaxed text-[#5b6573] md:text-[16px]">
            Эхний 100 хүн. The first hundred who believed in Edgerunners before it was a name. Lifetime member · grandfathered pricing · permanent name on this wall.
          </p>
        </div>

        {/* ─── Progress card + claim CTA ─── */}
        <div className="rounded-none border border-[rgba(16,128,202,0.30)] bg-gradient-to-br from-[rgba(16,128,202,0.08)] via-[#ffffff] to-[#ffffff] p-4 md:p-5">
          <div className="mb-3 flex items-baseline justify-between font-mono">
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#1080CA]">CLAIMED</span>
            <span className="text-[22px] font-black tabular-nums text-[#0e1726]">
              {claimed}
              <span className="text-[14px] text-[#6b7280]"> / {FOUNDING_CAP}</span>
            </span>
          </div>
          <div className="mb-4 h-2 overflow-hidden rounded-none bg-[rgba(15,23,38,0.06)]">
            <div
              className="h-full bg-gradient-to-r from-[#1080CA] to-[#f2547a] transition-all duration-700"
              style={{ width: `${filledPct}%` }}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="font-mono text-[11px] uppercase tracking-wider">
              <span className="text-[#0e1726] font-black">₮49,000</span>
              <span className="ml-1.5 text-[#6b7280]">LIFETIME · ENDS AT 100</span>
            </div>
            {remaining > 0 ? (
              <Link
                href="/clan?pay=1"
                className="rounded-none bg-[#1080CA] px-4 py-2 text-[12px] font-black uppercase tracking-wider text-[#0E0E10] transition hover:brightness-110"
              >
                Claim seat #{nextSeat} →
              </Link>
            ) : (
              <span className="rounded-none border border-[rgba(15,23,38,0.10)] bg-black px-4 py-2 font-mono text-[10px] font-black uppercase tracking-wider text-[#6b7280]">
                FULL · NO MORE SEATS
              </span>
            )}
          </div>
        </div>

        {/* ─── Roll call grid — all 100 slots, filled or open ─── */}
        <div>
          <div className="mb-3 flex items-baseline justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#6b7280]">THE 100 · ROLL CALL</span>
            <span className="font-mono text-[10px] tabular-nums text-[#94a3b8]">
              {filledPct}% FILLED
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {Array.from({ length: FOUNDING_CAP }).map((_, i) => {
              const f = founders[i];
              const num = String(i + 1).padStart(3, "0");
              if (!f) {
                return (
                  <Link
                    key={`open-${i}`}
                    href="/clan?pay=1"
                    className="group flex items-center justify-center gap-2 rounded-none border border-dashed border-[rgba(15,23,38,0.10)] bg-[#ffffff] p-3 text-center transition hover:border-[#1080CA] hover:bg-[rgba(16,128,202,0.04)]"
                  >
                    <span className="font-mono text-[12px] font-bold tabular-nums text-[#94a3b8] group-hover:text-[#1080CA]">
                      #{num}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[#6b7280] group-hover:text-[#1080CA]">
                      OPEN
                    </span>
                  </Link>
                );
              }
              const joined = f.clanJoinedAt ? new Date(f.clanJoinedAt) : null;
              const dateLabel = joined
                ? `${String(joined.getFullYear()).slice(2)}.${String(joined.getMonth() + 1).padStart(2, "0")}.${String(joined.getDate()).padStart(2, "0")}`
                : "—";
              const id = String(f._id);
              return (
                <Link
                  key={id}
                  href={`/profile/${id}`}
                  className="group flex items-center gap-2 rounded-none border border-[rgba(15,23,38,0.06)] bg-[#ffffff] p-2.5 transition hover:border-[rgba(16,128,202,0.40)] hover:bg-[rgba(16,128,202,0.03)] hover:shadow-[0_0_24px_rgba(16,128,202,0.06)]"
                >
                  <span className="shrink-0 font-mono text-[10px] font-black tabular-nums text-[#1080CA]">
                    #{num}
                  </span>
                  {f.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={f.avatar}
                      alt={f.name}
                      className="h-7 w-7 shrink-0 rounded-none object-cover"
                    />
                  ) : (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-none bg-[#F2F2F4] text-[10px] font-bold text-[#6b7280]">
                      {(f.name || "?").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] font-bold text-[#0e1726] group-hover:text-[#0e1726]">
                      {f.name || "Founder"}
                    </div>
                    <div className="font-mono text-[9px] tabular-nums text-[#94a3b8]">
                      {dateLabel}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* ─── Footer / brand ─── */}
        <div className="border-t border-[rgba(15,23,38,0.06)] pt-6 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-[#6b7280]">
            EDGERUNNERS · ANTAQOR
          </p>
          <p className="mt-1 font-mono text-[10px] tabular-nums text-[#94a3b8]">
            Лимитлэг 100 · Lifetime tier closes when full
          </p>
        </div>
      </div>
    </main>
  );
}
