/** Einzige Registry der verketteten Narrative; ungueltige oder textlose Ketten fallen raus. */
import { templateFor } from '../../events/definitions';
import { isNarrativeChain } from '../chain-schema';
import type { NarrativeChain } from '../chain-types';
import { PAIR_CONFLICT_ARC } from './pair-conflict-arc';
import { VISITOR_WARM_ARC } from './visitor-warm-arc';

const SOURCES: readonly NarrativeChain[] = [VISITOR_WARM_ARC, PAIR_CONFLICT_ARC];

/** Jeder Knoten braucht ein Template; sonst ist die Kette nicht spielbar. */
const usable = (chain: NarrativeChain): boolean => isNarrativeChain(chain)
  && chain.nodes.every((node) => templateFor(node.eventId) !== null);

export const NARRATIVE_CHAINS: readonly NarrativeChain[] = SOURCES.filter(usable);

export function chainFor(chainId: string, version?: number): NarrativeChain | null {
  return NARRATIVE_CHAINS.find((chain) => chain.chainId === chainId
    && (version === undefined || chain.version === version)) ?? null;
}
