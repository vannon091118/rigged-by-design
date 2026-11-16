# Mechaniken: ein Ablauf, live aus GitHub

<!-- rbd-doc: managed -->

**Zweck:** Diese Seite beantwortet drei Fragen für Maintainer und Worker: **welcher Befehl startet Arbeit**, **welche Mechanik erzwingt was** und **warum** es sie gibt. Die Regeln selbst stehen in [`GOVERNANCE.md`](GOVERNANCE.md); hier steht ihre maschinelle Durchsetzung.

## Der eine Start

```bash
pnpm run agent:start --brief     # Board, Claims, Mechanik-Stand, nächste Befehle
pnpm run agent:start --json      # vollständig, für Werkzeuge
pnpm run agent:start -- --issue 874
pnpm run agent:start -- --dispatch   # Board-Overview-Ereignis auslösen
```

`agent:start` **ersetzt den lokalen Start**: Reihenfolge, Besitz, Postfach und Review-Lage kommen aus GitHub, nicht aus `.lane-claims/board-state.json`, `.lanes/identity.json` oder einer Claim-Datei. Ein frischer Klon ohne diese Dateien liefert dasselbe Ergebnis.

Die einzige Voraussetzung ist ein Token in der Umgebung:

| Umgebung | Woher das Token kommt | Was im Repo liegt |
| --- | --- | --- |
| Cloud/Agent | Projekt-Secret `GH_TOKEN` (Settings → Project settings → Secrets) | nichts |
| Lokal | `export GH_TOKEN=…` in der Shell | nichts |
| GitHub Actions | Repository-Secret, `${{ secrets.GITHUB_TOKEN }}` | nichts |

Ein Token wird **nie** committet, auch nicht verschleiert: ein Secret im Repo ist ein veröffentlichtes Secret. `scripts/lib/github-rest.mjs` liest ausschließlich `GH_TOKEN` oder `GITHUB_TOKEN`.

`agent:pretask` bleibt für die tiefe lokale Prüfung (Arbeitsbaum, Impact-Plan, Task-Vertrag, Laufbudget). Es ist kein zweiter Einstieg: `agent:start` nennt es nur, wenn lokale Arbeit tatsächlich existiert.

## Was der Ablauf prüft

| Reihenfolge | Prüfung | Blockiert | Auflösung, die der Blocker nennt |
| --- | --- | --- | --- |
| 1 | Repository bestimmbar (`origin` oder `RBD_REPO`) | ja | `git remote add origin …` |
| 2 | Board-Token vorhanden | ja | Token als Projekt-/Repository-Secret setzen |
| 3 | Board lesbar (Issues + offene PRs) | ja | Leserecht prüfen; kein Bericht aus Vermutungen |
| 4 | Claim je Issue aus dem Kommentarverlauf | ja, bei fremdem Claim am gewählten Issue | `RELEASE`/`HANDOFF` abwarten oder freies Issue nehmen |
| 5 | Actor-Policy lesbar (`.lane-claims/actors.json`) | nein, Warnung | Datei reparieren; ohne sie autorisiert kein Kommentar |
| 6 | Kein Skript ohne Aufrufer | ja | einbinden oder entfernen, im selben Commit belegt |

Reihenfolge und Auswahl folgen `orderBoard`: Priorität, Zustand, dann das **älteste** Issue. Dieselbe Funktion nutzt `board:overview`; es gibt keine zweite Klassifikation.

## Mechanik-Stand

Der Lauf klassifiziert jedes Skript unter `scripts/`:

| Status | Bedeutung | Konsequenz |
| --- | --- | --- |
| `FLOW` | dieser Lauf prüft und blockiert selbst | keine Aktion |
| `AUTO` / `WIRED` | von Hook, Workflow oder `package.json` erreichbar | keine Aktion |
| `ORPHAN` | niemand referenziert es | **Blocker**: einbinden oder entfernen |

Damit gibt es kein „vergessenes“ System mehr: was nicht erreichbar ist, hält den Start an, statt still zu verrotten. Was erreichbar, aber in keinem Ablauf ist, wird als Hinweis genannt und prioritär eingebunden oder entfernt.

## Ereignis-Hook und Webhook

- **Aktiv ohne Server:** `.github/workflows/board-overview.yml` läuft auf `issues`, `issue_comment`, `pull_request` und `repository_dispatch` und pflegt genau einen markierten Übersichtskommentar am Board-Issue #677. Er führt keine Tests, Gates, Builds oder APKs aus.
- **Auslösen ohne Empfänger:** `pnpm run agent:start -- --dispatch` (oder `POST /repos/<owner>/<repo>/dispatches` mit `{"event_type":"board-refresh"}`).
- **Klassischer Repo-Webhook:** am 2026-11-16 geprüft — es ist **keiner** registriert. Ein Webhook braucht eine erreichbare Empfänger-URL; dieses Repo betreibt keinen Server. `pnpm run webhook:install -- --check` belegt den Ist-Stand, `--url <https-empfänger> --secret-file <datei>` legt ihn idempotent an. Ohne Empfänger wäre ein Hook ein vergessenes System, deshalb bleibt `repository_dispatch` der aktive Weg.

## Rollen

- **Worker:** `agent:start --brief` → freies Issue claimen → Branch → `verify:fast` → Push + PR → `RELEASE`.
- **Maintainer:** `agent:start --brief` → wartende Reviews, PRs und Blocker → Verdikt, Merge, Closeout. Die Übersicht nennt je Zeile den nächsten Akteur und den Grund.

## Pflege

- Neue Mechanik heißt: Eintrag in `package.json`, Hook oder Workflow **und** eine Zeile in dieser Tabelle. Ein Skript ohne Aufrufer ist rot.
- Eine Regel, die mechanisch prüfbar ist, gehört in den Ablauf, nicht in Prosa. Prosa bleibt nur für Entscheidungen, die kein Werkzeug treffen kann.
