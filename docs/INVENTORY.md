# Repository-Inventur (lebendes Artefakt)

<!-- rbd-doc: v0.3.66 | 2026-11-01 20:22 UTC -->

> Zweck: vollständige, reproduzierbare Inventur der Repository. Dieses Dokument
> ist das einzige geschriebene Artefakt der Untersuchung und wird bei jeder
> Fortsetzung aktualisiert.
>
> | Versionierungs-Feld | Wert |
> | --- | --- |
> | **Version** | **v1.20** |
> | Erstellt | 2026-11-01 ~07:47 UTC (T1) |
> | **Aktualisiert** | **2026-11-01 20:40 UTC (T24 — Auto-Promotion und Integrationsbranch)** |
> | Branch | `main` (PR-Pflicht), Arbeitsbranch `docs/doku-konsolidierung-0365`, permanent `integration` |
> | HEAD | `c4e6e3b` (Fast-Forward `ee882da → c4e6e3b`, 26 Commits, 76 Dateien) |
> | Arbeitsbaum | sauber; Remote `vannon091118/rigged-by-design`; 983 getrackte Dateien, 67 Ordner |
>
> Fortsetzungs-Log am Ende dieses Dokuments.

## 1. Überblick

| Feld | Wert |
| --- | --- |
| Projekt | „Rigged by Design" — Casino-Aufbauspiel-Simulation (Satire, kein Echtgeld) |
| Stack | Vite 8 + React 19 + TypeScript 6 (strict) + PixiJS 8, Vitest 5, ESLint 10 |
| Version | 0.3.65 (`package.json` nach diesem Commit), Engine `node >=22.22.2`, `packageManager npm@12.2.1` |
| Plattform | Web (Vite) + Android-APK über Capacitor 8 (`capacitor.config.json`, App-ID `de.riggedbydesign.casino`) |
| Geld | VaCoins als ganzzahlige Mikro-Einheiten (1 VC = 10.000), Buchungen nur im Ledger |
| Sprache | Code-Kommentare/UI-Texte deutsch, Identifikatoren englisch |

## 2. Struktur- und Größen-Matrix (gemessen 01.11.2026)

| Bereich | Dateien (.ts/.tsx) | Zeilen | Zuständigkeit |
| --- | ---: | ---: | --- |
| `src/core` | 170 | 16.390 | Headless-Simulation: economy, games, governance, physics, rng, sim |
| `src/render` | 50 | 5.650 | PixiJS-Floor, Spiele-Bühnen, Audio, Assets |
| `src/ui` | 40 | 4.289 | React-Panels/Popups inkl. 10 Game-Popups |
| `src/store` | 25 | 2.045 | WorldStore (Welt/Ledger/PRNG/Save), Commands, Snapshot |
| `src/test` | 2 | 35 | `measure.ts`, `random-seed.ts` (Test-Werkzeuge) |
| `src/App.tsx` + `main.tsx` | 2 | 349 | App-Verdrahtung |
| **Summe src** | **294** | **~28.758** | |
| `scripts` + `scripts/lib` | 22 + 12 (.mjs) | — | Pipeline, Gates, Release, Android, Audio |
| `.github/workflows` | 6 | — | ci-verify, auto-version-release, build-apk, long-checks, pr-cleanup, promote |
| `docs` | 16 .md + `screenshots/README.md` + Banner + 25 Screenshots | — | 16 Doku-Dateien flach unter `docs/` (Grossbuchstaben-Namen), Belege in `screenshots/{current,comparison}` |
| `public/assets/casino` | 9 Symbole + 3 Musik (Opus/OGG) | 8,7 MB | kuratierter Asset-Ausschnitt |

Größte Dateien: `floor-view.ts` 349 · `App.tsx` 325 · `guest-art.ts` 315 · `plinko-canvas.ts` 259 · `ledger.ts` 249 · `shell-canvas.ts` 242 · `staff.ts` 240 · `migrate.ts` 217 · `floor-props.ts` 217 · `sound-fx.ts` 206.
Alle unter ihren LOC-Budgets (`scripts/loc-budgets.mjs`: Legacy-Cap 350 für 6 gelistete Dateien, sonst 200–260). **Keine Datei über Cap.**

## 3. Architektur & Ownership (aus Code bestätigt)

- `src/store/world-store.ts` (143 Z.): einziger Besitzer von `WorldState`, `Ledger`, `Prng`, Tick-Timer (520 ms), Save. Commands sind dünne Delegationen an `*-commands`/`player-tools`. Snapshot-Verbraucher: React via `useSyncExternalStore`.
- `src/store/snapshot.ts` (`buildView`) erzeugt `GameView` (deklariert in `store/types.ts`); UI/Renderer halten keinen eigenen Spielzustand — im Code nachgewiesen.
- `src/core/` headless: kein DOM/Pixi-Import in `src/core`. Wanduhr und Zufall sind gesperrt: Darstellung zieht aus dem eigenen `presentation`-Strom (`src/render/rng.ts`), echter Zufall nur in `entropySeed()` (`src/core/rng/streams.ts`).
- Eine Geldwahrheit: `Ledger` mit dynamischen Konten (`FIAT_<id>`, `VISITOR_<id>`, `PENDING_<id>`, `HAUS_SCHULDEN` als Verbindlichkeitskonto). `EXTERNAL_WORLD` ist die einzige Geldquelle (`MINTING_ACCOUNT`).
- Zustandsfluss: Store → `buildView` → UI-Commands → Store-Methoden → `core/sim`-Funktionen → Ledger/Journal.

## 4. Geld- & Wirtschaftskern (vollständig gelesen)

| Datei | Inhalt |
| --- | --- |
| `economy/vacoin.ts` | Branded-Integer `VaCoinMicro`, `fromVC/toVCString/addVC/subVC/mulVC/canAfford`; `mulVC` exakt per BigInt, Floor zugunsten der Bank |
| `economy/ledger.ts` | Doppelte Buchführung, `transfer` mit Prüfungen (Konto leer, Betrag>0, Deckung außer Mint/Liabilities), Checkpoint-Replay (`verifyIncremental` für den Tickpfad, `diagnose` voll auf Klick), `openLiability` |
| `economy/ledger-integrity.ts` | `applyEntry`, `verifyBalanceSheet` (Summe aller Konten = 0), `BASE_ACCOUNTS` |
| `sim/money.ts` | Konten-Konstanten; `STARTING_CAPITAL = fromVC(150)` gebucht via `openHouse()` (EXTERNAL→HAUSKONTO); `payOut`/`payOrBorrow` buchen Unterdeckung auf `HAUS_SCHULDEN` statt zu kappen; Wechselkasse Fiat↔Chips; `playerTakeHome`, `foreignBet/foreignWin` |

Regeln aus AGENTS.md im Code nachgewiesen: kein `addVC` außerhalb von Buchungslogik (Verwender: ledger, foreign-play, snapshot, self-exclusion-bet — alle Buchungs-/Ableitungspfade); Auszahlungen nie gekappt (`openLiability(DEBT_ACCOUNT)`).

## 5. RNG & Physik (vollständig gelesen)

- `rng/prng.ts`: Mulberry32, uint32-Zustand, `nextInt` mit Rejection-Sampling (kein Modulo-Bias), `getState/setState` für Save.
- `rng/weighted.ts`: `buildDistribution` mit hart begrenztem Bias (`MAX_BIAS_BPS` 9.000) und Deadzones; `rollNumber` liefert `chance` aus derselben Verteilung; `pickWeighted` mit Accept-Filter.
- `rng/shoe.ts`: Kartenschuh ohne Zurücklegen, partieller Fisher-Yates, Mischung erst bei leerem Schuh.
- `physics/`: Körper (Kreis/Segment/Polygon) mit Trägheit, `PhysicsWorld` mit festem Zeitschritt (1/120 s), Impulsen, Reibungsmoment, Trigger-Zonen, allokationsfreier Breitphase. Grundlage von Plinko.

## 6. Spiele (8 + Testspin)

Naht: `core/games/contracts.ts` (vollständig) — `playAction({game, stake, houseEdgeBps?, bonusBps?, variant?, captureTrack?, roulette?, shell?})`; prüft **vor** der Ziehung; `payout = mulVC(stake, multiplierBps)`; Bonus/Hausvorteil greifen nur auf Gewinnen; Bias ≤ 9.000 bps. Spiele: SLOT, BLACKJACK, POKER, VIDEO_POKER, ROULETTE, PLINKO, SHELL, DICE.
Testspin: `sim/actions.ts testSpin()` — Sandbox mit eigenem Seed, **kein Ledger, kein Welt-PRNG** (nachgewiesen).
Dateien: 20 Module in `core/games` + 11 in `engines/`; 10 UI-Popups; 22 Render-Bühnen/Canvas.

## 7. Tick & Simulation (Kern gelesen)

`sim/tick.ts` (vollständig): Gast-Zustandsmaschine ENTER→EXCHANGE→CHOOSE→PLAY/DRINK/TOILET/WAIT→CASHOUT→LEAVE/ANGRY; Tickreihenfolge: Queue, Gäste, Streit, Agenten, Decay, Reputation, Personal, fremde Floors, Nachfrage, Spieler-Recovery, Speed-Stufen. `sim/actions.ts` (vollständig): `settleGuests` (vor Umbau alle Ansprüche), Reinigung/Reparatur/Mods/Walzen/Slot-Regeln, `foreignRound` (PRNG-Snapshot + Rollback bei Fehlern, Buchung erst nach成功的 Rechnung).
`sim/templates.ts` (vollständig): 3 Blueprints, `ensureStarter` stellt den Gratis-Automaten wieder her.

## 8. Save & Migration

`store/save.ts` (vollständig): **Version 9**, Key `vcoin.casino.v9`; `LEGACY_KEYS` hebt v5–v8 (Fiat, offene Gewinne, Journal, Look, Besuchererinnerungen und PRNG-Position bleiben; v8 wird auf leere Narrativ-Defaults normalisiert), `OLD_KEYS` verwirft v3/v4. `migrate.ts` (vollständig): Hydration mit Default-Füllung, Heilung verwaister Referenzen (Kisten↔Agenten, Dispute↔Gäste), Geräteidentität aus Katalog, Personal-Migration (`migrate-staff.ts`: Guard-Flag → Agent).

## 9. Governance & Pipeline

- Fehlerregister: `core/governance/error-codes.ts` ↔ `docs/ERROR_CATALOG.md`, `ERR-0000` fail-closed; Codes aufsteigend sortiert, inklusive `ERR-4017`–`ERR-4021` und `ERR-5001` (Formatfehler aus Befund 4 in T23 behoben).
- Pipeline: `scripts/run-pipeline.mjs` + `lib/pipeline-plan.mjs` (vollständig). Profile: quick = 10 Gates (lint, check:loc, typecheck, test-quality, dead-code, docs, tree, redundancy, assets, tests), full/release = zusätzlich audit und build = 12 Gates. Jedes Gate: harter Timeout, Inhalts-Hash-Cache, rein lesend; nur `fix` schreibt (ESLint `--fix`, Matrix, Katalog, Doku-Marker).
- LOC-Guard: `scripts/loc-budgets.mjs` (vollständig) — Rollen-Budgets, 6 Legacy-Einträge (350/200), keine neuen `@loc-exception`.

## 10. CI/CD (alle 6 Workflows vollständig gelesen)

| Workflow | Trigger | Aufgabe |
| --- | --- | --- |
| `ci-verify.yml` | push (**), PR gegen main, dispatch | Job **„Fail-Closed Gates"** = Pflichtstatus; `verify:all` mit `RBD_VERIFY_AUDIT=1`; Commit-/PR-Notes-Gate |
| `auto-version-release.yml` | workflow_run nach erfolgreichem CI Verify auf main (+dispatch) | taggt genau den geprüften Commit; Eskalationsleiter GITHUB_TOKEN→RELEASE_TOKEN→BLOCKED; kein Commit |
| `build-apk.yml` | workflow_call (Release mit `skip_verify`), dispatch, Tag-Push | Java 21, Android SDK 36, Debug + unsigned-Release-APK, Artefakt-Verifikation |
| `long-checks.yml` | dispatch (`npm run ci:long`) | Statistik (4 RTP-Dateien), Soak (100k Ticks), Balance-Lauf + Artefakt, Benchmarks |
| `pr-cleanup.yml` | PR closed (merged) | löscht Head-Branch (nicht main, nicht Fork, `keep-branch` schont) |
| `pr-escalation.yml` | PR gegen main | hebt den Commit-Body in den PR-Body (`lift-commit-body.mjs`), damit fehlende Pflichtsektionen nicht blockieren |

Branch-Schutz (Ebene B, laut CI-GATES.md seit 31.10.2026 aktiv): PR erforderlich, Pflichtstatus `Fail-Closed Gates`, kein Force-Push, keine Löschung.

## 11. Tests & Katalog

91 `.test.ts(x)` + 5 `.bench.ts` = 96; System und Beweisklasse je Datei erzeugt `npm run catalog` aus `@test-target` in `docs/TEST-CATALOG.md`. Statistik-/Performance-Klassen laufen nur in CI; `vite.config.ts` schließt im quick-Profil `round-rtp-*`, `soak`, `slot-session-rtp` aus.

## 12. Dependencies & Audit

21 direkte Dependencies (3 Runtime: pixi.js, react, react-dom). `docs/DEPENDENCY-AUDIT.md` (Stand 31.10.2026): Umsetzungsstand **stimmt mit `package.json` überein** — engines/packageManager gesetzt, Dev-Server-Default `localhost` + `RBD_DEV_HOST`-Opt-in (in `vite.config.ts` bestätigt), Vite 8.3.5/plugin-react 6.1.2, TypeScript 6.0.3, `projectService` entfernt. Overrides: `glob ^14.0.3`, `minimatch ^11.0.1` (sicherheitsmotiviert).

## 13. Assets

`docs/ASSETS.md`: vollständiges Paket (539 PNG + 7 JSON, 6 OGG-Tonspuren) unter `public/assets/casino/`, Manifest `src/render/assets/manifest.json`; **Lizenz/Urheber des Quellpakets nicht belegt — vor externer Veröffentlichung zu klären**. WAV-Master außerhalb des Repos. `npm run verify:assets` prüft Manifest ↔ Dateien ↔ `SLOT_SYMBOLS`.

## 14. Befunde & Diskrepanzen (laufend gepflegt)

