/** Deklarative Trigger, die einen echten Fact in einen Event-Kandidaten uebersetzen. */
import type { TriggerDefinition } from '../trigger-types';
import { isTriggerDefinition } from '../trigger-schema';

/**
 * Nur Facts mit einem Template duerfen einen Event ausloesen. Die Liste ist
 * bewusst kleiner als der Fact-Vertrag; Diagnose- und Ledger-Facts bleiben hier
 * ohne Wirkung. Ungueltige Definitionen werden fail-closed verworfen.
 */
/** PROBE bleibt bewusst aussen vor: Sie hinterlaesst ein Indiz, aber kein Event. */
const RIVAL_EVENT_ACTIONS = ['TRADE_INFO', 'PRICE_MOVE', 'POACH_VISITOR', 'SABOTAGE'] as const;

export const EVENT_TRIGGER_DEFINITIONS: readonly TriggerDefinition[] = [
  { id: 'visitor-returned', condition: { op: 'fact', kind: 'VISITOR_RETURNED' } },
  // Zweite Stufe ohne Campaign-State: Wer Gutes mitbringt, bekommt eine eigene Szene.
  // Nutzt nur die vorhandene Trigger-/Cooldown-Infrastruktur, keine Template-Requirements.
  {
    id: 'visitor-returned-warm',
    condition: {
      op: 'all',
      conditions: [
        { op: 'fact', kind: 'VISITOR_RETURNED' },
        { op: 'visitor-memory', valence: 'GOOD' },
      ],
    },
  },
  { id: 'visitor-conflict', condition: { op: 'fact', kind: 'VISITOR_CONFLICT' } },
  { id: 'rival-action', condition: { op: 'rival-action', actions: RIVAL_EVENT_ACTIONS } },
].filter(isTriggerDefinition);
