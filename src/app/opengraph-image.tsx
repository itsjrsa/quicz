import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Quicz — Quick Quiz";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(10,10,10,0.08) 1px, transparent 0)",
          backgroundSize: "32px 32px",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 240,
            fontWeight: 700,
            letterSpacing: -8,
            color: "#0a0a0a",
            lineHeight: 1,
          }}
        >
          Quicz
        </div>
        <div
          style={{
            marginTop: 28,
            fontSize: 28,
            letterSpacing: 14,
            color: "#6b7280",
            textTransform: "uppercase",
          }}
        >
          Quick · Quiz
        </div>
        <div
          style={{
            marginTop: 40,
            fontSize: 30,
            color: "#4b5563",
          }}
        >
          Live quizzes for training sessions and workshops.
        </div>
      </div>
    ),
    { ...size }
  );
}
