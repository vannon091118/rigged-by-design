# Rigged by Design

<!-- rbd-doc: v0.3.152 | 2026-11-07 03:40 UTC -->
<!-- rtk-instructions v2 -->
# Command output

Command output here is condensed to save tokens, keeping every signal and
dropping costly noise. Treat it as the complete result: run commands
normally, and batch related commands into one call to avoid extra turns.
Truncated results state their recovery path in their own output. Re-run a
command as `rtk bypass <cmd>` only when its result is unusable: empty when
output was clearly expected, contradicting its exit code, or garbled.

Primaer ist `pnpm run agent:context` (verdichtet: `--line`); es ersetzt die
Bestandsaufnahme aus Git, Importgraph, Katalog und Doku. Werkzeuge laufen
ueber rtk: `rtk ls`, `rtk find`, `rtk read`, `rtk rg`, `rtk git`, `rtk pnpm`.
Kein `ls`/`cat`/`grep`/`find` am Proxy vorbei, kein Wegwerf-Skript.
<!-- /rtk-instructions -->

Vite + React 19 + TypeScript + PixiJS 8 life simulation. The casino is the start and test venue, not the genre (`docs/ROADMAP.md`); the core stays venue-agnostic so other places (pub, shop, flat, city) reuse world, ledger, facts and events. No real money; VaCoins are integer micro-units (1 VC = 10.000). Simulation is headless in `src/core/`; `world-store` owns world, ledger, PRNG, clock, save.

## Dev environment

