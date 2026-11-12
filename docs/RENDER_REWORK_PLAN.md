# Render- und Living-World-Rework — Task-Phasen

**Zweck:** Dieser Plan ist die ausführbare Todo hinter der Render- und
Living-World-Roadmap. Er beschreibt Reihenfolge, Abhängigkeiten, Dateien, Tests
und Abnahmekriterien. Die Produktplanung bleibt in [`ROADMAP.md`](ROADMAP.md);
die Architekturgrenzen stehen in [`ARCHITECTURE.md`](ARCHITECTURE.md).

**Stand:** 2026-11-12 · Baum `0.3.232` · Audit-Basis `0.3.231`

**Status:** Plan, noch keine Umsetzung. Die Kästchen werden nur mit Beleg
abgehakt; ein grüner Teilcheck ist kein grüner Phasenabschluss.

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

## 3. Reihenfolge

R0–R1 sind die Basis. R2–R6 härten den bestehenden Casino-Render, bevor die
Stadt daraufsetzt. R7 ist der sichtbare Schnitt; R8–R12 bauen in dieser
Reihenfolge darauf auf. R3, R4 und R5 dürfen nach R1 parallel laufen; R7 wartet
auf R2, R6 und den Stadtkern S2-12. R10 plant die Wohnung nicht neu: es nimmt
die offenen S2-09–S2-11 im Renderer ab.

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

**Meilensteine:** R1 ist der erste lokale Beweis. R7 ist die erste sichtbare
Stadtansicht auf dem Stadtkern S2-12. R9 ist der erste „lebendige“ Meilenstein.
R12 ist die letzte P2-Ausbaustufe und darf zugunsten von R7–R10 zurückgestellt
werden.

## 4. Task-Phasen

### R0 — Baseline, Rolleninventar und Rechte

**Ziel:** Eine belastbare Ausgangsmessung, damit später niemand „besser“ behauptet,
ohne es zu messen.

**Dateien:** `src/render/assets/manifest.json`, `src/render/assets/__tests__/asset-semantics.test.ts`,
`docs/RENDER_REWORK_PLAN.md`, `docs/ROADMAP.md` (nur Referenzen), ggf.
`docs/ASSET-LICENSES.md` (neu, nur wenn die Rechteprüfung es verlangt).

**Aufgaben**

- [ ] Render-Inventar am Baum `0.3.232` neu zählen: Dateien, Assets, benutzte
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

- [ ] Fixe Szene definieren: Casino-Übersicht, Casino-Detail, Stadt-Platzhalter.
      Jeweils fester Seed, feste Tickzahl, feste Kamera, fester Ausschnitt.
- [ ] Sichtbaren Frame über den vorhandenen Browserpfad aufnehmen; keine
      `Texture.from(url)`-Abkürzung und keine neue Root-Abhängigkeit.
- [ ] Drei Szenen in einem Lauf aufnehmen, nicht pro Szene einen Browser starten.
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

**Aufgaben**

- [ ] **S2-12 bleibt der Kern:** Das Stadtnetz und die Ortskanten kommen aus
      `city-scene.ts`/`city.ts`; R7 baut keinen zweiten Szenengraphen und keine
      zweite Wegewahrheit.
- [ ] `CityExteriorModel` als Adapter aus `createCityExteriorModel()` lesen;
      der Renderer importiert keine Test-Fixtures und keine UI-Popup-Daten.
- [ ] `city-popup.tsx` und die alte `city-scene`-Darstellung auf den Adapter
      umstellen oder als Menüzugang stilllegen; keine parallele Stadtansicht.
- [ ] Straßen, Gehwege, Kreuzungen, Laternen, Gebäude und Türen aus dem Modell
      rendern; Tiefe über Fußanker, nicht über Namenssortierung.
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
      und ohne Duplikat.
- [ ] Die Stadt ist im lokalen Bildgate als Straßenraum erkennbar, nicht als
      Platzhalterfläche.
- [ ] Ein nicht begehbarer Ort ist sichtbar als Kulisse markiert, nicht als
      Tür.

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

**PixiJS-Falle:** Innenraum top-down, keine isometrische Projektion mischen.
Wände als Tiefenobjekte mit Fußanker; Occlusion nicht über `zIndex` aus Namen.

### R11 — Lauf- und Richtungsanimation

**Ziel:** Figuren bewegen sich lesbar, ohne das Rig zu verdoppeln.

**Dateien:** `src/render/guest-rig.ts`, `src/render/actor-silhouette.ts`,
`src/render/entity-sync.ts`, neu `src/render/__tests__/actor-locomotion.test.ts`.

**Aufgaben**

- [ ] Vier Lauframes je Personafamilie und zwei Richtungen; Richtung aus
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

## 6. Prüfpfad und Abschluss je Phase

Jede Phase endet mit dem kleinsten passenden lokalen Nachweis:

1. **Typ/Logik:** `pnpm run typecheck` und der genannte Vitest-Fokus.
2. **Render:** lokales Bildgate aus R1, drei Szenen, dreimal stabil.
3. **Doku:** `pnpm run verify:docs` und die betroffenen Referenzen in
   `ROADMAP.md`/`ARCHITECTURE.md`.
4. **Gesamt:** `pnpm run verify:light`; `verify:all` nur, wenn die Phase den
   gemeinsamen Baum oder die Testline berührt.
5. **Kein Cloud-Gate:** kein neuer Workflow, kein `.circleci/`, kein
   `.github/workflows/`, kein Retry um einen roten lokalen Lauf.

**Phasen-Fertig heißt:**

- [ ] Alle Aufgaben der Phase sind abgehakt oder ausdrücklich als
      „zurückgestellt“ mit Grund markiert.
- [ ] Die Akzeptanzliste ist vollständig belegt.
- [ ] Das lokale Bildgate ist grün und der Baseline-Stand ist erklärt.
- [ ] Kein neuer Cloud-/CI-Pfad und keine neue Endlosschleife.
- [ ] Die betroffenen Doku-Stellen sind aktualisiert, nicht nur dieser Plan.
- [ ] Commit und Push sind erfolgt; ein Merge nach `main` braucht eine
      ausdrückliche Anweisung.

## 7. Nicht in diesem Plan

- Kein Rewrite der Simulation und kein neues Save-Schema ohne eigenen
  Migrationsnachweis.
- Kein neuer Cloud-Runner, kein GitHub-Workflow und kein Screenshot-Gate in
  `ci:local`.
- Keine 418 ungenutzten Assets „vorsorglich“ laden.
- Keine Stadtökonomie, keine neue NPC-KI und keine neue Narrativmaschine.
- Keine v7-Pixi-Muster (`beginFill`, `cacheAsBitmap`, `Texture.from(url)`,
  `new Application({...})`, `app.view`).

## 8. Referenzen

- [`ROADMAP.md`](ROADMAP.md) — Produktreihenfolge, offene Punkte, Phasen 1–7.
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — Zustandsbesitz, Render-Grenzen,
  Living-World-Leitentscheidungen.
- [`TESTING.md`](TESTING.md) — lokale Testline und Mechanik-Tests.
- [`CI.md`](CI.md) — lokale Required-Gates; dieser Plan fügt kein Cloud-Gate
  hinzu.
