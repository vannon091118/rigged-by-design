# Roadmap

<!-- rbd-doc: v0.3.150 | 2026-11-06 23:59 UTC -->

Drei Horizonte, keine Wunschliste. Was hier steht, ist entweder beauftragt oder
begruendet vertagt; abgeschlossene Punkte wandern ins Changelog.

## Nordstern

Eine **bespielbare Stadt** statt eines groesseren Casinos: mehrere Orte, Wege
dazwischen, Figuren mit eigenem Tagesablauf und Erinnerungen, ein Charakter mit
Laune, Ruf und Ressourcen. Das Casino bleibt darin der erste Ort und die
Testumgebung, in der jede Regel bewiesen wird, bevor sie in die Welt zieht.
Der MVP ist der Systembeweis und die Vorgabe fuer Detailtiefe, kein Content-Endstand.

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

Die aktuelle Low-End-Optik ist **noch nicht final** und deutlich von der Vision entfernt. Der Preis dafür wird von Anfang an bezahlt: Das Spiel muss auf vielen Plattformen laufen, auch auf schwachen Geräten. Die jetzige Pixel-Optik ist ein plattformfreundlicher Machbarkeitsbeweis, keine endgültige Bildsprache. Die Regeln, die schon gelten, stehen in [`ART-DIRECTION.md`](ART-DIRECTION.md).

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

- Eigener Gastmodus steht: Alle acht Geräte lassen sich als Betreiber testen oder als Gast mit `PORTEMONNAIE` spielen. Der Einsatz läuft ins Hauskonto, Gewinne zurück; ungedeckte Beträge stehen als Verbindlichkeit auf `HAUS_SCHULDEN`. Der kostenlose TESTSPIN bleibt ohne Geld- und RNG-Wirkung.
- Spatial Layout Contract (Task 1/5) steht: `WorldState.layout` trägt Dimension, Bodenmaterial je Tile, semantische Zonen und Wandkanten mit stabilen IDs; `size`/`zones` sind abgeleitet, Save v11 migriert v5–v10 deterministisch. Kein Rendering- und kein Gameplay-Unterschied.
- Phase 5/6 Werkstatt steht: sechs Rasterziele (Prüfung, Protokoll, Assets, Sound, Steuerung, FPS), versteckter Einstieg über fünf Tipps auf die Marke oder `Strg+Shift+D`, und der Charaktereditor hängt als Spiegel im Lager. Die Pruefmatrix A1-A8 steht unten in „Offene Punkte“; A1 (Desktop-Grundbild) ist bestanden. Offen bleiben die visuelle Werkstattpruefung (A2-A5), die Touch-Geste auf Hardware (A6), der Slow-4G-Test (A7) und die APK-Installation (A8).
- Phase 2 Betriebssimulation steht: Persona-Budget skaliert den Einsatz, VELVET hebt die Gästegüte, FREE_DRINK verbraucht echten Bestand, EXTRA_REEL erhöht die Walzen, CASHOUT wartet in der Warteschlange auf seinen Platz, die Ankunft folgt der angezeigten Rate und HAUS_SCHULDEN wird aus dem Überschuss über HOUSE_FLOAT getilgt.
- Firmenstufe und Floor-Fallback sind sichtbar: HUD und Betriebspanel nennen die erreichte Stufe und die offenen Bedingungen der naechsten; ein fehlgeschlagener Pixi-Start zeigt einen bedienbaren Hinweis statt einer schwarzen Flaeche.
- Der Slot-Drucklader ist auf einen Ausgleich begrenzt; die Session-Quote bleibt im angezeigten Band. Offen aus dem Audit bleiben `PLAYER_CASH` (Funktion vorhanden, aber ohne Produktions-Aufrufer), Einnahmen je Spieltyp als eigene Kennzahl und die sichtbare Browser-Abnahme der Geräteaktionen; Details unten.

- README-Onboarding führt Spielwelt und Entwicklungsstart zusammen; Mechaniken und Roadmap sind ausdrücklich als aktueller Stand beziehungsweise Vorhaben gekennzeichnet. Der Produktvertrag steht oben in diesem Dokument, das Casino darin als Start- und Testumgebung.