- Node 22, pnpm. `pnpm install --frozen-lockfile` then `pnpm run dev` (http://localhost:3000).
- Werkzeug-Configs liegen gesammelt in `src/Config/` (`tsconfig.json`, `vite.config.ts`, `eslint.config.mjs`, `capacitor.config.json`, `opencode.json`). Die pnpm-Skripte binden sie explizit (`--config`, `-p`); pnpm-spezifische Dependency-Overrides liegen in `package.json` unter `pnpm.overrides`. `prepare-android` legt die Capacitor-Kopie nur waehrend des Laufs in die Wurzel, und `.mailmap` bleibt als Git-Sonderfall in der Wurzel — Git liest sie nur dort.
- Save format v11 (world + layout + journal + look + narrative + rivals); v5–v10 migrate (keep Fiat, open payouts, journal, look, visitor memories, rival state; v5–v10 derive the layout from their template), v3/v4 discarded.

## Build & test

- `pnpm run test` — Vitest run (CI alias `test:ci`).
- `pnpm run test:affected` — nur Tests aus deklariertem Ziel, dem transitiven Importgraphen und dem betroffenen Subsystem, und nur die schnellen Beweisklassen. Statistik- und Messnachweise (RTP, Poker-Verteilung, Soak, Benchmarks) überspringt er und nennt sie; Entwicklungsfeedback, kein Ersatz für `verify:all`. Jede JSON-Änderung unter `content/narrative/**` wählt ausschließlich `src/core/governance/__tests__/narrative-content.test.ts` und gilt als Codeänderung.
- `pnpm run agent:context [--json]` — ein Aufruf für den Arbeitskontext: Änderungen, Systeme, Invarianten, betroffene Tests, Gate-Plan, Doku-Bezüge und Cache-Stand. Reine Anzeige, keine Prüfung, keine zweite Analyse.
- `pnpm run agent:verify [--profile=quick|full|release] [--ci] [--json]` — derselbe Impact-Plan, Gates über `runGates` mit Cache, ein Bericht unter `.verify-cache/reports/<Zeit>/agent-summary.json`. Bei Impact-Auswahl laufen nur betroffene Tests und der Bericht sagt `partial`; `--ci` delegiert die langen Nachweise an Actions und wartet darauf. Kein Ersatz für `verify:all`.
- `pnpm run typecheck` — `tsc --noEmit`.
- `pnpm run lint` / `lint:fix` — ESLint.
- `pnpm run check:loc` — LOC guard (Budget und Hot Zone pro Zuständigkeit in `scripts/loc-budgets.mjs`; Legacy 350/200 nur für gelistete Dateien, keine neuen `// @loc-exception:`).
- `pnpm run verify:all` — fail-closed pipeline, **rein lesend** (Lint, LOC, typecheck, Testvertrag, Dead-Export, Doku-Gate, Tree-Gate, Redundanz-Gate, Asset-Manifest, vitest, audit, build — zwölf Gates). Jedes Gate legt sein vollständiges Log und eine `summary.md` unter `.verify-cache/reports/<Zeitstempel>/` ab; die Konsole zeigt eine Zeile je Gate und im Fehlerfall dessen Ende (`RBD_VERIFY_VERBOSE=1` gibt alles aus). Kein Gate schreibt Dateien; ein veralteter Baum wird rot, statt sich selbst zu reparieren. Die unabhängigen Gates laufen parallel, grüne Gates werden per Inhalts-Hash aus `.verify-cache/` wiederverwendet (`RBD_VERIFY_NO_CACHE=1` erzwingt alles neu). Jedes Gate hat ein hartes Zeitlimit (`ERR-4014`); nach Ablauf wird der Prozessbaum beendet. Beim Start sterben verwaiste Gate-Prozesse abgebrochener Läufe, SIGINT/SIGTERM nimmt laufende Gates mit; beendet wird ausschließlich PID-genau über `taskkill /T` bzw. die Prozessgruppe, nie über Namensmuster, und nur wenn PID **und** Startzeit noch zum Registry-Eintrag passen.
- `pnpm run verify` / `pnpm run verify:quick` — identisch und rein lesend: Lint, LOC, Typecheck, Testvertrag, Dead-Export, Doku-Gate, Tree-Gate, Redundanz-Gate, Asset-Manifest und die schnelle Hälfte der Suite. **Kein Build, kein Audit und keine RTP-, Balance- und Soak-Nachweise** — deshalb nie als Ersatz vor einem Commit.
- `pnpm run catalog` — schreibt `docs/INVENTORY.md` (System aus `@test-target`, Beweisklasse aus der Rolle der Datei). Kein Gate mehr: der Pre-Commit-Hook ruft es auf. `--check` bleibt für manuelle Läufe (`ERR-4015`).
- `pnpm run docs:sync` — setzt Version und UTC-Zeitstempel als `rbd-doc`-Marker in die sechs Pflichtdokumente; `--staged` stagt sie. `pnpm run verify:docs` ist das Doku-Gate (Marker, Pflichtabschnitte, flacher Wurzelbaum, Inventar-Abdeckung gegen `git ls-files`, `ERR-4017`).
- `pnpm run docs:stub -- "Titel"` — legt Changelog-Zeile, Devtagebuch-Eintrag und Inventar-Logzeile mit Datum, Version und Uhrzeit an (`ERR-4021`); Inhalte bleiben Platzhalter für den Agenten.
- `pnpm run inventory:build` — schreibt Abschnitt 18 in `docs/INVENTORY.md`: eine Zeile je Pfad aus `git ls-files`, ein Eintrag je Ordner, Text gelesen, Binärsignaturen geprüft. Der Pre-Commit-Hook ruft ihn vor dem Marker; `verify:docs` wird rot, sobald eine Datei, ein Ordner oder die Abdeckungszahl fehlt.
- `pnpm run verify:tree` — Tree-Gate (`ERR-4019`): Wurzel-Whitelist, erlaubte Endungen je Ordner, Tests nur in `__tests__`, Core ohne Browser-Importe und ohne Importe nach außen.
- `pnpm run verify:redundancy` — Redundanz-Gate (`ERR-4020`): byte-identische Quelldateien, doppelte pnpm-Kommandos, doppelt eingetragene Fehlercodes.
- `pnpm run hooks:install` — aktiviert `.githooks` als `core.hooksPath` (`ERR-4018`). Der Pre-Commit-Hook schreibt Matrix, Katalog und Doku-Marker und prüft danach Doku und LOC. Inventur, Doku-Marker, Doku-Gate und LOC laufen auch ohne `node_modules`; nur Matrix und Testkatalog brauchen die Abhängigkeiten.
- `pnpm run escalation:plan` — nennt zu einem Befund die Eskalationsstufe (`AUTO_FIX → LOCAL_GATE → REMOTE_CI → AGENT → BLOCKED`); ohne Argument liest er die letzte Gate-Zusammenfassung.
- `pnpm run pr:lift` — hebt den Commit-Body in den PR-Body; CI nutzt dasselbe Skript in `pr-escalation.yml`. Ohne `gh` gibt `node scripts/lift-commit-body.mjs --json` den Connector-Plan aus (`level`, `branch`, `base`, `title`, `bodyFile`, `body`); ein Agent mit GitHub-Connector legt damit den PR an oder aktualisiert den Body. Der Lauf bleibt gruen — Eskalation statt Fail-Closed.
- `pnpm run ci:long` — startet `long-checks.yml` in GitHub Actions für Statistik, Soak, Balance und Benchmarks, wartet auf das Ergebnis und lädt den Balance-Bericht als Artefakt. Bevorzugt `gh`, sonst die REST-API mit `GH_TOKEN`; ein roter Lauf meldet `ERR-4016`.
- `pnpm run branches:prune` — löscht lokal jeden nach `main` gemergten Branch außer `main` und dem aktuellen; offene, nicht gemergte Arbeit bleibt. `turn:finish` ruft das nach dem Push selbst auf, am Remote erledigt es `pr-cleanup.yml` nach jedem Merge; `--dry-run` zeigt die Kandidaten nur.
- `pnpm run fix` — der einzige schreibende Modus: ESLint `--fix`, Dependency-Matrix und Testkatalog, danach dieselben Gates samt Protokoll jeder geänderten und gelöschten Datei. Idempotent: ein zweiter Lauf meldet „keine Änderung, Arbeitsbaum unverändert“.
- `pnpm run verify:release` — Freigabelauf für APK und Versionssprung: identisch mit `verify:all`, erzwingt aber `pnpm audit` unabhängig von der Änderung; CI setzt zusätzlich `RBD_VERIFY_AUDIT=1`.
- `pnpm run test:perf` — feste Messläufe (not in verify:all). `pnpm run bench:lowend` pins the run to one core; `pnpm run soak` runs 100.000 ticks.
- UI tests run in jsdom via `@testing-library/react`; the include pattern covers `.test.tsx`.
- `pnpm run build` — Vite production build.
- `pnpm run assets:manifest` schreibt neben `manifest.json` auch die zwei deterministischen Atlasseiten unter `public/assets/casino/atlas/`; die Seiten sind eingecheckt, `verify:assets` prueft Frame-Abdeckung und Grenzen. Der Browser-laedt im Produktionspfad nur diese Seiten, nicht die 153 Einzeldateien.
- `pnpm run android:apk` braucht JDK 21 und Android SDK 36 (Build-Tools 36.0.0); ohne diese Werkzeuge bricht der Lauf bewusst mit `ERR-4014` ab.

## Delivery

- After a turn: `pnpm run turn:finish` (ohne Argumente) stagt global alle Änderungen (`git add -A`, respektiert `.gitignore`), läuft **`verify:quick`**, committet und pusht den Arbeitsbranch (Direktpush auf `main` ist gesperrt, siehe unten). Weil `verify` nur liest, laufen Reparaturen vorher separat über `pnpm run fix`. Pfade nur für einen bewusst verengten Commit: `pnpm run turn:finish -- <paths>`. Vor `verify` wird die Patch-Version gebumpt (`scripts/version-bump.mjs`), damit der Commit sie trägt; `.turn-notes.md` wird nach dem Commit gelöscht, und ein Titel, der HEAD wiederholt, bricht mit `ERR-4006` ab.
- **Quick ist der Normalfall, das volle Profil nur bei Bedarf.** `pnpm run turn:finish:full` nimmt denselben Weg mit `verify:all`. Voll ist Pflicht, wenn sich Abhängigkeiten ändern (`package.json`/`pnpm-lock.yaml` jenseits der Turn-Version), Geld-, Ledger-, RNG- oder Save-Migrationscode geändert wurde, ein Release, Tag oder APK entsteht (`verify:release`) oder CI auf demselben Stand schon rot war. Für UI, Text, Doku und Anzeige-Arbeit reicht quick.
- Der vollständige Beweis bleibt verpflichtend, nur nicht auf dem Rechner: jeder Push auf `main` läuft in CI durch `verify:all`; `Auto Version & Release` startet erst nach diesem erfolgreichen Lauf und wiederholt die Suite nicht. Quick verschiebt die Prüfung nach CI, er spart sie nicht ein.
- Tests laufen ausschließlich am Ende eines Turns: keine Zwischenläufe von pnpm run test, pnpm run test:ci oder pnpm run verify:all während der Arbeit. `verify:quick` darf mittendrin laufen — er ist Entwicklungsfeedback, keine Freigabe, und committet nichts.
- Optional vor dem Commit: `pnpm run turn:finish -- --affected` ruft zuerst `agent:context` (derselbe Impact-Plan, keine zweite Testausführung) und danach unverändert `verify:quick`; mit `turn:finish:full -- --affected` bleibt `verify:all` das volle Tor.
- Direkter Push auf `main` ist durch das Ruleset gesperrt. Der einzige Weg: Arbeitsbranch pushen, fokussierten PR gegen `main` öffnen und über das Gate promoten. `turn:finish` pusht daher nur den Arbeitsbranch; ein abgelehnter Direktpush auf `main` meldet `ERR-4023`. Der Merge-Commit wird von `verify-commit-msg --head` geprüft: exakte Sektionsüberschriften (`### Changes (Was ist neu)`, `### Technische Basis & Kausalität`, `### Ausblick (Nächste Schritte)`); ASCII-Varianten schlagen fehl. Den PR-Body als Merge-Text zu verwenden erfüllt das. Beim Merge über Connector oder REST-API gehört der PR-Body deshalb in `commit_message`; ein reiner Klicktitel macht `verify-commit-msg --head` auf `main` rot (`ERR-4006`) und stoppt `Bump, tag, release` sowie den APK-Bau.
- **Lokal vs. CI:** Lokal laufen `verify` (Quick) und `test:affected`. `verify:all` und `ci:long` laufen in CI (`ci-verify.yml`, `long-checks.yml`), auch wenn sie lokal manuell gestartet werden können.
- **Automatische Promotion:** `promote.yml` legt den PR an und mergt ihn, sobald `CI Verify` gruen ist; ein roter Lauf legt den Stand auf die permanente Branch `integration` (Label `integration/rot`), damit dort repariert wird. Zwei parallele rote Staende werden gemergt, nicht verworfen; ein Textkonflikt bekommt `integration/konflikt` und bleibt beim Agenten. Der Merge-Text wird aus dem Commit-Body gebaut und traegt die Pflichtsektionen, sonst waere `main` sofort rot. Verified-Badge nur mit `RBD_PROMOTE_AUTO_MERGE=1` und GitHub-seitigem Merge. Ein Merge mit `GITHUB_TOKEN` startet keinen Workflow: `promote` nutzt `PROMOTE_TOKEN`, wenn gesetzt, und stoesst sonst `Auto Version & Release` an — ohne diesen Anstoss gibt es weder CI auf `main` noch Tag und APK. `integration` ist geschuetzt und wird von `pr-cleanup` und `branches:prune` nicht geloescht.
- **Identitaet:** Jeder Commit traegt `Vannon <Schneider.felix1993@gmail.com>` aus `scripts/lib/identity.mjs`; `turn:finish` und `promote.yml` setzen sie selbst, `.mailmap` fuehrt die Werkzeug-Namen der History zusammen. Kein Runner und keine Sandbox aendert den Committer.

## Issue-Check vor Arbeitsbeginn (obligatorisch)

- **Vor Beginn jeder Arbeit:** Jeder Agent prüft zuerst GitHub Issues unter `https://github.com/vannon091118/rigged-by-design/issues`. Offene Issues mit dem Label `gate-failure` haben höchste Priorität und müssen **vollständig** gelöst werden, bevor neue Arbeit beginnt.
- **Erster Task jedes Agents:** `gh issue list --label gate-failure --state open` (oder GitHub-Web-UI). Ein offenes `gate-failure`-Issue ist der alleinige Fokus, bis es geschlossen ist.
- **Issue vollständig lösen:** Nicht halbherzig beheben — alle Gates müssen grün sein, bevor das Issue als `completed` geschlossen wird.
- **Gates nicht separat verfolgen:** Es wird kein separater Gate-Status verfolgt. Der nächste Task nach jeder Arbeit ist immer wieder der Issue-Check. Ein rotes Gate führt automatisch zu einem Issue (via `pr-watcher.yml`), das dann gelöst werden muss.

## PR+Merge-Pflicht nach jedem Abschluss

- **Nach jedem Turn / Phase / Slice / Arbeitsschritt:** Der einzige Weg nach `main` ist Arbeitsbranch, PR gegen `main` und Promotion über das Gate (`promote.yml`). Ein Direktpush auf `main` ist durch das Ruleset gesperrt; `turn:finish` pusht deshalb den Arbeitsbranch und meldet einen abgelehnten Direktpush als `ERR-4023`.
- Der PR-Body muss die drei Pflichtsektionen enthalten (`### Changes (Was ist neu)`, `### Technische Basis & Kausalität`, `### Ausblick (Nächste Schritte)`).
- Der Merge-Text wird aus dem Commit-Body gebaut und trägt die Pflichtsektionen, sonst wäre `main` sofort rot (`ERR-4006`).
- `verify:quick` muss vor dem Commit grün sein. `verify:all` läuft in CI nach dem Push.

Arbeitsbranch ist `feat/spatial-layout-editor`; `integration` folgt exakt `main`, PR #142 ist geschlossen. Die Doku-Konsolidierung ist mit 0.3.145 abgeschlossen; unter `docs/` liegen nur die fünf Pflichtdokumente. Der Audit #19 ist geschlossen: Firmenstufe in HUD und Betriebspanel sichtbar, Pixi-Fallback vorhanden.

## Pflichtdoku

Die Wurzel-`README.md` ist der gemeinsame Einstieg für Spielende und Entwickler: erzählerisch im Ton, präzise beim aktuellen Funktionsstand und vollständig mit Setup, Architekturwegen, Prüfungen, Roadmap und FAQ. Sie ist keine verbindliche Regelquelle; Spielmechaniken stehen immer als heutiger Stand und verweisen auf Code sowie Verträge. Neue Bilder und Screenshots werden unter `docs/` abgelegt und in der README direkt verwendet.

Nach **jeder** Änderung oder Analyse werden diese sechs Dokumente aktualisiert, im selben Commit, mit Version und UTC-Zeitstempel im `rbd-doc`-Marker:

| Dokument | Inhalt |
| --- | --- |
| `docs/INVENTORY.md` | Was existiert, was gelesen und geprüft wurde, Befunde; offene Punkte nur in `ROADMAP.md`. |
| `docs/CHANGELOG.md` | Was sich je Version geändert hat (Spiel und Technik). |
| `docs/DEVTAGEBUCH.md` | Warum, mit Prüfungen und offenen Enden. |
| `docs/ARCHITECTURE.md` | Zustandsbesitz, Schichten, Pipeline, Begründungen. |
| `docs/ROADMAP.md` | Jetzt, als Nächstes, später. |
| `AGENTS.md` | Dieser Vertrag; Regeländerungen zuerst hier. |

- Der Marker wird **nicht von Hand** gepflegt: `pnpm run docs:sync`, der Pre-Commit-Hook oder `pnpm run fix` schreiben ihn.
- Einträge entstehen mit `pnpm run docs:stub -- "Titel"`; der Agent füllt danach Ziel, Umsetzung, Prüfungen und Offenes. Kein Eintrag ohne Datum, keiner nachträglich ohne Änderung.
- Strukturvorgaben stehen in `scripts/lib/doc-sync.mjs` (Pflichtabschnitte je Dokument); das Gate prüft sie, es repariert sie nicht.
- Offene Punkte werden ausschließlich in `docs/ROADMAP.md` geführt; `INVENTORY.md` und `DEVTAGEBUCH.md` verweisen darauf und halten nur Befunde beziehungsweise Historie.
- Markdown gehört nur als `README.md` oder `AGENTS.md` in die Wurzel; alles andere lebt unter `docs/`. Keine Doppelungen zwischen Wurzel und `docs/`. Dotfiles wie `.turn-notes.md` sind Arbeitsdateien des Turns und zählen nicht als Wurzel-Doku.
- Der Testkatalog-Block in `docs/INVENTORY.md`, die Dependency-Matrix in `ARCHITECTURE.md`, `src/core/sim/narrative/composer/registry.generated.ts`, `src/core/sim/narrative/composer/slot-map.generated.ts`) werden vom Compiler/Hook geschrieben, nie von Hand editiert.
- Eskalationsregeln und die eine Leiter stehen im Abschnitt `Eskalation statt Fail-Closed` dieses Vertrags; keine zweite Klassifikation anlegen.

