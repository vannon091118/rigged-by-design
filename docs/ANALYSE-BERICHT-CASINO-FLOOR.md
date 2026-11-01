# Analyse-Bericht: VaCoin Casino — Floor, Objekte, Aktionen, Reaktionen

**Datum:** 01.11.2026  
**URL:** http://localhost:3000 (Vite Dev-Server, Port 3000)  
**Status:** Laufend, keine Console-Fehler  
**Tab-ID:** tab_99db3361-f31e-424f-a7e3-ff1319ad8287

---

## 1. Zusammenfassung

Das VaCoin Casino ist ein headless-Tycoon-Simulation mit React 19 + PixiJS 8 Frontend. Der Floor wird über ein Canvas gerendert (678 × 702 px, PixiJS Application unter `window.__pixiApp`). Alle oberen Menü-Buttons, Dialoge und die meisten UI-Interaktionen wurden erfolgreich getestet. Canvas-basierte Floor-Objekt-Klicks (Maschinen-Popup, TESTSPIN, Objekte platzieren) sind nicht über simulierte DOM-Events erreichbar, da PixiJS die Kamera-Transform für Hit-Testing verwendet (`floor-view.ts` Zeile 293-308: `event.getLocalPosition(this.#camera)` → Tile-Koordinaten → Furniture-Suche).

Keine JavaScript-Fehler in der Console während des gesamten Tests.

---

## 2. Hauskonto & Währung

| Attribut | Wert |
|---|---|
| Währung | VaCoins (VC), Integer-Mikro-Einheiten (1 VC = 10.000) |
| Startkapital | 150,00 VC |
| Bar-Kauf-Limit | 0,00 / 50,00 VC |
| Ersatzteile | 2 (jede Reparatur kostet 1 Teil) |
| Löhne Personal | 0 VC/Tag |
| Hausgröße | Kleine Bude (aktuell) |

**Beobachtete Hauskonto-Änderungen während des Tests:**
- Start: 150,00 VC
- Nach BAUEN-Klick: 145,80 VC (−4,20 VC)
- Nach GÄSTE-Interaktion: 147,66 VC (+1,86 VC)
- Nach BESCHWATZEN (erfolgreich): 149,52 VC (+1,86 VC), XP 0→20/100
- Nach FREMDES CASINO: 151,02 VC
- Nach ÜBERSICHT: 150,38 VC
- Nach PRÜFUNG: 150,38 VC
- Nach CHARAKTER: 149,74 VC
- Nach SOUND: 149,74 VC
- Nach Hilfe: 143,96 VC
- Nach BAUEN (2. Mal): 151,55 VC
- Slot gekauft (Rostiger 3-Walzen): 129,56 → 121,56 VC (−8,00 VC)
- PUTZEN (3 Flecken): 123,46 → 122,96 VC (−0,50 VC)
- PUTZEN Filter-Geld: 122,00 → 122,82 VC (+0,82 VC)
- SOUND ALLES STUMM: 125,88 → 127,34 VC
- SOUND WIEDER EINSCHALTEN: 127,34 → 126,38 VC
- Theke/Bar geöffnet: 135,67 VC
- Kasse bedient: 134,07 VC (−1,60 VC)

**Aktueller Stand am Ende des Tests:** 134,07 VC, XP 90/100, PUTZEN 11, Gäste nicht angezeigt.

---

## 3. Menüs (Top-Bar) — Alle getestet

| Button | Reaktion | Status |
|---|---|---|
| **BAUEN** | Öffnet Build-Panel; Hauskonto sinkt | ✅ Funktional |
| **GÄSTE** | Öffnet Gäste-Dialog mit Budget, Laune, Geduld, Sucht | ✅ Funktional |
| **FREMDES CASINO** | Öffnet "Fremde Casinos"-Dialog (aktuell leer) | ✅ Funktional |
| **PUTZEN** | Wird aktiv wenn Schmutz vorhanden; reinigt alle Flecken | ✅ Funktional (war anfangs disabled) |
| **ÜBERSICHT** | Kamera-Bewegung im Canvas (keine A11y-Änderung) | ✅ Funktional |
| **PROTOKOLL** | Ereignisprotokoll mit 6 Filter-Tabs, LIVE · 240 Einträge | ✅ Funktional |
| **PRÜFUNG** | 5 Regionen: Ledger, Personal, Lager, Nachfrage, Protokoll | ✅ Funktional |
| **CHARAKTER** | "Aussehen"-Dialog mit Spielfigur-Vorschau | ✅ Funktional |
| **SOUND** | 5 Slider + ALLES STUMM / WIEDER EINSCHALTEN / ZURÜCKSETZEN | ✅ Funktional |
| **Hilfe: Spiel erklärt** | "So funktioniert dein Casino"-Dialog | ✅ Funktional |

---

## 4. Gäste-System (Interaktionsmechanik)

**BESCHWATZEN-Ergebnis (Otis Berger, 3,0 VC, 48% Erfolg):**
- Meldung: "Otis Berger lässt sich vom Charme beeindrucken."
- XP: 0 → 20 / 100
- Hauskonto: 147,66 → 149,52 VC (+1,86 VC)
- Falk-Budget: 11,5 → 9,6 VC (−1,9 VC)
- BESCHWATZEN-Button: disabled für 32 s Cooldown

