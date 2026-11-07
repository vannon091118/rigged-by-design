/** Kisten im Betriebspanel: reine Statusanzeige. Aufheben und Abladen macht der Charakter auf dem Floor. */
import { getBuildDef, type BuildId } from '../core/sim/offers';
import type { GameView } from '../store/types';
import { ROLE_LABEL } from './staff-labels';

function crateTitle(buildId: BuildId): string {
  try {
    return getBuildDef(buildId).name;
  } catch {
    return 'Unbekanntes Möbel';
  }
}

export function CrateList({ view }: { view: GameView }) {
  const label = (id: number): string => {
    const crate = view.crates.find((entry) => entry.id === id);
    if (!crate) return 'Kiste';
    if (crate.payload.kind === 'FURNITURE') return crateTitle(crate.payload.buildId);
    if (crate.payload.kind === 'DRINKS') return `${crate.payload.count} Getränke`;
    return `${crate.payload.count} Ersatzteile`;
  };
  const carrier = (crate: GameView['crates'][number]): string => {
    if (crate.carriedBy === 'player') return 'trägst du – Enter setzt sie am Feld ab';
    if (typeof crate.carriedBy === 'number') {
      const agent = view.agents.find((entry) => entry.id === crate.carriedBy);
      return agent ? `unterwegs mit ${ROLE_LABEL[agent.role]}` : 'unterwegs';
    }
    return 'wartet am Eingang';
  };
  return (
    <div className="ops-row">
      {view.crates.length === 0 && <small className="muted">Keine Kisten am Eingang. Bestellte Ware kommt hier an.</small>}
      {view.crates.map((crate) => (
        <div key={crate.id} className="staff">
          <div><strong>{label(crate.id)}</strong>
            <small>{carrier(crate)}</small></div>
        </div>
      ))}
      {view.crates.length > 0 && (
        <small className="muted">
          Kiste auf dem Floor anklicken: der Charakter läuft hin und hebt sie auf. Zum Aufstellen auf eine freie Fläche klicken: er trägt sie hin und stellt sie ab.
        </small>
      )}
    </div>
  );
}
