# Roadmap

<!-- rbd-doc: v0.3.64 | 2026-11-01 11:56 UTC -->

Drei Horizonte, keine Wunschliste. Was hier steht, ist entweder beauftragt oder
begruendet vertagt; abgeschlossene Punkte wandern ins Changelog.

## Jetzt

- Inventur ist abgeschlossen: §18 deckt alle getrackten Dateien und Ordner ab; `verify:docs` haelt die Abdeckung, der Hook baut sie.
- Hooks in jedem Klon aktivieren (`npm run hooks:install`); Doc-Gate und Abdeckung im CI beobachten.
- Befund 33 (Bar-Kapazitaet in drei UI-Dateien) und Befund 34 (`Â·`-Mojibake) nach Freigabe reparieren.
- Tree- und Redundanz-Gate bei neuen Befunden ueber die Regeltabelle erweitern, nicht umgehen.
- Narrative Engine Stufe 1 ist umgesetzt (NAR-00 bis NAR-03): Vertrag, persistente Domaene mit Fact-Queue, Erinnerungen und Start-Pool, Save v9. Naechster Schnitt: NAR-04 Beziehungen, dann NAR-05 Trigger und NAR-06 Scheduler.
- Determinismus haelt eine fail-closed ESLint-Regel: `src/**` und `scripts/**` ohne Zufall/Wanduhr, Umwege und `eslint-disable` inklusive; echter Zufall nur via `entropySeed()`. `performance.now` ist auf drei Pacing-Dateien unter `src/render/` verengt, alle anderen Render-Dateien sind voll gesperrt.

## Als Nächstes

- Import/Export um benannte Spielstaende erweitern (mehrere Slots statt einer Zwischenablage).
- Narrativ-Engine nach dem adversarial gehaerteten `docs/event-narrative-engine-taskplan.md`: NAR-00 bis NAR-03 sind umgesetzt; als Naechstes NAR-04 Beziehungen, NAR-05 Trigger, NAR-06 Scheduler, NAR-07 Event-Templates und NAR-08 Command-DSL. Reihenfolge bindend, insbesondere NAR-13 vor NAR-12.
- Asset-Lizenz als Nachweis im Repo verlinken (Lizenz liegt beim Betreiber).

## Später

- Autonome Rivalen (NAR-15) und casino-uebergreifende Aktionen.
- Langzeit-Soak mit Narrativ-Ereignissen (NAR-16) als eigener CI-Nachweis.
- Uebersetzung der UI-Texte, falls eine zweite Sprache dazukommt.
