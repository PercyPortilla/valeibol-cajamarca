import type { ReactNode } from "react";
import type { IconKey } from "@/lib/icons";

type Props = {
  name: IconKey;
  size?: number;
  className?: string;
};

function glyph(name: IconKey): ReactNode {
  switch (name) {
    case "court":
      return <><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z" /><path d="M3 7.5 12 12l9-4.5M12 12v9M7.5 9.75v9M16.5 9.75v9" /></>;
    case "clock":
      return <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3.25 2" /></>;
    case "lighting":
      return <><path d="M9 17h6M10 20h4" /><path d="M8.1 14.4A6 6 0 1 1 15.9 14.4c-.95.75-1.4 1.45-1.5 2.1h-4.8c-.1-.65-.55-1.35-1.5-2.1Z" /></>;
    case "cooling":
      return <><path d="M12 3v18M4.2 7.5 19.8 16.5M19.8 7.5 4.2 16.5" /><path d="m9.8 5.2 2.2 2.2 2.2-2.2M9.8 18.8l2.2-2.2 2.2 2.2" /></>;
    case "music":
      return <><path d="M9 18V7l9-2v11" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="15.5" cy="16" r="2.5" /></>;
    case "tv":
      return <><rect x="3" y="6" width="18" height="12" rx="2" /><path d="m8 3 4 3 4-3M9 21h6" /></>;
    case "snacks":
      return <><path d="M7 8h10l-1 12H8zM9 8l1-4h4l1 4" /><path d="M9.5 12h5M10 16h4" /></>;
    case "toilets":
      return <><circle cx="8" cy="6" r="2" /><circle cx="16" cy="6" r="2" /><path d="M5 21v-7a3 3 0 0 1 6 0v7M13 21v-7a3 3 0 0 1 6 0v7" /></>;
    case "changing":
      return <><path d="M12 6a2.25 2.25 0 1 0-2.2-2.7" /><path d="m4 14 8-5 8 5-2 3H6z" /></>;
    case "crowd":
      return <><circle cx="8" cy="8" r="2.5" /><circle cx="16" cy="8" r="2.5" /><path d="M3.5 20v-3a4.5 4.5 0 0 1 9 0v3M11.5 20v-3a4.5 4.5 0 0 1 9 0v3" /></>;
    case "net":
      return <><path d="M4 4v16M20 4v16M4 8h16M4 12h16M4 16h16M8 8v8M12 8v8M16 8v8" /></>;
    case "ball":
      return <><circle cx="12" cy="12" r="9" /><path d="M6 5.5c2.7 1.1 4.6 3.2 5.5 6.5M18 4.9c-3.2 1-5.5 3.2-6.5 7.1M20.6 14.6c-3.3-1.2-6.3-1-9.1.6M7 20c.6-2.9 2.1-5.2 4.5-6.8" /></>;
    case "calendar":
      return <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18M8 14h3M13 14h3M8 17h3" /></>;
    case "check":
      return <path d="m5 12.5 4.2 4.2L19 7" />;
    case "location":
      return <><path d="M20 10c0 5.2-8 11-8 11S4 15.2 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>;
    case "phone":
      return <path d="M6.7 3.8 4.2 6.3c-.5.5-.7 1.2-.45 1.85 2.1 5.65 6.45 10 12.1 12.1.65.25 1.35.05 1.85-.45l2.5-2.5-4.2-3.1-2.1 2.1c-2.8-1.45-4.75-3.4-6.2-6.2L9.8 8Z" />;
    case "whatsapp":
      return <><path d="M20.5 11.7a8.5 8.5 0 0 1-12.55 7.5L3.5 20.5l1.25-4.3A8.5 8.5 0 1 1 20.5 11.7Z" /><path d="M8.2 7.8c.6 3.4 2.6 5.4 6 6l1.2-1.2 2 1.2c-.45 1.8-1.75 2.7-3.45 2.4-4.1-.7-7.45-4.05-8.15-8.15-.3-1.7.6-3 2.4-3.45l1.2 2Z" /></>;
  }
}

export function Icon({ name, size = 24, className }: Props) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {glyph(name)}
    </svg>
  );
}
