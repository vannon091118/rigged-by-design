# Plan: Werkstatt und Abschluss

**Status:** Phase 5/6 umgesetzt; Phase 6 offen
**Datum:** 2026-11-06
**Ersetzt:** den früheren 5-Phasen-Optikplan, gleicher Dateiname
**Grundsatz:** keine zwölfte Doku. Dieser Plan bleibt der einzige Ort für den visuellen Abschluss.

---

## 1. Ziel

Der Floor ist spielbar, die Etage hat Licht und Textur, und die wichtigsten Fenster
sind erreichbar. Was fehlt, ist ein ruhiger Abschluss: eine Werkstatt, die Technik
und Buchhaltung bündelt, ohne den Floor mit Knöpfen zu verstopfen. Der
Charaktereditor gehört dorthin, wo er erzählerisch hingehört: an einen Spiegel im
Lager, nicht an einen Tab.

Die Änderung bleibt Darstellung und Bedienung. Simulation, Ledger, RNG und
Save-Format werden nicht angefasst.

---

## 2. Sechs Phasen

| Phase | Inhalt | Stand |
| --- | --- | --- |
| 1/6 | HUD, Dock und vier Hauptbereiche statt Werkzeugwand | umgesetzt |
| 2/6 | Floor mit Texturen, Licht, Tiefe und Figuren | umgesetzt |
| 3/6 | Ereignisse, Partikel, Sound und Game Feel | umgesetzt |
| 4/6 | Mobile Hülle, Safe Areas, Performance-Governor, APK | umgesetzt |
| 5/6 | Werkstatt-Raster, versteckter Einstieg und Spiegel | **umgesetzt in diesem Schritt** |
| 6/6 | Abschluss: visuelle Abnahme, Gerätetest, Release | offen |

---

## 3. Phase 5 im Detail

### Werkstatt

`src/ui/workshop.tsx` ist der Rahmen: eine `PopupShell`, ein Raster und genau ein
aktiver Bereich. `src/ui/workshop-parts.tsx` liefert die Rasterkarte, die
Steuerungsliste und die FPS-Messung.

Das Raster hat sechs Ziele:

1. **Prüfung** — Buchhaltung, Personal, Lager und Nachfrage
2. **Protokoll** — Live-Puffer und Archiv mit Ursache und Folge
3. **Assets** — Texturen, Frames, Emitter und Tonspuren
4. **Sound** — Master, Musik und getrennte Kanäle
5. **Steuerung** — Klick, Tastatur, Maus und Touch
6. **FPS** — Browser-Frame-Takt im halben Sekundenfenster

Die Inhalte von `diagnostics-popup`, `journal-popup`, `asset-library-popup` und
`sound-popup` werden nicht neu geschrieben. Jede Datei exportiert jetzt ein
`…Panel` ohne eigenen Rahmen; die nicht mehr erreichbaren alten Popup-Hüllen sind
entfernt. Die Werkstatt setzt dieselben Panels in ihren einen Rahmen.

### Einstieg

- **5× Tippen auf die Marke** im HUD; der Zähler liegt in `dock.tsx` (`useBrandTaps`).
- **Strg+Shift+D** als Tastaturweg.
- Kein sichtbarer Button, kein neuer Dock-Tab.
- Die Marke bleibt auch auf schmalen Geräten sichtbar; unter 860 px nur noch als
  `R`-Zeichen, damit der Touch-Einstieg nicht verschwindet.

### Charakter als Spiegel

- `SPIEGEL` ist ein echtes `DECOR`-Objekt im Katalog.
- Jede Hausvorlage stellt einen Spiegel in die Lagerzone; der Startbestand wächst
  dadurch um genau ein Möbelstück.
- Die Aktion `SPIEGEL` auf dem Floor öffnet den vorhandenen `LookPopup`.
- Der Werkstatt-Tab „Charakter“ und `WorkshopTool = 'look'` fallen weg. Der
  Charaktereditor ist nur noch über den Spiegel erreichbar.
- Für den Spiegel gibt es kein neues Bild-Asset. Der Korpus wird wie die übrige
  Deko prozedural gezeichnet; der stabile Label-Schlüssel verhindert, dass er sich
  eine gebackene Textur mit einer Pflanze teilt.

### FPS

Die Anzeige misst echte `requestAnimationFrame`-Frames über 500 ms. Sie zeigt
Ziel, Frame-Zeit und Fenster, aber keinen erfundenen Renderer-Tiefenwert. Der Wert
ist ein Oberflächen-Indikator, kein Benchmark der Simulation.

---

## 4. Umsetzt / offen

| Punkt | Umgesetzt | Offen |
| --- | --- | --- |
| Sechs Werkstattziele | Ja | — |
| Wiederverwendung der vier Popup-Inhalte | Ja, als Panels | — |
| Versteckter Einstieg über Marke und Strg+Shift+D | Ja | Fünf-Tipp-Geste auf echtem Touch-Gerät nicht geprüft |
| Charaktereditor über Spiegel im Lager | Ja | Spiegelgrafik ist prozedural, kein eigenes Asset |
| Werkstatt-Tab „Charakter“ entfernt | Ja | — |
| FPS-Anzeige | Ja, Browser-Frame-Takt | Kein Pixi-/GPU-Telemetriewert |
| Gerät und Hilfe weiterhin erreichbar | Ja, als sekundäre Werkzeuge | — |
| APK und realer Gerätetest | APK aus Phase 4 vorhanden | Nicht auf Hardware installiert |
| Sichtprüfung der neuen Werkstatt | Nein | Braucht Browser oder Gerät |
| `verify:all` | Ja, 12/12 Gates grün am 2026-11-06 | — |

---

## 5. Bewusst nicht enthalten

- Keine neue Spielmechanik, keine Ledger-, RNG- oder Save-Änderung.
- Keine zweite FPS-Simulation und keine neue Uhr.
- Kein zweiter Charaktereditor und keine Kopie der vier Panels.
- Keine zwölfte Dokumentation; dieser Plan ersetzt den alten.
- Kein neues Bild-Asset für den Spiegel.

---

## 6. Exit-Kriterium

Die Werkstatt öffnet sich ausschließlich über die Marke oder `Strg+Shift+D`, zeigt
sechs ehrliche Bereiche, und der Charaktereditor ist vom Spiegel im Lager aus
erreichbar. `typecheck`, `check:loc`, `verify:docs`, die fokussierten Tests und
`verify:all` müssen grün sein. Die visuelle und haptische Abnahme auf einem echten
Gerät bleibt Phase 6.
