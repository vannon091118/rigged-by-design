# CI: Local-first Gates, Zustände und Cloud-Rest

<!-- rbd-doc: managed -->

**Zweck:** Die eine Wahrheit für den lokalen Abschluss und den schlanken Cloud-Pflichtcheck. `AGENTS.md` nennt nur die Kurzfassung; die Ausführungskategorien und der APK-Ablauf stehen in [`LOCAL_CI.md`](LOCAL_CI.md).

## Required Gates

Der Required-Plan besteht aus fünfzehn Gates:

| # | Gate | Skript | Fehlercode |
| --- | --- | --- | --- |
| 1 | `lint` | `pnpm run lint` | `ERR-4011` |
| 2 | `check:loc` | `pnpm run check:loc` | `ERR-4012` |
| 3 | `typecheck` | `pnpm run typecheck` | `ERR-1005` |
| 4 | `test-quality` | `scripts/verify-test-quality.mjs` | `ERR-4002` |
| 5 | `dead-code` | `scripts/verify-dead-code.mjs` | `ERR-4003` |
| 6 | `docs` | `scripts/verify-docs.mjs` | `ERR-4017` |
| 7 | `catalog` | `node scripts/test-catalog.mjs --check` | `ERR-4015` |
| 8 | `tree` | `scripts/verify-tree.mjs` | `ERR-4019` |
| 9 | `impact-graph` | `scripts/verify-impact-graph.mjs` | `ERR-4019` |
| 10 | `redundancy` | `scripts/verify-redundancy.mjs` | `ERR-4020` |
| 11 | `assets` | `pnpm run verify:assets` | `ERR-4016` |
| 12 | `capabilities` | `scripts/verify-capabilities.mjs` | `ERR-4025` |
| 13 | `narrative` | `scripts/verify-narrative-blocks.mjs` | `ERR-4022` |
| 14 | `tests` | `pnpm run test:ci` | `ERR-4026` |
| 15 | `build` | `pnpm run build` | `ERR-1005` |

**Audit ist kein Required-Gate.** Er läuft zusätzlich bei einer echten Dependency-Änderung, mit `RBD_VERIFY_AUDIT=1`, im Zustand `UNKNOWN` und im lokalen Profil `full`/`release`. Dann sind es sechzehn Läufe, aber weiterhin fünfzehn Required-Gates. Der PR-Pflichtjob führt davon nur die Light-Gates aus; die fünfzehn Required-Gates sind der vollständige Release-/Full-Nachweis.

Lokal gilt:

- `verify:light` = neun Gates: `lint`, `check:loc`, `typecheck`, `docs`, `catalog`, `test-placement`, `tree`, `impact-graph`, `redundancy`.
- `verify:fast` = Light plus `test-quality`, `affected` und `build`; der Standard vor dem Push.
- `verify:dev` = Light plus `affected`; gezieltes Entwicklungsfeedback.
- `verify:quick` = vierzehn Gates: Required ohne `build`.
- `verify:integration` = zwölf lokale Gates: Light plus `test-quality`, `affected` und `build`; der Vor-PR-Nachweis ohne volle Suite.
- `verify:all` = fünfzehn Required plus Audit (sechzehn Läufe).
- `verify:release` = der Integrationsnachweis mit erzwungenem Audit und Production-Build.
- `verify:long` = Soak, Balance, Statistik und Benchmarks; ausschließlich on demand.

Die Profile sind rein lesend. Reparaturen laufen nur über `pnpm run fix`; ein Gate schreibt nie vorher die Akte um.

## Zustände

| Zustand | Auslöser | Plan |
| --- | --- | --- |
| `PR` | Pull Request gegen `main` | ein Cloud-Job `Fail-Closed Gates`: PR-Body, Commit-Konvention, Freeze und `verify:light` |
| `NOOP` | Kopf ist die Basis | keine Pflichtprüfung; der lokale Claim-/Scope-Pfad bleibt zuständig |
| `UNKNOWN` | Zustand nicht bestimmbar | fail-closed: lokaler Integrationsnachweis, kein stiller Light-Erfolg |

`main` hat keinen eigenen Cloud-Vollauf mehr. Der Merge ist ein manueller Schritt nach dem lokalen Vor-PR-Nachweis `verify:integration` und, bei Release-Bedarf, `verify:release`; damit entstehen keine zwei konkurrierenden Wahrheiten für denselben Kopf.

## Workflows

Stand 2026-11-11 liegen neun Workflow-Dateien in `.github/workflows/`:

