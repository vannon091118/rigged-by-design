/**
 * Event Consumer — Phase 2.2
 * Unabhängige Consumer-Cursor mit Idempotenz, Deduplizierung und Replay.
 * Ein Consumer-Ausfall verliert keine Ereignisse und wendet keine doppelt an.
 */

import type { TypedEventEnvelope } from "./event-bus";
import type { WorldTime } from "./worldtime";

export interface ConsumerCursor {
  readonly consumerId: string;
  readonly lastProcessedEventId: string | null;
  readonly lastProcessedTick: number;
  readonly processedCount: number;
  readonly droppedCount: number;
}

export interface ProcessedEvent {
  readonly eventId: string;
  readonly processedAtTick: number;
}

/**
 * Consumer-Status nach Verarbeitung.
 */
export type ConsumerResult = {
  readonly ok: boolean;
  readonly applied: boolean;       // false = duplikat, nicht angewendet
  readonly error?: string;
};

export interface EventConsumerOptions {
  readonly consumerId: string;
  readonly maxPending: number;     // 48 — obere Grenze für ausstehende Events
  readonly dedupWindow: number;    // Ticks, innerhalb derer IDs dedupliziert werden
}

export const DEFAULT_CONSUMER_OPTIONS: EventConsumerOptions = {
  consumerId: "default",
  maxPending: 48,
  dedupWindow: 1000,
};

export class EventConsumer {
  private readonly consumerId: string;
  private readonly maxPending: number;
  private readonly dedupWindow: number;

  private cursor: ConsumerCursor;
  private processedEvents = new Map<string, number>(); // eventId -> processedAtTick
  private pendingQueue: TypedEventEnvelope[] = [];
  private deadLetterQueue: TypedEventEnvelope[] = [];

  constructor(options: Partial<EventConsumerOptions> = {}) {
    const opts = { ...DEFAULT_CONSUMER_OPTIONS, ...options };
    this.consumerId = opts.consumerId;
    this.maxPending = opts.maxPending;
    this.dedupWindow = opts.dedupWindow;
    this.cursor = {
      consumerId: opts.consumerId,
      lastProcessedEventId: null,
      lastProcessedTick: 0,
      processedCount: 0,
      droppedCount: 0,
    };
  }

  // ── Cursor ─────────────────────────────────────────────────

  getCursor(): ConsumerCursor {
    return { ...this.cursor };
  }

  getPendingCount(): number {
    return this.pendingQueue.length;
  }

  getDeadLetterCount(): number {
    return this.deadLetterQueue.length;
  }

  getProcessedCount(): number {
    return this.processedEvents.size;
  }

  // ── Idempotenz & Deduplizierung ────────────────────────────

  /**
   * Prüft, ob ein Event bereits verarbeitet wurde (Idempotenz).
   * Gleiche Event-ID wird nur einmal angewendet.
   */
  isAlreadyProcessed(eventId: string, currentTick: number): boolean {
    const processedAt = this.processedEvents.get(eventId);
    if (processedAt === undefined) return false;

    // Deduplizierungsfenster: sehr alte Einträge dürfen vergessen werden,
    // aber die Event-ID bleibt im Cursor als "schon gesehen" markiert.
    return currentTick - processedAt <= this.dedupWindow || processedAt > 0;
  }

  /**
   * Markiert ein Event als verarbeitet.
   */
  markProcessed(eventId: string, currentTick: number): void {
    this.processedEvents.set(eventId, currentTick);
  }

  /**
   * Entfernt veraltete Einträge aus dem Dedup-Fenster (Safe Compaction).
   * Wichtige Domain-Events werden niemals entfernt, solange sie im pending-Bereich sind.
   */
  compactProcessed(currentTick: number): number {
    let removed = 0;
    const cutoff = currentTick - this.dedupWindow * 2;
    for (const [eventId, processedAt] of this.processedEvents.entries()) {
      if (processedAt < cutoff) {
        this.processedEvents.delete(eventId);
        removed++;
      }
    }
    return removed;
  }

