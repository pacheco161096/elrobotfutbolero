import { Periodico } from "@/components/Periodico";
import { listStandings } from "@/lib/db/standings";

export const dynamic = "force-dynamic";

export default async function Page() {
  const rows = await listStandings();
  return (
    <Periodico>
      <article className="section-page">
        <p className="kicker">Tabla</p>
        <h2>Tabla</h2>
        <p>Posiciones de Liga MX que devolvió API-Football. Los puntos no se calculan a mano.</p>
        {rows.length === 0 ? (
          <div className="empty-board">
            <strong>Edición vacía</strong>
            <span>La tabla entra en la sincronización de cada 6 horas. Mientras no haya filas, no se inventan puntos.</span>
          </div>
        ) : (
          <table className="rows">
            <thead>
              <tr>
                <th>#</th>
                <th>Club</th>
                <th>PJ</th>
                <th>G</th>
                <th>E</th>
                <th>P</th>
                <th>GF</th>
                <th>GC</th>
                <th>Pts</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.team}>
                  <td>{row.rank}</td>
                  <td>{row.team}</td>
                  <td>{row.played ?? "—"}</td>
                  <td>{row.won ?? "—"}</td>
                  <td>{row.draw ?? "—"}</td>
                  <td>{row.lost ?? "—"}</td>
                  <td>{row.goalsFor ?? "—"}</td>
                  <td>{row.goalsAgainst ?? "—"}</td>
                  <td>{row.points ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </article>
    </Periodico>
  );
}
