# Phase 1 Governance — Konsolidierter Bericht (Adversarial Code Review)

**Repo:** `D:\Projekte\rigged-by-design`
**Branch:** `lane/governance/audit-fixes-2026-11-18`
**Datum:** 2026-11-18
**Quellen:**
- `phase-1-governance-A.md` — Sub-Agent A (Fokus: Claims, FREEZE-0 (#684), Actors, Maintainer-Capability-Trennung), 8 Entscheidungen D1–D8
- `phase-1-governance-B.md` — Sub-Agent B (Fokus: Hooks, Preflight, Regeln, Allowlist, P0-Prioritäten, Verify-Pipeline-Governance), 9 Entscheidungen D1–D9

---

## Bewertungsmaßstab

Jede geprüfte Designentscheidung erhält eine Note **A–F**.
- A = vorbildlich, konsistent, durchgesetzt
- B = solide, kleine Lücken
- C = akzeptabel, dokumentiert, aber schwache Durchsetzung
- D = kritisch, Inkonsistenz/Doppelung, driftgefährdet
- F = versagt, offen bypassbar

---

## 1. Geprüfte Designentscheidungen (17 Stück, dedupliziert)

Es gibt **keine exakten Duplikate** zwischen A und B. Alle 17 Entscheidungen bleiben erhalten. Entscheidungen, die dasselbe Thema aus zwei Blickwinkeln behandeln, sind querreferenziert (siehe Abschnitt 2).

| ID | Note | Titel | Kurz-Befund | Quelle |
|----|------|-------|-------------|--------|
| A-D1 | A | actors.json Rollentrennung (#694): Maintainer vs. Worker | Saubere Trennung zweier Logins; Maintainer exklusiv, Worker allein | `.lane-claims/actors.json:1-7`; `docs/GOVERNANCE.md:190-191`; Commit `e8b26ff8` |
| A-D2 | A | FREEZE-0 (#684): Worker-Fork-Modell / kein toter Freeze-Aufruf | Claim `merged`, belegt; kein Git-Ref-Lock, keine Rollenwechsel-Maschinerie | `.lane-claims/claims/lane-governance-freeze-0-code.json:1-58`; `docs/GOVERNANCE.md:288-290`; `docs/CI.md:68-86`; Commit `d97e8a0e` |
| A-D3 | C | FREEZE-0: "kein Bypass" / Branch-Schutz auf `main` | Keine Required Status Checks, keine Required Reviews auf main; Absicherung nur über Maintainer-Protokoll | `docs/GOVERNANCE.md:220-229`; `docs/CI.md:70-86`; `docs/evidence/github-branch-protection-main-2026-11-16.json`; `scripts/turn-push.mjs` |
| A-D4 | D | claims/ vs. claims.json: Legacy-Register neben Einzel-Claims | Zwei Register für denselben Zweck; nur eins ist retention-gebremst → Drift-Risiko | `.lane-claims/claims.json`; `.lane-claims/claims/*`; `docs/GOVERNANCE.md:134,168` |
| A-D5 | D | merged-index.json vs. board-state.json: Doppelung des Merge-/Board-Zustands | Zwei abgeleitete Quellen für denselben Zustand; unklar welche bei Abweichung gewinnt | `.lane-claims/merged-index.json`; `.lane-claims/board-state.json`; `.lane-claims/claims/lane-governance-issue-1045-claim-reconcile.json` |
| A-D6 | D | Task-Vertrag vs. Claim-Status bei FREEZE-0 (Claim/Task-Parität) | Claim `merged`, Task noch `READY_FOR_MERGE`, `pr: null`; Paritätsbruch | `.lane-claims/tasks/governance-freeze-0-code.json`; `.lane-claims/claims/lane-governance-freeze-0-code.json:53-57`; `docs/GOVERNANCE.md:169` |
| A-D7 | A | claim-preflight: fail-closed bei nicht lesbarem Register / fehlendem Claim | Konsequent fail-closed; keine stillschweigende Durchführung ohne Register | `scripts/claim-preflight.mjs:30-38,59-66`; `docs/GOVERNANCE.md:101` |
| A-D8 | A | Kommentar-Autorisierung (#693): actors.json als einzige Rollenquelle | Robust, fail-closed, keine Body-Text-Autorisierung | `docs/GOVERNANCE.md:177-193`; `.lane-claims/actors.json:1-7` |
| B-D1 | C | commit-msg Hook: Sanitize-Schritt nie blockierend (`|| true`) | Sanitize-Schritt ornamental wegen `|| true`; Blockierung kommt erst von `verify-commit-msg.mjs` | `.githooks/commit-msg:6,11` (Working Tree) |
| B-D2 | A (by design) | claim-preflight: main-Branch-Frühausstieg (kein Lane-Claim auf main) | Beabsichtigt, aber Restrisiko bei falsch konfiguriertem/fehlendem Branch-Schutz auf main | `scripts/lib/claim-preflight.mjs:55, 93-110`; `scripts/claim-preflight.mjs:21-28`; CLAUDE.md:64-67 |
| B-D3 | D | install-hooks: doppelte `isFileModeIrrelevant` — statSync-Ausführbarkeitsprüfung nie wirksam | Zweite Definition überschattet erste; statSync(`...).mode & 0o111` nie ausgeführt | `scripts/install-hooks.mjs:37-42, 55-57, 76`; Commit `c18c4735` (#1156) |
| B-D4 | B | merge-gate: Required-Status-Checks / Ruleset-Findungen | Logik korrekt, aber rein passiv/rechnend; kein Live-Fetch gegen GitHub; Ruleset-Inhalt nicht ausgewertet | `scripts/lib/merge-gate.mjs:31-75` |
| B-D5 | C | doc-drift: `docContentOk` prüft nur Pfad-Mitgliedschaft, nicht Inhalt | Nur geprüft ob Doku-Pfad im Commit, nicht ob Inhalt aktualisiert/korrekt | `scripts/lib/doc-drift.mjs:37-45`; Commit `cdcd60d6` (#1155) |
| B-D6 | B (by design) | loc-budgets: `LEGACY_LOC` leer und nie konsultiert | Regel "neue Einträge verboten" existiert nur als Kommentar, nicht als Code | `scripts/loc-budgets.mjs:24-37` |
| B-D7 | A | run-pipeline: Default-Profil `quick`, Audit opt-in | Konsistent mit Dokumentation (`verify` = quick, `verify:all` = full inkl. Audit) | `scripts/run-pipeline.mjs:31-33, 108, 115-122`; CLAUDE.md:29-31, 69 |
| B-D8 | D | sanitize-commit entfernt erforderliche Commit-Attribution | Entfernt `Co-Authored-By: Claude Code …`; kollidiert mit geforderter System-Attribution | `scripts/sanitize-commit.mjs:8, 15-17`; `.githooks/commit-msg:6`; System-Attribution-Reminder |
| B-D9 | A | pre-push Hook: Defense-in-Depth (Claim + Lane-Claims + Doku-Drift + Commit-Msg + Board) | Mehrschichtige Absicherung; Schwachpunkte: main-Frühausstieg (B-D2), Attribution (B-D8) | `.githooks/pre-push:35-111` |

### Einzelne Entscheidungen im Detail

#### A-D1 — actors.json Rollentrennung (#694): Maintainer vs. Worker — Note A

**Befunde:** `actors.json` weist `vannon091118-maintainer` exklusiv als Maintainer zu (nur in `maintainers`/`users`), während `vannon091118` allein Worker ist. Die technische Rollentrennung (#694) ist umgesetzt: der Maintainer-Login steht nicht in `workers`, sodass ein `shared-principal-not-authorized`-Verdikt nicht ausgelöst wird. Worker-Ereignisse bleiben am gemeinsamen Login funktionsfähig. Die Anmerkung in `actors.json:6` dokumentiert dies explizit.

**Quelle:** `.lane-claims/actors.json:1-7`; `docs/GOVERNANCE.md:190-191`; Commit `e8b26ff8` (audit-fixes).

**Bewertung:** Saubere Trennung zweier Logins; kein gemeinsamer Principal zwischen Maintainer- und Worker-Rolle.

---

#### A-D2 — FREEZE-0 (#684): Worker-Fork-Modell / kein toter Freeze-Aufruf — Note A

**Befunde:** Der FREEZE-0-Claim (`lane/governance/freeze-0-code`, Issue #684) ist `merged` (`mergedSha: d97e8a0e970592a624723512c26d55325c85f615`, `mergedEvidence: merged-pr`). Ziel war: kein toter Freeze-Aufruf, kein ungeprüfter gh-Download, CODEOWNERS nur Kontrollpfade plus `.cron/`, vier Workflows entfernt, REST-Leser mit UNKNOWN-Zuständen. `docs/GOVERNANCE.md:288-290` ("Cron-Lock — entfernt (FREEZE-0)") und `docs/CI.md:68` ("Es gibt keine Workflows mehr (FREEZE-0, Abschnitt 7.2)") bestätigen den Rückbau. Es gibt keinen Git-Ref-Lock und keine Rollenwechsel-Maschinerie mehr; der Scheduler startet den Maintainer-Lauf als Einzelinstanz.

**Quelle:** `.lane-claims/claims/lane-governance-freeze-0-code.json:1-58`; `.lane-claims/tasks/governance-freeze-0-code.json`; `docs/GOVERNANCE.md:288-290`; `docs/CI.md:68-86`; Commit `d97e8a0e` (Merge-Beleg).

**Bewertung:** FREEZE-0 ist abgeschlossen und belegt; keine Scheinmechanik mehr im Code-Baum.

---

#### A-D3 — FREEZE-0: "kein Bypass" / Branch-Schutz auf `main` — Note C — **verwandt mit B-D4**

**Befunde:** `main` nutzt "klassischen Branch-Schutz, kein Ruleset": Required Status Checks = **keine**, keine Pflicht-Reviews (0), `enforce_admins: true`, Force-Push/Löschen verboten, keine Rulesets. Es gibt keinen Cloud-Testlauf; "der lokale Vor-PR-Nachweis ist die Autorität" (`docs/GOVERNANCE.md:229`). Das bedeutet: es gibt **keine technische Gate-Erzwingung beim Merge** — ein Maintainer kann theoretisch ohne Gate-Nachweis mergen. Die Absicherung liegt allein im menschlichen Maintainer-Protokoll (`docs/GOVERNANCE.md:239-245`) und in `turn-push.mjs` (pusht nie direkt auf `main`).

**Quelle:** `docs/GOVERNANCE.md:220-229`; `docs/CI.md:70-86`; `docs/evidence/github-branch-protection-main-2026-11-16.json`; `scripts/turn-push.mjs`.

**Bewertung:** Dokumentierte, bewusste Entscheidung ("lokaler Nachweis ist Autorität"), aber schwache technische Durchsetzung von "kein Bypass": keine Required Status Checks, keine Required Reviews → ein Maintainer könnte die Governance-Gates umgehen. Note C statt D, weil es explizit gewollt und dokumentiert ist.

**Querverweis:** B-D4 untersucht dasselbe Thema von der Skript-Seite (`merge-gate.mjs` flaggt fehlende Required-Status-Checks als BLOCKED, ist aber rein passiv).

---

#### A-D4 — claims/ vs. claims.json: Legacy-Register neben Einzel-Claims — Note D — **K1**

**Befunde:** Es existieren zwei Register nebeneinander:
1. `.lane-claims/claims/` mit einzelnen Claim-Dateien (z. B. `lane-governance-freeze-0-code.json`, `lane-governance-issue-574-entrance-convention.json`), die als "lokale Kollisionssperre" mit `pathAllowlist` fungieren.
2. `.lane-claims/claims.json` als **Legacy-Register** (Array mit Einträgen wie `lane/governance/08-agent-behavior`, `02-governance`, …).

`docs/GOVERNANCE.md:134` erklärt die Sperre und den Task-Vertrag explizit zu **"keiner zweiten Wahrheit"**, doch `claims.json` bleibt als `version: 1` Array bestehen. `docs/GOVERNANCE.md:168` (Retention-Regel 7) beschneidet Lane-Claims/Task-Verträge auf die letzten zehn Tasks, **schließt aber das Legacy-Register `.lane-claims/claims.json` ausdrücklich aus** ("wird nicht beschnitten"). Das erlaubt Drift zwischen den beiden Registern.

**Quelle:** `.lane-claims/claims.json` (Array); `.lane-claims/claims/*` (Einzeldateien); `docs/GOVERNANCE.md:134,168`.

**Bewertung (kritisch):** Zwei Register für denselben Zweck, von denen nur eins gebremst wird → Inkonsistenz- und Drift-Risiko. `claims.json` ist nicht Teil der Retention und kann veraltete Claims enthalten.

---

#### A-D5 — merged-index.json vs. board-state.json: Doppelung des Merge-/Board-Zustands — Note D — **K2**

**Befunde:** `merged-index.json` (`version: 1`, `source: git-merge-commits`, 31 Einträge mit `branch`, `number`, `headSha`, `mergeSha`) dokumentiert gemergte Branches als git-Merge-Commits. `board-state.json` (`version: 2`, `generatedBy: maintainer`, `generatedAt: 2026-11-17T10:18:00Z`) dokumentiert den Live-Board-Zustand (13 offene Issues, 0 offene PRs, `activeClaims`, `mergedClaimsThisRun`, `openPullRequests`). Beide erfassen überlappend den Merge-Zustand von Lanes: z. B. erscheint Issue #574 mit `mergedSha: 6b3b7365` sowohl im Claim `lane-governance-issue-574-entrance-convention.json:21` als auch in `merged-index.json` (Eintrag #683, `mergeSha: 6b3b7365dbda557f71ec55abf87616f0e753f6e9`).

Der Claim `lane-governance-issue-1045-claim-reconcile` (Issue #1045) versucht, dies aufzulösen: Ziel "Gemergte Lanes stehen nicht mehr als offene Claims und blockieren keine Allowlist mehr", mit `merged-index.json` in der `pathAllowlist` (`.lane-claims/claims/lane-governance-issue-1045-claim-reconcile.json:12`).

**Quelle:** `.lane-claims/merged-index.json` (31 Einträge); `.lane-claims/board-state.json`; `.lane-claims/claims/lane-governance-issue-1045-claim-reconcile.json`; `.lane-claims/claims/lane-governance-issue-574-entrance-convention.json:21`.

**Bewertung (kritisch):** Zwei abgeleitete Quellen für denselben Merge-/Board-Zustand (`merged-index.json` aus git-merge-commits vs. `board-state.json` aus `board:sync`). Bei Abweichung ist unklar, welche Quelle gewinnt — Drift-Risiko für Allowlist und Claim-Status.

---

#### A-D6 — Task-Vertrag vs. Claim-Status bei FREEZE-0 (Claim/Task-Parität) — Note D — **K3**

**Befunde:** Der Task-Vertrag `.lane-claims/tasks/governance-freeze-0-code.json` führt `status: "READY_FOR_MERGE"`, `pr: null`, `holdMerge: false` und `nextAction: "Merge gegen das Gate versuchen"`. Der zugehörige Claim `.lane-claims/claims/lane-governance-freeze-0-code.json` führt dagegen `status: "merged"`, `mergedEvidence: "merged-pr"`, `mergedSha: d97e8a0e...`. Der Task-Vertrag ist also nicht auf den merged Claim nachgezogen — Paritätsbruch zwischen Task und Claim.

`docs/GOVERNANCE.md:169` schreibt vor: "Ein belegter Merge zieht den Claim auf `merged` und den Task … auf `DONE`". Das ist hier nicht geschehen (Task noch `READY_FOR_MERGE`).

**Quelle:** `.lane-claims/tasks/governance-freeze-0-code.json`; `.lane-claims/claims/lane-governance-freeze-0-code.json:53-57`; `docs/GOVERNANCE.md:169`.

**Bewertung (kritisch):** Claim/Task-Parität verletzt; `pretask`/`reconcile-claims --apply` würde hier vermutlich nicht sauber durchlaufen, da Task und Claim widersprüchliche Status führen.

---

#### A-D7 — claim-preflight: fail-closed bei nicht lesbarem Register / fehlendem Claim — Note A — **verwandt mit B-D2**

**Befunde:** `scripts/claim-preflight.mjs:30-38`: Wenn `loadClaimsStrict()` wirft, bricht das Skript mit `process.exit(1)` ab ("Claim-Register nicht lesbar … Push blockiert") — fail-closed. Ein Branch ohne Claim wird vom Preflight blockiert (außer `main`, das durch Branch-Schutz gedeckt ist, Zeile 7). Der Hook läuft pre-push und vor `turn:finish` (`docs/GOVERNANCE.md:101`).

**Quelle:** `scripts/claim-preflight.mjs:30-38,59-66`; `docs/GOVERNANCE.md:101`.

**Bewertung:** Konsequent fail-closed; keine stillschweigende Durchführung ohne Register.

**Querverweis:** B-D2 behandelt denselben Preflight aus einem anderen Blickwinkel (main-Frühausstieg ohne Claim).

---

#### A-D8 — Kommentar-Autorisierung (#693): actors.json als einzige Rollenquelle — Note A

**Befunde:** `docs/GOVERNANCE.md:179`: "Text im Body … ist kein Nachweis und autorisiert nichts." Nur der verifizierte GitHub-Autor in `actors.json` der passenden Rolle darf Board-Zustände ändern (Tabelle Zeile 181-186). Fehlt die Datei oder ist unlesbar: fail-closed, kein Steuerbefehl wirkt (`docs/GOVERNANCE.md:189`). `IDENTITY_CLAIM`/`IDENTITY_RELEASE` wirken nur von `workers`/`maintainers` (Zeile 192).

**Quelle:** `docs/GOVERNANCE.md:177-193`; `.lane-claims/actors.json:1-7`.

**Bewertung:** Robust, fail-closed, keine Body-Text-Autorisierung.

---

#### B-D1 — commit-msg Hook: Sanitize-Schritt nie blockierend (`|| true`) — Note C — **verwandt mit B-D8**

**Befunde:** `.githooks/commit-msg:6` ruft `node scripts/sanitize-commit.mjs "$1" >/dev/null 2>&1 || true` auf. Wegen `|| true` kann der Sanitize-Schritt den Hook niemals fall lassen. Das eigentliche Blockier-Verdikt kommt erst von `verify-commit-msg.mjs` (Zeile 11), das bei fehlenden Pflichtsektionen mit `exit 1` blockiert. Es existiert kein `if [ ! -d node_modules ]`-Guard mehr im aktuellen Stand (der als Hook-Bypass-Beispiel im Fokus genannt wurde). Der Hook ist deshalb nicht vollständig bypassed, aber der Sanitize-Schritt ist ornamental.

**Quelle:** `.githooks/commit-msg:6,11` (Working Tree).

**Bewertung:** Nicht vollständig bypassed, aber der Sanitize-Schritt ist ornamental; keine eigenständige Blockierwirkung.

**Querverweis:** B-D8 (sanitize-commit entfernt Attribution) betrifft denselben Hook/Skript-Komplex.

---

#### B-D2 — claim-preflight: main-Branch-Frühausstieg (kein Lane-Claim auf main) — Note A (by design), mit dokumentiertem Restrisiko — **verwandt mit A-D7**

**Befunde:** `scripts/lib/claim-preflight.mjs:55` setzt `current = null` sobald `branch === 'main'`. Zeile 93–110 melden `skipped: true` / "main: Branch-Schutz, kein Lane-Claim nötig". Ein Push auf main umgeht die Claim-Governance (kein Claim, kein Issue, kein Task-Vertrag). Das ist beabsichtigt: main ist server-seitig durch Branch-Schutz gedeckt (CLAUDE.md: kein direkter main-Push). Das Restrisiko: bei falsch konfiguriertem/fehlendem Branch-Schutz auf main würde ein Push die gesamte Claim-Governance ungehindert passieren. Der Pre-Push-Hook (`.githooks/pre-push`) fängt das teilweise über `verify-lane-claims` und `verify-board-usage` ab, ersetzt aber keinen Claim auf main.

**Quelle:** `scripts/lib/claim-preflight.mjs:55, 93-110`; `scripts/claim-preflight.mjs:21-28`; CLAUDE.md:64-67.

**Bewertung:** Beabsichtigt, aber Restrisiko dokumentiert; bei fehlendem/falschem Branch-Schutz auf main ist die gesamte Claim-Governance umgehbar.

**Querverweis:** A-D7 behandelt denselben Preflight aus einem anderen Blickwinkel (fail-closed bei nicht lesbarem Register).

---

#### B-D3 — install-hooks: doppelte `isFileModeIrrelevant` — statSync-Ausführbarkeitsprüfung nie wirksam — Note D — **K5 (KRITISCH)**

**Befunde:** `scripts/install-hooks.mjs` definiert `isFileModeIrrelevant` zweimal: einmal mit echter Logik (Zeile 37–42: prüft `core.fileMode === 'false'` und `win32`) und einmal als Überschreibung, die immer `true` zurückgibt (Zeile 55–57). Die zweite Definition gewinnt, sodass die statSync-Ausführbarkeitsprüfung in Zeile 76 (`statSync(...).mode & 0o111`) auf **keiner** Plattform mehr ausgeführt wird — weder auf NTFS/WSL2 noch auf Linux mit echtem exec-Bit. Der Index-Modus-Check (Zeile 73) bleibt, aber die Platten-Exekutierbarkeit wird nie verifiziert. Commit c18c4735 (#1156) führte die NTFS/WSL2-Entfallnahme ein; die Duplizierung ist ein Logikfehler.

**Quelle:** `scripts/install-hooks.mjs:37-42, 55-57, 76`; Commit `c18c4735` (#1156).

**Bewertung (kritisch):** Die statSync-Ausführbarkeitsprüfung ist durch die duplizierte Funktion totgeschaltet; der Index-Check allein ist unzureichend, um Hook-Dateien als ausführbar zu verifizieren.

---

#### B-D4 — merge-gate: Required-Status-Checks / Ruleset-Findungen — Note B — **verwandt mit A-D3**

**Befunde:** `scripts/lib/merge-gate.mjs:51` flaggt fehlende Required-Status-Checks und Zeile 54 fehlende serverseitige Ruleset-Erzwingung jeweils als Blocker (state `BLOCKED`). Die Logik ist korrekt. Das Modul ist jedoch rein passiv/rechnend: Der Aufrufer liefert die GitHub-Daten (Branch-Protection- und Ruleset-Antwort); es erfolgt kein Live-Fetch gegen GitHub. `parseRulesets` (Zeile 31-33) zählt nur Regeln, wertet deren Inhalt (z. B. ob sie Merges tatsächlich blockieren) nicht aus. Ein vorhandenes, aber wirkungsloses Ruleset würde als "gruen" durchgehen.

**Quelle:** `scripts/lib/merge-gate.mjs:31-75`.

**Bewertung:** Solide Logik, aber passive Auswertung ohne Live-Fetch; ein wirkungsloses Ruleset würde als grün durchgehen. Note B.

**Querverweis:** A-D3 untersucht dasselbe Thema von der GitHub-Konfigurations-Seite (keine Required Status Checks, keine Required Reviews auf main). Zusammen ergeben beide Befunde das Bild einer nicht technisch erzwungenen Merge-Gate.

---

#### B-D5 — doc-drift: `docContentOk` prüft nur Pfad-Mitgliedschaft, nicht Inhalt — Note C

**Befunde:** `scripts/lib/doc-drift.mjs:37-45` liefert `docContentOk(path) = changed.includes(path)`. Es wird nur geprüft, ob der Doku-Pfad (LAST-CHANGES.md / ROADMAP.md) im Commit enthalten ist — nicht, ob der Inhalt aktualisiert, korrekt oder sinnvoll ist. Eine triviale oder inkorrekte Zeile in LAST-CHANGES.md würde die Prüfung bestehen. Die Memoisierung (Zeile 38–45) ist technisch sauber, aber die Prüfung selbst ist oberflächlich. Commit cdcd60d6 (#1155) führte Memoization + `checkDocFile` ein.

**Quelle:** `scripts/lib/doc-drift.mjs:37-45`; Commit `cdcd60d6` (#1155).

**Bewertung:** Dokumenten-Drift wird nur oberflächlich erkannt; Inhaltskorrektheit wird nicht geprüft. Note C.

---

#### B-D6 — loc-budgets: `LEGACY_LOC` leer und nie konsultiert — Note B (by design)

**Befunde:** `scripts/loc-budgets.mjs:33` definiert `LEGACY_LOC = new Map([])` (leer). `budgetFor` (Zeile 35–37) konsultiert nur `LOC_BUDGETS`, niemals `LEGACY_LOC`. Alle vier Legacy-Dateien haben laut Kommentar (Zeile 28–33) bereits normale Rollen-Einträge. Die Regel "neue Einträge sind verboten" existiert nur als Kommentar, nicht als Code (kein `Object.freeze`, kein Fehler bei neuem Eintrag).

**Quelle:** `scripts/loc-budgets.mjs:24-37`.

**Bewertung:** By design akzeptabel, aber die "Keine neuen Einträge"-Regel ist nicht im Code durchgesetzt. Note B.

---

#### B-D7 — run-pipeline: Default-Profil `quick`, Audit opt-in — Note A

**Befunde:** `scripts/run-pipeline.mjs:31–33` setzt das Default-Profil auf `quick` (17 Gates, konsistent mit CLAUDE.md:29 und :69). Audit läuft nur bei `PROFILE === 'release'`, `--gate=audit` oder `RBD_VERIFY_AUDIT=1` (Zeile 108); andernfalls wird der Audit-Schritt ausgespleißt (Zeile 115–122) mit einem Skip-Hinweis ("kein Erfolg"). Das ist konsistent mit der Dokumentation (`verify` = quick, `verify:all` = full inkl. Audit).

**Quelle:** `scripts/run-pipeline.mjs:31-33, 108, 115-122`; CLAUDE.md:29-31, 69.

**Bewertung:** Konsistent mit Dokumentation; Default-Profil sinnvoll gewählt, Audit bewusst opt-in.

---

#### B-D8 — sanitize-commit entfernt erforderliche Commit-Attribution — Note D — **K6 (KRITISCH)**

**Befunde:** `scripts/sanitize-commit.mjs:8` definiert `FORBIDDEN`, das `Co-authored-by:`, `Generated with`, `Claude`, `Anthropic`, `OpenAI`, `Cursor` u. a. matcht. Zeile 15–17 entfernt diese Zeilen aus der Commit-Nachricht und schreibt die Datei um. Das kollidiert direkt mit der geforderten Commit-Attribution `Co-Authored-By: Claude Code <noreply@anthropic.com>` (System-Attribution). Der Hook läuft bei jedem `commit-msg` (nicht-blockierend wegen `|| true` in `.githooks/commit-msg:6`, schreibt die Nachricht aber um). Jeder von Claude Code erstellte Commit verliert damit die geforderte Attribution-Zeile.

**Quelle:** `scripts/sanitize-commit.mjs:8, 15-17`; `.githooks/commit-msg:6`; System-Attribution-Reminder.

**Bewertung (kritisch):** Direkte Kollision mit der geforderten Commit-Attribution; jeder Claude-Code-Commit verliert die `Co-Authored-By`-Zeile. Note D.

**Querverweis:** B-D1 (Sanitize-Schritt ornamental wegen `|| true`) betrifft denselben Hook/Skript-Komplex.

---

#### B-D9 — pre-push Hook: Defense-in-Depth (Claim + Lane-Claims + Doku-Drift + Commit-Msg + Board) — Note A

**Befunde:** `.githooks/pre-push` führt claim-preflight (Zeile 35–40), verify-lane-claims (Zeile 44–49), verify-docs Existenz + Drift (Zeile 53–65), verify-commit-msg über den Range (Zeile 71–101) und verify-board-usage (Zeile 106–111) aus. Das ist mehrschichtige Absicherung, die auch Cloud-Agenten ohne funktionierende Commit-Hooks erfasst. Stärke der Governance-Pipeline. Schwachpunkt bleibt der main-Frühausstieg (B-D2) und die fehlende Attribution durch sanitize-commit (B-D8).

**Quelle:** `.githooks/pre-push:35-111`.

**Bewertung:** Starke Defense-in-Depth im pre-push-Hook; mehrschichtige Absicherung über verschiedene Verify-Schritte.

---

## 2. Deduplizierung

Es wurden **keine exakten Duplikate** gefunden. Alle 17 Entscheidungen (8 aus A, 9 aus B) bleiben als eigenständige Einträge erhalten.

Zwei Paare behandeln dasselbe Thema aus komplementären Blickwinkeln und sind querreferenziert:

| Paar | Thema | A-Seite | B-Seite | Beziehung |
|------|-------|---------|---------|-----------|
| A-D3 ↔ B-D4 | Merge-Gate / Branch-Schutz auf `main` | Keine Required Status Checks / Required Reviews auf GitHub-Seite (Note C) | `merge-gate.mjs` flaggt fehlende Checks als BLOCKED, ist aber rein passiv ohne Live-Fetch (Note B) | Beide zusammen ergeben: kein technisch erzwungenes Merge-Gate auf main |
| A-D7 ↔ B-D2 | claim-preflight | fail-closed bei nicht lesbarem Register / fehlendem Claim (Note A) | main-Frühausstieg ohne Lane-Claim, Restrisiko bei falschem Branch-Schutz (Note A) | Beide zusammen: Preflight ist fail-closed, aber main überspringt den Claim-Check by design |

Keine Entscheidung wurde zusammengefasst oder entfernt; die Querverweise dienen der Rückverfolgbarkeit für den Maintainer.

---

## 3. Kritische Befunde (Note D/F) — gesammelt und priorisiert

Es gibt **keine Note F**. Fünf Befunde haben Note **D** (kritisch), plus ein C-Befund (K4) aus A, der thematisch in denselben Bereich fällt (Merge-Gate-Lücke).

### Priorisierung

| Priorität | ID | Note | Befund | Quelle | Betroffene Datei(en) |
|-----------|----|------|--------|--------|----------------------|
| 1 | B-D3 | **D** | install-hooks: doppelte `isFileModeIrrelevant` macht statSync-Ausführbarkeitsprüfung totgeschaltet | Commit `c18c4735` (#1156) | `scripts/install-hooks.mjs:37-42, 55-57, 76` |
| 2 | B-D8 | **D** | sanitize-commit entfernt `Co-Authored-By: Claude Code …` Attribution | System-Attribution-Reminder | `scripts/sanitize-commit.mjs:8, 15-17`; `.githooks/commit-msg:6` |
| 3 | A-D4 | **D** | Duales Register: `claims/` + `claims.json` (Legacy, nicht retention-gebremst) können driften | `docs/GOVERNANCE.md:134,168` | `.lane-claims/claims.json`; `.lane-claims/claims/*` |
| 4 | A-D5 | **D** | Doppelter Merge-/Board-Zustand: `merged-index.json` vs. `board-state.json`; unklar welche Quelle gewinnt | `docs/GOVERNANCE.md:134` | `.lane-claims/merged-index.json`; `.lane-claims/board-state.json` |
| 5 | A-D6 | **D** | Claim/Task-Paritätsbruch bei FREEZE-0: Claim `merged`, Task noch `READY_FOR_MERGE` | `docs/GOVERNANCE.md:169` | `.lane-claims/tasks/governance-freeze-0-code.json`; `.lane-claims/claims/lane-governance-freeze-0-code.json:53-57` |
| 6 | A-D3 | **C** | "Kein Bypass" technisch nicht erzwungen: `main` hat keine Required Status Checks, keine Required Reviews | `docs/GOVERNANCE.md:220-229`; `docs/CI.md:70-86` | GitHub Branch Protection auf `main` |

### Details zu den kritischen Befunden

**B-D3 (D) — install-hooks: statSync-Ausführbarkeitsprüfung nie wirksam.** Die doppelte Definition von `isFileModeIrrelevant` (Zeile 37–42 mit echter Logik, Zeile 55–57 überschreitend mit `return true`) sorgt dafür, dass die statSync-Prüfung `statSync(...).mode & 0o111` auf keiner Plattform ausgeführt wird. Hook-Dateien werden nie als ausführbar verifiziert. Der Index-Modus-Check (Zeile 73) allein reicht nicht aus.

**B-D8 (D) — sanitize-commit entfernt Commit-Attribution.** `FORBIDDEN` matcht `Co-authored-by:`, `Generated with`, `Claude`, `Anthropic` u. a.; diese Zeilen werden aus jeder Commit-Nachricht entfernt. Das kollidiert mit der geforderten System-Attribution `Co-Authored-By: Claude Code <noreply@anthropic.com>`. Jeder Claude-Code-Commit verliert die Attribution-Zeile.

**A-D4 (D) — Duales Register.** `.lane-claims/claims/` (Einzel-Claims mit Allowlist) und `.lane-claims/claims.json` (Legacy-Array) existieren nebeneinander. Nur das Einzel-Claims-Register ist retention-gebremst; `claims.json` ist explizit von der Retention ausgeschlossen (`docs/GOVERNANCE.md:168`). Drift zwischen den Registern ist möglich.

**A-D5 (D) — Doppelter Merge-/Board-Zustand.** `merged-index.json` (aus git-merge-commits, 31 Einträge) und `board-state.json` (aus `board:sync`) erfassen überlappend denselben Zustand. Bei Abweichung ist unklar, welche Quelle gewinnt. Drift-Risiko für Allowlist und Claim-Status.

**A-D6 (D) — Claim/Task-Paritätsbruch.** Der FREEZE-0-Claim ist `merged` (mit `mergedSha`), der zugehörige Task-Vertrag steht aber noch auf `READY_FOR_MERGE` mit `pr: null`. `docs/GOVERNANCE.md:169` schreibt vor, dass ein belegter Merge den Claim auf `merged` und den Task auf `DONE` zieht — das ist nicht geschehen.

**A-D3 (C) — Kein technisch erzwungenes Merge-Gate auf `main`.** `main` hat keine Required Status Checks und keine Required Reviews. Die Absicherung liegt allein im Maintainer-Protokoll und in `turn-push.mjs`. Ein Maintainer könnte theoretisch ohne Gate-Nachweis mergen.

---

## 4. Offene Fragen / Widersprüche zwischen A und B

| # | Frage / Widerspruch | Betroffene Entscheidungen | Status | Empfohlene Klärung |
|---|---------------------|---------------------------|--------|--------------------|
| Q1 | Soll `main` technisch durch Required Status Checks / Required Reviews abgesichert werden, oder bleibt der lokale Vor-PR-Nachweis die Autorität? | A-D3 (C), B-D4 (B) | Offen | Entscheidung des Maintainers: technische Erzwingung vs. dokumentiertes Protokoll |
| Q2 | Ist der main-Frühausstieg ohne Lane-Claim akzeptabel, wenn der Branch-Schutz auf main Lücken hat (siehe Q1)? | B-D2 (A), A-D3 (C) | Offen | Klären, ob ein Claim auf main gefordert werden soll |
| Q3 | Soll `claims.json` entfernt oder in das Einzel-Claims-Register und die Retention integriert werden? | A-D4 (D) | Offen | Entweder `claims.json` entfernen oder retention-fähig machen |
| Q4 | Welche Quelle gewinnt bei Abweichung zwischen `merged-index.json` und `board-state.json`? Soll eine Quelle als authoritative definiert werden? | A-D5 (D) | Offen | Authority-Regel definieren (z. B. `merged-index.json` als git-basierte Wahrheit) |
| Q5 | Soll der Task-Vertrag von FREEZE-0 auf `DONE` gezogen werden (Parität herstellen)? | A-D6 (D) | Offen | Task auf `DONE` setzen oder Claim/Task-Reconcile ausführen |
| Q6 | Soll die doppelte `isFileModeIrrelevant`-Definition in `install-hooks.mjs` bereinigt werden (überschreitende Definition entfernen)? | B-D3 (D) | Offen | Die zweite Definition entfernen, damit statSync-Prüfung wieder aktiv wird |
| Q7 | Soll `Co-Authored-By: Claude Code` von der `FORBIDDEN`-Liste in `sanitize-commit.mjs` entfernt werden? | B-D8 (D) | Offen | Attribution-Zeile von der FORBIDDEN-Liste ausschließen |

Keine der Fragen ist ein direkter Widerspruch (A und B widersprechen sich nicht inhaltlich); sie sind offene Klärungsbedarfe, die aus den komplementären Befunden entstehen.

---

## 5. Gesamtnote Phase 1 (Governance): D (kritisch)

**Begründung:** Es liegen fünf Befunde mit Note D vor (zwei aus B, drei aus A) plus ein C-Befund (A-D3) im selben Themenbereich (Merge-Gate-Lücke). Es gibt keine Note F. Die Governance-Pipeline ist grundsätzlich gut aufgebaut (Defense-in-Depth im pre-push-Hook, fail-closed claim-preflight, saubere Actors-Rollentrennung, vollständiger FREEZE-0-Rückbau), enthält aber kritische Lücken:

1. **install-hooks** macht die statSync-Ausführbarkeitsprüfung totgeschaltet (B-D3).
2. **sanitize-commit** entfernt die geforderte Claude-Attribution aus Commits (B-D8).
3. **Duale/überlappende Register** (claims/ + claims.json; merged-index.json + board-state.json) erzeugen Drift-Risiken (A-D4, A-D5).
4. **Claim/Task-Parität** bei FREEZE-0 ist verletzt (A-D6).
5. **Kein technisch erzwungenes Merge-Gate** auf `main` (A-D3, B-D4).

Die kritischste Note ist **D**. Phase 1 ist nicht merge-fähig, solange die beiden D-Befunde B-D3 und B-D8 nicht behoben sind und die Register-Doppelungen (A-D4, A-D5) nicht geklärt sind.

---

## 6. Empfohlene nächste Schritte (priorisiert)

### Sofort (vor dem nächsten Push)

1. **B-D3 beheben:** Die überschreitende `isFileModeIrrelevant`-Definition (Zeile 55–57) in `scripts/install-hooks.mjs` entfernen, damit die statSync-Ausführbarkeitsprüfung wieder aktiv wird.
2. **B-D8 beheben:** `Co-Authored-By: Claude Code` (und `Generated with`) von der `FORBIDDEN`-Liste in `scripts/sanitize-commit.mjs:8` entfernen, damit die geforderte Commit-Attribution erhalten bleibt.
3. **A-D6 beheben:** Den FREEZE-0-Task-Vertrag `.lane-claims/tasks/governance-freeze-0-code.json` auf `status: "DONE"` ziehen (Parität mit dem merged Claim herstellen), wie in `docs/GOVERNANCE.md:169` vorgesehen.

### Kurzfristig

4. **A-D4 klären:** Entweder `claims.json` entfernen oder in die Einzel-Claims-Struktur und die Retention-Regel integrieren (`docs/GOVERNANCE.md:168`).
5. **A-D5 klären:** Eine authoritative Quelle für den Merge-/Board-Zustand definieren (z. B. `merged-index.json` als git-basierte Wahrheit) oder die Quellen zusammenführen.
6. **A-D3 / B-D4 entscheiden:** Ob `main` technisch durch Required Status Checks / Required Reviews abgesichert wird, oder ob das dokumentierte Maintainer-Protokoll als ausreichend angesehen wird.

### Mittelfristig

7. **B-D1 prüfen:** Den ornamentalen Sanitize-Schritt (`|| true`) in `.githooks/commit-msg:6` entfernen oder blockierend machen.
8. **B-D5 prüfen:** `docContentOk` auf Inhaltsprüfung erweitern (nicht nur Pfad-Mitgliedschaft).
9. **B-D6 prüfen:** Die "Keine neuen Einträge"-Regel für `LEGACY_LOC` im Code durchsetzen (z. B. `Object.freeze` oder Fehler bei neuem Eintrag).

---

## Zusammenfassung für den Maintainer

- **Anzahl Entscheidungen:** 17 (8 aus A + 9 aus B, keine Duplikate entfernt, 2 Querverweis-Paare)
- **Kritischste Note:** D (keine F)
- **Kritische Befunde (D):** B-D3, B-D8, A-D4, A-D5, A-D6 (plus C: A-D3)
- **Dateipfad des konsolidierten Berichts:** `.claude/skills/adversarial-code-review/reports/phase-1-governance.md`

**Empfehlung:** Nicht mergen, bis B-D3 und B-D8 behoben sind sowie die Register-Doppelungen (A-D4, A-D5) und die Claim/Task-Parität (A-D6) geklärt sind.
