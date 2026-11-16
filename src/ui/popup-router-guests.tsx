/** Gaeste-Routing: Objektpanel am NPC und die bewusste Uebersicht als eigene Einheit. */
import type { ScreenAnchor } from '../render/floor-hit';
import type { GameView } from '../store/types';
import { worldStore } from '../store/use-world-store';
import type { Popup } from './app-model';
import { GuestContextPanel } from './guest-context-panel';
import { GuestPopup } from './guest-popup';
import type { AnchorProjector } from './use-world-anchor';

interface Props {
  readonly view: GameView;
  readonly guestId: number | null;
  readonly overview?: boolean;
  readonly anchor: ScreenAnchor | null;
  readonly project?: AnchorProjector;
  readonly onClose: () => void;
  readonly onOpen: (popup: Popup) => void;
}

/**
 * Ein NPC-Klick oeffnet das Objektpanel am Ziel. Die volle Liste bleibt eine
 * bewusste Uebersicht und behaelt die Auswahl.
 */
export function GuestsRoute({ view, guestId, overview, anchor, project, onClose, onOpen }: Props) {
  if (guestId !== null && !overview) {
    return (
      <GuestContextPanel
        view={view}
        guestId={guestId}
        anchor={anchor}
        project={project}
        onClose={onClose}
        onOpenOverview={(id) => onOpen({ kind: 'guests', guestId: id, overview: true })}
        onPay={(id) => worldStore.pay(id)}
        onServe={(id) => worldStore.serveDrink(id)}
        onCalm={(id) => worldStore.calm(id)}
        onTalk={(id) => worldStore.talk(id)}
        onFight={(id) => worldStore.fightBrawl(id)}
        onProfile={(visitorId) => onOpen({ kind: 'narrative', visitorId })}
        onDialogue={(id) => onOpen({ kind: 'dialogue', guestId: id })}
      />
    );
  }
  return (
    <GuestPopup
      view={view}
      selectedId={guestId}
      onClose={onClose}
      onPay={(id) => worldStore.pay(id)}
      onServe={(id) => worldStore.serveDrink(id)}
      onCalm={(id) => worldStore.calm(id)}
      onTalk={(id) => worldStore.talk(id)}
      onFight={(id) => worldStore.fightBrawl(id)}
      onProfile={(visitorId) => onOpen({ kind: 'narrative', visitorId })}
    />
  );
}
