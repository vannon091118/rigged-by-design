# Workflow: von Pretask bis zum manuellen Merge

<!-- rbd-doc: managed -->

**Zweck:** Der verbindliche Arbeitsablauf für Agenten und Menschen. `AGENTS.md` ist der Kurzvertrag; dieses Dokument trägt die Details, ohne die Gate-Liste aus [`CI.md`](CI.md) zu wiederholen.

## Einstieg

Der erste Befehl vor jedem Edit ist:

```bash
pnpm run agent:pretask --json
```

Der Lauf prüft in dieser Reihenfolge:

1. offene `gate-failure`-Issues und den Issue-Status (ohne `gh` bleibt er als `unknown` sichtbar),
2. den Arbeitsbaum und laufende Merges/Rebases,
3. den Impact-Plan aus `agent:context`,
4. den Lane-Claim mit Owner, Basis-SHA und Pfad-Allowlist,
5. den Task-Vertrag unter `.lane-claims/tasks/<taskId>.json` und den PR-Zustand,
6. die Worktree-Isolation.

Vor dem ersten Diff aktualisiert `pretask` `origin/main`: ein Fetch pro Minute, in CI aus, nie blockierend. Schlägt der Fetch fehl, bleibt der vorhandene Ref stehen und die Warnung nennt den Grund; der Lauf blockiert nicht. `claim:register`, `agent:new` und die Testauswahl (`changedFiles()`) nutzen denselben Helfer, damit keine Stelle gegen einen veralteten Ref rechnet.

Ein offenes `gate-failure`-Issue, ein fehlender Impact-Plan, korrupte WIP oder ein Claim-Problem enden mit `ERR-4019`/`ERR-4030`, bevor der erste Edit passiert; adoptierbare WIP blockiert nicht. Ohne `--json` gilt dieselbe Prüfung; `--json` ist die maschinenlesbare Form für Agenten.

### Claim und Worktree

Jede Lane außer `main` braucht einen Claim in `.lane-claims/`; ein verknüpfter Worktree ist optional und nur mit `--require-worktree` Pflicht. Der Claim nennt:

- `id` und `branch` nach `lane/<domäne>/<task>` (Legacy: `gov/`, `hygiene/`, `fix/`),
- Owner aus dem festen Roster,
- `baseSha` als Startpunkt, nicht als Merge-Beleg,
- die Pfad-Allowlist,
- optionale Contract-Writer.

Ein neuer, unabhängiger Task bekommt einen neuen Branch und einen neuen Claim. Keine Sammelbranches, kein Direktpush auf `main`. Ein bereits gemergter Claim bleibt über `selectClaim()` für den Register-Nachtrag nutzbar; er wird nicht wieder geöffnet.

### Task-Vertrag

Der Task-Vertrag ist die Wahrheit des Laufs, nicht der Chat und nicht der Cache. Er liegt unter `.lane-claims/tasks/<taskId>.json` und nennt Phase, offene Befunde, PR-Zustand und die nächste Aktion. Er ist Lane-Werkzeug wie Claim und Freigabe: keine Allowlist-Erweiterung, kein PIN, aber an Claim und Branch gebunden. Phasen:

| Phase | Bedeutung |
| --- | --- |
| `READY` | beschrieben, noch kein lokaler Turn |
| `IMPLEMENTING` | Arbeit läuft, noch nicht gepusht |
| `CI_PENDING` | gepusht; der PR-Lauf ist die Autorität |
| `MERGE_PENDING` | PR-Lauf grün, Merge steht an |
| `AFTERCARE` | gemergt, Nachsorge offen |
| `DONE` | abgeschlossen; neue Arbeit = neue Lane |

`pretask` gibt daraus `READY`, `CONTINUE`, `AFTERCARE`, `MERGE_PENDING` oder `BLOCKED` aus. Bei `CI_PENDING` schlägt es eine unabhängige parallele Lane vor, statt zu warten. Ein fehlender Vertrag bleibt für Legacy-Lanes startbar; `--require` macht ihn für neue Gates verpflichtend. `turn:finish`, `ci-plan` und `promote` rufen dieselbe Validierung auf.

### Resume statt Aufräumen

Ein unterbrochener Task wird mit demselben Worktree und demselben Claim fortgesetzt. Eigene, fremde und unvollständige Änderungen werden adoptiert; der Modus wird `RESUME`, der Scope `SCOPE_VALID`. Nur korrupte WIP (Governance ohne Freigabe, Ledger/Save/RNG/Boot) blockiert.

Verboten sind die Abkürzungen, die fremde Arbeit oder den eigenen Verlauf zerstören:

- `git reset --hard`,
- `git clean -fd`,
- `git stash` als Konfliktlöser,
- `git push --force`,
- `git branch -D`.

Ein Abbruch ist kein Grund für einen Reset: Dateien, Claim und Worktree bleiben liegen; der nächste Pretask entscheidet über Resume oder einen neuen Task.

## Arbeitsablauf

