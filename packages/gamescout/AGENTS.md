# GameScout — Agent-Anleitung

Dies ist die zentrale Anleitung für Coding-Agents, die GameScout zur visuellen und technischen Untersuchung eines laufenden Web-Spiels verwenden.

## Wann GameScout eingesetzt wird

GameScout ist für das **Beobachten, Testen und Dokumentieren** von Gameplay zuständig — nicht für Code-Änderungen.

Typische Einsatzszenarien:

- Ein NPC reagiert nicht auf eine Interaktion — sichtbar oder unsichtbar.
- Eine Animation wird nicht abgespielt oder bleibt hängen.
- Ein Klick auf ein UI-Element hat keine erkennbare Wirkung.
- Der Simulationszustand und der Renderzustand weichen voneinander ab.
- Ein Bug soll reproduziert werden, bevor der Hauptagent den Code ändert.

**Nicht** GameScout verwenden für:

- Änderungen an Spielmechaniken, Geschäftlogik oder Render-Code.
- Manipulation von Spielzuständen (Geld, NPC-Positionen, Inventar).
- Automatisierte Klicksequenzen ohne visuelle Validierung.

## Drei Beobachtungsebenen

GameScout trennt strikt zwischen drei Ebenen. Ein Agent muss stets prüfen, ob alle drei übereinstimmen:

| Ebene | Was wird geprüft | Werkzeug |
|-------|-----------------|----------|
| **Visual Truth** | Was der Spieler sieht (Screenshot, sichtbare Objekte, Annotationen) | Browser MCP (`get_preview`, `inspect`, `annotate`) |
| **Render Truth** | Was die Render-Engine rendert (PixiJS Scene Tree, Display Objects, Ticker, FPS) | PixiJS MCP |
| **Simulation Truth** | Was im internen Spielzustand steht (World Store, NPC-Zustände, Ereignisse) | RBD Runtime Probe (`window.__rbdProbe`) |

**Grundsatz:** Eine Aktion gilt erst als erfolgreich, wenn alle drei Ebenen die erwartete Reaktion zeigen. Eine veränderte Pixelzahl allein beweist keine korrekte Gameplay-Reaktion. Ein veränderter Tick-Zähler allein beweist keine erfolgreiche Aktion.

## Zustände unterscheiden

Nach jeder Aktion muss der Agent zwischen folgenden Zuständen unterscheiden:

1. **Aktion wurde nicht ausgelöst** — MCP-Call Fehler, Timeout, kein Connect.
2. **Aktion wurde ausgelöst, aber nicht verarbeitet** — Browser hat empfangen, Spiel hat nicht reagiert.
3. **Interne Verarbeitung war erfolgreich** — Simulation hat Zustand geändert (Runtime Probe).
4. **Renderreaktion fehlt oder ist fehlerhaft** — Simulation OK, aber nichts verändert sich sichtbar.
5. **Sichtbare Reaktion ist korrekt** — Alle drei Ebenen zeigen die erwartete Reaktion.
6. **Ergebnis ist nicht eindeutig** — Weitere Beobachtung nötig (Wartezeit, zweiter Screenshot, Checkpoint-Vergleich).

## Wie der Agent GameScout aufruft

GameScout stellt MCP-Tools über STDIO bereit. Der Agent ruft sie über den MCP-Client seines Hosts auf.

### Voraussetzungen

1. Chromium läuft mit Remote Debugging auf `http://127.0.0.1:9222` (isoliertes User-Data-Verzeichnis).
2. Das Spiel läuft im Browser (z.B. `http://localhost:3000/` via Vite Dev-Server).
3. GameScout ist gestartet: `npx gamescout start` (verbindet sich zum bestehenden Chrome, erstellt Dashboard-Tab).

### MCP-Tools (alle über `gamescout` Server)

| Tool | Parameter | Rückgabe |
|------|-----------|----------|
| `connect` | — | Verbindungsstatus, gefundene Tabs |
| `get_preview` | `{ fullPage?: boolean }` | Base64-Screenshot, MIME-Type |
| `click` | `{ x: number, y: number }` | `{ clicked: true, x, y }` |
| `press_key` | `{ key: string }` | `{ pressed: true, key }` |
| `inspect` | `{ x: number, y: number }` | DOM-Info (tag, text, id, className, boundingBox) |
| `annotate` | `{ x, y, width, height, label }` | Annotations-ID |
| `record_start` | — | `{ recording: true }` |
| `record_stop` | — | Aufgelistete Aktionen |
| `replay` | `{ actions: [...] }` | `{ replayed: N, result, inconclusive? }` |
| `checkpoint` | `{ name?, observation? }` | Checkpoint mit Screenshot + Beobachtungen |
| `compare` | `{ cp1Id, cp2Id }` | Pixel-Diff, Bounding Box, Änderungen |

### Beispiel-Workflow

