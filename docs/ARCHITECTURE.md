# Architektur und Governance

## Zustandsbesitz

- `src/store/world-store.ts` ist der einzige Besitzer von Welt, Ledger, PRNG und Save.
- `src/core/` bleibt headless: Simulation, Geld und Spiele kennen weder DOM noch Pixi.
- `src/render/` liest ausschließlich `GameView`-Snapshots; dort liegt kein Spielzustand.
- `src/ui/` liest denselben Snapshot und sendet nur Commands an den Store.
- Geld existiert nur als Ledger-Buchung; VaCoins sind ganzzahlige Mikro-Einheiten.
- Fiat eines Gastes liegt ab dem Spawn auf `FIAT_<id>`, Chips auf `VISITOR_<id>`, offene Gewinne auf `PENDING_<id>`. Ein fehlgeschlagener Transfer lässt Gast und Guthaben stehen.
- Auszahlungen werden nie gekappt: Das Hauskonto zahlt, so weit es reicht; der Rest wird als Verbindlichkeit auf `HAUS_SCHULDEN` gebucht (`openLiability`). Die Summe aller Konten bleibt null.
- Der Umbau läuft über `src/core/sim/remodel.ts`: erst Deckung prüfen, dann alle Gastansprüche buchen, dann Geld buchen und das Haus tauschen.
- Der Save ist v8. `replaySave` hebt v5-, v6- und v7-Stände an, behält Fiat, offene Gewinne, Journal und Look und setzt den PRNG an der gespeicherten Stelle fort.
- Zufall ist seedbar und läuft ausschließlich über `src/core/rng/`: `weighted.ts` zieht Zahlen aus einer Gewichtsverteilung, die ihre eigenen Chancen mitliefert (Bias ≤ 9.000 bps, Deadzones, nie 100 %); `shoe.ts` zieht Karten ohne Zurücklegen und mischt erst den leeren Schuh neu. Es gibt kein `Math.random()` im Spielpfad.
- Physik liegt in `src/core/physics/`: `body.ts` beschreibt Koerper (Position, Geschwindigkeit, Rotation, Winkelgeschwindigkeit, Masse, Traegheit, Reibung, Restitution, Form), `world.ts` simuliert mit festem Zeitschritt und aufgeloesten Impulsen. Kollisionen erzeugen ueber die Tangentialreibung echtes Drehmoment. Statische Koerper koennen rotieren und uebertragen ihre Oberflaechengeschwindigkeit; `trigger`-Zonen sind nicht solide und werden ueber `triggerHits` gelesen. Die Welt kennt weder Pixi noch DOM, und die Breitphase ist allokationsfrei.
- Plinko ist kein Wuerfel mehr: `src/core/games/plinko-board.ts` baut das Board aus echten Pegs, Waenden und Deflektoren. Zufall steckt nur in der Startbedingung; welches Fach der Ball trifft, entscheiden danach ausschliesslich Kollisionen. Die Paytable ist auf die gemessene Fachverteilung geeicht.
- Jedes Spiel hat seine eigene Engine unter `src/core/games/engines/`: `slot.ts` (5x3, zehn Linien, gewichtete Symbole, BOOK als Wild und Scatter, Freispiele), `cards.ts` (Blackjack mit Ziehen/Verdoppeln und Dealer-Regel, Video Poker mit Hold/Draw und Paytable als Daten), `table.ts` (Roulette mit voller Wettfläche, zwei Würfel, Hütchenspiel mit Serie). `round.ts` ist nur noch der Dispatcher auf diese Engines.
- Spiele haben genau eine Naht: `src/core/games/contracts.ts`. `playAction({ game, stake, houseEdgeBps?, bonusBps? })` prüft die Aktion **vor** der Ziehung, spielt die Runde und liefert `{ game, stake, payout, multiplierBps, label, detail }`. `payout` ist immer `mulVC(stake, multiplierBps)`, ein Verlust bleibt 0, Bonus und Hausvorteil greifen nur auf Gewinne. `round.ts` ist nur noch die Engine dahinter: `playRound` hat außerhalb dieses Vertrags keinen Produktions-Aufrufer mehr. Verbraucher sind der Gast-Spin (`guest-play`), der freie Testspin und das Fremdspiel (`actions`).
- Der PRNG-Zustand (`prngState`) liegt im Save. `replaySave` zieht selbst nichts, deshalb setzt die Folge nach dem Laden exakt an der gespeicherten Stelle fort.
- `world.journal` ist ein typisiertes Ringpuffer-Ereignisprotokoll (maximal 240 Einträge). `settleMoneyJournal` kopiert jede neue Ledger-Zeile genau einmal als `MONEY`-Event; Geld bleibt ausschließlich im Ledger. Welt-Ereignisse tragen `cause` und `effect`.
- `world.look` ist rein kosmetisch: Haut, Haare, Outfit und Accessoire. Es gibt keine Gameplay-, Preis- oder Geldwirkung.
- Personalstatus (`task`, `blockedReason`) liegt am `StaffAgent`, nicht in der UI. Die Diagnose liest ihn nur.
- Jede Datei traegt genau eine Zustaendigkeit und bekommt ihr Budget samt eigener Hot Zone aus `scripts/loc-budgets.mjs` (Legacy 350/200). Registries und State Machines sind Knoten mit genau einer Wahrheit, keine gespiegelten Zustandskopien. Schreibpfade laufen serialisiert ueber den Store, Engines bleiben reine Funktionen.

