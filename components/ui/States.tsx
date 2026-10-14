export function LoadingState({ label = "Cargando…" }: { label?: string }) {
  return <div className="state-box state-box--loading">{label}</div>;
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="state-box">
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  );
}

export function ErrorState({ title = "No pudimos cargar esta sección" }: { title?: string }) {
  return (
    <div className="state-box state-box--error">
      <strong>{title}</strong>
      <span>Intenta nuevamente en unos segundos.</span>
    </div>
  );
}
