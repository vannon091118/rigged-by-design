# Konzept: Vollständige Simulationssichtbarkeit (Inspector/Debug-Ansicht)

<!-- rbd-doc: managed -->

## Aufgabe

Task #4 (P1) — Vollständige Simulationssichtbarkeit (Inspector/Debug-Ansicht) für den kompletten Simulationszustand.

Kontext-Chain: Schritt 29, current_step=29, last_agent=maintainer, next_agent=game-designer.

## Ziel

Eine Inspector/Debug-Ansicht erstellen, die den kompletten Simulationszustand sichtbar macht:
- **World-State**: Weltzustand, NPCs, Positionen, Beziehungen, Tick-Zähler, Tag, Spielerposition
- **Ledger**: Geldbuchungen, VaCoin (integer-Money-Mikro-Units), Konten, EXTERNAL_WORLD-Quellen (einzige Geldquelle/Senke), Saldo-Summe (Null-Check)
- **PRNG-Streams**: gameplay und presentation, getrennt, Seed-Persistenz, aktuelle Position pro Stream
- **Save-State v11**: Save/Load-Zustand, Migration v5–v10 → v11, Seed-Persistenz, letzter Save-Tick
- **Tick-Protokoll**: Simulationsschritte, Vorher/Nachher, Tick-Nummer, Aktion, Betroffene

## Akzeptanzkriterien

| # | Kriterium | Nachweis |
|---|-----------|----------|
| 1 | Inspector-Overlay zeigt World, Ledger, PRNG, Save-State gleichzeitig | Konzept + UI-Integration |
| 2 | Tick-Protokoll-Ansicht mit Vorher/Nachher-Werten | Tick-Log |
| 3 | Headless-Core-Regel: UI/Render liest nur Snapshots, keine zweite State-Truth | src/core/ bleibt headless |
| 4 | Kein LLM im Game-Path | Determinismus gewahrt |
| 6 | Ledger zeigt EXTERNAL_WORLD als einzige Geldquelle/Senke | Ledger-View |
| 7 | VaCoin als integer-Mikro-Einheiten | Ledger-View |
| 8 | PRNG-Streams getrennt gameplay|presentation mit Seed-Persistenz | PRNG-View |
| 9 | Save-State v11 mit Seed-Persistenz und Migration v5–v10 → v11 | Save-State-View |

## Logik-Kette (A → B → C)

```
A: DESIGN & KONZEPT (game-designer)
┌─────────────────────────────────────────────────────────────┐
│ 1. stop.flag prüfen → nicht vorhanden → Loop läuft          │
│ 2. CLAIM vor Read: board-state.json gesichtet               │
│ 3. WorldStore-Struktur analysiert (Ledger, PRNG, World)     │
│ 4. Save-State v11 Struktur geprüft                          │
│ 5. Headless-Core-Regel beachtet (src/core/ ohne UI/Render)  │
│ 6. System-Design für Inspector erstellt                     │
│ 7. Design-Dokumentation geschrieben                         │
│ 8. Kontext-Chain-Eintrag erstellt (next_agent: jenova)      │
│ 9. Handoff an jenova via message_agent                      │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
B: IMPLEMENTIERUNG (jenova → lillith → shinon)
┌─────────────────────────────────────────────────────────────┐
│ jenova: Design validieren → Inspector implementieren →      │
│        Ergebnis in Eintrag → message_agent(lillith)          │
│ lillith: QA/Validierung → Eintrag → message_agent(shinon)   │
│ shinon: Integration → Eintrag → message_agent(governance-office)│
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
C: REVIEW, ABSCHLUSS & STATUS (governance-office → maintainer → hermes)
┌─────────────────────────────────────────────────────────────┐
│ governance-office: Vertrag prüfen, Lücken, Typografie → Eintrag│
│                      → message_agent(maintainer)             │
│ maintainer: PR-Review → Merge/Close → Tag → Eintrag          │
│                      → message_agent(hermes)                 │
│ hermes: Status-Check → Loop-Vollständigkeit → Nutzer-Info    │
└─────────────────────────────────────────────────────────────┘
```

## Visualisierung (ASCII)

```
Inspector/Debug-Ansicht — Simulationssichtbarkeit

┌─────────────────────────────────────────────────────────────┐
│  INSPECTOR  [X]  Tick: 42  |  Day: 3  |  VaCoin: 1500      │
├─────────────┬─────────────┬─────────────┬─────────────────┤
│  WORLD      │  LEDGER     │  PRNG       │  SAVE v11       │
│  - NPCs: 3  │  - Konten:  │  - Gameplay:│  - Version: 11  │
│  - Spieler: │  - Summe: 0 │  - Pres:    │  - Letzter Save:│
│    (5,5)    │     ✓       │   Seed:xyz│  Tick 42          │
├─────────────┴─────────────┴─────────────┴─────────────────┤
│  TICK-PROTOKOLL                                             │
│  Tick 42: Spieler bewegt (5,5)->(6,5), Hunger 45->44        │
│  Tick 41: Gast betritt Laden, Kauf 25 VC                    │
│  Tick 40: NPC Rita geht schlafen                            │
│  ...                                                        │
├─────────────────────────────────────────────────────────────┤
│  [Überlay toggelbar]  [Headless-Core: Snapshots nur lesen]  │
└─────────────────────────────────────────────────────────────┘
```

## Offene Fragen an die Implementierung (jenova)

