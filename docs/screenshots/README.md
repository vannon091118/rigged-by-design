# Screenshots

Bilddokumentation der Spieler-Oberflächen, aufgenommen aus dem laufenden Spiel (Chromium, 1280 × 860).

## Ablage und Versionierung

- Ein Ordner pro Release: `docs/screenshots/v<major>.<minor>.<patch>/`
- Die Version im Ordnernamen ist die aus `package.json` zum Zeitpunkt der Aufnahme, nicht die des Commits davor.
- Dateinamen: `<laufende Nummer>-<bereich>.png`, Unteransichten mit Buchstabe (`04b`, `06b`). Die Nummer folgt dem Weg durch das Spiel, nicht dem Aufnahmezeitpunkt.
- Neue Aufnahmen kommen in einen **neuen** Versionsordner. Alte Ordner bleiben stehen, damit Änderungen an der Oberfläche vergleichbar sind.
- Außerhalb der Versionsordner liegen keine Spielbilder. `docs/screenshots/README.md` ist der einzige gemeinsame Eintrag.

## v0.3.26 — Betriebszustände

Aufgenommen am 31.10.2026 aus dem laufenden Spiel (Chromium, 1280 × 860).

Diese acht Bilder sind keine Klickfolge durch die Oberfläche, sondern echte Simulationsstände: ein temporäres Skript hat `createWorld`/`tickWorld` aus `src/core/sim/` laufen lassen, den Stand als Save v8 über `toSavedGame` geschrieben und in den lokalen Speicher des Aufnahmebrowsers gelegt. Für die Aufnahme wurde die Spieluhr angehalten, damit der Schnappschuss genau den getickten Zustand zeigt. Das Skript und seine Spielstände sind nicht im Repository; die Bilder sind die einzige Ablage.

| Datei | Zustand | Zeigt |
| --- | --- | --- |
| `10-besucherfluss-frisch.png` | SMALL, Tag 1, 2 Gäste, ~155 VC | Erste Ankömmlinge zwischen Eingang und Wechselkasse, ein Gast am Gratis-Slot, einer an der Bar; ruhiger Start ohne leeren Floor |
| `11-besucherfluss-weg-zur-kasse.png` | SMALL, Tag 1, 7 Gäste | Drei Gäste laufen gestaffelt zur Kasse, einer wird gerade bedient, die übrigen verteilen sich auf Slot und Bar |
| `12-kasse-mit-schlange.png` | SMALL, Tag 1, 10 Gäste, Kassierer | Wartende mit Wechsel-Blasen vor der Kasse, jeder auf einer eigenen Kachel; der Kassierer steht am Schalter |
| `13-geraete-belegt-und-wartende.png` | MEDIUM, Tag 1, 18 Gäste | Mehrere belegte Automaten und Tische mit Gewinn-/Laune-Blasen, Wartende dazwischen, Schlange an der Kasse |
| `14-bar-wc-personal.png` | MEDIUM, Tag 1, 11 Gäste, Kassierer/Barkeeper/Reinigung | Gast an der Bar, Gast am WC, Personal auf dem Weg, frische Schmutz-Kacheln im Floor |
| `15-gast-verlaesst-das-casino.png` | SMALL, Tag 1, 2 Gäste | Auszahlung abgeschlossen: die Ereigniszeile meldet den Abgang, der Gast läuft über den Eingang hinaus |
| `16-betrieb-dichter-floor.png` | MEDIUM, Tag 2, 10 Gäste, ~810 VC | Deutlich dichterer Floor als am Start: mehrere Geräte gleichzeitig belegt, Gäste an Kasse, Bar und Automaten |
| `17-besucherwelle-konzern.png` | LARGE, Tag 1, Stufe KONZERN, Neon-Nacht, 58 Gäste | Besucherwelle: der ganze Floor ist gefüllt, Warteschlangen an der Kasse, Gäste an fast jedem Gerät |

Beobachtungen: bei 1280 px überlappen HUD-Buttons und Werteblöcke weiterhin (bekannt seit v0.3.18). Auf einigen Aufnahmen ist oben links das Freebuff-Badge der Aufnahmeumgebung zu sehen; das ist kein Unterschied der Oberfläche.

## v0.3.23

Release-Commit `a39bc2b` (Tag `v0.3.23`), aufgenommen am 30.10.2026.

Aufnahmezustand: frische Partie, Tag 1, kleiner Saal. Für die Tischaufnahmen (`06`, `06b`–`06h`) wurde dem Portemonnaie einmalig ein Startguthaben von 200 VC aus `EXTERNAL_WORLD` gebucht, damit Einsatz, Karten und Auszahlung sichtbar sind. Diese Buchung existiert nur im lokalen Speicher des Aufnahmebrowsers, nicht im Repository.

