# Assets: Auswahl, Pipeline und Messwerte

Das Paket `casino_asset_sounds_prealpha` ist Ausgangsmaterial, kein Auftrag. Dieses
Dokument sagt, was daraus im Repository liegt, wie es im Spiel ankommt und wie man
beides reproduziert. Die Beschreibung des Quellpakets liegt unter
`docs/assets/casino-pixel-asset-pack.md`.

## Herkunft und Rechte

- Quelle: `casino_asset_sounds_prealpha.zip` mit `casino-pixel-assets/` und `sounds/`.
- Bestand beim letzten Abgleich: **539 PNG**, **7 JSON**, **6 WAV**, rund 170 MB.
- Die beiliegende README beschreibt Stil, Palette und Pixelmaße, nennt aber
  **keine Lizenz und keinen Urheber**. Der Betreiber hat am 01.11.2026 bestätigt,
  dass die Lizenzrechte bei ihm liegen; der schriftliche Nachweis wird im Repo
  ergänzt. Bis dahin gilt: keine Weitergabe außerhalb des Repositories.

## Was im Repository liegt

Alle **539 PNG** und **7 JSON** liegen unter `public/assets/casino/`; die sechs
WAV-Master werden nicht eingecheckt, sondern zu sechs OGG-Spuren encodiert.

| Bereich | Dateien | Größe | Zweck |
| --- | ---: | ---: | --- |
| `symbols/` | 24 | 112 KB | Walzensymbole aus dem Paket, inklusive der 15 Zusatzsymbole |
| `machines/` | 54 | 596 KB | Geräte, Tische, Chips und Karten |
| `decor/` | 28 | 296 KB | Sofas, Palmen, Neon, Säulen, Lampen |
| `plinko/` | 46 | 264 KB | Pegs, Bumper, Deflektoren und Auszahlungsfelder |
| `ui/` | 70 | 337 KB | Icons, Rollen-Badges, Panels und HUD-Skins |
| `characters/` | 69 | 284 KB | modulare Figuren-Körperteile |
| `environment/` | 2 | 64 KB | wiederholbare Teppich- und Tapetenkacheln |
| `fx/` | 246 PNG + 7 JSON | 866 KB | Partikel, Impacts, drei Frame-Animationen und vier Emitter |
| `music/` | 6 OGG | 13,4 MB | sechs Tonspuren aus den WAV-Mastern |

`src/render/assets/manifest.json` ist die einzige Quelle für IDs und Pfade. Es wird
mit `npm run assets:manifest` aus dem öffentlichen Baum erzeugt und enthält:

- `symbols` — 24 IDs; die Engine zieht neun davon (`SLOT_SYMBOLS` in
  `src/core/games/engines/slot-paytable.ts`), die übrigen 15 sind Asset-Bestand
  und im Spiel über die Bibliothek sichtbar.
- `machines`, `decor`, `plinko`, `ui`, `characters`, `environment`, `fx` — je Pfad
  eine ID; die Bibliothek zeigt jede Datei.
- `animations` — drei Frame-Folgen (`coin-spin`, `explosion`, `smoke-puff`) mit
  Frames, fps und Schleifen-Flag.
- `emitters` — vier Partikel-Konfigurationen mit ihren Texturen.
- `music` — sechs Zustände: `floor`, `night`, `menu`, `background`, `games`, `slot`.

## Wo das Paket im Spiel ankommt

- **Floor:** Geräte-Texturen ersetzen den gezeichneten Korpus für Automaten und
  Tische (`src/render/furniture-art.ts`); Service-Möbel (Bar, Klo, Kasse, Lager)
  und Deko (Sofa, Palme, Neon, Säule, Lampe) werden nach Spiel-ID bzw. Label
  zugeordnet. Fehlt eine Textur, bleibt die gezeichnete Grafik.
- **Plinko:** Pegs, Bumper und Auszahlungsfelder nutzen die passenden Texturen
  (`src/render/games/plinko-canvas.ts`); die übrigen Varianten liegen im Katalog.
