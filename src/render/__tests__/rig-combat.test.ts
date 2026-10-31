/**
 * @test-target: src/render/rig-pose.ts
 * @error-code: ERR-1003
 *
 * Kampf und Verletzung muessen sichtbar sein: eigene Posen, eigene Uebergaenge,
 * und der Floor darf den Spieler nicht als gesund zeichnen, wenn er es nicht ist.
 */
import { describe, expect, it } from 'vitest';
import { actorStateFor, poseFor } from '../rig-pose';

const base = { state: 'WAIT', pathLength: 0, pathIndex: 0, isPlayer: true } as const;

describe('Kampf- und Verletzungsposen', () => {
  it('zeichnet den verletzten Spieler humpelnd statt aufrecht', () => {
    expect(actorStateFor({ ...base, injured: true })).toBe('hurt');
    const hurt = poseFor('hurt', 0, 0);
    const idle = poseFor('idle', 0, 0);
    expect(hurt.lean).toBeGreaterThan(idle.lean);
    expect(hurt.headY).toBeGreaterThan(idle.headY);
    expect(Math.abs(hurt.armR)).toBeLessThan(Math.abs(hurt.armL));
  });

  it('nimmt im Handgemenge Vorrang vor allem anderen', () => {
    expect(actorStateFor({ ...base, injured: true, fighting: true })).toBe('fight');
    expect(actorStateFor({ ...base, fighting: true, carrying: 'KRATE:4' })).toBe('fight');
    const fight = poseFor('fight', 0, 0);
    expect(fight.armL).toBeLessThan(0);
    expect(fight.armR).toBeLessThan(0);
    expect(Math.abs(fight.legL - fight.legR)).toBeGreaterThan(0.4);
  });

  it('laesst Gaeste von Kampfposen unberuehrt', () => {
    expect(actorStateFor({ state: 'PLAY', pathLength: 0, pathIndex: 0, injured: true })).toBe('play');
  });
});
