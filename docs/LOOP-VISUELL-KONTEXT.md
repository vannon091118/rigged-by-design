# Kontext-Chain-Eintrag: Sandbox-Visuell-Abnahme (drei Bewohner, mehrere Ticks)

<!-- rbd-doc: managed -->

## Metadaten

| Feld | Wert |
|------|------|
| entry_id | task-3-visuell-001 |
| task_id | 3 |
| priorität | P1 (Spiel-Priorität) |
| erstellt_am | 2026-11-20 |
| erstellt_von | game-designer |
| status | implementiert_dokumentiert_verifikationsblockiert |
| current_agent | jenova |
| next_agent | lillith (QA/Validierung) |
| blocker | node/pnpm nicht ausführbar — Planung ist Doku/Design-only, keine Test-Läufe, keine Screenshots generierbar |
| stop.flag_geprüft | true (nicht vorhanden → Loop läuft) |
| implementiert_von | jenova |
| implementiert_am | 2026-11-20 |
| repo_sha | bd5e3ca06be246d721e2f0ad02791722e1c4e518 |
| branch | fix/1188-verify-all-test-quality |
| cycle_id | 1 |
| handoff_kette | jenova → lillith → shinon → governance-office → maintainer → hermes |

## Entwurf

Siehe `docs/LOOP-VISUELL-KONZEPT.md` — Design-Konzept für die Sandbox-Visuell-Abnahme (drei Bewohner: Rita, Boris, Mira; mehrere Ticks).

## Logik-Kette (A → B → C)

```
A: PLANUNG & DESIGN (game-designer)
  1. stop.flag prüfen → nicht vorhanden → Loop läuft
  2. RENDER_REWORK_PLAN.md (R7–R9), ROADMAP.md (M3) gelesen
  3. Stadt-NPCs identifiziert: Rita, Boris, Mira
  4. Renderer CityActorSync + view-layers.ts + floor-view.ts geprüft
  5. Konzept erstellt (Ziel, Akzeptanzkriterien, Logik-Kette, Fragen)
  6. Visualisierung erstellt (ASCII, Textfluss)
  7. Offene Fragen formuliert
  8. Kontext-Chain-Eintrag erstellt (next_agent: jenova)
  9. Handoff an jenova via message_agent

B: IMPLEMENTIERUNG & VERIFIKATION (jenova → lillith → shinon)
  10. jenova: Entwurf validieren → Visuell-Abnahme planen/umsetzen → Eintrag → message_agent(lillith)
  11. lillith: QA/Validierung → Eintrag → message_agent(shinon)
  12. shinon: Integration → Eintrag → message_agent(governance-office)

C: REVIEW, ABSCHLUSS & STATUS (governance-office → maintainer → hermes)
  13. governance-office: Vertrag prüfen, Lücken, Typografie → Eintrag → message_agent(maintainer)
  14. maintainer: PR-Review → Merge/Close → Tag → Eintrag → message_agent(hermes)
  15. hermes: Status-Check → Loop-Vollständigkeit → Nutzer-Info
```

## Visualisierung

Siehe `docs/LOOP-VISUELL-KONZEPT.md` — ASCII-Visualisierung der drei Bewohner über mehrere Ticks.

## Offene Fragen an jenova

Siehe `docs/LOOP-VISUELL-KONZEPT.md` — 7 offene Fragen (Screenshot-Fähigkeit, Tick-Intervall, Bewohner-Auswahl, Render-Pfad, Animation-Beleg, Test-Ausführung, Artefakt-Speicherort).

## Übergabe an jenova

- **Empfänger:** jenova (@jenova)
- **Aufgabe:** Entwurf validieren, Visuell-Abnahme planen/umsetzen, Ergebnis zurückschreiben, dann Handoff an lillith
- **Nachweise:** docs/LOOP-VISUELL-KONZEPT.md (dieses Dokument)
- **Nächster Schritt nach jenova:** lillith (QA/Validierung)
- **Danach:** shinon → governance-office → maintainer → hermes (Status)

## Invarianten (gültig für den gesamten Loop)

- stop.flag wird vor jedem Schritt geprüft
- Jeder Kontext-Chain-Eintrag hat Owner und nächsten Agenten
- Keine Implementierung ohne vorheriges Design
- Jeder Schritt ist für den Nutzer sichtbar
- Kein direkter Push auf main (immer Branch + PR + Maintainer-Merge)

## Handoff-Format

```
HANDOFF an: jenova (@jenova)
Aufgabe: Entwurf für Sandbox-Visuell-Abnahme validieren, planen, umsetzen, Ergebnis zurückschreiben
Nachweise: docs/LOOP-VISUELL-KONZEPT.md
Nächster Schritt nach jenova: lillith (QA/Validierung)
Danach: shinon → governance-office → maintainer → hermes (Status)
stop.flag: nicht vorhanden → Loop läuft
```

## Umgebung-Blocker (dokumentiert, nicht loop-stoppend)

- node/pnpm nicht ausführbar in dieser Android-Umgebung
- Planung ist Doku/Design-only; keine Test-Läufe; keine Screenshots generierbar
- Blocker ist im Entry sichtbar
