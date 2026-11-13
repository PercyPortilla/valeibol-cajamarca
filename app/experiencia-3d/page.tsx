import Link from "next/link";
import type { Metadata } from "next";
import { PlatformHeader } from "@/components/platform/PlatformHeader";
import { PlatformFooter } from "@/components/platform/PlatformFooter";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Recorrido virtual 3D | Caxas SportCenter",
  description: "Explora en 3D el proyecto del complejo deportivo Caxas y el paisaje de Santa Apolonia en Cajamarca.",
  alternates: { canonical: "/experiencia-3d" },
};

export default function Experiencia3DPage() {
  return (
    <div className="platform-page">
      <PlatformHeader premium />
      <main className={styles.main} id="platform-main" tabIndex={-1}>
        <div className={styles.intro}>
          <div>
            <span className={styles.eyebrow}>RECORRIDO VIRTUAL · CAJAMARCA</span>
            <h1>Conoce Caxas en <span>tres dimensiones.</span></h1>
            <p>Explora el complejo deportivo, sus canchas y su entorno natural con nuestro modelo interactivo exportado desde Blender.</p>
          </div>
          <nav className={styles.links} aria-label="Opciones del recorrido 3D">
            <Link href="/">Volver al inicio</Link>
            <a href="/caxas-3d/index.html" target="_blank" rel="noopener noreferrer">Abrir en otra pestaña ↗</a>
          </nav>
        </div>
        <div className={styles.viewer}>
          <iframe
            title="Recorrido navegable en 3D de Sport Center Caxas"
            src="/caxas-3d/index.html"
            loading="eager"
            allowFullScreen
          />
        </div>
        <p className={styles.disclaimer}>
          Modelo 3D V083/B84 con materiales y coordenadas UV preparados para revisión. Puedes elegir el modelo optimizado o la variante cinematográfica con cámaras y recorrido animado. La iluminación web de día/noche es ilustrativa y no sustituye los renders de D5.
        </p>
      </main>
      <PlatformFooter />
    </div>
  );
}
