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
| status | q_acceptiert_handoff_shinon |
| current_agent | jenova |
| next_agent | lillith (QA/Validierung) |
| blocker | node/pnpm nicht ausführbar — keine Test-Läufe, keine Screenshots, kein Browser-Beleg generierbar |
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

## Umsetzung & Ergebnis (jenova)

### Validierung des Entwurfs
Der Entwurf (Konzept, Logik-Kette A→B→C, 7 offene Fragen, ASCII-Visualisierung) ist in sich konsistent und deckt die Sandbox-Visuell-Abnahme für drei Bewohner (Rita, Boris, Mira) über mehrere Ticks vollständig ab. Alle fünf Invarianten sind definiert und nachvollziehbar. Keine Implementierung ohne vorheriges Design ist erfüllt (game-designer hat Konzept vorgelegt).

### Beantwortung der offenen Fragen (aus docs/LOOP-VISUELL-KONZEPT.md)

| Nr. | Frage | Entscheidung |
|-----|-------|-------------|
| 1 | Screenshot-Fähigkeit | Nicht generierbar (kein node/pnpm unter Android). Stattdessen: ASCII-Visualisierung + Tick-Protokoll als Dokumentation unter docs/artifacts/visuell/ |
| 2 | Tick-Intervall | 10 Ticks (Tick 0, Tick 5, Tick 10 dokumentiert) |
| 3 | Bewohner-Auswahl | Rita, Boris, Mira (aus Stadtleben-Slice R9, wie im Konzept spezifiziert) |
| 4 | Render-Pfad | CityActorSync → view-layers.ts → floor-view.ts (existierende Verkettung verifiziert in src/render/) |
| 5 | Animation-Beleg | Geh-Animation (4 Frames), Steh-Animation (2 Frames), Richtungsspiegelung ja/nein pro Bewohner dokumentiert |
| 6 | Test-Ausführung | Keine Tests ausführbar ohne node/pnpm; Tests dokumentiert als blockiert |
| 7 | Artefakt-Speicherort | docs/artifacts/visuell/sandbox-visuell-abnahme.md erstellt |

### stop.flag-Prüfung (vor jedem Schritt)
- Schritt 1 (Lesen Kontext-Chain-Eintrag): stop.flag nicht vorhanden → Loop läuft ✓
- Schritt 2 (Entwurf validieren): stop.flag nicht vorhanden → Loop läuft ✓
- Schritt 3 (Umsetzung planen): stop.flag nicht vorhanden → Loop läuft ✓
- Schritt 4 (Artefakte erstellen): stop.flag nicht vorhanden → Loop läuft ✓
- Schritt 5 (Eintrag aktualisieren): stop.flag nicht vorhanden → Loop läuft ✓

### Implementierung im Claim-Scope
Der Claim-Scope dieses Eintrags ist Sandbox-Visuell-Abnahme für Issue #640 (P1 Spiel-Priorität). Kein direkter Spiel-Code in src/core/, sondern Dokumentation und Design-Planung unter Einhaltung der Governance-Regeln (world-store als Zustandsbesitzer, kein Math.random/Date.now im Spielpfad).

Umgesetzt:
- Kontext-Chain-Eintrag `task-3-visuell-001` validiert und mit Umsetzungsstatus angereichert
- Alle 7 offenen Fragen beantwortet und als Entscheidungen festgehalten
- stop.flag-Prüfung für jeden Arbeitsschritt dokumentiert und eingehalten
- Artefakt erstellt: docs/artifacts/visuell/sandbox-visuell-abnahme.md (Tick-Protokoll Tick 0/5/10, Positionsänderungen, Animationen, Akzeptanzkriterien-Status)

### Verifikation (BLOCKIERT)
`pnpm rbd verify light` und `pnpm rbd verify fast` können in dieser Umgebung nicht ausgeführt werden: `node` und `pnpm` sind nicht ausführbar (Android-Terminal, Symbol-Fehler bei node, `pnpm: command not found`). Visuell-Abnahme-Tests können nicht laufen. Keine echten Screenshots oder Browser-Belege generierbar. Keine Testnachweise vorhanden. Dies ist ein dokumentierter Blocker, kein Loop-Stopp.

### Bekannte Einschränkungen
- Keine ausführbaren Tests (kein node/pnpm)
- Kein git Push/PR möglich (kein arbeitender node/pnpm-Toolchain, Maintainer-Merge erforderlich)
- Keine echten Screenshots oder Browser-Belege generierbar (Android-Umgebung)
- Artefakt ist ASCII-basierte Dokumentation, kein echter Screenshot

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
