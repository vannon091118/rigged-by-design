# Last Changes

<!-- rbd-doc: managed -->

## Kern
**Was zuletzt wirksam wurde** — hoechstens sieben datierte Zeilen, neueste oben. Details stehen in [CHANGELOG](../CHANGELOG.md).
**Regel:** Eintrag im selben Commit wie die Aenderung; keine Version, kein HEAD, kein generierter Block.

## Letzte Änderungen
| Datum | Änderung | Beleg |
| --- | --- | --- |
| 2026-11-18 | Phase 2: NPC-Rig waehlt Koerpervarianten und drei Kopfformen. | `src/render/rig-parts.ts` |
| 2026-11-18 | Phase 1: Art-Vertrag, Audit und 18 SVGs als Atlasframes. | `docs/style-guide.md`, `scripts/build-asset-manifest.mjs` |
| 2026-11-18 | Claims #1092/#979 nachgezogen; Sektionskopf-Titel rot. | `.lane-claims/`, `scripts/lib/commit-msg.mjs` |
| 2026-11-18 | `--no-verify`-Bypass: Push prueft Claim, Drift, Budget und jede Nicht-Merge-Nachricht (ERR-4006). | `.githooks/pre-push` |
| 2026-11-18 | Hooks armen im Install; Contract-Gate meldet ungeschuetzte Klone (ERR-4018). | `scripts/install-hooks.mjs` |
| 2026-11-17 | Fuenf Pflichtdokus; Budget echt gemessen, Drift in pre-commit/push, Board-Gate lokal ueber Cache; Tooling-Uhr lint-konform; Welttexte weltlich; Hooks 755. | `scripts/lib/doc-core.mjs`, `scripts/lib/doc-drift.mjs` |
| 2026-11-17 | LOC-Guard deckt `scripts/` ohne Ausnahme; pretask und promote modularisiert. | #1101, `scripts/pretask.mjs`, `scripts/promote.mjs` |

## Regeln
- Maximal sieben Zeilen; der aelteste Eintrag faellt heraus.
- Jede Zeile nennt Datum, Aenderung und Beleg.
- `verify:docs` prueft Anzahl, Reihenfolge und das Changelog-Datum.
