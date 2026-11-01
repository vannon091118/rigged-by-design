# Narrative Engine — Architekturvertrag (NAR-00)

Stand: 2026-11-01 · Version `0.3.64` · Save v9 · Status: NAR-00 bis NAR-03 umgesetzt,
NAR-04 bis NAR-17 offen. Verbindlich ist der Code; dieses Dokument begruendet ihn.

## 1. Grundsatz

Die Engine erzaehlt, was in der Simulation tatsaechlich passiert. Sie erfindet keine
Spielregeln, keinen Zufall und keine Zeit. Ein Fact ist eine Tatsache aus einem
Zustandsuebergang; Text ist Darstellung; Geld bleibt im Ledger.

```text
Simulation / Store-Commands / Ledger / Rivalen
        │  emitFact (nur echte Uebergaenge)
        ▼
  NarrativeState  ──pending──▶ processFacts ──▶ VisitorMemory / Flags / recentFacts
        │                                            │
        └────────────── Trigger (NAR-05) ◀───────────┘
                             │
                        Scheduler (NAR-06)
                             │
                     Event + Choice-Vertrag (NAR-07)
                             │
                  Composer nur fuer Text (NAR-11)
```

## 2. Guest und Visitor

| Begriff | Rolle | Lebensdauer |
|---|---|---|
| `Guest` | temporaere Besuchsinstanz mit Position, Laune, Geduld, Weg | ein Besuch |
| `Visitor` | persistente Figur mit Name, Persona, Besuchen, Erinnerungen | ueber Saves |

`Guest.visitorId` verbindet beide. Beim Rueckkehr-Spawn werden nur persistente
Eigenschaften (Name, Persona, Erinnerungswirkung) uebernommen; Beduerfnisse, Position,
Warteschlange und Besuchsstatus entstehen neu.

## 3. Datenvertrag (`src/core/sim/narrative/types.ts`)

`WorldState.narrative: NarrativeState`

| Feld | Bedeutung | Grenze |
|---|---|---|
| `factSeq` | naechste freie Fact-ID, monoton | waechst, springt nie zurueck |
| `pending` | noch nicht verarbeitete Facts | 48, aelteste fallen nach vorn raus |
| `recent` | verarbeitete Facts fuer kurze Ketten | 120 |
| `processedId` | hoechste verarbeitete ID | verhindert Doppelverarbeitung |
| `dropped` | verworfene Facts wegen Queue-Grenze | Diagnose, kein Trigger |
| `flags` | Zaehler mit narrativer Bedeutung | nur endliche Zahlen |

Facts sind eine diskriminierte Union mit `id`, `kind`, `tick`, `day` und typisierten
Nutzdaten. Umgesetzt: `START_POOL`, `VISITOR_FIRST_SEEN`, `VISITOR_RETURNED`,
`VISIT_ENDED`. Alle Felder sind JSON-serialisierbar; keine Funktionen, Maps, Sets
oder UI-Objekte.

`Visitor.memories: VisitorMemory[]` speichert hoechstens sechs strukturierte
Erinnerungen (`factId`, `tick`, `score`, `valence`). Eine Erinnerung ist eine
Bedeutung, keine kopierte Journal-Zeile.

## 4. Lebenszyklus und Idempotenz

1. Die Simulation ruft `emitFact()` genau an der Ursache auf.
2. `drainFacts()` liefert alle Facts mit `id > processedId` und leert die Queue.
3. `processFacts()` schreibt Erinnerungen (einmal je `factId`), Zaehler und `recent`.
4. Ein erneuter Drain liefert nichts. Ein Save-/Load-Roundtrip setzt `processedId`
   fort, damit kein Fact doppelt wirkt.

Journal und Facts bleiben getrennt: Das Journal dokumentiert fuer den Spieler, Facts
treiben Trigger und Gedaechtnis. Kein Journal-Eintrag ist Voraussetzung fuer einen Fact.

## 5. Wirkung (belegt, nicht behauptet)

`memoryEffect(visitor)` liest nur gespeicherte Daten, ohne PRNG:

