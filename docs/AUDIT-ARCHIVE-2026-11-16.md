# Abrechnung der Archiv-Tags 2026-11-16

Jeder am 2026-11-16 gesicherte Archiv-Tag ist hier mit genau einem Ausgang abgerechnet:
**integriert**, **überholt** oder **abgelehnt**. Kein Tag bleibt unbelegt.

- **Integriert** heißt: die Arbeit liegt als Merge-Commit auf `main` (oder auf dem Integrationszweig, der nach `main` gemergt wird), Gates grün.
- **Überholt** heißt: `main` enthält dieselbe oder eine weiterentwickelte Fassung; der Tag bringt nichts Zusätzliches mehr. Belegt über Byte-Vergleich (`git diff --quiet <tag> main -- <datei>`) oder darüber, dass `main` eine echte Obermenge der Tag-Änderung ist.
- **Abgelehnt** heißt: die Lane verletzt eine harte Regel (Narrative-Pool darf nicht schrumpfen) oder ist nicht lauffähig. Belege sind reproduzierte Gate-Ausgaben.

Gemessen wurde gegen `main` = `a07952fe` plus den Integrationszweig
`lane/governance/archive-integration-2026-11-16`.

## Übersicht (18 Tags)

| # | Tag | Ausgang | Beleg |
| --- | --- | --- | --- |
| 1 | `archive/sim-issue-782-start-guest-crate-2026-11-16` | integriert | PR #951, Merge `a07952fe` auf `main` |
| 2 | `archive/render-issue-640-city-actor-frame-2-2026-11-16` | integriert | Merge `d12fb268` |
| 3 | `archive/render-issue-640-city-actor-frame-2026-11-16` | integriert | Merge `8c80612d` |
| 4 | `archive/sim-issue-537-clothing-brands-2026-11-16` | integriert | Merge `b2f5beba` |
| 5 | `archive/wip-uncommitted-809-2026-11-16` | integriert | Merge `19f59029` |
| 6 | `archive/sim-issue-787-esport-roles-2026-11-16` | integriert | Merge `c1695fdf` |
| 7 | `archive/governance-main-gates-repair-2026-11-16` | integriert | `4accec19` (Test aus der Lane zurückgeholt) |
| 8 | `archive/sim-issue-803-job-career-ladder-2026-11-16` | überholt | ersetzt durch #930 (`e26866c1`) |
| 9 | `archive/wip-uncommitted-788-2026-11-16` | überholt | eigener Diff = nur Version/Lockfile |
| 10 | `archive/governance-gate-repair-after-merges-2026-11-16` | überholt | 8 von 12 Codedateien byte-identisch auf `main` |
| 11 | `archive/governance-issue-555-balance-run-2026-11-16` | überholt | 3 von 3 Codedateien byte-identisch auf `main` |
| 12 | `archive/governance-issue-750-run-budget-findings-2026-11-16` | überholt | `main` ist Obermenge (`FINDING_DUTY`) |
| 13 | `archive/governance-issue-752-pretask-budget-count-2026-11-16` | überholt | `main` ist Obermenge (`MIN_NEW_GOVERNANCE_ISSUES`) |
| 14 | `archive/governance-issue-684-issue-board-2026-11-16` | abgelehnt | löscht 5 Narrative-Beiträge (Pool-Schrumpfung) |
| 15 | `archive/narrative-issue-664-dev-process-remove-2026-11-16` | abgelehnt | löscht 26 Narrative-Beiträge |
| 16 | `archive/narrative-issue-667-technical-system-events-2026-11-16` | abgelehnt | löscht 28 Narrative-Beiträge |
| 17 | `archive/wip-uncommitted-538-2026-11-16` | abgelehnt | 65 Typecheck-Fehler reproduziert |
| 18 | `archive/wip-uncommitted-540-2026-11-16` | abgelehnt | 9 Typecheck-Fehler reproduziert |

## Integriert

### 782 Startgast und Starter-Kiste

Lief bereits über PR #951 auf `main` (`a07952fe`), inklusive
`src/store/__tests__/start-guest-crate-visible.test.ts` (3/3).

### 640 Stadtbewohner im Frame-Pfad (zwei Varianten)

Beide Varianten sind gemergt, weil sie unterschiedliche Stadtszenen beisteuern:

- `frame-2` → `d12fb268`, `city-actor-sync.test.ts` 4/4.
- `frame` → `8c80612d`; drei Konflikte (Claim, Turn-Manifest, Abhängigkeitsmatrix)
  mechanisch aufgelöst, Manifestbeitrag `2026-11-14T13:10Z-city-scene-63` nachgetragen.

### 537 Kleidungsmarken

Merge `b2f5beba`. Die Kauf-Logik liegt in `src/store/clothing-tools.ts`, weil
`world-store.ts` als Hot Zone sonst über das Zeilenbudget läuft (`ERR-4012` bei 182
Zeilen). Nach der Extraktion 170 Zeilen, `verify:light` grün.

### 809 Aktive Betriebsarbeit

Merge `19f59029`. Der Tag enthielt die untracked Datei
`src/core/sim/business-work-stations.ts` nicht; ohne sie vier `TS2307`. Aus dem
Hold-Verzeichnis wiederhergestellt, danach 0 Typecheck-Fehler und
`business-active-work.test.ts` 7/7. Zusätzlich fehlten sechs
Beitragsregistrierungen (`ERR-4022`), Manifest neu aufgebaut (1195 Turns).

### 787 Esport-Rollen

Merge `c1695fdf`, 19/19 Tests (`esport-roles`, `esport-event`, `esport`).

### Governance: Main-Gates-Reparatur

Der Tag brachte `image-diff-gate.test.ts` mit, das auf `main` fehlte, obwohl
`image-diff-gate.ts` dort byte-identisch vorhanden ist:

```
git ls-tree main -- src/core/sim/__tests__/ | grep image   -> leer
git diff --quiet <tag> main -- src/core/sim/narrative/composer/image-diff-gate.ts  -> identisch
```

Test in den Pflicht-Spiegelpfad `src/core/sim/narrative/composer/__tests__/`
verschoben (`ERR-4019` aus `verify-test-placement`), 14/14 grün (Commit `4accec19`).
Die übrigen sechs Codedateien des Tags sind auf `main` byte-identisch.

## Überholt

### 803 Karriereleitern → #930

`main` implementiert Jobleitern bereits vollständig in
`src/core/sim/player-job-promotion.ts`: `averagePerformance`, `checkPromotion`,
`promote`, gestützt auf `careerRanksOf` (`player-job-defs.ts`) und
`PlayerJobState.performanceHistory`.

Der Tag bringt ein **zweites, inkompatibles Modell** (`rank`, `rankShifts`,
`rankQuality`, `totalShifts`) und würde `careerRank`/`performanceHistory` ersetzen.
Der Merge wurde deshalb abgebrochen, nicht textuell zusammengeklebt:

```
git merge --no-commit --no-ff archive/sim-issue-803-...  -> 8 Konflikte
  u. a. src/core/sim/types-model.ts, src/core/sim/player-jobs.ts
```

### 788 nur Versionssprung

```
git diff --name-only <base> archive/wip-uncommitted-788-...  -> package.json, pnpm-lock.yaml
```

Der Tag hebt `0.3.282`; `main` steht bei `0.3.286`. Kein Code, keine Doku, kein
Narrative-Beitrag.

### Governance-Tags mit byte-identischen Codedateien

Für jeden Tag wurde jede Codedatei gegen `main` verglichen:

| Tag | identisch | abweichend |
| --- | --- | --- |
| `gate-repair-after-merges` | 8 | 4 (`city-life-movement` #775, `city-tile-occupancy` #847, `action-card.test` #847, `registry.generated`) |
| `issue-555-balance-run` | 3 | 1 (`registry.generated`) |
| `main-gates-repair` | 4 | 3 (Test fehlte auf `main`, `image-diff-gate.ts` #766, `registry.generated`) |

Abweichende Dateien sind auf `main` weiterentwickelt; `registry.generated.ts` ist
generiert und wird bei jedem Lauf neu geschrieben.

### 750/752 Run-Budget

`main` enthält die Tag-Fassung als echte Obermenge:

```
git diff archive/governance-issue-752-... main -- scripts/lib/run-budget.mjs
+ export const MIN_NEW_GOVERNANCE_ISSUES = 1;
+ export const FINDING_DUTY = 'TICKET_THEN_STOP';
+ findingDuty / notes in decideRunBudget(...)
```

Die Tag-Fassung bringt keine Zeile, die nicht in `main` steht.

## Abgelehnt

### 664 / 667 / 684: Narrative-Pool würde schrumpfen

Regel: „Jeder neue Pool braucht einen Leser im Spiel; der Pool darf nicht
schrumpfen." Die Tags löschen Beiträge, ohne Ersatz zu liefern:

```
git diff --name-only --diff-filter=D <base> <tag> -- content/narrative/contributions | wc -l
  archive/narrative-issue-664-dev-process-remove   -> 26
  archive/narrative-issue-667-technical-system-events -> 28
  archive/governance-issue-684-issue-board         ->  5
```

Beispiel 684: `2026-11-15-board-sync-authorization`, `2026-11-15-city-encounter-place`,
`2026-11-15-dead-exports-847`, `2026-11-15-foreign-floor-guests`,
`2026-11-15-world-test-soak-timeout`.

### 538 / 540: nicht lauffähig

Beide Tags verweisen auf Module, die nur untracked existierten
(`property-catalog.ts`, `property-portfolio.ts`, `property-sites.ts`). Selbst mit
den wiederhergestellten Dateien bleibt der Baum rot, weil das Datenmodell fehlt:

```
archive/wip-uncommitted-538, tsc --noEmit
  src/core/sim/__tests__/property-portfolio.test.ts(27,18): TS2339 Property 'uid' does not exist on type 'OwnedProperty'
  src/core/sim/__tests__/property-portfolio.test.ts(32,25): TS2339 Property 'ownedSites' does not exist on type 'Player'
  -> 65 Fehler

archive/wip-uncommitted-540, tsc --noEmit
  src/core/sim/__tests__/property.test.ts(6,40): TS2305 Module '../property' has no exported member 'hydrateProperty'
  -> 9 Fehler
```

Das ist kein Merge-Problem, sondern unfertige Neuentwicklung (`Player.ownedSites`,
`OwnedProperty.uid`/`siteId`, Ledger-Gründe `PROPERTY_SALE`/`PROPERTY_RENT`/
`PROPERTY_UPKEEP`). Die Arbeit bleibt über die Issues #538 und #540 offen.

## Was auf `main` liegt, aber nicht aus diesen Tags stammt

Die Integrationsarbeit selbst: Claim-Freigaben, Manifest-Registrierungen,
`world-store`-Extraktion (`clothing-tools.ts`) und die Wiederherstellung von drei
Narrative-Beiträgen, die im Integrationszweig verloren gegangen waren.

## Reproduktion

```bash
git tag -l '*2026-11-16*'                      # 18 Tags
git merge-base main <tag>                      # Basis je Tag
git diff --name-only <base> <tag>              # eigener Umfang
git diff --quiet <tag> main -- <datei>         # Byte-Vergleich
git checkout <tag> && npx tsc --noEmit -p src/Config/tsconfig.json
```

## Nachtrag: Vollprüfung aller Tags (2026-11-16, abends)

Gemessen mit `git rev-list --count <tag> ^main` über alle 216 Tags: **177** enthalten
keine Commits außerhalb von `main`, **39** schon. Für die 39 wurde je Tag der Inhalt
gegen `main` geprüft (`git diff --quiet <tag> main -- <datei>`):

| Tag | Datum | Commits nicht auf main | Codedateien | Beleg |
| --- | --- | --- | --- | --- |
| `archiv-2026-11-09/backup-agents-rule-pending` | 2026-11-08 | 2 | 1 | 0/1 identisch; `AGENTS.md` auf main weiterentwickelt (c8dbce86 2026-11-16) |
| `archiv-2026-11-09/lane-gameplay-npc-encounter-loop` | 2026-11-09 | 2 | 20 | 6/20 identisch; `src/core/sim/__tests__/city-encounter-loop.test.ts` auf main weiterentwickelt (b1ee312f 2026-11-13) |
| `archiv-2026-11-09/lane-governance-agents-wartezeiten-regel` | 2026-11-08 | 3 | 1 | 0/1 identisch; `AGENTS.md` auf main weiterentwickelt (c8dbce86 2026-11-16) |
| `archiv-2026-11-09/lane-governance-blocks-gate-final` | 2026-11-08 | 1 | 5 | 0/5 identisch; `.githooks/commit-msg` auf main weiterentwickelt (b82b1208 2026-11-14) |
| `archiv-2026-11-09/lane-governance-claim-tooling` | 2026-11-08 | 1 | 4 | 0/4 identisch; `AGENTS.md` auf main weiterentwickelt (c8dbce86 2026-11-16) |
| `archiv-2026-11-09/lane-governance-influence-matrix` | 2026-11-08 | 3 | 4 | 0/4 identisch; `src/core/sim/__tests__/influence.test.ts` auf main weiterentwickelt (59b26860 2026-11-09) |
| `archiv-2026-11-09/lane-governance-main-repair` | 2026-11-08 | 1 | 1 | 0/1 identisch; `AGENTS.md` auf main weiterentwickelt (c8dbce86 2026-11-16) |
| `archiv-2026-11-09/lane-governance-narrative-chain-graph` | 2026-11-08 | 1 | 0 | nur Claim-/Doku-Zeilen; kein Code |
| `archiv-2026-11-09/lane-governance-npc-encounter-loop` | 2026-11-09 | 3 | 20 | 6/20 identisch; `src/core/sim/__tests__/city-encounter-loop.test.ts` auf main weiterentwickelt (b1ee312f 2026-11-13) |
| `archiv-2026-11-09/lane-governance-player-cash-closeout` | 2026-11-08 | 3 | 0 | nur Claim-/Doku-Zeilen; kein Code |
| `archiv-2026-11-09/lane-governance-slot-discharge-fact` | 2026-11-09 | 3 | 14 | 3/14 identisch; `AGENTS.md` auf main weiterentwickelt (c8dbce86 2026-11-16) |
| `archiv-2026-11-09/lane-governance-slot-discharge-fact-lane2` | 2026-11-09 | 3 | 14 | 3/14 identisch; `AGENTS.md` auf main weiterentwickelt (c8dbce86 2026-11-16) |
| `archiv-2026-11-09/lane-integrity-audit-findings` | 2026-11-09 | 1 | 6 | 1/6 identisch; `AGENTS.md` auf main weiterentwickelt (c8dbce86 2026-11-16) |
| `archiv-2026-11-09/lane-sim-factor-matrix-config` | 2026-11-08 | 4 | 0 | nur Claim-/Doku-Zeilen; kein Code |
| `archiv-2026-11-09/lane-sim-logic-safety` | 2026-11-09 | 2 | 10 | 6/10 identisch; `src/core/sim/__tests__/player-jobs.test.ts` auf main weiterentwickelt (7f8c2119 2026-11-16) |
| `archiv-2026-11-09/lane-sim-player-cash-payout` | 2026-11-08 | 3 | 0 | nur Claim-/Doku-Zeilen; kein Code |
| `archive/2026-11-07/archive-integration` | 2026-11-07 | 11 | 25 | 10/25 identisch; `AGENTS.md` auf main weiterentwickelt (c8dbce86 2026-11-16) |
| `archive/2026-11-07/archive-p0-branches` | 2026-11-07 | 31 | 14 | 6/14 identisch; `.github/workflows/ci-verify.yml` auf main weiterentwickelt (c4d0c465 2026-11-12) |
| `archive/2026-11-07/integration` | 2026-11-07 | 11 | 25 | 10/25 identisch; `AGENTS.md` auf main weiterentwickelt (c8dbce86 2026-11-16) |
| `archive/2026-11-07/lane-governance-ci-stabilization` | 2026-11-07 | 1 | 1 | 0/1 identisch; `AGENTS.md` auf main weiterentwickelt (c8dbce86 2026-11-16) |
| `archive/2026-11-07/lane-interaction-foreign-map-pickup` | 2026-11-07 | 1 | 8 | 0/8 identisch; `AGENTS.md` auf main weiterentwickelt (c8dbce86 2026-11-16) |
| `archive/2026-11-07/lane-interaction-opening-rita` | 2026-11-07 | 2 | 8 | 0/8 identisch; `AGENTS.md` auf main weiterentwickelt (c8dbce86 2026-11-16) |
| `archive/2026-11-07/lane-narrative-multi-beat-events` | 2026-11-07 | 1 | 8 | 1/8 identisch; `AGENTS.md` auf main weiterentwickelt (c8dbce86 2026-11-16) |
| `archive/alt-tip-gameplay` | 2026-11-02 | 11 | 12 | 3/12 identisch; `AGENTS.md` auf main weiterentwickelt (c8dbce86 2026-11-16) |
| `archive/alt-tip-pnpm` | 2026-11-01 | 1 | 31 | 3/31 identisch; `.githooks/pre-commit` auf main weiterentwickelt (927e59d9 2026-11-11) |
| `archive/governance-gate-repair-after-merges-2026-11-16` | 2026-11-15 | 1 | 12 | 8/12 identisch; `src/core/sim/__tests__/city-life-movement.test.ts` auf main weiterentwickelt (2ad9efb5 2026-11-15) |
| `archive/governance-issue-555-balance-run-2026-11-16` | 2026-11-14 | 2 | 4 | 3/4 identisch; `src/core/sim/narrative/composer/registry.generated.ts` auf main weiterentwickelt (0d4f92e8 2026-11-16) |
| `archive/governance-issue-684-issue-board-2026-11-16` | 2026-11-15 | 2 | 53 | 0/53 identisch; `.cron/check-in.mjs` auf main weiterentwickelt (ae3e872b 2026-11-15) |
| `archive/governance-issue-750-run-budget-findings-2026-11-16` | 2026-11-14 | 2 | 3 | 0/3 identisch; `scripts/lib/run-budget.mjs` auf main weiterentwickelt (056663eb 2026-11-14) |
| `archive/governance-issue-752-pretask-budget-count-2026-11-16` | 2026-11-14 | 2 | 4 | 0/4 identisch; `scripts/lib/run-budget.mjs` auf main weiterentwickelt (056663eb 2026-11-14) |
| `archive/governance-main-gates-repair-2026-11-16` | 2026-11-14 | 1 | 7 | 4/7 identisch; `src/core/sim/__tests__/image-diff-gate.test.ts` auf main weiterentwickelt (neuere Fassung) |
| `archive/narrative-issue-664-dev-process-remove-2026-11-16` | 2026-11-14 | 1 | 1 | 0/1 identisch; `src/core/sim/narrative/composer/registry.generated.ts` auf main weiterentwickelt (0d4f92e8 2026-11-16) |
| `archive/narrative-issue-667-technical-system-events-2026-11-16` | 2026-11-14 | 5 | 1 | 0/1 identisch; `src/core/sim/narrative/composer/registry.generated.ts` auf main weiterentwickelt (0d4f92e8 2026-11-16) |
| `archive/sim-issue-782-start-guest-crate-2026-11-16` | 2026-11-15 | 2 | 4 | 2/4 identisch; `src/render/__tests__/start-guest-crate-visible.test.ts` auf main weiterentwickelt (neuere Fassung) |
| `archive/sim-issue-803-job-career-ladder-2026-11-16` | 2026-11-15 | 1 | 13 | 0/13 identisch; `src/core/sim/__tests__/job-career.test.ts` auf main weiterentwickelt (neuere Fassung) |
| `archive/wip-uncommitted-538-2026-11-16` | 2026-11-16 | 2 | 2 | 0/2 identisch; `src/core/sim/narrative/composer/registry.generated.ts` auf main weiterentwickelt (0d4f92e8 2026-11-16) |
| `archive/wip-uncommitted-540-2026-11-16` | 2026-11-16 | 2 | 6 | 0/6 identisch; `src/core/sim/business-areas.ts` auf main weiterentwickelt (9870fcf0 2026-11-11) |
| `archive/wip-uncommitted-788-2026-11-16` | 2026-11-16 | 2 | 0 | nur Claim-/Doku-Zeilen; kein Code |
| `archive/wip-uncommitted-809-2026-11-16` | 2026-11-16 | 3 | 29 | 6/29 identisch; `src/Config/eslint.config.mjs` auf main weiterentwickelt (53552542 2026-11-16) |

**Entscheidung:** alle 39 sind überholt — entweder liegt ihr Code byte-identisch auf `main`,
oder `main` hat die betroffene Datei danach weiterentwickelt (Beleg in der Spalte rechts),
oder der Tag enthält nur Claim-/Doku-Zeilen. Für die 2026-11-16-Tags gilt zusätzlich die
Abrechnung oben (7 integriert, 6 überholt, 5 verworfen). Commits, die nicht Vorfahren von
`main` sind, tragen damit **keine eigene Arbeit** mehr. Die Tags werden nach diesem Nachweis
entfernt; die Belege bleiben hier und über die SHAs der Merge-Commits erhalten.

**Reproduktion:**

```bash
git tag | while read t; do echo "$(git rev-list --count $t ^main) $t"; done | awk "\$1 > 0"
git ls-remote --tags origin | wc -l
```
