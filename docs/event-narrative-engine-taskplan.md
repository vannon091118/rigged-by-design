# Rigged by Design – sequenzieller Taskplan für die Dynamic Narrative Engine

**Repository:** `vannon091118/rigged-by-design`  
**Geprüfter Stand:** `main` · `708d31c744f8bb470d5a36ee923f60198248f057` · Version `0.3.64`  
**Save-Format:** v8  
**Ziel:** Eine modulare, datengetriebene Narrative Engine, die Spielzustände, Charaktergedächtnis, Besucherbeziehungen, Wirtschaft und autonome Rivalen zu fortlaufenden Geschichten verbindet. Content-Beiträge von Agenten werden semantisch klassifiziert, zur Laufzeit kombiniert und können validierte Event-Commands tragen. Das LLM formuliert ausschließlich Darstellungstext; Spielregeln und Effekte bleiben deterministisch und code-kontrolliert.

---

## 1. Code-Befund als Ausgangspunkt

### Bereits vorhanden

| Bereich | Tatsächlicher Code | Vorhandene Fähigkeit |
|---|---|---|
| Temporärer Gast | `src/core/sim/types-model.ts`, `traits.ts`, `needs.ts`, `emotion.ts`, `guest-choice.ts`, `guest-play.ts` | Persona, Budget, Laune, Geduld, Sucht, Bedürfnisse, Spielverhalten und Reaktionen |
| Persistenter Besucher | `src/core/sim/visitors.ts` | ID, Name, Persona, Besuchszahl, letzter Besuch, ein aggregierter Erlebniswert; Rückkehrchance und Wiedererkennung |
| Ereignisprotokoll | `src/core/sim/journal.ts` | Typisierte Journal-Einträge, Ursache/Wirkung, Akteursreferenzen, Live-Puffer mit 240 und Archiv mit 2.000 Einträgen |
| Geld und Bilanzen | `src/core/economy/ledger.ts`, `src/core/sim/economics.ts`, `src/core/sim/money.ts` | Ledger als Geldwahrheit, Buchungszeilen, Betriebskennzahlen und offene Verbindlichkeiten |
| Nachfrage und Events | `src/core/sim/demand.ts` | Geplante Gästeankünfte, Nachfragequellen, Unternehmensstufen und zwei fest definierte Events (`NEON_NACHT`, `TURNIER_ABEND`) |
| Rivalen | `src/core/sim/rivals.ts`, `foreign-floor-tick.ts`, `src/store/foreign-floor-commands.ts` | Drei statische Betreiber, Maschinen/Regeln, deterministische Reputationsdrift, besuchbare Floors und Spielerjobs |
| Simulation | `src/core/sim/tick.ts` | Zentraler Tick-Ablauf für Gäste, Personal, Konflikte, Nachfrage und Fremd-Floors |
| Zustandsbesitz | `src/store/world-store.ts` | Ein Besitzer für WorldState, Ledger, PRNG, Uhr, Save und Snapshot-Erzeugung |
| UI-Vertrag | `src/store/types.ts`, `snapshot.ts`, `src/ui/*` | UI liest `GameView`-Snapshots und schickt Aktionen über Store-Commands |

### Konkrete Lücken

1. **Visitor ist noch kein fortbestehender Charakter.** `Visitor` speichert nur `id`, `name`, `persona`, `visits`, `lastSeenTick` und optional `experience`. Beim Rückkehr-Spawn werden die temporären Guest-Werte durch `makeGuest()` neu erzeugt. Es gibt keine persönlichen Erinnerungen, Präferenzen, Beziehungswerte oder erzählerischen Flags.
2. **Die Besucher-Registry ist auf 40 Einträge begrenzt und entfernt aktuell stumpf den ältesten `lastSeenTick`.** Eine spätere Story-Engine darf dadurch keine Figur verlieren, die noch in einer aktiven Geschichte oder Beziehung referenziert wird.
3. **Das Journal ist kein vollständiger Simulations-Fact-Stream.** Einige Abläufe schreiben Journal-Einträge, andere setzen nur `world.lastEvent` oder verändern direkt Zustand. `settleMoneyJournal()` kopiert Ledger-Buchungen genau einmal ins Journal. Das Journal ist Spielerhistorie, kein hinreichender Trigger- oder Memory-Feed.
4. **`demandEvent` ist ein zweites, kleines Event-System.** Es kann genau zwei Event-Arten starten/beenden und wirkt auf die Nachfrage. Die neue Engine darf nicht dauerhaft als paralleler zweiter Scheduler daneben existieren.
5. **Rivalen handeln nicht autonom.** `rivals.ts` enthält statische Betreiberdefinitionen und berechnet Reputation aus `(Rivale, Tick)`. Foreign Floors simulieren vor allem den Spielerjob, keine eigenständige Rivalenstrategie.
6. **Es gibt keine erkennbare Narrative Engine, Event-Template-Registry, Content-Registry, LLM-Anbindung oder Event-Command-DSL.** Die vorhandene `AGENTS.md` ist eine Entwicklungsanweisung, kein Content-Pool.
7. **UI-Snapshots enthalten keine Visitor-Registry.** `GameView` zeigt aktuelle Gäste, Journal und Nachfrage, aber keine vollständigen persistenten Besucherprofile.

### Architekturgrenzen, die erhalten bleiben

- `src/core/` bleibt headless: kein DOM, Pixi, React, `fetch` oder Provider-SDK.
- `WorldStore` bleibt alleiniger Besitzer von Welt, Ledger, PRNG, Save und Uhr.
- `GameView` bleibt abgeleitet und schreibgeschützt; UI-State erzeugt keine zweite Wahrheit.
- Geldwirkungen laufen ausschließlich über das Ledger und bestehende Buchungspfade.
- `Journal` bleibt die lesbare Historie. Narrative Facts und Charaktergedächtnis bekommen eigene Datenverträge.
- Simulation und Entscheidungen bleiben deterministisch. Der globale Spiel-PRNG darf durch Narrative-/Textauswahl nicht unbemerkt verschoben werden.

---

## 2. Zielarchitektur

```text
Simulation / Store-Commands / Ledger / Rivalen
                    │
                    ▼
             Typed Sim Facts
        (nur echte Zustandsübergänge)
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
   Character Memory      Narrative History
   Relationships         Story Flags
          │                   │
          └─────────┬─────────┘
                    ▼
          Trigger Evaluator
       (Facts + Kontext + Regeln)
                    │
                    ▼
          Event Scheduler
 (Priorität, Cooldown, Duplikate,
  Parallelität, Fristen, Ketten)
                    │
                    ▼
         Event Instance / Template
          │                   │
          ▼                   ▼
    Choice Contract       Text Slots
    + Command IDs              │
          │                    ▼
          │             Content Composer
          │          Registry + optional LLM
          │                    │
          └──────────┬─────────┘
                     ▼
              Narrative Runtime
             UI zeigt Text/Choices
                     │
           Spieler wählt Choice-ID
                     │
                     ▼
          Command Validator/Executor
        (Allowlist, Schema, Vorprüfung)
                     │
                     ▼
              Simulation State
                     │
                     └──── neue Facts ────► …
```

### Verbindliche Verantwortlichkeiten

