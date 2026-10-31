# CI-Gates und Main-Schutz

Zwei Ebenen, unabhaengig voneinander. Ebene A liegt im Repository, Ebene B ist
eine GitHub-Einstellung, die kein Commit aendern kann.

## Modi

| Modus | Aufruf | Verhalten |
| --- | --- | --- |
| verify | `npm run verify`, `npm run verify:all`, `npm run verify:release` | liest ausschliesslich; kein Gate schreibt, ein veralteter Baum wird rot |
| fix | `npm run fix`, `npm run fix:all` | ESLint `--fix` und Dependency-Matrix, danach dieselben Gates; nennt jede geaenderte und jede geloeschte Datei |
| verify nach fix | `npm run verify:all` | prueft den reparierten Baum; ein zweiter Fix-Lauf meldet „keine Aenderung“ |

`npm run fix` ist idempotent: der Lauf vergleicht `git status --porcelain` vor
und nach dem Autofix und listet `+ neu`, `~ geaendert` und `- geloescht`.
Geloescht wird nur, was ein Werkzeug selbst entfernt; `autofix-0911` raeumt
keine Screenshot-Ordner mehr auf.

## Ebene A: Workflows

- `ci-verify.yml` laeuft auf jedem Push (`branches: ['**']`, also auch `main`),
  auf Pull Requests gegen `main` und ueber `workflow_dispatch`. Der Job heisst
  **`Fail-Closed Gates`**; dieser Name ist der Pflichtstatus aus Ebene B.
- `auto-version-release.yml` hat keine Nachrichten-Bedingung mehr. Jeder Lauf
  fuehrt `verify:release` aus, bevor `scripts/ci-tag-release.mjs` taggt; ein
  rotes Gate verhindert Tag und Release.
- Beide Workflows rufen nur lesende Profile auf. Der Release-Workflow baut
  damit keinen Zustand, den er anschliessend prueft.

Grenze von Ebene A: Enthaelt eine Commit-Nachricht `[skip ci]` oder `[ci skip]`,
startet GitHub **keinen** Workflow. Das laesst sich auf Workflow-Ebene nicht
abfangen. Der Skip ist nur dann harmlos, wenn Ebene B aktiv ist: dann fehlt der
Pflichtstatus und der Commit kommt nicht durch den Merge.

## Ebene B: Ruleset fuer `main`

Stand 31.10.2026 im Repository **nicht aktiv**: die GitHub-API meldet fuer
`main` keine Branch-Protection und keine Rulesets. Bis das Ruleset aktiv ist,
kann ein Direktpush auf `main` die Pflichtpruefung umgehen.

Einmalig in GitHub setzen (Settings → Rules → New branch ruleset) oder per API:

```json
{
  "name": "main-protect",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["refs/heads/main"], "exclude": [] } },
  "rules": [
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": true,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "required_status_checks": [{ "context": "Fail-Closed Gates" }]
      }
    },
    { "type": "non_fast_forward" },
    { "type": "deletion" }
  ]
}
```

Damit gilt: Pull Request erforderlich, gruener Pflichtstatus aus dem richtigen
Workflow, keine Force-Pushes, keine Branch-Loeschung, keine Direktpushes.

## Abnahme

| Kriterium | Nachweis |
| --- | --- |
| Direkter Push auf `main` blockiert | Ebene B, `non_fast_forward` + `pull_request` |
| `[skip ci]` umgeht die Pflichtpruefung nicht | Ebene B, `required_status_checks` |
| Release ohne gruenes Verify verhindert | `auto-version-release.yml` Schritt „Alle Gates vor Release“ |
| PR ohne Pflichtstatus nicht mergebar | Ebene B, `required_status_checks` |
| Verify veraendert keinen Arbeitsbaum | `npm run verify:all` fuehrt keinen Autofix aus (`scripts/lib/pipeline-plan.mjs`) |
| Fix meldet jede Aenderung | `scripts/lib/tree-changes.mjs`, `npm run fix` |
| Zweiter Verify-Lauf reproduzierbar | Gate-Cache auf Inhalts-Hash; Fix-Lauf meldet „keine Aenderung“ |
