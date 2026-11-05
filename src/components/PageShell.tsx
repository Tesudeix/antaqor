"use client";

import type { ReactNode } from "react";
import RightRail from "@/components/RightRail";

/* ─── Хуудасны нэгдсэн бүтэц — X маяг (2026-10-11) ──────────────────────
   AppShell: [зүүн цэс 275] [энэ бүрхүүл] — бүхэлдээ 1265px, голлосон.
   Энэ бүрхүүл: [төв 600px, хоёр талдаа үсэн шугам] [30px] [баруун 350px].
   Хоёр талын багана жигд жинтэй → төв багана нүдний голд суух ёстой
   (эзний хүсэлт: "right and left side … center like X").

   1280px-ээс доош баруун багана нуугдаж төв нь 600px хэвээр — багана
   шахагдаж бичиг нь нарийсахаас баруун тал алга болсон нь дээр.
   Утсан дээр зөвхөн төв (хүрээгүй). Хуудас өөрийн нэмэлт картыг `rail`-аар
   өгнө — тэр нь хайлтын доор, ерөнхий картуудын дээр орно. */

export default function PageShell({ children, rail }: { children: ReactNode; rail?: ReactNode }) {
  return (
    <div className="mx-auto grid w-full grid-cols-1 items-start pb-24 lg:max-w-[600px] lg:pb-0 xl:max-w-none xl:grid-cols-[600px_350px] xl:gap-[30px]">
      <div className="min-w-0 lg:min-h-screen lg:border-x lg:border-[color:var(--t-line,rgba(255,255,255,0.12))]">{children}</div>
      <aside className="scrollbar-hide sticky top-0 hidden max-h-screen flex-col gap-4 overflow-y-auto pb-6 pt-2 xl:flex" aria-label="Баруун багана">
        <RightRail />
        {rail}
      </aside>
    </div>
  );
}
