# Narrative Engine — Architekturvertrag (NAR-00)

Stand: 2026-11-04 · Save v10 · Grundlagen NAR-00 bis NAR-03 vorhanden;
NAR-04 erledigt (Besucher↔Besucher, Besucher→Personal, Rivale→Haus), NAR-05 erledigt (Trigger-Context, Condition Evaluator, Schema), NAR-06 erledigt (Event-Scheduler, Lifecycle, persistente Instanzen, eigener Narrativ-RNG), NAR-07 erledigt (Event-Templates, stabile Choice-IDs, persistierte Choice-Saetze, Eligibility), NAR-08 erledigt (Command-DSL, Allowlist, Preflight, einmalige Ausfuehrung), NAR-09 erledigt (Contribution-Schema, kontrollierte Klassifizierung, Turn-Manifest, abgeleitete Registry), NAR-10 erledigt (Content-Compiler, byte-identische Registry), NAR-11 erledigt (lokaler Composer, Fallbacks), NAR-12 erledigt (Orchestrierung in Tick und WorldStore, Command→Fact-Kreis). NAR-13 bis NAR-17 erledigt; B1 erledigt. Verbindlich ist der Code.

## 1. Grundsatz

Die Engine erzaehlt, was in der Simulation tatsaechlich passiert. Sie erfindet keine
Spielregeln, keinen Zufall und keine Zeit. Ein Fact ist eine Tatsache aus einem
Zustandsuebergang; Text ist Darstellung; Geld bleibt im Ledger.

