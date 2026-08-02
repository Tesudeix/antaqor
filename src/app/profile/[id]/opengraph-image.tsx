import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import { join } from "path";
import mongoose from "mongoose";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import { isAdminEmail } from "@/lib/adminClient";
import { getLevelTitle } from "@/lib/xpClient";

export const alt = "ANTAQOR · CONQUEROR";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 300; // refresh card every 5 min

const TOTAL_SUPPLY = 100;

interface UserShape {
  _id: mongoose.Types.ObjectId;
  name: string;
  email?: string;
  avatar?: string;
  level?: number;
  clan?: string;
  clanJoinedAt?: Date;
  subscriptionExpiresAt?: Date;
}

async function loadConquerorContext(id: string) {
  await dbConnect();

  const target = (await User.findById(id)
    .select("name email avatar level clan clanJoinedAt subscriptionExpiresAt")
    .lean()) as unknown as UserShape | null;

  if (!target) return { kind: "missing" as const };

  const now = new Date();
  const isPaid = !!(target.subscriptionExpiresAt && new Date(target.subscriptionExpiresAt) > now);
  const inClan = !!(target.clan && target.clan.length > 0);
  const isConqueror = isPaid && inClan;

  if (!isConqueror) {
    return {
      kind: "civilian" as const,
      user: target,
    };
  }

  // Compute mint number: position in ascending-clanJoinedAt roster.
  const earlierCount = await User.countDocuments({
    clan: { $ne: "" },
    subscriptionExpiresAt: { $gt: now },
    $or: [
      { clanJoinedAt: { $lt: target.clanJoinedAt } },
      {
        clanJoinedAt: target.clanJoinedAt,
        _id: { $lt: target._id },
      },
    ],
  });
  const mintNumber = earlierCount + 1;

  return {
    kind: "conqueror" as const,
    user: target,
    mintNumber,
  };
}

function safeAvatar(url?: string): string | null {
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) return null;
  return url;
}

