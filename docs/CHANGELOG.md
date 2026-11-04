# Changelog

<!-- rbd-doc: v0.3.96 | 2026-11-04 03:21 UTC -->

Kurz, versionsweise, was sich fuer Spieler und Agenten geaendert hat.
Neuester Eintrag oben, jeder Eintrag mit Datum.

## Regeln

- Jede Aenderung bekommt einen Eintrag unter der Version, die `package.json` traegt.
- Kein Eintrag ohne Datum; Uhrzeit steht im `rbd-doc`-Marker am Dateikopf.
- Sichtbare Aenderungen unter "Spiel", interne Umbauten unter "Technik".
- Der Eintrag wird im selben Commit geschrieben wie die Aenderung, nie nachtraeglich.

## [0.3.96] - 2026-11-04

### Technik
- A3: `scripts/lib/affected-tests.mjs` erkennt jede JSON-Datei unter `content/narrative/**` ueber `NARRATIVE_DATA_RE`, setzt `codeChanged = true` und waehlt ausschliesslich `src/core/governance/__tests__/narrative-content.test.ts`. Content-Aenderungen laufen damit nicht mehr ins Leere und fallen nicht in den Subsystem-Fallback; ein Governance-Test deckt die exklusive Auswahl ab.

## [0.3.95] - 2026-11-04

### Technik
- A1: Der Pre-Commit-Hook zieht `build-inventory`, `doc-sync --staged`, `verify-docs` und `check-loc` vor den `node_modules`-Fruehausstieg. Diese Schritte lesen nur Dateien und Git und blockieren den Commit jetzt auch in einem frischen Klon. Nur Dependency-Matrix und Testkatalog bleiben hinter dem Ausstieg, weil sie `typescript` aus `node_modules` laden. Ein temporaeres Hook-Repo belegt beide Reihenfolgen und den LOC-Blocks ohne `node_modules`.

## [0.3.94] - 2026-11-04

### Technik
- Governance-Test fuer NAR-09: Eine temporaere Fixture kopiert `content/narrative/**` und schreibt `registry.generated.ts`, `slot-map.generated.ts` sowie `fragments.json` ueber `renderRegistry`/`renderRuntimeRegistry`/`renderSlotMap`. Der gruene Pfad prueft alle Zaehler und den Content-Hash; derselbe Test belegt, dass eine unregistrierte JSON-Datei, ein fehlendes Pflichtfeld trotz Manifest sowie Unterordner, Behelfsdateien (`.txt`, `.md`, `.tmp`, `.bak`) und versteckte Dateien fail-closed mit `ERR-4022` scheitern. Weiterhin eine Testdatei, 224 Zeilen.

## [0.3.93] - 2026-11-04

### Technik
- A3: `.githooks/pre-commit` prueft den Narrative-Content vor dem `node_modules`-Fruehausstieg. Gestagte Narrative-Dateien mit unstaged Aenderungen blockieren mit `ERR-4022`, damit der Validator nie einen anderen Inhalt sieht als den Commit; ein Validatorfehler beendet den Hook mit `ERR-4022`. Kein Vitest, kein `verify:quick`; die restliche Hook-Reihenfolge bleibt.

## [0.3.92] - 2026-11-04

### Technik
- A2: `readContributions()` ist fail-closed. Unterordner, Symlinks, versteckte Namen, `.md`/`.tmp`/`.bak` und JSON-Dateien ausserhalb des Content-Musters werden als `ERR-4022` gemeldet statt ignoriert; nur sichtbare regulaere `<datum>-<turn>.json` werden geparst. Manifest-1:1 und Registry-Hash bleiben die alleinige Vollstaendigkeitspruefung. Ein Governance-Test deckt alle Eintragsarten mit einem temporaeren Inbox-Fixture ab; `docs/NARRATIVE-ENGINE.md` Abschnitt 17 ist nachgezogen.

## [0.3.91] - 2026-11-04

### Technik
- Korrektur der Narrativ-Entscheidungen: Die Disposition wirkt E2E vollstaendig statt nur in `offerScore()`. D4 umfasst jetzt Aktivitaetsschwellen (±8 Punkte), Spielwahl (±20 %) und Rueckkehr (±10 Prozentpunkte); D5 erlaubt die begrenzte Verschiebung der Service-/Sozialschwellen, waehrend kritische Beduerfnisse, Geld, Platz und Geraetezustand vorrangig bleiben. Noch kein Code.

## [0.3.90] - 2026-11-04

### Technik
- `docs/NARRATIVE-ENTSCHEIDUNGEN.md` beantwortet die fuenf offenen Punkte verbindlich: Content-Batch (mehrere Contributions pro Turn), sieben neue Kontexte, `COUNTER_RIVAL` mit Chain-Template statt zweitem Fact, E2 nur in `offerScore()` und unveraenderte Service-Schwellen in `chooseActivity()`. Die Umsetzung steht noch aus.

## [0.3.88] - 2026-11-03

