# Asset-Semantik: Katalog und Metadatenvertrag

Dieses Dokument beschreibt den Katalog `src/render/assets/asset-semantics.json`.
Er ist eine **Bestandsaufnahme plus Vertrag**, kein Renderer-Eingang: kein Modul
liest die Datei, sie ändert kein Bild und keinen Spielzustand. Die Quelle für IDs
und Pfade bleibt ausschließlich `src/render/assets/manifest.json`.

## Grenze zum Manifest

| Frage | Antwort | Ort |
| --- | --- | --- |
| Welche Assets gibt es? | Manifest | `manifest.json` |
| Wie heißt ein Asset stabil? | Manifest-Referenz (Pfad bzw. ID) | `manifest.json` |
| Wo liegt die Datei? | Manifest (`base` + Referenz) | `manifest.json` |
| Welche Rolle spielt ein Asset? | Katalog | `asset-semantics.json` |
| Wie groß ist das Bild sichtbar? | Katalog (aus Atlasseiten), sonst `unknown` | `asset-semantics.json` |
| Wo sitzt es im Spiel? | Core (Furniture, Zonen, Sitze) | `src/core/` |

Der Katalog führt **keine** zweite Asset-ID, keinen zweiten Pfad, keine
Zonenkopie, keine Materialdefinition und keine Simulationsgeometrie. Wo Zahlen
aus dem Manifest gebraucht werden (Frames, Emitterwerte, Tonspur), steht ein
Verweis der Form `{"from": "manifest.animations.coin-spin.frames"}` mit
`count`, niemals eine Kopie.

## Inventar (Stand 0.3.122)

552 Einträge: 539 Bilder, 3 Animationen, 4 Emitter, 6 Tonspuren.
153 Bilder liegen auf zwei gepackten Atlasseiten.

| Kategorie | Einträge | im Atlas | sichtbare Bounds | Code-Beleg (Welt) | Code-Beleg gesamt | Größe |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `symbols` | 24 | 0 | 0 | 9 | 9 | 82 KB |
| `machines` | 54 | 54 | 54 | 15 | 16 | 476 KB |
| `decor` | 28 | 28 | 28 | 18 | 18 | 244 KB |
| `plinko` | 46 | 0 | 0 | 8 | 8 | 134 KB |
| `ui` | 70 | 0 | 0 | 0 | 7 | 151 KB |
| `characters` | 69 | 69 | 69 | 18 | 18 | 100 KB |
| `environment` | 2 | 2 | 2 | 2 | 2 | 60 KB |
| `fx` | 246 | 0 | 0 | 17 | 17 | 374 KB |
| `animations` | 3 | – | – | 3 | 3 | – |
| `emitters` | 4 | – | – | 4 | 4 | – |
| `music` | 6 | – | – | 0 | 6 | 13,7 MB |
| **Summe** | **552** | **153** | **153** | **87** | **108** | **15,3 MB** |

444 Bilder haben keinen Code-Bezug (418 ohne jede Referenz, 26 nur über die Asset-Bibliothek). Sie liegen im Bestand und sind über die
Asset-Bibliothek sichtbar; ihr Typ stammt aus dem Paketordner und ist im
Katalog mit `"evidence": "category"` markiert. Nur 95 Bilder und die 13
Manifest-IDs tragen `"evidence": "code"`: dort belegt eine Quelle im Baum die
Rolle.

## Asset-Typen

Die Trennung ist eine Rolle, keine Dateiendung. `interactive` ist derzeit
**leer** — siehe Befund unten.

