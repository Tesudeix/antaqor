"use client";

import { useEffect, useState, use, useRef } from "react";
import { useSession } from "next-auth/react";
import PostCard from "@/components/PostCard";
import { formatDistanceToNow } from "@/lib/utils";

interface UserProfile {
  _id: string;
  name: string;
  email: string;
  avatar?: string;
  bio?: string;
  clan?: string;
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
        body: JSON.stringify({ name: editName, bio: editBio }),
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
        <div className="h-3 w-3 animate-pulse rounded-full bg-[#cc2200]" />
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
                className="h-20 w-20 rounded-full object-cover ring-2 ring-[#1c1c1c]"
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
                  className="absolute inset-0 flex items-center justify-center rounded-full bg-[rgba(0,0,0,0.6)] opacity-0 transition group-hover:opacity-100"
                >
                  {uploading ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#cc2200] border-t-transparent" />
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
                <p className="mt-3 text-[10px] tracking-[2px] text-[#5a5550]">
                  НЭГДСЭН {formatDistanceToNow(user.createdAt).toUpperCase()}
                </p>
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
