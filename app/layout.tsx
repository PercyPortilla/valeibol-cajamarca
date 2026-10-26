import type { Metadata } from "next";
import { resolveSiteUrl } from "@/lib/platform/siteUrl";
import { platformConfig } from "@/config/platform";
import "./globals.css";

const siteUrl = resolveSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl ?? "http://localhost:3000"),
  title: {
    default: `${platformConfig.name} | Canchas deportivas en Cajamarca`,
    template: `%s | ${platformConfig.name}`,
  },
  description: "Encuentra complejos y canchas deportivas en Cajamarca, compara opciones y consulta disponibilidad por deporte.",
  keywords: ["canchas deportivas Cajamarca", "reserva de cancha Cajamarca", "vóley Cajamarca", "fútbol Cajamarca", "futsal Cajamarca", "básquet Cajamarca"],
  applicationName: platformConfig.name,
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    locale: "es_PE",
    siteName: platformConfig.name,
    title: `${platformConfig.name} | Canchas deportivas en Cajamarca`,
    description: "Encuentra complejos deportivos de Cajamarca y consulta disponibilidad desde una sola plataforma.",
  },
  twitter: {
    card: "summary_large_image",
    title: `${platformConfig.name} | Canchas deportivas en Cajamarca`,
    description: "Encuentra complejos deportivos de Cajamarca y consulta disponibilidad desde una sola plataforma.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
