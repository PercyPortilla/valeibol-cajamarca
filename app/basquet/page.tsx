import { SportLandingPage } from "@/components/platform/SportLandingPage";
import { buildSportLandingMetadata, getSportLandingBusinesses } from "@/lib/platform/sportLanding";

export async function generateMetadata() {
  const businesses = await getSportLandingBusinesses("basquet");
  return buildSportLandingMetadata("basquet", businesses.length > 0);
}

export default function BasketballPage() {
  return <SportLandingPage sportSlug="basquet" />;
}
