/** Popup-Routing: eine Zustaendigkeit, damit App nur noch verdrahtet. */
import type { ScreenAnchor } from '../render/floor-hit';
import type { GameView } from '../store/types';
import { worldStore } from '../store/use-world-store';
import type { Perspective, Popup } from './app-model';
import type { AnchorProjector } from './use-world-anchor';
import { CityPopup } from './city-popup';
import { DIALOGUE_SCRIPTS } from '../core/sim/narrative/dialogue/scripts';
import { findDialogueScript } from '../core/sim/narrative/dialogue/select';
import { DialoguePopup } from './dialogue-popup';
import { dialogIdFromExecution } from './dialog-request';
import { GuestContextPanel } from './guest-context-panel';
import { GuestPopup } from './guest-popup';
import { LookPopup } from './look-popup';
import { NarrativePopup } from './narrative-popup';
import { GamesRoute, MachineRoute } from './popup-router-activity';
import { ForeignFloorRoute, ForeignMapRoute } from './popup-router-travel';
import { WorkshopPopup } from './workshop';

interface RouterProps {
  readonly view: GameView;
  readonly perspective: Perspective;
  readonly popup: Popup;
  readonly onClose: () => void;
  readonly onOpen: (popup: Popup) => void;
  /** Das Bau-Panel ist keine Popup-Ebene, sondern eine eigene Spalte. */
  readonly onStaff: () => void;
  /** Weltposition des Objekts, das diesen Popup geoeffnet hat. */
  readonly anchor?: ScreenAnchor | null;
  /** Projektion des Weltankers; ohne sie bleibt das Panel am Klick stehen. */
  readonly project?: AnchorProjector;
}

export function PopupRouter({ view, perspective, popup, onClose, onOpen, onStaff, anchor = null, project }: RouterProps) {
  if (popup === null) return null;

  if (popup.kind === 'guests') {
    // Ein NPC-Klick oeffnet das Objektpanel am Ziel. Die volle Liste bleibt
    // eine bewusste Uebersicht und behaelt die Auswahl.
    if (popup.guestId !== null && !popup.overview) {
      return (
        <GuestContextPanel
          view={view}
          guestId={popup.guestId}
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
        />
      );
    }
    return (
      <GuestPopup
        view={view}
        selectedId={popup.guestId}
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

  if (popup.kind === 'machine') {
    return (
      <MachineRoute
        view={view}
        perspective={perspective}
        itemId={popup.itemId}
        anchor={anchor}
        project={project}
        onClose={onClose}
      />
    );
  }

  if (popup.kind === 'games') {
    return <GamesRoute view={view} rivalId={popup.rivalId} onOpen={onOpen} />;
  }

  if (popup.kind === 'narrative') {
    return (
      <NarrativePopup
        view={view}
        initialVisitorId={popup.visitorId}
        onClose={onClose}
        onChoose={(eventId, choiceId) => {
          const dialogId = dialogIdFromExecution(worldStore.chooseNarrative(eventId, choiceId));
          if (dialogId) onOpen({ kind: 'dialogue', scriptId: dialogId });
        }}
        onDismiss={(eventId) => worldStore.dismissNarrative(eventId)}
      />
    );
  }

  if (popup.kind === 'foreignMap') {
    return <ForeignMapRoute view={view} onOpen={onOpen} />;
  }

  if (popup.kind === 'foreignFloor') {
    return <ForeignFloorRoute view={view} onClose={onClose} onOpen={onOpen} />;
  }

  if (popup.kind === 'city') {
    return <CityPopup city={view.city} onClose={onClose} />;
  }

  if (popup.kind === 'dialogue') {
    const script = (popup.scriptId ? findDialogueScript(popup.scriptId) : null) ?? DIALOGUE_SCRIPTS[0]!;
    return (
      <DialoguePopup
        script={script}
        onClose={onClose}
        onOpenGames={() => onOpen({ kind: 'games' })}
        onOpenStaff={onStaff}
        onOpenJournal={() => onOpen({ kind: 'workshop', tool: 'journal' })}
      />
    );
  }

  if (popup.kind === 'look') {
    return (
      <LookPopup
        view={view}
        onClose={onClose}
        onLook={(patch) => worldStore.setLook(patch)}
        onChallenge={() => worldStore.city({ kind: 'backyardFight' })}
        onBuyProperty={(propertyId) => worldStore.city({ kind: 'buyProperty', propertyId })}
        onRenovate={() => worldStore.city({ kind: 'renovate' })}
      />
    );
  }

  if (popup.kind === 'workshop') {
    return (
      <WorkshopPopup
        view={view}
        tool={popup.tool}
        onClose={onClose}
        onGuest={(id) => onOpen({ kind: 'guests', guestId: id })}
      />
    );
  }

  return null;
}
