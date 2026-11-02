# Roadmap

<!-- rbd-doc: v0.3.76 | 2026-11-02 22:37 UTC -->

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
- Narrative-Grundlagen existieren: Vertrag, Fact-Queue, Erinnerungen, Start-Pool und Save v9. NAR-02/03 sind noch nicht vollstaendig: weitere Facts, Ledger-Cursor, Charaktereigenschaften und referenzsichere Retention fehlen; danach folgen Beziehungen, Trigger und Scheduler.
- Determinismus haelt eine fail-closed ESLint-Regel: `src/**` und `scripts/**` ohne Zufall/Wanduhr, Umwege und `eslint-disable` inklusive; echter Zufall nur via `entropySeed()`. `performance.now` ist auf drei Pacing-Dateien unter `src/render/` verengt, alle anderen Render-Dateien sind voll gesperrt.

## Als Nächstes

- Import/Export um benannte Spielstaende erweitern (mehrere Slots statt einer Zwischenablage).
- Narrativ-Engine nach `docs/EVENT-NARRATIVE-ENGINE-TASKPLAN.md`: Ein reiner Bedingungsauswerter fuer ausgewaehlte Facts und Weltwerte existiert, ist aber noch nicht integriert. Offene Grundlagen abschliessen, dann Beziehungen, Trigger-Integration, Scheduler, Templates und Command-DSL. Content-Compiler und Composer sind geplant und sollen lokal ohne LLM laufen; Demand-Migration NAR-13 kommt vor der Tick-Integration NAR-12 und soll v5–v9-Saves bewahren.
- Asset-Lizenz als Nachweis im Repo verlinken (Lizenz liegt beim Betreiber).

## Später

- Autonome Rivalen (NAR-15) und casino-uebergreifende Aktionen.
- Langzeit-Soak mit Narrativ-Ereignissen (NAR-16) als eigener CI-Nachweis.
- Uebersetzung der UI-Texte, falls eine zweite Sprache dazukommt.
