import { serializeJsonLd, type JsonLd } from "@/lib/platform/seo";

export function StructuredData({ data }: { data: JsonLd }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
