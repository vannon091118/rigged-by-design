/** @test-target: src/core/sim/guests.ts | @error-code: ERR-2001 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC, toVCString } from '../../economy/vacoin';
import { Prng } from '../../rng/prng';
import { repair, settleGuests } from '../actions';
import { serveDrink, takeDrink } from '../player';
import { chooseActivity, payAndLeave } from '../guests';
import { fiatAccount, guestAccount, HAUSKONTO, pendingAccount } from '../money';
import { attractionValue, MODS, offerScore } from '../offers';
import { spawnGuest } from '../spawn';
import { createWorld } from '../templates';
import { tickWorld } from '../tick';
import { makeGuest, randomPersona } from '../traits';
import type { WorldState } from '../types';
import { canPlace, doorPoint, exchangePoint, freeSeat, interactionPoint, spawnPoint } from '../world';
import { randomSeed } from '../../../test/random-seed';

function setup(template: WorldState['template'] = 'SMALL') {
  const world = createWorld(template);
  const ledger = new Ledger();
  return { world, ledger, prng: new Prng(randomSeed()) };
}

describe('Welt und Startzustand', () => {
  it('startet mit leerem Ledger und genau einem gratis Spielautomaten', () => {
    const { world, ledger } = setup();
    expect(ledger.getBalance(HAUSKONTO)).toBe(0);
    expect(ledger.circulating).toBe(0);
    const machines = world.furniture.filter((item) => item.gameId);
    expect(machines).toHaveLength(1);
    expect(machines[0]!.price).toBe(0);
    for (const kind of ['EXCHANGE', 'BAR', 'TOILET'] as const) {
      expect(world.furniture.some((item) => item.kind === kind)).toBe(true);
    }
  });
  it('spawnt draussen vor der Tuer, nicht im Gebaeude', () => {
    const { world, ledger, prng } = setup();
    const guest = spawnGuest(world, prng, ledger)!;
    const entrance = world.zones.find((zone) => zone.kind === 'ENTRANCE')!;
    expect(guest.position.x).toBeLessThan(entrance.x);
  });
  it('verteilt 200 Punkte auf Laune, Geduld und Sucht', () => {
    const prng = new Prng(randomSeed());
    for (let index = 0; index < 20; index += 1) {
      const guest = makeGuest({
        id: index + 1, persona: randomPersona(prng, 'SMALL'), prng,
        spawn: { x: 1, y: 1 },
      });
      for (const value of [guest.mood, guest.patience, guest.addiction]) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      }
      expect(guest.mood + guest.patience + guest.addiction).toBe(180);
      expect(guest.sociability).toBeGreaterThanOrEqual(30);
      expect(guest.sociability).toBeLessThanOrEqual(100);
    }
  });
  it('spawnt vor der Tuer ausserhalb des Gebaeudes und wechselt nur an der Kasse Geld', () => {
    const { world, ledger, prng } = setup();
    const guest = spawnGuest(world, prng, ledger)!;
    const entrance = world.zones.find((zone) => zone.kind === 'ENTRANCE')!;
    const door = doorPoint(world);
    expect(guest.position).toEqual(door);
    expect(door.x).toBeLessThan(entrance.x);
    expect(ledger.getBalance(guestAccount(guest.id))).toBe(0);
    expect(ledger.getBalance(fiatAccount(guest.id))).toBeGreaterThan(0);
    // Fokussiert auf den Wechsel am Schalter; die Weglaenge haengt von der
    // zufaelligen Persona ab und ist nicht Teil dieser Zusicherung.
    guest.position = { ...exchangePoint(world)! };
    guest.state = 'EXCHANGE';
    guest.queueIndex = 0;
    guest.stateTicks = 1;
    guest.path = [];
    for (let step = 0; step < 10 && ledger.getBalance(guestAccount(guest.id)) === 0; step += 1) {
      tickWorld(world, ledger, prng);
    }
    expect(ledger.getBalance(guestAccount(guest.id))).toBeGreaterThan(0);
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
  });
});

describe('Angebot und Mods', () => {
  it('Mods erhoehen Anziehung und veraendern Geduld', () => {
    const { world } = setup();
    const slot = world.furniture.find((item) => item.kind === 'SLOT')!;
    const before = attractionValue(slot);
    slot.mods.push('NEON');
    expect(attractionValue(slot)).toBeGreaterThan(before);
    expect(MODS.find((mod) => mod.id === 'NEON')!.patience).toBeGreaterThan(0);
  });
  it('Persona-Geschmack beeinflusst die Platzwahl', () => {
    const { world, ledger, prng } = setup('MEDIUM');
    const guest = makeGuest({ id: 1, persona: 'BUSINESS', prng, spawn: spawnPoint(world) });
    const wallet = ledger.getBalance(guestAccount(1));
    const slots = world.furniture.filter((item) => item.gameId === 'SLOT' && freeSeat(item));
    const tables = world.furniture.filter((item) => item.gameId === 'BLACKJACK' && freeSeat(item));
    const slotScore = Math.max(...slots.map((item) => offerScore(world, guest, item, fromVC(30))));
    const tableScore = Math.max(...tables.map((item) => offerScore(world, guest, item, fromVC(30))));
    expect(wallet).toBe(0);
    expect(tableScore).toBeGreaterThan(slotScore);
  });
});

describe('Geld und Umbau', () => {
  it('baut nicht auf Spieler oder Gast', () => {
    const { world, ledger, prng } = setup();
    world.player.position = { x: 20, y: 12 };
    expect(canPlace(world, 20, 12, 1, 1)).toBe(false);
    const guest = spawnGuest(world, prng, ledger)!; expect(canPlace(world, guest.position.x, guest.position.y, 1, 1)).toBe(false);
  });
  it('repariert fuer einen festen Preis und hebt DEFEKT auf', () => {
    const { world, ledger } = setup();
    ledger.transfer('EXTERNAL_WORLD', HAUSKONTO, fromVC(100), 'testguthaben', 0);
    const slot = world.furniture.find((item) => item.kind === 'SLOT')!;
    slot.condition = 40;
    slot.damaged = true;
    repair(world, ledger, slot.id);
    expect(slot.condition).toBe(100);
    expect(slot.damaged).toBe(false);
    expect(ledger.getBalance(HAUSKONTO)).toBe(fromVC(100) - world.prices.repairCost);
  });
  it('laesst beim Umbau keine Gaeste-Guthaben in alten Konten haengen', () => {
    const { world, ledger, prng } = setup();
    const guest = spawnGuest(world, prng, ledger)!;
    ledger.transfer('EXTERNAL_WORLD', guestAccount(guest.id), fromVC(5), 'test chips', 0);
    ledger.transfer('EXTERNAL_WORLD', pendingAccount(guest.id), fromVC(2), 'test win', 0);
    settleGuests(world, ledger);
    expect(world.guests).toHaveLength(0);
    expect(ledger.getBalance(guestAccount(guest.id))).toBe(0);
    expect(ledger.getBalance(pendingAccount(guest.id))).toBe(0);
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
  });
  it('laesst den Spieler einen Drink zapfen und am Gast abgeben', () => {
    const { world, ledger, prng } = setup();
    const bar = world.furniture.find((item) => item.kind === 'BAR')!;
    bar.stock = 2;
    const spot = interactionPoint(world, bar)!;
    world.player.position = { ...spot };
    takeDrink(world);
    expect(world.player.carrying).toBe('DRINK');
    const guest = spawnGuest(world, prng, ledger)!;
    world.player.position = { ...guest.position };
    guest.mood = 30;
    const before = guest.mood;
    serveDrink(world, ledger, guest.id);
    expect(guest.mood).toBeGreaterThan(before);
    expect(world.player.carrying).toBe('');
  });
  it('laesst Gastgewinne an der Kasse kurz warten, statt sie sofort auszuzahlen', () => {
    const { world, ledger, prng } = setup();
    const guest = spawnGuest(world, prng, ledger)!;
    world.guests = [guest]; guest.position = { ...exchangePoint(world)! };
    guest.state = 'CASHOUT'; guest.stateTicks = 0; guest.path = [];
    ledger.transfer('EXTERNAL_WORLD', pendingAccount(guest.id), fromVC(1), 'testgewinn', 0);
    tickWorld(world, ledger, prng);
    expect(guest.state).toBe('CASHOUT'); expect(ledger.getBalance(pendingAccount(guest.id))).toBe(fromVC(1));
  });
  it('gibt den Sitz beim Verlassen frei und raeumt verwaiste Reservierungen auf', () => {
    const { world, ledger, prng } = setup();
    const slot = world.furniture.find((item) => item.kind === 'SLOT')!;
    const guest = spawnGuest(world, prng, ledger)!;
    slot.occupants = [guest.id];
    guest.targetFurniture = slot.id;
    payAndLeave(world, ledger, guest);
    expect(slot.occupants).not.toContain(guest.id);

    slot.occupants = [999];
    tickWorld(world, ledger, prng);
    expect(slot.occupants).toEqual([]);
  });
  it('schickt Gaeste ohne Drinkgeld nicht an die Bar', () => {
    const { world, ledger, prng } = setup();
    const guest = spawnGuest(world, prng, ledger)!;
    const bar = world.furniture.find((item) => item.kind === 'BAR')!;
    ledger.transfer('EXTERNAL_WORLD', guestAccount(guest.id), fromVC(0.2), 'test chips', 0);
    guest.state = 'CHOOSE';
    guest.mood = 60;
    guest.patience = 80;
    guest.targetFurniture = 0;
    chooseActivity(world, guest, ledger, prng);
    expect(guest.targetFurniture).not.toBe(bar.id);
  });
  it('setzt keinen Gast auf einen besetzten Platz', () => {
    const { world, ledger, prng } = setup();
    const slot = world.furniture.find((item) => item.kind === 'SLOT')!;
    slot.occupants = [999];
    const guest = spawnGuest(world, prng, ledger)!;
    guest.state = 'CHOOSE';
    chooseActivity(world, guest, ledger, prng);
    expect(guest.targetFurniture).not.toBe(slot.id);
  });
  it('simuliert viele Ticks ohne negatives Konto und ohne Ledger-Leck', () => {
    const { world, ledger, prng } = setup('MEDIUM');
    for (let step = 0; step < 700; step += 1) tickWorld(world, ledger, prng);
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
    expect(ledger.getBalance(HAUSKONTO)).toBeGreaterThanOrEqual(0);
    expect(toVCString(ledger.circulating)).toMatch(/VC$/);
    expect(world.day).toBeGreaterThan(1);
  });
});
