/**
 * @vitest-environment jsdom
 * @test-target: src/ui/hud.tsx
 * @error-code: ERR-3001
 *
 * Der Skillpunkt-Klick laeuft ueber den echten Command-Pfad bis in die
 * Spielwirkung; kein `onSkill={noop}` und keine simulierten Level.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Ledger } from '../../core/economy/ledger';
import { cleaningReach, maintenanceGain } from '../../core/sim/floor-work';
import type { RpgAttribute, PlayerRpgState } from '../../core/sim/player-rpg';
import { luckInjuryFactor } from '../../core/sim/player-rpg';
import { createWorld } from '../../core/sim/templates';
import { buildView } from '../../store/snapshot';
import { spendSkillCmd } from '../../store/venue-commands';
import { Hud } from '../hud';
import { SKILLS } from '../hud-labels';

const noop = (): void => {};

const LEVEL_FIELD: Record<RpgAttribute, keyof PlayerRpgState> = {
  speed: 'speedLevel',
  charisma: 'charismaLevel',
  brawl: 'brawlLevel',
  perception: 'perceptionLevel',
  technique: 'techniqueLevel',
  endurance: 'enduranceLevel',
  luck: 'luckLevel',
};

function levelOf(rpg: PlayerRpgState, attribute: RpgAttribute): number {
  const value = rpg[LEVEL_FIELD[attribute]];
  return typeof value === 'number' ? value : 0;
}

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

describe('Skillpunkt-Kette · HUD bis Wirkung', () => {
  it('gibt jeden der sieben Punkte ueber den echten Command aus', () => {
    const world = createWorld('SMALL');
    const ledger = new Ledger();
    world.player.rpg.unspentPoints = SKILLS.length + 3;
    render(
      <Hud
        view={buildView(world, ledger, '')}
        perspective="operator"
        onPerspective={noop}
        onSkill={(attribute) => spendSkillCmd(world, attribute)}
        onGuests={noop}
      />,
    );

    for (const [attribute, label] of SKILLS) {
      const pointsBefore = world.player.rpg.unspentPoints;
      const levelBefore = levelOf(world.player.rpg, attribute);
      fireEvent.click(screen.getByRole('button', { name: `${label}+` }));
      expect(world.player.rpg.unspentPoints).toBe(pointsBefore - 1);
      expect(levelOf(world.player.rpg, attribute)).toBe(levelBefore + 1);
    }
  });

  it('veraendert Reinigungsradius, Wartungsgewinn und Unfallrisiko aus den gekauften Leveln', () => {
    const world = createWorld('SMALL');
    const ledger = new Ledger();
    world.player.rpg.unspentPoints = SKILLS.length + 3;

    expect(cleaningReach(world)).toBe(1);
    expect(maintenanceGain(world)).toBe(20);
    expect(luckInjuryFactor(world.player.rpg)).toBe(1);

    render(
      <Hud
        view={buildView(world, ledger, '')}
        perspective="operator"
        onPerspective={noop}
        onSkill={(attribute) => spendSkillCmd(world, attribute)}
        onGuests={noop}
      />,
    );

    const perception = SKILLS.find(([attribute]) => attribute === 'perception');
    if (!perception) throw new Error('PER-Taste fehlt im HUD.');
    for (const [, label] of SKILLS) fireEvent.click(screen.getByRole('button', { name: `${label}+` }));
    // Wahrnehmung braucht vier Stufen fuer den naechsten Kachelradius.
    for (let step = 0; step < 3; step += 1) {
      fireEvent.click(screen.getByRole('button', { name: `${perception[1]}+` }));
    }

    expect(world.player.rpg.unspentPoints).toBe(0);
    expect(cleaningReach(world)).toBe(2);
    expect(maintenanceGain(world)).toBe(22);
    expect(luckInjuryFactor(world.player.rpg)).toBeCloseTo(0.95, 6);
  });
});