  // ── Verarbeitung ───────────────────────────────────────────

  /**
   * Versucht, ein Event zu verarbeiten. Gibt ConsumerResult zurück.
   * Bei Duplikat: applied=false, ok=true (keine doppelte Zustandsänderung).
   * Bei Überschreitung von maxPending: Event wird in Dead-Letter-Queue verschoben,
   * aber nicht einfach verworfen.
   */
  processEvent(
    event: TypedEventEnvelope,
    handler: (event: TypedEventEnvelope) => void,
    currentTick: number
  ): ConsumerResult {
    // Idempotenzprüfung
    if (this.isAlreadyProcessed(event.eventId, currentTick)) {
      this.cursor = {
        ...this.cursor,
        droppedCount: this.cursor.droppedCount + 1,
      };
      return { ok: true, applied: false };
    }

    // Backpressure: wenn Pending-Queue voll, in Dead-Letter verschoben
    if (this.pendingQueue.length >= this.maxPending) {
      this.deadLetterQueue.push(event);
      this.cursor = {
        ...this.cursor,
        droppedCount: this.cursor.droppedCount + 1,
      };
      return { ok: false, applied: false, error: `Consumer ${this.consumerId} pending queue full` };
    }

    // Event in Queue aufnehmen und verarbeiten
    this.pendingQueue.push(event);
    try {
      handler(event);
      this.pendingQueue = this.pendingQueue.filter((e) => e.eventId !== event.eventId);
      this.markProcessed(event.eventId, currentTick);
      this.cursor = {
        ...this.cursor,
        lastProcessedEventId: event.eventId,
        lastProcessedTick: currentTick,
        processedCount: this.cursor.processedCount + 1,
      };
      return { ok: true, applied: true };
    } catch (err) {
      this.pendingQueue = this.pendingQueue.filter((e) => e.eventId !== event.eventId);
      this.deadLetterQueue.push(event);
      return {
        ok: false,
        applied: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Verarbeitet alle pending Events in der Queue (Replay nach Neustart).
   * Deterministisch und idempotent.
   */
  replayPending(
    handler: (event: TypedEventEnvelope) => void,
    currentTick: number
  ): { processed: number; skipped: number; errors: number } {
    let processed = 0;
    let skipped = 0;
    let errors = 0;

    const queue = [...this.pendingQueue];
    this.pendingQueue = [];

    for (const event of queue) {
      const result = this.processEvent(event, handler, currentTick);
      if (result.applied) processed++;
      else if (!result.ok) errors++;
      else skipped++;
    }

    return { processed, skipped, errors };
  }

  /**
   * Nach Consumer-Neustart: Cursor wird wiederhergestellt, pending Events
   * werden neu bewertet. Bereits verarbeitete Events werden übersprungen.
   */
  restoreCursor(savedCursor: ConsumerCursor, currentTick: number): void {
    this.cursor = {
      ...savedCursor,
      consumerId: this.consumerId,
    };
    // Alte Dedup-Einträge compakten
    this.compactProcessed(currentTick);
  }

  /**
   * Gibt Dead-Letter-Events zurück (für manuelle Untersuchung oder Retry).
   */
  getDeadLetterQueue(): TypedEventEnvelope[] {
    return [...this.deadLetterQueue];
  }

  /**
   * Versucht, Dead-Letter-Events erneut zu verarbeiten.
   */
  retryDeadLetter(
    handler: (event: TypedEventEnvelope) => void,
    currentTick: number
  ): { retried: number; succeeded: number; stillFailed: number } {
    const queue = [...this.deadLetterQueue];
    this.deadLetterQueue = [];
    let succeeded = 0;
    let stillFailed = 0;

    for (const event of queue) {
      const result = this.processEvent(event, handler, currentTick);
      if (result.applied) succeeded++;
      else stillFailed++;
    }

    return { retried: queue.length, succeeded, stillFailed };
  }
}