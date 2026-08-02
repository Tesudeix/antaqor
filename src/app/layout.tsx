import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "./providers";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BottomBar from "@/components/BottomBar";
import InstallPrompt from "@/components/InstallPrompt";
import SubscriptionBanner from "@/components/SubscriptionBanner";

const SITE_DESCRIPTION =
  "7 хоногт AI-г ажилдаа нэвтрүүл: өдөр бүр нэг хичээл, нэг бодит даалгавар — ChatGPT, Claude, Grok. Монголын AI builder community.";

export const metadata: Metadata = {
  title: {
    default: "Antaqor — 7 хоногийн AI хөтөлбөр",
    template: "%s | Antaqor",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "Antaqor",
    "Edgerunners",
    "AI",
    "хиймэл оюун",
    "AI сургалт",
    "промпт",
    "AI агент",
    "Монгол бүтээгчид",
    "AI бизнес",
  ],
  authors: [{ name: "Antaqor" }],
  creator: "Antaqor",
  manifest: "/manifest.json",
  metadataBase: new URL("https://antaqor.com"),
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "mn_MN",
    url: "https://antaqor.com",
    siteName: "Antaqor",
    title: "Antaqor — 7 хоногийн AI хөтөлбөр",
    description: SITE_DESCRIPTION,
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Antaqor — 7 хоногийн AI хөтөлбөр",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Antaqor — 7 хоногийн AI хөтөлбөр",
    description: SITE_DESCRIPTION,
    creator: "@antaqor",
    images: ["/og.png"],
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
    statusBarStyle: "black",
    title: "Antaqor",
  },
};

// Dark browser chrome + safe areas on mobile (notch / status bar / home
// indicator). viewportFit:"cover" lets the dark page bg fill the insets and
// enables the env(safe-area-inset-*) padding the nav/bottom bar use.
export const viewport: Viewport = {
  themeColor: "#161618",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Organization schema — keeps the brand card in search results consistent
const ORG_JSONLD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Antaqor",
  alternateName: "Antaqor Edgerunners community",
  url: "https://antaqor.com",
  logo: "https://antaqor.com/icon-512.png",
  description: SITE_DESCRIPTION,
  sameAs: [
    "https://www.instagram.com/tesudei",
    "https://www.threads.net/@tesudei",
    "https://www.facebook.com/antaqor",
    "https://www.youtube.com/@antaqor",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="mn">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* v8 EVENT HORIZON type system — full Cyrillic (§02):
            Unbounded — DISPLAY: wide, machined headlines / hero numbers
            Golos Text — TEXT/UI: Cyrillic-native grotesk body
            JetBrains Mono — MONO/DATA: serials, tags, timestamps */}
        <link
          href="https://fonts.googleapis.com/css2?family=Unbounded:wght@500;800&family=Golos+Text:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_JSONLD) }}
        />
      </head>
      <body>
        <Providers>
          <SubscriptionBanner />
          <Navbar />
          <main className="px-4 pb-24 pt-6 md:px-8 md:pb-10 md:pt-8 lg:px-12">
            {children}
          </main>
          <Footer />
          <BottomBar />
          <InstallPrompt />
        </Providers>
      </body>
    </html>
  );
}