| Typ | Bedeutung | Pflicht zusätzlich zu den gemeinsamen Feldern |
| --- | --- | --- |
| `placeable` | Textur zeigt den Körper eines platzierbaren Möbels | `anchor`, `role` |
| `decorative` | feste Requisite an einer Zone, kein Spielzustand | `anchor`, `role` |
| `ui` | Bild im DOM (HUD, Popup, Icon) | `role` |
| `fx` | Partikel, Impacts, Verlaufsbilder | – |
| `environment-tile` | wiederholbare Kachel (Boden, Tapete) | `anchor`, `bounds` |
| `character-part` | Figurteil, Aufhängepunkt statt Fußpunkt | `anchor` |
| `game-piece` | Teil einer Spielbühne (Walze, Plinko, Tisch) | `anchor` |
| `animation` | Frame-Folge, Frames bleiben im Manifest | `frames`, `fps`, `loop` |
| `emitter` | Partikelkonfiguration, Zahlen bleiben im Manifest | `config`, `textures` |
| `audio` | Tonspur ohne Sichtbarkeit | `path` |
| `interactive` | Textur trägt selbst eine Interaktion | `anchor`, `bounds` |
| `unknown` | kein Code-Beleg für die Rolle | – |

Gemeinsame Pflichtfelder für jeden Eintrag:
`category`, `type`, `bounds`, `depth`, `occlusion`, `lod`, `interactive`,
`usedBy`, `evidence`. Pflicht heißt: **Feld vorhanden**. Der Wert darf
`"unknown"` sein, wenn es keinen Beleg gibt.

Verteilung über die 539 Bilder: `fx` 246, `game-piece` 73, `ui` 71,
`character-part` 69, `placeable` 64, `decorative` 14,
`environment-tile` 2, `unknown` 0, `interactive` 0.

### Sichtbare Bounds versus Gameplay-Footprint

`bounds` sind die Bildmaße aus den Atlasseiten (`{"w":104,"h":145}` etwa für
den Slot-Schrank) oder `"unknown"`. Sie sind **keine** Belegung im Raster:
Sitzplätze, Kollision, Laufwege, Zonen und Platzierungsregeln bleiben im Core.
Ein Möbel mit `2×3` Feldern darf eine Textur mit anderem Seitenverhältnis
tragen; der Renderer skaliert sie auf seine Objektgröße.

## Metadatenvertrag je Eintrag

```json
"machines/slot-cabinet.png": {
  "category": "machines",
  "type": "placeable",
  "role": "Furniture-Korpus nach gameId | HUD-/Spiel-Icon",
  "anchor": {"x": 0, "y": 0},
  "bounds": {"w": 104, "h": 145},
  "depth": {"class": "object-body", "layer": "furniture", "order": 4},
  "occlusion": "paint-order",
  "lod": "always",
  "variants": [],
  "animations": [],
  "interactive": "unknown",
  "usedBy": ["src/render/furniture-atlas.ts", "src/ui/icons.ts"],
  "evidence": "code"
}
```

| Feld | Werte | Bedeutung |
| --- | --- | --- |
| `category` | Manifest-Kategorie | Herkunft im Paket, nicht die Rolle |
| `type` | siehe Tabelle | Rolle im Spiel |
| `role` | freie Liste, ` \| `-getrennt | konkrete Bindung laut Code |
| `anchor` | `{x,y}` in 0..1 oder `"unknown"` | Pivot beim Zeichnen |
| `bounds` | `{w,h}` oder `"unknown"` | sichtbare Bildmaße aus dem Atlas |
| `depth.class` | `environment-tile`, `room-dressing`, `object-body`, `game-piece`, `figure`, `fx-world`, `ui-dom`, `audio-nonvisual`, `unknown` | Tiefenklasse |
| `depth.layer` | `room`, `carpet`, `dirt`, `furniture`, `props`, `cues`, `actors`, `stickers`, `fx`, `game-board`, `slot-reels`, `dom-ui`, `audio`, `unknown` | Zeichenebene |
| `depth.order` | 1..9 oder `"unknown"` | Position dieser Ebene in `floor-view.ts` |
| `occlusion` | `paint-order`, `mask-clipped`, `none`, `unknown` | wie Verdeckung entsteht |
| `lod` | `always`, `detail-only`, `overview-silhouette`, `unknown`, `not-applicable` | Verhalten zwischen Übersicht und Detail |
| `variants` | Liste von Manifest-Referenzen | Geschwister aus derselben Familie |
| `animations` | Liste von `manifest.animations`-IDs | optionale Animationsreferenz |
| `interactive` | `"unknown"` (heute überall) | ob die Textur selbst Interaktion trägt |
| `usedBy` | Quelldateien | wer das Asset referenziert |
| `evidence` | `code`, `category` | Herkunft der Rollenaussage |