## Conventions

- Die Werkstatt bleibt ein Raster mit sechs Zielen; ihr Einstieg ist versteckt (fünf Tipps auf die Marke oder `Strg+Shift+D`), es gibt keinen sichtbaren Werkstatt-Knopf. `workshop.tsx` ist der einzige Rahmen, `workshop-parts.tsx` trägt Rasterkarte, Steuerung und FPS; die vier Popups liefern Panels ohne zweiten Shell. Der Charaktereditor hängt am `SPIEGEL`-`DECOR` im Lager, nicht an einem `WorkshopTool`.
- `src/core/` must stay headless (no browser deps) and testable.
- One owner per state: `world-store` holds world/ledger/PRNG; UI state (popups) lives in React.
- Eigene Spielrunden laufen über `core/sim/own-play.ts` und die Fassade `store/own-play.ts`. Der Einsatz geht `PORTEMONNAIE` → `HAUSKONTO`, der Gewinn zurück; ungedeckte Gewinne buchen `HAUS_SCHULDEN`. Offene Kartenrunden hält nur die Store-Fassade; `TableLauncher` bleibt rollenunabhängig und wird nicht als zweite Engine kopiert.
- Raum: `WorldState.layout` ist die einzige raeumliche Wahrheit (Dimension, Bodenmaterial je Tile, semantische Zonen, Wandkanten). `size` und `zones` sind abgeleitete Legacy-Sichten und werden nur ueber `applyLayout()` geschrieben; `GameView.layout` reicht denselben unveraenderlichen Plan weiter. Navigation laeuft ueber `nav-grid.ts`: belegte Tiles plus Wandkanten, nur `WALL` blockiert einen Schritt (`stepOpen()`), `DOOR`/`OPENING` sind passierbar; der Rand ist eine Kante, keine Tile-Sperre. `accessPointsFor()` liefert mehrere Zugaenge je Objekt, `approachPoint()` bleibt Fallback, und `nav-reach.ts` verhindert versiegelte Serviceobjekte. Rendering: Boden kommt aus `layout.floor` über `floor-material.ts` (stabile Fallback-IDs, keine erfundenen Texturen, Zonen liefern nur Licht/Ausstattung), Waende/Tueren aus `layout.edges` über `wall-art.ts` (eine Kante, eine Besitzer-Kachel, Vorderseite an Sued/Ost); `regionHash` invalidiert nur den betroffenen 30×30-Chunk. Tiefe: `depth.ts` sortiert Möbel, Figuren, Requisiten und Wandvorderseiten in einer Ebene nach Fußanker, dann Typ-Rang und stabiler ID; Wandkanten sind Occlusion-Sprites, Türschwellen bleiben im Chunk; sortiert wird nur bei geänderter Tiefe.
- Money is integer micro-units; no floats; every transaction is a ledger line.
- RNG via `src/core/rng/weighted.ts` (`buildDistribution`, `rollNumber`); cards via `src/core/rng/shoe.ts` (draw removes card; reshuffle only when empty).
- Zwei RNG-Namespaces: Spielzustand (`gameplay`) und Darstellung (`presentation`) teilen nie einen Strom. Renderer/Sound ziehen aus `src/render/rng.ts`; `tickWorld`/`playRound` weisen fremde Stroeme ueber `assertGameplayRng` ab.
- No `addVC` outside a booking; no money source except `EXTERNAL_WORLD`.
- Determinismus: kein `Math.random()`, `Date.now()`, `performance.now()`, `new Date()` und keine Krypto-Zufallsquelle (`getRandomValues`, `randomUUID`) in `src/**` oder `scripts/**` — ESLint blockt direkte Zugriffe, `globalThis`/`window`-Umwege, `new`-Umwege und Aliase. `eslint-disable` ist per `noInlineConfig` global wirkungslos; `Date()` ohne `new` und `performance.timeOrigin` sind ebenfalls gesperrt. Ausnahmen stehen namentlich und begruendet in `eslint.config.mjs`: `performance.now` nur in `src/render/floor-view.ts`, `src/render/floor-props.ts` und `src/render/music.ts` (Pacing), Krypto nur in `src/core/rng/streams.ts`, Zeitstempel-/CI-Tooling. Jede andere Datei unter `src/render/**` ist voll gesperrt. Echter Zufall nur in `entropySeed()`; Exporte stempeln aus `world.day`/`world.tick`, nie aus der Uhr.

