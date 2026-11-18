# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands run in the repository root (`D:\Projekte\rigged-by-design`) with pnpm@10.4.1 and Node >=22.22.2.

**Development**
- `pnpm dev` — Start Vite dev server (src/Config/vite.config.ts)
- `pnpm build` — Production build with Vite
- `pnpm preview` — Preview production build

**Tests**
- `pnpm test` — Full vitest suite (src/Config/vite.config.ts)
- `pnpm test:watch` — vitest in watch mode
- `pnpm test:perf` — Performance benchmarks
- `pnpm soak` — Soak test (RBD_SOAK=1, 100k ticks on src/core/sim/__tests__/soak.test.ts)
- `pnpm test:ci` — CI-selected tests (node scripts/run-selected-tests.mjs)
- `pnpm test:affected` — Affected tests (node scripts/test-affected.mjs)
- Single test file: `pnpm vitest run --config src/Config/vite.config.ts src/core/sim/__tests__/soak.test.ts`

**Typecheck & Lint**
- `pnpm typecheck` — tsc --noEmit (src/Config/tsconfig.json)
- `pnpm lint` — eslint (src/Config/eslint.config.mjs)
- `pnpm lint:fix` — eslint --fix

**Verify (governance pipeline)**
- `pnpm verify` — quick profile (17 gates)
- `pnpm verify:all` — full profile (19 gates incl. audit)
- `pnpm verify:quick` / `verify:light` / `verify:fast` / `verify:dev` / `verify:integration` / `verify:long` / `verify:release`
- `pnpm verify:merge-gate` — Branch protection check
- `pnpm verify:board` — Board usage check
- `pnpm verify:claims` — Lane claims check
- `pnpm verify:dead-code` — Dead code detection
- `pnpm verify:docs` — Documentation drift check
- `pnpm verify:test-placement` — Test placement check
- `pnpm verify:test-quality` — Test quality check

**Agent lifecycle (governance)**
- `pnpm rbd docs read` — Read the five governance docs (required before any work; PreToolUse hook blocks tools without valid receipt)
- `pnpm rbd agent start --brief` — Start agent work
- `pnpm rbd agent pretask` / `agent:context` / `agent:cause` / `agent:verify`
- `pnpm claim:preflight` / `claim:hygiene` / `claim:register`
- `pnpm board:sync` / `board:overview`
- `pnpm turn:finish` / `turn:finish:fast` / `turn:finish:integration` / `turn:finish:full`

**Android**
- `pnpm android:apk` / `android:apk:release` — Build APK

## Architecture

**High-level:** A zynisch-humorvolle Lebenssimulation (life simulation) with no casino focus. The player wakes in an apartment, walks through a city with persistent NPCs, runs a shop, pays rent, and manages VaCoin (integer-only game currency).

**Layer structure:**
- `src/core/` — Headless game core (no Pixi/React/DOM). Economy (ledger with double-entry bookkeeping, integer money), simulation (tick-timing with TICK_MS=520, single clock), player skills, city simulation, narrative commands, RNG (deterministic Mulberry32, separated gameplay/presentation streams). Rule: no Math.random/Date.now/new Date() in game path (enforced by eslint-determinism.test.ts).
- `src/render/` — PixiJS v8 rendering layer. Floor view, city actor sync, wall occlusion, visual scene frame. Reads from core simulation, writes to floor ticker (no second ticker).
- `src/ui/` — React UI layer (HUD, career, smartphone, workshop, narrative events). Reads from core, writes commands.
- `src/store/` — World store (single state owner), save/load (v11 with ledger integrity and migration v5–v10), city door walk.
- `src/Config/` — Vite config (vitest embedded), ESLint config, TypeScript config.

**Governance (docs/governance/):**
- Five managed docs: INDEX, AGENTS.md, PITFALLS, ROADMAP, LAST-CHANGES (each ≤500 tokens).
- Agent contract: Agent claims → works → pushes → opens PR; Maintainer reviews → merges → closes → tags; User decides.
- Ten rules (see AGENTS.md): Claim before Read; no `reset --hard`/`clean`/`stash`/`push --force`/`branch -D`; world-store is single state owner; `src/core/` stays headless; integer money with ledger entries; no Math.random/Date.now/new Date() in game path; narrative from state boundaries only; one test line; docs in same commit; branch + PR with `rbd claim preflight` before push.
- Verify pipeline: 18 Required + 13 Light gates. `verify:all` = 18 Required + Audit (19 runs).
- Boundaries: no direct `main` push, merge, close, or force.

**Verify profiles:** `quick` (17 gates, default for `pnpm verify`), `light` (13, recommended local start per docs/CI.md), `full` (19, incl. audit), `dev`, `integration`, `long` (= test:mechanics), `release`.

**Determinism:** Mulberry32 PRNG with gameplay | presentation namespaces. eslint-determinism.test.ts enforces Rule 5. Save v11 with ledger integrity check and migration v5–v10 → v11.

## Git Safety

Never run `git reset` or `git rebase` with uncommitted changes; always commit or stash first, and explicitly verify `save.ts` and `weighted.ts` are safe before destructive operations. Clear stale claim files from other lanes before pushing, and run pre-commit/pre-push hooks locally first to anticipate blocks like ERR-4019.

## User Preferences

Prefer shipping concrete, binding deliverables (PRs, issue commissions, fixed files) over producing additional analysis prompts when the user asks to resolve findings.

## Testing & TypeScript

Run TypeScript checks (`pnpm typecheck`) and relevant tests after editing source files, especially for type-sensitive issues like #979, before declaring a fix complete.

## Subagents

Use subagents for parallel exploration but consolidate report units yourself; do not depend on subagents that may hang during multi-phase report generation.