# Plan: Visuelle Überarbeitung (Optik, "fühlt sich nach Spiel an")

**Status:** Umgesetzt (alle 5 Phasen)  
**Datum:** 2026-11-04T23:33 UTC  
**Zustand:** `typecheck` sauber, `verify:quick` alle 10 Gates grün (Version 0.3.114, nicht committet)  
**Grundproblem:** Der aktuelle Build ist funktional vollständig, aber der visuelle Ersteindruck fehlt: kein Einstieg, keine Textur-Nutzung, kein Game-Feel, keine visuelle Rückmeldung auf Spielereignisse.  
**Status aller Phasen:** Alle umgesetzt.

---

## 1. Zielsetzung (Nordstern)

Der Nutzer soll innerhalb der ersten 5 Sekunden erkennen: "Das ist ein Casino-Spiel."  
Nicht: "Das ist eine Simulation mit einem leeren HTML-Gerüst."

Alle visuelle Änderungen sind **additiv** – die vorhandene Spielmechanik, die Ledger-Logik und die Narrative-Engine bleiben unangetastet. Die Optik sitzt als Darstellungsschicht über dem existierenden `GameView`-Snapshot.

---

## 2. Aktueller Ist-Zustand (Belege aus Code)

| Bereich | Ist | Problem |
|---------|-----|---------|
| Eintrag | `index.html` leer, `<div id="root"></div>`, kein Ladebildschirm, kein Favicon | Weißer Bildschirm bis React rendert |
| Boot | `main.tsx` lädt Texturen asynchron, kein Lade-Zustand | Kein Fortschritt für den Nutzer |
| Figuren | `guest-art.ts` malt mit `Graphics`-Primitiven | `manifest.json` hat Kopf/Arm/Bein/Torso-Texturen (unused) |
| Boden | `floor-surface.ts` zeichnet prozedural mit `Graphics`-Rects | `environment/tiles/` (Teppich, Tapete) ungenutzt |
| Partikel | Emitter definiert (coin-burst, jackpot-burst, machine-sparks, plinko-impact) | Nicht im Spielfluss eingebunden |
| Animationen | coin-spin, explosion, smoke-puff definiert | Nicht integriert |
| UI-Feedback | Kein Screen-Shake, kein Win-Flash, keine Popup-Transition | Ereignisse passieren still |
| Spieler-Marker | Magenter Kreis (`character-view.ts:41`) | Kein Spiel-Marker |
| Popups | Ein Shell-Rahmen für alle Spieltypen | Keine visuelle Unterscheidung |

---

## 3. Plan: 5 Phasen (additiv, jede Phase separat verifizierbar)

### Phase 1: Eintrag & Ladeerfahrung (keine Code-Änderung am Spiel)

**Ziel:** Der Nutzer sieht sofort, dass ein Spiel lädt, nicht eine leere Seite.

- `index.html`: `<title>`, Meta-Description, Favlink, noscript-Fallback, sichtbarer Lade-Balken im HTML (CSS-animiert, bevor React mountet)
- `main.tsx`: Während `boot()` läuft, bleibt der HTML-Ladebalken sichtbar; erst nach `createRoot().render()` wird er ausgeblendet
- Lade-Text: "Lade Neon-Kasino…", dann "Baue Floor…", dann "Bereit."

**Exit-Kriterium:** Bei kaltem Start sieht der Nutzer nie einen weißen Bildschirm länger als 200 ms.

---

### Phase 2: Figuren & Boden nutzen die vorhandenen Textur-Pakete

**Ziel:** Die vorhandenen ~539 Texturen werden sichtbar.

- `guest-art.ts`: Charakter-Teile (Kopf, Torso, Arme, Beine, Schuhe) aus `manifest.json` (`characters/`) laden und als Sprite-Container zusammenbauen statt pro Graphics-Rect zu malen. Fallback:Graphics bleibt, falls Textur fehlt (kein Wurf).
- `floor-surface.ts`: Boden-Zonen nutzen `environment/tiles/casino-carpet-plum.png` und `wallpaper-damask-plum.png` als Textur-Tiling statt nur Farben.
- `floor-view.ts`: Furniture-Art nutzt `machines/*`-Texturen (slot-cabinet, blackjack-table, poker-table, roulette-table, shell-game-table, dice-table, plinko-cabinet, bar-counter, cash-register) statt nur gefärbter Rechtecke.

**Exit-Kriterium:** Jede Zone, jede Figur, jedes Gerät zeigt eine Textur aus dem Paket (oder fällt sichtbar auf Graphics zurück, wenn Datei fehlt).

---

### Phase 3: Partikel-Events im Spielfluss (umgesetzt)

**Ziel:** Spielereignisse haben visuelle Gegenstücke via Headless Event-Emitter.

- `src/core/sim/events.ts` (neu): `on`/`off`/`emit`/`listenerCount`, keine Pixi/DOM-Imports.
- `src/core/games/slot-session.ts`: `slot:jackpot`, `slot:chargeDischarge`, `slot:chargeReady`, `slot:spin`.
- `src/core/games/plinko-sandbox.ts`: `plinko:drop`.
- `src/core/sim/disputes.ts`: `dispute:start`, `dispute:sabotage`.
- `src/core/sim/money.ts`: `money:bigPayout` (ab 10 VC).

**Exit-Kriterium:** UI/Render-Schicht abonniert diese Events noch nicht – das ist Phase 4 (UI-Anbindung der Partikel).

---


### Phase 3 (ursprünglich): Partikel & Animationen im Spielfluss

**Ziel:** Spielereignisse haben visuelle Gegenstücke.

