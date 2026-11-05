"use client";

import { usePathname } from "next/navigation";
import SideNav from "./SideNav";

// ─── Сайтын гадна бүрхүүл: хажуугийн цэс + агуулга ───
//
// Өмнө нь `AgentShell` нэртэй байсан. Тэр нэр нь санамсаргүй биш байв:
// бүрхүүл нь агентын БҮТЭН ДЭЛГЭЦИЙН горимыг асаах салаатай байсан бөгөөд
// тэр горим нь `<main>`-г `100dvh; overflow:hidden` болгодог — чат
// гүйлгэдэггүй байх ёстой байсан учраас.
//
// Агентыг бүрмөсөн авсан тул тэр салаа хэзээ ч үнэн болохоо больсон.
// Ингээд бүрхүүл нь энгийн болов: нэг л байрлал, нөхцөлгүй.
//
// `data-shell="sidebar"` нь ХЭРЭГТЭЙ хэвээр: `globals.css` доторх
// `.full-bleed`-ийн залруулга үүн дээр тулгуурладаг (lg-ээс дээш
// хажуугийн цэстэй үед 100vw breakout-г унтраана).
/* ТУСДАА БҮТЭЭГДЭХҮҮН. `/rent` нь Antaqor-ийн дотоод хуудас биш,
   өөрийн доод цэс, өөрийн палитртай бие даасан апп. Хажуугийн цэс,
   1400px төвлөрүүлэлт, `<main>`-ийн зай гурвуулаа түүнд саад болно —
   /yuki, /erchis хоёр ижил шалтгаанаар Navbar/Footer/BottomBar-аас
   гардаг, энэ нь түүний бүрхүүл дэх хувилбар. */
const BARE = ["/rent", "/shop", "/khuushuur", "/admin", "/content-agent"]; /* /admin — өөрийн хажуугийн цэстэй, бүтэн өргөнөөр */ /* /shop — ANTAQOR SUPPLY, өөрийн цагаан/хар хүрээтэй */

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  if (BARE.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return <>{children}</>;
  }
  return (
    /* 2026-10-11: X маягийн 1265px голлосон хүрээ — [цэс 275][агуулга ≤990]. */
    <div className="mx-auto flex w-full max-w-[1265px] justify-center" data-shell="sidebar">
      <SideNav />
      <main className="min-w-0 flex-1 px-0 pb-10 pt-4 md:px-8 md:pb-10 md:pt-8 lg:max-w-[990px] lg:px-0 lg:pb-0 lg:pt-0">
        {children}
      </main>
    </div>
  );
}
