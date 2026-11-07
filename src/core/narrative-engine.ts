/**
 * Narrative Engine — Phase 4
 * Domänenneutrale Narrative-Engine mit validierten, erweiterbaren Narrative- und
 * Ereignis-Pools. TRIGGER_DIALOG bleibt executable: false (keine Dialog-UI).
 */

import type { WorldTime } from "./sim/worldtime";
import type { DomainEvent, EventType } from "./domain-event";
import { createDomainEvent } from "./domain-event";

/**
 * Narrative-Typ — eine erzählende Einheit mit Bedingung und Konsequenz.
 */
export interface Narrative {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly domain: string;              // zugehörige Domain (casino, social, work, ...)
  readonly version: string;
  readonly conditions: NarrativeCondition[]; // alle müssen erfüllt sein
  readonly consequences: NarrativeConsequence[]; // was passiert wenn Bedingungen erfüllt
  readonly weight: number;              // Auswahlgewicht (0..10000 bps)
  readonly cooldownTicks: number;       // Mindestabstand zwischen Ausführungen
  readonly lastExecutedTick?: number;
  readonly maxExecutions?: number;      // maximale Anzahl Ausführungen (undefined = unbegrenzt)
  readonly executionCount: number;
  readonly tags: string[];
}

/**
 * Bedingung für eine Narrative.
 */
export interface NarrativeCondition {
  readonly type: "actor-state" | "relationship" | "world-time" | "flag" | "custom";
  readonly targetActorId?: string;
  readonly targetValue?: unknown;
  readonly operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains";
  readonly description: string;
}

/**
 * Konsequenz einer Narrative.
 */
export interface NarrativeConsequence {
  readonly type: "relationship-change" | "flag-set" | "event-emit" | "custom";
  readonly targetActorId?: string;
  readonly dimension?: string;
  readonly delta?: number;
  readonly flagName?: string;
  readonly flagValue?: unknown;
  readonly eventType?: EventType;
  readonly eventPayload?: Record<string, unknown>;
  readonly description: string;
}

/**
 * Narrative-Pool — Sammlung von Narratives für eine Domain.
 */
export interface NarrativePool {
  readonly domain: string;
  readonly narratives: Map<string, Narrative>;
  readonly version: string;
}

/**
 * Ereignis-Pool — Sammlung von Ereignissen, die Narratives auslösen können.
 */
export interface EventPool {
  readonly domain: string;
  readonly eventTypes: Map<string, EventType>;
  readonly version: string;
}

/**
 * Auswahlkontext für Narrative-Auswahl.
 */
export interface NarrativeSelectionContext {
  readonly actorId: string;
  readonly worldTime: WorldTime;
  readonly availableNarratives: string[]; // IDs der candidate Narratives
  readonly excludeTags?: string[];
}

/**
 * Ergebnis einer Narrative-Auswahl.
 */
export interface NarrativeSelection {
  readonly narrative: Narrative;
  readonly score: number;               // Auswahl-Score (höher = wahrscheinlicher)
  readonly reason: string;
}

/**
 * Narrative Engine — verwaltet Narrative-Pools, Auswahl und Ausführung.
 * Domänenneutral: kennt keine Casino-spezifische Logik.
 */
export class NarrativeEngine {
  private pools = new Map<string, NarrativePool>();
  private eventPools = new Map<string, EventPool>();
  private executionHistory = new Map<string, number[]>; // narrativeId -> ticks

  // ── Pool-Management ──────────────────────────────────────────

  /**
   * Registriert einen Narrative-Pool für eine Domain.
   */
  registerPool(pool: NarrativePool): { ok: boolean; error?: string } {
    if (this.pools.has(pool.domain)) {
      return { ok: false, error: `Pool for domain ${pool.domain} already registered` };
    }
    this.pools.set(pool.domain, pool);
    return { ok: true };
  }

  /**
   * Registriert einen Event-Pool für eine Domain.
   */
  registerEventPool(pool: EventPool): { ok: boolean; error?: string } {
    if (this.eventPools.has(pool.domain)) {
      return { ok: false, error: `EventPool for domain ${pool.domain} already registered` };
    }
    this.eventPools.set(pool.domain, pool);
    return { ok: true };
  }

  /**
   * Fügt ein Narrative zu einem bestehenden Pool hinzu.
   */
  addNarrative(domain: string, narrative: Narrative): { ok: boolean; error?: string } {
    const pool = this.pools.get(domain);
    if (!pool) {
      return { ok: false, error: `No pool for domain ${domain}` };
    }
    if (pool.narratives.has(narrative.id)) {
      return { ok: false, error: `Narrative ${narrative.id} already exists in domain ${domain}` };
    }
    pool.narratives.set(narrative.id, narrative);
    return { ok: true };
  }

  /**
   * Entfernt ein Narrative aus einem Pool.
   */
  removeNarrative(domain: string, narrativeId: string): { ok: boolean; error?: string } {
    const pool = this.pools.get(domain);
    if (!pool) {
      return { ok: false, error: `No pool for domain ${domain}` };
    }
    if (!pool.narratives.delete(narrativeId)) {
      return { ok: false, error: `Narrative ${narrativeId} not found in domain ${domain}` };
    }
    return { ok: true };
  }

  // ── Narrative-Auswahl ────────────────────────────────────────

