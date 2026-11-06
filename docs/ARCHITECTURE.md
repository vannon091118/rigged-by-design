# Architektur und Governance

<!-- rbd-doc: v0.3.126 | 2026-11-06 03:49 UTC -->

## README als Einstieg

`README.md` ist die erzählerische Bühne und der Entwickler-Einstieg, nicht die Regelquelle. Spielmechaniken werden dort als gegenwärtiger Projektstand beschrieben; für verbindliche Details gelten Core-Code, Tests und die passenden Architekturverträge. Screenshots liegen unter `docs/screenshots/` und zeigen jeweils den belegten Stand. Roadmap-Punkte werden als Vorhaben formuliert, nicht als festgelegtes Enddesign.

## Produktgrenze: ort-agnostischer Kern

`docs/PRODUCT.md` beschreibt das Produkt als Lebenssimulation. Das Casino ist darin der Startpunkt und die Testumgebung, nicht das Genre. Fuer den Code heisst das:

- `src/core/` kennt keine Casino-Sonderwahrheit. Welt, Ledger, Facts, Erinnerungen, gerichtete Beziehungen, Trigger und Event-Instanzen sind ortsunabhaengig; sie beschreiben Figuren, Geld und Folgen, nicht einen Saal.
- Was heute casino-spezifisch ist (Spiele, Geraete, Kasse, Floor, Personal), bleibt ein Vertical Slice auf diesem Kern. Es ist Systembeweis und Detailvorgabe, kein Endziel.
- Ein neuer Ort (Kneipe, Laden, Wohnung) liefert Inhalte, Figuren und eine duenne Anbindung an `world-store` und `GameView`. Er bringt keine zweite Engine und keinen zweiten Zustand mit.
- Neue Ressourcen kommen als Ledger-Buchungen dazu: eine Ressource, eine Zeile, eine Ursache. Neue soziale Fakten laufen ueber das geplante Social-Plugin der Narrative Engine, nicht ueber eine zweite Log-Wahrheit.

## CI-Eskalation

- `src/core/governance/error-codes.ts` ist das einzige Fehlerregister; `docs/ERROR_CATALOG.md` ist die Doku dazu. Jeder Code traegt `level`: `AUTO_FIX`, `LOCAL_GATE`, `REMOTE_CI`, `AGENT` oder `BLOCKED`.
- `scripts/lib/escalation.mjs` nimmt die Stufe aus dem Code; ohne bekannten Code greifen Textmuster.
- `scripts/pr-watcher.mjs` (CI) legt je Befund ein Issue an oder zaehlt bei bekanntem Fingerprint (Code + erste Fehlerzeile) nach. Lokal laeuft nichts davon.
- Direktpush auf `main` ist durch das Ruleset gesperrt: Weg ist Arbeitsbranch, PR, Promotion. `turn-push.mjs` meldet das als ERR-4023.
- Lokal laufen `verify` (Quick) und `test:affected`; `verify:all` und `ci:long` laufen in CI.

## Zustandsbesitz

