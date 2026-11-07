/** Spieler-Commands, die der Store nur noch bestaetigt. */
import { fromVC, toVCString, ZERO_VC, type VaCoinMicro } from '../core/economy/vacoin';
import type { Ledger } from '../core/economy/ledger';
import { HAUSKONTO, HOUSE_FLOAT, playerTakeHome } from '../core/sim/money';
import { deployHeldCrate, movePlayer, storeHeldCrate } from '../core/sim/player';
import { applyLook, type PlayerLook } from '../core/sim/player-look';
import type { WorldState } from '../core/sim/types';

export function saveLook(world: WorldState, patch: Partial<PlayerLook>): string {
  world.look = applyLook(world.look, patch);
  return 'Look gespeichert.';
}

/** Ein Feld in Richtung; nearestWalkable und Pfadfinder erledigen den Rest. */
export function stepPlayer(world: WorldState, dx: number, dy: number): void {
  const pos = world.player.position;
  movePlayer(world, { x: pos.x + dx, y: pos.y + dy });
}

/** Getragene Möbelkiste direkt am Spieler aufstellen. */
export function deployAtPlayer(world: WorldState): string {
  const pos = world.player.position;
  deployHeldCrate(world, pos.x, pos.y);
  return world.lastEvent;
}

/** Enter: Möbel aufstellen oder Getränke/Teile am aktuellen Feld abladen. */
export function useCarriedAtPlayer(world: WorldState): string | null {
  const match = /^KRATE:(\d+)$/.exec(world.player.carrying);
  if (!match) return null;
  const crate = world.crates.find((entry) => entry.id === Number(match[1]));
  if (crate?.payload.kind === 'FURNITURE') return deployAtPlayer(world);
  const pos = world.player.position;
  const bar = world.furniture.find((item) => item.kind === 'BAR'
    && Math.abs(item.x - pos.x) + Math.abs(item.y - pos.y) <= 3);
  storeHeldCrate(world, pos.x, pos.y, bar?.id);
  return world.lastEvent;
}

/** Abheben vom Hauskonto; die Betriebsreserve bleibt unangetastet. */
export function takeHomeToWallet(world: WorldState, ledger: Ledger, amountVC: number): string {
  const available = (ledger.getBalance(HAUSKONTO) - HOUSE_FLOAT) as VaCoinMicro;
  const amount = Math.min(fromVC(amountVC), available) as VaCoinMicro;
  if (amount <= ZERO_VC) throw new Error('5 VC bleiben als Betriebsreserve im Hauskonto.');
  playerTakeHome(ledger, amount, world.tick);
  return `${toVCString(amount)} ins Portemonnaie.`;
}
