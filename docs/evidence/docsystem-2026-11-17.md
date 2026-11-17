# Doku-System — Inventur, Umbau und Nachweis

<!-- rbd-doc: managed -->

**Zweck:** Beleg für den Doku-Kern vom 2026-11-17: fünf Pflichtdokus, je ≤500 Token, Gesamtüberblick ≤10.000 Token, kein Merge-Drift. Die Zahlen sind mit derselben Schätzung wie `scripts/lib/doc-core.mjs` gemessen (ein Token ≈ vier Zeichen, konservativ für deutsche Prosa).

## Vorher: dreizehn Pflichtdokumente

Gemessen gegen `HEAD` (`0f8cd59a`) und die damalige `DOC_SET`-Liste.

| Dokument | Bytes | Token |
| --- | ---: | ---: |
| `docs/INVENTORY.md` | 574.458 | 139.934 |
| `docs/DEVTAGEBUCH.md` | 305.361 | 76.138 |
| `docs/ARCHITECTURE.md` | 152.169 | 37.829 |
| `docs/CHANGELOG.md` | 138.875 | 34.629 |
| `docs/GOVERNANCE.md` | 37.369 | 9.253 |
| `docs/ROADMAP.md` | 19.387 | 4.803 |
| `docs/WORKFLOW.md` | 16.065 | 3.982 |
| `docs/AGENT-ONBOARDING.md` | 15.643 | 3.846 |
| `AGENTS.md` | 15.067 | 3.730 |
| `docs/TESTING.md` | 7.971 | 1.978 |
| `docs/CI.md` | 7.037 | 1.748 |
| `docs/INDEX.md` | 4.684 | 1.164 |
| `docs/contracts/README.md` | 3.477 | 863 |
| **Summe** | **1.297.563** | **319.897** |

Ein vollständiger Pflichtdoku-Read kostete rund **319.897 Token**; das größte Einzeldokument allein **139.934 Token**.

## Nachher: fünf Pflichtdokus mit Kern

| Dokument | Umfang | Token | Budget |
| --- | --- | ---: | ---: |
| `AGENTS.md` | ganzes Dokument | 480 | 500 |
| `docs/WORKFLOW.md` | ganzes Dokument | 399 | 500 |
| `docs/INDEX.md` | ganzes Dokument | 491 | 500 |
| `docs/ROADMAP.md` | nur `## Kern` | 148 | 500 |
| `docs/LAST-CHANGES.md` | ganzes Dokument | 429 | 500 |
| **Summe** | fünf Pflichtdokus | **1.947** | **10.000** |
| `docs/TESTING.md` | nur `## Kern` | 387 | 500 |
| `docs/GOVERNANCE.md` | nur `## Kern` | 160 | 500 |
| **Lesepfad** | sieben Kerne | **2.494** | **10.000** |

- **Kontextkosten:** 319.897 → **1.947 Token** für die fünf Pflichtdokus; **2.494 Token** für den vollständigen Lesepfad (Pflichtdokus plus Test-/Governance-Kern).
- **Größtes Einzeldokument:** 139.934 → **491 Token** (−99,65 %).
- **Überblick:** 2.494 von 10.000 Token; die 500-Token-Grenze je Dokument wird in jedem Fall eingehalten. Der Rest des Budgets ist für task-spezifische Tiefe reserviert, nicht für Pflichtlektüre.
- **Referenzkorpus:** rund 377.000 Token in 34 Dateien bleiben auf Abruf erhalten und werden nicht mehr bei jedem Start gelesen.

Die Detailtiefe des alten Workflows steht unverändert in [`../WORKFLOW-DETAIL.md`](../WORKFLOW-DETAIL.md); die Roadmap behält ihre Phasentabellen unter dem Kern. Es wurde kein Wissen gelöscht, nur die Pflichtlesefläche verkleinert.

## Cross-Checks (mechanisch)

`verify:docs` prüft jetzt zusätzlich zu Markern, Abschnitten und Ankern:

- Existenz und Eindeutigkeit der fünf Pflichtdokus,
- `## Kern` je Dokument und das Budget (500 je Dokument, 10.000 gesamt),
- Merge-Stabilität des Kerns: keine Versionsnummer, kein Commit-SHA, kein generierter Block,
- jede im Kern genannte ausführbare Quelle (`pnpm run …`, `node scripts/…`),
- jede Referenzdoku ist von `docs/INDEX.md` erreichbar (kein verwaistes Wissen),
- jeder getrackte Wurzelordner hat einen Eintrag in `.github/CODEOWNERS` und steht in `## Ordner`,
- `docs/LAST-CHANGES.md` hat 3–7 absteigend datierte Zeilen und ist nicht älter als das Changelog.

