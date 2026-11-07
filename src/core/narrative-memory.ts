/**
 * Narrative Memory — Phase 4
 * Memory mit Relevanz, Vergessen und langfristiger Kontinuität.
 * Kurzzeit- und Langzeit-Archiv mit Verdichtung (Compaction).
 */

import type { WorldTime } from "./sim/worldtime";
import type { DomainEvent, EventType } from "./domain-event";

/**
 * Ein Memory-Eintrag — eine erinnerte Begebenheit oder Beobachtung.
 */
export interface MemoryEntry {
  readonly id: string;
  readonly actorId: string;           // wer erinnert sich
  readonly type: "event" | "fact" | "rumor" | "observation" | "decision";
  readonly content: string;           // menschenlesbarer Inhalt
  readonly relevance: number;         // 0.0 .. 1.0 (Relevanz für den Akteur)
  readonly createdAtTick: number;     // wann wurde es geschaffen
  readonly lastAccessedTick: number;  // wann wurde es zuletzt gelesen
  readonly accessCount: number;       // wie oft wurde es zugegriffen
  readonly decayRate: number;         // 0.0 .. 1.0 (wie schnell wird es vergessen)
  readonly sourceEventId?: string;    // auslösendes Event
  readonly tags: string[];
  readonly archived: boolean;         // in Langzeit-Archiv verschoben
}

/**
 * Memory-Konfiguration.
 */
export interface MemoryConfig {
  readonly shortTermCapacity: number;    // maximale Einträge im Kurzzeit-Speicher
  readonly longTermCapacity: number;     // maximale Einträge im Langzeit-Speicher
  readonly defaultDecayRate: number;     // Standard-Vergessensrate
  readonly compactionThreshold: number;  // ab wie vielen Einträgen verdichten
  readonly relevanceThreshold: number;   // unter dieser Relevanz wird vergessen
}

/**
 * Standardkonfiguration.
 */
export const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  shortTermCapacity: 200,
  longTermCapacity: 10000,
  defaultDecayRate: 0.01, // 1% pro Tick
  compactionThreshold: 150, // ab 150 Kurzzeit-Einträgen verdichten
  relevanceThreshold: 0.1,  // unter 0.1 Relevanz = vergessen
};

/**
 * Vergessens-Funktion: berechnet verbleibende Relevanz nach Ticks.
 */
export function decayRelevance(
  initialRelevance: number,
  decayRate: number,
  ticksPassed: number
): number {
  // Exponentialer Verfall: relevance * (1 - decayRate)^ticks
  return initialRelevance * Math.pow(1 - decayRate, ticksPassed);
}

/**
 * Narrative Memory — verwaltet Kurzzeit- und Langzeit-Speicher mit Verdichtung.
 */
export class NarrativeMemory {
  private shortTerm = new Map<string, MemoryEntry>();
  private longTerm = new Map<string, MemoryEntry>();
  private readonly config: MemoryConfig;
  private nextEntryId = 0;

  constructor(config: Partial<MemoryConfig> = {}) {
    this.config = { ...DEFAULT_MEMORY_CONFIG, ...config };
  }

  // ── Schreiben ────────────────────────────────────────────────

  /**
   * Erstellt einen neuen Memory-Eintrag im Kurzzeit-Speicher.
   */
  createEntry(
    actorId: string,
    type: MemoryEntry["type"],
    content: string,
    relevance: number,
    createdAtTick: number,
    sourceEventId?: string,
    tags: string[] = []
  ): MemoryEntry {
    const entry: MemoryEntry = {
      id: `mem-${this.nextEntryId++}`,
      actorId,
      type,
      content,
      relevance: Math.max(0, Math.min(1, relevance)),
      createdAtTick,
      lastAccessedTick: createdAtTick,
      accessCount: 0,
      decayRate: this.config.defaultDecayRate,
      sourceEventId,
      tags,
      archived: false,
    };

    this.shortTerm.set(entry.id, entry);

    // Auto-Compaction wenn Kurzzeit-Speicher voll
    if (this.shortTerm.size >= this.config.compactionThreshold) {
      this.compact(createdAtTick);
    }

    return entry;
  }

