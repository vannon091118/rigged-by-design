# Changelog

<!-- rbd-doc: v0.3.183 | 2026-11-08 00:20 UTC -->

Kurz, versionsweise, was sich fuer Spieler und Agenten geaendert hat.
Neuester Eintrag oben, jeder Eintrag mit Datum.

## Regeln

- Jede Aenderung bekommt einen Eintrag unter der Version, die `package.json` traegt.
- Kein Eintrag ohne Datum; Uhrzeit steht im `rbd-doc`-Marker am Dateikopf.
- Sichtbare Aenderungen unter "Spiel", interne Umbauten unter "Technik".
- Der Eintrag wird im selben Commit geschrieben wie die Aenderung, nie nachtraeglich.

## [0.3.183] - 2026-11-07

### Textbausteine
- **Pools auf Mindestgroesse 50.** Acht Slots tragen je 50 gepruefte Fragmente; die Registry waechst von 66 auf 400 Bausteine (Ziel 1500). Jeder neue Text ist eindeutig, im Turn-Manifest registriert und in Registry sowie Laufzeit-Spiegel verdrahtet.
- **Pflicht pro Commit ist gate-geprueft.** `verify:narrative-blocks` prueft Pool-Minimum, Duplikate, Verdrahtung und die Luecken-Regel; der Pre-Commit-Hook ruft es mit `--commit` auf und blockiert Commits ohne neuen, verdrahteten Baustein. Das bestehende Assets-Gate faehrt dieselbe Pruefung in CI, ohne eine zweite Gate-Landschaft.

## [0.3.183] - 2026-11-07

### Spiel
- **Kisten laufen über den Floor.** Ein Klick auf eine Kiste lässt den Charakter hinlaufen und aufheben; ein Klick auf eine freie Fläche trägt eine Möbelkiste dorthin und stellt sie ab. Das Betriebspanel zeigt nur noch Status und Träger, die Abholen-/Entladen-Buttons entfallen. Enter bleibt die Tastenalternative.
- **Klarere Rollenbezeichnung.** Umschalter und Floor-Leiste nennen den Operator jetzt `BETREIBER` statt `BETRIEB`; der Gastmodus bleibt unverändert. Die Rivalen-Karte öffnet beim Klick direkt das Casino und zeigt keine zweite Auswahl mehr.

### Technik
- **WIP-Konsolidierung.** Die offene Kisten-, Einsatz- und Slot-Arbeit aus dem alten Interaktions-Worktree liegt jetzt auf aktuellem `main`: `useCrateActions` bündelt Floor-Klick, Wegfindung, Aufheben, Tragen und Abstellen, `build-crate-list.tsx` ist reine Anzeige. Eigene Einsätze sind auf das Zehnfache des effektiven Mindesteinsatzes begrenzt; die Slot-Entladung wird erst frei, wenn der Bankstand die tatsächliche Auszahlung aus Einsatz plus Bonus deckt.
- **Mehrbeatige Narrative-Events.** `EventChoice.nextStep` fuehrt nach einer Wahl in den naechsten Beat: `executeChoice` wechselt nur den Schritt, die Instanz bleibt `ACTIVE` und ihre Frist laeuft weiter; erst der letzte Beat emittiert `EVENT_RESOLVED`. Das Schema weist unerreichbare Ziele ab, `choices/steps.ts` blendet Optionen fremder Beats aus, und `EVENT_TEMPLATE_LIMITS` hebt die Grenzen auf 24 Slots sowie 16 Choices und 16 Angebote.
- **AGENTS.md ist ein Kurzvertrag.** Zehn unverhandelbare Regeln, Zustand, Befehle und eine Referenztabelle; Tiefenwissen liegt in `docs/WORKFLOW.md`, `docs/CI.md`, `docs/GOVERNANCE.md`, `docs/TESTING.md`, `docs/INDEX.md` und `docs/contracts/README.md`. Doppelte Gate-Listen entfallen.
- **Doku-Drift bereinigt.** 12 Required-Gates plus optionales Audit, `capabilities` im schnellen Plan, Save v11, neun Workflows, klassischer Branch-Schutz mit `strict: false` und ohne Ruleset, `promote` deaktiviert und manueller Merge.
- **Regressionen fuer den Arbeitsvertrag.** `destructive-commands.test.ts` verbietet `reset --hard`, `clean -fd`, Stash-Mutation, Force-Push und `branch -D` in Produktionsskripten; Dependabot-Branches erhalten eine eng begrenzte Allowlist fuer Manifest, Lockfile und Workflow-Pins.

- **Auto-Resolve-Retry freigeschaltet.** `auto-resolve.yml` hat `actions: write`; das Runbook beschreibt Aktivierung, Patch-/Push-Modus, Berechtigungen, Prüfungen und Rückrollung.
- **Stale Claim belegt statt geraten.** Ein geloeschter Lane-Branch gilt nur dann als `merged`, wenn ein gemergter PR und dessen Merge-Commit auf `main` belegt sind; ein aktiver Branch mit eigenem Kopf bleibt fail-closed. Der CI-Adapter zieht den offenen Legacy-Claim aus #242 fuer die alte Kontrollebene nach, ohne die Content-Allowlist zu aendern.

## [0.3.181] - 2026-11-07

### Technik
- **PR-Regression bleibt vollstaendig.** `ci-verify.yml` setzt `full_tests=1` fuer jeden PR und fuer `main`; `ci-plan` behandelt das Profil `all` fail-closed und laesst leere, unbekannte oder Dependency-Diffs ebenfalls in die volle Suite laufen. `--impact=1` verengt nur Gates und lange Nachweise, nicht die schnelle Regression.
- **Issue-Resolver braucht Reparaturbeleg.** `sweepGreenMain()` schliesst nur mit urspruenglichem Fingerprint, einer `<!-- repair: <sha> -->`-Marke und einem exakt gruenen Main-Commit; ein Ancestor-Commit allein reicht nicht. `recordRecurrence()` oeffnet ein geschlossenes Issue bei erneutem Fehler weiterhin wieder.

## [0.3.180] - 2026-11-07

### Technik
- **Balance-Langlauf wirklich aktiviert.** Der Long-Job in `ci-verify.yml` setzt jetzt `RBD_BALANCE=1`; ohne diesen Schalter wurde `balance-operating.test.ts` uebersprungen. Der Main-Lauf `42376173298` hat das korrekt als rotes Gate gemeldet, statt den Skip als PASS zu zaehlen.
- **Workflow-Test haelt den Schalter fest.** `workflow-hardening.test.ts` prueft zusaetzlich, dass der lange Nachweis `RBD_BALANCE` setzt; der fokussierte Lauf ist 10/10 gruen. Der echte 40-Tage-Balance-Lauf ist 1/1 gruen (Seed 12345, 17,3 s).

## [0.3.179] - 2026-11-07

### Technik
- **Kein Bootstrap-Fallback mehr.** Die CI nimmt ihre Kontrollebene fuer PRs aus der PR-Basis und fuer Feature-Pushes aus `main`; eine Basis ohne `RBD_ROOT` bricht ab, statt PR-Skripte auszufuehren. Der Uebergangs-Bootstrap aus #221 ist damit entfernt.
- **Lange Nachweise aus der Kontrollebene.** Der Long-Job in `ci-verify.yml` startet `run-selected-tests.mjs` aus `.rbd-control` und prueft den PR-Baum ueber `RBD_ROOT`. `RBD_REQUIRE_TESTS=1` macht einen uebersprungenen Pflichtnachweis rot; ein normaler Lauf bleibt gruen.
- **Pretask-Arbeitsbrief und Worktree-Pflicht.** `agent:pretask` nennt HEAD, Basis, Worktree, Staging-/Untracked-Status und Claim; jede Lane ausser `main` braucht einen verknuepften Worktree. Ein fehlendes `gh` bleibt als `unknown` sichtbar.
- **Eingaben und Action-Pins.** `ci:long` validiert Soak-Ticks (1-1.000.000) und Balance-Tage (1-400) vor dem Dispatch; `.github/dependabot.yml` pflegt die vollstaendig gepinnten Actions woechentlich.
- Tests: 22/22 in `workflow-hardening.test.ts` (10), `worktree-isolation.test.ts` (8) und `pretask.test.ts` (4); `pnpm run typecheck` gruen; ein absichtlich uebersprungener Langlauf endet mit Exit 1, der normale ausgewaehlte Lauf mit Exit 0.

## [0.3.178] - 2026-11-07

### Technik
- **Langlauf folgt dem Prüfcommit.** `pnpm run ci:long` startet `long-checks.yml` standardmäßig auf dem aktuellen Branch und übergibt die exakte HEAD-SHA; alle Checkout-Schritte prüfen diese SHA aus. `--verify` bleibt die ausdrückliche Ausnahme, `verify:all` läuft nicht automatisch mit. `agent:verify --ci` startet diesen Langlauf für den aktuellen Commit und macht einen roten Lauf zum roten Verify-Ergebnis.
- **Pretask blockt fehlende Voraussetzungen.** Ein offenes `gate-failure`-Issue, ein nicht leerer Arbeitsbaum, ein fehlender `agent:context`-Impact-Plan und eine Claim-Kollision enden mit `ERR-4019` vor dem ersten Edit. Der Issue-Check wird weiterhin automatisch aufgerufen; fehlt `gh`, nennt der Lauf den offenen Prüfpunkt statt ihn zu verschweigen.
- Tests: `workflow-hardening.test.ts` 6/6, `worktree-isolation.test.ts` 8/8 und `pretask.test.ts` 3/3; 17/17 fokussierte Tests. Der Langlauf wird von `agent:verify --ci` mit `--no-verify` gestartet.

## [0.3.177] - 2026-11-07

### Technik
- **Claim 20 nach dem Squash-Merge geschlossen.** `lane/governance/20-dev-profile` steht auf `merged`; Beleg ist `mergedEvidence: branch-tree-on-main` mit `mergedSha: b308fed`. Feature-PR #232 wurde als `b308fed` gemergt.

## [0.3.176] - 2026-11-07

### Technik
- **Lokales `dev`-Profil geschlossen.** `verify:dev` verbindet die Light-Gates mit `test:affected` als eigenem Gate; `agent:verify --profile=dev` und `run-pipeline --profile=dev` nutzen denselben Plan. Der Bericht markiert den Lauf als Teilprüfung und nennt die betroffenen sowie die an CI delegierten Tests.
- Nachweise: `pipeline-modes.test.ts` 6/6; `verify:dev` 7/7 Gates, 181 Testdateien/1000 Tests (999 gruen, 1 bewusst uebersprungen); `verify:test-quality`, `verify:claims` und `verify:docs` gruen.

## [0.3.175] - 2026-11-07

### Technik
- **Der lokale Abschluss prueft jetzt wirklich.** `turn:finish` ermittelt den Impact vor dem Versions-Bump und fuehrt die betroffenen schnellen Tests aus; `--no-affected` bleibt nur fuer reine Doku- und Governance-Turns. `--profile=quick|full` fuehren ihre Tests weiterhin im Verify-Profil aus, damit derselbe Nachweis nicht doppelt laeuft.
- **Lange Nachweise sind Teil des CI-Plans.** `ci-plan.mjs` exportiert die vom Diff gewaehlten Statistik-/Mess-Testdateien, `ci-verify.yml` startet sie als eigene Matrix auf dem exakten PR-Kopf, und der Pflichtstatus fuehrt den Long-Job mit. `narrative-longrun` deklariert seine Beweisklasse jetzt selbst als `statistics`, statt als schneller Vertragstest zu gelten.
- **Main und Wochenlauf.** Runtime- und Testaenderungen auf `main` erzwingen die vollstaendige Suite, waehrend die Gate-Auswahl impact-basiert bleibt; `long-checks.yml` laeuft zusaetzlich woechentlich. `ci:long` startet standardmaessig nur die langen Nachweise, `agent:verify --ci` startet keinen main-Dispatch mehr.
- **Main-Control ohne Bootstrap-Luecke.** Auf `main` nutzt der Lauf den gepushten Merge-Commit als Kontrollebene; PRs behalten die Basis. Damit wirkt die neue Planung bereits im Merge-Lauf, inklusive Long-Matrix und vollstaendiger Suite.
- **Pretask als Arbeitsbrief.** `agent:pretask` ruft den Issue-Check selbst auf, zeigt den Impact-Kontext und blockt einen fehlenden Lane-Claim vor dem ersten Edit.
- Tests: 28/28 in `ci-plan.test.ts` (5), `test-catalog.test.ts` (5), `affected-tests.test.ts` (8), `ci-gates.test.ts` (6) und `workflow-hardening.test.ts` (4); `pnpm run typecheck` gruen.

## [0.3.174] - 2026-11-07

### Technik
- **Claim 27 nachgezogen.** Nach dem Squash-Merge von #228 steht Claim 27 (`lane/governance/18-watcher-promote-tests`) auf `merged` mit `mergedEvidence: branch-tree-on-main` und `mergedSha: cf76ea1`. Der getestete Head `41fcada` und der Merge teilen den Baum `7997502`; `CI Verify` auf `cf76ea1` ist erfolgreich (Run 42368226268). Kein Code geaendert.

## [0.3.173] - 2026-11-07

### Technik
- **Drei Fixes sind jetzt ausfuehrbar belegt.** `pr-watcher.test.ts` prueft, dass ein geschlossenes Issue bei erneutem Fehler zuerst per PATCH wieder geoeffnet und erst danach kommentiert wird. Derselbe Test verweigert den Sweep, wenn `origin/main` nicht exakt dem geprueften `MAIN_SHA` entspricht, und schliesst nur bei exakter Uebereinstimmung. `promote-guard.test.ts` belegt die Suche mit `--base main` und dass ein manueller Dispatch nie als Merge-Erfolg gilt; `claim-evidence.test.ts` verbindet einen mehrdeutigen Branch-Namen direkt mit `decideClaim()`.
- **Testbarkeit ohne CLI-Seiteneffekt.** `pr-watcher.mjs` nimmt API und Git jetzt injizierbar entgegen, exportiert `recordRecurrence()` und `sweepGreenMain()` und startet `main()` nur noch beim direkten Aufruf. `promote-guard.mjs` liefert die reine PR-Suche und die Dispatch-Entscheidung, die `promote.mjs` verwendet.
- Tests: 23/23 in `pr-watcher.test.ts` (3), `promote-guard.test.ts` (9) und `claim-evidence.test.ts` (11); `node --check` fuer die drei Skripte, `verify:light` und `verify:claims` gruen.

## [0.3.172] - 2026-11-07

### Technik
- **Claim 26 nachgezogen.** Nach dem Squash-Merge von #226 steht Claim 26 (`lane/governance/17-trust-hardening`) auf `merged` mit `mergedEvidence: branch-tree-on-main` und `mergedSha: c43bbc9`. Der getestete Head `cfa404e` und der Merge teilen den Baum `d7b64bb`; der naechste Lauf meldet keine Abweichung.

## [0.3.171] - 2026-11-07

### Technik
- **Claim-Merge nur mit Identitaet.** `mergedPullRequestIndex()` fragt Zielbranch, Head-SHA und Cross-Repository-Status mit ab. Ein PR-Beleg zaehlt nur noch fuer `main`, das eigene Repository und exakt den lokalen Claim-Kopf; zwei gemergte PRs mit demselben Branch-Namen werden beide verworfen. Ohne lokalen Kopf bleibt der Claim fail-closed.
- **Promote bleibt auf main.** `openPr()` sucht nur noch PRs mit Basis `main`; ein PR nach `integration` kann nicht als Promotions-PR wiederverwendet werden. Die SHA- und Zielpruefung aus `promote-guard.mjs` bleibt davor unveraendert.
- **Issue-Sweep am exakten Main-SHA.** `pr-watcher.mjs` schliesst Issues nur, wenn `origin/main` exakt dem erfolgreich geprueften `workflow_run.head_sha` entspricht und der gemeldete Commit darauf liegt. Ein erneut auftretender Fingerprint oeffnet ein geschlossenes Issue wieder, statt nur einen Kommentar zu hinterlassen.
- Tests: `claim-evidence.test.ts` 11/11, darunter Zielbranch-, Fork-, Kurz-SHA- und Mehrdeutigkeitsfaelle; `node --check` fuer alle geaenderten Skripte.

## [0.3.169] - 2026-11-07

### Technik
- **Agenten-Isolation technisch durchgesetzt.** `pretask` blockt einen geteilten Arbeitsbaum mit `ERR-4019`, sobald ein fremder offener Claim existiert oder `--require-worktree` gesetzt ist; `--json` nennt `shared-worktree`, `dirty-shared-tree` und `foreign-claim-paths` maschinenlesbar. Ein eigener verknuepfter Worktree passiert, auch mit eigener Arbeit.
- **Eine Testlinie.** `AGENTS.md` fuehrt die erlaubten gezielten Nachweise und die schwere Suite in genau einer Regel; die widersprechende absolute Sperre ist entfernt. `turn:finish` staged weiterhin nur Claim-Pfade.
- **Workflow-Haertung.** `long-checks.yml` uebergibt `balance_days` nur noch ueber `RBD_DAYS` an `balance-run.mjs`, das den Wert validiert; keine `${{ inputs.* }}`-Interpolation in einer `run`-Zeile. Alle Actions in allen Workflows sind auf volle 40-stellige Commit-SHAs gepinnt. Der Testjob laeuft ohne `RBD_CONTROL_ROOT`, damit absolute Fixture-Pfade nicht unter `.rbd-control` landen; die Node-Gates behalten die Kontrollebene.
- Tests: `worktree-isolation.test.ts` (8, inklusive echtem pretask-Refusal und Worktree-Pass), `workflow-hardening.test.ts` (4) und die angepasste Env-Erwartung in `ci-gates.test.ts`. Voller Lauf: 186 Testdateien, 992 Tests bestanden, 6 uebersprungen.

