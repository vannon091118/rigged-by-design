/** Smartphone-App: BUY - Getränke, Ersatzteile kaufen */
import type { GameView } from '../store/types';
import { worldStore } from '../store/use-world-store';
import { vc } from './format';

export function SmartphoneBuy({ view, onBack, onClose }: { view: GameView; onBack: () => void; onClose: () => void }) {
  return (
    <div className="smartphone smartphone-app">
      <div className="smartphone-header">
        <button type="button" className="btn back" onClick={onBack}>← Zurück</button>
        <h3>Kaufen</h3>
        <button type="button" className="btn close" onClick={onClose}>Schließen</button>
      </div>
      <div className="smartphone-list">
        <button type="button" className="btn buy-item" onClick={() => { worldStore.orderDrinks(1); onClose(); }}>
          <span>Getränkekiste</span><span>{vc(view.prices.drinkCrateCost)}</span>
        </button>
        <button type="button" className="btn buy-item" onClick={() => { worldStore.orderParts(1); onClose(); }}>
          <span>Ersatzteil</span><span>{vc(view.prices.partCost)}</span>
        </button>
      </div>
      <div className="smartphone-footer"><button type="button" className="btn secondary" onClick={onClose}>Schließen</button></div>
    </div>
  );
}
