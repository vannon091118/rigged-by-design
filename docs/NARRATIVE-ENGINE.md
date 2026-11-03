# Narrative Engine — Architekturvertrag (NAR-00)

Stand: 2026-11-02 · Save v9 · Grundlagen NAR-00 bis NAR-03 vorhanden;
NAR-04 erledigt (Besucher↔Besucher, Besucher→Personal, Rivale→Haus), NAR-05 erledigt (Trigger-Context, Condition Evaluator, Schema), NAR-06 bis NAR-17 offen. Verbindlich ist der Code.

## 1. Grundsatz

Die Engine erzaehlt, was in der Simulation tatsaechlich passiert. Sie erfindet keine
Spielregeln, keinen Zufall und keine Zeit. Ein Fact ist eine Tatsache aus einem
Zustandsuebergang; Text ist Darstellung; Geld bleibt im Ledger.

```text
Simulation / Store-Commands / Ledger / Rivalen
        │  emitFact (nur echte Uebergaenge)
        ▼
  NarrativeState  ──pending──▶ processNarrativeBoundary ──▶ Memory / Relationships / recentFacts
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
| `ledgerSeq` | Ledger-`seq` der letzten verarbeiteten Buchung | `null` = noch kein Cursor; kein historisches Nachholen |
| `houseBand` | zuletzt gemeldeter Hauskonto-Band | `LOW`/`OK`, verhindert Doppelfacts |
| `demandEvent` | aktive Neon-Nacht oder Turnierabend | hoechstens eine Veranstaltung; Ablauf bisher in `demand.ts` |
| `flags` | Zaehler mit narrativer Bedeutung | nur endliche Zahlen |
| `relationships` | gerichtete Kanten zwischen persistenten Akteuren | 200; Endpunkte pinnen Visitor-Profile |

Facts sind eine diskriminierte Union mit `id`, `kind`, `tick`, `day` und typisierten
Nutzdaten. Umgesetzt: `START_POOL`, `VISITOR_FIRST_SEEN`, `VISITOR_RETURNED`,
`VISIT_ENDED`, `HOUSE_BALANCE`, `VISITOR_CONFLICT`, `VISITOR_SERVICE` und
`RIVAL_ENCOUNTER`. Besucherbezogene Alt-Facts tragen `visitorId`; die neuen
Beziehungs-Facts tragen stattdessen `actorRefs` (`visitor:<id>`, `staff:<id>`,
`rival:<id>`, `player`) und werden beim Laden rollenspezifisch validiert. Alle
Felder sind JSON-serialisierbar; keine Funktionen, Maps, Sets oder UI-Objekte.

`Visitor.memories: VisitorMemory[]` speichert hoechstens sechs strukturierte
Erinnerungen (`factId`, `tick`, `score`, `valence`). Eine Erinnerung ist eine
Bedeutung, keine kopierte Journal-Zeile.

## 4. Lebenszyklus und Idempotenz

1. Die Simulation ruft `emitFact()` genau an der Ursache auf.
2. `processNarrativeBoundary()` erzeugt zuerst Ledger-Schwellen-Facts
   (`HOUSE_BALANCE`), drainiert dann alle Facts mit `id > processedId` und leert die Queue.
3. Im selben Durchlauf schreibt der Boundary Erinnerungen (einmal je `factId`),
   Zaehler, Beziehungen und `recent`; neue Facts bleiben fuer den naechsten Aufruf liegen.
4. Ein erneuter Drain liefert nichts. Ein Save-/Load-Roundtrip setzt `processedId`
   und `ledgerSeq` fort, damit kein Fact doppelt wirkt.

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
Differenz gegen eine Kontrollwelt mit identischem Seed. Ein guter oder schlechter
Besuch verschiebt zusaetzlich die gerichtete Kante `visitor:<id> -> player` um Trust
und Sympathie; neutrale Besuche erzeugen keine Kante. Seit NAR-04 speisen drei weitere
echte Quellen das Modell: ein Streit (`VISITOR_CONFLICT`) erzeugt zwei gerichtete
Besucherkanten, eine Kassenbedienung durch anwesendes Personal (`VISITOR_SERVICE`)
erzeugt `visitor:<id> -> staff:<id>`, und die Abrechnung eines fremden Spiels
(`RIVAL_ENCOUNTER`) erzeugt `rival:<id> -> player` aus dem Nettofluss. Selbstbedienung,
neutrale Spiele und nicht anwesendes Personal erzeugen keine Kante. Die Endpunkte
pinnen ihre Visitor-Profile gegen die Retention; Kanten sind kanonisch sortiert,
gedeckelt, geklemmt und beim Laden dedupliziert.

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

## 8. Trigger-Vertrag (NAR-05)

`narrative/trigger-types.ts` beschreibt den deklarativen Vertrag; `trigger-context.ts`
baut aus Welt, Ledger und aktuellem Fact einen unveraenderlichen Snapshot. Enthalten sind
aktueller Fact plus `recent`-Historie, Tick/Tag, Flags, gerichtete Beziehungen,
Visitor-Profile, Hauskonto/Band, Charisma, Ruf, Nachfragestufe, bediente Gaeste und
Geraeteschaden. `actorRefsOfFact()` loest alte `visitorId`-Facts und neue
`actorRefs`-Facts auf dieselbe Akteursliste.

`trigger-evaluate.ts` ist rein: `all`/`any`/`not`, Fact-Typ, Besuchererinnerung,
Hauskonto-Grenzen/Band, Geraeteschaden, Charisma, Ruf, Nachfragestufe, bediente Gaeste,
Flags (Wert/Anwesenheit/Abwesenheit), Zeitfenster, `recent-fact`, Akteur/Rolle und
Beziehungen (Trust/Sympathie/Konflikt/Einfluss). `evaluateTrigger()` liefert Match plus
Begruendungen; `evaluateTriggerDefinition()` ergaenzt `triggerId`, `factId` und
aufgeloeste Teilnehmer. Fehlende Beziehungen oder Besucherprofile sind ein
Nicht-Match, kein Fehler.

`trigger-schema.ts` validiert rekursiv und fail-closed: unbekannte Operatoren,
ungueltige Fact-Arten/ActorRefs, Selbstkanten, negative oder unsichere Schwellen,
ungueltige Band/Stufe/Rolle/Dimension und leere `all`/`any`-Listen werden verworfen;
Tiefe 12 und 64 Knoten sind die Grenze. Der Evaluator veraendert weder Welt noch
Ledger, zieht keinen PRNG und ruft kein Netzwerk/LLM. Der Aufruf im Tick und Cooldowns
bleiben NAR-06/NAR-12.

## 9. Makros (Semantik, nicht geraten)

- `€FreezeTick:200` soll nur die aktive **Event-Instanz** fuer 200 fortschreitende
  Welt-Ticks pausieren; die uebrige Simulation laeuft weiter. Die templategebundene
  Obergrenze, Ablauf und Save-/Load-Fortsetzung sind vor Umsetzung zu pruefen.
- `€trigger Dialog '(...)'` oeffnet einen Dialog mit dem genannten Choice-Satz. Der
  String ist eine ID aus dem Choice-Vertrag, kein ausfuehrbarer Code. Unbekannte IDs
  werden verworfen und als Fact `COMMAND_REJECTED` (NAR-08) sichtbar.

Beide Makros sind bis NAR-08 nur Vertrag; der Compiler (NAR-10) validiert sie, bevor
irgendein Command laeuft.

## 10. Nicht-Ziele

- Kein LLM, Modell-Provider oder Netzwerk-Textaufruf im Spiel, auch nicht ausserhalb des Ticks. Agenten koennen Content bei der Repository-Arbeit erstellen; die Laufzeit nutzt ausschliesslich lokale validierte Daten.
- Keine Ausfuehrung von Code aus Texten; Commands sind deklarativ und allowlisted.
- Kein Journal als Fact-Bus, keine zweite Event-Wahrheit neben `demandEvent`.
- Keine Wanduhr und kein `Math.random` in Narrativ-Code (ESLint blockt beides).
- Keine unbegrenzten Pools: Facts, Historie, Erinnerungen und Events sind gedeckelt.

## 11. Persistenz

Save v9 traegt `narrative`, darin den laufenden Nachfrageevent, `ledgerSeq`, `houseBand`, die kanonisch sortierten gerichteten Beziehungen und die Erinnerungen der Visitor-Profile. Alte v5–v9-Staende mit `world.demandEvent` werden beim Laden in den narrativen Zustand uebernommen; die Planung bleibt bis NAR-13 in `demand.ts`. v5–v8 bleiben
ladbar: fehlende Narrative-Daten werden auf leere Defaults normalisiert, kaputte Facts
und Erinnerungen verworfen, IDs monoton fortgeschrieben. Aktive Events, Choices,
Fristen und Cooldowns kommen mit NAR-06/NAR-07 hinzu und muessen denselben Roundtrip
bestehen.
