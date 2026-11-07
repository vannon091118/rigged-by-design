/**
 * Visitor Presence — Phase 2.1
 * Trennt Visitor-Retention (dauerhaft gespeicherte Besucher) von der aktiven
 * Gästepopulation. VISITOR_CAP = 40 ist eine Hot-Set-Grenze, kein Kriterium für
 * die Vernichtung dauerhafter Identität.
 */

import type { ActorPresence, PresenceState, ActorRegistry } from "./actor-registry";
import { actorRegistry } from "./actor-registry";

export interface VisitorSnapshot {
  readonly actorId: string;
  readonly firstSeenTick: number;
  readonly lastSeenTick: number;
  readonly visitCount: number;
  readonly totalTimeAsGuestTicks: number;
  readonly isReturningVisitor: boolean;
}

export interface VisitorRetentionConfig {
  readonly visitorCap: number;       // Hot-Set Limit für aktive Gäste
  readonly retentionTicks: number;   // Wie lange ein Visitor als "bekannt" gilt
}

export const DEFAULT_VISITOR_RETENTION_CONFIG: VisitorRetentionConfig = {
  visitorCap: 40,
  retentionTicks: 10000, // ca. 166 Tage bei 600 Ticks/Tag
};

export class VisitorRetention {
  private registry: ActorRegistry;
  private visitorData = new Map<string, {
    firstSeenTick: number;
    lastSeenTick: number;
    visitCount: number;
    totalTimeAsGuestTicks: number;
  }>;
  private readonly config: VisitorRetentionConfig;

  constructor(registry: ActorRegistry, config: Partial<VisitorRetentionConfig> = {}) {
    this.registry = registry;
    this.config = { ...DEFAULT_VISITOR_RETENTION_CONFIG, ...config };
  }

  /**
   * Registriert einen Besuch. Erhöht die Besuchszahl und aktualisiert lastSeen.
   * Zerstört niemals die dauerhafte Identität — auch wenn das Hot-Set voll ist.
   */
  recordVisit(
    actorId: string,
    currentTick: number,
    isGuest: boolean
  ): { ok: boolean; snapshot?: VisitorSnapshot; error?: string } {
    const identity = this.registry.getIdentity(actorId);
    if (!identity) {
      return { ok: false, error: `Actor ${actorId} not registered` };
    }

    let data = this.visitorData.get(actorId);
    if (!data) {
      data = {
        firstSeenTick: currentTick,
        lastSeenTick: currentTick,
        visitCount: 1,
        totalTimeAsGuestTicks: isGuest ? 1 : 0,
      };
    } else {
      data = {
        ...data,
        lastSeenTick: currentTick,
        visitCount: data.visitCount + 1,
        totalTimeAsGuestTicks: data.totalTimeAsGuestTicks + (isGuest ? 1 : 0),
      };
    }
    this.visitorData.set(actorId, data);

    return { ok: true, snapshot: this.toSnapshot(actorId, data) };
  }

  /**
   * Gibt den Retention-Snapshot für einen Actor zurück.
   */
  getSnapshot(actorId: string): VisitorSnapshot | undefined {
    const data = this.visitorData.get(actorId);
    if (!data) return undefined;
    return this.toSnapshot(actorId, data);
  }

  /**
   * Prüft ob ein Visitor ein Rückkehrer ist (mehr als ein Besuch).
   */
  isReturningVisitor(actorId: string): boolean {
    const data = this.visitorData.get(actorId);
    return !!data && data.visitCount > 1;
  }

  /**
   * Zählt alle bekannten Besucher (unabhängig vom Hot-Set).
   * Dies ist die dauerhafte Retention — nicht durch VISITOR_CAP begrenzt.
   */
  countKnownVisitors(): number {
    return this.visitorData.size;
  }

  /**
   * Gibt alle bekannten Besucher zurück.
   */
  listKnownVisitors(): VisitorSnapshot[] {
    const snapshots: VisitorSnapshot[] = [];
    for (const [actorId, data] of this.visitorData.entries()) {
      snapshots.push(this.toSnapshot(actorId, data));
    }
    return snapshots;
  }

  private toSnapshot(actorId: string, data: {
    firstSeenTick: number;
    lastSeenTick: number;
    visitCount: number;
    totalTimeAsGuestTicks: number;
  }): VisitorSnapshot {
    return {
      actorId,
      firstSeenTick: data.firstSeenTick,
      lastSeenTick: data.lastSeenTick,
      visitCount: data.visitCount,
      totalTimeAsGuestTicks: data.totalTimeAsGuestTicks,
      isReturningVisitor: data.visitCount > 1,
    };
  }

  /**
   * Prüft ob das Hot-Set (aktive Gäste + Präsente) voll ist.
   * Dies betrifft nur die aktiven Präsenz-Daten, nicht die dauerhafte Retention.
   */
  isHotSetFull(): boolean {
    const activeCount = this.registry.countActivePresences();
    return activeCount >= this.config.visitorCap;
  }

  /**
   * Gibt verbleibende Hot-Set Plätze zurück.
   */
  availableHotSetSlots(): number {
    const activeCount = this.registry.countActivePresences();
    return Math.max(0, this.config.visitorCap - activeCount);
  }
}

let _visitorRetentionInstance: VisitorRetention | null = null;

export function getVisitorRetention(): VisitorRetention {
  if (!_visitorRetentionInstance) {
    _visitorRetentionInstance = new VisitorRetention(actorRegistry);
  }
  return _visitorRetentionInstance;
}