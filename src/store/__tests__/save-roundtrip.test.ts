/**
 * @test-target: src/store/save.ts
 * @error-code: ERR-1002
 *
 * Speichern, laden und danach exakt dieselbe Simulation fortsetzen.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../core/economy/ledger';
import { fromVC } from '../../core/economy/vacoin';
import { orderDrinks } from '../../core/sim/deliveries';
import { recordJournal, settleMoneyJournal } from '../../core/sim/journal';
import { hireAgent } from '../../core/sim/staff';
import { createWorld, ensureStarter } from '../../core/sim/templates';
import { tickWorld } from '../../core/sim/tick';
import { Prng } from '../../core/rng/prng';
import { buildView } from '../snapshot';
import { replaySave, toSavedGame } from '../save';
import { createNewGame } from '../new-game';
import { randomSeed } from '../../test/random-seed';
import { defaultPlinkoConfig, normalizePlinkoConfig } from '../../core/games/plinko-config';
import { economyOf } from '../../core/sim/economics';
import { playOwnRound } from '../../core/sim/own-play';

function fixture() {
  const world = createWorld('MEDIUM');
  ensureStarter(world);
  const ledger = new Ledger();
  ledger.transfer('EXTERNAL_WORLD', 'HAUSKONTO', fromVC(500), 'baukapital', 0);
  hireAgent(world, ledger, 'porter');
  orderDrinks(world, ledger, 6);
  const prng = new Prng(randomSeed());
  for (let step = 0; step < 40; step += 1) tickWorld(world, ledger, prng);
  settleMoneyJournal(world, ledger);
  recordJournal(world, {
    kind: 'SYSTEM', subject: 'Teststand', cause: 'Roundtrip', effect: 'Alles gespeichert.',
  });
  world.look = { skin: '#b97c4b', hair: '#d9b35c', outfit: '#ff2e88', accessory: 'GLASSES' };
  world.plinko = normalizePlinkoConfig({
    ...defaultPlinkoConfig(), pegs: [{ row: 1, column: 2, kind: 'MAGNET_PEG' }],
  });
  world.plinkoMode = 'TWIN';
  world.totalPlinkoDrops = 42;
  world.addictionScore = 12.5;
  world.lastPlinko = { pockets: [0, 8], tracks: [[{ x: 50, y: 8 }], [{ x: 54, y: 8 }]], steps: 1 };
  return { world, ledger };
}

describe('Save-/Load-Roundtrip v8', () => {
  it('schenkt dem frischen Start nach dem Laden kein Gerät und behält die Starter-Kiste', () => {
    const { world, ledger } = createNewGame('SMALL');
    expect(world.furniture.some((item) => item.gameId)).toBe(false);
    const raw = JSON.parse(JSON.stringify(toSavedGame(world, ledger, randomSeed())));
    const loaded = replaySave(raw);
    expect(loaded).not.toBeNull();
    // Der Weg bleibt Kiste → Automat: kein Gratisgerät als versteckte Abkürzung (#534/S1-06).
    expect(loaded!.world.furniture.some((item) => item.gameId)).toBe(false);
    expect(loaded!.world.crates.some((crate) => crate.payload.kind === 'FURNITURE')).toBe(true);
  });

  it('behält Journal, Look, Personalstatus und Ledger über JSON', () => {
    const { world, ledger } = fixture();
    const state = randomSeed();
    const raw = JSON.parse(JSON.stringify(toSavedGame(world, ledger, state)));
    const loaded = replaySave(raw);
    expect(loaded).not.toBeNull();
    expect(loaded!.prngState).toBe(state);
    expect(loaded!.world.look).toEqual(world.look);
    expect(loaded!.world.journal.length).toBe(world.journal.length);
    expect(loaded!.world.nextJournalId).toBe(world.nextJournalId);
    expect(loaded!.world.agents[0]!.task).toBe(world.agents[0]!.task);
    expect(loaded!.world.plinko).toEqual(world.plinko);
    expect(loaded!.world.plinkoMode).toBe('TWIN');
    expect(loaded!.world.totalPlinkoDrops).toBe(42);
    expect(loaded!.world.addictionScore).toBe(12.5);
    expect(loaded!.world.lastPlinko).toEqual(world.lastPlinko);
    expect(loaded!.ledger.diagnose().ok).toBe(true);
    expect(loaded!.ledger.entryCount).toBe(ledger.entryCount);
    expect(JSON.stringify(raw).length).toBeLessThan(2_000_000);
  });

  it('setzt nach dem Laden deterministisch an derselben Stelle fort', () => {
    const { world, ledger } = fixture();
    const raw = JSON.parse(JSON.stringify(toSavedGame(world, ledger, randomSeed())));
    const left = replaySave(raw)!;
    const right = replaySave(raw)!;
    const leftPrng = new Prng(left.prngState);
    const rightPrng = new Prng(right.prngState);
    for (let step = 0; step < 120; step += 1) {
      tickWorld(left.world, left.ledger, leftPrng);
      tickWorld(right.world, right.ledger, rightPrng);
    }
    expect(left.world.tick).toBe(right.world.tick);
    expect(left.world.guests).toEqual(right.world.guests);
    expect(left.world.journal).toEqual(right.world.journal);
    expect(left.ledger.snapshot()).toEqual(right.ledger.snapshot());
    expect(buildView(left.world, left.ledger, '')).toEqual(buildView(right.world, right.ledger, ''));
  });
});

describe('Spieltyp-Spuren im Ledger (P-4)', () => {
  it('erhält den Spieltyp einer echten Runde über Save/Load', () => {
    const world = createWorld('SMALL');
    ensureStarter(world);
    const ledger = new Ledger();
    ledger.transfer('EXTERNAL_WORLD', 'HAUSKONTO', fromVC(100), 'testkapital', 0);
    ledger.transfer('HAUSKONTO', 'PORTEMONNAIE', fromVC(20), 'testgeld', 0);
    const slot = world.furniture.find((item) => item.gameId === 'SLOT');
    if (!slot) throw new Error('Der Startautomat fehlt.');

    const result = playOwnRound(world, ledger, slot.id, 1, new Prng(randomSeed()), {});
    const tagged = ledger.entries.filter((entry) => entry.game === 'SLOT');
    expect(tagged.length).toBeGreaterThan(0);
    const stake = tagged.find((entry) => entry.to === 'HAUSKONTO');
    expect(stake?.from).toBe('PORTEMONNAIE');
    expect(stake?.amount).toBe(fromVC(1));
    expect(ledger.entries.some((entry) => entry.game === null)).toBe(true);

    const summary = economyOf(ledger);
    expect(summary.byGame).toHaveLength(1);
    expect(summary.byGame[0]).toMatchObject({ game: 'SLOT', stakeVolume: 1 });
    expect(summary.byGame[0]!.gamePayouts).toBe(Math.floor(result.payout / 10_000));

    const raw = JSON.parse(JSON.stringify(toSavedGame(world, ledger, 7)));
    const loaded = replaySave(raw);
    expect(loaded).not.toBeNull();
    expect(loaded!.ledger.entries.map((entry) => entry.game)).toEqual(ledger.entries.map((entry) => entry.game));
    expect(economyOf(loaded!.ledger).byGame).toEqual(summary.byGame);
  });
});
