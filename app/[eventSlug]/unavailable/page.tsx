import Link from "next/link";

export default function UnavailablePage({
  params,
}: {
  params: Promise<{ eventSlug: string }>;
}) {
  return (
    <div
      className="page-container"
      style={{
        paddingTop: 80,
        textAlign: "center",
        minHeight: "60vh",
      }}
    >
      <span className="postmark">Not available</span>
      <h1 className="font-heading" style={{ fontSize: 28, marginTop: 16 }}>
        This conference isn&apos;t live yet
      </h1>
      <p className="muted-text" style={{ marginTop: 12, maxWidth: 360, margin: "12px auto" }}>
        Check back soon — the organisers are still setting things up.
      </p>
      <Link href="/" className="btn-secondary" style={{ marginTop: 32, display: "inline-block", textDecoration: "none" }}>
        Home
      </Link>
    </div>
  );
}
