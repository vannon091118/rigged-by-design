# Narrative Engine — Architekturvertrag (NAR-00)

Stand: 2026-11-03 · Save v9 · Grundlagen NAR-00 bis NAR-03 vorhanden;
NAR-04 erledigt (Besucher↔Besucher, Besucher→Personal, Rivale→Haus), NAR-05 erledigt (Trigger-Context, Condition Evaluator, Schema), NAR-06 erledigt (Event-Scheduler, Lifecycle, persistente Instanzen, eigener Narrativ-RNG), NAR-07 erledigt (Event-Templates, stabile Choice-IDs, persistierte Choice-Saetze, Eligibility), NAR-08 erledigt (Command-DSL, Allowlist, Preflight, einmalige Ausfuehrung), NAR-09 erledigt (Contribution-Schema, kontrollierte Klassifizierung, Turn-Manifest, abgeleitete Registry). NAR-10 bis NAR-17 offen. Verbindlich ist der Code.

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
| `eventSeq` | naechste freie Event-Instanz-ID | monoton, nie wiederverwendet |
| `events` | aktive und begrenzte abgeschlossene Event-Instanzen; traegt `templateId`, `templateVersion` und `offeredChoiceIds` | 32 gesamt, 8 gleichzeitig live; 8 Choices je Instanz |
| `cooldowns` | Sperren je Event und Teilnehmerkombination | 64; `untilTick` in Welt-Ticks |
| `rng` | eigener persistenter Narrativ-Zufallsstrom | Seed/State als uint32 |

Facts sind eine diskriminierte Union mit `id`, `kind`, `tick`, `day` und typisierten
Nutzdaten. Umgesetzt: `START_POOL`, `VISITOR_FIRST_SEEN`, `VISITOR_RETURNED`,
`VISIT_ENDED`, `HOUSE_BALANCE`, `VISITOR_CONFLICT`, `VISITOR_SERVICE`,
`RIVAL_ENCOUNTER` und `COMMAND_REJECTED` (Diagnose, keine Spielwirkung). Besucherbezogene Alt-Facts tragen `visitorId`; die neuen
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

## 7. Content-Registry und Klassifizierung (NAR-09)

Ein Beitrag ist ein JSON-Datensatz in `content/narrative/contributions/`:

```json
{
  "agentId": "buffy",
  "turnId": "2026-11-03T01:35Z-nar-09-content-registry",
  "contributionId": "content-registry-01",
  "role": "BEOBACHTER",
  "locale": "de",
  "slot": "documentation",
  "function": "document",
  "contexts": ["content"],
  "tone": "sachlich",
  "mood": "neugierig",
  "relationship": "neutral",
  "personaRefs": ["rita-kern"],
  "flags": ["narrativ"],
  "text": "…",
  "directives": []
}
```

- Rollen, Locales und semantische Flags stehen in
  `content/narrative/vocabulary/flags.json`. Slots, Funktionen,
  Slot-Funktions-Kompatibilitaet, Kontexte, Ton, Stimmung, Beziehung und Personas
  stehen in `content/narrative/vocabulary/classification.json`. Unbekannte Werte
  sind kein Freitext, sondern ein Schemafehler.
- `content/narrative/turns/manifest.json` registriert jeden abgeschlossenen
  Agenten-Turn und verweist auf genau einen `contributionId`. Doppelte Turn- oder
  Contribution-IDs, fehlende Beitraege und nicht registrierte Beitraege sind
  fail-closed.
- `content/narrative/registry/fragments.json` ist die abgeleitete, nach
  `contributionId` sortierte Runtime-Registry (Version 2). Sie traegt Text,
  typisierte Direktiven-ASTs, Herkunft (`source`) und einen SHA-256-Hash ueber
  die kanonische Fragmentliste, aber keine zusaetzliche Spielmechanik.
  `scripts/compile-narrative-content.mjs` schreibt sie nur mit `--write`;
  Default und `--check` vergleichen die exakten Bytes. Die Registry wird nicht
  von Hand gepflegt.
- `scripts/lib/narrative-macros.mjs` validiert Makros gegen die NAR-08-Allowlist:
  exakte Argumente, stabile ActorRefs, kontrollierte Flags und hoechstens ein
  Singleton-Command pro Fragment. `scripts/lib/narrative-compiler.mjs` erkennt
  Konflikte ueber die Daten in `classification.json` und erzeugt die Registry.
- `scripts/lib/narrative-content.mjs` prueft Beitragsschema, Vokabular, IDs,
  Dateinamen, Manifest, Makros und Registry. `scripts/verify-narrative-content.mjs`
  ist der lesende Nachweis; `scripts/verify-assets.mjs` ruft denselben Validator
  im bestehenden Assets-Gate auf (`ERR-4022`), damit kein paralleler Gate-Stack
  entsteht.
