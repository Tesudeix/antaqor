import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import Navbar from "@/components/Navbar";
import BottomBar from "@/components/BottomBar";
import InstallPrompt from "@/components/InstallPrompt";
import PostFAB from "@/components/PostFAB";

export const metadata: Metadata = {
  title: {
    default: "ANTAQOR — Mongolia's #1 AI Community & Cyber Empire",
    template: "%s | ANTAQOR",
  },
  description:
    "Монголын хамгийн том AI нийгэмлэг. AI сурах, бүтээх, хэрэгслээ хөгжүүлэх — бүтээгчид, инженерүүд, антрепренёруудын нэгдсэн платформ. Mongolia's largest AI community for creators, engineers & entrepreneurs.",
  keywords: [
    "AI community Mongolia",
    "Antaqor",
    "Монгол AI",
    "AI нийгэмлэг",
    "artificial intelligence Mongolia",
    "AI сургалт",
    "AI курс Монгол",
    "machine learning Mongolia",
    "Монгол бүтээгчид",
    "Cyber Empire",
    "AI хэрэгсэл",
    "tech community Mongolia",
    "startup Mongolia",
    "AI education",
    "Монгол программистууд",
  ],
  authors: [{ name: "Antaqor" }],
  creator: "Antaqor",
  publisher: "Antaqor",
  manifest: "/manifest.json",
  metadataBase: new URL("https://antaqor.com"),
  alternates: { canonical: "/" },
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon.png", sizes: "any", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    type: "website",
    locale: "mn_MN",
    url: "https://antaqor.com",
    siteName: "ANTAQOR",
    title: "ANTAQOR — Mongolia's #1 AI Community",
    description:
      "Монголын хамгийн том AI нийгэмлэг. AI сурах, бүтээх, хамтдаа хөгжих — бүтээгчид, инженерүүд, антрепренёруудын платформ. Join Mongolia's largest AI community.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "ANTAQOR — Mongolia AI Community",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ANTAQOR — Mongolia's #1 AI Community",
    description: "Монголын хамгийн том AI нийгэмлэг. AI сурах, бүтээх, хамтдаа хөгжих платформ.",
    creator: "@antaqor",
    images: ["/opengraph-image"],
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
  verification: {},
  category: "technology",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ANTAQOR",
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
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <meta name="theme-color" content="#0A0A0A" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className="bg-[#0A0A0A] text-[#E8E8E8]">
        <Providers>
          <Navbar />
          <main className="min-h-screen w-full px-4 pb-28 pt-6 sm:px-6 md:px-8 md:pb-12 lg:px-12">
            {children}
          </main>
          <BottomBar />
          <PostFAB />
          <InstallPrompt />
        </Providers>
      </body>
    </html>
  );
}