### Depth und Occlusion sind Malreihenfolge

`src/render/floor-view.ts` hängt neun Container in fester Reihenfolge an die
Kamera: `room`, `carpet`, `dirt`, `furniture`, `props`, `cues`, `actors`,
`stickers`, `fx`. Es gibt **kein** `zIndex` und keine Tiefensortierung im
Floor; Occlusion ist damit reine Malreihenfolge (`paint-order`). Die einzige
Ausnahme ist der Teppich: er wird über eine Zonenmaske beschnitten
(`mask-clipped`), deshalb liegt er als eigener Layer über dem Raum-Chunk.

### LOD

`floor-view` schaltet genau zwei Stufen (`setLod`). In der Übersicht bleibt der
Korpus sichtbar, während `setDetail(false)` Beschriftung, Status und Glow
ausblendet — deshalb tragen Texturen des Möbelkorpus `lod: "always"`, und nur
Overlay-Elemente (Text, Ringe) wären `detail-only`. Für Assets ohne diese
Unterscheidung im Code steht `"unknown"`, nicht geraten.

## Bestehende Zuordnungen (Abgleich)

| Quelle | Mechanik | Ebene | Referenzen |
| --- | --- | --- | ---: |
| `src/render/furniture-atlas.ts` | `MACHINE_TEXTURE` (8 `gameId`s), `KIND_TEXTURE` (4 Arten), `DECOR_TEXTURE` (17 Label-Regexe, erster Treffer gewinnt) | `furniture` | 26 |
| `src/render/room-dressing.ts` | `DRESSING` je Zonenart (BAR, EXCHANGE, GAMING, STORAGE), je drei Requisiten mit relativer Position und Größe | `room` | 12 |
| `src/render/floor-surface.ts` | `FLOOR_TEXTURE` je Bodenmuster (8 Zonenarten, 2 Kacheln) | `room` | 2 |
| `src/render/room-art.ts` | `WALLPAPER` für die Rückwand | `room` | 1 |
| `src/render/floor-carpet.ts` | `TilingSprite` mit Zonenmaske, `tileScale` 0.34, `alpha` 0.18 | `carpet` | 1 |
| `src/render/guest-parts.ts` | 18 Köpfe, Auswahl per Seed-Modulo | `actors` | 18 |
| `src/render/pixel-head.ts` | `ASSET.heads` (6) und `ASSET.dealer`, Anchor 0.5/0.9 | `actors` | 7 |
| `src/render/assets/keys.ts` | `RUNTIME_ART`-Vorladeliste vor dem ersten Frame | `fx` | 17 |
| `src/render/games/plinko-assets.ts` | `PEG_TEXTURE` je `PegKind` (5), `payoutArt` nach `payBps` (3) | `game-board` | 8 |
| `src/ui/icons.ts` | `UI_ICON` (9, davon 2 aus `machines`/`characters`) und `GAME_ICON` (8) | `dom-ui` | 17 |
| `src/styles/popup.css` | Damast als wiederholter Popup-Hintergrund | `dom-ui` | 1 |
| `src/render/games/slot-fx.ts` | `ASSET.coinSpin` als Münzregen | `fx` | 1 |
| `src/render/fx/emitter.ts` | `manifest.emitters`, `smoke-puff`-Frames als Texturquelle | `fx` | 5 |
| `src/render/music.ts` | `manifest.music`, sechs Zustände mit Crossfade | `audio` | 6 |
| `src/ui/asset-library-popup.tsx` | zeigt jede Kategorie, kein Floor-Bezug | `dom-ui` | 539 |

