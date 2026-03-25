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

const SOCIALS = [
  {
    name: "Instagram",
    href: "https://www.instagram.com/antaqor",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
      </svg>
    ),
  },
  {
    name: "Facebook",
    href: "https://www.facebook.com/antaqor",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  },
  {
    name: "YouTube",
    href: "https://www.youtube.com/@antaqor",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
        <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    ),
  },
  {
    name: "Threads",
    href: "https://www.threads.net/@antaqor",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
        <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.028-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 013.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.308-.883-2.359-.89h-.029c-.803 0-1.539.214-2.185.636l-1.994-.653c.457-1.32 1.181-2.36 2.153-3.096C10.04 6.43 11.13 6 12.354 6h.062c1.732.012 3.107.558 4.087 1.622.957 1.043 1.461 2.555 1.497 4.495l.13.02c1.144.194 2.148.703 2.908 1.477 1.023 1.052 1.555 2.508 1.555 4.221 0 .166-.005.331-.015.494-.137 2.28-1.163 4.07-2.969 5.176C17.987 23.474 15.354 24 12.186 24z" />
      </svg>
    ),
  },
  {
    name: "TikTok",
    href: "https://www.tiktok.com/@antaqor",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0010.86 4.48v-7.15a8.16 8.16 0 005.58 2.17v-3.45c-1.13 0-2.55-.46-3.77-1.3a4.82 4.82 0 01-1.51-1.83h.02V6.69h5.26z" />
      </svg>
    ),
  },
];

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
          background: 'radial-gradient(ellipse, rgba(0,100,145,0.15) 0%, rgba(0,240,255,0.12) 40%, transparent 70%)',
          transform: 'translate(-50%, -50%)',
          animation: 'heroGlow 8s ease-in-out infinite',
        }}
      />

      <div className="relative flex min-h-[65vh] flex-col items-center justify-center px-6 py-20 text-center md:px-10 md:py-28">
        <div className="mx-auto max-w-3xl">
          {/* System init tag */}
          <div
            className="animate-fade-up-delay-1 text-[10px] tracking-[5px] uppercase text-[#3a3e52]"
          >
            // brand_system.init
          </div>

          {/* Refined tag */}
          <div
            className="animate-fade-up-delay-2 mt-2 text-[12px] tracking-[6px] uppercase text-[#006491]"
            style={{ textShadow: '0 0 12px rgba(0,100,145,0.15)' }}
          >
            CONQUER THE NEXT.
          </div>

          {/* ANTAQOR glitch title */}
          <h1
            className="animate-fade-up-delay-3 mt-5 font-black tracking-[5px] leading-[1.05] text-[clamp(36px,8vw,76px)] glitch-text"
            data-text="ANTAQOR"
            style={{ color: '#006491', textShadow: '0 0 25px rgba(0,100,145,0.15), 0 0 50px rgba(0,100,145,0.1)' }}
          >
            ANTAQOR
          </h1>

          {/* Subtitle */}
          <p className="mx-auto mt-5 max-w-xl text-[16px] font-normal text-[#7a7e94] opacity-0 animate-fade-up" style={{ animationDelay: '0.5s', animationFillMode: 'forwards' }}>
            <strong className="text-[#dce0ec]">Entrepreneur. Conqueror.</strong><br />
            Ирээдүйг хүлээхгүй — бүтээнэ. Системийг сурч, эвдэж, дахин барина.
            Цаг хугацаа бол зэвсэг. Дасан зохицол бол хүч. Байлдан дагуулалт бол зорилго.
          </p>

          {/* CTA buttons */}
          <div className="mt-8 flex items-center justify-center gap-4 opacity-0 animate-fade-up" style={{ animationDelay: '0.65s', animationFillMode: 'forwards' }}>
            <Link href="/clan" className="btn-neon !px-8">
              Нэгдэх
            </Link>
            <Link href="/classroom" className="btn-ghost !px-8">
              Сурах
            </Link>
          </div>
        </div>
      </div>

      {/* Social icons slider */}
      <div className="relative overflow-hidden border-t border-b border-[rgba(0,240,255,0.06)] bg-[rgba(5,5,10,0.5)] py-3 opacity-0 animate-fade-up" style={{ animationDelay: '0.9s', animationFillMode: 'forwards' }}>
        <div className="social-slider flex w-max gap-10 px-6">
          {[...SOCIALS, ...SOCIALS].map((s, i) => (
            <a
              key={`${s.name}-${i}`}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex shrink-0 items-center gap-2 text-[#5a5550] transition-colors hover:text-[#006491] group"
            >
              <span className="transition-colors group-hover:text-[#006491]">{s.icon}</span>
              <span className="text-[11px] tracking-[1px]">@antaqor</span>
              <span className="text-[9px] uppercase tracking-[2px] text-[#3a3e52] group-hover:text-[#5a5550] transition-colors">{s.name}</span>
            </a>
          ))}
        </div>
      </div>

      {/* Bottom neon line */}
      <div className="h-[1px] bg-gradient-to-r from-transparent via-[#006491] to-transparent opacity-35" />
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
        <div className="h-3 w-3 animate-pulse bg-[#006491]" />
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
          className="w-full aspect-[3/4] max-h-[80vh] border border-dashed border-[#1a1a2e] bg-[#0A0B12] flex flex-col items-center justify-center gap-3 transition hover:border-[#006491] group cursor-pointer"
        >
          {uploading ? (
            <div className="h-4 w-4 animate-spin border-2 border-[#006491] border-t-transparent" />
          ) : (
            <>
              <svg className="h-8 w-8 text-[#2a2825] group-hover:text-[#006491] transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <div className="h-3 w-3 animate-spin border border-[#006491] border-t-transparent" />
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
            className="flex h-8 items-center gap-1.5 bg-[rgba(5,5,10,0.85)] border border-[#1a1a2e] px-3 text-[9px] uppercase tracking-[1px] text-[#5a5550] hover:text-[#006491] hover:border-[rgba(0,100,145,0.3)] transition"
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
            className="group relative aspect-square overflow-hidden border border-[#1a1a2e] bg-[#0A0B12] transition hover:border-[#006491] hover:shadow-[0_0_15px_rgba(0,100,145,0.15)]"
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
            className="absolute top-6 right-6 text-[#5a5550] hover:text-[#006491] transition"
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
        <div className="h-3 w-3 animate-pulse bg-[#006491]" />
      </div>
    );
  }

  return (
    <div>
      {/* Hero Section */}
      <HeroSection />

      {/* Hero Image - admin managed */}
      <HeroImage isAdmin={isAdmin} />

      {/* Gallery */}
      <Gallery />

      {/* Feed header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-[2px] text-[#ede8df]">
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
                    ? "bg-[rgba(0,100,145,0.1)] text-[#006491]"
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
          <div className="h-3 w-3 animate-pulse bg-[#006491]" />
        </div>
      ) : posts.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-xl font-bold tracking-[1px] text-[rgba(240,236,227,0.3)]">
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
