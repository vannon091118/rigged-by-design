# Style Guide — Rigged by Design

<!-- rbd-doc: managed -->

**Zweck:** Ein verbindlicher Art-Vertrag fuer Environment, NPCs und den
Charaktereditor. Die Regeln beschreiben den Bestand, nicht einen Wunschzettel:
Was hier steht, muss in `docs/art-needs.md` als offener Bedarf auftauchen, wenn
es noch kein Asset dafuer gibt.

**Gueltig ab:** Phase 1 (2026-11-18). Aenderungen an Palette, Perspektive oder
LOD-Regeln brauchen eine eigene Lane und einen neuen Audit.

## 1. Perspektive und Kamera

- **3/4-Top-Down.** Der Boden liegt flach in der Bildebene, Gebaeude zeigen ihre
  Suedfassade. Kein Fluchtpunkt, keine perspektivische Verkuerzung, keine
  Kamera-Rotation.
- **Fusslinie ist der Anker.** Jedes Sprite wird an seiner unteren Kante
  platziert und nach dieser Linie tiefensortiert. Ein Baum mit 128 px Hoehe
  ueberragt eine 64-px-Bank, ohne dass sich seine Bodenposition aendert.
- **Hoehe ist Pixelhoehe.** Ein Objekt wird nicht skaliert, um Naehe zu zeigen;
  Naehe entsteht ueber die Kameraskala, nicht ueber einzelne Sprites.
- **Schatten** liegen als flache Ellipse unter dem Fuss, nie als geworfene
  Perspektivschatten. Ausnahme ist der weiche Lichtpool (`light-pool.svg`).

## 2. Raster, Pixelbasis und Skalierung

| Einheit | Wert | Verwendung |
| --- | --- | --- |
| Pixelbasis | **32 px** | kleinste Designeinheit fuer Proportionen |
| Bodentile | 64 × 64 px | 2 × 2 Basis, nahtlos kachelbar |
| Tuer | 96 × 24 px | Fassadenbreite, flacher Rahmen |
| Fassade | 256 × 192 px | Stadtbild, Suedansicht |
| Requisite | 64–128 px hoch | Bank, Laterne, Baum, Eimer |
| Kopf | 32 × 36 px | Charakter-Portrait und NPC-Kopf |
| Uebersichts-Silhouette | 12 × 16 px | LOD ohne Detail-Rig |

- Texturen laufen mit `scaleMode: 'nearest'`. Keine bilineare Glaettung, keine
  Mipmaps, keine Rotation mit Filterung.
- Positionen und Groessen sind ganzzahlig. Halbe Pixel erzeugen weiche Kanten
  und brechen die Pixelsprache.
- Ein SVG ist eine **Quelle**, kein Laufzeit-Asset. Es wird im Build auf seine
  viewBox-Groesse gerastert und in den Atlas gepackt.

## 3. Palette

Die Werte sind aus den bestehenden Environment-SVGs und PNGs gezogen. Neue
Assets bedienen sich hier; ein neuer Farbton braucht einen Eintrag und einen
Grund.

| Rolle | Hex | Einsatz |
| --- | --- | --- |
| Nachtgrund | `#0b0712` | Hintergrund, tiefste Flaeche |
| Pflaume | `#120a1e` / `#1b0f0e` | Teppich, Polster, Schattenraum |
| Gold | `#ffd166` / `#ffe6a3` | Lichtkanten, Schilder, Casino-Akzent |
| Amber | `#f2bd72` / `#c08a62` | Holzlicht, Haut, warme Reflexe |
| Neon-Teal | `#35c8b0` / `#9dffe4` | kalte Rim-Light, Screens, Deko |
| Holz | `#8b5a2b` / `#5a3326` | Planken, Theke, Rahmen |
| Stein | `#4d4655` / `#7c8780` | Beton, Marmor, Gehweg |
| Haut | `#c08a62` / `#9a6855` | Gesichter, Haende |
| Papier | `#ffffff` / `#e6f3e4` | Highlights, Lichtkegel, Text |

**Verhaeltnis:** 70 % dunkle Flaeche, 20 % Materialmittelton, 10 % Gold/Teal.
Ein Sprite darf hoechstens drei Helligkeitsstufen je Material besitzen.

## 4. Lichtmodell

- **Key Light** kommt von links oben, warm (`#ffd166`), mit einer harten
  Lichtkante und einer dunkleren Gegenflaeche.
