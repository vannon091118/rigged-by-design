# Devtagebuch

Chronologisch, ehrlich, mit offenen Enden. Jeder Eintrag nennt Datum, Ziel,
Umsetzung, Pruefungen und was bewusst nicht getan wurde.

## Regeln

- Ein Eintrag pro Arbeitstag oder pro abgeschlossenem Auftrag, neuester oben.
- Pruefungen werden woertlich benannt; "getestet" ohne Kommando ist kein Nachweis.
- Begruendungen gehoeren hierher, nicht in Commit-Titel.
- Offene Punkte bleiben stehen, bis sie erledigt oder verworfen sind.




## 2026-11-03 - Narrative-Review-Befunde S1 bis S16: Expiry, Demand, Slot-Map, Preflight, Locale, Migration, Duplikat, totale Ausfuehrung, ENGINE_DEMAND, maxOccurrences, legacy-Demand, guard-Flush, degraded, Doku

**Ziel.** Narrative-Review-Befunde S1 bis S16: Expiry, Demand, Slot-Map, Preflight, Locale, Migration, Duplikat, totale Ausfuehrung, ENGINE_DEMAND, maxOccurrences, legacy-Demand, guard-Flush, degraded, Doku

**Umsetzung.** Offen.

**Pruefungen.** Offen.

**Offen.** Offen.

## 2026-11-03 - NAR-13: DemandEvents in der gemeinsamen Engine

**Ziel.** Den zweiten Scheduler in `demand.ts` aufloesen, ohne Ankunftsraten, Gruppengroessen oder Zeitfenster zu veraendern und ohne laufende Veranstaltungen aus v5–v9-Saves zu verlieren.

**Umsetzung.** Neon-Nacht und Turnierabend stehen jetzt als Daten in `narrative/events/demand-definitions.ts`; `narrative/demand-events.ts` startet hoechstens eine aktive GLOBAL-Instanz ohne Choices und beendet sie am Fristtick ueber `transitionEvent` (`EXPIRED`, `DEMAND_ENDED`). `demandBreakdown()`, `groupSize()` und `expectedGroupSize()` lesen nur noch die aktive Instanz; `NarrativeState.demandEvent` und seine Normalisierung sind entfernt. `sourceFactId: 0` ist fuer engine-erzeugte Events ohne ausloesenden Fact reserviert. `hydrateNarrative()` konvertiert das alte Feld aus v5–v8 und v9 in eine Instanz mit Restlaufzeit, abgelaufene Events verfallen.

**Pruefungen.** `node_modules/.bin/tsc --noEmit -p src/Config/tsconfig.json` und 19 fokussierte Tests in `demand.test.ts`, `narrative-demand.test.ts` und `narrative-save.test.ts` sind grün. Die Save-Tests decken alle Versionen v5–v9, das fehlende Feld im neuen Save und den Reload ohne Duplikat ab. `RBD_VERIFY_NO_CACHE=1 RBD_VERIFY_AUDIT=1 CI=true node scripts/run-pipeline.mjs --profile=full` bestand alle zwoelf Gates inklusive Audit und Build; die Suite meldete 657 bestandene und 2 uebersprungene Tests (659 gesamt) in 132 bestandenen Testdateien. Bericht: `.verify-cache/reports/2026-11-03T03-16-02-160Z/summary.md`.

**Offen.** Die Event-Instanzen teilen sich die begrenzte Historie mit den uebrigen narrativen Events; eine eigene Retention fuer Nachfrageevents ist nicht noetig, solange hoechstens eine pro Tag entsteht. Die UI-Anbindung bleibt NAR-14.

## 2026-11-03 - NAR-12 Orchestrierung in Tick und WorldStore

**Ziel.** Facts nicht mehr an einzelnen Quellen, sondern an den tatsaechlichen Mutationsgrenzen verarbeiten und den vollstaendigen Kreis Fact→Event→Choice→Command→Fact schliessen — im Tick und bei Store-Commands ausserhalb des Ticks.

**Umsetzung.** `narrative/runtime.ts` ist der einzige Orchestrator. `processNarrativeRuntime()` ruft `processNarrativeBoundaryDetailed()` genau einmal, wertet danach pro drainiertem Fact die deklarativen Trigger aus `events/trigger-definitions.ts` aus und uebersetzt Treffer ueber die Template-Registry in Kandidaten; `scheduleCandidates()` begrenzt auf drei neue Instanzen und behaelt Dedupe, Cooldowns und Narrativ-RNG. Die Reihenfolge ist fest: Simulation → Facts → Memory/Relationships → Trigger → Scheduler → Events/Choices → Journal/Snapshot. `tickWorld()` ruft die Runtime am Tick-Ende. `src/store/narrative-commands.ts` liefert `flushNarrativeCmd()` und `chooseNarrativeCmd()`; `world-store.ts` flusht nach jeder erfolgreichen Command-Ausfuehrung, nach Neues Spiel, Import und Rivalenspiel — `#emit()` bleibt Darstellung und Save. `spawn.ts` und `guest-service.ts` drainieren nicht mehr selbst. Eine erfolgreiche Choice emittiert `EVENT_RESOLVED`, damit auch der Erfolgsfall einen Folgefakt hat; der naechste Flush verarbeitet ihn genau einmal, nie rekursiv. Das Schema validiert den neuen Fact, der Save-Roundtrip traegt ihn, und der Content-Beitrag bringt die Registry auf 21 Fragmente.

**Pruefungen.** `npx --yes pnpm@10.4.1 run typecheck` war gruen; `verify:quick` bestand alle zehn Gates. `RBD_VERIFY_NO_CACHE=1 npx --yes pnpm@10.4.1 run verify:all` bestand alle zwoelf Gates inklusive Audit und Build; die Suite meldete 652 bestandene und 2 uebersprungene Tests (654 gesamt), 131 Testdateien bestanden und 2 uebersprungen (133). Das Assets-Gate meldete 21 Beitraege, 21 Turns und 21 Registry-Fragmente bei 552 Dateien. Bericht: `.verify-cache/reports/2026-11-03T02-35-24-994Z/summary.md`. Keine neue Abhaengigkeit.

**CI-Nachlauf.** Der erste CI-Lauf auf `89be92a` machte das Doku-Gate rot: `inventory:build` lief vor dem Commit, als die sechs neuen Dateien noch untracked waren, und listete 1109 statt 1115 getrackte Dateien. Der Nachlauf auf dem getrackten Baum brachte 1115/1115; `verify:all` mit `CI=true`, `RBD_VERIFY_AUDIT=1` und ohne Cache bestand danach alle zwoelf Gates. Ein paralleler Push-Lauf auf demselben Commit blieb rot, waehrend der PR-Lauf gruen war. Der Grund war kein Infrastrukturfehler: `narrative-save.test.ts` griff mit `events[0]` auf das erste Event zu und nahm an, dass waehrend der 60 Fixture-Ticks keine Events entstehen. Seit NAR-12 plant der Tick echte `VISITOR_RETURN`-Events, abhaengig vom Zufallsseed; der Test sucht das `SAVE_EVENT` jetzt ueber seine `eventId`.

**Offen.** Die Runtime verwirft Trigger-Treffer, die ueber die Drei-Event-Grenze hinausgehen; das ist bewusst begrenzt, aber noch nicht als eigener Diagnosezaehler sichtbar. `NARRATIVE-ENGINE.md` nennt die Runtime, die UI-Anbindung bleibt NAR-14, die Demand-Migration NAR-13.

## 2026-11-03 - NAR-11: Lokaler Runtime Composer

**Ziel.** Die validierte Registry zur Laufzeit mit Event-Template-Slots verbinden, ohne Textauswahl, Mechanik oder Gameplay-PRNG zu koppeln. Fehlende Slots brauchen lokale, kontextvertraegliche Fallbacks; kein Provider, kein API-Key, keine Textanfrage.

**Umsetzung.** `src/core/sim/narrative/composer/` trennt den `ComposeRequest`-Vertrag, die fail-closed Laufzeitvalidierung, die deterministische Auswahl und die Fassade. `TITLE` mappt auf `opening`, `BODY` auf `description`/`event-body`/`dialog`, `CHOICE_LABEL` auf `choice-preview`, `OUTCOME` auf `reaction`. Locale, Kontextschnitt, `requiredFlags` und Persona-Refs filtern; der stabile Score gewinnt, Gleichstand nach `contributionId`. Es gibt keinen RNG-Import. Fehlende Slots bekommen kurze Fallbacks ohne Fakten, Choice-IDs, Kosten oder Wirkungen. Ungueltige Fragmente und Direktiven werden uebersprungen und im Ergebnis gemeldet; Direktiven bleiben reine AST-Daten. Der NAR-10-Compiler erzeugt zusaetzlich `registry.generated.ts`; `--check` und das Assets-Gate pruefen JSON und TypeScript byte-genau. Der neue Beitrag `runtime-composer-01` dokumentiert den Vertrag und bringt die Registry auf 20 Fragmente.

**Pruefungen.** `npx --yes pnpm@10.4.1 run typecheck`, `narrative:check` und die fokussierten Suiten fuer Composer, Compiler und Content waren gruen (29 Tests). `RBD_VERIFY_NO_CACHE=1 npx --yes pnpm@10.4.1 run verify:all` bestand alle zwoelf Gates inklusive Audit und Build; die Suite meldete 642 bestandene und 2 uebersprungene Tests (644 gesamt), 129 Testdateien bestanden und 2 uebersprungen. Das Assets-Gate meldete 20 Beitraege, 20 Turns und 20 Registry-Fragmente. Bericht: `.verify-cache/reports/2026-11-03T02-13-45-619Z/summary.md`. Keine neue Abhaengigkeit.

**Offen.** Der Composer ist noch nicht an Tick oder UI angeschlossen; die Trigger-Auswahl und Orchestrierung bleiben NAR-12, die Narrative UI NAR-14. `TRIGGER_DIALOG` bleibt bis dahin nicht ausfuehrbar.

## 2026-11-03 - NAR-10: Content-Compiler und Makro-Validierung

**Ziel.** Die 19 Beitraege reproduzierbar in eine Runtime-Registry ueberfuehren: Makros als typisierte ASTs, Konflikte vor dem Schreiben erkennen, `--check` strikt lesend halten und dieselbe Inbox byte-identisch abbilden.

**Umsetzung.** `scripts/lib/narrative-macros.mjs` spiegelt den NAR-08-Parser, prueft die Allowlist, exakte Argumentlisten, stabile ActorRefs, kontrollierte Flags und doppelte Singleton-Commands. `scripts/lib/narrative-compiler.mjs` baut die nach `contributionId` sortierte Registry, erkennt gegensaetzliche Sprecher, unpassende Persona-Nennungen, inkompatible Stimmung, widerspruechliche Story-Flags und unzulaessige Command-Kombinationen und hasht die kanonische Fragmentliste mit SHA-256. `scripts/compile-narrative-content.mjs` schreibt nur bei `--write`; sonst vergleicht es die exakten Bytes. `scripts/verify-narrative-content.mjs` und das bestehende Assets-Gate nutzen denselben Validator. Die Registry ist Version 2, enthaelt nur typisierte AST-Felder und keine Roh-Makros; der neue Beitrag `content-compiler-01` traegt `€FreezeTick:120` als valides Beispiel.

**Pruefungen.** `typecheck`, `verify:assets` und `verify:test-quality` waren nach der Integration gruen. Der Compilerlauf erzeugte 19 Fragmente mit `sha256:4a71453595bac0634d08f90b188bc35034d9f8c4c2bdbb512badd57880c2316d`; `--check` schrieb keine Datei. Die Konfliktproben fuer Sprecher und Stimmung wurden direkt gegen `buildCompiledRegistry` geprueft; die neue Testdatei deckt zusaetzlich Makrogrenzen, Allowlist-Drift, Determinismus, Persona/Flags und Byte-Drift ab. Der vollstaendige `RBD_VERIFY_NO_CACHE=1 pnpm run verify:all` bestand alle zwoelf Gates inklusive Audit und Build; die Suite meldete 633 bestandene und 2 uebersprungene Tests (635 gesamt), 128 Testdateien bestanden und 2 uebersprungen. Bericht: `.verify-cache/reports/2026-11-03T01-56-26-127Z/summary.md`.

**Offen.** NAR-11 baut den lokalen Composer; NAR-10 bindet noch keine Event-Template-Allowlist an die ASTs. Die Compiler-Pruefung ist bewusst strenger als der Runtime-Parser: Content darf nur ausfuehrbare Commands und stabile ActorRefs nennen.

## 2026-11-03 - NAR-09: Content-Registry und Klassifizierung

**Ziel.** Die vorhandene Content-Inbox in einen pruefbaren Textpool verwandeln: Jeder Beitrag bekommt eine kontrollierte Klassifizierung, jeder abgeschlossene Agenten-Turn genau einen Eintrag im Manifest, und die Runtime-Registry wird daraus reproduzierbar abgeleitet, ohne Texte in Simulationscode zu ziehen.

