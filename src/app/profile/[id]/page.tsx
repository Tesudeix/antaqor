"use client";

import { useCallback, useEffect, useRef, useState, use } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PageShell from "@/components/PageShell";
import { PostRow, type FeedPost } from "@/components/BrandFeed";
import { useMembership } from "@/lib/useMembership";

/* ─── /profile/[id] — X маягийн профайл (2026-10-11, эзний загвараар) ─────
   Дээрээс доош: толгой мөр (буцах · нэр · пост тоо · хайх) → толгойн зураг
   (cover) → ДӨРВӨЛЖИН аватар cover дээр давхарлана → засах/дагах товч →
   нэр, @handle, намтар → байршил · вэб · нэгдсэн огноо → дагаж буй ·
   дагагч → (эзэнд, гишүүн биш бол) "баталгаажаагүй" самбар → табууд:
   Пост · Хариулт · Медиа · Таалагдсан.
   Repost систем байхгүй тул "Reposts" табын оронд "Таалагдсан".
   Эзний цэс (кредит, тэргүүлэгчид… гарах) нь ⋯ товчинд — загвар цэвэр
   үлдэнэ. Өнгө нь класс (өдөр/шөнө §11 хувиргана), булан 4px. */

interface Profile {
  _id: string;
  name: string;
  username?: string;
  email?: string;
  phone?: string;
  avatar?: string;
  bio?: string;
  location?: string;
  website?: string;
  coverImage?: string;
  instagram?: string;
  facebook?: string;
  threads?: string;
  subscriptionExpiresAt?: string;
  createdAt: string;
  followersCount?: number;
  followingCount?: number;
  postsCount?: number;
  isFollowing?: boolean;
}
interface Reply {
  _id: string;
  content: string;
  createdAt: string;
  post: { _id: string; excerpt: string; author: string };
}

