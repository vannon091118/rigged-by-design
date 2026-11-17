# Doku-Index

<!-- rbd-doc: managed -->

## Kern
**Standard:** fünf Pflichtdokus mit `Kern` ≤500 Token.
**Wahrheit:** Issue > Datei, Code > Prosa. **Start:** `pnpm rbd agent start --brief`.

## Pflichtdokus
| Dokument | Inhalt |
| --- | --- |
| [AGENTS.md](../AGENTS.md) | Vertrag, zehn Regeln, Pitfalls. |
| [WORKFLOW.md](WORKFLOW.md) | Lauf, Abschluss, Übergabe. |
| [INDEX.md](INDEX.md) | Karte, Budgets, Ordner. |
| [ROADMAP.md](ROADMAP.md) | Major- und Minor-Ziele. |
| [LAST-CHANGES.md](LAST-CHANGES.md) | Letzte Änderungen. |

**Einstiege:** [TESTING](TESTING.md) · [GOVERNANCE](GOVERNANCE.md)

## Referenzen
- **Governance:** [GOVERNANCE](GOVERNANCE.md) · [AGENT-ONBOARDING](AGENT-ONBOARDING.md) · [PROMPTS](PROMPTS.md) · [FLAG](FLAG.md)
- **Technik:** [ARCHITECTURE](ARCHITECTURE.md) · [MECHANICS](MECHANICS.md) · [CI](CI.md) · [TESTING](TESTING.md) · [DEPENDENCY-MATRIX](DEPENDENCY-MATRIX.md)
- **UD:** [UD-01](UD-01.md) · [UD-13](UD-13.md) · [UD-21](UD-21.md) · [UD-27](UD-27.md)
- **Produkt/Historie:** [AUDIT](AUDIT.md) · [AUDIT-ARCHIVE](AUDIT-ARCHIVE-2026-11-16.md) · [LOC-REARCHITECTURE](LOC-REARCHITECTURE-2026-11-16.md) · [RENDER_REWORK_PLAN](RENDER_REWORK_PLAN.md) · [CHANGELOG](CHANGELOG.md) · [DEVTAGEBUCH](DEVTAGEBUCH.md) · [INVENTORY](INVENTORY.md)
- **Belege:** [Merge-Gate](evidence/p0-merge-gate-tagesbericht-2026-11-16.md) · [Weight-Tuning](evidence/living-world-weight-tuning.md) · [Doku-System](evidence/docsystem-2026-11-17.md) · [WORKFLOW-DETAIL](WORKFLOW-DETAIL.md)
- **Verträge:** [Index](contracts/README.md)

## Ordner
Owner: [CODEOWNERS](../.github/CODEOWNERS).
**Spiel:** `src/core/` (ohne `governance`), `src/render/`, `src/ui/`, `src/store/`, `src/Config/`, `src/debug/`, `src/styles/`, `src/test/`, `content/`, `public/`.
**Dev:** `scripts/`, `bin/`, `packages/`, `src/core/governance/` (Tests).
**Governance:** `AGENTS.md`, `docs/`, `.github/`, `.claude/`, `.githooks/`, `.cron/`, `.lane-claims/`, `.lanes/`, `artifacts/`.
