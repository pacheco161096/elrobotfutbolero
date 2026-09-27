import { Periodico } from "@/components/Periodico";
import { listMatches } from "@/lib/db/matches";
import { presentMatch } from "@/lib/matches/present";

export const dynamic = "force-dynamic";

export default async function Page() {
  const matches = await listMatches();
  const round = matches.find((match) => match.round)?.round ?? "Liga MX";
  return (
    <Periodico>
      <article className="section-page fixtures-page">
        <p className="kicker">{round}</p>
        <h2>Jornada</h2>
        <p>Estos son los partidos que API-Football ya confirmó. El marcador aparece cuando el partido lo tiene, no antes.</p>
        {matches.length === 0 ? (
          <div className="empty-board">
            <strong>Edición vacía</strong>
            <span>Todavía no hay partidos guardados en esta ventana.</span>
          </div>
        ) : (
          <ul className="fixtures">
            {matches.map((match) => {
              const view = presentMatch(match);
              return (
                <li className="fixture" key={match.fixtureId}>
                  <strong className="home">{match.homeTeam}</strong>
                  <div className="mark">
                    <b>{view.center}</b>
                    <span>{view.detail}</span>
                  </div>
                  <strong className="away">{match.awayTeam}</strong>
                </li>
              );
            })}
          </ul>
        )}
      </article>
    </Periodico>
  );
}
