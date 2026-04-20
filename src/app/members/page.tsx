"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { isAdminEmail } from "@/lib/adminClient";
import { formatDistanceToNow } from "@/lib/utils";
import { getLevelTitle } from "@/lib/xpClient";
import { useMembership } from "@/lib/useMembership";

interface Member {
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
}

export default function MembersPage() {
  const { loading: memberLoading, isMember, isAdmin, isLoggedIn } = useMembership();
  const [members, setMembers] = useState<Member[]>([]);
  const [totalMembers, setTotalMembers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      const res = await fetch("/api/members");
      const data = await res.json();
      if (res.ok) {
        const sorted = [...data.members].sort((a: Member, b: Member) => {
          const aAdmin = isAdminEmail(a.email);
          const bAdmin = isAdminEmail(b.email);
          if (aAdmin && !bAdmin) return -1;
          if (!aAdmin && bAdmin) return 1;
          return 0;
        });
        setMembers(sorted);
        setTotalMembers(data.totalMembers);
      }
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return members;
    const q = search.toLowerCase();
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.bio?.toLowerCase().includes(q)
    );
  }, [members, search]);

  const canAccess = isMember || isAdmin;

  if (memberLoading || loading) {
    return (
      <div className="-mx-5">
        <div className="px-5 pb-4 pt-2">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[2px] text-[#AAAAAA]">Нийгэмлэг</p>
              <h1 className="mt-1 text-[28px] font-bold leading-none tracking-tight text-[#E8E8E8] sm:text-[36px]">Гишүүд</h1>
            </div>
            <div className="flex items-center gap-1.5 pb-1">
              <div className="h-1.5 w-1.5 rounded-[4px] bg-[#EF2C58]" />
              <span className="text-[22px] font-bold tabular-nums text-[#E8E8E8]">—</span>
            </div>
          </div>
        </div>
        <div className="px-5 pt-4">
          <SkeletonList />
        </div>
      </div>
    );
  }

  // Non-member view: show count + CTA + blurred preview
  if (!canAccess) {
    return (
      <div className="-mx-5">
        {/* Header */}
        <div className="px-5 pb-4 pt-2">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[2px] text-[#AAAAAA]">Нийгэмлэг</p>
              <h1 className="mt-1 text-[28px] font-bold leading-none tracking-tight text-[#E8E8E8] sm:text-[36px]">Гишүүд</h1>
            </div>
            <div className="flex items-center gap-1.5 pb-1">
              <div className="h-1.5 w-1.5 rounded-[4px] bg-[#EF2C58]" />
              <span className="text-[22px] font-bold tabular-nums text-[#E8E8E8] sm:text-[28px]">{totalMembers}</span>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mx-5 rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#141414] p-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[4px] bg-[rgba(0,0,0,0.08)]">
            <svg className="h-7 w-7 text-[#EF2C58]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h2 className="text-[18px] font-bold text-[#E8E8E8]">
            Community-д нэгдээрэй
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-[#999999]">
            Кланд нэгдэж <span className="font-semibold text-[#EF2C58]">{totalMembers}</span> гишүүдтэй танилцаарай.
            Бие биенээсээ суралцаж, хамтдаа бүтээж, мессеж бичиж харилцаарай.
          </p>
          {isLoggedIn ? (
            <Link href="/clan" className="mt-5 inline-flex items-center gap-2 rounded-[4px] bg-[#EF2C58] px-6 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#D4264E]">
              Клан нэгдэх
            </Link>
          ) : (
            <div className="mt-5 flex items-center justify-center gap-3">
              <Link href="/auth/signup" className="rounded-[4px] bg-[#EF2C58] px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#D4264E]">
                Бүртгүүлэх
              </Link>
              <Link href="/auth/signin" className="rounded-[4px] border border-[rgba(255,255,255,0.08)] px-5 py-2.5 text-[13px] font-medium text-[#999999] transition hover:text-[#E8E8E8]">
                Нэвтрэх
              </Link>
            </div>
          )}
        </div>

        {/* Blurred member preview */}
        <div className="relative mt-4 px-5">
          <div className="pointer-events-none select-none blur-[6px]">
            <div className="space-y-0 divide-y divide-[rgba(255,255,255,0.06)]">
              {members.slice(0, 5).map((member) => {
                const initials = member.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
                return (
                  <div key={member._id} className="flex items-center gap-3 py-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[4px] bg-[rgba(0,0,0,0.08)] text-[11px] font-bold text-[#999999]">
                      {initials}
                    </div>
                    <div>
                      <div className="h-3 w-20 rounded bg-[rgba(0,0,0,0.08)]" />
                      <div className="mt-1.5 h-2.5 w-14 rounded bg-[rgba(0,0,0,0.08)]" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#F8F8F6]" />
        </div>
      </div>
    );
  }

  // Member view: full access
  return (
    <div className="-mx-5">
      {/* Header */}
      <div className="px-5 pb-4 pt-2">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[2px] text-[#AAAAAA]">Нийгэмлэг</p>
            <h1 className="mt-1 text-[28px] font-bold leading-none tracking-tight text-[#E8E8E8] sm:text-[36px]">Гишүүд</h1>
          </div>
          <div className="flex items-center gap-2 pb-1">
            <div className="h-1.5 w-1.5 rounded-[4px] bg-[#EF2C58]" />
            <span className="text-[22px] font-bold tabular-nums text-[#E8E8E8] sm:text-[28px]">{totalMembers}</span>
          </div>
        </div>
      </div>

      {/* Search + Chat link */}
      <div className="sticky top-[57px] z-30 border-b border-t border-[rgba(255,255,255,0.08)] bg-[rgba(6,6,8,0.92)] px-5 py-3 backdrop-blur-lg">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#AAAAAA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Гишүүн хайх..."
              className="w-full rounded-[4px] bg-[#141414] border border-[rgba(255,255,255,0.08)] py-2 pl-9 pr-3 text-[13px] text-[#E8E8E8] placeholder-[#AAAAAA] outline-none transition focus:border-[#EF2C58]/50"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#AAAAAA] transition hover:text-[#E8E8E8]">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <Link
            href="/chat"
            className="flex items-center gap-1.5 rounded-[4px] border border-[rgba(255,255,255,0.08)] px-3 py-2 text-[12px] font-medium text-[#999999] transition hover:border-[#2a2a35] hover:text-[#E8E8E8]"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span className="hidden sm:inline">Мессеж</span>
          </Link>
        </div>
        {search && (
          <p className="mt-2 text-[11px] text-[#AAAAAA]">{filtered.length} илэрц</p>
        )}
      </div>

      {/* Member List */}
      <div className="px-5 pt-2">
        {filtered.length === 0 && search ? (
          <div className="py-16 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-[4px] bg-[#141414] border border-[rgba(255,255,255,0.08)]">
              <svg className="h-5 w-5 text-[#AAAAAA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <p className="text-[14px] font-medium text-[#999999]">&ldquo;{search}&rdquo; илэрц олдсонгүй</p>
            <p className="mt-1 text-[12px] text-[#AAAAAA]">Өөр нэрээр хайж үзнэ үү</p>
          </div>
        ) : (
          <div className="divide-y divide-[rgba(255,255,255,0.06)]">
            {filtered.map((member, i) => (
              <MemberRow key={member._id} member={member} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Member Row with Level + Chat ─── */
function MemberRow({ member, index }: { member: Member; index: number }) {
  const { data: session } = useSession();
  const userId = (session?.user as { id?: string })?.id;
  const admin = isAdminEmail(member.email);
  const level = member.level || 1;
  const title = getLevelTitle(level);
  const isMe = userId === member._id;

  const initials = member.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const startChat = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const res = await fetch("/api/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId: member._id }),
      });
      const data = await res.json();
      if (res.ok && data.conversation) {
        window.location.href = `/chat/${data.conversation._id}`;
      }
    } catch {
      // ignore
    }
  };

  return (
    <Link
      href={`/profile/${member._id}`}
      className="group flex animate-fade-up items-center gap-3 py-3 transition active:bg-[#141414] sm:gap-3.5"
      style={{ animationDelay: `${Math.min(index * 25, 300)}ms`, animationFillMode: "both" }}
    >
      {/* Avatar */}
      <div className="relative shrink-0">
        {member.avatar ? (
          <img
            src={member.avatar}
            alt={member.name}
            className={`h-11 w-11 rounded-[4px] object-cover sm:h-12 sm:w-12 ${
              admin ? "ring-2 ring-[#EF2C58] ring-offset-1 ring-offset-[#F8F8F6]" : ""
            }`}
          />
        ) : (
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-[4px] text-[12px] font-bold sm:h-12 sm:w-12 ${
              admin ? "bg-[#EF2C58] text-white" : "bg-[rgba(0,0,0,0.08)] text-[#999999]"
            }`}
          >
            {initials}
          </div>
        )}
        {admin && (
          <div className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-[4px] bg-[#EF2C58]">
            <svg className="h-2.5 w-2.5 text-black" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className={`truncate text-[14px] font-semibold transition group-hover:text-[#EF2C58] ${admin ? "text-[#EF2C58]" : "text-[#E8E8E8]"}`}>
            {member.name}
          </p>
          {admin && (
            <span className="shrink-0 rounded-[4px] bg-[rgba(239,44,88,0.08)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#EF2C58]">
              Үндэслэгч
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <span className="shrink-0 text-[10px] font-bold text-[#EF2C58]">LV.{level}</span>
          <span className="text-[10px] text-[#AAAAAA]">{title.titleMN}</span>
          {member.bio && (
            <>
              <span className="text-[10px] text-[rgba(0,0,0,0.08)]">·</span>
              <p className="truncate text-[11px] text-[#999999]">{member.bio}</p>
            </>
          )}
        </div>
      </div>

      {/* Chat button or join date */}
      <div className="flex shrink-0 items-center gap-2">
        {member.clanJoinedAt && (
          <span className="hidden text-[10px] text-[#AAAAAA] sm:block">
            {formatDistanceToNow(member.clanJoinedAt)}
          </span>
        )}
        {!isMe && (
          <button
            onClick={startChat}
            className="flex h-8 w-8 items-center justify-center rounded-[4px] border border-[rgba(255,255,255,0.08)] text-[#AAAAAA] transition hover:border-[#EF2C58]/30 hover:text-[#EF2C58]"
            title="Мессеж"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </button>
        )}
      </div>
    </Link>
  );
}

/* ─── Skeleton ─── */
function SkeletonList() {
  return (
    <div className="divide-y divide-[rgba(255,255,255,0.06)]">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-3">
          <div className="h-11 w-11 shrink-0 animate-pulse rounded-[4px] bg-[rgba(0,0,0,0.08)]" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-24 animate-pulse rounded-[4px] bg-[rgba(0,0,0,0.08)]" />
            <div className="h-2.5 w-36 animate-pulse rounded-[4px] bg-[rgba(0,0,0,0.08)]" />
          </div>
        </div>
      ))}
    </div>
  );
}
