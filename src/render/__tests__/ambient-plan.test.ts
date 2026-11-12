/** @test-target: src/render/ambient-plan.ts * @error-code: ERR-3001 */
import { describe, expect, it } from 'vitest';
import { ambientPlanFor } from '../ambient-plan';

describe('Ambient-Vertrag', () => {
  it('liefert je Umgebung und Phase genau einen eingefrorenen Plan', () => {
    const first = ambientPlanFor('night', 'CITY');
    const second = ambientPlanFor('night', 'CITY');
    expect(first).toBe(second);
    expect(Object.isFrozen(first)).toBe(true);
    expect(ambientPlanFor('night', 'APARTMENT')).not.toBe(first);
  });

  it('daempft draussen mit der Tageszeit staerker und nur dort', () => {
    const morning = ambientPlanFor('morning', 'CITY').shade;
    const evening = ambientPlanFor('evening', 'CITY').shade;
    const night = ambientPlanFor('night', 'CITY').shade;
    expect(morning).toBeLessThan(evening);
    expect(evening).toBeLessThan(night);
    // Drinnen bleibt es lesbar; Casino und Wohnung sind beleuchtet.
    expect(ambientPlanFor('night', 'OWN').shade).toBeLessThan(night);
    expect(ambientPlanFor('morning', 'OWN').shade).toBe(0);
  });

  it('gibt einen Sichtradius nur draussen in der Nacht', () => {
    expect(ambientPlanFor('morning', 'CITY').visionTiles).toBe(0);
    expect(ambientPlanFor('evening', 'CITY').visionTiles).toBe(0);
    expect(ambientPlanFor('night', 'CITY').visionTiles).toBeGreaterThan(0);
    expect(ambientPlanFor('night', 'APARTMENT').visionTiles).toBe(0);
    expect(ambientPlanFor('night', 'OWN').visionAlpha).toBe(0);
  });

  it('laesst Strahlen und Schatten am Tag zu und in der Nacht ruhen', () => {
    expect(ambientPlanFor('morning', 'CITY').rays).toBeGreaterThan(0);
    expect(ambientPlanFor('evening', 'CITY').rays).toBeGreaterThan(0);
    expect(ambientPlanFor('night', 'CITY').rays).toBe(0);
    expect(ambientPlanFor('morning', 'CITY').sunX).toBeGreaterThan(0);
    expect(ambientPlanFor('evening', 'CITY').sunX).toBeLessThan(0);
    expect(ambientPlanFor('night', 'OWN').shadow).toBe(0);
  });

  it('ist ueber beliebig viele Abfragen stabil', () => {
    const plans = Array.from({ length: 5 }, () => ambientPlanFor('evening', 'CITY'));
    for (const plan of plans) expect(plan).toBe(plans[0]);
  });
});
