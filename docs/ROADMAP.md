# Roadmap

<!-- rbd-doc: v0.3.120 | 2026-11-05 05:51 UTC -->

Drei Horizonte, keine Wunschliste. Was hier steht, ist entweder beauftragt oder
begruendet vertagt; abgeschlossene Punkte wandern ins Changelog.

## Nordstern

Eine **bespielbare Stadt** statt eines groesseren Casinos: mehrere Orte, Wege
dazwischen, Figuren mit eigenem Tagesablauf und Erinnerungen, ein Charakter mit
Laune, Ruf und Ressourcen. Das Casino bleibt darin der erste Ort und die
Testumgebung, in der jede Regel bewiesen wird, bevor sie in die Welt zieht.
Der MVP ist der Systembeweis und die Vorgabe fuer Detailtiefe, kein Content-Endstand.

## Jetzt — die Testumgebung tragfaehig machen

- VELVET und FREE_DRINK muessen ihre Beschreibung einloesen (bessere Gaeste, Drink pro Spin) oder umformuliert werden; EXTRA_REEL sollte wirklich eine Walze sein.
- Der Einsatz sollte mit dem Persona-Budget skalieren, damit High Roller nicht nur laenger, sondern hoeher spielt.

- Offen aus dem Audit: Pity-Entladungen heben den RTP des Startautomaten auf 99,15 %, Schulden haben keinen Tilgungspfad, `PLAYER_CASH` keinen Ausgabepfad, die Sucht steuert nichts und der Einsatz skaliert nie mit der Persona.

- README-Onboarding führt Spielwelt und Entwicklungsstart zusammen; Mechaniken und Roadmap sind ausdrücklich als aktueller Stand beziehungsweise Vorhaben gekennzeichnet. Die Vision steht in `docs/PRODUCT.md`, das Casino darin als Start- und Testumgebung.

- Ein Prozess statt drei: `agent:context` und `agent:verify` teilen Impact, Gate-Plan und Cache; doppelte Testlaeufe sind entfernt.
- Auslieferung belastbar: der Merge startet CI und Release auch ohne eigenes Token, `integration` bleibt stehen.
- Auslieferung ohne Handgriff: gruene Checks mergen automatisch, rote Staende liegen sichtbar auf `integration` und werden dort repariert.

