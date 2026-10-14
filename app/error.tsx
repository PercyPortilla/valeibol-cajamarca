"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Valeibol global error", {
      name: error.name,
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <html lang="es">
      <body>
        <main className="section shell">
          <div className="state-box state-box--error" role="alert">
            <strong>No pudimos cargar esta página.</strong>
            <span>Intenta nuevamente. Si el problema continúa, usa el contacto directo del negocio.</span>
            <button className="button button--primary" type="button" onClick={reset}>
              Reintentar
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