- `src/store/world-store.ts` ist der einzige Besitzer von Welt, Ledger, PRNG und Save.
- `src/core/` bleibt headless: Simulation, Geld und Spiele kennen weder DOM noch Pixi.
- `src/render/` liest ausschließlich `GameView`-Snapshots; dort liegt kein Spielzustand.
- `src/ui/` liest denselben Snapshot und sendet nur Commands an den Store.
- Geld existiert nur als Ledger-Buchung; VaCoins sind ganzzahlige Mikro-Einheiten.
- Fiat eines Gastes liegt ab dem Spawn auf `FIAT_<id>`, Chips auf `VISITOR_<id>`, offene Gewinne auf `PENDING_<id>`. Ein fehlgeschlagener Transfer lässt Gast und Guthaben stehen.
- Auszahlungen werden nie gekappt: Das Hauskonto zahlt, so weit es reicht; der Rest wird als Verbindlichkeit auf `HAUS_SCHULDEN` gebucht (`openLiability`). Die Summe aller Konten bleibt null.
- Der Umbau läuft über `src/core/sim/remodel.ts`: erst Deckung prüfen, dann alle Gastansprüche buchen, dann Geld buchen und das Haus tauschen.
- Der Save ist v11 (`vcoin.casino.v11`). `replaySave` hebt v5- bis v10-Stände an, behält Fiat, offene Gewinne, Journal, Look, Besuchererinnerungen und Rivalen-Zustaende und setzt den PRNG an der gespeicherten Stelle fort; v5–v10 leiten das Layout deterministisch aus ihrer Vorlage ab, v3 und v4 werden verworfen.
- Raum: `WorldState.layout` ist die einzige räumliche Wahrheit (Dimension, ein Bodenmaterial pro Tile, semantische Zonen, Wandkanten mit stabilen IDs). `size` und `zones` sind abgeleitete Legacy-Sichten für Renderer, UI und Simulation und werden ausschließlich über `applyLayout()` geschrieben. Jede Kante ist über Achse und Ankerpunkt eindeutig, `kind` (WALL/DOOR/OPENING) ist ihr einziger Zustand; der Parser in `layout-validate.ts` weist doppelte Kanten, Wände mit Tür-ID und Türen ohne ID fail-closed ab. Die Eingangstür liegt auf derselben Kante wie `doorPoint()`. `GameView.layout` reicht denselben unveränderlichen Plan an Renderer und Editor weiter; Möbelwerte wie Stock, Zustand, Belegung, Mods und Besitz bleiben in `Furniture` und sind kein Layout.
- Narrative Engine (Stufe 1, `docs/NARRATIVE-ENGINE.md`): `WorldState.narrative` besitzt Fact-Queue (`pending`, 48), Kurzzeithistorie (`recent`, 120), `processedId`, `dropped` und Flags. Facts sind eine diskriminierte Union und entstehen nur an echten Uebergaengen (Spawn, Rueckkehr, Auszahlung, Spielstart, Streit, Kassenbedienung, Rivalenabrechnung); das Journal bleibt Spielerhistorie und ist kein Fact-Bus. `Visitor` traegt hoechstens sechs strukturierte Erinnerungen, `Guest` bleibt die temporaere Besuchsinstanz. Die Wirkung ist deterministisch aus dem Save berechnet: Rueckkehrchance, Spielwahl und Aktivitaet folgen `visitorDisposition()` (E1/E2E, Persona, Erinnerung, Kante), Spawn-Laune folgt `memoryEffect()` als Fassade ueber dieselbe Wertung, ohne PRNG und ohne Uhr. Der Start-Pool (drei bekannte Figuren plus `START_POOL`-Fact mit Startkapital) entsteht nur beim neuen Spiel ueber `seedStartPool`. Save v10 persistiert Narrativ- und Rivalen-Zustand; v5–v9 werden auf sichere Defaults normalisiert, kaputte Eintraege verworfen. `ledgerSeq`/`houseBand` und `HOUSE_BALANCE` leiten Hauskonto-Schwellen aus dem Ledger ab; `processNarrativeRuntime()` stoesst den einzigen Fact-Drain `processNarrativeBoundaryDetailed()` an. `relationships` traegt gerichtete, kanonisch sortierte Kanten zwischen persistenten Akteuren; NAR-04 speist sie aus Besuch, Streit, Kassenbedienung und Rivalenabrechnung, begrenzt sie auf 200 und pinnt Visitor-Endpunkte. Seit NAR-05 baut `trigger-context.ts` daraus einen unveraenderlichen Snapshot, `trigger-evaluate.ts` wertet alle deklarativen Operatoren rein aus und `trigger-schema.ts` verwirft unbekannte oder ungueltige Definitionen fail-closed; `triggers.ts` bleibt die Fassade. Seit NAR-06 persistiert `narrative/events` hoechstens 32 Event-Instanzen (8 live) mit Lifecycle, Cooldowns und eigenem Narrativ-RNG; der Scheduler waehlt nach Prioritaet, Fairness und Teilnehmer-Scope, `maintainEvents()` raeumt Fristen und verwaiste Endpunkte im Boundary auf. Seit NAR-07 definieren `narrative/events/template-*` stabile Event-Templates mit Content-Slots und deklarativen Choices; `choices/contract.ts` bindet Choice-IDs an Template-Version und den persistierten Satz, `choices/eligibility.ts` prueft Lifecycle, Requirements und Kosten bei jedem Klick rein und fail-closed. Seit NAR-08 parst `narrative/commands/parse-directives.ts` begrenzte `€...`-Direktiven zu einem typisierten AST, `registry.ts` allowlistet die Handler, `validate.ts` und `preflight.ts` pruefen IDs, Parameter, Ziele, Kosten und Lifecycle vor jeder Wirkung; `execute.ts` wendet Choice-Effekte und Ledger-Kosten genau einmal an und setzt das Event auf `RESOLVED`. `TRIGGER_DIALOG` bleibt bis zur Dialogfuehrung nicht ausfuehrbar, `COMMAND_REJECTED` ist ein begrenzter Diagnose-Fact. Kein Text wird evaluiert. Seit NAR-09 tragen alle Content-Beitraege eine kontrollierte Klassifizierung aus Slot, Funktion, Kontexten, Ton, Stimmung, Beziehung und Personas; `content/narrative/turns/manifest.json` bindet jeden abgeschlossenen Turn an genau einen Beitrag, und `content/narrative/registry/fragments.json` ist die deterministisch abgeleitete, sortierte Text-Registry. Seit NAR-10 parst `scripts/lib/narrative-macros.mjs` Makros zu typisierten ASTs, `scripts/lib/narrative-compiler.mjs` erkennt Konflikte und hasht die kanonische Fragmentliste, und `scripts/compile-narrative-content.mjs` schreibt nur mit `--write`; `--check` vergleicht exakte Bytes. `scripts/lib/narrative-content.mjs` validiert Schema, IDs, Manifest, Makros und Registry im bestehenden Assets-Gate (`ERR-4022`); die Registry ist Daten, keine Mechanik. Seit NAR-11 erzeugt der Compiler zusaetzlich `src/core/sim/narrative/composer/registry.generated.ts` als typisierten Core-Spiegel; der Composer validiert die Fragmente zur Laufzeit, waehlt sie deterministisch nach Locale, Kontext, Flags und Personas, liefert lokale Fallbacks und reicht Direktiven nur als AST weiter. Kein RNG, kein Netzwerk, keine Textausfuehrung.
- Rivalen-Domaene (NAR-15): `WorldState.rivals` haelt je Rivale Haltung, Handlungsfaehigkeit, Wohlwollen, naechsten Zug, Gegenmassnahmen-Fenster, Historie (6) und Indizien (4); Ruf, Sicherheit und Attraktivitaet bleiben aus `rivalState` abgeleitet. `rival-ai/policy.ts` entscheidet rein und ohne PRNG, `actions.ts` setzt genau ein Geraet deterministisch herab (12 Zustand), schreibt Indiz, Journal-Zeile und `RIVAL_ACTION`-Fact; der Trigger `rival-action` uebersetzt nur TRADE_INFO, PRICE_MOVE, POACH_VISITOR und SABOTAGE in `RIVAL_MOVE` (`CONFRONT_RIVAL`/`WATCH_THE_MOVE`), PROBE bleibt ohne Szene; der Boundary setzt die Kante Rivale→Haus. Ein Guard verhindert den Schaden, nicht das Indiz. Alle drei Rivalen-Zustaende liegen in Save v10 und werden beim Laden normalisiert. Seit Phase 5 liefert `narrative/rival-context.ts` daraus Rivalen-Karten fuers Anzeigemodell (Haltung, Kapazitaet, Wohlwollen, Gegenmassnahmen-Fenster, Historie, Indizien), rein und ohne zweiten Zustand; `view.ts` bleibt unter 200 Zeilen.
- B1-Kontext: `narrative/composition-context.ts` leitet den Composer-Kontext rein aus Fact, Template, Teilnehmern, Erinnerungen und gerichteter Kante ab. Der Kontext kommt aus `sourceFactId` oder dem Template-Fallback, Personas aus den aufgeloesten Visitor-Teilnehmern, Beziehung/Stimmung aus Fact, Kante und Erinnerung; `requiredFlags` stammt nur aus den Template-Requirements. `view.ts` reicht das Ergebnis unveraendert an den Composer; keine zweite Kontextquelle, kein neuer Zustand. Seit B2 traegt jeder `ContentSlot` optionale `requiredContexts` (Slot-Zweck, z. B. `CHOICE_WELCOME` = `return`+`welcome`); der Composer verlangt sie zusaetzlich zu `ComposeRequest.requiredContexts` fail-closed, `contexts` bewertet nur Treffer, und bei Gleichstand entscheidet ein FNV-1a-Hash aus `eventInstanceId` und Slot-ID statt eines RNG. Seit B3 ist `degraded` an `fallbacks.length > 0` gebunden, `issues` nennt die Slot-IDs, und `NarrativeEventView.fallbackSlots` traegt die Liste bis in die UI, die jeden betroffenen Slot beim Namen nennt.
- Zufall ist seedbar und läuft ausschließlich über `src/core/rng/`: `weighted.ts` zieht Zahlen aus einer Gewichtsverteilung, die ihre eigenen Chancen mitliefert (Bias ≤ 9.000 bps, Deadzones, nie 100 %); `shoe.ts` zieht Karten ohne Zurücklegen und mischt erst den leeren Schuh neu. Es gibt kein `Math.random()` im Spielpfad. Gameplay und Darstellung sind getrennte Stroeme: `presentation` versorgt Partikel und Sound (`src/render/rng.ts`), `gameplay` bewegt Welt und Spiele; `assertGameplayRng` weist fremde Stroeme an `tickWorld` und `playRound` ab. Der Darstellungsstrom liegt nie im Save. Echter Zufall existiert nur an einer Stelle: `entropySeed()` in `src/core/rng/streams.ts` zieht Krypto-Bits fuer einen neuen Lauf; danach ist alles geseedet. Wanduhr ist kein Spielzustand: ESLint verbietet `Math.random`, `Date.now`, `performance.now`, `new Date()` und Krypto-Zufall (`getRandomValues`, `randomUUID`) in `src/**` und `scripts/**`, einschliesslich `globalThis`/`window`-Umwegen, `new`-Umwegen und Aliasen; `eslint-disable` ist per `noInlineConfig` wirkungslos; `Date()` ohne `new` und `performance.timeOrigin` sind ebenfalls gesperrt. Ausnahmen stehen namentlich und begruendet in `src/Config/eslint.config.mjs`: `performance.now` nur in `src/render/floor-view.ts`, `src/render/floor-props.ts` und `src/render/music.ts` (Pacing), Krypto nur in `src/core/rng/streams.ts`, Zeitstempel- und CI-Tooling; jede andere Datei unter `src/render/**` bleibt voll gesperrt. Der Wanduhr-Wert kann den Spielzustand nicht erreichen: `src/core` importiert nie aus `src/render`, `src/render` importiert aus `src/store` ausschliesslich `import type { GameView }` (readonly, kein Laufzeitbezug) und ruft keinen Store-Command, `tick`/`day` werden nur in `src/core/sim/tick.ts` fortgeschrieben, und kein Command nimmt einen Zeitparameter ausser `buyBarCmd`, dessen einziger Aufrufer `world-store` selbst `world.tick` uebergibt. Der Export stempelt `Tag X, Tick Y` aus der Welt, damit derselbe Stand dieselben Bytes ergibt.
- Laufende Neon-Nacht und Turnierabend sind aktive GLOBAL-Instanzen in `world.narrative.events`; `narrative/demand-events.ts` startet und beendet sie ueber die gemeinsame Engine, `demand.ts` liest nur noch daraus. Alte v5–v9-Saves werden beim Laden in eine aktive Instanz mit Restlaufzeit konvertiert; abgelaufene verfallen.
- NAR-00 bis NAR-17 sind umgesetzt; Ledger-Cursor, referenzsichere Retention, die Beziehungsquellen aus Besuch, Streit, Kasse und Rivalenabrechnung, der Trigger-Vertrag und der Event-Scheduler sind umgesetzt. `narrative/trigger-context.ts`, `trigger-evaluate.ts` und `trigger-schema.ts` liefern Context, reine Auswertung und fail-closed Validierung; `narrative/triggers.ts` ist die Fassade. `narrative/event-lifecycle.ts`, `event-scheduler.ts`, `event-schema.ts` und `narrative-rng.ts` verwalten persistente Instanzen, Cooldowns, Fristen, Stale-Cancel und deterministische Fairness. Seit NAR-12 verbindet `narrative/runtime.ts` Facts, Trigger und Scheduler in einem festen Lauf: `processNarrativeRuntime()` drainiert den Boundary hoechstens einmal, wertet die deklarativen Trigger aus `events/trigger-definitions.ts` aus, uebersetzt Treffer ueber die Template-Registry in Kandidaten und laesst `scheduleCandidates()` hoechstens drei Instanzen anlegen; neue Facts warten auf den naechsten Lauf. `tickWorld()` ruft die Runtime genau einmal am Ende, der Store flusht nach jeder erfolgreichen Command-Ausfuehrung sowie nach Neues Spiel, Import und Rivalenspiel ueber `store/narrative-commands.ts`. Eine aufgeloeste Choice ist selbst ein `EVENT_RESOLVED`-Fact und schliesst den Kreis Command→Fact ohne Rekursion. NAR-08 liefert Command-Parser, Allowlist, Preflight und die einmalige Ausfuehrung von Choice-Effekten; NAR-11 ergaenzt den lokalen Composer, aber noch keinen UI-Anschluss. `docs/EVENT-NARRATIVE-ENGINE-TASKPLAN.md` regelt den Zielzustand; NAR-13 hat die Demand-Events in die gemeinsame Engine ueberfuehrt, NAR-14 hat die Narrative UI angeschlossen: `narrative/view.ts` baut Szenen und Profile als reines Anzeigemodell (`GameView.narrative`), `src/ui/narrative-*` rendert sie, `dismissNarrativeCmd()` lehnt eine Szene ueber den Lifecycle ab. NAR-15 ergaenzt den persistenten Rivalen-Zustand mit reiner Politik, `RIVAL_ACTION`-Facts und Sabotage mit Indizien; NAR-16 deckt Langzeit, Save-Budget und Hotpath mit Tests, Benchmarks und `ci:long` ab; NAR-17 synchronisiert Doku und Testkatalog mit dem Code. Im Spiel gibt es keine LLM- oder Provider-Anbindung; nur lokal validierter Content darf Darstellung liefern. Der Profil- und Historien-Anschluss bleibt reine Ableitung: `buildNarrativeView()` nimmt Gaeste auf dem Floor ueber `Guest.visitorId` in die Profile auf und liefert die juengsten zwoelf abgeschlossenen Szenen als `history` (Status, Ausgang, Teilnehmer, Abschlusstakt). `GuestPopup` oeffnet ueber `onProfile(visitorId)` direkt das Profil, `NarrativePopup` startet mit `initialVisitorId` im Figuren-Tab; ein unbekanntes Profil zeigt keine fremde Figur.
- Physik liegt in `src/core/physics/`: `body.ts` beschreibt Koerper (Position, Geschwindigkeit, Rotation, Winkelgeschwindigkeit, Masse, Traegheit, Reibung, Restitution, Form), `world.ts` simuliert mit festem Zeitschritt und aufgeloesten Impulsen. Kollisionen erzeugen ueber die Tangentialreibung echtes Drehmoment. Statische Koerper koennen rotieren und uebertragen ihre Oberflaechengeschwindigkeit; `trigger`-Zonen sind nicht solide und werden ueber `triggerHits` gelesen. Die Welt kennt weder Pixi noch DOM, und die Breitphase ist allokationsfrei.
- Plinko ist kein Wuerfel mehr: `src/core/games/plinko-board.ts` baut das Board aus echten Pegs, Waenden und Deflektoren. Zufall steckt nur in der Startbedingung; welches Fach der Ball trifft, entscheiden danach ausschliesslich Kollisionen. Die Paytable ist auf die gemessene Fachverteilung geeicht.
- Jedes Spiel hat seine eigene Engine unter `src/core/games/engines/`: `slot.ts` (3 bis 5 Walzen mit je drei Reihen aus `slot-config.ts`, Linien je Walzenzahl, gewichtete Symbole, BOOK als Wild und Scatter, Freispiele), `cards.ts` (Blackjack mit Ziehen/Verdoppeln und Dealer-Regel, Video Poker mit Hold/Draw und Paytable als Daten), `table.ts` (Roulette mit voller Wettfläche, zwei Würfel, Hütchenspiel mit Serie). `round.ts` ist nur noch der Dispatcher auf diese Engines.
- Spiele haben genau eine Naht: `src/core/games/contracts.ts`. `playAction({ game, stake, houseEdgeBps?, bonusBps? })` prüft die Aktion **vor** der Ziehung, spielt die Runde und liefert `{ game, stake, payout, multiplierBps, label, detail }`. `payout` ist immer `mulVC(stake, multiplierBps)`, ein Verlust bleibt 0, Bonus und Hausvorteil greifen nur auf Gewinne. `round.ts` ist nur noch die Engine dahinter: `playRound` hat außerhalb dieses Vertrags keinen Produktions-Aufrufer mehr. Verbraucher sind der Gast-Spin (`guest-play`), der freie Testspin und das Fremdspiel (`actions`).
- Der PRNG-Zustand (`prngState`) liegt im Save. `replaySave` zieht selbst nichts, deshalb setzt die Folge nach dem Laden exakt an der gespeicherten Stelle fort.
- `world.journal` ist ein typisiertes Ringpuffer-Ereignisprotokoll (maximal 240 Einträge). `settleMoneyJournal` kopiert jede neue Ledger-Zeile genau einmal als `MONEY`-Event; Geld bleibt ausschließlich im Ledger. Welt-Ereignisse tragen `cause` und `effect`. `JournalPopup` zeigt daneben im Tab „Geschichten“ die abgeleitete Szenen-Historie; sie ist eine View derselben Event-Instanzen und keine zweite Log-Quelle.
- `world.look` ist rein kosmetisch: Haut, Haare, Outfit und Accessoire. Es gibt keine Gameplay-, Preis- oder Geldwirkung.
- Personalstatus (`task`, `blockedReason`) liegt am `StaffAgent`, nicht in der UI. Die Diagnose liest ihn nur.
- Jede Datei traegt genau eine Zustaendigkeit und bekommt ihr Budget samt eigener Hot Zone aus `scripts/loc-budgets.mjs` (Legacy 350/200). Registries und State Machines sind Knoten mit genau einer Wahrheit, keine gespiegelten Zustandskopien. Schreibpfade laufen serialisiert ueber den Store, Engines bleiben reine Funktionen.

