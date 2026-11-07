# Repository-Inventur (lebendes Artefakt)

<!-- rbd-doc: v0.3.180 | 2026-11-07 13:21 UTC -->

> Zweck: vollständige, reproduzierbare Inventur der Repository. Dieses Dokument
> ist das einzige geschriebene Artefakt der Untersuchung und wird bei jeder
> Fortsetzung aktualisiert.
>
> | Versionierungs-Feld | Wert |
> | --- | --- |
> | **Version** | **v0.3.145** |
> | Erstellt | 2026-11-01 ~07:47 UTC (T1) |
> | **Aktualisiert** | **2026-11-06 (T81 — Doku-Konsolidierung)** |
> | Branch | `feat/spatial-layout-editor` (Basis `3b09a0f`) |
> | HEAD | `3b09a0f` plus T81-Doku-Commit (0.3.145) |
> | Arbeitsbaum | Doku-Commit; Remote `vannon091118/rigged-by-design`; Abdeckung und Dateizahl stehen in §18 |
>
> Fortsetzungs-Log am Ende dieses Dokuments.

## 1. Überblick

| Feld | Wert |
| --- | --- |
| Projekt | „Rigged by Design" — Lebenssimulation; das Casino ist Start- und Testumgebung, nicht das Genre (Satire, kein Echtgeld) |
| Stack | Vite 8 + React 19 + TypeScript 6 (strict) + PixiJS 8, Vitest 5, ESLint 10 |
| Version | 0.3.136 (`package.json` in diesem PR), Engine `node >=22.22.2`, `packageManager pnpm@10.4.1` |
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
| `docs` | 16 .md + `screenshots/README.md` + 5 Bannerbilder + 25 Screenshots | — | 16 Doku-Dateien flach unter `docs/` (Grossbuchstaben-Namen), Hauptbanner `banner.jpg`, Trennbilder und Altbanner als SVG; Belege in `screenshots/{current,comparison}` |
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

`store/save.ts` (vollständig): **Version 9**, Key `vcoin.casino.v9`; `LEGACY_KEYS` hebt v5–v8 (Fiat, offene Gewinne, Journal, Look, Besuchererinnerungen und PRNG-Position bleiben; v8 wird auf leere Narrativ-Defaults normalisiert), `OLD_KEYS` verwirft v3/v4. `migrate.ts` (vollständig): Hydration mit Default-Füllung, Heilung verwaister Referenzen (Kisten↔Agenten, Dispute↔Gäste), Geräteidentität aus Katalog, Personal-Migration (`migrate-staff.ts`: Guard-Flag → Agent).

## 9. Governance & Pipeline

- Fehlerregister: `core/governance/error-codes.ts` ↔ `docs/ARCHITECTURE.md`, `ERR-0000` fail-closed; Codes aufsteigend sortiert, inklusive `ERR-4017`–`ERR-4021` und `ERR-5001` (Formatfehler aus Befund 4 in T23 behoben).
- Pipeline: `scripts/run-pipeline.mjs` + `lib/pipeline-plan.mjs` (vollständig). Profile: quick = 10 Gates (lint, check:loc, typecheck, test-quality, dead-code, docs, tree, redundancy, assets, tests), full/release = zusätzlich audit und build = 12 Gates. Jedes Gate: harter Timeout, Inhalts-Hash-Cache, rein lesend; nur `fix` schreibt (ESLint `--fix`, Matrix, Katalog, Doku-Marker).
- LOC-Guard: `scripts/loc-budgets.mjs` (vollständig) — Rollen-Budgets, 6 Legacy-Einträge (350/200), keine neuen `@loc-exception`.

## 10. CI/CD (alle 6 Workflows vollständig gelesen)

| Workflow | Trigger | Aufgabe |
| --- | --- | --- |
| `ci-verify.yml` | push (**), PR gegen main, dispatch | Job **„Fail-Closed Gates"** = Pflichtstatus; `verify:all` mit `RBD_VERIFY_AUDIT=1`; Commit-/PR-Notes-Gate |
| `auto-version-release.yml` | workflow_run nach erfolgreichem CI Verify auf main (+dispatch) | taggt genau den geprüften Commit; Eskalationsleiter GITHUB_TOKEN→RELEASE_TOKEN→BLOCKED; kein Commit |
| `build-apk.yml` | workflow_call (Release mit `skip_verify`), dispatch, Tag-Push | Java 21, Android SDK 36, Debug + unsigned-Release-APK, Artefakt-Verifikation |
| `long-checks.yml` | dispatch (`pnpm run ci:long`) | Statistik (4 RTP-Dateien), Soak (100k Ticks), Balance-Lauf + Artefakt, Benchmarks |
| `pr-cleanup.yml` | PR closed (merged) | löscht Head-Branch (nicht main, nicht Fork, `keep-branch` schont) |
| `pr-escalation.yml` | PR gegen main | hebt den Commit-Body in den PR-Body (`lift-commit-body.mjs`), damit fehlende Pflichtsektionen nicht blockieren |

Branch-Schutz (Ebene B, laut CI-Gates-Anhang in `docs/ARCHITECTURE.md` seit 31.10.2026 aktiv): PR erforderlich, Pflichtstatus `Fail-Closed Gates`, kein Force-Push, keine Löschung.

## 11. Tests & Katalog

177 Testdateien; System und Beweisklasse je Datei erzeugt `pnpm run catalog` aus `@test-target` in `docs/INVENTORY.md` (Block unter §11). Statistik-/Performance-Klassen laufen nur in CI; `vite.config.ts` schließt im quick-Profil `round-rtp-*`, `soak`, `slot-session-rtp` aus.

### Testkatalog (generiert)

<!-- TEST_CATALOG_START -->
Summe: 196 Dateien — contract 118 · integration 41 · governance 23 · statistics 7 · performance 7.

| Testdatei | System | Beweisklasse | Lokal | Deklariertes Ziel |
| --- | --- | --- | --- | --- |
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
| `src/core/games/__tests__/pity-settlement.test.ts` | games | contract | ja | `src/core/games/slot-transparency.ts` |
| `src/core/games/__tests__/plinko-sandbox.test.ts` | games | contract | ja | `src/core/games/plinko-sandbox.ts` |
| `src/core/games/__tests__/plinko-track.test.ts` | games | contract | ja | `src/core/games/contracts.ts` |
| `src/core/games/__tests__/poker-distribution.test.ts` | games | statistics | nein, CI | `src/core/games/poker-hand.ts` |
| `src/core/games/__tests__/poker-table.test.ts` | games | contract | ja | `src/core/games/poker-table.ts` |
| `src/core/games/__tests__/risk-card.test.ts` | games | contract | ja | `src/core/games/risk-card.ts` |
| `src/core/games/__tests__/roulette-table.test.ts` | games | contract | ja | `src/core/games/roulette-table.ts` |
| `src/core/games/__tests__/round-rtp-high.test.ts` | games | statistics | nein, CI | `src/core/games/round.ts` |
| `src/core/games/__tests__/round-rtp-machines.test.ts` | games | statistics | nein, CI | `src/core/games/round.ts` |
| `src/core/games/__tests__/round.bench.ts` | games | performance | nein, CI | `src/core/games/round.ts` |
| `src/core/games/__tests__/round.test.ts` | games | contract | ja | `src/core/games/round.ts` |
| `src/core/games/__tests__/shell-round.test.ts` | games | contract | ja | `src/core/games/shell-round.ts` |
| `src/core/games/__tests__/slot-config.test.ts` | games | contract | ja | `src/core/games/slot-config.ts` |
| `src/core/games/__tests__/slot-paylines.test.ts` | games | contract | ja | `src/core/games/engines/slot.ts` |
| `src/core/games/__tests__/slot-profile.test.ts` | games | contract | ja | `src/core/games/slot-profile.ts` |
| `src/core/games/__tests__/slot-session-rtp.test.ts` | games | statistics | nein, CI | `src/core/games/slot-session.ts` |
| `src/core/games/__tests__/slot-transparency.test.ts` | games | contract | ja | `src/core/games/slot-transparency.ts` |
| `src/core/games/__tests__/test-spin.test.ts` | games | contract | ja | `src/core/games/sandbox.ts` |
| `src/core/games/__tests__/video-poker-ranks.test.ts` | games | contract | ja | `src/core/games/engines/cards.ts` |
| `src/core/games/engines/__tests__/blackjack.test.ts` | games | contract | ja | `src/core/games/engines/blackjack.ts` |
| `src/core/games/engines/__tests__/interactive-cards.test.ts` | games | contract | ja | `src/core/games/engines/interactive-cards.ts` |
| `src/core/governance/__tests__/affected-tests.test.ts` | pipeline | governance | ja | `scripts/lib/affected-tests.mjs` |
| `src/core/governance/__tests__/body-sync.test.ts` | pipeline | governance | ja | `scripts/lib/body-sync.mjs` |
| `src/core/governance/__tests__/branch-prune.test.ts` | pipeline | governance | ja | `scripts/lib/branch-prune.mjs` |
| `src/core/governance/__tests__/ci-gates.test.ts` | ci | governance | ja | `.github/workflows/ci-verify.yml` |
| `src/core/governance/__tests__/ci-plan.test.ts` | pipeline | governance | ja | `scripts/lib/ci-plan.mjs` |
| `src/core/governance/__tests__/claim-evidence.test.ts` | pipeline | governance | ja | `scripts/lib/claim-evidence.mjs` |
| `src/core/governance/__tests__/dependency-governance.test.ts` | governance | contract | ja | `src/core/governance/error-codes.ts` |
| `src/core/governance/__tests__/gate-diagnostics.test.ts` | pipeline | governance | ja | `scripts/lib/gate-diagnostics.mjs` |
| `src/core/governance/__tests__/gate-runner.test.ts` | pipeline | governance | ja | `scripts/lib/gate-runner.mjs` |
| `src/core/governance/__tests__/impact.test.ts` | pipeline | governance | ja | `scripts/lib/affected-tests.mjs` |
| `src/core/governance/__tests__/lane-claims.test.ts` | pipeline | governance | ja | `scripts/lib/lane-claims.mjs` |
| `src/core/governance/__tests__/narrative-compiler.test.ts` | pipeline | governance | ja | `scripts/lib/narrative-compiler.mjs` |
| `src/core/governance/__tests__/narrative-content.test.ts` | pipeline | governance | ja | `scripts/lib/narrative-content.mjs` |
| `src/core/governance/__tests__/pipeline-modes.test.ts` | pipeline | governance | ja | `scripts/lib/pipeline-plan.mjs` |
| `src/core/governance/__tests__/pr-watcher.test.ts` | pipeline | governance | ja | `scripts/pr-watcher.mjs` |
| `src/core/governance/__tests__/pretask.test.ts` | pipeline | governance | ja | `scripts/lib/worktree-isolation.mjs` |
| `src/core/governance/__tests__/process-sweep.test.ts` | pipeline | governance | ja | `scripts/lib/process-sweep.mjs` |
| `src/core/governance/__tests__/promote-guard.test.ts` | pipeline | governance | ja | `scripts/lib/promote-guard.mjs` |
| `src/core/governance/__tests__/release-escalation.test.ts` | pipeline | governance | ja | `scripts/lib/release-escalation.mjs` |
| `src/core/governance/__tests__/staging-scope.test.ts` | pipeline | governance | ja | `scripts/lib/staging-scope.mjs` |
| `src/core/governance/__tests__/test-catalog.test.ts` | pipeline | governance | ja | `scripts/lib/test-catalog.mjs` |
| `src/core/governance/__tests__/tree-changes.test.ts` | pipeline | governance | ja | `scripts/lib/tree-changes.mjs` |
| `src/core/governance/__tests__/workflow-hardening.test.ts` | ci | governance | ja | `.github/workflows/long-checks.yml` |
| `src/core/governance/__tests__/worktree-isolation.test.ts` | pipeline | governance | ja | `scripts/lib/worktree-isolation.mjs` |
| `src/core/io/__tests__/escalation.test.ts` | other | contract | ja | `src/core/io/issues.ts` |
| `src/core/physics/__tests__/physics.test.ts` | physics | contract | ja | `src/core/physics/world.ts` |
| `src/core/rng/__tests__/shoe.test.ts` | rng | contract | ja | `src/core/rng/shoe.ts` |
| `src/core/rng/__tests__/streams.test.ts` | rng | contract | ja | `src/core/rng/streams.ts` |
| `src/core/rng/__tests__/weighted.test.ts` | rng | contract | ja | `src/core/rng/weighted.ts` |
| `src/core/sim/__tests__/addiction-stake.test.ts` | sim | contract | ja | `src/core/sim/guest-play.ts` |
| `src/core/sim/__tests__/anger-decay.test.ts` | sim | contract | ja | `src/core/sim/upkeep.ts` |
| `src/core/sim/__tests__/anger-patience.test.ts` | sim | contract | ja | `src/core/sim/upkeep.ts` |
| `src/core/sim/__tests__/balance-operating.test.ts` | sim | statistics | nein, CI | `src/core/sim/tick.ts` |
| `src/core/sim/__tests__/bar-capacity.test.ts` | sim | contract | ja | `src/core/sim/deliveries.ts` |
| `src/core/sim/__tests__/brawl-combat.test.ts` | sim | contract | ja | `src/core/sim/brawl-combat.ts` |
| `src/core/sim/__tests__/demand.test.ts` | sim | contract | ja | `src/core/sim/demand.ts` |
| `src/core/sim/__tests__/device-identity.test.ts` | sim | contract | ja | `src/core/sim/device.ts` |
| `src/core/sim/__tests__/dirty-index.test.ts` | sim | contract | ja | `src/core/sim/emotion.ts` |
| `src/core/sim/__tests__/dispute-escalation.test.ts` | sim | contract | ja | `src/core/sim/disputes.ts` |
| `src/core/sim/__tests__/duel.test.ts` | sim | contract | ja | `src/core/sim/duel.ts` |
| `src/core/sim/__tests__/economy-losses.test.ts` | sim | contract | ja | `src/core/sim/economics.ts` |
| `src/core/sim/__tests__/expansion.test.ts` | sim | contract | ja | `src/core/sim/expansions.ts` |
| `src/core/sim/__tests__/foreign-floor-tick.test.ts` | sim | contract | ja | `src/core/sim/foreign-floor-tick.ts` |
| `src/core/sim/__tests__/grid-zones.test.ts` | sim | contract | ja | `src/core/sim/grid-zones.ts` |
| `src/core/sim/__tests__/guest-flow.test.ts` | sim | contract | ja | `src/core/sim/world.ts` |
| `src/core/sim/__tests__/guest-settlement.test.ts` | sim | contract | ja | `src/core/sim/remodel.ts` |
| `src/core/sim/__tests__/guests-served.test.ts` | sim | contract | ja | `src/core/sim/guest-service.ts` |
| `src/core/sim/__tests__/jackpot-label.test.ts` | sim | contract | ja | `src/core/sim/guest-play.ts` |
| `src/core/sim/__tests__/journal.test.ts` | sim | contract | ja | `src/core/sim/journal.ts` |
| `src/core/sim/__tests__/layout-commands.test.ts` | sim | contract | ja | `src/core/sim/layout-commands.ts` |
| `src/core/sim/__tests__/layout-contract.test.ts` | sim | contract | ja | `src/core/sim/layout-derive.ts` |
| `src/core/sim/__tests__/layout-history.test.ts` | sim | contract | ja | `src/core/sim/layout-history.ts` |
| `src/core/sim/__tests__/layout-json.test.ts` | sim | contract | ja | `src/core/sim/layout-json.ts` |
| `src/core/sim/__tests__/logistics.test.ts` | sim | contract | ja | `src/core/sim/deliveries.ts` |
| `src/core/sim/__tests__/look.test.ts` | sim | contract | ja | `src/core/sim/player-look.ts` |
| `src/core/sim/__tests__/mod-guards.test.ts` | sim | contract | ja | `src/core/sim/actions.ts` |
| `src/core/sim/__tests__/mod-resolver.test.ts` | sim | contract | ja | `src/core/sim/offers.ts` |
| `src/core/sim/__tests__/money-truth.test.ts` | sim | contract | ja | `src/core/sim/money.ts` |
| `src/core/sim/__tests__/mugging-cover.test.ts` | sim | contract | ja | `src/core/sim/mugging.ts` |
| `src/core/sim/__tests__/narrative-boundary.test.ts` | sim | contract | ja | `src/core/sim/narrative/boundary.ts` |
| `src/core/sim/__tests__/narrative-choice-contract.test.ts` | sim | contract | ja | `src/core/sim/narrative/choices/contract.ts` |
| `src/core/sim/__tests__/narrative-choice-eligibility.test.ts` | sim | contract | ja | `src/core/sim/narrative/choices/eligibility.ts` |
| `src/core/sim/__tests__/narrative-choice-execution.test.ts` | sim | contract | ja | `src/core/sim/narrative/commands/execute.ts` |
| `src/core/sim/__tests__/narrative-command-allowlist.test.ts` | sim | contract | ja | `src/core/sim/narrative/commands/validate.ts` |
| `src/core/sim/__tests__/narrative-command-dsl.test.ts` | sim | contract | ja | `src/core/sim/narrative/commands/parse-directives.ts` |
| `src/core/sim/__tests__/narrative-composer.test.ts` | sim | contract | ja | `src/core/sim/narrative/composer/index.ts` |
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
| `src/core/sim/__tests__/narrative-longrun.test.ts` | sim | statistics | nein, CI | `src/core/sim/tick.ts` |
| `src/core/sim/__tests__/narrative-memory.test.ts` | sim | contract | ja | `src/core/sim/narrative/memory.ts` |
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
| `src/core/sim/__tests__/own-play.test.ts` | sim | contract | ja | `src/core/sim/own-play.ts` |
| `src/core/sim/__tests__/pathfinding.test.ts` | sim | contract | ja | `src/core/sim/pathfinding.ts` |
| `src/core/sim/__tests__/persona-patience.test.ts` | sim | contract | ja | `src/core/sim/traits.ts` |
| `src/core/sim/__tests__/player-cash.test.ts` | sim | contract | ja | `src/core/sim/self-exclusion-bet.ts` |
| `src/core/sim/__tests__/player-jobs.test.ts` | sim | contract | ja | `src/core/sim/player-jobs.ts` |
| `src/core/sim/__tests__/player-rpg.test.ts` | sim | contract | ja | `src/core/sim/player-rpg.ts` |
| `src/core/sim/__tests__/player-speed.test.ts` | sim | contract | ja | `src/core/sim/tick.ts` |
| `src/core/sim/__tests__/player-wage-attendance.test.ts` | sim | contract | ja | `src/core/sim/player-jobs.ts` |
| `src/core/sim/__tests__/progression.test.ts` | sim | contract | ja | `src/core/sim/progression.ts` |
| `src/core/sim/__tests__/reputation.test.ts` | sim | contract | ja | `src/core/sim/spawn.ts` |
| `src/core/sim/__tests__/rival-ai.test.ts` | sim | contract | ja | `src/core/sim/rival-ai/policy.ts` |
| `src/core/sim/__tests__/rivals.test.ts` | sim | contract | ja | `src/core/sim/rivals.ts` |
| `src/core/sim/__tests__/shot-seed.test.ts` | store | integration | ja | `src/store/save.ts` |
| `src/core/sim/__tests__/soak.test.ts` | sim | statistics | nein, CI | `src/core/sim/tick.ts` |
| `src/core/sim/__tests__/staff-status.test.ts` | sim | contract | ja | `src/core/sim/staff-queries.ts` |
| `src/core/sim/__tests__/tx-reasons.test.ts` | sim | contract | ja | `src/core/sim/tx-reasons.ts` |
| `src/core/sim/__tests__/tycoon-needs.test.ts` | sim | contract | ja | `src/core/sim/needs.ts` |
| `src/core/sim/__tests__/tycoon-ops.test.ts` | sim | contract | ja | `src/core/sim/deliveries.ts` |
| `src/core/sim/__tests__/visitor-disposition.test.ts` | sim | contract | ja | `src/core/sim/narrative/disposition.ts` |
| `src/core/sim/__tests__/visitors.test.ts` | sim | contract | ja | `src/core/sim/visitors.ts` |
| `src/core/sim/__tests__/world.test.ts` | sim | contract | ja | `src/core/sim/guests.ts` |
| `src/core/sim/narrative/__tests__/composition-context.test.ts` | sim | contract | ja | `src/core/sim/narrative/composition-context.ts` |
| `src/core/sim/narrative/__tests__/dialogue.test.ts` | sim | contract | ja | `src/core/sim/narrative/dialogue/select.ts` |
| `src/core/sim/narrative/__tests__/narrative-view.test.ts` | sim | contract | ja | `src/core/sim/narrative/view.ts` |
| `src/render/__tests__/atlas.test.ts` | render | integration | ja | `src/render/assets/atlas.ts` |
| `src/render/__tests__/depth.test.ts` | render | integration | ja | `src/render/depth.ts` |
| `src/render/__tests__/floor-actions.test.ts` | render | integration | ja | `src/render/floor-actions.ts` |
| `src/render/__tests__/floor-cache.test.ts` | render | integration | ja | `src/render/floor-math.ts` |
| `src/render/__tests__/floor-camera.test.ts` | render | integration | ja | `src/render/floor-camera.ts` |
| `src/render/__tests__/floor-layout.test.ts` | render | integration | ja | `src/render/floor-material.ts` |
| `src/render/__tests__/perf-governor.test.ts` | render | integration | ja | `src/render/perf-governor.ts` |
| `src/render/__tests__/rig-combat.test.ts` | render | integration | ja | `src/render/rig-pose.ts` |
| `src/render/__tests__/rig.test.ts` | render | integration | ja | `src/render/rig-pose.ts` |
| `src/render/__tests__/slot-layout.test.ts` | render | integration | ja | `src/render/games/slot-layout.ts` |
| `src/render/__tests__/sound-fx.test.ts` | render | integration | ja | `src/render/sound-fx.ts` |
| `src/render/assets/__tests__/asset-semantics.test.ts` | render | integration | ja | `src/render/assets/asset-semantics.json` |
| `src/render/depth-perf.bench.ts` | render | performance | nein, CI | `src/render/depth.ts` |
| `src/render/floor-perf.bench.ts` | render | performance | nein, CI | `src/render/floor-math.ts` |
| `src/render/rig.bench.ts` | render | performance | nein, CI | `src/render/rig-pose.ts` |
| `src/store/__tests__/card-payout.test.ts` | store | integration | ja | `src/store/foreign-play.ts` |
| `src/store/__tests__/determinism.test.ts` | store | integration | ja | `src/store/transfer.ts` |
| `src/store/__tests__/narrative-commands.test.ts` | store | integration | ja | `src/store/narrative-commands.ts` |
| `src/store/__tests__/narrative-rival-source.test.ts` | store | integration | ja | `src/store/foreign-play.ts` |
| `src/store/__tests__/narrative-save.test.ts` | store | integration | ja | `src/store/save.ts` |
| `src/store/__tests__/own-play.test.ts` | store | integration | ja | `src/store/own-play.ts` |
| `src/store/__tests__/prng-persistence.test.ts` | store | integration | ja | `src/store/save.ts` |
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
| `src/store/__tests__/transfer.test.ts` | store | integration | ja | `src/store/transfer.ts` |
| `src/store/memory.bench.ts` | store | performance | nein, CI | `src/store/save.ts` |
| `src/store/narrative.bench.ts` | sim | performance | nein, CI | `src/core/sim/narrative/runtime.ts` |
| `src/store/perf-hot-paths.bench.ts` | store | performance | nein, CI | `src/store/snapshot.ts` |
| `src/ui/__tests__/card-tables.test.tsx` | ui | integration | ja | `src/ui/games/blackjack-popup.tsx` |
| `src/ui/__tests__/casino-window-header.test.tsx` | ui | integration | ja | `src/ui/casino-window-header.tsx` |
| `src/ui/__tests__/dialogue-ui.test.tsx` | ui | integration | ja | `src/ui/dialogue-popup.tsx` |
| `src/ui/__tests__/editor-gate.test.ts` | ui | integration | ja | `src/ui/editor-gate.ts` |
| `src/ui/__tests__/editor-tools.test.ts` | ui | integration | ja | `src/ui/editor-tools.ts` |
| `src/ui/__tests__/guest-profile.test.tsx` | ui | integration | ja | `src/ui/guest-popup.tsx` |
| `src/ui/__tests__/machine-play.test.tsx` | ui | integration | ja | `src/ui/machine-popup.tsx` |
| `src/ui/__tests__/narrative-ui.test.tsx` | ui | integration | ja | `src/ui/narrative-popup.tsx` |
| `src/ui/__tests__/perspective-switch.test.tsx` | ui | integration | ja | `src/ui/perspective-switch.tsx` |
| `src/ui/__tests__/ui.test.tsx` | ui | integration | ja | `src/ui/popup-shell.tsx` |
<!-- TEST_CATALOG_END -->