### Technik
- Profilweg und Geschichten-Historie: `buildNarrativeView()` nimmt Gaeste auf dem Floor in die Besucherprofile auf und liefert die juengsten zwoelf abgeschlossenen Szenen als `history` (Status, Ausgang, Teilnehmer, Abschlusstakt). Das Gast-Popup oeffnet ueber `onProfile(visitorId)` direkt das Profil; `NarrativePopup` startet dafuer im Figuren-Tab. Das Journal hat den Tab „Geschichten“ und zeigt dieselbe Ableitung, keine zweite Log-Quelle.
- NAR-17 abgeschlossen: `ARCHITECTURE.md`, `PRODUCT.md`, `AGENTS.md`, `NARRATIVE-ENGINE.md`, `ROADMAP.md` und der Taskplan nennen Save v10 (`vcoin.casino.v10`, Migration v5–v9) und den persistenten Rivalen-Zustand; `TRIGGER_DIALOG` ist als bis zur Dialogfuehrung nicht ausfuehrbar beschrieben. `demandEvent` erscheint nur noch als Migrationsfeld in `SavedGame`/`migrate-narrative.ts`. Testkatalog und Inventur sind regeneriert.
- CI-Eskalation: `src/core/governance/error-codes.ts` traegt pro Code ein Feld `level` (`AUTO_FIX`, `LOCAL_GATE`, `REMOTE_CI`, `AGENT`, `BLOCKED`). `scripts/lib/escalation.mjs` liest die Stufe zuerst aus dem Code, Textmuster bleiben als Fallback.
- ERR-4008 bleibt fuer den Push auf den Arbeitsbranch. Neu: ERR-4023 `DIRECT_PUSH_REJECTED` (abgelehnter Direktpush auf `main`, Stufe AGENT) und ERR-4024 `LOCAL_GATE_RED` (rotes lokales Gate in `turn:finish`, Stufe LOCAL_GATE). Register und `docs/ERROR_CATALOG.md` sind gleich.
- PR-Watcher: Fingerprint aus Code und erster Fehlerzeile des Gate-Logs. Ein bekanntes Issue (offen oder geschlossen) bekommt den Kommentar "Vorgekommen: N mal, zuletzt <Run-Link>" und wird nicht wieder geoeffnet. Die Suche laeuft in einer Hilfsfunktion `findIssue`. Zaehlung nur in CI.
- `.github/workflows/pr-watcher.yml` mit `actions: read`; der Watcher-Commit e7294f4 ist auf den Branch uebernommen.
- AGENTS.md: Direktpush auf `main` ist durch das Ruleset gesperrt. Der Weg ist Arbeitsbranch, PR, Promotion. Die Rootcause-Analyse steht in `docs/GATE-ROOTCAUSE.md`; AGENTS.md verweist nur darauf. Neue Zeile zu Lokal vs. CI.
- Ruleset-Pruefung (Schritt 0) nicht verifiziert: kein authentifizierter Zugriff per `gh`. Das Ergebnis steht im Audit, das Ruleset ist unveraendert.

## [0.3.87] - 2026-11-03

### Technik
- Narrative-Review-Befunde S1 bis S16: Expiry, Demand, Slot-Map, Preflight, Locale, Migration, Duplikat, totale Ausfuehrung, ENGINE_DEMAND, maxOccurrences, legacy-Demand, guard-Flush, degraded, Doku
- NAR-14 abgeschlossen: `narrative/view.ts` leitet aktive Szenen und Besucherprofile rein aus Welt, Ledger und Composer ab (Titel/Text/Choice-Labels aus der Registry, Sperrgruende aus `checkChoiceSelection`); `GameView.narrative` traegt das Ergebnis, `NarrativePopup` zeigt Szenen mit Frist, gesperrten Choices samt Grund, Profilen mit Besuchen, Erinnerungen und Beziehungen. `dismissNarrativeCmd` lehnt eine Szene ueber den Lifecycle ab (`CANCELLED`, Cooldown, Journal-Zeile); `TRIGGER_DIALOG` bleibt bis zur Dialog-UI nicht ausfuehrbar. Keine Trigger-, Effekt- oder Geldlogik in React.
- NAR-13 abgeschlossen: `events/demand-definitions.ts` beschreibt Neon-Nacht und Turnierabend als Daten (Nachfrage pro Tag, Laufzeit, Gruppenzuschlag, Starttext), `narrative/demand-events.ts` startet und beendet sie als aktive GLOBAL-Instanzen der gemeinsamen Event-Engine. `demandBreakdown()`, `groupSize()` und `expectedGroupSize()` lesen nur noch die aktive Instanz; `NarrativeState.demandEvent` ist entfernt.
- v5–v9-Saves mit `demandEvent` (Weltfeld oder Narrativ-Slice) werden beim Laden in eine aktive Instanz mit Restlaufzeit konvertiert; abgelaufene Veranstaltungen verfallen, bestehende Instanzen verhindern Duplikate. Neue Saves enthalten nur noch `narrative.events`.
- `sourceFactId: 0` ist fuer engine-erzeugte Events ohne ausloesenden Fact reserviert. Fuenf neue Tests decken Definitionen, Start/Duplikat, abgeleitete Anzeige und Fristablauf ab; `demand.test.ts` und `narrative-save.test.ts` pruefen die unveraenderte Wirkung und die Migration. Die Content-Registry waechst auf 22 Fragmente.

## [0.3.86] - 2026-11-03

### Technik
- NAR-12 abgeschlossen: `src/core/sim/narrative/runtime.ts` ist der einzige Orchestrator und verarbeitet in fester Reihenfolge Simulation → Facts → Memory/Relationships → Trigger → Scheduler → Events/Choices → Journal/Snapshot. `processNarrativeRuntime()` drainiert den Boundary genau einmal, wertet die deklarativen Trigger aus `events/trigger-definitions.ts` aus und plant ueber `scheduleCandidates()` hoechstens drei neue Event-Instanzen; neue Facts warten auf den naechsten Lauf.
- `tickWorld()` ruft die Runtime am Tick-Ende. `src/store/narrative-commands.ts` liefert `flushNarrativeCmd()` und `chooseNarrativeCmd()`; `world-store.ts` flusht nach jeder erfolgreichen Command-Ausfuehrung sowie nach Neues Spiel, Import und Rivalenspiel, nicht in `#emit()`. `spawn.ts` und `guest-service.ts` drainieren nicht mehr selbst.
- Eine erfolgreiche Choice emittiert den neuen Fact `EVENT_RESOLVED` (`eventId`, `eventKind`, `choiceId`, `outcomeId`); damit ist der Kreis Fact→Event→Choice→Command→Fact auch im Erfolgsfall geschlossen. Der Fact wird erst im naechsten Flush verarbeitet, nie rekursiv. Schema, Save-Roundtrip und die 21. Content-Registry sind nachgezogen.
- Neue Tests: `narrative-runtime.test.ts` (Trigger→Scheduler, Tick-Anbindung, Drei-Event-Grenze, Idempotenz, Save-Roundtrip) und `narrative-commands.test.ts` (Store-Flush, Erfolgs- und Ablehnungspfad, wiederholter Klick). `narrative-save.test.ts` sucht sein `SAVE_EVENT` jetzt ueber die `eventId`, weil der Tick seit NAR-12 seedabhaengig echte Rueckkehrer-Events plant und `events[0]` nicht mehr stabil ist.

## [0.3.85] - 2026-11-03

### Technik

