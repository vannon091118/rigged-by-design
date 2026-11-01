# Repository-Inventur (lebendes Artefakt)

<!-- rbd-doc: v0.3.64 | 2026-11-01 09:26 UTC -->

> Zweck: vollständige, reproduzierbare Inventur der Repository. Dieses Dokument
> ist das einzige geschriebene Artefakt der Untersuchung und wird bei jeder
> Fortsetzung aktualisiert.
>
> | Versionierungs-Feld | Wert |
> | --- | --- |
> | **Version** | **v1.9** |
> | Erstellt | 2026-11-01 ~07:47 UTC (T1) |
> | **Aktualisiert** | **2026-11-01 09:25 UTC (T11 — Connector als Eskalationsweg, Branch gepusht, CI-Lauf gestartet)** |
> | Branch | `freebuff/9f1e857ba05731117031ec2a` |
> | HEAD | `492ac3a` (Pull via Connector: `708d31c → 492ac3a`, 583 Dateien) |
> | Arbeitsbaum | nur `docs/INVENTORY.md` untracked (dieses Artefakt); sonst sauber; Remote `vannon091118/rigged-by-design` |
>
> Fortsetzungs-Log am Ende dieses Dokuments.

## 1. Überblick

| Feld | Wert |
| --- | --- |
| Projekt | „Rigged by Design" — Casino-Aufbauspiel-Simulation (Satire, kein Echtgeld) |
| Stack | Vite 8 + React 19 + TypeScript 6 (strict) + PixiJS 8, Vitest 5, ESLint 10 |
| Version | 0.3.64 (`package.json`), Engine `node >=22.22.2`, `packageManager npm@12.2.1` |
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
| `.github/workflows` | 5 | — | ci-verify, auto-version-release, build-apk, long-checks, pr-cleanup |
| `docs` | 7 .md + banner + 15 Screenshots | 914 (md) | ARCHITECTURE, PRODUCT, CI-GATES, DEPENDENCY-AUDIT, ERROR_CATALOG, TEST-CATALOG, ASSETS |
| `public/assets/casino` | 9 Symbole + 3 Musik (Opus/OGG) | 8,7 MB | kuratierter Asset-Ausschnitt |

Größte Dateien: `floor-view.ts` 349 · `App.tsx` 325 · `guest-art.ts` 315 · `plinko-canvas.ts` 259 · `ledger.ts` 249 · `shell-canvas.ts` 242 · `staff.ts` 240 · `migrate.ts` 217 · `floor-props.ts` 217 · `sound-fx.ts` 206.
Alle unter ihren LOC-Budgets (`scripts/loc-budgets.mjs`: Legacy-Cap 350 für 6 gelistete Dateien, sonst 200–260). **Keine Datei über Cap.**

## 3. Architektur & Ownership (aus Code bestätigt)

- `src/store/world-store.ts` (143 Z.): einziger Besitzer von `WorldState`, `Ledger`, `Prng`, Tick-Timer (520 ms), Save. Commands sind dünne Delegationen an `*-commands`/`player-tools`. Snapshot-Verbraucher: React via `useSyncExternalStore`.
- `src/store/snapshot.ts` (`buildView`) erzeugt `GameView` (deklariert in `store/types.ts`); UI/Renderer halten keinen eigenen Spielzustand — im Code nachgewiesen.
- `src/core/` headless: kein DOM/Pixi-Import in `src/core` gefunden; `Math.random()` existiert im Spielpfad **nur** in `render/sound-fx.ts:151` (Weißraum-Erzeugung für Audio, nicht spielwirksam).
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

`store/save.ts` (vollständig): Version 8, Key `vcoin.casino.v8`; v5/v6/v7 via LEGACY_KEYS gehoben (Fiat, offene Gewinne, Journal, Look, PRNG-Position bleiben), v3/v4 verworfen. `migrate.ts` (vollständig): Hydration mit Default-Füllung, Heilung verwaister Referenzen (Kisten↔Agenten, Dispute↔Gäste), Geräteidentität aus Katalog, Personal-Migration (`migrate-staff.ts`: Guard-Flag → Agent).

