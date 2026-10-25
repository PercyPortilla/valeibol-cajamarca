import { SportLandingPage } from "@/components/platform/SportLandingPage";
import { buildSportLandingMetadata, getSportLandingBusinesses } from "@/lib/platform/sportLanding";

export async function generateMetadata() {
  const businesses = await getSportLandingBusinesses("futbol");
  return buildSportLandingMetadata("futbol", businesses.length > 0);
}

export default function FootballPage() {
  return <SportLandingPage sportSlug="futbol" />;
}