- Ein Prozess statt drei: `agent:context` und `agent:verify` teilen Impact, Gate-Plan und Cache; doppelte Testlaeufe sind entfernt.
- Auslieferung belastbar: der Merge startet CI und Release auch ohne eigenes Token, `integration` bleibt stehen. Der Merge-Text traegt die Pflichtsektionen: seit 0.3.140 haelt `docs/ARCHITECTURE.md` den `ERR-4006`-Fall des #163-Merges fest, Connector- und REST-Merges setzen `commit_message` mit dem PR-Body.
- Auslieferung ohne Handgriff: gruene Checks mergen automatisch, rote Staende liegen sichtbar auf `integration` und werden dort repariert.

- Inventur ist abgeschlossen: §18 deckt alle getrackten Dateien und Ordner ab; `verify:docs` haelt die Abdeckung, der Hook baut sie.
- Hooks sind in diesem Klon aktiv (`core.hooksPath=.githooks`); in neuen Klonen `pnpm run hooks:install`, Doc-Gate und Abdeckung im CI beobachten.
- Befund 33 (Bar-Kapazitaet) und Befund 34 (`Â·`-Mojibake) sind erledigt; offene Kleinbefunde stehen in `docs/INVENTORY.md` §14/§16.
- Tree- und Redundanz-Gate bei neuen Befunden ueber die Regeltabelle erweitern, nicht umgehen.
- Narrative-Grundlagen: Vertrag, Fact-Queue, Erinnerungen, Start-Pool und Save v10 stehen. Ledger-Cursor, ein einziger Fact-Boundary und referenzsichere Retention sind umgesetzt; `narrative/relationships.ts` fuehrt gerichtete Kanten und pinnt Endpunkte. NAR-04 ist erledigt: Besuch, Streit, Kassenbedienung und Rivalenabrechnung speisen die Beziehungen. NAR-05 ist erledigt: Context, alle Trigger-Operatoren und fail-closed Schema stehen. NAR-06 ist erledigt: Scheduler, Lifecycle, Cooldowns, persistente Instanzen und eigener Narrativ-RNG stehen. NAR-07 ist erledigt: stabile Templates, Choice-Vertrag, persistierte Choice-Saetze und Klick-Eligibility stehen. NAR-08 ist erledigt: Command-DSL, Allowlist, Preflight und die einmalige Ausfuehrung von Choice-Effekten stehen. NAR-09 ist erledigt: Beitraege tragen eine kontrollierte Klassifizierung, das Turn-Manifest ordnet jedem abgeschlossenen Turn genau einen Beitrag zu, und die Registry wird deterministisch im Assets-Gate geprueft. NAR-10 ist erledigt: Makros werden als typisierte ASTs validiert, Konflikte vor dem Schreiben erkannt und die Registry byte-identisch mit Inhalts-Hash erzeugt. NAR-11 ist erledigt: der Composer waehlt aus der laufzeitvalidierten Registry deterministisch Texte, filtert Locale/Kontext/Flags/Personas und liefert lokale Fallbacks. NAR-12 ist erledigt: `narrative/runtime.ts` orchestriert Fact→Trigger→Scheduler einmal pro Tick und an jeder erfolgreichen Store-Mutationsgrenze; Choices laufen ueber `store/narrative-commands.ts`, und eine aufgeloeste Choice erzeugt den naechsten Fact (`EVENT_RESOLVED`). NAR-13 ist erledigt: Neon-Nacht und Turnierabend laufen als aktive GLOBAL-Instanzen der gemeinsamen Engine, `demand.ts` leitet Wirkung und Anzeige nur noch daraus ab, und v5–v9-Saves werden beim Laden konvertiert. Profilweg und Szenen-Historie sind angebunden: Gaeste oeffnen ihr Profil direkt, das Journal zeigt abgeschlossene Geschichten mit Ausgang und Teilnehmern. Seit B3 nennt eine Szene ihre Fallback-Slots einzeln statt pauschal von Sicherheitscopy zu sprechen; `degraded` folgt `fallbacks.length > 0`. Seit B4 fuellt ein abgestimmter Content-Batch `TITLE`, `BODY` und jedes angebotene Choice-Label aller sechs Templates; `narrative-coverage.test.ts` haelt die Abdeckung fest, `OUTCOME` bleibt bewusst dem naechsten Batch vorbehalten. Seit C2 traegt `TriggerCondition` die Bedingung `rival-action` mit expliziter Aktionsliste; `EVENT_TRIGGER_DEFINITIONS` laesst nur TRADE_INFO, PRICE_MOVE, POACH_VISITOR und SABOTAGE als `RIVAL_MOVE`-Ausloeser zu, PROBE bleibt ein Indiz ohne Event. Seit C1 gilt die Spec-Regel als getesteter Vertrag: `EVENT_TRIGGER_DEFINITIONS` enthaelt nur Definitionen mit Template, jedes Fact-Template ist an genau eine Definition gebunden; in diesem Slice entstehen keine neuen Fact-Kinds, Geraete-, Lager- und Personal-Facts bleiben dokumentiert offen. Seit D1 fuehrt `VISITOR_RETURN.ASK_ABOUT_LAST_VISIT` ueber `followUpEventId` zu `VISITOR_AFTERMATH` (Scope VISITOR, Trigger `chain`); die Runtime baut die Kette aus dem drainierten `EVENT_RESOLVED`-Fact, der Scheduler haelt Cooldown, Limits, Kettenherkunft und RESOLVED zentral ein. Seit D2 traegt `RIVAL_MOVE.CONFRONT_RIVAL` die typisierte Domaenenwirkung `COUNTER_RIVAL`: Preflight verlangt einen existierenden `rival:`-Ref, `execute.ts` setzt `counteredUntilTick = max(alt, tick + 900)` als einzigen Schreibpfad; ein neuer Fact entsteht in dieser Phase bewusst nicht. Seit D3 bleibt `EXPIRED` ein reiner Statuswechsel mit `DEADLINE` ohne globale Timeout-Strafe: Fristablauf aendert weder Flags noch Beziehungen noch Ledger-Zeilen und emittiert keinen Fact; Timeout-Effekte gibt es nur als expliziten Template-Vertrag, falls sie spaeter noetig werden. Seit E2 wirkt die Disposition aus `narrative/disposition.ts` (Persona, Erinnerung, Kante) an allen drei Entscheidungspunkten: `offerScore()` (Faktor ±20 %), `chooseActivity()` (Drink-/Sofa-Schwellen ±8 Punkte) und `returnChance()` (Beziehungszuschlag ±10 Prozentpunkte zusaetzlich zu `memoryEffect()`); harte Regeln bleiben vorrangig. Seit Phase 5 liefert `narrative/rival-context.ts` Rivalen-Karten (Haltung, Kapazitaet, Wohlwollen, Gegenmassnahmen-Fenster, Historie, Indizien) rein aus den Minds ins Anzeigemodell, ohne NAR-14-17-Duplikate; `view.ts` bleibt unter 200 Zeilen, Testdateien unter 240. Seit F laeuft der Langzeitpfad ohne Campaign-State ueber den Kettenbaustein: `VISITOR_RETURN` fuehrt per ASK nach `VISITOR_AFTERMATH` und hinterlaesst Flag plus Beziehung; ein spaeterer `VISITOR_RETURNED`-Fact mit GOOD-Erinnerung matcht zusaetzlich die zweite Stufe `visitor-returned-warm` (`all` aus Fact und `visitor-memory`) mit eigenem Template - nur vorhandene Trigger-/Cooldown-Infrastruktur, keine Template-Requirements. Seit dem Warm-Batch traegt `VISITOR_RETURN_WARM` eigene Texte (Titel, Text, Choice-Label, Outcome) im neuen `warm`-Kontext, sodass die zweite Stufe nicht mehr aus dem Basistopf spricht.
- Determinismus haelt eine fail-closed ESLint-Regel: `src/**` und `scripts/**` ohne Zufall/Wanduhr, Umwege und `eslint-disable` inklusive; echter Zufall nur via `entropySeed()`. `performance.now` ist auf drei Pacing-Dateien unter `src/render/` verengt, alle anderen Render-Dateien sind voll gesperrt.
- Optik und Steuerung sind einen Schritt weiter: Lichtpfuetzen und Wandkanten trennen die Raeume, Zielraster und Laufwegspur zeigen die Folge eines Klicks, die Kamera zieht am Bildrand nach, und das HUD traegt keine leere Zeile mehr. Bildsprache steht im Bildsprache-Anhang von `docs/ARCHITECTURE.md` mit Blatt daneben; die aktuelle Pixel-Optik bleibt ausdruecklich vorlaeufig (Plattform-Machbarkeit, nicht Endzustand).