1. **Pretask:** `pnpm run agent:pretask --json`; Blockermeldungen zuerst lösen.
2. **Kontext:** `pnpm run agent:context --json` für Systeme, Invarianten, betroffene Tests und Gate-Plan. Das ist eine Anzeige, keine Prüfung. Die JSON-Fassung ist die Agentensicht; die vollständige Ausgabe liegt unter `.verify-cache/agent-context.json` (`--full`), und `pretask --json` verweist unter `context` darauf.
3. **Claim prüfen:** Der eigene Claim deckt jeden geänderten Pfad. Fremde Claims und Pfad-Überschneidungen blockieren.
4. **Arbeiten:** Im Claim-Scope (Worktree optional); adoptierte WIP wird als eigene Arbeit fertiggebaut. Generierte Dateien werden über ihre Generatoren geändert, nie von Hand.
5. **Gezielt prüfen:** Einzelne Tests, `pnpm run test:affected`, `pnpm run verify:scope` für den reinen Diff-Scope oder `pnpm run verify:light`. Die Auswahl ist Entwicklungsfeedback, kein Vollnachweis.
6. **Abschluss:** `pnpm run turn:finish`; Details unten.

### Was während der Arbeit nicht passiert

- Kein `git add -A` und kein globales Staging; `turn:finish` setzt nur Claim-Pfade und Versionsdateien in den Index.
- Kein wiederholter Lauf desselben Nachweises, nur weil das Ergebnis unbequem ist.
- Keine Reparatur über ein Verify-Gate: Reparaturen laufen über `pnpm run fix`; Verify bleibt lesend.
- Keine fremden Branch- oder Issue-Operationen; der Monitor beobachtet nur.

## Abschluss

`pnpm run turn:finish` ist der Normalfall (Standard ohne Tests/Typecheck):

1. den Task-Vertrag validieren und den Phasenwechsel nach `CI_PENDING` prüfen,
2. Patch-Version bumpen,
3. nur den lokalen Preflight ausführen: standardmäßig keine Tests und kein Typecheck, die CI prüft den gepushten Kopf,
4. nur Claim-Pfade, Vertrag und Versionsdateien stagen,
5. Commit mit den drei Pflichtsektionen erstellen,
6. den Arbeitsbranch pushen; `main` wird nie direkt gepusht,
7. den Vertrag im PR-Kommentar spiegeln und mit `pretask` fortsetzen.

`--tests` nimmt die betroffenen schnellen Tests mit, `--verify` den Light-Lauf; `--profile=quick` und `--profile=full` bleiben die breiteren Opt-ins für Geld-, Ledger-, RNG- und Save-Migrationscode sowie Releases. Die schwere Suite und Audit bleiben in CI.

### Commit und PR

Der Commit-Body trägt exakt:

```text
### Changes (Was ist neu)
### Technische Basis & Kausalität
### Ausblick (Nächste Schritte)
```

ASCII-Varianten wie `Kausalitaet` oder `Naechste` sind rot (`ERR-4006`). Der PR-Body wird aus demselben Text gebildet; fehlende Sektionen ergänzt nur der markierte Automationsbereich.

`turn:finish` endet mit „PR wird erzeugt/aktualisiert; CI meldet; nächster Schritt: PRETASK“, nicht mit einem Merge-Auftrag. Der Merge nach `main` liegt ausschließlich bei `promote`:

1. PR gegen `main` öffnen oder aktualisieren; `turn:finish` staged den Vertrag und spiegelt ihn im PR-Kommentar.
2. `CI Verify` auf dem exakten Kopf abwarten; der Pflichtstatus ist `Fail-Closed Gates`.
3. `promote` lädt das `ci-plan`-Artefakt genau dieses PR-Laufs und prüft Kopf, Basis, Pflichtstatus, Task-Vertrag und BLOCKED-Issues im Scope.
4. `holdMerge=true`, `status≠READY_FOR_MERGE`, offene Blocker oder eine veraltete Basis führen zu Hold; bei veralteter Basis aktualisiert `promote` den Branch per `update-branch` und wartet auf den neuen Lauf.
5. Nur bei `READY_FOR_MERGE` und exaktem Kopf: `gh pr merge --squash --match-head-commit <sha>`; kein `--auto`, kein `update-branch` vor dem Merge.
6. Die Merge-Nachricht trägt dieselben drei Sektionen wörtlich; `commitmsg` läuft im Zustand `MAIN` gegen den Kopf des Push und prüft genau diese Nachricht. Die GitHub-Voreinstellung `Merge pull request #<n> from <branch>` ist dort rot (`ERR-4006`), weil ihr die Sektionen fehlen.

Der klassische Branch-Schutz auf `main` bleibt die letzte Instanz; Details in [`CI.md`](CI.md#branch-schutz) und [`GOVERNANCE.md`](GOVERNANCE.md#branch-schutz).

### After-Task

- Belege dokumentieren: welcher Befehl, welches Ergebnis, was nicht geprüft werden konnte.
- Task-Vertrag und PR-Kommentar als Übergabe nutzen; der Cache ist keine Wahrheit.
- PR oder Issue als Übergabe nutzen, nicht einen Statusbericht im Chat.
- Gemergte Wegwerf-Branches nur über den dafür vorgesehenen Cleanup entfernen; fremde Branches bleiben stehen.
- Ein geschlossener, nicht gemergter PR wird nur gelöscht, wenn er nachweislich ersetzt und alle einzigartigen Commits gesichert sind.

## Referenzen

- [`AGENTS.md`](../AGENTS.md) — Kurzvertrag und zehn Regeln.
- [`CI.md`](CI.md) — Required-Gates, Zustände und Workflow-Wahrheit.
- [`GOVERNANCE.md`](GOVERNANCE.md) — Claims, Rollen, Register-Audit und Eskalation.
- [`TESTING.md`](TESTING.md) — die eine Testlinie und die 17 Fälle.
- [`INDEX.md`](INDEX.md) — vollständige Doku-Landkarte.
