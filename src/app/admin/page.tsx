"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";

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

export default function AdminDashboard() {
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [insights, setInsights] = useState<InsightMetric[]>([]);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [postText, setPostText] = useState("");
  const [posting, setPosting] = useState(false);
  const [postResult, setPostResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const error = searchParams.get("error");
  const justConnected = searchParams.get("connected");

  const loadData = useCallback(async () => {
    try {
      const profileRes = await fetch("/api/admin/threads/profile");
      if (profileRes.status === 400) {
        setConnected(false);
        setLoading(false);
        return;
      }
      const profileData = await profileRes.json();
      if (profileData.error) {
        setConnected(false);
        setLoading(false);
        return;
      }
      setProfile(profileData);
      setConnected(true);

      const insightsRes = await fetch("/api/admin/threads/insights?period=days_28");
      if (insightsRes.ok) {
        const insightsData = await insightsRes.json();
        setInsights(insightsData.data || []);
      }
    } catch {
      setConnected(false);
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
      setPostResult("Published successfully!");
      setPostText("");
      setTimeout(() => setPostResult(null), 4000);
    } catch (err) {
      setPostResult(
        `Error: ${err instanceof Error ? err.message : "Failed to post"}`
      );
    } finally {
      setPosting(false);
    }
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
        <div className="h-8 w-8 animate-spin border-2 border-[#cc2200] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-[Bebas_Neue] text-3xl tracking-[5px] md:text-4xl">
          THREADS <span className="text-[#cc2200]">COMMAND</span> CENTER
        </h1>
        <p className="mt-2 text-[11px] tracking-[2px] text-[#5a5550]">
          MANAGE YOUR THREADS PRESENCE FROM ONE PLACE
        </p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="border border-red-900/50 bg-red-950/30 px-4 py-3 text-[12px] text-red-400">
          {error}
        </div>
      )}
      {justConnected && (
        <div className="border border-green-900/50 bg-green-950/30 px-4 py-3 text-[12px] text-green-400">
          Threads account connected successfully!
        </div>
      )}

      {!connected ? (
        /* Connect Threads */
        <div className="card p-8 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center border border-[#1c1c1c]">
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-8 w-8 text-[#5a5550]">
              <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.028-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.308-.883-2.359-.89h-.029c-.803 0-1.539.214-2.185.636l-1.994-.653c.457-1.32 1.181-2.36 2.153-3.096C10.04 6.43 11.13 6 12.354 6h.062c1.732.012 3.107.558 4.087 1.622.957 1.043 1.461 2.555 1.497 4.495l.13.02c1.144.194 2.148.703 2.908 1.477 1.023 1.052 1.555 2.508 1.555 4.221 0 .166-.005.331-.015.494-.137 2.28-1.163 4.07-2.969 5.176C17.987 23.474 15.354 24 12.186 24z"/>
            </svg>
          </div>
          <h2 className="mb-3 font-[Bebas_Neue] text-2xl tracking-[3px]">
            CONNECT THREADS
          </h2>
          <p className="mb-6 text-[12px] leading-relaxed text-[#5a5550]">
            Authorize your Threads account to start managing posts and replies.
          </p>
          <a href="/api/admin/threads/auth" className="btn-blood inline-block">
            Connect Account
          </a>
          <p className="mt-4 text-[10px] text-[#3a3835]">
            Make sure to add the redirect URL to your Meta app settings first.
          </p>
        </div>
      ) : (
        <>
          {/* Profile + Stats Grid */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Profile Card */}
            {profile && (
              <div className="card p-6 lg:col-span-1">
                <div className="flex items-center gap-4">
                  {profile.threads_profile_picture_url ? (
                    <img
                      src={profile.threads_profile_picture_url}
                      alt={profile.username}
                      className="h-14 w-14 border border-[#1c1c1c] object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center border border-[#1c1c1c] bg-[#0a0a0a] font-[Bebas_Neue] text-xl text-[#cc2200]">
                      {profile.name?.charAt(0) || "?"}
                    </div>
                  )}
                  <div>
                    <div className="font-[Bebas_Neue] text-lg tracking-[2px]">
                      {profile.name}
                    </div>
                    <div className="text-[11px] text-[#5a5550]">
                      @{profile.username}
                    </div>
                  </div>
                </div>
                {profile.threads_biography && (
                  <p className="mt-4 text-[12px] leading-relaxed text-[#c8c8c0]">
                    {profile.threads_biography}
                  </p>
                )}
                <div className="mt-4 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[2px] text-green-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    Connected
                  </span>
                </div>
              </div>
            )}

            {/* Insight Cards */}
            {[
              { key: "followers_count", label: "Followers", color: "#cc2200" },
              { key: "views", label: "Views (28d)", color: "#e8440f" },
              { key: "likes", label: "Likes (28d)", color: "#c8c8c0" },
              { key: "replies", label: "Replies (28d)", color: "#5a5550" },
              { key: "reposts", label: "Reposts (28d)", color: "#cc2200" },
            ].map((stat) => (
              <div key={stat.key} className="card p-6">
                <div className="text-[9px] uppercase tracking-[3px] text-[#5a5550]">
                  {stat.label}
                </div>
                <div
                  className="mt-2 font-[Bebas_Neue] text-3xl tracking-[2px]"
                  style={{ color: stat.color }}
                >
                  {getInsightValue(stat.key).toLocaleString()}
                </div>
              </div>
            ))}
          </div>

          {/* Quick Post */}
          <div className="card p-6">
            <div className="section-label !mb-4">Instant Post</div>
            <div className="space-y-4">
              <textarea
                value={postText}
                onChange={(e) => setPostText(e.target.value)}
                placeholder="What's on your mind? Post directly to Threads..."
                className="input-dark min-h-[120px] resize-y"
                maxLength={500}
              />
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#3a3835]">
                  {postText.length}/500
                </span>
                <div className="flex items-center gap-3">
                  {postResult && (
                    <span
                      className={`text-[11px] ${
                        postResult.startsWith("Error")
                          ? "text-red-400"
                          : "text-green-400"
                      }`}
                    >
                      {postResult}
                    </span>
                  )}
                  <button
                    onClick={handlePost}
                    disabled={!postText.trim() || posting}
                    className="btn-blood"
                  >
                    {posting ? (
                      <span className="flex items-center gap-2">
                        <span className="h-3 w-3 animate-spin border border-current border-t-transparent" />
                        Publishing...
                      </span>
                    ) : (
                      "Publish to Threads"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