**Umsetzung.** `content/narrative/vocabulary/classification.json` kontrolliert Slots, Funktionen, Slot-Funktions-Kompatibilitaet, Kontexte, Ton, Stimmung, Beziehung und Personas; Rollen, Locales und Flags bleiben in `flags.json`. Alle 18 Beitraege tragen jetzt diese Felder. `content/narrative/turns/manifest.json` ordnet 18 Turn-IDs genau je einem Beitrag zu. `content/narrative/registry/fragments.json` enthaelt die 18 sortierten Fragmente samt Herkunft, Text und Direktiven und wird von `scripts/build-narrative-registry.mjs` aus derselben Validierung erzeugt. `scripts/lib/narrative-content.mjs` prueft Schema, IDs, Dateinamen, Manifest und Registry; `scripts/verify-assets.mjs` ruft die Pruefung im bestehenden Gate auf. Kein neuer Gate-Stack, kein LLM im Spiel.

**Pruefungen.** `npx --yes pnpm@10.4.1 run verify:all` bestand alle zwoelf Gates inklusive Audit und Build; darin waren `typecheck`, `check:loc`, `verify:docs` und `verify:tree` PASS. Die vollstaendige Suite meldete 623 bestandene und 2 uebersprungene Tests (625 gesamt); 127 Testdateien bestanden, 2 wurden uebersprungen. Der Registry-Check und das Assets-Gate meldeten 18 Beitraege, 18 Turns und 18 sortierte Registry-Fragmente. Die zehn neuen Tests decken Schema, unbekannte Klassifizierungen, Slot-Funktions-Konflikte, Direktiven, doppelte IDs, Manifest-Luecken und Registry-Drift ab.

**Offen.** NAR-10 baut den Compiler fuer Makro-AST, Konflikte und byte-identische Registry; NAR-11 den Composer. Die Registry enthaelt bewusst nur validierte Beitraege, noch keine Event-Template-Bindung oder Runtime-Auswahl.

## 2026-11-03 - NAR-08: Command-DSL und Allowlist

**Ziel.** Textbeitraege duerfen Commands deklarieren, aber niemals Code ausfuehren. Event-Templates bleiben die Allowlist; Parser, Preflight und Handler muessen fail-closed zusammenarbeiten, und eine Choice darf auch bei wiederholtem Klick nur einmal wirken.

**Umsetzung.** `narrative/commands/` trennt typisierte AST-Typen, Registry, Parser, Validierung, Preflight und Ausfuehrung. Der Parser akzeptiert nur `€...`-Ausdruecke mit begrenzter Laenge, maximal acht Argumenten und bekannten Wertformen; `FreezeTick` und `trigger Dialog` werden auf stabile Command-IDs normalisiert. Die Registry allowlistet `SET_FLAG`, `ADJUST_RELATIONSHIP`, `FREEZE_TICK` und `TRIGGER_DIALOG`; der Dialog bleibt bis zur UI-Anbindung nicht ausfuehrbar. Choice-Effekte werden direkt in dieselbe AST-Form uebersetzt, Requirements, Kosten, Ziele und Event-Status vor jeder Mutation geprueft. Die Ausfuehrung aktiviert ein `OFFERED`-Event, bucht Kosten ueber das Ledger, wendet Effekte an und setzt `RESOLVED`; ein zweiter Klick scheitert am Lifecycle. Abgelehnte Commands landen als begrenzter `COMMAND_REJECTED`-Fact in der Narrativ-Historie.

**Pruefungen.** `npx --yes pnpm@10.4.1 run typecheck` und `check:loc` gruen; `verify:quick` bestand nach der Exportbereinigung alle Gates, die Schnellsuite meldete 603 bestandene und 2 uebersprungene Tests. `verify:all` bestand alle zwoelf Gates inklusive Audit und Build; die vollstaendige Suite meldete 613 bestandene und 2 uebersprungene Tests (615 gesamt). Die neuen Tests decken Parser-Grenzen, doppelte Argumente, unbekannte und nicht allowlistete Commands, Teilnehmerindizes, Kosten, Fristverlaengerung, die einmalige Ausfuehrung, Wiederholung und `COMMAND_REJECTED` ab.

**Offen.** `TRIGGER_DIALOG` ist nur parsebar, nicht ausfuehrbar; die UI-/Runtime-Anbindung bleibt NAR-14. Trigger-Auswahl und Orchestrierung im Tick bleiben NAR-12, Content-Compiler und Composer NAR-09/NAR-11, die Demand-Migration NAR-13. Weitere Command-Familien folgen erst mit ihren echten Domaenen-Handlern.

## 2026-11-03 - NAR-07: Event-Templates und stabile Choice-Verträge

**Ziel.** Mechanische Event-Struktur testbar machen, ohne Text und Formulierungen zu Spielregeln zu erheben: stabile Template- und Choice-IDs, rollengenaue Teilnehmer, deklarative Requirements/Kosten/Effekte, persistierte Choice-Saetze und eine erneute Pruefung beim Klick.

**Umsetzung.** `events/template-types.ts` und `template-schema.ts` definieren und validieren Templates, Content-Slots, Choices, Requirements, Kosten und Effekte fail-closed. `events/definitions/` registriert `VISITOR_RETURN` und `VISITOR_CONFLICT`; `events/template-candidate.ts` loest Trigger-Teilnehmer rollengenau auf und baut den Scheduler-Kandidaten. `choices/contract.ts` bindet Choice-IDs an `eventId`, `templateId`, `templateVersion` und den persistierten `offeredChoiceIds`-Satz. `choices/eligibility.ts` prueft Lifecycle, Ablauf, Requirements und Kosten rein bei jedem Klick. Event-Instanzen tragen die neuen Metadaten additiv; alte Staende erhalten `eventId`, Version 1 und einen leeren Satz, bleiben also fail-closed nicht ausfuehrbar. Effekte werden noch nicht ausgefuehrt.

**Pruefungen.** `npx --yes pnpm@10.4.1 run typecheck` und `check:loc` gruen. `verify:all` bestand alle zwoelf Gates inklusive Audit und Build; die vollstaendige Suite meldete 598 bestandene und 2 uebersprungene Tests (600 gesamt). Die neuen Tests decken stabile IDs, doppelte/unbekannte Choices, Text-/Mechanik-Trennung, Fristen, Requirements, Kosten, persistierte Choice-Saetze und den Save-Roundtrip ab.

**Offen.** Command-Ausfuehrung und Allowlist (NAR-08), Content-Composer (NAR-11), Tick-Orchestrierung (NAR-12) und Demand-Migration (NAR-13) bleiben offen. Die neuen Templates sind noch nicht in den Tick eingebunden.

## 2026-11-03 - NAR-06: Event-Scheduler, Lifecycle und eigener Narrativ-RNG

**Ziel.** NAR-06 vollstaendig schliessen: Matches in persistente Event-Instanzen ueberfuehren, den Lifecycle zentral absichern, Cooldowns und Scopes trennen, Ereignisketten nur nach aufgeloesten Vorgaengern erlauben und die Auswahl deterministisch ohne den Gameplay-PRNG treffen.

**Umsetzung.** `event-types.ts` beschreibt Instanzen und Kandidaten; `event-lifecycle.ts` ist die einzige Statuswahrheit (`ELIGIBLE → OFFERED/ACTIVE → RESOLVED/EXPIRED/CANCELLED`), setzt Cooldowns je Event-/Teilnehmerkombination und begrenzt abgeschlossene Historie. `event-scheduler.ts` ordnet nach Prioritaet und Fairness, trennt `GLOBAL`/`VISITOR`/`PAIR`/`RIVAL`, verhindert Duplikate, begrenzt Arbeit und nutzt bei Gleichstand den eigenen persistenten Mulberry32-Strom aus `narrative-rng.ts`. `event-schema.ts` validiert und normalisiert alte oder manipulierte Daten fail-closed. Der Boundary ruft `maintainEvents()` auf und raeumt Fristen sowie verwaiste Visitor-/Personal-Endpunkte auch ohne neue Facts auf. Save v9 traegt die neuen Felder additiv; alte Staende erhalten leere Defaults.

**Pruefungen.** `npx --yes pnpm@10.4.1 run typecheck` und `check:loc` gruen; `verify:quick` bestand alle zehn Gates, einschliesslich `dead-code`, `test-quality` und der vollstaendigen Testsuite. Die neuen Tests decken Prioritaet, RNG-Determinismus, Scopes, Duplikate, Cooldowns, Mehrfachausfuehrung, Ablauf, Stale-Cancel, Ketten, Schrittwechsel, Historiengrenze und Save-Roundtrip ab. `verify:all` bestand alle zwoelf Gates inklusive Audit und Build; die vollstaendige Suite meldete 585 bestandene und 2 uebersprungene Tests.

**Offen.** Die Trigger-Auswahl im Tick und der vollstaendige Orchestrator bleiben NAR-12; Event-Templates/Choices (NAR-07), Demand-Migration (NAR-13), Commands, Content-Compiler, Composer und autonome Rivalen sind weiterhin offen. `demandEvent` bleibt bis NAR-13 das bestehende Nachfragesystem.

## 2026-11-02 - NAR-05: Trigger-Context und Condition Evaluator

**Ziel.** NAR-05 vollstaendig schliessen: ein deklarativer Trigger-Vertrag mit echtem Context, Beziehungs- und Zeitfensterabfragen, allen vorgesehenen Operatoren und einer fail-closed Schema-Validierung. Der Evaluator bleibt eine reine Funktion ohne Tick-Eingriff.

**Umsetzung.** `trigger-types.ts` beschreibt Context, Bedingungen, Definitionen und Match-Ergebnisse. `trigger-context.ts` baut aus Welt, Ledger und aktuellem Fact einen unveraenderlichen Snapshot mit Fact-Historie, Flags, Beziehungen, Visitor-Profilen, Hauskonto/Band, Charisma, Ruf, Nachfragestufe, bedienten Gaesten und Geraeteschaden; `actorRefsOfFact()` vereinheitlicht alte `visitorId`-Facts und neue `actorRefs`. `trigger-evaluate.ts` wertet `all`/`any`/`not`, Facts, Erinnerungen, Hauskonto, Geraete, Charisma, Ruf, Nachfrage, Gaeste, Flags, Zeitfenster, `recent-fact`, Akteure und Beziehungen aus und liefert Begruendungen. `trigger-schema.ts` verwirft unbekannte Operatoren, ungueltige Refs, Selbstkanten, negative/unsichere Schwellen und leere Listen; 64 Knoten und Tiefe 12 sind die Grenze. `triggers.ts` bleibt die oeffentliche Fassade.

**Pruefungen.** `npx --yes pnpm@10.4.1 run typecheck` gruen; die vollstaendige Suite lief mit 571 bestandenen und 2 uebersprungenen Tests. `verify:quick` bestand alle zehn Gates, `verify:all` alle zwoelf Gates inklusive Audit und Build. Die neuen Tests decken alle Operatoren, Grenzwerte, Historie, fehlende Visitor-Profile, Unveraenderlichkeit sowie Schema-Negativfaelle ab.

**Offen.** Der Evaluator ist noch nicht in den Tick eingebunden; Aufrufstelle und Cooldowns bleiben NAR-06/NAR-12. Scheduler, Event-Templates, Commands, Content-Compiler, Composer, Demand-Migration und autonome Rivalen sind weiterhin offen.

## 2026-11-02 - Optik und Steuerung: Lichtpfuetzen, Zielraster, Kamera folgt

**Ziel.** Ohne eine neue Spielregel soll der Floor besser lesbar und besser steuerbar werden:
Licht, das Raeume unterscheidet, Hinweise auf dem Boden statt in Panels, eine Kamera, die der
Figur folgt, und ein HUD, das keine leere Zeile mehr mitzeigt.

**Umsetzung.**

- `floor-surface.ts`: Lichtpfuetzen in 16 Stufen (alpha 0,009 bis 0,02), hellere Deckenlampen
  und Wandlichtkanten, Laufweg-Abdunklung von 0,34 auf 0,26. Die Stufen sind bewusst viele
  und leise: drei deckende Ellipsen lasen im Browser als Radarringe und liefen ueber die Wand
  hinaus; erst die vielen Stufen und die auf den Raum begrenzten Halbachsen ergaben Licht.
- `src/render/floor-cues.ts` (neu): Zielraster unter dem Zeiger, Spielerring, Punktspur des
  Laufwegs, Klick-Puls. Die Farbe zeigt die Folge: Service heisst laufen, Identity heisst
  heranziehen. Nach einer Kamerafahrt wird das Raster ueber die letzte Zeigerposition neu
  gesetzt, sonst zeigt es auf eine Kachel, die nicht mehr unter dem Zeiger liegt.
- `floor-camera.ts`: `pan`, `zoomStep`, `keepInView`. Die Kamera zieht erst nach, wenn die
  Figur den inneren Rahmen (55 Prozent der halben Sicht) verlaesst; in der Uebersicht und auf
  dem Rueckweg dorthin bleibt sie mittig. Ohne die zweite Bedingung zog `keepInView` den
  Fokus waehrend des Herauszoomens zur Figur und `0` landete neben der Mitte (camX 498 statt
  385 bei 1582 Pixeln Breite).
