# Rigged by Design

<!-- rbd-doc: managed -->

> **Erster Befehl:** `pnpm run agent:pretask --json`

Dieser Kurzvertrag ist der Einstieg. Tiefenwissen steht in den Referenzdokumenten unter `docs/`; sie sind die einzige Quelle für Abläufe, Gate-Listen und Governance-Details. Kein zweiter Langtext hier.

## Zehn unverhandelbare Regeln

1. **Pretask zuerst.** Vor dem ersten Edit `pnpm run agent:pretask --json`; `pretask` holt davor `origin/main` (ein Fetch pro Minute, in CI aus, nie blockierend), damit kein Diff gegen einen alten Ref rechnet; ein offenes `gate-failure`-Issue, ein fehlender Impact-Plan oder ein Claim-Problem blockieren den Start (`ERR-4019`); ein nicht leerer Baum wird adoptiert (Regel 2). Ein verknüpfter Worktree ist optional und nur mit `--require-worktree` Pflicht. Der Task-Vertrag `.lane-claims/tasks/<taskId>.json` ist die Wahrheit für Phase, Befunde und nächste Aktion; `pretask` gibt `READY`, `CONTINUE`, `AFTERCARE`, `MERGE_PENDING` oder `BLOCKED` aus.
2. **Fremdes WIP gibt es nicht.** Jede unfertige Änderung ist kompatibel, unvollständig oder korrupt und wird immer als eigene Arbeit angenommen; nur korrupte Freeze-, Ledger-, Save-, RNG- oder Boot-Pfade halten den Start an (`ERR-4030`). Gestaged wird weiterhin nur, was der Claim deckt; kein Direktpush auf `main`, kein Force-Push, kein Branch-Löschen, kein Stash/Reset/Clean als Abkürzung. Alle Branches außer `main` sind temporär und werden nach dem Merge entfernt.
3. **Ein Zustandsbesitzer.** `world-store` hält Welt, Ledger, PRNG, Uhr und Save; `src/core/` bleibt headless. UI und Renderer lesen den Snapshot, sie führen keinen zweiten Spielzustand.
4. **Geld ist integer und gebucht.** VaCoins sind Mikro-Einheiten; jede Bewegung ist eine Ledger-Zeile, jede Quelle außer `EXTERNAL_WORLD` ist verboten.
5. **Determinismus ist Pflicht.** Kein `Math.random()`, `Date.now()`, `new Date()` oder Krypto-Zufall in Spielcode (`src/**`); Infrastruktur-Tooling darf Wall-Clock nur für Laufzeit, Timeouts und Logs nutzen, nie für Spielzustand, PRNG oder Seeds. Echte Zufälle nur über die benannten RNG-Streams und `entropySeed()`.
6. **Narrative folgt echten Übergängen.** Facts entstehen an Zustandsgrenzen, das Journal bleibt Spielerhistorie. Keine zweite Erzählmaschine, kein LLM im Spielpfad. Jeder neue Pool braucht einen Leser im Spiel (ein System, das ihn anzeigt), sonst ist der Text tot - das ist die Qualitätsseite dieser Regel. Die Mengenquoten (50 je Pool, 1500 gesamt, Schrumpf-Verbot) sind nur ihre Planungshilfe und werden von `verify:narrative-blocks` gemessen. Normativ ist dieser Absatz; die Tabelle in `docs/ROADMAP.md` ist die aktuelle Messung, kein zweites Regelwerk. Jeder Commit braucht mindestens einen neuen, im Manifest registrierten und in der Registry verdrahteten Textbaustein; Pools unter 50 werden zuerst gefüllt.
7. **Eine Testlinie.** Während der Arbeit gezielte Tests und `verify:light`; `turn:finish` macht standardmäßig nur den lokalen Preflight ohne Tests und ohne Typecheck. Der PR-Check ist optional; der lokale Vor-PR-Nachweis entscheidet über den Merge. `--tests`/`--verify` sind das Opt-in. Die Linie und die 17 Fälle stehen in [`docs/TESTING.md`](docs/TESTING.md).
8. **Doku gehört in den Commit.** Pflichtdokumente und Marker aktualisiert der Hook bzw. `docs:sync`; generierte Blöcke werden nie von Hand bearbeitet. Referenzen und Verträge stehen im [`docs/INDEX.md`](docs/INDEX.md).
9. **Lieferung nur über Branch und PR.** `turn:finish` validiert den Phasenwechsel, committet den Vertrag und pusht; der PR wird erzeugt/aktualisiert, der optionale PR-Check meldet nur, nächster Schritt ist `pretask`. Merge durch Mensch oder Agent nach lokalem Vor-PR-Nachweis, Review und exaktem Kopf; keine CI-Bedingung, kein Auto-Merge. `promote` bleibt ein manueller Status-/Notausgang, kein Merge-Akteur.
10. **Eine Eskalationsleiter.** `AUTO_FIX → LOCAL_GATE → REMOTE_CI → AGENT → BLOCKED`; nur echte Invarianten blockieren, alles andere wird ein Issue. `governance-issue` ist der einzige Schreiber für `ERR-4030`; Watcher und Auto-Resolve überspringen diesen Code. Keine zweite Klassifikation.

