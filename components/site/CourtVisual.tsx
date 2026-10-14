export function CourtVisual() {
  return (
    <div className="court-visual" role="img" aria-label="Ilustración conceptual de una cancha cubierta de vóley; no es una fotografía del local">
      <div className="court-visual__roof" />
      <div className="court-visual__court">
        <span className="court-line court-line--middle" />
        <span className="court-line court-line--left" />
        <span className="court-line court-line--right" />
        <span className="court-net" />
      </div>
      <div className="court-visual__caption">
        <span className="live-dot" />
        Ilustración conceptual · no fotografía del local
      </div>
    </div>
  );
}
