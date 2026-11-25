import Link from "next/link";
import { PlatformHeader } from "@/components/platform/PlatformHeader";
import { PlatformFooter } from "@/components/platform/PlatformFooter";

type Props = {
  kind: "complex" | "calendar";
  retryHref: string;
};

/**
 * La caída del catálogo no implica que se haya borrado un negocio.
 * Esta vista evita mostrar un 404 (negocio inexistente) cuando la RPC falla.
 * No inventa canchas, precios ni disponibilidad.
 */
export function PublicCatalogUnavailable({ kind, retryHref }: Props) {
  const calendar = kind === "calendar";
  return (
    <div className="platform-page platform-public-premium platform-public-premium--reservation">
      <PlatformHeader premium />
      <main className="platform-section" id="platform-main" tabIndex={-1}>
        <div className="shell platform-reservation-empty" role="status">
          <span className="eyebrow">SERVICIO TEMPORALMENTE NO DISPONIBLE</span>
          <h1>{calendar ? "No podemos mostrar los horarios ahora" : "No podemos mostrar este complejo ahora"}</h1>
          <p>
            Estamos teniendo dificultades para consultar la información de los negocios.
            Esto no significa que el complejo, sus canchas o sus reservas hayan desaparecido.
          </p>
          <p>
            Vuelve a intentarlo cuando se restablezca la conexión. La disponibilidad y
            los precios deben obtenerse del negocio; no mostraremos datos de prueba.
          </p>
          <div className="platform-complex-contact">
            <Link className="button button--primary" href={retryHref} prefetch={false}>Volver a intentar</Link>
            <Link className="button button--secondary" href="/buscar" prefetch={false}>Explorar complejos</Link>
          </div>
        </div>
      </main>
      <PlatformFooter />
    </div>
  );
}