- `text` bleibt Darstellung. Direktiven sind deklarativ; ihre Allowlist und
  Makro-Auswertung bleiben NAR-08, ihre Compiler-Pruefung NAR-10, und beide
  entscheiden nie ueber Choice-IDs, Kosten oder Effekte.
- Beitraege liegen unter `content/narrative/contributions/` und werden nie in
  Simulationscode oder `AGENTS.md` eingebettet. Die Registry ist Daten, kein
  ausfuehrbarer Content.

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

## 9. Event-Scheduler und Lifecycle (NAR-06)

`narrative/event-types.ts` beschreibt persistente Event-Instanzen und Kandidaten.
Ein Kandidat traegt `eventId`, Prioritaet, Scope, Teilnehmer, `sourceFactId`, Frist,
Cooldown, maximale Ausfuehrungen, optionalen Vorgaenger und Schritt. Gueltige Scopes
sind `GLOBAL` (keine Teilnehmer), `VISITOR` (genau ein `visitor:<id>`), `PAIR` (zwei
verschiedene Akteure) und `RIVAL` (genau ein `rival:<id>`).

`event-lifecycle.ts` ist die einzige Statuswahrheit:
`ELIGIBLE → OFFERED/ACTIVE → RESOLVED/EXPIRED/CANCELLED`. Ungueltige Spruenge bleiben
unveraendert. Beim terminalen Uebergang wird der Cooldown fuer genau diese
Event-/Teilnehmerkombination gesetzt; `advanceEventStep()` aendert nur den Schritt.
`expireDueEvents()` beendet Fristen, `cancelStaleEvents()` bricht Instanzen mit
verschwundenem Visitor-/Personal-Endpunkt ab. `processNarrativeBoundary()` ruft
`maintainEvents()` bei jedem Lauf auf, auch wenn keine neuen Facts anliegen.

`event-scheduler.ts` waehlt hohe Prioritaet zuerst, dann den aeltesten letzten Einsatz
und bei Gleichstand deterministisch aus dem eigenen Narrativ-RNG. Pro Aufruf entstehen
hoechstens drei Instanzen; maximal acht sind gleichzeitig live. Ein Duplikat wird pro
`eventId` + Scope + Teilnehmerkombination verhindert, auch bei umgekehrter Paar-Reihenfolge.
`maxOccurrences` unterscheidet einmalige und wiederholte Events; `cooldownTicks` sperrt
nach dem Abschluss. `chainEvent()` startet eine Folgeinstanz nur nach einem `RESOLVED`-
Vorgaenger und speichert `chainFromEventId`; die Aufloesung bleibt als Choice-Ergebnis
am Event. Story-Flags und Memory-Referenzen werden weiterhin im Trigger-Context geprueft.

`narrative-rng.ts` ist ein eigener, persistenter Mulberry32-Strom. Er wird nur fuer
Fairness-Ties verbraucht, nie der Gameplay-PRNG. `event-schema.ts` normalisiert alte
oder manipulierte Daten fail-closed und begrenzt Instanzen, Cooldowns und RNG-Werte.

### Event-Templates und Choices (NAR-07)

`narrative/events/template-types.ts` definiert die mechanische Struktur: stabile
`eventId`, Version, `triggerId`, Prioritaet, Scope, `participantRoles`, Content-Slots,
erlaubte `choices`, Startschritt, Frist, Cooldown und Wiederholungsgrenze. Jede Choice
traegt eine stabile `choiceId`, einen Label-Slot, Requirements, optionale VaCoin-Kosten,
eine deklarative Effektliste sowie `outcomeId` und optionales `followUpEventId`. Texte
liegen ausschliesslich in Content-Slots; sie aendern weder Choice-IDs noch Effekte.

`events/template-schema.ts` validiert fail-closed: Scope und Rollen muessen passen,
Choice-IDs und Label-Slots eindeutig sein, Requirements/Kosten/Effekte begrenzt und
Akteursreferenzen gueltig. `events/definitions/` registriert `VISITOR_RETURN` und
`VISITOR_CONFLICT`; `templateFor()` liefert nur gueltige Definitionen. `createEventCandidate()`
loest die deklarierten Rollen eins zu eins gegen die Match-Teilnehmer auf und uebergibt
Template-ID, Version und den angebotenen Choice-Satz an den Scheduler.

`choices/contract.ts` bindet eine Choice an `eventId`, `templateId`, `templateVersion`
und den persistierten `offeredChoiceIds`-Satz. Eine unbekannte, nicht angebotene oder
versionsfremde Choice liefert `null`. `choices/eligibility.ts` prueft bei jedem Klick
erneut Lifecycle, Ablauf, Requirements, Kosten und den gespeicherten Satz; die Funktion
ist rein und veraendert weder Welt noch Ledger. Effekte werden in NAR-07 nur deklariert,
nicht ausgefuehrt.

### Commands und Allowlist (NAR-08)

