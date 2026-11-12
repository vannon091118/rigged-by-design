# Render- und Living-World-Rework — Task-Phasen

**Zweck:** Dieser Plan ist die ausführbare Todo hinter der Render- und
Living-World-Roadmap. Er beschreibt Reihenfolge, Abhängigkeiten, Dateien, Tests
und Abnahmekriterien. Die Produktplanung bleibt in [`ROADMAP.md`](ROADMAP.md);
die Architekturgrenzen stehen in [`ARCHITECTURE.md`](ARCHITECTURE.md).

**Stand:** 2026-11-12 · Baum `0.3.233` · Audit-Basis `0.3.231`

**Status:** Umsetzung begonnen (Lane `lane/render/r1-r12-rework`). Die Kästchen
werden nur mit Beleg abgehakt; ein grüner Teilcheck ist kein grüner
Phasenabschluss. Die Meilensteine M0–M4 (Abschnitt 6) und die Sichtabnahme
(Abschnitt 8) sind verbindlich.

### Umsetzungsstand 2026-11-12

Belegt sind die deterministischen Verträge und die lokalen Gates; **nicht**
belegt ist die Pixi-Sichtabnahme. Der Cloud-Browser hängt in dieser VM auch
mit dem unveränderten Basisstand `fccc787` (kein Screenshot, keine
Accessibility-Abfrage); das ist eine Umgebungsgrenze, kein grüner Bildbeleg.

| Phase | Beleg | Stand |
| --- | --- | --- |
| R1 | `src/render/visual/scene-frame.ts` + `scene-frame.test.ts`: vier Szenen, drei byte-identische Läufe, Hashänderung bei echter Bildänderung | Teilbeleg; Browser-Screenshot fehlt |
| R2 | `decor-roles.ts` + `decor-roles.test.ts`: stabile Rollen, exakte Labels, unaufgelöste Fläche statt Regex/`0x2dd4a0` | Code-/Testbeleg |
| R3 | `actor-silhouette.ts` + Test: 12×16-Silhouette, fünf Personafamilien; Pin-Skalierung gegen die Kamera entfernt | Code-/Testbeleg |
| R4 | sechs echte Boden-SVGs im Manifest, `floorTextureKey` testet Vorhandensein; `CarpetOverlay` entfernt, Teppichwahl tintet das Material | Code-/Testbeleg |
| R5 | `light-pool.ts` + Test: 16 Slots, eine Radialtextur, BlendMode am Lichtkind; `drawLightSpill`-Ellipsenschleife entfernt | Code-/Testbeleg |
| R6 | `floor-camera-bounds.test.ts`: 60×60 vs. 30×10, Fit/Fill getrennt, LOD-Hysterese; zwei Parallax-Ebenen in `stage-backdrop.ts` | Code-/Testbeleg; Q2-Projektion noch nicht sichtbar geprüft |
| R10 | `src/core/sim/__tests__/apartment-render.test.ts`: fünf Bereiche, neun Rollen, warme Texturen, Haustürvertrag | Vertragstest; S2-09–S2-11 bleiben offen |
| R11 | `locomotion.ts` + Test und `floor-animate.ts`: vier Frames, zwei Richtungen, Stillstand; Richtung spiegelt nur die Figur | Code-/Testbeleg |
| R7–R9 | `city-exterior`/`city-scene` bleiben die eine Stadtwahrheit; S2-12 ist weiterhin die offene Roadmap-Aufgabe | **R7 teilweise belegt** (Exterieur im Produktionspfad); R8–R9 offen; keine zweite Stadt erfunden |
| R12 | Ambient setzt R9 voraus; ohne sichtbare Stadt kein Wetter-/Tag-Nacht-Layer | **blockiert** |

Lokale Gates auf diesem Stand: `verify:light` PASS, `ci:local` PASS,
`verify:assets` PASS, `verify:tree` PASS, `verify:dead-code` PASS,
`verify:test-quality` PASS, `verify:test-placement` PASS. Die Checkboxen in
R1–R12 bleiben unverändert offen, bis Screenshot, Konsole und Probe nach
Abschnitt 8 vorliegen.

## 1. Ausgangslage

Der Audit beschreibt 97 Render-Dateien und mehrere sichtbare Brüche zwischen
Simulation und Darstellung. Am aktuellen Baum wurden die folgenden Befunde
stichprobenartig bestätigt; die Zahlen aus dem Audit sind Ausgangsmessung und
werden in R0 neu erhoben, nicht ungeprüft übernommen.

| Befund | Aktueller Beleg | Phase |
| --- | --- | --- |
| D1: Grüner Platzhalter statt Ehrlichkeit | `src/render/furniture-atlas.ts` zeichnet weiterhin `0x2dd4a0` | R2 |
| D2: Deko über Label-Regexe | `furniture-atlas.ts` leitet Deko aus Namen statt aus stabilen Rollen ab | R2 |
| D3: Fünf Materialien ohne Textur | `src/render/floor-material.ts` enthält fünf `texture: null` | R4 |
| D4: Figur wird zum Pin | `src/render/guest-rig.ts` ersetzt das Rig durch den Pin; `guest-paint.ts` malt 6×6 | R3 |
| D5: Stadt existiert nur headless | `createCityExteriorModel()`/`createCityStreetLayout()` haben keinen Produktionsaufrufer außerhalb der Simulation | R7 |
| D6: Teppich als Overdraw | `src/render/scene-cache.ts` nutzt `CarpetOverlay` | R4 |
| D7: Kein lokales Bildgate | Es gibt keinen reproduzierbaren Browservergleich für Render-Änderungen | R1 |
| D8: Falscher Kamera-/Hintergrundvertrag | Quadratische Kamera und flacher Hintergrund begrenzen die Stadt | R6 |

Der Audit nennt rund 554 Assets, davon 418 ohne Nutzung. Für diesen Plan ist
nicht „mehr Assets“ das Ziel, sondern **jede sichtbare Fläche hat eine benannte
Rolle, eine echte Textur und einen lokalen Beleg**.

## 2. Leitentscheidungen

Diese Entscheidungen gelten als Default. Eine Abweichung braucht einen
Messbeleg und wird in diesem Dokument nachgezogen, nicht still im Code
eingeführt.

1. **Die Simulation bleibt die Wahrheit.** `src/core/sim/city-exterior.ts`,
   `building.ts`, `room-transition.ts` und `player-apartment.ts` werden nicht
   neu geschrieben. R7 baut eine Darstellungsschicht darüber.
2. **`city-exterior.ts` ist der kanonische Stadtkern.** Die Portal-/Menülogik
   in `src/ui/city-popup.tsx` und die vorhandene `city-scene`-Darstellung
   werden zu einem Adapter auf das Exterior-Modell; es entsteht keine zweite
   Stadtwahrheit.
3. **Projektion:** Außenstadt in 2:1-Isometrie, Innenräume weiterhin
   top-down. Die Projektion wird in R6 als Vertrag festgeschrieben, bevor R7
   Assets und Kollisionen darauf auslegt.
4. **Ein Zustand, eine View.** `GameView` bleibt der bestehende
   Darstellungszustand. Die Stadt bekommt einen `WorldView`-Adapter, keinen
   zweiten Store und keinen zweiten Ticker.
5. **Rollen statt Label-Regexe.** Deko und Möbel werden über stabile
   `kind`-/`gameId`-/Asset-IDs einer Renderrolle zugeordnet. Ein optionales
   `Furniture.role` ist nur zulässig, wenn der Resolver ohne es nicht
   eindeutig bleibt.