## Gate-Rootcause-Analyse

Die konsolidierte Tabelle bisheriger Gate-Fehler und ihrer Ursachen steht in `docs/ARCHITECTURE.md`; sie ist kein Teil dieser Arbeitsregeln. Die Löschregel (Import-Grep vor jedem Löschen) gilt weiterhin.

## Pitfalls

- Kein Wegwerf-Skript, keine Ad-hoc-Datei: Analyse laeuft ueber `pnpm run agent:context`, Pruefung ueber `pnpm run agent:verify` (`--plan` zeigt den Plan ohne Lauf), Suche ueber `rg`. Dateien mit `tmp-`, `temp-`, `scratch-`, `.tmp.` oder `.bak` sind verboten; das Tree-Gate macht sie mit `ERR-4019` rot.
- Do not hand-edit generated files in `dist/`.
- LOC guard fails the build; reduce below the Hot Zone of the file's responsibility instead of adding an exception. Each file has exactly one responsibility and one budget; legacy exceptions are migration debt and only shrink.
- `test:perf` intentionally not in `verify:all`; don't gate on it on slow hardware.
- Commit messages verified by `verify:commit-msg`; new error codes in `docs/ARCHITECTURE.md`.
- `verify-test-quality` requires `@test-target` and `@error-code` headers on `.test.ts` and `.test.tsx`; every `it`/`test` callback needs its own `expect`, and the file must import and use its declared target (directly or through a helper that imports it). Fixed numeric `new Prng(...)` seeds are rejected, use `randomSeed()`.
- Journal state lives in `WorldState`; UI only reads the snapshot and never maintains a second log.
- Bodenhinweise (Zielraster, Spielerring, Laufwegspur, Klick-Puls) leben ausschliesslich in `src/render/floor-cues.ts`; `floor-camera.ts` bleibt die einzige Zoom- und Schwenk-Wahrheit, Gesten (`floor-touch.ts`) und Tasten (`App.tsx`) uebersetzen nur dorthin. Bildsprache und ihre harten Zahlen stehen in `docs/ARCHITECTURE.md` mit dem Blatt `docs/banners/art-direction-neon-ledger.png`; wer eine Rolle aendert, aendert sie in `art-tokens.ts` und `tokens.css` zugleich. Aktionen laufen ueber `src/ui/action-card.tsx` (kein Radialmenue), Partikel und Shake ueber `src/render/fx/floor-fx.ts` am Kamera-Container; beide bleiben Darstellung ohne Spielzustand.
- Ereignisse werden nur in `src/render/floor-events.ts` abonniert: acht Zeilen mappen auf Burst, Ton, Licht, Shake und Anker; `floor-fx.ts` bleibt Darstellung. Kein Ton ohne sichtbares Pendant, die Kasse liegt als `floor-cash.ts` an der Requisiten-Ebene. Spiel-Identitaet ist `data-game` plus `--game-*` in `tokens.css`, kein Layout-Umbau.
- Narrative: Vertrag in `docs/ARCHITECTURE.md`. Facts (`src/core/sim/narrative/`) sind der Ereignisstrom fuer Trigger und Gedaechtnis, das Journal bleibt Spielerhistorie. `WorldState.narrative` und `WorldState.rivals` sind die einzigen persistenten Narrativ-Zustaende (Save v10); `Guest` bleibt Besuch, `Visitor` bleibt Identitaet mit hoechstens sechs Erinnerungen; `narrative/relationships.ts` fuehrt gerichtete Kanten und pinnt ihre Endpunkte gegen Retention. Der Start-Pool (drei bekannte Figuren + `START_POOL`-Fact mit Startkapital) entsteht nur beim neuen Spiel ueber `seedStartPool`, nie in `createWorld`. Jeder Agent liefert pro abgeschlossenem Turn genau einen Content-Beitrag unter `content/narrative/contributions/` (Schema und Makro-Semantik in `docs/ARCHITECTURE.md`, Flags aus `content/narrative/vocabulary/`); ein abgestimmter Content-Batch gilt als ein Arbeitsschritt und darf mehrere Beitraege enthalten, solange jede Turn-ID genau einen Beitrag traegt und das Manifest jeden Turn einzeln registriert. Texte sind Darstellung, nie Spielregel. Im Spiel ist jede LLM- oder Provider-Anbindung ausgeschlossen; Agenten erstellen Beitraege nur bei der Repository-Arbeit. NAR-00 bis NAR-03 sind Grundlagen; Ledger-Cursor, ein einziger Fact-Boundary (`processNarrativeBoundary`) und die Beziehungs-/Retention-Grundlage sind vorhanden. NAR-04 ist erledigt: `VISIT_ENDED` (Besucher→Haus), `VISITOR_CONFLICT` (Besucher↔Besucher), `VISITOR_SERVICE` (Besucher→Personal an der Kasse) und `RIVAL_ENCOUNTER` (Rivale→Haus) speisen gerichtete Kanten; neue Facts nutzen `actorRefs` statt Pflicht-`visitorId`. NAR-05 ist erledigt: `trigger-types.ts`, `trigger-context.ts`, `trigger-evaluate.ts` und `trigger-schema.ts` bilden den deklarativen Trigger-Vertrag mit Context, Beziehungs-/Zeitfensterabfragen und fail-closed Schema; der reine Evaluator liefert Match, Teilnehmer und Gruende; seit NAR-12 bindet `events/trigger-definitions.ts` ihn in den Tick ein. NAR-06 ist erledigt: `event-lifecycle.ts`, `event-scheduler.ts`, `event-schema.ts` und `narrative-rng.ts` verwalten persistente Event-Instanzen mit Prioritaet, Fairness, Scopes, Cooldowns, Fristen, Stale-Cancel und einem eigenen Narrativ-RNG; `processNarrativeBoundary()` raeumt Fristen und verwaiste Endpunkte auf. NAR-07 ist erledigt: `events/template-types.ts`, `template-schema.ts`, `definitions/` und `template-candidate.ts` liefern stabile Templates und rollengenaue Teilnehmer; `choices/contract.ts` und `choices/eligibility.ts` binden Choice-IDs an Template-Version und persistierte Choice-Saetze und pruefen Lifecycle, Requirements und Kosten bei jedem Klick rein. NAR-08 ist erledigt: `narrative/commands/` parst `€...`-Direktiven zu einem begrenzten AST, allowlistet Command-IDs und Parameter, prueft Batches und Ziele vor jeder Wirkung und fuehrt Choice-Effekte samt Ledger-Kosten genau einmal aus; `COMMAND_REJECTED` macht Ablehnungen sichtbar, `TRIGGER_DIALOG` bleibt bis NAR-14 nicht ausfuehrbar. NAR-09 ist erledigt: `content/narrative/vocabulary/classification.json` kontrolliert Slots, Funktionen, Kontexte, Ton, Stimmung, Beziehung und Personas; jeder Beitrag traegt diese Klassifizierung, `content/narrative/turns/manifest.json` ordnet jedem abgeschlossenen Turn genau einen Beitrag zu, und `content/narrative/registry/fragments.json` wird deterministisch daraus erzeugt. `scripts/lib/narrative-content.mjs` validiert Schema, IDs, Manifest und Registry fail-closed im bestehenden `verify:assets` (`ERR-4022`). NAR-10 ist erledigt: `scripts/lib/narrative-macros.mjs` parst Makros zu typisierten ASTs, `scripts/lib/narrative-compiler.mjs` erkennt Sprecher-, Persona-, Stimmungs-, Flag- und Command-Konflikte und hasht die kanonische Registry, `scripts/compile-narrative-content.mjs` schreibt nur mit `--write`, und `--check` vergleicht exakte Bytes. NAR-11 ist erledigt: `narrative/composer/` waehlt aus der generierten, laufzeitvalidierten Registry deterministisch Texte, filtert Locale/Kontext/Flags/Personas fail-closed, liefert lokale Fallbacks und reicht typisierte Direktiven nur weiter; kein RNG, kein Netzwerk, keine Ausfuehrung. NAR-12 ist erledigt: `narrative/runtime.ts` verarbeitet Facts, Memory/Relationships, Trigger und Scheduler in genau einem Lauf; `tickWorld()` ruft ihn am Tick-Ende, `store/narrative-commands.ts` an jeder erfolgreichen Store-Command-, Neues-Spiel-, Import- und Rivalenspiel-Grenze. `events/trigger-definitions.ts` haelt die Fact→Trigger-Zuordnung deklarativ, `scheduleCandidates()` begrenzt auf drei neue Events, und eine aufgeloeste Choice emittiert `EVENT_RESOLVED` als naechsten Fact; neue Facts laufen nie rekursiv im selben Aufruf. NAR-13 ist erledigt: `events/demand-definitions.ts` beschreibt Neon-Nacht und Turnierabend als Daten, `narrative/demand-events.ts` startet hoechstens eine aktive GLOBAL-Instanz und beendet sie am Fristtick ueber die gemeinsame Engine; `demandBreakdown()` leitet Nachfragequelle, Anzeige und Gruppengroesse nur noch daraus ab, und v5–v9-Saves werden beim Laden konvertiert. NAR-14 ist erledigt: `narrative/view.ts` leitet Szenen und Profile rein ab (`GameView.narrative`), `src/ui/narrative-*` zeigt sie, `dismissNarrativeCmd()` lehnt eine Szene ueber `CANCELLED` ab; UI rechnet keine Trigger, Effekte oder Geld. NAR-15 ist erledigt: `WorldState.rivals` haelt Haltung, Handlungsfaehigkeit, Wohlwollen, naechsten Zug, Historie (6) und Indizien (4); `rival-ai/policy.ts` entscheidet rein und ohne PRNG, Sabotage trifft deterministisch ein Geraet, hinterlaesst ein Indiz und einen `RIVAL_ACTION`-Fact, und `rival-action` uebersetzt nur TRADE_INFO, PRICE_MOVE, POACH_VISITOR und SABOTAGE in `RIVAL_MOVE` (PROBE bleibt ohne Event). Seit Phase 5 liefert `narrative/rival-context.ts` daraus Rivalen-Karten fuers Anzeigemodell (Haltung, Kapazitaet, Wohlwollen, Gegenmassnahmen-Fenster, Historie, Indizien), rein und ohne NAR-14-17-Duplikate; `view.ts` bleibt unter 200 Zeilen, Testdateien unter 240. Seit C1 gilt als getesteter Vertrag: nur triggern, wo ein Template existiert; Geraete-, Lager- und Personal-Facts haben keine Fact-Kinds und bleiben dokumentiert offen. Seit D1 fuehrt `ASK_ABOUT_LAST_VISIT` per `followUpEventId` zu `VISITOR_AFTERMATH`; die Kette nutzt den drainierten `EVENT_RESOLVED`-Fact und `chainFromEventId`, ohne Rekursion und ohne Duplikat. Seit D2 wirkt `CONFRONT_RIVAL` ueber `COUNTER_RIVAL` auf die Domaene (`counteredUntilTick`, Preflight mit `rival:`-Existenz, kein neuer Fact). Seit D3 gilt: keine globale Timeout-Strafe, `EXPIRED` ist wirkungslos ausser Status und `DEADLINE` (Test sichert Flags, Beziehungen und Ledger). NAR-16 ist erledigt: `narrative-longrun.test.ts` prueft zwei Spieltage gegen alle Deckel, Save/Replay-Determinismus und ein Save-Budget von 512 KiB; `src/store/narrative.bench.ts` misst den Hotpath, `bench:lowend` und `ci:long` sind gruen. NAR-17 ist erledigt: diese Doku, der Testkatalog und die `demandEvent`-Reste stehen auf Save v10 und dem aktuellen Code. Facts werden ausschliesslich ueber die Runtime im Boundary gedraint; `ledgerSeq` verhindert historische Schwellen-Facts beim Laden. Seit dem Profil-/Historien-Anschluss oeffnet das Gast-Popup ueber `onProfile(visitorId)` direkt das Besucherprofil, `buildNarrativeView()` nimmt Gaeste auf dem Floor in die Profile auf und liefert die juengsten zwoelf abgeschlossenen Szenen als `history`; der Journal-Tab „Geschichten“ zeigt diese Ableitung, keine zweite Log-Wahrheit. Seit B1 ist `narrative/composition-context.ts` die einzige Ableitung des Composer-Kontexts: Kontext aus `sourceFactId` beziehungsweise Template-Fallback, Personas aus den aufgeloesten Visitor-Teilnehmern, Beziehung und Stimmung aus Fact, Erinnerung und gerichteter Kante sowie `requiredFlags` nur aus den Template-Requirements. `view.ts` reicht dieses Ergebnis unveraendert an den Composer weiter; es gibt keinen zweiten Kontextspeicher und keinen neuen Zustand. Seit B2 traegt jeder `ContentSlot` optionale `requiredContexts` (Slot-Zweck, z. B. `CHOICE_WELCOME` = `return`+`welcome`); der Composer verlangt sie zusaetzlich zu `ComposeRequest.requiredContexts` fail-closed, waehrend `contexts` nur Treffer bewertet, und waehlt bei Gleichstand per FNV-1a-Hash aus Szenen-ID und Slot-ID statt per RNG. Seit B3 ist `degraded` genau dann wahr, wenn `fallbacks.length > 0`, und `issues` nennt die betroffenen Slot-IDs; `NarrativeEventView.fallbackSlots` reicht diese Liste an die UI, die die Slots konkret benennt.


