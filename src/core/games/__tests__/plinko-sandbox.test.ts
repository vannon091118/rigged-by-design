/**
 * @test-target: src/core/games/plinko-sandbox.ts
 * @error-code: ERR-1003
 *
 * Rot-Gruen-Beweis fuer die Plinko-Sandbox: Peg-Physik, Reihen-Leiter,
 * Multi-Ball, Split und das ehrliche RTP-Gate.
 */
import { describe, expect, it } from 'vitest';
import { ballBody, staticBody } from '../../physics/body';
import { PhysicsWorld } from '../../physics/world';
import { createPlinkoBoard } from '../plinko-board';
import {
  PEG_PHYSICS, defaultPlinkoConfig, normalizePlinkoConfig, plinkoPaytable,
  plinkoProgress, type PlinkoConfig, type PlinkoDrop, type PlinkoPeg,
} from '../plinko-config';
import { deployGate } from '../plinko-sandbox';
import { Prng } from '../../rng/prng';
import { randomSeed } from '../../../test/random-seed';

const special = (kind: PlinkoPeg['kind'], index: number): PlinkoPeg => ({
  row: 1 + (index % 4), column: 2 + (index * 2) % 6, kind,
});

function withPegs(count: number, kind: PlinkoPeg['kind'] = 'BOUNCY_PEG'): PlinkoConfig {
  const base = defaultPlinkoConfig();
  return normalizePlinkoConfig({ ...base, pegs: Array.from({ length: count }, (_, index) => special(kind, index)) });
}

describe('Peg-Physik', () => {
  it('kennt fuenf physikalische Peg-Typen mit klaren Profilen', () => {
    expect(Object.keys(PEG_PHYSICS)).toEqual([
      'NORMAL_PEG', 'BOUNCY_PEG', 'STICKY_PEG', 'MAGNET_PEG', 'SPLIT_PEG',
    ]);
    expect(PEG_PHYSICS.BOUNCY_PEG.restitution).toBeGreaterThan(PEG_PHYSICS.NORMAL_PEG.restitution);
    expect(PEG_PHYSICS.STICKY_PEG.restitution).toBeLessThan(PEG_PHYSICS.NORMAL_PEG.restitution);
    expect(PEG_PHYSICS.STICKY_PEG.friction).toBeGreaterThan(PEG_PHYSICS.NORMAL_PEG.friction);
    expect(PEG_PHYSICS.MAGNET_PEG.magnetRadius).toBe(6);
    expect(PEG_PHYSICS.SPLIT_PEG.split).toBe(true);
  });

  it('zieht einen Ball im Magnetradius deterministisch zum Peg', () => {
    const world = new PhysicsWorld({ gravity: { x: 0, y: 0 }, fixedDt: 1 / 120 });
    world.add(staticBody({ kind: 'circle', radius: 1.8 }, { position: { x: 0, y: 0 } }));
    world.addAttractor({ position: { x: 0, y: 0 }, radius: 6, strength: 180 });
    const ball = world.add(ballBody(2, { position: { x: 5, y: 0 } }));
    for (let step = 0; step < 120; step += 1) world.step(1 / 120);
    expect(ball.position.x).toBeLessThan(5);
  });
});

describe('Reihen-Leiter', () => {
  const config = withPegs(3);
  it('schaltet die Reihen 8 bis 11 an den vereinbarten Schwellen frei', () => {
    expect(plinkoProgress(24, 0, defaultPlinkoConfig()).rows).toBe(8);
    expect(plinkoProgress(25, 0, defaultPlinkoConfig()).rows).toBe(9);
    expect(plinkoProgress(75, 0, defaultPlinkoConfig()).rows).toBe(10);
    expect(plinkoProgress(200, 0, defaultPlinkoConfig()).rows).toBe(10);
    expect(plinkoProgress(200, 0, config).rows).toBe(11);
    expect(plinkoProgress(200, 41, config).rows).toBe(12);
  });

  it('erweitert das Physikbrett mit jeder freien Reihe', () => {
    const rows = plinkoProgress(200, 41, config).rows;
    expect(createPlinkoBoard(config, rows).rows).toBe(rows);
    expect(createPlinkoBoard(defaultPlinkoConfig(), 8).rows).toBe(8);
  });
});