- Navigation: `src/core/sim/nav-grid.ts` baut ein `NavGrid` aus belegten Möbel-Tiles und den Wandkanten des Layouts. Nur `WALL` steht in `walls`; `DOOR` und `OPENING` fehlen dort und sind damit passierbar. `blockedTiles()` sperrt keine Rand-Tiles mehr, den Rand schließt die Randkante des Layouts. A* (`pathfinding.ts`) prüft jeden Schritt über `stepOpen()`; `accessPointsFor()` liefert alle freien Zugänge eines Footprints mit offener Kante zum Objekt, `approachPoint()` bleibt als Fallback in alter Reihenfolge. `nav-reach.ts` prüft Erreichbarkeit über offene Kanten und verhindert, dass eine Platzierung einen Service abschneidet; `canPlaceAt()` weist Tür-Tiles und versiegelnde Platzierungen ab. Der Cache hängt an Brettgröße, Möbelstruktur und der Identität des unveränderlichen Layouts, damit jede Layout-Änderung ein neues Raster erzwingt.

- Boden und Wände: `src/render/floor-material.ts` ist die einzige Auflösung von `FloorMaterialId` zu Darstellung, Textur und stabiler Fallback-ID; nur CARPET hat eine echte Manifest-Textur, alle anderen Materialien bleiben prozedural. `src/render/wall-art.ts` leitet Band, Vorderseite, Pfosten und Schwelle aus `layout.edges` ab; jede Kante gehört genau einer Kachel, damit kein Chunk sie doppelt zeichnet. `regionHash` in `floor-math.ts` mischt Bodenmaterialien und Kanten eines Chunks und cached den Layout-Beitrag je Layout-Identität; eine Tile-Änderung invalidiert nur ihren 30×30-Chunk. Zonen liefern weiter Licht und Ausstattung, nie das Bodenmaterial.