- NAR-11 abgeschlossen: `src/core/sim/narrative/composer/` verbindet Template-Slots mit der validierten Registry. Locale, Kontextschnitt, benoetigte Flags und Persona-Refs filtern fail-closed; der stabile Score entscheidet, Gleichstand nach `contributionId`. Kein Gameplay-PRNG, kein Netzwerk, kein Provider.
- Fehlende Slots erhalten kurze lokale Fallbacks ohne Figuren, Fakten, Choice-IDs, Kosten oder Wirkungen. Ungueltige Fragmente und Direktiven werden gemeldet und uebersprungen; Direktiven werden nur als typisierte ASTs weitergereicht, nie ausgefuehrt.
- Der NAR-10-Compiler erzeugt zusaetzlich `src/core/sim/narrative/composer/registry.generated.ts` als typisierten Core-Spiegel. `--check` und das Assets-Gate vergleichen JSON und TypeScript byte-genau; der NAR-11-Beitrag bringt die Registry auf 20 Fragmente. Neun fokussierte Composer-Tests decken Determinismus, Filter, Fallbacks, ungueltige Daten und Text-/Mechanik-Trennung ab.

## [0.3.84] - 2026-11-03

### Technik

- NAR-10 abgeschlossen: `scripts/lib/narrative-macros.mjs` parst `€...`-Direktiven zu einem begrenzten AST, prueft Command-Allowlist, Argumente, ActorRefs, Flag-Vokabular und doppelte Singleton-Commands. `scripts/lib/narrative-compiler.mjs` erkennt Sprecher-, Persona-, Stimmungs-, Flag- und Command-Konflikte, sortiert Fragmente kanonisch und erzeugt eine Registry mit SHA-256-Inhalts-Hash.
- `scripts/compile-narrative-content.mjs` schreibt nur mit `--write`; Default und `--check` vergleichen die exakten Bytes. `scripts/verify-narrative-content.mjs` ist der lesende Nachweis. Beide laufen ohne neue Abhaengigkeit; das bestehende `verify:assets` ruft denselben Validator auf.
- `content/narrative/registry/fragments.json` ist jetzt Version 2, traegt typisierte AST-Daten statt Roh-Makros und wird aus 19 Beitraegen erzeugt. `classification.json` ergaenzt Persona-Aliase und datengetriebene Konfliktpaare; der neue NAR-10-Beitrag traegt eine validierte `FREEZE_TICK`-Direktive.

## [0.3.83] - 2026-11-03

### Technik

- NAR-09 abgeschlossen: Content-Beitraege tragen jetzt eine kontrollierte Klassifizierung aus Slot, Funktion, Kontexten, Ton, Stimmung, Beziehung und Persona-Bezug; Rollen, Locales und Flags bleiben in `content/narrative/vocabulary/flags.json`, die neuen Dimensionen in `classification.json`.
- `content/narrative/turns/manifest.json` registriert jeden abgeschlossenen Agenten-Turn und ordnet ihm genau einen Beitrag zu. `content/narrative/registry/fragments.json` wird deterministisch aus den validierten Beitraegen erzeugt; `scripts/build-narrative-registry.mjs --write` schreibt sie, der Default ist ein lesender Check.
- `scripts/lib/narrative-content.mjs` prueft Pflichtfelder, IDs, Vokabular, Dateinamen, Manifest und Registry fail-closed und ist in `scripts/verify-assets.mjs` eingehaengt. Neue Verstoesse melden `ERR-4022`; zehn neue Tests decken Schema, Duplikate, fehlende Turns und Registry-Drift ab.

## [0.3.82] - 2026-11-03

### Technik

- NAR-08 abgeschlossen: `narrative/commands/` parst `€...`-Direktiven zu einem begrenzten AST, validiert IDs, Parameter und Teilnehmer gegen eine typisierte Registry und prueft jeden Batch vor der Ausfuehrung vollstaendig.
- `SET_FLAG`, `ADJUST_RELATIONSHIP`, `FREEZE_TICK` und `TRIGGER_DIALOG` sind registriert; nur freigeschaltete Handler laufen. Choice-Effekte und deklarierte Kosten werden hoechstens einmal angewendet, die Event-Instanz wird `RESOLVED`, Wiederholungen und manipulierte IDs werden abgewiesen.
- Abgelehnte Direktiven erzeugen den begrenzten Diagnose-Fact `COMMAND_REJECTED`. Kein `eval`, kein dynamischer Import und keine Funktionsnamen aus Text; die Template-/Choice-Allowlist bleibt die einzige Quelle fuer Spielwirkungen.

## [0.3.81] - 2026-11-03

### Technik

- NAR-07 abgeschlossen: `narrative/events/template-types.ts` und `template-schema.ts` definieren stabile Event-Templates mit Triggerbezug, Rollen, Content-Slots, Prioritaet und deklarativen Choices; `events/definitions/` registriert `VISITOR_RETURN` und `VISITOR_CONFLICT`.
- Jede Choice traegt eine stabile `choiceId`, Requirements, optionale VaCoin-Kosten, eine deklarative Effektliste und ein Ergebnis-/Folgeevent-Mapping. Texte bleiben in Content-Slots und aendern keine Mechanik.
- Event-Instanzen persistieren `templateId`, `templateVersion` und den angebotenen `offeredChoiceIds`-Satz. `choices/contract.ts` weist unbekannte, nicht angebotene oder versionsfremde Choices ab; `choices/eligibility.ts` prueft Lifecycle, Frist, Requirements und Kosten bei jedem Klick erneut, rein und fail-closed.
- Alte Event-Instanzen ohne Template-Metadaten werden auf `eventId`, Version 1 und einen leeren Choice-Satz normalisiert. Die Erweiterung ist additiv in Save v9; neue Tests decken stabile IDs, manipulierte Choices, Text-/Mechanik-Trennung, Kosten, Fristen und den Save-Roundtrip ab.

## [0.3.80] - 2026-11-03

### Technik

