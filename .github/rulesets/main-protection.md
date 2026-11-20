# Branch-Protection Ruleset — main (FREEZE-0)

## Status: dokumentiert (lokale Spezifikation, serverseitig durch GitHub zu setzen)

### Ruleset: main-protection

| Eigenschaft | Wert |
|-------------|------|
| Name | `main-protection` |
| Target | `branch` |
| Enforcement | `active` |
| Include | `refs/heads/main` |

### Required Rules

| Regel | Wert | Begründung |
|-------|------|------------|
| Pull Request erforderlich | Ja (1 Approving Review) | Review-Pflicht, kein direkter Push auf main |
| Dismiss stale reviews on push | Ja | Frische Reviews nach jedem Push |
| Require Code Owner reviews | Ja | CODEOWNERS-Einträge werden geprüft |
| Bypass actors | `vannon091118` (Owner, immer) | Owner-Principal behält Merge-Capability |
| Required status checks | `typecheck`, `lint`, `verify:light` | Minimaler Gate, nicht leer |
| Strict checks | Ja | Alle Checks müssen grün sein |
| Non fast-forward | Ja | Keine Force-Pushes auf main |
| Admin enforced | Ja | enforce_admins, kein Bypass durch Admins |

### Bypass-Regeln

Keine zusätzlichen Bypass-Actors außer Owner `vannon091118`. Das verhindert ein zweites lokales Merge-System.

### FREEZE-0-Hinweis

Kein zweites lokales Merge-System außerhalb von GitHub Branch Protection + CODEOWNERS. Owner-Principal (`vannon091118`) behält Merge-Capability als finale Instanz.

### zugehörige Dateien

- `.github/CODEOWNERS` — Owner je Kontrollpfad (alle auf `@vannon091118`, Rollentrennung dokumentiert)
- `.lane-claims/actors.json` — Maintainer-Rolle explizit: `vannon091118-maintainer` (dokumentiert-kosmetisch), Owner `vannon091118` (finale Instanz)
- `scripts/lib/merge-gate.mjs` — serverseitiger Zustand von `main`, reproduzierbarer Bericht
- `scripts/lib/promote-merge.mjs` — Merger mit Task-Vertrag-Prüfung (Gap: Legacy-Merge bei fehlendem Vertrag nur Warnung, nicht fail-closed — siehe Gap #3 in STV-P0-FREEZE0-DECISION.md)

### Exit-Kriterien (P0)

1. `GET /repos/.../rulesets` liefert mindestens 1 aktives, auf main anwendbares Ruleset mit `pull_request` + `required_status_checks` + `non_fast_forward` + Bypass-Policy
2. `actors.json` stimmt mit Live-Repo-Berechtigungen überein (kein admin-Worker-Double-Listing)
3. `promote-merge.mjs` liefert bei fehlendem Task-Vertrag KEINEN Merge (fail-closed) — Nachweis: 1 Negativ-Test
4. Diese Datei + Exit-Belege (API-Response, PR-SHA) in `board:sync` dokumentiert