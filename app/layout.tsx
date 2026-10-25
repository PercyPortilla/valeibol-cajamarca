import type { Metadata } from "next";
import { resolveSiteUrl } from "@/lib/platform/siteUrl";
import "./globals.css";

const siteUrl = resolveSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl ?? "http://localhost:3000"),
  title: {
    default: "Canchas | Reservas deportivas",
    template: "%s | Canchas",
  },
  description: "Encuentra complejos deportivos, compara canchas y consulta disponibilidad por ciudad y deporte.",
  keywords: ["canchas deportivas", "reserva de cancha", "vóley", "fútbol", "futsal", "básquet"],
  applicationName: "Canchas",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    locale: "es_PE",
    siteName: "Canchas",
    title: "Canchas | Reservas deportivas",
    description: "Encuentra complejos deportivos y consulta disponibilidad desde una sola plataforma.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Canchas | Reservas deportivas",
    description: "Encuentra complejos deportivos y consulta disponibilidad desde una sola plataforma.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