- NAR-06 abgeschlossen: `narrative/event-types.ts`, `event-lifecycle.ts`, `event-scheduler.ts`, `event-schema.ts` und `narrative-rng.ts` bilden den persistenten Event-Scheduler. Instanzen tragen Event-ID, Status, Scope, Teilnehmer, Quelle, Prioritaet, Start-/Ablaufzeit, Schritt und Auflösung; maximal 32 Instanzen, 8 live und 64 Cooldowns bleiben erhalten.
- Der Lifecycle `ELIGIBLE → OFFERED/ACTIVE → RESOLVED/EXPIRED/CANCELLED` wird zentral geprueft; terminale Events setzen einen Cooldown je Event-/Teilnehmerkombination. Der Scheduler waehlt nach Prioritaet und Fairness, verhindert Duplikate, begrenzt Arbeit und nutzt fuer Gleichstand einen eigenen persistenten Narrativ-RNG statt des Gameplay-PRNG.
- `processNarrativeBoundary()` raeumt Fristen und verwaiste Visitor-/Personal-Endpunkte auf. Save v9 persistiert Events, Cooldowns und RNG additiv; alte Staende erhalten leere Defaults. `scheduler.ts` ist die Fassade; neue Tests decken Prioritaet, Determinismus, Scopes, Cooldowns, Ablauf, Stale-Cancel, Ketten, Historiengrenze und Save-Roundtrip ab.

## [0.3.79] - 2026-11-02

### Technik

- NAR-05 abgeschlossen: `narrative/trigger-types.ts`, `trigger-context.ts`, `trigger-evaluate.ts` und `trigger-schema.ts` bilden den deklarativen Trigger-Vertrag. Der Context liest Fact-Historie, Flags, Beziehungen, Visitor-Profile, Hauskonto/Band, Charisma, Ruf, Nachfragestufe, bediente Gäste und Geräteschaden; alte `visitorId`-Facts und neue `actorRefs`-Facts werden einheitlich aufgelöst.
- Der reine Evaluator kennt alle vorgesehenen Operatoren für Kombinationen, Facts, Erinnerungen, Hauskonto, Geräte, Charisma, Ruf, Nachfrage, Gäste, Flags, Zeitfenster, Akteure und Beziehungen; er liefert Match, Teilnehmer und Begründungen, ohne Welt, Ledger oder PRNG zu verändern. Das Schema verwirft unbekannte Operatoren, ungültige Refs, Selbstkanten, negative/unsichere Schwellen und leere Listen fail-closed.
- `narrative/triggers.ts` ist jetzt eine Fassade; neun Tests in `narrative-triggers.test.ts` und `narrative-trigger-schema.test.ts` decken Operatoren, Grenzen, Historie, fehlende Referenzen und Unveränderlichkeit ab. Die Tick-Anbindung bleibt NAR-12.

## [0.3.78] - 2026-11-02

### Spiel

- Die Etage liest als Gebaeude: jeder Raum bekommt eine Lichtpfuetze in sechzehn leisen Stufen, Deckenlampen und Wandkanten sind heller, Laufwege bleiben dunkel, sind aber nicht mehr schwarz.
- Der Boden antwortet vor dem Klick: ein Zielraster zeigt die Kachel unter dem Zeiger und wechselt die Farbe (Service = laufen, Casino = im Ueberblick heranziehen).
- Die Figur bleibt auffindbar: ein Ring am Boden, eine Punktspur entlang des Laufwegs, ein kurzer Puls am Klickziel.
- Kamera: rechte oder mittlere Maustaste zieht das Bild, Mausrad und `+`/`-` zoomen, `0` springt zur Uebersicht; beim Laufen im Detail zieht die Kamera nach, sobald die Figur den inneren Rahmen verlaesst.
- Kamera-Knoepfe unten rechts und eine Steuerleiste mit Tastenkuerzeln; im HUD ist das Barkauf-Ziel ein Chip in der RPG-Zeile (mit XP-Balken) statt einer leeren Leiste.
- Die Hilfekarte im Spiel nennt die neuen Griffe: rechte Maustaste ziehen schwenkt, `+`/`-` zoomen, `0` oeffnet die Uebersicht.

### Technik
- `src/render/floor-cues.ts` (neu): Zielraster, Spielerring, Laufwegspur und Klick-Puls als eine Darstellungsebene; liest nur Snapshots und kennt keine Spielregel.
- `floor-camera.ts` um `pan`, `zoomStep` und `keepInView` erweitert; `floor-touch.ts` traegt jetzt Rad, Pinch und Ziehen (der Wheel-Handler ist aus `floor-view.ts` dorthin gezogen, Budget bleibt 349/350).
- `floor-surface.ts`: `drawLightSpill` in sechzehn Stufen, Deckenlampen und Laufweg-Abdunklung nachgezogen; `room-art.ts` hebt die Wandlichtkante; `stage-controls.tsx` (neu) buendelt Steuerleiste und Kamera-Knoepfe; `app.css` bekommt Vignette, Rasterhintergrund, Tastenkuerzel-Chips und Zoom-Leiste.
- Bildsprache dokumentiert: `docs/ART-DIRECTION.md` ("Neon Ledger") und `docs/banners/art-direction-neon-ledger.png` als Blatt.
- Neuer Test `src/render/__tests__/floor-camera.test.ts`: Uebersicht mittig, Schwenk folgt dem Zeiger, Kante haelt, Nachziehen erst am Rahmen, Tasten-Zoom kehrt zurueck.
- Neuer Bildsatz `docs/screenshots/v0.3.78/` (fuenf Bilder, 1280 x 860, Tag 1): Uebersicht, Detail, Bauen, Gaeste, Hilfe. Die Wurzel-README stellt ihn Bild fuer Bild gegen `current/` (v0.3.27); die Ablageregel in `docs/screenshots/README.md` kennt jetzt versionierte Spielsaetze statt nur `current/`.

## [0.3.77] - 2026-11-02

### Technik

- Nachfrageereignis auf Narrative-Zustand vorbereiten: laufende Neon- und Turnierabende liegen jetzt im narrativen Zustand; alte Saves werden beim Laden uebernommen. Auswahl und Ablauf bleiben vorerst in `demand.ts`.
- Narrative-Grundlagen: `ledgerSeq`/`houseBand` und `HOUSE_BALANCE`-Facts leiten Hauskonto-Schwellen aus dem Ledger ab; `processNarrativeBoundary()` ist der einzige Fact-Drain. Gerichtete Beziehungen pinnen ihre Visitor-Profile, sodass die Retention keine laufende Beziehung mehr loescht. NAR-04 ist abgeschlossen: Streit, Kassenbedienung und Rivalenabrechnung erzeugen echte Besucher-Besucher-, Besucher-Personal- und Rivale-Haus-Kanten; die Persistenz ist kanonisch, geklemmt und save-roundtrip-fest.

## [0.3.76] - 2026-11-02

### Technik

