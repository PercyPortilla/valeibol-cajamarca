import Image from "next/image";

export function CourtVisual() {
  return (
    <div className="court-visual court-visual--photo">
      <Image
        className="court-visual__photo court-visual__photo--wide"
        src="/images/valeibol-court-wide.webp"
        alt="Cancha de mi valeibol en Cajamarca"
        fill
        priority
        sizes="100vw"
      />
      <Image
        className="court-visual__photo court-visual__photo--portrait"
        src="/images/valeibol-court-portrait.webp"
        alt=""
        fill
        sizes="(max-width: 560px) 100vw, 1px"
      />
    </div>
  );
}
