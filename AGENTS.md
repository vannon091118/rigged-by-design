# Rigged by Design

<!-- rbd-doc: v0.3.69 | 2026-11-01 21:13 UTC -->
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
- Werkzeug-Configs liegen gesammelt in `src/Config/` (`tsconfig.json`, `vite.config.ts`, `eslint.config.mjs`, `capacitor.config.json`, `opencode.json`). Die npm-Skripte binden sie explizit (`--config`, `-p`), `prepare-android` legt die Capacitor-Kopie nur waehrend des Laufs in die Wurzel, und `.mailmap` bleibt als Git-Sonderfall in der Wurzel — Git liest sie nur dort.
- Save format v9 (world + journal + look + narrative); v5–v8 migrate (keep Fiat, open payouts, journal, look, visitor memories), v3/v4 discarded.

## Build & test

- `npm run test` — Vitest run (CI alias `test:ci`).
- `npm run test:affected` — nur Tests aus deklariertem Ziel, dem transitiven Importgraphen und dem betroffenen Subsystem, und nur die schnellen Beweisklassen. Statistik- und Messnachweise (RTP, Poker-Verteilung, Soak, Benchmarks) überspringt er und nennt sie; Entwicklungsfeedback, kein Ersatz für `verify:all`.
- `npm run agent:context [--json]` — ein Aufruf für den Arbeitskontext: Änderungen, Systeme, Invarianten, betroffene Tests, Gate-Plan, Doku-Bezüge und Cache-Stand. Reine Anzeige, keine Prüfung, keine zweite Analyse.
- `npm run agent:verify [--profile=quick|full|release] [--ci] [--json]` — derselbe Impact-Plan, Gates über `runGates` mit Cache, ein Bericht unter `.verify-cache/reports/<Zeit>/agent-summary.json`. Bei Impact-Auswahl laufen nur betroffene Tests und der Bericht sagt `partial`; `--ci` delegiert die langen Nachweise an Actions und wartet darauf. Kein Ersatz für `verify:all`.
- `npm run typecheck` — `tsc --noEmit`.
- `npm run lint` / `lint:fix` — ESLint.
- `npm run check:loc` — LOC guard (Budget und Hot Zone pro Zuständigkeit in `scripts/loc-budgets.mjs`; Legacy 350/200 nur für gelistete Dateien, keine neuen `// @loc-exception:`).
- `npm run verify:all` — fail-closed pipeline, **rein lesend** (Lint, LOC, typecheck, Testvertrag, Dead-Export, Doku-Gate, Tree-Gate, Redundanz-Gate, Asset-Manifest, vitest, audit, build — zwölf Gates). Jedes Gate legt sein vollständiges Log und eine `summary.md` unter `.verify-cache/reports/<Zeitstempel>/` ab; die Konsole zeigt eine Zeile je Gate und im Fehlerfall dessen Ende (`RBD_VERIFY_VERBOSE=1` gibt alles aus). Kein Gate schreibt Dateien; ein veralteter Baum wird rot, statt sich selbst zu reparieren. Die unabhängigen Gates laufen parallel, grüne Gates werden per Inhalts-Hash aus `.verify-cache/` wiederverwendet (`RBD_VERIFY_NO_CACHE=1` erzwingt alles neu). Jedes Gate hat ein hartes Zeitlimit (`ERR-4014`); nach Ablauf wird der Prozessbaum beendet. Beim Start sterben verwaiste Gate-Prozesse abgebrochener Läufe, SIGINT/SIGTERM nimmt laufende Gates mit; beendet wird ausschließlich PID-genau über `taskkill /T` bzw. die Prozessgruppe, nie über Namensmuster, und nur wenn PID **und** Startzeit noch zum Registry-Eintrag passen.
- `npm run verify` / `npm run verify:quick` — identisch und rein lesend: Lint, LOC, Typecheck, Testvertrag, Dead-Export, Doku-Gate, Tree-Gate, Redundanz-Gate, Asset-Manifest und die schnelle Hälfte der Suite. **Kein Build, kein Audit und keine RTP-, Balance- und Soak-Nachweise** — deshalb nie als Ersatz vor einem Commit.
- `npm run catalog` — schreibt `docs/TEST-CATALOG.md` (System aus `@test-target`, Beweisklasse aus der Rolle der Datei). Kein Gate mehr: der Pre-Commit-Hook ruft es auf. `--check` bleibt für manuelle Läufe (`ERR-4015`).
- `npm run docs:sync` — setzt Version und UTC-Zeitstempel als `rbd-doc`-Marker in die sechs Pflichtdokumente; `--staged` stagt sie. `npm run verify:docs` ist das Doku-Gate (Marker, Pflichtabschnitte, flacher Wurzelbaum, Inventar-Abdeckung gegen `git ls-files`, `ERR-4017`).
- `npm run docs:stub -- "Titel"` — legt Changelog-Zeile, Devtagebuch-Eintrag und Inventar-Logzeile mit Datum, Version und Uhrzeit an (`ERR-4021`); Inhalte bleiben Platzhalter für den Agenten.
- `npm run inventory:build` — schreibt Abschnitt 18 in `docs/INVENTORY.md`: eine Zeile je Pfad aus `git ls-files`, ein Eintrag je Ordner, Text gelesen, Binärsignaturen geprüft. Der Pre-Commit-Hook ruft ihn vor dem Marker; `verify:docs` wird rot, sobald eine Datei, ein Ordner oder die Abdeckungszahl fehlt.
- `npm run verify:tree` — Tree-Gate (`ERR-4019`): Wurzel-Whitelist, erlaubte Endungen je Ordner, Tests nur in `__tests__`, Core ohne Browser-Importe und ohne Importe nach außen.
- `npm run verify:redundancy` — Redundanz-Gate (`ERR-4020`): byte-identische Quelldateien, doppelte npm-Kommandos, doppelt eingetragene Fehlercodes.
- `npm run hooks:install` — aktiviert `.githooks` als `core.hooksPath` (`ERR-4018`). Der Pre-Commit-Hook schreibt Matrix, Katalog und Doku-Marker und prüft danach Doku und LOC.
- `npm run escalation:plan` — nennt zu einem Befund die Eskalationsstufe (`AUTO_FIX → LOCAL_GATE → REMOTE_CI → AGENT → BLOCKED`); ohne Argument liest er die letzte Gate-Zusammenfassung.
- `npm run pr:lift` — hebt den Commit-Body in den PR-Body; CI nutzt dasselbe Skript in `pr-escalation.yml`. Ohne `gh` gibt `node scripts/lift-commit-body.mjs --json` den Connector-Plan aus (`level`, `branch`, `base`, `title`, `bodyFile`, `body`); ein Agent mit GitHub-Connector legt damit den PR an oder aktualisiert den Body. Der Lauf bleibt gruen — Eskalation statt Fail-Closed.
- `npm run ci:long` — startet `long-checks.yml` in GitHub Actions für Statistik, Soak, Balance und Benchmarks, wartet auf das Ergebnis und lädt den Balance-Bericht als Artefakt. Bevorzugt `gh`, sonst die REST-API mit `GH_TOKEN`; ein roter Lauf meldet `ERR-4016`.
- `npm run branches:prune` — löscht lokal jeden nach `main` gemergten Branch außer `main` und dem aktuellen; offene, nicht gemergte Arbeit bleibt. `turn:finish` ruft das nach dem Push selbst auf, am Remote erledigt es `pr-cleanup.yml` nach jedem Merge; `--dry-run` zeigt die Kandidaten nur.
- `npm run fix` — der einzige schreibende Modus: ESLint `--fix`, Dependency-Matrix und Testkatalog, danach dieselben Gates samt Protokoll jeder geänderten und gelöschten Datei. Idempotent: ein zweiter Lauf meldet „keine Änderung, Arbeitsbaum unverändert“.
- `npm run verify:release` — Freigabelauf für APK und Versionssprung: identisch mit `verify:all`, erzwingt aber `npm audit` unabhängig von der Änderung; CI setzt zusätzlich `RBD_VERIFY_AUDIT=1`.
- `npm run test:perf` — feste Messläufe (not in verify:all). `npm run bench:lowend` pins the run to one core; `npm run soak` runs 100.000 ticks.
- UI tests run in jsdom via `@testing-library/react`; the include pattern covers `.test.tsx`.
- `npm run build` — Vite production build.