## 9. Governance & Pipeline

- Fehlerregister: `core/governance/error-codes.ts` (23 Codes, `ERR-0000` fail-closed) ↔ `docs/ERROR_CATALOG.md` — **synch** (Formatfehler siehe Befund 4).
- Pipeline: `scripts/run-pipeline.mjs` + `lib/pipeline-plan.mjs` (vollständig). Profile: quick = 9 Gates (lint, loc, typecheck, test-quality, dead-code, deps-matrix, catalog, assets, tests), full/release = + audit + build = 11 Gates. Jedes Gate: harter Timeout, Inhalts-Hash-Cache, rein lesend; nur `fix` schreibt.
- LOC-Guard: `scripts/loc-budgets.mjs` (vollständig) — Rollen-Budgets, 6 Legacy-Einträge (350/200), keine neuen `@loc-exception`.

## 10. CI/CD (alle 5 Workflows vollständig gelesen)

| Workflow | Trigger | Aufgabe |
| --- | --- | --- |
| `ci-verify.yml` | push (**), PR gegen main, dispatch | Job **„Fail-Closed Gates"** = Pflichtstatus; `verify:all` mit `RBD_VERIFY_AUDIT=1`; Commit-/PR-Notes-Gate |
| `auto-version-release.yml` | workflow_run nach erfolgreichem CI Verify auf main (+dispatch) | taggt genau den geprüften Commit; Eskalationsleiter GITHUB_TOKEN→RELEASE_TOKEN→BLOCKED; kein Commit |
| `build-apk.yml` | workflow_call (Release mit `skip_verify`), dispatch, Tag-Push | Java 21, Android SDK 36, Debug + unsigned-Release-APK, Artefakt-Verifikation |
| `long-checks.yml` | dispatch (`npm run ci:long`) | Statistik (4 RTP-Dateien), Soak (100k Ticks), Balance-Lauf + Artefakt, Benchmarks |
| `pr-cleanup.yml` | PR closed (merged) | löscht Head-Branch (nicht main, nicht Fork, `keep-branch` schont) |

Branch-Schutz (Ebene B, laut CI-GATES.md seit 31.10.2026 aktiv): PR erforderlich, Pflichtstatus `Fail-Closed Gates`, kein Force-Push, keine Löschung.

## 11. Tests & Katalog

85 `.test.ts(x)` + 5 `.bench.ts` = 90 — **exakt** die Katalogzahl aus `docs/TEST-CATALOG.md` (53 contract · 17 integration · 9 governance · 6 statistics · 5 performance). Statistik-/Performance-Klassen laufen nur in CI; `vite.config.ts` schließt im quick-Profil `round-rtp-*`, `soak`, `slot-session-rtp` aus.

## 12. Dependencies & Audit

22 direkte Dependencies (3 Runtime: pixi.js, react, react-dom). `docs/DEPENDENCY-AUDIT.md` (Stand 31.10.2026): Umsetzungsstand **stimmt mit `package.json` überein** — engines/packageManager gesetzt, Dev-Server-Default `localhost` + `RBD_DEV_HOST`-Opt-in (in `vite.config.ts` bestätigt), Vite 8.3.5/plugin-react 6.1.2, TypeScript 6.0.3, `projectService` entfernt. Overrides: `glob ^14.0.3`, `minimatch ^11.0.1` (sicherheitsmotiviert).

## 13. Assets

`docs/ASSETS.md`: kuratierter Ausschnitt (9 Symbole, 3 Opus-Tracks) unter `public/assets/casino/`; **Lizenz/Urheber des Quellpakets nicht belegt — vor externer Veröffentlichung zu klären**. WAV-Master außerhalb des Repos. `npm run verify:assets` prüft Manifest ↔ Dateien ↔ `SLOT_SYMBOLS`.

## 14. Befunde & Diskrepanzen (laufend gepflegt)

