"use client";

import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { useMembership } from "@/lib/useMembership";

/* ─── SiteGate — сайтын ГАНЦ төлбөрийн хаалга ──────────────────────────────

   2026-08-26-нд Antaqor бүхэлдээ гишүүнчлэлтэй болсон: үнэгүй урсгал ч,
   үнэгүй AI квот ч байхгүй.

   ЯАГААД ГАНЦ ГАЗАР ВЭ. Хуудас бүр дээр `PaywallGate` наах замаар ижил үр
   дүнд хүрч болно — гэхдээ 30 гаруй хуудас байгаа тул нэгийг нь мартах нь
   ЦАГИЙН асуудал л болно, мартсан хуудас чинь нээлттэй хаалга болно.
   Дүрэм нэг файлд байвал "юу нээлттэй вэ" гэдгийг НЭГ жагсаалт хариулна.

   ЭНЭ БОЛ ХАМГААЛАЛТ БИШ, ГАДАРГУУ. Клиент талын хаалт нь зөвхөн UX —
   жинхэнэ хамгаалалт нь API дээр (`accessState`). Хэн нэгэн шууд
   `/api/posts` руу хандвал сервер өөрөө хаана.

   НЭЭЛТТЭЙ ЗАМУУД. Гурван шалтгаанаар л зам нээлттэй байна:
   1. Хүн бүртгүүлэх/төлөх гарц (`/`, `/pricing`, `/auth`, `/clan`, `/account`)
      — эдгээрийг хаах нь хаалгаа цоожлоод түлхүүрээ дотор нь мартахтай адил.
   2. Олон нийтэд итгэл төрүүлэх хуудсууд (`/founders`, `/community`,
      `/partnerships`, `/news`, `/services`) — эдгээр нь зар сурталчилгаа,
      бүтээгдэхүүн биш.
   3. Админ (`/admin`) — өөрийн гэсэн эрхийн шалгууртай.                  */

const OPEN_PREFIXES = [
  /* trader.antaqor.com/2 — «/»-тэй адил нээлттэй: хуудас өөрөө нэвтрэлтээ шалгана (2026-11-05). */
  "/2",
  "/3",
  "/4",
  /* Antaqor Agent — өөрийн админ эрхийн шалгууртай (API 401 → нэвтрэх дэлгэц). */
  "/content-agent",
  "/live/broadcast",
  "/pricing",
  /* ХҮРЭЭЛЭЛ — жагсаалт нь витрин: ямар бүлэг байгааг хараагүй байж
     нэгдэх шийдвэр гаргах боломжгүй. Нэгдэх, бичих нь нэвтрэлт
     шаардсан хэвээр (`/api/circles` POST 401 буцаана). */
  "/circles",
  /* UB RENT — байр хайж буй хүн Antaqor-ийн гишүүн БИШ. Зар үзэх,
     зардлаа тооцох, viewing цаг авах гурвуулаа хаалтын гадна байх
     ёстой: хаалттай бол энэ бүтээгдэхүүн оршин байх утгагүй.
     Админ CRUD нь /admin/rent дээр тусдаа хамгаалагдсан. */
  "/rent",
  /* ANTAQOR SUPPLY — дэлгүүр бол витрин: худалдан авагч гишүүн байх
     албагүй, зочин ч захиална (нэр+утас+хаяг). Админ CRUD нь
     /admin/shop + /api/admin/shop дээр тусдаа хамгаалагдсан. */
  "/shop",
  /* ТАЛ ХУУШУУР — хоол хүргэлтийн меню. Захиалагч гишүүн байх албагүй,
     зочин ч QPay-ээр захиална. Админ CRUD нь /admin/khuushuur дээр. */
  "/khuushuur",
  /* КЛИЕНТИЙН REEL нь ВИТРИН: клиентэд хийж өгсөн ажлаа харуулж,
     тэр хүн нь шууд ороод татдаг хүргэлтийн суваг. Клиент бол
     Antaqor-ийн ГИШҮҮН БИШ — төлбөрийн ханаар угтвал хийж өгсөн
     ажлаа хүлээлгэж өгөх боломжгүй болно. Оруулах нь энэ хаалтаас
     тусдаа хэвээр: `/api/reels/upload` нэвтрэлт + `canUploadReels`
     эрх шаардана. */
  "/reels",
  /* Агентын лавлах нь БҮТЭЭГДЭХҮҮН биш, витрин: зочин хэн байгааг хараад
     л шийддэг. Тэдэнтэй ЯРИХ нь өөр асуудал бөгөөд `/api/agents/chat`
     дээр нэвтрэлт ба кредитээр аль хэдийн хаалттай. Витриныг хаах нь
     дэлгүүрийн шилийг будахтай адил. */
  "/agents",
  "/auth",
  "/clan",
  "/account",
  "/founders",
  "/community",
  "/partnerships",
  "/news",
  "/magazine",
  "/services",
  "/offline",
  "/admin",
  "/onboarding",
  "/privacy-policy",
  /* ӨӨРИЙН ПРОФАЙЛ БОЛ БҮТЭЭГДЭХҮҮН БИШ. Энэ мөр байхгүй үед
     төлбөрөө сунгаагүй гишүүн /profile руу орох гэхэд төлбөрийн
     хана угтдаг байв — тэр хананд ГАРАХ товч байхгүй, гарах товч нь
     яг тэр хаагдсан профайл дотор байдаг. Үр дүн: хүн өөрийн
     бүртгэлээсээ гарч ЧАДАХГҮЙ гацдаг. Хаалт нь хүнийг ХУДАЛДАН
     АВАХАД урих ёстой, барьцаанд авах ёсгүй. */
  "/profile",
  /* Тэргүүлэгчдийн самбар нь БҮТЭЭГДЭХҮҮН биш, ВИТРИН. Зочны нүүрэн
     дээрх подиум нь энд заадаг тул хаалттай байвал урих гэсэн зам нь
     төлбөрийн хананд мөргөнө — өөрөөр хэлбэл "хэн байгааг хараад
     шийд" гэж уриад, хараад л шийдэх боломжийг нь хаана. */
  "/leaderboard",
  "/prompts",
  "/classroom",
];

