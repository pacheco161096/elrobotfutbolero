import { MatchList } from "@/components/MatchList";
import { Periodico } from "@/components/Periodico";
import { listTeamMatches } from "@/lib/db/matches";

export const dynamic = "force-dynamic";

export default async function Page() {
  const matches = await listTeamMatches("Mexico");
  return (
    <Periodico>
      <article className="section-page fixtures-page">
        <p className="kicker">Selección</p>
        <h2>Selección Mexicana</h2>
        <p>Partidos del equipo varonil, el id 16 de API-Football. La selección femenil no entra en esta lista.</p>
        <MatchList matches={matches} empty="Todavía no hay partidos de la selección guardados en esta ventana." />
      </article>
    </Periodico>
  );
}
