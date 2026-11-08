/** Fail-closed Schemapruefung fuer Ereignisketten; ungueltige Graphen werden nie angeboten. */
import { isActorRef } from '../relationships';
import { isChoiceId } from '../events/template-schema';
import { templateFor } from '../events/definitions';
import type { RelationshipDimension } from '../trigger-types';
import { NARRATIVE_FACT_KINDS } from '../types';
import type { KnowledgeSourceKind } from '../knowledge-types';
import type { ChoiceActor } from '../events/template-types';
import { cycleEdgeIds, deadEndNodeIds, reachableNodes } from './chain-graph';
import {
  CHAIN_RUN_STATUSES, type ChainCondition, type ChainEdge, type ChainNode,
  type ChainParticipantMode, type ChainRunStatus, type NarrativeChain,
} from './chain-types';

const FLAG = /^[A-Za-z][A-Za-z0-9_]{0,31}$/;
const CONTEXT = /^[a-z0-9][a-z0-9-]{0,31}$/;
const TOPIC = /^[a-z][a-z0-9-]{0,31}$/;
const DIMENSIONS: readonly RelationshipDimension[] = ['trust', 'sympathy', 'conflict', 'influence'];
const SOURCE_KINDS: readonly KnowledgeSourceKind[] = ['ERLEBT', 'GESEHEN', 'GEHOERT', 'GELESEN'];
const MODES: readonly ChainParticipantMode[] = ['inherit', 'first', 'last'];
const LIMITS = {
  nodes: 16, edges: 32, children: 6, depth: 4, steps: 16, duration: 100_000,
  delay: 1000, cooldown: 100_000, resume: 600, participants: 16,
} as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isInt = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

function hasRange(min: unknown, max: unknown, low: number, high: number): boolean {
  if (min === undefined && max === undefined) return false;
  if (min !== undefined && (!isNumber(min) || min < low || min > high)) return false;
  if (max !== undefined && (!isNumber(max) || max < low || max > high)) return false;
  return min === undefined || max === undefined || (min as number) <= (max as number);
}

function isChainActor(raw: unknown): raw is ChoiceActor {
  if (typeof raw === 'string') return isActorRef(raw);
  return isRecord(raw) && isInt(raw.participant, 0, LIMITS.participants - 1);
}

function isCondition(raw: unknown, depth = 0): raw is ChainCondition {
  if (!isRecord(raw) || depth > LIMITS.depth) return false;
  switch (raw.op) {
    case 'all':
    case 'any':
      return Array.isArray(raw.conditions) && raw.conditions.length > 0
        && raw.conditions.length <= LIMITS.children
        && raw.conditions.every((child) => isCondition(child, depth + 1));
    case 'not':
      return isCondition(raw.condition, depth + 1);
    case 'flag-between':
      return typeof raw.flag === 'string' && FLAG.test(raw.flag)
        && hasRange(raw.min, raw.max, -1_000_000, 1_000_000);
    case 'flag-present':
    case 'flag-absent':
      return typeof raw.flag === 'string' && FLAG.test(raw.flag);
    case 'relationship-between':
      return isChainActor(raw.from) && isChainActor(raw.to)
        && typeof raw.dimension === 'string' && DIMENSIONS.includes(raw.dimension as RelationshipDimension)
        && hasRange(raw.min, raw.max, -10, 10);
    case 'house-between':
      return hasRange(raw.min, raw.max, -1_000_000_000, 1_000_000_000);
    case 'reputation-between':
      return hasRange(raw.min, raw.max, 0, 100);
    case 'influence-between':
      return typeof raw.context === 'string' && CONTEXT.test(raw.context)
        && hasRange(raw.min, raw.max, 0, 1)
        && (raw.actor === undefined || isChainActor(raw.actor));
    case 'knowledge':
      return isChainActor(raw.actor) && typeof raw.topic === 'string' && TOPIC.test(raw.topic)
        && isNumber(raw.minConfidence) && raw.minConfidence >= 0 && raw.minConfidence <= 1
        && (raw.sourceKind === undefined
          || (typeof raw.sourceKind === 'string' && SOURCE_KINDS.includes(raw.sourceKind as KnowledgeSourceKind)));
    case 'fact-count':
      return typeof raw.kind === 'string'
        && (NARRATIVE_FACT_KINDS as readonly string[]).includes(raw.kind)
        && isInt(raw.minCount, 1, 100)
        && (raw.ticks === undefined || isInt(raw.ticks, 0, LIMITS.duration));
    case 'event-resolved':
      return isChoiceId(raw.eventId)
        && (raw.outcomeId === undefined || isChoiceId(raw.outcomeId))
        && (raw.ticks === undefined || isInt(raw.ticks, 0, LIMITS.duration));
    case 'chain-visited':
      return isChoiceId(raw.nodeId) && isInt(raw.minCount, 1, 100);
    case 'tick-between':
    case 'day-between':
      return hasRange(raw.min, raw.max, 0, 1_000_000_000);
    default:
      return false;
  }
}

