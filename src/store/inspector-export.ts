// src/store/inspector-export.ts
/**
 * @module inspector-export
 * Read-Only-Export von WorldState, Ledger, PRNG-Streams, Save-State v11 als JSON-Snapshot.
 * Der Export ist read-only: keine Mutation des Weltzustands.
 */
import type { WorldState } from './types';
import type { LedgerEntry } from './ledger';
import type { PrngState } from './prng';

export interface InspectorSnapshot {
  world: WorldState;
  ledger: LedgerEntry[];
  prng: {
    gameplay: PrngState;
    presentation: PrngState;
  };
  saveState: {
    version: 11;
    timestamp: number;
    integrityValid: boolean;
  };
}

export function createInspectorSnapshot(
  world: WorldState,
  ledger: LedgerEntry[],
  prngGameplay: PrngState,
  prngPresentation: PrngState
): InspectorSnapshot {
  return {
    world: { ...world },
    ledger: [...ledger],
    prng: { gameplay: { ...prngGameplay }, presentation: { ...prngPresentation } },
    saveState: {
      version: 11,
      timestamp: Date.now(),
      integrityValid: true,
    },
  };
}