## Fehler-Governance

1. Jede Fehlermeldung hat das Format `[IDX-XXXX] [ERR-YYYY] Komponente: Klartext`.
2. Neue Fehlerarten werden zuerst in `docs/ERROR_CATALOG.md` und `src/core/governance/error-codes.ts` registriert.
3. `ERR-0000` ist ein unbekannter Fehler und blockiert den Build sofort (Fail-Closed).
4. `ERR-0911` kennzeichnet automatisch reparierbare Verstöße. `scripts/run-pipeline.mjs` führt `npm run autofix:0911` vor den harten Gates aus.
5. Jede Testdatei deklariert `@test-target` und `@error-code`; der Reporter `src/core/governance/test-harness.ts` gibt jeden Testfall indiziert aus.
6. Tests laufen im Thread-Pool (`pool: 'threads'`) mit harter Teardown-Grenze. Worker sind Threads im Runner-Prozess und sterben mit ihm, es bleiben also keine verwaisten Testprozesse zurueck; `testTimeout` und `teardownTimeout` beenden haengende Tests. Die sieben RTP-Monte-Carlo-Laeufe sind parallelisiert, ziehen pro Lauf frische Seeds und sind an die Tail-Verteilung angepasst: SLOT 200.000, POKER 400.000, PLINKO 5.000 Runden. Feste Seed-Literale lehnt `verify-test-quality` ab; die Seeds sind nicht per Env oder CLI waehlbar. Die Paytables sind auf ~93 % RTP kalibriert, damit das 90–96-%-Band auch mit frischen Seeds nicht zufaellig kippt.

## Pipeline

Ein fehlgeschlagenes Autofix zählt als rotes Gate und beendet die Pipeline mit Nicht-Null-Exit.

`npm run verify:all` führt in dieser Reihenfolge aus:

1. `autofix:0911` (ESLint-Fix und Dependency-Matrix; ein unfixbarer Rest ist rot)
2. LOC-Guard (`ERR-4012`)
3. TypeScript (`ERR-1005`)
4. Testqualität und Determinismus (`ERR-1001`, `ERR-4001`, `ERR-4002`, `ERR-3001`)
5. Tote Exporte (`ERR-4003`)
6. `npm audit --audit-level=low` (`ERR-4004`)
7. Vitest mit indizierten Testfällen
8. Production-Build (`ERR-1005`)

## Dependency-Begründungen

Jede Laufzeit- und Entwicklungabhängigkeit braucht eine nicht-leere Begründung und mindestens eine reale Nutzung. Die folgende Matrix wird von `scripts/sync-dependency-matrix.mjs` aus `package.json` und den echten Imports erzeugt.

