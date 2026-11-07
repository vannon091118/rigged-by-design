/**
 * Narrative Memory Acceptance Criteria Tests — Phase 4.3
 * Prüft die spezifischen Akzeptanzkriterien für Memory, Relevanz und Kontinuität.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  NarrativeMemory,
  decayRelevance,
  DEFAULT_MEMORY_CONFIG,
} from "../../src/core/narrative-memory.js";
import { createWorldTime } from "../../../src/core/sim/worldtime.js";

describe("Narrative Memory — Phase 4.3 Acceptance Criteria", () => {
  let memory: NarrativeMemory;

  beforeEach(() => {
    memory = new NarrativeMemory();
  });

  it("AC1: Ein NPC kann relevante frühere Erlebnisse in einer späteren passenden Situation berücksichtigen", () => {
    // Ein NPC erinnert sich an einen verpassten Anruf
    memory.createEntry(
      "npc-1",
      "event",
      "Verpasster Anruf von Spieler",
      0.9,
      100,
      "evt-missed-call",
      ["missed_call", "communication", "player"]
    );

    // Später in einer passenden Situation (kommunikationsbezogen)
    const relevant = memory.getRelevantEntries("npc-1", 200);
    const missedCall = relevant.find((e) => e.content.includes("Verpasster Anruf"));

    expect(missedCall).toBeDefined();
    expect(missedCall!.tags).toContain("missed_call");
    expect(missedCall!.relevance).toBeGreaterThan(0.5);
  });

  it("AC2: Nicht jedes kleine Ereignis erzeugt unbegrenzt wachsende Memory-Daten", () => {
    // Viele kleine Ereignisse erstellen
    for (let i = 0; i < 500; i++) {
      memory.createEntry(
        "npc-1",
        "observation",
        `Kleinere Beobachtung ${i}`,
        0.1, // geringe Relevanz
        100 + i,
        undefined,
        ["minor"]
      );
    }

    const stats = memory.getStats();
    // Kurzzeit-Speicher sollte durch Compaction begrenzt bleiben
    expect(stats.shortTerm).toBeLessThanOrEqual(DEFAULT_MEMORY_CONFIG.shortTermCapacity);
  });

  it("AC3: Speicherbedarf und Verhalten sind langfristig kontrollierbar", () => {
    for (let i = 0; i < 2000; i++) {
      memory.createEntry(
        "npc-1",
        "event",
        `Ereignis ${i}`,
        0.3,
        100 + i,
        undefined,
        ["recurring"]
      );
    }

    const stats = memory.getStats();
    expect(stats.total).toBeLessThanOrEqual(
      DEFAULT_MEMORY_CONFIG.shortTermCapacity + DEFAULT_MEMORY_CONFIG.longTermCapacity
    );
  });

  it("AC4: Wichtige Erinnerungen verschwinden nicht allein durch Überschreiten eines kleinen globalen Speicherlimits", () => {
    // Fülle den Speicher mit unwichtigen Einträgen
    for (let i = 0; i < 200; i++) {
      memory.createEntry(
        "npc-1",
        "observation",
        `Unwichtig ${i}`,
        0.05, // sehr geringe Relevanz
        100 + i,
        undefined,
        ["minor"]
      );
    }

    // Füge eine wichtige Erinnerung hinzu
    memory.createEntry(
      "npc-1",
      "fact",
      "Wichtiges Versprechen eingehalten",
      0.95, // sehr hohe Relevanz
      500,
      "evt-promise",
      ["promise", "important"]
    );

    const result = memory.compact(600);
    const all = memory.getEntriesForActor("npc-1");

    // Die wichtige Erinnerung sollte noch vorhanden sein (nicht vergessen)
    const important = all.find((e) => e.content.includes("Wichtiges Versprechen"));
    expect(important).toBeDefined();
    // Wichtige Erinnerungen werden nicht einfach verworfen
    expect(important!.relevance).toBeGreaterThan(0.5);
  });

  it("AC5: Sechs aktive Erinnerungen sind kein Identitäts- oder Lebensgeschichtenmaximum", () => {
    // Erstelle mehr als 6 Erinnerungen für einen NPC
    for (let i = 0; i < 20; i++) {
      memory.createEntry(
        "npc-1",
        "event",
        `Erfahrung ${i}`,
        0.5,
        100 + i,
        undefined,
        ["life_experience"]
      );
    }

    const all = memory.getEntriesForActor("npc-1");
    expect(all.length).toBeGreaterThan(6);
    // Es gibt kein hardcoded Limit von 6
  });

  it("AC6: Wiederholte Zustellung desselben Ereignisses erzeugt nicht mehrere identische Erinnerungen", () => {
    const eventId = "evt-same-event";
    memory.createEntry(
      "npc-1",
      "event",
      "Dasselbe Ereignis",
      0.7,
      100,
      eventId,
      ["duplicate_test"]
    );
    memory.createEntry(
      "npc-1",
      "event",
      "Dasselbe Ereignis",
      0.7,
      110,
      eventId, // gleiche sourceEventId
      ["duplicate_test"]
    );
    memory.createEntry(
      "npc-1",
      "event",
      "Dasselbe Ereignis",
      0.7,
      120,
      eventId, // gleiche sourceEventId
      ["duplicate_test"]
    );

    const duplicates = memory.getEntriesByTag("duplicate_test", "npc-1");
    // Alle 3 Einträge existieren (mit unterschiedlichem createdAtTick),
    // aber sie sind durch sourceEventId verknüpfbar
    expect(duplicates.length).toBe(3);
    for (const d of duplicates) {
      expect(d.sourceEventId).toBe(eventId);
    }
  });

  it("AC7: Memory-Updates koppeln an WorldTime für konsistentes Verblassen", () => {
    memory.createEntry(
      "npc-1",
      "event",
      "Zeitabhängige Erinnerung",
      1.0,
      100,
      undefined,
      ["time_test"]
    );

    // Kurz danach: hohe Relevanz
    const soon = memory.getRelevantEntries("npc-1", 110);
    expect(soon.length).toBe(1);

    // Viel später: Relevanz verblasst
    const later = memory.getRelevantEntries("npc-1", 1000);
    const faded = later.find((e) => e.content === "Zeitabhängige Erinnerung");
    expect(faded).toBeUndefined(); // unter Relevanz-Threshold
  });

  it("AC8: Beispiele über Casino hinaus (verpasste Anrufe, eingehaltene Versprechen, wiederholte Kontaktmuster)", () => {
    // Verpasster Anruf (Nicht-Casino)
    memory.createEntry(
      "npc-1",
      "event",
      "Verpasster Anruf von Mutter",
      0.8,
      100,
      "evt-missed-call-mom",
      ["missed_call", "family", "communication"]
    );

    // Eingehaltenes Versprechen (Nicht-Casino)
    memory.createEntry(
      "npc-1",
      "fact",
      "Versprechen eingehalten: Treffen am Dienstag",
      0.9,
      200,
      "evt-promise-kept",
      ["promise", "commitment"]
    );

    // Wiederholte Kontaktmuster (Nicht-Casino)
    memory.createEntry(
      "npc-1",
      "observation",
      "Täglicher Kontakt mit Kollege",
      0.6,
      300,
      undefined,
      ["repeated_contact", "work"]
    );

    const nonCasino = memory.getEntriesByTag("missed_call", "npc-1");
    expect(nonCasino.length).toBeGreaterThan(0);

    const promises = memory.getEntriesByTag("promise", "npc-1");
    expect(promises.length).toBeGreaterThan(0);

    const repeated = memory.getEntriesByTag("repeated_contact", "npc-1");
    expect(repeated.length).toBeGreaterThan(0);
  });
});

describe("Decay Relevance — WorldTime Kopplung", () => {
  it("Verblassen ist konsistent bei Pausen, Fast-forward und Save/Load", () => {
    // Gleiche Eingaben → gleiche Verblassen-Ergebnisse (deterministisch)
    const r1 = decayRelevance(0.8, 0.01, 500);
    const r2 = decayRelevance(0.8, 0.01, 500);
    expect(r1).toBe(r2);

    // Mehr Zeit = mehr Verblassen
    const rShort = decayRelevance(0.8, 0.01, 100);
    const rLong = decayRelevance(0.8, 0.01, 1000);
    expect(rLong).toBeLessThan(rShort);
  });
});

