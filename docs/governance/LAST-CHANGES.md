# Last Changes

<!-- rbd-doc: managed -->

## Kern
**Was zuletzt wirksam wurde** — hoechstens sieben datierte Zeilen, neueste oben. Details stehen in [CHANGELOG](../CHANGELOG.md).
**Regel:** Eintrag im selben Commit wie die Aenderung; keine Version, kein HEAD, kein generierter Block.

## Letzte Änderungen
| Datum | Änderung | Beleg |
| 2026-11-19 | Issue #733 abgeschlossen: Abnahme 2/4 erfüllt für konsolidierte Issues #663-667. Ersatz-Bausteine pro Pool vorhanden (verify-narrative-blocks --pr PASS, 802/1500 gewertete Bausteine, alle Pool-Minimums erfüllt); verify-narrative-blocks --pr = 0 Verstöße; compile-narrative-content.mjs --write läuft durch (Registry geschrieben: 1249 Fragmente, registry.generated.ts + slot-map.generated.ts). | .lane-claims/board-state.json, scripts/verify-narrative-blocks.mjs, scripts/compile-narrative-content.mjs |
| 2026-11-18 | LOD-Hysterese: Kantenverlauf unter, ueber und im Band getestet; Test scheitert an einer Schwelle, `enter == exit` und vertauschten Kanten. | `floor-camera-hysteresis.test.ts` |
| 2026-11-18 | LOD-Wechsel im Live-Lauf belegt: FIT zeigt den Pin, Zoom den Rig; alter Pin-Beleg als reine Sprite-Sicht korrigiert. | `lod-fit-pins.png`, `lod-fit-detail.png` |
| 2026-11-18 | LOD-Sprite-Set: drei Familien × Koerper/Kopf/Haar im Atlas, Tint im Pin. | `lod-families.svg`, `actor-silhouette.ts` |
| 2026-11-18 | Sim-Tests strukturiert loggen (#998); Doku-Ratchet sichtbar auf 1.655.000 B. | `test-log.ts`, `redundancy-metrics.mjs` |
| 2026-11-18 | Editor waehlt Kopffamilie und Haarton; Vorschau und Floor lesen denselben Look. | `player-look.ts`, `look-popup.tsx` |
| 2026-11-18 | LOD traegt Kopf und Haarton; Seed folgt dem Namen. | `actor-silhouette.ts` |
| 2026-11-19 | PerfGovernor haertert gegen Flappen bei konstanter Grenz-FPS-Belastung; Hochschalten nur, wenn Zielstufe Last als "gut" einstuft. | `perf-governor.ts`, `perf-governor.test.ts` |

## Regeln