## Delivery

- After a turn: `npm run turn:finish` (ohne Argumente) stagt global alle Änderungen (`git add -A`, respektiert `.gitignore`), läuft **`verify:quick`**, committet und pusht `main`. Weil `verify` nur liest, laufen Reparaturen vorher separat über `npm run fix`. Pfade nur für einen bewusst verengten Commit: `npm run turn:finish -- <paths>`. Vor `verify` wird die Patch-Version gebumpt (`scripts/version-bump.mjs`), damit der Commit sie trägt; `.turn-notes.md` wird nach dem Commit gelöscht, und ein Titel, der HEAD wiederholt, bricht mit `ERR-4006` ab.
- **Quick ist der Normalfall, das volle Profil nur bei Bedarf.** `npm run turn:finish:full` nimmt denselben Weg mit `verify:all`. Voll ist Pflicht, wenn sich Abhängigkeiten ändern (`package.json`/`package-lock.json` jenseits der Turn-Version), Geld-, Ledger-, RNG- oder Save-Migrationscode geändert wurde, ein Release, Tag oder APK entsteht (`verify:release`) oder CI auf demselben Stand schon rot war. Für UI, Text, Doku und Anzeige-Arbeit reicht quick.
- Der vollständige Beweis bleibt verpflichtend, nur nicht auf dem Rechner: jeder Push auf `main` läuft in CI durch `verify:all`; `Auto Version & Release` startet erst nach diesem erfolgreichen Lauf und wiederholt die Suite nicht. Quick verschiebt die Prüfung nach CI, er spart sie nicht ein.
- Tests laufen ausschließlich am Ende eines Turns: keine Zwischenläufe von npm run test, npm run test:ci oder npm run verify:all während der Arbeit. `verify:quick` darf mittendrin laufen — er ist Entwicklungsfeedback, keine Freigabe, und committet nichts.
- Optional vor dem Commit: `npm run turn:finish -- --affected` ruft zuerst `agent:context` (derselbe Impact-Plan, keine zweite Testausführung) und danach unverändert `verify:quick`; mit `turn:finish:full -- --affected` bleibt `verify:all` das volle Tor.
- If branch protection rejects direct push, push the working branch and open a focused PR to `main`. The merge commit is checked by `verify-commit-msg --head`: use the exact section headings (`### Changes (Was ist neu)`, `### Technische Basis & Kausalität`, `### Ausblick (Nächste Schritte)`); ASCII variants fail. Reusing the PR body as the merge message satisfies this. Beim Merge ueber Connector oder REST-API gehoert der PR-Body deshalb in `commit_message`; ein reiner Klicktitel macht `verify-commit-msg --head` auf `main` rot (`ERR-4006`) und stoppt `Bump, tag, release` sowie den APK-Bau.
- **Automatische Promotion:** `promote.yml` legt den PR an und mergt ihn, sobald `CI Verify` gruen ist; ein roter Lauf legt den Stand auf die permanente Branch `integration` (Label `integration/rot`), damit dort repariert wird. Zwei parallele rote Staende werden gemergt, nicht verworfen; ein Textkonflikt bekommt `integration/konflikt` und bleibt beim Agenten. Der Merge-Text wird aus dem Commit-Body gebaut und traegt die Pflichtsektionen, sonst waere `main` sofort rot. Verified-Badge nur mit `RBD_PROMOTE_AUTO_MERGE=1` und GitHub-seitigem Merge. Ein Merge mit `GITHUB_TOKEN` startet keinen Workflow: `promote` nutzt `PROMOTE_TOKEN`, wenn gesetzt, und stoesst sonst `Auto Version & Release` an — ohne diesen Anstoss gibt es weder CI auf `main` noch Tag und APK. `integration` ist geschuetzt und wird von `pr-cleanup` und `branches:prune` nicht geloescht.
- **Identitaet:** Jeder Commit traegt `Vannon <Schneider.felix1993@gmail.com>` aus `scripts/lib/identity.mjs`; `turn:finish` und `promote.yml` setzen sie selbst, `.mailmap` fuehrt die Werkzeug-Namen der History zusammen. Kein Runner und keine Sandbox aendert den Committer.