- gute Erinnerung: `+4` Rueckkehr-Prozent und `+6` Laune je Gewicht,
- schlechte Erinnerung: `-6` und `-4`,
- die letzte Erinnerung zaehlt doppelt; Bonus gedeckelt auf `[-12, +12]` bzw. `[-8, +10]`.

`returnChance()` addiert den Rueckkehr-Bonus, `spawnGuest()` addiert den Laune-Bonus
beim Rueckkehrer-Spawn. Damit aendert sich messbar, wer wiederkommt und wie er ankommt;
die Tests `narrative-memory.test.ts` und `narrative-start-pool.test.ts` belegen die
Differenz gegen eine Kontrollwelt mit identischem Seed.

## 6. Start-Pool

`seedStartPool(world, capital)` legt beim neuen Spiel drei bekannte Figuren an
(`Rita Kern`, `Boris Falk`, `Mira Sol`) und bucht das Startkapital als `START_POOL`-Fact.
Der Aufruf ist idempotent und laeuft nur im Store-Pfad fuer neue Spiele, nicht in
`createWorld()`; alte Saves behalten ihre Besucherliste. Der Start-Pool wirkt ab Tick 0:
Die deterministische Rueckkehrer-Auswahl kann sofort eine dieser Figuren treffen.

## 7. Content-Beitrag (Inbox bis zur Registry, NAR-09)

Ein Beitrag ist ein JSON-Datensatz:

```json
{
  "agentId": "buffy",
  "turnId": "2026-11-01T12:00Z-narrative-start",
  "contributionId": "start-pool-opening-01",
  "role": "ERNaeHRER",
  "locale": "de",
  "flags": ["narrativ", "startpool", "eroeffnung", "rita-kern"],
  "text": "…",
  "directives": []
}
```

Regeln:

- Ein Agent liefert pro abgeschlossenem Turn genau einen Beitrag.
- `turnId` + `contributionId` sind eindeutig; doppelte oder fehlende Beitraege findet
  der spaetere Validator (NAR-10).
- Beitraege liegen unter `content/narrative/contributions/` und werden nie in
  Simulationscode oder `AGENTS.md` eingebettet.
- `flags` stammen aus `content/narrative/vocabulary/flags.json`.
- `text` ist Darstellung. Er entscheidet nie ueber Choice-IDs, Kosten oder Effekte.

## 8. Makros (Semantik, nicht geraten)

- `€FreezeTick:200` pausiert die **Simulation** fuer 200 Ticks, nicht die Anzeige:
  `world.tick` steht still, Pacing und UI laufen weiter. Ein Freeze ist ein Zustand im
  Narrative-State, kein Timer aus der Wanduhr; er ueberlebt Save/Load mit Restdauer.
- `€trigger Dialog '(...)'` oeffnet einen Dialog mit dem genannten Choice-Satz. Der
  String ist eine ID aus dem Choice-Vertrag, kein ausfuehrbarer Code. Unbekannte IDs
  werden verworfen und als Fact `COMMAND_REJECTED` (NAR-08) sichtbar.

Beide Makros sind bis NAR-08 nur Vertrag; der Compiler (NAR-10) validiert sie, bevor
irgendein Command laeuft.

## 9. Nicht-Ziele

- Kein LLM in `tickWorld`, kein Netzwerkaufruf im Tick, kein Provider-SDK in `src/core`.
- Keine Ausfuehrung von Code aus Texten; Commands sind deklarativ und allowlisted.
- Kein Journal als Fact-Bus, keine zweite Event-Wahrheit neben `demandEvent`.
- Keine Wanduhr und kein `Math.random` in Narrativ-Code (ESLint blockt beides).
- Keine unbegrenzten Pools: Facts, Historie, Erinnerungen und Events sind gedeckelt.

## 10. Persistenz

Save v9 traegt `narrative` und die Erinnerungen der Visitor-Profile. v5–v8 bleiben
ladbar: fehlende Narrative-Daten werden auf leere Defaults normalisiert, kaputte Facts
und Erinnerungen verworfen, IDs monoton fortgeschrieben. Aktive Events, Choices,
Fristen und Cooldowns kommen mit NAR-06/NAR-07 hinzu und muessen denselben Roundtrip
bestehen.
