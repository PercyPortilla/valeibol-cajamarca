type Kind = "businesses" | "venues" | "courts" | "users" | "reservations";

export function GlobalAdminMetricIcon({ kind }: { kind: Kind }) {
  return (
    <svg className="global-admin-metric__icon" width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {kind === "businesses" ? (
        <><path d="M3 9h18l-2-5H5L3 9Zm1 0v11h16V9M9 20v-7h6v7" /><path d="M7 4h10M3 9c0 3 4.5 3 4.5 0 0 3 4.5 3 4.5 0 0 3 4.5 3 4.5 0 0 3 4.5 3 4.5 0" /></>
      ) : kind === "venues" ? (
        <><path d="M3 20h18M5 20V7l7-4 7 4v13M9 20v-7h6v7M5 9h14M9 9V5m6 4V5" /></>
      ) : kind === "courts" ? (
        <><rect x="2.5" y="4.5" width="19" height="15" rx="2" /><path d="M12 4.5v15M2.5 12h19M8 12a4 4 0 0 1 8 0M8 12a4 4 0 0 0 8 0" /></>
      ) : kind === "users" ? (
        <><circle cx="9" cy="8" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 6.2a3 3 0 0 1 0 5.6M17 14a5 5 0 0 1 4 5v1" /></>
      ) : (
        <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18M8 15l2.5 2.5 5.5-6" /></>
      )}
    </svg>
  );
}