- Narrative-Dokumentation nach Merge wiederherstellen: fehlende Eintraege zu Triggern, Save-Facts und offenen Meilensteinen ergaenzt; kein LLM im Spiel.

## [0.3.75] - 2026-11-02

### Technik

- Narrative Trigger Bedingungen: Reiner Evaluator fuer kombinierte Fact-, Erinnerungs-, Kassen-, Geraete-, Spieler-, Flag- und Zeitbedingungen; noch ohne Runtime-Anbindung.
- Narrativ-Grundlagen und LLM-freier Eventplan: Start-Pool wird nicht doppelt gezaehlt; Save-Facts werden bei der Normalisierung nach IDs geordnet und auf Nutzdaten geprueft. Offene Meilensteine und der Ausschluss eines LLM im Spiel stehen im Architekturvertrag.

## [0.3.74] - 2026-11-02

### Spiel

- Keine spielbaren Aenderungen; umgebaut wird der Werkzeugkasten der Agenten.

### Technik
- `pnpm run agent:context` druckt eine feste Beschriftungsspalte mit einer Zeile je Feld (Aenderungen, Systeme, Tests, Gates, Doku, Invarianten, Offen) statt einer unstrukturierten Zeile.
- `pnpm run agent:verify` zeigt eine Gate-Tabelle mit Status und Dauer; `--plan` nennt Plan und Cache-Stand, ohne ein Gate zu starten. Beide bleiben die einzige Analyse- und Pruefstrecke.
- Das Tree-Gate verbietet Wegwerf-Dateien (`tmp-`, `temp-`, `scratch-`, `adhoc-`, `.tmp.`, `.bak`) und meldet sie als `ERR-4019`; die Regel steht in `AGENTS.md`.
- `agent:context --line` und `agent:verify --line` geben eine verdichtete Textzeile aus (Stand, Umfang, Gates). `agent:verify` druckt im Erfolgsfall keine Zeile je Gate mehr, sondern nur die Tabelle.
- Suchwerkzeug: ripgrep liegt global im PATH, `rtk rg`/`rtk ls`/`rtk find`/`rtk read`/`rtk git` sind der Standard; `pnpm run agent:context` ist der primaere Kontextzugang (AGENTS.md, RTK-Block).

## [0.3.73] - 2026-11-02

### Spiel

- Keine spielbaren Aenderungen; der Sprung dient der Release-Konsistenz von `main`.

### Technik
- Peer-Review Phase 6: Tick-Konstante zentral (`TICK_MS = 520`), `spinTest` ruft den Testspin nur einmal, das tote `movement-queue`-Modul ist entfernt, Texte korrigiert ("DER GEBER MISCHT", Mojibake), Asset-Zaehler aus den Daten, `opencode.json` mit relativem Pfad, `encode-audio` verlangt `RBD_AUDIO_SOURCE`.
- Version 0.3.73: `main` trug nach dem Merge von PR #44 weiter 0.3.72, waehrend der Tag `v0.3.72` auf `7b50913` (PR #40) stand und der Release-Lauf nach einem API-Merge als `skipped` endete. Der Patch-Sprung macht den Tip release-faehig, ohne den bestehenden Tag zu verschieben.

## [0.3.71] - 2026-11-01

### Spiel

- README eröffnet die Spielwelt als satirisches Onboarding und markiert Umfang sowie Mechaniken als heutigen Stand; das Startkapital ist auf 150 VC plus Gratis-Automat korrigiert.
- Das gelieferte Pixel-Art-Banner und drei neue SVG-Trenner führen durch Spielwelt, Werkstatt und Roadmap.

### Technik
- Der Tageslohn hängt an einer abgeschlossenen Schicht: `PlayerJobState.lastWorkDay` merkt sich den Tag der letzten Schicht, `payDailyWage` zahlt nur dafür und nie rückwirkend. Wer einen Job annimmt und nichts tut, bekommt weder Geld noch `workDays`-Zuwachs.
- Die Pity-Entladung addiert keinen zweiten Gewinn mehr: `settleSlotSpin` zahlt aus dem Polster, darf es überziehen und holt den Vorschuss aus späteren Gewinnen zurück.
- Wut kommt jetzt aus der Geduld, nicht aus der Laune: `decay` prüft `patience <= 0` vor dem Geduld-Tropfen; die Mods mit Geduldswirkung steuern damit wirklich, wer randaliert.
- Sucht steuert den Einsatz (bis +50 %) und die Sitzungslänge (4 bis 9 Spins): `addictedStake` und `sessionSpins`.
- `PLAYER_CASH` ist auszahlbar: `cashOutPlayerCash` bucht das Bonus-Guthaben ins Portemonnaie.
- Der tote `social`-Bedürfniszweig ist entfernt; `Persona.patience` bleibt, weil sie seit dem letzten Commit gelesen wird.
- Die Persona-Geduld wirkt jetzt: sie geht als Gewicht in den 180-Punkte-Pool von `rollProfile` ein (68 High Roller bis 138 Stammgast), die Summe aus Laune, Geduld und Sucht bleibt exakt 180. Vorher war `Persona.patience` ein totes Feld, und der Stammgast startete wegen seiner hohen Suchtrate sogar ungeduldiger als der High Roller.
- Der Synergie-Audit listet die verbleibenden Lücken in `docs/INVENTORY.md`: `PLAYER_CASH` ohne Ausgabepfad, VELVET und FREE_DRINK ohne ihre beschriebene Wirkung, EXTRA_REEL ohne zusätzliche Walze und ein Einsatz, der nie mit der Persona skaliert.
- Alte Saves ohne `lastWorkDay` laden weiter und starten mit „noch keine Schicht"; vergangene Tage werden nicht nachgezahlt.
- Der rote Pflichtstatus war der PR-getriggerte `CI Verify`-Lauf: er scheiterte am PR-Body-Gate, weil der PR-Body die Pflichtsektionen nicht trug; der Workflow bleibt unveraendert, der Body wird aus dem Commit-Body gehoben.
- Drei Mods sind als offene Design-Entscheidung dokumentiert statt still wirkungslos zu bleiben: `VELVET` (bessere Gaeste), `FREE_DRINK` (Drink pro Spin) und `EXTRA_REEL` (vierte Walze) stehen mit Versprechen, Ist-Zustand und der jeweils noetigen Regelentscheidung in `docs/INVENTORY.md`.

