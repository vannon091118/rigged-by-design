/**
 * Relationship Engine — Phase 3.1
 * Beziehungen als eigenständiger Teil der Welt-Simulation, getrennt von der
 * Narrative-Grenze. Gerichtete Kanten als zwei unabhängige Perspektiven.
 * Änderungen ausschließlich über definierte Ereignisse/Kommandos.
 */

import type { WorldTime } from "./sim/worldtime";
import type { Disposition, Relationship, Factor } from "./relationship";
import { createRelationship, applyFactor as applySimpleFactor } from "./relationship";

/**
 * Die vier eigenständigen Beziehungs-Dimensionen mit klarer Eigentümerschaft.
 * Jede Dimension wird getrennt verwaltet, keine automatische Symmetrie.
 */
export type RelationshipDimension = "trust" | "sympathy" | "conflict" | "influence";

export interface RelationshipEdge {
  readonly fromActorId: string;    // ausgehende Perspektive
  readonly toActorId: string;      // eingehende Perspektive (Ziel)
  readonly dimension: RelationshipDimension;
  readonly score: number;          // -100 .. 100
  readonly lastUpdatedTick: number;
  readonly sourceEventId?: string; // auslösendes Event/Kommando (Nachvollziehbarkeit)
}

export interface RelationshipView {
  readonly actorId: string;
  readonly otherActorId: string;
  readonly trust: number;
  readonly sympathy: number;
  readonly conflict: number;
  readonly influence: number;
  readonly overallDisposition: Disposition;
  readonly lastUpdatedTick: number;
}

export interface RelationshipCommand {
  readonly commandId: string;
  readonly type: "adjust-trust" | "adjust-sympathy" | "adjust-conflict" | "adjust-influence" | "set-disposition";
  readonly fromActorId: string;
  readonly toActorId: string;
  readonly dimension: RelationshipDimension;
  readonly delta: number;           // positive oder negative Änderung
  readonly worldTime: WorldTime;
  readonly sourceEventId?: string;
  readonly reason: string;
}

export interface RelationshipEngineConfig {
  readonly maxScore: number;        // 100
  readonly minScore: number;        // -100
  readonly enableAutoSymmetry: boolean; // immer false — keine automatische Symmetrie
}

export const DEFAULT_RELATIONSHIP_ENGINE_CONFIG: RelationshipEngineConfig = {
  maxScore: 100,
  minScore: -100,
  enableAutoSymmetry: false,
};

/**
 * Relationship Engine — verwaltet gerichtete Kanten zwischen Akteuren.
 * Kein globaler Edge-Cap; das soziale Netz kann beliebig wachsen.
 * Indexe auf Actor-IDs für schnellen Zugriff.
 */
export class RelationshipEngine {
  private edges = new Map<string, RelationshipEdge[]>; // key: "${from}:${to}"
  private readonly config: RelationshipEngineConfig;
  private nextCommandId = 0;

  constructor(config: Partial<RelationshipEngineConfig> = {}) {
    this.config = { ...DEFAULT_RELATIONSHIP_ENGINE_CONFIG, ...config };
  }

  // ── Kommandos anwenden (einziger Weg zur Änderung) ────────────

  /**
   * Wendet ein RelationshipCommand an. Gibt die neue Edge zurück.
   * Dies ist der einzige autorisierte Weg, Beziehungen zu ändern.
   */
  applyCommand(cmd: RelationshipCommand): {
    ok: boolean;
    edge?: RelationshipEdge;
    error?: string;
  } {
    if (!this.config.enableAutoSymmetry && cmd.type === "set-disposition") {
      // set-disposition wird nicht direkt unterstützt, nur über Dimensionen
      return { ok: false, error: "set-disposition not supported; use adjust-*" };
    }

    const edgeKey = `${cmd.fromActorId}:${cmd.toActorId}`;
    const existingEdges = this.edges.get(edgeKey) || [];
    const existing = existingEdges.find((e) => e.dimension === cmd.dimension);

    const newScore = existing
      ? Math.max(this.config.minScore, Math.min(this.config.maxScore, existing.score + cmd.delta))
      : Math.max(this.config.minScore, Math.min(this.config.maxScore, cmd.delta));

    const edge: RelationshipEdge = {
      fromActorId: cmd.fromActorId,
      toActorId: cmd.toActorId,
      dimension: cmd.dimension,
      score: newScore,
      lastUpdatedTick: cmd.worldTime.tick,
      sourceEventId: cmd.sourceEventId,
    };

    const nextEdges = existing
      ? existingEdges.map((e) => (e.dimension === cmd.dimension ? edge : e))
      : [...existingEdges, edge];

    this.edges.set(edgeKey, nextEdges);
    this.nextCommandId++;

    return { ok: true, edge };
  }

