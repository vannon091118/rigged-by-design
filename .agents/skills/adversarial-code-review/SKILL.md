---
name: adversarial-code-review
description: Führt einen gegnerischen Code Review in 4 sequentiellen Phasen durch. Pro Phase laufen 2 Sub-Agenten parallel (je unterschiedliche Teilbereiche), gefolgt von 1 Sequenz-Ende-Agent der offene Fragen klärt. Konsolidiert alles zu einem finalen Audit-Report und löscht Rest-Artefakte.
mode: agent
---

# Adversarial Code Review — Rigged by Design (parallele Ausführung)

Dieser Skill führt einen **gegenerisch-systematischen Code Review** durch. Er arbeitet in **4 sequentiellen Phasen**. Pro Phase laufen **2 Sub-Agenten parallel**, gefolgt von **1 Sequenz-Ende-Agent** der die beiden Berichte zusammenführt und offene Fragen klärt. Am Ende werden alle Zwischenberichte zu **einem finalen Report** konsolidiert und die Rest-Artefakte gelöscht.

## Ziel des Reviews

1. **Vollständiger Überblick** über den Projektzustand (Code, Doku, History, Claims, Issues)
2. **Parallele Wahrheiten, doppelte Systeme, widersprüchliche Systeme, falsche Takt-Logiken und redundante Arbeitsschritte** aktiv aufspüren — ohne das Spiel aus dem Fokus zu verlieren
3. Jede Designentscheidung benoten (A–F) mit Befunde-Erklärung und zurückverfolgbarer Quelle

## Die 4 Phasen (streng sequentiell, Phase 0 zuerst)

