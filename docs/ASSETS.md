# Assets: Auswahl, Pipeline und Messwerte

Das Paket `casino_asset_sounds_prealpha` ist Ausgangsmaterial, kein Auftrag. Dieses
Dokument sagt, was daraus im Repository liegt, warum der Rest draußen bleibt und
wie man beides reproduziert.

## Herkunft und Rechte

- Quelle: `casino_asset_sounds_prealpha.zip` mit `casino-pixel-assets/` und `sounds/`.
- Bestand beim letzten Abgleich: **539 PNG**, **7 JSON**, **6 WAV**, rund 170 MB.
- Die beiliegende README beschreibt Stil, Palette und Pixelmaße, nennt aber
  **keine Lizenz und keinen Urheber**. Damit ist die Weitergabe nicht belegt.
  Bis das geklärt ist, gilt: Das Paket ist kein freigegebenes Distributionsmaterial.
  Vor einer Veröffentlichung außerhalb des Repositories muss die Herkunft geklärt sein.

## Was im Repository liegt

Nur ein kuratierter Ausschnitt, alles unter `public/assets/casino/`:

| Bereich | Dateien | Größe | Zweck |
| --- | ---: | ---: | --- |
| `symbols/` | 9 | 28,4 KB | Walzensymbole aus dem Paket statt gezeichneter Ersatzgrafik |
| `music/` | 3 | 8,6 MB | Hintergrundmusik je Spielzustand, Opus in OGG |

`src/render/assets/manifest.json` ist die einzige Quelle für IDs und Pfade:
`slotSymbols` bildet die Engine-Symbole (`BOOK`, `SCARAB`, `ANKH`, `EYE`, `URN`, `A`, `K`, `Q`, `J`)
auf Dateien ab, `music` die drei Zustände. Die Reihenfolge im Spielcode ist die Wahrheit:
`SLOT_SYMBOLS` in `src/core/games/engines/slot-paytable.ts`. Weicht das Manifest davon ab,
wird die Prüfung rot.

## Warum nicht mehr

- **Charaktere:** Das Paket enthält Körperteile als Einzeltexturen. Sie in `guest-art.ts`
  zu stecken hieße, eine zweite Figurenarchitektur neben der Graphics-Rig aufzubauen.
  Das ist ausgeschlossen, solange kein qualitativer Vorteil belegt ist.
- **Plinko-Pegs und Bumper:** 32–40 px Texturen auf einem Brett, dessen Stifte im
  Bühnenkoordinatensystem rund vier Pixel groß sind. Die gezeichneten Kreise sind dort
  schärfer und billiger.
- **FX-JSONs:** Die sieben Dateien beschreiben drei Animationen und vier Emitter für
  `@pixi/particle-emitter`. Dieses Paket ist nicht im Projekt, und eine zweite
  Partikel-Engine ist nicht vorgesehen. Die Dateien bleiben deshalb draußen, bis eine
  Integration über die vorhandenen Render-Strukturen geplant ist.
- **Geräte, Deko, UI-Icons:** Für einen späteren Durchgang vorgesehen; die Auswahl
  braucht eine Entscheidung pro Gerät, nicht eine pauschale Übernahme.

## Regeln zur Laufzeit

- **Nearest-Neighbor:** `src/render/assets/textures.ts` setzt beim Laden
  `texture.source.scaleMode = 'nearest'`. Pixel-Art wird nicht geglättet.
- **Ein Cache:** Jeder Pfad wird einmal geladen; `Assets.get` bedient Wiederholungen,
  gescheiterte Pfade werden nicht erneut versucht.
- **Stiller Rückfall:** Fehlt eine Datei oder scheitert das Laden, zeichnet
  `slot-symbols-art.ts` wie vorher mit `Graphics`. Die Bühne ist nie leer.
- **Kein Startblock durch Assets:** `src/main.tsx` lädt die neun Symbole vor dem ersten
  Rendern; das sind 28 KB und kostet kaum Zeit.

## Musik

`src/render/music.ts` ist eine eigene Schicht innerhalb der bestehenden Audioarchitektur,
kein zweites Audiosystem:

- Drei Zustände: `FLOOR`, `GAMES`, `SLOT`; `App.tsx` leitet sie aus dem offenen Fenster ab.
- `HTMLAudioElement` streamt, statt die ganze Datei zu dekodieren: Minutenlange Tracks
  wären sonst zweistellig viele Megabyte im Speicher.
- Crossfade über 1,2 s; das alte Element wird danach pausiert und gibt seine Quelle frei.
- Eigene Musiklautstärke (`rbd.music.volume`), multipliziert mit dem Master aus
  `sound-fx.ts`. Stummschalten setzt die Musik auf 0, ohne die Position zu verlieren.
- Start erst nach einer Geste. Ein abgelehnter `play()`-Versuch bleibt nicht endgültig
  stumm: Der Zuhoerer bleibt, bis wirklich etwas läuft.

## Audio-Pipeline

Die WAV-Master bleiben **außerhalb** des Repositories; ausgeliefert wird nur Opus.

```bash
npm rebuild ffmpeg-static     # einmalig, das Binary liegt in node_modules
node scripts/encode-audio.mjs # liest RBD_AUDIO_SOURCE, schreibt public/assets/casino/music/
```

Gemessen mit `libopus`, 48 kHz, Stereo:

| Track | Quelle | Auslieferung | Anteil |
| --- | ---: | ---: | ---: |
| `floor` (Atmosphäre_base, 60 s) | 10.336 KB | 671 KB | 6,5 % |
| `games` (atmosphäre_base_fullcasino, 271 s) | 46.684 KB | 4.071 KB | 8,7 % |
| `slot` (Slot1, 271 s) | 46.684 KB | 4.074 KB | 8,7 % |
| **Summe** | **103.704 KB** | **8.816 KB** | **8,5 %** |

Nicht verwendet: `Maintheme`, `background_loop`, `Atmosphäre_night_Prototyp`. Sie bleiben
Master, bis ein Zustand sie braucht.

OGG/Opus deckt Chromium, Firefox und die Android-WebView ab. Safari spielt es erst ab
neueren Versionen; für eine reine Web-Auslieferung an Safari wäre AAC die sichere Wahl.

## Prüfung

```bash
npm run verify:assets
```

Das Skript prüft drei Dinge und wird rot, wenn eines nicht stimmt:

1. Jede Manifest-Referenz zeigt auf eine vorhandene Datei im Größenrahmen.
2. Jedes `SLOT_SYMBOLS`-Symbol der Engine hat eine Textur, und keine Manifest-ID ist
   unbekannt.
3. Im kuratierten Ordner liegt keine Datei, die keine ID benutzt — sonst wandert sie
   über `public/` ungeprüft in den Production-Build.
