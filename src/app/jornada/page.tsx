import { MatchList } from "@/components/MatchList";
import { Periodico } from "@/components/Periodico";
import { listMatches } from "@/lib/db/matches";

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
        <MatchList matches={matches} empty="Todavía no hay partidos guardados en esta ventana." />
      </article>
    </Periodico>
  );
}
