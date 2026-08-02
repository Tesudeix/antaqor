import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

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
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
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
