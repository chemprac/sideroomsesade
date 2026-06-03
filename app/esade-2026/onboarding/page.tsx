"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ICP_TYPE_COOKIE } from "@/lib/icp-cookie-constants";
import type { IcpType } from "@/lib/types";

const PAPER = "#F5F0E6";
const INK = "#1C1208";
const AMBER = "#C4842A";
const BORDER = "#C4B89A";
const MUTED = "#8B7D5A";
const AGED = "#EDE5D0";

const ICP_OPTIONS: {
  type: IcpType;
  label: string;
  title: string;
}[] = [
  {
    type: "investor",
    label: "Angel investor",
    title: "Looking for founders to back",
  },
  {
    type: "sales",
    label: "B2B sales",
    title: "Looking for clients",
  },
  {
    type: "partners",
    label: "Strategic alliances",
    title: "Looking for partners",
  },
  {
    type: "job",
    label: "MBA / career move",
    title: "Looking for a job or internship",
  },
];

function setIcpTypeCookie(icpType: IcpType) {
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${ICP_TYPE_COOKIE}=${icpType};path=/;max-age=${maxAge};SameSite=Lax`;
}

export default function Home() {
  const router = useRouter();
  const [selected, setSelected] = useState<IcpType | null>(null);

  const handleSubmit = () => {
    if (!selected) return;
    setIcpTypeCookie(selected);
    router.push("/esade-2026");
  };

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: PAPER,
        color: INK,
        display: "flex",
        flexDirection: "column",
        padding: "24px 20px 32px",
        maxWidth: 520,
        margin: "0 auto",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <p
        style={{
          fontFamily: "var(--font-mono), monospace",
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          margin: 0,
          color: INK,
        }}
      >
        Sideroom
      </p>

      <p
        style={{
          fontFamily: "var(--font-mono), monospace",
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          margin: "14px 0 0",
          padding: "6px 12px",
          border: `1px solid ${AMBER}`,
          borderRadius: 0,
          color: AMBER,
          display: "inline-block",
          alignSelf: "flex-start",
          lineHeight: 1.4,
        }}
      >
        ESADE Entrepreneurship Summit 2026 · Barcelona · May 28–30
      </p>

      <h1
        className="font-heading"
        style={{
          fontSize: "clamp(32px, 8vw, 42px)",
          lineHeight: 1.15,
          margin: "32px 0 0",
          color: INK,
        }}
      >
        What do you want from this visit?
      </h1>

      <p
        style={{
          fontFamily: "var(--font-body), system-ui, sans-serif",
          fontSize: 16,
          color: MUTED,
          margin: "10px 0 0",
        }}
      >
        Be honest.
      </p>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          marginTop: 28,
          flex: 1,
        }}
      >
        {ICP_OPTIONS.map((opt) => {
          const isSelected = selected === opt.type;
          return (
            <button
              key={opt.type}
              type="button"
              onClick={() => setSelected(opt.type)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "14px 16px",
                border: `1px solid ${isSelected ? AMBER : BORDER}`,
                borderRadius: 0,
                background: isSelected ? AGED : PAPER,
                cursor: "pointer",
                color: INK,
              }}
            >
              <p
                style={{
                  fontFamily: "var(--font-mono), monospace",
                  fontSize: 10,
                  fontWeight: 500,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  margin: "0 0 6px",
                  color: isSelected ? INK : MUTED,
                }}
              >
                {opt.label}
              </p>
              <p
                className="font-heading"
                style={{
                  fontSize: 17,
                  margin: 0,
                  lineHeight: 1.3,
                }}
              >
                {opt.title}
              </p>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        disabled={!selected}
        onClick={handleSubmit}
        style={{
          width: "100%",
          marginTop: 24,
          padding: "14px 20px",
          minHeight: 48,
          border: "none",
          borderRadius: 0,
          fontFamily: "var(--font-mono), monospace",
          fontSize: 12,
          fontWeight: 500,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          cursor: selected ? "pointer" : "not-allowed",
          background: selected ? AMBER : MUTED,
          color: INK,
        }}
      >
        See who&apos;s in the room →
      </button>
    </main>
  );
}
