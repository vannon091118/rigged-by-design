# Testing: eine Linie und 17 Nachweise

<!-- rbd-doc: managed -->

**Zweck:** Die eine Testlinie und die Matrix, die Governance-Änderungen belegen. `AGENTS.md` verweist hierher; die Gate-Liste bleibt in [`CI.md`](CI.md).

### Die eine Testlinie

Die Testlinie läuft ausschließlich lokal. Während der Arbeit sind gezielte Nachweise erlaubt: einzelne Testdateien, `pnpm run test:affected`, `pnpm run verify:light` und `pnpm run verify:fast`. Der lokale Abschluss ist `pnpm run ci:local`; der vollständige Nachweis ist `pnpm run verify:all`, der Release-Nachweis `pnpm run verify:release`.

**Mechanik ist kein Gate.** Statistik-, RTP-, Verteilungs-, Soak-, Langlauf- und Benchmark-Suiten stehen in `src/Config/test-lanes.json` und laufen ausschließlich über `pnpm run test:mechanics`. Der Regellauf schließt sie aus; kein Regelprofil wartet auf einen Langlauf. Die Liste ist die einzige Wahrheit: der Katalog prüft sie im `--check`-Modus, Vitest liest denselben Eintrag.

**Kein Cloud-Testpfad.** GitHub-Workflows führen keine Tests, Gates, Builds oder APKs mehr aus. Die verbliebenen Workflows sind Repository-Verwaltung; der lokale Runner ist die einzige Testmaschine. `pnpm run ci:local` ersetzt den früheren PR-Job vollständig.

## Testmatrix

Die Fälle 1–17 sind der Governance-Vertrag. Die Spalte „Nachweis“ nennt die vorhandene Testdatei; `*` bedeutet, dass der Fall in einem `describe`-Block derselben Datei liegt.

| # | Test | Ort / Nachweis |
| --- | --- | --- |
| 1 | Neuer Task auf sauberem, isoliertem Worktree | `worktree-isolation.test.ts`; `pretask.test.ts` |
| 2 | Unterbrechung nach mehreren lokalen Änderungen, Resume | `pretask-modes.test.ts` (eigener Claim, verknüpfter Worktree, `--resume`) |
| 3 | Resume ohne Verlust, Stash, Reset oder Clean | `pretask-modes.test.ts` (eigene WIP bleibt); Verhalten: Dateien vor/nach identisch, keine destruktiven Git-Befehle |
| 4 | Frischer Task auf verschmutztem Worktree wird adoptiert; `--require-worktree` weist den geteilten Baum ab | `pretask.test.ts`, `worktree-isolation.test.ts`; fremde Datei bleibt erhalten |
| 5 | Fremde WIP außerhalb des Claims adoptiert, nicht blockiert | `pretask-modes.test.ts` (`takeover.counts.incomplete`, `mode=RESUME`); `wip-takeover.test.ts` |
| 6 | Eigene WIP innerhalb des Claims im Resume akzeptiert | `pretask-modes.test.ts` (`mode=RESUME`, `SCOPE_VALID`, kein Blocker) |
| 7 | Branch-HEAD == `main`: NOOP statt rot | `ci-plan.test.ts`; `ci-gates.test.ts` (kein Control-Plane-Fehler, kein Issue) |
| 8 | Gleicher SHA nicht als unabhängige Kontrollebene und Prüfobjekt | `ci-plan.test.ts` (`state=NOOP`, `independent=false`; Required-Gates nur bei echtem Diff) |
| 9 | Manual Dispatch ohne Dependency-Diff erzeugt keinen widersprüchlichen Audit-Job | `ci-plan.test.ts` (`MANUAL` mit Required-Set); `ci-gates.test.ts` |
| 10 | Erzwungenes Audit läuft tatsächlich | `ci-plan.test.ts` (`RBD_VERIFY_AUDIT=1`); `workflow-hardening.test.ts` |
| 11 | PR-Änderungen durchlaufen lokal die vollständige Regression | `verify:integration`; `ci-plan.test.ts` (Required-Set und Suiteauswahl) |
| 12 | Kein Cloud-Check wiederholt nur Light | `ci-gates.test.ts` (kein Test-/Build-Workflow, lokaler Runner), `pipeline-modes.test.ts` (Light ≠ Integration) |
| 13 | Gemeinsame Claims und Pfade erkennen echte Überschneidungen | `lane-claims.test.ts` (Content-Pfad kollidiert, Meta/Claim nicht) |
| 14 | Unabhängige Lane wird durch fremden Lane-Fehler nicht blockiert | `issue-scope.test.ts`; `pretask-issues.test.ts` (Dependency blockiert nur abhängige Lane) |
| 15 | Autofix nur erlaubte Fälle, danach Gates erneut | `auto-resolve.test.ts` (`repair-plan`-Block: erlaubter Doku-Fix, verbotener Quellcode, max. 1 Versuch) |
| 16 | Nicht behebbarer Fehler erzeugt dedupliziertes, korrekt zugeordnetes Issue | `pr-watcher.test.ts` (Fingerprint, Scope, Reopen, keine Duplikate); `issue-scope.test.ts` |
| 17 | Cancel, Timeout, No-op und echter Gate-Fehler unterscheiden sich | `auto-resolve.test.ts` (`repair-plan`-Block: NOOP/kein Issue, Remote-Retry, echtes Issue) |

