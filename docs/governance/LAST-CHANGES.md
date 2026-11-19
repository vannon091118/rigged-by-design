# Last Changes

<!-- rbd-doc: managed -->

## Kern
**Was zuletzt wirksam wurde** — hoechstens sieben datierte Zeilen, neueste oben. Details stehen in [CHANGELOG](../CHANGELOG.md).
**Regel:** Eintrag im selben Commit wie die Aenderung; keine Version, kein HEAD, kein generierter Block.

## Letzte Änderungen
| Datum | Änderung | Beleg |
| --- | --- | --- |
| 2026-11-19 | Issue #658 Asset-Lizenz-Pruefung: keine Prufung im Code, keine LICENSE-Datei, Board-State auf OFFEN gesetzt | `.lane-claims/board-state.json` |
| 2026-11-19 | PerfGovernor haertert gegen Flappen bei konstanter Grenz-FPS-Belastung; Hochschalten nur, wenn Zielstufe Last als "gut" einstuft. | `perf-governor.ts`, `perf-governor.test.ts` |
| 2026-11-18 | LOD-Wechsel im Live-Lauf belegt: FIT zeigt den Pin, Zoom den Rig; alter Pin-Beleg als reine Sprite-Sicht korrigiert. | `lod-fit-pins.png`, `lod-fit-detail.png` |
| 2026-11-18 | LOD-Sprite-Set: drei Familien × Koerper/Kopf/Haar im Atlas, Tint im Pin. | `lod-families.svg`, `actor-silhouette.ts` |
| 2026-11-18 | Sim-Tests strukturiert loggen (#998); Doku-Ratchet sichtbar auf 1.655.000 B. | `test-log.ts`, `redundancy-metrics.mjs` |
| 2026-11-18 | Editor waehlt Kopffamilie und Haarton; Vorschau und Floor lesen denselben Look. | `player-look.ts`, `look-popup.tsx` |
| 2026-11-18 | LOD traegt Kopf und Haarton; Seed folgt dem Namen. | `actor-silhouette.ts` |

## Regeln
- Maximal sieben Zeilen; der aelteste Eintrag faellt heraus.
- Jede Zeile nennt Datum, Aenderung und Beleg.
- `verify:docs` prueft Anzahl, Reihenfolge und das Changelog-Datum.
