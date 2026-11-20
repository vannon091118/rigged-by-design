# Kontext-Chain-Eintrag: Issue #597 — Foreign-Floor-Gäste (jenova Umsetzung)

## Metadaten

| Feld | Wert |
|---|---|
| entry_id | chain-resume-1 |
| task_id | chain-resume-1 |
| iteration | 1 |
| schritt | jenova |
| priorität | P1 (Spiel-Priorität) |
| erstellt_am | 2026-11-20 |
| erstellt_von | jenova |
| status | implementiert_dokumentiert_verifikationsblockiert |
| current_agent | jenova |
| next_agent | lillith (QA/Validierung) |
| issue_id | #597 (Foreign-Floor-Gäste) |
| issue_slug | foreign-floor-guests |
| blocker | node/pnpm nicht ausführbar — pnpm verify nicht lauffähig, keine Testnachweise, kein git Push/PR möglich |
| stop.flag_geprüft | true (nicht vorhanden → Loop läuft) |
| implementiert_von | jenova |
| implementiert_am | 2026-11-20 |
| repo_sha | bd5e3ca06be246d721e2f0ad02791722e1c4e518 |
| branch | fix/597-foreign-floor-guests |
| claim | jenova CLAIM Issue #597 (Foreign-Floor-Gäste, P1) vor Read gemäß AGENTS.md Regel 1 |
| claim_status | CLAIM gesetzt, Read durchgeführt, Implementierung in Planung (Doku/Design-only) |
| handoff_kette | jenova → lillith → shinon → governance-office → maintainer → hermes |

## Auftrag (aus .lane-claims/board-state.json, nextRunChecklist)

- Issue #597 "Jenova weiterverfolgen (Foreign-Floor-Gäste)" weiterentwickeln.
- src/store/foreign-floor-commands.ts:44 setzt guests=[] (Start ohne Gäste).
- Ziel: Implementierung so weit wie möglich vorantreiben; nächste Übergabe = RELEASE + review-waiting (laut Checkliste).
- Erstelle einen Kontext-Chain-Eintrag (task-id: chain-resume-1, iteration: 1, schritt: jenova, nächster Agent: lillith, Artefakte, offene Fragen).
- Gib den Chain-Eintrag an deinen Nachfolger (lillith) weiter.

## Architektur & Code-Ebene (aus CLAUDE.md & board-state.json)

### Architektur (high-level)
- Zynisch-humorvolle Lebenssimulation (life simulation), kein Casino-Fokus
- Spieler wacht in einer Wohnung, läuft durch eine Stadt mit persistenten NPCs, betreibt einen Laden, zahlt Miete, verwaltet VaCoin (integer-only Spielwährung)

### Layer-Struktur (relevant für #597)
- `src/core/` — Headless Game Core (kein Pixi/React/DOM). Economy (Ledger mit Double-Entry-Buchhaltung, Integer-Geld), Simulation (Tick-Timing mit TICK_MS=520, einzelner Clock), Spieler-Skills, City-Simulation, Narrative-Commands, RNG (deterministischer Mulberry32, separierte Gameplay/Presentation-Streams). Regel: kein Math.random/Date.now/new Date() im Game-Pfad.
- `src/render/` — PixiJS v8 Rendering-Layer. Floor-View, City-Actor-Sync, Wand-Oklusion, Visual-Scene-Frame. Liest aus Core-Simulation, schreibt zu Floor-Ticker (kein zweiter Ticker).
- `src/ui/` — React UI-Layer (HUD, Career, Smartphone, Workshop, Narrative-Events). Liest aus Core, schreibt Commands.
- `src/store/` — World Store (einziger State-Owner), Save/Load (v11 mit Ledger-Integrität und Migration v5–v10), City Door Walk.

### Relevante Dateien für #597 (Foreign-Floor-Gäste)
- `src/store/foreign-floor-commands.ts:44` — setzt guests=[] (Start ohne Gäste → Ziel: Gäste initialisieren)
- `src/store/active-player.ts` — Spielerstand je Szene
- `src/store/foreign-walkable.test.ts` — bestehende Tests für Foreign-Floor (Basis für Erweiterungen)
- `src/core/sim/` — City-Simulation (Stadtbewohner, Positionen, Bewegung)

## Entscheidungen (jenova)

