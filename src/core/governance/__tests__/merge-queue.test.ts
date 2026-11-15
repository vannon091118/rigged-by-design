/**
 * @test-target: scripts/lib/merge-queue.mjs
 * @error-code: ERR-4019
 *
 * Der Merge-Koordinator (#913) darf nie stillschweigend zustimmen: fehlende,
 * alte, doppelte oder gefaelschte ACKs, ein Plan ohne Maintainer-Session,
 * Head-Drift, parallele Plaene und ein Kettenbruch muessen HOLD ergeben. Ohne
 * externen Kettenkopf ist die Kette nur erkennend, also ebenfalls HOLD.
 */
import { describe, expect, it } from 'vitest';
import {
  buildMergeState,
  canonicalPlan,
  evaluateMerge,
  hashChain,
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

function plan(id: number, minute: number, rev: number, head = HEAD_1, session = 's-main'): Comment {
  const hash = planHash({ rev, main: MAIN, prs: [{ number: 912, head, base: BASE }] });
  return comment(id, minute, `MERGE_PLAN rev=${rev} main=${MAIN} ${prs(head)} session=${session} hash=${hash}`);
}

function ack(id: number, minute: number, session: string, rev: number, head = HEAD_1): Comment {
  const hash = planHash({ rev, main: MAIN, prs: [{ number: 912, head, base: BASE }] });
  return comment(id, minute, `MERGE_ACK rev=${rev} hash=${hash} main=${MAIN} session=${session}`);
}

/** Prueft gegen den externen Anker desselben Verlaufs (der Normalfall). */
function state(comments: Comment[], anchor = hashChain(parseEvents(comments)).head) {
  return buildMergeState(comments, { expectedChainHead: anchor });
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
    const current = state(comments);
    expect(current.hold).toEqual([]);
    expect(current.ready).toBe(true);
    expect(current.queue[0]).toMatchObject({ number: 912, status: 'READY' });
    expect(evaluateMerge(current, { number: 912, head: HEAD_1, base: BASE, main: MAIN }).ok).toBe(true);
  });

  it('akzeptiert einen Plan nur von einer aktiven Maintainer-Session', () => {
    const workerPlan = [
      join(1, 1, 's-main', 'maintainer'), join(2, 2, 's-a'),
      plan(3, 3, 1, HEAD_1, 's-a'),
      ack(4, 4, 's-main', 1), ack(5, 5, 's-a', 1),
    ];
    const rejected = state(workerPlan);
    expect(rejected.ready).toBe(false);
    expect(rejected.plan).toBeNull();
    expect(rejected.hold.join(' ')).toContain('PLAN ohne aktive Maintainer-Session');

    const noSession = [join(1, 1, 's-main', 'maintainer'), comment(2, 2, `MERGE_PLAN rev=1 main=${MAIN} ${prs()}`)];
    expect(state(noSession).hold.join(' ')).toContain('PLAN ohne aktive Maintainer-Session');
  });

  it('blockiert ohne externen Kettenkopf (Kette nur erkennend)', () => {
    const comments = [join(1, 1, 's-main', 'maintainer'), plan(2, 2, 1), ack(3, 3, 's-main', 1)];
    const withoutAnchor = buildMergeState(comments);
    expect(withoutAnchor.ready).toBe(false);
    expect(withoutAnchor.hold.join(' ')).toContain('kein externer Kettenkopf');
    expect(state(comments).ready).toBe(true);
  });

  it('blockiert bei fehlendem ACK eines aktiven Workers', () => {
    const comments = [join(1, 1, 's-main', 'maintainer'), join(2, 2, 's-a'), plan(3, 3, 1), ack(4, 4, 's-main', 1)];
    const current = state(comments);
    expect(current.ready).toBe(false);
    expect(current.hold).toContain('ACK fehlt: s-a');
    expect(evaluateMerge(current, { number: 912, head: HEAD_1, base: BASE, main: MAIN }).ok).toBe(false);
  });

  it('verwirft ein ACK, das vor dem Plan entstanden ist', () => {
    const comments = [join(1, 1, 's-main', 'maintainer'), join(2, 2, 's-a'), ack(3, 3, 's-a', 1), plan(4, 4, 1), ack(5, 5, 's-main', 1)];
    expect(state(comments).hold.join(' ')).toContain('ACK vor jedem PLAN');
  });

  it('vergleicht Zeitstempel ueber die Zeit, nicht lexikographisch', () => {
    const comments = [
      join(1, 1, 's-main', 'maintainer'),
      { ...plan(2, 2, 1), createdAt: '2026-11-15T10:00:00+01:00' },
      { ...ack(3, 3, 's-main', 1), createdAt: '2026-11-15T09:30:00Z' },
    ];
    expect(state(comments).ready).toBe(true);
  });

  it('invalidiert ACKs, wenn der PR-Head in einer neuen Revision wechselt', () => {
    const comments = [
      join(1, 1, 's-main', 'maintainer'), join(2, 2, 's-a'),
      plan(3, 3, 1), ack(4, 4, 's-main', 1), ack(5, 5, 's-a', 1),
      plan(6, 6, 2, HEAD_2), ack(7, 7, 's-main', 2, HEAD_2),
    ];
    const current = state(comments);
    expect(current.plan?.rev).toBe(2);
    expect(current.ready).toBe(false);
    expect(current.hold).toContain('ACK fehlt: s-a');
    expect(evaluateMerge(current, { number: 912, head: HEAD_1, base: BASE, main: MAIN }).ok).toBe(false);
  });

  it('zaehlt doppelte ACKs nur einmal und meldet widerspruechliche', () => {
    const comments = [join(1, 1, 's-main', 'maintainer'), plan(2, 2, 1), ack(3, 3, 's-main', 1), ack(4, 4, 's-main', 1)];
    expect(state(comments).ready).toBe(true);
    const conflicting = [...comments, ack(5, 5, 's-main', 1, HEAD_2)];
    expect(state(conflicting).hold.join(' ')).toContain('widerspruechliche ACKs');
  });

  it('nimmt eine ausdrueckliche LEAVE-Session aus der Teilnehmermenge', () => {
    const comments = [
      join(1, 1, 's-main', 'maintainer'), join(2, 2, 's-a'),
      comment(3, 3, 'MERGE_SESSION_LEAVE session=s-a'),
      plan(4, 4, 1), ack(5, 5, 's-main', 1),
    ];
    const current = state(comments);
    expect(current.participants.map((entry: { session: string }) => entry.session)).toEqual(['s-main']);
    expect(current.ready).toBe(true);
  });

  it('lehnt ACKs unbekannter Sessions und ungueltiger Rollen ab', () => {
    const comments = [
      join(1, 1, 's-main', 'maintainer'),
      comment(2, 2, 'MERGE_SESSION_JOIN role=owner agent=Fake session=s-fake'),
      plan(3, 3, 1), ack(4, 4, 's-main', 1), ack(5, 5, 's-none', 1),
    ];
    const current = state(comments);
    expect(current.ready).toBe(false);
    expect(current.hold.join(' ')).toContain('JOIN ohne gueltige Rolle');
    expect(current.hold.join(' ')).toContain('ACK ohne aktive Session');
  });

  it('behandelt konkurrierende Plaene deterministisch: nur die hoehere Revision gilt', () => {
    const comments = [join(1, 1, 's-main', 'maintainer'), plan(2, 2, 1), plan(3, 3, 2), plan(4, 4, 2)];
    const current = state(comments);
    expect(current.plan?.rev).toBe(2);
    expect(current.hold.join(' ')).toContain('ist nicht neuer als');
    expect(current.ready).toBe(false);
  });

  it('meldet einen Kettenbruch und einen abweichenden erwarteten Kopf als HOLD', () => {
    const comments = [join(1, 1, 's-main', 'maintainer'), plan(2, 2, 1), ack(3, 3, 's-main', 1)];
    const head = hashChain(parseEvents(comments)).head;
    expect(verifyChain(parseEvents(comments), head).ok).toBe(true);
    expect(verifyChain(parseEvents(comments), head).verified).toBe(true);
    expect(buildMergeState(comments, { expectedChainHead: 'f'.repeat(64) }).ready).toBe(false);
    const tampered = [comments[0]!, { ...comments[1]!, body: `${comments[1]!.body} prs=912@${HEAD_2}:${BASE}` }, comments[2]!];
    const broken = buildMergeState(tampered, { expectedChainHead: head });
    expect(broken.ready).toBe(false);
    expect(broken.hold).toContain('Ereignis-Kette weicht vom erwarteten Kopf ab');
  });

  it('laesst nur den ersten Eintrag zu und prueft Head, Base und main exakt', () => {
    const comments = [join(1, 1, 's-main', 'maintainer'), plan(2, 2, 1), ack(3, 3, 's-main', 1)];
    const current = state(comments);
    expect(evaluateMerge(current, { number: 913, head: HEAD_1, base: BASE, main: MAIN }).ok).toBe(false);
    expect(evaluateMerge(current, { number: 912, head: HEAD_2, base: BASE, main: MAIN }).ok).toBe(false);
    expect(evaluateMerge(current, { number: 912, head: HEAD_1, base: HEAD_2, main: MAIN }).ok).toBe(false);
    expect(evaluateMerge(current, { number: 912, head: HEAD_1, base: BASE, main: HEAD_2 }).ok).toBe(false);
  });

  it('verlangt nach einem Merge eine neue, erneut bestaetigte Revision', () => {
    const comments = [
      join(1, 1, 's-main', 'maintainer'), plan(2, 2, 1), ack(3, 3, 's-main', 1),
      comment(4, 4, `MERGE_COMPLETED pr=912 merge=${MERGE} main=${MERGE}`),
    ];
    const current = state(comments);
    expect(current.ready).toBe(false);
    expect(current.hold).toContain('letzter PLAN ist bereits abgeschlossen; neue Revision noetig');
  });
});
