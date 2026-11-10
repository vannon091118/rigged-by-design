/** Aktivitaets-Routen: eigenes Geraet und fremdes Haus mit ihrer Verdrahtung. */
import type { RivalId } from '../core/sim/types';
import type { ScreenAnchor } from '../render/floor-hit';
import type { GameView } from '../store/types';
import { worldStore } from '../store/use-world-store';
import type { Popup, Perspective } from './app-model';
import { GamesPopup } from './games-popup-lazy';
import { MachinePopup } from './machine-popup';
import type { AnchorProjector } from './use-world-anchor';

interface MachineRouteProps {
  readonly view: GameView;
  readonly perspective: Perspective;
  readonly itemId: number;
  readonly onClose: () => void;
  /** Weltposition des Geraets, das das Panel geoeffnet hat. */
  readonly anchor?: ScreenAnchor | null;
  readonly project?: AnchorProjector;
}

/** Ein Geraet ist sein eigenes Menue: Diagnose, Betrieb und Testspin an einem Ort. */
export function MachineRoute({ view, perspective, itemId, onClose, anchor = null, project }: MachineRouteProps) {
  const item = view.furniture.find((entry) => entry.id === itemId);
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

interface GamesRouteProps {
  readonly view: GameView;
  readonly rivalId?: RivalId;
  readonly onOpen: (popup: Popup) => void;
}

/** Das fremde Haus behaelt seine Aktivitaetsansicht; Escape fuehrt zurueck. */
export function GamesRoute({ view, rivalId, onOpen }: GamesRouteProps) {
  return (
    <GamesPopup
      view={view}
      initialRivalId={rivalId}
      onClose={() => onOpen(view.currentForeignFloorId !== null ? { kind: 'foreignFloor' } : null)}
      onPlay={(id, machineIndex, betVC, options) => worldStore.playRival(id, machineIndex, betVC, options)}
      onRisk={(id, color, stakeVC) => worldStore.riskCard(id, color, stakeVC)}
      onShellRound={() => worldStore.shellRound()}
      onDealCard={(id, machineIndex, stakeVC) => worldStore.dealCard(id, machineIndex, stakeVC)}
      onSettleCard={(id, machineIndex, stakeVC, engineBps, label) => worldStore.settleCard(id, machineIndex, stakeVC, engineBps, label)}
      onAdditionalBet={(amountVC) => worldStore.additionalBet(amountVC)}
      onTakeHome={() => worldStore.takeHome(5)}
      onExclusion={(command, limitVC) => worldStore.exclusion(command, limitVC)}
    />
  );
}
