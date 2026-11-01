# Screenshots

Bilddokumentation der Spieler-Oberflächen, aufgenommen aus dem laufenden Spiel (Chromium, 1280 × 860).

## Ablage und Governance

- Kanonischer Spielsatz: `docs/screenshots/current/` (höchstens 16 Bilder).
- Versionierte Vorher/Nachher-Belege: `docs/screenshots/comparison/`; die Version steht im Dateinamen (`v1`, `v2`), nicht in einem eigenen Ordner. `current/` bleibt der einzige fortlaufende Spielsatz.
- Dateinamen: `<laufende Nummer>-<bereich>.png`, Unteransichten mit Buchstabe (`04b`, `06b`). Die Nummer folgt dem Weg durch das Spiel, nicht dem Aufnahmezeitpunkt.
- Außerhalb von `current/` und `comparison/` liegen keine Spielbilder; diese README ist der einzige gemeinsame Eintrag.
- Die PNGs sind verlustfrei nachverdichtet (nur IDAT neu gepackt, Pixel unverändert). Vor dem Commit keine Screenshot-Werkzeuge mit Qualitätsverlust verwenden.

## Aktueller Satz — Einheitliche Art Direction und gestaltete Etage

Aufgenommen am 31.10.2026 aus dem laufenden Spiel (Chromium, Fenster 1248 × 900), Stand `v0.3.27`.

Die Bilder `01` bis `08` zeigen echte Simulationsstände, keine Mockups: ein temporäres Skript hat `createWorld`/`tickWorld` aus `src/core/sim/` laufen lassen, den Stand als damaligen Save v8 über `toSavedGame` geschrieben (heute v9) und in den lokalen Speicher des Aufnahmebrowsers gelegt. Das Skript und die Stände sind nicht im Repository.

| Datei | Zustand | Zeigt |
| --- | --- | --- |
| `01-floor-uebersicht-frisch.png` | SMALL, Tag 1, 4 Gäste | Ganze Etage als Karte: Eingang, Wechselkasse, Spielsaal, Bar, Klo, Lounge und Lager als eigene Materialien, Wände mit Lichtkante und Türen, Deckenlampen je Raum |
| `02-floor-detail-frisch.png` | SMALL, Tag 1, 6 Gäste | Detailstufe: Bar mit Theke, Klo mit Kabinen, Lager, Lounge mit Sofa und Pflanze, frischer Schmutz am Boden |
| `03-floor-uebersicht-mittel.png` | MEDIUM, Tag 1, 11 Gäste | Größerer Saal mit Automaten, Tischen und Roulette, Personal unterwegs, Schlange an der Kasse |
| `04-floor-detail-mittel.png` | MEDIUM, Tag 1, 14 Gäste | Detailstufe mit belegten Geräten, Wartenden, Bar, Klo und Lager; Türschwellen und Laufwege zwischen den Räumen |
| `05-floor-uebersicht-konzern.png` | LARGE, Tag 5, Stufe KONZERN, 31 Gäste | Besucherwelle über die ganze Etage, Warteschlange an der Wechselkasse, Gäste an fast jedem Gerät |
| `06-floor-detail-konzern.png` | LARGE, Tag 5, 30 Gäste | Spielsaal in der Detailstufe: mehrere Geräte gleichzeitig belegt, Gewinn- und Laune-Blasen, Personal im Raum |
| `07-gaeste-panel.png` | MEDIUM, Tag 1 | Gäste-Fenster: Wechselkasse und offene Gewinne, gewählter Gast mit Laune, Geduld und Sucht, Gästeliste |
| `08-bauen-panel.png` | MEDIUM, Tag 1 | Bauen-Fenster: Katalog mit Preisen, Plätzen und Mindesteinsätzen über dem laufenden Floor |

Was die Bilder gegenüber den entfernten Versionen zeigen:

- Boden, Geräte, Figuren und Panels teilen eine Rollenpalette (`art-tokens.ts` / `tokens.css`): Casino, Personal, Gäste, Wert, Gefahr, Erfolg, Warnung.
- Jeder Raum hat ein eigenes Bodenmaterial (Marmor an der Kasse, Teppich im Spielsaal, Dielen an der Bar, Fliesen im Klo, Läufer in der Lounge) mit Fugen, Sockel und Deckenlampen.
- Wände haben Körper, Lichtkante und Eckpfeiler; Räume sind über Türen und Schwellen verbunden statt geschlossene Rechtecke zu sein.
- Möbel werfen einen gerichteten Schatten nach unten rechts, Figuren stehen auf einem Kontaktschatten.
- Laufwege zwischen den Räumen liegen bewusst dunkler als die Räume, damit der Saal als Bühne liest.
- Panels nutzen dieselben Farbrollen und eine gemeinsame Typo-Hierarchie; bei mittleren Fensterbreiten bekommt die HUD-Aktionsleiste eine eigene Zeile statt rechts abgeschnitten zu werden.


