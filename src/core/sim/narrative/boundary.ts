/** Einziger Verbraucher der Fact-Queue: Ledger-Facts erzeugen, einmal drainieren, anwenden. */
import type { Ledger } from '../../economy/ledger';
import type { WorldState } from '../types';
import { drainFacts, pushRecent } from './facts';
import { processLedgerFacts } from './ledger-facts';
import { applyMemories } from './memory';
import { applyRelationshipFacts } from './relationship-apply';

/**
 * Verarbeitet hoechstens einen Durchlauf. Facts, die waehrend der Verarbeitung entstehen,
 * bleiben fuer den naechsten Boundary-Aufruf liegen; es gibt keine Rekursion.
 */
export function processNarrativeBoundary(world: WorldState, ledger: Ledger): number {
  processLedgerFacts(world, ledger);
  const fresh = drainFacts(world);
  if (fresh.length === 0) return 0;
  const applied = applyMemories(world, fresh);
  applyRelationshipFacts(world, fresh);
  pushRecent(world, fresh);
  return applied;
}
