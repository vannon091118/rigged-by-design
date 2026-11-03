/** Smartphone-App: BUILD - ersetzt BuildPanel */
import type { GameView } from '../store/types';
import { worldStore } from '../store/use-world-store';
import type { BuildId } from '../core/sim/offers';
import { getBuildDef } from '../core/sim/offers';
import { vc } from './format';

export function SmartphoneBuild({ view, onBack, onClose }: { view: GameView; onBack: () => void; onClose: () => void }) {
  const buildIds: BuildId[] = ['SLOT', 'PLINKO', 'BLACKJACK', 'POKER', 'VIDEO_POKER', 'ROULETTE', 'SHELL', 'DICE', 'PLANT', 'SOFA'];
  return (
    <div className="smartphone smartphone-app">
      <div className="smartphone-header">
        <button type="button" className="btn back" onClick={onBack}>← Zurück</button>
        <h3>Bauen</h3>
        <button type="button" className="btn close" onClick={onClose}>Schließen</button>
      </div>
      <div className="smartphone-list">
        {buildIds.map((id) => {
          const def = getBuildDef(id);
          const affordable = view.house >= def.cost;
          return (
            <button key={id} type="button" className={`btn build-item${affordable ? '' : ' disabled'}`} onClick={() => { worldStore.buy(id); onClose(); }} disabled={!affordable}>
              <div className="build-info"><span className="build-name">{def.name}</span><span className="build-cost">{vc(def.cost)}</span></div>
              <span className="build-kind">{def.kind}</span>
            </button>
          );
        })}
      </div>
      <div className="smartphone-footer"><button type="button" className="btn secondary" onClick={onClose}>Schließen</button></div>
    </div>
  );
}
