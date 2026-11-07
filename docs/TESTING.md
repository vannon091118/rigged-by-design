# Testing: eine Linie und 17 Nachweise

<!-- rbd-doc: v0.3.183 | 2026-11-07 23:14 UTC -->

**Zweck:** Die eine Testlinie und die Matrix, die Governance-Änderungen belegen. `AGENTS.md` verweist hierher; die Gate-Liste bleibt in [`CI.md`](CI.md).

### Die eine Testlinie

Während der Arbeit sind gezielte Nachweise erlaubt: einzelne Testdateien, `pnpm run test:affected` und `pnpm run verify:light`. Der lokale Abschluss `pnpm run turn:finish` ermittelt den Impact vor dem Versions-Bump, führt die betroffenen schnellen Tests aus und nennt die langen Nachweise als offen.

Die schwere Suite (`pnpm run test`, `pnpm run test:ci`, `pnpm run verify:all`, Build und Audit) läuft am Turn-Ende in GitHub Actions. `--no-affected` ist nur für reine Doku- oder Governance-Turns gedacht. `test:affected` bleibt gezieltes Entwicklungsfeedback und kein Vollnachweis.

**Keine lokalen Vollläufe als Ersatz für CI.** Ein grüner Light-Lauf ist kein PR-Nachweis; ein grüner PR-Lauf auf dem exakten Kopf ist der Nachweis.

## Testmatrix

Die Fälle 1–17 sind der Governance-Vertrag. Die Spalte „Nachweis“ nennt die vorhandene Testdatei; `*` bedeutet, dass der Fall in einem `describe`-Block derselben Datei liegt.

| # | Test | Ort / Nachweis |
| --- | --- | --- |
| 1 | Neuer Task auf sauberem, isoliertem Worktree | `worktree-isolation.test.ts`; `pretask.test.ts` |
| 2 | Unterbrechung nach mehreren lokalen Änderungen, Resume | `pretask-modes.test.ts` (eigener Claim, verknüpfter Worktree, `--resume`) |
| 3 | Resume ohne Verlust, Stash, Reset oder Clean | `pretask-modes.test.ts` (eigene WIP bleibt); Verhalten: Dateien vor/nach identisch, keine destruktiven Git-Befehle |
| 4 | Frischer Task auf verschmutztem Worktree wird abgewiesen | `pretask.test.ts`, `worktree-isolation.test.ts`; fremde Datei bleibt erhalten |
| 5 | Fremde WIP außerhalb des Claims erkannt, bleibt erhalten | `pretask-modes.test.ts` (`foreignPaths` im Vertrag) |
| 6 | Eigene WIP innerhalb des Claims im Resume akzeptiert | `pretask-modes.test.ts` (`mode=RESUME`, `SCOPE_VALID`, kein Blocker) |
| 7 | Branch-HEAD == `main`: NOOP statt rot | `ci-plan.test.ts`; `ci-gates.test.ts` (kein Control-Plane-Fehler, kein Issue) |
| 8 | Gleicher SHA nicht als unabhängige Kontrollebene und Prüfobjekt | `ci-plan.test.ts` (`state=NOOP`, `independent=false`; Required-Gates nur bei echtem Diff) |
| 9 | Manual Dispatch ohne Dependency-Diff erzeugt keinen widersprüchlichen Audit-Job | `ci-plan.test.ts` (`MANUAL` mit Required-Set); `ci-gates.test.ts` |
| 10 | Erzwungenes Audit läuft tatsächlich | `ci-plan.test.ts` (`RBD_VERIFY_AUDIT=1`); `workflow-hardening.test.ts` |
| 11 | PR-Änderungen durchlaufen die vollständige Regression | `ci-plan.test.ts` (`buildPlan` für Doku- und Runtime-PR: 12 Required, `runAll=true`) |
| 12 | Light-Ergebnis wird nie PR-Nachweis | `ci-gates.test.ts`, `pipeline-modes.test.ts` (eigener Light-Job, kein `Fail-Closed Gates`) |
| 13 | Gemeinsame Claims und Pfade erkennen echte Überschneidungen | `lane-claims.test.ts` (Content-Pfad kollidiert, Meta/Claim nicht) |
| 14 | Unabhängige Lane wird durch fremden Lane-Fehler nicht blockiert | `issue-scope.test.ts`; `pretask-issues.test.ts` (Dependency blockiert nur abhängige Lane) |
| 15 | Autofix nur erlaubte Fälle, danach Gates erneut | `auto-resolve.test.ts` (`repair-plan`-Block: erlaubter Doku-Fix, verbotener Quellcode, max. 1 Versuch) |
| 16 | Nicht behebbarer Fehler erzeugt dedupliziertes, korrekt zugeordnetes Issue | `pr-watcher.test.ts` (Fingerprint, Scope, Reopen, keine Duplikate); `issue-scope.test.ts` |
| 17 | Cancel, Timeout, No-op und echter Gate-Fehler unterscheiden sich | `auto-resolve.test.ts` (`repair-plan`-Block: NOOP/kein Issue, Remote-Retry, echtes Issue) |