| Datei | Oberfläche | Zeigt |
| --- | --- | --- |
| `01-spielfeld-detail.png` | Spielfeld, Detailstufe | Figuren mit Sprechblasen, Räume (Eingang, Wechselkasse, Spielsaal, Bar, Klo, Lounge, Lager), Gerätezustand, HUD-Leiste |
| `02-spielfeld-uebersicht.png` | Spielfeld, Übersicht | Ganze Etage als Karte, Figuren als Positions-Pins; Klick zoomt in einen Raum |
| `03-hilfe.png` | Hilfe (`?` im HUD) | Rolle, die vier Geldtöpfe, Gäste-Werte, Objekte & Mods, Steuerung, erster Tag |
| `04-bauen.png` | Bauen, obere Hälfte | Katalog mit Preis, Platzanzahl und Mindesteinsatz je Gerät |
| `04b-bauen-personal-lager.png` | Bauen, untere Hälfte | Personal mit Tageslöhnen, Bar/Lager/Ersatzteile, Preise, Wand-/Neon-/Teppichfarben, Betrieb |
| `05-gaeste.png` | Gäste | Wechselkasse und offene Gewinne, gewählter Gast mit Laune/Geduld/Sucht, Begründung, Gästeliste |
| `06-fremdes-casino.png` | Fremdes Casino, Hafenklause | Hauswahl, Selbstbeherrschungs-Pakt, Betreiberprofil, Gerätewahl und der Slot mit echten Walzen, Gewinnlinien und Risiko-Karte |
| `06b-fremdes-casino-huetchenspiel.png` | Fremdes Casino, Hütchenspiel | Aufgedeckte Runde: Perle, gewählter Becher und Ergebnis |
| `06c-fremdes-casino-goldene-hand.png` | Fremdes Casino, Goldene Hand | Zweites Haus mit anderem Ruf, Sicherheit und Hausvorteil; Blackjack-Tisch vor dem Austeilen |
| `06d-fremdes-casino-blackjack.png` | Blackjack | Laufende Hand mit offener Dealer-Karte, Spielerwert und den Aktionen Ziehen, Halten, Verdoppeln |
| `06e-fremdes-casino-video-poker.png` | Video Poker | Fünf Karten, zwei gehaltene Karten, Paytable und Tauschen |
| `06f-fremdes-casino-roulette.png` | Roulette | Kessel, volles Setzfeld mit drei platzierten Jetons, Einsatzsumme und Drehen |
| `06g-fremdes-casino-plinko.png` | Plinko | Brett mit Stiften und Fächern, gefallener Ball, Fachquoten und Abwurfkonsole |
| `06h-fremdes-casino-wuerfel.png` | Würfel | Gewürfelte Augen, Wettfeld, Ergebnis und Einsatzwahl |
| `07-protokoll.png` | Ereignisprotokoll | Filterleiste (Alles, Geld, Gäste, Personal, Lager, Rivalen, System) und Einträge mit Ursache/Folge |
| `08-pruefung.png` | Prüfung | Buchhaltung mit Buchungszeilen und Vollprüfung, Personal, Bar & Lager, Protokollzähler |
| `09-charakter.png` | Charakter | Vorschau und Auswahl von Haut, Haaren, Outfit und Accessoire |

### Bewusst nicht enthalten

- **Geräte-Detailfenster am eigenen Automaten.** Es ist erreichbar, zeigt aber Zustand, Mods und Testspin statt einer eigenen Spieleroberfläche; die interaktiven Tische sind vollständig über das fremde Casino dokumentiert.
- **Laufende Slot-Runde mit Risiko-Karte.** Die Risiko-Karte erscheint nur nach einem Gewinn; der Screenshot zeigt den abgerechneten Spin, nicht jede mögliche Zwischenstufe.

## v0.3.18 (Archiv)

Release-Commit `9ee3d47` (Tag `v0.3.18`), aufgenommen am 30.10.2026 aus einer Partie an Tag 2. Das Portemonnaie war leer; die Geräte im fremden Casino zeigen deshalb „ZU WENIG BARGELD“.

