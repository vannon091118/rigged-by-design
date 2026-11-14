# Agent-Onboarding — rigged-by-design

<!-- rbd-doc: managed -->

**Zweck:** Der verbindliche Arbeitsablauf eines ausführenden Agenten. `AGENTS.md` ist der Kurzvertrag, dieses Dokument ist die Schleife. **GitHub ist die Wahrheit für Claims und Lanes**; ältere Register- und Lane-Beschreibungen sind dagegen nachrangig (siehe [Abgleich mit der Repo-Mechanik](#abgleich-mit-der-repo-mechanik)).

Du bist ein **ausführender Agent**. Ein Issue pro Turn. Du schließt keine Issues — du kommentierst, und der Maintainer prüft.

**Deine Rolle.** Claimen, lesen, arbeiten, eigenen Branch pushen, PR öffnen, im Issue belegen. **Merge, Close/Reopen, Push auf `main` und Release-Tags** macht ausschließlich der Maintainer; er reviewt deine Meldung gegen den Code (`ACCEPT`/`PARTIAL`/`REJECT`) und entscheidet Konflikte zwischen `local` und `cloud`. Deshalb gibt es keine Merge-Anweisung in dieser Schleife — nur die Übergabe.

**Du schließt nie.** Issues und Pull Requests werden von dir nur **erstellt und kommentiert**; Schließen, Wiedereröffnen und Mergen liegen ausschließlich bei Maintainer oder User. Auch ein erledigtes Ticket bleibt offen, bis der Maintainer es schließt.

**Dein Name:** `LIILITH`, `Shinon` oder `Jenova` — eine der drei Worker-Identitäten. Welche dir gehört, steht im Identity-Board-Issue (`IDENTITY_CLAIM`) und lokal in `RBD_WORKSPACE_HOME/.lanes/identity.json`; `pnpm run worker:init -- status` prüft beides. Die alten Namen `agent-<n>-local/-cloud` bleiben als Historie lesbar, sind aber keine neuen Identitäten. Jeder Kommentar nennt deine Identität und deine Claim-ID, sonst ist er nicht zuordenbar.

**Grundsatz, der alles andere schlägt:** Das Issue-Board ist der primäre Workflow — Priorität, Besitz und Fortschritt stehen dort. Dein lokaler State und die Dateien unter `.lane-claims/` sind nur ein Cache bzw. eine lokale Kollisionssperre für Pfade und dürfen **nie** gegen den Issue-Verlauf entscheiden. Du arbeitest auf mehreren Systemen, also ist lokaler State flüchtig und systemgebunden — was zählt, steht im Issue.

---

## Der Lauf als Schleife

```
1 Issue-Check  →  2 Main-Fetch  →  3 Issue-Updates  →  4 Lokaler State
→  5 Prioritäten + Claim  →  6 Lösen + PR  →  7 Umsetzungs-Kommentar
→  zurück zu 5 (nächstes freies Issue, gleicher Lauf)
```

---

## 1 · Issue-Check

Verschaffe dir den Bestand, bevor du irgendetwas anfasst.

- `pnpm run worker:init -- status` prueft Identitaet, Claim-ID und Workspace-Home. Ungueltige Datei oder fehlende globale Reservierung heisst `BLOCKED`: keine neue Arbeit ohne Identitaet.

- `gh issue list --state open -R vannon091118/rigged-by-design --limit 100` mit Labels, Alter, letztem Kommentar.
- Für die obersten Kandidaten: Body **und alle Kommentare** lesen.
- Blockierte Issues (`blocked by` offen) sind für dich nicht wählbar.
- Issues mit `FROZEN-AREA`, `NEEDS-INFO`, `NEEDS-EVIDENCE`, `ROOTCAUSE` sind nicht deine Arbeitsaufträge — außer der Maintainer hat dich ausdrücklich darin eingesetzt.

**Abbruch des Laufs:** kein offenes, freies, unblockiertes Issue vorhanden. Dann kurzer Abschluss im State, kein Kommentar ins Leere.

---

## 2 · Main-Fetch

`pnpm run worker:init -- inventory` listet alle Worktrees dieses Repos mit Git-Zustand, Stashes und nicht gepushten Commits. `INVENTORY_INCOMPLETE` oder Dubletten sperren jedes Aufraeumen; fremde WIP bleibt liegen.

Vor jeder Arbeit den aktuellen Stand holen — nie auf einem veralteten `main` urteilen. Der geteilte Arbeitsbaum wird **nicht** zurückgesetzt: `reset --hard`, `clean -xdf` und `stash` sind für Agenten verboten (`AGENTS.md` Regel 2) und würden fremdes WIP vernichten.

```bash
git fetch --prune origin
git worktree add ../rbd-<issue> -b lane/<domäne>/<task> origin/main
```

Im **eigenen** Worktree ist der Stand exakt `origin/main`; dort wird gearbeitet. Nur der Maintainer darf in seinem eigenen Review-Checkout `reset --hard`/`clean -xdf` nutzen, nie im geteilten Baum.

SHA notieren (`git rev-parse --short HEAD`). Alles, was du im Issue behauptest, bezieht sich auf **diesen** SHA. Schlägt der Fetch fehl: Lauf beenden, nicht auf altem Stand weiterarbeiten.

---

## 3 · Issue-Updates prüfen

Prüfe **alle Issues, die du zuletzt bearbeitet oder kommentiert hast** — nicht nur das nächste.

| Lage | Reaktion |
|---|---|
| geschlossen, kein Kommentar an dich | erledigt, aus deiner Liste nehmen |
| neuer Maintainer-Kommentar `ACCEPT` | abgeschlossen, weiter |
| `PARTIAL` mit Restumfang | Rest ist dein neuer Auftrag → neu claimen |
| `REJECT` mit Begründung | Ursache lesen, **nicht** denselben Ansatz wiederholen |
| `NEEDS-INFO` / `NEEDS-EVIDENCE` | antworten, mit Beleg, im selben Lauf |
| fremder Agent hat übernommen | `HANDOFF` bestätigen, Issue abgeben |
| Widerspruch zu deiner Aussage | gegen den Code prüfen, nicht gegen dein Gedächtnis |

Unbeantwortete Reviews sind der Hauptgrund für Pingpong. Wer eine Review-Frage offen lässt, blockiert das Ticket für alle anderen.

---

## 4 · Lokalen Issue-State pflegen

Der State ist **nicht persistent** und nicht systemübergreifend — er existiert nur, um dir innerhalb und zwischen deinen Läufen auf *diesem* Rechner Wiederholungsarbeit zu sparen.

**Ort** (nie im Repo, nie committen):

- Windows: `%LOCALAPPDATA%\rigged-agent\state-<agentname>.json`
- Linux/macOS: `~/.local/state/rigged-agent/state-<agentname>.json`

**Anlegen, falls nicht vorhanden.** Schema:

```json
{
  "agent": "local.agent(cloud).1",
  "host": "<hostname>",
  "updated_at": "2026-11-14T10:12:00Z",
  "main_sha": "abc1234",
  "claims":  [{ "issue": 42, "claim_id": "A7", "since": "…", "scope": ["src/combat.ts"], "state": "active|done|abandoned" }],
  "seen":    { "42": { "last_comment_id": 991, "last_state": "open", "last_verdict": null } },
  "done":    [{ "issue": 40, "sha": "def5678", "pr": 51, "at": "…" }],
  "deferred":[{ "issue": 44, "reason": "blocked by #39", "at": "…" }]
}
```

**Regeln:**

- Nach jedem Schritt aktualisieren, nicht erst am Ende — ein Absturz soll keine Doppelarbeit erzeugen.
- Der State ist **kein Beweis**. Bevor du dich auf einen Eintrag verlässt, prüfe den echten Issue-Verlauf. Weicht er ab, gewinnt GitHub und du korrigierst den State.
- Existiert der State nicht (neues System, neu aufgesetzt): anlegen, alles als unbekannt behandeln und aus den Issues neu aufbauen. Niemals „ich hatte das schon" annehmen.
- Fremden State nicht lesen oder überschreiben — jeder Agent hat seine eigene Datei.

---

## 5 · Prioritäten prüfen und nächstes freies Issue claimen

Reihenfolge: `P0` → Regressionen → Unblocker → `P1` → `P2/P3` → Housekeeping. Innerhalb einer Stufe: ältestes zuerst.

**Freiheitsprüfung vor dem Claim — in dieser Reihenfolge:**

1. Gibt es einen aktiven `CLAIM`-Kommentar **ohne** `RELEASE`? → Ticket ist besetzt. **Nicht anfassen, nicht kommentieren.** Nächstes Issue.
2. Existiert ein Claim **und danach kein weiterer Kommentar**? → Das ist **WIP parallel**: ein anderer Agent arbeitet gerade. Überspringen, Ticket bleibt tabu.
3. Existiert ein Claim, danach aber ein `RELEASE done|abandoned`? → Frei. Du darfst claimen.
4. Kein Claim vorhanden? → **Go.**

Zusatzregel: Claim älter als 72 Stunden ohne Commit, Kommentar oder PR-Aktivität → im State als `deferred` mit Grund `claim-stale #<nr>` notieren und überspringen. **Nicht** selbst übernehmen — Verwaist-Erklärung ist Sache des Maintainers.

**Claim setzen** — erster Schreibvorgang, sofort, vor jeder Analyse:

```
CLAIM [A<n>] local.agent(cloud).1 2026-11-14T10:12Z scope=<dateien|symbole> plan=<1 Satz>
```

Genau ein aktiver Claim pro Issue. Kein Claim auf zwei Tickets gleichzeitig. Kein Claim, den du nicht in dieser Sitzung bearbeitest.

**Gate:** Der Claim steht **vor dem ersten Read** — erst der Kommentar, dann die Dateien. `pnpm run agent:pretask --json` liest denselben Verlauf und blockiert bei fremdem Claim, verlangt bei fehlendem Claim genau diesen Kommentar (`RBD_AGENT`/`--agent` nennt deine Identität) und warnt nur, wenn die Lane keine Issue-Nummer hat. Damit orchestriert genau ein Agent pro Issue. Die Dateien unter `.lane-claims/` sind danach nur deine lokale Sperre: sie halten die Pfad-Allowlist für Staging und Gates und verhindern Doppelarbeit an denselben Dateien — Besitz oder Priorität erzeugen sie nicht.

---

## 6 · Issue lösen und via PR auf main bringen

1. Branch: `fix/<issue-nr>-<kurzslug>` von aktuellem `origin/main`.
2. Arbeiten, Scope einhalten. Nebenbefund? Nicht mitfixen → als Kommentar am Issue melden (`Nebenbefund: … datei:zeile`), der Maintainer entscheidet.
3. Checks laufen lassen, Exit-Codes notieren. Rot → nicht pushen, Ursache beheben.
4. Commit-Message mit Issue-Bezug: `fix(#42): <was> — <warum>`.
5. PR öffnen gegen `main`:
   - Titel: `fix(#42): <Kurztitel>`
   - Body: Issue-Verweis, Ansatz, geänderte Dateien, Checks mit Exit-Code, Restrisiko.
6. **Übergabe statt Merge:** PR offen lassen, `RELEASE` schreiben, `review-waiting` setzen und den Umsetzungs-Kommentar schreiben. Mergen, schließen und taggen tut der Maintainer nach Review auf exaktem Kopf.
7. Kein Force-Push, kein Rebase fremder Branches, keine fremden PRs anfassen.

**Verboten:** Issues oder Pull Requests schließen oder wiedereröffnen (nur Maintainer oder User), mergen, auf `main` pushen, Release-Tags setzen, fremde Claims überschreiben, mehrere Issues gleichzeitig.

---

## 7 · Umsetzungs-Kommentar für den Maintainer-Review

Nach dem Merge — Pflicht, immer, ausführlich genug, dass der Reviewer **ohne deinen Kopf** prüfen kann:

```
local.agent(cloud).1 — DONE [A<n>] #42
PR: #51 · sha: abc1234 · base: <main-sha>
Ansatz: <2–3 Sätze: warum so, welche Alternative verworfen und warum>
Geändert: src/combat.ts:88-104 (Rüstung wird jetzt vor Schadensabzug geprüft)
          src/types.ts:12 (optionales Feld armor)
Checks: npm test → exit 0 (312 Tests)
        npm run typecheck → exit 0
        Repro aus Issue, Schritt 3 → erwartet 12, tatsächlich 12
Nicht gemacht: Migration alter Saves — bewusst, betrifft #37
Restrisiko: Schadenswerte < 0 bei Rüstung > Schaden, nicht abgedeckt
Review-Fokus: bitte combat.ts:88 Randfall negativer Schaden prüfen
```

Regeln:

- **SHA und PR sind Pflicht.** Ohne Referenz ist der Kommentar wertlos.
- **`datei:zeile` statt Prosa.** „Logik angepasst" ist kein Beleg.
- **Exit-Codes echt.** Erfundene Ergebnisse sind das Ende der Zusammenarbeit.
- **`Nicht gemacht` und `Restrisiko` sind Qualitätsmerkmale**, keine Schwäche — sie verhindern, dass das Ticket für vollständig gehalten wird.
- **`Review-Fokus`** sagt dem Maintainer, wo er zuerst hinschauen soll. Das beschleunigt die Prüfung und verhindert, dass ein bekanntes Loch als Überraschung auftaucht.
- Danach `RELEASE [A<n>] done abc1234` und das Label setzen:

  ```bash
  gh issue edit 42 --repo vannon091118/rigged-by-design --add-label review-waiting
  ```

  Claim-Freigabe plus Label sind die Übergabe: das Ticket ist damit sichtbar `Review Waiting` und für den Peer-Review kategorisiert. Freigeben heisst **nicht** schließen (und keinen PR schließen). Der Maintainer reviewt den Kommentar gegen den Code, entscheidet `ACCEPT`/`PARTIAL`/`REJECT` und nimmt das Label mit seinem Verdikt wieder ab; bei `REJECT` beginnst du nicht denselben Ansatz erneut.

---

## 8 · Weiter

State aktualisieren, zurück zu **5**: nächstes freies Issue claimen, gleicher Lauf.

**Lauf beenden, wenn:** kein freies Issue mehr, Zeitbudget erreicht, oder zwei Issues in Folge durch fehlende Information blockiert. Dann State schreiben und die blockierten Fälle unter `deferred` mit Grund ablegen.

---

## Die fünf Fehler, die hier wirklich passieren

1. **Claim vergessen** → zwei Agenten bauen dasselbe, einer wirft weg.
2. **Kommentare nicht gelesen** → ein längst verworfener Ansatz wird wiederholt.
3. **Ticket geschlossen** → der Maintainer kann nicht mehr prüfen, der Nachweis ist weg.
4. **DONE ohne SHA/PR** → Arbeit ist nicht überprüfbar und gilt als nicht gemacht.
5. **Scope-Drift** → drei Fixes in einem Ticket, keins nachvollziehbar.

Im Zweifel: kommentieren, nicht schließen. Der Maintainer entscheidet.

---

## Abgleich mit der Repo-Mechanik

Dieses Dokument entscheidet über **Koordination** (Claim, Priorität, Freigabe, Review-Antwort). Die mechanischen Regeln des Repos bleiben gültig, weil Gates sie prüfen; sie widersprechen der Schleife nicht, sie sind ihr Werkzeugteil:

| Thema | Verbindlich | Anmerkung |
| --- | --- | --- |
| Claim | `CLAIM`/`RELEASE`-Kommentar am Issue | Autoritativ für Besitz und Reihenfolge. Der Eintrag unter `.lane-claims/claims/` ist die **lokale Kollisionssperre** (Pfad-Allowlist für `turn:finish`, `verify:claims`, `verify:scope` und den Pre-Commit-Hook), damit keine zwei Agenten dieselben Dateien im selben Task oder Turn bearbeiten; er entscheidet nie gegen den Issue-Verlauf. |
| Lane/Branch | `lane/<domäne>/<task>` (mechanisch), `fix/<nr>-<slug>` (lesbar, Legacy-Präfix) | Beide Formen sind zulässig; das Register braucht einen Branch nach Schema. |
| Name | `local.agent(cloud).1` | Prefix `local.agent` ist der Marker; `.1`, `.2` … je Instanz. |
| Checks | `verify:light`, `verify:fast`, `pnpm run ci:local` | „Checks grün" meint diese Linie ([`CI.md`](CI.md), [`TESTING.md`](TESTING.md)), nicht Browser-Klicktests. |
| Abschluss | Commit + Push + PR nach grünem Nachweis; Merge durch den Maintainer | `turn:finish` bleibt der lokale Abschlussweg; ein pauschaler Cloud-Testlauf existiert nicht. |
| Rollen | Maintainer merged/schließt/taggt; Agenten pushen nur ihren Branch | Rechte stehen in [`GOVERNANCE.md`](GOVERNANCE.md#rollen-und-lanes). |
| Textbaustein | Jeder Commit braucht einen registrierten Baustein (`AGENTS.md` Regel 6) | Bleibt bestehen; die Registry wird nicht handgeschrieben. |
| Lokaler State | Datei außerhalb des Repos | Nie committen, nie als Beweis nutzen. |
| Issues | werden kommentiert, nie geschlossen | Schließen und Wiederöffnen ist Maintainer-Sache; die Übergabe setzt `review-waiting`, abgenommen wird es nur vom Maintainer-Verdikt. |

## Referenzen

- [`AGENTS.md`](../AGENTS.md) — Kurzvertrag mit den zehn unverhandelbaren Regeln.
- [`WORKFLOW.md`](WORKFLOW.md) — Pretask, Resume und Abschluss im Repo.
- [`GOVERNANCE.md`](GOVERNANCE.md) — Rollen, Claims und Eskalation.
- [`CI.md`](CI.md) — die Gate-Linie, die „Checks grün" meint.
