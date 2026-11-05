"use client";

import { useState, useEffect, Fragment } from "react";

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
  /* `source` төлөв ХАСАГДСАН: сошиал (Meta) сүүдэр бүртгэлүүд энэ
     жагсаалтад ерөөсөө орохоо болив. Оронд нь удирдахад ХЭРЭГТЭЙ хоёр
     хөшүүрэг: эрэмбэ ба хуудас. 509 мөрийг нэг дор зурах нь жагсаалт
     биш, хана байсан. */
  const [sort, setSort] = useState("new");
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [matchedCount, setMatchedCount] = useState(0);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, sort, page]);

  /* Шүүлтүүр эсвэл эрэмбэ солигдоход ЭХНИЙ хуудас руу. Үгүй бол хүн
     7-р хуудсан дээр байхдаа шүүлтүүр сольж, хоосон дэлгэц хараад
     "хоосон байна" гэж уншина. */
  useEffect(() => { setPage(1); }, [filter, sort]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filter) params.set("filter", filter);
      params.set("sort", sort);
      params.set("page", String(page));
      params.set("perPage", "50");

      const res = await fetch(`/api/admin/members?${params}`);
      const data = await res.json();
      if (res.ok) {
        setUsers(data.users);
        setTotalUsers(data.totalUsers);
        setTotalRegistered(data.totalRegistered ?? 0);
        setPageCount(data.pageCount ?? 1);
        setMatchedCount(data.matchedCount ?? 0);
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

  const STATUS = (u: AdminUser) => {
    const m = isMember(u), ex = isExpired(u), r = daysRemaining(u.subscriptionExpiresAt);
    if (m) return { label: "Гишүүн", tone: "text-[#4ADE80] bg-[rgba(74,222,128,0.10)]", days: r };
    if (ex) return { label: "Дууссан", tone: "text-[#F87171] bg-[rgba(248,113,113,0.10)]", days: null };
    return { label: "Гишүүн бус", tone: "text-[#A1A1AA] bg-white/[0.05]", days: null };
  };
  const initialsOf = (n: string) => n.split(" ").map((x) => x[0]).join("").toUpperCase().slice(0, 2);
  const conv = totalUsers > 0 ? Math.round((totalMembers / totalUsers) * 100) : 0;
  const levelTotal = (["beginner", "intermediate", "advanced", "expert"] as const).reduce((a, l) => a + getAiCount(l), 0) || 1;
  const LEVEL_COLOR: Record<string, string> = { beginner: "#52525B", intermediate: "#A1A1AA", advanced: "#D4D4D8", expert: "#FAFAFA" };

  const Actions = ({ user }: { user: AdminUser }) => {
    const member = isMember(user);
    const busy = actionLoading === user._id;
    return (
      <div className="flex items-center justify-end gap-1.5">
        {!member ? (
          <button onClick={(e) => { e.stopPropagation(); setGrantModal(user); setGrantDays(30); }} disabled={busy}
            className="rounded-[4px] bg-[#2E29FF] px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-[#1F1AD9] disabled:opacity-50">
            {busy ? "…" : "Эрх олгох"}
          </button>
        ) : (
          <>
            <button onClick={(e) => { e.stopPropagation(); setGrantModal(user); setGrantDays(30); }} disabled={busy}
              className="rounded-[4px] border border-white/10 px-3 py-1.5 text-[12px] font-semibold text-[#E8E8E8] transition hover:border-white/25 disabled:opacity-50">Сунгах</button>
            <button onClick={(e) => { e.stopPropagation(); if (confirm(`${user.name}-н гишүүнчлэлийг цуцлах уу?`)) handleAction(user._id, "revoke"); }} disabled={busy}
              className="rounded-[4px] px-2.5 py-1.5 text-[12px] font-semibold text-[#A1A1AA] transition hover:text-[#F87171] disabled:opacity-50">Цуцлах</button>
          </>
        )}
      </div>
    );
  };

  const Credits = ({ user }: { user: AdminUser }) => (
    <button onClick={(e) => { e.stopPropagation(); setCreditModal(user); setCreditAmount(50); setCreditNote(""); }} title="Кредит олгох"
      className="inline-flex items-center gap-1 rounded-[4px] border border-white/10 px-2 py-1 text-[12px] font-semibold tabular-nums text-[#E8E8E8] transition hover:border-[#2E29FF] hover:text-[#2E29FF]">
      {(user.credits ?? 0).toLocaleString()}₵<span className="text-[#71717A]">+</span>
    </button>
  );

  const Details = ({ user }: { user: AdminUser }) => (
    <div className="grid gap-4 px-4 py-4 text-[12.5px] sm:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
      <div><div className="text-[11px] text-[#71717A]">Бүртгүүлсэн</div><div className="mt-0.5 text-[#E8E8E8]">{formatDate(user.createdAt)}</div></div>
      <div><div className="text-[11px] text-[#71717A]">Клан нэгдсэн</div><div className="mt-0.5 text-[#E8E8E8]">{formatDate(user.clanJoinedAt)}</div></div>
      <div><div className="text-[11px] text-[#71717A]">Гишүүнчлэл дуусах</div><div className="mt-0.5 text-[#E8E8E8]">{formatDate(user.subscriptionExpiresAt)}</div></div>
      <div><div className="text-[11px] text-[#71717A]">Нас · AI түвшин</div><div className="mt-0.5 text-[#E8E8E8]">{user.age ? `${user.age} нас` : "—"} · {user.aiExperience ? AI_LEVEL_LABELS[user.aiExperience] : "—"}</div></div>
      <div className="flex items-start sm:justify-end">
        {user.role === "admin" ? (
          <button onClick={() => { if (confirm(`${user.name}-н админ эрхийг хасах уу?`)) handleAction(user._id, "removeAdmin"); }} disabled={actionLoading === user._id}
            className="rounded-[4px] bg-[rgba(46,41,255,0.12)] px-3 py-1.5 text-[12px] font-semibold text-[#F87171] disabled:opacity-50">Админ эрх хасах</button>
        ) : (
          <button onClick={() => { if (confirm(`${user.name}-г админ болгох уу?`)) handleAction(user._id, "makeAdmin"); }} disabled={actionLoading === user._id}
            className="rounded-[4px] border border-white/10 px-3 py-1.5 text-[12px] font-semibold text-[#A1A1AA] hover:text-[#E8E8E8] disabled:opacity-50">Админ болгох</button>
        )}
      </div>
      {!!user.interests?.length && (
        <div className="flex flex-wrap gap-1.5 sm:col-span-5">
          {user.interests.map((i) => <span key={i} className="rounded-[4px] bg-white/[0.05] px-2 py-0.5 text-[11.5px] text-[#D4D4D8]">{INTEREST_LABELS[i] || i}</span>)}
        </div>
      )}
      {user.bio && <p className="text-[12.5px] leading-relaxed text-[#A1A1AA] sm:col-span-5">{user.bio}</p>}
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-[1680px]">
      {/* ── Header: гарчиг + хайлт + Excel ── */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold tracking-[-0.01em] text-[#F4F4F5]">Гишүүд</h1>
          <p className="mt-1 text-[13px] text-[#A1A1AA]">{totalUsers.toLocaleString()} хэрэглэгч · {totalMembers} идэвхтэй гишүүн · хөрвөлт {conv}%</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form onSubmit={handleSearch} className="flex items-center rounded-[4px] border border-white/10 bg-white/[0.03] focus-within:border-white/25">
            <svg className="ml-3 h-4 w-4 text-[#71717A]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Нэр, имэйл, утас…"
              className="w-[220px] bg-transparent px-2.5 py-2 text-[13px] text-[#F4F4F5] outline-none placeholder:text-[#71717A] lg:w-[300px]" />
            {search && <button type="button" onClick={() => { setSearch(""); setTimeout(fetchUsers, 0); }} className="px-2 text-[#71717A] hover:text-white">×</button>}
          </form>
          <details className="relative">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-[4px] border border-white/10 px-3 py-2 text-[13px] font-semibold text-[#E8E8E8] hover:border-white/25">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 4v12m0 0-4-4m4 4 4-4M4 20h16" /></svg>Дуудлагын жагсаалт
            </summary>
            <div className="absolute right-0 z-20 mt-2 w-[260px] rounded-[4px] border border-white/10 bg-[#0A0A0A] p-2 shadow-2xl">
              <p className="px-2 pb-2 pt-1 text-[11.5px] leading-relaxed text-[#A1A1AA]">Excel (.xlsx) — нэр, утас, гишүүнчлэл, түвшин. Утас текстээр хадгалагдана.</p>
              {([["nonmember", "Гишүүнчлэл аваагүй", "борлуулалтын гол жагсаалт"], ["expired", "Хугацаа дууссан", "буцааж татах"], ["active", "Идэвхтэй гишүүд", ""], ["all", "Бүгд", ""]] as const).map(([seg, label, hint]) => (
                <a key={seg} href={`/api/admin/users/export?segment=${seg}`} className="flex items-center justify-between rounded-[4px] px-2 py-2 text-[13px] text-[#E8E8E8] hover:bg-white/[0.05]">
                  <span>{label}{hint && <small className="block text-[11px] text-[#71717A]">{hint}</small>}</span><span className="text-[#71717A]">↓</span>
                </a>
              ))}
            </div>
          </details>
        </div>
      </div>

      {message && (
        <div className="mb-4 flex items-center justify-between rounded-[4px] border border-white/10 bg-white/[0.03] px-4 py-2.5 text-[13px] text-[#E8E8E8]">
          {message}<button onClick={() => setMessage("")} className="text-[#71717A] hover:text-white">×</button>
        </div>
      )}

      {/* ── KPI + сегмент ── */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.6fr)]">
        {([
          ["Нийт хэрэглэгч", totalUsers.toLocaleString(), "#F4F4F5", "all"],
          ["Идэвхтэй гишүүд", String(totalMembers), "#4ADE80", "members"],
          ["Гишүүн бус", String(Math.max(0, totalUsers - totalMembers)), "#A1A1AA", "non-members"],
          ["Хөрвөлт", `${conv}%`, "#FAFAFA", ""],
        ] as const).map(([l, v, c, f]) => (
          <button key={l} onClick={() => f && setFilter(f)} disabled={!f}
            className={`rounded-[4px] border p-4 text-left transition ${f && filter === f ? "border-[rgba(46,41,255,0.5)] bg-[rgba(46,41,255,0.06)]" : "border-white/[0.08] bg-white/[0.02] hover:border-white/20"} disabled:cursor-default`}>
            <div className="text-[12px] text-[#A1A1AA]">{l}</div>
            <div className="mt-1.5 text-[26px] font-bold tabular-nums leading-none" style={{ color: c }}>{v}</div>
          </button>
        ))}
        <div className="rounded-[4px] border border-white/[0.08] bg-white/[0.02] p-4 sm:col-span-2 xl:col-span-1">
          <div className="flex items-center justify-between text-[12px] text-[#A1A1AA]"><span>AI түвшин</span><span className="tabular-nums">{levelTotal === 1 ? 0 : levelTotal} хариулсан</span></div>
          <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-white/[0.05]">
            {(["beginner", "intermediate", "advanced", "expert"] as const).map((l) => <div key={l} style={{ width: `${(getAiCount(l) / levelTotal) * 100}%`, background: LEVEL_COLOR[l] }} title={`${AI_LEVEL_LABELS[l]} ${getAiCount(l)}`} />)}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-[#D4D4D8]">
            {(["beginner", "intermediate", "advanced", "expert"] as const).map((l) => <span key={l} className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: LEVEL_COLOR[l] }} />{AI_LEVEL_LABELS[l]} <b className="tabular-nums">{getAiCount(l)}</b></span>)}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {interestCounts.slice(0, 7).map((ic) => <span key={ic._id} className="rounded-[4px] bg-white/[0.05] px-2 py-0.5 text-[11.5px] text-[#D4D4D8]">{INTEREST_LABELS[ic._id] || ic._id} <b className="tabular-nums text-[#F4F4F5]">{ic.count}</b></span>)}
          </div>
        </div>
      </div>

      {/* ── Toolbar: шүүлтүүр + эрэмбэ ── */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="flex rounded-[4px] border border-white/10 bg-white/[0.02] p-0.5">
          {([["all", "Бүгд"], ["members", "Гишүүд"], ["non-members", "Гишүүн бус"], ["expired", "Дууссан"]] as const).map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)}
              className={`rounded-[4px] px-3 py-1.5 text-[12.5px] font-semibold transition ${filter === v ? "bg-white text-black" : "text-[#A1A1AA] hover:text-white"}`}>{l}</button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-[12.5px] text-[#A1A1AA]">Эрэмбэ
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}
            className="rounded-[4px] border border-white/10 bg-[#0A0A0A] px-2.5 py-1.5 text-[12.5px] text-[#E8E8E8] outline-none">
            <option value="new">Шинэ эхэндээ</option><option value="expiring">Хугацаа дуусах</option><option value="credits">Кредит их</option><option value="name">Нэрээр</option>
          </select>
        </label>
        <span className="ml-auto text-[12.5px] tabular-nums text-[#A1A1AA]">{matchedCount.toLocaleString()} илэрц{pageCount > 1 ? ` · ${page}/${pageCount} хуудас` : ""}</span>
      </div>

      {/* ── Жагсаалт ── */}
      {loading ? (
        <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-[4px] bg-white/[0.03]" />)}</div>
      ) : users.length === 0 ? (
        <div className="rounded-[4px] border border-dashed border-white/10 py-16 text-center text-[13px] text-[#A1A1AA]">Хэрэглэгч олдсонгүй</div>
      ) : (
        <>
          {/* desktop: хүснэгт */}
          <div className="hidden overflow-hidden rounded-[4px] border border-white/[0.08] lg:block">
            <table className="w-full text-left">
              <thead className="sticky top-0 z-10 bg-[#0C0C0C] text-[11.5px] font-semibold text-[#71717A]">
                <tr>
                  <th className="px-4 py-3">Хэрэглэгч</th><th className="px-3 py-3">Утас</th><th className="px-3 py-3">Түвшин</th>
                  <th className="px-3 py-3">Гишүүнчлэл</th><th className="px-3 py-3">Кредит</th><th className="px-3 py-3">Бүртгүүлсэн</th><th className="px-4 py-3 text-right">Үйлдэл</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {users.map((user) => {
                  const st = STATUS(user); const open = expandedUser === user._id;
                  return (
                    <Fragment key={user._id}>
                      <tr onClick={() => setExpandedUser(open ? null : user._id)} className={`cursor-pointer text-[13px] transition ${open ? "bg-white/[0.04]" : "hover:bg-white/[0.025]"}`}>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-3">
                            {user.avatar ? <img src={user.avatar} alt="" className="h-9 w-9 rounded-full object-cover" /> : <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.07] text-[11px] font-bold text-[#D4D4D8]">{initialsOf(user.name)}</div>}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5"><span className="truncate font-semibold text-[#F4F4F5]">{user.name}</span>{user.role === "admin" && <span className="rounded-[4px] bg-[rgba(46,41,255,0.15)] px-1.5 text-[10px] font-bold text-[#F87171]">ADMIN</span>}</div>
                              <div className="truncate text-[12px] text-[#71717A]">{user.source === "social" ? "Сошиал акаунт" : user.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-[#D4D4D8]">{user.phone || <span className="text-[#52525B]">—</span>}</td>
                        <td className="px-3 py-2.5">{user.aiExperience ? <span className="inline-flex items-center gap-1.5 text-[12.5px] text-[#D4D4D8]"><i className="h-2 w-2 rounded-full" style={{ background: LEVEL_COLOR[user.aiExperience] }} />{AI_LEVEL_LABELS[user.aiExperience]}</span> : <span className="text-[#52525B]">—</span>}</td>
                        <td className="px-3 py-2.5">
                          <span className={`rounded-[4px] px-2 py-0.5 text-[12px] font-semibold ${st.tone}`}>{st.label}</span>
                          {st.days !== null && st.days > 0 && (
                            <div className="mt-1 flex items-center gap-2"><div className="h-1 w-20 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full" style={{ width: `${Math.min(100, (st.days / 30) * 100)}%`, background: st.days <= 7 ? "#F87171" : "#FAFAFA" }} /></div><span className={`text-[11.5px] tabular-nums ${st.days <= 7 ? "text-[#F87171]" : "text-[#71717A]"}`}>{st.days} хоног</span></div>
                          )}
                        </td>
                        <td className="px-3 py-2.5"><Credits user={user} /></td>
                        <td className="px-3 py-2.5 text-[12.5px] text-[#A1A1AA]">{formatDate(user.createdAt)}</td>
                        <td className="px-4 py-2.5"><Actions user={user} /></td>
                      </tr>
                      {open && <tr className="bg-white/[0.04]"><td colSpan={7} className="border-t border-white/[0.06]"><Details user={user} /></td></tr>}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* mobile: карт */}
          <div className="space-y-2 lg:hidden">
            {users.map((user) => {
              const st = STATUS(user); const open = expandedUser === user._id;
              return (
                <div key={user._id} className="rounded-[4px] border border-white/[0.08] bg-white/[0.02]">
                  <div className="flex items-center gap-3 p-3" onClick={() => setExpandedUser(open ? null : user._id)}>
                    {user.avatar ? <img src={user.avatar} alt="" className="h-10 w-10 rounded-full object-cover" /> : <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.07] text-[11px] font-bold text-[#D4D4D8]">{initialsOf(user.name)}</div>}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-semibold text-[#F4F4F5]">{user.name}</div>
                      <div className="truncate text-[12px] text-[#71717A]">{user.phone || user.email}</div>
                    </div>
                    <span className={`shrink-0 rounded-[4px] px-2 py-0.5 text-[11.5px] font-semibold ${st.tone}`}>{st.label}{st.days ? ` · ${st.days}х` : ""}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t border-white/[0.06] px-3 py-2"><Credits user={user} /><Actions user={user} /></div>
                  {open && <div className="border-t border-white/[0.06]"><Details user={user} /></div>}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Хуудаслалт ── */}
      {pageCount > 1 && (
        <div className="mt-5 flex items-center justify-center gap-1.5">
          <button onClick={() => setPage((n) => Math.max(1, n - 1))} disabled={page <= 1} className="rounded-[4px] border border-white/10 px-3 py-1.5 text-[12.5px] text-[#D4D4D8] disabled:opacity-30">←</button>
          {Array.from({ length: pageCount }, (_, i) => i + 1).filter((n) => n === 1 || n === pageCount || Math.abs(n - page) <= 1).map((n, i, arr) => (
            <Fragment key={n}>
              {i > 0 && n - arr[i - 1] > 1 && <span className="px-1 text-[#52525B]">…</span>}
              <button onClick={() => setPage(n)} className={`min-w-[34px] rounded-[4px] px-2 py-1.5 text-[12.5px] font-semibold tabular-nums ${n === page ? "bg-white text-black" : "border border-white/10 text-[#D4D4D8] hover:border-white/25"}`}>{n}</button>
            </Fragment>
          ))}
          <button onClick={() => setPage((n) => Math.min(pageCount, n + 1))} disabled={page >= pageCount} className="rounded-[4px] border border-white/10 px-3 py-1.5 text-[12.5px] text-[#D4D4D8] disabled:opacity-30">→</button>
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
              <label className="mb-2 block text-[10px] uppercase tracking-[0.5px] text-[#E2E4E8]">
                Хоногийн тоо
              </label>
              <div className="flex gap-2">
                {[7, 14, 30, 60, 90, 365].map((d) => (
                  <button
                    key={d}
                    onClick={() => setGrantDays(d)}
                    className={`px-3 py-2 text-[10px] transition ${
                      grantDays === d
                        ? "bg-[#2E29FF] text-[#E8E8E8]"
                        : "bg-[#E8E8E6] text-[#E2E4E8] hover:text-[#E2E4E8]"
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
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-[4px] border border-[rgba(46,41,255,0.25)] bg-gradient-to-br from-[rgba(46,41,255,0.06)] via-[#0A0A0A] to-[#0A0A0A] p-6 shadow-[0_0_28px_rgba(46,41,255,0.15)]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-black uppercase tracking-[0.18em] text-[#2E29FF]">КРЕДИТ ОЛГОХ</span>
                <h2 className="mt-1 text-[18px] font-black text-[#E8E8E8]">{creditModal.name}</h2>
                <p className="mt-0.5 text-[11px] text-[#E2E4E8]">{creditModal.email}</p>
                <div className="mt-2 inline-flex items-center gap-1 rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-2 py-0.5 text-[10px] font-bold text-[#E2E4E8]">
                  Одоогийн үлдэгдэл: <span className="text-[#2E29FF]">{(creditModal.credits ?? 0).toLocaleString()}₵</span>
                </div>
              </div>
              <button
                onClick={() => !creditBusy && setCreditModal(null)}
                className="flex h-7 w-7 items-center justify-center rounded-[4px] text-[#E2E4E8] transition hover:bg-[rgba(255,255,255,0.06)] hover:text-[#E8E8E8]"
                aria-label="Хаах"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="mb-3">
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-[#E2E4E8]">Хэмжээ</div>
              <div className="flex flex-wrap gap-1.5">
                {[10, 50, 100, 200, 500, 1000].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setCreditAmount(n)}
                    className={`rounded-[4px] px-3 py-1.5 text-[11px] font-black transition ${
                      creditAmount === n
                        ? "bg-[#2E29FF] text-white shadow-[0_0_12px_rgba(46,41,255,0.4)]"
                        : "border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] text-[#E2E4E8] hover:border-[rgba(46,41,255,0.4)]"
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
                  className="w-full rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2 text-[14px] font-black text-[#E8E8E8] outline-none focus:border-[rgba(46,41,255,0.4)]"
                  placeholder="Эсвэл өөрөө бичих..."
                />
                <button
                  type="button"
                  onClick={() => setCreditAmount(-Math.abs(creditAmount))}
                  title="Сөрөг (хасах)"
                  className="shrink-0 rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2 text-[12px] font-bold text-[#E2E4E8] transition hover:border-[#2E29FF] hover:text-[#2E29FF]"
                >
                  ±
                </button>
              </div>
              <p className="mt-1.5 text-[10px] text-[#E2E4E8]">
                Эерэг тоо → нэмнэ. Сөрөг тоо → хасна (-50 гэх мэт).
              </p>
            </div>

            <div className="mb-4">
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-[#E2E4E8]">
                Тэмдэглэл <span className="text-[#E2E4E8] normal-case font-normal tracking-normal">(заавал биш)</span>
              </div>
              <input
                value={creditNote}
                onChange={(e) => setCreditNote(e.target.value)}
                placeholder="Жнь: Хүндэт гишүүн bonus, alpha tester reward..."
                maxLength={200}
                className="w-full rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2 text-[12px] text-[#E8E8E8] outline-none focus:border-[rgba(46,41,255,0.4)]"
              />
            </div>

            <div className="rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0A0A0A] p-3 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-[#E2E4E8]">{creditAmount >= 0 ? "Нэмэх" : "Хасах"}:</span>
                <span className={`font-black ${creditAmount >= 0 ? "text-[#2E29FF]" : "text-[#2E29FF]"}`}>
                  {creditAmount >= 0 ? "+" : ""}{creditAmount.toLocaleString()}₵
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-[#E2E4E8]">Шинэ үлдэгдэл:</span>
                <span className="font-black text-[#E8E8E8]">
                  {Math.max(0, (creditModal.credits ?? 0) + creditAmount).toLocaleString()}₵
                </span>
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={grantCredits}
                disabled={creditBusy || !creditAmount}
                className="flex flex-1 items-center justify-center rounded-[4px] bg-[#2E29FF] py-2.5 text-[12px] font-black text-white shadow-[0_0_18px_rgba(46,41,255,0.35)] transition hover:bg-[#1F1AD9] disabled:opacity-40 disabled:shadow-none"
              >
                {creditBusy ? "Хадгалж байна..." : creditAmount >= 0 ? "Олгох" : "Хасах"}
              </button>
              <button
                onClick={() => setCreditModal(null)}
                disabled={creditBusy}
                className="rounded-[4px] border border-[rgba(255,255,255,0.08)] px-4 py-2.5 text-[12px] font-bold text-[#E2E4E8] transition hover:text-[#E8E8E8] disabled:opacity-40"
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
