# Architektur und Governance

<!-- rbd-doc: v0.3.152 | 2026-11-07 03:42 UTC -->

## README als Einstieg

`README.md` ist die erzählerische Bühne und der Entwickler-Einstieg, nicht die Regelquelle. Spielmechaniken werden dort als gegenwärtiger Projektstand beschrieben; für verbindliche Details gelten Core-Code, Tests und die passenden Architekturverträge. Screenshots liegen unter `docs/screenshots/` und zeigen jeweils den belegten Stand. Roadmap-Punkte werden als Vorhaben formuliert, nicht als festgelegtes Enddesign.

## Produktgrenze: ort-agnostischer Kern

`docs/ROADMAP.md` beschreibt das Produkt als Lebenssimulation. Das Casino ist darin der Startpunkt und die Testumgebung, nicht das Genre. Fuer den Code heisst das:

- `src/core/` kennt keine Casino-Sonderwahrheit. Welt, Ledger, Facts, Erinnerungen, gerichtete Beziehungen, Trigger und Event-Instanzen sind ortsunabhaengig; sie beschreiben Figuren, Geld und Folgen, nicht einen Saal.
- Was heute casino-spezifisch ist (Spiele, Geraete, Kasse, Floor, Personal), bleibt ein Vertical Slice auf diesem Kern. Es ist Systembeweis und Detailvorgabe, kein Endziel.
- Ein neuer Ort (Kneipe, Laden, Wohnung) liefert Inhalte, Figuren und eine duenne Anbindung an `world-store` und `GameView`. Er bringt keine zweite Engine und keinen zweiten Zustand mit.
- Neue Ressourcen kommen als Ledger-Buchungen dazu: eine Ressource, eine Zeile, eine Ursache. Neue soziale Fakten laufen ueber das geplante Social-Plugin der Narrative Engine, nicht ueber eine zweite Log-Wahrheit.

## CI-Eskalation

- `src/core/governance/error-codes.ts` ist das einzige Fehlerregister; `docs/ARCHITECTURE.md` ist die Doku dazu. Jeder Code traegt `level`: `AUTO_FIX`, `LOCAL_GATE`, `REMOTE_CI`, `AGENT` oder `BLOCKED`.
- `scripts/lib/escalation.mjs` nimmt die Stufe aus dem Code; ohne bekannten Code greifen Textmuster.
- `scripts/pr-watcher.mjs` (CI) legt je Befund ein Issue an oder zaehlt bei bekanntem Fingerprint (Code + erste Fehlerzeile) nach. Lokal laeuft nichts davon.
- Direktpush auf `main` ist durch das Ruleset gesperrt: Weg ist Arbeitsbranch, PR, Promotion. `turn-push.mjs` meldet das als ERR-4023.
- Lokal laufen `verify` (Quick) und `test:affected`; `verify:all` und `ci:long` laufen in CI.

## Zustandsbesitz

Der Editor schreibt nur über `layout-commands.ts` und `layout-editing.ts`: Commands erzeugen ein neues, geprüftes Layout, `LayoutHistory` hält höchstens 30 Schritte, `world-store` bleibt der einzige Aufrufer von `applyLayout()`. Die Oberfläche `src/ui/layout-editor.tsx` hält ausschließlich UI-Zustand und wird über einen statisch gegateten dynamischen Import (`import.meta.env.DEV` plus `VITE_RBD_EDITOR_MODE=1`) geladen; `?editor=1` öffnet sie zusätzlich. `src/render/editor-overlay.ts` ist reine Pixi-Darstellung der Auswahl, `FloorView` liest nur den Cursor. Export/Import laufen über `layout-json.ts`; der Store weist ein Layout ab, dessen Rastergröße nicht zur aktiven Vorlage passt.

- `src/store/world-store.ts` ist der einzige Besitzer von Welt, Ledger, PRNG und Save.
- `src/core/` bleibt headless: Simulation, Geld und Spiele kennen weder DOM noch Pixi.
- `src/render/` liest ausschließlich `GameView`-Snapshots; dort liegt kein Spielzustand. `GameView.company` ist die einzige Firmenstufen-Sicht der UI und wird in `buildView()` aus `companyStatus()` abgeleitet; `FloorStage` faengt einen fehlgeschlagenen Pixi-Start ab und laesst die Panels bedienbar.
- `src/ui/` liest denselben Snapshot und sendet nur Commands an den Store.
- Geld existiert nur als Ledger-Buchung; VaCoins sind ganzzahlige Mikro-Einheiten.
- Fiat eines Gastes liegt ab dem Spawn auf `FIAT_<id>`, Chips auf `VISITOR_<id>`, offene Gewinne auf `PENDING_<id>`. Ein fehlgeschlagener Transfer lässt Gast und Guthaben stehen.
- Auszahlungen werden nie gekappt: Das Hauskonto zahlt, so weit es reicht; der Rest wird als Verbindlichkeit auf `HAUS_SCHULDEN` gebucht (`openLiability`). Die Summe aller Konten bleibt null. `repayDebt` führt die Verbindlichkeit im Tagesabschluss zurück, aber nur aus dem Überschuss über `HOUSE_FLOAT`; ein zweites Schulden- oder Reservekonto gibt es nicht.
- Persona-Einsatz: `personaStake` ist die einzige Einsatzskalierung für Gastrunden. Sie kombiniert den Tisch-Mindesteinsatz, die Sucht, den `budgetFactor` der Persona und einen Wallet-Anteil; das Ergebnis ist auf das Dreifache des Tisches und den verfügbaren Chipbestand begrenzt. `addictedStake` bleibt die reine Suchtkomponente für bestehende Tests.
- Mod-Wirkungen: `resolveModEffects` ist die gemeinsame Wahrheit für eigenes und fremdes Haus. Es dedupliziert Mod-Ids, liefert FREE_DRINK nur mit `freeDrink`/`freeDrinkCost` und lässt EXTRA_REEL ausschließlich auf SLOT zu. `installMod` erhöht bei EXTRA_REEL die Walzenzahl und löscht das Slot-Gedächtnis; `serveFreeDrink` verbraucht Barbestand. VELVET wirkt über `guestTier` auf die Persona-Stufe neuer Gäste, nicht als zweiter Attraktionswert.
- Slot-Pity: Die Entladung ist ein Ausgleich auf den Einsatz (10.000 bps), kein zusätzlicher Paytable-Gewinn. Der einbehaltene Puffer bleibt Hausgewinn; die Session-Quote wird mit 60.000 Spins gegen das angezeigte 90–96-%-Band geprüft.
- Eigene Spielrunden laufen über `core/sim/own-play.ts` und die Store-Fassade `store/own-play.ts`: Der Einsatz geht von `PORTEMONNAIE` nach `HAUSKONTO`, der Gewinn zurück; `HAUS_SCHULDEN` deckt nur die Differenz. `store/own-play.ts` hält die offene Kartenrunde je Gerät, damit ein wiederholter Settle-Befehl nicht doppelt zahlt. `TableLauncher` bleibt rollenunabhängig; `MachinePlay` liefert nur den eigenen Geldweg, keine zweite Engine.
- Der Umbau läuft über `src/core/sim/remodel.ts`: erst Deckung prüfen, dann alle Gastansprüche buchen, dann Geld buchen und das Haus tauschen.
- Der Save ist v11 (`vcoin.casino.v11`). `replaySave` hebt v5- bis v10-Stände an, behält Fiat, offene Gewinne, Journal, Look, Besuchererinnerungen und Rivalen-Zustaende und setzt den PRNG an der gespeicherten Stelle fort; v5–v10 leiten das Layout deterministisch aus ihrer Vorlage ab, v3 und v4 werden verworfen.
- Raum: `WorldState.layout` ist die einzige räumliche Wahrheit (Dimension, ein Bodenmaterial pro Tile, semantische Zonen, Wandkanten mit stabilen IDs). `size` und `zones` sind abgeleitete Legacy-Sichten für Renderer, UI und Simulation und werden ausschließlich über `applyLayout()` geschrieben. Jede Kante ist über Achse und Ankerpunkt eindeutig, `kind` (WALL/DOOR/OPENING) ist ihr einziger Zustand; der Parser in `layout-validate.ts` weist doppelte Kanten, Wände mit Tür-ID und Türen ohne ID fail-closed ab. Die Eingangstür liegt auf derselben Kante wie `doorPoint()`. `GameView.layout` reicht denselben unveränderlichen Plan an Renderer und Editor weiter; Möbelwerte wie Stock, Zustand, Belegung, Mods und Besitz bleiben in `Furniture` und sind kein Layout.
- Narrative Engine (Stufe 1, `docs/ARCHITECTURE.md`): `WorldState.narrative` besitzt Fact-Queue (`pending`, 48), Kurzzeithistorie (`recent`, 120), `processedId`, `dropped` und Flags. Facts sind eine diskriminierte Union und entstehen nur an echten Uebergaengen (Spawn, Rueckkehr, Auszahlung, Spielstart, Streit, Kassenbedienung, Rivalenabrechnung); das Journal bleibt Spielerhistorie und ist kein Fact-Bus. `Visitor` traegt hoechstens sechs strukturierte Erinnerungen, `Guest` bleibt die temporaere Besuchsinstanz. Die Wirkung ist deterministisch aus dem Save berechnet: Rueckkehrchance, Spielwahl und Aktivitaet folgen `visitorDisposition()` (E1/E2E, Persona, Erinnerung, Kante), Spawn-Laune folgt `memoryEffect()` als Fassade ueber dieselbe Wertung, ohne PRNG und ohne Uhr. Der Start-Pool (drei bekannte Figuren plus `START_POOL`-Fact mit Startkapital) entsteht nur beim neuen Spiel ueber `seedStartPool`. Save v10 persistiert Narrativ- und Rivalen-Zustand; v5–v9 werden auf sichere Defaults normalisiert, kaputte Eintraege verworfen. `ledgerSeq`/`houseBand` und `HOUSE_BALANCE` leiten Hauskonto-Schwellen aus dem Ledger ab; `processNarrativeRuntime()` stoesst den einzigen Fact-Drain `processNarrativeBoundaryDetailed()` an. `relationships` traegt gerichtete, kanonisch sortierte Kanten zwischen persistenten Akteuren; NAR-04 speist sie aus Besuch, Streit, Kassenbedienung und Rivalenabrechnung, begrenzt sie auf 200 und pinnt Visitor-Endpunkte. Seit NAR-05 baut `trigger-context.ts` daraus einen unveraenderlichen Snapshot, `trigger-evaluate.ts` wertet alle deklarativen Operatoren rein aus und `trigger-schema.ts` verwirft unbekannte oder ungueltige Definitionen fail-closed; `triggers.ts` bleibt die Fassade. Seit NAR-06 persistiert `narrative/events` hoechstens 32 Event-Instanzen (8 live) mit Lifecycle, Cooldowns und eigenem Narrativ-RNG; der Scheduler waehlt nach Prioritaet, Fairness und Teilnehmer-Scope, `maintainEvents()` raeumt Fristen und verwaiste Endpunkte im Boundary auf. Seit NAR-07 definieren `narrative/events/template-*` stabile Event-Templates mit Content-Slots und deklarativen Choices; `choices/contract.ts` bindet Choice-IDs an Template-Version und den persistierten Satz, `choices/eligibility.ts` prueft Lifecycle, Requirements und Kosten bei jedem Klick rein und fail-closed. Seit NAR-08 parst `narrative/commands/parse-directives.ts` begrenzte `€...`-Direktiven zu einem typisierten AST, `registry.ts` allowlistet die Handler, `validate.ts` und `preflight.ts` pruefen IDs, Parameter, Ziele, Kosten und Lifecycle vor jeder Wirkung; `execute.ts` wendet Choice-Effekte und Ledger-Kosten genau einmal an und setzt das Event auf `RESOLVED`. `TRIGGER_DIALOG` bleibt bis zur Dialogfuehrung nicht ausfuehrbar, `COMMAND_REJECTED` ist ein begrenzter Diagnose-Fact. Kein Text wird evaluiert. Seit NAR-09 tragen alle Content-Beitraege eine kontrollierte Klassifizierung aus Slot, Funktion, Kontexten, Ton, Stimmung, Beziehung und Personas; `content/narrative/turns/manifest.json` bindet jeden abgeschlossenen Turn an genau einen Beitrag, und `content/narrative/registry/fragments.json` ist die deterministisch abgeleitete, sortierte Text-Registry. Seit NAR-10 parst `scripts/lib/narrative-macros.mjs` Makros zu typisierten ASTs, `scripts/lib/narrative-compiler.mjs` erkennt Konflikte und hasht die kanonische Fragmentliste, und `scripts/compile-narrative-content.mjs` schreibt nur mit `--write`; `--check` vergleicht exakte Bytes. `scripts/lib/narrative-content.mjs` validiert Schema, IDs, Manifest, Makros und Registry im bestehenden Assets-Gate (`ERR-4022`); die Registry ist Daten, keine Mechanik. Seit NAR-11 erzeugt der Compiler zusaetzlich `src/core/sim/narrative/composer/registry.generated.ts` als typisierten Core-Spiegel; der Composer validiert die Fragmente zur Laufzeit, waehlt sie deterministisch nach Locale, Kontext, Flags und Personas, liefert lokale Fallbacks und reicht Direktiven nur als AST weiter. Kein RNG, kein Netzwerk, keine Textausfuehrung.
- Rivalen-Domaene (NAR-15): `WorldState.rivals` haelt je Rivale Haltung, Handlungsfaehigkeit, Wohlwollen, naechsten Zug, Gegenmassnahmen-Fenster, Historie (6) und Indizien (4); Ruf, Sicherheit und Attraktivitaet bleiben aus `rivalState` abgeleitet. `rival-ai/policy.ts` entscheidet rein und ohne PRNG, `actions.ts` setzt genau ein Geraet deterministisch herab (12 Zustand), schreibt Indiz, Journal-Zeile und `RIVAL_ACTION`-Fact; der Trigger `rival-action` uebersetzt nur TRADE_INFO, PRICE_MOVE, POACH_VISITOR und SABOTAGE in `RIVAL_MOVE` (`CONFRONT_RIVAL`/`WATCH_THE_MOVE`), PROBE bleibt ohne Szene; der Boundary setzt die Kante Rivale→Haus. Ein Guard verhindert den Schaden, nicht das Indiz. Alle drei Rivalen-Zustaende liegen in Save v10 und werden beim Laden normalisiert. Seit Phase 5 liefert `narrative/rival-context.ts` daraus Rivalen-Karten fuers Anzeigemodell (Haltung, Kapazitaet, Wohlwollen, Gegenmassnahmen-Fenster, Historie, Indizien), rein und ohne zweiten Zustand; `view.ts` bleibt unter 200 Zeilen.
- B1-Kontext: `narrative/composition-context.ts` leitet den Composer-Kontext rein aus Fact, Template, Teilnehmern, Erinnerungen und gerichteter Kante ab. Der Kontext kommt aus `sourceFactId` oder dem Template-Fallback, Personas aus den aufgeloesten Visitor-Teilnehmern, Beziehung/Stimmung aus Fact, Kante und Erinnerung; `requiredFlags` stammt nur aus den Template-Requirements. `view.ts` reicht das Ergebnis unveraendert an den Composer; keine zweite Kontextquelle, kein neuer Zustand. Seit B2 traegt jeder `ContentSlot` optionale `requiredContexts` (Slot-Zweck, z. B. `CHOICE_WELCOME` = `return`+`welcome`); der Composer verlangt sie zusaetzlich zu `ComposeRequest.requiredContexts` fail-closed, `contexts` bewertet nur Treffer, und bei Gleichstand entscheidet ein FNV-1a-Hash aus `eventInstanceId` und Slot-ID statt eines RNG. Seit B3 ist `degraded` an `fallbacks.length > 0` gebunden, `issues` nennt die Slot-IDs, und `NarrativeEventView.fallbackSlots` traegt die Liste bis in die UI, die jeden betroffenen Slot beim Namen nennt.
- Zufall ist seedbar und läuft ausschließlich über `src/core/rng/`: `weighted.ts` zieht Zahlen aus einer Gewichtsverteilung, die ihre eigenen Chancen mitliefert (Bias ≤ 9.000 bps, Deadzones, nie 100 %); `shoe.ts` zieht Karten ohne Zurücklegen und mischt erst den leeren Schuh neu. Es gibt kein `Math.random()` im Spielpfad. Gameplay und Darstellung sind getrennte Stroeme: `presentation` versorgt Partikel und Sound (`src/render/rng.ts`), `gameplay` bewegt Welt und Spiele; `assertGameplayRng` weist fremde Stroeme an `tickWorld` und `playRound` ab. Der Darstellungsstrom liegt nie im Save. Echter Zufall existiert nur an einer Stelle: `entropySeed()` in `src/core/rng/streams.ts` zieht Krypto-Bits fuer einen neuen Lauf; danach ist alles geseedet. Wanduhr ist kein Spielzustand: ESLint verbietet `Math.random`, `Date.now`, `performance.now`, `new Date()` und Krypto-Zufall (`getRandomValues`, `randomUUID`) in `src/**` und `scripts/**`, einschliesslich `globalThis`/`window`-Umwegen, `new`-Umwegen und Aliasen; `eslint-disable` ist per `noInlineConfig` wirkungslos; `Date()` ohne `new` und `performance.timeOrigin` sind ebenfalls gesperrt. Ausnahmen stehen namentlich und begruendet in `src/Config/eslint.config.mjs`: `performance.now` nur in `src/render/floor-view.ts`, `src/render/floor-props.ts` und `src/render/music.ts` (Pacing), Krypto nur in `src/core/rng/streams.ts`, Zeitstempel- und CI-Tooling; jede andere Datei unter `src/render/**` bleibt voll gesperrt. Der Wanduhr-Wert kann den Spielzustand nicht erreichen: `src/core` importiert nie aus `src/render`, `src/render` importiert aus `src/store` ausschliesslich `import type { GameView }` (readonly, kein Laufzeitbezug) und ruft keinen Store-Command, `tick`/`day` werden nur in `src/core/sim/tick.ts` fortgeschrieben, und kein Command nimmt einen Zeitparameter ausser `buyBarCmd`, dessen einziger Aufrufer `world-store` selbst `world.tick` uebergibt. Der Export stempelt `Tag X, Tick Y` aus der Welt, damit derselbe Stand dieselben Bytes ergibt.
- Laufende Neon-Nacht und Turnierabend sind aktive GLOBAL-Instanzen in `world.narrative.events`; `narrative/demand-events.ts` startet und beendet sie ueber die gemeinsame Engine, `demand.ts` liest nur noch daraus. Alte v5–v9-Saves werden beim Laden in eine aktive Instanz mit Restlaufzeit konvertiert; abgelaufene verfallen.
- NAR-00 bis NAR-17 sind umgesetzt; Ledger-Cursor, referenzsichere Retention, die Beziehungsquellen aus Besuch, Streit, Kasse und Rivalenabrechnung, der Trigger-Vertrag und der Event-Scheduler sind umgesetzt. `narrative/trigger-context.ts`, `trigger-evaluate.ts` und `trigger-schema.ts` liefern Context, reine Auswertung und fail-closed Validierung; `narrative/triggers.ts` ist die Fassade. `narrative/event-lifecycle.ts`, `event-scheduler.ts`, `event-schema.ts` und `narrative-rng.ts` verwalten persistente Instanzen, Cooldowns, Fristen, Stale-Cancel und deterministische Fairness. Seit NAR-12 verbindet `narrative/runtime.ts` Facts, Trigger und Scheduler in einem festen Lauf: `processNarrativeRuntime()` drainiert den Boundary hoechstens einmal, wertet die deklarativen Trigger aus `events/trigger-definitions.ts` aus, uebersetzt Treffer ueber die Template-Registry in Kandidaten und laesst `scheduleCandidates()` hoechstens drei Instanzen anlegen; neue Facts warten auf den naechsten Lauf. `tickWorld()` ruft die Runtime genau einmal am Ende, der Store flusht nach jeder erfolgreichen Command-Ausfuehrung sowie nach Neues Spiel, Import und Rivalenspiel ueber `store/narrative-commands.ts`. Eine aufgeloeste Choice ist selbst ein `EVENT_RESOLVED`-Fact und schliesst den Kreis Command→Fact ohne Rekursion. NAR-08 liefert Command-Parser, Allowlist, Preflight und die einmalige Ausfuehrung von Choice-Effekten; NAR-11 ergaenzt den lokalen Composer, aber noch keinen UI-Anschluss. Der Zielzustand ist in diesem Abschnitt und `docs/ARCHITECTURE.md` festgehalten; NAR-13 hat die Demand-Events in die gemeinsame Engine ueberfuehrt, NAR-14 hat die Narrative UI angeschlossen: `narrative/view.ts` baut Szenen und Profile als reines Anzeigemodell (`GameView.narrative`), `src/ui/narrative-*` rendert sie, `dismissNarrativeCmd()` lehnt eine Szene ueber den Lifecycle ab. NAR-15 ergaenzt den persistenten Rivalen-Zustand mit reiner Politik, `RIVAL_ACTION`-Facts und Sabotage mit Indizien; NAR-16 deckt Langzeit, Save-Budget und Hotpath mit Tests, Benchmarks und `ci:long` ab; NAR-17 synchronisiert Doku und Testkatalog mit dem Code. Im Spiel gibt es keine LLM- oder Provider-Anbindung; nur lokal validierter Content darf Darstellung liefern. Der Profil- und Historien-Anschluss bleibt reine Ableitung: `buildNarrativeView()` nimmt Gaeste auf dem Floor ueber `Guest.visitorId` in die Profile auf und liefert die juengsten zwoelf abgeschlossenen Szenen als `history` (Status, Ausgang, Teilnehmer, Abschlusstakt). `GuestPopup` oeffnet ueber `onProfile(visitorId)` direkt das Profil, `NarrativePopup` startet mit `initialVisitorId` im Figuren-Tab; ein unbekanntes Profil zeigt keine fremde Figur.
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
2. Neue Fehlerarten werden zuerst in `docs/ARCHITECTURE.md` und `src/core/governance/error-codes.ts` registriert.
3. `ERR-0000` ist ein unbekannter Fehler und blockiert den Build sofort (Fail-Closed).
4. `ERR-0911` kennzeichnet automatisch reparierbare Verstöße. Repariert wird ausschließlich im Fix-Modus (`pnpm run fix`); jeder Verify-Lauf liest nur und macht einen veralteten Baum rot.
5. Jede Testdatei deklariert `@test-target` und `@error-code`; der Reporter `src/core/governance/test-harness.ts` gibt jeden Testfall indiziert aus.
6. Tests laufen im Thread-Pool (`pool: 'threads'`) mit harter Teardown-Grenze. Worker sind Threads im Runner-Prozess und sterben mit ihm, es bleiben also keine verwaisten Testprozesse zurueck; `testTimeout` und `teardownTimeout` beenden haengende Tests. Die sechs RTP-Monte-Carlo-Laeufe sind parallelisiert, ziehen pro Lauf frische Seeds und sind an die Tail-Verteilung angepasst: SLOT 200.000, SHELL 300.000, PLINKO 5.000 Runden. Tischpoker wird nicht ueber RTP bewertet, sondern ueber die 7-Karten-Handverteilung und den Kartenschuh (`poker-distribution.test.ts`, `poker-table.test.ts`). Feste Seed-Literale lehnt `verify-test-quality` ab; die Seeds sind nicht per Env oder CLI waehlbar. Die Paytables sind auf ~93 % RTP kalibriert, damit das 90–96-%-Band auch mit frischen Seeds nicht zufaellig kippt.

