/**
 * @test-target: scripts/lib/merge-queue.mjs
 * @error-code: ERR-4019
 *
 * Der Merge-Koordinator (#913) darf nie stillschweigend zustimmen: fehlende,
 * alte, doppelte oder gefaelschte ACKs, Head-Drift, parallele Plaene und ein
 * Kettenbruch muessen HOLD ergeben. Die Queue ist deterministisch, damit zwei
 * Geraete denselben Plan-Hash sehen.
 */
import { describe, expect, it } from 'vitest';
import {
  buildMergeState,
  canonicalPlan,
  evaluateMerge,
  parseEvents,
  planHash,
  verifyChain,
} from '../../../../scripts/lib/merge-queue.mjs';

const MAIN = 'a'.repeat(40);
const HEAD_1 = 'b'.repeat(40);
const HEAD_2 = 'c'.repeat(40);
const BASE = 'd'.repeat(40);
const MERGE = 'e'.repeat(40);

interface Comment {
  readonly id: number;
  readonly createdAt: string;
  readonly author: { readonly login: string };
  readonly body: string;
}

const at = (minute: number): string => `2026-11-15T10:${String(minute).padStart(2, '0')}:00Z`;

function comment(id: number, minute: number, body: string, login = 'vannon091118'): Comment {
  return { id, createdAt: at(minute), author: { login }, body };
}

function prs(head = HEAD_1): string {
  return `prs=912@${head}:${BASE}`;
}

function join(id: number, minute: number, session: string, role = 'worker'): Comment {
  return comment(id, minute, `MERGE_SESSION_JOIN role=${role} agent=Jenova session=${session} claim=A24`);
}

function plan(id: number, minute: number, rev: number, head = HEAD_1): Comment {
  const hash = planHash({ rev, main: MAIN, prs: [{ number: 912, head, base: BASE }] });
  return comment(id, minute, `MERGE_PLAN rev=${rev} main=${MAIN} ${prs(head)} hash=${hash}`);
}

function ack(id: number, minute: number, session: string, rev: number, head = HEAD_1): Comment {
  const hash = planHash({ rev, main: MAIN, prs: [{ number: 912, head, base: BASE }] });
  return comment(id, minute, `MERGE_ACK rev=${rev} hash=${hash} main=${MAIN} session=${session}`);
}

