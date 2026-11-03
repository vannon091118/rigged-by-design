/** Einziger Verbraucher der Fact-Queue: Ledger-Facts erzeugen, einmal drainieren, anwenden. */
import type { Ledger } from '../../economy/ledger';
import type { WorldState } from '../types';
import { drainFacts, pushRecent } from './facts';
import { processLedgerFacts } from './ledger-facts';
import { applyMemories } from './memory';
import { applyRelationshipFacts } from './relationship-apply';
import { maintainEvents } from './event-scheduler';
import type { NarrativeFact } from './types';

interface NarrativeBoundaryResult {
  readonly applied: number;
  readonly facts: readonly NarrativeFact[];
}

/**
 * Verarbeitet hoechstens einen Durchlauf. Facts, die waehrend der Verarbeitung entstehen,
 * bleiben fuer den naechsten Boundary-Aufruf liegen; es gibt keine Rekursion.
 */
export function processNarrativeBoundaryDetailed(world: WorldState, ledger: Ledger): NarrativeBoundaryResult {
  processLedgerFacts(world, ledger);
  // Fristen und verwaiste Teilnehmer werden auch ohne neue Facts begrenzt aufgeraeumt.
  maintainEvents(world);
  const fresh = drainFacts(world);
  if (fresh.length === 0) return { applied: 0, facts: [] };
  const applied = applyMemories(world, fresh);
  applyRelationshipFacts(world, fresh);
  pushRecent(world, fresh);
  return { applied, facts: fresh };
}

/** Bestehende Fassade fuer Aufrufer, die nur den Memory-Zaehler brauchen. */
export function processNarrativeBoundary(world: WorldState, ledger: Ledger): number {
  return processNarrativeBoundaryDetailed(world, ledger).applied;
}
