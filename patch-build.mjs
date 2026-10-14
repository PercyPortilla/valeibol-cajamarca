import { readFileSync, writeFileSync } from "node:fs";

function replace(path, from, to) {
  const input = readFileSync(path, "utf8");
  if (input.includes(to)) return;
  if (!input.includes(from)) {
    throw new Error(`Expected build-fix pattern not found in ${path}`);
  }
  writeFileSync(path, input.replace(from, to));
}

replace(
  "components/booking/ReservationDialog.tsx",
  `  const [pricingRates, setPricingRates] = useState({
    withoutLights: businessConfig.pricing.withoutLights,
    withLights: businessConfig.pricing.withLights,
  });
  const [pricingCurrency, setPricingCurrency] = useState(businessConfig.currency);`,
  `  const [pricingRates, setPricingRates] = useState<{ withoutLights: number; withLights: number }>({
    withoutLights: businessConfig.pricing.withoutLights,
    withLights: businessConfig.pricing.withLights,
  });
  const [pricingCurrency, setPricingCurrency] = useState<string>(businessConfig.currency);`,
);

replace(
  "app/admin/(protected)/[module]/page.tsx",
  `export default async function PendingAdminModule({ params }: { params: Promise<{ module: string }> | { module: string } }) {
  const resolved = await Promise.resolve(params);`,
  `export default async function PendingAdminModule({ params }: { params: Promise<{ module: string }> }) {
  const resolved = await params;`,
);

console.log("Build compatibility fixes applied.");
