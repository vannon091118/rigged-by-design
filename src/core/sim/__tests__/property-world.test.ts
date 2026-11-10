/** @test-target: src/core/sim/property.ts | @error-code: ERR-3001 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { areaAt } from '../grid-zones';
import { EXTERNAL, HAUSKONTO, PORTEMONNAIE } from '../money';
import { PROPERTY_ACCOUNT, buyProperty, propertyArea, propertyView, propertyWorld } from '../property';
import { createWorld } from '../templates';
import type { TemplateId } from '../types';

function owned(template: TemplateId = 'SMALL') {
  const world = createWorld(template);
  const ledger = new Ledger();
  ledger.transfer(EXTERNAL, PORTEMONNAIE, fromVC(200), 'test startgeld', 0);
  const property = buyProperty(world, ledger, 'KNEIPE', 0);
  return { world, ledger, property };
}

describe('Immobilie: Zuordnung zum WorldState', () => {
  it('bindet ohne Eigentum nichts an einen Bereich', () => {
    expect(propertyWorld(createWorld('SMALL'))).toBeNull();
    expect(propertyView(createWorld('SMALL'), fromVC(0)).binding).toBeNull();
  });

  it('legt die Immobilie in den Rasterbereich ihres Eingangs', () => {
    const { world } = owned();
    const entrance = world.zones.find((zone) => zone.kind === 'ENTRANCE')!;
    expect(propertyArea(world)).toEqual(areaAt(world.template, entrance.x, entrance.y));
    expect(propertyWorld(world)!.area?.id).toBe(propertyArea(world)!.id);
  });

  it('zaehlt nur Zonen, Geraete und Gaeste der eigenen Flaeche', () => {
    const { world } = owned();
    const binding = propertyWorld(world)!;
    const area = binding.area!;
    const inside = (x: number, y: number) =>
      x >= area.x && x < area.x + area.w && y >= area.y && y < area.y + area.h;
    expect(binding.zones.length).toBeGreaterThan(0);
    expect(binding.zones.every((zone) => inside(zone.x, zone.y))).toBe(true);
    expect(binding.furniture.length).toBeGreaterThan(0);
    expect(binding.furniture.every((item) => inside(item.x, item.y))).toBe(true);
    expect(binding.furniture.length).toBeLessThanOrEqual(world.furniture.length);
    expect(binding.guests).toEqual([]);
  });

  it('betreibt die Immobilie ueber das bestehende Hauskonto', () => {
    const { world } = owned();
    expect(PROPERTY_ACCOUNT).toBe(HAUSKONTO);
    expect(propertyWorld(world)!.account).toBe(HAUSKONTO);
  });

  it('bleibt fuer alle Vorlagen eindeutig und spiegelt dieselbe Sicht', () => {
    for (const template of ['SMALL', 'MEDIUM', 'LARGE'] as const) {
      const { world, ledger } = owned(template);
      const binding = propertyWorld(world)!;
      expect(binding.area).not.toBeNull();
      expect(binding.owned.id).toBe('KNEIPE');
      expect(propertyView(world, ledger.getBalance(PORTEMONNAIE)).binding).toEqual(binding);
    }
  });
});
