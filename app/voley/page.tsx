import { SportLandingPage } from "@/components/platform/SportLandingPage";
import { buildSportLandingMetadata, getSportLandingBusinesses } from "@/lib/platform/sportLanding";

export async function generateMetadata() {
  const businesses = await getSportLandingBusinesses("voley");
  return buildSportLandingMetadata("voley", businesses.length > 0);
}

export default function VolleyballPage() {
  return <SportLandingPage sportSlug="voley" />;
}