```text
Simulation / Store-Commands / Ledger / Rivalen
        │  emitFact (nur echte Uebergaenge)
        ▼
  NarrativeState  ──pending──▶ processNarrativeRuntime ──▶ Memory / Relationships / recentFacts
        │                              │
        │                              ├─▶ Trigger (NAR-05) ─▶ Scheduler (NAR-06) ─▶ Event/Choice
        │                              └─▶ processNarrativeBoundaryDetailed (einziger Drain)
        └──── neue Facts warten auf den naechsten Lauf ◀── Choice-Command (`EVENT_RESOLVED`)
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
| `flags` | Zaehler mit narrativer Bedeutung | nur endliche Zahlen |
| `relationships` | gerichtete Kanten zwischen persistenten Akteuren | 200; Endpunkte pinnen Visitor-Profile |
| `eventSeq` | naechste freie Event-Instanz-ID | monoton, nie wiederverwendet |
| `events` | aktive und begrenzte abgeschlossene Event-Instanzen; traegt `templateId`, `templateVersion` und `offeredChoiceIds`; hoechstens eine aktive Nachfrageveranstaltung (GLOBAL) | 32 gesamt, 8 gleichzeitig live; 8 Choices je Instanz |
| `cooldowns` | Sperren je Event und Teilnehmerkombination | 64; `untilTick` in Welt-Ticks |
| `rng` | eigener persistenter Narrativ-Zufallsstrom | Seed/State als uint32 |

Facts sind eine diskriminierte Union mit `id`, `kind`, `tick`, `day` und typisierten
Nutzdaten. Umgesetzt: `START_POOL`, `VISITOR_FIRST_SEEN`, `VISITOR_RETURNED`,
`VISIT_ENDED`, `HOUSE_BALANCE`, `VISITOR_CONFLICT`, `VISITOR_SERVICE`,
`RIVAL_ENCOUNTER`, `COMMAND_REJECTED` (Diagnose, keine Spielwirkung) und
`EVENT_RESOLVED` (eine aufgeloeste Choice). Besucherbezogene Alt-Facts tragen `visitorId`; die neuen
Beziehungs-Facts tragen stattdessen `actorRefs` (`visitor:<id>`, `staff:<id>`,
`rival:<id>`, `player`) und werden beim Laden rollenspezifisch validiert. Alle
Felder sind JSON-serialisierbar; keine Funktionen, Maps, Sets oder UI-Objekte.

`Visitor.memories: VisitorMemory[]` speichert hoechstens sechs strukturierte
Erinnerungen (`factId`, `tick`, `score`, `valence`). Eine Erinnerung ist eine
Bedeutung, keine kopierte Journal-Zeile.

## 4. Lebenszyklus und Idempotenz

1. Die Simulation ruft `emitFact()` genau an der Ursache auf.
2. `processNarrativeRuntime()` stoesst den einen Boundary an: zuerst entstehen
   Ledger-Schwellen-Facts (`HOUSE_BALANCE`), dann werden alle Facts mit
   `id > processedId` drainiert und die Queue geleert.
3. Im selben Durchlauf schreibt der Boundary Erinnerungen (einmal je `factId`),
   Zaehler, Beziehungen und `recent`; neue Facts bleiben fuer den naechsten Aufruf liegen.
4. Ein erneuter Drain liefert nichts. Ein Save-/Load-Roundtrip setzt `processedId`
   und `ledgerSeq` fort, damit kein Fact doppelt wirkt.
5. Danach wertet `runtime.ts` die deklarativen Trigger aus, uebersetzt Treffer in
   Template-Kandidaten und plant hoechstens drei neue Event-Instanzen. Die
   Reihenfolge ist fest: Simulation → Facts → Memory/Relationships → Trigger →
   Scheduler → Events/Choices → Journal/Snapshot.
6. Eine aufgeloeste Choice emittiert `EVENT_RESOLVED`; dieser Fact wird erst im
   naechsten Lauf verarbeitet. Kein Lauf rekursiert in seine eigenen Facts.

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
- `src/core/sim/narrative/composer/registry.generated.ts` ist der typisierte
  Core-Spiegel derselben Registry. Der Compiler schreibt ihn mit `--write`;
  `--check` und das Assets-Gate vergleichen JSON und TypeScript byte-genau.
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

## 8. Runtime Composer (NAR-11)

`narrative/composer/index.ts` ist rein: Er nimmt `ComposeRequest` (Locale,
Template-Slots, Kontexte, benoetigte Flags, verfuegbare Personas und optionale
Tonalitaet) und liefert pro Slot Text, Herkunft, Fallback-Markierung und die
typisierten Direktiven. Die Auswahl mappt `TITLE` auf `opening`, `BODY` auf
`description`/`event-body`/`memory`/`rumor`/`documentation` (`memory`, `rumor`, `documentation` explizit nicht-komponierbar; `dialog` entfernt), `CHOICE_LABEL` auf `choice-preview` und
`OUTCOME` auf `reaction`.

- Locale, Kontextschnitt, `requiredFlags` und Persona-Refs filtern fail-closed;
  der hoechste deterministische Score gewinnt, Gleichstand nach
  `contributionId`. Kein RNG, keine Uhr, kein Netzwerk.
- Jeder `ContentSlot` traegt optionale `requiredContexts` (Slot-Zweck, z. B.
  `CHOICE_WELCOME` → `return`+`welcome`, `CHOICE_ASK` → `return`+`ask`,
  `OUTCOME` → `*`+`aftermath`). `ComposeRequest.requiredContexts` gilt zusaetzlich
  fuer alle Slots. Beide sind harte Filter, waehrend `contexts` weiterhin nur
  Treffer bewertet. Bei gleichem Score entscheidet ohne RNG ein FNV-1a-Hash aus
  `eventInstanceId` und Slot-ID; ohne Szenen-ID bleibt `contributionId` der
  stabile Schluessel. Das Vokabular steht in `classification.json`
  (`rival`, `welcome`, `ask`, `defuse`, `escalate`, `confront`, `watch`,
  `aftermath`).
- Fehlt ein Fragment, liefert der Composer kurze, kontextfreie Fallback-Texte.
  Sie erfinden keine Figuren, Fakten, Choice-IDs, Kosten oder Effekte.
- `isNarrativeFragment` prueft die generierte Registry auch zur Laufzeit;
  ungueltige Fragmente und Direktiven werden uebersprungen und im Ergebnis
  gemeldet. Direktiven werden nur weitergereicht, nie ausgefuehrt.
- `registry.generated.ts` wird vom NAR-10-Compiler aus den validierten
  Beitraegen erzeugt; `scripts/verify-assets.mjs` prueft JSON und TypeScript
  byte-genau.

## 9. Trigger-Vertrag (NAR-05)

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
Ledger, zieht keinen PRNG und ruft kein Netzwerk/LLM. Seit NAR-12 ruft `narrative/runtime.ts` den
Evaluator pro drainiertem Fact auf; Cooldowns bleiben Sache des Schedulers.

## 10. Event-Scheduler und Lifecycle (NAR-06)

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
verschwundenem Visitor-/Personal-Endpunkt ab. `processNarrativeBoundaryDetailed()` ruft
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

## 11. Makros (Semantik, nicht geraten)

- `€FreezeTick:200` verlaengert nur die Frist der aktiven **Event-Instanz** um 200
  fortschreitende Welt-Ticks; die uebrige Simulation laeuft weiter. Der Handler ist auf
  1..200 Ticks begrenzt und schreibt `expiresTick` in den Save.
- `€trigger Dialog '(...)'` wird als `TRIGGER_DIALOG` geparst; der String ist eine ID
  aus dem Choice-Vertrag, kein ausfuehrbarer Code. Der Handler bleibt bis zur
  Dialogfuehrung fail-closed nicht ausfuehrbar.
- Unbekannte Commands, ungueltige Parameter, nicht allowlistete IDs und fehlende
  Zielakteure werden vor jeder Wirkung verworfen; die Ablehnung erscheint als
  begrenzter Fact `COMMAND_REJECTED`. Der Compiler (NAR-10) validiert Direktiven, bevor
  irgendein Command laeuft.

## 12. Nicht-Ziele

- Kein LLM, Modell-Provider oder Netzwerk-Textaufruf im Spiel, auch nicht ausserhalb des Ticks. Agenten koennen Content bei der Repository-Arbeit erstellen; die Laufzeit nutzt ausschliesslich lokale validierte Daten.
- Keine Ausfuehrung von Code aus Texten; Commands sind deklarativ und allowlisted.
- Kein Journal als Fact-Bus, keine zweite Event-Wahrheit neben den persistenten Event-Instanzen.
- Keine Wanduhr und kein `Math.random` in Narrativ-Code (ESLint blockt beides).
- Keine unbegrenzten Pools: Facts, Historie, Erinnerungen und Events sind gedeckelt.

## 13. Persistenz

Save v10 traegt `narrative` und `rivals`. `narrative` enthaelt die Event-Instanzen, `ledgerSeq`, `houseBand`, die kanonisch sortierten gerichteten Beziehungen und die Erinnerungen der Visitor-Profile; `rivals` haelt je Rivale Haltung, Handlungsfaehigkeit, Wohlwollen, naechsten Zug, Gegenmassnahmen-Fenster, Historie (6) und Indizien (4). `demandEvent` existiert nur noch als Migrationsfeld in `SavedGame`/`migrate-narrative.ts` fuer v5–v9, nicht in `NarrativeState`. Alte v5–v9-Staende mit `demandEvent` (v5–v8 auf der Welt, v9 im Narrativ-Slice) werden beim Laden in eine aktive GLOBAL-Event-Instanz mit Restlaufzeit konvertiert; abgelaufene verfallen, eine bereits vorhandene Instanz gewinnt. v5–v9 bleiben
ladbar: fehlende Narrative-Daten werden auf leere Defaults normalisiert, kaputte Facts
und Erinnerungen verworfen, IDs monoton fortgeschrieben. Event-Instanzen, Cooldowns und der eigene Narrativ-RNG liegen seit NAR-06 in Save v9, seit NAR-15 kommen die Rivalen-Zustaende in Save v10 hinzu;
seit NAR-07 tragen Instanzen zusaetzlich `templateId`, `templateVersion` und den
angebotenen `offeredChoiceIds`-Satz. Fehlende Felder alter Staende werden auf `eventId`,
Version 1 und einen leeren Satz normalisiert; solche Events bleiben fail-closed nicht
ausfuehrbar, bis ein kompatibles Template mit gueltigen Choice-IDs vorliegt.
`COMMAND_REJECTED` ist ein normaler, begrenzter Fact in `pending`/`recent` und braucht
kein neues Save-Feld; Event-Status und `resolution` bleiben die Wahrheit fuer
Idempotenz. `EVENT_RESOLVED` traegt `eventId`, `eventKind`, `choiceId` und `outcomeId`,
ist ebenfalls ein normaler Fact und wird beim Laden schema-validiert.

## 14. Orchestrierung in Tick und WorldStore (NAR-12)

`narrative/runtime.ts` ist die einzige Bruecke von Facts zu Events. Ein Lauf ist
nicht rekursiv: `processNarrativeRuntime()` drainiert den Boundary hoechstens einmal,
wertet fuer jeden drainierten Fact die Definitionen aus `events/trigger-definitions.ts`
aus und sammelt Kandidaten. Nur Facts mit Template duerfen einen Event ausloesen;
Diagnose- und Ledger-Facts bleiben wirkungslos. `scheduleCandidates()` plant hoechstens
drei neue Instanzen pro Lauf und verhindert Live-Duplikate und Cooldowns wie bisher.
Facts aus Choice-Effekten entstehen erst nach dem Drain und werden im naechsten Lauf
verarbeitet.

`tickWorld()` ruft die Runtime genau einmal am Ende. Ausserhalb des Ticks flusht
`src/store/narrative-commands.ts` an den echten Mutationsgrenzen: nach jeder
erfolgreichen Command-Ausfuehrung sowie nach Neues Spiel, Import und Rivalenspiel.
`#emit()` bleibt Darstellung und Save und ist kein Gameplay-Handler. `spawn.ts` und
`guest-service.ts` emittieren nur noch; sie drainieren nicht selbst. `worldStore`
bleibt der alleinige Besitzer von Welt, Ledger und PRNG; `src/core` importiert ihn nie,
und `chooseNarrativeCmd()` bekommt Welt und Ledger explizit.

