/**
 * @test-target: src/render/reaction-feedback.ts
 * @error-code: ERR-3001
 *
 * Integration scope: reaction-feedback contracts.
 * These tests verify that:
 *   1. All exported types are actively used (dead-code gate).
 *   2. Factory output is structurally correct and deterministic.
 *   3. Visibility filter is spatially isolated (no cross-context bleed).
 *   4. Batch helper composes correctly with the filter.
 */

import { describe, it, expect } from 'vitest';
import {
  createReactionForAction,
  shouldShowReaction,
  filterVisibleReactions,
} from '../reaction-feedback';
import type {
  ActionReaction,
  ActionReactionKind,
  PlayerReactionContext,
  ReactionContext,
  ReactionPosition,
  ReactionSpatialContext,
} from '../reaction-feedback';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePosition(x: number, y: number): ReactionPosition {
  return { x, y };
}

function makePlayerCtx(
  spatialContext: ReactionSpatialContext,
  layoutId: string,
): PlayerReactionContext {
  return { spatialContext, layoutId };
}

function makeReactionCtx(
  spatialContext: ReactionSpatialContext,
  layoutId: string,
): ReactionContext {
  return { spatialContext, layoutId };
}

// ---------------------------------------------------------------------------
// createReactionForAction
// ---------------------------------------------------------------------------

describe('createReactionForAction', () => {
  it('creates a HEAD_TURN reaction with default duration', () => {
    const kind: ActionReactionKind = 'HEAD_TURN';
    const reaction: ActionReaction = createReactionForAction(
      kind,
      'npc-001',
      makePosition(3, 7),
    );

    expect(reaction.kind).toBe('HEAD_TURN');
    expect(reaction.targetActorId).toBe('npc-001');
    expect(reaction.position).toEqual({ x: 3, y: 7 });
    expect(reaction.durationMs).toBe(800);
    expect(reaction.visualData).toEqual({});
  });

  it('creates a DOOR_OPEN reaction for environment (null actor)', () => {
    const reaction: ActionReaction = createReactionForAction(
      'DOOR_OPEN',
      null,
      makePosition(0, 0),
    );

    expect(reaction.kind).toBe('DOOR_OPEN');
    expect(reaction.targetActorId).toBeNull();
    expect(reaction.durationMs).toBe(400);
  });

  it('respects durationMs override', () => {
    const reaction: ActionReaction = createReactionForAction(
      'PHONE_GLOW',
      'player',
      makePosition(1, 1),
      { durationMs: 999 },
    );

    expect(reaction.durationMs).toBe(999);
  });

  it('respects visualData override', () => {
    const visualData = { icon: 'sparkle', intensity: 2 } as const;
    const reaction: ActionReaction = createReactionForAction(
      'ATTENTION_INDICATOR',
      'npc-002',
      makePosition(5, 5),
      { visualData },
    );

    expect(reaction.visualData).toEqual(visualData);
  });

  it('is deterministic: same inputs produce identical output', () => {
    const a = createReactionForAction('DROP', 'prop-01', makePosition(2, 4));
    const b = createReactionForAction('DROP', 'prop-01', makePosition(2, 4));

    expect(a).toEqual(b);
  });

  it('covers every ActionReactionKind with correct defaults', () => {
    const cases: Array<[ActionReactionKind, number]> = [
      ['HEAD_TURN', 800],
      ['DISMISS_GESTURE', 600],
      ['DOOR_OPEN', 400],
      ['DOOR_CLOSE', 400],
      ['PHONE_GLOW', 1200],
      ['PICKUP', 500],
      ['DROP', 500],
      ['ATTENTION_INDICATOR', 1500],
    ];

    for (const [kind, expectedMs] of cases) {
      const r = createReactionForAction(kind, null, makePosition(0, 0));
      expect(r.durationMs, `default for ${kind}`).toBe(expectedMs);
    }
  });
});

// ---------------------------------------------------------------------------
// shouldShowReaction
// ---------------------------------------------------------------------------

describe('shouldShowReaction', () => {
  it('returns true when contexts match exactly', () => {
    const player = makePlayerCtx('INTERIOR', 'apartment-main');
    const reaction = makeReactionCtx('INTERIOR', 'apartment-main');

    expect(shouldShowReaction(player, reaction)).toBe(true);
  });

  it('returns false when spatial contexts differ', () => {
    const player = makePlayerCtx('INTERIOR', 'apartment-main');
    const reaction = makeReactionCtx('EXTERIOR', 'apartment-main');

    expect(shouldShowReaction(player, reaction)).toBe(false);
  });

  it('returns false when layoutId differs', () => {
    const player = makePlayerCtx('EXTERIOR', 'street-nord');
    const reaction = makeReactionCtx('EXTERIOR', 'street-sued');

    expect(shouldShowReaction(player, reaction)).toBe(false);
  });

  it('returns false when both context and layoutId differ', () => {
    const player = makePlayerCtx('INTERIOR', 'casino-floor');
    const reaction = makeReactionCtx('EXTERIOR', 'street-nord');

    expect(shouldShowReaction(player, reaction)).toBe(false);
  });

  it('works for EXTERIOR context', () => {
    const player = makePlayerCtx('EXTERIOR', 'street-main');
    const reaction = makeReactionCtx('EXTERIOR', 'street-main');

    expect(shouldShowReaction(player, reaction)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// filterVisibleReactions
// ---------------------------------------------------------------------------

describe('filterVisibleReactions', () => {
  it('passes through only reactions in the same context+layout', () => {
    const interior = createReactionForAction('HEAD_TURN', 'npc-a', makePosition(1, 1));
    const exterior = createReactionForAction('DISMISS_GESTURE', 'npc-b', makePosition(2, 2));

    const ctxMap = new Map<string | null, ReactionContext>([
      ['npc-a', makeReactionCtx('INTERIOR', 'room-01')],
      ['npc-b', makeReactionCtx('EXTERIOR', 'street-01')],
    ]);

    const player = makePlayerCtx('INTERIOR', 'room-01');
    const visible = filterVisibleReactions([interior, exterior], ctxMap, player);

    expect(visible).toHaveLength(1);
    expect(visible[0]?.kind).toBe('HEAD_TURN');
  });

  it('returns empty array when no reactions are visible', () => {
    const r = createReactionForAction('DOOR_OPEN', null, makePosition(0, 0));
    const ctxMap = new Map<string | null, ReactionContext>([
      [null, makeReactionCtx('EXTERIOR', 'street-01')],
    ]);

    const player = makePlayerCtx('INTERIOR', 'apartment-main');
    const visible = filterVisibleReactions([r], ctxMap, player);

    expect(visible).toHaveLength(0);
  });

  it('returns empty array when reaction has no context entry', () => {
    const r = createReactionForAction('PICKUP', 'unknown-actor', makePosition(0, 0));
    const ctxMap = new Map<string | null, ReactionContext>();

    const player = makePlayerCtx('INTERIOR', 'room-01');
    const visible = filterVisibleReactions([r], ctxMap, player);

    expect(visible).toHaveLength(0);
  });

  it('handles empty input gracefully', () => {
    const ctxMap = new Map<string | null, ReactionContext>();
    const player = makePlayerCtx('EXTERIOR', 'street-01');

    expect(filterVisibleReactions([], ctxMap, player)).toEqual([]);
  });
});
