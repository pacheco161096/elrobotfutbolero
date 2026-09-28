import type { ListedMatch } from "@/lib/db/matches";
import { presentMatch } from "@/lib/matches/present";

export function MatchList({ matches, empty }: { matches: ListedMatch[]; empty: string }) {
  if (matches.length === 0) {
    return (
      <div className="empty-board">
        <strong>Edición vacía</strong>
        <span>{empty}</span>
      </div>
    );
  }
  return (
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
  );
}