Das Anzeigemodell (`narrative/view.ts`) bleibt eine reine Ableitung: `GameView.narrative`
traegt aktive Szenen, Profile und seit dem Profil-/Historien-Anschluss die juengsten
zwoelf abgeschlossenen Szenen als `history` (Status, Ausgang, Teilnehmer, Abschlusstakt).
Profile umfassen Szenenteilnehmer, Figuren auf dem Floor, Figuren mit Beziehung oder
Erinnerung; das Gast-Popup oeffnet ueber `onProfile(visitorId)` direkt das Profil, und
der Journal-Tab „Geschichten“ rendert dieselbe Historie. Damit entsteht keine zweite
Log-Wahrheit neben Journal und Event-Instanzen.

## 14a. Szenen-Kontext (B1)

`narrative/composition-context.ts` ist die einzige Ableitung des Composer-Kontexts.
Sie liest `WorldState`, `Ledger`, die Event-Instanz und das Template, mutiert nichts und
liefert `contexts`, `availablePersonas`, `relationship`, `mood` und `requiredFlags`.

- **Kontext:** Der Fact mit `sourceFactId` aus `narrative.recent` gewinnt:
  `VISITOR_RETURNED` → `return`, `VISIT_ENDED` → `loss` bei `BAD`, sonst `return`,
  `VISITOR_CONFLICT` → `conflict`, `VISITOR_SERVICE` → `service`,
  `RIVAL_ACTION`/`RIVAL_ENCOUNTER` → `rival`. Fehlt der Fact (auch bei
  `sourceFactId: 0`), entscheidet `template.triggerId` und danach `template.eventId`;
  Demand-Events werden zu `demand`.
