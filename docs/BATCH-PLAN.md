# Batch-Plan: Alle Findings lösen — Skalierbares Spiel + Einheitliche Governance

## Context (Problem und Ziel)

Der max-effort Code-Review hat 10 Findings identifiziert (2 CONFIRMED, 8 PLAUSIBLE). Ziel dieses Batchs: alle Findings so lösen, dass das Spiel skalierbar bleibt und die Governance einheitlich durchgesetzt wird — ohne den FREEZE-0-Kontrakt zu verletzen (P0-Tagesbericht erwartet exit=0 bei fehlenden Required-Status-Checks/Rulesets; merge-gate.test.ts Zeilen 58-63 erwartet `ok: true` bei `rulesets: []`).

**CONFIRMED (echte Bugs, müssen behoben werden):**

| # | Bereich | Note | Problem | Lösung |
|---|---------|------|---------|--------|
| 1 | `.githooks/commit-msg` | F | `node_modules`-Bypass entfernt → Hook ist jetzt fail-closed (blockiert bei fehlendem node_modules) | **Bereits gelöst** — Verifier: REFUTED als Bug (blockiert korrekt mit exit 1) |
| 2 | `scripts/lib/board-usage.mjs:79` | D | Gemergter Claim als `failure` statt `skipped: true` → blockiert Closeout-Push (Regression) | `skipped: true` für `claim.status === 'merged'` wiederherstellen |
| 3 | `scripts/loc-budgets.mjs:33` | D | `LEGACY_LOC` geleert → `ledger.ts` (214 LOC) überschreitet engine-Cap 200 | Entweder `LEGACY_LOC` wiederherstellen ODER `ledger.ts` aufrollen |

**PLAUSIBLE (Design-Entscheidungen, mit Owner abzustimmen):**

| # | Bereich | Note | Problem | Lösung |
|---|---------|------|---------|--------|
| 4 | `scripts/claim-preflight.mjs:27` | D | `main`-Ausnahme entfernt → `main` läuft durch `loadClaimsStrict()` | `main` vor `loadClaimsStrict()` abfangen (Early-Return) |
| 5 | `scripts/lib/merge-gate.mjs:48,51,54` | D | Fehlende Checks/Rulesets als Finding statt harter Block → kollidiert mit FREEZE-0 | Zurück auf "Befund nicht Verstoss" (FREEZE-0-Kontrakt) |
| 6 | `scripts/install-hooks.mjs:71` | D | `statSync`-Platten-Bit auf NTFS/WSL2 irreführend | `isFileModeIrrelevant()` auch für Nicht-Windows ohne `core.fileMode=false` gelten lassen |
| 7 | `scripts/verify-dead-code.mjs:49` | C | Default-Exports nicht mehr übersprungen → False Positives | Default-Exports wieder überspringen |
| 8 | `scripts/lib/doc-drift.mjs:28,51` | C | Duplizierte if-Blöcke, kein Cache, Overkill-Parse | Memoization + dedup + Vereinfachung |

## Work Units (7 Stück, unabhängig voneinander)

### Unit 1: board-usage.mjs — Gemergte Claims nicht blockieren
**Dateien:** `scripts/lib/board-usage.mjs` (Zeilen 79–87)
**Change:** Für `claim.status === 'merged'` wieder `{ ok: true, skipped: true, failures, facts: [...] }` zurückgeben statt `failures.push(...)` + `result()`.
**Begründung:** Gemergte Claims sind abgeschlossene Lanes; Closeout-Pushes dürfen nicht blockiert werden (Commit 06c175ed, P0-Tagesbericht).
**Test:** `pnpm test` (vitest), speziell `src/core/governance/__tests__/board-usage.test.ts`.

### Unit 2: loc-budgets.mjs — LEGACY_LOC wiederherstellen
**Dateien:** `scripts/loc-budgets.mjs` (Zeilen 25–34)
**Change:** Die 4 LEGACY_LOC-Einträge (App.tsx cap 350, ledger.ts cap 350, staff.ts cap 350, world-store.ts cap 350) wiederherstellen. Alternativ: ledger.ts aufrollen (nur wenn Owner zustimmt).
**Begründung:** ledger.ts hat 214 LOC > engine-Cap 200; ohne Ausnahme löst der Guard einen Verstoß aus.
**Test:** `pnpm test`, speziell LOC-bezogene Tests.

### Unit 3: claim-preflight.mjs — main vor loadClaimsStrict() abfangen
**Dateien:** `scripts/claim-preflight.mjs` (Zeilen 27–34)
**Change:** `main`-Branch vor `loadClaimsStrict()` abfangen (Early-Return mit `inspectClaimPreflight({ branch })` + `process.exit(0)`), sodass `main` nie vom Claim-Register abhängt.
**Begründung:** `main` ist durch GitHub-Branch-Schutz gedeckt (Zeile 7 der Datei), sollte nicht vom lokalen Claim-Register abhängen.
**Test:** `pnpm test`, speziell claim-preflight-bezogene Tests.

