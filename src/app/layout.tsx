import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import Navbar from "@/components/Navbar";
import BottomBar from "@/components/BottomBar";
import InstallPrompt from "@/components/InstallPrompt";

export const metadata: Metadata = {
  title: {
    default: "Antaqor — Зэрлэг бай. Ирээдүйг байлд.",
    template: "%s | Antaqor",
  },
  description:
    "Дижитал Үндэстний нийгэмлэг. AI-г эзэмшиж, хэрэгслээ бүтээж, ирээдүйгээ тодорхойлдог бүтээгчдийн үндэстэн. Монгол үндэс. Дэлхийн хүч.",
  keywords: [
    "Antaqor",
    "Дижитал Үндэстэн",
    "AI",
    "Монгол бүтээгчид",
    "нийгэмлэг",
    "футуризм",
    "технологи",
    "боловсрол",
  ],
  authors: [{ name: "Antaqor" }],
  creator: "Antaqor",
  manifest: "/manifest.json",
  metadataBase: new URL("https://tesudeix.com"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "mn_MN",
    url: "https://tesudeix.com",
    siteName: "Antaqor",
    title: "Antaqor — Зэрлэг бай. Ирээдүйг байлд.",
    description:
      "Дижитал Үндэстний нийгэмлэг. AI-г эзэмшиж, хэрэгслээ бүтээж, ирээдүйгээ тодорхойлдог бүтээгчдийн үндэстэн.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Antaqor — Зэрлэг бай. Ирээдүйг байлд.",
    description:
      "Дижитал Үндэстний нийгэмлэг. AI-г эзэмшиж, хэрэгслээ бүтээж, ирээдүйгээ тодорхойлдог бүтээгчдийн үндэстэн.",
    creator: "@antaqor",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  other: {
    "fb:app_id": "",
    "article:author": "https://www.facebook.com/antaqor",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Antaqor",
  },
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
        <link
          href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Commissioner:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <meta name="theme-color" content="#030303" />
        <meta name="msapplication-TileColor" content="#cc2200" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body>
        <div className="grid-bg" />
        <Providers>
          <Navbar />
          <main className="relative z-[1] mx-auto max-w-5xl px-6 py-8 pb-24 md:px-10 md:pb-8">
            {children}
          </main>
          <footer className="relative z-[1] mb-16 border-t border-[rgba(240,236,227,0.08)] bg-[#030303] px-6 py-12 md:mb-0 md:px-10">
            <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 md:flex-row md:justify-between">
              <div className="font-[Bebas_Neue] text-2xl tracking-[4px]">
                ANTA<span className="text-[#cc2200]">QOR</span>
              </div>
              <div className="flex gap-3">
                <a href="https://www.threads.net/@antaqor" target="_blank" rel="noopener noreferrer" className="flex h-10 w-10 items-center justify-center border border-[rgba(240,236,227,0.1)] text-[rgba(240,236,227,0.4)] transition-all hover:border-[#cc2200] hover:text-[#ede8df]">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                    <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.028-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.308-.883-2.359-.89h-.029c-.803 0-1.539.214-2.185.636l-1.994-.653c.457-1.32 1.181-2.36 2.153-3.096C10.04 6.43 11.13 6 12.354 6h.062c1.732.012 3.107.558 4.087 1.622.957 1.043 1.461 2.555 1.497 4.495l.13.02c1.144.194 2.148.703 2.908 1.477 1.023 1.052 1.555 2.508 1.555 4.221 0 .166-.005.331-.015.494-.137 2.28-1.163 4.07-2.969 5.176C17.987 23.474 15.354 24 12.186 24z"/>
                  </svg>
                </a>
                <a href="https://www.facebook.com/antaqor" target="_blank" rel="noopener noreferrer" className="flex h-10 w-10 items-center justify-center border border-[rgba(240,236,227,0.1)] text-[rgba(240,236,227,0.4)] transition-all hover:border-[#cc2200] hover:text-[#ede8df]">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                </a>
                <a href="https://www.youtube.com/@antaqor" target="_blank" rel="noopener noreferrer" className="flex h-10 w-10 items-center justify-center border border-[rgba(240,236,227,0.1)] text-[rgba(240,236,227,0.4)] transition-all hover:border-[#cc2200] hover:text-[#ede8df]">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
                </a>
              </div>
              <div className="text-center text-[10px] tracking-[3px] text-[rgba(240,236,227,0.3)] md:text-right" style={{ lineHeight: 2 }}>
                ФУТУРИЗМ · ЦАГ ХУГАЦАА · ДАСАН ЗОХИЦОЛ · МӨНХИЙН БАЙЛДАН ДАГУУЛАЛТ<br />
                ДИЖИТАЛ ҮНДЭСТЭН БҮТЭЭЖ БАЙНА · 2025–2027
              </div>
            </div>
          </footer>
          <BottomBar />
          <InstallPrompt />
        </Providers>
      </body>
    </html>
  );
}
