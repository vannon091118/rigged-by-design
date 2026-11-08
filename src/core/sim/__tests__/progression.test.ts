/**
 * @test-target: src/core/sim/progression.ts
 * @error-code: ERR-2001
 *
 * Unternehmensstufen nennen echte Bedingungen; gesperrte Ware sagt, was fehlt.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { buyCrate } from '../deliveries';
import { economyOf } from '../economics';
import { companyStatus, companyTier, isUnlocked, requiredTier } from '../progression';
import { remodel, remodelRequirements } from '../remodel';
import { createWorld, ensureStarter } from '../templates';
import { CITY_ENERGY_PER_DAY, CITY_SLOT, cityOf, cityText, cityView, marketUnlocked, restInCity, runCityAction, travel } from '../city';
import { NARRATIVE_REGISTRY } from '../narrative/composer/registry.generated';
import { HAUSKONTO, payOut, placeBet, SHOP } from '../money';
import type { WorldState } from '../types';

function start(): { world: WorldState; ledger: Ledger } {
  const world = createWorld('SMALL');
  ensureStarter(world);
  return { world, ledger: new Ledger() };
}

/** Echter Spielverlauf: Fiat kommt herein, der Gast setzt Chips ins Hauskonto. */
function bet(ledger: Ledger, vc: number, guestId = 1): void {
  ledger.transfer('EXTERNAL_WORLD', `VISITOR_${guestId}`, fromVC(vc), 'test fiat', 0);
  placeBet(ledger, guestId, fromVC(vc), 0);
}