6. **Das Bildgate bleibt lokal.** Es nutzt den vorhandenen
   Browser-/Playwright-Pfad in `packages/gamescout` (`playwright-core`,
   `pixelmatch`, `pngjs`) und wird **nicht** als Cloud-Workflow, nicht als
   reguläres Gate und nicht als Screenshot-Pflicht in jeden Testlauf gehängt.
7. **Loops sind Mechanik, keine Gates.** Lange Stadt-, Soak- und
   Wiederholungsläufe bleiben gezielte `test:mechanics`-Nachweise. Der
   Render-Plan fügt keine Endlosschleife und keinen Retry-Zyklus hinzu.
8. **Sichtbares wird vom Agenten abgenommen.** Jeder sichtbare Slice R2–R12
   endet mit einer Preview-Sichtabnahme gegen den lokalen Dev-Server. Ein
   Unit-Test oder Pixel-Diff ohne Browserbeleg ist kein Phasenabschluss.

## 3. Reihenfolge

R0–R1 sind die Basis. R2–R6 härten den bestehenden Casino-Render, bevor die
Stadt daraufsetzt. R7 ist der sichtbare Schnitt; R8–R12 bauen in dieser
Reihenfolge darauf auf. R3 und R5 dürfen nach R1 parallel laufen; R4 folgt nach
R2. R7 wartet auf R2, R6 und den Stadtkern S2-12. R10 plant die Wohnung nicht
neu: es nimmt die offenen S2-09–S2-11 im Renderer ab.

| Phase | Ergebnis | Abhängig von | Größe |
| --- | --- | --- | --- |
| R0 | Baseline, Rolleninventar, Rechte, Entscheidungen | — | S |
| R1 | Reproduzierbares lokales Bildgate | R0 | M |
| R2 | Ehrliche Platzhalter und Rollenauflösung | R1 | M |
| R3 | Akteur-Silhouette statt Pin | R1 | M |
| R4 | Materialien und Teppich ohne Overdraw | R1, R2 | M |
| R5 | Licht mit Fläche und sichtbaren Quellen | R1 | M |
| R6 | Kamera, Hintergrund und LOD-Vertrag | R1, R5 | M |
| R7 | Stadtansicht an S2-12 anbinden | R2, R6, S2-12 | L |
| R8 | Stadt-Assetpaket und Weltmetadaten | R4, R7 | L |
| R9 | Stadtleben: NPCs, Türen, Begegnungen | R7, R8, S2-12 | L |
| R10 | Wohnung: Render-Abnahme für S2-09–S2-11 | R4, R7, S2-09–S2-11 | M |
| R11 | Lauf- und Richtungsanimation | R3, R8 | M |
| R12 | Ambient und Wetter | R9 | M |

**Meilenstein-Zuordnung:** M0 = R0–R1, M1 = R2–R6, M2 = R7–R8,
M3 = R9–R10, M4 = R11–R12. Die Exit-Kriterien stehen in Abschnitt 6; die
Roadmap führt dieselben IDs als grobe Produkt-Etappen.

## 4. Task-Phasen

### R0 — Baseline, Rolleninventar und Rechte

**Ziel:** Eine belastbare Ausgangsmessung, damit später niemand „besser“ behauptet,
ohne es zu messen.

**Dateien:** `src/render/assets/manifest.json`, `src/render/assets/__tests__/asset-semantics.test.ts`,
`docs/RENDER_REWORK_PLAN.md`, `docs/ROADMAP.md` (nur Referenzen), ggf.
`docs/ASSET-LICENSES.md` (neu, nur wenn die Rechteprüfung es verlangt).

**Aufgaben**

- [ ] Render-Inventar am Baum `0.3.233` neu zählen: Dateien, Assets, benutzte
      Assets, Atlasrahmen, Materialien, Figuren, Lichtflächen, Boot-Requests.
- [ ] Rolleninventar anlegen: Terrain, Wand, Boden, Möbel, Gerät, Deko, Akteur,
      Licht, Partikel, UI. Jede Rolle nennt ihren Renderer und ihre Quelle.
- [ ] Die im Audit genannten `usedBy`-Fehler gegen den echten Importgraphen
      prüfen; keine Asset-Nutzung aus Kommentaren oder Tests ableiten.
- [ ] Rechteprüfung: Herkunft der 554 Dateien und der neuen Stadtassets
      dokumentieren; offene Punkte bleiben offen, statt als geklärt zu gelten.
- [ ] Q1–Q5 aus Abschnitt 2 als Entscheidung protokollieren, inklusive
      Projektionswahl und `GameView`-Grenze.
- [ ] Baseline-Zahlen und offene Rechtefragen in `ROADMAP.md` unter `PR-10`
      referenzieren; keine neue konkurrierende Roadmap-Zeile.

**Akzeptanz**

- [ ] Jede Zahl hat einen Befehl oder eine Datei als Quelle.
- [ ] Kein Render-Code und kein Asset wurde in R0 geändert.
- [ ] Das Rolleninventar deckt jede sichtbare Fläche ab; „sonstiges“ ist keine
      Rolle.
- [ ] Die Rechtelage ist als „belegt“, „offen“ oder „blockiert“ markiert.

**PixiJS-Falle:** R0 ist absichtlich framework-frei. Kein `Application`-Umbau,
keine Asset-Umbenennung und kein vorzeitiges `Assets.init`.

### R1 — Lokales Bildgate

**Ziel:** Render-Änderungen lokal und reproduzierbar sehen, bevor sie als
„fertig“ gelten. Das Gate ersetzt kein Cloud-Gate und verlangsamt die normale
Testline nicht.

**Dateien:** `packages/gamescout` (bestehender Browser-/Bildpfad),
`src/render/visual/` (Szenenvertrag, falls ein Renderer-Modul nötig ist),
`src/render/__tests__/floor-camera.test.ts`, `src/render/__tests__/floor-cache.test.ts`.

**Aufgaben**

- [ ] Vier fixe Szenen definieren: Casino-Übersicht, Casino-Detail,
      Stadt-Platzhalter und Wohnung. Jeweils fester Seed, feste Tickzahl, feste
      Kamera, fester Ausschnitt.
- [ ] Sichtbaren Frame über den vorhandenen Browserpfad aufnehmen; keine
      `Texture.from(url)`-Abkürzung und keine neue Root-Abhängigkeit.
- [ ] Vier Szenen in einem Lauf aufnehmen, nicht pro Szene einen Browser starten.
- [ ] Vergleich: Pixel-Diff und Konsolenfehler. Ein absichtlicher 5-%-Eingriff
      muss rot werden; ein unveränderter Lauf muss dreimal grün sein.
- [ ] Boot-Requests und First-Frame-Zeit als Messwerte ausgeben; die
      Audit-Baseline (77 Requests) erst nach eigener Messung ersetzen.
- [ ] Baseline-Update nur im selben Commit wie die beabsichtigte Änderung.
- [ ] Das Gate als gezielten lokalen Befehl dokumentieren; **nicht** in
      `ci:local`, `verify:all` oder einen Cloud-Workflow einhängen.

**Akzeptanz**

- [ ] Drei aufeinanderfolgende Läufe liefern denselben Diff.
- [ ] Eine beabsichtigte Farb-/Geometrieänderung wird erkannt.
- [ ] Ein fehlendes Asset oder ein Platzhalter erscheint im Bild, nicht als
      stiller grüner Fleck.
- [ ] Das Gate benötigt keinen Netzwerkzugriff außer den lokalen Vite-Assets.

