import { LoadingState } from "@/components/ui/States";

export default function GlobalLoading() {
  return (
    <main className="section shell" aria-label="Cargando página">
      <LoadingState label="Cargando contenido…" />
    </main>
  );
}
