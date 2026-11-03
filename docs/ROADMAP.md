# Roadmap

<!-- rbd-doc: v0.3.84 | 2026-11-03 01:57 UTC -->

Drei Horizonte, keine Wunschliste. Was hier steht, ist entweder beauftragt oder
begruendet vertagt; abgeschlossene Punkte wandern ins Changelog.

## Jetzt

- VELVET und FREE_DRINK muessen ihre Beschreibung einloesen (bessere Gaeste, Drink pro Spin) oder umformuliert werden; EXTRA_REEL sollte wirklich eine Walze sein.
- Der Einsatz sollte mit dem Persona-Budget skalieren, damit High Roller nicht nur laenger, sondern hoeher spielt.

- Offen aus dem Audit: Pity-Entladungen heben den RTP des Startautomaten auf 99,15 %, Schulden haben keinen Tilgungspfad, `PLAYER_CASH` keinen Ausgabepfad, die Sucht steuert nichts und der Einsatz skaliert nie mit der Persona.

- README-Onboarding führt Spielwelt und Entwicklungsstart zusammen; Mechaniken und Roadmap sind ausdrücklich als aktueller Stand beziehungsweise Vorhaben gekennzeichnet.

- Ein Prozess statt drei: `agent:context` und `agent:verify` teilen Impact, Gate-Plan und Cache; doppelte Testlaeufe sind entfernt.
- Auslieferung belastbar: der Merge startet CI und Release auch ohne eigenes Token, `integration` bleibt stehen.
- Auslieferung ohne Handgriff: gruene Checks mergen automatisch, rote Staende liegen sichtbar auf `integration` und werden dort repariert.

- Inventur ist abgeschlossen: §18 deckt alle getrackten Dateien und Ordner ab; `verify:docs` haelt die Abdeckung, der Hook baut sie.
- Hooks sind in diesem Klon aktiv (`core.hooksPath=.githooks`); in neuen Klonen `pnpm run hooks:install`, Doc-Gate und Abdeckung im CI beobachten.
- Befund 33 (Bar-Kapazitaet in drei UI-Dateien) und Befund 34 (`Â·`-Mojibake) nach Freigabe reparieren.
- Tree- und Redundanz-Gate bei neuen Befunden ueber die Regeltabelle erweitern, nicht umgehen.
- Narrative-Grundlagen: Vertrag, Fact-Queue, Erinnerungen, Start-Pool und Save v9 stehen. Ledger-Cursor, ein einziger Fact-Boundary und referenzsichere Retention sind umgesetzt; `narrative/relationships.ts` fuehrt gerichtete Kanten und pinnt Endpunkte. NAR-04 ist erledigt: Besuch, Streit, Kassenbedienung und Rivalenabrechnung speisen die Beziehungen. NAR-05 ist erledigt: Context, alle Trigger-Operatoren und fail-closed Schema stehen. NAR-06 ist erledigt: Scheduler, Lifecycle, Cooldowns, persistente Instanzen und eigener Narrativ-RNG stehen. NAR-07 ist erledigt: stabile Templates, Choice-Vertrag, persistierte Choice-Saetze und Klick-Eligibility stehen. NAR-08 ist erledigt: Command-DSL, Allowlist, Preflight und die einmalige Ausfuehrung von Choice-Effekten stehen. NAR-09 ist erledigt: Beitraege tragen eine kontrollierte Klassifizierung, das Turn-Manifest ordnet jedem abgeschlossenen Turn genau einen Beitrag zu, und die Registry wird deterministisch im Assets-Gate geprueft. NAR-10 ist erledigt: Makros werden als typisierte ASTs validiert, Konflikte vor dem Schreiben erkannt und die Registry byte-identisch mit Inhalts-Hash erzeugt; die Trigger-Auswahl im Tick folgt mit NAR-12.
- Determinismus haelt eine fail-closed ESLint-Regel: `src/**` und `scripts/**` ohne Zufall/Wanduhr, Umwege und `eslint-disable` inklusive; echter Zufall nur via `entropySeed()`. `performance.now` ist auf drei Pacing-Dateien unter `src/render/` verengt, alle anderen Render-Dateien sind voll gesperrt.
- Optik und Steuerung sind einen Schritt weiter: Lichtpfuetzen und Wandkanten trennen die Raeume, Zielraster und Laufwegspur zeigen die Folge eines Klicks, die Kamera zieht am Bildrand nach, und das HUD traegt keine leere Zeile mehr. Bildsprache steht als `docs/ART-DIRECTION.md` mit Blatt daneben.

## Als Nächstes

- Lichtpfuetze ueber Regionskanten zusammensetzen, damit grosse Saele keine Chunk-Naht im Licht zeigen; heute zeichnet jeder Chunk seine eigene Pfuetze.
- Touch-Steuerung auf einem echten Geraet pruefen: Ziehen mit zwei Fingern ist im Code, aber nur Maus und Pinch sind belegt.

- Import/Export um benannte Spielstaende erweitern (mehrere Slots statt einer Zwischenablage).
- Narrativ-Engine nach `docs/EVENT-NARRATIVE-ENGINE-TASKPLAN.md`: NAR-04 (Beziehungen), NAR-05 (Trigger-Context, Evaluator, Schema), NAR-06 (Scheduler, Lifecycle, Cooldowns, eigener RNG), NAR-07 (Templates, Choice-Vertrag, Eligibility) und NAR-08 (Command-DSL, Allowlist, Preflight, Ausfuehrung) und NAR-09 (Content-Schema, Vokabular, Turn-Manifest, Registry) sind erledigt; die Trigger-Integration in den Tick bleibt NAR-12. NAR-10 (Content-Compiler) ist erledigt; als Naechstes folgt der Composer (NAR-11), danach die Demand-Migration (NAR-13) vor der Tick-Integration (NAR-12). Compiler und Composer bleiben lokal ohne LLM; der aktive Nachfrageevent-Zustand wird aus v5–v9-Saves nach `narrative` uebernommen.
- Asset-Lizenz als Nachweis im Repo verlinken (Lizenz liegt beim Betreiber).

## Später

- Autonome Rivalen (NAR-15) und casino-uebergreifende Aktionen.
- Langzeit-Soak mit Narrativ-Ereignissen (NAR-16) als eigener CI-Nachweis.
- Uebersetzung der UI-Texte, falls eine zweite Sprache dazukommt.
