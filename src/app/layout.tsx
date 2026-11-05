import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "./providers";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BottomBar from "@/components/BottomBar";
import InstallPrompt from "@/components/InstallPrompt";
import InstallBanner from "@/components/InstallBanner";
import CreateSheetHost from "@/components/CreateSheetHost";
import PresenceBeat from "@/components/PresenceBeat";
import PromptAddSheetHost from "@/components/PromptAddSheet";
import MaintenanceBanner from "@/components/MaintenanceBanner";
import AuthModal from "@/components/AuthModal";
import GuestGate from "@/components/GuestGate";
import AppShell from "@/components/AppShell";
import SiteGate from "@/components/SiteGate";
import XPToast from "@/components/XPToast";
import { brandUrl, getBrand, type Brand } from "@/lib/siteBrand";

/** Ганц эх сурвалж. robots.ts болон sitemap.ts ч ЯГ энэ домэйныг заана —
    гурав зөрөх нь хайлтын хувьд домэйн хоорондоо өрсөлдөж буй хэрэг. */
const SITE_URL = "https://antaqor.com";
const SITE_NAME = "Antaqor";

/* Тайлбар нь AI хайлтад ЗОРИУЛЖ бичигдсэн: юу болох, хэнд зориулсан, юу
   өгөх нь нэг өгүүлбэрт багтана. Хэл загварууд хуудсыг эшлэхдээ иймэрхүү
   бие даасан, тодорхойлолт маягийн өгүүлбэрийг сугалж авдаг — "7 хоногт
   AI-г ажилдаа нэвтрүүл" гэсэн уриа нь юу зарж байгааг хэлдэггүй. */
/* Тайлбарын анхдагч утга одоо lib/siteBrand.ts (BRAND_DEFAULT) — /admin/brand-аас засна. */

/* 2026-10-26: гарчиг, тайлбар, түлхүүр үг, cover, favicon, апп icon нь /admin/brand-аас
   засагдана (SiteSettings `site_brand`, lib/siteBrand.ts). Хоосон бол доорх хуучин утгууд.
   ISR 5 мин: статик хуудсууд ч админы өөрчлөлтийг build хийлгүйгээр авна. */
