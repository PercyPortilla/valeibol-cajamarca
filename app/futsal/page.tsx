import { SportLandingPage } from "@/components/platform/SportLandingPage";
import { buildSportLandingMetadata, getSportLandingBusinesses } from "@/lib/platform/sportLanding";

export async function generateMetadata() {
  const businesses = await getSportLandingBusinesses("futsal");
  return buildSportLandingMetadata("futsal", businesses.length > 0);
}

export default function FutsalPage() {
  return <SportLandingPage sportSlug="futsal" />;
}