**PixiJS-Falle:** `app.init()` ist asynchron; erst danach existieren
`app.canvas`, `app.renderer` und `app.screen`. Kein `new Application({...})` mit
Optionen. Kein zweiter Ticker im Gate.

### R2 — Ehrliche Platzhalter und Rollenauflösung

**Ziel:** Fehlende Assets werden sichtbar und zuordenbar, statt als grüne Fläche
oder falsches Möbelstück zu erscheinen.

**Dateien:** `src/render/furniture-atlas.ts`, `src/render/guest-paint.ts` (nur
gemeinsame Zeichenhelfer), neu `src/render/decor-roles.ts`, ggf.
`src/core/sim/furniture-catalog.ts`, `src/render/assets/manifest.json`.

**Aufgaben**

- [ ] `decor-roles.ts` führt eine explizite Tabelle `stabile ID → Rolle`.
      Reihenfolge: `gameId`, `kind`, Asset-ID, erst danach Anzeigename.
- [ ] Die Regex-/Label-Heuristik in `furniture-atlas.ts` entfernen. Ein
      unbekannter Name darf keine geratene Rolle mehr erzeugen.
- [ ] Platzhalter zeichnen: gestrichelte Kontur, neutraler Warnfarbton,
      Asset-/Rollenname klein darunter. Kein `0x2dd4a0` als Erfolgssignal.
- [ ] Unbekanntes Bodenmaterial bekommt denselben ehrlichen Platzhalter; der
      Boden fällt nicht auf Beton zurück.
- [ ] `Furniture.role` nur ergänzen, wenn ein stabiler Schlüssel fehlt; die
      Schemaänderung braucht Save-/Migrationsprüfung.
- [ ] Test: jede Rolle aus dem Inventar wird aufgelöst; unbekannte ID wird
      sichtbar als Platzhalter gemeldet; kein Treffer über Label-Text.

**Akzeptanz**

- [ ] `rg "0x2dd4a0" src/render/furniture-atlas.ts` liefert keinen Treffer.
- [ ] Kein Deko-Mapping liest mehr einen Anzeigenamen als Primärschlüssel.
- [ ] Ein fehlendes Asset ist im lokalen Bildgate sichtbar und nennt seinen
      Schlüssel.
- [ ] Bestehende Möbel und Geräte behalten ihre Textur.
- [ ] Sichtabnahme: unbekanntes Möbel als gestrichelter Platzhalter mit
      Schlüssel; Screenshot, Konsole und Probe nach Abschnitt 8.

**PixiJS-Falle:** Platzhalter sind `Graphics`-Leaves in einem `Container`.
Keine Kinder an `Graphics` hängen. Text als eigener `Text`/`BitmapText`-Leaf,
nicht als Canvas-in-Canvas.

### R3 — Akteur-Silhouette statt Pin

**Ziel:** Gäste bleiben als Figuren erkennbar, auch wenn das Rig im LOD reduziert
wird.

**Dateien:** `src/render/guest-rig.ts`, `src/render/guest-paint.ts`,
`src/render/entity-sync.ts`, neu `src/render/actor-silhouette.ts`,
`src/render/__tests__/rig.test.ts`, `src/render/__tests__/guest-sprite.test.ts`.

**Aufgaben**

- [ ] Fünf Silhouetten (Persona-Familien) als 24×32-Quelle, 12×16-Anzeige;
      Tint aus der bestehenden Personafarbe.
- [ ] `GuestRig` bekommt `setSilhouette(persona, color)`; der Pin-Pfad wird
      entfernt, nicht nur ungenutzt gelassen.
- [ ] LOD-Regel: Detail oberhalb der Schwelle, Silhouette darunter, nie ein
      unsichtbarer Actor. Kein inverses Skalieren des Pins.
- [ ] `entity-sync.ts` darf die Silhouette nicht pro Frame neu erzeugen; sie
      wird einmal pro Actor/Persona gebaut und wiederverwendet.
- [ ] Test: alle fünf Personas haben eine Silhouette; `paintPin` kommt im
      Renderpfad nicht mehr vor; ein LOD-Wechsel erzeugt kein Duplikat.

**Akzeptanz**

- [ ] Kein 6×6-Pin mehr im gerenderten Bild.
- [ ] Ein Gast ist bei beiden LOD-Stufen als dieselbe Person erkennbar.
- [ ] Die Silhouette skaliert mit der Welt, nicht gegen die Kamera.
- [ ] Der lokale Bildvergleich zeigt Detail und Silhouette.
- [ ] Sichtabnahme: Detail und Silhouette im selben Lauf, kein Pin;
      Screenshot, Konsole und Probe nach Abschnitt 8.

**PixiJS-Falle:** `Sprite` ist ein Leaf. Kein `addChild` auf einem Sprite.
Silhouette als eigener `Sprite` in einem `ActorContainer`; `visible` statt
`renderable`, wenn Bounds für Hit-Tests erhalten bleiben müssen.

### R4 — Materialien und Teppich ohne Overdraw

**Ziel:** Böden sehen wie Materialien aus, nicht wie Farbflächen mit
Punktmuster. Der Teppich wird einmal gezeichnet, nicht als Overlay über einer
bereits gefüllten Fläche.

**Dateien:** `src/render/floor-material.ts`, `src/render/floor-surface.ts`,
`src/render/floor-carpet.ts`, `src/render/scene-cache.ts`,
`src/render/__tests__/floor-layout.test.ts`, neu
`src/render/__tests__/floor-material.test.ts`.

**Aufgaben**

- [ ] Sechs Casino-Materialien mit echten, nahtlosen Texturen belegen:
      Holz, Fliese, Stein, Linoleum, Beton, Teppich.
- [ ] `texture: null` aus der Materialtabelle entfernen; ein unbekanntes
      Material nutzt den Platzhalter aus R2, nicht `null`.
- [ ] Muster nicht mehr pro Kachel als `Graphics` zeichnen; Textur über
      `TilingSprite` oder eine materialeigene Textur.
- [ ] `CarpetOverlay` aus `scene-cache.ts` entfernen. Der Teppich ist eine
      Fläche mit einer Textur, kein zweiter vollflächiger Layer.
- [ ] `texture.source.scaleMode = "nearest"` für Pixelkunst zentral setzen;
      keine weichen Skalierungen pro Material.
- [ ] Test: jedes Material hat eine Textur; Teppich erzeugt genau einen
      Zeichenknoten; Layoutwechsel invalidiert den Cache genau einmal.

**Akzeptanz**

- [ ] Kein `texture: null` in der produktiven Materialtabelle.
- [ ] Kein `CarpetOverlay` mehr im Szenenaufbau.
- [ ] Ein Raum mit Teppich hat nicht zwei vollflächige Bodenknoten.
- [ ] Die sechs Materialien sind im lokalen Bildgate unterscheidbar.
- [ ] Sichtabnahme: sechs Materialien und genau ein Teppich-Bodenknoten;
      Screenshot, Konsole und Probe nach Abschnitt 8.

**PixiJS-Falle:** `TilingSprite` ist ein Leaf; seine Textur kommt aus
`Assets.load`, nicht aus `Texture.from(url)`. `tileScale`/`tilePosition` statt
manueller Kachelschleifen. `cacheAsTexture` nur auf stabilen, großen Gruppen und
vor `destroy()` wieder abschalten.

### R5 — Licht mit Fläche und sichtbaren Quellen

**Ziel:** Licht wird als Fläche und Quelle lesbar; die 16 deckenden Ellipsen
verschwinden.

**Dateien:** `src/render/floor-surface.ts`, `src/render/fx/` (Lichtmodul),
`src/render/__tests__/depth.test.ts`, neu `src/render/__tests__/lighting.test.ts`.

