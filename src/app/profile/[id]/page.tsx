"use client";

import { useEffect, useState, use, useRef } from "react";
import { useSession } from "next-auth/react";
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
  const { data: session } = useSession();
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
        <div className="h-3 w-3 animate-pulse bg-[#cc2200]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="py-16 text-center">
        <p className="font-[Bebas_Neue] text-2xl tracking-[2px] text-[rgba(240,236,227,0.3)]">
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
      <div className="card mb-10 p-6 md:p-8">
        <div className="flex flex-col items-start gap-5 sm:flex-row">
          <div className="relative group">
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="h-20 w-20 object-cover ring-2 ring-[#1c1c1c]"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center bg-[#1c1c1c] font-[Bebas_Neue] text-2xl tracking-wider text-[#c8c8c0]">
                {initials}
              </div>
            )}
            {isOwner && (
              <>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="absolute inset-0 flex items-center justify-center bg-[rgba(0,0,0,0.6)] opacity-0 transition group-hover:opacity-100"
                >
                  {uploading ? (
                    <div className="h-4 w-4 animate-spin border-2 border-[#cc2200] border-t-transparent" />
                  ) : (
                    <svg className="h-5 w-5 text-[#ede8df]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

          <div className="flex-1">
            {editing ? (
              <div className="space-y-3">
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="input-dark"
                  placeholder="Нэр"
                />
                <input
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="input-dark"
                  placeholder="Утасны дугаар"
                />
                <textarea
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  rows={3}
                  maxLength={300}
                  className="input-dark resize-none"
                  placeholder="Богино намтар бичих..."
                />
                <div className="flex gap-3">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="btn-blood !py-2 !px-5 !text-[10px]"
                  >
                    {saving ? "Хадгалж байна..." : "Хадгалах"}
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="btn-ghost !py-2 !px-5 !text-[10px]"
                  >
                    Цуцлах
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h1 className="font-[Bebas_Neue] text-3xl tracking-[3px] text-[#ede8df]">
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
                            <span className="text-[10px] font-bold uppercase tracking-[2px] text-[#cc2200]">
                              LV.{level}
                            </span>
                            <span className="text-[10px] uppercase tracking-[2px] text-[#c8c8c0]">
                              {title.titleMN}
                            </span>
                          </div>
                          <div className="mt-1.5 flex items-center gap-2">
                            <div className="h-1.5 w-32 overflow-hidden bg-[#1c1c1c]">
                              <div
                                className="h-full bg-[#cc2200] transition-all"
                                style={{ width: `${Math.round(progress * 100)}%` }}
                              />
                            </div>
                            <span className="text-[9px] text-[#5a5550]">
                              {xp.toLocaleString()} / {nextXP.toLocaleString()} XP
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                    {user.clan && (
                      <span className="mt-1 inline-block text-[10px] uppercase tracking-[3px] text-[#cc2200]">
                        Кланы гишүүн
                      </span>
                    )}
                  </div>
                  {isOwner && (
                    <button
                      onClick={() => setEditing(true)}
                      className="btn-ghost !py-2 !px-4 !text-[10px]"
                    >
                      Засах
                    </button>
                  )}
                </div>

                {user.bio && (
                  <p className="mt-3 text-[13px] leading-[1.8] text-[rgba(240,236,227,0.6)]">
                    {user.bio}
                  </p>
                )}

                {/* Profile details */}
                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
                  {user.aiExperience && (
                    <span className="text-[10px] tracking-[1px] text-[#c8c8c0]">
                      AI: {AI_LEVEL_LABELS[user.aiExperience] || user.aiExperience}
                    </span>
                  )}
                  {user.age && (
                    <span className="text-[10px] tracking-[1px] text-[#5a5550]">
                      {user.age} нас
                    </span>
                  )}
                  <span className="text-[10px] tracking-[2px] text-[#5a5550]">
                    НЭГДСЭН {formatDistanceToNow(user.createdAt).toUpperCase()}
                  </span>
                </div>

                {user.interests && user.interests.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {user.interests.map((i) => (
                      <span
                        key={i}
                        className="border border-[#1c1c1c] px-2 py-0.5 text-[9px] uppercase tracking-[1px] text-[#5a5550]"
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

      <div className="section-label">
        Нийтлэлүүд ({posts.length})
      </div>

      {posts.length === 0 ? (
        <p className="py-8 text-center text-[12px] text-[#5a5550]">Нийтлэл байхгүй байна.</p>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <PostCard key={post._id} post={post} onDelete={handleDeletePost} />
          ))}
        </div>
      )}
    </div>
  );
}