| Datei | Oberfläche | Zeigt |
| --- | --- | --- |
| `01-spielfeld-detail.png` | Spielfeld, Detailstufe | Figuren mit Sprechblasen, Räume, Gerätezustand, HUD-Leiste |
| `02-spielfeld-uebersicht.png` | Spielfeld, Übersicht | Ganze Etage als Karte, Figuren als Positions-Pins |
| `03-hilfe.png` | Hilfe | Rolle, Geldtöpfe, Gäste-Werte, Objekte & Mods, Steuerung, erster Tag |
| `04-bauen.png` | Bauen, obere Hälfte | Katalog mit Preis, Platzanzahl und Mindesteinsatz |
| `04b-bauen-personal-lager.png` | Bauen, untere Hälfte | Personal, Bar/Lager/Ersatzteile, Preise, Farben, Betrieb |
| `05-gaeste.png` | Gäste | Wechselkasse, offene Gewinne, gewählter Gast, Gästeliste |
| `06-fremdes-casino.png` | Hafenklause | Hauswahl, Pakt, Betreiberprofil, Gerätewahl, generischer Geräteschirm |
| `06b-fremdes-casino-huetchenspiel.png` | Hafenklause, Hütchenspiel | Derselbe Geräteschirm, nur anderer Name |
| `06c-fremdes-casino-goldene-hand.png` | Goldene Hand | Zweites Haus, generischer Geräteschirm |
| `07-protokoll.png` | Ereignisprotokoll | Filter und Ereigniszeilen mit Ursache/Folge |
| `08-pruefung.png` | Prüfung | Buchhaltung, Personal, Bar & Lager, Protokollzähler |
| `09-charakter.png` | Charakter | Vorschau und Auswahl von Haut, Haaren, Outfit und Accessoire |

## Vergleich v0.3.18 ↔ v0.3.23

Gleiche Oberflächen, gleicher Aufbau, gleiche Nummerierung. Die Werte (Tag, Guthaben, Gästezahl) unterscheiden sich, weil die Partien unterschiedlich weit gespielt sind; das ist kein UI-Unterschied.

| Oberfläche | v0.3.18 | v0.3.23 |
| --- | --- | --- |
| `01` Spielfeld, Detail | Figuren, Sprechblasen, beschriftete Räume | unverändert; nur Spielstand und Kameraausschnitt unterscheiden sich |
| `02` Spielfeld, Übersicht | Ganze Etage, Pins | unverändert |
| `03` Hilfe | Sechs Erklärkarten | unverändert |
| `04` Bauen, oben | Katalog inkl. Plinko, Blackjack, Poker, Roulette, Hütchenspiel, Würfel | unverändert: dieselben Geräte und Preise |
| `04b` Bauen, unten | Personal, Bar/Lager, Preise, Farben, Betrieb | unverändert; der Scrollpunkt liegt hier am Personalabschnitt |
| `05` Gäste | Gast mit Laune/Geduld/Sucht und Liste | unverändert |
| `06` Hafenklause | Generischer Geräteschirm mit „BEREIT“ und „ZU WENIG BARGELD“ | **neu:** die Gerätewahl öffnet das echte Spiel direkt im Fenster; Slot mit echten Walzen, Symbolen und Konsole |
| `06b` Hütchenspiel | Derselbe generische Schirm, nur anderer Gerätename | **neu:** drei Becher, Perle, Mischen, eigene Becherwahl und aufgedecktes Ergebnis |
| `06c` Goldene Hand | Zweites Haus, generischer Schirm | **neu:** Blackjack-Filz mit Dealer, Spielerkarten und Aktionen |
| `06d`–`06h` | nicht vorhanden | **neu:** Blackjack, Video Poker, Roulette, Plinko und Würfel als eigene, bedienbare Tische |
| `07` Protokoll | Filter und Ereigniszeilen | unverändert; durch die fremden Runden kommen Geld- und Rivalen-Einträge hinzu |
| `08` Prüfung | Buchhaltung, Personal, Bar & Lager, Protokoll | unverändert |
| `09` Charakter | Vorschau und Paletten | unverändert |

### Beobachtungen beim Aufnehmen

- Bei 1280 px überlappen sich HUD-Buttons und Werteblöcke (Gäste/Ruf/Bar). Das war in v0.3.18 schon so und ist in beiden Sätzen sichtbar.
- Das fremde Casino ist mit eingebettetem Spielfenster höher als 860 px. Die Tischaufnahmen zeigen deshalb den zum Spiel gescrollten Fensterinhalt; der obere Rand des Sucht-Pakts ist angeschnitten.
- Die v0.3.18-Bilder tragen oben links ein Werkzeug-Badge der Aufnahmeumgebung. Die v0.3.23-Bilder wurden ohne dieses Badge aufgenommen; das ist kein Unterschied der Oberfläche.
