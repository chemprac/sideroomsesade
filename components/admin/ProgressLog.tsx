"use client";

import { useEffect, useRef } from "react";

export function ProgressLog({ lines }: { lines: string[] }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  if (lines.length === 0) return null;

  return (
    <div
      style={{
        marginTop: 16,
        border: "1.5px solid var(--ink)",
        background: "var(--aged)",
        maxHeight: 280,
        overflowY: "auto",
        padding: 12,
      }}
    >
      <p className="font-mono-label" style={{ marginBottom: 10 }}>
        Progress log
      </p>
      {lines.map((line, i) => (
        <p
          key={`${i}-${line.slice(0, 20)}`}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            lineHeight: 1.6,
            margin: "2px 0",
            color: line.startsWith("✗")
              ? "var(--stamp-amber)"
              : line.startsWith("⊘")
                ? "var(--muted)"
                : "var(--ink)",
          }}
        >
          {line}
        </p>
      ))}
      <div ref={endRef} />
    </div>
  );
}
