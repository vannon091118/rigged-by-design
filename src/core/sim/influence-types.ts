/**
 * Typen und stabile IDs der Influence-Matrix. Die Validierung liegt in
 * `influence-schema.ts`, die Gewichte in `influence-matrix.ts`.
 */
import type { EventPoolConfig } from './influence-event-pool';

export const FACTOR_IDS = [
  'mood', 'sociability', 'thirst', 'rumor', 'trust', 'sympathy', 'conflict', 'satisfaction',
] as const;

export type InfluenceFactorId = (typeof FACTOR_IDS)[number];

export interface InfluenceValues {
  readonly mood: number;
  readonly sociability: number;
  readonly thirst: number;
  readonly rumor: number;
  readonly trust: number;
  readonly sympathy: number;
  readonly conflict: number;
  /** Erinnerungs-/Zufriedenheitswert aus einer konkreten Zuwendung; Default 0. */
  readonly satisfaction?: number;
}

interface FactorRange {
  readonly min: number;
  readonly max: number;
}

interface FactorChildDefinition {
  readonly id: string;
  readonly category: string;
  readonly baseWeight: number;
  readonly source: InfluenceFactorId;
  readonly weight: number;
}

interface FactorDefinition {
  readonly id: InfluenceFactorId;
  readonly category: string;
  readonly baseWeight: number;
  readonly range: FactorRange;
  readonly children: readonly FactorChildDefinition[];
}

interface InfluenceContext {
  readonly label: string;
  readonly weights: Readonly<Record<InfluenceFactorId, number>>;
  readonly threshold: number;
}

interface CrossEdge {
  readonly from: InfluenceFactorId;
  readonly to: InfluenceFactorId;
  readonly weight: number;
  /** Optional: Kante gilt nur in diesen Kontexten. */
  readonly contexts?: readonly string[];
}

export interface InfluenceConfig {
  readonly version: 1;
  /** Kontext fuer Moebel ohne eigene Zuordnung; muss existieren. */
  readonly defaultContext: string;
  readonly factors: Readonly<Record<InfluenceFactorId, FactorDefinition>>;
  readonly contexts: Readonly<Record<string, InfluenceContext>>;
  /** Möbelart -> Matrix-Kontext; der Consumer liest nur diese Abbildung. */
  readonly furnitureContexts: Readonly<Record<string, string>>;
  readonly cross: readonly CrossEdge[];
  readonly eventPool: EventPoolConfig;
}