## Task-Vertrag

Der Vertrag liegt unter `.lane-claims/tasks/<taskId>.json` und ist die eine Wahrheit für Phase, offene Befunde, PR-Zustand und nächste Aktion. Er ist Lane-Werkzeug: keine Allowlist-Erweiterung, kein PIN, aber claim- und branchgebunden; `verify-task-contract` prüft beides. Phasen: `READY → IMPLEMENTING → CI_PENDING → MERGE_PENDING → AFTERCARE → DONE`. `CI_PENDING` ist nur der gepushte Zustand; der lokale Vor-PR-Nachweis ist die Autorität, kein Warten auf CI. `.verify-cache/task-state.json` bleibt Cache; `pretask` liest Vertrag, PR-Zustand und Issues und gibt `READY`, `CONTINUE`, `AFTERCARE`, `MERGE_PENDING` oder `BLOCKED` aus. `turn:finish` und `ci-plan` rufen dieselbe Validierung auf.

## Skalierbare Reparatur

- **Erst die Kette, dann der Schnitt.** Dead Code und Exporte werden nie blind entfernt. Vor jedem Schnitt werden Import-, Re-Export-, Namespace- und Aufruferketten verfolgt; betroffene Verbraucher werden repariert oder der Export bleibt. `verify:dead-code` und `turn:finish` verlangen die dokumentierte Chain-Trace.
- **Redundanz wird ausgeschlachtet.** Bei doppelten Quellen wird nicht nur geloescht: beide Verhalten werden verglichen, das bessere wird mit dem gemeinsamen Pfad zusammengefuehrt, und eine Wahrheit bleibt uebrig. `verify:redundancy` nennt diese Pflicht bei jedem Befund.
- **Hot Zone heisst modularisieren.** Jede Aenderung an einer Datei in der Hot Zone wird als Modularisierung umgesetzt: eigene Datei, klare Ownership, Budget und Test. Eine LOC-Erhoehung ist nur als `ASK_USER` mit Begruendung zulaessig, warum sie fachlich besser ist als die Extraktion; `check:loc` blockiert den direkten Weg.
- **PreTurn-Folgengate.** `pretask` liest offene Gate-Issues zuerst. Verlangt der Projekt-Scope sie vor der neuen Arbeit, beginnt die Anfrage als nummerierter Folgetask mit **Problem**, **Kurzbeschreibung**, **Loesungsansatz** und **Schwierigkeitsgrad**; vorher startet keine neue Lane-Arbeit.
- **Integration vor der CI.** `scripts/integrate.mjs --check` entscheidet vor den Gates zwischen `READY`, `REBASE_REQUIRED` und `MANUAL_CONFLICT`: `git fetch`, Claim-Gate und `git merge-tree`, keine Suite. Konflikte in generierten Artefakten werden regeneriert (`node scripts/sync-generated.mjs --all`), Konflikte in Handdateien nie. Der Pre-Push-Hook ruft denselben Controller; der Controller pusht nur per Fast-Forward, ein manueller Rebase-Push ist nur mit `--force-with-lease` erlaubt.
- **Abschluss integriert selbst.** Ist `origin/main` voraus, repariert `turn:finish` statt abzubrechen: ein unveroeffentlichter Branch laeuft durch `integrate --apply` (Rebase plus Regeneration), ein bereits gepushter Branch mergt die Basis (kein Umschreiben veroeffentlichter Historie). Nur ein Quellkonflikt eskaliert als `ERR-4008`; der Commit bleibt dabei immer erhalten.