**Aufgaben**

- [ ] Eine 256×256-Radialtextur mit definiertem Falloff und Alpha erzeugen.
- [ ] Lichtpool statt 16 einzelner `Graphics`-Ellipsen; jedes Licht hat
      Position, Radius, Farbe und Intensität aus der bestehenden Lichtquelle.
- [ ] Sichtbare Leuchtkörper (Lampe, Schild, Slot) als eigene Sprites; der
      Lichtpool bleibt additiv, die Quelle bleibt deckend.
- [ ] Lichtdaten aus `floor-surface.ts` in ein eigenes Modul ziehen; der
      Boden zeichnet keine Lichtlogik mehr.
- [ ] Keine Allokation pro Frame: Pools einmal bauen, pro Frame nur Werte
      setzen.
- [ ] Test: 16 Quellen, 16 Pool-Einträge, keine Ellipsen; BlendMode nur an
      Kindern, nicht an der Gruppe.

**Akzeptanz**

- [ ] Keine `ellipse()`-Lichtschleife mehr im Bodenrenderer.
- [ ] Ein Licht mit Radius 0 bleibt sichtbar als Quelle, ohne Fläche.
- [ ] Der Lichtpool erzeugt bei ruhender Szene keine neuen Objekte.
- [ ] Lokales Bildgate: Licht überlappt glaubwürdig, ohne den Boden zu
      überdecken.
- [ ] Sichtabnahme: Lichtpool und sichtbare Quelle ohne Ellipsen;
      Screenshot, Konsole und Probe nach Abschnitt 8.

**PixiJS-Falle:** `blendMode = "add"` gehört auf die Lichtkinder, nicht auf
einen Container, dessen Kinder unterschiedliche BlendModes brauchen. Kein
`isRenderGroup` um den Lichtpool, solange dessen Kinder animiert werden.

### R6 — Kamera, Hintergrund und LOD-Vertrag

**Ziel:** Die Kamera kennt echte Weltgrenzen, der Hintergrund hat Tiefe, und LOD
flattert nicht an der Schwelle.

**Dateien:** `src/render/floor-view.ts`, `src/render/floor-camera.ts`,
`src/render/floor-camera-rig.ts`, `src/render/scene-cache.ts`,
`src/render/__tests__/floor-camera.test.ts`, `src/render/__tests__/floor-cache.test.ts`.

**Aufgaben**

- [ ] `FloorCamera` von quadratischem `size` auf `worldBounds {width,height}`
      umstellen; Casino-Verhalten bleibt über eine feste Bounds erhalten.
- [ ] Zoom-/Pan-Grenzen aus den Weltgrenzen ableiten, nicht aus dem Viewport.
- [ ] Hintergrund als zwei Parallax-Ebenen mit Faktor; keine Kamera-Reprojektion
      pro Frame über `getBounds()`.
- [ ] LOD-Schwelle mit Hysterese: Detail an, wenn näher als `enter`; erst
      Silhouette, wenn weiter als `exit`; kein Flackern bei einem Pixel.
- [ ] Q2 (2:1-Isometrie außen) im Kamera-Vertrag festhalten; Innenräume bleiben
      top-down.
- [ ] Test: Bounds 60×60 versus 10×10, Zoom-Grenzen, Hysterese an der Schwelle,
      Hintergrund bewegt sich langsamer als die Welt.

**Akzeptanz**

- [ ] Keine quadratische Kameraannahme mehr im Renderer.
- [ ] Ein LOD-Wechsel an der Schwelle erzeugt genau einen Wechsel, nicht mehrere.
- [ ] Der Hintergrund ist bei leerer Szene sichtbar und nicht schwarz.
- [ ] Die bestehende Casino-Kamera bleibt im Bild unverändert.
- [ ] Sichtabnahme: Weltgrenzen, Parallaxe und genau ein LOD-Wechsel am
      Rand; Screenshot, Konsole und Probe nach Abschnitt 8.

**PixiJS-Falle:** `getBounds()` liefert `Bounds`, nicht `Rectangle`; für
`contains()` `.rectangle` verwenden. Keine Bounds-Abfrage pro Frame; Weltgrenzen
sind bekannt und werden einmal gesetzt. `isRenderGroup` nur für stabile
Hintergrundebenen.

### R7 — Stadtansicht an S2-12 anbinden

**Ziel:** Der vorhandene Stadtkern wird sichtbar. **S2-12 ist die offene
Roadmap-Aufgabe für das Stadtnetz**; R7 dupliziert sie nicht, sondern liefert
die Renderer-Schicht und den lokalen Bildbeleg dafür. Kein zweiter Stadtzustand,
kein Test-only-Renderer.

**Dateien:** `src/core/sim/city-exterior.ts`, `src/core/sim/city-scene.ts`,
`src/core/sim/building.ts`, `src/core/sim/room-transition.ts`,
`src/ui/city-popup.tsx`, neu `src/render/city/` (`city-world.ts`,
`city-ground.ts`, `city-buildings.ts`, `city-doors.ts`),
`src/render/__tests__/city-world.test.ts`.

**Belegstand 2026-11-12 (D5):** `createCityScene()` projiziert jetzt das
kanonische `createCityExteriorModel()` (60x60, vier Fassaden, fuenf
Strassenrequisiten) in `world.cityScene`; `buildView` reicht `cityExterior` an
den Renderer, `CityExteriorLayer` zeichnet Fassaden/Requisiten mit benannten
Rollen und echten SVG-Texturen, `FloorView` aktualisiert sie pro Frame und
`areasForSize` teilt 60x60 in vier 30er-Chunks. Kamera-Grenzen kommen aus
`worldBoundsOf` (echte 60x60-Kante), nicht aus der 30er-Vorlage. Deterministisch
belegt durch `src/render/__tests__/city-exterior.test.ts` (Produktions-Entry
`createWorld` → `SceneCommands.enterCity` → `buildView` → Renderplan), inkl.
60x60-Navigation. **Noch offen:** echter Browser-Screenshot, Tuerklick ueber
`floor-hit`, DOM-/Screenreader-Zugang, WorldManager und der vollstaendige
S2-12-Uebergang. Diese Punkte bleiben bewusst unabgehakt.

**Aufgaben**

- [x] **S2-12 bleibt der Kern:** Das Stadtnetz und die Ortskanten kommen aus
      `city-scene.ts`/`city.ts`; R7 baut keinen zweiten Szenengraphen und keine
      zweite Wegewahrheit. *(belegt: `cityScene.layout` ist die direkte
      Exterieur-Projektion; alte 30x30-Portale entfernt)*
- [x] `CityExteriorModel` als Adapter aus `createCityExteriorModel()` lesen;
      der Renderer importiert keine Test-Fixtures und keine UI-Popup-Daten.
      *(belegt: `snapshot.ts` → `GameView.cityExterior`; Test durch
      `SceneCommands.enterCity`)*
- [ ] `city-popup.tsx` und die alte `city-scene`-Darstellung auf den Adapter
      umstellen oder als Menüzugang stilllegen; keine parallele Stadtansicht.
- [x] Straßen, Gehwege, Kreuzungen, Laternen, Gebäude und Türen aus dem Modell
      rendern; Tiefe über Fußanker, nicht über Namenssortierung.
      *(belegt: `CityExteriorLayer` + `cityRenderPlan`; vier Fassaden und fuenf
      Requisiten mit `depth.set(..., 'prop', ...)`)*
