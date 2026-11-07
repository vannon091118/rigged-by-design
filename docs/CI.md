# CI: Required Gates, Zustände und Workflows

<!-- rbd-doc: v0.3.183 | 2026-11-07 23:58 UTC -->

**Zweck:** Die eine Wahrheit für den CI-Plan. `AGENTS.md` nennt nur die Kurzfassung; dieses Dokument führt die zwölf Required-Gates und die optionalen Nachweise.

## Required Gates

Der Required-Plan besteht aus zwölf Gates:

| # | Gate | Skript | Fehlercode |
| --- | --- | --- | --- |
| 1 | `lint` | `pnpm run lint` | `ERR-4011` |
| 2 | `check:loc` | `pnpm run check:loc` | `ERR-4012` |
| 3 | `typecheck` | `pnpm run typecheck` | `ERR-1005` |
| 4 | `test-quality` | `scripts/verify-test-quality.mjs` | `ERR-4002` |
| 5 | `dead-code` | `scripts/verify-dead-code.mjs` | `ERR-4003` |
| 6 | `docs` | `scripts/verify-docs.mjs` | `ERR-4017` |
| 7 | `tree` | `scripts/verify-tree.mjs` | `ERR-4019` |
| 8 | `redundancy` | `scripts/verify-redundancy.mjs` | `ERR-4020` |
| 9 | `assets` | `pnpm run verify:assets` | `ERR-4016` |
| 10 | `capabilities` | `scripts/verify-capabilities.mjs` | `ERR-4025` |
| 11 | `tests` | `pnpm run test:ci` | `ERR-4026` |
| 12 | `build` | `pnpm run build` | `ERR-1005` |

**Audit ist kein Required-Gate.** Er läuft zusätzlich bei einer echten Dependency-Änderung, mit `RBD_VERIFY_AUDIT=1`, im Zustand `UNKNOWN` und im lokalen Profil `full`/`release`. Dann sind es dreizehn Läufe, aber weiterhin zwölf Required-Gates.

Lokal gilt:

- `verify:light` = sechs Gates: `lint`, `check:loc`, `typecheck`, `docs`, `tree`, `redundancy`.
- `verify:dev` = Light plus `affected` (sieben Läufe).
- `verify:quick` = elf Gates: Required ohne `build`.
- `verify:all` = zwölf Required plus Audit (dreizehn Läufe).

`ci-verify.yml` übersetzt den Plan in eine Matrix: ein Job je Gate, `fail-fast: false`, der Aggregat-Job **`Fail-Closed Gates`** ist der einzige geschützte Status. Eine leere Matrix ist nur in `NOOP` und `PR_HANDOFF` zulässig; ein unbekanntes Gate bricht ab, statt still zu bestehen.

### Kontrollebene

Der PR ist Prüfobjekt, nicht Prüfer. `ci-verify.yml` legt `.rbd-control` am Basis-Commit an (bei PRs die PR-Basis, bei Feature-Pushes `main`, auf `main` der gepushte Commit). Planer, Node-Gates, Langlauf-Kommando und Claim-Prüfung laufen aus dieser Kontrollebene; `RBD_ROOT` zeigt auf den Prüfbaum. Eine Basis ohne `RBD_ROOT` bricht ab; es gibt keinen Bootstrap-Fallback auf PR-Skripte.

PR, `main` und manuelle Läufe setzen `full_tests=1`: die schnelle Suite ist vollständig. Der Impact verengt nur Gates und lange Nachweise, nie die Regression. Reine Doku bleibt ausgenommen.

## Zustände

| Zustand | Auslöser | Plan |
| --- | --- | --- |
| `PR` | Pull Request gegen `main` | 12 Required, volle Suite, Impact für lange Nachweise |
| `MAIN` | Push auf `main` | 12 Required, volle Suite |
| `MANUAL` | `workflow_dispatch` von `CI Verify` | 12 Required, volle Suite; Audit nur nach Impact/Env |
| `LIGHT` | Feature-Push ohne offenen PR | 6 Light-Gates, keine Suite |
| `NOOP` | Kopf ist die Basis, kein unabhängiger Diff | keine Gates, kein Pflichtstatus |
| `PR_HANDOFF` | Feature-Push bei offenem PR | keine Gates; der PR-Lauf ist die Wahrheit |
| `UNKNOWN` | Zustand nicht bestimmbar | 12 Required plus Audit; fail-closed |

Ein grüner `LIGHT`-Lauf ist **kein** PR-Nachweis. Ein `NOOP` ist kein Fehler und erzeugt kein Issue. Ein `PR_HANDOFF` verhindert den doppelten vollen Lauf.

## Workflows

Stand 2026-11-07 liegen neun Workflow-Dateien in `.github/workflows/`:

