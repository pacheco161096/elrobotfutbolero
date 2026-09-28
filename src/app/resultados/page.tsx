import { MatchList } from "@/components/MatchList";
import { Periodico } from "@/components/Periodico";
import { listMatches } from "@/lib/db/matches";

export const dynamic = "force-dynamic";

const FINISHED = new Set(["FT", "POST_MATCH", "CLOSED", "ABD"]);

export default async function Page() {
  const matches = (await listMatches()).filter((match) => FINISHED.has(match.status));
  return (
    <Periodico>
      <article className="section-page fixtures-page">
        <p className="kicker">Resultados</p>
        <h2>Resultados</h2>
        <p>El marcador entra cuando el partido ya lo cerró. Esta página no adelanta ni inventa un resultado.</p>
        <MatchList matches={matches} empty="En esta ventana todavía no hay finales guardados." />
      </article>
    </Periodico>
  );
}
