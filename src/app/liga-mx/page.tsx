import { MatchList } from "@/components/MatchList";
import { Periodico } from "@/components/Periodico";
import { listMatches } from "@/lib/db/matches";

export const dynamic = "force-dynamic";

export default async function Page() {
  const matches = await listMatches();
  return (
    <Periodico>
      <article className="section-page fixtures-page">
        <p className="kicker">Liga MX</p>
        <h2>Liga MX</h2>
        <p>La liga 262, con los partidos que ya están en la base. Nada de esta página se inventa.</p>
        <MatchList matches={matches} empty="Todavía no hay partidos de Liga MX guardados." />
      </article>
    </Periodico>
  );
}
