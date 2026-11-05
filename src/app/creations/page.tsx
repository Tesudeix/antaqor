"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import PageShell from "@/components/PageShell";

/* ─── Бүтээлүүд ───────────────────────────────────────────────────────────

   Урсгал нь ЯРИА — юу бодсон, юу асуусан. Энэ хуудас нь НОТОЛГОО — юу
   ХИЙСЭН. Тиймээс текст биш, ажил нь өөрөө нүүр рүү гарна: дөрвөлжин тор,
   бичиг багатай, зохиогч нь зургийн доор биш ДЭЭР нь жижиг тэмдэг болж
   сууна.

   Хуудас нь хоёр давхаргатай:
     1) БҮТЭЭГЧИД — хамгийн олон бүтээлтэй хүмүүсийн зурвас. Дарвал тэр
        хүний ажлаар шүүнэ. "Гишүүдийг харуулах" гэдэг нь нэрийн жагсаалт
        биш — хийсэн зүйлээр нь харуулах юм.
     2) ТОР — бүх бүтээл, шинэ нь дээрээ.

   ХААЛТТАЙ нүд: `visibility: "members"` бүтээл нь нэвтрээгүй хүнд зурагаа
   ОГТ илгээхгүй (сервер тал шийднэ) — энд зөвхөн зохиогч, ангилал, түгжээ
   харагдана. Тэр нүд нь хоосон зай биш, ХААЛГА: дарвал үнэ рүү очно. */

interface Item {
  _id: string;
  locked: boolean;
  category: string;
  createdAt: string;
  author: { _id: string; name: string; avatar: string };
  content?: string;
  images?: string[];
  video?: string;
  videoDurationSec?: number;
  likes?: number;
  comments?: number;
}

function initial(n: string) {
  const c = (n || "").trim().charAt(0);
  return c ? c.toUpperCase() : "•";
}

function Face({ name, avatar, size = 28 }: { name: string; avatar: string; size?: number }) {
  if (avatar) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={avatar}
        alt=""
        loading="lazy"
        className="rounded-[4px] object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="flex items-center justify-center rounded-[4px] bg-[#1E1E1E] font-bold text-[#E2E4E8]"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
    >
      {initial(name)}
    </span>
  );
}

function Tile({ item }: { item: Item }) {
  const media = item.images?.[0] || "";
  const isVid = !!item.video;

  if (item.locked) {
    return (
      <Link
        href="/pricing"
        aria-label={`${item.author.name} — гишүүдэд нээлттэй бүтээл`}
        className="group relative block aspect-square overflow-hidden rounded-[4px] border border-[#1E1E1E] bg-[#0A0A0A]"
      >
        {/* Хаалттай нүд — агуулга биш, БҮТЭЦ. Диагональ зураас нь "энд юм
            байгаа, гэхдээ энэ нь чинийх биш" гэдгийг өнгө нэмэлгүй хэлнэ. */}
        <div
          className="absolute inset-0 opacity-[0.10]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(135deg, #F2F2F4 0 1px, transparent 1px 9px)",
          }}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <Face name={item.author.name} avatar={item.author.avatar} size={32} />
          <span className="chrome text-[9px] font-bold tracking-[0.14em] text-[#E2E4E8]">
            ГИШҮҮДЭД
          </span>
        </div>
        <span className="absolute right-1.5 top-1.5 text-[#E2E4E8] transition group-hover:text-[#2E29FF]">
          <Icon name="lock" size={12} />
        </span>
      </Link>
    );
  }

  return (
    <Link
      href={`/posts/${item._id}`}
      aria-label={`${item.author.name} — бүтээл`}
      className="group relative block aspect-square overflow-hidden rounded-[4px] border border-[#1E1E1E] bg-[#0A0A0A]"
    >
      {isVid ? (
        <video
          src={item.video}
          muted
          loop
          playsInline
          preload="metadata"
          className="h-full w-full object-cover"
        />
      ) : media ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={media} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <span className="text-[18px] text-[#333333]">✦</span>
        </div>
      )}

      {/* Зохиогч — зургийн ДЭЭР, доод хэсэгт. Хөшиг нь зөвхөн бичиг байгаа
          хэсэгт, зургийг бүхэлд нь бүдгэрүүлэхгүй. */}
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-[linear-gradient(to_top,rgba(0,0,0,0.72),transparent)] px-1.5 pb-1.5 pt-5">
        <Face name={item.author.name} avatar={item.author.avatar} size={18} />
        <span className="min-w-0 flex-1 truncate text-[10px] font-semibold text-[#FFFFFF]">
          {item.author.name}
        </span>
        {isVid && (
          <span className="shrink-0 text-[#FFFFFF]">
            <Icon name="play" size={12} />
          </span>
        )}
      </div>

      {(item.images?.length ?? 0) > 1 && (
        <span className="chrome absolute right-1.5 top-1.5 rounded-[4px] bg-[#0A0A0A] px-1 py-px text-[9px] font-bold text-[#F2F2F4]">
          {item.images!.length}
        </span>
      )}
    </Link>
  );
}

