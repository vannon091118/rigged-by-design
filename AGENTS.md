# Rigged by Design
<!-- rtk-instructions v2 -->
# Command output

Command output here is condensed to save tokens, keeping every signal and
dropping costly noise. Treat it as the complete result: run commands
normally, and batch related commands into one call to avoid extra turns.
Truncated results state their recovery path in their own output. Re-run a
command as `rtk bypass <cmd>` only when its result is unusable: empty when
output was clearly expected, contradicting its exit code, or garbled.
<!-- /rtk-instructions -->

Vite + React 19 + TypeScript + PixiJS 8 casino sim. No real money; VaCoins are integer micro-units (1 VC = 10.000). Simulation is headless in `src/core/`; `world-store` owns world, ledger, PRNG, clock, save.

## Dev environment

- Node 22, npm. `npm ci` then `npm run dev` (http://localhost:3000).
- Save format v8 (world + journal + look); v5/v6/v7 migrate (keep Fiat, open payouts, journal, look), v3/v4 discarded.

## Build & test

- `npm run test` — Vitest run (CI alias `test:ci`).
- `npm run typecheck` — `tsc --noEmit`.
- `npm run lint` / `lint:fix` — ESLint.
- `npm run check:loc` — LOC guard (Budget und Hot Zone pro Zuständigkeit in `scripts/loc-budgets.mjs`; Legacy 350/200 nur für gelistete Dateien, keine neuen `// @loc-exception:`).
- `npm run verify:all` — fail-closed pipeline (autofix inkl. ESLint/Dependency-Matrix, LOC, typecheck, Testvertrag, Dead-Export, audit, vitest, build). Autofix läuft zuerst und allein; danach laufen die unabhängigen Gates parallel, grüne Gates werden per Inhalts-Hash aus `.verify-cache/` wiederverwendet (`RBD_VERIFY_NO_CACHE=1` erzwingt alles neu). Beim Start sterben verwaiste Gate-Prozesse abgebrochener Läufe, SIGINT/SIGTERM nimmt laufende Gates mit; beendet wird ausschließlich PID-genau über `taskkill /T` bzw. die Prozessgruppe, nie über Namensmuster.
- `npm run verify:quick` — Entwicklungsfeedback, gemessen 17,4 s kalt und 1,2 s bei unverändertem Baum: Autofix (ESLint-Cache), LOC, Typecheck, Testvertrag, Dead-Export und die schnelle Hälfte der Suite. **Kein Build, kein Audit und keine RTP-, Balance- und Soak-Nachweise** — deshalb nie als Ersatz vor einem Commit.
- `npm run verify:release` — Freigabelauf für APK und Versionssprung: identisch mit `verify:all`, erzwingt aber `npm audit` unabhängig von der Änderung; CI setzt zusätzlich `RBD_VERIFY_AUDIT=1`.
- `npm run test:perf` — feste Messläufe (not in verify:all). `npm run bench:lowend` pins the run to one core; `npm run soak` runs 100.000 ticks.
- UI tests run in jsdom via `@testing-library/react`; the include pattern covers `.test.tsx`.
- `npm run build` — Vite production build.

## Delivery

- After a turn: `npm run turn:finish` (ohne Argumente) stagt global alle Änderungen (`git add -A`, respektiert `.gitignore`), läuft **`verify:quick`**, committet und pusht `main`. Pfade nur für einen bewusst verengten Commit: `npm run turn:finish -- <paths>`.
- **Quick ist der Normalfall, das volle Profil nur bei Bedarf.** `npm run turn:finish:full` nimmt denselben Weg mit `verify:all`. Voll ist Pflicht, wenn `package.json` oder `package-lock.json` betroffen sind, Geld-, Ledger-, RNG- oder Save-Migrationscode geändert wurde, ein Release, Tag oder APK entsteht (`verify:release`) oder CI auf demselben Stand schon rot war. Für UI, Text, Doku und Anzeige-Arbeit reicht quick.
- Der vollständige Beweis bleibt verpflichtend, nur nicht auf dem Rechner: jeder Push auf `main` läuft in CI durch `verify:release`, also durch alle acht Stufen. Quick verschiebt die Prüfung nach CI, er spart sie nicht ein.
- Tests laufen ausschließlich am Ende eines Turns: keine Zwischenläufe von npm run test, npm run test:ci oder npm run verify:all während der Arbeit. `verify:quick` darf mittendrin laufen — er ist Entwicklungsfeedback, keine Freigabe, und committet nichts.
- If branch protection rejects direct push, push the working branch and open a focused PR to `main`.

## Conventions

- `src/core/` must stay headless (no browser deps) and testable.
- One owner per state: `world-store` holds world/ledger/PRNG; UI state (popups) lives in React.
- Money is integer micro-units; no floats; every transaction is a ledger line.
- RNG via `src/core/rng/weighted.ts` (`buildDistribution`, `rollNumber`); cards via `src/core/rng/shoe.ts` (draw removes card; reshuffle only when empty).
- No `addVC` outside a booking; no money source except `EXTERNAL_WORLD`.

## Pitfalls

- Do not hand-edit generated files in `dist/`.
- LOC guard fails the build; reduce below the Hot Zone of the file's responsibility instead of adding an exception. Each file has exactly one responsibility and one budget; legacy exceptions are migration debt and only shrink.
- `test:perf` intentionally not in `verify:all`; don't gate on it on slow hardware.
- Commit messages verified by `verify:commit-msg`; new error codes in `docs/ERROR_CATALOG.md`.
- `verify-test-quality` requires `@test-target` and `@error-code` headers on `.test.ts` and `.test.tsx`; fixed numeric `new Prng(...)` seeds are rejected, use `randomSeed()`.
- Journal state lives in `WorldState`; UI only reads the snapshot and never maintains a second log.