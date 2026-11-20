# Konzept: Issue P2-A — Start-Zoom-Kamera (FloorCameraRig) — Pixel/Region-Bug

<!-- rbd-doc: managed -->

## Aufgabe

Task #5, Priorität P2 — Spiel-Design-Schritt 1 in der autonomen Loop-Kette (game-designer → jenova → lillith → shinon → governance-office → maintainer → hermes).

Identifizierter Bug in `src/render/floor-camera-rig.ts:81-83`:
`x` und `y` sind Pixelwerte (aus EntitySync), werden aber mit `REGION=30` (Tile-Dimension) statt `TILE=26` (Pixel pro Tile) dividiert. Das führt dazu, dass die Zoom-Area außerhalb der 16×16-Welt berechnet wird.

## Ziel

Den Pixel/Region-Bug in `zoomToPlayer` beheben, sodass der Start-Zoom korrekt auf die Spielerfigur zentriert ist (Echter Apartment-Spawn bei 5,5), die Zoom-Area für Welten kleiner als REGION geklemmt wird, und Fokus sowie Weltgrenzen geprüft werden (nicht nur LOD).

## Akzeptanzkriterien

| # | Kriterium | Nachweis |
|---|-----------|----------|
| 1 | Pixel→Tile Umrechnung vor Area-Berechnung (x/TILE statt x/REGION) | `floor-camera-rig.ts` Zeile 81-83 |
| 2 | Zoom-Area für Welten < REGION geklemmt | `floor-camera-rig.ts` Clamp-Logik |
| 3 | Test mit echtem Apartment-Spawn (5,5) | Konzept/Test-Plan dokumentiert |
| 4 | Fokus + Weltgrenzen geprüft (nicht nur LOD) | Konzept |
| 5 | Mobile (390px) + Desktop getrennt belegen | Konzept mit beiden Viewport-Größen |

## Logik-Kette (A → B → C)

```
A: PLANUNG & DESIGN (game-designer)
┌─────────────────────────────────────────────────────────────┐
│ 1. stop.flag prüfen → nicht vorhanden → Loop läuft          │
│ 2. floor-camera-rig.ts Zeile 81-83 gelesen (Bug analysiert) │
│ 3. TILE=26, REGION=30 aus board-constants.ts bestätigt      │
│ 4. Konzept erstellt (Ziel, Akzeptanzkriterien, Logik-Kette, Fragen) │
│ 5. Kontext-Chain-Eintrag erstellt (next_agent: jenova)      │
│ 6. Handoff an jenova via message_agent                      │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
B: IMPLEMENTIERUNG & FIX (jenova → lillith → shinon)
┌─────────────────────────────────────────────────────────────┐
│ jenova: Design validieren → Fix implementieren (Pixel→Tile, │
│        Clamp, Test-Plan) → Eintrag → message_agent(lillith) │
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
Bug-Analyse: ZoomToPlayer Area-Berechnung

  Welt 16×16 Tiles = 416×416 Pixel (TILE=26)
  ┌─────────────────────────────────────┐
  │                                     │
  │   Spawn (5,5) → Pixel (130, 130)    │
  │         │                           │
  │    x=130, y=130                     │
  │         │                           │
  │    BUG: x/REGION = 130/30 = 4       │
  │    → areaX = 4*30 = 120 (FALSCH!)   │
  │    → wäre korrekt: x/TILE = 130/26 = 5│
  │    → areaX = 5*30 = 150 (KORREKT)   │
  │         │                           │
  └─────────────────────────────────────┘

  Zoom-Area Clamp (Welt < REGION):
  ┌─────────────────────────────────────┐
  │  Welt 16×16 < REGION 30 → klemmen   │
  │  auf Welt-Grenze (0,0,16,16)        │
  └─────────────────────────────────────┘

  Viewport-Vergleich:
  ┌─────────┐       ┌─────────────────┐
  │ Mobile  │       │   Desktop       │
  │ 390px   │       │   1920px+       │
  └─────────┘       └─────────────────┘
```

## Offene Fragen an die Implementierung (jenova)

1. **Clamp-Logik:** Soll die Zoom-Area auf die Welt-Grenze (0,0,worldWidth,worldHeight) geklemmt werden, oder auf die nächste gültige Region-Grenze innerhalb der Welt?
2. **TILE-Import:** Wird `TILE` bereits in `floor-camera-rig.ts` importiert, oder muss der Import ergänzt werden?
3. **Test-Datei:** Soll ein neuer Test für `zoomToPlayer` erstellt werden, oder gehört der Bugfix zu bestehenden Tests?
4. **Apartment-Spawn:** Wird der Spawn bei (5,5) als Tile-Koordinate oder als Pixel-Koordinate übergeben?
5. **Mobile/Desktop:** Sollen separate Screenshots/Belege für 390px und Desktop erstellt werden, oder reicht der Code-Beleg?
6. **Fokus-Prüfung:** Wie soll der Fokus auf die Spielerfigur nach dem Zoom verifiziert werden?
7. **Weltgrenzen:** Was passiert, wenn der Spieler nahe am Welt-Rand spawnt (z. B. bei (0,0) oder (15,15))?

## Blocker (nicht loop-stoppend)

- `node` und `pnpm` sind nicht ausführbar in dieser Umgebung (Android-Terminal)
- `pnpm rbd docs read` kann nicht laufen → kein gültiger Receipt für PreToolUse-Hook
- Keine Test-Läufe möglich, keine Screenshots generierbar
- Dies ist ein dokumentierter Blocker, kein Loop-Stopp
- Planung ist Doku/Design-only

## Invarianten (gültig für den gesamten Loop)

- `stop.flag` wird vor jedem Schritt geprüft
- Jeder Kontext-Chain-Eintrag hat Owner und nächsten Agenten
- Keine Implementierung ohne vorheriges Design
- Jeder Schritt ist für den Nutzer sichtbar
- Kein direkter Push auf `main` — immer über Branch + PR + Maintainer-Merge

## Kontext-Chain-Eintrag

| Feld | Wert |
|------|------|
| entry_id | task-5-p2a-001 |
| task_id | 5 |
| priorität | P2 |
| erstellt_von | game-designer |
| status | bereit_für_implementation |
| current_agent | game-designer |
| next_agent | jenova |
| issue_id | P2-A (Start-Zoom-Kamera FloorCameraRig) |
| blocker | node/pnpm nicht ausführbar (dokumentiert, nicht loop-stoppend) |
| stop.flag_geprüft | true (nicht vorhanden → Loop läuft) |

## Handoff-Format

```
HANDOFF an: jenova (@jenova)
Aufgabe: Entwurf für Issue P2-A (FloorCameraRig Pixel/Region-Bug) validieren, Fix implementieren, Ergebnis zurückschreiben
Nachweise: docs/LOOP-P2A-KONZEPT.md (dieses Dokument)
Nächster Schritt nach jenova: lillith (QA/Validierung)
Danach: shinon → governance-office → maintainer → hermes (Status)
stop.flag: nicht vorhanden → Loop läuft
```