### Fehlerregister

Jede Meldung aus Pipeline, Tests oder Gate-Skripten beginnt mit `[IDX-XXXX] [ERR-YYYY]`.
`ERR-0000` ist der einzige unbekannte Zustand und blockiert den Build sofort.
Neue Fehlerarten brauchen zuerst einen Eintrag hier **und** in `src/core/governance/error-codes.ts`.

| Code | Komponente | Ursache | Loesung |
| --- | --- | --- | --- |
| ERR-0000 | Governance | Unbekannter Fehler ohne Registereintrag. | Neuen Code in beiden Registern nachtragen; Lauf wiederholen. |
| ERR-0911 | Governance | Automatisch reparierbarer Verstoss (Format, Matrix, Trailer). | `pnpm run autofix:0911` ausfuehren; der Runner protokolliert den Eingriff. |
| ERR-1001 | Governance / Determinismus | Zufalls- oder Zeitquelle ausserhalb des erlaubten RNG in core/ oder store/. | Quelle entfernen; Zufall nur ueber den geseedeten Prng, Zeit nur aus world.tick. |
| ERR-1002 | Core / Geld | Ledger- oder VaCoin-Invariante verletzt. | Buchungspfad und Mikro-Geldarithmetik pruefen. |
| ERR-1003 | Core / Spiele | RNG-, RTP- oder Determinismusbeweis fehlgeschlagen. | Seed, Paytable und Einsatzpfad des Spiels pruefen. |
| ERR-1005 | Build | Typecheck oder Production-Build bricht ab. | Ersten Compilerfehler an der Ursache beheben. |
| ERR-2001 | Simulation | Welt-, Gast- oder Servicezustand verletzt eine Zusicherung. | Kausalitaet im betroffenen Zustandsautomaten korrigieren. |
| ERR-2002 | Simulation / Grid | Bereichs-, Footprint- oder Zugangsregel verletzt. | `grid-zones` und Multi-Tile-Flaeche pruefen. |
| ERR-3001 | Render / UI | Hartcodierter Dummy-Wert oder toter Platzhalter sichtbar. | An echtes Snapshot-Feld binden oder entfernen. |
| ERR-4001 | Testvertrag | `@test-target` oder `@error-code` fehlt/ist ungueltig. | Header mit existierendem Ziel und registriertem Code ergaenzen. |
| ERR-4002 | Testqualitaet | Reiner Existenz-, Snapshot- oder Tautologie-Test. | Zustandstransformation oder numerische Invariante pruefen. |
| ERR-4003 | Toter Code | Export wird nirgendwo importiert. | Export entfernen oder im echten Pfad verwenden. |
| ERR-4004 | Dependencies | `pnpm audit` meldet mindestens eine Schwachstelle. | Paket aktualisieren; keine Ausnahmen. |
| ERR-4005 | Commit | Drittanbieter-Trailer oder Tool-Werbung im Commit/PR-Body. | Trailer entfernen; `sanitize-commit` nutzen. |
| ERR-4006 | Commit | Deutsche Developer Notes oder Pflichtsektionen fehlen. | Nachricht im Steam-Notes-Format neu schreiben. |
| ERR-4007 | Architektur | Dependency ohne Begruendung oder ohne reale Nutzung. | `docs/ARCHITECTURE.md` und Matrix synchronisieren. |
| ERR-4008 | Delivery | Der automatische Push auf den Arbeitsbranch scheitert, auch nach dem Nachziehen von origin/main. | Remote-Arbeit nachziehen und lokal neu aufsetzen; bleibt der Push bei aktuellem Remote abgelehnt, Rechte und Branch-Schutz pruefen. |
| ERR-4011 | Lint | ESLint-Verstoss, der nicht automatisch behebbar ist. | Regelverstoss an der Ursache beheben. |
| ERR-4012 | LOC-Guard | Datei ueberschreitet ihr LOC-Cap oder nutzt eine verbotene Ausnahme. | Verantwortung splitten und unter die Hot Zone ihrer Zustaendigkeit reduzieren; keine neuen Exceptions. |
| ERR-4013 | Architektur | Dependency-Matrix ist nicht synchron. | `pnpm run sync:deps` ausfuehren und Begruendungen pruefen. |
| ERR-4014 | Pipeline | Ein Gate ueberschreitet sein hartes Zeitlimit und wird samt Prozessbaum beendet. | Ursache im Gate suchen; das Limit nur bewusst und begruendet anheben. |
| ERR-4015 | Testkatalog | Testkatalog ist nicht synchron zu den Testdateien. | `pnpm run catalog` ausfuehren und die Einordnung im Diff pruefen. |
| ERR-4016 | CI-Delegation | Ein langer Nachweis konnte nicht in GitHub Actions laufen oder ist dort rot. | Lauf und Log im Browser pruefen; Ursache im Gate beheben, nicht lokal nachbauen. |
| ERR-4017 | Docs | Pflichtdokument, Marker oder Pflichtabschnitt fehlt. | `pnpm run docs:sync`; Struktur in `scripts/lib/doc-sync.mjs` ergaenzen. |
| ERR-4018 | Governance | Repo-Hooks liessen sich nicht aktivieren. | `git config core.hooksPath .githooks` pruefen. |
| ERR-4019 | Governance / Tree | Datei liegt im falschen Ordner oder eine Schicht importiert nach aussen. | Datei verschieben; Import nach innen ziehen; Regel in `scripts/verify-tree.mjs` pruefen. |
| ERR-4020 | Governance / Redundanz | Datei, Kommando oder Fehlercode ist doppelt vorhanden. | Eine Wahrheit behalten und die Kopie entfernen. |
| ERR-4021 | Docs | Doc-Stub ohne brauchbaren Titel aufgerufen. | `pnpm run docs:stub -- "Titel"` mit mindestens 8 Zeichen. |
| ERR-4022 | Governance / Content | Beitrag, Vokabular, Turn-Manifest, Makro, Registry oder Composer-Fragment verletzt den NAR-09/NAR-10/NAR-11-Vertrag. | Feld, ID, Klassifizierung, Direktive oder Fragment korrigieren; Registry mit `pnpm run narrative:compile` neu erzeugen. |
| ERR-4023 | Delivery | Direkter Push auf main wird vom Branch-Schutz abgelehnt; der Arbeitsbranch ist gepusht. | Fokussierten PR gegen main oeffnen und ueber das Gate promoten; kein Direktpush auf main. |
| ERR-4024 | Delivery / Lokal | Das lokale Gate (`verify:quick` oder `verify:all`) in `turn:finish` ist rot; kein Commit und kein Push. | Den ersten Befund im Gate-Log beheben und `turn:finish` erneut ausfuehren. |
| ERR-5001 | Core / Import | Importierter Spielstand ist beschaedigt oder fremd. | Export pruefen; reparierbare Felder werden automatisch ergaenzt. |

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

Jede Testdatei gehört genau einem System (`games`, `sim`, `economy`, `rng`, `physics`, `governance`, `render`, `ui`, `store`, `test-tools`, `pipeline`, `ci`) und genau einer Beweisklasse: `contract`, `integration`, `governance`, `statistics`, `performance`. Das System stammt aus dem deklarierten `@test-target`, die Beweisklasse aus der Rolle der Datei in `scripts/lib/test-catalog.mjs`. `docs/INVENTORY.md` ist die abgeleitete Tabelle; `pnpm run catalog` schreibt sie, der Verify-Lauf prüft sie im `--check`-Modus (`ERR-4015`).

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