## Eskalation statt Fail-Closed

> Bei der Doku-Konsolidierung aus `docs/ESCALATION.md` uebernommen; die Quelldatei wurde geloescht. Die Aussagen gelten zum Stand dieses Commits.

Ein Fehlschlag ist kein Urteil, sondern eine Stufe. Die Leiter ist global und
gilt fuer Pipeline, Hooks, CI und Import-Befunde.

### Die Leiter

| Stufe | Bedeutung | Wer handelt |
| --- | --- | --- |
| `AUTO_FIX` | Automatisch reparierbar: Doku-Marker, Format, Matrix, Katalog. | `pnpm run fix` oder der Pre-Commit-Hook |
| `LOCAL_GATE` | Ausserhalb des Scopes: kein Blocker, wird verworfen. | niemand |
| `REMOTE_CI` | Netz, Registry oder Runner: lokal nicht reproduzierbar. | CI erneut starten |
| `AGENT` | Struktur, Sektion oder Zustaendigkeit fehlt. | Agent nach `AGENTS.md` |
| `BLOCKED` | Geld, Ledger, RNG, Save-Integritaet oder Rechte. | Mensch, fail-closed |

Die Reihenfolge ist bindend: erst reparieren, dann wiederholen, erst danach ein
Agent. `BLOCKED` wird nie automatisch uebersprungen.

