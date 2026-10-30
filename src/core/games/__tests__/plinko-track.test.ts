/**
 * @test-target: src/core/games/contracts.ts
 * @error-code: ERR-1003
 *
 * Die Buehne zeigt eine echte Physikbahn. Deshalb muss das Ergebnis die Bahn
 * mitliefern — und die Tasche der Bahn muss die bezahlte Tasche sein.
 */
import { describe, expect, it } from 'vitest';
import { fromVC } from '../../economy/vacoin';
import { Prng } from '../../rng/prng';
import { playAction } from '../contracts';
import { plinkoPaytable } from '../plinko-config';
import { randomSeed } from '../../../test/random-seed';

describe('Plinko-Bahn fuer die Buehne', () => {
  it('liefert Bahn, Taschen und Schritte nur auf Anfrage', () => {
    const seed = randomSeed();
    const withTrack = playAction({ game: 'PLINKO', stake: fromVC(0.5), captureTrack: true }, new Prng(seed));
    const without = playAction({ game: 'PLINKO', stake: fromVC(0.5) }, new Prng(seed));
    expect(withTrack.drop).not.toBeUndefined();
    expect(without.drop).toBeUndefined();
    expect(withTrack.drop!.tracks).toHaveLength(withTrack.drop!.pockets.length);
    for (const track of withTrack.drop!.tracks) expect(track.length).toBeGreaterThan(20);
    expect(withTrack.drop!.steps).toBeGreaterThan(20);
  });

  it('zahlt genau die Tasche aus, in der der Ball liegen bleibt', () => {
    const prng = new Prng(randomSeed());
    const table = plinkoPaytable(9);
    for (let round = 0; round < 12; round += 1) {
      const result = playAction({ game: 'PLINKO', stake: fromVC(0.2), captureTrack: true }, prng);
      const pocket = result.drop!.pockets[0]!;
      expect(result.multiplierBps).toBe(table[pocket] ?? 0);
    }
  });

  it('bleibt bei gleichem Seed auf derselben Bahn', () => {
    const seed = randomSeed();
    const first = playAction({ game: 'PLINKO', stake: fromVC(0.3), captureTrack: true }, new Prng(seed));
    const again = playAction({ game: 'PLINKO', stake: fromVC(0.3), captureTrack: true }, new Prng(seed));
    expect(again.drop!.pockets).toEqual(first.drop!.pockets);
    expect(again.drop!.tracks[0]).toEqual(first.drop!.tracks[0]);
  });
});
