import Link from "next/link";

export function PlatformFooter() {
  return (
    <footer className="platform-footer">
      <div className="shell platform-footer__inner">
        <div><strong>Canchas</strong><span>Plataforma de descubrimiento y reservas deportivas.</span></div>
        <nav aria-label="Enlaces de plataforma">
          <Link href="/buscar">Buscar</Link>
          <Link href="/privacidad">Privacidad</Link>
          <Link href="/admin/login">Administración</Link>
        </nav>
      </div>
    </footer>
  );
}