- [ ] `WorldManager` mit genau einer aktiven Welt einführen. `GameView` bleibt
      der Zustand; der Stadt-Adapter liest und schreibt nur die vorhandenen
      Übergänge.
- [ ] Türen an bestehende `floor-hit`-/`floor-actions`-Pfade anschließen; kein
      zweiter Input-Listener und keine zweite Kollisionswahrheit. Die
      Wohnungstür ist mit S2-07 bereits verifiziert und wird nicht neu gebaut.
- [ ] Tastatur-/Screenreader-Zugang für Türen und Orte: DOM-Overlay mit
      `aria-label` oder Pixi-Accessibility mit `accessibleTitle`/`tabIndex`.
- [ ] Test: Stadtmodell wird ohne Test-Fixture gerendert; Tür öffnet den
      bestehenden Raumwechsel; kein doppelter Actor nach dem Wechsel.

**Akzeptanz**

- [ ] `city-exterior`/`city-scene` haben einen Produktionsaufrufer außerhalb
      von `src/core/sim`; die offene S2-12-Aufgabe bleibt die einzige Quelle
      für das Stadtnetz.
- [ ] Ein Lauf nutzt die bestehende S2-07/S2-12-Übergangskette, ohne Teleport
      und ohne Duplikat; das ist der S2-08-Browserbeleg.
- [ ] Die Stadt ist im lokalen Bildgate als Straßenraum erkennbar, nicht als
      Platzhalterfläche.
- [ ] Ein nicht begehbarer Ort ist sichtbar als Kulisse markiert, nicht als
      Tür.
- [ ] Sichtabnahme: Straßenraum und Türen im Stadt-Adapter, kein Teleport;
      Screenshot, Konsole und Probe nach Abschnitt 8.

**PixiJS-Falle:** Die Stadt ist ein `Container` mit sortierbaren Kindern für
Tiefe; `sortableChildren` nur dort, nicht global. `Sprite`-Leaves bleiben
Leaves. Kein `Application` pro Stadt, kein zweiter Ticker, kein `cacheAsTexture`
auf animierten Häusern.

### R8 — Stadt-Assetpaket und Weltmetadaten

**Ziel:** Die Stadt bekommt nur die Assets, die eine benannte Rolle erfüllen,
mit Welt-, Skalierungs- und Rechteangaben.

**Dateien:** `src/render/assets/manifest.json`,
`src/render/assets/__tests__/asset-semantics.test.ts`, neu
`src/render/city/city-assets.ts`, `content/`-Metadaten nur falls vorhanden.

**Aufgaben**

- [ ] Rund 30 Stadtassets aus dem Audit auf Rollen prüfen: Straße, Gehweg,
      Kante, Fassade, Dach, Tür, Fenster, Laterne, Baum, Bank, Müll, Schild.
- [ ] Jedes neue Asset erhält `role`, `world`, `displayScale` (ganzzahlig) und
      `license`; fehlende Felder sind ein Fehler, kein Default.
- [ ] Nicht genutzte Assets nicht „für später“ laden; Boot-Budget und
      Bundles nach messbarem Bedarf.
- [ ] Straßenmaterialien aus R4 wiederverwenden, nicht als zweite
      Materialtabelle duplizieren.
- [ ] Test: jede Asset-ID ist eindeutig; jede Rolle hat eine Textur; jedes
      Pflichtfeld ist gesetzt; kein Asset außerhalb der erlaubten Welt.

**Akzeptanz**

- [ ] Kein Stadtasset ohne Rolle und Welt.
- [ ] Die Boot-Requests steigen nicht unkontrolliert; die Zahl steht im
      lokalen Messbericht.
- [ ] Die Rechteangabe ist pro neuem Asset vorhanden oder der Einsatz ist
      blockiert.
- [ ] Ein Asset mit falscher `displayScale` wird vom Test abgelehnt.
- [ ] Sichtabnahme: Stadtassets mit Rolle, Welt und Skalierung sichtbar
      korrekt; Screenshot, Konsole und Probe nach Abschnitt 8.

**PixiJS-Falle:** Assets über `Assets.load`/Manifest laden, nicht über
`Texture.from(url)`. `Assets`-Cache bewusst halten; kein `Assets.reset()` pro
Szene. Bei Bundle-Wechsel `Assets.unloadBundle`, nicht alles global leeren.

### R9 — Stadtleben: NPCs, Türen und Begegnungen

**Ziel:** Die headless vorhandenen Tagespläne und Begegnungen werden sichtbar,
ohne eine zweite Simulation zu bauen.

**Dateien:** `src/core/sim/npc-schedule.ts`, `npc-needs.ts`,
`social-encounter.ts`, `actor-continuity.ts`, neu
`src/render/city/city-actors.ts`, `src/render/__tests__/city-actors.test.ts`.

**Aufgaben**

- [ ] NPCs aus `npc-schedule`/`npc-needs` positionieren; kein eigener
      Zufallsstrom und keine eigene Uhr.
- [ ] Wege über die vorhandene Stadtkollision; Türen nutzen den bestehenden
      Raumwechsel.
- [ ] Actor-LOD aus R3 wiederverwenden; Stadt und Innenraum teilen die
      Actor-Darstellung.
- [ ] Begegnungen aus physischer Nähe an das bestehende
      `social-encounter`-Ergebnis binden; keine Renderer-seitige Beziehung.
- [ ] Sichtbare Reaktionen nur aus vorhandenen Facts/Beziehungen; kein neues
      Save-Feld.
- [ ] Test: zwei NPCs mit gleichem Plan kollidieren nicht; ein Türwechsel
      erhält die Actor-ID; eine Begegnung erzeugt genau ein Fact.

**Akzeptanz**

- [ ] Ein NPC läuft sichtbar von A nach B und verschwindet nicht an der Tür.
- [ ] Actor-IDs bleiben über den Raumwechsel stabil.
- [ ] Kein doppelter NPC nach Re-Entry.
- [ ] Die Begegnung ist im Bild und im bestehenden Fact-Log belegt.
- [ ] Sichtabnahme: NPC-Weg, Türwechsel und Begegnung in einem Lauf;
      Screenshot, Konsole und Probe nach Abschnitt 8.

**PixiJS-Falle:** Viele Actors als `Container` mit `Sprite`-Leaves; bei
hunderten Figuren `ParticleContainer` nur für statische, gleichartige Sprites
prüfen, nicht für individuelle Rigs. Keine EventListener pro Frame neu binden.

### R10 — Wohnung: Render-Abnahme für S2-09–S2-11

**Ziel:** Die offenen Wohnungs-Tasks S2-09 (Wände), S2-10 (eigene Möbel) und
S2-11 (warmes Dekor) werden im Renderer abgenommen. R10 plant diese Features
nicht neu und legt keine konkurrierenden Roadmap-Zeilen an; fehlende Arbeit
gehört in die jeweilige S2-Aufgabe.

**Dateien:** `src/core/sim/player-apartment.ts`,
`src/core/sim/room-transition.ts`, `src/render/room-art.ts`,
`src/render/floor-material.ts`, `src/render/scene-cache.ts`,
`src/render/__tests__/apartment-render.test.ts`.

**Aufgaben**

- [ ] S2-09 abnehmen: Wände, Türrahmen und Occlusion aus `wall-art.ts`/
      `wall-occlusion.ts` müssen im Wohnungsbild sichtbar sein. Fehlt etwas,
      wird S2-09 repariert, nicht R10 erweitert.
- [ ] S2-10 abnehmen: Bett, Schrank, Kochnische, Bad und Sofa nutzen eigene
      Wohnungs-Sprites statt Casino-Möbel; die Interaktionen bleiben erhalten.