- Der Überfall misst die Wachdeckung jetzt an der Kasse statt am Spieler: `muggingCoverPoint` liefert den Wechseltisch, an dem das Geld liegt; vorher schützte ein Wachmann am Klo die Kasse.
- Die zweite Streitstufe ist erreichbar: `disputeLevelForTicks` kippt nach vier Ticks, vorher nach sechs — ANGRY dauert aber nur fünf, deshalb gab es nie Möbelschaden.
- `guestsServed` zählt nur noch Gäste mit mindestens einem Spin; wer den Floor durchquert, hob bisher Ruf und KASSE-Stufe.
- „JACKPOT!" erscheint erst ab 2,5x; ein Push von 1,0x hieß bisher Jackpot und traf rund jeden fünften Slot-Spin.
- Die Wut klingt nach dem Schlichten ab (`anger` sinkt um 0,5 pro Tick), statt bis zum Abgang das ANGRY-Emoji zu zeigen.
- HUD, Diagnose und Automaten-Popup lesen die Bar-Kapazität aus `barCapacityForLevel`; die UI rechnete 6 + 6 × Level, der Core 12 + 8 × Level.
- Dreck landet wieder auf der Kachel, auf der er entsteht: `dirtyTileIndex` in `emotion.ts` ist das Gegenstueck zu `dirtyNear`; Randale und Streit schrieben bisher `(y+1)*size+x+1` und damit schraeg versetzt daneben.
- Video Poker zahlt den Royal Flush nur noch in einer Farbe und erkennt das Wheel A-2-3-4-5 als Strasse; die interaktive Engine war schon richtig.
- Die Dreckschicht liegt im Szenen-Cache jetzt zwischen Teppich und Moebeln statt als erstes Kind des Moebel-Containers.
- Ein Ueberfall auf das Portemonnaie zaehlt im Wirtschaftsbericht als Verlust; `classify` stieg vorher beim Quellkonto aus, bevor der Ueberfallstopf erreicht war.
- Ein Fehlerregister statt dreier Quellen: `scripts/lib/error-codes.mjs` liest `error-codes.ts`, das Gate-Format prueft nicht mehr das Markdown. `ERR-1001` (Determinismus) ist nachgetragen und wird nicht mehr als `ERR-0000` verschluckt.
- Subsysteme, Ordnerregeln, Katalogsysteme und Impact-Doku stehen einmal in `scripts/lib/subsystems.mjs`; Tree-Gate, Testkatalog, betroffene Tests und `agent:context` lesen daraus.
- Die Eskalationsleiter kommt aus `src/Config/escalation-levels.json`; TypeScript und `scripts/lib/escalation.mjs` teilen sie, ein Test haelt beide deckungsgleich.
- `issues.ts` und `transfer.ts` buchen ihren Fehlercode ueber `ERROR_CODES.TRANSFER_INVALID` statt als Literal.

- README ergänzt aktuellen Screenshot- und Versionsvergleich, Developer-Setup, Architekturverträge, Prüfkommandos, Roadmap und FAQ.
- CI-Jobs installieren die festgelegte pnpm-Version, bevor der Package-Cache und die Lockfile-Installation laufen. Der Versionsbump lädt YAML statisch; das Tree-Gate erlaubt JPEG-Belege unter docs.
- pnpm-Overrides für `glob` und `minimatch` stehen im pnpm-spezifischen `pnpm.overrides`-Abschnitt; so werden die gepatchten Transitiven tatsächlich aufgelöst.

## [0.3.70] - 2026-11-01

### Spiel

- Keine sichtbare Aenderung: nur die Pruefkette und ihr Cache.

### Technik
- Paketmanager von npm auf pnpm umgestellt (`packageManager: "pnpm@10.4.1"`); `package-lock.json` entfernt, `pnpm-lock.yaml` trackt die Dependencies. Alle Skripte, GitHub Actions, Pre-Commit-Hook und Pflichtdokumente nutzen `pnpm` statt `npm`; `npm ci` wurde durch `pnpm install --frozen-lockfile` ersetzt.
- `agent:verify` laesst das Testgate nie mehr aus, nur weil der Diff keinen Testbezug hat; ohne Auswahl laeuft die Suite, der Bericht nennt den Grund.
- `turn:finish` setzt die Doku-Marker vor `verify`. Der Pre-Commit-Hook schrieb sie danach und entwertete damit jeden Cache-Schluessel des gerade geprueften Baums; derselbe Baum trifft jetzt beim zweiten Lauf (`0s`, `[cached]` je Gate).

## [0.3.69] - 2026-11-01

### Spiel

- Keine sichtbare Aenderung: Prozess und Nachweise werden zusammengefuehrt.

### Technik
- Neu: `pnpm run agent:context` (ein Aufruf fuer Aenderungen, Systeme, Invarianten, betroffene Tests, Gates und Cache-Stand) und `pnpm run agent:verify` (derselbe Impact-Plan, Gates ueber `runGates`, ein Bericht mit `cached`, `executed`, `skipped` und `delegated`). Beide nutzen `scripts/lib/impact.mjs`, das nur vorhandene Quellen zusammenfuehrt: `changedFiles`, Importgraph, Testkatalog, `pipeline-plan`, `gate-cache`.
- Doppelte Testausfuehrung entfernt: `turn:finish -- --affected` startete `test:affected` und danach `verify:quick`, dessen Testgate die Suite erneut fuhr. Jetzt liefert `--affected` den Kontext; der Testlauf bleibt einmalig in der Pipeline.
- Delegation ist keine Ausgabe mehr: `test:affected` legt lange Nachweise in `.verify-cache/delegated.json` ab und nennt sie offen; `agent:verify --ci` startet `ci:long`, wartet auf den Lauf und uebernimmt das Ergebnis.
- Pre-Commit blockiert, wenn Dependency-Matrix oder Testkatalog nicht geschrieben werden konnten; ein verschluckter Generatorfehler hinterliess bisher ein stilles veraltetes Artefakt.
- Teilpruefung bleibt Teilpruefung: laufen bei `agent:verify` nur betroffene Tests, steht `partial: true` im Bericht und das Testgate wird nicht gecacht.

## [0.3.68] - 2026-11-01

### Spiel

- Keine sichtbare Aenderung: die Konfiguration liegt nur noch an einer Stelle.

