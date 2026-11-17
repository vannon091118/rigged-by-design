# Last Changes

<!-- rbd-doc: managed -->

## Kern
**Was zuletzt wirksam wurde** — hoechstens sieben datierte Zeilen, neueste oben. Details stehen in [CHANGELOG](../CHANGELOG.md).
**Regel:** Eintrag im selben Commit wie die Aenderung; keine Version, kein HEAD, kein generierter Block.

## Letzte Änderungen
| Datum | Änderung | Beleg |
| --- | --- | --- |
| 2026-11-17 | Fuenf Pflichtdokus; Budget echt gemessen, Drift in pre-commit/push, Board-Gate lokal ueber Cache; Tooling-Uhr lint-konform; Welttexte weltlich; Hooks 755. | `scripts/lib/doc-core.mjs`, `scripts/lib/doc-drift.mjs` |
| 2026-11-17 | LOC-Guard deckt `scripts/` ohne Ausnahme; pretask und promote modularisiert. | #1101, `scripts/pretask.mjs`, `scripts/promote.mjs` |
| 2026-11-17 | NPC-Identitaet: Begegnungen schreiben ueber die gebundene visitorId in die kanonische Erinnerung. | #979, `src/core/sim/narrative/memory.ts` |
| 2026-11-17 | 10k-Lesepfad, PreToolUse-Hook und guarded Shell mit Watcher. | `scripts/lib/doc-read.mjs`, `scripts/shell-watch.mjs` |
| 2026-11-17 | Claim-Preflight vor Push; Doku-Kern governance-geschuetzt. | `scripts/claim-preflight.mjs` |
| 2026-11-17 | RBD-first: `docs audit`, Routen-Cross-Check, Prepare- und Lint-Blocker behoben. | `bin/rbd.mjs`, `scripts/lib/command-surface.mjs` |
| 2026-11-17 | Fuenf Pflichtdokus mit Kern-Budget und Cross-Checks. | [INDEX](INDEX.md) |

## Regeln
- Maximal sieben Zeilen; der aelteste Eintrag faellt heraus.
- Jede Zeile nennt Datum, Aenderung und Beleg.
- `verify:docs` prueft Anzahl, Reihenfolge und das Changelog-Datum.
