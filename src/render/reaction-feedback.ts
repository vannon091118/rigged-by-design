/**
 * @module reaction-feedback
 * @description Reactive presentation contract for in-world action feedback.
 * Maps game-state transitions to visual reaction cues without introducing
 * a second state owner – the render layer reads snapshots, never writes world state.
 *
 * All positions are abstract 2-D grid coordinates; the renderer maps them to
 * pixel space. No Math.random(), Date.now() or external randomness – callers
 * supply deterministic context from the world-store tick.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Every kind of visual cue that can be emitted in response to an action. */
export type ActionReactionKind =
  | 'HEAD_TURN'
  | 'DISMISS_GESTURE'
  | 'DOOR_OPEN'
  | 'DOOR_CLOSE'
  | 'PHONE_GLOW'
  | 'PICKUP'
  | 'DROP'
  | 'ATTENTION_INDICATOR';

/** Spatial context in which an actor or prop lives (mirrors SpatialContextKind). */
export type ReactionSpatialContext = 'EXTERIOR' | 'INTERIOR';

/** Lightweight 2-D position for rendering; no physics, no world-store dependency. */
export interface ReactionPosition {
  readonly x: number;
  readonly y: number;
}

/** A single visual reaction that the renderer should play. */
export interface ActionReaction {
  /** What kind of feedback to show. */
  readonly kind: ActionReactionKind;
  /** ID of the actor or prop that should display the reaction; null = environment. */
  readonly targetActorId: string | null;
  /** Grid position where the cue should appear. */
  readonly position: ReactionPosition;
  /** How long the cue remains on screen, in milliseconds. */
  readonly durationMs: number;
  /** Kind-specific payload (e.g. icon name, colour hint, label). Opaque to this module. */
  readonly visualData: Readonly<Record<string, string | number | boolean>>;
}

/** Minimal context about the player needed for visibility filtering. */
export interface PlayerReactionContext {
  readonly spatialContext: ReactionSpatialContext;
  readonly layoutId: string;
}

/** Context of the reaction itself needed for visibility filtering. */
export interface ReactionContext {
  readonly spatialContext: ReactionSpatialContext;
  readonly layoutId: string;
}

// ---------------------------------------------------------------------------
// Default durations per kind (ms)
// ---------------------------------------------------------------------------

const DEFAULT_DURATION_MS: Record<ActionReactionKind, number> = {
  HEAD_TURN: 800,
  DISMISS_GESTURE: 600,
  DOOR_OPEN: 400,
  DOOR_CLOSE: 400,
  PHONE_GLOW: 1200,
  PICKUP: 500,
  DROP: 500,
  ATTENTION_INDICATOR: 1500,
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a canonical ActionReaction for the given kind.
 * Duration defaults to the kind's preset; callers may override via options.
 *
 * @param kind           - The reaction category.
 * @param targetActorId  - Which actor / prop carries the cue; pass null for env cues.
 * @param position       - Grid position where the cue should appear.
 * @param options        - Optional overrides (durationMs, visualData).
 */
export function createReactionForAction(
  kind: ActionReactionKind,
  targetActorId: string | null,
  position: ReactionPosition,
  options: {
    durationMs?: number;
    visualData?: Readonly<Record<string, string | number | boolean>>;
  } = {},
): ActionReaction {
  return {
    kind,
    targetActorId,
    position,
    durationMs: options.durationMs ?? DEFAULT_DURATION_MS[kind],
    visualData: options.visualData ?? {},
  };
}

// ---------------------------------------------------------------------------
// Visibility filter
// ---------------------------------------------------------------------------

/**
 * Returns true when the player can actually see the reaction.
 * A reaction is only visible when both player and reaction share the same
 * spatial context AND the same layout (room / street segment).
 *
 * This keeps the render layer honest: an interior reaction must not bleed
 * into an exterior view just because the data is present.
 */
export function shouldShowReaction(
  playerCtx: PlayerReactionContext,
  reactionCtx: ReactionContext,
): boolean {
  return (
    playerCtx.spatialContext === reactionCtx.spatialContext &&
    playerCtx.layoutId === reactionCtx.layoutId
  );
}

// ---------------------------------------------------------------------------
// Batch helper
// ---------------------------------------------------------------------------

/**
 * Filters a list of reactions to only those visible to the player.
 * Convenience wrapper over shouldShowReaction for the render loop.
 */
export function filterVisibleReactions(
  reactions: readonly ActionReaction[],
  reactionContexts: ReadonlyMap<string | null, ReactionContext>,
  playerCtx: PlayerReactionContext,
): ActionReaction[] {
  return reactions.filter((r) => {
    const ctx = reactionContexts.get(r.targetActorId);
    if (ctx === undefined) return false;
    return shouldShowReaction(playerCtx, ctx);
  });
}
