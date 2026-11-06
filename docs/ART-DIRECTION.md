# Neon Ledger — die Bildsprache des Floors

> Blatt: `docs/banners/art-direction-neon-ledger.png` · Regeln im Code: `src/render/art-tokens.ts`, `src/styles/tokens.css`
>
> Dieses Dokument beschreibt eine Haltung, keine Vorlage. Es sagt, warum etwas leuchtet, und überlässt das
> Wie dem, der es zeichnet.
>
> **Status: vorläufig.** Die heutige Low-End-Pixel-Optik ist ein plattformfreundlicher Machbarkeitsbeweis
> und deutlich von der Vision entfernt. Sie ist nicht die endgültige Bildsprache; die Regeln unten gelten
> für den heutigen Stand und werden mit der Stadt neu verhandelt.

## Das Manifest

Der Saal ist eine Buchführung, die man betreten kann. Licht ist Information, jede Fläche ist eine Zeile, jede
Farbe eine Kontenart. Nichts glüht ohne Grund: Wer den Grund nicht nennen kann, nimmt das Licht zurück. Diese
Haltung macht aus einem dunklen Raum mit Geräten eine Bühne, auf der man Zahlen lesen kann, ohne ein Panel zu
öffnen. Die Arbeit ist erst fertig, wenn jede Marke datierbar und jede Fläche ableitbar ist — ein Zustand, den
man nur durch wiederholtes Prüfen am Boden erreicht, nicht durch Geschmack.

Gezeichnet wird mit Regeln, nicht mit Verzierungen. Ein Pixel, wo gezählt wird; zwei, wo eine Kante antwortet;
drei, wo etwas unterbrochen ist; sechs, wo gebaut wurde. Diese vier Breiten sind das ganze Vokabular der
Konstruktion. Wer eine fünfte braucht, hat die Fläche noch nicht verstanden. Konturen werden dunkler gemalt als
alles, was sie halten, damit Material und Licht führen und nicht der Rahmen. Eine Handschrift erkennt man daran,
dass sie auch dort präzise bleibt, wo niemand hinsieht: in der Fuge unter dem Teppich, an der Schwelle, im
Schatten der Theke.

Licht fällt in Stufen, nie als Fläche. Sechzehn leise Schichten, jede nur ein Prozent, ergeben einen weichen
Rand, den kein Auge als Ring erkennt — eine einzige deckende Fläche wäre ein Fleck. Jede Raumart hat eine
Temperatur: warm an Kasse und Bar, kalt an Eingang und Lager, Neon im Saal. Das Licht bleibt im Raum, es läuft
nicht über die Wand. Wer diese Grenze hält, bekommt Tiefe geschenkt; wer sie bricht, bekommt ein Leuchten, das
nichts bedeutet.

Die sieben Rollen sind Bedeutungen, keine Farben: Casino, Service, Gast, Wert, Gefahr, Erfolg, Warnung. Sie
stehen in derselben Reihenfolge in Pixi und im CSS, und sie ändern sich nie einzeln. Eine Rolle, die an zwei
Stellen unterschiedlich aussieht, ist ein Fehler, kein Stil. Deshalb ist die Palette klein, gesättigt und
unversöhnlich: Auf einem fast schwarzen Grund kann sich nur eine Farbe pro Aussage leisten, laut zu sein.

Steuerung wird gezeichnet, bevor sie wirkt. Das Zielraster zeigt die Kachel, die ein Klick trifft, und wechselt
die Farbe, wenn derselbe Klick etwas anderes tut. Der Ring hält die Figur auffindbar, die Punktspur zeigt den
Weg, ein Ring das Ziel. Alles davon verschwindet, sobald es nichts mehr zu sagen hat. Eine Anzeige, die immer
leuchtet, ist keine Anzeige. Diese Zurückhaltung ist die eigentliche Kunst: sichtbar genau dann, wenn eine
Entscheidung ansteht.

Das Ergebnis soll wie ein Artefakt aus einer Disziplin wirken, die es nicht gibt: eine technische Zeichnung
eines Ortes, an dem Geld und Laune gemessen werden. Dafür wird jedes Detail so oft verschoben, bis es sitzt —
die Kante der Theke, der Abstand der Lampe, die Deckkraft der zweiten Stufe. Ein Blatt in dieser Sprache darf
man aufhängen; ein Floor in dieser Sprache darf man lesen. Beides entsteht nur durch Arbeit, die man dem
Ergebnis ansieht.

## Die harten Regeln

| Regel | Wert | Wo |
| --- | --- | --- |
| Rollen | sieben, eine Bedeutung je Rolle | `art-tokens.ts` / `tokens.css` |
| Lichttemperaturen | warm, kalt, neon | `art-tokens.ts` (`LIGHT`) |
| Lichtpfützen | 16 Stufen, α 0,009 → 0,02, im Raum begrenzt | `floor-surface.ts` |
| Strichbreiten | 1 / 2 / 3 / 6 px | `STROKE`, `room-art.ts` (`WALL`) |
| Zielraster | Service = laufen, Identity = heranziehen | `floor-cues.ts` |
| Bewegung | Easing, kein Nachfedern | `floor-camera.ts`, `floor-view.ts` |
| Herkunft | keine Farbe ohne Rolle, kein Glanz ohne Grund | Review am Boden |

## UI und Spiel als ein Bild

Dieses Kapitel überträgt die Haltung auf die Bedienung. Der Floor ist die Bühne, die Menüs sind das
Lichtpult: gleiche Palette, gleiche Tiefe, gleiche Typo, gleiche Kanten. Kein Fenster darf wie ein
Fremdkörper über dem Spiel liegen.

