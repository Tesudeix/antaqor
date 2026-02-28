"use client";

import { useState, useEffect } from "react";

const AI_LEVEL_LABELS: Record<string, string> = {
  beginner: "Эхлэгч",
  intermediate: "Дунд",
  advanced: "Ахисан",
  expert: "Мэргэжилтэн",
};

const INTEREST_LABELS: Record<string, string> = {
  ai_tools: "AI Хэрэгслүүд",
  programming: "Програмчлал",
  design: "Дизайн",
  business: "Бизнес",
  data_science: "Дата",
  robotics: "Робот",
  content_creation: "Контент",
  education: "Боловсрол",
  finance: "Санхүү",
  health: "Эрүүл мэнд",
};

interface AdminUser {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  bio?: string;
  age?: number;
  aiExperience?: string;
  interests?: string[];
  clan?: string;
  clanJoinedAt?: string;
  subscriptionExpiresAt?: string;
  createdAt: string;
}

interface AiLevelCount {
  _id: string;
  count: number;
}

interface InterestCount {
  _id: string;
  count: number;
}

export default function AdminMembersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalMembers, setTotalMembers] = useState(0);
  const [aiLevelCounts, setAiLevelCounts] = useState<AiLevelCount[]>([]);
  const [interestCounts, setInterestCounts] = useState<InterestCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [grantModal, setGrantModal] = useState<AdminUser | null>(null);
  const [grantDays, setGrantDays] = useState(30);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, [filter]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filter) params.set("filter", filter);

      const res = await fetch(`/api/admin/members?${params}`);
      const data = await res.json();
      if (res.ok) {
        setUsers(data.users);
        setTotalUsers(data.totalUsers);
        setTotalMembers(data.totalMembers);
        setAiLevelCounts(data.aiLevelCounts || []);
        setInterestCounts(data.interestCounts || []);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUsers();
  };

  const handleAction = async (userId: string, action: string, days?: number) => {
    setActionLoading(userId);
    setMessage("");
    try {
      const res = await fetch(`/api/admin/members/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, days }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
        setUsers((prev) =>
          prev.map((u) => (u._id === userId ? { ...u, ...data.user } : u))
        );
        setGrantModal(null);
      } else {
        setMessage(data.error || "Алдаа гарлаа");
      }
    } finally {
      setActionLoading(null);
    }
  };

  const isExpired = (user: AdminUser) => {
    if (!user.subscriptionExpiresAt) return false;
    return new Date(user.subscriptionExpiresAt) < new Date();
  };

  const isMember = (user: AdminUser) => {
    return !!user.clan && !isExpired(user);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("mn-MN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const daysRemaining = (dateStr?: string) => {
    if (!dateStr) return null;
    const diff = new Date(dateStr).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const getAiCount = (level: string) =>
    aiLevelCounts.find((a) => a._id === level)?.count || 0;

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-[Bebas_Neue] text-3xl tracking-[1px] text-[#ede8df]">
          Гишүүд удирдах
        </h1>
        <p className="mt-1 text-[11px] tracking-[2px] text-[#5a5550]">
          НИЙГЭМЛЭГИЙН ГИШҮҮД & СТАТИСТИК
        </p>
      </div>

      {message && (
        <div className="mb-6 border-l-2 border-[#cc2200] bg-[rgba(204,34,0,0.08)] px-4 py-3 text-[12px] text-[#cc2200]">
          {message}
          <button onClick={() => setMessage("")} className="ml-3 text-[10px] text-[#5a5550] hover:text-[#cc2200]">
            ✕
          </button>
        </div>
      )}

      {/* Overview Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card p-4">
          <div className="text-[10px] uppercase tracking-[0.5px] text-[#5a5550]">Нийт хэрэглэгч</div>
          <div className="mt-1 font-[Bebas_Neue] text-2xl tracking-[2px] text-[#ede8df]">{totalUsers}</div>
        </div>
        <div className="card p-4">
          <div className="text-[10px] uppercase tracking-[0.5px] text-[#5a5550]">Кланы гишүүд</div>
          <div className="mt-1 font-[Bebas_Neue] text-2xl tracking-[2px] text-[#cc2200]">{totalMembers}</div>
        </div>
        <div className="card p-4">
          <div className="text-[10px] uppercase tracking-[0.5px] text-[#5a5550]">Гишүүн бус</div>
          <div className="mt-1 font-[Bebas_Neue] text-2xl tracking-[2px] text-[rgba(240,236,227,0.3)]">{totalUsers - totalMembers}</div>
        </div>
        <div className="card p-4">
          <div className="text-[10px] uppercase tracking-[0.5px] text-[#5a5550]">Хөрвүүлэлт</div>
          <div className="mt-1 font-[Bebas_Neue] text-2xl tracking-[2px] text-[#e8440f]">
            {totalUsers > 0 ? Math.round((totalMembers / totalUsers) * 100) : 0}%
          </div>
        </div>
      </div>

      {/* AI Level + Interest Breakdown */}
      <div className="mb-8 grid gap-3 sm:grid-cols-2">
        <div className="card p-4">
          <div className="mb-3 text-[10px] uppercase tracking-[0.5px] text-[#cc2200]">AI Түвшин</div>
          <div className="space-y-2">
            {(["beginner", "intermediate", "advanced", "expert"] as const).map((level) => {
              const count = getAiCount(level);
              const pct = totalUsers > 0 ? (count / totalUsers) * 100 : 0;
              return (
                <div key={level} className="flex items-center gap-3">
                  <span className="w-24 text-[10px] text-[#c8c8c0]">{AI_LEVEL_LABELS[level]}</span>
                  <div className="h-[3px] flex-1 bg-[#1c1c1c]">
                    <div className="h-full bg-[#cc2200] transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-8 text-right text-[10px] text-[#5a5550]">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="card p-4">
          <div className="mb-3 text-[10px] uppercase tracking-[0.5px] text-[#cc2200]">Түгээмэл сонирхол</div>
          <div className="flex flex-wrap gap-1.5">
            {interestCounts.map((ic) => (
              <span key={ic._id} className="border border-[#1c1c1c] px-2 py-1 text-[9px] text-[#c8c8c0]">
                {INTEREST_LABELS[ic._id] || ic._id} ({ic.count})
              </span>
            ))}
            {interestCounts.length === 0 && (
              <span className="text-[10px] text-[#5a5550]">Мэдээлэл байхгүй</span>
            )}
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <form onSubmit={handleSearch} className="flex flex-1 gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Нэр, имэйл, утас..."
            className="input-dark flex-1 !py-2 !text-[11px]"
          />
          <button type="submit" className="btn-blood !py-2 !px-4 !text-[9px]">
            Хайх
          </button>
        </form>
        <div className="flex gap-2">
          {[
            { value: "all", label: "Бүгд" },
            { value: "members", label: "Гишүүд" },
            { value: "non-members", label: "Гишүүн бус" },
            { value: "expired", label: "Дууссан" },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-2 text-[9px] uppercase tracking-[2px] transition ${
                filter === f.value
                  ? "bg-[rgba(204,34,0,0.1)] text-[#cc2200]"
                  : "text-[#5a5550] hover:text-[#c8c8c0]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Users list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-3 w-3 animate-pulse bg-[#cc2200]" />
        </div>
      ) : users.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-[12px] text-[#5a5550]">Хэрэглэгч олдсонгүй</p>
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((user) => {
            const member = isMember(user);
            const expired = isExpired(user);
            const remaining = daysRemaining(user.subscriptionExpiresAt);
            const expanded = expandedUser === user._id;
            const initials = user.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2);

            return (
              <div key={user._id} className="card">
                <div
                  className="flex cursor-pointer flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                  onClick={() => setExpandedUser(expanded ? null : user._id)}
                >
                  <div className="flex items-center gap-3">
                    {user.avatar ? (
                      <img src={user.avatar} alt={user.name} className="h-10 w-10 object-cover ring-1 ring-[#1c1c1c]" />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center bg-[#1c1c1c] text-[10px] font-bold text-[#c8c8c0]">{initials}</div>
                    )}
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold text-[#ede8df]">{user.name}</p>
                      <p className="text-[10px] text-[#5a5550]">
                        {user.email}
                        {user.phone && <span className="ml-2">· {user.phone}</span>}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {user.aiExperience && (
                      <span className="px-2 py-0.5 text-[8px] uppercase tracking-[1px] border border-[#1c1c1c] text-[#c8c8c0]">
                        {AI_LEVEL_LABELS[user.aiExperience]}
                      </span>
                    )}
                    {user.age && (
                      <span className="text-[9px] text-[#5a5550]">{user.age} нас</span>
                    )}

                    {member ? (
                      <span className="px-2 py-1 text-[9px] uppercase tracking-[2px] bg-[rgba(204,34,0,0.1)] text-[#cc2200]">
                        Гишүүн
                        {remaining !== null && remaining > 0 && (
                          <span className="ml-1 text-[#5a5550]">({remaining}д)</span>
                        )}
                      </span>
                    ) : expired ? (
                      <span className="px-2 py-1 text-[9px] uppercase tracking-[2px] bg-[rgba(255,165,0,0.1)] text-[#ff8c00]">
                        Дууссан
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-[9px] uppercase tracking-[2px] bg-[rgba(240,236,227,0.03)] text-[#5a5550]">
                        Гишүүн бус
                      </span>
                    )}

                    {!member ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); setGrantModal(user); setGrantDays(30); }}
                        disabled={actionLoading === user._id}
                        className="px-3 py-1.5 text-[9px] uppercase tracking-[2px] bg-[#cc2200] text-[#ede8df] transition hover:bg-[#e8440f] disabled:opacity-50"
                      >
                        {actionLoading === user._id ? "..." : "Эрх олгох"}
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); setGrantModal(user); setGrantDays(30); }}
                          disabled={actionLoading === user._id}
                          className="px-3 py-1.5 text-[9px] uppercase tracking-[2px] text-[#5a5550] transition hover:text-[#cc2200] disabled:opacity-50"
                        >
                          Сунгах
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`${user.name}-н гишүүнчлэлийг цуцлах уу?`)) {
                              handleAction(user._id, "revoke");
                            }
                          }}
                          disabled={actionLoading === user._id}
                          className="px-3 py-1.5 text-[9px] uppercase tracking-[2px] text-[#5a5550] transition hover:text-[#cc2200] disabled:opacity-50"
                        >
                          Цуцлах
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Expanded details */}
                {expanded && (
                  <div className="border-t border-[#1c1c1c] px-4 py-3">
                    <div className="grid grid-cols-2 gap-3 text-[10px] sm:grid-cols-4">
                      <div>
                        <span className="text-[#5a5550]">Бүртгүүлсэн</span>
                        <p className="mt-0.5 text-[#c8c8c0]">{formatDate(user.createdAt)}</p>
                      </div>
                      {user.clan && (
                        <>
                          <div>
                            <span className="text-[#5a5550]">Клан нэгдсэн</span>
                            <p className="mt-0.5 text-[#c8c8c0]">{formatDate(user.clanJoinedAt)}</p>
                          </div>
                          <div>
                            <span className="text-[#5a5550]">Дуусах</span>
                            <p className="mt-0.5 text-[#c8c8c0]">{formatDate(user.subscriptionExpiresAt)}</p>
                          </div>
                        </>
                      )}
                      {user.aiExperience && (
                        <div>
                          <span className="text-[#5a5550]">AI Түвшин</span>
                          <p className="mt-0.5 text-[#c8c8c0]">{AI_LEVEL_LABELS[user.aiExperience]}</p>
                        </div>
                      )}
                    </div>
                    {user.interests && user.interests.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {user.interests.map((i) => (
                          <span key={i} className="border border-[#1c1c1c] px-2 py-0.5 text-[8px] uppercase tracking-[0.5px] text-[#5a5550]">
                            {INTEREST_LABELS[i] || i}
                          </span>
                        ))}
                      </div>
                    )}
                    {user.bio && (
                      <p className="mt-3 text-[11px] leading-[1.6] text-[rgba(240,236,227,0.5)]">{user.bio}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Grant/Extend Modal */}
      {grantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="card mx-4 w-full max-w-md p-6">
            <h2 className="mb-4 font-[Bebas_Neue] text-2xl tracking-[1px] text-[#ede8df]">
              {isMember(grantModal) ? "Гишүүнчлэл сунгах" : "Гишүүнчлэл олгох"}
            </h2>
            <p className="mb-4 text-[12px] text-[rgba(240,236,227,0.5)]">
              <strong className="text-[#ede8df]">{grantModal.name}</strong> ({grantModal.email})
            </p>

            <div className="mb-4">
              <label className="mb-2 block text-[10px] uppercase tracking-[0.5px] text-[#5a5550]">
                Хоногийн тоо
              </label>
              <div className="flex gap-2">
                {[7, 14, 30, 60, 90, 365].map((d) => (
                  <button
                    key={d}
                    onClick={() => setGrantDays(d)}
                    className={`px-3 py-2 text-[10px] transition ${
                      grantDays === d
                        ? "bg-[#cc2200] text-[#ede8df]"
                        : "bg-[#1c1c1c] text-[#5a5550] hover:text-[#c8c8c0]"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <input
                type="number"
                value={grantDays}
                onChange={(e) => setGrantDays(parseInt(e.target.value) || 0)}
                min={1}
                className="input-dark mt-2 !py-2 !text-[11px]"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handleAction(grantModal._id, isMember(grantModal) ? "extend" : "grant", grantDays)}
                disabled={actionLoading === grantModal._id || grantDays < 1}
                className="btn-blood !py-2 !px-5 !text-[10px]"
              >
                {actionLoading === grantModal._id ? "..." : isMember(grantModal) ? "Сунгах" : "Эрх олгох"}
              </button>
              <button onClick={() => setGrantModal(null)} className="btn-ghost !py-2 !px-5 !text-[10px]">
                Цуцлах
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