| Workflow | Status | Aufgabe |
| --- | --- | --- |
| `ci-verify.yml` | aktiv | Matrix, Required-Gates, Langlauf-Matrix, Pflichtstatus |
| `auto-version-release.yml` | aktiv | Tag und Release erst nach grünem `CI Verify` auf `main` |
| `long-checks.yml` | aktiv | Wochen- und manueller Langlauf (Statistik, Soak, Balance, Benchmarks) |
| `build-apk.yml` | aktiv | APK-Build, manuell oder aus dem Release |
| `pr-cleanup.yml` | aktiv | meldet gemergte Wegwerf-Branches, löscht sie nicht |
| `auto-resolve.yml` | per Variable | ordnet roten Lauf ein, repariert mechanisch, Issue danach |
| `promote.yml` | **manuell deaktiviert** | historischer Auto-Merge/Integration-Pfad |
| `pr-watcher.yml` | **manuell deaktiviert** | historische Issue-Automatik |
| `pr-escalation.yml` | **manuell deaktiviert** | historischer PR-Body-Lift |

`auto-resolve.yml` ist im Arbeitsbranch vorhanden, auf `main` aber erst nach dem Merge sichtbar. Die Aktivierung und die Nachweise stehen im [`RUNBOOK-AUTO-RESOLVE.md`](RUNBOOK-AUTO-RESOLVE.md). `promote` wird nicht reaktiviert; der Merge bleibt manuell. Die deaktivierten Watcher sind kein Ersatz für den Required-Status.

### Branch-Schutz

`main` ist über einen **klassischen Branch-Schutz** gesichert, nicht über ein Ruleset:

- Required Status Check: `Fail-Closed Gates`
- `strict: false` (der Kopf muss nicht aktuell mit `main` sein)
- keine Reviews erforderlich (`required_approving_review_count: 0`)
- `enforce_admins: true`
- Force-Push und Branch-Löschung verboten
- keine Rulesets (`GET /rulesets` ist leer)

Der Weg ist deshalb: Arbeitsbranch, PR gegen `main`, grüner `CI Verify`-Lauf auf dem exakten Kopf, manueller Merge. Ein Direktpush endet mit `GH006`; `turn-push.mjs` meldet `ERR-4023`.

Der Merge-Commit selbst ist Pruefobjekt des `main`-Laufs: `verify-commit-msg --head` verlangt auch dort die drei Pflichtsektionen. Ein Merge, der nur den PR-Titel traegt, macht `Fail-Closed Gates` rot, obwohl jedes Gate gruen war. Titel und Nachricht des Merge-Commits fuellen deshalb dieselben Sektionen wie ein normaler Commit: `### Changes (Was ist neu)`, `### Technische Basis & Kausalität`, `### Ausblick (Nächste Schritte)`.
Die Koepfe werden zeichengenau uebernommen, inklusive Umlaut in `Kausalität`; ein ASCII-Ersatz (`Kausalitaet`) laesst das Gate rot, obwohl alle Gates gruen waren.

### Textbaustein-Pflicht: Grenze der Pflege-Ausnahme

`verify:narrative-blocks --commit` verlangt fuer jeden Commit mindestens einen
neuen, im Manifest registrierten und in der Registry verdrahteten Baustein.
Ausgenommen sind nur Commits, deren gestagte Dateien **alle** unter `docs/`,
`AGENTS.md`, `README.md`, `.lane-claims/`, `.github/`, `.githooks/` oder
`scripts/` liegen. Die Grenze steht als `MAINTENANCE_PATHS` in
`scripts/lib/narrative-blocks.mjs` und ist bewusst eng und alles-oder-nichts:
`content/**`, `src/**`, `public/**`, `index.html` und `package.json` sind nie
Pflege, und ein einziger solcher Pfad hebt die Ausnahme fuer den ganzen Commit
auf. Ein Doku-Commit neben einer Code-Aenderung braucht also weiterhin einen
Baustein. Pool-Minimum, Doppelte und das 1500-Ziel pruefen in beiden Faellen
unveraendert weiter, im Hook und im Assets-Gate.

Ohne gestagte Dateien prueft das Gate den Commit selbst: die Pfadliste kommt
dann aus `HEAD` gegen seine Eltern (bei einem Merge die Vereinigung ueber alle
Eltern). Damit bleibt eine reine Message-Korrektur per `git commit --amend`
moglich, ohne die Baustein-Pflicht zu umgehen; ein Content-Commit findet dort
seinen eigenen Baustein wieder.

## Nachweise

```bash
# eigener Lauf
gh run list --workflow="CI Verify" --branch <branch> --limit 5
gh run view <run-id> --log

# PR-Pflichtstatus
gh pr checks <pr> --watch

# lokaler Abschluss
pnpm run verify:light
pnpm run verify:dev
pnpm run verify:all
```

Ein grüner Lauf ohne genannten Befehl ist keine Aussage. Ein laufender Check ist weder rot noch grün. Timeout, Abbruch und Netzfehler sind `REMOTE_CI` (`ERR-4014`, `ERR-4016`) und werden wiederholt; nur echte Invarianten sind `BLOCKED`.

## Referenzen

- [`WORKFLOW.md`](WORKFLOW.md) — Pretask, Abschluss und manueller Merge.
- [`GOVERNANCE.md`](GOVERNANCE.md) — Claims, Register und Eskalation.
- [`TESTING.md`](TESTING.md) — Testlinie und Testmatrix.
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — Pipeline, Kontrollebene und Zustandsbesitz.