function isOpen(pathname: string): boolean {
  if (pathname === "/") return true; // нүүр нь зочны элсүүлэх гадаргуу
  return OPEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function Pulse() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-2 w-2 animate-pulse bg-[#2E29FF]" />
    </div>
  );
}

/** Хугацаа дуусах гэж буй хуучин хэрэглэгчийн ТӨЛӨВИЙН ЗУРВАС.
 *
 *  Өмнө нь энэ нь хуудас бүрийн дээр суудаг, улаан хүрээтэй, хоёр мөр
 *  бичигтэй анхааруулгын хайрцаг байсан. Асуудал нь: хүн үүнийг ГУЧ дахь
 *  удаагаа харахад анхааруулга байхаа больж, зүгээр л агуулгын өмнө
 *  зогсох саад болдог. Уншихаа больсон анхааруулга бол анхааруулга биш.
 *
 *  Одоо энэ нь нэг мөрийн төлөвийн зурвас: юу байгаа (ТҮР ЭРХ), хэдэн
 *  хоног үлдсэн, нэг үйлдэл. Улбар өнгө ХЭРЭГЛЭХГҮЙ — өнгө нь ховор
 *  байх тусмаа хүчтэй тул түүнийг сүүлийн 24 цагт хадгална. Тэр үед л
 *  энэ мөр өнгө авч, жинхэнэ анхааруулга болно.
 */
