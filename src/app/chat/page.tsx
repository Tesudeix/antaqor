import type { Metadata } from "next";
import Link from "next/link";

const TELEGRAM_URL = "https://t.me/+s_lMH8HmpCM0YWRl";

export const metadata: Metadata = {
  title: "Чат · Telegram",
  description: "Antaqor-ын AI community чат — Telegram дээр.",
  alternates: { canonical: "/chat" },
  // Hidden from search — the real chat lives on Telegram, no value indexing this handoff.
  robots: { index: false, follow: true },
  openGraph: {
    title: "Antaqor · Telegram community",
    description: "AI бүтээгчдийн real-time чат — Telegram дээр.",
    url: "/chat",
  },
};

export default function ChatHandoffPage() {
  return (
    <>
      {/* No-JS fallback: meta refresh after 1.5s. JS path below is faster. */}
      <meta httpEquiv="refresh" content={`1; url=${TELEGRAM_URL}`} />

      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4">
        <div className="w-full rounded-[12px] border border-[rgba(255,255,255,0.08)] bg-[#111] p-6 text-center md:p-8">
          {/* Telegram mark */}
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#2AABEE] to-[#229ED9] shadow-[0_0_40px_rgba(42,171,238,0.25)]">
            <svg className="h-8 w-8 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21.198 2.433a2.242 2.242 0 00-1.022.215l-16.5 7.5a2.25 2.25 0 00.126 4.147l4.012 1.484 1.48 4.012a2.25 2.25 0 004.148.126l7.5-16.5a2.25 2.25 0 00-.217-2.022 2.25 2.25 0 00-1.527-.962zM17.8 7.2L9.6 15.4l-.8-2.2 9.6-5.6zm-7.4 8.2l5.6-9.6-2.2-.8L6.6 14.2l3.8 1.2z" />
            </svg>
          </div>

          <div className="text-[10px] font-bold tracking-[0.2em] text-[#2AABEE]">TELEGRAM</div>
          <h1 className="mt-2 text-[22px] font-black leading-tight text-[#E8E8E8] md:text-[26px]">
            Antaqor community чат
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-[#888]">
            AI бүтээгчид, инженерүүд, антрепренёрууд — Telegram дээр шууд ярилцаж, туршлага хуваалцдаг.
          </p>

          <a
            href={TELEGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative mt-6 inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-[10px] bg-[#2AABEE] px-6 py-3.5 text-[14px] font-black text-white shadow-[0_0_32px_rgba(42,171,238,0.25)] transition hover:shadow-[0_0_48px_rgba(42,171,238,0.4)]"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21.198 2.433a2.242 2.242 0 00-1.022.215l-16.5 7.5a2.25 2.25 0 00.126 4.147l4.012 1.484 1.48 4.012a2.25 2.25 0 004.148.126l7.5-16.5a2.25 2.25 0 00-.217-2.022 2.25 2.25 0 00-1.527-.962z" />
            </svg>
            <span className="relative z-10">Telegram нээх</span>
            <svg className="relative z-10 h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
          </a>

          <p className="mt-4 text-[11px] text-[#555]">
            Хэрэв автоматаар нээгдэхгүй бол дээрх товчийг дарна уу.
          </p>

          <div className="mt-5 flex items-center gap-2 border-t border-[rgba(255,255,255,0.06)] pt-5 text-[11px]">
            <div className="flex-1 text-left text-[#666]">
              <div className="font-semibold text-[#AAA]">Telegram байхгүй?</div>
              <div>Утасныхаа store-оос татаж ав — үнэгүй</div>
            </div>
            <div className="flex gap-2">
              <a href="https://apps.apple.com/app/telegram-messenger/id686449807" target="_blank" rel="noopener noreferrer"
                className="rounded-[6px] border border-[rgba(255,255,255,0.08)] px-2.5 py-1.5 text-[10px] font-bold text-[#AAA] transition hover:border-[rgba(42,171,238,0.4)] hover:text-[#2AABEE]">iOS</a>
              <a href="https://play.google.com/store/apps/details?id=org.telegram.messenger" target="_blank" rel="noopener noreferrer"
                className="rounded-[6px] border border-[rgba(255,255,255,0.08)] px-2.5 py-1.5 text-[10px] font-bold text-[#AAA] transition hover:border-[rgba(42,171,238,0.4)] hover:text-[#2AABEE]">Android</a>
            </div>
          </div>
        </div>

        <Link href="/" className="mt-5 text-[11px] font-semibold text-[#555] transition hover:text-[#EF2C58]">
          ← Нүүр хуудас
        </Link>
      </div>

      {/* Auto-redirect (faster than meta refresh when JS is on) */}
      <script
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: `
            (function(){
              var u = ${JSON.stringify(TELEGRAM_URL)};
              try {
                var w = window.open(u, "_blank", "noopener");
                if (w) {
                  // Best-effort: after handing off, nudge this tab back to home so user isn't stuck on splash.
                  setTimeout(function(){ try { window.location.replace("/"); } catch(e){} }, 800);
                }
                // If popup was blocked (w is null), leave the branded manual button visible.
                // Meta refresh will still kick in as fallback.
              } catch (e) {
                window.location.replace(u);
              }
            })();
          `,
        }}
      />
    </>
  );
}
