"use client";

import { useEffect, useState } from "react";
import PostCard from "@/components/PostCard";
import Link from "next/link";
import { useSession } from "next-auth/react";

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

export default function Home() {
  const { data: session } = useSession();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchPosts = async (pageNum: number) => {
    try {
      const res = await fetch(`/api/posts?page=${pageNum}&limit=20`);
      const data = await res.json();
      if (res.ok) {
        if (pageNum === 1) {
          setPosts(data.posts);
        } else {
          setPosts((prev) => [...prev, ...data.posts]);
        }
        setHasMore(pageNum < data.pagination.pages);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts(1);
  }, []);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchPosts(next);
  };

  const handleDelete = (id: string) => {
    setPosts((prev) => prev.filter((p) => p._id !== id));
  };

  return (
    <div>
      {/* Hero Section */}
      <section className="relative mb-16 overflow-hidden py-16 md:py-24">
        <div className="absolute right-[-200px] top-1/2 h-[500px] w-[500px] -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(204,34,0,0.10)_0%,transparent_70%)] pointer-events-none" />

        <div className="animate-fade-up-delay-1 mb-3 text-[11px] uppercase tracking-[4px] text-[#c8c8c0]">
          Community · Digital Nation
        </div>
        <h1 className="animate-fade-up-delay-2 font-[Bebas_Neue] text-[clamp(56px,10vw,140px)] leading-[0.9] tracking-[-2px]">
          ANTA<span className="text-[#cc2200]">QOR</span>
        </h1>
        <div className="animate-fade-up-delay-2 mt-3 font-[Bebas_Neue] text-[clamp(20px,3vw,36px)] tracking-[6px] text-[rgba(240,236,227,0.25)]">
          <strong className="text-[#ede8df]">Be Wild.</strong> Conquer the Future.
        </div>
        <p className="animate-fade-up-delay-3 mt-6 max-w-lg text-[13px] leading-[2] text-[rgba(240,236,227,0.5)]">
          A nation of builders who own AI, shape their tools, and define their future. Join the community — share ideas, connect, and build together.
        </p>
        <div className="animate-fade-up-delay-3 mt-8 flex flex-wrap gap-4">
          {session ? (
            <Link href="/posts/new" className="btn-blood">
              Create a Post
            </Link>
          ) : (
            <Link href="/auth/signup" className="btn-blood">
              Join the Clan
            </Link>
          )}
          <Link href="/clan" className="btn-ghost">
            Explore Clan
          </Link>
        </div>
      </section>

      {/* Feed Section */}
      <section>
        <div className="section-label">Community Feed</div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-3 w-3 animate-pulse rounded-full bg-[#cc2200]" />
          </div>
        ) : posts.length === 0 ? (
          <div className="py-16 text-center">
            <p className="font-[Bebas_Neue] text-2xl tracking-[2px] text-[rgba(240,236,227,0.3)]">
              No posts yet
            </p>
            <p className="mt-2 text-[12px] text-[#5a5550]">
              Be the first to share something with the community.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => (
              <PostCard key={post._id} post={post} onDelete={handleDelete} />
            ))}

            {hasMore && (
              <div className="flex justify-center pt-6">
                <button onClick={loadMore} className="btn-ghost">
                  Load More
                </button>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