```
1. connect                        → Verbindung zu Chrome, Spiel-Tab erkannt
2. get_preview                    → Screenshot des aktuellen Zustands
3. click { x: 150, y: 200 }       → Klick auf Spiel-Element
4. get_preview                    → Screenshot nach Klick
5. compare { cp1, cp2 }           → Pixel-Diff zwischen Vorher/Nachher
6. Runtime Probe (getOverview)    → Simulationszustand prüfen
7. Entscheid: PASS / FAIL / INCONCLUSIVE
```

## Screenshots und Annotationen

- **Screenshots** (`get_preview`) sind die primäre visuelle Beweismittel. Immer Vorher-Nachher paare erstellen.
- **Annotationen** (`annotate`) markieren rechteckige Bereiche auf dem Screenshot (z.B. "NPC hier", "Fehlender Button"). Sie werden im Dashboard und in Checkpoints festgehalten.
- **Checkpoints** (`checkpoint`) speichern Screenshot + Beobachtungsdaten + URL + Zeitstempel. Sie sind die Basis für `compare`.

## Replay und Compare

- **Replay** (`replay`) führt eine aufgezeichnete Aktionliste erneut aus. Pre-Conditions (URL, Viewport) werden geprüft. Nichtdeterministische Ergebnisse werden als `inconclusive` markiert.
- **Compare** (`compare`) vergleicht zwei Checkpoints pixelgenau (pngjs + pixelmatch). Liefert Pixel-Differenz, veränderte Bereiche (Bounding Box), URL-/Viewport-Änderungen.

**Wichtig:** Pixelgleichheit beweist keine semantische Gleichheit. Eine Animation kann pixelgleich aussehen, aber den falschen Zustand haben. Immer die Simulation Truth (Runtime Probe) zusätzlich prüfen.

## Runtime Probe und PixiJS MCP

Die **RBD Runtime Probe** (`window.__rbdProbe`) ist eine DEV-only, READ-ONLY Diagnoseoberfläche im Spiel. Sie liefert:

- `getOverview()` — Spielübersicht
- `getPlayerState()` — Spielerzustand
- `getNpcStates()` — NPC-Zustände
- `getFurniture()` — Möbel und interaktive Objekte
- `getRecentEvents()` — Jüngste Ereignisse
- `compareRenderAndSim()` — Abgleich Render vs. Simulation

Die **PixiJS MCP** liefert Render-Daten (Scene Tree, Nodes, Ticker, FPS). Beide sind **optional** — GameScout funktioniert auch ohne sie, aber mit ihnen sind alle drei Beobachtungsebenen abgedeckt.

## Grenzen und Fehlinterpretationen

Vermeide diese Fehler:

- **Keine grünen Testergebnisse allein aufgrund erfolgreicher Funktionsaufrufe.** Ein MCP-Call kann erfolgreich sein, ohne dass das Spiel reagiert.
- **Keine blind vorgegebenen Klicksequenzen.** Jede Aktion muss auf einer echten Beobachtung basieren.
- **Keine erfundenen NPC-Zahlen, FPS-Werte oder Simulationszustände.** Wenn eine Information nicht verfügbar ist, muss das ausdrücklich gekennzeichnet werden.
- **Keine Annahme, dass visuelle Ähnlichkeit semantische Gleichheit bedeutet.** Pixel-Diffs sind ein Hinweis, kein Urteil.
- **Keine dauerhaften Spielstände verändern.** GameScout ist READ-ONLY bezüglich des Spiels (außer harmlose Test-Inputs wie Tastendruck auf leere Fläche).

## MCP-Server Konfiguration (Hermes)

Der GameScout-MCP-Server ist in `~/.hermes/config.yaml` unter `mcp_servers.gamescout` registriert:

```yaml
gamescout:
  command: node
  args:
    - /pfad/zu/packages/gamescout/dist/mcp/server.js
  enabled: true
```

Nach einer Config-Änderung muss der aktive Hermes-Agent die MCP-Server neu laden (`/reload-mcp` im TUI oder Neustart).

## Startbefehle (Zusammenfassung)

```bash
# 1. Chromium mit CDP starten (isoliertes Profil, Port 9222)
chrome.exe --remote-debugging-port=9222 --user-data-dir=<isolierter-Ordner> http://localhost:3000

# 2. Vite Dev-Server starten (im Spiel-Projekt)
pnpm run dev

# 3. GameScout starten (verbindet sich zum bestehenden Chrome)
npx gamescout start

# 4. Diagnose
npx gamescout doctor
```

## FAIL-Closed Prinzip

GameScout meldet FAIL oder INCONCLUSIVE, wenn:

- Die CDP-Verbindung nicht aufgebaut werden kann.
- Das Spiel-Tab nicht gefunden wird.
- Ein Screenshot nicht aufgenommen werden kann.
- Eine Aktion keine erkennbare Reaktion auf allen drei Ebenen erzeugt.
- Ein Checkpoint-Vergleich unerwartete Unterschiede zeigt.

Ein bloß erfolgreicher MCP-Tool-Aufruf zählt **nicht** als bestandener Test.