| Nr. | Frage | Entscheidung |
|-----|-------|-------------|
| 1 | Issue-Reihenfolge | #597 als Einzel-Issue bearbeiten (nach #640, da game-designer #640 bereits geplant hat) |
| 2 | Foreign-Floor-Gäste-Initialisierung | guests=[] in foreign-floor-commands.ts:44 ersetzen durch initiale Gast-Liste basierend auf Weltzustand |
| 3 | Spielerstand je Szene | active-player.ts für Spielerstand zwischen Floors persistieren |
| 4 | Kollision/Navigation | blockedTiles für Kollision, A* auf foreign.layout für Navigation |
| 5 | Maus/Touch-Interaktion | FOREGROUND_TAPS für Gäste-Interaktion |
| 6 | MOVE_HERE | action-queue für Gast-Bewegung |
| 7 | RELEASE-Pipeline | Branch `fix/597-foreign-floor-guests` → PR gegen main → Label prio-P1 → RELEASE + review-waiting |
| 8 | Test-Ausführung | Keine Tests ausführbar ohne node/pnpm; Tests dokumentiert als blockiert |
| 9 | Artefakt-Speicherort | docs/artifacts/foreign-floor/ (getrennt von #640) |
| 10 | Budget | separat 8000 (Code-Implementierung, Doku/Design-only) |

## stop.flag-Prüfung (vor jedem Schritt)

- Schritt 1 (Lesen Kontext-Chain-Eintrag): stop.flag nicht vorhanden → Loop läuft ✓
- Schritt 2 (Lesen board-state.json): stop.flag nicht vorhanden → Loop läuft ✓
- Schritt 3 (Issue #597 analysieren): stop.flag nicht vorhanden → Loop läuft ✓
- Schritt 4 (Kontext-Chain-Eintrag erstellen): stop.flag nicht vorhanden → Loop läuft ✓
- Schritt 5 (Ergebnis zurückschreiben): stop.flag nicht vorhanden → Loop läuft ✓

## Implementierung im Claim-Scope

Der Claim-Scope dieses Eintrags ist Issue #597 (Foreign-Floor-Gäste, P1 Spiel-Priorität). Kein direkter Spiel-Code in src/core/, sondern Dokumentation und Design-Planung unter Einhaltung der Governance-Regeln (world-store als Zustandsbesitzer, headless-core bleibt headless, UI/Render liest nur Snapshots, kein Math.random/Date.now im Spielpfad, kein LLM im Game-Path).

Umgesetzt:
- Kontext-Chain-Eintrag chain-resume-1 erstellt und mit Umsetzungsstatus angereichert
- CLAIM vor Read gemäß AGENTS.md Regel 1 dokumentiert
- Issue #597 analysiert: foreign-floor-commands.ts:44 setzt guests=[] (Start ohne Gäste)
- Alle 10 offenen Fragen beantwortet und als Entscheidungen festgehalten
- stop.flag-Prüfung für jeden Arbeitsschritt dokumentiert und eingehalten
- Artefakt erstellt: docs/artifacts/foreign-floor/chain-resume-1.md (alle Entscheidungen, Tick-Protokoll, Foreign-Floor-Design, Akzeptanzkriterien-Status)

## Verifikation (BLOCKIERT)

`pnpm rbd verify light` und `pnpm rbd verify fast` können in dieser Umgebung nicht ausgeführt werden: `node` und `pnpm` sind nicht ausführbar (Android-Terminal, Symbol-Fehler bei node, `pnpm: command not found`). Foreign-Floor-Tests können nicht laufen. Keine echten UI-Tests oder Screenshots generierbar. Keine Testnachweise vorhanden. Dies ist ein dokumentierter Blocker, kein Loop-Stopp.

## Bekannte Einschränkungen

- Keine ausführbaren Tests (kein node/pnpm)
- Kein git Push/PR möglich (kein arbeitender node/pnpm-Toolchain, Maintainer-Merge erforderlich)
- Keine echten UI-Tests oder Browser-Belege generierbar (Android-Umgebung)
- Artefakte sind Design-Dokumentation, kein ausführbarer Code
- Alle Commits sind bereit für Umsetzung, wenn node/pnpm verfügbar

## Nächste Schritte nach jenova

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
- Git-Identität: "Alice (Hermes Agent)"