- Tiefe: `src/render/depth.ts` ist der gemeinsame Sortiervertrag. Sortiert wird nach Fußanker (`footAnchor`), dann Typ-Rang (prop, furniture, actor, wall), dann stabiler ID; große Sprites lesen nie ihre Oberkante. `DepthStage` sortiert nur bei geänderter Tiefe. `WallOcclusion` legt Wandkanten als Sprites mit geteilten Texturen in dieselbe Ebene, damit eine Wand Figuren im Norden verdeckt und Figuren im Süden nicht. Türschwellen bleiben im gebackenen Chunk.

## Fehler-Governance

1. Jede Fehlermeldung hat das Format `[IDX-XXXX] [ERR-YYYY] Komponente: Klartext`.
2. Neue Fehlerarten werden zuerst in `docs/ERROR_CATALOG.md` und `src/core/governance/error-codes.ts` registriert.
3. `ERR-0000` ist ein unbekannter Fehler und blockiert den Build sofort (Fail-Closed).
4. `ERR-0911` kennzeichnet automatisch reparierbare Verstöße. Repariert wird ausschließlich im Fix-Modus (`pnpm run fix`); jeder Verify-Lauf liest nur und macht einen veralteten Baum rot.
5. Jede Testdatei deklariert `@test-target` und `@error-code`; der Reporter `src/core/governance/test-harness.ts` gibt jeden Testfall indiziert aus.
6. Tests laufen im Thread-Pool (`pool: 'threads'`) mit harter Teardown-Grenze. Worker sind Threads im Runner-Prozess und sterben mit ihm, es bleiben also keine verwaisten Testprozesse zurueck; `testTimeout` und `teardownTimeout` beenden haengende Tests. Die sechs RTP-Monte-Carlo-Laeufe sind parallelisiert, ziehen pro Lauf frische Seeds und sind an die Tail-Verteilung angepasst: SLOT 200.000, SHELL 300.000, PLINKO 5.000 Runden. Tischpoker wird nicht ueber RTP bewertet, sondern ueber die 7-Karten-Handverteilung und den Kartenschuh (`poker-distribution.test.ts`, `poker-table.test.ts`). Feste Seed-Literale lehnt `verify-test-quality` ab; die Seeds sind nicht per Env oder CLI waehlbar. Die Paytables sind auf ~93 % RTP kalibriert, damit das 90–96-%-Band auch mit frischen Seeds nicht zufaellig kippt.

## Pipeline

`verify` liest ausschließlich, `fix` ist der einzige schreibende Modus. Der Plan beider Modi steht in `scripts/lib/pipeline-plan.mjs`; kein Profil enthält einen Autofix-Schritt.

Es gibt drei Profile, alle über `scripts/run-pipeline.mjs --profile=…`:

| Profil | pnpm-Skript | Inhalt |
| --- | --- | --- |
| `quick` | `verify` / `verify:quick` | Zehn Gates: Lint, LOC, Typecheck, Testvertrag, Dead-Export, Doku-Gate inklusive Inventar-Abdeckung, Tree-Gate, Redundanz-Gate, Asset-Manifest, schnelle Tests. Kein Build, kein Audit, keine RTP-, Balance- und Soak-Nachweise. |
| `full` | `verify:all` | Dieselben zehn Gates plus `audit` und `build`, also zwölf. Unverändert das Tor vor jedem Commit. |
| `release` | `verify:release` | Wie `full`, erzwingt aber `pnpm audit` unabhängig von der Änderung. |

Zusätzlich wählt `pnpm run test:affected` Testdateien nach deklariertem `@test-target`, dem transitiven Importgraphen aus `src/` und `scripts/` und dem betroffenen Spiel-/Simulationssubsystem aus. Der Graph wird rückwärts gelesen: geändert ist, wer das Geänderte importiert, auch über Zwischenmodule. Das ist Entwicklungsfeedback und kein viertes Gate: `full` und `release` fahren weiterhin die vollständige Suite, weil eine Auswahl Tests ausserhalb des Graphen übersehen kann. `pnpm run turn:finish -- --affected` fährt die Auswahl vor dem Versions-Bump als zusätzliche Entwicklungsstufe; danach läuft `verify:quick` beziehungsweise mit `:full` unverändert `verify:all`.

## Testkatalog und Beweisklassen

Jede Testdatei gehört genau einem System (`games`, `sim`, `economy`, `rng`, `physics`, `governance`, `render`, `ui`, `store`, `test-tools`, `pipeline`, `ci`) und genau einer Beweisklasse: `contract`, `integration`, `governance`, `statistics`, `performance`. Das System stammt aus dem deklarierten `@test-target`, die Beweisklasse aus der Rolle der Datei in `scripts/lib/test-catalog.mjs`. `docs/TEST-CATALOG.md` ist die abgeleitete Tabelle; `pnpm run catalog` schreibt sie, der Verify-Lauf prüft sie im `--check`-Modus (`ERR-4015`).

Lokal laufen nur `contract`, `integration` und `governance`. `statistics` (RTP, Poker-Verteilung, Soak, Balance) und `performance` (Benchmarks) delegiert `pnpm run test:affected` an CI; sie sind die teuren Nachweise, nicht die schnelle Schleife.

Jedes Gate hat ein hartes Zeitlimit aus `scripts/lib/pipeline-plan.mjs`. Läuft es ab, beendet `scripts/lib/gate-runner.mjs` den Prozessbaum und meldet `ERR-4014`, statt den Lauf offen zu halten. Verwaiste Prozesse werden nur beendet, wenn PID **und** Startzeit noch zum Registry-Eintrag passen; eine wiederverwendete PID bleibt unangetastet.

Der Cache-Schlüssel jedes Gates enthält sein Profil: ein grüner Schnellauslauf der Suite darf den Vollauslauf nie ersetzen. `pnpm audit` läuft lokal nur bei einer Änderung an `package.json` oder `package-lock.json`, in CI und im Release-Profil immer — es ist das einzige Gate, das ausserhalb des Repos rot werden kann.

`pnpm run verify:all` führt in dieser Reihenfolge aus, jede Stufe nur lesend:

1. ESLint ohne `--fix` (`ERR-4011`)
2. LOC-Guard (`ERR-4012`)
3. TypeScript (`ERR-1005`)
4. Testqualität und Determinismus (`ERR-1001`, `ERR-4001`, `ERR-4002`, `ERR-3001`)
5. Tote Exporte (`ERR-4003`)
6. Doku-Gate inklusive Inventar-Abdeckung gegen `git ls-files` (`ERR-4017`)
7. Tree-Gate (`ERR-4019`)
8. Redundanz-Gate (`ERR-4020`)
9. Asset-Manifest gegen `public/assets` und NAR-09/NAR-10/NAR-11-Content-Registry (`ERR-4016`, Content `ERR-4022`)
10. Vitest mit indizierten Testfällen
11. `pnpm audit --audit-level=low` (`ERR-4004`)
12. Production-Build (`ERR-1005`)

