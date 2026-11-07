/**
 * @test-target: src/core/sim/rivals.ts
 * @error-code: ERR-2001
 *
 * Fremde Haeuser nutzen echte Spiele und Regeln, driften deterministisch und
 * buchen Besuche im Portemonnaie.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { Prng } from '../../rng/prng';
import { HAUSKONTO, playerTakeHome, PORTEMONNAIE } from '../money';
import { BUILD_DEFS } from '../offers';
import { getRival, RIVALS, rivalEdge, rivalState, rivalStates, visitRival } from '../rivals';
import { randomSeed } from '../../../test/random-seed';

function wallet(vc = 20) {
  const ledger = new Ledger();
  ledger.transfer('EXTERNAL_WORLD', HAUSKONTO, fromVC(vc), 'baukapital', 0);
  playerTakeHome(ledger, fromVC(vc / 2), 0);
  return { ledger, prng: new Prng(randomSeed()) };
}

describe('Fremde Casinos', () => {
  it('konfiguriert jede Maschine aus den echten Spieldefinitionen', () => {
    const known = new Set(BUILD_DEFS.map((def) => def.gameId).filter(Boolean));
    for (const rival of RIVALS) {
      expect(rival.machines.length).toBeGreaterThan(0);
      for (const entry of rival.machines) {
        expect(known.has(entry.game)).toBe(true);
        expect(entry.baseBet).toBeGreaterThanOrEqual(rival.minBet);
      }
      expect(rival.personas.length).toBeGreaterThan(0);
    }
  });

  it('haelt den Ruf im Band und driftet reproduzierbar', () => {
    const rival = getRival('HAFENKLAUSE');
    expect(rivalState(rival, 0)).toEqual(rivalState(rival, 0));
    expect(rivalState(rival, 0)).toEqual(rivalState(rival, DRIFT_UNDER));
    for (const tick of [0, 600, 6000, 60_000, 600_000]) {
      const state = rivalState(rival, tick);
      expect(state.reputation).toBeGreaterThanOrEqual(5);
      expect(state.reputation).toBeLessThanOrEqual(99);
    }
    expect(rivalStates(0)).toHaveLength(RIVALS.length);
  });

  it('rechnet Betreiber-Regel und Mod-Aufschlag zusammen', () => {
    const rival = getRival('GOLDENE_HAND');
    const plain = rivalEdge(rival, { game: 'SHELL', label: 'x', baseBet: fromVC(0.1), mods: [] });
    expect(plain).toBe(rival.edgeBps);
    const withMod = rivalEdge(rival, { game: 'SLOT', label: 'x', baseBet: fromVC(0.1), mods: ['CHERRY'] });
    expect(withMod).toBeGreaterThanOrEqual(plain);
  });

  it('bucht Einsatz und Gewinn im eigenen Portemonnaie', () => {
    const { ledger, prng } = wallet();
    const before = ledger.getBalance(PORTEMONNAIE);
    const visit = visitRival(ledger, 'HAFENKLAUSE', 0, fromVC(0.5), prng, 10);
    const after = ledger.getBalance(PORTEMONNAIE);
    expect(after).toBe(before - fromVC(0.5) + visit.result.payout);
    expect(visit.machine.game).toBe('SLOT');
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
  });

  it('weist zu kleine Einsaetze, unbekannte Maschinen und leere Boersen ab', () => {
    const { ledger, prng } = wallet();
    expect(() => visitRival(ledger, 'NEBELPALAST', 0, fromVC(0.01), prng, 10)).toThrow(/Mindesteinsatz/);
    expect(() => visitRival(ledger, 'HAFENKLAUSE', 9, fromVC(1), prng, 10)).toThrow(/Maschine/);
    const empty = new Ledger();
    expect(() => visitRival(empty, 'HAFENKLAUSE', 0, fromVC(0.5), prng, 10)).toThrow(/Bargeld/);
    expect(() => visitRival(ledger, 'HAFENKLAUSE', 0, fromVC(50), prng, 10)).toThrow(/Bargeld/);
  });
});

/** Ein Tick innerhalb der ersten Driftstufe: der Ruf darf sich noch nicht bewegt haben. */
const DRIFT_UNDER = 599;