### Klassifikation

`scripts/lib/escalation.mjs` ordnet einen Befundtext einer Stufe zu:

- Geld, Ledger, Buchung, VaCoin, RNG, PRNG, Save-Integritaet -> `BLOCKED`.
- `ERR-0911`, Doku-Marker, "nicht synchron", Matrix, Katalog -> `AUTO_FIX`.
- `ECONN*`, Timeout, Rate Limit, 5xx, Registry -> `REMOTE_CI`.
- "ausserhalb des Scopes" -> `LOCAL_GATE`.
- Alles andere -> `AGENT` (Struktur).

`pnpm run escalation:plan` liest den letzten Gate-Befund und nennt die Stufe.
Die Import-Engine uebersetzt dieselbe Idee: `FATAL -> BLOCKED`,
`REPAIR -> AUTO_FIX`, `IGNORE -> LOCAL_GATE`.

### Wo eskaliert wird

- **Pre-Commit** schreibt Doku-Marker, Matrix und Katalog; LOC bleibt ein
  lokales Gate, weil ein zu grosses Modul nicht automatisch splittbar ist.
- **Commit-Msg** blockiert nicht mehr: fehlende Pflichtsektionen loesen
  `PR Escalation` aus.
- **GitHub CI** (`pr-escalation.yml`) baut den PR-Body aus Subject und Body und
  legt den PR an oder aktualisiert ihn. Ohne `gh` bleibt der Lauf gruen und der
  Body liegt in `.git/rbd-pr-body.md`.