## 12. Dependencies & Audit

21 direkte Dependencies (3 Runtime: pixi.js, react, react-dom). `docs/DEPENDENCY-AUDIT.md` (Stand 31.10.2026): Umsetzungsstand **stimmt mit `package.json` überein** — engines/packageManager gesetzt, Dev-Server-Default `localhost` + `RBD_DEV_HOST`-Opt-in (in `vite.config.ts` bestätigt), Vite 8.3.5/plugin-react 6.1.2, TypeScript 6.0.3, `projectService` entfernt. Overrides: `glob ^14.0.3`, `minimatch ^11.0.1` (sicherheitsmotiviert).

## 13. Assets

Der Asset-Anhang in `docs/ARCHITECTURE.md`: vollständiges Paket (539 PNG + 7 JSON, 6 OGG-Tonspuren) unter `public/assets/casino/`, Manifest `src/render/assets/manifest.json`; **Lizenz vom Nutzer bestätigt, Nachweis im Repo offen (`docs/ROADMAP.md`)**. WAV-Master außerhalb des Repos. `pnpm run verify:assets` prüft Manifest ↔ Dateien ↔ `SLOT_SYMBOLS`.

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
| 48 | info | **Doc-Gate + Hooks (T10):** `scripts/lib/doc-sync.mjs` führt sechs Pflichtdokumente mit Pflichtabschnitten und `rbd-doc`-Marker (Version + UTC); `verify:docs` ist Gate (`ERR-4017`), der Pre-Commit-Hook schreibt ihn. `deps-matrix` und `catalog` sind keine Gates mehr; Matrix, Katalog und Marker entstehen im Hook. Wurzel-Duplikat `ANALYSE-BERICHT-CASINO-FLOOR.md` (identische MD5) gelöscht. | `scripts/lib/doc-sync.mjs`, `.githooks/`, `scripts/lib/pipeline-plan.mjs` |
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

Die Doku-Konsolidierung hat zwei Wellen. In T75 wurden 18 historische Analyse-, Review-, Plan- und Skill-Dokumente gelöscht, nachdem ihre offenen Punkte in die Pflichtdokumente überführt waren. In T81 folgten die elf verbliebenen Referenzdokumente; ihre Inhalte stehen jetzt in den sechs Pflichtdokumenten. `docs/ROADMAP.md` ist die einzige Stelle für offene Punkte.

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
| `PLAYER_CASH` hat keinen Ausgabepfad | `cashOutPlayerCash` existiert in `self-exclusion-bet.ts:82`, hat aber keinen Produktions-Aufrufer; nur `player-cash.test.ts` ruft ihn | **offen** (T75) |
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
| Getrackte Dateien | 1373 |
| Gelistete Dateien | 1373 |
| Getrackte Ordner | 92 |
| Bereiche | (Wurzel) (9), .githooks (2), .github (13), .kilo (1), .lane-claims (1), content (69), docs (70), public (554), scripts (80), src (574) |

Regel: jede Zeile entspricht genau einem Pfad aus `git ls-files`; es gibt keine Sammelzeile und keine Ausnahme. `verify:docs` vergleicht den Block mit `git ls-files` und wird rot, sobald eine Datei fehlt oder ein Pfad nicht mehr getrackt ist.

### 18.2 Ordner

- `./` — 9 Datei(en)
- `.githooks/` — 2 Datei(en)
- `.github/` — 2 Datei(en)
- `.github/ISSUE_TEMPLATE/` — 3 Datei(en)
- `.github/workflows/` — 8 Datei(en)
- `.kilo/plans/` — 1 Datei(en)
- `.lane-claims/` — 1 Datei(en)
- `content/narrative/contributions/` — 65 Datei(en)
- `content/narrative/registry/` — 1 Datei(en)
- `content/narrative/turns/` — 1 Datei(en)
- `content/narrative/vocabulary/` — 2 Datei(en)
- `docs/` — 8 Datei(en)
- `docs/banners/` — 4 Datei(en)
- `docs/contracts/` — 7 Datei(en)
- `docs/screenshots/` — 1 Datei(en)
- `docs/screenshots/comparison/` — 11 Datei(en)
- `docs/screenshots/current/` — 15 Datei(en)
- `docs/screenshots/v0.3.114/` — 11 Datei(en)
- `docs/screenshots/v0.3.132/` — 8 Datei(en)
- `docs/screenshots/v0.3.78/` — 5 Datei(en)
- `public/assets/casino/atlas/` — 2 Datei(en)
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
- `scripts/` — 47 Datei(en)
- `scripts/lib/` — 33 Datei(en)
- `src/` — 3 Datei(en)
- `src/Config/` — 6 Datei(en)
- `src/core/contracts/` — 7 Datei(en)
- `src/core/contracts/__tests__/` — 7 Datei(en)
- `src/core/economy/` — 3 Datei(en)
- `src/core/economy/__tests__/` — 4 Datei(en)
- `src/core/games/` — 20 Datei(en)
- `src/core/games/__tests__/` — 24 Datei(en)
- `src/core/games/engines/` — 11 Datei(en)
- `src/core/games/engines/__tests__/` — 2 Datei(en)
- `src/core/governance/` — 2 Datei(en)
- `src/core/governance/__tests__/` — 26 Datei(en)
- `src/core/io/` — 3 Datei(en)
- `src/core/io/__tests__/` — 1 Datei(en)
- `src/core/physics/` — 3 Datei(en)
- `src/core/physics/__tests__/` — 1 Datei(en)
- `src/core/rng/` — 4 Datei(en)
- `src/core/rng/__tests__/` — 3 Datei(en)
- `src/core/sim/` — 70 Datei(en)
- `src/core/sim/__tests__/` — 85 Datei(en)
- `src/core/sim/narrative/` — 27 Datei(en)
- `src/core/sim/narrative/__tests__/` — 3 Datei(en)
- `src/core/sim/narrative/choices/` — 2 Datei(en)
- `src/core/sim/narrative/commands/` — 7 Datei(en)
- `src/core/sim/narrative/composer/` — 6 Datei(en)
- `src/core/sim/narrative/dialogue/` — 3 Datei(en)
- `src/core/sim/narrative/events/` — 5 Datei(en)
- `src/core/sim/narrative/events/definitions/` — 8 Datei(en)
- `src/core/sim/rival-ai/` — 5 Datei(en)
- `src/render/` — 47 Datei(en)
- `src/render/__tests__/` — 11 Datei(en)
- `src/render/assets/` — 5 Datei(en)
- `src/render/assets/__tests__/` — 1 Datei(en)
- `src/render/fx/` — 2 Datei(en)
- `src/render/games/` — 24 Datei(en)
- `src/store/` — 26 Datei(en)
- `src/store/__tests__/` — 18 Datei(en)
- `src/styles/` — 5 Datei(en)
- `src/test/` — 2 Datei(en)
- `src/ui/` — 62 Datei(en)
- `src/ui/__tests__/` — 10 Datei(en)
- `src/ui/games/` — 10 Datei(en)

### 18.3 Dateien