| Workflow | Status | Aufgabe |
| --- | --- | --- |
| `ci-verify.yml` | aktiv | ein schneller Required-Job auf PRs: Light-Gates, Web-Build, Release-Bump für das Artefakt und Debug-APK |
| `ensure-pr.yml` | aktiv | Lane-Push legt den PR an oder aktualisiert ihn (App-Token) |
| `pr-watcher.yml` | aktiv | Issues bei rotem `CI Verify`-Lauf; kein PR-Body-Pfad |
| `pr-cleanup.yml` | aktiv | löscht gemergte Wegwerf-Branches und legt den Post-Merge-Closeout-PR an |
| `auto-resolve.yml` | per Variable | optionaler Auto-Resolve bei rotem Lauf |
| `promote.yml` | **manuell** | Status anzeigen oder Notausgang `integration`; kein Auto-Merge |
| `auto-version-release.yml` | **manuell** | Release-Gates, Tag und GitHub-Release; keine Cloud-APK |
| `long-checks.yml` | **on-demand** | Soak, Balance, Statistik und Benchmarks ohne Zeitplan |
| `build-apk.yml` | **manuell** | Cloud-Fallback für Debug/Release-APK; Standard ist lokal |

`pr-escalation.yml` wurde entfernt: Der PR-Body wird im Pflichtjob geprüft und von `ensure-pr` bzw. dem lokalen Abschluss gepflegt; ein zusätzlicher Push-Lauf mit Schreibrecht auf Pull Requests war doppelte Arbeit.

### Eine Stimme pro SHA

`ci-verify.yml` läuft ausschließlich für Pull Requests gegen `main`. Ein Lane-Push startet keinen zweiten Vollauf; ein PR-Lauf auf demselben Kopf entfällt. Der Pflichtstatus heißt weiterhin `Fail-Closed Gates` und bleibt der einzige geschützte Status.

### Lokal statt Cloud

Die vollständige Suite, der Production-Build, Audit und die langen Nachweise laufen lokal:

```bash
pnpm run verify:light      # Struktur und schnelle Gates
pnpm run verify:fast       # vor dem Push: Light + Testqualität + betroffene Tests + Build
pnpm run verify:integration # vor dem PR: Light + betroffene Tests + Build
pnpm run verify:long       # nur bei konkretem Bedarf
pnpm run verify:release    # vor einem Release inkl. Audit
```

Der Cloud-Pflichtcheck wiederholt bewusst nur das schnelle `verify:light`; er ist kein Ersatz für den lokalen Integrationsnachweis und keine zweite Testmaschine.

## Branch-Schutz

`main` ist über einen klassischen Branch-Schutz gesichert:

- Required Status Check: `Fail-Closed Gates`
- `strict: false`
- keine Pflicht-Reviews
- `enforce_admins: true`
- Force-Push und Löschen verboten
- keine Rulesets

Der Weg ist: Arbeitsbranch, PR gegen `main`, lokaler `verify:integration`, grüner `Fail-Closed Gates`-Check und anschließend ein bewusster Merge im GitHub-UI. `turn-push.mjs` pusht nie direkt auf `main`. Ein Merge-Commit trägt dieselben drei Pflichtsektionen wie ein normaler Commit; `verify-commit-msg` prüft den Text weiterhin.

## Governance-Freeze

Der Cloud-Job prüft den Freeze vor den Gates. Den Checker lädt er aus dem Basis-Commit (`.rbd-control`), das Prüfobjekt bleibt der PR-Kopf (`RBD_ROOT`). Eine inhaltliche Änderung an `.github/`, `.githooks/`, `.lane-claims/`, `scripts/` oder den Governance-Verträgen braucht eine Freigabe aus `scripts/freeze-unlock.mjs`. Reine Doku-Marker und Versionszeilen zählen nicht. Ohne Freigabe wird der Job rot; eine Korruptionsmeldung bleibt ein `BLOCKED`-Befund.

## Nachweise

```bash
# lokaler Abschluss
pnpm run verify:fast
pnpm run verify:integration
pnpm run verify:long          # on demand
pnpm run android:apk          # lokaler APK-Build

# Cloud nur beobachten, nicht als primäre Testmaschine
gh run list --workflow="CI Verify" --branch <branch> --limit 5
gh pr checks <pr>
```

Ein grüner Light-Lauf ist kein Integrationsnachweis. Ein laufender Check ist weder rot noch grün; Timeout, Abbruch und Netzfehler bleiben `REMOTE_CI` und werden wiederholt.

## Referenzen

- [`LOCAL_CI.md`](LOCAL_CI.md) — Ausführungskategorien, lokale Befehle und APK-Ablauf.
- [`WORKFLOW.md`](WORKFLOW.md) — Pretask, Abschluss und manueller Merge.
- [`GOVERNANCE.md`](GOVERNANCE.md) — Claims, Register und Eskalation.
- [`TESTING.md`](TESTING.md) — Testlinie und Testmatrix.
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — Pipeline, Kontrollebene und Zustandsbesitz.
