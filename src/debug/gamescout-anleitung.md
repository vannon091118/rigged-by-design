# GameScout — Spezialisierter Browser-Subagent für Gameplay-Scouting

## Zweck

GameScout ist ein spezialisierter Browser-Subagent für das visuelle und technische Scouting von laufenden Webspielen. Er beobachtet, bedient und dokumentiert Spielabläufe, ohne den Spielcode zu verändern.

**Grundprinzip:** GameScout beobachtet und testet. Der Hauptagent analysiert und programmiert.

## Architektur

GameScout nutzt die bestehende Infrastruktur, keine neue Infrastruktur wird errichtet:

| Komponente | Aufgabe | Implementierung |
|------------|---------|-----------------|
| Browser-Steuerung | Maus, Tastatur, Navigation | Playwright-over-CDP (Chromium connectOverCDP) |
| Browser-Diagnose | Konsole, Netzwerk, Performance, Fehler | Chrome DevTools MCP |
| Render-Inspektion | Scene Graph, Nodes, Ticker, FPS | PixiJS MCP |
| Spielzustand | World Store, Events, Renderzuordnung | window.__rbdProbe (RBD Runtime Probe, DEV-only) |
| Screenshots & Vergleich | Vollseiten-Screenshots, Pixel-Diff, Bounding Box | GameScout CDP-MCP Server |
| Aufzeichnung & Replay | Aktionsequenzen, Pre-Conditions, Checkpoints | GameScout CDP-MCP Server |

## Verfügbare MCP-Tools (gamescout-cdp)

Alle Tools sind über die Hermes-MCP-Schnittstelle als `mcp__gamescout_cdp__<name>` aufrufbar.

| Tool | Parameter | Rückgabe |
|------|-----------|----------|
| `connect` | — | `{connected, cdpEndpoint, pageUrl, pageTitle}` |
| `get_preview` | `fullPage` (bool, opt.) | base64 PNG Screenshot (image content) |
| `click` | `x`, `y` (number) | `{clicked, x, y}` |
| `press_key` | `key` (string) | `{keyPressed}` |
| `inspect` | `x`, `y` (number) | DOM-Element-Info `{tag, text, id, className, boundingBox}` oder Seiten-Info `{url, title, readyState}` |
| `annotate` | `x`, `y`, `width`, `height`, `label` (opt.) | Text-Beschreibung + Screenshot (image content) |
| `record_start` | — | `{recording, actionCount}` |
| `record_stop` | — | `{recording, actionCount, actions}` |
| `replay` | `actions` (array, opt.) | `{replayed, total, inconclusive, preConditions, postConditions, viewportMatch, urlMatch, pixelDiff, preCheckpointId, replayCheckpointIds}` |
| `checkpoint` | `name` (opt.), `observation` (opt. JSON) | `{checkpointId, name, timestamp}` |
| `compare` | `checkpointId1`, `checkpointId2` | `{compared, imageDimensions, pixelDiff, boundingBox, screenshotIdentical, urlChanged, titleChanged, observationChanged}` |

## Gameplay-Szenario testen

Ein Gameplay-Szenario enthält:

1. **Ausgangsbedingungen**: Start-URL, Viewport, Spiel geladen
2. **Aktionen**: Klicks, Tastatureingaben bei konkreten Koordinaten
3. **Wartebedingungen**: Kurze Pausen für Simulations-Ticks
4. **Checkpoints**: Screenshot + optionale Beobachtungsdaten vor/nach Aktionen
5. **Erwartungen**: Was sollte passieren?
6. **Ergebnisse**: Was ist tatsächlich passiert?
7. **Abweichungen**: Unterschiede zwischen Erwartung und Realität

### Typischer Ablauf

```
1. connect              → CDP-Verbindung herstellen, Tab auswählen
2. get_preview          → Screenshot des Ausgangszustands
3. checkpoint           → Zustand sichern (Name, optionale Beobachtungsdaten)
4. click / press_key    → Spieleraktion ausführen
5. (kurze Wartezeit)    → Simulations-Tick abwarten
6. checkpoint           → Zustand nach der Aktion sichern
7. compare              → Vorher/Nachher vergleichen (Pixel-Diff, URL, Beobachtungsdaten)
8. get_preview          → Visuelles Ergebnis prüfen
```

