# CI: Lokale Gates und Repository-Verwaltung

<!-- rbd-doc: managed -->

**Zweck:** Die eine Wahrheit für den lokalen Abschluss. Es gibt keinen Cloud-Testlauf; alle Gates, Tests, Builds und APKs laufen lokal. `AGENTS.md` nennt nur die Kurzfassung; die Ausführungskategorien stehen in [`LOCAL_CI.md`](LOCAL_CI.md).

## Required Gates

Der Required-Plan besteht aus sechzehn Gates:

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
| 14 | `generated` | `node scripts/sync-generated.mjs --all --check` | `ERR-4028` |
| 15 | `tests` | `pnpm run test:ci` | `ERR-4026` |
| 16 | `build` | `pnpm run build` | `ERR-1005` |

**Audit ist kein Required-Gate.** Er läuft zusätzlich bei einer echten Dependency-Änderung, mit `RBD_VERIFY_AUDIT=1` oder im Profil `full`/`release`. Dann sind es siebzehn Läufe, aber weiterhin sechzehn Required-Gates.

**Eigentümer der generierten Artefakte** (`content/narrative/registry/fragments.json`, `content/narrative/turns/manifest.json`, `src/core/sim/narrative/composer/registry.generated.ts`, `docs/INVENTORY.md`, `docs/ROADMAP.md`, `docs/DEPENDENCY-MATRIX.md`) ist ausschließlich `scripts/sync-generated.mjs` mit seinen Generatoren. Keine Lane schreibt sie von Hand: Konflikte werden regeneriert, nie aufgelöst. Das Gate `generated` prüft den Stand rein lesend (`--check`) und blockiert damit den lokalen Vor-PR-Nachweis, bevor ein Merge überhaupt ansteht.

Lokal gilt:

- `verify:light` = zehn Gates: `lint`, `check:loc`, `typecheck`, `docs`, `catalog`, `generated`, `test-placement`, `tree`, `impact-graph`, `redundancy`.
- `verify:fast` = Light plus `dead-code`, `test-quality`, `affected` und `build`; der Standard vor dem Push.
- `verify:dev` = Light plus `affected`; gezieltes Entwicklungsfeedback.
- `verify:quick` = fünfzehn Gates: Required ohne `build`.
- `verify:integration` = vierzehn lokale Gates: Light plus `dead-code`, `test-quality`, `affected` und `build`.
- `verify:all` = sechzehn Required plus Audit (siebzehn Läufe).
- `verify:release` = der Integrationsnachweis mit erzwungenem Audit und Production-Build.
- `test:mechanics` = ausschließlich Statistik, Soak, Langlauf und Benchmarks; nie Teil eines Regelprofils.

Die Profile sind rein lesend. Reparaturen laufen nur über `pnpm run fix`; ein Gate schreibt nie vorher die Akte um.

## Zustände

| Zustand | Auslöser | Plan |
| --- | --- | --- |
| `READY` | lokaler Start | `verify:light` oder `verify:dev` |
| `FULL` | lokaler Vor-PR-Nachweis | `verify:all` plus vollständige Suite |
| `NOOP` | Kopf ist die Basis | keine Prüfung; der lokale Claim-/Scope-Pfad bleibt zuständig |
| `UNKNOWN` | Diff nicht bestimmbar | `verify:all` plus Audit, nie ein stiller Light-Erfolg |

`main` hat keinen Cloud-Vollauf. Der Merge ist ein manueller Schritt nach dem lokalen Vor-PR-Nachweis `verify:integration` und, bei Release-Bedarf, `verify:release`.

## Workflows

Stand 2026-11-11 liegen drei Workflow-Dateien in `.github/workflows/`; keine führt Tests, Gates, Builds oder APKs aus:

| Workflow | Status | Aufgabe |
| --- | --- | --- |
| `ensure-pr.yml` | aktiv | Lane-Push legt den PR an oder aktualisiert ihn (App-Token) |
| `pr-cleanup.yml` | aktiv | löscht gemergte Wegwerf-Branches und legt den Post-Merge-Closeout-PR an |
| `promote.yml` | **manuell** | Status anzeigen oder Notausgang `integration`; kein Auto-Merge |

Entfernt wurden `ci-verify.yml`, `long-checks.yml`, `auto-version-release.yml`, `build-apk.yml`, `pr-watcher.yml` und `auto-resolve.yml`: Ihre Arbeit ist vollständig lokal (`pnpm run ci:local`, `pnpm run test:mechanics`, `pnpm run android:apk`, `pnpm run turn:finish`). Ein zweiter Testpfad existiert nicht mehr.

### Lokal statt Cloud

```bash
pnpm run ci:local            # Struktur, Testqualität, betroffene Tests, Build
pnpm run ci:local --profile=full
pnpm run ci:local --profile=release
pnpm run ci:local --profile=mechanics
pnpm run ci:local --profile=apk
pnpm run verify:all          # vollständiger Required-Nachweis ohne Mechanik
pnpm run verify:long         # alias auf test:mechanics
```

## Branch-Schutz

`main` ist über einen klassischen Branch-Schutz gesichert:

- Required Status Checks: **keine**; es gibt keinen Cloud-Check mehr
- `strict: false`
- keine Pflicht-Reviews
- `enforce_admins: true`
- Force-Push und Löschen verboten
- keine Rulesets

Der Weg ist: Arbeitsbranch, PR gegen `main`, lokaler `verify:integration`, Review und anschließend ein bewusster Merge durch den Maintainer. `turn-push.mjs` pusht nie direkt auf `main`. Ein Merge-Commit trägt dieselben drei Pflichtsektionen wie ein normaler Commit; `verify-commit-msg` prüft den Text weiterhin.

## Nachweise

```bash
# lokaler Abschluss
pnpm run verify:light
pnpm run verify:fast
pnpm run verify:integration
pnpm run test:mechanics       # nur on demand
pnpm run android:apk          # lokaler APK-Build
```

Ein grüner Light-Lauf ist kein Integrationsnachweis. Ein laufender Cloud-Check existiert nicht mehr; es gibt keine Warteschlange und keinen Remote-Status, auf den ein Merge wartet.

## Referenzen

- [`LOCAL_CI.md`](LOCAL_CI.md) — Ausführungskategorien, lokale Befehle und APK-Ablauf.
- [`WORKFLOW.md`](WORKFLOW.md) — Pretask, Abschluss und manueller Merge.
- [`GOVERNANCE.md`](GOVERNANCE.md) — Claims, Register und Eskalation.
- [`TESTING.md`](TESTING.md) — Testlinie und Testmatrix.
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — Pipeline, Kontrollebene und Zustandsbesitz.
