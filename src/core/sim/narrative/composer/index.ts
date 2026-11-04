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
 * Eine Locale ohne gepflegte Sicherheitscopy wird abgelehnt, nie mit fremder
 * Sprache aufgefuellt; sind alle Slots Fallback, ist das Ergebnis `degraded`.
 */
export function composeNarrative(
  request: ComposeRequest,
  registry: readonly unknown[] = NARRATIVE_REGISTRY,
): ComposedNarrative {
  if (!isComposeRequest(request)) {
    return {
      ok: false,
      locale: typeof request?.locale === 'string' ? request.locale : '',
      slots: [],
      fallbacks: [],
      degraded: true,
      issues: ['ComposeRequest ist ungueltig'],
      rejected: [],
    };
  }
  const unsupported = request.slots.some((slot) => fallbackText(slot.kind, request.locale) === null);
  if (unsupported) {
    return {
      ok: false,
      locale: request.locale,
      slots: [],
      fallbacks: [],
      degraded: true,
      issues: [`Locale ${request.locale} hat keine Sicherheitscopy`],
      rejected: [],
    };
  }
  const { fragments, rejected } = validFragments(registry);
  const slots: ComposedSlot[] = request.slots.map((slot) => {
    const fragment = selectFragment(fragments, request, slot);
    if (!fragment) {
      return {
        slotId: slot.id,
        kind: slot.kind,
        text: fallbackText(slot.kind, request.locale) ?? '',
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
  const fallbacks = slots.filter((slot) => slot.fallback).map((slot) => slot.slotId);
  const degraded = slots.length > 0 && fallbacks.length === slots.length;
  return {
    ok: true,
    locale: request.locale,
    slots,
    fallbacks,
    degraded,
    issues: degraded ? ['Alle Slots sind Fallback; Registry, Locale und Personas pruefen.'] : [],
    rejected,
  };
}