- CI-Eskalation nach dem ersten echten Lauf pruefen: Fingerprint-Zaehlung im Watcher, Stufen aus `level` im Gate-Log, und ob `promote.yml` bei Rot wie beschrieben arbeitet.
- Ruleset-Stand unverifiziert (kein authentifizierter Zugriff): vor dem naechsten Eskalations-Arbeitspaket per API bestaetigen.
- Branch-Hygiene steht: `main` und `integration` werden nach jedem Merge auf denselben Stand gesetzt; PR #142 ist geschlossen, die drei gemergten Arbeits-Refs sind geloescht; `feat/spatial-layout-editor` ist der einzige aktive Arbeitsbranch.

- Asset-Semantik: Katalog (`src/render/assets/asset-semantics.json`) und Vertrag
  (`docs/ARCHITECTURE.md`) stehen. Als Nächstes die Deko-Rollen von den
  Label-Regexen lösen und entscheiden, ob der Katalog ein Gate bekommt.

## Offene Punkte (konsolidiert 2026-11-06)

Diese Sektion ersetzt die frueheren Einzelberichte. Jeder Punkt nennt Status,
Beleg und naechsten Pruefschritt. Geraeteabnahme bleibt zurueckgestellt, bis
Spiel- und Sim-Inhalte am Desktop vollstaendig abgenommen sind.

