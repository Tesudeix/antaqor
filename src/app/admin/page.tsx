"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

interface DashboardStats {
  totalUsers: number;
  totalMembers: number;
  totalPosts: number;
  recentSignups: number;
  aiLevelCounts: { _id: string; count: number }[];
  interestCounts: { _id: string; count: number }[];
  levelDistribution: { _id: number; count: number }[];
  topXPUsers: { _id: string; name: string; avatar?: string; xp: number; level: number }[];
}

interface Profile {
  id: string;
  username: string;
  name: string;
  threads_profile_picture_url?: string;
  threads_biography?: string;
}

interface InsightMetric {
  name: string;
  title: string;
  description: string;
  period: string;
  values: { value: number }[];
  total_value?: { value: number };
}

const AI_LEVEL_LABELS: Record<string, string> = {
  beginner: "Эхлэгч",
  intermediate: "Дунд",
  advanced: "Ахисан",
  expert: "Мэргэжилтэн",
};

export default function AdminDashboard() {
  const searchParams = useSearchParams();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [insights, setInsights] = useState<InsightMetric[]>([]);
  const [threadsConnected, setThreadsConnected] = useState<boolean | null>(null);
  const [postText, setPostText] = useState("");
  const [posting, setPosting] = useState(false);
  const [postResult, setPostResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [igToken, setIgToken] = useState("");
  const [igStatus, setIgStatus] = useState<{hasToken:boolean;tokenPreview?:string|null;username?:string} | null>(null);
  const [igSaving, setIgSaving] = useState(false);
  const [igMsg, setIgMsg] = useState<string | null>(null);

  // Announcements state
  const [announcements, setAnnouncements] = useState<{_id:string;title:string;content:string;image?:string;tag:string;pinned:boolean;published:boolean;createdAt:string}[]>([]);
  const [annForm, setAnnForm] = useState({title:"",content:"",image:"",tag:"мэдэгдэл",pinned:false});
  const [annEditing, setAnnEditing] = useState<string|null>(null);
  const [annSaving, setAnnSaving] = useState(false);
  const [annMsg, setAnnMsg] = useState<string|null>(null);

  // Tasks state
  const [tasks, setTasks] = useState<{_id:string;title:string;description:string;xpReward:number;status:string;assignedTo?:{_id:string;name:string}|null;createdAt:string}[]>([]);
  const [taskForm, setTaskForm] = useState({title:"",description:"",xpReward:"500"});
  const [taskSaving, setTaskSaving] = useState(false);
  const [taskMsg, setTaskMsg] = useState<string|null>(null);

  const error = searchParams.get("error");
  const justConnected = searchParams.get("connected");

  const loadData = useCallback(async () => {
    try {
      const [statsRes, profileRes] = await Promise.all([
        fetch("/api/admin/stats"),
        fetch("/api/admin/threads/profile"),
      ]);

      if (statsRes.ok) {
        setStats(await statsRes.json());
      }

      if (profileRes.status === 400 || !profileRes.ok) {
        setThreadsConnected(false);
      } else {
        const profileData = await profileRes.json();
        if (profileData.error) {
          setThreadsConnected(false);
        } else {
          setProfile(profileData);
          setThreadsConnected(true);
          const insightsRes = await fetch("/api/admin/threads/insights?period=days_28");
          if (insightsRes.ok) {
            const insightsData = await insightsRes.json();
            setInsights(insightsData.data || []);
          }
        }
      }
      // Instagram token status
      try {
        const igRes = await fetch("/api/instagram/token");
        if (igRes.ok) setIgStatus(await igRes.json());
      } catch {}
      // Load announcements
      try {
        const annRes = await fetch("/api/announcements?limit=50");
        if (annRes.ok) {
          const annData = await annRes.json();
          setAnnouncements(annData.announcements || []);
        }
      } catch {}
      // Load tasks
      try {
        const taskRes = await fetch("/api/tasks");
        if (taskRes.ok) {
          const taskData = await taskRes.json();
          setTasks(taskData.tasks || []);
        }
      } catch {}
    } catch {
      setThreadsConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePost = async () => {
    if (!postText.trim() || posting) return;
    setPosting(true);
    setPostResult(null);
    try {
      const res = await fetch("/api/admin/threads/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: postText.trim() }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPostResult("Амжилттай нийтлэгдлээ!");
      setPostText("");
      setTimeout(() => setPostResult(null), 4000);
    } catch (err) {
      setPostResult(`Алдаа: ${err instanceof Error ? err.message : "Нийтлэх амжилтгүй"}`);
    } finally {
      setPosting(false);
    }
  };

  const handleIgSave = async () => {
    if (!igToken.trim() || igSaving) return;
    setIgSaving(true);
    setIgMsg(null);
    try {
      const res = await fetch("/api/instagram/token", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: igToken.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setIgMsg(`Холбогдлоо! @${data.username}`);
      setIgToken("");
      setIgStatus({ hasToken: true, username: data.username });
      setTimeout(() => setIgMsg(null), 4000);
    } catch (err) {
      setIgMsg(`Алдаа: ${err instanceof Error ? err.message : "Token буруу"}`);
    } finally {
      setIgSaving(false);
    }
  };

  const handleIgDelete = async () => {
    try {
      await fetch("/api/instagram/token", { method: "DELETE" });
      setIgStatus({ hasToken: false });
      setIgMsg("Token устгагдлаа");
      setTimeout(() => setIgMsg(null), 3000);
    } catch {}
  };

  const handleIgRefresh = async () => {
    setIgMsg("Refreshing...");
    try {
      const res = await fetch("/api/instagram/refresh");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setIgMsg("Token шинэчлэгдлээ!");
      setTimeout(() => setIgMsg(null), 3000);
    } catch (err) {
      setIgMsg(`Алдаа: ${err instanceof Error ? err.message : "Refresh failed"}`);
    }
  };

  const handleAnnSave = async () => {
    if (!annForm.title.trim() || !annForm.content.trim() || annSaving) return;
    setAnnSaving(true);
    setAnnMsg(null);
    try {
      const isEdit = !!annEditing;
      const url = isEdit ? `/api/announcements/${annEditing}` : "/api/announcements";
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(annForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      if (isEdit) {
        setAnnouncements(prev => prev.map(a => a._id === annEditing ? data.announcement : a));
      } else {
        setAnnouncements(prev => [data.announcement, ...prev]);
      }
      setAnnForm({title:"",content:"",image:"",tag:"мэдэгдэл",pinned:false});
      setAnnEditing(null);
      setAnnMsg(isEdit ? "Шинэчлэгдлээ!" : "Нэмэгдлээ!");
      setTimeout(() => setAnnMsg(null), 3000);
    } catch (err) {
      setAnnMsg(`Алдаа: ${err instanceof Error ? err.message : "Failed"}`);
    } finally {
      setAnnSaving(false);
    }
  };

  const handleAnnDelete = async (id: string) => {
    try {
      await fetch(`/api/announcements/${id}`, { method: "DELETE" });
      setAnnouncements(prev => prev.filter(a => a._id !== id));
    } catch {}
  };

  const startAnnEdit = (a: typeof announcements[0]) => {
    setAnnEditing(a._id);
    setAnnForm({ title: a.title, content: a.content, image: a.image || "", tag: a.tag, pinned: a.pinned });
  };

  const handleTaskCreate = async () => {
    if (!taskForm.title.trim() || taskSaving) return;
    setTaskSaving(true); setTaskMsg(null);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: taskForm.title.trim(),
          description: taskForm.description.trim(),
          xpReward: parseInt(taskForm.xpReward) || 500,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setTasks(prev => [data.task, ...prev]);
      setTaskForm({title:"",description:"",xpReward:"500"});
      setTaskMsg("Даалгавар нэмэгдлээ!");
      setTimeout(() => setTaskMsg(null), 3000);
    } catch (err) {
      setTaskMsg(`Алдаа: ${err instanceof Error ? err.message : "Failed"}`);
    } finally { setTaskSaving(false); }
  };

  const handleTaskAction = async (id: string, action: string) => {
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (res.ok) setTasks(prev => prev.map(t => t._id === id ? data.task : t));
    } catch {}
  };

  const handleTaskDelete = async (id: string) => {
    try {
      await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      setTasks(prev => prev.filter(t => t._id !== id));
    } catch {}
  };

  const getInsightValue = (name: string): number => {
    const metric = insights.find((i) => i.name === name);
    if (!metric) return 0;
    if (metric.total_value) return metric.total_value.value;
    if (metric.values?.length) return metric.values[0].value;
    return 0;
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin border-2 border-[#EF2C58] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl tracking-[2px] md:text-4xl">
          ADMIN <span className="text-[#EF2C58]">DASHBOARD</span>
        </h1>
        <p className="mt-2 text-[11px] tracking-[2px] text-[#5a5550]">
          НИЙГЭМЛЭГИЙН УДИРДЛАГЫН ХЯНАЛТЫН САМБАР
        </p>
      </div>

      {error && (
        <div className="border border-red-900/50 bg-red-950/30 px-4 py-3 text-[12px] text-red-400">
          {error}
        </div>
      )}
      {justConnected && (
        <div className="border border-green-900/50 bg-green-950/30 px-4 py-3 text-[12px] text-green-400">
          Threads холбогдлоо!
        </div>
      )}

      {/* Community Stats */}
      {stats && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="card p-5">
              <div className="text-[9px] uppercase tracking-[0.5px] text-[#5a5550]">Нийт хэрэглэгч</div>
              <div className="mt-2 text-3xl tracking-[2px] text-[#ede8df]">
                {stats.totalUsers.toLocaleString()}
              </div>
            </div>
            <div className="card p-5">
              <div className="text-[9px] uppercase tracking-[0.5px] text-[#5a5550]">Кланы гишүүд</div>
              <div className="mt-2 text-3xl tracking-[2px] text-[#EF2C58]">
                {stats.totalMembers.toLocaleString()}
              </div>
            </div>
            <div className="card p-5">
              <div className="text-[9px] uppercase tracking-[0.5px] text-[#5a5550]">Нийтлэлүүд</div>
              <div className="mt-2 text-3xl tracking-[2px] text-[#B3B300]">
                {stats.totalPosts.toLocaleString()}
              </div>
            </div>
            <div className="card p-5">
              <div className="text-[9px] uppercase tracking-[0.5px] text-[#5a5550]">Шинэ (7 хоног)</div>
              <div className="mt-2 text-3xl tracking-[2px] text-[#c8c8c0]">
                {stats.recentSignups.toLocaleString()}
              </div>
            </div>
          </div>

          {/* AI Level + Interests */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="card p-5">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-[0.5px] text-[#EF2C58]">AI Түвшин</span>
                <Link href="/admin/members" className="text-[9px] text-[#5a5550] hover:text-[#EF2C58]">
                  Бүгдийг харах →
                </Link>
              </div>
              <div className="space-y-3">
                {(["beginner", "intermediate", "advanced", "expert"] as const).map((level) => {
                  const count = stats.aiLevelCounts.find((a) => a._id === level)?.count || 0;
                  const pct = stats.totalUsers > 0 ? (count / stats.totalUsers) * 100 : 0;
                  return (
                    <div key={level} className="flex items-center gap-3">
                      <span className="w-24 text-[11px] text-[#c8c8c0]">{AI_LEVEL_LABELS[level]}</span>
                      <div className="h-[4px] flex-1 bg-[#1c1c1c]">
                        <div className="h-full bg-[#EF2C58] transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-10 text-right text-[11px] text-[#5a5550]">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="card p-5">
              <div className="mb-4 text-[10px] uppercase tracking-[0.5px] text-[#EF2C58]">Түгээмэл сонирхол</div>
              <div className="flex flex-wrap gap-2">
                {stats.interestCounts.length > 0 ? (
                  stats.interestCounts.map((ic) => (
                    <span key={ic._id} className="border border-[#1c1c1c] px-3 py-1.5 text-[10px] text-[#c8c8c0]">
                      {ic._id.replace(/_/g, " ")} <span className="text-[#EF2C58]">{ic.count}</span>
                    </span>
                  ))
                ) : (
                  <span className="text-[11px] text-[#5a5550]">Мэдээлэл байхгүй</span>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Level Distribution & Top Users */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.5px] text-[#EF2C58]">Түвшний тархалт</span>
              <Link href="/tasks" className="text-[9px] text-[#5a5550] hover:text-[#EF2C58]">
                Даалгаврууд →
              </Link>
            </div>
            <div className="space-y-3">
              {[
                { min: 1, label: "Бүтээгч (1-10)" },
                { min: 11, label: "Инженер (11-20)" },
                { min: 21, label: "Антрепренёр (21-40)" },
                { min: 41, label: "Байлдагч (41-60)" },
                { min: 61, label: "Энтакор (61-90)" },
                { min: 91, label: "Эзэн хаан (91-100)" },
              ].map((tier) => {
                const count = stats.levelDistribution?.find((d) => d._id === tier.min)?.count || 0;
                const pct = stats.totalUsers > 0 ? (count / stats.totalUsers) * 100 : 0;
                return (
                  <div key={tier.min} className="flex items-center gap-3">
                    <span className="w-32 text-[11px] text-[#c8c8c0]">{tier.label}</span>
                    <div className="h-[4px] flex-1 bg-[#1c1c1c]">
                      <div className="h-full bg-[#EF2C58] transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-10 text-right text-[11px] text-[#5a5550]">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="card p-5">
            <div className="mb-4 text-[10px] uppercase tracking-[0.5px] text-[#EF2C58]">Шилдэг XP</div>
            <div className="space-y-2">
              {(stats.topXPUsers || []).map((u, i) => (
                <Link key={u._id} href={`/profile/${u._id}`} className="flex items-center gap-3 py-1 transition hover:bg-[rgba(240,236,227,0.03)]">
                  <span className="w-5 text-right text-[10px] font-bold text-[#5a5550]">{i + 1}</span>
                  {u.avatar ? (
                    <img src={u.avatar} alt="" className="h-6 w-6 object-cover" />
                  ) : (
                    <div className="flex h-6 w-6 items-center justify-center bg-[#1c1c1c] text-[9px] font-bold text-[#c8c8c0]">
                      {u.name?.charAt(0)?.toUpperCase()}
                    </div>
                  )}
                  <span className="flex-1 text-[12px] text-[#c8c8c0]">{u.name}</span>
                  <span className="text-[10px] text-[#5a5550]">LV.{u.level || 1}</span>
                  <span className="w-16 text-right text-[11px] font-bold text-[#EF2C58]">{(u.xp || 0).toLocaleString()}</span>
                </Link>
              ))}
              {(!stats.topXPUsers || stats.topXPUsers.length === 0) && (
                <p className="text-[11px] text-[#5a5550]">Мэдээлэл байхгүй</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Threads Section */}
      <div>
        <div className="mb-4 text-[10px] uppercase tracking-[2px] text-[#5a5550]">
          THREADS INTEGRATION
        </div>
        {!threadsConnected ? (
          <div className="card p-8 text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center border border-[#1c1c1c]">
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-8 w-8 text-[#5a5550]">
                <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.028-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.308-.883-2.359-.89h-.029c-.803 0-1.539.214-2.185.636l-1.994-.653c.457-1.32 1.181-2.36 2.153-3.096C10.04 6.43 11.13 6 12.354 6h.062c1.732.012 3.107.558 4.087 1.622.957 1.043 1.461 2.555 1.497 4.495l.13.02c1.144.194 2.148.703 2.908 1.477 1.023 1.052 1.555 2.508 1.555 4.221 0 .166-.005.331-.015.494-.137 2.28-1.163 4.07-2.969 5.176C17.987 23.474 15.354 24 12.186 24z"/>
              </svg>
            </div>
            <h2 className="mb-3 text-2xl tracking-[1px]">
              CONNECT THREADS
            </h2>
            <p className="mb-6 text-[12px] leading-relaxed text-[#5a5550]">
              Threads бүртгэлээ холбож нийтлэл удирдаарай.
            </p>
            <a href="/api/admin/threads/auth" className="btn-blood inline-block">
              Холбох
            </a>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {profile && (
              <div className="card p-5">
                <div className="flex items-center gap-4">
                  {profile.threads_profile_picture_url ? (
                    <img src={profile.threads_profile_picture_url} alt={profile.username} className="h-12 w-12 border border-[#1c1c1c] object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center border border-[#1c1c1c] bg-[#0a0a0a] text-xl text-[#EF2C58]">
                      {profile.name?.charAt(0) || "?"}
                    </div>
                  )}
                  <div>
                    <div className="text-lg tracking-[2px]">{profile.name}</div>
                    <div className="text-[11px] text-[#5a5550]">@{profile.username}</div>
                    <span className="inline-flex items-center gap-1.5 text-[9px] uppercase tracking-[2px] text-green-500">
                      <span className="h-1.5 w-1.5 bg-green-500" /> Холбогдсон
                    </span>
                  </div>
                </div>
              </div>
            )}
            {[
              { key: "followers_count", label: "Followers" },
              { key: "views", label: "Views (28d)" },
              { key: "likes", label: "Likes (28d)" },
              { key: "replies", label: "Replies (28d)" },
            ].map((stat) => (
              <div key={stat.key} className="card p-5">
                <div className="text-[9px] uppercase tracking-[0.5px] text-[#5a5550]">{stat.label}</div>
                <div className="mt-2 text-3xl tracking-[2px] text-[#EF2C58]">
                  {getInsightValue(stat.key).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Instagram Integration */}
        <div className="card p-5">
          <div className="text-[10px] uppercase tracking-[0.5px] text-[#5a5550] mb-3">Instagram интеграц</div>
          {igStatus?.hasToken ? (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-2 w-2 rounded-full bg-green-400" />
                <span className="text-[13px] font-semibold text-[#1A1A1A]">
                  Холбогдсон {igStatus.username ? `(@${igStatus.username})` : ""}
                </span>
              </div>
              <p className="text-[11px] text-[#5a5550] mb-3">
                Token: {igStatus.tokenPreview || "***"}
              </p>
              <div className="flex gap-2">
                <button onClick={handleIgRefresh} className="btn-ghost text-[11px] px-3 py-1.5">
                  Token шинэчлэх
                </button>
                <button onClick={handleIgDelete} className="btn-ghost text-[11px] px-3 py-1.5 text-red-400 border-red-900/30 hover:border-red-500/50">
                  Устгах
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-[12px] text-[#5a5550] mb-2 leading-relaxed">
                Instagram Graph API token оруулна уу. Reels болон постууд нүүр хуудсанд харагдана.
              </p>
              <p className="text-[11px] text-[#3a3835] mb-3">
                Meta Developer → App → Instagram Basic Display → Generate Token
              </p>
              <input
                value={igToken}
                onChange={(e) => setIgToken(e.target.value)}
                placeholder="IGQVJ..."
                className="input-dark mb-3"
                type="password"
              />
              <button onClick={handleIgSave} disabled={!igToken.trim() || igSaving} className="btn-blood">
                {igSaving ? "Холбож байна..." : "Холбох"}
              </button>
            </div>
          )}
          {igMsg && (
            <p className={`mt-3 text-[11px] ${igMsg.startsWith("Алдаа") ? "text-red-400" : "text-green-400"}`}>
              {igMsg}
            </p>
          )}
        </div>

        {/* Tasks Management */}
        <div className="card mt-4 p-5">
          <div className="text-[10px] uppercase tracking-[2px] text-[#EF2C58] mb-4">ДААЛГАВАР УДИРДЛАГА</div>

          {/* Create task form */}
          <div className="space-y-3 mb-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                value={taskForm.title}
                onChange={(e) => setTaskForm(f => ({...f, title: e.target.value}))}
                placeholder="Даалгаврын нэр (жиш: AI tool хийж тест хийх)"
                className="input-dark"
                maxLength={200}
              />
              <input
                value={taskForm.xpReward}
                onChange={(e) => setTaskForm(f => ({...f, xpReward: e.target.value}))}
                placeholder="XP (200-5000)"
                className="input-dark"
                type="number"
                min={200}
                max={5000}
              />
            </div>
            <input
              value={taskForm.description}
              onChange={(e) => setTaskForm(f => ({...f, description: e.target.value}))}
              placeholder="Тайлбар (заавал биш)"
              className="input-dark"
              maxLength={2000}
            />
            <div className="flex items-center gap-2">
              <button onClick={handleTaskCreate} disabled={!taskForm.title.trim() || taskSaving} className="btn-blood">
                {taskSaving ? "Нэмж байна..." : "+ Даалгавар нэмэх"}
              </button>
              {taskMsg && <span className={`text-[11px] ${taskMsg.startsWith("Алдаа") ? "text-red-400" : "text-green-400"}`}>{taskMsg}</span>}
            </div>
          </div>

          {/* Tasks list */}
          <div className="space-y-2">
            {tasks.map((t, i) => {
              const statusColors: Record<string, string> = {
                open: "text-green-400",
                submitted: "text-yellow-400",
                accepted: "text-[#EF2C58]",
                rejected: "text-red-400",
              };
              const statusLabels: Record<string, string> = {
                open: "НЭЭЛТТЭЙ",
                submitted: "ХҮЛЭЭЖ БУЙ",
                accepted: "БАТАЛСАН",
                rejected: "ТАТГАЛЗСАН",
              };
              return (
                <div key={t._id} className="flex items-center justify-between gap-3 rounded-[4px] bg-[#1c1c1c] p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[12px] font-bold text-[#EF2C58]">#{i + 1}</span>
                      <span className="text-[13px] font-bold text-[#1A1A1A] truncate">{t.title}</span>
                      <span className="rounded-[4px] bg-[rgba(239,44,88,0.12)] px-1.5 py-0.5 text-[9px] font-bold text-[#EF2C58]">+{t.xpReward} XP</span>
                      <span className={`text-[9px] font-bold ${statusColors[t.status] || "text-[#5a5550]"}`}>{statusLabels[t.status] || t.status}</span>
                    </div>
                    {t.description && <div className="text-[11px] text-[#5a5550] line-clamp-1">{t.description}</div>}
                    {t.assignedTo && <div className="text-[10px] text-[#5a5550]">→ {t.assignedTo.name}</div>}
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    {t.status === "submitted" && (
                      <>
                        <button onClick={() => handleTaskAction(t._id, "accept")} className="text-[10px] text-green-400 hover:underline">Батлах</button>
                        <button onClick={() => handleTaskAction(t._id, "reject")} className="text-[10px] text-red-400 hover:underline">Татгалзах</button>
                      </>
                    )}
                    <button onClick={() => handleTaskDelete(t._id)} className="text-[10px] text-red-400 hover:underline">Устгах</button>
                  </div>
                </div>
              );
            })}
            {tasks.length === 0 && <p className="text-[11px] text-[#5a5550]">Даалгавар байхгүй</p>}
          </div>
        </div>

        {/* Announcements Management */}
        <div className="card mt-4 p-5">
          <div className="text-[10px] uppercase tracking-[2px] text-[#EF2C58] mb-4">МЭДЭГДЭЛ УДИРДЛАГА</div>

          {/* Form */}
          <div className="space-y-3 mb-4">
            <input
              value={annForm.title}
              onChange={(e) => setAnnForm(f => ({...f, title: e.target.value}))}
              placeholder="Гарчиг"
              className="input-dark"
              maxLength={200}
            />
            <textarea
              value={annForm.content}
              onChange={(e) => setAnnForm(f => ({...f, content: e.target.value}))}
              placeholder="Агуулга..."
              className="input-dark min-h-[80px] resize-y"
              maxLength={5000}
            />
            <input
              value={annForm.image}
              onChange={(e) => setAnnForm(f => ({...f, image: e.target.value}))}
              placeholder="Зургийн URL (заавал биш)"
              className="input-dark"
            />
            <div className="flex items-center gap-3">
              <select
                value={annForm.tag}
                onChange={(e) => setAnnForm(f => ({...f, tag: e.target.value}))}
                className="input-dark w-auto"
              >
                {["мэдэгдэл","шинэчлэл","AI","эвент","бусад"].map(t => (
                  <option key={t} value={t}>{t.toUpperCase()}</option>
                ))}
              </select>
              <label className="flex items-center gap-1.5 text-[11px] text-[#c8c8c0] cursor-pointer">
                <input
                  type="checkbox"
                  checked={annForm.pinned}
                  onChange={(e) => setAnnForm(f => ({...f, pinned: e.target.checked}))}
                  className="accent-[#EF2C58]"
                />
                Pinned
              </label>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleAnnSave} disabled={!annForm.title.trim() || !annForm.content.trim() || annSaving} className="btn-blood">
                {annSaving ? "Хадгалж байна..." : annEditing ? "Шинэчлэх" : "Нэмэх"}
              </button>
              {annEditing && (
                <button onClick={() => { setAnnEditing(null); setAnnForm({title:"",content:"",image:"",tag:"мэдэгдэл",pinned:false}); }} className="btn-ghost text-[11px] px-3 py-1.5">
                  Болих
                </button>
              )}
              {annMsg && <span className={`text-[11px] ${annMsg.startsWith("Алдаа") ? "text-red-400" : "text-green-400"}`}>{annMsg}</span>}
            </div>
          </div>

          {/* List */}
          <div className="space-y-2">
            {announcements.map(a => (
              <div key={a._id} className="flex items-start justify-between gap-3 rounded-[4px] bg-[#1c1c1c] p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {a.pinned && <span className="text-[9px] font-bold text-[#EF2C58]">PIN</span>}
                    <span className="text-[9px] font-bold text-[#5a5550] uppercase">{a.tag}</span>
                  </div>
                  <div className="text-[13px] font-bold text-[#1A1A1A] truncate">{a.title}</div>
                  <div className="text-[11px] text-[#5a5550] line-clamp-1">{a.content}</div>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button onClick={() => startAnnEdit(a)} className="text-[10px] text-[#EF2C58] hover:underline">Засах</button>
                  <button onClick={() => handleAnnDelete(a._id)} className="text-[10px] text-red-400 hover:underline">Устгах</button>
                </div>
              </div>
            ))}
            {announcements.length === 0 && <p className="text-[11px] text-[#5a5550]">Мэдэгдэл байхгүй</p>}
          </div>
        </div>

        {threadsConnected && (
          <div className="card mt-4 p-5">
            <div className="text-[10px] uppercase tracking-[0.5px] text-[#5a5550] mb-3">Шууд нийтлэх</div>
            <textarea
              value={postText}
              onChange={(e) => setPostText(e.target.value)}
              placeholder="Threads руу шууд нийтлэх..."
              className="input-dark min-h-[100px] resize-y"
              maxLength={500}
            />
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[11px] text-[#3a3835]">{postText.length}/500</span>
              <div className="flex items-center gap-3">
                {postResult && (
                  <span className={`text-[11px] ${postResult.startsWith("Алдаа") ? "text-red-400" : "text-green-400"}`}>
                    {postResult}
                  </span>
                )}
                <button onClick={handlePost} disabled={!postText.trim() || posting} className="btn-blood">
                  {posting ? "Нийтлэж байна..." : "Нийтлэх"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