Jedes Gate legt sein vollständiges Log und eine `summary.md` unter `.verify-cache/reports/<Zeitstempel>/` ab. Die Konsole nennt je Gate eine Zeile und im Fehlerfall dessen letzte 40 Zeilen; `RBD_VERIFY_VERBOSE=1` gibt die volle Ausgabe aus. Der Berichtsordner liegt im gitignorierten Cache, damit Verify weiterhin rein lesend bleibt.

`pnpm run fix` repariert ESLint-Verstöße und die Dependency-Matrix und prüft danach dieselben Gates. Er nennt jede geänderte und jede gelöschte Datei; ein zweiter Lauf meldet „keine Änderung, Arbeitsbaum unverändert“. Das Main-Gate aus zwei Ebenen beschreibt `docs/CI-GATES.md`.

### Gemessene Wandzeit (31.10.2026, 6 Kerne, Cache geleert)

- `verify:all` vor dem Umbau: **48,1 s** — Autofix 14,2 s sequenziell, danach kritische Pfad `tests` 33,6 s. Typecheck (23,6 s), Build (27,5 s) und Audit (5,0 s) liegen darunter und kosten keine Wandzeit, nur CPU.
- Die Suite misst 72,5 s CPU über 56 Dateien, davon 52,2 s in vier Nachweisdateien (`round-rtp-high` 30,6 s, `soak` 12,4 s, `round-rtp-machines` 7,6 s, `slot-session-rtp` 1,6 s); die übrigen 52 Dateien brauchen zusammen 20,3 s.
- ESLint-Cache (`--cache --cache-strategy content`, Konfigurations- und Lockfile-Hash als Sperrvorhang): 14,2 s → 2,6 s warm, unfixbare Reste bleiben auch mit warmem Cache rot.
- Typecheck inkrementell (`tsconfig.tsbuildinfo`, ignoriert): 11,3 s → 6,0 s.
- Ergebnis: `verify:quick` **17,4 s** kalt und **1,2 s** bei unverändertem Baum, `verify:all` danach unter 30 s, solange der Baum unverändert ist.
- Der Gate-Cache liegt in `.verify-cache/` ausserhalb von `node_modules`, damit `pnpm install --frozen-lockfile` ihn nicht zerstört; die Workflows holen ihn über `actions/cache` wieder.
- Nicht umgesetzt: weniger Gate-Worker. Bei 6 Kernen laufen etwa 4,3 Kerne parallel; Typecheck verlangsamt sich unter Last von 11,3 s auf 23,6 s, bleibt aber unter der Test-Gate und damit unter der kritischen Pfad. Runterdrehen würde Wandzeit kosten, deshalb bleibt `RBD_VERIFY_WORKERS` der einzige Hebel.

## Dependency-Begründungen

Jede Laufzeit- und Entwicklungabhängigkeit braucht eine nicht-leere Begründung und mindestens eine reale Nutzung. Die folgende Matrix wird von `scripts/sync-dependency-matrix.mjs` aus `package.json` und den echten Imports erzeugt; sie belegt Nutzung, nicht Notwendigkeit. Die Bewertung mit Sicherheitslage, Konsolidierungsoptionen und Entscheidungen steht in `docs/DEPENDENCY-AUDIT.md` (Stand 31.10.2026).

<!-- DEP_MATRIX_START -->
| Paket | Version | Kategorie | Architektur-Begründung | Real genutzte Dateien (Anzahl & Pfade) |
| --- | --- | --- | --- | --- |
| @capacitor/android | ^8.6.0 | Android | Native Android-Plattform, aus der Gradle Debug- und Release-APK baut. | 1: `scripts/prepare-android.mjs` |
| @capacitor/cli | ^8.6.0 | Android | Capacitor-CLI: erzeugt das Android-Projekt und synchronisiert Web-Build und Huelle. | 1: `scripts/prepare-android.mjs` |
| @capacitor/core | ^8.6.0 | Android | WebView-Bridge der Android-Huelle; von cap sync an die native Seite uebergeben. | 1: `scripts/prepare-android.mjs` |
| @eslint/js | ^10.0.1 | Lint | Empfohlene ESLint-Basisregeln. | 1: `src/Config/eslint.config.mjs` |
| @testing-library/react | ^16.3.3 | Test | Rendert HUD und Popups fuer Integrations- und Fokustests in jsdom. | 5: `src/ui/__tests__/card-tables.test.tsx`<br>`src/ui/__tests__/dialogue-ui.test.tsx`<br>`src/ui/__tests__/guest-profile.test.tsx`<br>`src/ui/__tests__/narrative-ui.test.tsx`<br>`src/ui/__tests__/ui.test.tsx` |
| @types/node | ^22.20.5 | Typen | Typen fuer Node-Builtins in Gate-Skripten und Vitest-Reporter. | 60: `scripts/agent-verify.mjs`<br>`scripts/autofix-0911.mjs`<br>`scripts/balance-run.mjs`<br>`scripts/bench-lowend.mjs`<br>`scripts/branch-cleanup.mjs`<br>`scripts/build-asset-manifest.mjs`<br>… (+54) |
| @types/react | ^19.0.7 | Typen | Typpaket fuer die React-19-API; wird implizit von React-Imports genutzt. | 42: `src/App.tsx`<br>`src/main.tsx`<br>`src/render/floor-stage.tsx`<br>`src/render/games/blackjack-stage.tsx`<br>`src/render/games/dice-stage.tsx`<br>`src/render/games/plinko-stage.tsx`<br>… (+36) |
| @types/react-dom | ^19.0.3 | Typen | Typpaket fuer React-DOM; wird implizit von react-dom-Imports genutzt. | 2: `src/main.tsx`<br>`src/ui/__tests__/casino-window-header.test.tsx` |
| @vitejs/plugin-react | ^6.1.2 | Build | React-19-JSX-Transform und Fast Refresh fuer Vite. | 1: `src/Config/vite.config.ts` |
| eslint | ^10.14.0 | Lint | Fail-Closed-Lint-Gate mit TypeScript-Parser und ungenutzten Symbolen. | 2: `package.json`<br>`src/Config/eslint.config.mjs` |
| ffmpeg-static | ^5.3.0 | Assets | Kodiert die WAV-Musikmaster zu Opus fuer die Auslieferung; reines Build-Werkzeug, nicht im Bundle. | 1: `scripts/encode-audio.mjs` |
| globals | ^16.5.0 | Lint | Browser- und Node-Globals fuer die ESLint-Konfiguration. | 1: `src/Config/eslint.config.mjs` |
| jsdom | ^30.1.3 | Test | DOM-Umgebung fuer UI-, Fokus- und Tastaturtests ohne echten Browser. | 8: `package.json`<br>`scripts/sync-dependency-matrix.mjs`<br>`src/render/games/slot-stage.tsx`<br>`src/ui/__tests__/card-tables.test.tsx`<br>`src/ui/__tests__/dialogue-ui.test.tsx`<br>`src/ui/__tests__/guest-profile.test.tsx`<br>… (+2) |
| pixi.js | ^8.6.6 | Runtime | WebGL/Canvas-Renderer fuer Floor, Figuren, Sticker und Spiele; kein DOM-Rendering im Spielfeld. | 48: `src/render/assets/textures.ts`<br>`src/render/comic-bubbles.ts`<br>`src/render/floor-animate.ts`<br>`src/render/floor-camera.ts`<br>`src/render/floor-carpet.ts`<br>`src/render/floor-cues.ts`<br>… (+42) |
| react | ^19.0.0 | UI | Deklarative HUD-, Popup- und Panel-Oberflaeche mit einem Store-Snapshot. | 42: `src/App.tsx`<br>`src/main.tsx`<br>`src/render/floor-stage.tsx`<br>`src/render/games/blackjack-stage.tsx`<br>`src/render/games/dice-stage.tsx`<br>`src/render/games/plinko-stage.tsx`<br>… (+36) |
| react-dom | ^19.0.0 | UI | Mountet die React-Oberflaeche in den Browser. | 2: `src/main.tsx`<br>`src/ui/__tests__/casino-window-header.test.tsx` |
| typescript | ^6.0.3 | Build | Strikte Typpruefung mit noUncheckedIndexedAccess und ungenutzten Symbolen. | 2: `scripts/lib/ts-ast.mjs`<br>`src/Config/tsconfig.json` |
| typescript-eslint | ^8.72.1 | Lint | TypeScript-Parser und Regeln fuer das Lint-Gate. | 1: `src/Config/eslint.config.mjs` |
| vite | ^8.3.5 | Build | Dev-Server und Production-Bundler; liefert die Modul- und CSS-Pipeline. | 1: `package.json` |
| vitest | ^5.0.5 | Test | Deterministische Unit- und Monte-Carlo-Beweise fuer Ledger, Spiele und Simulation. | 161: `package.json`<br>`src/Config/vite.config.ts`<br>`src/core/economy/__tests__/economy.test.ts`<br>`src/core/economy/__tests__/ledger-checkpoint.test.ts`<br>`src/core/economy/__tests__/ledger-diagnose.test.ts`<br>`src/core/games/__tests__/contracts.test.ts`<br>… (+155) |
| yaml | ^2.9.1 | Test | Parst die GitHub-Workflows fuer strukturelle Gate-Tests statt Regex und Stringpositionen. | 2: `scripts/version-bump.mjs`<br>`src/core/governance/__tests__/ci-gates.test.ts` |
<!-- DEP_MATRIX_END -->

