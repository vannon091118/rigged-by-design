# Doku-Index

<!-- rbd-doc: managed -->

**Zweck:** Die Landkarte. `AGENTS.md` ist der Kurzvertrag; die folgenden Dokumente tragen das Tiefenwissen. Keine Regel wird hier dupliziert, nur verlinkt.

## Einstieg

| Dokument | Wofür |
| --- | --- |
| [`README.md`](../README.md) | Spiel, aktueller Stand, Setup und Entwicklerweg. |
| [`AGENTS.md`](../AGENTS.md) | Erster Befehl, zehn unverhandelbare Regeln, Zustand und Befehle. |
| [`WORKFLOW.md`](WORKFLOW.md) | Pretask, Resume, Abschluss, PR und manueller Merge. |
| [`TESTING.md`](TESTING.md) | Die eine Testlinie, Testmatrix 1–17 und Zusatzregressionen. |

## Referenzen

| Dokument | Wofür |
| --- | --- |
| [`CI.md`](CI.md) | 15 lokale Required-Gates, optionale Audit-Stufe, Zustände, drei Repository-Workflows und Branch-Schutz ohne Required-Status. |
| [`GOVERNANCE.md`](GOVERNANCE.md) | Rollen, Lanes, Claims, Register-Audit und Eskalation. |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Zustandsbesitz, Schichten, Pipeline, Save, Narrative und Fehlerregister. |
| [`DEPENDENCY-MATRIX.md`](DEPENDENCY-MATRIX.md) | Generierte Live-Dependency-Matrix; liegt bewusst ausserhalb der gesperrten Architektur. |
| [`ROADMAP.md`](ROADMAP.md) | Jetzt, als Nächstes, später; offene Punkte und PARKED. |
| [`RENDER_REWORK_PLAN.md`](RENDER_REWORK_PLAN.md) | Ausfuehrbare Task-Phasen R0–R12, Meilensteine M0–M4 und Preview-Sichtabnahme fuer sichtbare Slices. |
| [`RUNBOOK-AUTO-RESOLVE.md`](RUNBOOK-AUTO-RESOLVE.md) | Aktivierung, Token, Berechtigungen und erster verifizierter Auto-Resolve-Lauf. |

## Pflichtdokumente

Diese zwölf Dokumente tragen den `rbd-doc`-Marker und werden vom Pre-Commit-Hook bzw. `pnpm run docs:sync` aktualisiert:

| Dokument | Inhalt |
| --- | --- |
| [`INVENTORY.md`](INVENTORY.md) | Was existiert, was gelesen wurde, Befunde; Abdeckung gegen `git ls-files`. |
| [`CHANGELOG.md`](CHANGELOG.md) | Was sich je Version geändert hat. |
| [`DEVTAGEBUCH.md`](DEVTAGEBUCH.md) | Warum, mit Prüfungen und offenen Enden. |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | System- und Zustandsarchitektur. |
| [`ROADMAP.md`](ROADMAP.md) | Produktvertrag und Horizonte. |
| [`WORKFLOW.md`](WORKFLOW.md) | Pretask, Resume, Abschluss und manueller Merge. |
| [`TESTING.md`](TESTING.md) | Die eine Testlinie und die Testmatrix 1–17. |
| [`CI.md`](CI.md) | 15 lokale Required-Gates, Zustände, drei Repository-Workflows und Branch-Schutz ohne Required-Status. |
| [`GOVERNANCE.md`](GOVERNANCE.md) | Rollen, Claims, Register-Audit und Eskalation. |
| [`INDEX.md`](INDEX.md) | Diese Landkarte. |
| [`contracts/README.md`](contracts/README.md) | Index der sieben Kernverträge. |
| [`AGENTS.md`](../AGENTS.md) | Kurzvertrag und Referenzen. |

## Verträge

| Dokument | Inhalt |
| --- | --- |
| [`contracts/README.md`](contracts/README.md) | Index der sieben Kernverträge mit Writern und Vertragstests. |
| [`capabilities.json`](capabilities.json) | Capability-Inventar; aktive Fähigkeiten brauchen registrierte Tests. |
| [`contracts/actionset.md`](contracts/actionset.md) | ActionSet, ActionProvider und Kategorien. |
| [`contracts/actor-id.md`](contracts/actor-id.md) | Stabile Actor-IDs und Referenzregeln. |
| [`contracts/domain-event.md`](contracts/domain-event.md) | Unveränderliche Event-Hülle und ID-Aufbau. |
| [`contracts/factor.md`](contracts/factor.md) | Factor-IDs, Kontext und Contribution-Trace. |
| [`contracts/relationship.md`](contracts/relationship.md) | Gerichtete Beziehungen und Retention. |
| [`contracts/save.md`](contracts/save.md) | Save-Envelope, Versionierung und Migration. |
| [`contracts/world-time.md`](contracts/world-time.md) | Weltzeit, Ticks und Tagesgrenzen. |

## Pflege

- Marker und Pflichtabschnitte prüft `pnpm run verify:docs`; die generierte Dateiliste in `INVENTORY.md` entsteht aus `git ls-files`.
- Neue Referenzdokumente werden in diesem Index verlinkt und in `scripts/lib/doc-sync.mjs` registriert, sobald sie Pflichtabschnitte tragen.
- Ein neuer Vertrag braucht einen Eintrag in [`contracts/README.md`](contracts/README.md), einen Writer und einen Vertragstest.
