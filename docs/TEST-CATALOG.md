# Testkatalog

Abgeleitet aus `@test-target` (System) und der Rolle der Datei (Beweisklasse).
Der Katalog wird von `npm run catalog` geschrieben und von `npm run verify:all`
im `--check`-Modus geprueft: eine neue Testdatei ohne Eintrag macht den Lauf rot.

Beweisklassen: contract, integration, governance, statistics, performance.
Lokal laufen nur Vertrags-, Integrations- und Governance-Nachweise; statistics und performance
delegiert `npm run test:affected` an GitHub Actions (`npm run ci:long`).
<!-- TEST_CATALOG_START -->
Summe: 96 Dateien — contract 57 · integration 19 · governance 9 · statistics 6 · performance 5.

| Testdatei | System | Beweisklasse | Lokal | Deklariertes Ziel |
| --- | --- | --- | --- | --- |
| `src/core/economy/__tests__/economy.test.ts` | economy | contract | ja | `src/core/economy/ledger.ts` |
| `src/core/economy/__tests__/ledger-checkpoint.test.ts` | economy | contract | ja | `src/core/economy/ledger.ts` |
| `src/core/economy/__tests__/ledger-diagnose.test.ts` | economy | contract | ja | `src/core/economy/ledger.ts` |
| `src/core/games/__tests__/contracts.test.ts` | games | contract | ja | `src/core/games/contracts.ts` |
| `src/core/games/__tests__/dice-bets.test.ts` | games | contract | ja | `src/core/games/dice-bets.ts` |
| `src/core/games/__tests__/foreign-round-atomic.test.ts` | sim | contract | ja | `src/core/sim/actions.ts` |
| `src/core/games/__tests__/game-rounds.test.ts` | games | contract | ja | `src/core/games/contracts.ts` |
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
| `src/core/games/engines/__tests__/blackjack.test.ts` | games | contract | ja | `src/core/games/engines/blackjack.ts` |
| `src/core/games/engines/__tests__/interactive-cards.test.ts` | games | contract | ja | `src/core/games/engines/interactive-cards.ts` |
| `src/core/governance/__tests__/affected-tests.test.ts` | pipeline | governance | ja | `scripts/lib/affected-tests.mjs` |
| `src/core/governance/__tests__/branch-prune.test.ts` | pipeline | governance | ja | `scripts/lib/branch-prune.mjs` |
| `src/core/governance/__tests__/ci-gates.test.ts` | ci | governance | ja | `.github/workflows/ci-verify.yml` |
| `src/core/governance/__tests__/dependency-governance.test.ts` | governance | contract | ja | `src/core/governance/error-codes.ts` |
| `src/core/governance/__tests__/gate-runner.test.ts` | pipeline | governance | ja | `scripts/lib/gate-runner.mjs` |
| `src/core/governance/__tests__/pipeline-modes.test.ts` | pipeline | governance | ja | `scripts/lib/pipeline-plan.mjs` |
| `src/core/governance/__tests__/process-sweep.test.ts` | pipeline | governance | ja | `scripts/lib/process-sweep.mjs` |
| `src/core/governance/__tests__/release-escalation.test.ts` | pipeline | governance | ja | `scripts/lib/release-escalation.mjs` |
| `src/core/governance/__tests__/test-catalog.test.ts` | pipeline | governance | ja | `scripts/lib/test-catalog.mjs` |
| `src/core/governance/__tests__/tree-changes.test.ts` | pipeline | governance | ja | `scripts/lib/tree-changes.mjs` |
| `src/core/physics/__tests__/physics.test.ts` | physics | contract | ja | `src/core/physics/world.ts` |
| `src/core/rng/__tests__/shoe.test.ts` | rng | contract | ja | `src/core/rng/shoe.ts` |
| `src/core/rng/__tests__/streams.test.ts` | rng | contract | ja | `src/core/rng/streams.ts` |
| `src/core/rng/__tests__/weighted.test.ts` | rng | contract | ja | `src/core/rng/weighted.ts` |
| `src/core/sim/__tests__/balance-operating.test.ts` | sim | statistics | nein, CI | `src/core/sim/tick.ts` |
| `src/core/sim/__tests__/brawl-combat.test.ts` | sim | contract | ja | `src/core/sim/brawl-combat.ts` |
| `src/core/sim/__tests__/demand.test.ts` | sim | contract | ja | `src/core/sim/demand.ts` |
| `src/core/sim/__tests__/device-identity.test.ts` | sim | contract | ja | `src/core/sim/device.ts` |
| `src/core/sim/__tests__/duel.test.ts` | sim | contract | ja | `src/core/sim/duel.ts` |
| `src/core/sim/__tests__/expansion.test.ts` | sim | contract | ja | `src/core/sim/expansions.ts` |
| `src/core/sim/__tests__/foreign-floor-tick.test.ts` | sim | contract | ja | `src/core/sim/foreign-floor-tick.ts` |
| `src/core/sim/__tests__/grid-zones.test.ts` | sim | contract | ja | `src/core/sim/grid-zones.ts` |
| `src/core/sim/__tests__/guest-flow.test.ts` | sim | contract | ja | `src/core/sim/world.ts` |
| `src/core/sim/__tests__/guest-settlement.test.ts` | sim | contract | ja | `src/core/sim/remodel.ts` |
| `src/core/sim/__tests__/journal.test.ts` | sim | contract | ja | `src/core/sim/journal.ts` |
| `src/core/sim/__tests__/logistics.test.ts` | sim | contract | ja | `src/core/sim/deliveries.ts` |
| `src/core/sim/__tests__/look.test.ts` | sim | contract | ja | `src/core/sim/player-look.ts` |
| `src/core/sim/__tests__/mod-guards.test.ts` | sim | contract | ja | `src/core/sim/actions.ts` |
| `src/core/sim/__tests__/mod-resolver.test.ts` | sim | contract | ja | `src/core/sim/offers.ts` |
| `src/core/sim/__tests__/money-truth.test.ts` | sim | contract | ja | `src/core/sim/money.ts` |
| `src/core/sim/__tests__/movement-queue.test.ts` | sim | contract | ja | `src/core/sim/movement-queue.ts` |
| `src/core/sim/__tests__/narrative-facts.test.ts` | sim | contract | ja | `src/core/sim/narrative/facts.ts` |
| `src/core/sim/__tests__/narrative-memory.test.ts` | sim | contract | ja | `src/core/sim/narrative/memory.ts` |
| `src/core/sim/__tests__/narrative-start-pool.test.ts` | sim | contract | ja | `src/core/sim/narrative/state.ts` |
| `src/core/sim/__tests__/pathfinding.test.ts` | sim | contract | ja | `src/core/sim/pathfinding.ts` |
| `src/core/sim/__tests__/player-jobs.test.ts` | sim | contract | ja | `src/core/sim/player-jobs.ts` |
| `src/core/sim/__tests__/player-rpg.test.ts` | sim | contract | ja | `src/core/sim/player-rpg.ts` |
| `src/core/sim/__tests__/player-speed.test.ts` | sim | contract | ja | `src/core/sim/tick.ts` |
| `src/core/sim/__tests__/progression.test.ts` | sim | contract | ja | `src/core/sim/progression.ts` |
| `src/core/sim/__tests__/reputation.test.ts` | sim | contract | ja | `src/core/sim/spawn.ts` |
| `src/core/sim/__tests__/rivals.test.ts` | sim | contract | ja | `src/core/sim/rivals.ts` |
| `src/core/sim/__tests__/shot-seed.test.ts` | store | integration | ja | `src/store/save.ts` |
| `src/core/sim/__tests__/soak.test.ts` | sim | statistics | nein, CI | `src/core/sim/tick.ts` |
| `src/core/sim/__tests__/staff-status.test.ts` | sim | contract | ja | `src/core/sim/staff-queries.ts` |
| `src/core/sim/__tests__/tycoon-needs.test.ts` | sim | contract | ja | `src/core/sim/needs.ts` |
| `src/core/sim/__tests__/tycoon-ops.test.ts` | sim | contract | ja | `src/core/sim/deliveries.ts` |
| `src/core/sim/__tests__/visitors.test.ts` | sim | contract | ja | `src/core/sim/visitors.ts` |
| `src/core/sim/__tests__/world.test.ts` | sim | contract | ja | `src/core/sim/guests.ts` |
| `src/render/__tests__/floor-cache.test.ts` | render | integration | ja | `src/render/floor-math.ts` |
| `src/render/__tests__/rig-combat.test.ts` | render | integration | ja | `src/render/rig-pose.ts` |
| `src/render/__tests__/rig.test.ts` | render | integration | ja | `src/render/rig-pose.ts` |
| `src/render/__tests__/slot-layout.test.ts` | render | integration | ja | `src/render/games/slot-layout.ts` |
| `src/render/__tests__/sound-fx.test.ts` | render | integration | ja | `src/render/sound-fx.ts` |
| `src/render/floor-perf.bench.ts` | render | performance | nein, CI | `src/render/floor-math.ts` |
| `src/render/rig.bench.ts` | render | performance | nein, CI | `src/render/rig-pose.ts` |
| `src/store/__tests__/card-payout.test.ts` | store | integration | ja | `src/store/foreign-play.ts` |
| `src/store/__tests__/determinism.test.ts` | store | integration | ja | `src/store/transfer.ts` |
| `src/store/__tests__/narrative-save.test.ts` | store | integration | ja | `src/store/save.ts` |
| `src/store/__tests__/prng-persistence.test.ts` | store | integration | ja | `src/store/save.ts` |
| `src/store/__tests__/rival-play-commands.test.ts` | store | integration | ja | `src/store/rival-play-commands.ts` |
| `src/store/__tests__/save-device.test.ts` | store | integration | ja | `src/store/migrate.ts` |
| `src/store/__tests__/save-migration.test.ts` | store | integration | ja | `src/store/save.ts` |
| `src/store/__tests__/save-reels.test.ts` | store | integration | ja | `src/store/migrate.ts` |
| `src/store/__tests__/save-roundtrip.test.ts` | store | integration | ja | `src/store/save.ts` |
| `src/store/__tests__/save-staff.test.ts` | store | integration | ja | `src/store/migrate.ts` |
| `src/store/__tests__/save-v7.test.ts` | store | integration | ja | `src/store/save.ts` |
| `src/store/memory.bench.ts` | store | performance | nein, CI | `src/store/save.ts` |
| `src/store/perf-hot-paths.bench.ts` | store | performance | nein, CI | `src/store/snapshot.ts` |
| `src/ui/__tests__/card-tables.test.tsx` | ui | integration | ja | `src/ui/games/blackjack-popup.tsx` |
| `src/ui/__tests__/ui.test.tsx` | ui | integration | ja | `src/ui/popup-shell.tsx` |
<!-- TEST_CATALOG_END -->
