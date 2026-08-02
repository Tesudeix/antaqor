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
  role?: string;
  createdAt: string;
  credits?: number;
  source?: "registered" | "social";
  platform?: "instagram" | "messenger" | null;
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
  const [totalRegistered, setTotalRegistered] = useState(0);
  const [totalSocial, setTotalSocial] = useState(0);
  const [source, setSource] = useState<"registered" | "social">("registered");
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
  // Credit grant modal
  const [creditModal, setCreditModal] = useState<AdminUser | null>(null);
  const [creditAmount, setCreditAmount] = useState<number>(50);
  const [creditNote, setCreditNote] = useState<string>("");
  const [creditBusy, setCreditBusy] = useState(false);

  const grantCredits = async () => {
    if (!creditModal || creditBusy || !creditAmount) return;
    setCreditBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: creditModal._id,
          amount: creditAmount,
          note: creditNote.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const newBal = typeof data.balance === "number" ? data.balance : (creditModal.credits || 0) + creditAmount;
        setMessage(`${creditModal.name}: ${creditAmount > 0 ? "+" : ""}${creditAmount}₵ → шинэ үлдэгдэл ${newBal}₵`);
        setUsers((prev) => prev.map((u) => u._id === creditModal._id ? { ...u, credits: newBal } : u));
        setCreditModal(null);
        setCreditAmount(50);
        setCreditNote("");
      } else {
        setMessage(data.error || "Алдаа гарлаа");
      }
    } finally {
      setCreditBusy(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [filter, source]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filter) params.set("filter", filter);
      params.set("source", source);

      const res = await fetch(`/api/admin/members?${params}`);
      const data = await res.json();
      if (res.ok) {
        setUsers(data.users);
        setTotalUsers(data.totalUsers);
        setTotalRegistered(data.totalRegistered ?? 0);
        setTotalSocial(data.totalSocial ?? 0);
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
        <h1 className="text-3xl tracking-[1px] text-[#E8E8E8]">
          Гишүүд удирдах
        </h1>
        <p className="mt-1 text-[11px] tracking-[2px] text-[#5b6573]">
          НИЙГЭМЛЭГИЙН ГИШҮҮД & СТАТИСТИК
        </p>
      </div>

      {message && (
        <div className="mb-6 border-l-2 border-[#1080CA] bg-[rgba(0,100,145,0.08)] px-4 py-3 text-[12px] text-[#1080CA]">
          {message}
          <button onClick={() => setMessage("")} className="ml-3 text-[10px] text-[#5b6573] hover:text-[#1080CA]">
            ✕
          </button>
        </div>
      )}

      {/* Overview Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card p-4">
          <div className="text-[10px] uppercase tracking-[0.5px] text-[#5b6573]">Нийт хэрэглэгч</div>
          <div className="mt-1 text-2xl tracking-[2px] text-[#E8E8E8]">{totalUsers}</div>
        </div>
        <div className="card p-4">
          <div className="text-[10px] uppercase tracking-[0.5px] text-[#5b6573]">Кланы гишүүд</div>
          <div className="mt-1 text-2xl tracking-[2px] text-[#1080CA]">{totalMembers}</div>
        </div>
        <div className="card p-4">
          <div className="text-[10px] uppercase tracking-[0.5px] text-[#5b6573]">Гишүүн бус</div>
          <div className="mt-1 text-2xl tracking-[2px] text-[rgba(240,236,227,0.3)]">{totalUsers - totalMembers}</div>
        </div>
        <div className="card p-4">
          <div className="text-[10px] uppercase tracking-[0.5px] text-[#5b6573]">Хөрвүүлэлт</div>
          <div className="mt-1 text-2xl tracking-[2px] text-[#4FA8E8]">
            {totalUsers > 0 ? Math.round((totalMembers / totalUsers) * 100) : 0}%
          </div>
        </div>
      </div>

      {/* AI Level + Interest Breakdown */}
      <div className="mb-8 grid gap-3 sm:grid-cols-2">
        <div className="card p-4">
          <div className="mb-3 text-[10px] uppercase tracking-[0.5px] text-[#1080CA]">AI Түвшин</div>
          <div className="space-y-2">
            {(["beginner", "intermediate", "advanced", "expert"] as const).map((level) => {
              const count = getAiCount(level);
              const pct = totalUsers > 0 ? (count / totalUsers) * 100 : 0;
              return (
                <div key={level} className="flex items-center gap-3">
                  <span className="w-24 text-[10px] text-[#8A8A92]">{AI_LEVEL_LABELS[level]}</span>
                  <div className="h-[3px] flex-1 bg-[#E8E8E6]">
                    <div className="h-full bg-[#1080CA] transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-8 text-right text-[10px] text-[#5b6573]">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="card p-4">
          <div className="mb-3 text-[10px] uppercase tracking-[0.5px] text-[#1080CA]">Түгээмэл сонирхол</div>
          <div className="flex flex-wrap gap-1.5">
            {interestCounts.map((ic) => (
              <span key={ic._id} className="border border-[rgba(255,255,255,0.08)] px-2 py-1 text-[9px] text-[#8A8A92]">
                {INTEREST_LABELS[ic._id] || ic._id} ({ic.count})
              </span>
            ))}
            {interestCounts.length === 0 && (
              <span className="text-[10px] text-[#5b6573]">Мэдээлэл байхгүй</span>
            )}
          </div>
        </div>
      </div>

      {/* Source split — registered members vs social (Meta) accounts */}
      <div className="mb-5 grid grid-cols-2 gap-3">
        {([
          { value: "registered", label: "Бүртгэлтэй гишүүд", hint: "Сайтад бүртгүүлсэн", count: totalRegistered },
          { value: "social", label: "Сошиал (Meta)", hint: "IG / Messenger DM-ээс үүссэн", count: totalSocial },
        ] as const).map((s) => {
          const on = source === s.value;
          return (
            <button
              key={s.value}
              onClick={() => { setSource(s.value); setFilter("all"); }}
              className={`card p-4 text-left transition ${
                on ? "ring-1 ring-[#1080CA] bg-[rgba(16,128,202,0.05)]" : "opacity-60 hover:opacity-100"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className={`text-[11px] uppercase tracking-[1.5px] ${on ? "text-[#1080CA]" : "text-[#8A8A92]"}`}>{s.label}</div>
                <div className={`text-2xl tracking-[2px] ${on ? "text-[#E8E8E8]" : "text-[#5b6573]"}`}>{s.count}</div>
              </div>
              <div className="mt-1 text-[9px] tracking-[1px] text-[#5b6573]">{s.hint}</div>
            </button>
          );
        })}
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
          {(source === "social"
            ? [{ value: "all", label: "Бүгд" }]
            : [
                { value: "all", label: "Бүгд" },
                { value: "members", label: "Гишүүд" },
                { value: "non-members", label: "Гишүүн бус" },
                { value: "expired", label: "Дууссан" },
              ]
          ).map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-2 text-[9px] uppercase tracking-[2px] transition ${
                filter === f.value
                  ? "bg-[rgba(0,100,145,0.1)] text-[#1080CA]"
                  : "text-[#5b6573] hover:text-[#8A8A92]"
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
          <div className="h-3 w-3 animate-pulse bg-[#1080CA]" />
        </div>
      ) : users.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-[12px] text-[#5b6573]">Хэрэглэгч олдсонгүй</p>
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
                      <img src={user.avatar} alt={user.name} className="h-10 w-10 object-cover ring-1 ring-[#E8E8E6]" />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center bg-[#E8E8E6] text-[10px] font-bold text-[#8A8A92]">{initials}</div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-bold text-[#E8E8E8]">{user.name}</p>
                        {user.source === "social" && (
                          <span className="px-1.5 py-0.5 text-[8px] uppercase tracking-[1px] border border-[rgba(255,255,255,0.12)] text-[#8A8A92]">
                            {user.platform === "instagram" ? "Instagram" : user.platform === "messenger" ? "Messenger" : "Meta"}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-[#5b6573]">
                        {user.source === "social" ? "Сошиал акаунт · бүртгэлгүй" : user.email}
                        {user.phone && <span className="ml-2">· {user.phone}</span>}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {user.aiExperience && (
                      <span className="px-2 py-0.5 text-[8px] uppercase tracking-[1px] border border-[rgba(255,255,255,0.08)] text-[#8A8A92]">
                        {AI_LEVEL_LABELS[user.aiExperience]}
                      </span>
                    )}
                    {user.age && (
                      <span className="text-[9px] text-[#5b6573]">{user.age} нас</span>
                    )}

                    {member ? (
                      <span className="px-2 py-1 text-[9px] uppercase tracking-[2px] bg-[rgba(0,100,145,0.1)] text-[#1080CA]">
                        Гишүүн
                        {remaining !== null && remaining > 0 && (
                          <span className="ml-1 text-[#5b6573]">({remaining}д)</span>
                        )}
                      </span>
                    ) : expired ? (
                      <span className="px-2 py-1 text-[9px] uppercase tracking-[2px] bg-[rgba(255,165,0,0.1)] text-[#ff8c00]">
                        Дууссан
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-[9px] uppercase tracking-[2px] bg-[rgba(240,236,227,0.03)] text-[#5b6573]">
                        Гишүүн бус
                      </span>
                    )}

                    {user.role === "admin" && (
                      <span className="px-2 py-1 text-[9px] uppercase tracking-[2px] bg-[rgba(16,128,202,0.1)] text-[#1080CA]">
                        Админ
                      </span>
                    )}

                    {/* Credits chip — always visible, click to grant */}
                    <button
                      onClick={(e) => { e.stopPropagation(); setCreditModal(user); setCreditAmount(50); setCreditNote(""); }}
                      title="Кредит олгох"
                      className="inline-flex items-center gap-1 px-2 py-1.5 text-[10px] font-bold tracking-tight border border-[rgba(16,128,202,0.3)] bg-[rgba(16,128,202,0.05)] text-[#1080CA] transition hover:bg-[rgba(16,128,202,0.12)]"
                    >
                      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /></svg>
                      {(user.credits ?? 0).toLocaleString()}₵
                      <span className="text-[#8A8A92] font-normal ml-0.5">+</span>
                    </button>

                    {!member ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); setGrantModal(user); setGrantDays(30); }}
                        disabled={actionLoading === user._id}
                        className="px-3 py-1.5 text-[9px] uppercase tracking-[2px] bg-[#1080CA] text-[#E8E8E8] transition hover:bg-[#4FA8E8] disabled:opacity-50"
                      >
                        {actionLoading === user._id ? "..." : "Эрх олгох"}
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); setGrantModal(user); setGrantDays(30); }}
                          disabled={actionLoading === user._id}
                          className="px-3 py-1.5 text-[9px] uppercase tracking-[2px] text-[#5b6573] transition hover:text-[#1080CA] disabled:opacity-50"
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
                          className="px-3 py-1.5 text-[9px] uppercase tracking-[2px] text-[#5b6573] transition hover:text-[#1080CA] disabled:opacity-50"
                        >
                          Цуцлах
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Expanded details */}
                {expanded && (
                  <div className="border-t border-[rgba(255,255,255,0.08)] px-4 py-3">
                    <div className="grid grid-cols-2 gap-3 text-[10px] sm:grid-cols-4">
                      <div>
                        <span className="text-[#5b6573]">Бүртгүүлсэн</span>
                        <p className="mt-0.5 text-[#8A8A92]">{formatDate(user.createdAt)}</p>
                      </div>
                      {user.clan && (
                        <>
                          <div>
                            <span className="text-[#5b6573]">Клан нэгдсэн</span>
                            <p className="mt-0.5 text-[#8A8A92]">{formatDate(user.clanJoinedAt)}</p>
                          </div>
                          <div>
                            <span className="text-[#5b6573]">Дуусах</span>
                            <p className="mt-0.5 text-[#8A8A92]">{formatDate(user.subscriptionExpiresAt)}</p>
                          </div>
                        </>
                      )}
                      {user.aiExperience && (
                        <div>
                          <span className="text-[#5b6573]">AI Түвшин</span>
                          <p className="mt-0.5 text-[#8A8A92]">{AI_LEVEL_LABELS[user.aiExperience]}</p>
                        </div>
                      )}
                    </div>
                    {user.interests && user.interests.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {user.interests.map((i) => (
                          <span key={i} className="border border-[rgba(255,255,255,0.08)] px-2 py-0.5 text-[8px] uppercase tracking-[0.5px] text-[#5b6573]">
                            {INTEREST_LABELS[i] || i}
                          </span>
                        ))}
                      </div>
                    )}
                    {user.bio && (
                      <p className="mt-3 text-[11px] leading-[1.6] text-[rgba(240,236,227,0.5)]">{user.bio}</p>
                    )}
                    <div className="mt-3 flex gap-2 border-t border-[rgba(255,255,255,0.08)] pt-3">
                      {user.role === "admin" ? (
                        <button
                          onClick={() => {
                            if (confirm(`${user.name}-н админ эрхийг хасах уу?`)) {
                              handleAction(user._id, "removeAdmin");
                            }
                          }}
                          disabled={actionLoading === user._id}
                          className="px-3 py-1.5 text-[9px] uppercase tracking-[2px] bg-[rgba(16,128,202,0.1)] text-[#1080CA] transition hover:bg-[rgba(16,128,202,0.2)] disabled:opacity-50"
                        >
                          {actionLoading === user._id ? "..." : "Админ эрх хасах"}
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            if (confirm(`${user.name}-г админ болгох уу?`)) {
                              handleAction(user._id, "makeAdmin");
                            }
                          }}
                          disabled={actionLoading === user._id}
                          className="px-3 py-1.5 text-[9px] uppercase tracking-[2px] border border-[rgba(16,128,202,0.3)] text-[#1080CA] transition hover:bg-[rgba(16,128,202,0.1)] disabled:opacity-50"
                        >
                          {actionLoading === user._id ? "..." : "Админ болгох"}
                        </button>
                      )}
                    </div>
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
            <h2 className="mb-4 text-2xl tracking-[1px] text-[#E8E8E8]">
              {isMember(grantModal) ? "Гишүүнчлэл сунгах" : "Гишүүнчлэл олгох"}
            </h2>
            <p className="mb-4 text-[12px] text-[rgba(240,236,227,0.5)]">
              <strong className="text-[#E8E8E8]">{grantModal.name}</strong> ({grantModal.email})
            </p>

            <div className="mb-4">
              <label className="mb-2 block text-[10px] uppercase tracking-[0.5px] text-[#5b6573]">
                Хоногийн тоо
              </label>
              <div className="flex gap-2">
                {[7, 14, 30, 60, 90, 365].map((d) => (
                  <button
                    key={d}
                    onClick={() => setGrantDays(d)}
                    className={`px-3 py-2 text-[10px] transition ${
                      grantDays === d
                        ? "bg-[#1080CA] text-[#E8E8E8]"
                        : "bg-[#E8E8E6] text-[#5b6573] hover:text-[#8A8A92]"
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

      {/* Credit Grant Modal */}
      {creditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => !creditBusy && setCreditModal(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-none border border-[rgba(16,128,202,0.25)] bg-gradient-to-br from-[rgba(16,128,202,0.06)] via-[#0E0E12] to-[#0E0E12] p-6 shadow-[0_0_28px_rgba(16,128,202,0.15)]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <span className="text-[9px] font-black uppercase tracking-[0.18em] text-[#1080CA]">КРЕДИТ ОЛГОХ</span>
                <h2 className="mt-1 text-[18px] font-black text-[#E8E8E8]">{creditModal.name}</h2>
                <p className="mt-0.5 text-[11px] text-[#8A8A92]">{creditModal.email}</p>
                <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-2 py-0.5 text-[10px] font-bold text-[#8A8A92]">
                  Одоогийн үлдэгдэл: <span className="text-[#1080CA]">{(creditModal.credits ?? 0).toLocaleString()}₵</span>
                </div>
              </div>
              <button
                onClick={() => !creditBusy && setCreditModal(null)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-[#8A8A92] transition hover:bg-[rgba(255,255,255,0.06)] hover:text-[#E8E8E8]"
                aria-label="Хаах"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="mb-3">
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-[#8A8A92]">Хэмжээ</div>
              <div className="flex flex-wrap gap-1.5">
                {[10, 50, 100, 200, 500, 1000].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setCreditAmount(n)}
                    className={`rounded-none px-3 py-1.5 text-[11px] font-black transition ${
                      creditAmount === n
                        ? "bg-[#1080CA] text-[#0E0E10] shadow-[0_0_12px_rgba(16,128,202,0.4)]"
                        : "border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] text-[#8A8A92] hover:border-[rgba(16,128,202,0.4)]"
                    }`}
                  >
                    +{n}₵
                  </button>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(parseInt(e.target.value) || 0)}
                  className="w-full rounded-none border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2 text-[14px] font-black text-[#E8E8E8] outline-none focus:border-[rgba(16,128,202,0.4)]"
                  placeholder="Эсвэл өөрөө бичих..."
                />
                <button
                  type="button"
                  onClick={() => setCreditAmount(-Math.abs(creditAmount))}
                  title="Сөрөг (хасах)"
                  className="shrink-0 rounded-none border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2 text-[12px] font-bold text-[#8A8A92] transition hover:border-[#1080CA] hover:text-[#1080CA]"
                >
                  ±
                </button>
              </div>
              <p className="mt-1.5 text-[10px] text-[#8A8A92]">
                Эерэг тоо → нэмнэ. Сөрөг тоо → хасна (-50 гэх мэт).
              </p>
            </div>

            <div className="mb-4">
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-[#8A8A92]">
                Тэмдэглэл <span className="text-[#56565E] normal-case font-normal tracking-normal">(заавал биш)</span>
              </div>
              <input
                value={creditNote}
                onChange={(e) => setCreditNote(e.target.value)}
                placeholder="Жнь: Хүндэт гишүүн bonus, alpha tester reward..."
                maxLength={200}
                className="w-full rounded-none border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2 text-[12px] text-[#E8E8E8] outline-none focus:border-[rgba(16,128,202,0.4)]"
              />
            </div>

            <div className="rounded-none border border-[rgba(255,255,255,0.06)] bg-[#0A0A0A] p-3 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-[#8A8A92]">{creditAmount >= 0 ? "Нэмэх" : "Хасах"}:</span>
                <span className={`font-black ${creditAmount >= 0 ? "text-[#1080CA]" : "text-[#1080CA]"}`}>
                  {creditAmount >= 0 ? "+" : ""}{creditAmount.toLocaleString()}₵
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-[#8A8A92]">Шинэ үлдэгдэл:</span>
                <span className="font-black text-[#E8E8E8]">
                  {Math.max(0, (creditModal.credits ?? 0) + creditAmount).toLocaleString()}₵
                </span>
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={grantCredits}
                disabled={creditBusy || !creditAmount}
                className="flex flex-1 items-center justify-center rounded-none bg-[#1080CA] py-2.5 text-[12px] font-black text-[#0E0E10] shadow-[0_0_18px_rgba(16,128,202,0.35)] transition hover:bg-[#4FA8E8] disabled:opacity-40 disabled:shadow-none"
              >
                {creditBusy ? "Хадгалж байна..." : creditAmount >= 0 ? "Олгох" : "Хасах"}
              </button>
              <button
                onClick={() => setCreditModal(null)}
                disabled={creditBusy}
                className="rounded-none border border-[rgba(255,255,255,0.08)] px-4 py-2.5 text-[12px] font-bold text-[#8A8A92] transition hover:text-[#E8E8E8] disabled:opacity-40"
              >
                Болих
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
