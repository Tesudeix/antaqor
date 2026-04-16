import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import Navbar from "@/components/Navbar";
import BottomBar from "@/components/BottomBar";
import InstallPrompt from "@/components/InstallPrompt";
import SubscriptionBanner from "@/components/SubscriptionBanner";

export const metadata: Metadata = {
  title: {
    default: "Antaqor",
    template: "%s | Antaqor",
  },
  description:
    "Дижитал Үндэстний нийгэмлэг. AI-г эзэмшиж, хэрэгслээ бүтээж, ирээдүйгээ тодорхойлдог бүтээгчдийн үндэстэн.",
  keywords: [
    "Antaqor",
    "Дижитал Үндэстэн",
    "AI",
    "Монгол бүтээгчид",
    "нийгэмлэг",
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
    title: "Antaqor",
    description:
      "Дижитал Үндэстний нийгэмлэг. AI-г эзэмшиж, хэрэгслээ бүтээж, ирээдүйгээ тодорхойлдог бүтээгчдийн үндэстэн.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Antaqor",
    description:
      "Дижитал Үндэстний нийгэмлэг.",
    creator: "@antaqor",
  },
  robots: {
    index: true,
    follow: true,
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
          href="https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <meta name="theme-color" content="#FFFF01" />
      </head>
      <body>
        <Providers>
          <SubscriptionBanner />
          <Navbar />
          <main className="w-full px-4 pb-24 pt-8 sm:px-6 md:px-8 md:pb-12 lg:px-12">
            {children}
          </main>
          <BottomBar />
          <InstallPrompt />
        </Providers>
      </body>
    </html>
  );
}