### Desktop-Abnahme (Phase 6, A1-A5)

| ID | Pruefung | Stand | Naechster Schritt |
| --- | --- | --- | --- |
| A1 | Desktop-Grundbild: Start, HUD, Warnzeile, Toast, vier Tabs, Konsole ohne Fehler ausser Autoplay | bestanden am 2026-11-06, 1024x768 | - |
| A2 | Werkstatt-Einstieg: genau 5x Marke und `Strg+Shift+D`, kein sichtbarer Knopf, ein Rahmen | offen | beide Wege im Browser oeffnen |
| A3 | Sechs Ziele: Pruefung, Protokoll, Assets, Sound, Steuerung, FPS; vier Panels, kein Charakter-Tab | offen | Klickrunde durch alle sechs Ziele |
| A4 | Spiegel: genau ein `SPIEGEL` in der Lagerzone, Aktion oeffnet den Look-Editor, Save/Load erhaelt ihn | offen | Browser + Save-Roundtrip |
| A5 | FPS: echte `requestAnimationFrame`-Frames ueber 500 ms, keine GPU-Behauptung | offen | Panel + Gegenprobe |
| M4 | Smartphone als echte Geraeteflaeche: Rahmen, Statusleiste, Fensteruebergaenge und Floor-Feedback angleichen | offen | Browser-Vergleich der vier Fensterzustaende |

### Geraet und Release (A6-A8) - zurueckgestellt

Die Punkte bleiben offen, werden aber erst nach vollstaendiger Desktop-Abnahme
angegangen; der Nutzer testet privat auf einem echten Geraet.

| ID | Pruefung | Stand |
| --- | --- | --- |
| A6 | Touch: Ein-Finger-Pan ab 8 px, Tap-to-Frame, Aktionskarte, 60 fps beim Jackpot mit neun Gaesten | offen, braucht Hardware |
| A7 | Huelle/Performance: Safe Areas, Hochformat, First-Frame-Handshake, Haptik, Musik nach Geste, Slow 4G, Atlas-Requests | teilweise: 9 Mbit/s 20 Requests/2,51 s; Slow 4G 22 Requests/12,16 s/2,42 MB; HUD-PNGs inline; WebP-Atlas und lazy Plinko-Buehne seit 0.3.141 auf main |
| A8 | Release: Debug- und Release-APK per `adb install`, `verify:all` 12/12, Tag und Notes, aktuelle Screenshots | offen |

### Spiel und Simulation

| Punkt | Status | Beleg / naechster Schritt |
| --- | --- | --- |
| `PLAYER_CASH` ohne Ausgabepfad | offen | `cashOutPlayerCash` steht in `self-exclusion-bet.ts:82`, hat aber keinen Produktions-Aufrufer; nur `player-cash.test.ts` ruft ihn. T33 belegt die Funktion, nicht den Anschluss. |
| Einnahmen je Spieltyp | offen | Keine Kennzahl in `store`/`core`; der Ledger kennt Konten, nicht Spieltypen. |
| Sucht-Folgen | Designentscheidung | `personaStake`/`addictedStake` skalieren Einsatz und Sitzung; eine eigene negative Folge ist nicht definiert. |
| Archiv = Journal beim ersten Load | offen (niedrig) | `migrate.ts:112` setzt `saved.archive ?? world.journal`. |

