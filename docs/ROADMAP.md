# Roadmap

<!-- rbd-doc: managed -->

Drei Horizonte, keine Wunschliste. Was hier steht, ist entweder beauftragt oder
begruendet vertagt; abgeschlossene Punkte wandern ins Changelog.

## Nordstern: Living World Engine

Eine **autonome, begehbare Lebenssimulation**: Der Spieler beginnt in seiner eigenen
Wohnung (Schlafzimmer, Wohnbereich, Kochnische, Bad, Smartphone, Fenster nach draußen),
tritt durch die Haustür direkt auf die physisch zusammenhängende Stadtstraße und ist
ein Bewohner unter vielen. Die Stadt ist kein Auswahlbildschirm, sondern der permanente
Spielraum. Gebäude stehen an Straßen, Wohnungen besitzen Bewohner, Arbeitsplätze haben
Mitarbeiter, und Menschen gehen eigenständigen Tagesabläufen und Bedürfnissen nach.
Das Casino ist eine Umgebung unter vielen – nicht die Engine. Der Spieler kann die
Welt beobachten, beeinflussen oder einen vollkommen anderen Alltag führen, ohne jemals
ein Casino zu betreten. Der MVP ist der Systembeweis und die Vorgabe für Detailtiefe,
kein Content-Endstand.

## Governance-Freeze (aktiv)

Die Steuerungsebene ist gesperrt, bis **Stadt und Core-Loop stehen und mindestens § Progression-Zweige vollständig sind**. Gesperrt sind `.github/`, `.githooks/`, `.lane-claims/`, `scripts/` und die Governance-Verträge; frei bleiben `src/`, `content/`, `public/` und Tests.

Durchgesetzt wird die Sperre mechanisch: der lokale Pre-Commit-Hook und der `Plan`-Job in CI blockieren jede inhaltliche Governance-Änderung ohne PIN-Freigabe (`ERR-4030`). Eine Freigabe entsteht nur über `node scripts/freeze-unlock.mjs --pin=<pin>` und gilt genau für eine Basis. Fehlt sie ganz, bleibt der Lauf rot und die CI legt ein `BLOCKED`-Issue an (`Verdacht auf unautorisierte Korruption`); der Branch bleibt bestehen.

Aufhebung nur auf ausdrückliche Anweisung des Owners; danach gilt der Freeze weiter. Der Fokus bis dahin: Stadt, Core-Loop, Progression, Content und Baustein-Pools — keine Governance-Arbeit.

## Produktvertrag

> Bei der Doku-Konsolidierung aus `docs/PRODUCT.md` uebernommen; die Quelldatei wurde geloescht. Die Aussagen gelten zum Stand dieses Commits.

**Ein Satz:** Rigged by Design ist eine autonome Lebenssimulation: Du erwachst in deiner eigenen Wohnung, trittst auf die Straßen einer lebendigen Stadt und führst dein Leben – das Casino ist nur eine Umgebung unter vielen, in der Wahrscheinlichkeiten und Geschäftsmodelle greifen.

Kein Echtgeld. VaCoins sind fiktive, ganzzahlige Mikro-Einheiten (1 VC = 10.000). Es gibt keine Einzahlung und keinen Gewinn, der irgendwo ankommt.

### Der Titel ist das Programm

„Rigged by Design“ ist ein Wortspiel, und es beschreibt zuerst das Leben, nicht das Haus. Man sucht sich nicht aus, in welche Verhältnisse man geboren wird: Eltern, Stadt, Startkapital, Laune, Marken, Vorgesetzte. Andere haben mit ihrem Leben vor dir schon angefangen, und ihre Entscheidungen sind die Bedingungen, unter denen deine stattfinden. Das Spiel ist manipuliert, weil das Leben manipuliert ist – und weil ein Casino das ehrlichste Beispiel dafür ist, wie aus einem gezinkten System ein Geschäftsmodell wird.

Du erbst keinen festgelegten Karrierepfad. Du beginnst in deiner eigenen kleinen Wohnung: Schlafzimmer, Wohnbereich, Kochnische, Bad, persönliche Gegenstände, Smartphone und ein Fenster zur Straße. Vor deiner Haustür liegt eine physische Stadt mit funktionierenden Gebäuden, Bewohnern, Arbeitsplätzen und Geschäften. Was daraus wird, entscheidet keine Klasse oder ein starres Genre, sondern wie du deinen Alltag gestaltest – ob als Casino-Betreiber, Handwerker, Nachtschwärmer, Nachbar oder schlichter Beobachter.

### Casino ist eine Umgebung, nicht die Engine

Das Casino ist eine **spezialisierte Umgebung und Testbude für Wahrscheinlichkeiten und Wirtschaftssysteme**. Es ist der Ort, an dem bestimmte Systeme beweisen, dass sie tragen:

- Gäste mit Budget, Laune, Geduld, Persona und Erinnerung,
- ein Ledger, das jede Folge bucht, statt sie zu behaupten,
- eine Narrative Engine, die aus echten Zustandsübergängen Geschichten ableitet,
- eine Oberfläche, die Ursache und Wirkung zeigt, statt Zahlen zu dekorieren.

Es ist **nicht** das Endziel und nicht die Beschränkung des Spiels. Die Living World Engine trägt alle Orte gleichberechtigt: Wohnungen, Kneipen, Supermärkte, Büros, Werkstätten, Straßen und Plätze. Der Spieler ist ein Bewohner unter vielen und nicht der Mittelpunkt der Welt. Die Simulation läuft auch dann weiter, wenn der Spieler nicht hinsieht.

Der MVP ist ein **Systembeweis** und gleichzeitig die **Vorgabe für Detailtiefe**: Er zeigt, wie tief ein Aspekt simuliert wird, wenn er fertig ist – nicht, wie viel Content am Ende existiert. Weitere Kontexte – Kneipe, Tante-Emma-Laden, Wohnung, Straße, später die ganze Stadt – kommen laufend dazu.

### Der Pfad, bildhaft erklärt

Die folgende Kette ist kein Drehbuch und keine Feature-Liste. Sie ist das Muster, nach dem jeder Aspekt funktionieren soll – und sie ist bewusst nicht wörtlich zu nehmen:

1. **Du siehst eine Serie im TV.** Sie hebt deine Laune und dein Intellekt.
2. **Die Werbung dazwischen** hebt deine Ausgabebereitschaft, nicht dein Konto.
3. **Laune und Intellekt verändern dein Charisma.**
4. **Charisma entscheidet, wie NPCs auf dich reagieren**, was sie sich merken und was sie dir beim nächsten Mal vorhalten: dass du sie damals nach Geld für einen Döner gefragt hast.
5. **Heute hast du Geld.** Also kaufst du den Döner – und gibst deinen Freunden einen aus, weil guten Freunden gibt man einen Döner aus. Das fühlt sich richtig an, und das Spiel bucht es als Beziehung, nicht als Statistiksatz.
6. **Danach will dein Charakter neue Schuhe.** Die billigen drücken die Laune; die teuren kosten dreimal so viel und geben bei Leuten mit dem Trait „Konsument“ einen Charisma-Bonus. Marken und Preise sind Eigenschaften, keine Textzeilen.
7. **Dein Chef trägt diesen Trait auch.** Und du willst irgendwann dein eigenes Casino eröffnen, statt das von Willy Kleingeld zu putzen.

Jeder Schritt liest Zustand, jeder Zustand hat eine Ursache, jede Ursache ist sichtbar. Dieselbe Kette muss später in einer Kneipe, in einem Tante-Emma-Laden oder auf der Straße funktionieren, ohne dass die Regel neu geschrieben wird.

### Was hier schon die Engine ist

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

### MVP: Systembeweis, nicht Content-Endstand

Der heutige Umfang ist eine Momentaufnahme. Er belegt, dass die Kette Zustand → Ursache → Folge über Geld, Gäste, Personal, Rivalen und Erzählung hinweg funktioniert. Er belegt nicht, wie das fertige Spiel aussieht, wie viele Orte es gibt oder wie die endgültige Bildsprache wirkt.

### Optik: vorläufig und plattformfreundlich

