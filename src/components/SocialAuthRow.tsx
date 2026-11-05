"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

/* ─── Гуравдагч этгээдээр нэвтрэх мөр ──────────────────────────────────────
   Нууц үгийн маягтын доор зэрэгцсэн брэндийн товчнууд. Нэг тодорхойлолт,
   хоёр гадаргуу: AuthModal (цонх) ба LoginCard (/auth/signin). AuthField
   яагаад нэг файлд төвлөрсөнтэй яг ижил шалтгаан — гурван газарт хуулбал
   тэр даруйдаа зөрж эхэлнэ.

   ─ Яагаад redirect биш, ТОКЕН загвар вэ ─
   NextAuth-ийн бэлэн OAuth провайдерууд `NEXTAUTH_URL`-ийн НЭГ домэйн рүү
   буцдаг. Энэ апп antaqor.com ба tesudeix.com ХОЁУЛАНГ нь үйлчилдэг тул
   тэр загвар нэг домэйны хэрэглэгчийг нөгөө рүү нь шидэх байлаа. Провайдер
   бүрийн JS нь токен өгч, серверийн тал (src/lib/auth.ts) түүнийг шалгах
   загвар нь хаанаас дуудсанаас хамаардаггүй.

   ─ Яагаад mount дээр урьдчилж ачаалдаг вэ ─
   Google, Facebook хоёулаа POPUP нээдэг. Popup нь хүний товшилтын ШУУД
   үргэлжлэл байх ёстой: товшсоны дараа скрипт ачаалахыг хүлээгээд дуудвал
   браузер түүнийг зар сурталчилгаа гэж үзээд хаана. Тиймээс SDK-г урьдчилж
   ачаалж, товшилт нь зөвхөн бэлэн клиентийг дуудна. */

type Busy = "google" | "facebook" | null;

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
/* 2026-10-11: Facebook-ээр нэвтрэх ХАСАГДАВ (эзний хүсэлт). Хэн ч ашиглаж
   байгаагүй (facebookId-тай хэрэглэгч 0). undefined → товч гарахгүй, FB SDK
   ачаалагдахгүй. Буцаах: доорх мөрийг process.env.NEXT_PUBLIC_FACEBOOK_APP_ID
   болго. Админы "Facebook-ээр холбох" (Page холболт) нь ТУСДАА — хөндөөгүй. */
const FACEBOOK_APP_ID: string | undefined = undefined;

/* Google Identity Services / Facebook JS SDK-г ТУХАЙН хуудсанд нэг л удаа
   ачаална. `GoogleSignInButton` мөн `gsi-client-script` гэсэн ижил id
   ашигладаг — санаатай: хоёулаа зэрэг байсан ч скрипт хоёр удаа орохгүй. */
function loadScript(id: string, src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === "undefined") return;
    const existing = document.getElementById(id) as HTMLScriptElement | null;
    if (existing) {
      if (existing.dataset.loaded === "1") resolve();
      else {
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", () => reject(new Error(src)));
      }
      return;
    }
    const el = document.createElement("script");
    el.id = id;
    el.src = src;
    el.async = true;
    el.onload = () => {
      el.dataset.loaded = "1";
      resolve();
    };
    el.onerror = () => reject(new Error(src));
    document.head.appendChild(el);
  });
}

/* SDK-уудын бидний хэрэглэдэг хэсэг. `declare global` ЗОРИУДААР ашиглаагүй:
   `GoogleSignInButton` аль хэдийн `Window.google`-ийг өөрийн хэлбэрээр
   зарласан бөгөөд нэг шинжийг хоёр өөр хэлбэрээр зарлах нь TS алдаа. */
type GoogleTokenClient = { requestAccessToken: () => void };
type GoogleOAuth2 = {
  initTokenClient: (config: {
    client_id: string;
    scope: string;
    callback: (resp: { access_token?: string; error?: string }) => void;
    error_callback?: (err: unknown) => void;
  }) => GoogleTokenClient;
};
type FacebookSdk = {
  init: (config: { appId: string; cookie?: boolean; xfbml?: boolean; version: string }) => void;
  login: (
    cb: (resp: { authResponse?: { accessToken?: string } | null; status?: string }) => void,
    opts: { scope: string }
  ) => void;
};