const TABS = [
  { id: "posts", label: "Пост" },
  { id: "replies", label: "Хариулт" },
  { id: "media", label: "Медиа" },
  { id: "likes", label: "Таалагдсан" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const LINE = "border-[color:var(--t-line,rgba(255,255,255,0.12))]";
/* Товчны хүрээ inline: глобал `button` reset нь `border` utility-г 0 болгодог. */
const OUTLINE: React.CSSProperties = { border: "1px solid var(--l-line-strong, rgba(255,255,255,0.22))" };

function joined(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()} оны ${d.getMonth() + 1}-р сараас`;
}
function short(iso: string) {
  const d = new Date(iso);
  const same = d.getFullYear() === new Date().getFullYear();
  return `${same ? "" : d.getFullYear() + "."}${d.getMonth() + 1}-р сарын ${d.getDate()}`;
}

function Svg({ d, size = 18 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}
const I = {
  back: "M19 12H5M11 18l-6-6 6-6",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  pin: "M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 7.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4z",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  cal: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  check: "M5 12.5l4.5 4.5L19 7.5",
  close: "M6 6l12 12M18 6L6 18",
  mail: "M3 6h18v12H3zM3 7l9 6 9-6",
  camera: "M4 8h3l2-3h6l2 3h3v11H4zM12 11a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
};

async function uploadImage(file: File): Promise<string> {
  if (file.size > 8 * 1024 * 1024) throw new Error("Зураг 8MB-аас бага байх ёстой");
  const fd = new FormData();
  fd.append("file", file);
  const r = await fetch("/api/upload", { method: "POST", body: fd });
  const d = await r.json();
  if (!r.ok || !d.url) throw new Error(d.error || "Оруулж чадсангүй");
  return d.url as string;
}

export default function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session, update: updateSession } = useSession();
  const router = useRouter();
  const me = (session?.user as { id?: string } | undefined)?.id ?? null;
  const isOwner = !!me && me === id;

  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("posts");
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [likes, setLikes] = useState<FeedPost[] | null>(null);
  const [replies, setReplies] = useState<Reply[] | null>(null);
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [hideVerify, setHideVerify] = useState(true);

  useEffect(() => {
    try { setHideVerify(localStorage.getItem("antaqor-verify-dismissed") === "1"); } catch { setHideVerify(false); }
  }, []);

  const loadUser = useCallback(async () => {
    const r = await fetch(`/api/users/${id}`);
    const d = await r.json().catch(() => ({}));
    setUser(r.ok ? d.user : null);
  }, [id]);

  useEffect(() => {
    setLoading(true);
    setPosts(null); setLikes(null); setReplies(null); setTab("posts");
    Promise.all([
      loadUser(),
      fetch(`/api/posts?author=${id}&limit=50`).then((r) => r.json()).then((d) => setPosts(d.posts || [])).catch(() => setPosts([])),
    ]).finally(() => setLoading(false));
  }, [id, loadUser]);

  useEffect(() => {
    if (tab === "likes" && likes === null) {
      fetch(`/api/posts?likedBy=${id}&limit=30`).then((r) => r.json()).then((d) => setLikes(d.posts || [])).catch(() => setLikes([]));
    }
    if (tab === "replies" && replies === null) {
      fetch(`/api/users/${id}/replies`).then((r) => r.json()).then((d) => setReplies(d.replies || [])).catch(() => setReplies([]));
    }
  }, [tab, id, likes, replies]);

  const toggleFollow = async () => {
    if (!me) { router.push("/?login=1"); return; }
    if (!user || followBusy) return;
    setFollowBusy(true);
    const was = !!user.isFollowing;
    setUser({ ...user, isFollowing: !was, followersCount: (user.followersCount || 0) + (was ? -1 : 1) });
    try {
      const r = await fetch(`/api/users/${id}/follow`, { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error();
      setUser((u) => (u ? { ...u, isFollowing: d.following, followersCount: d.followersCount } : u));
    } catch {
      setUser((u) => (u ? { ...u, isFollowing: was, followersCount: (u.followersCount || 0) + (was ? 1 : -1) } : u));
    } finally {
      setFollowBusy(false);
    }
  };

  if (loading) {
    return (
      <PageShell>
        <div className="flex justify-center py-16"><div className="h-2 w-2 animate-pulse rounded-[4px] bg-[#2E29FF]" /></div>
      </PageShell>
    );
  }
  if (!user) {
    return (
      <PageShell>
        <p className="py-16 text-center text-[16px] text-[#E2E4E8]">Хэрэглэгч олдсонгүй</p>
      </PageShell>
    );
  }

  const member = !!user.subscriptionExpiresAt && new Date(user.subscriptionExpiresAt) > new Date();
  const handle = user.username || "";
  const media = (posts || []).filter((p) => p.video || (p.images && p.images.length) || p.image);
  const socials = [
    { k: "Instagram", v: user.instagram, href: `https://instagram.com/${user.instagram}` },
    { k: "Facebook", v: user.facebook, href: `https://facebook.com/${user.facebook}` },
    { k: "Threads", v: user.threads, href: `https://threads.net/@${user.threads}` },
  ].filter((x) => x.v);

  return (
    <PageShell>
      <main className="w-full min-w-0">
        {/* ── Толгой мөр ── */}
        <div className={`flex items-center gap-4 border-b ${LINE} px-3 py-2`}>
          <button type="button" onClick={() => (history.length > 1 ? router.back() : router.push("/"))} aria-label="Буцах"
            className="press flex h-10 w-10 items-center justify-center rounded-[4px] text-[#F2F2F4] hover:bg-[rgba(255,255,255,0.06)]">
            <Svg d={I.back} size={20} />
          </button>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-[18px] font-extrabold text-[#F2F2F4]">{user.name}</div>
            <div className="text-[12.5px] text-[#9C9CA6]">{(user.postsCount ?? 0).toLocaleString()} пост</div>
          </div>
          <Link href="/explore" aria-label="Хайх" className="press flex h-10 w-10 items-center justify-center rounded-[4px] text-[#F2F2F4] hover:bg-[rgba(255,255,255,0.06)]">
            <Svg d={I.search} size={20} />
          </Link>
          {isOwner && (
            <button type="button" onClick={() => setMenuOpen(true)} aria-label="Цэс"
              className="press flex h-10 w-10 items-center justify-center rounded-[4px] text-[#F2F2F4] hover:bg-[rgba(255,255,255,0.06)]">
              <Svg d={I.more} size={22} />
            </button>
          )}
        </div>

        {/* ── Cover ── */}
        <div className={`relative aspect-[3/1] w-full overflow-hidden border-b ${LINE} bg-[#262626]`}>
          {user.coverImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.coverImage} alt="" className="h-full w-full object-cover" />
          )}
        </div>

        {/* ── Аватар + товч ── */}
        <div className="flex items-start justify-between px-4">
          <div
            className="relative z-[1] -mt-[13%] flex aspect-square w-[25%] min-w-[84px] max-w-[136px] items-center justify-center overflow-hidden rounded-[4px] bg-[#55555C]"
            style={{ border: "4px solid var(--l-canvas, #E3E6EE)" }}
          >
            {user.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatar} alt={user.name} className="h-full w-full object-cover" />
            ) : (
              <span className="text-[clamp(30px,8vw,48px)] font-extrabold" style={{ color: "#FFFFFF" }}>{user.name.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div className="mt-3 flex items-center gap-2">
            {isOwner ? (
              <button type="button" onClick={() => setEditing(true)} style={OUTLINE}
                className={`press h-9 rounded-[4px] px-4 text-[14px] font-bold text-[#F2F2F4] transition hover:bg-[rgba(255,255,255,0.06)]`}>
                Профайл засах
              </button>
            ) : (
              <>
                {/* Мессеж товч 2026-11-02-нд хасагдав — чат бүрэн устсан. */}
                <button type="button" onClick={toggleFollow} disabled={followBusy} style={user.isFollowing ? OUTLINE : undefined}
                  className={`press h-9 rounded-[4px] px-5 text-[14px] font-bold transition disabled:opacity-60 ${
                    user.isFollowing ? "text-[#F2F2F4]" : "bg-[#2E29FF] text-[#0A0A0A] hover:bg-[#1F1AD9]"
                  }`}>
                  {user.isFollowing ? "Дагаж байна" : "Дагах"}
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Нэр, намтар, мета ── */}
        <section className="px-4 pb-4 pt-3">
          <div className="flex items-center gap-1.5">
            <h1 className="text-[clamp(22px,5.5vw,26px)] font-extrabold leading-tight text-[#F2F2F4]">{user.name}</h1>
            {member && (
              <span title="Гишүүн" aria-label="Гишүүн" className="inline-flex text-[#2E29FF]">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
                  <path d="M12 1.5l2.6 1.9 3.2-.1 1 3 2.6 1.9-1 3.1 1 3.1-2.6 1.9-1 3-3.2-.1L12 22.5l-2.6-1.9-3.2.1-1-3-2.6-1.9 1-3.1-1-3.1 2.6-1.9 1-3 3.2.1z" />
                  <path d="M8 12.3l2.6 2.6L16.2 9.3" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            )}
          </div>
          {handle && <div className="text-[15px] text-[#9C9CA6]">@{handle}</div>}

          {user.bio && <p className="mt-3 whitespace-pre-line text-[15.5px] leading-[1.5] text-[#F2F2F4]">{user.bio}</p>}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[14.5px] text-[#9C9CA6]">
            {user.location && (
              <span className="inline-flex items-center gap-1.5"><Svg d={I.pin} size={17} />{user.location}</span>
            )}
            {user.website && (
              <a href={`https://${user.website}`} target="_blank" rel="noopener noreferrer nofollow"
                className="inline-flex items-center gap-1.5">
                <span className="text-[#FCEE0A]"><Svg d={I.link} size={17} /></span>
                <span className="text-[#FCEE0A] underline underline-offset-2">{user.website.replace(/\/$/, "")}</span>
              </a>
            )}
            <span className="inline-flex items-center gap-1.5"><Svg d={I.cal} size={17} />{joined(user.createdAt)} нэгдсэн</span>
            {socials.map((s) => (
              <a key={s.k} href={s.href} target="_blank" rel="noopener noreferrer nofollow" className="hover:text-[#2E29FF]">{s.k}</a>
            ))}
          </div>

          <div className="mt-3 flex gap-5 text-[14.5px]">
            <span><b className="font-extrabold text-[#F2F2F4]">{(user.followingCount ?? 0).toLocaleString()}</b> <span className="text-[#9C9CA6]">дагаж буй</span></span>
            <span><b className="font-extrabold text-[#F2F2F4]">{(user.followersCount ?? 0).toLocaleString()}</b> <span className="text-[#9C9CA6]">дагагч</span></span>
          </div>

          {isOwner && !member && !hideVerify && <VerifyBox onClose={() => {
            setHideVerify(true);
            try { localStorage.setItem("antaqor-verify-dismissed", "1"); } catch { /* storage алга */ }
          }} />}
        </section>

        {/* ── Табууд ── */}
        <div className={`grid grid-cols-4 border-y ${LINE}`} role="tablist">
          {TABS.map((t) => {
            const on = tab === t.id;
            return (
              <button key={t.id} type="button" role="tab" aria-selected={on} onClick={() => setTab(t.id)}
                className={`relative py-3.5 text-[14.5px] font-bold transition ${on ? "text-[#F2F2F4]" : "text-[#9C9CA6] hover:text-[#E2E4E8]"}`}>
                {t.label}
                {on && <span className="absolute inset-x-0 bottom-0 h-[3px] bg-[#FCEE0A]" />}
              </button>
            );
          })}
        </div>

        {tab === "posts" && (
          posts === null ? <Spinner /> : posts.length === 0 ? (
            <Empty text={me ? "Пост алга байна." : "Постууд гишүүдэд нээлттэй."} cta={isOwner ? { href: "/posts/new", label: "Пост нийтлэх" } : undefined} />
          ) : posts.map((p) => <PostRow key={p._id} p={p} uid={me} compact />)
        )}

        {tab === "replies" && (
          replies === null ? <Spinner /> : replies.length === 0 ? <Empty text="Хариулт алга байна." /> : replies.map((r) => (
            <Link key={r._id} href={`/posts/${r.post._id}`} className={`block border-b ${LINE} px-4 py-4 transition hover:bg-[rgba(255,255,255,0.03)]`}>
              <div className="text-[14px] text-[#9C9CA6]">{handle ? `@${handle}` : user.name} · {short(r.createdAt)}</div>
              {r.post.author && <div className="mt-0.5 text-[13.5px] text-[#9C9CA6]">↳ <span className="text-[#2E29FF]">@{r.post.author}</span>-д хариулав</div>}
              <p className="mt-1.5 whitespace-pre-line break-words text-[15.5px] leading-[1.5] text-[#F2F2F4]">{r.content}</p>
            </Link>
          ))
        )}

        {tab === "media" && (
          posts === null ? <Spinner /> : media.length === 0 ? <Empty text="Медиа алга байна." /> : (
            <div className="grid grid-cols-3 gap-[2px] p-[2px]">
              {media.map((p) => {
                const img = p.images?.[0] || p.image;
                return (
                  <Link key={p._id} href={`/posts/${p._id}`} className="relative block aspect-square overflow-hidden bg-black">
                    {p.video ? (
                      /* eslint-disable-next-line jsx-a11y/media-has-caption */
                      <video src={p.video} preload="metadata" muted playsInline
                        poster={/\/vid-[a-f0-9-]+\.mp4$/.test(p.video) ? p.video.replace(/\.mp4$/, "-poster.jpg") : undefined}
                        className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                    )}
                    {(p.images?.length || 0) > 1 && (
                      <span className="absolute right-1.5 top-1.5 rounded-[4px] px-1.5 text-[11px] font-bold" style={{ background: "rgba(0,0,0,0.6)", color: "#FFFFFF" }}>1/{p.images!.length}</span>
                    )}
                    {p.video && (
                      <span className="absolute bottom-1.5 left-1.5" style={{ color: "#FFFFFF", filter: "drop-shadow(0 1px 2px rgba(0,0,0,.7))" }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M7 4.5v15l12-7.5z" /></svg>
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          )
        )}

        {tab === "likes" && (
          likes === null ? <Spinner /> : likes.length === 0 ? <Empty text="Таалагдсан пост алга байна." /> : likes.map((p) => <PostRow key={p._id} p={p} uid={me} />)
        )}
      </main>

      {editing && (
        <EditSheet
          user={user}
          onClose={() => setEditing(false)}
          onSaved={(u) => { setUser((prev) => (prev ? { ...prev, ...u } : prev)); setEditing(false); updateSession(); }}
        />
      )}
      {menuOpen && <OwnerMenu onClose={() => setMenuOpen(false)} onEdit={() => { setMenuOpen(false); setEditing(true); }} />}
    </PageShell>
  );
}

function Spinner() {
  return <div className="flex justify-center py-10"><div className="h-2 w-2 animate-pulse rounded-[4px] bg-[#2E29FF]" /></div>;
}
function Empty({ text, cta }: { text: string; cta?: { href: string; label: string } }) {
  return (
    <div className="px-4 py-12 text-center">
      <p className="text-[15px] text-[#9C9CA6]">{text}</p>
      {cta && (
        <Link href={cta.href} className="press mt-4 inline-flex h-10 items-center rounded-[4px] bg-[#2E29FF] px-5 text-[14px] font-bold text-[#0A0A0A]">{cta.label}</Link>
      )}
    </div>
  );
}

/* "You aren't verified yet" — манайд баталгаажсан тэмдэг = гишүүнчлэл. */
function VerifyBox({ onClose }: { onClose: () => void }) {
  return (
    <div className="relative mt-5 rounded-[4px] border border-[rgba(252,238,10,0.45)] bg-[rgba(252,238,10,0.08)] p-5 pr-12">
      <button type="button" onClick={onClose} aria-label="Хаах" className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-[4px] text-[#F2F2F4]">
        <Svg d={I.close} size={18} />
      </button>
      <div className="flex items-center gap-2 text-[19px] font-extrabold text-[#F2F2F4]">
        Та баталгаажаагүй байна <Svg d={I.check} size={20} />
      </div>
      <p className="mt-2 text-[14.5px] leading-[1.5] text-[#E2E4E8]">
        Гишүүн болоход баталгаажсан тэмдэг, бүх хичээл, AI хэрэгсэл, гишүүдийн урсгал нээгдэнэ. Профайлаа одоо шинэчил.
      </p>
      <Link href="/pricing" className="press mt-4 inline-flex h-10 items-center rounded-[4px] bg-[#FCEE0A] px-4 text-[14.5px] font-extrabold text-[#0A0A0A] transition hover:opacity-90">
        Баталгаажих
      </Link>
    </div>
  );
}

function Sheet({ onClose, title, children }: { onClose: () => void; title: string; children: React.ReactNode }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Хаах" onClick={onClose} className="absolute inset-0" style={{ background: "rgba(0,0,0,0.55)" }} />
      <div className={`relative max-h-[92vh] w-full max-w-[560px] overflow-y-auto rounded-t-[4px] border ${LINE} bg-[#141414] sm:rounded-[4px]`}>
        <div className={`sticky top-0 z-10 flex items-center gap-3 border-b ${LINE} bg-[#141414] px-4 py-3`}>
          <button type="button" onClick={onClose} aria-label="Хаах" className="flex h-9 w-9 items-center justify-center rounded-[4px] text-[#F2F2F4]"><Svg d={I.close} size={18} /></button>
          <div className="flex-1 text-[17px] font-extrabold text-[#F2F2F4]">{title}</div>
        </div>
        {children}
      </div>
    </div>
  );
}

function EditSheet({ user, onClose, onSaved }: { user: Profile; onClose: () => void; onSaved: (u: Partial<Profile>) => void }) {
  const [f, setF] = useState({
    name: user.name || "", bio: user.bio || "", location: user.location || "", website: user.website || "",
    phone: user.phone || "", instagram: user.instagram || "", facebook: user.facebook || "", threads: user.threads || "",
    avatar: user.avatar || "", coverImage: user.coverImage || "",
  });
  const [busy, setBusy] = useState<"" | "avatar" | "cover" | "save">("");
  const [err, setErr] = useState("");
  const avatarRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  const pick = async (kind: "avatar" | "cover", file?: File | null) => {
    if (!file) return;
    setErr(""); setBusy(kind);
    try {
      const url = await uploadImage(file);
      setF((x) => ({ ...x, [kind === "avatar" ? "avatar" : "coverImage"]: url }));
    } catch (e) { setErr(e instanceof Error ? e.message : "Алдаа"); }
    finally { setBusy(""); }
  };

  const save = async () => {
    setErr(""); setBusy("save");
    try {
      const r = await fetch(`/api/users/${user._id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Хадгалж чадсангүй");
      onSaved(d.user);
    } catch (e) { setErr(e instanceof Error ? e.message : "Алдаа"); }
    finally { setBusy(""); }
  };

  const input = `h-11 w-full rounded-[4px] border ${LINE} bg-transparent px-3 text-[15px] text-[#F2F2F4] outline-none placeholder:text-[#9C9CA6] focus:border-[#2E29FF]`;
  const label = "mb-1 block text-[12.5px] font-bold text-[#9C9CA6]";

  return (
    <Sheet onClose={onClose} title="Профайл засах">
      <div className="relative">
        <button type="button" onClick={() => coverRef.current?.click()} className="relative block aspect-[3/1] w-full overflow-hidden bg-[#262626]" aria-label="Толгойн зураг солих">
          {f.coverImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={f.coverImage} alt="" className="h-full w-full object-cover" />
          )}
          <span className="absolute inset-0 flex items-center justify-center" style={{ color: "#FFFFFF", background: "rgba(0,0,0,0.35)" }}>
            {busy === "cover" ? "…" : <Svg d={I.camera} size={24} />}
          </span>
        </button>
        <button type="button" onClick={() => avatarRef.current?.click()} aria-label="Профайл зураг солих"
          className="absolute -bottom-10 left-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-[4px] bg-[#55555C]"
          style={{ border: "4px solid var(--t-surface, #E3E6EE)" }}>
          {f.avatar && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={f.avatar} alt="" className="absolute inset-0 h-full w-full object-cover" />
          )}
          <span className="relative flex h-full w-full items-center justify-center" style={{ color: "#FFFFFF", background: "rgba(0,0,0,0.35)" }}>
            {busy === "avatar" ? "…" : <Svg d={I.camera} size={20} />}
          </span>
        </button>
        <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={(e) => pick("cover", e.target.files?.[0])} />
        <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={(e) => pick("avatar", e.target.files?.[0])} />
      </div>
      <div className="space-y-3.5 px-4 pb-5 pt-14">
        <div><label className={label}>Нэр</label><input className={input} value={f.name} onChange={set("name")} maxLength={50} /></div>
        <div><label className={label}>Намтар</label>
          <textarea className={`${input} h-auto resize-none py-2.5 leading-[1.5]`} rows={3} value={f.bio} onChange={set("bio")} maxLength={300} placeholder="AI Entrepreneur…" />
        </div>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <div><label className={label}>Байршил</label><input className={input} value={f.location} onChange={set("location")} maxLength={60} placeholder="Улаанбаатар" /></div>
          <div><label className={label}>Вэб сайт</label><input className={input} value={f.website} onChange={set("website")} maxLength={120} placeholder="antaqor.com" /></div>
        </div>
        <div><label className={label}>Утас (зөвхөн танд харагдана)</label><input className={input} value={f.phone} onChange={set("phone")} /></div>
        <div className="grid gap-3.5 sm:grid-cols-3">
          <div><label className={label}>Instagram</label><input className={input} value={f.instagram} onChange={set("instagram")} /></div>
          <div><label className={label}>Facebook</label><input className={input} value={f.facebook} onChange={set("facebook")} /></div>
          <div><label className={label}>Threads</label><input className={input} value={f.threads} onChange={set("threads")} /></div>
        </div>
        {err && <p className="text-[14px] font-semibold text-[#FCEE0A]">{err}</p>}
        <button type="button" onClick={save} disabled={!!busy || !f.name.trim()}
          className="press h-11 w-full rounded-[4px] bg-[#2E29FF] text-[15px] font-extrabold text-[#0A0A0A] transition hover:bg-[#1F1AD9] disabled:opacity-50">
          {busy === "save" ? "Хадгалж байна…" : "Хадгалах"}
        </button>
      </div>
    </Sheet>
  );
}

function OwnerMenu({ onClose, onEdit }: { onClose: () => void; onEdit: () => void }) {
  const { isMember, isAdmin, expiresAt } = useMembership();
  const links = [
    { href: "/pricing", label: isMember ? `Гишүүнчлэл · ${expiresAt ? new Date(expiresAt).toISOString().slice(0, 10).replace(/-/g, ".") + " хүртэл" : "идэвхтэй"}` : "Гишүүн болох" },
    { href: "/credits", label: "Кредит · түүх" },
    { href: "/leaderboard", label: "Тэргүүлэгчид" },
    { href: "/classroom", label: "Сургалт" },
    { href: "/content-agent?v=image", label: "AI зураг" },
  ].filter((l) => !(isAdmin && l.href === "/pricing"));
  const row = `flex min-h-12 w-full items-center border-b ${LINE} px-4 text-left text-[15px] font-semibold text-[#F2F2F4] transition hover:bg-[rgba(255,255,255,0.04)]`;
  return (
    <Sheet onClose={onClose} title="Цэс">
      <button type="button" onClick={onEdit} className={row}>Профайл засах</button>
      {links.map((l) => <Link key={l.href} href={l.href} onClick={onClose} className={row}>{l.label}</Link>)}
      <button type="button" onClick={() => signOut({ callbackUrl: `${window.location.origin}/` })} className={`${row} text-[#FCEE0A]`}>Гарах</button>
    </Sheet>
  );
}
