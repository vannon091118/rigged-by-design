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
- `auto-version-release.yml` startet per `workflow_run` erst nach einem
  erfolgreichen `CI Verify`-Lauf auf `main`. Er taggt genau den geprueften
  Commit und wiederholt die Suite nicht. Nur `workflow_dispatch` fuehrt
  `verify:release` selbst aus, weil ein manueller Lauf keinen CI-Lauf hat.
- Die automatischen Laeufe rufen nur lesende Profile auf; der Tag ist der
  einzige externe Schreibvorgang. `build-apk.yml` ueberspringt die Suite nur,
  wenn der Aufrufer `skip_verify: true` setzt; manuelle Laeufe und Tag-Pushes
  pruefen weiterhin selbst.
- `pr-cleanup.yml` loescht nach einem Merge den Head-Branch am Remote. Weil der
  Merge den Pflichtstatus **`Fail-Closed Gates`** voraussetzt, ist "gemergt"
  hier immer "gemergt mit gruenen Gates". `main`, Fork-Branches und Pull
  Requests mit dem Label `keep-branch` bleiben unberuehrt. Lokal raeumt
  `npm run branches:prune` jeden nach `main` gemergten Branch ab; `turn:finish`
  ruft das nach dem Push selbst auf. Offene Arbeit und `main` bleiben stehen.
- `long-checks.yml` ist rein manuell (`workflow_dispatch`) und traegt die teuren
  Nachweise: Statistik (RTP, Poker-Verteilung), Soak, Balance und Benchmarks.
  `npm run ci:long` startet ihn, wartet auf das Ergebnis und laedt den
  Balance-Bericht als Artefakt; lokal laufen diese Klassen nie mit.

Grenze von Ebene A: Enthaelt eine Commit-Nachricht `[skip ci]` oder `[ci skip]`,
startet GitHub **keinen** Workflow. Das laesst sich auf Workflow-Ebene nicht
abfangen. Der Skip ist nur dann harmlos, wenn Ebene B aktiv ist: dann fehlt der
Pflichtstatus und der Commit kommt nicht durch den Merge.

## Ebene B: Ruleset fuer `main`

Stand 31.10.2026 im Repository **aktiv**: `main` verlangt einen Pull Request
und den Pflichtstatus **`Fail-Closed Gates`**, verbietet Force-Pushes und das
Loeschen des Branches. Ein Direktpush endet deshalb mit `GH006`; dann den
Arbeitsbranch pushen und einen fokussierten PR mergen.

Der Merge-Commit wird von `verify-commit-msg --head` geprueft. Titel und Body
muessen die exakten Ueberschriften `### Changes (Was ist neu)`,
`### Technische Basis & Kausalität` und `### Ausblick (Nächste Schritte)`
enthalten; ASCII-Varianten wie `Kausalitaet` oder `Naechste` sind rot. Der
PR-Body erfuellt diese Form, wenn er unveraendert als Merge-Text verwendet wird.

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

## Auto-Promotion und Integrationsbranch

`promote.yml` schliesst die Luecke zwischen "Branch gepusht" und "auf main".
Der Workflow reagiert per `workflow_run` auf jedes abgeschlossene `CI Verify`
und arbeitet ein Ergebnis aus:

| CI-Ergebnis | Wirkung |
| --- | --- |
| success | PR wird angelegt (falls noetig) und mit `--squash --subject --body-file` gemergt; der Commit-Text traegt die drei Pflichtsektionen |
| failure, timed_out, cancelled, startup_failure | Label `integration/rot`, Stand wird auf die permanente Branch `integration` gelegt |
| `main` | keine Promotion, der Lauf endet sofort |

**Zwei parallele rote Staende.** GitHub haelt pro Concurrency-Gruppe genau einen
wartenden Lauf; ein dritter Aufruf verdraengt den zweiten. Deshalb liegt der
Zustand nicht in der Warteschlange, sondern im Branch und im Label: jeder Lauf
sammelt alle offenen PRs mit `integration/rot` und legt sie nacheinander auf
`integration`. Die Gruppe `promote` laesst nur einen Schreiber zu, ein
abgelehnter Push wird mit `fetch` und `reset --hard` neu aufgesetzt und erneut
gemergt — der Merge eines bereits enthaltenen Branches meldet "Already up to
date" und ist damit idempotent. Nichts wird verworfen, nichts force-gepusht.

**Textkonflikt.** Kollidiert ein Stand mit `integration`, wird der Merge
abgebrochen, der PR bekommt `integration/konflikt` und einen Kommentar; der
Stand bleibt unveraendert. Aufloesen ist Agentenarbeit (`git merge
origin/integration`), kein Automatismus — ein `-X theirs` wuerde Arbeit
stillschweigend verlieren.

**Token-Eskalation.** Ein Merge mit `GITHUB_TOKEN` startet keinen Workflow; ohne
Gegenmassnahme gaebe es weder `CI Verify` auf `main` noch Tag und APK. `promote`
nutzt `PROMOTE_TOKEN`, wenn das Secret gesetzt ist, und stoesst sonst
`Auto Version & Release` an, das den Commit-Text vor dem Tag selbst prueft.