| Phase | Fokus | Zwischenbericht |
|-------|-------|-----------------|
| **0 — Drift Tracker** | Vollständige History: Commits, PRs, Issues, DevTagebuch, Doku; Diff-Analyse; Widersprüche, doppelte Systeme, redundante Arbeit | `phase-0-drift.md` |
| **1 — Governance** | Claims, Hooks, FREEZE-0 (#684), Actors, Regeln, Allowlist, Preflight, P0-Prioritäten, Maintainer-Capability | `phase-1-governance.md` |
| **2 — Gamedesign** | Stadt-NPCs (#640), Kneipe (#574), Skill-System (#654/#653), Wirtschaft (#527/#538), Narrative (#541), Backlog-Order (#563), Determinismus | `phase-2-gamedesign.md` |
| **3 — Tooling** | Verify-Pipeline (18 Required + 13 Light Gates), Preflight, CI lokal, Build, Test, Hooks, Scripts, Loc-Guard (#1100) | `phase-3-tooling.md` |

## Pro-Phase-Ausführung (2 parallele Sub-Agenten + 1 Ende-Agent)

### Phase 0 — Drift Tracker
- **Sub-Agent A:** Commits & PRs analysieren (Diffs, Widersprüche zwischen Commits, redundante Closeout-Commits, Commits ohne Issue-Bezug)
- **Sub-Agent B:** Issues, DevTagebuch, Doku analysieren (parallele Wahrheiten in Doku, doppelte Systeme, widersprüchliche Aussagen)
- **Ende-Agent:** Führt A+B zusammen, klärt offene Fragen, schreibt `phase-0-drift.md`

### Phase 1 — Governance
- **Sub-Agent A:** Claims, Hooks, Actors, Rollentrennung (`actors.json`, `work-claim.mjs`, Claim-Register, Preflight)
- **Sub-Agent B:** FREEZE-0 (#684), Merge-Gate auf main, P0-Prioritäten, Issue-Board-Erzwingung
- **Ende-Agent:** Führt A+B zusammen, klärt offene Fragen, schreibt `phase-1-governance.md`

### Phase 2 — Gamedesign
- **Sub-Agent A:** Stadt-NPCs (#640), Kneipe (#574), Skill-System (#654/#653), Werkstatt/Smartphone (#642–#646)
- **Sub-Agent B:** Wirtschaft (#527/#538), Soziale Faktoren (#537/#540), Narrative (#541), Renderabnahme (#647/#649–#651), Determinismus (Regel 5)
- **Ende-Agent:** Führt A+B zusammen, klärt offene Fragen, schreibt `phase-2-gamedesign.md`

### Phase 3 — Tooling
- **Sub-Agent A:** Verify-Pipeline (18 Required + 13 Light), Profile, Claim Preflight, CI lokal, Build-Gate
- **Sub-Agent B:** Hooks (Windows, commit-msg), LOC-Guard, Drift-Check, Test-Qualität, Dead Code, Mechanik-Tests
- **Ende-Agent:** Führt A+B zusammen, klärt offene Fragen, schreibt `phase-3-tooling.md`

## Querschnitt: Zurückverfolgbarkeit & Reproduzierbarkeit

Jede Befund in jeder Phase muss **zurückverfolgbar** sein:
- **Quelle:** Datei:Zeile (z. B. `scripts/install-hooks.mjs:45`), Commit-SHA, PR-Nummer, Issue-Nummer
- **Bezug:** Claim-ID (z. B. `lane/governance/freeze-0-code`), Task-Datei
- **Reproduzierbarkeit:** Ein späterer Lauf derselben Phase auf demselben Stand muss dieselben Befunde liefern.

## Ablauf (für den ausführenden Agenten)

### Vorbereitung (einmalig)
```bash
pnpm rbd docs read
pnpm rbd agent start --brief
```

### Die 4 Phasen ausführen (jeweils 2 Sub-Agenten parallel + 1 Ende-Agent)
Jede Phase muss abgeschlossen sein, bevor die nächste beginnt.

### Konsolidierung & Aufräumen
```bash
node .Codex/skills/adversarial-code-review/driver.mjs --consolidate
```
Der driver liest alle 4 Zwischenberichte, erstellt `AUDIT-FINAL.md` (ein einziger konsolidierter Report) und löscht alle 4 `phase-*.md` Dateien.

## Commands

```bash
# Konsolidiere alle 4 Phase-Berichte zu einem finalen Report
# und lösche die Zwischenberichte (Rest-Artefakte)
node .Codex/skills/adversarial-code-review/driver.mjs --consolidate

# Hilfe
node .Codex/skills/adversarial-code-review/driver.mjs --help
```

## Noten-System (A–F)

| Note | Bedeutung |
|------|-----------|
| **A** | Exzellent — Design und Umsetzung vollständig konsistent, keine Befunde |
| **B** | Gut — kleine Unstimmigkeiten, kein Risiko |
| **C** | Befriedigend — funktioniert, aber Verbesserungsbedarf |
| **D** | Mangelhaft — klare Befunde, Risiko vorhanden |
| **E** | Schwerwiegend — Designentscheidung problematisch, muss überarbeitet werden |
| **F** | Unakzeptabel — kritischer Befund, blockiert Merge/Release |

Jede Note wird mit einer **Befunde-Erklärung** begründet und einer **zurückverfolgbaren Quelle**.

## Output-Struktur (während des Laufs)

```
.Codex/skills/adversarial-code-review/
  SKILL.md               <- diese Datei
  driver.mjs             <- Konsolidierungs-Orchestrator (--consolidate)
  drift-tracker.mjs      <- Phase 0: Vollständige History-Analyse (Diff-basiert)
  reports/
    phase-0-drift.md         <- Zwischenbericht Phase 0 (wird nach --consolidate gelöscht)
    phase-1-governance.md    <- Zwischenbericht Phase 1 (wird nach --consolidate gelöscht)
    phase-2-gamedesign.md    <- Zwischenbericht Phase 2 (wird nach --consolidate gelöscht)
    phase-3-tooling.md       <- Zwischenbericht Phase 3 (wird nach --consolidate gelöscht)
    AUDIT-FINAL.md           <- FINALER konsolidierter Report (einzige übrig bleibende Datei)
```

## Für zukünftige Agenten

Wenn du diesen Skill aufrufst, ist dein Ziel: **keine Oberfläche kratzen, sondern tief in jede Designentscheidung graben.** Pro Phase laufen 2 Sub-Agenten parallel, jeder deckt unterschiedliche Teilbereiche ab. Der Sequenz-Ende-Agent klärt offene Fragen zwischen den beiden Sub-Agenten. Der Drift Tracker (Phase 0) deckt zuerst auf, wo das Projekt sich von sich selbst widerspricht. Jede Entscheidung muss mit Code-Stellen belegt sein. Jede Note muss eine Befunde-Erklärung haben. Der finale Report muss für einen Maintainer lesbar sein, der entscheiden muss: "Merge ich das oder nicht?" — und er muss zurückverfolgbar sein, damit jede Befund nachprüfbar ist.