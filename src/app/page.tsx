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

interface Story {
  _id: string;
  title: string;
  content: string;
  image: string;
  date: string;
  category: string;
}

/* ─── Hero Section ─── */
function HeroSection() {
  return (
    <section className="relative -mx-6 md:-mx-10 mb-12 overflow-hidden">
      {/* Animated radial glow background */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: '35%',
          left: '50%',
          width: '800px',
          height: '800px',
          background: 'radial-gradient(ellipse, rgba(255,106,0,0.15) 0%, rgba(0,240,255,0.12) 40%, transparent 70%)',
          transform: 'translate(-50%, -50%)',
          animation: 'heroGlow 8s ease-in-out infinite',
        }}
      />

      <div className="relative flex min-h-[65vh] flex-col items-center justify-center px-6 py-20 text-center md:px-10 md:py-28">
        <div className="mx-auto max-w-3xl">
          {/* System init tag */}
          <div
            className="animate-fade-up-delay-1 font-[Share_Tech_Mono] text-[10px] tracking-[5px] uppercase text-[#3a3e52]"
          >
            // brand_system.init
          </div>

          {/* Refined tag */}
          <div
            className="animate-fade-up-delay-2 mt-2 font-[Share_Tech_Mono] text-[12px] tracking-[6px] uppercase text-[#FF6A00]"
            style={{ textShadow: '0 0 12px rgba(255,106,0,0.15)' }}
          >
            CONQUER THE NEXT.
          </div>

          {/* ANTAQOR glitch title */}
          <h1
            className="animate-fade-up-delay-3 mt-5 font-[Orbitron] font-black tracking-[5px] leading-[1.05] text-[clamp(36px,8vw,76px)] glitch-text"
            data-text="ANTAQOR"
            style={{ color: '#FF6A00', textShadow: '0 0 25px rgba(255,106,0,0.15), 0 0 50px rgba(255,106,0,0.1)' }}
          >
            ANTAQOR
          </h1>

          {/* Subtitle */}
          <p className="mx-auto mt-5 max-w-xl text-[16px] font-normal text-[#7a7e94] opacity-0 animate-fade-up" style={{ animationDelay: '0.5s', animationFillMode: 'forwards' }}>
            <strong className="text-[#dce0ec]">Entrepreneur. Conqueror.</strong><br />
            Ирээдүйг хүлээхгүй — бүтээнэ. Системийг сурч, эвдэж, дахин барина.
            Цаг хугацаа бол зэвсэг. Дасан зохицол бол хүч. Байлдан дагуулалт бол зорилго.
          </p>

          {/* Version badge */}
          <div
            className="mx-auto mt-6 inline-block border border-[#171926] px-4 py-1.5 font-[Share_Tech_Mono] text-[10px] tracking-[3px] text-[#3a3e52] opacity-0 animate-fade-up"
            style={{ animationDelay: '0.65s', animationFillMode: 'forwards' }}
          >
            DIGITAL NATION — MONGOL ORIGIN
          </div>

          {/* CTA buttons */}
          <div className="mt-8 flex items-center justify-center gap-4 opacity-0 animate-fade-up" style={{ animationDelay: '0.8s', animationFillMode: 'forwards' }}>
            <Link href="/clan" className="btn-neon !px-8">
              Нэгдэх
            </Link>
            <Link href="/classroom" className="btn-ghost !px-8">
              Сурах
            </Link>
          </div>
        </div>
      </div>

      {/* Bottom neon line */}
      <div className="h-[1px] bg-gradient-to-r from-transparent via-[#FF6A00] to-transparent opacity-35" />
    </section>
  );
}

