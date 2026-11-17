# Workflow

<!-- rbd-doc: managed -->

## Kern
**Lesen:** `rbd docs read` (5 Kerne + Test-/Governance-Kern, <10k Token); `rbd shell watch` erzwingt es interaktiv.
**Ein Lauf:** `rbd agent start --brief` → Issue + Claim → `rbd agent pretask --json` → `rbd agent context --json` → arbeiten → gezielt prüfen → `rbd claim preflight` → `rbd turn finish` → `rbd ci local` → PR → `RELEASE [A<n>] done <sha>`.
**Grenzen:** kein `main`-Push, kein Merge, kein Close, kein Force. Ein Issue pro Turn; fremdes WIP wird adoptiert.
**Tiefe:** [WORKFLOW-DETAIL.md](WORKFLOW-DETAIL.md).

## Ablauf
1. **Start:** Board, Claims und PRs live prüfen; Blocker zuerst lösen.
2. **Claim:** `CLAIM [A<n>] <agent> <UTC> scope=… plan=…` am Issue; lokal `rbd claim register`.
3. **Kontext:** Systeme, Invarianten, betroffene Tests und Gate-Plan lesen.
4. **Arbeit:** nur im Claim-Scope; generierte Dateien über ihre Generatoren.
5. **Prüfen:** Einzeltests, `test:affected`, `rbd verify scope`, `rbd verify light`; nur Doku: `rbd verify docs`.
6. **Abschluss:** `rbd turn finish` — Vertrag, Version, Preflight, Commit, Push.
7. **Übergabe:** PR gegen `main`, Review-Fragen beantworten, `RELEASE` + Label `review-waiting`.

## Abschluss
Der Maintainer prüft den exakten Kopf, entscheidet `ACCEPT`/`PARTIAL`/`REJECT`, merged und schließt. Agenten mergen nicht. Nach dem Merge bleiben Claim- und Task-Nachzug beim Maintainer; Nachweise stehen im PR, nicht im Chat.

## Referenzen
[AGENT-ONBOARDING](AGENT-ONBOARDING.md) · [GOVERNANCE](GOVERNANCE.md) · [CI](CI.md) · [TESTING](TESTING.md) · [WORKFLOW-DETAIL](WORKFLOW-DETAIL.md)
