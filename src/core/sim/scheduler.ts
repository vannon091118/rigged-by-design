/**
 * Scheduler — Phase 2.2
 * Scheduler-Backlog mit Verarbeitungsbudgets:
 *   MAX_CANDIDATES = 64  — maximale Kandidaten pro Tick
 *   MAX_NEW_EVENTS = 3   — maximale neue Events pro Tick
 *
 * Nicht angenommene gültige Kandidaten werden persistiert, erneut bewertet
 * oder nach fachlich expliziter Regel verdichtet.
 * Backpressure, Priorisierung und sichere Verdichtung für Ereignisspitzen.
 */

import type { TypedEventEnvelope } from "./event-bus";
import type { WorldTime } from "./worldtime";

export const MAX_CANDIDATES = 64;
export const MAX_NEW_EVENTS = 3;

export type Priority = "critical" | "high" | "normal" | "low";

export interface ScheduledEvent extends TypedEventEnvelope {
  readonly priority: Priority;
  readonly scheduledAtTick: number;
  readonly retryCount: number;
  readonly maxRetries: number;
}

export interface SchedulerStats {
  readonly candidates: number;
  readonly accepted: number;
  readonly deferred: number;
  readonly dropped: number;
  readonly compacted: number;
}

export interface SchedulerOptions {
  readonly maxCandidates: number;
  readonly maxNewEventsPerTick: number;
  readonly enableCompaction: boolean;
}

export const DEFAULT_SCHEDULER_OPTIONS: SchedulerOptions = {
  maxCandidates: MAX_CANDIDATES,
  maxNewEventsPerTick: MAX_NEW_EVENTS,
  enableCompaction: true,
};

export class Scheduler {
  private readonly maxCandidates: number;
  private readonly maxNewEventsPerTick: number;
  private readonly enableCompaction: boolean;

  private backlog: ScheduledEvent[] = [];
  private acceptedEvents: ScheduledEvent[] = [];
  private droppedEvents: ScheduledEvent[] = [];
  private compactedCount = 0;

  private stats: SchedulerStats = {
    candidates: 0,
    accepted: 0,
    deferred: 0,
    dropped: 0,
    compacted: 0,
  };

  constructor(options: Partial<SchedulerOptions> = {}) {
    const opts = { ...DEFAULT_SCHEDULER_OPTIONS, ...options };
    this.maxCandidates = opts.maxCandidates;
    this.maxNewEventsPerTick = opts.maxNewEventsPerTick;
    this.enableCompaction = opts.enableCompaction;
  }

  // ── Einreichung ────────────────────────────────────────────

  /**
   * Reicht ein Event im Scheduler ein. Gibt zurück ob es angenommen wurde.
   * Bei Überschreitung von MAX_CANDIDATES wird nach Priorität verdrängt.
   */
  submit(event: TypedEventEnvelope, priority: Priority = "normal"): {
    ok: boolean;
    scheduled?: ScheduledEvent;
    reason?: string;
  } {
    this.stats.candidates++;

    // Backlog-Grenze prüfen
    if (this.backlog.length >= this.maxCandidates) {
      // Versuche, das niedrigste Prioritäts-Event zu verdrängen
      const lowestIdx = this.backlog.findIndex((e) => e.priority === "low");
      if (lowestIdx >= 0 && priority !== "low") {
        const evicted = this.backlog.splice(lowestIdx, 1)[0];
        this.droppedEvents.push(evicted);
        this.stats.dropped++;
      } else if (priority === "critical") {
        // Critical Events verdrängen immer
        const evicted = this.backlog.shift();
        if (evicted) {
          this.droppedEvents.push(evicted);
          this.stats.dropped++;
        }
      } else {
        this.stats.deferred++;
        return { ok: false, reason: `Backlog full (${this.maxCandidates} candidates)` };
      }
    }

    const scheduled: ScheduledEvent = {
      ...event,
      priority,
      scheduledAtTick: 0, // wird beim nächsten Tick gesetzt
      retryCount: 0,
      maxRetries: 3,
    };

    this.backlog.push(scheduled);
    return { ok: true, scheduled };
  }

