P0-Merge-Gate Tagesbericht — Beleg 2026-11-16
================================================

Aus einem frischen Klon von `origin/main` gegen Live-GitHub erzeugt:
Clone-HEAD == `git ls-remote origin refs/heads/main`, Arbeitsbaum vor dem Setup
leer. Der Bericht ist die Verkettung der Repo-Pruefungen; es gibt keine zweite
Berichtsquelle.

Reproduktion (frischer Klon, GH_TOKEN gesetzt; Zeitstempel und Clone-SHA im
Kopf sind laufabhaengig, alles andere ist stabil):

    git ls-remote origin refs/heads/main
    node scripts/verify-merge-gate.mjs
    node scripts/sync-board-state.mjs --check --at "$(date -u +%Y-%m-%dT%H:%M:%SZ)"   # druckt den relativen Dateipfad
    node scripts/reconcile-claims.mjs --check
    node scripts/claim-hygiene.mjs --check
    gh api -X GET search/issues -f q='repo:vannon091118/rigged-by-design is:issue is:closed label:prio-P0' \
      --jq '[.items[] | select([.labels[].name] | any(startswith("zustand")) and (index("zustand-CLOSED")|not))] | length'
    gh issue view 987 --repo vannon091118/rigged-by-design --json state --jq '#987=+.state'
    grep -rEn '#987.{0,40}(offen|open)' docs .lane-claims --include=*.md --include=*.json \
      --exclude-dir=evidence | grep -viE 'keine|nicht|geschlossen|als-offen' | wc -l
    grep -rEn '563292f.{0,40}(HEAD|Kopf)|(HEAD|Kopf).{0,40}563292f' docs --include=*.md \
      --exclude-dir=evidence | wc -l
    gh pr list --repo vannon091118/rigged-by-design --state open --json number --jq 'length'
    sed -n '/## Offene Entscheidungen (Owner)/,/## Referenzen/p' docs/ROADMAP.md

Die Beleg-Ausnahme (`--exclude-dir=evidence`) verhindert nur, dass der Bericht
seinen eigenen Transcript als Zustandsdokument zaehlt; alle Zustandsquellen
(`docs/` ohne Belege, `.lane-claims/`, Live-GitHub) werden geprueft.

Erwartung: Merge-Gate exit 0 mit den echten Protection-Fakten, `drift: []`,
`keine Abweichung`, Claim-Hygiene PASS, 0 Label-Widersprueche, #987 geschlossen,
kein alter Kopf-Hash, 0 offene PRs. Die drei verbleibenden Punkte sind
Owner-Entscheidungen und stehen als solche in `docs/ROADMAP.md`
(Abschnitt „Offene Entscheidungen (Owner)“) sowie in `docs/MECHANICS.md` und
`docs/GOVERNANCE.md`.

------------------------------------------------

```text
P0-Merge-Gate Tagesbericht · 2026-11-16T17:56:30Z
repo=vannon091118/rigged-by-design · clone=d6eb826b · branch=main · dirty=0

== 1. Serverseitige Merge-Sperre (live) ==
GRUEN · main ist serverseitig geschuetzt
Schutz     vorhanden · PR-Zwang ja · Reviews 0
Admins     gebunden · Force-Push blockiert · Loeschen blockiert
Checks     keine (FREEZE-0, dokumentiert) · Rulesets 0
exit=0

== 2. Board-Snapshot gegen Live ==
  "checked": true,
  "file": ".lane-claims/board-state.json",
  "head": "d6eb826be8b2858d6c21ff6205b53575bbb4bf2a",
  "drift": []
}

== 3. Claims-Register ==
reconcile-claims: keine Abweichung
exit=0

== 4. Claim-Hygiene ==
claim-hygiene: PASS (kein offener Claim auf einem belegten geschlossenen Issue)

== 5. Geschlossene P0-Issues ohne zustand-CLOSED ==
0

== 6. #987 / veralteter Kopf-Hash ==
#987=CLOSED
#987-als-offen=0 · veralteter-Kopf-Hash=0

== 7. Offene PRs ==
0

== Offene Entscheidungen (Owner) ==
## Offene Entscheidungen (Owner)

Diese Punkte sind bewusst nicht Teil der Repo-Automatik. Sie brauchen eine
Entscheidung des Owners und werden nicht als erledigt behauptet:

- **Required Status Checks / Rulesets:** keine; es gibt keinen Cloud-Lauf, der
  sie bedienen koennte (FREEZE-0). Eine Aktivierung ist eine Repo-Admin-Entscheidung
  und wuerde einen GitHub-Workflow voraussetzen. Beleg: `docs/CI.md`, `docs/MECHANICS.md`.
- **Merge-Queue:** absichtlich nicht vorhanden; die Integrationsautoritaet liegt
  bei GitHub (Branch-Schutz, Review) und beim Maintainer. Eine Queue waere eine
  Repo-Admin-Entscheidung und wird nicht lokal nachgebaut. Beleg: `docs/MECHANICS.md`.
- **Getrennter Maintainer-Prinzipal:** Worker und Maintainer teilen derzeit einen
  GitHub-Login; die technische Rollentrennung braucht einen eigenen Maintainer-Login.
  Beleg: `docs/GOVERNANCE.md` (shared-principal).

## Referenzen
```
