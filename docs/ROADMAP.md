# Roadmap

<!-- rbd-doc: v0.3.64 | 2026-11-01 11:03 UTC -->

Drei Horizonte, keine Wunschliste. Was hier steht, ist entweder beauftragt oder
begruendet vertagt; abgeschlossene Punkte wandern ins Changelog.

## Jetzt

- Inventur ist abgeschlossen: §18 deckt alle getrackten Dateien und Ordner ab; `verify:docs` haelt die Abdeckung, der Hook baut sie.
- Hooks in jedem Klon aktivieren (`npm run hooks:install`); Doc-Gate und Abdeckung im CI beobachten.
- Befund 33 (Bar-Kapazitaet in drei UI-Dateien) und Befund 34 (`Â·`-Mojibake) nach Freigabe reparieren.
- Tree- und Redundanz-Gate bei neuen Befunden ueber die Regeltabelle erweitern, nicht umgehen.
- Determinismus haelt jetzt eine ESLint-Regel: kein `Math.random`, keine Wanduhr in `src/**`, echter Zufall nur via `entropySeed()`.

## Als Nächstes

- Import/Export um benannte Spielstaende erweitern (mehrere Slots statt einer Zwischenablage).
- Narrativ-Engine nach dem adversarial gehaerteten `docs/event-narrative-engine-taskplan.md` (§9–§13): NAR-00 Vertrag, NAR-01 Save v9, danach Facts und Gedaechtnis; Reihenfolge bindend, insbesondere NAR-13 vor NAR-12.
- Asset-Lizenz als Nachweis im Repo verlinken (Lizenz liegt beim Betreiber).

## Später

- Autonome Rivalen (NAR-15) und casino-uebergreifende Aktionen.
- Langzeit-Soak mit Narrativ-Ereignissen (NAR-16) als eigener CI-Nachweis.
- Uebersetzung der UI-Texte, falls eine zweite Sprache dazukommt.
