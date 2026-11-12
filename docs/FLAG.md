# FLAG — vermischte Bezeichnungen (Governance ↔ Spiel/Präsentation)

<!-- rbd-doc: managed -->

**Zweck:** Jede Bezeichnung, die im Repo sowohl Steuerung als auch Spiel oder
Präsentation meint, steht hier einmal mit Beleg und getrennter Schreibweise.
Der Anlass ist konkret: Dieselben Wörter bezeichnen Prozess und Spielinhalt, und
an mehreren Stellen ist Governance-Text in den Spieltext gerutscht.

**Regel:** Im Zweifel trägt der Begriff seinen Bereich in Klammern:
„Linie (Test)" gegen „Linie (Gewinn)". Neue Texte und Kommentare halten die rechte
Spalte ein. Die Roadmap führt nur Spiel und Präsentation; Governance steht in
[`GOVERNANCE.md`](GOVERNANCE.md), [`WORKFLOW.md`](WORKFLOW.md) und [`CI.md`](CI.md).

## Begriffe

| Bezeichnung | Governance-Bedeutung (Beleg) | Spiel-/Präsentations-Bedeutung (Beleg) | Getrennte Schreibweise |
| --- | --- | --- | --- |
| **Agent** | Coding-Agent, der eine Lane bearbeitet (`AGENTS.md`, Pretask/Claim) | Ausbau-Paket der Produktplanung (`src/store/snapshot.ts:161` „Agent 11"; `content/narrative/contributions/2026-11-11-agent26-done.json`) | „Lane-Agent" gegen „Ausbaustufe 11" |
| **Turn** | Arbeitslauf bis Commit und Push (`package.json` `turn:finish`) | Content-Charge eines Textbausteins (`src/core/sim/narrative/composer/registry.generated.ts:18` `turnId`) | „Abschlusslauf" gegen „Textcharge" |
| **Slot** | Textpool der Narrative Engine (`src/ui/narrative-events.tsx:24` „Slot-Rollen") | Spielautomat und seine Walzen (`src/core/games/slot-profile.ts`, `src/ui/slot-rules-editor.tsx:108`) | „Textpool" gegen „Automat" |
| **Linie** | Testlinie des Projekts (`docs/TESTING.md`, „Die eine Testlinie") | Gewinnlinie eines Spiels (`src/core/games/engines/slot-models.ts:126` `lineStats`) | „Testlinie" gegen „Gewinnlinie" |
| **Katalog** | Testkatalog als Gate (`package.json` `catalog`, `scripts/test-catalog.mjs`) | Mod- und Baukatalog im Spiel (`src/core/sim/mod-effects.ts:2`, `src/ui/machine-mods.tsx:1`) | „Testkatalog" gegen „Spielkatalog" |
| **Inventur** | Dateiinventur der Doku (`docs/INVENTORY.md`, `package.json` `inventory:build`) | Inventar und Sammlung des Spielers (`src/core/sim/item-inventory.ts:21`) | „Dateiinventur" gegen „Inventar" |
| **Kette** | Import- und Abhängigkeitskette vor einem Schnitt (`AGENTS.md`, „Erst die Kette, dann der Schnitt") | Erzählkette (`src/core/sim/narrative/chains/chain-runtime.ts`) und Lieferkette (`src/core/sim/deliveries.ts`) | „Importkette" gegen „Erzählkette"/„Lieferkette" |
| **Pipeline** | Gate-Ausführung (`package.json` `verify` → `scripts/run-pipeline.mjs`; `src/core/governance/error-codes.ts:61`) | Simulationsschritte im Tick (`docs/ARCHITECTURE.md`, Abschnitt „Pipeline") | „Gate-Pipeline" gegen „Simulationspipeline" |
| **Budget** | LOC- und Frame-Grenzen (`src/core/sim/bar-service.ts:3` verweist auf das LOC-Budget; `src/ui/__tests__/phase34-acceptance.test.tsx:45`) | Geld eines Gasts (`src/core/sim/guest-play.ts:51` „Persona-Budget") | „LOC-Budget"/„Frame-Budget" gegen „Gastbudget" |
| **Rolle** | Owner-Rolle einer Lane (`docs/GOVERNANCE.md`, „Rollen und Lanes") | Floor-Rolle des Spielers und Personals (`src/core/sim/floor-work.ts:16`, `src/core/sim/staff.ts:2`) | „Owner-Rolle" gegen „Floor-Rolle" |
| **Freigabe** | PIN-Freigabe des Governance-Freeze (`docs/GOVERNANCE.md`, „Freigabe") | Stufenfreischaltung im Spiel (`src/core/sim/progression.ts` `assertUnlocked`) | „PIN-Freigabe" gegen „Stufenfreischaltung" |
| **Sperre / gesperrt** | Freeze der Steuerungsebene (`docs/GOVERNANCE.md`, „Governance-Freeze") | Gesperrte Stufe oder Anzeige (`src/core/sim/progression.ts` `assertUnlocked`) | „Freeze" gegen „gesperrte Stufe" |
| **Abnahme** | Abnahme einer Lieferung (`docs/DEVTAGEBUCH.md`, Prüfabschnitte) | Abnahme eines Spielablaufs (`docs/ROADMAP.md`, Phasen 6 und 7) | „Lieferabnahme" gegen „Spielabnahme" |
| **Nachweis** | Gate- und CI-Beleg (`docs/TESTING.md`, „Nachweise") | Beleg einer Spielmechanik (`docs/ROADMAP.md`, Spalte „Referenz") | „Gate-Nachweis" gegen „Spielbeleg" |
| **Lauf** | CI-Lauf (`docs/CI.md`) | Durchgespielter Abschnitt (`docs/CHANGELOG.md` 0.3.186 „Kiez-Lauf") | „CI-Lauf" gegen „Spieldurchlauf" |
| **Registry / Register** | Claim-Register der Lanes (`docs/GOVERNANCE.md`, „Claims") | Content-Registry der Narrative Engine (`content/narrative/registry`) | „Claim-Register" gegen „Content-Registry" |
| **Manifest** | Paket- und Asset-Manifest (`package.json`, `scripts/build-asset-manifest.mjs`) | Content-Charge der Narrative Engine (`registry.generated.ts` `turnId`) | „Asset-Manifest" gegen „Textcharge" |
| **Betrieb / Betreiber** | Betriebsanleitung der CI-Migration (`docs/LOCAL_CI.md:3`) | Betreiberrolle auf dem Floor (`docs/CHANGELOG.md` 0.3.183 „BETREIBER", `src/core/sim/business-areas.ts`) | „CI-Betrieb" gegen „Betreiberrolle" |
| **Eskalation** | Eskalationsleiter der Governance (`docs/GOVERNANCE.md`, „Eskalation") | Streit, der im Spiel eskaliert (`src/core/sim/__tests__/dispute-escalation.test.ts`) | „Eskalationsstufe" gegen „Konflikteskalation" |
| **Phase** | Task-Phase einer Lane (`docs/WORKFLOW.md`, `READY` … `DONE`) | Tagesphase der Welt (`src/core/sim/day-phase.ts` `dayPhaseOf`) | „Task-Phase" gegen „Tagesphase" |
| **Owner** | Roster-Owner eines Claims (`docs/GOVERNANCE.md`, „Rollen und Lanes") | Eigentümer einer Immobilie (`src/core/sim/property.ts`, `player.property`) | „Lane-Owner" gegen „Eigentümer" |
| **Buch / BOOK** | Ledger-Buchung (`src/core/economy/ledger.ts`) | Buch-Symbol der Walzen (`src/core/games/engines/slot-models.ts`, Gewicht `BOOK`) | „Buchung" gegen „Buch-Symbol" |
| **Release** | Release-APK und Tag (`docs/LOCAL_CI.md`) | Release-Horizont des Spiels (`docs/ROADMAP.md`, „Später") | „Release-Build" gegen „Spielrelease" |

## Governance-Sätze im Spieltext

**Befund 2026-11-11:** 92 von 1008 Beiträgen unter `content/narrative/contributions/`
enthielten Governance-Vokabular im Spieltext (Claim, Merge, Squash, CI, Gate, Lane,
PR, Commit, Branch, Register, Task, „Agent <Nr>", Sprint). Sie wurden über
`content/narrative/registry/fragments.json` in das Spiel kompiliert.

**Behoben 2026-11-11:** Alle 92 Sätze wurden durch Welttexte ersetzt; die Anzahl
der Beiträge blieb bei 1008. Der Guard-Test
`src/core/governance/__tests__/narrative-world-text.test.ts` hält den Stand: 0 von 1008.

Die folgenden Sätze sind die ehemaligen Belege vor der Ersetzung:

| Beispiel | Ehemaliger Satz im Spiel | Warum es kein Spieltext ist |
| --- | --- | --- |
| `2026-11-10-closeout-1.json` | „Der Beleg war der Merge, nicht die Absicht" | Merge ist ein Repo-Vorgang, keine Spielhandlung |
| `2026-11-11-agent20-merge-pending.json` | „Der Squash traegt den Strom auf main" | Branch und Squash existieren im Spiel nicht |
| `2026-11-11-agent18-drink-menu-3.json` | „Ein Gate meldet nicht, dass etwas fehlt …" | Ein Gate ist ein Prüflauf, kein Gast-Erlebnis |
| `2026-11-11-agent26-claim.json` | „der Claim nennt den Pfad von Anfang an" | Claim ist eine Lane-Buchung |
| `2026-11-09-loc-gate-01.json` | Text über das LOC-Gate | Code-Grenze statt Weltbeobachtung |
| `2026-11-10-ci-pr-body-current.json` | Text über PR-Body und CI | Repository-Verwaltung |

**Regel:** Ein Spieltext muss ohne Kenntnis des Repos verständlich sein. Er nennt
Personen, Orte, Gegenstände, Geld, Laune oder Folgen — nie Claim, Merge, Gate, CI,
PR, Branch, Commit oder Task. Ersetzen, nicht löschen: Die Anzahl der Beiträge darf
nicht sinken. Der Guard-Test prüft die Regel bei jedem Lauf.

**Messung** (gleiche Kriterien wie oben, mit Unicode-festen Wortgrenzen, damit
„prüfen“ nicht als „PR“ zählt):

```bash
node -e "const fs=require('fs'),d='content/narrative/contributions';let n=0,t=0;for(const f of fs.readdirSync(d)){if(!f.endsWith('.json'))continue;t++;const {text=''}=JSON.parse(fs.readFileSync(d+'/'+f,'utf8'));if(/(?<![\p{L}\p{N}])(Claims?|Merge|Squash|CI|Gates?|Lane|PR|Commit|Branch|Register(stand)?|Task|Agent(en)? [0-9]|Sprint)(?![\p{L}\p{N}])/iu.test(text))n++}console.log(n+'/'+t)"
```

## Weitere Regeln

1. **Code-Kommentare** nennen die Funktion, nicht das Ticket: „Ausbaustufe 11" statt
   „Agent 11", „Befund aus dem Spiel" statt „#267". Beleg für den Verstoß:
   `src/store/snapshot.ts:161`.
2. **Governance-Texte** verwenden keine Spielmetaphern (Casino, Kasse, Hausvorteil,
   Gast) für Prozesse. Ausnahme ist ein ausdrückliches Zitat.
3. **Präsentation** beschreibt Spielzustände, keine Repository-Zustände. „Ein Ziel im
   HUD" ist Präsentation; „Gate grün" ist es nicht.
4. **Bei Überschneidung** gilt die Klammerform aus der Tabelle, auch in Commit-Texten
   und im Changelog.

## Konsolidierte Dateien

Diese Dateien sind entfallen; ihre noch gültigen Aussagen stehen jetzt an genau einer
Stelle:

| Entfallen | Inhalt jetzt in |
| --- | --- |
| `docs/superpowers/plans/2026-11-11-first-run-slot-truth.md` | `docs/ROADMAP.md` S1-04, S1-07 |
| `docs/superpowers/plans/2026-11-12-first-run-messung.md` | `docs/ROADMAP.md` S1-06, PR-07 |
| `docs/superpowers/plans/2026-11-12-sprint-1-erster-abend.md` | `docs/ROADMAP.md` Phase 1, PR-05, PR-06 |
| `docs/screenshots/README.md` | `docs/ROADMAP.md`, „Ablageregel Screenshots" |
| `packages/gamescout/BOOTSTRAP-REPORT.md` | `packages/gamescout/AGENTS.md`, `packages/gamescout/README.md` |
| `src/debug/gamescout-anleitung.md` | `packages/gamescout/AGENTS.md` |
