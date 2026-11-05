"use client";

/* ─── Community feed — гурван баганат хэсэг ───────────────────────────────
   Зүүн: profile/streak/7 хоног. Гол: composer + ангиллын таб + постын урсгал.
   Баруун: өнөөдрийн mission, мэдээ, лидерборд.

   Энэ нь ХУУДАС биш, ХЭСЭГ. Нүүр `/` болон `/feed` хоёулаа үүнийг дууддаг.

   ЧУХАЛ — энд ямар ч router.replace БАЙХГҮЙ. Өмнө нь feed хуудас өөрөө
   зочныг `/` рүү буцаадаг байсан; нүүр өөрөө feed болсон учир тэр нь
   төгсгөлгүй давталт үүсгэх байлаа. Хэн юу харахыг дуудаж буй хуудас
   шийднэ (`src/app/page.tsx`), хэсэг нь зөвхөн үзүүлнэ.

   2026-08-26 — ТӨЛБӨРТ ШИЛЖИВ. Өмнө нь энд "ГИШҮҮН / ҮНЭГҮЙ" гэсэн хоёр
   урсгал байсныг УСТГАВ: үнэгүй тал байхгүй болсон тул сонгох зүйл ч
   алга. Гишүүн БҮХ постыг нэг урсгалаас харна.

   Энэ хэсэг өөрөө эрх шалгах ЁСТОЙ. Нүүр `/` нь SiteGate-ийн нээлттэй
   жагсаалтад байгаа (зочны элсүүлэх гадаргуу) тул төлбөргүй нэвтэрсэн хүн
   энд ХҮРЧ ирнэ — түүнийг зогсоох цорын ганц газар нь энэ. */

import { useEffect, useRef, useState } from "react";
import BrandFeed from "@/components/BrandFeed";
import ProgramWeek from "@/components/ProgramWeek";
import CreditNudge from "@/components/CreditNudge";
import { useSession } from "next-auth/react";
import PostCard from "@/components/PostCard";
import PageShell from "@/components/PageShell";
import { useMembership } from "@/lib/useMembership";
import { Paywall } from "@/components/SiteGate";

interface Post {
  _id: string;
  content: string;
  image?: string;
  visibility?: string;
  category?: string;
  likes: string[];
  reactions?: Record<string, string[]>;
  commentsCount: number;
  viewsCount?: number;
  createdAt: string;
  author: {
    _id: string;
    name: string;
    avatar?: string;
  } | null;
}

interface FeedCategory {
  slug: string;
  name: string;
  color: string;
  iconPath: string;
}

// "all" | any DB category slug — tabs are DB-driven.
type CategoryFilter = string;