<!-- DEP_MATRIX_START -->
| Paket | Version | Kategorie | Architektur-Begründung | Real genutzte Dateien (Anzahl & Pfade) |
| --- | --- | --- | --- | --- |
| @eslint/js | ^10.0.1 | Lint | Empfohlene ESLint-Basisregeln. | 1: `eslint.config.mjs` |
| @testing-library/react | ^16.3.3 | Test | Rendert HUD und Popups fuer Integrations- und Fokustests in jsdom. | 2: `src/ui/__tests__/card-tables.test.tsx`<br>`src/ui/__tests__/ui.test.tsx` |
| @types/node | ^26.6.6 | Typen | Typen fuer Node-Builtins in Gate-Skripten und Vitest-Reporter. | 21: `scripts/autofix-0911.mjs`<br>`scripts/bench-lowend.mjs`<br>`scripts/check-loc.mjs`<br>`scripts/ci-bump-version.mjs`<br>`scripts/lib/gate-cache.mjs`<br>`scripts/lib/gate-runner.mjs`<br>… (+15) |
| @types/react | ^19.0.7 | Typen | Typpaket fuer die React-19-API; wird implizit von React-Imports genutzt. | 27: `src/App.tsx`<br>`src/main.tsx`<br>`src/render/floor-stage.tsx`<br>`src/render/games/blackjack-stage.tsx`<br>`src/render/games/dice-stage.tsx`<br>`src/render/games/plinko-stage.tsx`<br>… (+21) |
| @types/react-dom | ^19.0.3 | Typen | Typpaket fuer React-DOM; wird implizit von react-dom-Imports genutzt. | 1: `src/main.tsx` |
| @vitejs/plugin-react | ^4.3.4 | Build | React-19-JSX-Transform und Fast Refresh fuer Vite. | 1: `vite.config.ts` |
| eslint | ^10.13.0 | Lint | Fail-Closed-Lint-Gate mit TypeScript-Parser und ungenutzten Symbolen. | 2: `eslint.config.mjs`<br>`package.json` |
| globals | ^16.5.0 | Lint | Browser- und Node-Globals fuer die ESLint-Konfiguration. | 1: `eslint.config.mjs` |
| jsdom | ^30.1.3 | Test | DOM-Umgebung fuer UI-, Fokus- und Tastaturtests ohne echten Browser. | 5: `package.json`<br>`scripts/sync-dependency-matrix.mjs`<br>`src/render/games/slot-stage.tsx`<br>`src/ui/__tests__/card-tables.test.tsx`<br>`src/ui/__tests__/ui.test.tsx` |
| pixi.js | ^8.6.6 | Runtime | WebGL/Canvas-Renderer fuer Floor, Figuren, Sticker und Spiele; kein DOM-Rendering im Spielfeld. | 31: `src/render/comic-bubbles.ts`<br>`src/render/floor-camera.ts`<br>`src/render/floor-perf.bench.ts`<br>`src/render/floor-props.ts`<br>`src/render/floor-route.ts`<br>`src/render/floor-stage.tsx`<br>… (+25) |
| react | ^19.0.0 | UI | Deklarative HUD-, Popup- und Panel-Oberflaeche mit einem Store-Snapshot. | 27: `src/App.tsx`<br>`src/main.tsx`<br>`src/render/floor-stage.tsx`<br>`src/render/games/blackjack-stage.tsx`<br>`src/render/games/dice-stage.tsx`<br>`src/render/games/plinko-stage.tsx`<br>… (+21) |
| react-dom | ^19.0.0 | UI | Mountet die React-Oberflaeche in den Browser. | 1: `src/main.tsx` |
| typescript | ^5.7.3 | Build | Strikte Typpruefung mit noUncheckedIndexedAccess und ungenutzten Symbolen. | 1: `tsconfig.json` |
| typescript-eslint | ^8.72.1 | Lint | TypeScript-Parser und Regeln fuer das Lint-Gate. | 1: `eslint.config.mjs` |
| vite | ^6.0.7 | Build | Dev-Server und Production-Bundler; liefert die Modul- und CSS-Pipeline. | 1: `package.json` |
| vitest | ^5.0.5 | Test | Deterministische Unit- und Monte-Carlo-Beweise fuer Ledger, Spiele und Simulation. | 63: `package.json`<br>`src/core/economy/__tests__/economy.test.ts`<br>`src/core/economy/__tests__/ledger-checkpoint.test.ts`<br>`src/core/economy/__tests__/ledger-diagnose.test.ts`<br>`src/core/games/__tests__/contracts.test.ts`<br>`src/core/games/__tests__/dice-bets.test.ts`<br>… (+57) |
<!-- DEP_MATRIX_END -->