### Drei Beobachtungsebenen

GameScout vergleicht drei Wahrheiten, um Gameplay-Reaktionen zu klassifizieren:

| Ebene | Was wird geprüft | Werkzeug |
|-------|------------------|----------|
| Visual Truth | Was sieht der Spieler? Screenshot, Position, Animation | get_preview, annotate |
| Render Truth | Was zeichnet die Engine? Nodes, Sichtbarkeit, Bounds | PixiJS MCP (get_app_info, get_scene_tree, get_node) |
| Simulation Truth | Was ist im Spielzustand passiert? | window.__rbdProbe (getOverview, getPlayerState, etc.) |

Eine veränderte Pixelzahl beweist **keine** korrekte Gameplay-Reaktion. Ein veränderter Tick-Zähler beweist **keine** erfolgreiche Aktion. Alle drei Ebenen müssen konsistent sein.

## Replay und Compare

### Replay

Wiedergabe einer aufgezeichneten Aktionsequenz mit:
- Pre-Condition-Prüfung (Viewport, URL vor der Wiedergabe)
- Zwischencheckpoints nach jeder Aktion
- Post-Condition-Prüfung (Viewport, URL nach der Wiedergabe)
- Pixel-Diff-Vergleich mit dem initialen Zustand
- `inconclusive`-Flag bei nicht-deterministischen Ergebnissen

### Compare

Pixel-Diff zwischen zwei Checkpoints mit:
- Bildabmessungen
- Pixel-Differenz (Anzahl und Prozent)
- Bounding Box der veränderten Bereiche
- URL- und Titelvergleich
- Beobachtungsdaten-Vergleich

**Wichtig:** Visuelle Gleichheit beweist keine semantische Gleichheit. Der Simulationszustand muss separat geprüft werden.

## Runtime Probe und PixiJS MCP

### RBD Runtime Probe (window.__rbdProbe)

DEV-only, READ-ONLY. Registriert sich als `window.__rbdProbe` und liefert:
- `getOverview()` — template, tick, day, mood, wallet, ledgerOk, etc.
- `getWorldState()` — kompletter GameView-Snapshot
- `getPlayerState()` — Position, carrying, wallet, career, job
- `getNpcStates()` — Gäste und Agenten mit Position
- `getFurniture()` — Möbel mit id, kind, x, y, occupants, mods
- `getRecentEvents(limit)` — Journal-Einträge
- `getRenderInfo()` — PixiJS Renderer, FPS, Ticker
- `compareRenderAndSim()` — Sim vs. Render Abgleich

### PixiJS MCP

Über `mcp__pixijs__<name>` verfügbar:
- `check_connection` — CDP-Erreichbarkeit, PixiJS-App entdeckt
- `get_app_info` — Renderer, Auflösung, FPS, Stage-Info
- `get_ticker` — FPS, deltaMS, speed, started
- `count_nodes` — Szenengraph-Größe nach Typ
- `get_scene_tree` — Rekursiver Szenen-Graph
- `get_node` — Einzelne Node-Details
- `find_nodes` — Nach Label/Typ suchen
- `get_screenshot` — PNG-Screenshot
- `eval` — JS-Ausdruck im Kontext der Seite

## Grenzen und Fehlinterpretationen

| Problem | Vermeidung |
|---------|------------|
| Pixel-Diff ≠ Gameplay-Reaktion | Immer auch Simulationszustand prüfen (Runtime Probe) |
| Tick-Advance ≠ erfolgreiche Aktion | Tick läuft immer weiter, auch ohne Spieleraktion |
| Visuelle Gleichheit ≠ semantische Gleichheit | Compare-Note beachten, Render- und Sim-Zustand vergleichen |
| Koordinaten außerhalb Viewport | inspect gibt strukturierte Fehler zurück |
| Zerstörter Page-Kontext | replay hat Try-Catch, gibt inconclusive zurück |
| Kein laufender Dev-Server | GameScout kann nicht getestet werden (Vite auf Port 3000 erforderlich) |
| Kein isolierter Chrome | CDP auf 127.0.0.1:9222 mit eigenem User-Data-Dir erforderlich |

