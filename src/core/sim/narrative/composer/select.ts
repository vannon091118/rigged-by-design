/** NAR-11: Deterministische Auswahl ohne Gameplay-PRNG und ohne Seiteneffekte. */
import type { ContentSlot, ContentSlotKind } from '../events/template-types';
import { COMPOSER_SLOT_SOURCES } from './slot-map.generated';
import type { ComposeRequest, NarrativeFragment } from './types';

/**
 * Kurze, kontextfreie Sicherheitscopy je Locale; keine Figuren, Fakten oder
 * Mechanik. Eine unbekannte Locale hat bewusst keinen Fallback: der Composer
 * meldet dann `ok: false`, statt deutsche Saetze als englische auszugeben.
 */
const FALLBACKS: Readonly<Record<string, Readonly<Record<ContentSlotKind, string>>>> = {
  de: {
    TITLE: 'Ein Abend im Neonlicht',
    BODY: 'Die Szene bleibt offen; das Haus wartet auf den naechsten Schritt.',
    CHOICE_LABEL: 'Weiter',
    OUTCOME: 'Der Abend nimmt seinen Lauf.',
  },
};

const compareId = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0);

/** FNV-1a: stabiler Gleichstandsschluessel ohne Spiel-RNG und ohne Zustand. */
function hashOf(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/** `null` heisst: fuer diese Locale gibt es keine gepflegte Sicherheitscopy. */
export function fallbackText(kind: ContentSlotKind, locale: string): string | null {
  return FALLBACKS[locale]?.[kind] ?? null;
}

function scoreOf(
  fragment: NarrativeFragment,
  request: ComposeRequest,
  slotContexts: readonly string[],
): number {
  const required = [...(request.requiredContexts ?? []), ...slotContexts];
  if (required.some((context) => !fragment.contexts.includes(context))) return -1;
  const contexts = request.contexts ?? [];
  const hits = contexts.filter((context) => fragment.contexts.includes(context)).length;
  if (contexts.length > 0 && hits === 0) return -1;
  const requiredFlags = request.requiredFlags ?? [];
  if (requiredFlags.some((flag) => !fragment.flags.includes(flag))) return -1;
  const personas = request.availablePersonas ?? [];
  if (fragment.personaRefs.some((persona) => !personas.includes(persona))) return -1;
  const flagHits = requiredFlags.filter((flag) => fragment.flags.includes(flag)).length;
  const exact = [request.tone, request.mood, request.relationship].filter((value, index) => {
    const actual = [fragment.tone, fragment.mood, fragment.relationship][index];
    return value !== undefined && value === actual;
  }).length;
  return hits * 4 + flagHits * 2 + fragment.personaRefs.length * 2 + exact;
}

/**
 * Gleiche Anfrage + gleiche Registry => gleiche Auswahl, auch bei anderer
 * Reihenfolge. Der Slot-Zweck (`requiredContexts`) filtert hart, `contexts`
 * bewertet nur. Bei Gleichstand entscheidet mit Szenen-ID ein FNV-Hash aus
 * Event und Slot; ohne Szenen-ID bleibt `contributionId` der stabile Schluessel.
 */
export function selectFragment(
  fragments: readonly NarrativeFragment[],
  request: ComposeRequest,
  slot: ContentSlot,
): NarrativeFragment | null {
  const sources = (COMPOSER_SLOT_SOURCES as Readonly<Record<string, readonly string[]>>)[slot.kind] ?? [];
  const candidates = fragments
    .filter((fragment) => fragment.locale === request.locale && sources.includes(fragment.slot))
    .map((fragment) => ({ fragment, score: scoreOf(fragment, request, slot.requiredContexts ?? []) }))
    .filter((entry) => entry.score >= 0)
    .sort((left, right) => right.score - left.score
      || compareId(left.fragment.contributionId, right.fragment.contributionId));
  const [best] = candidates;
  if (!best) return null;
  const tied = candidates.filter((entry) => entry.score === best.score);
  if (request.eventInstanceId !== undefined && tied.length > 1) {
    const index = hashOf(`${request.eventInstanceId}:${slot.id}`) % tied.length;
    return tied[index]?.fragment ?? best.fragment;
  }
  return best.fragment;
}
