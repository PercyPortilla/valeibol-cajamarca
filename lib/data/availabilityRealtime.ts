import { createPublicBrowserSupabaseClient, hasPublicSupabaseConfig } from "@/lib/data/supabase/browser";

export function subscribeToPublicAvailabilityChanges(
  businessId: string | null,
  onChange: () => void,
) {
  if (!businessId || !hasPublicSupabaseConfig()) return () => {};

  const client = createPublicBrowserSupabaseClient();
  const channel = client
    .channel(`public-availability:${businessId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "availability_revisions",
        filter: `business_id=eq.${businessId}`,
      },
      () => onChange(),
    )
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}