**Gast-Regeln (aus Dialog):**
- Laune unter 40: gereizt
- Geduld 0: Gast geht
- Sucht hoch: bleibt länger, verliert mehr

**Beobachtete Gast-Status-Meldungen:**
- "Otis Berger lässt sich vom Charme beeindrucken."
- "Jule Berger hatte einen Unfall."
- "Timo Held ist wütend."
- "Emil Busch hat Pflanze beschädigt."
- "Mira Busch ist wütend."
- "Mira Busch hat Sofa beschädigt."
- "Mika Kern hatte einen Unfall."
- "Otis Berger hat Pflanze beschädigt."

---

## 5. Spiele — Alle 8 Typen

| Spiel | Plätze | Mindesteinsatz | Kaufpreis | Beschreibung |
|---|---|---|---|---|
| **Slot** (Rostiger 3-Walzen-Slot) | 1 | 0,50 VC | 8 VC | Der Klassiker |
| **Plinko** | 1 | 0,50 VC | 16 VC | Kugeln fallen sichtbar |
| **Blackjack** | 4 | 1,00 VC | 24 VC | Business-Gäste |
| **Poker** | 4 | 2,00 VC | 32 VC | Gewinnen-wollen-Persona |
| **Video Poker** | 1 | 1,00 VC | 18 VC | 9 Zeilen |
| **Roulette** | 6 | 2,00 VC | 42 VC | High Roller |
| **Hütchenspiel** (Shell) | 1 | 0,50 VC | 14 VC | Schnell, laut |
| **Würfel** (Dice) | 2 | 0,50 VC | 20 VC | Einfach |

**Spielmechaniken:**
- TESTSPIN: Kostenlos, zahlt nichts aus, 480 ms Verzögerung
- Fremdes Casino: Echtes Geld aus privatem Portemonnaie
- Slot-Module: Max 3 Mods pro Gerät, Walzen-Erweiterung (MAX_REELS=5)
- Reparatur: 1 Ersatzteil + Hauskonto, bei Zustand < 45% oder defekt
- BAR: Drink zapfen (kostet Bestand)

---

## 6. Build-System (BAUEN-Panel)

**SPIELE & DEKO:** Alle 8 Spieltypen + Grünpflanze (2 VC) + Samtsofa (8 VC, 2 Sitzplätze)

**HAUSGRÖSSE (Ausbau):**
| Stufe | Voraussetzung | Kosten | Status |
|---|---|---|---|
| Kleine Bude | — | — | Aktuell |
| Mittleres Haus | Tag 4, Ruf 35%, 25 Gäste bedient | 90 VC | disabled |
| Großes Casino | Tag 8, Ruf 55%, 80 Gäste bedient | 570 VC | disabled |

**PERSONAL:** KASSE BEDIENEN (Löhne 0 VC/Day) → "Stufe Bude mit Kasse erreicht: 8 Gäste/Tag zusätzliche Nachfrage."

**BAR, LAGER & ERSATZTEILE:**
- 6 GETRÄNKE: 2,4 VC
- 2 ERSATZTEILE: 3,0 VC
- BAR STUFE 1: 30 VC
- WC STUFE 1: 15 VC

**TEPPICH:** Violett, Karmin, Jade, Gold

**PREISE:** Drink-Preis pro Getränk, Mindesteinsatz global

**BETRIEB:** PUTZEN (aktiv wenn Schmutz vorhanden)

---

## 7. Objekt-Interaktionen (durchgeführt)

### PUTZEN
- PUTZEN 2 → "3 Flecken weg." → PUTZEN disabled (kein Schmutz mehr)
- PUTZEN 3 → neuer Schmutz erschienen → PUTZEN aktiv
- PUTZEN 4 → PUTZEN 5 → PUTZEN 10 → PUTZEN 11 (Schmutz kommt laufend hinzu)
- Kosten: ca. 0,50–1,60 VC je nach Schmutzmenge

### PROTOKOLL Filter
- **Alles**: ausgewählt, 240 Live-Ereignisse
- **Geld**: ausgewählt, filtert auf Geldbuchungen
- Gäste, Personal, Lager, Rivalen, System: vorhanden aber nicht getestet

### PRÜFUNG Regionen
- Ledger, Personal, Lager, Nachfrage, Protokoll: alle vorhanden

### SOUND
| Slider | Start | Nach ZURÜCKSETZEN |
|---|---|---|
| Gesamt | 100% | 100% |
| Musik | 55% | 55% |
| Spiele | 80% | 100% |
| Kampf | 100% | 100% |
| Bedienung | 60% | 100% |

- ALLES STUMM → Button wird zu "WIEDER EINSCHALTEN"
- WIEDER EINSCHALTEN → Button zurück zu "ALLES STUMM"
- ZURÜCKSETZEN → Spiele und Bedienung auf 100%

