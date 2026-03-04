"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { isAdminEmail } from "@/lib/adminClient";
import PaywallGate from "@/components/PaywallGate";

interface Member {
  _id: string;
  name: string;
  email?: string;
  avatar?: string;
  bio?: string;
  clan: string;
  clanJoinedAt?: string;
}

export default function MembersPage() {
  return (
    <PaywallGate>
      <MembersContent />
    </PaywallGate>
  );
}

function MembersContent() {
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

  return (
    <div>
      <div className="mb-12">
        <div className="mb-3 text-[11px] uppercase tracking-[1px] text-[#c8c8c0]">
          Нийгэмлэг · Гишүүд
        </div>
        <h1 className="font-[Bebas_Neue] text-[clamp(40px,6vw,80px)] leading-[0.9] tracking-[-2px] text-[#ede8df]">
          <span className="text-[#FF6A00]">Клан</span>
        </h1>
        <div className="mt-4 flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 bg-[#FF6A00]" />
            <span className="font-[Bebas_Neue] text-3xl tracking-[2px] text-[#ede8df]">
              {loading ? "—" : totalMembers}
            </span>
            <span className="text-[11px] uppercase tracking-[0.5px] text-[#5a5550]">Гишүүд</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-3 w-3 animate-pulse bg-[#FF6A00]" />
        </div>
      ) : members.length === 0 ? (
        <div className="py-16 text-center">
          <p className="font-[Bebas_Neue] text-2xl tracking-[2px] text-[rgba(240,236,227,0.3)]">
            Гишүүд байхгүй байна
          </p>
          <p className="mt-2 text-[12px] text-[#5a5550]">Кланд хамгийн түрүүнд нэгд.</p>
          <Link href="/clan" className="btn-blood mt-6 inline-block">Одоо нэгдэх</Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((member) => {
            const memberIsAdmin = isAdminEmail(member.email);
            const initials = member.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2);

            return (
              <Link
                key={member._id}
                href={`/profile/${member._id}`}
                className={`card group p-5 transition ${
                  memberIsAdmin ? "!border-[#FF6A00]/30" : ""
                }`}
              >
                <div className="flex items-center gap-4">
                  {member.avatar ? (
                    <div className="relative">
                      <img
                        src={member.avatar}
                        alt={member.name}
                        className={`h-12 w-12 object-cover ${
                          memberIsAdmin ? "ring-2 ring-[#FF6A00]" : "ring-1 ring-[#1c1c1c]"
                        }`}
                      />
                      {memberIsAdmin && (
                        <span className="absolute -bottom-1 -right-1 text-sm">👑</span>
                      )}
                    </div>
                  ) : (
                    <div className={`relative flex h-12 w-12 items-center justify-center text-[12px] font-bold tracking-wider ${
                      memberIsAdmin
                        ? "bg-[#FF6A00] text-[#ede8df]"
                        : "bg-[#1c1c1c] text-[#c8c8c0]"
                    }`}>
                      {initials}
                      {memberIsAdmin && (
                        <span className="absolute -bottom-1 -right-1 text-sm">👑</span>
                      )}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className={`truncate text-[13px] font-bold transition group-hover:text-[#FF6A00] ${
                        memberIsAdmin ? "text-[#FF6A00]" : "text-[#ede8df]"
                      }`}>
                        {member.name}
                      </p>
                    </div>
                    {memberIsAdmin ? (
                      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.5px] text-[#FF6A00]">
                        Эзэн хаан
                      </p>
                    ) : member.bio ? (
                      <p className="mt-0.5 truncate text-[11px] text-[rgba(240,236,227,0.4)]">
                        {member.bio}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-[10px] uppercase tracking-[0.3px] text-[#5a5550]">
                        Кланы гишүүн
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