`pnpm run fix` repariert ESLint-Verstöße und die Dependency-Matrix und prüft danach dieselben Gates. Er nennt jede geänderte und jede gelöschte Datei; ein zweiter Lauf meldet „keine Änderung, Arbeitsbaum unverändert“. Der CI-Gates-Anhang unten beschreibt das Main-Gate aus zwei Ebenen.

### Gemessene Wandzeit (31.10.2026, 6 Kerne, Cache geleert)

- `verify:all` vor dem Umbau: **48,1 s** — Autofix 14,2 s sequenziell, danach kritische Pfad `tests` 33,6 s. Typecheck (23,6 s), Build (27,5 s) und Audit (5,0 s) liegen darunter und kosten keine Wandzeit, nur CPU.
- Die Suite misst 72,5 s CPU über 56 Dateien, davon 52,2 s in vier Nachweisdateien (`round-rtp-high` 30,6 s, `soak` 12,4 s, `round-rtp-machines` 7,6 s, `slot-session-rtp` 1,6 s); die übrigen 52 Dateien brauchen zusammen 20,3 s.
- ESLint-Cache (`--cache --cache-strategy content`, Konfigurations- und Lockfile-Hash als Sperrvorhang): 14,2 s → 2,6 s warm, unfixbare Reste bleiben auch mit warmem Cache rot.
- Typecheck inkrementell (`tsconfig.tsbuildinfo`, ignoriert): 11,3 s → 6,0 s.
- Ergebnis: `verify:quick` **17,4 s** kalt und **1,2 s** bei unverändertem Baum, `verify:all` danach unter 30 s, solange der Baum unverändert ist.
- Der Gate-Cache liegt in `.verify-cache/` ausserhalb von `node_modules`, damit `pnpm install --frozen-lockfile` ihn nicht zerstört; die Workflows holen ihn über `actions/cache` wieder.
- Nicht umgesetzt: weniger Gate-Worker. Bei 6 Kernen laufen etwa 4,3 Kerne parallel; Typecheck verlangsamt sich unter Last von 11,3 s auf 23,6 s, bleibt aber unter der Test-Gate und damit unter der kritischen Pfad. Runterdrehen würde Wandzeit kosten, deshalb bleibt `RBD_VERIFY_WORKERS` der einzige Hebel.

## Dependency-Begründungen

Jede Laufzeit- und Entwicklungabhängigkeit braucht eine nicht-leere Begründung und mindestens eine reale Nutzung. Die folgende Matrix wird von `scripts/sync-dependency-matrix.mjs` aus `package.json` und den echten Imports erzeugt; sie belegt Nutzung, nicht Notwendigkeit. Die offenen Punkte aus der Sicherheits- und Konsolidierungsbewertung stehen in `docs/ROADMAP.md` unter „Technik, Doku und Release“; die Matrix wird weiterhin aus `package.json` und den echten Importen erzeugt.

<!-- DEP_MATRIX_START -->
| Paket | Version | Kategorie | Architektur-Begründung | Real genutzte Dateien (Anzahl & Pfade) |
| --- | --- | --- | --- | --- |
| @capacitor/android | ^8.6.0 | Android | Native Android-Plattform, aus der Gradle Debug- und Release-APK baut. | 1: `scripts/prepare-android.mjs` |
| @capacitor/cli | ^8.6.0 | Android | Capacitor-CLI: erzeugt das Android-Projekt und synchronisiert Web-Build und Huelle. | 1: `scripts/prepare-android.mjs` |
| @capacitor/core | ^8.6.0 | Android | WebView-Bridge der Android-Huelle; von cap sync an die native Seite uebergeben. | 1: `scripts/prepare-android.mjs` |
| @eslint/js | ^10.0.1 | Lint | Empfohlene ESLint-Basisregeln. | 1: `src/Config/eslint.config.mjs` |
| @testing-library/react | ^16.3.3 | Test | Rendert HUD und Popups fuer Integrations- und Fokustests in jsdom. | 7: `src/ui/__tests__/card-tables.test.tsx`<br>`src/ui/__tests__/dialogue-ui.test.tsx`<br>`src/ui/__tests__/guest-profile.test.tsx`<br>`src/ui/__tests__/machine-play.test.tsx`<br>`src/ui/__tests__/narrative-ui.test.tsx`<br>`src/ui/__tests__/perspective-switch.test.tsx`<br>… (+1) |
| @types/node | ^22.20.5 | Typen | Typen fuer Node-Builtins in Gate-Skripten und Vitest-Reporter. | 65: `scripts/agent-verify.mjs`<br>`scripts/autofix-0911.mjs`<br>`scripts/balance-run.mjs`<br>`scripts/bench-lowend.mjs`<br>`scripts/branch-cleanup.mjs`<br>`scripts/build-asset-manifest.mjs`<br>… (+59) |
| @types/react | ^19.0.7 | Typen | Typpaket fuer die React-19-API; wird implizit von React-Imports genutzt. | 48: `src/App.tsx`<br>`src/main.tsx`<br>`src/render/floor-stage.tsx`<br>`src/render/games/blackjack-stage.tsx`<br>`src/render/games/dice-stage.tsx`<br>`src/render/games/plinko-stage.tsx`<br>… (+42) |
| @types/react-dom | ^19.0.3 | Typen | Typpaket fuer React-DOM; wird implizit von react-dom-Imports genutzt. | 2: `src/main.tsx`<br>`src/ui/__tests__/casino-window-header.test.tsx` |
| @vitejs/plugin-react | ^6.1.2 | Build | React-19-JSX-Transform und Fast Refresh fuer Vite. | 1: `src/Config/vite.config.ts` |
| eslint | ^10.14.0 | Lint | Fail-Closed-Lint-Gate mit TypeScript-Parser und ungenutzten Symbolen. | 2: `package.json`<br>`src/Config/eslint.config.mjs` |
| ffmpeg-static | ^5.3.0 | Assets | Kodiert die WAV-Musikmaster zu Opus fuer die Auslieferung; reines Build-Werkzeug, nicht im Bundle. | 2: `scripts/encode-audio.mjs`<br>`scripts/lib/atlas-webp.mjs` |
| globals | ^16.5.0 | Lint | Browser- und Node-Globals fuer die ESLint-Konfiguration. | 1: `src/Config/eslint.config.mjs` |
| jsdom | ^30.1.3 | Test | DOM-Umgebung fuer UI-, Fokus- und Tastaturtests ohne echten Browser. | 10: `package.json`<br>`scripts/sync-dependency-matrix.mjs`<br>`src/render/games/slot-stage.tsx`<br>`src/ui/__tests__/card-tables.test.tsx`<br>`src/ui/__tests__/dialogue-ui.test.tsx`<br>`src/ui/__tests__/guest-profile.test.tsx`<br>… (+4) |
| pixi.js | ^8.6.6 | Runtime | WebGL/Canvas-Renderer fuer Floor, Figuren, Sticker und Spiele; kein DOM-Rendering im Spielfeld. | 61: `src/render/__tests__/depth.test.ts`<br>`src/render/assets/atlas.ts`<br>`src/render/assets/textures.ts`<br>`src/render/comic-bubbles.ts`<br>`src/render/depth-perf.bench.ts`<br>`src/render/depth.ts`<br>… (+55) |
| react | ^19.0.0 | UI | Deklarative HUD-, Popup- und Panel-Oberflaeche mit einem Store-Snapshot. | 48: `src/App.tsx`<br>`src/main.tsx`<br>`src/render/floor-stage.tsx`<br>`src/render/games/blackjack-stage.tsx`<br>`src/render/games/dice-stage.tsx`<br>`src/render/games/plinko-stage.tsx`<br>… (+42) |
| react-dom | ^19.0.0 | UI | Mountet die React-Oberflaeche in den Browser. | 2: `src/main.tsx`<br>`src/ui/__tests__/casino-window-header.test.tsx` |
| typescript | ^6.0.3 | Build | Strikte Typpruefung mit noUncheckedIndexedAccess und ungenutzten Symbolen. | 2: `scripts/lib/ts-ast.mjs`<br>`src/Config/tsconfig.json` |
| typescript-eslint | ^8.72.1 | Lint | TypeScript-Parser und Regeln fuer das Lint-Gate. | 1: `src/Config/eslint.config.mjs` |
| vite | ^8.3.5 | Build | Dev-Server und Production-Bundler; liefert die Modul- und CSS-Pipeline. | 1: `package.json` |
| vitest | ^5.0.5 | Test | Deterministische Unit- und Monte-Carlo-Beweise fuer Ledger, Spiele und Simulation. | 186: `package.json`<br>`src/Config/vite.config.ts`<br>`src/core/contracts/__tests__/actionset.test.ts`<br>`src/core/contracts/__tests__/actor-id.test.ts`<br>`src/core/contracts/__tests__/factor.test.ts`<br>`src/core/contracts/__tests__/relationship.test.ts`<br>… (+180) |
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

Seit 0.3.120 hat der Boden einen Produktionsatlas: `build-asset-manifest.mjs` packt die vier Ordner `characters`, `decor`, `environment` und `machines` mit demselben Shelf-Plan wie `atlas.ts` in zwei deterministische 1024er-Seiten. Der Laufzeitpfad registriert nur noch Seitenausschnitte; fehlt eine Seite, packt `atlas.ts` die Einzeldateien selbst. Damit bleiben die 153 Frames aus dem kritischen Pfad. Im 4G-Profil (9 Mbit/s, 70 ms RTT, kalter Cache) waren es 20 Requests und 2,51 s bis zum ersten Frame. Seit 0.3.137 liegen die zwei HUD-PNGs `ui/coin.png` und `ui/guest-cyan.png` als Data-URI in `src/ui/hud-icons.ts`; im kalten Slow-4G-Lauf (1,6 Mbit/s, 750 kbit/s Upload, 150 ms RTT, 1024x768) faellt die Zahl von 24 auf 22 Requests. Der erste Frame bleibt mit 12,16 s bandwidth-bound (2,42 MB Transfer), weil die beiden Icons nur rund 3,8 KB ausmachen. Die 20er-Zahl und der 24er-Lauf sind unterschiedliche Profile und Instrumentierungen, kein direkter Regressionsvergleich. Der Loader haengt an `onFirstFrame` nach `renderer.render(stage)`, nicht an einem Timer.

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
- Bildsprache: `docs/ARCHITECTURE.md` beschreibt die Rollen, Lichtstufen und Strichbreiten als Haltung; das Blatt liegt als `docs/banners/art-direction-neon-ledger.png` daneben. Die Zahlen, die dort stehen, sind die aus `src/render/art-tokens.ts` und `src/styles/tokens.css`; aendert sich eine Rolle, aendert sie sich an beiden Stellen und in diesem Kapitel.
- Licht ist Darstellung, kein Zustand: `drawLightSpill` in `src/render/floor-surface.ts` backt 16 Stufen in den Regions-Chunk und kostet im Standbild nichts. Die Halbachsen bleiben im Raum, damit kein Schein ueber die Wand laeuft.

## Ereignisprotokoll, Diagnose und Status

- `src/core/sim/journal.ts` ist headless. Es kennt keine UI und keinen Pixi-Scene-Graph.
- `JournalEvent` hat `id`, `tick`, `day`, `kind`, `subject`, `cause`, `effect`, optional `amount` und `refs`. Der Puffer bleibt bei 240 Einträgen; die vollständige Geldwahrheit bleibt der Ledger.
- `settleMoneyJournal` läuft nach jeder Store-Aktion und jedem Tick. Es liest nur neue Ledger-Zeilen über `entriesSince`, deshalb kostet das Protokoll nicht die gesamte Historie.
- `Ledger.diagnose()` replayt alle Buchungen nur auf ausdrückliche Anforderung (Diagnose-Popup) und liefert Buchungszahl, letzte Seq/Tick, Umlauf, Verbindlichkeiten, Checkpoint und den ersten Bruch mit Grund. Der Tickpfad nutzt weiterhin `verifyIncremental()`.
- Personalstatus ist explizit: `task` beschreibt den Auftrag, `blockedReason` den Grund (keine Bar, Lager voll, Bar leer). Die UI leitet keinen Status aus Pfaden ab.
- Bar-Bestand, Ersatzteile und Kisten sind im Bau-Panel und in der Diagnose sichtbar; Reparaturen nennen „keine Ersatzteile“ oder „Hauskonto zu niedrig“ als Ursache.
- Die Werkstatt ist ein Raster mit sechs Zielen, kein zweiter Zustandsbaum. `src/ui/workshop.tsx` hält nur den aktiven Bereich und den einen `PopupShell`; `src/ui/workshop-parts.tsx` liefert Rasterkarte, Steuerungsliste und die FPS-Messung. `diagnostics-popup`, `journal-popup`, `asset-library-popup` und `sound-popup` exportieren ihre Inhalte als Panels ohne Rahmen; die alten Popup-Hüllen bleiben für andere Aufrufer. Der Einstieg lebt in `dock.tsx` (`useBrandTaps`, fünf Tipps auf die Marke) und in `App.tsx` (`Strg+Shift+D`); es gibt keinen sichtbaren Werkstatt-Knopf. Der Charaktereditor ist ein `SPIEGEL`-`DECOR` in der Lagerzone; `buildFurnitureActions` erzeugt die Aktion, `Popup = { kind: 'look' }` öffnet den vorhandenen `LookPopup`. `WorkshopTool` kennt kein `look` mehr.
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


## Anhang: Bildsprache — Neon Ledger

> Bei der Doku-Konsolidierung aus `docs/ART-DIRECTION.md` uebernommen; die Quelldatei wurde geloescht. Die Aussagen gelten zum Stand dieses Commits.

> Blatt: `docs/banners/art-direction-neon-ledger.png` · Regeln im Code: `src/render/art-tokens.ts`, `src/styles/tokens.css`
>
> Dieses Dokument beschreibt eine Haltung, keine Vorlage. Es sagt, warum etwas leuchtet, und überlässt das
> Wie dem, der es zeichnet.
>
> **Status: vorläufig.** Die heutige Low-End-Pixel-Optik ist ein plattformfreundlicher Machbarkeitsbeweis
> und deutlich von der Vision entfernt. Sie ist nicht die endgültige Bildsprache; die Regeln unten gelten
> für den heutigen Stand und werden mit der Stadt neu verhandelt.

### Das Manifest

Der Saal ist eine Buchführung, die man betreten kann. Licht ist Information, jede Fläche ist eine Zeile, jede
Farbe eine Kontenart. Nichts glüht ohne Grund: Wer den Grund nicht nennen kann, nimmt das Licht zurück. Diese
Haltung macht aus einem dunklen Raum mit Geräten eine Bühne, auf der man Zahlen lesen kann, ohne ein Panel zu
öffnen. Die Arbeit ist erst fertig, wenn jede Marke datierbar und jede Fläche ableitbar ist — ein Zustand, den
man nur durch wiederholtes Prüfen am Boden erreicht, nicht durch Geschmack.

Gezeichnet wird mit Regeln, nicht mit Verzierungen. Ein Pixel, wo gezählt wird; zwei, wo eine Kante antwortet;
drei, wo etwas unterbrochen ist; sechs, wo gebaut wurde. Diese vier Breiten sind das ganze Vokabular der
Konstruktion. Wer eine fünfte braucht, hat die Fläche noch nicht verstanden. Konturen werden dunkler gemalt als
alles, was sie halten, damit Material und Licht führen und nicht der Rahmen. Eine Handschrift erkennt man daran,
dass sie auch dort präzise bleibt, wo niemand hinsieht: in der Fuge unter dem Teppich, an der Schwelle, im
Schatten der Theke.