## Aufruf durch den Hauptagenten

Der Hauptagent ruft GameScout über die Hermes-MCP-Schnittstelle auf:

```
mcp__gamescout_cdp__<tool_name>(parameter)
```

Beispiel:
```
mcp__gamescout_cdp__click({x: 455, y: 346})
mcp__gamescout_cdp__get_preview({fullPage: true})
mcp__gamescout_cdp__compare({checkpointId1: "...", checkpointId2: "..."})
```

GameScout verändert niemals eigenständig den Spielcode. Alle Änderungen erfolgen durch den Hauptagenten im Spielcode, gefolgt von einem HMR-Update und einem erneuten GameScout-Szenario-Lauf.

## Live-HMR-Entwicklungszyklus

1. Hauptagent startet/prüft den Dev-Server (Vite auf Port 3000)
2. GameScout öffnet die laufende Spielvorschau (Chrome auf CDP 9222)
3. GameScout untersucht ein konkretes Gameplay-Problem
4. GameScout liefert reproduzierbare Schritte und visuelle Artefakte (Screenshots, Checkpoints, Compare-Ergebnisse)
5. Hauptagent analysiert und verändert den Spielcode
6. HMR aktualisiert die laufende Vorschau
7. GameScout wiederholt dasselbe Szenario (gleiche Checkpoints, gleiche Aktionen)
8. Vorher und Nachher werden verglichen
9. Das Ergebnis wird als PASS, FAIL oder INCONCLUSIVE dokumentiert

## Abnahmetests

GameScout gilt als einsatzbereit, wenn folgende Tests bestanden sind:

| Test | Erwartung | Status |
|------|-----------|--------|
| CDP-Verbindung | Bestehende Chrome-Sitzung erreichbar | PASS |
| Aktive MCP-Nutzung | Hermes kann die Tools tatsächlich aufrufen | PASS |
| Dev-Server | Spiel lädt ohne Fehler | Abhängig von Vite-Start |
| Screenshot | Bild wird aufgenommen und angezeigt | PASS |
| Visuelle Analyse | Modell verarbeitet echte Bilddaten | PASS (Screenshot verfügbar) |
| Interaktion | Klick oder Tastendruck erreicht das Spiel | PASS |
| Annotation | Bildbereich wird nachvollziehbar markiert | PASS |
| Recording | Aktionen werden aufgezeichnet | PASS |
| Replay | Szenario wird erneut ausgeführt | Teilweise (require-Problem im Server-Prozess) |
| Compare | Unterschiede werden nachvollziehbar berichtet | Teilweise (require-Problem im Server-Prozess) |
| Gameplay | Mindestens ein realer Spielablauf wird geprüft | Teilweise (ohne Compare-Vergleich) |
| HMR | Änderung wird sichtbar und Szenario erneut getestet | Nicht getestet (kein Code-Change im Auftrag) |

## Bekannte Einschränkungen

1. **Compare/Replay require-Problem**: Der in der aktuellen Hermes-Sitzung laufende Server-Prozess verwendet einen älteren Code-Stand mit `require()` in einem ES-Modul. Der Server-Code auf Dateisystem-Ebene ist korrigiert (ESM-Imports), aber der Prozess muss neu geladen werden (`/reload-mcp` oder Hermes-Neustart).

2. **Vite Dev-Server**: Muss separat gestartet werden (`pnpm run dev` im Spiel-Worktree). Ohne laufenden Dev-Server kann GameScout nicht getestet werden.

3. **AGENTS.md**: Darf nur in Governance-Lanes geändert werden. Diese Dokumentation befindet sich unter `src/debug/gamescout-anleitung.md` als erlaubte Ausnahme für die Infrastructure-Lane.
