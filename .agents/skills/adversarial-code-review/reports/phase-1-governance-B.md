# Zwischenbericht Phase 1 (Governance) — Adversarial Code Review

**Repo:** D:\Projekte\rigged-by-design
**Branch:** lane/governance/audit-fixes-2026-11-18
**Sub-Agent:** B (Fokus: Hooks, Preflight, Regeln, Allowlist, P0-Prioritäten, Verify-Pipeline-Governance)
**Datum:** 2026-11-18

---

## Methodik

Jede geprüfte Designentscheidung erhält eine Note **A–F** (A = sicher/by design, F = kritisch gebrochen). Zu jeder Note gibt es eine Befunde-Erklärung und eine zurückverfolgbare Quelle (Datei:Zeile, Commit-SHA, Issue/PR). Der Fokus liegt auf den fünf genannten Bereichen. Kritische Befunde (D/F) werden gesondert hervorgehoben.

---

## Geprüfte Designentscheidungen

### D1. commit-msg Hook: Sanitize-Schritt nie blockierend (`|| true`)

**Note: C**

**Befunde:** `.githooks/commit-msg:6` ruft `node scripts/sanitize-commit.mjs "$1" >/dev/null 2>&1 || true` auf. Wegen `|| true` kann der Sanitize-Schritt den Hook niemals fall lassen. Das eigentliche Blockier-Verdikt kommt erst von `verify-commit-msg.mjs` (Zeile 11), das bei fehlenden Pflichtsektionen mit `exit 1` blockiert. Es existiert kein `if [ ! -d node_modules ]`-Guard mehr im aktuellen Stand (der als Hook-Bypass-Beispiel im Fokus genannt wurde). Der Hook ist deshalb nicht vollständig bypassed, aber der Sanitize-Schritt ist ornamental.

**Quelle:** `.githooks/commit-msg:6,11` (Working Tree)

---

### D2. claim-preflight: main-Branch-Frühausstieg (kein Lane-Claim auf main)

**Note: A (by design), mit dokumentiertem Restrisiko**

**Befunde:** `scripts/lib/claim-preflight.mjs:55` setzt `current = null` sobald `branch === 'main'`. Zeile 93–110 melden `skipped: true` / "main: Branch-Schutz, kein Lane-Claim nötig". Ein Push auf main umgeht die Claim-Governance (kein Claim, kein Issue, kein Task-Vertrag). Das ist beabsichtigt: main ist server-seitig durch Branch-Schutz gedeckt (CLAUDE.md: kein direkter main-Push). Das Restrisiko: bei falsch konfiguriertem/fehlendem Branch-Schutz auf main würde ein Push die gesamte Claim-Governance ungehindert passieren. Der Pre-Push-Hook (`.githooks/pre-push`) fängt das teilweise über `verify-lane-claims` und `verify-board-usage` ab, ersetzt aber keinen Claim auf main.

**Quelle:** `scripts/lib/claim-preflight.mjs:55, 93-110`; `scripts/claim-preflight.mjs:21-28`; CLAUDE.md:64-67

---

### D3. install-hooks: doppelte `isFileModeIrrelevant` — statSync-Ausführbarkeitsprüfung nie wirksam

**Note: D — KRITISCH**

