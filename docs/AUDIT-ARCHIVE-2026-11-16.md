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