- [ ] S2-11 abnehmen: Teppich, Lampen, Bilder und Pflanzen folgen der warmen
      Wohnungspalette; kein Neon und kein Automat.
- [ ] Die bereits vorhandene Wohnungs-Palette (`FloorTheme = 'apartment'`,
      Szene im Cache-Schlüssel) als Integrationspfad prüfen; keine zweite
      Materialtabelle und kein zweiter Szenencache.
- [ ] Boden/Wand/Licht aus R4/R5 wiederverwenden; die Haustür bleibt an den
      bestehenden Stadtübergang angebunden.
- [ ] Test: Layout stimmt mit dem Kern überein; Tür führt auf die Straße; kein
      Teleport; Rückweg erhält den Zustand.

**Akzeptanz**

- [ ] S2-09, S2-10 und S2-11 sind abgehakt oder ausdrücklich als offen an die
      jeweilige Roadmap-Zeile zurückgegeben; R10 behauptet keine eigene
      Feature-Implementierung.
- [ ] Die Wohnung ist als eigener Raum sichtbar; der Startpfad bleibt der
      verifizierte S2-07-Pfad.
- [ ] Möbelrollen sind eindeutig; kein Möbelstück wird als Deko geraten.
- [ ] Lokales Bildgate zeigt alle vier Bereiche.
- [ ] Sichtabnahme: alle vier Wohnbereiche und die Tür zur Straße;
      Screenshot, Konsole und Probe nach Abschnitt 8.

**PixiJS-Falle:** Innenraum top-down, keine isometrische Projektion mischen.
Wände als Tiefenobjekte mit Fußanker; Occlusion nicht über `zIndex` aus Namen.

### R11 — Lauf- und Richtungsanimation

**Ziel:** Figuren bewegen sich lesbar, ohne das Rig zu verdoppeln.

**Dateien:** `src/render/guest-rig.ts`, `src/render/actor-silhouette.ts`,
`src/render/entity-sync.ts`, neu `src/render/__tests__/actor-locomotion.test.ts`.

**Aufgaben**

- [ ] Vier Laufframes je Personafamilie und zwei Richtungen; Richtung aus
      Geschwindigkeit, nicht aus einem separaten Zustand.
- [ ] Animation aus Tick/Fortschritt, nicht aus `Date.now()`; deterministisch.
- [ ] Stillstand fällt auf das Standbild zurück; kein Flackern an der
      LOD-Schwelle.
- [ ] Silhouette und Rig teilen dieselbe Actor-ID und dieselbe Position.
- [ ] Test: vier Frames, zwei Richtungen, deterministische Frame-Wahl;
      Stillstand erzeugt keinen Lauframe.

**Akzeptanz**

- [ ] Eine Figur läuft sichtbar in beide Richtungen.
- [ ] Zwei gleiche Ticks erzeugen denselben Frame.
- [ ] Kein zusätzlicher Actor durch den Animationswechsel.
- [ ] Das lokale Bildgate zeigt Lauf und Stillstand.
- [ ] Sichtabnahme: Lauf in beide Richtungen und Stillstand im selben
      Zustand; Screenshot, Konsole und Probe nach Abschnitt 8.

**PixiJS-Falle:** `AnimatedSprite` ist ein Leaf und benötigt eine
Spritesheet-Textur; keine manuelle Textur pro Frame aus URLs. `Ticker` nur der
eine App-Ticker; keine `setInterval`-Animation.

### R12 — Ambient und Wetter

**Ziel:** Die Stadt atmet, ohne die Spielregeln zu übernehmen.

**Dateien:** neu `src/render/city/ambient.ts`,
`src/render/city/weather.ts`, `src/render/__tests__/ambient-director.test.ts`.

**Aufgaben**

- [ ] Ambient-Director mit festem Seed und Tageszeit aus der bestehenden Uhr.
- [ ] Drei bis fünf Ambient-Zustände (Tag, Abend, Nacht, Regen, Nebel) nur als
      Darstellung; keine Wirtschafts- oder NPC-Regel im Renderer.
- [ ] Wetter partikelarm und gepoolt; keine Allokation pro Frame, kein
      unbegrenztes `Graphics`.
- [ ] Reduzierte Bewegung respektieren (`prefers-reduced-motion`), Ambient
      abschaltbar.
- [ ] Test: gleicher Seed und gleiche Tickzahl ergeben denselben Zustand; kein
      Wetterzustand schreibt in den Spielzustand.

**Akzeptanz**

- [ ] Ambient ist deterministisch und abschaltbar.
- [ ] Kein Wettereffekt ändert Ledger, NPC-Plan oder Save.
- [ ] Die Szene bleibt bei 60 fps im lokalen Messlauf; keine neue
      Dauerallokation.
- [ ] Lokales Bildgate zeigt mindestens Tag und Nacht.
- [ ] Sichtabnahme: Tag/Nacht und reduced motion ohne Zustandsänderung;
      Screenshot, Konsole und Probe nach Abschnitt 8.

**PixiJS-Falle:** Partikel nur mit `ParticleContainer`, wenn es viele
gleichartige Sprites sind; sonst gepoolte `Sprite`-Leaves. Kein
`BlurFilter` pro Frame neu erzeugen; Filterressourcen wiederverwenden.

## 5. PixiJS-v8-Guardrails

Diese Regeln sind für alle Phasen verbindlich. Sie verhindern die häufigsten
falschen Implementierungen, die in den angehängten Plänen noch als v7-Muster
stehen könnten.

- **Application:** `const app = new Application(); await app.init({...});`
  Danach `app.canvas` verwenden. Keine Options im Konstruktor, kein
  `app.view`.
- **Hierarchie:** `Container` gruppiert; `Sprite`, `Graphics`, `Text`, `Mesh`
  sind Leaves. Keine Kinder an Leaves hängen.
- **Tiefe:** `sortableChildren` nur auf dem Tiefen-Container; `zIndex` aus
  Fußanker/explizitem Depth-Wert, nicht aus Labels.
- **Bounds:** `getBounds()` liefert `Bounds`; für Rectangle-Methoden
  `.rectangle`. Keine Bounds-Abfrage pro Frame, wenn die Weltgrenzen bekannt
  sind.
- **Events:** `eventMode = "static"` plus `cursor` und ggf. `hitArea`. Für Drag
  `globalpointermove`, nicht `pointermove`. `buttonMode`/`interactive` sind
  keine neuen APIs.
- **Assets:** `Assets.load`/`Assets.get`; `Texture.from(url)` lädt nicht.
  Pixelkunst mit `scaleMode: "nearest"`. Bundles/Unload nur bei echten
  Szenenwechseln.
- **Caching:** `cacheAsTexture()` statt `cacheAsBitmap`; vor `destroy()` wieder
  deaktivieren. Nicht auf animierte Stadtteile anwenden.
- **RenderGroups:** `isRenderGroup` nur für stabile, große Teilbäume. Kein
  pauschales RenderGroup um Szenen, deren Kinder animiert werden.
- **Accessibility:** Canvas allein ist kein Screenreader-Beleg. DOM-Overlay
  oder Pixi-Accessibility mit `accessibleTitle`, `accessibleHint`,
  `tabIndex`; Tastaturpfad testen. `AccessibilitySystem` wird erst nach Tab
  aktiv, wenn `enabledByDefault` nicht gesetzt ist.
- **Farben:** `Color`/`Color.shared` für Konvertierung; keine neuen Rohfarben
  im Kern. `blendMode` an Kindern, nicht an der Gruppe mit gemischten Modis.