Licht fällt in Stufen, nie als Fläche. Sechzehn leise Schichten, jede nur ein Prozent, ergeben einen weichen
Rand, den kein Auge als Ring erkennt — eine einzige deckende Fläche wäre ein Fleck. Jede Raumart hat eine
Temperatur: warm an Kasse und Bar, kalt an Eingang und Lager, Neon im Saal. Das Licht bleibt im Raum, es läuft
nicht über die Wand. Wer diese Grenze hält, bekommt Tiefe geschenkt; wer sie bricht, bekommt ein Leuchten, das
nichts bedeutet.

Die sieben Rollen sind Bedeutungen, keine Farben: Casino, Service, Gast, Wert, Gefahr, Erfolg, Warnung. Sie
stehen in derselben Reihenfolge in Pixi und im CSS, und sie ändern sich nie einzeln. Eine Rolle, die an zwei
Stellen unterschiedlich aussieht, ist ein Fehler, kein Stil. Deshalb ist die Palette klein, gesättigt und
unversöhnlich: Auf einem fast schwarzen Grund kann sich nur eine Farbe pro Aussage leisten, laut zu sein.

Steuerung wird gezeichnet, bevor sie wirkt. Das Zielraster zeigt die Kachel, die ein Klick trifft, und wechselt
die Farbe, wenn derselbe Klick etwas anderes tut. Der Ring hält die Figur auffindbar, die Punktspur zeigt den
Weg, ein Ring das Ziel. Alles davon verschwindet, sobald es nichts mehr zu sagen hat. Eine Anzeige, die immer
leuchtet, ist keine Anzeige. Diese Zurückhaltung ist die eigentliche Kunst: sichtbar genau dann, wenn eine
Entscheidung ansteht.

Das Ergebnis soll wie ein Artefakt aus einer Disziplin wirken, die es nicht gibt: eine technische Zeichnung
eines Ortes, an dem Geld und Laune gemessen werden. Dafür wird jedes Detail so oft verschoben, bis es sitzt —
die Kante der Theke, der Abstand der Lampe, die Deckkraft der zweiten Stufe. Ein Blatt in dieser Sprache darf
man aufhängen; ein Floor in dieser Sprache darf man lesen. Beides entsteht nur durch Arbeit, die man dem
Ergebnis ansieht.

### Die harten Regeln

| Regel | Wert | Wo |
| --- | --- | --- |
| Rollen | sieben, eine Bedeutung je Rolle | `art-tokens.ts` / `tokens.css` |
| Lichttemperaturen | warm, kalt, neon | `art-tokens.ts` (`LIGHT`) |
| Lichtpfützen | 16 Stufen, α 0,009 → 0,02, im Raum begrenzt | `floor-surface.ts` |
| Strichbreiten | 1 / 2 / 3 / 6 px | `STROKE`, `room-art.ts` (`WALL`) |
| Zielraster | Service = laufen, Identity = heranziehen | `floor-cues.ts` |
| Bewegung | Easing, kein Nachfedern | `floor-camera.ts`, `floor-view.ts` |
| Herkunft | keine Farbe ohne Rolle, kein Glanz ohne Grund | Review am Boden |

### UI und Spiel als ein Bild

Dieses Kapitel überträgt die Haltung auf die Bedienung. Der Floor ist die Bühne, die Menüs sind das
Lichtpult: gleiche Palette, gleiche Tiefe, gleiche Typo, gleiche Kanten. Kein Fenster darf wie ein
Fremdkörper über dem Spiel liegen.

#### Vier Ebenen, vier Aufgaben

1. **Welt (Canvas):** Floor, Figuren, Licht. Keine UI-Texte außer Weltfeedback (Zielraster, Spur).
2. **HUD (Rahmen):** Identität links, Geld und Ruf rechts, eine Zeile mit Aktionen. Ruhig und dunkel.
3. **Fenster (`PopupShell`):** ein Rahmen für alles, was mehr als eine Entscheidung verlangt —
   Smartphone-Menüs, Bauen, Gäste, Protokoll, Charakter, Assets, Ton.
4. **Dialog:** die einzige Ebene, die die Welt abdunkelt und Fokus erzwingt.

Immersion entsteht nicht durch mehr Effekte, sondern durch **weniger Bruchstellen**: gleicher Kopf,
gleiche Dichte, gleiche Abstände, gleiche Bedeutung der Farben.

#### Menü-Regeln

- **Ein Rahmen:** jedes Fenster nutzt `src/ui/popup-shell.tsx` (Backdrop, Kopf, Eyebrow, Titel,
  Fokusfalle, Escape, Schließen). Kein Fenster baut einen eigenen Kopf.
- **Ein Kopf:** Eyebrow = Bereich (`BAUEN`, `GÄSTE`), Titel = konkrete Sache, ein Schließen rechts.
- **Eine Dichte:** Innenabstand `--space-4`, Listen mit `--space-2`, keine Sonderfälle.
- **Eine Hierarchie:** höchstens drei Ebenen pro Fenster (Titel, Abschnitt, Zeile).
- **Eine Skala:** Abstände nur aus `--space-1..5`, Fensterbreiten nur aus `--popup-width`,
  `--popup-wide-width`, `--popup-full-width`, Radien nur aus `--popup-radius` / `--radius*`.
- **Keine toten Enden:** jedes Fenster hat genau eine primäre Aktion und einen Weg zurück.

Ausnahme: das Fremd-Floor-HUD (`foreign-floor-hud.tsx`) ist Welt, kein Fenster — es zeigt einen
anderen Ort, statt eine Entscheidung zu verlangen.

#### Ton

Musik folgt dem Fenster (Floor, Gäste, Spiel, Nacht, Menü), nicht dem Klick. Erst die Geste, dann der
Ton; Autoplay wird abgewartet, nie erzwungen. Effekte haben Mindestabstände (`win` 500 ms, `coin`
180 ms, `brawl` 900 ms), damit ein voller Floor keine Tonlawine wird. Stille bleibt ein gültiger
Zustand, jeder Kanal ist einzeln regelbar.

#### Stufenplan

| Stufe | Inhalt | Status |
| --- | --- | --- |
| M1 | Abstands- und Fenster-Tokens, Popup-CSS darauf umgestellt | erledigt |
| M2 | Alle Menüs auf `PopupShell`, ein Kopf, eine Dichte | erledigt |
| M3 | Screenshot-Satz `v0.3.114` als Referenz, README-Vergleich gegen `v0.3.27` | erledigt |
| M4 | Smartphone als echte Gerätefläche (Rahmen, Statusleiste), Fensterübergänge und Floor-Feedback angleichen | offen |

Abnahme pro Fenster: gleicher Kopf, gleiche Abstände, eine primäre Aktion, ein Weg zurück.

#### So entsteht ein Screenshot-Satz

- Bauen: `pnpm run build`, danach `pnpm exec vite preview --port 4173 --strictPort`.
- Aufnehmen: Rundgang im Browser gegen `http://localhost:4173` (Floor, Smartphone, Fenster).
- Ablegen: `docs/screenshots/v<version>/` mit sprechenden Namen (`01-floor-uebersicht.png` ...).
- Verdrahten: README-Bild, Vergleichstabelle und Rundgang auf den neuen Satz zeigen lassen.
- Pruefen: `pnpm run verify:all`, keine Konsolen- oder Seitenfehler, Bilder gegen die Beschriftung.

### Zwei Perspektiven, eine Bildsprache (v0.3.132)

Der Umschalter GAST/BETRIEB färbt Akzente, nicht das Bild. Beide Blicke teilen dieselbe
Palette, dieselbe Typo-Hierarchie und dieselbe Etage; nur die Rollenfarbe des HUD-Rahmens,
der Rollenhinweis auf dem Floor (`floor-role-bar`) und die vier Bereiche im Dock wechseln.

- **GAST** trägt den Cyan-Akzent. Das HUD zeigt Portemonnaie und offene Gewinne, der Floor
  sagt „Gerät antippen und direkt spielen“, die Spielbühne trägt `DU · GAST`.
- **BETRIEB** trägt den Magenta-Akzent. Das HUD zeigt Hauskonto, Kasse, Geräte und Ruf, der
  Floor sagt „Gerät antippen für Zustand, Ursache, Reparatur und Mods“.
- Die Perspektive ist ein Zustand der Oberfläche, kein zweiter Spielzustand. Es gibt keine
  zweite Palette, keinen zweiten Router und keine zweite Bühne: `MachinePopup` verzweigt
  zwischen `MachineOperatorBody` und der bestehenden `TableLauncher`-Bühne.
- Neue Belege: `docs/screenshots/v0.3.132/` zeigt beide Floors, die Gastspielbühne, die
  Betriebsdiagnose desselben Geräts, Gästeverwaltung, Betriebspanel, Verlauf und die mobile
  Gastansicht.


## Anhang: Assets: Auswahl, Pipeline und Messwerte

> Bei der Doku-Konsolidierung aus `docs/ASSETS.md` uebernommen; die Quelldatei wurde geloescht. Die Aussagen gelten zum Stand dieses Commits.

Das Paket `casino_asset_sounds_prealpha` ist Ausgangsmaterial, kein Auftrag. Dieses
Dokument sagt, was daraus im Repository liegt, wie es im Spiel ankommt und wie man
beides reproduziert. Die Beschreibung des Quellpakets liegt unter
`docs/ARCHITECTURE.md`.

### Herkunft und Rechte

- Quelle: `casino_asset_sounds_prealpha.zip` mit `casino-pixel-assets/` und `sounds/`.
- Bestand beim letzten Abgleich: **539 PNG**, **7 JSON**, **6 WAV**, rund 170 MB.
- Die beiliegende README beschreibt Stil, Palette und Pixelmaße, nennt aber
  **keine Lizenz und keinen Urheber**. Der Betreiber hat am 01.11.2026 bestätigt,
  dass die Lizenzrechte bei ihm liegen; der schriftliche Nachweis wird im Repo
  ergänzt. Bis dahin gilt: keine Weitergabe außerhalb des Repositories.

### Was im Repository liegt

Alle **539 PNG** und **7 JSON** liegen unter `public/assets/casino/`; die sechs
WAV-Master werden nicht eingecheckt, sondern zu sechs OGG-Spuren encodiert.

| Bereich | Dateien | Größe | Zweck |
| --- | ---: | ---: | --- |
| `symbols/` | 24 | 112 KB | Walzensymbole aus dem Paket, inklusive der 15 Zusatzsymbole |
| `machines/` | 54 | 596 KB | Geräte, Tische, Chips und Karten |
| `decor/` | 28 | 296 KB | Sofas, Palmen, Neon, Säulen, Lampen |
| `plinko/` | 46 | 264 KB | Pegs, Bumper, Deflektoren und Auszahlungsfelder |
| `ui/` | 70 | 337 KB | Icons, Rollen-Badges, Panels und HUD-Skins |
| `characters/` | 69 | 284 KB | modulare Figuren-Körperteile |
| `environment/` | 2 | 64 KB | wiederholbare Teppich- und Tapetenkacheln |
| `fx/` | 246 PNG + 7 JSON | 866 KB | Partikel, Impacts, drei Frame-Animationen und vier Emitter |
| `music/` | 6 OGG | 13,4 MB | sechs Tonspuren aus den WAV-Mastern |

`src/render/assets/manifest.json` ist die einzige Quelle für IDs und Pfade. Es wird
mit `pnpm run assets:manifest` aus dem öffentlichen Baum erzeugt und enthält:

- `symbols` — 24 IDs; die Engine zieht neun davon (`SLOT_SYMBOLS` in
  `src/core/games/engines/slot-paytable.ts`), die übrigen 15 sind Asset-Bestand
  und im Spiel über die Bibliothek sichtbar.
- `machines`, `decor`, `plinko`, `ui`, `characters`, `environment`, `fx` — je Pfad
  eine ID; die Bibliothek zeigt jede Datei.
- `animations` — drei Frame-Folgen (`coin-spin`, `explosion`, `smoke-puff`) mit
  Frames, fps und Schleifen-Flag.
- `emitters` — vier Partikel-Konfigurationen mit ihren Texturen.
- `music` — sechs Zustände: `floor`, `night`, `menu`, `background`, `games`, `slot`.

### Wo das Paket im Spiel ankommt

- **Floor:** Geräte-Texturen ersetzen den gezeichneten Korpus für Automaten und
  Tische (`src/render/furniture-art.ts`); Service-Möbel (Bar, Klo, Kasse, Lager)
  und Deko (Sofa, Palme, Neon, Säule, Lampe) werden nach Spiel-ID bzw. Label
  zugeordnet. Fehlt eine Textur, bleibt die gezeichnete Grafik.
- **Plinko:** Pegs, Bumper und Auszahlungsfelder nutzen die passenden Texturen
  (`src/render/games/plinko-canvas.ts`); die übrigen Varianten liegen im Katalog.
- **Slot:** neun Engine-Symbole werden vorgeladen und auf den Walzen gezeichnet;
  der Münzregen nutzt die Coin-Sprites (`src/render/games/slot-fx.ts`), die
  15 Zusatzsymbole liegen im Katalog.
- **Figuren:** Pixelköpfe aus `characters/` ersetzen die gezeichneten Köpfe von
  Personal auf dem Floor und von Gegnern/Dealer am Poker-Tisch; der Croupier
  steht als Portrait im Roulette-Fenster (`src/render/pixel-head.ts`).
- **UI & Environment:** HUD und Popups nutzen die Icons aus `ui/`; der
  Damast liegt in den Popup-Köpfen, das Teppichmuster als maskierte Textur über
  den Floor-Zonen (`src/render/floor-carpet.ts`).
- **FX & Emitter:** `jackpot-burst`, `coin-burst` und `plinko-impact` laufen
  an Slot, Plinko, Roulette und Poker (`src/render/fx/emitter.ts`); Verluste
  nutzen denselben Coin-Emitter gedämpft. Die drei Frame-Folgen laufen weiterhin
  als echte Bildfolge in der Bibliothek.
- **Sound:** sechs Tonspuren sind Musikzuständen zugeordnet und in der Bibliothek
  einzeln abspielbar.
- **Asset-Bibliothek:** `src/ui/asset-library-popup.tsx`, erreichbar über
  `ASSETS` im HUD. Dort ist der vollständige Bestand sichtbar und anhörbar.

### Musik

`src/render/music.ts` ist eine eigene Schicht innerhalb der bestehenden
Audioarchitektur, kein zweites Audiosystem:

- Sechs Zustände: `FLOOR`, `NIGHT`, `MENU`, `BACKGROUND`, `GAMES`, `SLOT`;
  `App.tsx` leitet sie aus Fenster und Ort ab (Fremdhaus = Nacht, Hilfe/Menü =
  Maintheme, Protokoll/Prüfung = Hintergrund, Spiel = Games/Slot).
- `HTMLAudioElement` streamt, statt die ganze Datei zu dekodieren: Minutenlange
  Tracks wären sonst zweistellig viele Megabyte im Speicher.
- Crossfade über 1,2 s; das alte Element wird danach pausiert und gibt seine
  Quelle frei.
- Eigene Musiklautstärke (`rbd.music.volume`), multipliziert mit dem Master aus
  `sound-fx.ts`. Stummschalten setzt die Musik auf 0, ohne die Position zu verlieren.
- Start erst nach einer Geste. Ein abgelehnter `play()`-Versuch bleibt nicht endgültig
  stumm: Der Zuhörer bleibt, bis wirklich etwas läuft.

### Audio-Pipeline

Die WAV-Master bleiben **außerhalb** des Repositories; ausgeliefert wird nur Opus.

