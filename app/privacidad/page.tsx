import type { Metadata } from "next";
import Link from "next/link";
import { businessConfig } from "@/config/business";
import { getPublicSiteContent } from "@/lib/data/publicSiteContentService";
import { themeCssVariables } from "@/lib/siteContent";
import type { CSSProperties } from "react";

export const metadata: Metadata = {
  title: "Privacidad",
  description: "Cómo Caxas Sport Center utiliza los datos necesarios para gestionar solicitudes de reserva.",
};

export default async function PrivacyPage() {
  const siteContent = await getPublicSiteContent();
  return (
    <div className="site-theme privacy-page" style={themeCssVariables(siteContent.theme) as CSSProperties}>
      <main className="section shell">
        <div className="section-heading">
          <div>
            <span className="eyebrow">PRIVACIDAD</span>
            <h1>Uso de datos para reservas</h1>
            <p>
              Caxas Sport Center utiliza únicamente los datos necesarios para atender una solicitud y operar la agenda del establecimiento correspondiente.
            </p>
          </div>
        </div>

        <div className="info-grid">
          <section>
            <h2>Datos que se solicitan</h2>
            <p>Al solicitar un horario se puede pedir tu nombre, número de WhatsApp, horario elegido y altura de red. La iluminación se asigna automáticamente según la hora de inicio.</p>
          </section>
          <section>
            <h2>Para qué se usan</h2>
            <p>Se usan para identificar tu solicitud, contactarte sobre su confirmación o cancelación y administrar la reserva.</p>
          </section>
          <section>
            <h2>Promociones</h2>
            <p>La plataforma no solicita consentimiento promocional durante la reserva. El número de WhatsApp se usa únicamente para gestionar la solicitud y las comunicaciones transaccionales relacionadas.</p>
          </section>
          <section>
            <h2>Acceso</h2>
            <p>Los datos de clientes y reservas no forman parte de la disponibilidad pública. El acceso administrativo está restringido a personal autorizado.</p>
          </section>
          <section>
            <h2>Contacto</h2>
            <p>
              Para consultas relacionadas con tus datos puedes comunicarte con {businessConfig.name} al{" "}
              <a href={`tel:+51${businessConfig.phone.replace(/\D/g, "")}`}>{businessConfig.phone}</a>.
            </p>
          </section>
        </div>

        <p><Link href="/">Volver al inicio</Link></p>
      </main>
    </div>
  );
}