| Modul | Verantwortung | Darf nicht übernehmen |
|---|---|---|
| Sim Facts | Maschinenlesbare, einmalige Tatsachen aus Zustandsübergängen | UI-Text, Trigger-Entscheidung, freie Ausführung |
| Memory | Verdichtete persönliche/global relevante Vergangenheit | Journal duplizieren, beliebige Fließtexte als Wahrheit speichern |
| Relationships | Beziehungen zwischen persistenten Akteuren | Gästebeziehungen in UI-State halten |
| Trigger Evaluator | Prüfen, welche Event-Definitionen zu Facts und Kontext passen | Weltzustand verändern oder Text generieren |
| Scheduler | Reihenfolge, Priorität, Cooldowns, Duplikatschutz und Event-Lifecycle | Spielmechanik frei erfinden |
| Event Templates | stabile Event-ID, Teilnehmer, Anforderungen, Choices und erlaubte Effekte definieren | LLM-Ausgaben als Spielregeln behandeln |
| Command Registry | erlaubte Aktionen, Parameterprüfung und Ausführung | beliebiges JavaScript aus Content ausführen |
| Content Registry | Textfragmente, Rollen, semantische Flags, Herkunft und Makros | Spielmechanik oder Choice-Effekte besitzen |
| Composer | passende Textfragmente wählen und optionale LLM-Formulierung liefern | Choice-IDs, Kosten, Effekte oder Trigger entscheiden |
| Narrative UI | Events, Dialoge, Profile und Choices anzeigen | eigene Event-/Memory-Wahrheit halten |

### Datenfluss und Persistenz

- Neue persistente Narrative-Daten liegen gesammelt in `WorldState.narrative`, nicht verteilt in zahlreichen losen Top-Level-Feldern.
- Persistent character identity bleibt in der Visitor-Domäne. Ein aktiver `Guest` bleibt die temporäre Instanz eines Besuchs und referenziert weiter `visitorId`.
- `WorldState.narrative` hält mindestens: Fact-Sequenz/Queue, begrenzte Fact-Historie, aktive und abgeschlossene Event-Instanzen, Story-Flags, Cooldowns, Relationship-Daten sowie Narrative-Randomness/Determinismus-Metadaten.
- Persönliche Erinnerungen werden kompakt und begrenzt am persistenten Visitor-Profil oder in einer klar referenzierten Memory-Collection gespeichert. Keine Kopie des gesamten Journals pro Gast.
- Aktive Events und ihre Choice-Verfügbarkeit müssen einen Save-/Load-Roundtrip überleben.
- Der Save wird wegen des neuen persistenten Zustands auf **v9** gehoben. v5–v8 bleiben ladbar.

### Dynamisch heißt nicht unkontrolliert

Die Engine bekommt keine starre Liste handgeschriebener fertiger Events als einzige Content-Quelle. Sie kombiniert:

- strukturelle Event-Templates mit stabilen IDs und testbaren Choice-Verträgen,
- echte Sim-Facts und langfristige Erinnerungen,
- semantisch markierte Textfragmente aus der Registry,
- kompatible Dialog-, Reaktions-, Übergangs- und Choice-Preview-Fragmente,
- optionale Rivalenaktionen und Ereignisketten.

Die Templates definieren den **mechanischen Rahmen**, nicht jeden fertigen Fließtext. Die Content-Daten liefern die variable Erzählung. Die Engine muss verschiedene Fragmente anhand ihrer Flags sinnvoll kombinieren und Konflikte/Unverträglichkeiten erkennen.

---

## 3. Gate- und Arbeitsregeln für alle Tasks

### Exakte bestehende Gate-Verträge

- `scripts/loc-budgets.mjs`: `src/core/**` hat **200 LOC Cap / 150 Hot Zone**, Tests **240 / 180**. Die Hot Zone ist die relevante Zielgröße; neue Module sollen möglichst darunter bleiben. Keine neue LOC-Ausnahme.
- Jede Testdatei braucht `@test-target` und einen existierenden `@error-code`-Eintrag.
- Jeder einzelne `it()`-/`test()`-Callback braucht eine eigene echte Assertion und muss einen Bezug zum deklarierten Testziel haben.
- Keine festen numerischen PRNG-Seeds in Tests; `randomSeed()` verwenden.
- Keine Snapshot-, reine `toBeDefined()`-/`toBeTruthy()`- oder Tautologie-Tests als Qualitätsnachweis.
- Neue Fehlercodes zuerst in `src/core/governance/error-codes.ts` und `docs/ERROR_CATALOG.md` registrieren.
- Neue Testdateien werden über `@test-target` und `scripts/lib/test-catalog.mjs` automatisch einem System/einer Beweisklasse zugeordnet. Danach `npm run catalog`; der Verify-Lauf prüft den generierten Katalog.
- `verify` bleibt lesend. Reparaturen ausschließlich über `npm run fix`.
- Während eines Agenten-Turns keine direkten `npm run test`, `npm run test:ci` oder `npm run verify:all`-Zwischenläufe. `npm run verify:quick` ist als Entwicklungsfeedback erlaubt. Der Testlauf gehört an das Ende des Turns.

### Tatsächliche Pipeline (Code, nicht nur Dokumentation)

`pipeline-plan.mjs` definiert `quick` mit `lint`, `check:loc`, `typecheck`, `test-quality`, `dead-code`, `deps-matrix`, `catalog`, `assets` und `tests`. Der Test-Gate erhält `RBD_TEST_PROFILE=quick`; `vite.config.ts` schließt dabei `round-rtp-*`, `soak` und `slot-session-rtp` aus. `full`/`release` ergänzen Audit und Production-Build. `verify:all` bleibt der vollständige Nachweis; der Gate-Runner führt unabhängige Gates parallel aus und cached nur identische Bäume/Profile.

**Bestehende Drift, nicht stillschweigend Teil dieses Vorhabens:** `poker-distribution.test.ts` und `balance-operating.test.ts` sind im Testkatalog als `statistics` klassifiziert, fehlen aber in `vite.config.ts` in `quickExclude`; sie können deshalb trotz Quick-Profil lokal mitlaufen. `poker-distribution` läuft zusätzlich im Long-Checks-Workflow. Außerdem listet die Dokumentation den `assets`-Gate nicht überall so vollständig wie `pipeline-plan.mjs`. Das ist vor Projektbeginn als bestehende Gate-/Dokumentationsabweichung zu kennen; die Narrative-Tasks sollen sie nicht versehentlich vergrößern.

### Gate-Zuordnung für diesen Taskplan

| Art des Tasks | Lokaler Nachweis am Turn-Ende | Vollständiger Nachweis |
|---|---|---|
| Reine Core-Module ohne Save-/RNG-/Ledger-Migration | `npm run verify:quick` oder `npm run turn:finish` | CI läuft weiterhin `verify:all` auf dem PR/Push |
| Neue persistente World-/Save-Felder oder Migration | `npm run turn:finish:full` bzw. `npm run verify:all` am Task-Ende | Pflicht, weil Save-/Migration-Code geändert wird |
| Command-Effekte mit Ledger, RNG oder Geld | Vollprofil, sobald Ledger-/RNG-/Save-Invarianten berührt werden | Pflicht, plus gezielte Ledger-Assertions |
| Content-Assets/Compiler/Registry | `verify:quick`; Content-Validierung in bestehendem `assets`-Gate | `verify:all` in CI |
| UI/Snapshot/Store-Integration ohne Persistenzänderung | `verify:quick` | CI `verify:all` |
| Tick-Hotpath/Rivalenautonomie/Simulation über viele Tage | `verify:quick` je Task; kein lokaler Soak während der Arbeit | an Integrationsmeilensteinen `npm run ci:long` (Soak, Balance, Benchmarks) |

**Sequenzregel:** Die nachfolgenden NAR-Tasks sind voneinander abhängig und werden in dieser Reihenfolge umgesetzt. Ein Task wird abgeschlossen und sein Gate-Nachweis festgehalten, bevor der nächste startet. Die Pipeline selbst bleibt unverändert: kein neues paralleles Testframework und keine Abschwächung bestehender Gates. Der bestehende GitHub-Main-Schutz/PR-Weg bleibt maßgeblich; `AGENTS.md` und `docs/CI-GATES.md` beschreiben den Delivery-Pfad nicht ganz widerspruchsfrei.

