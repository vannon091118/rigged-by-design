/** Deklarative Trigger, die einen echten Fact in einen Event-Kandidaten uebersetzen. */
import type { TriggerDefinition } from '../trigger-types';
import { isTriggerDefinition } from '../trigger-schema';

/**
 * Nur Facts mit einem Template duerfen einen Event ausloesen. Die Liste ist
 * bewusst kleiner als der Fact-Vertrag; Diagnose- und Ledger-Facts bleiben hier
 * ohne Wirkung. Ungueltige Definitionen werden fail-closed verworfen.
 */
export const EVENT_TRIGGER_DEFINITIONS: readonly TriggerDefinition[] = [
  { id: 'visitor-returned', condition: { op: 'fact', kind: 'VISITOR_RETURNED' } },
  { id: 'visitor-conflict', condition: { op: 'fact', kind: 'VISITOR_CONFLICT' } },
  { id: 'rival-action', condition: { op: 'fact', kind: 'RIVAL_ACTION' } },
].filter(isTriggerDefinition);
