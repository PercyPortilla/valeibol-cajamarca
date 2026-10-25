import { createPublicBrowserSupabaseClient, hasPublicSupabaseConfig } from "@/lib/data/supabase/browser";

export type FavoriteSnapshot = {
  signedIn: boolean;
  userId: string | null;
  ids: Set<string>;
};

let snapshot: FavoriteSnapshot | null = null;
let pending: Promise<FavoriteSnapshot> | null = null;

export async function loadFavoriteSnapshot(): Promise<FavoriteSnapshot> {
  if (!hasPublicSupabaseConfig()) return { signedIn: false, userId: null, ids: new Set() };
  const client = createPublicBrowserSupabaseClient();
  const { data } = await client.auth.getSession();
  const userId = data.session?.user.id ?? null;
  if (!userId) {
    snapshot = { signedIn: false, userId: null, ids: new Set() };
    pending = null;
    return snapshot;
  }
  if (snapshot?.userId === userId) return snapshot;
  if (pending) return pending;

  pending = (async () => {
    const { data: favorites, error } = await client.rpc("get_my_favorite_business_ids");
    if (error) throw new Error(`favorites_load:${error.code ?? "rpc_error"}`);
    snapshot = {
      signedIn: true,
      userId,
      ids: new Set((favorites ?? []).map((item) => item.business_id)),
    };
    return snapshot;
  })();

  try {
    return await pending;
  } finally {
    pending = null;
  }
}

export async function updateFavorite(businessId: string, favorite: boolean) {
  const current = await loadFavoriteSnapshot();
  if (!current.signedIn || !current.userId) return { signedIn: false, favorite: false };
  const client = createPublicBrowserSupabaseClient();
  const { error } = await client.rpc("set_business_favorite", {
    p_business_id: businessId,
    p_favorite: favorite,
  });
  if (error) throw new Error(`favorite_update:${error.code ?? "rpc_error"}`);
  if (favorite) current.ids.add(businessId);
  else current.ids.delete(businessId);
  snapshot = current;
  return { signedIn: true, favorite };
}