## Import und Export

Der Transfer ist dreistufig und besitzt keine zweite Save-Wahrheit:

| Modul | Verantwortung |
| --- | --- |
| `src/core/io/issues.ts` | Befund mit Stufe `FATAL`/`REPAIR`/`IGNORE` und Uebersetzung in die Eskalations-Leiter. |
| `src/core/io/envelope.ts` | Umschlag (`kind`, `format`, `savedAt`, FNV-1a-Pruefsumme) bauen und pruefen. |
| `src/core/io/repair.ts` | Nutzlast pruefen, fehlende Pflichtfelder ergaenzen, Blocker melden. |
| `src/store/transfer.ts` | Export aus `toSavedGame`, Import-Plan ueber `replaySave`; liefert Befund und geladenen Stand. |
| `src/ui/transfer-panel.tsx` | Oberflaeche im Pruefungs-Popup: exportieren, pruefen, importieren. |

Regeln: `FATAL` blockiert und entspricht `BLOCKED`; `REPAIR` wird automatisch
angewendet (`AUTO_FIX`); `IGNORE` verfaellt (`LOCAL_GATE`). Der Import fuehrt
immer zuerst einen Trockenlauf aus; erst ein Stand ohne Blocker ersetzt Welt,
Ledger und PRNG. Save-Format bleibt v8, Migrationen liegen weiterhin allein in
`src/store/migrate.ts`.

## Baum- und Redundanz-Gate

Zwei mechanische Gates halten den Baum sauber, ohne Inhalt zu bewerten:

| Gate | Code | Prueft |
| --- | --- | --- |
| `verify:tree` | `ERR-4019` | Wurzel-Whitelist, erlaubte Endungen je Ordner, Tests nur in `__tests__`, `src/core` ohne React/Pixi und ohne Importe nach aussen. |
| `verify:redundancy` | `ERR-4020` | Byte-identische Quelldateien, doppelte pnpm-Kommandos, doppelt eingetragene Fehlercodes. Alias-Paare sind ausdruecklich erlaubt. |

Regeln stehen als Tabelle in `scripts/verify-tree.mjs`; ein neuer Ordner braucht
genau einen Eintrag. Doku-Eintraege erzeugt `pnpm run docs:stub -- "Titel"`
(`ERR-4021`), damit Changelog, Devtagebuch und Inventar nie ohne Datum bleiben.

## Delivery-Regel

**Nach jedem abgeschlossenen Arbeits-Turn wird auf `main` geliefert.** Der verbindliche Weg ist:

```bash
pnpm run turn:finish
```

`turn:finish` führt Autofix und das Prüfprofil aus — im Normalfall `verify:quick`, über `pnpm run turn:finish:full` das volle `verify:all` —, erzeugt bei Änderungen einen Commit im deutschen Steam-Developer-Notes-Format (ohne Drittanbieter-Trailer) und pusht auf `main`. Der vollständige Beweis läuft in CI: jeder Push auf `main` durchläuft dort `verify:all`, also alle zwölf Gates; der Release-Workflow taggt erst nach diesem erfolgreichen Lauf und wiederholt die Suite nicht. Ohne Argumente stagt `git add -A` alles, was `.gitignore` übrig lässt, also auch neue Dateien; mit Pfaden wird bewusst nur der genannte Ausschnitt committet. Ein fehlgeschlagenes Gate verhindert Commit und Push. Vor `verify` wird die Patch-Version gebumpt, sodass der Commit bereits die Version trägt, die der Release-Workflow taggt; `.turn-notes.md` wird nach dem erfolgreichen Commit gelöscht, damit keine zwei Commits denselben Titel tragen. Lehnt der Branch-Schutz den Direktpush ab, wird der Arbeitsbranch gepusht und ein fokussierter PR gegen `main` nötig.

Der Release-Workflow committet nicht mehr: `turn:finish` bumpt die Patch-Version lokal, der Workflow nach dem Push liest sie aus `package.json`, legt Tag `v<Version>` an und erstellt das Release — nur wenn der Tag noch fehlt. `main` bleibt damit nach dem Push stehen. Das Nachziehen von `origin/main` in `turn:finish` (holen, rebasen, zweites `verify:all`, höchstens drei Versuche) bleibt als Netz für den Fall, dass jemand anders auf `main` pusht; erst wenn der Remote aktuell ist und der Push dennoch abgelehnt wird, gilt es als Branch-Schutz.

Der Geschwindigkeits-Benchmark läuft separat über `pnpm run test:perf` und ist absichtlich nicht Teil von `verify:all`: Er misst Durchsatz und ist kein Korrektheitsgate.

## Impact, Plan und Bericht

Eine Analyse traegt jeden Schritt: `scripts/lib/impact.mjs` verbindet
Aenderungsstand, Importgraph, Testziele, Beweisklassen, Gate-Plan und
Cache-Stand zu einem Objekt. `agent:context` gibt es kompakt aus,
`agent:verify` leitet daraus denselben Gate-Plan ab, den `pipeline-plan` fuer
das Profil vorsieht, und fuehrt ihn ueber `runGates` aus. Es gibt keine zweite
Gate-Liste und keinen zweiten Importgraphen; die Auswahl betroffener Tests
setzt nur `RBD_TEST_FILES`, das Testgate bleibt dabei ungecacht. Lange
Nachweise werden nicht gedruckt, sondern uebergeben: `--ci` startet
`ci-long-checks.mjs` und wartet auf das Ergebnis.

## Auto-Promotion und Integrationsbranch

