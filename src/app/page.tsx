"use client";

import { useEffect, useState } from "react";
import PostCard from "@/components/PostCard";
import ConquestCounter from "@/components/ConquestCounter";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMembership } from "@/lib/useMembership";

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
  } | null;
}

export default function Home() {
  const { loading: memberLoading, isMember, isAdmin, isLoggedIn } = useMembership();
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchPosts = async (pageNum: number) => {
    try {
      const res = await fetch(`/api/posts?page=${pageNum}&limit=20`);
      const data = await res.json();
      if (res.ok) {
        const safePosts = (data.posts || []).filter(
          (p: Post) => p.author !== null
        );
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
    if (isMember) {
      fetchPosts(1);
    } else {
      setLoading(false);
    }
  }, [memberLoading, isMember]);

  useEffect(() => {
    if (!memberLoading && isLoggedIn && !isMember) {
      router.replace("/clan");
    }
  }, [memberLoading, isLoggedIn, isMember, router]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchPosts(next);
  };

  const handleDelete = (id: string) => {
    setPosts((prev) => prev.filter((p) => p._id !== id));
  };

  if (memberLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-3 w-3 animate-pulse rounded-full bg-[#cc2200]" />
      </div>
    );
  }

  // Not logged in — show hero landing
  if (!isLoggedIn) {
    return (
      <div>
        <section className="relative overflow-hidden py-20 md:py-32">
          <div className="absolute right-[-200px] top-1/2 h-[500px] w-[500px] -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(204,34,0,0.10)_0%,transparent_70%)] pointer-events-none" />

          <div className="animate-fade-up-delay-1 mb-3 text-[11px] uppercase tracking-[1px] text-[#c8c8c0]">
            Нийгэмлэг · Дижитал Үндэстэн
          </div>
          <h1 className="animate-fade-up-delay-2 font-[Bebas_Neue] text-[clamp(56px,10vw,140px)] leading-[0.9] tracking-[-2px]">
            ANTA<span className="text-[#cc2200]">QOR</span>
          </h1>
          <div className="animate-fade-up-delay-2 mt-3 font-[Bebas_Neue] text-[clamp(20px,3vw,36px)] tracking-[4px] text-[rgba(240,236,227,0.25)]">
            <strong className="text-[#ede8df]">Be Wild.</strong> Conquer the Future.
          </div>
          <p className="animate-fade-up-delay-3 mt-6 max-w-lg text-[14px] leading-[1.9] text-[rgba(240,236,227,0.55)]">
            AI-г эзэмшиж, хэрэгслээ бүтээж, ирээдүйгээ тодорхойлдог бүтээгчдийн үндэстэн. Нийгэмлэгт нэгдээрэй — санаа хуваалцаж, холбогдож, хамтдаа бүтээцгээе.
          </p>
          <div className="animate-fade-up-delay-3 mt-8 flex flex-wrap gap-4">
            <Link href="/auth/signup" className="btn-blood">
              Кланд нэгдэх
            </Link>
            <Link href="/auth/signin" className="btn-ghost">
              Нэвтрэх
            </Link>
          </div>

          <ConquestCounter />
        </section>

        <section className="mt-8 border-t border-[rgba(240,236,227,0.06)] pt-16">
          <div className="section-label">Яагаад нэгдэх вэ</div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { num: "01", name: "ФУТУРИЗМ", desc: "Бусдын хараагүйг хар. AI-г ашиглахгүй — тодорхойл." },
              { num: "02", name: "ЦАГ ХУГАЦАА", desc: "Шийдвэр бүр үр ашгаар шүүгдэнэ. Илүү хурдан. Илүү хөнгөн." },
              { num: "03", name: "ДАСАН ЗОХИЦОЛ", desc: "Өөрчлөлтөд дасахгүй — урьдчил. Хөгжихөө хэзээ ч бүү зогсоо." },
              { num: "04", name: "МӨНХИЙН БАЙЛДАН ДАГУУЛАЛТ", desc: "Финиш шугам гэж байхгүй. Эрхэм зорилго мөнхийн." },
            ].map((v) => (
              <div key={v.num} className="card p-6">
                <div className="mb-4 text-[10px] tracking-[1px] text-[rgba(240,236,227,0.2)]">{v.num}</div>
                <div className={`mb-2 font-[Bebas_Neue] text-xl tracking-[1px] ${v.num === "04" ? "text-[#cc2200]" : "text-[#ede8df]"}`}>
                  {v.name}
                </div>
                <p className="text-[13px] leading-[1.8] text-[rgba(240,236,227,0.5)]">{v.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16 overflow-hidden bg-[#cc2200] p-8 md:p-16">
          <div className="font-[Bebas_Neue] text-[clamp(28px,4vw,56px)] leading-[1.3] tracking-[2px] text-[#030303]">
            <span className="text-[rgba(5,5,5,0.4)]">The future doesn&apos;t wait.</span><br />
            Neither do we.
          </div>
          <div className="mt-8 font-[Bebas_Neue] text-[clamp(40px,6vw,80px)] leading-[1] tracking-[4px] text-[#030303]">
            Be Wild.<br />Conquer<br />the Future.
          </div>
        </section>
      </div>
    );
  }

  // Logged in but not a member — redirect happens in useEffect above
  if (!isMember) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-3 w-3 animate-pulse rounded-full bg-[#cc2200]" />
      </div>
    );
  }

  // Logged in member/admin — show feed
  return (
    <div>
      <div className="mb-6 border border-[#1c1c1c] bg-[#0a0a0a] px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-[11px] uppercase tracking-[0.5px] text-[#5a5550]">
            Эрхэм зорилго · 10,000 AI Байлдан дагуулагч бэлтгэх
          </div>
          <ConquestCounter inline />
        </div>
        <ConquestCounterBar />
      </div>

      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-[Bebas_Neue] text-3xl tracking-[2px] text-[#ede8df]">
            Мэдээ
          </h1>
          <p className="mt-1 text-[11px] font-medium tracking-[0.5px] text-[#5a5550]">
            ДИЖИТАЛ ҮНДЭСТНИЙ НИЙГЭМЛЭГ
          </p>
        </div>
        <Link href="/posts/new" className="btn-blood !py-2 !px-5 !text-[11px]">
          Шинэ пост
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-3 w-3 animate-pulse rounded-full bg-[#cc2200]" />
        </div>
      ) : posts.length === 0 ? (
        <div className="py-16 text-center">
          <p className="font-[Bebas_Neue] text-2xl tracking-[1px] text-[rgba(240,236,227,0.3)]">
            Нийтлэл байхгүй байна
          </p>
          <p className="mt-2 text-[13px] text-[#5a5550]">
            Нийгэмлэгт хамгийн түрүүнд хуваалцаарай.
          </p>
          <Link href="/posts/new" className="btn-blood mt-6 inline-block">
            Пост үүсгэх
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
                Цааш үзэх
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ConquestCounterBar() {
  const [pct, setPct] = useState(0);
  const [count, setCount] = useState(0);
  const goal = 10000;

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/stats");
        const data = await res.json();
        if (res.ok) {
          const c = data.aiConquerors ?? data.paidMembers ?? 0;
          setCount(c);
          setPct(Math.min((c / goal) * 100, 100));
        }
      } catch {
        // silent
      }
    };
    load();
    const i = setInterval(load, 30000);
    return () => clearInterval(i);
  }, []);

  return (
    <div className="mt-3">
      <div className="relative h-[2px] w-full overflow-hidden bg-[#1c1c1c]">
        <div
          className="h-full bg-[#cc2200] transition-all duration-1000 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1.5 flex justify-between">
        <span className="text-[10px] tracking-[0.3px] text-[#5a5550]">
          {count.toLocaleString()} байлдагч
        </span>
        <span className="text-[10px] tracking-[0.3px] text-[#5a5550]">
          {goal.toLocaleString()} зорилго
        </span>
      </div>
    </div>
  );
}
