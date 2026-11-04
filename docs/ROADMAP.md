# Roadmap

<!-- rbd-doc: v0.3.97 | 2026-11-04 03:39 UTC -->

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
- Narrative-Grundlagen: Vertrag, Fact-Queue, Erinnerungen, Start-Pool und Save v10 stehen. Ledger-Cursor, ein einziger Fact-Boundary und referenzsichere Retention sind umgesetzt; `narrative/relationships.ts` fuehrt gerichtete Kanten und pinnt Endpunkte. NAR-04 ist erledigt: Besuch, Streit, Kassenbedienung und Rivalenabrechnung speisen die Beziehungen. NAR-05 ist erledigt: Context, alle Trigger-Operatoren und fail-closed Schema stehen. NAR-06 ist erledigt: Scheduler, Lifecycle, Cooldowns, persistente Instanzen und eigener Narrativ-RNG stehen. NAR-07 ist erledigt: stabile Templates, Choice-Vertrag, persistierte Choice-Saetze und Klick-Eligibility stehen. NAR-08 ist erledigt: Command-DSL, Allowlist, Preflight und die einmalige Ausfuehrung von Choice-Effekten stehen. NAR-09 ist erledigt: Beitraege tragen eine kontrollierte Klassifizierung, das Turn-Manifest ordnet jedem abgeschlossenen Turn genau einen Beitrag zu, und die Registry wird deterministisch im Assets-Gate geprueft. NAR-10 ist erledigt: Makros werden als typisierte ASTs validiert, Konflikte vor dem Schreiben erkannt und die Registry byte-identisch mit Inhalts-Hash erzeugt. NAR-11 ist erledigt: der Composer waehlt aus der laufzeitvalidierten Registry deterministisch Texte, filtert Locale/Kontext/Flags/Personas und liefert lokale Fallbacks. NAR-12 ist erledigt: `narrative/runtime.ts` orchestriert Fact→Trigger→Scheduler einmal pro Tick und an jeder erfolgreichen Store-Mutationsgrenze; Choices laufen ueber `store/narrative-commands.ts`, und eine aufgeloeste Choice erzeugt den naechsten Fact (`EVENT_RESOLVED`). NAR-13 ist erledigt: Neon-Nacht und Turnierabend laufen als aktive GLOBAL-Instanzen der gemeinsamen Engine, `demand.ts` leitet Wirkung und Anzeige nur noch daraus ab, und v5–v9-Saves werden beim Laden konvertiert. Profilweg und Szenen-Historie sind angebunden: Gaeste oeffnen ihr Profil direkt, das Journal zeigt abgeschlossene Geschichten mit Ausgang und Teilnehmern.
- Determinismus haelt eine fail-closed ESLint-Regel: `src/**` und `scripts/**` ohne Zufall/Wanduhr, Umwege und `eslint-disable` inklusive; echter Zufall nur via `entropySeed()`. `performance.now` ist auf drei Pacing-Dateien unter `src/render/` verengt, alle anderen Render-Dateien sind voll gesperrt.
- Optik und Steuerung sind einen Schritt weiter: Lichtpfuetzen und Wandkanten trennen die Raeume, Zielraster und Laufwegspur zeigen die Folge eines Klicks, die Kamera zieht am Bildrand nach, und das HUD traegt keine leere Zeile mehr. Bildsprache steht als `docs/ART-DIRECTION.md` mit Blatt daneben.

- CI-Eskalation nach dem ersten echten Lauf pruefen: Fingerprint-Zaehlung im Watcher, Stufen aus `level` im Gate-Log, und ob `promote.yml` bei Rot wie beschrieben arbeitet.
- Ruleset-Stand unverifiziert (kein authentifizierter Zugriff): vor dem naechsten Eskalations-Arbeitspaket per API bestaetigen.
- Aufraeumen der alten Worktrees und Branches (`integration`, `pr-watcher-v2` ausgenommen) erst nach Freigabe, mit Bundle-Backup.

## Als Nächstes

- Lichtpfuetze ueber Regionskanten zusammensetzen, damit grosse Saele keine Chunk-Naht im Licht zeigen; heute zeichnet jeder Chunk seine eigene Pfuetze.
- Touch-Steuerung auf einem echten Geraet pruefen: Ziehen mit zwei Fingern ist im Code, aber nur Maus und Pinch sind belegt.

- Import/Export um benannte Spielstaende erweitern (mehrere Slots statt einer Zwischenablage).
- Dialogfuehrung bekommt einen Content-Slot fuer Autorentexte; bis dahin bleibt die Sicherheitsfassung, und der Dialog haelt bewusst keinen Zustand ueber Speichern/Laden.
- Narrativ-Engine nach `docs/EVENT-NARRATIVE-ENGINE-TASKPLAN.md`: NAR-04 (Beziehungen), NAR-05 (Trigger-Context, Evaluator, Schema), NAR-06 (Scheduler, Lifecycle, Cooldowns, eigener RNG), NAR-07 (Templates, Choice-Vertrag, Eligibility) und NAR-08 (Command-DSL, Allowlist, Preflight, Ausfuehrung) und NAR-09 (Content-Schema, Vokabular, Turn-Manifest, Registry) sind erledigt; NAR-10 (Content-Compiler), NAR-11 (lokaler Composer), NAR-12 (Orchestrierung in Tick und WorldStore) und NAR-13 (Demand-Migration) sind erledigt; NAR-14 (Narrative UI), NAR-15 (autonome Rivalen), NAR-16 (Langzeit/Performance) und NAR-17 (Doku-Sync) sind erledigt. Compiler und Composer bleiben lokal ohne LLM; laufende Nachfrageevents aus v5–v9-Saves werden beim Laden zu Event-Instanzen. Seit B1 liefert `narrative/composition-context.ts` den Szenen-Kontext aus Fact, Template, Teilnehmern, Erinnerung und gerichteter Kante; `requiredFlags` bleibt auf Template-Requirements begrenzt. Naechster Schritt sind B2 und der erste Content-Batch nach D1.
- Asset-Lizenz als Nachweis im Repo verlinken (Lizenz liegt beim Betreiber).

## Später

- Rivalen-Profilkarte mit Historie und Indizien; casino-uebergreifende Aktionen.
- Sieben-Tage-Langlauf mit Narrativ-Ereignissen als eigener CI-Nachweis.
- Uebersetzung der UI-Texte, falls eine zweite Sprache dazukommt.