- **Personas:** nur aufgeloeste Visitor-Teilnehmer der Instanz, als Namens-Slugs;
  fehlende oder doppelte Profile erzeugen keinen Eintrag.
- **Beziehung und Stimmung:** der konkrete Fact hat Vorrang, danach die gerichtete
  Kante (bei Paaren zwischen den Besuchern, sonst zum Haus) und zuletzt die letzte
  Erinnerung des primaeren Visitors. Die Werte bleiben auf dem kontrollierten
  Vokabular (`vertrauen`, `konflikt`, `distanz`, `neutral`; `neugierig`, `angespannt`,
  `argwoehnisch`, `entschlossen`, `neutral`).
- **Flags:** `requiredFlags` sammelt nur `flag-at-least`/`flag-present` aus den
  Choice-Requirements des konkreten Templates, rekursiv durch `all`, und ist auf zwölf
  Namen begrenzt. Welt-Flags werden nie pauschal uebergeben.

`view.ts` baut die Anfrage nur noch aus diesem Ergebnis; der Ledger bleibt in der
Signatur, weil der View ihn fuer Choices haelt, die Textwahl liest aber keine Geldwerte.

## 15. Nachfrageveranstaltungen (NAR-13)

`events/demand-definitions.ts` beschreibt Neon-Nacht und Turnierabend als reine Daten:
20 beziehungsweise 16 Gaeste pro Tag, 150 Ticks Laufzeit, 0,55 Gruppen-/Erwartungszuschlag,
Starttext und eine endliche Wiederholungsgrenze. `narrative/demand-events.ts` startet
hoechstens eine davon als aktive `GLOBAL`-Instanz ohne Choices und beendet sie am
Fristtick ueber `transitionEvent` (`EXPIRED`, `DEADLINE`). `sourceFactId: 0`
kennzeichnet engine-erzeugte Events, die keinen ausloesenden Fact haben.

