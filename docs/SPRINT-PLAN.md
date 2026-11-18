# Sprint/Batch-Plan: Behebung kritischer Audit-Befunde (Rigged by Design)

## Context

Das Adversarial Code Review wurde erfolgreich abgeschlossen (4 Phasen, 52 Entscheidungen, Gesamtnote C, in AUDIT-FINAL.md konsolidiert). Es wurden 13 kritische Befunde (Note D–F) identifiziert, die vor weiteren Merges behoben werden sollen. Der Owner `vannon091118` hat administrative Rechte; das Claim-System ist primär Support für parallele Arbeitskonflikt-Prävention, kein strenges Tor für den Owner selbst.

**Ziel dieses Sprints:** Die kritischen Befunde (D–F) aus Phase 1 (Governance), Phase 2 (Gamedesign) und Phase 3 (Tooling) systematisch abarbeiten, sodass der Merge-Gate und die Hooks verlässlich funktionieren und keine unbeaufsichtigten Sicherheitslücken bleiben.

## Erforschte Befunde (verifiziert durch Explore-Agenten)

### Phase 1 — Governance (12 Entscheidungen, Note D)
| # | Bereich | Note | Befund | Verifizierte Quelle |
|---|---------|------|--------|---------------------|
| 1 | Actors & Rollen | F | Ein einziger Principal in allen drei Rollen, kein exklusiver Maintainer-Login | `.lane-claims/actors.json:3-5` (vannon091118 in maintainers, users, workers) |
| 2 | Merge-Gate auf main | D | Keine Required-Status-Checks, kein enforce_admins für main selbst | `scripts/lib/merge-gate.mjs:18,22,25,48` |
| 3 | FREEZE-0 / #684 | D | Claim gemergt obwohl Issue #684 P0-blockiert ist | `.lane-claims/claims/lane-governance-freeze-0-code.json:4,54` |
| 4 | P0-Prioritäten | D | Issue #684 P0 blockiert, Claim trotzdem gemergt | siehe #3 |
| 5 | Issue-Board-Erzwingung | D | Gemergter Claim entgeht Board-Prüfung | `scripts/lib/board-usage.mjs:79-88` |
| 6 | Ruleset auf main | D | Keine serverseitige Ruleset-Erzwingung | GitHub-Einstellung, nicht lokal prüfbar |
| 7 | Hooks (Windows) | D | .sh-Hooks auf Windows still übersprungen (statSync mode & 0o111 = 0 auf NTFS) | `scripts/install-hooks.mjs:58,61` |
| 8 | Claim Preflight | D | main-Branch ohne Prüfung durchgelassen (process.exit(0)) | `scripts/claim-preflight.mjs:30-35` |

### Phase 2 — Gamedesign (23 Entscheidungen, Note B)
| # | Bereich | Note | Befund | Status |
|---|---------|------|--------|--------|
| 4 | PR #683 nicht mergebar | D | Keine Claim-Datei verweist auf PR #683; Bezug nicht belegt | Nicht verifiziert — offen |
| 7 | Kleidung/Marken socialFactor | C | Kein `socialFactor`-Feld in `item-synergy.ts` | Audit-Finding war falsch — Felder sind `attraction, patience, addiction, operating` |

### Phase 3 — Tooling (17 Entscheidungen, Note C)
| # | Bereich | Note | Befund | Verifizierte Quelle |
|---|---------|------|--------|---------------------|
| 1 | commit-msg-Hook ohne node_modules | F | Hook springt vor jeder Prüfung ab (exit 0) | `.githooks/commit-msg:6` |
| 2 | Hooks auf Windows | D | statSync(mode & 0o111) auf NTFS oft 0 → Hook als nicht ausführbar gemeldet | `scripts/install-hooks.mjs:58,61` |
| 4 | Legacy-LOC-Ausnahmen | D | 4 Dateien mit cap 350 unterlaufen Guard | `scripts/loc-budgets.mjs:29-34` |
| 5 | Drift-Check --drift | C | Prüft nur Existenz in LAST-CHANGES.md, nicht Inhalt | `scripts/lib/doc-drift.mjs:28-47` |
| 7 | Dead Code Default-Exports | C | Default-Exports übersprungen (kein benanntes Artefakt) | `scripts/verify-dead-code.mjs:49` |
| 8 | run-pipeline.mjs Default = full | D | Default-Profil ist `full`, nicht `quick`/`light` | `scripts/run-pipeline.mjs:31-33` |

## Plan (Schritte nach Priorität)

### Schritt 1: commit-msg-Hook ohne node_modules beheben (Note F, Tooling)
- Datei: `.githooks/commit-msg` (Zeile 6: `if [ ! -d node_modules ]; then exit 0; fi`)
- Ziel: Hook soll auch ohne `node_modules` eine minimale Prüfung der Pflichtsektionen durchführen
- Verifikation: Frischer Klon committet nicht ohne Gate

