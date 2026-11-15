# Governance: Lanes, Claims und Eskalation

<!-- rbd-doc: managed -->

**Zweck:** Die verbindlichen Regeln für parallele Arbeit. Der Kurzvertrag steht in `AGENTS.md`; dieses Dokument beschreibt Rollen, Claim-Prüfung und die eine Eskalationsleiter.

## Rollen und Lanes

Zwei Rollen, ein Board. Das Issue ist die Wahrheit; dieses Dokument beschreibt, wer welche Rechte hat. Die ausführende Schleife steht in [`AGENT-ONBOARDING.md`](AGENT-ONBOARDING.md).

### Maintainer

Der Maintainer ist Issue-Reviewer, Integrator und **einziger Orchestrator**:

- Issues und Pull Requests anlegen, kommentieren, **schließen und wiedereröffnen** — Schließen ausschließlich Maintainer oder User; Review-Verdikt `ACCEPT`/`PARTIAL`/`REJECT` gegen den Code, nicht gegen die Behauptung.
- **Merge nach `main`, Push auf `main`, Release-Tags** für belegte Features; `main` bleibt sonst tabu.
- **Priorisierung:** nach der kanonischen Tabelle [Maintainer-Prioritäten (kanonisch)](#maintainer-prioritäten-kanonisch); die Reihenfolge wird am Ende jedes Laufs neu geschrieben, auch bei `IDLE`.
- **Konfliktauflösung:** Claim-, Scope-, Semantik-, Reihenfolge- und Branch-Konflikte zwischen `local` und `cloud` entscheidet er im Issue (Vorrang, `HANDOFF`, `blocked by`, Zusammenführung).
- Er führt keine Spiel-Lane ohne eigenen Claim; auch für ihn gilt Claim vor Read.

### Mission-Profil `maintainer` (global)

Ein Satz genügt: **`goal=maintainer`**. Das Profil ist die vollständige Aufgabenliste des Maintainer-Laufs; die Rollen-Constraints stehen global hier und werden nicht pro Turn, pro Mission oder pro Gerät neu gesetzt. Jeder Schritt endet mit einem Beleg (Befehl, Exit-Code oder Kommentar); kein Schritt ohne Befehl.

| # | Schritt | Beleg | Done |
| --- | --- | --- | --- |
| 1 | Laufbudget und Stop-Vertrag | `pnpm run run:budget --check` | Exit 0; `BUDGET_EXHAUSTED`/`KILL_SWITCH` beendet den Lauf |
| 2 | Startzustand | `pnpm run agent:pretask --json`, `pnpm run board:sync -- --check --at <ISO>` | Board-Drift bekannt, fremde Claims unberührt |
| 3 | P0-Eingang | offene Issues und PRs seit der letzten `state:JSON` | jeder neue User-/Agenten-Kommentar triagiert |
| 4 | Review-Queue (P1) | `review-waiting`-PRs: Diff, Intention gegen Umsetzung, `pnpm run ci:local` auf exaktem Kopf | Verdikt `ACCEPT`/`PARTIAL`/`REJECT` im PR |
| 5 | Integration | Merge auf exaktem Kopf, Push auf `main` | Merge-SHA liegt auf `origin/main` |
| 6 | Closeout | `pnpm run reconcile:claims --apply`, Issue mit Merge-Beleg schließen, Branch entfernen | Claim/Task `DONE`, Board aktuell |
| 7 | Zuweisung | freie Issues nach [Prioritäten](#maintainer-prioritäten-kanonisch) an freie Identitäten | Claim im Issue sichtbar |
| 8 | Konflikte | Claim-, Scope- oder Reihenfolge-Kollision | einmalig im Issue entschieden und kommentiert |
| 9 | Drift-Bremse | mehr als zwei Läufe primär Governance | `[GOVERNANCE-DRIFT]` P2 existiert, neue Governance-Issues pausiert |
| 10 | Abschluss | `state:JSON` schreiben, Lock freigeben | Lock frei, Board-Snapshot aktuell |

Protokoll, Board-Pflichten und Prioritäten bleiben in ihren Abschnitten; dieses Profil ordnet sie nur und wiederholt sie nicht.

**Turn-Abschluss (Pflicht).** Jeder Turn endet mit dem Identitätsblock. Die Constraints stehen global oben; pro Turn wird nur der Zustand genannt:

```
Rolle: <Maintainer|Agent> · Identität: <vannon091118|LIILITH|Shinon|Jenova> ·
Lane: <branch> · Issue: #<nr> · Board: <IDLE|ACTIVE|REVIEW_PENDING|BLOCKED> · Offen: <n>
```

**Keine Afterpflege ohne Befund.** Ist die Abnahme erfüllt, endet der Lauf: kein zweiter Durchgang, kein Refactoring zur Sicherheit, kein ungefragter Zusatz. Sinnvolle weitere Arbeit wird als Vorschlag benannt, nicht ausgeführt. Ausnahmen sind genau drei: ein rotes Gate, ein Review-Verdikt oder eine ausdrückliche Anweisung.

### Maintainer-Prioritäten (kanonisch)

Diese Tabelle ist die **einzige verbindliche Definition**. `AGENTS.md`, [`WORKFLOW.md`](WORKFLOW.md) und [`AGENT-ONBOARDING.md`](AGENT-ONBOARDING.md) verweisen hierher und wiederholen sie nicht.

| Prio | Trigger | Aktion |
|------|---------|--------|
| **P0** | Jeder neue User- **oder Agenten-Kommentar** auf einem Issue oder PR | Eingangsticket: sofort triagieren; nichts geht vorher |
| **P1** | Offene PRs mit `review-waiting` und andere ausdrücklich wartende Maintainer-Reviews | Diff lesen, Findings beheben lassen oder `ACCEPT`/`PARTIAL`/`REJECT` |
| **P2** | Gameplay-Bugs und fehlende spielrelevante Inhalte | Issue erstellen, priorisieren, zuweisen; pre-existing Flakiness bis zur Root-Cause mit Causal-Chain erfassen |
| **P3** | Board-/Governance-Struktur, die echte Rekursionen, Kommunikationsverlust oder laufende Spielarbeit blockiert | Minimal-Fix |
| — | Governance-Verbesserungen ohne Blocking-Effekt | Kein Issue, kein PR; Kommentar im Review-Log |

- **Inhaltlicher Schwerpunkt bleibt das Spiel.** Governance darf nicht zum Backlog-Multiplikator werden.
- **Innerhalb einer Stufe gilt das älteste Issue zuerst.** Die Reihenfolge aus dieser Tabelle ist die des Boards; lokale Dateien und Register können sie nicht ändern.
- **Kein neues Ticket ohne Board-Prüfung.** Erst der bestehende Zustand, dann ein neues Issue; ein Ticket, das nur wegen schlechter Beschreibung eines anderen entsteht, entfällt.

### Agenten (`LIILITH`, `Shinon`, `Jenova`)

Es gibt genau drei Worker-Identitäten: **`LIILITH`**, **`Shinon`** und **`Jenova`**. Sie werden global im Identity-Board-Issue mit `IDENTITY_CLAIM name=… system=… workspace=… repo=… session=… claim_id=… at=…` reserviert, nach dem Kommentar erneut gelesen und an der Kommentar-ID verifiziert; `IDENTITY_RELEASE` derselben Claim-ID gibt sie frei. Die alten Namen `agent-<n>-local`, `agent-<n>-cloud` und `local.agent(cloud).<n>` bleiben als Historie lesbar, sind aber **keine neuen Identitäten** und werden vom Parser als `legacy-identity` gemeldet. Agenten:

- lesen das Issue inklusive aller Kommentare, **claimen vor dem ersten Read** und arbeiten genau ein Issue pro Turn ab;
- ändern nur Pfade ihrer Claim-Allowlist, committen und pushen **ihren** Branch, öffnen den PR und beantworten Review-Fragen im Issue;
- mergen nicht, pushen nicht `main`, schließen/wiedereröffnen weder Issues noch Pull Requests und setzen keine Tags;
- melden Nebenbefunde als Kommentar (`Nebenbefund: … datei:zeile`), statt den Scope zu dehnen.

### Lanes

- **Governance-Owner** führt Meta-, Workflow- und Register-Änderungen. Feature-Lanes dürfen Meta-Dateien nur über den mechanischen Pfad (Marker/Version) berühren.
- **Integrator**, **Governance-Owner**, **Architektur-Owner**, **Ledger-/Core-Owner**, **Quality-/Capability-Owner**, **Interaction-Contract-Owner**, **Sim-/Domain-Owner**, **Save-/Migrations-Owner** und **Monitor** sind feste Rollen aus `OWNERS` in `scripts/lib/lane-claims.mjs`; ein Claim ohne Roster-Owner wird abgelehnt. Die frueheren Rollen Core-/UI-/Narrative-/Interaction-Owner sind Legacy und nicht mehr im Roster.
- **Branch-Schema:** `lane/<domäne>/<task>`; Legacy-Präfixe `gov/`, `hygiene/` und `fix/` bleiben lesbar. Der Agent-Workflow nennt `fix/<issue-nr>-<slug>`; beide Formen sind zulässig, weil das Register einen Branch nach Schema braucht.
- **Workspace:** `RBD_WORKSPACE_HOME` hält `.lanes/identity.json`, `.lanes/dependencies.json`, `.pnpm-store/`, `main/` und `worker/` — außerhalb beider Git-Worktrees, damit die Identität einen Neuaufbau überlebt. Regulär existieren genau **zwei** RBD-Worktrees pro System (Main und Worker); weitere Klone und Worktrees werden inventarisiert und klassifiziert, fremde oder ungeklärte WIP nie gelöscht.
- **Worktree:** Ein verknüpfter Worktree ist optional; `--require-worktree` fordert ihn explizit. Ein neuer Agent startet in einem **eigenen** Worktree von `origin/main`; der geteilte Arbeitsbaum wird nie zurückgesetzt. Jede Branch außer `main` ist temporär und wird nach belegtem Merge entfernt.
- **Meta-Dateien:** `AGENTS.md`, `package.json`, `pnpm-lock.yaml`, `docs/INVENTORY.md`, `docs/ARCHITECTURE.md`, `docs/CHANGELOG.md`, `docs/DEVTAGEBUCH.md`, `docs/ROADMAP.md`. Inhaltliche Änderungen brauchen eine Governance- oder ausdrücklich berechtigte Lane.
- **Kontrollebene:** `.github/`, `scripts/` und `src/Config/` bleiben Governance- oder CI-Lanes vorbehalten; Feature-Claims können sie nicht öffnen.

### Laufbudget und Stop-Vertrag

Ein Lauf endet nicht durch den Agenten, sondern durch eine externe Grenze. Die Grenzen stehen in [`run-budget.json`](run-budget.json) und werden mit `pnpm run run:budget --check` gegen die Commits aus Git geprüft:

```text
CONTINUE           innerhalb aller Grenzen
BUDGET_EXHAUSTED   Iterationen, Issues, Commits oder neue Governance-Findings ueber dem Limit
KILL_SWITCH        Maintainer-Stop; hat Vorrang vor jeder anderen Entscheidung
```

- `maxIterations`, `maxIssues` und `maxNewGovernanceIssues` sind nichtnegative Ganzzahlen; `maxCommits` und `maxNewGovernanceIssues` sind mindestens 1. Ein Budget von 0 fuer neue Governance-Findings ist ungueltig, weil es die Pflicht aushebelt, jeden Befund als Issue zu oeffnen. Eine ungueltige oder fehlende Konfiguration blockiert fail-closed.
- Der Kill-Switch ist nur eine Stop-Quelle. Ein Agent kann ihn setzen oder ausloesen, aber nicht gegen ein erschoepftes Budget weiterlaufen lassen; jede Grenzaenderung braucht einen sichtbaren Governance-Commit.
- `pretask` uebergibt die Zahl der in diesem Lauf geoeffneten Governance-Issues nicht mehr als feste 0: sie kommt aus `--new-governance-issues <n>` oder `RBD_NEW_GOVERNANCE_ISSUES=<n>`. Fehlt sie, blockiert der Start mit `new-governance-issues=unknown`; ein angenommenes 0 gilt nicht mehr.
- Neue Findings laufen vor dem Issue durch `pnpm run run:budget --finding <datei.json>`: Beleg (`datei:zeile` oder Befehl), vollstaendiger Main-SHA, Duplikatpruefung, Severity `P0`–`P3` und Zuordnung `product`/`infrastructure` sind Pflicht. Produkt-Findings brauchen zusaetzlich ein `productGoal`.
- Jeder neue Meta-/Governance-Befund wird sofort als Issue mit `ZU PRÜFEN` plus Zustands-, Prio- und Area-Label geoeffnet. Das Budget zaehlt ihn als `governanceChurn`; wird die Grenze ueberschritten, endet der Lauf erst nach dem Ticket (`findingDuty: TICKET_THEN_STOP`). Kein Befund geht verloren, weil das Budget erschoepft ist.
- Jeder Laufbericht trennt `productProgress` (gemergte Produkt-PRs, akzeptierte Findings) von `governanceChurn` (neue Governance-Findings) und nennt Main-SHA, erledigte Produktziele, offene Blocker und die Stop-/Continue-Entscheidung.

### Worker-Identität und Dependency-Store

`pnpm run worker:init -- status` prüft die lokale Identitätsdatei gegen die globale Reservierung; `-- claim` reserviert, `-- release` gibt frei, `-- inventory` klassifiziert alle Worktrees dieses Repos (clean, dirty, unpushed, review-pending, merged-pending-cleanup, duplicate, orphaned, `INVENTORY_INCOMPLETE`). Der Neuaufbau des Worker-Worktrees ist erst erlaubt, wenn GitHub `merged: true` meldet, der Merge-SHA auf `origin/main` liegt, der lokale HEAD dem PR-HEAD entspricht und der Baum keine ungesicherte Arbeit trägt (`scripts/lib/worktree-lifecycle.mjs`).

Dependencies werden über einen Fingerprint aus Manifesten, Lockfile, Workspace-Konfiguration, `.npmrc`, Node-/pnpm-Version und Zielplattform gesteuert (`scripts/lib/dependency-fingerprint.mjs`). Unverändert heißt: keine Installation. Nach einem Neuaufbau wird `pnpm install --frozen-lockfile --store-dir <home>/.pnpm-store` genutzt; `--offline` nur, wenn alle Pakete im Store liegen.

## Claims

**Das Issue-Board ist der primäre Workflow und die einzige Wahrheit.** Es bestimmt, was als Nächstes passiert (Priorität), wem es gehört (Claim) und wann es fertig ist (Review, `RELEASE`). Ein Claim ist ein Kommentar am GitHub-Issue — `CLAIM [A<n>] agent-1-local <UTC-Zeit> scope=… plan=…` vor dem ersten Read, `RELEASE [A<n>] done <sha>` nach der Übergabe; das Ablaufmuster steht in [`AGENT-ONBOARDING.md`](AGENT-ONBOARDING.md). Ein Issue ohne Claim ist frei, ein Issue mit Claim ohne `RELEASE` ist besetzt.

**Arbeitsreihenfolge** ist ausschließlich die Board-Reihenfolge aus [Maintainer-Prioritäten (kanonisch)](#maintainer-prioritäten-kanonisch), innerhalb einer Stufe das älteste Issue. Lokale Dateien, Register und Task-Verträge können diese Reihenfolge nicht ändern; der Maintainer schreibt sie am Ende jedes Laufs neu.

**Die lokale Kollisionssperre.** Der Eintrag unter `.lane-claims/claims/` (Register `.lane-claims/claims.json`) und der Task-Vertrag sind **keine zweite Wahrheit**. Sie halten die Pfad-Allowlist, an der Staging, `verify:scope`, `pretask` und die Pre-Commit-Hooks hängen, und verhindern genau eine Sache: dass zwei parallel laufende Agenten dieselben Dateien im selben Task oder Turn bearbeiten. Sie entscheiden nie über Besitz, Priorität, Reihenfolge oder Merge. Weicht die Sperre vom Issue ab, gewinnt das Issue; die Sperre wird nachgezogen, statt die Arbeit zu blockieren. Fehlt sie ganz und ist das Issue sauber geclaimt, startet `pretask` mit Warnung und eingeschränkter Scope-Prüfung.

**Ablauf im Issue.** Vor dem ersten Read eines freien Issues steht der Claim, danach die Arbeit, am Ende die Freigabe:

```text
CLAIM [A<n>] agent-1-local 2026-11-14T10:12Z scope=src/core/sim plan=Rohbau-Zustand im Bau-Pfad
HANDOFF [A<n>] → agent-1-cloud Grund
RELEASE [A<n>] done <sha|—> ein Satz
```

- Genau ein aktiver Claim pro Issue; ein zweiter Claim ist ein Konflikt, den der Maintainer entscheidet.
- `CLAIM` ohne `RELEASE` heißt besetzt — auch ohne neuen Kommentar (WIP parallel).
- Claim älter als 2 Stunden ohne Commit, PR- oder Kommentaraktivität ist `stale`: im lokalen State als `deferred` notieren, nicht übernehmen.
- `RELEASE done` verlangt SHA und PR; ohne Beleg gilt die Arbeit als nicht gemacht.
- `pretask` prüft den Issue-Claim als Startgate (`RBD_AGENT`/`--agent`): fremder Claim blockiert, fehlender Claim nennt den nötigen Kommentar, eine Lane ohne Issue-Nummer wird gewarnt statt blockiert. Die lokale Sperre prüft es danach getrennt; sie kann einen gültigen Issue-Claim nie überstimmen.

Der gespiegelte Eintrag ist der Vertrag einer Lane, kein Token pro Pull Request.

Pflichtfelder:

- `id`, `branch`, `owner`, `task`, `issue` (Nummer; ohne sie ist die Lane Legacy und das Gate warnt nur),
- `baseSha` (Startpunkt, **kein** Merge-Beleg),
- `pathAllowlist`,
- optionale `contracts` mit Modus `write`/`read`,
- `dependencies`, `gateProfile`, `status`.

Regeln (sie prüfen die Spiegelung, nicht die Koordination):

1. **Genau ein Writer pro Contract-ID.** Read-only-Konsumenten dürfen parallel laufen.
2. **Pfad-Überschneidungen blockieren.** Zwei Lanes mit demselben Pfad oder derselben Contract-Writer-Rolle kollidieren; Register, Meta- und mechanische Pfade sind von der Kollision ausgenommen.
3. **Keine Selbsterweiterung.** `verify-lane-claims --ci` vergleicht mit der Basis und der ersten Registrierung: neue Pfade, Owner, Branches oder zusätzliche Writer werden abgelehnt; eine Verengung ist erlaubt.
4. **Fremde Claims sind tabu.** Eine Feature-Lane ändert fremde Claims nicht. Nur die Governance-Lane darf den Status fortschreiben, und auch sie nur im Status, nicht in Pfaden oder Ownern.
5. **Gemergte Lane bleibt ansprechbar.** `selectClaim()` führt einen `merged` Claim weiter, damit der Register-Nachtrag nach dem Merge keinen neuen Claim eröffnet. `claim-evidence.mjs` akzeptiert einen gemergten PR, einen Branch-Kopf auf `main` oder einen baumgleichen Commit auf `main`; `baseSha` reicht nicht.
6. **Fail-closed.** Ohne Claim, ohne Owner oder bei einer unklaren Kollision wird nicht committet.
7. **Retention.** Lane-Claims und Task-Verträge werden auf die letzten **zehn Tasks** begrenzt. Aktive Tasks, offene oder geparkte Claims und die gerade bearbeitete Lane bleiben immer erhalten; geschlossene Claims ohne zugehörigen Task fallen mit der Retention weg. Das Legacy-Register `.lane-claims/claims.json` wird nicht beschnitten. `reconcile-claims --apply` führt die Retention mit aus, `claim:register prune` ist der manuelle Weg.
8. **Post-Merge.** Ein belegter Merge zieht den Claim auf `merged` und den Task von `CI_PENDING`, `MERGE_PENDING` oder `AFTERCARE` auf `DONE` — ohne offenen Blocker. Der Workflow `PR Cleanup` startet dafür nach jedem Merge einen eigenen Closeout-PR; der Closeout-Task trägt `closeout: post-merge` und darf nur über diesen ausdrücklichen Pfad als `DONE` durch den Maintainer gemergt werden. Ein Direktpush auf `main` bleibt ausgeschlossen.

   Fällt Actions aus, erkennt der nächste normale `pretask` den belegten Merge und meldet `REMOTE_AUTOMATION_UNAVAILABLE`; auf `main` zieht er den idempotenten Closeout automatisch nach, auf einer Lane nennt er `pnpm run reconcile:claims --apply` als nächsten Schritt. Claim-Status, Task-Vertrag und Branch-Cleanup bleiben getrennte Belege: der Vertrag trägt PR-Nummer, Head-SHA, Merge-SHA und den tatsächlichen Branch-Status; gelöscht wird der Branch nur durch den Cleanup-Workflow bzw. den Maintainer.

Der Pre-Commit-Hook prüft gestagte Dateien; CI prüft den PR-Diff gegen die Basis. `pnpm run verify:claims` ist der lokale Lauf.

`reconcile-claims --apply` schreibt nur Claims, deren Status oder Beleg sich geändert hat. Unbeteiligte Claim-Dateien und ein unverändertes Legacy-Register behalten ihren Dateistand. Der Lauf ist idempotent: ein bereits geschlossener Claim oder ein `DONE`-Task wird nicht erneut geschrieben. Auf `main` ruft `pretask` ihn bei sauberem Baum automatisch auf; die Registeränderung bleibt als lokaler Commit für den Maintainer sichtbar.

### Kommentar-Autorisierung (#693)

Ein Kommentar ändert Board-Zustand nur, wenn sein **verifizierter GitHub-Autor** in [`.lane-claims/actors.json`](../.lane-claims/actors.json) der passenden Rolle zugeordnet ist. Text im Body (`identity=…`, `ACCEPT`, `MERGED`, …) ist kein Nachweis und autorisiert nichts.

| Ereignis | Erlaubte Rollen (`actors.json`) | Zusätzliche Bindung |
| --- | --- | --- |
| `ACCEPT`, `PARTIAL`, `REJECT`, `MERGED`, `CLOSED` | `maintainers`, `users` | Issue-Kontext |
| `WORK_CLAIM`, `DONE`, `REVIEW_PENDING`, `REWORK`, `BLOCKED`, `UNRESOLVED`, `HANDOFF` | `workers`, `maintainers` | aktive `claim_id` |
| `PROGRESS`, `QUESTION`, `ANSWER` | `workers`, `maintainers`, `users` | kein Zustandswechsel |
| Issue-`CLAIM`, `RELEASE`, `HANDOFF` | `workers`, `maintainers`, `users` | Claim-ID |

- `ALLOWED` wird bei jedem Zustandsübergang geprüft. Unerlaubte Reihenfolgen, fremde Claim-IDs, Replays und unbekannte Autoren ändern nichts; sie erscheinen als `rejected` im `workGate` von `pretask` und als Warnung mit Kommentar-ID.
- Fehlt die Datei oder ist sie unlesbar, ist keine Rolle zuständig: fail-closed, kein Steuerbefehl wirkt.
- Sind Worker und Maintainer derselbe GitHub-Principal, meldet `pretask` die Befunde `shared-principal` und `no-exclusive-maintainer-principal`. Ein Verdikt (`ACCEPT`, `PARTIAL`, `REJECT`, `MERGED`, `CLOSED`) von einem Principal, der zugleich in `workers` steht, ist wirkungslos (`shared-principal-not-authorized`). Die technische Rollentrennung (#694) braucht einen eigenen Maintainer-Login, der nicht in `workers` steht; Worker-Ereignisse bleiben am gemeinsamen Login funktionsfähig.
- Ein Issue-`CLAIM` auf ein bereits laufendes Issue mit anderer Claim-ID ist ein `claim-conflict` und ändert nichts. `RELEASE`/`HANDOFF` eines fremden Claims ist `not-claim-holder`; nur `maintainers`/`users` dürfen fremde Claims freigeben oder übergeben.
- `IDENTITY_CLAIM`/`IDENTITY_RELEASE` wirken nur von `workers` oder `maintainers`. Unbekannte oder unzuständige Autoren reservieren nichts und stehen als `rejected` im Identity-Read; fehlt die Policy, ist der Lauf fail-closed.

## Eskalation

Eine Leiter, eine Klassifikation:

| Stufe | Bedeutung | Wer handelt |
| --- | --- | --- |
| `AUTO_FIX` | Doku-Marker, Format, Matrix, Katalog, Inventur | `pnpm run fix` oder Hook |
| `LOCAL_GATE` | außerhalb des Scopes | niemand |
| `REMOTE_CI` | Netz, Registry, Runner, Timeout | CI erneut starten; kein `BLOCKED` |
| `AGENT` | Struktur, Sektion, Test, Randfall | Agent; Issue |
| `BLOCKED` | Boot, Ledger-/Save-/RNG-Invariante, Geldpfad, kaputter Build | Mensch; fail-closed |

Nur `BLOCKED` hält die Arbeit an. Ein roter Test ist `ERR-4026` (`AGENT`) und wird ein Issue; Balance, ein schiefer Test oder ein Doku-Marker sind kein Notfall. `ERR-4014`/`ERR-4016` sind `REMOTE_CI` und werden wiederholt.

Issue-Scopes:

- `scope:main` blockiert global.
- `scope:lane/<domäne>` blockiert die eigene Lane und ihre Dependents.
- `scope:dependency/<lane>` blockiert nur abhängige Lanes.
- `remote-ci` blockiert nie; der Lauf wird wiederholt.
- Ein geschlossenes Issue wird bei erneutem Fingerprint wieder geöffnet; der Sweep schließt nur mit Original-Fingerprint, `<!-- repair: <sha> -->` und exakt grünem `main`.

`pnpm run escalation:plan` liest den letzten Gate-Befund und nennt die Stufe. Es gibt keine zweite Leiter und keine Ausnahme für Geld-, Ledger- oder Save-Regeln.

## Branch-Schutz

`main` nutzt einen klassischen Branch-Schutz, **kein** Ruleset:

- Required Status Checks: **keine**; keinen Cloud-Testlauf, der lokale Vor-PR-Nachweis ist die Autorität
- `strict: false`
- 0 erforderliche Reviews
- `enforce_admins: true`
- Force-Push und Löschen verboten
- keine Rulesets

Eine Stimme pro SHA: ein Lane-Push startet nur `ensure-pr.yml`; der PR-Lauf ist optional. Der lokale Vor-PR-Nachweis entscheidet; der Merge erfolgt durch den **Maintainer** nach Review und auf dem exakten Kopf, Agenten pushen nur ihren Lane-Branch. `promote` ist nur ein manueller Status-/Notausgang, kein Merge-Akteur. `integration` ist ein ausdrücklicher Notausgang. Details und API-Nachweise stehen in [`CI.md`](CI.md#branch-schutz).

## Maintainer-Protokoll

**Laufbeginn — Issue-Kommentar-Check:**
1. Scanne alle offenen Issues auf Kommentare seit dem letzten State-Snapshot
2. Neuer User- oder Agenten-Kommentar → `P0`, sofort
3. Neuer Worker-Statuskommentar ohne Frage → State aktualisieren, kein neues Ticket
4. State und Ruleset sind Hilfsmittel, nicht Wahrheit — bei Abweichung gewinnt die Realität

**Review-Protokoll (kein Test-Run — Tests liefen vor dem Push beim Worker):**
1. Lies den vollständigen Diff
2. Prüfe: Ist das, was das Issue verlangt hat? (Intention vs. Umsetzung)
3. Prüfe: Gibt es kausale Folgen in anderen Modulen? (Import-Ketten, State-Owner, Ledger-Invarianten)
4. Prüfe: Wurden die Regeln aus `AGENTS.md` eingehalten? (Allowlist, Lane-Phasen, Doku pro Commit)
5. Merge mit einem Satz was geprüft wurde — ODER — lehne ab mit einem Satz was fehlt
6. **Rebase-, Doku- und Generated-Drift behebt der Maintainer selbst**, nie zurück zum Worker: generierte Dateien über `node scripts/sync-generated.mjs --all`, Handdateien im eigenen Review-Checkout. Nur echte Code-Findings gehen an den Worker zurück.

**Neue Issues erstellen — Scope:**
- JA: Gameplay-Bugs, fehlende Features, erkannte Code-Muster die zu Konflikten führen
- NEIN: Issues über das Issue-Board selbst, Governance-Verbesserungen ohne Blocking-Effekt, Issues die nur existieren weil andere Issues schlecht beschrieben waren

**Aktive Identitäten — Laufbeginn:**
- Prüfe welche Worker aktive Claims haben (`pnpm run agent:pretask --json`)
- Weise freie, ungeblockte Issues freien Workern zu
- Bei Claim-Kollision: Maintainer entscheidet wer aufgibt — einmalig, klar, im Issue kommentiert

**Rekursions-Erkennung:**
Wenn ein Maintainer-Lauf hauptsächlich Governance-Issues über Governance produziert: STOP. Einen Kommentar ins aktuelle Control-Issue: "Governance-Drift erkannt." Nächster Lauf: ausschließlich `P0`/`P1`/Spiel-Bugs. Kein weiterer Governance-Ausbau in diesem Zyklus.

## Board-Status & Review-Status (Pflicht)

Der Issue-Board-Status ist fester Bestandteil des Workflows und muss von jedem Ort aus einsehbar sein (Desktop, Termux, Remote-Node). Ein State-Snapshot sichert den Fortschritt über Gerätegrenzen hinweg.

**state:JSON — Laufnachweis**
- Am Ende jedes Maintainer-Laufs wird eine `state:JSON` gepflegt (siehe `.verify-cache/agent-context.json` und die Lane-Claims unter `.lane-claims/`).
- Der Board-Snapshot `.lane-claims/board-state.json` wird ausschließlich nachgezogen, nie aus dem Gedächtnis geschrieben: `pnpm run board:sync -- --at <ISO>` liest offene Issues, offene PRs und `origin/main` und aktualisiert Kopf, Zähler und `openPrs`; Claims auf geschlossene Issues fallen heraus. Die Zeit kommt aus `--at`/`RBD_NOW` (kein Uhrenlesen). `pnpm run board:sync -- --check --at <ISO>` schreibt nichts und meldet Drift mit Exit 1.
- Sie zeigt: wo der letzte Lauf aufgehört hat, welche Issues aktualisiert wurden, welche Claims aktiv sind, welche PRs `review-waiting` sind.
- Der nächste Lauf liest die `state:JSON` zu Beginn und sieht direkt, welche Issues upgedatet sind und was zu tun ist.

**Worker-Statuspflicht (jedes Gerät)**
- Jeder Worker aktualisiert seinen eigenen Status immer als Issue-Kommentar am zugehörigen Issue: `CLAIM`, `RELEASE [A<n>] done <sha>`, Blocker, Testergebnis, Frage.
- Ein Issue-Kommentar ist ein Ticket-Update. Der Maintainer aktualisiert den Board-Zustand sofort bei neuem Kommentar (P0).
- Worker dürfen den Status nicht nur lokal halten; er muss im Issue sichtbar sein.

**Maintainer-Statuspflicht**
- Der Maintainer hält den Board-Zustand aktuell: Issues schließen, Labels setzen/entfernen, Claims zuweisen, `state:JSON` pflegen.
- Bei Claim-Kollision entscheidet der Maintainer einmalig und klar im Issue.
- Review-Stats: offene Reviews, `review-waiting`-PRs, akzeptierte/abgelehnte PRs sind Teil des Board-Status und werden bei jedem Lauf geprüft.

**Pflicht-Issues pinnen**
- P0-Issues (User- & Agenten-Kommentare) und P1-PRs (`review-waiting`) sind als Board-Pflicht gelistet und werden zu Beginn jedes Laufs gescannt.
- Kein neues Ticket entsteht ohne vorangegangene Prüfung des bestehenden Board-Zustands.

**Cron-Lock — atomar statt gelesen-geschrieben (#835)**
- Der Maintainer-Lock ist der Git-Ref `refs/heads/rbd-lock/maintainer-cron`, kein Feld in einem Issue-Body. `POST /git/refs` legt ihn genau einmal an; ein zweiter Lauf erhält 422 und verliert. Damit gibt es bei einem freien Lock genau einen Gewinner, auch geräteübergreifend.
- Der Lock zeigt auf einen Commit mit `owner`, `claim_id` und Aufnahmezeit in der Nachricht. Nach Ablauf der TTL (Standard 15 Minuten) wird ein hängender Lock genau einmal eingesammelt und neu reserviert.
- `node .cron/check-in.mjs --owner <name> --claim-id <id>` reserviert (Exit 0 erlangt, 1 belegt, 2 API-Fehler). `node .cron/check-out.mjs '<state-json>' --owner <name> --claim-id <id>` prüft zuerst den Halter, schreibt dann die `state:JSON` und gibt erst danach frei; ein fremder Lock gibt nichts frei (Exit 1). Ein Schreibfehler bricht vor der Freigabe ab, damit die TTL greift.
- 4xx ist eine Antwort, kein Netzfehler: der Client meldet den Status als Fehler (Exit 2) und wiederholt nur 5xx/429.

## Referenzen

- [`WORKFLOW.md`](WORKFLOW.md) — Pretask, Claim-Nutzung und Abschluss.
- [`CI.md`](CI.md) — Required-Gates, Zustände und Branch-Schutz.
- [`TESTING.md`](TESTING.md) — Testlinie und Governance-Testmatrix.
- [`INDEX.md`](INDEX.md) — Doku- und Vertragslandkarte.
