# Roadmap

<!-- rbd-doc: v0.3.196 | 2026-11-09 17:15 UTC -->

Drei Horizonte, keine Wunschliste. Was hier steht, ist entweder beauftragt oder
begruendet vertagt; abgeschlossene Punkte wandern ins Changelog.

## Nordstern

Eine **bespielbare Stadt** statt eines groesseren Casinos: mehrere Orte, Wege
dazwischen, Figuren mit eigenem Tagesablauf und Erinnerungen, ein Charakter mit
Laune, Ruf und Ressourcen. Das Casino bleibt darin der erste Ort und die
Testumgebung, in der jede Regel bewiesen wird, bevor sie in die Welt zieht.
Der MVP ist der Systembeweis und die Vorgabe fuer Detailtiefe, kein Content-Endstand.

## Governance-Freeze (aktiv)

Die Steuerungsebene ist gesperrt, bis **Stadt und Core-Loop stehen und mindestens § Progression-Zweige vollständig sind**. Gesperrt sind `.github/`, `.githooks/`, `.lane-claims/`, `scripts/` und die Governance-Verträge; frei bleiben `src/`, `content/`, `public/` und Tests.

Durchgesetzt wird die Sperre mechanisch: der lokale Pre-Commit-Hook und der `Plan`-Job in CI blockieren jede inhaltliche Governance-Änderung ohne PIN-Freigabe (`ERR-4030`). Eine Freigabe entsteht nur über `node scripts/freeze-unlock.mjs --pin=<pin>` und gilt genau für eine Basis. Fehlt sie ganz, entfernt die CI den Lane-Branch mit `Verdacht auf unautorisierte Korruption`.

Aufhebung nur auf ausdrückliche Anweisung des Owners; danach gilt der Freeze weiter. Der Fokus bis dahin: Stadt, Core-Loop, Progression, Content und Baustein-Pools — keine Governance-Arbeit.

## Produktvertrag

> Bei der Doku-Konsolidierung aus `docs/PRODUCT.md` uebernommen; die Quelldatei wurde geloescht. Die Aussagen gelten zum Stand dieses Commits.

**Ein Satz:** Rigged by Design ist eine Lebenssimulation: Du startest mit einem Startguthaben, keinem Plan und einer Welt voller Möglichkeiten – und das Casino ist nur der erste Raum, in dem du lernst, wie dieses Leben rechnet.

Kein Echtgeld. VaCoins sind fiktive, ganzzahlige Mikro-Einheiten (1 VC = 10.000). Es gibt keine Einzahlung und keinen Gewinn, der irgendwo ankommt.

### Der Titel ist das Programm

„Rigged by Design“ ist ein Wortspiel, und es beschreibt zuerst das Leben, nicht das Haus. Man sucht sich nicht aus, in welche Verhältnisse man geboren wird: Eltern, Stadt, Startkapital, Laune, Marken, Vorgesetzte. Andere haben mit ihrem Leben vor dir schon angefangen, und ihre Entscheidungen sind die Bedingungen, unter denen deine stattfinden. Das Spiel ist manipuliert, weil das Leben manipuliert ist – und weil ein Casino das ehrlichste Beispiel dafür ist, wie aus einem gezinkten System ein Geschäftsmodell wird.

Du erbst deshalb kein Vermögen. Du erbst einen Startpunkt: **150 VC Startkapital**, einen Schlüssel, einen Automaten und keinen Plan. Was daraus wird, entscheidet nicht eine Klasse oder ein Genre, sondern was du mit Laune, Geld, Leuten und Zeit machst.

### Casino ist der Startpunkt, nicht das Genre

Das Casino ist die **erste Umgebung und die Testumgebung**. Es ist der Ort, an dem die Systeme beweisen, dass sie tragen:

- Gäste mit Budget, Laune, Geduld, Persona und Erinnerung,
- ein Ledger, das jede Folge bucht, statt sie zu behaupten,
- eine Narrative Engine, die aus echten Zustandsübergängen Geschichten ableitet,
- eine Oberfläche, die Ursache und Wirkung zeigt, statt Zahlen zu dekorieren.

Es ist **nicht** das Endziel und nicht die Kategorie des Spiels. „Sims“ kommt der Sache näher als „Casino-Manager“, trifft sie aber auch nicht: Es geht nicht um ein Haus, das man verwaltet, sondern um ein Leben, das man führt, und um eine Welt, die schon vorher Regeln hatte.

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
nicht nur dokumentiert:

| Regel | Grenze | Durchsetzung |
| --- | --- | --- |
| Mindestgroesse je Pool (Slot) | 50 Fragmente | `verify:narrative-blocks` und Assets-Gate |
| Gesamtziel | 1500 Bausteine | Fortschritt im Gate-Bericht; Ueberschreiten ist ein Befund |
| Pflicht pro Commit | mindestens ein neuer, verdrahteter Baustein; Ausnahme nur fuer reine Doku-/Inventur-/Tooling-Commits | Pre-Commit-Hook (`--commit`) |
| Luecken-Regel | offene Pools zuerst; bei vollem Minimum darf jeder Pool wachsen | `gapIssues` im Gate |
| Schrumpf-Verbot | kein Pool darf kleiner werden, kein Beitrag geloescht | `shrinkIssues` im Gate |
| Einmaligkeit | kein doppelter Text (normalisiert) | `poolReport` im Gate |

Stand 2026-11-09: **703/1500** Bausteine in 13 Pools. Die Pools tragen 50 bis 59
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
| P-5 | Sucht-Folgen sind eine Designentscheidung | offen | `personaStake`/`addictedStake` skalieren nur Einsatz und Sitzung |
| P-6 | Archiv wird beim ersten Load aus dem Journal gefuellt | offen (niedrig) | `store/migrate.ts` setzt `saved.archive ?? world.journal` |
| P-7 | Ruf → Slot-Nutzung | **erledigt 2026-11-08** | `guest-play.ts` `stakeConfidence` (0,8..1,2, Deckel und Chipbestand bleiben hart); Test `reputation-slot-use.test.ts` |
| P-8 | Ruf → Gastsprache | **erledigt 2026-11-08** | `narrative/guest-voice.ts` waehlt deterministisch aus drei Ruf-Pools; Test `guest-voice.test.ts` |
| P-9 | Layout → Gaeste-Routen | **verifiziert, keine Luecke** | `world.ts` `worldNav` → `navGrid(size, furniture, world.layout)` (Wandkanten), `pathTo` → `findPath(guestNav(world))`; Layout-Aenderung aendert Pfade, `gridCache` erkennt sie an der Layout-Identitaet |
| P-10 | Ledger → Narrative | **verifiziert, keine Luecke** | `narrative/ledger-facts.ts` verarbeitet Buchungen ab `ledgerSeq` und emittiert nur Bandwechsel `HOUSE_BALANCE` |
| P-11 | SlotMemory → Ledger → Narrative | **erledigt 2026-11-09 (#296)** | `src/core/sim/narrative/__tests__/slot-discharge-fact.test.ts` belegt die Entladung als Fact; Implementierung in `src/core/sim/narrative/facts.ts`; Merge `2cd663a` |
| P-12 | Beziehungen → Ruf | **verifiziert 2026-11-08 (#271)** | `relationshipStanding()` in `src/core/sim/narrative/relationships.ts` addiert in `src/core/sim/spawn.ts` einen deterministischen, auf ±6 Punkte begrenzten Anteil an `reputation()`; Test `src/core/sim/__tests__/reputation.test.ts` |

#### B. Narrative und Content

| ID | Punkt | Status | Beleg / naechster Schritt |
| --- | --- | --- | --- |
| P-13 | 703/1500 Textbausteine | offen (Ziel) | 13 Pools, alle mindestens 50; neuer Kontext `echo` fuer spaetere Kettenbegegnungen |
| P-14 | Neue Pools brauchen einen Leser, das Gate prueft das nicht | offen | `guest-voice-*` hat `guest-voice.ts`; kuenftige Pools ebenso, sonst ist der Text tot |
| P-15 | `TRIGGER_DIALOG` ist nicht ausfuehrbar | offen | `commands/registry.ts` fuehrt `executable: false`; Dialog-UI fehlt |
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
| P-20 | Generierte Dependency-Matrix liegt in der gesperrten `docs/ARCHITECTURE.md` | offen | `scripts/sync-dependency-matrix.mjs` zaehlt Testdateien; jede neue Testdatei verschiebt die Zahlen und braucht damit eine PIN-Freigabe. Matrix in eine freie Datei ziehen oder den Generator aus dem Freeze nehmen |
| A6-A8 | Touch auf Hardware, Huelle, APK-Installation | zurueckgestellt | erst nach vollstaendiger Desktop-Abnahme |
| P-21 | Einfluss-Matrix als anpassbare Config | **verifiziert 2026-11-08** | `influence-config.ts` gewichtet `mood`, `sociability`, `thirst`, `rumor` sowie `trust`, `sympathy` und `conflict` je Kontext, wendet Cross-Kanten an (unter anderem Vertrauen/Konflikt auf Geselligkeit) und validiert fail-closed; Consumer `guest-choice.ts` (Bar-Nachfrage mit Beziehungskante); Test `influence.test.ts` |
| P-22 | Main Event Pool mit nicht unterscheidbaren, nicht repetitiven Events | **verifiziert 2026-11-08** | `main-event-pool.ts` zieht nur bei idle, gewichtet ueber die gerichteten trust/sympathy/conflict-Kanten und Cross-Kanten, daempft Wiederholung per Recency und Lockout und nutzt dieselbe Event-Karte ohne Sonder-UI/-Log; drei feste `AMBIENT_*`-Templates, Config in `influence-event-pool.ts`, Tests `main-event-pool.test.ts` |
| P-23 | NPC-Wissen und Geruechte mit Distanz- und Quellenverlust | **verifiziert 2026-11-08** | `knowledge.ts` erzwingt Provenance (unmittelbare und urspruengliche Quelle, Art, Distanz, Beobachtungs-Tick), `knowledge-observation.ts` verlangt fuer Sicht/Geraeusch echte Anwesenheit, `knowledge-query.ts` altert und bewahrt Widersprueche, `knowledge-share.ts` macht die Weitergabe vom zentralen Matrix-Kontext `share` in `influence-config.ts` abhaengig, `knowledge-gossip.ts` rangiert Quellen ueber die balancebaren `gossip`-Gewichte der Knowledge-Config, und empfangenes Wissen schreibt begrenzt auf die Kante zur Quelle und zum Subjekt zurueck; Tests `knowledge.test.ts`, `knowledge-domain.test.ts`, `knowledge-relationships.test.ts` und `knowledge-config.test.ts` |
| P-24 | Verkettete Narrative mit Verzweigungen, Ruhephasen und Zusammenfuehrung | **verifiziert 2026-11-08** | `src/core/sim/narrative/chains/chain-runtime.ts` startet nur aus aufgeloesten Events, waehlt deterministisch einen bedingten Uebergang und prueft ruhende Uebergaenge bei Faelligkeit erneut; `chain-schema.ts` lehnt tote Enden, unerreichbare Knoten und Zyklen ohne Wiederaufnahme ab; `chain-persist.ts` sichert Laeufe; `NARRATIVE_CHAINS` traegt Warm- und Konfliktkette; Tests `narrative-chain-runtime.test.ts` und `narrative-chain-schema.test.ts` |

#### D. Governance, CI und Abnahme der Lieferung

| Punkt | Status | Beleg / naechster Schritt |
| --- | --- | --- |
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

## Als Nächstes — Lebenssysteme aus dem Casino loesen

- Task 4/5 ist erledigt: Möbel, Figuren, Requisiten und Wandvorderseiten teilen eine Tiefenebene mit Fußanker, deterministischem Tie-Breaking und gezielter Sortierung. Task 5/5 ist mit Phase 2 abgeschlossen: Commands, 30-Schritt-Undo/Redo, Editor-UI, Pixi-Auswahl, Ctrl+Z/Ctrl+Y, Export/Import und der Produktionsausschluss stehen; der Editor bleibt hinter `VITE_RBD_EDITOR_MODE=1` plus `?editor=1`.
- **Charakterwerte verallgemeinern:** Laune, Charisma, Intellekt und Ausgabebereitschaft als Achsen der Spielfigur fuehren, nicht als Casino-Sonderfall. TV, Werbung und Marken wirken auf dieselben Werte wie Gäste-Laune und Persona.
- **Ledger-Ressourcen:** Zeit, Ruf, Vorräte und Aufmerksamkeit als gebuchte Ressourcen nach Bedarf ergaenzen; eine Ressource, eine Zeile, eine Ursache. Geld bleibt die erste, nicht die einzige Wahrheit.
- **Social-Plugin der Narrative Engine:** Facts, Erinnerungen und gerichtete Beziehungen ausserhalb von Gast/Haus tragen lassen (Nachbarn, Kollegen, Freunde); neue Facts und Templates, keine zweite Erzaehlmaschine.
- **Erste weitere Orte:** Kneipe, Tante-Emma-Laden und Wohnung als Vertical Slices auf demselben Kern. Jeder Ort liefert Inhalte und eine duenne Anbindung, keine eigene Engine.
- **Schaufenster und Preise als Eigenschaften:** Marken, Traits (z. B. „Konsument“) und Preisniveau wirken auf Charisma und Laune, statt nur Dekoration zu sein.
- **Stadtgrundlage:** Wege zwischen Orten, Tagesablaeufe von NPCs und ein Charakter, der sich zwischen ihnen bewegt; zuerst als Datenmodell und Anzeige, dann als Spielschleife.

- Lichtpfuetze ueber Regionskanten zusammensetzen, damit grosse Saele keine Chunk-Naht im Licht zeigen; heute zeichnet jeder Chunk seine eigene Pfuetze.
- Touch ist umgebaut (Ein-Finger-Pan ab 8 px, Tippen laeuft, Aktionskarte statt Radialmenue, Sofort-Feedback), aber nur im Code belegt: 60 fps beim Jackpot mit neun Gaesten und Tap-zu-Bild in einem Frame brauchen die Abnahme auf einem echten Geraet.
- Geld fuehlt sich an (Phase 3): acht Ereignisse mit Partikeln, Ton, Licht und Shake, Kassen-Chips, Laune-Sprechblase und Spiel-Identitaeten sind im Code und am 2026-11-06 im Desktop-Browser abgenommen. Jackpot-Burst/Flash/Shake und Win-Sound, sichtbare Kassen-Chips mit Coin-Sound, die Mood-Bubble im Detail-LOD und alle acht Spiel-Identitaeten sind belegt; Lautsprecher-/Gehoer-Pruefung, 60 fps und der Emitter-Zaehler im Werkstatt-HUD bleiben fuer das echte Geraet offen.
- Huelle (Phase 4): zwei Atlasseiten, `PerfGovernor`, Safe Areas, Hochformat, First-Frame-Handshake, Haptik und Musik-nach-Geste sind gebaut. Der 4G-Pfad misst 20 Requests / 2,51 s (9 Mbit/s, 70 ms); Slow 4G (1,6 Mbit/s, 150 ms) ist mit 22 Requests / 12,16 s bei 2,42 MB gemessen. Die HUD-PNGs sind inline; der WebP-Atlas und die lazy Plinko-Buehne sind seit 0.3.141 auf main, der erste Frame bleibt bandwidth-bound; fuer unter drei Sekunden muss das Initial-JS/Atlas weiter schrumpfen. APK liegt als Debug-Artefakt vor. Naechste Abnahme: echtes 200-Euro-Geraet und `adb install`.

- Import/Export um benannte Spielstaende erweitern (mehrere Slots statt einer Zwischenablage).
- Dialogfuehrung bekommt einen Content-Slot fuer Autorentexte; bis dahin bleibt die Sicherheitsfassung, und der Dialog haelt bewusst keinen Zustand ueber Speichern/Laden.
- Narrativ-Engine: NAR-04 bis NAR-17 sind erledigt (Beziehungen, Trigger, Scheduler, Templates, Choice-Vertrag, Command-DSL, Content-Schema, Compiler, Composer, Orchestrierung, Demand-Migration, Narrative UI, autonome Rivalen, Langzeit, Doku-Sync). Compiler und Composer bleiben lokal ohne LLM; laufende Nachfrageevents aus v5–v9-Saves werden beim Laden zu Event-Instanzen. Seit B1 liefert `narrative/composition-context.ts` den Szenen-Kontext aus Fact, Template, Teilnehmern, Erinnerung und gerichteter Kante; `requiredFlags` bleibt auf Template-Requirements begrenzt. B2 ist erledigt: `ContentSlot.requiredContexts` traegt den Slot-Zweck, `ComposeRequest.requiredContexts` gilt zusaetzlich fuer alle Slots, `contexts` bewertet nur Treffer, und der Gleichstand entscheidet per FNV-1a-Hash aus Szenen-ID und Slot-ID ohne RNG; das Vokabular kennt `welcome`, `ask`, `defuse`, `escalate`, `confront`, `watch` und `aftermath`. Naechster Schritt ist der erste Content-Batch nach D1 und danach das Social-Plugin.
- Asset-Lizenz als Nachweis im Repo verlinken (Lizenz liegt beim Betreiber).

## Später — Stadt und Release

- **Bespielbare Stadt vor dem Release:** mehrere Orte, begehbare Wege, Figuren mit Tagesablauf, Erinnerung und eigenem Geld; ein Charakter mit Laune, Ruf und Ressourcen. Das ist der Release-Horizont, nicht ein groesserer Saal.
- Rivalen-Profilkarte mit Historie und Indizien; ortsuebergreifende Aktionen statt nur casino-uebergreifender.
- Sieben-Tage-Langlauf mit Narrativ-Ereignissen als eigener CI-Nachweis.
- Uebersetzung der UI-Texte, falls eine zweite Sprache dazukommt.
