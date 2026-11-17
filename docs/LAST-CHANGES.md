# Last Changes

<!-- rbd-doc: managed -->

## Kern
**Was zuletzt wirksam wurde** — höchstens sieben datierte Einträge, neueste oben. Kein Changelog-Ersatz: Details und Versionen stehen in [CHANGELOG.md](CHANGELOG.md).
**Regel:** Eintrag im selben PR wie die Änderung; keine generierten Blöcke, keine Versions- oder HEAD-Abhängigkeit. Damit bleibt die Datei über jeden Merge stabil.

## Letzte Änderungen
| Datum | Änderung | Beleg |
| --- | --- | --- |
| 2026-11-17 | 10k-Lesepfad (7 Kerne, Receipt), PreToolUse und guarded Shell mit Watcher; Doku-Schichtkarte. | `scripts/lib/doc-read.mjs`, `scripts/agent-pretool.mjs`, `scripts/lib/shell-guard.mjs` |
| 2026-11-17 | Claim-Preflight: offene Claims/Rest-WIP vor Push; Doku-Kern governance-geschützt, LAST-CHANGES gemeinsam. | `scripts/claim-preflight.mjs`, `scripts/lib/lane-claims.mjs` |
| 2026-11-17 | RBD-first: `docs audit`, Routen-Cross-Check; `prepare`- und Lint-Blocker an der Ursache behoben. | `bin/rbd.mjs`, `scripts/lib/command-surface.mjs`, `scripts/lib/doc-core.mjs` |
| 2026-11-17 | Fünf Pflichtdokus mit Kern-Budget und Cross-Checks; Roadmap folgt zuletzt. | [INDEX](INDEX.md), [doc-core](../scripts/lib/doc-core.mjs) |
| 2026-11-17 | Prepare-Hook installiert pnpm nur bei fehlenden Hooks. | #1078, `package.json` |
| 2026-11-17 | Life-Sim-Tag der Lane #973 bereinigt. | #1076, `src/core/sim/` |
| 2026-11-17 | Doppelte Lib-Skripte entfernt, Merge-Driver-Pfad korrigiert. | #1074, `scripts/lib/` |

## Regeln
- Maximal sieben Einträge; der älteste fällt beim nächsten Update heraus.
- Jede Zeile nennt Datum, Änderung und Beleg; `verify:docs` prüft Anzahl, Reihenfolge und das Changelog-Datum.
- Kein Eintrag ohne Bezug: PR-Nummer, Pfad oder Datei.