```bash
npm rebuild ffmpeg-static      # einmalig, das Binary liegt in node_modules
RBD_AUDIO_SOURCE=/pfad/zu/sounds pnpm run assets:audio
```

Gemessen mit `libopus`, 48 kHz, Stereo:

| Track | Quelle | Auslieferung | Anteil |
| --- | ---: | ---: | ---: |
| `floor` (Atmosphäre_base, 60 s) | 10.336 KB | 671 KB | 6,5 % |
| `night` (Atmosphäre_night_Prototyp) | 46.684 KB | 2.659 KB | 5,7 % |
| `menu` (Maintheme) | 10.336 KB | 998 KB | 9,7 % |
| `background` (background_loop) | 10.336 KB | 933 KB | 9,0 % |
| `games` (atmosphäre_base_fullcasino) | 46.684 KB | 4.071 KB | 8,7 % |
| `slot` (Slot1) | 46.684 KB | 4.074 KB | 8,7 % |
| **Summe** | **171.060 KB** | **13.405 KB** | **7,8 %** |

OGG/Opus deckt Chromium, Firefox und die Android-WebView ab. Safari spielt es erst ab
neueren Versionen; für eine reine Web-Auslieferung an Safari wäre AAC die sichere Wahl.

### Semantik-Katalog

Neben dem Manifest liegt `src/render/assets/asset-semantics.json`: eine
Bestandsaufnahme mit einem Eintrag je Manifest-Referenz (552 Eintraege, davon
539 Bilder) und den Feldern Typ, Rolle, Anchor, sichtbare Bounds,
Tiefenklasse/Layer, Occlusion, LOD, Varianten und optionale Animationsreferenzen.
Er fuehrt keine eigene ID und keinen Pfad, kein Renderer liest ihn, und
`manifest.json` bleibt unveraendert. Der Metadatenvertrag samt Pflichtfeldern je
Typ, den 15 bestehenden Render-Zuordnungen und den 23 Rollen-Dubletten steht in
`docs/ARCHITECTURE.md`.

### Prüfung

```bash
pnpm run verify:assets
```

Das Skript prüft drei Dinge und wird rot, wenn eines nicht stimmt:

1. Jede Manifest-Referenz aus allen Kategorien, jedem Animationsframe und jeder
   Emitter-Textur zeigt auf eine vorhandene Datei im Größenrahmen.
2. Jedes `SLOT_SYMBOLS`-Symbol der Engine hat eine Textur im Manifest.
3. Im kuratierten Ordner liegt keine Datei, die keine ID benutzt — sonst wandert sie
   über `public/` ungeprüft in den Production-Build.

Der visuelle Nachweis liegt unter `docs/screenshots/comparison/`:
`03-floor-v1-v2.png` (vorher/nachher), `04-asset-library-top-v2.png` und
`05-animations-emitter-sounds-v2.png`.


## Anhang: Asset-Semantik: Katalog und Metadatenvertrag

> Bei der Doku-Konsolidierung aus `docs/ASSET-SEMANTICS.md` uebernommen; die Quelldatei wurde geloescht. Die Aussagen gelten zum Stand dieses Commits.

Dieses Dokument beschreibt den Katalog `src/render/assets/asset-semantics.json`.
Er ist eine **Bestandsaufnahme plus Vertrag**, kein Renderer-Eingang: kein Modul
liest die Datei, sie ändert kein Bild und keinen Spielzustand. Die Quelle für IDs
und Pfade bleibt ausschließlich `src/render/assets/manifest.json`.

### Grenze zum Manifest

| Frage | Antwort | Ort |
| --- | --- | --- |
| Welche Assets gibt es? | Manifest | `manifest.json` |
| Wie heißt ein Asset stabil? | Manifest-Referenz (Pfad bzw. ID) | `manifest.json` |
| Wo liegt die Datei? | Manifest (`base` + Referenz) | `manifest.json` |
| Welche Rolle spielt ein Asset? | Katalog | `asset-semantics.json` |
| Wie groß ist das Bild sichtbar? | Katalog (aus Atlasseiten), sonst `unknown` | `asset-semantics.json` |
| Wo sitzt es im Spiel? | Core (Furniture, Zonen, Sitze) | `src/core/` |

Der Katalog führt **keine** zweite Asset-ID, keinen zweiten Pfad, keine
Zonenkopie, keine Materialdefinition und keine Simulationsgeometrie. Wo Zahlen
aus dem Manifest gebraucht werden (Frames, Emitterwerte, Tonspur), steht ein
Verweis der Form `{"from": "manifest.animations.coin-spin.frames"}` mit
`count`, niemals eine Kopie.

### Inventar (Stand 0.3.122)

552 Einträge: 539 Bilder, 3 Animationen, 4 Emitter, 6 Tonspuren.
153 Bilder liegen auf zwei gepackten Atlasseiten.

| Kategorie | Einträge | im Atlas | sichtbare Bounds | Code-Beleg (Welt) | Code-Beleg gesamt | Größe |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `symbols` | 24 | 0 | 0 | 9 | 9 | 82 KB |
| `machines` | 54 | 54 | 54 | 15 | 16 | 476 KB |
| `decor` | 28 | 28 | 28 | 18 | 18 | 244 KB |
| `plinko` | 46 | 0 | 0 | 8 | 8 | 134 KB |
| `ui` | 70 | 0 | 0 | 0 | 7 | 151 KB |
| `characters` | 69 | 69 | 69 | 18 | 18 | 100 KB |
| `environment` | 2 | 2 | 2 | 2 | 2 | 60 KB |
| `fx` | 246 | 0 | 0 | 17 | 17 | 374 KB |
| `animations` | 3 | – | – | 3 | 3 | – |
| `emitters` | 4 | – | – | 4 | 4 | – |
| `music` | 6 | – | – | 0 | 6 | 13,7 MB |
| **Summe** | **552** | **153** | **153** | **87** | **108** | **15,3 MB** |

444 Bilder haben keinen Code-Bezug (418 ohne jede Referenz, 26 nur über die Asset-Bibliothek). Sie liegen im Bestand und sind über die
Asset-Bibliothek sichtbar; ihr Typ stammt aus dem Paketordner und ist im
Katalog mit `"evidence": "category"` markiert. Nur 95 Bilder und die 13
Manifest-IDs tragen `"evidence": "code"`: dort belegt eine Quelle im Baum die
Rolle.

### Asset-Typen

Die Trennung ist eine Rolle, keine Dateiendung. `interactive` ist derzeit
**leer** — siehe Befund unten.

| Typ | Bedeutung | Pflicht zusätzlich zu den gemeinsamen Feldern |
| --- | --- | --- |
| `placeable` | Textur zeigt den Körper eines platzierbaren Möbels | `anchor`, `role` |
| `decorative` | feste Requisite an einer Zone, kein Spielzustand | `anchor`, `role` |
| `ui` | Bild im DOM (HUD, Popup, Icon) | `role` |
| `fx` | Partikel, Impacts, Verlaufsbilder | – |
| `environment-tile` | wiederholbare Kachel (Boden, Tapete) | `anchor`, `bounds` |
| `character-part` | Figurteil, Aufhängepunkt statt Fußpunkt | `anchor` |
| `game-piece` | Teil einer Spielbühne (Walze, Plinko, Tisch) | `anchor` |
| `animation` | Frame-Folge, Frames bleiben im Manifest | `frames`, `fps`, `loop` |
| `emitter` | Partikelkonfiguration, Zahlen bleiben im Manifest | `config`, `textures` |
| `audio` | Tonspur ohne Sichtbarkeit | `path` |
| `interactive` | Textur trägt selbst eine Interaktion | `anchor`, `bounds` |
| `unknown` | kein Code-Beleg für die Rolle | – |

Gemeinsame Pflichtfelder für jeden Eintrag:
`category`, `type`, `bounds`, `depth`, `occlusion`, `lod`, `interactive`,
`usedBy`, `evidence`. Pflicht heißt: **Feld vorhanden**. Der Wert darf
`"unknown"` sein, wenn es keinen Beleg gibt.

Verteilung über die 539 Bilder: `fx` 246, `game-piece` 73, `ui` 71,
`character-part` 69, `placeable` 64, `decorative` 14,
`environment-tile` 2, `unknown` 0, `interactive` 0.

#### Sichtbare Bounds versus Gameplay-Footprint

`bounds` sind die Bildmaße aus den Atlasseiten (`{"w":104,"h":145}` etwa für
den Slot-Schrank) oder `"unknown"`. Sie sind **keine** Belegung im Raster:
Sitzplätze, Kollision, Laufwege, Zonen und Platzierungsregeln bleiben im Core.
Ein Möbel mit `2×3` Feldern darf eine Textur mit anderem Seitenverhältnis
tragen; der Renderer skaliert sie auf seine Objektgröße.

### Metadatenvertrag je Eintrag

```json
"machines/slot-cabinet.png": {
  "category": "machines",
  "type": "placeable",
  "role": "Furniture-Korpus nach gameId | HUD-/Spiel-Icon",
  "anchor": {"x": 0, "y": 0},
  "bounds": {"w": 104, "h": 145},
  "depth": {"class": "object-body", "layer": "furniture", "order": 4},
  "occlusion": "paint-order",
  "lod": "always",
  "variants": [],
  "animations": [],
  "interactive": "unknown",
  "usedBy": ["src/render/furniture-atlas.ts", "src/ui/icons.ts"],
  "evidence": "code"
}
```

| Feld | Werte | Bedeutung |
| --- | --- | --- |
| `category` | Manifest-Kategorie | Herkunft im Paket, nicht die Rolle |
| `type` | siehe Tabelle | Rolle im Spiel |
| `role` | freie Liste, ` \| `-getrennt | konkrete Bindung laut Code |
| `anchor` | `{x,y}` in 0..1 oder `"unknown"` | Pivot beim Zeichnen |
| `bounds` | `{w,h}` oder `"unknown"` | sichtbare Bildmaße aus dem Atlas |
| `depth.class` | `environment-tile`, `room-dressing`, `object-body`, `game-piece`, `figure`, `fx-world`, `ui-dom`, `audio-nonvisual`, `unknown` | Tiefenklasse |
| `depth.layer` | `room`, `carpet`, `dirt`, `furniture`, `props`, `cues`, `actors`, `stickers`, `fx`, `game-board`, `slot-reels`, `dom-ui`, `audio`, `unknown` | Zeichenebene |
| `depth.order` | 1..9 oder `"unknown"` | Position dieser Ebene in `floor-view.ts` |
| `occlusion` | `paint-order`, `mask-clipped`, `none`, `unknown` | wie Verdeckung entsteht |
| `lod` | `always`, `detail-only`, `overview-silhouette`, `unknown`, `not-applicable` | Verhalten zwischen Übersicht und Detail |
| `variants` | Liste von Manifest-Referenzen | Geschwister aus derselben Familie |
| `animations` | Liste von `manifest.animations`-IDs | optionale Animationsreferenz |
| `interactive` | `"unknown"` (heute überall) | ob die Textur selbst Interaktion trägt |
| `usedBy` | Quelldateien | wer das Asset referenziert |
| `evidence` | `code`, `category` | Herkunft der Rollenaussage |

#### Depth und Occlusion sind Malreihenfolge

`src/render/floor-view.ts` hängt neun Container in fester Reihenfolge an die
Kamera: `room`, `carpet`, `dirt`, `furniture`, `props`, `cues`, `actors`,
`stickers`, `fx`. Es gibt **kein** `zIndex` und keine Tiefensortierung im
Floor; Occlusion ist damit reine Malreihenfolge (`paint-order`). Die einzige
Ausnahme ist der Teppich: er wird über eine Zonenmaske beschnitten
(`mask-clipped`), deshalb liegt er als eigener Layer über dem Raum-Chunk.

#### LOD

`floor-view` schaltet genau zwei Stufen (`setLod`). In der Übersicht bleibt der
Korpus sichtbar, während `setDetail(false)` Beschriftung, Status und Glow
ausblendet — deshalb tragen Texturen des Möbelkorpus `lod: "always"`, und nur
Overlay-Elemente (Text, Ringe) wären `detail-only`. Für Assets ohne diese
Unterscheidung im Code steht `"unknown"`, nicht geraten.

### Bestehende Zuordnungen (Abgleich)

| Quelle | Mechanik | Ebene | Referenzen |
| --- | --- | --- | ---: |
| `src/render/furniture-atlas.ts` | `MACHINE_TEXTURE` (8 `gameId`s), `KIND_TEXTURE` (4 Arten), `DECOR_TEXTURE` (17 Label-Regexe, erster Treffer gewinnt) | `furniture` | 26 |
| `src/render/room-dressing.ts` | `DRESSING` je Zonenart (BAR, EXCHANGE, GAMING, STORAGE), je drei Requisiten mit relativer Position und Größe | `room` | 12 |
| `src/render/floor-surface.ts` | `FLOOR_TEXTURE` je Bodenmuster (8 Zonenarten, 2 Kacheln) | `room` | 2 |
| `src/render/room-art.ts` | `WALLPAPER` für die Rückwand | `room` | 1 |
| `src/render/floor-carpet.ts` | `TilingSprite` mit Zonenmaske, `tileScale` 0.34, `alpha` 0.18 | `carpet` | 1 |
| `src/render/guest-parts.ts` | 18 Köpfe, Auswahl per Seed-Modulo | `actors` | 18 |
| `src/render/pixel-head.ts` | `ASSET.heads` (6) und `ASSET.dealer`, Anchor 0.5/0.9 | `actors` | 7 |
| `src/render/assets/keys.ts` | `RUNTIME_ART`-Vorladeliste vor dem ersten Frame | `fx` | 17 |
| `src/render/games/plinko-assets.ts` | `PEG_TEXTURE` je `PegKind` (5), `payoutArt` nach `payBps` (3) | `game-board` | 8 |
| `src/ui/icons.ts` | `UI_ICON` (9, davon 2 aus `machines`/`characters`) und `GAME_ICON` (8) | `dom-ui` | 17 |
| `src/styles/popup.css` | Damast als wiederholter Popup-Hintergrund | `dom-ui` | 1 |
| `src/render/games/slot-fx.ts` | `ASSET.coinSpin` als Münzregen | `fx` | 1 |
| `src/render/fx/emitter.ts` | `manifest.emitters`, `smoke-puff`-Frames als Texturquelle | `fx` | 5 |
| `src/render/music.ts` | `manifest.music`, sechs Zustände mit Crossfade | `audio` | 6 |
| `src/ui/asset-library-popup.tsx` | zeigt jede Kategorie, kein Floor-Bezug | `dom-ui` | 539 |

Drei Zuordnungen sind **indirekt** und deshalb im Katalog über `role`
markiert, nicht über einen Pfad: Walzensymbole laufen über ihre ID
(`SLOT_SYMBOLS` → `manifest.symbols`), Emittertexturen über
`manifest.emitters[].textures`, Animationsframes über
`manifest.animations[].frames`.

### Dubletten

23 Referenzen tragen mehr als eine Rolle. Keine Datei ist doppelt im Manifest
eingetragen; die Dubletten sind Rollen-Dubletten.