| # | Schwere | Befund | Beleg |
| --- | --- | --- | --- |
| 1 | **hoch** | `world-store.ts` `spinTest()` ruft `spinTestCmd` **zweimal** auf: Resultat aus dem ersten, Notice aus dem zweiten Lauf. Der Testspin ist gratis, aber Notice und angezeigtes Resultat stammen von zwei verschiedenen Läufen; der Sandbox-Seed wird doppelt fortgeschrieben. | `src/store/world-store.ts` (Methode `spinTest`); `game-commands.ts` |
| 2 | mittel | **aufgelöst**: Code bucht 150 VC Startkapital (`money.ts`: `STARTING_CAPITAL = fromVC(150)`, `openHouse()`), Store-Notice nennt 150 VC, README behauptet „Du startest mit 0,00 VC". Das Portemonnaie startet tatsächlich bei 0 — die README-Aussage ist ohne diese Unterscheidung falsch bzw. irreführend. | `sim/money.ts`; `world-store.ts`; README |
| 3 | mittel | Gate `assets` meldet bei Fehler **ERR-4016** (definiert als „langer Nachweis in CI nicht gelaufen/rot") — mögliche Fehlzuordnung; kein eigener Assets-Code im Register. | `lib/pipeline-plan.mjs`; `error-codes.ts` |
| 4 | niedrig | `docs/ERROR_CATALOG.md`: ERR-4013/ERR-4014-Zeile verschmolzen (`… pruefen. \|\| ERR-4014 …`) — kaputte Markdown-Tabellenzeile; zusätzlich CRLF (`.gitattributes` normalisiert nur ARCHITECTURE.md). | `docs/ERROR_CATALOG.md` |
| 5 | niedrig | Stufenzählung uneinheitlich: ARCHITECTURE.md/CI-GATES.md „neun Stufen", Pipeline führt 11 Gates; AGENTS.md nennt das assets-Gate nicht. | `pipeline-plan.mjs` vs. Doku |
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
| 42 | info | Doppelung: `ANALYSE-BERICHT-CASINO-FLOOR.md` (256 Zeilen) liegt identisch im Wurzelverzeichnis **und** unter `docs/` — die Projekt-Convention sammelt Doku unter `docs/`. | Wurzel + `docs/` |
| 43 | info | **Asset-Pipeline jetzt vollständig (Pull-Batch)**: `scripts/build-asset-manifest.mjs` (neu, Manifest **v3**: ~539 Texturen in 8 Kategorien + Frame-Animationen + Emitter + 6 Musiktracks, Fail-Closed gegen fehlende Dateien), `verify-assets.mjs` auf v3 umgestellt, `main.tsx` preloaded ~1,3 MB (Symbole+Maschinen+Deko+Plinko), `music.ts` mit NIGHT/MENU/BACKGROUND, `App.tsx` ordnet Popups Musikstimmungen zu, Asset-Library-Popup (192 Zeilen) mit Animations-/Emitter-Previews. Konsistenz geprüft: alle ENGINE_SYMBOLS-Pfade (book/scarab/ankh/eye-of-horus/urn/rank-*) existieren im Paket. | `scripts/`, `src/render/`, `src/App.tsx` |
| 44 | info | **Asset-Lizenz: Status im Pull bestätigt — weiterhin unbelegt.** `docs/ASSETS.md` (§ Herkunft und Rechte, unverändert geblieben): die beiliegende README nennt **keine Lizenz und keinen Urheber**, „das Paket ist kein freigegebenes Distributionsmaterial“; vor externer Veröffentlichung muss die Herkunft geklärt bleiben. Das Dokument ist dazu jetzt konsistent ehrlich (539 PNG/7 JSON/6 WAV, ~170 MB Quelle, 13,4 MB ausgeliefert). Offener Punkt 4 bleibt damit aktiv. | `docs/ASSETS.md` |
| 45 | info | **Neues Doku-Double: `docs/event-narrative-engine-taskplan.md` (687 Zeilen)** — sequenzieller Plan NAR-00…NAR-16 für eine datengetriebene Narrative Engine: Typed Sim Facts, Charaktergedächtnis, Beziehungen, Event-Scheduler, Event-Command-DSL mit Allowlist, Content-Registry, LLM-Textadapter (nur Darstellungstext, Regeln bleiben deterministisch), **Save v9**, Migration der beiden bestehenden `demandEvent`s, autonome Rivalen. Basiert auf Stand `708d31c` (vor dem Pull; kleine Veraltungen z. B. Poker-Profile nicht reflektiert — irrelevant für den Plan). Zuständigkeit: künftige Turns, nicht Inventur. | `docs/event-narrative-engine-taskplan.md` |
| 47 | info | **Eskalations-Leiter global (T10):** `scripts/lib/escalation.mjs` klassifiziert Befunde in `AUTO_FIX → LOCAL_GATE → REMOTE_CI → AGENT → BLOCKED`; `npm run escalation:plan` nennt die Stufe. Fail-Closed bleibt für Geld/Ledger/RNG/Save. `release-escalation.mjs` bleibt unangetastet (Push-Token), damit keine zweite Leiter entsteht. | `scripts/lib/escalation.mjs`, `scripts/escalation-plan.mjs` |
| 48 | info | **Doc-Gate + Hooks (T10):** `scripts/lib/doc-sync.mjs` führt sechs Pflichtdokumente mit Pflichtabschnitten und `rbd-doc`-Marker (Version + UTC); `verify:docs` ist Gate (`ERR-4017`), der Pre-Commit-Hook schreibt ihn. `deps-matrix` und `catalog` sind keine Gates mehr; Matrix, Katalog und Marker entstehen im Hook. Wurzel-Duplikat `ANALYSE-BERICHT-CASINO-FLOOR.md` (identische MD5) gelöscht. | `scripts/lib/doc-sync.mjs`, `.githooks/`, `scripts/lib/pipeline-plan.mjs` |
| 49 | info | **Import/Export-Engine (T10):** `src/core/io/issues.ts` (42), `envelope.ts` (66), `repair.ts` (42), `src/store/transfer.ts` (46), `src/ui/transfer-panel.tsx` (49) — alle unter ihren LOC-Zonen; keine zweite Save-Wahrheit (`toSavedGame`/`replaySave`), Trockenlauf vor Anwendung, Prüfsumme FNV-1a. Panel sitzt im Prüfungs-Popup. | `src/core/io/`, `src/store/transfer.ts`, `src/ui/transfer-panel.tsx` |
| 46 | info | `docs/ASSETS.md` und `README.md` aktualisiert: README zeigt jetzt Vorher/Nachher-Vergleichsbilder (`docs/screenshots/comparison/`), die Screenshots-README erlaubt dort versionierte Belege (v1/v2) neben dem kanonischen `current/`; `autofix-0911.mjs` räumt `comparison/` bewusst **nicht** mehr (Regel angepasst). Architektur-Matrix zählt die neuen Dateien (build-asset-manifest, plinko-assets, slot-symbols-extra, asset-library-popup) bereits mit. | `README.md`, `docs/screenshots/README.md` || 50 | info | **Connector-Eskalation (T11):** `scripts/lift-commit-body.mjs --json` liefert den PR-Plan (`level: AGENT`, `channel: github-connector`, `branch`, `base`, `title`, `bodyFile`, `body`). CI nutzt weiter `gh`; ohne Token bleibt der Lauf grün und der Plan ist die Übergabe. Der Level kommt aus `scripts/lib/escalation.mjs` — keine zweite Leiter. | `scripts/lift-commit-body.mjs`, `docs/ESCALATION.md` |

## 15. Lesedeckung (Ehrlichkeits-Matrix)

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
| docs/event-narrative-engine-taskplan.md (687) | 🔶 Kopf + Zielarchitektur + Taskliste NAR-00…16 gelesen; Körper nicht zeilenweise |
| docs/ANALYSE-BERICHT-CASINO-FLOOR.md (256, doppelt root+docs) | 🔶 Struktur erfasst (identische Doppelung, Befund 42); Inhalt nicht zeilenweise |
| src/test (2: measure.ts, random-seed.ts) | ✅ beide bis letzte Zeile (T6) |
| index.css, styles, assets/manifest.json | 🔶 Struktur + Manifest vollständig |
| Fehlerregister-Konsistenz | ✅ beide Register abgeglichen: exakt identische 23 Codes (T3 bestätigt) |

## 16. Offene Punkte / Nutzer-Entscheidungen

1. **Befund 1 (spinTest-Doppelaufruf)**: Notice aus demselben Lauf nehmen (1-Zeilen-Fix in `world-store.ts`) — Code-Änderung, erfordert Freigabe.
2. **Befund 2**: README-Formulierung „0,00 VC" präzisieren (Portemonnaie vs. 150 VC Startkapital auf dem Hauskonto) — Doku-Änderung, erfordert Freigabe.
3. **Befund 3/4/5/6/7**: kleinere Doku-/Register-Korrekturen, je einzeln freizugeben.
4. **Asset-Lizenz** (ASSETS.md): **vom Nutzer am 01.11.2026 bestätigt — „Lizenzen liegen bei mir".** Damit ist die Weitergabe geklärt; offen bleibt nur der Nachweis im Repo (Referenz/Datei zur Lizenz ergänzen), nicht mehr die Grundsatzfrage.
5. Zeile-für-Zeile-Lesung von ui/render/tests: **ui vollständig (39/41 inkl. `asset-library-popup`, T7/T8)**; **render 28+/53** (Rest: room-art, room-dressing, scene-cache, textures/furniture-art neuer Stand, floor-touch, player-marker, rig-pose, Benches); 86 Testdateien katalogisiert, Körper noch nicht zeilenweise — Fortsetzung in T10.
6. **Befund 33 (Bar-Kapazitäts-Anzeige)**: drei UI-Dateien von der Sim-Funktion `barCapacityForLevel` auf `12 + 8·max(1, level)` umstellen — kleiner, klar abgegrenzter Fix, erfordert Freigabe.
7. **Befund 34 (`Â·`-Mojibake in table-launcher)**: eine Zeile, rein kosmetisch — bei Freigabe mit Befund 33 zusammen reparierbar.

## 17. Auftrag T9: Governance-, Eskalations- und Transfer-Ausbau (erfasst, noch nicht implementiert)

Am **2026-11-01 09:00 UTC** vom Nutzer beauftragt. In diesem Turn wurde **kein Code geändert** — der Auftrag ist hier vollständig festgehalten, damit er turn-übergreifend nicht verloren geht; Umsetzung ab T10.

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

## Fortsetzungs-Log

| Turn | Erledigt |
| --- | --- |
| T1 | Wurzel, Doku, Workflows, economy/rng/physics/governance, store komplett gelesen; Struktur aller Bereiche erfasst; Befunde 1–11 skizziert. |
| T2 | Artefakt angelegt; money/templates/tick/actions vollständig gelesen; Startkapital-Frage aufgelöst (150 VC, Befund 2 aktualisiert); Deckung und Befundtabelle fortgeschrieben. |
| T3 | Alle Exporte von core/games + engines extrahiert; alle 48 ui-, 50 render- und 34 scripts-Dateien per Kopf-/Größen-Extraktion erfasst; Manifest gelesen; Fehlerregister-Abgleich (identische 23 Codes); Befunde 12–14 ergänzt. |
| T4 | **2026-11-01 08:17 UTC**: core/games (31 Dateien) und 40 core/sim-Dateien bis zur letzten Zeile gelesen; Versionierung v1.2 im Header; Befunde 15–20; Deckungstabelle fortgeschrieben. |
| T5 | **2026-11-01 ~08:22 UTC**: die letzten 13 core/sim-Dateien gelesen (pathfinding, player, player-jobs, player-look, player-rpg, progression, queue-spots, remodel, rivals, types, types-model, upkeep, world) — **core/sim vollständig**; Befund 18 aufgelöst, 21–25 ergänzt; v1.3. |
| T6 | **2026-11-01 ~08:30 UTC**: alle übrigen 31 scripts-Dateien bis letzte Zeile gelesen — **scripts/scripts-lib vollständig (34/34)**; `src/test` vollständig (2/2); ui-/render-Zählung korrigiert (38 bzw. 43 produktive Dateien) mit Größen/Exporten/Scans; **Korrektur: das Befund-21–25-Segment aus T5 war nicht im File gelandet — hier als Befunde 21–32 neu geschrieben**; v1.4. |
| T7 | **2026-11-01 ~08:38 UTC**: ui-Batches 2–4 (30 Dateien: alle games-Popups, Rules-Editor, BetConsole, Header, PopupShell, Formate/Labels, Help/Journal/Look/Sound/Exclusion, Foreign-Floor-Dateien, Tableau, Karten) bis letzte Zeile — **src/ui vollständig (38/38 produktiv)**; Befund 33 durch Gegenpr\u00fcfung `deliveries.ts:12` best\u00e4tigt, Befunde 34–36 erg\u00e4nzt; erster render-Batch (6 gr\u00f6\u00dfte Dateien) bis letzte Zeile; Git-Stand: `origin` = github.com/vannon091118/rigged-by-design, HEAD 708d31c, nur `docs/INVENTORY.md` untracked (kein lokaler `origin/main`-Ref zum Vergleich); v1.5. |
| T11 | **2026-11-01 09:25 UTC**: Branch `freebuff/9f1e857ba05731117031ec2a` committet (`f2f46c7`, 32 Dateien) und via Connector gepusht; CI-Läufe `CI Verify` (#110) und `PR Escalation` gestartet. Connector-Eskalation implementiert (`lift-commit-body --json`), Doku nachgezogen. v1.9. |
| T10 | **2026-11-01 09:15 UTC**: Auftrag T9 umgesetzt. Neue Module `src/core/io/{issues,envelope,repair}.ts`, `src/store/transfer.ts`, `src/ui/transfer-panel.tsx` (Import/Export mit Reparaturplan); Eskalations-Leiter `scripts/lib/escalation.mjs` + `escalation:plan`; Doc-Gate `scripts/lib/doc-sync.mjs` + `verify:docs`; Hooks `.githooks/{pre-commit,commit-msg}` + `hooks:install`; PR-Eskalation `.github/workflows/pr-escalation.yml` + `lift-commit-body.mjs`; Pipeline-Gates `deps-matrix`/`catalog` durch `docs` ersetzt; Pflichtdoku Changelog/Devtagebuch/Roadmap/Escalation angelegt; Fehlercodes `ERR-4017/4018/5001`. Kein Vitest lokal. v1.8. |
| T9 | **2026-11-01 09:00 UTC**: main-Stand geprüft (`492ac3a`, Arbeitsbaum bis auf dieses Artefakt sauber). **Neuen Nutzerauftrag vollständig als Abschnitt 17 erfasst** (Import/Export-Manager mit LOC-Cap, globale Eskalations-Stufen, Commit-Body→PR-Body via CI, Doc-Sync-Gate + Doku-Strukturvorgaben, Pflichtdoku nach jeder Änderung, Pre-Commit-Hook statt generierter Matrizen, keine Redundanz/keine lokalen eskalierbaren Tests). Asset-Lizenz vom Nutzer bestätigt (Punkt 4). Kein Code geändert. v1.7. |
| T8 | **2026-11-01 ~08:52 UTC**: **Pull via Connector** `708d31c → 492ac3a` (583 Dateien, +3.119/−163 (583 Dateien)) eingearbeitet und ausgewertet: Asset-Paket (~550 PNG/OGG), Manifest v3 + Generator, Asset-Library, Poker-CPU-Profile + **Geldweg-Bugfix**, Roulette-Farbkorrektur, 3 neue Musiktracks; 22 weitere render-Dateien bis letzte Zeile gelesen; Befunde 37–46 (inkl. Lizenzstatus-Bestätigung, Taskplan-NAR-00…16, Versions-Bump fehlt beim Pull); Doku-Diffs (ASSETS/README/ARCHITECTURE/screenshots) gelesen; `docs/INVENTORY.md` bleibt durch den Pull unangetastet (nicht im Diff); v1.6. |
