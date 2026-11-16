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
| 1 | `GH_TOKEN` | Cloud-Agent, Projekt-Secret | Vorrang, wenn gesetzt |
| 2 | `GITHUB_TOKEN` | GitHub Actions | automatisch injiziert, keine Einrichtung |
| 3 | `gh auth token` | lokal | nach `gh auth login` |
| 4 | `git credential fill` | lokal | vorhandener Credential-Helper |

Fehlt jede Quelle, endet der Lauf mit **genau einem** Befehl: `gh auth login`. Kein Stacktrace, kein stiller Fallback.

Im Repo liegt kein Secret — auch nicht kodiert: ein Secret in der Datei wäre ein veröffentlichtes Secret. Board-Zustand, Claims und Phasen stammen ausschließlich aus Issues, Labels, Kommentaren und PRs; `GITHUB_TOKEN` mit `issues: read`, `pull-requests: read`, `contents: read` genügt. GitHub Projects v2 wird nicht verwendet.

## Was der Ablauf prüft

| Reihenfolge | Prüfung | Blockiert | Auflösung, die der Blocker nennt |
| --- | --- | --- | --- |
| 1 | Repository bestimmbar (`origin`, `RBD_REPO`, `GITHUB_REPOSITORY`) | ja | `git remote add origin …` |
| 2 | Credential-Quelle vorhanden | ja | `gh auth login` |
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
| `merge-queue.mjs` + `lib/merge-queue.mjs` | Merge-Reihenfolge leitet `agent:start` aus Issues, Claims und PRs ab |

Ihre Tests und Doku-Verweise sind mitentfernt: `auto-resolve.test.ts`, `pr-watcher.test.ts`, `merge-queue.test.ts`, `docs/MERGE-QUEUE.md`. Die Reparatur-Auswertung `lib/repair-plan.mjs` bleibt und wird von `repair-plan.test.ts` geprüft.

### Eingebunden

| Mechanik | Befehl | Wirkung |
| --- | --- | --- |
| `release-impact.mjs` | `pnpm run release:impact` | APK-Relevanz eines Diffs; `agent:start` führt sie aus |
| `ci-tag-release.mjs` | `pnpm run release:tag` | Tag und Release aus `package.json`, der dokumentierte lokale Release-Pfad |
| `local-ci.mjs --profile=mechanics` | `pnpm run test:mechanics` | lange Nachweise; `agent:verify --ci` startet sie lokal |

## Ereignis-Workflows

- **`Agent Start`** (`.github/workflows/agent-start.yml`): läuft auf `push`, `pull_request` und `workflow_dispatch`, führt `pnpm run agent:start --brief` mit dem automatisch injizierten `secrets.GITHUB_TOKEN` gegen das echte Repo aus und schreibt das Ergebnis in die Job-Summary. Er führt keine Tests, Gates, Builds oder APKs aus.
- **`Board Overview`** (`.github/workflows/board-overview.yml`): pflegt genau einen markierten Übersichtskommentar am Board-Issue #677 auf `issues`, `issue_comment`, `pull_request` und `repository_dispatch`.
- **Dispatch:** `pnpm run agent:start -- --dispatch` sendet `repository_dispatch` mit `board-refresh` und braucht `contents: write`. Ein klassischer Repo-Webhook bleibt entfernt, solange keine erreichbare Empfänger-URL existiert (`pnpm run webhook:install -- --check` belegt den Stand).

## Rollen

- **Worker:** `agent:start --brief` → freies Issue claimen → Branch → `verify:fast` → Push + PR → `RELEASE`.
- **Maintainer:** `agent:start --brief` → wartende Reviews, PRs und Blocker → Verdikt, Merge, Closeout. Die Übersicht nennt je Zeile den nächsten Akteur und den Grund.

## Pflege

- Neue Mechanik heißt: Eintrag in `package.json`, Hook oder Workflow **und** eine Zeile in dieser Tabelle. Ein Skript ohne Aufrufer ist rot.
- Eine Regel, die mechanisch prüfbar ist, gehört in den Ablauf, nicht in Prosa.