describe('Unternehmensstufen', () => {
  it('startet als Bude und nennt die naechste Stufe mit offenen Bedingungen', () => {
    const { world, ledger } = start();
    const status = companyStatus(world, ledger);
    expect(status.tier).toBe('BUDE');
    expect(status.next?.id).toBe('KASSE');
    const ids = status.open.map((metric) => metric.id);
    expect(ids).toContain('day');
    expect(ids).toContain('profit');
  });

  it('steigt mit Tagen, Betriebsgewinn und bedienten Gaesten', () => {
    const { world, ledger } = start();
    world.day = 3;
    world.guestsServed = 15;
    bet(ledger, 25);
    expect(economyOf(ledger).operatingProfit).toBe(25);
    expect(companyTier(world, ledger)).toBe('KASSE');
  });

  it('zaehlt Einsatzvolumen mit Auszahlungen nicht als Gewinn', () => {
    const { world, ledger } = start();
    world.day = 3;
    world.guestsServed = 15;
    bet(ledger, 1000);
    // Das Haus hat 1000 und zahlt 1100 aus: 100 bleiben als Schuld offen.
    payOut(ledger, 1, fromVC(1100), 0);
    const economy = economyOf(ledger);
    expect(economy.stakeVolume).toBe(1000);
    expect(economy.gamePayouts).toBe(1100);
    expect(economy.unpaidPayouts).toBe(100);
    expect(economy.operatingProfit).toBe(-100);
    expect(companyTier(world, ledger)).toBe('BUDE');
  });

  it('zaehlt Zuschuesse von aussen nicht als Gewinn', () => {
    const { ledger } = start();
    ledger.transfer('EXTERNAL_WORLD', HAUSKONTO, fromVC(500), 'baukapital', 0);
    expect(economyOf(ledger).operatingProfit).toBe(0);
    expect(economyOf(ledger).stakeVolume).toBe(0);
  });

  it('schaltet Ware stufenweise frei und benennt die Sperre', () => {
    const { world, ledger } = start();
    bet(ledger, 40);
    expect(requiredTier('BLACKJACK')).toBe('SAAL');
    expect(isUnlocked(world, ledger, 'SLOT')).toBe(true);
    expect(isUnlocked(world, ledger, 'BLACKJACK')).toBe(false);
    expect(companyStatus(world, ledger).locked.map((entry) => entry.id)).toContain('BLACKJACK');
    expect(() => buyCrate(world, ledger, 'BLACKJACK')).toThrow(/Spielsaal/);
    expect(world.crates).toHaveLength(0);
  });

  it('laesst freigeschaltete Ware durch', () => {
    const { world, ledger } = start();
    world.day = 3;
    world.guestsServed = 15;
    bet(ledger, 500);
    const crate = buyCrate(world, ledger, 'PLINKO');
    expect(crate.payload).toEqual({ kind: 'FURNITURE', buildId: 'PLINKO' });
  });

  it('verlangt fuer den Spielsaal echte Ausstattung, nicht nur Geld', () => {
    const { world, ledger } = start();
    world.day = 30;
    world.guestsServed = 400;
    world.reputation = 90;
    bet(ledger, 500);
    // Ruf, Gewinn und Kapital reichen; fehlen Spielgeraete, bleibt die Stufe bei Kasse.
    const slot = world.furniture.find((item) => item.gameId)!;
    let games = world.furniture.filter((item) => item.gameId).length;
    expect(games).toBeLessThan(6);
    expect(companyTier(world, ledger)).toBe('KASSE');
    expect(companyStatus(world, ledger).open.map((metric) => metric.id)).toEqual(['games']);

    while (games < 6) {
      world.furniture.push({ ...slot, id: world.nextFurnitureId++ });
      games += 1;
    }
    expect(companyTier(world, ledger)).toBe('SAAL');
  });

  it('nennt bei gesperrter Ware genau die Stufe und ihre offenen Bedingungen', () => {
    const { world, ledger } = start();
    expect(requiredTier('ROULETTE')).toBe('KONZERN');
    const games = world.furniture.filter((item) => item.gameId).length;
    let message = '';
    try { buyCrate(world, ledger, 'ROULETTE'); } catch (error) {
      message = error instanceof Error ? error.message : '';
    }
    expect(message).toContain('Konzern');
    expect(message).toContain(`Spielgeräte ${games}/12`);
    expect(message).toContain(`Ruf ${Math.round(world.reputation)}/70`);
    expect(world.crates).toHaveLength(0);
  });

  it('haelt Freischaltung, Sperrliste und Hausausbau an denselben Schwellen', () => {
    const { world, ledger } = start();
    const status = companyStatus(world, ledger);
    for (const id of status.unlocked) expect(isUnlocked(world, ledger, id)).toBe(true);
    for (const entry of status.locked) {
      expect(isUnlocked(world, ledger, entry.id)).toBe(false);
      expect(requiredTier(entry.id)).toBe(entry.tier);
    }

    const need = remodelRequirements('MEDIUM')!;
    world.day = need.day - 1;
    world.reputation = need.reputation;
    world.guestsServed = need.served;
    expect(() => remodel(world, ledger, 'MEDIUM', 0)).toThrow(`Tag ${need.day}`);
    world.day = need.day;
    world.reputation = need.reputation - 1;
    expect(() => remodel(world, ledger, 'MEDIUM', 0)).toThrow(`Ruf ${need.reputation}`);
    world.reputation = need.reputation;
    world.guestsServed = need.served - 1;
    expect(() => remodel(world, ledger, 'MEDIUM', 0)).toThrow(`${need.served} bediente`);
    expect(world.template).toBe('SMALL');
    expect(world.size).toBe(30);

    world.guestsServed = need.served;
    ledger.transfer('EXTERNAL_WORLD', HAUSKONTO, fromVC(2000), 'baukapital', 0);
    expect(remodel(world, ledger, 'MEDIUM', 0).template).toBe('MEDIUM');
    expect(world.size).toBe(60);
    // Auch nach dem Ausbau bleibt die Sperre dieselbe: eine Wahrheit fuer beide Wege.
    expect(companyStatus(world, ledger).locked.map((entry) => entry.id)).toContain('ROULETTE');
  });

  it('trennt Bruttospielumsatz, Hausgewinn und Betriebsgewinn', () => {
    const { ledger } = start();
    bet(ledger, 10, 1);
    bet(ledger, 10, 2);
    payOut(ledger, 1, fromVC(4), 0);
    ledger.transfer(HAUSKONTO, SHOP, fromVC(6), 'ausbau MEDIUM', 0);
    const economy = economyOf(ledger);
    expect(economy.stakeVolume).toBe(20);
    expect(economy.gamePayouts).toBe(4);
    expect(economy.retainedGamingWin).toBe(16);
    // Ausbau ist Investition, kein Betriebskostenblock.
    expect(economy.investment).toBe(6);
    expect(economy.operatingProfit).toBe(16);
  });
});

