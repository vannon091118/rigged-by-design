# Rigged by Design — Agentenvertrag

<!-- rbd-doc: managed -->

## Kern
**Start:** `pnpm rbd agent start --brief` — Board live, Token aus `GH_TOKEN` u. a.
**Rollen:** Agent (`LIILITH`, `Shinon`, `Jenova`) claimt, arbeitet, pusht, öffnet PR. Maintainer reviewt, merged, schließt, taggt. User entscheidet die Richtung.
**Gates:** 18 lokale Required-Gates, 13 Light-Gates, `verify:all` = 18 Required-Gates plus Audit (19 Läufe).
**Leseregel:** `rbd docs read` (7 Kerne, <10k), dann nur nötige Tiefe; Claim vor Read.

## Zehn unverhandelbare Regeln
1. Claim vor Read; fremder Claim ist tabu.
2. WIP adoptieren; kein `reset --hard`, `clean`, `stash`, `push --force`, `branch -D`.
3. Ein Zustandsbesitzer: `world-store`; `src/core/` bleibt headless.
4. Geld ist integer; jede Bewegung ist eine Ledger-Zeile, Quelle nur `EXTERNAL_WORLD`.
5. Kein `Math.random()`, `Date.now()` oder `new Date()` im Spielpfad.
6. Narrative nur aus echten Zustandsgrenzen; kein LLM im Spielpfad.
7. Eine Testlinie lokal: `rbd verify light`, `rbd verify fast`, `rbd ci local`; Mechanik `rbd test mechanics`.
8. Doku gehört in den Commit; generierte Blöcke nur über ihren Generator.
9. Lieferung per Branch und PR; vor Push `rbd claim preflight`; Merge nur Maintainer oder User.
10. `AUTO_FIX → LOCAL_GATE → REMOTE_CI → AGENT → BLOCKED`; nur Invarianten blockieren.

## Pitfalls
| Falle | Regel |
| --- | --- |
| Gate-Zahl schätzen | Zahl aus [CI](docs/CI.md), nie aus dem Gedächtnis. |
| Fremdes WIP löschen | Adoptieren und fertigbauen. |
| Generiertes editieren | Generator ändern, dann `pnpm rbd sync generated`. |
| Selbst mergen oder schließen | Nur Maintainer/User. |
| Zweite Wahrheit | Issue schlägt lokale Datei, Code schlägt Prosa. |

## Referenzen
[INDEX](docs/INDEX.md) · [WORKFLOW](docs/WORKFLOW.md) · [ROADMAP](docs/ROADMAP.md) · [LAST-CHANGES](docs/LAST-CHANGES.md) · [GOVERNANCE](docs/GOVERNANCE.md) · [CI](docs/CI.md) · Board #677