---

## 4. Sequenzieller Implementierungsplan

Jeder NAR-Punkt ist ein eigenständiger Agenten-Task/Turn. Pfade sind Zielmodule und Integrationsstellen, keine Aufforderung, bestehende große Dateien weiter aufzublähen.

### NAR-00 – Architekturvertrag und Content-Beitragsformat festlegen

**Ziel:** Vor dem Code ein präzises gemeinsames Modell für Facts, Memory, Event-Lifecycle, Choices, Commands, Textbeiträge und LLM-Grenze festlegen.

**Arbeiten**
- `docs/NARRATIVE-ENGINE.md` als Architekturvertrag anlegen.
- Datenfluss, Event-Statusübergänge, Teilnehmerreferenzen, Cooldown-Scope, Event-Priorität, Mehrfachaktivität, Choice-Fristen, Duplikatschutz und begrenzte Historie definieren.
- Die Trennung `Guest` (Besuch) vs. `Visitor` (persistente Figur) festschreiben.
- Textbeitrag als eigenständigen Datensatz definieren: `agentId`, `turnId`, `contributionId`, `role`, `locale`, semantische Flags, Text und optionale Direktiven.
- `AGENTS.md` um die Pflicht ergänzen, dass jeder Agent pro abgeschlossenem Turn genau einen Textbaustein beiträgt. Solange die Runtime-Registry noch nicht verfügbar ist, landen Beiträge in einem klaren Inbox-/Contribution-Verzeichnis und werden nicht in Simulationscode oder `AGENTS.md` eingebettet.
- Einen Turn-/Contribution-Nachweis vorsehen: eine Turn-ID hat genau einen Beitrag; doppelte oder fehlende Beiträge für registrierte Turns werden später durch den Validator gefunden.
- Die Semantik der Beispielmakros `€FreezeTick:200` und `€trigger Dialog '(...)'` ausdrücklich festlegen. Insbesondere muss `FreezeTick` seine Einheit und seinen Wirkungsbereich erhalten (z. B. globale Simulationspause vs. zeitweilig eingefrorene Teilzustände); nicht anhand des Namens raten.

**Zielbereiche:** `docs/NARRATIVE-ENGINE.md`, `AGENTS.md`, zunächst `content/narrative/contributions/`.

**Nachweis:** Architekturdokument beschreibt alle Zustands- und Kontrollflüsse sowie explizite Nicht-Ziele: kein LLM in `tickWorld`, keine Ausführung von Code aus Texten, kein Journal als Fact-Bus.

**Gate:** `verify:quick` am Turn-Ende. Noch keine Save-Migration.

---

### NAR-01 – Persistente Narrative-Domäne und Save v9

**Ziel:** Eine einzige persistente Datenstruktur schaffen, auf der alle folgenden Module aufbauen können.

**Arbeiten**
- Neue, getrennte Narrative-Typen anlegen, z. B. unter `src/core/sim/narrative/types.ts` und bei Bedarf `state.ts`.
- `WorldState` um ein zusammenhängendes `narrative`-State-Objekt erweitern. Darin liegen später Fact-Sequenz/Queue, begrenzte Fact-Historie, aktive/abgeschlossene Events, Story-Flags, Cooldowns, Beziehungen und ein vom Hauptspiel-PRNG getrennter Narrative-Auswahlzustand.
- Die persistenten Visitor-Profile um klar getrennte Character-/Memory-Daten erweitern. `Guest` bleibt die temporäre Besuchsinstanz.
- Alle persistenten Datentypen als JSON-serialisierbare Daten definieren: keine Funktionen, Maps, Sets, Provider-Objekte oder UI-Instanzen im Save.
- `createWorld()` initialisiert einen vollständigen leeren Narrative-State.
- Save auf v9 heben: neuer Key, v8 als Legacy-Key, `replaySave()` akzeptiert v5–v9, `hydrateWorld()` ergänzt sichere Defaults und validiert IDs/Referenzen.
- `toSavedGame()` serialisiert die Narrative-Daten vollständig. Keine parallele Speicherung im UI.
- Migrationen für aktive Alt-Events berücksichtigen: bestehende `demandEvent`-Daten aus v8 müssen im späteren Konsolidierungsschritt verlustfrei überführbar bleiben.

**Zielbereiche:** `src/core/sim/types.ts`, `types-model.ts` oder neue fachliche Typdateien, `templates.ts`, `src/store/save.ts`, `src/store/migrate.ts`, Save-Tests.

**Nachweis:** v5/v6/v7/v8 laden weiterhin; v9 Roundtrip bewahrt alle neuen Felder; fehlerhafte/fehlende optionale Felder werden konsistent normalisiert; zwei aus demselben Save geladene Welten laufen nach 100+ Ticks identisch weiter.

**Gate:** **Full Gate verpflichtend** (`turn:finish:full` / `verify:all`), da Save-/Migrationscode geändert wird.

---

### NAR-02 – Typed Sim Facts und persistente Fact-Queue

**Ziel:** Einen strukturierten, einmaligen Ereignisstrom für die Narrative Engine schaffen, ohne das Journal dafür umzubauen.

**Arbeiten**
- Discriminated-Union-Vertrag für Facts definieren: stabile Fact-ID, `tick`, `day`, Typ, Subject-/Actor-Referenzen und typisierte Nutzdaten.
- `emitFact()`/`enqueueFact()` und getrennte Funktionen zum Lesen/Bestätigen/Verwerfen implementieren.
- Queue-Verarbeitung idempotent machen: ein Fact darf nach Save/Load oder erneutem Flush nicht doppelt verarbeitet werden.
- Begrenzte `recentFacts`-Historie für kurze Ketten/Trigger bereitstellen; langfristige persönliche Erinnerungen bleiben im Memory-Modul.
- Fact-Referenzen dürfen auf nicht mehr existierende Gäste/Objekte verweisen; Reader müssen solche Referenzen sicher behandeln.
- Journal und Facts getrennt halten: Ein Journal-Eintrag kann aus demselben Simulationsvorgang entstehen, ist aber weder Voraussetzung noch Ersatz für einen Fact.
- Ledger-Facts über einen eigenen monotonen Cursor aus `ledger.entriesSince()` ableiten. `journaledSeq` und Narrative-Fact-Cursor dürfen nicht dieselbe Verarbeitung gegenseitig überspringen.

**Erste Fact-Kategorien:** Besucher erstmals gesehen/zurückgekehrt, Besuch beendet, Stimmungsschwelle überschritten, Spielresultat-Kategorie, Konflikt gestartet/beendet, Unternehmensstufe erreicht, Bilanz-/Liquiditätsschwelle überquert, Gerät beschädigt/repariert.

**Zielbereiche:** `src/core/sim/narrative/facts.ts`, `fact-queue.ts`, `fact-types.ts` sowie kleine Publisher an den jeweiligen Simulationsursachen.

**Nachweis:** stabile ID-Reihenfolge, keine Duplikate nach wiederholtem Flush, Queue übersteht Roundtrip, Begrenzung funktioniert, ungültige Referenz bricht die Simulation nicht.

**Gate:** `verify:quick`; bei zusätzlicher Änderung von Save-Feldern erneut Full Gate.

---

### NAR-03 – Charaktergedächtnis und echte Stammgast-Progression

**Ziel:** Besucher werden zu persistenten Figuren statt zu wiederverwendeten Namen/Personas.

