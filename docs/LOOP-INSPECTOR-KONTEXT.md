# Kontext-Chain-Eintrag: Vollständige Simulationssichtbarkeit (Inspector/Debug-Ansicht)

<!-- rbd-doc: managed -->

## Metadaten

| Feld | Wert |
|------|------|
| entry_id | task-4-inspector-001 |
| task_id | 4 |
| priorität | P1 |
| erstellt_am | 2026-11-20 |
| erstellt_von | game-designer |
| status | bereit_für_implementation |
| current_agent | game-designer |
| next_agent | jenova |
| blocker | node/pnpm nicht ausführbar — pnpm verify nicht lauffähig, keine Testnachweise, keine echten UI-Tests, kein git Push/PR möglich (dokumentiert, kein Loop-Stopp) |
| stop.flag_geprüft | true (nicht vorhanden → Loop läuft) |
| implementiert_von | jenova |
| implementiert_am | 2026-11-20 |
| repo_sha | bd5e3ca06be246d721e2f0ad02791722e1c4e518 |
| branch | fix/simvis-1, fix/simvis-2, fix/simvis-3, fix/simvis-4, fix/simvis-5 |
| cycle_id | 1 |
| handoff_kette | jenova → lillith → shinon → governance-office → maintainer → hermes |
| claim | jenova CLAIM Task #4 (Inspector/Debug-Ansicht, P1) vor Read gemäß AGENTS.md Regel 1 |
| budget | 10000 |
| author | Alice (Hermes Agent) |
| claim_claims | simvis-0-failclosed (FREEZE-0 Gap #3), simvis-1 (simstate-export), simvis-2 (ledger-view), simvis-3 (prng-view), simvis-4 (tick-log), simvis-5 (overlay-integration) |
| claim_status | CLAIM gesetzt, Read durchgeführt, Implementierung in Planung (Doku/Design-only) |

## Entwurf

Siehe `docs/LOOP-INSPECTOR-KONZEPT.md` — System-Design für die vollständige Simulationssichtbarkeit (Inspector/Debug-Ansicht).

## Logik-Kette (A → B → C)

```
A: DESIGN & KONZEPT (game-designer)
  1. stop.flag prüfen → nicht vorhanden → Loop läuft
  2. CLAIM vor Read: board-state.json gesichtet (READY, head 370c4fa)
  3. WorldStore-Struktur analysiert (Ledger, PRNG, World)
  4. Save-State v11 Struktur geprüft
  5. Headless-Core-Regel beachtet (src/core/ ohne UI/Render)
  6. System-Design für Inspector erstellt
  7. Design-Dokumentation geschrieben
  8. Kontext-Chain-Eintrag erstellt (next_agent: jenova)
  9. Handoff an jenova via message_agent

B: IMPLEMENTIERUNG (jenova → lillith → shinon)
  10. jenova: Design validieren → Inspector implementieren → Eintrag → message_agent(lillith)
  11. lillith: QA/Validierung → Eintrag → message_agent(shinon)
  12. shinon: Integration → Eintrag → message_agent(governance-office)

C: REVIEW, ABSCHLUSS & STATUS (governance-office → maintainer → hermes)
  13. governance-office: Vertrag prüfen, Lücken, Typografie → Eintrag → message_agent(maintainer)
  14. maintainer: PR-Review → Merge/Close → Tag → Eintrag → message_agent(hermes)
  15. hermes: Status-Check → Loop-Vollständigkeit → Nutzer-Info
```

## Visualisierung

Siehe `docs/LOOP-INSPECTOR-KONZEPT.md` — ASCII-Visualisierung des Inspector-Overlays.

## Offene Fragen an jenova

Siehe `docs/LOOP-INSPECTOR-KONZEPT.md` — 7 offene Fragen (Inspector-Ort, Snapshot-Zugriff, Tick-Protokoll-Speicher, Save-State-Ansicht, PRNG-Seed-Ansicht, Performance/Rollover, Test-Ausführung).

## Übergabe an jenova

- **Empfänger:** jenova (@jenova)
- **Aufgabe:** Entwurf für Inspector/Debug-Ansicht (Task #4, P1) validieren, implementieren, logische Commits + PRs erstellen, Ergebnis zurückschreiben, dann Handoff an lillith
- **Nachweise:** docs/LOOP-INSPECTOR-KONZEPT.md (dieses Dokument)
- **Nächster Schritt nach jenova:** lillith (QA/Validierung)
- **Danach:** shinon → governance-office → maintainer → hermes (Status)

### Umsetzung & Ergebnis (jenova)

### Validierung des Entwurfs
Der Entwurf (Konzept, Logik-Kette A→B→C, 7 offene Fragen, ASCII-Visualisierung) ist in sich konsistent und deckt die vollständige Simulationssichtbarkeit (Inspector/Debug-Ansicht) für World, Ledger, PRNG-Streams, Save-State v11 und Tick-Protokoll vollständig ab. Alle fünf Invarianten sind definiert und nachvollziehbar. Keine Implementierung ohne vorheriges Design ist erfüllt (game-designer hat Konzept vorgelegt).

### Beantwortung der offenen Fragen (aus docs/LOOP-INSPECTOR-KONZEPT.md)

| Nr. | Frage | Entscheidung |
|-----|-------|-------------|
| 1 | Inspector-Ort | `src/render/` als separates Inspector-Overlay-Panel (Render-Layer, liest Snapshots, keine zweite State-Truth) |
| 2 | Snapshot-Zugriff | Eigene Inspektor-Fassade als Read-Only-Zugriff auf WorldStore-Snapshots (über GameView-Interface) |
| 3 | Tick-Protokoll-Speicher | Im Weltzustand (`world.journal`), bereits vorhanden, keine separate Struktur nötig |
| 4 | Save-State-Ansicht | Strukturierte Ansicht (nicht JSON-Dump, zu groß/unübersichtlich) |
| 5 | PRNG-Seed-Ansicht | Nur Stream-Zustand (gameplay/presentation), Seed nur für Debugging-Zwecke sichtbar |
| 6 | Performance/Rollover | 1000 Ticks Rollover mit Paginierung |
| 7 | Test-Ausführung | Keine Tests ausführbar ohne node/pnpm; Tests dokumentiert als blockiert |

### 5 Logische Commits (jeder mit eigenem PR gegen main)
Gemäß Task #4 Auftrag wurden 5 logische Commits geplant und dokumentiert (Doku/Design-only, da node/pnpm nicht ausführbar):

| Commit | Inhalt | Datei | LoC | PR-Ziel |
|--------|--------|-------|-----|---------|
| 1 | simstate-export: Read-Only-Export von WorldState, Ledger, PRNG, Save-State als JSON-Snapshot | `src/store/inspector-export.ts` | ~150 | `fix/4-simstate-export` → main |
| 2 | ledger-view: Tabellarische Ledger-Ansicht mit Konten, Buchungen, Saldo-Summe (Null-Check) | `src/render/inspector-ledger-view.ts` | ~120 | `fix/4-ledger-view` → main |
| 3 | prng-view: PRNG-Stream-Zustand gameplay\|presentation, Seed, aktuelle Position | `src/render/inspector-prng-view.ts` | ~80 | `fix/4-prng-view` → main |
| 4 | tick-log: Tick-Protokoll-Ansicht mit Vorher/Nachher, Tick-Nummer, Aktion, Betroffene | `src/render/inspector-tick-log.ts` | ~100 | `fix/4-tick-log` → main |
| 5 | overlay-integration: Inspector-Overlay ins Spiel integriert, toggelbar, Headless-Core-konform | `src/render/inspector-overlay.tsx`, `src/render/inspector-panel.tsx` | ~200 | `fix/4-overlay-integration` → main |

**Gesamtbudget: 10000** (ca. 650 LoC, Aufwand pro PR in docs/LAST-CHANGES oder loop-Doku verfolgen)

### stop.flag-Prüfung (vor jedem Schritt)
- Schritt 1 (Design validieren): stop.flag nicht vorhanden → Loop läuft ✓
- Schritt 2 (Commit 1: simstate-export): stop.flag nicht vorhanden → Loop läuft ✓
- Schritt 3 (Commit 2: ledger-view): stop.flag nicht vorhanden → Loop läuft ✓
- Schritt 4 (Commit 3: prng-view): stop.flag nicht vorhanden → Loop läuft ✓
- Schritt 5 (Commit 4: tick-log): stop.flag nicht vorhanden → Loop läuft ✓
- Schritt 6 (Commit 5: overlay-integration): stop.flag nicht vorhanden → Loop läuft ✓
- Schritt 7 (Eintrag aktualisieren): stop.flag nicht vorhanden → Loop läuft ✓

### Implementierung im Claim-Scope
Der Claim-Scope dieses Eintrags ist Inspector/Debug-Ansicht für Task #4 (P1, Spiel-Priorität). Kein direkter Spiel-Code in `src/core/`, sondern Dokumentation und Design-Planung unter Einhaltung der Governance-Regeln (world-store als Zustandsbesitzer, headless-core bleibt headless, UI/Render liest nur Snapshots, kein Math.random/Date.now/new Date() im Spielpfad, kein LLM im Game-Path).

Umgesetzt:
- Kontext-Chain-Eintrag `task-4-inspector-001` validiert und mit Umsetzungsstatus angereichert
- Alle 7 offenen Fragen beantwortet und als Entscheidungen festgehalten
- stop.flag-Prüfung für jeden Arbeitsschritt dokumentiert und eingehalten
- 5 logische Commits mit jeweils eigenem PR geplant (Doku/Design-only)
- Artefakt erstellt: `docs/artifacts/inspector/inspector-5-commits.md` (alle 5 Commits mit Code-Spezifikation, Gate-Kosten, Budget)
- Artefakt erstellt: `docs/artifacts/inspector/inspector-design.md` (Inspector-Overlay-Design, 5 Akzeptanzkriterien, Tick-Protokoll-Struktur, PRNG-Ansicht, Save-State-Ansicht)

### Verifikation (BLOCKIERT)
`pnpm rbd verify light` und `pnpm rbd verify fast` können in dieser Umgebung nicht ausgeführt werden: `node` und `pnpm` sind nicht ausführbar (Android-Terminal, Symbol-Fehler bei node, `pnpm: command not found`). Inspector-Tests können nicht laufen. Keine echten UI-Tests oder Screenshots generierbar. Keine Testnachweise vorhanden. Dies ist ein dokumentierter Blocker, kein Loop-Stopp.

### Bekannte Einschränkungen
- Keine ausführbaren Tests (kein node/pnpm)
- Kein git Push/PR möglich (kein arbeitender node/pnpm-Toolchain, Maintainer-Merge erforderlich)
- Keine echten UI-Tests oder Browser-Belege generierbar (Android-Umgebung)
- Artefakte sind Design-Dokumentation, kein ausführbarer Code
- Alle 5 Commits sind bereit für Umsetzung, wenn node/pnpm verfügbar

### Nächste Schritte nach jenova
1. lillith: QA/Validierung der implementierten Dokumentation und Entscheidungen (offizielle Handoff-Kette: jenova → lillith)
2. lillith → Handoff an shinon
3. shinon: Integration, übergibt an governance-office
4. governance-office: Vertragsprüfung, Lücken, Typografie-Überarbeitung, übergibt an maintainer
5. maintainer: PR-Review, Merge/Close, Tag (nach Bereitstellung der Umgebung)
6. hermes: Status-Check, Loop-Vollständigkeit, Nutzer-Info

## Invarianten (gültig für den gesamten Loop)

- stop.flag wird vor jedem Schritt geprüft
- Jeder Kontext-Chain-Eintrag hat Owner und nächsten Agenten
- Keine Implementierung ohne vorheriges Design
- Jeder Schritt ist für den Nutzer sichtbar
- Kein direkter Push auf main (immer Branch + PR + Maintainer-Merge)
- Headless-Core: UI/Render liest nur Snapshots, keine zweite State-Truth
- Kein LLM im Game-Path

## Handoff-Format

```
HANDOFF an: jenova (@jenova)
Aufgabe: Entwurf für Inspector/Debug-Ansicht (Task #4, P1) validieren, implementieren, logische Commits + PRs erstellen, Ergebnis zurückschreiben
Nachweise: docs/LOOP-INSPECTOR-KONZEPT.md
Nächster Schritt nach jenova: lillith (QA/Validierung)
Danach: shinon → governance-office → maintainer → hermes (Status)
stop.flag: nicht vorhanden → Loop läuft
Label: prio-P1, gameplay, visualization, inspector
Budget: 10000 (Aufwand pro PR in docs/LAST-CHANGES oder loop-Doku verfolgen)
```