export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const b = await getBrand();
  const cover = brandUrl(b, "cover");
  return {
    title: { default: b.title, template: b.template },
    description: b.description,
    keywords: b.keywords,
    authors: [{ name: "Antaqor" }],
    creator: "Antaqor",
    manifest: "/manifest.json",
    metadataBase: new URL(SITE_URL),
    /* `alternates.canonical` энд БАЙХГҮЙ (2026-10-26). Root layout-д "/" гэж тавибал
       өөрийн canonical-гүй БҮХ хуудас "би нүүрний хуулбар" гэж Google-д хэлдэг байв. */
    icons: {
      icon: [
        { url: brandUrl(b, "icon-32.png"), sizes: "32x32", type: "image/png" },
        { url: brandUrl(b, "icon-192.png"), sizes: "192x192", type: "image/png" },
      ],
      shortcut: "/favicon.ico",
      apple: [{ url: brandUrl(b, "apple-touch-icon.png"), sizes: "180x180", type: "image/png" }],
    },
    openGraph: {
      type: "website",
      locale: "mn_MN",
      url: SITE_URL,
      siteName: SITE_NAME,
      title: b.title,
      description: b.description,
      images: [{ url: cover, width: 1200, height: 630, alt: b.ogAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title: b.title,
      description: b.description,
      creator: "@antaqor",
      images: [cover],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: b.shortName,
    },
  };
}

// Dark browser chrome + safe areas on mobile (notch / status bar / home
// indicator). viewportFit:"cover" lets the dark page bg fill the insets and
// enables the env(safe-area-inset-*) padding the nav/bottom bar use.
export const viewport: Viewport = {
  /* themeColor энд БАЙХГҮЙ хэвээр, гэхдээ шалтгаан нь өөрчлөгдсөн.
     Өмнө нь горим хэрэглэгчийн сонголтоор солигддог тул статик meta
     хуудастай зөрдөг байв. Одоо харанхуй горим огт байхгүй (2026-09-16)
     тул theme-color нь <head> дотор ЭНГИЙН СТАТИК <meta> болж суусан —
     нэг л утга, солигдох зүйлгүй. color-scheme нь CSS-ээр хэвээр. */
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Organization schema — keeps the brand card in search results consistent
const orgJsonLd = (b: Brand) => ({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      alternateName: "Antaqor AI хүрээлэл",
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}${brandUrl(b, "icon-512.png")}`,
        width: 512,
        height: 512,
      },
      image: `${SITE_URL}${brandUrl(b, "cover")}`,
      description: b.description,
      /* Хаана үйл ажиллагаа явуулдгийг хэлэх нь "Монголын AI хүрээлэл"
         төрлийн асуултад тааруулагдах магадлалыг нэмнэ. */
      areaServed: { "@type": "Country", name: "Mongolia" },
      knowsLanguage: ["mn", "en"],
      sameAs: [
        "https://www.instagram.com/tesudei",
        "https://www.threads.net/@tesudei",
        "https://www.facebook.com/antaqor",
        "https://www.youtube.com/@antaqor",
      ],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      description: b.description,
      inLanguage: "mn",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
  ],
});

const THEME_CLOCK = "(function(){var D=document.documentElement;function m(){if(location.hostname.indexOf(\"studio.\")===0){D.setAttribute(\"data-host\",\"studio\");return \"light\"}if(location.hostname.indexOf(\"trader.\")===0){D.setAttribute(\"data-host\",\"trader\");return \"dark\"}if(/^\\/(yuki|rent|watch)(\\/|$)/.test(location.pathname))return\"dark\";return \"light\"}function t(){var v=m();if(D.getAttribute(\"data-theme\")!==v){D.setAttribute(\"data-theme\",v);var c=document.querySelector('meta[name=\"theme-color\"]');if(c)c.setAttribute(\"content\",v===\"light\"?\"#F8F9FD\":\"#0A0A0A\")}}t();[\"pushState\",\"replaceState\"].forEach(function(k){var o=history[k];history[k]=function(){var r=o.apply(this,arguments);t();return r}});addEventListener(\"popstate\",t);setInterval(t,60000);document.addEventListener(\"visibilitychange\",t)})();";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    /* suppressHydrationWarning: доорх скрипт нь React хүрч ирэхээс ӨМНӨ
       өнгийг сольж мэднэ — тэр зөрүү нь алдаа биш, зорилго. */
    <html lang="mn" data-theme="light" suppressHydrationWarning>
      <head>
        {/* ХАРАНХУЙ ГОРИМЫГ БҮРМӨСӨН АВСАН (2026-09-16).

            Энд өмнө нь блоклодог скрипт байсан: hydration-аас өмнө
            localStorage-оос хадгалсан горимыг уншиж тавьдаг, эс бөгөөс
            харанхуй сонгосон хүн хуудас бүр дээр цагаан гэрлээр цохиулдаг
            байв ("FOUC"). Сонгох горим үлдээгүй тул унших зүйл ч, засах
            зөрүү ч алга — сайт ганц (харанхуй) горимтой болсон.
            Тиймээс скриптийг устгав: хамгийн хурдан код бол ажиллахгүй код.

            theme-color нь динамик байх шаардлагагүй болсон тул статик
            <meta> боллоо. */}
        {/* ЗӨВХӨН ХАРАНХУЙ (2026-10-06, эзний хүсэлт). Өдрийн горим, солих
            товч, блоклох скрипт хасагдав. theme-light*.css нь globals-д
            импортлогдсон хэвээр боловч зөвхөн data-theme="light" үед асдаг
            тул идэвхгүй. */}
        <meta name="theme-color" content="#F8F9FD" />
        {/* ӨДӨР ГЭРЭЛ / ШӨНӨ ХАРАНХУЙ (2026-10-11, эзний хүсэлт). Төхөөрөмжийн
            цагаар 07:00–19:00 data-theme="light" (#F8F9FD), бусад үед "dark"
            (#0A0A0A). Paint-аас ӨМНӨ ажиллана (FOUC-гүй); навигаци, таб руу
            буцах, минут тутамд дахин шалгана. /admin, /yuki, /rent, /watch
            нь өөрийн палитртай тул үргэлж харанхуй. Өнгө: theme-light-extra §11. */}
        {/* 2026-10-23 (эзний шийдвэр): ЦАЙВАР НЭГ ГОРИМ — сайт + админ #F8F9FD, брэнд #2E29FF.
            Харанхуй горим зөвхөн /yuki, /rent, /watch (өөрийн палитр). Өнгө: theme-day*.css. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_CLOCK }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Manrope carries the whole site — display, text and HUD chrome.
            Google serves it per-subset, so a Mongolian visitor downloads the
            Cyrillic cut only, which is a fraction of the three families it
            replaced. */}
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd(await getBrand())) }}
        />
      </head>
      <body>
        <div className="intro-splash" aria-hidden="true">
          <span className="intro-splash__mark">Antaqor</span>
        </div>
        <Providers>
          <MaintenanceBanner />
          {/* .site-chrome = display:contents; trader.antaqor.com дээр globals.css нуудаг */}
          <div className="site-chrome"><PresenceBeat /><Navbar /></div>
          {/* lg-ээс дээш: зүүн цэс + агуулга нэг голлосон мөрөнд.
              lg-ээс доош: SideNav өөрөө null буцаана, Navbar + доод цэс ажиллана. */}
          <AppShell><SiteGate>{children}</SiteGate></AppShell>
          <div className="site-chrome">
            <Footer />
            <BottomBar />
            <InstallPrompt />
            <InstallBanner />
            <CreateSheetHost />
            <PromptAddSheetHost />
          </div>
          <AuthModal />
          <GuestGate />
          {/* Бүх хуудсанд нэг л удаа. Клиент талын шилжилтэд амьд үлддэг тул
              пост нийтлээд нүүр рүү үсэрсэн ч дохио замдаа алдагдахгүй. */}
          <div className="site-chrome"><XPToast /></div>
        </Providers>
      </body>
    </html>
  );
}
