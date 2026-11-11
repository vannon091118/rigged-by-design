/** @test-target: src/core/sim/esport.ts | @error-code: ERR-2001 */
import { describe, expect, it } from 'vitest';
import { esportTeams, esportView, ESPORT_TOURNAMENT_SUBJECT } from '../esport';
import { recordJournal } from '../journal';
import { createWorld } from '../templates';

const ROLES = ['CAPTAIN', 'DUELIST', 'ANCHOR', 'SUPPORT', 'FLEX'];

describe('E-Sport-Simulationsdaten', () => {
  it('erzeugt dieselbe Liga fuer denselben Tag und stabile Rosters', () => {
    expect(esportTeams(4)).toEqual(esportTeams(4));
    expect(esportTeams(4)).toHaveLength(6);
    expect(esportTeams(4).map((team) => team.name)).toEqual(esportTeams(5).map((team) => team.name));
  });

  it('gibt jedem Team fuenf Rollen und plausible Attribute', () => {
    for (const team of esportTeams(1)) {
      expect(team.players.map((player) => player.role)).toEqual(ROLES);
      expect(team.players).toHaveLength(5);
      expect(new Set(team.players.map((player) => player.id)).size).toBe(5);
      for (const player of team.players) {
        for (const value of [player.mechanics, player.gameSense, player.communication, player.stamina]) {
          expect(value).toBeGreaterThanOrEqual(35);
          expect(value).toBeLessThanOrEqual(85);
        }
      }
    }
  });

  it('sortiert die Tabelle nach Staerke und nennt den Fuehrenden', () => {
    const view = esportView(createWorld('SMALL'));
    const strengths = view.teams.map((team) => team.strength);
    expect(strengths).toEqual([...strengths].sort((a, b) => b - a));
    for (const strength of strengths) {
      expect(strength).toBeGreaterThanOrEqual(30);
      expect(strength).toBeLessThanOrEqual(99);
    }
    expect(view.homeTeam).toBe(view.teams[0]!.name);
    expect(view.league).toBe('Stadtliga');
  });

  it('liest Turnierhistorie aus dem vorhandenen Archiv, neueste zuerst', () => {
    const world = createWorld('SMALL');
    for (let index = 0; index < 7; index += 1) {
      recordJournal(world, { kind: 'SYSTEM', subject: ESPORT_TOURNAMENT_SUBJECT, cause: `t${index}`, effect: `Finale ${index}` });
    }
    recordJournal(world, { kind: 'SYSTEM', subject: 'ANDERES', cause: 'x', effect: 'ignoriert' });
    const history = esportView(world).history;
    expect(history).toHaveLength(5);
    expect(history[0]!.summary).toBe('Finale 6');
    expect(history.every((entry) => entry.day === world.day)).toBe(true);
  });

  it('veraendert den Weltzustand nicht und wechselt die Saison am Tag 8', () => {
    const world = createWorld('SMALL');
    world.day = 1;
    const before = JSON.stringify(esportView(world));
    expect(JSON.stringify(esportView(world))).toBe(before);
    expect(esportView(world).season).toBe(1);
    world.day = 8;
    expect(esportView(world).season).toBe(2);
    expect(world.archive).toHaveLength(0);
  });
});