**Befunde:** `scripts/install-hooks.mjs` definiert `isFileModeIrrelevant` zweimal: einmal mit echter Logik (Zeile 37–42: prüft `core.fileMode === 'false'` und `win32`) und einmal als Überschreibung, die immer `true` zurückgibt (Zeile 55–57). Die zweite Definition gewinnt, sodass die statSync-Ausführbarkeitsprüfung in Zeile 76 (`statSync(...).mode & 0o111`) auf **keiner** Plattform mehr ausgeführt wird — weder auf NTFS/WSL2 noch auf Linux mit echtem exec-Bit. Der Index-Modus-Check (Zeile 73) bleibt, aber die Platten-Exekutierbarkeit wird nie verifiziert. Commit c18c4735 (#1156) führte die NTFS/WSL2-Entfallnahme ein; die Duplizierung ist ein Logikfehler.

**Quelle:** `scripts/install-hooks.mjs:37-42, 55-57, 76`; Commit `c18c4735` (#1156)

---

### D4. merge-gate: Required-Status-Checks / Ruleset-Findungen

**Note: B**

**Befunde:** `scripts/lib/merge-gate.mjs:51` flaggt fehlende Required-Status-Checks und Zeile 54 fehlende serverseitige Ruleset-Erzwingung jeweils als Blocker (state `BLOCKED`). Die Logik ist korrekt. Das Modul ist jedoch rein passiv/rechnend: Der Aufrufer liefert die GitHub-Daten (Branch-Protection- und Ruleset-Antwort); es erfolgt kein Live-Fetch gegen GitHub. `parseRulesets` (Zeile 31-33) zählt nur Regeln, wertet deren Inhalt (z. B. ob sie Merges tatsächlich blockieren) nicht aus. Ein vorhandenes, aber wirkungsloses Ruleset würde als "gruen" durchgehen.

**Quelle:** `scripts/lib/merge-gate.mjs:31-75`

---

### D5. doc-drift: `docContentOk` prüft nur Pfad-Mitgliedschaft, nicht Inhalt

**Note: C**

**Befunde:** `scripts/lib/doc-drift.mjs:37-45` liefert `docContentOk(path) = changed.includes(path)`. Es wird nur geprüft, ob der Doku-Pfad (LAST-CHANGES.md / ROADMAP.md) im Commit enthalten ist — nicht, ob der Inhalt aktualisiert, korrekt oder sinnvoll ist. Eine triviale oder inkorrekte Zeile in LAST-CHANGES.md würde die Prüfung bestehen. Die Memoisierung (Zeile 38–45) ist technisch sauber, aber die Prüfung selbst ist oberflächlich. Commit cdcd60d6 (#1155) führte Memoization + `checkDocFile` ein.

**Quelle:** `scripts/lib/doc-drift.mjs:37-45`; Commit `cdcd60d6` (#1155)

---

### D6. loc-budgets: `LEGACY_LOC` leer und nie konsultiert

**Note: B (by design), keine Durchsetzung der "Keine neuen Einträge"-Regel**

**Befunde:** `scripts/loc-budgets.mjs:33` definiert `LEGACY_LOC = new Map([])` (leer). `budgetFor` (Zeile 35–37) konsultiert nur `LOC_BUDGETS`, niemals `LEGACY_LOC`. Alle vier Legacy-Dateien haben laut Kommentar (Zeile 28–33) bereits normale Rollen-Einträge. Die Regel "neue Einträge sind verboten" existiert nur als Kommentar, nicht als Code (kein `Object.freeze`, kein Fehler bei neuem Eintrag).

**Quelle:** `scripts/loc-budgets.mjs:24-37`

---

### D7. run-pipeline: Default-Profil `quick`, Audit opt-in

**Note: A**

**Befunde:** `scripts/run-pipeline.mjs:31–33` setzt das Default-Profil auf `quick` (17 Gates, konsistent mit CLAUDE.md:29 und :69). Audit läuft nur bei `PROFILE === 'release'`, `--gate=audit` oder `RBD_VERIFY_AUDIT=1` (Zeile 108); andernfalls wird der Audit-Schritt ausgespleißt (Zeile 115–122) mit einem Skip-Hinweis ("kein Erfolg"). Das ist konsistent mit der Dokumentation (`verify` = quick, `verify:all` = full inkl. Audit).

**Quelle:** `scripts/run-pipeline.mjs:31-33, 108, 115-122`; CLAUDE.md:29-31, 69

---

### D8. sanitize-commit entfernt erforderliche Commit-Attribution

**Note: D — KRITISCH**

**Befunde:** `scripts/sanitize-commit.mjs:8` definiert `FORBIDDEN`, das `Co-authored-by:`, `Generated with`, `Claude`, `Anthropic`, `OpenAI`, `Cursor` u. a. matcht. Zeile 15–17 entfernt diese Zeilen aus der Commit-Nachricht und schreibt die Datei um. Das kollidiert direkt mit der geforderten Commit-Attribution `Co-Authored-By: Claude Code <noreply@anthropic.com>` (System-Attribution). Der Hook läuft bei jedem `commit-msg` (nicht-blockierend wegen `|| true` in `.githooks/commit-msg:6`, schreibt die Nachricht aber um). Jeder von Claude Code erstellte Commit verliert damit die geforderte Attribution-Zeile.

**Quelle:** `scripts/sanitize-commit.mjs:8, 15-17`; `.githooks/commit-msg:6`; System-Attribution-Reminder

---

### D9. pre-push Hook: Defense-in-Depth (Claim + Lane-Claims + Doku-Drift + Commit-Msg + Board)

**Note: A**

**Befunde:** `.githooks/pre-push` führt claim-preflight (Zeile 35–40), verify-lane-claims (Zeile 44–49), verify-docs Existenz + Drift (Zeile 53–65), verify-commit-msg über den Range (Zeile 71–101) und verify-board-usage (Zeile 106–111) aus. Das ist mehrschichtige Absicherung, die auch Cloud-Agenten ohne funktionierende Commit-Hooks erfasst. Stärke der Governance-Pipeline. Schwachpunkt bleibt der main-Frühausstieg (D2) und die fehlende Attribution durch sanitize-commit (D8).

**Quelle:** `.githooks/pre-push:35-111`

---

## Kritische Befunde (D/F)

| # | Entscheidung | Note | Kernproblem |
|---|-------------|------|-------------|
| D3 | install-hooks: doppelte `isFileModeIrrelevant` | **D** | statSync-Ausführbarkeitsprüfung nie wirksam (überschattet), Index-Check allein unzureichend. |
| D8 | sanitize-commit entfernt Commit-Attribution | **D** | Entfernt `Co-Authored-By: Claude Code …`, kollidiert mit geforderter Attribution. |

Keine Note F festgestellt.

---

## Abschluss

- **Anzahl geprüfter Entscheidungen:** 9 (D1–D9)
- **Kritischste Note:** D (zwei kritische Befunde: D3, D8)
- **Dateipfad des Berichts:** `D:\Projekte\rigged-by-design\.claude/skills/adversarial-code-review/reports/phase-1-governance-B.md`

Die Governance-Pipeline ist grundsätzlich gut aufgebaut (Defense-in-Depth im pre-push, klare Default-Profile, blockierende merge-gate-Logik), enthält aber zwei kritische Lücken: die statSync-Ausführbarkeitsprüfung ist durch eine duplizierte Funktion totgeschaltet, und der commit-msg-Sanitize-Hook entfernt die geforderte Claude-Attribution. Beide sollten vor dem nächsten Push behoben werden.