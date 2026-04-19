import { ImageResponse } from "next/og";

export const alt = "Antaqor";
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
          alignItems: "center",
          justifyContent: "center",
          background: "#F8F8F6",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline" }}>
          <span style={{ fontSize: 120, fontWeight: 900, color: "#1A1A1A", fontFamily: "Arial Black, sans-serif" }}>
            ANTA
          </span>
          <span style={{ fontSize: 120, fontWeight: 900, color: "#EF2C58", fontFamily: "Arial Black, sans-serif" }}>
            QOR
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