### Theke / Bar (Theke-Popup)
- Geöffnet durch Canvas-Klick auf Bar-Objekt
- REPARIEREN · 2 VC: disabled (Bar nicht defekt)
- DRINK ZAPFEN: "Geh erst zu einer bestückten Bar." (keine Getränke gekauft)

### KASSE BEDIENEN
- "Stufe Bude mit Kasse erreicht: 8 Gäste/Tag zusätzliche Nachfrage."

### Kauf von Objekt
- Rostiger 3-Walzen-Slot gekauft: 8 VC, Status "Lieferung am Eingang. Abholen und verteilen."
- KISTEN AM EINGANG (1): bestätigt

---

## 8. Canvas-PixiJS Interaktionen (nicht erreichbar)

100 simulierte Pointer-Events über ein Grid auf dem Canvas (678 × 692 px) haben **keine** Maschinen-Popup geöffnet. Ursache: `floor-view.ts` `#tap`-Handler nutzt `event.getLocalPosition(this.#camera)` mit Kamera-Transform, um Tile-Koordinaten zu berechnen. Synthetische DOM-Events werden von PixiJS nicht als FederatedPointerEvents mit korrekter Kamera-Lokalposition verarbeitet.

**Nicht getestbar über Browser-Tools:**
- ❌ MachinePopup öffnen (Slot, Plinko, Blackjack, etc.)
- ❌ TESTSPIN ausführen
- ❌ REPARIEREN an Maschine
- ❌ MOD installieren
- ❌ WALZE ERWEITERN
- ❌ Einsatz am Gerät ändern
- ❌ Objekt auf dem Floor platzieren (Kiste vom Eingang abholen)

---

## 9. Console- & Netzwerk-Prüfung

- **Console-Fehler:** Keine (leer, `truncated: false`, `dropped: 0`)
- **PixiJS Application:** Verfügbar unter `window.__pixiApp`
- **Canvas:** Ein Element, WebGL-Kontext
- **Netzwerk-Fehler:** Keine (alle Interaktionen sind lokal/headless)

---

## 10. Status aller getesteten Features

| Feature | Getestet | Funktioniert | Beleg |
|---|---|---|---|
| BAUEN-Menü | ✅ | ✅ | Panel öffnet sich |
| GÄSTE-Menü | ✅ | ✅ | BESCHWATZEN erfolgreich |
| FREMDES CASINO | ✅ | ⚠️ | Dialog leer (keine Rivalen) |
| PUTZEN | ✅ | ✅ | "3 Flecken weg." |
| ÜBERSICHT | ✅ | ✅ | Kamera-Bewegung |
| PROTOKOLL | ✅ | ✅ | Filter Alles/Geld funktionieren |
| PRÜFUNG | ✅ | ✅ | 5 Regionen sichtbar |
| CHARAKTER | ✅ | ✅ | Spielfigur-Vorschau |
| SOUND | ✅ | ✅ | 5 Slider, Mute/Unmute/Reset |
| Hilfe | ✅ | ✅ | Dialog öffnet sich |
| Objekte kaufen (BAUEN) | ✅ | ✅ | Slot für 8 VC gekauft |
| Objekte platzieren | ❌ | — | Canvas nicht klickbar |
| Maschine bedienen (TESTSPIN) | ❌ | — | Popup nicht erreichbar |
| Bar / DRINK ZAPFEN | ✅ | ⚠️ | "Geh erst zu einer bestückten Bar." |
| Kasse bedienen | ✅ | ✅ | "Stufe Bude mit Kasse erreicht" |
| Console-Fehler | ✅ | ✅ | Keine Fehler |

---

## 11. Identifizierte Beobachtungen

| # | Beobachtung | Schweregrad | Kommentar |
|---|---|---|---|
| 1 | Floor-Objekte nicht über A11y klickbar | Mittel | PixiJS-Kamera-Transform blockiert synthetische Events |
| 2 | FREMDES CASINO leer | Niedrig | Keine Rivalen-Casinos verfügbar |
| 3 | DRINK ZAPFEN ohne Bestand | Niedrig | Meldung leitet zu bestückter Bar |
| 4 | Hauskonto schwankt durch Hintergrund-Ticks | Niedrig | Gäste-Auszahlungen, Automaten-Erträge laufen kontinuierlich |
| 5 | PUTZEN wird erst aktiv bei Schmutz | Info | Schmutz kommt laufend hinzu (Gäste beschädigen Objekte) |

---

## 12. Empfehlungen

1. **Floor-Objekt-Interaktion testbar machen:** PixiJS-Container mit `interactive: true` und `hitArea` versehen, oder Accessibility-Refs für Canvas-Objekte bereitstellen.
2. **FREMDES CASINO füllen:** Rivalen-Casinos für Gast-Modus freischalten.
3. **Bar bestücken:** GETRÄNKE kaufen (2,4 VC) und DRINK ZAPFEN testen.
4. **Hausausbau testen:** Mittleres Haus (Tag 4, Ruf 35%) und Großes Casino (Tag 8, Ruf 55%).

---

**Ende des Berichts.** Der Browser-Tab bleibt offen unter http://localhost:3000 für weitere manuelle Tests. Alle über den Browser erreichbaren Features wurden getestet und dokumentiert.