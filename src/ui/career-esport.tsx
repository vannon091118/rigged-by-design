/** Stadtliga im bestehenden Charakterfenster: Tabelle und Rollen aus derselben Ableitung. */
import { useWorldStore } from '../store/use-world-store';

export function CareerEsport() {
  const esport = useWorldStore().career.esport;
  if (esport.teams.length === 0) return null;
  return (
    <>
      <div className="career-grid" aria-label="E-Sport-Liga">
        <div><span>Liga</span><b>{esport.league} · Saison {esport.season}</b></div>
        <div><span>Teams</span><b>{esport.teams.length}</b></div>
        <div><span>Führend</span><b>{esport.homeTeam}</b></div>
        <div><span>Turniere</span><b>{esport.history.length}</b></div>
      </div>
      <ul className="career-property-offers" aria-label="E-Sport-Tabelle">
        {esport.teams.map((team, index) => (
          <li key={team.id}>
            <div>
              <b>{index + 1}. {team.name}</b>
              <small>{team.tactic} · Form {team.form} · {team.players.map((player) => player.role).join(' / ')}</small>
            </div>
            <span>{team.strength}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