## Zustand

- **Save:** v11 (`vcoin.casino.v11`), Migration von v5–v10; v3/v4 werden verworfen. Details in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
- **CI:** 15 lokale Required-Gates (davon `narrative`, `catalog` und `build`), Audit optional; acht Light-Gates, neun mit `affected`. Der Cloud-PR-Job ist optional. Die vollständige Liste steht in [`docs/CI.md`](docs/CI.md).
- **Workflows:** neun Dateien; `CI Verify`, `Ensure PR`, `Auto Version & Release`, `Long Checks`, `Build Android APK`, `PR Cleanup`, `Promote` und `PR Watcher` sind aktiv. `Promote` ist ein manueller Status-/Notausgang; `PR Watcher` reagiert nur auf `workflow_run`. `PR Escalation` bleibt deaktiviert; `Auto-Resolve` hängt an `RBD_AUTO_RESOLVE` (Default: aus).
- **Branch-Schutz:** klassischer Schutz auf `main`, keine Required-Status-Checks, `strict: false`, keine Rulesets; Force-Push und Löschen sind verboten. Der PR-Job `Fail-Closed Gates` ist optional. Details in [`docs/GOVERNANCE.md`](docs/GOVERNANCE.md).
- **Capabilities:** `docs/capabilities.json` ist ein Pflichtgate (`ERR-4025`); aktive Fähigkeiten brauchen einen registrierten Test.

## Befehle

| Befehl | Zweck |
| --- | --- |
| `pnpm run agent:new --json` | Ein Startvorgang: Branch, Claim, Task-Vertrag (Phase `READY`) und Pretask in einem Lauf. |
| `pnpm run agent:pretask --json` | Startblocker, Issue-Check, Impact, Claim und Worktree prüfen. |
| `pnpm run agent:context --json` | Systeme, Invarianten, betroffene Tests und Gate-Plan anzeigen; vollständige Fassung unter `.verify-cache/agent-context.json` (`--full`). |
| `pnpm run agent:feedback --json` | Aus dem echten Diff den nächsten sinnvollen Testschritt ableiten. |
| `pnpm run verify:light` | Lint, LOC, Typecheck, Doku, Tree und Redundanz. |
| `pnpm run verify:scope` | Nur der Diff gegen die Claim-Allowlist; keine Tests, kein Build, kein Typecheck. |
| `pnpm run verify:dev` | Light plus die betroffenen schnellen Tests. |
| `pnpm run verify:all` | Der lokale Vollnachweis: 15 Required-Gates plus Audit (16 Läufe). |
| `pnpm run turn:finish` | Phasenwechsel, Versions-Bump, Commit, Vertrag und Branch-Push; Standard ohne Tests/Typecheck, der optionale PR-Job prüft, der lokale Nachweis entscheidet. |
| `pnpm run docs:sync` | Doku-Marker kanonisieren: alte Versionsmarker werden ersetzt, fehlende ergaenzt. |
| `node scripts/sync-generated.mjs` | Inventur, Marker, Registry und Roadmap-Fortschritt aus ihren Generatoren neu erzeugen. |
| `node scripts/integrate.mjs --check` | Schnelle Integrationspruefung: `READY`, `REBASE_REQUIRED` oder `MANUAL_CONFLICT`. |
| `pnpm run claim:register` | Lane-Claim anlegen oder fortschreiben. |