`repair-plan` liegt bewusst im `auto-resolve.test.ts`-Block; eine separate Datei würde denselben Zustand ein zweites Mal aufbauen. Die Matrix nennt den Block, nicht einen zweiten Testpfad.

## Zusatzregressionen

| Regression | Nachweis |
| --- | --- |
| Genau ein lokaler Testpfad, kein Cloud-Gate | `ci-gates.test.ts` (drei Repository-Workflows, keine Kommandos), `workflow-hardening.test.ts` |
| Dependabot-PR mit `dependabot/**` besteht Lane Claims über eine eng begrenzte Bot-Allowlist | `lane-claims.test.ts` (Bot-/Claim-Prüfung) |
| Statischer Scan: keine `reset --hard`, `clean -fd`, Stash-Mutation, `push --force`, `branch -D` in Produktionsskripten | `destructive-commands.test.ts` |
| Impact-Pfad ohne TypeScript-Compiler: ein direkter oder transitiver Import macht das Gate rot | `impact-graph.test.ts` |
| `verify:scope` prueft nur den Diff gegen die Claim-Allowlist, ohne Test- oder Build-Gates | `verify-scope.test.ts` |
| Gemergte Lane kann über `selectClaim` weiterarbeiten; `agent-verify` und `pretask` blockieren nicht | `lane-claims.test.ts`, `claim-evidence.test.ts` |
| Register-Audit: Governance darf fremden Claim-Status fortschreiben; Feature-Lane nicht | `lane-claims.test.ts` |
| Ein Doku-/AGENTS-Kurzvertrag verweist auf diese Datei statt den Langtext zu duplizieren | `workflow-hardening.test.ts` |
| Stadt-Ruhetag und verzögerte Folge überstehen Save/Load ohne Tick dazwischen: Tag, Ledger, Beziehung, Chain-Frist und PRNG bleiben identisch, Miete und Echo laufen genau einmal | `city-day-closeout.test.ts`, `city-encounter-loop.test.ts` |
| Merge ist manuell und folgt auf den lokalen Integrationsnachweis | `promote.yml` hat keinen `workflow_run`-Trigger; kein Cloud-Check, keine Merge-Bedingung |
| Mechanik-Liste und Testkatalog sind deckungsgleich; kein Regelprofil enthält Mechanik | `test-catalog.test.ts`, `pipeline-modes.test.ts` |

## Ausführung

```bash
# Regel-Gates lokal
pnpm run verify:light
pnpm run verify:fast
pnpm run ci:local --profile=full

# Mechanik ausschliesslich gezielt
pnpm run test:mechanics
RBD_SOAK_TICKS=100000 pnpm run soak
pnpm run balance

# APK lokal
pnpm run ci:local --profile=apk
```

## Balance-Messlauf (bewusst On-Demand)

`pnpm run balance` bleibt ein **separater, bewusster Messlauf** und ist nicht Teil des Ausführungsmodells der Gates: nicht in `src/Config/test-lanes.json`, nicht in `verify:light`, nicht in `verify:fast`, kein Required-Gate. Ein 40-Tage-Lauf kostet Minuten und würde jede schnelle Iteration blockieren; Mechanik gehört ohnehin ausschließlich nach `test:mechanics`, und der Balance-Lauf ist keine Mechanik-Lane, sondern eine Balance-Messung ([`CI.md`](CI.md), [`AGENTS.md`](../AGENTS.md) Regel 7).

```bash
pnpm run balance                       # 40 Tage, Seed 12345, main-SHA im Bericht
pnpm run balance -- --seed=4711 --days=40
pnpm run balance -- --force            # vorhandenen Bericht bewusst neu messen
```

- Der Bericht liegt unter `artifacts/balance-<seed>-<days>d.md` (nicht versioniert) und trägt Seed, Tageszahl und Main-SHA im Kopf. Ein vorhandener Bericht wird **nie stillschweigend überschrieben**: der Lauf bricht mit `ERR-2001` ab und verweist auf `--force`.
- Vergleichbarkeit: gleicher Seed und gleiche Tageszahl auf demselben Main-SHA ergeben byte-gleiche Berichte; ein anderer SHA ist eine neue Messung, kein Rückschritt. Der Nachweis liegt in `src/core/sim/__tests__/balance-report.test.ts`.
- Der Test selbst ist `skipIf(!RBD_BALANCE)`; normale Testläufe führen ihn nicht aus.

## Referenzen

- [`CI.md`](CI.md) — Required-Gates und Zustände.
- [`GOVERNANCE.md`](GOVERNANCE.md) — Claims und Eskalation.
- [`WORKFLOW.md`](WORKFLOW.md) — Pretask und Abschluss.
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — Testkatalog und Beweisklassen.