/** Stadt als zweiter Progression-Pfad: zwei Zweige, Energie, Pool-Texte. */
describe('Stadt: Kiez und Markt als Progression', () => {
  const texte = NARRATIVE_REGISTRY.filter((fragment) => fragment.slot === CITY_SLOT).map((fragment) => fragment.text);
  const imKiez = (): WorldState => {
    const { world } = start();
    world.day = 3;
    travel(world, 'KIEZ');
    return world;
  };
  /** Spielt einen Zweig bis zur Punktzahl; Energie kommt ueber den Tag zurueck. */
  const spielen = (world: WorldState, actionId: string, ziel: number): void => {
    const zweig = actionId.startsWith('KIEZ') ? 'KIEZ' : 'MARKT';
    while (cityOf(world)[zweig] < ziel) {
      if (cityOf(world).energy < 1) restInCity(world);
      runCityAction(world, actionId);
    }
  };
  it('kostet Energie, zaehlt Fortschritt und nennt das Ergebnis', () => {
    const world = imKiez();
    const state = runCityAction(world, 'KIEZ_ANSPRECHEN');
    expect(state.energy).toBe(CITY_ENERGY_PER_DAY - 1);
    expect(state.KIEZ).toBe(1);
    expect(state.lastResult).toMatch(/KIEZ 1 Punkte/);
    expect(texte).toContain(state.lastText);
  });
  it('beendet den Tag und fuellt die Energie nachweislich auf', () => {
    const world = imKiez();
    runCityAction(world, 'KIEZ_RUNDE');
    expect(cityOf(world).energy).toBe(CITY_ENERGY_PER_DAY - 2);
    const tag = world.day;
    restInCity(world);
    expect(world.day).toBe(tag + 1);
    expect(cityOf(world).energy).toBe(CITY_ENERGY_PER_DAY);
    expect(texte).toContain(cityOf(world).lastText);
  });

  it('sperrt den Markt bis zum Kiez-Rang Stammgast und schaltet ihn dann frei', () => {
    const world = imKiez();
    expect(marketUnlocked(cityOf(world))).toBe(false);
    expect(texte.length).toBeGreaterThanOrEqual(50);
    expect(() => travel(world, 'MARKT')).toThrow(/Stammgast/);
    const gesperrt = cityView(world).actions.find((action) => action.branch === 'MARKT')!;
    expect(gesperrt.enabled).toBe(false);
    expect(gesperrt.blocked).toMatch(/Stammgast/);
    spielen(world, 'KIEZ_ANSPRECHEN', 9);
    expect(marketUnlocked(cityOf(world))).toBe(true);
    expect(travel(world, 'MARKT').location).toBe('MARKT');
  });

  it('schliesst beide Zweige ab und behaelt den Abschluss', () => {
    const world = imKiez();
    spielen(world, 'KIEZ_ANSPRECHEN', 15);
    expect(cityOf(world).completed).toContain('KIEZ');
    travel(world, 'MARKT');
    spielen(world, 'MARKT_FEILSCHEN', 12);
    expect(cityOf(world).completed).toEqual(['KIEZ', 'MARKT']);
    expect(cityView(world).branches.every((branch) => branch.done)).toBe(true);
  });

  it('waehlt denselben Text fuer denselben Ort, dieselbe Handlung und denselben Tick', () => {
    const a = imKiez();
    const b = imKiez();
    expect(runCityAction(a, 'KIEZ_RUNDE').lastText).toBe(runCityAction(b, 'KIEZ_RUNDE').lastText);
    expect(texte).toContain(cityText('KIEZ_RUNDE|1|42'));
  });
});
