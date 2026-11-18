# CI: Lokale Gates und Repository-Verwaltung

<!-- rbd-doc: managed -->

**Zweck:** Die eine Wahrheit für den lokalen Abschluss. Es gibt keinen Cloud-Testlauf; alle Gates, Tests, Builds und APKs laufen lokal. `AGENTS.md` nennt nur die Kurzfassung; die Testlinie steht in [`TESTING.md`](TESTING.md).

## Required Gates

Der Required-Plan besteht aus achtzehn Gates:

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
| 11 | `output-budget` | `scripts/verify-output-budget.mjs --probe` | `ERR-4019` |
| 12 | `contracts` | `scripts/verify-contracts.mjs` | `ERR-4019` |
| 13 | `assets` | `pnpm run verify:assets` | `ERR-4016` |
| 14 | `capabilities` | `scripts/verify-capabilities.mjs` | `ERR-4025` |
| 15 | `narrative` | `scripts/verify-narrative-blocks.mjs` | `ERR-4022` |
| 16 | `generated` | `node scripts/sync-generated.mjs --all --check` | `ERR-4028` |
| 17 | `tests` | `pnpm run test:ci` | `ERR-4026` |
| 18 | `build` | `pnpm run build` | `ERR-1005` |

**Audit ist kein Required-Gate.** Er läuft zusätzlich bei einer echten Dependency-Änderung, mit `RBD_VERIFY_AUDIT=1` oder im Profil `full`/`release`: dann achtzehn Required plus Audit (neunzehn Läufe).

**Doku-Gate.** `verify:docs` prüft die fünf Pflichtdokus (`AGENTS.md`, `docs/WORKFLOW.md`, `docs/INDEX.md`, `docs/ROADMAP.md`, `docs/LAST-CHANGES.md`): Marker, Pflichtabschnitte, Kern-Budget (≤500 Token je Dokument, ≤10.000 gesamt), erreichbare Referenzen, Ordner-Owner und die Last-Changes-Kopplung an das Changelog. Der Kern ist merge-stabil: keine Version, kein HEAD-SHA, kein generierter Block.

**Eigentümer der generierten Artefakte** (`content/narrative/registry/fragments.json`, `content/narrative/turns/manifest.json`, `src/core/sim/narrative/composer/registry.generated.ts`, `docs/INVENTORY.md`, `docs/ROADMAP.md`, `docs/DEPENDENCY-MATRIX.md`) ist ausschließlich `scripts/sync-generated.mjs` mit seinen Generatoren. Keine Lane schreibt sie von Hand: Konflikte werden regeneriert, nie aufgelöst. Das Gate `generated` prüft den Stand rein lesend (`--check`) und blockiert damit den lokalen Vor-PR-Nachweis, bevor ein Merge überhaupt ansteht.

**Serialisierter Integrationslauf.** Zwei parallele Lanes mit getrennten Narrative-Beiträgen konkurrieren nie um die generierten Dateien: `scripts/lib/claim-collisions.mjs` nimmt die geteilten Pfade bewusst aus der Schreibsperre, und `scripts/integrate.mjs --apply` rebased, nimmt bei generierten Konflikten die Basis-Seite und lässt ausschließlich `sync-generated.mjs --all` neu schreiben. Der Nachweis, dass beide Beiträge danach erhalten bleiben, Manifest und Inbox paritätisch bleiben und eine nicht regenerierte Registry als veraltet erkannt wird, liegt reproduzierbar in `src/core/governance/__tests__/narrative-lane-integration.test.ts`.

Lokal gilt:

- `verify:light` = dreizehn Gates: `lint`, `check:loc`, `typecheck`, `headless-core`, `docs`, `catalog`, `generated`, `test-placement`, `tree`, `impact-graph`, `redundancy`, `output-budget`, `contracts`.
- `verify:fast` = Light plus `dead-code`, `test-quality`, `affected` und `build`; der Standard vor dem Push.
- `verify:dev` = Light plus `affected`; gezieltes Entwicklungsfeedback.
- `verify:quick` = siebzehn Gates: Required ohne `build`.
- `verify:integration` = siebzehn lokale Gates: Light plus `dead-code`, `test-quality`, `affected` und `build`.
- `verify:all` = achtzehn Required plus Audit (neunzehn Läufe).
- `verify:release` = der Integrationsnachweis mit erzwungenem Audit und Production-Build.
- `test:mechanics` = ausschließlich Statistik, Soak, Langlauf und Benchmarks; nie Teil eines Regelprofils.

Die Profile sind rein lesend. Reparaturen laufen nur über `pnpm run fix`; ein Gate schreibt nie vorher die Akte um.

`headless-core` ist ein Light-Gate: `pnpm run verify:headless` prüft, dass `src/core/` weder `pixi.js`, `react`, `react-dom`, DOM-/Testbibliotheken noch relative Pfade in Renderer, UI oder Store importiert. Der Lauf ist rein lesend und fail-closed; das Gate läuft damit in `verify:light`, `verify:fast`, `verify:dev` und im lokalen Vor-PR-Nachweis `verify:integration`.

