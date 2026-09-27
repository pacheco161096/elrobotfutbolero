import pg from "pg";

export const dynamic = "force-dynamic";

export default async function EventosPage() {
  const url = process.env.DATABASE_URL;
  const rows = url ? await load(url) : [];
  return (
    <>
      <h1>Eventos</h1>
      <p className="lead">Goles, tarjetas y cambios se guardan cuando el partido ya empezó. Un partido programado no trae eventos.</p>
      <section className="panel section">
        {rows.length === 0 ? (
          <p className="empty">Esta jornada todavía no tiene eventos confirmados. Los nueve partidos siguen programados.</p>
        ) : (
          <table className="rows">
            <thead>
              <tr><th>Tipo</th><th>Minuto</th><th>Jugador</th><th>Equipo</th></tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.event_type}</td>
                  <td>{row.minute ?? "—"}</td>
                  <td>{row.player ?? "—"}</td>
                  <td>{row.team ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

async function load(databaseUrl: string) {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const result = await client.query<{ id: string; event_type: string; minute: number | null; player: string | null; team: string | null }>(
      "SELECT id, event_type, minute, player, team FROM match_events ORDER BY created_at DESC LIMIT 50",
    );
    return result.rows;
  } finally {
    await client.end();
  }
}