  // ── Tick-Verarbeitung ──────────────────────────────────────

  /**
   * Verarbeitet einen Tick: nimmt bis zu maxNewEventsPerTick neue Events
   * aus dem Backlog, priorisiert nach Priority und scheduledAtTick.
   * Nicht angenommene gültige Kandidaten bleiben im Backlog.
   */
  processTick(currentTick: number): {
    accepted: ScheduledEvent[];
    deferred: ScheduledEvent[];
    stats: SchedulerStats;
  } {
    // Nach Priorität sortieren (critical > high > normal > low)
    const priorityOrder: Record<Priority, number> = {
      critical: 0,
      high: 1,
      normal: 2,
      low: 3,
    };

    const sorted = [...this.backlog].sort((a, b) => {
      const pa = priorityOrder[a.priority];
      const pb = priorityOrder[b.priority];
      if (pa !== pb) return pa - pb;
      return a.scheduledAtTick - b.scheduledAtTick;
    });

    const accepted: ScheduledEvent[] = [];
    const deferred: ScheduledEvent[] = [];

    let acceptedThisTick = 0;

    for (const event of sorted) {
      if (acceptedThisTick >= this.maxNewEventsPerTick) {
        deferred.push(event);
        continue;
      }

      event.scheduledAtTick = currentTick;
      accepted.push(event);
      acceptedThisTick++;
    }

    // Verbleibende Events bleiben im Backlog (deferred)
    this.backlog = deferred;
    this.acceptedEvents.push(...accepted);
    this.stats.accepted += accepted.length;
    this.stats.deferred += deferred.length;

    // Safe Compaction: alte, nicht-angenommene Events werden nicht einfach verworfen
    if (this.enableCompaction && this.backlog.length > this.maxCandidates) {
      this.compactBacklog(currentTick);
    }

    return { accepted, deferred, stats: { ...this.stats } };
  }

  /**
   * Sichere Verdichtung: entfernt nur Events, die mehrfach gescheitert sind
   * oder deren maxRetries überschritten ist. Wichtige Domain-Events bleiben.
   */
  compactBacklog(currentTick: number): number {
    let removed = 0;
    const remaining: ScheduledEvent[] = [];

    for (const event of this.backlog) {
      if (event.retryCount >= event.maxRetries) {
        this.droppedEvents.push(event);
        this.stats.dropped++;
        removed++;
      } else {
        remaining.push(event);
      }
    }

    this.backlog = remaining;
    this.compactedCount += removed;
    this.stats.compacted = this.compactedCount;
    return removed;
  }

  /**
   * Erhöht den Retry-Counter für ein Event im Backlog.
   */
  retryEvent(eventId: string): boolean {
    const event = this.backlog.find((e) => e.eventId === eventId);
    if (event) {
      // eslint-disable-next-line no-param-reassign
      event.retryCount++;
      return true;
    }
    return false;
  }

  getStats(): SchedulerStats {
    return { ...this.stats };
  }

  getBacklogSize(): number {
    return this.backlog.length;
  }

  getBacklog(): ScheduledEvent[] {
    return [...this.backlog];
  }

  getAcceptedCount(): number {
    return this.acceptedEvents.length;
  }

  getDroppedCount(): number {
    return this.droppedEvents.length;
  }

  /**
   * Gibt alle Events zurück, die wegen Backlog-Limit verdrängt wurden.
   * Diese dürfen nicht einfach verworfen werden — sie benötigen fachliche Behandlung.
   */
  getDroppedEvents(): ScheduledEvent[] {
    return [...this.droppedEvents];
  }

  /**
   * Prüft ob Backpressure vorliegt (Backlog nahe am Limit).
   */
  isBackpressure(): boolean {
    return this.backlog.length >= this.maxCandidates * 0.8;
  }
}

export const scheduler = new Scheduler();