**Arbeiten**
- Visitor-Profil um dauerhafte, spielrelevante Eigenschaften ergänzen: stabile Charaktermerkmale, Vorlieben/Abneigungen, wiederkehrende Interessen, Besuchs-/Erlebnisverlauf und narrative Flags.
- Erinnerungen aus ausgewählten Facts ableiten. Eine Erinnerung enthält strukturierte Bedeutung (Typ, beteiligte IDs, Zeitpunkt, Valenz/Tags, Referenzen), nicht bloß eine kopierte Journal-Zeile.
- Beim Rückkehr-Spawn ausgewählte persistente Eigenschaften und Erinnerungswirkungen auf den neuen Guest übertragen. Temporäre Bedürfnisse/Position/Queue-/Besuchsstatus bleiben neue Besuchsdaten.
- Das bisherige `experience`-Aggregat als Feedbacksignal weiterverwenden oder sauber in eine nachvollziehbare Erlebnisbewertung überführen; keine doppelte Quelle für Zufriedenheit einführen.
- VISITOR_CAP-Retention ändern: aktive Event-Teilnehmer, offene Geschichten und referenzierte Beziehungen dürfen nicht stumpf per LRU gelöscht werden. Nicht mehr relevante Profile können nach einer klaren Retention-Regel verdichtet/archiviert werden.
- Profil- und Memory-Grenzen als Datenkonfiguration/konstante Policy führen, nicht quer in Tick-Logik verteilen.

**Zielbereiche:** `src/core/sim/visitors.ts` in kleine Zuständigkeiten zerlegen, `narrative/memory-*`, `spawn.ts`, `guest-service.ts`, Visitor-Typen und Tests.

**Nachweis:** Ein Stammgast erinnert sich nach Save/Load an ein früheres markantes Erlebnis; seine Identität bleibt gleich, seine temporären Guest-Werte werden nicht blind aus dem letzten Besuch kopiert; aktive Story-Referenzen verhindern Eviction; normale Retention bleibt begrenzt.

**Gate:** **Full Gate verpflichtend**, weil neue persistente Visitor-Felder und Migrationen betroffen sind.

---

### NAR-04 – Beziehungen zwischen Gästen und Akteuren

**Ziel:** Aus einzelnen Besucherprofilen ein soziales System machen, das spätere Ereignisse tragen kann.

**Arbeiten**
- Beziehungsmodell mit stabilen Akteurs-IDs und normalisierter Paarreferenz definieren.
- Mindestens unterschiedliche Dimensionen abbilden, die nicht synonym sind (z. B. Vertrauen, Sympathie, Konflikt/Feindschaft, Einfluss). Skalen und Änderungen zentral konfigurieren.
- Begegnungen, gemeinsame Erlebnisse, Streit, Unterstützung und Versprechen als Fact-getriebene Beziehungsänderungen verarbeiten.
- Beziehungen nicht in zwei Visitor-Profilen doppelt speichern. Eine kanonische Beziehung hat genau einen Besitzer.
- Beziehungen können zu späteren Triggerbedingungen und Charakterreaktionen beitragen.
- Begrenzung/Retention und Referenzbereinigung definieren, wenn Visitor-Profile archiviert werden.

**Zielbereiche:** `src/core/sim/narrative/relationships/` mit getrennten `types`, `update`, `queries`.

**Nachweis:** gleiche Faktenfolge erzeugt gleiche Beziehung; Beziehung ist nach Save/Load identisch; zwei Akteure können unterschiedliche, gerichtete Beziehungen besitzen, wenn die Domäne dies verlangt.

**Gate:** `verify:quick`; bei Save-Schema-Änderung Full Gate.

---

### NAR-05 – Trigger-Definitionen und Condition Evaluator

**Ziel:** Beliebige sinnvolle Simulationskontexte auswerten, ohne pro Event neue Sonderlogik in `tick.ts` einzubauen.

**Arbeiten**
- Trigger-Vertrag erstellen, der Facts, Akteure, Zeitfenster, Charakterwerte, Memory-Referenzen, Beziehungen, Unternehmens-/Casinozustand und wirtschaftliche Kennzahlen abfragen kann.
- Bedingungen deklarativ und schema-validierbar ausdrücken (AND/OR, Vergleich, Fact-Typ, Schwellenübergang, Existenz/Abwesenheit eines Flags, Akteur-Selector, Historienfenster).
- Evaluator als reine Funktion aufbauen: Eingabe ist ein Snapshot/Context plus Triggerdefinition; Ausgabe ist Match/Nicht-Match plus aufgelöste Teilnehmer und erklärbare Match-Gründe.
- Keine versteckten Side Effects und keine Netzwerk-/LLM-Aufrufe.
- Trigger dürfen nicht bloß `guest.mood < 20` bei jedem Tick auslösen. Schwellenübergänge und Fact-ID/Cooldown bilden die Wiederholungssperre.
- Definitionen müssen neue Triggerquellen aufnehmen können, ohne den Evaluator umzuschreiben.

**Zielbereiche:** `narrative/triggers/types.ts`, `predicates.ts`, `evaluate.ts`, `context.ts`.

**Nachweis:** Tests für alle Operatoren, Kombinationen, fehlende Referenzen, Grenzwerte, historische Bedingungen und Zustandsübergänge; identischer Input liefert identisches Ergebnis.

**Gate:** `verify:quick`.

---

### NAR-06 – Event Scheduler, Lifecycle und Ereignisketten

**Ziel:** Matches in verwaltete, fortlaufende Event-Instanzen überführen.

**Arbeiten**
- Scheduler mit Priorität, Fairness, Cooldown, einmaligen/mehrmaligen Auslösungen und getrennten Scopes (global, Visitor, Akteurspaar, Rivale) erstellen.
- Event-Lifecycle als State Machine definieren, z. B. `eligible → offered/active → resolved/expired/cancelled`; gültige Übergänge zentral prüfen.
- Aktive Event-Instanzen mit Event-ID, Teilnehmern, Start-/Ablaufzeit, Context-Referenzen, aktuellem Schritt und Status persistieren.
- Mehrere parallele Geschichten unterstützen, aber pro Event-/Teilnehmerkombination Duplikate verhindern.
- Ereignisketten über Story-Flags, frühere Events, Memory-Referenzen und Choice-Ergebnisse verbinden.
- Veraltete Events abbrechen/aktualisieren, wenn Teilnehmer nicht mehr existieren oder Voraussetzungen entfallen.
- Event-Auswahl darf weder den globalen Spiel-PRNG verbrauchen noch per `Date.now()`/`Math.random()` erfolgen. Bei mechanischer Zufallsauswahl wird ein eigener persistenter Narrative-Zufallszustand verwendet.
- Pro Tick/Boundary begrenzte Arbeit; keine Vollscans aller historischen Facts und aller Textbausteine in jedem 520-ms-Tick.

**Zielbereiche:** `narrative/scheduler/`, `event-lifecycle.ts`, `cooldowns.ts`, `event-history.ts`.

**Nachweis:** Prioritätsordnung, Cooldowns, Mehrfachaktivität, Ablauf, Abbruch, Folgeereignis und Save-/Load-Fortsetzung sind getestet; wiederholtes Auswerten desselben Facts erzeugt keine Doppelinstanz.

**Gate:** `verify:quick`; bei neuen persistierten Lifecycle-Feldern Full Gate.

---

### NAR-07 – Event Templates und stabile Choice-Verträge

**Ziel:** Mechanische Struktur testbar definieren, während Text und konkrete Formulierungen variabel bleiben.

