# Screenshots

Bilddokumentation der Spieler-Oberflächen, aufgenommen aus dem laufenden Spiel (`npm run dev`, Vite, Chromium 1280 × 860).

## Ablage und Versionierung

- Ein Ordner pro Release: `docs/screenshots/v<major>.<minor>.<patch>/`
- Die Version im Ordnernamen ist die aus `package.json` zum Zeitpunkt der Aufnahme, nicht die des Commits davor.
- Dateinamen: `<laufende Nummer>-<bereich>.png`, Unteransichten mit Buchstabe (`04b`, `06b`). Die Nummer folgt dem Weg durch das Spiel, nicht dem Aufnahmezeitpunkt.
- Neue Aufnahmen kommen in einen **neuen** Versionsordner. Alte Ordner bleiben stehen, damit Änderungen an der Oberfläche vergleichbar sind.
- Aufnahmezustand ist immer ein frischer Spielstand (lokaler Speicher geleert), damit die Bilder reproduzierbar sind.

## v0.3.18

Release-Commit `9ee3d47` (Tag `v0.3.18`), aufgenommen am 30.10.2026.

| Datei | Oberfläche | Zeigt |
| --- | --- | --- |
| `01-spielfeld-detail.png` | Spielfeld, Detailstufe | Figuren mit Sprechblasen, Räume (Eingang, Wechselkasse, Spielsaal, Bar, Klo, Lounge, Lager), Gerätezustand, HUD-Leiste |
| `02-spielfeld-uebersicht.png` | Spielfeld, Übersicht | Ganze Etage als Karte, Figuren als Positions-Pins; Klick zoomt in einen Raum |
| `03-hilfe.png` | Hilfe (`?` im HUD) | Rolle, die vier Geldtöpfe, Gäste-Werte, Objekte & Mods, Steuerung, erster Tag |
| `04-bauen.png` | Bauen, obere Hälfte | Katalog mit Preis, Platzanzahl und Mindesteinsatz je Gerät |
| `04b-bauen-personal-lager.png` | Bauen, untere Hälfte | Personal mit Tageslöhnen, Bar/Lager/Ersatzteile, Preise, Wand-/Neon-/Teppichfarben, Betrieb (Putzen, Reparieren) |
| `05-gaeste.png` | Gäste | Wechselkasse und offene Gewinne, gewählter Gast mit Laune/Geduld/Sucht, Begründung, Handlungen, Gästeliste |
| `06-fremdes-casino.png` | Fremdes Casino, Hafenklause | Hauswahl, Selbstbeherrschungs-Pakt, Betreiberprofil mit Hausvorteil, Automaten, Einsatzwahl |
| `06b-fremdes-casino-huetchenspiel.png` | Fremdes Casino, zweites Gerät | Gleiches Haus, Gerätewechsel am Hütchenspiel |
| `06c-fremdes-casino-goldene-hand.png` | Fremdes Casino, Goldene Hand | Zweites Haus mit anderem Ruf, Sicherheit und Hausvorteil |
| `07-protokoll.png` | Ereignisprotokoll | Filterleiste (Alles, Geld, Gäste, Personal, Lager, Rivalen, System) und Einträge mit Ursache/Folge |
| `08-pruefung.png` | Prüfung | Buchhaltung mit Buchungszeilen und Vollprüfung, Personal, Bar & Lager, Protokollzähler |
| `09-charakter.png` | Charakter | Vorschau und Auswahl von Haut, Haaren, Outfit und Accessoire |

### Bewusst nicht enthalten

- **Geräte-Detailfenster** (Zustand, Mods, Walzen, Testspin, Plinko-Editor): nicht aufgenommen, weil im frischen Spielstand kein Klick auf ein Gerät das Fenster öffnete — siehe „Beobachtungen" unten. Der Screenshot fehlt, statt einen falschen Zustand zu zeigen.
- **Laufendes Spiel an einem Automaten** im fremden Casino: im frischen Spielstand ist das Portemonnaie leer, der Tisch zeigt „ZU WENIG BARGELD".

## Beobachtungen beim Aufnehmen

- Bei 915 px Fensterbreite überlappen sich HUD-Buttons und Kennzahlen (Gäste/Ruf/Bar), ebenso bei 1280 px: die Button-Zeile schiebt sich über die Werteblöcke.
- Die Übersichtsstufe zeichnet Figuren als kleine Pins; das ist gewollt (Klick zoomt in den Raum), wirkt ohne Erklärung aber wie ein Darstellungsfehler.
- Ein Klick auf ein Gerät auf dem Spielfeld löste in diesem Durchlauf nur Laufen aus, kein Detailfenster.