## Pflichtdoku

Nach **jeder** Änderung oder Analyse werden diese sechs Dokumente aktualisiert, im selben Commit, mit Version und UTC-Zeitstempel im `rbd-doc`-Marker:

| Dokument | Inhalt |
| --- | --- |
| `docs/INVENTORY.md` | Was existiert, was gelesen und geprüft wurde, offene Befunde. |
| `docs/CHANGELOG.md` | Was sich je Version geändert hat (Spiel und Technik). |
| `docs/DEVTAGEBUCH.md` | Warum, mit Prüfungen und offenen Enden. |
| `docs/ARCHITECTURE.md` | Zustandsbesitz, Schichten, Pipeline, Begründungen. |
| `docs/ROADMAP.md` | Jetzt, als Nächstes, später. |
| `AGENTS.md` | Dieser Vertrag; Regeländerungen zuerst hier. |

- Der Marker wird **nicht von Hand** gepflegt: `npm run docs:sync`, der Pre-Commit-Hook oder `npm run fix` schreiben ihn.
- Einträge entstehen mit `npm run docs:stub -- "Titel"`; der Agent füllt danach Ziel, Umsetzung, Prüfungen und Offenes. Kein Eintrag ohne Datum, keiner nachträglich ohne Änderung.
- Strukturvorgaben stehen in `scripts/lib/doc-sync.mjs` (Pflichtabschnitte je Dokument); das Gate prüft sie, es repariert sie nicht.
- Markdown gehört nur als `README.md` oder `AGENTS.md` in die Wurzel; alles andere lebt unter `docs/`. Keine Doppelungen zwischen Wurzel und `docs/`. Dotfiles wie `.turn-notes.md` sind Arbeitsdateien des Turns und zählen nicht als Wurzel-Doku.
- Generierte Dateien (`docs/TEST-CATALOG.md`, Dependency-Matrix in `ARCHITECTURE.md`) werden vom Hook geschrieben, nicht gegated und nie von Hand editiert.
- Eskalationsregeln und die eine Leiter stehen in `docs/ESCALATION.md`; keine zweite Klassifikation anlegen.