  /**
   * Wählt ein Narrative aus dem Pool basierend auf Kontext und Gewicht.
   * Deterministisch: gleicher Kontext → gleiche Auswahl.
   */
  selectNarrative(ctx: NarrativeSelectionContext): NarrativeSelection | null {
    const allNarratives: Narrative[] = [];
    for (const pool of this.pools.values()) {
      for (const n of pool.narratives.values()) {
        allNarratives.push(n);
      }
    }

    // Nach Domain filtern (wenn im Kontext angegeben)
    const candidates = allNarratives.filter((n) => {
      // Tags ausschließen
      if (ctx.excludeTags && ctx.excludeTags.some((t) => n.tags.includes(t))) {
        return false;
      }
      // Cooldown prüfen
      if (n.lastExecutedTick !== undefined) {
        const ticksSince = ctx.worldTime.tick - n.lastExecutedTick;
        if (ticksSince < n.cooldownTicks) {
          return false;
        }
      }
      // Max Executions prüfen
      if (n.maxExecutions !== undefined && n.executionCount >= n.maxExecutions) {
        return false;
      }
      return true;
    });

    if (candidates.length === 0) {
      return null;
    }

    // Gewichtete Auswahl (deterministisch: nach ID sortiert, dann kumulativ)
    const sorted = [...candidates].sort((a, b) => a.id.localeCompare(b.id));
    let totalWeight = 0;
    for (const n of sorted) {
      totalWeight += n.weight;
    }

    if (totalWeight <= 0) {
      // Alle haben Gewicht 0 → erste im Sortieren
      return {
        narrative: sorted[0],
        score: 0,
        reason: "Alle Gewichte 0 — erste im Sortieren",
      };
    }

    // Deterministische Auswahl basierend auf actorId + worldTime.tick als Seed
    const seed = hashString(`${ctx.actorId}:${ctx.worldTime.tick}`);
    const r = (seed % totalWeight) + 1; // 1..totalWeight

    let accumulator = 0;
    for (const n of sorted) {
      accumulator += n.weight;
      if (r <= accumulator) {
        return {
          narrative: n,
          score: n.weight / totalWeight,
          reason: `Gewichtete Auswahl (${n.weight}/${totalWeight})`,
        };
      }
    }

    return {
      narrative: sorted[sorted.length - 1],
      score: 0,
      reason: "Fallback: letztes Element",
    };
  }

  // ── Ausführung ──────────────────────────────────────────────

  /**
   * Führt ein Narrative aus und wendet Konsequenzen an.
   * Gibt Domain-Events zurück, die weiterverarbeitet werden können.
   */
  executeNarrative(
    narrativeId: string,
    domain: string,
    ctx: NarrativeSelectionContext
  ): { ok: boolean; events: DomainEvent<EventType>[]; error?: string } {
    const pool = this.pools.get(domain);
    if (!pool) {
      return { ok: false, events: [], error: `No pool for domain ${domain}` };
    }

    const narrative = pool.narratives.get(narrativeId);
    if (!narrative) {
      return { ok: false, events: [], error: `Narrative ${narrativeId} not found` };
    }

    // Cooldown prüfen
    if (narrative.lastExecutedTick !== undefined) {
      const ticksSince = ctx.worldTime.tick - narrative.lastExecutedTick;
      if (ticksSince < narrative.cooldownTicks) {
        return { ok: false, events: [], error: `Narrative im Cooldown (${ticksSince}/${narrative.cooldownTicks} Ticks)` };
      }
    }

    // Max Executions prüfen
    if (narrative.maxExecutions !== undefined && narrative.executionCount >= narrative.maxExecutions) {
      return { ok: false, events: [], error: `Narrative max. Ausführungen erreicht` };
    }

    // Konsequenzen anwenden → Events erzeugen
    const events: DomainEvent<EventType>[] = [];
    const now = ctx.worldTime.tick;

    for (const consequence of narrative.consequences) {
      if (consequence.type === "event-emit" && consequence.eventType) {
        events.push(
          createDomainEvent(
            `evt-${narrative.id}-${now}-${events.length}`,
            consequence.eventType,
            ctx.actorId,
            consequence.eventPayload ?? {},
            now,
            100
          )
        );
      }
      // relationship-change, flag-set etc. würden hier über entsprechende Engines verarbeitet
    }

    // Narrative-Status aktualisieren
    const executed: Narrative = {
      ...narrative,
      lastExecutedTick: now,
      executionCount: narrative.executionCount + 1,
    };
    pool.narratives.set(narrative.id, executed);

    // Execution History speichern
    const history = this.executionHistory.get(narrativeId) ?? [];
    history.push(now);
    this.executionHistory.set(narrativeId, history);

    return { ok: true, events };
  }

  /**
   * Gibt alle Narratives einer Domain zurück.
   */
  listNarratives(domain: string): Narrative[] {
    const pool = this.pools.get(domain);
    return pool ? Array.from(pool.narratives.values()) : [];
  }

  /**
   * Gibt ein Narrative zurück.
   */
  getNarrative(domain: string, narrativeId: string): Narrative | undefined {
    const pool = this.pools.get(domain);
    return pool?.narratives.get(narrativeId);
  }

  /**
   * Gibt die Ausführungshistorie eines Narratives zurück.
   */
  getExecutionHistory(narrativeId: string): number[] {
    return this.executionHistory.get(narrativeId) ?? [];
  }
}

/**
 * Einfache Hash-Funktion für deterministische Auswahl.
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // zu 32-bit Integer
  }
  return Math.abs(hash);
}

export const narrativeEngine = new NarrativeEngine();