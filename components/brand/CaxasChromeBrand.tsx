import Image from "next/image";

/**
 * CAXAS chrome/violet identity: the actual approved metallic wordmark.
 * SPORTCENTER and the descriptor remain HTML text for responsive legibility.
 */
export function CaxasChromeBrand({
  tagline = "Plataforma deportiva · Cajamarca",
  compact = false,
}: { tagline?: string; compact?: boolean } = {}) {
  return (
    <span className={`caxas-chrome-brand${compact ? " caxas-chrome-brand--compact" : ""}`} data-brand-asset="chrome-violet">
      <span className="caxas-chrome-brand__row">
        <Image
          src="/images/caxas-chrome-violet-wordmark.webp"
          alt="CAXAS"
          width={2007}
          height={298}
          className="caxas-chrome-brand__wordmark"
          priority={!compact}
        />
        <strong className="caxas-chrome-brand__sport">SPORTCENTER</strong>
      </span>
      <small className="caxas-chrome-brand__tagline">{tagline}</small>
    </span>
  );
}
