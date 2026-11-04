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