Der Weg von einem Branch nach `main` ist ein Zustandsautomat mit genau einer
Quelle: `.github/workflows/promote.yml` liest das Ergebnis von `CI Verify`.
Gruen legt den PR an und mergt ihn, rot legt den Stand auf die permanente
Branch `integration`. Der Zustand liegt im Branch und im Label
(`integration/rot`, `integration/konflikt`), nie in der Warteschlange — GitHub
haelt pro Concurrency-Gruppe nur einen wartenden Lauf, deshalb arbeitet jeder
Lauf den gesamten Rueckstand ab und ist idempotent. `scripts/promote.mjs` baut
den Commit-Text selbst, damit die Pflichtsektionen auch nach einem
`squash`-Merge stehen. Ein Merge mit dem Workflow-Token startet keinen Workflow: der Pfad stoesst deshalb
den Release-Lauf an oder nutzt `PROMOTE_TOKEN`. `integration` ist geschuetzt,
weil der Rueckweg nach `main` die Branch sonst mitnimmt. Einzige Identitaetsquelle ist
`scripts/lib/identity.mjs`; `.mailmap` fuehrt die History-Anzeige zusammen.

## Floor-Rendering und Performance

Der Boden liegt in 30×30-Regions-Chunks (`src/render/scene-cache.ts`); ein Chunk backt nur neu, wenn sich sein Regions-Hash (`src/render/floor-math.ts`) ändert. Möbel stehen auf einer eigenen Ebene und backen den Boden nicht neu. Dreck wird pro Region invalidiert. Kamera, LOD, Culling und Koordinaten sind reine Mathe und getestet (`src/render/__tests__/floor-cache.test.ts`). Agenten, Kisten, Dispute und Platzierungs-Geist laufen auf der Requisiten-Ebene (`src/render/floor-props.ts`). Partikel und Shake liegen seit 0.3.118 auf der Buehne (`src/render/fx/floor-fx.ts`); der Emitter allokiert im Frame nichts und deckelt bei 200 Sprites.

Seit 0.3.119 liegt die Ereignisantwort in genau einer Tabelle (`src/render/floor-events.ts`): eine Subscription auf `core/sim/events`, acht Zeilen, je Ereignis Burst, Ton, Licht, Shake und ein Anker aus dem Snapshot. `floor-fx.ts` kennt keine Ereignisse mehr, sondern nur noch `burst`, `flash` und `shake`; das Licht kommt aus einem Pool von hoechstens acht Graphics. Die Kasse ist ein eigenes Objekt (`src/render/floor-cash.ts`) an der Requisiten-Ebene: Chip-Stapel, warmes Pulslicht und gedrosseltes Klingeln, gespeist aus `pending` und `tick`, nie aus der Uhr.

Seit 0.3.120 hat der Boden einen Produktionsatlas: `build-asset-manifest.mjs` packt die vier Ordner `characters`, `decor`, `environment` und `machines` mit demselben Shelf-Plan wie `atlas.ts` in zwei deterministische 1024er-Seiten. Der Laufzeitpfad registriert nur noch Seitenausschnitte; fehlt eine Seite, packt `atlas.ts` die Einzeldateien selbst. Damit bleiben die 153 Frames aus dem kritischen Pfad: der Browser misst 20 Requests und 2,51 s bis zum ersten Frame im 4G-Profil (9 Mbit/s, 70 ms RTT, kalter Cache). Der Loader haengt an `onFirstFrame` nach `renderer.render(stage)`, nicht an einem Timer.

Der `PerfGovernor` ist reine Darstellung ohne Spielzustand: er bekommt `deltaMS`, fuehrt zwei Sekunden Abweichung und liefert eine von drei Stufen. `floor-stage.tsx` uebersetzt sie in Renderer-DPR, `ticker.maxFPS`, Partikel- und Lichtlimit. Mobile Sicherheitsabstaende kommen aus `--safe-*` in `tokens.css` und `viewport-fit=cover`; die Haptik bleibt bei reduzierter Bewegung still und braucht keine Capacitor-Abhaengigkeit.

### Ereignisse auf dem Boden (8 × 4)

| Ereignis | Partikel | Sound | Licht | Bewegung |
| --- | --- | --- | --- | --- |
| `slot:jackpot` | `jackpot-burst`, 30 | `win` | Gold, 620 ms, 96 px | Shake 6 px |
| `money:bigPayout` | `coin-burst`, 22, an der Kasse | `coin` | Warm, 450 ms, 74 px | - |
| `dispute:start` | `smoke-puff`, 16, am Gast | `brawl` | Rot, 700 ms, 86 px | Shake 10 px |
| `slot:chargeReady` | - | `pinHit` | Service, 520 ms, 42 px | LED-Puls am Geraet |
| `slot:chargeDischarge` | `machine-sparks`, 14 | `coin` | Warn, 360 ms, 52 px | Shake 4 px |
| `slot:spin` | - | `reelStop` | Identity, 260 ms, 30 px | - |
| `plinko:drop` | `plinko-impact`, 16 | `pinHit`-Serie (7 Pins) | Cyan, 380 ms, 48 px | Shake 5 px |
| `dispute:sabotage` | `machine-sparks`, 16, rot | `brawl` | Rot, 420 ms, 60 px | Shake 6 px |

Kein Ton ohne sichtbares Pendant: wo kein Burst liegt, traegt ein Licht oder ein Shake die Rueckmeldung. Der Anker kommt aus dem Snapshot, nicht aus der Bildmitte: `itemId` wird zur Mitte des Moebels, `guestId`/`guestIds[0]` zum Fuss des Gasts, `plinko:drop` zum Plinko-Brett, `money:bigPayout` zur Kasse; fehlt alles, faellt der Punkt auf die Spielfigur zurueck.

Messung vom 30.10.2026 auf der Cloud-VM, für das Low-End-Profil mit `taskset -c 0` auf einen Kern gepinnt (Emulation, keine echte schwache Hardware): 9 Regions-Hashes 0,0008 ms, Neuzeichnen aller 9 Boden-Chunks 1,1685 ms (nur bei Template-/Teppichwechsel), Dreck in 9 Regionen mit 500 Tiles 0,8068 ms, Culling über 200 Entities 0,0026 ms. Dazu: 200 Rig-Posen 0,0128 ms, Snapshot mit 200 Gästen und 5.000 Buchungen 0,1047 ms, vollständige Ledger-Prüfung über 5.201 Buchungen 0,0042 ms. 1.000 Ticks messen 949,9 ms; der Save bleibt bei 115,2 KiB. Das Heap-Delta ist wegen GC nicht belastbar und wird nur als Rohwert geloggt. Steady-State pro Tick: Hash + Culling, keine Neuzeichnung.

Die Messungen nutzen eine explizite Hilfe (`src/test/measure.ts`) mit einem Warmup und festen 5–20 Läufen statt der Tinybench-Stichprobe. PLINKO wird im Runden-Benchmark mit 500 Drops pro Operation gemessen; 20.000 Physik-Drops pro Operation waren der Grund für den alten Mehrminuten-Lauf. Seit NAR-16 hat der Runden-Benchmark ein Zeitbudget je Spiel: langsame Hardware liefert die Kennzahl ms/Runde, statt in den Timeout zu laufen. Der gesamte `test:perf`-Lauf bleibt damit im Bereich weniger Sekunden bis unter einer Minute. Die Zahlen schwanken mit CPU-Last und JIT; sie sind Indikatoren, kein Gate. Echte Geräte und ein echter Browser bleiben eine manuelle Abnahme.

## Bodenhinweise, Kamera und Bildsprache

