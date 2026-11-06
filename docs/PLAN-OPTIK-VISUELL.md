# Plan: Werkstatt und Abschluss

**Status:** Phase 5 umgesetzt; Phase 6 in Abnahme (Plan unten)
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
| 6/6 | Abschluss: visuelle Abnahme, Gerätetest, Release | **Abnahmeplan steht; A1 bestanden, A2–A8 offen** |

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
| Sichtprüfung des Floor-Grundbilds | Ja, 1024×768 am 2026-11-06 | Werkstatt, Spiegel und Touch noch nicht geöffnet |
| `verify:all` | Ja, 12/12 Gates grün am 2026-11-06 | — |

---

## 5. Bewusst nicht enthalten

- Keine neue Spielmechanik, keine Ledger-, RNG- oder Save-Änderung.
- Keine zweite FPS-Simulation und keine neue Uhr.
- Kein zweiter Charaktereditor und keine Kopie der vier Panels.
- Keine zwölfte Dokumentation; dieser Plan ersetzt den alten.
- Kein neues Bild-Asset für den Spiegel.

---

## 6. Phase 6 — Abnahmeplan

### 6.1 Ausgangsbild

Am 2026-11-06 nach dem Szenen-Cache-Fix im Cloud-Browser bei 1024×768 geprüft:
Der Floor rendert, HUD (Hauskonto, Gäste, Ruf), Warnzeile, Toast, Kamera-FIT,
die Aktion `PUTZEN` und die vier Tabs `BAUEN`, `GÄSTE`, `KARTE` und `DU` sind
da. Die Konsole zeigt nur die erwarteten Autoplay-Warnungen; der Ladebildschirm
ist weg. Der Floor steht als zentrierter Ausschnitt im Canvas, nicht randfüllend.
Werkstatt, Spiegel und Touch-Pfade wurden noch nicht geöffnet.

### 6.2 Prüfmatrix

| ID | Prüfung | Nachweis | Stand |
| --- | --- | --- | --- |
| A1 | **Desktop-Grundbild:** Start ohne Ladefehler, HUD, Warnzeile, Toast, vier Tabs; Konsole ohne Fehler außer Autoplay | Screenshot + Konsole | **bestanden** am 2026-11-06, 1024×768 |
| A2 | **Werkstatt-Einstieg:** genau zwei Wege (5× Marke, `Strg+Shift+D`), kein sichtbarer Knopf, ein Rahmen | Screenshot beider Wege | offen |
| A3 | **Sechs Ziele:** Prüfung, Protokoll, Assets, Sound, Steuerung, FPS; vier Panels ohne zweiten Shell; kein Charakter-Tab | Klickrunde | offen |
| A4 | **Spiegel:** genau ein `SPIEGEL` in der Lagerzone, Aktion öffnet den Look-Editor, Save/Load erhält ihn | Browser + Save-Roundtrip | offen |
| A5 | **FPS:** echte `requestAnimationFrame`-Frames über 500 ms; keine GPU-Behauptung | Panel + Gegenprobe | offen |
| A6 | **Touch:** Ein-Finger-Pan ab 8 px, Tap-to-Frame in einem Frame, Aktionskarte, 60 fps beim Jackpot mit neun Gästen | echtes Android-Gerät, Frame-Aufzeichnung | offen, braucht Hardware |
| A7 | **Hülle und Performance:** Safe Areas, Hochformat, First-Frame-Handshake, Haptik, Musik nach Geste; Slow 4G (1,6 Mbit/s); Atlas-Requests | Gerät + Drosselung | teilweise: 9 Mbit/s mit 20 Requests/2,51 s gemessen, Debug-APK liegt vor |
| A8 | **Release:** Debug- und Release-APK per `adb install`, `verify:all` 12/12 auf dem Tag-Commit, Tag und Notes, aktuelle Screenshots unter `docs/` | CI-Lauf + Gerät | offen |

### 6.3 Reihenfolge

1. **A1–A5 am Desktop.** Das ist ohne Hardware möglich und deckt Werkstatt,
   Spiegel und FPS ab.
2. **A6–A7 auf einem echten Android-Gerät.** Emulator zählt nicht als Nachweis
   für Frame-Zeit, Gesten oder Haptik.
3. **A8 erst danach.** Kein Release-Tag, solange eine Zeile offen ist.

### 6.4 Exit

Phase 6 ist abgeschlossen, wenn jede Zeile `bestanden` oder `bewusst verworfen`
mit Grund ist, kein offenes `gate-failure`-Issue existiert und der Tag-Commit
`verify:all` mit 12/12 trägt. Die alten Screenshots unter
`docs/screenshots/current/` werden dabei durch Aufnahmen dieses Stands ersetzt;
die Aufnahmen gehören in denselben Commit wie der Planabschluss.

### 6.5 Bewusst nicht Teil von Phase 6

- Keine neue Spielmechanik, keine Ledger-, RNG- oder Save-Änderung.
- Keine GPU-Telemetrie und kein zweiter FPS-Zähler.
- Kein neues Bild-Asset für den Spiegel.
- Keine zwölfte Dokumentation; dieser Plan bleibt der einzige Ort.