| Referenz | Rollen |
| --- | --- |
| `characters/head-02-01.png` | Gast-Kopf, Kopf für Personal/Dealer, HUD-Icon (Croupier) |
| `characters/head-01-01` … `head-02-07` (5 weitere) | Gast-Kopf und Personal-/Dealer-Kopf |
| `decor/bar-back-shelf.png`, `decor/bar-counter-stools.png` | Möbelkorpus (Bar) und Zonen-Requisite |
| `decor/casino-column.png`, `decor/neon-column.png`, `decor/potted-palm.png`, `decor/casino-side-table.png` | Möbelkorpus (Deko nach Label) und Zonen-Requisite |
| `machines/slot-cabinet.png`, `plinko-cabinet`, `roulette-table`, `blackjack-table`, `poker-table`, `video-poker-terminal`, `shell-game-cups-and-pearl` | Möbelkorpus und HUD-Spiel-Icon |
| `machines/dice-table.png` | Möbelkorpus und HUD-Spiel-Icon |
| `machines/storage-shelves.png` | Möbelkorpus (Lager) und Zonen-Requisite |
| `machines/table-games/poker-chip-single.png` | Chip am Tisch und HUD-Icon/Vorladeliste |
| `environment/tiles/wallpaper-damask-plum.png` | Zonenbelag, Wandtapete, Popup-Hintergrund |

Diese Rollen sind **kein Fehler**: dasselbe Bild darf als Korpus und als Icon
dienen. Der Katalog hält sie fest, damit eine spätere Änderung an einem Bild
sichtbar macht, wie viele Stellen sie berührt. Wer Rollen trennen will, legt
neue Dateien im Manifest an — nicht eine zweite ID im Katalog.

### Befunde

1. **Kein Asset ist belegbar interaktiv.** Interaktion hängt an
   Simulationsobjekten (`Furniture`, `GameView`, Popup-Router), nicht an einer
   Textur. Deshalb steht `interactive` überall auf `"unknown"`, und der Typ
   `interactive` ist leer. Das ist die ehrliche Antwort, keine Lücke im
   Katalog.
2. **Deko-Zuordnung läuft über Label-Regexe.** `DECOR_TEXTURE` in
   `furniture-atlas.ts` wählt nach Schlagwort im Möbel-Label (17 Muster, erster
   Treffer). Ein unbekanntes Label fällt auf den gezeichneten Korpus zurück.
   Das ist eine semantische Bindung im Renderer, die der Katalog nur
   dokumentiert — sie gehört mittelfristig an eine stabile Rolle, nicht an
   Anzeigetext.
3. **Vier von fünf FX-Unterordnern sind ohne Code-Bezug.** 246 FX-Bilder
   stehen 17 belegten gegenüber; der Rest liegt als Bestand in der Bibliothek.
   Wer Partikel erweitert, findet die Textur dort, aber kein Renderer wartet
   darauf.
4. **444 Bilder ohne Code-Bezug** sind kein Aufräumauftrag, sondern
   Ausgangsmaterial. Der Katalog markiert sie mit `evidence: "category"`,
   damit niemand sie für verdrahtet hält.
5. **Symbole sind ID-gebunden, nicht pfadgebunden.** Nur neun der 24 Symbole
   sind Engine-Symbole (`SLOT_SYMBOLS`); die anderen 15 sind Bestand. Eine
   pfadbasierte Suche findet sie nicht — der Katalog löst das über
   `manifestPath`.

### Messung und Anker (Slice 2: `machines`, `decor`)

Alle 82 Dateien dieser beiden Kategorien wurden geoeffnet und gemessen, nicht
geschaetzt. Die Leinwand (`bounds`) ist die PNG-Groesse und stimmt bei allen 82
mit dem Atlasrahmen ueberein. Der sichtbare Inhalt (`content`) ist die
Alpha-Bounding-Box der Datei; `contentFill` nennt beide Achsen als Anteil. Drei
Ankerbegriffe sind getrennt:

| Feld | Bedeutung | Quelle |
| --- | --- | --- |
| `anchor` + `anchorKind` | Sprite-Pivot, den der Renderer setzt | Code (`furniture-atlas.ts`, `room-dressing.ts`, `poker-canvas.ts`) |
| `ground` | Bodenanker am unteren Rand des **sichtbaren Inhalts** | Alpha-Bbox |
| `top` | Oberkante des sichtbaren Inhalts (Aufhaenge- oder Auflagepunkt) | Alpha-Bbox |

`ground: "none"` heisst: der Inhalt beruehrt die Unterkante nicht, es gibt im
Bild keinen Bodenkontakt. Fuer Tischkarten und Chips sind `ground` und `top`
beide `none`, weil sie auf einer Flaeche liegen statt zu stehen.

#### Ableitungsregeln (deterministisch)

| Feld | Regel |
| --- | --- |
| `proportion` | Seitenverhaeltnis des Inhalts: `upright` ≤ 0.8, `wide` ≥ 1.25, sonst `square` |
| `base` | `full-bleed` bei deckender Leinwand ohne Transparenz; `raised`, wenn der Inhalt mindestens 15 % Hoehe Abstand zur Unterkante hat; `flat-on-surface` fuer `machines/table-games/`; sonst `floor-contact` |
| `ground` | `floor-contact`: `{x: Inhaltsmitte, y: Inhaltsunterkante}`; `full-bleed`: `{0.5, 1.0}`; `raised` und `flat-on-surface`: `"none"` |
| `top` | `{x: Inhaltsmitte, y: Inhaltsoberkante}`; `flat-on-surface`: `"none"` |
| `notes` | nur messbare Marker: deckende Leinwand, kein Bodenkontakt im Bild, Inhalt schmaler als 65 % der Leinwand, Inhalt flacher als 80 % der Hoehe |
| `variants` | gleicher Namensstamm **und** identische Leinwand; reine Namensaehnlichkeit zaehlt nicht |

#### Verteilung

| `base` | Assets | Bedeutung im Bild |
| --- | ---: | --- |
| `floor-contact` | 54 | Objekt steht auf, Inhalt endet knapp ueber der Unterkante (1–6 px Rand) |
| `flat-on-surface` | 18 | Tischkarten, Chips, Roulette-Layout, Suit-Zeichen (3 davon mit Code-Bezug als explizite Sprites, 15 nur im Bestand) |
| `full-bleed` | 7 | ohne Transparenz: zwei aegyptische Saeulen, `palm-neon`, `potted-palm-variant`, `potted-plant`, `small-podium`, `restroom-stall` |
| `raised` | 3 | `wall-sconce` (19 % Abstand), `cocktail-glass` (17 %), `shot-glass` (18 %) |

`proportion`: 50 `upright`, 25 `square`, 7 `wide`.

#### Grosse Objekte, Automaten, Saeulen

- **Wide (7):** `blackjack-table` (140×94, Inhalt 116×87), `cash-register`
  (80×64, 76×58), `coin-tray` (64×40, 60×30), `control-button-panel`
  (128×48, 124×41), `display-bezel` (96×64, 82×60),
  `roulette-betting-layout` (112×52) und `roulette-wheel` (88×61).
- **Grosse Tische sind nicht automatisch `wide`.** Sie sind fast quadratisch im
  Inhalt, weil Tischplatte und Kante die Hoehe fuellen: `dice-table` (168×68,
  Inhalt 73×63, 44 % der Leinwandbreite), `roulette-table` (168×72, 81×66, 48 %),
  `shell-game-table` (160×55, 54×51, 34 %), `poker-table` (145×97, 112×90, 77 %),
  `blackjack-table` (140×94, 116×87, 83 %), `cashier-counter` (144×85, 82×79,
  57 %). Bei den ersten vier steht die Notiz `schmaler Inhalt in breiter
  Leinwand`: wer sie auf einen breiten Fussabdruck streckt, verbreitert die Luft
  um das Objekt, nicht das Objekt.
- **Automaten (`upright`, hoechste Saeulen der Kategorie):**
  `slot-machine-front` (96×160), `video-poker-terminal` (100×160),
  `slot-machine-compact` (108×156), `casino-kiosk` (100×148),
  `slot-cabinet` (104×145), `storage-shelves` (100×139).
- **Saeulen (`upright`, schmal):** `egyptian-column-tall` (45×112),
  `neon-column` (40×112), `casino-column` (44×90), `egyptian-column-short`
  (39×96). Die beiden aegyptischen Saeulen sind zwei Groessen desselben Motivs,
  aber **keine** Varianten im Katalogsinn: unterschiedliche Leinwand.
- **Mehrteilige Objekte:** `bar-counter-stools` zeigt drei Hocker, `restroom-stall`
  mehrere Kabinen, `control-button-panel` eine Knopfreihe. Sie werden als ein
  Sprite mit fester Groesse gezeichnet (`transform: fixed-size`, `baked:
  room-chunk-cache`); die Aufteilung in Einzelteile passiert im Core
  (Sitzplaetze, Kabinen), nicht in der Textur. Der Katalog speichert deshalb
  keine Teileliste — und bewusst keine Zonenzuordnung.

#### Varianten

14 Assets tragen verifizierte Varianten: `machines/bar-bottle-*` (4, gleiche
32×64-Leinwand), `machines/chip-stack-*` (5, 32×40), drei
`machines/table-games/chip-stack-*` (32×45) und zwei Suit-Zeichen (24×25).
Alle anderen Namensfamilien unterscheiden sich in der Leinwand und bleiben
eigene Assets.

#### Ausnahmen und Unbekanntes

- 48 der 82 Assets haben keinen Renderer-Bezug. Sie tragen `transform:
  library-only`, `anchor: "unknown"` und `anchorKind: "unknown"`; `content`,
  `proportion`, `base`, `ground` und `top` sind trotzdem gemessen, weil sie rein
  visuell sind.
- Kein Maschinen- oder Deko-Asset ist als interaktiv markiert. Interaktion
  haengt an `Furniture` und `GameView`; ein Stuhl, eine Saeule und ein Neon-Schild
  bleiben damit dekorativ, auch wenn ihr Dateiname nach Objekt klingt.
- Wo der Inhalt die Leinwand nicht ausfuellt, bleibt der Rand Teil der
  Zeichenflaeche. `ground` und `top` beziehen sich deshalb auf den Inhalt, nicht
  auf die Leinwandkante.

### Pflege

- Der Katalog wird **nicht** von einem Skript im Verify-Lauf erzeugt und von
  keinem Gate geprüft. Er ist Dokumentation mit Datenform.
- Ändert sich das Manifest (neue Datei, neue ID), gehört der Eintrag in den
  selben Commit: `evidence: "category"` ist der ehrliche Startwert.
- Ändert sich eine Bindung im Renderer, wandert `usedBy`/`role` mit.
- Kein Renderer liest diese Datei. Wer sie zur Laufzeit einlesen will, braucht
  zuerst einen eigenen Task samt Gate — bis dahin bleibt sie Papier.


## Anhang: Casino Pixel Asset Pack (Quellbeschreibung)

> Bei der Doku-Konsolidierung aus `docs/CASINO-PIXEL-ASSET-PACK.md` uebernommen; die Quelldatei wurde geloescht. Die Aussagen gelten zum Stand dieses Commits.

Transparent, standalone pixel-art PNG textures for the casino test venue of the 2D life simulation **Rigged by Design**, using PixiJS 8. The casino is where the systems are proven; it is not the genre. Sprites share a bold comic outline and the project role palette (violet identity, cyan service, pink guest, gold value, red danger, green success, orange warning). Textures are nearest-neighbor scaled with hard alpha edges; load them individually with `Assets.load`.

### Asset folders

- `assets/symbols/` — 15 reel/slot symbols (7, bell, cherries, plum, grapes, lemon, orange, watermelon, star, diamond, BAR, crown, horseshoe, clover, WILD). **64×64 px**.
- `assets/plinko/` — 8 jewel/steel peg colors, 3 diamond bumpers, a violet wedge bumper, 2 chevron deflectors, 2 slanted rails and 5 horizontal/diagonal rail variants. Pegs are **32×32 px**; bumpers **40×40 px**; deflectors/rails **32–64 px** high and **32–80 px** wide.
- `assets/machines/` — recognizable slot cabinet front/side, display bezel, button panel, coin tray, lever, 4 bar bottles, cocktail/beer/shot glasses, cash register, payment terminal and 5 chip stacks. Detail textures range from **24×40 px** to **128×48 px**; cabinet front is **96×160 px** and side panel **48×128 px**.
- `assets/decor/` — pendant lamp, oval neon, wall sconce, casino neon sign, neon column, 2 potted plants, velvet-rope barrier, planter greenery, upright neon tube and newspaper prop. Sizes range from **24×64 px** to **96×80 px**; the neon column is **40×112 px**.
- `assets/ui/` — 24 utility/status/role icons plus 5 beveled panel accents. Icons and badges are **32×32 px**; panel accents are **32×32 px**, **96×48 px** or **128×48 px**. Role badges are supplied in violet, cyan, pink, gold, red and green.

### PixiJS 8 example

```js
import { Assets, Sprite } from 'pixi.js';

const texture = await Assets.load('/assets/symbols/lucky-seven.png');
const sprite = new Sprite(texture);
sprite.texture.source.scaleMode = 'nearest';
```

Set nearest-neighbor sampling when scaling sprites. ZIP contents are limited to `README.md` and the `assets/` directory; no source code, fonts or runtime dependencies are included.


## Anhang: CI-Gates und Main-Schutz

> Bei der Doku-Konsolidierung aus `docs/CI-GATES.md` uebernommen; die Quelldatei wurde geloescht. Die Aussagen gelten zum Stand dieses Commits.

Zwei Ebenen, unabhaengig voneinander. Ebene A liegt im Repository, Ebene B ist
eine GitHub-Einstellung, die kein Commit aendern kann.

### Modi

| Modus | Aufruf | Verhalten |
| --- | --- | --- |
| verify | `pnpm run verify`, `pnpm run verify:all`, `pnpm run verify:release` | liest ausschliesslich; kein Gate schreibt, ein veralteter Baum wird rot |
| fix | `pnpm run fix`, `pnpm run fix:all` | ESLint `--fix` und Dependency-Matrix, danach dieselben Gates; nennt jede geaenderte und jede geloeschte Datei |
| verify nach fix | `pnpm run verify:all` | prueft den reparierten Baum; ein zweiter Fix-Lauf meldet „keine Aenderung“ |

`pnpm run fix` ist idempotent: der Lauf vergleicht `git status --porcelain` vor
und nach dem Autofix und listet `+ neu`, `~ geaendert` und `- geloescht`.
Geloescht wird nur, was ein Werkzeug selbst entfernt; `autofix-0911` raeumt
keine Screenshot-Ordner mehr auf.

### Ebene A: Workflows

- `ci-verify.yml` laeuft auf jedem Push (`branches: ['**']`, also auch `main`),
  auf Pull Requests gegen `main` und ueber `workflow_dispatch`. Der Job heisst
  **`Fail-Closed Gates`**; dieser Name ist der Pflichtstatus aus Ebene B.
- `auto-version-release.yml` startet per `workflow_run` erst nach einem
  erfolgreichen `CI Verify`-Lauf auf `main`. Er taggt genau den geprueften
  Commit und wiederholt die Suite nicht. Nur `workflow_dispatch` fuehrt
  `verify:release` selbst aus, weil ein manueller Lauf keinen CI-Lauf hat.
- Die automatischen Laeufe rufen nur lesende Profile auf; der Tag ist der
  einzige externe Schreibvorgang. `build-apk.yml` ueberspringt die Suite nur,
  wenn der Aufrufer `skip_verify: true` setzt; manuelle Laeufe und Tag-Pushes
  pruefen weiterhin selbst.
- `pr-cleanup.yml` loescht nach einem Merge den Head-Branch am Remote. Weil der
  Merge den Pflichtstatus **`Fail-Closed Gates`** voraussetzt, ist "gemergt"
  hier immer "gemergt mit gruenen Gates". `main`, Fork-Branches und Pull
  Requests mit dem Label `keep-branch` bleiben unberuehrt. Lokal raeumt
  `pnpm run branches:prune` jeden nach `main` gemergten Branch ab; `turn:finish`
  ruft das nach dem Push selbst auf. Offene Arbeit und `main` bleiben stehen.
