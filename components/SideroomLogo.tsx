import Link from "next/link";

type SideroomLogoProps = {
  href?: string;
  className?: string;
  muted?: boolean;
};

export function SideroomLogo({ href = "/", className, muted }: SideroomLogoProps) {
  const content = (
    <>
      <span className="logo-mark">SR</span>
      <span className="logo-text">Sideroom</span>
    </>
  );

  const wrapClass = ["logo-wrap", muted ? "logo-wrap--muted" : "", className]
    .filter(Boolean)
    .join(" ");

  if (href) {
    return (
      <Link href={href} className={wrapClass}>
        {content}
      </Link>
    );
  }

  return <div className={wrapClass}>{content}</div>;
}
