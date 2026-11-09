# Workflow: von Pretask bis zum manuellen Merge

<!-- rbd-doc: v0.3.198 | 2026-11-09 18:36 UTC -->

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
5. die Worktree-Isolation.

Ein offenes `gate-failure`-Issue, ein nicht leerer Baum, ein fehlender Impact-Plan oder ein Claim-Problem enden mit `ERR-4019`, bevor der erste Edit passiert. Ohne `--json` gilt dieselbe Prüfung; `--json` ist die maschinenlesbare Form für Agenten.

### Claim und Worktree

Jede Lane außer `main` arbeitet in einem verknüpften Worktree und braucht einen Claim in `.lane-claims/`. Der Claim nennt:

- `id` und `branch` nach `lane/<domäne>/<task>` (Legacy: `gov/`, `hygiene/`, `fix/`),
- Owner aus dem festen Roster,
- `baseSha` als Startpunkt, nicht als Merge-Beleg,
- die Pfad-Allowlist,
- optionale Contract-Writer.

Ein neuer, unabhängiger Task bekommt einen neuen Branch und einen neuen Claim. Keine Sammelbranches, kein Direktpush auf `main`. Ein bereits gemergter Claim bleibt über `selectClaim()` für den Register-Nachtrag nutzbar; er wird nicht wieder geöffnet.

### Resume statt Aufräumen

Ein unterbrochener Task wird mit demselben Worktree und demselben Claim fortgesetzt. Eigene Änderungen innerhalb der Allowlist sind erlaubt; der Modus wird `RESUME`, der Scope `SCOPE_VALID`. Fremde WIP außerhalb des Claims bleibt unangetastet und wird als Blockermeldung genannt.

Verboten sind die Abkürzungen, die fremde Arbeit oder den eigenen Verlauf zerstören:

- `git reset --hard`,
- `git clean -fd`,
- `git stash` als Konfliktlöser,
- `git push --force`,
- `git branch -D`.

Ein Abbruch ist kein Grund für einen Reset: Dateien, Claim und Worktree bleiben liegen; der nächste Pretask entscheidet über Resume oder einen neuen Task.

## Arbeitsablauf

1. **Pretask:** `pnpm run agent:pretask --json`; Blockermeldungen zuerst lösen.
2. **Kontext:** `pnpm run agent:context --json` für Systeme, Invarianten, betroffene Tests und Gate-Plan. Das ist eine Anzeige, keine Prüfung.
3. **Claim prüfen:** Der eigene Claim deckt jeden geänderten Pfad. Fremde Claims und Pfad-Überschneidungen blockieren.
4. **Arbeiten:** Nur im eigenen Worktree und innerhalb der Allowlist. Generierte Dateien werden über ihre Generatoren geändert, nie von Hand.
5. **Gezielt prüfen:** Einzelne Tests, `pnpm run test:affected` oder `pnpm run verify:light`. Die Auswahl ist Entwicklungsfeedback, kein Vollnachweis.
6. **Abschluss:** `pnpm run turn:finish`; Details unten.

### Was während der Arbeit nicht passiert

- Kein `git add -A` und kein globales Staging; `turn:finish` setzt nur Claim-Pfade und Versionsdateien in den Index.
- Kein wiederholter Lauf desselben Nachweises, nur weil das Ergebnis unbequem ist.
- Keine Reparatur über ein Verify-Gate: Reparaturen laufen über `pnpm run fix`; Verify bleibt lesend.
- Keine fremden Branch- oder Issue-Operationen; der Monitor beobachtet nur.

## Abschluss

`pnpm run turn:finish` ist der Normalfall:

1. betroffene schnelle Tests aus dem Impact vor dem Versions-Bump,
2. Patch-Version bumpen,
3. `verify:light` ausführen,
4. nur Claim-Pfade plus Versionsdateien stagen,
5. Commit mit den drei Pflichtsektionen erstellen,
6. den Arbeitsbranch pushen; `main` wird nie direkt gepusht.

`--profile=quick` nimmt die schnelle halbe Suite mit, `--profile=full` ist die lokale Ausnahme für Geld-, Ledger-, RNG- und Save-Migrationscode sowie Releases. Die schwere Suite und Audit bleiben in CI.

### Commit und PR

Der Commit-Body trägt exakt:

```text
### Changes (Was ist neu)
### Technische Basis & Kausalität
### Ausblick (Nächste Schritte)
```

ASCII-Varianten wie `Kausalitaet` oder `Naechste` sind rot (`ERR-4006`). Der PR-Body wird aus demselben Text gebildet; fehlende Sektionen ergänzt nur der markierte Automationsbereich.

Der Merge nach `main` ist manuell:

1. PR gegen `main` öffnen oder aktualisieren.
2. `CI Verify` auf dem exakten Kopf abwarten; der Pflichtstatus ist `Fail-Closed Gates`.
3. Erst bei grünem Lauf manuell mergen.
4. Die Merge-Nachricht trägt dieselben drei Sektionen wörtlich; `commitmsg` läuft im Zustand `MAIN` gegen den Kopf des Push und prüft genau diese Nachricht. Die GitHub-Voreinstellung `Merge pull request #<n> from <branch>` ist dort rot (`ERR-4006`), weil ihr die Sektionen fehlen.
5. Kein Auto-Merge, kein `promote`, kein `integration`-Dump als Normalweg.

`promote.yml` ist derzeit manuell deaktiviert. Der klassische Branch-Schutz auf `main` bleibt die letzte Instanz; Details in [`CI.md`](CI.md#branch-schutz) und [`GOVERNANCE.md`](GOVERNANCE.md#branch-schutz).

### After-Task

- Belege dokumentieren: welcher Befehl, welches Ergebnis, was nicht geprüft werden konnte.
- PR oder Issue als Übergabe nutzen, nicht einen Statusbericht im Chat.
- Gemergte Wegwerf-Branches nur über den dafür vorgesehenen Cleanup entfernen; fremde Branches bleiben stehen.
- Ein geschlossener, nicht gemergter PR wird nur gelöscht, wenn er nachweislich ersetzt und alle einzigartigen Commits gesichert sind.

## Referenzen

- [`AGENTS.md`](../AGENTS.md) — Kurzvertrag und zehn Regeln.
- [`CI.md`](CI.md) — Required-Gates, Zustände und Workflow-Wahrheit.
- [`GOVERNANCE.md`](GOVERNANCE.md) — Claims, Rollen, Register-Audit und Eskalation.
- [`TESTING.md`](TESTING.md) — die eine Testlinie und die 17 Fälle.
- [`INDEX.md`](INDEX.md) — vollständige Doku-Landkarte.
