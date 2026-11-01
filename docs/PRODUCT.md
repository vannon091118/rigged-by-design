# Produkt: Rigged by Design

**Ein Satz:** Du baust ein Casino, dessen Hausvorteil kein Bug, sondern das Produkt ist – und du musst jeden Tag verstehen, warum Gäste bleiben, gehen oder randalierten.

Kein Echtgeld. VaCoins sind fiktive, ganzzahlige Mikro-Einheiten (1 VC = 10.000). Es gibt keine Einzahlung und keinen Gewinn, der irgendwo ankommt.

## Der Kreislauf

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

Jede Buchung ist eine Ledger-Zeile. Kein `addVC` außerhalb einer Buchung, keine Geldquelle außer `EXTERNAL_WORLD`. Auszahlungen werden nie gekappt: Was das Hauskonto nicht deckt, steht als Verbindlichkeit auf `HAUS_SCHULDEN`.

## Systemversprechen

Jedes wichtige System muss **Zustand, Ursache und Konsequenz** zeigen:

- **Ereignisprotokoll:** Was ist passiert, wer war beteiligt, warum, und was folgt daraus? Geld, Gäste, Personal, Lager, Rivalen und System, filterbar und mit Akteur-Links.
- **Rivalenprofile:** Betreiber, Stil, Ruf, Security, Personas, Maschinen, Mindesteinsatz und aufgeschlüsselter Hausvorteil. Eine Datenquelle, kein zweites hartkodiertes Haus.
- **Personal:** Jede Rolle hat einen sichtbaren Auftrag und einen Blockadegrund („keine Bar“, „Lager voll“, „Bar leer“). Löhne pro Tag stehen daneben.
- **Lager & Bar:** Bestand, Kapazität, Ersatzteile, Kisten und ihr Ziel. Reparaturen nennen die fehlende Ursache.
- **Ledger-Gesundheit:** Der Tickpfad prüft inkrementell; die Diagnose replayt auf Klick und nennt bei einem Bruch Seq, Grund und Folge.
- **Gäste-Feedback:** Der Gast nennt seinen Grund („Durst“, „kein freier Platz“, „zu wenig Chips“), nicht nur einen Zustandsnamen.

## Visuelle Sprache

- **Pixel-Raster statt Vektorglanz:** blockige Figuren, harte Kanten, feste Palette.
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
- Neue Tests: Protokoll, Ledger-Diagnose, Look, Rig, Save-v8-Roundtrip, UI/Fokus und Langlauf.
- `pnpm run soak` für 100.000 Ticks; `pnpm run test:perf` für Spielrunden, Floor, Posen, Speicher und Save-Größe; `pnpm run bench:lowend` für das Ein-Kern-Profil.
- Grenze: Ein echtes schwaches Gerät und ein echter Browser können hier nicht zertifiziert werden. Die Emulation und die manuelle Gerätematrix stehen in `docs/ARCHITECTURE.md`.
