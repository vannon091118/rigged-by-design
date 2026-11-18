# Adversarial Code Review — Phase 0: Drift Tracker (History-Analyse)

Erstellt: 2026-11-18T22:02:27.788Z
Repository: D:\Projekte\rigged-by-design

## Ziel dieser Phase

Die vollständige Projekt-History durchgehen (Commits, PRs, Issues, DevTagebuch, Doku). Nicht nur Text lesen, sondern Diffs betrachten und Auffälligkeiten zurückverfolgen: parallele Wahrheiten, doppelte Systeme, widersprüchliche Systeme, falsche Takt-Logiken, redundante Arbeitsschritte.

## 1. Commit-History (letzte 200 Commits)

| SHA (kurz) | Betreff | Autor | Datum | Refs |
|------------|---------|-------|-------|------|
| e8b26ff8 | chore: fix critical audit findings across governance, tooling, gamedesign | Claude Code | 2026-11-18 |  (HEAD -> lane/governance/audit-fixes-2026-11-18, origin/lane/governance/audit-fixes-2026-11-18) |
| c18c4735 | install-hooks: statSync auf Dateisystemen ohne exec-Bit entfallen lassen (#1156) | Vannon | 2026-11-18 |  (origin/main, origin/HEAD) |
| 2aaf04f5 | Merge branch 'main' into lane/governance/install-hooks-stat-sync | Vannon | 2026-11-18 |  |
| cdcd60d6 | doc-drift.mjs: Memoization und checkDocFile-Hilfsfunktion (#1155) | Vannon | 2026-11-18 |  |
| c2d34a4a | verify-dead-code.mjs: Default-Exports wieder überspringen (#1154) | Vannon | 2026-11-18 |  |
| c7ddc354 | Merge PR #1159: Post-Merge-Closeout #1158: LOD-Lane schliessen | Vannon | 2026-11-18 |  |
| 3c6b644c | Post-Merge-Closeout fuer PR #1158. | Vannon | 2026-11-18 |  |
| aab4b959 | Merge PR #1158: Phase 2: LOD-Wechsel im Live-Lauf belegen | Vannon | 2026-11-18 |  |
| 3926b2fb | Phase 2: LOD-Wechsel im Live-Lauf belegen (#1157) | Vannon | 2026-11-18 |  |
| 53499ad9 | install-hooks: statSync auf Dateisystemen ohne exec-Bit entfallen lassen | Claude Code | 2026-11-18 |  (origin/lane/governance/install-hooks-stat-sync, lane/governance/install-hooks-stat-sync) |
| 52d7bcf9 | doc-drift.mjs: Memoization und checkDocFile-Hilfsfunktion | Claude Code | 2026-11-18 |  (origin/lane/governance/doc-drift-simplify, lane/governance/doc-drift-simplify) |
| 86ae3cc0 | Claim lane/governance/issue-1153-dead-code-default-exports registrieren (#1153) | Claude Code | 2026-11-18 |  (origin/lane/governance/issue-1153-dead-code-default-exports, lane/governance/issue-1153-dead-code-default-exports) |
| 192db014 | Merge PR #1152: Closeout: LOD-Sprite-Set abschliessen (#1148) | Vannon | 2026-11-18 |  |
| 7cc8cc9a | Closeout: LOD-Sprite-Set abschliessen (#1148) | Vannon | 2026-11-18 |  |
| b959f75a | Task: LOD-Sprite-Set in die Nachsorge ziehen (#1148) | Vannon | 2026-11-18 |  |
| dd6350db | Merge PR #1151: Phase 2: LOD-Sprite-Set je Kopffamilie (#1148) | Vannon | 2026-11-18 |  |
| 276e6c07 | Task: LOD-Sprite-Set auf MERGE_PENDING setzen (#1148) | Vannon | 2026-11-18 |  |
| cedeba8b | Task: LOD-Sprite-Set auf CI_PENDING setzen (#1148) | Vannon | 2026-11-18 |  |
| a754e73e | Merge origin/main in LOD-Sprite-Set (#1148) | Vannon | 2026-11-18 |  |
| c1959614 | Phase 2: LOD-Sprite-Set je Kopffamilie (#1148) | Vannon | 2026-11-18 |  |
| 74fc5bf9 | Merge PR #1150: Closeout: Claim #998 auf merged, Task auf DONE (#998) | Vannon | 2026-11-18 |  (worktree-agent-ae3a1805a8d170a96) |
| ddeb3ce5 | Closeout-Lane fuer #998 registrieren | Vannon | 2026-11-18 |  |
| 7b0b11b1 | Closeout: #998-Claim auf merged, PR-Beleg im Task | Vannon | 2026-11-18 |  |
| 36ebe487 | Merge PR #1149: Sim-Tests loggen strukturiert statt mit console.log (#998) | Vannon | 2026-11-18 |  |
| 5b40c57a | Claim-Basis der #998-Lane auf main 65a3deac ziehen | Vannon | 2026-11-18 |  |
| 6ee0789e | Merge main in die #998-Lane: Aenderungsliste und Roadmap zusammengefuehrt | Vannon | 2026-11-18 |  |
| b7ebaba7 | Doku-Ratchet sichtbar auf 1.655.000 B angehoben (ERR-4020) | Vannon | 2026-11-18 |  |
| 65a3deac | Closeout: Editor-Kopfauswahl nach Merge #1146 (#1147) | Vannon | 2026-11-18 |  (worktree-agent-afab953dfaec8234f, worktree-agent-ac7fd2e7a0c9bb3e5, worktree-agent-a89f9f5108a3649f8, worktree-agent-a73e414c4e5fd0b68, worktree-agent-a6988afc2a7fe2abf) |
| 3c1b3d9e | Fremde Aenderungshistorie wiederhergestellt (#998) | Vannon | 2026-11-18 |  |
| c0ffb24b | Waechter fuer strukturierte Sim-Testausgabe (#998) | Vannon | 2026-11-18 |  |
| b5375aa8 | Sim-Tests loggen strukturiert statt mit console.log (#998) | Vannon | 2026-11-18 |  |
| b2a7d0b1 | Closeout: Editor-Kopfauswahl abschliessen | Vannon | 2026-11-18 |  |
| 433ec69c | Task: Editor-Kopfauswahl in die Nachsorge ziehen | Vannon | 2026-11-18 |  |
| 0e9d95ee | Phase 2: Charaktereditor waehlt Kopffamilie und Haarton (#1146) | Vannon | 2026-11-18 |  |
| 85c9e216 | Task: PR #1146 in den Merge-Pending-Zustand ziehen | Vannon | 2026-11-18 |  |
| 13c6c283 | Task: CI-Nachweis fuer die Editor-Kopfauswahl | Vannon | 2026-11-18 |  |
| 1e8fb7f1 | Phase 2: Charaktereditor waehlt Kopffamilie und Haarton | Vannon | 2026-11-18 |  |
| fe40db6b | Merge PR #1144: Phase-2-Closeout: LOD-Claim und Task nach Merge #1143 schliessen | Vannon | 2026-11-18 |  |
| e27ce734 | Phase 2: LOD-Task auf CI_PENDING setzen | Vannon | 2026-11-18 |  |
| 3baa55e7 | Merge PR #1143: Phase 2: Fern-LOD traegt Kopffamilie und Haarton ueber 1x/2x | Vannon | 2026-11-18 |  |
| 45f8f6c9 | Phase 2: Fern-LOD traegt Kopffamilie und Haarton ueber 1x/2x | Vannon | 2026-11-18 |  |
| ac115a1c | Merge PR #1141: Phase-2-Closeout: Claim und Task nach Merge #1140 schliessen | Vannon | 2026-11-18 |  |
| b451232c | Phase-2-Closeout: Claim und Task nach Merge #1140 schliessen | Vannon | 2026-11-18 |  |
| 337be124 | Merge PR #1140: Phase 2: NPC-Rig waehlt Koerper, Koepfe und LOD aus dem Atlas | Vannon | 2026-11-18 |  |
| 114c16e7 | Phase 2: NPC-Rig waehlt Koerper, Koepfe und LOD aus dem Atlas | Vannon | 2026-11-18 |  |
| 01212208 | Merge PR #1138: Docs-Budget: Audit-Notiz auf Tabellen und Issue-Verweis reduzieren | Vannon | 2026-11-18 |  |
| 7b9361bb | Docs-Budget: Audit-Notiz auf Tabellen und Issue-Verweis reduzieren | Vannon | 2026-11-18 |  |
| cfdf97c5 | Merge PR #1137: Docs-Budget: Head-03-Notiz im Audit auf den Issue-Verweis kuerzen | Vannon | 2026-11-18 |  |
| 9f1c4516 | Docs-Budget: Head-03-Notiz im Audit auf den Issue-Verweis kuerzen | Vannon | 2026-11-18 |  |
| 2f5003c3 | Merge PR #1136: Head-03-Closeout: Closeout-Claim auf merged und Task auf DONE | Vannon | 2026-11-18 |  |
| … | … (weitere 150 Commits) | … | … | … |

## 2. Pull Request History

Keine PR-Daten verfügbar (gh CLI nicht authentifiziert oder keine PRs).

## 3. Issue History

Keine Issue-Daten verfügbar (gh CLI nicht authentifiziert oder keine Issues).

## 4. DevTagebuch

Zeilen: 1712

### Erste 30 Zeilen:
> # Devtagebuch
> <!-- rbd-doc: managed -->
> ## 2026-11-15 – Ein Board, eine Wahrheit (#886)
> **Befund.** Dieselbe Regel stand an drei Orten mit drei Wahrheiten: `AGENTS.md` nannte den Task-Vertrag „die Wahrheit für Phase, Befunde und nächste Aktion“, `docs/WORKFLOW.md` wiederholte das, und `.cron/maintainer-prompt.md` führte das gepinnte Issue #677 als State-Speicher, während `GOVERNANCE.md` den Snapshot `.lane-claims/board-state.json` beschrieb. Dazu kam ein `gate-failure`-Template, das Agenten zum Mergen und Schließen aufforderte — gegen die Rollenregel —, plus zwei Doku-Leichen: `LOCAL_CI.md` doppelte `CI.md`, `RUNBOOK-AUTO-RESOLVE.md` beschrieb einen Workflow, den es nicht mehr gibt.
> **Umsetzung.** `AGENTS.md` ist komplett neu: eine Quelle pro Datentyp (Issue, Labels, Claims, Identity-Board, PR, abgeleiteter Snapshot, lokale Sperre, `GOVERNANCE.md`), Rollen mit Rechtetrennung, Issue-Lebenszyklus, zehn Regeln, Prompt-Register, Zustand und Befehle. `README.md` bekommt am Ende den Abschnitt „Issue Board“. Task-Vertrag und `board-state.json` sind jetzt überall ausdrücklich Mechanik bzw. abgeleiteter Snapshot, #677 nirgends mehr State-Quelle. Das `gate-failure`-Template übergibt statt zu mergen. `LOCAL_CI.md` und `RUNBOOK-AUTO-RESOLVE.md` sind gelöscht, Verweise zeigen auf `CI.md`, `TESTING.md` und `ARCHITECTURE.md`.
> **Offen.** Pin-Set (#887), PR-Vertrag (#884) und die einzelnen Issue-Audits (#886 Phase E) bleiben offen; `RELEASE`/`review-waiting` setzt die Übergabe, geschlossen wird vom Maintainer.
> ## 2026-11-15 – Prompts sind Board-Tickets (#885)
> **Befund.** Vier Prompts im Repo und ein externer System-Reminder regelten Maintainer- und Agentenverhalten, ohne dass ein Issue auf sie zeigte. Eine Änderung an `.cron/maintainer-prompt.md`, `.cron/SECURITY.md`, `AGENTS.md` oder `docs/GOVERNANCE.md` war am Board unsichtbar; #883 nennt `AGENTS.md` außerdem unter `docs/AGENTS.md`, obwohl die kanonische Datei in der Wurzel liegt.
> **Umsetzung.** `docs/PROMPTS.md` ist das Register: Pfad, Art, Schweregrad, Issue. Die fünf Prompts haben Incident-Issues #889 (GOVERNANCE), #890 (SECURITY), #891 (AGENTS.md), #892 (Maintainer-Cron-Prompt) und #893 (System-Reminder) mit `incident-sev-*`, `incident-open` und `causal-chain`. `verify:docs` prüft die Abdeckung (`AGENTS.md`, `docs/GOVERNANCE.md`, jede `.cron/*.md`); `board:sync` schreibt die Einträge als `promptIssues` in den Snapshot.
> **Offen.** Der System-Reminder lebt außerhalb des Repos (#893, `needs-human`): er muss auf die Repo-Dateien verweisen, statt Regeln zu wiederholen. Solange er das nicht tut, bleibt er eine zweite Quelle für dieselben Regeln.
> ## 2026-11-11 – Lokale Testlinie statt Cloud-Runner
> **Befund.** Die Suite brauchte 59,5 s Wandzeit fuer 1654 Tests; `verify:light` brauchte 21,6 s, davon 19,7 s Typecheck. Die Mechanik-Suiten waren doppelt gepflegt (Vitest-Ausschluss, Testkatalog-Regex, Workflow-Matrix). `pretask` startete `agent-context` als Kindprozess und rechnete den Impact zweimal; `contextSummary` las das Claim-Register dreimal. Jedes Gate trug ein willkuerliches Zeitlimit.
> **Umsetzung.** Eine Manifest-Liste `src/Config/test-lanes.json` steuert Vitest und Katalog; Mechanik laeuft nur ueber `test:mechanics`. Gate-Timeouts sind entfernt, Gates starten direkte Binaries, der Baumfingerabdruck kommt aus Git, `pretask` rechnet den Impact im eigenen Prozess, Claim-Register und Kollisionen werden einmal geladen. Sechs Verifikations-Workflows sind durch `scripts/local-ci.mjs` ersetzt; drei Repository-Workflows bleiben.
> **Offen.** Die Mechanik-Suiten bleiben langsam und werden nicht in Regellaifen gemessen; der APK-Pfad braucht weiterhin JDK und Android SDK.
> Chronologisch, ehrlich, mit offenen Enden. Jeder Eintrag nennt Datum, Ziel,
> Umsetzung, Pruefungen und was bewusst nicht getan wurde.
> ## 2026-11-11 - Sprint 1: Der erste Abend
> **Ziel:** Ein Startzustand statt zwei Modals, eine gefüllte Bühne statt schwarzer Balken, ein sichtbares Ziel — und die erste-Stunde-Kette als deterministischer Test statt als Behauptung.
> **Befund:** Die Messung (T1) hat die Vorlage an einer Stelle widerlegt: Die Kasse steht im Blueprint, `FIRST_ARRIVAL_TICK = 12` bei `TICK_MS = 520`, und weil die Stadt-Ticks weiterlaufen, stand der erste Gast 734 ms nach dem Betreten des Casinos im Raum. Der echte Defekt war die doppelte Startregel: `OpeningGate` öffnete nach Tick/Gäste/Historie, `OnboardingPanel` nach `onboarding.step` — beim Boot lagen beide Modals übereinander. Offen ist die Kette danach: ohne Automat aus der Starter-Kiste zeigt das HUD `GERÄTE 0/0`.
> **Umsetzung:** `OnboardingStep` ist `OPENING → CITY → CASINO → DONE`; `new-game` startet mit `OPENING`, `OpeningGate` liest nur diesen Schritt, `scene.finishOpening()` ist der einzige Weg nach `CITY`, alte Saves bleiben `DONE`. `FloorCamera` trennt `fit` (contain, ganzer Plan) von `fill` (cover-Faktor); `FloorView` zeichnet einen gefliesten Bühnenhintergrund statt schwarzer Balken. `src/ui/goal.ts` liefert genau ein Ziel aus dem Snapshot (Barkauf, danach Miete), das HUD zeigt Label und Balken. `first-evening.test.ts` fährt die Kette Eröffnung → Stadt → Casino → Automat aus der Kiste → Gast nach 12 Ticks → Spiel → Buchung → Tagesende mit festem Seed.
> **Prüfungen:** `pnpm run typecheck` grün; `pnpm run verify:light` grün (docs, check:loc, catalog, test-placement, tree, impact-graph, redundancy, typecheck, lint); gezielte Tests `goal`, `floor-camera`, `onboarding-save`, `first-evening`, `ui` grün (22 Tests); Build und Preview geladen, Messpunkte im Browser erhoben.
> **Bewusst nicht getan:** Keine Governance-Datei angefasst (Freeze), keine Narrative gelöscht (Schrumpf-Schutz), kein Screenshot-Gate (Playwright fehlt, Skripte gesperrt), kein Commit/Push/PR. Für einen Commit mit `src/`-Änderung fehlt noch der Pflicht-Textbaustein aus `verify-narrative-blocks --commit`.
> ## 2026-11-11 - Claim-Retention und Post-Merge-Closeout
> **Ziel:** Lane-Claims und Task-Verträge dauerhaft auf die letzten zehn Tasks begrenzen und Pending-Status nach einem belegten `main`-Merge automatisch lösen.
> **Befund:** Das Register wuchs mit jeder Lane; gemergte Claims und `DONE`-Tasks blieben unbegrenzt liegen. `reconcile-claims` konnte Claims auf `merged` ziehen, ließ den Task aber auf `CI_PENDING` stehen. Ein `DONE`-Task wurde von `promote` pauschal gehalten, sodass der Closeout wieder ein manueller Zwischenschritt war.
> **Umsetzung:** `scripts/lib/claim-lifecycle.mjs` plant Retention und Closeout rein: aktive Tasks und offene Claims bleiben, geschlossene Tasks werden nach Commit-Zeit sortiert und nur die neuesten zehn behalten; das Legacy-Register bleibt unangetastet. `reconcile-claims --apply` schließt gemergte Tasks ohne offenen Blocker auf `DONE` und führt die Retention aus. `scripts/post-merge-closeout.mjs` wird von `PR Cleanup` nach jedem Merge aufgerufen, legt den Closeout-PR an und schreibt `closeout: post-merge`; nur dieser Pfad darf als `DONE` durch `promote`.
> **Prüfungen:** `claim-lifecycle`, `promotion-state` und die Workflow-Verträge sind grün; `claim:register doctor`, `claim:register prune` und der neue Reconcile-Pfad wurden lokal ausgeführt. Die CI prüft den gepushten Kopf.
> **Bewusst nicht getan:** Kein Direktpush auf `main`, keine Branch-Löschung, keine Kürzung des Legacy-Registers `claims.json`. Die Retention löscht keine aktiven Lanes und keinen offenen Claim.
> ## 2026-11-11 - Repo-Cleanup: Doku-Dubletten, Ist-Zahlen und 2k-Datencheck
> **Ziel:** Die Dokumentation auf den echten Stand bringen, exakte Dubletten entfernen und die sogenannten 2k-Daten gegen ihre Nutzung pruefen, ohne belegte Inhalte zu loeschen.


## 5. Drift-Analyse (Widersprüche, Doppelte Systeme, Takt-Logik, Redundanz)

| Typ | Befund | Quelle | Schweregrad |
|-----|--------|--------|-------------|
| Doppeltes System: Claim-Register | Es existieren zwei Claim-Register-Strukturen: Legacy claims.json (Array) und einzelne Dateien unter claims/ (eine pro Lane). loadClaimsStrict() führt beide zusammen, aber Inkonsistenzen sind möglich. | .lane-claims/claims.json + .lane-claims/claims/ | mittel |
| Doppeltes System: Board-State vs Merged-Index | board-state.json ist ein generierter Snapshot, merged-index.json trackt gemergte Claims. Beide enthalten überlappende Informationen über Claim-Status. Keine klare Primärquelle. | .lane-claims/board-state.json + .lane-claims/merged-index.js… | mittel |
| Doppeltes System: Rollen ohne Trennung | actors.json listet einen Principal, der gleichzeitig User, Maintainer und Worker ist. Es gibt keinen eigenen Maintainer-Login, der die Trennung erzwingt. | .lane-claims/actors.json | hoch |
| Takt-Logik: Commits ohne Issue-Bezug | 56 der letzten 200 Commits haben keinen Issue-Bezug (#N) in der Commit-Nachricht. Das erschwert die Rückverfolgbarkeit (Issue bestimmt Aufgabe, Priorität und Akzeptanz). | git log (56 Commits ohne #N) | mittel |
| Takt-Logik: Claims ohne Task-Verträge | 97 Claim-Dateien aber nur 94 Task-Dateien. Einige Claims haben keinen zugehörigen Task-Vertrag mit Done-Kriterien. | .lane-claims/claims/ (97) vs .lane-claims/tasks/ (94) | mittel |
| Redundante Arbeit: Viele Closeout-Commits | 32 Closeout-Commits in der History. Jeder Merge braucht einen eigenen Closeout — das ist viel Boilerplate für kleine Änderungen. | git log (32 Closeout-Commits) | niedrig |

### Details zu kritischen Drift-Befunden:
- **Doppeltes System: Rollen ohne Trennung**: actors.json listet einen Principal, der gleichzeitig User, Maintainer und Worker ist. Es gibt keinen eigenen Maintainer-Login, der die Trennung erzwingt.
  Quelle: .lane-claims/actors.json

## 6. Empfehlungen aus Phase 0

1. Kritische Drift-Befunde zuerst beheben (Hoher Schweregrad):
   - Doppeltes System: Rollen ohne Trennung: actors.json listet einen Principal, der gleichzeitig User, Maintainer und Worker ist. Es gibt keinen eigenen Maintainer-Login, der die Trennung erzwingt. (.lane-claims/actors.json)

2. Doppelte Systeme zusammenführen (z. B. claims.json + claims/ pro-Lane-Dateien).
3. Klare Primärquelle für Board-State definieren (board-state.json ODER merged-index.json, nicht beide).
4. Rollentrennung in actors.json durchsetzen (eigener Maintainer-Login statt shared-principal).
5. Jeder Commit sollte einen Issue-Bezug (#N) haben für Rückverfolgbarkeit.