- Inventur ist abgeschlossen: §18 deckt alle getrackten Dateien und Ordner ab; `verify:docs` haelt die Abdeckung, der Hook baut sie.
- Hooks sind in diesem Klon aktiv (`core.hooksPath=.githooks`); in neuen Klonen `pnpm run hooks:install`, Doc-Gate und Abdeckung im CI beobachten.
- Befund 33 (Bar-Kapazitaet in drei UI-Dateien) und Befund 34 (`Â·`-Mojibake) nach Freigabe reparieren.
- Tree- und Redundanz-Gate bei neuen Befunden ueber die Regeltabelle erweitern, nicht umgehen.
- Narrative-Grundlagen: Vertrag, Fact-Queue, Erinnerungen, Start-Pool und Save v10 stehen. Ledger-Cursor, ein einziger Fact-Boundary und referenzsichere Retention sind umgesetzt; `narrative/relationships.ts` fuehrt gerichtete Kanten und pinnt Endpunkte. NAR-04 ist erledigt: Besuch, Streit, Kassenbedienung und Rivalenabrechnung speisen die Beziehungen. NAR-05 ist erledigt: Context, alle Trigger-Operatoren und fail-closed Schema stehen. NAR-06 ist erledigt: Scheduler, Lifecycle, Cooldowns, persistente Instanzen und eigener Narrativ-RNG stehen. NAR-07 ist erledigt: stabile Templates, Choice-Vertrag, persistierte Choice-Saetze und Klick-Eligibility stehen. NAR-08 ist erledigt: Command-DSL, Allowlist, Preflight und die einmalige Ausfuehrung von Choice-Effekten stehen. NAR-09 ist erledigt: Beitraege tragen eine kontrollierte Klassifizierung, das Turn-Manifest ordnet jedem abgeschlossenen Turn genau einen Beitrag zu, und die Registry wird deterministisch im Assets-Gate geprueft. NAR-10 ist erledigt: Makros werden als typisierte ASTs validiert, Konflikte vor dem Schreiben erkannt und die Registry byte-identisch mit Inhalts-Hash erzeugt. NAR-11 ist erledigt: der Composer waehlt aus der laufzeitvalidierten Registry deterministisch Texte, filtert Locale/Kontext/Flags/Personas und liefert lokale Fallbacks. NAR-12 ist erledigt: `narrative/runtime.ts` orchestriert Fact→Trigger→Scheduler einmal pro Tick und an jeder erfolgreichen Store-Mutationsgrenze; Choices laufen ueber `store/narrative-commands.ts`, und eine aufgeloeste Choice erzeugt den naechsten Fact (`EVENT_RESOLVED`). NAR-13 ist erledigt: Neon-Nacht und Turnierabend laufen als aktive GLOBAL-Instanzen der gemeinsamen Engine, `demand.ts` leitet Wirkung und Anzeige nur noch daraus ab, und v5–v9-Saves werden beim Laden konvertiert. Profilweg und Szenen-Historie sind angebunden: Gaeste oeffnen ihr Profil direkt, das Journal zeigt abgeschlossene Geschichten mit Ausgang und Teilnehmern. Seit B3 nennt eine Szene ihre Fallback-Slots einzeln statt pauschal von Sicherheitscopy zu sprechen; `degraded` folgt `fallbacks.length > 0`. Seit B4 fuellt ein abgestimmter Content-Batch `TITLE`, `BODY` und jedes angebotene Choice-Label aller sechs Templates; `narrative-coverage.test.ts` haelt die Abdeckung fest, `OUTCOME` bleibt bewusst dem naechsten Batch vorbehalten. Seit C2 traegt `TriggerCondition` die Bedingung `rival-action` mit expliziter Aktionsliste; `EVENT_TRIGGER_DEFINITIONS` laesst nur TRADE_INFO, PRICE_MOVE, POACH_VISITOR und SABOTAGE als `RIVAL_MOVE`-Ausloeser zu, PROBE bleibt ein Indiz ohne Event. Seit C1 gilt die Spec-Regel als getesteter Vertrag: `EVENT_TRIGGER_DEFINITIONS` enthaelt nur Definitionen mit Template, jedes Fact-Template ist an genau eine Definition gebunden; in diesem Slice entstehen keine neuen Fact-Kinds, Geraete-, Lager- und Personal-Facts bleiben dokumentiert offen. Seit D1 fuehrt `VISITOR_RETURN.ASK_ABOUT_LAST_VISIT` ueber `followUpEventId` zu `VISITOR_AFTERMATH` (Scope VISITOR, Trigger `chain`); die Runtime baut die Kette aus dem drainierten `EVENT_RESOLVED`-Fact, der Scheduler haelt Cooldown, Limits, Kettenherkunft und RESOLVED zentral ein. Seit D2 traegt `RIVAL_MOVE.CONFRONT_RIVAL` die typisierte Domaenenwirkung `COUNTER_RIVAL`: Preflight verlangt einen existierenden `rival:`-Ref, `execute.ts` setzt `counteredUntilTick = max(alt, tick + 900)` als einzigen Schreibpfad; ein neuer Fact entsteht in dieser Phase bewusst nicht. Seit D3 bleibt `EXPIRED` ein reiner Statuswechsel mit `DEADLINE` ohne globale Timeout-Strafe: Fristablauf aendert weder Flags noch Beziehungen noch Ledger-Zeilen und emittiert keinen Fact; Timeout-Effekte gibt es nur als expliziten Template-Vertrag, falls sie spaeter noetig werden. Seit E2 wirkt die Disposition aus `narrative/disposition.ts` (Persona, Erinnerung, Kante) an allen drei Entscheidungspunkten: `offerScore()` (Faktor ±20 %), `chooseActivity()` (Drink-/Sofa-Schwellen ±8 Punkte) und `returnChance()` (Beziehungszuschlag ±10 Prozentpunkte zusaetzlich zu `memoryEffect()`); harte Regeln bleiben vorrangig. Seit Phase 5 liefert `narrative/rival-context.ts` Rivalen-Karten (Haltung, Kapazitaet, Wohlwollen, Gegenmassnahmen-Fenster, Historie, Indizien) rein aus den Minds ins Anzeigemodell, ohne NAR-14-17-Duplikate; `view.ts` bleibt unter 200 Zeilen, Testdateien unter 240. Seit F laeuft der Langzeitpfad ohne Campaign-State ueber den Kettenbaustein: `VISITOR_RETURN` fuehrt per ASK nach `VISITOR_AFTERMATH` und hinterlaesst Flag plus Beziehung; ein spaeterer `VISITOR_RETURNED`-Fact mit GOOD-Erinnerung matcht zusaetzlich die zweite Stufe `visitor-returned-warm` (`all` aus Fact und `visitor-memory`) mit eigenem Template - nur vorhandene Trigger-/Cooldown-Infrastruktur, keine Template-Requirements. Seit dem Warm-Batch traegt `VISITOR_RETURN_WARM` eigene Texte (Titel, Text, Choice-Label, Outcome) im neuen `warm`-Kontext, sodass die zweite Stufe nicht mehr aus dem Basistopf spricht.
- Determinismus haelt eine fail-closed ESLint-Regel: `src/**` und `scripts/**` ohne Zufall/Wanduhr, Umwege und `eslint-disable` inklusive; echter Zufall nur via `entropySeed()`. `performance.now` ist auf drei Pacing-Dateien unter `src/render/` verengt, alle anderen Render-Dateien sind voll gesperrt.
- Optik und Steuerung sind einen Schritt weiter: Lichtpfuetzen und Wandkanten trennen die Raeume, Zielraster und Laufwegspur zeigen die Folge eines Klicks, die Kamera zieht am Bildrand nach, und das HUD traegt keine leere Zeile mehr. Bildsprache steht als `docs/ART-DIRECTION.md` mit Blatt daneben; die aktuelle Pixel-Optik bleibt ausdruecklich vorlaeufig (Plattform-Machbarkeit, nicht Endzustand).

