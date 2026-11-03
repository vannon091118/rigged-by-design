/** NAR-11: Deterministische Auswahl ohne Gameplay-PRNG und ohne Seiteneffekte. */
import type { ContentSlotKind } from '../events/template-types';
import type { ComposeRequest, NarrativeFragment } from './types';

/** Semantische Bruecke zwischen Template-Slots und der Content-Klassifizierung. */
const SLOT_KIND_SOURCES: Readonly<Record<ContentSlotKind, readonly string[]>> = {
  TITLE: ['opening'],
  BODY: ['event-body', 'description', 'dialog'],
  CHOICE_LABEL: ['choice-preview'],
  OUTCOME: ['reaction'],
};

/** Kurze, kontextfreie Sicherheitscopy; keine Figuren, Fakten oder Mechanik. */
const FALLBACKS: Readonly<Record<ContentSlotKind, string>> = {
  TITLE: 'Ein Abend im Neonlicht',
  BODY: 'Die Szene bleibt offen; das Haus wartet auf den naechsten Schritt.',
  CHOICE_LABEL: 'Weiter',
  OUTCOME: 'Der Abend nimmt seinen Lauf.',
};

const compareId = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0);

export function fallbackText(kind: ContentSlotKind): string {
  return FALLBACKS[kind];
}

function scoreOf(fragment: NarrativeFragment, request: ComposeRequest): number {
  const contexts = request.contexts ?? [];
  const hits = contexts.filter((context) => fragment.contexts.includes(context)).length;
  if (contexts.length > 0 && hits === 0) return -1;
  const required = request.requiredFlags ?? [];
  if (required.some((flag) => !fragment.flags.includes(flag))) return -1;
  const personas = request.availablePersonas ?? [];
  if (fragment.personaRefs.some((persona) => !personas.includes(persona))) return -1;
  const flagHits = required.filter((flag) => fragment.flags.includes(flag)).length;
  const exact = [request.tone, request.mood, request.relationship].filter((value, index) => {
    const actual = [fragment.tone, fragment.mood, fragment.relationship][index];
    return value !== undefined && value === actual;
  }).length;
  return hits * 4 + flagHits * 2 + fragment.personaRefs.length * 2 + exact;
}

/** Gleiche Anfrage + gleiche Registry => gleiche Auswahl, auch bei anderer Reihenfolge. */
export function selectFragment(
  fragments: readonly NarrativeFragment[],
  request: ComposeRequest,
  kind: ContentSlotKind,
): NarrativeFragment | null {
  const sources = SLOT_KIND_SOURCES[kind];
  const candidates = fragments
    .filter((fragment) => fragment.locale === request.locale && sources.includes(fragment.slot))
    .map((fragment) => ({ fragment, score: scoreOf(fragment, request) }))
    .filter((entry) => entry.score >= 0)
    .sort((left, right) => right.score - left.score
      || compareId(left.fragment.contributionId, right.fragment.contributionId));
  return candidates[0]?.fragment ?? null;
}