### Schritt 2: Actors/Rollen-Trennung einführen (Note F, Governance)
- Dateien: `.lane-claims/actors.json`, `scripts/lib/work-claim.mjs` (Zeilen 127–141, 215–218)
- Ziel: Separaten Maintainer-Login einführen, der nicht gleichzeitig Worker ist; `shared-principal-not-authorized` auflösen
- Verifikation: Maintainer-Entscheidungen durch separaten Principal möglich

### Schritt 3: Merge-Gate mit Required-Status-Checks für main (Note D, Governance)
- Dateien: `scripts/lib/merge-gate.mjs` (Zeilen 18,22,25,48), `scripts/verify-merge-gate.mjs:39`
- Ziel: Required-Status-Checks und `enforce_admins` aktivieren; Merge nur nach grünem Verify
- Verifikation: Direkter Merge auf main ohne grünen PR-Lauf blockiert

### Schritt 4: FREEZE-0 / #684 Widerspruch auflösen (Note D, Governance)
- Dateien: `.lane-claims/claims/lane-governance-freeze-0-code.json:4,54`, `.lane-claims/merged-index.json`
- Ziel: Entweder Issue #684 entblocken oder FREEZE-0-Claim zurücknehmen
- Verifikation: Kein gemergter Claim auf P0-blockiertem Issue

### Schritt 5: Claim Preflight für main verschärfen (Note D, Governance)
- Datei: `scripts/claim-preflight.mjs` (Zeilen 30–35)
- Ziel: Auch auf `main` Claims und Task-Verträge prüfen (oder Ausnahme dokumentieren)
- Verifikation: main-Branch nicht mehr ohne Prüfung durchgelassen

### Schritt 6: Windows-Hooks beheben (Note D, Governance + Tooling)
- Datei: `scripts/install-hooks.mjs` (Zeilen 58, 61)
- Ziel: Auf Windows `core.fileMode` vor `statSync(mode & 0o111)` prüfen; NTFS kennt kein ausführbares Bit
- Verifikation: Frischer Klon auf Windows hat funktionierende Hooks

### Schritt 7: Legacy-LOC-Ausnahmen entfernen (Note D, Tooling)
- Dateien: `scripts/loc-budgets.mjs` (Zeilen 29–34), `scripts/lib/loc-guard.mjs` (Zeilen 129–134)
- Ziel: 4 Legacy-Dateien auf normalen Cap bringen oder klare Migrationsstrategie
- Verifikation: Keine `@loc-exception`-Header mehr außerhalb LEGACY_LOC

### Schritt 8: Default-Profil vereinheitlichen (Note D, Tooling)
- Dateien: `scripts/run-pipeline.mjs` (Zeile 31–33), `docs/CI.md`, `package.json`
- Ziel: Default-Profil auf `quick` oder `light` setzen (konsistent mit Dokumentation)
- Verifikation: Ein einziger Standard statt drei verschiedenen

### Schritt 9: Drift-Check Inhalt validieren (Note C, Tooling)
- Datei: `scripts/lib/doc-drift.mjs` (Zeilen 28–47)
- Ziel: Nicht nur Existenz von LAST-CHANGES.md prüfen, sondern auch Inhalt
- Verifikation: Doku-Eintrag beschreibt die tatsächliche Änderung

### Schritt 10: Default-Exports in Dead-Check einbeziehen (Note C, Tooling)
- Datei: `scripts/verify-dead-code.mjs` (Zeile 49)
- Ziel: Default-Exports nicht mehr pauschal überspringen
- Verifikation: Default-Exports werden auf Totheit geprüft

### Schritt 11: PR #683 klären (Note D, Gamedesign — offen)
- Bezug: Keine Claim-Datei verweist auf PR #683; Bezug nicht belegt
- Ziel: Klären, ob PR #683 existiert und auf welchem Stand es ist
- Verifikation: Skill-Bereich konsistent

### Schritt 12: Konsolidierung wiederholen
- Kommando: `node .claude/skills/adversarial-code-review/driver.mjs --consolidate`
- Ziel: Bestätigen, dass kritische Befunde reduziert sind

## Verifikation

- Alle 4 Phasen des Audits laufen ohne Fehler durch
- `pnpm rbd docs read` und `pnpm rbd agent start --brief` funktionieren
- Keine kritischen D–F-Befunde mehr im finalen Report (oder dokumentierte Ausnahmen mit Owner-Zustimmung)

## Offene Fragen (für den User)

1. Soll der FREEZE-0-Claim zurückgenommen oder Issue #684 entblockt werden?
2. Soll das Default-Profil auf `quick` oder `light` gesetzt werden?
3. Soll ein separater Maintainer-Login eingerichtet werden (erfordert Repo-Änderung)?