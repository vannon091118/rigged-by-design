/** NAR-11: Der Composer verbindet Template-Slots mit lokalen Registry-Fragmenten. */
import type { NarrativeCommand } from '../commands/types';
import type { ContentSlot, ContentSlotKind } from '../events/template-types';

/** Die generierte Registry traegt nur Daten; Direktiven bleiben typisierte ASTs. */
export interface NarrativeFragment {
  readonly contributionId: string;
  readonly turnId: string;
  readonly agentId: string;
  readonly role: string;
  readonly locale: string;
  readonly slot: string;
  readonly function: string;
  readonly contexts: readonly string[];
  readonly tone: string;
  readonly mood: string;
  readonly relationship: string;
  readonly personaRefs: readonly string[];
  readonly flags: readonly string[];
  readonly text: string;
  readonly directives: readonly NarrativeCommand[];
  readonly source: string;
}

/**
 * Der Aufrufer liefert die mechanischen Slots des Templates und den aktuellen
 * semantischen Kontext. `availablePersonas` ist absichtlich kein ActorRef:
 * Persona-Zuordnung bleibt ausserhalb des reinen Text-Composers.
 */
export interface ComposeRequest {
  readonly locale: string;
  readonly slots: readonly ContentSlot[];
  readonly contexts?: readonly string[];
  readonly requiredFlags?: readonly string[];
  readonly availablePersonas?: readonly string[];
  readonly tone?: string;
  readonly mood?: string;
  readonly relationship?: string;
}

export interface ComposedSlot {
  readonly slotId: string;
  readonly kind: ContentSlotKind;
  readonly text: string;
  readonly contributionId: string | null;
  readonly fallback: boolean;
  readonly directives: readonly NarrativeCommand[];
}

type CompositionRejectReason = 'INVALID_FRAGMENT' | 'INVALID_DIRECTIVE';

export interface CompositionRejection {
  readonly contributionId: string;
  readonly reason: CompositionRejectReason;
}

export interface ComposedNarrative {
  readonly ok: boolean;
  readonly locale: string;
  readonly slots: readonly ComposedSlot[];
  /** Slot-IDs, fuer die kein passendes Fragment existierte. */
  readonly fallbacks: readonly string[];
  /** Wahr, wenn kein einziger Slot aus der Registry kam; der Aufrufer soll es zeigen. */
  readonly degraded: boolean;
  readonly issues: readonly string[];
  readonly rejected: readonly CompositionRejection[];
}