describe('Merge-Queue (#913)', () => {
  it('hasht denselben Plan unabhaengig von der PR-Reihenfolge im Kommentar', () => {
    const a = canonicalPlan({ rev: 2, main: MAIN.toUpperCase(), prs: [
      { number: 912, head: HEAD_1, base: BASE }, { number: 913, head: HEAD_2, base: BASE },
    ] });
    const b = canonicalPlan({ rev: 2, main: MAIN, prs: [
      { number: 913, head: HEAD_2.toUpperCase(), base: BASE }, { number: 912, head: HEAD_1, base: BASE },
    ] });
    expect(a).toBe(b);
  });

  it('ist READY, wenn Maintainer und alle Worker dieselbe Revision bestaetigen', () => {
    const comments = [
      join(1, 1, 's-main', 'maintainer'), join(2, 2, 's-a'), join(3, 3, 's-b'),
      plan(4, 4, 1),
      ack(5, 5, 's-main', 1), ack(6, 6, 's-a', 1), ack(7, 7, 's-b', 1),
    ];
    const state = buildMergeState(comments);
    expect(state.hold).toEqual([]);
    expect(state.ready).toBe(true);
    expect(state.queue[0]).toMatchObject({ number: 912, status: 'READY' });
    expect(evaluateMerge(state, { number: 912, head: HEAD_1, base: BASE, main: MAIN }).ok).toBe(true);
  });

  it('blockiert bei fehlendem ACK eines aktiven Workers', () => {
    const comments = [
      join(1, 1, 's-main', 'maintainer'), join(2, 2, 's-a'),
      plan(3, 3, 1), ack(4, 4, 's-main', 1),
    ];
    const state = buildMergeState(comments);
    expect(state.ready).toBe(false);
    expect(state.hold).toContain('ACK fehlt: s-a');
    expect(evaluateMerge(state, { number: 912, head: HEAD_1, base: BASE, main: MAIN }).ok).toBe(false);
  });

  it('verwirft ein ACK, das vor dem Plan entstanden ist', () => {
    const comments = [
      join(1, 1, 's-main', 'maintainer'), join(2, 2, 's-a'),
      ack(3, 3, 's-a', 1), plan(4, 4, 1), ack(5, 5, 's-main', 1),
    ];
    const state = buildMergeState(comments);
    expect(state.ready).toBe(false);
    expect(state.hold.join(' ')).toContain('ACK vor jedem PLAN');
  });

  it('invalidiert ACKs, wenn der PR-Head in einer neuen Revision wechselt', () => {
    const comments = [
      join(1, 1, 's-main', 'maintainer'), join(2, 2, 's-a'),
      plan(3, 3, 1), ack(4, 4, 's-main', 1), ack(5, 5, 's-a', 1),
      plan(6, 6, 2, HEAD_2), ack(7, 7, 's-main', 2, HEAD_2),
    ];
    const state = buildMergeState(comments);
    expect(state.plan?.rev).toBe(2);
    expect(state.ready).toBe(false);
    expect(state.hold).toContain('ACK fehlt: s-a');
    expect(evaluateMerge(state, { number: 912, head: HEAD_1, base: BASE, main: MAIN }).ok).toBe(false);
  });

  it('zaehlt doppelte ACKs nur einmal und meldet widerspruechliche', () => {
    const comments = [
      join(1, 1, 's-main', 'maintainer'),
      plan(2, 2, 1),
      ack(3, 3, 's-main', 1), ack(4, 4, 's-main', 1),
    ];
    expect(buildMergeState(comments).ready).toBe(true);
    const conflicting = [...comments, ack(5, 5, 's-main', 1, HEAD_2)];
    const state = buildMergeState(conflicting);
    expect(state.ready).toBe(false);
    expect(state.hold.join(' ')).toContain('widerspruechliche ACKs');
  });

  it('nimmt eine ausdrueckliche LEAVE-Session aus der Teilnehmermenge', () => {
    const comments = [
      join(1, 1, 's-main', 'maintainer'), join(2, 2, 's-a'),
      comment(3, 3, 'MERGE_SESSION_LEAVE session=s-a'),
      plan(4, 4, 1), ack(5, 5, 's-main', 1),
    ];
    const state = buildMergeState(comments);
    expect(state.participants.map((entry: { session: string }) => entry.session)).toEqual(['s-main']);
    expect(state.ready).toBe(true);
  });

  it('lehnt ACKs unbekannter Sessions und ungueltiger Rollen ab', () => {
    const comments = [
      join(1, 1, 's-main', 'maintainer'),
      comment(2, 2, 'MERGE_SESSION_JOIN role=owner agent=Fake session=s-fake'),
      plan(3, 3, 1), ack(4, 4, 's-main', 1), ack(5, 5, 's-none', 1),
    ];
    const state = buildMergeState(comments);
    expect(state.ready).toBe(false);
    expect(state.hold.join(' ')).toContain('JOIN ohne gueltige Rolle');
    expect(state.hold.join(' ')).toContain('ACK ohne aktive Session');
  });

  it('behandelt konkurrierende Plaene deterministisch: nur die hoehere Revision gilt', () => {
    const comments = [
      join(1, 1, 's-main', 'maintainer'),
      plan(2, 2, 1), plan(3, 3, 2), plan(4, 4, 2),
    ];
    const state = buildMergeState(comments);
    expect(state.plan?.rev).toBe(2);
    expect(state.hold.join(' ')).toContain('ist nicht neuer als');
    expect(state.ready).toBe(false);
  });

  it('meldet einen Kettenbruch und einen abweichenden erwarteten Kopf als HOLD', () => {
    const comments = [join(1, 1, 's-main', 'maintainer'), plan(2, 2, 1), ack(3, 3, 's-main', 1)];
    const head = buildMergeState(comments).chain.head;
    expect(verifyChain(parseEvents(comments), head).ok).toBe(true);
    expect(buildMergeState(comments, { expectedChainHead: 'f'.repeat(64) }).ready).toBe(false);
    const tampered = [comments[0]!, { ...comments[1]!, body: `${comments[1]!.body} prs=912@${HEAD_2}:${BASE}` }, comments[2]!];
    const broken = buildMergeState(tampered, { expectedChainHead: head });
    expect(broken.ready).toBe(false);
    expect(broken.hold).toContain('Ereignis-Kette weicht vom erwarteten Kopf ab');
  });

  it('laesst nur den ersten Eintrag zu und prueft Head, Base und main exakt', () => {
    const comments = [join(1, 1, 's-main', 'maintainer'), plan(2, 2, 1), ack(3, 3, 's-main', 1)];
    const state = buildMergeState(comments);
    expect(evaluateMerge(state, { number: 913, head: HEAD_1, base: BASE, main: MAIN }).ok).toBe(false);
    expect(evaluateMerge(state, { number: 912, head: HEAD_2, base: BASE, main: MAIN }).ok).toBe(false);
    expect(evaluateMerge(state, { number: 912, head: HEAD_1, base: HEAD_2, main: MAIN }).ok).toBe(false);
    expect(evaluateMerge(state, { number: 912, head: HEAD_1, base: BASE, main: HEAD_2 }).ok).toBe(false);
  });

  it('verlangt nach einem Merge eine neue, erneut bestaetigte Revision', () => {
    const comments = [
      join(1, 1, 's-main', 'maintainer'), plan(2, 2, 1), ack(3, 3, 's-main', 1),
      comment(4, 4, `MERGE_COMPLETED pr=912 merge=${MERGE} main=${MERGE}`),
    ];
    const state = buildMergeState(comments);
    expect(state.ready).toBe(false);
    expect(state.hold).toContain('letzter PLAN ist bereits abgeschlossen; neue Revision noetig');
  });
});
