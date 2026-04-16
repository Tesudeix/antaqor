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
          background: "#060608",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline" }}>
          <span style={{ fontSize: 120, fontWeight: 900, color: "#e8e6e1", fontFamily: "Arial Black, sans-serif" }}>
            ANTA
          </span>
          <span style={{ fontSize: 120, fontWeight: 900, color: "#FFFF01", fontFamily: "Arial Black, sans-serif" }}>
            QOR
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
