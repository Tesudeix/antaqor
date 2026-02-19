"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Member {
  _id: string;
  name: string;
  avatar?: string;
  bio?: string;
  clan: string;
  clanJoinedAt?: string;
}

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [totalMembers, setTotalMembers] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      const res = await fetch("/api/members");
      const data = await res.json();
      if (res.ok) {
        setMembers(data.members);
        setTotalMembers(data.totalMembers);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-12">
        <div className="mb-3 text-[11px] uppercase tracking-[4px] text-[#c8c8c0]">
          Community · Members
        </div>
        <h1 className="font-[Bebas_Neue] text-[clamp(40px,6vw,80px)] leading-[0.9] tracking-[-2px] text-[#ede8df]">
          The <span className="text-[#cc2200]">Clan</span>
        </h1>
        <div className="mt-4 flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-[#cc2200]" />
            <span className="font-[Bebas_Neue] text-3xl tracking-[2px] text-[#ede8df]">
              {loading ? "—" : totalMembers}
            </span>
            <span className="text-[11px] uppercase tracking-[3px] text-[#5a5550]">Members</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-3 w-3 animate-pulse rounded-full bg-[#cc2200]" />
        </div>
      ) : members.length === 0 ? (
        <div className="py-16 text-center">
          <p className="font-[Bebas_Neue] text-2xl tracking-[2px] text-[rgba(240,236,227,0.3)]">
            No members yet
          </p>
          <p className="mt-2 text-[12px] text-[#5a5550]">Be the first to join the Clan.</p>
          <Link href="/clan" className="btn-blood mt-6 inline-block">Join Now</Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((member) => {
            const initials = member.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2);

            return (
              <Link key={member._id} href={`/profile/${member._id}`} className="card group p-5 transition">
                <div className="flex items-center gap-4">
                  {member.avatar ? (
                    <img
                      src={member.avatar}
                      alt={member.name}
                      className="h-12 w-12 rounded-full object-cover ring-1 ring-[#1c1c1c]"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center bg-[#1c1c1c] text-[12px] font-bold tracking-wider text-[#c8c8c0]">
                      {initials}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold text-[#ede8df] transition group-hover:text-[#cc2200]">
                      {member.name}
                    </p>
                    {member.bio ? (
                      <p className="mt-0.5 truncate text-[11px] text-[rgba(240,236,227,0.4)]">
                        {member.bio}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-[10px] uppercase tracking-[2px] text-[#cc2200]">
                        Clan Member
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