export default function SocialAuthRow({
  next = "/",
  onSuccess,
  label = "эсвэл",
}: {
  next?: string;
  onSuccess?: () => void;
  label?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState("");
  const googleClient = useRef<GoogleTokenClient | null>(null);
  const fbReady = useRef(false);
  /* Компонент салсны дараа setState дуудахгүй — цонх нь нэвтэрсэн даруйд
     хаагддаг тул энэ нь онолын биш, тохиолдох зам. */
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const finish = useCallback(
    async (provider: "google-token" | "facebook-token", accessToken: string) => {
      const res = await signIn(provider, { accessToken, redirect: false });
      if (!alive.current) return;
      if (res?.ok) {
        if (onSuccess) onSuccess();
        else {
          router.push(next);
          router.refresh();
        }
        return;
      }
      setError(res?.error || "Нэвтрэлт амжилтгүй боллоо");
      setBusy(null);
    },
    [next, onSuccess, router]
  );

  /* ── Google: mount дээр токен клиент бэлдэнэ ── */
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    let cancelled = false;
    loadScript("gsi-client-script", "https://accounts.google.com/gsi/client")
      .then(() => {
        if (cancelled) return;
        const oauth2 = (window as unknown as { google?: { accounts?: { oauth2?: GoogleOAuth2 } } })
          .google?.accounts?.oauth2;
        if (!oauth2) return;
        googleClient.current = oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: "openid email profile",
          callback: (resp) => {
            if (!resp.access_token) {
              if (alive.current) setBusy(null);
              return;
            }
            void finish("google-token", resp.access_token);
          },
          /* Хүн popup-аа хаасан ч энэ дуудагдана — товчийг мөнхөд
             "ачаалж байна" төлөвт үлдээхгүйн тулд заавал барина. */
          error_callback: () => {
            if (alive.current) setBusy(null);
          },
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [finish]);

  /* ── Facebook: mount дээр SDK-г ачаалж эхлүүлнэ ── */
  useEffect(() => {
    if (!FACEBOOK_APP_ID) return;
    let cancelled = false;
    loadScript("facebook-jssdk", "https://connect.facebook.net/en_US/sdk.js")
      .then(() => {
        if (cancelled) return;
        const FB = (window as unknown as { FB?: FacebookSdk }).FB;
        if (!FB) return;
        /* `cookie: false` — сессийг NextAuth барина. FB-ийн өөрийн күүки
           энд ямар ч үүрэггүй атал гуравдагч талын күүки нэмнэ. */
        FB.init({ appId: FACEBOOK_APP_ID, cookie: false, xfbml: false, version: "v21.0" });
        fbReady.current = true;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const onGoogle = useCallback(() => {
    setError("");
    if (!googleClient.current) {
      setError("Google ачаалж дуусаагүй байна. Хормын дараа дахин оролдоно уу.");
      return;
    }
    setBusy("google");
    googleClient.current.requestAccessToken();
  }, []);

  const onFacebook = useCallback(() => {
    setError("");
    const FB = (window as unknown as { FB?: FacebookSdk }).FB;
    if (!FB || !fbReady.current) {
      setError("Facebook ачаалж дуусаагүй байна. Хормын дараа дахин оролдоно уу.");
      return;
    }
    setBusy("facebook");
    FB.login(
      (resp) => {
        const token = resp.authResponse?.accessToken;
        if (!token) {
          /* Цуцалсан нь алдаа биш — чимээгүй буцаана. */
          if (alive.current) setBusy(null);
          return;
        }
        void finish("facebook-token", token);
      },
      { scope: "public_profile,email" }
    );
  }, [finish]);

  /* Товчнуудыг массив болгож `.filter`-дэхгүй, ШУУД JSX-ээр бичсэн нь
     санаатай: onClick нь ref барьдаг тул тэдгээрийг рендерийн явцад
     функц рүү дамжуулах нь `react-hooks/refs`-ийг зөрчинө (мөн жинхэнэ
     утгаараа — рендерийн үед ref уншихыг урьдчилан хориглосон дүрэм). */
  const showFacebook = Boolean(FACEBOOK_APP_ID);
  const showGoogle = Boolean(GOOGLE_CLIENT_ID);

  /* Аль ч провайдер тохируулагдаагүй бол ЮУ Ч ГАРАХГҮЙ — "эсвэл" гэсэн
     хуваагч нь салгах зүйлгүй бол утгагүй мөр. */
  if (!showFacebook && !showGoogle) return null;

  return (
    /* .social-auth: trader.antaqor.com дээр нуугдана — Google OAuth client тэр origin-г зөвшөөрөөгүй (origin_mismatch) */
    <div className="social-auth mt-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="h-px flex-1 bg-[rgba(255,255,255,0.10)]" />
        <span className="text-[11px] text-[#E2E4E8]">{label}</span>
        <span className="h-px flex-1 bg-[rgba(255,255,255,0.10)]" />
      </div>

      <div className="flex gap-2">
        {showFacebook && (
          <button
            type="button"
            onClick={onFacebook}
            disabled={busy !== null}
            aria-label="Facebook-ээр нэвтрэх"
            title="Facebook-ээр нэвтрэх"
            className="flex h-12 flex-1 items-center justify-center rounded-[4px] bg-[#1877F2] transition hover:bg-[#3B8CF4] disabled:opacity-50"
          >
            {busy === "facebook" ? <Spinner tone="brand" /> : <FacebookLogo />}
          </button>
        )}
        {/* Google-ийн журам цагаан дэвсгэрийг санал болгодог ч энэ сайт дээр
            `bg-white` нь ХОЁУЛАНГ нь эвдэнэ: гэрэл давхарга түүнийг огт
            хөрвүүлдэггүй тул цагаан карт дээр цагаан товч алга болно, шөнийн
            давхарга нь #0A0A0A болгож дардаг (globals.css). `#1E1E1E` нь энэ
            баазын хос-горимын гадаргуу — гэрэлд #EEEBE7, шөнөд #1E1E1E болж
            хоёуланд нь ХАРАГДАНА (AuthField-ийн талбарууд ч мөн адил).
            Дөрвөн өнгийн "G" нь хоёр дэвсгэр дээр зөв уншигдана. */}
        {showGoogle && (
          <button
            type="button"
            onClick={onGoogle}
            disabled={busy !== null}
            aria-label="Google-ээр нэвтрэх"
            title="Google-ээр нэвтрэх"
            className="flex h-12 flex-1 items-center justify-center rounded-[4px] bg-[#1E1E1E] transition hover:bg-[#2C2C31] disabled:opacity-50"
          >
            {busy === "google" ? <Spinner tone="neutral" /> : <GoogleLogo />}
          </button>
        )}
      </div>

      {error && (
        <p className="mt-3 text-center text-[12px] leading-snug text-[#FFB4AE]">{error}</p>
      )}
    </div>
  );
}

/* ─── Брэндийн тэмдгүүд ────────────────────────────────────────────────────
   Дүрсийг Icon.tsx-д биш ЭНД байлгасан: Google-ийн "G" нь дөрвөн өнгөтэй,
   Facebook-ийн "f" нь цагаан байх ёстой гэж тэдний брэндийн журам заадаг.
   Icon.tsx нь сэдвийн өнгийг дагадаг нэг өнгийн дүрсийн сан — эдгээрийг
   тэнд оруулбал тэр зарчмыг эвдэнэ. */

function FacebookLogo() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#FFFFFF"
        d="M14.5 8.5V6.9c0-.72.16-1.08 1.27-1.08h1.4V3.11A19.6 19.6 0 0 0 15.1 3c-2.08 0-3.5 1.27-3.5 3.6v1.9H9.3v2.9h2.3V21h2.9v-9.6h2.36l.35-2.9H14.5Z"
      />
    </svg>
  );
}

function GoogleLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M45.1 24.5c0-1.6-.1-2.8-.4-4.1H24v7.4h11.9c-.2 2-1.5 5-4.4 7l-.1.3 6.4 4.9.4.1c4.1-3.8 6.5-9.3 6.5-15.6"
      />
      <path
        fill="#34A853"
        d="M24 46c5.8 0 10.7-1.9 14.3-5.2l-6.8-5.3c-1.8 1.3-4.3 2.2-7.5 2.2-5.7 0-10.6-3.8-12.3-9l-.3.1-6.6 5.1-.1.3C8.2 41 15.5 46 24 46"
      />
      <path
        fill="#FBBC05"
        d="M11.7 28.7c-.5-1.3-.7-2.8-.7-4.2 0-1.5.3-2.9.7-4.2v-.4l-6.7-5.2-.2.1A22 22 0 0 0 2 24.5c0 3.6.9 6.9 2.8 10.1l6.9-5.9"
      />
      <path
        fill="#EB4335"
        d="M24 11.3c4 0 6.8 1.7 8.3 3.2l6.1-5.9C34.6 5 29.8 3 24 3 15.5 3 8.2 8 4.8 14.4l6.9 5.9c1.7-5.2 6.6-9 12.3-9"
      />
    </svg>
  );
}

function Spinner({ tone }: { tone: "brand" | "neutral" }) {
  return (
    <span
      className={`h-4 w-4 animate-spin rounded-full border-2 border-transparent ${
        tone === "brand" ? "border-t-white" : "border-t-[#9AA0A6]"
      }`}
    />
  );
}