### Unit 4: merge-gate.mjs — Checks/Rulesets als Befund nicht als Verstoss
**Dateien:** `scripts/lib/merge-gate.mjs` (Zeilen 51, 54 entfernen; Docstring Zeilen 36–41 zurückdrehen)
**Change:** `requiredChecks.length === 0` und `names.length === 0` wieder als dokumentierter Befund (nicht als `findings`-Eintrag) behandeln. Docstring zurück auf "Fehlende Status-Checks sind ein dokumentierter Befund, kein Kipppunkt".
**Begründung:** Kollidiert mit FREEZE-0 (P0-Tagesbericht erwartet exit=0 bei fehlenden Checks/Rulesets; merge-gate.test.ts Zeilen 58-63 erwartet `ok: true` bei `rulesets: []`).
**Test:** `pnpm test`, speziell `src/core/governance/__tests__/merge-gate.test.ts`.

### Unit 5: install-hooks.mjs — statSync nur bei Nicht-Windows
**Dateien:** `scripts/install-hooks.mjs` (Zeilen 37–42, 71)
**Change:** `isFileModeIrrelevant()` so anpassen, dass auch bei Nicht-Windows ohne `core.fileMode=false` die statSync-Prüfung entfällt (Index-Modus 100755 alleinige Massgabe). Oder: `isFileModeIrrelevant()` zurück auf nur `core.fileMode === 'false'` oder `win32`.
**Begründung:** Auf Dateisystemen ohne exec-Bit (NTFS/FAT32 unter Linux) ist statSync irreführend.
**Test:** `pnpm test`, speziell install-hooks-bezogene Tests.

### Unit 6: verify-dead-code.mjs — Default-Exports wieder überspringen
**Dateien:** `scripts/verify-dead-code.mjs` (Zeile 49)
**Change:** `if (modifiers.some((mod) => mod.kind === ts.SyntaxKind.DefaultKeyword)) continue;` wieder einfügen; Kommentar zurück auf "Default-Exports sind kein benanntes Artefakt".
**Begründung:** Module mit nur `export default` (z. B. React-Komponenten) würden als tot gemeldet → False Positives.
**Test:** `pnpm test`, speziell verify-dead-code-bezogene Tests.

### Unit 7: doc-drift.mjs — Memoization + dedup + Vereinfachung
**Dateien:** `scripts/lib/doc-drift.mjs` (Zeilen 28–38, 51–72)
**Change:** (a) `docContentOk()` Ergebnis pro Pfad cachen; (b) die zwei identischen if-Blöcke für LAST_CHANGES und ROADMAP in eine Hilfsfunktion `checkDocFile(path, label)` zusammenfassen; (c) `docContentOk()` vereinfachen (einfacher String-Scan statt split+Regex).
**Begründung:** Wartungslast reduzieren, I/O bei wiederholten Aufrufen vermeiden.
**Test:** `pnpm test`, speziell `src/core/governance/__tests__/doc-drift.test.ts`.

## E2E-Test-Rezept

Es gibt keine Playwright/Jest-E2e-Suite. Die Verifikation erfolgt über:

1. **`pnpm test`** (vitest) — alle Unit-Tests laufen grün
2. **`pnpm verify:quick`** (17 Gates) — alle Verify-Gates laufen grün
3. **Spezifische Test-Dateien** pro Unit (siehe oben)
4. **`node scripts/verify-merge-gate.mjs`** — für Unit 4, exit=0 erwartet (FREEZE-0-Kontrakt)
5. **`node scripts/verify-board-usage.mjs`** — für Unit 1, exit=0 erwartet

Kein GUI-Test nötig, da alle Änderungen rein serverseitige/CLI-Logik betreffen.

## Worker-Anweisungen (Template)

Jeder Worker erhält folgende Anweisungen:

```
Ziel: Behebe einen der Findings aus dem Adversarial Code Review im Repository D:\Projekte\rigged-by-design.

Deine Unit: <TITLE>
Dateien: <FILE-LIST>
Change: <BESCHREIBUNG>

Schritte:
1. Lies die Dateien und den aktuellen Stand
2. Setze die Change um (nur die beschriebenen Änderungen, nichts anderes)
3. Führe `pnpm test` aus (vitest) — alle Tests müssen grün sein
4. Führe die spezifischen Tests für deine Unit aus (siehe Plan)
5. Führe `pnpm verify:quick` aus — alle Gates müssen grün sein
6. Commit alle Änderungen mit klarer Message, pushe den Branch, erstelle PR mit `gh pr create`
7. Beende mit einer Zeile: `PR: <url>` oder `PR: none — <grund>`
```

Alle Workers arbeiten in isolierten git-Worktrees (`isolation: "worktree"`) und können parallel laufen.