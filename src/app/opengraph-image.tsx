import { ImageResponse } from "next/og";

export const alt = "Antaqor — Be Wild. Conquer the Future.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: "#030303",
          padding: "80px 100px",
          position: "relative",
        }}
      >
        {/* Top red line */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "#cc2200" }} />

        {/* Brand */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 0 }}>
          <span style={{ fontSize: 140, fontWeight: 900, color: "#ede8df", fontFamily: "Arial Black, sans-serif", lineHeight: 1 }}>
            ANTA
          </span>
          <span style={{ fontSize: 140, fontWeight: 900, color: "#cc2200", fontFamily: "Arial Black, sans-serif", lineHeight: 1 }}>
            QOR
          </span>
        </div>

        {/* Tagline */}
        <div style={{ fontSize: 44, fontWeight: 700, color: "#5a5550", marginTop: 24, fontFamily: "Arial, sans-serif" }}>
          Be Wild. Conquer the Future.
        </div>

        {/* Subtitle */}
        <div style={{ fontSize: 22, color: "#3a3835", marginTop: 20, fontFamily: "monospace" }}>
          The Digital Nation — Community of Builders
        </div>

        {/* Bottom red line */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 4, background: "#cc2200" }} />
      </div>
    ),
    { ...size }
  );
}