export default function CreationsPage() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [locked, setLocked] = useState(0);
  const [author, setAuthor] = useState<string>(""); // "" = бүгд

  const load = useCallback((after?: string | null) => {
    const qs = new URLSearchParams({ limit: "36" });
    if (after) qs.set("cursor", after);
    return fetch(`/api/creations?${qs}`).then((r) => r.json());
  }, []);

  useEffect(() => {
    let alive = true;
    load()
      .then((d) => {
        if (!alive) return;
        setItems(Array.isArray(d.items) ? d.items : []);
        setCursor(d.nextCursor || null);
        setMore(!!d.nextCursor);
        setTotal(d.total || 0);
        setLocked(d.locked || 0);
      })
      .catch(() => {
        if (alive) setItems([]);
      });
    return () => {
      alive = false;
    };
  }, [load]);

  const onMore = () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    load(cursor)
      .then((d) => {
        setItems((prev) => [...(prev || []), ...(Array.isArray(d.items) ? d.items : [])]);
        setCursor(d.nextCursor || null);
        setMore(!!d.nextCursor);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  };

  /* Бүтээгчид нь ТАТАГДСАН бүтээлээс тооцоологдоно — тусдаа дуудлага
     нэмэхгүй. Зурвас нь "хамгийн олон бүтээлтэй" гэж бус, "энэ хуудсан
     дээр хамгийн их харагдаж байгаа" гэж уншигдана — энэ нь шударга, учир
     нь хана нь өөрөө шинэ нь дээрээ эрэмбэлэгдсэн. */
  const creators = useMemo(() => {
    const m = new Map<string, { id: string; name: string; avatar: string; n: number }>();
    for (const it of items || []) {
      const id = it.author._id || it.author.name;
      const cur = m.get(id);
      if (cur) cur.n += 1;
      else m.set(id, { id, name: it.author.name, avatar: it.author.avatar, n: 1 });
    }
    return [...m.values()].sort((a, b) => b.n - a.n).slice(0, 12);
  }, [items]);

  const shown = useMemo(() => {
    if (!items) return null;
    if (!author) return items;
    return items.filter((i) => (i.author._id || i.author.name) === author);
  }, [items, author]);

  return (
    <PageShell>
      <div className="w-full px-4 pt-4 lg:px-0">
        <div className="mb-1.5 flex items-center gap-2.5">
          <Icon name="image" size={24} />
          <h1 className="text-[24px] font-bold leading-tight text-[#F2F2F4]">Бүтээлүүд</h1>
        </div>
        <p className="mb-6 text-[13px] text-[#E2E4E8]">
          Гишүүдийн хийсэн ажил — зураг, видео, AI бүтээл. Шинэ нь дээрээ.
          {total > 0 && (
            <>
              {" "}
              <span className="font-semibold text-[#E2E4E8]" style={{ fontVariantNumeric: "tabular-nums" }}>
                {total}
              </span>{" "}
              бүтээл
              {locked > 0 && <> · {locked} нь гишүүдэд</>}
            </>
          )}
        </p>

        {/* ── Бүтээгчид ── */}
        {creators.length > 1 && (
          <div className="-mx-4 mb-6 overflow-x-auto px-4 lg:mx-0 lg:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex w-max items-start gap-3">
              <button
                type="button"
                onClick={() => setAuthor("")}
                className={`flex w-[58px] shrink-0 flex-col items-center gap-1.5 ${author === "" ? "" : "opacity-60"}`}
              >
                <span
                  className={`flex h-[52px] w-[52px] items-center justify-center rounded-[4px] border text-[11px] font-bold ${
                    author === ""
                      ? "border-[#2E29FF] bg-[rgba(46,41,255,0.12)] text-[#2E29FF]"
                      : "border-[#1E1E1E] bg-[#0A0A0A] text-[#E2E4E8]"
                  }`}
                >
                  Бүгд
                </span>
                <span className="w-full truncate text-center text-[10px] font-semibold text-[#E2E4E8]">
                  {items?.length ?? 0}
                </span>
              </button>

              {creators.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setAuthor((a) => (a === c.id ? "" : c.id))}
                  className={`flex w-[58px] shrink-0 flex-col items-center gap-1.5 ${author && author !== c.id ? "opacity-55" : ""}`}
                  title={c.name}
                >
                  <span
                    className={`rounded-[4px] p-[2px] ${author === c.id ? "bg-[#2E29FF]" : "bg-[#262626]"}`}
                  >
                    <span className="block overflow-hidden rounded-[4px]">
                      <Face name={c.name} avatar={c.avatar} size={48} />
                    </span>
                  </span>
                  <span className="w-full truncate text-center text-[10px] font-semibold text-[#E2E4E8]">
                    {c.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Тор ── */}
        {shown === null && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-square animate-pulse rounded-[4px] bg-[#0A0A0A]" />
            ))}
          </div>
        )}

        {shown !== null && shown.length === 0 && (
          <div className="rounded-[4px] border border-[#1E1E1E] bg-[#0A0A0A] px-5 py-10 text-center">
            <p className="text-[14px] text-[#E2E4E8]">Одоохондоо бүтээл байхгүй байна.</p>
            <p className="mt-1.5 text-[13px] text-[#E2E4E8]">
              Хамгийн эхний бүтээл чинийх байж болно.
            </p>
            <Link
              href="/posts/new"
              className="mt-5 inline-flex items-center gap-2 rounded-[4px] bg-[#2E29FF] px-4 py-2.5 text-[13px] font-bold text-white transition hover:opacity-90"
            >
              <Icon name="plus" size={16} />
              Бүтээлээ нийтлэх
            </Link>
          </div>
        )}

        {shown !== null && shown.length > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {shown.map((it) => (
              <Tile key={it._id} item={it} />
            ))}
          </div>
        )}

        {more && !author && (
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={onMore}
              disabled={loadingMore}
              className="rounded-[4px] border border-[#262626] px-5 py-2.5 text-[13px] font-semibold text-[#E2E4E8] transition hover:border-[#2E29FF] hover:text-[#2E29FF] disabled:opacity-50"
            >
              {loadingMore ? "Уншиж байна…" : "Дараагийнх"}
            </button>
          </div>
        )}

        {locked > 0 && (
          <div className="mt-8 rounded-[4px] border border-[#1E1E1E] bg-[#0A0A0A] px-5 py-5 text-center">
            <p className="text-[13px] font-semibold text-[#F2F2F4]">
              {locked} бүтээл гишүүдэд нээлттэй.
            </p>
            <Link
              href="/pricing"
              className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-bold text-[#2E29FF] transition hover:opacity-80"
            >
              Гишүүн болох
              <span aria-hidden>→</span>
            </Link>
          </div>
        )}
      </div>
    </PageShell>
  );
}