describe('Multi-Ball und Split', () => {
  it('berechnet SINGLE, TWIN und TRIPLE mit getrennten Bahnen', () => {
    const board = createPlinkoBoard(defaultPlinkoConfig(), 8);
    const single = board.drop(new Prng(randomSeed()), 'SINGLE');
    const twin = board.drop(new Prng(randomSeed()), 'TWIN');
    const triple = board.drop(new Prng(randomSeed()), 'TRIPLE');
    expect(single.tracks).toHaveLength(1);
    expect(twin.tracks).toHaveLength(2);
    expect(triple.tracks).toHaveLength(3);
    expect(triple.pockets).toHaveLength(3);
    expect(triple.tracks[0]![0]!.x).not.toBe(triple.tracks[1]![0]!.x);
  });

  it('spaltet bei einem SPLIT_PEG in unabhaengige Teilbaelle', () => {
    const config = normalizePlinkoConfig({
      ...defaultPlinkoConfig(),
      pegs: [{ row: 0, column: 4, kind: 'SPLIT_PEG' }],
    });
    // Ob der Ball den Split-Peg trifft, haengt am zufaelligen Startwurf. Statt auf einen
    // gluecklichen Seed zu hoffen, suchen wir den Wurf, der die Vorbedingung erfuellt, und
    // pruefen dann seine Folge -- sonst waere der Test bei einem Teil der Seeds rot.
    let split: PlinkoDrop | null = null;
    for (let attempt = 0; attempt < 40 && !split; attempt += 1) {
      const drop = createPlinkoBoard(config, 8).drop(new Prng(randomSeed()), 'TWIN');
      if (drop.tracks.length > 2) split = drop;
    }
    expect(split, 'kein Wurf traf den Split-Peg').not.toBeNull();
    expect(split!.tracks.length).toBeGreaterThan(2);
    expect(split!.pockets.length).toBe(split!.tracks.length);
  });

  it('liefert fuer denselben Seed dieselben Bahnen', () => {
    const board = createPlinkoBoard(defaultPlinkoConfig(), 8);
    const seed = randomSeed();
    expect(board.drop(new Prng(seed), 'TRIPLE')).toEqual(board.drop(new Prng(seed), 'TRIPLE'));
  });
});

describe('RTP-Gate', () => {
  it('akzeptiert das Standardbrett und blockiert ein zu centerlastiges Brett', () => {
    const good = deployGate(defaultPlinkoConfig(), 8);
    expect(good.ok).toBe(true);
    const bad = normalizePlinkoConfig({
      ...defaultPlinkoConfig(),
      pocketWidths: [1, 1, 1, 1, 92, 1, 1, 1, 1],
    });
    const blocked = deployGate(bad, 8);
    expect(blocked.ok).toBe(false);
    expect(blocked.measuredRtp).toBeLessThan(0.85);
    expect(blocked.reason.length).toBeGreaterThan(0);
  }, 120_000);

  it('nutzt eine ehrliche deterministische Paytable-Stichprobe', () => {
    const table = plinkoPaytable(9);
    expect(table).toHaveLength(9);
    expect(table[0]).toBeGreaterThan(table[4]!);
  });

  it('belegt das Ergebnis mit mehreren Seeds und einem Konfidenzintervall', () => {
    const gate = deployGate(defaultPlinkoConfig(), 8);

    expect(gate.seeds).toBeGreaterThan(1);
    expect(gate.samples % gate.seeds).toBe(0);
    expect(gate.samples).toBeGreaterThanOrEqual(3_000);
    expect(gate.ciLow).toBeLessThanOrEqual(gate.measuredRtp);
    expect(gate.ciHigh).toBeGreaterThanOrEqual(gate.measuredRtp);
    // Die Stichprobe muss eng genug sein, um ueber das Hausband entscheiden zu duerfen.
    expect((gate.ciHigh - gate.ciLow) / 2).toBeLessThan(0.03);
    expect(gate.reason).toContain('95 %-KI');
    expect(gate.reason).toContain(`${gate.samples} Wuerfen`);
  }, 120_000);
});
