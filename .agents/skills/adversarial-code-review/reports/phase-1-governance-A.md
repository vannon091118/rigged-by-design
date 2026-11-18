# Phase 1 Governance — Zwischenbericht A (Adversarial Code Review)

**Sub-Agent:** A (Fokus: Claims, FREEZE-0 (#684), Actors, Maintainer-Capability-Trennung)  
**Repo:** `D:\Projekte\rigged-by-design`  
**Branch:** `lane/governance/audit-fixes-2026-11-18`  
**Datum:** 2026-11-18

---

## Bewertungsmaßstab

Jede geprüfte Designentscheidung erhält eine Note **A–F**.  
A = vorbildlich, konsistent, durchgesetzt · B = solide, kleine Lücken · C = akzeptabel, dokumentiert, aber schwache Durchsetzung · D = kritisch, Inkonsistenz/Doppelung, driftgefährdet · F = versagt, offen bypassbar.

---

## Geprüfte Designentscheidungen

### D1 — actors.json Rollentrennung (#694): Maintainer vs. Worker

**Note: A**

**Befunde:**  
`actors.json` weist `vannon091118-maintainer` exklusiv als Maintainer zu (nur in `maintainers`/`users`), während `vannon091118` allein Worker ist. Damit ist die technische Rollentrennung (#694) umgesetzt: der Maintainer-Login steht nicht in `workers`, sodass ein `shared-principal-not-authorized`-Verdikt nicht ausgelöst wird. Worker-Ereignisse bleiben am gemeinsamen Login funktionsfähig. Die Anmerkung in `actors.json:6` dokumentiert dies explizit.

**Quelle:** `.lane-claims/actors.json:1-7`; `docs/GOVERNANCE.md:190-191` (shared-principal-not-authorized, eigener Maintainer-Login); Commit `e8b26ff8` (audit-fixes).

**Bewertung:** Saubere Trennung zweier Logins; kein gemeinsamer Principal zwischen Maintainer- und Worker-Rolle.

---

### D2 — FREEZE-0 (#684): Worker-Fork-Modell / kein toter Freeze-Aufruf

**Note: A**

**Befunde:**  
Der FREEZE-0-Claim (`lane/governance/freeze-0-code`, Issue #684) ist `merged` (`mergedSha: d97e8a0e970592a624723512c26d55325c85f615`, `mergedEvidence: merged-pr`). Ziel war: kein toter Freeze-Aufruf, kein ungeprüfter gh-Download, CODEOWNERS nur Kontrollpfade plus `.cron/`, vier Workflows entfernt, REST-Leser mit UNKNOWN-Zuständen. `docs/GOVERNANCE.md:288-290` ("Cron-Lock — entfernt (FREEZE-0)") und `docs/CI.md:68` ("Es gibt keine Workflows mehr (FREEZE-0, Abschnitt 7.2)") bestätigen den Rückbau. Es gibt keinen Git-Ref-Lock und keine Rollenwechsel-Maschinerie mehr; der Scheduler startet den Maintainer-Lauf als Einzelinstanz.

**Quelle:** `.lane-claims/claims/lane-governance-freeze-0-code.json:1-58`; `.lane-claims/tasks/governance-freeze-0-code.json`; `docs/GOVERNANCE.md:288-290`; `docs/CI.md:68-86`; Commit `d97e8a0e` (Merge-Beleg).

**Bewertung:** FREEZE-0 ist abgeschlossen und belegt; keine Scheinmechanik mehr im Code-Baum.

---

### D3 — FREEZE-0: "kein Bypass" / Branch-Schutz auf `main`

**Note: C**

**Befunde:**  
`main` nutzt "klassischen Branch-Schutz, kein Ruleset": Required Status Checks = **keine**, keine Pflicht-Reviews (0), `enforce_admins: true`, Force-Push/Löschen verboten, keine Rulesets. Es gibt keinen Cloud-Testlauf; "der lokale Vor-PR-Nachweis ist die Autorität" (`docs/GOVERNANCE.md:229`). Das bedeutet: es gibt **keine technische Gate-Erzwingung beim Merge** — ein Maintainer kann theoretisch ohne Gate-Nachweis mergen. Die Absicherung liegt allein im menschlichen Maintainer-Protokoll (`docs/GOVERNANCE.md:239-245`) und in `turn-push.mjs` (pusht nie direkt auf `main`).

**Quelle:** `docs/GOVERNANCE.md:220-229`; `docs/CI.md:70-86`; `docs/evidence/github-branch-protection-main-2026-11-16.json`; `scripts/turn-push.mjs`.

**Bewertung:** Dokumentierte, bewusste Entscheidung ("lokaler Nachweis ist Autorität"), aber schwache technische Durchsetzung von "kein Bypass": keine Required Status Checks, keine Required Reviews → ein Maintainer könnte die Governance-Gates umgehen. Note C statt D, weil es explizit gewollt und dokumentiert ist.

---

### D4 — claims/ vs. claims.json: Legacy-Register neben Einzel-Claims

**Note: D**

**Befunde:**  
Es existieren zwei Register nebeneinander:  
1. `.lane-claims/claims/` mit einzelnen Claim-Dateien (z. B. `lane-governance-freeze-0-code.json`, `lane-governance-issue-574-entrance-convention.json`), die als "lokale Kollisionssperre" mit `pathAllowlist` fungieren.  
2. `.lane-claims/claims.json` als **Legacy-Register** (Array mit Einträgen wie `lane/governance/08-agent-behavior`, `02-governance`, …).

`docs/GOVERNANCE.md:134` erklärt die Sperre und den Task-Vertrag explizit zu **"keiner zweiten Wahrheit"**, doch `claims.json` bleibt als `version: 1` Array bestehen. `docs/GOVERNANCE.md:168` (Retention-Regel 7) beschnet Lane-Claims/Task-Verträge auf die letzten zehn Tasks, **schließt aber das Legacy-Register `.lane-claims/claims.json` ausdrücklich aus** ("wird nicht beschnitten"). Das erlaubt Drift zwischen den beiden Registern.

**Quelle:** `.lane-claims/claims.json` (Array); `.lane-claims/claims/*` (Einzeldateien); `docs/GOVERNANCE.md:134,168`.

**Bewertung (kritisch):** Zwei Register für denselben Zweck, von denen nur eins gebremst wird → Inkonsistenz- und Drift-Risiko. `claims.json` ist nicht Teil der Retention und kann veraltete Claims enthalten.

---

### D5 — merged-index.json vs. board-state.json: Doppelung des Merge-/Board-Zustands

**Note: D**

**Befunde:**  
`merged-index.json` (`version: 1`, `source: git-merge-commits`, 31 Einträge mit `branch`, `number`, `headSha`, `mergeSha`) dokumentiert gemergte Branches als git-Merge-Commits. `board-state.json` (`version: 2`, `generatedBy: maintainer`, `generatedAt: 2026-11-17T10:18:00Z`) dokumentiert den Live-Board-Zustand (13 offene Issues, 0 offene PRs, `activeClaims`, `mergedClaimsThisRun`, `openPullRequests`). Beide erfassen überlappend den Merge-Zustand von Lanes: z. B. erscheint Issue #574 mit `mergedSha: 6b3b7365` sowohl im Claim `lane-governance-issue-574-entrance-convention.json:21` als auch in `merged-index.json` (Eintrag #683, `mergeSha: 6b3b7365dbda557f71ec55abf87616f0e753f6e9`).

Der Claim `lane-governance-issue-1045-claim-reconcile` (Issue #1045) versucht, dies aufzulösen: Ziel "Gemergte Lanes stehen nicht mehr als offene Claims und blockieren keine Allowlist mehr", mit `merged-index.json` in der `pathAllowlist` (`.lane-claims/claims/lane-governance-issue-1045-claim-reconcile.json:12`).

**Quelle:** `.lane-claims/merged-index.json` (31 Einträge); `.lane-claims/board-state.json`; `.lane-claims/claims/lane-governance-issue-1045-claim-reconcile.json`; `.lane-claims/claims/lane-governance-issue-574-entrance-convention.json:21`.

**Bewertung (kritisch):** Zwei abgeleitete Quellen für denselben Merge-/Board-Zustand (`merged-index.json` aus git-merge-commits vs. `board-state.json` aus `board:sync`). Bei Abweichung ist unklar, welche Quelle gewinnt — Drift-Risiko für Allowlist und Claim-Status.

---

### D6 — Task-Vertrag vs. Claim-Status bei FREEZE-0 (Claim/Task-Parität)

**Note: D**

**Befunde:**  
Der Task-Vertrag `.lane-claims/tasks/governance-freeze-0-code.json` führt `status: "READY_FOR_MERGE"`, `pr: null`, `holdMerge: false` und `nextAction: "Merge gegen das Gate versuchen"`. Der zugehörige Claim `.lane-claims/claims/lane-governance-freeze-0-code.json` führt dagegen `status: "merged"`, `mergedEvidence: "merged-pr"`, `mergedSha: d97e8a0e...`. Der Task-Vertrag ist also nicht auf den merged Claim nachgezogen — Paritätsbruch zwischen Task und Claim.

`docs/GOVERNANCE.md:169` schreibt vor: "Ein belegter Merge zieht den Claim auf `merged` und den Task … auf `DONE`". Das ist hier nicht geschehen (Task noch `READY_FOR_MERGE`).

**Quelle:** `.lane-claims/tasks/governance-freeze-0-code.json`; `.lane-claims/claims/lane-governance-freeze-0-code.json:53-57`; `docs/GOVERNANCE.md:169`.

**Bewertung (kritisch):** Claim/Task-Parität verletzt; `pretask`/`reconcile-claims --apply` würde hier vermutlich nicht sauber durchlaufen, da Task und Claim widersprüchliche Status führen.

---

### D7 — claim-preflight: fail-closed bei nicht lesbarem Register / fehlendem Claim

**Note: A**

**Befunde:**  
`scripts/claim-preflight.mjs:30-38`: Wenn `loadClaimsStrict()` wirft, bricht das Skript mit `process.exit(1)` ab ("Claim-Register nicht lesbar … Push blockiert") — fail-closed. Ein Branch ohne Claim wird vom Preflight blockiert (außer `main`, das durch Branch-Schutz gedeckt ist, Zeile 7). Der Hook läuft pre-push und vor `turn:finish` (`docs/GOVERNANCE.md:101`).

**Quelle:** `scripts/claim-preflight.mjs:30-38,59-66`; `docs/GOVERNANCE.md:101`.

**Bewertung:** Konsequent fail-closed; keine stillschweigende Durchführung ohne Register.

---

### D8 — Kommentar-Autorisierung (#693): actors.json als einzige Rollenquelle

**Note: A**

**Befunde:**  
`docs/GOVERNANCE.md:179`: "Text im Body … ist kein Nachweis und autorisiert nichts." Nur der verifizierte GitHub-Autor in `actors.json` der passenden Rolle darf Board-Zustände ändern (Tabelle Zeile 181-186). Fehlt die Datei oder ist unlesbar: fail-closed, kein Steuerbefehl wirkt (`docs/GOVERNANCE.md:189`). `IDENTITY_CLAIM`/`IDENTITY_RELEASE` wirken nur von `workers`/`maintainers` (Zeile 192).

**Quelle:** `docs/GOVERNANCE.md:177-193`; `.lane-claims/actors.json:1-7`.

**Bewertung:** Robust, fail-closed, keine Body-Text-Autorisierung.

---

## Kritische Befunde (D / F)

| # | Note | Befund | Quelle |
|---|------|--------|--------|
| K1 | **D** | Duales Register: `claims/` (Einzel-Claims mit Allowlist) + `claims.json` (Legacy-Array, nicht retention-gebremst) können driften. | `.lane-claims/claims.json`; `docs/GOVERNANCE.md:134,168` |
| K2 | **D** | Doppelter Merge-/Board-Zustand: `merged-index.json` (git-merge-commits) vs. `board-state.json` (board:sync); unklar bei Abweichung welche Quelle gewinnt. | `.lane-claims/merged-index.json`; `.lane-claims/board-state.json` |
| K3 | **D** | Claim/Task-Paritätsbruch bei FREEZE-0: Claim `merged`, Task noch `READY_FOR_MERGE`, `pr: null`. | `.lane-claims/claims/lane-governance-freeze-0-code.json` vs `.lane-claims/tasks/governance-freeze-0-code.json` |
| K4 | **C** | "Kein Bypass" technisch nicht erzwungen: `main` hat keine Required Status Checks, keine Required Reviews; Absicherung nur über Maintainer-Protokoll. | `docs/GOVERNANCE.md:220-229`; `docs/CI.md:70-86` |

Keine Note F festgestellt.

---

## Zusammenfassung

- **Anzahl geprüfter Entscheidungen:** 8 (D1–D8)
- **Kritischste Note:** D (drei kritische Befunde K1–K3, dazu C für K4)
- **Dateipfad des Berichts:** `.claude/skills/adversarial-code-review/reports/phase-1-governance-A.md`

Die stärksten Stellen sind die Actors-Rollentrennung (#694, Note A), der vollständige FREEZE-0-Rückbau (#684, Note A) sowie die fail-closed-Präflight-/Autorisierungskette (D7, D8, beide A). Die kritischen Befunde konzentrieren sich auf Register- und Status-Doppelungen (D4, D5, D6) sowie die fehlende technische Merge-Gate-Erzwingung (D3).