`repair-plan` liegt bewusst im `auto-resolve.test.ts`-Block; eine separate Datei würde denselben Zustand ein zweites Mal aufbauen. Die Matrix nennt den Block, nicht einen zweiten Testpfad.

## Zusatzregressionen

| Regression | Nachweis |
| --- | --- |
| `long-checks` darf nicht `Fail-Closed Gates` heißen; genau ein geschützter Statusname | `workflow-hardening.test.ts` (Pflichtstatus-Owner) |
| Dependabot-PR mit `dependabot/**` besteht Lane Claims über eine eng begrenzte Bot-Allowlist | `lane-claims.test.ts` (Bot-/Claim-Prüfung) |
| Statischer Scan: keine `reset --hard`, `clean -fd`, Stash-Mutation, `push --force`, `branch -D` in Produktionsskripten | `destructive-commands.test.ts` |
| Gemergte Lane kann über `selectClaim` weiterarbeiten; `agent-verify` und `pretask` blockieren nicht | `lane-claims.test.ts`, `claim-evidence.test.ts` |
| Register-Audit: Governance darf fremden Claim-Status fortschreiben; Feature-Lane nicht | `lane-claims.test.ts` |
| Ein Doku-/AGENTS-Kurzvertrag verweist auf diese Datei statt den Langtext zu duplizieren | `workflow-hardening.test.ts` |

## Ausführung

```bash
# fokussierte Governance-Matrix
pnpm exec vitest run \
  src/core/governance/__tests__/pretask.test.ts \
  src/core/governance/__tests__/pretask-modes.test.ts \
  src/core/governance/__tests__/pretask-issues.test.ts \
  src/core/governance/__tests__/worktree-isolation.test.ts \
  src/core/governance/__tests__/ci-plan.test.ts \
  src/core/governance/__tests__/ci-gates.test.ts \
  src/core/governance/__tests__/pipeline-modes.test.ts \
  src/core/governance/__tests__/lane-claims.test.ts \
  src/core/governance/__tests__/issue-scope.test.ts \
  src/core/governance/__tests__/auto-resolve.test.ts \
  src/core/governance/__tests__/pr-watcher.test.ts \
  src/core/governance/__tests__/claim-evidence.test.ts \
  src/core/governance/__tests__/workflow-hardening.test.ts \
  src/core/governance/__tests__/destructive-commands.test.ts

# Struktur und Doku
pnpm run verify:test-quality
pnpm run verify:docs
pnpm run verify:light
```

## Referenzen

- [`CI.md`](CI.md) — Required-Gates und Zustände.
- [`GOVERNANCE.md`](GOVERNANCE.md) — Claims und Eskalation.
- [`WORKFLOW.md`](WORKFLOW.md) — Pretask und Abschluss.
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — Testkatalog und Beweisklassen.