`narrative/commands/parse-directives.ts` uebersetzt begrenzte `€...`-Direktiven in ein
AST aus Command-ID, positionalen und benannten Argumenten. Laenge, Anzahl, Quotes,
doppelte Schluessel und unbekannte Formen werden fail-closed verworfen; Text wird nie
als Code interpretiert. `registry.ts` ist die Allowlist der Command-IDs und Parameter:
`SET_FLAG`, `ADJUST_RELATIONSHIP`, `FREEZE_TICK` und `TRIGGER_DIALOG`. Jede Spec traegt
Familie, Handler-Vertrag und ein `executable`-Flag. `TRIGGER_DIALOG` ist parsebar, aber
bis zur UI-Anbindung nicht ausfuehrbar.

`validate.ts` kompiliert nur Registry-Treffer mit gueltigen Argumenten; ein Batch wird
vollstaendig verworfen, sobald eine Direktive scheitert oder nicht in der uebergebenen
Template-/Choice-Allowlist steht. `commandsForChoice()` uebersetzt die deklarierten
Choice-Effekte in dieselbe typisierte Form. `preflight.ts` prueft zusaetzlich Event-
Lifecycle, Frist, Requirements, Kosten, persistierten Choice-Satz und alle Zielakteure.
`execute.ts` ist der einzige Schreibpfad: Es aktiviert ein `OFFERED`-Event, bucht
VaCoin-Kosten ueber das bestehende Ledger gegen `EXTERNAL_WORLD`, wendet die Handler an
und setzt `RESOLVED` mit der `outcomeId`. Ein zweiter Klick scheitert am Status und
veraendert weder Flags noch Beziehungen noch Ledger. Abgelehnte Direktiven oder Choices
erzeugen den begrenzten Diagnose-Fact `COMMAND_REJECTED`.

## 10. Makros (Semantik, nicht geraten)

- `€FreezeTick:200` verlaengert nur die Frist der aktiven **Event-Instanz** um 200
  fortschreitende Welt-Ticks; die uebrige Simulation laeuft weiter. Der Handler ist auf
  1..200 Ticks begrenzt und schreibt `expiresTick` in den Save.
- `€trigger Dialog '(...)'` wird als `TRIGGER_DIALOG` geparst; der String ist eine ID
  aus dem Choice-Vertrag, kein ausfuehrbarer Code. Der Handler bleibt bis zur
  UI-/Runtime-Anbindung (NAR-14) fail-closed nicht ausfuehrbar.
- Unbekannte Commands, ungueltige Parameter, nicht allowlistete IDs und fehlende
  Zielakteure werden vor jeder Wirkung verworfen; die Ablehnung erscheint als
  begrenzter Fact `COMMAND_REJECTED`. Der Compiler (NAR-10) validiert Direktiven, bevor
  irgendein Command laeuft.

## 11. Nicht-Ziele

- Kein LLM, Modell-Provider oder Netzwerk-Textaufruf im Spiel, auch nicht ausserhalb des Ticks. Agenten koennen Content bei der Repository-Arbeit erstellen; die Laufzeit nutzt ausschliesslich lokale validierte Daten.
- Keine Ausfuehrung von Code aus Texten; Commands sind deklarativ und allowlisted.
- Kein Journal als Fact-Bus, keine zweite Event-Wahrheit neben `demandEvent`.
- Keine Wanduhr und kein `Math.random` in Narrativ-Code (ESLint blockt beides).
- Keine unbegrenzten Pools: Facts, Historie, Erinnerungen und Events sind gedeckelt.

## 12. Persistenz

Save v9 traegt `narrative`, darin den laufenden Nachfrageevent, `ledgerSeq`, `houseBand`, die kanonisch sortierten gerichteten Beziehungen und die Erinnerungen der Visitor-Profile. Alte v5–v9-Staende mit `world.demandEvent` werden beim Laden in den narrativen Zustand uebernommen; die Planung bleibt bis NAR-13 in `demand.ts`. v5–v8 bleiben
ladbar: fehlende Narrative-Daten werden auf leere Defaults normalisiert, kaputte Facts
und Erinnerungen verworfen, IDs monoton fortgeschrieben. Event-Instanzen, Cooldowns und der eigene Narrativ-RNG liegen seit NAR-06 in Save v9;
seit NAR-07 tragen Instanzen zusaetzlich `templateId`, `templateVersion` und den
angebotenen `offeredChoiceIds`-Satz. Fehlende Felder alter Staende werden auf `eventId`,
Version 1 und einen leeren Satz normalisiert; solche Events bleiben fail-closed nicht
ausfuehrbar, bis ein kompatibles Template mit gueltigen Choice-IDs vorliegt.
`COMMAND_REJECTED` ist ein normaler, begrenzter Fact in `pending`/`recent` und braucht
kein neues Save-Feld; Event-Status und `resolution` bleiben die Wahrheit fuer
Idempotenz.
