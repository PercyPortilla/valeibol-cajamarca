import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Valeibol | Cancha de vóley en Cajamarca",
    template: "%s | Valeibol",
  },
  description: "Consulta disponibilidad, precios y solicita tu horario para jugar vóley en Cajamarca.",
  keywords: ["vóley Cajamarca", "cancha de vóley", "alquiler de cancha", "reserva de cancha Cajamarca"],
  applicationName: "Valeibol",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    locale: "es_PE",
    siteName: "Valeibol",
    title: "Valeibol | Cancha de vóley en Cajamarca",
    description: "Consulta disponibilidad, precios y solicita tu horario para jugar vóley en Cajamarca.",
  },
  twitter: {
    card: "summary",
    title: "Valeibol | Cancha de vóley en Cajamarca",
    description: "Consulta disponibilidad, precios y solicita tu horario para jugar vóley en Cajamarca.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