  /**
   * Wendet mehrere Kommandos in einer Transaktion an (alle oder nichts).
   */
  applyCommands(cmds: RelationshipCommand[]): {
    ok: boolean;
    edges: RelationshipEdge[];
    errors: string[];
  } {
    const errors: string[] = [];
    const applied: RelationshipEdge[] = [];

    // Vorheriger Zustand für Rollback
    const snapshot = new Map(this.edges);

    for (const cmd of cmds) {
      const result = this.applyCommand(cmd);
      if (result.ok && result.edge) {
        applied.push(result.edge);
      } else {
        errors.push(result.error ?? `Command ${cmd.commandId} failed`);
      }
    }

    if (errors.length > 0) {
      this.edges = snapshot; // Rollback
      return { ok: false, edges: [], errors };
    }

    return { ok: true, edges: applied, errors: [] };
  }

  // ── Abfragen ──────────────────────────────────────────────────

  /**
   * Gibt die Edge für eine spezifische Dimension zwischen zwei Akteuren zurück.
   * Gerichtet: fromActorId -> toActorId ist eine andere Perspektive als toActorId -> fromActorId.
   */
  getEdge(fromActorId: string, toActorId: string, dimension: RelationshipDimension): RelationshipEdge | undefined {
    const edges = this.edges.get(`${fromActorId}:${toActorId}`);
    return edges?.find((e) => e.dimension === dimension);
  }

  /**
   * Gibt alle Edges für einen Actor zurück (als "from" oder "to").
   * Indexbasierter Zugriff über Actor-ID.
   */
  getEdgesForActor(actorId: string): RelationshipEdge[] {
    const result: RelationshipEdge[] = [];
    for (const [key, edges] of this.edges.entries()) {
      const [from, to] = key.split(":");
      if (from === actorId || to === actorId) {
        result.push(...edges);
      }
    }
    return result;
  }

  /**
   * Gibt alle Outgoing-Edges eines Actors zurück (Perspektive: actorId -> andere).
   */
  getOutgoingEdges(actorId: string): RelationshipEdge[] {
    const edges = this.edges.get(`${actorId}:*`);
    // Wildcard nicht direkt möglich, daher über alle keys filtern
    const result: RelationshipEdge[] = [];
    for (const [key, edgeList] of this.edges.entries()) {
      const [from] = key.split(":");
      if (from === actorId) {
        result.push(...edgeList);
      }
    }
    return result;
  }

  /**
   * Gibt alle Incoming-Edges eines Actors zurück (Perspektive: andere -> actorId).
   */
  getIncomingEdges(actorId: string): RelationshipEdge[] {
    const result: RelationshipEdge[] = [];
    for (const [key, edgeList] of this.edges.entries()) {
      const [, to] = key.split(":");
      if (to === actorId) {
        result.push(...edgeList);
      }
    }
    return result;
  }