- `floor-touch.ts` traegt jetzt alle Zeigergesten (Rad, Pinch, Ziehen mit mittlerer oder
  rechter Taste). Der Wheel-Handler ist aus `floor-view.ts` dorthin gewandert; das Budget der
  Datei bleibt bei 349/350, weil die neue Ebene und der Handler zusammen mehr Zeilen brauchten
  als der alte Wheel-Block.
- `stage-controls.tsx` (neu) und `app.css`: Tastenkuerzel als kbd-Chips, Kamera-Knoepfe unten
  rechts, Vignette und Rasterhintergrund auf der Buehne, Barkauf-Ziel als Chip in der
  RPG-Zeile (die vorher eine leere Vollbreite-Leiste ohne jede CSS-Regel war), XP-Balken.
- Bildsprache als Blatt: `docs/banners/art-direction-neon-ledger.png` und die Philosophie in
  `docs/ART-DIRECTION.md`, damit die naechste Aenderung nicht neu geraten wird.

**Pruefungen.** Browser ueber agent-browser (Chromium 156, 1600x1000 und 1000x720): Uebersicht
mittig (camX 385 bei 1582 Pixeln Buehne), Rechtsziehen schwenkt mit dem Zeiger, Rad und `+`/`-`
zoomen, `0` kehrt zur Uebersicht zurueck, WASD laeuft und die Kamera zieht nach (camX 125 auf
-471), Zielraster wechselt die Farbe zwischen Detail und Uebersicht, Laufwegspur erscheint
beim Klick. `pnpm run typecheck` gruen. `pnpm run verify:quick` war auf dem eigenen Stand gruen
(zehn Gates, 520 Tests bestanden, 2 uebersprungen). Nach dem Rebase auf `origin/main` (PR #54) laufen
lokal zwei load-empfindliche Nachweise in der vollen Parallelitaet in ihr Zeitlimit — `process-sweep`
(Warten auf das Prozessende) und `slot-paylines` (RTP-Volllauf: 95 s allein gegen 120 s Budget);
beide bestehen in Isolation (12 von 12). Sie beruehren weder Renderer noch Kamera. Den vollstaendigen
Nachweis traegt wie vorgesehen CI (`verify:all`). Neuer Test `floor-camera.test.ts` mit sechs Faellen; drei
davon waren zuerst rot, weil ich die Zugrichtung des Schwenks und die Lerp-Toleranz falsch
angenommen hatte — die Kamera war richtig, die Erwartung nicht.

**Offen.** Lichtpfuetze gilt je Zone und Chunk: eine Zone, die ueber eine Regionskante reicht,
bekommt je Chunk eine eigene Pfuetze; bei sehr grossen Saelen entsteht dort eine sichtbare
Naht. Ziehen per Touch ist nur im Code vorhanden, nicht auf einem echten Geraet geprueft. Der
Klick in der Uebersicht zieht weiterhin heran statt zu laufen: bewusst, weil ein Klick ohne
Rueckmeldung sonst nicht von einem Fehlklick zu unterscheiden waere.

## 2026-11-02 - NAR-04: Beziehungen aus echten Quellen

**Ziel.** NAR-04 vollstaendig schliessen: Beziehungen zwischen Besuchern, Haus, Personal und Rivalen aus echten Spielereignissen, kanonisch persistiert und ohne zweiten Fact-Drain.

**Umsetzung.** `VISITOR_CONFLICT` entsteht in `maybeStartBrawl()` und erzeugt zwei gerichtete Besucherkanten; die angegriffene Seite verliert mehr Vertrauen. `VISITOR_SERVICE` entsteht nur bei anwesendem Kassierer in `arriveAtDesk()`/`cashierTick()` und erzeugt Besucher→Personal. `RIVAL_ENCOUNTER` entsteht bei `settleCardOutcome()` und `visitRivalWithJournal()` aus dem Nettofluss einer echten Abrechnung und erzeugt Rivale→Haus. Alle drei nutzen `actorRefs` statt Pflicht-`visitorId`; `fact-schema.ts` validiert sie beim Laden, `relationship-apply.ts` wendet sie an. Kanten sind auf 200 begrenzt, auf `-10..10` geklemmt, nach Tick und Akteurspaar sortiert und beim Laden dedupliziert. Der Barkeeper hat weiterhin kein individuelles Serviceereignis; diese Luecke wird nicht mit einer Attrappe geschlossen.

**Pruefungen.** `npx --yes pnpm@10.4.1 run typecheck` und `check:loc` gruen. 21 gezielte Tests in fuenf Dateien gruen: Streit (drei), Kasse (zwei), Rivalenabrechnung (drei), Fact-Schema ohne `visitorId` (drei), Beziehungen/Save-Roundtrip (zehn). Der Rivalen-Test deckte zuerst einen Laufzeitfehler auf, weil `RIVAL_IDS` nur ueber `export type *` re-exportiert wurde; der Import kommt jetzt direkt aus `types-model.ts`. Der Personal-Test brauchte ein eroeffnetes Hauskonto fuer die Einstellung.

**Offen.** Trigger-Integration (NAR-05), Scheduler/Templates (NAR-06/07), Demand-Migration (NAR-13), Commands, Content-Compiler, Composer, autonome Rivalen und Soak bleiben offen. Unterstuetzungs-/Versprechens-Facts haben noch keine echte Quelle; sie werden nicht simuliert.

## 2026-11-02 - Ein Fact-Drain, Ledger-Cursor und Beziehungsgrundlage

**Ziel.** Die offenen NAR-02/03-Reste schliessen, die vor NAR-04 blockieren: Fact-Referenzen ohne Pflicht-Visitor, ein Ledger-Cursor, ein einziger Consumer und referenzsichere Retention.

**Umsetzung.** `processNarrativeBoundary()` ist jetzt der einzige Drain; er erzeugt zuerst Hauskonto-Schwellen (`HOUSE_BALANCE`), drainiert dann die Queue und verteilt an Erinnerungen und Beziehungen. Der Cursor liegt als Ledger-`seq` in `narrative.ledgerSeq`; der erste Lauf setzt ihn ohne historische Facts. `relationships.ts` fuehrt gerichtete Kanten zwischen persistenten Akteuren mit Trust, Sympathie, Konflikt und Einfluss; ein guter oder schlechter Besuch verschiebt `visitor:<id> -> player`, neutrale Besuche erzeugen keine Kante. Beziehungsendpunkte pinnen ihre Visitor-Profile; die Retention verdraengt nur ungepinnte bestehende Profile und laesst die Liste bei vollstaendig gepinnter Belegung bewusst ueber dem Cap.

**Pruefungen.** `npx --yes pnpm@10.4.1 run typecheck`, `lint`, `check:loc` und `verify:dead-code` gruen; Narrativ-, Visitor- und Save-Tests gruen. Der erste Retention-Test war rot, weil der neue Besucher sich selbst verdraengte; die Auswahl schliesst den neuen Datensatz jetzt aus.

**Offen.** NAR-04 war zu diesem Zeitpunkt nur begonnen; der naechste Eintrag schliesst die weiteren Fact-Quellen ab. Trigger-Integration, Scheduler, Templates, Commands, Content-Compiler und Composer fehlen weiterhin. Die Demand-Migration (NAR-13) bleibt vor der Tick-Integration (NAR-12).

## 2026-11-02 - Nachfrageereignis auf Narrative-Zustand vorbereiten

**Ziel.** Den Zustand der vorhandenen Nachfrageveranstaltungen fuer die spaetere Event-Engine vereinheitlichen, ohne die Nachfragebalance zu aendern.

**Umsetzung.** Das aktive Event liegt in `narrative.demandEvent`. Alte v5–v9-Saves uebernehmen laufende Veranstaltungen, neue Saves enthalten keine zweite Kopie. Die bestehende Planung in `demand.ts` bleibt unveraendert.

**Pruefungen.** `pnpm run typecheck` und `RBD_VERIFY_AUDIT=1 npx --yes pnpm@10.4.1 run verify:all` bestanden; das Full Gate umfasst Nachfrage-, Save-Migrations- und weitere Tests, Audit und Build.

**Offen.** Es gibt noch keinen allgemeinen Scheduler, keine Dialoge oder Choice-Effekte und keine autonomen Rivalen. NAR-13 ist nur vorbereitet, nicht abgeschlossen.

## 2026-11-02 - Narrative-Dokumentation nach Merge wiederherstellen

**Ziel.** Nach PR #52 verlorene Narrative-Dokumentation wiederherstellen, ohne die Engine als abgeschlossen darzustellen.

**Umsetzung.** Fehlende Eintraege aus dem lokal gesicherten Stand mit dem gemergten Code und Architekturvertrag abgeglichen; Changelog, fruehere Tagebucheintraege, Inventar, Roadmap und Agentenregeln ergaenzt. Composer und Compiler bleiben als geplant gekennzeichnet; die Laufzeit bleibt ohne LLM.

**Pruefungen.** Lokales `verify:quick` und GitHub-Pflichtstatus pruefen diesen Dokumentationsstand; keine Spielregeln geaendert.

**Offen.** Der Evaluator ist nicht integriert; weitere Grundlagen, Scheduler, Dialoge, Commands, Compiler, Demand-Migration und Rivalen fehlen.

## 2026-11-02 - Narrative Trigger Bedingungen

**Ziel.** Narrative Trigger Bedingungen.

**Umsetzung.** Ein reiner Evaluator verknuepft ausgewaehlte bestehende Facts mit Erinnerung, Hauskonto, Geraetezustand, Charisma, Flags und Fact-Alter; AND, OR und NOT sind kombinierbar. Kein bestehender Simulationspfad wird damit veraendert.

**Pruefungen.** `npx --yes pnpm@10.4.1 run verify:all`: alle zwoelf Gates bestanden, einschliesslich Trigger-Tests. Der Runner meldete zusaetzlich `fatal: bad revision 'origin/main...HEAD'` bei der Git-Referenzabfrage; das Profil meldete dennoch PASS.

**Offen.** Der Evaluator ist nicht an die Simulation angeschlossen. Weitere Facts, Ledger-Cursor, Beziehungen, Scheduler, Dialoge, Commands, Content-Compiler, Demand-Migration und Rivalen fehlen.

## 2026-11-02 - Narrativ-Grundlagen und LLM-freier Eventplan

**Ziel.** Narrativ-Grundlagen und LLM-freier Eventplan

**Umsetzung.** Die Start-Pool-Facts zaehlen die bereits bei der Anlage gesetzte Poolgroesse nicht erneut. Die Save-Normalisierung prueft Fact-Nutzdaten, sortiert IDs und entfernt Duplikate; der Cursor bleibt auch bei unvollstaendigen Daten erhalten. Der Eventplan schliesst Provider und LLM im Spiel aus und kennzeichnet verbleibende Grundlagen sowie v5–v9-Demandmigration als offen.

**Pruefungen.** `npx --yes pnpm@10.4.1 run verify:all`: alle zwoelf Gates bestanden, einschliesslich Lint, Typecheck, Save-/Narrative-Tests und Build. Der Runner meldete zusaetzlich `fatal: bad revision 'origin/main...HEAD'` bei der Git-Referenzabfrage; das Gate-Profil meldete trotzdem PASS.

**Offen.** Event-Scheduler, Beziehungen, Content-Compiler, Commands, UI und autonome Rivalen sind weiterhin nicht implementiert; keine Promotion ohne vollstaendigen Nachweis.

## 2026-11-02 - Tooling-Ausgabe strukturiert, Wegwerf-Skripte verboten

**Ziel.** Die Agent-Werkzeuge sollen ohne Rueckfrage lesbar sein: strukturiert, menschlich lesbar, token-optimiert. Ad-hoc-Skripte fuer jede Kleinigkeit sollen nicht mehr entstehen.

**Umsetzung.** `summarize()` in `scripts/lib/impact.mjs` druckt eine feste Beschriftungsspalte mit einer Zeile je Feld. `scripts/agent-verify.mjs` zeigt eine Gate-Tabelle mit Status und Dauer aus `lastGateRows()` (`scripts/lib/gate-runner.mjs`) und kennt `--plan` fuer den Plan ohne Lauf. `scripts/verify-tree.mjs` meldet Wegwerf-Dateien als `ERR-4019`; die Regel steht in `AGENTS.md` unter Pitfalls.

**Nachtrag.** `--line` verdichtet beide Werkzeuge auf eine Zeile; `RBD_VERIFY_QUIET=1` unterdrueckt die Zeile je Gate, damit neben der Tabelle keine zweite Ausgabe steht.

**Global.** `rtk rg` scheiterte mit `program not found`, weil ripgrep fehlte. ripgrep 15.2.0 liegt jetzt im PATH (`WindowsApps`), die rtk-Konfiguration ist gesichert (`config.toml.bak-2026-11-02`) und auf `max_width = 100`, hoehere Suchlimits und stillen Hook-Hinweis gesetzt. Damit sind `rtk ls/find/read/rg/git/pnpm` die Standardbefehle, `agent:context` bleibt der primaere Einstieg.

**Pruefungen.** `node --check` fuer die vier Skripte, `pnpm run agent:context`, `pnpm run agent:verify -- --plan`, `pnpm run verify:tree`, `pnpm run verify:docs`, `pnpm run check:loc`.

**Offen.** Die Testsuite lief in diesem Schritt nicht; der Nachweis gehoert in den Abschlusslauf und braucht vorher die Freigabe des Nutzers.

## 2026-11-02 - Peer-Review Phase 6: Tick-Konstante, Testspin, Texte, Portabilitaet

**Ziel.** Peer-Review Phase 6: Tick-Konstante, Testspin, Texte, Portabilitaet

**Umsetzung.** Die Peer-Review-Befunde wurden gegen `main` (8d08640) verifiziert und umgesetzt. `TICK_MS = 520` steht jetzt einmal in `src/core/sim/tick-timing.ts`; `world-store`, `floor-view`, `games-popup`, `guest-popup` und `self-exclusion-panel` lesen daraus statt aus Literalen. `spinTest` ruft `spinTestCmd` nur noch einmal auf. Das tote `movement-queue`-Modul samt Test und ERR-3002 ist entfernt. Texte: "DER GEBER MISCHT" korrigiert, Mojibake in `table-launcher` entfernt, Asset-Zaehler aus `imageCount` berechnet. Portabilitaet: `src/Config/opencode.json` nutzt einen relativen Pfad, `scripts/encode-audio.mjs` bricht ohne `RBD_AUDIO_SOURCE` mit Hinweis ab. Befunde 33 und 37 waren auf `main` bereits behoben, 38 ist veraltet.

**Pruefungen.** `pnpm run typecheck` und `pnpm run lint` exit 0. `pnpm run test`: 109 Dateien bestanden, 2 uebersprungen; 524 Tests bestanden (vorher 532, Differenz = entfernter movement-queue-Test). `pnpm run catalog` regeneriert `docs/TEST-CATALOG.md`.

**Offen.** Spielregel-Entscheidungen bleiben beim Nutzer: VELVET, FREE_DRINK, EXTRA_REEL, Einsatzskalierung in `offerScore`, `payDailyWage`, Schuldentilgung, Pity-RTP (~99,15 %). `EXTRA_SYMBOLS`-Schluessel passen nicht zum Manifest (`GRAPE_CLUSTER`/`LUCKY_SEVEN` gegen `GRAPE`/`SEVEN`), visuelle Entscheidung. Befund 39 (doppelter Asset-Check) ist offen und ungeprueft.

## 2026-11-02 - Tip release-faehig machen (0.3.73)

**Ziel.** Nicht nur der Merge-Commit, sondern die aktuelle Spitze von `main` soll gruen und release-konsistent sein.

**Umsetzung.** `main` stand nach dem Merge weiter auf `ee39c83`; die Release-Automation committet bewusst nichts. Der Pflicht-Check war fuer genau diesen SHA per `workflow_dispatch` gruen, `verify:all` lief ohne Cache mit CI-Audit 12/12. Inkonsistent war nur das Release: `package.json` sagte 0.3.72, der Tag `v0.3.72` zeigt aber auf `7b50913` (PR #40), und der Release-Lauf nach dem API-Merge endete als `skipped`, weil er nur auf `push`-Workflow-Laeufe reagiert. Deshalb der Patch-Sprung auf 0.3.73: ein neuer Tag am Tip, ohne den bestehenden `v0.3.72` zu verschieben.

**Pruefungen.** `version-bump` schreibt `package.json` und `Config`-Kennung; `verify:all` ohne Cache mit `RBD_VERIFY_AUDIT=1` auf dem Tip-Baum 12/12 gruen; Befundnotiz zu VELVET/FREE_DRINK/EXTRA_REEL ist in `docs/INVENTORY.md` vorhanden.

**Offen.** Die drei Mod-Entscheidungen (Gaesteguete, Drink pro Spin, vierte Walze) bleiben beim Nutzer.

## 2026-11-02 - Roter Pflichtstatus war das PR-Body-Gate

**Ziel.** PR #44 mergen, ohne einen Check zu umgehen.

**Umsetzung.** Zwei Laeufe pro Commit: der Push-Lauf bestand `verify:all` mit 12/12 Gates, der PR-getriggerte Lauf brach nach rund 15 Sekunden mit Exit 1 ab. Ein Test auf den Workflow-Dateien (`ci-gates.test.ts`) haelt fest, dass beide Trigger bleiben muessen, also lag der Fehler nicht im Workflow, sondern im PR-Body: das Gate `verify-commit-msg --pr` verlangt die drei Pflichtsektionen, und der Body trug sie nicht. Der Body wird deshalb aus dem Commit-Body gehoben; die Trigger und `cancel-in-progress` bleiben unveraendert.

**Pruefungen.** `RBD_VERIFY_AUDIT=1 RBD_VERIFY_NO_CACHE=1 pnpm run verify:all` deckte den eigentlichen Fehler auf: der Test `Main-Gate > prueft Pushes auf main und Pull Requests gegen main` fiel nach dem Trigger-Umbau rot — der Umbau wurde zurueckgenommen.

**Offen.** Keine Code-Aenderung am CI-Workflow; das PR-Body-Gate bleibt scharf.


## 2026-11-02 - Befundnotiz: drei Mods ohne Mechanik

**Ziel.** Die zwei Audit-Luecken, die eine Spielregel brauchen (VELVET/FREE_DRINK ohne ihre beschriebene Wirkung, EXTRA_REEL ohne zusaetzliche Walze), so festhalten, dass sie nicht wieder zwischen Code und Doku verschwinden — ohne eine Regel zu erfinden.

**Umsetzung.** `docs/INVENTORY.md` hat jetzt einen Abschnitt „Offene Design-Entscheidungen: Mods ohne Mechanik" mit einer Zeile je Mod: Versprechen, tatsaechlicher Effekt und die eine Frage, die der Nutzer beantworten muss. VELVET verspricht bessere Gaeste, liefert aber nur Anziehung und weniger Geduld; eine Guetev erschiebung wuerde die Wirtschaftsrechnung des Abends aendern. FREE_DRINK verspricht einen Drink pro Spin, liefert Geduld und Betriebskosten; offen ist, ob das Haus pro Spin wirklich bucht. EXTRA_REEL verspricht eine vierte Walze, die Walzenzahl kommt aber aus `item.reels`; offen ist, ob der Mod schenkt oder rabattiert. Keine dieser drei Fragen ist durch Umbuchung beantwortbar, deshalb bewusst keine Code-Aenderung.

**Pruefungen.** `inventory:build` 1028/1028 Dateien, `docs:sync` sechs Marker, `typecheck`, `lint`, `check:loc`, `verify:docs`, `verify:dead-code`, `verify:test-quality`, `verify:tree`, `verify:redundancy`, `verify:assets`, `build` je Exit 0, volle Suite 532/532 gruen.

**Offen.** Die drei Entscheidungen selbst; bis dahin bleibt der Shop an diesen Stellen teurer als sein Effekt.


## 2026-11-02 - Pity als Vorschuss, Wut aus Geduld, Sucht am Einsatz

**Ziel.** Fünf offene Punkte schließen: Pity-RTP, Wut-Auslöser, Suchtfolgen, tote Felder und das nicht auszahlbare Bonus-Guthaben.

**Umsetzung.** Die Entladung war ein zweiter Gewinn auf einem Polster, das schon aus Hausvorteil gefüllt war — deshalb stieg der gemessene RTP Richtung 100 %. `settleSlotSpin` führt den Topf jetzt signiert: eine Entladung darf ihn überziehen, der negative Stand ist ein Vorschuss und wird von späteren Gewinnen abgezogen. Wut löste `decay` bei `mood < 12` aus, obwohl Journal und Mods von Geduld sprechen; entschieden ist die Geduld, geprüft vor dem +0,02-Tropfen. `addictedStake` hebt den Einsatz um bis zu 50 %, `sessionSpins` verlängert die Sitzung von vier auf neun Spins. `social` ist aus dem Bedürfnis-Typ entfernt, `cashOutPlayerCash` macht das Bonus-Guthaben auszahlbar. `Persona.patience` bleibt, weil sie seit dem vorherigen Commit über `rollProfile` gelesen wird.

**Pruefungen.** Fail-First mit zurückgerollten Dateien: sechs Tests rot (fehlender Export plus beide Wut-Fälle), danach 13/13 grün; `typecheck`, `lint`, `check:loc`, `verify:docs` je Exit 0, volle Suite grün.

**Offen.** Einsatzaufschlag und Sitzungsdauer sind gedeckelt; HIGH_ROLLER spielt weiterhin nicht über den Mindestsatz des Geräts.


## 2026-11-02 - Synergie-Audit: tote Persona-Geduld und Mods ohne Wirkung

**Ziel.** Systematisch suchen, wo Mechaniken sich gegenseitig tragen sollten, es aber nicht tun: geschriebene Felder ohne Leser, verkaufte Mods ohne ihre beschriebene Wirkung und Personas, die nur als Gewicht auftauchen.

**Umsetzung.** Ein Befund war reine Verdrahtung: `Persona.patience` (68 bis 138) wurde nirgends gelesen, weil `makeGuest` die Geduld zu gleichen Teilen aus dem 180-Punkte-Pool zog — der Stammgast startete sogar ungeduldiger als der High Roller (51,1 gegen 63,9 im Messlauf), weil seine hohe Suchtrate den Geduldanteil verdrängte. `rollProfile` nimmt die Persona-Geduld jetzt als eigenes Gewicht (`patience / 100`) neben der Suchtrate; weil der Pool weiterhin exakt 180 Punkte verteilt, bleibt die Invariante aus `world.test.ts` und `tycoon-needs.test.ts` erhalten. Die übrigen Befunde stehen als Bericht in `docs/INVENTORY.md`, weil sie Spielregel-Entscheidungen brauchen: `VELVET` und `FREE_DRINK` versprechen bessere Gäste und einen Drink pro Spin, liefern aber nur Anziehung und Geduld; `EXTRA_REEL` erhöht nur die Anziehung, die Walzenzahl kommt aus dem separaten Upgrade; `PLAYER_CASH` wird nur gutgeschrieben (Pakt-Bonus) und als Anzeige gelesen; der Einsatz bleibt `max(minBet, baseBet)` und skaliert nie mit dem Persona-Budget.

**Pruefungen.** Fail-First: `persona-patience.test.ts` lief auf dem Stand vor dem Commit rot (Stammgast 51,1 war nicht geduldiger als High Roller 63,9), nach dem Fix 2/2 grün, `typecheck` Exit 0. Der Befundbericht ist aus Greps belegt: `PLAYER_CASH` erscheint nur in `self-exclusion-bet.ts` als Ziel einer Buchung, `VELVET`/`FREE_DRINK` nur in `offers.ts` und der Rivalen-Deko, `reelPull` liest `item.reels` statt der Mods.

**Offen.** Die vier verbleibenden Punkte sind bewusst nicht gefixt: sie ändern Spielregeln oder Preise (Gratis-Drink pro Spin, Samt-Gäste, vierte Walze als Mod, Ausgabe von `PLAYER_CASH`) und brauchen eine Entscheidung, keine Umbuchung.


## 2026-11-02 - Lohn nur für geleistete Schichten

**Ziel.** Befund 2 schließen: `payDailyWage` zahlte weder Anwesenheit noch Arbeit, weshalb ein Spieler mit angenommenem Job fünf Tage lang 60 VC kassierte, ohne den Floor zu betreten — bezahlt aus `EXTERNAL`, also aus dem Nichts.

**Umsetzung.** „Gearbeitet" heißt jetzt: mindestens eine abgeschlossene Schicht. `completeJobTask` stempelt dafür `lastWorkDay = world.day`; `payDailyWage` zahlt nur, wenn `lastWorkDay >= world.day - 1` gilt, also für die Schicht des Vortags am Tageswechsel (der Tag wird in `staffTick` vor dem Lohn hochgezählt). Damit gibt es höchstens einen Lohn pro Tag und keinen Cent für untätige Tage; `workDays` wuchs schon vorher nur in `completeJobTask` und bleibt bei Nichtstun stehen. Bodenaufenthalt ohne Schicht zählt bewusst nicht: die Schicht ist die Arbeit, die das Spiel bezahlt. Alt-Saves kennen `lastWorkDay` nicht; `hydrateWorld` setzt es auf 0 („noch keine Schicht"), was ohne Schicht nie einen Lohn freischaltet — keine Nachzahlung, kein Absturz, keine Versionserhöhung nötig, weil das Feld nur additiv ist.

**Pruefungen.** Fail-First mit zurückgerolltem `player-jobs.ts` und `migrate.ts`: 6 von 12 neuen Tests rot (Nichtstun zahlt, Nachzahlung nach fünf Tagen, Alt-Save ohne anerkannte Schicht), die sechs grünen sind Gegenproben (Lohn nach Schicht, `workDays`-Zuwachs, Laden ohne Fehler). Danach 36/36 in vier Dateien grün, `typecheck` 0. Drei bestehende Lohntests in `player-jobs.test.ts` bauen jetzt die Schicht ein, die ihre Aussage voraussetzt; ihre Behauptung (Lohn, Buchungsquelle, kein Doppellohn) ist unverändert.

**Offen.** Der Lohn gilt pro Schicht, nicht pro Stunde: zwei Schichten an einem Tag zahlen einen Tageslohn. Das ist die bestehende Lohnsemantik und wurde nicht angefasst. Weiterhin offen aus dem Audit: Pity-RTP, Schulden ohne Tilgung, tote `PLAYER_CASH`, wirkungslose Sucht, nie skalierender Einsatz.

## 2026-11-02 - Deckung an der Kasse, erreichbare Eskalation und gezählte Gäste

**Ziel.** Sechs Befunde aus dem Audit schließen, die reine Verdrahtung sind und keine Balance-Entscheidung verlangen: Deckung am falschen Ort, unerreichbare Eskalation, Gästezählung ohne Spiel, JACKPOT ab 1,0x, stehenbleibende Wut und zwei verschiedene Bar-Kapazitäten.

**Umsetzung.** `simulateMugging` maß die Wachdeckung an `world.player.position`, obwohl der Kommentar die Kasse nennt und das Geld dort liegt; `muggingCoverPoint` liefert jetzt den Wechseltisch und fällt nur ohne Kasse auf den Spieler zurück. `tickDisputes` setzte Stufe 2 ab `ticks > 6`, während `angerTick` den ANGRY-Zustand nach fünf Ticks beendet — die Schlägerei war damit strukturell unerreichbar; `disputeLevelForTicks(ticks)` kippt nach vier Ticks und ist als reine Funktion geprüft. `guestsServed` wuchs bei jedem Auszahlen, auch ohne einen einzigen Spin; der Wert speist Ruf und KASSE-Stufe, also zählt jetzt nur `guest.spins > 0`. Das JACKPOT-Label hing an `multiplierBps >= 10_000`, also an einem Push; `isJackpotLabel` verlangt 2,5x. `decay` ließ `guest.anger` unangetastet, weshalb ein geschlichteter Gast bis zum Abgang wütend aussah; die Wut sinkt jetzt, solange der Gast nicht randaliert. Bar-Kapazität: `barCapacityForLevel` (12 + 8 × Level) stand im Core, während HUD, Diagnose und Automaten-Popup 6 + 6 × Level anzeigten — alle drei lesen jetzt den Core.

**Pruefungen.** Fail-First mit zurückgerollten Fixes: 10 von 12 neuen Tests rot, die zwei grünen sind die Gegenproben (ANGRY behält seine Wut, Spin zählt weiter). Danach `pnpm exec vitest run` auf die sechs neuen Dateien 12/12 grün, `pnpm run typecheck` und `pnpm run lint` je Exit 0, Gesamtsuite 503 grün. `demand.test.ts` nutzte `guestsServed` als Stellvertreter für „ausgezahlt"; der Gast dort hat jetzt zwei Spins, damit die Auszahlungsprüfung unverändert bleibt und die neue Regel in `guests-served.test.ts` belegt ist.

**Offen.** Die Balance-Befunde bleiben offen: Pity-Entladungen (99,15 % RTP am Startautomaten), Löhne ohne Anwesenheit (`payDailyWage` braucht dafür ein Tagesmerkmal im Save), Schulden ohne Tilgung, tote `PLAYER_CASH`, wirkungslose Sucht und der nie skalierende Einsatz. Sie brauchen Spielregel-Entscheidungen, keine Verdrahtung.

## 2026-11-02 - Dreck, Video Poker und Ueberfaelle an der Ursache

**Ziel.** Die vier offenen Befunde schliessen: falsche Kacheladresse beim Dreck, falsche Video-Poker-Raenge, verdeckte Dreckschicht, verschluckte Ueberfallverluste.

**Umsetzung.** Der Dreck-Schreiber und der Dreck-Leser waren sich uneinig: `dirtyNear` dekodiert `x = index % size`, `y = floor(index / size)`, waehrend `tick.ts` und `disputes.ts` `(y+1)*size+x+1` schrieben — jeder Randale- und Streitfleck lag eine Kachel schraeg daneben, teils ausserhalb des Bodens. Die Adresse steht jetzt einmal als `dirtyTileIndex(size, x, y)` in `emotion.ts`, direkt neben dem Leser; alle vier Schreiber (`tick`, `disputes`, `needs`, `guest-play`) nutzen sie. Video Poker: `royal` verlangte keine Farbe, jede 10-bis-Ass-Strasse zahlte 250x, und das Wheel A-2-3-4-5 wurde als `NOTHING` gewertet; beides folgt jetzt der interaktiven Engine (`straightHigh && flush`, zusaetzlich `wheel`). `evaluatePokerHand` ist dafuer exportiert. Die Dreckschicht war erstes Kind des Moebel-Containers und lag damit unter allen Moebeln; sie ist jetzt ein eigenes `dirt`-Feld im Szenen-Cache und wird in `floor-view` zwischen Teppich und Moebeln eingehaengt. Im Wirtschaftsbericht stieg `classify` bei `from !== HAUSKONTO` aus, bevor der Ueberfallstopf geprueft wurde — ein Ueberfall auf das Portemonnaie (`simulateMugging` waehlt das groessere der beiden Konten) verschwand lautlos. Die Pruefung steht jetzt vor dem Quellkonto-Filter.

**Pruefungen.** Fail-First: `dirty-index.test.ts`, `economy-losses.test.ts` und `video-poker-ranks.test.ts` liefen zuerst mit 8 roten Tests (zwei fehlende Exporte, sechs falsche Ergebnisse), danach 9/9 gruen; der Hauskonto-Ueberfall war schon vorher gruen und bleibt die Baseline. `pnpm run typecheck` und `pnpm run lint` je Exit 0. Der volle `verify:all` folgt am Turn-Ende.

**Offen.** Fuer die Schichtreihenfolge gibt es keinen Unit-Test — PixiJS laesst sich in jsdom nicht sinnvoll aufbauen; sie ist ueber Typecheck, Build und einen Screenshot am Dev-Server geprueft. `mugging.ts` selbst bleibt unveraendert: die Wahl zwischen Kasse und Brieftasche ist Spielregel.

## 2026-11-02 - Governance-Quellen entdoppelt: ein Fehlerregister, eine Subsystemliste, eine Eskalationsleiter

**Ziel.** Governance-Quellen entdoppelt: ein Fehlerregister, eine Subsystemliste, eine Eskalationsleiter

**Umsetzung.** Vier Governance-Definitionen lagen mehrfach vor. `scripts/lib/error-codes.mjs` liest jetzt das Register `src/core/governance/error-codes.ts` selbst; `report.mjs` reicht `catalogCodes()` nur noch weiter, die Markdown-Tabelle ist Dokumentation statt Pruefgrundlage. Ursache des Umbaus war `ERR-1001`: `verify-test-quality.mjs` feuerte den Code, er stand in keinem Register, `line()` degradierte ihn still zu `ERR-0000` — der eine Zustand, der sofort blockiert. Der Code ist jetzt registriert. `issues.ts` und `transfer.ts` benutzen `ERROR_CODES.TRANSFER_INVALID.code`. `scripts/lib/subsystems.mjs` haelt Subsysteme (Prefix, Name, Katalogrolle, Impact-Doku, Invarianten) und die Ordnerregeln; Tree-Gate, Testkatalog, `subsystemOf` und die Impact-Bereiche leiten daraus ab. Die Eskalationsleiter steht als `src/Config/escalation-levels.json`; `escalation.mjs` liest die Datei, `issues.ts` traegt dieselbe Liste typisiert, ein Test vergleicht beide.

**Pruefungen.** `node -e` gegen die neue Bruecke meldet 30 registrierte Codes und `ERR-1001` als bekannt; die Leiter liest `AUTO_FIX -> LOCAL_GATE -> REMOTE_CI -> AGENT -> BLOCKED`; das Tree-Gate laeuft direkt mit PASS. `vitest run` auf `escalation.test.ts`, `dependency-governance.test.ts` und `transfer.test.ts` ergibt 10 gruene Tests. Der volle Lauf steht am Turn-Ende.

**Offen.** `verify-redundancy.mjs` liest `docs/ERROR_CATALOG.md` weiterhin direkt, um doppelte Eintraege zu finden — das gehoert zur Doku-Pruefung, nicht zur Codekenntnis, und bleibt bewusst so. Der TypeScript-Typ der Leiter kann aus JSON nicht abgeleitet werden; die Bindung leistet der Test, nicht der Compiler.

## 2026-11-01 - README-Onboarding und pnpm-CI nachgezogen

**Ziel.** Ein gemeinsamer Einstieg soll die Spielwelt satirisch eröffnen und neue Entwickler ohne Suche durch Werkzeuge und Verträge führen. Das README beschreibt den heutigen Stand, ohne endgültige Vision oder unveränderliche Mechaniken zu behaupten.

**Umsetzung.** README als längeres Onboarding neu geordnet: fiktionale Eröffnung, aktueller Spielstand, Screenshots und Versionsvergleich, Roadmap, Entwicklerstart, Zustandsverträge und FAQ. Das vom Nutzer gelieferte Pixel-Art-Banner ist als `docs/banner.jpg` eingebunden; drei eigene SVG-Trenner führen in Spielwelt, Werkstatt und Roadmap. Einen veralteten Startwert korrigiert: der Store vergibt 150 VC und den ersten Automaten kostenlos. PR #39 war konfliktfrei, seine CI scheiterte am fehlenden pnpm im Runner; alle acht betroffenen Workflow-Jobs installieren jetzt die deklarierte pnpm-Version vor Cache und Install-Schritten. Das Tree-Gate erlaubt JPEGs als Dokumentbeleg. Der erste Audit-Lauf fand die falsche npm-artige Override-Position; `pnpm.overrides` aktualisiert nun die gepatchten Versionen in der Lockfile.

**Pruefungen.** GitHub-Compare meldete vor dem PR einen Commit Vorsprung und keinen Rückstand auf main. Die CI-Diagnose lokalisierte den Fehler beim pnpm-Aufruf; die Reparatur verwendet die offizielle pnpm Action. Der erste lokale `pnpm run verify:all` Lauf hatte einen Audit-Fehler wegen falsch platzierter npm-artiger Overrides und einen Windows-Timeout im Prozess-Sweep-Test. Nach dem pnpm-spezifischen `pnpm.overrides`-Abschnitt sind Audit und zehn weitere Gates grün. Im zweiten vollen Lauf bestehen weiter 467 Tests und 2 sind übersprungen; derselbe Windows-Prozess-Sweep-Test erwartet bei `killTracked()` zwei Treffer und erhält einen. Keine Änderung am Prozess-Sweep-Code, da Ursache anhand dieses Umgebungsbefunds nicht gesichert ist. Die Linux-CI bleibt für den Merge entscheidend.

**Offen.** Lockfile aktualisieren, Pflichtpipeline ausführen, PR #39 aktualisieren und mergen. Anschließend lokale und entfernte WIP-Branches auf unintegrierte Arbeit prüfen.

## 2026-11-01 - Paketmanager von npm auf pnpm umgestellt

**Ziel.** Den Paketmanager auf pnpm umstellen, damit `pnpm-lock.yaml` das Lockfile ist und `package-lock.json` nicht mehr getrackt wird.

**Umsetzung.** `package.json` traegt `"packageManager": "pnpm@10.4.1"`; `package-lock.json` aus Git-Tracking entfernt (`git rm`), `pnpm-lock.yaml` bleibt trackt. `.npmrc` mit `allow-scripts=true` und `approved-builds=ffmpeg-static` beibehalten. Alle npm-Referenzen in Skripten (`scripts/*.mjs`, `scripts/lib/*.mjs`), GitHub Actions Workflows (`.github/workflows/*.yml`), `.githooks/pre-commit`, Pflichtdokumenten (`docs/*.md`) und `AGENTS.md` von `npm` auf `pnpm` umgestellt (`npm ci` → `pnpm install --frozen-lockfile`, `npm run` → `pnpm run`, `npm audit` → `pnpm audit`). `pnpm install` hat 293 Pakete installiert. Test `ci-gates.test.ts` erwartet `pnpm run test:perf` statt `npm run test:perf`.

**Pruefungen.** `typecheck` Exit 0; `lint` ohne Fehler; `verify:quick`: alle Doku-Gates (docs, tree, redundancy, assets, dead-code) PASS, typecheck/lint/check-loc/test-quality PASS. Ein pre-existing Test in `process-sweep.test.ts` (Abbruchpfad, SIGINT) schlaegt unabhaengig von der Migration fehl.

**Offen.** `verify:all` (inkl. Build, Audit, RTP/Balance/Soak) noch nicht lokal durchgelaufen; CI fuehrt es auf jedem Push aus.


**Ziel.** Zwei Befunde aus dem ersten Lauf von `agent:verify` beheben: ein sauberer Baum uebersprang das Testgate, und kein Gate traf den Cache.

**Umsetzung.** `agent-verify` setzt kein `skip` mehr, wenn der Diff keinen Testbezug hat — ohne Auswahl laeuft die Suite, und der Bericht nennt den Grund. `turn-push` ruft `doc-sync` jetzt vor `verify`; der Pre-Commit-Hook schrieb die Marker bisher danach und entwertete damit den Baum, der gerade geprueft wurde.

**Pruefungen.** Zweiter Lauf auf demselben Baum: `agent:verify` meldet `0s` und `[cached]` fuer die betroffenen Gates. `turn:finish` faehrt `verify:quick` mit bereits gesetzten Markern.

**Offen.** Der erste `--ci`-Lauf fuer die langen Nachweise steht aus.

## 2026-11-01 - Ein Prozess: Impact, Agentenkontext, Plan und Bericht

**Ziel.** Eine Aenderung einmal analysieren, einmal planen, einmal passend pruefen und zentral berichten — ohne zweite Pipeline und ohne doppelte Testlaeufe.

**Umsetzung.** `scripts/lib/impact.mjs` fuehrt zusammen, was schon existiert: `changedFiles`, `selectAffectedTests` (Importgraph inklusive dynamischer Importe und Re-Exports), Testkatalog mit Beweisklassen, `pipeline-plan` und `gate-cache`. `agent-context.mjs` gibt daraus kompakt aus, was ein Agent braucht; `agent-verify.mjs` plant dieselben Gates ueber `runGates`, laesst bei Impact-Auswahl nur betroffene Tests laufen (ohne Cache), delegiert lange Nachweise per `--ci` an Actions und schreibt `.verify-cache/reports/<Zeit>/agent-summary.json`. `turn-push` ruft statt des zweiten Testlaufs den Kontext; `test:ci` laeuft ueber `run-selected-tests.mjs`, damit eine Auswahl ueberhaupt adressierbar ist. Der Pre-Commit-Hook bricht ab, wenn Matrix oder Katalog nicht geschrieben wurden.

**Pruefungen.** `node --check` fuer alle geaenderten Skripte; `agent:context` nennt Systeme, Doku, Invarianten und die Delegationsgrenze; `verify:tree` PASS; `typecheck` Exit 0; neuer Nachweis `src/core/governance/__tests__/impact.test.ts` fuer Doku-ohne-Test, Config-alle-Tests, Graphtreffer und Proof-Trennung; `verify:quick` im Turn-Abschluss.

**Offen.** `agent:verify` ersetzt `verify:quick` fuer den Commit nicht; die volle Suite und die Release-Gates bleiben in CI. Der erste `--ci`-Delegationslauf ist noch nicht ausgefuehrt.

## 2026-11-01 - Config-Umzug nachgezogen: Capacitor-Datei wieder versioniert

**Ziel.** Der Umzug nach `src/Config/` darf keine Datei verlieren; die Pruefung zeigte, dass `capacitor.config.json` durch eine ungeankerte Ignore-Regel nie im Commit landete.

**Umsetzung.** `.gitignore` ignoriert nur noch die Laufzeit-Kopie in der Wurzel (`/capacitor.config.json`); `src/Config/capacitor.config.json` kommt aus der History zurueck. `prepare-android` kopiert sie waehrend des APK-Laufs und entfernt sie danach.

**Pruefungen.** `git check-ignore` prueft die Regel, `verify:tree` und `verify:docs` laufen im Turn-Abschluss, `verify:quick` deckt den Commit ab.

**Offen.** Der erste APK-Lauf mit der Kopie steht aus.

## 2026-11-01 - Review-Nachlauf: fatale Luecken der Promotion geschlossen

**Ziel.** Die Review fand zwei Luecken, die die Kette stillschweigend wirkungslos machen: ein Merge mit `GITHUB_TOKEN` startet keinen Workflow (kein CI auf `main`, kein Tag, kein APK), und `pr-cleanup` loescht die permanente Branch `integration`. Beides behoben, dazu die Wettlauf-Raender.

**Umsetzung.** `promote.mjs` waehlt `PROMOTE_TOKEN` als Merge-Token und stoesst ohne dieses Token `Auto Version & Release` an, das vor dem Tag `verify-commit-msg --head` ausfuehrt. `integration` ist in `pr-cleanup.yml` und `branch-prune.mjs` geschuetzt. `cancelled` ist kein Urteil, nur Push-Laeufe promoten, `gh pr update-branch` verhindert den Strict-Policy-Deadlock, der Integrations-Push wird begrenzt geschleift statt rekursiert. `verify-commit-msg --pr` weist einen leeren Body ab. Zusaetzlich kippte `narrative-start-pool` an einer Namenspruefung: `Rita Kern` ist eine moegliche Zufallskombination aus `NAMES` x `LAST_NAMES` in `src/core/sim/traits.ts`, die Zusicherung prueft jetzt das Profil (eine Visite, kein `START_POOL`-Fact) statt des Namens.

Dazu der Aufraeum-Umzug: die Werkzeug-Configs liegen jetzt in `src/Config/`, die Wurzel traegt keine Kopien mehr. `tsconfig.json` bekam `../src` als Include, `vite.config.ts` importiert den Harness ueber `../core/...`, und jeder Aufrufer bindet seinen Pfad explizit — sonst findet `vite`, `vitest`, `tsc`, `eslint`, die Dependency-Matrix, der Dead-Code-Gate oder der Gate-Cache die Datei nicht mehr. Capacitor sucht seine Konfiguration ausschliesslich im Arbeitsverzeichnis; `prepare-android` kopiert sie kurzzeitig in die Wurzel und entfernt sie nach dem Gradle-Lauf. `.mailmap` bleibt in der Wurzel, weil Git nur dort liest.

**Pruefungen.** `node --check` fuer beide Skripte; jede Ersetzung genau einmal angewandt (Skript bricht bei 0 oder 2 Treffern ab); `verify:quick` mit allen zehn Gates im Turn-Abschluss. Ein echter Merge in CI bleibt der offene Nachweis.

**Offen.** `PROMOTE_TOKEN` ist nicht gesetzt, der Anstoss-Pfad ist der aktive. Ob GitHub den Squash-Commit mit eigenem Token als Push wertet, zeigt der erste Lauf. Befund 3, 6 und 7 unveraendert.

## 2026-11-01 - Auto-Promotion: gruene Checks mergen, rote Staende auf die Integrationsbranch

**Ziel.** Der Weg von "Branch gepusht" bis "auf main" soll ohne Handgriff laufen: PR anlegen, Checks abwarten, bei Gruen mergen, bei Rot den Stand auf eine dauerhafte Integrationsbranch legen, damit dort repariert wird. Der Committer soll dabei immer der Eigentuemer sein, unabhaengig von Runner oder Sandbox.

**Umsetzung.** `scripts/promote.mjs` reagiert auf genau ein CI-Ergebnis. Gruen: PR suchen, sonst mit Titel und Pflichtsektionen anlegen, dann mit `--squash --subject --body-file` mergen — der Commit-Text traegt die drei Sektionen, weil `verify-commit-msg --head` sonst auf `main` rot wuerde. Rot: Label `integration/rot` setzen, alle so markierten offenen Branches einsammeln, `integration` aus `origin/main` aufsetzen (oder fortschreiben), jeden Stand per `git merge --no-ff` komponieren und pushen. Die Concurrency-Gruppe `promote` laesst genau einen Schreiber zu; ein abgelehnter Push wird mit `fetch` und `reset --hard` neu aufgesetzt und erneut gemergt, was idempotent ist. Identitaet: `scripts/lib/identity.mjs` als einzige Quelle, in `turn-push.mjs` fest an den Commit gebunden, im Workflow per `git config` gesetzt, dazu `.mailmap` fuer die Anzeige der History.

**Pruefungen.** `node --check scripts/promote.mjs` gruen; die beiden Patch-Ersetzungen in `promote.mjs` und `turn-push.mjs` je genau einmal angewandt (Skript bricht bei 0 oder 2 Treffern ab). `verify:quick` mit allen zehn Gates im Turn-Abschluss. Der erste `turn:finish`-Lauf war an `gate-runner.test.ts` rot (erwartete FAIL, bekam TIMEOUT bei paralleler Gate-Last); isoliert 4/4 gruen, danach der volle Lauf gruen — Lastkonkurrenz, kein Defekt am Stand; der Artefakt-Test der Gate-Auswertung laeuft jetzt mit 60 s Limit (30 s fuer die schnelle Probe), weil unter paralleler Gate-Last schon der Node-Start mehrere Sekunden braucht. Die Zusicherungen blieben unveraendert.

**Offen.** Der Promote-Workflow laeuft zum ersten Mal in CI; ein echter Merge und eine echte Integration sind damit noch nicht belegt. Der Verified-Badge haengt an GitHub-seitigen Merges: entweder `RBD_PROMOTE_AUTO_MERGE=1` mit der Repo-Vorgabe "PR-Titel und -Beschreibung" fuer Squash, oder ein Signaturschluessel. Befund 3, 6 und 7 stehen unveraendert.

## 2026-11-01 - Doku-Konsolidierung: Sortierung, Namensgleichheit und Repo-Hygiene

**Ziel.** Eine Doku, die man lesen kann, ohne zu raten: gleiche Namen, ein Ort pro Thema, keine Aussage, die einer anderen widerspricht. Dazu der lokale Repo-Zustand: Hooks aktiv, nichts Unsortiertes in der Wurzel.

**Umsetzung.** 16 Doku-Dateien liegen flach unter `docs/` und tragen Grossbuchstaben-Namen; `EVENT-NARRATIVE-ENGINE-TASKPLAN.md` und `CASINO-PIXEL-ASSET-PACK.md` ersetzen die beiden kebab-case-Ausreisser, `docs/assets/` entfaellt, `docs/ASSETS.md` verweist auf den neuen Pfad. Widersprueche korrigiert: Save v9 statt v8 in ARCHITECTURE und Inventar §8; "Narrative Engine ist noch nicht gebaut" ersetzt durch Stufe 1 gebaut / NAR-04+ nach Taskplan; Gate-Zaehlung und Gate-Reihenfolge in ARCHITECTURE, PRODUCT und AGENTS auf `scripts/lib/pipeline-plan.mjs` gezogen; Inventar-Kopf auf `main`/`c4e6e3b`/983 Dateien; §2, §3, §9–§13 auf Ist-Zahlen; Befund 5 und 42 als aufgeloest markiert, §17 auf umgesetzt. `docs/ERROR_CATALOG.md`: verschmolzene ERR-4013/ERR-4014-Zeile getrennt, Codes aufsteigend sortiert. Screenshot-README nennt wieder den echten Bestand. Repo-Hygiene: `pnpm run hooks:install` gesetzt (2 Hooks), Wurzel enthaelt nur `README.md` und `AGENTS.md` als Markdown. Beim Abschluss fiel der letzte Widerspruch auf: das Doku-Gate zaehlte `.turn-notes.md` als Wurzel-Doku und machte `turn:finish` rot, obwohl genau dieses Werkzeug die Datei anlegt; der Scan ueberspringt Dotfiles jetzt.

**Pruefungen.** `pnpm run inventory:build` regeneriert §18 (983 Dateien, 67 Ordner); `verify:docs`, `verify:tree`, `verify:redundancy` und `check:loc` gruen; danach `pnpm run verify:quick` mit allen zehn Gates gruen und Exit 0. Pre-Commit-Hook schreibt Matrix, Katalog und Marker, `turn:finish` bumpt auf 0.3.65, committet und pusht.

**Offen.** Befund 3 (ERR-4016 fuer das Asset-Gate), 6 (`opencode.json` mit Windows-Pfad) und 7 (Audit-Drift 373/323) bleiben stehen; `verify:all` mit Build und Audit laeuft in CI. `W3Champions/logs` ist fremde lokale Logware, bleibt gitignoriert und unangetastet.

## 2026-11-01 - Narrative Engine Stufe 1: Facts, Gedaechtnis, Start-Pool (NAR-00 bis NAR-03)

**Ziel.** Den Taskplan nicht nur beschreiben, sondern den ersten tragenden Schnitt
umsetzen — mit belegter Wirkung im Spiel, inklusive Start-Pool.

**Umsetzung.** Neuer Core-Bereich `src/core/sim/narrative/`: `types.ts` (Facts,
Erinnerungen, Grenzen), `facts.ts` (ID-Vergabe, Queue mit Deckel, idempotenter Drain),
`state.ts` (Startzustand, Start-Pool, sichere Normalisierung), `memory.ts`
(Fact→Erinnerung, deterministische Wirkung). `WorldState.narrative` ist der einzige
persistente Narrativ-Zustand; `Visitor.memories` haelt hoechstens sechs strukturierte
Erinnerungen. Facts entstehen an echten Uebergaengen: Spawn (erster Besuch /
Rueckkehr), Auszahlung (`VISIT_ENDED` aus `guest-service`) und neues Spiel
(`START_POOL` mit Startkapital). Save v9 traegt alles, v5–v8 werden normalisiert.

**Wirkung (nicht nur Speicherung).** `returnChance()` addiert den Erinnerungsbonus
(+4 Prozent je gutem, -6 je schlechtem Besuch, letzte doppelt, gedeckelt),
`spawnGuest()` gibt Rueckkehrern den Laune-Bonus mit. Konkret gemessen und in
`narrative-memory.test.ts` festgeschrieben: neutral 25 Prozent Rueckkehr, nach einem
guten Besuch 33, nach einem schlechten 13; die Spawn-Laune liegt genau um den
Erinnerungsbonus hoeher als in der Kontrollwelt mit identischem Seed. `seedStartPool()` setzt drei
bekannte Figuren und das Startkapital als Fact; die Rueckkehrer-Auswahl kann sie ab
Tick 0 treffen. Damit aendert sich messbar, wer wiederkommt und wie er ankommt.

**Nachweise (Vitest, am Turn-Ende).** `narrative-facts.test.ts` (IDs, einmalige
Verarbeitung, Queue-Deckel 48/12, JSON-Roundtrip, unbekannte Referenz, Flags ohne
Journal), `narrative-memory.test.ts` (Rueckkehr steigt/sinkt, letzte Erinnerung
doppelt, Deckel 6, Spawn-Laune differiert zur Kontrollwelt um genau den Bonus),
`narrative-start-pool.test.ts` (drei Figuren, Idempotenz, Rueckkehr ab Tick 0,
Kontrollwelt ohne Pool legt neues Profil an), `narrative-save.test.ts` (v9-Roundtrip,
v8-Defaults, zwei Welten nach 80 Ticks identisch).

**Offen.** NAR-04 bis NAR-17 (Beziehungen, Trigger, Scheduler, Event-Templates,
Command-DSL, Content-Compiler, Composer/LLM, UI, Rivalen, Soak) sind nicht umgesetzt.
Der Start-Pool ist bewusst nur im Store-Pfad fuer neue Spiele aktiv, nicht in
`createWorld()`, damit alte Saves ihre Besucherliste behalten.

## 2026-11-01 - Merge ohne PR-Body macht main rot (Vorfall und Reparatur)

**Ziel.** PR #32 mergen und `main` gruen halten.

**Vorfall.** Der Merge lief ueber die GitHub-API mit `commit_title`, aber ohne
`commit_message`. Der Merge-Commit `3c46ba6` trug damit nur den Klicktitel und
keine Pflichtsektionen. `verify-commit-msg --head` prueft auf `main` genau diesen
Commit und wurde rot: `[ERR-4006] Pflichtsektion fehlt: ### Changes (Was ist neu)`,
`### Technische Basis & Kausalitaet`, `### Ausblick (Naechste Schritte)`. Der Job
`Fail-Closed Gates` endete mit Exit 1; `Bump, tag, release` und der APK-Bau wurden
deshalb uebersprungen (conclusion `skipped`).

**Reparatur.** Kein Rewrite von `main`, kein Force-Push: Der Regeltext in
`AGENTS.md` nennt jetzt die API-Falle ausdruecklich (PR-Body gehoert in
`commit_message`), und dieser Doku-Commit traegt die drei Sektionen selbst. Damit
prueft `verify-commit-msg --head` wieder einen konformen HEAD, und die
Release-Kette laeuft erneut an.

**Lehre.** Ein gruener PR ist kein gruener `main`: Die Commit-Nachricht des
Merge-Commits ist Teil des Gates, nicht nur der PR-Body.

## 2026-11-01 - performance.now-Ausnahme auf Pacing verengt und als dicht belegt

**Ziel.** Beweisen, dass die Render-Ausnahme genau Pacing erlaubt und nicht mehr:
kein pauschales Datei-Allow, keine mitfreigestellten Identifier, und kein Weg
eines Wanduhr-Werts aus `src/render/**` in `src/core`, `src/store`, Composer/LLM
(A-10), Content-Compiler (A-11) oder die kuenftige Narrative Engine.

**Befund am Code.** `performance.now` kommt an genau fuenf Stellen vor, verteilt
auf drei Dateien: `src/render/floor-view.ts` (3), `src/render/music.ts` (2),
`src/render/floor-props.ts` (1). Die Sperre erlaubte sie trotzdem in **jeder**
Datei unter `src/render/**` — breiter als der Zweck. Zwei Uhr-Quellen fehlten
ausserdem komplett: `Date()` ohne `new` (liefert einen Wall-Clock-String) und
`performance.timeOrigin` (Epoch-Zeitstempel).

**Umsetzung.** `eslint.config.mjs` nennt die drei Pacing-Dateien jetzt namentlich;
alle anderen Render-Dateien fallen unter die strenge `src/**`-Regel und sind voll
gesperrt. `Date()` als Call (auch `globalThis.Date()`) und `performance.timeOrigin`
sind als Syntax-Selectoren ergaenzt; die Render-Ausnahme filtert weiterhin nur
`performance`-Selectoren heraus, `timeOrigin` bleibt also auch dort rot. Damit ist
in den drei Dateien genau ein Identifier erlaubt: `performance.now`.

**Proben (24, `npx eslint --stdin --stdin-filename <pfad>`).** Gruen nur:
`performance.now` in den drei Pacing-Dateien, der Alias `const p = performance; p.now()`
und `globalThis.performance.now()`. Rot in denselben Dateien: `Math.random`,
`Date.now`, `new Date()`, `Date()`, `performance.timeOrigin`, `getRandomValues`,
`randomUUID`, `globalThis.Math.random`, `window.Date.now`, `const { random } = Math`,
`Math["random"]`, `Date["now"]`. Rot ausserhalb der drei Dateien: `performance.now`
in `src/render/guest-art.ts`, `src/ui/Hud.tsx`, `src/core/sim/tick.ts` und in
`scripts/**` (dort zusaetzlich `Date.now`, `new Date`, `Math.random`).

**Rot/Gruen am echten Stand.** `Math.random()` an `src/render/music.ts` und
`Date.now()` an `src/render/floor-view.ts` angehaengt: `pnpm run lint` Exit 1 mit
vier Fehlern (`no-restricted-properties` und `no-restricted-syntax` je Quelle).
Nach `git checkout --` beider Dateien: Exit 0. `performance.now()` in einer
vierten Render-Datei (`guest-art.ts`): `npx eslint src/render/guest-art.ts` Exit 1,
zwei Fehler — die Ausnahme ist also nicht datei-pauschal.

**Datenfluss (gelesen, nicht geplant).** `src/core` und `src/store` importieren
nichts aus `src/render` (0 Treffer, Tree-Gate erzwingt Core-Importe nur aus
`src/core`). `src/render` importiert aus `src/store` ausschliesslich
`import type { GameView }` (7 Treffer, alle type-only) und ruft keinen Command.
`world.tick += 1` steht nur in `src/core/sim/tick.ts`; `tick`/`day` werden sonst
nur beim Laden (`migrate.ts`) und fuer fremde Etagen (`foreign-floor-tick.ts`,
`floor.day = world.day`) gesetzt. Kein Command nimmt `tick`/`day`/`time`; die
einzige Ausnahme `buyBarCmd(world, ledger, tick)` wird ausschliesslich von
`world-store` mit `this.#world.tick` aufgerufen und stempelt nur die Ledger-Zeile.
Composer/LLM und Content-Compiler existieren noch nicht; `scripts/**` ist bereits
gesperrt, damit sie die Uhr auch spaeter nicht lesen koennen.

**Pruefungen.** `lint`, `verify:test-quality`, `verify:docs`, `verify:tree`,
`verify:redundancy`, `check:loc`, `tsc --noEmit`, `inventory:build` lokal gruen;
Vitest und `verify:all` laufen in CI.

**Offen.** Innerhalb der drei Pacing-Dateien ist `performance.now` nicht auf eine
Codezeile festnagelbar — ESLint sieht keinen Zweck, nur den Identifier; die
Dateiliste ist die engste Grenze ohne neuen Produktivcode. `performance.timeOrigin`
und `Date()` sind jetzt ueberall rot, `performance.mark/measure` bleiben erlaubt
(reine Messmarken, kein lesbarer Uhrwert).

## 2026-11-01 - Determinismus-Sperre fail-closed gehaertet

**Ziel.** Beweisen, dass die Sperre haelt — nicht nur, dass sie dokumentiert ist.

**Befund (gemessen, 20 Proben gegen `npx eslint --stdin`).** Sieben Umwege kamen
durch: `globalThis.Math.random` und `window.Math.random`, `new globalThis.Date()`,
`crypto.getRandomValues` und `crypto.randomUUID` (standen nie in der Regelliste),
`eslint-disable-next-line`, der pauschal freigestellte `src/core/rng/streams.ts`
und **alle** `scripts/**`-Dateien — inklusive des kuenftigen Content-Compilers.
Zusaetzlich hatte `verify-test-quality` eine stille Kommentar-Ausnahme
(`@seed-initializer`), die eine Zufallsquelle in `src/core` und `src/store`
durchgelassen haette.

**Umsetzung.** `eslint.config.mjs` erfasst jetzt Namespace-Umwege
(`globalThis`/`window`), `new`-Umwege, computed Zugriffe, Krypto-Selectoren fuer
`getRandomValues`/`randomUUID` und `scripts/**` per Default. `linterOptions.noInlineConfig`
schaltet `eslint-disable` global ab, damit kein Kommentar die Sperre aufhebt.
`src/core/rng/streams.ts` verliert die Pauschal-Freistellung: dort ist nur noch
Krypto erlaubt, `Math.random` und Uhr bleiben verboten. Sieben Tooling-Skripte
(Zeitstempel, CI-Polling, Gate-Logs) sind namentlich und begruendet ausgenommen und
duerfen weiterhin keinen Zufall ziehen. Die `@seed-initializer`-Ausnahme in
`verify-test-quality` ist entfernt — sie war unbenutzt und damit nur eine Tuer.

**Rot/Gruen-Beleg.** `export const __determinismProbe = Math.random();` an
`src/core/sim/tick.ts` angehaengt: `pnpm run lint` endet mit Exit 1 und meldet
zwei Fehler in Zeile 140 (`no-restricted-properties` und `no-restricted-syntax`).
Nach `git checkout -- src/core/sim/tick.ts`: `pnpm run lint` Exit 0.

**Pruefungen.** `lint`, `verify:test-quality` (87 Testdateien),
`verify:tree`, `verify:redundancy`, `check:loc`, `tsc --noEmit`,
`inventory:build` (971/971) lokal gruen; `verify:docs` im Commit-Hook. Vitest und
`verify:all` laufen in CI.

**Offen.** `performance.now()` bleibt in `src/render/**` fuer Bild-/Ton-Pacing
erlaubt; dieser Wert beruehrt nie den Spielzustand. Kein neues Gate, keine neue
Abhaengigkeit.

## 2026-11-01 - Event-Engine-Taskplan adversarial gehaertet

**Ziel.** Den bestehenden 18-Task-Plan (NAR-00…NAR-17) gegen sich selbst
pruefen: keine Annahme ungeprueft, kein Task gestrichen, jede Erkenntnis mit
Gegenmassnahme und Systembezug.

**Befund.** Drei Planfehler sind am Code belegbar. Erstens war die Gate-Liste in
§3 veraltet: `deps-matrix` und `catalog` sind seit dem Hook-Umbau keine Gates
mehr, `docs`, `tree` und `redundancy` fehlten. Zweitens kannte der Pruefstand
`708d31c` die Determinismus-Sperre nicht, obwohl die Narrative Engine die
wahrscheinlichste Stelle fuer neues `Math.random` ist. Drittens setzte die
Reihenfolge NAR-12 (Tick-Integration) vor NAR-13 (Demand-Migration) und haette
damit fuer die Dauer der Umsetzung zwei aktive Event-Wahrheiten erzeugt. Dazu
kamen 17 weitere Angriffe, unter anderem Ledger-Index gegen Buchungs-`seq` beim
Fact-Cursor, `VISITOR_CAP = 40` mit `splice(oldest)` gegen laufende Stories,
halbe Beziehungskanten nach Archivierung, unbegrenzte Cooldowns, `FREEZE_TICK`
ohne Einheit, halb angewendete Command-Batches, LLM-Injection und Bundle-Wachstum.

**Umsetzung.** §9 (20 Angriffe mit Befund, Gegenmassnahme und Taskbezug), §10
(Systemmatrix ueber 20 Systeme), §11 (korrigierte Reihenfolge: NAR-13 vor NAR-12,
10 vor 11, 06 vor 07), §12 (Definition of Done je Task mit Pflicht-Gate) und §13
(Aenderungsprotokoll) ergaenzt. Kopf auf `7cca88a` aktualisiert, die Gate-Liste in
§3 an `scripts/lib/pipeline-plan.mjs` angeglichen, der Drift-Absatz praezisiert:
`poker-distribution` laeuft im Quick-Profil, `balance-operating` ist ohne
`RBD_BALANCE` inaktiv.

**Pruefungen.** `verify:docs`, `verify:tree`, `verify:redundancy`, `check:loc`,
`lint`, `typecheck` und `inventory:build` lokal; Vitest und `verify:all` laufen in
CI. Kein Produktivcode geaendert.

**Offen.** Der Plan bleibt ein Plan: keine NAR-Umsetzung, kein Save v9. Die
Reihenfolgekorrektur bindet die Umsetzung, nicht rueckwirkend gemergte Arbeit.

## 2026-11-01 - Determinismus: kein Math.random und keine Wanduhr im Spielzustand

**Ziel.** Kein `Math.random()` und keine vergleichbare Streuquelle im Spiel:
gleicher Seed und gleiche Ticks muessen denselben Zustand und denselben Export
ergeben.

**Befund.** `Math.random()` war seit der RNG-Trennung aus Renderer und Sound
verschwunden, aber drei Nebentueren blieben offen. `world-store` seedete den PRNG
mit `Date.now()` (Feld-Initialisierung und `newGame`), `exportGameData` stempelte
den Export mit `new Date().toISOString()`, und der Musik-Crossfade mass seine
Fadezeit an `Date.now()`. Gleicher Stand ergab damit nicht zwingend dieselben
Bytes.

**Umsetzung.** `entropySeed()` in `src/core/rng/streams.ts` ist jetzt der einzige
Entropie-Eingang (Krypto, ohne Fallback); `presentationSeed()` und beide
Seed-Stellen im Store ziehen nur noch daraus. Der Export traegt `Tag X, Tick Y`
aus der Welt statt eines Uhrzeitstempels. Der Musik-Fade nutzt `performance.now()`.
`eslint.config.mjs` verbietet in `src/**` `Math.random`, `Date.now`,
`performance.now` und `new Date()`; `src/render/**` darf `performance.now` fuer
Pacing lesen, `src/core/rng/streams.ts` ist die einzige Ausnahme fuer die
Krypto-Entropie. Neuer Test `src/store/__tests__/determinism.test.ts` faehrt zwei
Laeufe mit demselben Seed und vergleicht den vollstaendigen Export.

**Pruefungen.** `pnpm run lint` (neue Regel), ESLint-Probe per `--stdin` (vier
Treffer in `src/core`, kein Treffer fuer `performance.now` in `src/render`),
`tsc --noEmit`, `check:loc`, `verify:test-quality` (87 Testdateien),
`verify:dead-code` (775 Exporte), `verify:tree`, `verify:redundancy`. Vitest lief
nicht lokal; die neuen Tests und `verify:all` laufen in CI.

**Offen.** Die Start-Entropie bleibt echt zufaellig: Determinismus heisst
Wiederholbarkeit ab gespeichertem `prngState`, nicht ein fester Startseed.

## 2026-11-01 - RNG-Namespaces getrennt

**Ziel.** Gameplay und Darstellung duerfen nie denselben Zufallsstrom ziehen; sonst
verschiebt ein Partikeleffekt den naechsten Gegnerspawn.

**Befund.** Partikel (`src/render/fx/emitter.ts`) und Rauschen
(`src/render/sound-fx.ts`) nutzten `Math.random()` — getrennt vom Spielstrom,
aber unbenannt und nicht gegen kuenftige Vermischung geschuetzt. Poker zieht
bewusst einen Gameplay-Strom aus dem gedealten Seed, das bleibt Spielzustand.

**Umsetzung.** `Prng` traegt eine Rolle (`gameplay` | `presentation`).
`src/core/rng/streams.ts` liefert `presentationRng`, `presentationSeed` und
`assertGameplayRng`; `src/render/rng.ts` haelt den einen Darstellungs-Strom,
Emitter und Sound ziehen nur noch daraus. `tickWorld` und `playRound` rufen den
Guard auf und brechen bei einem presentation-Strom mit klarer Meldung ab.

**Pruefungen.** `tsc --noEmit`, ESLint, `check:loc`, `verify:docs`,
`verify:tree`, `verify:redundancy` lokal gruen. Vitest lief nicht lokal; die
neuen Tests (`streams.test.ts`) und `verify:all` laufen in CI.

**Offen.** Der Darstellungs-Seed ist absichtlich nicht im Save: visuelle
Wiederholbarkeit nach einem Reload ist kein Spielzustand.

## 2026-11-01 - main in den Inventar-Branch gemergt

**Ziel.** PR #27 mergebar machen, ohne die Asset-Arbeit von `main` zu verlieren.

**Umsetzung.** `main` (`ee882da`, drei Commits, +485 Zeilen in Renderer und UI)
in den Branch gemergt. Zwei Konflikte: `src/main.tsx` (Runtime-Art-Preload von
`main` plus `./styles/index.css` aus diesem Branch) und die generierte
Dependency-Matrix in `docs/ARCHITECTURE.md` (Zaehlungen beider Seiten, danach
vom Hook neu erzeugt).

**Pruefungen.** `verify:docs` inklusive Inventar-Abdeckung, `verify:tree`,
`verify:redundancy`, `check:loc`, ESLint und `tsc --noEmit` lokal gruen; die
neuen Renderer-Dateien und fuenf Screenshots stehen im regenerierten Abschnitt 18.
Vitest lief nicht lokal; der Beweis bleibt `verify:all` in CI.

## 2026-11-01 - Inventar-Generator idempotent gemacht

**Befund.** Bei der Verifikation der Auslieferung fiel auf: Nach einem testweise
entfernten Eintrag stellte `pnpm run inventory:build` den Block nicht byte-identisch
wieder her, der Arbeitsbaum blieb eine Zeile dirty. Ursache war der Selbsteintrag
von `docs/INVENTORY.md`: Er beschrieb seine eigene Zeilenzahl, die der Generator
beim Schreiben gerade veränderte — der Block hing damit von seinem eigenen
Vorzustand ab.

**Umsetzung.** Der Selbsteintrag trägt jetzt einen stabilen Status („gepflegt:
Marker und Abschnitt 18“) statt einer Zeilenzahl; alle anderen Einträge bleiben
messbar. Zwei Generatorläufe hintereinander ergeben denselben Hash.

**Prüfungen.** Datei-Eintrag entfernt → `verify:docs` Exit 1; Ordner-Eintrag
entfernt → Exit 1; nach `inventory:build` ist die Datei SHA-256-gleich zum
Ausgangsstand und das Gate grün. Vitest lief nicht lokal; der Beweis bleibt CI.

## 2026-11-01 - Vollständige Inventur mit erzwungener Abdeckung

**Ziel.** Nicht die interessanten Stellen, sondern jede getrackte Datei: eine
Zeile je Pfad, ein Eintrag je Ordner, und eine Prüfung, die eine Lücke rot macht.

**Umsetzung.** `scripts/build-inventory.mjs` liest `git ls-files`, öffnet jede
Datei und schreibt den Block zwischen `inventory:start` und `inventory:end` in
`docs/INVENTORY.md`. Textdateien liefern Zeilenzahl und Kopfkommentar,
PNG-Dateien ihre IHDR-Maße, OGG-Dateien ihre Signatur; Sammelzeilen gibt es
nicht. `verify:docs` vergleicht den Block mit dem Index, prüft die 64 Ordner
und die Abdeckungszahl. Der Pre-Commit-Hook baut die Liste vor dem Marker, die
Abdeckung kann also nicht stillschweigend veralten.

**Befunde beim Bauen.** Shell-Hooks ohne Endung wurden zunächst als Binärdatei
geführt — die Erkennung fragt jetzt nach NUL-Bytes statt nach der Endung. Der
Changelog trug `[0.3.65]`, während `package.json` und alle Marker `0.3.64`
sagten; die Überschrift ist auf `0.3.64` gezogen.

**Prüfungen.** Drei Rot-Tests gegen das Gate: eine entfernte Datei, ein
entfernter Ordner und eine falsche Abdeckungszahl brechen jeweils mit
`ERR-4017` ab; danach ist der Lauf wieder grün. `verify:tree`,
`verify:redundancy`, `check:loc`, ESLint und `tsc --noEmit` lokal grün. Vitest
lief nicht lokal; der Beweis bleibt `verify:all` in CI.

**Offen.** Der Lizenznachweis für die 552 Dateien unter `public/` liegt weiter
beim Betreiber; inhaltlich geprüft sind Signatur und Größe, nicht die Rechte.

## 2026-11-01 - Tree-Gate, Redundanz-Gate und Doc-Generierung

**Ziel.** Jede Datei am richtigen Ort, keine doppelte Wahrheit und ein Befehl,
der Changelog, Devtagebuch und Inventar mechanisch anlegt.

**Umsetzung.** `scripts/verify-tree.mjs` prueft Wurzel-Whitelist, erlaubte
Endungen je Ordner, Testablage in `__tests__` und die Importrichtung von
`src/core`. `scripts/verify-redundancy.mjs` vergleicht Dateiinhalte per
SHA-256, pnpm-Kommandos und Fehlercodes; Alias-Paare sind ausdruecklich erlaubt.
`scripts/doc-stub.mjs` schreibt die drei Pflichteintraege mit Datum, Version
und Uhrzeit. Beide Gates laufen im schnellen und im vollen Profil.

**Befunde beim ersten Lauf.** `src/index.css` lag neben `main.tsx` und wanderte
nach `src/styles/`; `eslint.config.mjs` und `opencode.json` fehlten in der
Wurzel-Whitelist; `scripts/init-github.sh` ist als Bootstrap-Shell erlaubt.
Der Umzug brach zunaechst die drei `@import`-Pfade; der CI-Build fand es, jetzt
sind sie relativ (`./tokens.css`, `./app.css`, `./popup.css`).

**Pruefungen.** `verify:tree`, `verify:redundancy`, `verify:docs`, ESLint,
`tsc --noEmit` und `check:loc` lokal gruen. Vitest lief nicht lokal; der Beweis
bleibt `verify:all` in CI.

**Bestaetigt.** Der CI-Lauf zu `37affc5` ist gruen: „Fail-Closed Gates“ und „Commit-Body in PR-Body heben“ stehen auf success; Tree- und Redundanz-Gate laufen dort mit. Vitest und Build liefen ausschliesslich in CI.

## 2026-11-01 - CI-Befund behoben (T12)

**Befund.** Lauf #110 (`CI Verify`, Commit `f2f46c7`) war rot: 438 Tests gruen,
zwei rot. `src/core/governance/__tests__/pipeline-modes.test.ts` verlangte noch
`GATES['deps-matrix'].args === ['--check']` und `quick` mit `deps-matrix`.

**Ursache.** Der Gate-Plan wurde bewusst geaendert, der Testvertrag nicht
mitgezogen. Der Test ist damit kein falscher Alarm, sondern eine echte
Nachweispflicht.

**Behebung.** Der Test prueft jetzt `GATES.docs` (Skript, keine Argumente) und
`quick` mit `docs` sowie ohne `deps-matrix`/`catalog`; die Regel "kein Gate
repariert" bleibt unveraendert. Kein Gate wurde wieder eingefuehrt.

**Pruefungen.** ESLint, Doc-Gate, Typecheck lokal; der Beweis laeuft im
naechsten `CI Verify`-Lauf.

## 2026-11-01 - Connector-Eskalation (T11)

**Ziel.** Agenten ohne `gh`-Token sollen den PR-Body trotzdem heben koennen.

**Umsetzung.** `scripts/lift-commit-body.mjs` kennt jetzt `--json` (und
`--connector`): Der Plan enthaelt `level`, `channel: github-connector`, `branch`,
`base`, `title`, `bodyFile` und `body`. CI nutzt weiter `gh`; scheitert das,
bleibt der Lauf gruen und der Plan ist die Uebergabe. Der Level stammt aus
`scripts/lib/escalation.mjs`, es entsteht keine zweite Klassifikation.

**Pruefungen.** ESLint ueber `scripts/`, Doc-Gate, JSON-Ausgabe im Trockenlauf.

**Offen.** Der Connector-Weg ist beschrieben, aber noch nicht in einem echten
Agentenlauf benutzt.

## 2026-11-01 - Governance, Eskalation und Import/Export

**Ziel.** Fehlschlaege sollen zuerst automatisch loesbar sein: reparieren, in CI
wiederholen, erst dann ein Agent. Dazu Pflichtdoku mit Version und Zeitstempel,
ein Doc-Gate mit Strukturvorgaben und ein sauberer Wurzelbaum.

**Umsetzung.**

- `scripts/lib/escalation.mjs`: eine Leiter fuer alle Befunde, Klassifikation
  ueber Regeln (Ledger/Geld blockiert, Doku/Format automatisch, Netz transient,
  Scope lokal, Rest Agent).
- `scripts/lib/doc-sync.mjs` plus `scripts/doc-sync.mjs`: Marker
  `<!-- rbd-doc: v0.3.87 | 2026-11-03 06:20 UTC -->` in sechs Pflichtdokumenten;
  `verify:docs` prueft Marker, Pflichtabschnitte, Wurzel-Whitelist und Doppelungen.
- `.githooks/pre-commit` schreibt Matrix, Katalog und Doku-Marker und prueft
  danach Doku und LOC; `.githooks/commit-msg` eskaliert statt zu blockieren.
- `pr-escalation.yml` hebt einen Commit ohne Pflichtsektionen in den PR-Body.
- Import/Export: `src/core/io/{issues,envelope,repair}.ts` und
  `src/store/transfer.ts`; die Oberflaeche sitzt im Pruefungs-Popup.
- Pipeline: `deps-matrix` und `catalog` sind keine Gates mehr, `docs` ersetzt sie.

**Pruefungen.** Statische Gates (Lint, Typecheck, LOC, Doc-Gate) liefen lokal;
Vitest wurde bewusst nicht gestartet, weil Tests laut Auftrag ausschliesslich
ueber GitHub Actions eskaliert und dort geloest werden. Der volle Beweis bleibt
`verify:all` in CI.

**Bewusst nicht getan.** Kein Save-Format-Wechsel (bleibt v8), keine Migration
der Narrativ-Engine (NAR-00..16 bleibt Plan), keine Aenderung an Geldpfaden.