- `.gitattributes` — Zeilenenden: der Generator schreibt LF. Mit core.autocrlf=true erzeugt Git — gelesen: 9 Zeilen
- `.githooks/commit-msg` — Der Commit-Body ist kein Fail-Closed-Gate mehr: fehlende Pflichtsektionen — gelesen: 14 Zeilen
- `.githooks/pre-commit` — Pflege vor jedem Commit. Verify-Gates bleiben lesend; hier wird geschrieben, — gelesen: 60 Zeilen
- `.github/CODEOWNERS` — Feste Owner. Auch ohne Pflicht-Review macht diese Datei sichtbar, wer eine — gelesen: 12 Zeilen
- `.github/ISSUE_TEMPLATE/contract.md` — Markdown-Dokument — gelesen: 65 Zeilen
- `.github/ISSUE_TEMPLATE/gate-failure.md` — Markdown-Dokument — gelesen: 73 Zeilen
- `.github/ISSUE_TEMPLATE/lane.md` — Markdown-Dokument — gelesen: 60 Zeilen
- `.github/dependabot.yml` — version: 2 — gelesen: 10 Zeilen
- `.github/workflows/auto-version-release.yml` — name: Auto Version & Release — gelesen: 110 Zeilen
- `.github/workflows/build-apk.yml` — name: Build Android APK — gelesen: 149 Zeilen
- `.github/workflows/ci-verify.yml` — name: CI Verify — gelesen: 534 Zeilen
- `.github/workflows/long-checks.yml` — name: Long Checks — gelesen: 211 Zeilen
- `.github/workflows/pr-cleanup.yml` — name: PR Cleanup — gelesen: 39 Zeilen
- `.github/workflows/pr-escalation.yml` — name: PR Escalation — gelesen: 47 Zeilen
- `.github/workflows/pr-watcher.yml` — name: PR Watcher — gelesen: 68 Zeilen
- `.github/workflows/promote.yml` — name: Promote — gelesen: 71 Zeilen
- `.gitignore` — node_modules/ — gelesen: 26 Zeilen
- `.kilo/plans/pnpm-cutover-plan.md` — Integrationsplan: npm → pnpm (Big-Bang-Cutover) — gelesen: 120 Zeilen
- `.lane-claims/claims.json` — [ — gelesen: 878 Zeilen
- `.mailmap` — Eine Anzeige-Identitaet fuer die History: Werkzeuge und Sandboxen committen — gelesen: 6 Zeilen
- `.npmrc` — allow-scripts=true — gelesen: 2 Zeilen
- `AGENTS.md` — Rigged by Design — gelesen: 414 Zeilen
- `README.md` — Rigged by Design — gelesen: 340 Zeilen
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
- `content/narrative/registry/fragments.json` — { — gelesen: 1563 Zeilen
- `content/narrative/turns/manifest.json` — { — gelesen: 265 Zeilen
- `content/narrative/vocabulary/classification.json` — { — gelesen: 98 Zeilen
- `content/narrative/vocabulary/flags.json` — { — gelesen: 13 Zeilen
- `docs/ARCHITECTURE.md` — Architektur und Governance — gelesen: 1807 Zeilen
- `docs/CHANGELOG.md` — Changelog — gelesen: 955 Zeilen
- `docs/DEVTAGEBUCH.md` — Devtagebuch — gelesen: 3328 Zeilen
- `docs/INVENTORY.md` — Inventar: Befunde, Lesedeckung und vollstaendige Dateiliste — gepflegt: Marker und Abschnitt 18
- `docs/ROADMAP.md` — Roadmap — gelesen: 314 Zeilen
- `docs/banner.jpg` — Binaerdatei — geprueft: Signatur, 193991 B
- `docs/banner.svg` — <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 420" width="1280" height="420" role="img" aria-label — gelesen: 242 Zeilen
- `docs/banners/art-direction-neon-ledger.png` — PNG-Textur — geprueft: PNG 1600x1380, 223656 B
- `docs/banners/roadmap.svg` — <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 150" role="img" aria-labelledby="t d" shape-renderin — gelesen: 1 Zeilen
- `docs/banners/spielwelt.svg` — <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 150" role="img" aria-labelledby="t d" shape-renderin — gelesen: 1 Zeilen
- `docs/banners/werkstatt.svg` — <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 150" role="img" aria-labelledby="t d" shape-renderin — gelesen: 1 Zeilen
- `docs/capabilities.json` — { — gelesen: 143 Zeilen
- `docs/contracts/actionset.md` — Contract: actionset v1.0 — gelesen: 52 Zeilen
- `docs/contracts/actor-id.md` — Contract: actor-id v1.0 — gelesen: 54 Zeilen
- `docs/contracts/domain-event.md` — Contract: domain-event v1.0 — gelesen: 86 Zeilen
- `docs/contracts/factor.md` — Contract: factor v1.0 — gelesen: 55 Zeilen
- `docs/contracts/relationship.md` — Contract: relationship v1.0 — gelesen: 55 Zeilen
- `docs/contracts/save.md` — Contract: save v1.0 — gelesen: 58 Zeilen
- `docs/contracts/world-time.md` — Contract: world-time v1.0 — gelesen: 56 Zeilen
- `docs/screenshots/README.md` — Screenshots — gelesen: 131 Zeilen
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
- `index.html` — <!doctype html> — gelesen: 67 Zeilen
- `package.json` — { — gelesen: 99 Zeilen
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
- `scripts/agent-context.mjs` — Ein Aufruf, ein Kontext: Aenderungen, Systeme, Invarianten, Tests, Gates und — gelesen: 69 Zeilen
- `scripts/agent-feedback.mjs` — Lokales Feedback aus dem echten Diff. — gelesen: 34 Zeilen
- `scripts/agent-verify.mjs` — Ein Ablauf statt drei: Impact bestimmen, Gates daraus planen, Cache nutzen, — gelesen: 139 Zeilen
- `scripts/autofix-0911.mjs` — Sicherer Autofix (ERR-0911): Lint-Fix, Dependency-Matrix, Commit-Sanitizing. — gelesen: 101 Zeilen
- `scripts/balance-run.mjs` — Balance-Spur: startet den 40-Tage-Messlauf als eigenen Prueflauf und legt den Bericht ab. — gelesen: 50 Zeilen
- `scripts/bench-lowend.mjs` — Low-End-Profil: derselbe Benchmark, auf einen Kern gepinnt. — gelesen: 27 Zeilen
- `scripts/branch-cleanup.mjs` — Lokale Wegwerf-Branches nach dem Merge aufraeumen. — gelesen: 43 Zeilen
- `scripts/build-asset-manifest.mjs` — Baut `src/render/assets/manifest.json` aus dem kuratierten Paket unter — gelesen: 151 Zeilen
- `scripts/build-inventory.mjs` — Erzeugt die vollstaendige Dateiliste fuer docs/INVENTORY.md. — gelesen: 128 Zeilen
- `scripts/check-loc.mjs` — LOC-Guard fuer VaCoin Casino Roguelite. — gelesen: 102 Zeilen
- `scripts/ci-long-checks.mjs` — Lange Nachweise ueber GitHub Actions statt auf der eigenen Maschine. — gelesen: 212 Zeilen
- `scripts/ci-plan.mjs` — CI-Plan fuer GitHub Actions: liest Basis und Kopf aus dem Event, waehlt — gelesen: 104 Zeilen
- `scripts/ci-tag-release.mjs` — Tag und Release fuer die Version, die im gepushten Commit steht. — gelesen: 100 Zeilen
- `scripts/compile-narrative-content.mjs` — NAR-10 content compiler. — gelesen: 68 Zeilen
- `scripts/doc-stub.mjs` — Erzeugt die Pflichteintraege fuer eine Aenderung aus einem Titel. — gelesen: 66 Zeilen
- `scripts/doc-sync.mjs` — Schreibt Version und Zeitstempel in die Pflichtdoku; `--check` prueft nur. — gelesen: 28 Zeilen
- `scripts/encode-audio.mjs` — Musik-Master zu Browser-Audio: die WAV-Dateien bleiben Master und liegen — gelesen: 76 Zeilen
- `scripts/escalation-plan.mjs` — Druckt die Eskalationsstufe zu einem Befund. Ohne Argument liest er die — gelesen: 35 Zeilen
- `scripts/gate-matrix.mjs` — Die Gate-Matrix fuer GitHub Actions. — gelesen: 45 Zeilen
- `scripts/init-github.sh` — Initialisiert das Repo, setzt .gitignore, macht den ersten Commit und legt — gelesen: 47 Zeilen
- `scripts/install-hooks.mjs` — Aktiviert die Repo-Hooks (core.hooksPath) und macht sie ausfuehrbar. — gelesen: 23 Zeilen
- `scripts/lib/affected-tests.mjs` — Betroffene Tests: deklariertes @test-target, der echte Importgraph und das — gelesen: 183 Zeilen
- `scripts/lib/atlas-png.mjs` — Deterministischer PNG-Atlas ohne neue Abhaengigkeit. — gelesen: 175 Zeilen
- `scripts/lib/atlas-webp.mjs` — WebP-Kodierung der Atlasseiten ueber das bereits vorhandene `ffmpeg-static`. — gelesen: 27 Zeilen
- `scripts/lib/body-sync.mjs` — Gemeinsame Wahrheit fuer Commit- und PR-Bodies. — gelesen: 272 Zeilen
- `scripts/lib/branch-prune.mjs` — Wegwerf-Branches: alles, was auf `main` liegt und nicht `main` ist. — gelesen: 37 Zeilen
- `scripts/lib/capabilities.mjs` — Capability-Manifest: Validierung und Gate-Logik für `verify:capabilities`. — gelesen: 247 Zeilen
- `scripts/lib/ci-plan.mjs` — CI-Plan: der echte Diff entscheidet, welche Gates und Tests laufen. — gelesen: 218 Zeilen
- `scripts/lib/claim-evidence.mjs` — Merge-Nachweis fuer Lane-Claims. — gelesen: 181 Zeilen
- `scripts/lib/dependency-change.mjs` — Eine Wahrheit fuer eine kleine, aber teure Frage: haben sich Abhaengigkeiten — gelesen: 68 Zeilen
- `scripts/lib/doc-sync.mjs` — Pflichtdoku: eine Liste, ein Marker, eine Pruefung. — gelesen: 127 Zeilen
- `scripts/lib/error-codes.mjs` — Fehlercodes fuer die Gate-Skripte. — gelesen: 33 Zeilen
- `scripts/lib/escalation.mjs` — Eine Leiter fuer jeden Fehlschlag, in fester Reihenfolge: — gelesen: 79 Zeilen
- `scripts/lib/gate-cache.mjs` — Inhalts-Hash-Cache: identischer Arbeitsbaum -> gruenes Gate wird nicht erneut gerechnet. — gelesen: 61 Zeilen
- `scripts/lib/gate-diagnostics.mjs` — Mehrfach-Diagnose eines roten CI-Laufs. — gelesen: 120 Zeilen
- `scripts/lib/gate-runner.mjs` — Fuehrt unabhaengige Gates parallel aus, puffert ihre Ausgabe und nutzt den Inhalts-Cache. — gelesen: 231 Zeilen
- `scripts/lib/identity.mjs` — Eine Identitaet fuer jeden Commit: unabhaengig von Runner, Sandbox und — gelesen: 8 Zeilen
- `scripts/lib/impact.mjs` — Impact: eine Analyse fuer Agentenkontext, Pruefplan und Bericht. — gelesen: 125 Zeilen
- `scripts/lib/lane-claims.mjs` — Lane-Claims: Claim-, Konflikt- und Gate-Validierung für parallele Agenten-Arbeit. — gelesen: 435 Zeilen
- `scripts/lib/narrative-compiler.mjs` — NAR-10 deterministic content compiler. — gelesen: 266 Zeilen
- `scripts/lib/narrative-content.mjs` — NAR-09 content contract: contributions, controlled vocabulary, turn manifest — gelesen: 486 Zeilen
- `scripts/lib/narrative-macros.mjs` — NAR-10 compile-time macro parser and validator. — gelesen: 271 Zeilen
- `scripts/lib/pipeline-plan.mjs` — Der Plan jedes Laufs: `verify` liest ausschliesslich, `fix` repariert. — gelesen: 113 Zeilen
- `scripts/lib/pipeline-stop.mjs` — Abbruchpfad der Pipeline: Signale beenden alle Gates und hinterlassen keine Waisen. — gelesen: 22 Zeilen
- `scripts/lib/process-sweep.mjs` — Verwaiste Gate-Prozesse: PID plus Startzeit, PID-genaues Beenden, nie nach Namensmuster. — gelesen: 188 Zeilen
- `scripts/lib/promote-guard.mjs` — Promotion-Guard: Ein Merge darf nur den Commit treffen, den die CI geprueft — gelesen: 61 Zeilen
- `scripts/lib/release-escalation.mjs` — Eskalationsleiter fuer Umgebungsprobleme im Release. — gelesen: 56 Zeilen
- `scripts/lib/report.mjs` — Einheitliches [IDX] [ERR] Format fuer alle Gate-Skripte. — gelesen: 41 Zeilen
- `scripts/lib/staging-scope.mjs` — Staging-Umfang: `git add -A` ist nur zulaessig, wenn jede Aenderung im — gelesen: 31 Zeilen
- `scripts/lib/subsystems.mjs` — Ein Ort fuer Subsysteme und Ordnerregeln. — gelesen: 119 Zeilen
- `scripts/lib/test-catalog.mjs` — Testkatalog: jede Testdatei gehoert genau einem System und genau einer — gelesen: 105 Zeilen
- `scripts/lib/tree-changes.mjs` — Arbeitsbaum-Aenderungen als explizite Liste. — gelesen: 54 Zeilen
- `scripts/lib/ts-ast.mjs` — Gemeinsame TypeScript-AST-Basis der Governance-Gates. — gelesen: 90 Zeilen
- `scripts/lib/worktree-isolation.mjs` — Technische Worktree-Isolation fuer Agenten. — gelesen: 88 Zeilen
- `scripts/lift-commit-body.mjs` — Hebt den vollstaendigen PR-Diff in einen abgegrenzten Automationsbereich. — gelesen: 141 Zeilen
- `scripts/loc-budgets.mjs` — LOC-Budgets pro Zustaendigkeit. Eine Datei gehoert genau zu einer Rolle: — gelesen: 36 Zeilen
- `scripts/pr-watcher.mjs` — PR Watcher – erstellt Issues bei rotem Gate, Timeout oder fehlerhaftem PR-Body — gelesen: 435 Zeilen
- `scripts/prepare-android.mjs` — Capacitor-Android: Huelle um den Vite-Build, getrennt nach Variante. — gelesen: 90 Zeilen
- `scripts/pretask.mjs` — Pretask: der Start jedes Laufs. — gelesen: 236 Zeilen
- `scripts/promote.mjs` — Promote: gruene PR-Staende mergen. Rot wird ein Issue, kein Dump auf — gelesen: 427 Zeilen
- `scripts/reconcile-claims.mjs` — Claim-Reconciliation: Claims muessen zum tatsaechlichen Remote-Zustand passen. — gelesen: 111 Zeilen
- `scripts/release-impact.mjs` — Release-Relevanz: braucht dieser Stand wirklich ein APK? — gelesen: 70 Zeilen
- `scripts/run-pipeline.mjs` — Fail-Closed-Pipeline in zwei getrennten Modi. — gelesen: 122 Zeilen
- `scripts/run-selected-tests.mjs` — Testkommando der Gates: ohne Auswahl laeuft die Suite des Profils, mit — gelesen: 37 Zeilen
- `scripts/sanitize-commit.mjs` — ERR-0911: entfernt verbotene Trailer und Tool-Werbung aus einer Nachricht. — gelesen: 18 Zeilen
- `scripts/sync-dependency-matrix.mjs` — ERR-0911: erzeugt die Live-Dependency-Matrix in docs/ARCHITECTURE.md aus — gelesen: 138 Zeilen
- `scripts/test-affected.mjs` — Schneller Entwicklungsfeedback-Lauf: nur Tests, die vom aktuellen Diff — gelesen: 52 Zeilen
- `scripts/test-catalog.mjs` — Testkatalog schreiben (`pnpm run catalog`) oder pruefen (`--check`). — gelesen: 55 Zeilen
- `scripts/turn-push.mjs` — Turn-Abschluss: optional affected-Tests, alles stagen, verify:all, deutscher Steam-Notes-Commit, Push nach mai — gelesen: 346 Zeilen
- `scripts/verify-assets.mjs` — Asset-Pruefung: jede Manifest-Referenz zeigt auf eine vorhandene Datei, — gelesen: 148 Zeilen
- `scripts/verify-capabilities.mjs` — verify:capabilities - Validiert das Capability-Manifest. — gelesen: 25 Zeilen
- `scripts/verify-commit-msg.mjs` — Steam-Developer-Notes-Gate: deutsche Pflichtsektionen, keine Fremd-Trailer. — gelesen: 54 Zeilen
- `scripts/verify-dead-code.mjs` — Fail-Closed Dead-Artifact-Gate: ein Export ist tot, wenn ihn niemand ueber — gelesen: 114 Zeilen
- `scripts/verify-docs.mjs` — Doc-Gate: Struktur, Marker und flacher Wurzelbaum; rot bei Abweichung. — gelesen: 14 Zeilen
- `scripts/verify-lane-claims.mjs` — verify-lane-claims: Prüft, ob der aktuelle Branch einen Lane-Claim hat, — gelesen: 319 Zeilen
- `scripts/verify-narrative-content.mjs` — NAR-10/NAR-11 read-only content verification. — gelesen: 21 Zeilen
- `scripts/verify-redundancy.mjs` — Redundanz-Gate: eine Wahrheit pro Sache. — gelesen: 67 Zeilen
- `scripts/verify-test-quality.mjs` — Fail-Closed-Testvertrag ueber die TypeScript-AST: Header, echte Assertions, — gelesen: 178 Zeilen
- `scripts/verify-tree.mjs` — Tree-Gate: jede Datei liegt in ihrem Ordner, jede Schicht importiert nur nach innen. — gelesen: 105 Zeilen
- `scripts/version-bump.mjs` — Versionsnummer des Turns: wird vor `verify` gebumpt, damit der gepushte Baum — gelesen: 56 Zeilen
- `src/App.tsx` — import { lazy, Suspense, useEffect, useRef, useState } from 'react'; — gelesen: 285 Zeilen
- `src/Config/capacitor.config.json` — { — gelesen: 12 Zeilen
- `src/Config/escalation-levels.json` — ["AUTO_FIX", "LOCAL_GATE", "REMOTE_CI", "AGENT", "BLOCKED"] — gelesen: 1 Zeilen
- `src/Config/eslint.config.mjs` — import js from '@eslint/js'; — gelesen: 126 Zeilen
- `src/Config/opencode.json` — { — gelesen: 10 Zeilen
- `src/Config/tsconfig.json` — { — gelesen: 24 Zeilen
- `src/Config/vite.config.ts` — import { configDefaults, defineConfig } from 'vitest/config'; — gelesen: 76 Zeilen
- `src/core/contracts/__tests__/actionset.test.ts` — Contract actionset v1.0: Domain-registrierter ActionSet-Vertrag. — gelesen: 95 Zeilen
- `src/core/contracts/__tests__/actor-id.test.ts` — Contract actor-id v1.0: Dauerhafte Actor-ID und Referenzregeln. — gelesen: 57 Zeilen
- `src/core/contracts/__tests__/domain-event.test.ts` — Contract domain-event v1.0: Event-Hülle mit Actor-/Zeit-Referenzen, Sequenz — gelesen: 115 Zeilen
- `src/core/contracts/__tests__/factor.test.ts` — Contract factor v1.0: Factor-IDs, Kontext und Contribution-Trace. — gelesen: 73 Zeilen
- `src/core/contracts/__tests__/relationship.test.ts` — Contract relationship v1.0: Gerichtete Relationship-IDs und erlaubte Änderungsbefehle. — gelesen: 86 Zeilen
- `src/core/contracts/__tests__/save.test.ts` — Contract save v1.0: Save-Envelope, Versionierung und Migration. — gelesen: 85 Zeilen
- `src/core/contracts/__tests__/world-time.test.ts` — Contract world-time v1.0: WorldTime, Calendar-Bezug und TimeDomain-Schlüssel. — gelesen: 71 Zeilen
- `src/core/contracts/actionset.ts` — Contract: actionset v1.0 — gelesen: 63 Zeilen
- `src/core/contracts/actor-id.ts` — Contract: actor-id v1.0 — gelesen: 43 Zeilen
- `src/core/contracts/domain-event.ts` — Contract: domain-event v1.0 — gelesen: 99 Zeilen
- `src/core/contracts/factor.ts` — Contract: factor v1.0 — gelesen: 62 Zeilen
- `src/core/contracts/relationship.ts` — Contract: relationship v1.0 — gelesen: 62 Zeilen
- `src/core/contracts/save.ts` — Contract: save v1.0 — gelesen: 54 Zeilen
- `src/core/contracts/world-time.ts` — Contract: world-time v1.0 — gelesen: 37 Zeilen
- `src/core/economy/__tests__/economy.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 97 Zeilen
- `src/core/economy/__tests__/ledger-atomicity.test.ts` — Ledger-Transfer muss atomar sein: bei einem abgelehnten Buchung (z. B. — gelesen: 84 Zeilen
- `src/core/economy/__tests__/ledger-checkpoint.test.ts` — Die volle Pruefung bleibt vollstaendig, die inkrementelle meldet denselben Zustand. — gelesen: 61 Zeilen
- `src/core/economy/__tests__/ledger-diagnose.test.ts` — Diagnose muss Zustand, Buchungszahl und Bruchursache nachvollziehbar liefern. — gelesen: 51 Zeilen
- `src/core/economy/ledger-integrity.ts` — Buchungspruefung als reine Funktionen: kein Geld, nur Nachvollziehbarkeit. — gelesen: 65 Zeilen
- `src/core/economy/ledger.ts` — Doppelte Buchfuehrung fuer VaCoin. Konten sind dynamisch, damit jeder Gast — gelesen: 268 Zeilen
- `src/core/economy/vacoin.ts` — VaCoin (VC) - Geld als ganzzahlige Mikro-Einheiten. — gelesen: 92 Zeilen
- `src/core/games/__tests__/contracts.test.ts` — Eine Runde ist eine Aktion plus Result; die Auszahlung folgt vollstaendig aus beidem. — gelesen: 78 Zeilen
- `src/core/games/__tests__/dice-bets.test.ts` — Jedes Wettfeld am Wuerfeltisch muss exakt sagen, wann es gewinnt, und seine — gelesen: 63 Zeilen
- `src/core/games/__tests__/foreign-round-atomic.test.ts` — Eine fremde Runde wird erst vollstaendig geprueft und gerechnet, dann — gelesen: 77 Zeilen
- `src/core/games/__tests__/game-rounds.test.ts` — Auch die neuen Tischspiele muessen durch denselben Aktionspfad: Einsatz rein, — gelesen: 71 Zeilen
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
- `src/core/games/__tests__/slot-paylines.test.ts` — Das Gitter muss die Gewinnlinien exakt tragen: was die Anzeige als Treffer — gelesen: 103 Zeilen
- `src/core/games/__tests__/slot-profile.test.ts` — Der Betreiber stellt Streifen, Gewichte, Bewertungsmodell, Volatilität und — gelesen: 124 Zeilen
- `src/core/games/__tests__/slot-session-rtp.test.ts` — Der Pfad, den Gaeste wirklich spielen, muss dem Haus einen Vorteil lassen. — gelesen: 79 Zeilen
- `src/core/games/__tests__/slot-transparency.test.ts` — Rot-Gruen-Beweis: ehrliche Slot-Historie, physikalische Druckstufen und — gelesen: 106 Zeilen
- `src/core/games/__tests__/test-spin.test.ts` — Alle sieben Spiele laufen im Testmodus derselben Sandbox: eigener Seed, — gelesen: 69 Zeilen
- `src/core/games/__tests__/video-poker-ranks.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 31 Zeilen
- `src/core/games/contracts.ts` — Die Naht zwischen Spielregel, Geld und Anzeige: Aktion rein, Result raus. — gelesen: 112 Zeilen
- `src/core/games/dice-bets.ts` — Die fuenf Wettfelder am Wuerfeltisch: Trefferregel, Auszahlung und ein einzelner Wurf. — gelesen: 55 Zeilen
- `src/core/games/engines/__tests__/blackjack.test.ts` — Die Runde gehoert dem Spieler: Split, Versicherung, Aufgeben und die — gelesen: 110 Zeilen
- `src/core/games/engines/__tests__/interactive-cards.test.ts` — Blackjack und Video Poker laufen jetzt Zug fuer Zug. Der Kern muss jeden Zug — gelesen: 126 Zeilen
- `src/core/games/engines/blackjack-rules.ts` — Tischregeln und Kartenarithmetik des Blackjacks: was erlaubt ist, was eine Hand — gelesen: 134 Zeilen
- `src/core/games/engines/blackjack-settle.ts` — Dealerzug und Abrechnung: was jede Hand wert ist und wie die Runde endet. — gelesen: 80 Zeilen
- `src/core/games/engines/blackjack.ts` — Blackjack mit echten Entscheidungen: Ziehen, Halten, Verdoppeln, Split, — gelesen: 160 Zeilen
- `src/core/games/engines/cards.ts` — Karten-Engines: Blackjack mit echten Entscheidungen, Video Poker mit Hold/Draw. — gelesen: 150 Zeilen
- `src/core/games/engines/interactive-cards.ts` — Kartenrunden mit Spielerentscheidung: Blackjack Zug fuer Zug, Video Poker mit Hold. — gelesen: 96 Zeilen
- `src/core/games/engines/slot-models.ts` — Die drei Bewertungsmodelle des Slots: Linien, Ways und Cluster. — gelesen: 196 Zeilen
- `src/core/games/engines/slot-odds.ts` — Chancen-Kalibrierung des Slots: wie viel eine Walzenanzahl auszahlt. — gelesen: 63 Zeilen
- `src/core/games/engines/slot-paytable.ts` — Paytable und Gewinnlinien des Slots. — gelesen: 81 Zeilen
- `src/core/games/engines/slot-strips.ts` — Walzenstreifen: Ziehung und angezeigte Chance muessen aus derselben Verteilung kommen. — gelesen: 36 Zeilen
- `src/core/games/engines/slot.ts` — Book-of-VaCoin: drei bis fuenf Walzen, Streifen oder Gewichte, drei Bewertungsmodelle. — gelesen: 154 Zeilen
- `src/core/games/engines/table.ts` — Tischspiele: Roulette mit voller Wettfläche, zwei Wuerfel, Huetchenspiel mit Serie. — gelesen: 121 Zeilen
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
- `src/core/games/slot-config.ts` — Maschinenkonfiguration: die eine Quelle der Spielparameter. — gelesen: 104 Zeilen
- `src/core/games/slot-profile.ts` — Konfigurierbare Spielmechanik des Slots: Gewichte, Bewertungsmodell, Volatilitaet, — gelesen: 152 Zeilen
- `src/core/games/slot-session.ts` — Ein Slot-Spin mit Gedächtnis: Drucklader und Entladung werden hier tatsaechlich konsumiert. — gelesen: 71 Zeilen
- `src/core/games/slot-transparency.ts` — Ehrliches Slot-Gedächtnis und der Drucklader; reine, serialisierbare Zustandslogik. — gelesen: 106 Zeilen
- `src/core/governance/__tests__/affected-tests.test.ts` — Die Auswahl muss deklarierte Ziele, direkte Importe und das betroffene — gelesen: 70 Zeilen
- `src/core/governance/__tests__/body-sync.test.ts` — Body-Synchronisation darf vorhandene Inhalte nie ersetzen. Genau diese — gelesen: 107 Zeilen
- `src/core/governance/__tests__/branch-prune.test.ts` — Nach dem Merge mit gruenen Gates ist ein Wegwerf-Branch nur noch Arbeit, die — gelesen: 39 Zeilen
- `src/core/governance/__tests__/ci-gates.test.ts` — Ebene A des Main-Gates: `main` ist kein Sonderfall mehr, und der — gelesen: 240 Zeilen
- `src/core/governance/__tests__/ci-plan.test.ts` — Der CI-Plan ist die einzige Auswahl fuer Gates und Tests. Diese Datei belegt — gelesen: 55 Zeilen
- `src/core/governance/__tests__/claim-evidence.test.ts` — Ein geloeschter Branch ist kein Merge-Nachweis. Genau dieser Fall steht — gelesen: 161 Zeilen
- `src/core/governance/__tests__/dependency-governance.test.ts` — import { readFileSync, readdirSync } from 'node:fs'; — gelesen: 77 Zeilen
- `src/core/governance/__tests__/gate-diagnostics.test.ts` — Ein roter Lauf kann mehrere unabhaengige Fehler enthalten. Diese Grenzen — gelesen: 83 Zeilen
- `src/core/governance/__tests__/gate-runner.test.ts` — Ein haengendes Gate darf den Lauf nicht offen halten: Nach dem harten Limit — gelesen: 86 Zeilen
- `src/core/governance/__tests__/impact.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 33 Zeilen
- `src/core/governance/__tests__/lane-claims.test.ts` — Ein Claim ist der Vertrag einer Lane, kein Token pro Pull Request. Nach dem — gelesen: 108 Zeilen
- `src/core/governance/__tests__/narrative-compiler.test.ts` — NAR-10: Makros werden zu einem begrenzten AST, Konflikte werden vor dem — gelesen: 161 Zeilen
- `src/core/governance/__tests__/narrative-content.test.ts` — NAR-09: Schema, kontrolliertes Vokabular, Turn-Manifest und die abgeleitete — gelesen: 224 Zeilen
- `src/core/governance/__tests__/pipeline-modes.test.ts` — Ein Pruefer darf die Akte nicht vorher umschreiben. Kein Verify-Profil — gelesen: 68 Zeilen
- `src/core/governance/__tests__/pr-watcher.test.ts` — Ein erneut aufgetretener Fehler muss ein geschlossenes Issue wieder oeffnen. — gelesen: 93 Zeilen
- `src/core/governance/__tests__/pretask.test.ts` — Der echte `pretask`-Start in temporaeren Git-Repos. Die Isolation-Hilfe — gelesen: 173 Zeilen
- `src/core/governance/__tests__/process-sweep.test.ts` — Der Abbruchpfad muss echte Prozesse beenden und die Registry raeumen; sonst — gelesen: 134 Zeilen
- `src/core/governance/__tests__/promote-guard.test.ts` — Ein Merge darf nur den Commit treffen, den die CI geprueft hat, und nur aus — gelesen: 73 Zeilen
- `src/core/governance/__tests__/release-escalation.test.ts` — Umgebungsprobleme muessen automatisch eine Stufe hoeher gehen, statt als — gelesen: 36 Zeilen
- `src/core/governance/__tests__/scripts-libs-ci.d.ts` — Deklarationen fuer die CI-Diagnose- und Claim-Evidenz-Bibliotheken. — gelesen: 138 Zeilen
- `src/core/governance/__tests__/scripts-libs.d.ts` — Deklarationen fuer die JS-Bibliotheken unter scripts/lib (kein allowJs im Projekt). — gelesen: 239 Zeilen
- `src/core/governance/__tests__/staging-scope.test.ts` — Fremde Arbeit darf nie automatisch gestaged werden. Diese Grenzen stehen — gelesen: 46 Zeilen
- `src/core/governance/__tests__/test-catalog.test.ts` — Jede Testdatei gehoert genau einem System und genau einer Beweisklasse. — gelesen: 72 Zeilen
- `src/core/governance/__tests__/tree-changes.test.ts` — Der Fix-Modus muss jede Aenderung nennen, auch Loeschungen. Ein stilles — gelesen: 41 Zeilen
- `src/core/governance/__tests__/workflow-hardening.test.ts` — Workflows sind ausfuehrbarer Code. Zwei Grenzen werden hier strukturell — gelesen: 167 Zeilen
- `src/core/governance/__tests__/worktree-isolation.test.ts` — Zwei Ebenen: die reine Entscheidung (geteilter Baum, fremder Claim, — gelesen: 230 Zeilen
- `src/core/governance/error-codes.ts` — Zentrales Fehlerregister. Jeder Gate-, Test- und Laufzeitfehler nennt hier — gelesen: 66 Zeilen
- `src/core/governance/test-harness.ts` — Vitest-Reporter fuer den Fail-Closed-Testvertrag: jeder Testfall wird mit — gelesen: 50 Zeilen
- `src/core/io/__tests__/escalation.test.ts` — import { readFileSync } from 'node:fs'; — gelesen: 27 Zeilen
- `src/core/io/envelope.ts` — Umschlag fuer Spielstand-Exporte: Art, Format, Pruefsumme, Nutzlast. — gelesen: 66 Zeilen
- `src/core/io/issues.ts` — Import-Befunde: blockieren, automatisch reparieren oder ignorieren. — gelesen: 50 Zeilen
- `src/core/io/repair.ts` — Repariert, was ohne Regelverstoss reparierbar ist; Blocker bleiben Blocker. — gelesen: 47 Zeilen
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
- `src/core/sim/__tests__/addiction-stake.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 109 Zeilen
- `src/core/sim/__tests__/anger-decay.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 29 Zeilen
- `src/core/sim/__tests__/anger-patience.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 28 Zeilen
- `src/core/sim/__tests__/balance-harness.ts` — Betriebs-Messlauf: ein skriptierter Betreiber (bauen, einstellen, reparieren, ausbauen) — gelesen: 154 Zeilen
- `src/core/sim/__tests__/balance-metrics.ts` — Kennzahlen des Betriebs-Messlaufs: Was Gaeste erleben, je Spieltag gezaehlt. — gelesen: 174 Zeilen
- `src/core/sim/__tests__/balance-operating.test.ts` — Betriebs-Messlauf (nur mit RBD_BALANCE=1): Ankuenfte, Warteschlangen, Wartezeiten, — gelesen: 66 Zeilen
- `src/core/sim/__tests__/balance-report.ts` — Balance-Spur: macht den 40-Tage-Messlauf nachvollziehbar und pruefbar. — gelesen: 94 Zeilen
- `src/core/sim/__tests__/bar-capacity.test.ts` — import { readFileSync } from 'node:fs'; — gelesen: 22 Zeilen
- `src/core/sim/__tests__/brawl-combat.test.ts` — Die Siegchance im Tooltip ist keine Schaetzung: dieselbe Konstellation — gelesen: 77 Zeilen
- `src/core/sim/__tests__/demand.test.ts` — Nachfrage ist geplant: erster Gast terminiert, Quellen addieren sich, — gelesen: 135 Zeilen
- `src/core/sim/__tests__/device-identity.test.ts` — Geräteidentität und Spieltyp sind zwei Fragen. Der Katalog entscheidet, — gelesen: 46 Zeilen
- `src/core/sim/__tests__/dirty-index.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 22 Zeilen
- `src/core/sim/__tests__/dispute-escalation.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 13 Zeilen
- `src/core/sim/__tests__/duel.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 180 Zeilen
- `src/core/sim/__tests__/economy-losses.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 24 Zeilen
- `src/core/sim/__tests__/expansion.test.ts` — Ein Ausbau erhaelt Einrichtung, IDs, Gaeste, Personal und offene Anspruche; — gelesen: 166 Zeilen
- `src/core/sim/__tests__/foreign-floor-tick.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 52 Zeilen
- `src/core/sim/__tests__/grid-zones.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 87 Zeilen
- `src/core/sim/__tests__/guest-flow.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 171 Zeilen
- `src/core/sim/__tests__/guest-settlement.test.ts` — Kein Gast und kein Anspruch verschwindet, solange die Buchung nicht vollstaendig ist. — gelesen: 119 Zeilen
- `src/core/sim/__tests__/guests-served.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 32 Zeilen
- `src/core/sim/__tests__/jackpot-label.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 13 Zeilen
- `src/core/sim/__tests__/journal.test.ts` — Jede Buchung wird genau einmal kopiert; Welt-Ereignisse tragen Ursache und Folge. — gelesen: 94 Zeilen
- `src/core/sim/__tests__/layout-commands.test.ts` — Typisierte Layout-Commands: nur die genannten Tiles/Kanten aendern sich, — gelesen: 98 Zeilen
- `src/core/sim/__tests__/layout-contract.test.ts` — Layout-Vertrag: eine Wahrheit fuer Dimension, Boden, Zonen und Wandkanten. — gelesen: 121 Zeilen
- `src/core/sim/__tests__/layout-history.test.ts` — Verlauf: 30 Schritte, ein Pinselstrich ist ein Schritt, Redo endet bei neuer Arbeit. — gelesen: 66 Zeilen
- `src/core/sim/__tests__/layout-json.test.ts` — Layout-Export/-Import: runde Reise, feste Bytes, fail-closed bei fremden Daten. — gelesen: 51 Zeilen
- `src/core/sim/__tests__/logistics.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 64 Zeilen
- `src/core/sim/__tests__/look.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 28 Zeilen
- `src/core/sim/__tests__/mod-guards.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 34 Zeilen
- `src/core/sim/__tests__/mod-resolver.test.ts` — Mod-Wirkungen entstehen an genau einer Stelle: der gemeinsame Resolver — gelesen: 58 Zeilen
- `src/core/sim/__tests__/money-truth.test.ts` — Fiat ist vom Spawn an ein gebuchtes Konto; Auszahlungen werden nie still gekappt. — gelesen: 108 Zeilen
- `src/core/sim/__tests__/mugging-cover.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 20 Zeilen
- `src/core/sim/__tests__/narrative-boundary.test.ts` — Der Boundary ist der einzige Verbraucher der Fact-Queue: Ledger-Schwellen werden — gelesen: 85 Zeilen
- `src/core/sim/__tests__/narrative-choice-contract.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 54 Zeilen
- `src/core/sim/__tests__/narrative-choice-eligibility.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 90 Zeilen
- `src/core/sim/__tests__/narrative-choice-execution.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 109 Zeilen
- `src/core/sim/__tests__/narrative-command-allowlist.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 52 Zeilen
- `src/core/sim/__tests__/narrative-command-dsl.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 36 Zeilen
- `src/core/sim/__tests__/narrative-composer.test.ts` — NAR-11: Der Composer waehlt aus der validierten Registry deterministisch — gelesen: 235 Zeilen
- `src/core/sim/__tests__/narrative-conflict-source.test.ts` — Ein echter Streit zwischen zwei Gästen ist die Quelle für gerichtete — gelesen: 83 Zeilen
- `src/core/sim/__tests__/narrative-counter-rival.test.ts` — D2: `CONFRONT_RIVAL` traegt die typisierte Domaenenwirkung `COUNTER_RIVAL`. — gelesen: 74 Zeilen
- `src/core/sim/__tests__/narrative-coverage.test.ts` — B4: Jedes stabile Template muss `TITLE`, `BODY` und jedes angebotene — gelesen: 61 Zeilen
- `src/core/sim/__tests__/narrative-demand.test.ts` — Nachfrageveranstaltungen laufen als aktive GLOBAL-Event-Instanzen; die — gelesen: 96 Zeilen
- `src/core/sim/__tests__/narrative-event-expiry.test.ts` — D3: Keine globale Timeout-Strafe. `EXPIRED` bleibt wie heute ein reiner — gelesen: 74 Zeilen
- `src/core/sim/__tests__/narrative-event-schema.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 130 Zeilen
- `src/core/sim/__tests__/narrative-event-templates.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 86 Zeilen
- `src/core/sim/__tests__/narrative-events.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 107 Zeilen
- `src/core/sim/__tests__/narrative-fact-schema.test.ts` — Neue Beziehungs-Facts tragen ActorRefs statt einer Pflicht-visitorId. — gelesen: 73 Zeilen
- `src/core/sim/__tests__/narrative-facts.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 104 Zeilen
- `src/core/sim/__tests__/narrative-followup-chain.test.ts` — D1: Eine aufgeloeste Choice mit `followUpEventId` erzeugt im naechsten Lauf — gelesen: 61 Zeilen
- `src/core/sim/__tests__/narrative-longrun.test.ts` — NAR-16: Mehr-Tage-Betrieb mit Geschichten, Rivalen und Save/Replay. Der Lauf — gelesen: 133 Zeilen
- `src/core/sim/__tests__/narrative-memory.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 78 Zeilen
- `src/core/sim/__tests__/narrative-relationships.test.ts` — Beziehungen sind gerichtet, haben genau einen Besitzer und pinnen ihre Endpunkte — gelesen: 155 Zeilen
- `src/core/sim/__tests__/narrative-rival-context.test.ts` — Phase 5: Rivalen-Karten leiten sich rein aus Minds, Indizien und — gelesen: 88 Zeilen
- `src/core/sim/__tests__/narrative-rival-trigger.test.ts` — C2: Der `rival-action`-Trigger oeffnet nur fuer Handlungen mit Folgen ein — gelesen: 57 Zeilen
- `src/core/sim/__tests__/narrative-runtime.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 111 Zeilen
- `src/core/sim/__tests__/narrative-staff-source.test.ts` — Die Kasse ist die reale Besucher-Personal-Begegnung: nur ein anwesender — gelesen: 59 Zeilen
- `src/core/sim/__tests__/narrative-start-pool.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 71 Zeilen
- `src/core/sim/__tests__/narrative-trigger-schema.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 82 Zeilen
- `src/core/sim/__tests__/narrative-trigger-template-contract.test.ts` — C1: Die Spec-Regel „nur triggern, wo ein Template mit Mehrwert existiert“ — gelesen: 45 Zeilen
- `src/core/sim/__tests__/narrative-triggers.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 146 Zeilen
- `src/core/sim/__tests__/narrative-warm-return.test.ts` — F: Langzeitpfad ohne Campaign-State. VISITOR_RETURN fuehrt per ASK in — gelesen: 117 Zeilen
- `src/core/sim/__tests__/nav-edges.test.ts` — Waende blockieren Kanten statt Tiles. Tueren und Durchgaenge bleiben — gelesen: 172 Zeilen
- `src/core/sim/__tests__/own-play.test.ts` — Der eigene Geldweg laeuft fuer alle acht Spiele ausschliesslich ueber — gelesen: 152 Zeilen
- `src/core/sim/__tests__/pathfinding.test.ts` — Der Heap-A* liefert weiterhin kuerzeste, zusammenhaengende Wege; der Nav-Cache — gelesen: 111 Zeilen
- `src/core/sim/__tests__/persona-patience.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 25 Zeilen
- `src/core/sim/__tests__/player-cash.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 32 Zeilen
- `src/core/sim/__tests__/player-jobs.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 176 Zeilen
- `src/core/sim/__tests__/player-rpg.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 93 Zeilen
- `src/core/sim/__tests__/player-speed.test.ts` — Speed war einmal nur ein gespeicherter Attributwert. Dieser Test haelt fest, — gelesen: 67 Zeilen
- `src/core/sim/__tests__/player-wage-attendance.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 84 Zeilen
- `src/core/sim/__tests__/progression.test.ts` — Unternehmensstufen nennen echte Bedingungen; gesperrte Ware sagt, was fehlt. — gelesen: 171 Zeilen
- `src/core/sim/__tests__/reputation.test.ts` — Ruf ist Betriebserfahrung: Ein frischer Automat in gutem Zustand ist kein Ruf, — gelesen: 76 Zeilen
- `src/core/sim/__tests__/rival-ai.test.ts` — Rivalen handeln deterministisch: gleiche Eingaben, gleiche Absicht. Sabotage — gelesen: 155 Zeilen
- `src/core/sim/__tests__/rivals.test.ts` — Fremde Haeuser nutzen echte Spiele und Regeln, driften deterministisch und — gelesen: 78 Zeilen
- `src/core/sim/__tests__/shot-seed.test.ts` — Screenshot-Saat: eine eingerichtete Etage als Save-JSON ablegen, damit die — gelesen: 70 Zeilen
- `src/core/sim/__tests__/soak.test.ts` — Langlauf: Ledger bleibt integer und gedeckt, und der Betrieb steht ueber — gelesen: 119 Zeilen
- `src/core/sim/__tests__/staff-status.test.ts` — Der Personalstatus lebt ausschliesslich in den Agenten: ohne Agent keine — gelesen: 82 Zeilen
- `src/core/sim/__tests__/tx-reasons.test.ts` — Jeder Grund, den ein Aufrufer bucht, muss in der Kennzahl landen, die er — gelesen: 81 Zeilen
- `src/core/sim/__tests__/tycoon-needs.test.ts` — Bedürfnisse steuern Gastentscheidungen; Wut wird zum sichtbaren Streit mit Schaden. — gelesen: 180 Zeilen
- `src/core/sim/__tests__/tycoon-ops.test.ts` — Käufe kommen als Kiste, Personal arbeitet auf dem Floor, WC verstopft, Umbau braucht Ruf. — gelesen: 223 Zeilen
- `src/core/sim/__tests__/visitor-disposition.test.ts` — E2: Zwei Besucher gleicher Persona, einer mit GOOD-Erinnerung und Sympathie, — gelesen: 165 Zeilen
- `src/core/sim/__tests__/visitors.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 97 Zeilen
- `src/core/sim/__tests__/world.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 201 Zeilen
- `src/core/sim/actions.ts` — Commands, die nicht im Tick passieren: Bewegung, Reinigung, Preise, Mods, fremde Spiele. — gelesen: 180 Zeilen
- `src/core/sim/board-constants.ts` — Feste Brett- und Teppichwerte; aus types.ts ausgelagert, damit die Typdatei unter dem LOC-Limit bleibt. — gelesen: 11 Zeilen
- `src/core/sim/brawl-combat.ts` — Spielerkampf: Lebenspunkte, Trefferchancen und Runden, deren Anzeige exakt aus der Mechanik kommt. — gelesen: 136 Zeilen
- `src/core/sim/charisma-talk.ts` — Charisma-Ansprache: Erfolg hebt die Laune, ein Fehlschlag kann zur Prügelei werden. — gelesen: 53 Zeilen
- `src/core/sim/day-phase.ts` — Tageszeit der Buehne: rein aus dem Tick abgeleitet, nie aus der Uhr. — gelesen: 14 Zeilen
- `src/core/sim/deliveries.ts` — Lieferkette: Käufe kommen als Kiste am Eingang an und werden körperlich verteilt. — gelesen: 198 Zeilen
- `src/core/sim/demand.ts` — Nachfrage: Ankuenfte werden geplant statt pro Tick gewuerfelt. — gelesen: 182 Zeilen
- `src/core/sim/desk-service.ts` — Kasse: Warteschlange, Bedienzeit und Wechsel von Fiat in Chips. — gelesen: 64 Zeilen
- `src/core/sim/device.ts` — Geräteidentität und Spieltyp sind zwei verschiedene Fragen. — gelesen: 44 Zeilen
- `src/core/sim/disputes.ts` — Streit: Wut wird zum sichtbaren Disput mit Position, Beteiligten und Eskalation. — gelesen: 172 Zeilen
- `src/core/sim/duel-opponent.ts` — Gegnerprofil eines Streits: abgeleitet, ohne PRNG, damit Vorschau und Kampf gleich sehen. — gelesen: 56 Zeilen
- `src/core/sim/duel.ts` — Duell: ein echter Kampf mit Lebenspunkten gegen den Rädelsführer des Streits, inklusive Überfall-Folge. — gelesen: 126 Zeilen
- `src/core/sim/economics.ts` — Wirtschaftliche Kennzahlen als reine Ableitung aus den Ledger-Buchungen. — gelesen: 121 Zeilen
- `src/core/sim/emotion.ts` — Was ein Gast gerade fühlt: eine Grafik statt eines Satzes. — gelesen: 54 Zeilen
- `src/core/sim/events.ts` — Einfacher Event-Emitter fuer die Visuellen-Effekte-Brücke. — gelesen: 30 Zeilen
- `src/core/sim/expansions.ts` — Ausbau: das Haus waechst aus dem Bestand heraus. Nichts wird ersetzt, alles bleibt. — gelesen: 101 Zeilen
- `src/core/sim/fight-fx.ts` — Kurzlebige Kampf-Rueckmeldung: der Streit ist schon entschieden, der Floor zeigt — gelesen: 11 Zeilen
- `src/core/sim/foreign-floor-tick.ts` — Simulationslogik für fremde Casinos (Foreign Floors). — gelesen: 81 Zeilen
- `src/core/sim/grid-zones.ts` — 30x30-Bereiche, Multi-Tile-Footprints und Zugangs-Tiles. Reine Grid-Politik, kein Rendering. — gelesen: 121 Zeilen
- `src/core/sim/guest-choice.ts` — Was ein Gast als Nächstes tut: Bedürfnis, freier Platz, Ausweichen statt Stillstand. — gelesen: 130 Zeilen
- `src/core/sim/guest-core.ts` — Gemeinsame Gast-Basis ohne Entscheidungs- oder Spielwissen. — gelesen: 21 Zeilen
- `src/core/sim/guest-play.ts` — Spielen, Trinken, Klo: jeder Aufruf endet in einer konkreten Aktion, nicht in Zahlenrauschen. — gelesen: 147 Zeilen
- `src/core/sim/guest-service.ts` — Gast verlässt den Floor, wird wütend und wird ausgezahlt. — gelesen: 79 Zeilen
- `src/core/sim/guests.ts` — Fassade des Gastverhaltens: die Details liegen in kleinen, getrennten Modulen. — gelesen: 5 Zeilen
- `src/core/sim/house-presets.ts` — Haus-Vorlagen: Zonen und Moebel-Fabriken für klein, mittel, gross. — gelesen: 122 Zeilen
- `src/core/sim/interaction.ts` — Interaktionsradius-System für Charakter-Steuerung. Headless, deterministisch. — gelesen: 19 Zeilen
- `src/core/sim/journal.ts` — Ereignisprotokoll: jeder wichtige Zustand mit Ursache, Wirkung und Akteur. — gelesen: 145 Zeilen
- `src/core/sim/layout-commands.ts` — Typisierte Layout-Commands: der Editor beschreibt eine Absicht, das Modul — gelesen: 115 Zeilen
- `src/core/sim/layout-derive.ts` — Ableitungen aus dem Layout-Vertrag: Vorlage, Boden, Legacy-Sicht und Ausbau. — gelesen: 116 Zeilen
- `src/core/sim/layout-edges.ts` — Kanten-Algebra des Layout-Vertrags: Anker, Grenzen, Rand und Einfrieren. — gelesen: 43 Zeilen
- `src/core/sim/layout-history.ts` — Endlicher Undo/Redo-Verlauf fuer Layout-Commands. Haelt fertige Layouts, — gelesen: 55 Zeilen
- `src/core/sim/layout-json.ts` — Versionierter Layout-Export und -Import. Das Dokument enthaelt nur den — gelesen: 49 Zeilen
- `src/core/sim/layout-types.ts` — Kanonischer Layout-Vertrag: Dimension, Bodenmaterial pro Tile, semantische — gelesen: 68 Zeilen
- `src/core/sim/layout-validate.ts` — Fail-closed-Pruefung des Layout-Vertrags: ungueltige Daten kommen nie in die Welt. — gelesen: 154 Zeilen
- `src/core/sim/layout.ts` — Der einzige Schreibpfad der raeumlichen Wahrheit: Layout zuerst, Sicht abgeleitet. — gelesen: 25 Zeilen
- `src/core/sim/money.ts` — Geldwege: jeder Cent ist eine Ledger-Buchung, nie ein direkter Zähler. — gelesen: 145 Zeilen
- `src/core/sim/mop.ts` — Wischer-System. Headless, deterministisch, keine Browser-Abhängigkeiten. — gelesen: 57 Zeilen
- `src/core/sim/mugging.ts` — Simulierter Überfall nach einer verlorenen Prügelei: Ziel wählen, greifen, fliehen. — gelesen: 89 Zeilen
- `src/core/sim/narrative/__tests__/composition-context.test.ts` — Der Helper liest ausschliesslich Welt, Fact, Event und Template; er mutiert — gelesen: 171 Zeilen
- `src/core/sim/narrative/__tests__/dialogue.test.ts` — Dialoge sind Daten plus ein reiner Ablauf: gleicher Klick, gleiche Folgeseite. — gelesen: 60 Zeilen
- `src/core/sim/narrative/__tests__/narrative-view.test.ts` — Das View-Modell leitet Szenen, Choices und Profile rein aus Welt, Ledger und — gelesen: 116 Zeilen
- `src/core/sim/narrative/boundary.ts` — Einziger Verbraucher der Fact-Queue: Ledger-Facts erzeugen, einmal drainieren, anwenden. — gelesen: 38 Zeilen
- `src/core/sim/narrative/choices/contract.ts` — Choice-Vertrag: stabile IDs bleiben an Template-ID und Version gebunden. — gelesen: 21 Zeilen
- `src/core/sim/narrative/choices/eligibility.ts` — Reine Choice-Eligibility: Lifecycle, Requirements und Kosten ohne Seiteneffekte. — gelesen: 86 Zeilen
- `src/core/sim/narrative/commands/execute.ts` — Einziger Ausfuehrungspfad: Preflight, Handler, Kosten, RESOLVED. — gelesen: 127 Zeilen
- `src/core/sim/narrative/commands/index.ts` — Oeffentliche Fassade der Event-Command-Schicht. — gelesen: 13 Zeilen
- `src/core/sim/narrative/commands/parse-directives.ts` — Parser fuer €-Direktiven: erzeugt ein strikt begrenztes AST, nie Code. — gelesen: 123 Zeilen
- `src/core/sim/narrative/commands/preflight.ts` — Vollstaendige Vorpruefung einer Choice, bevor irgendein Effekt geschrieben wird. — gelesen: 140 Zeilen
- `src/core/sim/narrative/commands/registry.ts` — Allowlist der Commands: ID, Familie, Parameter und Handler-Vertrag. — gelesen: 98 Zeilen
- `src/core/sim/narrative/commands/types.ts` — Typisierte Event-Commands: Text wird zu AST, nie zu ausfuehrbarem Code. — gelesen: 99 Zeilen
- `src/core/sim/narrative/commands/validate.ts` — Kompiliert Direktiven und prueft sie gegen Registry, Argumente und Allowlist. — gelesen: 71 Zeilen
- `src/core/sim/narrative/composer/index.ts` — NAR-11: Lokaler, deterministischer Runtime-Composer; keine LLM- oder Netzwerkpfade. — gelesen: 103 Zeilen
- `src/core/sim/narrative/composer/registry.generated.ts` — Generated by NAR-10; do not edit. — gelesen: 70 Zeilen
- `src/core/sim/narrative/composer/schema.ts` — NAR-11: Laufzeitpruefung fuer generierte Fragmente und Composer-Anfragen. — gelesen: 73 Zeilen
- `src/core/sim/narrative/composer/select.ts` — NAR-11: Deterministische Auswahl ohne Gameplay-PRNG und ohne Seiteneffekte. — gelesen: 85 Zeilen
- `src/core/sim/narrative/composer/slot-map.generated.ts` — Generated by NAR-11; do not edit. — gelesen: 9 Zeilen
- `src/core/sim/narrative/composer/types.ts` — NAR-11: Der Composer verbindet Template-Slots mit lokalen Registry-Fragmenten. — gelesen: 71 Zeilen
- `src/core/sim/narrative/composition-context.ts` — B1: Reine Ableitung des Composer-Kontexts aus Welt, Fact, Event und Template. — gelesen: 150 Zeilen
- `src/core/sim/narrative/demand-events.ts` — Bruecke zwischen Demand-Balance und gemeinsamer Event-Engine. — gelesen: 60 Zeilen
- `src/core/sim/narrative/dialogue/scripts.ts` — Dialog: Sicherheitsfassung des ersten Comic-Dialogs. — gelesen: 50 Zeilen
- `src/core/sim/narrative/dialogue/select.ts` — Dialog: Reiner Ablauf der Dialogfuehrung. Kein Zufall, keine Zeit, kein Mutieren — gelesen: 54 Zeilen
- `src/core/sim/narrative/dialogue/types.ts` — Dialog: Datenvertrag der Dialogfuehrung. — gelesen: 34 Zeilen
- `src/core/sim/narrative/disposition.ts` — Besucherdisposition (E1): eine einzige reine Ableitung aus Persona-Basis, — gelesen: 125 Zeilen
- `src/core/sim/narrative/event-lifecycle.ts` — Zentrale Event-State-Machine und Cooldown-Anwendung. — gelesen: 129 Zeilen
- `src/core/sim/narrative/event-scheduler.ts` — Scheduler fuer narrative Event-Instanzen; Auswahl ist deterministisch und begrenzt. — gelesen: 178 Zeilen
- `src/core/sim/narrative/event-schema.ts` — Schema und sichere Normalisierung der persistenten Event-Domaene. — gelesen: 145 Zeilen
- `src/core/sim/narrative/event-types.ts` — Persistente Event-Vertraege fuer Scheduler, Lifecycle und Ereignisketten. — gelesen: 65 Zeilen
- `src/core/sim/narrative/events/definitions/index.ts` — Einzige Registry der stabilen Event-Templates. — gelesen: 23 Zeilen
- `src/core/sim/narrative/events/definitions/neon-nacht.ts` — Engine-seitig gestartete Nachfrageveranstaltung ohne Fact-Trigger und ohne Choices. — gelesen: 23 Zeilen
- `src/core/sim/narrative/events/definitions/rival-move.ts` — Stabile mechanische Definition fuer eine Rivalenhandlung am Spielerhaus. — gelesen: 53 Zeilen
- `src/core/sim/narrative/events/definitions/tournament-night.ts` — Engine-seitig gestartete Nachfrageveranstaltung ohne Fact-Trigger und ohne Choices. — gelesen: 23 Zeilen
- `src/core/sim/narrative/events/definitions/visitor-aftermath.ts` — Stabile mechanische Definition fuer das Nachspiel eines Besuchergespraechs. — gelesen: 40 Zeilen
- `src/core/sim/narrative/events/definitions/visitor-conflict.ts` — Stabile mechanische Definition fuer einen Streit zwischen zwei Besuchern. — gelesen: 73 Zeilen
- `src/core/sim/narrative/events/definitions/visitor-return-warm.ts` — Zweite Stufe der Rueckkehr: Wer Gutes mitbringt, bekommt zusaetzlich eine warme Szene. — gelesen: 40 Zeilen
- `src/core/sim/narrative/events/definitions/visitor-return.ts` — Stabile mechanische Definition fuer die Rueckkehr eines Besuchers. — gelesen: 54 Zeilen
- `src/core/sim/narrative/events/demand-definitions.ts` — Datengetriebene Nachfrageveranstaltungen; Auswahl und Ankuendigung bleiben in `demand.ts`. — gelesen: 36 Zeilen
- `src/core/sim/narrative/events/template-candidate.ts` — Uebersetzt einen Trigger-Match in einen begrenzten EventCandidate aus dem Template. — gelesen: 59 Zeilen
- `src/core/sim/narrative/events/template-schema.ts` — Fail-closed Validierung fuer Event-Templates, Choices und ihre statischen Teile. — gelesen: 146 Zeilen
- `src/core/sim/narrative/events/template-types.ts` — Deklarative Event-Templates und Choice-Vertraege; Darstellung bleibt ausserhalb. — gelesen: 116 Zeilen
- `src/core/sim/narrative/events/trigger-definitions.ts` — Deklarative Trigger, die einen echten Fact in einen Event-Kandidaten uebersetzen. — gelesen: 31 Zeilen
- `src/core/sim/narrative/fact-schema.ts` — Validierung und stabile Reihenfolge persistierter Narrative-Facts. — gelesen: 92 Zeilen
- `src/core/sim/narrative/facts.ts` — Fact-Queue: typisierte, einmalige Ereignisse mit stabiler ID — getrennt vom Journal. — gelesen: 76 Zeilen
- `src/core/sim/narrative/ledger-facts.ts` — Leitet aus Ledger-Buchungen nur Schwellenuebergaenge ab, nicht jede Buchung. — gelesen: 46 Zeilen
- `src/core/sim/narrative/memory.ts` — Charaktergedaechtnis: aus Facts werden strukturierte Erinnerungen und messbare Wirkung. — gelesen: 46 Zeilen
- `src/core/sim/narrative/narrative-rng.ts` — Eigener Mulberry32-Strom fuer narrative Auswahl; nie der Gameplay-PRNG. — gelesen: 28 Zeilen
- `src/core/sim/narrative/relationship-apply.ts` — Wendet die fachlichen Beziehungsregeln auf bereits gedrainte Facts an. — gelesen: 75 Zeilen
- `src/core/sim/narrative/relationships.ts` — Kanonische, gerichtete Beziehungen zwischen persistenten Akteuren. — gelesen: 113 Zeilen
- `src/core/sim/narrative/rival-context.ts` — Phase 5: Rivalen-Karten als reine Ableitung aus den persistenten Minds. — gelesen: 41 Zeilen
- `src/core/sim/narrative/runtime.ts` — Duenne Ablaufkoordination: Fact drainieren, Trigger auswerten, Kandidaten begrenzt planen. — gelesen: 106 Zeilen
- `src/core/sim/narrative/scheduler.ts` — Oeffentliche Fassade fuer Event-Scheduler, Templates, Choices und Narrativ-RNG. — gelesen: 29 Zeilen
- `src/core/sim/narrative/state.ts` — Narrative-Domaene: Startzustand, Start-Pool beim neuen Spiel und sichere Normalisierung. — gelesen: 93 Zeilen
- `src/core/sim/narrative/trigger-context.ts` — Baut aus Welt, Ledger und aktuellem Fact einen unveraenderlichen Trigger-Context. — gelesen: 41 Zeilen
- `src/core/sim/narrative/trigger-evaluate.ts` — Reine Auswertung von Trigger-Bedingungen; keine Welt-, Ledger- oder RNG-Mutation. — gelesen: 116 Zeilen
- `src/core/sim/narrative/trigger-schema.ts` — Schema-Validierung fuer persistierbare Trigger-Definitionen; fail-closed. — gelesen: 113 Zeilen
- `src/core/sim/narrative/trigger-types.ts` — Deklarative Trigger-Vertraege: Bedingungen, Context und erklaerte Treffer. — gelesen: 89 Zeilen
- `src/core/sim/narrative/triggers.ts` — Oeffentliche Trigger-Fassade: Context, reine Auswertung und Schema-Validierung. — gelesen: 8 Zeilen
- `src/core/sim/narrative/types.ts` — Narrative Datenvertraege: Facts, Erinnerungen und persistenter Zustand als reine JSON-Daten. — gelesen: 178 Zeilen
- `src/core/sim/narrative/view-types.ts` — NAR-14: Datenvertraege des Anzeigemodells; der Builder lebt in `view.ts`. — gelesen: 88 Zeilen
- `src/core/sim/narrative/view.ts` — NAR-14: Anzeigemodell fuer Szenen und Profile – reine Ableitung, keine zweite Wahrheit. — gelesen: 177 Zeilen
- `src/core/sim/nav-grid.ts` — Navigationsraster: belegte Tiles, Wandkanten und ein Cache fuer beides. — gelesen: 114 Zeilen
- `src/core/sim/nav-reach.ts` — Erreichbarkeit ueber offene Kanten: BFS fuer Zielpruefung und Platzierungsschutz. — gelesen: 61 Zeilen
- `src/core/sim/needs.ts` — Bedürfnisse: ein 180-Punkte-Profil pro Gast, Durst und Blase steuern die Zielwahl. — gelesen: 51 Zeilen
- `src/core/sim/offers.ts` — Angebot: kaufbare Spiele, Deko und Mods. Jeder Mod zieht an und kostet Geduld oder Betrieb. — gelesen: 196 Zeilen
- `src/core/sim/own-play.ts` — Eigene Spielrunde: Der Betreiber sitzt als Gast an seinem Geraet. — gelesen: 176 Zeilen
- `src/core/sim/pathfinding.ts` — A* auf dem Tile-Grid. Deterministisch, 4 Richtungen, mit Blockern und Wandkanten. — gelesen: 189 Zeilen
- `src/core/sim/penalty-pool.ts` — Folgen eines verlorenen Duells: Ruf und Laune als befristete Strafe, kein Zufallspool. — gelesen: 39 Zeilen
- `src/core/sim/personas.ts` — Gästetypen: Budget, Geduld, Suchtneigung, Getränkeneigung und Spielgeschmack. — gelesen: 53 Zeilen
- `src/core/sim/player-jobs.ts` — Spieler-Jobs in fremden Casinos. Sims-Style Arbeit an Job-Stationen. — gelesen: 143 Zeilen
- `src/core/sim/player-look.ts` — Der Look des Spielers: reine Daten, keine Gameplay-Wirkung. — gelesen: 56 Zeilen
- `src/core/sim/player-rpg.ts` — Spieler-RPG: 7 Attribute, Level, XP und Kampfkoerper. Rein deterministisch, ohne Geldbewegung. — gelesen: 117 Zeilen
- `src/core/sim/player.ts` — Spieler-Commands: Laufen, Tragen, Zapfen, Kasse, Deko, Ausbau. Mit Weg und Reichweite. — gelesen: 132 Zeilen
- `src/core/sim/progression.ts` — Unternehmensfortschritt: das Casino waechst, nicht der Charakter. — gelesen: 160 Zeilen
- `src/core/sim/queue-spots.ts` — Kassenschlange: eindeutige, erreichbare Wartepositionen – auch bei grossem Andrang. — gelesen: 56 Zeilen
- `src/core/sim/remodel.ts` — Umbau: Voraussetzungen und Deckung pruefen, dann das bestehende Haus erweitern. — gelesen: 30 Zeilen
- `src/core/sim/rival-ai/actions.ts` — Fuehrt eine geplante Rivalenaktion aus. Jede Wirkung ist benannt und belegt: — gelesen: 101 Zeilen
- `src/core/sim/rival-ai/minds.ts` — Anlegen, Normalisieren und Nachschlagen der Rivalen-Zustaende; ohne Spielwirkung. — gelesen: 107 Zeilen
- `src/core/sim/rival-ai/policy.ts` — Reine Rivalen-Politik: gleiche Eingabe, gleiche Absicht. — gelesen: 81 Zeilen
- `src/core/sim/rival-ai/tick.ts` — Ein Tick Rivalen-Denken: Eingaben aus der Welt, Absicht aus der reinen Politik. — gelesen: 43 Zeilen
- `src/core/sim/rival-ai/types.ts` — Rivalen-Domaene: persistenter Zustand, Absichts-Typen und harte Grenzen. — gelesen: 61 Zeilen
- `src/core/sim/rivals.ts` — Fremde Casinos: eigene Betreiber, eigene Maschinen, eigene Regeln. — gelesen: 181 Zeilen
- `src/core/sim/self-exclusion-bet.ts` — Self-Exclusion als Spiel: Der Pakt belohnt Disziplin und protokolliert Wortbruch ehrlich. — gelesen: 103 Zeilen
- `src/core/sim/service-actions.ts` — Gast-Aktionen: ausstehende Gelder an Gäste auszahlen. Reine Welt-Logik ohne Tick. — gelesen: 17 Zeilen
- `src/core/sim/spawn.ts` — Ein einzelner Gast: Profil, Fiat und Weg zur Kasse. Wie viele kommen, plant demand.ts. — gelesen: 79 Zeilen
- `src/core/sim/staff-queries.ts` — Die eine Personalabfrage. — gelesen: 72 Zeilen
- `src/core/sim/staff.ts` — Personal: eingestellte Rollen bekommen einen Körper, der auf dem Floor arbeitet. — gelesen: 244 Zeilen
- `src/core/sim/stain.ts` — Fleck-/Verschmutzungssystem. Headless, deterministisch, keine Browser-Abhängigkeiten. — gelesen: 43 Zeilen
- `src/core/sim/templates.ts` — Drei Floor-Blueprints: klein, mittel, gross. Jeder Bereich ist 30x30 Kacheln. — gelesen: 127 Zeilen
- `src/core/sim/tick-timing.ts` — Eine Quelle fuer die Tick-Dauer: Simulation, Renderer und UI rechnen mit demselben Takt. — gelesen: 4 Zeilen
- `src/core/sim/tick.ts` — Ein Tick der Welt: Spawn, Wege, Service, Laune, Dreck, Personal. — gelesen: 152 Zeilen
- `src/core/sim/traits.ts` — Gast-Erzeugung: Persona plus zufaellig verteilter Max-Pool fuer Laune, Geduld und Sucht. — gelesen: 74 Zeilen
- `src/core/sim/tx-reasons.ts` — Ein Ort für Buchungsgründe: Wer bucht und wer klassifiziert, liest dieselben — gelesen: 78 Zeilen
- `src/core/sim/types-model.ts` — Welttypen ohne den Weltzustand selbst. — gelesen: 119 Zeilen
- `src/core/sim/types.ts` — Ein einziger serialisierbarer Weltzustand. Geld liegt nicht hier, sondern im Ledger. — gelesen: 98 Zeilen
- `src/core/sim/upkeep.ts` — Laufende Pflege der Welt: Tageslohn, Miete, verwaiste Sitze und Gast-Laune. — gelesen: 68 Zeilen
- `src/core/sim/visitors.ts` — Besucherprofile: Gaeste bleiben ueber Besuche hinweg erkennbar; die Liste ist begrenzt. — gelesen: 75 Zeilen
- `src/core/sim/world.ts` — Welt-Helfer: Zonen, Objekte, Reservierungen, freie Plaetze. — gelesen: 152 Zeilen
- `src/main.tsx` — import { StrictMode } from 'react'; — gelesen: 44 Zeilen
- `src/render/__tests__/atlas.test.ts` — Shelf-Plan: deterministische Reihenfolge, keine Ueberlappung, harte Seitengrenze. — gelesen: 43 Zeilen
- `src/render/__tests__/depth.test.ts` — Ein gemeinsamer Tiefenvertrag: Fussanker statt Oberkante, deterministisches — gelesen: 82 Zeilen
- `src/render/__tests__/floor-actions.test.ts` — Der Lager-Spiegel ist die einzige Deko mit einer Charaktereditor-Aktion; — gelesen: 28 Zeilen
- `src/render/__tests__/floor-cache.test.ts` — Regions-Hash, Invalidierung, LOD, Culling und Koordinaten sind reine Mathe. — gelesen: 82 Zeilen
- `src/render/__tests__/floor-camera.test.ts` — Kamera: Uebersicht, Schwenk, Tasten-Zoom und Nachziehen am Bildrand sind reine Mathe. — gelesen: 100 Zeilen
- `src/render/__tests__/floor-layout.test.ts` — Bodenmaterialien kommen aus dem Layout, nicht aus Zonen. Fallback-IDs, — gelesen: 138 Zeilen
- `src/render/__tests__/perf-governor.test.ts` — Hysterese: Wechsel erst nach zwei Sekunden Abweichung, nicht nach einem Frame. — gelesen: 42 Zeilen
- `src/render/__tests__/rig-combat.test.ts` — Kampf und Verletzung muessen sichtbar sein: eigene Posen, eigene Uebergaenge, — gelesen: 35 Zeilen
- `src/render/__tests__/rig.test.ts` — Das Rig ist reine Mathematik: gleiche Zeit, gleiche Pose, klarer Zustand. — gelesen: 37 Zeilen
- `src/render/__tests__/slot-layout.test.ts` — Die Walzenanzeige rechnet nur ueber diese Geometrie. Werte, die hier stimmen, — gelesen: 50 Zeilen
- `src/render/__tests__/sound-fx.test.ts` — Lautstaerke und Kanaele sind Geraeteeinstellungen: sie muessen klemmbar, getrennt — gelesen: 33 Zeilen
- `src/render/actor-pool.ts` — Wiederverwendbare Figuren und Sticker: im Frame entstehen keine neuen Text-/Graphics-Objekte. — gelesen: 61 Zeilen
- `src/render/art-tokens.ts` — import type { DayPhase } from '../core/sim/day-phase'; — gelesen: 128 Zeilen
- `src/render/assets/__tests__/asset-semantics.test.ts` — Vertrag des Asset-Semantik-Katalogs. Der Test liest den Katalog als Daten, — gelesen: 182 Zeilen
- `src/render/assets/asset-semantics.json` — { — gelesen: 1313 Zeilen
- `src/render/assets/atlas.ts` — Laufzeit-Atlas: nutzt die im Build gepackten Seiten, wenn das Manifest sie — gelesen: 169 Zeilen
- `src/render/assets/keys.ts` — Paketpfade, die echte Renderer brauchen: Figuren, Tischdeko, Boden und Partikel. — gelesen: 32 Zeilen
- `src/render/assets/manifest.json` — { — generiert, 1983 Zeilen
- `src/render/assets/textures.ts` — Texturen aus dem Pixel-Paket: erst der Laufzeit-Atlas, dann die Einzeldatei. — gelesen: 109 Zeilen
- `src/render/comic-bubbles.ts` — Kleine Comic-Sprechblase: eine Grafik statt eines Satzes, pro Figur gepoolt. — gelesen: 152 Zeilen
- `src/render/depth-perf.bench.ts` — Tiefensortierung derselben Szene auf SMALL, MEDIUM und LARGE: 200 Figuren, — gelesen: 48 Zeilen
- `src/render/depth.ts` — Gemeinsamer Tiefenvertrag der Szene: sortiert wird ausschliesslich nach dem — gelesen: 53 Zeilen
- `src/render/editor-overlay.ts` — Editor-Auswahl als reine Pixi-Darstellung: eine Zelle und optional ihre Kante. — gelesen: 50 Zeilen
- `src/render/entity-sync.ts` — Figuren- und Möbelsync eines Frames: aus dem Snapshot in die Tiefenebene, — gelesen: 218 Zeilen
- `src/render/floor-actions.ts` — Baut die Radial-Menu-Aktionen für ein geklicktes Objekt. — gelesen: 64 Zeilen
- `src/render/floor-animate.ts` — Floor-Animation: Tick, Kamera, Figuren-Animation. — gelesen: 38 Zeilen
- `src/render/floor-camera-rig.ts` — Kamera-Buehne: der Pixi-Container, die Zoom-/Schwenk-Wahrheit und die LOD-Stufe. — gelesen: 106 Zeilen
- `src/render/floor-camera.ts` — Kamera mit zwei Zoom-Stufen: Übersicht und 30x30-Bereich. Lerpt ohne Frame-Allokationen. — gelesen: 137 Zeilen
- `src/render/floor-carpet.ts` — Teppichwahl als feine Textur ueber den Tiles, deren Layout-Material CARPET — gelesen: 49 Zeilen
- `src/render/floor-cash.ts` — Kasse als Objekt: offene Gewinne liegen als Chip-Stapel am Wechseltisch. — gelesen: 69 Zeilen
- `src/render/floor-cues.ts` — Bodenhinweise: Spielerring, Zielraster, Laufweg und Klick-Puls in einer Ebene. — gelesen: 222 Zeilen
- `src/render/floor-events.ts` — Die eine Tabelle: Ereignis -> Burst, Ton, Licht, Shake und Anker. — gelesen: 131 Zeilen
- `src/render/floor-input.ts` — Floor-Input: Tap-Logik, baut Aktionen und ruft Callbacks. — gelesen: 80 Zeilen
- `src/render/floor-interact.ts` — Verarbeitet Radial-Menu-Aktionen vom Floor. — gelesen: 17 Zeilen
- `src/render/floor-material.ts` — Bodenmaterialien aus dem Layout: pro `FloorMaterialId` genau eine — gelesen: 114 Zeilen
- `src/render/floor-math.ts` — Reine Floor-Mathe: Regions-Hash, Invalidierung, LOD, Culling, Koordinaten. Kein Pixi. — gelesen: 149 Zeilen
- `src/render/floor-perf.bench.ts` — Worst-Case: 90×90-Floor, 9 Regionen, 500 Dreck-Tiles, 200 Entities. — gelesen: 55 Zeilen
- `src/render/floor-props.ts` — Requisiten: Personal, Lieferkisten, Streitmarker und Platzierungs-Geist. Liest nur Snapshots. — gelesen: 233 Zeilen
- `src/render/floor-route.ts` — Laufwege: Teppichlaeufer zwischen den Raeumen, gelegt von Zonenrand zu Zonenrand, — gelesen: 84 Zeilen
- `src/render/floor-stage.tsx` — React-Bruecke zur Pixi-Buehne; haelt keinen Spielzustand. — gelesen: 134 Zeilen
- `src/render/floor-surface.ts` — Bodenflaeche und Licht: Muster je Material, Fugen, Deckenlampen und — gelesen: 111 Zeilen
- `src/render/floor-touch.ts` — Zeigergesten auf dem Canvas: Ein-Finger-Ziehen schwenkt, Tippen laeuft, Pinch zoomt. — gelesen: 175 Zeilen
- `src/render/floor-view.ts` — Pixi-Floor: gecachter Raum, zwei LOD-Stufen, weiche Kamera, gepoolte Akteure. Liest nur Snapshots. — gelesen: 195 Zeilen
- `src/render/furniture-art.ts` — Moebel: der Korpus kommt aus dem Atlas, nur Zustand und Sitze bleiben dynamisch. — gelesen: 120 Zeilen
- `src/render/furniture-atlas.ts` — Ein Korpus je Bauart und Groesse als RenderTexture. Instanzen zeichnen danach — gelesen: 214 Zeilen
- `src/render/fx/emitter.ts` — Partikel aus dem Paket: Gewinn- und Verlustmomente nutzen dieselben Emitter wie die Bibliothek. — gelesen: 171 Zeilen
- `src/render/fx/floor-fx.ts` — Partikel, Licht und Shake auf der Pixi-Buehne: Weltkoordinaten, ein Ticker, kein React. — gelesen: 116 Zeilen
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
- `src/render/guest-art.ts` — Pixel-Figur: Rig, Bemalung und Sticker hinter einer Fassade; die Buehne liest nur diese. — gelesen: 105 Zeilen
- `src/render/guest-head.ts` — Kopf und Gesicht der Pixelfigur: Schaedel, Haar, Augen, Mund und Kopf-Textur. — gelesen: 112 Zeilen
- `src/render/guest-paint.ts` — Bemalung der Pixelfigur: Palette, Persona-Farben, Koerper, Beine, Arme und Pin. — gelesen: 139 Zeilen
- `src/render/guest-parts.ts` — Gaeste-Teile, die einmal gelten: Palette, Kopftexturen und der eine Schatten. — gelesen: 50 Zeilen
- `src/render/guest-rig.ts` — Skelett der Pixelfigur: Container, Gelenke, Pin, Namensschild, Squash und Tap-Ring. — gelesen: 128 Zeilen
- `src/render/haptics.ts` — Haptik ohne neue Abhaengigkeit: WebView-Vibration, respektiert reduced motion. — gelesen: 16 Zeilen
- `src/render/music.ts` — Musikschicht in der vorhandenen Audioarchitektur: eigene Lautstaerke, drei — gelesen: 186 Zeilen
- `src/render/perf-governor.ts` — Drei Leistungsstufen mit Hysterese. Der Governor bekommt nur deltaMS; er — gelesen: 58 Zeilen
- `src/render/pixel-head.ts` — Figuren aus dem Paket: ein Kopf-Sprite, das die gezeichnete Figur ersetzt, wenn es geladen ist. — gelesen: 29 Zeilen
- `src/render/player-marker.ts` — Zustandsmarker ueber dem Spieler: Verletzung und Handgemenge auf dem Floor. — gelesen: 26 Zeilen
- `src/render/rig-pose.ts` — Reine Pose-Mathematik fuer das Pixel-Rig; ohne Pixi testbar. — gelesen: 131 Zeilen
- `src/render/rig.bench.ts` — Rendering-nahe Posekosten; bewusst nicht Teil von verify:all. — gelesen: 28 Zeilen
- `src/render/rng.ts` — Der eine Darstellungs-Strom: Partikel und Sound, nie der Spielzustand. — gelesen: 4 Zeilen
- `src/render/room-art.ts` — Raum: Bodenmaterial je Tile aus dem Layout, Waende und Tueren aus den — gelesen: 76 Zeilen
- `src/render/room-dressing.ts` — Raumausstattung ueber dem Bodenbelag: das, was einen Raum wiedererkennbar macht, — gelesen: 109 Zeilen
- `src/render/scene-cache.ts` — Vier Render-Layer. Boden und Dreck liegen in 30×30-Regions-Chunks; nur veraenderte backen neu. — gelesen: 184 Zeilen
- `src/render/sound-fx.ts` — Prozeduraler WebAudio-Synth: alle Effekte ohne Asset, mit getrennten Kanaelen und stillem Fallback. — gelesen: 216 Zeilen
- `src/render/wall-art.ts` — Türschwellen aus den gespeicherten Kanten. Wandkoerper liegen bewusst nicht — gelesen: 95 Zeilen
- `src/render/wall-occlusion.ts` — Vordergrund-Waende als eigene Occlusion-Schicht. Jede Wand ist ein Sprite in — gelesen: 66 Zeilen
- `src/store/__tests__/card-payout.test.ts` — Der Hausvorteil des fremden Hauses darf nur den Gewinn treffen. Einsatz, — gelesen: 29 Zeilen
- `src/store/__tests__/determinism.test.ts` — Determinismus: derselbe Seed und dieselben Ticks ergeben denselben Spielzustand, — gelesen: 53 Zeilen
- `src/store/__tests__/narrative-commands.test.ts` — Die Store-Naht drainiert Facts an der Mutationsgrenze und fuehrt Choices aus. — gelesen: 92 Zeilen
- `src/store/__tests__/narrative-rival-source.test.ts` — Eine echte Kartenabrechnung im fremden Haus erzeugt eine Rivale-zu-Haus-Kante. — gelesen: 51 Zeilen
- `src/store/__tests__/narrative-save.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 143 Zeilen
- `src/store/__tests__/own-play.test.ts` — Die Fassade haelt offene Kartenrunden genau einmal, blockiert Doppelbuchungen — gelesen: 81 Zeilen
- `src/store/__tests__/prng-persistence.test.ts` — Der PRNG-Zustand setzt nach dem Laden die Folge exakt fort, ohne Doppelziehung. — gelesen: 70 Zeilen
- `src/store/__tests__/rival-play-commands.test.ts` — import { describe, expect, it } from 'vitest'; — gelesen: 33 Zeilen
- `src/store/__tests__/save-device.test.ts` — Alte Speicherstaende koennen eine Geräteidentität tragen, die zum Spieltyp — gelesen: 71 Zeilen
- `src/store/__tests__/save-layout.test.ts` — Save v11: Layout-Vertrag im Spielstand, Migration aus v5–v10 und — gelesen: 125 Zeilen
- `src/store/__tests__/save-migration.test.ts` — Ein v5-Spielstand behaelt Fiat und offene Ansprueruche beim Laden. — gelesen: 84 Zeilen
- `src/store/__tests__/save-reels.test.ts` — Alte Speicherstaende koennen eine ungueltige Walzenzahl tragen. Das Laden — gelesen: 65 Zeilen
- `src/store/__tests__/save-rivals.test.ts` — Der Rivalen-Zustand steht im Save und ueberlebt einen Neustart; ein v9-Stand — gelesen: 47 Zeilen
- `src/store/__tests__/save-roundtrip.test.ts` — Speichern, laden und danach exakt dieselbe Simulation fortsetzen. — gelesen: 84 Zeilen
- `src/store/__tests__/save-staff.test.ts` — Alte Speicherstaende trugen den Guard als Flag neben den Agenten. Beim Laden — gelesen: 77 Zeilen
- `src/store/__tests__/save-v7.test.ts` — Ein v6-Spielstand bekommt Kisten, Agenten und Bedürfnisse mit Defaults; v7 bleibt rund. — gelesen: 119 Zeilen
- `src/store/__tests__/save-wage-field.test.ts` — Saves vor der Anwesenheitsregel tragen kein `lastWorkDay` im Job. — gelesen: 63 Zeilen
- `src/store/__tests__/transfer.test.ts` — Import/Export: Der eigene Export muss sich wieder importieren lassen. Die — gelesen: 55 Zeilen
- `src/store/foreign-floor-commands.ts` — Foreign Floor Commands: Besucher- und Job-Aktionen in fremden Casinos. — gelesen: 41 Zeilen
- `src/store/foreign-play.ts` — Fremde Haeuser: Spiel und Besuch an einer Stelle, damit der Store schlank bleibt. — gelesen: 148 Zeilen
- `src/store/game-commands.ts` — Game Commands: Spielautomaten, Plinko, Ausschluss. — gelesen: 38 Zeilen
- `src/store/layout-editing.ts` — Editor-Verlauf am Store-Rand: typisierte Commands anwenden, Pinselstriche — gelesen: 90 Zeilen
- `src/store/layout-transfer.ts` — Layout-Export und -Import am Store-Rand. Der Import prueft das Dokument — gelesen: 55 Zeilen
- `src/store/legacy-demand.ts` — Legacy-Savefeld aus der Zeit vor NAR-13; nur noch fuer die Migration. — gelesen: 7 Zeilen
- `src/store/memory.bench.ts` — Speicher- und Save-Groesse: eine definierte 1000-Tick-Sitzung, kein Sample-Ring. — gelesen: 33 Zeilen
- `src/store/migrate-layout.ts` — Layout-Migration: v11 liest den gespeicherten Plan, v5–v10 leiten ihn — gelesen: 31 Zeilen
- `src/store/migrate-narrative.ts` — Hydration der Narrative-Domaene und der Besucher-Erinnerungen beim Laden. — gelesen: 102 Zeilen
- `src/store/migrate-staff.ts` — Personal-Migration alter Speicherstaende. — gelesen: 38 Zeilen
- `src/store/migrate-stains.ts` — Hydration von Flecken und Wischern für Save-Migration (v9). — gelesen: 10 Zeilen
- `src/store/migrate.ts` — Hydration und Migration gespeicherter Stände (v5/v6/v7) in eine frische Welt. — gelesen: 127 Zeilen
- `src/store/narrative-commands.ts` — Store-Naht fuer Narrative: Choice ausfuehren, Szene ablehnen und Facts flushen. — gelesen: 41 Zeilen
- `src/store/narrative.bench.ts` — NAR-16: Narrative Hotpath. Gemessen wird ein realistischer Tick nach einem — gelesen: 53 Zeilen
- `src/store/own-play.ts` — Store-Fassade fuer eigene Spielrunden: Der Kern rechnet und bucht, die — gelesen: 105 Zeilen
- `src/store/perf-hot-paths.bench.ts` — Messpfad fuer RBD-16: langer Spielstand, 200 Gaeste, 90x90-Floor. — gelesen: 88 Zeilen
- `src/store/player-tools.ts` — Spieler-Commands, die der Store nur noch bestaetigt. — gelesen: 47 Zeilen
- `src/store/rival-play-commands.ts` — Rival Play Commands: Karten- und Risikospiele in fremden Casinos. — gelesen: 89 Zeilen
- `src/store/save.ts` — Save v11: Welt + Layout + Ledger-Log + Journal + PRNG + Narrative-Domaene + Rivalen-Zustand. — gelesen: 143 Zeilen
- `src/store/service-commands.ts` — Service Commands: Gäste bedienen, Bezahlen, Bewegen. — gelesen: 25 Zeilen
- `src/store/snapshot.ts` — Snapshot aus Welt und Ledger; keine eigene Geldwahrheit in der UI. — gelesen: 139 Zeilen
- `src/store/transfer.ts` — Import und Export von Spielstaenden: Plan zuerst, Anwenden erst nach Pruefung. — gelesen: 48 Zeilen
- `src/store/types.ts` — Was die UI sieht: Welt plus abgeleitete Ledger-Werte. — gelesen: 117 Zeilen
- `src/store/use-world-store.ts` — import { useSyncExternalStore } from 'react'; — gelesen: 9 Zeilen
- `src/store/venue-commands.ts` — Venue Commands: Bau, Einrichtung, Preise – alles was das Haus verändert. — gelesen: 212 Zeilen
- `src/store/world-store.ts` — Ein Besitzer: Welt, Ledger, PRNG, Uhr und Save. Commands delegiert an Module. — gelesen: 216 Zeilen
- `src/styles/app.css` — { box-sizing: border-box; } — gelesen: 554 Zeilen
- `src/styles/index.css` — Quelldatei ohne Kopfkommentar — gelesen: 3 Zeilen
- `src/styles/layout-editor.css` — Nur der dynamisch geladene Editor importiert diese Regeln; im Produktionsbuild fehlen sie. — gelesen: 21 Zeilen
- `src/styles/popup.css` — .popup-backdrop { — gelesen: 602 Zeilen
- `src/styles/tokens.css` — Eine Bildsprache fuer UI und Floor. Die Rollen hier sind dieselben wie in — gelesen: 82 Zeilen
- `src/test/measure.ts` — Explizite Messung: feste Iterationszahl, ein Warmup, monotone Uhr. — gelesen: 26 Zeilen
- `src/test/random-seed.ts` — import { randomInt } from 'node:crypto'; — gelesen: 9 Zeilen
- `src/ui/__tests__/card-tables.test.tsx` — Eine laufende Blackjack-Hand darf nicht durch neues Austeilen ersetzt werden, — gelesen: 134 Zeilen
- `src/ui/__tests__/casino-window-header.test.tsx` — import { describe, expect, it } from 'vitest'; — gelesen: 29 Zeilen
- `src/ui/__tests__/dialogue-ui.test.tsx` — Die Blase zeigt Sprecher und Lauftext des aktuellen Knotens; Direktlinks — gelesen: 55 Zeilen
- `src/ui/__tests__/editor-gate.test.ts` — Editor-Freigabe: der Query-Parameter allein oeffnet nie einen Produktionsbuild. — gelesen: 31 Zeilen
- `src/ui/__tests__/editor-tools.test.ts` — Editor-Werkzeuge: Command-Absicht und Tastaturkuerzel sind rein und testbar; — gelesen: 45 Zeilen
- `src/ui/__tests__/guest-profile.test.tsx` — Der Gast-Popup reicht nur die Besucher-ID an den Aufrufer; Profile und — gelesen: 59 Zeilen
- `src/ui/__tests__/machine-play.test.tsx` — Der Betrieb behält den kostenlosen Diagnose-Testspin. Der Gast bekommt ohne — gelesen: 93 Zeilen
- `src/ui/__tests__/narrative-ui.test.tsx` — Die UI zeigt nur, was der Snapshot liefert: Szenentext, Frist, gesperrte — gelesen: 116 Zeilen
- `src/ui/__tests__/perspective-switch.test.tsx` — import { cleanup, fireEvent, render, screen } from '@testing-library/react'; — gelesen: 23 Zeilen
- `src/ui/__tests__/ui.test.tsx` — UI-Integration ohne Pixi: Zustand, Fokus, Filter und Rivalenprofile. — gelesen: 142 Zeilen
- `src/ui/action-card.tsx` — Aktionskarte: eine grosse Empfehlung, zwei Alternativen, ein Schliessen. — gelesen: 44 Zeilen
- `src/ui/app-model.ts` — App-Modell: Popup-Ziele, Bau-Fit und Bewegungsachsen; aus App ausgelagert (LOC-Budget). — gelesen: 38 Zeilen
- `src/ui/asset-library-popup.tsx` — Asset-Bibliothek: alles, was im Paket liegt, ist im Spiel sichtbar und anhoerbar. — gelesen: 191 Zeilen
- `src/ui/bet-console.tsx` — Wettkonsole unter den Walzen: Jetons, Autospin und der eine grosse Knopf. — gelesen: 42 Zeilen
- `src/ui/build-catalog-cards.tsx` — Katalog-Karten: kaufbare Spiele und Deko als Drag-fähige Bau-Karten. Reine Darstellung. — gelesen: 45 Zeilen
- `src/ui/build-ops-summary.tsx` — Kompakte Betriebsübersicht: die vier Zahlen, die den Floor erklären. — gelesen: 33 Zeilen
- `src/ui/build-panel-parts.tsx` — Bau-Sektionen: Personal, Hauswahl, Farben, Kisten, Streit. Reine Darstellung. — gelesen: 176 Zeilen
- `src/ui/build-panel.tsx` — Bau-Popup: kaufen, liefern, Personal, Preise, Deko und Freischaltung. — gelesen: 185 Zeilen
- `src/ui/casino-window-header.tsx` — Kopfzeile eines Casino-Fensters: Geldtoepfe, verbaute Mods, Pakt und Vollbild. — gelesen: 52 Zeilen
- `src/ui/diagnostics-popup.tsx` — Diagnose: Buchhaltung, Personal, Lager und Protokoll auf einen Blick. — gelesen: 121 Zeilen
- `src/ui/dialogue-popup.tsx` — Dialog: Comic-Dialog als reine Darstellung. — gelesen: 69 Zeilen
- `src/ui/dock.tsx` — Untere Leiste: vier Ecken je Perspektive. Alles andere lebt in der Werkstatt. — gelesen: 96 Zeilen
- `src/ui/editor-gate.ts` — Editor-Freigabe: nur ein Build mit `RBD_EDITOR_MODE=1` und `?editor=1` — gelesen: 15 Zeilen
- `src/ui/editor-tools.ts` — Reine Werkzeuglogik des Layout-Editors: Sie uebersetzt die gewaehlte Absicht — gelesen: 53 Zeilen
- `src/ui/floor-role-bar.tsx` — Rollenhinweis auf dem Floor: sagt, was der nächste Klick bewirkt. — gelesen: 17 Zeilen
- `src/ui/foreign-floor-hud.tsx` — Foreign Floor HUD: Anzeige auf fremden Floors. — gelesen: 88 Zeilen
- `src/ui/foreign-floor-map.tsx` — Foreign Floor Map: Übersichtskarte aller fremden Casinos. — gelesen: 109 Zeilen
- `src/ui/foreign-floor-popup.tsx` — Fenster auf einem fremden Floor: HUD plus Job-Menue an der gewaehlten Station. — gelesen: 54 Zeilen
- `src/ui/format.ts` — Kompakte Anzeige: VC ohne Zahlenrauschen. — gelesen: 19 Zeilen
- `src/ui/games-popup-lazy.tsx` — Chunk-Grenze fuer das Spiel-Paket: Engines, Tische und Pixi-Buehnen der — gelesen: 26 Zeilen
- `src/ui/games-popup.tsx` — Fremdes Haus: echte Rivalen mit Betreiber, Regeln, Maschinen und Hausvorteil. — gelesen: 195 Zeilen
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
- `src/ui/glossary.ts` — Ein Ort für Begriffe, die der Spieler sieht: kurze Erklärung statt Branchenjargon. — gelesen: 44 Zeilen
- `src/ui/guest-popup.tsx` — Ein Klick auf einen Gast: Sticker, Budget und drei Werte mit klarer Folge statt Tabellen. — gelesen: 152 Zeilen
- `src/ui/help-popup.tsx` — Hilfe: Geldfluss, Gäste, Objekte und Steuerung in Klartext, erreichbar über das ? im HUD. — gelesen: 100 Zeilen
- `src/ui/hud-icons.ts` — HUD-Icons als Data-URI: die zwei 32x32-PNGs sind zusammen rund 4 KB und — gelesen: 10 Zeilen
- `src/ui/hud.tsx` — HUD: Marke, eine sichtbare Perspektive und nur die Zahlen, die zu ihr gehören. — gelesen: 160 Zeilen
- `src/ui/icons.ts` — Icons aus dem Paket: ein Pfad-Helfer, damit UI und Renderer dieselbe Basis nutzen. — gelesen: 28 Zeilen
- `src/ui/job-context-menu.tsx` — Job-Kontext-Menu: Sims-Style Interaktion an einer Job-Station. — gelesen: 115 Zeilen
- `src/ui/journal-popup.tsx` — Ereignisprotokoll: was passiert ist, warum, und was daraus folgt — live oder aus dem Archiv. — gelesen: 125 Zeilen
- `src/ui/journal-stories.tsx` — Abgeschlossene Szenen als Rueckblick im Journal; nur Anzeige des Snapshots. — gelesen: 47 Zeilen
- `src/ui/layout-editor.tsx` — Entwicklungs-Editor fuer das Raumlayout. Nur erreichbar, wenn der Build — gelesen: 170 Zeilen
- `src/ui/look-popup.tsx` — Charaktereditor: reine Kosmetik, sofort im Save und auf dem Floor sichtbar. — gelesen: 90 Zeilen
- `src/ui/machine-operator.tsx` — Betriebskörper am Automaten: Zustand, Diagnose, Reparatur und Mods. — gelesen: 165 Zeilen
- `src/ui/machine-play-lazy.tsx` — Lazy-Grenze fuer die eigenen Spieltische: Pixi und Engines erst beim Gastmodus. — gelesen: 13 Zeilen
- `src/ui/machine-play.tsx` — Eigene Spiele am Automaten: dieselben Tische wie im Fremdhaus, eigener Geldweg. — gelesen: 56 Zeilen
- `src/ui/machine-popup.tsx` — Automaten-Popup: Gast spielt, Betrieb diagnostiziert. Eine globale Perspektive, kein interner Rollentoggle. — gelesen: 111 Zeilen
- `src/ui/narrative-events.tsx` — NAR-14: Aktive Szenen als Karten; Auswahl und Ablehnung laufen ueber Store-Commands. — gelesen: 113 Zeilen
- `src/ui/narrative-popup.tsx` — NAR-14: Popup fuer aktive Szenen und Besucherprofile. — gelesen: 45 Zeilen
- `src/ui/narrative-profile.tsx` — NAR-14: Besucherprofil aus dem Snapshot; Rechnungen bleiben im Core. — gelesen: 97 Zeilen
- `src/ui/perspective-switch.tsx` — Der eine Umschalter zwischen Spieler- und Betreiberblick. — gelesen: 33 Zeilen
- `src/ui/plinko-editor-lazy.tsx` — Chunk-Grenze fuer den Plinko-Editor: Der Editor zieht die 185-KB-Buehne — gelesen: 19 Zeilen
- `src/ui/plinko-editor.tsx` — Operator-Board-Editor: echte Konfiguration, ehrliches Gate, sichtbarer Fortschritt. — gelesen: 181 Zeilen
- `src/ui/popup-router.tsx` — Popup-Routing: eine Zustaendigkeit, damit App nur noch verdrahtet. — gelesen: 165 Zeilen
- `src/ui/popup-shell.tsx` — Ein Rahmen für alle Popups: Backdrop, Titel, Fokusfalle, Escape, Schließen. — gelesen: 80 Zeilen
- `src/ui/roulette-tableau.tsx` — Das Setzfeld: jede Zelle ist ein Feld, jeder Klick legt einen Jeton dorthin. — gelesen: 65 Zeilen
- `src/ui/self-exclusion-panel.tsx` — Self-Exclusion als Gameplay: kein verstecktes Menü, sondern ein sichtbarer Pakt. — gelesen: 67 Zeilen
- `src/ui/slot-rules-editor.tsx` — Regel-Editor am Automaten: Streifen, Gewichte, Modell, Volatilität und Bonus-Paytable. — gelesen: 138 Zeilen
- `src/ui/slot-telemetry.tsx` — Slot-Telemetrie: Historie, Abweichung, Druck und letzte Symbole ohne Beschönigung. — gelesen: 38 Zeilen
- `src/ui/smartphone-build.tsx` — Smartphone-App: BUILD - ersetzt BuildPanel — gelesen: 32 Zeilen
- `src/ui/smartphone-buy.tsx` — Smartphone-App: BUY - Getränke, Ersatzteile kaufen — gelesen: 25 Zeilen
- `src/ui/smartphone-clean.tsx` — Smartphone-App: CLEAN - Putzen — gelesen: 37 Zeilen
- `src/ui/smartphone-serve.tsx` — Smartphone-App: SERVE - Getränke servieren — gelesen: 33 Zeilen
- `src/ui/smartphone-travel.tsx` — Smartphone-App: TRAVEL - Casino-Wechsel — gelesen: 30 Zeilen
- `src/ui/smartphone.tsx` — Smartphone: zentraler Zugangspunkt für alle Interaktionen. — gelesen: 102 Zeilen
- `src/ui/sound-popup.tsx` — Lautstaerke, Kanaele und Musik: Master plus Spiele, Kampf, Bedienung getrennt. — gelesen: 79 Zeilen
- `src/ui/staff-labels.ts` — Gemeinsame Klartext-Labels für Personalstatus in Panel und Diagnose. — gelesen: 19 Zeilen
- `src/ui/stage-controls.tsx` — Buehnenrand: nur die Kamera-Knoepfe. Tastenkuerzel stehen in der Werkstatt. — gelesen: 15 Zeilen
- `src/ui/table-launcher.tsx` — Waehlt das passende Fenster am Geraet: Walzen, Plinko oder Wuerfel. — gelesen: 145 Zeilen
- `src/ui/transfer-panel.tsx` — Import und Export: Spielstand als JSON sichern, pruefen und zurueckspielen. — gelesen: 49 Zeilen
- `src/ui/use-stage-keys.ts` — Tastenpfad der Buehne: laufen, tragen, zoomen. App verdrahtet nur noch. — gelesen: 48 Zeilen
- `src/ui/workshop-parts.tsx` — Bausteine der Werkstatt: Rasterkarte, Steuerung und ein ehrlicher Live-FPS-Wert. — gelesen: 107 Zeilen
- `src/ui/workshop.tsx` — Werkstatt: sechs Bereiche in einem Raster, erreichbar nur ueber Marke oder Tastatur. — gelesen: 114 Zeilen
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