Drei Zuordnungen sind **indirekt** und deshalb im Katalog über `role`
markiert, nicht über einen Pfad: Walzensymbole laufen über ihre ID
(`SLOT_SYMBOLS` → `manifest.symbols`), Emittertexturen über
`manifest.emitters[].textures`, Animationsframes über
`manifest.animations[].frames`.

## Dubletten

23 Referenzen tragen mehr als eine Rolle. Keine Datei ist doppelt im Manifest
eingetragen; die Dubletten sind Rollen-Dubletten.

| Referenz | Rollen |
| --- | --- |
| `characters/head-02-01.png` | Gast-Kopf, Kopf für Personal/Dealer, HUD-Icon (Croupier) |
| `characters/head-01-01` … `head-02-07` (5 weitere) | Gast-Kopf und Personal-/Dealer-Kopf |
| `decor/bar-back-shelf.png`, `decor/bar-counter-stools.png` | Möbelkorpus (Bar) und Zonen-Requisite |
| `decor/casino-column.png`, `decor/neon-column.png`, `decor/potted-palm.png`, `decor/casino-side-table.png` | Möbelkorpus (Deko nach Label) und Zonen-Requisite |
| `machines/slot-cabinet.png`, `plinko-cabinet`, `roulette-table`, `blackjack-table`, `poker-table`, `video-poker-terminal`, `shell-game-cups-and-pearl` | Möbelkorpus und HUD-Spiel-Icon |
| `machines/dice-table.png` | Möbelkorpus und HUD-Spiel-Icon |
| `machines/storage-shelves.png` | Möbelkorpus (Lager) und Zonen-Requisite |
| `machines/table-games/poker-chip-single.png` | Chip am Tisch und HUD-Icon/Vorladeliste |
| `environment/tiles/wallpaper-damask-plum.png` | Zonenbelag, Wandtapete, Popup-Hintergrund |

Diese Rollen sind **kein Fehler**: dasselbe Bild darf als Korpus und als Icon
dienen. Der Katalog hält sie fest, damit eine spätere Änderung an einem Bild
sichtbar macht, wie viele Stellen sie berührt. Wer Rollen trennen will, legt
neue Dateien im Manifest an — nicht eine zweite ID im Katalog.

## Befunde

1. **Kein Asset ist belegbar interaktiv.** Interaktion hängt an
   Simulationsobjekten (`Furniture`, `GameView`, Popup-Router), nicht an einer
   Textur. Deshalb steht `interactive` überall auf `"unknown"`, und der Typ
   `interactive` ist leer. Das ist die ehrliche Antwort, keine Lücke im
   Katalog.
2. **Deko-Zuordnung läuft über Label-Regexe.** `DECOR_TEXTURE` in
   `furniture-atlas.ts` wählt nach Schlagwort im Möbel-Label (17 Muster, erster
   Treffer). Ein unbekanntes Label fällt auf den gezeichneten Korpus zurück.
   Das ist eine semantische Bindung im Renderer, die der Katalog nur
   dokumentiert — sie gehört mittelfristig an eine stabile Rolle, nicht an
   Anzeigetext.
3. **Vier von fünf FX-Unterordnern sind ohne Code-Bezug.** 246 FX-Bilder
   stehen 17 belegten gegenüber; der Rest liegt als Bestand in der Bibliothek.
   Wer Partikel erweitert, findet die Textur dort, aber kein Renderer wartet
   darauf.
4. **444 Bilder ohne Code-Bezug** sind kein Aufräumauftrag, sondern
   Ausgangsmaterial. Der Katalog markiert sie mit `evidence: "category"`,
   damit niemand sie für verdrahtet hält.
