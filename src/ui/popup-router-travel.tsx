/** Reise-Routen: fremde Karte und fremdes Haus als eigene Zustaendigkeit. */
import type { GameView } from '../store/types';
import { worldStore } from '../store/use-world-store';
import type { Popup } from './app-model';
import { ForeignFloorMap } from './foreign-floor-map';
import { ForeignFloorPopup } from './foreign-floor-popup';

interface MapRouteProps {
  readonly view: GameView;
  readonly onOpen: (popup: Popup) => void;
}

/** Die Karte ist eine bewusste Uebersicht; der Besuch fuehrt direkt ins Haus. */
export function ForeignMapRoute({ view, onOpen }: MapRouteProps) {
  return (
    <ForeignFloorMap
      view={{
        currentForeignFloorId: view.currentForeignFloorId,
        foreignFloors: view.foreignFloors,
        wallet: view.wallet,
      }}
      onVisit={(rivalId) => {
        worldStore.visitForeign(rivalId);
        onOpen({ kind: 'foreignFloor' });
      }}
      onClose={() => onOpen(view.currentForeignFloorId !== null ? { kind: 'foreignFloor' } : null)}
    />
  );
}

interface FloorRouteProps {
  readonly view: GameView;
  readonly onClose: () => void;
  readonly onOpen: (popup: Popup) => void;
}

/** Im fremden Haus bleibt der Floor die Ansicht; Escape schliesst ihn. */
export function ForeignFloorRoute({ view, onClose, onOpen }: FloorRouteProps) {
  return (
    <ForeignFloorPopup
      key={view.currentForeignFloorId ?? 'none'}
      view={view}
      onClose={onClose}
      onOpenMap={() => onOpen({ kind: 'foreignMap' })}
      onOpenGames={(rivalId) => onOpen({ kind: 'games', rivalId })}
    />
  );
}