export default function FeedSection() {
  const { data: session } = useSession();
  const { loading: memberLoading, isLoggedIn, hasAccess } = useMembership();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [feedCats, setFeedCats] = useState<FeedCategory[]>([]);

  // Category tabs come from the same admin-ordered source as the composer.
  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.categories)) setFeedCats(d.categories);
      })
      .catch(() => {});
  }, []);

  /* Табыг хурдан сольход хуучин хүсэлт сүүлд нь ирээд шинийг нь дарж
     бичих эрсдэлтэй — хэрэглэгч "Промт" дарсан атал "Ялалт"-ын постууд
     үлдэнэ. Хүсэлт бүрд дугаар өгч, хамгийн сүүлийнх нь л бичнэ. */
  const reqSeq = useRef(0);

  const fetchPosts = async (pageNum: number, cat?: CategoryFilter) => {
    const activeCat = cat ?? category;
    const myReq = ++reqSeq.current;
    try {
      const params = new URLSearchParams({ page: String(pageNum), limit: "20" });
      if (activeCat !== "all") params.set("category", activeCat);
      /* `visibility` БИЧИХГҮЙ. Сервер эрхтэй үзэгчид бүх постыг, эрхгүйд
         юуг ч буцаахгүй. Клиент "аль ертөнц" гэж сонгодог байсан нь
         үнэгүй тал байхад л утгатай байсан. */
      const res = await fetch(`/api/posts?${params}`);
      const data = await res.json();
      if (res.ok && myReq === reqSeq.current) {
        const safePosts = (data.posts || []).filter((p: Post) => p.author !== null);
        setPosts((prev) => (pageNum === 1 ? safePosts : [...prev, ...safePosts]));
        // Seen тоолуур — session-д пост тус бүрийг нэг л удаа тоолуулна.
        try {
          const seen = new Set<string>(JSON.parse(sessionStorage.getItem("seenPosts") || "[]"));
          const fresh = safePosts.map((p: Post) => p._id).filter((id: string) => !seen.has(id));
          if (fresh.length > 0) {
            fresh.forEach((id: string) => seen.add(id));
            // Хязгаарлахгүй бол урт сессэд sessionStorage тасралтгүй хавдана.
            const capped = Array.from(seen).slice(-500);
            sessionStorage.setItem("seenPosts", JSON.stringify(capped));
            void fetch("/api/posts/seen", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ids: fresh }),
            });
          }
        } catch {
          /* sessionStorage байхгүй орчинд алгасна */
        }
        setHasMore(pageNum < data.pagination.pages);
      }
    } finally {
      if (myReq === reqSeq.current) setLoading(false);
    }
  };

  useEffect(() => {
    if (memberLoading) return;
    /* Зочин ч урсгалыг УНШИНА. Нүүр нь одоо урсгал өөрөө болсон тул
       нэвтрээгүй хүнд хоосон дэлгэц үзүүлэх нь тэр хуудсыг утгагүй
       болгоно; API ч постыг зочинд нээлттэй буцаадаг. Бичих эрх нь
       өөр асуудал — доорх composer зөвхөн нэвтэрсэн хүнд харагдана. */
    setPage(1);
    setLoading(true);
    fetchPosts(1, category);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberLoading, isLoggedIn, category]);

  const switchCategory = (cat: CategoryFilter) => {
    setCategory(cat);
    setPosts([]);
    setPage(1);
    setHasMore(true);
    setLoading(true);
  };

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchPosts(next);
  };

  const handleDelete = (id: string) => {
    setPosts((prev) => prev.filter((p) => p._id !== id));
  };

  /* ─── Эхний ачаалалт — ПОСТЫН хэлбэртэй скелетон ────────────────
     Өмнө нь дэлгэцийн голд 2×2 пиксэлийн цэг анивчдаг байв. Тэр нь
     "ямар нэг зүйл болж байна" гэж хэлдэг ч ЮУ ирэхийг хэлдэггүй —
     ирэхэд нь зохиомж бүхэлдээ солигдож, хуудас үсэрдэг. Скелетон нь
     ирэх зүйлийнхээ хэлбэрийг урьдчилж эзэлбэл тэр үсрэлт алга болно.
     /classroom, /prompts хоёртой нэг гэр бүлийн хөдөлгөөн. */
  if (memberLoading) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 pt-6" aria-busy="true">
        <div className="mb-5 flex gap-2">
          {[64, 78, 70, 86].map((w, i) => (
            <div key={i} className="h-8 rounded-[4px] skeleton-brand" style={{ width: w }} />
          ))}
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} className="mb-4 overflow-hidden rounded-[4px]" style={{ background: "var(--chrome-bg,#F8F9FD)" }}>
            <div className="flex items-center gap-3 p-4">
              <div className="h-10 w-10 shrink-0 rounded-full skeleton-brand" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-3.5 w-1/3 rounded-[3px] skeleton-brand" />
                <div className="h-3 w-1/5 rounded-[3px] skeleton-brand" />
              </div>
            </div>
            <div className="aspect-video w-full skeleton-brand" />
          </div>
        ))}
      </div>
    );
  }

  /* Ангиллууд нь бүгд админаас удирддаг: мэдээлэл · ялалт · промт · бүтээл.
     "Reels" таб энд байсан — өөр платформын хэлбэрийг хуулсан, эдгээрийн
     аль нь ч биш. AI-аар юу бүтээснээ хуваалцах орон зайд шаардлагагүй. */
  const tabs: { key: CategoryFilter; label: string; iconPath?: string }[] = [
    { key: "all", label: "Бүгд" },
    ...feedCats.map((c) => ({
      key: c.slug,
      label: c.name.charAt(0).toUpperCase() + c.name.slice(1),
      iconPath: c.iconPath,
    })),
  ];

  const meName = session?.user?.name || "Гишүүн";
  const meAvatar = session?.user?.image;

  /* Эрх нь тодроогүй байхад ЮУ Ч шийдэхгүй — контент ч, хана ч биш.
     Хоёулаа буруу: нэг нь төлбөргүй хүнд урсгал үзүүлнэ, нөгөө нь төлсөн
     хүнд төлбөрийн ханыг анивчуулна. */
  if (memberLoading) return null;  // дээр аль хэдийн барьсан
  /* 2026-10-04: FEED НЭЭЛТТЭЙ БОЛЛОО. Өмнө нь бүртгүүлсэн ч төлбөр
     төлөөгүй хүн нэвтрэхэд feed биш, төлбөрийн хана угтдаг байв — өөрөөр
     хэлбэл шинэ хүн юу байгааг хараагүй байж шийдэх шаардлагатай болдог.
     Одоо нэвтэрсэн хүн бүр урсгалыг хардаг; төлбөрт хаалт нь курс,
     AI хэрэгсэл, кредит дээр хэвээр (`SiteGate` бусад замыг барина).

     `hasAccess` нь ХЭРЭГТЭЙ хэвээр — доор төлбөргүй хүнд зөөлөн
     урилга харуулахад ашиглана. */
  if (!isLoggedIn) return <Paywall loggedIn={false} />;

  return (
    <PageShell>
      {/* ─── Урсгал бол Antaqor-ийн үндсэн бүтээгдэхүүн ────────────────────
          Тиймээс дэлгэц дээрх хамгийн хүчтэй зүйл нь ПОСТ байх ёстой.

          Өмнө нь бичих мөр ба ангиллын табууд нь `gap-px` үсэн зураасаар
          холбогдсон НЭГ хайрцаг байсан бөгөөд тэр хайрцаг дотор долоон
          тэгш өнцөгт зэрэгцэн зогсдог байв. Үр дүнд нь урсгалын дээд
          талын 120px нь удирдлагын самбар шиг харагдаж, доор нь ирэх
          постууд түүнтэй ижил жинтэй болно.

          Одоо: бичих мөр нь зүгээр л мөр (хайрцаггүй), ангиллууд нь
          хөвөгч бөмбөлгүүд (хүснэгт биш), тэдний хооронд ЗАЙ. Шатлалыг
          хүрээ биш зай үүсгэнэ. */}
      <main className="flex min-w-0 flex-col gap-[var(--sp-5)]">
        {/* ─── ПОСТЕР HERO ────────────────────────────────────────────
            Нүүртэй ИЖИЛ бүрэлдэхүүн (`HeroSlider`) — хоёр газар хоёр
            хувилбар байхаас сэргийлж нэгийг нь хуваалцав. Админ
            /admin/hero дээр нэг л удаа засахад хоёулаа шинэчлэгдэнэ.

            `showStats={false}`: "ӨНӨӨДРИЙН СУУДАЛ / ӨНӨӨДӨР НЭГДСЭН"
            нь ЗОЧНЫГ элсүүлэх тоо. Гишүүн аль хэдийн элссэн тул фийд
            дээр тэр нь мэдээлэл биш, дуу чимээ. */}
        {/* Netflix маягийн хичээлийн мөр — зочин, гишүүнд ИЖИЛ (2026-10-06). */}

        {/* ─── УРСГАЛ ─── 2026-10-11: reel-only дууссан. Текст, брэнд карт,
            зураг/карусель (харьцаатай), видео — нэг багана (BrandFeed).
            Бичих мөр нь BrandFeed дотор. */}
        {/* «Одоо онлайн» тоолуур 2026-10-23-нд хасагдав (эзний хүсэлт). */}
        {/* Нэгдсэн хөтөлбөрийн «Day N / 7» (2026-10-26) — дууссан/унтраасан үед өөрөө алга. */}
        {/* Кредит бага бол AI Studio-д цэнэглэх сануулга (2026-10-26) */}
        <CreditNudge className="mx-4 md:mx-0" />
        <div className="px-4 md:px-0"><ProgramWeek compact /></div>
        <BrandFeed meAvatar={meAvatar || undefined} meName={meName} />
      </main>
    </PageShell>
  );
}