### Vier Ebenen, vier Aufgaben

1. **Welt (Canvas):** Floor, Figuren, Licht. Keine UI-Texte außer Weltfeedback (Zielraster, Spur).
2. **HUD (Rahmen):** Identität links, Geld und Ruf rechts, eine Zeile mit Aktionen. Ruhig und dunkel.
3. **Fenster (`PopupShell`):** ein Rahmen für alles, was mehr als eine Entscheidung verlangt —
   Smartphone-Menüs, Bauen, Gäste, Protokoll, Charakter, Assets, Ton.
4. **Dialog:** die einzige Ebene, die die Welt abdunkelt und Fokus erzwingt.

Immersion entsteht nicht durch mehr Effekte, sondern durch **weniger Bruchstellen**: gleicher Kopf,
gleiche Dichte, gleiche Abstände, gleiche Bedeutung der Farben.

### Menü-Regeln

- **Ein Rahmen:** jedes Fenster nutzt `src/ui/popup-shell.tsx` (Backdrop, Kopf, Eyebrow, Titel,
  Fokusfalle, Escape, Schließen). Kein Fenster baut einen eigenen Kopf.
- **Ein Kopf:** Eyebrow = Bereich (`BAUEN`, `GÄSTE`), Titel = konkrete Sache, ein Schließen rechts.
- **Eine Dichte:** Innenabstand `--space-4`, Listen mit `--space-2`, keine Sonderfälle.
- **Eine Hierarchie:** höchstens drei Ebenen pro Fenster (Titel, Abschnitt, Zeile).
- **Eine Skala:** Abstände nur aus `--space-1..5`, Fensterbreiten nur aus `--popup-width`,
  `--popup-wide-width`, `--popup-full-width`, Radien nur aus `--popup-radius` / `--radius*`.
- **Keine toten Enden:** jedes Fenster hat genau eine primäre Aktion und einen Weg zurück.

Ausnahme: das Fremd-Floor-HUD (`foreign-floor-hud.tsx`) ist Welt, kein Fenster — es zeigt einen
anderen Ort, statt eine Entscheidung zu verlangen.

### Ton

Musik folgt dem Fenster (Floor, Gäste, Spiel, Nacht, Menü), nicht dem Klick. Erst die Geste, dann der
Ton; Autoplay wird abgewartet, nie erzwungen. Effekte haben Mindestabstände (`win` 500 ms, `coin`
180 ms, `brawl` 900 ms), damit ein voller Floor keine Tonlawine wird. Stille bleibt ein gültiger
Zustand, jeder Kanal ist einzeln regelbar.

### Stufenplan

| Stufe | Inhalt | Status |
| --- | --- | --- |
| M1 | Abstands- und Fenster-Tokens, Popup-CSS darauf umgestellt | erledigt |
| M2 | Alle Menüs auf `PopupShell`, ein Kopf, eine Dichte | erledigt |
| M3 | Screenshot-Satz `v0.3.114` als Referenz, README-Vergleich gegen `v0.3.27` | erledigt |
| M4 | Smartphone als echte Gerätefläche (Rahmen, Statusleiste), Fensterübergänge und Floor-Feedback angleichen | offen |

Abnahme pro Fenster: gleicher Kopf, gleiche Abstände, eine primäre Aktion, ein Weg zurück.

### So entsteht ein Screenshot-Satz

- Bauen: `pnpm run build`, danach `pnpm exec vite preview --port 4173 --strictPort`.
- Aufnehmen: Rundgang im Browser gegen `http://localhost:4173` (Floor, Smartphone, Fenster).
- Ablegen: `docs/screenshots/v<version>/` mit sprechenden Namen (`01-floor-uebersicht.png` ...).
- Verdrahten: README-Bild, Vergleichstabelle und Rundgang auf den neuen Satz zeigen lassen.
- Pruefen: `pnpm run verify:all`, keine Konsolen- oder Seitenfehler, Bilder gegen die Beschriftung.

## Zwei Perspektiven, eine Bildsprache (v0.3.132)

Der Umschalter GAST/BETRIEB färbt Akzente, nicht das Bild. Beide Blicke teilen dieselbe
Palette, dieselbe Typo-Hierarchie und dieselbe Etage; nur die Rollenfarbe des HUD-Rahmens,
der Rollenhinweis auf dem Floor (`floor-role-bar`) und die vier Bereiche im Dock wechseln.

- **GAST** trägt den Cyan-Akzent. Das HUD zeigt Portemonnaie und offene Gewinne, der Floor
  sagt „Gerät antippen und direkt spielen“, die Spielbühne trägt `DU · GAST`.
- **BETRIEB** trägt den Magenta-Akzent. Das HUD zeigt Hauskonto, Kasse, Geräte und Ruf, der
  Floor sagt „Gerät antippen für Zustand, Ursache, Reparatur und Mods“.
- Die Perspektive ist ein Zustand der Oberfläche, kein zweiter Spielzustand. Es gibt keine
  zweite Palette, keinen zweiten Router und keine zweite Bühne: `MachinePopup` verzweigt
  zwischen `MachineOperatorBody` und der bestehenden `TableLauncher`-Bühne.
- Neue Belege: `docs/screenshots/v0.3.132/` zeigt beide Floors, die Gastspielbühne, die
  Betriebsdiagnose desselben Geräts, Gästeverwaltung, Betriebspanel, Verlauf und die mobile
  Gastansicht.
