import { Periodico } from "@/components/Periodico";
import { listMatches } from "@/lib/db/matches";

export const dynamic = "force-dynamic";

export default async function Page() {
  const matches = await listMatches();
  const teams = [...new Set(matches.flatMap((match) => [match.homeTeam, match.awayTeam]))].sort((left, right) => left.localeCompare(right, "es"));
  return (
    <Periodico>
      <article className="section-page">
        <p className="kicker">Equipos</p>
        <h2>Equipos</h2>
        <p>Cada club aparece porque está en un partido guardado. Sin ficha inventada.</p>
        {teams.length === 0 ? (
          <div className="empty-board">
            <strong>Edición vacía</strong>
            <span>Cuando haya partidos en la base, aquí salen sus clubes.</span>
          </div>
        ) : (
          <ul className="fixtures">
            {teams.map((team) => <li className="fixture" key={team}><strong>{team}</strong></li>)}
          </ul>
        )}
      </article>
    </Periodico>
  );
}