  /**
   * Greift auf einen Memory-Eintrag zu (erhöht accessCount, aktualisiert lastAccessed).
   */
  accessEntry(entryId: string, currentTick: number): MemoryEntry | null {
    const entry = this.shortTerm.get(entryId) ?? this.longTerm.get(entryId);
    if (!entry) return null;

    const updated: MemoryEntry = {
      ...entry,
      lastAccessedTick: currentTick,
      accessCount: entry.accessCount + 1,
    };

    if (entry.archived) {
      this.longTerm.set(entryId, updated);
    } else {
      this.shortTerm.set(entryId, updated);
    }

    return updated;
  }

  /**
   * Aktualisiert die Relevanz eines Eintrags.
   */
  updateRelevance(entryId: string, newRelevance: number, currentTick: number): boolean {
    const entry = this.shortTerm.get(entryId) ?? this.longTerm.get(entryId);
    if (!entry) return false;

    const updated: MemoryEntry = {
      ...entry,
      relevance: Math.max(0, Math.min(1, newRelevance)),
      lastAccessedTick: currentTick,
    };

    if (entry.archived) {
      this.longTerm.set(entryId, updated);
    } else {
      this.shortTerm.set(entryId, updated);
    }

    return true;
  }

  // ── Lesen ────────────────────────────────────────────────────

  /**
   * Gibt einen Memory-Eintrag zurück.
   */
  getEntry(entryId: string): MemoryEntry | null {
    return this.shortTerm.get(entryId) ?? this.longTerm.get(entryId) ?? null;
  }

  /**
   * Gibt alle Memory-Einträge eines Akteurs zurück (Kurzzeit + Langzeit).
   */
  getEntriesForActor(actorId: string): MemoryEntry[] {
    const result: MemoryEntry[] = [];
    for (const entry of this.shortTerm.values()) {
      if (entry.actorId === actorId) result.push(entry);
    }
    for (const entry of this.longTerm.values()) {
      if (entry.actorId === actorId) result.push(entry);
    }
    return result.sort((a, b) => b.lastAccessedTick - a.lastAccessedTick);
  }

  /**
   * Gibt relevante Memory-Einträge eines Akteurs zurück (Relevanz > Threshold).
   */
  getRelevantEntries(actorId: string, currentTick: number): MemoryEntry[] {
    const all = this.getEntriesForActor(actorId);
    return all.filter((entry) => {
      const ticksPassed = currentTick - entry.lastAccessedTick;
      const currentRelevance = decayRelevance(entry.relevance, entry.decayRate, ticksPassed);
      return currentRelevance > this.config.relevanceThreshold;
    });
  }

  /**
   * Gibt Einträge nach Tag zurück.
   */
  getEntriesByTag(tag: string, actorId?: string): MemoryEntry[] {
    const result: MemoryEntry[] = [];
    for (const entry of this.shortTerm.values()) {
      if (entry.tags.includes(tag) && (!actorId || entry.actorId === actorId)) {
        result.push(entry);
      }
    }
    for (const entry of this.longTerm.values()) {
      if (entry.tags.includes(tag) && (!actorId || entry.actorId === actorId)) {
        result.push(entry);
      }
    }
    return result;
  }

  // ── Vergessen ────────────────────────────────────────────────

  /**
   * Wendet Vergessen auf alle Einträge an (Relevanz-Verfall).
   * Einträge unter relevanceThreshold werden entfernt.
   */
  forget(currentTick: number): { forgotten: number; remaining: number } {
    let forgotten = 0;

    // Kurzzeit-Speicher
    for (const [id, entry] of this.shortTerm.entries()) {
      const ticksPassed = currentTick - entry.lastAccessedTick;
      const currentRelevance = decayRelevance(entry.relevance, entry.decayRate, ticksPassed);
      if (currentRelevance <= this.config.relevanceThreshold) {
        this.shortTerm.delete(id);
        forgotten++;
      }
    }

    // Langzeit-Speicher (langsameres Vergessen)
    for (const [id, entry] of this.longTerm.entries()) {
      const ticksPassed = currentTick - entry.lastAccessedTick;
      const currentRelevance = decayRelevance(entry.relevance, entry.decayRate * 0.5, ticksPassed);
      if (currentRelevance <= this.config.relevanceThreshold * 0.5) {
        this.longTerm.delete(id);
        forgotten++;
      }
    }

    return {
      forgotten,
      remaining: this.shortTerm.size + this.longTerm.size,
    };
  }

