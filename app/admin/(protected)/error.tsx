"use client";

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="state-box state-box--error" role="alert">
      <strong>No pudimos cargar el área administrativa</strong>
      <span>Puede ser un error de red o una sesión que cambió. Intenta nuevamente.</span>
      <button className="button button--secondary" type="button" onClick={() => reset()}>Reintentar</button>
    </div>
  );
}