- **Slot:** neun Engine-Symbole werden vorgeladen und auf den Walzen gezeichnet;
  die 15 Zusatzsymbole und alle anderen Kategorien sind in der Bibliothek prüfbar.
- **Animationen:** die drei Frame-Folgen laufen in der Bibliothek als echte
  Bildfolge mit ihrer deklarierten fps; die vier Emitter werden dort als
  Partikel-Vorschau mit ihren Texturen abgespielt.
- **Sound:** sechs Tonspuren sind Musikzuständen zugeordnet und in der Bibliothek
  einzeln abspielbar.
- **Asset-Bibliothek:** `src/ui/asset-library-popup.tsx`, erreichbar über
  `ASSETS` im HUD. Dort ist der vollständige Bestand sichtbar und anhörbar.

## Musik

`src/render/music.ts` ist eine eigene Schicht innerhalb der bestehenden
Audioarchitektur, kein zweites Audiosystem:

- Sechs Zustände: `FLOOR`, `NIGHT`, `MENU`, `BACKGROUND`, `GAMES`, `SLOT`;
  `App.tsx` leitet sie aus Fenster und Ort ab (Fremdhaus = Nacht, Hilfe/Menü =
  Maintheme, Protokoll/Prüfung = Hintergrund, Spiel = Games/Slot).
- `HTMLAudioElement` streamt, statt die ganze Datei zu dekodieren: Minutenlange
  Tracks wären sonst zweistellig viele Megabyte im Speicher.
- Crossfade über 1,2 s; das alte Element wird danach pausiert und gibt seine
  Quelle frei.
- Eigene Musiklautstärke (`rbd.music.volume`), multipliziert mit dem Master aus
  `sound-fx.ts`. Stummschalten setzt die Musik auf 0, ohne die Position zu verlieren.
- Start erst nach einer Geste. Ein abgelehnter `play()`-Versuch bleibt nicht endgültig
  stumm: Der Zuhörer bleibt, bis wirklich etwas läuft.

## Audio-Pipeline

Die WAV-Master bleiben **außerhalb** des Repositories; ausgeliefert wird nur Opus.

```bash
npm rebuild ffmpeg-static      # einmalig, das Binary liegt in node_modules
RBD_AUDIO_SOURCE=/pfad/zu/sounds npm run assets:audio
```

Gemessen mit `libopus`, 48 kHz, Stereo:

| Track | Quelle | Auslieferung | Anteil |
| --- | ---: | ---: | ---: |
| `floor` (Atmosphäre_base, 60 s) | 10.336 KB | 671 KB | 6,5 % |
| `night` (Atmosphäre_night_Prototyp) | 46.684 KB | 2.659 KB | 5,7 % |
| `menu` (Maintheme) | 10.336 KB | 998 KB | 9,7 % |
| `background` (background_loop) | 10.336 KB | 933 KB | 9,0 % |
| `games` (atmosphäre_base_fullcasino) | 46.684 KB | 4.071 KB | 8,7 % |
| `slot` (Slot1) | 46.684 KB | 4.074 KB | 8,7 % |
| **Summe** | **171.060 KB** | **13.405 KB** | **7,8 %** |

OGG/Opus deckt Chromium, Firefox und die Android-WebView ab. Safari spielt es erst ab
neueren Versionen; für eine reine Web-Auslieferung an Safari wäre AAC die sichere Wahl.

## Prüfung

```bash
npm run verify:assets
```

Das Skript prüft drei Dinge und wird rot, wenn eines nicht stimmt:

1. Jede Manifest-Referenz aus allen Kategorien, jedem Animationsframe und jeder
   Emitter-Textur zeigt auf eine vorhandene Datei im Größenrahmen.
2. Jedes `SLOT_SYMBOLS`-Symbol der Engine hat eine Textur im Manifest.
3. Im kuratierten Ordner liegt keine Datei, die keine ID benutzt — sonst wandert sie
   über `public/` ungeprüft in den Production-Build.

Der visuelle Nachweis liegt unter `docs/screenshots/comparison/`:
`03-floor-v1-v2.png` (vorher/nachher), `04-asset-library-top-v2.png` und
`05-animations-emitter-sounds-v2.png`.
