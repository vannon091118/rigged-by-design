# Mechaniken: ein Ablauf, live aus GitHub

<!-- rbd-doc: managed -->

**Zweck:** Diese Seite beantwortet drei Fragen für Maintainer und Worker: **welcher Befehl startet Arbeit**, **welche Credential-Quelle wann greift** und **welche Mechanik was erzwingt**. Die Regeln selbst stehen in [`GOVERNANCE.md`](GOVERNANCE.md); hier steht ihre maschinelle Durchsetzung.

## Der eine Start

```bash
pnpm run agent:start --brief     # Board, Claims, Mechanik-Inventur, nächste Befehle
pnpm run agent:start --json      # vollständig, für Werkzeuge
pnpm run agent:start -- --issue 874
pnpm run agent:start -- --dispatch   # Ereignis-Workflow auslösen
```

Reihenfolge, Besitz, Postfach und Review-Lage kommen aus GitHub, nicht aus `.lane-claims/board-state.json`, `.lanes/identity.json` oder einer Claim-Datei. Ein frischer Klon ohne diese Dateien liefert dasselbe Ergebnis.

## Credential-Kette

Eine Auflösungsstelle: `scripts/lib/credentials.mjs`. Kein zweiter Zustand, keine Config-Datei, kein gespeicherter Token.

| Reihenfolge | Quelle | Greift in | Anmerkung |
| --- | --- | --- | --- |
| 1 | `GH_TOKEN` | Projekt-Secret, Cloud-Agent | Vorrang, wenn gesetzt |
| 2 | `GITHUB_TOKEN` | CI, Container | automatisch injiziert |
| 3 | `githubPAT` | Cloud-Shell dieser Umgebung | Connector-Token, das die Shell stellt |
| 4 | `GITHUB_PAT`, `GH_PAT`, `RBD_GH_TOKEN` | Altzustände | dieselbe Prüfung, nur anderer Name |
| 5 | `gh auth token` | lokal | bereits angemeldete CLI |
| 6 | `git credential fill` | lokal | vorhandener Credential-Helper |

Fehlt jede Quelle, endet der Lauf mit **genau einem** Befehl, der die Variable nennt: `export GH_TOKEN=<token>`. Kein Stacktrace, kein stiller Fallback, und **kein** interaktiver Login als Voraussetzung: alle Leser und Schreiber gehen über denselben Token-Pfad, `gh` ist Client, nicht Bedingung.

Im Repo liegt kein Secret — auch nicht kodiert: ein Secret in der Datei wäre ein veröffentlichtes Secret. Board-Zustand, Claims und Phasen stammen ausschließlich aus Issues, Labels, Kommentaren und PRs; `GITHUB_TOKEN` mit `issues: read`, `pull-requests: read`, `contents: read` genügt. GitHub Projects v2 wird nicht verwendet.

## Was der Ablauf prüft

| Reihenfolge | Prüfung | Blockiert | Auflösung, die der Blocker nennt |
| --- | --- | --- | --- |
| 1 | Repository bestimmbar (`origin`, `RBD_REPO`, `GITHUB_REPOSITORY`) | ja | `git remote add origin …` |
| 2 | Credential-Quelle vorhanden | ja | `export GH_TOKEN=<token>` |
| 3 | Board lesbar (Issues + offene PRs) | ja | Leserecht prüfen; kein Bericht aus Vermutungen |
| 4 | Claim je Issue aus dem Kommentarverlauf | ja, bei fremdem Claim am gewählten Issue | `RELEASE`/`HANDOFF` abwarten oder freies Issue nehmen |
| 5 | Actor-Policy lesbar (`.lane-claims/actors.json`) | nein, Warnung | Datei reparieren; ohne sie autorisiert kein Kommentar |
| 6 | Kein Skript ohne Aufrufer (`ORPHAN`) | ja | einbinden oder entfernen, im selben Commit belegt |

Reihenfolge und Auswahl folgen `orderBoard`: Priorität, Zustand, dann das **älteste** Issue. Dieselbe Funktion nutzt `board:overview`; es gibt keine zweite Klassifikation.

## Mechanik-Inventur

| Status | Bedeutung | Konsequenz |
| --- | --- | --- |
| `FLOW` | dieser Lauf prüft und blockiert selbst | keine Aktion |
| `AUTO` / `WIRED` | von Hook, Workflow, `package.json` oder einem erreichbaren Skript aufgerufen | keine Aktion |
| `UNUSED` | nur aus Tests oder Doku bekannt | Warnung + Entscheidung im Lauf sichtbar |
| `ORPHAN` | niemand referenziert es | **Blocker** |

Im Lauf wird zusätzlich die APK-Relevanz über `release:impact` ausgeführt und angezeigt; sie ist damit erreichbar und nicht mehr nur dokumentiert.

