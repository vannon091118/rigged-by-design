/** @test-target: src/render/ambient-plan.ts * @error-code: ERR-3001 */
import { describe, expect, it } from 'vitest';
import {
  AMBIENT_TRANSITION_TICKS, ambientPlanAt, ambientPlanFor, lampPulse, streetBand,
} from '../ambient-plan';
import { PHASE_BOUNDARIES, PHASE_TICKS } from '../../core/sim/day-phase';
import { TICKS_PER_DAY } from '../../core/sim/clock';

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

describe('Tagesdrittel-Übergang', () => {
  it('ist ausserhalb des Fensters exakt der eingefrorene Phasenplan', () => {
    for (const phase of ['morning', 'evening', 'night'] as const) {
      const sample = { morning: 100, evening: 300, night: 500 }[phase];
      expect(ambientPlanAt(sample, 'CITY')).toBe(ambientPlanFor(phase, 'CITY'));
    }
  });

  it('trifft an beiden Enden die Nachbarphasen', () => {
    const half = AMBIENT_TRANSITION_TICKS / 2;
    for (const boundary of PHASE_BOUNDARIES) {
      const before = ambientPlanAt(boundary - half, 'CITY');
      const after = ambientPlanAt(boundary + half, 'CITY');
      expect(before.shade).toBeCloseTo(ambientPlanFor(previousPhase(boundary), 'CITY').shade, 6);
      expect(after.shade).toBeCloseTo(ambientPlanFor(nextPhase(boundary), 'CITY').shade, 6);
    }
  });

  it('springt an keiner Grenze: ein Tick ist hoechstens ein Fensterschritt', () => {
    const steps: number[] = [];
    for (let tick = 0; tick < TICKS_PER_DAY; tick += 1) {
      const here = ambientPlanAt(tick, 'CITY');
      const next = ambientPlanAt(tick + 1, 'CITY');
      expect(Math.abs(next.shade - here.shade)).toBeLessThan(0.02);
      steps.push(Math.abs(next.rays - here.rays));
    }
    // Der alte Sprung war 0.16 (Strahlen) bzw. 0.2 (Schleier) in einem Tick.
    expect(Math.max(...steps)).toBeLessThan(0.16 / 2);
  });

  it('blendet den Sichtradius in der Nacht weich ein statt ihn zu schalten', () => {
    const boundary = PHASE_TICKS * 2;
    const half = AMBIENT_TRANSITION_TICKS / 2;
    expect(ambientPlanAt(boundary - half, 'CITY').visionTiles).toBe(0);
    const middle = ambientPlanAt(boundary, 'CITY').visionTiles;
    expect(middle).toBeGreaterThan(0);
    expect(middle).toBeLessThan(ambientPlanFor('night', 'CITY').visionTiles);
    expect(ambientPlanAt(boundary + half, 'CITY').visionTiles)
      .toBeCloseTo(ambientPlanFor('night', 'CITY').visionTiles, 6);
  });

  it('ist deterministisch und im Innenraum genauso stetig', () => {
    const boundary = PHASE_TICKS;
    expect(ambientPlanAt(boundary + 3, 'OWN')).toEqual(ambientPlanAt(boundary + 3, 'OWN'));
    const inside = ambientPlanAt(boundary - 4, 'OWN');
    const after = ambientPlanAt(boundary + 4, 'OWN');
    expect(Math.abs(after.shade - inside.shade)).toBeLessThan(0.02);
  });
});

function previousPhase(boundary: number) {
  return ambientPhase(boundary - 1);
}

function nextPhase(boundary: number) {
  return ambientPhase(boundary);
}

function ambientPhase(tick: number) {
  const local = ((tick % TICKS_PER_DAY) + TICKS_PER_DAY) % TICKS_PER_DAY;
  if (local < PHASE_TICKS) return 'morning' as const;
  if (local < PHASE_TICKS * 2) return 'evening' as const;
  return 'night' as const;
}

describe('Sonnenband', () => {
  const world = { width: 60, height: 60 };

  it('begrenzt die Strahlen auf den Strassenraum statt auf die Weltkante', () => {
    // Stadt: vier Aussen-Zonen zwischen y=11 und y=24.
    const band = streetBand(
      [
        { x: 0, y: 11, w: 60, h: 2 },
        { x: 0, y: 13, w: 60, h: 7 },
        { x: 0, y: 20, w: 60, h: 2 },
        { x: 22, y: 22, w: 8, h: 4 },
      ],
      world,
      26,
    );
    expect(band).toEqual({ x: 0, y: 11 * 26, width: 60 * 26, height: 15 * 26 });
    expect(band.height).toBeLessThan(world.height * 26);
  });

  it('faellt ohne Zonen auf die Weltkante zurueck', () => {
    const full = { x: 0, y: 0, width: 60 * 26, height: 60 * 26 };
    expect(streetBand([], world, 26)).toEqual(full);
    // Alte Saves und Testfixtures liefern die Legacy-Sicht ohne Zonen.
    expect(streetBand(undefined, world, 26)).toEqual(full);
  });

  it('bleibt innerhalb der Welt, auch wenn eine Zone darueber hinausragt', () => {
    const band = streetBand([{ x: -4, y: 40, w: 80, h: 40 }], world, 26);
    expect(band.x).toBe(0);
    expect(band.width).toBe(60 * 26);
    expect(band.y).toBe(40 * 26);
    expect(band.height).toBe(20 * 26);
  });
});

describe('Lampenflackern', () => {
  it('bleibt bei reduzierter Bewegung steady', () => {
    expect(lampPulse(0, 3, 1, true)).toBe(lampPulse(9000, 3, 1, true));
    expect(lampPulse(0, 3, 1, true)).toBe(0.74);
  });

  it('atmet ohne reduzierte Bewegung um denselben Mittelwert', () => {
    expect(lampPulse(0, 3, 1, false)).not.toBe(lampPulse(9000, 3, 1, false));
    expect(lampPulse(0, 3, 0, false)).toBe(0.68);
  });
});