### Technik
- `src/Config/capacitor.config.json` ist wieder versioniert: die Ignore-Regel griff ungeankert und schloss die Quelle mit ein. `.gitignore` ignoriert nur noch die Laufzeit-Kopie in der Wurzel (`/capacitor.config.json`); `prepare-android` legt sie dort an und raeumt sie ab.

## [0.3.67] - 2026-11-01

### Spiel

- Keine sichtbare Aenderung: die Auslieferung wird belastbar, Spiel, Save und Ledger bleiben unberuehrt.

### Technik
- Merge ohne stille Kette: `promote` nutzt `PROMOTE_TOKEN`, wenn gesetzt; sonst stoesst es nach dem Merge `Auto Version & Release` an, weil ein Merge mit `GITHUB_TOKEN` keinen Workflow startet und Tag und APK sonst ausfallen. Der Release prueft den Commit-Text vor dem Tag selbst.
- `integration` ist geschuetzt: `pr-cleanup.yml` und `branch-prune.mjs` loeschen die permanente Branch nicht mehr nach dem Rueckweg nach `main`.
- Urteil statt Rauschen: nur `failure`, `timed_out` und `startup_failure` gelten als rot; ein `cancelled`-Lauf schiebt keinen Zwischenstand auf `integration`. Nur Push-Laeufe promoten, der `pull_request`-Lauf des Merge-Refs ist kein Urteil.
- Kein Merge-Deadlock: `gh pr update-branch` laeuft vor dem Merge, weil der Pflichtstatus unter `strict_required_status_checks_policy` sonst veraltet; der Integrationspfad schleift statt zu rekursieren.
- Loch im PR-Gate geschlossen: ein leerer PR-Body bestand `verify-commit-msg --pr` ohne Fehlschlag; jetzt ist er `ERR-4006`.
- Seedabhaengiger Test korrigiert: `narrative-start-pool` prueft jetzt das neue Profil (eine Visite, kein `START_POOL`-Fact) statt eines Namens. `Rita Kern` ist eine moegliche Zufallskombination aus `src/core/sim/traits.ts` (rund 0,8 % pro Ziehung) und liess den Lauf gelegentlich kippen.
- Werkzeug-Configs liegen gesammelt in `src/Config/`: `tsconfig.json`, `vite.config.ts`, `eslint.config.mjs`, `capacitor.config.json` und `opencode.json` gibt es nur noch dort. Alle Aufrufer zeigen auf den neuen Pfad (`vite`/`vitest` per `--config`, `tsc -p`, `eslint --config`, `hashFiles` im Gate-Cache, Dependency-Matrix, Dead-Code, Tree-Gate); Capacitor bekommt waehrend des APK-Laufs eine Kopie in die Wurzel, die danach wieder verschwindet. `.mailmap` bleibt in der Wurzel, weil Git sie nur dort liest.

## [0.3.66] - 2026-11-01

### Spiel

- Keine sichtbare Aenderung: die Auslieferung wird automatisiert, Spiel, Save und Ledger bleiben unberuehrt.

### Technik
- Neu: `scripts/promote.mjs` und `.github/workflows/promote.yml`. Ein CI-Ergebnis entscheidet: gruen legt den PR an und mergt ihn mit den Pflichtsektionen, rot legt den Stand auf die permanente Branch `integration`, damit dort repariert wird.
- Zwei parallele rote Staende werden komponiert statt verworfen. Die Wahrheit liegt im Branch und im Label `integration/rot`, nicht in der Warteschlange: GitHub haelt pro Concurrency-Gruppe nur einen wartenden Lauf, deshalb arbeitet jeder Lauf den gesamten Rueckstand ab und ist idempotent. Ein Textkonflikt wird mit `integration/konflikt` gelabelt und bleibt beim Agenten; nichts wird erzwungen oder ueberschrieben.
- Eine Identitaet fuer jeden Commit: `scripts/lib/identity.mjs` verdrahtet `Vannon <Schneider.felix1993@gmail.com>` in `turn:finish` und im Promote-Workflow, damit der Committer nicht davon abhaengt, welcher Runner oder welche Sandbox gerade committet. `.mailmap` fuehrt die Werkzeug-Namen der History auf denselben Eigentuemer.
- Merge mit Verified-Badge ist opt-in (`RBD_PROMOTE_AUTO_MERGE=1`): dann mergt GitHub selbst und signiert, kann aber den Commit-Text nicht setzen. Ohne Opt-in mergt der Lauf explizit mit Subject und Body, damit `verify-commit-msg --head` auf `main` gruen bleibt.
- Artefakt-Gate-Test entkoppelt: `gate-runner.test.ts` prueft Logs und Summary mit 60 s Limit statt 10 s. Unter paralleler Gate-Last braucht der Node-Start allein mehrere Sekunden, das Zeitlimit hat die Artefakt-Pruefung verfaelscht (TIMEOUT statt FAIL); die Zusicherungen selbst sind unveraendert.

## [0.3.65] - 2026-11-01

### Spiel

- Keine sichtbare Aenderung: reine Doku-, Ordnungs- und Hygiene-Arbeit. Spielverhalten, Save-Format und Ledger bleiben unberuehrt.

### Technik
- Doku konsolidiert und sortiert: 16 Doku-Dateien liegen flach unter `docs/` und tragen Grossbuchstaben-Namen. `docs/event-narrative-engine-taskplan.md` heisst jetzt `docs/EVENT-NARRATIVE-ENGINE-TASKPLAN.md`, `docs/assets/casino-pixel-asset-pack.md` jetzt `docs/CASINO-PIXEL-ASSET-PACK.md`; der Ordner `docs/assets/` entfaellt.
- Widersprueche beseitigt: ARCHITECTURE, PRODUCT, AGENTS und Inventar nennen dieselbe Gate-Zaehlung (quick 10, full 12 inklusive `assets`, `audit`, `build`) in der echten Reihenfolge; der Save ist ueberall v9 (`vcoin.casino.v9`, Migration v5–v8); die Narrative Engine gilt als Stufe 1 gebaut statt "nicht gebaut"; der Inventar-Kopf steht auf `main`/`c4e6e3b`.
- `docs/ERROR_CATALOG.md` repariert und sortiert: ERR-4013/ERR-4014 waren in einer Tabellenzeile verschmolzen, ERR-5001 stand vor ERR-4019; die Codes laufen jetzt aufsteigend bis ERR-5001.
- Repo-Hygiene: Hooks aktiviert (`core.hooksPath=.githooks`), Wurzel traegt nur `README.md` und `AGENTS.md` als Markdown, `docs/screenshots/README.md` beschreibt wieder den echten Bestand (25 Belege, Save v9).
- Doku-Gate (`ERR-4017`) praezisiert: Dotfiles in der Wurzel sind Arbeitsdateien. `.turn-notes.md` machte `verify:quick` und damit `turn:finish` rot, obwohl das Werkzeug die Datei selbst anlegt; der Scan ueberspringt sie jetzt.