Der Regressionstest [`doc-core.test.ts`](../../src/core/governance/__tests__/doc-core.test.ts) hält Budget, Merge-Stabilität und Cross-Checks; `scripts/doc-audit.mjs` liefert dieselbe Messung als Tabelle oder JSON. `doc-read.test.ts` und `shell-guard.test.ts` sichern den 10k-Lesepfad und die lokalen Gates (19 fokussierte Tests).

## Kein Drift der fünf Kerne bei jedem Merge

- Die fünf Kerne enthalten **keine** generierten Blöcke, keine Version und keinen HEAD-SHA. Ein Merge ändert sie nicht.
- `docs/LAST-CHANGES.md` ist eine datierte, auf sieben Einträge begrenzte Liste; sie wird im selben PR wie die Änderung gepflegt, nicht nach dem Merge erzeugt.
- Die Roadmap behält ihre generierte P-13-Fortschrittszeile **unter** dem Kern; der Kern selbst ist stabil.
- Referenzartefakte wie `docs/INVENTORY.md` bleiben generiert und werden weiterhin über `sync-generated` nachgezogen. Sie sind keine Pflichtlektüre und nicht Teil des 10.000-Token-Überblicks. Der Satz „kein Drift“ gilt für die fünf Kerne, nicht für diese generierten Artefakte.

## RBD-first und Root-Cause-Härtung

Die primäre Oberfläche ist `rbd <gruppe> <aktion>`; die Pflichtdokus nennen RBD-Routen, die `pnpm run`-Namen bleiben Kompatibilitätsaliase. Neu sind `rbd docs audit` (Messung) und der Routen-Cross-Check im Gate: Jede im Kern genannte RBD-Route wird gegen `scripts/lib/command-surface.mjs` geprüft, damit eine Umbenennung nicht still veraltet.

Drei Blocker aus `HEAD` wurden an der Ursache behoben, statt sie zu umgehen:

- `prepare` bricht in einem frischen Klon ohne `core.hooksPath` nicht mehr ab; der Hook wird über `node scripts/install-hooks.mjs` installiert.
- Der Skill-Treiber lintet wieder: unbenutzter Import entfernt, ANSI-Regex ohne Unterdrückung über `String.fromCharCode(27)` gebaut.
- Der Merge-Beleg-Index fällt ohne `origin/main` auf `HEAD` zurück und überschreibt einen belegten Index nicht mit einem leeren Neuaufbau; der Rückstand #1076 wird nachgezogen.

## Claim-System folgt dem Doku-Kern

- `META_FILES` leitet die vier inhaltlichen Kern-Dokus aus `CORE_PATHS` ab; `docs/INDEX.md` und `docs/WORKFLOW.md` sind damit wie `AGENTS.md` und `docs/ROADMAP.md` governance-geschützt. `promote.mjs` importiert dieselbe Liste statt einer zweiten Kopie.
- `docs/LAST-CHANGES.md` ist gemeinsame Ablage: jede Lane ergänzt ihren datierten Eintrag im selben PR, ohne die Allowlist zu erweitern; Kollisionen und Staging-Sperre sind dafür ausgenommen.
- `rbd claim preflight` läuft im Pre-Push-Hook und vor `turn:finish`. Es meldet offene Claims, parallele Lanes und Rest-WIP; uncommitted WIP, ein Claim ohne Issue und ein Bruch der Claim/Task-Parität blockieren den Push. Die Meldung ist nach Kontextverlust selbsterklärend und nennt die drei Entscheidungen: eigener WIP, paralleler Task, offene Arbeit ohne Issue.

Der Preflight ist mit `claim-preflight.test.ts`, `claim-doc-core.test.ts`, `lane-claims.test.ts` und `staging-scope.test.ts` abgedeckt (39 fokussierte Tests).

## 10k-Lesepfad und lokale Durchsetzung

Der 10k-Vertrag ist ein **Lesepfad**, keine Ausgabegrenze:

- `rbd docs read` liest die fünf Pflichtdokus vollständig und von `TESTING`/`GOVERNANCE` nur den Kern. Es schreibt `.verify-cache/doc-read.json` mit einem SHA-256 je budgetiertem Inhalt. Ändert sich ein Kern, wird das Receipt stale; Prosa außerhalb des Kerns invalidiert es nicht.
- `.claude/settings.json` registriert einen `PreToolUse`-Hook. Vor gültigem Receipt sind nur `rbd docs read` und das direkte Lesen eines der sieben Kerne erlaubt; danach blockiert der Hook zusätzlich Gate-Pipes durch `head`/`tail`/`grep`.
- `rbd shell watch` startet eine guarded Bash. Die Funktionen für `grep`, `rg`, `git`, `pnpm`, `npm`, `npx`, `node`, `gh` und `vitest` prüfen vor der Ausführung; destructives Git, `main`-Push, Agenten-Merge und verlustreiche Gate-Pipes bleiben gesperrt. Der Watcher schreibt `.verify-cache/shell-watch.status` und eskaliert Receipt-/Verstoßwechsel im Terminal. Der Verstoßzähler steht in `.verify-cache/shell-guard.json`.

Der Pfad ist lokal: keine GitHub-Actions, kein Netz für das Gate, keine zusätzliche Pflichtdoku. Die Git-Hooks bleiben unverändert schnell; der Lesepfad blockiert weder Commit noch Push.

## Entwicklungszeit und Reproduktion

Reproduktion (ohne globale Installation genügt `node bin/rbd.mjs …`):

```bash
node scripts/doc-audit.mjs --check          # 2.499/10.000, Cross-Checks
node scripts/doc-audit.mjs --read           # 7 Kerne + Receipt
bash -n scripts/shell/guard.sh              # Shell-Syntax
./node_modules/.bin/vitest run --config src/Config/vite.config.ts \
  src/core/governance/__tests__/doc-core.test.ts \
  src/core/governance/__tests__/doc-read.test.ts \
  src/core/governance/__tests__/shell-guard.test.ts
```

`doc-audit --check` und `verify:docs` brauchen zusammen unter einer Sekunde; der Doku-Umbau kostet im Gate also keine nennenswerte Laufzeit. Die Zeitersparnis im Betrieb entsteht über den kleineren Pflichtkontext: **319.897 → 2.494 Token pro vollständigem Lesepfad**. Eine menschliche Zeitstudie wurde nicht durchgeführt; die Zahl ist eine Kontextmessung, keine gemessene Arbeitszeit.

## Grenzen

- Die Schätzung „vier Zeichen je Token“ ist bewusst konservativ, aber kein Tokenizer-Messwert.
- Die Detailtiefe der Referenzdokumente bleibt groß; sie wird nur nicht mehr standardmäßig gelesen.
- Die generierten Referenzartefakte bleiben bestehen und werden weiterhin nach einem Merge regeneriert.
- Der `PreToolUse`-Hook wirkt in Claude-Code-Sitzungen; Freebuff und andere Clients nutzen ihn nicht automatisch. Dort ist `rbd shell watch` der lokale Durchsetzungspfad, und die Git-Hooks sichern Claims/Vertrag unabhängig davon.
- Die guarded Bash prüft die aufgerufenen Werkzeugfunktionen, nicht beliebige Shell-Builtins. `cat`/`ls` bleiben lesend erlaubt; die Pflichtlektüre wird über die Arbeitswerkzeuge und den Hook erzwungen, nicht über jedes Builtin.

## Merge-Beleg (2026-11-17)

- Governance-Commit: `f4e94609`; PR: **#1083**; Merge-Status: **gemergt** als `6f78b4c1` auf `main`.
- Pre-Push-Hook: Claim-/Board-Gate grün (`OPEN · claimed-self`, Claim A1); Push über den authentifizierten Connector, keine GitHub Actions.
- `main` enthält den Feature-Commit und den Merge; die Doku-/Baum-/Claim-Gates laufen auf diesem Stand erneut.
- Einzige Vorbelastung: der ungenutzte Rückgabewert im bestehenden Store-Test; die separate Fix-Lane Issue #1084 stellt `rbd verify light` wieder auf 13/13.
- Fix-Commit: `ac6ff28d`; PR: **#1086**; Merge-Status: **gemergt** als `13a9644c`; fokussierter Store-Test 5/5.
- Closeout: `merged-index` nach den Merges regeneriert; `rbd verify light` auf `main` wieder **13/13**.
- Closeout #1087: Merge `2bed35d3`; der finale Index-Nachtrag wird per **Squash** gemergt, damit der Generator keinen weiteren Merge-Eintrag fuer sich selbst erzeugt.



