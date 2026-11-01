# Roadmap

<!-- rbd-doc: v0.3.64 | 2026-11-01 09:35 UTC -->

Drei Horizonte, keine Wunschliste. Was hier steht, ist entweder beauftragt oder
begruendet vertagt; abgeschlossene Punkte wandern ins Changelog.

## Jetzt

- Governance-Ausbau abschliessen: Hooks in jedem Klon aktivieren (`npm run hooks:install`), Doc-Gate in CI beobachten.
- Inventur auf 100 Prozent bringen: restliche `render`-Dateien und Testkoerper lesen.
- Befund 33 (Bar-Kapazitaet in drei UI-Dateien) und Befund 34 (`Â·`-Mojibake) nach Freigabe reparieren.
- Tree- und Redundanz-Gate im naechsten CI-Lauf beobachten; bei neuen Befunden die Regel tabelle ergaenzen, nicht umgehen.

## Als Nächstes

- Import/Export um benannte Spielstaende erweitern (mehrere Slots statt einer Zwischenablage).
- Narrativ-Engine nach `docs/event-narrative-engine-taskplan.md`: NAR-00 Vertrag, NAR-01 Save v9, danach Facts und Gedaechtnis.
- Asset-Lizenz als Nachweis im Repo verlinken (Lizenz liegt beim Betreiber).

## Später

- Autonome Rivalen (NAR-15) und casino-uebergreifende Aktionen.
- Langzeit-Soak mit Narrativ-Ereignissen (NAR-16) als eigener CI-Nachweis.
- Uebersetzung der UI-Texte, falls eine zweite Sprache dazukommt.