5. **Symbole sind ID-gebunden, nicht pfadgebunden.** Nur neun der 24 Symbole
   sind Engine-Symbole (`SLOT_SYMBOLS`); die anderen 15 sind Bestand. Eine
   pfadbasierte Suche findet sie nicht — der Katalog löst das über
   `manifestPath`.

## Messung und Anker (Slice 2: `machines`, `decor`)

Alle 82 Dateien dieser beiden Kategorien wurden geoeffnet und gemessen, nicht
geschaetzt. Die Leinwand (`bounds`) ist die PNG-Groesse und stimmt bei allen 82
mit dem Atlasrahmen ueberein. Der sichtbare Inhalt (`content`) ist die
Alpha-Bounding-Box der Datei; `contentFill` nennt beide Achsen als Anteil. Drei
Ankerbegriffe sind getrennt:

| Feld | Bedeutung | Quelle |
| --- | --- | --- |
| `anchor` + `anchorKind` | Sprite-Pivot, den der Renderer setzt | Code (`furniture-atlas.ts`, `room-dressing.ts`, `poker-canvas.ts`) |
| `ground` | Bodenanker am unteren Rand des **sichtbaren Inhalts** | Alpha-Bbox |
| `top` | Oberkante des sichtbaren Inhalts (Aufhaenge- oder Auflagepunkt) | Alpha-Bbox |

`ground: "none"` heisst: der Inhalt beruehrt die Unterkante nicht, es gibt im
Bild keinen Bodenkontakt. Fuer Tischkarten und Chips sind `ground` und `top`
beide `none`, weil sie auf einer Flaeche liegen statt zu stehen.

### Ableitungsregeln (deterministisch)

| Feld | Regel |
| --- | --- |
| `proportion` | Seitenverhaeltnis des Inhalts: `upright` ≤ 0.8, `wide` ≥ 1.25, sonst `square` |
| `base` | `full-bleed` bei deckender Leinwand ohne Transparenz; `raised`, wenn der Inhalt mindestens 15 % Hoehe Abstand zur Unterkante hat; `flat-on-surface` fuer `machines/table-games/`; sonst `floor-contact` |
| `ground` | `floor-contact`: `{x: Inhaltsmitte, y: Inhaltsunterkante}`; `full-bleed`: `{0.5, 1.0}`; `raised` und `flat-on-surface`: `"none"` |
| `top` | `{x: Inhaltsmitte, y: Inhaltsoberkante}`; `flat-on-surface`: `"none"` |
| `notes` | nur messbare Marker: deckende Leinwand, kein Bodenkontakt im Bild, Inhalt schmaler als 65 % der Leinwand, Inhalt flacher als 80 % der Hoehe |
| `variants` | gleicher Namensstamm **und** identische Leinwand; reine Namensaehnlichkeit zaehlt nicht |

### Verteilung

| `base` | Assets | Bedeutung im Bild |
| --- | ---: | --- |
| `floor-contact` | 54 | Objekt steht auf, Inhalt endet knapp ueber der Unterkante (1–6 px Rand) |
| `flat-on-surface` | 18 | Tischkarten, Chips, Roulette-Layout, Suit-Zeichen (3 davon mit Code-Bezug als explizite Sprites, 15 nur im Bestand) |
| `full-bleed` | 7 | ohne Transparenz: zwei aegyptische Saeulen, `palm-neon`, `potted-palm-variant`, `potted-plant`, `small-podium`, `restroom-stall` |
| `raised` | 3 | `wall-sconce` (19 % Abstand), `cocktail-glass` (17 %), `shot-glass` (18 %) |

`proportion`: 50 `upright`, 25 `square`, 7 `wide`.

### Grosse Objekte, Automaten, Saeulen

- **Wide (7):** `blackjack-table` (140×94, Inhalt 116×87), `cash-register`
  (80×64, 76×58), `coin-tray` (64×40, 60×30), `control-button-panel`
  (128×48, 124×41), `display-bezel` (96×64, 82×60),
  `roulette-betting-layout` (112×52) und `roulette-wheel` (88×61).