function initialsOf(name: string): string {
  return (name || "?")
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default async function ProfileOG({ params }: { params: { id: string } }) {
  let logoBase64 = "";
  try {
    const logo = await readFile(join(process.cwd(), "public", "antaqor.png"));
    logoBase64 = `data:image/png;base64,${logo.toString("base64")}`;
  } catch {
    try {
      const logo = await readFile(join(process.cwd(), "public", "favicon.png"));
      logoBase64 = `data:image/png;base64,${logo.toString("base64")}`;
    } catch {
      logoBase64 = "";
    }
  }

  let ctx;
  try {
    ctx = await loadConquerorContext(params.id);
  } catch (e) {
    console.error("[og:profile] db err", (e as Error).message);
    ctx = { kind: "missing" as const };
  }

  // ───────────── MISSING ─────────────
  if (ctx.kind === "missing") {
    return new ImageResponse(
      (
        <div
          style={{
            width: 1200, height: 630,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            background: "#0B0B0F", color: "#0e1726",
            fontFamily: "Arial Black, sans-serif",
          }}
        >
          <div style={{ fontSize: 28, color: "#1080CA", letterSpacing: 6, marginBottom: 18 }}>
            [ ANTAQOR · EDGERUNNERS ]
          </div>
          <div style={{ fontSize: 92, fontWeight: 900, color: "#0e1726" }}>PROFILE NOT FOUND</div>
        </div>
      ),
      { ...size }
    );
  }

  // ───────────── CIVILIAN (not yet a Conqueror) ─────────────
  if (ctx.kind === "civilian") {
    const u = ctx.user;
    const avatar = safeAvatar(u.avatar);
    const initials = initialsOf(u.name);
    const level = u.level || 1;
    const t = getLevelTitle(level);

    return new ImageResponse(
      (
        <div
          style={{
            width: 1200, height: 630,
            display: "flex", flexDirection: "row",
            background: "#0B0B0F", color: "#0e1726",
            fontFamily: "Arial Black, sans-serif",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute", inset: 0,
              backgroundImage:
                "linear-gradient(rgba(15,23,38,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,38,0.04) 1px, transparent 1px)",
              backgroundSize: "60px 60px",
              display: "flex",
            }}
          />
          {/* avatar block */}
          <div
            style={{
              width: 540, height: 630,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "#06060A",
              position: "relative",
            }}
          >
            {avatar ? (
              <img
                src={avatar}
                width={540}
                height={630}
                style={{ objectFit: "cover", width: 540, height: 630, filter: "grayscale(0.4)" }}
              />
            ) : (
              <div style={{ fontSize: 220, color: "rgba(15,23,38,0.08)", display: "flex" }}>
                {initials}
              </div>
            )}
          </div>
          {/* info block */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 56, justifyContent: "space-between" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 22, color: "#6b7280", letterSpacing: 6, display: "flex" }}>
                [ NOT YET A CONQUEROR ]
              </div>
              <div style={{ fontSize: 64, color: "#0e1726", marginTop: 18, lineHeight: 1, display: "flex" }}>
                {u.name}
              </div>
              <div style={{ fontSize: 24, color: "#6b7280", marginTop: 14, letterSpacing: 4, display: "flex" }}>
                LV.{String(level).padStart(2, "0")} · {t.titleEN.toUpperCase()}
              </div>
              <div style={{ fontSize: 22, color: "#1080CA", marginTop: 36, lineHeight: 1.4, display: "flex" }}>
                Empire-д нэгдэхээр бэлдэж байна.
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              {logoBase64 && <img src={logoBase64} width={36} height={36} />}
              <div style={{ fontSize: 24, color: "#1080CA", letterSpacing: 6 }}>ANTAQOR.COM</div>
            </div>
          </div>
        </div>
      ),
      { ...size }
    );
  }

  // ───────────── CONQUEROR (the money shot) ─────────────
  const u = ctx.user;
  const mintNumber = ctx.mintNumber;
  const founder = isAdminEmail(u.email);
  const accent = founder ? "#FFD300" : "#1080CA";
  const avatar = safeAvatar(u.avatar);
  const initials = initialsOf(u.name);
  const level = u.level || 1;
  const t = getLevelTitle(level);
  const roleTag = founder ? "FOUNDER · ҮНДЭСЛЭГЧ" : t.titleEN.toUpperCase();
  const mintLabel = `#${String(mintNumber).padStart(3, "0")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200, height: 630,
          display: "flex", flexDirection: "row",
          background: "#0B0B0F", color: "#0e1726",
          fontFamily: "Arial Black, sans-serif",
          position: "relative",
        }}
      >
        {/* grid backdrop */}
        <div
          style={{
            position: "absolute", inset: 0,
            backgroundImage:
              "linear-gradient(rgba(16,128,202,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(16,128,202,0.08) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            display: "flex",
          }}
        />
        {/* corner glow */}
        <div
          style={{
            position: "absolute", top: -160, right: -120,
            width: 540, height: 540, borderRadius: 9999,
            background: accent, opacity: 0.18, filter: "blur(120px)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute", bottom: -180, left: -100,
            width: 460, height: 460, borderRadius: 9999,
            background: founder ? "#1080CA" : "#1080CA", opacity: 0.14, filter: "blur(140px)",
            display: "flex",
          }}
        />

        {/* ─── LEFT: Avatar art tile ─── */}
        <div
          style={{
            width: 540, height: 630,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "#06060A",
            position: "relative",
            borderRight: `2px solid ${accent}33`,
          }}
        >
          {avatar ? (
            <img
              src={avatar}
              width={540}
              height={630}
              style={{ objectFit: "cover", width: 540, height: 630 }}
            />
          ) : (
            <div
              style={{
                width: 540, height: 630,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: `linear-gradient(135deg, ${accent}33 0%, #0F0F11 100%)`,
              }}
            >
              <div style={{ fontSize: 280, fontWeight: 900, color: "rgba(15,23,38,0.16)", display: "flex" }}>
                {initials}
              </div>
            </div>
          )}
          {/* holographic stripe overlay */}
          <div
            style={{
              position: "absolute", inset: 0,
              backgroundImage:
                "repeating-linear-gradient(135deg, rgba(15,23,38,0.10) 0px, rgba(15,23,38,0.10) 1px, transparent 1px, transparent 8px)",
              opacity: 0.5,
              display: "flex",
            }}
          />
          {/* gradient fade bottom */}
          <div
            style={{
              position: "absolute", left: 0, right: 0, bottom: 0, height: 200,
              background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)",
              display: "flex",
            }}
          />
          {/* mint badge bottom-left of art */}
          <div
            style={{
              position: "absolute", bottom: 24, left: 24,
              padding: "8px 14px",
              background: "rgba(0,0,0,0.7)",
              border: `2px solid ${accent}`,
              borderRadius: 4,
              display: "flex", alignItems: "center", gap: 10,
            }}
          >
            <div style={{ fontSize: 36, fontWeight: 900, color: accent, letterSpacing: 1, display: "flex" }}>
              {mintLabel}
            </div>
            <div style={{ fontSize: 18, color: "#6b7280", letterSpacing: 4, display: "flex" }}>
              / {String(TOTAL_SUPPLY).padStart(3, "0")}
            </div>
          </div>
          {founder && (
            <div
              style={{
                position: "absolute", top: 24, right: 24,
                padding: "6px 14px",
                background: "#FFD300",
                color: "#000",
                fontSize: 18,
                letterSpacing: 4,
                borderRadius: 4,
                display: "flex",
              }}
            >
              ★ FOUNDER
            </div>
          )}
        </div>

        {/* ─── RIGHT: Info block ─── */}
        <div
          style={{
            flex: 1,
            display: "flex", flexDirection: "column",
            padding: 56,
            justifyContent: "space-between",
            position: "relative",
          }}
        >
          {/* Top eyebrow */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 28, height: 3, background: accent, display: "flex" }} />
              <div style={{ fontSize: 18, color: accent, letterSpacing: 6, display: "flex" }}>
                [ GENESIS · {String(TOTAL_SUPPLY).padStart(3, "0")} ]
              </div>
            </div>

            {/* CONQUEROR title */}
            <div
              style={{
                fontSize: 80, fontWeight: 900,
                color: "#0e1726",
                marginTop: 24,
                letterSpacing: -2,
                lineHeight: 0.95,
                display: "flex",
              }}
            >
              CONQUEROR
            </div>

            <div style={{ fontSize: 22, color: "#6b7280", letterSpacing: 4, marginTop: 8, display: "flex" }}>
              БАЙЛДАН ДАГУУЛАГЧ
            </div>

            {/* Name (pop) */}
            <div
              style={{
                fontSize: 56, fontWeight: 900,
                color: accent,
                marginTop: 36,
                lineHeight: 1,
                letterSpacing: -1,
                maxWidth: 580,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                display: "flex",
              }}
            >
              {u.name}
            </div>

            {/* Role tag + level */}
            <div
              style={{
                marginTop: 18,
                display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  padding: "6px 12px",
                  border: `2px solid ${accent}`,
                  background: `${accent}1F`,
                  fontSize: 18,
                  color: accent,
                  letterSpacing: 4,
                  borderRadius: 4,
                  display: "flex",
                }}
              >
                {roleTag}
              </div>
              <div style={{ fontSize: 18, color: "#6b7280", letterSpacing: 4, display: "flex" }}>
                LV.{String(level).padStart(2, "0")} · {t.titleMN}
              </div>
            </div>
          </div>

          {/* Bottom branding strip */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderTop: "1px solid rgba(15,23,38,0.08)",
              paddingTop: 18,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              {logoBase64 ? (
                <img src={logoBase64} width={40} height={40} />
              ) : null}
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: "#0e1726", letterSpacing: 6, display: "flex" }}>
                  ANTAQOR
                </div>
                <div style={{ fontSize: 14, color: "#6b7280", letterSpacing: 4, display: "flex" }}>
                  EDGERUNNERS
                </div>
              </div>
            </div>
            <div
              style={{
                fontSize: 16, color: "#6b7280", letterSpacing: 4, display: "flex",
              }}
            >
              ANTAQOR.COM/MEMBERS
            </div>
          </div>
        </div>

        {/* Right-edge accent stripe */}
        <div
          style={{
            position: "absolute", right: 0, top: 0, bottom: 0, width: 6,
            background: accent,
            display: "flex",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
