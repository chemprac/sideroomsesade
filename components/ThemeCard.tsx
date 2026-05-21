import type { BriefingTheme } from "@/lib/types";

export function ThemeCard({ theme }: { theme: BriefingTheme }) {
  return (
    <article className="briefing-card">
      <h3 className="font-heading" style={{ fontSize: 18 }}>
        {theme.name}
      </h3>
      <p className="muted-text" style={{ marginTop: 8 }}>
        {theme.description}
      </p>
      {theme.speakers?.length > 0 && (
        <p className="ghost-text" style={{ marginTop: 10 }}>
          <span className="font-mono-label">Speakers — </span>
          {theme.speakers.join(", ")}
        </p>
      )}
      {theme.why_it_matters && (
        <p style={{ marginTop: 8, fontSize: 14 }}>{theme.why_it_matters}</p>
      )}
    </article>
  );
}