- CI-Eskalation nach dem ersten echten Lauf pruefen: Fingerprint-Zaehlung im Watcher, Stufen aus `level` im Gate-Log, und ob `promote.yml` bei Rot wie beschrieben arbeitet.
- Ruleset-Stand unverifiziert (kein authentifizierter Zugriff): vor dem naechsten Eskalations-Arbeitspaket per API bestaetigen.
- Branch-Konsolidierung am 2026-11-05 abgeschlossen: `fix/bundle-splitting` und `fix/test-suite-optimization` nach `main` gemergt, die uebrigen offenen Branches waren patch-identisch; alle Branch-Refs lokal und auf GitHub geloescht.

## Als Nächstes — Lebenssysteme aus dem Casino loesen

- **Charakterwerte verallgemeinern:** Laune, Charisma, Intellekt und Ausgabebereitschaft als Achsen der Spielfigur fuehren, nicht als Casino-Sonderfall. TV, Werbung und Marken wirken auf dieselben Werte wie Gäste-Laune und Persona.
- **Ledger-Ressourcen:** Zeit, Ruf, Vorräte und Aufmerksamkeit als gebuchte Ressourcen nach Bedarf ergaenzen; eine Ressource, eine Zeile, eine Ursache. Geld bleibt die erste, nicht die einzige Wahrheit.
- **Social-Plugin der Narrative Engine:** Facts, Erinnerungen und gerichtete Beziehungen ausserhalb von Gast/Haus tragen lassen (Nachbarn, Kollegen, Freunde); neue Facts und Templates, keine zweite Erzaehlmaschine.
- **Erste weitere Orte:** Kneipe, Tante-Emma-Laden und Wohnung als Vertical Slices auf demselben Kern. Jeder Ort liefert Inhalte und eine duenne Anbindung, keine eigene Engine.
- **Schaufenster und Preise als Eigenschaften:** Marken, Traits (z. B. „Konsument“) und Preisniveau wirken auf Charisma und Laune, statt nur Dekoration zu sein.
- **Stadtgrundlage:** Wege zwischen Orten, Tagesablaeufe von NPCs und ein Charakter, der sich zwischen ihnen bewegt; zuerst als Datenmodell und Anzeige, dann als Spielschleife.