### Entfernt (redundant oder widersprüchlich)

| Mechanik | Grund |
| --- | --- |
| `auto-resolve.mjs` | Reparatur brauchte einen PAT mit Sonderrechten; die Workflows reparieren nichts |
| `pr-watcher.mjs` | ohne Cloud-Testlauf gibt es kein `workflow_run`, an dem er hängen könnte |
| `ci-plan.mjs` (CLI) | Cloud-Plan ohne Cloud-Job; die Bibliothek bleibt für `promote` und Tests |
| `gate-matrix.mjs` | Matrix für Actions-Jobs, die es nicht mehr gibt |
| `ci-long-checks.mjs` | startete `long-checks.yml`, das entfernt ist |

Ihre Tests und Doku-Verweise sind mitentfernt: `auto-resolve.test.ts`, `pr-watcher.test.ts`, `docs/MERGE-QUEUE.md`. Die Reparatur-Auswertung `lib/repair-plan.mjs` bleibt und wird von `repair-plan.test.ts` geprüft.

### Eingebunden

| Mechanik | Befehl | Wirkung |
| --- | --- | --- |
| `release-impact.mjs` | `pnpm run release:impact` | APK-Relevanz eines Diffs; `agent:start` führt sie aus |
| `ci-tag-release.mjs` | `pnpm run release:tag` | Tag und Release aus `package.json`, der dokumentierte lokale Release-Pfad |
| `local-ci.mjs --profile=mechanics` | `pnpm run test:mechanics` | lange Nachweise; `agent:verify --ci` startet sie lokal |
| `merge-queue.mjs` + `lib/merge-queue.mjs` | `pnpm run merge:queue -- --check` | Reihenfolge, Plan-Hash und ACK-Lage aus den Ereignissen an #913; `promote` fragt dieselbe Freigabe vor dem Merge |

## Kein Workflow, kein Actions

Der Start laeuft lokal ueber die GitHub-API. Es gibt **keinen** Actions-Job, der ihn ausfuehrt: ein solcher Workflow wurde entfernt, und `docs/CI.md` bleibt bei den vier Repository-Verwaltungs-Workflows. Ein gesperrtes Actions-Konto kann den Start damit nicht mehr blockieren.

| Quelle | Weg | Wann |
| --- | --- | --- |
| GitHub-Konnektor / REST | `scripts/lib/github-rest.mjs` -> `github-rest-fetch.mjs` (fetch gegen `api.github.com`) | immer, sobald ein Token da ist |
| `gh`-CLI | `gh auth token` als dritte Credential-Stufe | lokal und in der Cloud, wenn `gh` vorhanden ist |
| Git-Credential-Helper | `git credential fill` | letzte Stufe, wenn `gh` fehlt |

Fehlt `gh` ganz, laedt `scripts/lib/gh-bootstrap.mjs` die CLI aus dem offiziellen Release nach `~/.local/bin` (ohne sudo, kein Systempaket) und meldet den Pfad. Der Download ist nur fuer schreibende `gh`-Aufrufe noetig: Lesen und Kommentieren laufen ueber den Token-Pfad. Authentifiziert wird aus der Umgebung, nie interaktiv. Abschaltbar mit `RBD_NO_GH_INSTALL=1`, Zielverzeichnis ueber `RBD_GH_DIR`.

Der Ereignis-Workflow `Board Overview` bleibt als reine Repository-Verwaltung bestehen (keine Tests, Gates, Builds). Er ist keine Voraussetzung fuer den Start.

### Nachweisstand (2026-11-16)

