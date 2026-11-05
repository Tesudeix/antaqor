import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import { initializeReferral } from "@/lib/credits";

// Verifies the short-lived HMAC token issued by /api/webauthn/authenticate/verify.
// Format: `userId.expMs.sigBase64Url`.
function verifyPasskeyToken(token: string): string | null {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, expStr, sig] = parts;
  const exp = parseInt(expStr, 10);
  if (!Number.isFinite(exp) || Date.now() > exp) return null;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${userId}.${expStr}`)
    .digest("base64url");
  // Constant-time compare to avoid timing attacks.
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  return crypto.timingSafeEqual(a, b) ? userId : null;
}

/* ─── Гуравдагч этгээдийн нэвтрэлт: бүртгэл олох / үүсгэх ──────────────────
   Google ба Facebook ЯГ нэг замаар ордог тул шийдвэр нэг л газар байна.

   Хайлтын дараалал нь санаатай:
     1. провайдерын ID — хамгийн бат холбоос. Хүн Google дээрх имэйлээ
        сольсон ч энэ тоо хэвээр тул бүртгэл нь дагаж олдоно.
     2. имэйл — өмнө нь нууц үгээр бүртгүүлсэн хүн ӨНӨӨДӨР эхлээд Google-ээр
        орж байна. Шинэ бүртгэл үүсгэх нь буруу: XP, пост, захиалга нь
        хуучин бүртгэл дээр үлдэнэ. Тиймээс провайдерын ID-г ХУУЧИН бүртгэл
        дээр наана — нэг хүн нэг бүртгэлтэй хэвээр.
     3. аль нь ч олдоогүй бол шинээр үүсгэнэ.

   Имэйл нь БАТАЛГААЖСАН байх ёстой (дуудагч тал шалгана). Баталгаажаагүй
   имэйлээр холбовол хэн ч бусдын имэйлээр провайдер дээр бүртгэл нээгээд
   энд байгаа бүртгэлийг булаах боломжтой болно. */
async function findOrCreateSocialUser(profile: {
  provider: "google" | "facebook";
  providerId: string;
  email: string;
  name?: string;
  picture?: string;
}) {
  await dbConnect();
  const isGoogle = profile.provider === "google";
  const email = profile.email.trim().toLowerCase();

  let user = await User.findOne(
    isGoogle ? { googleId: profile.providerId } : { facebookId: profile.providerId }
  );

  if (!user) {
    user = await User.findOne({ email });
    if (user) {
      if (isGoogle) user.googleId = profile.providerId;
      else user.facebookId = profile.providerId;
      /* Аватарыг ЗӨВХӨН хоосон үед авна — өөрөө зураг тавьсан хүний
         сонголтыг провайдерын хуучин зургаар дарж болохгүй. */
      if (!user.avatar && profile.picture) user.avatar = profile.picture;
      await user.save();
    }
  }

  if (!user) {
    const base =
      (email.split("@")[0] || profile.provider).replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20) ||
      profile.provider;
    let username = base.toLowerCase();
    for (let i = 0; i < 6 && (await User.findOne({ username })); i++) {
      username = `${base.toLowerCase()}${Math.floor(1000 + Math.random() * 9000)}`;
    }
    /* Схем нь нууц үгийг заавал шаардана. Санамсаргүй утгыг hash-даж тавина:
       хэн ч мэдэхгүй тул нууц үгээр орох гарц ХААЛТТАЙ. Хүн хүсвэл "нууц үг
       мартсан"-аар өөрөө шинийг тавьж, хоёр замаар нэвтрэх болно. */
    const randomPassword = await bcrypt.hash(crypto.randomBytes(24).toString("hex"), 10);
    user = await User.create({
      name: profile.name || base,
      username,
      email,
      password: randomPassword,
      avatar: profile.picture || "",
      googleId: isGoogle ? profile.providerId : undefined,
      facebookId: isGoogle ? undefined : profile.providerId,
    });

    /* Нууц үгээр бүртгүүлсэн хүн /api/auth/signup дээр угтах урамшуулал ба
       өөрийн урилгын код авдаг. Google/Facebook-ээр орсон хүн ЯГ адилхан
       шинэ гишүүн — тэр алхмыг алгасвал нэвтрэх аргаасаа болоод эрхээрээ
       ялгаатай хоёр төрлийн гишүүн үүснэ. Урилгын код энд байхгүй (сошиал
       товч түүнийг дамжуулдаггүй) тул `null`.

       signup-тай ижил зарчмаар алдааг залгина: урамшуулал өгөгдөөгүйгээс
       болж нэвтрэлт өөрөө унах ёсгүй. */
    await initializeReferral(String(user._id), null).catch(() => null);
  }

  if (user.banned) {
    throw new Error("Таны бүртгэл хаагдсан байна");
  }

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    image: user.avatar,
  };
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        login: { label: "Email or Username", type: "text" },
        password: { label: "Password", type: "password" },
        // Passwordless re-login: a short-lived HMAC token issued after a
        // successful WebAuthn (Face ID / Touch ID / passkey) verification.
        passkeyToken: { label: "Passkey Token", type: "text" },
      },
      async authorize(credentials) {
        await dbConnect();

        // ── Passkey path ────────────────────────────────────────────────
        const passkeyToken = (credentials as Record<string, string> | undefined)?.passkeyToken;
        if (passkeyToken) {
          const userId = verifyPasskeyToken(passkeyToken);
          if (!userId) {
            throw new Error("Passkey токен хүчингүй");
          }
          const user = await User.findById(userId);
          if (!user) {
            throw new Error("Бүртгэл олдсонгүй");
          }
          return {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            image: user.avatar,
          };
        }

        // ── Password path (existing) ─────────────────────────────────────
        const login = credentials?.login || (credentials as Record<string, string>)?.email;
        if (!login || !credentials?.password) {
          throw new Error("Имэйл/хэрэглэгчийн нэр болон нууц үг шаардлагатай");
        }

        const isEmail = login.includes("@");
        let user;
        if (isEmail) {
          user = await User.findOne({ email: login.toLowerCase() });
        } else {
          // Username login (primary) — also tolerate legacy phone logins.
          // Strip a leading @ and lowercase for the username match; keep the
          // raw + digits-only variants for phone.
          const handle = login.trim().toLowerCase().replace(/^@+/, "");
          const digits = login.replace(/\D/g, "");
          const or: Record<string, string>[] = [{ username: handle }, { phone: login }];
          if (digits.length >= 6) or.push({ phone: digits });
          user = await User.findOne({ $or: or });
        }
        if (!user) {
          throw new Error("Бүртгэл олдсонгүй");
        }

        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) {
          throw new Error("Нууц үг буруу байна");
        }

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          image: user.avatar,
        };
      },
    }),
    // Google Identity Services sign-in: the client-side GIS button returns an
    // ID token which we verify against Google (aud must match our client id).
    // Works with only GOOGLE_CLIENT_ID — no OAuth client secret required.
    CredentialsProvider({
      id: "google-idtoken",
      name: "Google",
      credentials: {
        idToken: { label: "ID Token", type: "text" },
      },
      async authorize(credentials) {
        const idToken = (credentials as Record<string, string> | undefined)?.idToken;
        const clientId = process.env.GOOGLE_CLIENT_ID;
        if (!idToken || !clientId) {
          throw new Error("Google нэвтрэлт тохируулагдаагүй");
        }
        const res = await fetch(
          `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
        );
        if (!res.ok) {
          throw new Error("Google токен хүчингүй");
        }
        const payload = (await res.json()) as Record<string, string>;
        if (payload.aud !== clientId || payload.email_verified !== "true" || !payload.email) {
          throw new Error("Google токен хүчингүй");
        }

        await dbConnect();
        const email = payload.email.toLowerCase();
        let user = await User.findOne({ email });
        if (!user) {
          const base =
            (email.split("@")[0] || "user").replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20) || "user";
          let username = base;
          for (let i = 0; i < 6 && (await User.findOne({ username })); i++) {
            username = `${base}${Math.floor(1000 + Math.random() * 9000)}`;
          }
          const randomPassword = await bcrypt.hash(crypto.randomBytes(24).toString("hex"), 10);
          user = await User.create({
            name: payload.name || base,
            username: username.toLowerCase(),
            email,
            password: randomPassword,
            avatar: payload.picture || "",
          });
        }
        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          image: user.avatar,
        };
      },
    }),
    /* ─── Google — САЙТЫН ӨӨРИЙН ТОВЧ ───────────────────────────────────
       Дээрх `google-idtoken` нь Google-ийн ӨӨРИЙНХ нь зурсан товчноос
       (GIS `renderButton`) ирдэг ID токеныг авдаг. Тэр товч нь iframe тул
       өргөнөө өөрөө тогтоодог — брэндийн товчнууд зэрэгцсэн мөрөнд багтахгүй.

       Энэ provider нь ХАРИН `initTokenClient`-ээс ирэх ACCESS токен авна:
       товчийг бид өөрсдөө зурж, Google нь зөвхөн popup-аа нээнэ. Хуучин нь
       УСТААГҮЙ — хоёр гадаргуу зэрэг ажиллана. */
    CredentialsProvider({
      id: "google-token",
      name: "Google",
      credentials: {
        accessToken: { label: "Access Token", type: "text" },
      },
      async authorize(credentials) {
        const accessToken = (credentials as Record<string, string> | undefined)?.accessToken;
        const clientId = process.env.GOOGLE_CLIENT_ID;
        if (!accessToken || !clientId) {
          throw new Error("Google нэвтрэлт тохируулагдаагүй");
        }

        /* `aud` шалгах нь энэ хамгаалалтын ГОЛ ЦӨМ. Google-ийн ЯМАР Ч апп
           хүчинтэй access токен гаргаж чадна; `aud` нь тухайн токеныг
           МАНАЙ апп-д зориулж олгосныг л батална. Үүнийг алгасвал өөр
           аппын токеноор энд нэвтрэх боломжтой болно. */
        const infoRes = await fetch(
          `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`
        );
        if (!infoRes.ok) {
          throw new Error("Google токен хүчингүй");
        }
        const tokenInfo = (await infoRes.json()) as Record<string, string>;
        if (tokenInfo.aud !== clientId) {
          throw new Error("Google токен хүчингүй");
        }

        const meRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!meRes.ok) {
          throw new Error("Google мэдээлэл авч чадсангүй");
        }
        const me = (await meRes.json()) as Record<string, unknown>;
        const email = typeof me.email === "string" ? me.email : "";
        if (!email || me.email_verified !== true) {
          throw new Error("Google имэйл баталгаажаагүй байна");
        }

        return findOrCreateSocialUser({
          provider: "google",
          providerId: String(me.sub),
          email,
          name: typeof me.name === "string" ? me.name : undefined,
          picture: typeof me.picture === "string" ? me.picture : undefined,
        });
      },
    }),
    /* ─── Facebook ───────────────────────────────────────────────────────
       NextAuth-ийн бэлэн `FacebookProvider` (redirect flow) ЗОРИУДААР
       ашиглаагүй: тэр нь `NEXTAUTH_URL`-ийн НЭГ домэйн рүү буцдаг атал
       энэ апп antaqor.com, tesudeix.com ХОЁУЛАНГ нь үйлчилдэг — antaqor.com
       дээрээс Facebook-ээр орсон хүн tesudeix.com дээр гарч ирнэ.
       Токен шалгах загвар нь домэйноос хамаардаггүй тул хоёуланд нь зөв.

       Токеныг Facebook-ийн ӨӨРИЙНХ нь `debug_token`-оор шалгана: `is_valid`
       нь токен амьд эсэхийг, `app_id` нь МАНАЙ апп-д олгогдсоныг батална
       (Google дээрх `aud`-тай яг ижил үүрэг). */
    CredentialsProvider({
      id: "facebook-token",
      name: "Facebook",
      credentials: {
        accessToken: { label: "Access Token", type: "text" },
      },
      async authorize(credentials) {
        const accessToken = (credentials as Record<string, string> | undefined)?.accessToken;
        const appId = process.env.FACEBOOK_APP_ID || process.env.META_FB_APP_ID;
        const appSecret = process.env.FACEBOOK_APP_SECRET || process.env.META_FB_APP_SECRET;
        if (!accessToken || !appId || !appSecret) {
          throw new Error("Facebook нэвтрэлт тохируулагдаагүй");
        }

        const dbgRes = await fetch(
          `https://graph.facebook.com/v21.0/debug_token` +
            `?input_token=${encodeURIComponent(accessToken)}` +
            `&access_token=${encodeURIComponent(`${appId}|${appSecret}`)}`
        );
        if (!dbgRes.ok) {
          throw new Error("Facebook токен хүчингүй");
        }
        const dbg = (await dbgRes.json()) as { data?: Record<string, unknown> };
        const data = dbg.data || {};
        if (data.is_valid !== true || String(data.app_id) !== String(appId)) {
          throw new Error("Facebook токен хүчингүй");
        }

        const meRes = await fetch(
          `https://graph.facebook.com/v21.0/me` +
            `?fields=id,name,email,picture.type(large)` +
            `&access_token=${encodeURIComponent(accessToken)}`
        );
        if (!meRes.ok) {
          throw new Error("Facebook мэдээлэл авч чадсангүй");
        }
        const me = (await meRes.json()) as Record<string, unknown>;
        /* `debug_token`-ы эзэн ба `/me`-ийн буцаасан хүн ИЖИЛ байх ёстой —
           хоёр дуудлагын хооронд токен солигдох боломжийг хаана. */
        if (!me.id || String(me.id) !== String(data.user_id)) {
          throw new Error("Facebook токен хүчингүй");
        }

        const email = typeof me.email === "string" ? me.email.trim() : "";
        /* Facebook имэйлийг ҮРГЭЛЖ өгдөггүй: хүн зөвшөөрлийг нь салгасан,
           эсвэл зөвхөн утасны дугаараар бүртгүүлсэн байж болно. Ийм үед
           хуурамч имэйл зохиож бүртгэл үүсгэвэл тэр хүн нууц үгээ хэзээ ч
           сэргээж чадахгүй болно — тиймээс шууд хэлж, өөр замаар оруулна. */
        if (!email) {
          throw new Error(
            "Facebook имэйл хаяг өгсөнгүй. Хэрэглэгчийн нэр, нууц үгээр бүртгүүлнэ үү."
          );
        }

        const picture = (me.picture as { data?: { url?: string } } | undefined)?.data?.url;

        return findOrCreateSocialUser({
          provider: "facebook",
          providerId: String(me.id),
          email,
          name: typeof me.name === "string" ? me.name : undefined,
          picture,
        });
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    /* NextAuth-ийн анхдагч redirect нь baseUrl-ээс өөр origin бүрийг
       таслаад baseUrl руу буцаадаг. Тиймээс зөвшөөрөх домэйнүүдийг
       НЭРЛЭН бичнэ (нээлттэй чиглүүлэлт болгохгүй).

       2026-09-26: `tesudeix.com` / `www.tesudeix.com` ХАСАГДСАН. Тэр
       домэйны DNS нь энэ droplet руу зааxаа больсон бөгөөд TLS нь ч
       холбогддоггүй — жагсаалтад үлдээвэл түүн рүү чиглүүлэх хүсэлтийг
       зөвшөөрч, хэрэглэгчийг үхсэн хаяг дээр хаяна. Одоо тийм URL нь
       доорх `baseUrl` руу буцна. */
    async redirect({ url, baseUrl }) {
      const allowed = new Set([
        "https://antaqor.com",
        "https://www.antaqor.com",
        "https://trader.antaqor.com",
        "https://studio.antaqor.com",
        baseUrl,
      ]);
      try {
        if (url.startsWith("/")) return `${baseUrl}${url}`;
        const u = new URL(url);
        if (allowed.has(u.origin)) return url;
      } catch {
        /* задлагдахгүй URL — baseUrl руу */
      }
      return baseUrl;
    },
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.avatar = user.image || "";
      }
      // Refresh avatar from DB on session update or every 5 minutes
      const now = Date.now();
      const lastRefresh = (token.avatarRefreshedAt as number) || 0;
      if (trigger === "update" || now - lastRefresh > 5 * 60 * 1000) {
        try {
          await dbConnect();
          const dbUser = await User.findById(token.id).select("avatar").lean();
          if (dbUser) {
            token.avatar = (dbUser as { avatar?: string }).avatar || "";
          }
          token.avatarRefreshedAt = now;
        } catch {
          // ignore DB errors in JWT callback
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        (session.user as { id: string }).id = token.id as string;
        (session.user as { image?: string | null }).image = (token.avatar as string) || null;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/signin",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