Die aktuelle Low-End-Optik ist **noch nicht final** und deutlich von der Vision entfernt. Der Preis dafür wird von Anfang an bezahlt: Das Spiel muss auf vielen Plattformen laufen, auch auf schwachen Geräten. Die jetzige Pixel-Optik ist ein plattformfreundlicher Machbarkeitsbeweis, keine endgültige Bildsprache. Die Regeln, die schon gelten, stehen im Bildsprache-Anhang von [`ARCHITECTURE.md`](ARCHITECTURE.md); eine eigene `ART-DIRECTION.md` gibt es nicht mehr.

### Vor dem Release: eine bespielbare Stadt

Der Release-Horizont ist keine größere Spielhalle, sondern eine **Stadt, die man spielen kann**: mehrere Orte, Wege dazwischen, Figuren mit eigenen Tagesabläufen und Erinnerungen, ein Charakter mit Laune, Ruf und Ressourcen. Das Casino bleibt darin ein Ort unter vielen – der erste, den man betritt.

### Was als Nächstes dazukommt

- **Social-Plugin der Narrative Engine:** Dieselben Facts, Erinnerungen und Beziehungen tragen außerhalb eines Hauses – zwischen Nachbarn, Kollegen und Freunden, nicht nur zwischen Gast und Kasse.
- **Ledger-Ressourcen:** Neben Geld kommen Ressourcen nach Bedarf dazu – Zeit, Ruf, Vorräte, Aufmerksamkeit. Jede bleibt eine gebuchte Zeile mit Ursache.
- **Weitere Kontexte:** Kneipe, Tante-Emma-Laden, Wohnung, Arbeitsplatz. Jeder Ort ist ein eigener Vertical Slice mit denselben Regeln.
- **Charakterwerte als allgemeine Achsen:** Laune, Charisma, Intellekt und Ausgabebereitschaft gelten für die Spielfigur genauso wie für Gäste und NPCs.

### Der Kreislauf (heute, im Casino)

1. **Gäste kommen** abhängig von Ruf, Ordnung, Gerätezustand, Personal und Angebot – nicht von einem Timer.
2. **Wechselkasse:** Fiat wird erst am Schalter zu Chips. Es gibt keine zweite Geldwahrheit.
3. **Angebot:** Gäste wählen nach Persona, Budget, Laune, Geduld, Sucht und Platzverfügbarkeit.
4. **Spiel:** Einsätze gehen ins Hauskonto, Gewinne warten als offene Auszahlung.
5. **Ausbau:** Spiele, Deko, Mods, Walzen, Personal, Reinigung und Reparaturen zahlen aus dem Hauskonto.
6. **Zustand:** Dreck, Defekte und leere Bars senken den Ruf, die Laune und den Zulauf.
7. **Fremdes Haus:** Du bist Gast bei echten Rivalen mit eigenen Regeln, Mindesteinsätzen und Hausvorteil.

### Zwei Töpfe, eine Wahrheit

| Topf | Zweck |
| --- | --- |
| Hauskonto | Geschäftskonto für Käufe, Einsätze, Löhne, Miete und Auszahlungen. |
| Portemonnaie | Persönliches Bargeld, nur durch Abheben vom Hauskonto und nur in fremden Häusern verspielbar. |
| Wechselkasse | Physischer Schalter für Fiat → Chips und offene Gewinne. |

Jede Buchung ist eine Ledger-Zeile. Kein `addVC` außerhalb einer Buchung, keine Geldquelle außer `EXTERNAL_WORLD`. Auszahlungen werden nie gekappt: Was das Hauskonto nicht deckt, steht als Verbindlichkeit auf `HAUS_SCHULDEN`. Ressourcen, die später dazukommen, folgen demselben Prinzip – sie werden gebucht, nicht gesetzt.

### Systemversprechen

Jedes wichtige System muss **Zustand, Ursache und Konsequenz** zeigen:

- **Ereignisprotokoll:** Was ist passiert, wer war beteiligt, warum, und was folgt daraus? Geld, Gäste, Personal, Lager, Rivalen und System, filterbar und mit Akteur-Links.
- **Rivalenprofile:** Betreiber, Stil, Ruf, Security, Personas, Maschinen, Mindesteinsatz und aufgeschlüsselter Hausvorteil. Eine Datenquelle, kein zweites hartkodiertes Haus.
- **Rivalenhandlungen:** Jede Aktion nennt Rivale, Ziel, Tick und Wirkung. Sabotage trifft genau ein Gerät und hinterlässt ein Indiz, das auch ein Guard nicht löscht.
- **Personal:** Jede Rolle hat einen sichtbaren Auftrag und einen Blockadegrund („keine Bar“, „Lager voll“, „Bar leer“). Löhne pro Tag stehen daneben.
- **Lager & Bar:** Bestand, Kapazität, Ersatzteile, Kisten und ihr Ziel. Reparaturen nennen die fehlende Ursache.
- **Ledger-Gesundheit:** Der Tickpfad prüft inkrementell; die Diagnose replayt auf Klick und nennt bei einem Bruch Seq, Grund und Folge.
- **Gäste-Feedback:** Der Gast nennt seinen Grund („Durst“, „kein freier Platz“, „zu wenig Chips“), nicht nur einen Zustandsnamen.

Dieselben Versprechen gelten für jede Figur außerhalb des Casinos: Ein Nachbar, der nicht mehr grüßt, muss einen Grund haben – und der Grund muss auffindbar sein.

### Visuelle Sprache

- **Pixel-Raster statt Vektorglanz:** blockige Figuren, harte Kanten, feste Palette – vorläufig, siehe oben.
- **Gelenk-Rig:** Arme, Beine, Kopf und Körper sind getrennte Teile. Zustände: idle, walk, sit, play, win, lose, drink, angry, carry.
- **Charaktereditor:** Haut, Haare, Outfit, Accessoire; rein kosmetisch, sofort auf dem Floor sichtbar, im Save.
- **Feedback:** Zahlen bleiben, aber sie bekommen Klartext, Farbe und einen Ort (Protokoll, Diagnose, Popup).
- **Responsive:** HUD wird unter 860 px zweizeilig und scrollbar, Popups unter 620 px zu Vollbild-Sheets, Touch hat Pinch-Zoom.
- **Zugänglich:** Fokusfalle und Fokus-Rückgabe, sichtbarer Fokus, Tastaturpfad für Laufen und Ablagen, `aria-live` für Ereignisse, `prefers-reduced-motion`.

### Steuerung

| Ort | Aktion |
| --- | --- |
| Floor | Freie Fläche: Charakter läuft dorthin. Gast: Budget, Laune, Geduld, Sucht, Grund. Objekt: Zustand, Mods, Testspin. |
| Bauen | Spiel oder Deko kaufen, als Kiste abholen, tragen und aufstellen. |
| HUD | Hauskonto abheben, Gäste, fremdes Haus, putzen, Protokoll, Diagnose, Charakter. |
| Minimap | Zonen anklicken, zoomen, alles einpassen. |
| Tastatur | Pfeile/WASD laufen, `Enter` stellt eine Kiste am Spieler ab oder lädt sie ab. |
| Popup | `Escape`, Schließen-Button oder Klick auf den Hintergrund; die Simulation läuft weiter. |

### Phase 2 – World-first UI (P0)

Die Welt ist der permanente Hauptbildschirm. Wir unterscheiden vier UI-Typen:

| Typ | Verwendung | Umsetzung |
| --- | --- | --- |
| **Kontextaktion** | Eine Handlung an einem Objekt | `ActionCard` am Weltanker: Reinigen, Drink zapfen, Reden, Schlichten. |
| **Objektpanel** | Eigenschaften und mehrere Handlungen eines Objekts | `PopupShell surface="object"`: Gast-Kontextpanel und Gerätediagnose hängen am Ziel, der Floor bleibt sichtbar. |
| **Aktivitätsansicht** | Blackjack, Poker, Roulette, Dialoge und ähnliche Erlebnisse | `PopupShell surface="activity"` mit bewusstem `VOLLBILD`-Ausstieg; die Welt bleibt als Orientierung im Hintergrund. |
| **Globale Übersicht** | Karte, Charakter, Journal, Einstellungen | `PopupShell surface="overview"`, geöffnet über Dock oder Welt-Einstieg. |