**Arbeiten**
- Event-Template-Vertrag mit stabiler `eventId`, Kontext-/Teilnehmerauflösung, Content-Slots, Triggerbezug, Priorität und erlaubten Choices definieren.
- Jede Choice hat stabile `choiceId`, Verfügbarkeitsbedingungen, optionale Kosten/Anforderungen, eine deklarative Effektliste und ein Ergebnis-/Folgeevent-Mapping.
- Choice-ID und tatsächlicher Effekt stammen ausschließlich aus dem Template/Code-Vertrag. Text/LLM darf Choices nur beschreiben und Vorschauen formulieren.
- Event-Instanz speichert die Template-Version/ID und den zur Anzeige angebotenen Choice-Satz, sodass ein später geänderter Content-Pool aktive Saves nicht unbemerkt umdeutet.
- Choice-Validierung prüft beim Anklicken erneut, ob Event noch aktiv, Choice noch verfügbar und Kosten/Voraussetzungen noch gültig sind.

**Zielbereiche:** `narrative/events/template-types.ts`, `definitions/`, `choices/contract.ts`, `choices/eligibility.ts`.

**Nachweis:** Choice-IDs sind stabil; manipulierte/unbekannte Choice-IDs werden abgewiesen; Textänderungen verändern keine mechanischen Effekte; abgelaufene Choices sind nicht ausführbar.

**Gate:** `verify:quick`.

---

### NAR-08 – Event-Command-DSL und Allowlist

**Ziel:** Textbeiträge dürfen Commands deklarieren, aber niemals beliebigen Code ausführen.

**Arbeiten**
- Eine typisierte Command-Liste mit ID, Parameterschema, Ziel-/Scope-Regeln, Voraussetzungen und Handler-Vertrag anlegen.
- Die Makrosyntax (u. a. `€FreezeTick:200`, `€trigger Dialog '…'`) in einen Parser/AST übersetzen. Makros sind keine direkt ausführbaren Textzeilen.
- Unbekannte Commands, ungültige Parameter, nicht erlaubte Kombinationen und nicht deklarierte Zielreferenzen beim Kompilieren ablehnen.
- Runtime führt nur validierte Command-ASTs aus registrierten Handlern aus; kein `eval`, kein dynamischer Import, kein Funktionsname aus Text.
- Event-Template legt fest, welche Commands in welchem Kontext zulässig sind. Ein Agentenfragment kann keine zusätzlichen Spielwirkungen einschmuggeln, die das Template nicht freigegeben hat.
- Command-Batches zunächst vollständig validieren (Preflight); Effekte anschließend kontrolliert anwenden. Geld-/Ledger-Commands benutzen ausschließlich bestehende Ledger-Funktionen und Mikroeinheiten.
- Wiederholte Ausführung derselben Event-Choice muss durch Event-/Command-ID idempotent abgesichert sein.
- `FREEZE_TICK` erst implementieren, wenn die in NAR-00 dokumentierte Semantik eindeutig ist. Der Handler muss in den bestehenden Zeit-/Store-Vertrag passen und darf den Scheduler nicht unzählbar blockieren.

**Command-Familien:** Dialog/Event-Steuerung, Guest/Visitor/Relationship, Casino-/Gerätezustand, Ledger-/Wirtschaft, Nachfrage, Personal, Rivalen, Story-Flags und Zeitsteuerung.

**Zielbereiche:** `narrative/commands/types.ts`, `registry.ts`, `parse-directives.ts`, `validate.ts`, `preflight.ts`, `execute.ts`, kleine Handlerdateien pro Domäne.

**Nachweis:** bekannte Befehle parsen; unbekannte/fehlerhafte werden fail-closed verworfen; Parametergrenzen greifen; Choice-Command führt den Effekt einmal aus; Ledgerintegrität bleibt gültig; keine Ausführung von Code/Text.

**Gate:** `verify:quick`; **Full Gate**, sobald Ledger-, RNG- oder Save-Invarianten geändert werden.

---

### NAR-09 – Content Registry, Agentenbeiträge und semantische Klassifizierung

**Ziel:** Einen wachsenden Textpool aufbauen, ohne Texte und Prompts in Simulationscode einzubetten.

**Arbeiten**
- Eigenständiges Content-Verzeichnis aufbauen, z. B. `content/narrative/contributions/`, `content/narrative/registry/` und separate Schema-/Vocabulary-Dateien.
- Content-Fragmente bekommen mindestens stabile ID, `agentId`, `turnId`, Rolle/Slot, Sprache, Text, semantische Flags, erlaubte Kontextarten und optionale deklarative Commands.
- Controlled Vocabulary für Ton, Sprecherrolle, Persona-Bezug, Event-Kontext, Stimmung, Beziehungslage und Fragmentfunktion bereitstellen. Keine beliebig geschriebenen Tags als unkontrollierte Laufzeitlogik.
- Jeder Agent-Turn hinterlässt genau einen Beitrag. Die Turn-Manifest-/Contribution-Prüfung stellt sicher, dass ein registrierter Turn genau einen Beitrag hat und IDs nicht doppelt vorkommen.
- Fragmentbeiträge und Event-Templates bleiben getrennte Dinge: ein Beitrag kann Dialog, Reaktion, Erinnerungssatz, Gerücht, Beschreibung oder Choice-Preview sein, ohne eine neue Spielregel zu definieren.
- Herkunft und Klassifizierung bleiben nachvollziehbar. Bei semantischer Fehlklassifizierung darf ein Text nicht in unpassenden Kontexten landen.
- Inhalte werden als Assets/Daten importiert; keine langen Textpools, Prompts oder Spielbalance-Konfigurationen in TypeScript-Logik.

**Zielbereiche:** `content/narrative/**`, `AGENTS.md`, `docs/NARRATIVE-ENGINE.md`.

**Nachweis:** Schema weist fehlende Pflichtfelder, doppelte IDs, ungültige Flags, unbekannte Locale/Slots und fehlende Commands zurück; Turn-Manifest zählt exakt einen Beitrag pro registriertem Agent-Turn.

**Gate:** `verify:quick`; neue Content-Validierung in das bestehende `verify:assets` einhängen, nicht einen parallelen Gate-Stack schaffen.

---

### NAR-10 – Content Compiler, Registry-Aufbau und Makro-Validierung

**Ziel:** Agentenbeiträge reproduzierbar in eine Runtime-Registry überführen.

**Arbeiten**
- Deterministischen Compiler implementieren, der Contributions einliest, Schema/Vocabulary prüft, Duplikate und Konflikte erkennt, Makros parst und eine Registry für Vite/Runtime erzeugt.
- `€...`-Direktiven aus dem sichtbaren Text entfernen und als typisierte AST-Daten speichern.
- Compiler ordnet Beiträge nach semantischen Slots und Kompatibilitätsregeln; er darf keine Effekte hinzufügen, die nicht in der Command Registry und im Event Template erlaubt sind.
- Konflikte erkennen: gegensätzliche Sprecher, unpassende Persona, inkompatible Stimmung, widersprüchliche Story-Flags, unzulässige Command-Kombinationen.
- Einen lesenden Check-Modus anbieten. Verify prüft Aktualität/Validität; nur ein expliziter Build-/Fix-Schritt darf abgeleitete Dateien schreiben.
- Content-Validierung als Teil von `scripts/verify-assets.mjs` integrieren, damit das vorhandene Assets-Gate die Registry schützt.
- Keine neue npm-Abhängigkeit einführen, solange TypeScript/Node-Bordmittel für die Schema-/DSL-Prüfung reichen.

**Zielbereiche:** `scripts/compile-narrative-content.mjs`, `scripts/verify-narrative-content.mjs`, `scripts/verify-assets.mjs`, `src/content/narrative-registry.*` oder ein vergleichbarer generierter Datenimport.

**Nachweis:** gleicher Content-Baum erzeugt byte-identische Registry; `--check` verändert nichts; ungültige Direktiven machen das Assets-Gate rot; kein manueller Eingriff in generierte Dateien.

**Gate:** `verify:quick`.

---

### NAR-11 – Runtime Composer und LLM-Textadapter

**Ziel:** Aus Template, Facts, Teilnehmern und Textfragmenten lebendige Darstellung bauen, ohne die Spielmechanik zu delegieren.

