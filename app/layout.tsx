import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Valeibol | Reserva tu cancha en Cajamarca",
  description: "Consulta disponibilidad y reserva tu cancha de vóley en Cajamarca.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