**Geschuetzte Branch.** `integration` ist keine Wegwerfbranch: `pr-cleanup.yml`
und `scripts/lib/branch-prune.mjs` lassen sie stehen.

**Urteil.** Rot ist nur `failure`, `timed_out` oder `startup_failure`. Ein
`cancelled`-Lauf und der `pull_request`-Lauf des Merge-Refs sind kein Urteil
ueber den Branch. Vor dem Merge laeuft `gh pr update-branch`, weil der
Pflichtstatus unter `strict_required_status_checks_policy` sonst veraltet.

**Gruene Integrationsbranch.** Ist die Reparatur auf `integration` gruen, laeuft
`CI Verify` fuer diesen Branch, und derselbe Workflow legt den PR
`integration` -> `main` an und mergt ihn. Damit ist der Rueckweg automatisch.

## Release- und APK-Kette

Ein mit `GITHUB_TOKEN` gepushter Tag loest keinen Workflow aus. Deshalb ruft
`auto-version-release.yml` den APK-Build nach dem Tag **explizit** auf:

```text
CI Verify (verify:all) -> Auto Version & Release (Tag) -> workflow_call build-apk.yml -> Release-Asset + Pruefung
```

- `auto-version-release.yml` reagiert nur auf einen erfolgreichen `CI Verify`-Lauf mit `event == push` auf `main`; ein roter oder abgebrochener Verify-Lauf erreicht den Tag nicht.
- `build-apk.yml` ist ueber `workflow_call` aufrufbar und bekommt den Tag als Eingabe; Checkout, Upload und Artefaktpruefung haengen daran. Mit `skip_verify: true` laeuft keine zweite `verify:release`-Suite, weil der Aufrufer den Commit bereits geprueft hat; der Production-Build fuer `dist/` wird dann separat ausgefuehrt. Ohne den Input gilt weiterhin das volle Gate.
- Der zweite Trigger (`push: tags`) bleibt als Netz fuer manuell gepushte Tags und prueft weiterhin selbst.
- Der Job `apk` haengt mit `needs: release` am Release; ein roter APK-Build macht den Gesamtlauf sichtbar rot.
- Ein bereits existierender Tag oder Release erzeugt kein zweites Release (`ci-tag-release.mjs` prueft zuerst).

## Eskalation bei Umgebungsproblemen

`scripts/ci-tag-release.mjs` scheitert nicht roh an einer 403, sondern geht die
Leiter aus `scripts/lib/release-escalation.mjs` hoch:

| Stufe | Verhalten |
| --- | --- |
| `WORKFLOW_TOKEN` | Standardlauf mit `GITHUB_TOKEN`; transiente Fehler werden bis zu dreimal wiederholt |
| `RELEASE_TOKEN` | nur wenn das Repository-Secret gesetzt ist; uebernimmt bei Rechtefehlern |
| `BLOCKED` | `::error::` plus Job-Summary mit der genauen Einstellung, die fehlt |

Damit loesen sich Netzwerk- und Rechteprobleme entweder selbst oder der Lauf
sagt konkret, welche Umgebung fehlt. Ein Secret `RELEASE_TOKEN` mit
`contents:write` ist optional; ohne es bleibt die Anleitung im Log.

## Abnahme

| Kriterium | Nachweis |
| --- | --- |
| Direkter Push auf `main` blockiert | Ebene B, `non_fast_forward` + `pull_request` |
| `[skip ci]` umgeht die Pflichtpruefung nicht | Ebene B, `required_status_checks` |
| Release ohne gruenes Verify verhindert | `workflow_run.conclusion == 'success'` in `auto-version-release.yml`; manueller Lauf: `verify:release` |
| Nur ein vollstaendiger Verify-Lauf pro `main`-Push | `CI Verify` -> `workflow_run` Release; `build-apk.yml` ueberspringt `verify:release` nur mit `skip_verify: true` |
| PR ohne Pflichtstatus nicht mergebar | Ebene B, `required_status_checks` |
| Verify veraendert keinen Arbeitsbaum | `npm run verify:all` fuehrt keinen Autofix aus (`scripts/lib/pipeline-plan.mjs`); Berichte liegen im gitignorierten `.verify-cache/reports/` |
| Wegwerf-Branches verschwinden nach dem Merge | `pr-cleanup.yml` (nur gemergt, nicht `main`, kein Fork, kein `keep-branch`); lokal `npm run branches:prune` |
| Lange Nachweise laufen nicht lokal | `npm run test:affected` ueberspringt `statistics` und `performance` und nennt sie; `long-checks.yml` rechnet sie in CI |
| Fix meldet jede Aenderung | `scripts/lib/tree-changes.mjs`, `npm run fix` |
| Zweiter Verify-Lauf reproduzierbar | Gate-Cache auf Inhalts-Hash; Fix-Lauf meldet „keine Aenderung“ |