/* ─── Hero Image (admin-managed) ─── */
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
      <div className="-mx-6 md:-mx-10 mb-6 aspect-[3/4] max-h-[80vh] bg-[#0A0B12] flex items-center justify-center">
        <div className="h-3 w-3 animate-pulse bg-[#FF6A00]" />
      </div>
    );
  }

  if (!heroUrl) {
    if (!isAdmin) return null;
    return (
      <div className="-mx-6 md:-mx-10 mb-6">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="w-full aspect-[3/4] max-h-[80vh] border border-dashed border-[#1a1a2e] bg-[#0A0B12] flex flex-col items-center justify-center gap-3 transition hover:border-[#FF6A00] group cursor-pointer"
        >
          {uploading ? (
            <div className="h-4 w-4 animate-spin border-2 border-[#FF6A00] border-t-transparent" />
          ) : (
            <>
              <svg className="h-8 w-8 text-[#2a2825] group-hover:text-[#FF6A00] transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      <div className="w-full aspect-[3/4] max-h-[80vh] overflow-hidden bg-[#0A0B12]">
        <img src={heroUrl} alt="Hero" className="h-full w-full object-cover" />
      </div>
      {isAdmin && (
        <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex h-8 items-center gap-1.5 bg-[rgba(5,5,10,0.85)] border border-[#1a1a2e] px-3 text-[9px] uppercase tracking-[1px] text-[#c8c8c0] hover:text-[#ede8df] hover:border-[rgba(240,236,227,0.2)] transition"
          >
            {uploading ? (
              <div className="h-3 w-3 animate-spin border border-[#FF6A00] border-t-transparent" />
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
            className="flex h-8 items-center gap-1.5 bg-[rgba(5,5,10,0.85)] border border-[#1a1a2e] px-3 text-[9px] uppercase tracking-[1px] text-[#5a5550] hover:text-[#FF6A00] hover:border-[rgba(255,106,0,0.3)] transition"
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

/* ─── Story Timeline ─── */
function StoryTimeline() {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stories")
      .then((r) => r.json())
      .then((d) => setStories(d.stories || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (stories.length === 0) return null;

  return (
    <section className="mb-16">
      <div className="section-label">STORY TIMELINE</div>
      <div className="relative pl-2">
        <div className="timeline-line" />
        <div className="space-y-8">
          {stories.map((story) => (
            <div key={story._id} className="relative">
              <div className="timeline-dot" style={{ top: '24px' }} />
              <div className="timeline-card">
                <div className="flex items-center gap-3 mb-2">
                  <span className="font-[Share_Tech_Mono] text-[11px] text-[#FF6A00]">
                    {story.date ? new Date(story.date).toLocaleDateString("mn-MN", { year: "numeric", month: "short", day: "numeric" }) : "—"}
                  </span>
                  {story.category && (
                    <span className="text-[8px] uppercase tracking-[2px] px-2 py-0.5 border border-[rgba(0,240,255,0.2)] text-[#00F0FF] bg-[rgba(0,240,255,0.05)]">
                      {story.category}
                    </span>
                  )}
                </div>
                <h3 className="font-[Orbitron] text-base font-bold tracking-[1px] text-[#ede8df]">
                  {story.title}
                </h3>
                <p className="mt-2 text-[13px] leading-relaxed text-[rgba(240,236,227,0.5)] line-clamp-4">
                  {story.content}
                </p>
                {story.image && (
                  <img
                    src={story.image}
                    alt={story.title}
                    className="mt-3 w-full max-h-48 object-cover border border-[#1a1a2e]"
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Gallery ─── */
function Gallery() {
  const [images, setImages] = useState<{ url: string; title: string }[]>([]);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    // Collect images from stories
    fetch("/api/stories")
      .then((r) => r.json())
      .then((d) => {
        const imgs = (d.stories || [])
          .filter((s: Story) => s.image)
          .map((s: Story) => ({ url: s.image, title: s.title }));
        setImages(imgs);
      })
      .catch(() => {});
  }, []);

  if (images.length === 0) return null;

  return (
    <section className="mb-16">
      <div className="section-label">GALLERY</div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {images.map((img, i) => (
          <button
            key={i}
            onClick={() => setLightbox(img.url)}
            className="group relative aspect-square overflow-hidden border border-[#1a1a2e] bg-[#0A0B12] transition hover:border-[#FF6A00] hover:shadow-[0_0_15px_rgba(255,106,0,0.15)]"
          >
            <img
              src={img.url}
              alt={img.title}
              className="h-full w-full object-cover transition group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[rgba(5,5,10,0.8)] to-transparent opacity-0 group-hover:opacity-100 transition flex items-end p-3">
              <span className="text-[10px] uppercase tracking-[1px] text-[#ede8df]">{img.title}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-[rgba(5,5,10,0.95)] p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-6 right-6 text-[#5a5550] hover:text-[#FF6A00] transition"
            onClick={() => setLightbox(null)}
          >
            <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={lightbox}
            alt=""
            className="max-h-[85vh] max-w-full object-contain border border-[#1a1a2e]"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </section>
  );
}

/* ─── Main Page ─── */
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
        <div className="h-3 w-3 animate-pulse bg-[#FF6A00]" />
      </div>
    );
  }

  return (
    <div>
      {/* Hero Section */}
      <HeroSection />

      {/* Hero Image - admin managed */}
      <HeroImage isAdmin={isAdmin} />

      {/* Story Timeline */}
      <StoryTimeline />

      {/* Gallery */}
      <Gallery />

      {/* Feed header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-[Orbitron] text-2xl font-bold tracking-[2px] text-[#ede8df]">
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
                    ? "bg-[rgba(255,106,0,0.1)] text-[#FF6A00]"
                    : "text-[#5a5550] hover:text-[#c8c8c0]"
                }`}
              >
                Бүгд
              </button>
              <button
                onClick={() => setFilter("free")}
                className={`px-3 py-1.5 text-[9px] uppercase tracking-[2px] transition ${
                  filter === "free"
                    ? "bg-[rgba(0,240,255,0.1)] text-[#00F0FF]"
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
              <Link href="/auth/signup" className="btn-neon !py-2 !px-4 !text-[11px]">
                Бүртгүүлэх
              </Link>
            </div>
          )}
          {isLoggedIn && !isMember && (
            <Link href="/clan" className="btn-neon !py-2 !px-5 !text-[11px]">
              Кланд нэгдэх
            </Link>
          )}
          {isMember && (
            <Link href="/posts/new" className="btn-neon !py-2 !px-5 !text-[11px]">
              Шинэ пост
            </Link>
          )}
        </div>
      </div>

      {/* Posts feed */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-3 w-3 animate-pulse bg-[#FF6A00]" />
        </div>
      ) : posts.length === 0 ? (
        <div className="py-16 text-center">
          <p className="font-[Orbitron] text-xl font-bold tracking-[1px] text-[rgba(240,236,227,0.3)]">
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
              <Link href="/posts/new" className="btn-neon mt-6 inline-block">
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