## Versionierter Asset-Vergleich — 01.11.2026

Aufgenommen aus dem laufenden Spiel (Chromium, 1280 × 900) nach der Integration des vollständigen Pre-Alpha-Pakets. Die alten Aufnahmen bleiben unverändert in `current/`; die Belege liegen daneben in `comparison/`.

| Datei | Version | Zeigt |
| --- | --- | --- |
| `01-floor-v1-vorher.png` | v1 | Der bisherige Floor aus `current/01-floor-uebersicht-frisch.png`, unverändert als Vergleichsbasis |
| `02-floor-v2-nachher.png` | v2 | Derselbe Floor mit Geräte-, Tisch- und Deko-Texturen aus dem Paket |
| `03-floor-v1-v2.png` | v1 → v2 | Beide Aufnahmen nebeneinander, links vorher, rechts nachher |
| `04-asset-library-top-v2.png` | v2 | Asset-Bibliothek: Symbole, Maschinen, Deko und Plinko |
| `05-animations-emitter-sounds-v2.png` | v2 | FX-Gruppen, drei Frame-Animationen, vier Emitter und sechs Tonspuren |

## Asset-Kategorien in den Spielbühnen — 01.11.2026

Aufgenommen im laufenden Fremdhaus-Popup nach echten Spielzügen: Slot verloren und gewonnen, Poker-Hand ausgeteilt, Roulette-Satz verloren, Plinko-Ball gelandet. Die Bilder zeigen die Renderer, nicht die Bibliothek.

| Datei | Bühne | Zeigt |
| --- | --- | --- |
| `16-floor-assets-ingame.png` | Floor | Teppichmuster nur in Spielsaal und Lounge, Pixelköpfe beim Personal; Bar, Klo und Lager behalten ihr Material |
| `17-poker-assets-ingame.png` | Poker | Fünf Figuren (drei Gegner, Held, Dealer), Kartenrücken mit Paket-Textur, Dealer-Button und Chip am Pot |
| `18-roulette-assets-ingame.png` | Roulette | Croupier-Portrait im Fensterkopf, Chip-Icon am Jeton-Zähler, Paket-Wallpaper |
| `19-plinko-assets-ingame.png` | Plinko | Vollständiges Brett mit Paket-Pegs und Auszahlungsfeldern nach einem echten Wurf |
| `20-slot-assets-ingame.png` | Slot | Gewinn mit drei Linien; die Walzensymbole stammen aus dem Paket |

## Spielbühnen (`09` bis `15`)

Aufgenommen am 31.10.2026 im Fremdhaus-Popup, also dort, wo die `TableLauncher` alle Spielbühnen rendert. Das Portemonnaie war bei der Aufnahme leer: die Bühnen zeigen den ungespielten Zustand, keine laufenden Walzen und keine gefallenen Bälle.

| Datei | Spiel | Zeigt |
| --- | --- | --- |
| `09-slot-buehne.png` | Slot | Fünf Walzen mit den Pixel-Symbolen aus dem Asset-Paket: Buch, Skarabäus, Anch, Auge, Urne und die Bildkarten |
| `10-huetchen-buehne.png` | Hütchenspiel | Drei Becher auf dem Filz, Perle noch verdeckt |
| `11-blackjack-buehne.png` | Blackjack | Dealer-Hand, Spielerplatz und Shoe vor dem Austeilen |
| `12-poker-buehne.png` | Poker | Fünf Board-Plätze und zwei eigene Karten |
| `13-wuerfel-buehne.png` | Würfel | Beide Würfel und die fünf Wettfelder mit ihren Quoten |
| `14-roulette-buehne.png` | Roulette | Kessel mit 37 Taschen und der Setzteppich |
| `15-plinko-buehne.png` | Plinko | Acht Reihen Pegs, Bahn und die neun Taschen mit ihren Quoten |

Video Poker fehlt in dieser Reihe, weil die Bühne im Spiel nicht erreichbar ist: Das Popup hängt allein an der `TableLauncher`, und kein fremdes Haus führt ein Video-Poker-Gerät. Am eigenen Gerät zeigt das Maschinen-Fenster nur den Testspin.

