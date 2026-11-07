/** Smartphone-App: TRAVEL - Casino-Wechsel */
import type { GameView } from '../store/types';
import { worldStore } from '../store/use-world-store';

export function SmartphoneTravel({ view, onBack, onClose }: { view: GameView; onBack: () => void; onClose: () => void }) {
  const rivals = ['HAFENKLAUSE', 'GOLDENE_HAND', 'NEBELPALAST'] as const;
  return (
    <div className="smartphone smartphone-app">
      <div className="smartphone-header">
        <button type="button" className="btn back" onClick={onBack}>← Zurück</button>
        <h3>Reisen</h3>
        <button type="button" className="btn close" onClick={onClose}>Schließen</button>
      </div>
      <div className="smartphone-list">
        {view.currentForeignFloorId !== null ? (
          <button type="button" className="btn travel-item" onClick={() => { worldStore.leaveForeign(); onClose(); }}>
            <span>Eigenes Casino verlassen</span><span>zurückkehren</span>
          </button>
        ) : (
          rivals.map((rivalId) => (
            <button key={rivalId} type="button" className="btn travel-item" onClick={() => { worldStore.visitForeign(rivalId); onClose(); }}>
              <span>{rivalId}</span><span>fremdes Casino betreten</span>
            </button>
          ))
        )}
      </div>
      <div className="smartphone-footer"><button type="button" className="btn secondary" onClick={onClose}>Schließen</button></div>
    </div>
  );
}