## [0.3.165] - 2026-11-07

### Technik
- **Bootstrap der Kontrollebene.** Kennt der Basis-Commit `RBD_ROOT` noch nicht (Stand vor 0.3.164), faehrt der Lauf seine Gates mit den PR-Skripten und meldet das; der erste Vertrauensgrenzen-PR blockiert damit nicht an seiner eigenen Einfuehrung. Ab dem Merge erkennt jeder Lauf die Basis und trennt Steuerung und Pruefobjekt.

## [0.3.164] - 2026-11-07

### Technik
- **Vertrauensgrenzen der CI.** Planer, Node-Gates und Claim-Pruefung laufen aus einem Kontroll-Checkout des Basis-Commits (`.rbd-control`), waehrend `RBD_ROOT` auf den PR-Baum zeigt. Ein PR kann damit seine Gate-Auswahl und seinen Pruefer nicht mehr selbst umschreiben; Produktcode und Tests bleiben das Pruefobjekt.
- **Promotion an den geprueften Commit gebunden.** `promote.mjs` laedt den Kopf exakt per SHA, prueft Herkunfts-Repository, PR-Ziel und Kopf ueber `promote-guard.mjs` und mergt mit `--match-head-commit`. Manueller Dispatch kennt nur `inspect` und `integrate`, nie ein vorausgesetztes `success`.
- **Claim-Register gegen Selbsterweiterung.** `verify-lane-claims --ci` vergleicht den Claim mit der Basis und der ersten Registrierung im PR: neue Pfade, Owner, Branches oder Contract-Writer werden abgelehnt; fremde Claims und die Kontrollebene bleiben Governance-Lanes vorbehalten.
- **Kein globales Staging mehr.** `turn:finish` setzt nur noch die Pfade des eigenen Claims plus `package.json`/`pnpm-lock.yaml` in den Index.

## [0.3.163] - 2026-11-07

### Technik
- **Inventur nachgezogen.** `docs/INVENTORY.md` fehlte `src/core/governance/__tests__/lane-claims.test.ts` (Abdeckung 1363 statt 1364), weil die Inventur vor dem Staging lief und die neue Datei noch untracked war. `verify:docs` ist wieder gruen.

## [0.3.162] - 2026-11-07

