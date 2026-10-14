"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="section shell">
      <div className="state-box state-box--error" role="alert">
        <strong>No pudimos cargar esta página.</strong>
        <span>Intenta nuevamente. Si el problema continúa, usa el contacto directo del negocio.</span>
        <button className="button button--primary" type="button" onClick={reset}>
          Reintentar
        </button>
      </div>
    </main>
  );
}