- `slot-transparency.ts` / `slot-session.ts`: Bei Jackpot oder "chargeReady"-Entladung → `jackpot-burst`-Emitter (Sparks + Glow), bei jedem Spin → `coin-burst`
- `plinko-sandbox.ts`: Bei Peg-Kontakt → `plinko-impact`-Emitter
- `guest-service.ts` / `disputes.ts`: Bei Streit-Start oder Wut → `smoke-puff`-Animation am Gast
- `money.ts` / `actions.ts`: Bei großer Auszahlung → kurze Bildschirm-Flash-Overlay (CSS-Klasse auf `.stage-wrap`)
- `sound-fx.ts` ist bereits vorhanden → Partikel und Sound synchron auslösen (gleicher Tick)

**Exit-Kriterium:** Gewinn, Jackpot, Streit, Maschinen-Schaden haben jeweils einen sichtbaren Partikel-Effekt.

---

### Phase 4: Game Feel & UI-Unterschiedlichkeit

**Ziel:** Das Spiel hat Rhythmus und jede Spielart sieht anders aus.

- **Screen-Shake:** Bei großem Verlust oder Streit kurz das `.stage-wrap` oder den Pixi-Container rütteln (CSS-Animation + Pixi-Offset), danach zurück
- **Win-Flash:** Bei Jackpot oder großem Multiplikator kurze goldene Überblendung über dem Floor
- **Popup-Unterschiedlichkeit:** Slot-Popup bekommt dunkles Neon-Rot, Poker bekommt Samt-Violett, Plinko bekommt Cyan – über CSS-Klassen auf `.popup`, nicht über neuen Shell-Code
- **Idle/Attract-Modus:** Nach 60 Sekunden ohne Interaktion langsames automatisches Zoomen über den Floor (Kamera schwenkt), HUD zeigt "Drücke eine Taste zum Starten" (optional, kein Spiel-Zustand)
- **Spieler-Marker:** Statt magentem Kreis ein kleiner Charakter-Icon oder ein Leucht-Punkt in `ROLE.service`

**Exit-Kriterium:** Jede Spielart (Slot, Poker, Roulette, Shell, Dice, Plinko, Blackjack, Video Poker) hat eine eigene visuelle Note; große Ereignisse rütteln/blitzen.

---

### Phase 4.5: Feinschliff der Bodenhinweise (Cues)

**Ziel:** Die bestehenden Cues wirken "spieliger".

- `floor-cues.ts`: Zielraster (Reticle) bekommt eine leuchtende Mitte statt nur Eck-Linien; Spielerring bekommt einen leichten Außen-Glow; Klick-Puls bekommt eine nachhallende Welle (konzentrische Ringe) statt nur einer Ellipse
- `floor-camera.ts`: Zoom-Übergänge bekommen eine leichte Easing-Kurve (aktuell linearer Faktor 0.22, ok, aber langsamer für "schweres" Gefühl bei großen Zooms)

---

### Phase 5: Audio-zu-Visual-Kopplung (optional, wenn Sound da ist)

**Ziel:** Sound und Bild landen zur selben Zeit.

- `sound-fx.ts` spielt bereits Töne (coin, brawl, roulette, cardFlip, reelStop, win). Diese Aufrufe werden um Partikel-Callbacks ergänzt: derselbe `playSfx('win')`-Aufruf löst auch den `jackpot-burst` aus.
- `music.ts` hat 6 Tracks (floor, night, menu, background, games, slot) – Popup-Wechsel ändert bereits den Musik-Zustand, visuell könnte der Floor-Hintergrund langsam die Musik-Farbe annehmen (subtil).

**Exit-Kriterium:** Kein Sound ohne visuelles Pendant.

---

## 4. NICHT in diesem Plan (bewusst ausgelassen)

- Keine neuen Spielmechaniken, keine Ledger-Änderungen, keine Narrative-Änderungen
- Kein 3D, keine Shader (außer vorhandene Pixi-Filter), keine WebGL-Eigenentwicklung
- Keine neuen Spieltypen
- Keine Änderung der `verify`-Gates (alles bleibt fail-closed)

---

## 5. Verifikation nach jeder Phase

Nach jeder Phase:
1. `pnpm run verify:quick` – alle 10 Gates müssen grün bleiben
2. `pnpm run check:loc` – keine Datei über ihr Hot-Zone-Budget
3. Manuelle Sichtprüfung: `pnpm run dev` (http://localhost:3000), Start-Erfahrung, visueller Eindruck

---

## 6. Exit-Kriterium Gesamtplan

Der Nutzer öffnet die URL und sieht:
1. Einen Ladebildschirm (nicht weiß)
2. Einen Floor mit texturierten Zonen, bevölkerten Figuren, sichtbaren Geräten
3. Ein HUD, das wie eine Spiel-HUD aussieht (Geld, Ruf, Bar, Skills)
4. Bei jedem Klick auf "Spielen" oder "Drehen" eine visuelle Reaktion (Partikel, Sound, ggf. Shake)
5. Popups, die sich nach Spieltyp unterscheiden

---

## 7. Offene Entscheidungen (Nutzer)

- Soll der Ladebildschirm ein Logo haben? (Banner `docs/banner.jpg` oder `docs/banners/art-direction-neon-ledger.png` existieren bereits)
- Soll es einen Hauptmenü-Bildschirm geben ("Neues Spiel / Laden") oder direkt in den Floor?
- Welche Farbe soll der Attract-Modus haben (warm Bar / kalt Eingang / Neon Saal)?

---

**Artifacts in dieser Sitzung:** Dieser Plan (kein Code noch). Nach Freigabe durch den Nutzer: Implementierung Phase für Phase mit `verify:quick` zwischen jeder Phase.
