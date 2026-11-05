import Link from "next/link";

/* Ширээн дээр яриа сонгоогүй үеийн баруун багана — Instagram-ын
   "Keep it real in direct messages" төлөв. Утсан дээр харагдахгүй
   (ChatShell /chat-д энэ баганыг нуудаг). */
export default function ChatEmpty() {
  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <span
        className="flex h-24 w-24 items-center justify-center rounded-full"
        style={{ background: "var(--nav-hover-bg, #FFFFFF)" }}
      >
        <svg viewBox="0 0 24 24" className="h-10 w-10 text-[var(--nav-fg-strong)]" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" aria-hidden>
          <path d="M21 3L10 14M21 3l-7 18-4-7-7-4z" />
        </svg>
      </span>
      <h2 className="mt-5 text-[20px] font-bold text-[var(--nav-fg-strong)]">Шууд мессеж</h2>
      <p className="mt-1.5 max-w-[340px] text-[14.5px] text-[var(--t-sub,#9C9CA6)]">
        Гишүүдтэй ярилц, санаа хуваалц, хамтдаа бүтээ.
      </p>
      <Link
        href="/members"
        className="press mt-5 inline-flex h-10 items-center rounded-[4px] bg-[#2E29FF] px-5 text-[14px] font-bold text-white transition hover:bg-[#1F1AD9]"
      >
        Шинэ мессеж
      </Link>
    </div>
  );
}
