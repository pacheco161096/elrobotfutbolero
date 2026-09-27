import { listMatches } from "@/lib/db/matches";
import { presentMatch, statusLabel } from "@/lib/matches/present";

export const dynamic = "force-dynamic";

export default async function PartidosPage() {
  const matches = await listMatches();
  return (
    <>
      <h1>Partidos</h1>
      <p className="lead">Lo que ya está en PostgreSQL. El marcador solo se muestra si la API lo trajo.</p>
      <section className="panel section">
        {matches.length === 0 ? (
          <p className="empty">No hay partidos guardados.</p>
        ) : (
          <table className="rows">
            <thead>
              <tr>
                <th>Partido</th>
                <th>Estado</th>
                <th>Horario o marcador</th>
              </tr>
            </thead>
            <tbody>
              {matches.map((match) => {
                const view = presentMatch(match);
                return (
                  <tr key={match.fixtureId}>
                    <td>{match.homeTeam} vs {match.awayTeam}</td>
                    <td>{statusLabel(match.status)}</td>
                    <td>{view.scored ? view.center : `${view.center} · ${view.detail}`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
