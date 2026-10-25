import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SportLandingPage } from "@/components/platform/SportLandingPage";
import { getPublicSportBySlug } from "@/lib/data/platformService";
import { buildSportLandingMetadata, getSportLandingBusinesses } from "@/lib/platform/sportLanding";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const sport = await getPublicSportBySlug(slug);
  if (!sport) return { title: "Deporte no disponible", robots: { index: false, follow: false } };
  const businesses = await getSportLandingBusinesses(sport.slug);
  return buildSportLandingMetadata(sport.slug, businesses.length > 0, sport.name);
}

export default async function DynamicSportPage({ params }: { params: Params }) {
  const { slug } = await params;
  const sport = await getPublicSportBySlug(slug);
  if (!sport) notFound();
  return <SportLandingPage sportSlug={sport.slug} />;
}
