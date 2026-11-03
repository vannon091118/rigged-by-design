/** NAR-11: Lokaler, deterministischer Runtime-Composer; keine LLM- oder Netzwerkpfade. */
import { NARRATIVE_REGISTRY } from './registry.generated';
import { isComposeRequest, isNarrativeCommand, isNarrativeFragment } from './schema';
import { fallbackText, selectFragment } from './select';
import type {
  ComposeRequest, ComposedNarrative, ComposedSlot, CompositionRejection, NarrativeFragment,
} from './types';

export type {
  ComposeRequest, ComposedNarrative, ComposedSlot, CompositionRejection, NarrativeFragment,
} from './types';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function validFragments(registry: readonly unknown[]): {
  readonly fragments: readonly NarrativeFragment[];
  readonly rejected: readonly CompositionRejection[];
} {
  const fragments: NarrativeFragment[] = [];
  const rejected: CompositionRejection[] = [];
  for (const raw of registry) {
    if (isNarrativeFragment(raw)) {
      fragments.push(raw);
      continue;
    }
    const id = isRecord(raw) && typeof raw.contributionId === 'string' ? raw.contributionId : 'unknown';
    const directiveBroken = isRecord(raw) && Array.isArray(raw.directives)
      && raw.directives.some((directive) => !isNarrativeCommand(directive));
    rejected.push({ contributionId: id, reason: directiveBroken ? 'INVALID_DIRECTIVE' : 'INVALID_FRAGMENT' });
  }
  return { fragments, rejected };
}

/**
 * Setzt alle angefragten Slots zusammen. Fehlende Fragmente werden durch lokale,
 * generische Fallbacks ersetzt; Direktiven werden nur weitergereicht, nie ausgefuehrt.
 */
export function composeNarrative(
  request: ComposeRequest,
  registry: readonly unknown[] = NARRATIVE_REGISTRY,
): ComposedNarrative {
  if (!isComposeRequest(request)) {
    return {
      ok: false,
      slots: [],
      fallbacks: [],
      issues: ['ComposeRequest ist ungueltig'],
      rejected: [],
    };
  }
  const { fragments, rejected } = validFragments(registry);
  const slots: ComposedSlot[] = request.slots.map((slot) => {
    const fragment = selectFragment(fragments, request, slot.kind);
    if (!fragment) {
      return {
        slotId: slot.id,
        kind: slot.kind,
        text: fallbackText(slot.kind),
        contributionId: null,
        fallback: true,
        directives: [],
      };
    }
    return {
      slotId: slot.id,
      kind: slot.kind,
      text: fragment.text,
      contributionId: fragment.contributionId,
      fallback: false,
      directives: fragment.directives,
    };
  });
  return {
    ok: true,
    slots,
    fallbacks: slots.filter((slot) => slot.fallback).map((slot) => slot.slotId),
    issues: [],
    rejected,
  };
}