- Der Betriebs-Dock führt nur noch **BETRIEB · KARTE · DU**. Die Gästezahl im HUD öffnet die Gästeliste; der NPC-Klick öffnet das verankerte Objektpanel.
- `screenAnchorOf()` trägt den Weltpunkt, `FloorView.project()` rechnet ihn pro Frame neu. Aktionskarte und Objektpanel bleiben bei Kamera- und Zoomfahrten am Ziel und werden an den Viewport geklemmt: links/rechts mit Rand, oben/unten mit Edge-Flip; reicht die Höhe nicht, wird gedeckelt und der Inhalt scrollt.
- `Escape` schließt zuerst die Aktionskarte; `PopupShell` schließt das Panel und gibt den Fokus an das auslösende Element zurück. Die Welt bleibt der Rückweg.
- Das Smartphone ist kein Pflichteingang: Bauen, Putzen, Servieren und Reisen bleiben über Welt, Dock und Betrieb erreichbar. Die Geräte-Apps sind nur Abkürzungen.
- Abnahme: NPC auswählen, Handlung ausführen, Gerät bedienen und mit `Escape`/Schließen zum Floor zurück. Belege: `floor-anchor.test.ts` (2), `world-first-ui.test.tsx` (3), `anchor-layout.test.ts` (13), `small-screen-layout.test.ts` (6) und `small-screen-acceptance.test.tsx` (4). Der volle Ablauf läuft bei 360×640 und 320 px; die Aktionskarte bleibt an beiden Rändern im Viewport. Die sichtbare Pixelprüfung im echten Browser bleibt offen.

### Prüfungen

- `pnpm run verify:all` ist fail-closed und rein lesend: Lint, LOC, Typecheck, Testvertrag, tote Exporte, Doku-Gate, Tree-Gate, Redundanz-Gate, Asset-Manifest, Vitest, Audit und Build. Repariert wird ausschliesslich in `pnpm run fix`.
- Neue Tests: Protokoll, Ledger-Diagnose, Look, Rig, Save-v10-Roundtrip, UI/Fokus und Langlauf.
- `pnpm run soak` für 100.000 Ticks; `pnpm run test:perf` für Spielrunden, Floor, Posen, Speicher und Save-Größe; `pnpm run bench:lowend` für das Ein-Kern-Profil.
- Grenze: Ein echtes schwaches Gerät und ein echter Browser können hier nicht zertifiziert werden. Die Emulation und die manuelle Gerätematrix stehen in `docs/ARCHITECTURE.md`.

## Jetzt — die Testumgebung tragfaehig machen

### Textbausteine: Pflichtregel und Stand

Die Textbausteine sind Inhalt, keine Mechanik: Sie liegen als JSON unter
`content/narrative/contributions/`, werden im Turn-Manifest registriert und vom
Compiler in Registry und Laufzeit-Spiegel verdrahtet. Die Regel ist gate-geprueft,
nicht nur dokumentiert. Normativ ist allein Regel 6 aus `AGENTS.md` - diese
Tabelle ist die aktuelle Messung, kein zweites Regelwerk; bei Widerspruch gilt
der Kurzvertrag:

| Regel | Grenze | Durchsetzung |
| --- | --- | --- |
| Mindestgroesse je Pool (Slot) | 50 Fragmente | `verify:narrative-blocks` und Assets-Gate |
| Gesamtziel | 1500 Bausteine | Fortschritt im Gate-Bericht; Ueberschreiten ist ein Befund |
| Pflicht pro Commit | mindestens ein neuer, verdrahteter Baustein; Ausnahme nur fuer reine Doku-/Inventur-/Tooling-Commits | Pre-Commit-Hook (`--commit`) |
| Luecken-Regel | offene Pools zuerst; bei vollem Minimum darf jeder Pool wachsen | `gapIssues` im Gate |
| Schrumpf-Verbot | kein Pool darf kleiner werden, kein Beitrag geloescht | `shrinkIssues` im Gate |
| Einmaligkeit | kein doppelter Text (normalisiert) | `poolReport` im Gate |

Stand 2026-11-10: **834/1500** Bausteine in 13 Pools. Die Pools tragen 50 bis 59
Fragmente, darunter die Stadt-Pools `city-scene` und `city-night` aus dem
Vertikalschnitt sowie die drei Ruf-Pools (`guest-voice-low`, `guest-voice-mid`,
`guest-voice-high`) mit mindestens 50. Die Pool-Mindestgroesse ist damit an allen 13
Pools erreicht und bleibt Untergrenze.

**Der Weg zu 1500 ist eine Pool-Struktur, keine Auffuellung.** 1500 / 50 = 30
Pools. Jeder neue Pool gehoert zu einem System oder Kontext (Ruf, Ledger, Route,
Markt, Beziehung, Personal, Inventar) und muss einen Leser im Spiel haben, sonst
ist der Text tot. Der erste Schritt in diese Richtung ist gemacht: Die drei
Ruf-Pools werden von `narrative/guest-voice.ts` gelesen, und der Pre-Commit-Hook
verlangt weiterhin pro Commit einen verdrahteten Baustein.

