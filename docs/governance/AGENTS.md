# Agentenvertrag

<!-- rbd-doc: managed -->

## Kern
**Start:** `pnpm rbd agent start --brief`; **Lesen:** `pnpm rbd docs read` (fuenf Pflichtdokus, je ≤500, ≤10k).
**Rollen:** Agent claimt, arbeitet, pusht, oeffnet PR; Maintainer reviewt, merged, schliesst, taggt; User entscheidet.
**Gates:** 18 lokale Required-Gates, 13 Light-Gates; `verify:all` = 18 Required-Gates plus Audit (19 Läufe).
**Grenzen:** kein `main`-Push, Merge, Close, Force.

## Zehn Regeln
1. Claim vor Read; fremder Claim ist tabu.
2. WIP adoptieren; kein `reset --hard`, `clean`, `stash`, `push --force`, `branch -D`.
3. Ein Zustandsbesitzer `world-store`; `src/core/` bleibt headless.
4. Geld ist integer; jede Bewegung eine Ledger-Zeile, Quelle nur `EXTERNAL_WORLD`.
5. Kein `Math.random()`, `Date.now()`, `new Date()` im Spielpfad.
6. Narrative nur aus Zustandsgrenzen; kein LLM im Spielpfad.
7. Eine Testlinie: `rbd verify light`, `rbd verify fast`, `rbd ci local`.
8. Doku im selben Commit; generierte Bloecke nur ueber ihren Generator.
9. Branch plus PR; vor Push `rbd claim preflight`; Merge nur Maintainer/User.
10. `AUTO_FIX -> LOCAL_GATE -> AGENT -> BLOCKED`; nur Invarianten blockieren.

## Ablauf
Start, Issue und Claim, `rbd agent pretask`, `rbd agent context`, Arbeit im Claim-Scope, gezielte Tests, `rbd claim preflight`, `rbd turn finish`, PR, `RELEASE [A<n>] done <sha>`.
Tiefe: [WORKFLOW-DETAIL](../WORKFLOW-DETAIL.md)

## Referenzen
[INDEX](INDEX.md) · [PITFALLS](PITFALLS.md) · [ROADMAP](ROADMAP.md) · [LAST-CHANGES](LAST-CHANGES.md) · [GOVERNANCE](../GOVERNANCE.md) · [CI](../CI.md)
