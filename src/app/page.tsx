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
  const { data: session, status } = useSession();
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
    if (session) {
      fetchPosts(1);
    } else {
      setLoading(false);
    }
  }, [session]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchPosts(next);
  };

  const handleDelete = (id: string) => {
    setPosts((prev) => prev.filter((p) => p._id !== id));
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-3 w-3 animate-pulse rounded-full bg-[#cc2200]" />
      </div>
    );
  }

  // Not logged in — show hero landing
  if (!session) {
    return (
      <div>
        <section className="relative overflow-hidden py-20 md:py-32">
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
            <Link href="/auth/signup" className="btn-blood">
              Join the Clan
            </Link>
            <Link href="/auth/signin" className="btn-ghost">
              Sign In
            </Link>
          </div>
        </section>

        {/* Values Preview */}
        <section className="mt-8 border-t border-[rgba(240,236,227,0.06)] pt-16">
          <div className="section-label">Why Join</div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { num: "01", name: "FUTURISM", desc: "See what others haven't seen yet. Don't use AI — define it." },
              { num: "02", name: "TIME", desc: "Every decision filtered through efficiency. Faster. Leaner." },
              { num: "03", name: "HYPER ADAPTIVE", desc: "Don't adapt to change — anticipate it. Never stop evolving." },
              { num: "04", name: "ETERNAL CONQUEST", desc: "There is no finish line. The mission is eternal." },
            ].map((v) => (
              <div key={v.num} className="card p-6">
                <div className="mb-4 text-[10px] tracking-[3px] text-[rgba(240,236,227,0.2)]">{v.num}</div>
                <div className={`mb-2 font-[Bebas_Neue] text-xl tracking-[2px] ${v.num === "04" ? "text-[#cc2200]" : "text-[#ede8df]"}`}>
                  {v.name}
                </div>
                <p className="text-[11px] leading-[1.9] text-[rgba(240,236,227,0.5)]">{v.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Manifesto */}
        <section className="mt-16 overflow-hidden bg-[#cc2200] p-8 md:p-16">
          <div className="font-[Bebas_Neue] text-[clamp(28px,4vw,56px)] leading-[1.3] tracking-[3px] text-[#030303]">
            <span className="text-[rgba(5,5,5,0.4)]">The future doesn&apos;t wait.</span><br />
            Neither do we.
          </div>
          <div className="mt-8 font-[Bebas_Neue] text-[clamp(40px,6vw,80px)] leading-[1] tracking-[6px] text-[#030303]">
            Be Wild.<br />Conquer<br />the Future.
          </div>
        </section>
      </div>
    );
  }

  // Logged in — show feed directly
  return (
    <div>
      {/* Quick post bar */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-[Bebas_Neue] text-3xl tracking-[3px] text-[#ede8df]">
            Feed
          </h1>
          <p className="mt-1 text-[11px] tracking-[2px] text-[#5a5550]">
            DIGITAL NATION COMMUNITY
          </p>
        </div>
        <Link href="/posts/new" className="btn-blood !py-2 !px-5 !text-[10px]">
          New Post
        </Link>
      </div>

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
          <Link href="/posts/new" className="btn-blood mt-6 inline-block">
            Create a Post
          </Link>
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
    </div>
  );
}
