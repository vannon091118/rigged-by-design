/** Laufende Pflege der Welt: Tageslohn, Miete, verwaiste Sitze und Gast-Laune. */
import type { Ledger } from '../economy/ledger';
import type { VaCoinMicro } from '../economy/vacoin';
import { TICKS_PER_DAY } from './demand';
import { dirtyNear } from './emotion';
import { becomeAngry } from './guests';
import { HAUSKONTO, STAFF, UTILITIES } from './money';
import { tickNeeds } from './needs';
import { tickPenaltyDays } from './penalty-pool';
import type { WorldState } from './types';

export function staffTick(world: WorldState, ledger: Ledger): void {
  if (world.staff.cleaner && world.dirty.size > 0 && world.tick % 4 === 0) {
    const first = [...world.dirty][0];
    if (first !== undefined) world.dirty.delete(first);
  }
  if (world.tick % TICKS_PER_DAY !== 0) return;
  world.day += 1;
  tickPenaltyDays(world);
  const wages = ((world.staff.guard ? world.prices.guardWage : 0)
    + (world.staff.cleaner ? world.prices.staffWage : 0)
    + (world.staff.bartender ? world.prices.staffWage : 0)
    + (world.staff.cashier ? world.prices.cashierWage : 0)
    + (world.staff.porter ? world.prices.porterWage : 0)) as VaCoinMicro;
  const rent = (world.prices.cleaningCost * 2) as VaCoinMicro;
  try {
    if (wages > 0) ledger.transfer(HAUSKONTO, STAFF, wages, 'personal', world.tick);
    ledger.transfer(HAUSKONTO, UTILITIES, rent, 'miete und strom', world.tick);
    world.lastEvent = `Tag ${world.day}. Löhne und Miete bezahlt.`;
  } catch {
    world.lastEvent = `Tag ${world.day}. Die Kasse reicht nicht für Löhne und Miete.`;
  }
}

/** Alte Saves und abgebrochene Gastpfade duerfen keinen Sitz dauerhaft blockieren. */
export function releaseOrphanSeats(world: WorldState): void {
  const present = new Set(world.guests.map((guest) => guest.id));
  for (const item of world.furniture) {
    if (!item.occupants.every((id) => present.has(id))) {
      item.occupants = item.occupants.filter((id) => present.has(id));
    }
  }
}

export function decay(world: WorldState): void {
  const dirty = world.dirty;
  for (const guest of world.guests) {
    if (guest.state !== 'LEAVE') tickNeeds(world, guest);
    if (guest.state === 'ANGRY') continue;
    const spotted = dirtyNear(dirty, world.size, guest.position.x, guest.position.y, 2);
    if (spotted) {
      guest.mood = Math.max(0, guest.mood - 0.12);
      guest.patience = Math.max(0, guest.patience - 0.06);
    } else {
      guest.mood = Math.min(100, guest.mood + 0.03);
      guest.patience = Math.min(100, guest.patience + 0.02);
    }
    if (guest.state === 'CHOOSE' || guest.state === 'WAIT') guest.mood = Math.max(0, guest.mood - 0.04);
    // Wer schon geht oder ausgezahlt wird, randaliert nicht mehr; sonst dreht der Gast endlos zwischen ANGRY und CASHOUT.
    if (guest.mood < 20 && guest.state !== 'LEAVE' && guest.state !== 'CASHOUT') {
      becomeAngry(world, guest);
    }
  }
}
