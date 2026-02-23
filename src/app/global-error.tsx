"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: 0,
          backgroundColor: "#030303",
          color: "#ede8df",
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
        }}
      >
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <div
            style={{
              fontFamily: "Bebas Neue, sans-serif",
              fontSize: "72px",
              letterSpacing: "6px",
              color: "#cc2200",
            }}
          >
            ERROR
          </div>
          <p style={{ color: "#5a5550", fontSize: "13px", marginTop: "16px" }}>
            Something went wrong. Please try again.
          </p>
          <div style={{ marginTop: "24px", display: "flex", gap: "12px", justifyContent: "center" }}>
            <button
              onClick={() => reset()}
              style={{
                background: "#cc2200",
                color: "#ede8df",
                border: "none",
                padding: "10px 24px",
                fontSize: "11px",
                letterSpacing: "3px",
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              Try Again
            </button>
            <button
              onClick={() => (window.location.href = "/")}
              style={{
                background: "transparent",
                color: "#5a5550",
                border: "1px solid #1c1c1c",
                padding: "10px 24px",
                fontSize: "11px",
                letterSpacing: "3px",
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              Go Home
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