### Technik
- **Claim 14 nachgezogen, Selbstreferenz geschlossen.** `reconcile-claims --apply` schreibt Claim 14 (PR #219) als `merged` mit `mergedEvidence: branch-tree-on-main` und `mergedSha: 893317c`. Danach bleibt kein offener Claim mit gemergtem PR im Register; ein frischer Lauf auf `main` meldet `keine Abweichung`.
- **Ein gemergter Claim fuehrt seinen Branch weiter.** `selectClaim()` in `scripts/lib/lane-claims.mjs` waehlt erst den offenen, dann den gemergten Claim derselben Lane; `verify-lane-claims.mjs` und `turn-push.mjs` nutzen dieselbe Auswahl. Damit braucht der Register-Nachtrag auf dem Branch der zuletzt gemergten Lane keinen neuen Claim, der nach seinem Merge sofort wieder offen waere.
- Drei Testfaelle in `lane-claims.test.ts` decken offene, gemergte und fehlende Claims ab.

## [0.3.161] - 2026-11-07

### Technik
- **Register konsistent.** `reconcile-claims --apply` hat Claim 13 (PR #218) ueber den baumgleichen Commit `e2869a1` als `merged` geschrieben (`mergedEvidence: branch-tree-on-main`, `mergedSha: e2869a1df7945`). Claim 12 bleibt unveraendert `merged` mit seinem Beleg auf `a490d4a`.
- Kein Code geaendert: der Nachweis lief ausschliesslich ueber `localMergeEvidence()` / `decideClaim()`; ein zweiter Lauf meldet `keine Abweichung`.

## [0.3.160] - 2026-11-07

### Technik
- **Merge-Beleg ohne `gh`.** `scripts/lib/claim-evidence.mjs` erkennt zusaetzlich einen baumgleichen Commit auf `main`: ein Squash-Merge hinterlaesst genau diesen Zustand, auch wenn der Branch am Remote geloescht ist. `localMergeEvidence()` liest Kopf, Vorfahrschaft und Baum aus der lokalen Historie; `decideClaim()` bleibt ohne `baseSha`.
- **Register belegt statt geraten.** `reconcile-claims --apply` schreibt `mergedEvidence` und `mergedSha` in den Claim. Claim 12 steht damit als `merged` mit Beleg `branch-tree-on-main` auf `a490d4a`; `verify-lane-claims` meldet fuer dessen Pfade keine Kollision mehr.
- Drei weitere Testfaelle in `claim-evidence.test.ts` decken den Baum-Beleg, die lokale Historie und den fehlenden Branch ab.

## [0.3.159] - 2026-11-07

### Technik
- **Alle roten Gates statt des ersten.** `scripts/lib/gate-diagnostics.mjs` sammelt jeden fehlgeschlagenen Job und Schritt eines Laufs, liest je Befund den ersten echten Fehlercode (PASS-Zeilen zaehlen nicht) und gruppiert gleiche Codes als eine Ursache. `pr-watcher.mjs` legt damit ein Issue mit vollstaendiger Diagnose an, statt `firstGateError()` zu wiederholen.
- **Begrenzter Retry vor dem Issue.** Sind ausschliesslich transiente Befunde (Netz, Runner, Rate Limit) rot und ist `run_attempt < 2`, startet der Watcher den Lauf genau einmal neu. Fachliche Fehler werden nie mit identischen Eingaben wiederholt; danach entsteht das Issue.
- **Merge-Beleg statt Basis-SHA.** `scripts/lib/claim-evidence.mjs` entscheidet den Claim-Status aus einem gemergten PR oder einem Branch-Kopf auf `main`; `baseSha` kommt in der Signatur nicht mehr vor. `reconcile-claims.mjs` schreibt nur mit `--apply` und meldet unbelegte Faelle, `verify-lane-claims.mjs` behandelt eine nachweislich gemergte Lane nicht mehr als Kollision.
- Neun Testfaelle in `gate-diagnostics.test.ts` und `claim-evidence.test.ts` decken mehrere rote Gates, Schritte, PASS-Zeilen, Gruppierung, den geloeschten Branch ohne Beleg und beide Belegarten ab.

## [0.3.158] - 2026-11-07

### Technik
- **Fremde Arbeit bleibt fremd.** `turn-push.mjs` prueft den Arbeitsbaum vor Versions-Bump und Staging gegen den eigenen Claim: liegt ein Pfad ausserhalb der Allowlist, bricht der Turn mit `ERR-4019` ab, statt ihn per `git add -A` mitzunehmen. Die Pfadauslegung kommt aus `lane-claims.mjs` (`allowsPath`), damit Claim-Gate und Staging dieselbe Regel benutzen.
- **Lokales Feedback ohne zweiten Plan.** `pnpm run agent:feedback [--json]` nennt aus dem echten Diff die geaenderten Dateien, die betroffenen Tests, ob ein voller Lauf notwendig ist und welcher Befehl als Naechstes sinnvoll ist. Die Auswahl kommt unveraendert aus `affected-tests.mjs`.
- **Neue Dateien zaehlen mit.** `changedFiles()` liest zusaetzlich unversionierte Pfade (`git ls-files --others`); vorher fehlten genau die neuen Module, und die Testauswahl konnte zu klein ausfallen.
- **Eine Testlinie im Vertrag.** `AGENTS.md` widerspricht sich nicht mehr: waehrend der Arbeit sind `agent:feedback`, Struktur-Checks, `verify:light` und `test:affected` erlaubt; `test`, `test:ci`, `verify:all`, Build und Audit laufen am Turn-Ende oder in GitHub Actions.

## [0.3.157] - 2026-11-07

### Technik
- **Bodies verlieren keine Inhalte mehr.** `scripts/lib/body-sync.mjs` ist die gemeinsame Wahrheit fuer Commit- und PR-Bodies: automatische Zusammenfassungen leben ausschliesslich zwischen `<!-- rbd:auto-body:start -->` und `<!-- rbd:auto-body:end -->`, alles ausserhalb bleibt unveraendert. Doppelte oder unbalancierte Marker brechen die Schreiboperation ab, statt zu raten.
- **Der Diff ist die Wahrheit.** `turn-push.mjs` hat den generischen Commit-Fallback verloren: echte Codeaenderungen ohne inhaltliche `.turn-notes.md` brechen mit `ERR-4006` ab; reine Doku-, Governance- und Versionsaenderungen werden ehrlich als solche beschrieben. `lift-commit-body.mjs` und `promote.mjs` bewerten den vollstaendigen Diff von der Basis bis zum Head (alle Commits, Dateistatus, Runtime vor Doku) und ergaenzen nur fehlende Pflichtsektionen.
- **Promotion erhaelt die PR-Beschreibung.** Der Merge-Text ist der vorhandene PR-Body plus Automationsbereich, nicht mehr der Body des letzten Commits. Laesst sich der Body nicht lesen oder die Markerlage nicht sicher bestimmen, wird nicht gemergt.
- **PR-Escalation ist isoliert.** `.github/workflows/pr-escalation.yml` checkt `main` aus, holt den Push-Branch nur als Ref und fuehrt keinen fremden Code mit `pull-requests: write` aus.
- `turn:finish` respektiert jetzt den eigenen Claim: Meta-Dateien bleiben im Commit, wenn die Lane den Pfad ausdruecklich fuehrt.

## [0.3.154] - 2026-11-07

### Technik
- **Gates folgen dem echten Diff.** `scripts/ci-plan.mjs` liest Basis und Kopf aus dem Event, ermittelt die geaenderten Dateien ueber die vorhandene Impact-Engine (`affected-tests`, `test-catalog`) und waehlt daraus Gates und `RBD_TEST_FILES`. Reine Doku laeuft ohne Typecheck, Build und Suite; Dependencies, Toolchain und unbekannte Pfade eskalieren bewusst auf das volle Profil. `release-impact.mjs` ersetzt den pauschalen `scripts/`-Filter fuer APK-Builds; `reconcile-claims.mjs` gleicht offene Claims idempotent mit dem Remote-Stand ab (Ghost-Claim `lane/actionset/0-6-actionset-v2` jetzt `merged`).
- **Agentenverhalten ist ein Vertrag.** Pre-Task (Issue, sauberer Zustand, `agent:context`-Impact, Lane mit Claim), waehrend der Arbeit nur gezielte Nachweise, After-Task ueber `turn:finish`; CI-Polling ist auf den eigenen Lauf begrenzt (hoechstens drei Abfragen mit wachsendem Abstand), der Monitor berichtet nur. Die Tabelle `Technische Durchsetzung` in `AGENTS.md` nennt, was bereits erzwungen ist und was noch Verhalten bleibt.
- **Gates granular statt ein Monolith.** `scripts/gate-matrix.mjs` uebersetzt den Gate-Plan in eine GitHub-Matrix, `node scripts/run-pipeline.mjs --gate=<name>` faehrt genau ein Gate. `ci-verify.yml` hat je Gate einen eigenen Job und Status (`Gate lint`, `Gate typecheck`, ...), dazu eigene Jobs fuer Lane-Claims und Commit-/PR-Notes. Der Pflichtstatus `Fail-Closed Gates` ist nur das Aggregat.
- Ein Gate ausserhalb des Profils bricht im `--gate`-Modus ab; eine leere Matrix ist ein Fehler. Kein gruener Status ohne Pruefung.
- `scripts/lib/dependency-change.mjs` ist die einzige Wahrheit fuer Dependency-Aenderungen; `audit` steht nur dann in der Matrix, wenn es relevant ist.
- Lane 0.2 (`gov/0.2-governance`) ist im Claim-Register archiviert: ihr Inhalt liegt auf `main`, der Branch war eine zweite Wahrheit ueber denselben Pfaden.

## [0.3.153] - 2026-11-07

### Technik
- Governance entschaerft und geschaerft zugleich: lokal laeuft `verify:light` (Lint, LOC, Typecheck, Doku, Tree, Redundanz), die volle Suite prueft der PR gegen `main` und der Push auf `main`. Feature-Pushes bekommen schnelles Feedback statt `verify:all`.
- `BLOCKED` ist auf echte Notfaelle verengt (Boot, Ledger-/Save-/RNG-Invariante, Geldpfad, kaputter Build). Ein roter Test ist `ERR-4026` (AGENT) und wird ein Issue; Timeout und Abbruch sind `REMOTE_CI` (`ERR-4014`).
- Die acht Meta-Dateien sind fuer Feature-Lanes gesperrt: `verify-lane-claims` laesst nur Doku-Marker und Versionszeile durch und laeuft jetzt auch ohne `node_modules`. `main` bleibt beim Branch-Schutz.
- `promote` mergt nur noch PR-Laeufe; `integration` laeuft ausschliesslich auf Anforderung (`integrate=true`). `pr-watcher` trennt `remote-ci` von `gate-failure` und schliesst Issues, sobald der Stand gruen auf `main` liegt.
- `pnpm audit` nur bei echter Dependency-Aenderung; APK und Release-Assets nur bei Code-, Inhalts- oder Asset-Aenderung. Neu: `pnpm run agent:pretask` (Issue-Check, Konflikte, Lane-Status).
- Claims werden jetzt auch in CI geprueft (`verify-lane-claims --ci`, Diff gegen die Basis) - Cloud-Agenten ohne aktive Hooks fallen damit auf. Owner sind ein fester Roster, Branches folgen `lane/<domäne>/<task>`, `CODEOWNERS` nennt den Menschen fuer Meta und Workflows.
- Ein Push auf einen Branch mit offenem PR startet kein zweites volles Gate mehr; der PR-Lauf ist die Wahrheit. Rote Lane-Gates bekommen `lane:<domäne>` und blockieren nur diese Lane. PARKED hat einen Pflichtabschnitt in `docs/ROADMAP.md`.
- Der Watcher liest den Fehlercode nur noch aus roten Gate-Zeilen und nennt die betroffene Datei; PASS-Zeilen erfolgreicher Tests koennen kein Issue mehr erzeugen. Das Claim-Register ist fail-closed und wird atomar geschrieben; Praefix-Ueberschneidungen (`docs/**` vs `docs/CHANGELOG.md`) werden erkannt.
- `turn:finish` pusht nur den Arbeitsbranch und bricht auf `main` mit `ERR-4023` ab; `promote` legt den PR nach gruenem Push an und mergt erst den PR-Lauf. `long-checks` laeuft nicht mehr standardmaessig mit `verify:all`; der Watcher bricht sich nicht mehr selbst ab.

## [0.3.145] - 2026-11-06

### Technik
- Doku konsolidiert: Die elf verbliebenen Referenzdokumente unter `docs/` wurden nach Ueberfuehrung ihrer Inhalte geloescht. `docs/ROADMAP.md` ist die einzige Stelle fuer offene Punkte; alle zuvor offenen Befunde stehen dort.
- Fehlerregister nach `docs/ARCHITECTURE.md`, Testkatalog nach `docs/INVENTORY.md`, Eskalationsleiter nach `AGENTS.md`, Produktvertrag nach `docs/ROADMAP.md`. `verify-redundancy` und der Governance-Test lesen das Fehlerregister jetzt aus dem Architektur-Anhang; `pnpm run catalog` schreibt den Katalogblock in das Inventar.
- Der UI-Test `machine-play` wartet unter paralleler Last bis zu 3 s auf die Spielbuehne; die Assertion bleibt unveraendert.
- Keine Spiel-, Simulations-, Ledger-, RNG- oder Save-Aenderung.

## [0.3.144] - 2026-11-06

### Features
- Die erreichte Firmenstufe ist sichtbar: HUD und Betriebspanel nennen Name und Stufe, das Panel zusaetzlich die offenen Bedingungen bis zur naechsten Stufe mit Ist und Soll. Die Anzeige ist reine Ableitung aus `companyStatus()`, keine zweite Wahrheit.

### Technik
- `GameView.company` traegt den abgeleiteten Firmenstatus; `FloorStage` faengt einen fehlgeschlagenen Pixi-Start ab und zeigt einen bedienbaren Hinweis statt einer schwarzen Flaeche.
- `tycoon-ops.test.ts` beobachtet die Kassierer-Wartezeit 240 statt 80 Ticks; seed-abhaengig langsame Gaeste machten den Lauf sonst sporadisch rot, ohne dass eine Assertion abgeschwaecht wurde.
- Keine Aenderung an Spiel, Ledger, RNG oder Save.

### Doku
- Audit #19 geschlossen: Firmenstufen-Anzeige und Pixi-Fallback nachgezogen, restliche Punkte mit Code-/Doku-Beleg im Issue kommentiert. `integration` steht auf `main`, PR #142 ist geschlossen, `feat/spatial-layout-editor` ist der einzige Arbeitsbranch.

## [0.3.143] - 2026-11-06

### Features
- Floor als Spielwelt: `data-perspective` am App-Rahmen, `FloorRoleBar`, `PerspectiveSwitch` und getrennte Docks fuer GAST und BETRIEB; das Automaten-Popup zeigt dem Gast direkt die Spielbuehne, dem Betrieb Diagnose, Reparatur, Mods und Walzen.
- `MachineOperatorBody` und `MachinePlayLazy` trennen Betriebskoerper und Gasttisch; der interne BETREIBER/GAST-Toggle im Popup entfaellt.
- Narrative-Registry leitet die Fragmentzahl aus `manifest.json` ab; der FREE_DRINK-Test prueft unabhaengig vom Geraetezustand.

### Technik
- PR #150 auf den `main`-Stand (0.3.142) zusammengefuehrt; Konflikte in `App.tsx`, `dock.tsx`, `hud.tsx`, `machine-popup.tsx`, `app.css`, zwei Tests, Doku und Versionsdateien.
- Marke und `Ctrl+Shift+D` bleiben der versteckte Werkstatt-Einstieg; ein Klick auf die HUD-Marke zaehlt wieder fuenf Tipps.
- `machine-operator.tsx` laedt den Plinko-Editor ueber `PlinkoEditorLazy`; die 185-KB-Buehne bleibt damit lazy wie seit 0.3.141.
- Keine Aenderung an Spiel, Ledger, RNG oder Save.

### Doku
- `docs/PLAN-LEAD-MERGE*.md`, `docs/REVIEW-*.md` und `docs/SKILL_*.md` bleiben mit 0.3.140 in die Pflichtdoku ueberfuehrt und geloescht.

## [0.3.142] - 2026-11-06

### Technik
- `floor-view.ts` gibt Kamera-Container, LOD-Stufe, Basisposition und `camDirty` an `floor-camera-rig.ts` ab; die Buehne orchestriert nur noch Ebenen, Update-Reihenfolge und Culling (219 auf 195 Zeilen).
- `guest-art.ts` teilt sich in `guest-rig.ts` (Skelett, Gelenke, Pin, Namensschild, Squash, Tap-Ring), `guest-paint.ts` (Palette, Koerper, Arme, Beine, Pin) und `guest-head.ts` (Schaedel, Gesicht, Haar, Kopf-Textur); die Fassade bleibt mit 105 statt 346 Zeilen.
- `scripts/loc-budgets.mjs` fuehrt beide Legacy-Eintraege nicht mehr; der `@loc-exception`-Header in `guest-art.ts` ist geloescht.
- `animateFloor` nimmt die Kamera-Buehne statt `cam` und `camDirty`.
- PR #160 auf den `main`-Stand (0.3.141) zusammengefuehrt; Konflikte nur in Doku, `package.json` und `pnpm-lock.yaml`, Code konfliktfrei.
- Keine Aenderung an Spiel, Ledger, RNG oder Save.

## [0.3.141] - 2026-11-06

### Technik
- Floor-Atlas auf WebP-q95 umgestellt: 1.040.593 B -> 384.234 B (-63 %), beide 1024er-Seiten mit unveraendertem Shelf-Plan und Frame-Koordinaten.
- `PlinkoEditorLazy` schneidet die 184.863-B-Buehne aus dem Modulpreload; Initial-JS 1.186.336 -> 1.173.926 B.
- Die zwei HUD-Data-URIs liegen in einem eigenen, vorgeladenen `hud-icons`-Chunk (4.337 B); `icons` 68.043 -> 63.767 B, `plinko-stage` 6.275 B lazy ohne HUD-Data-URI.
- Initialgraph nach beiden Schritten: 1.174.034 B in 18 Chunks (+108 B gegenueber 1.173.926 B, ein Chunk mehr).
- PR #161 auf den aktuellen `main`-Stand zusammengefuehrt; Konflikte nur in den sechs Pflichtdokumenten, Code konfliktfrei.
- Keine Aenderung an Spiel, Ledger, RNG oder Save.

## [0.3.140] - 2026-11-06

### Technik
- Merge-Gate auf `main` repariert: Der Merge von PR #163 lief nur mit `commit_title`, deshalb trug `6f7a906` keine Pflichtsektionen und `verify-commit-msg --head` wurde rot (`ERR-4006`); `Bump, tag, release` und der APK-Bau fielen aus. `docs/GATE-ROOTCAUSE.md` haelt den Fall und die Regel fest: `commit_message` traegt den PR-Body.
- Keine Spiel-, Ledger-, RNG- oder Save-Aenderung.

## [0.3.139] - 2026-11-06

### Technik
- Doku konsolidiert: 18 historische Analyse-, Review-, Plan- und Skill-Dokumente nach Ueberfuehrung ihrer offenen Punkte in `ROADMAP.md`, `INVENTORY.md`, `ARCHITECTURE.md` und `DEVTAGEBUCH.md` geloescht. `PLAYER_CASH` ist im Inventar wieder als offen belegt (Funktion ohne Produktions-Aufrufer).

## [0.3.138] - 2026-11-06

### Spiel
- Offene Gewinne an der Wechselkasse liegen sichtbar vor dem Tisch: Der Chip-Stapel wird nicht mehr von der Tischgrafik verdeckt.
- Das fremde Haus färbt sich nach dem aktiven Spiel: SLOT Neon-Rot, BLACKJACK/POKER/ROULETTE Samt-Violett, PLINKO/DICE/SHELL/VIDEO_POKER Cyan.

### Technik
- `GamesPopup` reicht `machine.game` an `PopupShell` weiter; damit trägt jeder Dialog sein `data-game`, und die bestehenden `--game-*`-Regeln greifen.
- `FloorCash.sync()` liefert den Fußanker des Wechseltischs; `FloorProps` sortiert den Stapel am selben Anker als Requisite vor dem Tisch, aber hinter Figuren. Kein Save-, Ledger- oder RNG-Eingriff.

## [0.3.137] - 2026-11-06

### Technik
- HUD-PNGs inline: zwei Requests weniger im Kaltstart. Die Icons `ui/coin.png` und `ui/guest-cyan.png` liegen als Data-URI in `src/ui/hud-icons.ts`; der kalte Slow-4G-Lauf (1,6 Mbit/s, 150 ms RTT) faellt von 24 auf 22 Requests. Der erste Frame bleibt mit 12,16 s bandwidth-bound (2,42 MB), weil die beiden Bilder nur rund 3,8 KB ausmachen. Keine sichtbare Aenderung.

## [0.3.136] - 2026-11-06

### Technik
- Der Phase-6-Abnahmeplan ersetzt das alte Exit-Kriterium in `docs/PLAN-OPTIK-VISUELL.md`: Ausgangsbild der Desktop-Sichtpruefung, Pruefmatrix A1-A8 (Grundbild, Werkstatt-Einstieg, sechs Ziele, Spiegel, FPS, Touch, Huelle/Performance, Release), Reihenfolge und Exit. A1 ist bestanden, A2-A8 bleiben offen.
- Keine Mechanik-, Ledger-, RNG- oder Save-Aenderung; die Doku-Aenderung laeuft mit `verify:quick`.

## [0.3.135] - 2026-11-06

### Spiel
- Der Floor laedt wieder: Der Szenen-Cache gab die Schmutz-Ebene nicht zurueck, wodurch Pixi beim Aufbau mit `undefined` abbrach und der Ladebildschirm haengen blieb.

### Technik
- Der Typecheck prueft jetzt wirklich `src/`: `src/Config/tsconfig.json` zeigte mit `"../src"` auf `src/src`. Nach der Korrektur wurden 87 latente Typfehler behoben (Re-Exports, optionale Erinnerungen, VaCoinMicro-Grenzen, ViewRect, Floor-Signaturen, Test-Callbacks); `src/vite-env.d.ts` deklariert `vite/client` und die `.mjs`-Skriptimporte.
- Die doppelte `VISITOR_SERVICE`-Emission in `serveDrinkCmd`/`talkCmd` ist entfernt; der Fact entsteht nur noch in `desk-service.ts` bei anwesendem Kassierer.
- `pnpm run inventory:build` meldet 1324 Dateien und 86 Ordner.

## [0.3.134] - 2026-11-06

### Technik
- Der FREE_DRINK-Test akzeptiert jetzt auch den Kreditweg des Betriebsanteils: Ist das Hauskonto nach einem Payout leer, bucht `payOrBorrow` `"mod betrieb auf kredit"`. Der Test summiert beide Buchungswege und prueft den exakten Mod-Betrag; die zuvor roten Seeds 9, 18 und 20 laufen.

## [0.3.133] - 2026-11-06

### Technik
- GitHub Actions laufen jetzt auf Node-24-Runtimes: `checkout@v7`, `setup-node@v7`, `cache@v6`, `upload-artifact@v7`, `setup-java@v6` und `setup-android@v4`. Alle Linux-Jobs pinnen `ubuntu-24.04` statt `ubuntu-latest`, damit die 26.04-Migration nicht unkontrolliert in den Build rutscht.
- Der FREE_DRINK-Test pinnt Geraetezustand und Haltbarkeit; ein vom Generator beschaedigtes Geraet kann den Lauf nicht mehr seed-abhaengig rot machen.

## [0.3.132] - 2026-11-06

### Spiel
- Die Werkstatt ist jetzt ein Raster mit sechs Bereichen: Prüfung, Protokoll, Assets, Sound, Steuerung und FPS. Sie öffnet sich nur noch über fünf Tipps auf die HUD-Marke oder `Strg+Shift+D`.
- Der Charaktereditor liegt nicht mehr im Werkstatt-Menü: Ein Spiegel im Lager öffnet ihn über die Floor-Aktion „Spiegel“. Jede Hausvorlage bringt genau einen Spiegel mit.
- Die FPS-Karte misst den Browser-Frame-Takt live; Steuerung und Hilfe bleiben als sekundäre Werkzeuge erreichbar.

### Technik
- `workshop.tsx` ist der einzige Rahmen; `workshop-parts.tsx` liefert Rasterkarte, Steuerung und FPS. `diagnostics`, `journal`, `asset-library` und `sound` exportieren wiederverwendbare Panels ohne zweiten Shell.
- `SPIEGEL` ist ein `DECOR`-Katalogeintrag und wird in allen drei Blueprints in der Lagerzone platziert. `buildFurnitureActions` erkennt ihn am Label; der Look-Pfad läuft über `Popup = { kind: 'look' }`.
- Unbekannte Deko teilt sich keine gebackene Atlastextur mehr; der Spiegel wird prozedural gezeichnet.

## [0.3.131] - 2026-11-06

### Spiel
- Persona-Budget skaliert jetzt den Einsatz: High Roller setzen bei genügend Chips höher, bleiben aber auf das Dreifache des Tisches und den verfügbaren Bestand begrenzt.
- VELVET hebt die Persona-Stufe neuer Gäste um eins, FREE_DRINK serviert einen echten Drink aus dem Barbestand und bucht den Betriebsanteil nur bei Lieferung. EXTRA_REEL erhöht die Slot-Walzen tatsächlich und setzt das Gerätegedächtnis zurück.
- Die Wechselkasse bedient Auszahlungen erst am Kopf der Schlange. Der Slot-Drucklader gleicht den Einsatz aus, statt einen zweiten Gewinn zu zahlen; die tatsächliche Session-Quote bleibt damit im angezeigten Band.
- Das Haus tilgt HAUS_SCHULDEN im Tagesabschluss aus dem Überschuss über HOUSE_FLOAT. Reparatur, Mod-Einbau, Walzen-Upgrade und Mindesteinsatz nennen ihre letzte Wirkung sichtbar.

### Technik
- `personaStake` bündelt Budget, Sucht und Wallet-Deckel; `resolveModEffects` dedupliziert Mod-Ids und liefert `freeDrink`/`freeDrinkCost`; `guestTier` ist die einzige VELVET-Ableitung.
- `repayDebt` nutzt das bestehende Hauskonto und die bestehende Verbindlichkeit, kein zweites Konto. `arrivalGap` folgt der Nachfrage ohne 90-Tick-Deckel.
- Neue Regressionstests für Ankunftsrate, CASHOUT-Reihenfolge, Persona-Einsatz, Free-Drink-Bestand, VELVET-Stufe, EXTRA_REEL, Mod-Deduplizierung, Schuldentilgung und Slot-RTP (60.000 Spins, 90–96 %).

## [0.3.130] - 2026-11-06

### Spiel
- Jedes eigene Spielgerät hat jetzt zwei Rollen: Betreiber mit dem kostenlosen TESTSPIN und Gast mit dem privaten PORTEMONNAIE. Der Gastmodus nutzt für SLOT, BLACKJACK, POKER, VIDEO_POKER, ROULETTE, PLINKO, SHELL und DICE dieselben Fenster und Engines wie das Fremdhaus.
- Einsätze buchen PORTEMONNAIE → HAUSKONTO, Gewinne HAUSKONTO → PORTEMONNAIE. Reicht das Hauskonto nicht, wird der volle Gewinn über HAUS_SCHULDEN als Verbindlichkeit gebucht; nichts wird gekürzt.
- Der Betreiber-Testspin bleibt kostenlos und ohne Ledger-, Welt- oder Gameplay-RNG-Wirkung. Eine offene Kartenrunde und ihre Abrechnung sind genau einmal buchbar.

### Technik
- `src/core/sim/own-play.ts` kapselt den eigenen Geldweg und den PRNG-Rollback; `src/store/own-play.ts` führt die Pending-Map je Gerät gegen Doppelabrechnung. `MachinePopup`, `MachinePlay` und `TableLauncher` trennen Rolle und Tisch, ohne eine zweite Spiel-Engine zu bauen.
- Neue Tests: `src/core/sim/__tests__/own-play.test.ts` (alle acht Spiele, ungedeckte Gewinne, Testspin, fremder Geldweg), `src/store/__tests__/own-play.test.ts` (Doppelbuchung, Save/Load) und `src/ui/__tests__/machine-play.test.tsx` (Rollenwechsel, Testspin, Gastwurf).

## [0.3.129] - 2026-11-06

### Technik
- Editor-UI `src/ui/layout-editor.tsx`: Werkzeuge für Boden, Wand, Tür, Durchgang und Entfernen, Materialauswahl, Achsenwahl, Undo/Redo und ein sichtbarer Importfehler. Der Editor liegt als eigener Lazy-Chunk hinter `VITE_RBD_EDITOR_MODE=1` und `?editor=1`.
- Pixi-Auswahl: `editor-overlay.ts` zeichnet die aktuelle Zelle und die gewählte Kante über der Welt, ohne selbst Klicks zu fangen; `FloorView` reicht nur den Cursor durch.
- Ctrl+Z / Ctrl+Y (⌘ auf dem Mac) laufen über `editor-tools.ts`; Pinselstriche bleiben ein Verlaufsschritt, Escape schließt den Editor.
- Export/Import: `world-store` exportiert das Layout über `layout-json.ts` und importiert es fail-closed inklusive Rastergrößen-Prüfung gegen die Vorlage.
- Produktionsausschluss: `import.meta.env.DEV` plus das Flag entfernen den dynamischen Import; ein Build mit gesetztem Flag enthält weder Editor-Chunk noch Editor-CSS oder Editor-Strings.
- Neue Tests: `editor-tools.test.ts` (5) und ein Produktionsfall in `editor-gate.test.ts`.

## [0.3.128] - 2026-11-06

### Technik
- Typisierte Layout-Commands: `src/core/sim/layout-commands.ts` malt Bodenrechtecke und Rasterkanten (`WALL`, `DOOR`, `OPENING`, entfernen). Das Ergebnis ist wieder eingefroren und läuft durch denselben fail-closed `parseLayout()`-Vertrag wie ein Save; die letzte Tür lässt sich nicht zumauern.
- 30-Schritt-Undo/Redo: `LayoutHistory` hält fertige Layouts, verwirft Redo bei neuer Arbeit und vergisst den ältesten Schritt. Ein Pinselstrich zählt als genau ein Schritt, egal wie viele Tiles er berührt.
- Der Store bleibt der einzige Schreiber: `world-store` delegiert an `src/store/layout-editing.ts`; `applyLayout()` zieht `size`/`zones` weiter nach. Keine Änderung an Simulation, Ledger, RNG oder Save-Format.
- Neue Tests: `layout-commands.test.ts` (7) und `layout-history.test.ts` (5).

## [0.3.127] - 2026-11-06

### Technik
- Branch-Konsolidierung: `main` (0.3.122), der konfliktbehaftete PR #142, der `integration`-Stand und der Asset-Semantik-Branch sind in `feat/spatial-layout-editor` zusammengeführt. Alle fünf Task-Commits und die zuvor offenen Branch-Stände liegen damit in einem PR gegen `main`.
- Konfliktauflösung folgt der einen räumlichen Wahrheit: Navigation und Wandkollision laufen über `nav-grid.ts` und `layout.edges`; die zonenbasierten `walls.ts`-Dateien aus `main` und PR #142 sind entfernt.
- `deliveries.ts` folgt nach dem Merge der `NavGrid`-Signatur (`worldNav`); ohne die Korrektur fand die Lieferkette kein freies Kisten-Tile mehr und 18 Tests fielen aus.
- Doku und Narrative zusammengeführt: alle drei Beiträge vom 2026-11-06 stehen im Manifest, die Registry hat 65 Fragmente; Inventar 1327/1327.

## [0.3.125] - 2026-11-06

### Technik
- Task 5/5 ist vorbereitet: `src/core/sim/layout-json.ts` exportiert und importiert das Layout als versioniertes Dokument (`rbd-layout`, Version 1) mit fester Feldreihenfolge. Der Import ist fail-closed und nutzt denselben `parseLayout()`-Vertrag wie ein Save.
- `src/ui/editor-gate.ts` lässt den Editor nur in einem Build mit `VITE_RBD_EDITOR_MODE=1` und `?editor=1` zu; der Query-Parameter allein öffnet nichts.
- Noch kein Editor, kein Store-Command und kein Undo/Redo: Diese Schritte folgen mit der Editor-Oberfläche.

## [0.3.122] - 2026-11-06

### Technik
- Neuer Bestandskatalog `src/render/assets/asset-semantics.json`: 539 Bilder, 3 Animationen, 4 Emitter und 6 Tonspuren mit Rolle, Typ, Anchor, sichtbaren Bounds, Tiefenklasse, Occlusion, LOD, Varianten und optionalen Animationsreferenzen. Das Manifest bleibt die einzige Quelle fuer IDs und Pfade; der Katalog fuehrt nur Semantik.
- `docs/ASSET-SEMANTICS.md` beschreibt den Metadatenvertrag: Pflicht- und optionale Felder je Asset-Typ, die neun Zeichenebenen aus `floor-view.ts`, 15 bestehende Render-Zuordnungen und 23 Rollen-Dubletten.
- Befund: kein Asset ist belegbar interaktiv. `interactive` steht ueberall auf `unknown`, weil Interaktion an `Furniture`/`GameView` haengt und nicht an der Textur. 444 Bilder haben keinen Code-Bezug und sind mit `evidence: "category"` markiert.
- Keine Runtime-Integration, keine Renderer- oder Core-Aenderung: kein Modul liest den Katalog, `manifest.json` bleibt unveraendert.

## [0.3.121] - 2026-11-06

### Spiel
- Waende, Tueren und Zonen haben eine eigene raeumliche Wahrheit im Spielstand. Ein ausgebautes Haus behaelt seine Erweiterungsflaechen jetzt auch nach Speichern und Laden; vorher gingen sie beim Replay verloren.
- Keine sichtbare Aenderung: Boden, Zonenfarben und Darstellung bleiben unveraendert.

### Technik
- Inventur repariert: `docs/INVENTORY.md` deckt wieder jede getrackte Datei ab, `verify:docs` (`ERR-4017`) ist grün; der Pre-Commit-Hook stagt die Inventur jetzt selbst.
- `main` mit 0.3.120 in den Arbeitsbranch gemerged; Konflikte in Doku und Version zugunsten von `main`, die Wandkollision bleibt erhalten.
- Möbel, Figuren, Personal, Kisten, Streitmarker und Wandvorderseiten teilen jetzt eine Tiefenebene (Task 4/5): `src/render/depth.ts` sortiert ausschließlich nach Fußanker, dann Typ-Rang (Requisite, Möbel, Figur, Wand), dann stabiler ID.
- Große Sprites werden nicht mehr über ihre Oberkante einsortiert; ein 4×2-Objekt liegt an seiner Unterkante. Der Spieler ist ID 0, Gäste und Personal behalten ihre IDs.
- Vordergrundwände sind eigene Occlusion-Sprites in derselben sortierbaren Ebene: Figuren nördlich einer Wand liegen dahinter, Figuren südlich davor. Die Wandtexturen entstehen einmal je Ausrichtung und werden von allen Kanten geteilt.
- Die Sortierung läuft nur, wenn sich ein Anker oder eine ID geändert hat; Standbilder kosten keine Sortierung. Chunk-Caches, Atlas und First-Frame-Handshake bleiben unverändert.
- Neue Messung `depth-perf.bench.ts` auf derselben Szene: SMALL 0,062 ms, MEDIUM 0,028 ms, LARGE 0,081 ms je Neu-Sortierung (200 Figuren, 119–359 Wände).
- Boden und Wände kommen jetzt vollständig aus dem Layout (Task 3/5): `src/render/floor-material.ts` löst jede `FloorMaterialId` in genau eine Darstellung, eine optionale Manifest-Textur und eine stabile Fallback-ID auf. CARPET nutzt `casino-carpet-plum.png`; WOOD, TILE, STONE, LINOLEUM und CONCRETE bleiben deterministisch prozedural, ohne erfundene Pfade.
- Die alte Zonen-Materialtabelle ist entfernt: `floorTextureFor()` und `FLOOR_TEXTURE` ordneten Muster-Schlüssel (`carpet`, `planks`, `rug`) Wallpaper-Dateien zu und waren damit kein Materialvertrag. Materialatlas und Texturauflösung laufen weiter über `textureFor()` (Nearest-Sampling, Atlas-Fallback, stiller Rückfall).
- Zonen bleiben semantisch: Lichtfarbe und Ausstattung hängen an `ZoneKind`, nicht am Boden. `lightFor()` hat eine eigene Zonen-Lichttabelle; die Teppichwahl maskiert nur noch CARPET-Tiles aus dem Layout statt ganzer Zonen.
- Wände, Ecken, Anschlüsse und Türen entstehen aus `layout.edges`: Jede Kante gehört genau einer Kachel (H der südlichen, V der östlichen), das Band liegt vollständig darin, die Vorderseite sitzt an Süd-/Ostkante. DOOR bekommt Pfosten und Schwelle, OPENING nur die Schwelle; nur die Haustür auf dem Rand leuchtet.
- Chunk-Invalidierung ist tile-genau: `regionHash` mischt Bodenmaterialien und Kanten des Chunks über einen WeakMap-Cache je Layout-Identität. Eine einzelne Tile- oder Kantenänderung backt nur den betroffenen 30×30-Chunk.
- Kanten-Navigation (Task 2/5): `src/core/sim/nav-grid.ts` trennt belegte Möbel-Tiles von Wandkanten; nur `WALL` blockiert einen Übergang, `DOOR` und `OPENING` bleiben passierbar.
- `blockedTiles()` sperrt keine Rand-Tiles mehr. Den Rand schließt die Randkante des Layouts; Gäste, Spieler und Staff können die Randkachel betreten, aber nicht hinaus, und niemand wird mehr durch eine unsichtbare Tile-Sperre vom Eingang ferngehalten.
- A* prüft jeden Schritt über `stepOpen()` (`H` zwischen (x, y-1)/(x, y), `V` zwischen (x-1, y)/(x, y)); Diagonalen bleiben gesperrt, die Wegfindung deterministisch.
- `accessPointsFor()` liefert alle freien Zugänge eines Footprints mit offener Kante zum Objekt; `interactionPoint(world, item, slot)` verteilt Sitzplätze, Staff und Gäste darauf, `approachPoint()` bleibt als sicherer Fallback in der alten Reihenfolge (unten, links, rechts, oben).
- Platzierung: `canPlaceAt()` weist Tür-Tiles ab, verlangt mindestens einen Zugang mit offener Kante und prüft über `nav-reach.ts`, dass keine Platzierung einen bisher erreichbaren Service (EXCHANGE, BAR, TOILET, STORAGE, JOB_STATION) versiegelt.
- Zielvalidierung: Reserviert ein Gast einen Platz ohne Weg, wird die Reservierung sofort freigegeben; Spawn- und Eingangsplatz prüfen Begehbarkeit statt nur der Koordinate.
- Der Nav-Cache hängt an Brettgröße, Möbelstruktur und der Identität des unveränderlichen Layouts; jede Layout-Änderung erzwingt ein neues Raster, kein veralteter Pfad bleibt stehen.
- Spatial Layout Contract (Task 1/5): `src/core/sim/layout-types.ts` trennt `ZoneKind` (Spielbedeutung), `FloorMaterialId` (Bodenoptik) und `LayoutEdge` (Wand, Tuer, Durchgang). `LayoutState` traegt `size`, genau ein Bodenmaterial pro Tile, semantische Zonen und Kanten mit stabilen IDs.
- Eine Wahrheit: `WorldState.layout` ist kanonisch; `WorldState.size` und `WorldState.zones` sind daraus abgeleitete Legacy-Sichten und werden nur ueber `applyLayout()` geschrieben. `GameView.layout` reicht denselben unveraenderlichen Plan an Renderer und Editor weiter.
- Kanten sind eindeutig verankert (`H` zwischen (x, y-1) und (x, y), `V` zwischen (x-1, y) und (x, y)); je Koordinate existiert hoechstens eine Kante. Eine Wand mit Tuer-ID, eine doppelte Kante oder eine Tuer ohne ID wird fail-closed verworfen. Die Eingangstuer liegt auf derselben Kante wie `doorPoint()`.
- `src/core/sim/layout-derive.ts` leitet den Plan deterministisch aus der Vorlage ab, vergibt Bodenmaterial je Zone, setzt vier Randwaende und oeffnet genau eine Eingangstuer. Beim Ausbau bleiben alte Tiles und Tueren erhalten, die alte Aussenwand verschwindet, neue Flaechen erben ihre Zone.
- Save v11 (`vcoin.casino.v11`, `version: 11`): `SAVE_VERSIONS` und `SavedGame` kennen 5–11, `src/store/migrate-layout.ts` liest v11 fail-closed und leitet v5–v10 deterministisch aus dem Template ab. `replaySave`, `toSavedGame`, Export und Import tragen das Layout mit; Ledger, PRNG, Gaeste, Besucher, Narrative und Rivalen bleiben unveraendert.
- Tests: `layout-contract.test.ts` und `save-layout.test.ts` decken alle Vorlagen, die vier Randrichtungen, Tuer, Bodenmaterial, Ausbau, ungueltige Dimensionen/IDs/Materialien/Referenzen, fehlenden Durchgang, v5–v10-Migration und Import-Ablehnung ab.

## [0.3.120] - 2026-11-05

### Spiel
- Die Buehne laedt 153 Figuren-, Geraete-, Deko- und Umgebungsframes aus zwei fest gepackten Atlasseiten statt aus 153 Einzeldateien; der Einzeldatei-Fallback bleibt fuer fehlende Seiten.
- Der Loader verschwindet erst nach dem ersten echten Pixi-Frame. Auf dem 4G-Pruefpfad (9 Mbit/s, 70 ms RTT, kalter Cache) standen 20 Requests und 2,51 s bis zum ersten Frame.
- Der Performance-Governor schaltet nach zwei Sekunden anhaltender Abweichung zwischen hoch, mittel und niedrig: DPR 1,5/1,25/1,0, 60/60/30 fps, 200/120/60 Partikel und 6/4/0 Lichter.
- Die mobile Huelle traegt `viewport-fit=cover`, Safe-Area-Variablen und einen Hochformat-Hinweis; die Android-Konfiguration pinnt die MainActivity auf Hochformat.
- Haptik ohne neue Abhaengigkeit: 8 ms bei Klick, `[12, 40, 18]` beim Jackpot; bei `prefers-reduced-motion` bleibt das Geraet still.

### Technik
- `src/render/assets/atlas.ts`: `shelfPack` sortiert nach Hoehe, Breite und Pfad; der Produktionspfad registriert die Frames aus `manifest.atlas.pages`, der Laufzeitpfad packt die vier Ordner weiterhin selbst.
- `scripts/lib/atlas-png.mjs` und `scripts/build-asset-manifest.mjs`: deterministischer 1024er-PNG-Atlas (8-Bit-RGBA, Shelf, Padding 0) mit zwei Seiten und Frame-Koordinaten im Manifest; keine neue Abhaengigkeit.
- `textures.ts` liest zuerst den Atlas, dann die Einzeldatei. `main.tsx` wartet nur auf die Atlasseiten; Symbole und Plinko folgen nach dem ersten Frame im Leerlauf.
- `perf-governor.ts` bekommt nur `deltaMS`, haelt die Stufe zwei Sekunden und steuert Renderer-DPR, `ticker.maxFPS`, Partikel- und Lichtbudget ueber `FloorView.setBudget`.
- `music.ts` laedt und spielt erst nach einer Nutzergeste; der stille Vorlauf konkurriert nicht mehr mit dem ersten Frame.
- `pnpm run android:apk` erzeugt eine signierte Debug-APK (`artifacts/rigged-by-design-debug.apk`, 21 MB, v2-Signatur, `screenOrientation=1`).

## [0.3.119] - 2026-11-05

### Spiel
- Geld bekommt Gewicht: Jackpot platzt in Gold und schuettelt 6 px, grosse Auszahlungen klingeln an der Kasse, Streit qualmt rot, Ladegeraete pulsieren.
- Die Kasse ist ein Objekt: offene Gewinne liegen als Chip-Stapel am Wechseltisch (1–6 Chips je 5 VC), darunter warmes Pulslicht; das Klingeln laeuft hoechstens alle 1,04 s.
- Laune unter 40 zeigt eine Sprechblase „Hier stimmt was nicht“ statt einer Zahl.
- Spielfenster tragen ihre Farbe: Slots Neon-Rot, Tische Samt-Violett, Plinko/Wuerfel/Huetchen/Video Poker Cyan.

### Technik
- `floor-events.ts`: eine Subscription, acht Ereignisse, je Burst/Ton/Licht/Shake und Anker aus `itemId`/`guestId`; `floor-fx.ts` ist nur noch Darstellung mit gepooltem Licht.
- `floor-cash.ts`: Chips, Puls und tickgedrosseltes Klingeln; haengt an der Requisiten-Ebene und wird aus dem Snapshot gespeist.
- `fx/emitter.ts`: `smoke-puff` aus den Animationsframes, `activeEmitterCount()` fuer die Werkstatt.
- `comic-bubbles.ts`: `createComicSticker` kombiniert Icon und Satz; `popup-shell`/`table-stage` tragen `data-game`, `tokens.css` die drei Farbfamilien.

## [0.3.118] - 2026-11-05

### Spiel
- Touch zuerst: Ein Finger zieht die Karte (ab 8 px), ein Tipp laesst die Figur laufen. Rechte Maustaste bleibt der Desktop-Weg, Pinch bleibt.
- Ziele sind auch ohne Hover sichtbar: Das Zielraster erscheint schon beim Aufsetzen des Fingers und leuchtet 500 ms nach.
- Die Aktionskarte ersetzt das Radialmenue: unten in der Daumenzone stehen eine grosse empfohlene Aktion, zwei Alternativen und ein X statt 28-px-Zielen.
- Sofortiges Feedback: Figuren quetschen sich 90 ms beim Tipp, ein Ring oeffnet sich am Fuss, Objekte leuchten 120 ms ueber einem gebackenen Glow-Ring.

### Technik
- `floor-touch.ts`: Ein-Finger-Pan ab 8 px mit `pointerType !== 'mouse'`; der Tipp laeuft erst bei `pointerup`, damit ein Schwenk nicht zusaetzlich laeuft.
- `floor-input.ts`: `handleTap(button, point, ...)` liefert `TapHit | null`; `onActions(actions)` ersetzt `onOpenMenu(actions, x, y)`, `screenPoint()` uebersetzt Touch-Pixel in Kamera-Koordinaten.
- `fx/emitter.ts`: Sprite-Pool mit 200 Partikeln, `acquire`/`release`, `textureFor` einmal je Burst, kein `destroy` im Frame.
- `fx/floor-fx.ts` haengt am Kamera-Container, rechnet in Weltkoordinaten und wird aus `animateFloor(now, ...)` geupdatet; der Screen-Shake verschiebt die Kamera statt eines Vollbild-div.
- `floor-cues.ts` pingt mit drei gebackenen Ring-Sprites statt neun Shapes pro Frame. `radial-menu.ts`, `character-view.ts` und `particle-overlay.tsx` sind geloescht.

## [0.3.117] - 2026-11-05

### Spiel
- Jeder Raum ist texturiert: Boden und Waende kacheln, drei Requisiten je Zone (Bar, Kasse, Spielsaal, Lager) stehen fest im Chunk.
- Tageszeit: Morgen, Abend und Nacht faerben das Licht; die Phase kommt aus dem Tick, nie aus der Uhr.

### Technik
- `furniture-atlas.ts` backt einen Korpus je Bauart und Groesse in eine RenderTexture; Instanzen zeichnen nur ein Sprite, LOD-0 dieselbe Silhouette mit alpha 0.85.
- `floor-surface.ts` kachelt Boden und Wandtapete als TilingSprite (tileScale 2) statt als gestrecktes Sprite; `room-art.ts` traegt 2-px-Konturen und 6-px-Schwellen.
- `guest-parts.ts`: Schatten und Kopftexturen einmal gebacken; nur der naechste Gast traegt ein Namensschild.

## [0.3.116] - 2026-11-05

### Technik
- `src/styles/popup.css`: `backdrop-filter: blur(7px)` ist raus; der Backdrop nutzt einen radialen Verlauf ueber einer Alpha-Flaeche und `contain: paint`. Kein Vollbild-Blur mehr, gleiche Abdunklung.
- `reel-roll` animiert nur noch `transform` und `opacity` statt `filter: blur`; die Walzen laufen ohne Filter-Neuberechnung pro Frame.

## [0.3.115] - 2026-11-05

### Spiel
- Aus dem Instrumentenbrett wird eine App: oben stehen nur noch Marke, Tag, Hauskonto und zwei Kennzahlen – Gäste und Ruf. Der Ruf zeigt Farbe und Wort (angesehen, solide, ramponiert) statt einer Prozentzahl.
- Die elf Aktionsknöpfe der HUD-Leiste sind weg. Unten gibt es vier Bereiche: **Bauen · Gäste · Karte · Du**. Putzen erscheint nur noch, wenn es Dreck gibt – mit Anzahl und Preis.
- Alles Technische liegt hinter einer Tür: Charakter, Protokoll, Prüfung, Assets, Sound, Gerät und Hilfe öffnen sich aus „Du“ in der Werkstatt. Die Tasten-Legende (WASD, Enter, Rad) ist aus dem Spielfluss verschwunden, die Tasten wirken weiter.

### Technik
- `src/App.tsx` 348 → 203 Zeilen: Popup-Routing nach `src/ui/popup-router.tsx`, Tastenpfad nach `src/ui/use-stage-keys.ts`, neue `src/ui/dock.tsx` und `src/ui/workshop.tsx`.
- `Popup`-Union verkleinert: `journal`, `diagnostics`, `look`, `assets`, `sound`, `help` werden zu `{ kind: 'workshop'; tool?: WorkshopTool }`. Die Werkstatt reicht die vorhandenen Fenster unverändert weiter.
- `src/ui/hud.tsx` 176 → 113 Zeilen; `src/ui/stage-controls.tsx` trägt nur noch die Kamera-Knöpfe. Keine Spielmechanik, kein Ledger, kein RNG und kein Save-Format angefasst.

## [0.3.114] - 2026-11-04

### Spiel
- Ladebildschirm beim Kaltstart: animierter Fortschrittsbalken mit Text ("Lade Neon-Kasino…", "Baue Floor…", "Bereit.") statt weisser Seite, bis React gemountet hat (`index.html`, `src/main.tsx`).
- Maschinen-Texturen sichtbar: `src/render/furniture-art.ts` Backdrop-Overlay (`textureFor` aus `manifest.json`) liegt jetzt uber dem gezeichneten Korpus, sodass Slot-, Tisch-, Bar- und andere Maschinen-Texturen aus dem Pixel-Paket sichtbar werden (statt nur gefarbter Rechtecke).
- Boden-Texturen sichtbar: `src/render/floor-surface.ts` und `src/render/room-art.ts` legen Boden-Texturen aus `manifest.json` (`casino-carpet-plum.png`, `wallpaper-damask-plum.png`) als Sprite-Backdrop unter die gezeichneten Boden-Muster.
- Gast-Kopf-Texturen sichtbar: `src/render/guest-art.ts` ladet Kopf-Texturen aus `manifest.json` (`characters/head-*.png`) basierend auf dem Gast-Seed und zeigt sie als Sprite statt nur gezeichneter Schaedel-Grafik an.
- Partikel-Events: `src/core/sim/events.ts` (neu, headless Event-Emitter), `src/core/games/slot-session.ts` (`slot:jackpot`, `slot:chargeDischarge`, `slot:chargeReady`, `slot:spin`), `src/core/games/plinko-sandbox.ts` (`plinko:drop`), `src/core/sim/disputes.ts` (`dispute:start`, `dispute:sabotage`), `src/core/sim/money.ts` (`money:bigPayout` ab 10 VC) emittieren visuelle Ereignisse für die UI/Render-Schicht.
- Partikel-Overlay: `src/render/particle-overlay.tsx` (neu) rendert animierte Partikel, Bildschirm-Shake und weisses Flash-Overlay bei Partikel-Events; `src/App.tsx` bindet es ueber dem Floor ein (zIndex 60).
- Bodenhinweise-Feinschliff: `src/render/floor-cues.ts` zeigt Zielraster mit leuchtender Mitte, Spielerring mit ausserem Glow und Klick-Puls mit konzentrischen Ringen.
- Audio-zu-Visual-Kopplung: `particle-overlay.tsx` spielt bei jedem Event den passenden Sound (`playSfx('win')`, `playSfx('coin')`, `playPinRun(...)`, `playSfx('brawl')`) gleichzeitig mit den Partikeln ab.
- `verify:quick` beschleunigt: `src/Config/vite.config.ts` schließt jetzt auch `poker-distribution.test.ts`, `balance-operating.test.ts` und alle `*.bench.ts` Dateien aus dem quick-Profil aus (statistics/performance Beweisklassen laufen nur in CI via `ci:long`). Damit fallen ca. 8 Testdateien aus dem lokalen Quick-Lauf heraus.

## [0.3.113] - 2026-11-04

### Planung
- `docs/PLAN-OPTIK-VISUELL.md` neu: 5-Phasen-Plan fuer visuelle Ueberarbeitung (Eintrag/Ladeerfahrung, Figuren & Boden nutzen vorhandene Textur-Pakete, Partikel & Animationen im Spielfluss, Game Feel & UI-Unterschiedlichkeit, Feinschliff der Bodenhinweise). Keine Code-Aenderung, reine Planung.

## [0.3.111] - 2026-11-04

### Technik
- `settleGuests` zahlt jeden Gast nur einmal: nach erfolgreicher Buchung wird der Gast aus der Liste entfernt, sodass ein Abbruch keine Doppelauszahlung verursacht (`L2`, hoch). Test in `guest-settlement.test.ts`.
- `payAndLeave` laesst einen Gast bei nicht gedeckter Auszahlung den Floor verlassen (`LEAVE`) statt ewig im Zustand `CASHOUT` zu haengen (`L1`, mittel).
- Reiniger loescht unreachable Dreck nicht mehr still, sondern meldet sich als blockiert (`L6`, niedrig).
- ESLint ignoriert `plugins/` (DSH-Host-Plugin, nicht Repo-Quelle).
- `INVENTORY.md` auf aktuellen Code-Stand: Befunde 1, 18, 21, 33, 34 als geloest markiert.


### Spiel
- Wer mit guten Abenden wiederkommt, wird jetzt mit eigenen Worten begruesst - die warme Szene spricht nicht mehr aus dem Basistopf.

### Technik
- Warmer Content-Batch: vier Beitraege (Titel, Text, Choice-Label, Outcome) im neuen `warm`-Kontext; `VISITOR_RETURN_WARM` verlangt ihn pro Slot, sodass die Auswahl deterministisch beim eigenen Textpool landet. Registry auf 61 Fragmente.

## [0.3.109] - 2026-11-04

### Spiel
- Keine sichtbare Aenderung: Die Rivalen-Karten liegen bereit - Haltung, Indizien und laufende Gegenmassnahmen lassen sich jetzt aus dem Anzeigemodell lesen, ohne dass sich an den Regeln etwas aendert.

### Technik
- Phase 5: `narrative/rival-context.ts` leitet Rivalen-Karten rein aus Minds, Indizien und `counteredUntilTick` ab; `NarrativeView` traegt sie, `view.ts` bleibt unter 200 Zeilen, Testdateien unter 240. Registry auf 57 Fragmente.

## [0.3.108] - 2026-11-04

### Spiel
- Keine sichtbare Aenderung: Wer schon gute Abende mit dem Haus verbindet, wird beim Wiederkommen etwas waermer begruesst - eine zweite, kurze Szene neben der gewohnten.

### Technik
- F: Zweite Stufe `visitor-returned-warm` (`VISITOR_RETURNED`-Fact plus GOOD-Erinnerung) mit eigenem Template; Langzeitpfad Kette -> Flag/Beziehung -> spaeteres Warm-Match ohne Campaign-State, nur vorhandene Trigger-/Cooldown-Infrastruktur. Registry auf 56 Fragmente.

## [0.3.107] - 2026-11-04

### Spiel
- Keine sichtbare Aenderung: Wer gern wiederkommt, spielt etwas mutiger und setzt sich eher dazu - wer vergrault wurde, zieht sich zurueck. Harte Regeln (Geld, Platz, kaputte Geraete) gelten fuer alle gleich.

### Technik
- E2: Neue reine Ableitung `narrative/disposition.ts` aus Persona, Erinnerung und Kante (`gameBias`, `serviceBias`, `socialBias`, `returnBias`); sie wirkt begrenzt in `offerScore()`, `chooseActivity()` und `returnChance()`, `memoryEffect()` bleibt duenne Fassade ohne zweite Gedaechtnislogik. E2E-Test mit hoher/niedriger Disposition, Registry auf 55 Fragmente.

## [0.3.106] - 2026-11-04

### Spiel
- Keine sichtbare Aenderung: Wer eine Szene verstreichen laesst, wird dafuer auch weiterhin nicht bestraft - der Abend laeuft einfach weiter.

### Technik
- D3: `EXPIRED` bleibt ein reiner Statuswechsel mit `DEADLINE`; ein neuer Test sichert, dass der Fristablauf weder Flags noch Beziehungen noch Ledger-Zeilen aendert und keinen Fact emittiert. Timeout-Effekte nur als expliziter Template-Vertrag, falls spaeter noetig. Registry auf 54 Fragmente.

## [0.3.105] - 2026-11-04

### Spiel
- Wer einem Rivalen entgegentritt, verschafft dem Haus eine Atempause: Der Rivale bleibt danach 900 Ticks still, statt sofort den naechsten Zug zu planen.

### Technik
- D2: `ChoiceEffect` und `NarrativeCommand` kennen `COUNTER_RIVAL` (Familie `RIVAL`, Ziel `ChoiceActor`); Preflight verlangt einen existierenden `rival:`-Ref (`INVALID_TARGET` sonst), `execute.ts` setzt `counteredUntilTick = max(alt, tick + 900)` als einzigen Schreibpfad.
- `RIVAL_MOVE.CONFRONT_RIVAL` traegt die Wirkung; Tests belegen Stillstand bis zum Tick und Preflight-Ablehnung unbekannter Rivalen. Kein neuer Fact in dieser Phase. Registry auf 53 Fragmente.

## [0.3.104] - 2026-11-04

### Spiel
- Wer einen Rueckkehrer nach seinem letzten Besuch fragt, bekommt jetzt ein Nachspiel: `VISITOR_AFTERMATH` setzt das Gespraech mit denselben Beteiligten fort, statt die Szene kommentarlos zu schliessen.

### Technik
- D1: `VISITOR_RETURN.ASK_ABOUT_LAST_VISIT` traegt `followUpEventId: 'VISITOR_AFTERMATH'`; neues Template (Scope VISITOR, eine Visitor-Rolle, Trigger `chain`) mit `TITLE`, `BODY`, Choice-Label und `OUTCOME`.
- `runtime.ts` loest bei `EVENT_RESOLVED` Vorgaenger, Template und Choice zentral und fail-closed auf und gibt den Folge-Kandidaten mit `chainFromEventId` in die Auswahl; der Scheduler prueft Cooldown, Limits, Kettenherkunft und RESOLVED zentral. Keine Rekursion, kein Duplikat im zweiten Lauf. Registry auf 52 Fragmente.

## [0.3.103] - 2026-11-04

### Spiel
- Keine sichtbare Aenderung: Dieser Slice sichert nur ab, dass jede Szene einen echten Ausloeser hat - kein neuer Fact, kein neuer Trigger ohne Template.

### Technik
- C1: `narrative-trigger-template-contract.test.ts` haelt die Spec-Regel als Vertrag fest - jede Trigger-Definition zeigt auf mindestens ein Template, jedes Fact-Template (ausser Demand) auf genau eine Definition, und `NARRATIVE_FACT_KINDS` bleibt bei den elf bekannten Kinds.
- Geraete-, Lager- und Personal-Facts haben bewusst keine Fact-Kinds und bleiben dokumentiert offen. Content-Beitrag `c1-trigger-template-contract-01`, Registry auf 48 Fragmente.

## [0.3.103] - 2026-11-04

### Spiel
- Die Auswaertsspiele (Blackjack, Roulette, Plinko, Video Poker, Huetchenspiel, Wuerfel) laden Tische und Engines erst beim Oeffnen; der Start laedt statt eines 1,04-MB-Bundles einen 756-kB-Haupt-Chunk.

### Technik
- Chunk-Splitting ueber Rolldowns `codeSplitting`: `vendor-react` wird ein eigener, cachebarer Vendor-Chunk; `GamesPopup` haengt per `React.lazy`/`Suspense` am neuen `src/ui/games-popup-lazy.tsx` und liegt nur noch als dynamischer Chunk im Netz.
- Gemessen mit identischem Build: Initial-JS 1.313.412 B -> 1.246.800 B roh (-5,1 %) und 399.286 B -> 380.841 B gzip (-4,6 %); Haupt-Chunk 1.041.635 B -> 756.241 B (-27,3 %) bzw. 317.733 B -> 228.516 B gzip (-28,1 %).
- Ein `vendor-pixi`-Sammelchunk wurde gebaut und verworfen: er zog Pixis intern dynamische Teile ins Initial-Bundle (1.301.681 B roh / 390.278 B gzip); die Begruendung steht mit Messwerten im Config-Kommentar.

## [0.3.102] - 2026-11-04

### Spiel
- Rivalenhandlungen oeffnen nur noch dann eine Szene, wenn sie Folgen fuer den Abend haben: PROBE bleibt ein stilles Indiz, Sabotage, Informationshandel, Preiskampf und Gaesteabwerbung fuehren zu RIVAL_MOVE.

### Technik
- C2: `TriggerCondition` kennt `{ op: 'rival-action'; actions }`; das Schema verlangt eine nicht-leere, duplikatfreie Liste aus `RIVAL_ACTION_IDS`, der Evaluator matcht nur `RIVAL_ACTION`-Facts mit erlaubter Aktion.
- `EVENT_TRIGGER_DEFINITIONS` bindet `rival-action` an TRADE_INFO, PRICE_MOVE, POACH_VISITOR und SABOTAGE; PROBE bleibt bewusst ohne Event. Tests decken Schema-Grenzen, Evaluator-Filter und den Ende-zu-Ende-Pfad PROBE/SABOTAGE ab. Registry auf 47 Fragmente.

## [0.3.101] - 2026-11-04

### Spiel
- Rueckkehr, Streit, Rivale, Neon-Nacht und Turnierabend haben jetzt eigene Titel, Texte und Choice-Beschriftungen. Ausgaenge bleiben vorerst neutral, bis der naechste Content-Batch sie fuellt.

### Technik
- B4: 16 Beitraege in einem abgestimmten Batch (eigene Turn-ID je Beitrag) fuellen `TITLE`, `BODY` und jedes angebotene Choice-Label aller fuenf Templates; die Slot-Zwecke aus B2 werden hart erfuellt, und kein Fragment traegt widerspruechliche Flags.
- `narrative-coverage.test.ts` setzt jedes Template aus `EVENT_TEMPLATES` zusammen und verlangt fuer alle Nicht-`OUTCOME`-Slots ein echtes Fragment; ein Negativfall belegt, dass fehlender Content weiterhin als Fallback gemeldet wird.
- AGENTS.md praezisiert die Turn-Regel: ein abgestimmter Content-Batch gilt als ein Schritt, jede Turn-ID traegt aber genau einen Beitrag. Registry auf 46 Fragmente.

## [0.3.100] - 2026-11-04

### Spiel
- Fehlt einer Szene ein Text, nennt sie jetzt die betroffenen Stellen (Titel, Begruessung, Ausgang) beim Namen, statt pauschal von "Sicherheitscopy" zu sprechen.

### Technik
- B3: `ComposedNarrative.degraded` folgt `fallbacks.length > 0`; `issues` traegt `Fallback fuer Slots: ...` mit den betroffenen IDs. `NarrativeEventView.fallbackText` weicht `fallbackSlots`; die UI listet die Slots ueber `SLOT_LABEL` oder ihre kanonische ID.
- `view.ts` setzt nur noch dann ohne Persona-Einschraenkung neu zusammen, wenn alle Slots Fallback sind; ein Teil-Ergebnis mit gutem Body bleibt stehen.
- Tests decken Teil- und Voll-Fallback, den fallback-freien Fall, die View-Liste und den UI-Hinweis ab. Content-Beitrag `b3-fallback-slots-01`, Registry auf 30 Fragmente (sha256:8bde0ad5...).

## [0.3.99] - 2026-11-04

### Spiel
- Szenen waehlen ihren Text jetzt nach dem Zweck des Slots: eine Begruessung verlangt `welcome`, eine Frage `ask`, ein Ausgang `aftermath`. Fehlt der passende Text, bleibt der neutrale Fallback statt eines beliebigen Satzes.

### Technik
- `ContentSlot.requiredContexts` (max. 4) validiert als Vokabular-Slugs; die fuenf Templates tragen ihre Slot-Zwecke (`CHOICE_WELCOME`/`CHOICE_ASK`, `DEFUSE`/`ESCALATE`, `CONFRONT`/`WATCH`, `TITLE`/`BODY`, Outcomes mit `aftermath`).
- `ComposeRequest.requiredContexts` und `eventInstanceId`; `selectFragment` prueft Slot- und Request-Kontexte hart, `contexts` bewertet nur Treffer. Gleichstand entscheidet per FNV-1a-Hash aus Szenen-ID und Slot-ID, ohne RNG; ohne Szenen-ID bleibt `contributionId` der Schluessel.
- Vokabular um `welcome`, `ask`, `defuse`, `escalate`, `confront`, `watch`, `aftermath` erweitert (`rival` bestand). Content-Beitrag, Manifest und Registry auf 29 Fragmente.

## [0.3.98] - 2026-11-04

### Spiel
- Die Doku beschreibt Rigged by Design als Lebenssimulation: Du startest mit Startguthaben, keinem Plan und einer Welt voller Moeglichkeiten. Das Casino ist Startpunkt und Testumgebung, nicht das Genre; vor einem Release soll eine bespielbare Stadt entstehen.

### Technik
- `docs/PRODUCT.md` neu als Vision (Titel-Wortspiel, bildhafter Pfad, Engine-Prinzip, MVP-Grenze, Stadt-Horizont, NAR-Social-Plugin, Ledger-Ressourcen).
- README, ROADMAP, ARCHITECTURE, AGENTS, NARRATIVE-ENGINE, ART-DIRECTION, INVENTORY und Asset-Pack eingeordnet; der Save-Stand in der README von v9 auf v10 korrigiert.
- Content-Beitrag `2026-11-04-lebenssim-vision.json`, Manifest und Registry auf 28 Fragmente; Compiler-Test entsprechend.

## [0.3.97] - 2026-11-04

### Technik
- B1: `src/core/sim/narrative/composition-context.ts` leitet den Composer-Kontext rein aus `WorldState`, `Ledger`, Event und Template ab: Kontext aus dem ausloesenden Fact oder dem Template-Fallback, Personas aus den aufgeloesten Visitor-Teilnehmern, Beziehung und Stimmung aus Fact, Erinnerung und gerichteter Kante. `requiredFlags` stammt ausschliesslich aus den Template-Requirements; `view.ts` ruft nur noch diesen Helper auf. Rivale ist als eigener Kontext `rival` im Vokabular. Kein neuer Zustand, keine zweite Kontextdatenbank.

## [0.3.96] - 2026-11-04

### Technik
- A3: `scripts/lib/affected-tests.mjs` erkennt jede JSON-Datei unter `content/narrative/**` ueber `NARRATIVE_DATA_RE`, setzt `codeChanged = true` und waehlt ausschliesslich `src/core/governance/__tests__/narrative-content.test.ts`. Content-Aenderungen laufen damit nicht mehr ins Leere und fallen nicht in den Subsystem-Fallback; ein Governance-Test deckt die exklusive Auswahl ab.

## [0.3.95] - 2026-11-04

### Technik
- A1: Der Pre-Commit-Hook zieht `build-inventory`, `doc-sync --staged`, `verify-docs` und `check-loc` vor den `node_modules`-Fruehausstieg. Diese Schritte lesen nur Dateien und Git und blockieren den Commit jetzt auch in einem frischen Klon. Nur Dependency-Matrix und Testkatalog bleiben hinter dem Ausstieg, weil sie `typescript` aus `node_modules` laden. Ein temporaeres Hook-Repo belegt beide Reihenfolgen und den LOC-Blocks ohne `node_modules`.

## [0.3.94] - 2026-11-04

### Technik
- Governance-Test fuer NAR-09: Eine temporaere Fixture kopiert `content/narrative/**` und schreibt `registry.generated.ts`, `slot-map.generated.ts` sowie `fragments.json` ueber `renderRegistry`/`renderRuntimeRegistry`/`renderSlotMap`. Der gruene Pfad prueft alle Zaehler und den Content-Hash; derselbe Test belegt, dass eine unregistrierte JSON-Datei, ein fehlendes Pflichtfeld trotz Manifest sowie Unterordner, Behelfsdateien (`.txt`, `.md`, `.tmp`, `.bak`) und versteckte Dateien fail-closed mit `ERR-4022` scheitern. Weiterhin eine Testdatei, 224 Zeilen.

## [0.3.93] - 2026-11-04

### Technik
- A3: `.githooks/pre-commit` prueft den Narrative-Content vor dem `node_modules`-Fruehausstieg. Gestagte Narrative-Dateien mit unstaged Aenderungen blockieren mit `ERR-4022`, damit der Validator nie einen anderen Inhalt sieht als den Commit; ein Validatorfehler beendet den Hook mit `ERR-4022`. Kein Vitest, kein `verify:quick`; die restliche Hook-Reihenfolge bleibt.

## [0.3.92] - 2026-11-04

### Technik
- A2: `readContributions()` ist fail-closed. Unterordner, Symlinks, versteckte Namen, `.md`/`.tmp`/`.bak` und JSON-Dateien ausserhalb des Content-Musters werden als `ERR-4022` gemeldet statt ignoriert; nur sichtbare regulaere `<datum>-<turn>.json` werden geparst. Manifest-1:1 und Registry-Hash bleiben die alleinige Vollstaendigkeitspruefung. Ein Governance-Test deckt alle Eintragsarten mit einem temporaeren Inbox-Fixture ab; `docs/NARRATIVE-ENGINE.md` Abschnitt 17 ist nachgezogen.

## [0.3.91] - 2026-11-04

### Technik
- Korrektur der Narrativ-Entscheidungen: Die Disposition wirkt E2E vollstaendig statt nur in `offerScore()`. D4 umfasst jetzt Aktivitaetsschwellen (±8 Punkte), Spielwahl (±20 %) und Rueckkehr (±10 Prozentpunkte); D5 erlaubt die begrenzte Verschiebung der Service-/Sozialschwellen, waehrend kritische Beduerfnisse, Geld, Platz und Geraetezustand vorrangig bleiben. Noch kein Code.

## [0.3.90] - 2026-11-04

### Technik
- `docs/NARRATIVE-ENTSCHEIDUNGEN.md` beantwortet die fuenf offenen Punkte verbindlich: Content-Batch (mehrere Contributions pro Turn), sieben neue Kontexte, `COUNTER_RIVAL` mit Chain-Template statt zweitem Fact, E2 nur in `offerScore()` und unveraenderte Service-Schwellen in `chooseActivity()`. Die Umsetzung steht noch aus.

## [0.3.88] - 2026-11-03

### Technik
- Profilweg und Geschichten-Historie: `buildNarrativeView()` nimmt Gaeste auf dem Floor in die Besucherprofile auf und liefert die juengsten zwoelf abgeschlossenen Szenen als `history` (Status, Ausgang, Teilnehmer, Abschlusstakt). Das Gast-Popup oeffnet ueber `onProfile(visitorId)` direkt das Profil; `NarrativePopup` startet dafuer im Figuren-Tab. Das Journal hat den Tab „Geschichten“ und zeigt dieselbe Ableitung, keine zweite Log-Quelle.
- NAR-17 abgeschlossen: `ARCHITECTURE.md`, `PRODUCT.md`, `AGENTS.md`, `NARRATIVE-ENGINE.md`, `ROADMAP.md` und der Taskplan nennen Save v10 (`vcoin.casino.v10`, Migration v5–v9) und den persistenten Rivalen-Zustand; `TRIGGER_DIALOG` ist als bis zur Dialogfuehrung nicht ausfuehrbar beschrieben. `demandEvent` erscheint nur noch als Migrationsfeld in `SavedGame`/`migrate-narrative.ts`. Testkatalog und Inventur sind regeneriert.
- CI-Eskalation: `src/core/governance/error-codes.ts` traegt pro Code ein Feld `level` (`AUTO_FIX`, `LOCAL_GATE`, `REMOTE_CI`, `AGENT`, `BLOCKED`). `scripts/lib/escalation.mjs` liest die Stufe zuerst aus dem Code, Textmuster bleiben als Fallback.
- ERR-4008 bleibt fuer den Push auf den Arbeitsbranch. Neu: ERR-4023 `DIRECT_PUSH_REJECTED` (abgelehnter Direktpush auf `main`, Stufe AGENT) und ERR-4024 `LOCAL_GATE_RED` (rotes lokales Gate in `turn:finish`, Stufe LOCAL_GATE). Register und `docs/ERROR_CATALOG.md` sind gleich.
- PR-Watcher: Fingerprint aus Code und erster Fehlerzeile des Gate-Logs. Ein bekanntes Issue (offen oder geschlossen) bekommt den Kommentar "Vorgekommen: N mal, zuletzt <Run-Link>" und wird nicht wieder geoeffnet. Die Suche laeuft in einer Hilfsfunktion `findIssue`. Zaehlung nur in CI.
- `.github/workflows/pr-watcher.yml` mit `actions: read`; der Watcher-Commit e7294f4 ist auf den Branch uebernommen.
- AGENTS.md: Direktpush auf `main` ist durch das Ruleset gesperrt. Der Weg ist Arbeitsbranch, PR, Promotion. Die Rootcause-Analyse steht in `docs/GATE-ROOTCAUSE.md`; AGENTS.md verweist nur darauf. Neue Zeile zu Lokal vs. CI.
- Ruleset-Pruefung (Schritt 0) nicht verifiziert: kein authentifizierter Zugriff per `gh`. Das Ergebnis steht im Audit, das Ruleset ist unveraendert.

## [0.3.87] - 2026-11-03

### Technik
- Narrative-Review-Befunde S1 bis S16: Expiry, Demand, Slot-Map, Preflight, Locale, Migration, Duplikat, totale Ausfuehrung, ENGINE_DEMAND, maxOccurrences, legacy-Demand, guard-Flush, degraded, Doku
- NAR-14 abgeschlossen: `narrative/view.ts` leitet aktive Szenen und Besucherprofile rein aus Welt, Ledger und Composer ab (Titel/Text/Choice-Labels aus der Registry, Sperrgruende aus `checkChoiceSelection`); `GameView.narrative` traegt das Ergebnis, `NarrativePopup` zeigt Szenen mit Frist, gesperrten Choices samt Grund, Profilen mit Besuchen, Erinnerungen und Beziehungen. `dismissNarrativeCmd` lehnt eine Szene ueber den Lifecycle ab (`CANCELLED`, Cooldown, Journal-Zeile); `TRIGGER_DIALOG` bleibt bis zur Dialog-UI nicht ausfuehrbar. Keine Trigger-, Effekt- oder Geldlogik in React.
- NAR-13 abgeschlossen: `events/demand-definitions.ts` beschreibt Neon-Nacht und Turnierabend als Daten (Nachfrage pro Tag, Laufzeit, Gruppenzuschlag, Starttext), `narrative/demand-events.ts` startet und beendet sie als aktive GLOBAL-Instanzen der gemeinsamen Event-Engine. `demandBreakdown()`, `groupSize()` und `expectedGroupSize()` lesen nur noch die aktive Instanz; `NarrativeState.demandEvent` ist entfernt.
- v5–v9-Saves mit `demandEvent` (Weltfeld oder Narrativ-Slice) werden beim Laden in eine aktive Instanz mit Restlaufzeit konvertiert; abgelaufene Veranstaltungen verfallen, bestehende Instanzen verhindern Duplikate. Neue Saves enthalten nur noch `narrative.events`.
- `sourceFactId: 0` ist fuer engine-erzeugte Events ohne ausloesenden Fact reserviert. Fuenf neue Tests decken Definitionen, Start/Duplikat, abgeleitete Anzeige und Fristablauf ab; `demand.test.ts` und `narrative-save.test.ts` pruefen die unveraenderte Wirkung und die Migration. Die Content-Registry waechst auf 22 Fragmente.

## [0.3.86] - 2026-11-03

### Technik
- NAR-12 abgeschlossen: `src/core/sim/narrative/runtime.ts` ist der einzige Orchestrator und verarbeitet in fester Reihenfolge Simulation → Facts → Memory/Relationships → Trigger → Scheduler → Events/Choices → Journal/Snapshot. `processNarrativeRuntime()` drainiert den Boundary genau einmal, wertet die deklarativen Trigger aus `events/trigger-definitions.ts` aus und plant ueber `scheduleCandidates()` hoechstens drei neue Event-Instanzen; neue Facts warten auf den naechsten Lauf.
- `tickWorld()` ruft die Runtime am Tick-Ende. `src/store/narrative-commands.ts` liefert `flushNarrativeCmd()` und `chooseNarrativeCmd()`; `world-store.ts` flusht nach jeder erfolgreichen Command-Ausfuehrung sowie nach Neues Spiel, Import und Rivalenspiel, nicht in `#emit()`. `spawn.ts` und `guest-service.ts` drainieren nicht mehr selbst.
- Eine erfolgreiche Choice emittiert den neuen Fact `EVENT_RESOLVED` (`eventId`, `eventKind`, `choiceId`, `outcomeId`); damit ist der Kreis Fact→Event→Choice→Command→Fact auch im Erfolgsfall geschlossen. Der Fact wird erst im naechsten Flush verarbeitet, nie rekursiv. Schema, Save-Roundtrip und die 21. Content-Registry sind nachgezogen.
- Neue Tests: `narrative-runtime.test.ts` (Trigger→Scheduler, Tick-Anbindung, Drei-Event-Grenze, Idempotenz, Save-Roundtrip) und `narrative-commands.test.ts` (Store-Flush, Erfolgs- und Ablehnungspfad, wiederholter Klick). `narrative-save.test.ts` sucht sein `SAVE_EVENT` jetzt ueber die `eventId`, weil der Tick seit NAR-12 seedabhaengig echte Rueckkehrer-Events plant und `events[0]` nicht mehr stabil ist.

## [0.3.85] - 2026-11-03

### Technik

- NAR-11 abgeschlossen: `src/core/sim/narrative/composer/` verbindet Template-Slots mit der validierten Registry. Locale, Kontextschnitt, benoetigte Flags und Persona-Refs filtern fail-closed; der stabile Score entscheidet, Gleichstand nach `contributionId`. Kein Gameplay-PRNG, kein Netzwerk, kein Provider.
- Fehlende Slots erhalten kurze lokale Fallbacks ohne Figuren, Fakten, Choice-IDs, Kosten oder Wirkungen. Ungueltige Fragmente und Direktiven werden gemeldet und uebersprungen; Direktiven werden nur als typisierte ASTs weitergereicht, nie ausgefuehrt.
- Der NAR-10-Compiler erzeugt zusaetzlich `src/core/sim/narrative/composer/registry.generated.ts` als typisierten Core-Spiegel. `--check` und das Assets-Gate vergleichen JSON und TypeScript byte-genau; der NAR-11-Beitrag bringt die Registry auf 20 Fragmente. Neun fokussierte Composer-Tests decken Determinismus, Filter, Fallbacks, ungueltige Daten und Text-/Mechanik-Trennung ab.

## [0.3.84] - 2026-11-03

### Technik

- NAR-10 abgeschlossen: `scripts/lib/narrative-macros.mjs` parst `€...`-Direktiven zu einem begrenzten AST, prueft Command-Allowlist, Argumente, ActorRefs, Flag-Vokabular und doppelte Singleton-Commands. `scripts/lib/narrative-compiler.mjs` erkennt Sprecher-, Persona-, Stimmungs-, Flag- und Command-Konflikte, sortiert Fragmente kanonisch und erzeugt eine Registry mit SHA-256-Inhalts-Hash.
- `scripts/compile-narrative-content.mjs` schreibt nur mit `--write`; Default und `--check` vergleichen die exakten Bytes. `scripts/verify-narrative-content.mjs` ist der lesende Nachweis. Beide laufen ohne neue Abhaengigkeit; das bestehende `verify:assets` ruft denselben Validator auf.
- `content/narrative/registry/fragments.json` ist jetzt Version 2, traegt typisierte AST-Daten statt Roh-Makros und wird aus 19 Beitraegen erzeugt. `classification.json` ergaenzt Persona-Aliase und datengetriebene Konfliktpaare; der neue NAR-10-Beitrag traegt eine validierte `FREEZE_TICK`-Direktive.

## [0.3.83] - 2026-11-03

### Technik

- NAR-09 abgeschlossen: Content-Beitraege tragen jetzt eine kontrollierte Klassifizierung aus Slot, Funktion, Kontexten, Ton, Stimmung, Beziehung und Persona-Bezug; Rollen, Locales und Flags bleiben in `content/narrative/vocabulary/flags.json`, die neuen Dimensionen in `classification.json`.
- `content/narrative/turns/manifest.json` registriert jeden abgeschlossenen Agenten-Turn und ordnet ihm genau einen Beitrag zu. `content/narrative/registry/fragments.json` wird deterministisch aus den validierten Beitraegen erzeugt; `scripts/build-narrative-registry.mjs --write` schreibt sie, der Default ist ein lesender Check.
- `scripts/lib/narrative-content.mjs` prueft Pflichtfelder, IDs, Vokabular, Dateinamen, Manifest und Registry fail-closed und ist in `scripts/verify-assets.mjs` eingehaengt. Neue Verstoesse melden `ERR-4022`; zehn neue Tests decken Schema, Duplikate, fehlende Turns und Registry-Drift ab.

## [0.3.82] - 2026-11-03

### Technik

- NAR-08 abgeschlossen: `narrative/commands/` parst `€...`-Direktiven zu einem begrenzten AST, validiert IDs, Parameter und Teilnehmer gegen eine typisierte Registry und prueft jeden Batch vor der Ausfuehrung vollstaendig.
- `SET_FLAG`, `ADJUST_RELATIONSHIP`, `FREEZE_TICK` und `TRIGGER_DIALOG` sind registriert; nur freigeschaltete Handler laufen. Choice-Effekte und deklarierte Kosten werden hoechstens einmal angewendet, die Event-Instanz wird `RESOLVED`, Wiederholungen und manipulierte IDs werden abgewiesen.
- Abgelehnte Direktiven erzeugen den begrenzten Diagnose-Fact `COMMAND_REJECTED`. Kein `eval`, kein dynamischer Import und keine Funktionsnamen aus Text; die Template-/Choice-Allowlist bleibt die einzige Quelle fuer Spielwirkungen.

## [0.3.81] - 2026-11-03

### Technik

- NAR-07 abgeschlossen: `narrative/events/template-types.ts` und `template-schema.ts` definieren stabile Event-Templates mit Triggerbezug, Rollen, Content-Slots, Prioritaet und deklarativen Choices; `events/definitions/` registriert `VISITOR_RETURN` und `VISITOR_CONFLICT`.
- Jede Choice traegt eine stabile `choiceId`, Requirements, optionale VaCoin-Kosten, eine deklarative Effektliste und ein Ergebnis-/Folgeevent-Mapping. Texte bleiben in Content-Slots und aendern keine Mechanik.
- Event-Instanzen persistieren `templateId`, `templateVersion` und den angebotenen `offeredChoiceIds`-Satz. `choices/contract.ts` weist unbekannte, nicht angebotene oder versionsfremde Choices ab; `choices/eligibility.ts` prueft Lifecycle, Frist, Requirements und Kosten bei jedem Klick erneut, rein und fail-closed.
- Alte Event-Instanzen ohne Template-Metadaten werden auf `eventId`, Version 1 und einen leeren Choice-Satz normalisiert. Die Erweiterung ist additiv in Save v9; neue Tests decken stabile IDs, manipulierte Choices, Text-/Mechanik-Trennung, Kosten, Fristen und den Save-Roundtrip ab.

## [0.3.80] - 2026-11-03

### Technik

- NAR-06 abgeschlossen: `narrative/event-types.ts`, `event-lifecycle.ts`, `event-scheduler.ts`, `event-schema.ts` und `narrative-rng.ts` bilden den persistenten Event-Scheduler. Instanzen tragen Event-ID, Status, Scope, Teilnehmer, Quelle, Prioritaet, Start-/Ablaufzeit, Schritt und Auflösung; maximal 32 Instanzen, 8 live und 64 Cooldowns bleiben erhalten.
- Der Lifecycle `ELIGIBLE → OFFERED/ACTIVE → RESOLVED/EXPIRED/CANCELLED` wird zentral geprueft; terminale Events setzen einen Cooldown je Event-/Teilnehmerkombination. Der Scheduler waehlt nach Prioritaet und Fairness, verhindert Duplikate, begrenzt Arbeit und nutzt fuer Gleichstand einen eigenen persistenten Narrativ-RNG statt des Gameplay-PRNG.
- `processNarrativeBoundary()` raeumt Fristen und verwaiste Visitor-/Personal-Endpunkte auf. Save v9 persistiert Events, Cooldowns und RNG additiv; alte Staende erhalten leere Defaults. `scheduler.ts` ist die Fassade; neue Tests decken Prioritaet, Determinismus, Scopes, Cooldowns, Ablauf, Stale-Cancel, Ketten, Historiengrenze und Save-Roundtrip ab.

## [0.3.79] - 2026-11-02

### Technik

- NAR-05 abgeschlossen: `narrative/trigger-types.ts`, `trigger-context.ts`, `trigger-evaluate.ts` und `trigger-schema.ts` bilden den deklarativen Trigger-Vertrag. Der Context liest Fact-Historie, Flags, Beziehungen, Visitor-Profile, Hauskonto/Band, Charisma, Ruf, Nachfragestufe, bediente Gäste und Geräteschaden; alte `visitorId`-Facts und neue `actorRefs`-Facts werden einheitlich aufgelöst.
- Der reine Evaluator kennt alle vorgesehenen Operatoren für Kombinationen, Facts, Erinnerungen, Hauskonto, Geräte, Charisma, Ruf, Nachfrage, Gäste, Flags, Zeitfenster, Akteure und Beziehungen; er liefert Match, Teilnehmer und Begründungen, ohne Welt, Ledger oder PRNG zu verändern. Das Schema verwirft unbekannte Operatoren, ungültige Refs, Selbstkanten, negative/unsichere Schwellen und leere Listen fail-closed.
- `narrative/triggers.ts` ist jetzt eine Fassade; neun Tests in `narrative-triggers.test.ts` und `narrative-trigger-schema.test.ts` decken Operatoren, Grenzen, Historie, fehlende Referenzen und Unveränderlichkeit ab. Die Tick-Anbindung bleibt NAR-12.

## [0.3.78] - 2026-11-02

### Spiel

- Die Etage liest als Gebaeude: jeder Raum bekommt eine Lichtpfuetze in sechzehn leisen Stufen, Deckenlampen und Wandkanten sind heller, Laufwege bleiben dunkel, sind aber nicht mehr schwarz.
- Der Boden antwortet vor dem Klick: ein Zielraster zeigt die Kachel unter dem Zeiger und wechselt die Farbe (Service = laufen, Casino = im Ueberblick heranziehen).
- Die Figur bleibt auffindbar: ein Ring am Boden, eine Punktspur entlang des Laufwegs, ein kurzer Puls am Klickziel.
- Kamera: rechte oder mittlere Maustaste zieht das Bild, Mausrad und `+`/`-` zoomen, `0` springt zur Uebersicht; beim Laufen im Detail zieht die Kamera nach, sobald die Figur den inneren Rahmen verlaesst.
- Kamera-Knoepfe unten rechts und eine Steuerleiste mit Tastenkuerzeln; im HUD ist das Barkauf-Ziel ein Chip in der RPG-Zeile (mit XP-Balken) statt einer leeren Leiste.
- Die Hilfekarte im Spiel nennt die neuen Griffe: rechte Maustaste ziehen schwenkt, `+`/`-` zoomen, `0` oeffnet die Uebersicht.

### Technik
- `src/render/floor-cues.ts` (neu): Zielraster, Spielerring, Laufwegspur und Klick-Puls als eine Darstellungsebene; liest nur Snapshots und kennt keine Spielregel.
- `floor-camera.ts` um `pan`, `zoomStep` und `keepInView` erweitert; `floor-touch.ts` traegt jetzt Rad, Pinch und Ziehen (der Wheel-Handler ist aus `floor-view.ts` dorthin gezogen, Budget bleibt 349/350).
- `floor-surface.ts`: `drawLightSpill` in sechzehn Stufen, Deckenlampen und Laufweg-Abdunklung nachgezogen; `room-art.ts` hebt die Wandlichtkante; `stage-controls.tsx` (neu) buendelt Steuerleiste und Kamera-Knoepfe; `app.css` bekommt Vignette, Rasterhintergrund, Tastenkuerzel-Chips und Zoom-Leiste.
- Bildsprache dokumentiert: `docs/ART-DIRECTION.md` ("Neon Ledger") und `docs/banners/art-direction-neon-ledger.png` als Blatt.
- Neuer Test `src/render/__tests__/floor-camera.test.ts`: Uebersicht mittig, Schwenk folgt dem Zeiger, Kante haelt, Nachziehen erst am Rahmen, Tasten-Zoom kehrt zurueck.
- Neuer Bildsatz `docs/screenshots/v0.3.78/` (fuenf Bilder, 1280 x 860, Tag 1): Uebersicht, Detail, Bauen, Gaeste, Hilfe. Die Wurzel-README stellt ihn Bild fuer Bild gegen `current/` (v0.3.27); die Ablageregel in `docs/screenshots/README.md` kennt jetzt versionierte Spielsaetze statt nur `current/`.

## [0.3.77] - 2026-11-02

### Technik

- Nachfrageereignis auf Narrative-Zustand vorbereiten: laufende Neon- und Turnierabende liegen jetzt im narrativen Zustand; alte Saves werden beim Laden uebernommen. Auswahl und Ablauf bleiben vorerst in `demand.ts`.
- Narrative-Grundlagen: `ledgerSeq`/`houseBand` und `HOUSE_BALANCE`-Facts leiten Hauskonto-Schwellen aus dem Ledger ab; `processNarrativeBoundary()` ist der einzige Fact-Drain. Gerichtete Beziehungen pinnen ihre Visitor-Profile, sodass die Retention keine laufende Beziehung mehr loescht. NAR-04 ist abgeschlossen: Streit, Kassenbedienung und Rivalenabrechnung erzeugen echte Besucher-Besucher-, Besucher-Personal- und Rivale-Haus-Kanten; die Persistenz ist kanonisch, geklemmt und save-roundtrip-fest.

## [0.3.76] - 2026-11-02

### Technik

- Narrative-Dokumentation nach Merge wiederherstellen: fehlende Eintraege zu Triggern, Save-Facts und offenen Meilensteinen ergaenzt; kein LLM im Spiel.

## [0.3.75] - 2026-11-02

### Technik

- Narrative Trigger Bedingungen: Reiner Evaluator fuer kombinierte Fact-, Erinnerungs-, Kassen-, Geraete-, Spieler-, Flag- und Zeitbedingungen; noch ohne Runtime-Anbindung.
- Narrativ-Grundlagen und LLM-freier Eventplan: Start-Pool wird nicht doppelt gezaehlt; Save-Facts werden bei der Normalisierung nach IDs geordnet und auf Nutzdaten geprueft. Offene Meilensteine und der Ausschluss eines LLM im Spiel stehen im Architekturvertrag.

## [0.3.74] - 2026-11-02

### Spiel

- Keine spielbaren Aenderungen; umgebaut wird der Werkzeugkasten der Agenten.

### Technik
- `pnpm run agent:context` druckt eine feste Beschriftungsspalte mit einer Zeile je Feld (Aenderungen, Systeme, Tests, Gates, Doku, Invarianten, Offen) statt einer unstrukturierten Zeile.
- `pnpm run agent:verify` zeigt eine Gate-Tabelle mit Status und Dauer; `--plan` nennt Plan und Cache-Stand, ohne ein Gate zu starten. Beide bleiben die einzige Analyse- und Pruefstrecke.
- Das Tree-Gate verbietet Wegwerf-Dateien (`tmp-`, `temp-`, `scratch-`, `adhoc-`, `.tmp.`, `.bak`) und meldet sie als `ERR-4019`; die Regel steht in `AGENTS.md`.
- `agent:context --line` und `agent:verify --line` geben eine verdichtete Textzeile aus (Stand, Umfang, Gates). `agent:verify` druckt im Erfolgsfall keine Zeile je Gate mehr, sondern nur die Tabelle.
- Suchwerkzeug: ripgrep liegt global im PATH, `rtk rg`/`rtk ls`/`rtk find`/`rtk read`/`rtk git` sind der Standard; `pnpm run agent:context` ist der primaere Kontextzugang (AGENTS.md, RTK-Block).

## [0.3.73] - 2026-11-02

### Spiel

- Keine spielbaren Aenderungen; der Sprung dient der Release-Konsistenz von `main`.

### Technik
- Peer-Review Phase 6: Tick-Konstante zentral (`TICK_MS = 520`), `spinTest` ruft den Testspin nur einmal, das tote `movement-queue`-Modul ist entfernt, Texte korrigiert ("DER GEBER MISCHT", Mojibake), Asset-Zaehler aus den Daten, `opencode.json` mit relativem Pfad, `encode-audio` verlangt `RBD_AUDIO_SOURCE`.
- Version 0.3.73: `main` trug nach dem Merge von PR #44 weiter 0.3.72, waehrend der Tag `v0.3.72` auf `7b50913` (PR #40) stand und der Release-Lauf nach einem API-Merge als `skipped` endete. Der Patch-Sprung macht den Tip release-faehig, ohne den bestehenden Tag zu verschieben.

## [0.3.71] - 2026-11-01

### Spiel

- README eröffnet die Spielwelt als satirisches Onboarding und markiert Umfang sowie Mechaniken als heutigen Stand; das Startkapital ist auf 150 VC plus Gratis-Automat korrigiert.
- Das gelieferte Pixel-Art-Banner und drei neue SVG-Trenner führen durch Spielwelt, Werkstatt und Roadmap.

### Technik
- Der Tageslohn hängt an einer abgeschlossenen Schicht: `PlayerJobState.lastWorkDay` merkt sich den Tag der letzten Schicht, `payDailyWage` zahlt nur dafür und nie rückwirkend. Wer einen Job annimmt und nichts tut, bekommt weder Geld noch `workDays`-Zuwachs.
- Die Pity-Entladung addiert keinen zweiten Gewinn mehr: `settleSlotSpin` zahlt aus dem Polster, darf es überziehen und holt den Vorschuss aus späteren Gewinnen zurück.
- Wut kommt jetzt aus der Geduld, nicht aus der Laune: `decay` prüft `patience <= 0` vor dem Geduld-Tropfen; die Mods mit Geduldswirkung steuern damit wirklich, wer randaliert.
- Sucht steuert den Einsatz (bis +50 %) und die Sitzungslänge (4 bis 9 Spins): `addictedStake` und `sessionSpins`.
- `PLAYER_CASH` ist auszahlbar: `cashOutPlayerCash` bucht das Bonus-Guthaben ins Portemonnaie.
- Der tote `social`-Bedürfniszweig ist entfernt; `Persona.patience` bleibt, weil sie seit dem letzten Commit gelesen wird.
- Die Persona-Geduld wirkt jetzt: sie geht als Gewicht in den 180-Punkte-Pool von `rollProfile` ein (68 High Roller bis 138 Stammgast), die Summe aus Laune, Geduld und Sucht bleibt exakt 180. Vorher war `Persona.patience` ein totes Feld, und der Stammgast startete wegen seiner hohen Suchtrate sogar ungeduldiger als der High Roller.
- Der Synergie-Audit listet die verbleibenden Lücken in `docs/INVENTORY.md`: `PLAYER_CASH` ohne Ausgabepfad, VELVET und FREE_DRINK ohne ihre beschriebene Wirkung, EXTRA_REEL ohne zusätzliche Walze und ein Einsatz, der nie mit der Persona skaliert.
- Alte Saves ohne `lastWorkDay` laden weiter und starten mit „noch keine Schicht"; vergangene Tage werden nicht nachgezahlt.
- Der rote Pflichtstatus war der PR-getriggerte `CI Verify`-Lauf: er scheiterte am PR-Body-Gate, weil der PR-Body die Pflichtsektionen nicht trug; der Workflow bleibt unveraendert, der Body wird aus dem Commit-Body gehoben.
- Drei Mods sind als offene Design-Entscheidung dokumentiert statt still wirkungslos zu bleiben: `VELVET` (bessere Gaeste), `FREE_DRINK` (Drink pro Spin) und `EXTRA_REEL` (vierte Walze) stehen mit Versprechen, Ist-Zustand und der jeweils noetigen Regelentscheidung in `docs/INVENTORY.md`.

- Der Überfall misst die Wachdeckung jetzt an der Kasse statt am Spieler: `muggingCoverPoint` liefert den Wechseltisch, an dem das Geld liegt; vorher schützte ein Wachmann am Klo die Kasse.
- Die zweite Streitstufe ist erreichbar: `disputeLevelForTicks` kippt nach vier Ticks, vorher nach sechs — ANGRY dauert aber nur fünf, deshalb gab es nie Möbelschaden.
- `guestsServed` zählt nur noch Gäste mit mindestens einem Spin; wer den Floor durchquert, hob bisher Ruf und KASSE-Stufe.
- „JACKPOT!" erscheint erst ab 2,5x; ein Push von 1,0x hieß bisher Jackpot und traf rund jeden fünften Slot-Spin.
- Die Wut klingt nach dem Schlichten ab (`anger` sinkt um 0,5 pro Tick), statt bis zum Abgang das ANGRY-Emoji zu zeigen.
- HUD, Diagnose und Automaten-Popup lesen die Bar-Kapazität aus `barCapacityForLevel`; die UI rechnete 6 + 6 × Level, der Core 12 + 8 × Level.
- Dreck landet wieder auf der Kachel, auf der er entsteht: `dirtyTileIndex` in `emotion.ts` ist das Gegenstueck zu `dirtyNear`; Randale und Streit schrieben bisher `(y+1)*size+x+1` und damit schraeg versetzt daneben.
- Video Poker zahlt den Royal Flush nur noch in einer Farbe und erkennt das Wheel A-2-3-4-5 als Strasse; die interaktive Engine war schon richtig.
- Die Dreckschicht liegt im Szenen-Cache jetzt zwischen Teppich und Moebeln statt als erstes Kind des Moebel-Containers.
- Ein Ueberfall auf das Portemonnaie zaehlt im Wirtschaftsbericht als Verlust; `classify` stieg vorher beim Quellkonto aus, bevor der Ueberfallstopf erreicht war.
- Ein Fehlerregister statt dreier Quellen: `scripts/lib/error-codes.mjs` liest `error-codes.ts`, das Gate-Format prueft nicht mehr das Markdown. `ERR-1001` (Determinismus) ist nachgetragen und wird nicht mehr als `ERR-0000` verschluckt.
- Subsysteme, Ordnerregeln, Katalogsysteme und Impact-Doku stehen einmal in `scripts/lib/subsystems.mjs`; Tree-Gate, Testkatalog, betroffene Tests und `agent:context` lesen daraus.
- Die Eskalationsleiter kommt aus `src/Config/escalation-levels.json`; TypeScript und `scripts/lib/escalation.mjs` teilen sie, ein Test haelt beide deckungsgleich.
- `issues.ts` und `transfer.ts` buchen ihren Fehlercode ueber `ERROR_CODES.TRANSFER_INVALID` statt als Literal.

- README ergänzt aktuellen Screenshot- und Versionsvergleich, Developer-Setup, Architekturverträge, Prüfkommandos, Roadmap und FAQ.
- CI-Jobs installieren die festgelegte pnpm-Version, bevor der Package-Cache und die Lockfile-Installation laufen. Der Versionsbump lädt YAML statisch; das Tree-Gate erlaubt JPEG-Belege unter docs.
- pnpm-Overrides für `glob` und `minimatch` stehen im pnpm-spezifischen `pnpm.overrides`-Abschnitt; so werden die gepatchten Transitiven tatsächlich aufgelöst.

## [0.3.70] - 2026-11-01

### Spiel

- Keine sichtbare Aenderung: nur die Pruefkette und ihr Cache.

### Technik
- Paketmanager von npm auf pnpm umgestellt (`packageManager: "pnpm@10.4.1"`); `package-lock.json` entfernt, `pnpm-lock.yaml` trackt die Dependencies. Alle Skripte, GitHub Actions, Pre-Commit-Hook und Pflichtdokumente nutzen `pnpm` statt `npm`; `npm ci` wurde durch `pnpm install --frozen-lockfile` ersetzt.
- `agent:verify` laesst das Testgate nie mehr aus, nur weil der Diff keinen Testbezug hat; ohne Auswahl laeuft die Suite, der Bericht nennt den Grund.
- `turn:finish` setzt die Doku-Marker vor `verify`. Der Pre-Commit-Hook schrieb sie danach und entwertete damit jeden Cache-Schluessel des gerade geprueften Baums; derselbe Baum trifft jetzt beim zweiten Lauf (`0s`, `[cached]` je Gate).

## [0.3.69] - 2026-11-01

### Spiel

- Keine sichtbare Aenderung: Prozess und Nachweise werden zusammengefuehrt.

### Technik
- Neu: `pnpm run agent:context` (ein Aufruf fuer Aenderungen, Systeme, Invarianten, betroffene Tests, Gates und Cache-Stand) und `pnpm run agent:verify` (derselbe Impact-Plan, Gates ueber `runGates`, ein Bericht mit `cached`, `executed`, `skipped` und `delegated`). Beide nutzen `scripts/lib/impact.mjs`, das nur vorhandene Quellen zusammenfuehrt: `changedFiles`, Importgraph, Testkatalog, `pipeline-plan`, `gate-cache`.
- Doppelte Testausfuehrung entfernt: `turn:finish -- --affected` startete `test:affected` und danach `verify:quick`, dessen Testgate die Suite erneut fuhr. Jetzt liefert `--affected` den Kontext; der Testlauf bleibt einmalig in der Pipeline.
- Delegation ist keine Ausgabe mehr: `test:affected` legt lange Nachweise in `.verify-cache/delegated.json` ab und nennt sie offen; `agent:verify --ci` startet `ci:long`, wartet auf den Lauf und uebernimmt das Ergebnis.
- Pre-Commit blockiert, wenn Dependency-Matrix oder Testkatalog nicht geschrieben werden konnten; ein verschluckter Generatorfehler hinterliess bisher ein stilles veraltetes Artefakt.
- Teilpruefung bleibt Teilpruefung: laufen bei `agent:verify` nur betroffene Tests, steht `partial: true` im Bericht und das Testgate wird nicht gecacht.

## [0.3.68] - 2026-11-01

### Spiel

- Keine sichtbare Aenderung: die Konfiguration liegt nur noch an einer Stelle.

### Technik
- `src/Config/capacitor.config.json` ist wieder versioniert: die Ignore-Regel griff ungeankert und schloss die Quelle mit ein. `.gitignore` ignoriert nur noch die Laufzeit-Kopie in der Wurzel (`/capacitor.config.json`); `prepare-android` legt sie dort an und raeumt sie ab.

## [0.3.67] - 2026-11-01

### Spiel

- Keine sichtbare Aenderung: die Auslieferung wird belastbar, Spiel, Save und Ledger bleiben unberuehrt.

### Technik
- Merge ohne stille Kette: `promote` nutzt `PROMOTE_TOKEN`, wenn gesetzt; sonst stoesst es nach dem Merge `Auto Version & Release` an, weil ein Merge mit `GITHUB_TOKEN` keinen Workflow startet und Tag und APK sonst ausfallen. Der Release prueft den Commit-Text vor dem Tag selbst.
- `integration` ist geschuetzt: `pr-cleanup.yml` und `branch-prune.mjs` loeschen die permanente Branch nicht mehr nach dem Rueckweg nach `main`.
- Urteil statt Rauschen: nur `failure`, `timed_out` und `startup_failure` gelten als rot; ein `cancelled`-Lauf schiebt keinen Zwischenstand auf `integration`. Nur Push-Laeufe promoten, der `pull_request`-Lauf des Merge-Refs ist kein Urteil.
- Kein Merge-Deadlock: `gh pr update-branch` laeuft vor dem Merge, weil der Pflichtstatus unter `strict_required_status_checks_policy` sonst veraltet; der Integrationspfad schleift statt zu rekursieren.
- Loch im PR-Gate geschlossen: ein leerer PR-Body bestand `verify-commit-msg --pr` ohne Fehlschlag; jetzt ist er `ERR-4006`.
- Seedabhaengiger Test korrigiert: `narrative-start-pool` prueft jetzt das neue Profil (eine Visite, kein `START_POOL`-Fact) statt eines Namens. `Rita Kern` ist eine moegliche Zufallskombination aus `src/core/sim/traits.ts` (rund 0,8 % pro Ziehung) und liess den Lauf gelegentlich kippen.
- Werkzeug-Configs liegen gesammelt in `src/Config/`: `tsconfig.json`, `vite.config.ts`, `eslint.config.mjs`, `capacitor.config.json` und `opencode.json` gibt es nur noch dort. Alle Aufrufer zeigen auf den neuen Pfad (`vite`/`vitest` per `--config`, `tsc -p`, `eslint --config`, `hashFiles` im Gate-Cache, Dependency-Matrix, Dead-Code, Tree-Gate); Capacitor bekommt waehrend des APK-Laufs eine Kopie in die Wurzel, die danach wieder verschwindet. `.mailmap` bleibt in der Wurzel, weil Git sie nur dort liest.

## [0.3.66] - 2026-11-01

### Spiel

- Keine sichtbare Aenderung: die Auslieferung wird automatisiert, Spiel, Save und Ledger bleiben unberuehrt.

### Technik
- Neu: `scripts/promote.mjs` und `.github/workflows/promote.yml`. Ein CI-Ergebnis entscheidet: gruen legt den PR an und mergt ihn mit den Pflichtsektionen, rot legt den Stand auf die permanente Branch `integration`, damit dort repariert wird.
- Zwei parallele rote Staende werden komponiert statt verworfen. Die Wahrheit liegt im Branch und im Label `integration/rot`, nicht in der Warteschlange: GitHub haelt pro Concurrency-Gruppe nur einen wartenden Lauf, deshalb arbeitet jeder Lauf den gesamten Rueckstand ab und ist idempotent. Ein Textkonflikt wird mit `integration/konflikt` gelabelt und bleibt beim Agenten; nichts wird erzwungen oder ueberschrieben.
- Eine Identitaet fuer jeden Commit: `scripts/lib/identity.mjs` verdrahtet `Vannon <Schneider.felix1993@gmail.com>` in `turn:finish` und im Promote-Workflow, damit der Committer nicht davon abhaengt, welcher Runner oder welche Sandbox gerade committet. `.mailmap` fuehrt die Werkzeug-Namen der History auf denselben Eigentuemer.
- Merge mit Verified-Badge ist opt-in (`RBD_PROMOTE_AUTO_MERGE=1`): dann mergt GitHub selbst und signiert, kann aber den Commit-Text nicht setzen. Ohne Opt-in mergt der Lauf explizit mit Subject und Body, damit `verify-commit-msg --head` auf `main` gruen bleibt.
- Artefakt-Gate-Test entkoppelt: `gate-runner.test.ts` prueft Logs und Summary mit 60 s Limit statt 10 s. Unter paralleler Gate-Last braucht der Node-Start allein mehrere Sekunden, das Zeitlimit hat die Artefakt-Pruefung verfaelscht (TIMEOUT statt FAIL); die Zusicherungen selbst sind unveraendert.

## [0.3.65] - 2026-11-01

### Spiel

- Keine sichtbare Aenderung: reine Doku-, Ordnungs- und Hygiene-Arbeit. Spielverhalten, Save-Format und Ledger bleiben unberuehrt.

### Technik
- Doku konsolidiert und sortiert: 16 Doku-Dateien liegen flach unter `docs/` und tragen Grossbuchstaben-Namen. `docs/event-narrative-engine-taskplan.md` heisst jetzt `docs/EVENT-NARRATIVE-ENGINE-TASKPLAN.md`, `docs/assets/casino-pixel-asset-pack.md` jetzt `docs/CASINO-PIXEL-ASSET-PACK.md`; der Ordner `docs/assets/` entfaellt.
- Widersprueche beseitigt: ARCHITECTURE, PRODUCT, AGENTS und Inventar nennen dieselbe Gate-Zaehlung (quick 10, full 12 inklusive `assets`, `audit`, `build`) in der echten Reihenfolge; der Save ist ueberall v9 (`vcoin.casino.v9`, Migration v5–v8); die Narrative Engine gilt als Stufe 1 gebaut statt "nicht gebaut"; der Inventar-Kopf steht auf `main`/`c4e6e3b`.
- `docs/ERROR_CATALOG.md` repariert und sortiert: ERR-4013/ERR-4014 waren in einer Tabellenzeile verschmolzen, ERR-5001 stand vor ERR-4019; die Codes laufen jetzt aufsteigend bis ERR-5001.
- Repo-Hygiene: Hooks aktiviert (`core.hooksPath=.githooks`), Wurzel traegt nur `README.md` und `AGENTS.md` als Markdown, `docs/screenshots/README.md` beschreibt wieder den echten Bestand (25 Belege, Save v9).
- Doku-Gate (`ERR-4017`) praezisiert: Dotfiles in der Wurzel sind Arbeitsdateien. `.turn-notes.md` machte `verify:quick` und damit `turn:finish` rot, obwohl das Werkzeug die Datei selbst anlegt; der Scan ueberspringt sie jetzt.

## [0.3.64] - 2026-11-01

### Spiel

- Neue Spiele beginnen mit einem Start-Pool aus drei bekannten Figuren (Rita Kern, Boris Falk, Mira Sol). Stammgaeste erinnern sich an ihre letzten Besuche: ein guter Besuch bringt sie mit besserer Laune und hoeherer Rueckkehrchance zurueck, ein schlechter senkt beides.

### Technik
- Narrative Engine, Stufe 1 (NAR-00 bis NAR-03): Architekturvertrag `docs/NARRATIVE-ENGINE.md`, persistente Narrative-Domaene mit Fact-Queue und idempotenter Verarbeitung, typisierte Facts (Start-Pool, erster Besuch, Rueckkehr, Besuchsende), strukturierte Erinnerungen am Visitor und Save v9 mit Migration aus v5–v8.
- Facts sind vom Journal getrennt; Erinnerungswirkung ist rein deterministisch aus dem Save berechnet (kein PRNG, keine Uhr).
- Import und Export im Pruefungs-Popup: Spielstand als JSON sichern, vor dem Import pruefen und reparierbare Felder automatisch ergaenzen. Blocker verhindern den Import und nennen die Eskalationsstufe.
- `performance.now` ist auf die drei echten Pacing-Dateien verengt (`src/render/floor-view.ts`, `src/render/floor-props.ts`, `src/render/music.ts`); jede vierte Datei unter `src/render/**` ist gesperrt. `Date()` ohne `new` und `performance.timeOrigin` sind jetzt ebenfalls verboten, in `src/render/**` bleiben `Math.random`, `Date.now`, `new Date()` und Krypto rot.
- Determinismus-Sperre fail-closed: Namespace- und `new`-Umwege, Krypto (`getRandomValues`, `randomUUID`), `scripts/**` inklusive Content-Compiler und `eslint-disable` sind technisch blockiert; `src/render/**` darf nur `performance.now` fuer Pacing lesen.
- Event-Engine-Taskplan adversarial gehaertet: 20 Angriffe mit Gegenmassnahmen, Systemmatrix ueber 20 Systeme, korrigierte Reihenfolge (NAR-13 vor NAR-12) und Definition of Done je Task — kein Task gestrichen.
- Determinismus als Regel: `entropySeed()` ist der einzige Entropie-Eingang, der Export stempelt aus der Welt statt aus der Uhr, und ESLint verbietet `Math.random`, `Date.now`, `performance.now` sowie `new Date()` in `src/**` (Ausnahme: Pacing in `src/render/**`).
- Tree-Gate (`ERR-4019`) und Redundanz-Gate (`ERR-4020`) sind Pipeline-Gates; `docs:stub` (`ERR-4021`) legt Pflichteintraege mit Datum und Uhrzeit an.
- `src/index.css` liegt jetzt unter `src/styles/`; `ci-verify` prueft den Commit-Body nur noch auf `main`, Feature-Branches uebernimmt `pr-escalation` (keine Doppelarbeit).

- Globale Eskalations-Leiter `AUTO_FIX -> LOCAL_GATE -> REMOTE_CI -> AGENT -> BLOCKED` in `scripts/lib/escalation.mjs`; `pnpm run escalation:plan` nennt die Stufe zu einem Befund.
- Doc-Gate `verify:docs` mit Pflichtabschnitten, Marker und flachem Wurzelbaum; Pflege im Pre-Commit-Hook, nicht im Gate.
- Commit-Body blockiert nicht mehr: `.githooks/commit-msg` eskaliert, `pr-escalation.yml` hebt den Body in den PR-Body.
- Dependency-Matrix und Testkatalog sind keine Pipeline-Gates mehr; Matrix, Katalog und Doku-Marker schreibt der Pre-Commit-Hook.
- Neue Fehlercodes `ERR-4017` (Doku), `ERR-4018` (Hooks), `ERR-5001` (Import).
- Connector-Eskalation: `node scripts/lift-commit-body.mjs --json` liefert Branch, Basis, Titel, Body-Datei und Body als Plan; Agenten mit GitHub-Connector legen den PR ohne `gh` an. Der Level kommt aus der einen Leiter (`AGENT`).
- Pipeline-Test auf den neuen Gate-Plan gezogen: `docs` ersetzt `deps-matrix`/`catalog`, der Lesende-Vertrag bleibt geprueft.
- Import-Engine modular unter `src/core/io/` (Umschlag, Pruefung, Reparatur) mit `src/store/transfer.ts` als Anbindung.
- `pnpm run inventory:build` schreibt Abschnitt 18 des Inventars: eine Zeile je Pfad aus `git ls-files`, ein Eintrag je Ordner, Text gelesen, Binärsignaturen geprüft.
- `verify:docs` erzwingt die Inventar-Abdeckung mit: fehlende Datei, fehlender Ordner oder falsche Abdeckungszahl machen das Gate rot (`ERR-4017`). Der Pre-Commit-Hook baut die Liste vor dem Marker.
- Inventar-Generator idempotent: der Selbsteintrag von `docs/INVENTORY.md` nennt keine eigene Zeilenzahl mehr; nach einem Rot-Test stellt `inventory:build` den Block byte-identisch wieder her.
- `main` in den Inventar-Branch gemergt: Runtime-Art-Preload und die neuen Renderer-Dateien bleiben erhalten, `./styles/index.css` bleibt der einzige CSS-Einstieg; die Dependency-Matrix erzeugt der Hook neu.
- RNG-Namespaces: `Prng` traegt `gameplay` oder `presentation`; Partikel und Sound nutzen den eigenen Darstellungs-Strom in `src/render/rng.ts`. `tickWorld` und `playRound` weisen fremde Stroeme mit `assertGameplayRng` ab (`ERR-1003` im Test).

