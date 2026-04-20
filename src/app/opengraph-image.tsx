import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import { join } from "path";

export const alt = "ANTAQOR — Mongolia's #1 AI Community";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage() {
  const logoData = await readFile(join(process.cwd(), "public", "favicon.png"));
  const logoBase64 = `data:image/png;base64,${logoData.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#F8F8F6",
          position: "relative",
        }}
      >
        {/* Logo */}
        <img
          src={logoBase64}
          width={120}
          height={120}
          style={{ objectFit: "contain", marginBottom: 24 }}
        />
        {/* Title */}
        <div style={{ display: "flex", alignItems: "baseline" }}>
          <span style={{ fontSize: 96, fontWeight: 900, color: "#1A1A1A", fontFamily: "Arial Black, sans-serif" }}>
            ANTA
          </span>
          <span style={{ fontSize: 96, fontWeight: 900, color: "#EF2C58", fontFamily: "Arial Black, sans-serif" }}>
            QOR
          </span>
        </div>
        {/* Subtitle */}
        <p style={{ fontSize: 28, fontWeight: 600, color: "#888888", marginTop: 8, letterSpacing: 6, textTransform: "uppercase" }}>
          Mongolia&apos;s #1 AI Community
        </p>
        {/* Bottom accent line */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 6, background: "#EF2C58" }} />
      </div>
    ),
    { ...size }
  );
}
