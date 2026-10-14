import { businessConfig } from "@/config/business";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="shell site-footer__grid">
        <div>
          <strong>{businessConfig.name}</strong>
          <p>{businessConfig.address}</p>
        </div>
        <div>
          <span>Contacto</span>
          <a href={`tel:+51${businessConfig.phone.replace(/\s/g, "")}`}><strong>{businessConfig.phone}</strong></a>
        </div>
        <small>Consulta disponibilidad, precios y contacto antes de solicitar tu horario.</small>
      </div>
    </footer>
  );
}