  /**
   * Baut einen RelationshipView für ein Actor-Paar zusammen.
   * Kombiniert alle vier Dimensionen zu einer Gesamt-Disposition.
   */
  getRelationshipView(actorId: string, otherActorId: string): RelationshipView {
    const outgoing = this.getEdgesForActor(actorId);
    const incoming = this.getIncomingEdges(otherActorId);

    // Edges von actorId -> otherActorId
    const directEdges = outgoing.filter((e) => e.toActorId === otherActorId);

    const trustEdge = directEdges.find((e) => e.dimension === "trust");
    const sympathyEdge = directEdges.find((e) => e.dimension === "sympathy");
    const conflictEdge = directEdges.find((e) => e.dimension === "conflict");
    const influenceEdge = directEdges.find((e) => e.dimension === "influence");

    const trust = trustEdge?.score ?? 0;
    const sympathy = sympathyEdge?.score ?? 0;
    const conflict = conflictEdge?.score ?? 0;
    const influence = influenceEdge?.score ?? 0;

    // Gesamte Disposition aus allen Dimensionen ableiten
    const avgScore = (trust + sympathy - conflict + influence) / 4;
    const overallDisposition = scoreToDisposition(avgScore);

    const lastUpdated = Math.max(
      trustEdge?.lastUpdatedTick ?? 0,
      sympathyEdge?.lastUpdatedTick ?? 0,
      conflictEdge?.lastUpdatedTick ?? 0,
      influenceEdge?.lastUpdatedTick ?? 0
    );

    return {
      actorId,
      otherActorId,
      trust,
      sympathy,
      conflict,
      influence,
      overallDisposition,
      lastUpdatedTick: lastUpdated,
    };
  }

  /**
   * Gibt alle Beziehungen eines Actors als Views zurück.
   */
  getAllRelationshipsForActor(actorId: string): RelationshipView[] {
    const others = new Set<string>();
    for (const edge of this.getEdgesForActor(actorId)) {
      others.add(edge.fromActorId === actorId ? edge.toActorId : edge.fromActorId);
    }

    return Array.from(others).map((other) => this.getRelationshipView(actorId, other));
  }

  /**
   * Gibt die Anzahl der Edges zurück (kein globaler Cap).
   */
  getEdgeCount(): number {
    let count = 0;
    for (const edges of this.edges.values()) {
      count += edges.length;
    }
    return count;
  }

  /**
   * Prüft ob eine Edge existiert.
   */
  hasEdge(fromActorId: string, toActorId: string, dimension: RelationshipDimension): boolean {
    return this.getEdge(fromActorId, toActorId, dimension) !== undefined;
  }

  /**
   * Entfernt alle Edges für einen Actor (z. B. bei Archivierung).
   * Die Identität selbst bleibt im ActorRegistry bestehen.
   */
  removeActorEdges(actorId: string): number {
    let removed = 0;
    const toRemove: string[] = [];
    for (const [key, edges] of this.edges.entries()) {
      const [from, to] = key.split(":");
      if (from === actorId || to === actorId) {
        toRemove.push(key);
        removed += edges.length;
      }
    }
    for (const key of toRemove) {
      this.edges.delete(key);
    }
    return removed;
  }

  /**
   * Exportiert alle Edges für Migration/Save.
   */
  exportEdges(): RelationshipEdge[] {
    const all: RelationshipEdge[] = [];
    for (const edges of this.edges.values()) {
      all.push(...edges);
    }
    return all;
  }

  /**
   * Importiert Edges (z. B. aus Save-State).
   */
  importEdges(edges: RelationshipEdge[]): void {
    for (const edge of edges) {
      const key = `${edge.fromActorId}:${edge.toActorId}`;
      const existing = this.edges.get(key) || [];
      const idx = existing.findIndex((e) => e.dimension === edge.dimension);
      if (idx >= 0) {
        existing[idx] = edge;
      } else {
        existing.push(edge);
      }
      this.edges.set(key, existing);
    }
  }
}

/**
 * Wandelt einen numerischen Score in eine Disposition um.
 */
export function scoreToDisposition(score: number): Disposition {
  if (score >= 75) return "intimate";
  if (score >= 25) return "friendly";
  if (score <= -25) return "hostile";
  return "neutral";
}

/**
 * Erstellt ein RelationshipCommand.
 */
let _commandCounter = 0;

export function createRelationshipCommand(
  type: RelationshipCommand["type"],
  fromActorId: string,
  toActorId: string,
  dimension: RelationshipDimension,
  delta: number,
  worldTime: WorldTime,
  reason: string,
  sourceEventId?: string
): RelationshipCommand {
  _commandCounter++;
  return {
    commandId: `cmd-${worldTime.tick}-${_commandCounter}`,
    type,
    fromActorId,
    toActorId,
    dimension,
    delta,
    worldTime,
    sourceEventId,
    reason,
  };
}

export const relationshipEngine = new RelationshipEngine();