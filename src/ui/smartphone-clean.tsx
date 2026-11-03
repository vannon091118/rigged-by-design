/** Smartphone-App: CLEAN - Putzen */
import type { GameView } from '../store/types';
import { worldStore } from '../store/use-world-store';

export function SmartphoneClean({ view, onBack, onClose }: { view: GameView; onBack: () => void; onClose: () => void }) {
  const dirty = view.dirtyTiles.size;
  const carryingMop = view.player.carrying.startsWith('MOP:');
  const firstStain = view.stains?.[0];
  return (
    <div className="smartphone smartphone-app">
      <div className="smartphone-header">
        <button type="button" className="btn back" onClick={onBack}>← Zurück</button>
        <h3>Putzen</h3>
        <button type="button" className="btn close" onClick={onClose}>Schließen</button>
      </div>
      <div className="smartphone-list">
        {!carryingMop && (
          <button type="button" className="btn clean-item" onClick={() => { worldStore.getMopAtToilet(); }} disabled={dirty === 0}>
            <span>Wischer holen</span><span>an der Toilette</span>
          </button>
        )}
        {carryingMop && (
          <button type="button" className="btn clean-item" onClick={() => { worldStore.dropMop(); }}>
            <span>Wischer ablegen</span><span>bei sich selbst</span>
          </button>
        )}
        {dirty > 0 && carryingMop && firstStain && (
          <button type="button" className="btn clean-item warm" onClick={() => { worldStore.cleanStain(firstStain.id); }}>
            <span>Fleck reinigen</span><span>{dirty} übrig</span>
          </button>
        )}
        {!dirty && <div className="empty-state">Alles sauber.</div>}
      </div>
      <div className="smartphone-footer"><button type="button" className="btn secondary" onClick={onClose}>Schließen</button></div>
    </div>
  );
}
