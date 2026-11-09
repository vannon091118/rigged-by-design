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
import { ForeignFloorMap } from './foreign-floor-map';
import { ForeignFloorPopup } from './foreign-floor-popup';
import { GamesPopup } from './games-popup-lazy';
import { GuestContextPanel } from './guest-context-panel';
import { GuestPopup } from './guest-popup';
import { LookPopup } from './look-popup';
import { MachinePopup } from './machine-popup';
import { NarrativePopup } from './narrative-popup';
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
    const item = view.furniture.find((entry) => entry.id === popup.itemId);
    if (!item) return null;
    return (
      <MachinePopup
        item={item}
        view={view}
        perspective={perspective}
        anchor={anchor}
        project={project}
        onClose={onClose}
        onTest={() => worldStore.spinTest(item.id)}
        onRepair={() => worldStore.repair(item.id)}
        onMod={(id) => worldStore.installMod(item.id, id)}
        onAddReel={() => worldStore.addReel(item.id)}
        onBet={(value) => worldStore.setBet(item.id, value)}
        onSlotOdds={(profile) => worldStore.setSlotOdds(item.id, profile)}
        onTakeDrink={() => worldStore.takeDrink()}
        onDeployPlinko={(config) => worldStore.deployPlinko(config)}
        onPlinkoMode={(mode) => worldStore.setPlinkoMode(mode)}
        onWithdraw={() => worldStore.takeHome(5)}
        onPlay={(betVC, options) => worldStore.own.spin(item.id, betVC, options)}
        onDeal={(stakeVC) => worldStore.own.deal(item.id, stakeVC)}
        onSettle={(stakeVC, engineBps, label) => worldStore.own.settle(item.id, stakeVC, engineBps, label)}
        onAdditionalBet={(amountVC) => worldStore.own.additional(item.id, amountVC)}
        onShellRound={() => worldStore.shellRound()}
        onRisk={(color, stakeVC) => worldStore.own.risk(item.id, color, stakeVC)}
      />
    );
  }

  if (popup.kind === 'games') {
    return (
      <GamesPopup
        view={view}
        initialRivalId={popup.rivalId}
        onClose={() => onOpen(view.currentForeignFloorId !== null ? { kind: 'foreignFloor' } : null)}
        onPlay={(rivalId, machineIndex, betVC, options) => worldStore.playRival(rivalId, machineIndex, betVC, options)}
        onRisk={(rivalId, color, stakeVC) => worldStore.riskCard(rivalId, color, stakeVC)}
        onShellRound={() => worldStore.shellRound()}
        onDealCard={(rivalId, machineIndex, stakeVC) => worldStore.dealCard(rivalId, machineIndex, stakeVC)}
        onSettleCard={(rivalId, machineIndex, stakeVC, engineBps, label) => worldStore.settleCard(rivalId, machineIndex, stakeVC, engineBps, label)}
        onAdditionalBet={(amountVC) => worldStore.additionalBet(amountVC)}
        onTakeHome={() => worldStore.takeHome(5)}
        onExclusion={(command, limitVC) => worldStore.exclusion(command, limitVC)}
      />
    );
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

  if (popup.kind === 'foreignFloor') {
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
