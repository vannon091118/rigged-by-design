/** @test-target: src/core/sim/player-career.ts | @error-code: ERR-2001 */
import { describe, expect, it } from 'vitest';
import { fromVC } from '../../economy/vacoin';
import { fightRecordOf, hpNotice, playerCareer } from '../player-career';
import { grantXp, newPlayerRpg } from '../player-rpg';
import { createWorld } from '../templates';

function careerOf() {
  const world = createWorld('SMALL');
  return { world, career: () => playerCareer(world, fromVC(12), fromVC(3)) };
}

describe('Spieler-Karriere', () => {
  it('startet auf Level 1 mit sieben Attributen und ohne Bilanz', () => {
    const { career } = careerOf();
    const view = career();
    expect(view.level).toBe(1);
    expect(view.xpToNext).toBe(100);
    expect(view.attributes).toHaveLength(7);
    expect(view.record).toEqual({ wins: 0, losses: 0, kos: 0 });
    expect(view.job).toBeNull();
    expect(view.backyard.rung.rank).toBe(1);
  });

  it('rechnet XP bis zur naechsten Stufe aus derselben Formel wie der Aufstieg', () => {
    const { world, career } = careerOf();
    grantXp(world.player.rpg, 10_000);
    const view = career();
    expect(view.level).toBeGreaterThan(1);
    expect(view.xpToNext).toBeGreaterThan(0);
    expect(view.unspentPoints).toBe(view.level - 1);
  });

  it('liest die Kampfbilanz aus Duell- und Hinterhof-Eintraegen des Archivs', () => {
    const events = [
      { id: 0, tick: 0, day: 1, kind: 'GUEST', subject: 'Duell gegen Rocco', cause: 'a', effect: 'Gewonnen: der Rädelsführer ist raus.' },
      { id: 1, tick: 0, day: 1, kind: 'GUEST', subject: 'Duell gegen Rocco', cause: 'b', effect: 'Verloren: 4,00 VC verloren.' },
      { id: 2, tick: 0, day: 1, kind: 'SYSTEM', subject: 'Hinterhof gegen Bulle Bernd', cause: 'c', effect: 'Gewonnen: KO in Runde 2 · Preisgeld 1,20 VC.' },
      { id: 3, tick: 0, day: 1, kind: 'MONEY', subject: 'einsatz', cause: 'd', effect: 'Gebucht.' },
    ] as const;
    expect(fightRecordOf(events)).toEqual({ wins: 2, losses: 1, kos: 1 });
  });

  it('nennt die Wirkung jeder Stufe, auch wenn sie noch keine hat', () => {
    const { world, career } = careerOf();
    world.player.rpg.speedLevel = 3;
    const speed = career().attributes.find((entry) => entry.id === 'speed')!;
    const luck = career().attributes.find((entry) => entry.id === 'luck')!;
    expect(speed.effect).toContain('Schritte');
    expect(speed.level).toBe(3);
    expect(luck.effect).toBe('noch ohne Wirkung');
  });

  it('gibt Koerper und Geld unveraendert weiter', () => {
    const { world, career } = careerOf();
    world.player.rpg.hp = 12;
    world.player.rpg.injuryTicks = 40;
    const view = career();
    expect(view.hp).toBe(12);
    expect(view.injured).toBe(true);
    expect(view.wallet).toBe(fromVC(12));
    expect(view.playerCash).toBe(fromVC(3));
    expect(hpNotice(view)).toContain('Verletzt');
  });

  it('schaltet Erfolge nur mit Beleg im Zustand frei', () => {
    const { world, career } = careerOf();
    expect(career().achievements.every((entry) => !entry.unlocked)).toBe(true);
    world.player.barPurchased = true;
    world.player.rpg = { ...newPlayerRpg(), level: 6 };
    const unlocked = career().achievements.filter((entry) => entry.unlocked).map((entry) => entry.id);
    expect(unlocked).toContain('EIGENE_BUDE');
    expect(unlocked).toContain('AUFSTEIGER');
  });

  it('nennt den Job mit Schichten, sobald einer angenommen ist', () => {
    const { world, career } = careerOf();
    world.player.job = {
      jobId: 'CLEANER', rivalId: 'HAFENKLAUSE', stationId: 'x', currentTask: null,
      workDays: 4, lastPaidDay: 1, lastWorkDay: 2,
    };
    expect(career().job).toMatchObject({ label: 'Reinigungskraft', workDays: 4 });
  });
});
