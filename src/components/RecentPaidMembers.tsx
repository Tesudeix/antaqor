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

export default function RecentPaidMembers({ limit = 5, light = false }: { limit?: number; light?: boolean }) {
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
    <div className={`rounded-none border p-3 ${light ? "border-[rgba(16,128,202,0.25)] bg-gradient-to-br from-[rgba(16,128,202,0.06)] via-[#F4F6F8] to-[#FFFFFF]" : "border-[rgba(16,128,202,0.18)] bg-gradient-to-br from-[rgba(16,128,202,0.05)] via-[#f2f5f8] to-[#ffffff]"}`}>
      <div className="mb-2 flex items-center gap-2">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#22C55E]" />
        <span className={`text-[10px] font-black uppercase tracking-[0.18em] ${light ? "text-[#1080CA]" : "text-[#1080CA]"}`}>
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
              className={`relative h-8 w-8 overflow-hidden rounded-full border-2 transition hover:z-10 hover:scale-110 ${light ? "border-[#FFFFFF]" : "border-[#f2f5f8]"}`}
              style={{ zIndex: members.length - i }}
              title={m.name}
            >
              {m.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.avatar} alt={m.name} className="h-full w-full object-cover" />
              ) : (
                <span className={`flex h-full w-full items-center justify-center text-[12px] font-black ${light ? "bg-[rgba(16,128,202,0.15)] text-[#1080CA]" : "bg-[rgba(16,128,202,0.18)] text-[#1080CA]"}`}>
                  {m.name.charAt(0)}
                </span>
              )}
            </Link>
          ))}
        </div>

        <div className="min-w-0 flex-1 leading-tight">
          <div className={`truncate text-[12px] font-bold ${light ? "text-[#0E1726]" : "text-[#0e1726]"}`}>
            {members[0].name.split(" ")[0]}
            {members.length > 1 && (
              <span className={`font-normal ${light ? "text-[#6B7280]" : "text-[#6b7280]"}`}> + {members.length - 1} бусад</span>
            )}
          </div>
          <div className={`text-[10px] ${light ? "text-[#5B6573]" : "text-[#6b7280]"}`}>
            Сүүлийн нь {timeAgo(members[0].clanJoinedAt)} өмнө нэгдсэн
          </div>
        </div>
      </div>
    </div>
  );
}