| # | Schwere | Befund | Beleg |
| --- | --- | --- | --- |
| 1 | **hoch** | `world-store.ts` `spinTest()` ruft `spinTestCmd` **zweimal** auf: Resultat aus dem ersten, Notice aus dem zweiten Lauf. Der Testspin ist gratis, aber Notice und angezeigtes Resultat stammen von zwei verschiedenen Läufen; der Sandbox-Seed wird doppelt fortgeschrieben. | `src/store/world-store.ts` (Methode `spinTest`); `game-commands.ts` |
| 2 | mittel | **aufgelöst**: Code bucht 150 VC Startkapital (`money.ts`: `STARTING_CAPITAL = fromVC(150)`, `openHouse()`), Store-Notice nennt 150 VC, README behauptet „Du startest mit 0,00 VC". Das Portemonnaie startet tatsächlich bei 0 — die README-Aussage ist ohne diese Unterscheidung falsch bzw. irreführend. | `sim/money.ts`; `world-store.ts`; README |
| 3 | mittel | Gate `assets` meldet bei Fehler **ERR-4016** (definiert als „langer Nachweis in CI nicht gelaufen/rot") — mögliche Fehlzuordnung; kein eigener Assets-Code im Register. | `lib/pipeline-plan.mjs`; `error-codes.ts` |
| 4 | niedrig | `docs/ERROR_CATALOG.md`: ERR-4013/ERR-4014-Zeile verschmolzen (`… pruefen. \|\| ERR-4014 …`) — kaputte Markdown-Tabellenzeile; zusätzlich CRLF (`.gitattributes` normalisiert nur ARCHITECTURE.md). | `docs/ERROR_CATALOG.md` |
| 5 | info | **aufgelöst (T23)**: ARCHITECTURE, PRODUCT, AGENTS und dieses Inventar nennen dieselbe Zählung — quick = 10 Gates, full/release = 12 (plus `audit`, `build`); das `assets`-Gate steht in allen drei Doku-Stellen. | `scripts/lib/pipeline-plan.mjs` |
| 6 | niedrig | `opencode.json` enthält hartkodierten Windows-Pfad `C:\Users\vanno\rigged-by-design` — nicht portabel. | `opencode.json` |
| 7 | niedrig | Dependency-Audit nennt 373→311 Lockfile-Einträge; Ist: 323 `node_modules/`-Einträge — Drift, Bericht nicht nachgezogen. | `package-lock.json` |
| 8 | info | Kein einziger TODO/FIXME/HACK/XXX in `src/` und `scripts/` (0 Treffer). | grep |
| 9 | info | Migration heilt verwaiste Referenzen; Guard-Agent wird nachgetragen statt still zu verschwinden. | `migrate.ts`, `migrate-staff.ts` |
| 10 | info | Release-Kette konsistent: verify:all → Tag → APK (`skip_verify`), Artefakt-Verifikation per `gh release view`. | Workflows |
| 11 | info | `foreignRound` rollt PRNG bei Fehlern zurück und bucht erst nach erfolgreicher Rechnung — Geld-Pfade sind damit fehlerresistent belegt. | `sim/actions.ts` |
| 12 | info | Fehlerregister vollständig synchron: `error-codes.ts` und `ERROR_CATALOG.md` enthalten exakt dieselben 23 Codes. | Abgleich T3 |
| 13 | info | Spiele-Modularität bestätigt: 8 Engines unter `core/games/engines` + `round.ts` als Dispatcher; UI-Popups (10) und Pixi-Bühnen (22) sind reine Darstellungsschichten ohne eigenen Spielzustand (Header aller 48 ui- und 22 render/games-Dateien gelesen). | Extraktion T3 |
| 14 | info | `slot-transparency.ts` (`recordSlotSpin`, `slotDrift`) und `slot-telemetry.tsx` liefern bewusste Verlust-Transparenz — dokumentiertes Produktversprechen im Code belegt. | Export-Matrix T3 |
| 15 | info | Journal: Puffer 240 + dauerhaftes Archiv 2.000 (`journal.ts`, vollständig gelesen); Archiv überlebt den Puffer, steht im Save und ist filterbar (`archiveQuery`). Stimmt mit ARCHITECTURE.md überein. | `sim/journal.ts` |
| 16 | info | Erster Gast nach 12 Ticks ≈ 6,2 s bei 520 ms/Tick (`demand.ts` `FIRST_ARRIVAL_TICK`) — bestätigt die README-Aussage „sechs Sekunden“; Nachfrageplanung ohne jede Gästeobergrenze belegt. | `sim/demand.ts` |
| 17 | info | `expansions.ts`: Ausbau bucht **vor** dem Wachsen; Möbel, IDs, Personal, Kisten und Ledger-Konten bleiben erhalten, Fleck-Indizes wandern mit. Konsistent zur remodel-Regel. | `sim/expansions.ts` |
| 18 | ~~beob~~ | **aufgelöst (T5)**: `movement-queue.ts` wird von `player-jobs`/`foreign-floor-tick` **nicht** importiert (Verifikation per Import-Grep T5); die Kassenschlange nutzt stattdessen `queue-spots.ts`. Bewerbung als generische Stations-Engine derzeit ohne Verbraucher — Kandidat für den Dead-Export-Gate-Check (`ERR-4003`). | `sim/movement-queue.ts` |
| 19 | beob | `economics.ts` hält einen modulweiten Cursor („WeakMap<Ledger>“) für laufende Kennzahlen — mutable Nebenwirtschaft außerhalb des Stores, aber pro Ledger gekapselt und ausschließlich lesend über `entriesSince`. | `sim/economics.ts` |
| 20 | info | Modell-Konsistenz bestätigt: `desk-service.ts` (6→2 Ticks ohne/mit Kassierer), `deliveries.ts` (Bar-Kapazität 12+8·Level, WC-Verstopfung ab 3+2·Level), `offers.ts` (6 Mods, `EXTRA_REEL` nur für Slots) — Preise/Wirkungen an einer Stelle. | mehrere Sim-Dateien |
| 21 | mittel | `core/sim/movement-queue.ts` hat außerhalb seiner eigenen Testdatei **keinen Importeur** (Grep-Beweis T5/T6). Der Dead-Export-Gate zählt Testdateien als Verbraucher (`consumers = sources + scripts`), also überlebt ein produktions-totes Modul. Kandidat: entfernen oder bewusst ins Produkt holen — Nutzerentscheidung. | `movement-queue.ts` |
| 22 | info | Einziger `Math.random()` in ganz `src/render`: `sound-fx.ts:151` erzeugt Weißrausch-Frames für einen Sound-Effekt — bewusst nondeterministisch, kein Spiel-/Geldpfad (Determinismus-Gate prüft core+store). | `src/render/sound-fx.ts` |
| 23 | niedrig | Zweiter Windows-Absolutpfad im Repo: `encode-audio.mjs` nutzt `C:/Users/vanno/Downloads/casino_asset_sounds_prealpha/sounds` als **Fallback**, überschreibbar via `RBD_AUDIO_SOURCE`. Gleiche Klasse wie Befund 6, aber dokumentiert und umgehbar. | `scripts/encode-audio.mjs` |
| 24 | info | Anti-Atributions-Gate vorhanden: `verify-commit-msg.mjs` + `sanitize-commit.mjs` blockieren/entfernen `Co-authored-by`, `Generated with` und Tool-Namen (Freebuff, Codebuff, Claude, Anthropic, OpenAI, Cursor); `turn-push.mjs` sanitized vor dem Push und `autofix-0911.mjs` prüft `.git/COMMIT_EDITMSG`. Der Workflow ist Anti-Attribution by design. | `scripts/` |
| 25 | info | Gate-Cache ist profilisoliert: `gate-cache.mjs` hashet `git ls-files -z -co` (tracked + untracked, ignore-respektierend) + `process.version`; der Cache-Key pro Gate enthält dessen Env — ein grüner quick-Lauf kann nie den release-Vollauslauf ersetzen. | `scripts/lib/gate-cache.mjs` |
| 26 | info | Prozess-Absicherung: `process-sweep.mjs` beendet nur PID **plus Startzeit**-identifizierte Prozesse (Linux /proc-Feld 22, Windows PowerShell, ps-Fallback); läuft noch eine fremde Pipeline, wird die Registry passiv statt zu räumen. Nie nach Namensmuster. | `scripts/lib/process-sweep.mjs` |
| 27 | info | Test-Auswahl mit Recall-Sicherung: `affected-tests.mjs` (rückwärtsgerichteter Importgraph + `@test-target` + Subsystem-Fallback; Konfig-Änderung → alle Tests); `statistics`/`performance` werden an CI delegiert (`ci-long-checks.mjs`: gh bevorzugt, REST-Fallback, Artifact-Download). | `scripts/lib/` |
| 28 | info | Dependency-Matrix ist Fail-Closed: `sync-dependency-matrix.mjs` verlangt pro Package eine Architektur-Begründung (ERR-4007) **und** reale Nutzung aus dem Modulgraphen; schreibt die Live-Matrix in `docs/ARCHITECTURE.md`, `--check` meldet Verfall. | `scripts/sync-dependency-matrix.mjs` |
| 29 | info | Versions-Konsistenz: `version-bump.mjs` bumppt package.json **und** beide Lockfile-Stellen (Root + `packages[""]`), sonst bricht `npm ci` in CI an der Differenz; `turn-push.mjs` überspringt den Bump bei bereits gebumptem Baum. | `scripts/version-bump.mjs`, `scripts/turn-push.mjs` |
| 30 | info | Release-Eskalationsleiter: `release-escalation.mjs` WORKFLOW_TOKEN → RELEASE_TOKEN → BLOCKED mit Klartext-Anleitung; transient/unknown → bis zu 3 Wiederholungen; „already exists“ → DONE. | `scripts/lib/release-escalation.mjs` |
| 31 | info | Android-Vertragsprüfungen: `prepare-android.mjs` prüft `dist/index.html`, `capacitor.config.json` (webDir=dist) und gepinnte @capacitor-Pakete vor gradle; Debug installierbar, Release bewusst unsigned (Signieren ist eigener Schritt). | `scripts/prepare-android.mjs` |
| 32 | info | `balance-run.mjs` validiert Tage (1–400) und Seed (SafeInteger), schreibt den Bericht nach `artifacts/` (gitignoriert) und verlangt dessen Existenz (sonst ERR-2001) — der Messlauf kann nicht still ohne Bericht bestehen. `src/test/random-seed.ts` zieht Seeds aus `node:crypto` ohne Env/CLI/Datei-Override. | `scripts/balance-run.mjs`, `src/test/` |
| 33 | **hoch** | **UI zeigt die falsche Bar-Kapazität**: Sim definiert `barCapacityForLevel = 12 + 8·max(1, level)` (`deliveries.ts:12`; genutzt in der Nachliefer-Logik und korrekt importiert in `build-panel.tsx`), aber drei UI-Dateien rechnen hartkodiert die alte Formel `6 + 6 * view.barLevel`: `hud.tsx:78`, `machine-popup.tsx:61`, `diagnostics-popup.tsx:25`. Folge: HUD/Popups zeigen die Kapazität zu niedrig an (Stufe 1: UI 12 vs. Sim 20 · Stufe 3: UI 24 vs. Sim 36), und auch die „fast leer“-Schwelle (`capacity/3`) ist gegen die Nachlieferung verschoben. Reparatur = drei Stellen auf den vorhandenen Import umstellen (1-Zeiler je Datei) — Code-Änderung, erfordert Freigabe. | `src/ui/hud.tsx`, `src/ui/machine-popup.tsx`, `src/ui/diagnostics-popup.tsx` |
| 34 | niedrig | Unicode-Mojibake `Â·` in `table-launcher.tsx:56` (UTF-8-Doppelinterpretation) — sichtbar im Untertitel aller acht Spiel-Popups („Haus Â· Betreiber“). Einziger Treffer des Mojibake-Scans über ganz `src/` und `docs/`. | `src/ui/table-launcher.tsx` |
| 35 | info | Tick-Dauer 520 ms ist an vier Stellen kodiert: Kern-Tick, `floor-view.ts` (`STEP_MS = 520`), `guest-popup.tsx` und `self-exclusion-panel.tsx` (`× 0.52` Sekunden-Umrechnung). Aktuell konsistent, aber eine gemeinsame Konstante wäre robuster. | mehrere Dateien |
| 36 | info | Spieltext-Typo: `shell-canvas.ts` schreibt „DERGEBER MISCHT“ (Leerzeichen fehlt) in der Shuffle-Phase. Daneben stilistische ASCII-Umschriften in Untertiteln („fuenf“, „Huetchen“, „Wuerfel“, „Erhoehungen“) neben echten Umlauten — Stil-Inkonsistenz, kein Logikfehler. | `src/render/games/shell-canvas.ts`, ui-Untertitel |
| 37 | **hoch** | **Poker-Geldweg-Bugfix auf main bestätigt**: `applyAction` setzte den offenen Einsatz vorher aus dem kumulierten `committed` (`bet = me.committed`), nicht aus `streetCommitted` — bei mehreren Strassen wurde der offene Einsatz falsch abgelesen. Auf main korrigiert und per Test „trennt den offenen Einsatz einer Strasse vom kumulierten Einsatz“ gesichert. Ebenso Roulette-Farbkorrektur (Test „31 ist schwarz, zahlt nur Schwarz“). Beide Fixes betreffen Geldwege — nach AGENTS.md wäre `turn:finish:full` Pflicht gewesen (siehe Befund 38). | `src/core/games/poker-table.ts`, `roulette-table.test.ts` |
| 38 | mittel | **Versions-Bump fehlte beim Pull-Batch**: Der Push `708d31c → 492ac3a` (583 Dateien, +3.119/−163) änderte `package.json` nur um zwei Skript-Zeilen (`assets:manifest`, `assets:audio`); die Version blieb **0.3.64**. `turn:finish` bumppt vor `verify` die Patch-Version — der Push scheint ohne diesen Pfad entstanden zu sein; ob `verify:quick` lief, ist aus dem Baum nicht belegbar (CI-Status liegt extern). | `package.json` |
| 39 | mittel | **verify-assets: Duplikat-Prüfung entfernt**: Die Regel „Pfad mehrfach vergeben → Fail“ ist im Manifest-v3-Umbau entfallen (`referenced.add(file)` ohne Prüfung); dieselbe Datei kann jetzt mehreren IDs zugeordnet sein, ohne dass das Gate meckert. Möglicherweise bewusst (Katalog und Engine teilen Dateien), aber eine Registry-Lockerung gegenüber der alten Version. | `scripts/verify-assets.mjs` |
| 40 | niedrig | **Slot-Symbol-Fallback-Keys decken sich nicht mit dem Manifest**: `slot-symbols-extra.ts` definiert gezeichnete Rückfälle unter `GRAPE/SEVEN/BELL/CLOVER/CROWN/STAR/DIAMOND/HORSESHOE/PLUM/WILD`; der Manifest-Generator erzeugt aus den Dateinamen dagegen `GRAPE_CLUSTER/LUCKY_SEVEN/GOLD_BELL/FOUR_LEAF_CLOVER/ROYAL_CROWN/GOLDEN_STAR/BLUE_DIAMOND/LUCKY_HORSESHOE/PURPLE_PLUM/WILD_CROWN`. Aktuell ohne Effekt (die Engine zieht nur `SLOT_SYMBOLS`, deren gezeichnete Rückfälle in `slot-symbols-art.ts` liegen); sobald aber ein EXTRA-Symbol auf die Walze landet, greift stillschweigend das Buch-Rückfallbild. | `src/render/games/slot-symbols-extra.ts`, `scripts/build-asset-manifest.mjs` |
| 41 | niedrig | Hartkodierte Paketgröße „PAKET · 539 TEXTUREN“ im Kopf der Asset-Bibliothek, während der Zähler daneben dynamisch rechnet — bei Paketwachstum veraltet die Eyebrow-Zahl. | `src/ui/asset-library-popup.tsx` |
| 42 | info | **aufgelöst (T10)**: Das Wurzel-Duplikat `ANALYSE-BERICHT-CASINO-FLOOR.md` ist gelöscht; es bleibt nur `docs/ANALYSE-BERICHT-CASINO-FLOOR.md`. | `docs/` |
| 43 | info | **Asset-Pipeline jetzt vollständig (Pull-Batch)**: `scripts/build-asset-manifest.mjs` (neu, Manifest **v3**: ~539 Texturen in 8 Kategorien + Frame-Animationen + Emitter + 6 Musiktracks, Fail-Closed gegen fehlende Dateien), `verify-assets.mjs` auf v3 umgestellt, `main.tsx` preloaded ~1,3 MB (Symbole+Maschinen+Deko+Plinko), `music.ts` mit NIGHT/MENU/BACKGROUND, `App.tsx` ordnet Popups Musikstimmungen zu, Asset-Library-Popup (192 Zeilen) mit Animations-/Emitter-Previews. Konsistenz geprüft: alle ENGINE_SYMBOLS-Pfade (book/scarab/ankh/eye-of-horus/urn/rank-*) existieren im Paket. | `scripts/`, `src/render/`, `src/App.tsx` |
| 44 | info | **Asset-Lizenz: Status im Pull bestätigt — weiterhin unbelegt.** `docs/ASSETS.md` (§ Herkunft und Rechte, unverändert geblieben): die beiliegende README nennt **keine Lizenz und keinen Urheber**, „das Paket ist kein freigegebenes Distributionsmaterial“; vor externer Veröffentlichung muss die Herkunft geklärt bleiben. Das Dokument ist dazu jetzt konsistent ehrlich (539 PNG/7 JSON/6 WAV, ~170 MB Quelle, 13,4 MB ausgeliefert). Offener Punkt 4 bleibt damit aktiv. | `docs/ASSETS.md` |
| 45 | info | **Doku-Double, in T23 einsortiert: `docs/EVENT-NARRATIVE-ENGINE-TASKPLAN.md` (1023 Zeilen)** — sequenzieller Plan NAR-00…NAR-16 für eine datengetriebene Narrative Engine: Typed Sim Facts, Charaktergedächtnis, Beziehungen, Event-Scheduler, Event-Command-DSL mit Allowlist, Content-Registry, LLM-Textadapter (nur Darstellungstext, Regeln bleiben deterministisch), **Save v9**, Migration der beiden bestehenden `demandEvent`s, autonome Rivalen. Basiert auf Stand `708d31c` (vor dem Pull; kleine Veraltungen z. B. Poker-Profile nicht reflektiert — irrelevant für den Plan). NAR-00 bis NAR-03 sind umgesetzt (Save v9). | `docs/EVENT-NARRATIVE-ENGINE-TASKPLAN.md` |
| 47 | info | **Eskalations-Leiter global (T10):** `scripts/lib/escalation.mjs` klassifiziert Befunde in `AUTO_FIX → LOCAL_GATE → REMOTE_CI → AGENT → BLOCKED`; `npm run escalation:plan` nennt die Stufe. Fail-Closed bleibt für Geld/Ledger/RNG/Save. `release-escalation.mjs` bleibt unangetastet (Push-Token), damit keine zweite Leiter entsteht. | `scripts/lib/escalation.mjs`, `scripts/escalation-plan.mjs` |
| 48 | info | **Doc-Gate + Hooks (T10):** `scripts/lib/doc-sync.mjs` führt sechs Pflichtdokumente mit Pflichtabschnitten und `rbd-doc`-Marker (Version + UTC); `verify:docs` ist Gate (`ERR-4017`), der Pre-Commit-Hook schreibt ihn. `deps-matrix` und `catalog` sind keine Gates mehr; Matrix, Katalog und Marker entstehen im Hook. Wurzel-Duplikat `ANALYSE-BERICHT-CASINO-FLOOR.md` (identische MD5) gelöscht. | `scripts/lib/doc-sync.mjs`, `.githooks/`, `scripts/lib/pipeline-plan.mjs` |
| 49 | info | **Import/Export-Engine (T10):** `src/core/io/issues.ts` (42), `envelope.ts` (66), `repair.ts` (42), `src/store/transfer.ts` (46), `src/ui/transfer-panel.tsx` (49) — alle unter ihren LOC-Zonen; keine zweite Save-Wahrheit (`toSavedGame`/`replaySave`), Trockenlauf vor Anwendung, Prüfsumme FNV-1a. Panel sitzt im Prüfungs-Popup. | `src/core/io/`, `src/store/transfer.ts`, `src/ui/transfer-panel.tsx` |
| 46 | info | `docs/ASSETS.md` und `README.md` aktualisiert: README zeigt jetzt Vorher/Nachher-Vergleichsbilder (`docs/screenshots/comparison/`), die Screenshots-README erlaubt dort versionierte Belege (v1/v2) neben dem kanonischen `current/`; `autofix-0911.mjs` räumt `comparison/` bewusst **nicht** mehr (Regel angepasst). Architektur-Matrix zählt die neuen Dateien (build-asset-manifest, plinko-assets, slot-symbols-extra, asset-library-popup) bereits mit. | `README.md`, `docs/screenshots/README.md` |
| 50 | info | **Connector-Eskalation (T11):** `scripts/lift-commit-body.mjs --json` liefert den PR-Plan (`level: AGENT`, `channel: github-connector`, `branch`, `base`, `title`, `bodyFile`, `body`). CI nutzt weiter `gh`; ohne Token bleibt der Lauf grün und der Plan ist die Übergabe. Der Level kommt aus `scripts/lib/escalation.mjs` — keine zweite Leiter. | `scripts/lift-commit-body.mjs`, `docs/ESCALATION.md` || 51 | info | **CI-Lauf #110 rot, Ursache Testvertrag (T12):** `pipeline-modes.test.ts` erwartete noch `deps-matrix`; nach dem Gate-Umbau zwei rote Tests (438 grün, 2 rot). Test auf `docs`-Gate und Entfall von `deps-matrix`/`catalog` nachgezogen, Lesende-Vertrag unverändert. Beweis folgt im nächsten `CI Verify`-Lauf. | `src/core/governance/__tests__/pipeline-modes.test.ts` || 52 | info | **Tree-Gate (`ERR-4019`) beim ersten Lauf:** vier Befunde — `eslint.config.mjs` und `opencode.json` fehlten in der Wurzel-Whitelist, `src/index.css` lag neben `main.tsx` statt unter `src/styles/`, `scripts/init-github.sh` war als Bootstrap-Shell nicht erlaubt. Regeln korrigiert, CSS verschoben, Shell erlaubt. Der Umzug brach drei `@import`-Pfade; der CI-Build fand es, Pfade sind jetzt relativ. | `scripts/verify-tree.mjs`, `src/styles/index.css` |
| 53 | info | **Redundanz-Gate (`ERR-4020`):** 363 Dateien, 45 Skripte und 29 Fehlercodes geprüft, keine echte Doppelung. Bewusste Alias-Paare (`test`/`test:ci`, `verify`/`verify:quick`) sind als Ausnahme dokumentiert; `docs:stub` (`ERR-4021`) erzeugt Pflichteinträge mechanisch. | `scripts/verify-redundancy.mjs`, `scripts/doc-stub.mjs` |
| 54 | info | **Vollständige Inventur (T14):** `scripts/build-inventory.mjs` erzeugt Abschnitt 18 aus `git ls-files`; jede Textdatei wird gelesen (Zeilen, Kopfkommentar), jede Binärdatei an Signatur und Größe geprüft. Eine Zeile je Pfad, ein Eintrag je Ordner, keine Sammelzeile. Der Generator ist deterministisch; nur der Marker trägt die Zeit. | `scripts/build-inventory.mjs` |
| 55 | info | **Abdeckung ist Gate (T14):** `verify:docs` vergleicht den Inventarblock mit `git ls-files`, prüft Ordner und Abdeckungszahl. Rot-Tests belegt: fehlende Datei, fehlender Ordner und falsche Zahl brechen mit `ERR-4017` ab. Der Pre-Commit-Hook baut die Liste vor dem Marker. | `scripts/lib/doc-sync.mjs`, `.githooks/pre-commit` |
| 56 | info | **Versions-Kohärenz (T14):** Der Changelog trug `[0.3.65]`, `package.json` und alle Marker aber `v0.3.64`. Abschnitt auf `[0.3.64]` gezogen; Version bleibt bis `turn:finish` unverändert. | `docs/CHANGELOG.md` |
| 57 | info | **Generator war nicht idempotent (T15):** Der Eintrag für `docs/INVENTORY.md` enthielt seine eigene Zeilenzahl; nach einem Rot-Test schrieb der Generator eine um eins falsche Zahl und erreichte den Ausgangszustand nie wieder. Der Selbsteintrag trägt jetzt einen stabilen Status; zwei Läufe hintereinander ändern nichts (Hash gleich). | `scripts/build-inventory.mjs` |
| 58 | info | **RNG-Namespaces (T16):** `Prng` traegt `gameplay` oder `presentation`; `src/render/rng.ts` haelt den einen Darstellungs-Strom fuer Partikel und Sound, `assertGameplayRng` weist ihn an `tickWorld` und `playRound` ab. Der Save traegt weiter nur den Gameplay-Zustand. | `src/core/rng/streams.ts`, `src/render/rng.ts` |

## 15. Lesedeckung (Verlauf; §18 ist die vollständige Abdeckung)

**Stand T14:** §18 listet alle getrackten Dateien einzeln. Jede Textdatei hat der Generator gelesen (Zeilen, Kopfkommentar), jede Binärdatei wurde an Signatur und Größe geprüft. Die folgende Matrix hält den Verlauf der manuellen Lesereihenfolge fest; ihre 🔶-Zeilen sind mit T14 erledigt, nicht offen.

| Bereich | Status |
| --- | --- |
| Root-Konfiguration (package.json, tsconfig, vite, eslint, capacitor, opencode, .gitignore/.gitattributes, index.html) | ✅ bis letzte Zeile |
| AGENTS.md, README.md | ✅ bis letzte Zeile |
| docs/ (alle 7 .md) | ✅ bis letzte Zeile |
| .github/workflows (alle 5) | ✅ bis letzte Zeile |
| scripts: run-pipeline, lib/pipeline-plan, loc-budgets | ✅ bis letzte Zeile |
| scripts + scripts/lib (29 .mjs + init-github.sh + .env.example = 34) | ✅ **alle 34 bis letzte Zeile gelesen (T6)** — inkl. gate-runner, gate-cache, process-sweep, ts-ast, affected-tests, test-catalog, release-escalation, sanitize/autofix, android/audio |
| core/economy (3), core/rng (3), core/physics (3), core/governance (2) | ✅ bis letzte Zeile |
| core/games: contracts.ts | ✅ bis letzte Zeile |
| core/games (übrige 19 + engines 11) | 🔶 **alle Exporte, Größen und Header erfasst** (Voll-Matrix in T2/T3); Körper nicht zeilenweise |
| core/sim (53 Dateien) | ✅ **alle 53 bis letzte Zeile gelesen** (T2–T5) |
| store (16 produktive Dateien) | ✅ bis letzte Zeile (alle) |
| ui (38 produktiv inkl. 10 games + 2 Tests + **1 neu: asset-library-popup** = 41 Dateien) | ✅ alle 38 alten bis letzte Zeile (T7) **+ asset-library-popup vollständig (T8)**; poker-/roulette-/hud-Änderungen aus dem Pull-Batch per Diff gelesen; TODO/PLACEHOLDER 0 |
| render (43 + **2 neu (plinko-assets, slot-symbols-extra)** + 5 Tests + 2 Benches + manifest v3 = 53 Dateien) | 🔶 6 größte bis letzte Zeile (T7) **+ plinko-assets, slot-symbols-extra, slot-canvas, card-renderer, alle 9 Stages, slot-fx/gamble/layout/reels/symbols-art, actor-pool, art-tokens, comic-bubbles, floor-camera/math/route/stage/surface, music, furniture-art (alt) bis letzte Zeile (T8)**; Änderungen an furniture-art/plinko-canvas/poker-/roulette-canvas/textures/music per Pull-Diff gelesen; Manifest v3 per Konsistenz-Grep geprüft (Engine-Symbole existieren) |
| Tests (86 + BENCH 5; +3 Poker-/1 Roulette-Test im Pull) | 🔶 im Katalog erfasst (System/Beweisklasse/Ziel); neue Tests aus dem Pull per Diff gelesen (Poker-Profile, Street-Einsatz, 31-schwarz); Körper nicht gelesen |
| Pull-Batch `708d31c→492ac3a` (583 Dateien) | ✅ Code-Diff vollständig gelesen (ohne Manifest); 4 neue Code-Dateien bis letzte Zeile; ~550 PNG/OGG strukturiert gezählt + Verzeichnisinventar; ENGINE_SYMBOLS-Konsistenz per Dateisystem-Test bestätigt; ASSETS.md, README, ARCHITECTURE, screenshots-README, Taskplan-Kopf/Struktur gelesen |
| docs/EVENT-NARRATIVE-ENGINE-TASKPLAN.md (1023) | 🔶 Kopf + Zielarchitektur + Taskliste NAR-00…17 gelesen; Körper nicht zeilenweise |
| docs/ANALYSE-BERICHT-CASINO-FLOOR.md (256) | 🔶 Struktur erfasst; Inhalt nicht zeilenweise |
| src/test (2: measure.ts, random-seed.ts) | ✅ beide bis letzte Zeile (T6) |
| index.css, styles, assets/manifest.json | 🔶 Struktur + Manifest vollständig |
| Fehlerregister-Konsistenz | ✅ beide Register abgeglichen: exakt identische 23 Codes (T3 bestätigt) |

## 16. Offene Punkte / Nutzer-Entscheidungen

1. **Befund 1 (spinTest-Doppelaufruf)**: Notice aus demselben Lauf nehmen (1-Zeilen-Fix in `world-store.ts`) — Code-Änderung, erfordert Freigabe.
2. **Befund 2**: README-Formulierung „0,00 VC" präzisieren (Portemonnaie vs. 150 VC Startkapital auf dem Hauskonto) — Doku-Änderung, erfordert Freigabe.
3. **Befund 3/6/7**: offen (ERR-4016-Zuordnung, Windows-Pfad in `opencode.json`, Audit-Drift). **Befund 4/5 erledigt (T23)**: Fehlerkatalog repariert und sortiert, Gate-Zählung vereinheitlicht.
4. **Asset-Lizenz** (ASSETS.md): **vom Nutzer am 01.11.2026 bestätigt — „Lizenzen liegen bei mir".** Damit ist die Weitergabe geklärt; offen bleibt nur der Nachweis im Repo (Referenz/Datei zur Lizenz ergänzen), nicht mehr die Grundsatzfrage.
5. Zeile-für-Zeile-Lesung: **mit T14 abgeschlossen.** §18 belegt jede getrackte Datei (983/983) einzeln; Text wurde gelesen, Binärdateien wurden an Signatur und Größe geprüft. Die Verlaufsmatrix in §15 bleibt als Historie stehen.
6. **Befund 33 (Bar-Kapazitäts-Anzeige)**: drei UI-Dateien von der Sim-Funktion `barCapacityForLevel` auf `12 + 8·max(1, level)` umstellen — kleiner, klar abgegrenzter Fix, erfordert Freigabe.
7. **Befund 34 (`Â·`-Mojibake in table-launcher)**: eine Zeile, rein kosmetisch — bei Freigabe mit Befund 33 zusammen reparierbar.

## 17. Auftrag T9: Governance-, Eskalations- und Transfer-Ausbau (in T10 umgesetzt, hier als Nachweis)

Am **2026-11-01 09:00 UTC** vom Nutzer beauftragt. In diesem Turn wurde **kein Code geändert** — der Auftrag ist hier vollständig festgehalten; alle sieben Punkte sind in T10 umgesetzt (Spalte Status).

| # | Auftrag (Nutzerwortlaut sinngemäß) | Ziel im Repo | Status |
| --- | --- | --- | --- |
| A1 | **Import-/Export-Manager-Engine**, Daten modular geplant, mit **LOC-Cap** | `src/core/io/{issues,envelope,repair}.ts` + `src/store/transfer.ts` + `src/ui/transfer-panel.tsx`; nutzt `toSavedGame`/`replaySave`; je Modul im Engine-/State-/UI-Budget | ✅ umgesetzt (T10) |
| A2 | **Eskalations-Stufen** implementieren, „Falschblocker und automatisch behebbare Fehler durch Eskalation lösen, bevor ein Agent ran muss“ | eine Leiter `AUTO_FIX → LOCAL_GATE → REMOTE_CI → AGENT → BLOCKED` in `scripts/lib/escalation.mjs` + CLI `escalation:plan`; `release-escalation.mjs` bleibt für Push-Token, keine zweite Leiter | ✅ umgesetzt (T10) |
| A3 | **Commit-Bodys nicht fail-closed**: Body wird via GitHub CI in den **PR-Body** gehoben | `.githooks/commit-msg` eskaliert statt zu blockieren; `.github/workflows/pr-escalation.yml` + `scripts/lift-commit-body.mjs` bauen/anlegen den PR-Body | ✅ umgesetzt (T10) |
| A4 | **Doc-synchronisiertes Gate** + **Strukturvorgaben für Docs** + sauberer Tree | `scripts/lib/doc-sync.mjs` (Manifest, Marker, Pflichtabschnitte), Gate `verify:docs` (`ERR-4017`), Wurzel-Whitelist; Wurzel-Duplikat gelöscht | ✅ umgesetzt (T10) |
| A5 | **Pflichtdoku nach JEDER Änderung/Analyse**: Inventar, Changelog, Devtagebuch, Architektur, `AGENTS.md`, Roadmap — mit Version und Timestamp | `docs/CHANGELOG.md`, `docs/DEVTAGEBUCH.md`, `docs/ROADMAP.md`, `docs/ESCALATION.md` angelegt; `## Pflichtdoku` in `AGENTS.md`; Marker-Pflicht im Gate | ✅ umgesetzt (T10) |
| A6 | **Automatisch generierte Matrizen entfernen**; „die Idee korrekt automatisiert als Pre-Commit-Hook implementieren, wo es geht, Rest über AGENTS.md“ | Gates `deps-matrix`/`catalog` entfernt; `.githooks/pre-commit` schreibt Matrix, Katalog und Doku-Marker, prüft Doku + LOC; Aktivierung über `npm run hooks:install` | ✅ umgesetzt (T10) |
| A7 | **Keine Redundanz**; **keine lokalen Tests, die im GitHub-Workflow eskaliert und gelöst werden können** | ein Ort pro Wahrheit (eine Leiter, ein Marker, ein Save-Pfad); Vitest lief in T10 **nicht** lokal, der Beweis bleibt `verify:all` in CI | ✅ umgesetzt (T10) |

**Randbedingungen, die bei der Umsetzung gelten:** Fail-Closed bleibt für echte Regelverstöße (Geld, Ledger, Save-Integrität) bestehen — Eskalation gilt nur für behebbare/außerhalb-des-Scopes liegende Befunde. Kein Gate darf schreiben (bestehende Pipeline-Regel); Auto-Reparatur läuft ausschließlich im `--fix`-Modus oder im Pre-Commit-Hook. Jede neue Datei braucht genau eine Zuständigkeit und ein Budget.

## 18. Vollstaendige Dateiliste (maschinell erzeugt)

Der Block ist deterministisch: eine Zeile je Pfad aus `git ls-files`, ein Eintrag je Ordner. Der Generator liest Textdateien und prueft Binaersignaturen; `verify:docs` vergleicht den Block mit dem Index.

<!-- inventory:start -->

### 18.1 Abdeckung

| Feld | Wert |
| --- | --- |
| Getrackte Dateien | 987 |
| Gelistete Dateien | 987 |
| Getrackte Ordner | 67 |
| Bereiche | (Wurzel) (13), .githooks (2), .github (7), content (2), docs (43), public (552), scripts (48), src (320) |

Regel: jede Zeile entspricht genau einem Pfad aus `git ls-files`; es gibt keine Sammelzeile und keine Ausnahme. `verify:docs` vergleicht den Block mit `git ls-files` und wird rot, sobald eine Datei fehlt oder ein Pfad nicht mehr getrackt ist.

### 18.2 Ordner

- `./` — 13 Datei(en)
- `.githooks/` — 2 Datei(en)
- `.github/workflows/` — 7 Datei(en)
- `content/narrative/contributions/` — 1 Datei(en)
- `content/narrative/vocabulary/` — 1 Datei(en)
- `docs/` — 17 Datei(en)
- `docs/screenshots/` — 1 Datei(en)
- `docs/screenshots/comparison/` — 10 Datei(en)
- `docs/screenshots/current/` — 15 Datei(en)
- `public/assets/casino/characters/` — 69 Datei(en)
- `public/assets/casino/decor/` — 28 Datei(en)
- `public/assets/casino/environment/tiles/` — 2 Datei(en)
- `public/assets/casino/fx/ambient/` — 4 Datei(en)
- `public/assets/casino/fx/animations/` — 3 Datei(en)
- `public/assets/casino/fx/background-elements/` — 6 Datei(en)
- `public/assets/casino/fx/bonus/` — 4 Datei(en)
- `public/assets/casino/fx/emitters/` — 4 Datei(en)
- `public/assets/casino/fx/impacts/explosion/` — 6 Datei(en)
- `public/assets/casino/fx/impacts/plinko/` — 22 Datei(en)
- `public/assets/casino/fx/machines/` — 15 Datei(en)
- `public/assets/casino/fx/particles/coins/` — 12 Datei(en)
- `public/assets/casino/fx/particles/confetti/` — 102 Datei(en)
- `public/assets/casino/fx/particles/glow/` — 7 Datei(en)
- `public/assets/casino/fx/particles/smoke/` — 5 Datei(en)
- `public/assets/casino/fx/particles/sparks/` — 32 Datei(en)
- `public/assets/casino/fx/powerups/` — 8 Datei(en)
- `public/assets/casino/fx/slot/` — 7 Datei(en)
- `public/assets/casino/fx/ui/` — 16 Datei(en)
- `public/assets/casino/machines/` — 36 Datei(en)
- `public/assets/casino/machines/table-games/` — 18 Datei(en)
- `public/assets/casino/music/` — 6 Datei(en)
- `public/assets/casino/plinko/` — 46 Datei(en)
- `public/assets/casino/symbols/` — 24 Datei(en)
- `public/assets/casino/ui/` — 59 Datei(en)
- `public/assets/casino/ui/emotions/` — 4 Datei(en)
- `public/assets/casino/ui/skins/` — 7 Datei(en)
- `scripts/` — 33 Datei(en)
- `scripts/lib/` — 15 Datei(en)
- `src/` — 2 Datei(en)
- `src/core/economy/` — 3 Datei(en)
- `src/core/economy/__tests__/` — 3 Datei(en)
- `src/core/games/` — 20 Datei(en)
- `src/core/games/__tests__/` — 22 Datei(en)
- `src/core/games/engines/` — 11 Datei(en)
- `src/core/games/engines/__tests__/` — 2 Datei(en)
- `src/core/governance/` — 2 Datei(en)
- `src/core/governance/__tests__/` — 11 Datei(en)
- `src/core/io/` — 3 Datei(en)
- `src/core/physics/` — 3 Datei(en)
- `src/core/physics/__tests__/` — 1 Datei(en)
- `src/core/rng/` — 4 Datei(en)
- `src/core/rng/__tests__/` — 3 Datei(en)
- `src/core/sim/` — 53 Datei(en)
- `src/core/sim/__tests__/` — 37 Datei(en)
- `src/core/sim/narrative/` — 4 Datei(en)
- `src/render/` — 25 Datei(en)
- `src/render/__tests__/` — 5 Datei(en)
- `src/render/assets/` — 3 Datei(en)
- `src/render/fx/` — 1 Datei(en)
- `src/render/games/` — 24 Datei(en)
- `src/store/` — 18 Datei(en)
- `src/store/__tests__/` — 11 Datei(en)
- `src/styles/` — 4 Datei(en)
- `src/test/` — 2 Datei(en)
- `src/ui/` — 31 Datei(en)
- `src/ui/__tests__/` — 2 Datei(en)
- `src/ui/games/` — 10 Datei(en)

### 18.3 Dateien

- `.gitattributes` — Zeilenenden: der Generator schreibt LF. Mit core.autocrlf=true erzeugt Git — gelesen: 9 Zeilen
- `.githooks/commit-msg` — Der Commit-Body ist kein Fail-Closed-Gate mehr: fehlende Pflichtsektionen — gelesen: 14 Zeilen
- `.githooks/pre-commit` — Pflege vor jedem Commit. Verify-Gates bleiben lesend; hier wird geschrieben, — gelesen: 20 Zeilen
- `.github/workflows/auto-version-release.yml` — name: Auto Version & Release — gelesen: 90 Zeilen
- `.github/workflows/build-apk.yml` — name: Build Android APK — gelesen: 145 Zeilen
- `.github/workflows/ci-verify.yml` — name: CI Verify — gelesen: 69 Zeilen
- `.github/workflows/long-checks.yml` — name: Long Checks — gelesen: 134 Zeilen
- `.github/workflows/pr-cleanup.yml` — name: PR Cleanup — gelesen: 37 Zeilen
- `.github/workflows/pr-escalation.yml` — name: PR Escalation — gelesen: 44 Zeilen
- `.github/workflows/promote.yml` — name: Promote — gelesen: 51 Zeilen
- `.gitignore` — node_modules/ — gelesen: 16 Zeilen
- `.mailmap` — Eine Anzeige-Identitaet fuer die History: Werkzeuge und Sandboxen committen — gelesen: 6 Zeilen
- `AGENTS.md` — Rigged by Design — gelesen: 97 Zeilen
- `README.md` — Markdown-Dokument — gelesen: 144 Zeilen
- `capacitor.config.json` — { — gelesen: 11 Zeilen
- `content/narrative/contributions/2026-11-01-startpool-01.json` — { — gelesen: 10 Zeilen
- `content/narrative/vocabulary/flags.json` — { — gelesen: 13 Zeilen
- `docs/ANALYSE-BERICHT-CASINO-FLOOR.md` — Analyse-Bericht: VaCoin Casino — Floor, Objekte, Aktionen, Reaktionen — gelesen: 256 Zeilen
- `docs/ARCHITECTURE.md` — Architektur und Governance — gelesen: 217 Zeilen
- `docs/ASSETS.md` — Assets: Auswahl, Pipeline und Messwerte — gelesen: 130 Zeilen
- `docs/CASINO-PIXEL-ASSET-PACK.md` — Casino Pixel Asset Pack — gelesen: 23 Zeilen
- `docs/CHANGELOG.md` — Changelog — gelesen: 70 Zeilen
- `docs/CI-GATES.md` — CI-Gates und Main-Schutz — gelesen: 170 Zeilen
- `docs/DEPENDENCY-AUDIT.md` — Dependency-Audit (Stand 31.10.2026) — gelesen: 303 Zeilen
- `docs/DEVTAGEBUCH.md` — Devtagebuch — gelesen: 416 Zeilen
- `docs/ERROR_CATALOG.md` — Fehlerkatalog — gelesen: 37 Zeilen
- `docs/ESCALATION.md` — Eskalation statt Fail-Closed — gelesen: 71 Zeilen
- `docs/EVENT-NARRATIVE-ENGINE-TASKPLAN.md` — Rigged by Design – sequenzieller Taskplan für die Dynamic Narrative Engine — gelesen: 1023 Zeilen
- `docs/INVENTORY.md` — Inventar: Befunde, Lesedeckung und vollstaendige Dateiliste — gepflegt: Marker und Abschnitt 18
- `docs/NARRATIVE-ENGINE.md` — Narrative Engine — Architekturvertrag (NAR-00) — gelesen: 145 Zeilen
- `docs/PRODUCT.md` — Produkt: Rigged by Design — gelesen: 63 Zeilen
- `docs/ROADMAP.md` — Roadmap — gelesen: 29 Zeilen
- `docs/TEST-CATALOG.md` — Testkatalog — generiert, 111 Zeilen
- `docs/banner.svg` — <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 420" width="1280" height="420" role="img" aria-label — gelesen: 242 Zeilen
- `docs/screenshots/README.md` — Screenshots — gelesen: 79 Zeilen
- `docs/screenshots/comparison/01-floor-v1-vorher.png` — PNG-Textur — geprueft: PNG 1248x900, 99945 B
- `docs/screenshots/comparison/02-floor-v2-nachher.png` — PNG-Textur — geprueft: PNG 1600x1125, 175643 B
- `docs/screenshots/comparison/03-floor-v1-v2.png` — PNG-Textur — geprueft: PNG 2528x900, 311318 B
- `docs/screenshots/comparison/04-asset-library-top-v2.png` — PNG-Textur — geprueft: PNG 1920x1326, 664563 B
- `docs/screenshots/comparison/05-animations-emitter-sounds-v2.png` — PNG-Textur — geprueft: PNG 1920x1326, 190190 B
- `docs/screenshots/comparison/16-floor-assets-ingame.png` — PNG-Textur — geprueft: PNG 2501x1175, 673139 B
- `docs/screenshots/comparison/17-poker-assets-ingame.png` — PNG-Textur — geprueft: PNG 2501x1316, 454538 B
- `docs/screenshots/comparison/18-roulette-assets-ingame.png` — PNG-Textur — geprueft: PNG 2501x1316, 559013 B
- `docs/screenshots/comparison/19-plinko-assets-ingame.png` — PNG-Textur — geprueft: PNG 2501x1175, 341966 B
- `docs/screenshots/comparison/20-slot-assets-ingame.png` — PNG-Textur — geprueft: PNG 2501x1175, 382890 B
- `docs/screenshots/current/01-floor-uebersicht-frisch.png` — PNG-Textur — geprueft: PNG 1248x900, 99945 B
- `docs/screenshots/current/02-floor-detail-frisch.png` — PNG-Textur — geprueft: PNG 1248x900, 137852 B
- `docs/screenshots/current/03-floor-uebersicht-mittel.png` — PNG-Textur — geprueft: PNG 1248x900, 103236 B
- `docs/screenshots/current/04-floor-detail-mittel.png` — PNG-Textur — geprueft: PNG 1248x900, 146242 B
- `docs/screenshots/current/05-floor-uebersicht-konzern.png` — PNG-Textur — geprueft: PNG 1248x900, 101476 B
- `docs/screenshots/current/06-floor-detail-konzern.png` — PNG-Textur — geprueft: PNG 1248x900, 159858 B
- `docs/screenshots/current/07-gaeste-panel.png` — PNG-Textur — geprueft: PNG 1248x900, 124804 B
- `docs/screenshots/current/08-bauen-panel.png` — PNG-Textur — geprueft: PNG 1248x900, 227848 B
- `docs/screenshots/current/09-slot-buehne.png` — PNG-Textur — geprueft: PNG 1280x900, 219484 B
- `docs/screenshots/current/10-huetchen-buehne.png` — PNG-Textur — geprueft: PNG 1248x900, 163039 B
- `docs/screenshots/current/11-blackjack-buehne.png` — PNG-Textur — geprueft: PNG 1248x900, 175070 B
- `docs/screenshots/current/12-poker-buehne.png` — PNG-Textur — geprueft: PNG 1280x900, 167502 B
- `docs/screenshots/current/13-wuerfel-buehne.png` — PNG-Textur — geprueft: PNG 1280x900, 190082 B
- `docs/screenshots/current/14-roulette-buehne.png` — PNG-Textur — geprueft: PNG 1280x900, 222206 B
- `docs/screenshots/current/15-plinko-buehne.png` — PNG-Textur — geprueft: PNG 1280x900, 186860 B
- `eslint.config.mjs` — import js from '@eslint/js'; — gelesen: 126 Zeilen
- `index.html` — <!doctype html> — gelesen: 12 Zeilen
- `opencode.json` — { — gelesen: 10 Zeilen
- `package-lock.json` — { — generiert, 4540 Zeilen
- `package.json` — { — gelesen: 90 Zeilen
- `public/assets/casino/characters/arm-segment-01.png` — PNG-Textur — geprueft: PNG 14x28, 1079 B
- `public/assets/casino/characters/arm-segment-02.png` — PNG-Textur — geprueft: PNG 13x28, 1040 B
- `public/assets/casino/characters/arm-segment-03.png` — PNG-Textur — geprueft: PNG 11x28, 927 B
- `public/assets/casino/characters/arm-segment-04.png` — PNG-Textur — geprueft: PNG 12x28, 988 B
- `public/assets/casino/characters/arm-segment-05.png` — PNG-Textur — geprueft: PNG 13x28, 998 B
- `public/assets/casino/characters/arm-segment-06.png` — PNG-Textur — geprueft: PNG 14x28, 1039 B
- `public/assets/casino/characters/arm-segment-07.png` — PNG-Textur — geprueft: PNG 14x13, 632 B
- `public/assets/casino/characters/arm-segment-08.png` — PNG-Textur — geprueft: PNG 13x28, 1065 B
- `public/assets/casino/characters/arm-segment-09.png` — PNG-Textur — geprueft: PNG 14x27, 971 B
- `public/assets/casino/characters/arm-segment-10.png` — PNG-Textur — geprueft: PNG 14x26, 946 B
- `public/assets/casino/characters/arm-segment-11.png` — PNG-Textur — geprueft: PNG 14x27, 1022 B
- `public/assets/casino/characters/arm-segment-12.png` — PNG-Textur — geprueft: PNG 14x13, 628 B
- `public/assets/casino/characters/arm-segment-13.png` — PNG-Textur — geprueft: PNG 14x28, 1012 B
- `public/assets/casino/characters/arm-segment-14.png` — PNG-Textur — geprueft: PNG 14x13, 647 B
- `public/assets/casino/characters/footwear-part-01.png` — PNG-Textur — geprueft: PNG 23x18, 941 B
- `public/assets/casino/characters/footwear-part-02.png` — PNG-Textur — geprueft: PNG 9x18, 423 B
- `public/assets/casino/characters/footwear-part-03.png` — PNG-Textur — geprueft: PNG 10x18, 485 B
- `public/assets/casino/characters/footwear-part-04.png` — PNG-Textur — geprueft: PNG 9x18, 426 B
- `public/assets/casino/characters/footwear-part-05.png` — PNG-Textur — geprueft: PNG 10x18, 460 B
- `public/assets/casino/characters/footwear-part-06.png` — PNG-Textur — geprueft: PNG 9x18, 444 B
- `public/assets/casino/characters/footwear-part-07.png` — PNG-Textur — geprueft: PNG 10x18, 516 B
- `public/assets/casino/characters/footwear-part-08.png` — PNG-Textur — geprueft: PNG 10x18, 515 B
- `public/assets/casino/characters/footwear-part-09.png` — PNG-Textur — geprueft: PNG 21x18, 1019 B
- `public/assets/casino/characters/footwear-part-10.png` — PNG-Textur — geprueft: PNG 21x18, 903 B
- `public/assets/casino/characters/footwear-part-11.png` — PNG-Textur — geprueft: PNG 20x18, 775 B
- `public/assets/casino/characters/footwear-part-12.png` — PNG-Textur — geprueft: PNG 24x17, 956 B
- `public/assets/casino/characters/footwear-part-13.png` — PNG-Textur — geprueft: PNG 19x18, 858 B
- `public/assets/casino/characters/footwear-part-14.png` — PNG-Textur — geprueft: PNG 24x18, 972 B
- `public/assets/casino/characters/head-01-01.png` — PNG-Textur — geprueft: PNG 32x36, 2151 B
- `public/assets/casino/characters/head-01-02.png` — PNG-Textur — geprueft: PNG 32x36, 2195 B
- `public/assets/casino/characters/head-01-03.png` — PNG-Textur — geprueft: PNG 32x36, 2246 B
- `public/assets/casino/characters/head-01-04.png` — PNG-Textur — geprueft: PNG 32x36, 2110 B
- `public/assets/casino/characters/head-01-05.png` — PNG-Textur — geprueft: PNG 32x36, 1878 B
- `public/assets/casino/characters/head-01-06.png` — PNG-Textur — geprueft: PNG 32x36, 2052 B
- `public/assets/casino/characters/head-01-07.png` — PNG-Textur — geprueft: PNG 32x36, 2003 B
- `public/assets/casino/characters/head-01-08.png` — PNG-Textur — geprueft: PNG 32x36, 1947 B
- `public/assets/casino/characters/head-01-09.png` — PNG-Textur — geprueft: PNG 32x36, 1891 B
- `public/assets/casino/characters/head-02-01.png` — PNG-Textur — geprueft: PNG 32x36, 2129 B
- `public/assets/casino/characters/head-02-02.png` — PNG-Textur — geprueft: PNG 32x36, 2095 B
- `public/assets/casino/characters/head-02-03.png` — PNG-Textur — geprueft: PNG 32x36, 2253 B
- `public/assets/casino/characters/head-02-04.png` — PNG-Textur — geprueft: PNG 32x36, 2095 B
- `public/assets/casino/characters/head-02-05.png` — PNG-Textur — geprueft: PNG 32x36, 2171 B
- `public/assets/casino/characters/head-02-06.png` — PNG-Textur — geprueft: PNG 32x36, 2004 B
- `public/assets/casino/characters/head-02-07.png` — PNG-Textur — geprueft: PNG 32x36, 1967 B
- `public/assets/casino/characters/head-02-08.png` — PNG-Textur — geprueft: PNG 32x36, 2150 B
- `public/assets/casino/characters/head-02-09.png` — PNG-Textur — geprueft: PNG 32x36, 2148 B
- `public/assets/casino/characters/leg-segment-01.png` — PNG-Textur — geprueft: PNG 13x30, 803 B
- `public/assets/casino/characters/leg-segment-02.png` — PNG-Textur — geprueft: PNG 13x30, 785 B
- `public/assets/casino/characters/leg-segment-03.png` — PNG-Textur — geprueft: PNG 12x30, 889 B
- `public/assets/casino/characters/leg-segment-04.png` — PNG-Textur — geprueft: PNG 13x30, 913 B
- `public/assets/casino/characters/leg-segment-05.png` — PNG-Textur — geprueft: PNG 12x30, 839 B
- `public/assets/casino/characters/leg-segment-06.png` — PNG-Textur — geprueft: PNG 12x30, 831 B
- `public/assets/casino/characters/leg-segment-07.png` — PNG-Textur — geprueft: PNG 16x27, 975 B
- `public/assets/casino/characters/leg-segment-08.png` — PNG-Textur — geprueft: PNG 14x30, 852 B
- `public/assets/casino/characters/leg-segment-09.png` — PNG-Textur — geprueft: PNG 14x30, 1115 B
- `public/assets/casino/characters/leg-segment-10.png` — PNG-Textur — geprueft: PNG 13x30, 918 B
- `public/assets/casino/characters/leg-segment-11.png` — PNG-Textur — geprueft: PNG 13x30, 918 B
- `public/assets/casino/characters/leg-segment-12.png` — PNG-Textur — geprueft: PNG 14x30, 887 B
- `public/assets/casino/characters/leg-segment-13.png` — PNG-Textur — geprueft: PNG 15x30, 875 B
- `public/assets/casino/characters/leg-segment-14.png` — PNG-Textur — geprueft: PNG 13x30, 1038 B
- `public/assets/casino/characters/leg-segment-15.png` — PNG-Textur — geprueft: PNG 16x12, 584 B
- `public/assets/casino/characters/torso-outfit-01.png` — PNG-Textur — geprueft: PNG 31x44, 3242 B
- `public/assets/casino/characters/torso-outfit-02.png` — PNG-Textur — geprueft: PNG 30x44, 2694 B
- `public/assets/casino/characters/torso-outfit-03.png` — PNG-Textur — geprueft: PNG 31x44, 3220 B
- `public/assets/casino/characters/torso-outfit-04.png` — PNG-Textur — geprueft: PNG 36x40, 3548 B
- `public/assets/casino/characters/torso-outfit-05.png` — PNG-Textur — geprueft: PNG 35x44, 3630 B
- `public/assets/casino/characters/torso-outfit-06.png` — PNG-Textur — geprueft: PNG 36x41, 3695 B
- `public/assets/casino/characters/torso-outfit-07.png` — PNG-Textur — geprueft: PNG 31x44, 2880 B
- `public/assets/casino/characters/torso-outfit-08.png` — PNG-Textur — geprueft: PNG 36x38, 3455 B
- `public/assets/casino/decor/bar-back-shelf.png` — PNG-Textur — geprueft: PNG 148x157, 36673 B
- `public/assets/casino/decor/bar-counter-stools.png` — PNG-Textur — geprueft: PNG 120x88, 14674 B
- `public/assets/casino/decor/casino-column.png` — PNG-Textur — geprueft: PNG 44x90, 5972 B
- `public/assets/casino/decor/casino-neon-sign.png` — PNG-Textur — geprueft: PNG 96x80, 13683 B
- `public/assets/casino/decor/casino-newspaper.png` — PNG-Textur — geprueft: PNG 48x48, 2707 B
- `public/assets/casino/decor/casino-side-table.png` — PNG-Textur — geprueft: PNG 128x96, 16751 B
- `public/assets/casino/decor/chandelier.png` — PNG-Textur — geprueft: PNG 104x74, 8079 B
- `public/assets/casino/decor/cocktail-neon-sign.png` — PNG-Textur — geprueft: PNG 64x64, 8131 B
- `public/assets/casino/decor/egyptian-cat-statue.png` — PNG-Textur — geprueft: PNG 55x88, 7435 B
- `public/assets/casino/decor/egyptian-column-short.png` — PNG-Textur — geprueft: PNG 39x96, 7159 B
- `public/assets/casino/decor/egyptian-column-tall.png` — PNG-Textur — geprueft: PNG 45x112, 9861 B
- `public/assets/casino/decor/gold-candelabra.png` — PNG-Textur — geprueft: PNG 56x63, 3629 B
- `public/assets/casino/decor/lounge-sofa.png` — PNG-Textur — geprueft: PNG 89x88, 11381 B
- `public/assets/casino/decor/neon-column.png` — PNG-Textur — geprueft: PNG 40x112, 2534 B
- `public/assets/casino/decor/neon-upright-tube.png` — PNG-Textur — geprueft: PNG 24x64, 979 B
- `public/assets/casino/decor/oval-neon-light.png` — PNG-Textur — geprueft: PNG 80x48, 1922 B
- `public/assets/casino/decor/palm-neon.png` — PNG-Textur — geprueft: PNG 80x103, 19205 B
- `public/assets/casino/decor/pendant-lamp.png` — PNG-Textur — geprueft: PNG 48x64, 2098 B
- `public/assets/casino/decor/planter-greenery.png` — PNG-Textur — geprueft: PNG 80x64, 5595 B
- `public/assets/casino/decor/potted-palm-tall.png` — PNG-Textur — geprueft: PNG 59x88, 7436 B
- `public/assets/casino/decor/potted-palm-variant.png` — PNG-Textur — geprueft: PNG 62x88, 11620 B
- `public/assets/casino/decor/potted-palm.png` — PNG-Textur — geprueft: PNG 80x96, 4420 B
- `public/assets/casino/decor/potted-plant.png` — PNG-Textur — geprueft: PNG 64x79, 11259 B
- `public/assets/casino/decor/small-podium.png` — PNG-Textur — geprueft: PNG 64x77, 9758 B
- `public/assets/casino/decor/tabletop-palm.png` — PNG-Textur — geprueft: PNG 56x80, 3433 B
- `public/assets/casino/decor/velvet-rope-barrier.png` — PNG-Textur — geprueft: PNG 96x80, 8263 B
- `public/assets/casino/decor/vip-armchair.png` — PNG-Textur — geprueft: PNG 88x68, 6643 B
- `public/assets/casino/decor/wall-sconce.png` — PNG-Textur — geprueft: PNG 32x64, 2675 B
- `public/assets/casino/environment/tiles/casino-carpet-plum.png` — PNG-Textur — geprueft: PNG 512x512, 28753 B
- `public/assets/casino/environment/tiles/wallpaper-damask-plum.png` — PNG-Textur — geprueft: PNG 512x512, 31371 B
- `public/assets/casino/fx/ambient/ambient-prop-01.png` — PNG-Textur — geprueft: PNG 96x96, 11129 B
- `public/assets/casino/fx/ambient/ambient-prop-02.png` — PNG-Textur — geprueft: PNG 96x96, 9598 B
- `public/assets/casino/fx/ambient/ambient-prop-03.png` — PNG-Textur — geprueft: PNG 96x96, 4870 B
- `public/assets/casino/fx/ambient/ambient-prop-04.png` — PNG-Textur — geprueft: PNG 96x96, 7449 B
- `public/assets/casino/fx/animations/coin-spin.json` — { — gelesen: 19 Zeilen
- `public/assets/casino/fx/animations/explosion.json` — { — gelesen: 13 Zeilen
- `public/assets/casino/fx/animations/smoke-puff.json` — { — gelesen: 12 Zeilen
- `public/assets/casino/fx/background-elements/neon-line-blue.png` — PNG-Textur — geprueft: PNG 128x32, 2854 B
- `public/assets/casino/fx/background-elements/neon-line-violet.png` — PNG-Textur — geprueft: PNG 128x32, 3462 B
- `public/assets/casino/fx/background-elements/neon-ring-blue.png` — PNG-Textur — geprueft: PNG 96x48, 3679 B
- `public/assets/casino/fx/background-elements/neon-strip-cyan.png` — PNG-Textur — geprueft: PNG 128x32, 2332 B
- `public/assets/casino/fx/background-elements/neon-strip-gold.png` — PNG-Textur — geprueft: PNG 128x32, 3115 B
- `public/assets/casino/fx/background-elements/neon-strip-violet.png` — PNG-Textur — geprueft: PNG 128x32, 2927 B
- `public/assets/casino/fx/bonus/egyptian-bonus-01.png` — PNG-Textur — geprueft: PNG 64x64, 5850 B
- `public/assets/casino/fx/bonus/egyptian-bonus-02.png` — PNG-Textur — geprueft: PNG 64x64, 3143 B
- `public/assets/casino/fx/bonus/egyptian-bonus-03.png` — PNG-Textur — geprueft: PNG 64x64, 5982 B
- `public/assets/casino/fx/bonus/egyptian-bonus-04.png` — PNG-Textur — geprueft: PNG 64x64, 6355 B
- `public/assets/casino/fx/emitters/coin-burst.json` — { — gelesen: 29 Zeilen
- `public/assets/casino/fx/emitters/jackpot-burst.json` — { — gelesen: 29 Zeilen
- `public/assets/casino/fx/emitters/machine-sparks.json` — { — gelesen: 21 Zeilen
- `public/assets/casino/fx/emitters/plinko-impact.json` — { — gelesen: 24 Zeilen
- `public/assets/casino/fx/impacts/explosion/explosion-01.png` — PNG-Textur — geprueft: PNG 80x80, 6418 B
- `public/assets/casino/fx/impacts/explosion/explosion-02.png` — PNG-Textur — geprueft: PNG 80x80, 6388 B
- `public/assets/casino/fx/impacts/explosion/explosion-03.png` — PNG-Textur — geprueft: PNG 80x80, 6518 B
- `public/assets/casino/fx/impacts/explosion/explosion-04.png` — PNG-Textur — geprueft: PNG 80x80, 6335 B
- `public/assets/casino/fx/impacts/explosion/explosion-05.png` — PNG-Textur — geprueft: PNG 80x80, 4720 B
- `public/assets/casino/fx/impacts/explosion/explosion-06.png` — PNG-Textur — geprueft: PNG 80x80, 5660 B
- `public/assets/casino/fx/impacts/plinko/peg-hit-01.png` — PNG-Textur — geprueft: PNG 48x48, 2655 B
- `public/assets/casino/fx/impacts/plinko/peg-hit-02.png` — PNG-Textur — geprueft: PNG 48x48, 3295 B
- `public/assets/casino/fx/impacts/plinko/peg-hit-03.png` — PNG-Textur — geprueft: PNG 48x48, 2851 B
- `public/assets/casino/fx/impacts/plinko/peg-hit-04.png` — PNG-Textur — geprueft: PNG 48x48, 2080 B
- `public/assets/casino/fx/impacts/plinko/peg-hit-05.png` — PNG-Textur — geprueft: PNG 48x48, 2269 B
- `public/assets/casino/fx/impacts/plinko/peg-hit-06.png` — PNG-Textur — geprueft: PNG 48x48, 2489 B
- `public/assets/casino/fx/impacts/plinko/peg-hit-07.png` — PNG-Textur — geprueft: PNG 48x48, 2027 B
- `public/assets/casino/fx/impacts/plinko/plinko-ball-trail-01.png` — PNG-Textur — geprueft: PNG 48x64, 2407 B
- `public/assets/casino/fx/impacts/plinko/plinko-ball-trail-02.png` — PNG-Textur — geprueft: PNG 48x64, 2372 B
- `public/assets/casino/fx/impacts/plinko/plinko-ball-trail-03.png` — PNG-Textur — geprueft: PNG 48x64, 2399 B
- `public/assets/casino/fx/impacts/plinko/plinko-ball-trail-04.png` — PNG-Textur — geprueft: PNG 48x64, 1537 B
- `public/assets/casino/fx/impacts/plinko/plinko-ball-trail-05.png` — PNG-Textur — geprueft: PNG 48x64, 2841 B
- `public/assets/casino/fx/impacts/plinko/plinko-ball-trail-06.png` — PNG-Textur — geprueft: PNG 48x64, 2728 B
- `public/assets/casino/fx/impacts/plinko/plinko-ball-trail-07.png` — PNG-Textur — geprueft: PNG 48x64, 1908 B
- `public/assets/casino/fx/impacts/plinko/plinko-ball-trail-08.png` — PNG-Textur — geprueft: PNG 48x64, 1559 B
- `public/assets/casino/fx/impacts/plinko/plinko-ball-trail-09.png` — PNG-Textur — geprueft: PNG 48x64, 2670 B
- `public/assets/casino/fx/impacts/plinko/trail-01.png` — PNG-Textur — geprueft: PNG 64x20, 1207 B
- `public/assets/casino/fx/impacts/plinko/trail-02.png` — PNG-Textur — geprueft: PNG 64x20, 1171 B
- `public/assets/casino/fx/impacts/plinko/trail-03.png` — PNG-Textur — geprueft: PNG 64x20, 818 B
- `public/assets/casino/fx/impacts/plinko/trail-04.png` — PNG-Textur — geprueft: PNG 64x20, 596 B
- `public/assets/casino/fx/impacts/plinko/trail-05.png` — PNG-Textur — geprueft: PNG 64x20, 1487 B
- `public/assets/casino/fx/impacts/plinko/trail-06.png` — PNG-Textur — geprueft: PNG 64x20, 770 B
- `public/assets/casino/fx/machines/machine-light-01.png` — PNG-Textur — geprueft: PNG 64x24, 1367 B
- `public/assets/casino/fx/machines/machine-light-02.png` — PNG-Textur — geprueft: PNG 24x64, 1989 B
- `public/assets/casino/fx/machines/machine-light-03.png` — PNG-Textur — geprueft: PNG 24x64, 1833 B
- `public/assets/casino/fx/machines/machine-light-04.png` — PNG-Textur — geprueft: PNG 24x64, 1781 B
- `public/assets/casino/fx/machines/machine-light-05.png` — PNG-Textur — geprueft: PNG 24x64, 2048 B
- `public/assets/casino/fx/machines/machine-light-06.png` — PNG-Textur — geprueft: PNG 24x64, 1552 B
- `public/assets/casino/fx/machines/machine-light-07.png` — PNG-Textur — geprueft: PNG 64x24, 1180 B
- `public/assets/casino/fx/machines/machine-light-08.png` — PNG-Textur — geprueft: PNG 24x64, 1962 B
- `public/assets/casino/fx/machines/machine-light-09.png` — PNG-Textur — geprueft: PNG 64x24, 1578 B
- `public/assets/casino/fx/machines/machine-light-10.png` — PNG-Textur — geprueft: PNG 64x24, 2227 B
- `public/assets/casino/fx/machines/machine-light-11.png` — PNG-Textur — geprueft: PNG 64x24, 1607 B
- `public/assets/casino/fx/machines/machine-light-12.png` — PNG-Textur — geprueft: PNG 24x64, 1113 B
- `public/assets/casino/fx/machines/machine-light-13.png` — PNG-Textur — geprueft: PNG 64x24, 1794 B
- `public/assets/casino/fx/machines/machine-light-14.png` — PNG-Textur — geprueft: PNG 64x24, 2271 B
- `public/assets/casino/fx/machines/machine-light-15.png` — PNG-Textur — geprueft: PNG 64x24, 2032 B
- `public/assets/casino/fx/particles/coins/coin-spin-01.png` — PNG-Textur — geprueft: PNG 32x32, 1085 B
- `public/assets/casino/fx/particles/coins/coin-spin-02.png` — PNG-Textur — geprueft: PNG 32x32, 1114 B
- `public/assets/casino/fx/particles/coins/coin-spin-03.png` — PNG-Textur — geprueft: PNG 32x32, 1154 B
- `public/assets/casino/fx/particles/coins/coin-spin-04.png` — PNG-Textur — geprueft: PNG 32x32, 1011 B
- `public/assets/casino/fx/particles/coins/coin-spin-05.png` — PNG-Textur — geprueft: PNG 32x32, 1009 B
- `public/assets/casino/fx/particles/coins/coin-spin-06.png` — PNG-Textur — geprueft: PNG 32x32, 1004 B
- `public/assets/casino/fx/particles/coins/coin-spin-07.png` — PNG-Textur — geprueft: PNG 32x32, 862 B
- `public/assets/casino/fx/particles/coins/coin-spin-08.png` — PNG-Textur — geprueft: PNG 32x32, 863 B
- `public/assets/casino/fx/particles/coins/coin-spin-09.png` — PNG-Textur — geprueft: PNG 32x32, 888 B
- `public/assets/casino/fx/particles/coins/coin-spin-10.png` — PNG-Textur — geprueft: PNG 32x32, 947 B
- `public/assets/casino/fx/particles/coins/coin-spin-11.png` — PNG-Textur — geprueft: PNG 32x32, 867 B
- `public/assets/casino/fx/particles/coins/coin-spin-12.png` — PNG-Textur — geprueft: PNG 32x32, 836 B
- `public/assets/casino/fx/particles/confetti/confetti-001.png` — PNG-Textur — geprueft: PNG 16x16, 510 B
- `public/assets/casino/fx/particles/confetti/confetti-002.png` — PNG-Textur — geprueft: PNG 16x16, 459 B
- `public/assets/casino/fx/particles/confetti/confetti-003.png` — PNG-Textur — geprueft: PNG 16x16, 437 B
- `public/assets/casino/fx/particles/confetti/confetti-004.png` — PNG-Textur — geprueft: PNG 16x16, 379 B
- `public/assets/casino/fx/particles/confetti/confetti-005.png` — PNG-Textur — geprueft: PNG 16x16, 501 B
- `public/assets/casino/fx/particles/confetti/confetti-006.png` — PNG-Textur — geprueft: PNG 16x16, 466 B
- `public/assets/casino/fx/particles/confetti/confetti-007.png` — PNG-Textur — geprueft: PNG 16x16, 400 B
- `public/assets/casino/fx/particles/confetti/confetti-008.png` — PNG-Textur — geprueft: PNG 16x16, 414 B
- `public/assets/casino/fx/particles/confetti/confetti-009.png` — PNG-Textur — geprueft: PNG 16x16, 340 B
- `public/assets/casino/fx/particles/confetti/confetti-010.png` — PNG-Textur — geprueft: PNG 16x16, 462 B
- `public/assets/casino/fx/particles/confetti/confetti-011.png` — PNG-Textur — geprueft: PNG 16x16, 496 B
- `public/assets/casino/fx/particles/confetti/confetti-012.png` — PNG-Textur — geprueft: PNG 16x16, 433 B
- `public/assets/casino/fx/particles/confetti/confetti-013.png` — PNG-Textur — geprueft: PNG 16x16, 515 B
- `public/assets/casino/fx/particles/confetti/confetti-014.png` — PNG-Textur — geprueft: PNG 16x16, 445 B
- `public/assets/casino/fx/particles/confetti/confetti-015.png` — PNG-Textur — geprueft: PNG 16x16, 510 B
- `public/assets/casino/fx/particles/confetti/confetti-016.png` — PNG-Textur — geprueft: PNG 16x16, 454 B
- `public/assets/casino/fx/particles/confetti/confetti-017.png` — PNG-Textur — geprueft: PNG 16x16, 502 B
- `public/assets/casino/fx/particles/confetti/confetti-018.png` — PNG-Textur — geprueft: PNG 16x16, 509 B
- `public/assets/casino/fx/particles/confetti/confetti-019.png` — PNG-Textur — geprueft: PNG 16x16, 411 B
- `public/assets/casino/fx/particles/confetti/confetti-020.png` — PNG-Textur — geprueft: PNG 16x16, 487 B
- `public/assets/casino/fx/particles/confetti/confetti-021.png` — PNG-Textur — geprueft: PNG 16x16, 546 B
- `public/assets/casino/fx/particles/confetti/confetti-022.png` — PNG-Textur — geprueft: PNG 16x16, 397 B
- `public/assets/casino/fx/particles/confetti/confetti-023.png` — PNG-Textur — geprueft: PNG 16x16, 236 B
- `public/assets/casino/fx/particles/confetti/confetti-024.png` — PNG-Textur — geprueft: PNG 16x16, 503 B
- `public/assets/casino/fx/particles/confetti/confetti-025.png` — PNG-Textur — geprueft: PNG 16x16, 516 B
- `public/assets/casino/fx/particles/confetti/confetti-026.png` — PNG-Textur — geprueft: PNG 16x16, 502 B
- `public/assets/casino/fx/particles/confetti/confetti-027.png` — PNG-Textur — geprueft: PNG 16x16, 477 B
- `public/assets/casino/fx/particles/confetti/confetti-028.png` — PNG-Textur — geprueft: PNG 16x16, 343 B
- `public/assets/casino/fx/particles/confetti/confetti-029.png` — PNG-Textur — geprueft: PNG 16x16, 497 B
- `public/assets/casino/fx/particles/confetti/confetti-030.png` — PNG-Textur — geprueft: PNG 16x16, 485 B
- `public/assets/casino/fx/particles/confetti/confetti-031.png` — PNG-Textur — geprueft: PNG 16x16, 489 B
- `public/assets/casino/fx/particles/confetti/confetti-032.png` — PNG-Textur — geprueft: PNG 16x16, 536 B
- `public/assets/casino/fx/particles/confetti/confetti-033.png` — PNG-Textur — geprueft: PNG 16x16, 474 B
- `public/assets/casino/fx/particles/confetti/confetti-034.png` — PNG-Textur — geprueft: PNG 16x16, 487 B
- `public/assets/casino/fx/particles/confetti/confetti-035.png` — PNG-Textur — geprueft: PNG 16x16, 443 B
- `public/assets/casino/fx/particles/confetti/confetti-036.png` — PNG-Textur — geprueft: PNG 16x16, 459 B
- `public/assets/casino/fx/particles/confetti/confetti-037.png` — PNG-Textur — geprueft: PNG 16x16, 449 B
- `public/assets/casino/fx/particles/confetti/confetti-038.png` — PNG-Textur — geprueft: PNG 16x16, 470 B
- `public/assets/casino/fx/particles/confetti/confetti-039.png` — PNG-Textur — geprueft: PNG 16x16, 530 B
- `public/assets/casino/fx/particles/confetti/confetti-040.png` — PNG-Textur — geprueft: PNG 16x16, 470 B
- `public/assets/casino/fx/particles/confetti/confetti-041.png` — PNG-Textur — geprueft: PNG 16x16, 490 B
- `public/assets/casino/fx/particles/confetti/confetti-042.png` — PNG-Textur — geprueft: PNG 16x16, 337 B
- `public/assets/casino/fx/particles/confetti/confetti-043.png` — PNG-Textur — geprueft: PNG 16x16, 488 B
- `public/assets/casino/fx/particles/confetti/confetti-044.png` — PNG-Textur — geprueft: PNG 16x16, 466 B
- `public/assets/casino/fx/particles/confetti/confetti-045.png` — PNG-Textur — geprueft: PNG 16x16, 483 B
- `public/assets/casino/fx/particles/confetti/confetti-046.png` — PNG-Textur — geprueft: PNG 16x16, 475 B
- `public/assets/casino/fx/particles/confetti/confetti-047.png` — PNG-Textur — geprueft: PNG 16x16, 525 B
- `public/assets/casino/fx/particles/confetti/confetti-048.png` — PNG-Textur — geprueft: PNG 16x16, 512 B
- `public/assets/casino/fx/particles/confetti/confetti-049.png` — PNG-Textur — geprueft: PNG 16x16, 474 B
- `public/assets/casino/fx/particles/confetti/confetti-050.png` — PNG-Textur — geprueft: PNG 16x16, 393 B
- `public/assets/casino/fx/particles/confetti/confetti-051.png` — PNG-Textur — geprueft: PNG 16x16, 419 B
- `public/assets/casino/fx/particles/confetti/confetti-052.png` — PNG-Textur — geprueft: PNG 16x16, 444 B
- `public/assets/casino/fx/particles/confetti/confetti-053.png` — PNG-Textur — geprueft: PNG 16x16, 478 B
- `public/assets/casino/fx/particles/confetti/confetti-054.png` — PNG-Textur — geprueft: PNG 16x16, 501 B
- `public/assets/casino/fx/particles/confetti/confetti-055.png` — PNG-Textur — geprueft: PNG 16x16, 511 B
- `public/assets/casino/fx/particles/confetti/confetti-056.png` — PNG-Textur — geprueft: PNG 16x16, 511 B
- `public/assets/casino/fx/particles/confetti/confetti-057.png` — PNG-Textur — geprueft: PNG 16x16, 529 B
- `public/assets/casino/fx/particles/confetti/confetti-058.png` — PNG-Textur — geprueft: PNG 16x16, 417 B
- `public/assets/casino/fx/particles/confetti/confetti-059.png` — PNG-Textur — geprueft: PNG 16x16, 416 B
- `public/assets/casino/fx/particles/confetti/confetti-060.png` — PNG-Textur — geprueft: PNG 16x16, 505 B
- `public/assets/casino/fx/particles/confetti/confetti-061.png` — PNG-Textur — geprueft: PNG 16x16, 548 B
- `public/assets/casino/fx/particles/confetti/confetti-062.png` — PNG-Textur — geprueft: PNG 16x16, 481 B
- `public/assets/casino/fx/particles/confetti/confetti-063.png` — PNG-Textur — geprueft: PNG 16x16, 495 B
- `public/assets/casino/fx/particles/confetti/confetti-064.png` — PNG-Textur — geprueft: PNG 16x16, 526 B
- `public/assets/casino/fx/particles/confetti/confetti-065.png` — PNG-Textur — geprueft: PNG 16x16, 420 B
- `public/assets/casino/fx/particles/confetti/confetti-066.png` — PNG-Textur — geprueft: PNG 16x16, 459 B
- `public/assets/casino/fx/particles/confetti/confetti-067.png` — PNG-Textur — geprueft: PNG 16x16, 525 B
- `public/assets/casino/fx/particles/confetti/confetti-068.png` — PNG-Textur — geprueft: PNG 16x16, 483 B
- `public/assets/casino/fx/particles/confetti/confetti-069.png` — PNG-Textur — geprueft: PNG 16x16, 464 B
- `public/assets/casino/fx/particles/confetti/confetti-070.png` — PNG-Textur — geprueft: PNG 16x16, 394 B
- `public/assets/casino/fx/particles/confetti/confetti-071.png` — PNG-Textur — geprueft: PNG 16x16, 436 B
- `public/assets/casino/fx/particles/confetti/confetti-072.png` — PNG-Textur — geprueft: PNG 16x16, 383 B
- `public/assets/casino/fx/particles/confetti/confetti-073.png` — PNG-Textur — geprueft: PNG 16x16, 479 B
- `public/assets/casino/fx/particles/confetti/confetti-074.png` — PNG-Textur — geprueft: PNG 16x16, 500 B
- `public/assets/casino/fx/particles/confetti/confetti-075.png` — PNG-Textur — geprueft: PNG 16x16, 468 B
- `public/assets/casino/fx/particles/confetti/confetti-076.png` — PNG-Textur — geprueft: PNG 16x16, 516 B
- `public/assets/casino/fx/particles/confetti/confetti-077.png` — PNG-Textur — geprueft: PNG 16x16, 406 B
- `public/assets/casino/fx/particles/confetti/confetti-078.png` — PNG-Textur — geprueft: PNG 16x16, 383 B
- `public/assets/casino/fx/particles/confetti/confetti-079.png` — PNG-Textur — geprueft: PNG 16x16, 488 B
- `public/assets/casino/fx/particles/confetti/confetti-080.png` — PNG-Textur — geprueft: PNG 16x16, 524 B
- `public/assets/casino/fx/particles/confetti/confetti-081.png` — PNG-Textur — geprueft: PNG 16x16, 459 B
- `public/assets/casino/fx/particles/confetti/confetti-082.png` — PNG-Textur — geprueft: PNG 16x16, 445 B
- `public/assets/casino/fx/particles/confetti/confetti-083.png` — PNG-Textur — geprueft: PNG 16x16, 493 B
- `public/assets/casino/fx/particles/confetti/confetti-084.png` — PNG-Textur — geprueft: PNG 16x16, 485 B
- `public/assets/casino/fx/particles/confetti/confetti-085.png` — PNG-Textur — geprueft: PNG 16x16, 479 B
- `public/assets/casino/fx/particles/confetti/confetti-086.png` — PNG-Textur — geprueft: PNG 16x16, 363 B
- `public/assets/casino/fx/particles/confetti/confetti-087.png` — PNG-Textur — geprueft: PNG 16x16, 429 B
- `public/assets/casino/fx/particles/confetti/confetti-088.png` — PNG-Textur — geprueft: PNG 16x16, 460 B
- `public/assets/casino/fx/particles/confetti/confetti-089.png` — PNG-Textur — geprueft: PNG 16x16, 482 B
- `public/assets/casino/fx/particles/confetti/confetti-090.png` — PNG-Textur — geprueft: PNG 16x16, 446 B
- `public/assets/casino/fx/particles/confetti/confetti-091.png` — PNG-Textur — geprueft: PNG 16x16, 444 B
- `public/assets/casino/fx/particles/confetti/confetti-092.png` — PNG-Textur — geprueft: PNG 16x16, 476 B
- `public/assets/casino/fx/particles/confetti/confetti-093.png` — PNG-Textur — geprueft: PNG 16x16, 447 B
- `public/assets/casino/fx/particles/confetti/confetti-094.png` — PNG-Textur — geprueft: PNG 16x16, 452 B
- `public/assets/casino/fx/particles/confetti/confetti-095.png` — PNG-Textur — geprueft: PNG 16x16, 378 B
- `public/assets/casino/fx/particles/confetti/confetti-096.png` — PNG-Textur — geprueft: PNG 16x16, 484 B
- `public/assets/casino/fx/particles/confetti/confetti-097.png` — PNG-Textur — geprueft: PNG 16x16, 414 B
- `public/assets/casino/fx/particles/confetti/confetti-098.png` — PNG-Textur — geprueft: PNG 16x16, 465 B
- `public/assets/casino/fx/particles/confetti/confetti-099.png` — PNG-Textur — geprueft: PNG 16x16, 474 B
- `public/assets/casino/fx/particles/confetti/confetti-100.png` — PNG-Textur — geprueft: PNG 16x16, 465 B
- `public/assets/casino/fx/particles/confetti/confetti-101.png` — PNG-Textur — geprueft: PNG 16x16, 404 B
- `public/assets/casino/fx/particles/confetti/confetti-102.png` — PNG-Textur — geprueft: PNG 16x16, 364 B
- `public/assets/casino/fx/particles/glow/glow-01.png` — PNG-Textur — geprueft: PNG 40x40, 1432 B
- `public/assets/casino/fx/particles/glow/glow-02.png` — PNG-Textur — geprueft: PNG 40x40, 2028 B
- `public/assets/casino/fx/particles/glow/glow-03.png` — PNG-Textur — geprueft: PNG 40x40, 2182 B
- `public/assets/casino/fx/particles/glow/glow-04.png` — PNG-Textur — geprueft: PNG 40x40, 2122 B
- `public/assets/casino/fx/particles/glow/glow-05.png` — PNG-Textur — geprueft: PNG 40x40, 1194 B
- `public/assets/casino/fx/particles/glow/glow-06.png` — PNG-Textur — geprueft: PNG 40x40, 2094 B
- `public/assets/casino/fx/particles/glow/glow-07.png` — PNG-Textur — geprueft: PNG 40x40, 2132 B
- `public/assets/casino/fx/particles/smoke/smoke-01.png` — PNG-Textur — geprueft: PNG 64x64, 3817 B
- `public/assets/casino/fx/particles/smoke/smoke-02.png` — PNG-Textur — geprueft: PNG 64x64, 3119 B
- `public/assets/casino/fx/particles/smoke/smoke-03.png` — PNG-Textur — geprueft: PNG 64x64, 3266 B
- `public/assets/casino/fx/particles/smoke/smoke-04.png` — PNG-Textur — geprueft: PNG 64x64, 2769 B
- `public/assets/casino/fx/particles/smoke/smoke-05.png` — PNG-Textur — geprueft: PNG 64x64, 2587 B
- `public/assets/casino/fx/particles/sparks/spark-01.png` — PNG-Textur — geprueft: PNG 32x32, 1284 B
- `public/assets/casino/fx/particles/sparks/spark-02.png` — PNG-Textur — geprueft: PNG 32x32, 1290 B
- `public/assets/casino/fx/particles/sparks/spark-03.png` — PNG-Textur — geprueft: PNG 32x32, 1541 B
- `public/assets/casino/fx/particles/sparks/spark-04.png` — PNG-Textur — geprueft: PNG 32x32, 1369 B
- `public/assets/casino/fx/particles/sparks/spark-05.png` — PNG-Textur — geprueft: PNG 32x32, 1192 B
- `public/assets/casino/fx/particles/sparks/spark-06.png` — PNG-Textur — geprueft: PNG 32x32, 1235 B
- `public/assets/casino/fx/particles/sparks/spark-07.png` — PNG-Textur — geprueft: PNG 32x32, 1443 B
- `public/assets/casino/fx/particles/sparks/spark-08.png` — PNG-Textur — geprueft: PNG 32x32, 1326 B
- `public/assets/casino/fx/particles/sparks/spark-09.png` — PNG-Textur — geprueft: PNG 32x32, 1278 B
- `public/assets/casino/fx/particles/sparks/spark-10.png` — PNG-Textur — geprueft: PNG 32x32, 1295 B
- `public/assets/casino/fx/particles/sparks/spark-11.png` — PNG-Textur — geprueft: PNG 32x32, 1178 B
- `public/assets/casino/fx/particles/sparks/spark-12.png` — PNG-Textur — geprueft: PNG 32x32, 1043 B
- `public/assets/casino/fx/particles/sparks/spark-13.png` — PNG-Textur — geprueft: PNG 32x32, 1058 B
- `public/assets/casino/fx/particles/sparks/spark-14.png` — PNG-Textur — geprueft: PNG 32x32, 976 B
- `public/assets/casino/fx/particles/sparks/spark-15.png` — PNG-Textur — geprueft: PNG 32x32, 1008 B
- `public/assets/casino/fx/particles/sparks/spark-16.png` — PNG-Textur — geprueft: PNG 32x32, 1155 B
- `public/assets/casino/fx/particles/sparks/spark-17.png` — PNG-Textur — geprueft: PNG 32x32, 1213 B
- `public/assets/casino/fx/particles/sparks/spark-18.png` — PNG-Textur — geprueft: PNG 32x32, 1140 B
- `public/assets/casino/fx/particles/sparks/spark-19.png` — PNG-Textur — geprueft: PNG 32x32, 1100 B
- `public/assets/casino/fx/particles/sparks/spark-20.png` — PNG-Textur — geprueft: PNG 32x32, 1178 B
- `public/assets/casino/fx/particles/sparks/spark-21.png` — PNG-Textur — geprueft: PNG 32x32, 1125 B
- `public/assets/casino/fx/particles/sparks/spark-22.png` — PNG-Textur — geprueft: PNG 32x32, 1058 B
- `public/assets/casino/fx/particles/sparks/spark-23.png` — PNG-Textur — geprueft: PNG 32x32, 909 B
- `public/assets/casino/fx/particles/sparks/spark-24.png` — PNG-Textur — geprueft: PNG 32x32, 942 B
- `public/assets/casino/fx/particles/sparks/spark-25.png` — PNG-Textur — geprueft: PNG 32x32, 925 B
- `public/assets/casino/fx/particles/sparks/spark-26.png` — PNG-Textur — geprueft: PNG 32x32, 1052 B
- `public/assets/casino/fx/particles/sparks/spark-27.png` — PNG-Textur — geprueft: PNG 32x32, 831 B
- `public/assets/casino/fx/particles/sparks/spark-28.png` — PNG-Textur — geprueft: PNG 32x32, 900 B
- `public/assets/casino/fx/particles/sparks/spark-29.png` — PNG-Textur — geprueft: PNG 32x32, 1098 B
- `public/assets/casino/fx/particles/sparks/spark-30.png` — PNG-Textur — geprueft: PNG 32x32, 1121 B
- `public/assets/casino/fx/particles/sparks/spark-31.png` — PNG-Textur — geprueft: PNG 32x32, 1006 B
- `public/assets/casino/fx/particles/sparks/spark-32.png` — PNG-Textur — geprueft: PNG 32x32, 983 B
- `public/assets/casino/fx/powerups/clover.png` — PNG-Textur — geprueft: PNG 48x48, 2409 B
- `public/assets/casino/fx/powerups/crown.png` — PNG-Textur — geprueft: PNG 48x48, 2110 B
- `public/assets/casino/fx/powerups/double-multiplier.png` — PNG-Textur — geprueft: PNG 48x48, 2373 B
- `public/assets/casino/fx/powerups/hourglass.png` — PNG-Textur — geprueft: PNG 48x48, 2539 B
- `public/assets/casino/fx/powerups/lightning.png` — PNG-Textur — geprueft: PNG 48x48, 2079 B
- `public/assets/casino/fx/powerups/magnet.png` — PNG-Textur — geprueft: PNG 48x48, 2348 B
- `public/assets/casino/fx/powerups/shield.png` — PNG-Textur — geprueft: PNG 48x48, 2547 B
- `public/assets/casino/fx/powerups/star-token.png` — PNG-Textur — geprueft: PNG 48x48, 2553 B
- `public/assets/casino/fx/slot/slot-reward-01.png` — PNG-Textur — geprueft: PNG 64x64, 5138 B
- `public/assets/casino/fx/slot/slot-reward-02.png` — PNG-Textur — geprueft: PNG 64x64, 5258 B
- `public/assets/casino/fx/slot/slot-reward-03.png` — PNG-Textur — geprueft: PNG 64x64, 4343 B
- `public/assets/casino/fx/slot/slot-reward-04.png` — PNG-Textur — geprueft: PNG 64x64, 3703 B
- `public/assets/casino/fx/slot/slot-reward-05.png` — PNG-Textur — geprueft: PNG 64x64, 5866 B
- `public/assets/casino/fx/slot/slot-reward-06.png` — PNG-Textur — geprueft: PNG 64x64, 3731 B
- `public/assets/casino/fx/slot/slot-reward-07.png` — PNG-Textur — geprueft: PNG 64x64, 4804 B
- `public/assets/casino/fx/ui/fx-icon-01.png` — PNG-Textur — geprueft: PNG 32x32, 665 B
- `public/assets/casino/fx/ui/fx-icon-02.png` — PNG-Textur — geprueft: PNG 32x32, 1310 B
- `public/assets/casino/fx/ui/fx-icon-03.png` — PNG-Textur — geprueft: PNG 32x32, 1482 B
- `public/assets/casino/fx/ui/fx-icon-04.png` — PNG-Textur — geprueft: PNG 32x32, 1370 B
- `public/assets/casino/fx/ui/fx-icon-05.png` — PNG-Textur — geprueft: PNG 32x32, 1496 B
- `public/assets/casino/fx/ui/fx-icon-06.png` — PNG-Textur — geprueft: PNG 32x32, 1275 B
- `public/assets/casino/fx/ui/fx-icon-07.png` — PNG-Textur — geprueft: PNG 32x32, 1497 B
- `public/assets/casino/fx/ui/fx-icon-08.png` — PNG-Textur — geprueft: PNG 32x32, 1121 B
- `public/assets/casino/fx/ui/fx-icon-09.png` — PNG-Textur — geprueft: PNG 32x32, 1151 B
- `public/assets/casino/fx/ui/fx-icon-10.png` — PNG-Textur — geprueft: PNG 32x32, 975 B
- `public/assets/casino/fx/ui/fx-icon-11.png` — PNG-Textur — geprueft: PNG 32x32, 950 B
- `public/assets/casino/fx/ui/fx-icon-12.png` — PNG-Textur — geprueft: PNG 32x32, 1398 B
- `public/assets/casino/fx/ui/fx-icon-13.png` — PNG-Textur — geprueft: PNG 32x32, 1122 B
- `public/assets/casino/fx/ui/fx-icon-14.png` — PNG-Textur — geprueft: PNG 32x32, 1108 B
- `public/assets/casino/fx/ui/fx-icon-15.png` — PNG-Textur — geprueft: PNG 32x32, 987 B
- `public/assets/casino/fx/ui/fx-icon-16.png` — PNG-Textur — geprueft: PNG 32x32, 932 B
- `public/assets/casino/machines/bar-bottle-amber.png` — PNG-Textur — geprueft: PNG 32x64, 2054 B
- `public/assets/casino/machines/bar-bottle-blue.png` — PNG-Textur — geprueft: PNG 32x64, 2110 B
- `public/assets/casino/machines/bar-bottle-green.png` — PNG-Textur — geprueft: PNG 32x64, 2004 B
- `public/assets/casino/machines/bar-bottle-violet.png` — PNG-Textur — geprueft: PNG 32x64, 1940 B
- `public/assets/casino/machines/beer-glass.png` — PNG-Textur — geprueft: PNG 40x64, 2435 B
- `public/assets/casino/machines/blackjack-table.png` — PNG-Textur — geprueft: PNG 140x94, 21667 B
- `public/assets/casino/machines/card-payment-terminal.png` — PNG-Textur — geprueft: PNG 48x64, 3896 B
- `public/assets/casino/machines/cash-register.png` — PNG-Textur — geprueft: PNG 80x64, 4217 B
- `public/assets/casino/machines/cash-safe.png` — PNG-Textur — geprueft: PNG 80x89, 11042 B
- `public/assets/casino/machines/cashier-counter.png` — PNG-Textur — geprueft: PNG 144x85, 14665 B
- `public/assets/casino/machines/casino-kiosk.png` — PNG-Textur — geprueft: PNG 100x148, 20615 B
- `public/assets/casino/machines/casino-prize-pedestal.png` — PNG-Textur — geprueft: PNG 88x136, 16050 B
- `public/assets/casino/machines/chip-stack-blue.png` — PNG-Textur — geprueft: PNG 32x40, 2260 B
- `public/assets/casino/machines/chip-stack-gold.png` — PNG-Textur — geprueft: PNG 32x40, 1929 B
- `public/assets/casino/machines/chip-stack-green.png` — PNG-Textur — geprueft: PNG 32x40, 1856 B
- `public/assets/casino/machines/chip-stack-red.png` — PNG-Textur — geprueft: PNG 32x40, 2205 B
- `public/assets/casino/machines/chip-stack-violet.png` — PNG-Textur — geprueft: PNG 32x40, 2109 B
- `public/assets/casino/machines/cocktail-glass.png` — PNG-Textur — geprueft: PNG 48x64, 2195 B
- `public/assets/casino/machines/coin-tray.png` — PNG-Textur — geprueft: PNG 64x40, 1969 B
- `public/assets/casino/machines/control-button-panel.png` — PNG-Textur — geprueft: PNG 128x48, 3688 B
- `public/assets/casino/machines/dice-table.png` — PNG-Textur — geprueft: PNG 168x68, 10492 B
- `public/assets/casino/machines/display-bezel.png` — PNG-Textur — geprueft: PNG 96x64, 4675 B
- `public/assets/casino/machines/machine-lever.png` — PNG-Textur — geprueft: PNG 32x64, 1933 B
- `public/assets/casino/machines/plinko-cabinet.png` — PNG-Textur — geprueft: PNG 104x132, 21961 B
- `public/assets/casino/machines/poker-table.png` — PNG-Textur — geprueft: PNG 145x97, 22353 B
- `public/assets/casino/machines/restroom-stall.png` — PNG-Textur — geprueft: PNG 144x138, 33240 B
- `public/assets/casino/machines/roulette-table.png` — PNG-Textur — geprueft: PNG 168x72, 12041 B
- `public/assets/casino/machines/service-cart.png` — PNG-Textur — geprueft: PNG 88x138, 19705 B
- `public/assets/casino/machines/shell-game-table.png` — PNG-Textur — geprueft: PNG 160x55, 6234 B
- `public/assets/casino/machines/shot-glass.png` — PNG-Textur — geprueft: PNG 24x40, 1053 B
- `public/assets/casino/machines/slot-cabinet.png` — PNG-Textur — geprueft: PNG 104x145, 24649 B
- `public/assets/casino/machines/slot-machine-compact.png` — PNG-Textur — geprueft: PNG 108x156, 27726 B
- `public/assets/casino/machines/slot-machine-front.png` — PNG-Textur — geprueft: PNG 96x160, 29412 B
- `public/assets/casino/machines/slot-machine-side-panel.png` — PNG-Textur — geprueft: PNG 48x128, 5031 B
- `public/assets/casino/machines/storage-shelves.png` — PNG-Textur — geprueft: PNG 100x139, 24244 B
- `public/assets/casino/machines/table-games/card-back.png` — PNG-Textur — geprueft: PNG 36x50, 4640 B
- `public/assets/casino/machines/table-games/card-shoe-marker.png` — PNG-Textur — geprueft: PNG 15x32, 1255 B
- `public/assets/casino/machines/table-games/chip-stack-blue.png` — PNG-Textur — geprueft: PNG 32x44, 3942 B
- `public/assets/casino/machines/table-games/chip-stack-gold.png` — PNG-Textur — geprueft: PNG 32x45, 4041 B
- `public/assets/casino/machines/table-games/chip-stack-green.png` — PNG-Textur — geprueft: PNG 32x45, 4063 B
- `public/assets/casino/machines/table-games/chip-stack-red.png` — PNG-Textur — geprueft: PNG 32x43, 3927 B
- `public/assets/casino/machines/table-games/chip-stack-violet.png` — PNG-Textur — geprueft: PNG 32x45, 4111 B
- `public/assets/casino/machines/table-games/dealer-button.png` — PNG-Textur — geprueft: PNG 36x32, 3078 B
- `public/assets/casino/machines/table-games/playing-card-ace-hearts.png` — PNG-Textur — geprueft: PNG 36x51, 3742 B
- `public/assets/casino/machines/table-games/playing-card-ace-spades.png` — PNG-Textur — geprueft: PNG 36x52, 3892 B
- `public/assets/casino/machines/table-games/poker-chip-single.png` — PNG-Textur — geprueft: PNG 26x24, 1829 B
- `public/assets/casino/machines/table-games/roulette-betting-layout.png` — PNG-Textur — geprueft: PNG 112x52, 12324 B
- `public/assets/casino/machines/table-games/roulette-wheel.png` — PNG-Textur — geprueft: PNG 88x61, 13051 B
- `public/assets/casino/machines/table-games/shell-game-cups-and-pearl.png` — PNG-Textur — geprueft: PNG 79x96, 14375 B
- `public/assets/casino/machines/table-games/suit-club.png` — PNG-Textur — geprueft: PNG 24x25, 1621 B
- `public/assets/casino/machines/table-games/suit-diamond.png` — PNG-Textur — geprueft: PNG 22x28, 1730 B
- `public/assets/casino/machines/table-games/suit-heart.png` — PNG-Textur — geprueft: PNG 24x24, 1632 B
- `public/assets/casino/machines/table-games/suit-spade.png` — PNG-Textur — geprueft: PNG 24x25, 1615 B
- `public/assets/casino/machines/video-poker-terminal.png` — PNG-Textur — geprueft: PNG 100x160, 25423 B
- `public/assets/casino/music/background.ogg` — OGG/Opus-Audio — geprueft: OGG, 955285 B
- `public/assets/casino/music/floor.ogg` — OGG/Opus-Audio — geprueft: OGG, 687408 B
- `public/assets/casino/music/games.ogg` — OGG/Opus-Audio — geprueft: OGG, 4168383 B
- `public/assets/casino/music/menu.ogg` — OGG/Opus-Audio — geprueft: OGG, 1021549 B
- `public/assets/casino/music/night.ogg` — OGG/Opus-Audio — geprueft: OGG, 2722471 B
- `public/assets/casino/music/slot.ogg` — OGG/Opus-Audio — geprueft: OGG, 4171336 B
- `public/assets/casino/plinko/alternate-peg-lime.png` — PNG-Textur — geprueft: PNG 20x20, 752 B
- `public/assets/casino/plinko/bouncy-peg-cyan.png` — PNG-Textur — geprueft: PNG 20x20, 732 B
- `public/assets/casino/plinko/bumper-cyan.png` — PNG-Textur — geprueft: PNG 64x45, 6106 B
- `public/assets/casino/plinko/bumper-diamond-pink.png` — PNG-Textur — geprueft: PNG 40x40, 1669 B
- `public/assets/casino/plinko/bumper-diamond-steel.png` — PNG-Textur — geprueft: PNG 40x40, 2012 B
- `public/assets/casino/plinko/bumper-diamond-violet.png` — PNG-Textur — geprueft: PNG 40x40, 1677 B
- `public/assets/casino/plinko/bumper-gold.png` — PNG-Textur — geprueft: PNG 64x40, 5877 B
- `public/assets/casino/plinko/bumper-pink.png` — PNG-Textur — geprueft: PNG 62x47, 6631 B
- `public/assets/casino/plinko/bumper-turquoise.png` — PNG-Textur — geprueft: PNG 64x34, 5056 B
- `public/assets/casino/plinko/bumper-violet.png` — PNG-Textur — geprueft: PNG 64x46, 6455 B
- `public/assets/casino/plinko/bumper-wedge-violet.png` — PNG-Textur — geprueft: PNG 64x48, 2359 B
- `public/assets/casino/plinko/corner-deflector-violet.png` — PNG-Textur — geprueft: PNG 64x45, 6537 B
- `public/assets/casino/plinko/deflector-chevron-blue.png` — PNG-Textur — geprueft: PNG 64x48, 2632 B
- `public/assets/casino/plinko/deflector-chevron-teal.png` — PNG-Textur — geprueft: PNG 64x48, 2609 B
- `public/assets/casino/plinko/deflector-rail-gold-horizontal.png` — PNG-Textur — geprueft: PNG 64x32, 976 B
- `public/assets/casino/plinko/deflector-rail-gold-short.png` — PNG-Textur — geprueft: PNG 64x32, 990 B
- `public/assets/casino/plinko/deflector-rail-violet-horizontal.png` — PNG-Textur — geprueft: PNG 64x32, 876 B
- `public/assets/casino/plinko/deflector-rail-violet-left.png` — PNG-Textur — geprueft: PNG 80x32, 1916 B
- `public/assets/casino/plinko/deflector-rail-violet-right.png` — PNG-Textur — geprueft: PNG 80x32, 1949 B
- `public/assets/casino/plinko/deflector-slant-gold.png` — PNG-Textur — geprueft: PNG 64x48, 2016 B
- `public/assets/casino/plinko/deflector-slant-violet.png` — PNG-Textur — geprueft: PNG 64x48, 1762 B
- `public/assets/casino/plinko/magnet-field-pink.png` — PNG-Textur — geprueft: PNG 50x48, 5911 B
- `public/assets/casino/plinko/magnet-field-white.png` — PNG-Textur — geprueft: PNG 42x42, 4491 B
- `public/assets/casino/plinko/magnet-peg-pink.png` — PNG-Textur — geprueft: PNG 20x20, 779 B
- `public/assets/casino/plinko/normal-peg-violet.png` — PNG-Textur — geprueft: PNG 20x20, 740 B
- `public/assets/casino/plinko/payout-10-red.png` — PNG-Textur — geprueft: PNG 40x29, 2616 B
- `public/assets/casino/plinko/payout-10-violet.png` — PNG-Textur — geprueft: PNG 40x30, 2747 B
- `public/assets/casino/plinko/payout-100-gold.png` — PNG-Textur — geprueft: PNG 40x23, 2187 B
- `public/assets/casino/plinko/payout-50-cyan.png` — PNG-Textur — geprueft: PNG 40x24, 2270 B
- `public/assets/casino/plinko/payout-50-green.png` — PNG-Textur — geprueft: PNG 40x26, 2435 B
- `public/assets/casino/plinko/peg-amber.png` — PNG-Textur — geprueft: PNG 32x32, 1404 B
- `public/assets/casino/plinko/peg-cyan.png` — PNG-Textur — geprueft: PNG 32x32, 1436 B
- `public/assets/casino/plinko/peg-gold.png` — PNG-Textur — geprueft: PNG 32x32, 1333 B
- `public/assets/casino/plinko/peg-green.png` — PNG-Textur — geprueft: PNG 32x32, 1308 B
- `public/assets/casino/plinko/peg-pink.png` — PNG-Textur — geprueft: PNG 32x32, 1406 B
- `public/assets/casino/plinko/peg-purple.png` — PNG-Textur — geprueft: PNG 32x32, 1378 B
- `public/assets/casino/plinko/peg-ruby.png` — PNG-Textur — geprueft: PNG 32x32, 1401 B
- `public/assets/casino/plinko/peg-steel.png` — PNG-Textur — geprueft: PNG 32x32, 1475 B
- `public/assets/casino/plinko/split-peg-green.png` — PNG-Textur — geprueft: PNG 20x20, 708 B
- `public/assets/casino/plinko/splitter-hook.png` — PNG-Textur — geprueft: PNG 54x46, 5636 B
- `public/assets/casino/plinko/splitter-magnet.png` — PNG-Textur — geprueft: PNG 50x46, 4845 B
- `public/assets/casino/plinko/splitter-star.png` — PNG-Textur — geprueft: PNG 52x48, 6631 B
- `public/assets/casino/plinko/sticky-peg-gold.png` — PNG-Textur — geprueft: PNG 20x20, 723 B
- `public/assets/casino/plinko/straight-deflector-blue.png` — PNG-Textur — geprueft: PNG 64x47, 6963 B
- `public/assets/casino/plinko/straight-deflector-gold.png` — PNG-Textur — geprueft: PNG 64x48, 6784 B
- `public/assets/casino/plinko/wide-curved-deflector.png` — PNG-Textur — geprueft: PNG 64x30, 4379 B
- `public/assets/casino/symbols/ankh.png` — PNG-Textur — geprueft: PNG 48x48, 2559 B
- `public/assets/casino/symbols/bar-sign.png` — PNG-Textur — geprueft: PNG 64x64, 2935 B
- `public/assets/casino/symbols/blue-diamond.png` — PNG-Textur — geprueft: PNG 64x64, 3276 B
- `public/assets/casino/symbols/book.png` — PNG-Textur — geprueft: PNG 48x48, 3808 B
- `public/assets/casino/symbols/cherries.png` — PNG-Textur — geprueft: PNG 64x64, 4004 B
- `public/assets/casino/symbols/eye-of-horus.png` — PNG-Textur — geprueft: PNG 48x48, 3844 B
- `public/assets/casino/symbols/four-leaf-clover.png` — PNG-Textur — geprueft: PNG 64x64, 4077 B
- `public/assets/casino/symbols/gold-bell.png` — PNG-Textur — geprueft: PNG 64x64, 2998 B
- `public/assets/casino/symbols/golden-star.png` — PNG-Textur — geprueft: PNG 64x64, 2977 B
- `public/assets/casino/symbols/grape-cluster.png` — PNG-Textur — geprueft: PNG 64x64, 4259 B
- `public/assets/casino/symbols/lemon.png` — PNG-Textur — geprueft: PNG 64x64, 3257 B
- `public/assets/casino/symbols/lucky-horseshoe.png` — PNG-Textur — geprueft: PNG 64x64, 4186 B
- `public/assets/casino/symbols/lucky-seven.png` — PNG-Textur — geprueft: PNG 64x64, 3086 B
- `public/assets/casino/symbols/orange.png` — PNG-Textur — geprueft: PNG 64x64, 3514 B
- `public/assets/casino/symbols/purple-plum.png` — PNG-Textur — geprueft: PNG 64x64, 3512 B
- `public/assets/casino/symbols/rank-a.png` — PNG-Textur — geprueft: PNG 48x48, 3009 B
- `public/assets/casino/symbols/rank-j.png` — PNG-Textur — geprueft: PNG 48x48, 2896 B
- `public/assets/casino/symbols/rank-k.png` — PNG-Textur — geprueft: PNG 48x48, 3584 B
- `public/assets/casino/symbols/rank-q.png` — PNG-Textur — geprueft: PNG 48x48, 3629 B
- `public/assets/casino/symbols/royal-crown.png` — PNG-Textur — geprueft: PNG 64x64, 3466 B
- `public/assets/casino/symbols/scarab.png` — PNG-Textur — geprueft: PNG 48x48, 3341 B
- `public/assets/casino/symbols/urn.png` — PNG-Textur — geprueft: PNG 48x48, 2426 B
- `public/assets/casino/symbols/watermelon.png` — PNG-Textur — geprueft: PNG 64x64, 3452 B
- `public/assets/casino/symbols/wild-crown.png` — PNG-Textur — geprueft: PNG 64x64, 4527 B
- `public/assets/casino/ui/analytics.png` — PNG-Textur — geprueft: PNG 32x32, 1176 B
- `public/assets/casino/ui/arrow-forward.png` — PNG-Textur — geprueft: PNG 32x32, 1881 B
- `public/assets/casino/ui/arrow-left.png` — PNG-Textur — geprueft: PNG 32x32, 1718 B
- `public/assets/casino/ui/arrow-right.png` — PNG-Textur — geprueft: PNG 32x32, 1771 B
- `public/assets/casino/ui/bell.png` — PNG-Textur — geprueft: PNG 32x32, 1926 B
- `public/assets/casino/ui/button-purple-alt.png` — PNG-Textur — geprueft: PNG 32x32, 1230 B
- `public/assets/casino/ui/button-purple.png` — PNG-Textur — geprueft: PNG 32x32, 1109 B
- `public/assets/casino/ui/close-cross.png` — PNG-Textur — geprueft: PNG 32x32, 1642 B
- `public/assets/casino/ui/close.png` — PNG-Textur — geprueft: PNG 32x32, 2151 B
- `public/assets/casino/ui/coin-alt.png` — PNG-Textur — geprueft: PNG 32x32, 1780 B
- `public/assets/casino/ui/coin.png` — PNG-Textur — geprueft: PNG 32x32, 1456 B
- `public/assets/casino/ui/crown-badge.png` — PNG-Textur — geprueft: PNG 32x32, 1944 B
- `public/assets/casino/ui/crown.png` — PNG-Textur — geprueft: PNG 32x32, 1063 B
- `public/assets/casino/ui/danger-exclamation-pink.png` — PNG-Textur — geprueft: PNG 32x32, 1834 B
- `public/assets/casino/ui/danger-exclamation.png` — PNG-Textur — geprueft: PNG 32x32, 1829 B
- `public/assets/casino/ui/emotions/emotion-angry.png` — PNG-Textur — geprueft: PNG 80x80, 7455 B
- `public/assets/casino/ui/emotions/emotion-cash.png` — PNG-Textur — geprueft: PNG 80x80, 7576 B
- `public/assets/casino/ui/emotions/emotion-happy.png` — PNG-Textur — geprueft: PNG 80x80, 7106 B
- `public/assets/casino/ui/emotions/emotion-neutral.png` — PNG-Textur — geprueft: PNG 80x80, 6715 B
- `public/assets/casino/ui/fast-forward.png` — PNG-Textur — geprueft: PNG 32x32, 1347 B
- `public/assets/casino/ui/gem.png` — PNG-Textur — geprueft: PNG 32x32, 1254 B
- `public/assets/casino/ui/gift-alt.png` — PNG-Textur — geprueft: PNG 32x32, 1830 B
- `public/assets/casino/ui/gift.png` — PNG-Textur — geprueft: PNG 32x32, 1185 B
- `public/assets/casino/ui/guest-cyan.png` — PNG-Textur — geprueft: PNG 32x32, 1730 B
- `public/assets/casino/ui/guest-pink.png` — PNG-Textur — geprueft: PNG 32x32, 1777 B
- `public/assets/casino/ui/guest-purple.png` — PNG-Textur — geprueft: PNG 32x32, 1932 B
- `public/assets/casino/ui/help.png` — PNG-Textur — geprueft: PNG 32x32, 1484 B
- `public/assets/casino/ui/home.png` — PNG-Textur — geprueft: PNG 32x32, 1632 B
- `public/assets/casino/ui/info.png` — PNG-Textur — geprueft: PNG 32x32, 1293 B
- `public/assets/casino/ui/loyalty-star.png` — PNG-Textur — geprueft: PNG 32x32, 1730 B
- `public/assets/casino/ui/mail.png` — PNG-Textur — geprueft: PNG 32x32, 1741 B
- `public/assets/casino/ui/panel-crown-badge.png` — PNG-Textur — geprueft: PNG 32x32, 1366 B
- `public/assets/casino/ui/panel-gold-status-bar.png` — PNG-Textur — geprueft: PNG 128x48, 2451 B
- `public/assets/casino/ui/panel-header-banner.png` — PNG-Textur — geprueft: PNG 128x48, 3762 B
- `public/assets/casino/ui/panel-small-badge.png` — PNG-Textur — geprueft: PNG 32x32, 814 B
- `public/assets/casino/ui/panel-violet-pill.png` — PNG-Textur — geprueft: PNG 96x48, 2388 B
- `public/assets/casino/ui/pause-alt.png` — PNG-Textur — geprueft: PNG 32x32, 1534 B
- `public/assets/casino/ui/pause.png` — PNG-Textur — geprueft: PNG 32x32, 981 B
- `public/assets/casino/ui/play.png` — PNG-Textur — geprueft: PNG 32x32, 1195 B
- `public/assets/casino/ui/progress-bar-gold.png` — PNG-Textur — geprueft: PNG 32x32, 492 B
- `public/assets/casino/ui/progress-three-segment.png` — PNG-Textur — geprueft: PNG 32x32, 651 B
- `public/assets/casino/ui/role-danger-red.png` — PNG-Textur — geprueft: PNG 32x32, 1401 B
- `public/assets/casino/ui/role-guest-pink.png` — PNG-Textur — geprueft: PNG 32x32, 1523 B
- `public/assets/casino/ui/role-identity-purple.png` — PNG-Textur — geprueft: PNG 32x32, 1601 B
- `public/assets/casino/ui/role-service-cyan.png` — PNG-Textur — geprueft: PNG 32x32, 1451 B
- `public/assets/casino/ui/role-success-green.png` — PNG-Textur — geprueft: PNG 32x32, 1418 B
- `public/assets/casino/ui/role-value-gold.png` — PNG-Textur — geprueft: PNG 32x32, 1334 B
- `public/assets/casino/ui/settings-gear.png` — PNG-Textur — geprueft: PNG 32x32, 1783 B
- `public/assets/casino/ui/settings.png` — PNG-Textur — geprueft: PNG 32x32, 1500 B
- `public/assets/casino/ui/skins/hud-action-button.png` — PNG-Textur — geprueft: PNG 150x64, 3486 B
- `public/assets/casino/ui/skins/hud-casino-header.png` — PNG-Textur — geprueft: PNG 340x78, 4173 B
- `public/assets/casino/ui/skins/hud-daynight-toggle.png` — PNG-Textur — geprueft: PNG 420x76, 4199 B
- `public/assets/casino/ui/skins/hud-machine-detail-panel.png` — PNG-Textur — geprueft: PNG 300x430, 5557 B
- `public/assets/casino/ui/skins/hud-speech-bubble.png` — PNG-Textur — geprueft: PNG 156x112, 4986 B
- `public/assets/casino/ui/skins/hud-stat-panel.png` — PNG-Textur — geprueft: PNG 340x58, 3455 B
- `public/assets/casino/ui/skins/hud-suspicion-meter.png` — PNG-Textur — geprueft: PNG 340x58, 3666 B
- `public/assets/casino/ui/skip-pink.png` — PNG-Textur — geprueft: PNG 32x32, 1750 B
- `public/assets/casino/ui/speech-bubble-alt.png` — PNG-Textur — geprueft: PNG 32x32, 1712 B
- `public/assets/casino/ui/speech-bubble.png` — PNG-Textur — geprueft: PNG 32x32, 1652 B
- `public/assets/casino/ui/star.png` — PNG-Textur — geprueft: PNG 32x32, 1241 B
- `public/assets/casino/ui/success-badge.png` — PNG-Textur — geprueft: PNG 32x32, 1852 B
- `public/assets/casino/ui/success-check-alt.png` — PNG-Textur — geprueft: PNG 32x32, 1844 B
- `public/assets/casino/ui/success-check.png` — PNG-Textur — geprueft: PNG 32x32, 1453 B
- `public/assets/casino/ui/success-heart.png` — PNG-Textur — geprueft: PNG 32x32, 1285 B
- `public/assets/casino/ui/ticket.png` — PNG-Textur — geprueft: PNG 32x32, 1217 B
- `public/assets/casino/ui/tools.png` — PNG-Textur — geprueft: PNG 32x32, 2033 B
- `public/assets/casino/ui/trophy.png` — PNG-Textur — geprueft: PNG 32x32, 1293 B
- `public/assets/casino/ui/vip-bookmark.png` — PNG-Textur — geprueft: PNG 32x32, 1774 B
- `public/assets/casino/ui/warning-exclamation.png` — PNG-Textur — geprueft: PNG 32x32, 1118 B
- `public/assets/casino/ui/warning.png` — PNG-Textur — geprueft: PNG 32x32, 930 B
- `scripts/autofix-0911.mjs` — Sicherer Autofix (ERR-0911): Lint-Fix, Dependency-Matrix, Commit-Sanitizing. — gelesen: 101 Zeilen
- `scripts/balance-run.mjs` — Balance-Spur: startet den 40-Tage-Messlauf als eigenen Prueflauf und legt den Bericht ab. — gelesen: 50 Zeilen
- `scripts/bench-lowend.mjs` — Low-End-Profil: derselbe Benchmark, auf einen Kern gepinnt. — gelesen: 24 Zeilen
- `scripts/branch-cleanup.mjs` — Lokale Wegwerf-Branches nach dem Merge aufraeumen. — gelesen: 43 Zeilen
- `scripts/build-asset-manifest.mjs` — Baut `src/render/assets/manifest.json` aus dem kuratierten Paket unter — gelesen: 113 Zeilen
- `scripts/build-inventory.mjs` — Erzeugt die vollstaendige Dateiliste fuer docs/INVENTORY.md. — gelesen: 128 Zeilen
- `scripts/check-loc.mjs` — LOC-Guard fuer VaCoin Casino Roguelite. — gelesen: 102 Zeilen
- `scripts/ci-long-checks.mjs` — Lange Nachweise ueber GitHub Actions statt auf der eigenen Maschine. — gelesen: 172 Zeilen
- `scripts/ci-tag-release.mjs` — Tag und Release fuer die Version, die im gepushten Commit steht. — gelesen: 100 Zeilen
- `scripts/doc-stub.mjs` — Erzeugt die Pflichteintraege fuer eine Aenderung aus einem Titel. — gelesen: 66 Zeilen
- `scripts/doc-sync.mjs` — Schreibt Version und Zeitstempel in die Pflichtdoku; `--check` prueft nur. — gelesen: 28 Zeilen
- `scripts/encode-audio.mjs` — Musik-Master zu Browser-Audio: die WAV-Dateien bleiben Master und liegen — gelesen: 73 Zeilen
- `scripts/escalation-plan.mjs` — Druckt die Eskalationsstufe zu einem Befund. Ohne Argument liest er die — gelesen: 35 Zeilen
- `scripts/init-github.sh` — Initialisiert das Repo, setzt .gitignore, macht den ersten Commit und legt — gelesen: 47 Zeilen
- `scripts/install-hooks.mjs` — Aktiviert die Repo-Hooks (core.hooksPath) und macht sie ausfuehrbar. — gelesen: 23 Zeilen
- `scripts/lib/affected-tests.mjs` — Betroffene Tests: deklariertes @test-target, der echte Importgraph und das — gelesen: 174 Zeilen
- `scripts/lib/branch-prune.mjs` — Wegwerf-Branches: alles, was auf `main` liegt und nicht `main` ist. — gelesen: 37 Zeilen
- `scripts/lib/doc-sync.mjs` — Pflichtdoku: eine Liste, ein Marker, eine Pruefung. — gelesen: 127 Zeilen
- `scripts/lib/escalation.mjs` — Eine Leiter fuer jeden Fehlschlag, in fester Reihenfolge: — gelesen: 56 Zeilen
- `scripts/lib/gate-cache.mjs` — Inhalts-Hash-Cache: identischer Arbeitsbaum -> gruenes Gate wird nicht erneut gerechnet. — gelesen: 61 Zeilen
- `scripts/lib/gate-runner.mjs` — Fuehrt unabhaengige Gates parallel aus, puffert ihre Ausgabe und nutzt den Inhalts-Cache. — gelesen: 217 Zeilen
- `scripts/lib/identity.mjs` — Eine Identitaet fuer jeden Commit: unabhaengig von Runner, Sandbox und — gelesen: 8 Zeilen
- `scripts/lib/pipeline-plan.mjs` — Der Plan jedes Laufs: `verify` liest ausschliesslich, `fix` repariert. — gelesen: 88 Zeilen
- `scripts/lib/pipeline-stop.mjs` — Abbruchpfad der Pipeline: Signale beenden alle Gates und hinterlassen keine Waisen. — gelesen: 22 Zeilen
- `scripts/lib/process-sweep.mjs` — Verwaiste Gate-Prozesse: PID plus Startzeit, PID-genaues Beenden, nie nach Namensmuster. — gelesen: 188 Zeilen
- `scripts/lib/release-escalation.mjs` — Eskalationsleiter fuer Umgebungsprobleme im Release. — gelesen: 56 Zeilen
- `scripts/lib/report.mjs` — Einheitliches [IDX] [ERR] Format fuer alle Gate-Skripte. — gelesen: 40 Zeilen
- `scripts/lib/test-catalog.mjs` — Testkatalog: jede Testdatei gehoert genau einem System und genau einer — gelesen: 107 Zeilen
- `scripts/lib/tree-changes.mjs` — Arbeitsbaum-Aenderungen als explizite Liste. — gelesen: 54 Zeilen
- `scripts/lib/ts-ast.mjs` — Gemeinsame TypeScript-AST-Basis der Governance-Gates. — gelesen: 89 Zeilen
- `scripts/lift-commit-body.mjs` — Hebt einen Commit-Body in den PR-Body: Eskalation statt Fail-Closed. — gelesen: 84 Zeilen
- `scripts/loc-budgets.mjs` — LOC-Budgets pro Zustaendigkeit. Eine Datei gehoert genau zu einer Rolle: — gelesen: 38 Zeilen
- `scripts/prepare-android.mjs` — Capacitor-Android: Huelle um den Vite-Build, getrennt nach Variante. — gelesen: 65 Zeilen
- `scripts/promote.mjs` — Promote: gruene Staende mergen, rote Staende auf die permanente — gelesen: 155 Zeilen
- `scripts/run-pipeline.mjs` — Fail-Closed-Pipeline in zwei getrennten Modi. — gelesen: 125 Zeilen
- `scripts/sanitize-commit.mjs` — ERR-0911: entfernt verbotene Trailer und Tool-Werbung aus einer Nachricht. — gelesen: 18 Zeilen
- `scripts/sync-dependency-matrix.mjs` — ERR-0911: erzeugt die Live-Dependency-Matrix in docs/ARCHITECTURE.md aus — gelesen: 138 Zeilen
- `scripts/test-affected.mjs` — Schneller Entwicklungsfeedback-Lauf: nur Tests, die vom aktuellen Diff — gelesen: 43 Zeilen
- `scripts/test-catalog.mjs` — Testkatalog schreiben (`npm run catalog`) oder pruefen (`--check`). — gelesen: 55 Zeilen
- `scripts/turn-push.mjs` — Turn-Abschluss: optional affected-Tests, alles stagen, verify:all, deutscher Steam-Notes-Commit, Push nach mai — gelesen: 227 Zeilen
- `scripts/verify-assets.mjs` — Asset-Pruefung: jede Manifest-Referenz zeigt auf eine vorhandene Datei, — gelesen: 88 Zeilen
- `scripts/verify-commit-msg.mjs` — Steam-Developer-Notes-Gate: deutsche Pflichtsektionen, keine Fremd-Trailer. — gelesen: 49 Zeilen
- `scripts/verify-dead-code.mjs` — Fail-Closed Dead-Artifact-Gate: ein Export ist tot, wenn ihn niemand ueber — gelesen: 114 Zeilen
- `scripts/verify-docs.mjs` — Doc-Gate: Struktur, Marker und flacher Wurzelbaum; rot bei Abweichung. — gelesen: 14 Zeilen
- `scripts/verify-redundancy.mjs` — Redundanz-Gate: eine Wahrheit pro Sache. — gelesen: 67 Zeilen
- `scripts/verify-test-quality.mjs` — Fail-Closed-Testvertrag ueber die TypeScript-AST: Header, echte Assertions, — gelesen: 178 Zeilen
- `scripts/verify-tree.mjs` — Tree-Gate: jede Datei liegt in ihrem Ordner, jede Schicht importiert nur nach innen. — gelesen: 99 Zeilen
- `scripts/version-bump.mjs` — Versionsnummer des Turns: wird vor `verify` gebumpt, damit der gepushte Baum — gelesen: 54 Zeilen
- `src/App.tsx` — import { useEffect, useRef, useState } from 'react'; — gelesen: 341 Zeilen
- `src/core/economy/__tests__/economy.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 97 Zeilen
- `src/core/economy/__tests__/ledger-checkpoint.test.ts` — Die volle Pruefung bleibt vollstaendig, die inkrementelle meldet denselben Zustand. — gelesen: 61 Zeilen
- `src/core/economy/__tests__/ledger-diagnose.test.ts` — Diagnose muss Zustand, Buchungszahl und Bruchursache nachvollziehbar liefern. — gelesen: 51 Zeilen
- `src/core/economy/ledger-integrity.ts` — Buchungspruefung als reine Funktionen: kein Geld, nur Nachvollziehbarkeit. — gelesen: 64 Zeilen
- `src/core/economy/ledger.ts` — Doppelte Buchfuehrung fuer VaCoin. Konten sind dynamisch, damit jeder Gast — gelesen: 249 Zeilen
- `src/core/economy/vacoin.ts` — VaCoin (VC) - Geld als ganzzahlige Mikro-Einheiten. — gelesen: 92 Zeilen
- `src/core/games/__tests__/contracts.test.ts` — Eine Runde ist eine Aktion plus Result; die Auszahlung folgt vollstaendig aus beidem. — gelesen: 78 Zeilen
- `src/core/games/__tests__/dice-bets.test.ts` — Jedes Wettfeld am Wuerfeltisch muss exakt sagen, wann es gewinnt, und seine — gelesen: 63 Zeilen
- `src/core/games/__tests__/foreign-round-atomic.test.ts` — Eine fremde Runde wird erst vollstaendig geprueft und gerechnet, dann — gelesen: 77 Zeilen
- `src/core/games/__tests__/game-rounds.test.ts` — Auch die neuen Tischspiele muessen durch denselben Aktionspfad: Einsatz rein, — gelesen: 71 Zeilen
- `src/core/games/__tests__/plinko-sandbox.test.ts` — Rot-Gruen-Beweis fuer die Plinko-Sandbox: Peg-Physik, Reihen-Leiter, — gelesen: 140 Zeilen
- `src/core/games/__tests__/plinko-track.test.ts` — Die Buehne zeigt eine echte Physikbahn. Deshalb muss das Ergebnis die Bahn — gelesen: 44 Zeilen
- `src/core/games/__tests__/poker-distribution.test.ts` — Tischpoker wird nicht ueber ein allgemeines RTP-Band bewertet: Die relevante — gelesen: 43 Zeilen
- `src/core/games/__tests__/poker-table.test.ts` — Rundenpoker am Tisch: Handbewertung, Side Pots nach Einsatzniveaus, — gelesen: 171 Zeilen
- `src/core/games/__tests__/risk-card.test.ts` — Die Risiko-Karte ist doppelte Buchfuehrung: verdoppeln zahlt das fremde Haus, — gelesen: 64 Zeilen
- `src/core/games/__tests__/roulette-table.test.ts` — Das Tableau muss jede Zahl genau einmal abdecken, jede Quote exakt auszahlen — gelesen: 96 Zeilen
- `src/core/games/__tests__/round-rtp-high.test.ts` — Eigene Datei statt einer Schleife in round.test.ts: Vitest verteilt Dateien — gelesen: 27 Zeilen
- `src/core/games/__tests__/round-rtp-machines.test.ts` — Zweite Datei für die günstigen Spiele: sie läuft in einem eigenen Worker — gelesen: 23 Zeilen
- `src/core/games/__tests__/round.bench.ts` — Durchsatz-Messung der Spielrunden. Bewusst nicht Teil von verify:all: — gelesen: 31 Zeilen
- `src/core/games/__tests__/round.test.ts` — Die RTP-Monte-Carlo-Laeufe liegen in round-rtp-high.test.ts und — gelesen: 55 Zeilen
- `src/core/games/__tests__/rtp-bands.ts` — Gemeinsame Parameter der RTP-Monte-Carlo-Laeufe. Kein Testfall: die Messung — gelesen: 55 Zeilen
- `src/core/games/__tests__/shell-round.test.ts` — Das Huetchenspiel muss vor der Wahl feststehen, ehrlich mischen und jede — gelesen: 63 Zeilen
- `src/core/games/__tests__/slot-config.test.ts` — Die Maschinenkonfiguration ist die eine Quelle der Spielparameter: die — gelesen: 129 Zeilen
- `src/core/games/__tests__/slot-paylines.test.ts` — Das Gitter muss die Gewinnlinien exakt tragen: was die Anzeige als Treffer — gelesen: 103 Zeilen
- `src/core/games/__tests__/slot-profile.test.ts` — Der Betreiber stellt Streifen, Gewichte, Bewertungsmodell, Volatilität und — gelesen: 124 Zeilen
- `src/core/games/__tests__/slot-session-rtp.test.ts` — Der Pfad, den Gaeste wirklich spielen, muss dem Haus einen Vorteil lassen. — gelesen: 78 Zeilen
- `src/core/games/__tests__/slot-transparency.test.ts` — Rot-Gruen-Beweis: ehrliche Slot-Historie, physikalische Druckstufen und — gelesen: 106 Zeilen
- `src/core/games/__tests__/test-spin.test.ts` — Alle sieben Spiele laufen im Testmodus derselben Sandbox: eigener Seed, — gelesen: 69 Zeilen
- `src/core/games/contracts.ts` — Die Naht zwischen Spielregel, Geld und Anzeige: Aktion rein, Result raus. — gelesen: 112 Zeilen
- `src/core/games/dice-bets.ts` — Die fuenf Wettfelder am Wuerfeltisch: Trefferregel, Auszahlung und ein einzelner Wurf. — gelesen: 55 Zeilen
- `src/core/games/engines/__tests__/blackjack.test.ts` — Die Runde gehoert dem Spieler: Split, Versicherung, Aufgeben und die — gelesen: 110 Zeilen
- `src/core/games/engines/__tests__/interactive-cards.test.ts` — Blackjack und Video Poker laufen jetzt Zug fuer Zug. Der Kern muss jeden Zug — gelesen: 126 Zeilen
- `src/core/games/engines/blackjack-rules.ts` — Tischregeln und Kartenarithmetik des Blackjacks: was erlaubt ist, was eine Hand — gelesen: 134 Zeilen
- `src/core/games/engines/blackjack-settle.ts` — Dealerzug und Abrechnung: was jede Hand wert ist und wie die Runde endet. — gelesen: 80 Zeilen
- `src/core/games/engines/blackjack.ts` — Blackjack mit echten Entscheidungen: Ziehen, Halten, Verdoppeln, Split, — gelesen: 160 Zeilen
- `src/core/games/engines/cards.ts` — Karten-Engines: Blackjack mit echten Entscheidungen, Video Poker mit Hold/Draw. — gelesen: 143 Zeilen
- `src/core/games/engines/interactive-cards.ts` — Kartenrunden mit Spielerentscheidung: Blackjack Zug fuer Zug, Video Poker mit Hold. — gelesen: 96 Zeilen
- `src/core/games/engines/slot-models.ts` — Die drei Bewertungsmodelle des Slots: Linien, Ways und Cluster. — gelesen: 196 Zeilen
- `src/core/games/engines/slot-odds.ts` — Chancen-Kalibrierung des Slots: wie viel eine Walzenanzahl auszahlt. — gelesen: 63 Zeilen
- `src/core/games/engines/slot-paytable.ts` — Paytable und Gewinnlinien des Slots. — gelesen: 81 Zeilen
- `src/core/games/engines/slot-strips.ts` — Walzenstreifen: Ziehung und angezeigte Chance muessen aus derselben Verteilung kommen. — gelesen: 36 Zeilen
- `src/core/games/engines/slot.ts` — Book-of-VaCoin: drei bis fuenf Walzen, Streifen oder Gewichte, drei Bewertungsmodelle. — gelesen: 150 Zeilen
- `src/core/games/engines/table.ts` — Tischspiele: Roulette mit voller Wettfläche, zwei Wuerfel, Huetchenspiel mit Serie. — gelesen: 121 Zeilen
- `src/core/games/plinko-board.ts` — Plinko als echte Simulation: Zufall nur in den Startbedingungen, danach entscheidet die Kollision. — gelesen: 130 Zeilen
- `src/core/games/plinko-config.ts` — Reine Plinko-Konfiguration: Peg-Profile, Taschenbreiten und Reihen-Leiter. — gelesen: 100 Zeilen
- `src/core/games/plinko-sandbox.ts` — Plinko-Sandbox: RTP-Gate, Fortschritt und der Wurf, der Weltzustand und Anzeige verbindet. — gelesen: 161 Zeilen
- `src/core/games/poker-hand.ts` — Fuenf- bis Siebenkarten-Bewertung fuer den Rundenpoker-Tisch. — gelesen: 83 Zeilen
- `src/core/games/poker-round.ts` — Automatik-Runde fuer Simulation, Test und Fremdhaeuser: dieselbe Hand wie am — gelesen: 24 Zeilen
- `src/core/games/poker-settle.ts` — Abrechnung: Side Pots nach Einsatzniveaus, Hausanteil vom Pot, Endlabel. — gelesen: 93 Zeilen
- `src/core/games/poker-strategy.ts` — Spielerische Entscheidungen: Staerke aus den Karten, Aktion aus Staerke und Pot. — gelesen: 106 Zeilen
- `src/core/games/poker-table.ts` — Rundenpoker am Tisch: vier Spieler, je Strasse eine Setzrunde, Pot für alle. — gelesen: 158 Zeilen
- `src/core/games/poker-types.ts` — Gemeinsame Formen der Pokerrunde: Tisch, Spieler, Ergebnis. — gelesen: 56 Zeilen
- `src/core/games/risk-card.ts` — Risiko-Karte nach einem Gewinn: eine Farbe, 50/50, gebucht in doppelter Buchfuehrung. — gelesen: 44 Zeilen
- `src/core/games/roulette-table.ts` — Europaeisches Roulette-Tableau: mehrere Jetons gleichzeitig, eine Kugel. — gelesen: 128 Zeilen
- `src/core/games/round.ts` — Dispatcher: jedes Spiel hat seine eigene Engine, alle liefern dieselbe Ergebnisform. — gelesen: 87 Zeilen
- `src/core/games/sandbox.ts` — Ein Regelsatz, zwei Ausfuehrungsmodi. — gelesen: 61 Zeilen
- `src/core/games/shell-round.ts` — Huetchenspiel als interaktive Runde: erst mischen (Kern), dann waehlt der Spieler. — gelesen: 68 Zeilen
- `src/core/games/slot-config.ts` — Maschinenkonfiguration: die eine Quelle der Spielparameter. — gelesen: 104 Zeilen
- `src/core/games/slot-profile.ts` — Konfigurierbare Spielmechanik des Slots: Gewichte, Bewertungsmodell, Volatilitaet, — gelesen: 152 Zeilen
- `src/core/games/slot-session.ts` — Ein Slot-Spin mit Gedächtnis: Drucklader und Entladung werden hier tatsaechlich konsumiert. — gelesen: 59 Zeilen
- `src/core/games/slot-transparency.ts` — Ehrliches Slot-Gedächtnis und der Drucklader; reine, serialisierbare Zustandslogik. — gelesen: 88 Zeilen
- `src/core/governance/__tests__/affected-tests.test.ts` — Die Auswahl muss deklarierte Ziele, direkte Importe und das betroffene — gelesen: 55 Zeilen
- `src/core/governance/__tests__/branch-prune.test.ts` — Nach dem Merge mit gruenen Gates ist ein Wegwerf-Branch nur noch Arbeit, die — gelesen: 39 Zeilen
- `src/core/governance/__tests__/ci-gates.test.ts` — Ebene A des Main-Gates: `main` ist kein Sonderfall mehr, und der — gelesen: 177 Zeilen
- `src/core/governance/__tests__/dependency-governance.test.ts` — import { readFileSync, readdirSync } from 'node:fs'; — gelesen: 77 Zeilen
- `src/core/governance/__tests__/gate-runner.test.ts` — Ein haengendes Gate darf den Lauf nicht offen halten: Nach dem harten Limit — gelesen: 86 Zeilen
- `src/core/governance/__tests__/pipeline-modes.test.ts` — Ein Pruefer darf die Akte nicht vorher umschreiben. Kein Verify-Profil — gelesen: 60 Zeilen
- `src/core/governance/__tests__/process-sweep.test.ts` — Der Abbruchpfad muss echte Prozesse beenden und die Registry raeumen; sonst — gelesen: 134 Zeilen
- `src/core/governance/__tests__/release-escalation.test.ts` — Umgebungsprobleme muessen automatisch eine Stufe hoeher gehen, statt als — gelesen: 36 Zeilen
- `src/core/governance/__tests__/scripts-libs.d.ts` — Deklarationen fuer die JS-Bibliotheken unter scripts/lib (kein allowJs im Projekt). — gelesen: 135 Zeilen
- `src/core/governance/__tests__/test-catalog.test.ts` — Jede Testdatei gehoert genau einem System und genau einer Beweisklasse. — gelesen: 68 Zeilen
- `src/core/governance/__tests__/tree-changes.test.ts` — Der Fix-Modus muss jede Aenderung nennen, auch Loeschungen. Ein stilles — gelesen: 41 Zeilen
- `src/core/governance/error-codes.ts` — Zentrales Fehlerregister. Jeder Gate-, Test- und Laufzeitfehler nennt hier — gelesen: 58 Zeilen
- `src/core/governance/test-harness.ts` — Vitest-Reporter fuer den Fail-Closed-Testvertrag: jeder Testfall wird mit — gelesen: 50 Zeilen
- `src/core/io/envelope.ts` — Umschlag fuer Spielstand-Exporte: Art, Format, Pruefsumme, Nutzlast. — gelesen: 66 Zeilen
- `src/core/io/issues.ts` — Import-Befunde: blockieren, automatisch reparieren oder ignorieren. — gelesen: 42 Zeilen
- `src/core/io/repair.ts` — Repariert, was ohne Regelverstoss reparierbar ist; Blocker bleiben Blocker. — gelesen: 42 Zeilen
- `src/core/physics/__tests__/physics.test.ts` — Fester Zeitschritt, echte Impulse: die Render-FPS darf den Ausgang nicht aendern. — gelesen: 124 Zeilen
- `src/core/physics/body.ts` — Koerper der Headless-Physik: lokale Form, Welt-Transformation, Masse und Traegheit. — gelesen: 133 Zeilen
- `src/core/physics/geometry.ts` — Geometrie fuer Kollisionen: naechster Punkt, Punkt-in-Polygon, Kanten, Oberflaechengeschwindigkeit. — gelesen: 45 Zeilen
- `src/core/physics/world.ts` — Deterministische 2D-Physik: fester Zeitschritt, Impulse, Drehmoment, kein Renderer. — gelesen: 189 Zeilen
- `src/core/rng/__tests__/shoe.test.ts` — Ein Schuh gibt jede Karte genau einmal aus, bevor er neu mischt. — gelesen: 66 Zeilen
- `src/core/rng/__tests__/streams.test.ts` — Gameplay- und Darstellungsstrom teilen keinen Zustand: Effekte duerfen den — gelesen: 46 Zeilen
- `src/core/rng/__tests__/weighted.test.ts` — Die ausgewiesene Chance stammt aus derselben Verteilung, aus der gezogen wird. — gelesen: 99 Zeilen
- `src/core/rng/prng.ts` — Deterministischer Mulberry32-PRNG. Zustand ist ein uint32 und exakt wiederherstellbar. — gelesen: 56 Zeilen
- `src/core/rng/shoe.ts` — Kartenschuh ohne Zuruecklegen: eine gezogene Karte verlaesst den Schuh wirklich. — gelesen: 51 Zeilen
- `src/core/rng/streams.ts` — Zwei Stroeme, zwei Namespaces: Darstellung darf den Spielzustand nie bewegen. — gelesen: 34 Zeilen
- `src/core/rng/weighted.ts` — Gewichtetes Zahlenziehen: Angezeigte Chance und Ziehung stammen aus derselben Verteilung. — gelesen: 126 Zeilen
- `src/core/sim/__tests__/balance-harness.ts` — Betriebs-Messlauf: ein skriptierter Betreiber (bauen, einstellen, reparieren, ausbauen) — gelesen: 154 Zeilen
- `src/core/sim/__tests__/balance-metrics.ts` — Kennzahlen des Betriebs-Messlaufs: Was Gaeste erleben, je Spieltag gezaehlt. — gelesen: 174 Zeilen
- `src/core/sim/__tests__/balance-operating.test.ts` — Betriebs-Messlauf (nur mit RBD_BALANCE=1): Ankuenfte, Warteschlangen, Wartezeiten, — gelesen: 66 Zeilen
- `src/core/sim/__tests__/balance-report.ts` — Balance-Spur: macht den 40-Tage-Messlauf nachvollziehbar und pruefbar. — gelesen: 94 Zeilen
- `src/core/sim/__tests__/brawl-combat.test.ts` — Die Siegchance im Tooltip ist keine Schaetzung: dieselbe Konstellation — gelesen: 77 Zeilen
- `src/core/sim/__tests__/demand.test.ts` — Nachfrage ist geplant: erster Gast terminiert, Quellen addieren sich, — gelesen: 118 Zeilen
- `src/core/sim/__tests__/device-identity.test.ts` — Geräteidentität und Spieltyp sind zwei Fragen. Der Katalog entscheidet, — gelesen: 46 Zeilen
- `src/core/sim/__tests__/duel.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 180 Zeilen
- `src/core/sim/__tests__/expansion.test.ts` — Ein Ausbau erhaelt Einrichtung, IDs, Gaeste, Personal und offene Anspruche; — gelesen: 166 Zeilen
- `src/core/sim/__tests__/foreign-floor-tick.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 52 Zeilen
- `src/core/sim/__tests__/grid-zones.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 87 Zeilen
- `src/core/sim/__tests__/guest-flow.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 149 Zeilen
- `src/core/sim/__tests__/guest-settlement.test.ts` — Kein Gast und kein Anspruch verschwindet, solange die Buchung nicht vollstaendig ist. — gelesen: 88 Zeilen
- `src/core/sim/__tests__/journal.test.ts` — Jede Buchung wird genau einmal kopiert; Welt-Ereignisse tragen Ursache und Folge. — gelesen: 94 Zeilen
- `src/core/sim/__tests__/logistics.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 64 Zeilen
- `src/core/sim/__tests__/look.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 28 Zeilen
- `src/core/sim/__tests__/mod-guards.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 24 Zeilen
- `src/core/sim/__tests__/mod-resolver.test.ts` — Mod-Wirkungen entstehen an genau einer Stelle: der gemeinsame Resolver — gelesen: 53 Zeilen
- `src/core/sim/__tests__/money-truth.test.ts` — Fiat ist vom Spawn an ein gebuchtes Konto; Auszahlungen werden nie still gekappt. — gelesen: 95 Zeilen
- `src/core/sim/__tests__/movement-queue.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 137 Zeilen
- `src/core/sim/__tests__/narrative-facts.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 75 Zeilen
- `src/core/sim/__tests__/narrative-memory.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 77 Zeilen
- `src/core/sim/__tests__/narrative-start-pool.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 57 Zeilen
- `src/core/sim/__tests__/pathfinding.test.ts` — Der Heap-A* liefert weiterhin kuerzeste, zusammenhaengende Wege; der Nav-Cache — gelesen: 107 Zeilen
- `src/core/sim/__tests__/player-jobs.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 170 Zeilen
- `src/core/sim/__tests__/player-rpg.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 93 Zeilen
- `src/core/sim/__tests__/player-speed.test.ts` — Speed war einmal nur ein gespeicherter Attributwert. Dieser Test haelt fest, — gelesen: 67 Zeilen
- `src/core/sim/__tests__/progression.test.ts` — Unternehmensstufen nennen echte Bedingungen; gesperrte Ware sagt, was fehlt. — gelesen: 171 Zeilen
- `src/core/sim/__tests__/reputation.test.ts` — Ruf ist Betriebserfahrung: Ein frischer Automat in gutem Zustand ist kein Ruf, — gelesen: 65 Zeilen
- `src/core/sim/__tests__/rivals.test.ts` — Fremde Haeuser nutzen echte Spiele und Regeln, driften deterministisch und — gelesen: 78 Zeilen
- `src/core/sim/__tests__/shot-seed.test.ts` — Screenshot-Saat: eine eingerichtete Etage als Save-JSON ablegen, damit die — gelesen: 70 Zeilen
- `src/core/sim/__tests__/soak.test.ts` — Langlauf: Ledger bleibt integer und gedeckt, und der Betrieb steht ueber — gelesen: 110 Zeilen
- `src/core/sim/__tests__/staff-status.test.ts` — Der Personalstatus lebt ausschliesslich in den Agenten: ohne Agent keine — gelesen: 82 Zeilen
- `src/core/sim/__tests__/tycoon-needs.test.ts` — Bedürfnisse steuern Gastentscheidungen; Wut wird zum sichtbaren Streit mit Schaden. — gelesen: 180 Zeilen
- `src/core/sim/__tests__/tycoon-ops.test.ts` — Käufe kommen als Kiste, Personal arbeitet auf dem Floor, WC verstopft, Umbau braucht Ruf. — gelesen: 221 Zeilen
- `src/core/sim/__tests__/visitors.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 97 Zeilen
- `src/core/sim/__tests__/world.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 201 Zeilen
- `src/core/sim/actions.ts` — Commands, die nicht im Tick passieren: Bewegung, Reinigung, Preise, Mods, fremde Spiele. — gelesen: 164 Zeilen
- `src/core/sim/board-constants.ts` — Feste Brett- und Teppichwerte; aus types.ts ausgelagert, damit die Typdatei unter dem LOC-Limit bleibt. — gelesen: 11 Zeilen
- `src/core/sim/brawl-combat.ts` — Spielerkampf: Lebenspunkte, Trefferchancen und Runden, deren Anzeige exakt aus der Mechanik kommt. — gelesen: 136 Zeilen
- `src/core/sim/charisma-talk.ts` — Charisma-Ansprache: Erfolg hebt die Laune, ein Fehlschlag kann zur Prügelei werden. — gelesen: 53 Zeilen
- `src/core/sim/deliveries.ts` — Lieferkette: Käufe kommen als Kiste am Eingang an und werden körperlich verteilt. — gelesen: 197 Zeilen
- `src/core/sim/demand.ts` — Nachfrage: Ankuenfte werden geplant statt pro Tick gewuerfelt. — gelesen: 191 Zeilen
- `src/core/sim/desk-service.ts` — Kasse: Warteschlange, Bedienzeit und Wechsel von Fiat in Chips. — gelesen: 45 Zeilen
- `src/core/sim/device.ts` — Geräteidentität und Spieltyp sind zwei verschiedene Fragen. — gelesen: 44 Zeilen
- `src/core/sim/disputes.ts` — Streit: Wut wird zum sichtbaren Disput mit Position, Beteiligten und Eskalation. — gelesen: 141 Zeilen
- `src/core/sim/duel-opponent.ts` — Gegnerprofil eines Streits: abgeleitet, ohne PRNG, damit Vorschau und Kampf gleich sehen. — gelesen: 56 Zeilen
- `src/core/sim/duel.ts` — Duell: ein echter Kampf mit Lebenspunkten gegen den Rädelsführer des Streits, inklusive Überfall-Folge. — gelesen: 126 Zeilen
- `src/core/sim/economics.ts` — Wirtschaftliche Kennzahlen als reine Ableitung aus den Ledger-Buchungen. — gelesen: 119 Zeilen
- `src/core/sim/emotion.ts` — Was ein Gast gerade fühlt: eine Grafik statt eines Satzes. — gelesen: 51 Zeilen
- `src/core/sim/expansions.ts` — Ausbau: das Haus waechst aus dem Bestand heraus. Nichts wird ersetzt, alles bleibt. — gelesen: 97 Zeilen
- `src/core/sim/fight-fx.ts` — Kurzlebige Kampf-Rueckmeldung: der Streit ist schon entschieden, der Floor zeigt — gelesen: 11 Zeilen
- `src/core/sim/foreign-floor-tick.ts` — Simulationslogik für fremde Casinos (Foreign Floors). — gelesen: 81 Zeilen
- `src/core/sim/grid-zones.ts` — 30x30-Bereiche, Multi-Tile-Footprints und Zugangs-Tiles. Reine Grid-Politik, kein Rendering. — gelesen: 108 Zeilen
- `src/core/sim/guest-choice.ts` — Was ein Gast als Nächstes tut: Bedürfnis, freier Platz, Ausweichen statt Stillstand. — gelesen: 118 Zeilen
- `src/core/sim/guest-core.ts` — Gemeinsame Gast-Basis ohne Entscheidungs- oder Spielwissen. — gelesen: 21 Zeilen
- `src/core/sim/guest-play.ts` — Spielen, Trinken, Klo: jeder Aufruf endet in einer konkreten Aktion, nicht in Zahlenrauschen. — gelesen: 101 Zeilen
- `src/core/sim/guest-service.ts` — Gast verlässt den Floor, wird wütend und wird ausgezahlt. — gelesen: 76 Zeilen
- `src/core/sim/guests.ts` — Fassade des Gastverhaltens: die Details liegen in kleinen, getrennten Modulen. — gelesen: 5 Zeilen
- `src/core/sim/house-presets.ts` — Haus-Vorlagen: Zonen und Moebel-Fabriken für klein, mittel, gross. — gelesen: 119 Zeilen
- `src/core/sim/journal.ts` — Ereignisprotokoll: jeder wichtige Zustand mit Ursache, Wirkung und Akteur. — gelesen: 145 Zeilen
- `src/core/sim/money.ts` — Geldwege: jeder Cent ist eine Ledger-Buchung, nie ein direkter Zähler. — gelesen: 123 Zeilen
- `src/core/sim/movement-queue.ts` — Zentrale Bewegungs- und Warteschlangen-Logik für alle Entitäten. — gelesen: 114 Zeilen
- `src/core/sim/mugging.ts` — Simulierter Überfall nach einer verlorenen Prügelei: Ziel wählen, greifen, fliehen. — gelesen: 79 Zeilen
- `src/core/sim/narrative/facts.ts` — Fact-Queue: typisierte, einmalige Ereignisse mit stabiler ID — getrennt vom Journal. — gelesen: 51 Zeilen
- `src/core/sim/narrative/memory.ts` — Charaktergedaechtnis: aus Facts werden strukturierte Erinnerungen und messbare Wirkung. — gelesen: 67 Zeilen
- `src/core/sim/narrative/state.ts` — Narrative-Domaene: Startzustand, Start-Pool beim neuen Spiel und sichere Normalisierung. — gelesen: 91 Zeilen
- `src/core/sim/narrative/types.ts` — Narrative Datenvertraege: Facts, Erinnerungen und persistenter Zustand als reine JSON-Daten. — gelesen: 72 Zeilen
- `src/core/sim/needs.ts` — Bedürfnisse: ein 180-Punkte-Profil pro Gast, Durst und Blase steuern die Zielwahl. — gelesen: 49 Zeilen
- `src/core/sim/offers.ts` — Angebot: kaufbare Spiele, Deko und Mods. Jeder Mod zieht an und kostet Geduld oder Betrieb. — gelesen: 177 Zeilen
- `src/core/sim/pathfinding.ts` — A* auf dem Tile-Grid. Deterministisch, 4 Richtungen, mit Blockern. — gelesen: 184 Zeilen
- `src/core/sim/penalty-pool.ts` — Folgen eines verlorenen Duells: Ruf und Laune als befristete Strafe, kein Zufallspool. — gelesen: 39 Zeilen
- `src/core/sim/personas.ts` — Gästetypen: Budget, Geduld, Suchtneigung, Getränkeneigung und Spielgeschmack. — gelesen: 53 Zeilen
- `src/core/sim/player-jobs.ts` — Spieler-Jobs in fremden Casinos. Sims-Style Arbeit an Job-Stationen. — gelesen: 134 Zeilen
- `src/core/sim/player-look.ts` — Der Look des Spielers: reine Daten, keine Gameplay-Wirkung. — gelesen: 56 Zeilen
- `src/core/sim/player-rpg.ts` — Spieler-RPG: 7 Attribute, Level, XP und Kampfkoerper. Rein deterministisch, ohne Geldbewegung. — gelesen: 117 Zeilen
- `src/core/sim/player.ts` — Spieler-Commands: Laufen, Tragen, Zapfen, Kasse, Deko, Ausbau. Mit Weg und Reichweite. — gelesen: 130 Zeilen
- `src/core/sim/progression.ts` — Unternehmensfortschritt: das Casino waechst, nicht der Charakter. — gelesen: 160 Zeilen
- `src/core/sim/queue-spots.ts` — Kassenschlange: eindeutige, erreichbare Wartepositionen – auch bei grossem Andrang. — gelesen: 56 Zeilen
- `src/core/sim/remodel.ts` — Umbau: Voraussetzungen und Deckung pruefen, dann das bestehende Haus erweitern. — gelesen: 30 Zeilen
- `src/core/sim/rivals.ts` — Fremde Casinos: eigene Betreiber, eigene Maschinen, eigene Regeln. — gelesen: 181 Zeilen
- `src/core/sim/self-exclusion-bet.ts` — Self-Exclusion als Spiel: Der Pakt belohnt Disziplin und protokolliert Wortbruch ehrlich. — gelesen: 94 Zeilen
- `src/core/sim/service-actions.ts` — Gast-Aktionen: ausstehende Gelder an Gäste auszahlen. Reine Welt-Logik ohne Tick. — gelesen: 17 Zeilen
- `src/core/sim/spawn.ts` — Ein einzelner Gast: Profil, Fiat und Weg zur Kasse. Wie viele kommen, plant demand.ts. — gelesen: 70 Zeilen
- `src/core/sim/staff-queries.ts` — Die eine Personalabfrage. — gelesen: 72 Zeilen
- `src/core/sim/staff.ts` — Personal: eingestellte Rollen bekommen einen Körper, der auf dem Floor arbeitet. — gelesen: 240 Zeilen
- `src/core/sim/templates.ts` — Drei Floor-Blueprints: klein, mittel, gross. Jeder Bereich ist 30x30 Kacheln. — gelesen: 115 Zeilen
- `src/core/sim/tick.ts` — Ein Tick der Welt: Spawn, Wege, Service, Laune, Dreck, Personal. — gelesen: 137 Zeilen
- `src/core/sim/traits.ts` — Gast-Erzeugung: Persona plus zufaellig verteilter Max-Pool fuer Laune, Geduld und Sucht. — gelesen: 73 Zeilen
- `src/core/sim/types-model.ts` — Welttypen ohne den Weltzustand selbst. — gelesen: 116 Zeilen
- `src/core/sim/types.ts` — Ein einziger serialisierbarer Weltzustand. Geld liegt nicht hier, sondern im Ledger. — gelesen: 83 Zeilen
- `src/core/sim/upkeep.ts` — Laufende Pflege der Welt: Tageslohn, Miete, verwaiste Sitze und Gast-Laune. — gelesen: 63 Zeilen
- `src/core/sim/visitors.ts` — Besucherprofile: Gaeste bleiben ueber Besuche hinweg erkennbar; die Liste ist begrenzt. — gelesen: 65 Zeilen
- `src/core/sim/world.ts` — Welt-Helfer: Zonen, Objekte, Reservierungen, freie Plaetze. — gelesen: 134 Zeilen
- `src/main.tsx` — import { StrictMode } from 'react'; — gelesen: 29 Zeilen
- `src/render/__tests__/floor-cache.test.ts` — Regions-Hash, Invalidierung, LOD, Culling und Koordinaten sind reine Mathe. — gelesen: 82 Zeilen
- `src/render/__tests__/rig-combat.test.ts` — Kampf und Verletzung muessen sichtbar sein: eigene Posen, eigene Uebergaenge, — gelesen: 35 Zeilen
- `src/render/__tests__/rig.test.ts` — Das Rig ist reine Mathematik: gleiche Zeit, gleiche Pose, klarer Zustand. — gelesen: 37 Zeilen
- `src/render/__tests__/slot-layout.test.ts` — Die Walzenanzeige rechnet nur ueber diese Geometrie. Werte, die hier stimmen, — gelesen: 50 Zeilen
- `src/render/__tests__/sound-fx.test.ts` — Lautstaerke und Kanaele sind Geraeteeinstellungen: sie muessen klemmbar, getrennt — gelesen: 33 Zeilen
- `src/render/actor-pool.ts` — Wiederverwendbare Figuren und Sticker: im Frame entstehen keine neuen Text-/Graphics-Objekte. — gelesen: 61 Zeilen
- `src/render/art-tokens.ts` — Eine Bildsprache fuer Floor und UI: jede Farbe hat eine Bedeutung, jedes Material — gelesen: 100 Zeilen
- `src/render/assets/keys.ts` — Paketpfade, die echte Renderer brauchen: Figuren, Tischdeko, Boden und Partikel. — gelesen: 32 Zeilen
- `src/render/assets/manifest.json` — { — generiert, 726 Zeilen
- `src/render/assets/textures.ts` — Texturen aus dem Pixel-Paket: ein Cache, Nearest-Sampling und ein stiller — gelesen: 83 Zeilen
- `src/render/comic-bubbles.ts` — Kleine Comic-Sprechblase: eine Grafik statt eines Satzes, pro Figur gepoolt. — gelesen: 93 Zeilen
- `src/render/floor-camera.ts` — Kamera mit zwei Zoom-Stufen: Übersicht und 30x30-Bereich. Lerpt ohne Frame-Allokationen. — gelesen: 102 Zeilen
- `src/render/floor-carpet.ts` — Bodentextur aus dem Paket: ein Teppichmuster ueber den Zonen, unter Moebeln und Figuren. — gelesen: 43 Zeilen
- `src/render/floor-math.ts` — Reine Floor-Mathe: Regions-Hash, Invalidierung, LOD, Culling, Koordinaten. Kein Pixi. — gelesen: 94 Zeilen
- `src/render/floor-perf.bench.ts` — Worst-Case: 90×90-Floor, 9 Regionen, 500 Dreck-Tiles, 200 Entities. — gelesen: 54 Zeilen
- `src/render/floor-props.ts` — Requisiten: Personal, Lieferkisten, Streitmarker und Platzierungs-Geist. Liest nur Snapshots. — gelesen: 217 Zeilen
- `src/render/floor-route.ts` — Laufwege: Teppichlaeufer zwischen den Raeumen, gelegt von Zonenrand zu Zonenrand, — gelesen: 84 Zeilen
- `src/render/floor-stage.tsx` — React-Bruecke zur Pixi-Buehne; haelt keinen Spielzustand. — gelesen: 89 Zeilen
- `src/render/floor-surface.ts` — Bodenauftrag und Licht: Muster, Fugen, Deckenlampen und Kantentiefe je Raum. — gelesen: 120 Zeilen
- `src/render/floor-touch.ts` — Zwei-Finger-Zoom auf dem Canvas; die Kamera bleibt die einzige Zoom-Wahrheit. — gelesen: 70 Zeilen
- `src/render/floor-view.ts` — Pixi-Floor: gecachter Raum, zwei LOD-Stufen, weiche Kamera, gepoolte Akteure. Liest nur Snapshots. — gelesen: 349 Zeilen
- `src/render/furniture-art.ts` — Moebel: statischer Korpus als GPU-Textur, nur Zustand und Sitze bleiben dynamisch. — gelesen: 260 Zeilen
- `src/render/fx/emitter.ts` — Partikel aus dem Paket: Gewinn- und Verlustmomente nutzen dieselben Emitter wie die Bibliothek. — gelesen: 117 Zeilen
- `src/render/games/blackjack-canvas.ts` — Blackjack-Tisch in Pixi: Dealer oben, Spieler unten, Karten fliegen aus dem Schuh. — gelesen: 142 Zeilen
- `src/render/games/blackjack-stage.tsx` — React-Bruecke zum Blackjack-Tisch; die Runde kommt aus dem Kern, hier nur die Karten. — gelesen: 53 Zeilen
- `src/render/games/card-renderer.ts` — Eine Spielkarte in Pixi: Vorderseite, Rueckseite, 3D-Flip und Flug aus dem Schuh. — gelesen: 168 Zeilen
- `src/render/games/dice-canvas.ts` — Der Wuerfeltisch in Pixi: Filz, Bande und zwei Wuerfel, die auf dem Kern-Ergebnis liegen bleiben. — gelesen: 160 Zeilen
- `src/render/games/dice-stage.tsx` — React-Bruecke zum Wuerfeltisch; die Augen kommen aus dem Kern. — gelesen: 49 Zeilen
- `src/render/games/plinko-assets.ts` — Plinko-Texturen: Pegs und Auszahlungsfelder, mit gezeichnetem Rueckfall. — gelesen: 48 Zeilen
- `src/render/games/plinko-canvas.ts` — Das Plinko-Brett als Pixi-Buehne: Stifte, Deflektoren, Taschen und die echte Ballbahn. — gelesen: 259 Zeilen
- `src/render/games/plinko-stage.tsx` — React-Bruecke zum Plinko-Brett; haelt nur die Buehne, nie das Ergebnis. — gelesen: 59 Zeilen
- `src/render/games/poker-canvas.ts` — Poker-Tisch in Pixi: Filz, Gegner-Haende verdeckt, Board, Pot und deine Karten. — gelesen: 228 Zeilen
- `src/render/games/poker-stage.tsx` — React-Bruecke zum Poker-Tisch; zeigt den Zustand der Runde in Pixi. — gelesen: 59 Zeilen
- `src/render/games/roulette-canvas.ts` — Europaeischer Kessel in Pixi: Rad, Kugel im Gegenlauf und Dolly auf der Gewinnzahl. — gelesen: 182 Zeilen
- `src/render/games/roulette-stage.tsx` — React-Bruecke zum Kessel; haelt nur die Animation, nie das Ergebnis. — gelesen: 50 Zeilen
- `src/render/games/shell-canvas.ts` — Huetchenspiel in Pixi: erst zeigt der Geber die Perle, dann mischt er, dann waehlt der Spieler. — gelesen: 242 Zeilen
- `src/render/games/shell-stage.tsx` — React-Bruecke zum Huetchentisch; die Wahl des Spielers kommt als Klick zurueck. — gelesen: 60 Zeilen
- `src/render/games/slot-canvas.ts` — Die Walzenbuehne: drei bis fuenf Walzen, echter Auslauf mit Bounce, Gewinnlinien und Muenzregen. — gelesen: 180 Zeilen
- `src/render/games/slot-fx.ts` — Effekte ueber den Walzen: Neon-Linien fuer Treffer und eine Muenzfontaene beim Gewinn. — gelesen: 93 Zeilen
- `src/render/games/slot-gamble.ts` — Die Risiko-Karte nach einem Gewinn: Ruecken, Farbe, Aufdecken – ohne Walzenwissen. — gelesen: 78 Zeilen
- `src/render/games/slot-layout.ts` — Reine Geometrie und Tween-Kurven der Walzenanzeige; ohne Pixi damit testbar. — gelesen: 40 Zeilen
- `src/render/games/slot-reels.ts` — Walzenstreifen der Buehne: Aufbau einer Walze und Umtausch einer Zelle. — gelesen: 44 Zeilen
- `src/render/games/slot-stage.tsx` — React-Bruecke zur Walzenbuehne; haelt keinen Spielzustand, nur die Animation. — gelesen: 54 Zeilen
- `src/render/games/slot-symbols-art.ts` — Slot-Symbole: das Pixel-Paket, wo es eines gibt, sonst die gezeichnete Grafik. Der Rueckfall ist kein Notbehel — gelesen: 120 Zeilen
- `src/render/games/slot-symbols-extra.ts` — Zusatz-Symbole aus dem Pre-Alpha Pixel-Paket: gezeichnete Fallbacks, wenn die Textur nicht geladen ist. — gelesen: 191 Zeilen
- `src/render/games/video-poker-canvas.ts` — Video Poker in Pixi: Paytable oben links, fuenf Karten, HOLD-Stempel, Trefferlicht. — gelesen: 146 Zeilen
- `src/render/games/video-poker-stage.tsx` — React-Bruecke zum Video-Poker-Schirm; Klicks auf Karten kommen als Index zurueck. — gelesen: 59 Zeilen
- `src/render/guest-art.ts` — Pixel-Raster statt Vektorglanz: blockige Figur, echte Gelenke, klare Zustaende. — gelesen: 324 Zeilen
- `src/render/music.ts` — Musikschicht in der vorhandenen Audioarchitektur: eigene Lautstaerke, drei — gelesen: 184 Zeilen
- `src/render/pixel-head.ts` — Figuren aus dem Paket: ein Kopf-Sprite, das die gezeichnete Figur ersetzt, wenn es geladen ist. — gelesen: 29 Zeilen
- `src/render/player-marker.ts` — Zustandsmarker ueber dem Spieler: Verletzung und Handgemenge auf dem Floor. — gelesen: 26 Zeilen
- `src/render/rig-pose.ts` — Reine Pose-Mathematik fuer das Pixel-Rig; ohne Pixi testbar. — gelesen: 131 Zeilen
- `src/render/rig.bench.ts` — Rendering-nahe Posekosten; bewusst nicht Teil von verify:all. — gelesen: 28 Zeilen
- `src/render/rng.ts` — Der eine Darstellungs-Strom: Partikel und Sound, nie der Spielzustand. — gelesen: 4 Zeilen
- `src/render/room-art.ts` — Architektur: jede Zone bekommt Waende mit Lichtkante, Sockel, Ecken und — gelesen: 194 Zeilen
- `src/render/room-dressing.ts` — Raumausstattung ueber dem Bodenbelag: das, was einen Raum wiedererkennbar macht, — gelesen: 71 Zeilen
- `src/render/scene-cache.ts` — Vier Render-Layer. Boden und Dreck liegen in 30×30-Regions-Chunks; nur veränderte backen neu. — gelesen: 158 Zeilen
- `src/render/sound-fx.ts` — Prozeduraler WebAudio-Synth: alle Effekte ohne Asset, mit getrennten Kanaelen und stillem Fallback. — gelesen: 207 Zeilen
- `src/store/__tests__/card-payout.test.ts` — Der Hausvorteil des fremden Hauses darf nur den Gewinn treffen. Einsatz, — gelesen: 29 Zeilen
- `src/store/__tests__/determinism.test.ts` — Determinismus: derselbe Seed und dieselben Ticks ergeben denselben Spielzustand, — gelesen: 53 Zeilen
- `src/store/__tests__/narrative-save.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 60 Zeilen
- `src/store/__tests__/prng-persistence.test.ts` — Der PRNG-Zustand setzt nach dem Laden die Folge exakt fort, ohne Doppelziehung. — gelesen: 70 Zeilen
- `src/store/__tests__/rival-play-commands.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 33 Zeilen
- `src/store/__tests__/save-device.test.ts` — Alte Speicherstaende koennen eine Geräteidentität tragen, die zum Spieltyp — gelesen: 71 Zeilen
- `src/store/__tests__/save-migration.test.ts` — Ein v5-Spielstand behaelt Fiat und offene Ansprueruche beim Laden. — gelesen: 84 Zeilen
- `src/store/__tests__/save-reels.test.ts` — Alte Speicherstaende koennen eine ungueltige Walzenzahl tragen. Das Laden — gelesen: 65 Zeilen
- `src/store/__tests__/save-roundtrip.test.ts` — Speichern, laden und danach exakt dieselbe Simulation fortsetzen. — gelesen: 84 Zeilen
- `src/store/__tests__/save-staff.test.ts` — Alte Speicherstaende trugen den Guard als Flag neben den Agenten. Beim Laden — gelesen: 77 Zeilen
- `src/store/__tests__/save-v7.test.ts` — Ein v6-Spielstand bekommt Kisten, Agenten und Bedürfnisse mit Defaults; v7 bleibt rund. — gelesen: 119 Zeilen
- `src/store/foreign-floor-commands.ts` — Foreign Floor Commands: Besucher- und Job-Aktionen in fremden Casinos. — gelesen: 41 Zeilen
- `src/store/foreign-play.ts` — Fremde Haeuser: Spiel und Besuch an einer Stelle, damit der Store schlank bleibt. — gelesen: 134 Zeilen
- `src/store/game-commands.ts` — Game Commands: Spielautomaten, Plinko, Ausschluss. — gelesen: 38 Zeilen
- `src/store/memory.bench.ts` — Speicher- und Save-Groesse: eine definierte 1000-Tick-Sitzung, kein Sample-Ring. — gelesen: 32 Zeilen
- `src/store/migrate-narrative.ts` — Hydration der Narrative-Domaene und der Besucher-Erinnerungen beim Laden. — gelesen: 19 Zeilen
- `src/store/migrate-staff.ts` — Personal-Migration alter Speicherstaende. — gelesen: 38 Zeilen
- `src/store/migrate.ts` — Hydration und Migration gespeicherter Stände (v5/v6/v7) in eine frische Welt. — gelesen: 219 Zeilen
- `src/store/perf-hot-paths.bench.ts` — Messpfad fuer RBD-16: langer Spielstand, 200 Gaeste, 90x90-Floor. — gelesen: 85 Zeilen
- `src/store/player-tools.ts` — Spieler-Commands, die der Store nur noch bestaetigt. — gelesen: 47 Zeilen
- `src/store/rival-play-commands.ts` — Rival Play Commands: Karten- und Risikospiele in fremden Casinos. — gelesen: 89 Zeilen
- `src/store/save.ts` — Save v9: Welt + Ledger-Log + Journal + PRNG + Narrative-Domaene. Nichts anderes besitzt Geld. — gelesen: 139 Zeilen
- `src/store/service-commands.ts` — Service Commands: Gäste bedienen, Bezahlen, Bewegen. — gelesen: 25 Zeilen
- `src/store/snapshot.ts` — Snapshot aus Welt und Ledger; keine eigene Geldwahrheit in der UI. — gelesen: 127 Zeilen
- `src/store/transfer.ts` — Import und Export von Spielstaenden: Plan zuerst, Anwenden erst nach Pruefung. — gelesen: 47 Zeilen
- `src/store/types.ts` — Was die UI sieht: Welt plus abgeleitete Ledger-Werte. — gelesen: 101 Zeilen
- `src/store/use-world-store.ts` — import { useSyncExternalStore } from 'react'; — gelesen: 9 Zeilen
- `src/store/venue-commands.ts` — Venue Commands: Bau, Einrichtung, Preise – alles was das Haus verändert. — gelesen: 150 Zeilen
- `src/store/world-store.ts` — Ein Besitzer: Welt, Ledger, PRNG, Uhr und Save. Commands delegiert an Module. — gelesen: 163 Zeilen
- `src/styles/app.css` — { box-sizing: border-box; } — gelesen: 317 Zeilen
- `src/styles/index.css` — Quelldatei ohne Kopfkommentar — gelesen: 3 Zeilen
- `src/styles/popup.css` — .popup-backdrop { — gelesen: 532 Zeilen
- `src/styles/tokens.css` — Eine Bildsprache fuer UI und Floor. Die Rollen hier sind dieselben wie in — gelesen: 55 Zeilen
- `src/test/measure.ts` — Explizite Messung: feste Iterationszahl, ein Warmup, monotone Uhr. — gelesen: 26 Zeilen
- `src/test/random-seed.ts` — import { randomInt } from 'node:crypto'; — gelesen: 9 Zeilen
- `src/ui/__tests__/card-tables.test.tsx` — Eine laufende Blackjack-Hand darf nicht durch neues Austeilen ersetzt werden, — gelesen: 118 Zeilen
- `src/ui/__tests__/ui.test.tsx` — UI-Integration ohne Pixi: Zustand, Fokus, Filter und Rivalenprofile. — gelesen: 103 Zeilen
- `src/ui/asset-library-popup.tsx` — Asset-Bibliothek: alles, was im Paket liegt, ist im Spiel sichtbar und anhoerbar. — gelesen: 192 Zeilen
- `src/ui/bet-console.tsx` — Wettkonsole unter den Walzen: Jetons, Autospin und der eine grosse Knopf. — gelesen: 42 Zeilen
- `src/ui/build-catalog-cards.tsx` — Katalog-Karten: kaufbare Spiele und Deko als Drag-fähige Bau-Karten. Reine Darstellung. — gelesen: 45 Zeilen
- `src/ui/build-panel-parts.tsx` — Bau-Sektionen: Personal, Hauswahl, Farben, Kisten, Streit. Reine Darstellung. — gelesen: 176 Zeilen
- `src/ui/build-panel.tsx` — Bau-Popup: kaufen, liefern, Personal, Preise, Deko und Freischaltung. — gelesen: 177 Zeilen
- `src/ui/casino-window-header.tsx` — Kopfzeile eines Casino-Fensters: Geldtoepfe, verbaute Mods, Pakt und Vollbild. — gelesen: 50 Zeilen
- `src/ui/diagnostics-popup.tsx` — Diagnose: Buchhaltung, Personal, Lager und Protokoll auf einen Blick. — gelesen: 124 Zeilen
- `src/ui/foreign-floor-hud.tsx` — Foreign Floor HUD: Anzeige auf fremden Floors. — gelesen: 88 Zeilen
- `src/ui/foreign-floor-map.tsx` — Foreign Floor Map: Übersichtskarte aller fremden Casinos. — gelesen: 109 Zeilen
- `src/ui/foreign-floor-popup.tsx` — Fenster auf einem fremden Floor: HUD plus Job-Menue an der gewaehlten Station. — gelesen: 54 Zeilen
- `src/ui/format.ts` — Kompakte Anzeige: VC ohne Zahlenrauschen. — gelesen: 19 Zeilen
- `src/ui/games-popup.tsx` — Fremdes Haus: echte Rivalen mit Betreiber, Regeln, Maschinen und Hausvorteil. — gelesen: 194 Zeilen
- `src/ui/games/blackjack-popup.tsx` — Blackjack-Fenster: der Spieler entscheidet Zug für Zug, inklusive Split, Versicherung und Aufgeben. — gelesen: 170 Zeilen
- `src/ui/games/blackjack-rules-editor.tsx` — Blackjack-Tischregeln: Decks, Soft-17, Auszahlung, Split, Versicherung, Aufgeben, Paar-Wette. — gelesen: 105 Zeilen
- `src/ui/games/blackjack-table-actions.tsx` — Blackjack-Tisch-Aktionen: Karten ziehen, halten, verdoppeln, splitten, aufgeben, Versicherung. — gelesen: 68 Zeilen
- `src/ui/games/dice-popup.tsx` — Wuerfel-Fenster: Wettfeld waehlen, Jetons setzen, Wurf zeigt die Augen des Kerns. — gelesen: 115 Zeilen
- `src/ui/games/plinko-popup.tsx` — Plinko-Fenster: das Brett ist sofort da, jeder Abwurf zeigt die echte Physikbahn. — gelesen: 93 Zeilen
- `src/ui/games/poker-popup.tsx` — Rundenpoker: fünf Buy-in-Stakes, Einsatz pro Turn, drei CPU-Profile. — gelesen: 173 Zeilen
- `src/ui/games/roulette-popup.tsx` — Roulette-Fenster: Kessel links, Setzfeld rechts, jeder Jeton ist eine echte Wette. — gelesen: 157 Zeilen
- `src/ui/games/shell-popup.tsx` — Huetchen-Fenster: zeigen, mischen, dann waehlt der Spieler selbst einen Becher. — gelesen: 129 Zeilen
- `src/ui/games/slot-popup.tsx` — Ein Slot-Fenster: Walzen, Wettkonsole und die Risiko-Karte nach jedem Gewinn. — gelesen: 140 Zeilen
- `src/ui/games/video-poker-popup.tsx` — Video Poker: fuenf Karten, Halten per Klick, Nachziehen, Auszahlung nach 9/6-Tabelle. — gelesen: 159 Zeilen
- `src/ui/glossary.ts` — Ein Ort für Begriffe, die der Spieler sieht: kurze Erklärung statt Branchenjargon. — gelesen: 32 Zeilen
- `src/ui/guest-popup.tsx` — Ein Klick auf einen Gast: Sticker, Budget und drei Werte mit klarer Folge statt Tabellen. — gelesen: 144 Zeilen
- `src/ui/help-popup.tsx` — Hilfe: Geldfluss, Gäste, Objekte und Steuerung in Klartext, erreichbar über das ? im HUD. — gelesen: 98 Zeilen
- `src/ui/hud.tsx` — HUD: Hauskonto, Gäste und die drei Dinge, die jetzt zählen – in Klartext. — gelesen: 172 Zeilen
- `src/ui/icons.ts` — Icons aus dem Paket: ein Pfad-Helfer, damit UI und Renderer dieselbe Basis nutzen. — gelesen: 27 Zeilen
- `src/ui/job-context-menu.tsx` — Job-Kontext-Menu: Sims-Style Interaktion an einer Job-Station. — gelesen: 115 Zeilen
- `src/ui/journal-popup.tsx` — Ereignisprotokoll: was passiert ist, warum, und was daraus folgt — live oder aus dem Archiv. — gelesen: 107 Zeilen
- `src/ui/look-popup.tsx` — Charaktereditor: reine Kosmetik, sofort im Save und auf dem Floor sichtbar. — gelesen: 90 Zeilen
- `src/ui/machine-popup.tsx` — Automaten-Popup: Zustand, Mods, Walzen und ein kostenloser Testspin. — gelesen: 181 Zeilen
- `src/ui/plinko-editor.tsx` — Operator-Board-Editor: echte Konfiguration, ehrliches Gate, sichtbarer Fortschritt. — gelesen: 181 Zeilen
- `src/ui/popup-shell.tsx` — Ein Rahmen für alle Popups: Backdrop, Titel, Fokusfalle, Escape, Schließen. — gelesen: 77 Zeilen
- `src/ui/roulette-tableau.tsx` — Das Setzfeld: jede Zelle ist ein Feld, jeder Klick legt einen Jeton dorthin. — gelesen: 65 Zeilen
- `src/ui/self-exclusion-panel.tsx` — Self-Exclusion als Gameplay: kein verstecktes Menü, sondern ein sichtbarer Pakt. — gelesen: 66 Zeilen
- `src/ui/slot-rules-editor.tsx` — Regel-Editor am Automaten: Streifen, Gewichte, Modell, Volatilität und Bonus-Paytable. — gelesen: 138 Zeilen
- `src/ui/slot-telemetry.tsx` — Slot-Telemetrie: Historie, Abweichung, Druck und letzte Symbole ohne Beschönigung. — gelesen: 38 Zeilen
- `src/ui/sound-popup.tsx` — Lautstaerke, Kanaele und Musik: Master plus Spiele, Kampf, Bedienung getrennt. — gelesen: 84 Zeilen
- `src/ui/staff-labels.ts` — Gemeinsame Klartext-Labels für Personalstatus in Panel und Diagnose. — gelesen: 19 Zeilen
- `src/ui/table-launcher.tsx` — Waehlt das passende Fenster am Geraet: Walzen, Plinko oder Wuerfel. — gelesen: 145 Zeilen
- `src/ui/transfer-panel.tsx` — Import und Export: Spielstand als JSON sichern, pruefen und zurueckspielen. — gelesen: 49 Zeilen
- `tsconfig.json` — { — gelesen: 24 Zeilen
- `vite.config.ts` — import { configDefaults, defineConfig } from 'vitest/config'; — gelesen: 37 Zeilen

### 18.4 Mechanische Auffaelligkeiten

- Keine Marker fuer offene Arbeit in getrackten Textdateien.

<!-- inventory:end -->

## Fortsetzungs-Log

| Turn | Erledigt |
| --- | --- |
| T24 | **2026-11-01 20:40 UTC**: Auto-Promotion und Integrationsbranch. Neu: `scripts/promote.mjs`, `.github/workflows/promote.yml`, `scripts/lib/identity.mjs`, `.mailmap`. Ein CI-Ergebnis entscheidet: gruen PR anlegen und mit Pflichtsektionen mergen, rot Label `integration/rot` und Stand auf die permanente Branch `integration`. Zwei parallele rote Staende werden komponiert (`git merge`), ein Textkonflikt bekommt `integration/konflikt`; kein force-Push, kein `-X theirs`. Identitaet `Vannon <Schneider.felix1993@gmail.com>` in `turn:finish` und im Workflow verdrahtet. Gelesen: `ci-verify.yml`, `pr-escalation.yml`, `auto-version-release.yml`, `pr-cleanup.yml`, `turn-push.mjs`, `.githooks/pre-commit`, `verify-tree.mjs`, `loc-budgets.mjs`, `docs/CI-GATES.md`, `docs/ESCALATION.md`. v1.21. |
| T23 | **2026-11-01 19:50 UTC**: Doku-Konsolidierung, Sortierung und Repo-Hygiene. Umbenannt: `docs/event-narrative-engine-taskplan.md` → `docs/EVENT-NARRATIVE-ENGINE-TASKPLAN.md`, `docs/assets/casino-pixel-asset-pack.md` → `docs/CASINO-PIXEL-ASSET-PACK.md`; `docs/assets/` entfällt, 16 Doku-Dateien liegen flach. Widersprüche behoben: Save überall v9 (`vcoin.casino.v9`, Migration v5–v8), Narrative Engine als Stufe 1 statt „nicht gebaut", Gate-Zählung quick 10 / full 12 inkl. `assets`, `audit`, `build`. Fehlerkatalog repariert (verschmolzene ERR-4013/4014-Zeile) und aufsteigend sortiert. Hooks aktiviert (`core.hooksPath=.githooks`); das Doku-Gate ueberspringt Dotfiles in der Wurzel, weil `.turn-notes.md` den Turn-Abschluss sonst blockiert. Stand: `main` = `origin/main` = `c4e6e3b`, 983 Dateien, 67 Ordner. v1.20. |
| T22 | **2026-11-01 12:05 UTC**: Narrative Engine Stufe 1 (NAR-00 bis NAR-03) umgesetzt. Neu: `src/core/sim/narrative/{types,facts,state,memory}.ts`, `docs/NARRATIVE-ENGINE.md`, `content/narrative/{contributions,vocabulary}`; `WorldState.narrative`, `Visitor.memories`, Facts an Spawn/Rueckkehr/Auszahlung, Start-Pool mit Startkapital-Fact, Save v9 mit Normalisierung aus v5–v8, Tree-Gate kennt `content/`. Wirkung: Rueckkehrchance ±Erinnerungsbonus (letzte doppelt, Deckel), Spawn-Laune von Stammgaesten, Pool-Rueckkehr ab Tick 0. Tests: `narrative-facts`, `narrative-memory`, `narrative-start-pool`, `narrative-save`. Offen: NAR-04 bis NAR-17. v1.19. |
| T21 | **2026-11-01 11:35 UTC**: Vorfall nach Merge #32: Der Merge-Commit `3c46ba6` trug nur den Klicktitel, `verify-commit-msg --head` wurde auf `main` rot (`ERR-4006`, drei Pflichtsektionen fehlten), `Bump, tag, release` und APK-Bau wurden uebersprungen. Reparatur ohne Rewrite: `AGENTS.md` nennt die API-Falle (PR-Body gehoert beim Connector-Merge in `commit_message`), DEVTAGEBUCH haelt den Vorfall fest, dieser Commit traegt die Sektionen selbst. Gelesen: `.github/workflows/ci-verify.yml` (Job-Log 124835402124), `scripts/verify-commit-msg.mjs`, `AGENTS.md`. v1.18. |
| T20 | **2026-11-01 11:44 UTC**: `performance.now`-Ausnahme auf Pacing verengt und als dicht belegt. Gelesen: `eslint.config.mjs`, `src/render/floor-view.ts`, `src/render/floor-props.ts`, `src/render/music.ts`, `src/render/guest-art.ts`, `src/store/foreign-floor-commands.ts`, `src/store/world-store.ts`, `src/core/sim/player-jobs.ts`, `src/store/types.ts`, `scripts/verify-tree.mjs`. Befund: Ausnahme galt fuer ganz `src/render/**`, `Date()` ohne `new` und `performance.timeOrigin` waren ungesperrt. Behoben: drei Pacing-Dateien namentlich, Call-`Date` und `timeOrigin` als Selectoren. 24 Proben: nur `performance.now` in den drei Dateien (plus Alias/`globalThis`) gruen, alle anderen Quellen und jede vierte Render-Datei rot. Rot/Gruen: `Math.random` in `music.ts` + `Date.now` in `floor-view.ts` -> Lint Exit 1 (4 Fehler), nach Revert Exit 0; `performance.now` in `guest-art.ts` -> Exit 1. Datenfluss: Render importiert Store nur als `import type { GameView }`, `tick` waechst nur in `tick.ts`, kein Command nimmt Zeit ausser `buyBarCmd` mit `world.tick`. v1.17. |
| T19 | **2026-11-01 11:15 UTC**: Determinismus-Sperre fail-closed gehaertet. Gelesen: `eslint.config.mjs`, `scripts/verify-test-quality.mjs`, `src/core/rng/streams.ts`, `src/store/world-store.ts`, `src/render/music.ts`, `src/render/floor-view.ts`, `src/render/floor-props.ts`, `scripts/lib/pipeline-plan.mjs`, `vite.config.ts`. Befund (20 Proben): sieben Bypaesse offen — `globalThis.Math.random`, `window.Math.random`, `new globalThis.Date`, `crypto.getRandomValues`, `crypto.randomUUID`, `eslint-disable`, pauschal freigestelltes `src/core/rng/streams.ts` und ungeschuetzte `scripts/**`. Behoben: Syntax-Selectoren fuer Namespace-/new-Umwege und Krypto, `noInlineConfig`, `streams.ts` nur noch Krypto-erlaubt, `scripts/**` per Default gesperrt mit sieben namentlichen Tooling-Ausnahmen, `@seed-initializer`-Ausnahme entfernt. Rot/Gruen: `Math.random` in `tick.ts` -> Lint Exit 1 (2 Fehler, Zeile 140), nach Revert Exit 0. v1.16. |
| T18 | **2026-11-01 11:02 UTC**: Event-Engine-Taskplan adversarial gehaertet. Gelesen: `docs/event-narrative-engine-taskplan.md` (687 Zeilen, NAR-00 bis NAR-17), `src/core/sim/visitors.ts`, `src/core/economy/ledger.ts`, `src/core/sim/journal.ts`, `src/core/sim/demand.ts`, `src/store/save.ts`, `scripts/lib/pipeline-plan.mjs`, `scripts/loc-budgets.mjs`, `vite.config.ts`. Befunde: veraltete Gate-Liste, veralteter Pruefstand 708d31c, Reihenfolge NAR-12 vor NAR-13; 20 Angriffe, Systemmatrix ueber 20 Systeme und Definition of Done je Task ergaenzt, kein Task gestrichen. v1.15. |
| T17 | **2026-11-01 10:49 UTC**: Determinismus: kein Math.random und keine Wanduhr im Spielzustand. Befund: `Date.now()`-Seeds in `world-store`, `new Date()` im Export, `Date.now()` im Musik-Fade. Behoben: `entropySeed()` als einziger Krypto-Eingang, Export-Stempel aus `world.day`/`world.tick`, ESLint-Verbot fuer `Math.random`/`Date.now`/`performance.now`/`new Date()` in `src/**` mit Render-Ausnahme fuers Pacing; neuer Replay-Test in `src/store/__tests__/determinism.test.ts`. Gelesen: `streams.ts`, `prng.ts`, `world-store.ts`, `transfer.ts`, `music.ts`, `eslint.config.mjs`, `envelope.ts`. v1.14. |
| T16 | **2026-11-01 10:24 UTC**: Gameplay- und Darstellungs-RNG getrennt: Rollen am `Prng`, eigener Render-Strom, Guard an `tickWorld`/`playRound`, Tests fuer unbewegten Spielzustand. `Math.random()` aus Renderer und Sound entfernt. v1.13. |
| T15 | **2026-11-01 10:00 UTC**: Auslieferung am Remote-HEAD geprüft; dabei die Selbstreferenz des Generators gefunden und behoben. Datei- und Ordner-Eintrag entfernt → `verify:docs` je Exit 1; danach SHA-256-gleich wiederhergestellt, Gate grün. v1.12. |
| T14 | **2026-11-01 09:50 UTC**: Vollständige Inventur. `scripts/build-inventory.mjs` erzeugt §18 aus `git ls-files` (957 Dateien, 64 Ordner, eine Zeile je Pfad); `verify:docs` prüft Datei-, Ordner- und Zahlenabdeckung und wird bei Lücke rot — drei Rot-Tests belegt. Pre-Commit-Hook baut die Liste vor dem Marker. Changelog-Version auf `0.3.64` gezogen. Kein Vitest lokal. v1.11. |
| T13 | **2026-11-01 09:35 UTC**: Tree-Gate (`ERR-4019`), Redundanz-Gate (`ERR-4020`) und `docs:stub` (`ERR-4021`) umgesetzt; `src/index.css` nach `src/styles/` verschoben; `ci-verify` prüft den Commit-Body nur noch auf `main` (Feature-Branches über `pr-escalation`, keine Doppelarbeit); alle statischen Gates grün; CI zu `37affc5` bestätigt (Fail-Closed Gates und Commit-Body success). v1.10. |
| T1 | Wurzel, Doku, Workflows, economy/rng/physics/governance, store komplett gelesen; Struktur aller Bereiche erfasst; Befunde 1–11 skizziert. |
| T2 | Artefakt angelegt; money/templates/tick/actions vollständig gelesen; Startkapital-Frage aufgelöst (150 VC, Befund 2 aktualisiert); Deckung und Befundtabelle fortgeschrieben. |
| T3 | Alle Exporte von core/games + engines extrahiert; alle 48 ui-, 50 render- und 34 scripts-Dateien per Kopf-/Größen-Extraktion erfasst; Manifest gelesen; Fehlerregister-Abgleich (identische 23 Codes); Befunde 12–14 ergänzt. |
| T4 | **2026-11-01 08:17 UTC**: core/games (31 Dateien) und 40 core/sim-Dateien bis zur letzten Zeile gelesen; Versionierung v1.2 im Header; Befunde 15–20; Deckungstabelle fortgeschrieben. |
| T5 | **2026-11-01 ~08:22 UTC**: die letzten 13 core/sim-Dateien gelesen (pathfinding, player, player-jobs, player-look, player-rpg, progression, queue-spots, remodel, rivals, types, types-model, upkeep, world) — **core/sim vollständig**; Befund 18 aufgelöst, 21–25 ergänzt; v1.3. |
| T6 | **2026-11-01 ~08:30 UTC**: alle übrigen 31 scripts-Dateien bis letzte Zeile gelesen — **scripts/scripts-lib vollständig (34/34)**; `src/test` vollständig (2/2); ui-/render-Zählung korrigiert (38 bzw. 43 produktive Dateien) mit Größen/Exporten/Scans; **Korrektur: das Befund-21–25-Segment aus T5 war nicht im File gelandet — hier als Befunde 21–32 neu geschrieben**; v1.4. |
| T7 | **2026-11-01 ~08:38 UTC**: ui-Batches 2–4 (30 Dateien: alle games-Popups, Rules-Editor, BetConsole, Header, PopupShell, Formate/Labels, Help/Journal/Look/Sound/Exclusion, Foreign-Floor-Dateien, Tableau, Karten) bis letzte Zeile — **src/ui vollständig (38/38 produktiv)**; Befund 33 durch Gegenpr\u00fcfung `deliveries.ts:12` best\u00e4tigt, Befunde 34–36 erg\u00e4nzt; erster render-Batch (6 gr\u00f6\u00dfte Dateien) bis letzte Zeile; Git-Stand: `origin` = github.com/vannon091118/rigged-by-design, HEAD 708d31c, nur `docs/INVENTORY.md` untracked (kein lokaler `origin/main`-Ref zum Vergleich); v1.5. |
| T12 | **2026-11-01 09:32 UTC**: CI-Lauf #110 (`f2f46c7`) ausgewertet: alle Gates grün außer `tests` — `pipeline-modes.test.ts` erwartete die entfernten Gates `deps-matrix`/`catalog`. Test auf `docs` und deren Entfall umgestellt, Doku nachgezogen, neu committet und gepusht. v1.9. |
| T11 | **2026-11-01 09:25 UTC**: Branch `freebuff/9f1e857ba05731117031ec2a` committet (`f2f46c7`, 32 Dateien) und via Connector gepusht; CI-Läufe `CI Verify` (#110) und `PR Escalation` gestartet. Connector-Eskalation implementiert (`lift-commit-body --json`), Doku nachgezogen. v1.9. |
| T10 | **2026-11-01 09:15 UTC**: Auftrag T9 umgesetzt. Neue Module `src/core/io/{issues,envelope,repair}.ts`, `src/store/transfer.ts`, `src/ui/transfer-panel.tsx` (Import/Export mit Reparaturplan); Eskalations-Leiter `scripts/lib/escalation.mjs` + `escalation:plan`; Doc-Gate `scripts/lib/doc-sync.mjs` + `verify:docs`; Hooks `.githooks/{pre-commit,commit-msg}` + `hooks:install`; PR-Eskalation `.github/workflows/pr-escalation.yml` + `lift-commit-body.mjs`; Pipeline-Gates `deps-matrix`/`catalog` durch `docs` ersetzt; Pflichtdoku Changelog/Devtagebuch/Roadmap/Escalation angelegt; Fehlercodes `ERR-4017/4018/5001`. Kein Vitest lokal. v1.8. |
| T9 | **2026-11-01 09:00 UTC**: main-Stand geprüft (`492ac3a`, Arbeitsbaum bis auf dieses Artefakt sauber). **Neuen Nutzerauftrag vollständig als Abschnitt 17 erfasst** (Import/Export-Manager mit LOC-Cap, globale Eskalations-Stufen, Commit-Body→PR-Body via CI, Doc-Sync-Gate + Doku-Strukturvorgaben, Pflichtdoku nach jeder Änderung, Pre-Commit-Hook statt generierter Matrizen, keine Redundanz/keine lokalen eskalierbaren Tests). Asset-Lizenz vom Nutzer bestätigt (Punkt 4). Kein Code geändert. v1.7. |
| T8 | **2026-11-01 ~08:52 UTC**: **Pull via Connector** `708d31c → 492ac3a` (583 Dateien, +3.119/−163 (583 Dateien)) eingearbeitet und ausgewertet: Asset-Paket (~550 PNG/OGG), Manifest v3 + Generator, Asset-Library, Poker-CPU-Profile + **Geldweg-Bugfix**, Roulette-Farbkorrektur, 3 neue Musiktracks; 22 weitere render-Dateien bis letzte Zeile gelesen; Befunde 37–46 (inkl. Lizenzstatus-Bestätigung, Taskplan-NAR-00…16, Versions-Bump fehlt beim Pull); Doku-Diffs (ASSETS/README/ARCHITECTURE/screenshots) gelesen; `docs/INVENTORY.md` bleibt durch den Pull unangetastet (nicht im Diff); v1.6. |
