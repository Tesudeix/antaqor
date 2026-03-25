"use client";

import { useEffect, useState } from "react";
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
      if (vis === "free") params.set("visibility", "free");
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
        <div className="h-2 w-2 animate-pulse rounded-full bg-[#006491]" />
      </div>
    );
  }

  return (
    <div>
      {/* Feed header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-[#e8e6e1]">Мэдээ</h1>
          {(isMember || isAdmin) && (
            <div className="flex rounded-lg bg-[#0c0c10] p-0.5">
              <button
                onClick={() => setFilter("all")}
                className={`rounded-md px-3 py-1 text-[11px] font-medium transition ${
                  filter === "all"
                    ? "bg-[#1a1a22] text-[#e8e6e1]"
                    : "text-[#6b6b78] hover:text-[#e8e6e1]"
                }`}
              >
                Бүгд
              </button>
              <button
                onClick={() => setFilter("free")}
                className={`rounded-md px-3 py-1 text-[11px] font-medium transition ${
                  filter === "free"
                    ? "bg-[#1a1a22] text-[#e8e6e1]"
                    : "text-[#6b6b78] hover:text-[#e8e6e1]"
                }`}
              >
                Нээлттэй
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!isLoggedIn && (
            <Link href="/auth/signup" className="btn-primary !py-2 !px-4 !text-[12px]">
              Нэгдэх
            </Link>
          )}
          {isLoggedIn && !isMember && (
            <Link href="/clan" className="btn-primary !py-2 !px-4 !text-[12px]">
              Клан
            </Link>
          )}
          {isMember && (
            <Link href="/posts/new" className="btn-primary !py-2 !px-4 !text-[12px]">
              + Пост
            </Link>
          )}
        </div>
      </div>

      {/* Posts */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-2 w-2 animate-pulse rounded-full bg-[#006491]" />
        </div>
      ) : posts.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-[15px] text-[#6b6b78]">Одоогоор нийтлэл байхгүй</p>
          {isMember && (
            <Link href="/posts/new" className="btn-primary mt-6 inline-block">
              Пост үүсгэх
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard
              key={post._id}
              post={post}
              locked={false}
              onDelete={handleDelete}
            />
          ))}

          {hasMore && (
            <div className="flex justify-center pt-4 pb-8">
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
