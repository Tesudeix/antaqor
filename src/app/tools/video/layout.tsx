import Link from "next/link";
import { AI_VIDEO_ENABLED } from "@/lib/flags";

/* AI видео студийн хаалга. page.tsx нь "use client" тул тугийг энд — сервер
   талд — шалгана: хаалттай үед студийн код огт ачаалагдахгүй, хуучин
   холбоосоор орж ирсэн хүн хоосон дэлгэц биш ойлгомжтой мэдэгдэл харна. */
export default function VideoToolLayout({ children }: { children: React.ReactNode }) {
  if (AI_VIDEO_ENABLED) return <>{children}</>;
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#2E29FF]">AI видео</div>
      <h1 className="mt-2 text-[22px] font-extrabold text-[var(--nav-fg-strong)]">Түр хаалттай байна</h1>
      <p className="mt-2 text-[14px] leading-relaxed text-[#E2E4E8]">
        Видео үүсгэх боломжийг түр зогсоосон. Удахгүй эргэн нээгдэнэ.
      </p>
      <Link
        href="/"
        className="press mt-6 inline-flex h-11 items-center rounded-[4px] bg-[#2E29FF] px-6 text-[14px] font-bold text-white transition hover:bg-[#1F1AD9]"
      >
        Нүүр хуудас руу
      </Link>
    </main>
  );
}