`demandBreakdown()`, `groupSize()` und `expectedGroupSize()` lesen ausschliesslich diese
Instanz; die Anzeige liefert `expiresTick - tick` als Restlaufzeit. Es gibt kein
`NarrativeState.demandEvent` mehr. `hydrateNarrative()` konvertiert das alte Feld aus
v5–v8 (Weltfeld) und v9 (Narrativ-Slice) in eine aktive Instanz mit Restlaufzeit;
abgelaufene Veranstaltungen verfallen, eine bereits vorhandene Instanz verhindert
Duplikate.

## NAR-15: Autonome Rivalen

Der Rivale denkt in einem eigenen, persistenten Zustand: `WorldState.rivals`
haelt je Rivale Haltung, Handlungsfaehigkeit, Wohlwollen, naechsten Zug, Historie
und Indizien. Ruf, Sicherheit und Attraktivitaet bleiben abgeleitet (`rivalState`),
damit es keine zweite Wahrheit gibt.

- **Reine Politik** (`rival-ai/policy.ts`): `decideRivalAction` liest nur Zahlen und
  Flaggen und liefert eine Absicht. Kein PRNG, keine Mutation: gleiche Eingabe,
  gleiche Absicht. Die Regeln greifen in fester Reihenfolge: Kraefte sammeln,
  Informationshandel, Sabotage, Preiskampf, Gaeste abwerben, beobachten.
- **Ein Zug je Rivale und Taktfenster** (`RIVAL_AI_LIMITS.cadence = 260`),
  fruehestens ab Tick 150; `counteredUntilTick` sperrt Gegenmassnahmen-Fenster.
- **RIVAL_ACTION-Fact**: jede Aktion erzeugt genau einen Fact mit Rivale, Aktion,
  Indiz-Flag und Zielgeraet. Der Boundary wendet daraus die gerichtete Kante
  Rivale → Haus an; der Trigger `rival-action` uebersetzt ihn in `RIVAL_MOVE`
  (Choice `CONFRONT_RIVAL` oder `WATCH_THE_MOVE`).
- **Sabotage mit Indizien statt Zufallsmalus**: Ziel ist das beste unbeschaedigte
  Geraet (Gleichstand: kleinste ID), der Schaden ist fest (12), und jeder Versuch
  schreibt einen `RivalEvidence`-Eintrag mit Tick, Tag, Geraet, Blockade und Notiz.
  Ein Guard im Dienst verhindert den Schaden, nicht das Indiz.
- **Gegenmassnahmen**: Guard verhindert Schaden, Reparatur stellt das Geraet wieder
  her, `CONFRONT_RIVAL` verschaerft den Konflikt bewusst, `WATCH_THE_MOVE` merkt
  sich den Zug. Wer die Indizien liest, kennt Taeter, Ziel und Tick.
- **Save v10**: `WorldState.rivals` liegt im Save; `SavedGame` akzeptiert v5–v10,
  `normalizeRivalMinds` fuellt fehlende Rivalen mit dem neutralen Startzustand auf.

## NAR-16: Langzeitintegration und Messungen

- `narrative-longrun.test.ts` faehrt zwei Spieltage mit Kasse, Reinigung und Bar
  und prueft nach jedem Tag alle Deckel: 48 offene Facts, 120 Kurzzeit-Facts,
  200 Beziehungen, 64 Cooldowns, 32 Szenen (8 gleichzeitig), 240 Journal- und
  2000 Archivzeilen, 6 Memories je Gast, 6 Zuege und 4 Indizien je Rivale.
  Zusaetzlich: kein Live-Event mit verwaistem Besucher, keine angebotene Choice
  ausserhalb ihres Templates, Ledger integer.
- Save/Replay: derselbe Stand plus derselbe PRNG-Zustand ergibt nach 200 weiteren
  Ticks dieselben Werte fuer Tick, Tag, bediente Gaeste, Besucherzahl, Rivalen,
  Ledger-Zeilen und Kurzzeitfenster.
- Save-Budget: ~137 KiB nach einem Spieltag, ~337 KiB nach zwei (Testbudget
  512 KiB, fester Seed). Kein Textpool
  und keine doppelte Journal-Kopie im Save; das Archiv bleibt bei 2000 Zeilen.
- Hotpath (`src/store/narrative.bench.ts`, AMD FX-6300, Volllast): `tickWorld` 0,62–1,31 ms
  je Tick bei 23–26 Besuchern und 12–13 Szenen; `processNarrativeRuntime`
  1,64–1,71 ms fuer 48 Facts. Facts entstehen nur bei Uebergaengen; hoechstens
  eine Rivalenaktion je Rivale und 260 Ticks.