- Lichtpfuetze ueber Regionskanten zusammensetzen, damit grosse Saele keine Chunk-Naht im Licht zeigen; heute zeichnet jeder Chunk seine eigene Pfuetze.
- Touch ist umgebaut (Ein-Finger-Pan ab 8 px, Tippen laeuft, Aktionskarte statt Radialmenue, Sofort-Feedback), aber nur im Code belegt: 60 fps beim Jackpot mit neun Gaesten und Tap-zu-Bild in einem Frame brauchen die Abnahme auf einem echten Geraet.
- Geld fuehlt sich an (Phase 3): acht Ereignisse mit Partikeln, Ton, Licht und Shake, Kassen-Chips, Laune-Sprechblase und Spiel-Identitaeten sind im Code. Die sichtbare und hoerbare Abnahme (Jackpot, Klingeln, 6-px-Shake, LED-Puls, aktiver Emitter im Werkstatt-HUD) braucht Browser und Geraet.
- Huelle (Phase 4): zwei Atlasseiten, `PerfGovernor`, Safe Areas, Hochformat, First-Frame-Handshake, Haptik und Musik-nach-Geste sind gebaut. Der 4G-Pfad misst 20 Requests / 2,51 s (9 Mbit/s, 70 ms); APK liegt als Debug-Artefakt vor. Naechste Abnahme: Slow 4G (1,6 Mbit/s), echtes 200-Euro-Geraet und `adb install`.

- Import/Export um benannte Spielstaende erweitern (mehrere Slots statt einer Zwischenablage).
- Dialogfuehrung bekommt einen Content-Slot fuer Autorentexte; bis dahin bleibt die Sicherheitsfassung, und der Dialog haelt bewusst keinen Zustand ueber Speichern/Laden.
- Narrativ-Engine nach `docs/EVENT-NARRATIVE-ENGINE-TASKPLAN.md`: NAR-04 bis NAR-17 sind erledigt (Beziehungen, Trigger, Scheduler, Templates, Choice-Vertrag, Command-DSL, Content-Schema, Compiler, Composer, Orchestrierung, Demand-Migration, Narrative UI, autonome Rivalen, Langzeit, Doku-Sync). Compiler und Composer bleiben lokal ohne LLM; laufende Nachfrageevents aus v5–v9-Saves werden beim Laden zu Event-Instanzen. Seit B1 liefert `narrative/composition-context.ts` den Szenen-Kontext aus Fact, Template, Teilnehmern, Erinnerung und gerichteter Kante; `requiredFlags` bleibt auf Template-Requirements begrenzt. B2 ist erledigt: `ContentSlot.requiredContexts` traegt den Slot-Zweck, `ComposeRequest.requiredContexts` gilt zusaetzlich fuer alle Slots, `contexts` bewertet nur Treffer, und der Gleichstand entscheidet per FNV-1a-Hash aus Szenen-ID und Slot-ID ohne RNG; das Vokabular kennt `welcome`, `ask`, `defuse`, `escalate`, `confront`, `watch` und `aftermath`. Naechster Schritt ist der erste Content-Batch nach D1 und danach das Social-Plugin.
- Asset-Lizenz als Nachweis im Repo verlinken (Lizenz liegt beim Betreiber).

## Später — Stadt und Release

- **Bespielbare Stadt vor dem Release:** mehrere Orte, begehbare Wege, Figuren mit Tagesablauf, Erinnerung und eigenem Geld; ein Charakter mit Laune, Ruf und Ressourcen. Das ist der Release-Horizont, nicht ein groesserer Saal.
- Rivalen-Profilkarte mit Historie und Indizien; ortsuebergreifende Aktionen statt nur casino-uebergreifender.
- Sieben-Tage-Langlauf mit Narrativ-Ereignissen als eigener CI-Nachweis.
- Uebersetzung der UI-Texte, falls eine zweite Sprache dazukommt.
