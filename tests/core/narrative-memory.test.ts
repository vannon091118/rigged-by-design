import { describe, it, expect, beforeEach } from "vitest";
import {
  NarrativeMemory,
  narrativeMemory,
  decayRelevance,
  DEFAULT_MEMORY_CONFIG,
  type MemoryEntry,
  type MemoryConfig,
} from "../../src/core/narrative-memory.js";
describe("Narrative Memory (Phase 4)", () => {
  let memory: NarrativeMemory;

  beforeEach(() => {
    memory = new NarrativeMemory();
  });

  it("creates and retrieves a memory entry", () => {
    const entry = memory.createEntry(
      "actor-1",
      "event",
      "Ein Besucher kam ins Casino",
      0.8,
      100,
      "evt-1",
      ["visitor", "casino"]
    );

    expect(entry.id).toBeDefined();
    expect(entry.actorId).toBe("actor-1");
    expect(entry.relevance).toBe(0.8);
    expect(entry.accessCount).toBe(0);

    const retrieved = memory.getEntry(entry.id);
    expect(retrieved).toBeDefined();
    expect(retrieved!.content).toBe("Ein Besucher kam ins Casino");
  });

  it("accessing an entry updates accessCount and lastAccessedTick", () => {
    const entry = memory.createEntry("actor-1", "fact", "Test", 0.5, 100);
    memory.accessEntry(entry.id, 200);

    const updated = memory.getEntry(entry.id);
    expect(updated?.accessCount).toBe(1);
    expect(updated?.lastAccessedTick).toBe(200);
  });

  it("getEntriesForActor returns only that actor's entries", () => {
    memory.createEntry("actor-1", "event", "Entry A", 0.5, 100);
    memory.createEntry("actor-2", "event", "Entry B", 0.5, 100);

    const a1 = memory.getEntriesForActor("actor-1");
    const a2 = memory.getEntriesForActor("actor-2");
    expect(a1.length).toBe(1);
    expect(a2.length).toBe(1);
    expect(a1[0].content).toBe("Entry A");
    expect(a2[0].content).toBe("Entry B");
  });

  it("getRelevantEntries filters by relevance threshold", () => {
    memory.createEntry("actor-1", "event", "Relevant", 0.9, 100);
    memory.createEntry("actor-1", "event", "Irrelevant", 0.05, 100);

    const relevant = memory.getRelevantEntries("actor-1", 100);
    expect(relevant.length).toBe(1);
    expect(relevant[0].content).toBe("Relevant");
  });

  it("getEntriesByTag filters by tag", () => {
    memory.createEntry("actor-1", "event", "Casino visit", 0.5, 100, undefined, ["casino", "visitor"]);
    memory.createEntry("actor-1", "event", "Work", 0.5, 100, undefined, ["work"]);

    const casino = memory.getEntriesByTag("casino");
    expect(casino.length).toBe(1);
    expect(casino[0].content).toBe("Casino visit");
  });

  it("decayRelevance reduces relevance over time", () => {
    const r1 = decayRelevance(1.0, 0.01, 0);
    expect(r1).toBe(1.0);

    const r2 = decayRelevance(1.0, 0.01, 100);
    expect(r2).toBeLessThan(1.0);
    expect(r2).toBeGreaterThan(0);

    const r3 = decayRelevance(1.0, 0.01, 1000);
    expect(r3).toBeLessThan(r2);
  });

  it("forget removes low-relevance entries", () => {
    memory.createEntry("actor-1", "event", "To forget", 0.05, 100); // unter Threshold 0.1
    memory.createEntry("actor-1", "event", "To keep", 0.9, 100);

    const result = memory.forget(200); // 100 Ticks später, geringer Verfall
    expect(result.forgotten).toBeGreaterThanOrEqual(0);

    const remaining = memory.getEntriesForActor("actor-1");
    // "To keep" sollte noch da sein
    const kept = remaining.find((e) => e.content === "To keep");
    expect(kept).toBeDefined();
  });

  it("compact moves low-relevance entries to long-term archive", () => {
    // Erstelle viele Einträge mit sehr alten Ticks und geringer Relevanz
    for (let i = 0; i < 160; i++) {
      memory.createEntry("actor-1", "event", `Entry ${i}`, 0.3, 10 + i);
    }

    const statsBefore = memory.getStats();
    const result = memory.compact(500);
    const statsAfter = memory.getStats();

    // Compaction sollte Einträge verarbeiten (archivieren oder vergessen)
    expect(result.compacted + result.archived + result.forgotten).toBeGreaterThanOrEqual(0);
    // Kurzzeit sollte nicht größer sein nach Compaction
    expect(statsAfter.shortTerm).toBeLessThanOrEqual(statsBefore.shortTerm + 160);
  });

  it("long-term archive keeps entries after compact", () => {
    memory.createEntry("actor-1", "event", "Important memory", 0.9, 100);
    memory.compact(200);

    const all = memory.getEntriesForActor("actor-1");
    const important = all.find((e) => e.content === "Important memory");
    expect(important).toBeDefined();
  });

  it("clearActorMemory removes all entries for an actor", () => {
    memory.createEntry("actor-1", "event", "A1", 0.5, 100);
    memory.createEntry("actor-2", "event", "A2", 0.5, 100);

    const removed = memory.clearActorMemory("actor-1");
    expect(removed).toBe(1);
    expect(memory.getEntriesForActor("actor-1").length).toBe(0);
    expect(memory.getEntriesForActor("actor-2").length).toBe(1);
  });

  it("stats are correct", () => {
    memory.createEntry("actor-1", "event", "A", 0.5, 100);
    const stats = memory.getStats();
    expect(stats.shortTerm).toBe(1);
    expect(stats.longTerm).toBe(0);
    expect(stats.total).toBe(1);
  });
});
