"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Member {
  _id: string;
  name: string;
  avatar?: string;
  clanJoinedAt?: string;
}

function timeAgo(iso?: string): string {
  if (!iso) return "сая";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "сая";
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ц`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} өдөр`;
  return new Date(iso).toLocaleDateString("mn-MN", { month: "short", day: "numeric" });
}

export default function RecentPaidMembers({ limit = 5 }: { limit?: number }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancel = false;
    fetch("/api/members")
      .then((r) => r.json())
      .then((d) => { if (!cancel && Array.isArray(d.members)) setMembers(d.members.slice(0, limit)); })
      .catch(() => {})
      .finally(() => { if (!cancel) setLoaded(true); });
    return () => { cancel = true; };
  }, [limit]);

  if (!loaded || members.length === 0) return null;

  return (
    <div className="rounded-[4px] border border-[rgba(239,44,88,0.18)] bg-gradient-to-br from-[rgba(239,44,88,0.05)] via-[#0E0E0E] to-[#0B0B0B] p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#22C55E]" />
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#EF2C58]">
          СҮҮЛД НЭГДСЭН
        </span>
      </div>

      {/* Avatar overlap stack */}
      <div className="flex items-center gap-3">
        <div className="flex -space-x-2">
          {members.slice(0, 4).map((m, i) => (
            <Link
              key={m._id}
              href={`/profile/${m._id}`}
              className="relative h-8 w-8 overflow-hidden rounded-full border-2 border-[#0F0F10] transition hover:z-10 hover:scale-110"
              style={{ zIndex: members.length - i }}
              title={m.name}
            >
              {m.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.avatar} alt={m.name} className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-[rgba(239,44,88,0.18)] text-[12px] font-black text-[#EF2C58]">
                  {m.name.charAt(0)}
                </span>
              )}
            </Link>
          ))}
        </div>

        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[12px] font-bold text-[#E8E8E8]">
            {members[0].name.split(" ")[0]}
            {members.length > 1 && (
              <span className="font-normal text-[#888]"> + {members.length - 1} бусад</span>
            )}
          </div>
          <div className="text-[10px] text-[#666]">
            Сүүлийн нь {timeAgo(members[0].clanJoinedAt)} өмнө нэгдсэн
          </div>
        </div>
      </div>
    </div>
  );
}
