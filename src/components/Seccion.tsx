import { Periodico } from "@/components/Periodico";

export function Seccion({ kicker, title, lead }: { kicker: string; title: string; lead?: string }) {
  return (
    <Periodico>
      <article className="section-page">
        <p className="kicker">{kicker}</p>
        <h2>{title}</h2>
        <p>{lead ?? "La sección ya tiene su lugar en el diario. Las notas entran cuando existan en la edición, no antes."}</p>
        <div className="empty-board">
          <strong>Edición vacía</strong>
          <span>Esta sección se llena con lo que ya esté confirmado. No hay notas inventadas.</span>
        </div>
      </article>
    </Periodico>
  );
}