**Arbeiten**
- Composer wählt kompatible Fragmente für Titel, Beschreibung, Dialog, Choice-Preview und Reaktionen anhand der registrierten semantischen Flags.
- Komposition muss sprachlich/strukturell vollständige Ausgaben liefern; fehlende Slots bekommen passende Fallbacks statt leere UI oder kaputte Sätze.
- Optionalen `NarrativeTextProvider` als austauschbaren Adapter definieren. Core ruft niemals einen Provider auf.
- LLM-Eingabe enthält nur erlaubten Kontext und bereits festgelegte Choice-/Effektinformationen. Rückgabe wird als reiner Darstellungstext validiert.
- LLM kann weder neue Choice-IDs noch Kosten, Zahlenwirkungen, Trigger, Command-Direktiven oder Teilnehmer festlegen. Commands stammen aus den validierten Templates/Registrydaten.
- Asynchrone Textanfrage außerhalb von `tickWorld` und außerhalb des deterministischen Simulationspfads ausführen. Antwort muss gegen Event-ID/Revision geprüft werden, damit verspätete Antworten kein inzwischen beendetes Event überschreiben.
- Lokaler Registry-Composer bleibt voll funktionsfähig, wenn kein LLM-Provider, keine Verbindung oder ein fehlerhafter Provider-Output existiert.
- Keine API-Keys/Provider-Geheimnisse in Browser-Bundles und keine neue Provider-Abhängigkeit ohne separate Infrastrukturentscheidung.

**Zielbereiche:** `narrative/composer/`, `narrative/provider-contract.ts`, Store-seitiger Adapter, Konfigurationsassets.

**Nachweis:** gleiche Eingabe mit lokalem Composer reproduzierbar; Provider-Ausfall fällt auf Registry-Text zurück; beliebige LLM-Choice-/Command-Versuche werden ignoriert/abgewiesen; verspätete Antwort kann kein anderes Event verändern.

**Gate:** `verify:quick`; Dependency-Gate bleibt unverändert, solange keine Abhängigkeit ergänzt wird.

---

### NAR-12 – Engine-Orchestrierung und Integration in WorldStore/Tick

**Ziel:** Facts, Memory, Trigger, Scheduler, Templates, Composer und Commands zu einem kontrollierten Ablauf verbinden.

**Arbeiten**
- Einen kleinen Orchestrator in eigenen Modulen bereitstellen; `tick.ts` und `world-store.ts` bleiben Integrationspunkte, keine neue Logik-Sammelstelle.
- Feste Verarbeitungsreihenfolge festlegen: Simulationsänderungen → Facts sammeln → Memory/Relationships aktualisieren → Trigger evaluieren → Scheduler aktualisieren → Event-Instanzen/Choices bereitstellen → Journal-/Snapshot-Emission.
- Auch Store-Commands außerhalb des normalen Ticks müssen Facts verarbeiten können. Eine zentrale Boundary/Flush-Funktion an den tatsächlichen Mutationsgrenzen sicherstellen; `#emit()` nicht zum versteckten Gameplay-Handler machen.
- Fact-Verarbeitung ist idempotent und begrenzt. Neu erzeugte Facts aus Command-Effekten werden in einem definierten Folgedurchlauf verarbeitet, nicht rekursiv ungebremst.
- Event-Commands erhalten Welt, Ledger und notwendigen RNG explizit injiziert; kein direkter Import von `worldStore` in `src/core`.
- `settleMoneyJournal()` bleibt für Journal-Buchungen zuständig; Narrative-Ledger-Facts nutzen ihren eigenen Cursor und erzeugen keine Doppelverarbeitung.
- Fehlerhafte Event-/Contentdaten blockieren die konkrete Ausführung fail-closed, dürfen aber nicht die restliche Simulation in einen halben Zustand bringen.

**Zielbereiche:** `src/core/sim/narrative/runtime.ts`, `process-boundary.ts`, `tick.ts`, `src/store/narrative-commands.ts`, `world-store.ts` nur als dünner Integrationspunkt.

**Nachweis:** vollständiger Fact→Event→Choice→Command→Fact-Durchlauf; Ereignis nach Spieleraktion wird zeitnah sichtbar; Tick läuft ohne LLM/Netzwerk; kein doppeltes Event nach Save/Load; WorldStore bleibt alleiniger State-Besitzer.

**Gate:** **Full Gate verpflichtend**, weil World-State, Save-/Store-Integration und potenziell Ledgerpfade zusammenlaufen.

---

### NAR-13 – Bestehende DemandEvents in die gemeinsame Engine migrieren

**Ziel:** Das alte `demandEvent`-System nicht als zweiten Scheduler behalten.

**Arbeiten**
- `NEON_NACHT` und `TURNIER_ABEND` als datengetriebene Event-Definitionen in die neue Event Engine überführen.
- Bestehende Nachfragewirkung aus `demandBreakdown()` als abgeleiteten Modifier aktiver kompatibler Event-Instanzen lesen lassen.
- Bestehende `DemandSnapshot.event`-Anzeige aus dem aktiven Eventzustand ableiten; keine doppelte aktive Event-Wahrheit in `world.demandEvent` und `world.narrative`.
- v8-Saves mit `demandEvent` bei der Migration in eine kompatible aktive Event-Instanz konvertieren oder – falls ein Zustand nicht valide konvertierbar ist – mit dokumentiertem, verlustarmem Default behandeln.
- Bisherige Ankunftsraten, Gruppengrößen, Zeitfenster und Demand-Modifikatoren erhalten; die narrative Engine darf die Nachfragebalance nicht beiläufig ändern.
- Die beiden bisherigen Events werden nicht als starre Obergrenze für neue Events behandelt: weitere Eventarten kommen über Registry/Template/Trigger hinzu.

**Zielbereiche:** `src/core/sim/demand.ts`, `types-model.ts`, `migrate.ts`, `narrative/events/`, Demand- und Save-Tests.

**Nachweis:** identische Nachfragewirkung für alte Szenarien; aktive Neon-Nacht/Turnierabend übersteht v8→v9; kein paralleles `demandEvent`-Lifecycle-System; keine Duplicate-Spawns.

**Gate:** **Full Gate verpflichtend** wegen Save-Migration und Simulations-/Demand-Verhalten.

---

### NAR-14 – Narrative UI, Event-Historie und Besucherprofile

**Ziel:** Geschichten und Charakterentwicklung sichtbar und bedienbar machen, ohne Logik in React zu duplizieren.

**Arbeiten**
- `GameView` um read-only aktive Events, verfügbare Choices und ausgewählte Visitor-Profile erweitern.
- Store-Commands für Choice-Auswahl, Event-Schließen/Zurückstellen und Profilnavigation anbieten; alle Effekte laufen durch die Engine/Command Registry.
- Narrative Event UI mit klarer Trennung zwischen Titel, Erzähltext, Teilnehmern, Choices und tatsächlichen Vorschauen bauen.
- Visitor-Profilansicht um Besuche, Vorlieben, ausgewählte Erinnerungen, Beziehungen und laufende Geschichten ergänzen.
- Journal bleibt Chronik tatsächlicher Vorgänge; wichtige Narrative-Ergebnisse können dort als lesbare Einträge erscheinen. Keine parallele UI-Historie als State anlegen.
- UI zeigt stale/abgelaufene Choices nicht als ausführbar. Keyboard-/Focus-Verhalten und schmale Viewports mitprüfen.

**Zielbereiche:** `src/store/types.ts`, `snapshot.ts`, neue `src/ui/narrative-*`, Erweiterung `guest-popup.tsx`/`journal-popup.tsx` nach LOC-Aufteilung.

