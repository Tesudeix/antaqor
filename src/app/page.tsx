"use client";

import { useEffect, useState, useRef } from "react";
import PostCard from "@/components/PostCard";
import Link from "next/link";
import { useMembership } from "@/lib/useMembership";

interface Post {
  _id: string;
  content: string;
  image?: string;
  visibility?: string;
  likes: string[];
  commentsCount: number;
  createdAt: string;
  author: {
    _id: string;
    name: string;
    avatar?: string;
  } | null;
}

function HeroImage({ isAdmin }: { isAdmin: boolean }) {
  const [heroUrl, setHeroUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/hero")
      .then((r) => r.json())
      .then((d) => setHeroUrl(d.url || null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/hero", { method: "POST", body: form });
      const data = await res.json();
      if (res.ok) setHeroUrl(data.url);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDelete = async () => {
    if (!confirm("Hero зургийг устгах уу?")) return;
    const res = await fetch("/api/hero", { method: "DELETE" });
    if (res.ok) setHeroUrl(null);
  };

  if (loading) {
    return (
      <div className="-mx-6 md:-mx-10 mb-6 aspect-[3/4] max-h-[80vh] bg-[#0a0a0a] flex items-center justify-center">
        <div className="h-3 w-3 animate-pulse bg-[#cc2200]" />
      </div>
    );
  }

  // No hero image — show upload button for admin only
  if (!heroUrl) {
    if (!isAdmin) return null;
    return (
      <div className="-mx-6 md:-mx-10 mb-6">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="w-full aspect-[3/4] max-h-[80vh] border border-dashed border-[#1c1c1c] bg-[#0a0a0a] flex flex-col items-center justify-center gap-3 transition hover:border-[#cc2200] group cursor-pointer"
        >
          {uploading ? (
            <div className="h-4 w-4 animate-spin border-2 border-[#cc2200] border-t-transparent" />
          ) : (
            <>
              <svg className="h-8 w-8 text-[#2a2825] group-hover:text-[#cc2200] transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-[10px] uppercase tracking-[2px] text-[#5a5550] group-hover:text-[#c8c8c0] transition">
                Hero зураг нэмэх
              </span>
            </>
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleUpload}
          className="hidden"
        />
      </div>
    );
  }

  return (
    <div className="-mx-6 md:-mx-10 mb-6 relative group">
      <div className="w-full aspect-[3/4] max-h-[80vh] overflow-hidden bg-[#0a0a0a]">
        <img
          src={heroUrl}
          alt="Hero"
          className="h-full w-full object-cover"
        />
      </div>

      {/* Admin controls overlay */}
      {isAdmin && (
        <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex h-8 items-center gap-1.5 bg-[rgba(3,3,3,0.85)] border border-[#1c1c1c] px-3 text-[9px] uppercase tracking-[1px] text-[#c8c8c0] hover:text-[#ede8df] hover:border-[rgba(240,236,227,0.2)] transition"
          >
            {uploading ? (
              <div className="h-3 w-3 animate-spin border border-[#cc2200] border-t-transparent" />
            ) : (
              <>
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Солих
              </>
            )}
          </button>
          <button
            onClick={handleDelete}
            className="flex h-8 items-center gap-1.5 bg-[rgba(3,3,3,0.85)] border border-[#1c1c1c] px-3 text-[9px] uppercase tracking-[1px] text-[#5a5550] hover:text-[#cc2200] hover:border-[rgba(204,34,0,0.3)] transition"
          >
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Устгах
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleUpload}
            className="hidden"
          />
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const { loading: memberLoading, isMember, isAdmin, isLoggedIn } = useMembership();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [filter, setFilter] = useState<"all" | "free">("all");

  const fetchPosts = async (pageNum: number, vis?: string) => {
    try {
      const params = new URLSearchParams({ page: String(pageNum), limit: "20" });
      if (vis === "free") {
        params.set("visibility", "free");
      }
      const res = await fetch(`/api/posts?${params}`);
      const data = await res.json();
      if (res.ok) {
        const safePosts = (data.posts || []).filter((p: Post) => p.author !== null);
        if (pageNum === 1) {
          setPosts(safePosts);
        } else {
          setPosts((prev) => [...prev, ...safePosts]);
        }
        setHasMore(pageNum < data.pagination.pages);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (memberLoading) return;
    setPage(1);
    setLoading(true);
    if (isMember || isAdmin) {
      fetchPosts(1, filter === "free" ? "free" : undefined);
    } else {
      fetchPosts(1, "free");
    }
  }, [memberLoading, isMember, isAdmin, filter]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    const vis = (!isMember && !isAdmin) ? "free" : filter === "free" ? "free" : undefined;
    fetchPosts(next, vis);
  };

  const handleDelete = (id: string) => {
    setPosts((prev) => prev.filter((p) => p._id !== id));
  };

  if (memberLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-3 w-3 animate-pulse bg-[#cc2200]" />
      </div>
    );
  }

  return (
    <div>
      {/* Hero Image - full width */}
      <HeroImage isAdmin={isAdmin} />

      {/* Feed header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-[Bebas_Neue] text-3xl tracking-[2px] text-[#ede8df]">
            Мэдээ
          </h2>
          <p className="mt-1 text-[11px] font-medium tracking-[0.5px] text-[#5a5550]">
            {!isLoggedIn
              ? "НЭЭЛТТЭЙ МЭДЭЭЛЭЛ · БҮГДЭД ЗОРИУЛСАН"
              : isMember
              ? "ДИЖИТАЛ ҮНДЭСТНИЙ НИЙГЭМЛЭГ"
              : "НЭЭЛТТЭЙ МЭДЭЭ · ГИШҮҮН БОЛЖ БҮРЭН ХАНДАХ"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {(isMember || isAdmin) && (
            <div className="flex gap-1">
              <button
                onClick={() => setFilter("all")}
                className={`px-3 py-1.5 text-[9px] uppercase tracking-[2px] transition ${
                  filter === "all"
                    ? "bg-[rgba(204,34,0,0.1)] text-[#cc2200]"
                    : "text-[#5a5550] hover:text-[#c8c8c0]"
                }`}
              >
                Бүгд
              </button>
              <button
                onClick={() => setFilter("free")}
                className={`px-3 py-1.5 text-[9px] uppercase tracking-[2px] transition ${
                  filter === "free"
                    ? "bg-[rgba(34,197,94,0.1)] text-green-500"
                    : "text-[#5a5550] hover:text-[#c8c8c0]"
                }`}
              >
                Нээлттэй
              </button>
            </div>
          )}
          {!isLoggedIn && (
            <div className="flex items-center gap-2">
              <Link href="/auth/signin" className="btn-ghost !py-2 !px-4 !text-[11px]">
                Нэвтрэх
              </Link>
              <Link href="/auth/signup" className="btn-blood !py-2 !px-4 !text-[11px]">
                Бүртгүүлэх
              </Link>
            </div>
          )}
          {isLoggedIn && !isMember && (
            <Link href="/clan" className="btn-blood !py-2 !px-5 !text-[11px]">
              Кланд нэгдэх
            </Link>
          )}
          {isMember && (
            <Link href="/posts/new" className="btn-blood !py-2 !px-5 !text-[11px]">
              Шинэ пост
            </Link>
          )}
        </div>
      </div>

      {/* Posts feed */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-3 w-3 animate-pulse bg-[#cc2200]" />
        </div>
      ) : posts.length === 0 ? (
        <div className="py-16 text-center">
          <p className="font-[Bebas_Neue] text-2xl tracking-[1px] text-[rgba(240,236,227,0.3)]">
            Одоогоор нийтлэл байхгүй
          </p>
          {!isLoggedIn && (
            <p className="mt-4 text-[13px] text-[#5a5550]">
              Бүртгүүлж нийгэмлэгт нэгдээрэй
            </p>
          )}
          {isMember && (
            <>
              <p className="mt-2 text-[13px] text-[#5a5550]">
                Нийгэмлэгт хамгийн түрүүнд хуваалцаарай.
              </p>
              <Link href="/posts/new" className="btn-blood mt-6 inline-block">
                Пост үүсгэх
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <PostCard
              key={post._id}
              post={post}
              locked={false}
              onDelete={handleDelete}
            />
          ))}

          {hasMore && (
            <div className="flex justify-center pt-6">
              <button onClick={loadMore} className="btn-ghost">
                Цааш үзэх
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