**Erledigt: die Luecken-Regel ist repariert (#267).** `gapIssues` in
`scripts/lib/narrative-blocks.mjs` fuellt jetzt die offenen Pools, solange es
welche gibt; sind alle Pools mindestens voll, darf jeder Pool wachsen. Damit
blockiert die erreichte Mindestgroesse keinen Content-Commit mehr, und das Ziel
1500 bleibt erreichbar, ohne die Untergrenze zu senken. `shrinkIssues` verbietet
zusaetzlich, einen Beitrag zu loeschen oder einen Pool zu verkleinern - auch in
einem Pflege-Commit. Beleg: `scripts/verify-narrative-blocks.mjs` ruft beide
Pruefungen im Commit-Modus auf.

Offen bleibt nur die dritte, hier frueher vorgeschlagene Verschaerfung: das Gate
prueft nicht, ob ein neuer Pool **einen Leser** im Code hat (P-14). Ein
Registry-Eintrag allein ist kein Verdrahten.

### Offene Stellen — ein Register (Stand 2026-11-08)

Eine Liste statt vier. Jeder Punkt nennt Kategorie, Status, Beleg und naechsten
Schritt. Erledigtes wandert ins Changelog; bewusst Vertagtes steht unten in
`PARKED` mit Owner und Ausloeser. Fruehere Einzelabschnitte
("Offene Stellen, kategorisiert" und "Offene Punkte, konsolidiert 2026-11-06")
sind hier aufgegangen; ihre Details sind in `INVENTORY.md` §14/§16 und im
Changelog belegt.

Das Register ist maschinell geprueft: `src/core/governance/__tests__/roadmap-register.test.ts`
erzwingt Statusvokabular, eindeutige IDs, aufloesbare Referenzen (Datei, Symbol,
Commit) und die Fortschrittszahl gegen `content/narrative/registry/fragments.json`.
Ein Eintrag, der auf geloeschten Code oder eine falsche Zahl zeigt, macht `tests`
rot. Die inhaltliche Behauptung „offen“ gegen bereits gemergten Code kann ein
Dokumenten-Gate nicht entscheiden; deshalb traegt jeder geschlossene Punkt seinen
Code und seinen Test als Beleg.

#### A. Spiel und Simulation

| ID | Punkt | Status | Beleg / naechster Schritt |
| --- | --- | --- | --- |
| P-1 | Luecken-Regel sperrte Pools ab 50 (siehe oben) | **erledigt 2026-11-08 (#267)** | `gapIssues` fuellt offene Pools zuerst, danach ist Wachstum erlaubt; `shrinkIssues` verbietet Schrumpf; Beleg im Abschnitt Textbausteine |
| P-2 | Stadt-Loop war nicht auf `main`: Kiez (Fremder→Eingeweihter), Markt (Laufbursche→Marktherr), Energie und "Tag beenden" lagen nur in PR #264 | **gemergt 2026-11-08 (#264)** | Merge-Commit `fd6c081`; Stadt-Kopf-CI gruen (`42441210747`, `42441205413`), Stadt-Tests und `city-loop-walkthrough.test.ts` gruen |
| P-3 | `PLAYER_CASH` hat eine Funktion, aber keinen Produktions-Aufrufer | **erledigt 2026-11-08 (#290)** | Produktionspfad `src/ui/self-exclusion-panel.tsx` → `src/store/game-commands.ts` `CASH_OUT` → `cashOutPlayerCash`; Tests `src/store/__tests__/exclusion-command.test.ts` und `src/ui/__tests__/self-exclusion-panel.test.tsx`; Merge `5e0f2a0`, Claim lane/sim/player-cash-payout |
| P-4 | Einnahmen je Spieltyp fehlen als Kennzahl | **erledigt 2026-11-09** | `LedgerEntry.game` traegt den Spieltyp echter Runden, `economyOf().byGame` summiert Einsatz und Auszahlung je Typ; Test `ledger-game-type.test.ts` belegt Save/Load-Erhalt |
| P-5 | Sucht-Folgen sind eine Designentscheidung | **erledigt 2026-11-09** | `reputation()` in `src/core/sim/spawn.ts` zieht je erkennbar suechtigem Gast (Blase ab `ADDICTED_THRESHOLD` in `src/core/sim/emotion.ts`) einen Rufpunkt ab, Deckel 6, Guard halbiert; Test `src/core/sim/__tests__/addiction-consequences.test.ts` |
| P-6 | Archiv wird beim ersten Load aus dem Journal gefuellt | **verifiziert, keine Luecke** | `store/migrate.ts` setzt `saved.archive ?? world.journal` (auf `main` seit Archiv-Einfuehrung); ein gespeichertes Archiv bleibt unangetastet; Tests `src/store/__tests__/save-migration.test.ts` (Faelle Fallback-Fuellung und Archiv-Erhalt) |
| P-7 | Ruf → Slot-Nutzung | **erledigt 2026-11-08** | `guest-play.ts` `stakeConfidence` (0,8..1,2, Deckel und Chipbestand bleiben hart); Test `reputation-slot-use.test.ts` |
| P-8 | Ruf → Gastsprache | **erledigt 2026-11-08** | `narrative/guest-voice.ts` waehlt deterministisch aus drei Ruf-Pools; Test `guest-voice.test.ts` |
| P-9 | Layout → Gaeste-Routen | **verifiziert, keine Luecke** | `world.ts` `worldNav` → `navGrid(size, furniture, world.layout)` (Wandkanten), `pathTo` → `findPath(guestNav(world))`; Layout-Aenderung aendert Pfade, `gridCache` erkennt sie an der Layout-Identitaet |
| P-10 | Ledger → Narrative | **verifiziert, keine Luecke** | `narrative/ledger-facts.ts` verarbeitet Buchungen ab `ledgerSeq` und emittiert nur Bandwechsel `HOUSE_BALANCE` |
| P-11 | SlotMemory → Ledger → Narrative | **erledigt 2026-11-09 (#296)** | `src/core/sim/narrative/__tests__/slot-discharge-fact.test.ts` belegt die Entladung als Fact; Implementierung in `src/core/sim/narrative/facts.ts`; Merge `2cd663a` |
| P-12 | Beziehungen → Ruf | **verifiziert 2026-11-08 (#271)** | `relationshipStanding()` in `src/core/sim/narrative/relationships.ts` addiert in `src/core/sim/spawn.ts` einen deterministischen, auf ±6 Punkte begrenzten Anteil an `reputation()`; Test `src/core/sim/__tests__/reputation.test.ts` |

#### B. Narrative und Content

| ID | Punkt | Status | Beleg / naechster Schritt |
| --- | --- | --- | --- |
| P-13 | 1006/1500 Textbausteine | offen (Ziel) | 13 Pools, alle mindestens 50; neuer Kontext `echo` fuer spaetere Kettenbegegnungen |
| P-14 | Neue Pools brauchen einen Leser, das Gate prueft das nicht | offen | `guest-voice-*` hat `guest-voice.ts`; kuenftige Pools ebenso, sonst ist der Text tot |
| P-15 | `TRIGGER_DIALOG` ist nicht ausfuehrbar | **erledigt 2026-11-09** | `src/core/sim/narrative/commands/registry.ts` fuehrt `executable: true`, `src/core/sim/narrative/commands/preflight.ts` lehnt unbekannte Dialog-IDs ab, `src/ui/popup-router.tsx` oeffnet per `src/ui/dialog-request.ts` das referenzierte Skript; Tests `src/core/sim/__tests__/trigger-dialog.test.ts` und `src/ui/__tests__/dialog-request.test.ts` |
| P-16 | Geraete-, Lager- und Personal-Facts fehlen bewusst | offen | neue Fact-Kinds brauchen erst Definition und Template |
| P-17 | Narrative Balance ist begrenzt, nicht gemessen | offen | ±8 Aktivitaet, ±20 % Angebot, ±10 Punkte Rueckkehr sind Grenzen ohne Messreihe |

#### C. Optik, Performance und Abnahme

| ID | Pruefung | Stand | Naechster Schritt |
| --- | --- | --- | --- |
| A1 | Desktop-Grundbild | bestanden 2026-11-06 | - |
| A2 | Werkstatt-Einstieg (5x Marke, Strg+Shift+D) | offen | beide Wege im Browser oeffnen |
| A3 | Sechs Werkstatt-Ziele | offen | Klickrunde durch alle sechs Ziele |
| A4 | Spiegel im Lager, Save-Roundtrip | offen | Browser + Save-Roundtrip |
| A5 | FPS aus echten rAF-Frames | offen | Panel + Gegenprobe |
| M4 | Smartphone als echte Geraeteflaeche | offen | Vergleich der vier Fensterzustaende |
| P-18 | Wand-Occlusion visuell | offen | Depth-Tests stehen, Browserbeleg fehlt |
| P-19 | First Frame unter 3 s / Slow 4G | offen | Baseline 22 Requests/12,16 s/2,42 MB |
| P-20 | Generierte Dependency-Matrix liegt in der gesperrten `docs/ARCHITECTURE.md` | **erledigt 2026-11-10** | Matrix liegt in `docs/DEPENDENCY-MATRIX.md`; Generator und Autofix-Plan schreiben nur noch dorthin, die Architektur verlinkt sie. Neue Testdateien verschieben damit keine gesperrte Datei mehr. |
| A6-A8 | Touch auf Hardware, Huelle, APK-Installation | zurueckgestellt | erst nach vollstaendiger Desktop-Abnahme |
| P-21 | Einfluss-Matrix als anpassbare Config | **verifiziert 2026-11-08** | `influence-config.ts` gewichtet `mood`, `sociability`, `thirst`, `rumor` sowie `trust`, `sympathy` und `conflict` je Kontext, wendet Cross-Kanten an (unter anderem Vertrauen/Konflikt auf Geselligkeit) und validiert fail-closed; Consumer `guest-choice.ts` (Bar-Nachfrage mit Beziehungskante); Test `influence.test.ts` |
| P-22 | Main Event Pool mit nicht unterscheidbaren, nicht repetitiven Events | **verifiziert 2026-11-08** | `main-event-pool.ts` zieht nur bei idle, gewichtet ueber die gerichteten trust/sympathy/conflict-Kanten und Cross-Kanten, daempft Wiederholung per Recency und Lockout und nutzt dieselbe Event-Karte ohne Sonder-UI/-Log; drei feste `AMBIENT_*`-Templates, Config in `influence-event-pool.ts`, Tests `main-event-pool.test.ts` |
| P-23 | NPC-Wissen und Geruechte mit Distanz- und Quellenverlust | **verifiziert 2026-11-08** | `knowledge.ts` erzwingt Provenance (unmittelbare und urspruengliche Quelle, Art, Distanz, Beobachtungs-Tick), `knowledge-observation.ts` verlangt fuer Sicht/Geraeusch echte Anwesenheit, `knowledge-query.ts` altert und bewahrt Widersprueche, `knowledge-share.ts` macht die Weitergabe vom zentralen Matrix-Kontext `share` in `influence-config.ts` abhaengig, `knowledge-gossip.ts` rangiert Quellen ueber die balancebaren `gossip`-Gewichte der Knowledge-Config, und empfangenes Wissen schreibt begrenzt auf die Kante zur Quelle und zum Subjekt zurueck; Tests `knowledge.test.ts`, `knowledge-domain.test.ts`, `knowledge-relationships.test.ts` und `knowledge-config.test.ts` |
| P-24 | Verkettete Narrative mit Verzweigungen, Ruhephasen und Zusammenfuehrung | **verifiziert 2026-11-08** | `src/core/sim/narrative/chains/chain-runtime.ts` startet nur aus aufgeloesten Events, waehlt deterministisch einen bedingten Uebergang und prueft ruhende Uebergaenge bei Faelligkeit erneut; `chain-schema.ts` lehnt tote Enden, unerreichbare Knoten und Zyklen ohne Wiederaufnahme ab; `chain-persist.ts` sichert Laeufe; `NARRATIVE_CHAINS` traegt Warm- und Konfliktkette; Tests `narrative-chain-runtime.test.ts` und `narrative-chain-schema.test.ts` |

#### D. Governance, CI und Abnahme der Lieferung

| Punkt | Status | Beleg / naechster Schritt |
| --- | --- | --- |
| Monitor-Closeouts #448-#452 | **erledigt 2026-11-11** | #448-#450: PR #451, Merge `9e8f914`; Nachsorge PR #453, Merge `19f58db`; #452: PR #454, Merge `50869ee`. Claims `merged`, Tasks `DONE`; `claim-cleanup` `superseded`. |
| Direktpush auf `main` | Regel bleibt | Branch-Schutz antwortet mit `GH006` (nur PR plus Pflichtstatus); die Registerpflege lief deshalb als Governance-Lane ueber PR (#268, #269) |
| Merge-Nachricht ist Gate-Text | offen | Ein Squash ueber die API mit blossem Titel laesst `main` am Commit-Notes-Gate rot (`ERR-4006`); die drei Pflichtsektionen muessen im Nachrichtentext stehen |
| Gate-Bypass | Regel bleibt | `--no-verify`, `git stash` und leere Trigger-Commits sind ausgeschlossen |
| Lane-Kollision in `agent:pretask` | offen (niedrig) | `agent:pretask` meldet Kollision mit `lane/governance/pr-251-repair`, `verify:claims --ci` akzeptiert dieselbe Lane |
| Governance-Aenderung fuer P-1 | **erledigt 2026-11-08** | #267 hat `gapIssues` und `shrinkIssues` mit Freigabe geaendert; es bleibt keine offene Freeze-Anfrage |

#### E. Technik, Doku und Release

- **Asset-Lizenz:** Nutzer hat bestaetigt, der Nachweis im Repo fehlt.
- **Dependency-Audit:** Android-Gradle-Nachweis nur in CI; CVE-Untergrenzen vor dem naechsten Upgrade pruefen; Vite-Warnung zum extensionlosen Import offen.
- **Asset-Semantik:** Deko-Rollen von Label-Regexen loesen; entscheiden, ob der Katalog ein Gate bekommt.
- **Verwaiste Doku-Referenzen:** Verweise auf geloeschte `docs/PRODUCT.md` und `docs/ART-DIRECTION.md` sind entfernt; bei neuen Loeschungen zuerst `docs/INDEX.md` pruefen.
- **Offene Kleinbefunde (INVENTORY §14):** ERR-4016-Zuordnung, Windows-Pfad in `opencode.json`, Audit-Drift, Slot-Symbol-Fallback-Keys, dynamischer Asset-Zaehler, eine Konstante fuer Tick-Dauer, Shell-Typo.

#### PARKED (bewusst zurueckgestellt)

Jeder zurueckgestellte Befund gehoert hierher, nicht in ein stilles `LOCAL_GATE`.
Pflichtfelder: Owner, Ausloeser, naechster Schritt, Review-Bedingung.

| Befund | Owner | Ausloeser | Naechster Schritt | Review-Bedingung |
| --- | --- | --- | --- | --- |
| SemVer-Entscheidungsmaschine | Governance-Owner | Release braucht eine Entscheidung ausserhalb des Patch-Bumps | Diff-Klassifikation als eigener idempotenter Job; `release-impact.mjs` bleibt die einzige Quelle | Review beim naechsten Release-PR |
| Doku-Reconcile-Runner | Governance-Owner | generierte Doku driftet oder der Hook fehlt | begrenzter Reparaturlauf mit Pfad-Allowlist und Abbruch bei fremdem Head | Review, wenn `verify:docs` zweimal denselben Fehler meldet |
| Weitere Governance-Reports ohne Handlung | Governance-Owner | ein Report liefert keine naechste Aktion | nicht bauen; bestehende Diagnose nutzen | Review nur mit konkretem Defekt |
| Automatische Reparatur fachlicher Spielcodefehler | Sim-/Domain-Owner | ein Spielcodefehler ist reproduziert | manuelle Reparatur; CI liefert nur die Diagnose | Review bei wiederkehrendem Fehler |

Diese Punkte blockieren keine Spielentwicklung. Neue Governance-Arbeit ist nur
bei konkretem Defekt, realem Integritaetsfehler, messbarem Workflow-Zeitverlust
oder nachweisbarer wiederkehrender Agentenarbeit zulaessig.

## Als Nächstes — Living World Engine: Phasenplan

Die Entwicklung fokussiert sich auf die mehrphasige Umsetzung der Living World Engine. Die bestehende Grundlage (`src/core/`, `world-store`, Ledger, PRNG, Narrative Engine) bleibt erhalten und bildet das Fundament:

### Phase 0 – Bestehende Grundlage schützen und konsolidieren
- **Ziel:** Auf dem aktuellen Repository-Stand weiterarbeiten, nicht von vorne anfangen.
- Headless WorldState, Store, deterministische Simulation, A*-Navigation, Interaction Planning, Narrative Scheduler und Pixi-Depth-Stage bleiben erhalten.
- In-flight PRs (#402, #403) und bestehende Feature-Lanes behalten ihren regulären Ablauf.

### Phase 1 – Home & Neighborhood Foundation (P0)
- **Spieler-Wohnung:** Start in eigener Wohnung (Schlafzimmer, Wohnbereich, Kochnische, Bad, persönliche Gegenstände, Smartphone, Fenster zur Straße).
- **Physische Stadtstraße:** Straßennetz, Gehwege, Kreuzungen, Straßenlaternen und belegbare Gebäude-Footprints.
- **Gebäude-Entitäten:** Jedes Gebäude besitzt eine stabile ID, Position/Footprint, Eingang, Gebäudetyp, Bewohner/Eigentümer, Öffnungszeiten und Innenraum-Referenz.
- **Nahtlose Raumübergänge:** Der Gang durch die Haustür führt physisch auf die Straße; das Betreten eines Gebäudes wechselt den Raumfokus ohne Spielstands-Reset.

### Phase 2 – Autonomous NPC World (P0)
- **Tagesabläufe & Routinen:** NPCs stehen morgens auf, frühstücken, laufen zur Arbeit, machen Pausen, kaufen ein, besuchen Freunde, haben Freizeit und schlafen.
- **Ziele & Bedürfnisse:** Intent-Simulation reagiert auf Hunger, Müdigkeit, Geld, Verpflichtungen, Laune, Interessen, Konflikte und Erinnerungen.
- **Dynamische Pläne:** NPCs können sich verspäten, Pläne ändern, Termine verpassen oder auf Zwischenfälle reagieren.
- **Persistente Präsenz & LOD:** NPCs despawnen nicht beim Verlassen des Bildschirms. Sichtbare Akteure laufen voll simuliert (A*); Akteure außerhalb des Sichtbereichs werden deterministisch fortgeschrieben und bei Wiederannäherung nahtlos auf ihren Pfad synchronisiert (keine Teleportation).

### Phase 3 – Physical Buildings & Interior Continuity (P0)
- **Physische Gebäude:** Wohnungen, Kneipen, Supermärkte, Kioske, Büros, Werkstätten und Spielhallen nutzen dieselbe World Engine mit spezifischen Raum-Layouts.
- **Akteur-Kontinuität:** Folgt der Spieler einem NPC in ein Gebäude, trifft er im Innenraum auf exakt dieselbe Person mit unverändertem Zustand und Gedächtnis. Keine Duplikate, kein Respawn.

### Phase 4 – Social Interaction & Communication (P0)
- **Situative Begegnungen:** Gespräche entstehen durch physische Nähe, Blickkontakt, Herantreten oder wenn ein NPC den Spieler anspricht.
- **Smartphone-Kommunikation:** Anrufe und Nachrichten sind echte Simulationsereignisse mit Sender, Motivation, Kontext und Zeitpunkt.
- **Kontextsensitive Dialoge:** Gespräche berücksichtigen Persönlichkeit, Charisma, Beziehungskanten, Stimmung, Erinnerungen und bisherige Aussagen.

### Phase 5 – World Events & Interactive Story Chains (P0/P1)
- **Räumliche Ereignisse:** Vorfälle geschehen physisch in der Stadt (z. B. Disput vor einem Geschäft).
- **Handlungsfreiheit:** Der Spieler kann zusehen, vorbeigehen, schlichten oder eskalieren.
- **Verzweigte Folgen:** Ereignisse erzeugen persistente Fakten und Erinnerungen, die sich auf spätere Begegnungen und Gerüchte auswirken.

### Phase 6 – World Presentation & Visual Responsiveness (P1)
- **Reaktiver Präsentationsvertrag:** Sichtbare Rückmeldung auf alle Aktionen (Blickwendung, Gesten, Türanimation, Smartphone-Klingeln/Vibrieren, Lichtinseln).
- **Präsentationsqualität:** Depth-Stage-Occlusion, Interaktions-Highlights, Kontaktschatten und sauberes Kamera-Framing.

### Phase 7 – Visual Asset Production (Parallel)
- **Zentrale Art Direction:** Einheitlicher Pixelmaßstab, Perspektive, Paletten und Proportionen.
- **Spezialisierte Artists & Asset Integrator:** Strukturierte Asset-Lieferung (Environment, Objects, Characters, Architecture, Animation) in Manifest und Semantik-Register ohne Writer-Kollisionen.

### Phase 8 – Interaktiver Living World Vertical Slice (Zentrale Abnahme)
- **End-to-End-Abnahmeszenario:** Aufwachen in der Wohnung -> Smartphone-Nachricht -> Hinaustreten auf die Straße -> Nachbarn beobachten -> Nachbarn zur Kneipe folgen -> denselben Nachbarn am Tresen treffen -> Gespräch führen -> Beziehungskonsequenz -> spätere Erinnerung.
- **Automatisierte Systemabnahme:** Keine NPC-Duplikate, keine Teleportationssprünge, Save/Load-Erhalt über alle Raumgrenzen hinweg.

### Phase 9 – Stadt skalieren und Lebenssysteme ausbauen
- Skalierung von Stadtvierteln, Wohnungen und Gewerbe.
- Anbindung der Fachdomänen von Agents 16–30 (Personal, Hospitality, Events, Arena, Esports, Multi-Property) an das lebendige Stadtgefüge.

## Später — Stadt und Release

- **Bespielbare Stadt vor dem Release:** Mehrere Bezirke, begehbare Straßen, Figuren mit vollständigem Tagesablauf, Erinnerung und eigenem Geld; ein Charakter mit Laune, Ruf und Ressourcen. Das ist der Release-Horizont, nicht ein größerer Saal.
- Rivalen-Profilkarten mit Historie und Indizien; ortsübergreifende Aktionen statt nur casino-spezifischer Sabotage.
- Sieben-Tage-Langlauf mit dynamischen Welt-Ereignissen als eigener CI-Nachweis.
- Übersetzung der UI-Texte, falls eine zweite Sprache dazukommt.

---

## Der 30-Agenten-Masterplan: Anbindung an die Living World

Die Facharbeiten der Agents 01–30 bleiben integraler Bestandteil des Gesamtprojekts und werden schrittweise in die Living World eingebettet:
- **Agents 01–06 (Spielerrolle):** Bereits weitgehend geliefert (Geldtrennung, Arbeit, RPG-Attribute, Kampfkarriere, Dashboard).
- **Agents 07–13 (Eigentum & Halle):** Erste Immobilien, Renovierung, Automaten, Mods und Synergien werden als städtische Gebäude und Standorte verankert.
- **Agents 16–30 (Skalierung & Erweiterung):** Mitarbeiter (Agent 16) wohnen und pendeln in der Stadt; Bars, Clubs und Gastronomie (Agents 17–21) sind reale Treffpunkte für städtische Bürger; Events und Sport (Agents 22–28) bilden öffentliche Attraktionen; und das Konzernnetzwerk (Agents 29–30) umfasst Gewerbeobjekte im gesamten Stadtgebiet.

### Phase 1: Fundament & Persönliche Spielerrolle (Agents 01–06)
Ziel ist es, den Spieler als echten Protagonisten in der Welt zu verankern – mit eigener Brieftasche, echter Arbeit, spürbaren Charakterwerten und persönlicher Kampfkarriere.

- **Agent 01 – Architektur-Audit (Status: Abgeschlossen):**
  Vollständige Bestandsaufnahme der Codebasis (Kategorien A/B/C), Dokumentation von Geldflüssen, Modulabhängigkeiten, Gameplay-Loops, kritischen Architekturproblemen und erhaltenswerten Systemen als technische Basis.
- **Agent 02 – Persönliche Casino-Spielsessions:**
  Reguläre Spielsessions an eigenen Automaten mit persönlichem VaCoin-Guthaben (`PORTEMONNAIE`). Strikte Trennung vom Geschäftskonto (`HAUSKONTO`). Test-Spins bleiben kostenlose Sandbox-Vorschau. Vollständige Journal- und Pakt-Protokollierung sowie Persistenz offener Deals.
- **Agent 03 – Persönliches Arbeitssystem:**
  Echte bezahlte Schichten auf dem Casino-Floor (Reinigen, Zapfen, Bedienen, Kasse, Kisten, Reparaturen). Arbeitsaufträge, Zeitfenster, persönliche Vergütung via Ledger (`HAUSKONTO -> PORTEMONNAIE`), Qualitätsbewertung, Fehlerrate und Arbeitsstatistik.
- **Agent 04 – Charakterprogression erweitern:**
  Sinnvolle Verknüpfung der 7 RPG-Attribute mit realen Spielmechaniken (Geschwindigkeit bei Arbeit/Bewegung, Charisma bei Dialogen/Trinkgeldern, Technik bei Reparaturen/Spielen). Spezialisierungen und Talente.
  *Stand 2026-11-10:* Speed (Schritte pro Tick), Charisma (Ansprech-Chance), Brawl (LP und Schaden) und Ausdauer (Regeneration, kuerzere Verletzung) wirken und werden im Charakterfenster beziffert. Wahrnehmung, Technik und Glueck steigen mit, haben aber noch keinen Leser im Spiel; die Anzeige weist sie als "noch ohne Wirkung" aus, statt eine Wirkung zu behaupten.
- **Agent 05 – Persönliche Kampfkarriere:**
  Wiederholbarer Kampfloop außerhalb von Gästestreitigkeiten: Herausforderbare Gegner, Hinterhofduelle, Startgebühren und Preisgelder über das Ledger, Gegnerhistorie, persönliche Kampfbilanz (Siege/Niederlagen/KOs) und Verletzungsfolgen.
  *Stand 2026-11-10:* umgesetzt in `core/sim/fight-career.ts` plus Sektion `ui/career-backyard.tsx` im Charakterfenster: sechs Gegner mit Rang und Siegchance, Startgeld und Preisgeld ueber den Ledger, Gegnerhistorie und Bilanz aus dem Archiv, Verletzungssperre. Belege: `fight-career.test.ts`, `player-dashboard.test.tsx`.
- **Agent 06 – Persönliches Spieler-Dashboard:**
  Übersichtliche Benutzeroberfläche zur persönlichen Progression: Charakterlevel, XP, Attribute, Skillpunkte, Lebenspunkte, Verletzungen, persönliches Wallet, Arbeitsstatistik, Kampfbilanz, Spielhistorie und Erfolge. Strikte Trennung von Unternehmensdaten.
  *Stand 2026-11-10:* umgesetzt in `core/sim/player-career.ts` plus Charakterfenster (`look-popup`): Level, XP-Ziel, offene Punkte, LP und Verletzung, sieben Attribute mit Wirkung, Portemonnaie und Bonus, Kampfbilanz aus dem Archiv, Job mit Schichten und sechs Erfolge - alles abgeleitet, kein zweites Modell. Belege: `player-career.test.ts`, `player-dashboard.test.tsx`.
  *Nachtrag 2026-11-10:* Spielhistorie (`player-history.ts`, Sektion `ui/career-history.tsx`: Gastduell, Hinterhof, Buden-Kauf) und Arbeitsstatistik (Tageslohn, letzte Schicht) schliessen die letzten zwei Punkte der Auftragsliste. Beleg: `player-history.test.ts`.

### Phase 2: Eigentum & Eigene Spielhalle (Agents 07–13)
Vom Aushilfsarbeiter zum echten Eigentümer: Der Erwerb der ersten Location, Renovierung und Aufbau der ersten eigenen Spielhalle.

- **Agent 07 – Erste Immobilie und Eigentumssystem:**
  Erster vollständiger Immobilienkauf (Gewerberaum, kleine Kneipe, geschlossener Spielsalon). Kaufpreisprüfung und persönliche Bezahlung aus dem Wallet (`PORTEMONNAIE`). Eigentumszuweisung und Speicherung.
  *Stand 2026-11-10:* umgesetzt in `core/sim/property.ts`: Katalog aus Gewerberaum, kleiner Kneipe und geschlossenem Spielsalon, Preispruefung gegen `PORTEMONNAIE`, Buchung mit Grund `immobilie kaufen`, Eigentums-Datensatz `player.property` mit Preis und Kauftag, Archiv-Beleg `IMMOBILIE` und Sicht `ui/career-property.tsx` im bestehenden Charakterfenster. Alte Saves laden ohne Versionssprung (`hydrateProperty`). Belege: `property.test.ts`, `property-command.test.ts`, `player-dashboard.test.tsx`.
- **Agent 08 – Eigene Immobilie und WorldState-Integration:**
  Eindeutige Zuordnung der Immobilie zum WorldState. Nutzung der bestehenden Grid-, Zonen-, Furniture- und Besuchersysteme. Betrieb über das zugehörige Geschäftskonto.
  *Stand 2026-11-10:* umgesetzt in `core/sim/property.ts`: `propertyArea`/`propertyWorld` binden den Besitz an den 30x30-Rasterbereich des Eingangs (`areaAt`) und leiten Zonen, Furniture und anwesende Besucher daraus ab; Betriebskonto ist das vorhandene `HAUSKONTO` (`PROPERTY_ACCOUNT`), Miete und Strom bleiben in `upkeep.ts`. Die Sicht `propertyView.binding` zeigt Flaeche, Zonen, Geraete, Gaeste und Kontostand im bestehenden Charakterfenster. Kein neues Save-Feld, kein Versionssprung. Belege: `property-world.test.ts`, `player-dashboard.test.tsx`.
- **Agent 09 – Renovierung und Immobilienzustand:**
  Stufenweises Renovierungssystem (Unrenoviert -> Teilrenoviert -> Betriebsbereit -> Aufgewertet). Renovierungsarbeiten, Materialbedarf aus dem Lager, Kosten, spürbare Auswirkung auf Ruf und Gästezufriedenheit, visuelles Feedback.
  *Stand 2026-11-10:* umgesetzt in `core/sim/renovation.ts`: vier Stufen, abgeleitet aus dauerhaften Journal-/Archiv-Belegen (`RENOVIERUNG`, auf drei gedeckelt, per `id` dedupliziert), Material aus `world.parts`, Buchung `HAUSKONTO -> SHOP` mit Grund `renovierung <stufe>`; Ruf und Gaestelaune lesen `renovationReputationBonus`/`renovationMoodBonus`, Renovierung repariert Furniture der eigenen Flaeche und reinigt Flecken. Sicht und Aktion im bestehenden Charakterfenster ueber `worldStore.city({ kind: 'renovate' })`; kein neues Save-Feld, keine zweite Miete. Belege: `renovation.test.ts` (10), `player-dashboard.test.tsx`.
- **Agent 10 – Erste eigene Spielhalle:**
  Vollständiger Betrieb: Automaten kaufen, transportieren, platzieren, konfigurieren, warten und reparieren. Gäste empfangen. Trennung der Geldflüsse (Gäste spielen gegen das Haus, Spieler spielt mit eigenem Wallet).
  *Stand 2026-11-10:* umgesetzt in `core/sim/machine-hall.ts`: die Halle liest die Automaten der eigenen Flaeche ueber `propertyWorld` (Agent 08) und den vorhandenen Zustand `condition`/`damaged`; Wartung ist der zweite Verb neben der Reparatur (`HAUSKONTO -> SHOP`, Grund `wartung <label>`, kein Ersatzteil, +20 Zustand), Sicht und Knopf im bestehenden Charakterfenster ueber `worldStore.city({ kind: 'maintainMachine' })`. Kauf, Transport, Platzierung, Konfiguration und Reparatur waren bereits vorhanden und bleiben unveraendert; Hausgeld/Wallet-Trennung per Test belegt. Kein neues Save-Feld. Belege: `machine-hall.test.ts` (8), `player-dashboard.test.tsx`.
- **Agent 11 – Spieler als aktiver Casino-Betreiber:**
  Aktive Floor-Rolle des Spielers bleibt erhalten (Bedienen, Reparieren, Reinigen, Kasse, Sicherheit). Koppelung von Fähigkeiten an Arbeitsqualität, Betriebsablauf und wirtschaftliches Ergebnis. Personal entlastet schrittweise, ersetzt den Spieler aber nicht vollständig.
  *Stand 2026-11-10:* umgesetzt in `core/sim/floor-work.ts`: fuenf Floor-Rollen mit Attribut, Stufe und Wirkung im bestehenden Charakterfenster (`ui/career-floor.tsx`); Wahrnehmung weitet die Reinigung (`actions.cleanTile` reinigt im Radius, bezahlt je Kachel), Technik hebt den Wartungsgewinn aus Agent 10 (+2 je Stufe, Deckel 40), Anzeige und Wirkung lesen dieselbe Formel aus `player.rpg`. Bedienen/Schlichten, Kasse, Sicherheit und Reparatur existierten bereits und bleiben unveraendert; Glueck hat weiterhin keinen Leser statt eine Wirkung zu behaupten. Kein neues Save-Feld, kein zweiter Faehigkeits- oder Wartungszaehler. Belege: `floor-work.test.ts` (7), `player-dashboard.test.tsx`, `player-career.test.ts`.
- **Agent 12 – Maschinen-Modifikationssystem:**
  Modulare Ebenen: Maschinenregeln, Modifikationen, Items und Synergien. Beeinflussung von Symbolgewichten, Auszahlungsprofilen, Wilds, Freispielen und Betriebskosten auf der tatsächlichen Spiel-Engine.
*Stand 2026-11-10:* umgesetzt in `core/games/mod-profile.ts`: die drei Mods mit echter Engine-Wirkung (CHERRY Gewichte J+3/Q+2 und +200 bps, NEAR_MISS Skarabaeus +2 und -300 bps, VELVET Buch +1 und +2 Freispiele) werden ueber `slotConfigOf` in das vorhandene `SlotProfile` uebersetzt, das `slot-session` fuer jeden Spin liest; `normalizeSlotProfile` deckelt Gewichte, Quote und Freispiele. Symbollisten, Wild/Scatter, Paytable, Freispiele, Betriebskosten und `bonusBps` existierten bereits und bleiben unveraendert; NEON, FREE_DRINK und EXTRA_REEL behalten ihre Gastwirkung ohne erfundene Profilwirkung. Sicht im bestehenden Automaten-Dialog (`ui/machine-mods.tsx`), kein neues Save-Feld, kein zweiter Zaehler. Belege: `mod-profile.test.ts` (8), `slot-config.test.ts`.
- **Agent 13 – Items und Roguelite-Synergien:**
  Datengetriebenes Item-System für Spielautomaten und Charaktere: Seltenheiten, Synergien, Vor- und Nachteile (z. B. höhere Attraktivität gegen höhere Betriebskosten), Inventar und Sammlung.
*Stand 2026-11-10:* umgesetzt in `core/sim/item-synergy.ts` (Seltenheiten je Mod, fünf Paar-Synergien mit Vorteil und Betriebskosten als Nachteil) und `core/sim/item-inventory.ts` (Inventar und Sammlung aus den verbauten `item.mods`). Gelesen wird alles über den vorhandenen `resolveModEffects`, `bonusBps` bleibt unberührt; Mod-Katalog und Resolver sind wegen `check:loc` nach `core/sim/mod-effects.ts` gezogen, `offers.ts` re-exportiert sie. Kein neues Save-Feld, kein zweiter Resolver, keine Charakter-Ausrüstung mit eigenem Inventar. Belege: `item-synergy.test.ts` (10).

### Phase 3: Skalierung & Unternehmensprogression (Agents 14–21)
Wirtschaftliches Wachstum, Diversifikation und Verschmelzung verschiedener Unterhaltungsbereiche.

- **Agent 14 – Geschäftsprogression (BUDE → KASSE → SAAL → KONZERN):**
  Sichtbare Unternehmensphasen mit echten Voraussetzungen (Kapital, Betriebsgewinn, Ruf, Geräte, Personal) und neuen spielerischen Möglichkeiten. Unabhängig vom Charakterlevel.
*Stand 2026-11-10:* Die vier Stufen existierten bereits als `core/sim/progression.ts` mit echten Kennzahlen (Tage, Betriebsgewinn, Ruf, Geräte, Kapital) und stufenweiser Gerätefreischaltung. Ergänzt ist die in der Roadmap genannte Voraussetzung Personal: Spielsaal verlangt zwei, Konzern vier Angestellte, gelesen aus `world.agents`; die Bedingung erscheint wie jede andere in `companyStatus.open` und in der Sperrmeldung von `assertUnlocked`. Kein neues Save-Feld, keine zweite Zählung, keine Änderung an Ruf, Nachfrage oder Freischaltung. Belege: `progression.test.ts` (11), `progression-city.test.ts` (5).
- **Agent 15 – Besucherbeziehungen erweitern:**
  Wiederkehrende Gäste, Stammgast-Status, persönliche Vorlieben, Besuchshistorie, Reaktionen auf Ausstattung und Events.
- **Agent 16 – Personalmanagement ausbauen:**
  Erweiterte Rollen, Qualifikationen, Gehälter über das Geschäftskonto, Zuweisung von Arbeitsbereichen und Leistungsbewertung.
- **Agent 17 – Modulare Business-Bereiche:**
  Gemeinsamer WorldState mit funktionalen Modulen: Casino, Bar, Lounge, Club, Eventbereich, Arena, Gastronomie. Ein Geschäftskonto, eine Besuchersimulation.
- **Agent 18 – Gastronomie-System:**
  Umfassendes Bar- und Gastronomiemodul: Getränkekarte, Warenbestand, Einkauf, Verbrauch, Preise, Gästeaufträge und Bewirtung.
- **Agent 19 – Club- und Nachtleben-Modul:**
  Tanzfläche, Musik/DJ, Clubmöbel, Lichtstimmung, Öffnungszeiten, Eintrittspreise, Lautstärke und Nachtgäste.
- **Agent 20 – Hybrid-Besucherströme:**
  Wechselwirkungen zwischen Bereichen: Casino-Gäste besuchen die Bar, Clubgänger nutzen Automaten, Eventbesucher konsumieren Getränke.
- **Agent 21 – Erweiterte Gebäudeplanung:**
  Mehrere Räume, Raumfunktionen, Zugänge, Kapazitätsberechnungen und Vorbereitung für mehrgeschossige Gebäude unter Beibehaltung der Grid-Architektur.

### Phase 4: Event-Infrastruktur & Arena (Agents 22–25)
Events als Publikumsmagneten: Vom kleinen Showkampf bis zur hauseigenen Arena mit Sportwetten.

- **Agent 22 – Zentrale Event-Infrastruktur:**
  Allgemeines Event-System: Event-Erstellung, Ablauf (Ankündigung, Einlass, Durchführung, Ergebnis, Archivierung) für Kämpfe, Turniere und Sonderabende.
- **Agent 23 – Kampfveranstaltungen:**
  Organisierte Turniere, Kämpfer-Roster, Kampfpläne, Eintrittspreise, Preisgelder und Zuschauereinbindung über die reale Kampf-Engine.
- **Agent 24 – Wett-System für Kampfveranstaltungen:**
  Virtuelle VaCoin-Wettmärkte (Sieger, Runden, KOs). Quotenberechnung, Quotenfixierung bei Wettabgabe, Marktschluss und automatische Abrechnung über das Ledger. Strikter Spielerschutz (keine Wetten auf eigene Kämpfe, keine Quotenänderung im Nachhinein).
- **Agent 25 – Eigene Arena:**
  Arena als Business-Modul innerhalb der Immobilie: Kampffläche/Ring, Tribünen, Eventtechnik, Einlass und Gastronomie-Anbindung.

### Phase 5: E-Sport & Wettbewerbe (Agents 26–28)
Virtuelle Wettbewerbswelten und computergestützte Turniere.

- **Agent 26 – E-Sport-Simulationsdaten:**
  Datenstrukturen für Teams, Spieler, Rollen, Attribute, Teamstärke, Form, Taktiken, Ligen und Turnierhistorien auf Basis kontrollierter PRNG-Entropie.
- **Agent 27 – E-Sport-Match-Simulation:**
  Deterministische Match-Engine für Einzelspiele und Best-of-X-Serien mit nachvollziehbaren Rundenergebnissen.
- **Agent 28 – E-Sport-Events und Wettintegration:**
  Verknüpfung der E-Sport-Matches mit der zentralen Event- und Wettinfrastruktur. Quoten, Match-Abrechnung und Ledger-Buchung.

### Phase 6: Multi-Property & Unternehmensnetzwerk (Agents 29–30)
Das Endspiel: Ein diversifiziertes Imperium aus mehreren Immobilien und zentraler Konzernsteuerung.

- **Agent 29 – Immobilienportfolio:**
  Verwaltung mehrerer Immobilien mit eigenständigen WorldStates, aber einheitlichen Simulations- und Ledger-Regeln. Standortübersicht, Kauf und Verkauf.
- **Agent 30 – Unternehmensnetzwerk:**
  Konzernzentrale zur Steuerung unterschiedlicher Konzepte (Hauptcasino, Nachtclub, Eventhalle, Sportbar). Standortvergleiche, zentrale Wirtschafts- und Personalkennzahlen.

---

### Kontinuierliche Qualitätssicherung: QA-Agent
- **Wirtschaft:** Überprüfung von doppelten Buchungen, Kontenintegrität, Zero-Sum-Bilanzen und strikter Trennung von Wallet (`PORTEMONNAIE`) und Geschäftskonto (`HAUSKONTO`).
- **Simulation:** Absicherung von PRNG-Determinismus, Replay-Stabilität, Save/Load-Roundtrips und Migrationspfaden.
- **Gameplay:** Fehlerfreie Wegfindung, Reaktionsfähigkeit von NPCs, Kollisionsfreiheit und fehlerfreie Transaktionen.
- **Regressionstests:** Automatisierte Nachweise nach jedem Feature-Schritt zur Sicherstellung stabiler Builds.

