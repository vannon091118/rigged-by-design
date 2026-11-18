# Last Changes

<!-- rbd-doc: managed -->

## Kern
**Was zuletzt wirksam wurde** — hoechstens sieben datierte Zeilen, neueste oben. Details stehen in [CHANGELOG](../CHANGELOG.md).
**Regel:** Eintrag im selben Commit wie die Aenderung; keine Version, kein HEAD, kein generierter Block.

## Letzte Änderungen
| Datum | Änderung | Beleg |
| --- | --- | --- |
| 2026-11-18 | LOD-Sprite-Set: drei Familien × Koerper/Kopf/Haar im Atlas, Tint im Pin. | `lod-families.svg`, `actor-silhouette.ts` |
| 2026-11-18 | Sim-Tests strukturiert loggen (#998); Doku-Ratchet sichtbar auf 1.655.000 B. | `test-log.ts`, `redundancy-metrics.mjs` |
| 2026-11-18 | Editor waehlt Kopffamilie und Haarton; Vorschau und Floor lesen denselben Look. | `player-look.ts`, `look-popup.tsx` |
| 2026-11-18 | LOD traegt Kopf und Haarton; Seed folgt dem Namen. | `actor-silhouette.ts` |
| 2026-11-18 | Phase 2: NPC-Rig waehlt Koerpervarianten und drei Kopfformen. | `src/render/rig-parts.ts` |
| 2026-11-18 | Phase 1: Art-Vertrag, Audit und 18 SVGs als Atlasframes. | `docs/style-guide.md`, `scripts/build-asset-manifest.mjs` |
| 2026-11-18 | Claims #1092/#979 nachgezogen; Sektionskopf-Titel rot. | `.lane-claims/`, `scripts/lib/commit-msg.mjs` |

## Regeln
- Maximal sieben Zeilen; der aelteste Eintrag faellt heraus.
- Jede Zeile nennt Datum, Aenderung und Beleg.
- `verify:docs` prueft Anzahl, Reihenfolge und das Changelog-Datum.
