"use client";

import { useEffect, useState, use, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import PostCard from "@/components/PostCard";
import { formatDistanceToNow } from "@/lib/utils";
import { getLevelTitle, getLevelProgress, xpForLevel } from "@/lib/xpClient";

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
  data_science: "Дата шинжилгээ",
  robotics: "Робот техник",
  content_creation: "Контент бүтээх",
  education: "Боловсрол",
  finance: "Санхүү",
  health: "Эрүүл мэнд",
};

interface UserProfile {
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
  xp?: number;
  level?: number;
  createdAt: string;
}

interface Post {
  _id: string;
  content: string;
  image?: string;
  likes: string[];
  commentsCount: number;
  createdAt: string;
  author: {
    _id: string;
    name: string;
    avatar?: string;
  };
}

export default function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session, update: updateSession } = useSession();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isOwner = session && (session.user as { id: string }).id === id;

  useEffect(() => {
    fetchProfile();
  }, [id]);

  const fetchProfile = async () => {
    try {
      const [userRes, postsRes] = await Promise.all([
        fetch(`/api/users/${id}`),
        fetch(`/api/posts?author=${id}`),
      ]);

      const userData = await userRes.json();
      const postsData = await postsRes.json();

      if (userRes.ok) {
        setUser(userData.user);
        setEditName(userData.user.name);
        setEditBio(userData.user.bio || "");
        setEditPhone(userData.user.phone || "");
      }
      if (postsRes.ok) setPosts(postsData.posts);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, bio: editBio, phone: editPhone }),
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data.user);
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("Зураг 5MB-с бага байх ёстой");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const uploadData = await uploadRes.json();

      if (!uploadRes.ok) {
        alert(uploadData.error || "Оруулах амжилтгүй");
        return;
      }

      const updateRes = await fetch(`/api/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar: uploadData.url }),
      });
      const updateData = await updateRes.json();
      if (updateRes.ok) {
        setUser(updateData.user);
        updateSession();
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeletePost = (postId: string) => {
    setPosts((prev) => prev.filter((p) => p._id !== postId));
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-2 w-2 animate-pulse rounded-full bg-[#EF2C58]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="py-16 text-center">
        <p className="text-lg text-[#AAAAAA]">
          Хэрэглэгч олдсонгүй
        </p>
      </div>
    );
  }

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 border-b border-[rgba(255,255,255,0.08)] pb-8">
        <div className="flex flex-col items-start gap-5 sm:flex-row">
          {/* Square avatar */}
          <div className="relative group">
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="h-20 w-20 rounded-[4px] object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-[4px] bg-[rgba(0,0,0,0.08)] text-2xl font-bold text-[#AAAAAA]">
                {initials}
              </div>
            )}
            {isOwner && (
              <>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="absolute inset-0 flex items-center justify-center rounded-[4px] bg-[rgba(0,0,0,0.6)] opacity-0 transition group-hover:opacity-100"
                >
                  {uploading ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#EF2C58] border-t-transparent" />
                  ) : (
                    <svg className="h-5 w-5 text-[#F8F8F6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
              </>
            )}
          </div>

          <div className="flex-1 min-w-0">
            {editing ? (
              <div className="space-y-3">
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-[4px] border border-[#E8E8E6] bg-[#141414] px-4 py-2.5 text-[14px] text-[#F8F8F6] placeholder-[#555555] outline-none transition focus:border-[#EF2C58]"
                  placeholder="Нэр"
                />
                <input
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full rounded-[4px] border border-[#E8E8E6] bg-[#141414] px-4 py-2.5 text-[14px] text-[#F8F8F6] placeholder-[#555555] outline-none transition focus:border-[#EF2C58]"
                  placeholder="Утасны дугаар"
                />
                <textarea
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  rows={3}
                  maxLength={300}
                  className="w-full rounded-[4px] border border-[#E8E8E6] bg-[#141414] px-4 py-2.5 text-[14px] text-[#F8F8F6] placeholder-[#555555] outline-none transition focus:border-[#EF2C58] resize-none"
                  placeholder="Богино намтар бичих..."
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="rounded-[4px] bg-[#EF2C58] px-5 py-2 text-[12px] font-semibold text-white transition hover:bg-[#D4264E] disabled:opacity-50"
                  >
                    {saving ? "..." : "Хадгалах"}
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="rounded-[4px] border border-[#E8E8E6] px-4 py-2 text-[12px] font-medium text-[#999999] transition hover:text-[#F8F8F6]"
                  >
                    Цуцлах
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h1 className="text-xl font-bold text-[#F8F8F6]">
                      {user.name}
                    </h1>
                    {(() => {
                      const level = user.level || 1;
                      const xp = user.xp || 0;
                      const title = getLevelTitle(level);
                      const progress = getLevelProgress(xp, level);
                      const nextXP = xpForLevel(level + 1);
                      return (
                        <div className="mt-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-[#EF2C58]">
                              LV.{level}
                            </span>
                            <span className="text-[11px] text-[#999999]">
                              {title.titleMN}
                            </span>
                          </div>
                          <div className="mt-1.5 flex items-center gap-2">
                            <div className="h-1 w-28 overflow-hidden rounded-full bg-[rgba(0,0,0,0.08)]">
                              <div
                                className="h-full rounded-full bg-[#EF2C58] transition-all"
                                style={{ width: `${Math.round(progress * 100)}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-[#AAAAAA]">
                              {xp.toLocaleString()} / {nextXP.toLocaleString()} XP
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                    {user.clan && (
                      <span className="mt-1.5 inline-block rounded-[4px] bg-[rgba(239,44,88,0.06)] border border-[rgba(239,44,88,0.1)] px-2 py-0.5 text-[10px] font-semibold text-[#EF2C58]">
                        Кланы гишүүн
                      </span>
                    )}
                  </div>
                  {isOwner && (
                    <div className="flex shrink-0 gap-2">
                      <button
                        onClick={() => setEditing(true)}
                        className="rounded-[4px] border border-[#E8E8E6] px-3.5 py-1.5 text-[12px] font-medium text-[#999999] transition hover:border-[#EF2C58] hover:text-[#F8F8F6]"
                      >
                        Засах
                      </button>
                      <button
                        onClick={() => signOut()}
                        className="rounded-[4px] border border-[#E8E8E6] px-3.5 py-1.5 text-[12px] font-medium text-red-400/60 transition hover:border-red-400/30 hover:text-red-400"
                      >
                        Гарах
                      </button>
                    </div>
                  )}
                </div>

                {user.bio && (
                  <p className="mt-3 text-[13px] leading-[1.7] text-[#999999]">
                    {user.bio}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-[#AAAAAA]">
                  {user.aiExperience && (
                    <span>AI: {AI_LEVEL_LABELS[user.aiExperience] || user.aiExperience}</span>
                  )}
                  {user.age && (
                    <span>{user.age} нас</span>
                  )}
                  <span>{formatDistanceToNow(user.createdAt)} нэгдсэн</span>
                </div>

                {user.interests && user.interests.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {user.interests.map((i) => (
                      <span
                        key={i}
                        className="rounded-[4px] border border-[rgba(255,255,255,0.08)] px-2 py-0.5 text-[10px] text-[#AAAAAA]"
                      >
                        {INTEREST_LABELS[i] || i}
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Posts section */}
      <div className="mb-3 flex items-center gap-2 px-1">
        <span className="text-[12px] font-semibold text-[#999999]">Нийтлэлүүд</span>
        <span className="text-[12px] text-[#AAAAAA]">{posts.length}</span>
      </div>

      {posts.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-[#AAAAAA]">Нийтлэл байхгүй байна.</p>
      ) : (
        <div className="-mx-5">
          {posts.map((post) => (
            <PostCard key={post._id} post={post} onDelete={handleDeletePost} />
          ))}
        </div>
      )}
    </div>
  );
}
