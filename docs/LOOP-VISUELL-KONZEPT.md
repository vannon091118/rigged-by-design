# Konzept: Sandbox-Visuell-Abnahme (drei Bewohner, mehrere Ticks)

<!-- rbd-doc: managed -->

## Aufgabe

Herausforderung: Die Sandbox-Visuell-Abnahme für drei Bewohner (Rita, Boris, Mira) über mehrere Ticks planen. Das Board hat kein offenes Game-Lane-Issue; die vorherige Visuell-Abnahme war unter #640 (CityActorSync Frame-Render), die seit 2026-11-16 closed ist. Dies ist die NEUE Planungs-Phase.

## Ziel

Einen Design-Plan für die visuelle Abnahme der drei Stadt-NPCs (Rita, Boris, Mira) im Browser erstellen, sodass ihre Positionen und Animationen über mehrere Sim-Ticks hinweg sichtbar belegt werden können. Der Renderer `CityActorSync` existiert bereits und ist in `floor-view.ts`/`view-layers.ts` verdrahtet; der visuelle Positions-/Animationsbeleg im Browser fehlt weiterhin (Issue #640, closed, aber Beleg steht noch aus).

## Akzeptanzkriterien

| # | Kriterium | Nachweis |
|---|-----------|----------|
| 1 | Drei Bewohner (Rita, Boris, Mira) sind im Browser sichtbar belegt | Screenshot oder ASCII-Visualisierung |
| 2 | Positionsänderungen über mehrere Ticks sind nachweisbar | Tick-Protokoll mit Vorher/Nachher |
| 3 | Animationen (Gehrichtung, Stillstand, Richtungsspiegelung) sind dokumentiert | `locomotion.ts`, `floor-animate.ts` Referenz |
| 4 | Kachel, A*-Weg, Ankunftszeit und Zwischenstand sind belegt | `city-life-movement.ts` |
| 5 | Kein Fallback, echte Materialien (M3-Regel aus ROADMAP.md) | RENDER_REWORK_PLAN.md Einhaltung |

## Logik-Kette (A → B → C)

```
A: PLANUNG & DESIGN (game-designer)
┌─────────────────────────────────────────────────────────────┐
│ 1. stop.flag prüfen → nicht vorhanden → Loop läuft          │
│ 2. RENDER_REWORK_PLAN.md (R7–R9), ROADMAP.md (M3) gelesen   │
│ 3. Stadt-NPCs identifiziert: Rita, Boris, Mira              │
│ 4. Renderer CityActorSync + view-layers.ts + floor-view.ts  │
│ 5. Konzept erstellt (Ziel, Akzeptanzkriterien, Logik-Kette, Fragen) │
│ 6. Visualisierung erstellt (ASCII, Textfluss)               │
│ 7. Offene Fragen formuliert                                 │
│ 8. Kontext-Chain-Eintrag erstellt (next_agent: jenova)      │
│ 9. Handoff an jenova via message_agent                      │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
B: IMPLEMENTIERUNG & VERIFIKATION (jenova → lillith → shinon)
┌─────────────────────────────────────────────────────────────┐
│ jenova: Design validieren → Visuell-Abnahme planen/umsetzen │
│        → Ergebnis in Eintrag → message_agent(lillith)        │
│ lillith: QA/Validierung → Eintrag → message_agent(shinon)    │
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
Sandbox-Visuell-Abnahme: Drei Bewohner über mehrere Ticks

  Tick N:           Tick N+1:           Tick N+2:
  ┌─────────┐       ┌─────────┐       ┌─────────┐
  │  Rita   │──→    │  Rita   │──→    │  Rita   │
  │  [HOME] │       │ [WEG]   │       │ [MARKT] │
  │  Hunger 45│     │  Hunger 44│     │  Hunger 42│
  └─────────┘       └─────────┘       └─────────┘
  ┌─────────┐       ┌─────────┐       ┌─────────┐
  │  Boris  │──→    │  Boris  │──→    │  Boris  │
  │ [ARBEIT]│       │ [ARBEIT]│       │ [WEG]   │
  │  Müd 70 │       │  Müd 71 │       │  Müd 72 │
  └─────────┘       └─────────┘       └─────────┘
  ┌─────────┐       ┌─────────┐       ┌─────────┐
  │  Mira   │──→    │  Mira   │──→    │  Mira   │
  │ [KIEZ]  │       │ [PUB]   │       │ [PUB]   │
  │  Laune 60 │     │  Laune 62 │     │  Laune 64 │
  └─────────┘       └─────────┘       └─────────┘

  Renderer: CityActorSync → view-layers.ts → floor-view.ts
  Beleg: Screenshot + Tick-Protokoll (Vorher/Nachher)
```

## Offene Fragen an die Implementierung (jenova)

1. **Screenshot-Fähigkeit:** Kann ein Browser-Screenshot unter Android generiert werden, oder reicht headless-Beleg + ASCII-Visualisierung?
2. **Tick-Intervall:** Wie viele Ticks sollen für die Visuell-Abnahme protokolliert werden (z. B. 10, 50, 100)?
3. **Bewohner-Auswahl:** Sind Rita, Boris, Mira die richtigen drei Bewohner, oder sollen andere hinzugezogen werden?
4. **Render-Pfad:** Wird `CityActorSync` über `view-layers.ts` und `floor-view.ts` angesprochen, oder gibt es einen direkteren Pfad?
5. **Animation-Beleg:** Wie sollen Gehrichtung und Stillstand visuell belegt werden (Frames, Richtungsspiegelung)?
6. **Test-Ausführung:** Welche Tests können ohne node/pnpm laufen? Welche sind blockiert?
7. **Artefakt-Speicherort:** Sollen Screenshots/Belege unter `docs/screenshots/` oder `artifacts/` abgelegt werden?

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
| entry_id | task-3-visuell-001 |
| task_id | 3 |
| priorität | P1 (Spiel-Priorität) |
| erstellt_von | game-designer |
| status | bereit_für_implementation |
| current_agent | game-designer |
| next_agent | jenova |
| issue_id | 640 (nachgeführt, closed — neue Planung) |
| blocker | node/pnpm nicht ausführbar (dokumentiert, nicht loop-stoppend) |
| stop.flag_geprüft | true (nicht vorhanden → Loop läuft) |

## Handoff-Format

```
HANDOFF an: jenova (@jenova)
Aufgabe: Entwurf für Sandbox-Visuell-Abnahme validieren, planen, umsetzen, Ergebnis zurückschreiben
Nachweise: docs/LOOP-VISUELL-KONZEPT.md (dieses Dokument)
Nächster Schritt nach jenova: lillith (QA/Validierung)
Danach: shinon → governance-office → maintainer → hermes (Status)
stop.flag: nicht vorhanden → Loop läuft
```
