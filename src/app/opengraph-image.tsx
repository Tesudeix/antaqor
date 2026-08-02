import { ImageResponse } from "next/og";

export const alt = "ANTAQOR — Mongolia's #1 AI Community";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// v8 EVENT HORIZON — void mass, one signal emission, machine-layer serial.
export default async function OGImage() {
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
          background: "#0E0E10",
          position: "relative",
        }}
      >
        {/* Horizon ring — brand motif, the event horizon */}
        <div
          style={{
            position: "absolute",
            right: -180,
            top: -180,
            width: 560,
            height: 560,
            borderRadius: 9999,
            border: "1px solid #5C5C64",
            display: "flex",
          }}
        />
        {/* Emission — the only gradient */}
        <div
          style={{
            position: "absolute",
            left: 300,
            top: 115,
            width: 600,
            height: 400,
            borderRadius: 9999,
            background:
              "radial-gradient(circle at 50% 50%, rgba(16,128,202,0.10), rgba(16,128,202,0) 70%)",
            display: "flex",
          }}
        />
        {/* Wordmark */}
        <div style={{ display: "flex", alignItems: "baseline" }}>
          <span style={{ fontSize: 110, fontWeight: 900, color: "#FFFFFF", fontFamily: "Arial Black, sans-serif", letterSpacing: 2 }}>
            ANTA
          </span>
          <span style={{ fontSize: 110, fontWeight: 900, color: "#1080CA", fontFamily: "Arial Black, sans-serif", letterSpacing: 2 }}>
            QOR
          </span>
        </div>
        {/* Subtitle — ghost, machine-spaced */}
        <p style={{ fontSize: 26, fontWeight: 600, color: "#B4B4BA", marginTop: 10, letterSpacing: 8, textTransform: "uppercase" }}>
          Mongolia&apos;s #1 AI Community
        </p>
        {/* Machine layer — serial + coordinates */}
        <p style={{ position: "absolute", bottom: 28, left: 48, fontSize: 18, color: "#84848C", letterSpacing: 3, fontFamily: "monospace" }}>
          AQ-260730-01 · 47.92°N 106.92°E
        </p>
        <div style={{ position: "absolute", bottom: 28, right: 48, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 12, height: 12, borderRadius: 9999, background: "#1080CA", display: "flex" }} />
          <span style={{ fontSize: 18, color: "#1080CA", letterSpacing: 3, fontFamily: "monospace" }}>LIVE</span>
        </div>
        {/* Signal baseline */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 6, background: "#1080CA", display: "flex" }} />
      </div>
    ),
    { ...size }
  );
}
