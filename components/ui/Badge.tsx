import type { ReactNode } from "react";

type BadgeTone = "info" | "success" | "warning" | "danger" | "neutral";

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: BadgeTone }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}