- `long-checks.yml` ist rein manuell (`workflow_dispatch`) und traegt die teuren
  Nachweise: Statistik (RTP, Poker-Verteilung), Soak, Balance und Benchmarks.
  `ppnpm run ci:long` startet ihn, wartet auf das Ergebnis und laedt den
  Balance-Bericht als Artefakt; lokal laufen diese Klassen nie mit.
- Alle Linux-Jobs pinnen `ubuntu-24.04` statt `ubuntu-latest`, damit die
  26.04-Migration nicht ungeplant in den Build rutscht. Die Actions laufen auf
  Node-24-Runtimes: `checkout@v7`, `setup-node@v7`, `cache@v6`,
  `upload-artifact@v7`, `setup-java@v6` und `setup-android@v4`.

Grenze von Ebene A: Enthaelt eine Commit-Nachricht `[skip ci]` oder `[ci skip]`,
startet GitHub **keinen** Workflow. Das laesst sich auf Workflow-Ebene nicht
abfangen. Der Skip ist nur dann harmlos, wenn Ebene B aktiv ist: dann fehlt der
Pflichtstatus und der Commit kommt nicht durch den Merge.

### Ebene B: Ruleset fuer `main`

Stand 31.10.2026 im Repository **aktiv**: `main` verlangt einen Pull Request
und den Pflichtstatus **`Fail-Closed Gates`**, verbietet Force-Pushes und das
Loeschen des Branches. Ein Direktpush endet deshalb mit `GH006`; dann den
Arbeitsbranch pushen und einen fokussierten PR mergen.

Der Merge-Commit wird von `verify-commit-msg --head` geprueft. Titel und Body
muessen die exakten Ueberschriften `### Changes (Was ist neu)`,
`### Technische Basis & Kausalität` und `### Ausblick (Nächste Schritte)`
enthalten; ASCII-Varianten wie `Kausalitaet` oder `Naechste` sind rot. Der
PR-Body erfuellt diese Form, wenn er unveraendert als Merge-Text verwendet wird.

Einmalig in GitHub setzen (Settings → Rules → New branch ruleset) oder per API:

```json
{
  "name": "main-protect",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["refs/heads/main"], "exclude": [] } },
  "rules": [
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": true,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "required_status_checks": [{ "context": "Fail-Closed Gates" }]
      }
    },
    { "type": "non_fast_forward" },
    { "type": "deletion" }
  ]
}
```

Damit gilt: Pull Request erforderlich, gruener Pflichtstatus aus dem richtigen
Workflow, keine Force-Pushes, keine Branch-Loeschung, keine Direktpushes.

### Ein Prozess: Impact, Plan, Bericht

`agent:context` und `agent:verify` sind keine zweite Pipeline. Beide lesen
`scripts/lib/impact.mjs`, das vorhandene Quellen zusammenfuehrt: `changedFiles`,
den Importgraphen (`selectAffectedTests`), den Testkatalog mit Beweisklassen,
`pipeline-plan` und `gate-cache`.

| Schritt | Zuständig | Ergebnis |
| --- | --- | --- |
| Aenderungsstand + Impact | `scripts/lib/impact.mjs` | Dateien, Systeme, Invarianten, Doku-Bezuege, Testauswahl |
| Agentenkontext | `scripts/agent-context.mjs` | kompakter Text oder JSON, keine Pruefung |
| Pruefplan + Ausfuehrung | `scripts/agent-verify.mjs` -> `runGates` | gleiche Gates wie `pipeline-plan`, Cache wird genutzt |
| Teilpruefung | Impact-Auswahl | `RBD_TEST_FILES` an `run-selected-tests.mjs`, Testgate ungecacht, Bericht `partial: true` |
| Lange Nachweise | `--ci` -> `ci-long-checks.mjs` | Actions-Lauf, auf den gewartet wird; Ergebnis im Bericht |
| Bericht | `.verify-cache/reports/<Zeit>/agent-summary.json` | `cached`, `executed`, `skipped`, `delegated` je Gate |

Eine Auswahl ist nie ein Vollnachweis: `verify:quick` und `verify:all` bleiben
die Tore fuer Commit und CI, `agent:verify` beschleunigt nur die Rueckmeldung.

### Auto-Promotion und Integrationsbranch

`promote.yml` schliesst die Luecke zwischen "Branch gepusht" und "auf main".
Der Workflow reagiert per `workflow_run` auf jedes abgeschlossene `CI Verify`
und arbeitet ein Ergebnis aus:

| CI-Ergebnis | Wirkung |
| --- | --- |
| success | PR wird angelegt (falls noetig) und mit `--squash --subject --body-file` gemergt; der Commit-Text traegt die drei Pflichtsektionen |
| failure, timed_out, cancelled, startup_failure | Label `integration/rot`, Stand wird auf die permanente Branch `integration` gelegt |
| `main` | keine Promotion, der Lauf endet sofort |

**Zwei parallele rote Staende.** GitHub haelt pro Concurrency-Gruppe genau einen
wartenden Lauf; ein dritter Aufruf verdraengt den zweiten. Deshalb liegt der
Zustand nicht in der Warteschlange, sondern im Branch und im Label: jeder Lauf
sammelt alle offenen PRs mit `integration/rot` und legt sie nacheinander auf
`integration`. Die Gruppe `promote` laesst nur einen Schreiber zu, ein
abgelehnter Push wird mit `fetch` und `reset --hard` neu aufgesetzt und erneut
gemergt — der Merge eines bereits enthaltenen Branches meldet "Already up to
date" und ist damit idempotent. Nichts wird verworfen, nichts force-gepusht.

**Textkonflikt.** Kollidiert ein Stand mit `integration`, wird der Merge
abgebrochen, der PR bekommt `integration/konflikt` und einen Kommentar; der
Stand bleibt unveraendert. Aufloesen ist Agentenarbeit (`git merge
origin/integration`), kein Automatismus — ein `-X theirs` wuerde Arbeit
stillschweigend verlieren.

**Token-Eskalation.** Ein Merge mit `GITHUB_TOKEN` startet keinen Workflow; ohne
Gegenmassnahme gaebe es weder `CI Verify` auf `main` noch Tag und APK. `promote`
nutzt `PROMOTE_TOKEN`, wenn das Secret gesetzt ist, und stoesst sonst
`Auto Version & Release` an, das den Commit-Text vor dem Tag selbst prueft.

**Geschuetzte Branch.** `integration` ist keine Wegwerfbranch: `pr-cleanup.yml`
und `scripts/lib/branch-prune.mjs` lassen sie stehen.

**Urteil.** Rot ist nur `failure`, `timed_out` oder `startup_failure`. Ein
`cancelled`-Lauf und der `pull_request`-Lauf des Merge-Refs sind kein Urteil
ueber den Branch. Vor dem Merge laeuft `gh pr update-branch`, weil der
Pflichtstatus unter `strict_required_status_checks_policy` sonst veraltet.

**Gruene Integrationsbranch.** Ist die Reparatur auf `integration` gruen, laeuft
`CI Verify` fuer diesen Branch, und derselbe Workflow legt den PR
`integration` -> `main` an und mergt ihn. Damit ist der Rueckweg automatisch.

### Release- und APK-Kette

Ein mit `GITHUB_TOKEN` gepushter Tag loest keinen Workflow aus. Deshalb ruft
`auto-version-release.yml` den APK-Build nach dem Tag **explizit** auf:

```text
CI Verify (verify:all) -> Auto Version & Release (Tag) -> workflow_call build-apk.yml -> Release-Asset + Pruefung
```

- `auto-version-release.yml` reagiert nur auf einen erfolgreichen `CI Verify`-Lauf mit `event == push` auf `main`; ein roter oder abgebrochener Verify-Lauf erreicht den Tag nicht.
- `build-apk.yml` ist ueber `workflow_call` aufrufbar und bekommt den Tag als Eingabe; Checkout, Upload und Artefaktpruefung haengen daran. Mit `skip_verify: true` laeuft keine zweite `verify:release`-Suite, weil der Aufrufer den Commit bereits geprueft hat; der Production-Build fuer `dist/` wird dann separat ausgefuehrt. Ohne den Input gilt weiterhin das volle Gate.
- Der zweite Trigger (`push: tags`) bleibt als Netz fuer manuell gepushte Tags und prueft weiterhin selbst.
- Der Job `apk` haengt mit `needs: release` am Release; ein roter APK-Build macht den Gesamtlauf sichtbar rot.
- Ein bereits existierender Tag oder Release erzeugt kein zweites Release (`ci-tag-release.mjs` prueft zuerst).

### Eskalation bei Umgebungsproblemen

`scripts/ci-tag-release.mjs` scheitert nicht roh an einer 403, sondern geht die
Leiter aus `scripts/lib/release-escalation.mjs` hoch:

| Stufe | Verhalten |
| --- | --- |
| `WORKFLOW_TOKEN` | Standardlauf mit `GITHUB_TOKEN`; transiente Fehler werden bis zu dreimal wiederholt |
| `RELEASE_TOKEN` | nur wenn das Repository-Secret gesetzt ist; uebernimmt bei Rechtefehlern |
| `BLOCKED` | `::error::` plus Job-Summary mit der genauen Einstellung, die fehlt |

Damit loesen sich Netzwerk- und Rechteprobleme entweder selbst oder der Lauf
sagt konkret, welche Umgebung fehlt. Ein Secret `RELEASE_TOKEN` mit
`contents:write` ist optional; ohne es bleibt die Anleitung im Log.

### Abnahme

| Kriterium | Nachweis |
| --- | --- |
| Direkter Push auf `main` blockiert | Ebene B, `non_fast_forward` + `pull_request` |
| `[skip ci]` umgeht die Pflichtpruefung nicht | Ebene B, `required_status_checks` |
| Release ohne gruenes Verify verhindert | `workflow_run.conclusion == 'success'` in `auto-version-release.yml`; manueller Lauf: `verify:release` |
| Nur ein vollstaendiger Verify-Lauf pro `main`-Push | `CI Verify` -> `workflow_run` Release; `build-apk.yml` ueberspringt `verify:release` nur mit `skip_verify: true` |
| PR ohne Pflichtstatus nicht mergebar | Ebene B, `required_status_checks` |
| Verify veraendert keinen Arbeitsbaum | `pnpm run verify:all` fuehrt keinen Autofix aus (`scripts/lib/pipeline-plan.mjs`); Berichte liegen im gitignorierten `.verify-cache/reports/` |
| Wegwerf-Branches verschwinden nach dem Merge | `pr-cleanup.yml` (nur gemergt, nicht `main`, kein Fork, kein `keep-branch`); lokal `pnpm run branches:prune` |
| Lange Nachweise laufen nicht lokal | `ppnpm run test:affected` ueberspringt `statistics` und `performance` und nennt sie; `long-checks.yml` rechnet sie in CI |
| Fix meldet jede Aenderung | `scripts/lib/tree-changes.mjs`, `pnpm run fix` |
| Zweiter Verify-Lauf reproduzierbar | Gate-Cache auf Inhalts-Hash; Fix-Lauf meldet „keine Aenderung“ |

#### Pflichtsektionen: Punkte statt Fliesstext

`scripts/verify-commit-msg.mjs` liest je Sektion nur Zeilen, die mit `- ` beginnen. Ein Absatz
ohne Aufzaehlung gilt als leer, auch wenn er Inhalt hat. Das Gate meldet dann
`[ERR-4006] Sektion ohne echten Inhalt: ### ...` und der Squash-Commit auf `main` wird rot.

- Also jede der drei Sektionen mit mindestens einem Punkt `- ` fuellen.
- Den Text vor dem Push pruefen: `node scripts/verify-commit-msg.mjs <datei>`.
- Beim Squash-Merge denselben Text als Commit-Nachricht verwenden, nicht die PR-Zusammenfassung.


## Anhang: Gate-Rootcause-Analyse

> Bei der Doku-Konsolidierung aus `docs/GATE-ROOTCAUSE.md` uebernommen; die Quelldatei wurde geloescht. Die Aussagen gelten zum Stand dieses Commits.

Aus AGENTS.md ausgelagert. Diese Tabelle hält die bisherigen CI-Gate-Fehler und ihre Ursachen fest.

Alle CI Gate-Fehler seit dem Merge von `fix/narrative-review-findings` (NAR-13) hatten dieselbe Rootcause:
**Dateien wurden gelöscht, die noch von anderen Modulen importiert wurden, und neue Imports verwiesen auf nicht mehr existierende Module.**

| Gate | Code | Datei | Ursache | Fix |
|------|------|-------|---------|-----|
| check:loc | ERR-4012 | `src/store/migrate.ts` | 221 LOC, Hot Zone für state-Dateien ist 165 | Auf 116 LOC reduziert (Kommentare entfernt, Zuweisungen kombiniert) |
| verify:docs | ERR-4017 | `docs/INVENTORY.md` | Abdeckung 1140 ≠ 1149 getrackte Dateien (Merge hat Datei-Zählung verändert) | `inventory:build` neu generiert, 1147/1147 |
| build | ERR-1005 | `src/core/sim/tick.ts` | Importierte aus gelöschten `character.ts`, `stain.ts`, `smartphone.ts` | `tick.ts` auf alten Stand zurückgesetzt |
| build | ERR-1005 | `src/store/venue-commands.ts` | Importierte aus gelöschten `mop.ts`, `interaction.ts` | `mop.ts`, `interaction.ts` mit nur benötigten Exports wiederhergestellt |
| dead-code | ERR-4003 | `src/core/sim/{character,interaction,mop,smartphone,stain}.ts` | Exports (`MOP_USES`, `manhattanDistance`, `getStainInfluence`, `tickStains` u.a.) nicht importiert | Dateien gelöscht oder auf nur genutzte Exports reduziert |
| tests | ERR-2001 | `src/core/sim/{templates,disputes}.ts` | `Cannot find module './stain'` | `stain.ts` mit nur `spawnStain`/`removeStain` wiederhergestellt |
| verify-commit-msg | ERR-4006 | Commit-Body | Pflichtsektionen ohne echten Inhalt (platzhalterartig) | Commit-Body mit vollständigen Inhalten in allen drei Sektionen |

**Regel:** Vor jedem Löschen von Dateien aus `src/core/sim/` (oder jedem anderen Verzeichnis) muss ein Import-Grep über das gesamte Repository laufen (`rg <dateiname> src/`), um sicherzustellen, dass kein Modul das gelöschte Datei importiert. Niemals Module löschen, die noch referenziert werden. Falls ein Modul teilweise ungenutzte Exports hat, nur die genutzten Exports behalten statt das ganze Modul zu löschen.

### ERR-4006 beim Merge eines gruenen PR

