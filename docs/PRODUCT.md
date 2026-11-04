# Produkt: Rigged by Design

**Ein Satz:** Rigged by Design ist eine Lebenssimulation: Du startest mit einem Startguthaben, keinem Plan und einer Welt voller Möglichkeiten – und das Casino ist nur der erste Raum, in dem du lernst, wie dieses Leben rechnet.

Kein Echtgeld. VaCoins sind fiktive, ganzzahlige Mikro-Einheiten (1 VC = 10.000). Es gibt keine Einzahlung und keinen Gewinn, der irgendwo ankommt.

## Der Titel ist das Programm

„Rigged by Design“ ist ein Wortspiel, und es beschreibt zuerst das Leben, nicht das Haus. Man sucht sich nicht aus, in welche Verhältnisse man geboren wird: Eltern, Stadt, Startkapital, Laune, Marken, Vorgesetzte. Andere haben mit ihrem Leben vor dir schon angefangen, und ihre Entscheidungen sind die Bedingungen, unter denen deine stattfinden. Das Spiel ist manipuliert, weil das Leben manipuliert ist – und weil ein Casino das ehrlichste Beispiel dafür ist, wie aus einem gezinkten System ein Geschäftsmodell wird.

Du erbst deshalb kein Vermögen. Du erbst einen Startpunkt: **150 VC Startkapital**, einen Schlüssel, einen Automaten und keinen Plan. Was daraus wird, entscheidet nicht eine Klasse oder ein Genre, sondern was du mit Laune, Geld, Leuten und Zeit machst.

## Casino ist der Startpunkt, nicht das Genre

Das Casino ist die **erste Umgebung und die Testumgebung**. Es ist der Ort, an dem die Systeme beweisen, dass sie tragen:

- Gäste mit Budget, Laune, Geduld, Persona und Erinnerung,
- ein Ledger, das jede Folge bucht, statt sie zu behaupten,
- eine Narrative Engine, die aus echten Zustandsübergängen Geschichten ableitet,
- eine Oberfläche, die Ursache und Wirkung zeigt, statt Zahlen zu dekorieren.

Es ist **nicht** das Endziel und nicht die Kategorie des Spiels. „Sims“ kommt der Sache näher als „Casino-Manager“, trifft sie aber auch nicht: Es geht nicht um ein Haus, das man verwaltet, sondern um ein Leben, das man führt, und um eine Welt, die schon vorher Regeln hatte.

Der MVP ist ein **Systembeweis** und gleichzeitig die **Vorgabe für Detailtiefe**: Er zeigt, wie tief ein Aspekt simuliert wird, wenn er fertig ist – nicht, wie viel Content am Ende existiert. Weitere Kontexte – Kneipe, Tante-Emma-Laden, Wohnung, Straße, später die ganze Stadt – kommen laufend dazu.

## Der Pfad, bildhaft erklärt

Die folgende Kette ist kein Drehbuch und keine Feature-Liste. Sie ist das Muster, nach dem jeder Aspekt funktionieren soll – und sie ist bewusst nicht wörtlich zu nehmen:

1. **Du siehst eine Serie im TV.** Sie hebt deine Laune und dein Intellekt.
2. **Die Werbung dazwischen** hebt deine Ausgabebereitschaft, nicht dein Konto.
3. **Laune und Intellekt verändern dein Charisma.**
4. **Charisma entscheidet, wie NPCs auf dich reagieren**, was sie sich merken und was sie dir beim nächsten Mal vorhalten: dass du sie damals nach Geld für einen Döner gefragt hast.
5. **Heute hast du Geld.** Also kaufst du den Döner – und gibst deinen Freunden einen aus, weil guten Freunden gibt man einen Döner aus. Das fühlt sich richtig an, und das Spiel bucht es als Beziehung, nicht als Statistiksatz.
6. **Danach will dein Charakter neue Schuhe.** Die billigen drücken die Laune; die teuren kosten dreimal so viel und geben bei Leuten mit dem Trait „Konsument“ einen Charisma-Bonus. Marken und Preise sind Eigenschaften, keine Textzeilen.
7. **Dein Chef trägt diesen Trait auch.** Und du willst irgendwann dein eigenes Casino eröffnen, statt das von Willy Kleingeld zu putzen.

Jeder Schritt liest Zustand, jeder Zustand hat eine Ursache, jede Ursache ist sichtbar. Dieselbe Kette muss später in einer Kneipe, in einem Tante-Emma-Laden oder auf der Straße funktionieren, ohne dass die Regel neu geschrieben wird.

## Was hier schon die Engine ist

Das Existierende ist kein Casino-Code mit Casino-Sonderfällen, sondern ein **wiederverwendbarer, erweiterbarer Systemkern**. Genau deshalb ist die Lebenssimulation machbar, ohne alles neu zu bauen:

| Kern | Was er heute leistet | Warum er weiter trägt |
| --- | --- | --- |
| **Weltzustand** | ein Besitzer für Welt, Ledger, PRNG, Uhr und Save | ein Ort für Wahrheit, egal ob Casino, Laden oder Wohnung |
| **Ledger** | ganzzahlige Mikro-Einheiten, jede Buchung eine Zeile, keine Geldquelle außer der Außenwelt | wird um Ressourcen nach Bedarf erweitert (Zeit, Ruf, Vorräte), ohne die Geldwahrheit zu spalten |
| **Facts & Narrative Engine** | Ereignisse aus echten Übergängen, Erinnerungen, Beziehungen, Trigger, Scheduler | jede Umgebung liefert nur neue Facts und Templates, keine zweite Erzählmaschine |
| **Headless Core** | Simulation ohne DOM und ohne Pixi, deterministisch und testbar | dieselbe Simulation läuft in jedem Kontext und auf jeder Plattform |
| **Snapshot-Ansicht** | UI und Renderer lesen `GameView`, sie besitzen keinen Spielzustand | ein neuer Ort braucht eine Ansicht, keine zweite Wahrheit |
| **Inhalte als Daten** | Vokabular, Templates, Choice-Verträge, Kontexte | neue Schauplätze sind Daten und dünne Anbindungen, kein Umbau |

Ein neuer Ort bringt also Inhalte, Figuren und höchstens eine dünne Anbindung mit. Er bringt keine zweite Engine mit.

## MVP: Systembeweis, nicht Content-Endstand

Der heutige Umfang ist eine Momentaufnahme. Er belegt, dass die Kette Zustand → Ursache → Folge über Geld, Gäste, Personal, Rivalen und Erzählung hinweg funktioniert. Er belegt nicht, wie das fertige Spiel aussieht, wie viele Orte es gibt oder wie die endgültige Bildsprache wirkt.

## Optik: vorläufig und plattformfreundlich

Die aktuelle Low-End-Optik ist **noch nicht final** und deutlich von der Vision entfernt. Der Preis dafür wird von Anfang an bezahlt: Das Spiel muss auf vielen Plattformen laufen, auch auf schwachen Geräten. Die jetzige Pixel-Optik ist ein plattformfreundlicher Machbarkeitsbeweis, keine endgültige Bildsprache. Die Regeln, die schon gelten, stehen in [`ART-DIRECTION.md`](ART-DIRECTION.md).

## Vor dem Release: eine bespielbare Stadt

Der Release-Horizont ist keine größere Spielhalle, sondern eine **Stadt, die man spielen kann**: mehrere Orte, Wege dazwischen, Figuren mit eigenen Tagesabläufen und Erinnerungen, ein Charakter mit Laune, Ruf und Ressourcen. Das Casino bleibt darin ein Ort unter vielen – der erste, den man betritt.

## Was als Nächstes dazukommt

- **Social-Plugin der Narrative Engine:** Dieselben Facts, Erinnerungen und Beziehungen tragen außerhalb eines Hauses – zwischen Nachbarn, Kollegen und Freunden, nicht nur zwischen Gast und Kasse.
- **Ledger-Ressourcen:** Neben Geld kommen Ressourcen nach Bedarf dazu – Zeit, Ruf, Vorräte, Aufmerksamkeit. Jede bleibt eine gebuchte Zeile mit Ursache.
- **Weitere Kontexte:** Kneipe, Tante-Emma-Laden, Wohnung, Arbeitsplatz. Jeder Ort ist ein eigener Vertical Slice mit denselben Regeln.
- **Charakterwerte als allgemeine Achsen:** Laune, Charisma, Intellekt und Ausgabebereitschaft gelten für die Spielfigur genauso wie für Gäste und NPCs.

## Der Kreislauf (heute, im Casino)

1. **Gäste kommen** abhängig von Ruf, Ordnung, Gerätezustand, Personal und Angebot – nicht von einem Timer.
2. **Wechselkasse:** Fiat wird erst am Schalter zu Chips. Es gibt keine zweite Geldwahrheit.
3. **Angebot:** Gäste wählen nach Persona, Budget, Laune, Geduld, Sucht und Platzverfügbarkeit.
4. **Spiel:** Einsätze gehen ins Hauskonto, Gewinne warten als offene Auszahlung.
5. **Ausbau:** Spiele, Deko, Mods, Walzen, Personal, Reinigung und Reparaturen zahlen aus dem Hauskonto.
6. **Zustand:** Dreck, Defekte und leere Bars senken den Ruf, die Laune und den Zulauf.
7. **Fremdes Haus:** Du bist Gast bei echten Rivalen mit eigenen Regeln, Mindesteinsätzen und Hausvorteil.

## Zwei Töpfe, eine Wahrheit

| Topf | Zweck |
| --- | --- |
| Hauskonto | Geschäftskonto für Käufe, Einsätze, Löhne, Miete und Auszahlungen. |
| Portemonnaie | Persönliches Bargeld, nur durch Abheben vom Hauskonto und nur in fremden Häusern verspielbar. |
| Wechselkasse | Physischer Schalter für Fiat → Chips und offene Gewinne. |

