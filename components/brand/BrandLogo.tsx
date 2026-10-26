import Image from "next/image";

type Props = {
  context?: "public" | "footer" | "admin" | "auth";
  logoUrl?: string | null;
  name?: string;
};

export function BrandLogo({ context = "public", logoUrl, name = "mi valeibol" }: Props) {
  const src = logoUrl || "/images/valeibol-logo.webp";
  return (
    <span className={`brand-logo brand-logo--${context}`}>
      <Image className="brand-logo__image" src={src} alt={name} width={220} height={73} priority={context === "public"} />
      <span className="brand-logo__text-fallback">{name}</span>
    </span>
  );
}
