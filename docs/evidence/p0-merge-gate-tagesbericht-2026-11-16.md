P0-Merge-Gate Tagesbericht — Beleg 2026-11-16
================================================

Aus einem frischen Klon von main gegen Live-GitHub erzeugt. Der Bericht ist
die Verkettung der Repo-Pruefungen; es gibt keine zweite Berichtsquelle.

Reproduktion (frischer Klon, GH_TOKEN gesetzt):

    node scripts/verify-merge-gate.mjs
    node scripts/sync-board-state.mjs --check --at "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    node scripts/reconcile-claims.mjs --check
    node scripts/claim-hygiene.mjs --check
    gh api -X GET search/issues -f q='repo:vannon091118/rigged-by-design is:issue is:closed label:prio-P0' \
      --jq '[.items[] | select([.labels[].name] | any(startswith("zustand")) and (index("zustand-CLOSED")|not))] | length'
    gh pr list --repo vannon091118/rigged-by-design --state open --json number --jq 'length'

Erwartung: Merge-Gate exit 0 mit den echten Protection-Fakten, `drift: []`,
`keine Abweichung`, Claim-Hygiene PASS, 0 Label-Widersprueche, 0 offene PRs.
Die drei verbleibenden Punkte sind Owner-Entscheidungen und stehen als solche
in `docs/ROADMAP.md` (Abschnitt „Offene Entscheidungen (Owner)") sowie in
`docs/MECHANICS.md` und `docs/GOVERNANCE.md`.

------------------------------------------------

```text
P0-Merge-Gate Tagesbericht · 2026-11-16T12:31:15Z
repo=vannon091118/rigged-by-design · clone=522b7e38 · branch=main · dirty=0

== 1. Serverseitige Merge-Sperre (live) ==
GRUEN · main ist serverseitig geschuetzt
Schutz     vorhanden · PR-Zwang ja · Reviews 0
Admins     gebunden · Force-Push blockiert · Loeschen blockiert
Checks     keine (FREEZE-0, dokumentiert) · Rulesets 0
exit=0

== 2. Board-Snapshot gegen Live ==
{
  "checked": true,
  "file": "<clone>/.lane-claims/board-state.json",
  "head": "522b7e388f1b28ffca79254a34de00d26310ee75",
  "drift": []
}

== 3. Claims-Register ==
reconcile-claims: keine Abweichung

== 4. Claim-Hygiene ==
unbekannt: lane/governance/issue-766-main-repair (#766) - Issue-Status nicht im Snapshot
unbekannt: lane/governance/issue-847-dead-exports (#847) - Issue-Status nicht im Snapshot
unbekannt: ... 26 weitere (vollständig mit --json)
claim-hygiene: PASS (kein offener Claim auf einem belegten geschlossenen Issue)

== 5. Geschlossene P0-Issues ohne zustand-CLOSED ==
0

== 6. #987 / veralteter Kopf-Hash ==
#987-als-offen=0 · veralteter-Kopf-Hash=0

== 7. Offene PRs ==
0

== Offene Entscheidungen (Repo-Beleg) ==
- Required Status Checks/Rulesets: keine; Repo-Entscheidung (docs/MECHANICS.md:172, docs/CI.md:72-77)
- Merge-Queue: absichtlich nicht vorhanden, FREEZE-0 (docs/MECHANICS.md:185)
- Gemeinsamer GitHub-Principal: dokumentiert (docs/GOVERNANCE.md:181, :352)
```
