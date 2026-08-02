"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { isAdminEmail } from "@/lib/adminClient";
import { getLevelTitle } from "@/lib/xpClient";

interface Conqueror {
  _id: string;
  name: string;
  email?: string;
  avatar?: string;
  bio?: string;
  clan: string;
  clanJoinedAt?: string;
  createdAt?: string;
  xp?: number;
  level?: number;
  mintNumber: number;
}

const TOTAL_SUPPLY = 100; // genesis cap

export default function ConquerorsPage() {
  const { data: session } = useSession();
  const [members, setMembers] = useState<Conqueror[]>([]);
  const [totalMinted, setTotalMinted] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/members")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.members)) {
          setMembers(data.members);
          setTotalMinted(data.totalMinted ?? data.totalMembers ?? data.members.length);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return members;
    const q = search.toLowerCase();
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.bio?.toLowerCase().includes(q) ||
        String(m.mintNumber).includes(q)
    );
  }, [members, search]);

  const isLoggedIn = !!session?.user;
  const myId = (session?.user as { id?: string } | undefined)?.id;
  const remainingMint = Math.max(0, TOTAL_SUPPLY - totalMinted);

  return (
    <div className="-mx-5">
      {/* ─── Genesis Header ─── */}
      <div className="relative overflow-hidden border-b border-[#E6E6E6] bg-[#FAFAF8] px-5 py-8">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.5]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(23,23,23,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(23,23,23,0.035) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#1080CA] opacity-[0.05] blur-[90px]" />

        <div className="relative">
          <div className="flex items-center gap-2">
            <div className="h-[2px] w-6 bg-[#1080CA]" />
            <span className="chrome text-[10px] font-bold text-[#1080CA]">
              GENESIS · {String(TOTAL_SUPPLY).padStart(3, "0")}
            </span>
          </div>
          <h1
            className="mt-3 text-[34px] font-extrabold leading-[0.95] text-[#171717] sm:text-[42px]"
            style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.01em" }}
          >
            CONQUERORS
          </h1>
          <p className="chrome mt-2 text-[11px] text-[#6B6B72]">
            Байлдан дагуулагчид · Edgerunners
          </p>

          <p className="mt-4 max-w-xl text-[13px] leading-relaxed text-[#6B6B72]">
            Энэ бол зүгээр гишүүд биш. Эзэнт гүрэнд нэгдсэн{" "}
            <span className="font-bold text-[#171717]">conqueror</span>-уудын төрсний бүртгэл —
            mint number бүрд нэг хүн, нэг archetype, нэг түүх.
          </p>

          <div className="mt-6 flex flex-wrap items-end gap-5">
            <div>
              <div className="chrome text-[10px] text-[#5b6573]">Minted</div>
              <div className="mt-0.5 flex items-baseline gap-1">
                <span className="font-mono text-[26px] font-black leading-none tabular-nums text-[#171717]">
                  {String(totalMinted).padStart(3, "0")}
                </span>
                <span className="font-mono text-[16px] font-bold tabular-nums text-[#B8B8BD]">
                  / {String(TOTAL_SUPPLY).padStart(3, "0")}
                </span>
              </div>
            </div>
            <div className="h-10 w-px bg-[#E6E6E6]" />
            <div>
              <div className="chrome text-[10px] text-[#5b6573]">Remaining</div>
              <div className="mt-0.5 font-mono text-[22px] font-black tabular-nums text-[#1080CA]">
                {String(remainingMint).padStart(3, "0")}
              </div>
            </div>
            <Link
              href={isLoggedIn ? "/clan" : "/auth/signup"}
              className="ml-auto inline-flex items-center gap-2 rounded-none bg-[#1080CA] px-5 py-2.5 text-[13px] font-bold text-[#0E0E10] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#4FA8E8] hover:shadow-[0_10px_26px_rgba(16,128,202,0.28)]"
            >
              {isLoggedIn ? "Mint өөрийн archetype" : "Conqueror болох"}
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5-5 5M6 12h12" />
              </svg>
            </Link>
          </div>
        </div>
      </div>

      {/* ─── Search ─── */}
      <div className="sticky top-[57px] z-30 border-b border-[#E6E6E6] bg-[rgba(15,23,38,0.9)] px-5 py-3 backdrop-blur-lg">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5b6573]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Conqueror хайх (нэр / # / bio)..."
              className="w-full rounded-none border border-[#E6E6E6] bg-white py-2 pl-9 pr-3 text-[13px] text-[#171717] placeholder-[#5b6573] outline-none transition focus:border-[rgba(16,128,202,0.45)]"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#5b6573] transition hover:text-[#171717]">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          {isLoggedIn && (
            <Link
              href="/chat"
              className="flex items-center gap-1.5 rounded-none border border-[#E6E6E6] bg-white px-3 py-2 text-[12px] font-medium text-[#6B6B72] transition hover:border-[rgba(16,128,202,0.4)] hover:text-[#171717]"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="hidden sm:inline">Мессеж</span>
            </Link>
          )}
        </div>
        {search && <p className="mt-2 text-[11px] text-[#5b6573]">{filtered.length} илэрц</p>}
      </div>

      {/* ─── Card Grid ─── */}
      <div className="px-5 py-5">
        {loading ? (
          <CardGridSkeleton />
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-[14px] font-medium text-[#6B6B72]">
              {search ? `"${search}" илэрцгүй` : "Conqueror хараахан байхгүй"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {filtered.map((m, i) => (
              <ConquerorCard
                key={m._id}
                conqueror={m}
                isMe={!!myId && myId === m._id}
                animDelay={Math.min(i * 30, 400)}
              />
            ))}

            {!search && remainingMint > 0 &&
              Array.from({ length: Math.min(remainingMint, 4) }).map((_, i) => (
                <EmptyMintCard
                  key={`empty-${i}`}
                  mintNumber={totalMinted + i + 1}
                  isLoggedIn={isLoggedIn}
                />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────────── Conqueror Card ───────────────────────────── */
function ConquerorCard({
  conqueror,
  isMe,
  animDelay,
}: {
  conqueror: Conqueror;
  isMe: boolean;
  animDelay: number;
}) {
  const admin = isAdminEmail(conqueror.email);
  const level = conqueror.level || 1;
  const title = getLevelTitle(level);
  const initials = conqueror.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const accent = admin ? "#C99700" : "#1080CA";
  const mintLabel = `#${String(conqueror.mintNumber).padStart(3, "0")}`;
  // No avatar → a member without a finished profile. Render a deliberate
  // skeleton placeholder by default (not awkward faint initials) so the
  // grid stays clean and the state reads as intentional.
  const noProfile = !conqueror.avatar;

  return (
    <Link
      href={`/profile/${conqueror._id}`}
      className="group relative block animate-fade-up overflow-hidden rounded-none border bg-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(16,128,202,0.16)]"
      style={{
        borderColor: admin ? "rgba(201,151,0,0.4)" : "#E6E6E6",
        animationDelay: `${animDelay}ms`,
        animationFillMode: "both",
      }}
    >
      <div className="flex items-center justify-between border-b border-[#EFEFEF] px-2.5 py-1.5">
        <span
          className="font-mono text-[11px] font-black tabular-nums tracking-[0.05em]"
          style={{ color: accent }}
        >
          {mintLabel}
        </span>
        <span className="font-mono text-[9px] font-bold tracking-[0.15em] text-[#B8B8BD]">
          LV.{String(level).padStart(2, "0")}
        </span>
      </div>

      <div className="relative aspect-square overflow-hidden bg-[#F2F2F0]">
        {noProfile ? (
          <div className="absolute inset-0">
            {/* shimmer skeleton */}
            <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-[#F4F4F2] via-[#ECECEA] to-[#F4F4F2]" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#E0E0DD] bg-white/70 text-[15px] font-extrabold text-[#C4C4C0]">
                {initials || "··"}
              </div>
              <div className="h-2 w-16 rounded-full bg-[#E2E2DF]" />
              <div className="h-2 w-10 rounded-full bg-[#E8E8E5]" />
            </div>
          </div>
        ) : (
          <>
            <div
              className="absolute inset-0 opacity-25 transition-opacity duration-500 group-hover:opacity-45"
              style={{ background: `radial-gradient(120% 80% at 50% 100%, ${accent}22 0%, transparent 60%)` }}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={conqueror.avatar}
              alt={conqueror.name}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            />
          </>
        )}

        {admin && (
          <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border border-[rgba(201,151,0,0.35)] bg-white shadow-sm">
            <svg className="h-3 w-3 text-[#C99700]" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </div>
        )}
        {isMe && (
          <div className="absolute left-2 top-2 rounded-none bg-[#1080CA] px-1.5 py-0.5 font-mono text-[8px] font-black uppercase tracking-[0.18em] text-[#0E0E10]">
            YOU
          </div>
        )}

        {!noProfile && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/45 to-transparent px-2.5 pb-2 pt-7">
            <p className="truncate text-[13px] font-bold leading-tight text-white" title={conqueror.name}>
              {conqueror.name}
            </p>
            <p
              className="mt-0.5 truncate font-mono text-[9px] font-bold uppercase tracking-[0.18em]"
              style={{ color: admin ? "#FFD86B" : "#FF7E9B" }}
            >
              {admin ? "FOUNDER · ҮНДЭСЛЭГЧ" : title.titleEN.toUpperCase()}
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-2.5 py-1.5 text-[10px]">
        {noProfile ? (
          <span className="truncate font-medium text-[#171717]" title={conqueror.name}>
            {conqueror.name}
          </span>
        ) : (
          <span className="truncate text-[#6b7280]" title={title.titleMN}>
            {title.titleMN}
          </span>
        )}
        {conqueror.xp != null && (
          <span className="font-mono tabular-nums text-[#B8B8BD]">
            {conqueror.xp.toLocaleString()} XP
          </span>
        )}
      </div>
    </Link>
  );
}

/* ───────────────────────────── Empty Mint Card ──────────────────────────── */
function EmptyMintCard({ mintNumber, isLoggedIn }: { mintNumber: number; isLoggedIn: boolean }) {
  const mintLabel = `#${String(mintNumber).padStart(3, "0")}`;
  return (
    <Link
      href={isLoggedIn ? "/clan" : "/auth/signup"}
      className="group relative block overflow-hidden rounded-none border-2 border-dashed border-[rgba(16,128,202,0.22)] bg-[rgba(16,128,202,0.025)] transition-all duration-300 hover:border-[rgba(16,128,202,0.6)] hover:bg-[rgba(16,128,202,0.05)]"
    >
      <div className="flex items-center justify-between border-b border-[rgba(16,128,202,0.12)] px-2.5 py-1.5">
        <span className="font-mono text-[11px] font-black tabular-nums tracking-[0.05em] text-[#C9A0AE]">
          {mintLabel}
        </span>
        <span className="font-mono text-[9px] font-bold tracking-[0.15em] text-[#C9A0AE]">
          UNMINTED
        </span>
      </div>
      <div className="relative flex aspect-square items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(16,128,202,0.1)] transition group-hover:bg-[rgba(16,128,202,0.18)]">
            <svg className="h-4 w-4 text-[#1080CA]" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#A9A9AE] transition group-hover:text-[#1080CA]">
            CLAIM SLOT
          </p>
        </div>
      </div>
      <div className="px-2.5 py-1.5 text-[10px] text-[#B8B8BD]">empty archetype</div>
    </Link>
  );
}

/* ───────────────────────────── Skeleton ───────────────────────────── */
function CardGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-none border border-[#E6E6E6] bg-white">
          <div className="h-7 animate-pulse bg-[#F2F2F0]" />
          <div className="aspect-square animate-pulse bg-[#ECECEA]" />
          <div className="h-7 animate-pulse bg-[#F2F2F0]" />
        </div>
      ))}
    </div>
  );
}
