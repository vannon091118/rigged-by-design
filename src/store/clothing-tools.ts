/** Kleidungskauf als eigener Command: Katalog, Ledger und Garderobe an einer Stelle. */
import type { VaCoinMicro } from '../core/economy/vacoin';
import type { Ledger } from '../core/economy/ledger';
import { PORTEMONNAIE } from '../core/sim/money';
import { buyItem, findClothingItem } from '../core/sim/player-look';
import type { WorldState } from '../core/sim/types';

export function buyClothingItem(world: WorldState, ledger: Ledger, itemId: string): string {
  const item = findClothingItem(itemId);
  if (!item) throw new Error('Kleidungsstück nicht im Katalog.');
  if (world.look.wardrobe.includes(itemId)) throw new Error('Bereits im Kleiderschrank.');
  const check = buyItem(ledger.getBalance(PORTEMONNAIE), itemId);
  if (!check.ok) throw new Error(check.error ?? 'Kauf fehlgeschlagen.');
  ledger.transfer(
    PORTEMONNAIE,
    'VENDOR_CLOTHING',
    item.priceVC as VaCoinMicro,
    `Kleidungskauf: ${item.name}`,
    world.tick,
  );
  world.look = { ...world.look, wardrobe: [...world.look.wardrobe, itemId] };
  return `Gekauft: ${item.name} (${item.brand}) für ${item.priceVC} VC.`;
}
