# Screenshots

Bilddokumentation der Spieler-Oberflächen, aufgenommen aus dem laufenden Spiel (Chromium, 1280 × 860).

## Ablage und Governance

- `docs/screenshots/current/` ist der Satz bis `v0.3.27` (höchstens 16 Bilder) und bleibt unverändert als Vergleichsbasis.
- Ab `v0.3.78` liegt jeder neue Spielsatz in `docs/screenshots/v<version>/`. Der Ordner ist der Stand, nicht ein Vergleich; ein älterer Satz wird nicht überschrieben, sondern liegt daneben.
- Versionierte Vorher/Nachher-Belege bis `v3`: `docs/screenshots/comparison/`; dort steht die Version im Dateinamen (`v1`, `v2`).
- Dateinamen: `<laufende Nummer>-<bereich>.png`, Unteransichten mit Buchstabe (`04b`, `06b`). Die Nummer folgt dem Weg durch das Spiel, nicht dem Aufnahmezeitpunkt.
- Spielbilder liegen nur in `current/`, `v<version>/` und `comparison/`; diese README ist der einzige gemeinsame Eintrag.
- Die PNGs sind verlustfrei nachverdichtet (nur IDAT neu gepackt, Pixel unverändert). Vor dem Commit keine Screenshot-Werkzeuge mit Qualitätsverlust verwenden.

## Spielsatz v0.3.78 — Licht, Bodenhinweise und Kamera (02.11.2026)

Aufgenommen aus dem laufenden Spiel (Chromium 156, Fenster 1280 × 860), Stand `v0.3.78`, Tag 1 eines
frischen Laufs über den normalen Ladeweg — kein vorbereiteter Speicherstand. Der Vergleich gegen
`current/` steht mit beiden Bildern nebeneinander in der Wurzel-`README.md`.

| Datei | Zustand | Zeigt |
| --- | --- | --- |
| `01-floor-uebersicht.png` | SMALL, Tag 1, 8 Gäste | Ganze Etage in der Übersicht: Lichtpfütze je Raum, Deckenlampen, dunkle Laufwege dazwischen, Vignette und Raster auf der Bühne, darüber die Steuerleiste als Tastenfelder und unten rechts die Kamera-Knöpfe | 
| `02-floor-detail.png` | SMALL, Tag 1, 9 Gäste | Detailstufe mit beschrifteten Räumen, Gästen an Automat und Theke und dem türkisen Zielraster unter dem Zeiger, das hier einen Laufweg ankündigt | 
| `03-bauen-panel.png` | SMALL, Tag 1, 5 Gäste | Bauen-Fenster über dem laufenden Floor: Katalog mit Plätzen, Mindesteinsätzen und Preisen, dahinter beleuchtete Etage | 
| `04-gaeste-panel.png` | SMALL, Tag 1, sechs Gäste in der Liste | Gäste-Fenster: Wechselkasse und offene Gewinne, gewählter Gast mit Laune, Geduld und Sucht, Gästezeile darunter | 
| `05-hilfe-steuerung.png` | SMALL, Tag 1 | Hilfekarte „So funktioniert dein Casino“ mit der Steuerungsliste, inklusive Rechtsziehen zum Schwenken und `+`/`-`/`0` für Zoom und Übersicht | 

Was dieser Satz gegenüber `current/` zeigt: Räume tragen Licht statt nur einer hellen Kante, der Boden
antwortet mit Zielraster, Spielerring, Laufwegspur und Klick-Puls vor der Bewegung, die Legende ist zu
Tastenfeldern geworden, und die Kamera hat eigene Knöpfe. Die Panels sind bis auf das HUD (Barkauf-Chip
statt leerer Leiste, XP-Balken) unverändert; Gästezahl und Katalogumfang unterscheiden sich, weil es ein
anderer Spielstand ist.

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

## Optik und Steuerung — v3 (02.11.2026)

Aufgenommen aus dem laufenden Spiel (Chromium 156, Fenster 1500 × 940) nach dem Licht- und
Steuerungsschnitt. Der Stand ist derselbe wie in `current/`, nur weitergezeichnet; die alten
Aufnahmen bleiben als Vergleichsbasis unverändert.

| Datei | Version | Zeigt |
| --- | --- | --- |
| `21-floor-v3-optik-steuerung.png` | v3 | Übersicht mit Lichtpfützen je Raum, hellerer Wandkante, Vignette und Rasterhintergrund auf der Bühne; links oben die Steuerleiste mit Tastenkuerzeln, unten rechts die Kamera-Knöpfe, im HUD das Barkauf-Ziel als Chip und der XP-Balken, in der Etage das violette Zielraster (Klick zieht heran) und der Spielerring |

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


## Spielsatz v0.3.132 — GAST und BETRIEB als zwei Blicke (06.11.2026)

Aufgenommen aus dem laufenden Spiel (Chromium, Fenster 1280 × 860; Bild `08` mobil 390 × 844),
Stand `v0.3.132`, frischer Lauf über den normalen Ladeweg — kein vorbereiteter Speicherstand.
Die Aufnahmen entstanden gegen den Vite-Dev-Server, nicht gegen einen Mockup-Satz.

| Datei | Perspektive | Zeigt |
| --- | --- | --- |
| `01-floor-operator.png` | BETRIEB | Etage mit Gerät, Bar, Kasse, Lager und Gästen; HUD mit Hauskonto, Kasse und offenen Gewinnen, Rollenhinweis „Betriebsmodus“, Dock mit Betrieb, Gäste, Karte, Du, Putzen-Hinweis |
| `02-floor-guest.png` | GAST | Dieselbe Etage mit Cyan-Akzent: HUD zeigt Portemonnaie und offene Gewinne, Dock nur Spielen, Verlauf, Regeln, Du |
| `03-slot-guest.png` | GAST | Klick auf den Slot öffnet direkt die Spielbühne: Kopf „GAST · SPIELGERÄT“, Portemonnaie und Hauskonto, Walzen, Einsatzwahl und „ZU WENIG BARGELD“ (frischer Lauf ohne Wechselgeld) |
| `04-slot-operator.png` | BETRIEB | Derselbe Automat als Betriebsdiagnose: Zustand, Plätze, Anziehung, Mindesteinsatz, Drucklader-Telemetrie, Regel-Editor, Mods |
| `05-guests-operator.png` | BETRIEB | Gästeverwaltung mit Anwesenheit, Laune und offenen Beträgen |
| `06-build-operator.png` | BETRIEB | Betriebspanel mit den vier Ops-Karten Hauskonto, Auslastung, Personal und Wartung über dem laufenden Floor |
| `07-history-guest.png` | GAST | Verlauf aus Sicht des Gasts über den bestehenden Werkstatt-Einstieg |
| `08-mobile-guest.png` | GAST | Hochformat 390 × 844: HUD bleibt zweizeilig lesbar, Perspektivschalter sitzt in der Kopfzeile, Floor und Dock bleiben bedienbar |

Die Bilder belegen die Perspektive, nicht die Spielmechanik: Es gibt keine zweite Bühne,
keine zweite Palette und keinen zweiten Spielzustand. Der Rollenwechsel ändert nur die
Anzeige; die Simulation läuft weiter.
