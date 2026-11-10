/** Betriebs-Panel: verdrahtet das Panel mit dem Store; App haelt nur den Schalter. */
import type { BuildId } from '../core/sim/offers';
import type { CarpetId, TemplateId } from '../core/sim/types';
import type { GameView } from '../store/types';
import { worldStore } from '../store/use-world-store';
import { BuildPanel } from './build-panel';

interface Props {
  readonly view: GameView;
  readonly onClose: () => void;
  /** Der Kaufpfad bleibt in App: Kiste, Drop und Panel teilen ihn. */
  readonly onBuy: (id: BuildId) => void;
}

export function ConnectedBuildPanel({ view, onClose, onBuy }: Props) {
  return (
    <BuildPanel
      view={view}
      onClose={onClose}
      onBuy={onBuy}
      onTemplate={(id: TemplateId) => worldStore.setTemplate(id)}
      onHire={(role) => worldStore.hire(role)}
      onFire={(role) => worldStore.fire(role)}
      onPrice={(key, value) => worldStore.setPrice(key, value)}
      onCarpet={(id: CarpetId) => worldStore.setCarpet(id)}
      onRepair={(id) => worldStore.repair(id)}
      onClean={() => worldStore.clean()}
      onOrderDrinks={(count) => worldStore.orderDrinks(count)}
      onOrderParts={(count) => worldStore.orderParts(count)}
      onUpgradeBar={() => worldStore.upgradeBar()}
      onUpgradeWc={() => worldStore.upgradeWc()}
      onWall={(color) => worldStore.setWall(color)}
      onNeon={(color) => worldStore.setNeon(color)}
      onServeDesk={() => worldStore.serveDesk()}
      onCalm={(id) => worldStore.calm(id)}
    />
  );
}
