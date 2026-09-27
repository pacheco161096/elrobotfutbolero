function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <>
      <h1>{title}</h1>
      <p className="lead">{body}</p>
      <section className="panel section">
        <p className="empty">PostgreSQL está pendiente. Cuando pases DATABASE_URL, esta pantalla lee la tabla correspondiente. Mientras tanto no hay datos que inventar.</p>
      </section>
    </>
  );
}

export function PartidosVacio() {
  return <EmptyState title="Partidos" body="SCHEDULED, LIVE, SUSPENDED, STALE y el resto de la máquina de estados viven en PostgreSQL." />;
}

export function StoriesVacio() {
  return <EmptyState title="Stories" body="El Story Engine agrupa eventos, claims y fuentes. Una historia puede tener varias fuentes." />;
}

export function EventosVacio() {
  return <EmptyState title="Eventos" body="Cada evento de API-Football se guarda una sola vez, con su idempotency key." />;
}

export function JobsVacio() {
  return <EmptyState title="Jobs" body="Flash entra con prioridad 100. Context entra con prioridad 50. Los dos quedan en cola dentro de PostgreSQL." />;
}
