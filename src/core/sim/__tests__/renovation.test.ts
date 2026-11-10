/** @test-target: src/core/sim/renovation.ts | @error-code: ERR-3001 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { EXTERNAL, HAUSKONTO, PORTEMONNAIE } from '../money';
import { buyProperty } from '../property';
import {
  RENOVATION_LABELS, RENOVATION_STAGES, RENOVATION_STEPS, RENOVATION_SUBJECT, nextRenovationStep,
  renovate, renovationMoodBonus, renovationReputationBonus, renovationStage, renovationView,
  type RenovationStage, type RenovationStep,
} from '../renovation';
import { createWorld } from '../templates';

interface Options {
  readonly buy?: boolean;
  readonly parts?: number;
  readonly houseVC?: number;
}

function setup({ buy = true, parts = 6, houseVC = 300 }: Options = {}) {
  const world = createWorld('SMALL');
  const ledger = new Ledger();
  ledger.transfer(EXTERNAL, PORTEMONNAIE, fromVC(200), 'test startgeld', 0);
  if (houseVC > 0) ledger.transfer(EXTERNAL, HAUSKONTO, fromVC(houseVC), 'test hauskonto', 0);
  world.parts = parts;
  if (buy) buyProperty(world, ledger, 'KNEIPE', 0);
  return { world, ledger };
}

describe('Renovierung: Stufen', () => {
  it('startet ohne Eigentum unrenoviert und verweigert die Arbeit', () => {
    const { world, ledger } = setup({ buy: false });
    expect(renovationStage(world)).toBe('UNRENOVIERT');
    const view = renovationView(world, ledger);
    expect(view.owned).toBe(false);
    expect(view.ready).toBe(false);
    expect(view.note).toContain('Kauf zuerst');
    expect(() => renovate(world, ledger)).toThrow(/Ohne Immobilie/);
  });

  it('steigt mit jedem Beleg genau eine Stufe und endet aufgewertet', () => {
    const { world, ledger } = setup();
    expect(renovate(world, ledger)).toBe('TEILRENOVIERT');
    expect(renovate(world, ledger)).toBe('BETRIEBSBEREIT');
    expect(renovate(world, ledger)).toBe('AUFGEWERTET');
    expect(renovationStage(world)).toBe('AUFGEWERTET');
    expect(() => renovate(world, ledger)).toThrow(/bereits aufgewertet/);
  });

  it('bucht jede Stufe mit eigenem Grund vom Betriebskonto', () => {
    const { world, ledger } = setup();
    const before = ledger.getBalance(HAUSKONTO);
    renovate(world, ledger);
    expect(ledger.getBalance(HAUSKONTO)).toBe(before - fromVC(RENOVATION_STEPS[0]!.costVC));
    expect(ledger.entries.some((entry) => entry.reason === 'renovierung TEILRENOVIERT')).toBe(true);
    expect(world.journal.filter((event) => event.subject === RENOVATION_SUBJECT)).toHaveLength(1);
    expect(world.lastEvent).toContain('Teilrenoviert');
  });
});

describe('Renovierung: Voraussetzungen', () => {
  it('verlangt Material aus dem Lager und laesst alles unberuehrt', () => {
    const { world, ledger } = setup({ parts: 0 });
    const balance = ledger.getBalance(HAUSKONTO);
    expect(() => renovate(world, ledger)).toThrow(/Material fehlt/);
    expect(renovationStage(world)).toBe('UNRENOVIERT');
    expect(ledger.getBalance(HAUSKONTO)).toBe(balance);
    expect(world.journal.some((event) => event.subject === 'RENOVIERUNG')).toBe(false);
  });

  it('verlangt Deckung auf dem Betriebskonto statt Kredit', () => {
    const { world, ledger } = setup({ houseVC: 10 });
    expect(() => renovate(world, ledger)).toThrow(/Betriebskonto zu niedrig/);
    expect(renovationStage(world)).toBe('UNRENOVIERT');
    expect(world.parts).toBe(6);
  });

  it('verbraucht genau den Materialbedarf der Stufe', () => {
    const { world, ledger } = setup({ parts: 6 });
    renovate(world, ledger);
    expect(world.parts).toBe(5);
    renovate(world, ledger);
    expect(world.parts).toBe(3);
  });
});

describe('Renovierung: Wirkung im Betrieb', () => {
  it('setzt Geraete und Flecken der eigenen Flaeche instand', () => {
    const { world, ledger } = setup();
    const device = world.furniture.find((item) => item.gameId)!;
    device.condition = 30;
    device.damaged = true;
    device.dirt = 0.8;
    world.dirty.add(3 * world.size + 4);
    renovate(world, ledger);
    expect(device.condition).toBe(100);
    expect(device.damaged).toBe(false);
    expect(device.dirt).toBe(0);
    expect(world.dirty.size).toBe(0);
  });

  it('gibt Ruf und Gaestelaune einen Bonus je Stufe, aber nur mit Eigentum', () => {
    const { world, ledger } = setup();
    expect(renovationReputationBonus(world)).toBe(0);
    expect(renovationMoodBonus(world)).toBe(0);
    renovate(world, ledger);
    expect(renovationReputationBonus(world)).toBe(2);
    expect(renovationMoodBonus(world)).toBe(1);
    const without = setup({ buy: false });
    expect(renovationReputationBonus(without.world)).toBe(0);
  });
});

describe('Renovierung: Zustand aus dem Archiv', () => {
  it('zaehlt einen Beleg nicht doppelt, wenn Journal und Archiv ihn beide tragen', () => {
    const { world, ledger } = setup();
    renovate(world, ledger);
    world.archive = [...world.journal];
    expect(renovationStage(world)).toBe('TEILRENOVIERT');
    world.journal = [];
    expect(renovationStage(world)).toBe('TEILRENOVIERT');
  });

  it('kennt die naechste Stufe und ihre Grenzen', () => {
    expect(RENOVATION_STAGES).toEqual(['UNRENOVIERT', 'TEILRENOVIERT', 'BETRIEBSBEREIT', 'AUFGEWERTET']);
    expect(RENOVATION_LABELS.AUFGEWERTET).toBe('Aufgewertet');
    const step: RenovationStep | null = nextRenovationStep('UNRENOVIERT');
    const stage: RenovationStage = renovationStage(setup().world);
    expect(stage).toBe('UNRENOVIERT');
    expect(step?.stage).toBe('TEILRENOVIERT');
    expect(nextRenovationStep('BETRIEBSBEREIT')?.stage).toBe('AUFGEWERTET');
    expect(nextRenovationStep('AUFGEWERTET')).toBeNull();
  });
});