  // ── Verdichtung (Compaction) ─────────────────────────────────

  /**
   * Verdichtet den Kurzzeit-Speicher: weniger relevante Einträge werden ins
   * Langzeit-Archiv verschoben, irrelevante werden entfernt.
   */
  compact(currentTick: number): { compacted: number; archived: number; forgotten: number } {
    let compacted = 0;
    let archived = 0;
    let forgotten = 0;

    const entries = Array.from(this.shortTerm.values());

    // Nach Relevanz und Zugriff sortieren (weniger relevant zuerst)
    entries.sort((a, b) => {
      const aRelevance = decayRelevance(a.relevance, a.decayRate, currentTick - a.lastAccessedTick);
      const bRelevance = decayRelevance(b.relevance, b.decayRate, currentTick - b.lastAccessedTick);
      return aRelevance - bRelevance;
    });

    // Ziel: Kurzzeit-Speicher unter capacity bringen
    const targetSize = Math.floor(this.config.shortTermCapacity * 0.7);
    const toMove = entries.slice(0, Math.max(0, entries.length - targetSize));

    for (const entry of toMove) {
      const ticksPassed = currentTick - entry.lastAccessedTick;
      const currentRelevance = decayRelevance(entry.relevance, entry.decayRate, ticksPassed);

      if (currentRelevance > this.config.relevanceThreshold) {
        // In Langzeit-Archiv verschieben
        const archivedEntry: MemoryEntry = {
          ...entry,
          archived: true,
          lastAccessedTick: currentTick,
        };
        this.longTerm.set(entry.id, archivedEntry);
        this.shortTerm.delete(entry.id);
        archived++;
      } else {
        // Entfernen (vergessen)
        this.shortTerm.delete(entry.id);
        forgotten++;
      }
      compacted++;
    }

    // Langzeit-Speicher ebenfalls begrenzen
    if (this.longTerm.size > this.config.longTermCapacity) {
      const ltEntries = Array.from(this.longTerm.values()).sort((a, b) => {
        const aRelevance = decayRelevance(a.relevance, a.decayRate * 0.5, currentTick - a.lastAccessedTick);
        const bRelevance = decayRelevance(b.relevance, b.decayRate * 0.5, currentTick - b.lastAccessedTick);
        return aRelevance - bRelevance;
      });

      const toRemove = ltEntries.slice(0, this.longTerm.size - this.config.longTermCapacity);
      for (const entry of toRemove) {
        this.longTerm.delete(entry.id);
        forgotten++;
      }
    }

    return { compacted, archived, forgotten };
  }

  // ── Statistik ────────────────────────────────────────────────

  getStats(): {
    shortTerm: number;
    longTerm: number;
    total: number;
    archived: number;
  } {
    let archived = 0;
    for (const entry of this.longTerm.values()) {
      if (entry.archived) archived++;
    }
    for (const entry of this.shortTerm.values()) {
      if (entry.archived) archived++;
    }

    return {
      shortTerm: this.shortTerm.size,
      longTerm: this.longTerm.size,
      total: this.shortTerm.size + this.longTerm.size,
      archived,
    };
  }

  /**
   * Löscht alle Memory eines Akteurs (z. B. bei Archivierung der Identität).
   * Die Memory selbst bleibt nicht als Waise zurück.
   */
  clearActorMemory(actorId: string): number {
    let removed = 0;
    for (const [id, entry] of this.shortTerm.entries()) {
      if (entry.actorId === actorId) {
        this.shortTerm.delete(id);
        removed++;
      }
    }
    for (const [id, entry] of this.longTerm.entries()) {
      if (entry.actorId === actorId) {
        this.longTerm.delete(id);
        removed++;
      }
    }
    return removed;
  }
}

export const narrativeMemory = new NarrativeMemory();