## Conventions

- `src/core/` must stay headless (no browser deps) and testable.
- One owner per state: `world-store` holds world/ledger/PRNG; UI state (popups) lives in React.
- Money is integer micro-units; no floats; every transaction is a ledger line.
- RNG via `src/core/rng/weighted.ts` (`buildDistribution`, `rollNumber`); cards via `src/core/rng/shoe.ts` (draw removes card; reshuffle only when empty).
- Zwei RNG-Namespaces: Spielzustand (`gameplay`) und Darstellung (`presentation`) teilen nie einen Strom. Renderer/Sound ziehen aus `src/render/rng.ts`; `tickWorld`/`playRound` weisen fremde Stroeme ueber `assertGameplayRng` ab.
- No `addVC` outside a booking; no money source except `EXTERNAL_WORLD`.
- Determinismus: kein `Math.random()`, `Date.now()`, `performance.now()`, `new Date()` und keine Krypto-Zufallsquelle (`getRandomValues`, `randomUUID`) in `src/**` oder `scripts/**` — ESLint blockt direkte Zugriffe, `globalThis`/`window`-Umwege, `new`-Umwege und Aliase. `eslint-disable` ist per `noInlineConfig` global wirkungslos; `Date()` ohne `new` und `performance.timeOrigin` sind ebenfalls gesperrt. Ausnahmen stehen namentlich und begruendet in `eslint.config.mjs`: `performance.now` nur in `src/render/floor-view.ts`, `src/render/floor-props.ts` und `src/render/music.ts` (Pacing), Krypto nur in `src/core/rng/streams.ts`, Zeitstempel-/CI-Tooling. Jede andere Datei unter `src/render/**` ist voll gesperrt. Echter Zufall nur in `entropySeed()`; Exporte stempeln aus `world.day`/`world.tick`, nie aus der Uhr.

## Pitfalls

- Do not hand-edit generated files in `dist/`.
- LOC guard fails the build; reduce below the Hot Zone of the file's responsibility instead of adding an exception. Each file has exactly one responsibility and one budget; legacy exceptions are migration debt and only shrink.
- `test:perf` intentionally not in `verify:all`; don't gate on it on slow hardware.
- Commit messages verified by `verify:commit-msg`; new error codes in `docs/ERROR_CATALOG.md`.
- `verify-test-quality` requires `@test-target` and `@error-code` headers on `.test.ts` and `.test.tsx`; every `it`/`test` callback needs its own `expect`, and the file must import and use its declared target (directly or through a helper that imports it). Fixed numeric `new Prng(...)` seeds are rejected, use `randomSeed()`.
- Journal state lives in `WorldState`; UI only reads the snapshot and never maintains a second log.
- Narrative: Vertrag in `docs/NARRATIVE-ENGINE.md`. Facts (`src/core/sim/narrative/`) sind der Ereignisstrom fuer Trigger und Gedaechtnis, das Journal bleibt Spielerhistorie. `WorldState.narrative` ist der einzige persistente Narrativ-Zustand (Save v9); `Guest` bleibt Besuch, `Visitor` bleibt Identitaet mit hoechstens sechs Erinnerungen. Der Start-Pool (drei bekannte Figuren + `START_POOL`-Fact mit Startkapital) entsteht nur beim neuen Spiel ueber `seedStartPool`, nie in `createWorld`. Jeder Agent liefert pro abgeschlossenem Turn genau einen Content-Beitrag unter `content/narrative/contributions/` (Schema und Makro-Semantik in `docs/NARRATIVE-ENGINE.md`, Flags aus `content/narrative/vocabulary/`); Texte sind Darstellung, nie Spielregel.