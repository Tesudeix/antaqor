import type { Metadata } from "next";
import Link from "next/link";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import Payment from "@/models/Payment";
import { FOUNDING_CAP } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Founding 100 · Antaqor",
  description: "Эхний 100 гишүүн — Antaqor хүрээлэлийн анхдагч. The first hundred who believed in Antaqor before it was a name.",
  openGraph: {
    title: "Founding 100 · Antaqor",
    description: "The first 100 founders of Antaqor хүрээлэл. 3-month founding term · Permanent wall.",
    type: "website",
    url: "https://antaqor.com/founders",
  },
};

// ISR — re-render the wall every 60s so the count stays roughly live without
// hammering the DB on every page view.
export const revalidate = 60;

interface FounderLean {
  _id: { toString(): string };
  name: string;
  avatar?: string;
  clanJoinedAt?: Date;
  level?: number;
}

// ─── A founder is someone who PAID ───
// This wall used to list `User.find({ clan: { $ne: "" } })` — everyone with a
// clan string set, which on the live database is 73 people against 6 actual
// paid memberships. So the wall claimed 73/100 seats were gone while 94 were
// really still open: it was inflating scarcity with people who had never paid,
// and the "Claim seat #074" button was offering a seat number that meant
// nothing. A seat is a paid founding payment, and nothing else.
export default async function FoundersPage() {
  await dbConnect();

  const paid = await Payment.find({ kind: "membership", plan: "founding", status: "paid" })
    .sort({ paidAt: 1, createdAt: 1 })
    .limit(FOUNDING_CAP)
    .select("user paidAt createdAt")
    .lean();

  const seatOrder = (paid as unknown as { user?: { toString(): string } }[])
    .map((p) => (p.user ? String(p.user) : ""))
    .filter(Boolean);

  const users = seatOrder.length
    ? ((await User.find({ _id: { $in: seatOrder } })
        .select("name avatar clanJoinedAt level")
        .lean()) as unknown as FounderLean[])
    : [];

  // Keep the order the seats were actually bought in, not Mongo's.
  const byId = new Map(users.map((u) => [String(u._id), u]));
  const founders = seatOrder
    .map((id) => byId.get(id))
    .filter(Boolean) as FounderLean[];

  const claimed = founders.length;
  const remaining = Math.max(0, FOUNDING_CAP - claimed);
  const filledPct = Math.round((claimed / FOUNDING_CAP) * 100);
  const nextSeat = String(claimed + 1).padStart(3, "0");

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 md:py-12">
      <div className="space-y-6">
        {/* ─── HUD status strip ─── */}
        <div className="flex items-center justify-between rounded-[4px] border border-[rgba(15,23,38,0.08)] bg-[#ffffff] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-[#E2E4E8]">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#2E29FF]" />
              FOUNDING 100
            </span>
            <span className="hidden sm:inline text-[#E2E4E8]">· ХҮРЭЭЛЭЛ</span>
          </div>
          <div className="flex items-center gap-2 tabular-nums">
            <span className="text-[#0e1726]">{claimed}/{FOUNDING_CAP}</span>
            <span className="text-[#E2E4E8]">·</span>
            <span className="text-[#2E29FF]">{remaining} ҮЛДСЭН</span>
          </div>
        </div>

        {/* ─── Title + manifesto ─── */}
        <div className="space-y-3">
          <h1 className="text-[26px] md:text-[44px] font-black leading-[0.95] tracking-tight text-[#0e1726] md:text-[72px]">
            FOUNDING <span className="text-[#2E29FF]">100</span>
            <span className="text-[#2E29FF]">.</span>
          </h1>
          <p className="max-w-2xl text-[14px] leading-relaxed text-[#E2E4E8] md:text-[16px]">
            Эхний 100 хүн. The first hundred who believed in Antaqor хүрээлэл before it was a name. 3 сарын бүрэн эрх · grandfathered pricing · энэ хананд насан турш нэр.
          </p>
        </div>

        {/* ─── Progress card + claim CTA ─── */}
        <div className="rounded-[4px] border border-[rgba(46,41,255,0.30)] bg-gradient-to-br from-[rgba(46,41,255,0.08)] via-[#ffffff] to-[#ffffff] p-4 md:p-5">
          <div className="mb-3 flex items-baseline justify-between font-mono">
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#2E29FF]">CLAIMED</span>
            <span className="text-[22px] font-black tabular-nums text-[#0e1726]">
              {claimed}
              <span className="text-[14px] text-[#E2E4E8]"> / {FOUNDING_CAP}</span>
            </span>
          </div>
          <div className="mb-4 h-2 overflow-hidden rounded-[4px] bg-[rgba(15,23,38,0.06)]">
            <div
              className="h-full bg-gradient-to-r from-[#2E29FF] to-[#f2547a] transition-all duration-700"
              style={{ width: `${filledPct}%` }}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="font-mono text-[11px] uppercase tracking-wider">
              <span className="text-[#0e1726] font-black">₮49,000</span>
              <span className="ml-1.5 text-[#E2E4E8]">3 САР · ENDS AT 100</span>
            </div>
            {remaining > 0 ? (
              <Link
                href="/clan?pay=1"
                className="rounded-[4px] bg-[#2E29FF] px-4 py-2 text-[12px] font-black uppercase tracking-wider text-white transition hover:brightness-110"
              >
                Claim seat #{nextSeat} →
              </Link>
            ) : (
              <span className="rounded-[4px] border border-[rgba(15,23,38,0.10)] bg-black px-4 py-2 font-mono text-[10px] font-black uppercase tracking-wider text-[#E2E4E8]">
                FULL · NO MORE SEATS
              </span>
            )}
          </div>
        </div>

        {/* ─── Roll call grid — all 100 slots, filled or open ─── */}
        <div>
          <div className="mb-3 flex items-baseline justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#E2E4E8]">THE 100 · ROLL CALL</span>
            <span className="font-mono text-[10px] tabular-nums text-[#E2E4E8]">
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
                    className="group flex items-center justify-center gap-2 rounded-[4px] border border-dashed border-[rgba(15,23,38,0.10)] bg-[#ffffff] p-3 text-center transition hover:border-[#2E29FF] hover:bg-[rgba(46,41,255,0.04)]"
                  >
                    <span className="font-mono text-[12px] font-bold tabular-nums text-[#E2E4E8] group-hover:text-[#2E29FF]">
                      #{num}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[#E2E4E8] group-hover:text-[#2E29FF]">
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
                  className="group flex items-center gap-2 rounded-[4px] border border-[rgba(15,23,38,0.06)] bg-[#ffffff] p-2.5 transition hover:border-[rgba(46,41,255,0.40)] hover:bg-[rgba(46,41,255,0.03)] hover:shadow-[0_0_24px_rgba(46,41,255,0.06)]"
                >
                  <span className="shrink-0 font-mono text-[10px] font-black tabular-nums text-[#2E29FF]">
                    #{num}
                  </span>
                  {f.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={f.avatar}
                      alt={f.name}
                      className="h-7 w-7 shrink-0 rounded-[4px] object-cover"
                    />
                  ) : (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] bg-[#F2F2F4] text-[10px] font-bold text-[#E2E4E8]">
                      {(f.name || "?").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] font-bold text-[#0e1726] group-hover:text-[#0e1726]">
                      {f.name || "Founder"}
                    </div>
                    <div className="font-mono text-[11px] tabular-nums text-[#E2E4E8]">
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
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-[#E2E4E8]">
            ХҮРЭЭЛЭЛ · ANTAQOR
          </p>
          <p className="mt-1 font-mono text-[10px] tabular-nums text-[#E2E4E8]">
            Лимитлэг 100 · Founding term closes when full
          </p>
        </div>
      </div>
    </main>
  );
}