function isNode(raw: unknown): raw is ChainNode {
  if (!isRecord(raw) || !isChoiceId(raw.nodeId) || !isChoiceId(raw.eventId)) return false;
  if (raw.participantMode !== undefined
    && (typeof raw.participantMode !== 'string'
      || !MODES.includes(raw.participantMode as ChainParticipantMode))) return false;
  if (raw.terminal !== undefined && typeof raw.terminal !== 'boolean') return false;
  return raw.abort === undefined || isCondition(raw.abort);
}

function isEdge(raw: unknown): raw is ChainEdge {
  if (!isRecord(raw) || !isChoiceId(raw.edgeId) || !isChoiceId(raw.from) || !isChoiceId(raw.to)) return false;
  if (raw.delayTicks !== undefined && !isInt(raw.delayTicks, 0, LIMITS.delay)) return false;
  if (raw.priority !== undefined && !isInt(raw.priority, 0, 1000)) return false;
  if (raw.repeatable !== undefined && typeof raw.repeatable !== 'boolean') return false;
  if (raw.parallel !== undefined && typeof raw.parallel !== 'boolean') return false;
  return raw.when === undefined || isCondition(raw.when);
}

function templatesCompatible(chain: NarrativeChain, edge: ChainEdge): boolean {
  const from = templateFor(chain.nodes.find((node) => node.nodeId === edge.from)?.eventId ?? '');
  const to = templateFor(chain.nodes.find((node) => node.nodeId === edge.to)?.eventId ?? '');
  if (!from || !to) return false;
  const mode = chain.nodes.find((node) => node.nodeId === edge.to)?.participantMode ?? 'inherit';
  if (mode === 'inherit') return from.participantRoles.length === to.participantRoles.length;
  return to.participantRoles.length === 1;
}

/** Prueft Struktur, Bedingungen, Erreichbarkeit, Endknoten und erlaubte Zyklen. */
export function isNarrativeChain(raw: unknown): raw is NarrativeChain {
  if (!isRecord(raw) || !isChoiceId(raw.chainId) || !isInt(raw.version, 1, 1000)) return false;
  if (!isInt(raw.maxSteps, 1, LIMITS.steps) || !isInt(raw.maxDurationTicks, 1, LIMITS.duration)) return false;
  if (typeof raw.repeatable !== 'boolean' || !isInt(raw.cooldownTicks, 0, LIMITS.cooldown)) return false;
  if (raw.abort !== undefined && !isCondition(raw.abort)) return false;
  if (!Array.isArray(raw.nodes) || raw.nodes.length < 2 || raw.nodes.length > LIMITS.nodes
    || !raw.nodes.every(isNode)) return false;
  const nodeIds = raw.nodes.map((node) => node.nodeId);
  if (new Set(nodeIds).size !== nodeIds.length) return false;
  if (!isChoiceId(raw.start) || !nodeIds.includes(raw.start)) return false;
  if (!Array.isArray(raw.edges) || raw.edges.length === 0 || raw.edges.length > LIMITS.edges
    || !raw.edges.every(isEdge)) return false;
  const edgeIds = raw.edges.map((edge) => edge.edgeId);
  if (new Set(edgeIds).size !== edgeIds.length) return false;
  if (raw.edges.some((edge) => !nodeIds.includes(edge.from) || !nodeIds.includes(edge.to))) return false;
  for (const node of raw.nodes) {
    const count = raw.edges.filter((edge) => edge.from === node.nodeId).length;
    if (node.terminal === true && count > 0) return false;
    if (node.terminal !== true && count === 0) return false;
    if (raw.edges.filter((edge) => edge.from === node.nodeId && edge.parallel === true).length > 2) return false;
  }
  const chain = raw as unknown as NarrativeChain;
  if (reachableNodes(chain).size !== nodeIds.length) return false;
  if (deadEndNodeIds(chain).length > 0) return false;
  const cyclic = new Set(cycleEdgeIds(chain));
  if (chain.edges.some((edge) => cyclic.has(edge.edgeId) && edge.repeatable !== true)) return false;
  // Ein Knotenwechsel darf nur so viele Teilnehmer behalten, wie das Ziel-Template traegt.
  return chain.edges.every((edge) => templatesCompatible(chain, edge));
}

/** Zusaetzlich zur Struktur: jede Kette muss einen aufloesbaren Status besitzen. */
export function isChainStatus(raw: unknown): raw is ChainRunStatus {
  return typeof raw === 'string' && (CHAIN_RUN_STATUSES as readonly string[]).includes(raw);
}
