/** Smartphone-App: SERVE - Getränke servieren */
import type { GameView } from '../store/types';
import { worldStore } from '../store/use-world-store';

export function SmartphoneServe({ view, onBack, onClose }: { view: GameView; onBack: () => void; onClose: () => void }) {
  const carryingDrink = view.player.carrying === 'DRINK';
  const thirstyGuests = view.guests.filter((g) => g.thirst > 50);
  return (
    <div className="smartphone smartphone-app">
      <div className="smartphone-header">
        <button type="button" className="btn back" onClick={onBack}>← Zurück</button>
        <h3>Servieren</h3>
        <button type="button" className="btn close" onClick={onClose}>Schließen</button>
      </div>
      <div className="smartphone-list">
        {!carryingDrink && (
          <button type="button" className="btn serve-item" onClick={() => { worldStore.takeDrink(); }} disabled={view.barLevel < 1}>
            <span>Drink zapfen</span><span>an der Bar</span>
          </button>
        )}
        {carryingDrink && thirstyGuests.length > 0 && (
          thirstyGuests.map((guest) => (
            <button key={guest.id} type="button" className="btn serve-item warm" onClick={() => { worldStore.serveDrink(guest.id); onClose(); }}>
              <span>Drink servieren</span><span>{guest.name}</span>
            </button>
          ))
        )}
        {!carryingDrink && !thirstyGuests.length && <div className="empty-state">Kein Durstiger Gast.</div>}
      </div>
      <div className="smartphone-footer"><button type="button" className="btn secondary" onClick={onClose}>Schließen</button></div>
    </div>
  );
}
