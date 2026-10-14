import type { ReactNode } from "react";

export function ModalShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="modal-shell" aria-label={title}>
      <div className="modal-shell__header">
        <strong>{title}</strong>
        <button className="icon-button" type="button" aria-label="Cerrar modal">×</button>
      </div>
      <div>{children}</div>
    </section>
  );
}