1. **Inspector-Ort:** Soll der Inspector als separates UI-Panel im Render-Layer (`src/render/`) oder als UI-Komponente (`src/ui/`) implementiert werden?
2. **Snapshot-Zugriff:** Wie erhält der Inspector Read-Only-Zugriff auf WorldStore-Snapshots (über GameView oder eigene Inspektor-Fassade)?
3. **Tick-Protokoll-Speicher:** Wird das Tick-Protokoll im Weltzustand (j.world.journal) oder separat geführt?
4. **Save-State-Ansicht:** Soll der Inspector den Save-State v11 als JSON-Dump oder als strukturierte Ansicht anzeigen?
5. **PRNG-Seed-Ansicht:** Soll der aktuelle PRNG-Seed sichtbar sein (für Debugging) oder nur der Stream-Zustand (gameplay/presentation)?
6. **Performance:** Bei wie vielen Ticks im Protokoll soll ein Rollover oder Paginierung erfolgen?
7. **Test-Ausführung:** Welche Tests können ohne node/pnpm laufen? (Blockiert: node/pnpm nicht ausführbar)

## Blocker (nicht loop-stoppend)

- `node` und `pnpm` sind nicht ausführbar in dieser Umgebung (Android-Terminal)
- `pnpm rbd docs read` kann nicht laufen → kein gültiger Receipt für PreToolUse-Hook
- Keine Test-Läufe möglich, keine echten UI-Tests
- Dies ist ein dokumentierter Blocker, kein Loop-Stopp
- Planung ist Doku/Design-only

## Regeln (beachtet)

- stop.flag vor jedem Schritt geprüft (nicht vorhanden → Loop läuft)
- CLAIM vor Read: board-state.json gesichtet (READY, head 370c4fa, 13 offene Issues, 0 offene PRs)
- GitHub-First: Eigene Branches von origin/main, PR gegen main, nie main pushen, nie force-push
- node/pnpm nicht verfügbar: Python-/Hand-Äquivalente + Doku, Loop läuft weiter
- WIP auf fix/1188 nicht anrühren/resetten
- Temp-Dateien in scratch/

## Logische Commits (jeder einzeln + eigener PR)

| Commit | Inhalt | Geänderte Systeme | Akzeptanzkriterium | Grober Aufwand | Gate-Kosten | Branch |
|--------|--------|-------------------|-------------------|----------------|-------------|--------|
| simvis-1 | simstate-export: Read-Only-Snapshot-Reader API für WorldState, Ledger, PRNG, Save-State | `src/store/inspector-export.ts`, `src/store/world-store.ts` (Read-only Zugriff) | Snapshot-Reader API verfügbar | ~150 LoC | lint, typecheck, headless-core, docs | `fix/simvis-1` → main |
| simvis-2 | ledger-view: Tabellarische Ledger-Ansicht mit EXTERNAL_WORLD-Quellen, integer-Money-Mikro-Units, Konten, Buchungen, Saldo-Null-Check | `src/render/inspector-ledger-view.ts` | Ledger zeigt EXTERNAL_WORLD, Mikro-Units, Summe=0 | ~120 LoC | lint, typecheck, ledger-integrity, docs | `fix/simvis-2` → main |
| simvis-3 | prng-view: PRNG-Stream-Zustand gameplay|presentation getrennt, Seed, aktuelle Position, Seed-Persistenz | `src/render/inspector-prng-view.ts`, `src/core/rng/` (Read-only) | PRNG getrennt, Seed sichtbar | ~80 LoC | lint, typecheck, docs | `fix/simvis-3` → main |
| simvis-4 | tick-log: Tick-Protokoll-Ansicht mit Vorher/Nachher, Tick-Nummer, Aktion, Betroffene, 1000 Ticks Rollover | `src/render/inspector-tick-log.ts`, `src/store/world-store.ts` (journal Zugriff) | Tick-Protokoll mit Paginierung | ~100 LoC | lint, typecheck, docs | `fix/simvis-4` → main |
| simvis-5 | overlay-integration: Inspector-Overlay ins Spiel integriert, toggelbar, Headless-Core-konform, alle 4 Views vereint | `src/render/inspector-overlay.tsx`, `src/render/inspector-panel.tsx` | Overlay toggelbar, alle Views sichtbar | ~200 LoC | lint, typecheck, headless-core, docs, render-ui | `fix/simvis-5` → main |

**Gesamtbudget: 10000** — Aufwand pro PR in docs/LAST-CHANGES oder loop-Doku verfolgen.

## Regeln (beachtet)

- stop.flag vor jedem Schritt geprüft (nicht vorhanden → Loop läuft)
- CLAIM vor Read: board-state.json gesichtet (READY, head 370c4fa, 13 offene Issues, 0 offene PRs)
- Git-Identität: "Alice (Hermes Agent)"
- GitHub-First: Eigene Branches von origin/main, PR gegen main, nie main pushen, nie force-push
- WIP-Branches anderer Agenten nicht anfassen
- RELEASE nach PR
- node/pnpm nicht verfügbar: Python-/Hand-Äquivalente + Doku, Loop läuft weiter
- WIP auf fix/1188 nicht anrühren/resetten
- Temp-Dateien in scratch/

## Kontext-Chain-Eintrag

| Feld | Wert |
|------|------|
| entry_id | task-4-inspector-001 |
| task_id | 4 |
| priorität | P1 |
| erstellt_von | game-designer |
| status | bereit_für_implementation |
| current_agent | game-designer |
| next_agent | jenova |
| issue_id | P1 (Vollständige Simulationssichtbarkeit) |
| blocker | node/pnpm nicht ausführbar (dokumentiert, nicht loop-stoppend) |
| stop.flag_geprüft | true (nicht vorhanden → Loop läuft) |
| budget | 10000 |

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
Author: Alice (Hermes Agent)
Branches: fix/simvis-1, fix/simvis-2, fix/simvis-3, fix/simvis-4, fix/simvis-5 (jeweils gegen main)
GitHub-First: CLAIM vor Read, RELEASE nach PR
```