- `src/render/floor-cues.ts` ist die einzige Ebene, die Steuerung sichtbar macht: Zielraster unter dem Zeiger, Ring am Figurenfuss, Punktspur des Laufwegs, Puls am Klickziel. Sie liest Snapshots und Pixelkoordinaten, kennt keine Regel und schreibt keinen Spielzustand. Die Farbe traegt die Folge: Service heisst laufen, Identity heisst heranziehen; die Kopplung sitzt in `setMode(detail)` und kommt aus dem LOD der Kamera. Seit 0.3.118 erscheint das Raster schon bei `pointerdown` und leuchtet 500 ms nach; der Ping besteht aus drei gebackenen Ring-Sprites statt neun Graphics pro Frame.
- Das Zielraster haengt am Zeiger, nicht am Bild: nach jeder Kamerafahrt setzt `refresh()` die Kachel ueber die letzte Zeigerposition neu, sonst zeigt es auf eine Kachel, die nicht mehr unter der Maus liegt.
- `src/render/floor-camera.ts` ist weiterhin die einzige Kamera-Wahrheit und reine Mathematik: `pan` (normalisierte Weltanteile, geclampt auf 0..1), `zoomStep` (Tasten und Knoepfe) und `keepInView` (zieht nach, sobald die Figur 55 Prozent der halben Sicht verlaesst; in der Uebersicht und auf dem Rueckweg dorthin bleibt der Fokus mittig). `floor-touch.ts` uebersetzt Zeigergesten in diese drei Aufrufe: Rad, Pinch, Ein-Finger-Pan ab 8 px bei Touch und Ziehen mit mittlerer oder rechter Taste; ein Tipp ohne Pan laeuft erst bei `pointerup`. `floor-view.ts` uebersetzt Tastatur und Ticker.
- `src/ui/stage-controls.tsx` ist die einzige Bedienflaeche der Buehne: Tastenkuerzel als `kbd`-Chips und die Kamera-Knoepfe. Sie haelt keinen Zustand und ruft nur `zoom` und `fit` ueber das `FloorHandle`. Die Aktionsflaeche ist `src/ui/action-card.tsx`: eine grosse Empfehlung, zwei Alternativen, X, in der Daumenzone; sie rendert `MenuAction[]` aus `floor-actions.ts` und ruft `handleFloorInteract`, das frueherere Radialmenue ist mit `radial-menu.ts` und `character-view.ts` geloescht.
- `src/render/fx/floor-fx.ts` liegt am Kamera-Container und rechnet in Weltkoordinaten: Geld platzt am Automaten, nicht in der Bildmitte. Der Emitter haelt einen Pool von 200 Sprites, `update` zerstört nichts, und der Screen-Shake verschiebt `camera.position` um einen Offset statt ein Vollbild-div zu transformieren.
- Bildsprache: `docs/ART-DIRECTION.md` beschreibt die Rollen, Lichtstufen und Strichbreiten als Haltung; das Blatt liegt als `docs/banners/art-direction-neon-ledger.png` daneben. Die Zahlen, die dort stehen, sind die aus `src/render/art-tokens.ts` und `src/styles/tokens.css`; aendert sich eine Rolle, aendert sie sich an beiden Stellen und in diesem Kapitel.
- Licht ist Darstellung, kein Zustand: `drawLightSpill` in `src/render/floor-surface.ts` backt 16 Stufen in den Regions-Chunk und kostet im Standbild nichts. Die Halbachsen bleiben im Raum, damit kein Schein ueber die Wand laeuft.

## Ereignisprotokoll, Diagnose und Status

- `src/core/sim/journal.ts` ist headless. Es kennt keine UI und keinen Pixi-Scene-Graph.
- `JournalEvent` hat `id`, `tick`, `day`, `kind`, `subject`, `cause`, `effect`, optional `amount` und `refs`. Der Puffer bleibt bei 240 Einträgen; die vollständige Geldwahrheit bleibt der Ledger.
- `settleMoneyJournal` läuft nach jeder Store-Aktion und jedem Tick. Es liest nur neue Ledger-Zeilen über `entriesSince`, deshalb kostet das Protokoll nicht die gesamte Historie.
- `Ledger.diagnose()` replayt alle Buchungen nur auf ausdrückliche Anforderung (Diagnose-Popup) und liefert Buchungszahl, letzte Seq/Tick, Umlauf, Verbindlichkeiten, Checkpoint und den ersten Bruch mit Grund. Der Tickpfad nutzt weiterhin `verifyIncremental()`.
- Personalstatus ist explizit: `task` beschreibt den Auftrag, `blockedReason` den Grund (keine Bar, Lager voll, Bar leer). Die UI leitet keinen Status aus Pfaden ab.
- Bar-Bestand, Ersatzteile und Kisten sind im Bau-Panel und in der Diagnose sichtbar; Reparaturen nennen „keine Ersatzteile“ oder „Hauskonto zu niedrig“ als Ursache.
- Rivalen haben genau eine Datenquelle: `src/core/sim/rivals.ts`. Das Fremdes-Haus-Popup liest `rivalStates(tick)` und spielt über `playRival`/`visitRivalWithJournal`; hartkodierte Häuser gibt es nicht mehr.

## Pixel-Rig, Animation und Charaktereditor

- `src/render/guest-art.ts` zeichnet blockige Figuren auf einem festen Pixel-Raster. Arme, Beine, Kopf und Körper sind getrennte Container mit Gelenk-Pivots.
- `src/render/rig-pose.ts` ist reine Mathematik: `poseFor(state, nowMs, phase)` liefert Bob, Lean, Kopfneigung, Arm- und Beinwinkel. `actorStateFor` bildet Weltzustände (`PLAY`, `DRINK`, `WAIT`, `ANGRY`, `LEAVE`, Tragen) auf `idle`, `walk`, `sit`, `play`, `win`, `lose`, `drink`, `angry`, `carry` ab. Beides ist ohne Pixi getestet (`rig.test.ts`).
- Der Animationszustand kommt aus dem Snapshot; der Renderer hält keinen Spielzustand. `floor-view` ruft nur `setState` und `animate` auf.
- Der Charaktereditor schreibt `world.look` über `saveLook`/`applyLook`. Nur die angebotenen Paletten und Accessoires sind gültig; der Look hat keine Gameplay-Wirkung.
- Der Editor nutzt eine HTML/CSS-Vorschau derselben Palette, damit die Vorschau ohne zweiten Pixi-Kontext auskommt.

## UI-Tests, Fokus und Zugänglichkeit

- UI-Tests laufen in jsdom mit `@testing-library/react` (`*.test.tsx`). Getestet werden HUD-Alarm, Fokusfalle/Fokus-Rückgabe, Escape, Protokollfilter, Look-Auswahl, Rivalenprofile und Personalstatus.
- `PopupShell` setzt den Fokus auf das erste Bedienelement, hält `Tab` im Dialog und gibt den Fokus beim Schließen an das vorherige Element zurück.
- Der Floor bleibt per Tastatur bedienbar: Pfeile/WASD laufen ein Feld, `Enter` stellt eine getragene Kiste am Spieler ab oder lädt Getränke/Teile ab. Die Maus-/Touch-Bedienung bleibt unverändert.
- `aria-live` meldet Ereignisse, `role="alert"` meldet einen Ledger-Bruch, `:focus-visible` ist global sichtbar, `prefers-reduced-motion` reduziert Animationen. Unter 860 px wird das HUD zweizeilig und scrollbar, Popups werden unter 620 px zu Vollbild-Sheets, Pinch-Zoom läuft über `FloorTouch`.

## Prüfungen und Grenzen

- `soak.test.ts` läuft standardmäßig 3.000 Ticks und prüft alle 250 Ticks Ledger, Puffer, Gästezahl und Strafen. Der Seed ist frisch und nicht wählbar; `pnpm run soak` setzt nur die Tickzahl auf 100.000 für den langen Lauf.
- `save-roundtrip.test.ts` vergleicht zwei geladene Stände nach 120 weiteren Ticks inklusive Snapshot; der Save enthält Journal und Look.
- `memory.bench.ts` misst Heap-Delta und Save-Bytes; `rig.bench.ts` misst Posen und Zustandsabbildung. Beide sind Benchmarks, keine Korrektheitsgates.
- `bench:lowend` pinnt den Benchmark auf einen Kern. Das ist eine Emulation, kein Nachweis auf echter schwacher Hardware; die manuelle Gerätematrix bleibt offen.
