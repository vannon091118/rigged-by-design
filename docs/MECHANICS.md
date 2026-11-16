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

## Kein Workflow, kein Actions

Der Start laeuft lokal ueber die GitHub-API. Es gibt **keinen** Actions-Job, der ihn ausfuehrt: es existiert kein Workflow mehr (FREEZE-0), und `docs/CI.md` sagt das ausdruecklich. Ein gesperrtes Actions-Konto kann den Start damit nicht mehr blockieren.

| Quelle | Weg | Wann |
| --- | --- | --- |
| GitHub-Konnektor / REST | `scripts/lib/github-rest.mjs` -> `github-rest-fetch.mjs` (fetch gegen `api.github.com`) | immer, sobald ein Token da ist |
| `gh`-CLI | `gh auth token` als dritte Credential-Stufe | lokal und in der Cloud, wenn `gh` vorhanden ist |
| Git-Credential-Helper | `git credential fill` | letzte Stufe, wenn `gh` fehlt |

Fehlt `gh` ganz, wird **nichts nachgeladen** (FREEZE-0): `scripts/lib/gh-bootstrap.mjs` stellt nur fest, ob die CLI da ist, und nennt den Installationsweg. Der Start scheitert daran nicht; Lesen und Kommentieren laufen ueber den Token-Pfad.

Es gibt keinen Workflow mehr: die Board-Übersicht erzeugt der Maintainer bei Bedarf mit `node scripts/board-overview.mjs --markdown` aus Live-Daten.

### Nachweisstand (2026-11-16)

- **Frischer Klon ohne Env-Credentials:** endet mit **einem** Blocker, der die Variable nennt — `export GH_TOKEN=<token>`. Geprueft: `GH_TOKEN -> GITHUB_TOKEN -> githubPAT -> GITHUB_PAT -> GH_PAT -> RBD_GH_TOKEN -> gh auth token -> git-credential-helper`.
- **Live-Board-Lauf mit Environment-Token (2026-11-16):** `pnpm run agent:start --brief` liest Board, Claims und offene PRs und nennt genau eine naechste Aktion; der Push auf einen Lane-Branch lief ohne Login durch.
- **Kein Actions noetig:** der Beweislauf auf Actions wurde entfernt. Die Kontosperre („The job was not started because your account is locked due to a billing issue.", Annotation am Lauf 43785194697) betrifft den Start nicht mehr.
- **Nicht herstellbar:** ein serverseitiger Merge-Schutz als Ruleset bzw. Required-Check — dafuer fehlen Admin-/App-Rechte, und ohne Actions gibt es keinen Job, der ihn setzt.

## Ein Befehl, dann Arbeit

`pnpm run agent:start --brief` ist der einzige Start. Er liest Board, Claims und PRs aus GitHub, **fuehrt pretask im selben Lauf aus** und nennt am Ende genau eine naechste Aktion mit Befehl.

| Was | Woher | Blockiert? |
| --- | --- | --- |
| Board, Besitz, Review-Lage | Issues, Labels, `CLAIM`/`RELEASE` | ja: fremder Claim oder fehlende Credentials |
| Arbeitsbaum, Task-Vertrag, Impact, Budget | `scripts/pretask.mjs` (im selben Lauf) | ja: korruptes WIP, ungueltiger Vertrag |

### Keine lokale Merge-Queue

FREEZE-0 hat die Queue zurueckgebaut: keine Plan-Revision, keine Session-ACKs, kein Plan-Hash, kein eigener Lock. Die Integrationsautoritaet liegt bei GitHub (Ruleset, Review, exakter Head) und beim Maintainer, der einen PR nach dem anderen prueft. Ein Worker-ACK ist keine Merge-Berechtigung.

### Webhook: eingeordnet, nicht entschieden

Der Empfaenger prueft die HMAC-Signatur und ordnet die Delivery ein (Art, Nummer, Aktion, Kopf). Er entscheidet nichts und nennt keine Queue-Aktion; Review und Merge bleiben beim Maintainer.

## Rollen

- **Worker:** `agent:start --brief` → freies Issue claimen → Branch → `verify:fast` → Push + PR → `RELEASE`.
- **Maintainer:** `agent:start --brief` → wartende Reviews, PRs und Blocker → Verdikt, Merge, Closeout. Die Übersicht nennt je Zeile den nächsten Akteur und den Grund.

## Pflege

- Neue Mechanik heißt: Eintrag in `package.json`, Hook oder Workflow **und** eine Zeile in dieser Tabelle. Ein Skript ohne Aufrufer ist rot.
- Eine Regel, die mechanisch prüfbar ist, gehört in den Ablauf, nicht in Prosa.