**Nachweis:** UI kann aktive Events anzeigen, Choice-Command auslösen und nach Store-Snapshot aktualisieren; Reload stellt aktive Events wieder her; UI enthält keine eigene Trigger-/Choice-Effektlogik.

**Gate:** `verify:quick` mit Store-/UI-Integrationstests.

---

### NAR-15 – Autonome Rivalen und Casino-übergreifende Aktionen

**Ziel:** Rivalen werden eigenständige Akteure, deren Handlungen echte Facts und Narrative auslösen.

**Arbeiten**
- Statische Betreiberdefinitionen in `rivals.ts` von persistentem Rivalen-Zustand trennen.
- Pro Rivale Zustand für Strategie/Ziele, Ressourcen bzw. Handlungsfähigkeit, Beziehungen zum Spieler und relevante Historie modellieren.
- Pure Policies/Strategies für Kooperation, Preis-/Eventaktionen, Abwerben, Informationshandel, Reaktionen und Sabotage definieren.
- Rivalenhandlungen als explizite, nachvollziehbare Actions ausführen und `RIVAL_ACTION`-Facts erzeugen.
- Sabotage muss Indizien, Ursache, Wirkung und Gegenmaßnahmen besitzen; kein undurchsichtiger Zufallsmalus.
- Spieleraktionen und Rivalenaktionen verwenden gemeinsame Command-/Event-Verträge, aber Rivalenstrategie bleibt eine eigene Domäne.
- Fremde Floors und `rivalState()` nicht ohne Not bei jedem Tick vollständig simulieren. Deterministische, geplante Aktionen mit begrenzter Frequenz nutzen.

**Zielbereiche:** `src/core/sim/rival-ai/` (`state`, `strategy`, `policy`, `actions`), `rivals.ts`, `WorldState`, Narrative Facts und Save.

**Nachweis:** gleicher Save/gleiche Eingabe erzeugt dieselben Rivalenaktionen; Kooperation/Konkurrenz/Sabotage verändert nachvollziehbar die Welt; Aktionen lösen Event-Trigger aus; Rivalenaktionen können nicht Ledger-/Weltregeln umgehen.

**Gate:** **Full Gate**, da persistenter Weltzustand und möglicherweise Ledger betroffen sind. Tick-/Langzeitverhalten an NAR-16 mit CI-Soak/Balance prüfen.

---

### NAR-16 – Langzeitintegration, Performance und Simulationsstabilität

**Ziel:** Sicherstellen, dass die Engine über viele Spieltage Geschichten aufbaut, ohne Tick, Save oder Speicher zu destabilisieren.

**Arbeiten**
- Szenarien über viele Ticks/Tage mit Rückkehrern, Memory, Beziehungen, mehreren aktiven Stories, Choices, Rivalenaktionen und Save/Load abdecken.
- Event-Wiederholungen, Cooldown-Explosion, unauflösbare Eventketten, verwaiste Teilnehmer, veraltete Choices, volle Memory-Grenzen und ungültigen Content prüfen.
- Tick-Hotpath messen: Fact-Erzeugung nur bei Zustandsübergängen; Scheduler verarbeitet neue Facts und fällige Events, keine Vollsuche durch Registry/Archiv jedes Tick.
- Save-Größe/Memory-Budget beobachten: keine unbeschränkte Fact-Historie, kein doppeltes Journal, keine vollständigen LLM-Kontexte im Save.
- Niedrig-Hardware-Messung mit bestehendem `bench:lowend` nur an diesem Integrationsmeilenstein bzw. wenn Messungen nötig sind; Performance nicht durch schwächere Tests „lösen“.
- Langlauf- und Balancenachweise in GitHub Actions über `npm run ci:long` ausführen, nicht in die lokale schnelle Schleife verschieben.

**Zielbereiche:** narrative/sim Tests, vorhandene Soak-/Balance-Harnesses, ggf. ein eng umrissener Narrative-Performance-Benchmark.

**Nachweis:** Save-/Load-Replay deterministisch; keine Event-/Memory-Leaks über Langlauf; Wirtschaft und Nachfrage bleiben plausibel; CI-Soak/Balance/Benchmarks sind grün; dokumentierte Laufzeitdaten.

**Gate:** `verify:quick` am Ende des Tasks, `verify:all`/CI auf dem PR und `npm run ci:long` für Langlauf/Balance/Benchmark-Nachweise.

---

### NAR-17 – Vollständige Content- und Architektur-Synchronisierung

**Ziel:** Dokumentation, Agentenbeiträge, Compiler, Registry und tatsächliche Laufzeit auf denselben Vertrag bringen.

**Arbeiten**
- `docs/ARCHITECTURE.md`, `docs/PRODUCT.md`, `AGENTS.md`, `docs/NARRATIVE-ENGINE.md` und ggf. `docs/ERROR_CATALOG.md` mit dem finalen Code synchronisieren.
- Aktuelle Save-Version, Migrationen, Zustandsbesitz, Fact-/Memory-Limits, Event-Lifecycle, Command-DSL und Provider-Grenze dokumentieren.
- Alle Testdateien über `npm run catalog` eintragen; generierte Katalogänderungen prüfen, nicht manuell pflegen.
- Veraltete Beschreibungen zu `demandEvent` entfernen oder auf die neue gemeinsame Engine umstellen.
- Agenten-Contribution-Workflow samt Turn-Manifest, Validator und Fehlerfällen dokumentieren.
- Keine ungenutzten Exporte, doppelten Registries, parallel gepflegten Flags oder TODO-Placeholder hinterlassen.

**Zielbereiche:** `docs/**`, `AGENTS.md`, Testkatalog, Asset-Validator.

**Nachweis:** Dokumente stimmen mit Save v9, Runtime und echten Gate-Skripten überein; alle Content- und Testdaten bestehen ihre Validatoren; keine zweite Wahrheit für Journal, Eventstatus, Choice-Effekt oder Visitor-Identität.

**Gate:** `verify:quick`, danach **`verify:all` auf dem vollständigen Stand** und CI `Fail-Closed Gates`.

---

## 5. Modulaufteilung als Zielstruktur

Die Struktur ist nach Zuständigkeiten geschnitten. Einzelne Dateien dürfen weiter aufgeteilt werden, sobald sie in die 150-LOC-Hot-Zone kommen; 200 LOC ist die harte Obergrenze für `src/core`.

```text
src/core/sim/narrative/
  types.ts                  # Narrative-/Fact-/Event-Verträge
  state.ts                  # Initialzustand und Normalisierung
  facts/
    types.ts
    emit.ts
    queue.ts
    history.ts
    ledger-facts.ts
    guest-facts.ts
    rival-facts.ts
  memory/
    types.ts
    update.ts
    queries.ts
    retention.ts
  relationships/
    types.ts
    update.ts
    queries.ts
  triggers/
    types.ts
    predicates.ts
    context.ts
    evaluate.ts
  events/
    template-types.ts
    definitions/            # Daten/Definitionen, nicht Engine-Logik
    lifecycle.ts
    scheduler.ts
    cooldowns.ts
    history.ts
  choices/
    contract.ts
    eligibility.ts
    resolve.ts
  commands/
    types.ts
    registry.ts
    parse-directives.ts
    validate.ts
    preflight.ts
    execute.ts
    handlers/               # Kleine Handler je Domäne
  composer/
    types.ts
    select-fragments.ts
    compose.ts
    provider-contract.ts
    fallback.ts
  runtime.ts                # Dünner Ablaufkoordinator
  process-boundary.ts       # Verarbeitung nach Tick/Store-Mutation

content/narrative/
  vocabulary/               # Kontrollierte semantische Flags
  contributions/            # Ein Beitrag je registriertem Agent-Turn
  templates/                # Datengetriebene Event-Strukturen/Slots
  registry/                 # Abgeleitete/validierte Runtime-Daten
  turns/                    # Turn-Manifest / Zuordnung

scripts/
  compile-narrative-content.mjs
  verify-narrative-content.mjs
```

