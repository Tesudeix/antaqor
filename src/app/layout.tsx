import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import Navbar from "@/components/Navbar";
import BottomBar from "@/components/BottomBar";
import InstallPrompt from "@/components/InstallPrompt";

export const metadata: Metadata = {
  title: {
    default: "Tesudeix — Be Wild. Conquer the Future.",
    template: "%s | Tesudeix",
  },
  description:
    "Дижитал Үндэстний нийгэмлэг. AI-г эзэмшиж, хэрэгслээ бүтээж, ирээдүйгээ тодорхойлдог бүтээгчдийн үндэстэн. Монгол үндэс. Дэлхийн хүч.",
  keywords: [
    "Tesudeix",
    "Дижитал Үндэстэн",
    "AI",
    "Монгол бүтээгчид",
    "нийгэмлэг",
    "футуризм",
    "технологи",
    "боловсрол",
  ],
  authors: [{ name: "Tesudeix" }],
  creator: "Tesudeix",
  manifest: "/manifest.json",
  metadataBase: new URL("https://tesudeix.com"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "mn_MN",
    url: "https://tesudeix.com",
    siteName: "Tesudeix",
    title: "Tesudeix — Be Wild. Conquer the Future.",
    description:
      "Дижитал Үндэстний нийгэмлэг. AI-г эзэмшиж, хэрэгслээ бүтээж, ирээдүйгээ тодорхойлдог бүтээгчдийн үндэстэн.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tesudeix — Be Wild. Conquer the Future.",
    description:
      "Дижитал Үндэстний нийгэмлэг. AI-г эзэмшиж, хэрэгслээ бүтээж, ирээдүйгээ тодорхойлдог бүтээгчдийн үндэстэн.",
    creator: "@tesudei",
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
    "article:author": "https://www.facebook.com/tesudei",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Tesudeix",
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
          href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;600;700;800;900&family=Rubik:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <meta name="theme-color" content="#05050A" />
        <meta name="msapplication-TileColor" content="#006491" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body>
        <div className="grid-bg" />
        <div className="scanline-overlay" />
        <Providers>
          <Navbar />
          <main className="relative z-[1] mx-auto max-w-5xl px-6 py-8 pb-24 md:px-10 md:pb-8">
            {children}
          </main>
          <footer className="relative z-[1] mb-16 border-t border-[rgba(0,240,255,0.08)] bg-[#05050A] md:mb-0">
            {/* Values strip */}
            <div className="border-b border-[rgba(0,240,255,0.05)] px-6 py-10 md:px-10">
              <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <div className="mb-2 text-sm font-bold tracking-[2px] text-[#ede8df]">ФУТУРИЗМ</div>
                  <p className="text-[11px] leading-[1.8] text-[rgba(240,236,227,0.35)]">
                    Бусдын хараагүйг хар. AI-г ашиглахгүй — тодорхойл. Ирээдүйг урьдчил.
                  </p>
                </div>
                <div>
                  <div className="mb-2 text-sm font-bold tracking-[2px] text-[#ede8df]">ЦАГ ХУГАЦАА</div>
                  <p className="text-[11px] leading-[1.8] text-[rgba(240,236,227,0.35)]">
                    Шийдвэр бүр үр ашгаар шүүгдэнэ. Илүү хурдан, илүү хөнгөн.
                  </p>
                </div>
                <div>
                  <div className="mb-2 text-sm font-bold tracking-[2px] text-[#ede8df]">ДАСАН ЗОХИЦОЛ</div>
                  <p className="text-[11px] leading-[1.8] text-[rgba(240,236,227,0.35)]">
                    Өөрчлөлтөд дасахгүй — урьдчил. Хөгжихөө хэзээ ч бүү зогсоо.
                  </p>
                </div>
                <div>
                  <div className="mb-2 text-sm font-bold tracking-[2px] text-[#006491]">МӨНХИЙН БАЙЛДАН ДАГУУЛАЛТ</div>
                  <p className="text-[11px] leading-[1.8] text-[rgba(240,236,227,0.35)]">
                    Финиш шугам гэж байхгүй. Эрхэм зорилго мөнхийн.
                  </p>
                </div>
              </div>
            </div>

            {/* Main footer */}
            <div className="px-6 py-10 md:px-10">
              <div className="mx-auto max-w-5xl">
                <div className="flex flex-col gap-8 md:flex-row md:justify-between">
                  {/* Brand */}
                  <div className="max-w-xs">
                    <div className="text-xl font-bold tracking-[4px]">
                      TESU<span className="text-[#006491]" style={{ textShadow: '0 0 10px rgba(0,100,145,0.5)' }}>DEIX</span>
                    </div>
                    <p className="mt-3 text-[11px] leading-[1.8] text-[rgba(240,236,227,0.35)]">
                      Дижитал Үндэстний AI нийгэмлэг. AI-г эзэмшиж, хэрэгслээ бүтээж,
                      ирээдүйгээ тодорхойлдог бүтээгчдийн үндэстэн.
                    </p>
                  </div>

                  {/* Links */}
                  <div className="flex gap-12">
                    <div>
                      <div className="mb-3 text-[9px] uppercase tracking-[2px] text-[#00F0FF]">Нийгэмлэг</div>
                      <div className="flex flex-col gap-2">
                        <a href="/members" className="text-[11px] text-[rgba(240,236,227,0.4)] transition hover:text-[#006491]">Гишүүд</a>
                        <a href="/classroom" className="text-[11px] text-[rgba(240,236,227,0.4)] transition hover:text-[#006491]">Хичээл</a>
                        <a href="/clan" className="text-[11px] text-[rgba(240,236,227,0.4)] transition hover:text-[#006491]">Клан</a>
                      </div>
                    </div>
                    <div>
                      <div className="mb-3 text-[9px] uppercase tracking-[2px] text-[#00F0FF]">Холбоос</div>
                      <div className="flex flex-col gap-2">
                        <a href="https://www.instagram.com/tesudei" target="_blank" rel="noopener noreferrer" className="text-[11px] text-[rgba(240,236,227,0.4)] transition hover:text-[#006491]">Instagram</a>
                        <a href="https://www.threads.net/@tesudei" target="_blank" rel="noopener noreferrer" className="text-[11px] text-[rgba(240,236,227,0.4)] transition hover:text-[#006491]">Threads</a>
                        <a href="https://www.facebook.com/tesudei" target="_blank" rel="noopener noreferrer" className="text-[11px] text-[rgba(240,236,227,0.4)] transition hover:text-[#006491]">Facebook</a>
                        <a href="https://www.youtube.com/@tesudei" target="_blank" rel="noopener noreferrer" className="text-[11px] text-[rgba(240,236,227,0.4)] transition hover:text-[#006491]">YouTube</a>
                        <a href="https://www.tiktok.com/@tesudei" target="_blank" rel="noopener noreferrer" className="text-[11px] text-[rgba(240,236,227,0.4)] transition hover:text-[#006491]">TikTok</a>
                      </div>
                    </div>
                  </div>

                  {/* Social icons */}
                  <div>
                    <div className="mb-3 text-[9px] uppercase tracking-[2px] text-[#00F0FF]">Биднийг дага</div>
                    <div className="flex gap-2">
                      {/* Instagram */}
                      <a href="https://www.instagram.com/tesudei" target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 items-center justify-center border border-[rgba(0,240,255,0.15)] text-[rgba(240,236,227,0.4)] transition-all hover:border-[#006491] hover:text-[#006491] hover:shadow-[0_0_10px_rgba(0,100,145,0.3)]">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
                          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                        </svg>
                      </a>
                      {/* Threads */}
                      <a href="https://www.threads.net/@tesudei" target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 items-center justify-center border border-[rgba(0,240,255,0.15)] text-[rgba(240,236,227,0.4)] transition-all hover:border-[#006491] hover:text-[#006491] hover:shadow-[0_0_10px_rgba(0,100,145,0.3)]">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
                          <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.028-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 013.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.308-.883-2.359-.89h-.029c-.803 0-1.539.214-2.185.636l-1.994-.653c.457-1.32 1.181-2.36 2.153-3.096C10.04 6.43 11.13 6 12.354 6h.062c1.732.012 3.107.558 4.087 1.622.957 1.043 1.461 2.555 1.497 4.495l.13.02c1.144.194 2.148.703 2.908 1.477 1.023 1.052 1.555 2.508 1.555 4.221 0 .166-.005.331-.015.494-.137 2.28-1.163 4.07-2.969 5.176C17.987 23.474 15.354 24 12.186 24z"/>
                        </svg>
                      </a>
                      {/* Facebook */}
                      <a href="https://www.facebook.com/tesudei" target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 items-center justify-center border border-[rgba(0,240,255,0.15)] text-[rgba(240,236,227,0.4)] transition-all hover:border-[#006491] hover:text-[#006491] hover:shadow-[0_0_10px_rgba(0,100,145,0.3)]">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
                          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                        </svg>
                      </a>
                      {/* YouTube */}
                      <a href="https://www.youtube.com/@tesudei" target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 items-center justify-center border border-[rgba(0,240,255,0.15)] text-[rgba(240,236,227,0.4)] transition-all hover:border-[#006491] hover:text-[#006491] hover:shadow-[0_0_10px_rgba(0,100,145,0.3)]">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
                          <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                        </svg>
                      </a>
                      {/* TikTok */}
                      <a href="https://www.tiktok.com/@tesudei" target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 items-center justify-center border border-[rgba(0,240,255,0.15)] text-[rgba(240,236,227,0.4)] transition-all hover:border-[#006491] hover:text-[#006491] hover:shadow-[0_0_10px_rgba(0,100,145,0.3)]">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
                          <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0010.86 4.48v-7.15a8.16 8.16 0 005.58 2.17v-3.45c-1.13 0-2.55-.46-3.77-1.3a4.82 4.82 0 01-1.51-1.83h.02V6.69h5.26z"/>
                        </svg>
                      </a>
                    </div>
                  </div>
                </div>

                {/* Bottom bar */}
                <div className="mt-10 flex flex-col items-center gap-4 border-t border-[rgba(0,240,255,0.05)] pt-6 md:flex-row md:justify-between">
                  <div className="text-[10px] tracking-[3px] text-[rgba(240,236,227,0.2)]">
                    МОНГОЛ ҮНДЭС · ДЭЛХИЙН ХҮЧ · 2025–2027
                  </div>
                  <div className="text-[10px] tracking-[2px] text-[rgba(0,240,255,0.2)]">
                    ДИЖИТАЛ ҮНДЭСТЭН БҮТЭЭЖ БАЙНА
                  </div>
                </div>
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