Jede Buchung ist eine Ledger-Zeile. Kein `addVC` außerhalb einer Buchung, keine Geldquelle außer `EXTERNAL_WORLD`. Auszahlungen werden nie gekappt: Was das Hauskonto nicht deckt, steht als Verbindlichkeit auf `HAUS_SCHULDEN`. Ressourcen, die später dazukommen, folgen demselben Prinzip – sie werden gebucht, nicht gesetzt.

## Systemversprechen

Jedes wichtige System muss **Zustand, Ursache und Konsequenz** zeigen:

- **Ereignisprotokoll:** Was ist passiert, wer war beteiligt, warum, und was folgt daraus? Geld, Gäste, Personal, Lager, Rivalen und System, filterbar und mit Akteur-Links.
- **Rivalenprofile:** Betreiber, Stil, Ruf, Security, Personas, Maschinen, Mindesteinsatz und aufgeschlüsselter Hausvorteil. Eine Datenquelle, kein zweites hartkodiertes Haus.
- **Rivalenhandlungen:** Jede Aktion nennt Rivale, Ziel, Tick und Wirkung. Sabotage trifft genau ein Gerät und hinterlässt ein Indiz, das auch ein Guard nicht löscht.
- **Personal:** Jede Rolle hat einen sichtbaren Auftrag und einen Blockadegrund („keine Bar“, „Lager voll“, „Bar leer“). Löhne pro Tag stehen daneben.
- **Lager & Bar:** Bestand, Kapazität, Ersatzteile, Kisten und ihr Ziel. Reparaturen nennen die fehlende Ursache.
- **Ledger-Gesundheit:** Der Tickpfad prüft inkrementell; die Diagnose replayt auf Klick und nennt bei einem Bruch Seq, Grund und Folge.
- **Gäste-Feedback:** Der Gast nennt seinen Grund („Durst“, „kein freier Platz“, „zu wenig Chips“), nicht nur einen Zustandsnamen.

Dieselben Versprechen gelten für jede Figur außerhalb des Casinos: Ein Nachbar, der nicht mehr grüßt, muss einen Grund haben – und der Grund muss auffindbar sein.

## Visuelle Sprache

- **Pixel-Raster statt Vektorglanz:** blockige Figuren, harte Kanten, feste Palette – vorläufig, siehe oben.
- **Gelenk-Rig:** Arme, Beine, Kopf und Körper sind getrennte Teile. Zustände: idle, walk, sit, play, win, lose, drink, angry, carry.
- **Charaktereditor:** Haut, Haare, Outfit, Accessoire; rein kosmetisch, sofort auf dem Floor sichtbar, im Save.
- **Feedback:** Zahlen bleiben, aber sie bekommen Klartext, Farbe und einen Ort (Protokoll, Diagnose, Popup).
- **Responsive:** HUD wird unter 860 px zweizeilig und scrollbar, Popups unter 620 px zu Vollbild-Sheets, Touch hat Pinch-Zoom.
- **Zugänglich:** Fokusfalle und Fokus-Rückgabe, sichtbarer Fokus, Tastaturpfad für Laufen und Ablagen, `aria-live` für Ereignisse, `prefers-reduced-motion`.

## Steuerung

| Ort | Aktion |
| --- | --- |
| Floor | Freie Fläche: Charakter läuft dorthin. Gast: Budget, Laune, Geduld, Sucht, Grund. Objekt: Zustand, Mods, Testspin. |
| Bauen | Spiel oder Deko kaufen, als Kiste abholen, tragen und aufstellen. |
| HUD | Hauskonto abheben, Gäste, fremdes Haus, putzen, Protokoll, Diagnose, Charakter. |
| Minimap | Zonen anklicken, zoomen, alles einpassen. |
| Tastatur | Pfeile/WASD laufen, `Enter` stellt eine Kiste am Spieler ab oder lädt sie ab. |
| Popup | `Escape`, Schließen-Button oder Klick auf den Hintergrund; die Simulation läuft weiter. |

## Prüfungen

- `pnpm run verify:all` ist fail-closed und rein lesend: Lint, LOC, Typecheck, Testvertrag, tote Exporte, Doku-Gate, Tree-Gate, Redundanz-Gate, Asset-Manifest, Vitest, Audit und Build. Repariert wird ausschliesslich in `pnpm run fix`.
- Neue Tests: Protokoll, Ledger-Diagnose, Look, Rig, Save-v10-Roundtrip, UI/Fokus und Langlauf.
- `pnpm run soak` für 100.000 Ticks; `pnpm run test:perf` für Spielrunden, Floor, Posen, Speicher und Save-Größe; `pnpm run bench:lowend` für das Ein-Kern-Profil.
- Grenze: Ein echtes schwaches Gerät und ein echter Browser können hier nicht zertifiziert werden. Die Emulation und die manuelle Gerätematrix stehen in `docs/ARCHITECTURE.md`.