- **Frischer Klon ohne Env-Credentials:** endet mit **einem** Blocker, der die Variable nennt — `export GH_TOKEN=<token>`. Geprueft: `GH_TOKEN -> GITHUB_TOKEN -> githubPAT -> GITHUB_PAT -> GH_PAT -> RBD_GH_TOKEN -> gh auth token -> git-credential-helper`.
- **Live-Board-Lauf mit Environment-Token (2026-11-16):** `pnpm run agent:start --brief` liest #913 und die offenen PRs, berechnet die Queue und nennt genau eine naechste Aktion. `pnpm run verify:board` ist gruen (`OPEN - claimed-self`), der Push auf `lane/governance/merge-queue-913` lief ohne Login durch.
- **Queue regeneriert aus dem Verlauf:** Revision 1, Plan `c47e19487d12`, `main` `a07952f`; #948 READY auf Position 1, #952 HOLD auf Position 2. Quelle sind die Kommentare 6905795513 (`SESSION_JOIN`), 6905796238 (`PLAN`) und 6905800667 (`ACK`).
- **Kein Actions noetig:** der Beweislauf auf Actions wurde entfernt. Die Kontosperre („The job was not started because your account is locked due to a billing issue.", Annotation am Lauf 43785194697) betrifft den Start nicht mehr.
- **Nicht herstellbar:** ein serverseitiger Merge-Schutz als Ruleset bzw. Required-Check — dafuer fehlen Admin-/App-Rechte, und ohne Actions gibt es keinen Job, der ihn setzt.

## Ein Befehl, dann Arbeit

`pnpm run agent:start --brief` ist der einzige Start. Er liest Board, Claims und PRs aus GitHub, **fuehrt pretask im selben Lauf aus** und berechnet die Merge-Queue aus #913. Am Ende steht genau eine naechste Aktion mit Befehl.

| Was | Woher | Blockiert? |
| --- | --- | --- |
| Board, Besitz, Review-Lage | Issues, Labels, `CLAIM`/`RELEASE` | ja: fremder Claim oder fehlende Credentials |
| Arbeitsbaum, Task-Vertrag, Impact, Budget | `scripts/pretask.mjs` (im selben Lauf) | ja: korruptes WIP, ungueltiger Vertrag |
| Merge-Reihenfolge und ACKs | Ereignisse an #913 | ja: kein Merge ohne bestaetigte Revision |

### Merge-Queue (#913)

`pnpm run merge:queue -- --check` zeigt Position, Status und Grund je offenem PR. Die Queue ist abgeleitet: die Ereignis-Kommentare an #913 sind die Quelle, es gibt keine zweite Liste und keine lokale Queue-Datei.

Ereignisse: `MERGE_SESSION_JOIN role=worker session=s1` · `MERGE_PLAN rev=1 hash=<12> main=<sha>` mit `pr=<nr> head=<sha>`-Zeilen · `MERGE_ACK session=s1 role=worker plan=<12> main=<sha>` · `MERGE_SESSION_LEAVE session=s1`.

- Nur **Position 1** mit ACK **aller** aktiven Sessions ist `READY`; alles andere ist `HOLD` oder `BLOCKED`.
- Der Plan-Hash bindet Revision, `main`-SHA und die geordnete PR-Liste. Ein ACK gilt nur fuer genau diesen Hash, nur von einer registrierten Session und nur nach dem Plan.
- `main`-Drift, ein geaenderter PR-Kopf, ein PR ausserhalb des Plans und ein manipulierter Plan blockieren. Ein nicht lesbares Board ist `HOLD`, nie Erfolg.
- `scripts/promote.mjs` prueft dieselbe Freigabe am Merge-Punkt (`mergeAuthorization`); damit kann kein Skript an der Queue vorbei mergen.

### Eine Aktion je Zustand

Die Queue endet nicht mit einem Vorschlag, sondern mit **genau einer** Aktion. Welche das ist, entscheidet der Zustand; die leere Queue ist ein eigener Zustand und nie ein ACK.

| Zustand | Bedingung | Die eine naechste Aktion |
| --- | --- | --- |
| `IDLE` | kein offener PR in der Queue | `pnpm run board:sync -- --check` |
| `PLAN_MISSING` | PR offen, aber kein Plan, `main`-Drift oder manipulierter Plan | `pnpm run merge:queue -- --publish` |
| `ACK_MISSING` | Plan da, aber keine Session oder ein ACK fehlt | `MERGE_SESSION_JOIN` bzw. `... --ack --session <id>` |
| `READY` | Position 1 mit ACK aller aktiven Sessions | `gh pr merge <nr> --squash --match-head-commit <sha>` |
| `WAITING` | ACKs vollstaendig, aber Position > 1 oder Kopf abweichend | `pnpm run merge:queue -- --check` |

`nextAction()` in `scripts/lib/merge-queue.mjs` ist die einzige Stelle, die das entscheidet; CLI und `agent:start` lesen nur noch dieses Ergebnis. Fuenf Faelle sind in `merge-queue.test.ts` festgehalten, darunter „leere Queue bleibt `IDLE`, auch ohne Plan und ohne Session“.

## Rollen

- **Worker:** `agent:start --brief` → freies Issue claimen → Branch → `verify:fast` → Push + PR → `RELEASE`.
- **Maintainer:** `agent:start --brief` → wartende Reviews, PRs und Blocker → Verdikt, Merge, Closeout. Die Übersicht nennt je Zeile den nächsten Akteur und den Grund.

## Pflege

- Neue Mechanik heißt: Eintrag in `package.json`, Hook oder Workflow **und** eine Zeile in dieser Tabelle. Ein Skript ohne Aufrufer ist rot.
- Eine Regel, die mechanisch prüfbar ist, gehört in den Ablauf, nicht in Prosa.

