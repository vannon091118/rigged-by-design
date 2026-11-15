# Rigged by Design

<!-- rbd-doc: managed -->

> **Erster Befehl:** `pnpm run agent:pretask --json`

Dieser Kurzvertrag ist der Einstieg. Das **Issue-Board ist die Steuerungswahrheit**: Auftrag, Priorität, Besitz, Review und Merge-Beleg stehen dort. Dieses Dokument nennt Rollen, Grenzen und Befehle; Tiefenwissen steht in den verlinkten Dokumenten unter `docs/`.

## Eine Quelle pro Datentyp

| Datentyp | Autoritative Quelle |
| --- | --- |
| Auftrag, Akzeptanz, fachliche Entscheidung | GitHub Issue |
| Reihenfolge und Priorität | Issue-Labels + [kanonische Priorität](docs/GOVERNANCE.md#maintainer-prioritäten-kanonisch) |
| Besitz und Übergabe | `CLAIM`- und `RELEASE`-Kommentare am Issue |
| Identität | Identity-Board plus verifizierte Claim-ID |
| Diff, Reviews, Checks, Merge-Status | GitHub Pull Request und seine Ereignisse |
| Laufzeit-Snapshot und Cursor | `.lane-claims/board-state.json`, abgeleitet und regenerierbar (`pnpm run board:sync`) |
| Pfad-Allowlist und Task-Phase | `.lane-claims/` — nur Kollisions- und Ausführungssperre |
| Rollen-, Merge- und Sicherheitsregeln | [`docs/GOVERNANCE.md`](docs/GOVERNANCE.md) |

Kein zweiter Ort entscheidet über Besitz, Priorität oder Status. Weicht eine lokale Datei vom Issue ab, gewinnt das Issue; die Sperre wird nachgezogen, statt Arbeit zu blockieren. Ein Snapshot behauptet keine Vollständigkeit, die er nicht belegt.

## Rollen

Zwei Rollen, ein Board. Wer was darf, steht verbindlich in [`docs/GOVERNANCE.md`](docs/GOVERNANCE.md#rollen-und-lanes); die ausführende Schleife in [`docs/AGENT-ONBOARDING.md`](docs/AGENT-ONBOARDING.md).

| Rolle | Identität | Darf | Darf nicht |
| --- | --- | --- | --- |
| **Maintainer** | der benannte Reviewer und Orchestrator | Triage, Priorisierung, Zuweisung, Konfliktentscheidung, Review-Verdikt `ACCEPT`/`PARTIAL`/`REJECT`, Merge nach `main`, Release-Tags, Issues und PRs schließen oder wiedereröffnen | eine Spiel-Lane ohne eigenen Claim führen |
| **Agent** | `LIILITH`, `Shinon` oder `Jenova` (global im Identity-Board reserviert) | Issue und Kommentare lesen, `CLAIM`/`RELEASE` kommentieren, eigenen Branch pushen, PR gegen `main` öffnen, Review-Fragen beantworten | mergen, auf `main` pushen, Issues oder PRs schließen/wiedereröffnen, Tags setzen, fremden Claim übernehmen |
| **User** | der Eigentümer | Produktentscheidungen und Richtungswechsel | — |

Jeder Kommentar nennt Identität und Claim-ID. Ein Agent bearbeitet genau ein Issue pro Turn.

## Lebenszyklus eines Issues

`NEW → TRIAGE → READY → CLAIMED → IMPLEMENTING → REVIEW_WAITING → ACCEPTED/PARTIAL/REJECTED → MERGED → AFTERCARE → CLOSED`

`BLOCKED` ist ein Zustand mit konkretem Blocker, Owner und nächstem Ereignis, kein Endlager. Nicht jedes Issue durchläuft alle Stufen. Label, Kommentar und PR müssen dieselbe Phase ausdrücken; ein Status ohne Beleg zählt nicht.

## Verbindlicher Issue-Closeout (Issue #920, P0)

Ein Issue darf nur geschlossen werden, wenn ein vollständiger Closeout-Beleg vorliegt:

- **Ergebnis:** Was wurde umgesetzt oder warum wurde abgeschlossen ohne Codeänderung?
- **Verknüpfter PR/Commit:** PR-Nummer, Head-SHA und Merge-SHA (falls gemergt)
- **Verifizierter Beleg:** Merge auf main oder begründeter Abschluss ohne Code
- **Erfüllte Akzeptanzkriterien:** Welche ACs aus dem Issue sind erfüllt?
- **Verbleibende Restpunkte:** Was bleibt offen, mit Folge-Issue?
• **Autorisierter schließender Akteur:** Nur Maintainer oder User dürfen schließen

Worker dürfen den Abschluss vorbereiten (RELEASE + PR) und Nachweise liefern, aber nicht eigenmächtig schließen oder die Prüfung umgehen. Ein `RELEASE done <sha>` ohne PR und ohne Closeout-Beleg gilt als nicht erledigt.

## Verbindlicher Pin- und State-Vertrag (Issue #887, P1)

Drei angeheftete Issues wurden entwirrt (#561, #563, #677). Es gilt ein bewusst kleines, eindeutiges Pin-Set:

- **#677 (aktiv gepinnt):** Zentraler Maintainer-/Board-Vertrag mit Badge-Matrix und state:JSON-Protokoll. Der Pin-Status ist technisch bestätigt.
- **#561 (entpinnt):** Historisches Review-Log ohne aktuellen Inhalt (leerer Tabellenheader). Nicht als aktive Steuerungsquelle lesen.
- **#563 (entpinnt):** Historischer Backlog-Snapshot mit veralteten SHA-Referenzen. Nicht als aktive Steuerungsquelle lesen.

**Regeln:**

1. **Ein einziger aktiver Pin.** Zu jedem Zeitpunkt trägt genau ein Issue das GitHub-Pin-Label. #677 ist der zentrale Maintainer-/Board-Vertrag.

2. **Snapshot-/Cursor-Datei ist abgeleitet.** `.lane-claims/board-state.json` und alle state:JSON-Dateien sind abgeleitete Datenquellen, nicht der Ersatz für Issue-Ereignisse. Bei Abweichung gewinnt das GitHub-Issue.

3. **Alle Docs verlinken denselben Vertrag.** `AGENTS.md`, `WORKFLOW.md`, `GOVERNANCE.md` und `PROMPTS.md` verweisen alle auf #677 als den kanonischen Board-Vertrag.

## Identitaetsgebundene ID-Postfache (Issue #920, P0)

Jede handlungsrelevante Nachricht am Board muss eindeutig adressiert sein:

- GitHub Issue-/PR-Nummer und Kommentar-/Review-/Event-ID
- Authentifizierter Absender mit verifizierter Rolle/Capability
- Eindeutiger Empfänger bzw. Empfängerkreis
- Empfänger-Identitäts-ID und Session-ID (sofern sessiongebunden)
- Nachrichtentyp und erwartete Aktion
- Zeitstempel und persistente Cursor-/Gelesen-Markierung
- Status: NEW, ACKNOWLEDGED, IN_PROGRESS, WAITING, RESOLVED, REJECTED
- Nächster Akteur sowie Verweis auf Antwort/Entscheidung/Closeout

Jede Nachricht wird genau einmal verarbeitet. Unklare Adressierung geht in die Maintainer-Triage, nicht ins Leere. Ein ACK eines Workers ist keine Maintainer-Freigabe und umgekehrt.

## Zehn unverhandelbare Regeln

1. **Claim vor Read, Pretask vor dem Edit.** Besitz ist der `CLAIM`-Kommentar am Issue (`CLAIM [A<n>] <agent> <UTC> scope=… plan=…`); erst danach wird Code gelesen, ein Issue mit aktivem fremdem Claim ist tabu. Danach `pnpm run agent:pretask --json`: der Lauf holt `origin/main` (ein Fetch pro Minute, nie blockierend), prüft den Issue-Claim als Startgate (`RBD_AGENT`/`--agent`: fremder Claim blockiert, fehlender Claim verlangt den Kommentar) und blockiert bei offenem `gate-failure`-Issue, fehlendem Impact-Plan oder Claim-Problem (`ERR-4019`). Ein nicht leerer Baum wird adoptiert (Regel 2). Der Task-Vertrag `.lane-claims/tasks/<taskId>.json` protokolliert Phase, Befunde und nächste Aktion als **Mechanik**, nicht als Board-Wahrheit; `pretask` gibt `READY`, `CONTINUE`, `AFTERCARE`, `MERGE_PENDING` oder `BLOCKED` aus.
2. **Fremdes WIP gibt es nicht.** Jede unfertige Änderung ist kompatibel, unvollständig oder korrupt und wird als eigene Arbeit angenommen; nur korrupte Freeze-, Ledger-, Save-, RNG- oder Boot-Pfade halten den Start an (`ERR-4030`). Gestaged wird nur, was der Claim deckt. `reset --hard`, `clean -xdf`, `stash`, `push --force` und `branch -D` sind für Agenten verboten; der Maintainer nutzt sie ausschließlich in seinem eigenen Review-Checkout, nie im geteilten Arbeitsbaum.
3. **Ein Zustandsbesitzer.** `world-store` hält Welt, Ledger, PRNG, Uhr und Save; `src/core/` bleibt headless. UI und Renderer lesen den Snapshot, sie führen keinen zweiten Spielzustand.
4. **Geld ist integer und gebucht.** VaCoins sind Mikro-Einheiten; jede Bewegung ist eine Ledger-Zeile, jede Quelle außer `EXTERNAL_WORLD` ist verboten.
5. **Determinismus ist Pflicht.** Kein `Math.random()`, `Date.now()`, `new Date()` oder Krypto-Zufall in Spielcode (`src/**`); Infrastruktur-Tooling darf Wall-Clock nur für Laufzeit, Timeouts und Logs nutzen. Echte Zufälle nur über die benannten RNG-Streams und `entropySeed()`.
6. **Narrative folgt echten Übergängen.** Facts entstehen an Zustandsgrenzen, das Journal bleibt Spielerhistorie. Keine zweite Erzählmaschine, kein LLM im Spielpfad. Jeder neue Pool braucht einen Leser im Spiel; die Mengenquoten misst `verify:narrative-blocks`, normativ ist dieser Absatz. Jeder Commit braucht mindestens einen neuen, im Manifest registrierten und in der Registry verdrahteten Textbaustein.
7. **Eine Testlinie, lokal.** Während der Arbeit gezielte Tests und `verify:light`; Standard vor dem Push ist `verify:fast`, der Vor-PR-Nachweis `pnpm run ci:local`. GitHub-Workflows führen keine Tests, Gates, Builds oder APKs aus. Mechanik läuft ausschließlich über `pnpm run test:mechanics`. Die Linie steht in [`docs/TESTING.md`](docs/TESTING.md), die Gates in [`docs/CI.md`](docs/CI.md).
8. **Doku gehört in den Commit.** Pflichtdokumente und Marker aktualisiert der Hook bzw. `docs:sync`; generierte Blöcke werden nie von Hand bearbeitet. Die Landkarte ist [`docs/INDEX.md`](docs/INDEX.md).
9. **Lieferung über Branch und PR, Merge beim Maintainer.** Der Agent committet und pusht seinen Lane-Branch, öffnet den PR und übergibt mit `RELEASE [A<n>] done <sha>` plus Label `review-waiting`. Der Maintainer prüft gegen den Code, merged auf exaktem Kopf, setzt Release-Tags und löst Claim-Konflikte. Es gibt keinen Cloud-Testlauf und keinen Force-Push.
10. **Eine Eskalationsleiter.** `AUTO_FIX → LOCAL_GATE → REMOTE_CI → AGENT → BLOCKED`; nur echte Invarianten blockieren, alles andere wird ein Issue. `governance-issue` ist der einzige Schreiber für `ERR-4030`. Keine zweite Klassifikation.

Governance-Issues entstehen nur, wenn sie aktive Spielarbeit blockieren. **Governance-Drift:** produzieren mehr als zwei aufeinanderfolgende Maintainer-Läufe primär Governance-Issues, entsteht einmalig ein `[GOVERNANCE-DRIFT]`-Issue mit P2 und neue Governance-Issues pausieren, bis es geschlossen ist.

## Prompts sind Board-Tickets

Jeder Prompt, der Maintainer- oder Agentenverhalten regelt — `.cron/maintainer-prompt.md`, `.cron/SECURITY.md`, `AGENTS.md`, `docs/GOVERNANCE.md`, der externe System-Reminder — hat ein Incident-Issue und eine Zeile in [`docs/PROMPTS.md`](docs/PROMPTS.md). Ein Prompt ohne Issue und Registrierung ist ein roter `verify:docs`-Befund. Reine Referenzdokumente brauchen kein eigenes Ticket: sie stehen in [`docs/INVENTORY.md`](docs/INVENTORY.md) und verweisen auf den kanonischen Vertrag.

## Zustand

- **Save:** v11 (`vcoin.casino.v11`), Migration von v5–v10; v3/v4 werden verworfen. Details in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
- **CI:** 16 lokale Required-Gates, davon `narrative`, `catalog` und `build`; Audit optional. 11 Light-Gates, 12 mit `affected`. `verify:all` = 16 Required-Gates plus Audit (17 Läufe). Alle Tests, Gates, Builds und APKs laufen lokal; die Liste steht in [`docs/CI.md`](docs/CI.md).
- **Workflows:** drei Dateien, ausschließlich Repository-Verwaltung: `Ensure PR`, `PR Cleanup` und `Promote` (manuell). Kein Workflow führt Tests, Gates, Builds oder APKs aus.
- **Branch-Schutz:** klassischer Schutz auf `main`, keine Required-Status-Checks, `strict: false`, keine Rulesets; Force-Push und Löschen sind verboten.
- **Capabilities:** `docs/capabilities.json` ist ein Pflichtgate (`ERR-4025`); aktive Fähigkeiten brauchen einen registrierten Test.

## Befehle

| Befehl | Zweck |
| --- | --- |
| `pnpm run agent:pretask --json` | Startblocker, Issue-Check, Impact, Claim und Worktree prüfen. |
| `pnpm run agent:context --json` | Systeme, Invarianten, betroffene Tests und Gate-Plan anzeigen. |
| `pnpm run board:sync -- --at <ISO>` | Board-Snapshot nachziehen; `--check` meldet Drift mit Exit 1. |
| `pnpm run claim:register --issue <nr>` | Lokale Kollisionssperre aus dem Issue-Claim spiegeln. |
| `pnpm run verify:light` | Lint, LOC, Typecheck, Doku, Tree, Redundanz, Catalog, Generated. |
| `pnpm run verify:scope` | Nur der Diff gegen die Claim-Allowlist. |
| `pnpm run ci:local` | Lokaler Vor-PR-Nachweis: Struktur, Testqualität, betroffene Tests, Build. |
| `pnpm run verify:all` | Lokaler Vollnachweis: 16 Required-Gates plus Audit. |
| `pnpm run test:mechanics` | Statistik-, Soak-, Langlauf- und Benchmark-Nachweise; nie im Regelprofil. |
| `pnpm run turn:finish` | Phasenwechsel, Commit, Vertrag und Branch-Push. |
| `node scripts/sync-generated.mjs` | Inventur, Marker, Registry und Roadmap neu erzeugen. |
| `pnpm run reconcile:claims [--apply]` | Belegte Merges prüfen bzw. Claim und Task nachziehen. |

## Pflichtdoku

- Die Pflichtdokumente, Marker und Referenzen stehen in [`docs/INDEX.md`](docs/INDEX.md). In der Wurzel liegen nur `README.md` und `AGENTS.md`; anderes Markdown gehört unter `docs/`.
- `pnpm run docs:sync` ergänzt nur fehlende stabile Marker; generierte Blöcke bleiben unangetastet.
- Fehlende Doku ergänzt der Hook bzw. `turn:finish`; Lanes synchronisieren nicht manuell.

## Referenzen

| Dokument | Inhalt |
| --- | --- |
| [`docs/AGENT-ONBOARDING.md`](docs/AGENT-ONBOARDING.md) | Verbindliche Agent-Schleife, Claims, Review-Antwort und Übergabe. |
| [`docs/INDEX.md`](docs/INDEX.md) | Einstieg, Doku-Landkarte und Vertragsindex. |
| [`docs/WORKFLOW.md`](docs/WORKFLOW.md) | Pretask, Resume, Arbeitsweise, Abschluss und manueller Merge. |
| [`docs/CI.md`](docs/CI.md) | Required-Gates, Zustände, Workflows und Branch-Schutz. |
| [`docs/GOVERNANCE.md`](docs/GOVERNANCE.md) | **Kanonisch:** Rollen, Prioritäten, Claims, Review, Board-Status und Eskalation. |
| [`docs/PROMPTS.md`](docs/PROMPTS.md) | Prompt-Register mit Pfad, Schweregrad und Board-Issue. |
| [`docs/TESTING.md`](docs/TESTING.md) | Die eine Testlinie, Testmatrix und Zusatzregressionen. |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Zustandsbesitz, Pipeline, Verträge, Save und Narrative. |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Jetzt, als Nächstes, später; offene Punkte. |
| [`docs/contracts/README.md`](docs/contracts/README.md) | Index der sieben Kernverträge mit Writern und Tests. |
