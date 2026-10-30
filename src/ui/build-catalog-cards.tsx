/** Katalog-Karten: kaufbare Spiele und Deko als Drag-fähige Bau-Karten. Reine Darstellung. */
import { BUILD_DEFS, type BuildId } from '../core/sim/offers';
import type { GameView } from '../store/types';
import { vc } from './format';

interface BuildCatalogCardsProps {
  readonly view: GameView;
  readonly onBuy: (id: BuildId) => void;
}

export function BuildCatalogCards(props: BuildCatalogCardsProps) {
  const { view, onBuy } = props;
  return (
    <div className="build-grid">
      {BUILD_DEFS.map((def) => {
        const poor = view.house < def.cost;
        const facts = def.gameId
          ? `${def.seats} Plätze · Einsatz ab ${vc(def.baseBet, 2)}`
          : def.seats > 0 ? `${def.seats} Sitzplätze` : 'nur Optik und Ruf';
        return (
          <button
            key={def.id}
            type="button"
            draggable
            className={`build-card${poor ? ' poor' : ''}`}
            onDragStart={(event) => {
              event.dataTransfer.setData('text/build', def.id);
              event.dataTransfer.effectAllowed = 'copy';
            }}
            onClick={() => onBuy(def.id)}
            disabled={poor}
            title={poor
              ? `Hauskonto zu niedrig: ${vc(def.cost, 0)} nötig.`
              : `${def.name} kaufen – kommt als Kiste am Eingang an.`}
          >
            <span className="build-icon">{def.gameId ? '▦' : '✿'}</span>
            <strong>{def.name}</strong>
            <small>{def.description} {facts}</small>
            <b>{def.cost === 0 ? 'gratis' : vc(def.cost, 0)}</b>
          </button>
        );
      })}
    </div>
  );
}