## Delivery-Regel

**Nach jedem abgeschlossenen Arbeits-Turn wird auf `main` geliefert.** Der verbindliche Weg ist:

```bash
npm run turn:finish
```

`turn:finish` führt Autofix und `verify:all` aus, erzeugt bei Änderungen einen Commit im deutschen Steam-Developer-Notes-Format (ohne Drittanbieter-Trailer) und pusht auf `main`. Gestaged werden nur die übergebenen Pfade; ohne Argumente ausschließlich bereits verfolgte Änderungen, damit kein fremder oder unverfolgter Inhalt mitgeht. Ein fehlgeschlagenes Gate verhindert Commit und Push. Lehnt der Branch-Schutz den Direktpush ab, wird der Arbeitsbranch gepusht und ein fokussierter PR gegen `main` nötig.

Der Geschwindigkeits-Benchmark läuft separat über `npm run test:perf` und ist absichtlich nicht Teil von `verify:all`: Er misst Durchsatz und ist kein Korrektheitsgate.

## Floor-Rendering und Performance

Der Boden liegt in 30×30-Regions-Chunks (`src/render/scene-cache.ts`); ein Chunk backt nur neu, wenn sich sein Regions-Hash (`src/render/floor-math.ts`) ändert. Möbel stehen auf einer eigenen Ebene und backen den Boden nicht neu. Dreck wird pro Region invalidiert. Kamera, LOD, Culling und Koordinaten sind reine Mathe und getestet (`src/render/__tests__/floor-cache.test.ts`). Agenten, Kisten, Dispute und Platzierungs-Geist laufen auf der Requisiten-Ebene (`src/render/floor-props.ts`).

Messung vom 30.10.2026 auf der Cloud-VM, für das Low-End-Profil mit `taskset -c 0` auf einen Kern gepinnt (Emulation, keine echte schwache Hardware): 9 Regions-Hashes 0,0008 ms, Neuzeichnen aller 9 Boden-Chunks 1,1685 ms (nur bei Template-/Teppichwechsel), Dreck in 9 Regionen mit 500 Tiles 0,8068 ms, Culling über 200 Entities 0,0026 ms. Dazu: 200 Rig-Posen 0,0128 ms, Snapshot mit 200 Gästen und 5.000 Buchungen 0,1047 ms, vollständige Ledger-Prüfung über 5.201 Buchungen 0,0042 ms. 1.000 Ticks messen 949,9 ms; der Save bleibt bei 115,2 KiB. Das Heap-Delta ist wegen GC nicht belastbar und wird nur als Rohwert geloggt. Steady-State pro Tick: Hash + Culling, keine Neuzeichnung.

Die Messungen nutzen eine explizite Hilfe (`src/test/measure.ts`) mit einem Warmup und festen 5–20 Läufen statt der Tinybench-Stichprobe. PLINKO wird im Runden-Benchmark mit 500 Drops pro Operation gemessen; 20.000 Physik-Drops pro Operation waren der Grund für den alten Mehrminuten-Lauf. Der gesamte `test:perf`-Lauf bleibt damit im Bereich weniger Sekunden bis unter einer Minute. Die Zahlen schwanken mit CPU-Last und JIT; sie sind Indikatoren, kein Gate. Echte Geräte und ein echter Browser bleiben eine manuelle Abnahme.

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

- `soak.test.ts` läuft standardmäßig 3.000 Ticks und prüft alle 250 Ticks Ledger, Puffer, Gästezahl und Strafen. Der Seed ist frisch und nicht wählbar; `npm run soak` setzt nur die Tickzahl auf 100.000 für den langen Lauf.
- `save-roundtrip.test.ts` vergleicht zwei geladene Stände nach 120 weiteren Ticks inklusive Snapshot; der Save enthält Journal und Look.
- `memory.bench.ts` misst Heap-Delta und Save-Bytes; `rig.bench.ts` misst Posen und Zustandsabbildung. Beide sind Benchmarks, keine Korrektheitsgates.
- `bench:lowend` pinnt den Benchmark auf einen Kern. Das ist eine Emulation, kein Nachweis auf echter schwacher Hardware; die manuelle Gerätematrix bleibt offen.