| Gate | Code | Datei | Ursache | Fix |
|------|------|-------|---------|-----|
| verify-commit-msg | ERR-4006 | Merge-Commit `6f7a906` (PR #163) | Der Merge lief nur mit `commit_title`. GitHub schreibt dann den PR-Titel als Merge-Text; die drei Pflichtsektionen aus dem PR-Body fehlen, obwohl der PR selbst gruen war. `main` wurde rot, `Bump, tag, release` und der APK-Bau fielen aus. | Follow-up-PR von `main`, dessen Merge `commit_message` = vollstaendiger PR-Body traegt. |

**Regel:** Beim Merge ueber Connector oder REST-API gehoert der PR-Body immer in `commit_message`. `commit_title` allein genuegt nicht, auch wenn alle PR-Checks gruen sind: `verify-commit-msg --head` prueft auf `main` den Merge-Commit, nicht den PR-Body. Vor dem Merge beide Felder setzen und danach den neuen `main`-HEAD samt `Fail-Closed Gates` pruefen.


## Anhang: Narrative Engine — Architekturvertrag

> Bei der Doku-Konsolidierung aus `docs/NARRATIVE-ENGINE.md` uebernommen; die Quelldatei wurde geloescht. Die Aussagen gelten zum Stand dieses Commits.

Stand: 2026-11-04 · Save v10 · Grundlagen NAR-00 bis NAR-03 vorhanden;
NAR-04 erledigt (Besucher↔Besucher, Besucher→Personal, Rivale→Haus), NAR-05 erledigt (Trigger-Context, Condition Evaluator, Schema), NAR-06 erledigt (Event-Scheduler, Lifecycle, persistente Instanzen, eigener Narrativ-RNG), NAR-07 erledigt (Event-Templates, stabile Choice-IDs, persistierte Choice-Saetze, Eligibility), NAR-08 erledigt (Command-DSL, Allowlist, Preflight, einmalige Ausfuehrung), NAR-09 erledigt (Contribution-Schema, kontrollierte Klassifizierung, Turn-Manifest, abgeleitete Registry), NAR-10 erledigt (Content-Compiler, byte-identische Registry), NAR-11 erledigt (lokaler Composer, Fallbacks), NAR-12 erledigt (Orchestrierung in Tick und WorldStore, Command→Fact-Kreis). NAR-13 bis NAR-17 erledigt; B1 erledigt. Verbindlich ist der Code.

### 1. Grundsatz

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

### 2. Guest und Visitor

| Begriff | Rolle | Lebensdauer |
|---|---|---|
| `Guest` | temporaere Besuchsinstanz mit Position, Laune, Geduld, Weg | ein Besuch |
| `Visitor` | persistente Figur mit Name, Persona, Besuchen, Erinnerungen | ueber Saves |

`Guest.visitorId` verbindet beide. Beim Rueckkehr-Spawn werden nur persistente
Eigenschaften (Name, Persona, Erinnerungswirkung) uebernommen; Beduerfnisse, Position,
Warteschlange und Besuchsstatus entstehen neu.

### 3. Datenvertrag (`src/core/sim/narrative/types.ts`)

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

### 4. Lebenszyklus und Idempotenz

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

### 5. Wirkung (belegt, nicht behauptet)

`narrative/disposition.ts` ist seit E2 die einzige Ableitung aus Persona-Basis,
hoechstens sechs Erinnerungen und der Kante `visitor -> player` bzw.
`player -> visitor`: `gameBias` (Faktor ±20 %), `serviceBias`/`socialBias`
(Schwellen ±8 Punkte), `returnBias` (Beziehungszuschlag ±10 Prozentpunkte).
`memoryEffect()` bleibt duenne Fassade ueber `scoreMemories()` und liest weiter
nur gespeicherte Daten, ohne PRNG:

- gute Erinnerung: `+4` Rueckkehr-Prozent und `+6` Laune je Gewicht,
- schlechte Erinnerung: `-6` und `-4`,
- die letzte Erinnerung zaehlt doppelt; Bonus gedeckelt auf `[-12, +12]` bzw. `[-8, +10]`.

`returnChance()` addiert Rueckkehr-Bonus und Beziehungszuschlag, `offerScore()`
multipliziert den begrenzten Spielfaktor, `chooseActivity()` verschiebt nur die
sozialen Drink- und Sofa-Schwellen; Toilette, Geld, Platz und Geraetezustand
bleiben harte Regeln. `spawnGuest()` addiert den Laune-Bonus Damit aendert sich messbar, wer wiederkommt und wie er ankommt;
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

### 6. Start-Pool

`seedStartPool(world, capital)` legt beim neuen Spiel drei bekannte Figuren an
(`Rita Kern`, `Boris Falk`, `Mira Sol`) und bucht das Startkapital als `START_POOL`-Fact.
Der Aufruf ist idempotent und laeuft nur im Store-Pfad fuer neue Spiele, nicht in
`createWorld()`; alte Saves behalten ihre Besucherliste. Der Start-Pool wirkt ab Tick 0:
Die deterministische Rueckkehrer-Auswahl kann sofort eine dieser Figuren treffen.

### 7. Content-Registry und Klassifizierung (NAR-09)

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

### 8. Runtime Composer (NAR-11)

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
- `fallbacks` nennt die betroffenen Slot-IDs, und `degraded` ist genau dann wahr,
  wenn mindestens ein Slot Fallback ist; `issues` traegt dieselben IDs als Satz.
  Nur wenn alle Slots Fallback sind, setzt der View die Szene einmal ohne
  Persona-Einschraenkung zusammen. `NarrativeEventView.fallbackSlots` reicht die
  Liste unveraendert an die UI, die jeden Slot beim Namen nennt, statt von
  "Sicherheitscopy" im Ganzen zu sprechen.
- `narrative-coverage.test.ts` setzt jedes Template aus `EVENT_TEMPLATES` mit
  seinen Slot-Zwecken und Pflicht-Flags zusammen und verlangt fuer `TITLE`,
  `BODY` und jedes angebotene Choice-Label ein Fragment ohne Fallback.
  `OUTCOME` bleibt bewusst aussen vor: Nachwirkungstexte sind der naechste
  Content-Batch. Ein Batch ist ein Arbeitsschritt, aber jede Contribution traegt
  ihre eigene Turn-ID; das Manifest registriert jeden Turn einzeln.
- `isNarrativeFragment` prueft die generierte Registry auch zur Laufzeit;
  ungueltige Fragmente und Direktiven werden uebersprungen und im Ergebnis
  gemeldet. Direktiven werden nur weitergereicht, nie ausgefuehrt.
- `registry.generated.ts` wird vom NAR-10-Compiler aus den validierten
  Beitraegen erzeugt; `scripts/verify-assets.mjs` prueft JSON und TypeScript
  byte-genau.

### 9. Trigger-Vertrag (NAR-05)

`narrative/trigger-types.ts` beschreibt den deklarativen Vertrag; `trigger-context.ts`
baut aus Welt, Ledger und aktuellem Fact einen unveraenderlichen Snapshot. Enthalten sind
aktueller Fact plus `recent`-Historie, Tick/Tag, Flags, gerichtete Beziehungen,
Visitor-Profile, Hauskonto/Band, Charisma, Ruf, Nachfragestufe, bediente Gaeste und
Geraeteschaden. `actorRefsOfFact()` loest alte `visitorId`-Facts und neue
`actorRefs`-Facts auf dieselbe Akteursliste.

`trigger-evaluate.ts` ist rein: `all`/`any`/`not`, Fact-Typ, Besuchererinnerung,
Hauskonto-Grenzen/Band, Geraeteschaden, Charisma, Ruf, Nachfragestufe, bediente Gaeste,
Flags (Wert/Anwesenheit/Abwesenheit), Zeitfenster, `recent-fact`, Akteur/Rolle,
Rivalenaktion (`rival-action` mit nicht-leerer Aktionsliste) und
Beziehungen (Trust/Sympathie/Konflikt/Einfluss). `evaluateTrigger()` liefert Match plus
Begruendungen; `evaluateTriggerDefinition()` ergaenzt `triggerId`, `factId` und
aufgeloeste Teilnehmer. Fehlende Beziehungen oder Besucherprofile sind ein
Nicht-Match, kein Fehler.

`trigger-schema.ts` validiert rekursiv und fail-closed: unbekannte Operatoren,
ungueltige Fact-Arten/ActorRefs, unbekannte oder doppelte Rivalenaktionen, Selbstkanten, negative oder unsichere Schwellen,
ungueltige Band/Stufe/Rolle/Dimension und leere `all`/`any`-Listen werden verworfen;
Tiefe 12 und 64 Knoten sind die Grenze. Der Evaluator veraendert weder Welt noch
Ledger, zieht keinen PRNG und ruft kein Netzwerk/LLM. Seit NAR-12 ruft `narrative/runtime.ts` den
Evaluator pro drainiertem Fact auf; Cooldowns bleiben Sache des Schedulers.

### 10. Event-Scheduler und Lifecycle (NAR-06)

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
verschwundenem Visitor-/Personal-Endpunkt ab. Seit D3 gilt ausdruecklich: Es gibt
keine globale Timeout-Strafe. `EXPIRED` ist nur ein Statuswechsel mit `DEADLINE`;
Fristablauf aendert weder Flags noch Beziehungen noch Ledger-Zeilen und emittiert
keinen Fact. Timeout-Effekte entstehen nur als expliziter Choice-Vertrag, falls
sie spaeter noetig werden. `processNarrativeBoundaryDetailed()` ruft
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

#### Event-Templates und Choices (NAR-07)

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

#### Commands und Allowlist (NAR-08)

`narrative/commands/parse-directives.ts` uebersetzt begrenzte `€...`-Direktiven in ein
AST aus Command-ID, positionalen und benannten Argumenten. Laenge, Anzahl, Quotes,
doppelte Schluessel und unbekannte Formen werden fail-closed verworfen; Text wird nie
als Code interpretiert. `registry.ts` ist die Allowlist der Command-IDs und Parameter:
`SET_FLAG`, `ADJUST_RELATIONSHIP`, `FREEZE_TICK`, `TRIGGER_DIALOG` und `COUNTER_RIVAL`. Jede Spec traegt
Familie, Handler-Vertrag und ein `executable`-Flag. `TRIGGER_DIALOG` ist parsebar, aber
bis zur UI-Anbindung nicht ausfuehrbar.

`validate.ts` kompiliert nur Registry-Treffer mit gueltigen Argumenten; ein Batch wird
vollstaendig verworfen, sobald eine Direktive scheitert oder nicht in der uebergebenen
Template-/Choice-Allowlist steht. `commandsForChoice()` uebersetzt die deklarierten
Choice-Effekte in dieselbe typisierte Form. `preflight.ts` prueft zusaetzlich Event-
Lifecycle, Frist, Requirements, Kosten, persistierten Choice-Satz und alle Zielakteure;
`COUNTER_RIVAL` verlangt einen existierenden `rival:`-Ref, unbekannte Rivalen werden
als `INVALID_TARGET` abgewiesen.
`execute.ts` ist der einzige Schreibpfad: Es aktiviert ein `OFFERED`-Event, bucht
VaCoin-Kosten ueber das bestehende Ledger gegen `EXTERNAL_WORLD`, wendet die Handler an
und setzt `RESOLVED` mit der `outcomeId`. `COUNTER_RIVAL` setzt als einziger
Domaenen-Schreibpfad `counteredUntilTick = max(alt, tick + 900)`; die Politik
liefert fuer diesen Rivalen bis dahin null. Ein zweiter Klick scheitert am Status und
veraendert weder Flags noch Beziehungen noch Ledger. Abgelehnte Direktiven oder Choices
erzeugen den begrenzten Diagnose-Fact `COMMAND_REJECTED`.

### 11. Makros (Semantik, nicht geraten)

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

### 12. Nicht-Ziele

- Kein LLM, Modell-Provider oder Netzwerk-Textaufruf im Spiel, auch nicht ausserhalb des Ticks. Agenten koennen Content bei der Repository-Arbeit erstellen; die Laufzeit nutzt ausschliesslich lokale validierte Daten.
- Keine Ausfuehrung von Code aus Texten; Commands sind deklarativ und allowlisted.
- Kein Journal als Fact-Bus, keine zweite Event-Wahrheit neben den persistenten Event-Instanzen.
- Keine Wanduhr und kein `Math.random` in Narrativ-Code (ESLint blockt beides).
- Keine unbegrenzten Pools: Facts, Historie, Erinnerungen und Events sind gedeckelt.

### 13. Persistenz

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

### 14. Orchestrierung in Tick und WorldStore (NAR-12)

`narrative/runtime.ts` ist die einzige Bruecke von Facts zu Events. Ein Lauf ist
nicht rekursiv: `processNarrativeRuntime()` drainiert den Boundary hoechstens einmal,
wertet fuer jeden drainierten Fact die Definitionen aus `events/trigger-definitions.ts`
aus und sammelt Kandidaten. Nur Facts mit Template duerfen einen Event ausloesen;
Diagnose- und Ledger-Facts bleiben wirkungslos. Seit C1 haelt
`narrative-trigger-template-contract.test.ts` diesen Vertrag fest: jede Definition
findet mindestens ein Template, jedes Fact-Template genau eine Definition.
Geraete-, Lager- und Personal-Facts haben bewusst keine Fact-Kinds und bleiben
dokumentiert offen. `scheduleCandidates()` plant hoechstens
drei neue Instanzen pro Lauf und verhindert Live-Duplikate und Cooldowns wie bisher.
Facts aus Choice-Effekten entstehen erst nach dem Drain und werden im naechsten Lauf
verarbeitet. Seit D1 loest die Runtime `EVENT_RESOLVED` zusaetzlich als Kette auf:
Vorgaenger, Template und Choice werden zentral und fail-closed geprueft, die
`followUpEventId` der Choice laedt das Folgetemplate, und `createEventCandidate`
erhaelt die Vorgaenger-Teilnehmer mit `chainFromEventId`. Der Scheduler prueft
Cooldown, Limits, Kettenherkunft und RESOLVED-Status zentral; es gibt keine
Rekursion, der zweite Lauf dupliziert nichts.

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

### 14a. Szenen-Kontext (B1)

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

### 15. Nachfrageveranstaltungen (NAR-13)

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

### NAR-15: Autonome Rivalen

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
  Rivale → Haus an; der Trigger `rival-action` uebersetzt nur TRADE_INFO,
  PRICE_MOVE, POACH_VISITOR und SABOTAGE in `RIVAL_MOVE` (Choice
  `CONFRONT_RIVAL` oder `WATCH_THE_MOVE`). PROBE bleibt ein Indiz ohne Szene.
- **Sabotage mit Indizien statt Zufallsmalus**: Ziel ist das beste unbeschaedigte
  Geraet (Gleichstand: kleinste ID), der Schaden ist fest (12), und jeder Versuch
  schreibt einen `RivalEvidence`-Eintrag mit Tick, Tag, Geraet, Blockade und Notiz.
  Ein Guard im Dienst verhindert den Schaden, nicht das Indiz.
- **Gegenmassnahmen**: Guard verhindert Schaden, Reparatur stellt das Geraet wieder
  her, `CONFRONT_RIVAL` verschaerft den Konflikt bewusst, `WATCH_THE_MOVE` merkt
  sich den Zug. Wer die Indizien liest, kennt Taeter, Ziel und Tick.
- **Save v10**: `WorldState.rivals` liegt im Save; `SavedGame` akzeptiert v5–v10,
  `normalizeRivalMinds` fuellt fehlende Rivalen mit dem neutralen Startzustand auf.
- **Phase 5**: `narrative/rival-context.ts` liefert je Rivale eine Karte ins
  Anzeigemodell - Haltung, Kapazitaet, Wohlwollen, Gegenmassnahmen-Fenster
  (`counteredUntilTick`), naechster Zug, Historie (6) und Indizien (4) - rein
  aus den Minds, ohne zweiten Zustand und ohne NAR-14-17-Duplikate; `view.ts`
  bleibt durch den Helper unter 200 Zeilen.

### NAR-16: Langzeitintegration und Messungen

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

### 17. Agenten-Contributions: Workflow und Fehlerfaelle

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

### 18. Social-Plugin (Zielbild)

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
`docs/ROADMAP.md`: Das Casino ist Startpunkt und Testumgebung, die Stadt ist das
Ziel.