- **Umgebung:** Browser bleibt der Zielpfad. Kein `DOMAdapter`-Umbau ohne
  konkreten Worker-/SSR-Bedarf; kein Node-Renderer als Ersatz für den
  Browserbeleg.
- **Performance:** ein `Application`, ein Ticker, keine Allokation pro Frame,
  keine `setInterval`-Schleife, keine unbegrenzten Graphics-Listen.

## 6. Meilensteine

Die Meilensteine sind Exit-Punkte, keine Kalenderdaten. Ein Meilenstein ist erst
erreicht, wenn alle genannten Phasen ihr Akzeptanz- und Sichtabnahme-Ergebnis
haben; ein grüner Einzeltest reicht nicht. Die Roadmap führt dieselben IDs als
grobe Produkt-Etappen (R-0 bis R-4), dieser Plan bleibt die Detail-Todo.

| ID | Name | Phasen | Exit-Kriterium | Roadmap |
| --- | --- | --- | --- | --- |
| M0 | Wahrheit und Bildgate | R0–R1 | Baseline, Rollen, Rechte und vier reproduzierbare Szenen sind belegt; kein Cloud-Gate | R-0 |
| M1 | Ehrlicher Casino-Render | R2–R6 | Platzhalter, Figuren, Materialien, Licht und Kamera bestehen Akzeptanz und Sichtabnahme; kein grüner Fallback | R-1 |
| M2 | Stadt sichtbar | R7–R8 | Der bestehende S2-12-Stadtkern ist als Straßenraum sichtbar, Türen nutzen den bestehenden Wechsel, Assets haben Rollen | R-2 |
| M3 | Stadt lebt, Wohnung abgenommen | R9–R10 | NPCs, Türen und Begegnungen sind sichtbar; S2-08 ist im Browser belegt; S2-09–S2-11 sind abgehakt oder offen zurückgegeben | R-3 |
| M4 | Bewegung und Ambient | R11–R12 | Laufframes und Ambient sind deterministisch, reduced-motion-fähig und im lokalen Messlauf stabil; darf zurückgestellt werden | R-4 |

M0 ist die Basis für jede Aussage über den Renderzustand. M1–M3 sind die
Release-Blocker der Phase 3R. M4 ist die letzte P2-Ausbaustufe und darf
zugunsten von M1–M3 zurückgestellt werden. R7 kann erst starten, wenn S2-12
vorliegt; R10 kann erst abschließen, wenn S2-09–S2-11 belegt oder ausdrücklich
zurückgegeben sind.

## 7. Roadmap-Kopplung

Die Roadmap ist die Produktquelle, dieser Plan die Ausführungsquelle. Es gibt
keine dritte Statusliste und keine stillen Statuswechsel. Die Kopplung ist
verbindlich:

| Plan | Roadmap-Zeile | Statusführer |
| --- | --- | --- |
| R0–R1 / M0 | R-0 | Plan-Checkbox und Bildgate-Beleg; Roadmap erst bei M0 |
| R2–R6 / M1 | R-1 | Plan-Checkboxen je Phase; Roadmap erst bei M1 |
| R7–R8 / M2 | R-2 | Plan-Checkboxen je Phase; Roadmap erst bei M2 |
| R9–R10 / M3 | R-3 | Plan-Checkboxen je Phase; Roadmap erst bei M3 |
| R11–R12 / M4 | R-4 | Plan-Checkboxen je Phase; Roadmap erst bei M4 oder Zurückstellung |

**Regeln für die gemeinsame Bearbeitung**

- Eine Änderung an Reihenfolge, Abhängigkeit oder Umfang wird im selben Commit
  in diesem Plan und in der Roadmap-Zeile nachgezogen. Keine neue,
  konkurrierende Roadmap-Zeile für dieselbe Arbeit.
- `S2-*`-Zeilen bleiben die Quelle für Spielumfang. R7 und R10 dürfen sie
  referenzieren und im Renderer abnehmen, aber nicht durch eigene
  Feature-Zeilen ersetzen.
- `PR-07` und `S2-08` bleiben offen, bis der vollständige Browserbeleg
  vorliegt. Einzelne Slice-Screenshots sind Belege auf dem Weg dorthin, kein
  automatischer Abschluss.
- Ein Meilenstein wird in der Roadmap erst `erledigt`, wenn die Sichtabnahme
  aus Abschnitt 8 vorliegt; `verifiziert` braucht den Browserbeleg ohne neuen
  Code. Die Detailstatuses R0–R12 bleiben ausschließlich in diesem Plan.
- Generierte Roadmap-Bestandteile werden über `node scripts/sync-generated.mjs`
  gepflegt, nie per Hand. Die Statusentscheidung selbst bleibt eine bewusste
  Doku-Änderung mit Beleg.

## 8. Preview-Sichtabnahme im lokalen Dev-Server

Gilt für jeden sichtbaren Slice R2–R12. R0 und R1 liefern Baseline und
Bildgate; R1 ist kein Ersatz für die Sichtabnahme.

**Regel:** Der Agent führt die Abnahme nach der Implementierung des Slices und
vor dem Abhaken der Phase selbst durch. Ein Unit-Test, ein Pixel-Diff oder ein
grüner Build ohne Browserbeleg ist kein Phasenabschluss.

**Ablauf**

1. `pnpm run dev` starten (Vite, `http://localhost:3000`; kein Cloud-Runner).
2. Deterministischen Zustand herstellen: frischer Spielstand bzw. benannter
   Seed, Szene und Tick; Viewport 1024×768, DPR 2. Keine manuell veränderten
   Spielstände als Beweis.
3. Vorher/Nachher mit dem vorhandenen GameScout-/Playwright-Pfad
   (`packages/gamescout`) aufnehmen; kein zweiter Browser-Stack, kein neuer
   Prozess pro Szene.
4. Konsole, Page-Errors und fehlgeschlagene Requests prüfen: null Fehler.
5. Simulationswahrheit über `window.__rbdProbe` prüfen (`getOverview`,
   `getFurniture`, `compareRenderAndSim`); wenn die Probe für den Slice nicht
   verfügbar ist, den Grund im Beleg nennen und den zustandsbezogenen Test
   zusätzlich ausführen.
6. Screenshot unter `docs/screenshots/current/` mit der nächsten freien Nummer
   und sprechendem Slice-Namen ablegen; Vorher/Nachher unter
   `docs/screenshots/comparison/` mit Version und Slice. Bestehende Bilder
   werden nicht überschrieben.
7. Im Phasenbeleg `PASS`, `FAIL` oder `INCONCLUSIVE` eintragen, mit
   Screenshot-Pfad, Szenen-/Tick-Angabe, Konsolenstatus und Probe-Ergebnis.
8. Bei `FAIL`/`INCONCLUSIVE`: Phase bleibt offen; kein Baseline-Update und kein
   Weiterhaken. Erst reparieren, dann erneut aufnehmen; kein Retry-Loop.

**Kein Gate:** Die Sichtabnahme läuft nicht in `ci:local`, `verify:all`, einem
GitHub-Workflow oder als Screenshot-Pflicht in jedem Test. Sie ist der
Abschlussbeleg des Slices, nicht ein zweiter Testpfad.

**Sichtbare Slice-Matrix**

