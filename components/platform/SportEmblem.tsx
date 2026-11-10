/**
 * Símbolos deportivos exclusivos de las tarjetas Caxas.
 * Cuatro composiciones vectoriales distintas; no intervienen en el diorama 3D.
 */
export function SportEmblem({ sportSlug }: { sportSlug: string }) {
  return (
    <svg className="caxas-sport-emblem" viewBox="0 0 64 64" fill="none" aria-hidden="true" focusable="false">
      <circle cx="32" cy="32" r="28" stroke="currentColor" strokeOpacity=".18" strokeWidth="1.5" strokeDasharray="3 5" />
      {sportSlug === "voley" ? (
        <>
          <circle cx="32" cy="32" r="21" stroke="currentColor" strokeWidth="2.6" />
          <path d="M24 13c7 7 12 17 11 39M45 19C32 19 21 28 18 40M15 22c13-4 28 2 36 16M25 52c-1-13 7-23 20-29" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M7 53h50" stroke="currentColor" strokeOpacity=".4" strokeWidth="1.5" />
        </>
      ) : sportSlug === "futbol" ? (
        <>
          <circle cx="32" cy="32" r="22" stroke="currentColor" strokeWidth="2.6" />
          <path d="m32 19 12 9-4.5 13h-15L20 28z" stroke="currentColor" strokeWidth="2.7" strokeLinejoin="round" />
          <path d="M32 19V10M20 28l-9-3M24.5 41l-5 10M39.5 41l5 10M44 28l9-3" stroke="currentColor" strokeWidth="2.7" strokeLinecap="round" />
          <path d="M11 25l8-12M53 25l-8-12M19.5 51h25" stroke="currentColor" strokeOpacity=".5" strokeWidth="1.8" />
        </>
      ) : sportSlug === "futsal" ? (
        <>
          <rect x="9" y="13" width="46" height="38" rx="4" stroke="currentColor" strokeWidth="2.5" />
          <path d="M32 13v38M9 25h8v14H9M55 25h-8v14h8" stroke="currentColor" strokeWidth="2.3" />
          <circle cx="32" cy="32" r="8" stroke="currentColor" strokeWidth="2.1" />
          <circle cx="32" cy="32" r="2.2" fill="currentColor" />
          <path d="M6 27v10M58 27v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </>
      ) : sportSlug === "basquet" ? (
        <>
          <circle cx="32" cy="32" r="22" stroke="currentColor" strokeWidth="2.7" />
          <path d="M10 32h44M32 10v44M18 16c15 10 15 22 0 32M46 16C31 26 31 38 46 48" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M16 11h32" stroke="currentColor" strokeOpacity=".45" strokeWidth="2" />
        </>
      ) : (
        <>
          <circle cx="32" cy="32" r="21" stroke="currentColor" strokeWidth="2.7" />
          <path d="M19 17l26 30M45 17 19 47M11 32h42" stroke="currentColor" strokeWidth="2.3" />
        </>
      )}
    </svg>
  );
}