Nicht jede Datei muss von Anfang an angelegt werden. Die Aufteilung folgt den NAR-Tasks; keine leeren Platzhalterdateien nur zur Erfüllung eines Verzeichnisbaums. Alle großen Textpools, Prompts, Vokabulare und veränderlichen Content-/Balance-Konfigurationen bleiben Daten/Assets und nicht Inline-Logik.

---

## 6. Fachliche Invarianten für das Gesamtsystem

1. **Ein Fakt, eine ID, eine Verarbeitung.** Persistierte oder erneut gelesene Facts erzeugen keine doppelten Memories, Events oder Commands.
2. **Journal ist nicht Fact-Bus.** Das Journal dokumentiert; Facts treiben Trigger und Memory.
3. **Visitor ist Identität, Guest ist Besuch.** Temporäre Werte werden nicht versehentlich zur dauerhaften Charakterwahrheit.
4. **Keine Referenz darf eine Figur unbemerkt verlieren.** Retention berücksichtigt aktive Geschichten, Beziehungen und offene Entscheidungen.
5. **Template bestimmt Mechanik, Content bestimmt Sprache.** Choice-IDs, Voraussetzungen, Kosten und Effekte sind nicht LLM-generiert.
6. **Commands sind deklarativ und allowlisted.** Makros werden kompiliert und validiert; sichtbarer Text ist niemals ausführbarer Code.
7. **LLM ist optional und außerhalb der Simulation.** Ausfall, Verzögerung oder Fantasieausgabe beeinflussen keine Spielregeln und blockieren keinen Tick.
8. **Kein gemeinsamer PRNG-Verbrauch.** Text-/Narrative-Auswahl darf den Spiel-RNG nicht verschieben.
9. **Eine aktive Event-Wahrheit.** `demandEvent` wird in die Engine migriert; kein konkurrierender zweiter Scheduler.
10. **Eine State-Wahrheit.** WorldStore besitzt persistenten Zustand; Snapshot/UI sind Projektionen und Command-Eingänge.
11. **Begrenzte Arbeit und Daten.** Fact-Historie, Memories, aktive Events, Beziehungen und Registry-Suche sind begrenzt/indiziert und wachsen nicht unkontrolliert.
12. **Jede Wirkung ist nachvollziehbar.** Wichtige Entscheidungen und Commands dokumentieren Ursache/Wirkung; Geld ist weiterhin ausschließlich im Ledger wahr.
13. **Keine stillen Rivalen-Strafen.** Autonome Rivalenaktionen besitzen eine Ursache, sichtbare Spuren und mögliche Gegenreaktionen.
14. **Save/Load ist Teil der Engine, nicht ein späterer Reparaturschritt.** Aktive Events, Choices, Cooldowns und Memories werden vollständig fortgesetzt.

---

## 7. Gesamtnachweis der fertigen Engine

Die Engine ist als zusammenhängendes System fertig, wenn die folgenden Pfade gemeinsam funktionieren:

- Ein Gast wird erstmals erzeugt, erhält ein persistentes Visitor-Profil und hinterlässt bei markanten Vorgängen strukturierte Facts.
- Der Gast kehrt wieder, wird als dieselbe Figur erkannt und sein vergangenes Erlebnis beeinflusst Verhalten/Erzählkontext.
- Zwei Gäste können eine Beziehung aufbauen oder einen Konflikt fortführen; daraus kann ein späteres Event entstehen.
- Ein Fact aus Charakterwerten, Stimmung, Vergangenheit, Ledger/Bilanz, Casinozustand oder Rivalenaktion kann einen Trigger erfüllen.
- Scheduler verhindert Wiederholungen, priorisiert konkurrierende Ereignisse und verwaltet parallele/verkettete Geschichten.
- Ein Event bekommt Teilnehmer und mehrere valide Choices. Text wird aus semantisch kompatiblen Agentenfragmenten zusammengesetzt.
- Agentenbeiträge enthalten nachvollziehbare Flags und dürfen validierte `€...`-Direktiven tragen. Compiler extrahiert diese in eine Command-AST.
- Eine Choice führt nur registrierte, vorgeprüfte Commands aus. Tatsächliche Effekte entsprechen dem Code-Template, nicht einer LLM-Behauptung.
- Die resultierende Weltveränderung erzeugt neue Facts und kann die Geschichte fortsetzen.
- Rivalen können eigenständig kooperieren, konkurrieren, Gäste abwerben oder begründet sabotieren; dies beeinflusst denselben Fact-/Event-Fluss.
- Ein Save mitten in einer Story lädt die gleiche Story mit denselben Teilnehmern, Fristen, Choices und Cooldowns wieder.
- Ohne LLM-Provider funktioniert der gesamte Ablauf mit Registry-Fallback. Mit LLM werden nur Texte ergänzt.
- Bestehende Demand- und Wirtschaftsbalance, Ledgerintegrität, deterministische Fortsetzung und Tick-Performance bleiben erhalten.
- Quick-/Full-/Long-Gates sind grün; keine LOC-Ausnahme, kein abgeschwächtes Testniveau und kein unkontrollierter Gate-Umbau.

---

## 8. Relevante bestehende Dateien zur Umsetzung

- `AGENTS.md` – Arbeits-, Test- und Delivery-Verträge
- `docs/ARCHITECTURE.md` – Zustandsbesitz, Headless-Core, Save, Journal, Pipeline
- `docs/CI-GATES.md` – Main-Schutz und CI-Nachweise
- `scripts/lib/pipeline-plan.mjs` – tatsächlich aktive Gate-Profile
- `scripts/lib/test-catalog.mjs` – Testsysteme und Proof-Klassen
- `scripts/loc-budgets.mjs` – LOC-Caps und Hot Zones
- `scripts/verify-test-quality.mjs` – Testheader, Assertions, Zielbezug und Determinismus
- `vite.config.ts` – lokales Quick-Testprofil und ausgeschlossene Testdateien
- `src/core/sim/types.ts`, `types-model.ts`, `templates.ts` – WorldState/Modell/Initialisierung
- `src/core/sim/visitors.ts`, `spawn.ts`, `traits.ts`, `guest-service.ts` – Visitor-Lebenszyklus
- `src/core/sim/journal.ts` – Spielerhistorie und Ledger-Spiegelung
- `src/core/sim/demand.ts`, `progression.ts` – Nachfrage, vorhandene DemandEvents und Progression
- `src/core/sim/rivals.ts`, `foreign-floor-tick.ts` – vorhandene Rivalen-/Foreign-Floor-Grundlage
- `src/core/sim/tick.ts` – Simulationsreihenfolge
- `src/store/save.ts`, `migrate.ts` – Save-Versionierung und Hydration
- `src/store/world-store.ts`, `snapshot.ts`, `types.ts` – State-Besitz und UI-Projektion
- `src/ui/guest-popup.tsx`, `journal-popup.tsx` – bestehende Besucher-/Journaldarstellung
- `src/core/sim/__tests__/visitors.test.ts`, `demand.test.ts`, `journal.test.ts`, `rivals.test.ts`, `src/store/__tests__/save-migration.test.ts`, `save-roundtrip.test.ts` – bestehende relevante Nachweise

**Prüfgrenze dieses Plans:** Der Plan basiert auf dem aus GitHub gelesenen `main`-Commit oben. Es wurde dabei kein lokaler Checkout gebaut oder getestet; die Implementierungstasks müssen ihre jeweiligen Gate-Ergebnisse aus dem tatsächlichen Arbeitsbaum liefern.