## [0.3.64] - 2026-11-01

### Spiel

- Neue Spiele beginnen mit einem Start-Pool aus drei bekannten Figuren (Rita Kern, Boris Falk, Mira Sol). Stammgaeste erinnern sich an ihre letzten Besuche: ein guter Besuch bringt sie mit besserer Laune und hoeherer Rueckkehrchance zurueck, ein schlechter senkt beides.

### Technik
- Narrative Engine, Stufe 1 (NAR-00 bis NAR-03): Architekturvertrag `docs/NARRATIVE-ENGINE.md`, persistente Narrative-Domaene mit Fact-Queue und idempotenter Verarbeitung, typisierte Facts (Start-Pool, erster Besuch, Rueckkehr, Besuchsende), strukturierte Erinnerungen am Visitor und Save v9 mit Migration aus v5–v8.
- Facts sind vom Journal getrennt; Erinnerungswirkung ist rein deterministisch aus dem Save berechnet (kein PRNG, keine Uhr).
- Import und Export im Pruefungs-Popup: Spielstand als JSON sichern, vor dem Import pruefen und reparierbare Felder automatisch ergaenzen. Blocker verhindern den Import und nennen die Eskalationsstufe.
- `performance.now` ist auf die drei echten Pacing-Dateien verengt (`src/render/floor-view.ts`, `src/render/floor-props.ts`, `src/render/music.ts`); jede vierte Datei unter `src/render/**` ist gesperrt. `Date()` ohne `new` und `performance.timeOrigin` sind jetzt ebenfalls verboten, in `src/render/**` bleiben `Math.random`, `Date.now`, `new Date()` und Krypto rot.
- Determinismus-Sperre fail-closed: Namespace- und `new`-Umwege, Krypto (`getRandomValues`, `randomUUID`), `scripts/**` inklusive Content-Compiler und `eslint-disable` sind technisch blockiert; `src/render/**` darf nur `performance.now` fuer Pacing lesen.
- Event-Engine-Taskplan adversarial gehaertet: 20 Angriffe mit Gegenmassnahmen, Systemmatrix ueber 20 Systeme, korrigierte Reihenfolge (NAR-13 vor NAR-12) und Definition of Done je Task — kein Task gestrichen.
- Determinismus als Regel: `entropySeed()` ist der einzige Entropie-Eingang, der Export stempelt aus der Welt statt aus der Uhr, und ESLint verbietet `Math.random`, `Date.now`, `performance.now` sowie `new Date()` in `src/**` (Ausnahme: Pacing in `src/render/**`).
- Tree-Gate (`ERR-4019`) und Redundanz-Gate (`ERR-4020`) sind Pipeline-Gates; `docs:stub` (`ERR-4021`) legt Pflichteintraege mit Datum und Uhrzeit an.
- `src/index.css` liegt jetzt unter `src/styles/`; `ci-verify` prueft den Commit-Body nur noch auf `main`, Feature-Branches uebernimmt `pr-escalation` (keine Doppelarbeit).

- Globale Eskalations-Leiter `AUTO_FIX -> LOCAL_GATE -> REMOTE_CI -> AGENT -> BLOCKED` in `scripts/lib/escalation.mjs`; `pnpm run escalation:plan` nennt die Stufe zu einem Befund.
- Doc-Gate `verify:docs` mit Pflichtabschnitten, Marker und flachem Wurzelbaum; Pflege im Pre-Commit-Hook, nicht im Gate.
- Commit-Body blockiert nicht mehr: `.githooks/commit-msg` eskaliert, `pr-escalation.yml` hebt den Body in den PR-Body.
- Dependency-Matrix und Testkatalog sind keine Pipeline-Gates mehr; Matrix, Katalog und Doku-Marker schreibt der Pre-Commit-Hook.
- Neue Fehlercodes `ERR-4017` (Doku), `ERR-4018` (Hooks), `ERR-5001` (Import).
- Connector-Eskalation: `node scripts/lift-commit-body.mjs --json` liefert Branch, Basis, Titel, Body-Datei und Body als Plan; Agenten mit GitHub-Connector legen den PR ohne `gh` an. Der Level kommt aus der einen Leiter (`AGENT`).
- Pipeline-Test auf den neuen Gate-Plan gezogen: `docs` ersetzt `deps-matrix`/`catalog`, der Lesende-Vertrag bleibt geprueft.
- Import-Engine modular unter `src/core/io/` (Umschlag, Pruefung, Reparatur) mit `src/store/transfer.ts` als Anbindung.
- `pnpm run inventory:build` schreibt Abschnitt 18 des Inventars: eine Zeile je Pfad aus `git ls-files`, ein Eintrag je Ordner, Text gelesen, Binärsignaturen geprüft.
- `verify:docs` erzwingt die Inventar-Abdeckung mit: fehlende Datei, fehlender Ordner oder falsche Abdeckungszahl machen das Gate rot (`ERR-4017`). Der Pre-Commit-Hook baut die Liste vor dem Marker.
- Inventar-Generator idempotent: der Selbsteintrag von `docs/INVENTORY.md` nennt keine eigene Zeilenzahl mehr; nach einem Rot-Test stellt `inventory:build` den Block byte-identisch wieder her.
- `main` in den Inventar-Branch gemergt: Runtime-Art-Preload und die neuen Renderer-Dateien bleiben erhalten, `./styles/index.css` bleibt der einzige CSS-Einstieg; die Dependency-Matrix erzeugt der Hook neu.
- RNG-Namespaces: `Prng` traegt `gameplay` oder `presentation`; Partikel und Sound nutzen den eigenen Darstellungs-Strom in `src/render/rng.ts`. `tickWorld` und `playRound` weisen fremde Stroeme mit `assertGameplayRng` ab (`ERR-1003` im Test).
