# Repository-Inventur (lebendes Artefakt)

<!-- rbd-doc: managed -->

> Zweck: vollständige, reproduzierbare Inventur der Repository. Dieses Dokument
> ist das einzige geschriebene Artefakt der Untersuchung und wird bei jeder
> Fortsetzung aktualisiert.
>
> | Feld | Wert |
> | --- | --- |
> | Erstellt | 2026-11-01 ~07:47 UTC (T1) |
> | **Aktualisiert** | **2026-11-11 (Repo-Cleanup)** |
> | Pflege | `node scripts/build-inventory.mjs`; §18 entsteht aus `git ls-files` |
> | Branch/HEAD | bewusst nicht festgeschrieben; maßgeblich ist `git rev-parse HEAD` |
> | Arbeitsbaum | Abdeckung und Dateizahl stehen in §18 |
>
> Fortsetzungs-Log am Ende dieses Dokuments.

## 1. Überblick

| Feld | Wert |
| --- | --- |
| Projekt | „Rigged by Design" — Lebenssimulation; das Casino ist Start- und Testumgebung, nicht das Genre (Satire, kein Echtgeld) |
| Stack | Vite 8 + React 19 + TypeScript 6 (strict) + PixiJS 8, Vitest 5, ESLint 10 |
| Version | `package.json` (einzige Versionsquelle), Engine `node >=22.22.2`, `packageManager pnpm@10.4.1` |
| Plattform | Web (Vite) + Android-APK über Capacitor 8 (`capacitor.config.json`, App-ID `de.riggedbydesign.casino`) |
| Geld | VaCoins als ganzzahlige Mikro-Einheiten (1 VC = 10.000), Buchungen nur im Ledger |
| Sprache | Code-Kommentare/UI-Texte deutsch, Identifikatoren englisch |

## 2. Struktur- und Größen-Matrix (gemessen 2026-11-11)

| Bereich | Dateien (.ts/.tsx) | Zeilen | Zuständigkeit |
| --- | ---: | ---: | --- |
| `src/core` | 530 | 51.279 | Headless-Simulation: economy, games, governance, physics, rng, sim |
| `src/render` | 97 | 10.281 | PixiJS-Floor, Spiele-Bühnen, Audio, Assets |
| `src/ui` | 127 | 10.199 | React-Panels/Popups inkl. 10 Game-Popups |
| `src/store` | 55 | 3.998 | WorldStore (Welt/Ledger/PRNG/Save), Commands, Snapshot |
| `src/test` | 2 | 35 | `measure.ts`, `random-seed.ts` (Test-Werkzeuge) |
| `src/App.tsx` + `main.tsx` + `vite-env.d.ts` | 3 | 246 | App-Verdrahtung |
| **Summe src** | **814** | **76.038** | |
| `scripts` | 115 (.mjs) | — | Pipeline, Gates, Release, Android, Audio |
| `.github/workflows` | 9 | — | auto-resolve, auto-version-release, build-apk, ci-verify, ensure-pr, long-checks, pr-cleanup, pr-watcher, promote |
| `docs` | 84 Dateien: 12 Flachdokumente, 8 Verträge, 51 Screenshots, 9 Banner und 4 weitere | — | 12 Doku-Dateien flach unter `docs/`, Hauptbanner `banner.svg`; Belege in `screenshots/{current,v0.3.78,v0.3.114,v0.3.132,comparison}` |
| `public/assets/casino` | 554 Dateien: 24 Symbole, 6 Tonspuren, 2 Atlas-Seiten, 7 FX-JSON | 17 MB | kuratierter Asset-Ausschnitt |

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
| `sim/own-play.ts` | Eigener Gastgeldweg: `PORTEMONNAIE` → `HAUSKONTO`, Gewinn zurück, ungedeckter Rest auf `HAUS_SCHULDEN`; PRNG-Snapshot/Rollback, Kartenstart und -abrechnung, Risiko-Karte |

Regeln aus AGENTS.md im Code nachgewiesen: kein `addVC` außerhalb von Buchungslogik (Verwender: ledger, foreign-play, snapshot, self-exclusion-bet — alle Buchungs-/Ableitungspfade); Auszahlungen nie gekappt (`openLiability(DEBT_ACCOUNT)`).

## 5. RNG & Physik (vollständig gelesen)

- `rng/prng.ts`: Mulberry32, uint32-Zustand, `nextInt` mit Rejection-Sampling (kein Modulo-Bias), `getState/setState` für Save.
- `rng/weighted.ts`: `buildDistribution` mit hart begrenztem Bias (`MAX_BIAS_BPS` 9.000) und Deadzones; `rollNumber` liefert `chance` aus derselben Verteilung; `pickWeighted` mit Accept-Filter.
- `rng/shoe.ts`: Kartenschuh ohne Zurücklegen, partieller Fisher-Yates, Mischung erst bei leerem Schuh.
- `physics/`: Körper (Kreis/Segment/Polygon) mit Trägheit, `PhysicsWorld` mit festem Zeitschritt (1/120 s), Impulsen, Reibungsmoment, Trigger-Zonen, allokationsfreier Breitphase. Grundlage von Plinko.

## 6. Spiele (8 + Testspin)

Naht: `core/games/contracts.ts` (vollständig) — `playAction({game, stake, houseEdgeBps?, bonusBps?, variant?, captureTrack?, roulette?, shell?})`; prüft **vor** der Ziehung; `payout = mulVC(stake, multiplierBps)`; Bonus/Hausvorteil greifen nur auf Gewinnen; Bias ≤ 9.000 bps. Spiele: SLOT, BLACKJACK, POKER, VIDEO_POKER, ROULETTE, PLINKO, SHELL, DICE.
Testspin: `sim/actions.ts testSpin()` — Sandbox mit eigenem Seed, **kein Ledger, kein Welt-PRNG** (nachgewiesen).
Eigener Gastmodus: `core/sim/own-play.ts` und `store/own-play.ts` spielen alle acht Spiele über dieselben Engines; `MachinePopup` schaltet die Rolle, `MachinePlay` reicht den vorhandenen `TableLauncher` weiter. Die Store-Fassade hält die offene Kartenrunde je Gerät und verhindert doppelte Abrechnung.
Dateien: 20 Module in `core/games` + 11 in `engines/`; 10 UI-Popups; 22 Render-Bühnen/Canvas.

## 7. Tick & Simulation (Kern gelesen)

`sim/tick.ts` (vollständig): Gast-Zustandsmaschine ENTER→EXCHANGE→CHOOSE→PLAY/DRINK/TOILET/WAIT→CASHOUT→LEAVE/ANGRY; Tickreihenfolge: Queue, Gäste, Streit, Agenten, Decay, Reputation, Personal, fremde Floors, Nachfrage, Spieler-Recovery, Speed-Stufen. `sim/actions.ts` (vollständig): `settleGuests` (vor Umbau alle Ansprüche), Reinigung/Reparatur/Mods/Walzen/Slot-Regeln, `foreignRound` (PRNG-Snapshot + Rollback bei Fehlern, Buchung erst nach成功的 Rechnung).
`sim/templates.ts` (vollständig): 3 Blueprints, `ensureStarter` stellt den Gratis-Automaten wieder her.

## 8. Save & Migration

`store/save.ts` (vollständig): **Version 11**, Key `vcoin.casino.v11`; `LEGACY_KEYS` hebt v5–v10 (Fiat, offene Gewinne, Journal, Look, Besuchererinnerungen und PRNG-Position bleiben; v5–v10 leiten das Layout deterministisch aus ihrer Vorlage ab; v3/v4 werden verworfen), `OLD_KEYS` verwirft v3/v4. `migrate.ts` (vollständig): Hydration mit Default-Füllung, Heilung verwaister Referenzen (Kisten↔Agenten, Dispute↔Gäste), Geräteidentität aus Katalog, Personal-Migration (`migrate-staff.ts`: Guard-Flag → Agent).

## 9. Governance & Pipeline

- Fehlerregister: `core/governance/error-codes.ts` ↔ `docs/ARCHITECTURE.md`, `ERR-0000` fail-closed; Codes aufsteigend sortiert, inklusive `ERR-4017`–`ERR-4026` und `ERR-5001` (Formatfehler aus Befund 4 in T23 behoben).
- Pipeline: `scripts/run-pipeline.mjs` + `lib/pipeline-plan.mjs` (vollständig). 19 Gates, davon 15 Required; Profile: light = 9, fast = 12, dev = 10, quick = 14, integration = 12, full/release = 16 (inkl. Audit), mechanics = 1 (nur Statistik, Soak, Langlauf). Kein Gate hat einen Default-Timeout; nur ein explizit gesetzter `timeoutMs` beendet es. Cache-Fingerabdruck aus Git (`HEAD` + Binär-Diff + unversionierte Dateien), rein lesend; nur `fix` schreibt (ESLint `--fix`, Matrix, Katalog, Doku-Marker).
- LOC-Guard: `scripts/loc-budgets.mjs` (vollständig) — Rollen-Budgets, 6 Legacy-Einträge (350/200), keine neuen `@loc-exception`.

## 10. CI/CD (alle 3 Workflows vollständig gelesen)

| Workflow | Trigger | Aufgabe |
| --- | --- | --- |
| `pr-cleanup.yml` | PR closed (merged) | meldet den gemergten Head-Branch (nicht main, nicht Fork, `keep-branch` schont), löscht nicht |
| `promote.yml` | dispatch (`inspect`/`integrate`) | Statusanzeige oder manueller Notausgang; kein Auto-Merge |
| `ensure-pr.yml` | push auf `lane/**` | legt oder aktualisiert den PR; führt bewusst keinen Branch-Code aus |

Branch-Schutz: klassischer Schutz auf `main` (kein Ruleset), **keine Required-Status-Checks**, `strict: false`, 0 Reviews, `enforce_admins: true`, kein Force-Push, keine Löschung. Der Merge nach lokalem `pnpm run ci:local` und Review erfolgt durch Mensch/Agent; es gibt keinen Cloud-Testlauf; `promote` ist manuell (nur Dispatch). Details in `docs/CI.md`.

## 11. Tests & Katalog

311 Katalogdateien: 304 Testdateien mit deklariertem Ziel und 7 Benchmark-Dateien; System und Beweisklasse erzeugt `pnpm run catalog` aus `@test-target` in `docs/INVENTORY.md` (Block unter §11). Statistik und Langlauf laufen ausschließlich über `pnpm run test:mechanics`; `vite.config.ts` schließt die sechs Mechanik-Dateien aus `src/Config/test-lanes.json` in jedem Regelprofil aus.

### Testkatalog (generiert)

<!-- TEST_CATALOG_START -->
Summe: 393 Dateien — contract 216 · integration 103 · governance 61 · statistics 6 · performance 7.

| Testdatei | System | Beweisklasse | Lokal | Deklariertes Ziel |
| --- | --- | --- | --- | --- |
| `src/Config/__tests__/eslint-determinism.test.ts` | config | contract | ja | `src/Config/eslint.config.mjs` |
| `src/core/contracts/__tests__/actionset.test.ts` | other | contract | ja | `src/core/contracts/actionset.ts` |
| `src/core/contracts/__tests__/actor-id.test.ts` | other | contract | ja | `src/core/contracts/actor-id.ts` |
| `src/core/contracts/__tests__/domain-event.test.ts` | other | contract | ja | `src/core/contracts/domain-event.ts` |
| `src/core/contracts/__tests__/factor.test.ts` | other | contract | ja | `src/core/contracts/factor.ts` |
| `src/core/contracts/__tests__/relationship.test.ts` | other | contract | ja | `src/core/contracts/relationship.ts` |
| `src/core/contracts/__tests__/save.test.ts` | other | contract | ja | `src/core/contracts/save.ts` |
| `src/core/contracts/__tests__/world-time.test.ts` | other | contract | ja | `src/core/contracts/world-time.ts` |
| `src/core/economy/__tests__/economy.test.ts` | economy | contract | ja | `src/core/economy/ledger.ts` |
| `src/core/economy/__tests__/ledger-atomicity.test.ts` | economy | contract | ja | `src/core/economy/ledger.ts` |
| `src/core/economy/__tests__/ledger-checkpoint.test.ts` | economy | contract | ja | `src/core/economy/ledger.ts` |
| `src/core/economy/__tests__/ledger-diagnose.test.ts` | economy | contract | ja | `src/core/economy/ledger.ts` |
| `src/core/games/__tests__/contracts.test.ts` | games | contract | ja | `src/core/games/contracts.ts` |
| `src/core/games/__tests__/dice-bets.test.ts` | games | contract | ja | `src/core/games/dice-bets.ts` |
| `src/core/games/__tests__/foreign-round-atomic.test.ts` | sim | contract | ja | `src/core/sim/actions.ts` |
| `src/core/games/__tests__/game-rounds.test.ts` | games | contract | ja | `src/core/games/contracts.ts` |
| `src/core/games/__tests__/mod-profile.test.ts` | games | contract | ja | `src/core/games/mod-profile.ts` |
| `src/core/games/__tests__/pity-settlement.test.ts` | games | contract | ja | `src/core/games/slot-transparency.ts` |
| `src/core/games/__tests__/plinko-sandbox.test.ts` | games | contract | ja | `src/core/games/plinko-sandbox.ts` |
| `src/core/games/__tests__/plinko-track.test.ts` | games | contract | ja | `src/core/games/contracts.ts` |
| `src/core/games/__tests__/poker-distribution.test.ts` | games | statistics | nein, Mechanik | `src/core/games/poker-hand.ts` |
| `src/core/games/__tests__/poker-table.test.ts` | games | contract | ja | `src/core/games/poker-table.ts` |
| `src/core/games/__tests__/risk-card.test.ts` | games | contract | ja | `src/core/games/risk-card.ts` |
| `src/core/games/__tests__/roulette-table.test.ts` | games | contract | ja | `src/core/games/roulette-table.ts` |
| `src/core/games/__tests__/round-rtp-high.test.ts` | games | statistics | nein, Mechanik | `src/core/games/round.ts` |
| `src/core/games/__tests__/round-rtp-machines.test.ts` | games | statistics | nein, Mechanik | `src/core/games/round.ts` |
| `src/core/games/__tests__/round.bench.ts` | games | performance | nein, Mechanik | `src/core/games/round.ts` |
| `src/core/games/__tests__/round.test.ts` | games | contract | ja | `src/core/games/round.ts` |
| `src/core/games/__tests__/shell-round.test.ts` | games | contract | ja | `src/core/games/shell-round.ts` |
| `src/core/games/__tests__/slot-config.test.ts` | games | contract | ja | `src/core/games/slot-config.ts` |
| `src/core/games/__tests__/slot-expectation.test.ts` | games | contract | ja | `src/core/games/engines/slot-models.ts` |
| `src/core/games/__tests__/slot-paylines.test.ts` | games | contract | ja | `src/core/games/engines/slot.ts` |
| `src/core/games/__tests__/slot-profile.test.ts` | games | contract | ja | `src/core/games/slot-profile.ts` |
| `src/core/games/__tests__/slot-session-rtp.test.ts` | games | statistics | nein, Mechanik | `src/core/games/slot-session.ts` |
| `src/core/games/__tests__/slot-session.test.ts` | games | contract | ja | `src/core/games/slot-session.ts` |
| `src/core/games/__tests__/slot-transparency.test.ts` | games | contract | ja | `src/core/games/slot-transparency.ts` |
| `src/core/games/__tests__/test-spin.test.ts` | games | contract | ja | `src/core/games/sandbox.ts` |
| `src/core/games/__tests__/video-poker-ranks.test.ts` | games | contract | ja | `src/core/games/engines/cards.ts` |
| `src/core/games/engines/__tests__/blackjack.test.ts` | games | contract | ja | `src/core/games/engines/blackjack.ts` |
| `src/core/games/engines/__tests__/interactive-cards.test.ts` | games | contract | ja | `src/core/games/engines/interactive-cards.ts` |
| `src/core/governance/__tests__/affected-tests.test.ts` | pipeline | governance | ja | `scripts/lib/affected-tests.mjs` |
| `src/core/governance/__tests__/agent-cause.test.ts` | pipeline | governance | ja | `scripts/agent-cause.mjs` |
| `src/core/governance/__tests__/agent-new-args.test.ts` | pipeline | governance | ja | `scripts/lib/agent-new-args.mjs` |
| `src/core/governance/__tests__/apk-signing.test.ts` | config | contract | ja | `src/Config/android-signing.json` |
| `src/core/governance/__tests__/auto-resolve.test.ts` | pipeline | governance | ja | `scripts/auto-resolve.mjs` |
| `src/core/governance/__tests__/body-sync.test.ts` | pipeline | governance | ja | `scripts/lib/body-sync.mjs` |
| `src/core/governance/__tests__/branch-lifecycle.test.ts` | pipeline | governance | ja | `scripts/lib/branch-lifecycle.mjs` |
| `src/core/governance/__tests__/branch-prune.test.ts` | pipeline | governance | ja | `scripts/lib/branch-prune.mjs` |
| `src/core/governance/__tests__/ci-docs-parity.test.ts` | pipeline | governance | ja | `scripts/lib/pipeline-plan.mjs` |
| `src/core/governance/__tests__/ci-gates.test.ts` | ci | governance | ja | `.github/workflows/ensure-pr.yml` |
| `src/core/governance/__tests__/ci-plan.test.ts` | pipeline | governance | ja | `scripts/lib/ci-plan.mjs` |
| `src/core/governance/__tests__/ci-state.test.ts` | pipeline | governance | ja | `scripts/lib/ci-state.mjs` |
| `src/core/governance/__tests__/ci-workflow-contracts.test.ts` | ci | governance | ja | `.github/workflows/ensure-pr.yml` |
| `src/core/governance/__tests__/claim-collisions.test.ts` | pipeline | governance | ja | `scripts/lib/claim-collisions.mjs` |
| `src/core/governance/__tests__/claim-evidence-ambiguity.test.ts` | pipeline | governance | ja | `scripts/lib/claim-evidence.mjs` |
| `src/core/governance/__tests__/claim-evidence-reconcile.test.ts` | pipeline | governance | ja | `scripts/lib/claim-evidence.mjs` |
| `src/core/governance/__tests__/claim-evidence.test.ts` | pipeline | governance | ja | `scripts/lib/claim-evidence.mjs` |
| `src/core/governance/__tests__/claim-lifecycle.test.ts` | pipeline | governance | ja | `scripts/lib/claim-lifecycle.mjs` |
| `src/core/governance/__tests__/claim-save-scope.test.ts` | pipeline | governance | ja | `scripts/lib/lane-claims.mjs` |
| `src/core/governance/__tests__/dependency-governance.test.ts` | governance | contract | ja | `src/core/governance/error-codes.ts` |
| `src/core/governance/__tests__/destructive-commands.test.ts` | pipeline | governance | ja | `scripts/` |
| `src/core/governance/__tests__/gate-diagnostics.test.ts` | pipeline | governance | ja | `scripts/lib/gate-diagnostics.mjs` |
| `src/core/governance/__tests__/gate-runner.test.ts` | pipeline | governance | ja | `scripts/lib/gate-runner.mjs` |
| `src/core/governance/__tests__/impact-graph.test.ts` | pipeline | governance | ja | `scripts/lib/impact-graph.mjs` |
| `src/core/governance/__tests__/impact.test.ts` | pipeline | governance | ja | `scripts/lib/affected-tests.mjs` |
| `src/core/governance/__tests__/integration-controller.test.ts` | pipeline | governance | ja | `scripts/lib/integration.mjs` |
| `src/core/governance/__tests__/issue-scope.test.ts` | pipeline | governance | ja | `scripts/lib/issue-scope.mjs` |
| `src/core/governance/__tests__/lane-claims.test.ts` | pipeline | governance | ja | `scripts/lib/lane-claims.mjs` |
| `src/core/governance/__tests__/narrative-compiler.test.ts` | pipeline | governance | ja | `scripts/lib/narrative-compiler.mjs` |
| `src/core/governance/__tests__/narrative-content-quality.test.ts` | pipeline | governance | ja | `scripts/lib/narrative-blocks.mjs` |
| `src/core/governance/__tests__/narrative-content.test.ts` | pipeline | governance | ja | `scripts/lib/narrative-content.mjs` |
| `src/core/governance/__tests__/narrative-lane-integration.test.ts` | pipeline | governance | ja | `scripts/lib/narrative-content.mjs` |
| `src/core/governance/__tests__/narrative-world-text.test.ts` | content | contract | ja | `content/narrative/contributions` |
| `src/core/governance/__tests__/pipeline-modes.test.ts` | pipeline | governance | ja | `scripts/lib/pipeline-plan.mjs` |
| `src/core/governance/__tests__/pr-body.test.ts` | pipeline | governance | ja | `scripts/lib/pr-body.mjs` |
| `src/core/governance/__tests__/pr-watcher.test.ts` | pipeline | governance | ja | `scripts/pr-watcher.mjs` |
| `src/core/governance/__tests__/pretask-blocked-issues.test.ts` | pipeline | governance | ja | `scripts/lib/worktree-isolation.mjs` |
| `src/core/governance/__tests__/pretask-cause.test.ts` | pipeline | governance | ja | `scripts/agent-cause.mjs` |
| `src/core/governance/__tests__/pretask-issues.test.ts` | pipeline | governance | ja | `scripts/lib/worktree-isolation.mjs` |
| `src/core/governance/__tests__/pretask-modes.test.ts` | pipeline | governance | ja | `scripts/lib/worktree-isolation.mjs` |
| `src/core/governance/__tests__/pretask-takeover.test.ts` | pipeline | governance | ja | `scripts/lib/takeover.mjs` |
| `src/core/governance/__tests__/pretask.test.ts` | pipeline | governance | ja | `scripts/lib/worktree-isolation.mjs` |
| `src/core/governance/__tests__/process-sweep.test.ts` | pipeline | governance | ja | `scripts/lib/process-sweep.mjs` |
| `src/core/governance/__tests__/promote-guard.test.ts` | pipeline | governance | ja | `scripts/lib/promote-guard.mjs` |
| `src/core/governance/__tests__/promotion-state.test.ts` | pipeline | governance | ja | `scripts/lib/promotion-state.mjs` |
| `src/core/governance/__tests__/promotion-workflows.test.ts` | ci | governance | ja | `.github/workflows/promote.yml` |
| `src/core/governance/__tests__/red-team-gate-lane.test.ts` | pipeline | governance | ja | `scripts/lib/pipeline-plan.mjs` |
| `src/core/governance/__tests__/release-escalation.test.ts` | pipeline | governance | ja | `scripts/lib/release-escalation.mjs` |
| `src/core/governance/__tests__/roadmap-register.test.ts` | docs | contract | ja | `docs/ROADMAP.md` |
| `src/core/governance/__tests__/run-budget.test.ts` | pipeline | governance | ja | `scripts/run-budget.mjs` |
| `src/core/governance/__tests__/staging-scope.test.ts` | pipeline | governance | ja | `scripts/lib/staging-scope.mjs` |
| `src/core/governance/__tests__/task-claim-parity.test.ts` | pipeline | governance | ja | `scripts/lib/lane-claims.mjs` |
| `src/core/governance/__tests__/test-catalog.test.ts` | pipeline | governance | ja | `scripts/lib/test-catalog.mjs` |
| `src/core/governance/__tests__/tree-changes.test.ts` | pipeline | governance | ja | `scripts/lib/tree-changes.mjs` |
| `src/core/governance/__tests__/verify-scope.test.ts` | pipeline | governance | ja | `scripts/verify-scope.mjs` |
| `src/core/governance/__tests__/wip-takeover.test.ts` | pipeline | governance | ja | `scripts/lib/takeover.mjs` |
| `src/core/governance/__tests__/worker-claim-gate.test.ts` | pipeline | governance | ja | `scripts/lib/work-claim.mjs` |
| `src/core/governance/__tests__/worker-dependency-claims.test.ts` | pipeline | governance | ja | `scripts/lib/dependency-fingerprint.mjs` |
| `src/core/governance/__tests__/worker-identity-bootstrap.test.ts` | pipeline | governance | ja | `scripts/lib/worker-identity.mjs` |
| `src/core/governance/__tests__/worker-inventory-bootstrap.test.ts` | pipeline | governance | ja | `scripts/lib/repo-inventory.mjs` |
| `src/core/governance/__tests__/workflow-hardening.test.ts` | ci | governance | ja | `.github/workflows/ensure-pr.yml` |
| `src/core/governance/__tests__/workflow-retry.test.ts` | pipeline | governance | ja | `scripts/lib/pending-commit.mjs` |
| `src/core/governance/__tests__/workflow-state.test.ts` | pipeline | governance | ja | `scripts/task-state.mjs` |
| `src/core/governance/__tests__/workspace-home-drive.test.ts` | pipeline | governance | ja | `scripts/lib/workspace-home.mjs` |
| `src/core/governance/__tests__/worktree-isolation.test.ts` | pipeline | governance | ja | `scripts/lib/worktree-isolation.mjs` |
| `src/core/io/__tests__/escalation.test.ts` | other | contract | ja | `src/core/io/issues.ts` |
| `src/core/physics/__tests__/physics.test.ts` | physics | contract | ja | `src/core/physics/world.ts` |
| `src/core/rng/__tests__/gameplay-entry-role.test.ts` | rng | contract | ja | `src/core/rng/gameplay-entry-points.ts` |
| `src/core/rng/__tests__/shoe.test.ts` | rng | contract | ja | `src/core/rng/shoe.ts` |
| `src/core/rng/__tests__/streams.test.ts` | rng | contract | ja | `src/core/rng/streams.ts` |
| `src/core/rng/__tests__/weighted.test.ts` | rng | contract | ja | `src/core/rng/weighted.ts` |
| `src/core/sim/__tests__/action-queue.test.ts` | sim | contract | ja | `src/core/sim/action-queue.ts` |
| `src/core/sim/__tests__/addiction-consequences.test.ts` | sim | contract | ja | `src/core/sim/spawn.ts` |
| `src/core/sim/__tests__/addiction-stake.test.ts` | sim | contract | ja | `src/core/sim/guest-play.ts` |
| `src/core/sim/__tests__/amenity-reaction.test.ts` | sim | contract | ja | `src/core/sim/amenity-reaction.ts` |
| `src/core/sim/__tests__/anger-decay.test.ts` | sim | contract | ja | `src/core/sim/upkeep.ts` |
| `src/core/sim/__tests__/anger-patience.test.ts` | sim | contract | ja | `src/core/sim/upkeep.ts` |
| `src/core/sim/__tests__/apartment-render.test.ts` | sim | contract | ja | `src/core/sim/player-apartment.ts` |
| `src/core/sim/__tests__/arena.test.ts` | sim | contract | ja | `src/core/sim/arena.ts` |
| `src/core/sim/__tests__/balance-operating.test.ts` | sim | contract | ja | `src/core/sim/tick.ts` |
| `src/core/sim/__tests__/bar-capacity.test.ts` | sim | contract | ja | `src/core/sim/deliveries.ts` |
| `src/core/sim/__tests__/brawl-combat.test.ts` | sim | contract | ja | `src/core/sim/brawl-combat.ts` |
| `src/core/sim/__tests__/building.test.ts` | sim | contract | ja | `src/core/sim/building.ts` |
| `src/core/sim/__tests__/business-areas.test.ts` | sim | contract | ja | `src/core/sim/business-areas.ts` |
| `src/core/sim/__tests__/city-construction.test.ts` | sim | contract | ja | `src/core/sim/city-construction.ts` |
| `src/core/sim/__tests__/city-day-closeout.test.ts` | sim | contract | ja | `src/core/sim/city-actions.ts` |
| `src/core/sim/__tests__/city-employment.test.ts` | sim | contract | ja | `src/core/sim/city-employment.ts` |
| `src/core/sim/__tests__/city-encounter-all-residents.test.ts` | sim | contract | ja | `src/core/sim/city-encounter.ts` |
| `src/core/sim/__tests__/city-encounter-loop.test.ts` | sim | contract | ja | `src/core/sim/city-encounter.ts` |
| `src/core/sim/__tests__/city-exterior-walls.test.ts` | sim | contract | ja | `src/core/sim/city-exterior.ts` |
| `src/core/sim/__tests__/city-growth-view.test.ts` | sim | contract | ja | `src/core/sim/city-growth-view.ts` |
| `src/core/sim/__tests__/city-growth.test.ts` | sim | contract | ja | `src/core/sim/city-growth.ts` |
| `src/core/sim/__tests__/city-households.test.ts` | sim | contract | ja | `src/core/sim/city-households.ts` |
| `src/core/sim/__tests__/city-identity.test.ts` | sim | contract | ja | `src/core/sim/city-identity.ts` |
| `src/core/sim/__tests__/city-life-deferred-effects.test.ts` | sim | contract | ja | `src/core/sim/city-life-apply.ts` |
| `src/core/sim/__tests__/city-life-movement.test.ts` | sim | contract | ja | `src/core/sim/city-life-movement.ts` |
| `src/core/sim/__tests__/city-life-override.test.ts` | sim | contract | ja | `src/core/sim/city-life-override.ts` |
| `src/core/sim/__tests__/city-life-schedule-target.test.ts` | sim | contract | ja | `src/core/sim/city-life-targets.ts` |
| `src/core/sim/__tests__/city-life.test.ts` | sim | contract | ja | `src/core/sim/city-life.ts` |
| `src/core/sim/__tests__/city-loop-walkthrough.test.ts` | sim | contract | ja | `src/core/sim/city.ts` |
| `src/core/sim/__tests__/city-network.test.ts` | sim | contract | ja | `src/core/sim/city-network.ts` |
| `src/core/sim/__tests__/city-plots.test.ts` | sim | contract | ja | `src/core/sim/city-plots.ts` |
| `src/core/sim/__tests__/city-population.test.ts` | sim | contract | ja | `src/core/sim/city-npc-roster.ts` |
| `src/core/sim/__tests__/city-props-solid.test.ts` | sim | contract | ja | `src/core/sim/city-exterior.ts` |
| `src/core/sim/__tests__/city-scene-zones.test.ts` | sim | contract | ja | `src/core/sim/city-scene.ts` |
| `src/core/sim/__tests__/club-night.test.ts` | sim | contract | ja | `src/core/sim/club-night.ts` |
| `src/core/sim/__tests__/demand.test.ts` | sim | contract | ja | `src/core/sim/demand.ts` |
| `src/core/sim/__tests__/device-identity.test.ts` | sim | contract | ja | `src/core/sim/device.ts` |
| `src/core/sim/__tests__/dirty-index.test.ts` | sim | contract | ja | `src/core/sim/emotion.ts` |
| `src/core/sim/__tests__/dispute-escalation.test.ts` | sim | contract | ja | `src/core/sim/disputes.ts` |
| `src/core/sim/__tests__/drink-menu.test.ts` | sim | contract | ja | `src/core/sim/drink-menu.ts` |
| `src/core/sim/__tests__/duel.test.ts` | sim | contract | ja | `src/core/sim/duel.ts` |
| `src/core/sim/__tests__/economy-losses.test.ts` | sim | contract | ja | `src/core/sim/economics.ts` |
| `src/core/sim/__tests__/esport-event.test.ts` | sim | contract | ja | `src/core/sim/esport-event.ts` |
| `src/core/sim/__tests__/esport.test.ts` | sim | contract | ja | `src/core/sim/esport.ts` |
| `src/core/sim/__tests__/expansion.test.ts` | sim | contract | ja | `src/core/sim/expansions.ts` |
| `src/core/sim/__tests__/fight-bet-register.test.ts` | sim | contract | ja | `src/core/sim/fight-bet-register.ts` |
| `src/core/sim/__tests__/fight-bets.test.ts` | sim | contract | ja | `src/core/sim/fight-bets.ts` |
| `src/core/sim/__tests__/fight-career.test.ts` | sim | contract | ja | `src/core/sim/fight-career.ts` |
| `src/core/sim/__tests__/fight-event.test.ts` | sim | contract | ja | `src/core/sim/fight-event.ts` |
| `src/core/sim/__tests__/fight-odds.test.ts` | sim | contract | ja | `src/core/sim/fight-bets.ts` |
| `src/core/sim/__tests__/floor-work.test.ts` | sim | contract | ja | `src/core/sim/floor-work.ts` |
| `src/core/sim/__tests__/foreign-floor-tick.test.ts` | sim | contract | ja | `src/core/sim/foreign-floor-tick.ts` |
| `src/core/sim/__tests__/grid-zones.test.ts` | sim | contract | ja | `src/core/sim/grid-zones.ts` |
| `src/core/sim/__tests__/guest-flow.test.ts` | sim | contract | ja | `src/core/sim/world.ts` |
| `src/core/sim/__tests__/guest-settlement.test.ts` | sim | contract | ja | `src/core/sim/remodel.ts` |
| `src/core/sim/__tests__/guest-voice.test.ts` | sim | contract | ja | `src/core/sim/narrative/guest-voice.ts` |
| `src/core/sim/__tests__/guests-served.test.ts` | sim | contract | ja | `src/core/sim/guest-service.ts` |
| `src/core/sim/__tests__/hybrid-visitor-flows.test.ts` | sim | contract | ja | `src/core/sim/hybrid-flow.ts` |
| `src/core/sim/__tests__/influence.test.ts` | sim | contract | ja | `src/core/sim/influence.ts` |
| `src/core/sim/__tests__/interaction.test.ts` | sim | contract | ja | `src/core/sim/interaction.ts` |
| `src/core/sim/__tests__/interior-layouts.test.ts` | sim | contract | ja | `src/core/sim/interior-layouts.ts` |
| `src/core/sim/__tests__/item-synergy.test.ts` | sim | contract | ja | `src/core/sim/mod-effects.ts` |
| `src/core/sim/__tests__/jackpot-label.test.ts` | sim | contract | ja | `src/core/sim/guest-play.ts` |
| `src/core/sim/__tests__/journal.test.ts` | sim | contract | ja | `src/core/sim/journal.ts` |
| `src/core/sim/__tests__/knowledge-belief.test.ts` | sim | contract | ja | `src/core/sim/city-traits.ts` |
| `src/core/sim/__tests__/knowledge-config.test.ts` | sim | contract | ja | `src/core/sim/narrative/knowledge-config.ts` |
| `src/core/sim/__tests__/knowledge-domain.test.ts` | sim | contract | ja | `src/core/sim/narrative/knowledge.ts` |
| `src/core/sim/__tests__/knowledge-relationships.test.ts` | sim | contract | ja | `src/core/sim/narrative/knowledge.ts` |
| `src/core/sim/__tests__/knowledge.test.ts` | sim | contract | ja | `src/core/sim/narrative/knowledge.ts` |
| `src/core/sim/__tests__/layout-commands.test.ts` | sim | contract | ja | `src/core/sim/layout-commands.ts` |
| `src/core/sim/__tests__/layout-contract.test.ts` | sim | contract | ja | `src/core/sim/layout-derive.ts` |
| `src/core/sim/__tests__/layout-history.test.ts` | sim | contract | ja | `src/core/sim/layout-history.ts` |
| `src/core/sim/__tests__/layout-json.test.ts` | sim | contract | ja | `src/core/sim/layout-json.ts` |
| `src/core/sim/__tests__/ledger-account-split.test.ts` | sim | contract | ja | `src/core/sim/self-exclusion-bet.ts` |
| `src/core/sim/__tests__/living-world-causal-trace.test.ts` | sim | contract | ja | `src/core/sim/tick.ts` |
| `src/core/sim/__tests__/living-world-continuity.test.ts` | sim | contract | ja | `src/core/sim/actor-continuity.ts` |
| `src/core/sim/__tests__/living-world-longturn.test.ts` | sim | contract | ja | `src/core/sim/tick.ts` |
| `src/core/sim/__tests__/living-world-multiseed.test.ts` | sim | contract | ja | `src/core/sim/living-world-multiseed.ts` |
| `src/core/sim/__tests__/living-world-social-economy.test.ts` | sim | contract | ja | `src/core/sim/social-encounter.ts` |
| `src/core/sim/__tests__/living-world-vertical-slice.test.ts` | sim | contract | ja | `src/core/sim/actor-continuity.ts` |
| `src/core/sim/__tests__/logistics.test.ts` | sim | contract | ja | `src/core/sim/deliveries.ts` |
| `src/core/sim/__tests__/look.test.ts` | sim | contract | ja | `src/core/sim/player-look.ts` |
| `src/core/sim/__tests__/machine-hall.test.ts` | sim | contract | ja | `src/core/sim/machine-hall.ts` |
| `src/core/sim/__tests__/main-event-pool.test.ts` | sim | contract | ja | `src/core/sim/narrative/main-event-pool.ts` |
| `src/core/sim/__tests__/mod-guards.test.ts` | sim | contract | ja | `src/core/sim/actions.ts` |
| `src/core/sim/__tests__/mod-resolver.test.ts` | sim | contract | ja | `src/core/sim/offers.ts` |
| `src/core/sim/__tests__/money-truth.test.ts` | sim | contract | ja | `src/core/sim/money.ts` |
| `src/core/sim/__tests__/mugging-cover.test.ts` | sim | contract | ja | `src/core/sim/mugging.ts` |
| `src/core/sim/__tests__/narrative-boundary.test.ts` | sim | contract | ja | `src/core/sim/narrative/boundary.ts` |
| `src/core/sim/__tests__/narrative-chain-runtime.test.ts` | sim | contract | ja | `src/core/sim/narrative/chains/chain-runtime.ts` |
| `src/core/sim/__tests__/narrative-chain-schema.test.ts` | sim | contract | ja | `src/core/sim/narrative/chains/chain-schema.ts` |
| `src/core/sim/__tests__/narrative-choice-contract.test.ts` | sim | contract | ja | `src/core/sim/narrative/choices/contract.ts` |
| `src/core/sim/__tests__/narrative-choice-eligibility.test.ts` | sim | contract | ja | `src/core/sim/narrative/choices/eligibility.ts` |
| `src/core/sim/__tests__/narrative-choice-execution.test.ts` | sim | contract | ja | `src/core/sim/narrative/commands/execute.ts` |
| `src/core/sim/__tests__/narrative-command-allowlist.test.ts` | sim | contract | ja | `src/core/sim/narrative/commands/validate.ts` |
| `src/core/sim/__tests__/narrative-command-dsl.test.ts` | sim | contract | ja | `src/core/sim/narrative/commands/parse-directives.ts` |
| `src/core/sim/__tests__/narrative-conflict-source.test.ts` | sim | contract | ja | `src/core/sim/disputes.ts` |
| `src/core/sim/__tests__/narrative-counter-rival.test.ts` | sim | contract | ja | `src/core/sim/narrative/commands/execute.ts` |
| `src/core/sim/__tests__/narrative-coverage.test.ts` | sim | contract | ja | `src/core/sim/narrative/composer/index.ts` |
| `src/core/sim/__tests__/narrative-demand.test.ts` | sim | contract | ja | `src/core/sim/narrative/demand-events.ts` |
| `src/core/sim/__tests__/narrative-event-expiry.test.ts` | sim | contract | ja | `src/core/sim/narrative/event-scheduler.ts` |
| `src/core/sim/__tests__/narrative-event-schema.test.ts` | sim | contract | ja | `src/core/sim/narrative/event-schema.ts` |
| `src/core/sim/__tests__/narrative-event-templates.test.ts` | sim | contract | ja | `src/core/sim/narrative/scheduler.ts` |
| `src/core/sim/__tests__/narrative-events.test.ts` | sim | contract | ja | `src/core/sim/narrative/scheduler.ts` |
| `src/core/sim/__tests__/narrative-fact-schema.test.ts` | sim | contract | ja | `src/core/sim/narrative/fact-schema.ts` |
| `src/core/sim/__tests__/narrative-facts.test.ts` | sim | contract | ja | `src/core/sim/narrative/facts.ts` |
| `src/core/sim/__tests__/narrative-followup-chain.test.ts` | sim | contract | ja | `src/core/sim/narrative/runtime.ts` |
| `src/core/sim/__tests__/narrative-longrun.test.ts` | sim | statistics | nein, Mechanik | `src/core/sim/tick.ts` |
| `src/core/sim/__tests__/narrative-memory.test.ts` | sim | contract | ja | `src/core/sim/narrative/memory.ts` |
| `src/core/sim/__tests__/narrative-multi-beat.test.ts` | sim | contract | ja | `src/core/sim/narrative/commands/execute.ts` |
| `src/core/sim/__tests__/narrative-relationships.test.ts` | sim | contract | ja | `src/core/sim/narrative/relationships.ts` |
| `src/core/sim/__tests__/narrative-rival-context.test.ts` | sim | contract | ja | `src/core/sim/narrative/rival-context.ts` |
| `src/core/sim/__tests__/narrative-rival-trigger.test.ts` | sim | contract | ja | `src/core/sim/narrative/events/trigger-definitions.ts` |
| `src/core/sim/__tests__/narrative-runtime.test.ts` | sim | contract | ja | `src/core/sim/narrative/runtime.ts` |
| `src/core/sim/__tests__/narrative-staff-source.test.ts` | sim | contract | ja | `src/core/sim/desk-service.ts` |
| `src/core/sim/__tests__/narrative-start-pool.test.ts` | sim | contract | ja | `src/core/sim/narrative/state.ts` |
| `src/core/sim/__tests__/narrative-trigger-schema.test.ts` | sim | contract | ja | `src/core/sim/narrative/trigger-schema.ts` |
| `src/core/sim/__tests__/narrative-trigger-template-contract.test.ts` | sim | contract | ja | `src/core/sim/narrative/events/trigger-definitions.ts` |
| `src/core/sim/__tests__/narrative-triggers.test.ts` | sim | contract | ja | `src/core/sim/narrative/triggers.ts` |
| `src/core/sim/__tests__/narrative-warm-return.test.ts` | sim | contract | ja | `src/core/sim/narrative/events/trigger-definitions.ts` |
| `src/core/sim/__tests__/nav-edges.test.ts` | sim | contract | ja | `src/core/sim/nav-grid.ts` |
| `src/core/sim/__tests__/needs-core.test.ts` | sim | contract | ja | `src/core/sim/needs-core.ts` |
| `src/core/sim/__tests__/npc-schedule.test.ts` | sim | contract | ja | `src/core/sim/npc-schedule.ts` |
| `src/core/sim/__tests__/own-play.test.ts` | sim | contract | ja | `src/core/sim/own-play.ts` |
| `src/core/sim/__tests__/pathfinding.test.ts` | sim | contract | ja | `src/core/sim/pathfinding.ts` |
| `src/core/sim/__tests__/persona-patience.test.ts` | sim | contract | ja | `src/core/sim/traits.ts` |
| `src/core/sim/__tests__/phase-logic-audit-beats.test.ts` | sim | contract | ja | `src/core/sim/narrative/commands/execute.ts` |
| `src/core/sim/__tests__/phase-logic-audit-foundation.test.ts` | economy | contract | ja | `src/core/economy/ledger.ts` |
| `src/core/sim/__tests__/phase-logic-audit-relations.test.ts` | sim | contract | ja | `src/core/sim/narrative/relationships.ts` |
| `src/core/sim/__tests__/player-career.test.ts` | sim | contract | ja | `src/core/sim/player-career.ts` |
| `src/core/sim/__tests__/player-cash.test.ts` | sim | contract | ja | `src/core/sim/self-exclusion-bet.ts` |
| `src/core/sim/__tests__/player-history.test.ts` | sim | contract | ja | `src/core/sim/player-history.ts` |
| `src/core/sim/__tests__/player-jobs.test.ts` | sim | contract | ja | `src/core/sim/player-jobs.ts` |
| `src/core/sim/__tests__/player-needs.test.ts` | sim | contract | ja | `src/core/sim/player-needs.ts` |
| `src/core/sim/__tests__/player-rpg.test.ts` | sim | contract | ja | `src/core/sim/player-rpg.ts` |
| `src/core/sim/__tests__/player-speed.test.ts` | sim | contract | ja | `src/core/sim/tick.ts` |
| `src/core/sim/__tests__/player-wage-attendance.test.ts` | sim | contract | ja | `src/core/sim/player-jobs.ts` |
| `src/core/sim/__tests__/progression-city.test.ts` | sim | contract | ja | `src/core/sim/city.ts` |
| `src/core/sim/__tests__/progression.test.ts` | sim | contract | ja | `src/core/sim/progression.ts` |
| `src/core/sim/__tests__/property-world.test.ts` | sim | contract | ja | `src/core/sim/property.ts` |
| `src/core/sim/__tests__/property.test.ts` | sim | contract | ja | `src/core/sim/property.ts` |
| `src/core/sim/__tests__/renovation.test.ts` | sim | contract | ja | `src/core/sim/renovation.ts` |
| `src/core/sim/__tests__/reputation-slot-use.test.ts` | sim | contract | ja | `src/core/sim/guest-play.ts` |
| `src/core/sim/__tests__/reputation.test.ts` | sim | contract | ja | `src/core/sim/spawn.ts` |
| `src/core/sim/__tests__/rival-ai.test.ts` | sim | contract | ja | `src/core/sim/rival-ai/policy.ts` |
| `src/core/sim/__tests__/rivals.test.ts` | sim | contract | ja | `src/core/sim/rivals.ts` |
| `src/core/sim/__tests__/room-plan.test.ts` | sim | contract | ja | `src/core/sim/room-plan.ts` |
| `src/core/sim/__tests__/room-transition.test.ts` | sim | contract | ja | `src/core/sim/room-transition.ts` |
| `src/core/sim/__tests__/shot-seed.test.ts` | store | integration | ja | `src/store/save.ts` |
| `src/core/sim/__tests__/smartphone-views.test.ts` | sim | contract | ja | `src/core/sim/smartphone-views.ts` |
| `src/core/sim/__tests__/soak.test.ts` | sim | statistics | nein, Mechanik | `src/core/sim/tick.ts` |
| `src/core/sim/__tests__/spawn-demand.test.ts` | sim | contract | ja | `src/core/sim/spawn.ts` |
| `src/core/sim/__tests__/staff-qualification.test.ts` | sim | contract | ja | `src/core/sim/staff-qualification.ts` |
| `src/core/sim/__tests__/staff-status.test.ts` | sim | contract | ja | `src/core/sim/staff-queries.ts` |
| `src/core/sim/__tests__/treat-influence.test.ts` | sim | contract | ja | `src/core/sim/player.ts` |
| `src/core/sim/__tests__/trigger-dialog.test.ts` | sim | contract | ja | `src/core/sim/narrative/commands/execute.ts` |
| `src/core/sim/__tests__/tx-reasons.test.ts` | sim | contract | ja | `src/core/sim/tx-reasons.ts` |
| `src/core/sim/__tests__/tycoon-needs.test.ts` | sim | contract | ja | `src/core/sim/needs.ts` |
| `src/core/sim/__tests__/tycoon-ops.test.ts` | sim | contract | ja | `src/core/sim/deliveries.ts` |
| `src/core/sim/__tests__/upkeep-costs.test.ts` | sim | contract | ja | `src/core/sim/upkeep.ts` |
| `src/core/sim/__tests__/venue-event.test.ts` | sim | contract | ja | `src/core/sim/venue-event.ts` |
| `src/core/sim/__tests__/visitor-disposition.test.ts` | sim | contract | ja | `src/core/sim/narrative/disposition.ts` |
| `src/core/sim/__tests__/visitors.test.ts` | sim | contract | ja | `src/core/sim/visitors.ts` |
| `src/core/sim/__tests__/world.test.ts` | sim | contract | ja | `src/core/sim/guests.ts` |
| `src/core/sim/narrative/__tests__/beat-resolver.test.ts` | sim | contract | ja | `src/core/sim/narrative/choices/resolver.ts` |
| `src/core/sim/narrative/__tests__/composition-context.test.ts` | sim | contract | ja | `src/core/sim/narrative/composition-context.ts` |
| `src/core/sim/narrative/__tests__/dialogue.test.ts` | sim | contract | ja | `src/core/sim/narrative/dialogue/select.ts` |
| `src/core/sim/narrative/__tests__/narrative-view.test.ts` | sim | contract | ja | `src/core/sim/narrative/view.ts` |
| `src/core/sim/narrative/__tests__/slot-discharge-fact.test.ts` | sim | contract | ja | `src/core/sim/narrative/facts.ts` |
| `src/core/sim/narrative/composer/__tests__/narrative-composer-errors.test.ts` | sim | contract | ja | `src/core/sim/narrative/composer/index.ts` |
| `src/core/sim/narrative/composer/__tests__/narrative-composer.test.ts` | sim | contract | ja | `src/core/sim/narrative/composer/index.ts` |
| `src/core/sim/narrative/events/definitions/__tests__/city-event-pool.test.ts` | sim | contract | ja | `src/core/sim/narrative/events/definitions/city-encounter.ts` |
| `src/render/__tests__/actor-silhouette.test.ts` | render | integration | ja | `src/render/actor-silhouette.ts` |
| `src/render/__tests__/ambient-late-texture.test.ts` | render | integration | ja | `src/render/ambient-layer.ts` |
| `src/render/__tests__/ambient-plan.test.ts` | render | integration | ja | `src/render/ambient-plan.ts` |
| `src/render/__tests__/atlas.test.ts` | render | integration | ja | `src/render/assets/atlas.ts` |
| `src/render/__tests__/city-door-click.test.ts` | render | integration | ja | `src/render/floor-hit.ts` |
| `src/render/__tests__/city-exterior.test.ts` | render | integration | ja | `src/render/city-exterior-layer.ts` |
| `src/render/__tests__/city-growth-plan.test.ts` | render | integration | ja | `src/render/city-plan.ts` |
| `src/render/__tests__/city-shadow-late-texture.test.ts` | render | integration | ja | `src/render/city-exterior-layer.ts` |
| `src/render/__tests__/decor-roles.test.ts` | render | integration | ja | `src/render/decor-roles.ts` |
| `src/render/__tests__/depth.test.ts` | render | integration | ja | `src/render/depth.ts` |
| `src/render/__tests__/floor-actions.test.ts` | render | integration | ja | `src/render/floor-actions.ts` |
| `src/render/__tests__/floor-anchor.test.ts` | render | integration | ja | `src/render/floor-input.ts` |
| `src/render/__tests__/floor-cache.test.ts` | render | integration | ja | `src/render/floor-math.ts` |
| `src/render/__tests__/floor-camera-bounds.test.ts` | render | integration | ja | `src/render/floor-camera.ts` |
| `src/render/__tests__/floor-camera.test.ts` | render | integration | ja | `src/render/floor-camera.ts` |
| `src/render/__tests__/floor-hit.test.ts` | render | integration | ja | `src/render/floor-hit.ts` |
| `src/render/__tests__/floor-input.test.ts` | render | integration | ja | `src/render/floor-input.ts` |
| `src/render/__tests__/floor-layout.test.ts` | render | integration | ja | `src/render/floor-material.ts` |
| `src/render/__tests__/guest-sprite.test.ts` | render | integration | ja | `src/render/guest-paint.ts` |
| `src/render/__tests__/light-pool.test.ts` | render | integration | ja | `src/render/light-pool.ts` |
| `src/render/__tests__/locomotion.test.ts` | render | integration | ja | `src/render/locomotion.ts` |
| `src/render/__tests__/motion-preference.test.ts` | render | integration | ja | `src/render/motion-preference.ts` |
| `src/render/__tests__/perf-governor.test.ts` | render | integration | ja | `src/render/perf-governor.ts` |
| `src/render/__tests__/plinko-board-geometry.test.ts` | render | integration | ja | `src/render/games/plinko-board-geometry.ts` |
| `src/render/__tests__/reaction-feedback.test.ts` | render | integration | ja | `src/render/reaction-feedback.ts` |
| `src/render/__tests__/rig-combat.test.ts` | render | integration | ja | `src/render/rig-pose.ts` |
| `src/render/__tests__/rig.test.ts` | render | integration | ja | `src/render/rig-pose.ts` |
| `src/render/__tests__/room-chunk-clip.test.ts` | render | integration | ja | `src/render/room-art.ts` |
| `src/render/__tests__/routes-key.test.ts` | render | integration | ja | `src/render/floor-route.ts` |
| `src/render/__tests__/slot-layout.test.ts` | render | integration | ja | `src/render/games/slot-layout.ts` |
| `src/render/__tests__/sound-fx.test.ts` | render | integration | ja | `src/render/sound-fx.ts` |
| `src/render/__tests__/staff-actor-state.test.ts` | render | integration | ja | `src/render/floor-props.ts` |
| `src/render/__tests__/view-layers.test.ts` | render | integration | ja | `src/render/view-layers.ts` |
| `src/render/assets/__tests__/asset-semantics.test.ts` | render | integration | ja | `src/render/assets/asset-semantics.json` |
| `src/render/assets/__tests__/textures-preload.test.ts` | render | integration | ja | `src/render/assets/textures.ts` |
| `src/render/city/__tests__/city-assets.test.ts` | render | integration | ja | `src/render/city/city-assets.ts` |
| `src/render/depth-perf.bench.ts` | render | performance | nein, Mechanik | `src/render/depth.ts` |
| `src/render/floor-perf.bench.ts` | render | performance | nein, Mechanik | `src/render/floor-math.ts` |
| `src/render/rig.bench.ts` | render | performance | nein, Mechanik | `src/render/rig-pose.ts` |
| `src/render/visual/__tests__/scene-frame.test.ts` | render | integration | ja | `src/render/visual/scene-frame.ts` |
| `src/store/__tests__/card-payout.test.ts` | store | integration | ja | `src/store/foreign-play.ts` |
| `src/store/__tests__/city-actors.test.ts` | store | integration | ja | `src/store/snapshot.ts` |
| `src/store/__tests__/city-door-walk.test.ts` | store | integration | ja | `src/store/scene-commands.ts` |
| `src/store/__tests__/city-exterior-view.test.ts` | store | integration | ja | `src/store/city-exterior-view.ts` |
| `src/store/__tests__/city-growth-view.test.ts` | store | integration | ja | `src/store/snapshot.ts` |
| `src/store/__tests__/determinism.test.ts` | store | integration | ja | `src/store/transfer.ts` |
| `src/store/__tests__/exclusion-command.test.ts` | store | integration | ja | `src/store/game-commands.ts` |
| `src/store/__tests__/first-evening.test.ts` | store | integration | ja | `src/store/new-game.ts` |
| `src/store/__tests__/foreign-walkable.test.ts` | store | integration | ja | `src/store/foreign-floor-commands.ts` |
| `src/store/__tests__/house-debt.test.ts` | store | integration | ja | `src/store/snapshot.ts` |
| `src/store/__tests__/ledger-tick-balance.test.ts` | store | integration | ja | `src/store/narrative-clock.ts` |
| `src/store/__tests__/loaded-city-population.test.ts` | store | integration | ja | `src/store/save.ts` |
| `src/store/__tests__/narrative-commands.test.ts` | store | integration | ja | `src/store/narrative-commands.ts` |
| `src/store/__tests__/narrative-rival-source.test.ts` | store | integration | ja | `src/store/foreign-play.ts` |
| `src/store/__tests__/narrative-save.test.ts` | store | integration | ja | `src/store/save.ts` |
| `src/store/__tests__/new-game.test.ts` | store | integration | ja | `src/store/new-game.ts` |
| `src/store/__tests__/onboarding-save.test.ts` | store | integration | ja | `src/store/save.ts` |
| `src/store/__tests__/own-door-to-city.test.ts` | store | integration | ja | `src/store/scene-commands.ts` |
| `src/store/__tests__/own-play.test.ts` | store | integration | ja | `src/store/own-play.ts` |
| `src/store/__tests__/prng-persistence.test.ts` | store | integration | ja | `src/store/save.ts` |
| `src/store/__tests__/property-command.test.ts` | store | integration | ja | `src/store/city-commands.ts` |
| `src/store/__tests__/rival-play-commands.test.ts` | store | integration | ja | `src/store/rival-play-commands.ts` |
| `src/store/__tests__/save-device.test.ts` | store | integration | ja | `src/store/migrate.ts` |
| `src/store/__tests__/save-layout.test.ts` | store | integration | ja | `src/store/save.ts` |
| `src/store/__tests__/save-migration.test.ts` | store | integration | ja | `src/store/save.ts` |
| `src/store/__tests__/save-reels.test.ts` | store | integration | ja | `src/store/migrate.ts` |
| `src/store/__tests__/save-rivals.test.ts` | store | integration | ja | `src/store/migrate.ts` |
| `src/store/__tests__/save-roundtrip.test.ts` | store | integration | ja | `src/store/save.ts` |
| `src/store/__tests__/save-staff.test.ts` | store | integration | ja | `src/store/migrate.ts` |
| `src/store/__tests__/save-v7.test.ts` | store | integration | ja | `src/store/save.ts` |
| `src/store/__tests__/save-wage-field.test.ts` | store | integration | ja | `src/store/migrate.ts` |
| `src/store/__tests__/snapshot-purity.test.ts` | store | integration | ja | `src/store/snapshot.ts` |
| `src/store/__tests__/staff-view.test.ts` | store | integration | ja | `src/store/staff-view.ts` |
| `src/store/__tests__/street-population.test.ts` | store | integration | ja | `src/store/scene-commands.ts` |
| `src/store/__tests__/transfer.test.ts` | store | integration | ja | `src/store/transfer.ts` |
| `src/store/memory.bench.ts` | store | performance | nein, Mechanik | `src/store/save.ts` |
| `src/store/narrative.bench.ts` | sim | performance | nein, Mechanik | `src/core/sim/narrative/runtime.ts` |
| `src/store/perf-hot-paths.bench.ts` | store | performance | nein, Mechanik | `src/store/snapshot.ts` |
| `src/ui/__tests__/action-queue-panel.test.tsx` | ui | integration | ja | `src/ui/action-queue-panel.tsx` |
| `src/ui/__tests__/anchor-layout.test.ts` | ui | integration | ja | `src/ui/anchor-layout.ts` |
| `src/ui/__tests__/card-tables.test.tsx` | ui | integration | ja | `src/ui/games/blackjack-popup.tsx` |
| `src/ui/__tests__/casino-window-header.test.tsx` | ui | integration | ja | `src/ui/casino-window-header.tsx` |
| `src/ui/__tests__/city-popup.test.tsx` | ui | integration | ja | `src/ui/city-popup.tsx` |
| `src/ui/__tests__/dialog-request.test.ts` | ui | integration | ja | `src/ui/dialog-request.ts` |
| `src/ui/__tests__/dialogue-ui.test.tsx` | ui | integration | ja | `src/ui/dialogue-popup.tsx` |
| `src/ui/__tests__/editor-gate.test.ts` | ui | integration | ja | `src/ui/editor-gate.ts` |
| `src/ui/__tests__/editor-tools.test.ts` | ui | integration | ja | `src/ui/editor-tools.ts` |
| `src/ui/__tests__/floor-keyboard.test.ts` | ui | integration | ja | `src/ui/floor-keyboard.ts` |
| `src/ui/__tests__/floor-scenes.test.ts` | ui | integration | ja | `src/ui/floor-scenes.ts` |
| `src/ui/__tests__/goal.test.ts` | ui | integration | ja | `src/ui/goal.ts` |
| `src/ui/__tests__/guest-profile.test.tsx` | ui | integration | ja | `src/ui/guest-popup.tsx` |
| `src/ui/__tests__/hud-labels.test.ts` | ui | integration | ja | `src/ui/hud-labels.ts` |
| `src/ui/__tests__/hud-money.test.tsx` | ui | integration | ja | `src/ui/hud-money.tsx` |
| `src/ui/__tests__/input-parity.test.tsx` | ui | integration | ja | `src/ui/use-stage-keys.ts` |
| `src/ui/__tests__/machine-play.test.tsx` | ui | integration | ja | `src/ui/machine-popup.tsx` |
| `src/ui/__tests__/narrative-ui.test.tsx` | ui | integration | ja | `src/ui/narrative-popup.tsx` |
| `src/ui/__tests__/onboarding-start-steps.test.tsx` | ui | integration | ja | `src/ui/onboarding-panel.tsx` |
| `src/ui/__tests__/perspective-switch.test.tsx` | ui | integration | ja | `src/ui/perspective-switch.tsx` |
| `src/ui/__tests__/phase34-acceptance.test.tsx` | ui | integration | ja | `src/ui/workshop-parts.tsx` |
| `src/ui/__tests__/placement-fit.test.ts` | ui | integration | ja | `src/ui/app-model.ts` |
| `src/ui/__tests__/player-dashboard.test.tsx` | ui | integration | ja | `src/ui/look-popup.tsx` |
| `src/ui/__tests__/self-exclusion-panel.test.tsx` | ui | integration | ja | `src/ui/self-exclusion-panel.tsx` |
| `src/ui/__tests__/small-screen-acceptance.test.tsx` | other | contract | ja | `src/App.tsx` |
| `src/ui/__tests__/small-screen-dock.test.tsx` | ui | integration | ja | `src/ui/dock.tsx` |
| `src/ui/__tests__/small-screen-layout.test.ts` | other | contract | ja | `src/styles/app.css` |
| `src/ui/__tests__/small-screen-panels.test.tsx` | ui | integration | ja | `src/ui/popup-router.tsx` |
| `src/ui/__tests__/smartphone-apps.test.tsx` | ui | integration | ja | `src/ui/smartphone.tsx` |
| `src/ui/__tests__/ui.test.tsx` | ui | integration | ja | `src/ui/popup-shell.tsx` |
| `src/ui/__tests__/venue-history.test.tsx` | ui | integration | ja | `src/ui/venue-history.tsx` |
| `src/ui/__tests__/world-first-ui.test.tsx` | ui | integration | ja | `src/ui/guest-context-panel.tsx` |
<!-- TEST_CATALOG_END -->

## 12. Dependencies & Audit

21 direkte Dependencies (3 Runtime: pixi.js, react, react-dom). `docs/DEPENDENCY-AUDIT.md` (Stand 31.10.2026): Umsetzungsstand **stimmt mit `package.json` überein** — engines/packageManager gesetzt, Dev-Server-Default `localhost` + `RBD_DEV_HOST`-Opt-in (in `vite.config.ts` bestätigt), Vite 8.3.5/plugin-react 6.1.2, TypeScript 6.0.3, `projectService` entfernt. Overrides: `glob ^14.0.3`, `minimatch ^11.0.1` (sicherheitsmotiviert).

## 13. Assets

Der Asset-Anhang in `docs/ARCHITECTURE.md`: vollständiges Paket (539 PNG + 2 WebP-Atlasseiten + 7 JSON + 6 OGG-Tonspuren, zusammen 554 Dateien) unter `public/assets/casino/`, Manifest `src/render/assets/manifest.json`; **Lizenz vom Nutzer bestätigt, Nachweis im Repo offen (`docs/ROADMAP.md`)**. WAV-Master außerhalb des Repos. `pnpm run verify:assets` prüft Manifest ↔ Dateien ↔ `SLOT_SYMBOLS`.

## 14. Befunde & Diskrepanzen (laufend gepflegt)

| # | Schwere | Befund | Beleg |
| --- | --- | --- | --- |
| 1 | **hoch** | **gelöst**: `world-store.ts` `spinTest()` ruft `spinTestCmd` nur **einmal** auf (`game-commands.ts:spinTestCmd` → `testSpin` einmal). Sandbox-Seed wird nicht doppelt fortgeschrieben. Notice und Resultat stammen vom selben Lauf. | `src/store/world-store.ts` (Methode `spinTest`); `game-commands.ts` |
| 2 | mittel | **aufgelöst**: Code bucht 150 VC Startkapital (`money.ts`: `STARTING_CAPITAL = fromVC(150)`, `openHouse()`), Store-Notice nennt 150 VC, README behauptet „Du startest mit 0,00 VC". Das Portemonnaie startet tatsächlich bei 0 — die README-Aussage ist ohne diese Unterscheidung falsch bzw. irreführend. | `sim/money.ts`; `world-store.ts`; README |
| 3 | mittel | Gate `assets` meldet bei Fehler **ERR-4016** (definiert als „langer Nachweis in CI nicht gelaufen/rot") — mögliche Fehlzuordnung; kein eigener Assets-Code im Register. | `lib/pipeline-plan.mjs`; `error-codes.ts` |
| 4 | niedrig | `docs/ARCHITECTURE.md`: ERR-4013/ERR-4014-Zeile verschmolzen (`… pruefen. \|\| ERR-4014 …`) — kaputte Markdown-Tabellenzeile; zusätzlich CRLF (`.gitattributes` normalisiert nur ARCHITECTURE.md). | `docs/ARCHITECTURE.md` |
| 5 | info | **aufgelöst (T23)**: ARCHITECTURE, PRODUCT, AGENTS und dieses Inventar nennen dieselbe Zählung — quick = 10 Gates, full/release = 12 (plus `audit`, `build`); das `assets`-Gate steht in allen drei Doku-Stellen. | `scripts/lib/pipeline-plan.mjs` |
| 6 | niedrig | `opencode.json` enthält hartkodierten Windows-Pfad `C:\Users\vanno\rigged-by-design` — nicht portabel. | `opencode.json` |
| 7 | niedrig | Dependency-Audit nennt 373→311 Lockfile-Einträge; Ist: 323 `node_modules/`-Einträge — Drift, Bericht nicht nachgezogen. | `package-lock.json` |
| 8 | info | Kein einziger TODO/FIXME/HACK/XXX in `src/` und `scripts/` (0 Treffer). | grep |
| 9 | info | Migration heilt verwaiste Referenzen; Guard-Agent wird nachgetragen statt still zu verschwinden. | `migrate.ts`, `migrate-staff.ts` |
| 10 | info | Release-Kette konsistent: verify:all → Tag → APK (`skip_verify`), Artefakt-Verifikation per `gh release view`. | Workflows |
| 11 | info | `foreignRound` rollt PRNG bei Fehlern zurück und bucht erst nach erfolgreicher Rechnung — Geld-Pfade sind damit fehlerresistent belegt. | `sim/actions.ts` |
| 12 | info | Fehlerregister vollständig synchron: `error-codes.ts` und der Fehlerregister-Anhang in `docs/ARCHITECTURE.md` enthalten exakt dieselben 23 Codes. | Abgleich T3 |
| 13 | info | Spiele-Modularität bestätigt: 8 Engines unter `core/games/engines` + `round.ts` als Dispatcher; UI-Popups (10) und Pixi-Bühnen (22) sind reine Darstellungsschichten ohne eigenen Spielzustand (Header aller 48 ui- und 22 render/games-Dateien gelesen). | Extraktion T3 |
| 14 | info | `slot-transparency.ts` (`recordSlotSpin`, `slotDrift`) und `slot-telemetry.tsx` liefern bewusste Verlust-Transparenz — dokumentiertes Produktversprechen im Code belegt. | Export-Matrix T3 |
| 15 | info | Journal: Puffer 240 + dauerhaftes Archiv 2.000 (`journal.ts`, vollständig gelesen); Archiv überlebt den Puffer, steht im Save und ist filterbar (`archiveQuery`). Stimmt mit ARCHITECTURE.md überein. | `sim/journal.ts` |
| 16 | info | Erster Gast nach 12 Ticks ≈ 6,2 s bei 520 ms/Tick (`demand.ts` `FIRST_ARRIVAL_TICK`) — bestätigt die README-Aussage „sechs Sekunden“; Nachfrageplanung ohne jede Gästeobergrenze belegt. | `sim/demand.ts` |
| 17 | info | `expansions.ts`: Ausbau bucht **vor** dem Wachsen; Möbel, IDs, Personal, Kisten und Ledger-Konten bleiben erhalten, Fleck-Indizes wandern mit. Konsistent zur remodel-Regel. | `sim/expansions.ts` |
| 18 | ~~beob~~ | **aufgelöst (T5)**: `movement-queue.ts` existiert nicht mehr im Baum (bereits entfernt); Kassenschlange nutzt `queue-spots.ts`. Kein produktiv-totes Modul mehr. | `sim/movement-queue.ts` (entfernt) |
| 19 | beob | `economics.ts` hält einen modulweiten Cursor („WeakMap<Ledger>“) für laufende Kennzahlen — mutable Nebenwirtschaft außerhalb des Stores, aber pro Ledger gekapselt und ausschließlich lesend über `entriesSince`. | `sim/economics.ts` |
| 20 | info | Modell-Konsistenz bestätigt: `desk-service.ts` (6→2 Ticks ohne/mit Kassierer), `deliveries.ts` (Bar-Kapazität 12+8·Level, WC-Verstopfung ab 3+2·Level), `offers.ts` (6 Mods, `EXTRA_REEL` nur für Slots) — Preise/Wirkungen an einer Stelle. | mehrere Sim-Dateien |
| 21 | mittel | `core/sim/movement-queue.ts` hat außerhalb seiner eigenen Testdatei **keinen Importeur** (Grep-Beweis T5/T6). Der Dead-Export-Gate zählt Testdateien als Verbraucher (`consumers = sources + scripts`), also überlebt ein produktions-totes Modul. **gelöst**: entfernt (siehe Befund 18). Kein produktiv-totes Modul mehr. | `movement-queue.ts` (entfernt) |
| 22 | info | Einziger `Math.random()` in ganz `src/render`: `sound-fx.ts:151` erzeugt Weißrausch-Frames für einen Sound-Effekt — bewusst nondeterministisch, kein Spiel-/Geldpfad (Determinismus-Gate prüft core+store). | `src/render/sound-fx.ts` |
| 23 | niedrig | Zweiter Windows-Absolutpfad im Repo: `encode-audio.mjs` nutzt `C:/Users/vanno/Downloads/casino_asset_sounds_prealpha/sounds` als **Fallback**, überschreibbar via `RBD_AUDIO_SOURCE`. Gleiche Klasse wie Befund 6, aber dokumentiert und umgehbar. | `scripts/encode-audio.mjs` |
| 24 | info | Anti-Atributions-Gate vorhanden: `verify-commit-msg.mjs` + `sanitize-commit.mjs` blockieren/entfernen `Co-authored-by`, `Generated with` und Tool-Namen (Freebuff, Codebuff, Claude, Anthropic, OpenAI, Cursor); `turn-push.mjs` sanitized vor dem Push und `autofix-0911.mjs` prüft `.git/COMMIT_EDITMSG`. Der Workflow ist Anti-Attribution by design. | `scripts/` |
| 25 | info | Gate-Cache ist profilisoliert: `gate-cache.mjs` hashet `git ls-files -z -co` (tracked + untracked, ignore-respektierend) + `process.version`; der Cache-Key pro Gate enthält dessen Env — ein grüner quick-Lauf kann nie den release-Vollauslauf ersetzen. | `scripts/lib/gate-cache.mjs` |
| 26 | info | Prozess-Absicherung: `process-sweep.mjs` beendet nur PID **plus Startzeit**-identifizierte Prozesse (Linux /proc-Feld 22, Windows PowerShell, ps-Fallback); läuft noch eine fremde Pipeline, wird die Registry passiv statt zu räumen. Nie nach Namensmuster. | `scripts/lib/process-sweep.mjs` |
| 27 | info | Test-Auswahl mit Recall-Sicherung: `affected-tests.mjs` (rückwärtsgerichteter Importgraph + `@test-target` + Subsystem-Fallback; Konfig-Änderung → alle Tests); `statistics`/`performance` werden an CI delegiert (`ci-long-checks.mjs`: gh bevorzugt, REST-Fallback, Artifact-Download). | `scripts/lib/` |
| 28 | info | Dependency-Matrix ist Fail-Closed: `sync-dependency-matrix.mjs` verlangt pro Package eine Architektur-Begründung (ERR-4007) **und** reale Nutzung aus dem Modulgraphen; schreibt die Live-Matrix in `docs/ARCHITECTURE.md`, `--check` meldet Verfall. | `scripts/sync-dependency-matrix.mjs` |
| 29 | info | Versions-Konsistenz: `version-bump.mjs` bumppt package.json **und** beide Lockfile-Stellen (Root + `packages[""]`), sonst bricht `pnpm install --frozen-lockfile` in CI an der Differenz; `turn-push.mjs` überspringt den Bump bei bereits gebumptem Baum. | `scripts/version-bump.mjs`, `scripts/turn-push.mjs` |
| 30 | info | Release-Eskalationsleiter: `release-escalation.mjs` WORKFLOW_TOKEN → RELEASE_TOKEN → BLOCKED mit Klartext-Anleitung; transient/unknown → bis zu 3 Wiederholungen; „already exists“ → DONE. | `scripts/lib/release-escalation.mjs` |
| 31 | info | Android-Vertragsprüfungen: `prepare-android.mjs` prüft `dist/index.html`, `capacitor.config.json` (webDir=dist) und gepinnte @capacitor-Pakete vor gradle; Debug installierbar, Release bewusst unsigned (Signieren ist eigener Schritt). | `scripts/prepare-android.mjs` |
| 32 | info | `balance-run.mjs` validiert Tage (1–400) und Seed (SafeInteger), schreibt den Bericht nach `artifacts/` (gitignoriert) und verlangt dessen Existenz (sonst ERR-2001) — der Messlauf kann nicht still ohne Bericht bestehen. `src/test/random-seed.ts` zieht Seeds aus `node:crypto` ohne Env/CLI/Datei-Override. | `scripts/balance-run.mjs`, `src/test/` |
| 33 | **hoch** | **gelöst**: Alle drei UI-Dateien nutzen bereits `barCapacityForLevel` aus `sim/deliveries.ts` (`12 + 8·max(1, level)`). Keine Hartkodierung mehr. | `src/ui/hud.tsx`, `src/ui/machine-popup.tsx`, `src/ui/diagnostics-popup.tsx` |
| 34 | niedrig | **gelöst**: `table-launcher.tsx:56` verwendet bereits das korrekte Middle-Dot-Zeichen `·` (kein Mojibake `Â·` mehr). Einziger Treffer des Mojibake-Scans war bereits korrigiert. | `src/ui/table-launcher.tsx` |
| 35 | info | Tick-Dauer 520 ms ist an vier Stellen kodiert: Kern-Tick, `floor-view.ts` (`STEP_MS = 520`), `guest-popup.tsx` und `self-exclusion-panel.tsx` (`× 0.52` Sekunden-Umrechnung). Aktuell konsistent, aber eine gemeinsame Konstante wäre robuster. | mehrere Dateien |
| 36 | info | Spieltext-Typo: `shell-canvas.ts` schreibt „DERGEBER MISCHT“ (Leerzeichen fehlt) in der Shuffle-Phase. Daneben stilistische ASCII-Umschriften in Untertiteln („fuenf“, „Huetchen“, „Wuerfel“, „Erhoehungen“) neben echten Umlauten — Stil-Inkonsistenz, kein Logikfehler. | `src/render/games/shell-canvas.ts`, ui-Untertitel |
| 37 | **hoch** | **gelöst (auf main bestätigt)**: `applyAction` nutzt `streetCommitted` statt kumuliertem `committed` für den offenen Einsatz pro Strasse; Roulette-Farbkorrektur (31 ist schwarz). Beide Geldwege per Test gesichert. | `src/core/games/poker-table.ts`, `roulette-table.test.ts` |
| 38 | mittel | **Versions-Bump fehlte beim Pull-Batch**: Der Push `708d31c → 492ac3a` (583 Dateien, +3.119/−163) änderte `package.json` nur um zwei Skript-Zeilen (`assets:manifest`, `assets:audio`); die Version blieb **0.3.64**. `turn:finish` bumppt vor `verify` die Patch-Version — der Push scheint ohne diesen Pfad entstanden zu sein; ob `verify:quick` lief, ist aus dem Baum nicht belegbar (CI-Status liegt extern). | `package.json` |
| 39 | mittel | **verify-assets: Duplikat-Prüfung entfernt**: Die Regel „Pfad mehrfach vergeben → Fail“ ist im Manifest-v3-Umbau entfallen (`referenced.add(file)` ohne Prüfung); dieselbe Datei kann jetzt mehreren IDs zugeordnet sein, ohne dass das Gate meckert. Möglicherweise bewusst (Katalog und Engine teilen Dateien), aber eine Registry-Lockerung gegenüber der alten Version. | `scripts/verify-assets.mjs` |
| 40 | niedrig | **Slot-Symbol-Fallback-Keys decken sich nicht mit dem Manifest**: `slot-symbols-extra.ts` definiert gezeichnete Rückfälle unter `GRAPE/SEVEN/BELL/CLOVER/CROWN/STAR/DIAMOND/HORSESHOE/PLUM/WILD`; der Manifest-Generator erzeugt aus den Dateinamen dagegen `GRAPE_CLUSTER/LUCKY_SEVEN/GOLD_BELL/FOUR_LEAF_CLOVER/ROYAL_CROWN/GOLDEN_STAR/BLUE_DIAMOND/LUCKY_HORSESHOE/PURPLE_PLUM/WILD_CROWN`. Aktuell ohne Effekt (die Engine zieht nur `SLOT_SYMBOLS`, deren gezeichnete Rückfälle in `slot-symbols-art.ts` liegen); sobald aber ein EXTRA-Symbol auf die Walze landet, greift stillschweigend das Buch-Rückfallbild. | `src/render/games/slot-symbols-extra.ts`, `scripts/build-asset-manifest.mjs` |
| 41 | niedrig | Hartkodierte Paketgröße „PAKET · 539 TEXTUREN“ im Kopf der Asset-Bibliothek, während der Zähler daneben dynamisch rechnet — bei Paketwachstum veraltet die Eyebrow-Zahl. | `src/ui/asset-library-popup.tsx` |
| 42 | info | **aufgelöst (T10)**: Das Wurzel-Duplikat `ANALYSE-BERICHT-CASINO-FLOOR.md` ist gelöscht; es bleibt nur `docs/ANALYSE-BERICHT-CASINO-FLOOR.md`. | `docs/` |
| 43 | info | **Asset-Pipeline jetzt vollständig (Pull-Batch)**: `scripts/build-asset-manifest.mjs` (neu, Manifest **v3**: ~539 Texturen in 8 Kategorien + Frame-Animationen + Emitter + 6 Musiktracks, Fail-Closed gegen fehlende Dateien), `verify-assets.mjs` auf v3 umgestellt, `main.tsx` preloaded ~1,3 MB (Symbole+Maschinen+Deko+Plinko), `music.ts` mit NIGHT/MENU/BACKGROUND, `App.tsx` ordnet Popups Musikstimmungen zu, Asset-Library-Popup (192 Zeilen) mit Animations-/Emitter-Previews. Konsistenz geprüft: alle ENGINE_SYMBOLS-Pfade (book/scarab/ankh/eye-of-horus/urn/rank-*) existieren im Paket. | `scripts/`, `src/render/`, `src/App.tsx` |
| 44 | info | **Asset-Lizenz: vom Nutzer bestätigt, Nachweis im Repo offen.** `docs/ARCHITECTURE.md` (§ Herkunft und Rechte, unverändert geblieben): die beiliegende README nennt **keine Lizenz und keinen Urheber**, „das Paket ist kein freigegebenes Distributionsmaterial“; vor externer Veröffentlichung muss die Herkunft geklärt bleiben. Das Dokument ist dazu jetzt konsistent ehrlich (539 PNG/7 JSON/6 WAV, ~170 MB Quelle, 13,4 MB ausgeliefert). Der Nachweis im Repo steht als offener Punkt in `docs/ROADMAP.md`. | `docs/ARCHITECTURE.md` |
| 45 | info | **Doku-Double, in T23 einsortiert: `docs/EVENT-NARRATIVE-ENGINE-TASKPLAN.md` (1023 Zeilen)** — sequenzieller Plan NAR-00…NAR-17 für eine datengetriebene Narrative Engine: Typed Sim Facts, Charaktergedächtnis, Beziehungen, Event-Scheduler, Event-Command-DSL mit Allowlist, Content-Registry, lokaler deterministischer Textcomposer (kein LLM im Spiel), **Save v10**, Migration der beiden Nachfrageveranstaltungen, autonome Rivalen. Basiert auf Stand `708d31c` (vor dem Pull; kleine Veraltungen z. B. Poker-Profile nicht reflektiert — irrelevant für den Plan). Grundlagen von NAR-00 bis NAR-03 sind vorhanden (Save v9), aber nicht vollstaendig; Ledger-Facts und referenzsichere Retention fehlen weiterhin. | `docs/EVENT-NARRATIVE-ENGINE-TASKPLAN.md` |
| 47 | info | **Eskalations-Leiter global (T10):** `scripts/lib/escalation.mjs` klassifiziert Befunde in `AUTO_FIX → LOCAL_GATE → REMOTE_CI → AGENT → BLOCKED`; `pnpm run escalation:plan` nennt die Stufe. Fail-Closed bleibt für Geld/Ledger/RNG/Save. `release-escalation.mjs` bleibt unangetastet (Push-Token), damit keine zweite Leiter entsteht. | `scripts/lib/escalation.mjs`, `scripts/escalation-plan.mjs` |
| 48 | info | **Doc-Gate + Hooks (T10):** `scripts/lib/doc-sync.mjs` führt zwölf Pflichtdokumente mit Pflichtabschnitten und `rbd-doc`-Marker (Version + UTC); `verify:docs` ist Gate (`ERR-4017`), der Pre-Commit-Hook schreibt ihn. `deps-matrix` und `catalog` sind keine Gates mehr; Matrix, Katalog und Marker entstehen im Hook. Wurzel-Duplikat `ANALYSE-BERICHT-CASINO-FLOOR.md` (identische MD5) gelöscht. | `scripts/lib/doc-sync.mjs`, `.githooks/`, `scripts/lib/pipeline-plan.mjs` |
| 49 | info | **Import/Export-Engine (T10):** `src/core/io/issues.ts` (42), `envelope.ts` (66), `repair.ts` (42), `src/store/transfer.ts` (46), `src/ui/transfer-panel.tsx` (49) — alle unter ihren LOC-Zonen; keine zweite Save-Wahrheit (`toSavedGame`/`replaySave`), Trockenlauf vor Anwendung, Prüfsumme FNV-1a. Panel sitzt im Prüfungs-Popup. | `src/core/io/`, `src/store/transfer.ts`, `src/ui/transfer-panel.tsx` |
| 46 | info | `docs/ARCHITECTURE.md` und `README.md` aktualisiert: README zeigt jetzt Vorher/Nachher-Vergleichsbilder (`docs/screenshots/comparison/`), die Screenshots-README erlaubt dort versionierte Belege (v1/v2) neben dem kanonischen `current/`; `autofix-0911.mjs` räumt `comparison/` bewusst **nicht** mehr (Regel angepasst). Architektur-Matrix zählt die neuen Dateien (build-asset-manifest, plinko-assets, slot-symbols-extra, asset-library-popup) bereits mit. | `README.md`, `docs/screenshots/README.md` |
| 50 | info | **Connector-Eskalation (T11):** `scripts/lift-commit-body.mjs --json` liefert den PR-Plan (`level: AGENT`, `channel: github-connector`, `branch`, `base`, `title`, `bodyFile`, `body`). CI nutzt weiter `gh`; ohne Token bleibt der Lauf grün und der Plan ist die Übergabe. Der Level kommt aus `scripts/lib/escalation.mjs` — keine zweite Leiter. | `scripts/lift-commit-body.mjs`, `AGENTS.md` || 51 | info | **CI-Lauf #110 rot, Ursache Testvertrag (T12):** `pipeline-modes.test.ts` erwartete noch `deps-matrix`; nach dem Gate-Umbau zwei rote Tests (438 grün, 2 rot). Test auf `docs`-Gate und Entfall von `deps-matrix`/`catalog` nachgezogen, Lesende-Vertrag unverändert. Beweis folgt im nächsten `CI Verify`-Lauf. | `src/core/governance/__tests__/pipeline-modes.test.ts` || 52 | info | **Tree-Gate (`ERR-4019`) beim ersten Lauf:** vier Befunde — `eslint.config.mjs` und `opencode.json` fehlten in der Wurzel-Whitelist, `src/index.css` lag neben `main.tsx` statt unter `src/styles/`, `scripts/init-github.sh` war als Bootstrap-Shell nicht erlaubt. Regeln korrigiert, CSS verschoben, Shell erlaubt. Der Umzug brach drei `@import`-Pfade; der CI-Build fand es, Pfade sind jetzt relativ. | `scripts/verify-tree.mjs`, `src/styles/index.css` |
| 51 | info | **CI-Eskalation mit Code (T12):** `level` pro Code in `error-codes.ts`, `escalation.mjs` liest es zuerst; ERR-4023 (Direktpush auf `main` abgelehnt) und ERR-4024 (rotes lokales Gate) neu; PR-Watcher dedupliziert per Fingerprint und zaehlt nach (`findIssue`). Ruleset ungeprueft. | `src/core/governance/error-codes.ts`, `scripts/lib/escalation.mjs`, `scripts/pr-watcher.mjs`, `AGENTS.md`, `docs/ARCHITECTURE.md` |
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
| docs/ (fünf Pflichtdokumente nach T81) | ✅ bis letzte Zeile |
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

## 16. Befunde und Entscheidungen (historisch)

Offene Punkte werden ausschließlich in `docs/ROADMAP.md` unter „Offene Punkte“ geführt. Dieser Abschnitt hält nur erledigte oder historische Entscheidungen fest.

- **Befund 1 (spinTest-Doppelaufruf):** gelöst; `spinTestCmd` ruft `testSpin` nur einmal auf.
- **Befund 2:** erledigt; das README nennt 150 VC Startkapital auf dem Hauskonto und 0 im Portemonnaie.
- **Befund 3/6/7:** ERR-4016-Zuordnung, Windows-Pfad in `opencode.json` und Audit-Drift stehen als offene Punkte in `docs/ROADMAP.md`.
- **Asset-Lizenz:** Die Grundsatzfrage ist geklärt; der Nachweis im Repo steht als offener Punkt in `docs/ROADMAP.md`.
- **Lesedeckung:** §18 ist die maßgebliche Abdeckung; die Verlaufsmatrix in §15 bleibt Historie.
- **Befund 33/34:** gelöst (Bar-Kapazität und Mojibake).

## 16a. Doku-Konsolidierung (2026-11-06)

Die Doku-Konsolidierung hat zwei Wellen. In T75 wurden 18 historische Analyse-, Review-, Plan- und Skill-Dokumente gelöscht, nachdem ihre offenen Punkte in die Pflichtdokumente überführt waren. In T81 folgten die elf verbliebenen Referenzdokumente; ihre Inhalte stehen jetzt in den Pflichtdokumenten. `docs/ROADMAP.md` ist die einzige Stelle für offene Punkte.

### T81: gelöschte Referenzdokumente und Ziel

| Gelöschtes Dokument | Überführt nach | Übernommener Inhalt |
| --- | --- | --- |
| `docs/ART-DIRECTION.md` | `docs/ARCHITECTURE.md` | Bildsprache, Rollen, Lichtregeln, Stufenplan M1–M4 |
| `docs/ASSETS.md` | `docs/ARCHITECTURE.md` | Asset-Pipeline, Rechte, Musik, Audio, Messwerte |
| `docs/ASSET-SEMANTICS.md` | `docs/ARCHITECTURE.md` | Katalogvertrag, Metadaten, Befunde, Ankerregeln |
| `docs/CASINO-PIXEL-ASSET-PACK.md` | `docs/ARCHITECTURE.md` | Quellpaket, Ordner, Pixelmaße |
| `docs/CI-GATES.md` | `docs/ARCHITECTURE.md` | Workflows, Ruleset, Promotion, Release/APK |
| `docs/ERROR_CATALOG.md` | `docs/ARCHITECTURE.md` | Fehlerregister (23 Codes) |
| `docs/GATE-ROOTCAUSE.md` | `docs/ARCHITECTURE.md` | Gate-Fehlerhistorie, ERR-4006-Fall |
| `docs/NARRATIVE-ENGINE.md` | `docs/ARCHITECTURE.md` | Narrativvertrag NAR-00 bis NAR-17, Social-Plugin |
| `docs/PRODUCT.md` | `docs/ROADMAP.md` | Produktvertrag, Vision, MVP-Grenze |
| `docs/TEST-CATALOG.md` | `docs/INVENTORY.md` | generierter Testkatalog (Block unter §11) |
| `docs/ESCALATION.md` | `AGENTS.md` | Eskalationsleiter und Klassifikation |

### T75: zuvor gelöschte historische Berichte

`ANALYSE-BERICHT-CASINO-FLOOR.md`, `ANALYSE-REPORT-1-LOGIK-RACE.md`, `ANALYSE-REPORT-2-SECURITY-EFFIZIENZ.md`, `ANALYSE-REPORT-3-SPIELVERHALTEN-DUPELS-GAPS.md`, `PEER-REVIEW-4bb980f-GESAMTBERICHT.md`, `PLAN-LEAD-MERGE.md`, `PLAN-LEAD-MERGE-KORRIGIERT.md`, `REVIEW-MIGRATIONS-PLAN.md`, `REVIEW-SUB-A-ADVERSARIAL.md`, `REVIEW-SUB-A-RECHECK.md`, `REVIEW-SUB-B-ADVERSARIAL.md`, `SKILL_LEAD_SUB_AGENT_LOOP.md`, `SKILL_PIPELINE_WORKFLOW.md`, `MIGRATION-PLAN-CHARAKTER-STEUERUNG-2EECC42.md`, `EVENT-NARRATIVE-ENGINE-TASKPLAN.md`, `NARRATIVE-ENTSCHEIDUNGEN.md`, `PLAN-OPTIK-VISUELL.md`, `DEPENDENCY-AUDIT.md`.

## 17. Auftrag T9: Governance-, Eskalations- und Transfer-Ausbau (in T10 umgesetzt, hier als Nachweis)

Am **2026-11-01 09:00 UTC** vom Nutzer beauftragt. In diesem Turn wurde **kein Code geändert** — der Auftrag ist hier vollständig festgehalten; alle sieben Punkte sind in T10 umgesetzt (Spalte Status).

| # | Auftrag (Nutzerwortlaut sinngemäß) | Ziel im Repo | Status |
| --- | --- | --- | --- |
| A1 | **Import-/Export-Manager-Engine**, Daten modular geplant, mit **LOC-Cap** | `src/core/io/{issues,envelope,repair}.ts` + `src/store/transfer.ts` + `src/ui/transfer-panel.tsx`; nutzt `toSavedGame`/`replaySave`; je Modul im Engine-/State-/UI-Budget | ✅ umgesetzt (T10) |
| A2 | **Eskalations-Stufen** implementieren, „Falschblocker und automatisch behebbare Fehler durch Eskalation lösen, bevor ein Agent ran muss“ | eine Leiter `AUTO_FIX → LOCAL_GATE → REMOTE_CI → AGENT → BLOCKED` in `scripts/lib/escalation.mjs` + CLI `escalation:plan`; `release-escalation.mjs` bleibt für Push-Token, keine zweite Leiter | ✅ umgesetzt (T10) |
| A3 | **Commit-Bodys nicht fail-closed**: Body wird via GitHub CI in den **PR-Body** gehoben | `.githooks/commit-msg` eskaliert statt zu blockieren; `.github/workflows/pr-escalation.yml` + `scripts/lift-commit-body.mjs` bauen/anlegen den PR-Body | ✅ umgesetzt (T10) |
| A4 | **Doc-synchronisiertes Gate** + **Strukturvorgaben für Docs** + sauberer Tree | `scripts/lib/doc-sync.mjs` (Manifest, Marker, Pflichtabschnitte), Gate `verify:docs` (`ERR-4017`), Wurzel-Whitelist; Wurzel-Duplikat gelöscht | ✅ umgesetzt (T10) |
| A5 | **Pflichtdoku nach JEDER Änderung/Analyse**: Inventar, Changelog, Devtagebuch, Architektur, `AGENTS.md`, Roadmap — mit Version und Timestamp | `docs/CHANGELOG.md`, `docs/DEVTAGEBUCH.md`, `docs/ROADMAP.md`, `AGENTS.md` angelegt; `## Pflichtdoku` in `AGENTS.md`; Marker-Pflicht im Gate | ✅ umgesetzt (T10) |
| A6 | **Automatisch generierte Matrizen entfernen**; „die Idee korrekt automatisiert als Pre-Commit-Hook implementieren, wo es geht, Rest über AGENTS.md“ | Gates `deps-matrix`/`catalog` entfernt; `.githooks/pre-commit` schreibt Matrix, Katalog und Doku-Marker, prüft Doku + LOC; Aktivierung über `pnpm run hooks:install` | ✅ umgesetzt (T10) |
| A7 | **Keine Redundanz**; **keine lokalen Tests, die im GitHub-Workflow eskaliert und gelöst werden können** | ein Ort pro Wahrheit (eine Leiter, ein Marker, ein Save-Pfad); Vitest lief in T10 **nicht** lokal, der Beweis bleibt `verify:all` in CI | ✅ umgesetzt (T10) |

**Randbedingungen, die bei der Umsetzung gelten:** Fail-Closed bleibt für echte Regelverstöße (Geld, Ledger, Save-Integrität) bestehen — Eskalation gilt nur für behebbare/außerhalb-des-Scopes liegende Befunde. Kein Gate darf schreiben (bestehende Pipeline-Regel); Auto-Reparatur läuft ausschließlich im `--fix`-Modus oder im Pre-Commit-Hook. Jede neue Datei braucht genau eine Zuständigkeit und ein Budget.

## Befunde: Synergie-Lücken (2026-11-02)

Jeweils mit der Fundstelle, die die Lücke belegt. „Offen" heißt: braucht eine
Spielregel-Entscheidung, nicht nur eine Buchung.

| Befund | Beleg | Status |
| --- | --- | --- |
| `Persona.patience` wurde nie gelesen; der Stammgast startete ungeduldiger als der High Roller | `traits.ts` zog Geduld zu gleichen Teilen, `personas.ts` lieferte den Wert umsonst | **gefixt**: `rollProfile` gewichtet mit `persona.patience / 100`, Summe bleibt 180 |
| `PLAYER_CASH` hat keinen Ausgabepfad | `cashOutPlayerCash` existiert in `self-exclusion-bet.ts:82`; der Produktionspfad ist jetzt `SelfExclusionPanel` → `worldStore.exclusion('CASH_OUT')` → `cashOutPlayerCash` | **gelöst 2026-11-08**: sichtbarer `BONUS AUSZAHLEN`-Button; Tests `exclusion-command.test.ts` und `self-exclusion-panel.test.tsx` |
| `VELVET` verspricht „bessere Gäste", ändert aber nur Anziehung und Geduld | `offers.ts`, sonst nur Rivalen-Deko | **gelöst (Phase 2)**: `guestTier` hebt die Persona-Stufe neuer Gäste |
| `FREE_DRINK` verspricht „ein Drink pro Spin"; kein Drink wird gebucht | `offers.ts`, keine Buchung im Gastpfad | **gelöst (Phase 2)**: `serveFreeDrink` verbraucht Barbestand, Betriebsanteil wird gebucht |
| `EXTRA_REEL` („Vierte Walze") fügt keine Walze hinzu | `reelPull` liest `item.reels`, der Mod zählt nur 300 Anziehung | **gelöst (Phase 2)**: `installMod` erhöht `reels`, nur für SLOT erlaubt |
| Der Einsatz skaliert nie mit dem Persona-Budget | `offerScore`: `max(slotMinBet, baseBet)`, High Roller spielt nur länger | **gelöst (Phase 2)**: `personaStake` kombiniert Tisch, Sucht, `budgetFactor` und Wallet-Anteil |
| `need = 'social'` wird nie gesetzt, der Branch bleibt tot | `guest-choice.ts` prüfte, kein Schreiber | **entfernt** |



## Offene Design-Entscheidungen: Mods ohne Mechanik (2026-11-02)

Drei verkaufte Mods versprechen mehr, als der Code tut. Die Reparatur ist
jeweils eine Spielregel, keine Buchung — deshalb steht sie hier statt im Code.

| Mod | Was der Text verspricht | Was der Code tut | Benötigte Entscheidung |
| --- | --- | --- | --- |
| `VELVET` | „Bessere Gäste" | nur +220 Anziehung, −2 Geduld | Soll der Mod die Gästegüte (Budget/Persona-Gewicht) heben, oder wird der Text ehrlich? Eine Güte-Verschiebung ändert die Wirtschaftsrechnung des ganzen Abends. |
| `FREE_DRINK` | „Ein Drink pro Spin" | nur +140 Anziehung, +8 Geduld, 0,03 VC Betrieb | Zahlt das Haus pro Spin einen echten Drink (Buchung `HAUSKONTO` → `SHOP`, Durst sinkt), oder bleibt es bei Geduld plus Betriebskosten? |
| `EXTRA_REEL` | „Vierte Walze" | nur +300 Anziehung; Walzen kommen aus `item.reels` (kostenpflichtiges Upgrade) | Schenkt der Mod eine Walze (Preisgefüge zum `reelUpgradeCost` kippt), oder wird er zum Rabatt/ehrlichen Text? |

Ohne diese drei Antworten bleibt der Shop an drei Stellen teurer als sein Effekt.

## 18. Vollstaendige Dateiliste (maschinell erzeugt)

Der Block ist deterministisch: eine Zeile je Pfad aus `git ls-files`, ein Eintrag je Ordner. Der Generator liest Textdateien und prueft Binaersignaturen; `verify:docs` vergleicht den Block mit dem Index.

<!-- inventory:start -->

### 18.1 Abdeckung

| Feld | Wert |
| --- | --- |
| Getrackte Dateien | 3086 |
| Gelistete Dateien | 3086 |
| Getrackte Ordner | 117 |
| Bereiche | (Wurzel) (10), .githooks (3), .github (8), .lane-claims (87), artifacts (1), content (1133), docs (108), packages (27), public (571), scripts (126), src (1012) |

Regel: jede Zeile entspricht genau einem Pfad aus `git ls-files`; es gibt keine Sammelzeile und keine Ausnahme. `verify:docs` vergleicht den Block mit `git ls-files` und wird rot, sobald eine Datei fehlt oder ein Pfad nicht mehr getrackt ist.

### 18.2 Ordner

- `./` — 10 Datei(en)
- `.githooks/` — 3 Datei(en)
- `.github/` — 2 Datei(en)
- `.github/ISSUE_TEMPLATE/` — 3 Datei(en)
- `.github/workflows/` — 3 Datei(en)
- `.lane-claims/` — 2 Datei(en)
- `.lane-claims/claims/` — 44 Datei(en)
- `.lane-claims/tasks/` — 41 Datei(en)
- `artifacts/living-world/` — 1 Datei(en)
- `content/narrative/contributions/` — 1129 Datei(en)
- `content/narrative/registry/` — 1 Datei(en)
- `content/narrative/turns/` — 1 Datei(en)
- `content/narrative/vocabulary/` — 2 Datei(en)
- `docs/` — 20 Datei(en)
- `docs/banners/` — 9 Datei(en)
- `docs/contracts/` — 8 Datei(en)
- `docs/evidence/` — 2 Datei(en)
- `docs/screenshots/comparison/` — 11 Datei(en)
- `docs/screenshots/current/` — 33 Datei(en)
- `docs/screenshots/v0.3.114/` — 11 Datei(en)
- `docs/screenshots/v0.3.132/` — 8 Datei(en)
- `docs/screenshots/v0.3.78/` — 5 Datei(en)
- `docs/superpowers/plans/` — 1 Datei(en)
- `packages/gamescout/` — 5 Datei(en)
- `packages/gamescout/bin/` — 1 Datei(en)
- `packages/gamescout/src/cli/` — 5 Datei(en)
- `packages/gamescout/src/core/` — 9 Datei(en)
- `packages/gamescout/src/dashboard/` — 3 Datei(en)
- `packages/gamescout/src/mcp/` — 1 Datei(en)
- `packages/gamescout/src/types/` — 3 Datei(en)
- `public/assets/casino/atlas/` — 2 Datei(en)
- `public/assets/casino/characters/` — 69 Datei(en)
- `public/assets/casino/decor/` — 28 Datei(en)
- `public/assets/casino/environment/floor/` — 6 Datei(en)
- `public/assets/casino/environment/floor/city/doors/` — 1 Datei(en)
- `public/assets/casino/environment/floor/city/facades/` — 4 Datei(en)
- `public/assets/casino/environment/floor/city/props/` — 5 Datei(en)
- `public/assets/casino/environment/fx/` — 1 Datei(en)
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
- `scripts/` — 66 Datei(en)
- `scripts/lib/` — 60 Datei(en)
- `src/` — 3 Datei(en)
- `src/Config/` — 8 Datei(en)
- `src/Config/__tests__/` — 1 Datei(en)
- `src/core/contracts/` — 7 Datei(en)
- `src/core/contracts/__tests__/` — 7 Datei(en)
- `src/core/economy/` — 4 Datei(en)
- `src/core/economy/__tests__/` — 4 Datei(en)
- `src/core/games/` — 21 Datei(en)
- `src/core/games/__tests__/` — 27 Datei(en)
- `src/core/games/engines/` — 11 Datei(en)
- `src/core/games/engines/__tests__/` — 2 Datei(en)
- `src/core/governance/` — 2 Datei(en)
- `src/core/governance/__tests__/` — 75 Datei(en)
- `src/core/io/` — 3 Datei(en)
- `src/core/io/__tests__/` — 1 Datei(en)
- `src/core/physics/` — 3 Datei(en)
- `src/core/physics/__tests__/` — 1 Datei(en)
- `src/core/rng/` — 5 Datei(en)
- `src/core/rng/__tests__/` — 4 Datei(en)
- `src/core/sim/` — 184 Datei(en)
- `src/core/sim/__tests__/` — 167 Datei(en)
- `src/core/sim/narrative/` — 39 Datei(en)
- `src/core/sim/narrative/__tests__/` — 5 Datei(en)
- `src/core/sim/narrative/chains/` — 11 Datei(en)
- `src/core/sim/narrative/chains/definitions/` — 4 Datei(en)
- `src/core/sim/narrative/choices/` — 4 Datei(en)
- `src/core/sim/narrative/commands/` — 7 Datei(en)
- `src/core/sim/narrative/composer/` — 6 Datei(en)
- `src/core/sim/narrative/composer/__tests__/` — 2 Datei(en)
- `src/core/sim/narrative/dialogue/` — 3 Datei(en)
- `src/core/sim/narrative/events/` — 5 Datei(en)
- `src/core/sim/narrative/events/definitions/` — 14 Datei(en)
- `src/core/sim/narrative/events/definitions/__tests__/` — 1 Datei(en)
- `src/core/sim/rival-ai/` — 5 Datei(en)
- `src/debug/` — 4 Datei(en)
- `src/render/` — 64 Datei(en)
- `src/render/__tests__/` — 33 Datei(en)
- `src/render/assets/` — 5 Datei(en)
- `src/render/assets/__tests__/` — 2 Datei(en)
- `src/render/city/` — 1 Datei(en)
- `src/render/city/__tests__/` — 1 Datei(en)
- `src/render/fx/` — 2 Datei(en)
- `src/render/games/` — 25 Datei(en)
- `src/render/visual/` — 1 Datei(en)
- `src/render/visual/__tests__/` — 1 Datei(en)
- `src/store/` — 41 Datei(en)
- `src/store/__tests__/` — 35 Datei(en)
- `src/styles/` — 5 Datei(en)
- `src/test/` — 2 Datei(en)
- `src/ui/` — 102 Datei(en)
- `src/ui/__tests__/` — 32 Datei(en)
- `src/ui/games/` — 10 Datei(en)

### 18.3 Dateien

- `.gitattributes` — Zeilenenden: der Generator schreibt LF. Mit core.autocrlf=true erzeugt Git — gelesen: 9 Zeilen
- `.githooks/commit-msg` — Fail-closed: eine Commit-Nachricht ohne die drei Pflichtsektionen wird — gelesen: 14 Zeilen
- `.githooks/pre-commit` — Delegiert an den versionierten Pre-Commit-Runner. — gelesen: 5 Zeilen
- `.githooks/pre-push` — Schnelle Integrationspruefung vor dem Push. — gelesen: 42 Zeilen
- `.github/CODEOWNERS` — Feste Owner. Auch ohne Pflicht-Review macht diese Datei sichtbar, wer eine — gelesen: 12 Zeilen
- `.github/ISSUE_TEMPLATE/contract.md` — Markdown-Dokument — gelesen: 65 Zeilen
- `.github/ISSUE_TEMPLATE/gate-failure.md` — Markdown-Dokument — gelesen: 73 Zeilen
- `.github/ISSUE_TEMPLATE/lane.md` — Markdown-Dokument — gelesen: 60 Zeilen
- `.github/dependabot.yml` — version: 2 — gelesen: 10 Zeilen
- `.github/workflows/ensure-pr.yml` — name: Ensure PR — gelesen: 96 Zeilen
- `.github/workflows/pr-cleanup.yml` — name: PR Cleanup — gelesen: 107 Zeilen
- `.github/workflows/promote.yml` — name: Promote — gelesen: 65 Zeilen
- `.gitignore` — node_modules/ — gelesen: 28 Zeilen
- `.lane-claims/board-state.json` — { — gelesen: 74 Zeilen
- `.lane-claims/claims.json` — [ — gelesen: 936 Zeilen
- `.lane-claims/claims/lane-content-issue-546-city-events.json` — { — gelesen: 81 Zeilen
- `.lane-claims/claims/lane-game-apartment-start.json` — { — gelesen: 20 Zeilen
- `.lane-claims/claims/lane-governance-agent-board-workflow.json` — { — gelesen: 25 Zeilen
- `.lane-claims/claims/lane-governance-agent-onboarding.json` — { — gelesen: 23 Zeilen
- `.lane-claims/claims/lane-governance-agents-md-maintainer-governance.json` — { — gelesen: 18 Zeilen
- `.lane-claims/claims/lane-governance-apartment-start-integration.json` — { — gelesen: 24 Zeilen
- `.lane-claims/claims/lane-governance-board-status-tracking.json` — { — gelesen: 32 Zeilen
- `.lane-claims/claims/lane-governance-claim-register-reconcile-616.json` — { — gelesen: 28 Zeilen
- `.lane-claims/claims/lane-governance-issue-531-readme-belege.json` — { — gelesen: 23 Zeilen
- `.lane-claims/claims/lane-governance-issue-555-balance-run.json` — { — gelesen: 31 Zeilen
- `.lane-claims/claims/lane-governance-issue-617-generated-gate.json` — { — gelesen: 31 Zeilen
- `.lane-claims/claims/lane-governance-issue-624-determinism-computed.json` — { — gelesen: 28 Zeilen
- `.lane-claims/claims/lane-governance-issue-625-rng-entry-role.json` — { — gelesen: 24 Zeilen
- `.lane-claims/claims/lane-governance-issue-627-run-budget.json` — { — gelesen: 27 Zeilen
- `.lane-claims/claims/lane-governance-issue-628-closeout-fallback.json` — { — gelesen: 27 Zeilen
- `.lane-claims/claims/lane-governance-issue-629-generated-serialization.json` — { — gelesen: 26 Zeilen
- `.lane-claims/claims/lane-governance-issue-672-canonical-priorities.json` — { — gelesen: 27 Zeilen
- `.lane-claims/claims/lane-governance-reconcile-stale-claims-530.json` — { — gelesen: 24 Zeilen
- `.lane-claims/claims/lane-governance-roadmap-apartment-steps.json` — { — gelesen: 19 Zeilen
- `.lane-claims/claims/lane-governance-roadmap-progress-mechanical.json` — { — gelesen: 25 Zeilen
- `.lane-claims/claims/lane-governance-verify-all-green.json` — { — gelesen: 34 Zeilen
- `.lane-claims/claims/lane-governance-worker-bootstrap.json` — { — gelesen: 29 Zeilen
- `.lane-claims/claims/lane-infra-issue-623-ledger-tick-balance.json` — { — gelesen: 28 Zeilen
- `.lane-claims/claims/lane-ledger-issue-532-external-work-split.json` — { — gelesen: 36 Zeilen
- `.lane-claims/claims/lane-render-issue-515-scene-frame.json` — { — gelesen: 24 Zeilen
- `.lane-claims/claims/lane-render-r1-r12-rework.json` — { — gelesen: 31 Zeilen
- `.lane-claims/claims/lane-render-r8-city-assets.json` — { — gelesen: 29 Zeilen
- `.lane-claims/claims/lane-render-residence-role.json` — { — gelesen: 21 Zeilen
- `.lane-claims/claims/lane-render-staff-actor-state.json` — { — gelesen: 23 Zeilen
- `.lane-claims/claims/lane-sim-issue-519-employment.json` — { — gelesen: 23 Zeilen
- `.lane-claims/claims/lane-sim-issue-530-plot-road-guard.json` — { — gelesen: 23 Zeilen
- `.lane-claims/claims/lane-sim-issue-533-scheduled-place.json` — { — gelesen: 27 Zeilen
- `.lane-claims/claims/lane-sim-issue-534-first-evening.json` — { — gelesen: 22 Zeilen
- `.lane-claims/claims/lane-sim-issue-536-smartphone-inbox-vitter-immoluck.json` — { — gelesen: 37 Zeilen
- `.lane-claims/claims/lane-sim-issue-539-esport-evening.json` — { — gelesen: 33 Zeilen
- `.lane-claims/claims/lane-sim-issue-549-bet-slip-register.json` — { — gelesen: 24 Zeilen
- `.lane-claims/claims/lane-sim-issue-550-odds-crowd.json` — { — gelesen: 24 Zeilen
- `.lane-claims/claims/lane-sim-issue-552-staff-qualification.json` — { — gelesen: 42 Zeilen
- `.lane-claims/claims/lane-sim-issue-556-city-acceptance.json` — { — gelesen: 28 Zeilen
- `.lane-claims/claims/lane-sim-issue-556-city-network.json` — { — gelesen: 23 Zeilen
- `.lane-claims/claims/lane-sim-issue-566-job-market.json` — { — gelesen: 24 Zeilen
- `.lane-claims/claims/lane-sim-issue-674-starter-guidance.json` — { — gelesen: 24 Zeilen
- `.lane-claims/claims/lane-store-issue-506-door-walk.json` — { — gelesen: 24 Zeilen
- `.lane-claims/claims/lane-ui-polish-chrome.json` — { — gelesen: 58 Zeilen
- `.lane-claims/tasks/content-issue-546-city-events.json` — { — gelesen: 32 Zeilen
- `.lane-claims/tasks/game-apartment-start.json` — { — gelesen: 17 Zeilen
- `.lane-claims/tasks/governance-agent-board-workflow.json` — { — gelesen: 17 Zeilen
- `.lane-claims/tasks/governance-agent-onboarding.json` — { — gelesen: 17 Zeilen
- `.lane-claims/tasks/governance-agents-md-maintainer-governance.json` — { — gelesen: 16 Zeilen
- `.lane-claims/tasks/governance-apartment-start-integration.json` — { — gelesen: 17 Zeilen
- `.lane-claims/tasks/governance-board-status-tracking.json` — { — gelesen: 17 Zeilen
- `.lane-claims/tasks/governance-claim-register-reconcile-616.json` — { — gelesen: 17 Zeilen
- `.lane-claims/tasks/governance-issue-531-readme-belege.json` — { — gelesen: 21 Zeilen
- `.lane-claims/tasks/governance-issue-555-balance-run.json` — { — gelesen: 22 Zeilen
- `.lane-claims/tasks/governance-issue-617-generated-gate.json` — { — gelesen: 21 Zeilen
- `.lane-claims/tasks/governance-issue-625-rng-entry-role.json` — { — gelesen: 32 Zeilen
- `.lane-claims/tasks/governance-issue-627-run-budget.json` — { — gelesen: 21 Zeilen
- `.lane-claims/tasks/governance-issue-628-closeout-fallback.json` — { — gelesen: 22 Zeilen
- `.lane-claims/tasks/governance-issue-629-generated-serialization.json` — { — gelesen: 22 Zeilen
- `.lane-claims/tasks/governance-issue-672-canonical-priorities.json` — { — gelesen: 22 Zeilen
- `.lane-claims/tasks/governance-reconcile-stale-claims-530.json` — { — gelesen: 17 Zeilen
- `.lane-claims/tasks/governance-roadmap-apartment-steps.json` — { — gelesen: 17 Zeilen
- `.lane-claims/tasks/governance-roadmap-progress-mechanical.json` — { — gelesen: 17 Zeilen
- `.lane-claims/tasks/governance-verify-all-green.json` — { — gelesen: 17 Zeilen
- `.lane-claims/tasks/governance-worker-bootstrap.json` — { — gelesen: 17 Zeilen
- `.lane-claims/tasks/ledger-issue-532-external-work-split.json` — { — gelesen: 37 Zeilen
- `.lane-claims/tasks/render-issue-515-scene-frame.json` — { — gelesen: 17 Zeilen
- `.lane-claims/tasks/render-r1-r12-rework.json` — { — gelesen: 48 Zeilen
- `.lane-claims/tasks/render-r8-city-assets.json` — { — gelesen: 21 Zeilen
- `.lane-claims/tasks/render-residence-role.json` — { — gelesen: 17 Zeilen
- `.lane-claims/tasks/render-staff-actor-state.json` — { — gelesen: 17 Zeilen
- `.lane-claims/tasks/sim-issue-519-employment.json` — { — gelesen: 17 Zeilen
- `.lane-claims/tasks/sim-issue-530-plot-road-guard.json` — { — gelesen: 17 Zeilen
- `.lane-claims/tasks/sim-issue-533-scheduled-place.json` — { — gelesen: 37 Zeilen
- `.lane-claims/tasks/sim-issue-534-first-evening.json` — { — gelesen: 17 Zeilen
- `.lane-claims/tasks/sim-issue-536-smartphone-inbox-vitter-immoluck.json` — { — gelesen: 28 Zeilen
- `.lane-claims/tasks/sim-issue-539-esport-evening.json` — { — gelesen: 22 Zeilen
- `.lane-claims/tasks/sim-issue-549-bet-slip-register.json` — { — gelesen: 17 Zeilen
- `.lane-claims/tasks/sim-issue-550-odds-crowd.json` — { — gelesen: 17 Zeilen
- `.lane-claims/tasks/sim-issue-552-staff-qualification.json` — { — gelesen: 35 Zeilen
- `.lane-claims/tasks/sim-issue-556-city-acceptance.json` — { — gelesen: 17 Zeilen
- `.lane-claims/tasks/sim-issue-556-city-network.json` — { — gelesen: 17 Zeilen
- `.lane-claims/tasks/sim-issue-566-job-market.json` — { — gelesen: 17 Zeilen
- `.lane-claims/tasks/sim-issue-674-starter-guidance.json` — { — gelesen: 22 Zeilen
- `.lane-claims/tasks/store-issue-506-door-walk.json` — { — gelesen: 17 Zeilen
- `.mailmap` — Eine Anzeige-Identitaet fuer die History: Werkzeuge und Sandboxen committen — gelesen: 6 Zeilen
- `.npmrc` — allow-scripts=true — gelesen: 2 Zeilen
- `.nvmrc` — 22 — gelesen: 1 Zeilen
- `AGENTS.md` — Rigged by Design — gelesen: 140 Zeilen
- `README.md` — Markdown-Dokument — gelesen: 186 Zeilen
- `artifacts/living-world/trace-424242-5d.json` — { — gelesen: 56074 Zeilen
- `content/narrative/contributions/2026-11-01-readme-opening.json` — { — gelesen: 17 Zeilen
- `content/narrative/contributions/2026-11-01-startpool-01.json` — { — gelesen: 17 Zeilen
- `content/narrative/contributions/2026-11-02-boundary-und-beziehungen.json` — { — gelesen: 17 Zeilen
- `content/narrative/contributions/2026-11-02-deckung-und-wut.json` — { — gelesen: 19 Zeilen
- `content/narrative/contributions/2026-11-02-dokumentation.json` — { — gelesen: 17 Zeilen
- `content/narrative/contributions/2026-11-02-dreck-und-verluste.json` — { — gelesen: 17 Zeilen
- `content/narrative/contributions/2026-11-02-geduld-und-versprechen.json` — { — gelesen: 19 Zeilen
- `content/narrative/contributions/2026-11-02-nachfragezustand.json` — { — gelesen: 17 Zeilen
- `content/narrative/contributions/2026-11-02-nar-04-beziehungsquellen.json` — { — gelesen: 17 Zeilen
- `content/narrative/contributions/2026-11-02-nar-05-trigger-context.json` — { — gelesen: 20 Zeilen
- `content/narrative/contributions/2026-11-02-narrative-facts.json` — { — gelesen: 17 Zeilen
- `content/narrative/contributions/2026-11-02-schicht-und-lohn.json` — { — gelesen: 19 Zeilen
- `content/narrative/contributions/2026-11-02-trigger-bedingungen.json` — { — gelesen: 17 Zeilen
- `content/narrative/contributions/2026-11-02-vorschuss-und-geduld.json` — { — gelesen: 19 Zeilen
- `content/narrative/contributions/2026-11-03-nar-06-event-scheduler.json` — { — gelesen: 20 Zeilen
- `content/narrative/contributions/2026-11-03-nar-07-event-templates.json` — { — gelesen: 20 Zeilen
- `content/narrative/contributions/2026-11-03-nar-08-command-dsl.json` — { — gelesen: 19 Zeilen
- `content/narrative/contributions/2026-11-03-nar-09-content-registry.json` — { — gelesen: 17 Zeilen
- `content/narrative/contributions/2026-11-03-nar-10-content-compiler.json` — { — gelesen: 17 Zeilen
- `content/narrative/contributions/2026-11-03-nar-11-runtime-composer.json` — { — gelesen: 17 Zeilen
- `content/narrative/contributions/2026-11-03-nar-12-orchestration.json` — { — gelesen: 17 Zeilen
- `content/narrative/contributions/2026-11-03-nar-13-demand-events.json` — { — gelesen: 17 Zeilen
- `content/narrative/contributions/2026-11-04-b1-kontext-helper.json` — { — gelesen: 17 Zeilen
- `content/narrative/contributions/2026-11-04-b2-slot-zwecke.json` — { — gelesen: 17 Zeilen
- `content/narrative/contributions/2026-11-04-b3-fallback-slots.json` — { — gelesen: 17 Zeilen
- `content/narrative/contributions/2026-11-04-b4-konflikt-body.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-04-b4-konflikt-defuse.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-04-b4-konflikt-escalate.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-04-b4-konflikt-titel.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-04-b4-neon-body.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-04-b4-neon-titel.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-04-b4-rivale-body.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-04-b4-rivale-confront.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-04-b4-rivale-titel.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-04-b4-rivale-watch.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-04-b4-rueckkehr-ask.json` — { — gelesen: 23 Zeilen
- `content/narrative/contributions/2026-11-04-b4-rueckkehr-body.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-04-b4-rueckkehr-titel.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-04-b4-rueckkehr-welcome.json` — { — gelesen: 23 Zeilen
- `content/narrative/contributions/2026-11-04-b4-turnier-body.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-04-b4-turnier-titel.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-04-c1-trigger-template-contract.json` — {"agentId":"buffy","turnId":"2026-11-04T05:35Z-c1-trigger-template-contract","contributionId":"c1-trigger-temp — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-04-c2-rival-action-trigger.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-04-d1-aftermath-body.json` — {"agentId":"buffy","turnId":"2026-11-04T05:41Z-d1-aftermath-body","contributionId":"d1-aftermath-body-01","rol — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-04-d1-aftermath-listen.json` — {"agentId":"buffy","turnId":"2026-11-04T05:42Z-d1-aftermath-listen","contributionId":"d1-aftermath-listen-01", — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-04-d1-aftermath-outcome.json` — {"agentId":"buffy","turnId":"2026-11-04T05:43Z-d1-aftermath-outcome","contributionId":"d1-aftermath-outcome-01 — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-04-d1-aftermath-titel.json` — {"agentId":"buffy","turnId":"2026-11-04T05:40Z-d1-aftermath-titel","contributionId":"d1-aftermath-titel-01","r — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-04-d2-counter-rival.json` — {"agentId":"buffy","turnId":"2026-11-04T06:05Z-d2-counter-rival","contributionId":"d2-counter-rival-01","role" — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-04-d3-expiry-no-penalty.json` — {"agentId":"buffy","turnId":"2026-11-04T06:20Z-d3-expiry-no-penalty","contributionId":"d3-expiry-no-penalty-01 — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-04-e2-visitor-disposition.json` — {"agentId":"buffy","turnId":"2026-11-04T06:35Z-e2-visitor-disposition","contributionId":"e2-visitor-dispositio — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-04-f-warm-return.json` — {"agentId":"buffy","turnId":"2026-11-04T06:55Z-f-warm-return","contributionId":"f-warm-return-01","role":"BEOB — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-04-journal-und-profilweg.json` — { — gelesen: 17 Zeilen
- `content/narrative/contributions/2026-11-04-lebenssim-vision.json` — { — gelesen: 17 Zeilen
- `content/narrative/contributions/2026-11-04-nar-14-narrative-ui.json` — { — gelesen: 17 Zeilen
- `content/narrative/contributions/2026-11-04-nar-15-autonome-rivalen.json` — { — gelesen: 17 Zeilen
- `content/narrative/contributions/2026-11-04-nar-16-langzeitintegration.json` — { — gelesen: 17 Zeilen
- `content/narrative/contributions/2026-11-04-phase5-rival-integration.json` — {"agentId":"buffy","turnId":"2026-11-04T07:10Z-phase5-rival-integration","contributionId":"phase5-rival-integr — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-04-warm-return-body.json` — {"agentId":"buffy","turnId":"2026-11-04T07:21Z-warm-return-body","contributionId":"warm-return-body-01","role" — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-04-warm-return-choice.json` — {"agentId":"buffy","turnId":"2026-11-04T07:22Z-warm-return-choice","contributionId":"warm-return-choice-01","r — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-04-warm-return-outcome.json` — {"agentId":"buffy","turnId":"2026-11-04T07:23Z-warm-return-outcome","contributionId":"warm-return-outcome-01", — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-04-warm-return-titel.json` — {"agentId":"buffy","turnId":"2026-11-04T07:20Z-warm-return-titel","contributionId":"warm-return-titel-01","rol — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-05-huelle-atlas.json` — { — gelesen: 17 Zeilen
- `content/narrative/contributions/2026-11-06-asset-semantik-messung.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-06-asset-semantik.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-06-layout-vertrag.json` — { — gelesen: 17 Zeilen
- `content/narrative/contributions/2026-11-07-multi-beat-schritte.json` — { — gelesen: 17 Zeilen
- `content/narrative/contributions/2026-11-07-pool-choice-preview-09.json` — {"agentId":"buffy","turnId":"2026-11-07T23:09Z-pool-choice-preview-09","contributionId":"pool-choice-preview-0 — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-choice-preview-10.json` — {"agentId":"buffy","turnId":"2026-11-07T23:10Z-pool-choice-preview-10","contributionId":"pool-choice-preview-1 — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-choice-preview-11.json` — {"agentId":"buffy","turnId":"2026-11-07T23:11Z-pool-choice-preview-11","contributionId":"pool-choice-preview-1 — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-choice-preview-12.json` — {"agentId":"buffy","turnId":"2026-11-07T23:12Z-pool-choice-preview-12","contributionId":"pool-choice-preview-1 — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-choice-preview-13.json` — {"agentId":"buffy","turnId":"2026-11-07T23:13Z-pool-choice-preview-13","contributionId":"pool-choice-preview-1 — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-choice-preview-14.json` — {"agentId":"buffy","turnId":"2026-11-07T23:14Z-pool-choice-preview-14","contributionId":"pool-choice-preview-1 — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-choice-preview-15.json` — {"agentId":"buffy","turnId":"2026-11-07T23:15Z-pool-choice-preview-15","contributionId":"pool-choice-preview-1 — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-choice-preview-16.json` — {"agentId":"buffy","turnId":"2026-11-07T23:16Z-pool-choice-preview-16","contributionId":"pool-choice-preview-1 — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-choice-preview-17.json` — {"agentId":"buffy","turnId":"2026-11-07T23:17Z-pool-choice-preview-17","contributionId":"pool-choice-preview-1 — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-choice-preview-18.json` — {"agentId":"buffy","turnId":"2026-11-07T23:18Z-pool-choice-preview-18","contributionId":"pool-choice-preview-1 — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-choice-preview-19.json` — {"agentId":"buffy","turnId":"2026-11-07T23:19Z-pool-choice-preview-19","contributionId":"pool-choice-preview-1 — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-choice-preview-20.json` — {"agentId":"buffy","turnId":"2026-11-07T23:20Z-pool-choice-preview-20","contributionId":"pool-choice-preview-2 — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-choice-preview-21.json` — {"agentId":"buffy","turnId":"2026-11-07T23:21Z-pool-choice-preview-21","contributionId":"pool-choice-preview-2 — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-choice-preview-22.json` — {"agentId":"buffy","turnId":"2026-11-07T23:22Z-pool-choice-preview-22","contributionId":"pool-choice-preview-2 — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-choice-preview-23.json` — {"agentId":"buffy","turnId":"2026-11-07T23:23Z-pool-choice-preview-23","contributionId":"pool-choice-preview-2 — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-choice-preview-24.json` — {"agentId":"buffy","turnId":"2026-11-07T23:24Z-pool-choice-preview-24","contributionId":"pool-choice-preview-2 — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-choice-preview-25.json` — {"agentId":"buffy","turnId":"2026-11-07T23:25Z-pool-choice-preview-25","contributionId":"pool-choice-preview-2 — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-choice-preview-26.json` — {"agentId":"buffy","turnId":"2026-11-07T23:26Z-pool-choice-preview-26","contributionId":"pool-choice-preview-2 — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-choice-preview-27.json` — {"agentId":"buffy","turnId":"2026-11-07T23:27Z-pool-choice-preview-27","contributionId":"pool-choice-preview-2 — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-choice-preview-28.json` — {"agentId":"buffy","turnId":"2026-11-07T23:28Z-pool-choice-preview-28","contributionId":"pool-choice-preview-2 — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-choice-preview-29.json` — {"agentId":"buffy","turnId":"2026-11-07T23:29Z-pool-choice-preview-29","contributionId":"pool-choice-preview-2 — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-choice-preview-30.json` — {"agentId":"buffy","turnId":"2026-11-07T23:30Z-pool-choice-preview-30","contributionId":"pool-choice-preview-3 — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-choice-preview-31.json` — {"agentId":"buffy","turnId":"2026-11-07T23:31Z-pool-choice-preview-31","contributionId":"pool-choice-preview-3 — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-choice-preview-32.json` — {"agentId":"buffy","turnId":"2026-11-07T23:32Z-pool-choice-preview-32","contributionId":"pool-choice-preview-3 — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-choice-preview-33.json` — {"agentId":"buffy","turnId":"2026-11-07T23:33Z-pool-choice-preview-33","contributionId":"pool-choice-preview-3 — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-choice-preview-34.json` — {"agentId":"buffy","turnId":"2026-11-07T23:34Z-pool-choice-preview-34","contributionId":"pool-choice-preview-3 — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-choice-preview-35.json` — {"agentId":"buffy","turnId":"2026-11-07T23:35Z-pool-choice-preview-35","contributionId":"pool-choice-preview-3 — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-choice-preview-36.json` — {"agentId":"buffy","turnId":"2026-11-07T23:36Z-pool-choice-preview-36","contributionId":"pool-choice-preview-3 — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-choice-preview-37.json` — {"agentId":"buffy","turnId":"2026-11-07T23:37Z-pool-choice-preview-37","contributionId":"pool-choice-preview-3 — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-choice-preview-38.json` — {"agentId":"buffy","turnId":"2026-11-07T23:38Z-pool-choice-preview-38","contributionId":"pool-choice-preview-3 — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-choice-preview-39.json` — {"agentId":"buffy","turnId":"2026-11-07T23:39Z-pool-choice-preview-39","contributionId":"pool-choice-preview-3 — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-choice-preview-40.json` — {"agentId":"buffy","turnId":"2026-11-07T23:40Z-pool-choice-preview-40","contributionId":"pool-choice-preview-4 — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-choice-preview-41.json` — {"agentId":"buffy","turnId":"2026-11-07T23:41Z-pool-choice-preview-41","contributionId":"pool-choice-preview-4 — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-choice-preview-42.json` — {"agentId":"buffy","turnId":"2026-11-07T23:42Z-pool-choice-preview-42","contributionId":"pool-choice-preview-4 — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-choice-preview-43.json` — {"agentId":"buffy","turnId":"2026-11-07T23:43Z-pool-choice-preview-43","contributionId":"pool-choice-preview-4 — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-choice-preview-44.json` — {"agentId":"buffy","turnId":"2026-11-07T23:44Z-pool-choice-preview-44","contributionId":"pool-choice-preview-4 — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-choice-preview-45.json` — {"agentId":"buffy","turnId":"2026-11-07T23:45Z-pool-choice-preview-45","contributionId":"pool-choice-preview-4 — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-choice-preview-46.json` — {"agentId":"buffy","turnId":"2026-11-07T23:46Z-pool-choice-preview-46","contributionId":"pool-choice-preview-4 — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-choice-preview-47.json` — {"agentId":"buffy","turnId":"2026-11-07T23:47Z-pool-choice-preview-47","contributionId":"pool-choice-preview-4 — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-choice-preview-48.json` — {"agentId":"buffy","turnId":"2026-11-07T23:48Z-pool-choice-preview-48","contributionId":"pool-choice-preview-4 — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-choice-preview-49.json` — {"agentId":"buffy","turnId":"2026-11-07T23:49Z-pool-choice-preview-49","contributionId":"pool-choice-preview-4 — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-choice-preview-50.json` — {"agentId":"buffy","turnId":"2026-11-07T23:50Z-pool-choice-preview-50","contributionId":"pool-choice-preview-5 — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-description-11.json` — {"agentId":"buffy","turnId":"2026-11-07T23:11Z-pool-description-11","contributionId":"pool-description-11","ro — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-description-12.json` — {"agentId":"buffy","turnId":"2026-11-07T23:12Z-pool-description-12","contributionId":"pool-description-12","ro — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-description-13.json` — {"agentId":"buffy","turnId":"2026-11-07T23:13Z-pool-description-13","contributionId":"pool-description-13","ro — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-description-14.json` — {"agentId":"buffy","turnId":"2026-11-07T23:14Z-pool-description-14","contributionId":"pool-description-14","ro — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-description-15.json` — {"agentId":"buffy","turnId":"2026-11-07T23:15Z-pool-description-15","contributionId":"pool-description-15","ro — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-description-16.json` — {"agentId":"buffy","turnId":"2026-11-07T23:16Z-pool-description-16","contributionId":"pool-description-16","ro — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-description-17.json` — {"agentId":"buffy","turnId":"2026-11-07T23:17Z-pool-description-17","contributionId":"pool-description-17","ro — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-description-18.json` — {"agentId":"buffy","turnId":"2026-11-07T23:18Z-pool-description-18","contributionId":"pool-description-18","ro — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-description-19.json` — {"agentId":"buffy","turnId":"2026-11-07T23:19Z-pool-description-19","contributionId":"pool-description-19","ro — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-description-20.json` — {"agentId":"buffy","turnId":"2026-11-07T23:20Z-pool-description-20","contributionId":"pool-description-20","ro — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-description-21.json` — {"agentId":"buffy","turnId":"2026-11-07T23:21Z-pool-description-21","contributionId":"pool-description-21","ro — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-description-22.json` — {"agentId":"buffy","turnId":"2026-11-07T23:22Z-pool-description-22","contributionId":"pool-description-22","ro — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-description-23.json` — {"agentId":"buffy","turnId":"2026-11-07T23:23Z-pool-description-23","contributionId":"pool-description-23","ro — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-description-24.json` — {"agentId":"buffy","turnId":"2026-11-07T23:24Z-pool-description-24","contributionId":"pool-description-24","ro — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-description-25.json` — {"agentId":"buffy","turnId":"2026-11-07T23:25Z-pool-description-25","contributionId":"pool-description-25","ro — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-description-26.json` — {"agentId":"buffy","turnId":"2026-11-07T23:26Z-pool-description-26","contributionId":"pool-description-26","ro — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-description-27.json` — {"agentId":"buffy","turnId":"2026-11-07T23:27Z-pool-description-27","contributionId":"pool-description-27","ro — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-description-28.json` — {"agentId":"buffy","turnId":"2026-11-07T23:28Z-pool-description-28","contributionId":"pool-description-28","ro — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-description-29.json` — {"agentId":"buffy","turnId":"2026-11-07T23:29Z-pool-description-29","contributionId":"pool-description-29","ro — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-description-30.json` — {"agentId":"buffy","turnId":"2026-11-07T23:30Z-pool-description-30","contributionId":"pool-description-30","ro — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-description-31.json` — {"agentId":"buffy","turnId":"2026-11-07T23:31Z-pool-description-31","contributionId":"pool-description-31","ro — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-description-32.json` — {"agentId":"buffy","turnId":"2026-11-07T23:32Z-pool-description-32","contributionId":"pool-description-32","ro — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-description-33.json` — {"agentId":"buffy","turnId":"2026-11-07T23:33Z-pool-description-33","contributionId":"pool-description-33","ro — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-description-34.json` — {"agentId":"buffy","turnId":"2026-11-07T23:34Z-pool-description-34","contributionId":"pool-description-34","ro — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-description-35.json` — {"agentId":"buffy","turnId":"2026-11-07T23:35Z-pool-description-35","contributionId":"pool-description-35","ro — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-description-36.json` — {"agentId":"buffy","turnId":"2026-11-07T23:36Z-pool-description-36","contributionId":"pool-description-36","ro — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-description-37.json` — {"agentId":"buffy","turnId":"2026-11-07T23:37Z-pool-description-37","contributionId":"pool-description-37","ro — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-description-38.json` — {"agentId":"buffy","turnId":"2026-11-07T23:38Z-pool-description-38","contributionId":"pool-description-38","ro — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-description-39.json` — {"agentId":"buffy","turnId":"2026-11-07T23:39Z-pool-description-39","contributionId":"pool-description-39","ro — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-description-40.json` — {"agentId":"buffy","turnId":"2026-11-07T23:40Z-pool-description-40","contributionId":"pool-description-40","ro — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-description-41.json` — {"agentId":"buffy","turnId":"2026-11-07T23:41Z-pool-description-41","contributionId":"pool-description-41","ro — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-description-42.json` — {"agentId":"buffy","turnId":"2026-11-07T23:42Z-pool-description-42","contributionId":"pool-description-42","ro — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-description-43.json` — {"agentId":"buffy","turnId":"2026-11-07T23:43Z-pool-description-43","contributionId":"pool-description-43","ro — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-description-44.json` — {"agentId":"buffy","turnId":"2026-11-07T23:44Z-pool-description-44","contributionId":"pool-description-44","ro — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-description-45.json` — {"agentId":"buffy","turnId":"2026-11-07T23:45Z-pool-description-45","contributionId":"pool-description-45","ro — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-description-46.json` — {"agentId":"buffy","turnId":"2026-11-07T23:46Z-pool-description-46","contributionId":"pool-description-46","ro — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-description-47.json` — {"agentId":"buffy","turnId":"2026-11-07T23:47Z-pool-description-47","contributionId":"pool-description-47","ro — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-description-48.json` — {"agentId":"buffy","turnId":"2026-11-07T23:48Z-pool-description-48","contributionId":"pool-description-48","ro — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-description-49.json` — {"agentId":"buffy","turnId":"2026-11-07T23:49Z-pool-description-49","contributionId":"pool-description-49","ro — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-description-50.json` — {"agentId":"buffy","turnId":"2026-11-07T23:50Z-pool-description-50","contributionId":"pool-description-50","ro — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-documentation-27.json` — {"agentId":"buffy","turnId":"2026-11-07T23:27Z-pool-documentation-27","contributionId":"pool-documentation-27" — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-documentation-28.json` — {"agentId":"buffy","turnId":"2026-11-07T23:28Z-pool-documentation-28","contributionId":"pool-documentation-28" — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-documentation-29.json` — {"agentId":"buffy","turnId":"2026-11-07T23:29Z-pool-documentation-29","contributionId":"pool-documentation-29" — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-documentation-30.json` — {"agentId":"buffy","turnId":"2026-11-07T23:30Z-pool-documentation-30","contributionId":"pool-documentation-30" — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-documentation-31.json` — {"agentId":"buffy","turnId":"2026-11-07T23:31Z-pool-documentation-31","contributionId":"pool-documentation-31" — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-documentation-32.json` — {"agentId":"buffy","turnId":"2026-11-07T23:32Z-pool-documentation-32","contributionId":"pool-documentation-32" — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-documentation-33.json` — {"agentId":"buffy","turnId":"2026-11-07T23:33Z-pool-documentation-33","contributionId":"pool-documentation-33" — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-documentation-34.json` — {"agentId":"buffy","turnId":"2026-11-07T23:34Z-pool-documentation-34","contributionId":"pool-documentation-34" — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-documentation-35.json` — {"agentId":"buffy","turnId":"2026-11-07T23:35Z-pool-documentation-35","contributionId":"pool-documentation-35" — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-documentation-36.json` — {"agentId":"buffy","turnId":"2026-11-07T23:36Z-pool-documentation-36","contributionId":"pool-documentation-36" — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-documentation-37.json` — {"agentId":"buffy","turnId":"2026-11-07T23:37Z-pool-documentation-37","contributionId":"pool-documentation-37" — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-documentation-38.json` — {"agentId":"buffy","turnId":"2026-11-07T23:38Z-pool-documentation-38","contributionId":"pool-documentation-38" — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-documentation-39.json` — {"agentId":"buffy","turnId":"2026-11-07T23:39Z-pool-documentation-39","contributionId":"pool-documentation-39" — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-documentation-40.json` — {"agentId":"buffy","turnId":"2026-11-07T23:40Z-pool-documentation-40","contributionId":"pool-documentation-40" — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-documentation-41.json` — {"agentId":"buffy","turnId":"2026-11-07T23:41Z-pool-documentation-41","contributionId":"pool-documentation-41" — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-documentation-42.json` — {"agentId":"buffy","turnId":"2026-11-07T23:42Z-pool-documentation-42","contributionId":"pool-documentation-42" — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-documentation-43.json` — {"agentId":"buffy","turnId":"2026-11-07T23:43Z-pool-documentation-43","contributionId":"pool-documentation-43" — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-documentation-44.json` — {"agentId":"buffy","turnId":"2026-11-07T23:44Z-pool-documentation-44","contributionId":"pool-documentation-44" — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-documentation-45.json` — {"agentId":"buffy","turnId":"2026-11-07T23:45Z-pool-documentation-45","contributionId":"pool-documentation-45" — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-documentation-46.json` — {"agentId":"buffy","turnId":"2026-11-07T23:46Z-pool-documentation-46","contributionId":"pool-documentation-46" — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-documentation-47.json` — {"agentId":"buffy","turnId":"2026-11-07T23:47Z-pool-documentation-47","contributionId":"pool-documentation-47" — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-documentation-48.json` — {"agentId":"buffy","turnId":"2026-11-07T23:48Z-pool-documentation-48","contributionId":"pool-documentation-48" — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-documentation-49.json` — {"agentId":"buffy","turnId":"2026-11-07T23:49Z-pool-documentation-49","contributionId":"pool-documentation-49" — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-documentation-50.json` — {"agentId":"buffy","turnId":"2026-11-07T23:50Z-pool-documentation-50","contributionId":"pool-documentation-50" — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-event-body-08.json` — {"agentId":"buffy","turnId":"2026-11-07T23:08Z-pool-event-body-08","contributionId":"pool-event-body-08","role — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-event-body-09.json` — {"agentId":"buffy","turnId":"2026-11-07T23:09Z-pool-event-body-09","contributionId":"pool-event-body-09","role — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-event-body-10.json` — {"agentId":"buffy","turnId":"2026-11-07T23:10Z-pool-event-body-10","contributionId":"pool-event-body-10","role — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-event-body-11.json` — {"agentId":"buffy","turnId":"2026-11-07T23:11Z-pool-event-body-11","contributionId":"pool-event-body-11","role — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-event-body-12.json` — {"agentId":"buffy","turnId":"2026-11-07T23:12Z-pool-event-body-12","contributionId":"pool-event-body-12","role — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-event-body-13.json` — {"agentId":"buffy","turnId":"2026-11-07T23:13Z-pool-event-body-13","contributionId":"pool-event-body-13","role — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-event-body-14.json` — {"agentId":"buffy","turnId":"2026-11-07T23:14Z-pool-event-body-14","contributionId":"pool-event-body-14","role — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-event-body-15.json` — {"agentId":"buffy","turnId":"2026-11-07T23:15Z-pool-event-body-15","contributionId":"pool-event-body-15","role — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-event-body-16.json` — {"agentId":"buffy","turnId":"2026-11-07T23:16Z-pool-event-body-16","contributionId":"pool-event-body-16","role — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-event-body-17.json` — {"agentId":"buffy","turnId":"2026-11-07T23:17Z-pool-event-body-17","contributionId":"pool-event-body-17","role — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-event-body-18.json` — {"agentId":"buffy","turnId":"2026-11-07T23:18Z-pool-event-body-18","contributionId":"pool-event-body-18","role — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-event-body-19.json` — {"agentId":"buffy","turnId":"2026-11-07T23:19Z-pool-event-body-19","contributionId":"pool-event-body-19","role — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-event-body-20.json` — {"agentId":"buffy","turnId":"2026-11-07T23:20Z-pool-event-body-20","contributionId":"pool-event-body-20","role — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-event-body-21.json` — {"agentId":"buffy","turnId":"2026-11-07T23:21Z-pool-event-body-21","contributionId":"pool-event-body-21","role — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-event-body-22.json` — {"agentId":"buffy","turnId":"2026-11-07T23:22Z-pool-event-body-22","contributionId":"pool-event-body-22","role — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-event-body-23.json` — {"agentId":"buffy","turnId":"2026-11-07T23:23Z-pool-event-body-23","contributionId":"pool-event-body-23","role — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-event-body-24.json` — {"agentId":"buffy","turnId":"2026-11-07T23:24Z-pool-event-body-24","contributionId":"pool-event-body-24","role — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-event-body-25.json` — {"agentId":"buffy","turnId":"2026-11-07T23:25Z-pool-event-body-25","contributionId":"pool-event-body-25","role — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-event-body-26.json` — {"agentId":"buffy","turnId":"2026-11-07T23:26Z-pool-event-body-26","contributionId":"pool-event-body-26","role — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-event-body-27.json` — {"agentId":"buffy","turnId":"2026-11-07T23:27Z-pool-event-body-27","contributionId":"pool-event-body-27","role — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-event-body-28.json` — {"agentId":"buffy","turnId":"2026-11-07T23:28Z-pool-event-body-28","contributionId":"pool-event-body-28","role — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-event-body-29.json` — {"agentId":"buffy","turnId":"2026-11-07T23:29Z-pool-event-body-29","contributionId":"pool-event-body-29","role — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-event-body-30.json` — {"agentId":"buffy","turnId":"2026-11-07T23:30Z-pool-event-body-30","contributionId":"pool-event-body-30","role — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-event-body-31.json` — {"agentId":"buffy","turnId":"2026-11-07T23:31Z-pool-event-body-31","contributionId":"pool-event-body-31","role — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-event-body-32.json` — {"agentId":"buffy","turnId":"2026-11-07T23:32Z-pool-event-body-32","contributionId":"pool-event-body-32","role — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-event-body-33.json` — {"agentId":"buffy","turnId":"2026-11-07T23:33Z-pool-event-body-33","contributionId":"pool-event-body-33","role — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-event-body-34.json` — {"agentId":"buffy","turnId":"2026-11-07T23:34Z-pool-event-body-34","contributionId":"pool-event-body-34","role — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-event-body-35.json` — {"agentId":"buffy","turnId":"2026-11-07T23:35Z-pool-event-body-35","contributionId":"pool-event-body-35","role — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-event-body-36.json` — {"agentId":"buffy","turnId":"2026-11-07T23:36Z-pool-event-body-36","contributionId":"pool-event-body-36","role — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-event-body-37.json` — {"agentId":"buffy","turnId":"2026-11-07T23:37Z-pool-event-body-37","contributionId":"pool-event-body-37","role — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-event-body-38.json` — {"agentId":"buffy","turnId":"2026-11-07T23:38Z-pool-event-body-38","contributionId":"pool-event-body-38","role — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-event-body-39.json` — {"agentId":"buffy","turnId":"2026-11-07T23:39Z-pool-event-body-39","contributionId":"pool-event-body-39","role — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-event-body-40.json` — {"agentId":"buffy","turnId":"2026-11-07T23:40Z-pool-event-body-40","contributionId":"pool-event-body-40","role — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-event-body-41.json` — {"agentId":"buffy","turnId":"2026-11-07T23:41Z-pool-event-body-41","contributionId":"pool-event-body-41","role — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-event-body-42.json` — {"agentId":"buffy","turnId":"2026-11-07T23:42Z-pool-event-body-42","contributionId":"pool-event-body-42","role — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-event-body-43.json` — {"agentId":"buffy","turnId":"2026-11-07T23:43Z-pool-event-body-43","contributionId":"pool-event-body-43","role — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-event-body-44.json` — {"agentId":"buffy","turnId":"2026-11-07T23:44Z-pool-event-body-44","contributionId":"pool-event-body-44","role — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-event-body-45.json` — {"agentId":"buffy","turnId":"2026-11-07T23:45Z-pool-event-body-45","contributionId":"pool-event-body-45","role — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-event-body-46.json` — {"agentId":"buffy","turnId":"2026-11-07T23:46Z-pool-event-body-46","contributionId":"pool-event-body-46","role — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-event-body-47.json` — {"agentId":"buffy","turnId":"2026-11-07T23:47Z-pool-event-body-47","contributionId":"pool-event-body-47","role — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-event-body-48.json` — {"agentId":"buffy","turnId":"2026-11-07T23:48Z-pool-event-body-48","contributionId":"pool-event-body-48","role — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-event-body-49.json` — {"agentId":"buffy","turnId":"2026-11-07T23:49Z-pool-event-body-49","contributionId":"pool-event-body-49","role — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-event-body-50.json` — {"agentId":"buffy","turnId":"2026-11-07T23:50Z-pool-event-body-50","contributionId":"pool-event-body-50","role — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-memory-04.json` — {"agentId":"buffy","turnId":"2026-11-07T23:04Z-pool-memory-04","contributionId":"pool-memory-04","role":"BEOBA — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-memory-05.json` — {"agentId":"buffy","turnId":"2026-11-07T23:05Z-pool-memory-05","contributionId":"pool-memory-05","role":"BEOBA — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-memory-06.json` — {"agentId":"buffy","turnId":"2026-11-07T23:06Z-pool-memory-06","contributionId":"pool-memory-06","role":"BEOBA — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-memory-07.json` — {"agentId":"buffy","turnId":"2026-11-07T23:07Z-pool-memory-07","contributionId":"pool-memory-07","role":"BEOBA — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-memory-08.json` — {"agentId":"buffy","turnId":"2026-11-07T23:08Z-pool-memory-08","contributionId":"pool-memory-08","role":"BEOBA — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-memory-09.json` — {"agentId":"buffy","turnId":"2026-11-07T23:09Z-pool-memory-09","contributionId":"pool-memory-09","role":"BEOBA — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-memory-10.json` — {"agentId":"buffy","turnId":"2026-11-07T23:10Z-pool-memory-10","contributionId":"pool-memory-10","role":"BEOBA — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-memory-11.json` — {"agentId":"buffy","turnId":"2026-11-07T23:11Z-pool-memory-11","contributionId":"pool-memory-11","role":"BEOBA — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-memory-12.json` — {"agentId":"buffy","turnId":"2026-11-07T23:12Z-pool-memory-12","contributionId":"pool-memory-12","role":"BEOBA — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-memory-13.json` — {"agentId":"buffy","turnId":"2026-11-07T23:13Z-pool-memory-13","contributionId":"pool-memory-13","role":"BEOBA — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-memory-14.json` — {"agentId":"buffy","turnId":"2026-11-07T23:14Z-pool-memory-14","contributionId":"pool-memory-14","role":"BEOBA — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-memory-15.json` — {"agentId":"buffy","turnId":"2026-11-07T23:15Z-pool-memory-15","contributionId":"pool-memory-15","role":"BEOBA — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-memory-16.json` — {"agentId":"buffy","turnId":"2026-11-07T23:16Z-pool-memory-16","contributionId":"pool-memory-16","role":"BEOBA — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-memory-17.json` — {"agentId":"buffy","turnId":"2026-11-07T23:17Z-pool-memory-17","contributionId":"pool-memory-17","role":"BEOBA — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-memory-18.json` — {"agentId":"buffy","turnId":"2026-11-07T23:18Z-pool-memory-18","contributionId":"pool-memory-18","role":"BEOBA — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-memory-19.json` — {"agentId":"buffy","turnId":"2026-11-07T23:19Z-pool-memory-19","contributionId":"pool-memory-19","role":"BEOBA — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-memory-20.json` — {"agentId":"buffy","turnId":"2026-11-07T23:20Z-pool-memory-20","contributionId":"pool-memory-20","role":"BEOBA — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-memory-21.json` — {"agentId":"buffy","turnId":"2026-11-07T23:21Z-pool-memory-21","contributionId":"pool-memory-21","role":"BEOBA — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-memory-22.json` — {"agentId":"buffy","turnId":"2026-11-07T23:22Z-pool-memory-22","contributionId":"pool-memory-22","role":"BEOBA — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-memory-23.json` — {"agentId":"buffy","turnId":"2026-11-07T23:23Z-pool-memory-23","contributionId":"pool-memory-23","role":"BEOBA — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-memory-24.json` — {"agentId":"buffy","turnId":"2026-11-07T23:24Z-pool-memory-24","contributionId":"pool-memory-24","role":"BEOBA — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-memory-25.json` — {"agentId":"buffy","turnId":"2026-11-07T23:25Z-pool-memory-25","contributionId":"pool-memory-25","role":"BEOBA — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-memory-26.json` — {"agentId":"buffy","turnId":"2026-11-07T23:26Z-pool-memory-26","contributionId":"pool-memory-26","role":"BEOBA — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-memory-27.json` — {"agentId":"buffy","turnId":"2026-11-07T23:27Z-pool-memory-27","contributionId":"pool-memory-27","role":"BEOBA — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-memory-28.json` — {"agentId":"buffy","turnId":"2026-11-07T23:28Z-pool-memory-28","contributionId":"pool-memory-28","role":"BEOBA — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-memory-29.json` — {"agentId":"buffy","turnId":"2026-11-07T23:29Z-pool-memory-29","contributionId":"pool-memory-29","role":"BEOBA — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-memory-30.json` — {"agentId":"buffy","turnId":"2026-11-07T23:30Z-pool-memory-30","contributionId":"pool-memory-30","role":"BEOBA — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-memory-31.json` — {"agentId":"buffy","turnId":"2026-11-07T23:31Z-pool-memory-31","contributionId":"pool-memory-31","role":"BEOBA — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-memory-32.json` — {"agentId":"buffy","turnId":"2026-11-07T23:32Z-pool-memory-32","contributionId":"pool-memory-32","role":"BEOBA — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-memory-33.json` — {"agentId":"buffy","turnId":"2026-11-07T23:33Z-pool-memory-33","contributionId":"pool-memory-33","role":"BEOBA — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-memory-34.json` — {"agentId":"buffy","turnId":"2026-11-07T23:34Z-pool-memory-34","contributionId":"pool-memory-34","role":"BEOBA — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-memory-35.json` — {"agentId":"buffy","turnId":"2026-11-07T23:35Z-pool-memory-35","contributionId":"pool-memory-35","role":"BEOBA — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-memory-36.json` — {"agentId":"buffy","turnId":"2026-11-07T23:36Z-pool-memory-36","contributionId":"pool-memory-36","role":"BEOBA — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-memory-37.json` — {"agentId":"buffy","turnId":"2026-11-07T23:37Z-pool-memory-37","contributionId":"pool-memory-37","role":"BEOBA — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-memory-38.json` — {"agentId":"buffy","turnId":"2026-11-07T23:38Z-pool-memory-38","contributionId":"pool-memory-38","role":"BEOBA — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-memory-39.json` — {"agentId":"buffy","turnId":"2026-11-07T23:39Z-pool-memory-39","contributionId":"pool-memory-39","role":"BEOBA — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-memory-40.json` — {"agentId":"buffy","turnId":"2026-11-07T23:40Z-pool-memory-40","contributionId":"pool-memory-40","role":"BEOBA — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-memory-41.json` — {"agentId":"buffy","turnId":"2026-11-07T23:41Z-pool-memory-41","contributionId":"pool-memory-41","role":"BEOBA — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-memory-42.json` — {"agentId":"buffy","turnId":"2026-11-07T23:42Z-pool-memory-42","contributionId":"pool-memory-42","role":"BEOBA — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-memory-43.json` — {"agentId":"buffy","turnId":"2026-11-07T23:43Z-pool-memory-43","contributionId":"pool-memory-43","role":"BEOBA — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-memory-44.json` — {"agentId":"buffy","turnId":"2026-11-07T23:44Z-pool-memory-44","contributionId":"pool-memory-44","role":"BEOBA — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-memory-45.json` — {"agentId":"buffy","turnId":"2026-11-07T23:45Z-pool-memory-45","contributionId":"pool-memory-45","role":"BEOBA — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-memory-46.json` — {"agentId":"buffy","turnId":"2026-11-07T23:46Z-pool-memory-46","contributionId":"pool-memory-46","role":"BEOBA — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-memory-47.json` — {"agentId":"buffy","turnId":"2026-11-07T23:47Z-pool-memory-47","contributionId":"pool-memory-47","role":"BEOBA — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-memory-48.json` — {"agentId":"buffy","turnId":"2026-11-07T23:48Z-pool-memory-48","contributionId":"pool-memory-48","role":"BEOBA — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-memory-49.json` — {"agentId":"buffy","turnId":"2026-11-07T23:49Z-pool-memory-49","contributionId":"pool-memory-49","role":"BEOBA — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-memory-50.json` — {"agentId":"buffy","turnId":"2026-11-07T23:50Z-pool-memory-50","contributionId":"pool-memory-50","role":"BEOBA — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-opening-10.json` — {"agentId":"buffy","turnId":"2026-11-07T23:10Z-pool-opening-10","contributionId":"pool-opening-10","role":"BEO — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-opening-11.json` — {"agentId":"buffy","turnId":"2026-11-07T23:11Z-pool-opening-11","contributionId":"pool-opening-11","role":"BEO — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-opening-12.json` — {"agentId":"buffy","turnId":"2026-11-07T23:12Z-pool-opening-12","contributionId":"pool-opening-12","role":"BEO — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-opening-13.json` — {"agentId":"buffy","turnId":"2026-11-07T23:13Z-pool-opening-13","contributionId":"pool-opening-13","role":"BEO — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-opening-14.json` — {"agentId":"buffy","turnId":"2026-11-07T23:14Z-pool-opening-14","contributionId":"pool-opening-14","role":"BEO — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-opening-15.json` — {"agentId":"buffy","turnId":"2026-11-07T23:15Z-pool-opening-15","contributionId":"pool-opening-15","role":"BEO — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-opening-16.json` — {"agentId":"buffy","turnId":"2026-11-07T23:16Z-pool-opening-16","contributionId":"pool-opening-16","role":"BEO — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-opening-17.json` — {"agentId":"buffy","turnId":"2026-11-07T23:17Z-pool-opening-17","contributionId":"pool-opening-17","role":"BEO — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-opening-18.json` — {"agentId":"buffy","turnId":"2026-11-07T23:18Z-pool-opening-18","contributionId":"pool-opening-18","role":"BEO — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-opening-19.json` — {"agentId":"buffy","turnId":"2026-11-07T23:19Z-pool-opening-19","contributionId":"pool-opening-19","role":"BEO — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-opening-20.json` — {"agentId":"buffy","turnId":"2026-11-07T23:20Z-pool-opening-20","contributionId":"pool-opening-20","role":"BEO — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-opening-21.json` — {"agentId":"buffy","turnId":"2026-11-07T23:21Z-pool-opening-21","contributionId":"pool-opening-21","role":"BEO — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-opening-22.json` — {"agentId":"buffy","turnId":"2026-11-07T23:22Z-pool-opening-22","contributionId":"pool-opening-22","role":"BEO — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-opening-23.json` — {"agentId":"buffy","turnId":"2026-11-07T23:23Z-pool-opening-23","contributionId":"pool-opening-23","role":"BEO — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-opening-24.json` — {"agentId":"buffy","turnId":"2026-11-07T23:24Z-pool-opening-24","contributionId":"pool-opening-24","role":"BEO — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-opening-25.json` — {"agentId":"buffy","turnId":"2026-11-07T23:25Z-pool-opening-25","contributionId":"pool-opening-25","role":"BEO — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-opening-26.json` — {"agentId":"buffy","turnId":"2026-11-07T23:26Z-pool-opening-26","contributionId":"pool-opening-26","role":"BEO — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-opening-27.json` — {"agentId":"buffy","turnId":"2026-11-07T23:27Z-pool-opening-27","contributionId":"pool-opening-27","role":"BEO — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-opening-28.json` — {"agentId":"buffy","turnId":"2026-11-07T23:28Z-pool-opening-28","contributionId":"pool-opening-28","role":"BEO — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-opening-29.json` — {"agentId":"buffy","turnId":"2026-11-07T23:29Z-pool-opening-29","contributionId":"pool-opening-29","role":"BEO — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-opening-30.json` — {"agentId":"buffy","turnId":"2026-11-07T23:30Z-pool-opening-30","contributionId":"pool-opening-30","role":"BEO — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-opening-31.json` — {"agentId":"buffy","turnId":"2026-11-07T23:31Z-pool-opening-31","contributionId":"pool-opening-31","role":"BEO — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-opening-32.json` — {"agentId":"buffy","turnId":"2026-11-07T23:32Z-pool-opening-32","contributionId":"pool-opening-32","role":"BEO — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-opening-33.json` — {"agentId":"buffy","turnId":"2026-11-07T23:33Z-pool-opening-33","contributionId":"pool-opening-33","role":"BEO — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-opening-34.json` — {"agentId":"buffy","turnId":"2026-11-07T23:34Z-pool-opening-34","contributionId":"pool-opening-34","role":"BEO — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-opening-35.json` — {"agentId":"buffy","turnId":"2026-11-07T23:35Z-pool-opening-35","contributionId":"pool-opening-35","role":"BEO — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-opening-36.json` — {"agentId":"buffy","turnId":"2026-11-07T23:36Z-pool-opening-36","contributionId":"pool-opening-36","role":"BEO — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-opening-37.json` — {"agentId":"buffy","turnId":"2026-11-07T23:37Z-pool-opening-37","contributionId":"pool-opening-37","role":"BEO — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-opening-38.json` — {"agentId":"buffy","turnId":"2026-11-07T23:38Z-pool-opening-38","contributionId":"pool-opening-38","role":"BEO — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-opening-39.json` — {"agentId":"buffy","turnId":"2026-11-07T23:39Z-pool-opening-39","contributionId":"pool-opening-39","role":"BEO — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-opening-40.json` — {"agentId":"buffy","turnId":"2026-11-07T23:40Z-pool-opening-40","contributionId":"pool-opening-40","role":"BEO — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-opening-41.json` — {"agentId":"buffy","turnId":"2026-11-07T23:41Z-pool-opening-41","contributionId":"pool-opening-41","role":"BEO — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-opening-42.json` — {"agentId":"buffy","turnId":"2026-11-07T23:42Z-pool-opening-42","contributionId":"pool-opening-42","role":"BEO — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-opening-43.json` — {"agentId":"buffy","turnId":"2026-11-07T23:43Z-pool-opening-43","contributionId":"pool-opening-43","role":"BEO — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-opening-44.json` — {"agentId":"buffy","turnId":"2026-11-07T23:44Z-pool-opening-44","contributionId":"pool-opening-44","role":"BEO — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-opening-45.json` — {"agentId":"buffy","turnId":"2026-11-07T23:45Z-pool-opening-45","contributionId":"pool-opening-45","role":"BEO — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-opening-46.json` — {"agentId":"buffy","turnId":"2026-11-07T23:46Z-pool-opening-46","contributionId":"pool-opening-46","role":"BEO — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-opening-47.json` — {"agentId":"buffy","turnId":"2026-11-07T23:47Z-pool-opening-47","contributionId":"pool-opening-47","role":"BEO — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-opening-48.json` — {"agentId":"buffy","turnId":"2026-11-07T23:48Z-pool-opening-48","contributionId":"pool-opening-48","role":"BEO — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-opening-49.json` — {"agentId":"buffy","turnId":"2026-11-07T23:49Z-pool-opening-49","contributionId":"pool-opening-49","role":"BEO — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-opening-50.json` — {"agentId":"buffy","turnId":"2026-11-07T23:50Z-pool-opening-50","contributionId":"pool-opening-50","role":"BEO — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-reaction-04.json` — {"agentId":"buffy","turnId":"2026-11-07T23:04Z-pool-reaction-04","contributionId":"pool-reaction-04","role":"B — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-reaction-05.json` — {"agentId":"buffy","turnId":"2026-11-07T23:05Z-pool-reaction-05","contributionId":"pool-reaction-05","role":"B — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-reaction-06.json` — {"agentId":"buffy","turnId":"2026-11-07T23:06Z-pool-reaction-06","contributionId":"pool-reaction-06","role":"B — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-reaction-07.json` — {"agentId":"buffy","turnId":"2026-11-07T23:07Z-pool-reaction-07","contributionId":"pool-reaction-07","role":"B — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-reaction-08.json` — {"agentId":"buffy","turnId":"2026-11-07T23:08Z-pool-reaction-08","contributionId":"pool-reaction-08","role":"B — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-reaction-09.json` — {"agentId":"buffy","turnId":"2026-11-07T23:09Z-pool-reaction-09","contributionId":"pool-reaction-09","role":"B — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-reaction-10.json` — {"agentId":"buffy","turnId":"2026-11-07T23:10Z-pool-reaction-10","contributionId":"pool-reaction-10","role":"B — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-reaction-11.json` — {"agentId":"buffy","turnId":"2026-11-07T23:11Z-pool-reaction-11","contributionId":"pool-reaction-11","role":"B — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-reaction-12.json` — {"agentId":"buffy","turnId":"2026-11-07T23:12Z-pool-reaction-12","contributionId":"pool-reaction-12","role":"B — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-reaction-13.json` — {"agentId":"buffy","turnId":"2026-11-07T23:13Z-pool-reaction-13","contributionId":"pool-reaction-13","role":"B — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-reaction-14.json` — {"agentId":"buffy","turnId":"2026-11-07T23:14Z-pool-reaction-14","contributionId":"pool-reaction-14","role":"B — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-reaction-15.json` — {"agentId":"buffy","turnId":"2026-11-07T23:15Z-pool-reaction-15","contributionId":"pool-reaction-15","role":"B — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-reaction-16.json` — {"agentId":"buffy","turnId":"2026-11-07T23:16Z-pool-reaction-16","contributionId":"pool-reaction-16","role":"B — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-reaction-17.json` — {"agentId":"buffy","turnId":"2026-11-07T23:17Z-pool-reaction-17","contributionId":"pool-reaction-17","role":"B — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-reaction-18.json` — {"agentId":"buffy","turnId":"2026-11-07T23:18Z-pool-reaction-18","contributionId":"pool-reaction-18","role":"B — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-reaction-19.json` — {"agentId":"buffy","turnId":"2026-11-07T23:19Z-pool-reaction-19","contributionId":"pool-reaction-19","role":"B — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-reaction-20.json` — {"agentId":"buffy","turnId":"2026-11-07T23:20Z-pool-reaction-20","contributionId":"pool-reaction-20","role":"B — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-reaction-21.json` — {"agentId":"buffy","turnId":"2026-11-07T23:21Z-pool-reaction-21","contributionId":"pool-reaction-21","role":"B — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-reaction-22.json` — {"agentId":"buffy","turnId":"2026-11-07T23:22Z-pool-reaction-22","contributionId":"pool-reaction-22","role":"B — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-reaction-23.json` — {"agentId":"buffy","turnId":"2026-11-07T23:23Z-pool-reaction-23","contributionId":"pool-reaction-23","role":"B — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-reaction-24.json` — {"agentId":"buffy","turnId":"2026-11-07T23:24Z-pool-reaction-24","contributionId":"pool-reaction-24","role":"B — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-reaction-25.json` — {"agentId":"buffy","turnId":"2026-11-07T23:25Z-pool-reaction-25","contributionId":"pool-reaction-25","role":"B — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-reaction-26.json` — {"agentId":"buffy","turnId":"2026-11-07T23:26Z-pool-reaction-26","contributionId":"pool-reaction-26","role":"B — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-reaction-27.json` — {"agentId":"buffy","turnId":"2026-11-07T23:27Z-pool-reaction-27","contributionId":"pool-reaction-27","role":"B — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-reaction-28.json` — {"agentId":"buffy","turnId":"2026-11-07T23:28Z-pool-reaction-28","contributionId":"pool-reaction-28","role":"B — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-reaction-29.json` — {"agentId":"buffy","turnId":"2026-11-07T23:29Z-pool-reaction-29","contributionId":"pool-reaction-29","role":"B — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-reaction-30.json` — {"agentId":"buffy","turnId":"2026-11-07T23:30Z-pool-reaction-30","contributionId":"pool-reaction-30","role":"B — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-reaction-31.json` — {"agentId":"buffy","turnId":"2026-11-07T23:31Z-pool-reaction-31","contributionId":"pool-reaction-31","role":"B — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-reaction-32.json` — {"agentId":"buffy","turnId":"2026-11-07T23:32Z-pool-reaction-32","contributionId":"pool-reaction-32","role":"B — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-reaction-33.json` — {"agentId":"buffy","turnId":"2026-11-07T23:33Z-pool-reaction-33","contributionId":"pool-reaction-33","role":"B — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-reaction-34.json` — {"agentId":"buffy","turnId":"2026-11-07T23:34Z-pool-reaction-34","contributionId":"pool-reaction-34","role":"B — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-reaction-35.json` — {"agentId":"buffy","turnId":"2026-11-07T23:35Z-pool-reaction-35","contributionId":"pool-reaction-35","role":"B — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-reaction-36.json` — {"agentId":"buffy","turnId":"2026-11-07T23:36Z-pool-reaction-36","contributionId":"pool-reaction-36","role":"B — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-reaction-37.json` — {"agentId":"buffy","turnId":"2026-11-07T23:37Z-pool-reaction-37","contributionId":"pool-reaction-37","role":"B — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-reaction-38.json` — {"agentId":"buffy","turnId":"2026-11-07T23:38Z-pool-reaction-38","contributionId":"pool-reaction-38","role":"B — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-reaction-39.json` — {"agentId":"buffy","turnId":"2026-11-07T23:39Z-pool-reaction-39","contributionId":"pool-reaction-39","role":"B — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-reaction-40.json` — {"agentId":"buffy","turnId":"2026-11-07T23:40Z-pool-reaction-40","contributionId":"pool-reaction-40","role":"B — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-reaction-41.json` — {"agentId":"buffy","turnId":"2026-11-07T23:41Z-pool-reaction-41","contributionId":"pool-reaction-41","role":"B — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-reaction-42.json` — {"agentId":"buffy","turnId":"2026-11-07T23:42Z-pool-reaction-42","contributionId":"pool-reaction-42","role":"B — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-reaction-43.json` — {"agentId":"buffy","turnId":"2026-11-07T23:43Z-pool-reaction-43","contributionId":"pool-reaction-43","role":"B — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-reaction-44.json` — {"agentId":"buffy","turnId":"2026-11-07T23:44Z-pool-reaction-44","contributionId":"pool-reaction-44","role":"B — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-reaction-45.json` — {"agentId":"buffy","turnId":"2026-11-07T23:45Z-pool-reaction-45","contributionId":"pool-reaction-45","role":"B — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-reaction-46.json` — {"agentId":"buffy","turnId":"2026-11-07T23:46Z-pool-reaction-46","contributionId":"pool-reaction-46","role":"B — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-reaction-47.json` — {"agentId":"buffy","turnId":"2026-11-07T23:47Z-pool-reaction-47","contributionId":"pool-reaction-47","role":"B — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-reaction-48.json` — {"agentId":"buffy","turnId":"2026-11-07T23:48Z-pool-reaction-48","contributionId":"pool-reaction-48","role":"B — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-reaction-49.json` — {"agentId":"buffy","turnId":"2026-11-07T23:49Z-pool-reaction-49","contributionId":"pool-reaction-49","role":"B — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-reaction-50.json` — {"agentId":"buffy","turnId":"2026-11-07T23:50Z-pool-reaction-50","contributionId":"pool-reaction-50","role":"B — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-rumor-01.json` — {"agentId":"buffy","turnId":"2026-11-07T23:01Z-pool-rumor-01","contributionId":"pool-rumor-01","role":"BEOBACH — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-rumor-02.json` — {"agentId":"buffy","turnId":"2026-11-07T23:02Z-pool-rumor-02","contributionId":"pool-rumor-02","role":"BEOBACH — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-rumor-03.json` — {"agentId":"buffy","turnId":"2026-11-07T23:03Z-pool-rumor-03","contributionId":"pool-rumor-03","role":"BEOBACH — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-rumor-04.json` — {"agentId":"buffy","turnId":"2026-11-07T23:04Z-pool-rumor-04","contributionId":"pool-rumor-04","role":"BEOBACH — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-rumor-05.json` — {"agentId":"buffy","turnId":"2026-11-07T23:05Z-pool-rumor-05","contributionId":"pool-rumor-05","role":"BEOBACH — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-rumor-06.json` — {"agentId":"buffy","turnId":"2026-11-07T23:06Z-pool-rumor-06","contributionId":"pool-rumor-06","role":"BEOBACH — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-rumor-07.json` — {"agentId":"buffy","turnId":"2026-11-07T23:07Z-pool-rumor-07","contributionId":"pool-rumor-07","role":"BEOBACH — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-rumor-08.json` — {"agentId":"buffy","turnId":"2026-11-07T23:08Z-pool-rumor-08","contributionId":"pool-rumor-08","role":"BEOBACH — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-rumor-09.json` — {"agentId":"buffy","turnId":"2026-11-07T23:09Z-pool-rumor-09","contributionId":"pool-rumor-09","role":"BEOBACH — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-rumor-10.json` — {"agentId":"buffy","turnId":"2026-11-07T23:10Z-pool-rumor-10","contributionId":"pool-rumor-10","role":"BEOBACH — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-rumor-11.json` — {"agentId":"buffy","turnId":"2026-11-07T23:11Z-pool-rumor-11","contributionId":"pool-rumor-11","role":"BEOBACH — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-rumor-12.json` — {"agentId":"buffy","turnId":"2026-11-07T23:12Z-pool-rumor-12","contributionId":"pool-rumor-12","role":"BEOBACH — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-rumor-13.json` — {"agentId":"buffy","turnId":"2026-11-07T23:13Z-pool-rumor-13","contributionId":"pool-rumor-13","role":"BEOBACH — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-rumor-14.json` — {"agentId":"buffy","turnId":"2026-11-07T23:14Z-pool-rumor-14","contributionId":"pool-rumor-14","role":"BEOBACH — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-rumor-15.json` — {"agentId":"buffy","turnId":"2026-11-07T23:15Z-pool-rumor-15","contributionId":"pool-rumor-15","role":"BEOBACH — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-rumor-16.json` — {"agentId":"buffy","turnId":"2026-11-07T23:16Z-pool-rumor-16","contributionId":"pool-rumor-16","role":"BEOBACH — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-rumor-17.json` — {"agentId":"buffy","turnId":"2026-11-07T23:17Z-pool-rumor-17","contributionId":"pool-rumor-17","role":"BEOBACH — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-rumor-18.json` — {"agentId":"buffy","turnId":"2026-11-07T23:18Z-pool-rumor-18","contributionId":"pool-rumor-18","role":"BEOBACH — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-rumor-19.json` — {"agentId":"buffy","turnId":"2026-11-07T23:19Z-pool-rumor-19","contributionId":"pool-rumor-19","role":"BEOBACH — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-rumor-20.json` — {"agentId":"buffy","turnId":"2026-11-07T23:20Z-pool-rumor-20","contributionId":"pool-rumor-20","role":"BEOBACH — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-rumor-21.json` — {"agentId":"buffy","turnId":"2026-11-07T23:21Z-pool-rumor-21","contributionId":"pool-rumor-21","role":"BEOBACH — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-rumor-22.json` — {"agentId":"buffy","turnId":"2026-11-07T23:22Z-pool-rumor-22","contributionId":"pool-rumor-22","role":"BEOBACH — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-rumor-23.json` — {"agentId":"buffy","turnId":"2026-11-07T23:23Z-pool-rumor-23","contributionId":"pool-rumor-23","role":"BEOBACH — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-rumor-24.json` — {"agentId":"buffy","turnId":"2026-11-07T23:24Z-pool-rumor-24","contributionId":"pool-rumor-24","role":"BEOBACH — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-rumor-25.json` — {"agentId":"buffy","turnId":"2026-11-07T23:25Z-pool-rumor-25","contributionId":"pool-rumor-25","role":"BEOBACH — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-rumor-26.json` — {"agentId":"buffy","turnId":"2026-11-07T23:26Z-pool-rumor-26","contributionId":"pool-rumor-26","role":"BEOBACH — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-rumor-27.json` — {"agentId":"buffy","turnId":"2026-11-07T23:27Z-pool-rumor-27","contributionId":"pool-rumor-27","role":"BEOBACH — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-rumor-28.json` — {"agentId":"buffy","turnId":"2026-11-07T23:28Z-pool-rumor-28","contributionId":"pool-rumor-28","role":"BEOBACH — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-rumor-29.json` — {"agentId":"buffy","turnId":"2026-11-07T23:29Z-pool-rumor-29","contributionId":"pool-rumor-29","role":"BEOBACH — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-rumor-30.json` — {"agentId":"buffy","turnId":"2026-11-07T23:30Z-pool-rumor-30","contributionId":"pool-rumor-30","role":"BEOBACH — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-rumor-31.json` — {"agentId":"buffy","turnId":"2026-11-07T23:31Z-pool-rumor-31","contributionId":"pool-rumor-31","role":"BEOBACH — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-rumor-32.json` — {"agentId":"buffy","turnId":"2026-11-07T23:32Z-pool-rumor-32","contributionId":"pool-rumor-32","role":"BEOBACH — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-rumor-33.json` — {"agentId":"buffy","turnId":"2026-11-07T23:33Z-pool-rumor-33","contributionId":"pool-rumor-33","role":"BEOBACH — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-rumor-34.json` — {"agentId":"buffy","turnId":"2026-11-07T23:34Z-pool-rumor-34","contributionId":"pool-rumor-34","role":"BEOBACH — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-rumor-35.json` — {"agentId":"buffy","turnId":"2026-11-07T23:35Z-pool-rumor-35","contributionId":"pool-rumor-35","role":"BEOBACH — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-rumor-36.json` — {"agentId":"buffy","turnId":"2026-11-07T23:36Z-pool-rumor-36","contributionId":"pool-rumor-36","role":"BEOBACH — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-rumor-37.json` — {"agentId":"buffy","turnId":"2026-11-07T23:37Z-pool-rumor-37","contributionId":"pool-rumor-37","role":"BEOBACH — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-rumor-38.json` — {"agentId":"buffy","turnId":"2026-11-07T23:38Z-pool-rumor-38","contributionId":"pool-rumor-38","role":"BEOBACH — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-rumor-39.json` — {"agentId":"buffy","turnId":"2026-11-07T23:39Z-pool-rumor-39","contributionId":"pool-rumor-39","role":"BEOBACH — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-rumor-40.json` — {"agentId":"buffy","turnId":"2026-11-07T23:40Z-pool-rumor-40","contributionId":"pool-rumor-40","role":"BEOBACH — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-rumor-41.json` — {"agentId":"buffy","turnId":"2026-11-07T23:41Z-pool-rumor-41","contributionId":"pool-rumor-41","role":"BEOBACH — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-rumor-42.json` — {"agentId":"buffy","turnId":"2026-11-07T23:42Z-pool-rumor-42","contributionId":"pool-rumor-42","role":"BEOBACH — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-rumor-43.json` — {"agentId":"buffy","turnId":"2026-11-07T23:43Z-pool-rumor-43","contributionId":"pool-rumor-43","role":"BEOBACH — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-rumor-44.json` — {"agentId":"buffy","turnId":"2026-11-07T23:44Z-pool-rumor-44","contributionId":"pool-rumor-44","role":"BEOBACH — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-rumor-45.json` — {"agentId":"buffy","turnId":"2026-11-07T23:45Z-pool-rumor-45","contributionId":"pool-rumor-45","role":"BEOBACH — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-rumor-46.json` — {"agentId":"buffy","turnId":"2026-11-07T23:46Z-pool-rumor-46","contributionId":"pool-rumor-46","role":"BEOBACH — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-rumor-47.json` — {"agentId":"buffy","turnId":"2026-11-07T23:47Z-pool-rumor-47","contributionId":"pool-rumor-47","role":"BEOBACH — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-rumor-48.json` — {"agentId":"buffy","turnId":"2026-11-07T23:48Z-pool-rumor-48","contributionId":"pool-rumor-48","role":"BEOBACH — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-rumor-49.json` — {"agentId":"buffy","turnId":"2026-11-07T23:49Z-pool-rumor-49","contributionId":"pool-rumor-49","role":"BEOBACH — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-07-pool-rumor-50.json` — {"agentId":"buffy","turnId":"2026-11-07T23:50Z-pool-rumor-50","contributionId":"pool-rumor-50","role":"BEOBACH — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-chain-echo-body.json` — {"agentId":"buffy","turnId":"2026-11-08T09:11Z-chain-echo-body","contributionId":"chain-echo-body-01","role":" — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-chain-echo-choice.json` — {"agentId":"buffy","turnId":"2026-11-08T09:12Z-chain-echo-choice","contributionId":"chain-echo-choice-01","rol — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-chain-echo-opening.json` — {"agentId":"buffy","turnId":"2026-11-08T09:10Z-chain-echo-opening","contributionId":"chain-echo-opening-01","r — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-chain-echo-reaction.json` — {"agentId":"buffy","turnId":"2026-11-08T09:13Z-chain-echo-reaction","contributionId":"chain-echo-reaction-01", — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-city-night-01.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-night-02.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-night-03.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-night-04.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-night-05.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-night-06.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-night-07.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-night-08.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-night-09.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-night-10.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-night-11.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-night-12.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-night-13.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-night-14.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-night-15.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-night-16.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-night-17.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-night-18.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-night-19.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-night-20.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-night-21.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-night-22.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-night-23.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-night-24.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-night-25.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-night-26.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-night-27.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-night-28.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-night-29.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-night-30.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-night-31.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-night-32.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-night-33.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-night-34.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-night-35.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-night-36.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-night-37.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-night-38.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-night-39.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-night-40.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-night-41.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-night-42.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-night-43.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-night-44.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-night-45.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-night-46.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-night-47.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-night-48.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-night-49.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-night-50.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-night-51.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-night-52.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-scene-01.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-scene-02.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-scene-03.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-scene-04.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-scene-05.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-scene-06.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-scene-07.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-scene-08.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-scene-09.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-scene-10.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-scene-11.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-scene-12.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-scene-13.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-scene-14.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-scene-15.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-scene-16.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-scene-17.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-scene-18.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-scene-19.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-scene-20.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-scene-21.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-scene-22.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-scene-23.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-scene-24.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-scene-25.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-scene-26.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-scene-27.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-scene-28.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-scene-29.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-scene-30.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-scene-31.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-scene-32.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-scene-33.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-scene-34.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-scene-35.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-scene-36.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-scene-37.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-scene-38.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-scene-39.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-scene-40.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-scene-41.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-scene-42.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-scene-43.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-scene-44.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-scene-45.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-scene-46.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-scene-47.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-scene-48.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-scene-49.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-scene-50.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-scene-51.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-scene-52.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-city-scene-53.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-gate-lane-red-team-01.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-guest-voice-mid-51.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-influence-matrix-01.json` — {"agentId":"buffy","turnId":"2026-11-08T04:30Z-influence-matrix","contributionId":"influence-matrix-01","role" — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-knowledge-chain-01.json` — {"agentId":"buffy","turnId":"2026-11-08T04:45Z-knowledge-chain","contributionId":"knowledge-chain-01","role":" — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-knowledge-domain-01.json` — {"agentId":"buffy","turnId":"2026-11-08T05:15Z-knowledge-domain","contributionId":"knowledge-domain-01","role" — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-loc-trim-01.json` — {"agentId":"buffy","turnId":"2026-11-08T04:50Z-loc-trim","contributionId":"loc-trim-01","role":"BEOBACHTER","l — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-main-event-pool-01.json` — {"agentId":"buffy","turnId":"2026-11-08T06:40Z-main-event-pool","contributionId":"main-event-pool-01","role":" — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-main-event-pool-02.json` — {"agentId":"buffy","turnId":"2026-11-08T06:41Z-main-event-pool","contributionId":"main-event-pool-02","role":" — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-main-event-pool-03.json` — {"agentId":"buffy","turnId":"2026-11-08T06:42Z-main-event-pool","contributionId":"main-event-pool-03","role":" — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-memory-53.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-player-cash-closeout-01.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-pool-choice-preview-51.json` — {"agentId":"buffy","turnId":"2026-11-08T00:10Z-pool-choice-preview-51","contributionId":"pool-choice-preview-5 — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-choice-preview-52.json` — {"agentId":"buffy","turnId":"2026-11-08T00:20Z-pool-choice-preview-52","contributionId":"pool-choice-preview-5 — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-description-51.json` — {"agentId":"buffy","turnId":"2026-11-08T00:10Z-pool-description-51","contributionId":"pool-description-51","ro — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-description-52.json` — {"agentId":"buffy","turnId":"2026-11-08T00:20Z-pool-description-52","contributionId":"pool-description-52","ro — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-documentation-51.json` — {"agentId":"buffy","turnId":"2026-11-08T00:10Z-pool-documentation-51","contributionId":"pool-documentation-51" — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-documentation-52.json` — {"agentId":"buffy","turnId":"2026-11-08T00:20Z-pool-documentation-52","contributionId":"pool-documentation-52" — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-event-body-51.json` — {"agentId":"buffy","turnId":"2026-11-08T00:10Z-pool-event-body-51","contributionId":"pool-event-body-51","role — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-event-body-52.json` — {"agentId":"buffy","turnId":"2026-11-08T00:20Z-pool-event-body-52","contributionId":"pool-event-body-52","role — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-high-01.json` — {"agentId":"buffy","turnId":"2026-11-08T05:40Z-pool-guest-voice-high-01","contributionId":"pool-guest-voice-hi — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-high-02.json` — {"agentId":"buffy","turnId":"2026-11-08T05:41Z-pool-guest-voice-high-02","contributionId":"pool-guest-voice-hi — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-high-03.json` — {"agentId":"buffy","turnId":"2026-11-08T05:42Z-pool-guest-voice-high-03","contributionId":"pool-guest-voice-hi — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-high-04.json` — {"agentId":"buffy","turnId":"2026-11-08T05:43Z-pool-guest-voice-high-04","contributionId":"pool-guest-voice-hi — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-high-05.json` — {"agentId":"buffy","turnId":"2026-11-08T05:44Z-pool-guest-voice-high-05","contributionId":"pool-guest-voice-hi — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-high-06.json` — {"agentId":"buffy","turnId":"2026-11-08T05:45Z-pool-guest-voice-high-06","contributionId":"pool-guest-voice-hi — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-high-07.json` — {"agentId":"buffy","turnId":"2026-11-08T05:46Z-pool-guest-voice-high-07","contributionId":"pool-guest-voice-hi — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-high-08.json` — {"agentId":"buffy","turnId":"2026-11-08T05:47Z-pool-guest-voice-high-08","contributionId":"pool-guest-voice-hi — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-high-09.json` — {"agentId":"buffy","turnId":"2026-11-08T05:48Z-pool-guest-voice-high-09","contributionId":"pool-guest-voice-hi — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-high-10.json` — {"agentId":"buffy","turnId":"2026-11-08T05:49Z-pool-guest-voice-high-10","contributionId":"pool-guest-voice-hi — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-high-11.json` — {"agentId":"buffy","turnId":"2026-11-08T05:50Z-pool-guest-voice-high-11","contributionId":"pool-guest-voice-hi — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-high-12.json` — {"agentId":"buffy","turnId":"2026-11-08T05:51Z-pool-guest-voice-high-12","contributionId":"pool-guest-voice-hi — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-high-13.json` — {"agentId":"buffy","turnId":"2026-11-08T05:52Z-pool-guest-voice-high-13","contributionId":"pool-guest-voice-hi — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-high-14.json` — {"agentId":"buffy","turnId":"2026-11-08T05:53Z-pool-guest-voice-high-14","contributionId":"pool-guest-voice-hi — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-high-15.json` — {"agentId":"buffy","turnId":"2026-11-08T05:54Z-pool-guest-voice-high-15","contributionId":"pool-guest-voice-hi — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-high-16.json` — {"agentId":"buffy","turnId":"2026-11-08T05:55Z-pool-guest-voice-high-16","contributionId":"pool-guest-voice-hi — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-high-17.json` — {"agentId":"buffy","turnId":"2026-11-08T05:56Z-pool-guest-voice-high-17","contributionId":"pool-guest-voice-hi — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-high-18.json` — {"agentId":"buffy","turnId":"2026-11-08T05:57Z-pool-guest-voice-high-18","contributionId":"pool-guest-voice-hi — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-high-19.json` — {"agentId":"buffy","turnId":"2026-11-08T05:58Z-pool-guest-voice-high-19","contributionId":"pool-guest-voice-hi — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-high-20.json` — {"agentId":"buffy","turnId":"2026-11-08T05:59Z-pool-guest-voice-high-20","contributionId":"pool-guest-voice-hi — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-high-21.json` — {"agentId":"buffy","turnId":"2026-11-08T05:00Z-pool-guest-voice-high-21","contributionId":"pool-guest-voice-hi — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-high-22.json` — {"agentId":"buffy","turnId":"2026-11-08T05:01Z-pool-guest-voice-high-22","contributionId":"pool-guest-voice-hi — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-high-23.json` — {"agentId":"buffy","turnId":"2026-11-08T05:02Z-pool-guest-voice-high-23","contributionId":"pool-guest-voice-hi — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-high-24.json` — {"agentId":"buffy","turnId":"2026-11-08T05:03Z-pool-guest-voice-high-24","contributionId":"pool-guest-voice-hi — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-high-25.json` — {"agentId":"buffy","turnId":"2026-11-08T05:04Z-pool-guest-voice-high-25","contributionId":"pool-guest-voice-hi — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-high-26.json` — {"agentId":"buffy","turnId":"2026-11-08T05:05Z-pool-guest-voice-high-26","contributionId":"pool-guest-voice-hi — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-high-27.json` — {"agentId":"buffy","turnId":"2026-11-08T05:06Z-pool-guest-voice-high-27","contributionId":"pool-guest-voice-hi — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-high-28.json` — {"agentId":"buffy","turnId":"2026-11-08T05:07Z-pool-guest-voice-high-28","contributionId":"pool-guest-voice-hi — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-high-29.json` — {"agentId":"buffy","turnId":"2026-11-08T05:08Z-pool-guest-voice-high-29","contributionId":"pool-guest-voice-hi — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-high-30.json` — {"agentId":"buffy","turnId":"2026-11-08T05:09Z-pool-guest-voice-high-30","contributionId":"pool-guest-voice-hi — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-high-31.json` — {"agentId":"buffy","turnId":"2026-11-08T05:10Z-pool-guest-voice-high-31","contributionId":"pool-guest-voice-hi — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-high-32.json` — {"agentId":"buffy","turnId":"2026-11-08T05:11Z-pool-guest-voice-high-32","contributionId":"pool-guest-voice-hi — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-high-33.json` — {"agentId":"buffy","turnId":"2026-11-08T05:12Z-pool-guest-voice-high-33","contributionId":"pool-guest-voice-hi — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-high-34.json` — {"agentId":"buffy","turnId":"2026-11-08T05:13Z-pool-guest-voice-high-34","contributionId":"pool-guest-voice-hi — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-high-35.json` — {"agentId":"buffy","turnId":"2026-11-08T05:14Z-pool-guest-voice-high-35","contributionId":"pool-guest-voice-hi — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-high-36.json` — {"agentId":"buffy","turnId":"2026-11-08T05:15Z-pool-guest-voice-high-36","contributionId":"pool-guest-voice-hi — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-high-37.json` — {"agentId":"buffy","turnId":"2026-11-08T05:16Z-pool-guest-voice-high-37","contributionId":"pool-guest-voice-hi — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-high-38.json` — {"agentId":"buffy","turnId":"2026-11-08T05:17Z-pool-guest-voice-high-38","contributionId":"pool-guest-voice-hi — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-high-39.json` — {"agentId":"buffy","turnId":"2026-11-08T05:18Z-pool-guest-voice-high-39","contributionId":"pool-guest-voice-hi — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-high-40.json` — {"agentId":"buffy","turnId":"2026-11-08T05:19Z-pool-guest-voice-high-40","contributionId":"pool-guest-voice-hi — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-high-41.json` — {"agentId":"buffy","turnId":"2026-11-08T05:20Z-pool-guest-voice-high-41","contributionId":"pool-guest-voice-hi — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-high-42.json` — {"agentId":"buffy","turnId":"2026-11-08T05:21Z-pool-guest-voice-high-42","contributionId":"pool-guest-voice-hi — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-high-43.json` — {"agentId":"buffy","turnId":"2026-11-08T05:22Z-pool-guest-voice-high-43","contributionId":"pool-guest-voice-hi — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-high-44.json` — {"agentId":"buffy","turnId":"2026-11-08T05:23Z-pool-guest-voice-high-44","contributionId":"pool-guest-voice-hi — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-high-45.json` — {"agentId":"buffy","turnId":"2026-11-08T05:24Z-pool-guest-voice-high-45","contributionId":"pool-guest-voice-hi — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-high-46.json` — {"agentId":"buffy","turnId":"2026-11-08T05:25Z-pool-guest-voice-high-46","contributionId":"pool-guest-voice-hi — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-high-47.json` — {"agentId":"buffy","turnId":"2026-11-08T05:26Z-pool-guest-voice-high-47","contributionId":"pool-guest-voice-hi — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-high-48.json` — {"agentId":"buffy","turnId":"2026-11-08T05:27Z-pool-guest-voice-high-48","contributionId":"pool-guest-voice-hi — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-high-49.json` — {"agentId":"buffy","turnId":"2026-11-08T05:28Z-pool-guest-voice-high-49","contributionId":"pool-guest-voice-hi — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-high-50.json` — {"agentId":"buffy","turnId":"2026-11-08T05:29Z-pool-guest-voice-high-50","contributionId":"pool-guest-voice-hi — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-low-01.json` — {"agentId":"buffy","turnId":"2026-11-08T05:00Z-pool-guest-voice-low-01","contributionId":"pool-guest-voice-low — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-low-02.json` — {"agentId":"buffy","turnId":"2026-11-08T05:01Z-pool-guest-voice-low-02","contributionId":"pool-guest-voice-low — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-low-03.json` — {"agentId":"buffy","turnId":"2026-11-08T05:02Z-pool-guest-voice-low-03","contributionId":"pool-guest-voice-low — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-low-04.json` — {"agentId":"buffy","turnId":"2026-11-08T05:03Z-pool-guest-voice-low-04","contributionId":"pool-guest-voice-low — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-low-05.json` — {"agentId":"buffy","turnId":"2026-11-08T05:04Z-pool-guest-voice-low-05","contributionId":"pool-guest-voice-low — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-low-06.json` — {"agentId":"buffy","turnId":"2026-11-08T05:05Z-pool-guest-voice-low-06","contributionId":"pool-guest-voice-low — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-low-07.json` — {"agentId":"buffy","turnId":"2026-11-08T05:06Z-pool-guest-voice-low-07","contributionId":"pool-guest-voice-low — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-low-08.json` — {"agentId":"buffy","turnId":"2026-11-08T05:07Z-pool-guest-voice-low-08","contributionId":"pool-guest-voice-low — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-low-09.json` — {"agentId":"buffy","turnId":"2026-11-08T05:08Z-pool-guest-voice-low-09","contributionId":"pool-guest-voice-low — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-low-10.json` — {"agentId":"buffy","turnId":"2026-11-08T05:09Z-pool-guest-voice-low-10","contributionId":"pool-guest-voice-low — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-low-11.json` — {"agentId":"buffy","turnId":"2026-11-08T05:10Z-pool-guest-voice-low-11","contributionId":"pool-guest-voice-low — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-low-12.json` — {"agentId":"buffy","turnId":"2026-11-08T05:11Z-pool-guest-voice-low-12","contributionId":"pool-guest-voice-low — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-low-13.json` — {"agentId":"buffy","turnId":"2026-11-08T05:12Z-pool-guest-voice-low-13","contributionId":"pool-guest-voice-low — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-low-14.json` — {"agentId":"buffy","turnId":"2026-11-08T05:13Z-pool-guest-voice-low-14","contributionId":"pool-guest-voice-low — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-low-15.json` — {"agentId":"buffy","turnId":"2026-11-08T05:14Z-pool-guest-voice-low-15","contributionId":"pool-guest-voice-low — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-low-16.json` — {"agentId":"buffy","turnId":"2026-11-08T05:15Z-pool-guest-voice-low-16","contributionId":"pool-guest-voice-low — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-low-17.json` — {"agentId":"buffy","turnId":"2026-11-08T05:16Z-pool-guest-voice-low-17","contributionId":"pool-guest-voice-low — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-low-18.json` — {"agentId":"buffy","turnId":"2026-11-08T05:17Z-pool-guest-voice-low-18","contributionId":"pool-guest-voice-low — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-low-19.json` — {"agentId":"buffy","turnId":"2026-11-08T05:18Z-pool-guest-voice-low-19","contributionId":"pool-guest-voice-low — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-low-20.json` — {"agentId":"buffy","turnId":"2026-11-08T05:19Z-pool-guest-voice-low-20","contributionId":"pool-guest-voice-low — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-low-21.json` — {"agentId":"buffy","turnId":"2026-11-08T05:20Z-pool-guest-voice-low-21","contributionId":"pool-guest-voice-low — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-low-22.json` — {"agentId":"buffy","turnId":"2026-11-08T05:21Z-pool-guest-voice-low-22","contributionId":"pool-guest-voice-low — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-low-23.json` — {"agentId":"buffy","turnId":"2026-11-08T05:22Z-pool-guest-voice-low-23","contributionId":"pool-guest-voice-low — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-low-24.json` — {"agentId":"buffy","turnId":"2026-11-08T05:23Z-pool-guest-voice-low-24","contributionId":"pool-guest-voice-low — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-low-25.json` — {"agentId":"buffy","turnId":"2026-11-08T05:24Z-pool-guest-voice-low-25","contributionId":"pool-guest-voice-low — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-low-26.json` — {"agentId":"buffy","turnId":"2026-11-08T05:25Z-pool-guest-voice-low-26","contributionId":"pool-guest-voice-low — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-low-27.json` — {"agentId":"buffy","turnId":"2026-11-08T05:26Z-pool-guest-voice-low-27","contributionId":"pool-guest-voice-low — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-low-28.json` — {"agentId":"buffy","turnId":"2026-11-08T05:27Z-pool-guest-voice-low-28","contributionId":"pool-guest-voice-low — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-low-29.json` — {"agentId":"buffy","turnId":"2026-11-08T05:28Z-pool-guest-voice-low-29","contributionId":"pool-guest-voice-low — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-low-30.json` — {"agentId":"buffy","turnId":"2026-11-08T05:29Z-pool-guest-voice-low-30","contributionId":"pool-guest-voice-low — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-low-31.json` — {"agentId":"buffy","turnId":"2026-11-08T05:30Z-pool-guest-voice-low-31","contributionId":"pool-guest-voice-low — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-low-32.json` — {"agentId":"buffy","turnId":"2026-11-08T05:31Z-pool-guest-voice-low-32","contributionId":"pool-guest-voice-low — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-low-33.json` — {"agentId":"buffy","turnId":"2026-11-08T05:32Z-pool-guest-voice-low-33","contributionId":"pool-guest-voice-low — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-low-34.json` — {"agentId":"buffy","turnId":"2026-11-08T05:33Z-pool-guest-voice-low-34","contributionId":"pool-guest-voice-low — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-low-35.json` — {"agentId":"buffy","turnId":"2026-11-08T05:34Z-pool-guest-voice-low-35","contributionId":"pool-guest-voice-low — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-low-36.json` — {"agentId":"buffy","turnId":"2026-11-08T05:35Z-pool-guest-voice-low-36","contributionId":"pool-guest-voice-low — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-low-37.json` — {"agentId":"buffy","turnId":"2026-11-08T05:36Z-pool-guest-voice-low-37","contributionId":"pool-guest-voice-low — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-low-38.json` — {"agentId":"buffy","turnId":"2026-11-08T05:37Z-pool-guest-voice-low-38","contributionId":"pool-guest-voice-low — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-low-39.json` — {"agentId":"buffy","turnId":"2026-11-08T05:38Z-pool-guest-voice-low-39","contributionId":"pool-guest-voice-low — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-low-40.json` — {"agentId":"buffy","turnId":"2026-11-08T05:39Z-pool-guest-voice-low-40","contributionId":"pool-guest-voice-low — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-low-41.json` — {"agentId":"buffy","turnId":"2026-11-08T05:40Z-pool-guest-voice-low-41","contributionId":"pool-guest-voice-low — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-low-42.json` — {"agentId":"buffy","turnId":"2026-11-08T05:41Z-pool-guest-voice-low-42","contributionId":"pool-guest-voice-low — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-low-43.json` — {"agentId":"buffy","turnId":"2026-11-08T05:42Z-pool-guest-voice-low-43","contributionId":"pool-guest-voice-low — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-low-44.json` — {"agentId":"buffy","turnId":"2026-11-08T05:43Z-pool-guest-voice-low-44","contributionId":"pool-guest-voice-low — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-low-45.json` — {"agentId":"buffy","turnId":"2026-11-08T05:44Z-pool-guest-voice-low-45","contributionId":"pool-guest-voice-low — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-low-46.json` — {"agentId":"buffy","turnId":"2026-11-08T05:45Z-pool-guest-voice-low-46","contributionId":"pool-guest-voice-low — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-low-47.json` — {"agentId":"buffy","turnId":"2026-11-08T05:46Z-pool-guest-voice-low-47","contributionId":"pool-guest-voice-low — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-low-48.json` — {"agentId":"buffy","turnId":"2026-11-08T05:47Z-pool-guest-voice-low-48","contributionId":"pool-guest-voice-low — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-low-49.json` — {"agentId":"buffy","turnId":"2026-11-08T05:48Z-pool-guest-voice-low-49","contributionId":"pool-guest-voice-low — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-low-50.json` — {"agentId":"buffy","turnId":"2026-11-08T05:49Z-pool-guest-voice-low-50","contributionId":"pool-guest-voice-low — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-low-51.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-mid-01.json` — {"agentId":"buffy","turnId":"2026-11-08T05:50Z-pool-guest-voice-mid-01","contributionId":"pool-guest-voice-mid — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-mid-02.json` — {"agentId":"buffy","turnId":"2026-11-08T05:51Z-pool-guest-voice-mid-02","contributionId":"pool-guest-voice-mid — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-mid-03.json` — {"agentId":"buffy","turnId":"2026-11-08T05:52Z-pool-guest-voice-mid-03","contributionId":"pool-guest-voice-mid — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-mid-04.json` — {"agentId":"buffy","turnId":"2026-11-08T05:53Z-pool-guest-voice-mid-04","contributionId":"pool-guest-voice-mid — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-mid-05.json` — {"agentId":"buffy","turnId":"2026-11-08T05:54Z-pool-guest-voice-mid-05","contributionId":"pool-guest-voice-mid — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-mid-06.json` — {"agentId":"buffy","turnId":"2026-11-08T05:55Z-pool-guest-voice-mid-06","contributionId":"pool-guest-voice-mid — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-mid-07.json` — {"agentId":"buffy","turnId":"2026-11-08T05:56Z-pool-guest-voice-mid-07","contributionId":"pool-guest-voice-mid — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-mid-08.json` — {"agentId":"buffy","turnId":"2026-11-08T05:57Z-pool-guest-voice-mid-08","contributionId":"pool-guest-voice-mid — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-mid-09.json` — {"agentId":"buffy","turnId":"2026-11-08T05:58Z-pool-guest-voice-mid-09","contributionId":"pool-guest-voice-mid — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-mid-10.json` — {"agentId":"buffy","turnId":"2026-11-08T05:59Z-pool-guest-voice-mid-10","contributionId":"pool-guest-voice-mid — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-mid-11.json` — {"agentId":"buffy","turnId":"2026-11-08T05:00Z-pool-guest-voice-mid-11","contributionId":"pool-guest-voice-mid — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-mid-12.json` — {"agentId":"buffy","turnId":"2026-11-08T05:01Z-pool-guest-voice-mid-12","contributionId":"pool-guest-voice-mid — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-mid-13.json` — {"agentId":"buffy","turnId":"2026-11-08T05:02Z-pool-guest-voice-mid-13","contributionId":"pool-guest-voice-mid — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-mid-14.json` — {"agentId":"buffy","turnId":"2026-11-08T05:03Z-pool-guest-voice-mid-14","contributionId":"pool-guest-voice-mid — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-mid-15.json` — {"agentId":"buffy","turnId":"2026-11-08T05:04Z-pool-guest-voice-mid-15","contributionId":"pool-guest-voice-mid — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-mid-16.json` — {"agentId":"buffy","turnId":"2026-11-08T05:05Z-pool-guest-voice-mid-16","contributionId":"pool-guest-voice-mid — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-mid-17.json` — {"agentId":"buffy","turnId":"2026-11-08T05:06Z-pool-guest-voice-mid-17","contributionId":"pool-guest-voice-mid — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-mid-18.json` — {"agentId":"buffy","turnId":"2026-11-08T05:07Z-pool-guest-voice-mid-18","contributionId":"pool-guest-voice-mid — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-mid-19.json` — {"agentId":"buffy","turnId":"2026-11-08T05:08Z-pool-guest-voice-mid-19","contributionId":"pool-guest-voice-mid — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-mid-20.json` — {"agentId":"buffy","turnId":"2026-11-08T05:09Z-pool-guest-voice-mid-20","contributionId":"pool-guest-voice-mid — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-mid-21.json` — {"agentId":"buffy","turnId":"2026-11-08T05:10Z-pool-guest-voice-mid-21","contributionId":"pool-guest-voice-mid — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-mid-22.json` — {"agentId":"buffy","turnId":"2026-11-08T05:11Z-pool-guest-voice-mid-22","contributionId":"pool-guest-voice-mid — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-mid-23.json` — {"agentId":"buffy","turnId":"2026-11-08T05:12Z-pool-guest-voice-mid-23","contributionId":"pool-guest-voice-mid — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-mid-24.json` — {"agentId":"buffy","turnId":"2026-11-08T05:13Z-pool-guest-voice-mid-24","contributionId":"pool-guest-voice-mid — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-mid-25.json` — {"agentId":"buffy","turnId":"2026-11-08T05:14Z-pool-guest-voice-mid-25","contributionId":"pool-guest-voice-mid — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-mid-26.json` — {"agentId":"buffy","turnId":"2026-11-08T05:15Z-pool-guest-voice-mid-26","contributionId":"pool-guest-voice-mid — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-mid-27.json` — {"agentId":"buffy","turnId":"2026-11-08T05:16Z-pool-guest-voice-mid-27","contributionId":"pool-guest-voice-mid — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-mid-28.json` — {"agentId":"buffy","turnId":"2026-11-08T05:17Z-pool-guest-voice-mid-28","contributionId":"pool-guest-voice-mid — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-mid-29.json` — {"agentId":"buffy","turnId":"2026-11-08T05:18Z-pool-guest-voice-mid-29","contributionId":"pool-guest-voice-mid — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-mid-30.json` — {"agentId":"buffy","turnId":"2026-11-08T05:19Z-pool-guest-voice-mid-30","contributionId":"pool-guest-voice-mid — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-mid-31.json` — {"agentId":"buffy","turnId":"2026-11-08T05:20Z-pool-guest-voice-mid-31","contributionId":"pool-guest-voice-mid — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-mid-32.json` — {"agentId":"buffy","turnId":"2026-11-08T05:21Z-pool-guest-voice-mid-32","contributionId":"pool-guest-voice-mid — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-mid-33.json` — {"agentId":"buffy","turnId":"2026-11-08T05:22Z-pool-guest-voice-mid-33","contributionId":"pool-guest-voice-mid — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-mid-34.json` — {"agentId":"buffy","turnId":"2026-11-08T05:23Z-pool-guest-voice-mid-34","contributionId":"pool-guest-voice-mid — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-mid-35.json` — {"agentId":"buffy","turnId":"2026-11-08T05:24Z-pool-guest-voice-mid-35","contributionId":"pool-guest-voice-mid — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-mid-36.json` — {"agentId":"buffy","turnId":"2026-11-08T05:25Z-pool-guest-voice-mid-36","contributionId":"pool-guest-voice-mid — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-mid-37.json` — {"agentId":"buffy","turnId":"2026-11-08T05:26Z-pool-guest-voice-mid-37","contributionId":"pool-guest-voice-mid — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-mid-38.json` — {"agentId":"buffy","turnId":"2026-11-08T05:27Z-pool-guest-voice-mid-38","contributionId":"pool-guest-voice-mid — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-mid-39.json` — {"agentId":"buffy","turnId":"2026-11-08T05:28Z-pool-guest-voice-mid-39","contributionId":"pool-guest-voice-mid — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-mid-40.json` — {"agentId":"buffy","turnId":"2026-11-08T05:29Z-pool-guest-voice-mid-40","contributionId":"pool-guest-voice-mid — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-mid-41.json` — {"agentId":"buffy","turnId":"2026-11-08T05:30Z-pool-guest-voice-mid-41","contributionId":"pool-guest-voice-mid — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-mid-42.json` — {"agentId":"buffy","turnId":"2026-11-08T05:31Z-pool-guest-voice-mid-42","contributionId":"pool-guest-voice-mid — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-mid-43.json` — {"agentId":"buffy","turnId":"2026-11-08T05:32Z-pool-guest-voice-mid-43","contributionId":"pool-guest-voice-mid — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-mid-44.json` — {"agentId":"buffy","turnId":"2026-11-08T05:33Z-pool-guest-voice-mid-44","contributionId":"pool-guest-voice-mid — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-mid-45.json` — {"agentId":"buffy","turnId":"2026-11-08T05:34Z-pool-guest-voice-mid-45","contributionId":"pool-guest-voice-mid — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-mid-46.json` — {"agentId":"buffy","turnId":"2026-11-08T05:35Z-pool-guest-voice-mid-46","contributionId":"pool-guest-voice-mid — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-mid-47.json` — {"agentId":"buffy","turnId":"2026-11-08T05:36Z-pool-guest-voice-mid-47","contributionId":"pool-guest-voice-mid — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-mid-48.json` — {"agentId":"buffy","turnId":"2026-11-08T05:37Z-pool-guest-voice-mid-48","contributionId":"pool-guest-voice-mid — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-mid-49.json` — {"agentId":"buffy","turnId":"2026-11-08T05:38Z-pool-guest-voice-mid-49","contributionId":"pool-guest-voice-mid — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-guest-voice-mid-50.json` — {"agentId":"buffy","turnId":"2026-11-08T05:39Z-pool-guest-voice-mid-50","contributionId":"pool-guest-voice-mid — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-memory-51.json` — {"agentId":"buffy","turnId":"2026-11-08T00:10Z-pool-memory-51","contributionId":"pool-memory-51","role":"BEOBA — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-memory-52.json` — {"agentId":"buffy","turnId":"2026-11-08T00:20Z-pool-memory-52","contributionId":"pool-memory-52","role":"BEOBA — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-opening-51.json` — {"agentId":"buffy","turnId":"2026-11-08T00:10Z-pool-opening-51","contributionId":"pool-opening-51","role":"BEO — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-opening-52.json` — {"agentId":"buffy","turnId":"2026-11-08T00:20Z-pool-opening-52","contributionId":"pool-opening-52","role":"BEO — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-reaction-51.json` — {"agentId":"buffy","turnId":"2026-11-08T00:10Z-pool-reaction-51","contributionId":"pool-reaction-51","role":"B — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-reaction-52.json` — {"agentId":"buffy","turnId":"2026-11-08T00:20Z-pool-reaction-52","contributionId":"pool-reaction-52","role":"B — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-rumor-51.json` — {"agentId":"buffy","turnId":"2026-11-08T00:10Z-pool-rumor-51","contributionId":"pool-rumor-51","role":"BEOBACH — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-pool-rumor-52.json` — {"agentId":"buffy","turnId":"2026-11-08T00:20Z-pool-rumor-52","contributionId":"pool-rumor-52","role":"BEOBACH — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-relationship-standing-01.json` — {"agentId":"buffy","turnId":"2026-11-08T03:55Z-relationship-standing","contributionId":"relationship-standing- — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-relationships-coupling-01.json` — {"agentId":"buffy","turnId":"2026-11-08T05:25Z-relationships-coupling","contributionId":"relationships-couplin — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-roadmap-register-01.json` — {"agentId":"buffy","turnId":"2026-11-08T04:20Z-roadmap-register","contributionId":"roadmap-register-01","role" — gelesen: 1 Zeilen
- `content/narrative/contributions/2026-11-08-slot-discharge-fact-01.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-09-apk-signing-01.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-09-audit-findings-01.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-09-city-day-closeout-01.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-09-city-encounter-body.json` — { — gelesen: 23 Zeilen
- `content/narrative/contributions/2026-11-09-city-encounter-decline.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-09-city-encounter-echo-choice.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-09-city-encounter-echo-cold-body.json` — { — gelesen: 23 Zeilen
- `content/narrative/contributions/2026-11-09-city-encounter-echo-cold-opening.json` — { — gelesen: 23 Zeilen
- `content/narrative/contributions/2026-11-09-city-encounter-echo-warm-body.json` — { — gelesen: 23 Zeilen
- `content/narrative/contributions/2026-11-09-city-encounter-echo-warm-opening.json` — { — gelesen: 23 Zeilen
- `content/narrative/contributions/2026-11-09-city-encounter-give.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-09-city-encounter-help.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-09-city-encounter-opening.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-09-dialog-open-01.json` — { — gelesen: 23 Zeilen
- `content/narrative/contributions/2026-11-09-knowledge-belief-01.json` — { — gelesen: 24 Zeilen
- `content/narrative/contributions/2026-11-09-ledger-game-type-01.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-09-loc-gate-01.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-09-loc-gate-02.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-09-logic-safety-payout-01.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-09-nar-aftermath-body-01.json` — { — gelesen: 24 Zeilen
- `content/narrative/contributions/2026-11-09-nar-aftermath-body-02.json` — { — gelesen: 24 Zeilen
- `content/narrative/contributions/2026-11-09-nar-aftermath-choice-01.json` — { — gelesen: 24 Zeilen
- `content/narrative/contributions/2026-11-09-nar-aftermath-choice-02.json` — { — gelesen: 24 Zeilen
- `content/narrative/contributions/2026-11-09-nar-aftermath-title-01.json` — { — gelesen: 24 Zeilen
- `content/narrative/contributions/2026-11-09-nar-aftermath-title-02.json` — { — gelesen: 24 Zeilen
- `content/narrative/contributions/2026-11-09-nar-body-bar-01.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-09-nar-body-bar-02.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-09-nar-body-bar-03.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-09-nar-body-round-01.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-09-nar-body-round-02.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-09-nar-body-round-03.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-09-nar-body-tense-01.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-09-nar-body-tense-02.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-09-nar-body-tense-03.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-09-nar-body-warm-01.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-09-nar-body-warm-02.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-09-nar-echo-body-01.json` — { — gelesen: 25 Zeilen
- `content/narrative/contributions/2026-11-09-nar-echo-body-02.json` — { — gelesen: 25 Zeilen
- `content/narrative/contributions/2026-11-09-nar-echo-choice-01.json` — { — gelesen: 25 Zeilen
- `content/narrative/contributions/2026-11-09-nar-echo-choice-02.json` — { — gelesen: 25 Zeilen
- `content/narrative/contributions/2026-11-09-nar-echo-title-01.json` — { — gelesen: 25 Zeilen
- `content/narrative/contributions/2026-11-09-nar-echo-title-02.json` — { — gelesen: 25 Zeilen
- `content/narrative/contributions/2026-11-09-nar-outcome-aftermath-01.json` — { — gelesen: 24 Zeilen
- `content/narrative/contributions/2026-11-09-nar-outcome-aftermath-02.json` — { — gelesen: 24 Zeilen
- `content/narrative/contributions/2026-11-09-nar-outcome-conflict-01.json` — { — gelesen: 23 Zeilen
- `content/narrative/contributions/2026-11-09-nar-outcome-conflict-02.json` — { — gelesen: 23 Zeilen
- `content/narrative/contributions/2026-11-09-nar-outcome-conflict-03.json` — { — gelesen: 23 Zeilen
- `content/narrative/contributions/2026-11-09-nar-outcome-echo-01.json` — { — gelesen: 25 Zeilen
- `content/narrative/contributions/2026-11-09-nar-outcome-echo-02.json` — { — gelesen: 25 Zeilen
- `content/narrative/contributions/2026-11-09-nar-outcome-return-01.json` — { — gelesen: 26 Zeilen
- `content/narrative/contributions/2026-11-09-nar-outcome-return-02.json` — { — gelesen: 26 Zeilen
- `content/narrative/contributions/2026-11-09-nar-outcome-return-03.json` — { — gelesen: 26 Zeilen
- `content/narrative/contributions/2026-11-09-nar-outcome-rival-01.json` — { — gelesen: 23 Zeilen
- `content/narrative/contributions/2026-11-09-nar-outcome-rival-02.json` — { — gelesen: 23 Zeilen
- `content/narrative/contributions/2026-11-09-nar-outcome-rival-03.json` — { — gelesen: 23 Zeilen
- `content/narrative/contributions/2026-11-09-nar-outcome-warm-01.json` — { — gelesen: 25 Zeilen
- `content/narrative/contributions/2026-11-09-nar-outcome-warm-02.json` — { — gelesen: 25 Zeilen
- `content/narrative/contributions/2026-11-09-nar-title-bar-01.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-09-nar-title-bar-02.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-09-nar-title-bar-03.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-09-nar-title-conflict-01.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-09-nar-title-conflict-02.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-09-nar-title-neon-01.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-09-nar-title-neon-02.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-09-nar-title-rival-01.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-09-nar-title-rival-02.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-09-nar-title-round-01.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-09-nar-title-round-02.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-09-nar-title-round-03.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-09-nar-title-tense-01.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-09-nar-title-tense-02.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-09-nar-title-tense-03.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-09-nar-title-turnier-01.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-09-nar-title-turnier-02.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-09-nar-title-warm-01.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-09-nar-title-warm-02.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-09-nar-var-amb-body-01.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-09-nar-var-amb-body-02.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-09-nar-var-amb-body-03.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-09-nar-var-amb-body-04.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-09-nar-var-amb-body-05.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-09-nar-var-amb-body-06.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-09-nar-var-amb-defuse-01.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-09-nar-var-amb-defuse-02.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-09-nar-var-amb-escalate-01.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-09-nar-var-amb-escalate-02.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-09-nar-var-amb-join-01.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-09-nar-var-amb-join-02.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-09-nar-var-amb-out-defused-01.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-09-nar-var-amb-out-defused-02.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-09-nar-var-amb-out-escalated-01.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-09-nar-var-amb-out-escalated-02.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-09-nar-var-amb-out-joined-01.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-09-nar-var-amb-out-joined-02.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-09-nar-var-amb-out-shared-01.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-09-nar-var-amb-out-shared-02.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-09-nar-var-amb-share-01.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-09-nar-var-amb-share-02.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-09-nar-var-ret-ask-01.json` — { — gelesen: 23 Zeilen
- `content/narrative/contributions/2026-11-09-nar-var-ret-ask-02.json` — { — gelesen: 23 Zeilen
- `content/narrative/contributions/2026-11-09-nar-var-ret-ask-03.json` — { — gelesen: 23 Zeilen
- `content/narrative/contributions/2026-11-09-nar-var-ret-body-01.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-09-nar-var-ret-body-02.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-09-nar-var-ret-body-03.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-09-nar-var-ret-body-04.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-09-nar-var-ret-body-05.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-09-nar-var-ret-body-06.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-09-nar-var-ret-out-asked-01.json` — { — gelesen: 24 Zeilen
- `content/narrative/contributions/2026-11-09-nar-var-ret-out-asked-02.json` — { — gelesen: 24 Zeilen
- `content/narrative/contributions/2026-11-09-nar-var-ret-out-asked-03.json` — { — gelesen: 24 Zeilen
- `content/narrative/contributions/2026-11-09-nar-var-ret-out-welcomed-01.json` — { — gelesen: 24 Zeilen
- `content/narrative/contributions/2026-11-09-nar-var-ret-out-welcomed-02.json` — { — gelesen: 24 Zeilen
- `content/narrative/contributions/2026-11-09-nar-var-ret-out-welcomed-03.json` — { — gelesen: 24 Zeilen
- `content/narrative/contributions/2026-11-09-nar-var-ret-title-01.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-09-nar-var-ret-title-02.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-09-nar-var-ret-title-03.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-09-nar-var-ret-title-04.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-09-nar-var-ret-title-05.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-09-nar-var-ret-welcome-01.json` — { — gelesen: 23 Zeilen
- `content/narrative/contributions/2026-11-09-nar-var-ret-welcome-02.json` — { — gelesen: 23 Zeilen
- `content/narrative/contributions/2026-11-09-nar-var-ret-welcome-03.json` — { — gelesen: 23 Zeilen
- `content/narrative/contributions/2026-11-09-p5-suchtfolge-01.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-09-p6-archiv-01.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-09-phase1-interaction-foundation.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-09-plinko-board-raster-01.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-09-welt-anker-01.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-09-welt-treffer-01.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-09-welt-treffer-02.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-09-world-first-ui-01.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-09-world-first-ui-02.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-10-agent-bootstrap.json` — { — gelesen: 17 Zeilen
- `content/narrative/contributions/2026-11-10-ci-governance-defuse-01.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-10-ci-main-sync.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-10-ci-pr-body-current.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-10-closeout-1.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-10-closeout-2.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-10-closeout-2b.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-10-closeout-3.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-10-closeout-beleg.json` — { — gelesen: 17 Zeilen
- `content/narrative/contributions/2026-11-10-closeout-buchhaltung-1.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-10-closeout-buchhaltung-2.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-10-closeout-buchhaltung-3.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-10-collision-scope.json` — { — gelesen: 24 Zeilen
- `content/narrative/contributions/2026-11-10-company-progression-docs.json` — { — gelesen: 24 Zeilen
- `content/narrative/contributions/2026-11-10-company-progression.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-10-fight-career-tests.json` — { — gelesen: 24 Zeilen
- `content/narrative/contributions/2026-11-10-fight-career.json` — { — gelesen: 24 Zeilen
- `content/narrative/contributions/2026-11-10-first-property.json` — { — gelesen: 24 Zeilen
- `content/narrative/contributions/2026-11-10-floor-work.json` — { — gelesen: 24 Zeilen
- `content/narrative/contributions/2026-11-10-governance-closeout-main-sync.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-10-governance-eine-stimme.json` — { — gelesen: 17 Zeilen
- `content/narrative/contributions/2026-11-10-governance-fail-closed-clean-start.json` — { — gelesen: 17 Zeilen
- `content/narrative/contributions/2026-11-10-governance-fail-closed-isolation-budget.json` — { — gelesen: 17 Zeilen
- `content/narrative/contributions/2026-11-10-governance-fail-closed-issue-check.json` — { — gelesen: 17 Zeilen
- `content/narrative/contributions/2026-11-10-governance-fail-closed-test-quality.json` — { — gelesen: 17 Zeilen
- `content/narrative/contributions/2026-11-10-governance-freeze-merge-base.json` — { — gelesen: 17 Zeilen
- `content/narrative/contributions/2026-11-10-governance-freeze-task-path.json` — { — gelesen: 17 Zeilen
- `content/narrative/contributions/2026-11-10-governance-phase3-ci-state.json` — { — gelesen: 24 Zeilen
- `content/narrative/contributions/2026-11-10-governance-roadmap-count.json` — { — gelesen: 17 Zeilen
- `content/narrative/contributions/2026-11-10-governance-task-vertrag.json` — { — gelesen: 17 Zeilen
- `content/narrative/contributions/2026-11-10-items-gates.json` — { — gelesen: 23 Zeilen
- `content/narrative/contributions/2026-11-10-items-und-synergien.json` — { — gelesen: 19 Zeilen
- `content/narrative/contributions/2026-11-10-machine-hall.json` — { — gelesen: 24 Zeilen
- `content/narrative/contributions/2026-11-10-mod-engine.json` — { — gelesen: 24 Zeilen
- `content/narrative/contributions/2026-11-10-p20-dependency-matrix-01.json` — { — gelesen: 17 Zeilen
- `content/narrative/contributions/2026-11-10-phase34-acceptance-01.json` — { — gelesen: 17 Zeilen
- `content/narrative/contributions/2026-11-10-player-career.json` — { — gelesen: 24 Zeilen
- `content/narrative/contributions/2026-11-10-player-history.json` — { — gelesen: 24 Zeilen
- `content/narrative/contributions/2026-11-10-promote-automerge.json` — { — gelesen: 24 Zeilen
- `content/narrative/contributions/2026-11-10-property-world.json` — { — gelesen: 24 Zeilen
- `content/narrative/contributions/2026-11-10-render-sprite-01.json` — { — gelesen: 17 Zeilen
- `content/narrative/contributions/2026-11-10-renovation.json` — { — gelesen: 24 Zeilen
- `content/narrative/contributions/2026-11-10-review-nachpruefung.json` — { — gelesen: 17 Zeilen
- `content/narrative/contributions/2026-11-10-stale-claims.json` — { — gelesen: 24 Zeilen
- `content/narrative/contributions/2026-11-10-ui-queue-panel.json` — { — gelesen: 24 Zeilen
- `content/narrative/contributions/2026-11-10-world-first-ui-deadcode.json` — { — gelesen: 24 Zeilen
- `content/narrative/contributions/2026-11-10-world-first-ui-modular.json` — { — gelesen: 24 Zeilen
- `content/narrative/contributions/2026-11-10-world-scene-queue-deadcode.json` — { — gelesen: 24 Zeilen
- `content/narrative/contributions/2026-11-10-world-scene-queue-hotfix.json` — { — gelesen: 24 Zeilen
- `content/narrative/contributions/2026-11-10-world-scene-queue.json` — { — gelesen: 24 Zeilen
- `content/narrative/contributions/2026-11-11-actions-storage-retention.json` — { — gelesen: 17 Zeilen
- `content/narrative/contributions/2026-11-11-agent14-changelog-1.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent14-changelog-2.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent14-changelog-3.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent14-changelog-4.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent14-changelog-5.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent14-changelog-6.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent14-changelog-7.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent14-claim-evidence-1.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent14-claim-evidence-2.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent14-claim-evidence-3.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent14-claim-evidence-4.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent14-claim-evidence-5.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent15-aftercare-1.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent15-aftercare-2.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent15-aftercare-3.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent15-amenity-1.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent15-amenity-3.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent15-amenity-4.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent16-aftercare-1.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent16-aftercare-2.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent16-aftercare-3.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent16-staff-1.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent16-staff-2.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent16-staff-3.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent17-aftercare.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent17-business-areas-1.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent17-business-areas-2.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent17-business-areas-3.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent17-business-areas-4.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent17-business-areas-5.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent17-ci-pending.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent17-done.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent17-merge-pending.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent18-aftercare.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent18-ci-pending.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent18-done.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent18-drink-menu-1.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent18-drink-menu-2.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent18-drink-menu-3.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent18-drink-menu-4.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent18-merge-pending.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent19-aftercare.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent19-ci-pending.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent19-club-night-1.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent19-club-night-2.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent19-done.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent19-merge-pending.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent20-aftercare.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent20-ci-pending.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent20-done.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent20-hybrid-flow-1.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent20-hybrid-flow-2.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent20-merge-pending.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent21-aftercare.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent21-ci-pending.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent21-done.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent21-merge-pending.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent21-room-plan-1.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent21-room-plan-2.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent21-room-plan-3.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent22-aftercare.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent22-ci-pending.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent22-dead-code.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent22-done.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent22-merge-pending.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent22-task.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent22-venue-event.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent23-aftercare.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent23-ci-pending.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent23-done.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent23-fight-event.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent23-merge-pending.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent23-task.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent24-aftercare.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent24-bets.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent24-ci-pending.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent24-done-repair.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent24-done.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent24-merge-pending.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent24-task.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent24-test-quality.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent25-aftercare.json` — { — gelesen: 17 Zeilen
- `content/narrative/contributions/2026-11-11-agent25-arena.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent25-base-merge.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent25-ci-pending.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent25-done.json` — { — gelesen: 17 Zeilen
- `content/narrative/contributions/2026-11-11-agent25-main-merge.json` — { — gelesen: 17 Zeilen
- `content/narrative/contributions/2026-11-11-agent25-merge-base.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent25-merge-pending.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent25-task.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent26-aftercare.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent26-ci-fix.json` — { — gelesen: 17 Zeilen
- `content/narrative/contributions/2026-11-11-agent26-ci-pending.json` — { — gelesen: 17 Zeilen
- `content/narrative/contributions/2026-11-11-agent26-claim.json` — { — gelesen: 17 Zeilen
- `content/narrative/contributions/2026-11-11-agent26-done.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent26-esport-code.json` — { — gelesen: 17 Zeilen
- `content/narrative/contributions/2026-11-11-agent26-esport.json` — { — gelesen: 17 Zeilen
- `content/narrative/contributions/2026-11-11-agent26-main-merge.json` — { — gelesen: 17 Zeilen
- `content/narrative/contributions/2026-11-11-agent26-merge-pending.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-agent26-task.json` — { — gelesen: 17 Zeilen
- `content/narrative/contributions/2026-11-11-city-event-01.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-11-city-event-02.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-11-city-event-03.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-11-city-event-04.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-11-city-event-05.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-11-city-event-06.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-11-city-event-07.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-11-city-event-08.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-11-city-event-09.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-11-city-event-10.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-11-city-event-11.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-11-city-event-12.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-11-city-event-13.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-11-city-event-14.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-11-city-event-15.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-11-city-event-16.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-11-city-event-17.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-11-city-event-18.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-11-city-event-19.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-11-city-event-20.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-11-city-event-21.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-11-city-event-22.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-11-city-event-23.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-11-city-event-24.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-11-city-event-25.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-11-city-event-26.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-11-city-event-27.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-11-city-event-28.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-11-city-event-29.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-11-city-event-30.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-11-city-event-31.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-11-city-event-32.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-11-city-event-33.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-11-city-event-34.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-11-city-event-35.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-11-city-event-36.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-11-city-event-37.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-11-city-event-38.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-11-city-event-39.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-11-city-event-40.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-11-city-event-41.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-11-city-event-42.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-11-city-event-43.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-11-city-event-44.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-11-city-event-45.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-11-city-event-46.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-11-city-event-47.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-11-city-event-48.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-11-city-event-49.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-11-city-event-50.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-11-first-evening-ci.json` — { — gelesen: 17 Zeilen
- `content/narrative/contributions/2026-11-11-first-run-slot-truth-ci-fix.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-first-run-slot-truth-demand.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-first-run-slot-truth-lines.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-first-run-slot-truth-payout.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-game-scout-bootstrap.json` — { — gelesen: 17 Zeilen
- `content/narrative/contributions/2026-11-11-game-scout-main-merge.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-game-scout-player-qa.json` — { — gelesen: 17 Zeilen
- `content/narrative/contributions/2026-11-11-governance-ci-gates.json` — { — gelesen: 17 Zeilen
- `content/narrative/contributions/2026-11-11-governance-claim-scope.json` — { — gelesen: 17 Zeilen
- `content/narrative/contributions/2026-11-11-governance-dependency-matrix-retry.json` — { — gelesen: 17 Zeilen
- `content/narrative/contributions/2026-11-11-governance-precommit-pipeline.json` — { — gelesen: 17 Zeilen
- `content/narrative/contributions/2026-11-11-governance-retry-path.json` — { — gelesen: 17 Zeilen
- `content/narrative/contributions/2026-11-11-governance-stale-claim-closeout.json` — { — gelesen: 17 Zeilen
- `content/narrative/contributions/2026-11-11-living-world-foundation-1.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-living-world-foundation-2.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-living-world-vertical-slice-1.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-living-world-vision-1.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-local-first-ci.json` — { — gelesen: 17 Zeilen
- `content/narrative/contributions/2026-11-11-npc-world-foundation-1.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-optional-pr-runner.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-placement-venue-history-ci-fix.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-placement-venue-history.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-readme-visual-polish-1.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-render-world-visual-presentation-1.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-ui-placement-venue-history-aftercare.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-ui-placement-venue-history-done.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-ui-placement-venue-history-main-merge.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-ui-placement-venue-history-merge-pending.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-ui-queue-aftercare-2.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-ui-queue-aftercare-3.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-ui-queue-aftercare-4.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-ui-queue-aftercare.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-ui-queue-main-merge-2.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-ui-queue-main-merge.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-11-world-continuity-interaction-1.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-12-foreign-walkable.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-12-longturn-evidence.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-12-player-needs.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-12-render-acceptance-hardening.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-12-render-first-slices.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-12-render-r7-doors.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-12-render-rework-plan.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-12-render-threshold-voice-01.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-12-test-quality-voice-01.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-13-ambient-transition.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-13-apartment-walls.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-13-bet-slip-register.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-13-city-assets.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-13-city-encounter-roster.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-13-city-growth-finance.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-13-city-growth-observability.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-13-city-network.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-13-city-plots-growth.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-13-city-population-load.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-13-city-road-guard.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-13-claim-closeout-535.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-13-claim-closeout-550.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-13-claim-closeout-556.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-13-claim-closeout.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-13-claim-register-archive.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-13-claim-shelf-cleanup.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-13-fight-odds-margin.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-13-interiors.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-13-issues-sweep.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-13-needs-core-voice.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-13-npc-population.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-13-snapshot-purity.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-13-verify-gates.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-14-agent-board.json` — { — gelesen: 17 Zeilen
- `content/narrative/contributions/2026-11-14-agent-onboarding.json` — { — gelesen: 17 Zeilen
- `content/narrative/contributions/2026-11-14-balance-lane-on-demand.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-14-board-status-dokumentation.json` — { — gelesen: 17 Zeilen
- `content/narrative/contributions/2026-11-14-canonical-priorities.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-14-ci-line-green.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-14-city-network-acceptance.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-14-city-proximity.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-14-claim-register.json` — { — gelesen: 23 Zeilen
- `content/narrative/contributions/2026-11-14-close-rights.json` — { — gelesen: 17 Zeilen
- `content/narrative/contributions/2026-11-14-closeout-fallback.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-14-determinism-computed.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-14-door-walk.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-14-employment.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-14-esport-evening.json` — { — gelesen: 23 Zeilen
- `content/narrative/contributions/2026-11-14-external-work-split.json` — { — gelesen: 23 Zeilen
- `content/narrative/contributions/2026-11-14-first-evening-crate.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-14-generated-artifact-serialization.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-14-generated-gate.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-14-goal-cost-truth.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-14-grown-shell.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-14-home-households.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-14-house-debt.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-14-job-market-bookable.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-14-ledger-tick-guard.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-14-residence-role.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-14-rng-entry-role.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-14-run-budget.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-14-scene-frame-doors.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-14-scheduled-place-all-intents.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-14-smartphone-feed.json` — { — gelesen: 23 Zeilen
- `content/narrative/contributions/2026-11-14-staff-actor-state.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-14-staff-qualification.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-14-starter-crate-guidance.json` — { — gelesen: 22 Zeilen
- `content/narrative/contributions/2026-11-14-worker-bootstrap-roles.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-14-worker-bootstrap.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-14-worker-gate.json` — { — gelesen: 21 Zeilen
- `content/narrative/contributions/2026-11-14-workspace-home-drive.json` — { — gelesen: 21 Zeilen
- `content/narrative/registry/fragments.json` — { — gelesen: 25333 Zeilen
- `content/narrative/turns/manifest.json` — { — gelesen: 4521 Zeilen
- `content/narrative/vocabulary/classification.json` — { — gelesen: 206 Zeilen
- `content/narrative/vocabulary/flags.json` — { — gelesen: 13 Zeilen
- `docs/AGENT-ONBOARDING.md` — Agent-Onboarding — rigged-by-design — gelesen: 231 Zeilen
- `docs/ARCHITECTURE.md` — Architektur und Governance — gelesen: 1745 Zeilen
- `docs/CHANGELOG.md` — Changelog — gelesen: 1189 Zeilen
- `docs/CI.md` — CI: Lokale Gates und Repository-Verwaltung — gelesen: 116 Zeilen
- `docs/DEPENDENCY-MATRIX.md` — Dependency-Matrix — gelesen: 28 Zeilen
- `docs/DEVTAGEBUCH.md` — Devtagebuch — gelesen: 2583 Zeilen
- `docs/FLAG.md` — FLAG — vermischte Bezeichnungen (Governance ↔ Spiel/Präsentation) — gelesen: 101 Zeilen
- `docs/GOVERNANCE.md` — Governance: Lanes, Claims und Eskalation — gelesen: 220 Zeilen
- `docs/INDEX.md` — Doku-Index — gelesen: 66 Zeilen
- `docs/INVENTORY.md` — Inventar: Befunde, Lesedeckung und vollstaendige Dateiliste — gepflegt: Marker und Abschnitt 18
- `docs/LOCAL_CI.md` — Local-first CI/CD: Ausführungskategorien und APK-Ablauf — gelesen: 96 Zeilen
- `docs/RENDER_REWORK_PLAN.md` — Render- und Living-World-Rework — Task-Phasen — gelesen: 1559 Zeilen
- `docs/ROADMAP.md` — Roadmap — Spiel und Präsentation — gelesen: 176 Zeilen
- `docs/RUNBOOK-AUTO-RESOLVE.md` — Runbook: Auto-Resolve aktivieren und prüfen — gelesen: 349 Zeilen
- `docs/TESTING.md` — Testing: eine Linie und 17 Nachweise — gelesen: 93 Zeilen
- `docs/WORKFLOW.md` — Workflow: von Pretask bis zum manuellen Merge — gelesen: 162 Zeilen
- `docs/banner.jpg` — Binaerdatei — geprueft: Signatur, 193991 B
- `docs/banner.svg` — <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 420" width="1280" height="420" role="img" aria-label — gelesen: 242 Zeilen
- `docs/banners/art-direction-neon-ledger.png` — PNG-Textur — geprueft: PNG 1600x1380, 223656 B
- `docs/banners/chronologie.svg` — <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 150" role="img" aria-labelledby="t d" shape-renderin — gelesen: 1 Zeilen
- `docs/banners/faq.svg` — <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 150" role="img" aria-labelledby="t d" shape-renderin — gelesen: 1 Zeilen
- `docs/banners/features.svg` — <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 150" role="img" aria-labelledby="t d" shape-renderin — gelesen: 1 Zeilen
- `docs/banners/galerie.svg` — <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 150" role="img" aria-labelledby="t d" shape-renderin — gelesen: 1 Zeilen
- `docs/banners/roadmap.svg` — <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 150" role="img" aria-labelledby="t d" shape-renderin — gelesen: 1 Zeilen
- `docs/banners/social-preview.svg` — <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 640" role="img" aria-labelledby="sp-title sp-desc"> — gelesen: 110 Zeilen
- `docs/banners/spielwelt.svg` — <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 150" role="img" aria-labelledby="t d" shape-renderin — gelesen: 1 Zeilen
- `docs/banners/werkstatt.svg` — <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 150" role="img" aria-labelledby="t d" shape-renderin — gelesen: 1 Zeilen
- `docs/capabilities.json` — { — gelesen: 143 Zeilen
- `docs/contracts/README.md` — Vertragsindex — gelesen: 33 Zeilen
- `docs/contracts/actionset.md` — Contract: actionset v1.0 — gelesen: 52 Zeilen
- `docs/contracts/actor-id.md` — Contract: actor-id v1.0 — gelesen: 54 Zeilen
- `docs/contracts/domain-event.md` — Contract: domain-event v1.0 — gelesen: 86 Zeilen
- `docs/contracts/factor.md` — Contract: factor v1.0 — gelesen: 55 Zeilen
- `docs/contracts/relationship.md` — Contract: relationship v1.0 — gelesen: 55 Zeilen
- `docs/contracts/save.md` — Contract: save v1.0 — gelesen: 58 Zeilen
- `docs/contracts/world-time.md` — Contract: world-time v1.0 — gelesen: 56 Zeilen
- `docs/evidence/living-world-longturn-424242-4d.json` — { — gelesen: 3381 Zeilen
- `docs/evidence/living-world-weight-tuning.md` — Living World: Mehrseed-Lauf und Tie-Break-Gewichtung — gelesen: 92 Zeilen
- `docs/run-budget.json` — { — gelesen: 12 Zeilen
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
- `docs/screenshots/comparison/21-floor-v3-optik-steuerung.png` — PNG-Textur — geprueft: PNG 1500x940, 260077 B
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
- `docs/screenshots/current/18-r4-materialien.png` — PNG-Textur — geprueft: PNG 1024x768, 246329 B
- `docs/screenshots/current/20-r6-kamera.png` — PNG-Textur — geprueft: PNG 1024x768, 246347 B
- `docs/screenshots/current/21-r7-stadt.png` — PNG-Textur — geprueft: PNG 1006x942, 236403 B
- `docs/screenshots/current/24-r10-wohnung.png` — PNG-Textur — geprueft: PNG 1006x942, 146914 B
- `docs/screenshots/current/25-r12-strassenlicht.png` — PNG-Textur — geprueft: PNG 1024x768, 234139 B
- `docs/screenshots/current/26-r12-nacht.png` — PNG-Textur — geprueft: PNG 1024x768, 168510 B
- `docs/screenshots/current/28-r2-platzhalter.png` — PNG-Textur — geprueft: PNG 1006x942, 227752 B
- `docs/screenshots/current/29-r2-platzhalter-detail.png` — PNG-Textur — geprueft: PNG 1006x942, 267517 B
- `docs/screenshots/current/30-r9-stadtbewohner.png` — PNG-Textur — geprueft: PNG 1006x942, 162094 B
- `docs/screenshots/current/31-r12-abend-stadt.png` — PNG-Textur — geprueft: PNG 546x942, 143680 B
- `docs/screenshots/current/32-r12-nacht-uebergang.png` — PNG-Textur — geprueft: PNG 546x942, 138660 B
- `docs/screenshots/current/33-r12-nacht-nach-uebergang.png` — PNG-Textur — geprueft: PNG 555x951, 208604 B
- `docs/screenshots/current/34-r12-uebergang-beginn.png` — PNG-Textur — geprueft: PNG 555x951, 224131 B
- `docs/screenshots/current/35-r12-uebergang-mitte.png` — PNG-Textur — geprueft: PNG 555x951, 221380 B
- `docs/screenshots/current/36-r12-uebergang-ende.png` — PNG-Textur — geprueft: PNG 555x951, 223165 B
- `docs/screenshots/current/37-stadtnetz-abnahme.png` — PNG-Textur — geprueft: PNG 549x951, 223474 B
- `docs/screenshots/current/38-kiez-interior-abnahme.png` — PNG-Textur — geprueft: PNG 549x951, 149335 B
- `docs/screenshots/current/39-stadtbewohner.png` — PNG-Textur — geprueft: PNG 549x951, 221752 B
- `docs/screenshots/v0.3.114/01-floor-uebersicht.png` — PNG-Textur — geprueft: PNG 1264x569, 142621 B
- `docs/screenshots/v0.3.114/02-floor-detail.png` — PNG-Textur — geprueft: PNG 1264x569, 169522 B
- `docs/screenshots/v0.3.114/03-bauen-panel.png` — PNG-Textur — geprueft: PNG 1264x569, 151350 B
- `docs/screenshots/v0.3.114/04-gaeste-panel.png` — PNG-Textur — geprueft: PNG 1264x569, 146616 B
- `docs/screenshots/v0.3.114/05-hilfe-steuerung.png` — PNG-Textur — geprueft: PNG 1264x569, 151325 B
- `docs/screenshots/v0.3.114/06-smartphone.png` — PNG-Textur — geprueft: PNG 1264x569, 156049 B
- `docs/screenshots/v0.3.114/07-dialog.png` — PNG-Textur — geprueft: PNG 1264x569, 112442 B
- `docs/screenshots/v0.3.114/08-sound.png` — PNG-Textur — geprueft: PNG 1264x569, 118344 B
- `docs/screenshots/v0.3.114/09-charakter.png` — PNG-Textur — geprueft: PNG 1264x569, 125982 B
- `docs/screenshots/v0.3.114/10-asset-bibliothek.png` — PNG-Textur — geprueft: PNG 1264x569, 288272 B
- `docs/screenshots/v0.3.114/11-protokoll.png` — PNG-Textur — geprueft: PNG 1264x569, 136394 B
- `docs/screenshots/v0.3.132/01-floor-operator.png` — PNG-Textur — geprueft: PNG 1280x860, 283994 B
- `docs/screenshots/v0.3.132/02-floor-guest.png` — PNG-Textur — geprueft: PNG 1280x860, 341862 B
- `docs/screenshots/v0.3.132/03-slot-guest.png` — PNG-Textur — geprueft: PNG 1280x860, 355254 B
- `docs/screenshots/v0.3.132/04-slot-operator.png` — PNG-Textur — geprueft: PNG 1280x860, 300937 B
- `docs/screenshots/v0.3.132/05-guests-operator.png` — PNG-Textur — geprueft: PNG 1280x860, 348561 B
- `docs/screenshots/v0.3.132/06-build-operator.png` — PNG-Textur — geprueft: PNG 1280x860, 410900 B
- `docs/screenshots/v0.3.132/07-history-guest.png` — PNG-Textur — geprueft: PNG 1280x860, 326500 B
- `docs/screenshots/v0.3.132/08-mobile-guest.png` — PNG-Textur — geprueft: PNG 390x844, 163477 B
- `docs/screenshots/v0.3.78/01-floor-uebersicht.png` — PNG-Textur — geprueft: PNG 1280x860, 215768 B
- `docs/screenshots/v0.3.78/02-floor-detail.png` — PNG-Textur — geprueft: PNG 1280x860, 300499 B
- `docs/screenshots/v0.3.78/03-bauen-panel.png` — PNG-Textur — geprueft: PNG 1280x860, 280808 B
- `docs/screenshots/v0.3.78/04-gaeste-panel.png` — PNG-Textur — geprueft: PNG 1280x860, 166866 B
- `docs/screenshots/v0.3.78/05-hilfe-steuerung.png` — PNG-Textur — geprueft: PNG 1280x860, 188372 B
- `docs/superpowers/plans/sprint1-casino-mit-gast.png` — PNG-Textur — geprueft: PNG 838x951, 287175 B
- `index.html` — <!doctype html> — gelesen: 67 Zeilen
- `package.json` — { — gelesen: 122 Zeilen
- `packages/gamescout/AGENTS.md` — GameScout — Agent-Anleitung — gelesen: 160 Zeilen
- `packages/gamescout/README.md` — GameScout — gelesen: 74 Zeilen
- `packages/gamescout/bin/gamescout` — GameScout CLI bin entry point. — gelesen: 20 Zeilen
- `packages/gamescout/package.json` — { — gelesen: 55 Zeilen
- `packages/gamescout/pnpm-lock.yaml` — lockfileVersion: '9.0' — gelesen: 878 Zeilen
- `packages/gamescout/src/cli/dashboard.ts` — import { DashboardServer } from '../dashboard/server.js'; — gelesen: 51 Zeilen
- `packages/gamescout/src/cli/doctor.ts` — gamescout doctor — Run diagnostics. — gelesen: 67 Zeilen
- `packages/gamescout/src/cli/index.ts` — GameScout CLI entry point. — gelesen: 66 Zeilen
- `packages/gamescout/src/cli/mcp.ts` — gamescout mcp — Start MCP server only (STDIO). — gelesen: 41 Zeilen
- `packages/gamescout/src/cli/start.ts` — gamescout start — Start Core + MCP server + Dashboard. — gelesen: 65 Zeilen
- `packages/gamescout/src/core/actions.ts` — Browser actions: click, press_key, inspect, annotate. — gelesen: 98 Zeilen
- `packages/gamescout/src/core/cdp.ts` — CDP connection and tab management. — gelesen: 146 Zeilen
- `packages/gamescout/src/core/checkpoint.ts` — Checkpoints and pixel-diff comparison. — gelesen: 100 Zeilen
- `packages/gamescout/src/core/id.ts` — Deterministische ID-Generierung für GameScout. — gelesen: 12 Zeilen
- `packages/gamescout/src/core/index.ts` — GameScout Core — main entry point. — gelesen: 210 Zeilen
- `packages/gamescout/src/core/peer-mcps.ts` — Optional, read-only bridge to the repository owner's configured MCP peers. — gelesen: 218 Zeilen
- `packages/gamescout/src/core/recording.ts` — Recording and replay of browser action sequences. — gelesen: 207 Zeilen
- `packages/gamescout/src/core/session.ts` — Session state management for GameScout. — gelesen: 165 Zeilen
- `packages/gamescout/src/core/types.ts` — Shared types for GameScout Core. Engine-independent. — gelesen: 90 Zeilen
- `packages/gamescout/src/dashboard/html.ts` — GameScout Dashboard HTML. — gelesen: 237 Zeilen
- `packages/gamescout/src/dashboard/index.ts` — GameScout Dashboard — index re-export. — gelesen: 4 Zeilen
- `packages/gamescout/src/dashboard/server.ts` — GameScout Dashboard HTTP server. — gelesen: 203 Zeilen
- `packages/gamescout/src/mcp/server.ts` — GameScout MCP server. — gelesen: 289 Zeilen
- `packages/gamescout/src/types/globals.d.ts` — declare class Buffer { — gelesen: 4 Zeilen
- `packages/gamescout/src/types/pixelmatch.d.ts` — declare module 'pixelmatch' { — gelesen: 10 Zeilen
- `packages/gamescout/src/types/pngjs.d.ts` — declare module 'pngjs' { — gelesen: 13 Zeilen
- `packages/gamescout/tsconfig.json` — { — gelesen: 19 Zeilen
- `pnpm-lock.yaml` — lockfileVersion: "9.0" — gelesen: 2798 Zeilen
- `public/assets/casino/atlas/atlas-0.webp` — Binaerdatei — geprueft: Signatur, 308258 B
- `public/assets/casino/atlas/atlas-1.webp` — Binaerdatei — geprueft: Signatur, 75976 B
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
- `public/assets/casino/environment/floor/apartment-rug.svg` — <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" shape-rendering="crispEdges — gelesen: 6 Zeilen
- `public/assets/casino/environment/floor/city/doors/door.svg` — <svg xmlns="http://www.w3.org/2000/svg" width="96" height="24" viewBox="0 0 96 24"> — gelesen: 16 Zeilen
- `public/assets/casino/environment/floor/city/facades/apartment.svg` — <svg xmlns="http://www.w3.org/2000/svg" width="256" height="192" viewBox="0 0 256 192"> — gelesen: 54 Zeilen
- `public/assets/casino/environment/floor/city/facades/casino.svg` — <svg xmlns="http://www.w3.org/2000/svg" width="256" height="192" viewBox="0 0 256 192"> — gelesen: 49 Zeilen
- `public/assets/casino/environment/floor/city/facades/pub.svg` — <svg xmlns="http://www.w3.org/2000/svg" width="256" height="192" viewBox="0 0 256 192"> — gelesen: 49 Zeilen
- `public/assets/casino/environment/floor/city/facades/shop.svg` — <svg xmlns="http://www.w3.org/2000/svg" width="256" height="192" viewBox="0 0 256 192"> — gelesen: 42 Zeilen
- `public/assets/casino/environment/floor/city/props/bench.svg` — <svg xmlns="http://www.w3.org/2000/svg" width="96" height="64" viewBox="0 0 96 64"> — gelesen: 22 Zeilen
- `public/assets/casino/environment/floor/city/props/bus-stop.svg` — <svg xmlns="http://www.w3.org/2000/svg" width="96" height="128" viewBox="0 0 96 128"> — gelesen: 18 Zeilen
- `public/assets/casino/environment/floor/city/props/street-light.svg` — <svg xmlns="http://www.w3.org/2000/svg" width="64" height="128" viewBox="0 0 64 128"> — gelesen: 19 Zeilen
- `public/assets/casino/environment/floor/city/props/trash-bin.svg` — <svg xmlns="http://www.w3.org/2000/svg" width="64" height="80" viewBox="0 0 64 80"> — gelesen: 17 Zeilen
- `public/assets/casino/environment/floor/city/props/tree.svg` — <svg xmlns="http://www.w3.org/2000/svg" width="96" height="128" viewBox="0 0 96 128"> — gelesen: 26 Zeilen
- `public/assets/casino/environment/floor/concrete-slab.svg` — <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" shape-rendering="crispEdges — gelesen: 6 Zeilen
- `public/assets/casino/environment/floor/linoleum-speckle.svg` — <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" shape-rendering="crispEdges — gelesen: 5 Zeilen
- `public/assets/casino/environment/floor/stone-marble.svg` — <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" shape-rendering="crispEdges — gelesen: 6 Zeilen
- `public/assets/casino/environment/floor/tile-grid.svg` — <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" shape-rendering="crispEdges — gelesen: 6 Zeilen
- `public/assets/casino/environment/floor/wood-planks.svg` — <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" shape-rendering="crispEdges — gelesen: 6 Zeilen
- `public/assets/casino/environment/fx/light-pool.svg` — <svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"> — gelesen: 12 Zeilen
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
- `scripts/agent-cause.mjs` — Ein Befehl, eine Antwort: welches Gate ist rot, welcher Code, welcher Pfad, — gelesen: 492 Zeilen
- `scripts/agent-context.mjs` — Ein Aufruf, ein Kontext: Aenderungen, Systeme, Invarianten, Tests, Gates und — gelesen: 137 Zeilen
- `scripts/agent-feedback.mjs` — Lokales Feedback aus dem echten Diff. — gelesen: 34 Zeilen
- `scripts/agent-new.mjs` — Agenten-Bootstrap: ein Startvorgang statt vier. — gelesen: 187 Zeilen
- `scripts/agent-verify.mjs` — Ein Ablauf statt drei: Impact bestimmen, Gates daraus planen, Cache nutzen, — gelesen: 145 Zeilen
- `scripts/auto-resolve.mjs` — Auto-Resolve: ein roter CI-Lauf wird eingeordnet, bevor ein Issue entsteht. — gelesen: 323 Zeilen
- `scripts/autofix-0911.mjs` — Sicherer Autofix (ERR-0911): Lint-Fix, Dependency-Matrix, Commit-Sanitizing. — gelesen: 101 Zeilen
- `scripts/balance-run.mjs` — Balance-Spur: startet den 40-Tage-Messlauf als eigenen Prueflauf und legt den Bericht ab. — gelesen: 81 Zeilen
- `scripts/bench-lowend.mjs` — Low-End-Profil: derselbe Benchmark, auf einen Kern gepinnt. — gelesen: 27 Zeilen
- `scripts/branch-cleanup.mjs` — Lokale Wegwerf-Branches nach dem Merge melden. — gelesen: 54 Zeilen
- `scripts/build-asset-manifest.mjs` — Baut `src/render/assets/manifest.json` aus dem kuratierten Paket unter — gelesen: 151 Zeilen
- `scripts/build-inventory.mjs` — Erzeugt die vollstaendige Dateiliste fuer docs/INVENTORY.md. — gelesen: 143 Zeilen
- `scripts/check-loc.mjs` — LOC-Guard fuer VaCoin Casino Roguelite. — gelesen: 200 Zeilen
- `scripts/ci-long-checks.mjs` — Lange Nachweise ueber GitHub Actions statt auf der eigenen Maschine. — gelesen: 212 Zeilen
- `scripts/ci-plan.mjs` — CI-Plan fuer GitHub Actions: der Zustand des Laufs entscheidet, welche Gates — gelesen: 168 Zeilen
- `scripts/ci-status.mjs` — Kompakter CI-Status fuer den aktuellen PR-Kopf. — gelesen: 86 Zeilen
- `scripts/ci-tag-release.mjs` — Tag und Release fuer die Version, die im gepushten Commit steht. — gelesen: 100 Zeilen
- `scripts/claim-register.mjs` — Claim-Register: eine Datei pro Lane. — gelesen: 396 Zeilen
- `scripts/compile-narrative-content.mjs` — NAR-10 content compiler. — gelesen: 68 Zeilen
- `scripts/doc-stub.mjs` — Erzeugt die Pflichteintraege fuer eine Aenderung aus einem Titel. — gelesen: 66 Zeilen
- `scripts/doc-sync.mjs` — Ergänzt den stabilen Doku-Marker nur, wenn er fehlt; `--check` prueft nur. — gelesen: 23 Zeilen
- `scripts/encode-audio.mjs` — Musik-Master zu Browser-Audio: die WAV-Dateien bleiben Master und liegen — gelesen: 76 Zeilen
- `scripts/escalation-plan.mjs` — Druckt die Eskalationsstufe zu einem Befund. Ohne Argument liest er die — gelesen: 35 Zeilen
- `scripts/gate-matrix.mjs` — Die Gate-Matrix fuer GitHub Actions. — gelesen: 45 Zeilen
- `scripts/init-github.sh` — Initialisiert das Repo, setzt .gitignore, macht den ersten Commit und legt — gelesen: 47 Zeilen
- `scripts/install-hooks.mjs` — Aktiviert die Repo-Hooks (core.hooksPath) und macht sie ausfuehrbar. — gelesen: 28 Zeilen
- `scripts/integrate.mjs` — Integrationscontroller: eine Pruefung vor der CI, ein Reparaturpfad. — gelesen: 196 Zeilen
- `scripts/lib/affected-tests.mjs` — Betroffene Tests: deklariertes @test-target, der echte Importgraph und das — gelesen: 197 Zeilen
- `scripts/lib/agent-new-args.mjs` — Parse agent:new options while preserving commas in scalar arguments. — gelesen: 20 Zeilen
- `scripts/lib/atlas-png.mjs` — Deterministischer PNG-Atlas ohne neue Abhaengigkeit. — gelesen: 175 Zeilen
- `scripts/lib/atlas-webp.mjs` — WebP-Kodierung der Atlasseiten ueber das bereits vorhandene `ffmpeg-static`. — gelesen: 27 Zeilen
- `scripts/lib/base-refresh.mjs` — Eine Basis, ein Stand: `origin/main` wird vor jeder Diff- und Basis-Abfrage — gelesen: 149 Zeilen
- `scripts/lib/body-sync.mjs` — Gemeinsame Wahrheit fuer Commit- und PR-Bodies. — gelesen: 272 Zeilen
- `scripts/lib/branch-lifecycle.mjs` — Branch-/Worktree-Lifecycle: jede Branch ausser `main` ist temporaer. — gelesen: 90 Zeilen
- `scripts/lib/branch-prune.mjs` — Wegwerf-Branches: alles, was auf `main` liegt und nicht `main` ist. — gelesen: 37 Zeilen
- `scripts/lib/capabilities.mjs` — Capability-Manifest: Validierung und Gate-Logik für `verify:capabilities`. — gelesen: 247 Zeilen
- `scripts/lib/ci-plan.mjs` — CI-Plan: der Event-Zustand entscheidet, welche Gates und Tests laufen. — gelesen: 312 Zeilen
- `scripts/lib/ci-state.mjs` — CI-State: genau ein maschinenlesbarer Kommentar am PR. — gelesen: 113 Zeilen
- `scripts/lib/claim-collisions.mjs` — Reine Kollisionslogik fuer Lane-Claims. — gelesen: 104 Zeilen
- `scripts/lib/claim-evidence.mjs` — Merge-Nachweis fuer Lane-Claims. — gelesen: 425 Zeilen
- `scripts/lib/claim-lifecycle.mjs` — Claim-Lifecycle: Retention und Post-Merge-Closeout. — gelesen: 154 Zeilen
- `scripts/lib/compact.mjs` — Kompakte Werkzeugausgabe: eine Bildschirmseite statt eines Logs. — gelesen: 81 Zeilen
- `scripts/lib/dependency-change.mjs` — Eine Wahrheit fuer eine kleine, aber teure Frage: haben sich Abhaengigkeiten — gelesen: 68 Zeilen
- `scripts/lib/dependency-fingerprint.mjs` — Dependency-Fingerprint: Installation nur, wenn sich wirklich etwas aendert. — gelesen: 82 Zeilen
- `scripts/lib/doc-sync.mjs` — Pflichtdoku: eine Liste, ein Marker, eine Pruefung. — gelesen: 161 Zeilen
- `scripts/lib/error-codes.mjs` — Fehlercodes fuer die Gate-Skripte. — gelesen: 33 Zeilen
- `scripts/lib/escalation.mjs` — Eine Leiter fuer jeden Fehlschlag, in fester Reihenfolge: — gelesen: 79 Zeilen
- `scripts/lib/gate-cache.mjs` — Inhalts-Hash-Cache: identischer Arbeitsbaum -> gruenes Gate wird nicht erneut gerechnet. — gelesen: 101 Zeilen
- `scripts/lib/gate-diagnostics.mjs` — Mehrfach-Diagnose eines roten CI-Laufs. — gelesen: 120 Zeilen
- `scripts/lib/gate-runner.mjs` — Fuehrt unabhaengige Gates parallel aus, puffert ihre Ausgabe und nutzt den Inhalts-Cache. — gelesen: 257 Zeilen
- `scripts/lib/generated-files.mjs` — Generierte Artefakte: eine Liste, ein Eigentuemer, ein Regenerationspfad. — gelesen: 151 Zeilen
- `scripts/lib/identity.mjs` — Eine Identitaet fuer jeden Commit: unabhaengig von Runner, Sandbox und — gelesen: 8 Zeilen
- `scripts/lib/impact-graph.mjs` — Die Grenze des Impact-Pfads: Er laeuft in einem nackten Checkout ohne — gelesen: 61 Zeilen
- `scripts/lib/impact.mjs` — Impact: eine Analyse fuer Agentenkontext, Pruefplan und Bericht. — gelesen: 140 Zeilen
- `scripts/lib/imports.mjs` — Import- und Kopfkommentar-Lesen ohne TypeScript-Abhaengigkeit. — gelesen: 135 Zeilen
- `scripts/lib/integration.mjs` — Integration: entscheidet vor der teuren CI, ob ein Branch ueberhaupt — gelesen: 144 Zeilen
- `scripts/lib/issue-claim.mjs` — Issue-Claims: GitHub ist die Wahrheit fuer Claims und Lanes. — gelesen: 272 Zeilen
- `scripts/lib/issue-scope.mjs` — Issue-Scope: ein Label, ein Body-Vertrag, eine Entscheidung. — gelesen: 273 Zeilen
- `scripts/lib/lane-claims.mjs` — Lane-Claims: Claim-, Konflikt- und Gate-Validierung für parallele Agenten-Arbeit. — gelesen: 651 Zeilen
- `scripts/lib/narrative-blocks.mjs` — Textbaustein-Pools: eine Regel, ein Ziel, keine zweite Content-Wahrheit. — gelesen: 145 Zeilen
- `scripts/lib/narrative-compiler.mjs` — NAR-10 deterministic content compiler. — gelesen: 277 Zeilen
- `scripts/lib/narrative-content.mjs` — NAR-09 content contract: contributions, controlled vocabulary, turn manifest — gelesen: 486 Zeilen
- `scripts/lib/narrative-macros.mjs` — NAR-10 compile-time macro parser and validator. — gelesen: 271 Zeilen
- `scripts/lib/pending-commit.mjs` — Resume delivery when a verified commit exists and the worktree is clean. — gelesen: 4 Zeilen
- `scripts/lib/pipeline-plan.mjs` — Der Plan jedes Laufs: `verify` liest ausschliesslich, `fix` repariert. — gelesen: 203 Zeilen
- `scripts/lib/pipeline-stop.mjs` — Abbruchpfad der Pipeline: Signale beenden alle Gates und hinterlassen keine Waisen. — gelesen: 22 Zeilen
- `scripts/lib/pr-body.mjs` — PR-Body: die drei Pflichtsektionen werden im Plan-Job geprueft, nicht als — gelesen: 33 Zeilen
- `scripts/lib/process-sweep.mjs` — Verwaiste Gate-Prozesse: PID plus Startzeit, PID-genaues Beenden, nie nach Namensmuster. — gelesen: 188 Zeilen
- `scripts/lib/promote-guard.mjs` — Promotion-Guard: Ein Merge darf nur den Commit treffen, den der PR als Kopf — gelesen: 73 Zeilen
- `scripts/lib/promotion-state.mjs` — Promotion-Entscheidung: aus CI-Plan, Task-Vertrag und BLOCKED-Issues wird — gelesen: 78 Zeilen
- `scripts/lib/release-escalation.mjs` — Eskalationsleiter fuer Umgebungsprobleme im Release. — gelesen: 56 Zeilen
- `scripts/lib/repair-plan.mjs` — Reparaturplan: aus einem roten Lauf wird genau eine Entscheidung. — gelesen: 175 Zeilen
- `scripts/lib/repo-inventory.mjs` — Repository-Inventur: Bestaende werden am Remote erkannt, nicht am Ordnernamen. — gelesen: 111 Zeilen
- `scripts/lib/report.mjs` — Einheitliches [IDX] [ERR] Format fuer alle Gate-Skripte. — gelesen: 41 Zeilen
- `scripts/lib/run-budget.mjs` — Externes Laufbudget: eine Wahrheit für Stop-Entscheidung und Finding-Gate. — gelesen: 140 Zeilen
- `scripts/lib/staging-scope.mjs` — Staging-Umfang: `git add -A` ist nur zulaessig, wenn jede Aenderung im — gelesen: 75 Zeilen
- `scripts/lib/subsystems.mjs` — Ein Ort fuer Subsysteme und Ordnerregeln. — gelesen: 119 Zeilen
- `scripts/lib/takeover.mjs` — WIP-Takeover: "fremdes WIP" existiert nicht. — gelesen: 73 Zeilen
- `scripts/lib/task-contract.mjs` — Task-Vertrag: die eine Wahrheit eines Laufs. — gelesen: 400 Zeilen
- `scripts/lib/test-catalog.mjs` — Testkatalog: jede Testdatei gehoert genau einem System und genau einer — gelesen: 123 Zeilen
- `scripts/lib/tree-changes.mjs` — Arbeitsbaum-Aenderungen als explizite Liste. — gelesen: 54 Zeilen
- `scripts/lib/ts-ast.mjs` — Gemeinsame TypeScript-AST-Basis der Governance-Gates. — gelesen: 90 Zeilen
- `scripts/lib/work-claim.mjs` — Arbeits-Claim am Issue: getrennt von der Identitaet. — gelesen: 107 Zeilen
- `scripts/lib/worker-identity.mjs` — Worker-Identitaet: drei Namen, globale Reservierung, sonst nichts. — gelesen: 210 Zeilen
- `scripts/lib/workspace-home.mjs` — Workspace-Home: der einzige Ort, der Worktree-Neuaufbauten ueberlebt. — gelesen: 153 Zeilen
- `scripts/lib/worktree-isolation.mjs` — Technische Worktree-Isolation fuer Agenten. — gelesen: 91 Zeilen
- `scripts/lib/worktree-lifecycle.mjs` — Worker-Worktree-Lifecycle: Neuaufbau nur mit belegtem Merge. — gelesen: 74 Zeilen
- `scripts/lift-commit-body.mjs` — Hebt den vollstaendigen PR-Diff in einen abgegrenzten Automationsbereich. — gelesen: 141 Zeilen
- `scripts/loc-budgets.mjs` — LOC-Budgets pro Zustaendigkeit. Eine Datei gehoert genau zu einer Rolle: — gelesen: 36 Zeilen
- `scripts/local-ci.mjs` — Der lokale CI-Runner. Er ersetzt die frueheren GitHub-Workflows fuer — gelesen: 76 Zeilen
- `scripts/post-merge-closeout.mjs` — Post-Merge-Closeout: nach einem Merge den Registerstand nachziehen. — gelesen: 249 Zeilen
- `scripts/pr-watcher.mjs` — PR Watcher – erstellt Issues bei rotem Gate, Timeout oder Abbruch und — gelesen: 335 Zeilen
- `scripts/precommit.mjs` — Zentraler Pre-Commit-Runner. — gelesen: 117 Zeilen
- `scripts/prepare-android.mjs` — Capacitor-Android: Huelle um den Vite-Build, getrennt nach Variante. — gelesen: 248 Zeilen
- `scripts/pretask.mjs` — Pretask: der Start jedes Laufs. — gelesen: 810 Zeilen
- `scripts/promote.mjs` — Promote: manueller Status-/Notausgang. Der PR-Check ist optional; der Merge — gelesen: 671 Zeilen
- `scripts/reconcile-claims.mjs` — Claim-Reconciliation: Claims muessen zum tatsaechlichen Remote-Zustand passen. — gelesen: 157 Zeilen
- `scripts/release-impact.mjs` — Release-Relevanz: braucht dieser Stand wirklich ein APK? — gelesen: 70 Zeilen
- `scripts/run-budget.mjs` — run-budget — externer Stop-Vertrag für einen Lauf. — gelesen: 78 Zeilen
- `scripts/run-pipeline.mjs` — Fail-Closed-Pipeline in zwei getrennten Modi. — gelesen: 144 Zeilen
- `scripts/run-selected-tests.mjs` — Testkommando der Gates: ohne Auswahl laeuft die Suite des Profils, mit — gelesen: 37 Zeilen
- `scripts/sanitize-commit.mjs` — ERR-0911: entfernt verbotene Trailer und Tool-Werbung aus einer Nachricht. — gelesen: 18 Zeilen
- `scripts/sync-dependency-matrix.mjs` — ERR-0911: erzeugt die Live-Dependency-Matrix in docs/DEPENDENCY-MATRIX.md aus — gelesen: 140 Zeilen
- `scripts/sync-generated.mjs` — Der eine Regenerationspfad fuer generierte Artefakte. — gelesen: 137 Zeilen
- `scripts/task-state.mjs` — Task-Zustand: nach dem Turn ist vor dem naechsten. — gelesen: 284 Zeilen
- `scripts/test-affected.mjs` — Schneller Entwicklungsfeedback-Lauf: nur Tests, die vom aktuellen Diff — gelesen: 52 Zeilen
- `scripts/test-catalog.mjs` — Testkatalog schreiben (`pnpm run catalog`) oder pruefen (`--check`). — gelesen: 62 Zeilen
- `scripts/turn-push.mjs` — Turn-Abschluss: betroffene Tests, verify:light, Commit und Push auf den Arbeitsbranch. Kein Auto-Rebase, kein  — gelesen: 576 Zeilen
- `scripts/verify-assets.mjs` — Asset-Pruefung: jede Manifest-Referenz zeigt auf eine vorhandene Datei, — gelesen: 155 Zeilen
- `scripts/verify-capabilities.mjs` — verify:capabilities - Validiert das Capability-Manifest. — gelesen: 25 Zeilen
- `scripts/verify-commit-msg.mjs` — Steam-Developer-Notes-Gate: deutsche Pflichtsektionen, keine Fremd-Trailer. — gelesen: 54 Zeilen
- `scripts/verify-dead-code.mjs` — Fail-Closed Dead-Artifact-Gate: ein Export ist tot, wenn ihn niemand ueber — gelesen: 114 Zeilen
- `scripts/verify-docs.mjs` — Doc-Gate: Struktur, Marker und flacher Wurzelbaum; rot bei Abweichung. — gelesen: 14 Zeilen
- `scripts/verify-impact-graph.mjs` — Impact-Graph-Gate: Der Impact-Pfad darf keinen TypeScript-Compiler laden. — gelesen: 26 Zeilen
- `scripts/verify-lane-claims.mjs` — verify-lane-claims: Prüft, ob der aktuelle Branch einen Lane-Claim hat, — gelesen: 433 Zeilen
- `scripts/verify-narrative-blocks.mjs` — Gate: Textbaustein-Pools und die Pflicht pro Commit. — gelesen: 132 Zeilen
- `scripts/verify-narrative-content.mjs` — NAR-10/NAR-11 read-only content verification. — gelesen: 21 Zeilen
- `scripts/verify-pr-body.mjs` — Plan-Gate fuer den PR-Body. Der Body kommt als Umgebungsvariable, nie als — gelesen: 23 Zeilen
- `scripts/verify-redundancy.mjs` — Redundanz-Gate: eine Wahrheit pro Sache. — gelesen: 67 Zeilen
- `scripts/verify-scope.mjs` — verify:scope: Nur der Diff gegen die Claim-Allowlist. — gelesen: 172 Zeilen
- `scripts/verify-task-contract.mjs` — verify-task-contract: prueft den Task-Vertrag des aktuellen Branches gegen — gelesen: 130 Zeilen
- `scripts/verify-test-placement.mjs` — Neue Testdateien muessen beim Ziel liegen. — gelesen: 115 Zeilen
- `scripts/verify-test-quality.mjs` — Fail-Closed-Testvertrag ueber die TypeScript-AST: Header, echte Assertions, — gelesen: 178 Zeilen
- `scripts/verify-tree.mjs` — Tree-Gate: jede Datei liegt in ihrem Ordner, jede Schicht importiert nur nach innen. — gelesen: 105 Zeilen
- `scripts/version-bump.mjs` — Versionsnummer des Turns: wird vor `verify` gebumpt, damit der gepushte Baum — gelesen: 56 Zeilen
- `scripts/worker-init.mjs` — worker:init — PRETASK-Baustein fuer den Worker. — gelesen: 253 Zeilen
- `src/App.tsx` — import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'; — gelesen: 193 Zeilen
- `src/Config/__tests__/eslint-determinism.test.ts` — Die Determinismus-Sperre wird ueber den echten ESLint-Lauf geprueft, nicht — gelesen: 71 Zeilen
- `src/Config/android-signing.json` — { — gelesen: 7 Zeilen
- `src/Config/capacitor.config.json` — { — gelesen: 12 Zeilen
- `src/Config/escalation-levels.json` — ["AUTO_FIX", "LOCAL_GATE", "REMOTE_CI", "AGENT", "BLOCKED"] — gelesen: 1 Zeilen
- `src/Config/eslint.config.mjs` — import js from '@eslint/js'; — gelesen: 162 Zeilen
- `src/Config/opencode.json` — { — gelesen: 10 Zeilen
- `src/Config/test-lanes.json` — { — gelesen: 10 Zeilen
- `src/Config/tsconfig.json` — { — gelesen: 24 Zeilen
- `src/Config/vite.config.ts` — import { configDefaults, defineConfig } from 'vitest/config'; — gelesen: 80 Zeilen
- `src/core/contracts/__tests__/actionset.test.ts` — Contract actionset v1.0: Domain-registrierter ActionSet-Vertrag. — gelesen: 95 Zeilen
- `src/core/contracts/__tests__/actor-id.test.ts` — Contract actor-id v1.0: Dauerhafte Actor-ID und Referenzregeln. — gelesen: 57 Zeilen
- `src/core/contracts/__tests__/domain-event.test.ts` — Contract domain-event v1.0: Event-Hülle mit Actor-/Zeit-Referenzen, Sequenz — gelesen: 115 Zeilen
- `src/core/contracts/__tests__/factor.test.ts` — Contract factor v1.1: IDs, Kategorie, Grundgewicht, Untereinfluesse, — gelesen: 101 Zeilen
- `src/core/contracts/__tests__/relationship.test.ts` — Contract relationship v1.0: Gerichtete Relationship-IDs und erlaubte Änderungsbefehle. — gelesen: 86 Zeilen
- `src/core/contracts/__tests__/save.test.ts` — Contract save v1.0: Save-Envelope, Versionierung und Migration. — gelesen: 85 Zeilen
- `src/core/contracts/__tests__/world-time.test.ts` — Contract world-time v1.0: WorldTime, Calendar-Bezug und TimeDomain-Schlüssel. — gelesen: 71 Zeilen
- `src/core/contracts/actionset.ts` — Contract: actionset v1.0 — gelesen: 63 Zeilen
- `src/core/contracts/actor-id.ts` — Contract: actor-id v1.0 — gelesen: 43 Zeilen
- `src/core/contracts/domain-event.ts` — Contract: domain-event v1.0 — gelesen: 99 Zeilen
- `src/core/contracts/factor.ts` — Contract: factor v1.1 — gelesen: 100 Zeilen
- `src/core/contracts/relationship.ts` — Contract: relationship v1.0 — gelesen: 62 Zeilen
- `src/core/contracts/save.ts` — Contract: save v1.0 — gelesen: 54 Zeilen
- `src/core/contracts/world-time.ts` — Contract: world-time v1.0 — gelesen: 37 Zeilen
- `src/core/economy/__tests__/economy.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 97 Zeilen
- `src/core/economy/__tests__/ledger-atomicity.test.ts` — Ledger-Transfer muss atomar sein: bei einem abgelehnten Buchung (z. B. — gelesen: 84 Zeilen
- `src/core/economy/__tests__/ledger-checkpoint.test.ts` — Die volle Pruefung bleibt vollstaendig, die inkrementelle meldet denselben Zustand. — gelesen: 61 Zeilen
- `src/core/economy/__tests__/ledger-diagnose.test.ts` — Diagnose muss Zustand, Buchungszahl und Bruchursache nachvollziehbar liefern. — gelesen: 51 Zeilen
- `src/core/economy/ledger-integrity.ts` — Buchungspruefung als reine Funktionen: kein Geld, nur Nachvollziehbarkeit. — gelesen: 68 Zeilen
- `src/core/economy/ledger-tick-guard.ts` — `verifyIncremental()` ist der guenstige Tickpfad. Er läuft nach `tickWorld` — gelesen: 57 Zeilen
- `src/core/economy/ledger.ts` — Doppelte Buchfuehrung fuer VaCoin. Konten sind dynamisch, damit jeder Gast — gelesen: 271 Zeilen
- `src/core/economy/vacoin.ts` — VaCoin (VC) - Geld als ganzzahlige Mikro-Einheiten. — gelesen: 92 Zeilen
- `src/core/games/__tests__/contracts.test.ts` — Eine Runde ist eine Aktion plus Result; die Auszahlung folgt vollstaendig aus beidem. — gelesen: 78 Zeilen
- `src/core/games/__tests__/dice-bets.test.ts` — Jedes Wettfeld am Wuerfeltisch muss exakt sagen, wann es gewinnt, und seine — gelesen: 63 Zeilen
- `src/core/games/__tests__/foreign-round-atomic.test.ts` — Eine fremde Runde wird erst vollstaendig geprueft und gerechnet, dann — gelesen: 77 Zeilen
- `src/core/games/__tests__/game-rounds.test.ts` — Auch die neuen Tischspiele muessen durch denselben Aktionspfad: Einsatz rein, — gelesen: 71 Zeilen
- `src/core/games/__tests__/mod-profile.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 94 Zeilen
- `src/core/games/__tests__/pity-settlement.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 26 Zeilen
- `src/core/games/__tests__/plinko-sandbox.test.ts` — Rot-Gruen-Beweis fuer die Plinko-Sandbox: Peg-Physik, Reihen-Leiter, — gelesen: 140 Zeilen
- `src/core/games/__tests__/plinko-track.test.ts` — Die Buehne zeigt eine echte Physikbahn. Deshalb muss das Ergebnis die Bahn — gelesen: 44 Zeilen
- `src/core/games/__tests__/poker-distribution.test.ts` — Tischpoker wird nicht ueber ein allgemeines RTP-Band bewertet: Die relevante — gelesen: 44 Zeilen
- `src/core/games/__tests__/poker-table.test.ts` — Rundenpoker am Tisch: Handbewertung, Side Pots nach Einsatzniveaus, — gelesen: 171 Zeilen
- `src/core/games/__tests__/risk-card.test.ts` — Die Risiko-Karte ist doppelte Buchfuehrung: verdoppeln zahlt das fremde Haus, — gelesen: 64 Zeilen
- `src/core/games/__tests__/roulette-table.test.ts` — Das Tableau muss jede Zahl genau einmal abdecken, jede Quote exakt auszahlen — gelesen: 96 Zeilen
- `src/core/games/__tests__/round-rtp-high.test.ts` — Eigene Datei statt einer Schleife in round.test.ts: Vitest verteilt Dateien — gelesen: 28 Zeilen
- `src/core/games/__tests__/round-rtp-machines.test.ts` — Zweite Datei für die günstigen Spiele: sie läuft in einem eigenen Worker — gelesen: 24 Zeilen
- `src/core/games/__tests__/round.bench.ts` — Durchsatz-Messung der Spielrunden. Bewusst nicht Teil von verify:all: — gelesen: 41 Zeilen
- `src/core/games/__tests__/round.test.ts` — Die RTP-Monte-Carlo-Laeufe liegen in round-rtp-high.test.ts und — gelesen: 55 Zeilen
- `src/core/games/__tests__/rtp-bands.ts` — Gemeinsame Parameter der RTP-Monte-Carlo-Laeufe. Kein Testfall: die Messung — gelesen: 55 Zeilen
- `src/core/games/__tests__/shell-round.test.ts` — Das Huetchenspiel muss vor der Wahl feststehen, ehrlich mischen und jede — gelesen: 63 Zeilen
- `src/core/games/__tests__/slot-config.test.ts` — Die Maschinenkonfiguration ist die eine Quelle der Spielparameter: die — gelesen: 129 Zeilen
- `src/core/games/__tests__/slot-expectation.test.ts` — Die Linien-Erwartung zaehlt genau den Lauf, den die Engine zahlt: kein — gelesen: 58 Zeilen
- `src/core/games/__tests__/slot-paylines.test.ts` — Das Gitter muss die Gewinnlinien exakt tragen: was die Anzeige als Treffer — gelesen: 103 Zeilen
- `src/core/games/__tests__/slot-profile.test.ts` — Der Betreiber stellt Streifen, Gewichte, Bewertungsmodell, Volatilität und — gelesen: 124 Zeilen
- `src/core/games/__tests__/slot-session-rtp.test.ts` — Der Pfad, den Gaeste wirklich spielen, muss dem Haus einen Vorteil lassen. — gelesen: 107 Zeilen
- `src/core/games/__tests__/slot-session.test.ts` — Eine Auszahlung, die der Deckungspuffer kuerzt, darf nicht mit dem — gelesen: 61 Zeilen
- `src/core/games/__tests__/slot-transparency.test.ts` — Rot-Gruen-Beweis: ehrliche Slot-Historie, physikalische Druckstufen und — gelesen: 106 Zeilen
- `src/core/games/__tests__/test-spin.test.ts` — Alle sieben Spiele laufen im Testmodus derselben Sandbox: eigener Seed, — gelesen: 69 Zeilen
- `src/core/games/__tests__/video-poker-ranks.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 31 Zeilen
- `src/core/games/contracts.ts` — Die Naht zwischen Spielregel, Geld und Anzeige: Aktion rein, Result raus. — gelesen: 114 Zeilen
- `src/core/games/dice-bets.ts` — Die fuenf Wettfelder am Wuerfeltisch: Trefferregel, Auszahlung und ein einzelner Wurf. — gelesen: 55 Zeilen
- `src/core/games/engines/__tests__/blackjack.test.ts` — Die Runde gehoert dem Spieler: Split, Versicherung, Aufgeben und die — gelesen: 126 Zeilen
- `src/core/games/engines/__tests__/interactive-cards.test.ts` — Blackjack und Video Poker laufen jetzt Zug fuer Zug. Der Kern muss jeden Zug — gelesen: 126 Zeilen
- `src/core/games/engines/blackjack-rules.ts` — Blackjack-Regeln und Handwertung (Vertrag, keine Aktionen). — gelesen: 131 Zeilen
- `src/core/games/engines/blackjack-settle.ts` — Dealerzug und Abrechnung: was jede Hand wert ist und wie die Runde endet. — gelesen: 80 Zeilen
- `src/core/games/engines/blackjack.ts` — Blackjack: Spieleraktionen und Rundenfluss; Dealer und Abrechnung in blackjack-settle. — gelesen: 151 Zeilen
- `src/core/games/engines/cards.ts` — Karten-Engines: Blackjack mit echten Entscheidungen, Video Poker mit Hold/Draw. — gelesen: 150 Zeilen
- `src/core/games/engines/interactive-cards.ts` — Kartenrunden mit Spielerentscheidung: Blackjack Zug fuer Zug, Video Poker mit Hold. — gelesen: 96 Zeilen
- `src/core/games/engines/slot-models.ts` — Die drei Bewertungsmodelle des Slots: Linien, Ways und Cluster. — gelesen: 189 Zeilen
- `src/core/games/engines/slot-odds.ts` — Chancen-Kalibrierung des Slots: wie viel eine Walzenanzahl auszahlt. — gelesen: 63 Zeilen
- `src/core/games/engines/slot-paytable.ts` — Paytable und Gewinnlinien des Slots. — gelesen: 81 Zeilen
- `src/core/games/engines/slot-strips.ts` — Walzenstreifen: Ziehung und angezeigte Chance muessen aus derselben Verteilung kommen. — gelesen: 36 Zeilen
- `src/core/games/engines/slot.ts` — Book-of-VaCoin: drei bis fuenf Walzen, Streifen oder Gewichte, drei Bewertungsmodelle. — gelesen: 154 Zeilen
- `src/core/games/engines/table.ts` — Tischspiele: Roulette mit voller Wettfläche, zwei Wuerfel, Huetchenspiel mit Serie. — gelesen: 121 Zeilen
- `src/core/games/mod-profile.ts` — Mods und die echte Spiel-Engine: die Bruecke, die bisher fehlte. — gelesen: 81 Zeilen
- `src/core/games/plinko-board.ts` — Plinko als echte Simulation: Zufall nur in den Startbedingungen, danach entscheidet die Kollision. — gelesen: 130 Zeilen
- `src/core/games/plinko-config.ts` — Reine Plinko-Konfiguration: Peg-Profile, Taschenbreiten und Reihen-Leiter. — gelesen: 100 Zeilen
- `src/core/games/plinko-sandbox.ts` — Plinko-Sandbox: RTP-Gate, Fortschritt und der Wurf, der Weltzustand und Anzeige verbindet. — gelesen: 163 Zeilen
- `src/core/games/poker-hand.ts` — Fuenf- bis Siebenkarten-Bewertung fuer den Rundenpoker-Tisch. — gelesen: 83 Zeilen
- `src/core/games/poker-round.ts` — Automatik-Runde fuer Simulation, Test und Fremdhaeuser: dieselbe Hand wie am — gelesen: 24 Zeilen
- `src/core/games/poker-settle.ts` — Abrechnung: Side Pots nach Einsatzniveaus, Hausanteil vom Pot, Endlabel. — gelesen: 93 Zeilen
- `src/core/games/poker-strategy.ts` — Spielerische Entscheidungen: Staerke aus den Karten, Aktion aus Staerke und Pot. — gelesen: 106 Zeilen
- `src/core/games/poker-table.ts` — Rundenpoker am Tisch: vier Spieler, je Strasse eine Setzrunde, Pot für alle. — gelesen: 158 Zeilen
- `src/core/games/poker-types.ts` — Gemeinsame Formen der Pokerrunde: Tisch, Spieler, Ergebnis. — gelesen: 56 Zeilen
- `src/core/games/risk-card.ts` — Risiko-Karte nach einem Gewinn: eine Farbe, 50/50, gebucht in doppelter Buchfuehrung. — gelesen: 42 Zeilen
- `src/core/games/roulette-table.ts` — Europaeisches Roulette-Tableau: mehrere Jetons gleichzeitig, eine Kugel. — gelesen: 128 Zeilen
- `src/core/games/round.ts` — Dispatcher: jedes Spiel hat seine eigene Engine, alle liefern dieselbe Ergebnisform. — gelesen: 87 Zeilen
- `src/core/games/sandbox.ts` — Ein Regelsatz, zwei Ausfuehrungsmodi. — gelesen: 61 Zeilen
- `src/core/games/shell-round.ts` — Huetchenspiel als interaktive Runde: erst mischen (Kern), dann waehlt der Spieler. — gelesen: 68 Zeilen
- `src/core/games/slot-config.ts` — Maschinenkonfiguration: die eine Quelle der Spielparameter. — gelesen: 113 Zeilen
- `src/core/games/slot-profile.ts` — Konfigurierbare Spielmechanik des Slots: Gewichte, Bewertungsmodell, Volatilitaet, — gelesen: 148 Zeilen
- `src/core/games/slot-session.ts` — Ein Slot-Spin mit Gedächtnis: Drucklader und Entladung werden hier tatsaechlich konsumiert. — gelesen: 80 Zeilen
- `src/core/games/slot-transparency.ts` — Ehrliches Slot-Gedächtnis und der Drucklader; reine, serialisierbare Zustandslogik. — gelesen: 106 Zeilen
- `src/core/governance/__tests__/affected-tests.test.ts` — Die Auswahl muss deklarierte Ziele, direkte Importe und das betroffene — gelesen: 70 Zeilen
- `src/core/governance/__tests__/agent-cause.test.ts` — agent:cause muss aus einem Gate-Log ohne Filter den Gate-Namen, den Fix, — gelesen: 176 Zeilen
- `src/core/governance/__tests__/agent-new-args.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 17 Zeilen
- `src/core/governance/__tests__/apk-signing.test.ts` — Installierbarkeit ist ein Vertrag, keine Annahme. Der Test haelt drei — gelesen: 71 Zeilen
- `src/core/governance/__tests__/auto-resolve.test.ts` — Die Reihenfolge ist der Vertrag: NOOP/PR_HANDOFF erzeugen nichts, ein — gelesen: 149 Zeilen
- `src/core/governance/__tests__/body-sync.test.ts` — Body-Synchronisation darf vorhandene Inhalte nie ersetzen. Genau diese — gelesen: 107 Zeilen
- `src/core/governance/__tests__/branch-lifecycle.test.ts` — Jede Branch ausser `main` ist temporaer. Geloescht wird nur mit Merge-Beleg; — gelesen: 72 Zeilen
- `src/core/governance/__tests__/branch-prune.test.ts` — Nach dem Merge mit gruenen Gates ist ein Wegwerf-Branch nur noch Arbeit, die — gelesen: 39 Zeilen
- `src/core/governance/__tests__/ci-docs-parity.test.ts` — Die Doku nennt dieselbe Gate-Wahrheit wie der Plan. Der Test liest die — gelesen: 36 Zeilen
- `src/core/governance/__tests__/ci-gates.test.ts` — Local-only: Kein GitHub-Workflow fuehrt Tests, Gates, Builds oder APKs aus. — gelesen: 45 Zeilen
- `src/core/governance/__tests__/ci-plan.test.ts` — Der Zustand ist die eine Wahrheit: aus ihm folgen Required-Set, Gates und — gelesen: 118 Zeilen
- `src/core/governance/__tests__/ci-state.test.ts` — Der CI-State ist genau ein Kommentar, ohne Zeitstempel, mit vollstaendiger — gelesen: 67 Zeilen
- `src/core/governance/__tests__/ci-workflow-contracts.test.ts` — Die verbliebenen Workflows sind Repository-Verwaltung: Lane-PR anlegen, — gelesen: 81 Zeilen
- `src/core/governance/__tests__/claim-collisions.test.ts` — Die Kollisionspruefung entscheidet, welche zwei Lanes parallel arbeiten — gelesen: 36 Zeilen
- `src/core/governance/__tests__/claim-evidence-ambiguity.test.ts` — Ein Branch-Name, zwei gemergte PRs: Für die Identität eines Claims bleibt das — gelesen: 70 Zeilen
- `src/core/governance/__tests__/claim-evidence-reconcile.test.ts` — Der lesende Reconcile: eine Branch auf `main` oder ein gemergter PR mit — gelesen: 110 Zeilen
- `src/core/governance/__tests__/claim-evidence.test.ts` — Ein geloeschter Branch ist kein Merge-Nachweis. Genau dieser Fall steht — gelesen: 195 Zeilen
- `src/core/governance/__tests__/claim-lifecycle.test.ts` — Retention ist keine blinde Loeschung: aktive Tasks, offene Claims und die — gelesen: 196 Zeilen
- `src/core/governance/__tests__/claim-save-scope.test.ts` — import { execFileSync } from 'node:child_process'; — gelesen: 33 Zeilen
- `src/core/governance/__tests__/dependency-governance.test.ts` — import { readFileSync, readdirSync } from 'node:fs'; — gelesen: 83 Zeilen
- `src/core/governance/__tests__/destructive-commands.test.ts` — Ein Resume ist kein Aufraeumen: kein Produktionsskript darf fremde Arbeit — gelesen: 60 Zeilen
- `src/core/governance/__tests__/gate-diagnostics.test.ts` — Ein roter Lauf kann mehrere unabhaengige Fehler enthalten. Diese Grenzen — gelesen: 83 Zeilen
- `src/core/governance/__tests__/gate-runner.test.ts` — Ein haengendes Gate darf den Lauf nicht offen halten: Nach dem harten Limit — gelesen: 86 Zeilen
- `src/core/governance/__tests__/impact-graph.test.ts` — Der Impact-Pfad muss ohne `node_modules` laufen. Der Test belegt beide — gelesen: 57 Zeilen
- `src/core/governance/__tests__/impact.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 28 Zeilen
- `src/core/governance/__tests__/integration-controller.test.ts` — Der Integrationscontroller muss die Ursache eines Konflikts erkennen, nicht — gelesen: 184 Zeilen
- `src/core/governance/__tests__/issue-scope.test.ts` — Ein Scope-Label entscheidet, ob ein offenes Issue eine Lane blockiert. — gelesen: 140 Zeilen
- `src/core/governance/__tests__/lane-claims.test.ts` — Ein Claim ist der Vertrag einer Lane, kein Token pro Pull Request. Nach dem — gelesen: 209 Zeilen
- `src/core/governance/__tests__/narrative-compiler.test.ts` — NAR-10: Makros werden zu einem begrenzten AST, Konflikte werden vor dem — gelesen: 180 Zeilen
- `src/core/governance/__tests__/narrative-content-quality.test.ts` — Quality-First: Der Bestand wird nicht nach Poolgroesse, sondern nach — gelesen: 140 Zeilen
- `src/core/governance/__tests__/narrative-content.test.ts` — NAR-09: Schema, kontrolliertes Vokabular, Turn-Manifest und die abgeleitete — gelesen: 201 Zeilen
- `src/core/governance/__tests__/narrative-fixture.ts` — Gemeinsamer Bestand und Temp-Fixture der Narrative-Content-Tests (NAR-09). — gelesen: 32 Zeilen
- `src/core/governance/__tests__/narrative-lane-integration.test.ts` — Zwei Lanes, zwei Beitraege, ein Main: dieser Lauf belegt den serialisierten — gelesen: 174 Zeilen
- `src/core/governance/__tests__/narrative-world-text.test.ts` — Spieltexte duerfen ohne Kenntnis des Repos verstaendlich sein. Dieser Test — gelesen: 43 Zeilen
- `src/core/governance/__tests__/pipeline-modes.test.ts` — Ein Pruefer darf die Akte nicht vorher umschreiben. Kein Verify-Profil — gelesen: 135 Zeilen
- `src/core/governance/__tests__/pr-body.test.ts` — Der PR-Body wird im Plan geprueft. Die exakten Ueberschriften und echte — gelesen: 34 Zeilen
- `src/core/governance/__tests__/pr-watcher.test.ts` — Ein erneut aufgetretener Fehler muss ein geschlossenes Issue wieder oeffnen. — gelesen: 184 Zeilen
- `src/core/governance/__tests__/pretask-blocked-issues.test.ts` — Fail-Closed des Issue-Checks: `governance/blocked` ist ein eigener Blocker, — gelesen: 173 Zeilen
- `src/core/governance/__tests__/pretask-cause.test.ts` — `pretask` und `turn:finish` geben einen roten Gate-Befund automatisch als — gelesen: 116 Zeilen
- `src/core/governance/__tests__/pretask-issues.test.ts` — Issue-Scopes blockieren nur die betroffene Lane. `remote-ci` und Issues ohne — gelesen: 188 Zeilen
- `src/core/governance/__tests__/pretask-modes.test.ts` — Die Startmodi NEW, RESUME und NOOP sowie die Grenze zwischen eigener und — gelesen: 193 Zeilen
- `src/core/governance/__tests__/pretask-takeover.test.ts` — Der echte `pretask`-Start mit adoptierbarer und korrupter WIP. Fremde oder — gelesen: 156 Zeilen
- `src/core/governance/__tests__/pretask.test.ts` — Der echte `pretask`-Start in temporaeren Git-Repos. Die Isolation-Hilfe — gelesen: 201 Zeilen
- `src/core/governance/__tests__/process-sweep.test.ts` — Der Abbruchpfad muss echte Prozesse beenden und die Registry raeumen; sonst — gelesen: 134 Zeilen
- `src/core/governance/__tests__/promote-guard.test.ts` — Ein Merge darf nur den Commit treffen, den der PR als Kopf traegt, und nur — gelesen: 107 Zeilen
- `src/core/governance/__tests__/promotion-state.test.ts` — Ein Merge ist nur auf dem exakten PR-Lauf, mit passendem Plan-Artefakt und — gelesen: 70 Zeilen
- `src/core/governance/__tests__/promotion-workflows.test.ts` — Local-first: Es gibt keinen automatischen Merge aus einem CI-Lauf. Der — gelesen: 76 Zeilen
- `src/core/governance/__tests__/red-team-gate-lane.test.ts` — Red-Team der Test- und Gate-Lane. Der Test prueft nicht ein einzelnes Gate, — gelesen: 216 Zeilen
- `src/core/governance/__tests__/release-escalation.test.ts` — Umgebungsprobleme muessen automatisch eine Stufe hoeher gehen, statt als — gelesen: 36 Zeilen
- `src/core/governance/__tests__/roadmap-register.test.ts` — Die Roadmap ist die einzige Liste offener Spiel- und Praesentationsarbeit. — gelesen: 162 Zeilen
- `src/core/governance/__tests__/run-budget.test.ts` — Der Stop-Vertrag ist extern: Grenzen aus der Konfiguration, Ist-Werte aus — gelesen: 102 Zeilen
- `src/core/governance/__tests__/scripts-libs-ci.d.ts` — Deklarationen fuer die CI-Diagnose- und Claim-Evidenz-Bibliotheken. — gelesen: 140 Zeilen
- `src/core/governance/__tests__/scripts-libs-claim-evidence.d.ts` — Deklarationen fuer Merge-Evidenz und den lesenden Claim-Reconcile. — gelesen: 73 Zeilen
- `src/core/governance/__tests__/scripts-libs-impact-graph.d.ts` — Deklaration fuer das Impact-Graph-Gate. — gelesen: 22 Zeilen
- `src/core/governance/__tests__/scripts-libs-lane-lifecycle.d.ts` — Deklarationen fuer Lane-Claims, Staging-Scope, Isolation, Takeover und Lifecycle. — gelesen: 137 Zeilen
- `src/core/governance/__tests__/scripts-libs-phase3.d.ts` — Deklarationen fuer Scope- und Reparaturplan (Phase 3). — gelesen: 129 Zeilen
- `src/core/governance/__tests__/scripts-libs-task-state.d.ts` — Deklarationen fuer den Task-Zustand (Phase 4). — gelesen: 90 Zeilen
- `src/core/governance/__tests__/scripts-libs-verify-scope.d.ts` — Deklaration fuer `verify:scope`. — gelesen: 16 Zeilen
- `src/core/governance/__tests__/scripts-libs.d.ts` — declare module '*/process-sweep.mjs' { — gelesen: 172 Zeilen
- `src/core/governance/__tests__/staging-scope.test.ts` — Fremde Arbeit darf nie automatisch gestaged werden. Diese Grenzen stehen — gelesen: 95 Zeilen
- `src/core/governance/__tests__/task-claim-parity.test.ts` — Eine einzige Quelle fuer den Lane-Status: Der Task-Vertrag ist die Wahrheit — gelesen: 47 Zeilen
- `src/core/governance/__tests__/test-catalog.test.ts` — Jede Testdatei gehoert genau einem System und genau einer Beweisklasse. — gelesen: 72 Zeilen
- `src/core/governance/__tests__/test-worker-home.ts` — Fixture-Identitaet fuer Tests, die `pretask` als Kindprozess starten. — gelesen: 41 Zeilen
- `src/core/governance/__tests__/tree-changes.test.ts` — Der Fix-Modus muss jede Aenderung nennen, auch Loeschungen. Ein stilles — gelesen: 41 Zeilen
- `src/core/governance/__tests__/verify-scope.test.ts` — `verify:scope` liest ausschliesslich den Diff und vergleicht ihn mit der — gelesen: 103 Zeilen
- `src/core/governance/__tests__/wip-takeover.test.ts` — "Fremdes WIP" gibt es nicht: jede Dirty-Datei ist kompatibel, — gelesen: 75 Zeilen
- `src/core/governance/__tests__/worker-claim-gate.test.ts` — Zwei harte Startgates: ohne reservierte Worker-Identitaet startet keine — gelesen: 156 Zeilen
- `src/core/governance/__tests__/worker-dependency-claims.test.ts` — Dependencies werden nur bei geaendertem Fingerprint neu gebaut, aus einem — gelesen: 76 Zeilen
- `src/core/governance/__tests__/worker-identity-bootstrap.test.ts` — Identitaet ist ein Betriebsmittel: drei Namen, exklusive Reservierung mit — gelesen: 129 Zeilen
- `src/core/governance/__tests__/worker-inventory-bootstrap.test.ts` — Bestaende werden am Remote erkannt, nicht am Ordnernamen. Die Inventur — gelesen: 80 Zeilen
- `src/core/governance/__tests__/workflow-hardening.test.ts` — Workflows sind ausfuehrbarer Code. Seit der Local-first-Migration fuehren — gelesen: 72 Zeilen
- `src/core/governance/__tests__/workflow-retry.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 18 Zeilen
- `src/core/governance/__tests__/workflow-state.test.ts` — Nach dem Turn zaehlt nur ein belegter Zustand: TESTS_PASSED nach lokaler — gelesen: 196 Zeilen
- `src/core/governance/__tests__/workspace-home-drive.test.ts` — Das Workspace-Home liegt ausserhalb des Repositories. Ueber Laufwerksgrenzen — gelesen: 40 Zeilen
- `src/core/governance/__tests__/worktree-isolation.test.ts` — Zwei Ebenen: die reine Entscheidung (geteilter Baum, fremder Claim, — gelesen: 194 Zeilen
- `src/core/governance/error-codes.ts` — Zentrales Fehlerregister. Jeder Gate-, Test- und Laufzeitfehler nennt hier — gelesen: 68 Zeilen
- `src/core/governance/test-harness.ts` — Vitest-Reporter fuer den Fail-Closed-Testvertrag: jeder Testfall wird mit — gelesen: 50 Zeilen
- `src/core/io/__tests__/escalation.test.ts` — import { readFileSync } from 'node:fs'; — gelesen: 27 Zeilen
- `src/core/io/envelope.ts` — Umschlag fuer Spielstand-Exporte: Art, Format, Pruefsumme, Nutzlast. — gelesen: 66 Zeilen
- `src/core/io/issues.ts` — Import-Befunde: blockieren, automatisch reparieren oder ignorieren. — gelesen: 50 Zeilen
- `src/core/io/repair.ts` — Repariert, was ohne Regelverstoss reparierbar ist; Blocker bleiben Blocker. — gelesen: 47 Zeilen
- `src/core/physics/__tests__/physics.test.ts` — Fester Zeitschritt, echte Impulse: die Render-FPS darf den Ausgang nicht aendern. — gelesen: 124 Zeilen
- `src/core/physics/body.ts` — Koerper der Headless-Physik: lokale Form, Welt-Transformation, Masse und Traegheit. — gelesen: 133 Zeilen
- `src/core/physics/geometry.ts` — Geometrie fuer Kollisionen: naechster Punkt, Punkt-in-Polygon, Kanten, Oberflaechengeschwindigkeit. — gelesen: 45 Zeilen
- `src/core/physics/world.ts` — Deterministische 2D-Physik: fester Zeitschritt, Impulse, Drehmoment, kein Renderer. — gelesen: 189 Zeilen
- `src/core/rng/__tests__/gameplay-entry-role.test.ts` — Negative Rollenpruefung an jeder oeffentlichen Gameplay-RNG-Grenze (#625): — gelesen: 122 Zeilen
- `src/core/rng/__tests__/shoe.test.ts` — Ein Schuh gibt jede Karte genau einmal aus, bevor er neu mischt. — gelesen: 66 Zeilen
- `src/core/rng/__tests__/streams.test.ts` — Gameplay- und Darstellungsstrom teilen keinen Zustand: Effekte duerfen den — gelesen: 46 Zeilen
- `src/core/rng/__tests__/weighted.test.ts` — Die ausgewiesene Chance stammt aus derselben Verteilung, aus der gezogen wird. — gelesen: 99 Zeilen
- `src/core/rng/gameplay-entry-points.ts` — Versionierte Liste der oeffentlichen Gameplay-RNG-Grenzen (#625). — gelesen: 59 Zeilen
- `src/core/rng/prng.ts` — Deterministischer Mulberry32-PRNG. Zustand ist ein uint32 und exakt wiederherstellbar. — gelesen: 56 Zeilen
- `src/core/rng/shoe.ts` — Kartenschuh ohne Zuruecklegen: eine gezogene Karte verlaesst den Schuh wirklich. — gelesen: 51 Zeilen
- `src/core/rng/streams.ts` — Zwei Stroeme, zwei Namespaces: Darstellung darf den Spielzustand nie bewegen. — gelesen: 34 Zeilen
- `src/core/rng/weighted.ts` — Gewichtetes Zahlenziehen: Angezeigte Chance und Ziehung stammen aus derselben Verteilung. — gelesen: 126 Zeilen
- `src/core/sim/__tests__/action-queue.test.ts` — Die Auftragskette bleibt simulationsseitig: ein Wischer wird hoechstens — gelesen: 97 Zeilen
- `src/core/sim/__tests__/addiction-consequences.test.ts` — Sucht-Folgen (P-5): Wer erkennbar suechtig spielt (ADDICTED-Blase ab — gelesen: 66 Zeilen
- `src/core/sim/__tests__/addiction-stake.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 112 Zeilen
- `src/core/sim/__tests__/amenity-reaction.test.ts` — Agent 15: Die Bedingung des Geraets, an dem ein Gast gespielt hat, verschiebt — gelesen: 106 Zeilen
- `src/core/sim/__tests__/anger-decay.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 29 Zeilen
- `src/core/sim/__tests__/anger-patience.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 28 Zeilen
- `src/core/sim/__tests__/apartment-render.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 137 Zeilen
- `src/core/sim/__tests__/arena.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 84 Zeilen
- `src/core/sim/__tests__/balance-harness.ts` — Betriebs-Messlauf: ein skriptierter Betreiber (bauen, einstellen, reparieren, ausbauen) — gelesen: 154 Zeilen
- `src/core/sim/__tests__/balance-metrics.ts` — Kennzahlen des Betriebs-Messlaufs: Was Gaeste erleben, je Spieltag gezaehlt. — gelesen: 175 Zeilen
- `src/core/sim/__tests__/balance-operating.test.ts` — Betriebs-Messlauf (nur mit RBD_BALANCE=1): Ankuenfte, Warteschlangen, Wartezeiten, — gelesen: 100 Zeilen
- `src/core/sim/__tests__/balance-report.ts` — Balance-Spur: macht den 40-Tage-Messlauf nachvollziehbar und pruefbar. — gelesen: 106 Zeilen
- `src/core/sim/__tests__/bar-capacity.test.ts` — import { readFileSync } from 'node:fs'; — gelesen: 22 Zeilen
- `src/core/sim/__tests__/brawl-combat.test.ts` — Die Siegchance im Tooltip ist keine Schaetzung: dieselbe Konstellation — gelesen: 77 Zeilen
- `src/core/sim/__tests__/building.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 149 Zeilen
- `src/core/sim/__tests__/business-areas.test.ts` — Die Bereiche sind der eine WorldState: Zonen tragen sie, Objekte stehen — gelesen: 114 Zeilen
- `src/core/sim/__tests__/city-construction.test.ts` — Ein Neubau ist zuerst ein Rohbau: versiegelt, ohne Tuerkante, ohne belegbare — gelesen: 109 Zeilen
- `src/core/sim/__tests__/city-day-closeout.test.ts` — Der Tagesabschluss der Stadt darf keinen zweiten Kalender fuehren: — gelesen: 148 Zeilen
- `src/core/sim/__tests__/city-employment.test.ts` — Eine Stelle gehoert einer Figur: Der Arbeitsmarkt zaehlt Zuordnungen, nicht — gelesen: 127 Zeilen
- `src/core/sim/__tests__/city-encounter-all-residents.test.ts` — Jeder Bewohner ist ansprechbar: Öffnen, Dialog und soziale Handlung müssen — gelesen: 115 Zeilen
- `src/core/sim/__tests__/city-encounter-loop.test.ts` — Headless-Abnahme des zentralen Begegnungs-Loops: — gelesen: 173 Zeilen
- `src/core/sim/__tests__/city-exterior-walls.test.ts` — Die Fassaden sind sichtbar, also muessen sie auch begangen werden koennen wie — gelesen: 86 Zeilen
- `src/core/sim/__tests__/city-growth-view.test.ts` — Die Sicht ist eine reine Projektion: Sie nennt Arbeitsmarkt, Kapital, freie — gelesen: 88 Zeilen
- `src/core/sim/__tests__/city-growth.test.ts` — Die Stadt baut auf ein Signal, nicht auf einen Timer: Ohne Joblose passiert — gelesen: 162 Zeilen
- `src/core/sim/__tests__/city-households.test.ts` — Jeder Bewohner hat eine eigene, gespeicherte Wohnadresse. Die Zuordnung — gelesen: 119 Zeilen
- `src/core/sim/__tests__/city-identity.test.ts` — Identität ist eine Kennung, kein Name: Jeder Bewohner bekommt eine eigene ID, — gelesen: 119 Zeilen
- `src/core/sim/__tests__/city-life-deferred-effects.test.ts` — Ortsgebundene Wirkung folgt der Ankunft: Wer erst noch laufen muss, bekommt — gelesen: 89 Zeilen
- `src/core/sim/__tests__/city-life-movement.test.ts` — Bewegung ist ein Weg, kein Etikett: Der Bewohner startet an seiner Tür, läuft — gelesen: 155 Zeilen
- `src/core/sim/__tests__/city-life-override.test.ts` — Die zwei Grenzen des Stadtleben-Scores: Eine Handlung ist nur möglich, wenn — gelesen: 87 Zeilen
- `src/core/sim/__tests__/city-life-schedule-target.test.ts` — Der Tagesplan nennt ein Gebaeude, nicht nur eine Absicht. `COMMUTE` ist ein — gelesen: 54 Zeilen
- `src/core/sim/__tests__/city-life.test.ts` — Die benannten Stadt-NPCs muessen im echten `tickWorld` leben: Standort und — gelesen: 150 Zeilen
- `src/core/sim/__tests__/city-loop-walkthrough.test.ts` — Headless-Abnahme des Stadt-Loops: Kiez bis Stammgast, Markt freischalten, — gelesen: 110 Zeilen
- `src/core/sim/__tests__/city-network.test.ts` — Das Stadtnetz ist die einzige Zielwahrheit: vier Knoten haengen ueber je eine — gelesen: 99 Zeilen
- `src/core/sim/__tests__/city-plots.test.ts` — Ein Grundstück ist ein fester Platz im Kartenlayout. Jedes Gebäude steht auf — gelesen: 114 Zeilen
- `src/core/sim/__tests__/city-population.test.ts` — Die Stadt ist keine Dreiergruppe: Jeder Index der Besetzung ergibt eine — gelesen: 118 Zeilen
- `src/core/sim/__tests__/city-props-solid.test.ts` — Die Stadt ist nur dann dieselbe Umgebung fuer Bild und Navigation, wenn die — gelesen: 76 Zeilen
- `src/core/sim/__tests__/city-scene-zones.test.ts` — Das Layout ist die einzige raeumliche Wahrheit. Ein Save mit abweichender — gelesen: 25 Zeilen
- `src/core/sim/__tests__/club-night.test.ts` — Der Clubabend ist keine zweite Lounge: Oeffnungszeit, Belegung und — gelesen: 109 Zeilen
- `src/core/sim/__tests__/demand.test.ts` — Nachfrage ist geplant: erster Gast terminiert, Quellen addieren sich, — gelesen: 149 Zeilen
- `src/core/sim/__tests__/device-identity.test.ts` — Geräteidentität und Spieltyp sind zwei Fragen. Der Katalog entscheidet, — gelesen: 46 Zeilen
- `src/core/sim/__tests__/dirty-index.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 22 Zeilen
- `src/core/sim/__tests__/dispute-escalation.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 13 Zeilen
- `src/core/sim/__tests__/drink-menu.test.ts` — Die Karte ist eine Sicht auf Grundpreis und Barstufe. Geprueft werden die — gelesen: 140 Zeilen
- `src/core/sim/__tests__/duel.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 180 Zeilen
- `src/core/sim/__tests__/economy-losses.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 24 Zeilen
- `src/core/sim/__tests__/esport-event.test.ts` — Der E-Sport-Abend ist keine zweite Veranstaltung: Er hängt am vorhandenen — gelesen: 102 Zeilen
- `src/core/sim/__tests__/esport.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 64 Zeilen
- `src/core/sim/__tests__/expansion.test.ts` — Ein Ausbau erhaelt Einrichtung, IDs, Gaeste, Personal und offene Anspruche; — gelesen: 166 Zeilen
- `src/core/sim/__tests__/fight-bet-register.test.ts` — Ein Schein ist Geld: Der Einsatz ist beim Platzieren gebucht. Deshalb darf — gelesen: 135 Zeilen
- `src/core/sim/__tests__/fight-bets.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 123 Zeilen
- `src/core/sim/__tests__/fight-career.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 117 Zeilen
- `src/core/sim/__tests__/fight-event.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 136 Zeilen
- `src/core/sim/__tests__/fight-odds.test.ts` — Der Markt darf nie besser sein als die Wahrscheinlichkeit, die er selbst — gelesen: 113 Zeilen
- `src/core/sim/__tests__/floor-work.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 124 Zeilen
- `src/core/sim/__tests__/foreign-floor-tick.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 52 Zeilen
- `src/core/sim/__tests__/grid-zones.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 87 Zeilen
- `src/core/sim/__tests__/guest-flow.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 171 Zeilen
- `src/core/sim/__tests__/guest-settlement.test.ts` — Kein Gast und kein Anspruch verschwindet, solange die Buchung nicht vollstaendig ist. — gelesen: 119 Zeilen
- `src/core/sim/__tests__/guest-voice.test.ts` — Der Ruf hoert man: Das Rufband waehlt den Pool, der Gast waehlt den Satz, — gelesen: 70 Zeilen
- `src/core/sim/__tests__/guests-served.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 32 Zeilen
- `src/core/sim/__tests__/hybrid-visitor-flows.test.ts` — Hybrid-Besucherstroeme: der Veranstaltungsgast kommt mit Durst und geht — gelesen: 86 Zeilen
- `src/core/sim/__tests__/influence.test.ts` — Einfluss-Matrix: Config-Validierung, Kontexte, Cross-Kanten, Determinismus, — gelesen: 185 Zeilen
- `src/core/sim/__tests__/interaction.test.ts` — Ein Ziel, ein Weg, eine Reichweite: die Figur laeuft zum Standplatz, statt zu — gelesen: 156 Zeilen
- `src/core/sim/__tests__/interior-layouts.test.ts` — Kneipe und Späti sind echte, begehbare Innenräume: eigener Grundriss, eine — gelesen: 105 Zeilen
- `src/core/sim/__tests__/item-synergy.test.ts` — Items, Seltenheiten und Paar-Synergien. — gelesen: 97 Zeilen
- `src/core/sim/__tests__/jackpot-label.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 13 Zeilen
- `src/core/sim/__tests__/journal.test.ts` — Jede Buchung wird genau einmal kopiert; Welt-Ereignisse tragen Ursache und Folge. — gelesen: 94 Zeilen
- `src/core/sim/__tests__/knowledge-belief.test.ts` — Abnahme der Glaubwuerdigkeits-Mechanik: — gelesen: 167 Zeilen
- `src/core/sim/__tests__/knowledge-config.test.ts` — P-23: Weitergabe und Quellenrang sind balancebar. Die Schwellen liegen in — gelesen: 60 Zeilen
- `src/core/sim/__tests__/knowledge-domain.test.ts` — Vier NPCs, ein Fakt, vier Zustaende: direkte Sicht, eigenes Geraeusch, — gelesen: 162 Zeilen
- `src/core/sim/__tests__/knowledge-relationships.test.ts` — Beziehungen sind Teil der Matrix: Konflikt stoppt die Weitergabe, Vertrauen — gelesen: 103 Zeilen
- `src/core/sim/__tests__/knowledge.test.ts` — Wissenskette: Nur Erlebtes/Gesehenes/Gehoertes/Gelesenes darf berichtet werden. — gelesen: 169 Zeilen
- `src/core/sim/__tests__/layout-commands.test.ts` — Typisierte Layout-Commands: nur die genannten Tiles/Kanten aendern sich, — gelesen: 98 Zeilen
- `src/core/sim/__tests__/layout-contract.test.ts` — Layout-Vertrag: eine Wahrheit fuer Dimension, Boden, Zonen und Wandkanten. — gelesen: 121 Zeilen
- `src/core/sim/__tests__/layout-history.test.ts` — Verlauf: 30 Schritte, ein Pinselstrich ist ein Schritt, Redo endet bei neuer Arbeit. — gelesen: 66 Zeilen
- `src/core/sim/__tests__/layout-json.test.ts` — Layout-Export/-Import: runde Reise, feste Bytes, fail-closed bei fremden Daten. — gelesen: 51 Zeilen
- `src/core/sim/__tests__/ledger-account-split.test.ts` — Bauträger und Pakt teilen sich kein Konto mehr (#532): Ein Bau bucht in den — gelesen: 75 Zeilen
- `src/core/sim/__tests__/living-world-causal-trace.test.ts` — Headless-Langlauf: Drei benannte NPCs leben mehrere Sim-Tage im echten — gelesen: 146 Zeilen
- `src/core/sim/__tests__/living-world-continuity.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 148 Zeilen
- `src/core/sim/__tests__/living-world-longturn.test.ts` — Ereignisketten-Evidenz: Ein langer Turn verbindet Umgebung, Erfahrung und — gelesen: 213 Zeilen
- `src/core/sim/__tests__/living-world-multiseed.test.ts` — Mehrseed-Evidenz: Derselbe Seed reproduziert exakt, verschiedene Seeds — gelesen: 26 Zeilen
- `src/core/sim/__tests__/living-world-social-economy.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 113 Zeilen
- `src/core/sim/__tests__/living-world-vertical-slice.test.ts` — Bundle 6: End-to-End Vertical Slice der Living World Engine. — gelesen: 171 Zeilen
- `src/core/sim/__tests__/logistics.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 64 Zeilen
- `src/core/sim/__tests__/look.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 28 Zeilen
- `src/core/sim/__tests__/machine-hall.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 121 Zeilen
- `src/core/sim/__tests__/main-event-pool.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 126 Zeilen
- `src/core/sim/__tests__/mod-guards.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 34 Zeilen
- `src/core/sim/__tests__/mod-resolver.test.ts` — Mod-Wirkungen entstehen an genau einer Stelle: der gemeinsame Resolver — gelesen: 58 Zeilen
- `src/core/sim/__tests__/money-truth.test.ts` — Fiat ist vom Spawn an ein gebuchtes Konto; Auszahlungen werden nie still gekappt. — gelesen: 108 Zeilen
- `src/core/sim/__tests__/mugging-cover.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 20 Zeilen
- `src/core/sim/__tests__/narrative-boundary.test.ts` — Der Boundary ist der einzige Verbraucher der Fact-Queue: Ledger-Schwellen werden — gelesen: 85 Zeilen
- `src/core/sim/__tests__/narrative-chain-runtime.test.ts` — Die Kette darf nur aus aufgeloesten Events starten, je nach Matrixwerten — gelesen: 229 Zeilen
- `src/core/sim/__tests__/narrative-chain-schema.test.ts` — Ereignisketten sind nur spielbar, wenn Start, Erreichbarkeit, Endknoten und — gelesen: 117 Zeilen
- `src/core/sim/__tests__/narrative-choice-contract.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 54 Zeilen
- `src/core/sim/__tests__/narrative-choice-eligibility.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 90 Zeilen
- `src/core/sim/__tests__/narrative-choice-execution.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 109 Zeilen
- `src/core/sim/__tests__/narrative-command-allowlist.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 52 Zeilen
- `src/core/sim/__tests__/narrative-command-dsl.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 36 Zeilen
- `src/core/sim/__tests__/narrative-conflict-source.test.ts` — Ein echter Streit zwischen zwei Gästen ist die Quelle für gerichtete — gelesen: 83 Zeilen
- `src/core/sim/__tests__/narrative-counter-rival.test.ts` — D2: `CONFRONT_RIVAL` traegt die typisierte Domaenenwirkung `COUNTER_RIVAL`. — gelesen: 74 Zeilen
- `src/core/sim/__tests__/narrative-coverage.test.ts` — B4: Jedes stabile Template muss `TITLE`, `BODY` und jedes angebotene — gelesen: 61 Zeilen
- `src/core/sim/__tests__/narrative-demand.test.ts` — Nachfrageveranstaltungen laufen als aktive GLOBAL-Event-Instanzen; die — gelesen: 96 Zeilen
- `src/core/sim/__tests__/narrative-event-expiry.test.ts` — D3: Keine globale Timeout-Strafe. `EXPIRED` bleibt wie heute ein reiner — gelesen: 74 Zeilen
- `src/core/sim/__tests__/narrative-event-schema.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 130 Zeilen
- `src/core/sim/__tests__/narrative-event-templates.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 95 Zeilen
- `src/core/sim/__tests__/narrative-events.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 107 Zeilen
- `src/core/sim/__tests__/narrative-fact-schema.test.ts` — Neue Beziehungs-Facts tragen ActorRefs statt einer Pflicht-visitorId. — gelesen: 73 Zeilen
- `src/core/sim/__tests__/narrative-facts.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 104 Zeilen
- `src/core/sim/__tests__/narrative-followup-chain.test.ts` — D1: Eine aufgeloeste Choice mit `followUpEventId` erzeugt im naechsten Lauf — gelesen: 61 Zeilen
- `src/core/sim/__tests__/narrative-longrun.test.ts` — NAR-16: Mehr-Tage-Betrieb mit Geschichten, Rivalen und Save/Replay. Der Lauf — gelesen: 133 Zeilen
- `src/core/sim/__tests__/narrative-memory.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 78 Zeilen
- `src/core/sim/__tests__/narrative-multi-beat.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 175 Zeilen
- `src/core/sim/__tests__/narrative-relationships.test.ts` — Beziehungen sind gerichtet, haben genau einen Besitzer und pinnen ihre Endpunkte — gelesen: 191 Zeilen
- `src/core/sim/__tests__/narrative-rival-context.test.ts` — Phase 5: Rivalen-Karten leiten sich rein aus Minds, Indizien und — gelesen: 88 Zeilen
- `src/core/sim/__tests__/narrative-rival-trigger.test.ts` — C2: Der `rival-action`-Trigger oeffnet nur fuer Handlungen mit Folgen ein — gelesen: 57 Zeilen
- `src/core/sim/__tests__/narrative-runtime.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 111 Zeilen
- `src/core/sim/__tests__/narrative-staff-source.test.ts` — Die Kasse ist die reale Besucher-Personal-Begegnung: nur ein anwesender — gelesen: 59 Zeilen
- `src/core/sim/__tests__/narrative-start-pool.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 71 Zeilen
- `src/core/sim/__tests__/narrative-trigger-schema.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 82 Zeilen
- `src/core/sim/__tests__/narrative-trigger-template-contract.test.ts` — C1: Die Spec-Regel „nur triggern, wo ein Template mit Mehrwert existiert“ — gelesen: 45 Zeilen
- `src/core/sim/__tests__/narrative-triggers.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 146 Zeilen
- `src/core/sim/__tests__/narrative-warm-return.test.ts` — F: Langzeitpfad ohne Campaign-State. VISITOR_RETURN fuehrt per ASK in — gelesen: 121 Zeilen
- `src/core/sim/__tests__/nav-edges.test.ts` — Waende blockieren Kanten statt Tiles. Tueren und Durchgaenge bleiben — gelesen: 172 Zeilen
- `src/core/sim/__tests__/needs-core.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 36 Zeilen
- `src/core/sim/__tests__/npc-schedule.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 140 Zeilen
- `src/core/sim/__tests__/own-play.test.ts` — Der eigene Geldweg laeuft fuer alle acht Spiele ausschliesslich ueber — gelesen: 205 Zeilen
- `src/core/sim/__tests__/pathfinding.test.ts` — Der Heap-A* liefert weiterhin kuerzeste, zusammenhaengende Wege; der Nav-Cache — gelesen: 111 Zeilen
- `src/core/sim/__tests__/persona-patience.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 25 Zeilen
- `src/core/sim/__tests__/phase-logic-audit-beats.test.ts` — Phase 4 und 7 gegen die echten Pfade: Beat-Wechsel, Kosten, einmalige — gelesen: 137 Zeilen
- `src/core/sim/__tests__/phase-logic-audit-foundation.test.ts` — Phase 0-2 gegen die echten Pfade: Geld, Determinismus, Akteurskanten, Weltzeit, — gelesen: 93 Zeilen
- `src/core/sim/__tests__/phase-logic-audit-relations.test.ts` — Phase 3, 5 und 6 gegen die echten Pfade: Akteurswahrheit im Preflight, — gelesen: 135 Zeilen
- `src/core/sim/__tests__/player-career.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 96 Zeilen
- `src/core/sim/__tests__/player-cash.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 32 Zeilen
- `src/core/sim/__tests__/player-history.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 56 Zeilen
- `src/core/sim/__tests__/player-jobs.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 205 Zeilen
- `src/core/sim/__tests__/player-needs.test.ts` — Spieler-Hunger und -Durst muessen im echten Tick leben: sinken, durch — gelesen: 137 Zeilen
- `src/core/sim/__tests__/player-rpg.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 101 Zeilen
- `src/core/sim/__tests__/player-speed.test.ts` — Speed war einmal nur ein gespeicherter Attributwert. Dieser Test haelt fest, — gelesen: 67 Zeilen
- `src/core/sim/__tests__/player-wage-attendance.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 84 Zeilen
- `src/core/sim/__tests__/progression-city.test.ts` — Stadt als zweiter Progression-Pfad: zwei Zweige, Energie und Pool-Texte. — gelesen: 85 Zeilen
- `src/core/sim/__tests__/progression.test.ts` — Unternehmensstufen nennen echte Bedingungen; gesperrte Ware sagt, was fehlt. — gelesen: 208 Zeilen
- `src/core/sim/__tests__/property-world.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 61 Zeilen
- `src/core/sim/__tests__/property.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 89 Zeilen
- `src/core/sim/__tests__/renovation.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 134 Zeilen
- `src/core/sim/__tests__/reputation-slot-use.test.ts` — Ruf veraendert die Slot-Nutzung: Ein Haus mit Standing wird mutiger bespielt. — gelesen: 55 Zeilen
- `src/core/sim/__tests__/reputation.test.ts` — Ruf ist Betriebserfahrung: Ein frischer Automat in gutem Zustand ist kein Ruf, — gelesen: 98 Zeilen
- `src/core/sim/__tests__/rival-ai.test.ts` — Rivalen handeln deterministisch: gleiche Eingaben, gleiche Absicht. Sabotage — gelesen: 155 Zeilen
- `src/core/sim/__tests__/rivals.test.ts` — Fremde Haeuser nutzen echte Spiele und Regeln, driften deterministisch und — gelesen: 78 Zeilen
- `src/core/sim/__tests__/room-plan.test.ts` — Der Raumplan liest die vorhandene Layout-Wahrheit: eine Zone je Raum, ihre — gelesen: 92 Zeilen
- `src/core/sim/__tests__/room-transition.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 200 Zeilen
- `src/core/sim/__tests__/shot-seed.test.ts` — Screenshot-Saat: eine eingerichtete Etage als Save-JSON ablegen, damit die — gelesen: 70 Zeilen
- `src/core/sim/__tests__/smartphone-views.test.ts` — Inbox, Vitter und ImmoLuck duerfen keine zweite Wahrheit anlegen: die Inbox — gelesen: 115 Zeilen
- `src/core/sim/__tests__/soak.test.ts` — Langlauf: Ledger bleibt integer und gedeckt, und der Betrieb steht ueber — gelesen: 126 Zeilen
- `src/core/sim/__tests__/spawn-demand.test.ts` — Der erste Gast braucht eine Kasse und den eigenen Floor. Ohne beides darf — gelesen: 79 Zeilen
- `src/core/sim/__tests__/staff-qualification.test.ts` — Die Qualifikation ist eine Eigenschaft des Agenten, nicht der Rolle: gleiche — gelesen: 104 Zeilen
- `src/core/sim/__tests__/staff-status.test.ts` — Der Personalstatus lebt ausschliesslich in den Agenten: ohne Agent keine — gelesen: 126 Zeilen
- `src/core/sim/__tests__/treat-influence.test.ts` — Döner-/Treat-Synergie am realen Serve-Pfad: an der Bar positiv, am Slot — gelesen: 105 Zeilen
- `src/core/sim/__tests__/trigger-dialog.test.ts` — P-15: TRIGGER_DIALOG ist ausfuehrbar. Der Command schreibt bewusst keinen — gelesen: 78 Zeilen
- `src/core/sim/__tests__/tx-reasons.test.ts` — Jeder Grund, den ein Aufrufer bucht, muss in der Kennzahl landen, die er — gelesen: 81 Zeilen
- `src/core/sim/__tests__/tycoon-needs.test.ts` — Bedürfnisse steuern Gastentscheidungen; Wut wird zum sichtbaren Streit mit Schaden. — gelesen: 180 Zeilen
- `src/core/sim/__tests__/tycoon-ops.test.ts` — Käufe kommen als Kiste, Personal arbeitet auf dem Floor, WC verstopft, Umbau braucht Ruf. — gelesen: 223 Zeilen
- `src/core/sim/__tests__/upkeep-costs.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 30 Zeilen
- `src/core/sim/__tests__/venue-event.test.ts` — Die zentrale Event-Infrastruktur ist eine Projektion auf die vorhandene — gelesen: 112 Zeilen
- `src/core/sim/__tests__/visitor-disposition.test.ts` — E2: Zwei Besucher gleicher Persona, einer mit GOOD-Erinnerung und Sympathie, — gelesen: 165 Zeilen
- `src/core/sim/__tests__/visitors.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 139 Zeilen
- `src/core/sim/__tests__/world.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 201 Zeilen
- `src/core/sim/action-queue-run.ts` — Ausfuehrung der Auftragskette: Annaeherung, Werkzeug, Arbeit und Rueckgabe. — gelesen: 155 Zeilen
- `src/core/sim/action-queue-tools.ts` — Werkzeugwahl der Auftragskette: vorhandener Wischer oder genau ein neuer an der Toilette. — gelesen: 21 Zeilen
- `src/core/sim/action-queue-types.ts` — Datenvertrag der Auftragskette; die Ausfuehrung liegt in action-queue-run. — gelesen: 98 Zeilen
- `src/core/sim/action-queue.ts` — Action Queue: serialisierbare Auftraege, kein React-State. — gelesen: 53 Zeilen
- `src/core/sim/actions.ts` — Commands, die nicht im Tick passieren: Bewegung, Reinigung, Preise, Mods, fremde Spiele. — gelesen: 187 Zeilen
- `src/core/sim/active-player.ts` — Der Spieler steht immer auf genau einem Floor. Dieses Modul beantwortet, — gelesen: 65 Zeilen
- `src/core/sim/actor-continuity.ts` — import type { DayPlan, NpcLODLevel, NpcNeeds } from './npc-types'; — gelesen: 104 Zeilen
- `src/core/sim/amenity-reaction.ts` — Ausstattungsreaktion (Agent 15): die Bedingung des Geraets, an dem ein Gast — gelesen: 43 Zeilen
- `src/core/sim/apartment-walls.ts` — Die Zonen in `player-apartment` sind die Raumwahrheit; hier stehen nur die — gelesen: 56 Zeilen
- `src/core/sim/arena.ts` — Eigene Arena als Ausbau der vorhandenen Immobilie: Stufen kommen aus — gelesen: 122 Zeilen
- `src/core/sim/bar-service.ts` — Bedienung an der Bar: der Drink aus der Karte und der Toilettengang. — gelesen: 58 Zeilen
- `src/core/sim/board-constants.ts` — Feste Brett- und Teppichwerte; aus types.ts ausgelagert, damit die Typdatei unter dem LOC-Limit bleibt. — gelesen: 11 Zeilen
- `src/core/sim/brawl-combat.ts` — Spielerkampf: Lebenspunkte, Trefferchancen und Runden, deren Anzeige exakt aus der Mechanik kommt. — gelesen: 150 Zeilen
- `src/core/sim/building-types.ts` — Kanonische Typen für physische Gebäude in der Living World Engine. — gelesen: 83 Zeilen
- `src/core/sim/building.ts` — Pure Funktionen zur Verwaltung physischer Gebäude in der Living World. — gelesen: 161 Zeilen
- `src/core/sim/business-areas.ts` — Modulare Business-Bereiche: das Haus fuehrt seine Bereiche im einen — gelesen: 86 Zeilen
- `src/core/sim/charisma-talk.ts` — Charisma-Ansprache: Erfolg hebt die Laune, ein Fehlschlag kann zur Prügelei werden. — gelesen: 59 Zeilen
- `src/core/sim/city-actions.ts` — Stadt-Handlungen: pruefen, fortschreiben, Text und Ergebnis setzen. — gelesen: 137 Zeilen
- `src/core/sim/city-construction.ts` — Ein Neubau ist zuerst ein Rohbau: versiegelt, ohne Türkante und ohne belegbare — gelesen: 123 Zeilen
- `src/core/sim/city-doors.ts` — Die Strassentüren und ihr bestehender Übergang. — gelesen: 34 Zeilen
- `src/core/sim/city-employment.ts` — Jede Stelle gehoert einer konkreten Figur. Die Zuordnung ist eine reine — gelesen: 99 Zeilen
- `src/core/sim/city-encounter-action.ts` — Die soziale Handlung: Command, Geld, Energie, Erinnerung, Wissen und Urteil. — gelesen: 150 Zeilen
- `src/core/sim/city-encounter-dialog.ts` — Die Begegnung als Spieltext: Sprecher, Rolle, Ort und gespeicherte Erinnerung. — gelesen: 103 Zeilen
- `src/core/sim/city-encounter.ts` — Die Begegnung im Ort ist der zentrale Loop der Stadt: — gelesen: 103 Zeilen
- `src/core/sim/city-exterior.ts` — Physisches Außenwelt-Layout und Straßen-Infrastruktur der Nachbarschaft. — gelesen: 162 Zeilen
- `src/core/sim/city-growth-view.ts` — Snapshot und Stadtfenster lesen dieselbe Sicht: Arbeitsmarkt, Bauträger-Konto, — gelesen: 79 Zeilen
- `src/core/sim/city-growth.ts` — Die Stadt baut auf ein Signal: Ein Bewohner ohne Arbeitsslot heisst, es gibt zu — gelesen: 149 Zeilen
- `src/core/sim/city-households.ts` — Jeder Bewohner traegt seine Wohnung als Kennung im Save. Die Zuordnung wird — gelesen: 88 Zeilen
- `src/core/sim/city-identity.ts` — Jeder Bewohner bekommt eine individuelle Kennung, die auf sein Profil zeigt. — gelesen: 34 Zeilen
- `src/core/sim/city-life-apply.ts` — Der Intent ist erst dann echt, wenn er Beduerfnisse, Bargeld, Faehigkeiten, — gelesen: 149 Zeilen
- `src/core/sim/city-life-create.ts` — Ein Bewohner entsteht aus seiner Figur in der Besetzung (`city-npc-roster`): — gelesen: 97 Zeilen
- `src/core/sim/city-life-decision.ts` — Der gewaehlte Intent und die zwoelf Familien werden mit derselben Score-Funktion — gelesen: 118 Zeilen
- `src/core/sim/city-life-effects.ts` — Der Tagesplan und der Score waehlen nur; erst diese Effekte veraendern — gelesen: 99 Zeilen
- `src/core/sim/city-life-memory.ts` — Erinnerungen sind das Erfahrungsgedaechtnis der NPCs: eine Begegnung erzeugt — gelesen: 45 Zeilen
- `src/core/sim/city-life-movement.ts` — Ein Ortswechsel ist keine Etikette: Der Bewohner steht auf einer Kachel, das — gelesen: 203 Zeilen
- `src/core/sim/city-life-normalize.ts` — Alte Saves kennen weder Attribute, Faehigkeiten, Beziehungen noch — gelesen: 125 Zeilen
- `src/core/sim/city-life-override.ts` — Zwei Regeln, die den Score begrenzen statt ihn zu ersetzen: Ein Gewerbe hat — gelesen: 74 Zeilen
- `src/core/sim/city-life-restore.ts` — Ein Save nennt Kennungen, keine Figuren: Alles Weitere laesst sich aus der — gelesen: 141 Zeilen
- `src/core/sim/city-life-score.ts` — Jede Alternative wird aus denselben Faktoren bewertet: Tagesplan, — gelesen: 169 Zeilen
- `src/core/sim/city-life-sim.ts` — Der Lauf benutzt exakt `tickWorld`, `createCityLifeState` und die — gelesen: 92 Zeilen
- `src/core/sim/city-life-state.ts` — Dieser Teil kennt nur den persistierbaren Zustand. Die stundenweise — gelesen: 60 Zeilen
- `src/core/sim/city-life-targets.ts` — Die Zielwahl ist raeumlich: eine Alternative findet nur statt, wenn Ort und — gelesen: 62 Zeilen
- `src/core/sim/city-life-tiebreak.ts` — Der Score ist deterministisch; nur nahe Gleichstände bekommen eine kleine, — gelesen: 33 Zeilen
- `src/core/sim/city-life-types.ts` — Die Stadt ist kein Standbild: Rita, Boris und Mira folgen ihrer Tagesroutine, — gelesen: 162 Zeilen
- `src/core/sim/city-life-venues.ts` — Die Stadt ist die einzige Wahrheit über Zeiten: Ein Gebäude trägt seine — gelesen: 45 Zeilen
- `src/core/sim/city-life-view.ts` — Die Sicht rechnet nichts nach und schreibt nichts: Ort, Intent, Bedürfnisse — gelesen: 65 Zeilen
- `src/core/sim/city-life.ts` — Jeder Bewohner der Liste ist keine Kulisse: Jede Stunde entscheidet seine — gelesen: 186 Zeilen
- `src/core/sim/city-model.ts` — Stadt-Daten und -Zustand: Orte, Handlungen, Raenge, Energie und der Bezug — gelesen: 140 Zeilen
- `src/core/sim/city-network.ts` — Die Stadt ist kein Menue: Wohnung, Casino, Kneipe und Markt sind Knoten, die — gelesen: 93 Zeilen
- `src/core/sim/city-npc-roster.ts` — Die drei kuratierten Figuren sind der Anfang der Liste, nicht ihr Umfang: — gelesen: 135 Zeilen
- `src/core/sim/city-npc-shift.ts` — Eine Schicht braucht keinen Save: Sie liegt in einer Tabelle je Gebaeude und — gelesen: 124 Zeilen
- `src/core/sim/city-npcs.ts` — Benannte Figuren der Stadt. Die Identitaet ist keine Anzeige: Name, Rolle, — gelesen: 103 Zeilen
- `src/core/sim/city-persist.ts` — Save-Heilung des Stadtzustands: Ort, Energie und Begegnungen aus rohen Daten. — gelesen: 58 Zeilen
- `src/core/sim/city-plots.ts` — Ein Grundstück ist ein fester Platz im Kartenlayout: Rechteck, Widmung und — — gelesen: 142 Zeilen
- `src/core/sim/city-roads.ts` — Die Straßen sind öffentlicher Grund: Der Boden malt sie, das Grundstücks­ — gelesen: 48 Zeilen
- `src/core/sim/city-scene.ts` — Stadt als begehbarer Floor. Die Stadtkarte bleibt eine Uebersicht; dieser — gelesen: 103 Zeilen
- `src/core/sim/city-tick.ts` — Die Stadt lebt auch, während der Spieler im eigenen Casino steht: erst die — gelesen: 26 Zeilen
- `src/core/sim/city-traits.ts` — Eigenschaften der Stadt-NPCs: 30 Traits, Vergabe nach Stats und PRNG, — gelesen: 179 Zeilen
- `src/core/sim/city-types.ts` — Typen der Stadt. Reine Beschreibung von Zustand und Sicht, keine Logik - — gelesen: 120 Zeilen
- `src/core/sim/city.ts` — Stadt: der erste Vertical Slice ausserhalb des eigenen Floors. — gelesen: 97 Zeilen
- `src/core/sim/clock.ts` — Ein Tag hat 600 Ticks, eine Stunde 25. Die Tageskonstante und der — gelesen: 21 Zeilen
- `src/core/sim/club-night.ts` — Clubabend in der Lounge (Agent 19): Oeffnungszeit, Lautstaerke und — gelesen: 44 Zeilen
- `src/core/sim/day-phase.ts` — Tageszeit der Buehne: rein aus dem Tick abgeleitet, nie aus der Uhr. — gelesen: 17 Zeilen
- `src/core/sim/deliveries.ts` — Lieferkette: Käufe kommen als Kiste am Eingang an und werden körperlich verteilt. — gelesen: 160 Zeilen
- `src/core/sim/demand-sources.ts` — Die Nachfragequellen einzeln und nachvollziehbar: Grundrauschen, Ruf, — gelesen: 96 Zeilen
- `src/core/sim/demand.ts` — Nachfrage: Ankuenfte werden geplant statt pro Tick gewuerfelt. — gelesen: 114 Zeilen
- `src/core/sim/desk-service.ts` — Kasse: Warteschlange, Bedienzeit und Wechsel von Fiat in Chips. — gelesen: 65 Zeilen
- `src/core/sim/device.ts` — Geräteidentität und Spieltyp sind zwei verschiedene Fragen. — gelesen: 44 Zeilen
- `src/core/sim/disputes.ts` — Streit: Wut wird zum sichtbaren Disput mit Position, Beteiligten und Eskalation. — gelesen: 174 Zeilen
- `src/core/sim/drink-menu.ts` — Getraenkekarte der Bar: eine Sicht auf `prices.drinkPrice` und `barLevel`. — gelesen: 62 Zeilen
- `src/core/sim/duel-opponent.ts` — Gegnerprofil eines Streits: abgeleitet, ohne PRNG, damit Vorschau und Kampf gleich sehen. — gelesen: 56 Zeilen
- `src/core/sim/duel.ts` — Duell: ein echter Kampf mit Lebenspunkten gegen den Rädelsführer des Streits, inklusive Überfall-Folge. — gelesen: 118 Zeilen
- `src/core/sim/economics.ts` — Wirtschaftliche Kennzahlen als reine Ableitung aus den Ledger-Buchungen. — gelesen: 159 Zeilen
- `src/core/sim/emotion.ts` — Was ein Gast gerade fühlt: eine Grafik statt eines Satzes. — gelesen: 57 Zeilen
- `src/core/sim/esport-event.ts` — E-Sport-Abend im vorhandenen Turnierabend (S3-09). — gelesen: 157 Zeilen
- `src/core/sim/esport-odds.ts` — Quoten und Chance des E-Sport-Abends als Blattmodul: Sicht (`esport.ts`) und — gelesen: 44 Zeilen
- `src/core/sim/esport.ts` — E-Sport-Simulationsdaten: eine Stadtliga mit Team-Ankern aus den vorhandenen — gelesen: 115 Zeilen
- `src/core/sim/events.ts` — Einfacher Event-Emitter fuer die Visuellen-Effekte-Brücke. — gelesen: 30 Zeilen
- `src/core/sim/expansions.ts` — Ausbau: das Haus waechst aus dem Bestand heraus. Nichts wird ersetzt, alles bleibt. — gelesen: 101 Zeilen
- `src/core/sim/fight-bet-cashier.ts` — Abgabe eines Scheins: der Ledger bucht den Einsatz, das Register haelt den — gelesen: 45 Zeilen
- `src/core/sim/fight-bet-register-legacy.ts` — Zwei Aufgaben: das Register aus einem Save sanitisieren (nur bekannte Picks, — gelesen: 132 Zeilen
- `src/core/sim/fight-bet-register.ts` — Ein Schein ist Geld: Der Einsatz ist beim Platzieren gebucht, die Auszahlung — gelesen: 103 Zeilen
- `src/core/sim/fight-bet-settle.ts` — Vorkampf und Abrechnung: der Vorkampf wird genau einmal simuliert und im — gelesen: 93 Zeilen
- `src/core/sim/fight-bet-slips.ts` — Scheine und Vorkampf: die Sicht auf das Register in `fight-bet-register`. — gelesen: 36 Zeilen
- `src/core/sim/fight-bets.ts` — Wettmarkt auf den Vorkampf: Quoten aus der vorhandenen Kampfmechanik. — gelesen: 149 Zeilen
- `src/core/sim/fight-career.ts` — Hinterhof-Karriere: herausforderbare Gegner, Startgeld und Preisgeld. — gelesen: 172 Zeilen
- `src/core/sim/fight-event.ts` — Kampfabend im vorhandenen Turnierabend. — gelesen: 159 Zeilen
- `src/core/sim/fight-fx.ts` — Kurzlebige Kampf-Rueckmeldung: der Streit ist schon entschieden, der Floor zeigt — gelesen: 11 Zeilen
- `src/core/sim/fight-history.ts` — Kampfhistorie aus dem Ereignisarchiv: dieselbe Ableitung fuer Gastduell, — gelesen: 98 Zeilen
- `src/core/sim/floor-work.ts` — Arbeitsqualitaet auf dem Floor: welches Attribut welche Arbeit traegt. — gelesen: 129 Zeilen
- `src/core/sim/foreign-floor-tick.ts` — Simulationslogik für fremde Casinos (Foreign Floors). — gelesen: 81 Zeilen
- `src/core/sim/grid-zones.ts` — 30x30-Bereiche, Multi-Tile-Footprints und Zugangs-Tiles. Reine Grid-Politik, kein Rendering. — gelesen: 134 Zeilen
- `src/core/sim/guest-choice.ts` — Was ein Gast als Nächstes tut: Bedürfnis, freier Platz, Ausweichen statt Stillstand. — gelesen: 148 Zeilen
- `src/core/sim/guest-core.ts` — Gemeinsame Gast-Basis ohne Entscheidungs- oder Spielwissen. — gelesen: 20 Zeilen
- `src/core/sim/guest-play.ts` — Spielen, Trinken, Klo: jeder Aufruf endet in einer konkreten Aktion, nicht in Zahlenrauschen. — gelesen: 167 Zeilen
- `src/core/sim/guest-service.ts` — Gast verlässt den Floor, wird wütend und wird ausgezahlt. — gelesen: 79 Zeilen
- `src/core/sim/guests.ts` — Fassade des Gastverhaltens: die Details liegen in kleinen, getrennten Modulen. — gelesen: 5 Zeilen
- `src/core/sim/house-presets.ts` — Haus-Vorlagen: Zonen und Moebel-Fabriken für klein, mittel, gross. — gelesen: 122 Zeilen
- `src/core/sim/hybrid-flow.ts` — Hybrid-Besucherstroeme (Agent 20): der erste Weg eines Gastes haengt vom — gelesen: 24 Zeilen
- `src/core/sim/influence-config.ts` — Matrix-Config: Faktoren, Untereinfluesse, Kontexte, Cross-Kanten und der — gelesen: 15 Zeilen
- `src/core/sim/influence-event-pool.ts` — Balancebare Auswahlregeln des Main-Event-Pools; Teil der Influence-Config. — gelesen: 44 Zeilen
- `src/core/sim/influence-matrix.ts` — Die eine balancebare Matrix: Faktor-Katalog, Kontexte, Cross-Kanten und — gelesen: 137 Zeilen
- `src/core/sim/influence-schema.ts` — Schema und fail-closed Validierung der Influence-Matrix. Die Gewichte liegen — gelesen: 141 Zeilen
- `src/core/sim/influence-types.ts` — Typen und stabile IDs der Influence-Matrix. Die Validierung liegt in — gelesen: 70 Zeilen
- `src/core/sim/influence.ts` — Einfluss-Matrix: gewichtete Faktoren, Untereinfluesse, Kontexte und — gelesen: 144 Zeilen
- `src/core/sim/interaction-nearest.ts` — Tastenpfad: das naechste Ziel in Reichweite, deterministisch nach Rang, Distanz und ID. — gelesen: 49 Zeilen
- `src/core/sim/interaction.ts` — Interaktion: Radius, Annaeherung und Zielpfad fuer Maus, Tastatur und Touch. — gelesen: 167 Zeilen
- `src/core/sim/interior-layouts.ts` — Kneipe und Späti tragen am Gebäude eine `interiorLayoutId`. Hier liegt der — gelesen: 129 Zeilen
- `src/core/sim/item-inventory.ts` — Inventar und Sammlung: eine abgeleitete Sicht auf den vorhandenen Zustand. — gelesen: 48 Zeilen
- `src/core/sim/item-synergy.ts` — Items auf dem bestehenden Mod-Bestand: Seltenheit, Synergie, Vor- und Nachteil. — gelesen: 144 Zeilen
- `src/core/sim/journal.ts` — Ereignisprotokoll: jeder wichtige Zustand mit Ursache, Wirkung und Akteur. — gelesen: 149 Zeilen
- `src/core/sim/layout-commands.ts` — Typisierte Layout-Commands: der Editor beschreibt eine Absicht, das Modul — gelesen: 115 Zeilen
- `src/core/sim/layout-derive.ts` — Ableitungen aus dem Layout-Vertrag: Vorlage, Boden, Legacy-Sicht und Ausbau. — gelesen: 116 Zeilen
- `src/core/sim/layout-edges.ts` — Kanten-Algebra des Layout-Vertrags: Anker, Grenzen, Rand und Einfrieren. — gelesen: 43 Zeilen
- `src/core/sim/layout-history.ts` — Endlicher Undo/Redo-Verlauf fuer Layout-Commands. Haelt fertige Layouts, — gelesen: 55 Zeilen
- `src/core/sim/layout-json.ts` — Versionierter Layout-Export und -Import. Das Dokument enthaelt nur den — gelesen: 49 Zeilen
- `src/core/sim/layout-types.ts` — Kanonischer Layout-Vertrag: Dimension, Bodenmaterial pro Tile, semantische — gelesen: 68 Zeilen
- `src/core/sim/layout-validate.ts` — Fail-closed-Pruefung des Layout-Vertrags: ungueltige Daten kommen nie in die Welt. — gelesen: 154 Zeilen
- `src/core/sim/layout.ts` — Der einzige Schreibpfad der raeumlichen Wahrheit: Layout zuerst, Sicht abgeleitet. — gelesen: 25 Zeilen
- `src/core/sim/living-world-longrun.ts` — Der Test soll Behauptungen prüfen, nicht Buch führen. Dieser Harness tickt — gelesen: 52 Zeilen
- `src/core/sim/living-world-longturn-evidence.ts` — Evidenz-Bausteine fuer den langen Living-World-Lauf. — gelesen: 137 Zeilen
- `src/core/sim/living-world-longturn-snapshots.ts` — Snapshots und kompakte Ketten-Sichten fuer den long-turn Evidenz-Lauf. — gelesen: 86 Zeilen
- `src/core/sim/living-world-movement-evidence.ts` — Das Messgerät liest nur, was `tickWorld` geschrieben hat: Kachel je Bewohner, — gelesen: 43 Zeilen
- `src/core/sim/living-world-multiseed.ts` — Mehrseed-Lauf fuer die Longturn-Evidenz: ein Seed, ein voller Stadtlauf. — gelesen: 47 Zeilen
- `src/core/sim/machine-hall.ts` — Spielhalle der eigenen Immobilie: Automaten, ihr Zustand und die Wartung. — gelesen: 179 Zeilen
- `src/core/sim/mod-effects.ts` — Mod-Katalog und der eine Resolver fuer Mod-Wirkungen. — gelesen: 119 Zeilen
- `src/core/sim/money.ts` — Geldwege: jeder Cent ist eine Ledger-Buchung, nie ein direkter Zähler. — gelesen: 153 Zeilen
- `src/core/sim/mop.ts` — Wischer-System. Headless, deterministisch, keine Browser-Abhängigkeiten. — gelesen: 57 Zeilen
- `src/core/sim/mugging.ts` — Simulierter Überfall nach einer verlorenen Prügelei: Ziel wählen, greifen, fliehen. — gelesen: 89 Zeilen
- `src/core/sim/narrative/__tests__/beat-resolver.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 128 Zeilen
- `src/core/sim/narrative/__tests__/composition-context.test.ts` — Der Helper liest ausschliesslich Welt, Fact, Event und Template; er mutiert — gelesen: 171 Zeilen
- `src/core/sim/narrative/__tests__/dialogue.test.ts` — Dialoge sind Daten plus ein reiner Ablauf: gleicher Klick, gleiche Folgeseite. — gelesen: 60 Zeilen
- `src/core/sim/narrative/__tests__/narrative-view.test.ts` — Das View-Modell leitet Szenen, Choices und Profile rein aus Welt, Ledger und — gelesen: 116 Zeilen
- `src/core/sim/narrative/__tests__/slot-discharge-fact.test.ts` — Der Slot-Drucklader wird erst nach der echten Ledger-Buchung narrativ: — gelesen: 53 Zeilen
- `src/core/sim/narrative/belief.ts` — Glaubwuerdigkeit als Mechanik: Wer teilt (Charisma, Intelligenz, Traits) und — gelesen: 200 Zeilen
- `src/core/sim/narrative/boundary.ts` — Einziger Verbraucher der Fact-Queue: Ledger-Facts erzeugen, einmal drainieren, anwenden. — gelesen: 41 Zeilen
- `src/core/sim/narrative/chains/chain-conditions.ts` — Reine Auswertung der Kettenbedingungen; keine Welt-, Ledger- oder RNG-Mutation. — gelesen: 116 Zeilen
- `src/core/sim/narrative/chains/chain-context.ts` — Baut den unveraenderlichen Ketten-Context aus Welt, Ledger und laufendem Knoten. — gelesen: 61 Zeilen
- `src/core/sim/narrative/chains/chain-graph.ts` — Reine Graphabfragen: Nachbarn, Erreichbarkeit, Zyklen und Zusammenfuehrungen. — gelesen: 71 Zeilen
- `src/core/sim/narrative/chains/chain-persist.ts` — Persistenz der Kettenlaeufe: sichere Defaults, harte Grenzen, keine Fremdzustaende. — gelesen: 102 Zeilen
- `src/core/sim/narrative/chains/chain-runtime-schedule.ts` — Planung von Kettenknoten: Teilnehmer verengen, Bedingungen bei Faelligkeit — gelesen: 124 Zeilen
- `src/core/sim/narrative/chains/chain-runtime-state.ts` — Zustandshelfer der Ereignisketten: begrenzen, ersetzen, beenden. Reine — gelesen: 73 Zeilen
- `src/core/sim/narrative/chains/chain-runtime-step.ts` — Ein einzelner Kettenlauf: verzoegern, Bedingungen auswerten, verzweigen oder — gelesen: 95 Zeilen
- `src/core/sim/narrative/chains/chain-runtime.ts` — Laufzeit der Ereignisketten: startet nur aus aufgeloesten Events und treibt — gelesen: 86 Zeilen
- `src/core/sim/narrative/chains/chain-schema.ts` — Fail-closed Schemapruefung fuer Ereignisketten; ungueltige Graphen werden nie angeboten. — gelesen: 157 Zeilen
- `src/core/sim/narrative/chains/chain-types.ts` — Verkettete Narrative: Ein Graph aus stabilen Knoten und bedingten Uebergaengen. — gelesen: 150 Zeilen
- `src/core/sim/narrative/chains/definitions/city-encounter-arc.ts` — Die Begegnung wirkt nach: Ein Tag (24 Ticks) nach der aufgeloesten Szene — gelesen: 51 Zeilen
- `src/core/sim/narrative/chains/definitions/index.ts` — Einzige Registry der verketteten Narrative; ungueltige oder textlose Ketten fallen raus. — gelesen: 20 Zeilen
- `src/core/sim/narrative/chains/definitions/pair-conflict-arc.ts` — Ein Streit zwischen zwei Gaesten laeuft nach der Eskalation in zwei — gelesen: 55 Zeilen
- `src/core/sim/narrative/chains/definitions/visitor-warm-arc.ts` — Zwei echte Pfade aus derselben warmen Rueckkehr: Die Influence-Matrix — gelesen: 57 Zeilen
- `src/core/sim/narrative/chains/index.ts` — Fassade der Ereignisketten-Domaene; Aufrufer importieren nur diese Datei. — gelesen: 12 Zeilen
- `src/core/sim/narrative/choices/contract.ts` — Choice-Vertrag: stabile IDs bleiben an Template-ID und Version gebunden. — gelesen: 21 Zeilen
- `src/core/sim/narrative/choices/eligibility.ts` — Reine Choice-Eligibility: Lifecycle, Requirements und Kosten ohne Seiteneffekte. — gelesen: 86 Zeilen
- `src/core/sim/narrative/choices/resolver.ts` — Einziger Beat-Resolver: Beat-Filter, Eligibility und Kosten in einem Schritt. — gelesen: 62 Zeilen
- `src/core/sim/narrative/choices/steps.ts` — Schritt-Auswahl: welche angebotenen Choices gelten im aktuellen Beat? — gelesen: 26 Zeilen
- `src/core/sim/narrative/commands/execute.ts` — Einziger Ausfuehrungspfad: Preflight, Handler, Kosten, RESOLVED. — gelesen: 145 Zeilen
- `src/core/sim/narrative/commands/index.ts` — Oeffentliche Fassade der Event-Command-Schicht. — gelesen: 13 Zeilen
- `src/core/sim/narrative/commands/parse-directives.ts` — Parser fuer €-Direktiven: erzeugt ein strikt begrenztes AST, nie Code. — gelesen: 123 Zeilen
- `src/core/sim/narrative/commands/preflight.ts` — Vollstaendige Vorpruefung einer Choice, bevor irgendein Effekt geschrieben wird. — gelesen: 149 Zeilen
- `src/core/sim/narrative/commands/registry.ts` — Allowlist der Commands: ID, Familie, Parameter und Handler-Vertrag. — gelesen: 100 Zeilen
- `src/core/sim/narrative/commands/types.ts` — Typisierte Event-Commands: Text wird zu AST, nie zu ausfuehrbarem Code. — gelesen: 99 Zeilen
- `src/core/sim/narrative/commands/validate.ts` — Kompiliert Direktiven und prueft sie gegen Registry, Argumente und Allowlist. — gelesen: 71 Zeilen
- `src/core/sim/narrative/composer/__tests__/narrative-composer-errors.test.ts` — NAR-11: Die Fehlerpfade des Runtime-Composers lehnen ungueltige Direktiven, — gelesen: 69 Zeilen
- `src/core/sim/narrative/composer/__tests__/narrative-composer.test.ts` — NAR-11: Der Composer waehlt aus der validierten Registry deterministisch — gelesen: 198 Zeilen
- `src/core/sim/narrative/composer/index.ts` — NAR-11: Lokaler, deterministischer Runtime-Composer; keine LLM- oder Netzwerkpfade. — gelesen: 103 Zeilen
- `src/core/sim/narrative/composer/registry.generated.ts` — Generated by NAR-10; do not edit. — gelesen: 288 Zeilen
- `src/core/sim/narrative/composer/schema.ts` — NAR-11: Laufzeitpruefung fuer generierte Fragmente und Composer-Anfragen. — gelesen: 73 Zeilen
- `src/core/sim/narrative/composer/select.ts` — NAR-11: Deterministische Auswahl ohne Gameplay-PRNG und ohne Seiteneffekte. — gelesen: 85 Zeilen
- `src/core/sim/narrative/composer/slot-map.generated.ts` — Generated by NAR-11; do not edit. — gelesen: 9 Zeilen
- `src/core/sim/narrative/composer/types.ts` — NAR-11: Der Composer verbindet Template-Slots mit lokalen Registry-Fragmenten. — gelesen: 71 Zeilen
- `src/core/sim/narrative/composition-context.ts` — B1: Reine Ableitung des Composer-Kontexts aus Welt, Fact, Event und Template. — gelesen: 150 Zeilen
- `src/core/sim/narrative/demand-events.ts` — Bruecke zwischen Demand-Balance und gemeinsamer Event-Engine. — gelesen: 60 Zeilen
- `src/core/sim/narrative/dialogue/scripts.ts` — Dialog: Sicherheitsfassung des ersten Comic-Dialogs. — gelesen: 50 Zeilen
- `src/core/sim/narrative/dialogue/select.ts` — Dialog: Reiner Ablauf der Dialogfuehrung. Kein Zufall, keine Zeit, kein Mutieren — gelesen: 60 Zeilen
- `src/core/sim/narrative/dialogue/types.ts` — Dialog: Datenvertrag der Dialogfuehrung. — gelesen: 34 Zeilen
- `src/core/sim/narrative/disposition.ts` — Besucherdisposition (E1): eine einzige reine Ableitung aus Persona-Basis, — gelesen: 134 Zeilen
- `src/core/sim/narrative/event-lifecycle.ts` — Zentrale Event-State-Machine und Cooldown-Anwendung. — gelesen: 141 Zeilen
- `src/core/sim/narrative/event-scheduler.ts` — Scheduler fuer narrative Event-Instanzen; Auswahl ist deterministisch und begrenzt. — gelesen: 178 Zeilen
- `src/core/sim/narrative/event-schema.ts` — Schema und sichere Normalisierung der persistenten Event-Domaene. — gelesen: 145 Zeilen
- `src/core/sim/narrative/event-types.ts` — Persistente Event-Vertraege fuer Scheduler, Lifecycle und Ereignisketten. — gelesen: 65 Zeilen
- `src/core/sim/narrative/events/definitions/__tests__/city-event-pool.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 36 Zeilen
- `src/core/sim/narrative/events/definitions/ambient-bar-talk.ts` — Feste Pool-Szene: zwei Gaeste kommen an der Bar ins Gespraech. — gelesen: 40 Zeilen
- `src/core/sim/narrative/events/definitions/ambient-shared-round.ts` — Feste Pool-Szene: eine gemeinsame Runde zwischen zwei Gaesten. — gelesen: 40 Zeilen
- `src/core/sim/narrative/events/definitions/ambient-tense-table.ts` — Feste Pool-Szene: angespannte Begegnung an einem Tisch. — gelesen: 59 Zeilen
- `src/core/sim/narrative/events/definitions/chain-visitor-echo.ts` — Spaetere Wiederbegegnung nach einer aufgeloesten Kette. Der Knoten hat keinen — gelesen: 44 Zeilen
- `src/core/sim/narrative/events/definitions/city-encounter-echo.ts` — Verzoegerte Folge der Begegnung. Es gibt zwei mechanisch getrennte Pfade: — gelesen: 71 Zeilen
- `src/core/sim/narrative/events/definitions/city-encounter.ts` — Die Begegnung im Ort: eine echte Szene mit benanntem Gegenueber, nicht ein — gelesen: 72 Zeilen
- `src/core/sim/narrative/events/definitions/index.ts` — Einzige Registry der stabilen Event-Templates. — gelesen: 32 Zeilen
- `src/core/sim/narrative/events/definitions/neon-nacht.ts` — Engine-seitig gestartete Nachfrageveranstaltung ohne Fact-Trigger und ohne Choices. — gelesen: 23 Zeilen
- `src/core/sim/narrative/events/definitions/rival-move.ts` — Stabile mechanische Definition fuer eine Rivalenhandlung am Spielerhaus. — gelesen: 53 Zeilen
- `src/core/sim/narrative/events/definitions/tournament-night.ts` — Engine-seitig gestartete Nachfrageveranstaltung ohne Fact-Trigger und ohne Choices. — gelesen: 23 Zeilen
- `src/core/sim/narrative/events/definitions/visitor-aftermath.ts` — Stabile mechanische Definition fuer das Nachspiel eines Besuchergespraechs. — gelesen: 40 Zeilen
- `src/core/sim/narrative/events/definitions/visitor-conflict.ts` — Stabile mechanische Definition fuer einen Streit zwischen zwei Besuchern. — gelesen: 73 Zeilen
- `src/core/sim/narrative/events/definitions/visitor-return-warm.ts` — Zweite Stufe der Rueckkehr: Wer Gutes mitbringt, bekommt zusaetzlich eine warme Szene. — gelesen: 40 Zeilen
- `src/core/sim/narrative/events/definitions/visitor-return.ts` — Stabile mechanische Definition fuer die Rueckkehr eines Besuchers. — gelesen: 54 Zeilen
- `src/core/sim/narrative/events/demand-definitions.ts` — Datengetriebene Nachfrageveranstaltungen; Auswahl und Ankuendigung bleiben in `demand.ts`. — gelesen: 36 Zeilen
- `src/core/sim/narrative/events/template-candidate.ts` — Uebersetzt einen Trigger-Match in einen begrenzten EventCandidate aus dem Template. — gelesen: 59 Zeilen
- `src/core/sim/narrative/events/template-schema.ts` — Fail-closed Validierung fuer Event-Templates, Choices und ihre statischen Teile. — gelesen: 167 Zeilen
- `src/core/sim/narrative/events/template-types.ts` — Deklarative Event-Templates und Choice-Vertraege; Darstellung bleibt ausserhalb. — gelesen: 125 Zeilen
- `src/core/sim/narrative/events/trigger-definitions.ts` — Deklarative Trigger, die einen echten Fact in einen Event-Kandidaten uebersetzen. — gelesen: 31 Zeilen
- `src/core/sim/narrative/fact-schema.ts` — Validierung und stabile Reihenfolge persistierter Narrative-Facts. — gelesen: 97 Zeilen
- `src/core/sim/narrative/facts.ts` — Fact-Queue: typisierte, einmalige Ereignisse mit stabiler ID — getrennt vom Journal. — gelesen: 90 Zeilen
- `src/core/sim/narrative/guest-voice.ts` — Ruf hoert man: Der Gaeste-Ton folgt dem Ruf des Hauses, nicht dem Zufall. — gelesen: 56 Zeilen
- `src/core/sim/narrative/knowledge-config.ts` — Wissens-Config: Quellengewichte, Beziehungsbonus und Distanzkurve. — gelesen: 129 Zeilen
- `src/core/sim/narrative/knowledge-gossip.ts` — Geruechtquelle: Ein zurueckkehrender Gast hoert nicht einfach den neuesten — gelesen: 79 Zeilen
- `src/core/sim/narrative/knowledge-observation.ts` — Beobachtungsschicht: Eine Sicht oder ein Geraeusch setzt echte Anwesenheit — gelesen: 79 Zeilen
- `src/core/sim/narrative/knowledge-persist.ts` — Persistenz der Wissensstaende: sichere Defaults, Grenzen und Herkunfts-Fallbacks. — gelesen: 80 Zeilen
- `src/core/sim/narrative/knowledge-query.ts` — Abfragen auf der Wissensdomäne: Glaube, Widersprueche und Alterung. — gelesen: 72 Zeilen
- `src/core/sim/narrative/knowledge-share.ts` — Weitergabe als regulaerer Matrix-Kontext: ob jemand ueberhaupt erzaehlt, — gelesen: 14 Zeilen
- `src/core/sim/narrative/knowledge-store.ts` — Reine Speicherhelfer der Wissenskette: finden, pruefen, anhaengen. — gelesen: 31 Zeilen
- `src/core/sim/narrative/knowledge-types.ts` — Typen der Wissensdomäne: Wahrnehmung, Wissen und nachvollziehbare Herkunft. — gelesen: 73 Zeilen
- `src/core/sim/narrative/knowledge.ts` — Wissenskette: Niemand berichtet, was er nicht selbst erlebt, gesehen, gehoert — gelesen: 172 Zeilen
- `src/core/sim/narrative/ledger-facts.ts` — Leitet aus Ledger-Buchungen nur Schwellenuebergaenge ab, nicht jede Buchung. — gelesen: 46 Zeilen
- `src/core/sim/narrative/main-event-pool.ts` — P-22 Main-Event-Pool: feste, normale Szenen werden nur bei idle gezogen. — gelesen: 157 Zeilen
- `src/core/sim/narrative/memory.ts` — Charaktergedaechtnis: aus Facts werden strukturierte Erinnerungen und messbare Wirkung. — gelesen: 54 Zeilen
- `src/core/sim/narrative/narrative-rng.ts` — Eigener Mulberry32-Strom fuer narrative Auswahl; nie der Gameplay-PRNG. — gelesen: 28 Zeilen
- `src/core/sim/narrative/relationship-apply.ts` — Wendet die fachlichen Beziehungsregeln auf bereits gedrainte Facts an. — gelesen: 75 Zeilen
- `src/core/sim/narrative/relationships.ts` — Kanonische, gerichtete Beziehungen zwischen persistenten Akteuren. — gelesen: 154 Zeilen
- `src/core/sim/narrative/rival-context.ts` — Phase 5: Rivalen-Karten als reine Ableitung aus den persistenten Minds. — gelesen: 41 Zeilen
- `src/core/sim/narrative/runtime.ts` — Duenne Ablaufkoordination: Fact drainieren, Trigger auswerten, Kandidaten begrenzt planen. — gelesen: 116 Zeilen
- `src/core/sim/narrative/scheduler.ts` — Oeffentliche Fassade fuer Event-Scheduler, Templates, Choices und Narrativ-RNG. — gelesen: 30 Zeilen
- `src/core/sim/narrative/state.ts` — Narrative-Domaene: Startzustand, Start-Pool beim neuen Spiel und sichere Normalisierung. — gelesen: 118 Zeilen
- `src/core/sim/narrative/trigger-context.ts` — Baut aus Welt, Ledger und aktuellem Fact einen unveraenderlichen Trigger-Context. — gelesen: 41 Zeilen
- `src/core/sim/narrative/trigger-evaluate.ts` — Reine Auswertung von Trigger-Bedingungen; keine Welt-, Ledger- oder RNG-Mutation. — gelesen: 116 Zeilen
- `src/core/sim/narrative/trigger-schema.ts` — Schema-Validierung fuer persistierbare Trigger-Definitionen; fail-closed. — gelesen: 113 Zeilen
- `src/core/sim/narrative/trigger-types.ts` — Deklarative Trigger-Vertraege: Bedingungen, Context und erklaerte Treffer. — gelesen: 89 Zeilen
- `src/core/sim/narrative/triggers.ts` — Oeffentliche Trigger-Fassade: Context, reine Auswertung und Schema-Validierung. — gelesen: 8 Zeilen
- `src/core/sim/narrative/types.ts` — Narrative Datenvertraege: Facts, Erinnerungen und persistenter Zustand als reine JSON-Daten. — gelesen: 200 Zeilen
- `src/core/sim/narrative/view-types.ts` — NAR-14: Datenvertraege des Anzeigemodells; der Builder lebt in `view.ts`. — gelesen: 88 Zeilen
- `src/core/sim/narrative/view.ts` — NAR-14: Anzeigemodell fuer Szenen und Profile – reine Ableitung, keine zweite Wahrheit. — gelesen: 168 Zeilen
- `src/core/sim/nav-grid.ts` — Navigationsraster: belegte Tiles, Wandkanten und ein Cache fuer beides. — gelesen: 114 Zeilen
- `src/core/sim/nav-reach.ts` — Erreichbarkeit ueber offene Kanten: BFS fuer Zielpruefung und Platzierungsschutz. — gelesen: 61 Zeilen
- `src/core/sim/needs-core.ts` — Spieler (Hunger/Durst), Stadt-NPCs (sechs Werte) und Gaeste (Durst/Blase) — gelesen: 42 Zeilen
- `src/core/sim/needs.ts` — Bedürfnisse: ein 180-Punkte-Profil pro Gast, Durst und Blase steuern die Zielwahl. — gelesen: 51 Zeilen
- `src/core/sim/npc-needs.ts` — import type { NpcIntentKind, NpcNeeds, NpcLODLevel } from './npc-types'; — gelesen: 113 Zeilen
- `src/core/sim/npc-schedule.ts` — import type { DayPlan, NpcIntent, NpcNeeds, NpcScheduleEntry } from './npc-types'; — gelesen: 140 Zeilen
- `src/core/sim/npc-types.ts` — export type NpcIntentKind = — gelesen: 55 Zeilen
- `src/core/sim/num.ts` — Die Modelle rundeten und klemmten bisher jeweils lokal. Eine Stelle fuer — gelesen: 24 Zeilen
- `src/core/sim/offers.ts` — Angebot: kaufbare Spiele, Deko und Mods. Jeder Mod zieht an und kostet Geduld oder Betrieb. — gelesen: 105 Zeilen
- `src/core/sim/own-play.ts` — Eigene Spielrunde: Der Betreiber sitzt als Gast an seinem Geraet. — gelesen: 186 Zeilen
- `src/core/sim/pathfinding.ts` — A* auf dem Tile-Grid. Deterministisch, 4 Richtungen, mit Blockern und Wandkanten. — gelesen: 189 Zeilen
- `src/core/sim/penalty-pool.ts` — Folgen eines verlorenen Duells: Ruf und Laune als befristete Strafe, kein Zufallspool. — gelesen: 40 Zeilen
- `src/core/sim/personas.ts` — Gästetypen: Budget, Geduld, Suchtneigung, Getränkeneigung und Spielgeschmack. — gelesen: 53 Zeilen
- `src/core/sim/player-apartment.ts` — Kanonisches Layout und Einrichtungs-Modell der Spieler-Wohnung. — gelesen: 155 Zeilen
- `src/core/sim/player-career.ts` — Spieler-Karriere: Level, Attribute, Koerper, Arbeit und Kampfbilanz als eine Sicht. — gelesen: 185 Zeilen
- `src/core/sim/player-history.ts` — Spielhistorie: die persoenlichen Etappen aus dem Ereignisarchiv. — gelesen: 43 Zeilen
- `src/core/sim/player-jobs.ts` — Spieler-Jobs in fremden Casinos. Sims-Style Arbeit an Job-Stationen. — gelesen: 149 Zeilen
- `src/core/sim/player-look.ts` — Der Look des Spielers: reine Daten, keine Gameplay-Wirkung. — gelesen: 56 Zeilen
- `src/core/sim/player-needs-tick.ts` — Tick-Anbindung der Spielerbeduerfnisse; eigene Datei haelt tick.ts in seiner LOC-Zone. — gelesen: 18 Zeilen
- `src/core/sim/player-needs.ts` — Spielerbeduerfnisse: Hunger und Durst als echter, gespeicherter Spielzustand. — gelesen: 153 Zeilen
- `src/core/sim/player-rpg.ts` — Spieler-RPG: 7 Attribute, Level, XP und Kampfkoerper. Rein deterministisch, ohne Geldbewegung. — gelesen: 130 Zeilen
- `src/core/sim/player.ts` — Spieler-Commands: Laufen, Tragen, Zapfen, Kasse, Deko, Ausbau. Mit Weg und Reichweite. — gelesen: 150 Zeilen
- `src/core/sim/progression.ts` — Unternehmensfortschritt: das Casino waechst, nicht der Charakter. — gelesen: 164 Zeilen
- `src/core/sim/property.ts` — Erste Immobilie: Katalog, Kauf aus dem Portemonnaie, Eigentumszuweisung und — gelesen: 159 Zeilen
- `src/core/sim/queue-spots.ts` — Kassenschlange: eindeutige, erreichbare Wartepositionen – auch bei grossem Andrang. — gelesen: 56 Zeilen
- `src/core/sim/remodel.ts` — Umbau: Voraussetzungen und Deckung pruefen, dann das bestehende Haus erweitern. — gelesen: 30 Zeilen
- `src/core/sim/renovation.ts` — Renovierung der eigenen Immobilie: Stufen ohne zweites Save-Feld. — gelesen: 177 Zeilen
- `src/core/sim/rival-ai/actions.ts` — Fuehrt eine geplante Rivalenaktion aus. Jede Wirkung ist benannt und belegt: — gelesen: 101 Zeilen
- `src/core/sim/rival-ai/minds.ts` — Anlegen, Normalisieren und Nachschlagen der Rivalen-Zustaende; ohne Spielwirkung. — gelesen: 107 Zeilen
- `src/core/sim/rival-ai/policy.ts` — Reine Rivalen-Politik: gleiche Eingabe, gleiche Absicht. — gelesen: 81 Zeilen
- `src/core/sim/rival-ai/tick.ts` — Ein Tick Rivalen-Denken: Eingaben aus der Welt, Absicht aus der reinen Politik. — gelesen: 43 Zeilen
- `src/core/sim/rival-ai/types.ts` — Rivalen-Domaene: persistenter Zustand, Absichts-Typen und harte Grenzen. — gelesen: 61 Zeilen
- `src/core/sim/rivals.ts` — Fremde Casinos: eigene Betreiber, eigene Maschinen, eigene Regeln. — gelesen: 181 Zeilen
- `src/core/sim/room-plan.ts` — Raumplan aus dem Layout: Zonen sind Raeume, Kanten sind ihre Zugaenge. — gelesen: 134 Zeilen
- `src/core/sim/room-transition.ts` — Nahtlose Raum- und Gebäudeübergänge für Akteure (Spieler und NPCs). — gelesen: 192 Zeilen
- `src/core/sim/self-exclusion-bet.ts` — Self-Exclusion als Spiel: Der Pakt belohnt Disziplin und protokolliert Wortbruch ehrlich. — gelesen: 100 Zeilen
- `src/core/sim/service-actions.ts` — Gast-Aktionen: ausstehende Gelder an Gäste auszahlen. Reine Welt-Logik ohne Tick. — gelesen: 18 Zeilen
- `src/core/sim/smartphone-views.ts` — Smartphone-Sichten: Inbox, Vitter-Feed und ImmoLuck. — gelesen: 168 Zeilen
- `src/core/sim/social-encounter.ts` — import type { ActorContinuityRecord } from './actor-continuity'; — gelesen: 112 Zeilen
- `src/core/sim/spawn.ts` — Ein einzelner Gast: Profil, Fiat und Weg zur Kasse. Wie viele kommen, plant demand.ts. — gelesen: 104 Zeilen
- `src/core/sim/staff-cashier.ts` — Kassierer: Fiat wechseln, Service quittieren und die Warteschlange weiterziehen. — gelesen: 35 Zeilen
- `src/core/sim/staff-porter.ts` — Lagerpersonal: Kisten aufnehmen, zur passenden Bar oder ins Lager bringen. — gelesen: 63 Zeilen
- `src/core/sim/staff-qualification.ts` — Qualifikation des Personals. — gelesen: 57 Zeilen
- `src/core/sim/staff-queries.ts` — Die eine Personalabfrage. — gelesen: 97 Zeilen
- `src/core/sim/staff-step.ts` — Gemeinsame Personal-Navigation: ein Feld pro Tick, alle sechs Ticks ein neuer Weg. — gelesen: 27 Zeilen
- `src/core/sim/staff.ts` — Personal: eingestellte Rollen bekommen einen Körper, der auf dem Floor arbeitet. — gelesen: 148 Zeilen
- `src/core/sim/stain.ts` — Fleck-/Verschmutzungssystem. Headless, deterministisch, keine Browser-Abhängigkeiten. — gelesen: 44 Zeilen
- `src/core/sim/templates.ts` — Drei Floor-Blueprints: klein, mittel, gross. Jeder Bereich ist 30x30 Kacheln. — gelesen: 143 Zeilen
- `src/core/sim/tick-timing.ts` — Eine Quelle fuer die Tick-Dauer: Simulation, Renderer und UI rechnen mit demselben Takt. — gelesen: 4 Zeilen
- `src/core/sim/tick.ts` — Ein Tick der Welt: Spawn, Wege, Service, Laune, Dreck, Personal. — gelesen: 176 Zeilen
- `src/core/sim/traits.ts` — Gast-Erzeugung: Persona plus zufaellig verteilter Max-Pool fuer Laune, Geduld und Sucht. — gelesen: 74 Zeilen
- `src/core/sim/treat-influence.ts` — Döner-/Treat-Wirkung: liest den Kontext aus dem Zielmoebel und die — gelesen: 32 Zeilen
- `src/core/sim/tx-reasons.ts` — Ein Ort für Buchungsgründe: Wer bucht und wer klassifiziert, liest dieselben — gelesen: 90 Zeilen
- `src/core/sim/types-model.ts` — Welttypen ohne den Weltzustand selbst. — gelesen: 157 Zeilen
- `src/core/sim/types.ts` — Ein einziger serialisierbarer Weltzustand. Geld liegt nicht hier, sondern im Ledger. — gelesen: 143 Zeilen
- `src/core/sim/upkeep-costs.ts` — Laufende Wohnkosten: eine Quelle fuer Tagesbuchung und HUD-Ziel. — gelesen: 10 Zeilen
- `src/core/sim/upkeep.ts` — Laufende Pflege der Welt: Tageslohn, Miete, verwaiste Sitze und Gast-Laune. — gelesen: 70 Zeilen
- `src/core/sim/venue-event.ts` — Zentrale Event-Infrastruktur: Veranstaltungen laufen als Phasen ueber die — gelesen: 176 Zeilen
- `src/core/sim/visitors.ts` — Besucherprofile: Gaeste bleiben ueber Besuche hinweg erkennbar; die Liste ist begrenzt. — gelesen: 105 Zeilen
- `src/core/sim/world.ts` — Welt-Helfer: Zonen, Objekte, Reservierungen, freie Plaetze. — gelesen: 177 Zeilen
- `src/debug/runtime-probe-render.ts` — RBD Runtime Probe — Render-Informationen (DEV-only, READ-ONLY). — gelesen: 63 Zeilen
- `src/debug/runtime-probe-snapshot.ts` — RBD Runtime Probe — Welt-Snapshot-Funktionen (DEV-only, READ-ONLY). — gelesen: 101 Zeilen
- `src/debug/runtime-probe-types.ts` — RBD Runtime Probe — Typen (DEV-only). — gelesen: 68 Zeilen
- `src/debug/runtime-probe.ts` — RBD Runtime Probe — DEV-only, READ-ONLY Gameplay-Diagnose (Haupteinstieg). — gelesen: 47 Zeilen
- `src/main.tsx` — import { StrictMode } from 'react'; — gelesen: 50 Zeilen
- `src/render/__tests__/actor-silhouette.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 17 Zeilen
- `src/render/__tests__/ambient-late-texture.test.ts` — Die Lichttextur wird lazy geladen. Ein identischer Ambient-Plan darf den — gelesen: 36 Zeilen
- `src/render/__tests__/ambient-plan.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 162 Zeilen
- `src/render/__tests__/atlas.test.ts` — Shelf-Plan: deterministische Reihenfolge, keine Ueberlappung, harte Seitengrenze. — gelesen: 43 Zeilen
- `src/render/__tests__/city-door-click.test.ts` — Die vier Stadtkanten sind nur dann Tueren, wenn Treffer, Aktion und Uebergang — gelesen: 129 Zeilen
- `src/render/__tests__/city-exterior.test.ts` — Abnahme ohne Screenshot: der normale Store-Einstieg erzeugt die 60x60-Stadt, — gelesen: 168 Zeilen
- `src/render/__tests__/city-growth-plan.test.ts` — Jeder Gebäudetyp, den das Wachstum erzeugen darf, muss im Renderplan eine — gelesen: 44 Zeilen
- `src/render/__tests__/city-shadow-late-texture.test.ts` — Schatten und Licht teilen die lazy geladene Radialtextur. Fehlt sie beim — gelesen: 69 Zeilen
- `src/render/__tests__/decor-roles.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 33 Zeilen
- `src/render/__tests__/depth.test.ts` — Ein gemeinsamer Tiefenvertrag: Fussanker statt Oberkante, deterministisches — gelesen: 119 Zeilen
- `src/render/__tests__/floor-actions.test.ts` — Der Lager-Spiegel ist die einzige Deko mit einer Charaktereditor-Aktion; — gelesen: 28 Zeilen
- `src/render/__tests__/floor-anchor.test.ts` — Der Weltanker ist die Gegenrichtung zum Trefferpfad: derselbe Punkt muss — gelesen: 42 Zeilen
- `src/render/__tests__/floor-cache.test.ts` — Regions-Hash, Invalidierung, LOD, Culling und Koordinaten sind reine Mathe. — gelesen: 88 Zeilen
- `src/render/__tests__/floor-camera-bounds.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 70 Zeilen
- `src/render/__tests__/floor-camera.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 39 Zeilen
- `src/render/__tests__/floor-hit.test.ts` — Ein Trefferpfad: Tiefe vor Array-Reihenfolge, Figur vor Moebel, Wand vor — gelesen: 73 Zeilen
- `src/render/__tests__/floor-input.test.ts` — Ein Klick, ein Ergebnis: Maus und Finger teilen den Trefferpfad, die — gelesen: 95 Zeilen
- `src/render/__tests__/floor-layout.test.ts` — Bodenmaterialien kommen aus dem Layout, nicht aus Zonen. Fallback-IDs, — gelesen: 161 Zeilen
- `src/render/__tests__/guest-sprite.test.ts` — Gast-Bemalung nutzt echte Sprite-Bauteile aus dem Charakter-Atlas statt — gelesen: 78 Zeilen
- `src/render/__tests__/light-pool.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 28 Zeilen
- `src/render/__tests__/locomotion.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 28 Zeilen
- `src/render/__tests__/motion-preference.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 16 Zeilen
- `src/render/__tests__/perf-governor.test.ts` — Hysterese: Wechsel erst nach zwei Sekunden Abweichung, nicht nach einem Frame. — gelesen: 42 Zeilen
- `src/render/__tests__/plinko-board-geometry.test.ts` — Die Brettgeometrie ist die einzige Quelle fuer Stiftpositionen und den — gelesen: 64 Zeilen
- `src/render/__tests__/reaction-feedback.test.ts` — Integration scope: reaction-feedback contracts. — gelesen: 221 Zeilen
- `src/render/__tests__/rig-combat.test.ts` — Kampf und Verletzung muessen sichtbar sein: eigene Posen, eigene Uebergaenge, — gelesen: 35 Zeilen
- `src/render/__tests__/rig.test.ts` — Das Rig ist reine Mathematik: gleiche Zeit, gleiche Pose, klarer Zustand. — gelesen: 37 Zeilen
- `src/render/__tests__/room-chunk-clip.test.ts` — Ein Chunk wird als Textur gebacken. Zeichnet eine Zone oder die Weltkante — gelesen: 87 Zeilen
- `src/render/__tests__/routes-key.test.ts` — Der Laufweg-Cache haengt an der Zonengeometrie. Ein Layout-Import mit — gelesen: 35 Zeilen
- `src/render/__tests__/slot-layout.test.ts` — Die Walzenanzeige rechnet nur ueber diese Geometrie. Werte, die hier stimmen, — gelesen: 50 Zeilen
- `src/render/__tests__/sound-fx.test.ts` — Lautstaerke und Kanaele sind Geraeteeinstellungen: sie muessen klemmbar, getrennt — gelesen: 33 Zeilen
- `src/render/__tests__/staff-actor-state.test.ts` — Personal ist kein verschobener Wurzelknoten: Es bekommt Facing, Gang und — gelesen: 92 Zeilen
- `src/render/__tests__/view-layers.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 76 Zeilen
- `src/render/actor-pool.ts` — Wiederverwendbare Figuren und Sticker: im Frame entstehen keine neuen Text-/Graphics-Objekte. — gelesen: 61 Zeilen
- `src/render/actor-silhouette.ts` — Akteur-Silhouette für das Übersichts-LOD. — gelesen: 25 Zeilen
- `src/render/ambient-layer.ts` — Ambient-Schicht: statischer Schleier, statische Sonnenstrahlen und ein — gelesen: 109 Zeilen
- `src/render/ambient-plan.ts` — Ambient-Vertrag: Helligkeit, Sichtradius und Sonnenrichtung kommen allein aus — gelesen: 210 Zeilen
- `src/render/apartment-furniture-art.ts` — Die Wohnung teilt die Möbelmechanik mit dem Casino, aber nicht dessen Optik: — gelesen: 81 Zeilen
- `src/render/art-tokens.ts` — import type { DayPhase } from '../core/sim/day-phase'; — gelesen: 135 Zeilen
- `src/render/assets/__tests__/asset-semantics.test.ts` — Vertrag des Asset-Semantik-Katalogs. Der Test liest den Katalog als Daten, — gelesen: 190 Zeilen
- `src/render/assets/__tests__/textures-preload.test.ts` — R8-Boot-Grenze: Der Test ruft die echte Produktionsfunktion — gelesen: 64 Zeilen
- `src/render/assets/asset-semantics.json` — { — gelesen: 1319 Zeilen
- `src/render/assets/atlas.ts` — Laufzeit-Atlas: nutzt die im Build gepackten Seiten, wenn das Manifest sie — gelesen: 169 Zeilen
- `src/render/assets/keys.ts` — Paketpfade, die echte Renderer brauchen: Figuren, Tischdeko, Boden und Partikel. — gelesen: 56 Zeilen
- `src/render/assets/manifest.json` — { — generiert, 2000 Zeilen
- `src/render/assets/textures.ts` — Texturen aus dem Pixel-Paket: erst der Laufzeit-Atlas, dann die Einzeldatei. — gelesen: 109 Zeilen
- `src/render/city-actor-sync.ts` — Stadtbewohner als Straßenfiguren. — gelesen: 86 Zeilen
- `src/render/city-exterior-layer.ts` — Sichtbare Stadt: Fassaden, Strassenrequisiten und Tuerkanten aus dem einen — gelesen: 243 Zeilen
- `src/render/city-plan.ts` — Reiner Renderplan der Stadt: Rollen, Assets und echte Layoutkanten. — gelesen: 97 Zeilen
- `src/render/city-roles.ts` — Stabile Rollen fuer die Stadtflaechen. Kein Label-Regex, kein Farbwert als — gelesen: 69 Zeilen
- `src/render/city/__tests__/city-assets.test.ts` — R8: Jede Stadttextur hat Rolle, Welt, ganzzahlige displayScale und — gelesen: 199 Zeilen
- `src/render/city/city-assets.ts` — Stadt-Assetpaket: die eine Metadatenquelle fuer sichtbare Stadttexturen. — gelesen: 162 Zeilen
- `src/render/comic-bubbles.ts` — Kleine Comic-Sprechblase: eine Grafik statt eines Satzes, pro Figur gepoolt. — gelesen: 152 Zeilen
- `src/render/decor-roles.ts` — Stabile Renderrollen für Möbel und Deko. — gelesen: 107 Zeilen
- `src/render/depth-perf.bench.ts` — Tiefensortierung derselben Szene auf SMALL, MEDIUM und LARGE: 200 Figuren, — gelesen: 48 Zeilen
- `src/render/depth.ts` — Gemeinsamer Tiefenvertrag der Szene: sortiert wird ausschliesslich nach dem — gelesen: 56 Zeilen
- `src/render/editor-overlay.ts` — Editor-Auswahl als reine Pixi-Darstellung: eine Zelle und optional ihre Kante. — gelesen: 50 Zeilen
- `src/render/entity-sync.ts` — Figuren- und Möbelsync eines Frames: aus dem Snapshot in die Tiefenebene, — gelesen: 221 Zeilen
- `src/render/floor-actions.ts` — Baut die Aktionskarte fuer ein geklicktes Ziel. Eine Quelle fuer Maus, Tastatur und Touch. — gelesen: 223 Zeilen
- `src/render/floor-animate.ts` — Floor-Animation: Tick, Kamera, Figuren-Animation. — gelesen: 45 Zeilen
- `src/render/floor-camera-rig.ts` — Kamera-Buehne: der Pixi-Container, die Zoom-/Schwenk-Wahrheit und die LOD-Stufe. — gelesen: 116 Zeilen
- `src/render/floor-camera.ts` — Kamera mit zwei Zoom-Stufen und expliziten Weltgrenzen; lerpt ohne Frame-Allokationen. — gelesen: 209 Zeilen
- `src/render/floor-cash.ts` — Kasse als Objekt: offene Gewinne liegen als Chip-Stapel am Wechseltisch. — gelesen: 69 Zeilen
- `src/render/floor-crates.ts` — Lieferkisten: am Boden abgelegt oder sichtbar am Traeger. Liest nur Snapshots. — gelesen: 110 Zeilen
- `src/render/floor-cues.ts` — Bodenhinweise: Spielerring, Zielraster, Laufweg und Klick-Puls in einer Ebene. — gelesen: 218 Zeilen
- `src/render/floor-events.ts` — Die eine Tabelle: Ereignis -> Burst, Ton, Licht, Shake und Anker. — gelesen: 131 Zeilen
- `src/render/floor-hit.ts` — Ein Trefferpfad fuer Maus und Finger. — gelesen: 189 Zeilen
- `src/render/floor-input.ts` — Floor-Input: ein Trefferpfad, eine Aktionsliste, ein Ergebnis. Kein zweiter Klickpfad. — gelesen: 121 Zeilen
- `src/render/floor-interact.ts` — Verarbeitet Radial-Menu-Aktionen vom Floor. — gelesen: 26 Zeilen
- `src/render/floor-material.ts` — Bodenmaterialien aus dem Layout: pro `FloorMaterialId` genau eine — gelesen: 141 Zeilen
- `src/render/floor-math.ts` — Reine Floor-Mathe: Regions-Hash, Invalidierung, LOD, Culling, Koordinaten. Kein Pixi. — gelesen: 156 Zeilen
- `src/render/floor-perf.bench.ts` — Worst-Case: 90×90-Floor, 9 Regionen, 500 Dreck-Tiles, 200 Entities. — gelesen: 55 Zeilen
- `src/render/floor-props.ts` — Requisiten: Personal, Lieferkisten, Streitmarker und Platzierungs-Geist. Liest nur Snapshots. — gelesen: 218 Zeilen
- `src/render/floor-route.ts` — Laufwege: Teppichlaeufer zwischen den Raeumen, gelegt von Zonenrand zu Zonenrand, — gelesen: 96 Zeilen
- `src/render/floor-stage.tsx` — React-Bruecke zur Pixi-Buehne; haelt keinen Spielzustand. — gelesen: 132 Zeilen
- `src/render/floor-surface.ts` — Bodenflaeche und Licht: Muster je Material, Fugen, Deckenlampen und — gelesen: 127 Zeilen
- `src/render/floor-touch.ts` — Zeigergesten auf dem Canvas: Ein-Finger-Ziehen schwenkt, Tippen laeuft, Pinch zoomt. — gelesen: 181 Zeilen
- `src/render/floor-view.ts` — Pixi-Floor: gecachter Raum, zwei LOD-Stufen, weiche Kamera, gepoolte Akteure. Liest nur Snapshots. — gelesen: 242 Zeilen
- `src/render/furniture-art.ts` — Moebel: der Korpus kommt aus dem Atlas, nur Zustand und Sitze bleiben dynamisch. — gelesen: 132 Zeilen
- `src/render/furniture-atlas.ts` — Ein Korpus je Bauart und Groesse als RenderTexture. Instanzen zeichnen danach — gelesen: 220 Zeilen
- `src/render/fx/emitter.ts` — Partikel aus dem Paket: Gewinn- und Verlustmomente nutzen dieselben Emitter wie die Bibliothek. — gelesen: 171 Zeilen
- `src/render/fx/floor-fx.ts` — Partikel, Licht und Shake auf der Pixi-Buehne: Weltkoordinaten, ein Ticker, kein React. — gelesen: 116 Zeilen
- `src/render/games/blackjack-canvas.ts` — Blackjack-Tisch in Pixi: Dealer oben, Spieler unten, Karten fliegen aus dem Schuh. — gelesen: 142 Zeilen
- `src/render/games/blackjack-stage.tsx` — React-Bruecke zum Blackjack-Tisch; die Runde kommt aus dem Kern, hier nur die Karten. — gelesen: 53 Zeilen
- `src/render/games/card-renderer.ts` — Eine Spielkarte in Pixi: Vorderseite, Rueckseite, 3D-Flip und Flug aus dem Schuh. — gelesen: 168 Zeilen
- `src/render/games/dice-canvas.ts` — Der Wuerfeltisch in Pixi: Filz, Bande und zwei Wuerfel, die auf dem Kern-Ergebnis liegen bleiben. — gelesen: 160 Zeilen
- `src/render/games/dice-stage.tsx` — React-Bruecke zum Wuerfeltisch; die Augen kommen aus dem Kern. — gelesen: 49 Zeilen
- `src/render/games/plinko-assets.ts` — Plinko-Texturen: Pegs und Auszahlungsfelder, mit gezeichnetem Rueckfall. — gelesen: 48 Zeilen
- `src/render/games/plinko-board-geometry.ts` — Plinko-Board-Geometrie: Stiftpositionen und Taschenboden. — gelesen: 74 Zeilen
- `src/render/games/plinko-canvas.ts` — Das Plinko-Brett als Pixi-Buehne: Stifte, Deflektoren, Taschen und die echte Ballbahn. — gelesen: 219 Zeilen
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
- `src/render/guest-art.ts` — Pixel-Figur: Rig, Bemalung und Sticker hinter einer Fassade; die Buehne liest nur diese. — gelesen: 113 Zeilen
- `src/render/guest-head.ts` — Kopf und Gesicht der Pixelfigur: Schaedel, Haar, Augen, Mund und Kopf-Textur. — gelesen: 112 Zeilen
- `src/render/guest-paint.ts` — Bemalung der Pixelfigur: Palette, Persona-Farben, Koerper, Beine, Arme und Pin. — gelesen: 137 Zeilen
- `src/render/guest-parts.ts` — Gaeste-Teile, die einmal gelten: Palette, Kopftexturen und der eine Schatten. — gelesen: 50 Zeilen
- `src/render/guest-rig.ts` — Skelett der Pixelfigur: Container, Gelenke, Silhouette, Namensschild, Squash und Tap-Ring. — gelesen: 142 Zeilen
- `src/render/haptics.ts` — Haptik ohne neue Abhaengigkeit: WebView-Vibration, respektiert reduced motion. — gelesen: 16 Zeilen
- `src/render/light-pool.ts` — Licht als ein Layer, nicht als 16 gestapelte Ellipsen pro Zone. — gelesen: 81 Zeilen
- `src/render/locomotion.ts` — Lauf- und Richtungsvertrag für Figuren. — gelesen: 37 Zeilen
- `src/render/motion-preference.ts` — Systemeinstellung „Bewegung reduzieren". Reine Darstellung entscheidet damit, — gelesen: 23 Zeilen
- `src/render/music.ts` — Musikschicht in der vorhandenen Audioarchitektur: eigene Lautstaerke, drei — gelesen: 189 Zeilen
- `src/render/perf-governor.ts` — Drei Leistungsstufen mit Hysterese. Der Governor bekommt nur deltaMS; er — gelesen: 58 Zeilen
- `src/render/pixel-head.ts` — Figuren aus dem Paket: ein Kopf-Sprite, das die gezeichnete Figur ersetzt, wenn es geladen ist. — gelesen: 29 Zeilen
- `src/render/player-marker.ts` — Zustandsmarker ueber dem Spieler: Verletzung und Handgemenge auf dem Floor. — gelesen: 26 Zeilen
- `src/render/reaction-feedback.ts` — Maps game-state transitions to visual reaction cues without introducing — gelesen: 148 Zeilen
- `src/render/rig-pose.ts` — Reine Pose-Mathematik fuer das Pixel-Rig; ohne Pixi testbar. — gelesen: 131 Zeilen
- `src/render/rig.bench.ts` — Rendering-nahe Posekosten; bewusst nicht Teil von verify:all. — gelesen: 28 Zeilen
- `src/render/rng.ts` — Der eine Darstellungs-Strom: Partikel und Sound, nie der Spielzustand. — gelesen: 4 Zeilen
- `src/render/room-art.ts` — Raum: Bodenmaterial je Tile aus dem Layout, Waende und Tueren aus den — gelesen: 108 Zeilen
- `src/render/room-dressing.ts` — Raumausstattung ueber dem Bodenbelag: das, was einen Raum wiedererkennbar macht, — gelesen: 122 Zeilen
- `src/render/scene-cache.ts` — Vier Render-Layer. Boden und Dreck liegen in 30×30-Regions-Chunks; nur veraenderte backen neu. — gelesen: 193 Zeilen
- `src/render/sound-fx.ts` — Prozeduraler WebAudio-Synth: alle Effekte ohne Asset, mit getrennten Kanaelen und stillem Fallback. — gelesen: 216 Zeilen
- `src/render/stage-backdrop.ts` — Bühnenhintergrund: ferne Fliesen plus eine naehere, gegenlaeufige Parallax-Ebene. — gelesen: 51 Zeilen
- `src/render/view-layers.ts` — Snapshot in die vorhandenen Darstellungs-Layer schieben. — gelesen: 70 Zeilen
- `src/render/visual/__tests__/scene-frame.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 64 Zeilen
- `src/render/visual/scene-frame.ts` — Deterministischer Bildvertrag für die vier R1-Szenen. — gelesen: 184 Zeilen
- `src/render/wall-art.ts` — Türschwellen aus den gespeicherten Kanten. Wandkoerper liegen bewusst nicht — gelesen: 107 Zeilen
- `src/render/wall-occlusion.ts` — Vordergrund-Waende als eigene Occlusion-Schicht. Jede Wand ist ein Sprite in — gelesen: 74 Zeilen
- `src/render/world-bounds.ts` — Die Kamera-Grenzen sind die echten Weltkanten, nicht die Casino-Vorlage. — gelesen: 8 Zeilen
- `src/store/__tests__/card-payout.test.ts` — Der Hausvorteil des fremden Hauses darf nur den Gewinn treffen. Einsatz, — gelesen: 29 Zeilen
- `src/store/__tests__/city-actors.test.ts` — Stadtbewohner sind Figuren, keine Popup-Zeilen: Der Snapshot liefert sie mit — gelesen: 61 Zeilen
- `src/store/__tests__/city-door-walk.test.ts` — Ein ferner Tuerklick ist ein Weg, kein Sprung: Der Spieler laeuft zur — gelesen: 63 Zeilen
- `src/store/__tests__/city-exterior-view.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 26 Zeilen
- `src/store/__tests__/city-growth-view.test.ts` — Die Wachstumssicht ist eine Projektion: `buildView` liest dieselbe — gelesen: 68 Zeilen
- `src/store/__tests__/determinism.test.ts` — Determinismus: derselbe Seed und dieselben Ticks ergeben denselben Spielzustand, — gelesen: 53 Zeilen
- `src/store/__tests__/exclusion-command.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 35 Zeilen
- `src/store/__tests__/first-evening.test.ts` — Der erste Abend als eine Kette: Eröffnung → Stadt → Casino → Automat aus der — gelesen: 111 Zeilen
- `src/store/__tests__/foreign-walkable.test.ts` — Der fremde Floor ist begehbar: Bewegung, Tick, Maus-/Touch-Laufauftrag, — gelesen: 121 Zeilen
- `src/store/__tests__/house-debt.test.ts` — Die offene Haus-Schuld ist keine zweite Zahl: Der Snapshot liest den negativen — gelesen: 43 Zeilen
- `src/store/__tests__/ledger-tick-balance.test.ts` — Die Bilanz ist eine Invariante des vollstaendigen Takts, nicht nur des — gelesen: 79 Zeilen
- `src/store/__tests__/loaded-city-population.test.ts` — Die Kette Laden -> Sicht -> Begegnung: Ein Save, der bereits in der Stadt — gelesen: 86 Zeilen
- `src/store/__tests__/narrative-commands.test.ts` — Die Store-Naht drainiert Facts an der Mutationsgrenze und fuehrt Choices aus. — gelesen: 92 Zeilen
- `src/store/__tests__/narrative-rival-source.test.ts` — Eine echte Kartenabrechnung im fremden Haus erzeugt eine Rivale-zu-Haus-Kante. — gelesen: 55 Zeilen
- `src/store/__tests__/narrative-save.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 143 Zeilen
- `src/store/__tests__/new-game.test.ts` — Ein neues Spiel beginnt in der Wohnung; die Haustür führt auf die Straße, und — gelesen: 69 Zeilen
- `src/store/__tests__/onboarding-save.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 33 Zeilen
- `src/store/__tests__/own-door-to-city.test.ts` — Nach dem Onboarding traegt die eigene Haustuer den Rueckweg: sie steht im — gelesen: 52 Zeilen
- `src/store/__tests__/own-play.test.ts` — Die Fassade haelt offene Kartenrunden genau einmal, blockiert Doppelbuchungen — gelesen: 81 Zeilen
- `src/store/__tests__/prng-persistence.test.ts` — Der PRNG-Zustand setzt nach dem Laden die Folge exakt fort, ohne Doppelziehung. — gelesen: 70 Zeilen
- `src/store/__tests__/property-command.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 34 Zeilen
- `src/store/__tests__/rival-play-commands.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 43 Zeilen
- `src/store/__tests__/save-device.test.ts` — Alte Speicherstaende koennen eine Geräteidentität tragen, die zum Spieltyp — gelesen: 71 Zeilen
- `src/store/__tests__/save-layout.test.ts` — Save v11: Layout-Vertrag im Spielstand, Migration aus v5–v10 und — gelesen: 125 Zeilen
- `src/store/__tests__/save-migration.test.ts` — Ein v5-Spielstand behaelt Fiat und offene Ansprueruche beim Laden. — gelesen: 123 Zeilen
- `src/store/__tests__/save-reels.test.ts` — Alte Speicherstaende koennen eine ungueltige Walzenzahl tragen. Das Laden — gelesen: 65 Zeilen
- `src/store/__tests__/save-rivals.test.ts` — Der Rivalen-Zustand steht im Save und ueberlebt einen Neustart; ein v9-Stand — gelesen: 47 Zeilen
- `src/store/__tests__/save-roundtrip.test.ts` — Speichern, laden und danach exakt dieselbe Simulation fortsetzen. — gelesen: 129 Zeilen
- `src/store/__tests__/save-staff.test.ts` — Alte Speicherstaende trugen den Guard als Flag neben den Agenten. Beim Laden — gelesen: 77 Zeilen
- `src/store/__tests__/save-v7.test.ts` — Ein v6-Spielstand bekommt Kisten, Agenten und Bedürfnisse mit Defaults; v7 bleibt rund. — gelesen: 119 Zeilen
- `src/store/__tests__/save-wage-field.test.ts` — Saves vor der Anwesenheitsregel tragen kein `lastWorkDay` im Job. — gelesen: 63 Zeilen
- `src/store/__tests__/snapshot-purity.test.ts` — Ein Snapshot ist eine Projektion: Er darf weder Bewohnerprofile anlegen noch — gelesen: 65 Zeilen
- `src/store/__tests__/staff-view.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 15 Zeilen
- `src/store/__tests__/street-population.test.ts` — Der erste Schritt vor die Tür füllt die Stadt: Die drei kuratierten Figuren — gelesen: 54 Zeilen
- `src/store/__tests__/transfer.test.ts` — Import/Export: Der eigene Export muss sich wieder importieren lassen. Die — gelesen: 55 Zeilen
- `src/store/archive-snapshot.ts` — Archiv-Projektion: kopiert nur, wenn das Archiv gewachsen oder verschoben wurde. — gelesen: 14 Zeilen
- `src/store/city-actors-view.ts` — Bewohner als Renderdaten: eine Ableitung aus dem Stadtleben, keine Kopie. — gelesen: 22 Zeilen
- `src/store/city-commands.ts` — Store-Bruecke: die Stadt bleibt headless, hier wird nur verdrahtet. — gelesen: 111 Zeilen
- `src/store/city-door-walk.ts` — Der Weg zur Stadtschwelle: ein ferner Tuerklick ist ein Auftrag, kein Sprung. — gelesen: 83 Zeilen
- `src/store/city-exterior-view.ts` — Eine Exterieur-Ansicht je gespeicherter Stadt. — gelesen: 19 Zeilen
- `src/store/foreign-floor-commands.ts` — Foreign Floor Commands: Besucher- und Job-Aktionen in fremden Casinos. — gelesen: 62 Zeilen
- `src/store/foreign-play.ts` — Fremde Haeuser: Spiel und Besuch. — gelesen: 161 Zeilen
- `src/store/game-commands.ts` — Game Commands: Spielautomaten, Plinko, Ausschluss. — gelesen: 41 Zeilen
- `src/store/interaction-store.ts` — Zielfokus des Stores: planen, laufen lassen, abbrechen. Haelt keinen zweiten Zustand. — gelesen: 59 Zeilen
- `src/store/interior-commands.ts` — Szenenwechsel in und aus Stadt-Innenräumen; ein Zustand, keine Kopie der Stadt. — gelesen: 52 Zeilen
- `src/store/layout-editing.ts` — Editor-Verlauf am Store-Rand: typisierte Commands anwenden, Pinselstriche — gelesen: 90 Zeilen
- `src/store/layout-transfer.ts` — Layout-Export und -Import am Store-Rand. Der Import prueft das Dokument — gelesen: 55 Zeilen
- `src/store/legacy-demand.ts` — Legacy-Savefeld aus der Zeit vor NAR-13; nur noch fuer die Migration. — gelesen: 7 Zeilen
- `src/store/memory.bench.ts` — Speicher- und Save-Groesse: eine definierte 1000-Tick-Sitzung, kein Sample-Ring. — gelesen: 33 Zeilen
- `src/store/migrate-layout.ts` — Layout-Migration: v11 liest den gespeicherten Plan, v5–v10 leiten ihn — gelesen: 31 Zeilen
- `src/store/migrate-narrative.ts` — Hydration der Narrative-Domaene und der Besucher-Erinnerungen beim Laden. — gelesen: 102 Zeilen
- `src/store/migrate-staff.ts` — Personal-Migration alter Speicherstaende. — gelesen: 39 Zeilen
- `src/store/migrate-stains.ts` — Hydration von Flecken und Wischern für Save-Migration (v9). — gelesen: 10 Zeilen
- `src/store/migrate.ts` — Hydration und Migration gespeicherter Stände (v5/v6/v7) in eine frische Welt. — gelesen: 190 Zeilen
- `src/store/mop-commands.ts` — Wischer-Commands getrennt vom uebrigen Venue-Modul. — gelesen: 57 Zeilen
- `src/store/narrative-clock.ts` — Popup-Pause fuer Erzaehlfristen: der Welt-Tick laeuft weiter, offene Szenen verlieren keine Zeit. — gelesen: 23 Zeilen
- `src/store/narrative-commands.ts` — Store-Naht fuer Narrative: Choice ausfuehren, Szene ablehnen und Facts flushen. — gelesen: 41 Zeilen
- `src/store/narrative-store-actions.ts` — Narrative Store-Aktionen: Ausfuehrung und Meldung getrennt von der Facade. — gelesen: 21 Zeilen
- `src/store/narrative.bench.ts` — NAR-16: Narrative Hotpath. Gemessen wird ein realistischer Tick nach einem — gelesen: 53 Zeilen
- `src/store/new-game.ts` — Ein neuer Start: Wohnung first, leeres eigenes Casino und eine Starter-Kiste. — gelesen: 51 Zeilen
- `src/store/own-play.ts` — Store-Fassade fuer eigene Spielrunden: Der Kern rechnet und bucht, die — gelesen: 105 Zeilen
- `src/store/perf-hot-paths.bench.ts` — Messpfad fuer RBD-16: langer Spielstand, 200 Gaeste, 90x90-Floor. — gelesen: 88 Zeilen
- `src/store/player-tools.ts` — Spieler-Commands, die der Store nur noch bestaetigt. — gelesen: 48 Zeilen
- `src/store/queue-commands.ts` — Queue-Commands: die UI reiht Auftraege ein, der Store bleibt der Eigentuemer. — gelesen: 36 Zeilen
- `src/store/rival-play-commands.ts` — Rival Play Commands (fremde Casinos). — gelesen: 89 Zeilen
- `src/store/save.ts` — Save v11: Welt + Layout + Ledger-Log + Journal + PRNG + Narrative-Domaene + Rivalen-Zustand. — gelesen: 170 Zeilen
- `src/store/scene-commands.ts` — Szenenwechsel: Wohnung, Stadt, eigenes Casino und zurueck; kein zweiter Spielzustand. — gelesen: 214 Zeilen
- `src/store/scene-projection.ts` — Szenen-Kopf des Snapshots: eine Stelle, die alle Szenen benennt. — gelesen: 21 Zeilen
- `src/store/service-commands.ts` — Service Commands: Gäste bedienen, Bezahlen, Bewegen. — gelesen: 25 Zeilen
- `src/store/snapshot.ts` — Snapshot aus Welt und Ledger; keine eigene Geldwahrheit in der UI. — gelesen: 189 Zeilen
- `src/store/staff-view.ts` — Personal-Sicht der UI: der Guard besteht, sobald sein Agent existiert. — gelesen: 8 Zeilen
- `src/store/transfer.ts` — Import und Export von Spielstaenden: Plan zuerst, Anwenden erst nach Pruefung. — gelesen: 48 Zeilen
- `src/store/types.ts` — Was die UI sieht: Welt plus abgeleitete Ledger-Werte. — gelesen: 173 Zeilen
- `src/store/use-world-store.ts` — import { useSyncExternalStore } from 'react'; — gelesen: 9 Zeilen
- `src/store/venue-commands.ts` — Venue Commands: Bau, Einrichtung, Preise – alles was das Haus verändert. — gelesen: 177 Zeilen
- `src/store/world-store.ts` — Ein Besitzer: Welt, Ledger, PRNG, Uhr und Save. Commands delegiert an Module. — gelesen: 167 Zeilen
- `src/styles/app.css` — { box-sizing: border-box; } — gelesen: 742 Zeilen
- `src/styles/index.css` — Quelldatei ohne Kopfkommentar — gelesen: 3 Zeilen
- `src/styles/layout-editor.css` — Nur der dynamisch geladene Editor importiert diese Regeln; im Produktionsbuild fehlen sie. — gelesen: 21 Zeilen
- `src/styles/popup.css` — .popup-backdrop { — gelesen: 724 Zeilen
- `src/styles/tokens.css` — Eine Bildsprache fuer UI und Floor. Die Rollen hier sind dieselben wie in — gelesen: 82 Zeilen
- `src/test/measure.ts` — Explizite Messung: feste Iterationszahl, ein Warmup, monotone Uhr. — gelesen: 26 Zeilen
- `src/test/random-seed.ts` — import { randomInt } from 'node:crypto'; — gelesen: 9 Zeilen
- `src/ui/__tests__/action-queue-panel.test.tsx` — Die Queue ist die sichtbare Auftragskette: auch der fuenfte Auftrag muss — gelesen: 45 Zeilen
- `src/ui/__tests__/anchor-layout.test.ts` — Reine Klemm-Geometrie: Der Viewport ist eine Zahl, der Kamerawechsel ein — gelesen: 106 Zeilen
- `src/ui/__tests__/card-tables.test.tsx` — Eine laufende Blackjack-Hand darf nicht durch neues Austeilen ersetzt werden, — gelesen: 134 Zeilen
- `src/ui/__tests__/casino-window-header.test.tsx` — import { describe, expect, it } from 'vitest'; — gelesen: 29 Zeilen
- `src/ui/__tests__/city-popup.test.tsx` — Ansprechbar ist nur, wer am selben Ort steht. Der Klick reicht die — gelesen: 96 Zeilen
- `src/ui/__tests__/dialog-request.test.ts` — Der Router oeffnet genau dann einen Dialog, wenn eine aufgeloeste Choice — gelesen: 49 Zeilen
- `src/ui/__tests__/dialogue-ui.test.tsx` — Die Blase zeigt Sprecher und Lauftext des aktuellen Knotens; Direktlinks — gelesen: 55 Zeilen
- `src/ui/__tests__/editor-gate.test.ts` — Editor-Freigabe: der Query-Parameter allein oeffnet nie einen Produktionsbuild. — gelesen: 31 Zeilen
- `src/ui/__tests__/editor-tools.test.ts` — Editor-Werkzeuge: Command-Absicht und Tastaturkuerzel sind rein und testbar; — gelesen: 45 Zeilen
- `src/ui/__tests__/floor-keyboard.test.ts` — E waehlt die Hauptaktion des offenen Fokus, aber nie aus einem Eingabefeld — gelesen: 78 Zeilen
- `src/ui/__tests__/floor-scenes.test.ts` — Die Regel ist die eine Freigabe für Maus, Touch, WASD, E und Enter. Jeder — gelesen: 44 Zeilen
- `src/ui/__tests__/goal.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 144 Zeilen
- `src/ui/__tests__/guest-profile.test.tsx` — Der Gast-Popup reicht nur die Besucher-ID an den Aufrufer; Profile und — gelesen: 59 Zeilen
- `src/ui/__tests__/hud-labels.test.ts` — HUD-Texte: Schwellen bleiben stabil, damit Ruf und Laune nicht springen. — gelesen: 37 Zeilen
- `src/ui/__tests__/hud-money.test.tsx` — import { describe, expect, it } from 'vitest'; — gelesen: 51 Zeilen
- `src/ui/__tests__/input-parity.test.tsx` — Tastatur und Pointer laufen pro Aktion durch denselben Handler. Die Tests — gelesen: 202 Zeilen
- `src/ui/__tests__/machine-play.test.tsx` — Der Betrieb behält den kostenlosen Diagnose-Testspin. Der Gast bekommt ohne — gelesen: 94 Zeilen
- `src/ui/__tests__/narrative-ui.test.tsx` — Die UI zeigt nur, was der Snapshot liefert: Szenentext, Frist, gesperrte — gelesen: 113 Zeilen
- `src/ui/__tests__/onboarding-start-steps.test.tsx` — Der Startpfad als geführter Weg: je Schritt genau ein Modal, und im Raum — gelesen: 96 Zeilen
- `src/ui/__tests__/perspective-switch.test.tsx` — import { cleanup, fireEvent, render, screen } from '@testing-library/react'; — gelesen: 23 Zeilen
- `src/ui/__tests__/phase34-acceptance.test.tsx` — import { readFileSync } from 'node:fs'; — gelesen: 62 Zeilen
- `src/ui/__tests__/placement-fit.test.ts` — Das Ablegen per Enter stellt am eigenen Feld ab; die eigene Kachel darf — gelesen: 41 Zeilen
- `src/ui/__tests__/player-dashboard.test.tsx` — Das Charakterfenster zeigt Werte aus der Karriere-Sicht, nicht aus einem zweiten Zustand. — gelesen: 177 Zeilen
- `src/ui/__tests__/self-exclusion-panel.test.tsx` — import { cleanup, fireEvent, render, screen } from '@testing-library/react'; — gelesen: 47 Zeilen
- `src/ui/__tests__/small-screen-acceptance.test.tsx` — Abnahme Phase 2: die App rendert die Welt bei 320/360 px ohne Tab-Wechsel. — gelesen: 135 Zeilen
- `src/ui/__tests__/small-screen-dock.test.tsx` — Abnahme Phase 2: alle Dock-Einstiege und die Gaesteuebersicht bleiben bei — gelesen: 80 Zeilen
- `src/ui/__tests__/small-screen-layout.test.ts` — CSS-Vertrag fuer schmale Viewports. jsdom hat keine Layout-Engine; deshalb — gelesen: 91 Zeilen
- `src/ui/__tests__/small-screen-panels.test.tsx` — Abnahme Phase 2 auf kleinen Displays: Die Aktionskarte klemmt an beiden — gelesen: 138 Zeilen
- `src/ui/__tests__/smartphone-apps.test.tsx` — Die drei neuen Apps sind nur über das Gerät erreichbar: das Tile muss den — gelesen: 65 Zeilen
- `src/ui/__tests__/ui.test.tsx` — UI-Integration ohne Pixi: Zustand, Fokus, Filter und Rivalenprofile. — gelesen: 187 Zeilen
- `src/ui/__tests__/venue-history.test.tsx` — Die Historie der Veranstaltung ist ein Leser der vorhandenen Event-Instanz: — gelesen: 43 Zeilen
- `src/ui/__tests__/world-first-ui.test.tsx` — World-first: Der NPC oeffnet ein Objektpanel am Ziel, die Aktionskarte haengt — gelesen: 112 Zeilen
- `src/ui/action-card.tsx` — Aktionskarte: eine grosse Empfehlung, zwei Alternativen, ein Schliessen. — gelesen: 65 Zeilen
- `src/ui/action-queue-panel.tsx` — Queue-Anzeige: der aktive Auftrag und seine naechsten Schritte, direkt am Floor. — gelesen: 40 Zeilen
- `src/ui/anchor-layout.ts` — Klemm-Geometrie fuer Weltanker. Reine Funktion: Projektion und Viewport sind — gelesen: 109 Zeilen
- `src/ui/app-effects.ts` — App-Effekte: Ton, Musik, Fokus und Haptik als eigene Zustaendigkeit. — gelesen: 92 Zeilen
- `src/ui/app-model.ts` — App-Modell: Popup-Ziele, Bau-Fit und Bewegungsachsen; aus App ausgelagert (LOC-Budget). — gelesen: 40 Zeilen
- `src/ui/app-wiring.ts` — App-Verdrahtung: Navigation, Floor-Aktionen und Kisten ohne eigenen Zustand. — gelesen: 73 Zeilen
- `src/ui/asset-library-popup.tsx` — Asset-Bibliothek: alles, was im Paket liegt, ist im Spiel sichtbar und anhoerbar. — gelesen: 191 Zeilen
- `src/ui/bet-console.tsx` — Wettkonsole unter den Walzen: Jetons, Autospin und der eine grosse Knopf. — gelesen: 42 Zeilen
- `src/ui/build-catalog-cards.tsx` — Katalog-Karten: kaufbare Spiele und Deko als Drag-fähige Bau-Karten. Reine Darstellung. — gelesen: 45 Zeilen
- `src/ui/build-crate-list.tsx` — Kisten im Betriebspanel: reine Statusanzeige. Aufheben und Abladen macht der Charakter auf dem Floor. — gelesen: 46 Zeilen
- `src/ui/build-ops-summary.tsx` — Kompakte Betriebsübersicht: die vier Zahlen, die den Floor erklären. — gelesen: 46 Zeilen
- `src/ui/build-panel-connected.tsx` — Betriebs-Panel: verdrahtet das Panel mit dem Store; App haelt nur den Schalter. — gelesen: 38 Zeilen
- `src/ui/build-panel-parts.tsx` — Bau-Sektionen: Personal, Hauswahl, Farben, Streit. Reine Darstellung. — gelesen: 128 Zeilen
- `src/ui/build-panel.tsx` — Bau-Popup: kaufen, liefern, Personal, Preise, Deko und Freischaltung. — gelesen: 183 Zeilen
- `src/ui/career-backyard.tsx` — Hinterhof-Karriere im Charakterfenster: eine Sektion, keine zweite Oberflaeche. — gelesen: 83 Zeilen
- `src/ui/career-esport.tsx` — Stadtliga im bestehenden Charakterfenster: Tabelle, Rollen und Abend aus derselben Ableitung. — gelesen: 59 Zeilen
- `src/ui/career-floor.tsx` — Arbeitsqualitaet im Charakterfenster: welche Rolle welches Attribut traegt. — gelesen: 27 Zeilen
- `src/ui/career-history.tsx` — Spielhistorie im Charakterfenster: die letzten Etappen aus dem Archiv, keine zweite Chronik. — gelesen: 30 Zeilen
- `src/ui/career-property.tsx` — Erste Immobilie im Charakterfenster: Katalog, Besitz, Betrieb und Renovierung aus derselben Sicht. — gelesen: 160 Zeilen
- `src/ui/career-section.tsx` — Karriere-Sektion des Charakterfensters: eine Sicht, eigene Ownership. — gelesen: 79 Zeilen
- `src/ui/casino-window-header.tsx` — Kopfzeile eines Casino-Fensters: Geldtoepfe, verbaute Mods, Pakt und Vollbild. — gelesen: 52 Zeilen
- `src/ui/city-popup.tsx` — Stadt-Fenster: Orte, Handlungen, Energie, Progression und das Wachstum. — gelesen: 168 Zeilen
- `src/ui/connected-hud.tsx` — HUD-Verdrahtung: Perspektivwechsel, Skills und Welt-Einstieg an einer Stelle. — gelesen: 27 Zeilen
- `src/ui/diagnostics-popup.tsx` — Diagnose: Buchhaltung, Personal, Lager und Protokoll auf einen Blick. — gelesen: 121 Zeilen
- `src/ui/dialog-request.ts` — Dialog-Anforderung aus einem Choice-Ergebnis. — gelesen: 15 Zeilen
- `src/ui/dialogue-popup.tsx` — Dialog: Comic-Dialog als reine Darstellung. — gelesen: 69 Zeilen
- `src/ui/dock.tsx` — Untere Leiste: wenige globale Einstiege, alles andere kommt aus der Welt. — gelesen: 98 Zeilen
- `src/ui/editor-gate.ts` — Editor-Freigabe: nur ein Build mit `RBD_EDITOR_MODE=1` und `?editor=1` — gelesen: 15 Zeilen
- `src/ui/editor-tools.ts` — Reine Werkzeuglogik des Layout-Editors: Sie uebersetzt die gewaehlte Absicht — gelesen: 53 Zeilen
- `src/ui/floor-feedback.tsx` — Floor-Rueckmeldung: Hinweise, Story-/Dialog-/Stadt-Einstiege und Toast. — gelesen: 48 Zeilen
- `src/ui/floor-keyboard.ts` — Tastaturpfad des Floors: E waehlt das naechste Ziel oder die Hauptaktion. — gelesen: 51 Zeilen
- `src/ui/floor-role-bar.tsx` — Rollenhinweis auf dem Floor: sagt, was der nächste Klick bewirkt. — gelesen: 28 Zeilen
- `src/ui/floor-scenes.ts` — Eine Regel fuer alle Floor-Eingaenge: Maus, Touch und Tastatur lesen dieselbe Szene. — gelesen: 29 Zeilen
- `src/ui/foreign-floor-hud.tsx` — Foreign Floor HUD: Anzeige auf fremden Floors. — gelesen: 88 Zeilen
- `src/ui/foreign-floor-map.tsx` — Foreign Floor Map: Übersichtskarte aller fremden Casinos. — gelesen: 97 Zeilen
- `src/ui/foreign-floor-popup.tsx` — Fenster auf einem fremden Floor: HUD plus Job-Menue an der gewaehlten Station. — gelesen: 54 Zeilen
- `src/ui/format.ts` — Kompakte Anzeige: VC ohne Zahlenrauschen. — gelesen: 19 Zeilen
- `src/ui/games-popup-lazy.tsx` — Chunk-Grenze fuer das Spiel-Paket: Engines, Tische und Pixi-Buehnen der — gelesen: 26 Zeilen
- `src/ui/games-popup.tsx` — Fremdes Haus: echte Rivalen mit Betreiber, Regeln, Maschinen und Hausvorteil. — gelesen: 150 Zeilen
- `src/ui/games-venue.tsx` — Fremdes Haus: Kopfzeile, Betreiberprofil und Geraetebuehne als eigene Zustaendigkeit. — gelesen: 120 Zeilen
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
- `src/ui/glossary.ts` — Ein Ort für Begriffe, die der Spieler sieht: kurze Erklärung statt Branchenjargon. — gelesen: 45 Zeilen
- `src/ui/goal.ts` — Das eine sichtbare Ziel des ersten Abends: eine Zahl, ein Balken, kein zweiter Zustand. — gelesen: 125 Zeilen
- `src/ui/guest-context-panel.tsx` — Objektpanel Gast: Eigenschaften und Handlungen am NPC, ohne die Welt zu verlassen. — gelesen: 119 Zeilen
- `src/ui/guest-popup.tsx` — Ein Klick auf einen Gast: Sticker, Budget und drei Werte mit klarer Folge statt Tabellen. — gelesen: 152 Zeilen
- `src/ui/help-popup.tsx` — Hilfe: Geldfluss, Gäste, Objekte und Steuerung in Klartext, erreichbar über das ? im HUD. — gelesen: 104 Zeilen
- `src/ui/hud-icons.ts` — HUD-Icons als Data-URI: die zwei 32x32-PNGs sind zusammen rund 4 KB und — gelesen: 10 Zeilen
- `src/ui/hud-labels.ts` — HUD-Texte: Labels, Ruf-Toene und Skill-Tipps als eigene Zustaendigkeit. — gelesen: 23 Zeilen
- `src/ui/hud-money.tsx` — Geldblock des HUD: Betrag, Kasse/Offen und Tagesziel in einer Achse. — gelesen: 56 Zeilen
- `src/ui/hud.tsx` — HUD: Marke, eine sichtbare Perspektive und nur die Zahlen, die zu ihr gehören. — gelesen: 159 Zeilen
- `src/ui/icons.ts` — Icons aus dem Paket: ein Pfad-Helfer, damit UI und Renderer dieselbe Basis nutzen. — gelesen: 28 Zeilen
- `src/ui/job-context-menu.tsx` — Job-Kontext-Menu: Sims-Style Interaktion an einer Job-Station. — gelesen: 115 Zeilen
- `src/ui/journal-popup.tsx` — Ereignisprotokoll: was passiert ist, warum, und was daraus folgt — live oder aus dem Archiv. — gelesen: 125 Zeilen
- `src/ui/journal-stories.tsx` — Abgeschlossene Szenen als Rueckblick im Journal; nur Anzeige des Snapshots. — gelesen: 47 Zeilen
- `src/ui/layout-editor-transfer.ts` — Export, Import und Fehleranzeige des Layout-Editors; kennt kein Layoutwissen. — gelesen: 40 Zeilen
- `src/ui/layout-editor.tsx` — Entwicklungs-Editor fuer das Raumlayout. Nur erreichbar, wenn der Build — gelesen: 154 Zeilen
- `src/ui/layout-room-summary.tsx` — Raumkopf des Layout-Editors: Zahlen aus dem vorhandenen Raumplan. — gelesen: 17 Zeilen
- `src/ui/look-popup.tsx` — Charaktereditor: reine Kosmetik, sofort im Save und auf dem Floor sichtbar. — gelesen: 101 Zeilen
- `src/ui/machine-mods.tsx` — Mod-Katalog am Automaten: Gaestewirkung und Wirkung auf die echte Engine. — gelesen: 53 Zeilen
- `src/ui/machine-operator.tsx` — Betriebskörper am Automaten: Zustand, Diagnose, Reparatur und Mods. — gelesen: 143 Zeilen
- `src/ui/machine-play-lazy.tsx` — Lazy-Grenze fuer die eigenen Spieltische: Pixi und Engines erst beim Gastmodus. — gelesen: 13 Zeilen
- `src/ui/machine-play.tsx` — Eigene Spiele am Automaten: dieselben Tische wie im Fremdhaus, eigener Geldweg. — gelesen: 56 Zeilen
- `src/ui/machine-popup.tsx` — Automaten-Popup: Gast spielt, Betrieb diagnostiziert. Eine globale Perspektive, kein interner Rollentoggle. — gelesen: 123 Zeilen
- `src/ui/narrative-events.tsx` — NAR-14: Aktive Szenen als Karten; Auswahl und Ablehnung laufen ueber Store-Commands. — gelesen: 113 Zeilen
- `src/ui/narrative-popup.tsx` — NAR-14: Popup fuer aktive Szenen und Besucherprofile. — gelesen: 45 Zeilen
- `src/ui/narrative-profile.tsx` — NAR-14: Besucherprofil aus dem Snapshot; Rechnungen bleiben im Core. — gelesen: 97 Zeilen
- `src/ui/npc-dialogue.tsx` — NPC-Dialog am Objekt: die Auswahl nennt vorhandene Commands, die Wirkung — gelesen: 84 Zeilen
- `src/ui/onboarding-panel.tsx` — Wohnung, Stadt und erster Auftrag: klare Schritte, keine zweite Spielzustandsmaschine. — gelesen: 114 Zeilen
- `src/ui/opening-card.tsx` — Die erste Szene: derselbe Runtime-Text wie die Narrative, nur als Einstiegskarte. — gelesen: 43 Zeilen
- `src/ui/perspective-switch.tsx` — Der eine Umschalter zwischen Spieler- und Betreiberblick. — gelesen: 33 Zeilen
- `src/ui/plinko-editor-lazy.tsx` — Chunk-Grenze fuer den Plinko-Editor: Der Editor zieht die 185-KB-Buehne — gelesen: 19 Zeilen
- `src/ui/plinko-editor.tsx` — Operator-Board-Editor: echte Konfiguration, ehrliches Gate, sichtbarer Fortschritt. — gelesen: 181 Zeilen
- `src/ui/popup-router-activity.tsx` — Aktivitaets-Routen: eigenes Geraet und fremdes Haus mit ihrer Verdrahtung. — gelesen: 76 Zeilen
- `src/ui/popup-router-travel.tsx` — Reise-Routen: fremde Karte und fremdes Haus als eigene Zustaendigkeit. — gelesen: 48 Zeilen
- `src/ui/popup-router.tsx` — Popup-Routing: eine Zustaendigkeit, damit App nur noch verdrahtet. — gelesen: 170 Zeilen
- `src/ui/popup-shell.tsx` — Ein Rahmen für alle Popups: Backdrop, Titel, Fokusfalle, Escape, Schließen. — gelesen: 103 Zeilen
- `src/ui/roulette-tableau.tsx` — Das Setzfeld: jede Zelle ist ein Feld, jeder Klick legt einen Jeton dorthin. — gelesen: 65 Zeilen
- `src/ui/self-exclusion-panel.tsx` — Self-Exclusion als Gameplay: kein verstecktes Menü, sondern ein sichtbarer Pakt. — gelesen: 78 Zeilen
- `src/ui/slot-rules-editor.tsx` — Regel-Editor am Automaten: Streifen, Gewichte, Modell, Volatilität und Bonus-Paytable. — gelesen: 138 Zeilen
- `src/ui/slot-telemetry.tsx` — Slot-Telemetrie: Historie, Abweichung, Druck und letzte Symbole ohne Beschönigung. — gelesen: 38 Zeilen
- `src/ui/smartphone-build.tsx` — Smartphone-App: BUILD - ersetzt BuildPanel — gelesen: 32 Zeilen
- `src/ui/smartphone-buy.tsx` — Smartphone-App: BUY - Getränke, Ersatzteile kaufen — gelesen: 25 Zeilen
- `src/ui/smartphone-clean.tsx` — Smartphone-App: CLEAN - Putzen — gelesen: 37 Zeilen
- `src/ui/smartphone-immoluck.tsx` — Smartphone-App: ImmoLuck — Katalogangebote, Kauf ueber den bestehenden Stadt-Pfad. — gelesen: 44 Zeilen
- `src/ui/smartphone-inbox.tsx` — Smartphone-App: Inbox — Nachrichten aus dem echten Ereignisarchiv. — gelesen: 33 Zeilen
- `src/ui/smartphone-serve.tsx` — Smartphone-App: SERVE - Getränke servieren — gelesen: 33 Zeilen
- `src/ui/smartphone-travel.tsx` — Smartphone-App: TRAVEL - Casino-Wechsel — gelesen: 30 Zeilen
- `src/ui/smartphone-vitter.tsx` — Smartphone-App: Vitter — Stadtfeed aus Erinnerungen und Geruechten. — gelesen: 38 Zeilen
- `src/ui/smartphone.tsx` — Gerät: optionale Abkürzungen für räumliche Handlungen. — gelesen: 86 Zeilen
- `src/ui/sound-popup.tsx` — Lautstaerke, Kanaele und Musik: Master plus Spiele, Kampf, Bedienung getrennt. — gelesen: 79 Zeilen
- `src/ui/staff-labels.ts` — Gemeinsame Klartext-Labels für Personalstatus in Panel und Diagnose. — gelesen: 24 Zeilen
- `src/ui/stage-controls.tsx` — Buehnenrand: nur die Kamera-Knoepfe. Tastenkuerzel stehen in der Werkstatt. — gelesen: 16 Zeilen
- `src/ui/table-launcher.tsx` — Waehlt das passende Fenster am Geraet: Walzen, Plinko oder Wuerfel. — gelesen: 145 Zeilen
- `src/ui/transfer-panel.tsx` — Import und Export: Spielstand als JSON sichern, pruefen und zurueckspielen. — gelesen: 49 Zeilen
- `src/ui/use-crate-actions.ts` — Kisten am Floor: Ein Klick gibt das Ziel, der Charakter laeuft hin und hebt auf oder stellt ab. — gelesen: 101 Zeilen
- `src/ui/use-floor-interaction.ts` — Ein Fokus fuer alle Eingaenge: Ziel waehlen, laufen, in Reichweite handeln. — gelesen: 175 Zeilen
- `src/ui/use-floor-keyboard.ts` — Bindet den reinen Floor-Tastenpfad an das Fenster; kein zweiter Listener je Szene. — gelesen: 13 Zeilen
- `src/ui/use-floor-selection-lifecycle.ts` — Fokus-Lebenszyklus des Floors: Szene, Zielart und Ankunft raeumen dieselbe Auswahl. — gelesen: 42 Zeilen
- `src/ui/use-stage-keys.ts` — Tastenpfad der Buehne: laufen, tragen, zoomen. App verdrahtet nur noch. — gelesen: 46 Zeilen
- `src/ui/use-world-anchor.ts` — Weltanker: haelt eine React-Karte am Objekt, auch wenn die Kamera faehrt. — gelesen: 158 Zeilen
- `src/ui/venue-history.tsx` — Veranstaltungs-Historie: Phasen und Ergebnis der vorhandenen Event-Instanz. — gelesen: 26 Zeilen
- `src/ui/workshop-parts.tsx` — Bausteine der Werkstatt: Rasterkarte, Steuerung und ein ehrlicher Live-FPS-Wert. — gelesen: 108 Zeilen
- `src/ui/workshop.tsx` — Werkstatt: sechs Bereiche in einem Raster, erreichbar nur ueber Marke oder Tastatur. — gelesen: 115 Zeilen
- `src/vite-env.d.ts` — / <reference types="vite/client" /> — gelesen: 3 Zeilen

### 18.4 Mechanische Auffaelligkeiten

- Keine Marker fuer offene Arbeit in getrackten Textdateien.

<!-- inventory:end -->

## Fortsetzungs-Log

| Turn | Erledigt |
| --- | --- |
| T86 | **2026-11-07 11:28 UTC**: Claim 27 nach dem Squash-Merge geschlossen. `reconcile-claims --apply` schreibt `merged` mit `mergedEvidence: branch-tree-on-main` und `mergedSha: cf76ea1`; Head `41fcada` und Merge teilen den Baum `7997502`. Geprueft: `main`-`CI Verify` auf `cf76ea1` erfolgreich (Run 42368226268), zweiter Reconcile-Lauf ohne Abweichung, `verify:claims`. |
| T85 | **2026-11-07 11:22 UTC**: Issue-Reopen, Sweep-SHA und Promote-Ziel mit Tests belegt. `pr-watcher.mjs` ist mit injizierbarer API/Git testbar und startet die CLI nur beim Direktaufruf; `promote-guard.mjs` liefert die reine `--base main`-Suche und die Dispatch-Entscheidung. Geprueft: `pr-watcher.test.ts` 3/3, `promote-guard.test.ts` 9/9, `claim-evidence.test.ts` 11/11 (zusammen 23/23), `node --check`, `verify:light`, `verify:claims`. |
| T84 | **2026-11-07 10:34 UTC**: Agenten-Isolation und Workflow-Härtung. `pretask` blockt geteilte Baeume mit `ERR-4019` (fremder offener Claim oder `--require-worktree`), `--json` nennt die Gruende; `turn:finish` staged weiter claim-begrenzt. `AGENTS.md` hat eine Testlinie. `long-checks.yml` nutzt `RBD_DAYS` statt Shell-Interpolation, alle Actions sind per 40-stelligem SHA gepinnt. Geprueft: 8/8 Isolations-, 4/4 Workflow-Tests, 6/6 ci-gates, `node --check`, `pretask --json`; volle Gates vor dem Commit: 186 Testdateien, 992 Tests bestanden, 6 uebersprungen, `verify:light`, Typecheck, Doku, Testqualitaet, Redundanz und LOC gruen. |
| T83 | **2026-11-07 08:03 UTC**: Impact-Matrix: Gates folgen dem echten Diff. |
| T82 | **2026-11-07 07:55 UTC**: Agentenverhalten als Vertrag: Pretask (Issue, Zustand, Impact, Lane), gezielte Nachweise, After-Task, begrenztes CI-Polling, Monitor nur berichtend; Durchsetzungstabelle in `AGENTS.md`. Geprueft: `verify:light`, Claim-Check. |
| T81 | **2026-11-07 06:31 UTC**: Gates granular: eine Matrix statt eines Monolithen. |
| T80 | **2026-11-06 21:45 UTC**: Audit #19 geschlossen. `GameView.company` aus `companyStatus()`, Firmenstufe in HUD/Betriebspanel mit offenen Bedingungen; Pixi-Start-Fehler zeigt Fallback statt schwarzer Flaeche. Branch-Hygiene: `integration` = `main` (`5ef2657`), PR #142 geschlossen, drei gemergte Refs geloescht, `feat/spatial-layout-editor` als einziger Arbeitsbranch. Geprueft: typecheck, 19 UI-/Progressions-Tests, `verify:all` zwoelf Gates. |
| T79 | **2026-11-06 21:30 UTC**: PR #150 (Floor als Spielwelt, GAST/BETRIEB) auf `main` (0.3.142) zusammengefuehrt. Perspektive als globale Rollenwahrheit, `MachineOperatorBody`/`MachinePlayLazy` und `PlinkoEditorLazy` im Operator-Koerper; Marke und `Ctrl+Shift+D` bleiben Werkstatt-Einstieg. Konflikte in sechs Code-Dateien, zwei Tests, Doku und Versionsdateien. |
| T78 | **2026-11-06 21:25 UTC**: PR #160 (Buehne aus der Legacy-Hot-Zone) auf `main` (0.3.141) zusammengefuehrt. `floor-camera-rig.ts` (106 Zeilen) und die drei Guest-Dateien (128/139/112) loesen die Legacy-Ausnahmen in `guest-art.ts` und `floor-view.ts`; `loc-budgets.mjs` fuehrt beide Eintraege nicht mehr. Konflikte nur in Doku und Versionsdateien, Code konfliktfrei. |
| T77 | **2026-11-06 21:20 UTC**: Perf-PR #161 auf `main` zusammengefuehrt. `main` (`b8a46be`, 0.3.140) in den PR-Branch gemergt; Konflikte nur in den sechs Pflichtdokumenten, Code und Assets konfliktfrei. WebP-Atlas 1.040.593 -> 384.234 B, Plinko-Buehne lazy (Initial-JS 1.186.336 -> 1.173.926 B), HUD-Icons als eigener 4.337-B-Chunk, Initialgraph 1.174.034 B/18 Chunks. |
| T76 | **2026-11-06 21:00 UTC**: Merge-Gate auf `main` reparieren. Ursache: Der Merge von PR #163 lief nur mit `commit_title`; der Merge-Commit `6f7a906` trug keine Pflichtsektionen, `verify-commit-msg --head` war rot (`ERR-4006`), `Bump, tag, release` und der APK-Bau fielen aus. Fix: Follow-up-PR von `main`, dessen Merge `commit_message` = PR-Body traegt; `docs/ARCHITECTURE.md` haelt Fall und Regel fest. Geprueft: `pnpm run verify:all` mit zwoelf gruenen Gates, `verify-commit-msg` gegen den alten Merge-Text (drei Fehlbefunde) und gegen den Fix-Text. |
| T75 | **2026-11-06 20:50 UTC**: Doku konsolidiert. Commits der letzten 48 Stunden, PRs und Altberichte geprueft; L1/L2/S1/Mods/Persona/Rivalenprofil im Code belegt, `PLAYER_CASH` ohne Produktions-Aufrufer und Umsatz-Kennzahl offen. 18 historische Berichte/Reviews/Plaene nach Ueberfuehrung in ROADMAP/INVENTORY/ARCHITECTURE/DEVTAGEBUCH geloescht. Geprueft: `verify:docs`, `verify:assets`, `verify:quick`, `build`, Produktionsbundle ohne Editor-Chunk, Narrative 65/65/65. |
| T74 | **2026-11-06 19:14 UTC**: Phase-3-Effekte im Browser abgenommen. Jackpot-Burst/Flash/Shake und Win-Sound, Kassen-Chips mit Coin-Sound, Mood-Bubble im Detail-LOD und alle acht Spiel-Identitaeten geprueft. Korrigiert: `GamesPopup` gibt `machine.game` weiter; `FloorCash` liegt sichtbar vor dem Wechseltisch. Geprueft: Typecheck, UI-Test 8/8, Browser ohne Konsolenfehler; `verify:quick` alle zehn Gates gruen. |
| T73 | **2026-11-06 18:33 UTC**: HUD-PNGs inline. `coin` und `guest-cyan` liegen als Data-URI in `src/ui/hud-icons.ts`; Slow 4G (1,6 Mbit/s, 150 ms, kalt) 24→22 Requests, erster Frame 12,16 s bei 2,42 MB. Geprueft: Build, Typecheck, beide Icons 32x32 ohne kaputte Bilder. |
| T72 | **2026-11-06 07:30 UTC**: Typecheck und Floor-Crash. `SceneCache.dirt` deklariert und zurueckgegeben (Pixi-`addChild(undefined)` behoben); `src/Config/tsconfig.json` Include auf `..` korrigiert, danach 87 Typfehler behoben; `src/vite-env.d.ts` mit `vite/client` und `.mjs`-Deklaration; doppelte `VISITOR_SERVICE`-Emissionen aus den Store-Commands entfernt. Geprueft: `typecheck` 0 Fehler, `verify:quick` zehn Gates gruen, `inventory:build` 1324/1324. |
| T71 | **2026-11-06 05:37 UTC**: Phase 2 Betriebssimulation. Persona-Einsatz, VELVET-Gaesteguete, echter Free-Drink-Bestand, EXTRA_REEL-Walze, Mod-Deduplizierung, CASHOUT-Reihenfolge, Ankunftsrate ohne Deckel, Slot-Pity-Ausgleich und Schuldentilgung. Geprueft: `verify:quick`, 40-Tage-Balance, 60.000-Spin-RTP; vollstaendiger `verify:all`-Lauf gruen. |
| T70 | **2026-11-06 04:58 UTC**: Eigener Gastmodus an allen acht Automaten. `core/sim/own-play.ts` und `store/own-play.ts` kapseln Einsatz, Gewinn, Schuld und Pending-Kartenrunden; `MachinePopup`/`MachinePlay` nutzen den vorhandenen `TableLauncher`. Geprüft: typecheck, ESLint, LOC; Core-, Store- und UI-Tests angelegt. |
| T69 | **2026-11-06 04:30 UTC**: Task 5, Phase 2: Editor-UI, Pixi-Auswahl und Export/Import. |
| T68 | **2026-11-06 03:32 UTC**: Gemeinsame Tiefensortierung und Occlusion. Neu: `src/render/depth.ts`, `entity-sync.ts`, `wall-occlusion.ts`, `__tests__/depth.test.ts`, `depth-perf.bench.ts`. Eine sortierbare Welt-Ebene für Möbel, Figuren, Requisiten und Wandvorderseiten; Fußanker, Typ-Rang, stabile ID; Sortierung nur bei Änderung. Geprüft: `typecheck`, 7 neue Tiefen-Tests, 47 Render-Tests, Messung SMALL 0,062 / MEDIUM 0,028 / LARGE 0,081 ms. |
| T67 | **2026-11-06 03:24 UTC**: Bodenmaterialien und Wände aus dem Layout. Neu: `src/render/floor-material.ts`, `wall-art.ts`, `__tests__/floor-layout.test.ts`. `FloorMaterialId` ist die einzige Materialauflösung (nur CARPET mit Manifest-Textur, stabile Fallback-IDs), `floor-surface.ts` verliert die falsche Muster-/Wallpaper-Zuordnung, Wände/Türen/Ecken kommen aus `layout.edges` mit einer Besitzregel je Kante, `regionHash` invalidiert tile-genau. Geprüft: `typecheck`, 12 neue Render-Tests, 40 Render-Tests gesamt, Bench-Vergleich 6,93 → 9,19 ms Vollback. |
| T66 | **2026-11-06 03:09 UTC**: Wände, Türen und Kanten-Navigation. Neu: `src/core/sim/nav-grid.ts`, `nav-reach.ts`, `__tests__/nav-edges.test.ts`. `blockedTiles()` sperrt nur noch Möbel; der Rand ist eine Wandkante. A* prüft `stepOpen()`, `accessPointsFor()` liefert alle Zugänge, `approachPoint()` bleibt Fallback, `canPlaceAt()` weist Tür-Tiles und versiegelnde Platzierungen ab. Geprüft: `typecheck`, 19/19 neue Navigations-Tests, Sim-/Store-Suiten 474 grün. |
| T65 | **2026-11-06 02:46 UTC**: Spatial Layout Contract und Save v11. Neu: `src/core/sim/layout-types.ts`, `layout-edges.ts`, `layout-validate.ts`, `layout-derive.ts`, `layout.ts`, `src/store/migrate-layout.ts`, `src/core/sim/__tests__/layout-contract.test.ts`, `src/store/__tests__/save-layout.test.ts`. `WorldState.layout` ist kanonisch, `size`/`zones` abgeleitet; Kanten sind je Achse und Ankerpunkt eindeutig, Türen mit stabilen IDs; Save v11 mit Migration v5–v10 und fail-closed Prüfung. Geprüft: `typecheck`, `check:loc`, `verify-test-quality`, `verify-tree`, 21/21 neue Tests. |
| T64 | **2026-11-05 05:39 UTC**: Huelle: Atlas, Budgets, APK. Zwei deterministische Atlasseiten (153 Frames, PNG-Codec ohne Dependency), `PerfGovernor` mit 2-s-Hysterese, Safe-Area/Hochformat, First-Frame-Handshake, Haptik ohne Dependency und Musik erst nach Geste; 4G: 20 Requests, 2,51 s, APK 21 MB. |
| T59 | **2026-11-05 04:26 UTC**: Dock statt Werkzeugwand. HUD 176 -> 113 (Marke, Geld, Gaeste, Ruf als Farbe); elf Aktionsknoepfe raus; neue `dock.tsx` (Bauen/Gaeste/Karte/Du, kontextuelles Putzen, Safe-Area), `popup-router.tsx` und `use-stage-keys.ts` aus App (348 -> 203), `workshop.tsx` buendelt journal/diagnostics/look/assets/sound/help/device; `Popup`-Union entsprechend verkleinert. |
| T60 | **2026-11-05 04:33 UTC**: Popup-Blur raus. `.popup-backdrop` ohne `backdrop-filter`, radialer Verlauf plus `contain: paint`; `reel-roll` animiert nur `transform`/`opacity`. |
| T61 | **2026-11-05 04:45 UTC**: Buehne. Neuer `furniture-atlas.ts` (RenderTexture je Bauart/Groesse, LOD-0 alpha 0.85), `guest-parts.ts` (Palette, Kopftexturen, gebackener Schatten), `core/sim/day-phase.ts`; `floor-surface` kachelt Boden/Tapete, `room-art` traegt Kontur und Schwelle, `room-dressing` setzt drei Requisiten je Zone, `scene-cache` backt je Tagesphase neu, `buildView` liefert `dayPhase`. |
| T62 | **2026-11-05 04:57 UTC**: Touch zuerst. `floor-touch` schwenkt mit einem Finger ab 8 px und tippt erst bei `pointerup`; `floor-cues` zeigt das Raster bei `pointerdown` mit 500 ms Nachleuchten und pingt mit drei gebackenen Ringen; `ui/action-card` ersetzt das Radialmenue; `guest-art` quetscht 90 ms und zeichnet einen Tap-Ring; `furniture-atlas` backt den Glow-Ring; `fx/emitter` poolt 200 Sprites, `fx/floor-fx` rechnet in Weltkoordinaten und traegt den Shake. `radial-menu`, `character-view` und `particle-overlay` sind geloescht. |
| T63 | **2026-11-05 05:11 UTC**: Geld fuehlt sich an. `floor-events.ts` (8 Ereignisse, Anker aus dem Snapshot), `floor-fx.ts` nur Darstellung mit Licht-Pool, `floor-cash.ts` (Chips, Puls, tickgedrosseltes Klingeln), `emitter.ts` (`smoke-puff`, `activeEmitterCount`), `comic-bubbles`/`guest-art` (Mood-Sprechblase), `popup-shell`/`games-popup`/`tokens.css` (Spiel-Identitaeten ueber `data-game`). |
| T58 | **2026-11-04 04:32 UTC**: B3: Fallback-Slots bei Namen nennen. |
| T57 | **2026-11-04 04:05 UTC**: B2: Slot-Zwecke im Composer. `ContentSlot.requiredContexts`, `ComposeRequest.requiredContexts`/`eventInstanceId`, harte Kontextpruefung in `selectFragment`, FNV-1a-Gleichstand, fuenf Templates mit Slot-Zwecken, Vokabular um sieben Kontexte erweitert; Content-Beitrag und Registry auf 29 Fragmente. |
| T56 | **2026-11-04 03:51 UTC**: Vision: Lebenssimulation statt Casino-Manager. `docs/ROADMAP.md` neu (Titel-Wortspiel, Casino als Testumgebung, bildhafter Pfad, Engine-Kern, MVP-/Optik-/Stadt-Grenze, NAR-Social-Plugin, Ledger-Ressourcen); README, ROADMAP, ARCHITECTURE, AGENTS, NARRATIVE-ENGINE (Abschnitt 18), ART-DIRECTION, INVENTORY und Asset-Pack eingeordnet; Save-Stand v10 korrigiert; Content-Beitrag und Registry auf 28 Fragmente. |
| T55 | **2026-11-04 03:35 UTC**: B1: Kontext-Helper fuer Szenen. |
| T54 | **2026-11-04 03:21 UTC**: A3: Narrative-JSON in test:affected. |
| T53 | **2026-11-04 03:12 UTC**: A1: Inventur und Validatoren vor dem Fruehausstieg. |
| T52 | **2026-11-04 03:00 UTC**: Test: Vollstaendige Narrative-Fixture. |
| T51 | **2026-11-04 02:42 UTC**: A3: Narrative-Validator im Pre-Commit-Hook. |
| T50 | **2026-11-04 02:37 UTC**: A2: Contribution-Inbox fail-closed. |
| T49 | **2026-11-04 02:31 UTC**: Korrektur: E2E-Disposition vollstaendig. |
| T48 | **2026-11-04 02:24 UTC**: Narrative-Entscheidungen zu Batch, Kontexten, Gegenmassnahme und Disposition. |
| T47 | **2026-11-04 01:58 UTC**: Profilweg und Geschichten-Historie. `NarrativeView.history` (juengste 12 abgeschlossene Szenen) und Gaeste auf dem Floor in den Profilen; `GuestPopup` oeffnet ueber `onProfile(visitorId)` das Profil, `NarrativePopup` startet mit `initialVisitorId` im Figuren-Tab, das Journal zeigt die Historie im Tab „Geschichten“. Neu: `src/ui/journal-stories.tsx`, `src/ui/__tests__/guest-profile.test.tsx`, Content-Beitrag `2026-11-04-journal-und-profilweg.json`. Geprueft: `narrative:check`, `typecheck`, `verify:quick`. |
| T46 | **2026-11-04 01:23 UTC**: NAR-17: Doku-, Katalog- und demandEvent-Sync mit Save v10. Save v10 und Rivalen-Domaene in ARCHITECTURE, AGENTS, PRODUCT, ROADMAP, NARRATIVE-ENGINE und Taskplan; `TRIGGER_DIALOG` und `demandEvent` nur noch als Migrationsfeld beschrieben; Katalog und Inventur regeneriert. |
| T45 | **2026-11-03 05:47 UTC**: Narrative-Review-Befunde S1 bis S16: Expiry, Demand, Slot-Map, Preflight, Locale, Migration, Duplikat, totale Ausfuehrung, ENGINE_DEMAND, maxOccurrences, legacy-Demand, guard-Flush, degraded, Doku. |
| T44 | **2026-11-03 02:32 UTC**: NAR-12 abgeschlossen: `narrative/runtime.ts` orchestriert Fact→Trigger→Scheduler in einem Lauf; Tick und Store-Mutationsgrenzen rufen ihn. `EVENT_RESOLVED` schliesst den Command→Fact-Kreis; zwei neue Testdateien, 21 Registry-Fragmente. |
| T43 | **2026-11-03 00:25 UTC**: NAR-06 abgeschlossen: `event-lifecycle.ts`, `event-scheduler.ts`, `event-schema.ts`, `event-types.ts` und `narrative-rng.ts` verwalten persistente Event-Instanzen mit Prioritaet, Fairness, Scopes, Cooldowns, Fristen, Stale-Cancel und eigenem Narrativ-RNG. Save v9 traegt die Felder additiv; Tests decken Lifecycle, Determinismus, Ketten, Historiengrenze und Roundtrip ab. Trigger-Auswahl im Tick bleibt NAR-12. |
| T42 | **2026-11-03 00:06 UTC**: NAR-05 abgeschlossen: `trigger-types.ts`, `trigger-context.ts`, `trigger-evaluate.ts` und `trigger-schema.ts` liefern Context, reine Auswertung aller Operatoren und fail-closed Schema-Validierung; `triggers.ts` bleibt Fassade. Alte `visitorId`-Facts und neue `actorRefs` werden einheitlich aufgeloest. Tests decken Operatoren, Grenzen, Historie, fehlende Referenzen und Unveraenderlichkeit ab. Tick-Anbindung und Cooldowns bleiben NAR-06/NAR-12. |
| T41 | **2026-11-02 23:37 UTC**: NAR-04 abgeschlossen: Streit, Kassenbedienung und Rivalenabrechnung erzeugen gerichtete Besucher-Besucher-, Besucher-Personal- und Rivale-Haus-Kanten. Neue Facts nutzen `actorRefs` statt Pflicht-`visitorId`; Schema, Kanonisierung, Pinning und Save-Roundtrip sind getestet. Aufgabe und Trigger/Scheduler bleiben offen. |
| T40 | **2026-11-02 23:20 UTC**: Optik und Steuerung. Neu: `src/render/floor-cues.ts` (Zielraster, Spielerring, Laufwegspur, Klick-Puls), `src/ui/stage-controls.tsx` (Steuerleiste mit Tastenkuerzeln, Kamera-Knoepfe), `src/render/__tests__/floor-camera.test.ts` (6 Faelle), `docs/ARCHITECTURE.md` und `docs/banners/art-direction-neon-ledger.png` (Bildsprache "Neon Ledger"). Geaendert: `floor-camera.ts` (+`pan`, `zoomStep`, `keepInView`), `floor-touch.ts` (Rad, Pinch, Ziehen; Wheel-Handler aus `floor-view.ts` uebernommen), `floor-view.ts` (Cues-Ebene, 349/350), `floor-surface.ts` (Lichtpfuetzen in 16 Stufen, Wandkanten, Laufweg), `floor-stage.tsx` (`zoom` im Handle), `App.tsx` (+/-/0 und Steuerleiste), `hud.tsx` (Barkauf-Chip, XP-Balken), `app.css` (Vignette, Raster, Zoom-Leiste, kbd-Chips). Geprueft: Browser 1600x1000 und 1000x720, typecheck, `verify:quick` auf eigenem Stand gruen (zehn Gates, 520 Tests); nach dem Rebase auf `origin/main` bestehen `process-sweep` und `slot-paylines` in Isolation (12/12), in der vollen Parallelitaet laufen sie unter Last ins Zeitlimit, CI traegt den vollen Nachweis. Offen: Lichtpfuetze je Chunk ohne Ueberlappung grosser Zonen, Touch-Pan ungeprueft. |
| T39 | **2026-11-02 23:20 UTC**: Ein Fact-Drain, Ledger-Cursor und Beziehungsgrundlage.
| T38 | **2026-11-02 22:49 UTC**: Nachfrageereignis auf Narrative-Zustand vorbereiten. |
| T37 | **2026-11-02 22:35 UTC**: Narrative-Dokumentation nach Merge wiederherstellen. |
| T36 | **2026-11-02 22:16 UTC**: Reiner Trigger-Evaluator fuer Kombinationen bestehender Facts und Weltwerte mit Grenzfalltests ergaenzt; Runtime-Anbindung und weitere Event-Bausteine bleiben offen. |
| T35 | **2026-11-02 21:58 UTC**: Narrative-State, Facts, Save, Nachfrage, Rivalen und Content-Inbox geprueft. Start-Pool-Doppelzaehlung und Fact-Normalisierung behoben; Taskplan ohne LLM im Spiel korrigiert. Event-Scheduler, Content-Compiler, Commands, Beziehungen und autonome Rivalen bleiben offen. |
| T34 | **2026-11-02 19:59 UTC**: Peer-Review Phase 6: `TICK_MS` zentralisiert (`src/core/sim/tick-timing.ts`), `spinTestCmd` nur einmal, `movement-queue` samt ERR-3002 entfernt, Texte und Portabilitaet (`opencode.json`, `encode-audio.mjs`). Befunde 1, 33, 37, 38: veraltet oder bereits behoben; 39 offen. Gameplay-Entscheidungen (VELVET, FREE_DRINK, EXTRA_REEL, Einsatzskalierung, Lohn, Schulden, Pity-RTP) bleiben offen. 524 Tests gruen, 2 uebersprungen. |
| T33 | **2026-11-02 11:40 UTC**: Pity-Entladung als Vorschuss (`settleSlotSpin`, signierter Topf), Wut aus `patience`, Sucht an Einsatz (+50 %) und Sitzung (4..9 Spins), `PLAYER_CASH` auszahlbar, `social` entfernt. Neue Tests: `pity-settlement`, `anger-patience`, `addiction-stake`, `player-cash` (13, 6 zuerst rot). v1.13. |
| T32 | **2026-11-02 11:30 UTC**: Synergie-Audit. `Persona.patience` war tot und verdrängte beim Stammgast die Geduld (51,1 gegen 63,9); `rollProfile` gewichtet sie jetzt, Summe bleibt 180. Offene Gaps mit Beleg in der Befundliste: `PLAYER_CASH`, `VELVET`, `FREE_DRINK`, `EXTRA_REEL`, Einsatzskalierung. Neuer Test `persona-patience` (2, 1 zuerst rot). v1.13. |
| T31 | **2026-11-02 11:17 UTC**: Tageslohn haengt an Arbeit. `PlayerJobState.lastWorkDay` wird in `completeJobTask` gestempelt; `payDailyWage` zahlt nur die Schicht des Vortags und nie rueckwirkend. `hydrateWorld` setzt das Feld fuer Alt-Saves auf 0. Neue Tests: `player-wage-attendance` (8, 4 zuerst rot), `save-wage-field` (4, 2 zuerst rot); drei bestehende Lohntests legen jetzt eine Schicht vor. v1.13. |
| T30 | **2026-11-02 11:08 UTC**: Sechs Verdrahtungsbefunde geschlossen. `muggingCoverPoint` misst die Deckung am Wechseltisch statt am Spieler; `disputeLevelForTicks` macht Stufe 2 innerhalb der fünf ANGRY-Ticks erreichbar; `guestsServed` zaehlt nur Gaeste mit Spin; `isJackpotLabel` verlangt 2,5x statt 1,0x; `decay` senkt `guest.anger`; HUD, Diagnose und Automaten-Popup lesen `barCapacityForLevel`. Neue Tests: `mugging-cover`, `guests-served`, `anger-decay`, `dispute-escalation`, `jackpot-label`, `bar-capacity` (12 gruen, 10 davon zuerst rot). v1.13. |
| T29 | **2026-11-02 10:52 UTC**: Vier offene Befunde gefixt. `dirtyTileIndex` in `emotion.ts` als gemeinsame Kacheladresse fuer `tick`, `disputes`, `needs`, `guest-play` (vorher `(y+1)*size+x+1`); Royal Flush verlangt Farbe, Wheel ist Strasse in `engines/cards.ts`, `evaluatePokerHand` exportiert; Dreckschicht als eigenes `dirt`-Feld zwischen Teppich und Moebeln (`scene-cache.ts`, `floor-view.ts`); Ueberfallverluste vor dem Quellkonto-Filter in `economics.ts`. Neue Tests: `dirty-index`, `economy-losses`, `video-poker-ranks` (9 gruen, 8 davon zuerst rot). v1.13. |
| T28 | **2026-11-02 10:42 UTC**: Governance entdoppelt. Neu: `scripts/lib/error-codes.mjs` (liest `error-codes.ts`, 30 Codes), `scripts/lib/subsystems.mjs` (12 Ordnerregeln, 16 Subsysteme, 15 Katalogsysteme, 11 Impact-Bereiche), `src/Config/escalation-levels.json`, `src/core/io/__tests__/escalation.test.ts`. `ERR-1001` in `error-codes.ts` und `docs/ARCHITECTURE.md` nachgetragen; `issues.ts`/`transfer.ts` nutzen `ERROR_CODES.TRANSFER_INVALID.code`; `report.mjs`, `verify-tree.mjs`, `test-catalog.mjs`, `affected-tests.mjs`, `impact.mjs`, `escalation.mjs` lesen die gemeinsamen Quellen. Offen: `verify-redundancy.mjs` parst den Katalog weiterhin selbst. v1.12. |
| T27 | **2026-11-01 23:18 UTC**: README-Onboarding und Entwicklerstart neu geordnet; Startkapital gegen `world-store` geprüft; Nutzerbanner übernommen, drei SVG-Trenner erstellt; Tree-Gate um JPEG-Belege ergänzt; pnpm-Setup in acht CI-Jobs ergänzt und Syntaxfehler im Version-Bump behoben. PR #39 war zunächst konfliktfrei, aber CI rot (pnpm fehlte); neue Gates und Merge stehen noch aus. Nach dem Merge WIP-Branches lokal und remote prüfen. |
| T26 | **2026-11-01 21:55 UTC**: Config-Umzug nachgezogen. Befund: `src/Config/capacitor.config.json` fehlte im Commit, weil `.gitignore` die Regel `capacitor.config.json` ungeankert fuehrte und damit auch die Quelle traf. Behoben: Regel auf `/capacitor.config.json` verankert (nur die Laufzeit-Kopie), Datei aus der History zurueck, `git check-ignore` als Probe. v1.23. |
| T25 | **2026-11-01 21:05 UTC**: Review-Nachlauf: fatale Promotion-Luecken geschlossen. Merge nutzt `PROMOTE_TOKEN` oder stoesst `Auto Version & Release` an; `integration` in `pr-cleanup.yml` und `branch-prune.mjs` geschuetzt; `cancelled` ist kein Urteil; `gh pr update-branch` gegen den Strict-Policy-Deadlock; leerer PR-Body ist `ERR-4006`. Gelesen: alle sechs Workflows, `ci-tag-release.mjs`, `verify-commit-msg.mjs`, `branch-cleanup.mjs`, `lib/escalation.mjs`. v1.22. |
| T24 | **2026-11-01 20:40 UTC**: Auto-Promotion und Integrationsbranch. Neu: `scripts/promote.mjs`, `.github/workflows/promote.yml`, `scripts/lib/identity.mjs`, `.mailmap`. Ein CI-Ergebnis entscheidet: gruen PR anlegen und mit Pflichtsektionen mergen, rot Label `integration/rot` und Stand auf die permanente Branch `integration`. Zwei parallele rote Staende werden komponiert (`git merge`), ein Textkonflikt bekommt `integration/konflikt`; kein force-Push, kein `-X theirs`. Identitaet `Vannon <Schneider.felix1993@gmail.com>` in `turn:finish` und im Workflow verdrahtet. Gelesen: `ci-verify.yml`, `pr-escalation.yml`, `auto-version-release.yml`, `pr-cleanup.yml`, `turn-push.mjs`, `.githooks/pre-commit`, `verify-tree.mjs`, `loc-budgets.mjs`, `docs/ARCHITECTURE.md`, `AGENTS.md`. v1.21. |
| T23 | **2026-11-01 19:50 UTC**: Doku-Konsolidierung, Sortierung und Repo-Hygiene. Umbenannt: `docs/event-narrative-engine-taskplan.md` → `docs/EVENT-NARRATIVE-ENGINE-TASKPLAN.md`, `docs/assets/casino-pixel-asset-pack.md` → `docs/ARCHITECTURE.md`; `docs/assets/` entfällt, 16 Doku-Dateien liegen flach. Widersprüche behoben: Save überall v9 (`vcoin.casino.v9`, Migration v5–v8), Narrative Engine als Stufe 1 statt „nicht gebaut", Gate-Zählung quick 10 / full 12 inkl. `assets`, `audit`, `build`. Fehlerkatalog repariert (verschmolzene ERR-4013/4014-Zeile) und aufsteigend sortiert. Hooks aktiviert (`core.hooksPath=.githooks`); das Doku-Gate ueberspringt Dotfiles in der Wurzel, weil `.turn-notes.md` den Turn-Abschluss sonst blockiert. Stand: `main` = `origin/main` = `c4e6e3b`, 983 Dateien, 67 Ordner. v1.20. |
| T22 | **2026-11-01 12:05 UTC**: Narrative Engine Stufe 1 (NAR-00 bis NAR-03) umgesetzt. Neu: `src/core/sim/narrative/{types,facts,state,memory}.ts`, `docs/ARCHITECTURE.md`, `content/narrative/{contributions,vocabulary}`; `WorldState.narrative`, `Visitor.memories`, Facts an Spawn/Rueckkehr/Auszahlung, Start-Pool mit Startkapital-Fact, Save v9 mit Normalisierung aus v5–v8, Tree-Gate kennt `content/`. Wirkung: Rueckkehrchance ±Erinnerungsbonus (letzte doppelt, Deckel), Spawn-Laune von Stammgaesten, Pool-Rueckkehr ab Tick 0. Tests: `narrative-facts`, `narrative-memory`, `narrative-start-pool`, `narrative-save`. Offen: NAR-04 bis NAR-17. v1.19. |
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