### Narrative

| Punkt | Status | Beleg / naechster Schritt |
| --- | --- | --- |
| Registry 64 oder 65 | Entscheidung | 65 Beitraege, 65 Turns, 65 Fragmente, Hash `sha256:a9979c70...c46bd`; 64 ist Untergrenze, kein Inhalt wurde geloescht. |
| `TRIGGER_DIALOG` | offen | `commands/registry.ts:83` fuehrt den Befehl mit `executable: false`; die Dialog-UI fehlt. |
| Narrative Balance | offen | ±8 Punkte Aktivitaet, ±20 % Angebot und ±10 Punkte Rueckkehr sind Grenzen, keine gemessenen Werte. |
| Geraete-, Lager- und Personal-Facts | offen | Diese Bereiche haben bewusst keine Fact-Kinds; neue Fakten brauchen zuerst Definition und Template, keine stille Erweiterung der Runtime. |

### Optik, Performance und Editor

| Punkt | Status | Beleg / naechster Schritt |
| --- | --- | --- |
| Wand-Occlusion visuell | offen | `WallOcclusion` und Depth-Tests stehen; es gibt keinen Browserbeleg mit einer Figur noerdlich und suedlich derselben Wand. |
| Editor-Chunk im Produktionsbundle | bestanden (Produktionsbuild) | `rg` in `dist/assets` findet weder `layout-editor` noch `VITE_RBD_EDITOR_MODE`; die APK-Paketierung wurde nicht erneut geprueft. |
| First Frame unter 3 s | offen | WebP-Atlas und lazy Plinko-Buehne sind seit 0.3.141 auf main; Initialgraph 1.174.034 B/18 Chunks, Byte-Modell 8,1 s. Echtes Slow 4G und ein Wert unter 3 s bleiben offen. |
| Slow-4G-Browserlauf | offen | Baseline 22 Requests/12,16 s/2,42 MB; WebP/Lazy sind in PR #161, ein neuer Browserlauf fehlt. |

### Technik, Doku und Release

- **Dependency-Audit:** Android-Gradle-Nachweis nur in CI; Installationsgroessen-Vergleich und Installationsdauer offen; CVE-Untergrenzen vor dem naechsten Upgrade gegen `pnpm audit` pruefen; Vite-Warnung zum extensionlosen Import offen.
- **Asset-Lizenz:** Der Nutzer hat die Lizenz bestaetigt; der Nachweis im Repo fehlt weiterhin.
- **Branch-Hygiene:** `main` und `integration` folgen dem jeweils gemergten Stand; PR #142 ist geschlossen, die drei gemergten Arbeits-Refs sind geloescht. `feat/spatial-layout-editor` ist der einzige aktive Arbeitsbranch; ein Branch mit nicht integrierter Arbeit wird nicht geloescht.
- **Ruleset/CI-Eskalation:** Ruleset-Stand ohne authentifizierten Zugriff unverifiziert; Watcher-Fingerprint und `promote.yml` nach dem naechsten echten Lauf pruefen.
- **Asset-Semantik:** Deko-Rollen von den Label-Regexen loesen und entscheiden, ob der Katalog ein Gate bekommt.
- **Offene Kleinbefunde aus der Inventur (§14):** ERR-4016-Zuordnung klaeren; Windows-Pfad in `opencode.json` entfernen; Audit-Drift nachziehen; Duplikatpruefung in `verify-assets` entscheiden; Slot-Symbol-Fallback-Keys mit dem Manifest decken; Asset-Bibliothek-Zaehler dynamisch halten; Tick-Dauer als eine Konstante fuehren; Shell-Text-Typo korrigieren; Windows-Fallback in `encode-audio` dokumentiert lassen.

### Bewusst nicht in diesem Schritt

- Keine visuelle Browser- oder APK-Abnahme; der Nutzer testet auf seinem privaten Geraet.
- Keine Spiel-, Simulations-, Ledger-, RNG- oder Save-Aenderung.
- Keine Doku-Duplikate neben den sechs Pflichtdokumenten; jede Referenzdatei wird nach Ueberfuehrung geloescht.

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