- **Pipeline** hat kein schreibendes Gate; Reparaturen laufen ueber `pnpm run fix`.
- **Promotion** (`promote.yml`) ist die Stufe danach: gruen mergt automatisch,
  rot landet auf der permanenten Branch `integration` und wird dort repariert.
  Ein Textkonflikt wird gelabelt (`integration/konflikt`), nicht erzwungen; die
  Leiter bleibt damit auch beim Merge dieselbe.

### Connector als Eskalationsweg

Wenn `gh` fehlt oder nicht angemeldet ist (typisch fuer Agenten ohne CLI-Token),
bleibt der Lauf gruen und `scripts/lift-commit-body.mjs` gibt den Plan aus:

```bash
node scripts/lift-commit-body.mjs --json
```

Der Plan nennt `level`, `channel`, `branch`, `base`, `title`, `bodyFile` und
`body`. Ein Agent mit GitHub-Connector legt damit den PR an oder aktualisiert
seinen Body; der Connector ersetzt `gh`, nicht die Regel. Der Level kommt aus
derselben Leiter (`AGENT`), es gibt keine zweite Klassifikation.

Reihenfolge: CI mit `gh` versucht zuerst; scheitert das, uebernimmt der
Connector. Beide Wege schreiben denselben Body aus derselben Datei.

### Nicht verhandelbar

- Kein Gate schreibt im Verify-Lauf.
- Keine Ausnahme fuer Geld-, Ledger- oder Save-Regeln.
- Keine lokalen Testlaeufe waehrend der Arbeit; Tests laufen am Turn-Ende oder
  in GitHub Actions.
- Keine zweite Wahrheit: eine Leiter, ein Marker, eine Doku-Liste.
