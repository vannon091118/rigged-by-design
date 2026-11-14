/**
 * @vitest-environment jsdom
 * @test-target: src/ui/hud.tsx
 * @error-code: ERR-3001
 *
 * HUD und Karrierefenster lesen dieselbe Effektbeschreibung. Der Test haelt
 * fest, dass PER/TEC/LCK nur die implementierten Wirkungen nennen.
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Ledger } from '../../core/economy/ledger';
import { createWorld } from '../../core/sim/templates';
import { buildView } from '../../store/snapshot';
import { Hud } from '../hud';
import { SKILLS } from '../hud-labels';

const noop = (): void => {};

function labelOf(attribute: string): string {
  const entry = SKILLS.find(([id]) => id === attribute);
  if (!entry) throw new Error(`Skill ${attribute} fehlt im HUD.`);
  return entry[1];
}

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

describe('Skill-Tooltips · eine Quelle mit dem Karrierefenster', () => {
  it('liest alle sieben Tooltips aus der Karriere-Effektbeschreibung', () => {
    const world = createWorld('SMALL');
    world.player.rpg.perceptionLevel = 4;
    world.player.rpg.techniqueLevel = 1;
    world.player.rpg.luckLevel = 1;
    world.player.rpg.unspentPoints = 1;
    const view = buildView(world, new Ledger(), '');

    render(
      <Hud
        view={view}
        perspective="operator"
        onPerspective={noop}
        onSkill={noop}
        onGuests={noop}
      />,
    );

    for (const entry of view.career.attributes) {
      const button = screen.getByRole('button', { name: `${labelOf(entry.id)}+` });
      expect(button.getAttribute('title')).toBe(entry.effect);
    }
  });

  it('nennt fuer PER, TEC und LCK nur die implementierten Wirkungen', () => {
    const world = createWorld('SMALL');
    world.player.rpg.perceptionLevel = 4;
    world.player.rpg.techniqueLevel = 1;
    world.player.rpg.luckLevel = 1;
    world.player.rpg.unspentPoints = 1;

    render(
      <Hud
        view={buildView(world, new Ledger(), '')}
        perspective="operator"
        onPerspective={noop}
        onSkill={noop}
        onGuests={noop}
      />,
    );

    const tooltip = (attribute: string): string =>
      screen.getByRole('button', { name: `${labelOf(attribute)}+` }).getAttribute('title') ?? '';

    expect(tooltip('perception')).toBe('Reinigung im Radius 2');
    expect(tooltip('technique')).toBe('Wartung +22 Zustandspunkte');
    expect(tooltip('luck')).toBe('Unfallrisiko -5 %');

    for (const attribute of ['perception', 'technique', 'luck']) {
      for (const promise of ['Queue', 'Dreck', 'Mod', 'Reparatur', 'Jackpot', 'RNG']) {
        expect(tooltip(attribute)).not.toContain(promise);
      }
    }
  });
});