## Zustände

| Zustand | Auslöser | Plan |
| --- | --- | --- |
| `READY` | lokaler Start | `verify:light` oder `verify:dev` |
| `FULL` | lokaler Vor-PR-Nachweis | `verify:all` plus vollständige Suite |
| `NOOP` | Kopf ist die Basis | keine Prüfung; der lokale Claim-/Scope-Pfad bleibt zuständig |
| `UNKNOWN` | Diff nicht bestimmbar | `verify:all` plus Audit, nie ein stiller Light-Erfolg |

`main` hat keinen Cloud-Vollauf. Der Merge ist ein manueller Schritt nach dem lokalen Vor-PR-Nachweis `verify:integration` und, bei Release-Bedarf, `verify:release`.

## Workflows

Es gibt keine Workflows mehr (FREEZE-0, Abschnitt 7.2). PR-Eröffnung, Branch-Cleanup, Issue-Closeout, Board-Übersicht und Merge sind Aufgaben des Maintainer-Laufs und der Worker-Prozesse; die Übersicht erzeugt `node scripts/board-overview.mjs --markdown` bei Bedarf aus Live-Daten. Kein Cloud-Pfad führt Tests, Gates, Builds oder APKs aus.

## Branch-Schutz

`main` ist über einen klassischen Branch-Schutz gesichert:

- Required Status Checks: **keine**; es gibt keinen Cloud-Check mehr
- `strict: false`
- keine Pflicht-Reviews
- `enforce_admins: true`
- Force-Push und Löschen verboten
- keine Rulesets

Der Schutz ist live nachpruefbar: `node scripts/verify-merge-gate.mjs`
(`pnpm rbd verify merge-gate`) liest Branch-Protection und Rulesets ueber REST
und ist gruen, wenn Pull-Request-Zwang, `enforce_admins` und blockierte
Force-Pushes/Loeschungen belegt sind; fehlende Status-Checks nennt es als
Befund (FREEZE-0), nicht als Verstoss. Beleg der Messung:
`docs/evidence/github-branch-protection-main-2026-11-16.json`.

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

- [`TESTING.md`](TESTING.md) — die eine Testlinie und die Zusatzregressionen.
- [`WORKFLOW.md`](WORKFLOW.md) — Pretask, Abschluss und manueller Merge.
- [`GOVERNANCE.md`](GOVERNANCE.md) — Claims, Register und Eskalation.
- [`TESTING.md`](TESTING.md) — Testlinie und Testmatrix.
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — Pipeline, Kontrollebene und Zustandsbesitz.

## Audit und lokale Board-Aufloesung

- `audit:gate` prueft `pnpm audit --prod`: der einzige High-Hinweis (`picomatch` via vite/typescript-eslint, dev-only, keine Patch-Version) betrifft kein ausgeliefertes Paket.
- Sind `gh` und REST nicht erreichbar, nutzt `verify:board-usage` einen hoechstens 24 Stunden alten, aus GitHub gelesenen Schnappschuss unter `.verify-cache/board-cache/<issue>.json`. Antwortet das Remote (Issue fehlt, geschlossen, fremder Claim), entscheidet nie der Cache.

## Hooks im frischen Klon

- `pnpm install` ruft `prepare` auf; `node scripts/install-hooks.mjs` setzt `core.hooksPath=.githooks`, macht alle vier Hooks auf 100755 und registriert den Merge-Driver. Ohne diesen Schritt ruft git keinen Hook auf.
- `pnpm hooks:check` prueft denselben Zustand (Pfad, Index-Modus, Ausfuehrbarkeit) und faellt sonst mit `ERR-4018`. Das Gate `verify:contracts` ruft genau diesen Modus auf: ein Klon ohne scharfe Hooks ist im ersten regulaeren Verify sichtbar rot, statt still ohne Gate zu committen.
- `--no-verify` ueberspringt einen Hook einmalig, aendert aber nichts am Hook-Zustand; der naechste Verify-Lauf prueft ihn erneut.

### Nachhol-Erkennung nach `--no-verify`

Ein uebersprungener Hook bleibt lokal sichtbar: der Push prueft unabhaengig vom Commit-Pfad. Belegt im frischen Klon (`d086e152`, Hooks armiert):

| Verstoss (Commit mit `--no-verify`) | blockiert in | Exit |
| --- | --- | --- |
| Datei ohne Lane-Claim | `claim-preflight` (ERR-4019) | 1 |
| Aenderung ohne Doku-Nachtrag | `verify-docs --drift` (ERR-4023) | 1 |
| Doku ueber Token-Budget | `verify-docs` (ERR-4017) | 1 |
| Konflikt in Handdateien | `integrate --check` (ERR-4019) | 1 |

Die Commit-Nachricht prueft kein Push-Hook; Nachzug ist `pnpm verify:commit-msg` (ERR-4006, Exit 1) bzw. `local-ci.mjs`, das dieselbe Zeile fuehrt.