| Phase | Preview-Zustand | Muss sichtbar sein | Beleg |
| --- | --- | --- | --- |
| R2 | Casino, unbekanntes Möbel | Gestrichelte Kontur, Rollen-/Assetname, kein `0x2dd4a0` | `docs/screenshots/current/16-r2-platzhalter.png` |
| R3 | Casino, Gast nah und fern | Silhouette als Person, kein 6×6-Pin, LOD-Wechsel ohne Duplikat | `docs/screenshots/current/17-r3-silhouette.png` |
| R4 | Casino, Raum mit Teppich | Sechs unterscheidbare Materialien, genau ein Bodenknoten | `docs/screenshots/current/18-r4-materialien.png` |
| R5 | Casino, Lichtquellen | Lichtfläche und sichtbare Quelle, keine Ellipsen | `docs/screenshots/current/19-r5-licht.png` |
| R6 | Casino, Zoom/Pan an der Weltgrenze | Weltgrenzen, Parallaxe, genau ein LOD-Wechsel | `docs/screenshots/current/20-r6-kamera.png` |
| R7 | Stadt, Straße und Tür | Straßenraum, Türen, kein Teleport, kein zweiter Stadtgraph | `docs/screenshots/current/21-r7-stadt.png` |
| R8 | Stadt, Assetpaket | Rollen, Welten und Skalierung sichtbar korrekt | `docs/screenshots/current/22-r8-stadtassets.png` |
| R9 | Stadt, NPC-Weg, Tür, Begegnung | NPC von A nach B, stabile Actor-ID, ein Fact | `docs/screenshots/current/23-r9-stadtleben.png` |
| R10 | Wohnung, vier Bereiche | S2-09–S2-11 sichtbar; Tür führt auf die Straße | `docs/screenshots/current/24-r10-wohnung.png` |
| R11 | Casino/Stadt, Lauf und Stillstand | Beide Richtungen, deterministischer Frame, kein Duplikat | `docs/screenshots/current/25-r11-lauf.png` |
| R12 | Stadt, Tag und Nacht | Ambient und reduced motion, keine Zustandsänderung | `docs/screenshots/current/26-r12-ambient.png` |

Die Aufnahmen sind Belege für `PR-07` und `S2-08`, schließen sie aber erst,
wenn der vollständige Screenshot-Satz bzw. der vertikale Pfad belegt ist. R10
darf S2-09–S2-11 nur abhaken, wenn deren eigene Akzeptanz vorliegt.

## 9. Prüfpfad und Abschluss je Phase

Jede Phase endet mit dem kleinsten passenden lokalen Nachweis:

1. **Typ/Logik:** `pnpm run typecheck` und der genannte Vitest-Fokus.
2. **Render:** lokales Bildgate aus R1, vier Szenen, dreimal stabil.
3. **Sichtabnahme:** für R2–R12 nach Abschnitt 8; der Beleg gehört zum
   Phasenabschluss.
4. **Doku:** `pnpm run verify:docs` und die betroffenen Referenzen in
   `ROADMAP.md`/`ARCHITECTURE.md`.
5. **Gesamt:** `pnpm run verify:light`; `verify:all` nur, wenn die Phase den
   gemeinsamen Baum oder die Testline berührt.
6. **Kein Cloud-Gate:** kein neuer Workflow, kein `.circleci/`, kein
   `.github/workflows/`, kein Retry um einen roten lokalen Lauf.

**Phasen-Fertig heißt:**

- [ ] Alle Aufgaben der Phase sind abgehakt oder ausdrücklich als
      „zurückgestellt“ mit Grund markiert.
- [ ] Die Akzeptanzliste ist vollständig belegt.
- [ ] Das lokale Bildgate ist grün und der Baseline-Stand ist erklärt.
- [ ] Für R2–R12: Sichtabnahme nach Abschnitt 8 ist `PASS`; Screenshot,
      Konsole und Probe liegen vor.
- [ ] Kein neuer Cloud-/CI-Pfad und keine neue Endlosschleife.
- [ ] Die betroffenen Doku-Stellen sind aktualisiert, nicht nur dieser Plan.
- [ ] Commit und Push sind erfolgt; ein Merge nach `main` braucht eine
      ausdrückliche Anweisung.

## 10. Adversarialer Review

Geprüft gegen den Baum `0.3.233`, die Roadmap-Phase 3R und die lokale
Testlinie. Die Befunde sind eingearbeitet; offene Abhängigkeiten sind
Produktblocker, keine stillen Planannahmen.

| Befund | Risiko | Entscheidung |
| --- | --- | --- |
| Plan nannte `0.3.232`, `main` steht auf `0.3.233` | Baseline driftet vor dem ersten Lauf | Stand und R0 auf `0.3.233`; R0 misst den echten Baum neu |
| R3/R4/R5 sollten parallel nach R1 laufen, R4 verlangt aber R2 | falsche Reihenfolge | R3/R5 parallel nach R1; R4 nach R2 |
| R1 definierte drei Szenen, R10 verlangt vier Wohnbereiche | kein Wohnungsbaseline | R1 nimmt vier Szenen inklusive Wohnung auf |
| Meilensteine standen nur als Prosa | kein gemeinsamer Exit | M0–M4 mit Exit-Kriterien und Roadmap-Zuordnung |
| Keine Agent-Sichtabnahme war verlangt | grüner Test bei falschem Bild | Abschnitt 8 ist für R2–R12 verbindlich |
| `PR-07`/`S2-08` sind offen, aber Screenshots waren geplant | Scheinabschluss | Aufnahmen sind Belege, Status bleibt bis zum Vollbeleg offen |
| Sichtabnahme könnte zum Gate werden | Testline wird langsamer | ausdrücklich nicht in `ci:local`, `verify:all` oder Cloud |
| Roadmap und Plan konnten auseinanderlaufen | zwei Statuswahrheiten | Abschnitt 7: eine Statusquelle, Änderung im selben Commit |
| R7 wartet auf S2-12; R10 auf S2-09–S2-11 | Meilenstein blockiert | explizite Abhängigkeit, keine neue konkurrierende Roadmap-Zeile |

**Nicht als Planfehler gewertet:** R0 bleibt framework-frei und R1 ist kein
Cloud-Gate. Die Bildgate-Szenen sind bewusst lokal und werden nicht in die
reguläre Testline gehängt. Die offenen S2-Abhängigkeiten bleiben offen, bis
ihre eigenen Belege vorliegen.

## 11. Nicht in diesem Plan

- Kein Rewrite der Simulation und kein neues Save-Schema ohne eigenen
  Migrationsnachweis.
- Kein neuer Cloud-Runner, kein GitHub-Workflow und kein Screenshot-Gate in
  `ci:local`.
- Keine 418 ungenutzten Assets „vorsorglich“ laden.
- Keine Stadtökonomie, keine neue NPC-KI und keine neue Narrativmaschine.
- Keine v7-Pixi-Muster (`beginFill`, `cacheAsBitmap`, `Texture.from(url)`,
  `new Application({...})`, `app.view`).

## 12. Referenzen

- [`ROADMAP.md`](ROADMAP.md) — Produktreihenfolge, offene Punkte, Phasen 1–7.
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — Zustandsbesitz, Render-Grenzen,
  Living-World-Leitentscheidungen.
- [`TESTING.md`](TESTING.md) — lokale Testline und Mechanik-Tests.
- [`CI.md`](CI.md) — lokale Required-Gates; dieser Plan fügt kein Cloud-Gate
  hinzu.
- [`packages/gamescout/AGENTS.md`](../packages/gamescout/AGENTS.md) — lokaler
  Browser-/Screenshot-Pfad und Sichtwahrheit.
- [`screenshots/current/`](screenshots/current/) — kanonischer Satz für die
  Sichtabnahmen; Vergleichsbilder liegen unter `screenshots/comparison/`.
