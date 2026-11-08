/** Fassade der Ereignisketten-Domaene; Aufrufer importieren nur diese Datei. */
export { advanceChains, type ChainAdvanceResult } from './chain-runtime';
export { chainContext, influenceValuesFor } from './chain-context';
export { evaluateChainCondition } from './chain-conditions';
export { chainFor, NARRATIVE_CHAINS } from './definitions';
export { createChainState, normalizeChainState } from './chain-persist';
export { isNarrativeChain } from './chain-schema';
export { cycleEdgeIds, deadEndNodeIds, mergeNodeIds, reachableNodes } from './chain-graph';
export type {
  ChainCondition, ChainConditionResult, ChainContext, ChainEdge, ChainNode,
  ChainRun, ChainRunStatus, ChainState, NarrativeChain,
} from './chain-types';
