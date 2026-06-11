import { ImageResponse } from "next/og";

export const alt = "Sideroom — Conference intelligence";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#F5F0E6",
          padding: "48px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 28,
            marginBottom: 36,
          }}
        >
          <div
            style={{
              width: 88,
              height: 88,
              border: "4px solid #1C1208",
              borderRadius: 8,
              transform: "rotate(-4deg)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#F5F0E6",
              fontFamily: "ui-monospace, monospace",
              fontSize: 32,
              fontWeight: 500,
              letterSpacing: "0.05em",
              color: "#1C1208",
            }}
          >
            SR
          </div>
          <div
            style={{
              fontFamily: "Georgia, serif",
              fontSize: 72,
              fontWeight: 700,
              color: "#1C1208",
              letterSpacing: "-0.02em",
            }}
          >
            Sideroom
          </div>
        </div>
        <div
          style={{
            fontFamily: "Georgia, serif",
            fontSize: 36,
            fontWeight: 600,
            color: "#1C1208",
            textAlign: "center",
            lineHeight: 1.35,
            maxWidth: 900,
            marginBottom: 20,
          }}
        >
          Know who to meet before you walk in.
        </div>
        <div
          style={{
            fontFamily: "ui-monospace, monospace",
            fontSize: 18,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            color: "#8B7D5A",
          }}
        >
          Conference intelligence
        </div>
      </div>
    ),
    { ...size }
  );
}