- **Rim Light** ist kalt (`#35c8b0`) und sitzt an der rechten oder unteren
  Kante, damit Figuren vor dunklen Fassaden lesbar bleiben.
- **Kontur** ist `#0a0612` mit 1 px, bei grossen Fassaden 2 px. Die Kontur ist
  dunkler als jeder Fuellton, nie schwarz und nie grau.
- **Kontaktschatten** ist `#0a0612` bei 35 % Deckkraft, direkt unter dem Fuss.
- Verlaeufe sind nur fuer Licht und Rauch erlaubt, nie fuer Material. Holz,
  Stein und Stoff werden mit zwei bis drei flachen Toenen modelliert.

## 5. Materialregeln

- **Holz:** lange Maserung in Plankenrichtung, Fugen als 1-px-Linie, kein
  Ziegelmuster. Eine Diele ist 16–32 px breit.
- **Stein/Beton:** grosse ruhige Flaechen, wenige Sprenkel, Risse nur als
  kurze, gerichtete Linie. Keine zufaelligen Kritzel.
- **Metall:** zwei Werte plus eine helle Kante; keine Spiegelung, kein
  Verlauf.
- **Stoff/Teppich:** wiederholbares 512er-Tile, Motivabstand mindestens 32 px,
  damit die Kachel bei 1× nicht flimmert.

## 6. NPCs, LOD und Identitaet

Diese Regeln binden Phase 2 (NPC-Rig) und Phase 3 (Editor) an dieselbe Quelle:

1. **LOD reduziert Detail, nie Identitaet.** Die 12 × 16-Silhouette behaelt
   Kopf, Koerper und zwei Beine. Sie ist kein Pin und kein Quadrat. Kopfform,
   Outfit-Farbe und Haarton bleiben aus der Ferne erkennbar.
2. **Eine Sprite-Quelle fuer Editor und Spiel.** Der Editor zeigt denselben
   Kopf, dieselbe Frisur und dieselbe Outfit-Palette wie die Szene. Es gibt
   keinen zweiten Editor-Zeichenpfad.
3. **Kopf ist Identitaet.** `head-01-*` und `head-02-*` sind die zwei
   bestehenden Familien. Eine dritte Familie (`head-03-01`) fehlt und ist in
   `docs/art-needs.md` als Bedarf gefuehrt, nicht als Datei erfunden.
4. **Outfit bleibt flaechig.** Ein Outfit hat eine Hauptfarbe, eine
   Schattenfarbe und hoechstens einen Akzent. Keine Muster, die im LOD zu
   Rauschen werden.
5. **Animation aendert die Silhouette nicht.** Ein Schritt verschiebt Beine und
   Arme, aber nicht die Grundhoehe oder den Anker.

## 7. Charaktereditor

- Raster: 32-px-Einheiten, Vorschau in 1× und 2× mit `nearest`.
- Palette: nur Tokens aus Abschnitt 3. Freie Hex-Eingaben sind kein Feature.
- Kopf, Haut, Haare und Outfit kommen aus denselben Maps wie die Szene
  (`ASSET.heads`, `RUNTIME_ART`). Der Editor ist eine Produktionsfigur, keine
  Vorschaugrafik.
- Jede Auswahl muss im LOD als Silhouette lesbar bleiben; der Editor zeigt
  deshalb eine 12 × 16-Vorschau neben der Detailansicht.

## 8. Asset-Pipeline

1. SVG-Quelle liegt unter `public/assets/casino/environment/`.
2. `scripts/build-asset-manifest.mjs` rastert sie mit `@resvg/resvg-js` auf
   viewBox-Groesse zu 8-Bit-RGBA und packt sie in die bestehenden Atlasseiten.
3. `src/render/assets/manifest.json` nennt die Frame-Pfade; `textureFor` liefert
   sie aus dem Atlas. Es gibt **keinen** Runtime-SVG-Fetch als Ersatz.
4. Neue Assets brauchen: Quelle, Manifest-Eintrag, Atlas-Frame und einen
   Audit-Eintrag in `docs/art-needs.md`.

## 9. Abnahme

- 1× und 2× auf 360 px und 390 px Breite geprueft; Kanten bleiben hart.
- Kein Sprite verliert im LOD seine Kopf-/Koerper-/Beinlesbarkeit.
- Palette und Kontur sind konsistent; kein Asset nutzt einen nicht gelisteten
  Farbton als Hauptfarbe.
- `pnpm run typecheck`, die Asset-Tests und `pnpm run build` sind gruen.
