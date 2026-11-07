/**
 * @test-target: src/store/save.ts
 * @error-code: ERR-1002
 *
 * Ein v5-Spielstand behaelt Fiat und offene Ansprueruche beim Laden.
 */
import { describe, expect, it } from 'vitest';
import { fromVC } from '../../core/economy/vacoin';
import { replaySave } from '../save';

const GUEST = {
  id: 1, name: 'Testgast', persona: 'STREET', fiat: fromVC(2), mood: 50, patience: 60, addiction: 90,
  sociability: 40, state: 'ENTER', stateTicks: 0, position: { x: 1, y: 1 }, path: [], pathIndex: 0,
  targetFurniture: 0, targetZone: 'entrance', queueIndex: 0, need: 'play', anger: 0, dirtTimer: 0,
  lastResult: '', spins: 0,
};

function legacyV5(overrides: Record<string, unknown> = {}) {
  return {
    version: 5,
    template: 'SMALL',
    carpet: 'VIOLET',
    furniture: [],
    guests: [GUEST],
    player: { position: { x: 2, y: 2 }, path: [], pathIndex: 0, carrying: '' },
    dirty: [],
    prices: {
      entryFee: 0, drinkPrice: fromVC(0.4), slotMinBet: fromVC(0.05), staffWage: fromVC(4),
      guardWage: fromVC(6), cleaningCost: fromVC(0.8), repairCost: fromVC(2),
    },
    staff: { guard: false, cleaner: false, bartender: false },
    tick: 12,
    day: 1,
    nextGuestId: 2,
    nextFurnitureId: 100,
    guardsHired: 0,
    lastEvent: 'v5 stand',
    entries: [
      { tick: 3, from: 'EXTERNAL_WORLD', to: 'VISITOR_1', amount: fromVC(3), reason: 'gast 1 chips' },
      { tick: 4, from: 'EXTERNAL_WORLD', to: 'PENDING_1', amount: fromVC(1), reason: 'gast 1 gewinn' },
    ],
    prngState: 4242,
    ...overrides,
  };
}

describe('Save-Migration v5 auf v6', () => {
  it('bucht mitgebrachtes Fiat beim Laden als Konto und behaelt offene Ansprueruche', () => {
    const loaded = replaySave(legacyV5())!;
    expect(loaded.ledger.getBalance('FIAT_1')).toBe(fromVC(2));
    expect(loaded.ledger.getBalance('VISITOR_1')).toBe(fromVC(3));
    expect(loaded.ledger.getBalance('PENDING_1')).toBe(fromVC(1));
    expect(loaded.ledger.verifyLedgerIntegrity()).toBe(true);
    expect(loaded.prngState).toBe(4242);
    expect(loaded.world.guests[0]).not.toHaveProperty('fiat');
    expect(loaded.world.tick).toBe(12);
  });

  it('bucht Fiat beim zweiten Laden nicht doppelt', () => {
    const first = replaySave(legacyV5())!;
    expect(first.ledger.getBalance('FIAT_1')).toBe(fromVC(2));
    const again = replaySave(legacyV5())!;
    expect(again.ledger.getBalance('FIAT_1')).toBe(fromVC(2));
  });

  it('laedt eine gebuchte Schuld aus v6 ohne Unterdeckung wieder', () => {
    const loaded = replaySave(legacyV5({
      version: 6,
      guests: [{ ...GUEST, fiat: undefined }],
      entries: [
        { tick: 1, from: 'EXTERNAL_WORLD', to: 'HAUSKONTO', amount: fromVC(1), reason: 'einsatz' },
        { tick: 2, from: 'HAUSKONTO', to: 'PENDING_1', amount: fromVC(1), reason: 'gewinn' },
        { tick: 3, from: 'HAUS_SCHULDEN', to: 'PENDING_1', amount: fromVC(0.5), reason: 'gewinn auf kredit' },
      ],
    }))!;
    expect(loaded.ledger.getBalance('HAUS_SCHULDEN')).toBe(-fromVC(0.5));
    expect(loaded.ledger.getBalance('PENDING_1')).toBe(fromVC(1.5));
    expect(loaded.ledger.verifyLedgerIntegrity()).toBe(true);
  });

  it('verwirft einen Stand ohne Template nicht still', () => {
    expect(replaySave(legacyV5({ template: undefined }))).toBeNull();
  });
});
