import Image from "next/image";

type Props = {
  context?: "public" | "footer" | "admin" | "auth";
};

export function BrandLogo({ context = "public" }: Props) {
  return (
    <span className={`brand-logo brand-logo--${context}`}>
      <Image className="brand-logo__image" src="/images/valeibol-logo.webp" alt="mi valeibol" width={220} height={73} priority={context === "public"} />
      <span className="brand-logo__text-fallback">mi valeibol · club de voleibol</span>
    </span>
  );
}
