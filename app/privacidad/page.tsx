import type { Metadata } from "next";
import Link from "next/link";
import { businessConfig } from "@/config/business";

export const metadata: Metadata = {
  title: "Privacidad",
  description: "Cómo Valeibol utiliza los datos necesarios para gestionar solicitudes de reserva.",
};

export default function PrivacyPage() {
  return (
    <main className="section shell">
      <div className="section-heading">
        <div>
          <span className="eyebrow">PRIVACIDAD</span>
          <h1>Uso de datos para reservas</h1>
          <p>
            Valeibol utiliza únicamente los datos necesarios para atender una solicitud y operar la agenda del establecimiento.
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
          <p>La autorización para recibir promociones es opcional e independiente de la solicitud de reserva. No necesitas aceptarla para reservar.</p>
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
  );
}
