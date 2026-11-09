# Rigged by Design

<!-- rbd-doc: v0.3.198 | 2026-11-09 18:53 UTC -->

> **Erster Befehl:** `pnpm run agent:pretask --json`

Dieser Kurzvertrag ist der Einstieg. Tiefenwissen steht in den Referenzdokumenten unter `docs/`; sie sind die einzige Quelle für Abläufe, Gate-Listen und Governance-Details. Kein zweiter Langtext hier.

## Zehn unverhandelbare Regeln

1. **Pretask zuerst.** Vor dem ersten Edit `pnpm run agent:pretask --json`; ein offenes `gate-failure`-Issue, ein nicht leerer Baum, ein fehlender Impact-Plan oder ein Claim-Problem blockieren den Start (`ERR-4019`). Jede Lane außer `main` braucht einen verknüpften Worktree.
2. **Eigene Lane, fremde WIP bleibt liegen.** Nur der eigene Claim und die eigene Pfad-Allowlist; fremde Änderungen werden weder gestaged noch „aufgeräumt“. Kein Direktpush auf `main`, kein Force-Push, kein Branch-Löschen, kein Stash/Reset/Clean als Abkürzung.
3. **Ein Zustandsbesitzer.** `world-store` hält Welt, Ledger, PRNG, Uhr und Save; `src/core/` bleibt headless. UI und Renderer lesen den Snapshot, sie führen keinen zweiten Spielzustand.
4. **Geld ist integer und gebucht.** VaCoins sind Mikro-Einheiten; jede Bewegung ist eine Ledger-Zeile, jede Quelle außer `EXTERNAL_WORLD` ist verboten.
5. **Determinismus ist Pflicht.** Kein `Math.random()`, `Date.now()`, `new Date()` oder Krypto-Zufall in `src/**` und `scripts/**`; echte Zufälle nur über die benannten RNG-Streams und `entropySeed()`.
6. **Narrative folgt echten Übergängen.** Facts entstehen an Zustandsgrenzen, das Journal bleibt Spielerhistorie. Keine zweite Erzählmaschine, kein LLM im Spielpfad. Jeder Commit braucht mindestens einen neuen, im Manifest registrierten und in der Registry verdrahteten Textbaustein; Pools unter 50 werden zuerst gefüllt (`verify:narrative-blocks`).
7. **Eine Testlinie.** Während der Arbeit gezielte Tests und `verify:light`; `turn:finish` prüft die betroffenen schnellen Tests, die volle Suite läuft in CI. Die Linie und die 17 Fälle stehen in [`docs/TESTING.md`](docs/TESTING.md).
8. **Doku gehört in den Commit.** Pflichtdokumente und Marker aktualisiert der Hook bzw. `docs:sync`; generierte Blöcke werden nie von Hand bearbeitet. Referenzen und Verträge stehen im [`docs/INDEX.md`](docs/INDEX.md).
9. **Lieferung nur über Branch und PR.** `turn:finish` committet und pusht den Arbeitsbranch; danach PR gegen `main` mit den drei Pflichtsektionen und **manueller Merge** nach grünem `CI Verify` auf dem exakten Kopf. `promote` ist deaktiviert.
10. **Eine Eskalationsleiter.** `AUTO_FIX → LOCAL_GATE → REMOTE_CI → AGENT → BLOCKED`; nur echte Invarianten blockieren, alles andere wird ein Issue. Keine zweite Klassifikation.

## Zustand

- **Save:** v11 (`vcoin.casino.v11`), Migration von v5–v10; v3/v4 werden verworfen. Details in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
- **CI:** 12 Required-Gates, Audit optional; sechs Light-Gates, sieben mit `affected`. Die vollständige Liste steht in [`docs/CI.md`](docs/CI.md).
- **Workflows:** neun Dateien; `CI Verify`, `Auto Version & Release`, `Long Checks`, `Build Android APK` und `PR Cleanup` sind aktiv. `Promote`, `PR Watcher` und `PR Escalation` sind derzeit manuell deaktiviert; `Auto-Resolve` hängt an `RBD_AUTO_RESOLVE`.
- **Branch-Schutz:** klassischer Schutz auf `main`, Pflichtstatus `Fail-Closed Gates`, `strict: false`, keine Rulesets; Force-Push und Löschen sind verboten. Details in [`docs/GOVERNANCE.md`](docs/GOVERNANCE.md).
- **Capabilities:** `docs/capabilities.json` ist ein Pflichtgate (`ERR-4025`); aktive Fähigkeiten brauchen einen registrierten Test.

## Befehle

| Befehl | Zweck |
| --- | --- |
| `pnpm run agent:pretask --json` | Startblocker, Issue-Check, Impact, Claim und Worktree prüfen. |
| `pnpm run agent:context --json` | Systeme, Invarianten, betroffene Tests und Gate-Plan anzeigen. |
| `pnpm run agent:feedback --json` | Aus dem echten Diff den nächsten sinnvollen Testschritt ableiten. |
| `pnpm run verify:light` | Lint, LOC, Typecheck, Doku, Tree und Redundanz. |
| `pnpm run verify:dev` | Light plus die betroffenen schnellen Tests. |
| `pnpm run verify:all` | Der lokale Vollnachweis: 12 Required-Gates plus Audit. |
| `pnpm run turn:finish` | Betroffene Tests, Versions-Bump, Light-Gate, Commit und Branch-Push. |
| `pnpm run docs:sync` | Marker in allen Pflichtdokumenten aktualisieren. |
| `pnpm run claim:register` | Lane-Claim anlegen oder fortschreiben. |

## Build & test

- `pnpm run verify:light` für den schnellen Lauf; `pnpm run test:affected` für die vom Diff betroffenen Tests.
- Die vollständige Testlinie und die 17 Fälle stehen in [`docs/TESTING.md`](docs/TESTING.md).

## Delivery

- Arbeit auf der eigenen Lane; Commit und Push über `pnpm run turn:finish`, PR gegen `main` mit den drei Pflichtsektionen.
- Merge manuell nach grünem `CI Verify`; kein Direktpush, kein Force-Push, kein Auto-Merge. Details in [`docs/WORKFLOW.md`](docs/WORKFLOW.md).

**Wartezeiten sind Arbeitszeit.** Sleeps und Gate-Wartezeiten werden nie blind abgesessen: In derselben Zeit werden Check-/PR-Status geprüft, Inventur oder Doku nachgezogen, offene Befunde triagiert oder der nächste belegte Schritt vorbereitet. Neue Prozessregeln werden immer sofort in dieser `AGENTS.md` ergänzt, nicht nur im Chat festgehalten.

## Pflichtdoku

- Die zwölf Pflichtdokumente, Marker und Referenzen stehen in [`docs/INDEX.md`](docs/INDEX.md).
- `pnpm run docs:sync` aktualisiert die Marker; generierte Blöcke bleiben unangetastet.

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
Werkzeugausgabe wird verdichtet. Primär: `pnpm run agent:pretask --json`; danach `pnpm run agent:context --json`; Suche über `rg`.
<!-- /rtk-instructions -->