- **Grosse Tische sind nicht automatisch `wide`.** Sie sind fast quadratisch im
  Inhalt, weil Tischplatte und Kante die Hoehe fuellen: `dice-table` (168×68,
  Inhalt 73×63, 44 % der Leinwandbreite), `roulette-table` (168×72, 81×66, 48 %),
  `shell-game-table` (160×55, 54×51, 34 %), `poker-table` (145×97, 112×90, 77 %),
  `blackjack-table` (140×94, 116×87, 83 %), `cashier-counter` (144×85, 82×79,
  57 %). Bei den ersten vier steht die Notiz `schmaler Inhalt in breiter
  Leinwand`: wer sie auf einen breiten Fussabdruck streckt, verbreitert die Luft
  um das Objekt, nicht das Objekt.
- **Automaten (`upright`, hoechste Saeulen der Kategorie):**
  `slot-machine-front` (96×160), `video-poker-terminal` (100×160),
  `slot-machine-compact` (108×156), `casino-kiosk` (100×148),
  `slot-cabinet` (104×145), `storage-shelves` (100×139).
- **Saeulen (`upright`, schmal):** `egyptian-column-tall` (45×112),
  `neon-column` (40×112), `casino-column` (44×90), `egyptian-column-short`
  (39×96). Die beiden aegyptischen Saeulen sind zwei Groessen desselben Motivs,
  aber **keine** Varianten im Katalogsinn: unterschiedliche Leinwand.
- **Mehrteilige Objekte:** `bar-counter-stools` zeigt drei Hocker, `restroom-stall`
  mehrere Kabinen, `control-button-panel` eine Knopfreihe. Sie werden als ein
  Sprite mit fester Groesse gezeichnet (`transform: fixed-size`, `baked:
  room-chunk-cache`); die Aufteilung in Einzelteile passiert im Core
  (Sitzplaetze, Kabinen), nicht in der Textur. Der Katalog speichert deshalb
  keine Teileliste — und bewusst keine Zonenzuordnung.

### Varianten

14 Assets tragen verifizierte Varianten: `machines/bar-bottle-*` (4, gleiche
32×64-Leinwand), `machines/chip-stack-*` (5, 32×40), drei
`machines/table-games/chip-stack-*` (32×45) und zwei Suit-Zeichen (24×25).
Alle anderen Namensfamilien unterscheiden sich in der Leinwand und bleiben
eigene Assets.

### Ausnahmen und Unbekanntes

- 48 der 82 Assets haben keinen Renderer-Bezug. Sie tragen `transform:
  library-only`, `anchor: "unknown"` und `anchorKind: "unknown"`; `content`,
  `proportion`, `base`, `ground` und `top` sind trotzdem gemessen, weil sie rein
  visuell sind.
- Kein Maschinen- oder Deko-Asset ist als interaktiv markiert. Interaktion
  haengt an `Furniture` und `GameView`; ein Stuhl, eine Saeule und ein Neon-Schild
  bleiben damit dekorativ, auch wenn ihr Dateiname nach Objekt klingt.
- Wo der Inhalt die Leinwand nicht ausfuellt, bleibt der Rand Teil der
  Zeichenflaeche. `ground` und `top` beziehen sich deshalb auf den Inhalt, nicht
  auf die Leinwandkante.

## Pflege

- Der Katalog wird **nicht** von einem Skript im Verify-Lauf erzeugt und von
  keinem Gate geprüft. Er ist Dokumentation mit Datenform.
- Ändert sich das Manifest (neue Datei, neue ID), gehört der Eintrag in den
  selben Commit: `evidence: "category"` ist der ehrliche Startwert.
- Ändert sich eine Bindung im Renderer, wandert `usedBy`/`role` mit.
- Kein Renderer liest diese Datei. Wer sie zur Laufzeit einlesen will, braucht
  zuerst einen eigenen Task samt Gate — bis dahin bleibt sie Papier.