## Build & test

- `pnpm run verify:light` für den schnellen Lauf; `pnpm run test:affected` für die vom Diff betroffenen Tests.
- Die vollständige Testlinie und die 17 Fälle stehen in [`docs/TESTING.md`](docs/TESTING.md).

## Delivery

- Arbeit auf der eigenen Lane; Commit und Push über `pnpm run turn:finish`, PR gegen `main` mit den drei Pflichtsektionen.
- Merge durch Mensch oder Agent nach lokalem Vor-PR-Nachweis und Review auf exaktem Kopf; der PR-Check ist optional, kein Direktpush, kein Force-Push, kein Auto-Merge. Details in [`docs/WORKFLOW.md`](docs/WORKFLOW.md).

**Wartezeiten sind Arbeitszeit.** Sleeps und Gate-Wartezeiten werden nie blind abgesessen: In derselben Zeit werden Check-/PR-Status geprüft, Inventur oder Doku nachgezogen, offene Befunde triagiert oder der nächste belegte Schritt vorbereitet. Neue Prozessregeln werden immer sofort in dieser `AGENTS.md` ergänzt, nicht nur im Chat festgehalten.

## Pflichtdoku

- Die zwölf Pflichtdokumente, Marker und Referenzen stehen in [`docs/INDEX.md`](docs/INDEX.md). In der Wurzel liegen nur `README.md` und `AGENTS.md`; anderes Markdown gehört unter `docs/`.
- `pnpm run docs:sync` ergänzt nur fehlende stabile Marker; vorhandene Marker und generierte Blöcke bleiben unangetastet. Kein Versions-/Zeitstempel-Churn mehr.
- Fehlende Doku wird automatisch im Hook bzw. bei `turn:finish` ergänzt; Lanes synchronisieren nicht mehr manuell.

## Referenzen

| Dokument | Inhalt |
| --- | --- |
| [`docs/INDEX.md`](docs/INDEX.md) | Einstieg, Doku-Landkarte und Vertragsindex. |
| [`docs/WORKFLOW.md`](docs/WORKFLOW.md) | Pretask, Resume, Arbeitsweise, Abschluss und manueller Merge. |
| [`docs/CI.md`](docs/CI.md) | Required-Gates, Zustände, Workflows, Branch-Schutz und Nachweise. |
| [`docs/GOVERNANCE.md`](docs/GOVERNANCE.md) | Rollen, Lanes, Claims, Register-Audit und Eskalation. |
| [`docs/TESTING.md`](docs/TESTING.md) | Die eine Testlinie, Testmatrix 1–17 und Zusatzregressionen. |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Zustandsbesitz, Pipeline, Verträge, Save und Narrative. |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Jetzt, als Nächstes, später; offene Punkte. |
| [`docs/contracts/README.md`](docs/contracts/README.md) | Index der sieben Kernverträge mit Writern und Tests. |
| [`docs/RUNBOOK-AUTO-RESOLVE.md`](docs/RUNBOOK-AUTO-RESOLVE.md) | Aktivierung und Prüfung von Auto-Resolve. |

<!-- rtk-instructions v2 -->
Werkzeugausgabe wird verdichtet. Primär: `pnpm run agent:pretask --json` — `context` verweist auf `.verify-cache/agent-context.json`; `pnpm run agent:context --json` nur nachfordern, wenn die Datei fehlt; Suche über `rg`.
<!-- /rtk-instructions -->
