/** Smartphone-App: ImmoLuck — Katalogangebote, Kauf ueber den bestehenden Stadt-Pfad. */
import type { GameView } from '../store/types';
import { worldStore } from '../store/use-world-store';
import { fromVC } from '../core/economy/vacoin';
import { vc } from './format';

export function SmartphoneImmoluck({ view, onBack, onClose }: { view: GameView; onBack: () => void; onClose: () => void }) {
  const { listings, property } = view.immoluck;
  return (
    <div className="smartphone smartphone-app">
      <div className="smartphone-header">
        <button type="button" className="btn back" onClick={onBack}>← Zurück</button>
        <h3>ImmoLuck</h3>
        <button type="button" className="btn close" onClick={onClose}>Schließen</button>
      </div>
      <p className="hint">
        Dieselben Angebote wie im Charakterfenster. Der Kauf bucht über den Haushaltspfad, nicht über ein zweites Konto.
      </p>
      <div className="smartphone-list">
        {property.owned !== null && (
          <p className="hint">Im Besitz: {property.owned.id} seit Tag {property.owned.day}.</p>
        )}
        {listings.map((listing) => (
          <div key={listing.id} className="smartphone-listing">
            <strong>{listing.label}</strong>
            <p>{listing.description}</p>
            <div className="smartphone-listing-actions">
              <span>{vc(fromVC(listing.priceVC))}</span>
              <button
                type="button"
                className="btn buy-item"
                disabled={listing.owned || property.owned !== null || !listing.affordable}
                onClick={() => { worldStore.city({ kind: 'buyProperty', propertyId: listing.id }); onClose(); }}
              >
                {listing.owned ? 'Im Besitz' : listing.affordable ? 'Kaufen' : 'Zu teuer'}
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="smartphone-footer"><button type="button" className="btn secondary" onClick={onClose}>Schließen</button></div>
    </div>
  );
}