export function GraceBanner() {
  /* Үлдсэн хоногийг СЕРВЕР тоолж өгнө. Энд `Date.now()` дуудвал render
     цэвэр бус болж, сервер/клиентийн hydration зөрж мэднэ. */
  const { loading, inGrace, graceDaysLeft } = useMembership();
  if (loading || !inGrace) return null;

  // Сүүлийн хоног — цорын ганц онцлох мөч.
  const urgent = graceDaysLeft <= 1;

  return (
    <div
      className={`mx-auto mb-[var(--sp-4)] flex max-w-4xl items-center justify-between gap-[var(--sp-3)] px-4 py-2 ${
        urgent ? "bg-[rgba(46,41,255,0.10)]" : "bg-[var(--nav-hover-bg)]"
      }`}
      style={{ borderRadius: 4 }}
    >
      <div className="flex min-w-0 items-center gap-[var(--sp-2)]">
        <span
          className={`chrome shrink-0 text-[10px] font-bold tracking-[0.14em] ${
            urgent ? "text-[#2E29FF]" : "text-[#E2E4E8]"
          }`}
        >
          ТҮР ЭРХ
        </span>
        <span className="text-[#333333]" aria-hidden>
          ·
        </span>
        <span
          className="t-sec min-w-0 truncate font-semibold text-[var(--nav-fg-strong)]"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {graceDaysLeft} хоног үлдлээ
        </span>
      </div>
      <Link
        href="/pricing"
        className={`press t-sec shrink-0 font-bold transition ${
          urgent
            ? "bg-[#2E29FF] px-3 py-1.5 text-[#0A0A0A] hover:bg-[#1F1AD9]"
            : "text-[#2E29FF] hover:text-[#4C47FF]"
        }`}
        style={{ borderRadius: 4 }}
      >
        Сунгах
      </Link>
    </div>
  );
}

/** Төлбөрийн хана. Текст бага — шийдвэр нэг, товч нэг. */
export function Paywall({ loggedIn }: { loggedIn: boolean }) {
  return (
    <div className="flex min-h-[62vh] items-center justify-center px-5">
      <div className="w-full max-w-md text-center">
        <div className="chrome text-[10px] font-bold tracking-[0.18em] text-[#2E29FF]">
          ГИШҮҮНЧЛЭЛ
        </div>
        <h1 className="mt-3 text-balance text-[24px] font-extrabold leading-[1.2] tracking-[-0.02em] text-[#F2F2F4] md:text-[28px]">
          Энэ хэсэг гишүүдэд нээлттэй.
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-[13.5px] leading-[1.6] text-[#E2E4E8]">
          Урсгал, AI хэрэгслүүд, хичээл, промт сан — бүгд нэг гишүүнчлэлд
          багтана.
        </p>

        <div className="mt-6 flex flex-col items-center gap-3">
          <Link
            href="/pricing"
            className="w-full max-w-[240px] bg-[#2E29FF] px-6 py-3 text-[12.5px] font-bold tracking-[0.06em] text-[#0A0A0A]"
            style={{ borderRadius: 4 }}
          >
            ГИШҮҮН БОЛОХ
          </Link>
          {loggedIn ? (
            <>
              <Link href="/clan" className="text-[12px] font-semibold text-[#E2E4E8] transition hover:text-[#2E29FF]">
                Төлбөр илгээсэн үү? Төлөв шалгах
              </Link>
              {/* Хаалттай дэлгэц нь ХЭЗЭЭ Ч мухар байж болохгүй. Хүн худалдан
                  авах, төлөвөө шалгах, эсвэл ГАРАХ — гурван замын аль нэгийг
                  үргэлж сонгож чаддаг байх ёстой. */}
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: `${window.location.origin}/` })}
                className="text-[12px] font-semibold text-[#E2E4E8] transition hover:text-[#2E29FF]"
              >
                Гарах
              </button>
            </>
          ) : (
            <Link href="/auth/signin" className="text-[12px] font-semibold text-[#E2E4E8] transition hover:text-[#2E29FF]">
              Бүртгэлтэй юу? Нэвтрэх
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SiteGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const { loading, hasAccess, isLoggedIn, inGrace } = useMembership();

  if (isOpen(pathname)) {
    return (
      <>
        {inGrace && <GraceBanner />}
        {children}
      </>
    );
  }

  /* Эрх нь тодроогүй байхад контентыг ХАРУУЛАХГҮЙ, харин төлбөрийн ханыг ч
     харуулахгүй. Хоёулаа буруу: нэг нь төлбөргүй хүнд контент үзүүлнэ,
     нөгөө нь төлсөн хүнд хана анивчуулна. */
  if (loading) return <Pulse />;

  if (!hasAccess) return <Paywall loggedIn={isLoggedIn} />;

  return (
    <>
      {inGrace && <GraceBanner />}
      {children}
    </>
  );
}
