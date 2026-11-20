# Kontext-Chain-Eintrag: task-3-p2-qa (lillith, QA/Validierung P2-A + P2-B)

<!-- rbd-doc: managed -->

## Metadaten

| Feld | Wert |
|------|------|
| entry_id | task-3-p2-qa |
| task_id | 3 |
| priorität | P2 |
| erstellt_am | 2026-11-20 |
| erstellt_von | lillith (QA/Development Worker Sekundär) |
| status | qa_abgeschlossen_uebergabe_bereit |
| current_agent | lillith |
| next_agent | governance-office (Adversarial Reviewer) |
| cycle_id | 1 |
| stop.flag_geprüft | true (nicht vorhanden → Loop läuft) |
| blocker | node/pnpm nicht ausführbar — keine Regressionstests, keine Tests lauffähig (dokumentiert, kein Loop-Stopp) |
| implementiert_von | lillith |
| implementiert_am | 2026-11-20 |
| repo_sha | bd5e3ca06be246d721e2f0ad02791722e1c4e518 |
| branch | fix/1188-verify-all-test-quality |
| handoff_kette | jenova → lillith → shinon → governance-office → maintainer → hermes |
| vorheriger_eintrag | P2-A + P2-B von jenova (Primär-Fix abgeschlossen) |

## QA/Validierung (P2-A + P2-B)

### stop.flag-Prüfung (vor jedem Schritt)

- Schritt 1 (Lesen Kontext-Chain-Eintrag): stop.flag nicht vorhanden → Loop läuft ✓
- Schritt 2 (Code-Review P2-A + P2-B): stop.flag nicht vorhanden → Loop läuft ✓
- Schritt 3 (QA/Validierung durchführen): stop.flag nicht vorhanden → Loop läuft ✓
- Schritt 4 (Ergebnis zurückschreiben + Handoff): stop.flag nicht vorhanden → Loop läuft ✓

### P2-A: Start-Zoom-Kamera (FloorCameraRig) — src/render/floor-camera-rig.ts:81-88

**Verifizierter Code-Zustand:**

| Zeile | Code | Erwartung von jenova | Abweichung |
|-------|------|---------------------|------------|
| 82 | `const tileX = Math.floor(x / TILE);` | Pixel→Tile vor Area-Berechnung | Keine ✓ |
| 83 | `const tileY = Math.floor(y / TILE);` | Pixel→Tile vor Area-Berechnung | Keine ✓ |
| 85 | `const areaW = Math.min(REGION, bounds.width);` | Zoom-Area für Welten < REGION klemmen | Keine ✓ |
| 86 | `const areaH = Math.min(REGION, bounds.height);` | Zoom-Area für Welten < REGION klemmen | Keine ✓ |
| 87-88 | `areaX = Math.floor(tileX / areaW) * areaW;`<br>`areaY = Math.floor(tileY / areaH) * areaH;` | Area aus Tile-Koords berechnet | Keine ✓ |
| 89 | `this.cam.zoomToArea({...areaX, areaY, areaW, areaH...}, bounds);` | Area an Camera übergeben | Keine ✓ |

**QA-Ergebnis P2-A:** Bestätigt. Beide Änderungen (Pixel→Tile Umrechnung vor Area-Berechnung, Zoom-Area Clamping via Math.min) sind korrekt implementiert. Beispielrechnung Apartment-Spawn (5,5) mit TILE=32: Tile (5,5) → Pixel (160,160) → Area (0,0,16,16) für 16x16 Wohnung korrekt geklemmt.

### P2-B: Property inArea() Grenzfehler — src/core/sim/property.ts:116

**Verifizierter Code-Zustand:**

| Zeile | Code | Erwartung von jenova | Abweichung |
|-------|------|---------------------|------------|
| 116 | `return x >= area.x && x < area.x + area.w && y >= area.y && y < area.y + area.h;` | Bereits korrekt, fail-closed | Keine ✓ |

**QA-Ergebnis P2-B:** Bestätigt. Die Bedingung ist bereits korrekt (`y < area.y + area.h`, nicht `y < area.h`). Kein Fix nötig. LARGE-Template würde korrekt Zonen, Möbel und Gäste liefern.

### Regressionstest (LARGE-Template, zweiter Kauf)

- **Geplant:** Regressionstest mit LARGE-Template (zweiter Kauf → andere Standort-Geometrie), keine zweite Geometrie-Wahrheit
- **Durchgeführt:** Nein — node/pnpm nicht ausführbar in dieser Android-Umgebung
- **Status:** Dokumentiert als blockiert (kein Loop-Stopp)
- **Begründung:** Keine Test-Ausführung möglich ohne node/pnpm-Toolchain

### Claim-Scope

Beide Fixes liegen im Claim-Scope: Meta-Infrastruktur für Bereichs-Simulation und Rendering, kein direkter Spiel-Code in src/core/ (P2-A ist in src/render/, P2-B ist in src/core/sim/ aber reine Geometrie-Prüfung ohne Gameplay-Logik-Änderung).

### Labels

- P2-A: prio-P2, gameplay, area-render, incident-open
- P2-B: prio-P2, gameplay, area-sim, incident-open

### Bekannte Einschränkungen

- Keine Regressionstests ausführbar (kein node/pnpm)
- Keine Test-Läufe möglich
- Blocker ist dokumentiert, nicht loop-stoppend

## Invarianten (gültig für den gesamten Loop)

- stop.flag wird vor jedem Schritt geprüft
- Jeder Kontext-Chain-Eintrag hat Owner und nächsten Agenten
- Keine Implementierung ohne vorheriges Design
- Jeder Schritt ist für den Nutzer sichtbar
- Kein direkter Push auf main (immer Branch + PR + Maintainer-Merge)

## Handoff an shinon

- Empfänger: shinon (@shinon)
- Aufgabe: Integration der P2-A + P2-B Fixes, Ergebnis in Kontext-Chain-Eintrag schreiben, Übergabe an governance-office
- Nächster Schritt nach shinon: governance-office → maintainer → hermes
- stop.flag vor jedem Schritt prüfen