- `bench:lowend`: unter Windows fehlt `taskset`, der Lauf ist eine Volllast-
  Messung ohne Kern-Pinning. Der Runden-Benchmark hat ein Zeitbudget je Spiel,
  damit langsame Hardware die Kennzahl ms/Runde liefert statt in den Timeout zu
  laufen; die 60-s-Grenze war dort der einzige rote Punkt.
- Lange Nachweise bleiben in Actions: `pnpm run ci:long` startet `long-checks.yml`
  (verify:all, Statistik, Soak 100000 Ticks, Balance 40 Tage, Benchmarks).

## 17. Agenten-Contributions: Workflow und Fehlerfaelle

Jeder abgeschlossene Turn liefert genau einen Beitrag unter
`content/narrative/contributions/<datum>-<turn>.json` mit den Feldern `agentId`,
`turnId`, `contributionId`, `role`, `locale`, `slot`, `function`, `contexts`,
`tone`, `mood`, `relationship`, `personaRefs`, `flags`, `text` und `directives`.
Die Klassifizierung stammt aus `content/narrative/vocabulary/classification.json`;
`content/narrative/turns/manifest.json` bindet jeden Turn an genau eine
`contributionId`. Das Inbox-Verzeichnis ist fail-closed: nur sichtbare
`*.json`-Dateien nach `<datum>-<turn>.json` werden gelesen; Unterordner,
Symlinks, versteckte Namen, `.md`/`.tmp`/`.bak` und anders benannte
JSON-Dateien meldet das Assets-Gate als `ERR-4022`, statt sie zu ignorieren.
Manifest-1:1 und Inhalts-Hash bleiben die alleinige Vollstaendigkeitspruefung.
Der Pre-Commit-Hook ruft diesen Validator vor dem `node_modules`-Fruehausstieg
auf; gestagte Narrative-Dateien, die im Arbeitsbaum noch unstaged veraendert
sind, blockieren den Commit mit `ERR-4022`, damit nie ein anderer Inhalt
geprueft wird als der Commit. Seit A1 laufen auch Inventur, Doku-Marker,
Doku-Gate und LOC vor dem Fruehausstieg; nur Dependency-Matrix und Testkatalog,
die `typescript` aus `node_modules` laden, bleiben dahinter. `test:affected`
behandelt jede JSON-Aenderung unter `content/narrative/**` als Codeaenderung und
waehlt ausschliesslich den Governance-Test
`src/core/governance/__tests__/narrative-content.test.ts`. `pnpm run narrative:compile -- --write` erzeugt daraus
`content/narrative/registry/fragments.json` und den Laufzeit-Spiegel
`composer/registry.generated.ts`; `pnpm run narrative:check` vergleicht beide und
meldet die Fragmentzahl samt Inhalts-Hash. Das Assets-Gate (`ERR-4022`) verwirft
unbekannte Slots oder Funktionen, doppelte IDs, fehlende Manifest-Eintraege,
kaputte Makros und eine vom Compiler abweichende Registry. Texte sind Darstellung:
kein Makro ersetzt eine Spielregel, und im Spiel gibt es keine LLM- oder
Provider-Anbindung.

## 18. Social-Plugin (Zielbild)

Heute traegt die Engine Beziehungen zwischen Besuchern, Haus und Rivalen. Das
Zielbild ist eine **Social-Komponente als Plugin**: dieselben Facts, Erinnerungen
und gerichteten Kanten zwischen Figuren, die weder Gast noch Haus sind –
Nachbarn, Kollegen, Freunde, Familienmitglieder. Das Plugin ergaenzt Aktuere und
Fact-Quellen, nicht die Mechanik: `Visitor` bleibt die persistente Identitaet,
`relationships` bleibt die einzige Kantenwahrheit, der Boundary bleibt der einzige
Drain, und der Composer liest weiter nur Kontext, Persona, Beziehung und Stimmung.
Ein neuer Ort liefert Fakten und Templates; er bringt keine zweite
Erzaehlmaschine mit. Der Ledger wird parallel um **Ressourcen nach Bedarf**
erweitert (Zeit, Ruf, Vorraete, Aufmerksamkeit); jede bleibt eine gebuchte Zeile,
keine zweite Zahlenwahrheit. Das passt zur Produktgrenze in
`docs/PRODUCT.md`: Das Casino ist Startpunkt und Testumgebung, die Stadt ist das
Ziel.
