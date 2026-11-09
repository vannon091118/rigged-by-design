# Devtagebuch

<!-- rbd-doc: v0.3.198 | 2026-11-09 18:29 UTC -->

Chronologisch, ehrlich, mit offenen Enden. Jeder Eintrag nennt Datum, Ziel,
Umsetzung, Pruefungen und was bewusst nicht getan wurde.

## 2026-11-09 - P-4: Spieltyp-Spuren im Ledger

**Ziel:** Der Ledger soll den Spieltyp eines Laufs nachvollziehbar mitfuehren, nicht nur Konten und Gruende.

**Befund:** `LedgerEntry` kannte `from/to/amount/reason`, `economyOf` aggregierte global. Der Spieltyp existierte nur am Geraet und im `GameResult`; beim Buchen und beim Save-Replay ging er verloren.

**Umsetzung:** `LedgerEntry.game` als nullable Spieltyp-Spur, gestempelt in `placeBet`/`payOut`, im eigenen Spiel, im fremden Haus und in `foreignRound`; `save.ts` schreibt und replayt das Feld, alte Saves bleiben ohne Spur lesbar. `economyOf().byGame` summiert Einsatz und Auszahlung je Typ, deterministisch sortiert, ohne fremdes Haus als Hausumsatz zu zaehlen.

**Pruefungen:** Typecheck, `verify:light`, `verify:claims`, `narrative:check`, `narrative:blocks`, `verify:test-quality`, `verify:dead-code`, Save-Roundtrip-Test. Mutationsprobe: ohne die Zuweisung `game: gameTag` schlaegt der neue Test fehl.

**Bewusst nicht getan:** Kein Save-Versionssprung (optionales Feld), keine zweite Ledger-Wahrheit und keine UI-Kennzahl in diesem Schnitt.

## 2026-11-09 - APK-Signatur und apksigner-Gate

**Ziel:** Die APK muss auf einem fremden Geraet installierbar sein, nicht nur im Build gruen.

**Befund:** Das Release kam als `app-release-unsigned.apk` heraus (Android lehnt unsignierte Pakete ab), und der Debug-Build signierte mit dem fluechtigen `~/.android/debug.keystore` des Runners - jedes Update scheiterte an einem anderen Zertifikat.

**Umsetzung:** Ein versionierter PKCS12-Entwicklungsschluessel in `src/Config/` fuer Debug, die Produktionssignatur nur aus dem CI-Secret fuer Release; `prepare-android.mjs` haengt die Signierkonfiguration an das generierte Projekt, verlangt `assembleRelease` ohne unsigned-Rest, misst `apksigner verify --print-certs` gegen den gepinnten SHA-256 und prueft Paketname und minSdk mit `aapt2 dump badging`. Der Workflow laedt nur diese Dateien hoch und verweigert ein Release mit unsigniertem Paket.

**Pruefungen:** `pnpm run verify:light`, `pnpm run verify:docs`, `pnpm run verify:claims`, gezielter Test `apk-signing.test.ts`.

**Bewusst nicht getan:** Kein echter Release-Key im Repo (der Debug-Schluessel ist oeffentlich und nur fuer Artefakte gedacht); kein Gradle-/SDK-Lauf lokal, weil Java und Android-SDK hier fehlen - die Verifikation greift beim ersten CI-Build.

## Regeln

- Ein Eintrag pro Arbeitstag oder pro abgeschlossenem Auftrag, neuester oben.
- Pruefungen werden woertlich benannt; "getestet" ohne Kommando ist kein Nachweis.
- Begruendungen gehoeren hierher, nicht in Commit-Titel.
- Offene Punkte werden ausschließlich in `docs/ROADMAP.md` geführt; Offen-Abschnitte in älteren Einträgen sind historische Momentaufnahmen.




## 2026-11-08 - Stadt-Loop im Replay: ein Befund, ein Fix

**Ziel.** Den Stadt-Loop ohne Browser belegen, weil AX-Baum, DOM-Auswertung und
Screenshot im Cloud-Browser jeweils nach 10 bis 15 Sekunden abbrechen - die
Seite laedt (alle Assets 200), die Aufnahme der GPU-Seite aber nicht.

**Befund.** Das Harness spielte Kiez bis Eingeweihter und zeigte 15-mal
denselben Stadt-Text. Ursache im Code, nicht im Content: `runCityAction` baute
den Schluessel aus `action.id`, `visits[location]` und `world.tick`; Besuch und
Tick bleiben waehrend eines Aufenthalts konstant, also las der FNV-Wurf immer
denselben der 52 Bausteine. Der Markt-Zweig zeigte dasselbe Bild.

**Fix.** Der Schluessel traegt jetzt den erreichten Fortschritt
(`action|location|points`). Damit wechselt der Text mit jeder Handlung, bleibt
aber deterministisch: derselbe Stand liest denselben Satz.

**Pruefungen.** `city-loop-walkthrough.test.ts` (Kiez 15, Markt 12, zwei Tage
Abschluss, mindestens acht verschiedene Texte) gruen; `narrative:blocks`,
`narrative:check`, `typecheck` und `verify:light` gruen.

## 2026-11-08 - Stadt-Vertikalschnitt landet: Integration statt Neubau

**Ziel.** PR #264 (Kiez und Markt) so auf `main` bringen, dass der Cleanup-Stand
(Ruf-Kopplung, Gaststimmen, Register) nicht verloren geht und kein Gate
abgeschwaecht wird.

**Befund.** `main` war weiter als der PR: #265 (Claims), #266 (roter Lauf) und
#267 (Luecken-Regel) lagen bereits auf `main`, waehrend der PR auf 9a1a1ff
basierte. Die Doku-Konflikte waren deshalb fast vollstaendig "PR ist aelter";
der PR trug in `docs/` nur Marker und Inventur-Zahlen, keine eigene Aussage.
Die Luecken-Regel, die diese Lane als P-1 (freeze-pflichtig) gefuehrt hatte,
war mit #267 bereits wie vorgeschlagen repariert: offene Pools zuerst, danach
Wachstum, Schrumpf verboten.

**Umsetzung.** Merge in dieser Reihenfolge: `main` 6d14524, PR-Kopf b30f0bc,
Cleanup-Kopf 9b7b104. Doku: der neuere `main`-Stand gewinnt, Marker und Inventur
danach neu erzeugt. Content: `manifest.json` als Vereinigung nach `turnId`
(520 + 566 zu 670), `classification.json` als Vereinigung je Schluessel
(`city-scene`, `city-night`, `guest-voice-*`), Registry und Laufzeit-Spiegel per
`narrative:compile` neu geschrieben.

**Pruefungen.** `narrative:compile` (670 Fragmente,
sha256:e89cbc97...), `narrative:blocks` PASS (13 Pools, Minimum 50),
`narrative:check` PASS, `typecheck` 0, `verify:light` PASS (Lint, LOC,
Typecheck, Doku, Tree, Redundanz), 32 fokussierte Tests gruen - darunter die
vier Stadt-Tests (Energie und Tag, Markt-Sperre und -Freischaltung, beide
Zweige, deterministischer Text).

**Bewusst nicht getan.** Kein Gate abgeschaltet, kein Test abgeschwaecht, kein
Force-Merge. Die Reihenfolge "Content erst nach dem Merge" wurde verworfen,
weil sonst der PR-Kopf nie gruen geworden waere.

## 2026-11-08 - Sechs Systeme verdrahtet, Textbausteine als Struktur

**Ziel.** Die sechs genannten Systeme nicht nur auflisten, sondern ihre Datenstroeme
pruefen und die fehlende Kante schliessen; die Textbausteine von einer Zahl zu einer
Struktur machen, die 1500 erreichen kann, ohne sich zu wiederholen.

**Befund am Code.** Zwei der drei genannten Verdachtsfaelle tragen bereits:
Das Floor-Layout steckt ueber `world.layout` in `navGrid` (Wandkanten) und damit in
`pathTo`; der Ledger steckt ueber `ledgerSeq` und Bandwechsel in `ledger-facts.ts`.
Die fehlende Kante war der Ruf: `offerScore` und `personaStake` lasen
`world.reputation` nicht. Ausserdem hatte das Slot-Gedaechtnis (Drucklader) keinen
Textpfad - es wirkt nur ueber die Auszahlung in den Ledger.

**Umsetzung.** `stakeConfidence` verschiebt den Einsatz um ±20 %, hart begrenzt
durch Dreifach-Deckel und Chipbestand. Drei neue Text-Pools tragen die Gastsprache
je Rufband; `guest-voice.ts` waehlt per FNV-Hash aus Gast und Band, ohne RNG, und
haengt den Satz an den mechanischen Intent. Die Roadmap hat jetzt ein Register
statt vier Offen-Listen.

**Pruefungen.** `pnpm run narrative:compile` (566 Fragmente, Hash
`sha256:aaf83d15...`), `pnpm run narrative:blocks` (PASS, Minimum 50 je Pool),
`pnpm run typecheck` (0), `vitest` fuer `guest-voice`, `reputation-slot-use`,
`addiction-stake`, `guest-flow`, `progression`. Der bestehende Einsatz-Test wurde
auf Ruf 50 neutralisiert, damit er weiter Persona-Budget prueft und nicht die neue
Ruf-Achse.

**Offen.** Die Luecken-Regel des Gates sperrt Pools ab 50 (P-1, freeze-pflichtig).
Der Stadt-Loop (Kiez, Markt, zwei Tageszweige) existiert nicht und ist P-2; die
Browser-Abnahme des Casino-Loops ersetzt sie nicht.

## 2026-11-07 - Textbaustein-Pools als Pflichtregel

**Ziel.** Die Textbausteine von einem Nebenprodukt zu einer geprueften Regel machen: Mindestgroesse je Pool, Fortschritt zum Ziel 1500, und jeder Commit muss einen neuen, verdrahteten Baustein liefern, der eine Luecke schliesst.

**Umsetzung.** `scripts/lib/narrative-blocks.mjs` traegt die Regel als reine Logik: Mindestgroesse 50 je Slot, Gesamtziel 1500, Duplikaterkennung ueber normalisierten Text und die Luecken-Regel (neue Beitraege nur in Pools unter der Mindestgroesse). `scripts/verify-narrative-blocks.mjs` liest die echte Content-Kette, prueft Manifest- und Registry-Verdrahtung und laeuft mit `--commit` im Pre-Commit-Hook. Das Assets-Gate ruft dieselbe Regel in CI auf; es gibt kein neues Gate und keine zweite Content-Wahrheit. Der Content-Batch fuellt alle acht Slots auf je 50 Fragmente (400 gesamt); der Laufzeit-Spiegel rendert vier Fragmente je Zeile, damit die generierte Datei unter dem Engine-Cap bleibt.

**Pruefungen.** `node scripts/verify-narrative-content.mjs` PASS (400 Beitraege, 400 Turns, 400 Fragmente); `node scripts/verify-narrative-blocks.mjs` PASS (alle Pools 50); `node scripts/check-loc.mjs` PASS (`registry.generated.ts` 105/200 LOC).

**Offen.** 400 von 1500 Bausteinen; die naechsten Batches muessen die Kontextabdeckung je Pool vertiefen, nicht nur die Zahl erhoehen. Offene Spiel- und Governance-Punkte stehen kategorisiert in `docs/ROADMAP.md`.

## 2026-11-07 - Mehrbeatige Events aus #243 gerettet

**Ziel.** Die mehrbeatigen Narrative-Events aus dem konfliktbehafteten PR #243 auf dem aktuellen `main` retten, ohne den alten Branch zu rebasen und ohne Inhaltsarbeit zu überschreiben.

**Umsetzung.** `EventChoice` traegt optional `nextStep`. `executeChoice` ruft nach der Aktivierung `advanceEventStep` und laesst die Instanz live; der vorhandene Snapshot deckt den Rollback. Das Schema prueft erreichbare Ziele, `choices/steps.ts` filtert das persistierte Angebot pro Beat, `view.ts` zeigt nur diesen Satz. Limits: 24 Content-Slots, 16 Choices, 16 angebotene Choices; die bestehenden Templates bleiben einstufig. Der Beitrag und die Registry sind deterministisch erzeugt.

**Pruefungen.** `pnpm run typecheck`; `pnpm exec vitest run src/core/sim/__tests__/narrative-multi-beat.test.ts src/core/sim/__tests__/narrative-choice-execution.test.ts src/core/sim/__tests__/narrative-composer.test.ts src/core/sim/__tests__/narrative-coverage.test.ts`; `pnpm run narrative:check`; `pnpm run verify:light`; `pnpm run verify:claims`.

**Offen.** Noch kein mehrbeatiger Content-Batch: die bestehenden Templates bleiben einstufig, ein 3x3-Template ist mit den neuen Limits moeglich. Die Outcome-Luecken bei `VISITOR_CONFLICT` und `RIVAL_MOVE` bleiben offen.

## 2026-11-07 - WIP-Konsolidierung vor dem Branch-Abbau

**Ziel.** Die uncommittete Arbeit aus dem alten Interaktions-Worktree auf den aktuellen `main` bringen, ohne die bereits gemergte Rita-Eröffnung zu überschreiben, und die dabei offenen Claims bereinigen.

**Umsetzung.** Der Diff wurde auf einem frischen Governance-Branch von `c7ca328` angewendet. Enthalten sind die Floor-Kistenbedienung über `useCrateActions`, die reine Kistenanzeige im Betriebspanel, die Einsatzobergrenze `MAX_OWN_BET_MULTIPLE`, die Slot-Deckung an der tatsächlichen Auszahlung, die direkte Rivalen-Auswahl und die Bezeichnung `BETREIBER`. Die drei alten Claims `lane/interaction/opening-rita`, `lane/content/narrative` und `lane/governance/ci-stabilization` stehen jetzt auf `merged` beziehungsweise `archived`; der neue Claim `lane/governance/main-consolidation` deckt nur diesen Lauf. #246 wurde als ersetzt geschlossen, weil sein Merge-Notes-Fix mit `c7ca328` bereits auf `main` liegt.

**Pruefungen.** `pnpm exec vitest run src/core/sim/__tests__/own-play.test.ts src/core/games/__tests__/slot-session-rtp.test.ts src/ui/__tests__/perspective-switch.test.tsx` -> 3 Dateien, 25/25 PASS. `pnpm run typecheck` -> PASS. `pnpm run verify:light` und `pnpm run verify:claims` folgen im selben Lauf.

**Offen.** Der PR- und CI-Nachweis auf dem exakten Kopf steht aus. #243 wird nach diesem Merge auf einem neuen Branch von `main` gerettet; erst danach werden die Branch-Tips als Tags gesichert und die Remote-Branches bis auf `main` entfernt.

## 2026-11-07 - Phase 5: Doku-Vertrag und AGENTS-Kurzvertrag

**Ziel.** `AGENTS.md` auf einen Einstieg kürzen, Tiefenwissen in eigenständige Referenzdokumente auslagern und den Doku-Drift bei Gates, Save-Version, Workflows und Branch-Schutz beseitigen. Die Governance-Testmatrix 1–17 und die Zusatzregressionen sollten belegbar werden, ohne die Gate-Liste an zwei Stellen zu führen.

**Umsetzung.** `AGENTS.md` trägt jetzt den ersten Befehl, zehn unverhandelbare Regeln, Zustand, Befehle und eine Referenztabelle. Neu sind `docs/WORKFLOW.md`, `docs/CI.md`, `docs/GOVERNANCE.md`, `docs/TESTING.md`, `docs/INDEX.md` und `docs/contracts/README.md`; `scripts/lib/doc-sync.mjs` führt zwölf Pflichtdokumente mit Marker und Abschnitten. Die Doku nennt 12 Required-Gates plus optionales Audit, elf Gates im schnellen Plan inklusive `capabilities`, Save v11, neun Workflow-Dateien, den klassischen Branch-Schutz mit `strict: false` und ohne Ruleset sowie den deaktivierten `promote`-Pfad mit manuellem Merge. Der historische `pnpm-cutover-plan` wurde gelöscht. `destructive-commands.test.ts` scannt Produktionsskripte statisch gegen `reset --hard`, `clean -fd`, Stash-Mutation, Force-Push und `branch -D`; der letzte `reset --hard` in `promote.mjs` ist entfernt. Dependabot-Branches erhalten über `botClaim()` eine eng begrenzte Allowlist für `package.json`, `pnpm-lock.yaml` und `.github/workflows/`.

Der nach #242 offene Content-Claim war stale: Sein Branch ist geloescht, der PR gemergt. Die Claim-Evidenz belegt diesen Fall ueber den Merge-Commit auf `main`; der CI-Adapter materialisiert fuer die alte Kontrollebene nur den Status, die Content-Allowlist bleibt unveraendert.

**Pruefungen.** Governance-Matrix mit 14 Dateien: 117/117 Tests PASS. `pnpm run verify:test-quality` PASS (195 Testdateien, 565 Dateien). `pnpm run verify:docs` PASS nach `docs:sync` (12 Marker). `node scripts/build-inventory.mjs` meldet 1396/1396 Dateien und 93 Ordner. `pnpm run verify:light` PASS mit sechs Gates (docs, check:loc, redundancy, tree, typecheck, lint). `node --check` für die fünf geänderten Skripte: syntax=ok.

**Offen.** Der PR- und CI-Nachweis auf dem exakten Kopf steht aus; ohne ausdrücklichen Auftrag wurde nichts committet oder gepusht. `docs/RUNBOOK-AUTO-RESOLVE.md` bleibt als Arbeitsdatei ungetrackt und wird erst mit dem Commit Teil der Inventur.

## 2026-11-07 - Entwicklungsbereitschaft: PR-Suite und Reparaturbeleg

**Ziel.** Zwei verbleibende Luecken vor dem Governance-Freeze schliessen: Ein PR mit Profil `all` und `impact=1` durfte die schnelle Regression unbemerkt auf eine Teilmenge reduzieren; der Issue-Sweep schloss einen Befund allein, weil sein Commit ein Vorfahr des gruenen `main` war.

**Umsetzung.** `ci-verify.yml` setzt `full_tests=1` fuer PRs und `main`; `ci-plan.mjs` behandelt das Profil `all` fail-closed, laesst leere, unbekannte und Dependency-Diffs die volle Suite fahren und nimmt reine Doku weiterhin aus. `sweepGreenMain()` verlangt jetzt den urspruenglichen Fingerprint, eine explizite `<!-- repair: <sha> -->`-Marke und die Reparatur-SHA auf dem exakt geprueften `main`; `recordRecurrence()` oeffnet ein geschlossenes Issue bei erneutem Fehler wieder. Pretask und Doku wurden an den tatsaechlichen Lane-/Archivstand angepasst.

**Pruefungen.** `pnpm exec vitest run src/core/governance/__tests__/ci-plan.test.ts src/core/governance/__tests__/ci-gates.test.ts src/core/governance/__tests__/pr-watcher.test.ts --reporter=dot` -> 3 Dateien, 19/19 PASS, 1,75 s. `node --check` fuer `ci-plan.mjs` und `pr-watcher.mjs` -> syntax=ok. Die vollstaendige lokale und CI-Abnahme steht im PR-Lauf.

**Offen.** Der neue PR- und Main-Lauf muessen den Slice auf `main` belegen; danach bleibt die Governance eingefroren. `CI-Self-Repair` und der Doku-Reconcile-Runner bleiben PARKED, weil sie keinen konkreten Defekt beheben.

## 2026-11-07 - Balance-Langlauf aktiviert

**Ziel.** Der Main-Lauf `42376173298` hat den ersten echten Langlauf nach der neuen Skip-Sperre rot gemeldet: `balance-operating.test.ts` wurde ohne `RBD_BALANCE=1` uebersprungen, und `RBD_REQUIRE_TESTS=1` hat den Skip korrekt als fehlenden Nachweis behandelt. Der Test selbst war nicht rot; der Workflow hat seinen Aktivierungsschalter nicht gesetzt.

**Umsetzung.** Der Long-Job setzt jetzt `RBD_BALANCE=1` neben `RBD_NARRATIVE_LONGRUN=1` und `RBD_SOAK=1`. `workflow-hardening.test.ts` prueft den Schalter strukturell, damit ein spaeterer Umbau ihn nicht wieder verliert. Kein Spielcode und keine Testlogik wurde geaendert.

**Pruefungen.** `pnpm exec vitest run src/core/governance/__tests__/workflow-hardening.test.ts` -> 10/10 PASS. `RBD_TEST_FILES=src/core/sim/__tests__/balance-operating.test.ts RBD_REQUIRE_TESTS=1 RBD_BALANCE=1 node scripts/run-selected-tests.mjs` -> 1/1 PASS, 40 Tage, Seed 12345, 17,3 s. `pnpm run verify:claims` -> PASS.

**Offen.** Der Folge-PR und der neue Main-Lauf muessen den Fix auf `main` belegen; danach Claim 22 nachziehen und Issue #196 aktualisieren.

## 2026-11-07 - Finaler Governance-Abschluss

**Ziel.** Die letzten entwicklungsrelevanten Workflow-Luecken schliessen und die Governance danach einfrieren: kein Bootstrap-Fallback, keine ungeschuetzte Langlauf-Steuerung, kein geteilter Lane-Arbeitsbaum und keine ungepflegten Action-Pins.

**Umsetzung.** `ci-verify.yml` holt die Kontrollebene fuer PRs aus der PR-Basis, fuer `main` aus dem gepushten Commit und fuer Feature-Pushes aus `main`; eine Basis ohne `RBD_ROOT` bricht ab. Der Long-Job nutzt denselben Kontroll-Checkout und startet `run-selected-tests.mjs` aus der Basis, waehrend die Testdateien aus dem PR-Baum kommen. `RBD_REQUIRE_TESTS=1` verhindert, dass ein uebersprungener Langlauf als PASS zaehlt. `ci:long` validiert Ticks und Balance-Tage vor dem Dispatch, `soak.test.ts` begrenzt dieselben Werte erneut, und `.github/dependabot.yml` pflegt die SHA-Pins. `pretask` liefert jetzt HEAD, Basis, Worktree, Staging-/Untracked-Status und Claim; `isolationRequired()` verlangt fuer jeden Nicht-`main`-Branch einen verknuepften Worktree. Der Issue-Status bleibt ohne `gh` als `unknown` sichtbar. Die bereits gemergte Trust-Boundary #221 und die Langlauf-/Pretask-Arbeit aus #234 bleiben unveraendert die Grundlage.

**Pruefungen.** `pnpm exec vitest run ... workflow-hardening.test.ts worktree-isolation.test.ts pretask.test.ts` -> 3 Dateien, 22/22 Tests; `pnpm run typecheck` -> PASS; `RBD_TEST_FILES=src/core/sim/__tests__/soak.test.ts RBD_REQUIRE_TESTS=1 node scripts/run-selected-tests.mjs` ohne `RBD_SOAK` -> Exit 1 (zwei Tests uebersprungen, kein PASS); derselbe Runner mit einer ausgewaehlten schnellen Testdatei -> Exit 0; `node --check` fuer die vier geaenderten Skripte -> syntax=ok.

**Offen.** Der PR-Lauf und der Main-Lauf auf dem Merge-Commit sind die verbleibenden Remote-Nachweise; Issue #196 wird nach belegtem P0-Abschluss aktualisiert und geschlossen. SemVer-Automatik, Doku-Reconcile und zusaetzliche Issue-Intelligenz bleiben PARKED.

## 2026-11-07 - Langlauf und Pretask erzwungen

**Ziel.** Zwei Zusagen aus dem Umbauplan waren auf `main` noch nicht belegt: `ci:long` defaultete auf `main`, `agent:verify --ci` startete keinen Lauf, und `pretask` meldete Issue-, Dirty- und Kontextbefunde nur als Notizen.

**Umsetzung.** `ci-long-checks.mjs` leitet Branch und exakte SHA aus dem aktuellen Stand ab, übergibt `sha` an `long-checks.yml` und pinnt jeden Checkout auf diese SHA; `--verify` bleibt die einzige Volllauf-Ausnahme. `agent:verify --ci` ruft den Langlauf mit `--no-verify` auf und wertet einen roten Lauf als rotes Verify-Ergebnis. `pretask` blockt offene `gate-failure`-Issues, schmutzige Bäume, fehlenden `agent:context`-Plan und Claim-Kollisionen mit `ERR-4019`; fehlendes `gh` wird als offener Prüfpunkt genannt, nicht als stiller Erfolg.

**Pruefungen.** `pnpm exec vitest run src/core/governance/__tests__/workflow-hardening.test.ts src/core/governance/__tests__/worktree-isolation.test.ts src/core/governance/__tests__/pretask.test.ts --reporter=verbose` -> 3 Dateien, 17/17 Tests; `node scripts/ci-long-checks.mjs --plan --ref lane/test/plan` -> `verify:false`, exakte SHA; `node --check` für die drei Skripte -> syntax=ok.

**Offen.** Der echte Langlauf und der Main-Lauf auf dem Merge-Commit werden im Abschluss geprüft.

## 2026-11-07 - Claim 20 nach dem Merge geschlossen

**Ziel.** Nach dem Squash-Merge von #232 darf Claim 20 nicht offen auf bereits gemergter Arbeit stehen bleiben.

**Umsetzung.** `lane/governance/20-dev-profile` steht auf `merged` mit `mergedEvidence: branch-tree-on-main` und `mergedSha: b308fed`; der Feature-Merge `b308fed` traegt denselben Baum wie der geprüfte Lane-Kopf `6792545`. Version `0.3.177` und Pflichtdoku halten den Nachweis fest.

**Pruefungen.** `pnpm run verify:claims` -> PASS; `pnpm run verify:light` -> PASS; `pnpm run verify:docs` -> PASS.

**Offen.** Main-CI auf `b308fed` wird im Abschluss geprueft.

## 2026-11-07 - dev-Profil als lokaler Abschluss

**Ziel.** Der Audit verlangte ein lokales Profil, das Strukturpruefungen und betroffene schnelle Tests in einem Lauf verbindet, ohne die schwere Suite lokal zu starten.

**Umsetzung.** `pipeline-plan.mjs` kennt jetzt `dev` als eigenes Profil: dieselben Light-Gates wie `light`, plus das Gate `affected` auf `scripts/test-affected.mjs`. `agent:verify --profile=dev` und `run-pipeline --profile=dev` benutzen damit denselben Plan; `verify:dev` ist der kurze Aufruf. Der Agent-Bericht ist als Teilpruefung markiert und nennt die ausgewaehlten schnellen Tests sowie die an den CI-Plan delegierten langen Nachweise. `verify:light` bleibt der reine Struktur-Turn, `full`/`release` bleiben der Vollnachweis.

**Pruefungen.** `pnpm exec vitest run src/core/governance/__tests__/pipeline-modes.test.ts` -> 6/6 Tests; `pnpm run verify:dev` -> 7/7 Gates, 181 Testdateien/1000 Tests (999 gruen, 1 bewusst uebersprungen); `pnpm run agent:verify --profile=dev --json` -> `partial: true`, 7 lange Nachweise an den CI-Plan delegiert; `pnpm run verify:test-quality`, `pnpm run verify:claims` und `pnpm run verify:docs` -> PASS.

**Offen.** Der erste echte PR-Lauf muss das `dev`-Profil nicht ausfuehren; der Nachweis ist lokal und ueber die fokussierten Profiltests erbracht.

## 2026-11-07 - Lokale Tests, lange Nachweise und Main-Regression verbunden

**Ziel.** Der Audit hatte vier Luecken benannt: `turn:finish` prueft standardmaessig keine Tests, lange Nachweise bleiben manuell, `narrative-longrun` wird als schneller Test katalogisiert, und `pretask` fuehrt Issue-Check und Arbeitsbrief nicht selbst aus.

**Umsetzung.** `turn-push.mjs` fuehrt vor dem Versions-Bump `test:affected` aus und nennt die langen Nachweise als offen; `--no-affected` ist der ausdrueckliche Ausstieg fuer reine Doku. `test-catalog.mjs` liest eine deklarierte `@proof-class` aus dem Kopfkommentar; der Narrative-Langlauf traegt `statistics`. `ci-plan.mjs` exportiert `long_count`, `long_matrix` und `long_tests`; `ci-verify.yml` startet daraus einen eigenen Matrix-Job auf dem PR-Kopf und fuehrt ihn im Pflichtstatus. Auf `main` bleibt die Gate-Auswahl impact-basiert, aber Runtime-/Testaenderungen erhalten die volle Suite. `long-checks.yml` hat einen woechentlichen Lauf; `ci:long` fordert `verify:all` nur noch mit `--verify` an. `agent:verify --ci` dispatcht nicht mehr auf `main`, sondern markiert die Nachweise als an den PR-Plan delegiert. `pretask.mjs` ruft `gh issue list` auf, gibt den Impact-Kontext aus und blockt einen fehlenden Claim mit `ERR-4019`.

**Pruefungen.** `pnpm exec vitest run src/core/governance/__tests__/ci-plan.test.ts src/core/governance/__tests__/test-catalog.test.ts src/core/governance/__tests__/affected-tests.test.ts src/core/governance/__tests__/ci-gates.test.ts src/core/governance/__tests__/workflow-hardening.test.ts --reporter=verbose` -> 5 Dateien, 28/28 Tests; `pnpm run typecheck` gruen; `node --check` fuer die geaenderten Skripte; beide Workflows parsen als YAML.

**Offen.** Der erste echte PR-Lauf muss den neuen Long-Job mit einem tatsaechlich betroffenen Nachweis zeigen; der lokale Rechner kann nur Matrix-Struktur und Auswahl belegen. Die woechentliche Schedule-Ausfuehrung ist nach dem Merge am ersten Montag zu beobachten.

## 2026-11-07 - Claim 27 nach dem Squash-Merge geschlossen

**Ziel.** Claim 27 stand nach dem Squash-Merge von #228 noch auf `open`; ein offener Claim auf bereits gemergter Arbeit wuerde fremde Lanes blockieren.

**Umsetzung.** `reconcile-claims --apply` schreibt Claim 27 (`lane/governance/18-watcher-promote-tests`) ueber den baumgleichen Merge-Commit `cf76ea1` auf `merged` (`mergedEvidence: branch-tree-on-main`, `mergedSha: cf76ea1`). Der getestete Head `41fcada` und der Merge teilen den Baum `7997502`. Kein Code und keine Tests geaendert; nur Register, Version und Pflichtdoku.

**Pruefungen.** `reconcile-claims` meldet genau eine Aenderung; der zweite Lauf muss `keine Abweichung` melden. `pnpm run verify:claims` ist gruen. `CI Verify` auf `main` fuer `cf76ea1` ist erfolgreich (Run 42368226268).

**Offen.** Keine offenen Punkte aus diesem Claim; die Roadmap bleibt unveraendert.

## 2026-11-07 - Issue-Reopen, Sweep-SHA und Promote-Ziel mit Tests belegt

**Ziel.** Die drei im letzten Slice behaupteten Verhaltensaenderungen sollten auf dem gemergten `main` nicht nur dokumentiert, sondern ausfuehrbar belegt werden: Issue-Reopen bei Rekurrenz, Sweep nur am exakten Main-SHA und Promote nur gegen `main` beziehungsweise aus einem PR-Lauf.

**Umsetzung.** `pr-watcher.mjs` nimmt API und Git als Abhaengigkeiten entgegen, exportiert `recordRecurrence()` und `sweepGreenMain()` und fuehrt `main()` nur beim direkten CLI-Aufruf aus. Die neue `pr-watcher.test.ts` prueft die Reihenfolge GET -> PATCH (`state: open`, `state_reason: reopened`) -> Kommentar sowie den verweigerten Sweep bei abweichendem `origin/main`; ein positiver Fall belegt das Schliessen bei exaktem SHA. `promote-guard.mjs` enthaelt jetzt die reine PR-Suche `promotionPrListArgs(head, 'main')` und `manualDispatchAction(mode)`; `promote.mjs` verwendet beide, sodass `--base main` und der manuelle Pfad ohne Merge direkt geprueft werden. Die Claim-Pruefung wurde um den mehrdeutigen Branch-Namen ergaenzt, der ueber `decideClaim()` fail-closed bleibt. Kein Produktionsfehler trat auf; die vorhandenen Implementierungen bestanden die neuen Nachweise.

**Pruefungen.** `pnpm exec vitest run src/core/governance/__tests__/pr-watcher.test.ts src/core/governance/__tests__/promote-guard.test.ts src/core/governance/__tests__/claim-evidence.test.ts --reporter=verbose` -> 3 Dateien, 23/23 Tests. `node --check` fuer `scripts/pr-watcher.mjs`, `scripts/promote.mjs` und `scripts/lib/promote-guard.mjs`; `git diff --check`; `pnpm run verify:light` mit allen sechs Gates; `pnpm run verify:claims` claim-konform.

**Offen.** Der PR-Lauf und die `main`-CI auf dem Merge-Commit sind die verbleibenden Nachweise; der Claim wird nach dem Merge per `reconcile-claims --apply` auf `merged` nachgezogen.

## 2026-11-07 - Claim 26 nach dem Squash-Merge geschlossen

**Ziel.** Der Trust-Hardening-Slice ist auf `main`, aber Claim 26 stand dort noch auf `open`; ein offener Claim auf gemergter Arbeit wuerde fremde Lanes blockieren.

**Umsetzung.** `reconcile-claims --apply` schreibt den Claim ueber den baumgleichen Commit `c43bbc9` auf `merged` (`branch-tree-on-main`). Kein Code geaendert; nur Register, Version und Pflichtdoku.

**Pruefungen.** `reconcile-claims` meldet vor dem Schreiben genau eine Aenderung; der zweite Lauf muss `keine Abweichung` melden. `main`-CI auf `c43bbc9` ist gruen; der getestete Head `cfa404e` und `main` teilen den Baum `d7b64bb`.

## 2026-11-07 - Claim-Identitaet, Promote-Ziel und gruener Main-SHA

**Ziel.** Der Re-Check traf drei verbleibende Vertrauensluecken: Der Merge-Nachweis indizierte nur nach Branch-Namen, die Promote-PR-Suche war nicht auf `main` begrenzt, und der Issue-Sweep schloss anhand von `origin/main` statt des exakt geprueften Main-Commits.

**Umsetzung.** `scripts/lib/claim-evidence.mjs` fragt jetzt `baseRefName`, `headRefOid` und `isCrossRepository` ab, akzeptiert nur `main` aus dem eigenen Repository und vergleicht den PR-Kopf mit dem lokalen Claim-Kopf. Mehrdeutige Branch-Namen werden verworfen; ohne lokalen Kopf bleibt der Claim unbelegt. `reconcile-claims.mjs` und `verify-lane-claims.mjs` reichen den Kopf durch. `promote.mjs` sucht offene PRs nur noch mit `--base main`. `pr-watcher.mjs` oeffnet ein geschlossenes Issue bei erneuter Rekurrenz wieder und bindet den Sweep an `MAIN_SHA`; `origin/main` muss exakt dieser SHA sein, sonst wird nicht geschlossen.

**Pruefungen.** `claim-evidence.test.ts` 11/11 mit exaktem Kopf, falschem Kopf, fehlendem Kopf, Zielbranch `integration`, Fork, Kurz-SHA und zwei PRs mit demselben Branch-Namen; `node --check` fuer alle geaenderten Skripte. Die leichte Linie ist mit allen sechs Gates gruen; der PR-Lauf folgt.

**Offen.** Die Agent-ID-/Worktree-Zuordnung, impact-gesteuerte Langlaeufe und die SemVer-Policy aus dem Diff bleiben in `docs/ROADMAP.md` offen; dieser Slice behauptet keine vollstaendige Isolation.

## 2026-11-07 - Agenten-Isolation und Workflow-Härtung

**Ziel.** Die verbliebenen Vertrauensluecken nach der Kontrollebene schliessen: Arbeit in einem geteilten Arbeitsbaum technisch blocken, die widerspruechliche Testregel auf eine Linie bringen, Eingaben und Actions in den Workflows haerten.

**Umsetzung.** `scripts/lib/worktree-isolation.mjs` entscheidet die Isolation: ein verknuepfter Worktree passiert, ein geteilter Baum blockt, sobald ein fremder offener Claim existiert oder `--require-worktree`/`RBD_REQUIRE_WORKTREE=1` gesetzt ist. `pretask` liest dafuer `git status --porcelain --untracked-files=all` (sonst versteckt Git eine komplett neue Datei hinter `?? ordner/`), vergleicht die Pfade mit den offenen Claim-Allowlists und meldet mit `ERR-4019` die Gruende `shared-worktree`, `dirty-shared-tree` und `foreign-claim-paths`; `--json` macht den Befund maschinenlesbar. `turn:finish` bleibt beim Claim-begrenzten Staging. `long-checks.yml` uebergibt `balance_days` nur noch als `RBD_DAYS` an `balance-run.mjs`, das den Wert bereits auf 1 bis 400 validiert, statt ihn in die Shell-Zeile zu setzen. Alle Actions in allen Workflows tragen volle 40-stellige Commit-SHAs mit Versionskommentar. Der Testjob laeuft ohne `RBD_CONTROL_ROOT`, damit absolute Fixture-Pfade nicht unter `.rbd-control` landen; die Node-Gates behalten die Kontrollebene. `AGENTS.md` hat eine Testlinie: gezielte Nachweise waehrend der Arbeit, schwere Suite am Turn-Ende oder in CI; die absolute Sperre und die Doppelung sind entfernt.

**Pruefungen.** `worktree-isolation.test.ts` 8/8 mit temporaeren Git-Repos: schmutziger geteilter Baum -> Exit 1/`ERR-4019`, fremde Claim-Datei ohne Zusatzflag -> Exit 1, sauberer verknuepfter Worktree -> Exit 0. `workflow-hardening.test.ts` 4/4 prueft alle `uses:`-Zeilen auf 40 Hex-Zeichen, das Fehlen von `${{` in jeder `run`-Zeile von `long-checks.yml` und die eine Testlinie in `AGENTS.md`; `ci-gates.test.ts` 6/6 ist an `RBD_DAYS` angepasst. Dazu `node --check` fuer die beiden geaenderten Skripte und `pretask --json` einmal normal und einmal mit `--require-worktree` im eigenen Worktree. Die vollen Gates sind vor dem Commit gruen: `pnpm run test:ci` mit 186 Testdateien, 992 bestandenen und 6 uebersprungenen Tests; `verify:light` mit allen sechs Gates, dazu `typecheck`, `verify:docs`, `verify:test-quality`, Redundanz und LOC.

**Offen.** CI-Self-Repair, impact-gesteuerte Langlaeufe und die uebrigen Roadmap-Punkte bleiben offen; die Isolation ist nur fuer Agenten erzwungen, die `pretask` aufrufen, und der Issue-Check bleibt eine Pflicht aus dem Vertrag, kein technisches Gate.

## 2026-11-07 - Die Squash-Nachricht ist Teil des Gates

**Ziel.** Der main-Lauf nach #222 war rot, obwohl alle technischen Gates gruen waren: `Commit- und PR-Notes` las die Squash-Nachricht von ca5753e und fand die drei Pflichtsektionen nicht.

**Umsetzung.** Der Squash-Commit wurde per API mit einer kurzen Bullet-Liste gesetzt; `verify-commit-msg --head` prueft auf main genau diesen Text. Der Nachtrag haelt die Regel fest: manuelle Squash-Merges uebernehmen den PR-Body unveraendert oder setzen `### Changes (Was ist neu)`, `### Technische Basis & Kausalität` und `### Ausblick (Nächste Schritte)`; eine Kurzfassung ist kein gueltiger Merge-Text. Der Baum von ca5753e bleibt inhaltlich unveraendert.

**Pruefungen.** `node scripts/verify-commit-msg.mjs /tmp/main-msg.txt` reproduziert `ERR-4006` fuer ca5753e. Auf dem Baum sind `pnpm run typecheck`, `pnpm run verify:docs`, `pnpm test:ci` (180 Dateien, 980 Tests) und `verify-lane-claims --ci` gruen. Der neue Squash-Commit traegt die drei Sektionen; der naechste main-Lauf ist der Beleg.

**Offen.** Self-Repair, impact-gesteuerte Langlaeufe, Worktree-Isolation, Shell-Injection und Action-Pinning stehen in `docs/ROADMAP.md`.

## 2026-11-07 - Vertrauensgrenzen: Pruefer, Claim und Merge sind derselbe Stand

**Ziel.** Der Audit-Befund war nicht "zu wenig CI", sondern eine Asymmetrie: Die Gates waren granular, aber der PR kontrollierte Planer, Runner und Claim-Register mit, und `promote` merge den aktuellen Branch-Kopf statt des geprueften Commits.

**Umsetzung.** `ci-verify.yml` legt einen Worktree `.rbd-control` am Basis-Commit an; Planer, Node-Gates, Claim- und Commit-Notes-Pruefung laufen von dort, `RBD_ROOT` zeigt auf den PR-Baum. `report.mjs` und `gate-runner.mjs` trennen dafuer Steuerung und Pruefobjekt, `pnpm`-Gates bleiben Produktcode. `promote.mjs` holt den Kopf per `workflow_run.head_sha`, `promote-guard.mjs` prueft Herkunft, Ziel und `headRefOid`, und `gh pr merge --match-head-commit` schliesst das Zeitfenster; der manuelle Dispatch hat keinen Erfolgspfad mehr. `verify-lane-claims.mjs` vergleicht das Register im CI-Modus mit der Basis und der ersten Registrierung im PR. `turn-push.mjs` staged nur Claim-Pfade plus Versionsdateien, kein `git add -A`.

**Pruefungen.** `lane-claims.test.ts` 11/11, `promote-guard.test.ts` 7/7, `pnpm run typecheck`, `node --check` fuer alle geaenderten Skripte, YAML-Parse beider Workflows. Simulation der CI: `ci-plan.mjs`, `docs`- und `tree`-Gate aus dem `.rbd-control`-Worktree mit `RBD_ROOT` auf den PR-Baum, alle gruen; `verify-lane-claims --ci` gegen `origin/main` gruen, die Erweiterung der eigenen Allowlist wird nach dem ersten Commit als `ERR-4019` abgelehnt. Der echte PR-Lauf und der Merge-Commit folgen nach dem Push.

**Offen.** Self-Repair mit begrenzten Versuchen, impact-gesteuerte Langlaeufe, Worktree-Isolation in `pretask`, Shell-Injection in `long-checks.yml` und Action-Pinning stehen in `docs/ROADMAP.md`.

## 2026-11-07 - Claim 14 und das Ende der Selbstreferenz

**Ziel.** Nach dem Merge von #219 stand Claim 14 offen; ein neuer Claim fuer den Nachtrag haette nach seinem eigenen Merge dasselbe Problem nur eine Ebene weitergeschoben.

**Umsetzung.** Claim 14 ist ueber den baumgleichen Commit `893317c` als `merged` geschrieben. Fuer den Nachtrag auf demselben Branch waehlt `selectClaim()` erst den offenen, dann den gemergten Claim der Lane; `verify-lane-claims.mjs` und `turn-push.mjs` teilen diese Auswahl. Kein neues Modul, keine zweite Evidenzlogik.

**Pruefungen.** `reconcile-claims` schreibt genau einen Claim; der zweite Lauf meldet `keine Abweichung`; `verify-lane-claims` meldet 0 Kollisionen und fuehrt den Branch unter dem gemergten Claim. `claim-evidence.test.ts` 7/7, `lane-claims.test.ts` 3/3, `pnpm run typecheck`, `pnpm run verify:light` und `verify-commit-msg` gruen.

**Offen.** Keine offenen Registereintraege mehr auf `main`; Slice C und der Doku-Resolver bleiben in `docs/ROADMAP.md`.

## 2026-11-07 - Claim 13 reconciled

**Ziel.** Nach dem Merge von #218 stand Claim 13 im Register noch auf `open` - derselbe Fall wie zuvor bei Claim 12, eine Ebene weiter.

**Umsetzung.** Nur der vorhandene Pfad: `reconcile-claims --apply` schreibt `merged`, `mergedEvidence: branch-tree-on-main` und `mergedSha: e2869a1`. Kein neues Modul, keine Codeaenderung; der lokale Branch-Kopf `3c42e94` traegt denselben Baum wie der Merge-Commit.

**Pruefungen.** Vor dem Schreiben zeigte `verify-lane-claims` `Lane-Baum liegt auf main (e2869a1); als merged behandelt` bei 0 Kollisionen; danach `reconcile-claims: keine Abweichung`; das Register hat nur noch Claim 14 offen, dessen PR noch nicht gemergt ist. `claim-evidence.test.ts` 7/7, `pnpm run typecheck` gruen.

**Offen.** Claim 14 wird nach dem Merge dieses PRs seinerseits vom naechsten Lauf erkannt; geschrieben wird der Status nur mit einem Commit. Das steht in `docs/ROADMAP.md`.

## 2026-11-07 - Claim 12: Merge-Beleg aus der lokalen Historie

**Ziel.** Der reale Fall (Lane steht auf `open`, obwohl ihr PR gemergt ist) sollte als `merged` erkannt werden - ohne `gh` und ohne Basis-SHA.

**Umsetzung.** `claim-evidence.mjs` liest den Lane-Kopf aus `refs/heads` beziehungsweise `refs/remotes/origin`, prueft `merge-base --is-ancestor` gegen `origin/main` und sucht einen Commit auf `main` mit demselben Baum. Ein Squash-Merge erzeugt genau diesen Zustand; der geloeschte Branch ist damit kein Hindernis. `reconcile-claims.mjs` schreibt Belegart und Beleg-Commit in den Claim, `verify-lane-claims.mjs` filtert Kollisionen ueber dasselbe `decideClaim`.

**Pruefungen.** `reconcile-claims.mjs` auf dem echten Register: Claim 12 -> `merged` (`branch-tree-on-main`, `a490d4a`); `verify-lane-claims` meldet danach 0 Kollisionen. `claim-evidence.test.ts` 7/7, `pnpm run typecheck`, `pnpm run verify:light`, `verify-commit-msg` gruen.

**Offen.** Ohne lokalen Branch und ohne `gh` bleibt ein Claim unbelegt und damit fail-closed; das steht in `docs/ROADMAP.md`.

## 2026-11-07 - Slice B: Mehrfach-Diagnose, Retry und Claim-Evidenz

**Ziel.** Ein roter Lauf sollte nicht nur den ersten Befund zeigen, transiente Infrastrukturfehler nicht sofort ein Issue erzeugen, und ein Claim durfte nicht deshalb als Kollision gelten, weil niemand das Register nach dem Merge nachgezogen hatte.

**Umsetzung.** `scripts/lib/gate-diagnostics.mjs` ist die eine Auswertung eines roten Laufs: alle fehlgeschlagenen Jobs und Schritte, ein Befund je Schritt, Fehlercode aus der letzten roten Log-Zeile (PASS zaehlt nicht), Gruppierung gleicher Codes. `pr-watcher.mjs` hat `firstGateError()` und die eigene Log-Auswertung verloren und nutzt nur noch diese Diagnose; vor dem Issue startet es ausschliesslich transiente Befunde genau einmal neu (`run_attempt < 2`). `scripts/lib/claim-evidence.mjs` entscheidet `merged` aus einem gemergten PR oder einem Branch-Kopf auf `main`; der Basis-SHA ist aus der Signatur verschwunden, damit der alte Fehler nicht zurueckkehren kann. `reconcile-claims.mjs` ist darauf umgestellt und schreibt nur mit `--apply`; `verify-lane-claims.mjs` filtert Kollisionen, deren Lane nachweislich gemergt ist, und laesst sie ohne `gh` fail-closed stehen.

**Pruefungen.** `gate-diagnostics.test.ts` 5/5, `claim-evidence.test.ts` 4/4, `node --check` fuer alle geaenderten Skripte, `reconcile-claims.mjs` und `verify-lane-claims.mjs` gegen das echte Register.

**Offen.** Der Ende-zu-Ende-Abbruch der Staging-Isolation und der volle PR-Lauf stehen unten im Uebergabeabschnitt; Slice C (SemVer, Langlaeufe) bleibt offen.

## 2026-11-07 - Slice A: lokales Feedback und Staging-Isolation

**Ziel.** Der Vertrag erlaubte `test:affected` waehrend der Arbeit und verbot gleichzeitig Zwischenlaeufe; ausserdem sammelte `turn-push.mjs` per `git add -A` jede Aenderung im Arbeitsbaum ein, auch fremde. Beides sollte eine Linie bekommen, ohne eine zweite Pipeline zu bauen.

**Umsetzung.** `scripts/lib/staging-scope.mjs` entscheidet rein, welche geaenderten Pfade der eigene Claim fuehrt; `turn-push.mjs` prueft das vor dem Versions-Bump und bricht mit `ERR-4019` ab, wenn fremde Pfade im Baum liegen. Die Pfadauslegung wurde aus `LaneClaim` in die exportierte Funktion `allowsPath` gezogen, damit Claim-Gate, Staging und Test dieselbe Regel nutzen (`scripts/lib/lane-claims.mjs`). `scripts/agent-feedback.mjs` gibt eine Zeile plus `--json` aus; die Auswahl kommt aus `affected-tests.mjs`, es gibt keinen zweiten Selektor. Dabei fiel auf, dass `changedFiles()` unversionierte Dateien nicht las - genau der Fall "neues Modul" waere zu klein ausgewaehlt worden; die vierte Quelle `git ls-files --others --exclude-standard` schliesst das.

**Pruefungen.** `staging-scope.test.ts` 4/4, `verify-test-quality` PASS (180 Testdateien), `pnpm run typecheck` PASS, `node scripts/agent-feedback.mjs` und `--json` gegen den echten Arbeitsbaum, `node --check` fuer beide Skripte.

**Offen.** Die volle Abnahme bleibt der PR-Lauf; Slice B (Multi-Gate-Diagnose, Retry, Doku-Resolver, Claim-Evidenz) und Slice C (SemVer, Langlaeufe) stehen in `docs/ROADMAP.md`.

## 2026-11-07 - Bodies ohne Informationsverlust

**Ziel.** Die CI hat PR- und Commit-Bodys bisher ersetzt statt ergaenzt: `lift-commit-body` schrieb eine neue Kurzfassung aus dem letzten Commit, `promote` baute den Merge-Text ebenfalls aus dem letzten Commit, `turn-push` committete eine generische Vorlage. Jeder dieser Wege konnte gepflegte Beschreibungen und Details verlieren.

**Umsetzung.** Neu ist `scripts/lib/body-sync.mjs` als gemeinsame Wahrheit: Markerbereich, Diff-Klassifikation (`parseNameStatus`, `classifyPaths`, `describeDiff`), Sektionspruefung (`missingSections`) und Notes-Pruefung (`evaluateNotes`). `turn-push.mjs` bricht bei Codeaenderungen ohne inhaltliche `.turn-notes.md` mit `ERR-4006` ab und beschreibt reine Doku-, Governance- und Versionsaenderungen ehrlich. `lift-commit-body.mjs` liest den vorhandenen PR-Body, haengt bei Bedarf einen Automationsbereich an und aktualisiert spaeter nur diesen; bei doppelten oder unbalancierten Markern faellt keine Schreiboperation. `promote.mjs` nimmt denselben Weg fuer den Merge-Text. `pr-escalation.yml` checkt `main` aus und behandelt den Push-Branch nur als Datenquelle. `turn-push` respektiert ausserdem den eigenen Claim, damit eine Governance-Lane ihre Doku ueberhaupt committen kann.

**Pruefungen.** `node node_modules/vitest/vitest.mjs run --config src/Config/vite.config.ts src/core/governance/__tests__/body-sync.test.ts` (8/8 gruen, deckt Erhalt, fehlende Sektion, mehrere Commits, Doku gegen Runtime, Idempotenz, eigenen Bereich, Abbruch und fehlende Notes ab); `node scripts/verify-test-quality.mjs` PASS; `pnpm run typecheck` PASS; `pnpm run verify:light` PASS (Lint, LOC, Typecheck, Doku, Tree, Redundanz). Der CI-Job `Gate docs` fand danach eine veraltete Inventur (1353 statt 1355 Dateien), weil sie vor dem Staging erzeugt wurde; `inventory:build` hat sie nachgezogen.

**Offen.** Der Merge-Text kann weiterhin nur so gut sein wie der PR-Body: die Automatik beschreibt Dateien und Status, keine Semantik. Symbol- und Aufruferanalysen bleiben Aufgabe der Notes. Release-Plan und Doku-Reconcile stehen in `docs/ROADMAP.md`.

## 2026-11-07 - CI-Plan erreicht die Gate-Jobs

**Ziel.** Nach dem ersten Matrix-Umbau blieb der Plan-Job rot: die Gate-Matrix kam nie bei den Gate-Jobs an.

**Umsetzung.** scripts/ci-plan.mjs akzeptiert Flags jetzt in beiden Schreibweisen; .github/workflows/ci-verify.yml uebergibt --github-output mit Gleichheitszeichen. Ursache war genau die Leerzeichen-Variante, die der Parser nicht las.

**Pruefungen.** node scripts/ci-plan.mjs mit --github-output schreibt matrix, test_files und tests_json; verify:light gruen; Nachweis im naechsten PR-Lauf.

## 2026-11-07 - Impact-Matrix: Gates folgen dem echten Diff

**Ziel.** Die CI entschied bisher nur nach Profil (`light`/`full`), nicht nach dem, was ein Commit wirklich anfasst: eine Doku-Aenderung bekam dieselbe Matrix wie eine RNG-Aenderung, und der APK-Filter baute fuer jedes `scripts/`-Skript ein Android-Paket.

**Umsetzung.** `scripts/lib/ci-plan.mjs` verbindet den vorhandenen Diff-/Importgraphen mit dem Gate-Plan: Doku und Claims laufen nur durch `check:loc`, `docs`, `tree`, `redundancy`; Runtime-Code aktiviert Test-, Dead-Code-, Capability- und Build-Gates; `content/`/`public/` zusaetzlich Assets; Dependencies, Toolchain oder unbekannte Pfade fallen auf das volle Profil zurueck. `ci-plan.mjs` schreibt Matrix, `RBD_TEST_FILES` und einen kleinen Planbericht (`GITHUB_STEP_SUMMARY` + Artefakt). `release-impact.mjs` prueft nur Produktpfade, `reconcile-claims.mjs` setzt Claims auf `merged`/`superseded`, wenn der Branch fehlt oder vollstaendig in `main` liegt.

**Pruefungen.** `node scripts/ci-plan.mjs` gegen den echten Branch-Diff (Impact an/aus), `node scripts/reconcile-claims.mjs --apply`, `node scripts/release-impact.mjs`, danach `verify:light` und die PR-Gates in GitHub Actions.

**Offen.** Nichts aus diesem Schnitt; die volle Testsuite laeuft weiterhin als ein Gate-Job, Sharding folgt erst mit belegbar vollstaendiger Dateiliste.
## 2026-11-07 - Agentenverhalten: Pre-, Waehrend- und After-Task verbindlich

**Ziel.** Agents sollen nicht ohne Plan loslegen und nicht jeden CI-Lauf abfragen. Vor dem CI-Umbau wird deshalb der Arbeitsablauf selbst verbindlich: Pre-Task, waehrend der Arbeit, After-Task, Polling-Grenzen und die Rolle des Monitors.

**Umsetzung.** `AGENTS.md`: Pretask auf vier Schritte erweitert (Issue-Check, sauberer Arbeitsbaum, `agent:context`-Impact, Lane mit Claim), der Abschnitt `Agenten-Verhalten` enthaelt jetzt Waehrend-der-Arbeit, CI-Polling (hoechstens drei Abfragen mit wachsendem Abstand, nur der eigene Lauf), After-Task, Monitor (nur berichten) und Blocker-Uebergabe. Neu ist die Tabelle `Technische Durchsetzung`: sie nennt je Regel, ob `pretask.mjs`, der Pre-Commit-Claim-Check, `turn-push.mjs` (`ERR-4023`, `ERR-4024`, `ERR-4006`) oder `ci-verify.yml` sie erzwingt - und welche Regeln noch reines Verhalten sind. Keine neue Registry, keine zweite Eskalationsleiter.

**Pruefungen.** `pnpm run verify:light` gruen (Lint, LOC, Typecheck, Doku, Tree, Redundanz); `verify-lane-claims --ci` claim-konform gegen `origin/main`; Doku-Marker und Inventur ueber `docs:sync` und `inventory:build` nachgezogen.

**Offen.** Issue-Check, Impact-Pflicht, Polling-Grenzen und Monitor-Rolle sind nur Verhalten. Technische Durchsetzung folgt dort, wo sie ohne neue Wahrheit moeglich ist: Impact in der Gate-Matrix (Phase 1), Klassifikation und Retry im Watcher (Phase 3).

## 2026-11-07 - Gates granular: eine Matrix statt eines Monolithen

**Ziel.** Ein roter Lauf hiess bisher nur "`verify:all` ist rot": zwoelf Gates in einem Job, ein Status, keine Aussage darueber, welches Gate eine Lane gebrochen hat. Gewuenscht ist die granulate Form - ein Status je Gate, ein Aggregat als Pflichtstatus - und lokal bleibt alles leicht.

**Umsetzung.** `scripts/gate-matrix.mjs` liest denselben Gate-Plan wie `verify` und gibt ihn als GitHub-Matrix aus; die CI hat daraus einen Job je Gate mit `fail-fast: false`. `run-pipeline --gate=<name>` faehrt genau eines und bricht bei einem Gate ab, das nicht zum Profil gehoert: ein stiller Fehlschlag waere ein gruener Status ohne Pruefung. `Fail-Closed Gates` bleibt Pflichtstatus und fuehrt nur noch Ergebnisse zusammen; Claims und Commit-/PR-Notes sind eigene Jobs. `scripts/lib/dependency-change.mjs` sammelt die Audit-Regel an einer Stelle. Die 0.2-Lane ist archiviert: `git diff origin/gov/0.2-governance origin/main` zeigt nur noch Marker- und Hook-Zeilen.

**Pruefungen.** `check-loc`, `verify:tree`, `verify:redundancy`, `verify:docs`, `typecheck`, ESLint und `vitest run src/core/governance/__tests__/ci-gates.test.ts` (YAML-Baum: Matrix aus `needs.plan.outputs.matrix`, Aggregat mit `needs`/`always()`, Gate-Schritt mit `--gate=`).

**Offen.** PR #203 traegt eine zweite CI-Form (`scripts/ci-impact.mjs`, `pull_request_target`, ein Job). Zwei Entwuerfe fuer denselben Workflow sind eine zweite Wahrheit; die Entscheidung steht in `docs/ROADMAP.md`.

## 2026-11-07 - Governance: parallel arbeiten, ohne sich selbst auszubremsen

**Ziel.** Der Ist-Zustand war widerspruechlich: 14 offene Branches, elf Claims ohne Pflege, ein `BLOCKED`, das jeden roten Test umfasste, und `verify:all` auf jedem Feature-Push. Die Governance sollte nur noch echte Notfaelle stoppen und den Rest als Issue abholen.

**Umsetzung.** Neues Profil `light` (Lint, LOC, Typecheck, Doku, Tree, Redundanz) als Turn-Gate; `ci-verify.yml` waehlt `light` fuer Feature-Pushes und `all` fuer PR, `main` und manuelle Laeufe. `tests` meldet `ERR-4026` (AGENT) statt `ERR-2001` (BLOCKED); `escalation.mjs` verengt `BLOCKED` auf Invarianten und ordnet Timeout, Abbruch und Runner dem `REMOTE_CI` zu. `verify-lane-claims` sperrt die acht Meta-Dateien wirklich (nur Marker/Version sind Systempfad), nimmt `main` aus und laeuft ohne `node_modules`. `promote` mergt nur PR-Laeufe, Timeout wird `REMOTE_CI`, `integration` nur per Dispatch. `pr-watcher` legt `remote-ci`-Issues an und schliesst erledigte `gate-failure`-Issues, sobald der Commit auf `main` liegt. Neu: `agent:pretask` und `audit`-Relevanz ueber den echten Diff statt ueber den Versionsbump.

**Pruefungen.** `node --check` fuer alle geaenderten Skripte, YAML-Parse aller Workflows, `pnpm run verify:docs`, `pnpm run verify:light`, `pnpm run agent:pretask` und ein Klassifikationstest fuer `escalation.plan`. Der Branch-Aufraeumen-Lauf loescht nur Branches, die bereits in `HEAD` enthalten sind.

**Nachtrag (Luecken).** Beim Gegencheck gegen `phase-0-fundament.md` fielen drei Loecher auf, die im Hook allein nicht sichtbar waren: (1) Claims wurden nur lokal geprueft, Cloud-Agenten ohne Hooks schrieben ungeprueft - jetzt prueft `ci-verify.yml` fuer jeden PR denselben Claim gegen den Diff; (2) Owner waren frei waehlbar - jetzt fester Roster, Branch-Schema und `CODEOWNERS` fuer Meta/Workflows; (3) ein Push auf einen Branch mit offenem PR startete ein zweites volles Gate - der Push-Lauf endet jetzt nach dem PR-Check. Ausserdem: das rote Lane-Gate bekommt `lane:<domäne>` und blockiert nur diese Lane; PARKED hat einen Pflichtabschnitt in `ROADMAP.md`; `capabilities.json` lag in den Claims an einem Pfad, den es nicht gibt (jetzt `docs/capabilities.json`).

**Zweite Pruefung (fremder Befund).** Drei Punkte waren tatsaechlich falsch diagnostiziert: (1) `firstGateError` nahm die erste Zeile mit irgendeinem ERR-Code, also auch eine PASS-Zeile; jetzt zaehlen nur Zeilen aus fehlgeschlagenen Gates, die betroffene Datei steht im Issue. (2) `loadClaims` machte aus einem kaputten Register eine leere Liste - fail-open; jetzt bricht die Pruefung mit `ERR-4019` ab, `saveClaims` schreibt atomar, und Pfad-Overlaps werden auf Praefix-Ebene verglichen. (3) `turn:finish` pushte nach `main`; jetzt pusht es nur den Arbeitsbranch, `promote` legt den PR an, gemergt wird der PR-Lauf. Nicht bestaetigt: der genannte Fehlschlag in `dependency-governance.test.ts` - der Test ist mit dem aktuellen Register gruen (4/4). `long-checks` startet `verify:all` nicht mehr per Default, und der Watcher nutzt eine run-basierte Concurrency-Gruppe.

**Offen.** Die unmerged Lane-Branches (`domain-event`, `relationship`, `factor`, `save`, `hygiene/0.1-baseline`) und vier Stashes bleiben stehen; ihre Claims sind offen beziehungsweise in `ROADMAP.md` vermerkt. Ruleset, `PROMOTE_TOKEN` und die erste gruene `main`-Runde muessen im echten Lauf bestaetigt werden.

## 2026-11-06 - Doku-Konsolidierung: elf Referenzdokumente in Pflichtdoku

**Ziel.** Die Doku-Konsolidierung abschliessen, ohne Spiel- oder Sim-Features und ohne visuelle Browser-/APK-Abnahme. Jedes Dokument unter `docs/`, das nicht zu den Pflichtdokumenten gehoert, sollte nach Ueberfuehrung seiner gueltigen Inhalte geloescht werden; kein offener Punkt durfte nur in einer geloeschten Datei stehen.

**Umsetzung.** Bildsprache, Assets, Asset-Semantik, Asset-Pack, CI-Gates, Fehlerregister, Gate-Rootcause und Narrativvertrag stehen als Anhaenge in `docs/ARCHITECTURE.md`. Der Produktvertrag steht in `docs/ROADMAP.md`, die Eskalationsleiter in `AGENTS.md`, der generierte Testkatalog als Block in `docs/INVENTORY.md`. Die technischen Leser wurden mitgezogen: `scripts/verify-redundancy.mjs`, `src/core/governance/__tests__/dependency-governance.test.ts`, `scripts/test-catalog.mjs`, der Pre-Commit-Hook und die Subsystem-Dokumentzuordnung. `docs/ROADMAP.md` fuehrt jetzt auch M4, die Geraete-/Lager-/Personal-Facts und die offenen Kleinbefunde aus der Inventur.

**Pruefungen.** `pnpm run verify:docs`, `pnpm run verify:commit-msg` und `pnpm run verify:all` laufen auf dem finalen Baum; die Ergebnisse und die Bericht-ID stehen im Abschlussbericht. Zusaetzlich belegt eine Suche nach den elf Dateinamen, dass keine Quelle mehr existiert, und eine Suche nach den offenen Punkten, dass sie in `docs/ROADMAP.md` stehen. Der UI-Test `machine-play.test.tsx` bekommt fuer den Ladezustand unter paralleler Last 3 s statt des 1-s-Defaults; die Assertion bleibt unveraendert.

**Offen.** Keine visuelle Browser- oder APK-Abnahme; der Nutzer testet auf seinem privaten Geraet. Alle offenen Punkte stehen ausschliesslich in `docs/ROADMAP.md`.

## 2026-11-06 - Audit #19: Firmenstufe sichtbar, Pixi-Fallback, Branch-Hygiene

**Ziel.** Die zwei im Main-Audit noch offenen Befunde schliessen, ohne neue
Spielmechanik: Firmenstufen waren nur im Code, nicht in der UI; ein
fehlgeschlagener Pixi-Start liess den Floor schwarz.

**Umsetzung.**

- `CompanyStatus` ist exportiert, `GameView.company` wird in `buildView()` aus
  `companyStatus()` abgeleitet. HUD und Betriebspanel zeigen die Stufe; das
  Panel nennt die offenen Bedingungen der naechsten Stufe mit Ist/Soll.
- `FloorStage` faengt die Rejection von `Application.init()` ab und rendert
  einen Hinweis mit `role="status"`; die Panels bleiben bedienbar.
- Branch-Hygiene: `integration` auf `5ef2657` gesetzt, drei gemergte
  Remote-Branches nach Leer-Diff-Beleg geloescht, `feat/spatial-layout-editor`
  neu auf `main` angelegt.

**Pruefungen.** `pnpm typecheck` PASS; `progression.test.ts` 10/10 und
`ui.test.tsx` 9/9 PASS; der zuvor sporadisch rote Kassierer-Test nach
Fenstererweiterung auf 240 Ticks 5/5 PASS (Assertion unveraendert);
`pnpm run verify:all` PASS mit allen zwoelf Gates
(Bericht im Commit).

**Bewusst nicht getan.** Keine neue Spielmechanik, kein Eingriff in Ledger, RNG
oder Save; die sichtbare Browser-/APK-Abnahme bleibt beim Nutzer.

## 2026-11-06 - Floor-Spielwelt (PR #150) auf main zusammengefuehrt

**Ziel.** PR #150 fuehrt GAST und BETRIEB als eine globale Perspektive ein und
lag seit dem Morgen auf einem aelteren `main`.

**Umsetzung.**

- `main` (`a83efff`, 0.3.142) in den PR-Branch gemergt; Code-Konflikte in
  `App.tsx`, `dock.tsx`, `hud.tsx`, `machine-popup.tsx`, `app.css` und zwei
  Tests von Hand zusammengefuehrt, `floor-view.ts` kommt aus dem neuen `main`.
- Die Perspektive bleibt die einzige Rollenwahrheit: Marke und
  `Ctrl+Shift+D` oeffnen die Werkstatt, `Hud`, `Dock` und `FloorRoleBar`
  haengen an `perspective`.
- `machine-operator.tsx` nutzt `PlinkoEditorLazy`, damit der Popup-Umbau die
  Chunk-Grenze aus 0.3.141 nicht aufhebt.
- Doku und Versionsdateien auf den `main`-Stand; Version 0.3.143, Inventar und
  alle sechs Marker nachgezogen.

**Pruefungen.** `pnpm run verify:all` PASS mit allen zwoelf Gates (Bericht im
Commit), `verify:docs` und `verify-commit-msg --head` gruen; CI auf dem
PR-Branch und Merge mit `commit_message` = PR-Body.

**Bewusst nicht getan.** Kein Eingriff in Spiel, Ledger, RNG oder Save; die
sichtbare Browser-Abnahme bleibt beim Nutzer.

## 2026-11-06 - Buehne aus der Legacy-Hot-Zone (PR #160) zusammengefuehrt

**Ziel.** PR #160 loeste `floor-view.ts` und `guest-art.ts` aus den
Legacy-LOC-Ausnahmen; er lag auf 0.3.138 und war nicht mergebar.

**Umsetzung.**

- `main` (`ea76e2c`, 0.3.141) in den PR-Branch gemergt; Konflikte nur in den
  sechs Pflichtdokumenten, `package.json` und `pnpm-lock.yaml`
  (Versionsstaende), jeweils auf den `main`-Stand aufgeloest.
- Code konfliktfrei: `floor-camera-rig.ts`, `guest-rig/paint/head.ts`,
  `animateFloor`-Signatur und `loc-budgets.mjs`.
- Version 0.3.142; Inventar und alle sechs Marker nachgezogen.

**Pruefungen.** `pnpm run verify:all` PASS mit allen zwoelf Gates (Bericht im
Commit), `verify:docs` und `verify-commit-msg --head` gruen; CI
`Fail-Closed Gates` auf dem PR-Branch gruen, danach Merge mit
`commit_message` = PR-Body.

**Bewusst nicht getan.** Kein Eingriff in Spiel, Ledger, RNG oder Save.

## 2026-11-06 - Perf-PR #161 auf den main-Stand zusammengefuehrt

**Ziel.** Der offene Perf-PR #161 (WebP-Atlas, lazy Plinko-Buehne, eigener
HUD-Icon-Chunk) lag seit 20:35 auf einem aelteren `main`-Stand und war mit
`integration/rot` und `integration/konflikt` markiert.

**Umsetzung.**

- `main` (`b8a46be`, 0.3.140) in den PR-Branch gemergt. Konflikte gab es nur in
  `AGENTS.md`, `CHANGELOG`, `ARCHITECTURE`, `DEVTAGEBUCH`, `INVENTORY` und
  `ROADMAP` (Doku-Marker und Versionsstaende); dort gilt der `main`-Text, die
  Perf-Nummern stehen als 0.3.141 im Changelog.
- Code und Assets (Atlas-WebP, Manifest, `atlas-webp.mjs`, Vite-Chunking,
  `plinko-editor-lazy`, `machine-popup`) haben konfliktfrei gemergt.
- Version 0.3.141; Inventar und alle sechs Marker nachgezogen.

**Pruefungen.** `pnpm run verify:all` (Bericht oben im Commit), `verify:docs`
und `verify-commit-msg --head` gruen; CI-Check `Fail-Closed Gates` auf dem
PR-Branch gruen, danach Merge mit `commit_message` = PR-Body.

**Bewusst nicht getan.** Kein Eingriff in Spiel, Ledger, RNG oder Save; keine
Aenderung an den Messwerten des PRs.

## 2026-11-06 - Merge-Gate auf main reparieren

**Ziel.** `main` war nach dem Merge von PR #163 rot: `Fail-Closed Gates` brach
mit `ERR-4006` ab, `Bump, tag, release` und der APK-Bau wurden uebersprungen.

**Ursache.** Der Merge wurde nur mit `commit_title` ausgefuehrt. GitHub schreibt
dann den PR-Titel als Merge-Text; der vollstaendige PR-Body mit den drei
Pflichtsektionen blieb im PR. `verify-commit-msg --head` prueft auf `main` aber
den Merge-Commit. Reproduziert mit `git log -1 --format=%B 6f7a906` gegen
`node scripts/verify-commit-msg.mjs`: drei Mal „Pflichtsektion fehlt“.

**Umsetzung.**

- `docs/GATE-ROOTCAUSE.md` traegt den Fall als eigene Tabelle plus Regel: Merge
  ueber Connector oder REST-API immer mit `commit_message` = PR-Body.
- Dieser Follow-up-PR startet von `main` und wird selbst mit dem vollstaendigen
  PR-Body als Merge-Text gemergt; damit traegt der neue `main`-HEAD die
  Sektionen.
- Version 0.3.140; CHANGELOG, INVENTORY (T76) und ROADMAP nachgezogen.

**Pruefungen.** `pnpm run verify:all` PASS: zwoelf Gates gruen (Lint, LOC,
Typecheck, Testvertrag, Dead-Export, Doku, Tree, Redundanz, Assets, Vitest,
Audit, Build) im Bericht `2026-11-06T21-00-52-960Z`. `verify-commit-msg` gegen
den alten Merge-Text meldet vorher drei fehlende Pflichtsektionen; der
Merge-Aufruf dieses PRs setzt `commit_message` auf den PR-Body, danach wird der
neue `main`-HEAD mit `Fail-Closed Gates` geprueft.

**Bewusst nicht getan.** Kein Eingriff in Spiel, Ledger, RNG oder Save; keine
Aenderung an `verify-commit-msg` selbst — der Fehler lag im Merge-Aufruf, nicht
im Gate.

## 2026-11-06 - Doku konsolidiert und offene Punkte ueberfuehrt

**Ziel.** Die offenen Punkte aus Mission, Commits der letzten 48 Stunden und den
frueheren Analyse-, Review- und Planberichten pruefen und die Doku auf die sechs
Pflichtdokumente konsolidieren.

**Umsetzung.**

- Commits, PRs und Remote-Branches der letzten 48 Stunden geprueft. Task 5/5
  (Commands, 30-Schritt-Undo/Redo, Editor-UI, Pixi-Auswahl, Export/Import,
  Produktionsausschluss) steht; PR #142 ist bereits gemergt. Offen sind die PRs
  #150, #160 und #161 sowie die Branch-Bereinigung.
- L1 (CASHOUT-Haenger), L2 (Doppelauszahlung), S1 (Schuldentilgung),
  VELVET, FREE_DRINK, EXTRA_REEL und die Persona-Einsatzskalierung im Code
  belegt; Rivalenprofil ist in `games-popup.tsx` vorhanden. `PLAYER_CASH` bleibt
  offen: `cashOutPlayerCash` existiert, hat aber keinen Produktions-Aufrufer.
- Phase 6: A1 bestanden, A2-A5 offen; A6-A8 bleiben bis zur vollstaendigen
  Desktop-Abnahme zurueckgestellt. Wand-Occlusion ist gebaut, aber nicht im
  Browser belegt. Der Produktionsbuild enthaelt keinen Editor-Chunk.
- 18 historische Berichte, Reviews, Plaene und Skill-Dokumente geloescht; ihre
  offenen Punkte stehen in `ROADMAP.md` unter „Offene Punkte (konsolidiert
  2026-11-06)“, die Pruefungen in `INVENTORY.md` §16a. Lebende Vertraege
  (`PRODUCT`, `NARRATIVE-ENGINE`, `ART-DIRECTION`, `ASSETS`, `CI-GATES` usw.)
  bleiben.
- `INVENTORY.md` korrigiert: `PLAYER_CASH` ist wieder offen; Mods und
  Persona-Einsatz sind als geloest markiert. `ARCHITECTURE.md` verweist nicht
  mehr auf den geloeschten Taskplan.

**Pruefungen.** `node scripts/verify-narrative-content.mjs` meldet 65 Beitraege,
65 Turns und 65 Fragmente. `pnpm run verify:docs` PASS, `pnpm run verify:assets`
PASS (554 Dateien, 15,6 MB), `pnpm run verify:quick` PASS (zehn Gates) und
`pnpm run build` PASS. Der Produktionsbuild enthaelt weder `layout-editor` noch
`VITE_RBD_EDITOR_MODE`.

**Offen.** Geraeteabnahme, APK-Installation, Slow-4G-Browserlauf und
Restfehler der Phase 6 gemaess Roadmap. Branch-Bereinigung und
`integration`-Reset wurden bewusst nicht ausgefuehrt, weil sie offene PRs
beruehren.

**Bewusst nicht getan.** Keine Spiel-, Ledger-, RNG- oder Save-Aenderung, kein
Merge der offenen PRs, keine Loeschung von Remote-Branches.

## 2026-11-06 - Phase-3-Effekte im Browser abgenommen

**Ziel.** Jackpot, Kassenklingeln, Mood-Bubble und Spielfarben im laufenden Browser pruefen und gefundene Abweichungen direkt beheben.

**Umsetzung.**
- Jackpot: `emit('slot:jackpot', ...)` ueber denselben Core-Event-Bus, den `slot-session` nutzt; goldener Burst, Flash und 6-px-Shake waren sichtbar, der Win-Sound lief ueber zwei neue Oszillatoren (2 -> 5). Screenshot `artifacts/phase3-jackpot.png`.
- Kasse: kontrollierter Gast mit 25 VC offenem Gewinn; der `FloorCash`-Stapel zeigte fuenf Chips, spielte `coin` (2 Oszillatoren + 1 Buffer) und der `money:bigPayout`-Burst sass am Wechseltisch. Der Stapel lag jedoch hinter dem Tisch (`z=380640900` gegen `390001001`) und war unsichtbar. `FloorCash.sync()` gibt jetzt den Fussanker zurueck, `FloorProps` haengt den Stapel mit `furniture/999` daran; im Browser liegt er mit `z=390001999` vor dem Tisch und bleibt hinter Figuren. Screenshot `artifacts/phase3-cash-fixed.png`.
- Mood-Bubble: kontrollierter Gast `Mira Test` mit `mood=20`; "Hier stimmt was nicht" ist im Detail-LOD lesbar, im Uebersichts-LOD absichtlich ausgeblendet. Keine Aenderung noetig. Screenshots `artifacts/phase3-mood-zoomed.png` und `artifacts/phase3-mood-bubble-zoom-closeup.png`.
- Spielfarben: `GamesPopup` uebergab `machine.game` nicht an `PopupShell`, deshalb blieb `data-game=null` und das Eyebrow immer cyan. Mit `game={machine.game}` tragen alle acht Spiele ihre Familie: SLOT `#ff2e88`, BLACKJACK/POKER/ROULETTE `#b06bff`, PLINKO/DICE/SHELL/VIDEO_POKER `#54e0ff`; Eyebrow und `popup-head`-Kante stimmen. Screenshot `artifacts/phase3-games-after-slot.png`.
- Regression: `src/ui/__tests__/ui.test.tsx` prueft am Rivalen-Dialog `data-game="SLOT"`.

**Pruefungen.** Headless Chrome 1024x768 bei DPR 2 gegen den Dev-Server auf Port 3000: alle vier Effekte durchgespielt, keine Konsolen- oder Page-Fehler. `tsc --noEmit -p src/Config/tsconfig.json` Exit 0. `vitest run ... src/ui/__tests__/ui.test.tsx` 8/8 gruen. Turn-Gate: `pnpm run verify:quick` PASS (alle zehn Gates gruen).

**Offen.** Die Abnahme lief headless im Desktop-Browser; Ton ist ueber die erzeugten Audio-Knoten belegt, nicht ueber Lautsprecher gehoert. 60 fps, Haptik und Touch bleiben fuer ein echtes Android-Geraet offen.

## 2026-11-06 - HUD-PNGs inline: zwei Requests weniger im Kaltstart

**Ziel.** Die zwei verbliebenen HUD-PNG-Requests (`ui/coin.png`, `ui/guest-cyan.png`) aus dem Kaltstart entfernen und den ersten Frame erneut unter Slow 4G messen, nicht nur unter dem bisherigen 9-Mbit/s-Profil.

**Umsetzung.** `src/ui/hud-icons.ts` traegt beide 32x32-PNGs als Data-URI; `src/ui/icons.ts` verweist fuer `coin` und `guests` darauf. Die Originale bleiben unter `public/assets/casino/ui/` fuer Favicon, Manifest und Asset-Katalog. Keine Aenderung an Layout, Groesse oder Farbe der Icons.

**Pruefungen.** `pnpm run build` gruen. Produktionsbuild kalt in Chrome for Testing 143 headless (1024x768), per CDP `Network.emulateNetworkConditions` auf 1,6 Mbit/s Download, 750 kbit/s Upload und 150 ms RTT gedrosselt, Cache aus. Baseline: 24 Requests, 12.185 ms, 2.421.929 B. Inline-HUD: 22 Requests, 12.162 ms, 2.422.440 B. Die zwei HUD-PNG-Requests fehlen; beide Icons rendern als 32x32-Data-URI, keine kaputten Bilder, keine Konsolenfehler. `pnpm run typecheck` gruen.

**Offen.** Der erste Frame bleibt mit 12,16 s bandwidth-bound; 2,42 MB JS und Atlas dominieren, die beiden Icons machen nur rund 3,8 KB aus. Der naechste Hebel ist das Initial-JS/Atlas, nicht das HUD. Die Messung auf einem echten Android-Geraet bleibt offen.

## 2026-11-06 - Phase-6-Abnahmeplan gegen den sichtbaren Stand

**Ziel.** Der alte Abschnitt in `docs/PLAN-OPTIK-VISUELL.md` beschrieb Phase 5 als gerade umgesetzt und liess Phase 6 als blosses Exit-Kriterium stehen. Nach dem Floor-Fix sollte der Plan den tatsaechlich sichtbaren Stand aufnehmen und die Abnahme pruefbar machen.

**Umsetzung.** Die Statuszeile und die Phasentabelle nennen Phase 6 jetzt als Abnahme; der Phase-5-Teil bleibt als Begruendung stehen. Der alte Abschnitt 6 ist durch einen Abnahmeplan ersetzt: Ausgangsbild der Desktop-Sichtpruefung (1024x768, Floor, HUD, Warnzeile, Toast, Kamera-FIT, `PUTZEN`, vier Tabs, Konsole nur Autoplay-Warnungen), Pruefmatrix A1-A8, Reihenfolge und Exit. A1 ist bestanden; A2-A8 decken Werkstatt-Einstieg, sechs Ziele, Spiegel, FPS, Touch, Huelle/Performance, Slow 4G, APK-Installation und Release ab. Die Matrix nennt bewusst den zentrierten FIT-Ausschnitt und die noch nicht geoeffnete Werkstatt statt einen gruenen Gesamteindruck.

**Pruefungen.** `pnpm run verify:quick` (zehn Gates) und `pnpm run verify:docs` sind vor dem Commit gruen; der Floor-Grundstand ist mit `artifacts/floor-aktuell.png` belegt.

**Offen.** A2-A8. Die Werkstatt, der Spiegel und die Touch-Pfade wurden noch nicht geoeffnet; 60 fps, Tap-to-Frame, Haptik und Slow 4G brauchen ein echtes Android-Geraet.

## 2026-11-06 - Typecheck repariert, Floor-Crash behoben, stale Fact-Verdrahtung entfernt

**Ziel.** Die offenen Befunde aus dem letzten Review schliessen: der Floor blieb nach dem Laden bei "LADEN DAUERT LANGE" stehen, `pnpm run typecheck` war gruen ohne `src/` zu pruefen, und die Doku sollte den echten Stand tragen, bevor PR #152 gemerged wird.

**Umsetzung.** Der Crash war ein fehlendes Feld, kein Pixi-Fehler: `SceneCache` deklarierte `dirt` nicht, `createSceneCache()` gab die gebaute `dirtLayer` nicht zurueck, und `floor-view.ts` uebergab deshalb `undefined` an `addChild`. Beides ist jetzt deklariert und verdrahtet. Der Typecheck hatte `"include": ["../src"]` in `src/Config/tsconfig.json`; relativ zur Config zeigte das auf `src/src`, also pruefte `tsc` praktisch nichts. `["..", "vite.config.ts"]` deckt `src/` und die Vite-Config ab. Danach wurden 87 echte Fehler sichtbar und behoben: Typ-Re-Exports (`Mop`, `Stain`, `Visitor`, `ActorRef`), optionale `memories`, `VaCoinMicro`-Casts an Geldgrenzen, `readonly unknown[]` in Trigger-Definitionen, `roleCount` im Template-Schema, `ViewRect` mit `left/top/right/bottom`, `GameView` statt `WorldState` in Floor-Eingabe/-Animation, `SPIEGEL` in der Bau-Tier-Zuordnung, Getter-Aufrufe des Layout-Verlaufs, nicht-null-gepruefte `find`-Ergebnisse und typisierte Test-Callbacks. `src/vite-env.d.ts` ist neu getrackt: `vite/client` plus `declare module '*.mjs'`, damit die Governance-Tests die Skript-Libs ohne `allowJs` importieren. Die beiden `VISITOR_SERVICE`-Emissionen in `serveDrinkCmd` und `talkCmd` sind entfernt: sie trugen `initiator`/`severity`, das Fact-Schema verlangt `service`/`valence`, und der einzige legitime Produzent ist `desk-service.ts` bei anwesendem Kassierer. Die Doppel-Emission war tote Verdrahtung, kein fehlendes Feld.

**Pruefungen.** `pnpm run typecheck` Exit 0 mit 0 Fehlern (vorher 87 nach der Include-Korrektur). `pnpm run verify:quick` mit allen zehn Gates gruen, inklusive Tests, Lint, Dead-Code, Doku, Tree, Redundanz, Assets, LOC und Test-Qualitaet. `pnpm run inventory:build` meldet 1324/1324 Dateien und 86 Ordner. Der Floor laedt im laufenden Dev-Server wieder: HUD, Gaeste und die vier Tabs sind da; der Screenshot liegt unter `artifacts/floor-aktuell.png`.

**Offen.** Die visuelle Abnahme bei 60 fps und Tap-to-Frame braucht ein echtes Touch-Geraet; im Cloud-Browser ist nur der Desktop-Pfad pruefbar. Die Issues #151/#153 gehoeren zu PR #150 und bleiben unberuehrt.

## 2026-11-06 - CI-Runner und Action-Runtimes

**Ziel.** Die zwei Annotationen aus PR #152 an der Ursache beheben: Actions, die noch Node 20 ansprechen, und der gleitende `ubuntu-latest`-Runner.

**Umsetzung.** Alle acht Workflows pinnen `ubuntu-24.04`. `checkout` steigt auf v7, `setup-node` auf v7, `cache` auf v6, `upload-artifact` auf v7, `setup-java` auf v6 und `setup-android` auf v4; `pnpm/action-setup@v6` bleibt. Die ausdrueckliche `platform-tools`-Angabe bleibt, weil sie den Android-Build unabhaengig von Action-Defaults festhaelt.

**Pruefungen.** Alle acht Workflow-Dateien werden mit PyYAML geparst. Der erste `verify:quick`-Lauf fand einen seed-abhaengigen FREE_DRINK-Test: Ein vom Generator beschaedigtes Geraet bricht vor dem Drink ab; das Fixture pinnt jetzt `damaged = false` und `condition = 100`. Der erste CI-Lauf zeigte danach die zweite Ursache: Bei leerem Hauskonto bucht `payOrBorrow` den Betriebsanteil als `mod betrieb auf kredit`, der Test verglich aber exakt auf `mod betrieb`. Er summiert jetzt beide Wege und prueft den exakten Mod-Betrag; 20 Seeds sind gruen. `verify:quick` wird vor dem Commit ausgefuehrt.

**Offen.** `ubuntu-24.04` ist der bewusst konservative Pin; die Migration auf 26.04 bleibt ein eigener Schritt mit Android- und Gradle-Test. Die zwei offenen `gate-failure`-Issues #151 und #153 gehoeren zu PR #150; dessen neuester Lauf auf `a4effb0` ist gruen, die Issues wurden nicht angefasst.

## 2026-11-06 - Phase 5/6: Werkstatt und Abschluss

**Ziel.** Das Werkstatt-Raster mit sechs Zielen, ein unsichtbarer Einstieg und der Charaktereditor als Spiegel im Lager.

**Umsetzung.** `workshop.tsx` haelt den einen Rahmen; `workshop-parts.tsx` traegt Rasterkarte, Steuerung und FPS. Die vier Popups exportieren ihre Inhalte als Panels ohne zweiten Shell. Der Einstieg zaehlt fuenf Tipps auf die Marke in `dock.tsx` und hoert auf `Strg+Shift+D`; ein sichtbarer Knopf existiert nicht. `SPIEGEL` ist ein neues `DECOR` in allen drei Blueprints und oeffnet den vorhandenen `LookPopup`; `WorkshopTool = 'look'` ist entfernt.

**Pruefungen.** `typecheck`, `lint`, `check:loc`, `verify:docs`, die Inventur (1323/1323) und `verify:all` (12/12 Gates) sind gruen. Der PR gegen `main` folgt.

**Offen.** Fuenf-Tipp-Geste und Spiegel sind nicht auf Hardware geprueft; die FPS-Karte misst den Browser-Frame-Takt, nicht die Pixi-Renderzeit. Der Spiegel wird prozedural gezeichnet, ohne eigenes Asset.

## 2026-11-06 - Phase 2: Betriebssimulation

**Ziel.** Die Kette Nachfrage -> Ankunft -> Fiat/Chips -> Spiel -> Auszahlung -> Kosten -> Ruf sollte als tatsaechlicher Betriebskreislauf wirken. Personas mussten Einsatz und Spielwahl unterscheiden, Mods ihre Beschreibung einloesen, der Slot-RTP zur Anzeige passen und Schulden einen Tilgungspfad bekommen.

**Umsetzung.** `personaStake` skaliert den Einsatz mit `budgetFactor`, Sucht und Wallet, begrenzt auf das Dreifache des Tisches. `guestTier` hebt bei VELVET die Persona-Stufe neuer Gaeste. FREE_DRINK verbraucht echten Barbestand und bucht den Betriebsanteil nur bei tatsaechlicher Lieferung; EXTRA_REEL erhoeht `item.reels` und verwirft das Slot-Gedaechtnis. `resolveModEffects` zaehlt doppelte Mod-Ids einmal. CASHOUT prueft `queueIndex`; `arrivalGap` verliert den 90-Tick-Deckel. `repayDebt` tilgt HAUS_SCHULDEN nur oberhalb von HOUSE_FLOAT. Die Slot-Entladung zahlt 1,00x statt 1,48x, damit der Pity-Puffer den RTP nicht gegen 100 % hebt.

**Pruefungen.** `pnpm run verify:quick` gruen (zehn Gates). `pnpm run balance` mit 40 Spieltagen, Seed 12345, gruen; Bericht unter `artifacts/balance-12345-40d.md`. Der fokussierte Slot-Test misst 60.000 Spins im Band 90-96 %. Der vollstaendige `verify:all`-Lauf ist mit allen zwoelf Gates gruen.

**Offen.** Einnahmen werden weiterhin nur als Gesamtsumme gefuehrt, nicht je Spieltyp. `PLAYER_CASH` hat weiterhin keinen Ausgabepfad. Die sichtbare Browser-Abnahme der neuen Geraeteaktionen bleibt offen. Keine Phase 3 begonnen.

## 2026-11-06 - Eigener Gastmodus an allen acht Automaten

**Ziel.** Der Betreiber soll sein eigenes Casino als Gast besuchen und alle acht Spiele mit seinem privaten PORTEMONNAIE spielen. Bisher war der eigene Automat nur Betreiberwerkzeug mit Testspin; Echtgeld-Runden liefen nur über fremde Häuser.

**Umsetzung.** `src/core/sim/own-play.ts` kapselt den eigenen Geldweg: Einsatz PORTEMONNAIE → HAUSKONTO, Gewinn HAUSKONTO → PORTEMONNAIE, ungedeckte Auszahlung über `openLiability(HAUS_SCHULDEN)`. SLOT nutzt `playSlotSession`, alle anderen Spiele `playAction`; Kartenrunden buchen den Einsatz beim Austeilen und zahlen erst beim Abrechnen. `store/own-play.ts` hält genau eine offene Kartenrunde je Gerät. `MachinePopup` schaltet Betreiber/Gast, `MachinePlay` reicht den vorhandenen `TableLauncher` weiter. Der Testspin bleibt ohne Ledger- und Gameplay-RNG-Wirkung.

**Pruefungen.** `pnpm run typecheck`, `pnpm run lint` und `pnpm run check:loc` grün. Core-, Store- und UI-Suiten sind angelegt; `pnpm run turn:finish:full` führt sie mit der vollständigen Suite aus.

**Bewusst nicht getan.** Keine Phase 2, keine zweite Spiel-Engine, keine Änderung am Fremdhaus-Geldweg und keine neue Save-Version. Die sichtbare Browser-Abnahme bleibt offen.

## 2026-11-06 - Task 5, Phase 2: Editor-UI, Pixi-Auswahl und Export/Import

**Ziel.** Den Command- und Verlaufskern aus Phase 1 bedienbar machen, ohne den Editor in Produktions- oder APK-Builds zu tragen.

**Umsetzung.** `layout-editor.tsx` bietet Werkzeug, Material, Kantenachse, Undo/Redo und Import/Export; `editor-tools.ts` baut Commands und erkennt Ctrl/Cmd+Z, Ctrl/Cmd+Y und Shift+Z. `editor-overlay.ts` zeichnet Zelle und Kante in Pixi, `FloorView` reicht nur den Cursor durch. Der Store exportiert über `layout-json.ts` und importiert fail-closed samt Rastergrößen-Prüfung gegen die Vorlage. Der Editor hängt an einem dynamischen Import mit `import.meta.env.DEV && VITE_RBD_EDITOR_MODE === '1'`; `?editor=1` öffnet ihn zusätzlich. Die Styles liegen in `layout-editor.css` und werden nur mit dem Lazy-Chunk geladen.

**Pruefungen.** `typecheck` grün. Produktionsbuild mit absichtlich gesetztem `VITE_RBD_EDITOR_MODE=1`: kein Editor-Chunk, keine Editor-Strings, keine Editor-CSS-Regeln in `dist/`; ohne Flag ebenso. Neue `editor-tools.test.ts` (5) und ein Produktionsfall in `editor-gate.test.ts`.

**Offen.** Der volle `verify:all`-Lauf bleibt der CI-Nachweis. Keine Änderung an Simulation, Ledger, RNG oder Save-Format; die Drink-Zahlungslogik bleibt unangetastet.

## 2026-11-06 - Task 5, Phase 1: Commands und Verlauf

**Ziel.** Der Editor braucht eine typisierte Schreibspur und einen begrenzten Verlauf, bevor eine Oberfläche entsteht. Beides musste in den bestehenden Store-Vertrag passen, ohne Simulation, Ledger, RNG oder Save anzufassen.

**Umsetzung.** `layout-commands.ts` modelliert `FLOOR` (Rechteck + Material) und `EDGES` (Zellen + Zustand). Jeder Command baut ein neues, eingefrorenes Layout und übergibt es `parseLayout()`; ungueltige Zwischenstände werden als `LayoutContractError` abgewiesen. Tür-IDs entstehen stabil aus der Kante, vorhandene IDs bleiben beim Übermalen. `layout-history.ts` hält `before`/`after`-Layouts, maximal 30 Schritte; `push` verwirft Redo, `undo`/`redo` tauschen nur Referenzen. `layout-editing.ts` gruppiert Pinselstriche: `begin` öffnet einen Schritt, `paint` schreibt ohne History-Eintrag, `end` schließt ihn. Der Store delegiert nur und ruft weiter `applyLayout()`; gespeichert wird pro Strich, nicht pro Tile.

**Pruefungen.** Neue Tests: 7 für Commands (Rechteck, Ablehnungen, Kante, stabile Tür-ID, Entfernen, letzte Tür, deterministische Bytes), 5 für den Verlauf (30er-Deckel, Undo/Redo, Redo-Verwurf, Strich als Schritt, No-op). `typecheck`, ESLint und LOC grün; `world-store.ts` bleibt mit 207 Zeilen unter seiner Grenze.

**Bewusst nicht getan.** Noch keine Editor-UI, keine Pixi-Auswahl und kein Tastatur-Shortcut; das ist Phase 2. Keine Änderung an `WorldState`, `applyLayout` oder Save v11.

## 2026-11-06 - Branch-Konsolidierung vor dem PR

**Ziel.** Alle ahead-Commits auf `main` bringen und `feat/spatial-layout-editor` als einzigen aktiven Arbeitsbranch lassen. Der offene PR #142 war konfliktbehaftet, `integration` trug fünf eigene Commits, und der Asset-Branch hatte zwei Commits über `main`.

**Umsetzung.** `main` (467f694) in den Branch gemergt, danach PR #142 (ea81b21), `integration` (046bff1) und `feat/asset-semantics-catalog` (7763b84). Die Codekonflikte in `grid-zones`, `guest-choice`, `pathfinding`, `player`, `staff`, `world`, `room-art` und dem Hot-Path-Bench folgen dem Layout-Vertrag (`NavGrid` + `layout.edges`); `walls.ts` und sein Test sind endgültig entfernt. Doku wurde zusammengeführt statt überschrieben: Changelog behält 0.3.125, 0.3.122 und 0.3.121, das Devtagebuch beide Stränge, das Narrative-Manifest alle drei Beiträge (65 Fragmente).

**Pruefungen.** `typecheck` nach jedem Merge, Inventar 1327/1327, Doku-Marker auf 0.3.127, `verify:quick` vor dem Push. Der volle Lauf inklusive Build und Audit bleibt CI.

**Bewusst nicht getan.** Keine inhaltliche Neuentwicklung, kein Force-Push auf geschützte Branches. PR #142 wird nicht separat gemergt, sondern ist über diesen Branch abgedeckt; `integration` wird nach dem Merge auf `main` gesetzt.

## 2026-11-06 - Task 5 vorbereitet: Layout-Dokument und Editor-Gate

**Ziel.** Task 5/5 braucht zwei Fundamente, die unabhaengig von der Editor-Oberflaeche pruefbar sind: ein versioniertes Layout-Dokument fuer Export/Import und eine Freigabe, die einen Produktionsbuild ausschliesst.

**Umsetzung.** `src/core/sim/layout-json.ts` schreibt `format: rbd-layout`, `version: 1` und ausschliesslich `size`, `floor`, `zones`, `edges` in fester Reihenfolge; der Import prueft Format, Version, fremde Felder und danach denselben `parseLayout()`-Vertrag wie ein Save. `src/ui/editor-gate.ts` oeffnet den Editor nur, wenn der Build `VITE_RBD_EDITOR_MODE=1` traegt **und** die URL `?editor=1` setzt; der Query-Parameter allein bleibt wirkungslos.

**Pruefungen.** Neue `layout-json.test.ts` (5 Tests): runde Reise, deterministische Bytes, fremdes Format/fremde Version/fremdes Feld, kaputtes JSON ohne Wurf, durchgereichte Layoutbefunde. Neue `editor-gate.test.ts` (3 Tests): Flag plus Parameter, Parameter ohne Flag, Flag ohne Parameter. `typecheck` gruen.

**Bewusst nicht getan.** Keine Editor-UI, kein Store-Command, kein Undo/Redo, kein Pinsel und keine PIXI-Anbindung; diese Schritte folgen in Task 5. Der Produktionsausschluss ist ueber das Gate vorbereitet, aber noch nicht am gebauten Bundle nachgewiesen.

## 2026-11-06 - Gemeinsame Tiefensortierung und Occlusion

**Ziel.** Task 4/5: Figuren, Möbel, Requisiten und Wände lagen in getrennten Containern und wurden nie gegeneinander sortiert. Ein Gast konnte vor einer Wand stehen, die ihn verdecken müsste, und große Möbel wurden optisch an ihrer Oberkante einsortiert.

**Umsetzung.** `depth.ts` ist der gemeinsame Vertrag: `footAnchor()` liefert die Unterkante, `depthFor()` kombiniert Anker, Typ-Rang und stabile ID, `DepthStage` sortiert nur bei echter Änderung. `scene-cache.ts` führt statt vier Objekt-Containern eine sortierbare Welt-Ebene; Zonenlabels liegen darüber, Sticker und Cues bleiben eigene Ebenen. `FloorProps` hängt Kisten, Streitmarker und Kasse in dieselbe Ebene; der Platzierungs-Geist bleibt Bedienoberfläche über der Welt. Möbel-/Figuren-Sync und Culling liegen jetzt in `entity-sync.ts`, weil `floor-view.ts` sonst über sein LOC-Budget gewachsen wäre (359 → 213 Zeilen). `WallOcclusion` erzeugt je Ausrichtung eine geteilte Textur und setzt pro Wandkante ein Sprite mit Anker an der Süd-/Ostkante; `wall-art.ts` zeichnet nur noch Türschwellen in den Chunk.

**Pruefungen.** `typecheck` und ESLint grün. Neue `depth.test.ts` (7 Tests): Fußanker, große Objekte, deterministisches Tie-Breaking, Wand vor/nach Figur, stabile Wand-IDs und Sortierung nur bei Änderung. Render-Suiten 47/47 grün. Messung auf derselben Szene: SMALL 0,062 ms, MEDIUM 0,028 ms, LARGE 0,081 ms je Neu-Sortierung.

**Bewusst nicht getan.** Keine Änderung an Simulation, RNG, Gästen oder Footprints; Render-Anker sind reine Ableitungen. Keine neue Asset-Registry, keine zweite Szene. Die Sortierung nutzt die vorhandenen Wandtexturen aus dem Manifest.

## 2026-11-06 - Bodenmaterialien und Wände aus dem Layout

**Ziel.** Task 3/5: Der Floor sollte den gespeicherten Plan zeigen, nicht eine zweite, zonengefärbte Wahrheit. Bodenmaterial pro Tile, Wandkanten, Türen und Ecken mussten aus dem Layout kommen, ohne die Chunk-Caches, den Atlas und den First-Frame-Handshake zu verlassen.

**Umsetzung.** `floor-material.ts` ist die einzige Materialauflösung: `FLOOR_ART` je `FloorMaterialId`, `floorTextureKey()` nur für Materialien mit echter Manifest-Textur, `FLOOR_FALLBACK_IDS` mit stabilen IDs für den prozeduralen Weg. Die fehlerhafte Musterzuordnung in `floor-surface.ts` (`FLOOR_TEXTURE`/`floorTextureFor`) ist entfernt; `drawPattern()` zeichnet nur noch Muster. `floorRuns()` bündelt gleiche Materialien zeilenweise, damit der Chunk wenige Füllungen braucht. CARPET bekommt ein maskiertes TilingSprite je Chunk, alle anderen Materialien bleiben prozedural. `wall-art.ts` besitzt die Besitzregel der Kanten (H → Südkachel, V → Ostkachel), Band, Vorderseite, Türpfosten und Schwellen; `room-art.ts` orchestriert nur noch Boden, Zonenlicht/-ausstattung und Wände. `floor-math.ts` hasht Boden und Kanten pro Chunk über eine WeakMap je Layout-Identität; damit backt eine Tile-Änderung genau einen Chunk neu.

**Pruefungen.** `typecheck`, ESLint, LOC und Dead-Export grün. Neue `floor-layout.test.ts` (12 Tests) deckt Materialauflösung, stabile Fallback-IDs, fehlende Texturen, Tile-Läufe, Wandband/-vorderseite, Randkanten, Tür/Durchgang und chunk-genaue Invalidierung ab. Alle 9 Render-Testdateien (40 Tests) grün. Vergleichsmessung derselben LARGE-Szene (9 Chunks, 90×90): hash 0,049 → 0,077 ms, Boden 6,93 → 9,19 ms je Vollback, Dreck 1,65 → 1,35 ms, Culling unverändert; der Bodenaufbau läuft nur bei Invalidierung, nicht pro Frame.

**Bewusst nicht getan.** Kein Editor, keine Occlusion-Schicht, keine zweite Texturauflösung, keine neuen Assets. Die Wandvorderseite liegt als reine Funktion (`wallFaceRect`) bereit; Task 4 sortiert danach und verdeckt damit Figuren.

## 2026-11-06 - Wände, Türen und Kanten-Navigation

**Ziel.** Task 2/5: Waende, Tueren und Oeffnungen sollten echte raeumliche Bedeutung bekommen. Bisher blockierte `blockedTiles()` Moebel und den ganzen Rand, waehrend Wandkanten aus dem Layout gar nicht in die Navigation eingingen; `approachPoint()` lieferte genau einen Zugangspunkt, und die Platzierung kannte weder Tueren noch versiegelte Serviceobjekte.

**Umsetzung.** `nav-grid.ts` baut ein `NavGrid` aus belegten Moebel-Tiles und den Wandkanten des Layouts. Nur `WALL` landet in `walls`; `DOOR` und `OPENING` fehlen dort und sind damit passierbar. Der Rand ist keine Tile-Sperre mehr, sondern die Randkante des Layouts. `pathfinding.ts` prueft jeden Schritt ueber `stepOpen()` und behandelt ein Tile nur noch als betretbar, wenn es im Raster liegt und kein Moebel traegt. `accessPointsFor()` sammelt alle freien Perimeter-Tiles mit offener Kante zum Footprint; `interactionPoint()` waehlt daraus nach Slot, `seatPoint()` verteilt Sitze, und `approachPoint()` bleibt als alter Fallback erhalten. `nav-reach.ts` flutet ueber offene Kanten und meldet Serviceobjekte ohne erreichbaren Zugang; `canPlaceAt()` weist Tuer-Tiles ab und verhindert, dass eine Platzierung einen zuvor erreichbaren Service abschneidet. `startActivity` gibt eine Reservierung zurueck, wenn der Weg zum Ziel leer bleibt, statt den Gast in eine Wand laufen zu lassen. Der Cache haengt an `size`, Möbelstruktur und Layout-Identitaet.

**Pruefungen.** `typecheck` gruen. Neue `nav-edges.test.ts` (10 Tests) deckt alle vier Wandrichtungen, geschlossenen und erreichbaren Raum, Tuer und Durchgang, Cache-Invalidierung, mehrere Zugaenge samt Fallback, Service-Schutz, Tuer-Tile-Platzierung sowie Spieler-, Gast- und Staff-Navigation ab. `pathfinding.test.ts` auf `NavGrid` umgestellt; Sim- und Store-Suiten gruen (474 Tests, 6 uebersprungen).

**Bewusst nicht getan.** Keine Rendering-, Wirtschafts-, Ledger-, Narrativ- oder RNG-Aenderung, keine neue Pathfinding-Engine. Der Editor und die visuelle Wanddarstellung bleiben Task 3/5; die Navigation ist die Wahrheit, die er spaeter bedienen muss.

## 2026-11-06 - Spatial Layout Contract und Save v11

**Ziel.** Task 1/5: Waende, Tueren und Zonen brauchen eine gemeinsame, ortsunabhaengige Wahrheit, bevor Navigation und Editor darauf aufsetzen. Bestehende Saves mussten ohne Datenverlust weiterlaufen, ungueltige Plaene durften nicht halb in die Welt kommen.

**Ausgangsstand.** Der Auftrag nannte `c460abb` (0.3.120); `origin/main` stand bei `9655a75` (0.3.97) und ist ein Vorfahre davon. Der Branch `feat/spatial-layout-editor` setzt deshalb auf `c460abb` auf; der Save-/Layout-Code ist in beiden Staenden identisch.

**Umsetzung.** Der Vertrag liegt in vier kleinen Core-Dateien: `layout-types.ts` (Typen und erlaubte Werte), `layout-edges.ts` (Kantenanker, Grenzen, kanonische Sortierung, `freezeLayout`), `layout-validate.ts` (fail-closed Parser) und `layout-derive.ts` (Vorlage, Boden, Legacy-Sicht, Ausbau). `layout.ts` ist der einzige Schreibpfad: `applyLayout()` setzt `world.layout` und zieht `size`/`zones` nach. `WorldState.layout` und `GameView.layout` tragen denselben unveraenderlichen Plan; Zonen sind nur noch Rechtecke, die Bodenoptik steht getrennt in `floor`, und Moebelwerte wie Stock, Zustand, Belegung, Mods und Besitz bleiben in `Furniture`. Jede Kante ist ueber Achse und Ankerpunkt eindeutig, `kind` ist ihr einziger Zustand; eine Wand mit Tuer-ID, doppelte Kanten und Tueren ohne ID werden abgewiesen. Die Eingangstuer sitzt auf der Kante, auf der `doorPoint()` den Gast absetzt. Ausbau behaelt alte Tiles und Tueren, entfernt die alte Aussenwand und laesst neue Flaechen ihre Zone erben. Save v11 (`vcoin.casino.v11`) speichert den Plan; `migrate-layout.ts` liest v11 fail-closed (inklusive Groessenabgleich mit dem Template) und leitet v5–v10 deterministisch aus der Vorlage ab.

**Verbraucher.** `world.size`/`world.zones` werden in Simulation (`world.ts`, `staff.ts`, `deliveries.ts`, `guest-choice.ts`, `queue-spots.ts`, `expansions.ts`), Renderer (`room-art.ts`, `scene-cache.ts`, `floor-carpet.ts`, `floor-route.ts`, `floor-view.ts`) sowie Snapshot und UI gelesen. Sie bleiben als abgeleitete Sicht bestehen, damit weder Rendering noch Spielverhalten sich aendern; `expansions.ts` schreibt sie nicht mehr direkt.

**Pruefungen.** `pnpm run typecheck`, `pnpm run check:loc`, `verify-test-quality` und `verify-tree` sind gruen. `vitest run src/core/sim/__tests__/layout-contract.test.ts src/store/__tests__/save-layout.test.ts`: 21/21 gruen. Sie decken alle drei Vorlagen, die vier Randrichtungen, die Eingangstuer, ein Bodenmaterial pro Tile, Ausbau, doppelte und widerspruechliche Kanten, unbekannte Materialien und Groessen, doppelte Zonen, unaufloesbare Zonenreferenzen, fehlenden Durchgang, Roundtrip v11, v5–v10-Migration, Ledger/PRNG/Narrative nach Replay und die Ablehnung manipulierter Importe ab.

**Bewusst nicht getan.** Kein Rendering, keine neue Pathfinding-Engine, keine Wirtschafts-, Ledger-, Narrativ- oder RNG-Aenderung. Die Navigation ignoriert Waende noch und blockiert wie bisher Rand-Tiles; Task 2/5 stellt A* auf passierbare Zellkanten um.

**Offen.** Ein Innenraum ohne Tuer laesst sich im Vertrag nur als Ganzes ablehnen, nicht pro Zone; die Erreichbarkeitspruefung folgt mit Task 2. `foreignFloors` (Rivalenflaechen) bleiben ausserhalb des Layout-Vertrags.

## 2026-11-06 - Asset-Semantik: Bestandsaufnahme und Metadatenvertrag

**Ziel.** Vor jeder Runtime-Arbeit klaeren, welche visuellen Assets es gibt, welche davon der Floor wirklich benutzt und welche Semantik ein Asset traegt. Der Katalog soll die Rolle beschreiben, ohne eine zweite Asset-Registry oder eine neue Pfadquelle zu werden.

**Umsetzung.** `src/render/assets/asset-semantics.json` mit einem Eintrag je Manifest-Referenz: 539 Bilder plus 3 Animationen, 4 Emitter und 6 Tonspuren. Die Rollen stammen nicht aus Dateinamen, sondern aus den vorhandenen Zuordnungen im Code: `MACHINE_TEXTURE`/`KIND_TEXTURE`/`DECOR_TEXTURE` in `furniture-atlas.ts`, `DRESSING` in `room-dressing.ts`, `FLOOR_TEXTURE` in `floor-surface.ts`, `WALLPAPER` in `room-art.ts`, die Kopf-Listen in `guest-parts.ts` und `pixel-head.ts`, `PEG_TEXTURE`/`payoutArt` in `plinko-assets.ts`, `UI_ICON`/`GAME_ICON` in `icons.ts`, dazu `RUNTIME_ART`, `popup.css`, `slot-fx.ts`, `emitter.ts` und `music.ts`. Sichtbare Bounds kommen ausschliesslich aus den Atlasseiten; wo keine Seite existiert, steht `unknown`. Der Vertrag (Typen, Pflichtfelder, Enums, neun Layer) steht in `docs/ASSET-SEMANTICS.md`.

**Befunde.** Interaktivitaet ist bei keinem Asset belegbar: Klicks haengen an Simulationsobjekten, nicht an Texturen, deshalb bleibt der Typ `interactive` leer und das Feld ueberall `unknown`. 444 Bilder haben keinen Code-Bezug. 23 Referenzen tragen mehrere Rollen (Kopf als Gast und Dealer, Maschine als Korpus und HUD-Icon, Damast als Boden, Wand und Popup-Hintergrund). Die Deko-Zuordnung laeuft ueber 17 Label-Regexe und ist damit an Anzeigetext gebunden. Walzensymbole sind ID-gebunden und ueber den Pfad nicht auffindbar.

**Pruefungen.** `node scripts/verify-docs.mjs` gruen; `pnpm run verify:quick` gruen in allen Gates. Der Katalog selbst hat kein Gate — er ist Dokumentation mit Datenform, kein Build-Artefakt.

**Offen.** Deko-Rollen von Label-Regexen loesen; entscheiden, ob der Katalog spaeter von einem Gate gegen das Manifest geprueft wird. Beides ist bewusst nicht Teil dieses Tasks.

## 2026-11-06 - Merge mit main (0.3.120) und Review-Abgleich

**Ziel.** Den reparierten Arbeitsbranch auf den inzwischen weitergelaufenen `main`-Stand heben, ohne die Wandkollision oder die Inventur-Reparatur zu verlieren.

**Umsetzung.** `main` (c460abb, 0.3.120) in den Arbeitsbranch gemerged. Neun Konflikte: Doku-Marker, `package.json`/`pnpm-lock.yaml` und `src/render/furniture-art.ts`. Doku und Version folgen `main` (0.3.120 -> 0.3.121 fuer diesen Merge), weil der Huelle-Stand die neuere Wahrheit ist; `furniture-art.ts` kommt komplett aus `main`, weil der Atlas die Backdrop-Sprite-Logik ersetzt hat. Danach Inventur neu gebaut, Marker gesetzt, `verify:quick` gefahren.

**Review-Abgleich nach dem Merge.** Drei Befunde aus dem Review sind mit dem Huelle-Stand ueberholt und damit geschlossen: Boden-Texturen haengen jetzt an der Chunk-`deco`-Ebene, die beim Neubacken geleert wird (`scene-cache.ts`); das Partikel-Overlay ist geloescht und `floor-events.ts` abonniert alle acht Ereignisse; die Maschinen-Textur deckt kein Label mehr, weil der Atlas den Sprite ersetzt. Offen bleiben: die Reiniger-Zielauswahl (`cleanerTick` nimmt immer die erste Kachel), `chooseSpot` ohne Spezifikation und die Prozess-Drift (fehlender Content-Beitrag fuer den Turn 2026-11-06, Changelog-Eintrag der Wandkollision unter `[0.3.114]`).

**Pruefungen.** `node scripts/verify-docs.mjs` gruen; `pnpm run verify:quick` gruen in allen zehn Gates auf dem gemergten Baum (Wandkollision plus Huelle zusammen).

**Offen.** Die drei genannten Befunde; `pnpm run hooks:install` ist in diesem Klon weiterhin nicht aktiv.

## 2026-11-06 - Doku-Gate repariert: Inventur wird wieder mitgestagt

**Ziel.** Das offene `gate-failure`-Issue #139 schliessen: `CI Verify` war rot mit `[ERR-4017] verify:docs: docs/INVENTORY.md: Abdeckungszahl 1257 passt nicht zu 1259 getrackten Dateien`. Die Ursache lag nicht in `walls.ts`, sondern im Zusammenspiel von Hook und Commit.

**Umsetzung.**
- `docs/INVENTORY.md` mit `node scripts/build-inventory.mjs` neu erzeugt; die im Turn zuvor neuen Pfade (`src/core/sim/walls.ts`, `src/core/sim/__tests__/walls.test.ts`) stehen wieder im Block.
- `.githooks/pre-commit` stagt die Inventur direkt nach dem Generator. Der Hook schrieb das Artefakt bisher nur in den Arbeitsbaum; gestagt wurde eine Liste, die den neuen Commit noch nicht kannte. Damit war der naechste Lauf zwangslaeufig rot.

**Pruefungen.** `node scripts/verify-docs.mjs` gruen (vorher drei Befunde). `pnpm run verify:quick` gruen in allen zehn Gates; vor der Reparatur war `docs` das einzige rote Gate.

**Offen.** Der Changelog-Eintrag zur Wandkollision stand unter `[0.3.114]`, waehrend `package.json` bereits 0.3.115 trug — der Versionsdrift bleibt als Befund stehen.



**Ziel.** Die Optik auf einem schwachen Androiden tragen, ohne sie zurueckzudrehen: die 153 Pixel-Frames in wenige Requests packen, die Last in drei Stufen regeln, den Loader an den ersten echten Renderer-Frame binden und eine installierbare APK bauen. Der 4G-Pruefpfad soll unter drei Sekunden und bei hoechstens 20 Requests liegen.

**Umsetzung.**
- `src/render/assets/atlas.ts`: `shelfPack` sortiert Hoehe, Breite und Pfad; der Produktionspfad laedt die zwei Seiten aus `manifest.atlas.pages` und registriert die Frames als Ausschnitte. Fehlt eine Seite, packt der Laufzeitpfad die vier Ordner weiterhin selbst; `textures.ts` faellt danach auf die Einzeldatei zurueck.
- `scripts/lib/atlas-png.mjs`: eigener PNG-Codec (8-Bit-RGBA, Unfilter, CRC, zlib) ohne neue Abhaengigkeit. `scripts/build-asset-manifest.mjs` schreibt zwei deterministische 1024er-Seiten (Padding 0, 46 + 107 Frames) und die Koordinaten ins Manifest; `verify-assets.mjs` prueft Seiten, Grenzen, Abdeckung und Sortierung.
- `src/render/perf-governor.ts`: reine Hysterese aus `deltaMS`, Wechsel erst nach 2.000 ms. `floor-stage.tsx` setzt daraus DPR, `ticker.maxFPS`, Partikel- und Lichtbudget; der erste Frame wird explizit gerendert, bevor `onFirstFrame` den Loader ausblendet.
- `src/main.tsx`: wartet nur auf die Atlasseiten. Symbole, Plinko und Partikel folgen nach dem ersten Frame im Leerlauf. `music.ts` laedt erst nach einer Geste; der stille Vorlauf erzeugte sonst drei Audio-Requests und 650 KB konkurrierend mit dem ersten Frame.
- Mobile Huelle: `index.html` mit `viewport-fit=cover`, `tokens.css` mit `--safe-*`, `app.css` mit Safe-Area-Padding und Hochformat-Hinweis, `capacitor.config.json` mit `android.orientation: portrait`; `prepare-android.mjs` pinnt zusaetzlich `screenOrientation=portrait` im generierten Manifest.
- `src/render/haptics.ts`: `navigator.vibrate(8)` beim Zeigerdruck, `[12, 40, 18]` beim Jackpot, aus bei `prefers-reduced-motion`. Keine neue Abhaengigkeit.

**Pruefungen.** `pnpm run assets:manifest`, `pnpm run verify:assets` (555 Referenzen, 15,6 MB), `pnpm run typecheck`, `pnpm run build` und `pnpm run check:loc` gruen. Browser-Messung gegen den Cloud-Preview mit kaltem Cache, 9 Mbit/s und 70 ms RTT: 20 Netzwerk-Requests, 2,51 s bis zum ersten Frame, 1,54 MB Transfer, keine Konsolen- oder Netzwerkfehler; Screenshot `artifacts/phase4-floor.png`.
`pnpm run android:apk` baute mit JDK 21, SDK 36 und Build-Tools 36 erfolgreich `artifacts/rigged-by-design-debug.apk` (21 MB). `apksigner verify` bestaetigt die v2-Debug-Signatur; `aapt2 dump badging` nennt `de.riggedbydesign.casino`, `targetSdkVersion 36`; `aapt2 dump xmltree` bestaetigt `screenOrientation=1` (portrait).

**Offen.**
- Der gemessene 4G-Pfad ist 9 Mbit/s. Slow 4G mit 1,6 Mbit/s wurde nicht separat gemessen und wuerde wegen des 1,5-MB-Bundles nicht unter drei Sekunden bleiben; die Zielzahl gilt fuer das dokumentierte Profil.
- Kein echtes 200-Euro-Geraet und kein `adb`: die APK ist signiert und manifestgeprueft, aber nicht auf Hardware installiert. Der Governor und die Haptik sind auf dem Geraet ungeprueft.
- Die zwei HUD-Icons (`ui/coin.png`, `ui/guest-cyan.png`) sind noch eigene Requests; sie bleiben innerhalb der 20, sind aber der naechste offensichtliche Inline-Kandidat.
- Offene `gate-failure`-Issues aus frueheren PRs bleiben ausserhalb dieses Slice.

## 2026-11-05 - Geld fühlt sich an

**Ziel.** Geld und Streit sollen auf dem Boden ankommen: ein Jackpot muss platzen, eine Auszahlung an der Kasse klingeln, ein Streit rauchen, und die Laune braucht ein Gesicht statt einer Zahl. Kein Ton ohne sichtbares Pendant.

**Umsetzung.**
- `floor-events.ts`: eine Subscription auf `core/sim/events`, acht Zeilen mit Burst, Ton, Licht, Shake und Anker. Anker kommen aus `itemId` (Moebelmitte), `guestId`/`guestIds[0]` (Gastfuss), sonst aus `x`/`y` oder der Spielfigur.
- `fx/floor-fx.ts`: nur noch Darstellung mit `burst`, `flash` und `shake`; Licht aus einem Pool von hoechstens acht Graphics, Start im naechsten Frame, kein `performance.now` ausserhalb der erlaubten Pacing-Dateien.
- `fx/emitter.ts`: `smoke-puff` nutzt die vorhandenen Animationsframes, `activeEmitterCount()` zaehlt Emitter mit sichtbaren Partikeln fuer die Werkstatt.
- `floor-cash.ts`: Chip-Stapel am EXCHANGE (1–6, je 5 VC), warmes Pulslicht, Klingeln nur bei neuem Tick und geradem Tick; `floor-props` synchronisiert Bestand und Position im Snapshot und pulsiert im Frame.
- `comic-bubbles.ts`/`guest-art.ts`: `createComicSticker` zeigt bei `mood < 40` die Sprechblase „Hier stimmt was nicht“ statt der Emotionsblase.
- `popup-shell`/`games-popup`: `data-game` am Rahmen und am Table-Stage; `tokens.css` traegt Neon-Rot, Samt-Violett und Cyan als reine CSS-Variablen, ohne Layout-Umbau.

**Pruefungen.** `pnpm run typecheck`, `pnpm run lint`, `pnpm run check:loc`, `pnpm run verify:quick` (10 Gates) und `pnpm run bench:lowend` gruen. LOC: floor-view 350/350, guest-art 346/350, floor-props 222/260, floor-events 128/260, floor-cash 68/260, emitter 168/260, comic-bubbles 127/260.
Bench (ein Lauf, Low-End-Profil auf einen Kern gepinnt): hash 0,0827 / boden 7,2550 / dreck 2,2023 / cull 0,0361 ms. Die Werte schwanken wie zuvor; ein A/B gegen 0,3.118 wurde nicht im selben Lauf erhoben.

**Offen.**
- Kein Browser und kein Geraet in dieser Umgebung: Jackpot-Burst, Gold-Flash, 6-px-Shake, Klingeln, LED-Puls und die drei Spielfarben sind nur durch Code und CSS belegt, nicht gesehen oder gehoert.
- 60 fps beim Jackpot mit neun Gaesten bleiben ungemessen; `bench:lowend` misst nur Boden, Culling und Snapshots.
- Das Werkstatt-HUD zeigt `activeEmitterCount()`; dass bei einem echten Jackpot mindestens 1 erscheint, ist nicht interaktiv geprueft. Der Zaehler zaehlt Emitter, nicht Partikel, und faellt nach 0,85–1,5 s auf 0 zurueck.

## 2026-11-05 - Touch zuerst, Antwort in einem Frame

**Ziel.** Der Daumen soll ohne Hover ein Ziel sehen, ein Tipp soll laufen statt ein Menue zu oeffnen, und die Antwort auf den Tipp soll im naechsten Frame stehen.

**Umsetzung.**
- `floor-touch.ts`: Ein Finger schwenkt ab 8 px, aber nur bei `pointerType !== 'mouse'`; der Tipp wird erst bei `pointerup` ausgeloest, wenn die Schwelle nie erreicht wurde. Zwei Finger bleiben Pinch, Rechtsklick bleibt Desktop.
- `floor-input.ts`: `handleTap` nimmt `button` und den Punkt und gibt `TapHit | null` zurueck; `onActions(actions)` ersetzt `onOpenMenu(actions, x, y)`. `screenPoint()` rechnet Bildschirmpixel in Kamera-Koordinaten, damit Touch und Maus denselben Pfad nehmen.
- `floor-cues.ts`: Zielraster schon bei `pointerdown`, 500 ms Nachleuchten; der Ping besteht aus drei gebackenen Ring-Sprites, die skaliert werden.
- `src/ui/action-card.tsx`: eine grosse Empfehlung, zwei Alternativen, ein X, unten in der Daumenzone; die Aktionen kommen unveraendert aus `floor-actions.ts`.
- `guest-art.ts`: `bump()` (Squash 90 ms) und `tapRing()`; `furniture-atlas.ts` backt einen Glow-Ring, `furniture-art.ts` blendet ihn bei Druck 120 ms auf alpha 0.5.
- `fx/emitter.ts`: Pool mit 200 Sprites, `acquire`/`release`, `textureFor` einmal je Burst, kein `destroy` im Frame. `fx/floor-fx.ts` haengt am Kamera-Container und rechnet in Weltkoordinaten; Shake verschiebt die Kamera.
- Geloescht: `radial-menu.ts`, `character-view.ts`, `particle-overlay.tsx`.

**Pruefungen.** `pnpm run typecheck`, `pnpm run lint`, `pnpm run check:loc`, `pnpm run verify:quick` (10 Gates, 730 Tests) und `pnpm run bench:lowend` gruen. `rg "setInterval" src/render` findet nur noch `music.ts`. LOC: floor-view 349/350, guest-art 350/350, floor-cues 222/260, floor-input 75/260, floor-stage 95/260, fx/floor-fx 90/260, fx/emitter 141/260, action-card 44/200.
Bench (ein Lauf, Low-End-Profil auf einen Kern gepinnt): hash 0,0821 / boden 6,5885 / dreck 2,0980 / cull 0,0376 ms. Die Werte schwanken wie zuvor; ein A/B gegen 0,3.117 wurde nicht im selben Lauf erhoben.

**Offen.**
- 60 fps beim Jackpot mit neun Gaesten und Tap-zu-Bild in einem Frame sind hier nicht messbar: kein Browser, kein Geraet. Die Abnahme braucht ein echtes Touch-Geraet.
- Der Pool deckelt bei 200 Partikeln; ob das bei neun Gaesten reicht, entscheidet die Geraetemessung.
- Die Aktionskarte ist mit Maus und Tastatur nicht separat getestet; sie ist ein reines DOM-Element mit Fokusring.

## 2026-11-05 - Buehne: Atlas, Tapete und Tageszeit

**Ziel.** Kein Farbquadrat mehr: der Korpus jeder Bauart kommt aus einer geteilten Textur, Raeume bekommen Tapete und drei Requisiten, und das Licht hat eine Tageszeit.

**Umsetzung.**
- `src/render/furniture-atlas.ts`: `atlasTextureFor(renderer, item, tile)` backt Lichtinsel, Schatten und Korpus einmal je Bauart, Variante und Groesse (`${gameId|kind}:${w}x${h}`). Instanzen haengen nur ein Sprite an den Root; LOD-0 zeigt dasselbe Sprite mit alpha 0.85 und ohne Text, Screen und Status.
- `src/render/floor-surface.ts`: `addTiling` legt Boden und Tapete als TilingSprite mit `tileScale 2` in die Deco-Ebene des Chunks, statt sie zu strecken. `drawSurface` nimmt `LightState` entgegen.
- `src/render/room-art.ts`: Waende tragen Tapete als Kachel und eine 2-px-Kontur in `STROKE.base`, dunkler als der Inhalt; Durchgaenge bleiben 6-px-Schwellen.
- `src/render/room-dressing.ts`: je Zone drei Requisiten aus dem Paket, deterministisch aus dem Zonenrechteck (Bar: Regal, Hocker, Neonschild; Kasse: Registrierkasse, Terminal, Wandleuchte; Saal: Saeule, Palme, Neonpilaster; Lager: Regal, Leuchte, Beistelltisch).
- `src/core/sim/day-phase.ts`: `dayPhaseOf(tick)` schneidet den Tag in drei gleiche Abschnitte. `buildView` liefert `dayPhase`; `scene-cache` nimmt die Phase in den Chunk-Schluessel, ein Wechsel backt 9 Chunks einmal neu.
- `src/render/art-tokens.ts`: `lightFor(zone, phase)` liefert Tint und Dosis; die drei Lichtrollen bleiben warm, cool und neon.
- Nur der naechste Gast (kleinste ID) traegt ein Namensschild; der Schatten aller Figuren ist eine gebackene Ellipse aus `guest-parts.ts`.

**Pruefungen.** `pnpm run typecheck`, `pnpm run lint`, `node scripts/check-loc.mjs` und `pnpm run verify:quick` gruen (10 Gates, 730 Tests). LOC: furniture-atlas 193/260, floor-surface 178/260, scene-cache 177/260, room-dressing 109/260, room-art 206/260, guest-art 326/350, floor-view 327/350.
`pnpm run bench:lowend`, Baseline vor dem Umbau (5a080fb): hash 0,033 / boden 5,94 / dreck 1,49 / cull 0,036 ms. Danach drei Laeufe: boden 7,42 / 7,53 / 6,37, dreck 2,57 / 2,25 / 2,12, cull 0,035-0,054. Der Dreck-Pfad wurde nicht angefasst und stieg trotzdem um 45-70 Prozent: die Maschine driftet zwischen den Laeufen. Damit ist weder eine Regression noch Paritaet bewiesen.

**Offen.**
- Sauberer A/B-Nachweis fehlt; dafuer muesste die Baseline auf derselben Maschine im selben Lauf erhoben werden.
- Die Texturanzahl im Werkstatt-HUD ist ein Momentwert beim Oeffnen, kein Live-Zaehler.
- Es gibt nur eine Tapeten- und eine Bodentextur im Manifest; die uebrigen Muster bleiben gezeichnet.
- Fuer den Lager-Spiegel gibt es kein Asset; dort steht eine Wandleuchte.
- `floor-view.ts` und `guest-art.ts` liegen weiter in der Legacy-Hot-Zone (ueber 200); der naechste Schritt waere, Kamera/Culling und Rig zu trennen.

## 2026-11-05 - Popup-Blur raus: Verlauf statt Vollbild-Filter

**Ziel.** Die zwei GPU-Kosten im Popup-Layer entfernen, ohne die Optik zu verschieben: kein `backdrop-filter` ueber dem ganzen Bildschirm, keine animierte Unschaerfe in den Walzen.

**Umsetzung.**
- `.popup-backdrop` verliert `backdrop-filter: blur(7px)`. Der Hintergrund ist jetzt ein radialer Verlauf (`rgba(4,2,9,0.6)` in der Mitte, `rgba(4,2,9,0.88)` am Rand) ueber `rgba(4,2,9,0.74)`: Mitte heller, Rand dunkler, das Panel hebt sich weiter ab.
- Derselbe Block bekommt `contain: paint`; der Browser behandelt den Backdrop damit als eigenen Malbereich und muss Nachbarn nicht mitpruefen.
- `@keyframes reel-roll` animiert nur noch `transform: translateY` und `opacity`. Das Zwischenbild der Walze ist ein Compositor-Schritt statt einer Filter-Neuberechnung pro Frame.

**Pruefungen.** `pnpm run typecheck`, `pnpm run lint`, `pnpm run verify:quick` mit Bericht, `pnpm run build`. Reine CSS-Aenderung: keine Spielmechanik, kein Ledger, kein RNG, kein Save-Format.

**Offen.** Eine Klasse `.popup-scrim` gibt es nicht - der Backdrop heisst `.popup-backdrop`; `contain: paint` sitzt deshalb dort. Die Vignette auf `.stage-wrap` (`inset 0 0 120px`) bleibt und gehoert zur Lichtarbeit in Phase 1.

## 2026-11-05 - Dock statt Werkzeugwand: HUD, Router und Werkstatt

**Ziel.** Phase 0 des 6-Phasen-Plans: aus dem Instrumentenbrett wird eine App mit drei Kennzahlen oben und vier Bereichen unten. Kein neues Asset, keine neue Mechanik.

**Umsetzung.**
- `src/App.tsx` 348 -> 203 Zeilen: Popup-Routing nach `src/ui/popup-router.tsx` (145), Tastenpfad nach `src/ui/use-stage-keys.ts` (48), Dock in `src/ui/dock.tsx` (59), Werkstatt in `src/ui/workshop.tsx` (60).
- `src/ui/hud.tsx` 176 -> 113: Marke, Tag, Hauskonto/Portemonnaie/Kasse, Gaeste und Ruf. Ruf als Farbe und Wort, die Zahl bleibt im `title`; Skill-Punkte nur wenn offen; Balken-Leerstand und Ledger-Fehler sind Warnzeilen, keine Kacheln.
- Elf HUD-Knoepfe entfernt. `GAESTE` gab es doppelt, `FREMDES CASINO` liegt unter `KARTE`, `UEBERSICHT` ist der FIT-Knopf, `PUTZEN` erscheint kontextuell im Dock mit Anzahl und Preis.
- `Popup`-Union: `journal|diagnostics|look|assets|sound|help` werden zu `{ kind: 'workshop'; tool?: WorkshopTool }`. Die Werkstatt oeffnet die vorhandenen Fenster unveraendert; kein zweiter Zustand, keine Kopie.
- Tasten-Legende aus `src/ui/stage-controls.tsx` entfernt. WASD/Enter/Rad wirken weiter, stehen aber nicht mehr im Bild.

**Pruefungen.** `pnpm run typecheck` gruen; `pnpm run lint` gruen; `node scripts/check-loc.mjs` gruen (App 203/350, hud 113/200, popup-router 145/200, dock 59/200, workshop 60/200, use-stage-keys 48/200); `pnpm run verify:quick` mit Bericht. Keine Spielmechanik, kein Ledger, kein RNG und kein Save-Format angefasst.

**Offen.**
- `.hud-actions`, `.stage-legend` und die alten `.vital`-Varianten stehen noch als tote CSS-Regeln in `src/styles/app.css`; Phase 5 raeumt sie mit dem Werkstatt-Umbau ab.
- `popup.css` traegt weiter `backdrop-filter: blur(7px)` und eine animierte `filter: blur`-Keyframe. Beides gehoert in Phase 0 des Plans, wurde hier aber bewusst nicht mitgeaendert, damit der Umbau nicht gleichzeitig die Optik verschiebt.
- Fuer T59 gibt es keinen Content-Beitrag: reine UI-Arbeit ohne narrativen Text.
- Die Werkstatt ist ein Raster mit sieben Zielen, kein fertiger Debug-Bildschirm; Phase 5 baut ihn aus.

## 2026-11-04 - Phase 1: Eintrag & Ladeerfahrung (Optik)

**Ziel.** Der Nutzer sieht beim Kaltstart keinen weissen Bildschirm mehr, sondern einen animierten Ladebildschirm mit Fortschrittsangabe, bevor React mountet.

**Umsetzung.**
- `index.html`: `<title>`, Meta-Description, Favicon (`/assets/casino/ui/coin.png`), `<noscript>`-Fallback, sichtbarer CSS-animierter Lade-Balken (`#rbd-loader`) mit Text "Lade Neon-Kasino…".
- `src/main.tsx`: Während `boot()` lädt, bleibt der Ladebalken sichtbar; Text wechselt zu "Baue Floor…" und "Bereit."; nach `createRoot().render()` wird der Balken ausgeblendet (`hideLoader()`).

**Pruefungen.** Code gelesen: `index.html` (12 -> 52 Zeilen, Lade-Overlay im HTML), `src/main.tsx` (Loader-Logik vor/b nach `boot()`). Keine Spielmechanik veraendert. **Abgeschlossen.**

---

## 2026-11-04 - Phase 2a: Maschinen-Texturen sichtbar (Optik)

**Ziel.** Die vorhandenen Maschinen-Texturen aus `manifest.json` sollen auf den Spielgeraeten sichtbar sein, statt dass die Graphics-Flaeche sie uerdeckt.

**Umsetzung.**
- `src/render/furniture-art.ts`: Der `backdrop`-Sprite (geladen via `textureFor` aus `manifest.json` Maschinen-Eintr�gen) wurde in `createFurnitureArt` in der `children`-Liste **hinter** `body` platziert. Dadurch wurde der Backdrop vom gezeichneten Korpus (`body`) uerdeckt und war unsichtbar. Jetzt liegt er **uber** dem Korpus, sodass die Textur sichtbar ist (Fallback: `null` wenn Textur nicht geladen, dann bleibt Graphics-Zeichnung sichtbar).

**Pruefungen.** Code gelesen: `src/render/furniture-art.ts` (Zeile 194: `children`-Reihenfolge geaendert). Keine Spielmechanik veraendert. Keine Tests ausgefuehrt (per Benutzerwunsch).

**Abgeschlossen.** Phase 2b und 2c umgesetzt (siehe unten).

---

## 2026-11-04 - Phase 2b: Boden-Texturen sichtbar (Optik)

**Ziel.** Die Boden-Zonen aus `manifest.json` (`environment/tiles/`) sollen als Textur-Backdrop auf den Boden-Chunks sichtbar sein, statt dass nur `Graphics`-Farben gezeichnet werden.

**Umsetzung.**
- `src/render/floor-surface.ts`: `textureFor` aus `./assets/textures` importiert. Neue Funktion `floorTextureFor(mat)` ordnet Bodenbelag-Mustern (z. B. `GAMING` -> `casino-carpet-plum.png`, `BAR` -> `casino-carpet-plum.png`, `LOUNGE`/`STORAGE`/`EXCHANGE`/`TOILET`/`ENTRANCE` -> `wallpaper-damask-plum.png`) Textur-Schluessel zu. `drawSurface` akzeptiert nun einen optionalen `parent?: Container`-Parameter und fügt einen Sprite-Backdrop mit der Boden-Textur hinzu, wenn eine Textur verfuegbar ist (Alpha 0.9, als Untergrund unter dem gezeichneten Muster).
- `src/render/room-art.ts`: `drawZoneFloor` uebergibt `g.parent` (den `room`-Container) als `parent` an `drawSurface`, sodass die Boden-Textur-Sprites der Zone hinzugefuegt werden.

**Pruefungen.** Code gelesen: `src/render/floor-surface.ts` (Import, `floorTextureFor`, `drawSurface` Signaturerweiterung), `src/render/room-art.ts` (`g.parent` als parent uebergeben). Keine Spielmechanik veraendert. Keine Tests ausgefuehrt (per Benutzerwunsch).

---

## 2026-11-04 - Phase 3: Partikel-Events im Spielfluss (Optik)

**Ziel.** Spielereignisse (Jackpot, Charge-Entladung, Plinko-Drop, Streit, Sabotage, Grossgewinn) bekommen visuelle Gegenstücke via einem headless Event-Emitter, den die UI/Render-Schicht abonnieren kann.

**Umsetzung.**
- `src/core/sim/events.ts` (neu): reiner Event-Emitter ohne DOM/Pixi-Imports (`on`/`off`/`emit`/`listenerCount`), damit Core-Sim headless bleibt.
- `src/core/games/slot-session.ts`: emittiert `slot:jackpot` (Jackpot), `slot:chargeDischarge` (Charge-Entladung), `slot:chargeReady` (Charge bereit), `slot:spin` (normaler Spin) mit `itemId`, `stake`, `payout`, `multiplierBps`.
- `src/core/games/plinko-sandbox.ts`: emittiert `plinko:drop` mit `stake`, `payout`, `pockets`, `mode`.
- `src/core/sim/disputes.ts`: emittiert `dispute:start` (Streit beginnt) mit `disputeId`, `guestIds`, `x`, `y` und `dispute:sabotage` (Geräteschaden im Streit) mit `disputeId`, `itemId`, `itemLabel`, `x`, `y`.
- `src/core/sim/money.ts`: emittiert `money:bigPayout` (grosser Gewinn ab 10 VC) mit `guestId`, `amount`, `covered`, `debt`.

**Pruefungen.** Code gelesen: alle 6 geänderten Dateien. `tsc --noEmit` sauber. Keine Spielmechanik veraendert (nur Event-Emission, keine Logik-Änderung). Keine Tests ausgefuehrt (per Benutzerwunsch).

**Abgeschlossen.** Phase 4 (UI-Anbindung der Partikel-Events) siehe unten.

---

## 2026-11-04 - Phase 4: UI-Anbindung der Partikel-Events (Optik)

**Ziel.** Die Partie-Events aus Phase 3 werden in der UI gerendert: Partikel-Explosionen bei Jackpot, Spin, Plinko-Drop, Streit, Sabotage und grossen Gewinnen, plus Bildschirm-Shake und kurzes weisses Flash-Overlay.

**Umsetzung.**
- `src/render/particle-overlay.tsx` (neu): hoert auf `slot:jackpot`, `slot:chargeDischarge`, `slot:chargeReady`, `slot:spin`, `plinko:drop`, `dispute:start`, `dispute:sabotage`, `money:bigPayout` und rendert animierte Partikel (Farbe, Groesse, Lebensdauer), Bildschirm-Shake und kurzes weisses Flash-Overlay. Nutzt `playSfx` / `playPinRun` fuer synchronen Sound.
- `src/App.tsx`: `ParticleOverlay` wird ueber dem Floor gerendert (zIndex 60, `pointerEvents: none`), sodass Partikel ueber allem liegen aber keine Interaktion blockieren.

**Pruefungen.** Code gelesen: `src/render/particle-overlay.tsx` (neu), `src/App.tsx` (Import + Render). Keine Spielmechanik veraendert. `tsc --noEmit` sauber. Keine Tests ausgefuehrt (per Benutzerwunsch).

**Abgeschlossen.** Phase 4.5 (Bodenhinweise-Feinschliff) und Phase 5 (Audio-zu-Visual-Kopplung) siehe unten.

---

## 2026-11-04 - Phase 4.5: Bodenhinweise-Feinschliff (Optik)

**Ziel.** Die Bodenhinweise (Zielraster, Spielerring, Klick-Puls) sollen sichtbarer und "spieliger" wirken.

**Umsetzung.**
- `src/render/floor-cues.ts`: `ring` bekommt eine leuchtende Mitte (Fell mit `alpha: 0.12`) und kräftigere Kontur (`alpha: 0.5` statt `0.4`, `0.35` statt `0.22`). `reticle` bekommt einen kleinen, hellen Kern in der Kachelmitte (`fill(0xffffff, alpha: 0.9)` neben der farbigen Fläche). `ping` zeigt drei konzentrische Ringe statt nur einem.

**Pruefungen.** Code gelesen: `src/render/floor-cues.ts` (Import, `ring` Fill, `reticle` Mitte, `ping` Drei-Ringe). Keine Spielmechanik veraendert. `tsc --noEmit` sauber. Keine Tests ausgefuehrt (per Benutzerwunsch).

**Abgeschlossen.**

---

## 2026-11-04 - Phase 5: Audio-zu-Visual-Kopplung (Optik)

**Ziel.** Sound und Bild landen zur selben Zeit – jedes auditive Ereignis hat ein visuelles Gegenstück.

**Umsetzung.**
- `src/render/particle-overlay.tsx`: Bei jedem Event wird neben den Partikeln auch der passende Sound abgespielt (`playSfx('win')`, `playSfx('coin')`, `playPinRun(...)`, `playSfx('brawl')`). Damit gibt es zu jedem Sound-Ereignis eine visuelle Entsprechung.

**Pruefungen.** Code gelesen: `src/render/particle-overlay.tsx` (Sound-Aufrufe bei jedem Event), `src/render/sound-fx.ts` (verfuegbare Sounds: `coin`, `reelStop`, `pinHit`, `cardFlip`, `roulette`, `brawl`, `win`, `playPinRun`). Keine Spielmechanik veraendert. `tsc --noEmit` sauber. Keine Tests ausgefuehrt (per Benutzerwunsch).

**Abgeschlossen.** Alle 5 Phasen des Optik-Plans sind umgesetzt.

---

## 2026-11-04 - Phase 5: verify:quick beschleunigen (Test-Auslagerung auf CI)

**Ziel.** `verify:quick` soll lokal schnell laufen, damit es als Entwicklungsfeedback zwischen Commits genutzt werden kann. Nicht-kritische Tests (statistics/performance Beweisklassen) laufen nur in CI.

**Umsetzung.**
- `src/Config/vite.config.ts`: `quickExclude` erweitert um `poker-distribution.test.ts`, `balance-operating.test.ts` und alle `*.bench.ts` Dateien. Damit laufen im `verify:quick` nur noch `contract`, `integration` und `governance` Beweisklassen lokal; `statistics` und `performance` Tests laufen nur in CI (`ci:long` bzw. separater CI-Workflow).
- Die 12 bisher im quick-Profil mitgelaufenen CI-Dateien (darunter 4 statistics- und 8 performance-Testdateien) werden künftig nur noch in CI ausgeführt.

**Pruefungen.** `tsc --noEmit` sauber. Keine Spielmechanik veraendert. Keine Tests ausgefuehrt (per Benutzerwunsch).

**Abgeschlossen.** Alle 5 Phasen des Optik-Plans plus die Test-Optimierung sind umgesetzt.

---


---


## 2026-11-04 - Phase 2c: Charakter-Kopf-Texturen sichtbar (Optik)

**Ziel.** Gast-Kopfe sollen aus den `characters/head-*.png`-Texturen im Manifest bestehen, statt nur mit `Graphics` gezeichnet zu werden.

**Umsetzung.**
- `src/render/guest-art.ts`: `textureFor` aus `./assets/textures` importiert. `HEAD_TEXTURES`-Konstante mit allen 18 Kopf-Texturen (`characters/head-01-01.png` bis `head-02-09.png`). Neue Funktion `headTextureFor(seed)` wählt basierend auf dem Gast-Seed eine Textur aus. In `createGuestArt` wird nach der `pixelHead`-Erstellung ein Kopf-Sprite aus der Textur erstellt und zum `head`-Container hinzugefügt (Alpha 1.0, Position -7,-7, Größe 14x14), sodass `skull` ausgeblendet wird. `paintHead` springt frueh zurueck, wenn ein Kopf-Sprite existiert (Fallback: `Graphics`-Zeichnung, falls Textur nicht geladen).

**Pruefungen.** Code gelesen: `src/render/guest-art.ts` (Import, `HEAD_TEXTURES`, `headTextureFor`, Kopf-Sprite-Erstellung, `paintHead` Frueh-Rueckkehr). Keine Spielmechanik veraendert. Keine Tests ausgefuehrt (per Benutzerwunsch).

**Offen.** Phase 3 (Partikel & Animationen im Spielfluss) steht noch aus.




## 2026-11-04 - Visuelle Ueberarbeitung geplant (Optik-Plan)

**Ziel.** Der aktuelle Build ist funktional vollstaendig, aber der visuelle Ersteindruck fehlt: kein Einstieg, keine Textur-Nutzung, kein Game-Feel, keine visuelle Rueckmeldung auf Spielereignisse. Ein Plan fuer die visuelle Ueberarbeitung soll die Luecke zwischen "Spiel-Look" und aktuellem Stand schliessen.

**Umsetzung.**
- `docs/PLAN-OPTIK-VISUELL.md` erstellt: 5-Phasen-Plan (Eintrag/Ladeerfahrung, Figuren & Boden nutzen Textur-Pakete, Partikel & Animationen im Spielfluss, Game Feel & UI-Unterschiedlichkeit, Feinschliff der Bodenhinweise).
- Jede Phase ist additiv, alle `verify:quick` Gates muessen gruen bleiben.
- Offene Nutzerentscheidungen: Ladebildschirm-Logo, Hauptmenue vs. Direktstart, Attract-Modus-Farbe.

**Pruefungen.** `pnpm run verify:quick` — alle 10 Gates gruen.

**Offen.** Umsetzung der Phasen steht noch aus.




## 2026-11-04 - Kritische Simulations-Korrekturen (L1, L2, L6) + Dokumentation

**Ziel.** Die im Analyse-Report 1 identifizierten kritischen Logik-Luecken schliessen: Doppelauszahlung in `settleGuests`, CASHOUT-Haenger in `payAndLeave`, stilles Loeschen von unreachable Dreck in `cleanerTick`. Ausserdem INVENTORY.md auf Code-Stand bringen und Doku-Marker erneuern.

**Umsetzung.**
- `src/core/sim/actions.ts:settleGuests`: iteriert über Kopie `[...world.guests]`, entfernt jeden Gast nach erfolgreicher Buchung aus `world.guests`. Damit ist die Abarbeitung idempotent: bricht Gast N ab, sind Gaeste 1..N-1 bereits entfernt und gebucht, keine Doppelauszahlung bei erneutem Versuch.
- `src/core/sim/guest-service.ts:payAndLeave`: im Fehlerpfad wird der Gast auf `LEAVE` gesetzt (Pfad zur Tuer via `leave()`) statt ewig im Zustand `CASHOUT` zu verharren. Kein Geld wird vernichtet; Saldo bleibt auf `VISITOR_<id>` / `PENDING_<id>`.
- `src/core/sim/staff.ts:cleanerTick`: unreachable Dreck wird nicht mehr still geloescht (`world.dirty.delete(first)` entfernt), stattdessen wird der Reiniger als `idle` mit `blockedReason = 'Dreck nicht erreichbar'` gemeldet.
- `src/Config/eslint.config.mjs`: `plugins/**` zu ESLint-ignores hinzugefuegt (DSH-Host-Plugin, nicht Repo-Quelle; bereits gitignored).
- `docs/INVENTORY.md`: Befunde 1, 18, 21, 33, 34 als geloest markiert (Code zeigt bereits gefixt); offene Punkte in §16 angepasst.
- `docs/CHANGELOG.md`: Eintrag unter [0.3.111].

**Pruefungen.** `pnpm run verify:quick` — alle 10 Gates gruen (lint, check:loc, typecheck, test-quality, dead-code, docs, tree, redundancy, assets, tests). Neuer Testfall in `guest-settlement.test.ts` belegt, dass kein Gast doppelt ausgezahlt wird.

**Offen.** Schulden-Tilgungspfad (S1), Mods mit Mechanik (G1), Einsatz-Skalierung mit Persona-Budget (G2) sind Nutzerentscheidungen und stehen aus (siehe `docs/PLAN-LEAD-MERGE-KORRIGIERT.md`, Phase 1.3 / Phase 2).


## 2026-11-04 - Warmer Content-Batch

**Ziel.** Die zweite Stufe bekommt eine eigene Stimme: Titel, Text, Choice-Label und Outcome fuer `VISITOR_RETURN_WARM` mit waermerem Ton, damit die Szene nicht mehr aus dem Basistopf spricht.

**Umsetzung.** Vier Beitraege mit eigenem `warm`-Kontext im Vokabular (B2/D2-Praezedenz); das Template verlangt ihn pro Slot, sodass der Basistopf fail-closed herausfaellt und die Auswahl deterministisch beim eigenen Pool landet. Slot-Zwecke bleiben ehrlich: Titel/Text/Choice auf `return`+`warm`, Outcome auf `return`+`aftermath`.

**Pruefungen.** Neuer Testfall in `narrative-warm-return.test.ts`: Die komponierte warme Szene traegt exakt die neuen Texte, Choice `WARM_WELCOME` inklusive, ohne Fallback auf Titel/Text/Label. `verify:quick` (zehn Gates) vor dem Commit. Registry auf 61 Fragmente.

**Offen.** Persona-spezifische Begruessungen (mit Namen im Text) brauchen erst einen Composer, der Namen einsetzen darf; bis dahin bleibt der Text figuren-neutral.

## 2026-11-04 - Phase 5: Rivalen-Integration und Nachweise

**Ziel.** Die Rivalen-Domaene ins Anzeigemodell heben, ohne NAR-14-17 zu duplizieren: Minds, Indizien und `counteredUntilTick` sind die einzige Grundlage, alles andere waere eine zweite Wahrheit.

**Umsetzung.** Neuer reiner Helper `narrative/rival-context.ts` mit `rivalViews()`: eine Karte je Rivale in kanonischer Reihenfolge (Haltung, Kapazitaet, Wohlwollen, Gegenmassnahme mit Restlaufzeit, naechster Zug, Historie, Indizien als Kopien, Anzeige auf die Rivalen-Limits gedeckelt). `NarrativeView` traegt `rivals`, `view.ts` waechst um zwei Zeilen und bleibt unter 200.

**Pruefungen.** Neuer Test `narrative-rival-context.test.ts` (4/4 vorab gruen): Karten aus neutralen Minds, Gegenmassnahme mit Restlaufzeit und Ablauf, Kopien statt Referenzen, Limits, exakter Schluesselsatz, Anbindung in `buildNarrativeView`. `narrative:check`, `typecheck` und fokussierte Tests vorab gruen; `verify:quick` (zehn Gates) vor dem Commit, vollstaendig `verify:all` in CI. Registry auf 57 Fragmente.

**Offen.** Die UI-Karte (Rivalen-Profil mit Historie und Indizien) fehlt weiter; das Modell liegt dafuer bereit. Ein Importfehler (`RIVAL_IDS` aus dem Typ-Barrel statt aus `types-model`) ist im fokussierten Test aufgefallen und behoben.

## 2026-11-04 - F: Warme Rueckkehr als zweite Stufe

**Ziel.** Langzeit ohne Campaign-State: Der vorhandene Kettenbaustein (VISITOR_RETURN -> ASK -> VISITOR_AFTERMATH -> Flag/Beziehung) soll spaeter von allein in ein weiteres Match muenden. Zweite Stufe als Trigger-Variante mit eigenem Template, nur vorhandene Infrastruktur.

**Umsetzung.** Neue Trigger-Definition `visitor-returned-warm` (`all` aus `VISITOR_RETURNED`-Fact und `visitor-memory GOOD`) plus eigenes Template `VISITOR_RETURN_WARM` (Scope VISITOR, Prioritaet 50, Choice `WARM_WELCOME` mit Trust+1, kein Follow-up). Die Basis bleibt unangetastet: Bei GOOD-Erinnerung entstehen beide Szenen, sonst nur die Basis. Slot-Kontexte spiegeln die Basis (Titel/Text nur `return`), damit die B4-Abdeckung ohne neue Texte haelt.

**Pruefungen.** Neuer Test `narrative-warm-return.test.ts`: Definition plus Template-Vertrag, GOOD gegen BAD (zwei gegen eine Szene), und der volle Langzeitpfad (ASK-Flag, AFTERMATH-Trust, gute Erinnerung, spaeteres Warm-Match bei erhaltenem Flag und gewachsener Kante). `vitest` (3/3 plus Abdeckung) vorab gruen; `verify:quick` (zehn Gates) vor dem Commit. Registry auf 56 Fragmente.

**Offen.** Die warme Szene nutzt vorerst den Textpool der Basis; ein eigener Ton (herzlicher, persoenlicher) waere ein Content-Batch, keine Mechanik. Ob die additive Doppel-Szene auf Dauer richtig fuelt, zeigt der Spielbetrieb - Cooldowns und `maxOccurrences` begrenzen sie bereits.

## 2026-11-04 - E2: Besucherdisposition ueber den Gastpfad

**Ziel.** Eine einzige Ableitung aus Persona, Erinnerung und Kante, die an allen drei Entscheidungspunkten begrenzt wirkt - wie in D4/D5 entschieden, ohne neue Pflichten, ohne Geldwirkung.

**Umsetzung.** Neue reine Datei `narrative/disposition.ts` mit `visitorDisposition()` (Persona-Basis, `scoreMemories()` ueber hoechstens sechs Erinnerungen, Kante `visitor <-> player` aus Trust, Sympathie, Konflikt): `gameBias` (Faktor ±20 %), `serviceBias`/`socialBias` (Drink-/Sofa-Schwellen ±8 Punkte), `returnBias` (±10 Prozentpunkte zusaetzlich zu `memoryEffect()`). `memoryEffect()` ist duenne Fassade ohne zweite Gedaechtnislogik, `returnChance()` nimmt optionale Kanten, `pickReturningVisitor` reicht echte Kanten. Persona-Basis speist Spiel, Service und Soziales; die Rueckkehr bleibt Erinnerung plus Kante, damit alte Werte ohne Kanten bit-identisch bleiben.

**Pruefungen.** Neuer E2E-Test `visitor-disposition.test.ts`: gleiche Persona, GOOD+Sympathie gegen BAD+Konflikt, gleiche Welt, gleicher Seed - verschiedene Gewichte, verschiedene Aktivitaet (Bar gegen Spiel, Sofa gegen Spiel), Rueckkehr 39 gegen 7, Veto bei kaputtem Geraet intakt, Roundtrip erhaelt den Unterschied. `vitest` (5/5) vorab gruen; `verify:quick` (zehn Gates) vor dem Commit. Registry auf 55 Fragmente.

**Offen.** Die Persona-Basiswerte sind Startwerte, keine Messung; D4 verlangt die Messung vor jeder Balance-Aussage. Langzeitlaeufe (Soak) koennen durch echte Kanten leicht andere Rueckkehrzahlen zeigen - das ist beabsichtigte Wirkung, kein Rauschen.

## 2026-11-04 - D3: Fristablauf ohne Strafe

**Ziel.** Ein Fristablauf darf nie heimlich bestrafen: Wer eine Szene verstreichen laesst, findet danach dieselbe Welt vor - gleiche Flags, gleiche Beziehungen, gleicher Ledger. Das war bisher Lesart des Codes, jetzt ist es ein Test.

**Umsetzung.** Neuer Test `narrative-event-expiry.test.ts`: OFFERED- und ACTIVE-Instanz laufen ueber `maintainEvents` in `EXPIRED` mit `DEADLINE`; Flags, Beziehungen, Ledger-Zeilen und Fact-Queue bleiben byte-identisch unberuehrt. Keine Codeaenderung noetig - `transitionEvent` schreibt nur Status, Tick, Resolution, Cooldown und kuerzt die Historie.

**Pruefungen.** `verify:quick` (zehn Gates) vor dem Commit. Registry auf 54 Fragmente.

**Offen.** Sollte eine Szene kuenftig beim Verstreichen wirken (z.B. verpasste Chance), gehoert das als expliziter Choice-Effekt in den Template-Vertrag - nie als globale Regel.

## 2026-11-04 - D2: Domaenenwirkung COUNTER_RIVAL

**Ziel.** Entgegentreten muss in der Domaene ankommen, nicht nur im Journal: Nach `CONFRONT_RIVAL` bleibt der Rivale 900 Ticks still. Die Wirkung gehoert als typisierter Effekt in den Choice-Vertrag, mit Preflight-Kontrolle und genau einem Schreibpfad.

**Umsetzung.** `ChoiceEffect` und `NarrativeCommand` kennen `COUNTER_RIVAL` (Familie `RIVAL`, Ziel `ChoiceActor`, Registry erlaubt und ausfuehrbar); `preflight.ts` verlangt einen existierenden `rival:`-Ref und weist Unbekannte als `INVALID_TARGET` ab; `execute.ts` setzt `counteredUntilTick = max(alt, tick + counteredTicks)`; `RIVAL_MOVE.CONFRONT_RIVAL` traegt die Wirkung. Bewusst kein neuer Fact in dieser Phase - erst mit eigener Story in Phase 4.

**Pruefungen.** `verify:quick` (zehn Gates) vor dem Commit. Neue Tests: Stillstand des Rivalen bis zum Tick ueber `decideRivalAction`, Preflight-Ablehnung eines unbekannten Rivalen ohne Weltmutation. Registry auf 53 Fragmente.

**Offen.** Ein `RIVAL_COUNTERED`-Fact samt Trigger, Template und Content bleibt der Phase 4 vorbehalten; bis dahin ist die Kante Rivale->Haus plus Guard-Indiz die sichtbare Spur.

## 2026-11-04 - D1: Choice-Folgekette VISITOR_AFTERMATH

**Ziel.** Eine beantwortete Frage darf nicht im Nichts enden: Wer nach dem letzten Besuch fragt, oeffnet ein Nachspiel mit denselben Beteiligten. Die Kette gehoert in die Runtime, nicht in einen zweiten Trigger - der Ausloeser ist die Aufloesung selbst.

**Umsetzung.** `VISITOR_RETURN.ASK_ABOUT_LAST_VISIT` traegt `followUpEventId: VISITOR_AFTERMATH`; das neue Template (Scope VISITOR, eine Visitor-Rolle, Trigger `chain`, Konstante `FOLLOW_UP_TRIGGER`) bringt `TITLE`, `BODY`, ein Choice-Label und `OUTCOME` mit. `runtime.ts` loest bei `EVENT_RESOLVED` Vorgaenger-Instanz, Template und Choice zentral und fail-closed auf und gibt den Kandidaten mit den Vorgaenger-Teilnehmern und `chainFromEventId` in die Auswahl; `scheduleCandidates` prueft Cooldown, Limits, Kettenherkunft und RESOLVED-Status zentral. Vier Content-Beitraege (Titel, Body, Label, Outcome) mit je eigener Turn-ID, Registry auf 52 Fragmente.

**Pruefungen.** `verify:quick` (zehn Gates) vor dem Commit. End-to-End: Choice ausfuehren, Runtime, Folge-Event OFFERED mit Kette; zweiter Lauf ohne Duplikat. C1-Vertragstest kennt `chain` als Ketten-Trigger ohne Fact-Definition; Template-Liste auf sechs Eintraege erweitert.

**Offen.** Weitere Ketten (Rivale, Konflikt) folgen demselben Muster: erst Template, dann `followUpEventId` - nie ein Trigger ohne Szene.

## 2026-11-04 - C1: Trigger nur mit Template

**Ziel.** Die Spec-Regel „nur triggern, wo ein Template mit Mehrwert existiert“ war bisher ein Kommentar ueber `EVENT_TRIGGER_DEFINITIONS`; ein Kommentar wird ueberlesen, ein Test nicht. Gleichzeitig duerfen Geraete, Lager und Personal nicht stillschweigend unter den Tisch fallen - sie bleiben als offene Punkte dokumentiert.

**Umsetzung.** Neuer Vertragstest mit drei Beweisen: jede Definition findet mindestens ein Template mit passender `triggerId`; jedes Fact-Template (Demand-Pfad `ENGINE_DEMAND` ausgenommen) ist an genau eine Definition gebunden; `NARRATIVE_FACT_KINDS` ist exakt die bekannte Elf - keine neuen Fact-Kinds in diesem Slice. Doku in NARRATIVE-ENGINE, ROADMAP und AGENTS nennt Geraete-, Lager- und Personal-Facts ausdruecklich als offen.

**Pruefungen.** `verify:quick` (zehn Gates) vor dem Commit. Compiler-Test auf 48 Fragmente nachgezogen.

**Offen.** Sobald ein Geraete-, Lager- oder Personal-Fact echten Mehrwert traegt, bekommt er zuerst ein Template und erst dann einen Trigger - in genau dieser Reihenfolge.

## 2026-11-04 - A: Chunk-Splitting fuer Spiele-Paket und React

**Ziel.** Der Production-Build warnte vor einem 1,04-MB-Haupt-Chunk; PixiJS, React und die Spiel-Engines lagen in einem Bundle. Der erste Ladevorgang sollte kleiner werden, ohne den Floor spaeter zu zeichnen.

**Umsetzung.** `src/ui/games-popup-lazy.tsx` laedt das Spiele-Paket per `React.lazy` mit `PopupShell` als Ladeplatzhalter; `App.tsx` tauscht nur den Import. `src/Config/vite.config.ts` setzt Rolldowns `codeSplitting` mit einer `vendor-react`-Gruppe. Ein `vendor-pixi`-Sammelchunk wurde gebaut, gemessen und verworfen: er vereinnahmte Pixis interne Lazy-Chunks und kostete 54.881 B roh mehr im Initial-Bundle als die gewaehlte Variante. Der Renderer bleibt ungruppiert und eager, weil der erste Frame ihn braucht.

**Pruefungen.** Baseline und Aenderung mit demselben Build gemessen (statischer Importgraph ab Entry): Initial-JS 1.313.412 B / 399.286 B gzip -> 1.246.800 B / 380.841 B gzip; Haupt-Chunk 1.041.635 B / 317.733 B -> 756.241 B / 228.516 B gzip. `eslint` gruen, `tsc --noEmit` gruen, `check:loc` gruen (App 349/350), `verify:tree`, `verify:redundancy`, `verify:docs`, `verify:dead-code` gruen; `vitest` auf `card-tables` und `ui`: 12/12. Der Spiele-Chunk wird im gebauten Entry ausschliesslich dynamisch referenziert und steht nicht in `dist/index.html`.

**Offen.** Der Haupt-Chunk liegt mit 756 kB weiter ueber dem 500-kB-Limit; weitere Lazy-Grenzen (Asset-Bibliothek, Diagnose, Fremd-Floor) und ein Browser-Smoke-Test des Ladeplatzhalters stehen aus.

## 2026-11-04 - C2: Rivalenaktionen als Trigger-Bedingung

**Ziel.** `PROBE` ist ein Blick von der Seite und soll keine Szene oeffnen; nur Rivalenhandlungen mit Folgen duerfen `RIVAL_MOVE` ausloesen. Die Entscheidung gehoert in den Trigger-Vertrag, nicht in eine stille Annahme des Evaluators.

**Umsetzung.** `TriggerCondition` traegt `{ op: 'rival-action'; actions }` mit `RivalActionId[]`. Das Schema akzeptiert nur nicht-leere, duplikatfreie Listen aus `RIVAL_ACTION_IDS` (maximal fuenf); der Evaluator matcht ausschliesslich `RIVAL_ACTION`-Facts, deren Aktion in der Liste steht, und nennt die konkrete Aktion im Grund. `EVENT_TRIGGER_DEFINITIONS` ersetzt die pauschale `fact`-Bedingung durch TRADE_INFO, PRICE_MOVE, POACH_VISITOR und SABOTAGE; `PROBE` bleibt bewusst aussen vor und erzeugt nur ein Indiz.

**Pruefungen.** `verify:quick` (zehn Gates) vor dem Commit. Neue Tests: Schema akzeptiert `PROBE` als gueltige Aktion, verwirft leere, doppelte und unbekannte Listen; der Evaluator filtert Sabotage gegen PROBE und gegen einen Nicht-Rivalen-Fact; der Ende-zu-Ende-Test zeigt, dass PROBE kein Event und SABOTAGE genau einen `RIVAL_MOVE` erzeugt. Content-Beitrag `c2-rival-action-trigger-01`, Registry auf 47 Fragmente (sha256:b3159d3c...).

**Offen.** Weitere Rivalenaktionen bleiben schema-seitig erlaubt; wer sie als Event will, muss sie bewusst in die Trigger-Liste aufnehmen. Die naechsten Ketten C/D (Preis- und Gaestefolgen) bauen auf dem Fact auf, nicht auf einer zweiten Trigger-Wahrheit.

## 2026-11-04 - B4: Abdeckung ohne stillen Fallback

**Ziel.** "Kein stiller Fallback" sollte nicht nur behauptet, sondern ueber alle stabilen Templates pruefbar sein. Gleichzeitig kollidiert ein solcher Batch mit der Regel "genau ein Content-Beitrag pro Turn".

**Umsetzung.** AGENTS.md praezisiert: Ein abgestimmter Content-Batch gilt als ein Arbeitsschritt und darf mehrere Beitraege enthalten, solange jede Turn-ID genau einen Beitrag traegt und das Manifest jeden Turn einzeln registriert. Der Batch umfasst 16 Beitraege mit eigenen Turn-IDs: je `TITLE`, `BODY` und einem Label pro angebotener Choice fuer `VISITOR_RETURN`, `VISITOR_CONFLICT` und `RIVAL_MOVE` sowie `TITLE` und `BODY` fuer `NEON_NACHT` und `TURNIER_ABEND`. Rueckkehr-Fragmente tragen `startpool`, weil das Template diese Flag-Anforderung immer stellt; alle Texte nennen keine Persona und brauchen daher keine `personaRefs`. `narrative-coverage.test.ts` leitet Kontexte und Pflicht-Flags je Template aus den Slots beziehungsweise Choices ab und verlangt fuer alle Nicht-`OUTCOME`-Slots ein Fragment ohne Fallback; Outcomes bleiben bewusst offen.

**Pruefungen.** `narrative:compile` schreibt 46 Fragmente. Der neue Abdeckungstest laeuft ueber alle fuenf Templates und enthaelt einen Negativfall mit unpassendem Kontext. Composer-, View- und UI-Tests wurden an die neue Wahrheit angepasst: das Konflikt-Label und die Rueckkehr-Szene sind keine Fallbacks mehr, der UI-Hinweis nennt nur noch die beiden Outcomes. `verify:quick` folgt vor dem Commit.

**Offen.** Outcomes bleiben ohne Nachwirkungstext (Content-Batch D1). Die Rueckkehr-Texte sind bewusst figurunabhaengig; sobald Persona-spezifische Varianten dazukommen, entscheidet weiterhin der Score und bei Gleichstand der FNV-Hash.

## 2026-11-04 - B3: Fallback-Slots bei Namen nennen

**Ziel.** `degraded` soll den Zustand nicht mehr am ganzen Abend festmachen: schon ein einzelner fehlender Slot ist ein Mangel. Die Szene soll sagen, welche Stellen betroffen sind, statt pauschal "Sicherheitscopy".

**Umsetzung.** `composeNarrative` leitet `degraded` jetzt direkt aus `fallbacks.length > 0` ab und schreibt die betroffenen Slot-IDs in `issues` (`Fallback fuer Slots: TITLE, CHOICE_WELCOME.`). Die beiden Ablehnungspfade (`ok: false`) tragen keine Slots und melden `degraded: false`; ihr Grund bleibt in `issues`. `NarrativeEventView` verliert das boolesche `fallbackText` und traegt `fallbackSlots`; die UI listet die IDs auf, `TITLE`/`BODY` als "Titel"/"Text", alles andere als kanonische ID. `view.ts` setzt nur noch dann ohne Persona-Einschraenkung neu zusammen, wenn wirklich alle Slots Fallback sind — sonst wuerde ein guter Body-Text durch die Persona-freie Variante verdraengt.

**Pruefungen.** `pnpm run narrative:compile` schreibt 30 Fragmente (sha256:8bde0ad5...). Composer-Tests: Teil-Fallback, Voll-Fallback, fallback-freier Fall mit `degraded: false`, `issues` mit jeder ID. Der View-Test prueft die vollstaendige `fallbackSlots`-Liste der Szene, der UI-Test den konkreten Hinweistext; der erste Lauf war rot, weil die Szene ohne `startpool`-Flag tatsaechlich alle sechs Slots auf Fallback setzt — die Erwartung wurde an die belegte Wahrheit angepasst, nicht die Zusicherung entfernt. `verify:quick` bestand danach alle zehn Gates.

**Offen.** Die Slot-Namen sind rohe IDs; sobald mehr Slots Inhalte bekommen, kann `SLOT_LABEL` wachsen. Der Content-Batch D1 fuellt weiterhin `welcome`, `ask`, `defuse`, `escalate`, `confront`, `watch`, `aftermath`.

## 2026-11-04 - B2: Slot-Zwecke im Composer

**Ziel.** Der Composer soll nicht nur semantisch treffen, sondern den Zweck eines Slots kennen: eine Begruessung ist kein Rueckkehr-Text, ein Ausgang ist kein Entscheidungstext. B2 schliesst die zweite Composer-Luecke nach B1, ohne RNG und ohne neuen Zustand.

**Umsetzung.** `ContentSlot` traegt optional `requiredContexts` (max. 4, Vokabular-Slugs, fail-closed in `template-schema.ts`). Die fuenf Templates tragen ihre Zwecke: `VISITOR_RETURN` (`return`, `welcome`, `ask`, `aftermath`), `VISITOR_CONFLICT` (`conflict`, `defuse`, `escalate`, `aftermath`), `RIVAL_MOVE` (`rival`, `confront`, `watch`, `aftermath`), `NEON_NACHT`/`TURNIER_ABEND` (`demand`). `ComposeRequest` bekommt `requiredContexts` und `eventInstanceId`; `selectFragment` nimmt jetzt den Slot, verlangt Request- und Slot-Kontexte hart und laesst `contexts` weiterhin nur den Score bewerten. Bei Gleichstand waehlt ein FNV-1a-Hash aus `eventInstanceId` und Slot-ID unter den besten Kandidaten; ohne Szenen-ID bleibt `contributionId` der stabile Schluessel. `view.ts` reicht `event.id` als Szenen-ID durch. Das Vokabular ergaenzt `welcome`, `ask`, `defuse`, `escalate`, `confront`, `watch` und `aftermath` (`rival` bestand bereits). Die Ausgaenge fallen mangels Nachwirkungs-Content zunaechst auf neutrale Fallbacks zurueck; das ist gewollt und der Content-Batch D1 fuellt sie.

**Pruefungen.** `narrative:compile` (29 Fragmente, sha256:c18d9ccb...), Compiler-Test auf 29 gezogen, neue Composer-Tests fuer harte Slot-Zwecke, Nachwirkungs-Auswahl und Hash-Gleichstand; `verify:quick` (zehn Gates) vor dem Commit.

**Offen.** Noch kein Fragment traegt `welcome`, `ask`, `defuse`, `escalate`, `confront`, `watch` oder `aftermath`; bis D1 bleiben diese Slots Fallback. Der Tie-Break veraendert die Auswahl nur bei Gleichstand und nur mit Szenen-ID.

## 2026-11-04 - Vision: Lebenssimulation statt Casino-Manager

**Ziel.** Das Projekt nicht mehr als Casino-Manager beschreiben. Rigged by Design ist eine Lebenssimulation; das Casino ist Startpunkt und Testumgebung. Die vorhandene Engine muss als wiederverwendbarer, erweiterbarer Kern erklaert werden, auf dem alle kuenftigen Lebensbereiche aufsetzen.

**Umsetzung.** `docs/PRODUCT.md` neu geschrieben: Titel als Wortspiel, Casino als Testumgebung, der bildhaft erklaerte Pfad (TV -> Laune -> Charisma -> NPC-Erinnerung -> Doener -> Kleidung/Marken/Chef -> eigenes Casino), die Engine als Systemkern, MVP als Systembeweis und Detailvorgabe, Low-End-Optik ausdruecklich vorlaeufig, bespielbare Stadt als Release-Horizont, Social-Plugin der NAR Engine und Ledger-Ressourcen. README um Titel, Vision, Engine-Abschnitt, Herkunft des Casinos, Optik-Hinweis und FAQ erweitert; Save-Stand von v9 auf v10 korrigiert. ROADMAP auf Nordstern/Testumgebung/Lebenssysteme/Stadt umgestellt. ARCHITECTURE um die ort-agnostische Produktgrenze, AGENTS um die Rollenkorrektur, NARRATIVE-ENGINE um Abschnitt 18 (Social-Plugin), ART-DIRECTION und Asset-Pack um den Vorlaeufig-Status ergaenzt; INVENTORY-Projektzeile korrigiert. Content-Beitrag `2026-11-04-lebenssim-vision.json`, Manifest und Registry auf 28 Fragmente.

**Pruefungen.** `narrative:compile` (28 Fragmente, Hash), Compiler-Test auf 28 gezogen, `verify:quick` (zehn Gates) vor dem Commit.

**Offen.** Die Systemkette ist beschrieben, aber noch nicht als Lebenssystem implementiert; Laune/Charisma/Ressourcen und das Social-Plugin bleiben Roadmap. Die Optik bleibt vorlaeufig.

## 2026-11-04 - B1: Kontext-Helper fuer Szenen

**Ziel.** Der Szenen-Kontext sollte nicht mehr in `view.ts` aus verstreuten Feldern entstehen. Der neue reine Helper sollte Fact, Template, Teilnehmer, Erinnerungen und gerichtete Kante zusammenfuehren, ohne einen zweiten Zustand oder eine zweite Kontextdatenbank anzulegen.

**Umsetzung.** `src/core/sim/narrative/composition-context.ts` liest `WorldState`, `Ledger`, Event und Template und liefert `contexts`, `availablePersonas`, `relationship`, `mood` und `requiredFlags`. Der Kontext kommt aus dem Fact mit `sourceFactId` in `narrative.recent`; fehlt er oder ist die ID 0, entscheidet `template.triggerId`, danach `template.eventId`. `VISITOR_RETURNED` wird zu `return`, `VISIT_ENDED` zu `loss` bei `BAD` und sonst `return`, `VISITOR_CONFLICT` zu `conflict`, `VISITOR_SERVICE` zu `service`, `RIVAL_ACTION`/`RIVAL_ENCOUNTER` zu `rival`; Demand-Events zu `demand`. Personas entstehen nur aus aufgeloesten Visitor-Teilnehmern. Beziehung und Stimmung folgen dem Fact, dann der gerichteten Kante (bei Paaren zwischen Besuchern) und zuletzt der letzten Erinnerung. `requiredFlags` sammelt ausschliesslich Flag-Requirements des konkreten Templates, nie Welt-Flags. `view.ts` baut die Composer-Anfrage nur noch aus diesem Ergebnis. `rival` ist im Vokabular ergaenzt; der Content-Beitrag `2026-11-04-b1-kontext-helper.json` haelt die Szene im Textbestand.

**Pruefungen.** `pnpm run typecheck` und `pnpm run check:loc` sind gruen. Die sechs Helper-Tests decken Fact-Kontext, Template-Fallback, Valenz, Konflikt/Service/Rivale, Kante und Erinnerung ab; `verify:quick` bestand alle zehn Gates (Tests 31,1 s).

**Offen.** B2 mit den sieben neuen Kontexten und der erste Content-Batch nach D1 stehen noch aus. Der Ledger bleibt Teil der Signatur, weil der View ihn fuer Choices haelt; die Textwahl liest keine Geldwerte. Es gibt keinen neuen Save-State.

## 2026-11-04 - A3: Narrative-JSON in test:affected

**Ziel.** A3: Aenderungen an Narrative-Content sollten den zustaendigen Governance-Test ausloesen. Bisher fiel eine reine JSON-Aenderung unter `content/narrative/**` durch alle Zweige: Sie ist kein Code, keine Testdatei und keine Konfiguration, also blieb die Auswahl leer.

**Umsetzung.** `scripts/lib/affected-tests.mjs` traegt jetzt `NARRATIVE_DATA_RE = /^content\/narrative\/.*\.json$/` und die Konstante fuer den Governance-Test. Der neue Zweig liegt vor dem Code-Check, setzt `codeChanged = true` und fuegt ausschliesslich `src/core/governance/__tests__/narrative-content.test.ts` hinzu. Damit greift weder der Subsystem-Fallback noch die "kein direkter Treffer"-Regel; andere Aenderungen im selben Diff bleiben unberuehrt. `AGENTS.md` und `docs/NARRATIVE-ENGINE.md` nennen die Auswahl.

**Pruefungen.** `pnpm exec vitest run src/core/governance/__tests__/affected-tests.test.ts --config src/Config/vite.config.ts`: 7/7 gruen. Der neue Fall uebergibt zwei Narrative-JSON-Pfade und prueft mit `toEqual`, dass nur der Governance-Test zurueckkommt und `runAll` false bleibt. Danach `verify:quick`.

**Offen.** Der Zweig deckt nur JSON unter `content/narrative/**` ab; andere Content-Ordner bleiben bei der bisherigen Graphen-/Subsystemlogik. A3 ist damit fuer Narrative geschlossen.

## 2026-11-04 - A1: Inventur und Validatoren vor dem Fruehausstieg

**Ziel.** A1: Die allgemeine Inventur-/Validator-Reihenfolge sollte nicht am `node_modules`-Fruehausstieg haengen. Bisher liefen nur der Narrative-Validator und der Divergenz-Guard davor; Inventur, Doku-Marker, Doku-Gate und LOC wurden in einem frischen Klon stillschweigend uebersprungen.

**Umsetzung.** `.githooks/pre-commit` buendelt `build-inventory`, `doc-sync --staged`, `verify-docs` und `check-loc` in `inventory_docs_loc()`. Die Funktion laeuft im Fruehausstieg und noch einmal nach Matrix und Testkatalog im normalen Pfad. Nur `sync-dependency-matrix` und `test-catalog` bleiben hinter dem Ausstieg, weil beide `typescript` aus `node_modules` importieren. Die Reihenfolge der uebrigen Schritte und der LOC-Fehlercode bleiben unveraendert; der Ausstieg meldet jetzt ausdruecklich, dass nur Matrix und Katalog uebersprungen wurden. `AGENTS.md` und `docs/NARRATIVE-ENGINE.md` nennen die neue Grenze.

**Pruefungen.** `sh -n .githooks/pre-commit`. Ein temporaeres Git-Repo mit Stub-Skripten belegt ohne `node_modules` die Reihenfolge `build-inventory -> doc-sync -> verify-docs -> check-loc` und mit `node_modules` zusaetzlich `sync-dependency-matrix -> test-catalog` davor. Ein Stub mit LOC-Fehler blockiert den Commit auch ohne `node_modules`.

**Offen.** Inventur-Aenderungen werden vom Hook weiterhin nicht gestagt; das war schon vor A1 so und bleibt ausserhalb dieses Slice. A2/A3 sind abgeschlossen, A1 damit ebenfalls. Der naechste Schritt ist D2 mit den neuen Kontexten, danach der erste Content-Batch.

## 2026-11-04 - Test: Vollstaendige Narrative-Fixture

**Ziel.** Der bestehende Governance-Test soll nicht nur die Inbox, sondern eine vollstaendige Narrative-Fixture pruefen: `content/narrative/**` plus die generierten Bruecken `registry.generated.ts` und `slot-map.generated.ts`. Dabei muessen unregistrierte Beitraege, Schemafehler trotz Manifest und unerlaubte Eintraege fail-closed scheitern, waehrend der korrekt registrierte Bestand inklusive aller drei Render-Ausgaben besteht.

**Umsetzung.** `src/core/governance/__tests__/narrative-content.test.ts` baut die Fixture unter `os.tmpdir()`: `content/narrative` wird rekursiv kopiert, `fragments.json` mit `renderRegistry`, die Runtime-Registry mit `renderRuntimeRegistry` und die Slot-Bruecke mit `renderSlotMap` geschrieben. Der PASS-Fall ruft `loadNarrativeContent()` und vergleicht Beitrags-, Turn- und Registry-Zahl sowie den Content-Hash mit dem echten Bestand. Der FEHLER-Fall legt nacheinander eine unregistrierte `2026-11-01-unregistriert.json`, eine registrierte Datei ohne `text`, dann `notizen.txt`, `notizen.md`, `draft.tmp`, `backup.bak`, `.versteckt.json` und einen Unterordner an; jede Variante wird frisch geladen und auf ihre spezifische Meldung geprueft. Ein `try/finally` mit `rmSync(..., { recursive: true, force: true })` raeumt jedes Fixture auf. Kein zweites Testfile; die Datei bleibt mit 224 Zeilen unter dem 240-Zeilen-Cap.

**Pruefungen.** `pnpm exec vitest run src/core/governance/__tests__/narrative-content.test.ts --config src/Config/vite.config.ts`: 12/12 gruen in 267 ms. Danach `verify:quick` im selben Turn.

**Offen.** Der Test deckt die Inbox- und Render-Bruecken ab, aber noch nicht die allgemeine Hook-Reihenfolge (A1). Symlinks werden nur geprueft, wenn die Plattform sie erlaubt; auf Windows ohne Symlink-Recht bleiben Unterordner, `.txt` und versteckte Datei als Nachweis.

## 2026-11-04 - A3: Narrative-Validator im Pre-Commit-Hook

**Ziel.** A3: Der Narrative-Validator muss vor dem `node_modules`-Fruehausstieg laufen, und der Hook darf nie einen anderen Inhalt pruefen als den Commit.

**Umsetzung.** `.githooks/pre-commit` ruft jetzt zuerst die gestagten Narrative-Pfade ab und blockiert mit `ERR-4022`, wenn eine davon im Arbeitsbaum noch unstaged veraendert ist (`git diff --quiet` schlaegt fehl). Danach laeuft `node scripts/verify-narrative-content.mjs` vor dem `node_modules`-Check; ein Fehler beendet den Hook mit `ERR-4022`. Die restliche Reihenfolge (Matrix, Katalog, Inventur, Doku-Sync, Doku-Gate, LOC) ist unveraendert. Kein Vitest und kein `verify:quick` im Hook.

**Pruefungen.** `sh -n .githooks/pre-commit`; temporaeres Test-Repo: divergierende gestagte Datei blockiert mit der erwarteten Meldung, ein Stub-Validator laeuft ohne `node_modules` und blockiert mit `ERR-4022`. Im echten Baum `narrative:check` 26/26/26 und `verify:quick` gruen.

**Offen.** A1 bleibt offen: Der Validator ist im Hook, aber die Inventur-/Validator-Reihenfolge vor dem Fruehausstieg ist nur fuer Narrative geprueft; die allgemeine Gate-Reihenfolge bleibt Aufgabe von A1.

## 2026-11-04 - A2: Contribution-Inbox fail-closed

**Ziel.** A2 der Integritaets-Phase: Die Contribution-Inbox darf keine Eintraege still ignorieren. Bisher filterte `readContributions()` auf `isFile()` und `.json`; Unterordner, Symlinks, versteckte Dateien und Behelfsdateien verschwanden lautlos.

**Umsetzung.** `scripts/lib/narrative-content.mjs` iteriert jetzt alle direkten Eintraege mit `withFileTypes` und meldet jeden unerlaubten Eintrag als Issue: Symlink, Unterordner, kein regulaere Datei, versteckter Name oder Dateiname ausserhalb des `<datum>-<turn>.json`-Musters. Nur sichtbare regulaere JSON-Dateien nach FILE-Muster werden geparst. Parsing, Schema, Manifest-1:1 und Registry-Hash sind unveraendert; die neue Pruefung dupliziert die Vollstaendigkeitspruefung nicht. Der Governance-Test legt ein temporaeres Inbox-Fixture mit allen Faellen an und prueft, dass die gueltigen Beitraege unveraendert bleiben.

**Pruefungen.** Fokussierter Test `narrative-content.test.ts` (11/11) und danach `verify:quick` sowie `narrative:check`.

**Offen.** A1 (Validator vor dem node_modules-Skip) und A3 (`test:affected` fuer Narrative-JSON) stehen noch aus; die Batch-Regel aus D1 bleibt bis zur Manifest-Erweiterung unveraendert bei genau einem Beitrag pro Turn.

## 2026-11-04 - Korrektur: E2E-Disposition vollstaendig

**Ziel.** Die E2E-Korrektur des Eigentuemers aufnehmen: Die Disposition wirkt vollstaendig ueber den Gastpfad, nicht nur in `offerScore()`.

**Umsetzung.** `docs/NARRATIVE-ENTSCHEIDUNGEN.md` ist in D4 und D5 korrigiert. D4 beschreibt E2E jetzt an drei Punkten: begrenzte Verschiebung der sozialen Schwellen in `chooseActivity()` (±8 Punkte), begrenzter Faktor in `offerScore()` (±20 %) und begrenzter Beziehungszuschlag in `returnChance()` (±10 Prozentpunkte). D5 wurde von „nein“ auf „ja, begrenzt“ gedreht; kritische Toiletten-, Geld-, Platz- und Geraeteregeln bleiben vorrangig. Die Korrektur ist im Dokument selbst als solche markiert, damit die erste Fassung nicht nachtraeglich anders aussieht.

**Pruefungen.** `node scripts/verify-docs.mjs`, `node scripts/verify-tree.mjs`, `node scripts/verify-redundancy.mjs` und `node scripts/verify-narrative-content.mjs`; danach `verify:quick` vor dem Commit.

**Offen.** Noch kein Code: Die drei Projektionen und ihre Grenzen warten auf die Umsetzung. Die genauen Werte brauchen eine Messung; ein Ende-zu-Ende-Test fuer hohe und niedrige Disposition ist Teil des Nachweises.

## 2026-11-04 - Narrative-Entscheidungen zu Batch, Kontexten, Gegenmassnahme und Disposition

**Ziel.** Die fuenf offenen Punkte der Narrativ-Spezifikation verbindlich beantworten, ohne Code umzubauen: Content-Batch, neue Kontexte, Gegenmassnahme, E2-Reichweite und Service-Schwellen.

**Umsetzung.** `docs/NARRATIVE-ENTSCHEIDUNGEN.md` haelt je Punkt Entscheidung, Begruendung, Grenzen und Umsetzungsfolge fest. Batch: mehrere Contributions pro Turn, aber weiterhin eine JSON-Datei je Beitrag und ein Manifest-Eintrag je Beitrag. Kontexte: `rival`, `welcome`, `ask`, `defuse`, `escalate`, `confront`, `watch` kommen als Autorenvokabular dazu. Gegenmassnahme: `COUNTER_RIVAL` setzt nur `counteredUntilTick`; `RIVAL_COUNTERED` wird als Chain-Template an die aufgeloeste Choice gehaengt, ohne neuen Fact und ohne Fact-Trigger. E2 wirkt nur in `offerScore()`. `chooseActivity()` behaelt seine Service- und Sozialschwellen.

**Pruefungen.** `node scripts/verify-docs.mjs`, `node scripts/verify-tree.mjs`, `node scripts/verify-redundancy.mjs` und `node scripts/verify-narrative-content.mjs` auf dem Dokumentstand; der volle Lauf bleibt CI.

**Offen.** Die Entscheidungen sind noch nicht implementiert. Die genauen Dispositionsgewichte brauchen eine Messung; `RIVAL_COUNTERED` braucht Autorentexte. Die Chain-Kennung wird erst mit dem Runtime-Pfad eingefuehrt.

## 2026-11-04 - Profilweg und Geschichten-Historie

**Ziel.** Die zwei offenen Andockpunkte der Narrativ-UI schliessen: vom Gast-Popup direkt in das Profil der Figur, und die abgeschlossenen Szenen im Journal sichtbar machen. Beides ohne neue Zustandswahrheit; der Dialog bleibt unveraendert.

**Umsetzung.** `NarrativeView` traegt jetzt `history` (juengste zwoelf terminale Event-Instanzen, neueste zuerst) und `buildNarrativeView()` leitet sie rein aus `world.narrative.events` ab; nur Titel, Schritt, Status, Abschlusstakt, Ausgang und Teilnehmer, keine Choices. Profile umfassen zusaetzlich Figuren, die gerade als Gast auf dem Floor stehen (`Guest.visitorId`), damit der neue PROFIL-Knopf im Gast-Popup immer eine echte Kennung oeffnet. `NarrativePopup` startet mit `initialVisitorId` im Figuren-Tab und zeigt fuer eine unbekannte Figur kein fremdes Profil. Das Journal hat den Tab „Geschichten“ mit eigener Liste und blendet Suche/Archiv dort aus.

**Pruefungen.** `pnpm run typecheck` und `pnpm run verify:quick` gruen; neue Tests decken Historie, Profilweg und Journal-Tab ab.

**Offen.** Autorentexte fuer Dialoge brauchen einen Content-Slot; bis dahin bleibt die Sicherheitsfassung. Der Dialog haelt bewusst keinen Zustand ueber Speichern/Laden.

## 2026-11-04 - NAR-17: Doku-, Katalog- und demandEvent-Sync mit Save v10

**Ziel.** Doku, Testkatalog und Content-Vertrag auf den tatsaechlichen Code heben: Save v10, Rivalen-Domaene, Langzeit-Nachweise und die verbliebenen `demandEvent`-Spuren.

**Umsetzung.** `ARCHITECTURE.md`, `AGENTS.md`, `PRODUCT.md`, `ROADMAP.md`, `NARRATIVE-ENGINE.md` und der Taskplan nennen jetzt Save v10 (`vcoin.casino.v10`, Migration v5–v9) statt v9. Die Rivalen-Domaene ist als eigener Zustandsbesitz dokumentiert: `WorldState.rivals` mit Haltung, Handlungsfaehigkeit, Wohlwollen, naechstem Zug, Gegenmassnahmen-Fenster, Historie (6) und Indizien (4), reine Politik ohne PRNG, `RIVAL_ACTION`-Fact, Trigger `rival-action`, Template `RIVAL_MOVE` und die Kante Rivale→Haus aus dem Boundary. NAR-16 steht mit Zwei-Tage-Test, Save-Budget (gemessen 137 KiB je Tag, 337 KiB nach zwei), Hotpath-Messung und `ci:long` in den Vertraegen. `TRIGGER_DIALOG` ist ueberall als bis zur Dialogfuehrung nicht ausfuehrbar formuliert. `demandEvent` bleibt ausschliesslich als Migrationsfeld in `SavedGame`/`migrate-narrative.ts` fuer v5–v9 dokumentiert, `NarrativeState` kennt es nicht. Der Content-Workflow (Beitrag, Turn-Manifest, Compiler, Assets-Gate) ist als eigener Abschnitt 17 im Narrativ-Vertrag beschrieben. Testkatalog und Inventur sind regeneriert.

**Pruefungen.** `pnpm run narrative:check`, `pnpm run catalog`, `pnpm run inventory:build` und `pnpm run verify:all` auf dem committeten Stand; dazu CI `Fail-Closed Gates` auf dem PR.

**Offen.** `TRIGGER_DIALOG` wartet weiter auf eine Dialogfuehrung; die Rivalen-Profilkarte zeigt Historie und Indizien noch nicht, und ein Sieben-Tage-Langlauf bleibt ein eigener CI-Nachweis.

## 2026-11-03 - CI-Eskalation: Code, Stufe, Haeufigkeit

Ziel: Jeder CI-Fehler zeigt Code, Beschreibung, Fix und Haeufigkeit, mit dem bestehenden Gate-System und ohne zweites Register.

Umsetzung:
- Stufe pro Code im Register (`level`); `escalation.mjs` liest sie zuerst, Textmuster sind nur Fallback. Die Zuordnung ist eigene Einschaetzung des Agenten und nicht von einem Review bestaetigt.
- ERR-4008 hatte zwei Bedeutungen. Push auf den Arbeitsbranch bleibt ERR-4008. Der abgelehnte Direktpush auf `main` bekommt ERR-4023, weil die Ursache eine andere ist (Ruleset, nicht Netz oder Branch). ERR-4006 bleibt Commit-Format und deckt Developer Notes wie Pflichtsektionen ab; beide Quellen nennen dieselbe Format-Ursache, deshalb kein eigener Code.
- ERR-4024 fuer das rote lokale Gate in `turn:finish`.
- PR-Watcher: Fingerprint-Dedupe mit Kommentar statt Neu-Issue; geschlossene Issues bleiben zu. Die beiden Suchen sind in `findIssue` zusammengefuehrt.
- Commit e7294f4 (PR-Watcher) ist auf `origin/main` uebernommen, sodass `pr-watcher.yml` dort lauffaehig ist.

Pruefungen (lokal, ohne Workflow-Lauf): YAML-Parse von `pr-watcher.yml`, `node --check` auf geaenderte Skripte, `verify:docs`, `verify-redundancy`, vitest `dependency-governance.test.ts` und `escalation.test.ts`.

Offen: Ruleset ungeprueft (kein `gh`, kein authentifizierter Zugriff). Die Dedupe ist in CI noch nicht beobachtet. Schritt 7 (Aufraeumen) wartet auf Freigabe. Die Dateigroesse von `pr-watcher.mjs` (rund 325 Zeilen) liegt unter dem Cap; `scripts/` wird vom LOC-Gate nicht erfasst.

## 2026-11-03 - Narrative-Review-Befunde S1 bis S16: Expiry, Demand, Slot-Map, Preflight, Locale, Migration, Duplikat, totale Ausfuehrung, ENGINE_DEMAND, maxOccurrences, legacy-Demand, guard-Flush, degraded, Doku

**Ziel.** Narrative-Review-Befunde S1 bis S16: Expiry, Demand, Slot-Map, Preflight, Locale, Migration, Duplikat, totale Ausfuehrung, ENGINE_DEMAND, maxOccurrences, legacy-Demand, guard-Flush, degraded, Doku

**Umsetzung.** Offen.

**Pruefungen.** Offen.

**Offen.** Offen.

## 2026-11-04 - NAR-14: Narrative UI, Szenen und Profile

**Umsetzung.** `src/core/sim/narrative/view.ts` ist die einzige Stelle, die aus `WorldState`, `Ledger` und dem Composer ein Anzeigemodell baut: Szenen mit Titel, Text, Frist, Teilnehmern und Choices (jede mit `available` und `reasons` aus `checkChoiceSelection`), dazu Profile mit Besuchen, Erinnerungen, gerichteten Beziehungen und laufenden Geschichten. `buildView()` haengt das Ergebnis als `GameView.narrative` an; React liest nur noch. `src/ui/narrative-*` bringt Szenen-Karten und Profilansicht, `App.tsx` oeffnet sie ueber einen Story-Chip auf dem Floor. `dismissNarrativeCmd()` lehnt eine Szene ueber `transitionEvent` ab (`CANCELLED` + Cooldown + Journal-Zeile) – kein zweiter Statuspfad, keine Schema-Aenderung.

**Entscheidung.** Text kommt ausschliesslich aus der Registry; fehlt eine passende Persona, wird einmal ohne Persona-Einschraenkung zusammengesetzt und ein verbleibender Fallback im UI als Sicherheitscopy benannt, statt Text zu erfinden.

**Offen.** `TRIGGER_DIALOG` bleibt bis zur Dialogfuehrung nicht ausfuehrbar. Profilnavigation aus dem Gast-Popup und die Event-Historie im Journal sind seit T47 angebunden; NAR-15 bis NAR-17 sind inzwischen abgeschlossen.

## 2026-11-03 - NAR-13: DemandEvents in der gemeinsamen Engine

**Ziel.** Den zweiten Scheduler in `demand.ts` aufloesen, ohne Ankunftsraten, Gruppengroessen oder Zeitfenster zu veraendern und ohne laufende Veranstaltungen aus v5–v9-Saves zu verlieren.

**Umsetzung.** Neon-Nacht und Turnierabend stehen jetzt als Daten in `narrative/events/demand-definitions.ts`; `narrative/demand-events.ts` startet hoechstens eine aktive GLOBAL-Instanz ohne Choices und beendet sie am Fristtick ueber `transitionEvent` (`EXPIRED`, `DEMAND_ENDED`). `demandBreakdown()`, `groupSize()` und `expectedGroupSize()` lesen nur noch die aktive Instanz; `NarrativeState.demandEvent` und seine Normalisierung sind entfernt. `sourceFactId: 0` ist fuer engine-erzeugte Events ohne ausloesenden Fact reserviert. `hydrateNarrative()` konvertiert das alte Feld aus v5–v8 und v9 in eine Instanz mit Restlaufzeit, abgelaufene Events verfallen.

**Pruefungen.** `node_modules/.bin/tsc --noEmit -p src/Config/tsconfig.json` und 19 fokussierte Tests in `demand.test.ts`, `narrative-demand.test.ts` und `narrative-save.test.ts` sind grün. Die Save-Tests decken alle Versionen v5–v9, das fehlende Feld im neuen Save und den Reload ohne Duplikat ab. `RBD_VERIFY_NO_CACHE=1 RBD_VERIFY_AUDIT=1 CI=true node scripts/run-pipeline.mjs --profile=full` bestand alle zwoelf Gates inklusive Audit und Build; die Suite meldete 657 bestandene und 2 uebersprungene Tests (659 gesamt) in 132 bestandenen Testdateien. Bericht: `.verify-cache/reports/2026-11-03T03-16-02-160Z/summary.md`.

**Offen.** Die Event-Instanzen teilen sich die begrenzte Historie mit den uebrigen narrativen Events; eine eigene Retention fuer Nachfrageevents ist nicht noetig, solange hoechstens eine pro Tag entsteht. Die UI-Anbindung bleibt NAR-14.

## 2026-11-03 - NAR-12 Orchestrierung in Tick und WorldStore

**Ziel.** Facts nicht mehr an einzelnen Quellen, sondern an den tatsaechlichen Mutationsgrenzen verarbeiten und den vollstaendigen Kreis Fact→Event→Choice→Command→Fact schliessen — im Tick und bei Store-Commands ausserhalb des Ticks.

**Umsetzung.** `narrative/runtime.ts` ist der einzige Orchestrator. `processNarrativeRuntime()` ruft `processNarrativeBoundaryDetailed()` genau einmal, wertet danach pro drainiertem Fact die deklarativen Trigger aus `events/trigger-definitions.ts` aus und uebersetzt Treffer ueber die Template-Registry in Kandidaten; `scheduleCandidates()` begrenzt auf drei neue Instanzen und behaelt Dedupe, Cooldowns und Narrativ-RNG. Die Reihenfolge ist fest: Simulation → Facts → Memory/Relationships → Trigger → Scheduler → Events/Choices → Journal/Snapshot. `tickWorld()` ruft die Runtime am Tick-Ende. `src/store/narrative-commands.ts` liefert `flushNarrativeCmd()` und `chooseNarrativeCmd()`; `world-store.ts` flusht nach jeder erfolgreichen Command-Ausfuehrung, nach Neues Spiel, Import und Rivalenspiel — `#emit()` bleibt Darstellung und Save. `spawn.ts` und `guest-service.ts` drainieren nicht mehr selbst. Eine erfolgreiche Choice emittiert `EVENT_RESOLVED`, damit auch der Erfolgsfall einen Folgefakt hat; der naechste Flush verarbeitet ihn genau einmal, nie rekursiv. Das Schema validiert den neuen Fact, der Save-Roundtrip traegt ihn, und der Content-Beitrag bringt die Registry auf 21 Fragmente.

**Pruefungen.** `npx --yes pnpm@10.4.1 run typecheck` war gruen; `verify:quick` bestand alle zehn Gates. `RBD_VERIFY_NO_CACHE=1 npx --yes pnpm@10.4.1 run verify:all` bestand alle zwoelf Gates inklusive Audit und Build; die Suite meldete 652 bestandene und 2 uebersprungene Tests (654 gesamt), 131 Testdateien bestanden und 2 uebersprungen (133). Das Assets-Gate meldete 21 Beitraege, 21 Turns und 21 Registry-Fragmente bei 552 Dateien. Bericht: `.verify-cache/reports/2026-11-03T02-35-24-994Z/summary.md`. Keine neue Abhaengigkeit.

**CI-Nachlauf.** Der erste CI-Lauf auf `89be92a` machte das Doku-Gate rot: `inventory:build` lief vor dem Commit, als die sechs neuen Dateien noch untracked waren, und listete 1109 statt 1115 getrackte Dateien. Der Nachlauf auf dem getrackten Baum brachte 1115/1115; `verify:all` mit `CI=true`, `RBD_VERIFY_AUDIT=1` und ohne Cache bestand danach alle zwoelf Gates. Ein paralleler Push-Lauf auf demselben Commit blieb rot, waehrend der PR-Lauf gruen war. Der Grund war kein Infrastrukturfehler: `narrative-save.test.ts` griff mit `events[0]` auf das erste Event zu und nahm an, dass waehrend der 60 Fixture-Ticks keine Events entstehen. Seit NAR-12 plant der Tick echte `VISITOR_RETURN`-Events, abhaengig vom Zufallsseed; der Test sucht das `SAVE_EVENT` jetzt ueber seine `eventId`.

**Offen.** Die Runtime verwirft Trigger-Treffer, die ueber die Drei-Event-Grenze hinausgehen; das ist bewusst begrenzt, aber noch nicht als eigener Diagnosezaehler sichtbar. `NARRATIVE-ENGINE.md` nennt die Runtime, die UI-Anbindung bleibt NAR-14, die Demand-Migration NAR-13.

## 2026-11-03 - NAR-11: Lokaler Runtime Composer

**Ziel.** Die validierte Registry zur Laufzeit mit Event-Template-Slots verbinden, ohne Textauswahl, Mechanik oder Gameplay-PRNG zu koppeln. Fehlende Slots brauchen lokale, kontextvertraegliche Fallbacks; kein Provider, kein API-Key, keine Textanfrage.

**Umsetzung.** `src/core/sim/narrative/composer/` trennt den `ComposeRequest`-Vertrag, die fail-closed Laufzeitvalidierung, die deterministische Auswahl und die Fassade. `TITLE` mappt auf `opening`, `BODY` auf `description`/`event-body`/`dialog`, `CHOICE_LABEL` auf `choice-preview`, `OUTCOME` auf `reaction`. Locale, Kontextschnitt, `requiredFlags` und Persona-Refs filtern; der stabile Score gewinnt, Gleichstand nach `contributionId`. Es gibt keinen RNG-Import. Fehlende Slots bekommen kurze Fallbacks ohne Fakten, Choice-IDs, Kosten oder Wirkungen. Ungueltige Fragmente und Direktiven werden uebersprungen und im Ergebnis gemeldet; Direktiven bleiben reine AST-Daten. Der NAR-10-Compiler erzeugt zusaetzlich `registry.generated.ts`; `--check` und das Assets-Gate pruefen JSON und TypeScript byte-genau. Der neue Beitrag `runtime-composer-01` dokumentiert den Vertrag und bringt die Registry auf 20 Fragmente.

**Pruefungen.** `npx --yes pnpm@10.4.1 run typecheck`, `narrative:check` und die fokussierten Suiten fuer Composer, Compiler und Content waren gruen (29 Tests). `RBD_VERIFY_NO_CACHE=1 npx --yes pnpm@10.4.1 run verify:all` bestand alle zwoelf Gates inklusive Audit und Build; die Suite meldete 642 bestandene und 2 uebersprungene Tests (644 gesamt), 129 Testdateien bestanden und 2 uebersprungen. Das Assets-Gate meldete 20 Beitraege, 20 Turns und 20 Registry-Fragmente. Bericht: `.verify-cache/reports/2026-11-03T02-13-45-619Z/summary.md`. Keine neue Abhaengigkeit.

**Offen.** Der Composer ist noch nicht an Tick oder UI angeschlossen; die Trigger-Auswahl und Orchestrierung bleiben NAR-12, die Narrative UI NAR-14. `TRIGGER_DIALOG` bleibt bis dahin nicht ausfuehrbar.

## 2026-11-03 - NAR-10: Content-Compiler und Makro-Validierung

**Ziel.** Die 19 Beitraege reproduzierbar in eine Runtime-Registry ueberfuehren: Makros als typisierte ASTs, Konflikte vor dem Schreiben erkennen, `--check` strikt lesend halten und dieselbe Inbox byte-identisch abbilden.

**Umsetzung.** `scripts/lib/narrative-macros.mjs` spiegelt den NAR-08-Parser, prueft die Allowlist, exakte Argumentlisten, stabile ActorRefs, kontrollierte Flags und doppelte Singleton-Commands. `scripts/lib/narrative-compiler.mjs` baut die nach `contributionId` sortierte Registry, erkennt gegensaetzliche Sprecher, unpassende Persona-Nennungen, inkompatible Stimmung, widerspruechliche Story-Flags und unzulaessige Command-Kombinationen und hasht die kanonische Fragmentliste mit SHA-256. `scripts/compile-narrative-content.mjs` schreibt nur bei `--write`; sonst vergleicht es die exakten Bytes. `scripts/verify-narrative-content.mjs` und das bestehende Assets-Gate nutzen denselben Validator. Die Registry ist Version 2, enthaelt nur typisierte AST-Felder und keine Roh-Makros; der neue Beitrag `content-compiler-01` traegt `€FreezeTick:120` als valides Beispiel.

**Pruefungen.** `typecheck`, `verify:assets` und `verify:test-quality` waren nach der Integration gruen. Der Compilerlauf erzeugte 19 Fragmente mit `sha256:4a71453595bac0634d08f90b188bc35034d9f8c4c2bdbb512badd57880c2316d`; `--check` schrieb keine Datei. Die Konfliktproben fuer Sprecher und Stimmung wurden direkt gegen `buildCompiledRegistry` geprueft; die neue Testdatei deckt zusaetzlich Makrogrenzen, Allowlist-Drift, Determinismus, Persona/Flags und Byte-Drift ab. Der vollstaendige `RBD_VERIFY_NO_CACHE=1 pnpm run verify:all` bestand alle zwoelf Gates inklusive Audit und Build; die Suite meldete 633 bestandene und 2 uebersprungene Tests (635 gesamt), 128 Testdateien bestanden und 2 uebersprungen. Bericht: `.verify-cache/reports/2026-11-03T01-56-26-127Z/summary.md`.

**Offen.** NAR-11 baut den lokalen Composer; NAR-10 bindet noch keine Event-Template-Allowlist an die ASTs. Die Compiler-Pruefung ist bewusst strenger als der Runtime-Parser: Content darf nur ausfuehrbare Commands und stabile ActorRefs nennen.

## 2026-11-03 - NAR-09: Content-Registry und Klassifizierung

**Ziel.** Die vorhandene Content-Inbox in einen pruefbaren Textpool verwandeln: Jeder Beitrag bekommt eine kontrollierte Klassifizierung, jeder abgeschlossene Agenten-Turn genau einen Eintrag im Manifest, und die Runtime-Registry wird daraus reproduzierbar abgeleitet, ohne Texte in Simulationscode zu ziehen.

**Umsetzung.** `content/narrative/vocabulary/classification.json` kontrolliert Slots, Funktionen, Slot-Funktions-Kompatibilitaet, Kontexte, Ton, Stimmung, Beziehung und Personas; Rollen, Locales und Flags bleiben in `flags.json`. Alle 18 Beitraege tragen jetzt diese Felder. `content/narrative/turns/manifest.json` ordnet 18 Turn-IDs genau je einem Beitrag zu. `content/narrative/registry/fragments.json` enthaelt die 18 sortierten Fragmente samt Herkunft, Text und Direktiven und wird von `scripts/build-narrative-registry.mjs` aus derselben Validierung erzeugt. `scripts/lib/narrative-content.mjs` prueft Schema, IDs, Dateinamen, Manifest und Registry; `scripts/verify-assets.mjs` ruft die Pruefung im bestehenden Gate auf. Kein neuer Gate-Stack, kein LLM im Spiel.

**Pruefungen.** `npx --yes pnpm@10.4.1 run verify:all` bestand alle zwoelf Gates inklusive Audit und Build; darin waren `typecheck`, `check:loc`, `verify:docs` und `verify:tree` PASS. Die vollstaendige Suite meldete 623 bestandene und 2 uebersprungene Tests (625 gesamt); 127 Testdateien bestanden, 2 wurden uebersprungen. Der Registry-Check und das Assets-Gate meldeten 18 Beitraege, 18 Turns und 18 sortierte Registry-Fragmente. Die zehn neuen Tests decken Schema, unbekannte Klassifizierungen, Slot-Funktions-Konflikte, Direktiven, doppelte IDs, Manifest-Luecken und Registry-Drift ab.

**Offen.** NAR-10 baut den Compiler fuer Makro-AST, Konflikte und byte-identische Registry; NAR-11 den Composer. Die Registry enthaelt bewusst nur validierte Beitraege, noch keine Event-Template-Bindung oder Runtime-Auswahl.

## 2026-11-03 - NAR-08: Command-DSL und Allowlist

**Ziel.** Textbeitraege duerfen Commands deklarieren, aber niemals Code ausfuehren. Event-Templates bleiben die Allowlist; Parser, Preflight und Handler muessen fail-closed zusammenarbeiten, und eine Choice darf auch bei wiederholtem Klick nur einmal wirken.

**Umsetzung.** `narrative/commands/` trennt typisierte AST-Typen, Registry, Parser, Validierung, Preflight und Ausfuehrung. Der Parser akzeptiert nur `€...`-Ausdruecke mit begrenzter Laenge, maximal acht Argumenten und bekannten Wertformen; `FreezeTick` und `trigger Dialog` werden auf stabile Command-IDs normalisiert. Die Registry allowlistet `SET_FLAG`, `ADJUST_RELATIONSHIP`, `FREEZE_TICK` und `TRIGGER_DIALOG`; der Dialog bleibt bis zur UI-Anbindung nicht ausfuehrbar. Choice-Effekte werden direkt in dieselbe AST-Form uebersetzt, Requirements, Kosten, Ziele und Event-Status vor jeder Mutation geprueft. Die Ausfuehrung aktiviert ein `OFFERED`-Event, bucht Kosten ueber das Ledger, wendet Effekte an und setzt `RESOLVED`; ein zweiter Klick scheitert am Lifecycle. Abgelehnte Commands landen als begrenzter `COMMAND_REJECTED`-Fact in der Narrativ-Historie.

**Pruefungen.** `npx --yes pnpm@10.4.1 run typecheck` und `check:loc` gruen; `verify:quick` bestand nach der Exportbereinigung alle Gates, die Schnellsuite meldete 603 bestandene und 2 uebersprungene Tests. `verify:all` bestand alle zwoelf Gates inklusive Audit und Build; die vollstaendige Suite meldete 613 bestandene und 2 uebersprungene Tests (615 gesamt). Die neuen Tests decken Parser-Grenzen, doppelte Argumente, unbekannte und nicht allowlistete Commands, Teilnehmerindizes, Kosten, Fristverlaengerung, die einmalige Ausfuehrung, Wiederholung und `COMMAND_REJECTED` ab.

**Offen.** `TRIGGER_DIALOG` ist nur parsebar, nicht ausfuehrbar; die UI-/Runtime-Anbindung bleibt NAR-14. Trigger-Auswahl und Orchestrierung im Tick bleiben NAR-12, Content-Compiler und Composer NAR-09/NAR-11, die Demand-Migration NAR-13. Weitere Command-Familien folgen erst mit ihren echten Domaenen-Handlern.

## 2026-11-03 - NAR-07: Event-Templates und stabile Choice-Verträge

**Ziel.** Mechanische Event-Struktur testbar machen, ohne Text und Formulierungen zu Spielregeln zu erheben: stabile Template- und Choice-IDs, rollengenaue Teilnehmer, deklarative Requirements/Kosten/Effekte, persistierte Choice-Saetze und eine erneute Pruefung beim Klick.

**Umsetzung.** `events/template-types.ts` und `template-schema.ts` definieren und validieren Templates, Content-Slots, Choices, Requirements, Kosten und Effekte fail-closed. `events/definitions/` registriert `VISITOR_RETURN` und `VISITOR_CONFLICT`; `events/template-candidate.ts` loest Trigger-Teilnehmer rollengenau auf und baut den Scheduler-Kandidaten. `choices/contract.ts` bindet Choice-IDs an `eventId`, `templateId`, `templateVersion` und den persistierten `offeredChoiceIds`-Satz. `choices/eligibility.ts` prueft Lifecycle, Ablauf, Requirements und Kosten rein bei jedem Klick. Event-Instanzen tragen die neuen Metadaten additiv; alte Staende erhalten `eventId`, Version 1 und einen leeren Satz, bleiben also fail-closed nicht ausfuehrbar. Effekte werden noch nicht ausgefuehrt.

**Pruefungen.** `npx --yes pnpm@10.4.1 run typecheck` und `check:loc` gruen. `verify:all` bestand alle zwoelf Gates inklusive Audit und Build; die vollstaendige Suite meldete 598 bestandene und 2 uebersprungene Tests (600 gesamt). Die neuen Tests decken stabile IDs, doppelte/unbekannte Choices, Text-/Mechanik-Trennung, Fristen, Requirements, Kosten, persistierte Choice-Saetze und den Save-Roundtrip ab.

**Offen.** Command-Ausfuehrung und Allowlist (NAR-08), Content-Composer (NAR-11), Tick-Orchestrierung (NAR-12) und Demand-Migration (NAR-13) bleiben offen. Die neuen Templates sind noch nicht in den Tick eingebunden.

## 2026-11-03 - NAR-06: Event-Scheduler, Lifecycle und eigener Narrativ-RNG

**Ziel.** NAR-06 vollstaendig schliessen: Matches in persistente Event-Instanzen ueberfuehren, den Lifecycle zentral absichern, Cooldowns und Scopes trennen, Ereignisketten nur nach aufgeloesten Vorgaengern erlauben und die Auswahl deterministisch ohne den Gameplay-PRNG treffen.

**Umsetzung.** `event-types.ts` beschreibt Instanzen und Kandidaten; `event-lifecycle.ts` ist die einzige Statuswahrheit (`ELIGIBLE → OFFERED/ACTIVE → RESOLVED/EXPIRED/CANCELLED`), setzt Cooldowns je Event-/Teilnehmerkombination und begrenzt abgeschlossene Historie. `event-scheduler.ts` ordnet nach Prioritaet und Fairness, trennt `GLOBAL`/`VISITOR`/`PAIR`/`RIVAL`, verhindert Duplikate, begrenzt Arbeit und nutzt bei Gleichstand den eigenen persistenten Mulberry32-Strom aus `narrative-rng.ts`. `event-schema.ts` validiert und normalisiert alte oder manipulierte Daten fail-closed. Der Boundary ruft `maintainEvents()` auf und raeumt Fristen sowie verwaiste Visitor-/Personal-Endpunkte auch ohne neue Facts auf. Save v9 traegt die neuen Felder additiv; alte Staende erhalten leere Defaults.

**Pruefungen.** `npx --yes pnpm@10.4.1 run typecheck` und `check:loc` gruen; `verify:quick` bestand alle zehn Gates, einschliesslich `dead-code`, `test-quality` und der vollstaendigen Testsuite. Die neuen Tests decken Prioritaet, RNG-Determinismus, Scopes, Duplikate, Cooldowns, Mehrfachausfuehrung, Ablauf, Stale-Cancel, Ketten, Schrittwechsel, Historiengrenze und Save-Roundtrip ab. `verify:all` bestand alle zwoelf Gates inklusive Audit und Build; die vollstaendige Suite meldete 585 bestandene und 2 uebersprungene Tests.

**Offen.** Die Trigger-Auswahl im Tick und der vollstaendige Orchestrator bleiben NAR-12; Event-Templates/Choices (NAR-07), Demand-Migration (NAR-13), Commands, Content-Compiler, Composer und autonome Rivalen sind weiterhin offen. `demandEvent` bleibt bis NAR-13 das bestehende Nachfragesystem.

## 2026-11-02 - NAR-05: Trigger-Context und Condition Evaluator

**Ziel.** NAR-05 vollstaendig schliessen: ein deklarativer Trigger-Vertrag mit echtem Context, Beziehungs- und Zeitfensterabfragen, allen vorgesehenen Operatoren und einer fail-closed Schema-Validierung. Der Evaluator bleibt eine reine Funktion ohne Tick-Eingriff.

**Umsetzung.** `trigger-types.ts` beschreibt Context, Bedingungen, Definitionen und Match-Ergebnisse. `trigger-context.ts` baut aus Welt, Ledger und aktuellem Fact einen unveraenderlichen Snapshot mit Fact-Historie, Flags, Beziehungen, Visitor-Profilen, Hauskonto/Band, Charisma, Ruf, Nachfragestufe, bedienten Gaesten und Geraeteschaden; `actorRefsOfFact()` vereinheitlicht alte `visitorId`-Facts und neue `actorRefs`. `trigger-evaluate.ts` wertet `all`/`any`/`not`, Facts, Erinnerungen, Hauskonto, Geraete, Charisma, Ruf, Nachfrage, Gaeste, Flags, Zeitfenster, `recent-fact`, Akteure und Beziehungen aus und liefert Begruendungen. `trigger-schema.ts` verwirft unbekannte Operatoren, ungueltige Refs, Selbstkanten, negative/unsichere Schwellen und leere Listen; 64 Knoten und Tiefe 12 sind die Grenze. `triggers.ts` bleibt die oeffentliche Fassade.

**Pruefungen.** `npx --yes pnpm@10.4.1 run typecheck` gruen; die vollstaendige Suite lief mit 571 bestandenen und 2 uebersprungenen Tests. `verify:quick` bestand alle zehn Gates, `verify:all` alle zwoelf Gates inklusive Audit und Build. Die neuen Tests decken alle Operatoren, Grenzwerte, Historie, fehlende Visitor-Profile, Unveraenderlichkeit sowie Schema-Negativfaelle ab.

**Offen.** Der Evaluator ist noch nicht in den Tick eingebunden; Aufrufstelle und Cooldowns bleiben NAR-06/NAR-12. Scheduler, Event-Templates, Commands, Content-Compiler, Composer, Demand-Migration und autonome Rivalen sind weiterhin offen.

## 2026-11-02 - Optik und Steuerung: Lichtpfuetzen, Zielraster, Kamera folgt

**Ziel.** Ohne eine neue Spielregel soll der Floor besser lesbar und besser steuerbar werden:
Licht, das Raeume unterscheidet, Hinweise auf dem Boden statt in Panels, eine Kamera, die der
Figur folgt, und ein HUD, das keine leere Zeile mehr mitzeigt.

**Umsetzung.**

- `floor-surface.ts`: Lichtpfuetzen in 16 Stufen (alpha 0,009 bis 0,02), hellere Deckenlampen
  und Wandlichtkanten, Laufweg-Abdunklung von 0,34 auf 0,26. Die Stufen sind bewusst viele
  und leise: drei deckende Ellipsen lasen im Browser als Radarringe und liefen ueber die Wand
  hinaus; erst die vielen Stufen und die auf den Raum begrenzten Halbachsen ergaben Licht.
- `src/render/floor-cues.ts` (neu): Zielraster unter dem Zeiger, Spielerring, Punktspur des
  Laufwegs, Klick-Puls. Die Farbe zeigt die Folge: Service heisst laufen, Identity heisst
  heranziehen. Nach einer Kamerafahrt wird das Raster ueber die letzte Zeigerposition neu
  gesetzt, sonst zeigt es auf eine Kachel, die nicht mehr unter dem Zeiger liegt.
- `floor-camera.ts`: `pan`, `zoomStep`, `keepInView`. Die Kamera zieht erst nach, wenn die
  Figur den inneren Rahmen (55 Prozent der halben Sicht) verlaesst; in der Uebersicht und auf
  dem Rueckweg dorthin bleibt sie mittig. Ohne die zweite Bedingung zog `keepInView` den
  Fokus waehrend des Herauszoomens zur Figur und `0` landete neben der Mitte (camX 498 statt
  385 bei 1582 Pixeln Breite).
- `floor-touch.ts` traegt jetzt alle Zeigergesten (Rad, Pinch, Ziehen mit mittlerer oder
  rechter Taste). Der Wheel-Handler ist aus `floor-view.ts` dorthin gewandert; das Budget der
  Datei bleibt bei 349/350, weil die neue Ebene und der Handler zusammen mehr Zeilen brauchten
  als der alte Wheel-Block.
- `stage-controls.tsx` (neu) und `app.css`: Tastenkuerzel als kbd-Chips, Kamera-Knoepfe unten
  rechts, Vignette und Rasterhintergrund auf der Buehne, Barkauf-Ziel als Chip in der
  RPG-Zeile (die vorher eine leere Vollbreite-Leiste ohne jede CSS-Regel war), XP-Balken.
- Bildsprache als Blatt: `docs/banners/art-direction-neon-ledger.png` und die Philosophie in
  `docs/ART-DIRECTION.md`, damit die naechste Aenderung nicht neu geraten wird.

**Pruefungen.** Browser ueber agent-browser (Chromium 156, 1600x1000 und 1000x720): Uebersicht
mittig (camX 385 bei 1582 Pixeln Buehne), Rechtsziehen schwenkt mit dem Zeiger, Rad und `+`/`-`
zoomen, `0` kehrt zur Uebersicht zurueck, WASD laeuft und die Kamera zieht nach (camX 125 auf
-471), Zielraster wechselt die Farbe zwischen Detail und Uebersicht, Laufwegspur erscheint
beim Klick. `pnpm run typecheck` gruen. `pnpm run verify:quick` war auf dem eigenen Stand gruen
(zehn Gates, 520 Tests bestanden, 2 uebersprungen). Nach dem Rebase auf `origin/main` (PR #54) laufen
lokal zwei load-empfindliche Nachweise in der vollen Parallelitaet in ihr Zeitlimit — `process-sweep`
(Warten auf das Prozessende) und `slot-paylines` (RTP-Volllauf: 95 s allein gegen 120 s Budget);
beide bestehen in Isolation (12 von 12). Sie beruehren weder Renderer noch Kamera. Den vollstaendigen
Nachweis traegt wie vorgesehen CI (`verify:all`). Neuer Test `floor-camera.test.ts` mit sechs Faellen; drei
davon waren zuerst rot, weil ich die Zugrichtung des Schwenks und die Lerp-Toleranz falsch
angenommen hatte — die Kamera war richtig, die Erwartung nicht.

**Bilder.** Der Belegsatz liegt neu in `docs/screenshots/v0.3.78/` (fuenf Bilder, 1280 x 860, Tag 1
ueber den normalen Ladeweg statt eines vorbereiteten Speicherstands): Uebersicht, Detail, Bauen,
Gaeste, Hilfe. Die Wurzel-README stellt vier davon Bild fuer Bild gegen `current/` (v0.3.27), gleiche
Etage, gleicher Ausschnitt, und benennt auch, was der Vergleich nicht zeigt: Gaestezahl und
Katalogumfang stammen aus anderen Spielstaenden, die Freebuff-Plakette der alten Aufnahmen aus der
damaligen Umgebung. Beim Aufnehmen fiel auf, dass die Hilfekarte die neuen Griffe nicht nannte; sie
listet jetzt Rechtsziehen, `+`/`-` und `0`. Die Ablageregel in `docs/screenshots/README.md` kennt
versionierte Spielsaetze als eigenen Ordner; ein aelterer Satz wird nicht ueberschrieben.

**Offen.** Lichtpfuetze gilt je Zone und Chunk: eine Zone, die ueber eine Regionskante reicht,
bekommt je Chunk eine eigene Pfuetze; bei sehr grossen Saelen entsteht dort eine sichtbare
Naht. Ziehen per Touch ist nur im Code vorhanden, nicht auf einem echten Geraet geprueft. Der
Klick in der Uebersicht zieht weiterhin heran statt zu laufen: bewusst, weil ein Klick ohne
Rueckmeldung sonst nicht von einem Fehlklick zu unterscheiden waere.

## 2026-11-02 - NAR-04: Beziehungen aus echten Quellen

**Ziel.** NAR-04 vollstaendig schliessen: Beziehungen zwischen Besuchern, Haus, Personal und Rivalen aus echten Spielereignissen, kanonisch persistiert und ohne zweiten Fact-Drain.

**Umsetzung.** `VISITOR_CONFLICT` entsteht in `maybeStartBrawl()` und erzeugt zwei gerichtete Besucherkanten; die angegriffene Seite verliert mehr Vertrauen. `VISITOR_SERVICE` entsteht nur bei anwesendem Kassierer in `arriveAtDesk()`/`cashierTick()` und erzeugt Besucher→Personal. `RIVAL_ENCOUNTER` entsteht bei `settleCardOutcome()` und `visitRivalWithJournal()` aus dem Nettofluss einer echten Abrechnung und erzeugt Rivale→Haus. Alle drei nutzen `actorRefs` statt Pflicht-`visitorId`; `fact-schema.ts` validiert sie beim Laden, `relationship-apply.ts` wendet sie an. Kanten sind auf 200 begrenzt, auf `-10..10` geklemmt, nach Tick und Akteurspaar sortiert und beim Laden dedupliziert. Der Barkeeper hat weiterhin kein individuelles Serviceereignis; diese Luecke wird nicht mit einer Attrappe geschlossen.

**Pruefungen.** `npx --yes pnpm@10.4.1 run typecheck` und `check:loc` gruen. 21 gezielte Tests in fuenf Dateien gruen: Streit (drei), Kasse (zwei), Rivalenabrechnung (drei), Fact-Schema ohne `visitorId` (drei), Beziehungen/Save-Roundtrip (zehn). Der Rivalen-Test deckte zuerst einen Laufzeitfehler auf, weil `RIVAL_IDS` nur ueber `export type *` re-exportiert wurde; der Import kommt jetzt direkt aus `types-model.ts`. Der Personal-Test brauchte ein eroeffnetes Hauskonto fuer die Einstellung.

**Offen.** Trigger-Integration (NAR-05), Scheduler/Templates (NAR-06/07), Demand-Migration (NAR-13), Commands, Content-Compiler, Composer, autonome Rivalen und Soak bleiben offen. Unterstuetzungs-/Versprechens-Facts haben noch keine echte Quelle; sie werden nicht simuliert.

## 2026-11-02 - Ein Fact-Drain, Ledger-Cursor und Beziehungsgrundlage

**Ziel.** Die offenen NAR-02/03-Reste schliessen, die vor NAR-04 blockieren: Fact-Referenzen ohne Pflicht-Visitor, ein Ledger-Cursor, ein einziger Consumer und referenzsichere Retention.

**Umsetzung.** `processNarrativeBoundary()` ist jetzt der einzige Drain; er erzeugt zuerst Hauskonto-Schwellen (`HOUSE_BALANCE`), drainiert dann die Queue und verteilt an Erinnerungen und Beziehungen. Der Cursor liegt als Ledger-`seq` in `narrative.ledgerSeq`; der erste Lauf setzt ihn ohne historische Facts. `relationships.ts` fuehrt gerichtete Kanten zwischen persistenten Akteuren mit Trust, Sympathie, Konflikt und Einfluss; ein guter oder schlechter Besuch verschiebt `visitor:<id> -> player`, neutrale Besuche erzeugen keine Kante. Beziehungsendpunkte pinnen ihre Visitor-Profile; die Retention verdraengt nur ungepinnte bestehende Profile und laesst die Liste bei vollstaendig gepinnter Belegung bewusst ueber dem Cap.

**Pruefungen.** `npx --yes pnpm@10.4.1 run typecheck`, `lint`, `check:loc` und `verify:dead-code` gruen; Narrativ-, Visitor- und Save-Tests gruen. Der erste Retention-Test war rot, weil der neue Besucher sich selbst verdraengte; die Auswahl schliesst den neuen Datensatz jetzt aus.

**Offen.** NAR-04 war zu diesem Zeitpunkt nur begonnen; der naechste Eintrag schliesst die weiteren Fact-Quellen ab. Trigger-Integration, Scheduler, Templates, Commands, Content-Compiler und Composer fehlen weiterhin. Die Demand-Migration (NAR-13) bleibt vor der Tick-Integration (NAR-12).

## 2026-11-02 - Nachfrageereignis auf Narrative-Zustand vorbereiten

**Ziel.** Den Zustand der vorhandenen Nachfrageveranstaltungen fuer die spaetere Event-Engine vereinheitlichen, ohne die Nachfragebalance zu aendern.

**Umsetzung.** Das aktive Event liegt in `narrative.demandEvent`. Alte v5–v9-Saves uebernehmen laufende Veranstaltungen, neue Saves enthalten keine zweite Kopie. Die bestehende Planung in `demand.ts` bleibt unveraendert.

**Pruefungen.** `pnpm run typecheck` und `RBD_VERIFY_AUDIT=1 npx --yes pnpm@10.4.1 run verify:all` bestanden; das Full Gate umfasst Nachfrage-, Save-Migrations- und weitere Tests, Audit und Build.

**Offen.** Es gibt noch keinen allgemeinen Scheduler, keine Dialoge oder Choice-Effekte und keine autonomen Rivalen. NAR-13 ist nur vorbereitet, nicht abgeschlossen.

## 2026-11-02 - Narrative-Dokumentation nach Merge wiederherstellen

**Ziel.** Nach PR #52 verlorene Narrative-Dokumentation wiederherstellen, ohne die Engine als abgeschlossen darzustellen.

**Umsetzung.** Fehlende Eintraege aus dem lokal gesicherten Stand mit dem gemergten Code und Architekturvertrag abgeglichen; Changelog, fruehere Tagebucheintraege, Inventar, Roadmap und Agentenregeln ergaenzt. Composer und Compiler bleiben als geplant gekennzeichnet; die Laufzeit bleibt ohne LLM.

**Pruefungen.** Lokales `verify:quick` und GitHub-Pflichtstatus pruefen diesen Dokumentationsstand; keine Spielregeln geaendert.

**Offen.** Der Evaluator ist nicht integriert; weitere Grundlagen, Scheduler, Dialoge, Commands, Compiler, Demand-Migration und Rivalen fehlen.

## 2026-11-02 - Narrative Trigger Bedingungen

**Ziel.** Narrative Trigger Bedingungen.

**Umsetzung.** Ein reiner Evaluator verknuepft ausgewaehlte bestehende Facts mit Erinnerung, Hauskonto, Geraetezustand, Charisma, Flags und Fact-Alter; AND, OR und NOT sind kombinierbar. Kein bestehender Simulationspfad wird damit veraendert.

**Pruefungen.** `npx --yes pnpm@10.4.1 run verify:all`: alle zwoelf Gates bestanden, einschliesslich Trigger-Tests. Der Runner meldete zusaetzlich `fatal: bad revision 'origin/main...HEAD'` bei der Git-Referenzabfrage; das Profil meldete dennoch PASS.

**Offen.** Der Evaluator ist nicht an die Simulation angeschlossen. Weitere Facts, Ledger-Cursor, Beziehungen, Scheduler, Dialoge, Commands, Content-Compiler, Demand-Migration und Rivalen fehlen.

## 2026-11-02 - Narrativ-Grundlagen und LLM-freier Eventplan

**Ziel.** Narrativ-Grundlagen und LLM-freier Eventplan

**Umsetzung.** Die Start-Pool-Facts zaehlen die bereits bei der Anlage gesetzte Poolgroesse nicht erneut. Die Save-Normalisierung prueft Fact-Nutzdaten, sortiert IDs und entfernt Duplikate; der Cursor bleibt auch bei unvollstaendigen Daten erhalten. Der Eventplan schliesst Provider und LLM im Spiel aus und kennzeichnet verbleibende Grundlagen sowie v5–v9-Demandmigration als offen.

**Pruefungen.** `npx --yes pnpm@10.4.1 run verify:all`: alle zwoelf Gates bestanden, einschliesslich Lint, Typecheck, Save-/Narrative-Tests und Build. Der Runner meldete zusaetzlich `fatal: bad revision 'origin/main...HEAD'` bei der Git-Referenzabfrage; das Gate-Profil meldete trotzdem PASS.

**Offen.** Event-Scheduler, Beziehungen, Content-Compiler, Commands, UI und autonome Rivalen sind weiterhin nicht implementiert; keine Promotion ohne vollstaendigen Nachweis.

## 2026-11-02 - Tooling-Ausgabe strukturiert, Wegwerf-Skripte verboten

**Ziel.** Die Agent-Werkzeuge sollen ohne Rueckfrage lesbar sein: strukturiert, menschlich lesbar, token-optimiert. Ad-hoc-Skripte fuer jede Kleinigkeit sollen nicht mehr entstehen.

**Umsetzung.** `summarize()` in `scripts/lib/impact.mjs` druckt eine feste Beschriftungsspalte mit einer Zeile je Feld. `scripts/agent-verify.mjs` zeigt eine Gate-Tabelle mit Status und Dauer aus `lastGateRows()` (`scripts/lib/gate-runner.mjs`) und kennt `--plan` fuer den Plan ohne Lauf. `scripts/verify-tree.mjs` meldet Wegwerf-Dateien als `ERR-4019`; die Regel steht in `AGENTS.md` unter Pitfalls.

**Nachtrag.** `--line` verdichtet beide Werkzeuge auf eine Zeile; `RBD_VERIFY_QUIET=1` unterdrueckt die Zeile je Gate, damit neben der Tabelle keine zweite Ausgabe steht.

**Global.** `rtk rg` scheiterte mit `program not found`, weil ripgrep fehlte. ripgrep 15.2.0 liegt jetzt im PATH (`WindowsApps`), die rtk-Konfiguration ist gesichert (`config.toml.bak-2026-11-02`) und auf `max_width = 100`, hoehere Suchlimits und stillen Hook-Hinweis gesetzt. Damit sind `rtk ls/find/read/rg/git/pnpm` die Standardbefehle, `agent:context` bleibt der primaere Einstieg.

**Pruefungen.** `node --check` fuer die vier Skripte, `pnpm run agent:context`, `pnpm run agent:verify -- --plan`, `pnpm run verify:tree`, `pnpm run verify:docs`, `pnpm run check:loc`.

**Offen.** Die Testsuite lief in diesem Schritt nicht; der Nachweis gehoert in den Abschlusslauf und braucht vorher die Freigabe des Nutzers.

## 2026-11-02 - Peer-Review Phase 6: Tick-Konstante, Testspin, Texte, Portabilitaet

**Ziel.** Peer-Review Phase 6: Tick-Konstante, Testspin, Texte, Portabilitaet

**Umsetzung.** Die Peer-Review-Befunde wurden gegen `main` (8d08640) verifiziert und umgesetzt. `TICK_MS = 520` steht jetzt einmal in `src/core/sim/tick-timing.ts`; `world-store`, `floor-view`, `games-popup`, `guest-popup` und `self-exclusion-panel` lesen daraus statt aus Literalen. `spinTest` ruft `spinTestCmd` nur noch einmal auf. Das tote `movement-queue`-Modul samt Test und ERR-3002 ist entfernt. Texte: "DER GEBER MISCHT" korrigiert, Mojibake in `table-launcher` entfernt, Asset-Zaehler aus `imageCount` berechnet. Portabilitaet: `src/Config/opencode.json` nutzt einen relativen Pfad, `scripts/encode-audio.mjs` bricht ohne `RBD_AUDIO_SOURCE` mit Hinweis ab. Befunde 33 und 37 waren auf `main` bereits behoben, 38 ist veraltet.

**Pruefungen.** `pnpm run typecheck` und `pnpm run lint` exit 0. `pnpm run test`: 109 Dateien bestanden, 2 uebersprungen; 524 Tests bestanden (vorher 532, Differenz = entfernter movement-queue-Test). `pnpm run catalog` regeneriert `docs/TEST-CATALOG.md`.

**Offen.** Spielregel-Entscheidungen bleiben beim Nutzer: VELVET, FREE_DRINK, EXTRA_REEL, Einsatzskalierung in `offerScore`, `payDailyWage`, Schuldentilgung, Pity-RTP (~99,15 %). `EXTRA_SYMBOLS`-Schluessel passen nicht zum Manifest (`GRAPE_CLUSTER`/`LUCKY_SEVEN` gegen `GRAPE`/`SEVEN`), visuelle Entscheidung. Befund 39 (doppelter Asset-Check) ist offen und ungeprueft.

## 2026-11-02 - Tip release-faehig machen (0.3.73)

**Ziel.** Nicht nur der Merge-Commit, sondern die aktuelle Spitze von `main` soll gruen und release-konsistent sein.

**Umsetzung.** `main` stand nach dem Merge weiter auf `ee39c83`; die Release-Automation committet bewusst nichts. Der Pflicht-Check war fuer genau diesen SHA per `workflow_dispatch` gruen, `verify:all` lief ohne Cache mit CI-Audit 12/12. Inkonsistent war nur das Release: `package.json` sagte 0.3.72, der Tag `v0.3.72` zeigt aber auf `7b50913` (PR #40), und der Release-Lauf nach dem API-Merge endete als `skipped`, weil er nur auf `push`-Workflow-Laeufe reagiert. Deshalb der Patch-Sprung auf 0.3.73: ein neuer Tag am Tip, ohne den bestehenden `v0.3.72` zu verschieben.

**Pruefungen.** `version-bump` schreibt `package.json` und `Config`-Kennung; `verify:all` ohne Cache mit `RBD_VERIFY_AUDIT=1` auf dem Tip-Baum 12/12 gruen; Befundnotiz zu VELVET/FREE_DRINK/EXTRA_REEL ist in `docs/INVENTORY.md` vorhanden.

**Offen.** Die drei Mod-Entscheidungen (Gaesteguete, Drink pro Spin, vierte Walze) bleiben beim Nutzer.

## 2026-11-02 - Roter Pflichtstatus war das PR-Body-Gate

**Ziel.** PR #44 mergen, ohne einen Check zu umgehen.

**Umsetzung.** Zwei Laeufe pro Commit: der Push-Lauf bestand `verify:all` mit 12/12 Gates, der PR-getriggerte Lauf brach nach rund 15 Sekunden mit Exit 1 ab. Ein Test auf den Workflow-Dateien (`ci-gates.test.ts`) haelt fest, dass beide Trigger bleiben muessen, also lag der Fehler nicht im Workflow, sondern im PR-Body: das Gate `verify-commit-msg --pr` verlangt die drei Pflichtsektionen, und der Body trug sie nicht. Der Body wird deshalb aus dem Commit-Body gehoben; die Trigger und `cancel-in-progress` bleiben unveraendert.

**Pruefungen.** `RBD_VERIFY_AUDIT=1 RBD_VERIFY_NO_CACHE=1 pnpm run verify:all` deckte den eigentlichen Fehler auf: der Test `Main-Gate > prueft Pushes auf main und Pull Requests gegen main` fiel nach dem Trigger-Umbau rot — der Umbau wurde zurueckgenommen.

**Offen.** Keine Code-Aenderung am CI-Workflow; das PR-Body-Gate bleibt scharf.


## 2026-11-02 - Befundnotiz: drei Mods ohne Mechanik

**Ziel.** Die zwei Audit-Luecken, die eine Spielregel brauchen (VELVET/FREE_DRINK ohne ihre beschriebene Wirkung, EXTRA_REEL ohne zusaetzliche Walze), so festhalten, dass sie nicht wieder zwischen Code und Doku verschwinden — ohne eine Regel zu erfinden.

**Umsetzung.** `docs/INVENTORY.md` hat jetzt einen Abschnitt „Offene Design-Entscheidungen: Mods ohne Mechanik" mit einer Zeile je Mod: Versprechen, tatsaechlicher Effekt und die eine Frage, die der Nutzer beantworten muss. VELVET verspricht bessere Gaeste, liefert aber nur Anziehung und weniger Geduld; eine Guetev erschiebung wuerde die Wirtschaftsrechnung des Abends aendern. FREE_DRINK verspricht einen Drink pro Spin, liefert Geduld und Betriebskosten; offen ist, ob das Haus pro Spin wirklich bucht. EXTRA_REEL verspricht eine vierte Walze, die Walzenzahl kommt aber aus `item.reels`; offen ist, ob der Mod schenkt oder rabattiert. Keine dieser drei Fragen ist durch Umbuchung beantwortbar, deshalb bewusst keine Code-Aenderung.

**Pruefungen.** `inventory:build` 1028/1028 Dateien, `docs:sync` sechs Marker, `typecheck`, `lint`, `check:loc`, `verify:docs`, `verify:dead-code`, `verify:test-quality`, `verify:tree`, `verify:redundancy`, `verify:assets`, `build` je Exit 0, volle Suite 532/532 gruen.

**Offen.** Die drei Entscheidungen selbst; bis dahin bleibt der Shop an diesen Stellen teurer als sein Effekt.


## 2026-11-02 - Pity als Vorschuss, Wut aus Geduld, Sucht am Einsatz

**Ziel.** Fünf offene Punkte schließen: Pity-RTP, Wut-Auslöser, Suchtfolgen, tote Felder und das nicht auszahlbare Bonus-Guthaben.

**Umsetzung.** Die Entladung war ein zweiter Gewinn auf einem Polster, das schon aus Hausvorteil gefüllt war — deshalb stieg der gemessene RTP Richtung 100 %. `settleSlotSpin` führt den Topf jetzt signiert: eine Entladung darf ihn überziehen, der negative Stand ist ein Vorschuss und wird von späteren Gewinnen abgezogen. Wut löste `decay` bei `mood < 12` aus, obwohl Journal und Mods von Geduld sprechen; entschieden ist die Geduld, geprüft vor dem +0,02-Tropfen. `addictedStake` hebt den Einsatz um bis zu 50 %, `sessionSpins` verlängert die Sitzung von vier auf neun Spins. `social` ist aus dem Bedürfnis-Typ entfernt, `cashOutPlayerCash` macht das Bonus-Guthaben auszahlbar. `Persona.patience` bleibt, weil sie seit dem vorherigen Commit über `rollProfile` gelesen wird.

**Pruefungen.** Fail-First mit zurückgerollten Dateien: sechs Tests rot (fehlender Export plus beide Wut-Fälle), danach 13/13 grün; `typecheck`, `lint`, `check:loc`, `verify:docs` je Exit 0, volle Suite grün.

**Offen.** Einsatzaufschlag und Sitzungsdauer sind gedeckelt; HIGH_ROLLER spielt weiterhin nicht über den Mindestsatz des Geräts.


## 2026-11-02 - Synergie-Audit: tote Persona-Geduld und Mods ohne Wirkung

**Ziel.** Systematisch suchen, wo Mechaniken sich gegenseitig tragen sollten, es aber nicht tun: geschriebene Felder ohne Leser, verkaufte Mods ohne ihre beschriebene Wirkung und Personas, die nur als Gewicht auftauchen.

**Umsetzung.** Ein Befund war reine Verdrahtung: `Persona.patience` (68 bis 138) wurde nirgends gelesen, weil `makeGuest` die Geduld zu gleichen Teilen aus dem 180-Punkte-Pool zog — der Stammgast startete sogar ungeduldiger als der High Roller (51,1 gegen 63,9 im Messlauf), weil seine hohe Suchtrate den Geduldanteil verdrängte. `rollProfile` nimmt die Persona-Geduld jetzt als eigenes Gewicht (`patience / 100`) neben der Suchtrate; weil der Pool weiterhin exakt 180 Punkte verteilt, bleibt die Invariante aus `world.test.ts` und `tycoon-needs.test.ts` erhalten. Die übrigen Befunde stehen als Bericht in `docs/INVENTORY.md`, weil sie Spielregel-Entscheidungen brauchen: `VELVET` und `FREE_DRINK` versprechen bessere Gäste und einen Drink pro Spin, liefern aber nur Anziehung und Geduld; `EXTRA_REEL` erhöht nur die Anziehung, die Walzenzahl kommt aus dem separaten Upgrade; `PLAYER_CASH` wird nur gutgeschrieben (Pakt-Bonus) und als Anzeige gelesen; der Einsatz bleibt `max(minBet, baseBet)` und skaliert nie mit dem Persona-Budget.

**Pruefungen.** Fail-First: `persona-patience.test.ts` lief auf dem Stand vor dem Commit rot (Stammgast 51,1 war nicht geduldiger als High Roller 63,9), nach dem Fix 2/2 grün, `typecheck` Exit 0. Der Befundbericht ist aus Greps belegt: `PLAYER_CASH` erscheint nur in `self-exclusion-bet.ts` als Ziel einer Buchung, `VELVET`/`FREE_DRINK` nur in `offers.ts` und der Rivalen-Deko, `reelPull` liest `item.reels` statt der Mods.

**Offen.** Die vier verbleibenden Punkte sind bewusst nicht gefixt: sie ändern Spielregeln oder Preise (Gratis-Drink pro Spin, Samt-Gäste, vierte Walze als Mod, Ausgabe von `PLAYER_CASH`) und brauchen eine Entscheidung, keine Umbuchung.


## 2026-11-02 - Lohn nur für geleistete Schichten

**Ziel.** Befund 2 schließen: `payDailyWage` zahlte weder Anwesenheit noch Arbeit, weshalb ein Spieler mit angenommenem Job fünf Tage lang 60 VC kassierte, ohne den Floor zu betreten — bezahlt aus `EXTERNAL`, also aus dem Nichts.

**Umsetzung.** „Gearbeitet" heißt jetzt: mindestens eine abgeschlossene Schicht. `completeJobTask` stempelt dafür `lastWorkDay = world.day`; `payDailyWage` zahlt nur, wenn `lastWorkDay >= world.day - 1` gilt, also für die Schicht des Vortags am Tageswechsel (der Tag wird in `staffTick` vor dem Lohn hochgezählt). Damit gibt es höchstens einen Lohn pro Tag und keinen Cent für untätige Tage; `workDays` wuchs schon vorher nur in `completeJobTask` und bleibt bei Nichtstun stehen. Bodenaufenthalt ohne Schicht zählt bewusst nicht: die Schicht ist die Arbeit, die das Spiel bezahlt. Alt-Saves kennen `lastWorkDay` nicht; `hydrateWorld` setzt es auf 0 („noch keine Schicht"), was ohne Schicht nie einen Lohn freischaltet — keine Nachzahlung, kein Absturz, keine Versionserhöhung nötig, weil das Feld nur additiv ist.

**Pruefungen.** Fail-First mit zurückgerolltem `player-jobs.ts` und `migrate.ts`: 6 von 12 neuen Tests rot (Nichtstun zahlt, Nachzahlung nach fünf Tagen, Alt-Save ohne anerkannte Schicht), die sechs grünen sind Gegenproben (Lohn nach Schicht, `workDays`-Zuwachs, Laden ohne Fehler). Danach 36/36 in vier Dateien grün, `typecheck` 0. Drei bestehende Lohntests in `player-jobs.test.ts` bauen jetzt die Schicht ein, die ihre Aussage voraussetzt; ihre Behauptung (Lohn, Buchungsquelle, kein Doppellohn) ist unverändert.

**Offen.** Der Lohn gilt pro Schicht, nicht pro Stunde: zwei Schichten an einem Tag zahlen einen Tageslohn. Das ist die bestehende Lohnsemantik und wurde nicht angefasst. Weiterhin offen aus dem Audit: Pity-RTP, Schulden ohne Tilgung, tote `PLAYER_CASH`, wirkungslose Sucht, nie skalierender Einsatz.

## 2026-11-02 - Deckung an der Kasse, erreichbare Eskalation und gezählte Gäste

**Ziel.** Sechs Befunde aus dem Audit schließen, die reine Verdrahtung sind und keine Balance-Entscheidung verlangen: Deckung am falschen Ort, unerreichbare Eskalation, Gästezählung ohne Spiel, JACKPOT ab 1,0x, stehenbleibende Wut und zwei verschiedene Bar-Kapazitäten.

**Umsetzung.** `simulateMugging` maß die Wachdeckung an `world.player.position`, obwohl der Kommentar die Kasse nennt und das Geld dort liegt; `muggingCoverPoint` liefert jetzt den Wechseltisch und fällt nur ohne Kasse auf den Spieler zurück. `tickDisputes` setzte Stufe 2 ab `ticks > 6`, während `angerTick` den ANGRY-Zustand nach fünf Ticks beendet — die Schlägerei war damit strukturell unerreichbar; `disputeLevelForTicks(ticks)` kippt nach vier Ticks und ist als reine Funktion geprüft. `guestsServed` wuchs bei jedem Auszahlen, auch ohne einen einzigen Spin; der Wert speist Ruf und KASSE-Stufe, also zählt jetzt nur `guest.spins > 0`. Das JACKPOT-Label hing an `multiplierBps >= 10_000`, also an einem Push; `isJackpotLabel` verlangt 2,5x. `decay` ließ `guest.anger` unangetastet, weshalb ein geschlichteter Gast bis zum Abgang wütend aussah; die Wut sinkt jetzt, solange der Gast nicht randaliert. Bar-Kapazität: `barCapacityForLevel` (12 + 8 × Level) stand im Core, während HUD, Diagnose und Automaten-Popup 6 + 6 × Level anzeigten — alle drei lesen jetzt den Core.

**Pruefungen.** Fail-First mit zurückgerollten Fixes: 10 von 12 neuen Tests rot, die zwei grünen sind die Gegenproben (ANGRY behält seine Wut, Spin zählt weiter). Danach `pnpm exec vitest run` auf die sechs neuen Dateien 12/12 grün, `pnpm run typecheck` und `pnpm run lint` je Exit 0, Gesamtsuite 503 grün. `demand.test.ts` nutzte `guestsServed` als Stellvertreter für „ausgezahlt"; der Gast dort hat jetzt zwei Spins, damit die Auszahlungsprüfung unverändert bleibt und die neue Regel in `guests-served.test.ts` belegt ist.

**Offen.** Die Balance-Befunde bleiben offen: Pity-Entladungen (99,15 % RTP am Startautomaten), Löhne ohne Anwesenheit (`payDailyWage` braucht dafür ein Tagesmerkmal im Save), Schulden ohne Tilgung, tote `PLAYER_CASH`, wirkungslose Sucht und der nie skalierende Einsatz. Sie brauchen Spielregel-Entscheidungen, keine Verdrahtung.

## 2026-11-02 - Dreck, Video Poker und Ueberfaelle an der Ursache

**Ziel.** Die vier offenen Befunde schliessen: falsche Kacheladresse beim Dreck, falsche Video-Poker-Raenge, verdeckte Dreckschicht, verschluckte Ueberfallverluste.

**Umsetzung.** Der Dreck-Schreiber und der Dreck-Leser waren sich uneinig: `dirtyNear` dekodiert `x = index % size`, `y = floor(index / size)`, waehrend `tick.ts` und `disputes.ts` `(y+1)*size+x+1` schrieben — jeder Randale- und Streitfleck lag eine Kachel schraeg daneben, teils ausserhalb des Bodens. Die Adresse steht jetzt einmal als `dirtyTileIndex(size, x, y)` in `emotion.ts`, direkt neben dem Leser; alle vier Schreiber (`tick`, `disputes`, `needs`, `guest-play`) nutzen sie. Video Poker: `royal` verlangte keine Farbe, jede 10-bis-Ass-Strasse zahlte 250x, und das Wheel A-2-3-4-5 wurde als `NOTHING` gewertet; beides folgt jetzt der interaktiven Engine (`straightHigh && flush`, zusaetzlich `wheel`). `evaluatePokerHand` ist dafuer exportiert. Die Dreckschicht war erstes Kind des Moebel-Containers und lag damit unter allen Moebeln; sie ist jetzt ein eigenes `dirt`-Feld im Szenen-Cache und wird in `floor-view` zwischen Teppich und Moebeln eingehaengt. Im Wirtschaftsbericht stieg `classify` bei `from !== HAUSKONTO` aus, bevor der Ueberfallstopf geprueft wurde — ein Ueberfall auf das Portemonnaie (`simulateMugging` waehlt das groessere der beiden Konten) verschwand lautlos. Die Pruefung steht jetzt vor dem Quellkonto-Filter.

**Pruefungen.** Fail-First: `dirty-index.test.ts`, `economy-losses.test.ts` und `video-poker-ranks.test.ts` liefen zuerst mit 8 roten Tests (zwei fehlende Exporte, sechs falsche Ergebnisse), danach 9/9 gruen; der Hauskonto-Ueberfall war schon vorher gruen und bleibt die Baseline. `pnpm run typecheck` und `pnpm run lint` je Exit 0. Der volle `verify:all` folgt am Turn-Ende.

**Offen.** Fuer die Schichtreihenfolge gibt es keinen Unit-Test — PixiJS laesst sich in jsdom nicht sinnvoll aufbauen; sie ist ueber Typecheck, Build und einen Screenshot am Dev-Server geprueft. `mugging.ts` selbst bleibt unveraendert: die Wahl zwischen Kasse und Brieftasche ist Spielregel.

## 2026-11-02 - Governance-Quellen entdoppelt: ein Fehlerregister, eine Subsystemliste, eine Eskalationsleiter

**Ziel.** Governance-Quellen entdoppelt: ein Fehlerregister, eine Subsystemliste, eine Eskalationsleiter

**Umsetzung.** Vier Governance-Definitionen lagen mehrfach vor. `scripts/lib/error-codes.mjs` liest jetzt das Register `src/core/governance/error-codes.ts` selbst; `report.mjs` reicht `catalogCodes()` nur noch weiter, die Markdown-Tabelle ist Dokumentation statt Pruefgrundlage. Ursache des Umbaus war `ERR-1001`: `verify-test-quality.mjs` feuerte den Code, er stand in keinem Register, `line()` degradierte ihn still zu `ERR-0000` — der eine Zustand, der sofort blockiert. Der Code ist jetzt registriert. `issues.ts` und `transfer.ts` benutzen `ERROR_CODES.TRANSFER_INVALID.code`. `scripts/lib/subsystems.mjs` haelt Subsysteme (Prefix, Name, Katalogrolle, Impact-Doku, Invarianten) und die Ordnerregeln; Tree-Gate, Testkatalog, `subsystemOf` und die Impact-Bereiche leiten daraus ab. Die Eskalationsleiter steht als `src/Config/escalation-levels.json`; `escalation.mjs` liest die Datei, `issues.ts` traegt dieselbe Liste typisiert, ein Test vergleicht beide.

**Pruefungen.** `node -e` gegen die neue Bruecke meldet 30 registrierte Codes und `ERR-1001` als bekannt; die Leiter liest `AUTO_FIX -> LOCAL_GATE -> REMOTE_CI -> AGENT -> BLOCKED`; das Tree-Gate laeuft direkt mit PASS. `vitest run` auf `escalation.test.ts`, `dependency-governance.test.ts` und `transfer.test.ts` ergibt 10 gruene Tests. Der volle Lauf steht am Turn-Ende.

**Offen.** `verify-redundancy.mjs` liest `docs/ERROR_CATALOG.md` weiterhin direkt, um doppelte Eintraege zu finden — das gehoert zur Doku-Pruefung, nicht zur Codekenntnis, und bleibt bewusst so. Der TypeScript-Typ der Leiter kann aus JSON nicht abgeleitet werden; die Bindung leistet der Test, nicht der Compiler.

## 2026-11-01 - README-Onboarding und pnpm-CI nachgezogen

**Ziel.** Ein gemeinsamer Einstieg soll die Spielwelt satirisch eröffnen und neue Entwickler ohne Suche durch Werkzeuge und Verträge führen. Das README beschreibt den heutigen Stand, ohne endgültige Vision oder unveränderliche Mechaniken zu behaupten.

**Umsetzung.** README als längeres Onboarding neu geordnet: fiktionale Eröffnung, aktueller Spielstand, Screenshots und Versionsvergleich, Roadmap, Entwicklerstart, Zustandsverträge und FAQ. Das vom Nutzer gelieferte Pixel-Art-Banner ist als `docs/banner.jpg` eingebunden; drei eigene SVG-Trenner führen in Spielwelt, Werkstatt und Roadmap. Einen veralteten Startwert korrigiert: der Store vergibt 150 VC und den ersten Automaten kostenlos. PR #39 war konfliktfrei, seine CI scheiterte am fehlenden pnpm im Runner; alle acht betroffenen Workflow-Jobs installieren jetzt die deklarierte pnpm-Version vor Cache und Install-Schritten. Das Tree-Gate erlaubt JPEGs als Dokumentbeleg. Der erste Audit-Lauf fand die falsche npm-artige Override-Position; `pnpm.overrides` aktualisiert nun die gepatchten Versionen in der Lockfile.

**Pruefungen.** GitHub-Compare meldete vor dem PR einen Commit Vorsprung und keinen Rückstand auf main. Die CI-Diagnose lokalisierte den Fehler beim pnpm-Aufruf; die Reparatur verwendet die offizielle pnpm Action. Der erste lokale `pnpm run verify:all` Lauf hatte einen Audit-Fehler wegen falsch platzierter npm-artiger Overrides und einen Windows-Timeout im Prozess-Sweep-Test. Nach dem pnpm-spezifischen `pnpm.overrides`-Abschnitt sind Audit und zehn weitere Gates grün. Im zweiten vollen Lauf bestehen weiter 467 Tests und 2 sind übersprungen; derselbe Windows-Prozess-Sweep-Test erwartet bei `killTracked()` zwei Treffer und erhält einen. Keine Änderung am Prozess-Sweep-Code, da Ursache anhand dieses Umgebungsbefunds nicht gesichert ist. Die Linux-CI bleibt für den Merge entscheidend.

**Offen.** Lockfile aktualisieren, Pflichtpipeline ausführen, PR #39 aktualisieren und mergen. Anschließend lokale und entfernte WIP-Branches auf unintegrierte Arbeit prüfen.

## 2026-11-01 - Paketmanager von npm auf pnpm umgestellt

**Ziel.** Den Paketmanager auf pnpm umstellen, damit `pnpm-lock.yaml` das Lockfile ist und `package-lock.json` nicht mehr getrackt wird.

**Umsetzung.** `package.json` traegt `"packageManager": "pnpm@10.4.1"`; `package-lock.json` aus Git-Tracking entfernt (`git rm`), `pnpm-lock.yaml` bleibt trackt. `.npmrc` mit `allow-scripts=true` und `approved-builds=ffmpeg-static` beibehalten. Alle npm-Referenzen in Skripten (`scripts/*.mjs`, `scripts/lib/*.mjs`), GitHub Actions Workflows (`.github/workflows/*.yml`), `.githooks/pre-commit`, Pflichtdokumenten (`docs/*.md`) und `AGENTS.md` von `npm` auf `pnpm` umgestellt (`npm ci` → `pnpm install --frozen-lockfile`, `npm run` → `pnpm run`, `npm audit` → `pnpm audit`). `pnpm install` hat 293 Pakete installiert. Test `ci-gates.test.ts` erwartet `pnpm run test:perf` statt `npm run test:perf`.

**Pruefungen.** `typecheck` Exit 0; `lint` ohne Fehler; `verify:quick`: alle Doku-Gates (docs, tree, redundancy, assets, dead-code) PASS, typecheck/lint/check-loc/test-quality PASS. Ein pre-existing Test in `process-sweep.test.ts` (Abbruchpfad, SIGINT) schlaegt unabhaengig von der Migration fehl.

**Offen.** `verify:all` (inkl. Build, Audit, RTP/Balance/Soak) noch nicht lokal durchgelaufen; CI fuehrt es auf jedem Push aus.


**Ziel.** Zwei Befunde aus dem ersten Lauf von `agent:verify` beheben: ein sauberer Baum uebersprang das Testgate, und kein Gate traf den Cache.

**Umsetzung.** `agent-verify` setzt kein `skip` mehr, wenn der Diff keinen Testbezug hat — ohne Auswahl laeuft die Suite, und der Bericht nennt den Grund. `turn-push` ruft `doc-sync` jetzt vor `verify`; der Pre-Commit-Hook schrieb die Marker bisher danach und entwertete damit den Baum, der gerade geprueft wurde.

**Pruefungen.** Zweiter Lauf auf demselben Baum: `agent:verify` meldet `0s` und `[cached]` fuer die betroffenen Gates. `turn:finish` faehrt `verify:quick` mit bereits gesetzten Markern.

**Offen.** Der erste `--ci`-Lauf fuer die langen Nachweise steht aus.

## 2026-11-01 - Ein Prozess: Impact, Agentenkontext, Plan und Bericht

**Ziel.** Eine Aenderung einmal analysieren, einmal planen, einmal passend pruefen und zentral berichten — ohne zweite Pipeline und ohne doppelte Testlaeufe.

**Umsetzung.** `scripts/lib/impact.mjs` fuehrt zusammen, was schon existiert: `changedFiles`, `selectAffectedTests` (Importgraph inklusive dynamischer Importe und Re-Exports), Testkatalog mit Beweisklassen, `pipeline-plan` und `gate-cache`. `agent-context.mjs` gibt daraus kompakt aus, was ein Agent braucht; `agent-verify.mjs` plant dieselben Gates ueber `runGates`, laesst bei Impact-Auswahl nur betroffene Tests laufen (ohne Cache), delegiert lange Nachweise per `--ci` an Actions und schreibt `.verify-cache/reports/<Zeit>/agent-summary.json`. `turn-push` ruft statt des zweiten Testlaufs den Kontext; `test:ci` laeuft ueber `run-selected-tests.mjs`, damit eine Auswahl ueberhaupt adressierbar ist. Der Pre-Commit-Hook bricht ab, wenn Matrix oder Katalog nicht geschrieben wurden.

**Pruefungen.** `node --check` fuer alle geaenderten Skripte; `agent:context` nennt Systeme, Doku, Invarianten und die Delegationsgrenze; `verify:tree` PASS; `typecheck` Exit 0; neuer Nachweis `src/core/governance/__tests__/impact.test.ts` fuer Doku-ohne-Test, Config-alle-Tests, Graphtreffer und Proof-Trennung; `verify:quick` im Turn-Abschluss.

**Offen.** `agent:verify` ersetzt `verify:quick` fuer den Commit nicht; die volle Suite und die Release-Gates bleiben in CI. Der erste `--ci`-Delegationslauf ist noch nicht ausgefuehrt.

## 2026-11-01 - Config-Umzug nachgezogen: Capacitor-Datei wieder versioniert

**Ziel.** Der Umzug nach `src/Config/` darf keine Datei verlieren; die Pruefung zeigte, dass `capacitor.config.json` durch eine ungeankerte Ignore-Regel nie im Commit landete.

**Umsetzung.** `.gitignore` ignoriert nur noch die Laufzeit-Kopie in der Wurzel (`/capacitor.config.json`); `src/Config/capacitor.config.json` kommt aus der History zurueck. `prepare-android` kopiert sie waehrend des APK-Laufs und entfernt sie danach.

**Pruefungen.** `git check-ignore` prueft die Regel, `verify:tree` und `verify:docs` laufen im Turn-Abschluss, `verify:quick` deckt den Commit ab.

**Offen.** Der erste APK-Lauf mit der Kopie steht aus.

## 2026-11-01 - Review-Nachlauf: fatale Luecken der Promotion geschlossen

**Ziel.** Die Review fand zwei Luecken, die die Kette stillschweigend wirkungslos machen: ein Merge mit `GITHUB_TOKEN` startet keinen Workflow (kein CI auf `main`, kein Tag, kein APK), und `pr-cleanup` loescht die permanente Branch `integration`. Beides behoben, dazu die Wettlauf-Raender.

**Umsetzung.** `promote.mjs` waehlt `PROMOTE_TOKEN` als Merge-Token und stoesst ohne dieses Token `Auto Version & Release` an, das vor dem Tag `verify-commit-msg --head` ausfuehrt. `integration` ist in `pr-cleanup.yml` und `branch-prune.mjs` geschuetzt. `cancelled` ist kein Urteil, nur Push-Laeufe promoten, `gh pr update-branch` verhindert den Strict-Policy-Deadlock, der Integrations-Push wird begrenzt geschleift statt rekursiert. `verify-commit-msg --pr` weist einen leeren Body ab. Zusaetzlich kippte `narrative-start-pool` an einer Namenspruefung: `Rita Kern` ist eine moegliche Zufallskombination aus `NAMES` x `LAST_NAMES` in `src/core/sim/traits.ts`, die Zusicherung prueft jetzt das Profil (eine Visite, kein `START_POOL`-Fact) statt des Namens.

Dazu der Aufraeum-Umzug: die Werkzeug-Configs liegen jetzt in `src/Config/`, die Wurzel traegt keine Kopien mehr. `tsconfig.json` bekam `../src` als Include, `vite.config.ts` importiert den Harness ueber `../core/...`, und jeder Aufrufer bindet seinen Pfad explizit — sonst findet `vite`, `vitest`, `tsc`, `eslint`, die Dependency-Matrix, der Dead-Code-Gate oder der Gate-Cache die Datei nicht mehr. Capacitor sucht seine Konfiguration ausschliesslich im Arbeitsverzeichnis; `prepare-android` kopiert sie kurzzeitig in die Wurzel und entfernt sie nach dem Gradle-Lauf. `.mailmap` bleibt in der Wurzel, weil Git nur dort liest.

**Pruefungen.** `node --check` fuer beide Skripte; jede Ersetzung genau einmal angewandt (Skript bricht bei 0 oder 2 Treffern ab); `verify:quick` mit allen zehn Gates im Turn-Abschluss. Ein echter Merge in CI bleibt der offene Nachweis.

**Offen.** `PROMOTE_TOKEN` ist nicht gesetzt, der Anstoss-Pfad ist der aktive. Ob GitHub den Squash-Commit mit eigenem Token als Push wertet, zeigt der erste Lauf. Befund 3, 6 und 7 unveraendert.

## 2026-11-01 - Auto-Promotion: gruene Checks mergen, rote Staende auf die Integrationsbranch

**Ziel.** Der Weg von "Branch gepusht" bis "auf main" soll ohne Handgriff laufen: PR anlegen, Checks abwarten, bei Gruen mergen, bei Rot den Stand auf eine dauerhafte Integrationsbranch legen, damit dort repariert wird. Der Committer soll dabei immer der Eigentuemer sein, unabhaengig von Runner oder Sandbox.

**Umsetzung.** `scripts/promote.mjs` reagiert auf genau ein CI-Ergebnis. Gruen: PR suchen, sonst mit Titel und Pflichtsektionen anlegen, dann mit `--squash --subject --body-file` mergen — der Commit-Text traegt die drei Sektionen, weil `verify-commit-msg --head` sonst auf `main` rot wuerde. Rot: Label `integration/rot` setzen, alle so markierten offenen Branches einsammeln, `integration` aus `origin/main` aufsetzen (oder fortschreiben), jeden Stand per `git merge --no-ff` komponieren und pushen. Die Concurrency-Gruppe `promote` laesst genau einen Schreiber zu; ein abgelehnter Push wird mit `fetch` und `reset --hard` neu aufgesetzt und erneut gemergt, was idempotent ist. Identitaet: `scripts/lib/identity.mjs` als einzige Quelle, in `turn-push.mjs` fest an den Commit gebunden, im Workflow per `git config` gesetzt, dazu `.mailmap` fuer die Anzeige der History.

**Pruefungen.** `node --check scripts/promote.mjs` gruen; die beiden Patch-Ersetzungen in `promote.mjs` und `turn-push.mjs` je genau einmal angewandt (Skript bricht bei 0 oder 2 Treffern ab). `verify:quick` mit allen zehn Gates im Turn-Abschluss. Der erste `turn:finish`-Lauf war an `gate-runner.test.ts` rot (erwartete FAIL, bekam TIMEOUT bei paralleler Gate-Last); isoliert 4/4 gruen, danach der volle Lauf gruen — Lastkonkurrenz, kein Defekt am Stand; der Artefakt-Test der Gate-Auswertung laeuft jetzt mit 60 s Limit (30 s fuer die schnelle Probe), weil unter paralleler Gate-Last schon der Node-Start mehrere Sekunden braucht. Die Zusicherungen blieben unveraendert.

**Offen.** Der Promote-Workflow laeuft zum ersten Mal in CI; ein echter Merge und eine echte Integration sind damit noch nicht belegt. Der Verified-Badge haengt an GitHub-seitigen Merges: entweder `RBD_PROMOTE_AUTO_MERGE=1` mit der Repo-Vorgabe "PR-Titel und -Beschreibung" fuer Squash, oder ein Signaturschluessel. Befund 3, 6 und 7 stehen unveraendert.

## 2026-11-01 - Doku-Konsolidierung: Sortierung, Namensgleichheit und Repo-Hygiene

**Ziel.** Eine Doku, die man lesen kann, ohne zu raten: gleiche Namen, ein Ort pro Thema, keine Aussage, die einer anderen widerspricht. Dazu der lokale Repo-Zustand: Hooks aktiv, nichts Unsortiertes in der Wurzel.

**Umsetzung.** 16 Doku-Dateien liegen flach unter `docs/` und tragen Grossbuchstaben-Namen; `EVENT-NARRATIVE-ENGINE-TASKPLAN.md` und `CASINO-PIXEL-ASSET-PACK.md` ersetzen die beiden kebab-case-Ausreisser, `docs/assets/` entfaellt, `docs/ASSETS.md` verweist auf den neuen Pfad. Widersprueche korrigiert: Save v9 statt v8 in ARCHITECTURE und Inventar §8; "Narrative Engine ist noch nicht gebaut" ersetzt durch Stufe 1 gebaut / NAR-04+ nach Taskplan; Gate-Zaehlung und Gate-Reihenfolge in ARCHITECTURE, PRODUCT und AGENTS auf `scripts/lib/pipeline-plan.mjs` gezogen; Inventar-Kopf auf `main`/`c4e6e3b`/983 Dateien; §2, §3, §9–§13 auf Ist-Zahlen; Befund 5 und 42 als aufgeloest markiert, §17 auf umgesetzt. `docs/ERROR_CATALOG.md`: verschmolzene ERR-4013/ERR-4014-Zeile getrennt, Codes aufsteigend sortiert. Screenshot-README nennt wieder den echten Bestand. Repo-Hygiene: `pnpm run hooks:install` gesetzt (2 Hooks), Wurzel enthaelt nur `README.md` und `AGENTS.md` als Markdown. Beim Abschluss fiel der letzte Widerspruch auf: das Doku-Gate zaehlte `.turn-notes.md` als Wurzel-Doku und machte `turn:finish` rot, obwohl genau dieses Werkzeug die Datei anlegt; der Scan ueberspringt Dotfiles jetzt.

**Pruefungen.** `pnpm run inventory:build` regeneriert §18 (983 Dateien, 67 Ordner); `verify:docs`, `verify:tree`, `verify:redundancy` und `check:loc` gruen; danach `pnpm run verify:quick` mit allen zehn Gates gruen und Exit 0. Pre-Commit-Hook schreibt Matrix, Katalog und Marker, `turn:finish` bumpt auf 0.3.65, committet und pusht.

**Offen.** Befund 3 (ERR-4016 fuer das Asset-Gate), 6 (`opencode.json` mit Windows-Pfad) und 7 (Audit-Drift 373/323) bleiben stehen; `verify:all` mit Build und Audit laeuft in CI. `W3Champions/logs` ist fremde lokale Logware, bleibt gitignoriert und unangetastet.

## 2026-11-01 - Narrative Engine Stufe 1: Facts, Gedaechtnis, Start-Pool (NAR-00 bis NAR-03)

**Ziel.** Den Taskplan nicht nur beschreiben, sondern den ersten tragenden Schnitt
umsetzen — mit belegter Wirkung im Spiel, inklusive Start-Pool.

**Umsetzung.** Neuer Core-Bereich `src/core/sim/narrative/`: `types.ts` (Facts,
Erinnerungen, Grenzen), `facts.ts` (ID-Vergabe, Queue mit Deckel, idempotenter Drain),
`state.ts` (Startzustand, Start-Pool, sichere Normalisierung), `memory.ts`
(Fact→Erinnerung, deterministische Wirkung). `WorldState.narrative` ist der einzige
persistente Narrativ-Zustand; `Visitor.memories` haelt hoechstens sechs strukturierte
Erinnerungen. Facts entstehen an echten Uebergaengen: Spawn (erster Besuch /
Rueckkehr), Auszahlung (`VISIT_ENDED` aus `guest-service`) und neues Spiel
(`START_POOL` mit Startkapital). Save v9 traegt alles, v5–v8 werden normalisiert.

**Wirkung (nicht nur Speicherung).** `returnChance()` addiert den Erinnerungsbonus
(+4 Prozent je gutem, -6 je schlechtem Besuch, letzte doppelt, gedeckelt),
`spawnGuest()` gibt Rueckkehrern den Laune-Bonus mit. Konkret gemessen und in
`narrative-memory.test.ts` festgeschrieben: neutral 25 Prozent Rueckkehr, nach einem
guten Besuch 33, nach einem schlechten 13; die Spawn-Laune liegt genau um den
Erinnerungsbonus hoeher als in der Kontrollwelt mit identischem Seed. `seedStartPool()` setzt drei
bekannte Figuren und das Startkapital als Fact; die Rueckkehrer-Auswahl kann sie ab
Tick 0 treffen. Damit aendert sich messbar, wer wiederkommt und wie er ankommt.

**Nachweise (Vitest, am Turn-Ende).** `narrative-facts.test.ts` (IDs, einmalige
Verarbeitung, Queue-Deckel 48/12, JSON-Roundtrip, unbekannte Referenz, Flags ohne
Journal), `narrative-memory.test.ts` (Rueckkehr steigt/sinkt, letzte Erinnerung
doppelt, Deckel 6, Spawn-Laune differiert zur Kontrollwelt um genau den Bonus),
`narrative-start-pool.test.ts` (drei Figuren, Idempotenz, Rueckkehr ab Tick 0,
Kontrollwelt ohne Pool legt neues Profil an), `narrative-save.test.ts` (v9-Roundtrip,
v8-Defaults, zwei Welten nach 80 Ticks identisch).

**Offen.** NAR-04 bis NAR-17 (Beziehungen, Trigger, Scheduler, Event-Templates,
Command-DSL, Content-Compiler, Composer/LLM, UI, Rivalen, Soak) sind nicht umgesetzt.
Der Start-Pool ist bewusst nur im Store-Pfad fuer neue Spiele aktiv, nicht in
`createWorld()`, damit alte Saves ihre Besucherliste behalten.

## 2026-11-01 - Merge ohne PR-Body macht main rot (Vorfall und Reparatur)

**Ziel.** PR #32 mergen und `main` gruen halten.

**Vorfall.** Der Merge lief ueber die GitHub-API mit `commit_title`, aber ohne
`commit_message`. Der Merge-Commit `3c46ba6` trug damit nur den Klicktitel und
keine Pflichtsektionen. `verify-commit-msg --head` prueft auf `main` genau diesen
Commit und wurde rot: `[ERR-4006] Pflichtsektion fehlt: ### Changes (Was ist neu)`,
`### Technische Basis & Kausalitaet`, `### Ausblick (Naechste Schritte)`. Der Job
`Fail-Closed Gates` endete mit Exit 1; `Bump, tag, release` und der APK-Bau wurden
deshalb uebersprungen (conclusion `skipped`).

**Reparatur.** Kein Rewrite von `main`, kein Force-Push: Der Regeltext in
`AGENTS.md` nennt jetzt die API-Falle ausdruecklich (PR-Body gehoert in
`commit_message`), und dieser Doku-Commit traegt die drei Sektionen selbst. Damit
prueft `verify-commit-msg --head` wieder einen konformen HEAD, und die
Release-Kette laeuft erneut an.

**Lehre.** Ein gruener PR ist kein gruener `main`: Die Commit-Nachricht des
Merge-Commits ist Teil des Gates, nicht nur der PR-Body.

## 2026-11-01 - performance.now-Ausnahme auf Pacing verengt und als dicht belegt

**Ziel.** Beweisen, dass die Render-Ausnahme genau Pacing erlaubt und nicht mehr:
kein pauschales Datei-Allow, keine mitfreigestellten Identifier, und kein Weg
eines Wanduhr-Werts aus `src/render/**` in `src/core`, `src/store`, Composer/LLM
(A-10), Content-Compiler (A-11) oder die kuenftige Narrative Engine.

**Befund am Code.** `performance.now` kommt an genau fuenf Stellen vor, verteilt
auf drei Dateien: `src/render/floor-view.ts` (3), `src/render/music.ts` (2),
`src/render/floor-props.ts` (1). Die Sperre erlaubte sie trotzdem in **jeder**
Datei unter `src/render/**` — breiter als der Zweck. Zwei Uhr-Quellen fehlten
ausserdem komplett: `Date()` ohne `new` (liefert einen Wall-Clock-String) und
`performance.timeOrigin` (Epoch-Zeitstempel).

**Umsetzung.** `eslint.config.mjs` nennt die drei Pacing-Dateien jetzt namentlich;
alle anderen Render-Dateien fallen unter die strenge `src/**`-Regel und sind voll
gesperrt. `Date()` als Call (auch `globalThis.Date()`) und `performance.timeOrigin`
sind als Syntax-Selectoren ergaenzt; die Render-Ausnahme filtert weiterhin nur
`performance`-Selectoren heraus, `timeOrigin` bleibt also auch dort rot. Damit ist
in den drei Dateien genau ein Identifier erlaubt: `performance.now`.

**Proben (24, `npx eslint --stdin --stdin-filename <pfad>`).** Gruen nur:
`performance.now` in den drei Pacing-Dateien, der Alias `const p = performance; p.now()`
und `globalThis.performance.now()`. Rot in denselben Dateien: `Math.random`,
`Date.now`, `new Date()`, `Date()`, `performance.timeOrigin`, `getRandomValues`,
`randomUUID`, `globalThis.Math.random`, `window.Date.now`, `const { random } = Math`,
`Math["random"]`, `Date["now"]`. Rot ausserhalb der drei Dateien: `performance.now`
in `src/render/guest-art.ts`, `src/ui/Hud.tsx`, `src/core/sim/tick.ts` und in
`scripts/**` (dort zusaetzlich `Date.now`, `new Date`, `Math.random`).

**Rot/Gruen am echten Stand.** `Math.random()` an `src/render/music.ts` und
`Date.now()` an `src/render/floor-view.ts` angehaengt: `pnpm run lint` Exit 1 mit
vier Fehlern (`no-restricted-properties` und `no-restricted-syntax` je Quelle).
Nach `git checkout --` beider Dateien: Exit 0. `performance.now()` in einer
vierten Render-Datei (`guest-art.ts`): `npx eslint src/render/guest-art.ts` Exit 1,
zwei Fehler — die Ausnahme ist also nicht datei-pauschal.

**Datenfluss (gelesen, nicht geplant).** `src/core` und `src/store` importieren
nichts aus `src/render` (0 Treffer, Tree-Gate erzwingt Core-Importe nur aus
`src/core`). `src/render` importiert aus `src/store` ausschliesslich
`import type { GameView }` (7 Treffer, alle type-only) und ruft keinen Command.
`world.tick += 1` steht nur in `src/core/sim/tick.ts`; `tick`/`day` werden sonst
nur beim Laden (`migrate.ts`) und fuer fremde Etagen (`foreign-floor-tick.ts`,
`floor.day = world.day`) gesetzt. Kein Command nimmt `tick`/`day`/`time`; die
einzige Ausnahme `buyBarCmd(world, ledger, tick)` wird ausschliesslich von
`world-store` mit `this.#world.tick` aufgerufen und stempelt nur die Ledger-Zeile.
Composer/LLM und Content-Compiler existieren noch nicht; `scripts/**` ist bereits
gesperrt, damit sie die Uhr auch spaeter nicht lesen koennen.

**Pruefungen.** `lint`, `verify:test-quality`, `verify:docs`, `verify:tree`,
`verify:redundancy`, `check:loc`, `tsc --noEmit`, `inventory:build` lokal gruen;
Vitest und `verify:all` laufen in CI.

**Offen.** Innerhalb der drei Pacing-Dateien ist `performance.now` nicht auf eine
Codezeile festnagelbar — ESLint sieht keinen Zweck, nur den Identifier; die
Dateiliste ist die engste Grenze ohne neuen Produktivcode. `performance.timeOrigin`
und `Date()` sind jetzt ueberall rot, `performance.mark/measure` bleiben erlaubt
(reine Messmarken, kein lesbarer Uhrwert).

## 2026-11-01 - Determinismus-Sperre fail-closed gehaertet

**Ziel.** Beweisen, dass die Sperre haelt — nicht nur, dass sie dokumentiert ist.

**Befund (gemessen, 20 Proben gegen `npx eslint --stdin`).** Sieben Umwege kamen
durch: `globalThis.Math.random` und `window.Math.random`, `new globalThis.Date()`,
`crypto.getRandomValues` und `crypto.randomUUID` (standen nie in der Regelliste),
`eslint-disable-next-line`, der pauschal freigestellte `src/core/rng/streams.ts`
und **alle** `scripts/**`-Dateien — inklusive des kuenftigen Content-Compilers.
Zusaetzlich hatte `verify-test-quality` eine stille Kommentar-Ausnahme
(`@seed-initializer`), die eine Zufallsquelle in `src/core` und `src/store`
durchgelassen haette.

**Umsetzung.** `eslint.config.mjs` erfasst jetzt Namespace-Umwege
(`globalThis`/`window`), `new`-Umwege, computed Zugriffe, Krypto-Selectoren fuer
`getRandomValues`/`randomUUID` und `scripts/**` per Default. `linterOptions.noInlineConfig`
schaltet `eslint-disable` global ab, damit kein Kommentar die Sperre aufhebt.
`src/core/rng/streams.ts` verliert die Pauschal-Freistellung: dort ist nur noch
Krypto erlaubt, `Math.random` und Uhr bleiben verboten. Sieben Tooling-Skripte
(Zeitstempel, CI-Polling, Gate-Logs) sind namentlich und begruendet ausgenommen und
duerfen weiterhin keinen Zufall ziehen. Die `@seed-initializer`-Ausnahme in
`verify-test-quality` ist entfernt — sie war unbenutzt und damit nur eine Tuer.

**Rot/Gruen-Beleg.** `export const __determinismProbe = Math.random();` an
`src/core/sim/tick.ts` angehaengt: `pnpm run lint` endet mit Exit 1 und meldet
zwei Fehler in Zeile 140 (`no-restricted-properties` und `no-restricted-syntax`).
Nach `git checkout -- src/core/sim/tick.ts`: `pnpm run lint` Exit 0.

**Pruefungen.** `lint`, `verify:test-quality` (87 Testdateien),
`verify:tree`, `verify:redundancy`, `check:loc`, `tsc --noEmit`,
`inventory:build` (971/971) lokal gruen; `verify:docs` im Commit-Hook. Vitest und
`verify:all` laufen in CI.

**Offen.** `performance.now()` bleibt in `src/render/**` fuer Bild-/Ton-Pacing
erlaubt; dieser Wert beruehrt nie den Spielzustand. Kein neues Gate, keine neue
Abhaengigkeit.

## 2026-11-01 - Event-Engine-Taskplan adversarial gehaertet

**Ziel.** Den bestehenden 18-Task-Plan (NAR-00…NAR-17) gegen sich selbst
pruefen: keine Annahme ungeprueft, kein Task gestrichen, jede Erkenntnis mit
Gegenmassnahme und Systembezug.

**Befund.** Drei Planfehler sind am Code belegbar. Erstens war die Gate-Liste in
§3 veraltet: `deps-matrix` und `catalog` sind seit dem Hook-Umbau keine Gates
mehr, `docs`, `tree` und `redundancy` fehlten. Zweitens kannte der Pruefstand
`708d31c` die Determinismus-Sperre nicht, obwohl die Narrative Engine die
wahrscheinlichste Stelle fuer neues `Math.random` ist. Drittens setzte die
Reihenfolge NAR-12 (Tick-Integration) vor NAR-13 (Demand-Migration) und haette
damit fuer die Dauer der Umsetzung zwei aktive Event-Wahrheiten erzeugt. Dazu
kamen 17 weitere Angriffe, unter anderem Ledger-Index gegen Buchungs-`seq` beim
Fact-Cursor, `VISITOR_CAP = 40` mit `splice(oldest)` gegen laufende Stories,
halbe Beziehungskanten nach Archivierung, unbegrenzte Cooldowns, `FREEZE_TICK`
ohne Einheit, halb angewendete Command-Batches, LLM-Injection und Bundle-Wachstum.

**Umsetzung.** §9 (20 Angriffe mit Befund, Gegenmassnahme und Taskbezug), §10
(Systemmatrix ueber 20 Systeme), §11 (korrigierte Reihenfolge: NAR-13 vor NAR-12,
10 vor 11, 06 vor 07), §12 (Definition of Done je Task mit Pflicht-Gate) und §13
(Aenderungsprotokoll) ergaenzt. Kopf auf `7cca88a` aktualisiert, die Gate-Liste in
§3 an `scripts/lib/pipeline-plan.mjs` angeglichen, der Drift-Absatz praezisiert:
`poker-distribution` laeuft im Quick-Profil, `balance-operating` ist ohne
`RBD_BALANCE` inaktiv.

**Pruefungen.** `verify:docs`, `verify:tree`, `verify:redundancy`, `check:loc`,
`lint`, `typecheck` und `inventory:build` lokal; Vitest und `verify:all` laufen in
CI. Kein Produktivcode geaendert.

**Offen.** Der Plan bleibt ein Plan: keine NAR-Umsetzung, kein Save v9. Die
Reihenfolgekorrektur bindet die Umsetzung, nicht rueckwirkend gemergte Arbeit.

## 2026-11-01 - Determinismus: kein Math.random und keine Wanduhr im Spielzustand

**Ziel.** Kein `Math.random()` und keine vergleichbare Streuquelle im Spiel:
gleicher Seed und gleiche Ticks muessen denselben Zustand und denselben Export
ergeben.

**Befund.** `Math.random()` war seit der RNG-Trennung aus Renderer und Sound
verschwunden, aber drei Nebentueren blieben offen. `world-store` seedete den PRNG
mit `Date.now()` (Feld-Initialisierung und `newGame`), `exportGameData` stempelte
den Export mit `new Date().toISOString()`, und der Musik-Crossfade mass seine
Fadezeit an `Date.now()`. Gleicher Stand ergab damit nicht zwingend dieselben
Bytes.

**Umsetzung.** `entropySeed()` in `src/core/rng/streams.ts` ist jetzt der einzige
Entropie-Eingang (Krypto, ohne Fallback); `presentationSeed()` und beide
Seed-Stellen im Store ziehen nur noch daraus. Der Export traegt `Tag X, Tick Y`
aus der Welt statt eines Uhrzeitstempels. Der Musik-Fade nutzt `performance.now()`.
`eslint.config.mjs` verbietet in `src/**` `Math.random`, `Date.now`,
`performance.now` und `new Date()`; `src/render/**` darf `performance.now` fuer
Pacing lesen, `src/core/rng/streams.ts` ist die einzige Ausnahme fuer die
Krypto-Entropie. Neuer Test `src/store/__tests__/determinism.test.ts` faehrt zwei
Laeufe mit demselben Seed und vergleicht den vollstaendigen Export.

**Pruefungen.** `pnpm run lint` (neue Regel), ESLint-Probe per `--stdin` (vier
Treffer in `src/core`, kein Treffer fuer `performance.now` in `src/render`),
`tsc --noEmit`, `check:loc`, `verify:test-quality` (87 Testdateien),
`verify:dead-code` (775 Exporte), `verify:tree`, `verify:redundancy`. Vitest lief
nicht lokal; die neuen Tests und `verify:all` laufen in CI.

**Offen.** Die Start-Entropie bleibt echt zufaellig: Determinismus heisst
Wiederholbarkeit ab gespeichertem `prngState`, nicht ein fester Startseed.

## 2026-11-01 - RNG-Namespaces getrennt

**Ziel.** Gameplay und Darstellung duerfen nie denselben Zufallsstrom ziehen; sonst
verschiebt ein Partikeleffekt den naechsten Gegnerspawn.

**Befund.** Partikel (`src/render/fx/emitter.ts`) und Rauschen
(`src/render/sound-fx.ts`) nutzten `Math.random()` — getrennt vom Spielstrom,
aber unbenannt und nicht gegen kuenftige Vermischung geschuetzt. Poker zieht
bewusst einen Gameplay-Strom aus dem gedealten Seed, das bleibt Spielzustand.

**Umsetzung.** `Prng` traegt eine Rolle (`gameplay` | `presentation`).
`src/core/rng/streams.ts` liefert `presentationRng`, `presentationSeed` und
`assertGameplayRng`; `src/render/rng.ts` haelt den einen Darstellungs-Strom,
Emitter und Sound ziehen nur noch daraus. `tickWorld` und `playRound` rufen den
Guard auf und brechen bei einem presentation-Strom mit klarer Meldung ab.

**Pruefungen.** `tsc --noEmit`, ESLint, `check:loc`, `verify:docs`,
`verify:tree`, `verify:redundancy` lokal gruen. Vitest lief nicht lokal; die
neuen Tests (`streams.test.ts`) und `verify:all` laufen in CI.

**Offen.** Der Darstellungs-Seed ist absichtlich nicht im Save: visuelle
Wiederholbarkeit nach einem Reload ist kein Spielzustand.

## 2026-11-01 - main in den Inventar-Branch gemergt

**Ziel.** PR #27 mergebar machen, ohne die Asset-Arbeit von `main` zu verlieren.

**Umsetzung.** `main` (`ee882da`, drei Commits, +485 Zeilen in Renderer und UI)
in den Branch gemergt. Zwei Konflikte: `src/main.tsx` (Runtime-Art-Preload von
`main` plus `./styles/index.css` aus diesem Branch) und die generierte
Dependency-Matrix in `docs/ARCHITECTURE.md` (Zaehlungen beider Seiten, danach
vom Hook neu erzeugt).

**Pruefungen.** `verify:docs` inklusive Inventar-Abdeckung, `verify:tree`,
`verify:redundancy`, `check:loc`, ESLint und `tsc --noEmit` lokal gruen; die
neuen Renderer-Dateien und fuenf Screenshots stehen im regenerierten Abschnitt 18.
Vitest lief nicht lokal; der Beweis bleibt `verify:all` in CI.

## 2026-11-01 - Inventar-Generator idempotent gemacht

**Befund.** Bei der Verifikation der Auslieferung fiel auf: Nach einem testweise
entfernten Eintrag stellte `pnpm run inventory:build` den Block nicht byte-identisch
wieder her, der Arbeitsbaum blieb eine Zeile dirty. Ursache war der Selbsteintrag
von `docs/INVENTORY.md`: Er beschrieb seine eigene Zeilenzahl, die der Generator
beim Schreiben gerade veränderte — der Block hing damit von seinem eigenen
Vorzustand ab.

**Umsetzung.** Der Selbsteintrag trägt jetzt einen stabilen Status („gepflegt:
Marker und Abschnitt 18“) statt einer Zeilenzahl; alle anderen Einträge bleiben
messbar. Zwei Generatorläufe hintereinander ergeben denselben Hash.

**Prüfungen.** Datei-Eintrag entfernt → `verify:docs` Exit 1; Ordner-Eintrag
entfernt → Exit 1; nach `inventory:build` ist die Datei SHA-256-gleich zum
Ausgangsstand und das Gate grün. Vitest lief nicht lokal; der Beweis bleibt CI.

## 2026-11-01 - Vollständige Inventur mit erzwungener Abdeckung

**Ziel.** Nicht die interessanten Stellen, sondern jede getrackte Datei: eine
Zeile je Pfad, ein Eintrag je Ordner, und eine Prüfung, die eine Lücke rot macht.

**Umsetzung.** `scripts/build-inventory.mjs` liest `git ls-files`, öffnet jede
Datei und schreibt den Block zwischen `inventory:start` und `inventory:end` in
`docs/INVENTORY.md`. Textdateien liefern Zeilenzahl und Kopfkommentar,
PNG-Dateien ihre IHDR-Maße, OGG-Dateien ihre Signatur; Sammelzeilen gibt es
nicht. `verify:docs` vergleicht den Block mit dem Index, prüft die 64 Ordner
und die Abdeckungszahl. Der Pre-Commit-Hook baut die Liste vor dem Marker, die
Abdeckung kann also nicht stillschweigend veralten.

**Befunde beim Bauen.** Shell-Hooks ohne Endung wurden zunächst als Binärdatei
geführt — die Erkennung fragt jetzt nach NUL-Bytes statt nach der Endung. Der
Changelog trug `[0.3.65]`, während `package.json` und alle Marker `0.3.64`
sagten; die Überschrift ist auf `0.3.64` gezogen.

**Prüfungen.** Drei Rot-Tests gegen das Gate: eine entfernte Datei, ein
entfernter Ordner und eine falsche Abdeckungszahl brechen jeweils mit
`ERR-4017` ab; danach ist der Lauf wieder grün. `verify:tree`,
`verify:redundancy`, `check:loc`, ESLint und `tsc --noEmit` lokal grün. Vitest
lief nicht lokal; der Beweis bleibt `verify:all` in CI.

**Offen.** Der Lizenznachweis für die 552 Dateien unter `public/` liegt weiter
beim Betreiber; inhaltlich geprüft sind Signatur und Größe, nicht die Rechte.

## 2026-11-01 - Tree-Gate, Redundanz-Gate und Doc-Generierung

**Ziel.** Jede Datei am richtigen Ort, keine doppelte Wahrheit und ein Befehl,
der Changelog, Devtagebuch und Inventar mechanisch anlegt.

**Umsetzung.** `scripts/verify-tree.mjs` prueft Wurzel-Whitelist, erlaubte
Endungen je Ordner, Testablage in `__tests__` und die Importrichtung von
`src/core`. `scripts/verify-redundancy.mjs` vergleicht Dateiinhalte per
SHA-256, pnpm-Kommandos und Fehlercodes; Alias-Paare sind ausdruecklich erlaubt.
`scripts/doc-stub.mjs` schreibt die drei Pflichteintraege mit Datum, Version
und Uhrzeit. Beide Gates laufen im schnellen und im vollen Profil.

**Befunde beim ersten Lauf.** `src/index.css` lag neben `main.tsx` und wanderte
nach `src/styles/`; `eslint.config.mjs` und `opencode.json` fehlten in der
Wurzel-Whitelist; `scripts/init-github.sh` ist als Bootstrap-Shell erlaubt.
Der Umzug brach zunaechst die drei `@import`-Pfade; der CI-Build fand es, jetzt
sind sie relativ (`./tokens.css`, `./app.css`, `./popup.css`).

**Pruefungen.** `verify:tree`, `verify:redundancy`, `verify:docs`, ESLint,
`tsc --noEmit` und `check:loc` lokal gruen. Vitest lief nicht lokal; der Beweis
bleibt `verify:all` in CI.

**Bestaetigt.** Der CI-Lauf zu `37affc5` ist gruen: „Fail-Closed Gates“ und „Commit-Body in PR-Body heben“ stehen auf success; Tree- und Redundanz-Gate laufen dort mit. Vitest und Build liefen ausschliesslich in CI.

## 2026-11-01 - CI-Befund behoben (T12)

**Befund.** Lauf #110 (`CI Verify`, Commit `f2f46c7`) war rot: 438 Tests gruen,
zwei rot. `src/core/governance/__tests__/pipeline-modes.test.ts` verlangte noch
`GATES['deps-matrix'].args === ['--check']` und `quick` mit `deps-matrix`.

**Ursache.** Der Gate-Plan wurde bewusst geaendert, der Testvertrag nicht
mitgezogen. Der Test ist damit kein falscher Alarm, sondern eine echte
Nachweispflicht.

**Behebung.** Der Test prueft jetzt `GATES.docs` (Skript, keine Argumente) und
`quick` mit `docs` sowie ohne `deps-matrix`/`catalog`; die Regel "kein Gate
repariert" bleibt unveraendert. Kein Gate wurde wieder eingefuehrt.

**Pruefungen.** ESLint, Doc-Gate, Typecheck lokal; der Beweis laeuft im
naechsten `CI Verify`-Lauf.

## 2026-11-01 - Connector-Eskalation (T11)

**Ziel.** Agenten ohne `gh`-Token sollen den PR-Body trotzdem heben koennen.

**Umsetzung.** `scripts/lift-commit-body.mjs` kennt jetzt `--json` (und
`--connector`): Der Plan enthaelt `level`, `channel: github-connector`, `branch`,
`base`, `title`, `bodyFile` und `body`. CI nutzt weiter `gh`; scheitert das,
bleibt der Lauf gruen und der Plan ist die Uebergabe. Der Level stammt aus
`scripts/lib/escalation.mjs`, es entsteht keine zweite Klassifikation.

**Pruefungen.** ESLint ueber `scripts/`, Doc-Gate, JSON-Ausgabe im Trockenlauf.

**Offen.** Der Connector-Weg ist beschrieben, aber noch nicht in einem echten
Agentenlauf benutzt.

## 2026-11-01 - Governance, Eskalation und Import/Export

**Ziel.** Fehlschlaege sollen zuerst automatisch loesbar sein: reparieren, in CI
wiederholen, erst dann ein Agent. Dazu Pflichtdoku mit Version und Zeitstempel,
ein Doc-Gate mit Strukturvorgaben und ein sauberer Wurzelbaum.

**Umsetzung.**

- `scripts/lib/escalation.mjs`: eine Leiter fuer alle Befunde, Klassifikation
  ueber Regeln (Ledger/Geld blockiert, Doku/Format automatisch, Netz transient,
  Scope lokal, Rest Agent).
- `scripts/lib/doc-sync.mjs` plus `scripts/doc-sync.mjs`: Marker
  `<!-- rbd-doc: v0.3.144 | 2026-11-06 21:42 UTC -->` in sechs Pflichtdokumenten;
  `verify:docs` prueft Marker, Pflichtabschnitte, Wurzel-Whitelist und Doppelungen.
- `.githooks/pre-commit` schreibt Matrix, Katalog und Doku-Marker und prueft
  danach Doku und LOC; `.githooks/commit-msg` eskaliert statt zu blockieren.
- `pr-escalation.yml` hebt einen Commit ohne Pflichtsektionen in den PR-Body.
- Import/Export: `src/core/io/{issues,envelope,repair}.ts` und
  `src/store/transfer.ts`; die Oberflaeche sitzt im Pruefungs-Popup.
- Pipeline: `deps-matrix` und `catalog` sind keine Gates mehr, `docs` ersetzt sie.

**Pruefungen.** Statische Gates (Lint, Typecheck, LOC, Doc-Gate) liefen lokal;
Vitest wurde bewusst nicht gestartet, weil Tests laut Auftrag ausschliesslich
ueber GitHub Actions eskaliert und dort geloest werden. Der volle Beweis bleibt
`verify:all` in CI.

**Bewusst nicht getan.** Kein Save-Format-Wechsel (bleibt v8), keine Migration
der Narrativ-Engine (NAR-00..16 bleibt Plan), keine Aenderung an Geldpfaden.

## 2026-11-05 - Huelle: Atlas, Budgets, APK

**Ziel.** Die Optik auf einem schwachen Androiden tragen, ohne sie zurueckzudrehen: die 153 Pixel-Frames in wenige Requests packen, die Last in drei Stufen regeln, den Loader an den ersten echten Renderer-Frame binden und eine installierbare APK bauen. Der 4G-Pruefpfad soll unter drei Sekunden und bei hoechstens 20 Requests liegen.

**Umsetzung.**
- `src/render/assets/atlas.ts`: `shelfPack` sortiert Hoehe, Breite und Pfad; der Produktionspfad laedt die zwei Seiten aus `manifest.atlas.pages` und registriert die Frames als Ausschnitte. Fehlt eine Seite, packt der Laufzeitpfad die vier Ordner weiterhin selbst; `textures.ts` faellt danach auf die Einzeldatei zurueck.
- `scripts/lib/atlas-png.mjs`: eigener PNG-Codec (8-Bit-RGBA, Unfilter, CRC, zlib) ohne neue Abhaengigkeit. `scripts/build-asset-manifest.mjs` schreibt zwei deterministische 1024er-Seiten (Padding 0, 46 + 107 Frames) und die Koordinaten ins Manifest; `verify-assets.mjs` prueft Seiten, Grenzen, Abdeckung und Sortierung.
- `src/render/perf-governor.ts`: reine Hysterese aus `deltaMS`, Wechsel erst nach 2.000 ms. `floor-stage.tsx` setzt daraus DPR, `ticker.maxFPS`, Partikel- und Lichtbudget; der erste Frame wird explizit gerendert, bevor `onFirstFrame` den Loader ausblendet.
- `src/main.tsx`: wartet nur auf die Atlasseiten. Symbole, Plinko und Partikel folgen nach dem ersten Frame im Leerlauf. `music.ts` laedt erst nach einer Geste; der stille Vorlauf erzeugte sonst drei Audio-Requests und 650 KB konkurrierend mit dem ersten Frame.
- Mobile Huelle: `index.html` mit `viewport-fit=cover`, `tokens.css` mit `--safe-*`, `app.css` mit Safe-Area-Padding und Hochformat-Hinweis, `capacitor.config.json` mit `android.orientation: portrait`; `prepare-android.mjs` pinnt zusaetzlich `screenOrientation=portrait` im generierten Manifest.
- `src/render/haptics.ts`: `navigator.vibrate(8)` beim Zeigerdruck, `[12, 40, 18]` beim Jackpot, aus bei `prefers-reduced-motion`. Keine neue Abhaengigkeit.

**Pruefungen.** `pnpm run assets:manifest`, `pnpm run verify:assets` (555 Referenzen, 15,6 MB), `pnpm run typecheck`, `pnpm run build` und `pnpm run check:loc` gruen. Browser-Messung gegen den Cloud-Preview mit kaltem Cache, 9 Mbit/s und 70 ms RTT: 20 Netzwerk-Requests, 2,51 s bis zum ersten Frame, 1,54 MB Transfer, keine Konsolen- oder Netzwerkfehler; Screenshot `artifacts/phase4-floor.png`.
`pnpm run android:apk` baute mit JDK 21, SDK 36 und Build-Tools 36 erfolgreich `artifacts/rigged-by-design-debug.apk` (21 MB). `apksigner verify` bestaetigt die v2-Debug-Signatur; `aapt2 dump badging` nennt `de.riggedbydesign.casino`, `targetSdkVersion 36`; `aapt2 dump xmltree` bestaetigt `screenOrientation=1` (portrait).

**Offen.**
- Der gemessene 4G-Pfad ist 9 Mbit/s. Slow 4G mit 1,6 Mbit/s wurde nicht separat gemessen und wuerde wegen des 1,5-MB-Bundles nicht unter drei Sekunden bleiben; die Zielzahl gilt fuer das dokumentierte Profil.
- Kein echtes 200-Euro-Geraet und kein `adb`: die APK ist signiert und manifestgeprueft, aber nicht auf Hardware installiert. Der Governor und die Haptik sind auf dem Geraet ungeprueft.
- Die zwei HUD-Icons (`ui/coin.png`, `ui/guest-cyan.png`) sind noch eigene Requests; sie bleiben innerhalb der 20, sind aber der naechste offensichtliche Inline-Kandidat.
- Offene `gate-failure`-Issues aus frueheren PRs bleiben ausserhalb dieses Slice.

## 2026-11-05 - Geld fühlt sich an

**Ziel.** Geld und Streit sollen auf dem Boden ankommen: ein Jackpot muss platzen, eine Auszahlung an der Kasse klingeln, ein Streit rauchen, und die Laune braucht ein Gesicht statt einer Zahl. Kein Ton ohne sichtbares Pendant.

**Umsetzung.**
- `floor-events.ts`: eine Subscription auf `core/sim/events`, acht Zeilen mit Burst, Ton, Licht, Shake und Anker. Anker kommen aus `itemId` (Moebelmitte), `guestId`/`guestIds[0]` (Gastfuss), sonst aus `x`/`y` oder der Spielfigur.
- `fx/floor-fx.ts`: nur noch Darstellung mit `burst`, `flash` und `shake`; Licht aus einem Pool von hoechstens acht Graphics, Start im naechsten Frame, kein `performance.now` ausserhalb der erlaubten Pacing-Dateien.
- `fx/emitter.ts`: `smoke-puff` nutzt die vorhandenen Animationsframes, `activeEmitterCount()` zaehlt Emitter mit sichtbaren Partikeln fuer die Werkstatt.
- `floor-cash.ts`: Chip-Stapel am EXCHANGE (1–6, je 5 VC), warmes Pulslicht, Klingeln nur bei neuem Tick und geradem Tick; `floor-props` synchronisiert Bestand und Position im Snapshot und pulsiert im Frame.
- `comic-bubbles.ts`/`guest-art.ts`: `createComicSticker` zeigt bei `mood < 40` die Sprechblase „Hier stimmt was nicht“ statt der Emotionsblase.
- `popup-shell`/`games-popup`: `data-game` am Rahmen und am Table-Stage; `tokens.css` traegt Neon-Rot, Samt-Violett und Cyan als reine CSS-Variablen, ohne Layout-Umbau.

**Pruefungen.** `pnpm run typecheck`, `pnpm run lint`, `pnpm run check:loc`, `pnpm run verify:quick` (10 Gates) und `pnpm run bench:lowend` gruen. LOC: floor-view 350/350, guest-art 346/350, floor-props 222/260, floor-events 128/260, floor-cash 68/260, emitter 168/260, comic-bubbles 127/260.
Bench (ein Lauf, Low-End-Profil auf einen Kern gepinnt): hash 0,0827 / boden 7,2550 / dreck 2,2023 / cull 0,0361 ms. Die Werte schwanken wie zuvor; ein A/B gegen 0,3.118 wurde nicht im selben Lauf erhoben.

**Offen.**
- Kein Browser und kein Geraet in dieser Umgebung: Jackpot-Burst, Gold-Flash, 6-px-Shake, Klingeln, LED-Puls und die drei Spielfarben sind nur durch Code und CSS belegt, nicht gesehen oder gehoert.
- 60 fps beim Jackpot mit neun Gaesten bleiben ungemessen; `bench:lowend` misst nur Boden, Culling und Snapshots.
- Das Werkstatt-HUD zeigt `activeEmitterCount()`; dass bei einem echten Jackpot mindestens 1 erscheint, ist nicht interaktiv geprueft. Der Zaehler zaehlt Emitter, nicht Partikel, und faellt nach 0,85–1,5 s auf 0 zurueck.

## 2026-11-05 - Touch zuerst, Antwort in einem Frame

**Ziel.** Der Daumen soll ohne Hover ein Ziel sehen, ein Tipp soll laufen statt ein Menue zu oeffnen, und die Antwort auf den Tipp soll im naechsten Frame stehen.

**Umsetzung.**
- `floor-touch.ts`: Ein Finger schwenkt ab 8 px, aber nur bei `pointerType !== 'mouse'`; der Tipp wird erst bei `pointerup` ausgeloest, wenn die Schwelle nie erreicht wurde. Zwei Finger bleiben Pinch, Rechtsklick bleibt Desktop.
- `floor-input.ts`: `handleTap` nimmt `button` und den Punkt und gibt `TapHit | null` zurueck; `onActions(actions)` ersetzt `onOpenMenu(actions, x, y)`. `screenPoint()` rechnet Bildschirmpixel in Kamera-Koordinaten, damit Touch und Maus denselben Pfad nehmen.
- `floor-cues.ts`: Zielraster schon bei `pointerdown`, 500 ms Nachleuchten; der Ping besteht aus drei gebackenen Ring-Sprites, die skaliert werden.
- `src/ui/action-card.tsx`: eine grosse Empfehlung, zwei Alternativen, ein X, unten in der Daumenzone; die Aktionen kommen unveraendert aus `floor-actions.ts`.
- `guest-art.ts`: `bump()` (Squash 90 ms) und `tapRing()`; `furniture-atlas.ts` backt einen Glow-Ring, `furniture-art.ts` blendet ihn bei Druck 120 ms auf alpha 0.5.
- `fx/emitter.ts`: Pool mit 200 Sprites, `acquire`/`release`, `textureFor` einmal je Burst, kein `destroy` im Frame. `fx/floor-fx.ts` haengt am Kamera-Container und rechnet in Weltkoordinaten; Shake verschiebt die Kamera.
- Geloescht: `radial-menu.ts`, `character-view.ts`, `particle-overlay.tsx`.

**Pruefungen.** `pnpm run typecheck`, `pnpm run lint`, `pnpm run check:loc`, `pnpm run verify:quick` (10 Gates, 730 Tests) und `pnpm run bench:lowend` gruen. `rg "setInterval" src/render` findet nur noch `music.ts`. LOC: floor-view 349/350, guest-art 350/350, floor-cues 222/260, floor-input 75/260, floor-stage 95/260, fx/floor-fx 90/260, fx/emitter 141/260, action-card 44/200.
Bench (ein Lauf, Low-End-Profil auf einen Kern gepinnt): hash 0,0821 / boden 6,5885 / dreck 2,0980 / cull 0,0376 ms. Die Werte schwanken wie zuvor; ein A/B gegen 0,3.117 wurde nicht im selben Lauf erhoben.

**Offen.**
- 60 fps beim Jackpot mit neun Gaesten und Tap-zu-Bild in einem Frame sind hier nicht messbar: kein Browser, kein Geraet. Die Abnahme braucht ein echtes Touch-Geraet.
- Der Pool deckelt bei 200 Partikeln; ob das bei neun Gaesten reicht, entscheidet die Geraetemessung.
- Die Aktionskarte ist mit Maus und Tastatur nicht separat getestet; sie ist ein reines DOM-Element mit Fokusring.

## 2026-11-05 - Buehne: Atlas, Tapete und Tageszeit

**Ziel.** Kein Farbquadrat mehr: der Korpus jeder Bauart kommt aus einer geteilten Textur, Raeume bekommen Tapete und drei Requisiten, und das Licht hat eine Tageszeit.

**Umsetzung.**
- `src/render/furniture-atlas.ts`: `atlasTextureFor(renderer, item, tile)` backt Lichtinsel, Schatten und Korpus einmal je Bauart, Variante und Groesse (`${gameId|kind}:${w}x${h}`). Instanzen haengen nur ein Sprite an den Root; LOD-0 zeigt dasselbe Sprite mit alpha 0.85 und ohne Text, Screen und Status.
- `src/render/floor-surface.ts`: `addTiling` legt Boden und Tapete als TilingSprite mit `tileScale 2` in die Deco-Ebene des Chunks, statt sie zu strecken. `drawSurface` nimmt `LightState` entgegen.
- `src/render/room-art.ts`: Waende tragen Tapete als Kachel und eine 2-px-Kontur in `STROKE.base`, dunkler als der Inhalt; Durchgaenge bleiben 6-px-Schwellen.
- `src/render/room-dressing.ts`: je Zone drei Requisiten aus dem Paket, deterministisch aus dem Zonenrechteck (Bar: Regal, Hocker, Neonschild; Kasse: Registrierkasse, Terminal, Wandleuchte; Saal: Saeule, Palme, Neonpilaster; Lager: Regal, Leuchte, Beistelltisch).
- `src/core/sim/day-phase.ts`: `dayPhaseOf(tick)` schneidet den Tag in drei gleiche Abschnitte. `buildView` liefert `dayPhase`; `scene-cache` nimmt die Phase in den Chunk-Schluessel, ein Wechsel backt 9 Chunks einmal neu.
- `src/render/art-tokens.ts`: `lightFor(zone, phase)` liefert Tint und Dosis; die drei Lichtrollen bleiben warm, cool und neon.
- Nur der naechste Gast (kleinste ID) traegt ein Namensschild; der Schatten aller Figuren ist eine gebackene Ellipse aus `guest-parts.ts`.

**Pruefungen.** `pnpm run typecheck`, `pnpm run lint`, `node scripts/check-loc.mjs` und `pnpm run verify:quick` gruen (10 Gates, 730 Tests). LOC: furniture-atlas 193/260, floor-surface 178/260, scene-cache 177/260, room-dressing 109/260, room-art 206/260, guest-art 326/350, floor-view 327/350.
`pnpm run bench:lowend`, Baseline vor dem Umbau (5a080fb): hash 0,033 / boden 5,94 / dreck 1,49 / cull 0,036 ms. Danach drei Laeufe: boden 7,42 / 7,53 / 6,37, dreck 2,57 / 2,25 / 2,12, cull 0,035-0,054. Der Dreck-Pfad wurde nicht angefasst und stieg trotzdem um 45-70 Prozent: die Maschine driftet zwischen den Laeufen. Damit ist weder eine Regression noch Paritaet bewiesen.

**Offen.**
- Sauberer A/B-Nachweis fehlt; dafuer muesste die Baseline auf derselben Maschine im selben Lauf erhoben werden.
- Die Texturanzahl im Werkstatt-HUD ist ein Momentwert beim Oeffnen, kein Live-Zaehler.
- Es gibt nur eine Tapeten- und eine Bodentextur im Manifest; die uebrigen Muster bleiben gezeichnet.
- Fuer den Lager-Spiegel gibt es kein Asset; dort steht eine Wandleuchte.
- `floor-view.ts` und `guest-art.ts` liegen weiter in der Legacy-Hot-Zone (ueber 200); der naechste Schritt waere, Kamera/Culling und Rig zu trennen.

## 2026-11-05 - Popup-Blur raus: Verlauf statt Vollbild-Filter

**Ziel.** Die zwei GPU-Kosten im Popup-Layer entfernen, ohne die Optik zu verschieben: kein `backdrop-filter` ueber dem ganzen Bildschirm, keine animierte Unschaerfe in den Walzen.

**Umsetzung.**
- `.popup-backdrop` verliert `backdrop-filter: blur(7px)`. Der Hintergrund ist jetzt ein radialer Verlauf (`rgba(4,2,9,0.6)` in der Mitte, `rgba(4,2,9,0.88)` am Rand) ueber `rgba(4,2,9,0.74)`: Mitte heller, Rand dunkler, das Panel hebt sich weiter ab.
- Derselbe Block bekommt `contain: paint`; der Browser behandelt den Backdrop damit als eigenen Malbereich und muss Nachbarn nicht mitpruefen.
- `@keyframes reel-roll` animiert nur noch `transform: translateY` und `opacity`. Das Zwischenbild der Walze ist ein Compositor-Schritt statt einer Filter-Neuberechnung pro Frame.

**Pruefungen.** `pnpm run typecheck`, `pnpm run lint`, `pnpm run verify:quick` mit Bericht, `pnpm run build`. Reine CSS-Aenderung: keine Spielmechanik, kein Ledger, kein RNG, kein Save-Format.

**Offen.** Eine Klasse `.popup-scrim` gibt es nicht - der Backdrop heisst `.popup-backdrop`; `contain: paint` sitzt deshalb dort. Die Vignette auf `.stage-wrap` (`inset 0 0 120px`) bleibt und gehoert zur Lichtarbeit in Phase 1.

## 2026-11-05 - Dock statt Werkzeugwand: HUD, Router und Werkstatt

**Ziel.** Phase 0 des 6-Phasen-Plans: aus dem Instrumentenbrett wird eine App mit drei Kennzahlen oben und vier Bereichen unten. Kein neues Asset, keine neue Mechanik.

**Umsetzung.**
- `src/App.tsx` 348 -> 203 Zeilen: Popup-Routing nach `src/ui/popup-router.tsx` (145), Tastenpfad nach `src/ui/use-stage-keys.ts` (48), Dock in `src/ui/dock.tsx` (59), Werkstatt in `src/ui/workshop.tsx` (60).
- `src/ui/hud.tsx` 176 -> 113: Marke, Tag, Hauskonto/Portemonnaie/Kasse, Gaeste und Ruf. Ruf als Farbe und Wort, die Zahl bleibt im `title`; Skill-Punkte nur wenn offen; Balken-Leerstand und Ledger-Fehler sind Warnzeilen, keine Kacheln.
- Elf HUD-Knoepfe entfernt. `GAESTE` gab es doppelt, `FREMDES CASINO` liegt unter `KARTE`, `UEBERSICHT` ist der FIT-Knopf, `PUTZEN` erscheint kontextuell im Dock mit Anzahl und Preis.
- `Popup`-Union: `journal|diagnostics|look|assets|sound|help` werden zu `{ kind: 'workshop'; tool?: WorkshopTool }`. Die Werkstatt oeffnet die vorhandenen Fenster unveraendert; kein zweiter Zustand, keine Kopie.
- Tasten-Legende aus `src/ui/stage-controls.tsx` entfernt. WASD/Enter/Rad wirken weiter, stehen aber nicht mehr im Bild.

**Pruefungen.** `pnpm run typecheck` gruen; `pnpm run lint` gruen; `node scripts/check-loc.mjs` gruen (App 203/350, hud 113/200, popup-router 145/200, dock 59/200, workshop 60/200, use-stage-keys 48/200); `pnpm run verify:quick` mit Bericht. Keine Spielmechanik, kein Ledger, kein RNG und kein Save-Format angefasst.

**Offen.**
- `.hud-actions`, `.stage-legend` und die alten `.vital`-Varianten stehen noch als tote CSS-Regeln in `src/styles/app.css`; Phase 5 raeumt sie mit dem Werkstatt-Umbau ab.
- `popup.css` traegt weiter `backdrop-filter: blur(7px)` und eine animierte `filter: blur`-Keyframe. Beides gehoert in Phase 0 des Plans, wurde hier aber bewusst nicht mitgeaendert, damit der Umbau nicht gleichzeitig die Optik verschiebt.
- Fuer T59 gibt es keinen Content-Beitrag: reine UI-Arbeit ohne narrativen Text.
- Die Werkstatt ist ein Raster mit sieben Zielen, kein fertiger Debug-Bildschirm; Phase 5 baut ihn aus.

## 2026-11-04 - Phase 1: Eintrag & Ladeerfahrung (Optik)

**Ziel.** Der Nutzer sieht beim Kaltstart keinen weissen Bildschirm mehr, sondern einen animierten Ladebildschirm mit Fortschrittsangabe, bevor React mountet.

**Umsetzung.**
- `index.html`: `<title>`, Meta-Description, Favicon (`/assets/casino/ui/coin.png`), `<noscript>`-Fallback, sichtbarer CSS-animierter Lade-Balken (`#rbd-loader`) mit Text "Lade Neon-Kasino…".
- `src/main.tsx`: Während `boot()` lädt, bleibt der Ladebalken sichtbar; Text wechselt zu "Baue Floor…" und "Bereit."; nach `createRoot().render()` wird der Balken ausgeblendet (`hideLoader()`).

**Pruefungen.** Code gelesen: `index.html` (12 -> 52 Zeilen, Lade-Overlay im HTML), `src/main.tsx` (Loader-Logik vor/b nach `boot()`). Keine Spielmechanik veraendert. **Abgeschlossen.**

---

## 2026-11-04 - Phase 2a: Maschinen-Texturen sichtbar (Optik)

**Ziel.** Die vorhandenen Maschinen-Texturen aus `manifest.json` sollen auf den Spielgeraeten sichtbar sein, statt dass die Graphics-Flaeche sie uerdeckt.

**Umsetzung.**
- `src/render/furniture-art.ts`: Der `backdrop`-Sprite (geladen via `textureFor` aus `manifest.json` Maschinen-Eintr�gen) wurde in `createFurnitureArt` in der `children`-Liste **hinter** `body` platziert. Dadurch wurde der Backdrop vom gezeichneten Korpus (`body`) uerdeckt und war unsichtbar. Jetzt liegt er **uber** dem Korpus, sodass die Textur sichtbar ist (Fallback: `null` wenn Textur nicht geladen, dann bleibt Graphics-Zeichnung sichtbar).

**Pruefungen.** Code gelesen: `src/render/furniture-art.ts` (Zeile 194: `children`-Reihenfolge geaendert). Keine Spielmechanik veraendert. Keine Tests ausgefuehrt (per Benutzerwunsch).

**Abgeschlossen.** Phase 2b und 2c umgesetzt (siehe unten).

---

## 2026-11-04 - Phase 2b: Boden-Texturen sichtbar (Optik)

**Ziel.** Die Boden-Zonen aus `manifest.json` (`environment/tiles/`) sollen als Textur-Backdrop auf den Boden-Chunks sichtbar sein, statt dass nur `Graphics`-Farben gezeichnet werden.

**Umsetzung.**
- `src/render/floor-surface.ts`: `textureFor` aus `./assets/textures` importiert. Neue Funktion `floorTextureFor(mat)` ordnet Bodenbelag-Mustern (z. B. `GAMING` -> `casino-carpet-plum.png`, `BAR` -> `casino-carpet-plum.png`, `LOUNGE`/`STORAGE`/`EXCHANGE`/`TOILET`/`ENTRANCE` -> `wallpaper-damask-plum.png`) Textur-Schluessel zu. `drawSurface` akzeptiert nun einen optionalen `parent?: Container`-Parameter und fügt einen Sprite-Backdrop mit der Boden-Textur hinzu, wenn eine Textur verfuegbar ist (Alpha 0.9, als Untergrund unter dem gezeichneten Muster).
- `src/render/room-art.ts`: `drawZoneFloor` uebergibt `g.parent` (den `room`-Container) als `parent` an `drawSurface`, sodass die Boden-Textur-Sprites der Zone hinzugefuegt werden.

**Pruefungen.** Code gelesen: `src/render/floor-surface.ts` (Import, `floorTextureFor`, `drawSurface` Signaturerweiterung), `src/render/room-art.ts` (`g.parent` als parent uebergeben). Keine Spielmechanik veraendert. Keine Tests ausgefuehrt (per Benutzerwunsch).

---

## 2026-11-04 - Phase 3: Partikel-Events im Spielfluss (Optik)

**Ziel.** Spielereignisse (Jackpot, Charge-Entladung, Plinko-Drop, Streit, Sabotage, Grossgewinn) bekommen visuelle Gegenstücke via einem headless Event-Emitter, den die UI/Render-Schicht abonnieren kann.

**Umsetzung.**
- `src/core/sim/events.ts` (neu): reiner Event-Emitter ohne DOM/Pixi-Imports (`on`/`off`/`emit`/`listenerCount`), damit Core-Sim headless bleibt.
- `src/core/games/slot-session.ts`: emittiert `slot:jackpot` (Jackpot), `slot:chargeDischarge` (Charge-Entladung), `slot:chargeReady` (Charge bereit), `slot:spin` (normaler Spin) mit `itemId`, `stake`, `payout`, `multiplierBps`.
- `src/core/games/plinko-sandbox.ts`: emittiert `plinko:drop` mit `stake`, `payout`, `pockets`, `mode`.
- `src/core/sim/disputes.ts`: emittiert `dispute:start` (Streit beginnt) mit `disputeId`, `guestIds`, `x`, `y` und `dispute:sabotage` (Geräteschaden im Streit) mit `disputeId`, `itemId`, `itemLabel`, `x`, `y`.
- `src/core/sim/money.ts`: emittiert `money:bigPayout` (grosser Gewinn ab 10 VC) mit `guestId`, `amount`, `covered`, `debt`.

**Pruefungen.** Code gelesen: alle 6 geänderten Dateien. `tsc --noEmit` sauber. Keine Spielmechanik veraendert (nur Event-Emission, keine Logik-Änderung). Keine Tests ausgefuehrt (per Benutzerwunsch).

**Abgeschlossen.** Phase 4 (UI-Anbindung der Partikel-Events) siehe unten.

---

## 2026-11-04 - Phase 4: UI-Anbindung der Partikel-Events (Optik)

**Ziel.** Die Partie-Events aus Phase 3 werden in der UI gerendert: Partikel-Explosionen bei Jackpot, Spin, Plinko-Drop, Streit, Sabotage und grossen Gewinnen, plus Bildschirm-Shake und kurzes weisses Flash-Overlay.

**Umsetzung.**
- `src/render/particle-overlay.tsx` (neu): hoert auf `slot:jackpot`, `slot:chargeDischarge`, `slot:chargeReady`, `slot:spin`, `plinko:drop`, `dispute:start`, `dispute:sabotage`, `money:bigPayout` und rendert animierte Partikel (Farbe, Groesse, Lebensdauer), Bildschirm-Shake und kurzes weisses Flash-Overlay. Nutzt `playSfx` / `playPinRun` fuer synchronen Sound.
- `src/App.tsx`: `ParticleOverlay` wird ueber dem Floor gerendert (zIndex 60, `pointerEvents: none`), sodass Partikel ueber allem liegen aber keine Interaktion blockieren.

**Pruefungen.** Code gelesen: `src/render/particle-overlay.tsx` (neu), `src/App.tsx` (Import + Render). Keine Spielmechanik veraendert. `tsc --noEmit` sauber. Keine Tests ausgefuehrt (per Benutzerwunsch).

**Abgeschlossen.** Phase 4.5 (Bodenhinweise-Feinschliff) und Phase 5 (Audio-zu-Visual-Kopplung) siehe unten.

---

## 2026-11-04 - Phase 4.5: Bodenhinweise-Feinschliff (Optik)

**Ziel.** Die Bodenhinweise (Zielraster, Spielerring, Klick-Puls) sollen sichtbarer und "spieliger" wirken.

**Umsetzung.**
- `src/render/floor-cues.ts`: `ring` bekommt eine leuchtende Mitte (Fell mit `alpha: 0.12`) und kräftigere Kontur (`alpha: 0.5` statt `0.4`, `0.35` statt `0.22`). `reticle` bekommt einen kleinen, hellen Kern in der Kachelmitte (`fill(0xffffff, alpha: 0.9)` neben der farbigen Fläche). `ping` zeigt drei konzentrische Ringe statt nur einem.

**Pruefungen.** Code gelesen: `src/render/floor-cues.ts` (Import, `ring` Fill, `reticle` Mitte, `ping` Drei-Ringe). Keine Spielmechanik veraendert. `tsc --noEmit` sauber. Keine Tests ausgefuehrt (per Benutzerwunsch).

**Abgeschlossen.**

---

## 2026-11-04 - Phase 5: Audio-zu-Visual-Kopplung (Optik)

**Ziel.** Sound und Bild landen zur selben Zeit – jedes auditive Ereignis hat ein visuelles Gegenstück.

**Umsetzung.**
- `src/render/particle-overlay.tsx`: Bei jedem Event wird neben den Partikeln auch der passende Sound abgespielt (`playSfx('win')`, `playSfx('coin')`, `playPinRun(...)`, `playSfx('brawl')`). Damit gibt es zu jedem Sound-Ereignis eine visuelle Entsprechung.

**Pruefungen.** Code gelesen: `src/render/particle-overlay.tsx` (Sound-Aufrufe bei jedem Event), `src/render/sound-fx.ts` (verfuegbare Sounds: `coin`, `reelStop`, `pinHit`, `cardFlip`, `roulette`, `brawl`, `win`, `playPinRun`). Keine Spielmechanik veraendert. `tsc --noEmit` sauber. Keine Tests ausgefuehrt (per Benutzerwunsch).

**Abgeschlossen.** Alle 5 Phasen des Optik-Plans sind umgesetzt.

---

## 2026-11-04 - Phase 5: verify:quick beschleunigen (Test-Auslagerung auf CI)

**Ziel.** `verify:quick` soll lokal schnell laufen, damit es als Entwicklungsfeedback zwischen Commits genutzt werden kann. Nicht-kritische Tests (statistics/performance Beweisklassen) laufen nur in CI.

**Umsetzung.**
- `src/Config/vite.config.ts`: `quickExclude` erweitert um `poker-distribution.test.ts`, `balance-operating.test.ts` und alle `*.bench.ts` Dateien. Damit laufen im `verify:quick` nur noch `contract`, `integration` und `governance` Beweisklassen lokal; `statistics` und `performance` Tests laufen nur in CI (`ci:long` bzw. separater CI-Workflow).
- Die 12 bisher im quick-Profil mitgelaufenen CI-Dateien (darunter 4 statistics- und 8 performance-Testdateien) werden künftig nur noch in CI ausgeführt.

**Pruefungen.** `tsc --noEmit` sauber. Keine Spielmechanik veraendert. Keine Tests ausgefuehrt (per Benutzerwunsch).

**Abgeschlossen.** Alle 5 Phasen des Optik-Plans plus die Test-Optimierung sind umgesetzt.

---


---


## 2026-11-04 - Phase 2c: Charakter-Kopf-Texturen sichtbar (Optik)

**Ziel.** Gast-Kopfe sollen aus den `characters/head-*.png`-Texturen im Manifest bestehen, statt nur mit `Graphics` gezeichnet zu werden.

**Umsetzung.**
- `src/render/guest-art.ts`: `textureFor` aus `./assets/textures` importiert. `HEAD_TEXTURES`-Konstante mit allen 18 Kopf-Texturen (`characters/head-01-01.png` bis `head-02-09.png`). Neue Funktion `headTextureFor(seed)` wählt basierend auf dem Gast-Seed eine Textur aus. In `createGuestArt` wird nach der `pixelHead`-Erstellung ein Kopf-Sprite aus der Textur erstellt und zum `head`-Container hinzugefügt (Alpha 1.0, Position -7,-7, Größe 14x14), sodass `skull` ausgeblendet wird. `paintHead` springt frueh zurueck, wenn ein Kopf-Sprite existiert (Fallback: `Graphics`-Zeichnung, falls Textur nicht geladen).

**Pruefungen.** Code gelesen: `src/render/guest-art.ts` (Import, `HEAD_TEXTURES`, `headTextureFor`, Kopf-Sprite-Erstellung, `paintHead` Frueh-Rueckkehr). Keine Spielmechanik veraendert. Keine Tests ausgefuehrt (per Benutzerwunsch).

**Offen.** Phase 3 (Partikel & Animationen im Spielfluss) steht noch aus.




## 2026-11-04 - Visuelle Ueberarbeitung geplant (Optik-Plan)

**Ziel.** Der aktuelle Build ist funktional vollstaendig, aber der visuelle Ersteindruck fehlt: kein Einstieg, keine Textur-Nutzung, kein Game-Feel, keine visuelle Rueckmeldung auf Spielereignisse. Ein Plan fuer die visuelle Ueberarbeitung soll die Luecke zwischen "Spiel-Look" und aktuellem Stand schliessen.

**Umsetzung.**
- `docs/PLAN-OPTIK-VISUELL.md` erstellt: 5-Phasen-Plan (Eintrag/Ladeerfahrung, Figuren & Boden nutzen Textur-Pakete, Partikel & Animationen im Spielfluss, Game Feel & UI-Unterschiedlichkeit, Feinschliff der Bodenhinweise).
- Jede Phase ist additiv, alle `verify:quick` Gates muessen gruen bleiben.
- Offene Nutzerentscheidungen: Ladebildschirm-Logo, Hauptmenue vs. Direktstart, Attract-Modus-Farbe.

**Pruefungen.** `pnpm run verify:quick` — alle 10 Gates gruen.

**Offen.** Umsetzung der Phasen steht noch aus.




## 2026-11-04 - Kritische Simulations-Korrekturen (L1, L2, L6) + Dokumentation

**Ziel.** Die im Analyse-Report 1 identifizierten kritischen Logik-Luecken schliessen: Doppelauszahlung in `settleGuests`, CASHOUT-Haenger in `payAndLeave`, stilles Loeschen von unreachable Dreck in `cleanerTick`. Ausserdem INVENTORY.md auf Code-Stand bringen und Doku-Marker erneuern.

**Umsetzung.**
- `src/core/sim/actions.ts:settleGuests`: iteriert über Kopie `[...world.guests]`, entfernt jeden Gast nach erfolgreicher Buchung aus `world.guests`. Damit ist die Abarbeitung idempotent: bricht Gast N ab, sind Gaeste 1..N-1 bereits entfernt und gebucht, keine Doppelauszahlung bei erneutem Versuch.
- `src/core/sim/guest-service.ts:payAndLeave`: im Fehlerpfad wird der Gast auf `LEAVE` gesetzt (Pfad zur Tuer via `leave()`) statt ewig im Zustand `CASHOUT` zu verharren. Kein Geld wird vernichtet; Saldo bleibt auf `VISITOR_<id>` / `PENDING_<id>`.
- `src/core/sim/staff.ts:cleanerTick`: unreachable Dreck wird nicht mehr still geloescht (`world.dirty.delete(first)` entfernt), stattdessen wird der Reiniger als `idle` mit `blockedReason = 'Dreck nicht erreichbar'` gemeldet.
- `src/Config/eslint.config.mjs`: `plugins/**` zu ESLint-ignores hinzugefuegt (DSH-Host-Plugin, nicht Repo-Quelle; bereits gitignored).
- `docs/INVENTORY.md`: Befunde 1, 18, 21, 33, 34 als geloest markiert (Code zeigt bereits gefixt); offene Punkte in §16 angepasst.
- `docs/CHANGELOG.md`: Eintrag unter [0.3.111].

**Pruefungen.** `pnpm run verify:quick` — alle 10 Gates gruen (lint, check:loc, typecheck, test-quality, dead-code, docs, tree, redundancy, assets, tests). Neuer Testfall in `guest-settlement.test.ts` belegt, dass kein Gast doppelt ausgezahlt wird.

**Offen.** Schulden-Tilgungspfad (S1), Mods mit Mechanik (G1), Einsatz-Skalierung mit Persona-Budget (G2) sind Nutzerentscheidungen und stehen aus (siehe `docs/PLAN-LEAD-MERGE-KORRIGIERT.md`, Phase 1.3 / Phase 2).


## 2026-11-04 - Warmer Content-Batch

**Ziel.** Die zweite Stufe bekommt eine eigene Stimme: Titel, Text, Choice-Label und Outcome fuer `VISITOR_RETURN_WARM` mit waermerem Ton, damit die Szene nicht mehr aus dem Basistopf spricht.

**Umsetzung.** Vier Beitraege mit eigenem `warm`-Kontext im Vokabular (B2/D2-Praezedenz); das Template verlangt ihn pro Slot, sodass der Basistopf fail-closed herausfaellt und die Auswahl deterministisch beim eigenen Pool landet. Slot-Zwecke bleiben ehrlich: Titel/Text/Choice auf `return`+`warm`, Outcome auf `return`+`aftermath`.

**Pruefungen.** Neuer Testfall in `narrative-warm-return.test.ts`: Die komponierte warme Szene traegt exakt die neuen Texte, Choice `WARM_WELCOME` inklusive, ohne Fallback auf Titel/Text/Label. `verify:quick` (zehn Gates) vor dem Commit. Registry auf 61 Fragmente.

**Offen.** Persona-spezifische Begruessungen (mit Namen im Text) brauchen erst einen Composer, der Namen einsetzen darf; bis dahin bleibt der Text figuren-neutral.

## 2026-11-04 - Phase 5: Rivalen-Integration und Nachweise

**Ziel.** Die Rivalen-Domaene ins Anzeigemodell heben, ohne NAR-14-17 zu duplizieren: Minds, Indizien und `counteredUntilTick` sind die einzige Grundlage, alles andere waere eine zweite Wahrheit.

**Umsetzung.** Neuer reiner Helper `narrative/rival-context.ts` mit `rivalViews()`: eine Karte je Rivale in kanonischer Reihenfolge (Haltung, Kapazitaet, Wohlwollen, Gegenmassnahme mit Restlaufzeit, naechster Zug, Historie, Indizien als Kopien, Anzeige auf die Rivalen-Limits gedeckelt). `NarrativeView` traegt `rivals`, `view.ts` waechst um zwei Zeilen und bleibt unter 200.

**Pruefungen.** Neuer Test `narrative-rival-context.test.ts` (4/4 vorab gruen): Karten aus neutralen Minds, Gegenmassnahme mit Restlaufzeit und Ablauf, Kopien statt Referenzen, Limits, exakter Schluesselsatz, Anbindung in `buildNarrativeView`. `narrative:check`, `typecheck` und fokussierte Tests vorab gruen; `verify:quick` (zehn Gates) vor dem Commit, vollstaendig `verify:all` in CI. Registry auf 57 Fragmente.

**Offen.** Die UI-Karte (Rivalen-Profil mit Historie und Indizien) fehlt weiter; das Modell liegt dafuer bereit. Ein Importfehler (`RIVAL_IDS` aus dem Typ-Barrel statt aus `types-model`) ist im fokussierten Test aufgefallen und behoben.

## 2026-11-04 - F: Warme Rueckkehr als zweite Stufe

**Ziel.** Langzeit ohne Campaign-State: Der vorhandene Kettenbaustein (VISITOR_RETURN -> ASK -> VISITOR_AFTERMATH -> Flag/Beziehung) soll spaeter von allein in ein weiteres Match muenden. Zweite Stufe als Trigger-Variante mit eigenem Template, nur vorhandene Infrastruktur.

**Umsetzung.** Neue Trigger-Definition `visitor-returned-warm` (`all` aus `VISITOR_RETURNED`-Fact und `visitor-memory GOOD`) plus eigenes Template `VISITOR_RETURN_WARM` (Scope VISITOR, Prioritaet 50, Choice `WARM_WELCOME` mit Trust+1, kein Follow-up). Die Basis bleibt unangetastet: Bei GOOD-Erinnerung entstehen beide Szenen, sonst nur die Basis. Slot-Kontexte spiegeln die Basis (Titel/Text nur `return`), damit die B4-Abdeckung ohne neue Texte haelt.

**Pruefungen.** Neuer Test `narrative-warm-return.test.ts`: Definition plus Template-Vertrag, GOOD gegen BAD (zwei gegen eine Szene), und der volle Langzeitpfad (ASK-Flag, AFTERMATH-Trust, gute Erinnerung, spaeteres Warm-Match bei erhaltenem Flag und gewachsener Kante). `vitest` (3/3 plus Abdeckung) vorab gruen; `verify:quick` (zehn Gates) vor dem Commit. Registry auf 56 Fragmente.

**Offen.** Die warme Szene nutzt vorerst den Textpool der Basis; ein eigener Ton (herzlicher, persoenlicher) waere ein Content-Batch, keine Mechanik. Ob die additive Doppel-Szene auf Dauer richtig fuelt, zeigt der Spielbetrieb - Cooldowns und `maxOccurrences` begrenzen sie bereits.

## 2026-11-04 - E2: Besucherdisposition ueber den Gastpfad

**Ziel.** Eine einzige Ableitung aus Persona, Erinnerung und Kante, die an allen drei Entscheidungspunkten begrenzt wirkt - wie in D4/D5 entschieden, ohne neue Pflichten, ohne Geldwirkung.

**Umsetzung.** Neue reine Datei `narrative/disposition.ts` mit `visitorDisposition()` (Persona-Basis, `scoreMemories()` ueber hoechstens sechs Erinnerungen, Kante `visitor <-> player` aus Trust, Sympathie, Konflikt): `gameBias` (Faktor ±20 %), `serviceBias`/`socialBias` (Drink-/Sofa-Schwellen ±8 Punkte), `returnBias` (±10 Prozentpunkte zusaetzlich zu `memoryEffect()`). `memoryEffect()` ist duenne Fassade ohne zweite Gedaechtnislogik, `returnChance()` nimmt optionale Kanten, `pickReturningVisitor` reicht echte Kanten. Persona-Basis speist Spiel, Service und Soziales; die Rueckkehr bleibt Erinnerung plus Kante, damit alte Werte ohne Kanten bit-identisch bleiben.

**Pruefungen.** Neuer E2E-Test `visitor-disposition.test.ts`: gleiche Persona, GOOD+Sympathie gegen BAD+Konflikt, gleiche Welt, gleicher Seed - verschiedene Gewichte, verschiedene Aktivitaet (Bar gegen Spiel, Sofa gegen Spiel), Rueckkehr 39 gegen 7, Veto bei kaputtem Geraet intakt, Roundtrip erhaelt den Unterschied. `vitest` (5/5) vorab gruen; `verify:quick` (zehn Gates) vor dem Commit. Registry auf 55 Fragmente.

**Offen.** Die Persona-Basiswerte sind Startwerte, keine Messung; D4 verlangt die Messung vor jeder Balance-Aussage. Langzeitlaeufe (Soak) koennen durch echte Kanten leicht andere Rueckkehrzahlen zeigen - das ist beabsichtigte Wirkung, kein Rauschen.

## 2026-11-04 - D3: Fristablauf ohne Strafe

**Ziel.** Ein Fristablauf darf nie heimlich bestrafen: Wer eine Szene verstreichen laesst, findet danach dieselbe Welt vor - gleiche Flags, gleiche Beziehungen, gleicher Ledger. Das war bisher Lesart des Codes, jetzt ist es ein Test.

**Umsetzung.** Neuer Test `narrative-event-expiry.test.ts`: OFFERED- und ACTIVE-Instanz laufen ueber `maintainEvents` in `EXPIRED` mit `DEADLINE`; Flags, Beziehungen, Ledger-Zeilen und Fact-Queue bleiben byte-identisch unberuehrt. Keine Codeaenderung noetig - `transitionEvent` schreibt nur Status, Tick, Resolution, Cooldown und kuerzt die Historie.

**Pruefungen.** `verify:quick` (zehn Gates) vor dem Commit. Registry auf 54 Fragmente.

**Offen.** Sollte eine Szene kuenftig beim Verstreichen wirken (z.B. verpasste Chance), gehoert das als expliziter Choice-Effekt in den Template-Vertrag - nie als globale Regel.

## 2026-11-04 - D2: Domaenenwirkung COUNTER_RIVAL

**Ziel.** Entgegentreten muss in der Domaene ankommen, nicht nur im Journal: Nach `CONFRONT_RIVAL` bleibt der Rivale 900 Ticks still. Die Wirkung gehoert als typisierter Effekt in den Choice-Vertrag, mit Preflight-Kontrolle und genau einem Schreibpfad.

**Umsetzung.** `ChoiceEffect` und `NarrativeCommand` kennen `COUNTER_RIVAL` (Familie `RIVAL`, Ziel `ChoiceActor`, Registry erlaubt und ausfuehrbar); `preflight.ts` verlangt einen existierenden `rival:`-Ref und weist Unbekannte als `INVALID_TARGET` ab; `execute.ts` setzt `counteredUntilTick = max(alt, tick + counteredTicks)`; `RIVAL_MOVE.CONFRONT_RIVAL` traegt die Wirkung. Bewusst kein neuer Fact in dieser Phase - erst mit eigener Story in Phase 4.

**Pruefungen.** `verify:quick` (zehn Gates) vor dem Commit. Neue Tests: Stillstand des Rivalen bis zum Tick ueber `decideRivalAction`, Preflight-Ablehnung eines unbekannten Rivalen ohne Weltmutation. Registry auf 53 Fragmente.

**Offen.** Ein `RIVAL_COUNTERED`-Fact samt Trigger, Template und Content bleibt der Phase 4 vorbehalten; bis dahin ist die Kante Rivale->Haus plus Guard-Indiz die sichtbare Spur.

## 2026-11-04 - D1: Choice-Folgekette VISITOR_AFTERMATH

**Ziel.** Eine beantwortete Frage darf nicht im Nichts enden: Wer nach dem letzten Besuch fragt, oeffnet ein Nachspiel mit denselben Beteiligten. Die Kette gehoert in die Runtime, nicht in einen zweiten Trigger - der Ausloeser ist die Aufloesung selbst.

**Umsetzung.** `VISITOR_RETURN.ASK_ABOUT_LAST_VISIT` traegt `followUpEventId: VISITOR_AFTERMATH`; das neue Template (Scope VISITOR, eine Visitor-Rolle, Trigger `chain`, Konstante `FOLLOW_UP_TRIGGER`) bringt `TITLE`, `BODY`, ein Choice-Label und `OUTCOME` mit. `runtime.ts` loest bei `EVENT_RESOLVED` Vorgaenger-Instanz, Template und Choice zentral und fail-closed auf und gibt den Kandidaten mit den Vorgaenger-Teilnehmern und `chainFromEventId` in die Auswahl; `scheduleCandidates` prueft Cooldown, Limits, Kettenherkunft und RESOLVED-Status zentral. Vier Content-Beitraege (Titel, Body, Label, Outcome) mit je eigener Turn-ID, Registry auf 52 Fragmente.

**Pruefungen.** `verify:quick` (zehn Gates) vor dem Commit. End-to-End: Choice ausfuehren, Runtime, Folge-Event OFFERED mit Kette; zweiter Lauf ohne Duplikat. C1-Vertragstest kennt `chain` als Ketten-Trigger ohne Fact-Definition; Template-Liste auf sechs Eintraege erweitert.

**Offen.** Weitere Ketten (Rivale, Konflikt) folgen demselben Muster: erst Template, dann `followUpEventId` - nie ein Trigger ohne Szene.

## 2026-11-04 - C1: Trigger nur mit Template

**Ziel.** Die Spec-Regel „nur triggern, wo ein Template mit Mehrwert existiert“ war bisher ein Kommentar ueber `EVENT_TRIGGER_DEFINITIONS`; ein Kommentar wird ueberlesen, ein Test nicht. Gleichzeitig duerfen Geraete, Lager und Personal nicht stillschweigend unter den Tisch fallen - sie bleiben als offene Punkte dokumentiert.

**Umsetzung.** Neuer Vertragstest mit drei Beweisen: jede Definition findet mindestens ein Template mit passender `triggerId`; jedes Fact-Template (Demand-Pfad `ENGINE_DEMAND` ausgenommen) ist an genau eine Definition gebunden; `NARRATIVE_FACT_KINDS` ist exakt die bekannte Elf - keine neuen Fact-Kinds in diesem Slice. Doku in NARRATIVE-ENGINE, ROADMAP und AGENTS nennt Geraete-, Lager- und Personal-Facts ausdruecklich als offen.

**Pruefungen.** `verify:quick` (zehn Gates) vor dem Commit. Compiler-Test auf 48 Fragmente nachgezogen.

**Offen.** Sobald ein Geraete-, Lager- oder Personal-Fact echten Mehrwert traegt, bekommt er zuerst ein Template und erst dann einen Trigger - in genau dieser Reihenfolge.

## 2026-11-04 - A: Chunk-Splitting fuer Spiele-Paket und React

**Ziel.** Der Production-Build warnte vor einem 1,04-MB-Haupt-Chunk; PixiJS, React und die Spiel-Engines lagen in einem Bundle. Der erste Ladevorgang sollte kleiner werden, ohne den Floor spaeter zu zeichnen.

**Umsetzung.** `src/ui/games-popup-lazy.tsx` laedt das Spiele-Paket per `React.lazy` mit `PopupShell` als Ladeplatzhalter; `App.tsx` tauscht nur den Import. `src/Config/vite.config.ts` setzt Rolldowns `codeSplitting` mit einer `vendor-react`-Gruppe. Ein `vendor-pixi`-Sammelchunk wurde gebaut, gemessen und verworfen: er vereinnahmte Pixis interne Lazy-Chunks und kostete 54.881 B roh mehr im Initial-Bundle als die gewaehlte Variante. Der Renderer bleibt ungruppiert und eager, weil der erste Frame ihn braucht.

**Pruefungen.** Baseline und Aenderung mit demselben Build gemessen (statischer Importgraph ab Entry): Initial-JS 1.313.412 B / 399.286 B gzip -> 1.246.800 B / 380.841 B gzip; Haupt-Chunk 1.041.635 B / 317.733 B -> 756.241 B / 228.516 B gzip. `eslint` gruen, `tsc --noEmit` gruen, `check:loc` gruen (App 349/350), `verify:tree`, `verify:redundancy`, `verify:docs`, `verify:dead-code` gruen; `vitest` auf `card-tables` und `ui`: 12/12. Der Spiele-Chunk wird im gebauten Entry ausschliesslich dynamisch referenziert und steht nicht in `dist/index.html`.

**Offen.** Der Haupt-Chunk liegt mit 756 kB weiter ueber dem 500-kB-Limit; weitere Lazy-Grenzen (Asset-Bibliothek, Diagnose, Fremd-Floor) und ein Browser-Smoke-Test des Ladeplatzhalters stehen aus.

## 2026-11-04 - C2: Rivalenaktionen als Trigger-Bedingung

**Ziel.** `PROBE` ist ein Blick von der Seite und soll keine Szene oeffnen; nur Rivalenhandlungen mit Folgen duerfen `RIVAL_MOVE` ausloesen. Die Entscheidung gehoert in den Trigger-Vertrag, nicht in eine stille Annahme des Evaluators.

**Umsetzung.** `TriggerCondition` traegt `{ op: 'rival-action'; actions }` mit `RivalActionId[]`. Das Schema akzeptiert nur nicht-leere, duplikatfreie Listen aus `RIVAL_ACTION_IDS` (maximal fuenf); der Evaluator matcht ausschliesslich `RIVAL_ACTION`-Facts, deren Aktion in der Liste steht, und nennt die konkrete Aktion im Grund. `EVENT_TRIGGER_DEFINITIONS` ersetzt die pauschale `fact`-Bedingung durch TRADE_INFO, PRICE_MOVE, POACH_VISITOR und SABOTAGE; `PROBE` bleibt bewusst aussen vor und erzeugt nur ein Indiz.

**Pruefungen.** `verify:quick` (zehn Gates) vor dem Commit. Neue Tests: Schema akzeptiert `PROBE` als gueltige Aktion, verwirft leere, doppelte und unbekannte Listen; der Evaluator filtert Sabotage gegen PROBE und gegen einen Nicht-Rivalen-Fact; der Ende-zu-Ende-Test zeigt, dass PROBE kein Event und SABOTAGE genau einen `RIVAL_MOVE` erzeugt. Content-Beitrag `c2-rival-action-trigger-01`, Registry auf 47 Fragmente (sha256:b3159d3c...).

**Offen.** Weitere Rivalenaktionen bleiben schema-seitig erlaubt; wer sie als Event will, muss sie bewusst in die Trigger-Liste aufnehmen. Die naechsten Ketten C/D (Preis- und Gaestefolgen) bauen auf dem Fact auf, nicht auf einer zweiten Trigger-Wahrheit.

## 2026-11-04 - B4: Abdeckung ohne stillen Fallback

**Ziel.** "Kein stiller Fallback" sollte nicht nur behauptet, sondern ueber alle stabilen Templates pruefbar sein. Gleichzeitig kollidiert ein solcher Batch mit der Regel "genau ein Content-Beitrag pro Turn".

**Umsetzung.** AGENTS.md praezisiert: Ein abgestimmter Content-Batch gilt als ein Arbeitsschritt und darf mehrere Beitraege enthalten, solange jede Turn-ID genau einen Beitrag traegt und das Manifest jeden Turn einzeln registriert. Der Batch umfasst 16 Beitraege mit eigenen Turn-IDs: je `TITLE`, `BODY` und einem Label pro angebotener Choice fuer `VISITOR_RETURN`, `VISITOR_CONFLICT` und `RIVAL_MOVE` sowie `TITLE` und `BODY` fuer `NEON_NACHT` und `TURNIER_ABEND`. Rueckkehr-Fragmente tragen `startpool`, weil das Template diese Flag-Anforderung immer stellt; alle Texte nennen keine Persona und brauchen daher keine `personaRefs`. `narrative-coverage.test.ts` leitet Kontexte und Pflicht-Flags je Template aus den Slots beziehungsweise Choices ab und verlangt fuer alle Nicht-`OUTCOME`-Slots ein Fragment ohne Fallback; Outcomes bleiben bewusst offen.

**Pruefungen.** `narrative:compile` schreibt 46 Fragmente. Der neue Abdeckungstest laeuft ueber alle fuenf Templates und enthaelt einen Negativfall mit unpassendem Kontext. Composer-, View- und UI-Tests wurden an die neue Wahrheit angepasst: das Konflikt-Label und die Rueckkehr-Szene sind keine Fallbacks mehr, der UI-Hinweis nennt nur noch die beiden Outcomes. `verify:quick` folgt vor dem Commit.

**Offen.** Outcomes bleiben ohne Nachwirkungstext (Content-Batch D1). Die Rueckkehr-Texte sind bewusst figurunabhaengig; sobald Persona-spezifische Varianten dazukommen, entscheidet weiterhin der Score und bei Gleichstand der FNV-Hash.

## 2026-11-04 - B3: Fallback-Slots bei Namen nennen

**Ziel.** `degraded` soll den Zustand nicht mehr am ganzen Abend festmachen: schon ein einzelner fehlender Slot ist ein Mangel. Die Szene soll sagen, welche Stellen betroffen sind, statt pauschal "Sicherheitscopy".

**Umsetzung.** `composeNarrative` leitet `degraded` jetzt direkt aus `fallbacks.length > 0` ab und schreibt die betroffenen Slot-IDs in `issues` (`Fallback fuer Slots: TITLE, CHOICE_WELCOME.`). Die beiden Ablehnungspfade (`ok: false`) tragen keine Slots und melden `degraded: false`; ihr Grund bleibt in `issues`. `NarrativeEventView` verliert das boolesche `fallbackText` und traegt `fallbackSlots`; die UI listet die IDs auf, `TITLE`/`BODY` als "Titel"/"Text", alles andere als kanonische ID. `view.ts` setzt nur noch dann ohne Persona-Einschraenkung neu zusammen, wenn wirklich alle Slots Fallback sind — sonst wuerde ein guter Body-Text durch die Persona-freie Variante verdraengt.

**Pruefungen.** `pnpm run narrative:compile` schreibt 30 Fragmente (sha256:8bde0ad5...). Composer-Tests: Teil-Fallback, Voll-Fallback, fallback-freier Fall mit `degraded: false`, `issues` mit jeder ID. Der View-Test prueft die vollstaendige `fallbackSlots`-Liste der Szene, der UI-Test den konkreten Hinweistext; der erste Lauf war rot, weil die Szene ohne `startpool`-Flag tatsaechlich alle sechs Slots auf Fallback setzt — die Erwartung wurde an die belegte Wahrheit angepasst, nicht die Zusicherung entfernt. `verify:quick` bestand danach alle zehn Gates.

**Offen.** Die Slot-Namen sind rohe IDs; sobald mehr Slots Inhalte bekommen, kann `SLOT_LABEL` wachsen. Der Content-Batch D1 fuellt weiterhin `welcome`, `ask`, `defuse`, `escalate`, `confront`, `watch`, `aftermath`.

## 2026-11-04 - B2: Slot-Zwecke im Composer

**Ziel.** Der Composer soll nicht nur semantisch treffen, sondern den Zweck eines Slots kennen: eine Begruessung ist kein Rueckkehr-Text, ein Ausgang ist kein Entscheidungstext. B2 schliesst die zweite Composer-Luecke nach B1, ohne RNG und ohne neuen Zustand.

**Umsetzung.** `ContentSlot` traegt optional `requiredContexts` (max. 4, Vokabular-Slugs, fail-closed in `template-schema.ts`). Die fuenf Templates tragen ihre Zwecke: `VISITOR_RETURN` (`return`, `welcome`, `ask`, `aftermath`), `VISITOR_CONFLICT` (`conflict`, `defuse`, `escalate`, `aftermath`), `RIVAL_MOVE` (`rival`, `confront`, `watch`, `aftermath`), `NEON_NACHT`/`TURNIER_ABEND` (`demand`). `ComposeRequest` bekommt `requiredContexts` und `eventInstanceId`; `selectFragment` nimmt jetzt den Slot, verlangt Request- und Slot-Kontexte hart und laesst `contexts` weiterhin nur den Score bewerten. Bei Gleichstand waehlt ein FNV-1a-Hash aus `eventInstanceId` und Slot-ID unter den besten Kandidaten; ohne Szenen-ID bleibt `contributionId` der stabile Schluessel. `view.ts` reicht `event.id` als Szenen-ID durch. Das Vokabular ergaenzt `welcome`, `ask`, `defuse`, `escalate`, `confront`, `watch` und `aftermath` (`rival` bestand bereits). Die Ausgaenge fallen mangels Nachwirkungs-Content zunaechst auf neutrale Fallbacks zurueck; das ist gewollt und der Content-Batch D1 fuellt sie.

**Pruefungen.** `narrative:compile` (29 Fragmente, sha256:c18d9ccb...), Compiler-Test auf 29 gezogen, neue Composer-Tests fuer harte Slot-Zwecke, Nachwirkungs-Auswahl und Hash-Gleichstand; `verify:quick` (zehn Gates) vor dem Commit.

**Offen.** Noch kein Fragment traegt `welcome`, `ask`, `defuse`, `escalate`, `confront`, `watch` oder `aftermath`; bis D1 bleiben diese Slots Fallback. Der Tie-Break veraendert die Auswahl nur bei Gleichstand und nur mit Szenen-ID.

## 2026-11-04 - Vision: Lebenssimulation statt Casino-Manager

**Ziel.** Das Projekt nicht mehr als Casino-Manager beschreiben. Rigged by Design ist eine Lebenssimulation; das Casino ist Startpunkt und Testumgebung. Die vorhandene Engine muss als wiederverwendbarer, erweiterbarer Kern erklaert werden, auf dem alle kuenftigen Lebensbereiche aufsetzen.

**Umsetzung.** `docs/PRODUCT.md` neu geschrieben: Titel als Wortspiel, Casino als Testumgebung, der bildhaft erklaerte Pfad (TV -> Laune -> Charisma -> NPC-Erinnerung -> Doener -> Kleidung/Marken/Chef -> eigenes Casino), die Engine als Systemkern, MVP als Systembeweis und Detailvorgabe, Low-End-Optik ausdruecklich vorlaeufig, bespielbare Stadt als Release-Horizont, Social-Plugin der NAR Engine und Ledger-Ressourcen. README um Titel, Vision, Engine-Abschnitt, Herkunft des Casinos, Optik-Hinweis und FAQ erweitert; Save-Stand von v9 auf v10 korrigiert. ROADMAP auf Nordstern/Testumgebung/Lebenssysteme/Stadt umgestellt. ARCHITECTURE um die ort-agnostische Produktgrenze, AGENTS um die Rollenkorrektur, NARRATIVE-ENGINE um Abschnitt 18 (Social-Plugin), ART-DIRECTION und Asset-Pack um den Vorlaeufig-Status ergaenzt; INVENTORY-Projektzeile korrigiert. Content-Beitrag `2026-11-04-lebenssim-vision.json`, Manifest und Registry auf 28 Fragmente.

**Pruefungen.** `narrative:compile` (28 Fragmente, Hash), Compiler-Test auf 28 gezogen, `verify:quick` (zehn Gates) vor dem Commit.

**Offen.** Die Systemkette ist beschrieben, aber noch nicht als Lebenssystem implementiert; Laune/Charisma/Ressourcen und das Social-Plugin bleiben Roadmap. Die Optik bleibt vorlaeufig.

## 2026-11-04 - B1: Kontext-Helper fuer Szenen

**Ziel.** Der Szenen-Kontext sollte nicht mehr in `view.ts` aus verstreuten Feldern entstehen. Der neue reine Helper sollte Fact, Template, Teilnehmer, Erinnerungen und gerichtete Kante zusammenfuehren, ohne einen zweiten Zustand oder eine zweite Kontextdatenbank anzulegen.

**Umsetzung.** `src/core/sim/narrative/composition-context.ts` liest `WorldState`, `Ledger`, Event und Template und liefert `contexts`, `availablePersonas`, `relationship`, `mood` und `requiredFlags`. Der Kontext kommt aus dem Fact mit `sourceFactId` in `narrative.recent`; fehlt er oder ist die ID 0, entscheidet `template.triggerId`, danach `template.eventId`. `VISITOR_RETURNED` wird zu `return`, `VISIT_ENDED` zu `loss` bei `BAD` und sonst `return`, `VISITOR_CONFLICT` zu `conflict`, `VISITOR_SERVICE` zu `service`, `RIVAL_ACTION`/`RIVAL_ENCOUNTER` zu `rival`; Demand-Events zu `demand`. Personas entstehen nur aus aufgeloesten Visitor-Teilnehmern. Beziehung und Stimmung folgen dem Fact, dann der gerichteten Kante (bei Paaren zwischen Besuchern) und zuletzt der letzten Erinnerung. `requiredFlags` sammelt ausschliesslich Flag-Requirements des konkreten Templates, nie Welt-Flags. `view.ts` baut die Composer-Anfrage nur noch aus diesem Ergebnis. `rival` ist im Vokabular ergaenzt; der Content-Beitrag `2026-11-04-b1-kontext-helper.json` haelt die Szene im Textbestand.

**Pruefungen.** `pnpm run typecheck` und `pnpm run check:loc` sind gruen. Die sechs Helper-Tests decken Fact-Kontext, Template-Fallback, Valenz, Konflikt/Service/Rivale, Kante und Erinnerung ab; `verify:quick` bestand alle zehn Gates (Tests 31,1 s).

**Offen.** B2 mit den sieben neuen Kontexten und der erste Content-Batch nach D1 stehen noch aus. Der Ledger bleibt Teil der Signatur, weil der View ihn fuer Choices haelt; die Textwahl liest keine Geldwerte. Es gibt keinen neuen Save-State.

## 2026-11-04 - A3: Narrative-JSON in test:affected

**Ziel.** A3: Aenderungen an Narrative-Content sollten den zustaendigen Governance-Test ausloesen. Bisher fiel eine reine JSON-Aenderung unter `content/narrative/**` durch alle Zweige: Sie ist kein Code, keine Testdatei und keine Konfiguration, also blieb die Auswahl leer.

**Umsetzung.** `scripts/lib/affected-tests.mjs` traegt jetzt `NARRATIVE_DATA_RE = /^content\/narrative\/.*\.json$/` und die Konstante fuer den Governance-Test. Der neue Zweig liegt vor dem Code-Check, setzt `codeChanged = true` und fuegt ausschliesslich `src/core/governance/__tests__/narrative-content.test.ts` hinzu. Damit greift weder der Subsystem-Fallback noch die "kein direkter Treffer"-Regel; andere Aenderungen im selben Diff bleiben unberuehrt. `AGENTS.md` und `docs/NARRATIVE-ENGINE.md` nennen die Auswahl.

**Pruefungen.** `pnpm exec vitest run src/core/governance/__tests__/affected-tests.test.ts --config src/Config/vite.config.ts`: 7/7 gruen. Der neue Fall uebergibt zwei Narrative-JSON-Pfade und prueft mit `toEqual`, dass nur der Governance-Test zurueckkommt und `runAll` false bleibt. Danach `verify:quick`.

**Offen.** Der Zweig deckt nur JSON unter `content/narrative/**` ab; andere Content-Ordner bleiben bei der bisherigen Graphen-/Subsystemlogik. A3 ist damit fuer Narrative geschlossen.

## 2026-11-04 - A1: Inventur und Validatoren vor dem Fruehausstieg

**Ziel.** A1: Die allgemeine Inventur-/Validator-Reihenfolge sollte nicht am `node_modules`-Fruehausstieg haengen. Bisher liefen nur der Narrative-Validator und der Divergenz-Guard davor; Inventur, Doku-Marker, Doku-Gate und LOC wurden in einem frischen Klon stillschweigend uebersprungen.

**Umsetzung.** `.githooks/pre-commit` buendelt `build-inventory`, `doc-sync --staged`, `verify-docs` und `check-loc` in `inventory_docs_loc()`. Die Funktion laeuft im Fruehausstieg und noch einmal nach Matrix und Testkatalog im normalen Pfad. Nur `sync-dependency-matrix` und `test-catalog` bleiben hinter dem Ausstieg, weil beide `typescript` aus `node_modules` importieren. Die Reihenfolge der uebrigen Schritte und der LOC-Fehlercode bleiben unveraendert; der Ausstieg meldet jetzt ausdruecklich, dass nur Matrix und Katalog uebersprungen wurden. `AGENTS.md` und `docs/NARRATIVE-ENGINE.md` nennen die neue Grenze.

**Pruefungen.** `sh -n .githooks/pre-commit`. Ein temporaeres Git-Repo mit Stub-Skripten belegt ohne `node_modules` die Reihenfolge `build-inventory -> doc-sync -> verify-docs -> check-loc` und mit `node_modules` zusaetzlich `sync-dependency-matrix -> test-catalog` davor. Ein Stub mit LOC-Fehler blockiert den Commit auch ohne `node_modules`.

**Offen.** Inventur-Aenderungen werden vom Hook weiterhin nicht gestagt; das war schon vor A1 so und bleibt ausserhalb dieses Slice. A2/A3 sind abgeschlossen, A1 damit ebenfalls. Der naechste Schritt ist D2 mit den neuen Kontexten, danach der erste Content-Batch.

## 2026-11-04 - Test: Vollstaendige Narrative-Fixture

**Ziel.** Der bestehende Governance-Test soll nicht nur die Inbox, sondern eine vollstaendige Narrative-Fixture pruefen: `content/narrative/**` plus die generierten Bruecken `registry.generated.ts` und `slot-map.generated.ts`. Dabei muessen unregistrierte Beitraege, Schemafehler trotz Manifest und unerlaubte Eintraege fail-closed scheitern, waehrend der korrekt registrierte Bestand inklusive aller drei Render-Ausgaben besteht.

**Umsetzung.** `src/core/governance/__tests__/narrative-content.test.ts` baut die Fixture unter `os.tmpdir()`: `content/narrative` wird rekursiv kopiert, `fragments.json` mit `renderRegistry`, die Runtime-Registry mit `renderRuntimeRegistry` und die Slot-Bruecke mit `renderSlotMap` geschrieben. Der PASS-Fall ruft `loadNarrativeContent()` und vergleicht Beitrags-, Turn- und Registry-Zahl sowie den Content-Hash mit dem echten Bestand. Der FEHLER-Fall legt nacheinander eine unregistrierte `2026-11-01-unregistriert.json`, eine registrierte Datei ohne `text`, dann `notizen.txt`, `notizen.md`, `draft.tmp`, `backup.bak`, `.versteckt.json` und einen Unterordner an; jede Variante wird frisch geladen und auf ihre spezifische Meldung geprueft. Ein `try/finally` mit `rmSync(..., { recursive: true, force: true })` raeumt jedes Fixture auf. Kein zweites Testfile; die Datei bleibt mit 224 Zeilen unter dem 240-Zeilen-Cap.

**Pruefungen.** `pnpm exec vitest run src/core/governance/__tests__/narrative-content.test.ts --config src/Config/vite.config.ts`: 12/12 gruen in 267 ms. Danach `verify:quick` im selben Turn.

**Offen.** Der Test deckt die Inbox- und Render-Bruecken ab, aber noch nicht die allgemeine Hook-Reihenfolge (A1). Symlinks werden nur geprueft, wenn die Plattform sie erlaubt; auf Windows ohne Symlink-Recht bleiben Unterordner, `.txt` und versteckte Datei als Nachweis.

## 2026-11-04 - A3: Narrative-Validator im Pre-Commit-Hook

**Ziel.** A3: Der Narrative-Validator muss vor dem `node_modules`-Fruehausstieg laufen, und der Hook darf nie einen anderen Inhalt pruefen als den Commit.

**Umsetzung.** `.githooks/pre-commit` ruft jetzt zuerst die gestagten Narrative-Pfade ab und blockiert mit `ERR-4022`, wenn eine davon im Arbeitsbaum noch unstaged veraendert ist (`git diff --quiet` schlaegt fehl). Danach laeuft `node scripts/verify-narrative-content.mjs` vor dem `node_modules`-Check; ein Fehler beendet den Hook mit `ERR-4022`. Die restliche Reihenfolge (Matrix, Katalog, Inventur, Doku-Sync, Doku-Gate, LOC) ist unveraendert. Kein Vitest und kein `verify:quick` im Hook.

**Pruefungen.** `sh -n .githooks/pre-commit`; temporaeres Test-Repo: divergierende gestagte Datei blockiert mit der erwarteten Meldung, ein Stub-Validator laeuft ohne `node_modules` und blockiert mit `ERR-4022`. Im echten Baum `narrative:check` 26/26/26 und `verify:quick` gruen.

**Offen.** A1 bleibt offen: Der Validator ist im Hook, aber die Inventur-/Validator-Reihenfolge vor dem Fruehausstieg ist nur fuer Narrative geprueft; die allgemeine Gate-Reihenfolge bleibt Aufgabe von A1.

## 2026-11-04 - A2: Contribution-Inbox fail-closed

**Ziel.** A2 der Integritaets-Phase: Die Contribution-Inbox darf keine Eintraege still ignorieren. Bisher filterte `readContributions()` auf `isFile()` und `.json`; Unterordner, Symlinks, versteckte Dateien und Behelfsdateien verschwanden lautlos.

**Umsetzung.** `scripts/lib/narrative-content.mjs` iteriert jetzt alle direkten Eintraege mit `withFileTypes` und meldet jeden unerlaubten Eintrag als Issue: Symlink, Unterordner, kein regulaere Datei, versteckter Name oder Dateiname ausserhalb des `<datum>-<turn>.json`-Musters. Nur sichtbare regulaere JSON-Dateien nach FILE-Muster werden geparst. Parsing, Schema, Manifest-1:1 und Registry-Hash sind unveraendert; die neue Pruefung dupliziert die Vollstaendigkeitspruefung nicht. Der Governance-Test legt ein temporaeres Inbox-Fixture mit allen Faellen an und prueft, dass die gueltigen Beitraege unveraendert bleiben.

**Pruefungen.** Fokussierter Test `narrative-content.test.ts` (11/11) und danach `verify:quick` sowie `narrative:check`.

**Offen.** A1 (Validator vor dem node_modules-Skip) und A3 (`test:affected` fuer Narrative-JSON) stehen noch aus; die Batch-Regel aus D1 bleibt bis zur Manifest-Erweiterung unveraendert bei genau einem Beitrag pro Turn.

## 2026-11-04 - Korrektur: E2E-Disposition vollstaendig

**Ziel.** Die E2E-Korrektur des Eigentuemers aufnehmen: Die Disposition wirkt vollstaendig ueber den Gastpfad, nicht nur in `offerScore()`.

**Umsetzung.** `docs/NARRATIVE-ENTSCHEIDUNGEN.md` ist in D4 und D5 korrigiert. D4 beschreibt E2E jetzt an drei Punkten: begrenzte Verschiebung der sozialen Schwellen in `chooseActivity()` (±8 Punkte), begrenzter Faktor in `offerScore()` (±20 %) und begrenzter Beziehungszuschlag in `returnChance()` (±10 Prozentpunkte). D5 wurde von „nein“ auf „ja, begrenzt“ gedreht; kritische Toiletten-, Geld-, Platz- und Geraeteregeln bleiben vorrangig. Die Korrektur ist im Dokument selbst als solche markiert, damit die erste Fassung nicht nachtraeglich anders aussieht.

**Pruefungen.** `node scripts/verify-docs.mjs`, `node scripts/verify-tree.mjs`, `node scripts/verify-redundancy.mjs` und `node scripts/verify-narrative-content.mjs`; danach `verify:quick` vor dem Commit.

**Offen.** Noch kein Code: Die drei Projektionen und ihre Grenzen warten auf die Umsetzung. Die genauen Werte brauchen eine Messung; ein Ende-zu-Ende-Test fuer hohe und niedrige Disposition ist Teil des Nachweises.

## 2026-11-04 - Narrative-Entscheidungen zu Batch, Kontexten, Gegenmassnahme und Disposition

**Ziel.** Die fuenf offenen Punkte der Narrativ-Spezifikation verbindlich beantworten, ohne Code umzubauen: Content-Batch, neue Kontexte, Gegenmassnahme, E2-Reichweite und Service-Schwellen.

**Umsetzung.** `docs/NARRATIVE-ENTSCHEIDUNGEN.md` haelt je Punkt Entscheidung, Begruendung, Grenzen und Umsetzungsfolge fest. Batch: mehrere Contributions pro Turn, aber weiterhin eine JSON-Datei je Beitrag und ein Manifest-Eintrag je Beitrag. Kontexte: `rival`, `welcome`, `ask`, `defuse`, `escalate`, `confront`, `watch` kommen als Autorenvokabular dazu. Gegenmassnahme: `COUNTER_RIVAL` setzt nur `counteredUntilTick`; `RIVAL_COUNTERED` wird als Chain-Template an die aufgeloeste Choice gehaengt, ohne neuen Fact und ohne Fact-Trigger. E2 wirkt nur in `offerScore()`. `chooseActivity()` behaelt seine Service- und Sozialschwellen.

**Pruefungen.** `node scripts/verify-docs.mjs`, `node scripts/verify-tree.mjs`, `node scripts/verify-redundancy.mjs` und `node scripts/verify-narrative-content.mjs` auf dem Dokumentstand; der volle Lauf bleibt CI.

**Offen.** Die Entscheidungen sind noch nicht implementiert. Die genauen Dispositionsgewichte brauchen eine Messung; `RIVAL_COUNTERED` braucht Autorentexte. Die Chain-Kennung wird erst mit dem Runtime-Pfad eingefuehrt.

## 2026-11-04 - Profilweg und Geschichten-Historie

**Ziel.** Die zwei offenen Andockpunkte der Narrativ-UI schliessen: vom Gast-Popup direkt in das Profil der Figur, und die abgeschlossenen Szenen im Journal sichtbar machen. Beides ohne neue Zustandswahrheit; der Dialog bleibt unveraendert.

**Umsetzung.** `NarrativeView` traegt jetzt `history` (juengste zwoelf terminale Event-Instanzen, neueste zuerst) und `buildNarrativeView()` leitet sie rein aus `world.narrative.events` ab; nur Titel, Schritt, Status, Abschlusstakt, Ausgang und Teilnehmer, keine Choices. Profile umfassen zusaetzlich Figuren, die gerade als Gast auf dem Floor stehen (`Guest.visitorId`), damit der neue PROFIL-Knopf im Gast-Popup immer eine echte Kennung oeffnet. `NarrativePopup` startet mit `initialVisitorId` im Figuren-Tab und zeigt fuer eine unbekannte Figur kein fremdes Profil. Das Journal hat den Tab „Geschichten“ mit eigener Liste und blendet Suche/Archiv dort aus.

**Pruefungen.** `pnpm run typecheck` und `pnpm run verify:quick` gruen; neue Tests decken Historie, Profilweg und Journal-Tab ab.

**Offen.** Autorentexte fuer Dialoge brauchen einen Content-Slot; bis dahin bleibt die Sicherheitsfassung. Der Dialog haelt bewusst keinen Zustand ueber Speichern/Laden.

## 2026-11-04 - NAR-17: Doku-, Katalog- und demandEvent-Sync mit Save v10

**Ziel.** Doku, Testkatalog und Content-Vertrag auf den tatsaechlichen Code heben: Save v10, Rivalen-Domaene, Langzeit-Nachweise und die verbliebenen `demandEvent`-Spuren.

**Umsetzung.** `ARCHITECTURE.md`, `AGENTS.md`, `PRODUCT.md`, `ROADMAP.md`, `NARRATIVE-ENGINE.md` und der Taskplan nennen jetzt Save v10 (`vcoin.casino.v10`, Migration v5–v9) statt v9. Die Rivalen-Domaene ist als eigener Zustandsbesitz dokumentiert: `WorldState.rivals` mit Haltung, Handlungsfaehigkeit, Wohlwollen, naechstem Zug, Gegenmassnahmen-Fenster, Historie (6) und Indizien (4), reine Politik ohne PRNG, `RIVAL_ACTION`-Fact, Trigger `rival-action`, Template `RIVAL_MOVE` und die Kante Rivale→Haus aus dem Boundary. NAR-16 steht mit Zwei-Tage-Test, Save-Budget (gemessen 137 KiB je Tag, 337 KiB nach zwei), Hotpath-Messung und `ci:long` in den Vertraegen. `TRIGGER_DIALOG` ist ueberall als bis zur Dialogfuehrung nicht ausfuehrbar formuliert. `demandEvent` bleibt ausschliesslich als Migrationsfeld in `SavedGame`/`migrate-narrative.ts` fuer v5–v9 dokumentiert, `NarrativeState` kennt es nicht. Der Content-Workflow (Beitrag, Turn-Manifest, Compiler, Assets-Gate) ist als eigener Abschnitt 17 im Narrativ-Vertrag beschrieben. Testkatalog und Inventur sind regeneriert.

**Pruefungen.** `pnpm run narrative:check`, `pnpm run catalog`, `pnpm run inventory:build` und `pnpm run verify:all` auf dem committeten Stand; dazu CI `Fail-Closed Gates` auf dem PR.

**Offen.** `TRIGGER_DIALOG` wartet weiter auf eine Dialogfuehrung; die Rivalen-Profilkarte zeigt Historie und Indizien noch nicht, und ein Sieben-Tage-Langlauf bleibt ein eigener CI-Nachweis.

## 2026-11-03 - CI-Eskalation: Code, Stufe, Haeufigkeit

Ziel: Jeder CI-Fehler zeigt Code, Beschreibung, Fix und Haeufigkeit, mit dem bestehenden Gate-System und ohne zweites Register.

Umsetzung:
- Stufe pro Code im Register (`level`); `escalation.mjs` liest sie zuerst, Textmuster sind nur Fallback. Die Zuordnung ist eigene Einschaetzung des Agenten und nicht von einem Review bestaetigt.
- ERR-4008 hatte zwei Bedeutungen. Push auf den Arbeitsbranch bleibt ERR-4008. Der abgelehnte Direktpush auf `main` bekommt ERR-4023, weil die Ursache eine andere ist (Ruleset, nicht Netz oder Branch). ERR-4006 bleibt Commit-Format und deckt Developer Notes wie Pflichtsektionen ab; beide Quellen nennen dieselbe Format-Ursache, deshalb kein eigener Code.
- ERR-4024 fuer das rote lokale Gate in `turn:finish`.
- PR-Watcher: Fingerprint-Dedupe mit Kommentar statt Neu-Issue; geschlossene Issues bleiben zu. Die beiden Suchen sind in `findIssue` zusammengefuehrt.
- Commit e7294f4 (PR-Watcher) ist auf `origin/main` uebernommen, sodass `pr-watcher.yml` dort lauffaehig ist.

Pruefungen (lokal, ohne Workflow-Lauf): YAML-Parse von `pr-watcher.yml`, `node --check` auf geaenderte Skripte, `verify:docs`, `verify-redundancy`, vitest `dependency-governance.test.ts` und `escalation.test.ts`.

Offen: Ruleset ungeprueft (kein `gh`, kein authentifizierter Zugriff). Die Dedupe ist in CI noch nicht beobachtet. Schritt 7 (Aufraeumen) wartet auf Freigabe. Die Dateigroesse von `pr-watcher.mjs` (rund 325 Zeilen) liegt unter dem Cap; `scripts/` wird vom LOC-Gate nicht erfasst.

## 2026-11-03 - Narrative-Review-Befunde S1 bis S16: Expiry, Demand, Slot-Map, Preflight, Locale, Migration, Duplikat, totale Ausfuehrung, ENGINE_DEMAND, maxOccurrences, legacy-Demand, guard-Flush, degraded, Doku

**Ziel.** Narrative-Review-Befunde S1 bis S16: Expiry, Demand, Slot-Map, Preflight, Locale, Migration, Duplikat, totale Ausfuehrung, ENGINE_DEMAND, maxOccurrences, legacy-Demand, guard-Flush, degraded, Doku

**Umsetzung.** Offen.

**Pruefungen.** Offen.

**Offen.** Offen.

## 2026-11-04 - NAR-14: Narrative UI, Szenen und Profile

**Umsetzung.** `src/core/sim/narrative/view.ts` ist die einzige Stelle, die aus `WorldState`, `Ledger` und dem Composer ein Anzeigemodell baut: Szenen mit Titel, Text, Frist, Teilnehmern und Choices (jede mit `available` und `reasons` aus `checkChoiceSelection`), dazu Profile mit Besuchen, Erinnerungen, gerichteten Beziehungen und laufenden Geschichten. `buildView()` haengt das Ergebnis als `GameView.narrative` an; React liest nur noch. `src/ui/narrative-*` bringt Szenen-Karten und Profilansicht, `App.tsx` oeffnet sie ueber einen Story-Chip auf dem Floor. `dismissNarrativeCmd()` lehnt eine Szene ueber `transitionEvent` ab (`CANCELLED` + Cooldown + Journal-Zeile) – kein zweiter Statuspfad, keine Schema-Aenderung.

**Entscheidung.** Text kommt ausschliesslich aus der Registry; fehlt eine passende Persona, wird einmal ohne Persona-Einschraenkung zusammengesetzt und ein verbleibender Fallback im UI als Sicherheitscopy benannt, statt Text zu erfinden.

**Offen.** `TRIGGER_DIALOG` bleibt bis zur Dialogfuehrung nicht ausfuehrbar. Profilnavigation aus dem Gast-Popup und die Event-Historie im Journal sind seit T47 angebunden; NAR-15 bis NAR-17 sind inzwischen abgeschlossen.

## 2026-11-03 - NAR-13: DemandEvents in der gemeinsamen Engine

**Ziel.** Den zweiten Scheduler in `demand.ts` aufloesen, ohne Ankunftsraten, Gruppengroessen oder Zeitfenster zu veraendern und ohne laufende Veranstaltungen aus v5–v9-Saves zu verlieren.

**Umsetzung.** Neon-Nacht und Turnierabend stehen jetzt als Daten in `narrative/events/demand-definitions.ts`; `narrative/demand-events.ts` startet hoechstens eine aktive GLOBAL-Instanz ohne Choices und beendet sie am Fristtick ueber `transitionEvent` (`EXPIRED`, `DEMAND_ENDED`). `demandBreakdown()`, `groupSize()` und `expectedGroupSize()` lesen nur noch die aktive Instanz; `NarrativeState.demandEvent` und seine Normalisierung sind entfernt. `sourceFactId: 0` ist fuer engine-erzeugte Events ohne ausloesenden Fact reserviert. `hydrateNarrative()` konvertiert das alte Feld aus v5–v8 und v9 in eine Instanz mit Restlaufzeit, abgelaufene Events verfallen.

**Pruefungen.** `node_modules/.bin/tsc --noEmit -p src/Config/tsconfig.json` und 19 fokussierte Tests in `demand.test.ts`, `narrative-demand.test.ts` und `narrative-save.test.ts` sind grün. Die Save-Tests decken alle Versionen v5–v9, das fehlende Feld im neuen Save und den Reload ohne Duplikat ab. `RBD_VERIFY_NO_CACHE=1 RBD_VERIFY_AUDIT=1 CI=true node scripts/run-pipeline.mjs --profile=full` bestand alle zwoelf Gates inklusive Audit und Build; die Suite meldete 657 bestandene und 2 uebersprungene Tests (659 gesamt) in 132 bestandenen Testdateien. Bericht: `.verify-cache/reports/2026-11-03T03-16-02-160Z/summary.md`.

**Offen.** Die Event-Instanzen teilen sich die begrenzte Historie mit den uebrigen narrativen Events; eine eigene Retention fuer Nachfrageevents ist nicht noetig, solange hoechstens eine pro Tag entsteht. Die UI-Anbindung bleibt NAR-14.

## 2026-11-03 - NAR-12 Orchestrierung in Tick und WorldStore

**Ziel.** Facts nicht mehr an einzelnen Quellen, sondern an den tatsaechlichen Mutationsgrenzen verarbeiten und den vollstaendigen Kreis Fact→Event→Choice→Command→Fact schliessen — im Tick und bei Store-Commands ausserhalb des Ticks.

**Umsetzung.** `narrative/runtime.ts` ist der einzige Orchestrator. `processNarrativeRuntime()` ruft `processNarrativeBoundaryDetailed()` genau einmal, wertet danach pro drainiertem Fact die deklarativen Trigger aus `events/trigger-definitions.ts` aus und uebersetzt Treffer ueber die Template-Registry in Kandidaten; `scheduleCandidates()` begrenzt auf drei neue Instanzen und behaelt Dedupe, Cooldowns und Narrativ-RNG. Die Reihenfolge ist fest: Simulation → Facts → Memory/Relationships → Trigger → Scheduler → Events/Choices → Journal/Snapshot. `tickWorld()` ruft die Runtime am Tick-Ende. `src/store/narrative-commands.ts` liefert `flushNarrativeCmd()` und `chooseNarrativeCmd()`; `world-store.ts` flusht nach jeder erfolgreichen Command-Ausfuehrung, nach Neues Spiel, Import und Rivalenspiel — `#emit()` bleibt Darstellung und Save. `spawn.ts` und `guest-service.ts` drainieren nicht mehr selbst. Eine erfolgreiche Choice emittiert `EVENT_RESOLVED`, damit auch der Erfolgsfall einen Folgefakt hat; der naechste Flush verarbeitet ihn genau einmal, nie rekursiv. Das Schema validiert den neuen Fact, der Save-Roundtrip traegt ihn, und der Content-Beitrag bringt die Registry auf 21 Fragmente.

**Pruefungen.** `npx --yes pnpm@10.4.1 run typecheck` war gruen; `verify:quick` bestand alle zehn Gates. `RBD_VERIFY_NO_CACHE=1 npx --yes pnpm@10.4.1 run verify:all` bestand alle zwoelf Gates inklusive Audit und Build; die Suite meldete 652 bestandene und 2 uebersprungene Tests (654 gesamt), 131 Testdateien bestanden und 2 uebersprungen (133). Das Assets-Gate meldete 21 Beitraege, 21 Turns und 21 Registry-Fragmente bei 552 Dateien. Bericht: `.verify-cache/reports/2026-11-03T02-35-24-994Z/summary.md`. Keine neue Abhaengigkeit.

**CI-Nachlauf.** Der erste CI-Lauf auf `89be92a` machte das Doku-Gate rot: `inventory:build` lief vor dem Commit, als die sechs neuen Dateien noch untracked waren, und listete 1109 statt 1115 getrackte Dateien. Der Nachlauf auf dem getrackten Baum brachte 1115/1115; `verify:all` mit `CI=true`, `RBD_VERIFY_AUDIT=1` und ohne Cache bestand danach alle zwoelf Gates. Ein paralleler Push-Lauf auf demselben Commit blieb rot, waehrend der PR-Lauf gruen war. Der Grund war kein Infrastrukturfehler: `narrative-save.test.ts` griff mit `events[0]` auf das erste Event zu und nahm an, dass waehrend der 60 Fixture-Ticks keine Events entstehen. Seit NAR-12 plant der Tick echte `VISITOR_RETURN`-Events, abhaengig vom Zufallsseed; der Test sucht das `SAVE_EVENT` jetzt ueber seine `eventId`.

**Offen.** Die Runtime verwirft Trigger-Treffer, die ueber die Drei-Event-Grenze hinausgehen; das ist bewusst begrenzt, aber noch nicht als eigener Diagnosezaehler sichtbar. `NARRATIVE-ENGINE.md` nennt die Runtime, die UI-Anbindung bleibt NAR-14, die Demand-Migration NAR-13.

## 2026-11-03 - NAR-11: Lokaler Runtime Composer

**Ziel.** Die validierte Registry zur Laufzeit mit Event-Template-Slots verbinden, ohne Textauswahl, Mechanik oder Gameplay-PRNG zu koppeln. Fehlende Slots brauchen lokale, kontextvertraegliche Fallbacks; kein Provider, kein API-Key, keine Textanfrage.

**Umsetzung.** `src/core/sim/narrative/composer/` trennt den `ComposeRequest`-Vertrag, die fail-closed Laufzeitvalidierung, die deterministische Auswahl und die Fassade. `TITLE` mappt auf `opening`, `BODY` auf `description`/`event-body`/`dialog`, `CHOICE_LABEL` auf `choice-preview`, `OUTCOME` auf `reaction`. Locale, Kontextschnitt, `requiredFlags` und Persona-Refs filtern; der stabile Score gewinnt, Gleichstand nach `contributionId`. Es gibt keinen RNG-Import. Fehlende Slots bekommen kurze Fallbacks ohne Fakten, Choice-IDs, Kosten oder Wirkungen. Ungueltige Fragmente und Direktiven werden uebersprungen und im Ergebnis gemeldet; Direktiven bleiben reine AST-Daten. Der NAR-10-Compiler erzeugt zusaetzlich `registry.generated.ts`; `--check` und das Assets-Gate pruefen JSON und TypeScript byte-genau. Der neue Beitrag `runtime-composer-01` dokumentiert den Vertrag und bringt die Registry auf 20 Fragmente.

**Pruefungen.** `npx --yes pnpm@10.4.1 run typecheck`, `narrative:check` und die fokussierten Suiten fuer Composer, Compiler und Content waren gruen (29 Tests). `RBD_VERIFY_NO_CACHE=1 npx --yes pnpm@10.4.1 run verify:all` bestand alle zwoelf Gates inklusive Audit und Build; die Suite meldete 642 bestandene und 2 uebersprungene Tests (644 gesamt), 129 Testdateien bestanden und 2 uebersprungen. Das Assets-Gate meldete 20 Beitraege, 20 Turns und 20 Registry-Fragmente. Bericht: `.verify-cache/reports/2026-11-03T02-13-45-619Z/summary.md`. Keine neue Abhaengigkeit.

**Offen.** Der Composer ist noch nicht an Tick oder UI angeschlossen; die Trigger-Auswahl und Orchestrierung bleiben NAR-12, die Narrative UI NAR-14. `TRIGGER_DIALOG` bleibt bis dahin nicht ausfuehrbar.

## 2026-11-03 - NAR-10: Content-Compiler und Makro-Validierung

**Ziel.** Die 19 Beitraege reproduzierbar in eine Runtime-Registry ueberfuehren: Makros als typisierte ASTs, Konflikte vor dem Schreiben erkennen, `--check` strikt lesend halten und dieselbe Inbox byte-identisch abbilden.

**Umsetzung.** `scripts/lib/narrative-macros.mjs` spiegelt den NAR-08-Parser, prueft die Allowlist, exakte Argumentlisten, stabile ActorRefs, kontrollierte Flags und doppelte Singleton-Commands. `scripts/lib/narrative-compiler.mjs` baut die nach `contributionId` sortierte Registry, erkennt gegensaetzliche Sprecher, unpassende Persona-Nennungen, inkompatible Stimmung, widerspruechliche Story-Flags und unzulaessige Command-Kombinationen und hasht die kanonische Fragmentliste mit SHA-256. `scripts/compile-narrative-content.mjs` schreibt nur bei `--write`; sonst vergleicht es die exakten Bytes. `scripts/verify-narrative-content.mjs` und das bestehende Assets-Gate nutzen denselben Validator. Die Registry ist Version 2, enthaelt nur typisierte AST-Felder und keine Roh-Makros; der neue Beitrag `content-compiler-01` traegt `€FreezeTick:120` als valides Beispiel.

**Pruefungen.** `typecheck`, `verify:assets` und `verify:test-quality` waren nach der Integration gruen. Der Compilerlauf erzeugte 19 Fragmente mit `sha256:4a71453595bac0634d08f90b188bc35034d9f8c4c2bdbb512badd57880c2316d`; `--check` schrieb keine Datei. Die Konfliktproben fuer Sprecher und Stimmung wurden direkt gegen `buildCompiledRegistry` geprueft; die neue Testdatei deckt zusaetzlich Makrogrenzen, Allowlist-Drift, Determinismus, Persona/Flags und Byte-Drift ab. Der vollstaendige `RBD_VERIFY_NO_CACHE=1 pnpm run verify:all` bestand alle zwoelf Gates inklusive Audit und Build; die Suite meldete 633 bestandene und 2 uebersprungene Tests (635 gesamt), 128 Testdateien bestanden und 2 uebersprungen. Bericht: `.verify-cache/reports/2026-11-03T01-56-26-127Z/summary.md`.

**Offen.** NAR-11 baut den lokalen Composer; NAR-10 bindet noch keine Event-Template-Allowlist an die ASTs. Die Compiler-Pruefung ist bewusst strenger als der Runtime-Parser: Content darf nur ausfuehrbare Commands und stabile ActorRefs nennen.

## 2026-11-03 - NAR-09: Content-Registry und Klassifizierung

**Ziel.** Die vorhandene Content-Inbox in einen pruefbaren Textpool verwandeln: Jeder Beitrag bekommt eine kontrollierte Klassifizierung, jeder abgeschlossene Agenten-Turn genau einen Eintrag im Manifest, und die Runtime-Registry wird daraus reproduzierbar abgeleitet, ohne Texte in Simulationscode zu ziehen.

**Umsetzung.** `content/narrative/vocabulary/classification.json` kontrolliert Slots, Funktionen, Slot-Funktions-Kompatibilitaet, Kontexte, Ton, Stimmung, Beziehung und Personas; Rollen, Locales und Flags bleiben in `flags.json`. Alle 18 Beitraege tragen jetzt diese Felder. `content/narrative/turns/manifest.json` ordnet 18 Turn-IDs genau je einem Beitrag zu. `content/narrative/registry/fragments.json` enthaelt die 18 sortierten Fragmente samt Herkunft, Text und Direktiven und wird von `scripts/build-narrative-registry.mjs` aus derselben Validierung erzeugt. `scripts/lib/narrative-content.mjs` prueft Schema, IDs, Dateinamen, Manifest und Registry; `scripts/verify-assets.mjs` ruft die Pruefung im bestehenden Gate auf. Kein neuer Gate-Stack, kein LLM im Spiel.

**Pruefungen.** `npx --yes pnpm@10.4.1 run verify:all` bestand alle zwoelf Gates inklusive Audit und Build; darin waren `typecheck`, `check:loc`, `verify:docs` und `verify:tree` PASS. Die vollstaendige Suite meldete 623 bestandene und 2 uebersprungene Tests (625 gesamt); 127 Testdateien bestanden, 2 wurden uebersprungen. Der Registry-Check und das Assets-Gate meldeten 18 Beitraege, 18 Turns und 18 sortierte Registry-Fragmente. Die zehn neuen Tests decken Schema, unbekannte Klassifizierungen, Slot-Funktions-Konflikte, Direktiven, doppelte IDs, Manifest-Luecken und Registry-Drift ab.

**Offen.** NAR-10 baut den Compiler fuer Makro-AST, Konflikte und byte-identische Registry; NAR-11 den Composer. Die Registry enthaelt bewusst nur validierte Beitraege, noch keine Event-Template-Bindung oder Runtime-Auswahl.

## 2026-11-03 - NAR-08: Command-DSL und Allowlist

**Ziel.** Textbeitraege duerfen Commands deklarieren, aber niemals Code ausfuehren. Event-Templates bleiben die Allowlist; Parser, Preflight und Handler muessen fail-closed zusammenarbeiten, und eine Choice darf auch bei wiederholtem Klick nur einmal wirken.

**Umsetzung.** `narrative/commands/` trennt typisierte AST-Typen, Registry, Parser, Validierung, Preflight und Ausfuehrung. Der Parser akzeptiert nur `€...`-Ausdruecke mit begrenzter Laenge, maximal acht Argumenten und bekannten Wertformen; `FreezeTick` und `trigger Dialog` werden auf stabile Command-IDs normalisiert. Die Registry allowlistet `SET_FLAG`, `ADJUST_RELATIONSHIP`, `FREEZE_TICK` und `TRIGGER_DIALOG`; der Dialog bleibt bis zur UI-Anbindung nicht ausfuehrbar. Choice-Effekte werden direkt in dieselbe AST-Form uebersetzt, Requirements, Kosten, Ziele und Event-Status vor jeder Mutation geprueft. Die Ausfuehrung aktiviert ein `OFFERED`-Event, bucht Kosten ueber das Ledger, wendet Effekte an und setzt `RESOLVED`; ein zweiter Klick scheitert am Lifecycle. Abgelehnte Commands landen als begrenzter `COMMAND_REJECTED`-Fact in der Narrativ-Historie.

**Pruefungen.** `npx --yes pnpm@10.4.1 run typecheck` und `check:loc` gruen; `verify:quick` bestand nach der Exportbereinigung alle Gates, die Schnellsuite meldete 603 bestandene und 2 uebersprungene Tests. `verify:all` bestand alle zwoelf Gates inklusive Audit und Build; die vollstaendige Suite meldete 613 bestandene und 2 uebersprungene Tests (615 gesamt). Die neuen Tests decken Parser-Grenzen, doppelte Argumente, unbekannte und nicht allowlistete Commands, Teilnehmerindizes, Kosten, Fristverlaengerung, die einmalige Ausfuehrung, Wiederholung und `COMMAND_REJECTED` ab.

**Offen.** `TRIGGER_DIALOG` ist nur parsebar, nicht ausfuehrbar; die UI-/Runtime-Anbindung bleibt NAR-14. Trigger-Auswahl und Orchestrierung im Tick bleiben NAR-12, Content-Compiler und Composer NAR-09/NAR-11, die Demand-Migration NAR-13. Weitere Command-Familien folgen erst mit ihren echten Domaenen-Handlern.

## 2026-11-03 - NAR-07: Event-Templates und stabile Choice-Verträge

**Ziel.** Mechanische Event-Struktur testbar machen, ohne Text und Formulierungen zu Spielregeln zu erheben: stabile Template- und Choice-IDs, rollengenaue Teilnehmer, deklarative Requirements/Kosten/Effekte, persistierte Choice-Saetze und eine erneute Pruefung beim Klick.

**Umsetzung.** `events/template-types.ts` und `template-schema.ts` definieren und validieren Templates, Content-Slots, Choices, Requirements, Kosten und Effekte fail-closed. `events/definitions/` registriert `VISITOR_RETURN` und `VISITOR_CONFLICT`; `events/template-candidate.ts` loest Trigger-Teilnehmer rollengenau auf und baut den Scheduler-Kandidaten. `choices/contract.ts` bindet Choice-IDs an `eventId`, `templateId`, `templateVersion` und den persistierten `offeredChoiceIds`-Satz. `choices/eligibility.ts` prueft Lifecycle, Ablauf, Requirements und Kosten rein bei jedem Klick. Event-Instanzen tragen die neuen Metadaten additiv; alte Staende erhalten `eventId`, Version 1 und einen leeren Satz, bleiben also fail-closed nicht ausfuehrbar. Effekte werden noch nicht ausgefuehrt.

**Pruefungen.** `npx --yes pnpm@10.4.1 run typecheck` und `check:loc` gruen. `verify:all` bestand alle zwoelf Gates inklusive Audit und Build; die vollstaendige Suite meldete 598 bestandene und 2 uebersprungene Tests (600 gesamt). Die neuen Tests decken stabile IDs, doppelte/unbekannte Choices, Text-/Mechanik-Trennung, Fristen, Requirements, Kosten, persistierte Choice-Saetze und den Save-Roundtrip ab.

**Offen.** Command-Ausfuehrung und Allowlist (NAR-08), Content-Composer (NAR-11), Tick-Orchestrierung (NAR-12) und Demand-Migration (NAR-13) bleiben offen. Die neuen Templates sind noch nicht in den Tick eingebunden.

## 2026-11-03 - NAR-06: Event-Scheduler, Lifecycle und eigener Narrativ-RNG

**Ziel.** NAR-06 vollstaendig schliessen: Matches in persistente Event-Instanzen ueberfuehren, den Lifecycle zentral absichern, Cooldowns und Scopes trennen, Ereignisketten nur nach aufgeloesten Vorgaengern erlauben und die Auswahl deterministisch ohne den Gameplay-PRNG treffen.

**Umsetzung.** `event-types.ts` beschreibt Instanzen und Kandidaten; `event-lifecycle.ts` ist die einzige Statuswahrheit (`ELIGIBLE → OFFERED/ACTIVE → RESOLVED/EXPIRED/CANCELLED`), setzt Cooldowns je Event-/Teilnehmerkombination und begrenzt abgeschlossene Historie. `event-scheduler.ts` ordnet nach Prioritaet und Fairness, trennt `GLOBAL`/`VISITOR`/`PAIR`/`RIVAL`, verhindert Duplikate, begrenzt Arbeit und nutzt bei Gleichstand den eigenen persistenten Mulberry32-Strom aus `narrative-rng.ts`. `event-schema.ts` validiert und normalisiert alte oder manipulierte Daten fail-closed. Der Boundary ruft `maintainEvents()` auf und raeumt Fristen sowie verwaiste Visitor-/Personal-Endpunkte auch ohne neue Facts auf. Save v9 traegt die neuen Felder additiv; alte Staende erhalten leere Defaults.

**Pruefungen.** `npx --yes pnpm@10.4.1 run typecheck` und `check:loc` gruen; `verify:quick` bestand alle zehn Gates, einschliesslich `dead-code`, `test-quality` und der vollstaendigen Testsuite. Die neuen Tests decken Prioritaet, RNG-Determinismus, Scopes, Duplikate, Cooldowns, Mehrfachausfuehrung, Ablauf, Stale-Cancel, Ketten, Schrittwechsel, Historiengrenze und Save-Roundtrip ab. `verify:all` bestand alle zwoelf Gates inklusive Audit und Build; die vollstaendige Suite meldete 585 bestandene und 2 uebersprungene Tests.

**Offen.** Die Trigger-Auswahl im Tick und der vollstaendige Orchestrator bleiben NAR-12; Event-Templates/Choices (NAR-07), Demand-Migration (NAR-13), Commands, Content-Compiler, Composer und autonome Rivalen sind weiterhin offen. `demandEvent` bleibt bis NAR-13 das bestehende Nachfragesystem.

## 2026-11-02 - NAR-05: Trigger-Context und Condition Evaluator

**Ziel.** NAR-05 vollstaendig schliessen: ein deklarativer Trigger-Vertrag mit echtem Context, Beziehungs- und Zeitfensterabfragen, allen vorgesehenen Operatoren und einer fail-closed Schema-Validierung. Der Evaluator bleibt eine reine Funktion ohne Tick-Eingriff.

**Umsetzung.** `trigger-types.ts` beschreibt Context, Bedingungen, Definitionen und Match-Ergebnisse. `trigger-context.ts` baut aus Welt, Ledger und aktuellem Fact einen unveraenderlichen Snapshot mit Fact-Historie, Flags, Beziehungen, Visitor-Profilen, Hauskonto/Band, Charisma, Ruf, Nachfragestufe, bedienten Gaesten und Geraeteschaden; `actorRefsOfFact()` vereinheitlicht alte `visitorId`-Facts und neue `actorRefs`. `trigger-evaluate.ts` wertet `all`/`any`/`not`, Facts, Erinnerungen, Hauskonto, Geraete, Charisma, Ruf, Nachfrage, Gaeste, Flags, Zeitfenster, `recent-fact`, Akteure und Beziehungen aus und liefert Begruendungen. `trigger-schema.ts` verwirft unbekannte Operatoren, ungueltige Refs, Selbstkanten, negative/unsichere Schwellen und leere Listen; 64 Knoten und Tiefe 12 sind die Grenze. `triggers.ts` bleibt die oeffentliche Fassade.

**Pruefungen.** `npx --yes pnpm@10.4.1 run typecheck` gruen; die vollstaendige Suite lief mit 571 bestandenen und 2 uebersprungenen Tests. `verify:quick` bestand alle zehn Gates, `verify:all` alle zwoelf Gates inklusive Audit und Build. Die neuen Tests decken alle Operatoren, Grenzwerte, Historie, fehlende Visitor-Profile, Unveraenderlichkeit sowie Schema-Negativfaelle ab.

**Offen.** Der Evaluator ist noch nicht in den Tick eingebunden; Aufrufstelle und Cooldowns bleiben NAR-06/NAR-12. Scheduler, Event-Templates, Commands, Content-Compiler, Composer, Demand-Migration und autonome Rivalen sind weiterhin offen.

## 2026-11-02 - Optik und Steuerung: Lichtpfuetzen, Zielraster, Kamera folgt

**Ziel.** Ohne eine neue Spielregel soll der Floor besser lesbar und besser steuerbar werden:
Licht, das Raeume unterscheidet, Hinweise auf dem Boden statt in Panels, eine Kamera, die der
Figur folgt, und ein HUD, das keine leere Zeile mehr mitzeigt.

**Umsetzung.**

- `floor-surface.ts`: Lichtpfuetzen in 16 Stufen (alpha 0,009 bis 0,02), hellere Deckenlampen
  und Wandlichtkanten, Laufweg-Abdunklung von 0,34 auf 0,26. Die Stufen sind bewusst viele
  und leise: drei deckende Ellipsen lasen im Browser als Radarringe und liefen ueber die Wand
  hinaus; erst die vielen Stufen und die auf den Raum begrenzten Halbachsen ergaben Licht.
- `src/render/floor-cues.ts` (neu): Zielraster unter dem Zeiger, Spielerring, Punktspur des
  Laufwegs, Klick-Puls. Die Farbe zeigt die Folge: Service heisst laufen, Identity heisst
  heranziehen. Nach einer Kamerafahrt wird das Raster ueber die letzte Zeigerposition neu
  gesetzt, sonst zeigt es auf eine Kachel, die nicht mehr unter dem Zeiger liegt.
- `floor-camera.ts`: `pan`, `zoomStep`, `keepInView`. Die Kamera zieht erst nach, wenn die
  Figur den inneren Rahmen (55 Prozent der halben Sicht) verlaesst; in der Uebersicht und auf
  dem Rueckweg dorthin bleibt sie mittig. Ohne die zweite Bedingung zog `keepInView` den
  Fokus waehrend des Herauszoomens zur Figur und `0` landete neben der Mitte (camX 498 statt
  385 bei 1582 Pixeln Breite).
- `floor-touch.ts` traegt jetzt alle Zeigergesten (Rad, Pinch, Ziehen mit mittlerer oder
  rechter Taste). Der Wheel-Handler ist aus `floor-view.ts` dorthin gewandert; das Budget der
  Datei bleibt bei 349/350, weil die neue Ebene und der Handler zusammen mehr Zeilen brauchten
  als der alte Wheel-Block.
- `stage-controls.tsx` (neu) und `app.css`: Tastenkuerzel als kbd-Chips, Kamera-Knoepfe unten
  rechts, Vignette und Rasterhintergrund auf der Buehne, Barkauf-Ziel als Chip in der
  RPG-Zeile (die vorher eine leere Vollbreite-Leiste ohne jede CSS-Regel war), XP-Balken.
- Bildsprache als Blatt: `docs/banners/art-direction-neon-ledger.png` und die Philosophie in
  `docs/ART-DIRECTION.md`, damit die naechste Aenderung nicht neu geraten wird.

**Pruefungen.** Browser ueber agent-browser (Chromium 156, 1600x1000 und 1000x720): Uebersicht
mittig (camX 385 bei 1582 Pixeln Buehne), Rechtsziehen schwenkt mit dem Zeiger, Rad und `+`/`-`
zoomen, `0` kehrt zur Uebersicht zurueck, WASD laeuft und die Kamera zieht nach (camX 125 auf
-471), Zielraster wechselt die Farbe zwischen Detail und Uebersicht, Laufwegspur erscheint
beim Klick. `pnpm run typecheck` gruen. `pnpm run verify:quick` war auf dem eigenen Stand gruen
(zehn Gates, 520 Tests bestanden, 2 uebersprungen). Nach dem Rebase auf `origin/main` (PR #54) laufen
lokal zwei load-empfindliche Nachweise in der vollen Parallelitaet in ihr Zeitlimit — `process-sweep`
(Warten auf das Prozessende) und `slot-paylines` (RTP-Volllauf: 95 s allein gegen 120 s Budget);
beide bestehen in Isolation (12 von 12). Sie beruehren weder Renderer noch Kamera. Den vollstaendigen
Nachweis traegt wie vorgesehen CI (`verify:all`). Neuer Test `floor-camera.test.ts` mit sechs Faellen; drei
davon waren zuerst rot, weil ich die Zugrichtung des Schwenks und die Lerp-Toleranz falsch
angenommen hatte — die Kamera war richtig, die Erwartung nicht.

**Bilder.** Der Belegsatz liegt neu in `docs/screenshots/v0.3.78/` (fuenf Bilder, 1280 x 860, Tag 1
ueber den normalen Ladeweg statt eines vorbereiteten Speicherstands): Uebersicht, Detail, Bauen,
Gaeste, Hilfe. Die Wurzel-README stellt vier davon Bild fuer Bild gegen `current/` (v0.3.27), gleiche
Etage, gleicher Ausschnitt, und benennt auch, was der Vergleich nicht zeigt: Gaestezahl und
Katalogumfang stammen aus anderen Spielstaenden, die Freebuff-Plakette der alten Aufnahmen aus der
damaligen Umgebung. Beim Aufnehmen fiel auf, dass die Hilfekarte die neuen Griffe nicht nannte; sie
listet jetzt Rechtsziehen, `+`/`-` und `0`. Die Ablageregel in `docs/screenshots/README.md` kennt
versionierte Spielsaetze als eigenen Ordner; ein aelterer Satz wird nicht ueberschrieben.

**Offen.** Lichtpfuetze gilt je Zone und Chunk: eine Zone, die ueber eine Regionskante reicht,
bekommt je Chunk eine eigene Pfuetze; bei sehr grossen Saelen entsteht dort eine sichtbare
Naht. Ziehen per Touch ist nur im Code vorhanden, nicht auf einem echten Geraet geprueft. Der
Klick in der Uebersicht zieht weiterhin heran statt zu laufen: bewusst, weil ein Klick ohne
Rueckmeldung sonst nicht von einem Fehlklick zu unterscheiden waere.

## 2026-11-02 - NAR-04: Beziehungen aus echten Quellen

**Ziel.** NAR-04 vollstaendig schliessen: Beziehungen zwischen Besuchern, Haus, Personal und Rivalen aus echten Spielereignissen, kanonisch persistiert und ohne zweiten Fact-Drain.

**Umsetzung.** `VISITOR_CONFLICT` entsteht in `maybeStartBrawl()` und erzeugt zwei gerichtete Besucherkanten; die angegriffene Seite verliert mehr Vertrauen. `VISITOR_SERVICE` entsteht nur bei anwesendem Kassierer in `arriveAtDesk()`/`cashierTick()` und erzeugt Besucher→Personal. `RIVAL_ENCOUNTER` entsteht bei `settleCardOutcome()` und `visitRivalWithJournal()` aus dem Nettofluss einer echten Abrechnung und erzeugt Rivale→Haus. Alle drei nutzen `actorRefs` statt Pflicht-`visitorId`; `fact-schema.ts` validiert sie beim Laden, `relationship-apply.ts` wendet sie an. Kanten sind auf 200 begrenzt, auf `-10..10` geklemmt, nach Tick und Akteurspaar sortiert und beim Laden dedupliziert. Der Barkeeper hat weiterhin kein individuelles Serviceereignis; diese Luecke wird nicht mit einer Attrappe geschlossen.

**Pruefungen.** `npx --yes pnpm@10.4.1 run typecheck` und `check:loc` gruen. 21 gezielte Tests in fuenf Dateien gruen: Streit (drei), Kasse (zwei), Rivalenabrechnung (drei), Fact-Schema ohne `visitorId` (drei), Beziehungen/Save-Roundtrip (zehn). Der Rivalen-Test deckte zuerst einen Laufzeitfehler auf, weil `RIVAL_IDS` nur ueber `export type *` re-exportiert wurde; der Import kommt jetzt direkt aus `types-model.ts`. Der Personal-Test brauchte ein eroeffnetes Hauskonto fuer die Einstellung.

**Offen.** Trigger-Integration (NAR-05), Scheduler/Templates (NAR-06/07), Demand-Migration (NAR-13), Commands, Content-Compiler, Composer, autonome Rivalen und Soak bleiben offen. Unterstuetzungs-/Versprechens-Facts haben noch keine echte Quelle; sie werden nicht simuliert.

## 2026-11-02 - Ein Fact-Drain, Ledger-Cursor und Beziehungsgrundlage

**Ziel.** Die offenen NAR-02/03-Reste schliessen, die vor NAR-04 blockieren: Fact-Referenzen ohne Pflicht-Visitor, ein Ledger-Cursor, ein einziger Consumer und referenzsichere Retention.

**Umsetzung.** `processNarrativeBoundary()` ist jetzt der einzige Drain; er erzeugt zuerst Hauskonto-Schwellen (`HOUSE_BALANCE`), drainiert dann die Queue und verteilt an Erinnerungen und Beziehungen. Der Cursor liegt als Ledger-`seq` in `narrative.ledgerSeq`; der erste Lauf setzt ihn ohne historische Facts. `relationships.ts` fuehrt gerichtete Kanten zwischen persistenten Akteuren mit Trust, Sympathie, Konflikt und Einfluss; ein guter oder schlechter Besuch verschiebt `visitor:<id> -> player`, neutrale Besuche erzeugen keine Kante. Beziehungsendpunkte pinnen ihre Visitor-Profile; die Retention verdraengt nur ungepinnte bestehende Profile und laesst die Liste bei vollstaendig gepinnter Belegung bewusst ueber dem Cap.

**Pruefungen.** `npx --yes pnpm@10.4.1 run typecheck`, `lint`, `check:loc` und `verify:dead-code` gruen; Narrativ-, Visitor- und Save-Tests gruen. Der erste Retention-Test war rot, weil der neue Besucher sich selbst verdraengte; die Auswahl schliesst den neuen Datensatz jetzt aus.

**Offen.** NAR-04 war zu diesem Zeitpunkt nur begonnen; der naechste Eintrag schliesst die weiteren Fact-Quellen ab. Trigger-Integration, Scheduler, Templates, Commands, Content-Compiler und Composer fehlen weiterhin. Die Demand-Migration (NAR-13) bleibt vor der Tick-Integration (NAR-12).

## 2026-11-02 - Nachfrageereignis auf Narrative-Zustand vorbereiten

**Ziel.** Den Zustand der vorhandenen Nachfrageveranstaltungen fuer die spaetere Event-Engine vereinheitlichen, ohne die Nachfragebalance zu aendern.

**Umsetzung.** Das aktive Event liegt in `narrative.demandEvent`. Alte v5–v9-Saves uebernehmen laufende Veranstaltungen, neue Saves enthalten keine zweite Kopie. Die bestehende Planung in `demand.ts` bleibt unveraendert.

**Pruefungen.** `pnpm run typecheck` und `RBD_VERIFY_AUDIT=1 npx --yes pnpm@10.4.1 run verify:all` bestanden; das Full Gate umfasst Nachfrage-, Save-Migrations- und weitere Tests, Audit und Build.

**Offen.** Es gibt noch keinen allgemeinen Scheduler, keine Dialoge oder Choice-Effekte und keine autonomen Rivalen. NAR-13 ist nur vorbereitet, nicht abgeschlossen.

## 2026-11-02 - Narrative-Dokumentation nach Merge wiederherstellen

**Ziel.** Nach PR #52 verlorene Narrative-Dokumentation wiederherstellen, ohne die Engine als abgeschlossen darzustellen.

**Umsetzung.** Fehlende Eintraege aus dem lokal gesicherten Stand mit dem gemergten Code und Architekturvertrag abgeglichen; Changelog, fruehere Tagebucheintraege, Inventar, Roadmap und Agentenregeln ergaenzt. Composer und Compiler bleiben als geplant gekennzeichnet; die Laufzeit bleibt ohne LLM.

**Pruefungen.** Lokales `verify:quick` und GitHub-Pflichtstatus pruefen diesen Dokumentationsstand; keine Spielregeln geaendert.

**Offen.** Der Evaluator ist nicht integriert; weitere Grundlagen, Scheduler, Dialoge, Commands, Compiler, Demand-Migration und Rivalen fehlen.

## 2026-11-02 - Narrative Trigger Bedingungen

**Ziel.** Narrative Trigger Bedingungen.

**Umsetzung.** Ein reiner Evaluator verknuepft ausgewaehlte bestehende Facts mit Erinnerung, Hauskonto, Geraetezustand, Charisma, Flags und Fact-Alter; AND, OR und NOT sind kombinierbar. Kein bestehender Simulationspfad wird damit veraendert.

**Pruefungen.** `npx --yes pnpm@10.4.1 run verify:all`: alle zwoelf Gates bestanden, einschliesslich Trigger-Tests. Der Runner meldete zusaetzlich `fatal: bad revision 'origin/main...HEAD'` bei der Git-Referenzabfrage; das Profil meldete dennoch PASS.

**Offen.** Der Evaluator ist nicht an die Simulation angeschlossen. Weitere Facts, Ledger-Cursor, Beziehungen, Scheduler, Dialoge, Commands, Content-Compiler, Demand-Migration und Rivalen fehlen.

## 2026-11-02 - Narrativ-Grundlagen und LLM-freier Eventplan

**Ziel.** Narrativ-Grundlagen und LLM-freier Eventplan

**Umsetzung.** Die Start-Pool-Facts zaehlen die bereits bei der Anlage gesetzte Poolgroesse nicht erneut. Die Save-Normalisierung prueft Fact-Nutzdaten, sortiert IDs und entfernt Duplikate; der Cursor bleibt auch bei unvollstaendigen Daten erhalten. Der Eventplan schliesst Provider und LLM im Spiel aus und kennzeichnet verbleibende Grundlagen sowie v5–v9-Demandmigration als offen.

**Pruefungen.** `npx --yes pnpm@10.4.1 run verify:all`: alle zwoelf Gates bestanden, einschliesslich Lint, Typecheck, Save-/Narrative-Tests und Build. Der Runner meldete zusaetzlich `fatal: bad revision 'origin/main...HEAD'` bei der Git-Referenzabfrage; das Gate-Profil meldete trotzdem PASS.

**Offen.** Event-Scheduler, Beziehungen, Content-Compiler, Commands, UI und autonome Rivalen sind weiterhin nicht implementiert; keine Promotion ohne vollstaendigen Nachweis.

## 2026-11-02 - Tooling-Ausgabe strukturiert, Wegwerf-Skripte verboten

**Ziel.** Die Agent-Werkzeuge sollen ohne Rueckfrage lesbar sein: strukturiert, menschlich lesbar, token-optimiert. Ad-hoc-Skripte fuer jede Kleinigkeit sollen nicht mehr entstehen.

**Umsetzung.** `summarize()` in `scripts/lib/impact.mjs` druckt eine feste Beschriftungsspalte mit einer Zeile je Feld. `scripts/agent-verify.mjs` zeigt eine Gate-Tabelle mit Status und Dauer aus `lastGateRows()` (`scripts/lib/gate-runner.mjs`) und kennt `--plan` fuer den Plan ohne Lauf. `scripts/verify-tree.mjs` meldet Wegwerf-Dateien als `ERR-4019`; die Regel steht in `AGENTS.md` unter Pitfalls.

**Nachtrag.** `--line` verdichtet beide Werkzeuge auf eine Zeile; `RBD_VERIFY_QUIET=1` unterdrueckt die Zeile je Gate, damit neben der Tabelle keine zweite Ausgabe steht.

**Global.** `rtk rg` scheiterte mit `program not found`, weil ripgrep fehlte. ripgrep 15.2.0 liegt jetzt im PATH (`WindowsApps`), die rtk-Konfiguration ist gesichert (`config.toml.bak-2026-11-02`) und auf `max_width = 100`, hoehere Suchlimits und stillen Hook-Hinweis gesetzt. Damit sind `rtk ls/find/read/rg/git/pnpm` die Standardbefehle, `agent:context` bleibt der primaere Einstieg.

**Pruefungen.** `node --check` fuer die vier Skripte, `pnpm run agent:context`, `pnpm run agent:verify -- --plan`, `pnpm run verify:tree`, `pnpm run verify:docs`, `pnpm run check:loc`.

**Offen.** Die Testsuite lief in diesem Schritt nicht; der Nachweis gehoert in den Abschlusslauf und braucht vorher die Freigabe des Nutzers.

## 2026-11-02 - Peer-Review Phase 6: Tick-Konstante, Testspin, Texte, Portabilitaet

**Ziel.** Peer-Review Phase 6: Tick-Konstante, Testspin, Texte, Portabilitaet

**Umsetzung.** Die Peer-Review-Befunde wurden gegen `main` (8d08640) verifiziert und umgesetzt. `TICK_MS = 520` steht jetzt einmal in `src/core/sim/tick-timing.ts`; `world-store`, `floor-view`, `games-popup`, `guest-popup` und `self-exclusion-panel` lesen daraus statt aus Literalen. `spinTest` ruft `spinTestCmd` nur noch einmal auf. Das tote `movement-queue`-Modul samt Test und ERR-3002 ist entfernt. Texte: "DER GEBER MISCHT" korrigiert, Mojibake in `table-launcher` entfernt, Asset-Zaehler aus `imageCount` berechnet. Portabilitaet: `src/Config/opencode.json` nutzt einen relativen Pfad, `scripts/encode-audio.mjs` bricht ohne `RBD_AUDIO_SOURCE` mit Hinweis ab. Befunde 33 und 37 waren auf `main` bereits behoben, 38 ist veraltet.

**Pruefungen.** `pnpm run typecheck` und `pnpm run lint` exit 0. `pnpm run test`: 109 Dateien bestanden, 2 uebersprungen; 524 Tests bestanden (vorher 532, Differenz = entfernter movement-queue-Test). `pnpm run catalog` regeneriert `docs/TEST-CATALOG.md`.

**Offen.** Spielregel-Entscheidungen bleiben beim Nutzer: VELVET, FREE_DRINK, EXTRA_REEL, Einsatzskalierung in `offerScore`, `payDailyWage`, Schuldentilgung, Pity-RTP (~99,15 %). `EXTRA_SYMBOLS`-Schluessel passen nicht zum Manifest (`GRAPE_CLUSTER`/`LUCKY_SEVEN` gegen `GRAPE`/`SEVEN`), visuelle Entscheidung. Befund 39 (doppelter Asset-Check) ist offen und ungeprueft.

## 2026-11-02 - Tip release-faehig machen (0.3.73)

**Ziel.** Nicht nur der Merge-Commit, sondern die aktuelle Spitze von `main` soll gruen und release-konsistent sein.

**Umsetzung.** `main` stand nach dem Merge weiter auf `ee39c83`; die Release-Automation committet bewusst nichts. Der Pflicht-Check war fuer genau diesen SHA per `workflow_dispatch` gruen, `verify:all` lief ohne Cache mit CI-Audit 12/12. Inkonsistent war nur das Release: `package.json` sagte 0.3.72, der Tag `v0.3.72` zeigt aber auf `7b50913` (PR #40), und der Release-Lauf nach dem API-Merge endete als `skipped`, weil er nur auf `push`-Workflow-Laeufe reagiert. Deshalb der Patch-Sprung auf 0.3.73: ein neuer Tag am Tip, ohne den bestehenden `v0.3.72` zu verschieben.

**Pruefungen.** `version-bump` schreibt `package.json` und `Config`-Kennung; `verify:all` ohne Cache mit `RBD_VERIFY_AUDIT=1` auf dem Tip-Baum 12/12 gruen; Befundnotiz zu VELVET/FREE_DRINK/EXTRA_REEL ist in `docs/INVENTORY.md` vorhanden.

**Offen.** Die drei Mod-Entscheidungen (Gaesteguete, Drink pro Spin, vierte Walze) bleiben beim Nutzer.

## 2026-11-02 - Roter Pflichtstatus war das PR-Body-Gate

**Ziel.** PR #44 mergen, ohne einen Check zu umgehen.

**Umsetzung.** Zwei Laeufe pro Commit: der Push-Lauf bestand `verify:all` mit 12/12 Gates, der PR-getriggerte Lauf brach nach rund 15 Sekunden mit Exit 1 ab. Ein Test auf den Workflow-Dateien (`ci-gates.test.ts`) haelt fest, dass beide Trigger bleiben muessen, also lag der Fehler nicht im Workflow, sondern im PR-Body: das Gate `verify-commit-msg --pr` verlangt die drei Pflichtsektionen, und der Body trug sie nicht. Der Body wird deshalb aus dem Commit-Body gehoben; die Trigger und `cancel-in-progress` bleiben unveraendert.

**Pruefungen.** `RBD_VERIFY_AUDIT=1 RBD_VERIFY_NO_CACHE=1 pnpm run verify:all` deckte den eigentlichen Fehler auf: der Test `Main-Gate > prueft Pushes auf main und Pull Requests gegen main` fiel nach dem Trigger-Umbau rot — der Umbau wurde zurueckgenommen.

**Offen.** Keine Code-Aenderung am CI-Workflow; das PR-Body-Gate bleibt scharf.


## 2026-11-02 - Befundnotiz: drei Mods ohne Mechanik

**Ziel.** Die zwei Audit-Luecken, die eine Spielregel brauchen (VELVET/FREE_DRINK ohne ihre beschriebene Wirkung, EXTRA_REEL ohne zusaetzliche Walze), so festhalten, dass sie nicht wieder zwischen Code und Doku verschwinden — ohne eine Regel zu erfinden.

**Umsetzung.** `docs/INVENTORY.md` hat jetzt einen Abschnitt „Offene Design-Entscheidungen: Mods ohne Mechanik" mit einer Zeile je Mod: Versprechen, tatsaechlicher Effekt und die eine Frage, die der Nutzer beantworten muss. VELVET verspricht bessere Gaeste, liefert aber nur Anziehung und weniger Geduld; eine Guetev erschiebung wuerde die Wirtschaftsrechnung des Abends aendern. FREE_DRINK verspricht einen Drink pro Spin, liefert Geduld und Betriebskosten; offen ist, ob das Haus pro Spin wirklich bucht. EXTRA_REEL verspricht eine vierte Walze, die Walzenzahl kommt aber aus `item.reels`; offen ist, ob der Mod schenkt oder rabattiert. Keine dieser drei Fragen ist durch Umbuchung beantwortbar, deshalb bewusst keine Code-Aenderung.

**Pruefungen.** `inventory:build` 1028/1028 Dateien, `docs:sync` sechs Marker, `typecheck`, `lint`, `check:loc`, `verify:docs`, `verify:dead-code`, `verify:test-quality`, `verify:tree`, `verify:redundancy`, `verify:assets`, `build` je Exit 0, volle Suite 532/532 gruen.

**Offen.** Die drei Entscheidungen selbst; bis dahin bleibt der Shop an diesen Stellen teurer als sein Effekt.


## 2026-11-02 - Pity als Vorschuss, Wut aus Geduld, Sucht am Einsatz

**Ziel.** Fünf offene Punkte schließen: Pity-RTP, Wut-Auslöser, Suchtfolgen, tote Felder und das nicht auszahlbare Bonus-Guthaben.

**Umsetzung.** Die Entladung war ein zweiter Gewinn auf einem Polster, das schon aus Hausvorteil gefüllt war — deshalb stieg der gemessene RTP Richtung 100 %. `settleSlotSpin` führt den Topf jetzt signiert: eine Entladung darf ihn überziehen, der negative Stand ist ein Vorschuss und wird von späteren Gewinnen abgezogen. Wut löste `decay` bei `mood < 12` aus, obwohl Journal und Mods von Geduld sprechen; entschieden ist die Geduld, geprüft vor dem +0,02-Tropfen. `addictedStake` hebt den Einsatz um bis zu 50 %, `sessionSpins` verlängert die Sitzung von vier auf neun Spins. `social` ist aus dem Bedürfnis-Typ entfernt, `cashOutPlayerCash` macht das Bonus-Guthaben auszahlbar. `Persona.patience` bleibt, weil sie seit dem vorherigen Commit über `rollProfile` gelesen wird.

**Pruefungen.** Fail-First mit zurückgerollten Dateien: sechs Tests rot (fehlender Export plus beide Wut-Fälle), danach 13/13 grün; `typecheck`, `lint`, `check:loc`, `verify:docs` je Exit 0, volle Suite grün.

**Offen.** Einsatzaufschlag und Sitzungsdauer sind gedeckelt; HIGH_ROLLER spielt weiterhin nicht über den Mindestsatz des Geräts.


## 2026-11-02 - Synergie-Audit: tote Persona-Geduld und Mods ohne Wirkung

**Ziel.** Systematisch suchen, wo Mechaniken sich gegenseitig tragen sollten, es aber nicht tun: geschriebene Felder ohne Leser, verkaufte Mods ohne ihre beschriebene Wirkung und Personas, die nur als Gewicht auftauchen.

**Umsetzung.** Ein Befund war reine Verdrahtung: `Persona.patience` (68 bis 138) wurde nirgends gelesen, weil `makeGuest` die Geduld zu gleichen Teilen aus dem 180-Punkte-Pool zog — der Stammgast startete sogar ungeduldiger als der High Roller (51,1 gegen 63,9 im Messlauf), weil seine hohe Suchtrate den Geduldanteil verdrängte. `rollProfile` nimmt die Persona-Geduld jetzt als eigenes Gewicht (`patience / 100`) neben der Suchtrate; weil der Pool weiterhin exakt 180 Punkte verteilt, bleibt die Invariante aus `world.test.ts` und `tycoon-needs.test.ts` erhalten. Die übrigen Befunde stehen als Bericht in `docs/INVENTORY.md`, weil sie Spielregel-Entscheidungen brauchen: `VELVET` und `FREE_DRINK` versprechen bessere Gäste und einen Drink pro Spin, liefern aber nur Anziehung und Geduld; `EXTRA_REEL` erhöht nur die Anziehung, die Walzenzahl kommt aus dem separaten Upgrade; `PLAYER_CASH` wird nur gutgeschrieben (Pakt-Bonus) und als Anzeige gelesen; der Einsatz bleibt `max(minBet, baseBet)` und skaliert nie mit dem Persona-Budget.

**Pruefungen.** Fail-First: `persona-patience.test.ts` lief auf dem Stand vor dem Commit rot (Stammgast 51,1 war nicht geduldiger als High Roller 63,9), nach dem Fix 2/2 grün, `typecheck` Exit 0. Der Befundbericht ist aus Greps belegt: `PLAYER_CASH` erscheint nur in `self-exclusion-bet.ts` als Ziel einer Buchung, `VELVET`/`FREE_DRINK` nur in `offers.ts` und der Rivalen-Deko, `reelPull` liest `item.reels` statt der Mods.

**Offen.** Die vier verbleibenden Punkte sind bewusst nicht gefixt: sie ändern Spielregeln oder Preise (Gratis-Drink pro Spin, Samt-Gäste, vierte Walze als Mod, Ausgabe von `PLAYER_CASH`) und brauchen eine Entscheidung, keine Umbuchung.


## 2026-11-02 - Lohn nur für geleistete Schichten

**Ziel.** Befund 2 schließen: `payDailyWage` zahlte weder Anwesenheit noch Arbeit, weshalb ein Spieler mit angenommenem Job fünf Tage lang 60 VC kassierte, ohne den Floor zu betreten — bezahlt aus `EXTERNAL`, also aus dem Nichts.

**Umsetzung.** „Gearbeitet" heißt jetzt: mindestens eine abgeschlossene Schicht. `completeJobTask` stempelt dafür `lastWorkDay = world.day`; `payDailyWage` zahlt nur, wenn `lastWorkDay >= world.day - 1` gilt, also für die Schicht des Vortags am Tageswechsel (der Tag wird in `staffTick` vor dem Lohn hochgezählt). Damit gibt es höchstens einen Lohn pro Tag und keinen Cent für untätige Tage; `workDays` wuchs schon vorher nur in `completeJobTask` und bleibt bei Nichtstun stehen. Bodenaufenthalt ohne Schicht zählt bewusst nicht: die Schicht ist die Arbeit, die das Spiel bezahlt. Alt-Saves kennen `lastWorkDay` nicht; `hydrateWorld` setzt es auf 0 („noch keine Schicht"), was ohne Schicht nie einen Lohn freischaltet — keine Nachzahlung, kein Absturz, keine Versionserhöhung nötig, weil das Feld nur additiv ist.

**Pruefungen.** Fail-First mit zurückgerolltem `player-jobs.ts` und `migrate.ts`: 6 von 12 neuen Tests rot (Nichtstun zahlt, Nachzahlung nach fünf Tagen, Alt-Save ohne anerkannte Schicht), die sechs grünen sind Gegenproben (Lohn nach Schicht, `workDays`-Zuwachs, Laden ohne Fehler). Danach 36/36 in vier Dateien grün, `typecheck` 0. Drei bestehende Lohntests in `player-jobs.test.ts` bauen jetzt die Schicht ein, die ihre Aussage voraussetzt; ihre Behauptung (Lohn, Buchungsquelle, kein Doppellohn) ist unverändert.

**Offen.** Der Lohn gilt pro Schicht, nicht pro Stunde: zwei Schichten an einem Tag zahlen einen Tageslohn. Das ist die bestehende Lohnsemantik und wurde nicht angefasst. Weiterhin offen aus dem Audit: Pity-RTP, Schulden ohne Tilgung, tote `PLAYER_CASH`, wirkungslose Sucht, nie skalierender Einsatz.

## 2026-11-02 - Deckung an der Kasse, erreichbare Eskalation und gezählte Gäste

**Ziel.** Sechs Befunde aus dem Audit schließen, die reine Verdrahtung sind und keine Balance-Entscheidung verlangen: Deckung am falschen Ort, unerreichbare Eskalation, Gästezählung ohne Spiel, JACKPOT ab 1,0x, stehenbleibende Wut und zwei verschiedene Bar-Kapazitäten.

**Umsetzung.** `simulateMugging` maß die Wachdeckung an `world.player.position`, obwohl der Kommentar die Kasse nennt und das Geld dort liegt; `muggingCoverPoint` liefert jetzt den Wechseltisch und fällt nur ohne Kasse auf den Spieler zurück. `tickDisputes` setzte Stufe 2 ab `ticks > 6`, während `angerTick` den ANGRY-Zustand nach fünf Ticks beendet — die Schlägerei war damit strukturell unerreichbar; `disputeLevelForTicks(ticks)` kippt nach vier Ticks und ist als reine Funktion geprüft. `guestsServed` wuchs bei jedem Auszahlen, auch ohne einen einzigen Spin; der Wert speist Ruf und KASSE-Stufe, also zählt jetzt nur `guest.spins > 0`. Das JACKPOT-Label hing an `multiplierBps >= 10_000`, also an einem Push; `isJackpotLabel` verlangt 2,5x. `decay` ließ `guest.anger` unangetastet, weshalb ein geschlichteter Gast bis zum Abgang wütend aussah; die Wut sinkt jetzt, solange der Gast nicht randaliert. Bar-Kapazität: `barCapacityForLevel` (12 + 8 × Level) stand im Core, während HUD, Diagnose und Automaten-Popup 6 + 6 × Level anzeigten — alle drei lesen jetzt den Core.

**Pruefungen.** Fail-First mit zurückgerollten Fixes: 10 von 12 neuen Tests rot, die zwei grünen sind die Gegenproben (ANGRY behält seine Wut, Spin zählt weiter). Danach `pnpm exec vitest run` auf die sechs neuen Dateien 12/12 grün, `pnpm run typecheck` und `pnpm run lint` je Exit 0, Gesamtsuite 503 grün. `demand.test.ts` nutzte `guestsServed` als Stellvertreter für „ausgezahlt"; der Gast dort hat jetzt zwei Spins, damit die Auszahlungsprüfung unverändert bleibt und die neue Regel in `guests-served.test.ts` belegt ist.

**Offen.** Die Balance-Befunde bleiben offen: Pity-Entladungen (99,15 % RTP am Startautomaten), Löhne ohne Anwesenheit (`payDailyWage` braucht dafür ein Tagesmerkmal im Save), Schulden ohne Tilgung, tote `PLAYER_CASH`, wirkungslose Sucht und der nie skalierende Einsatz. Sie brauchen Spielregel-Entscheidungen, keine Verdrahtung.

## 2026-11-02 - Dreck, Video Poker und Ueberfaelle an der Ursache

**Ziel.** Die vier offenen Befunde schliessen: falsche Kacheladresse beim Dreck, falsche Video-Poker-Raenge, verdeckte Dreckschicht, verschluckte Ueberfallverluste.

**Umsetzung.** Der Dreck-Schreiber und der Dreck-Leser waren sich uneinig: `dirtyNear` dekodiert `x = index % size`, `y = floor(index / size)`, waehrend `tick.ts` und `disputes.ts` `(y+1)*size+x+1` schrieben — jeder Randale- und Streitfleck lag eine Kachel schraeg daneben, teils ausserhalb des Bodens. Die Adresse steht jetzt einmal als `dirtyTileIndex(size, x, y)` in `emotion.ts`, direkt neben dem Leser; alle vier Schreiber (`tick`, `disputes`, `needs`, `guest-play`) nutzen sie. Video Poker: `royal` verlangte keine Farbe, jede 10-bis-Ass-Strasse zahlte 250x, und das Wheel A-2-3-4-5 wurde als `NOTHING` gewertet; beides folgt jetzt der interaktiven Engine (`straightHigh && flush`, zusaetzlich `wheel`). `evaluatePokerHand` ist dafuer exportiert. Die Dreckschicht war erstes Kind des Moebel-Containers und lag damit unter allen Moebeln; sie ist jetzt ein eigenes `dirt`-Feld im Szenen-Cache und wird in `floor-view` zwischen Teppich und Moebeln eingehaengt. Im Wirtschaftsbericht stieg `classify` bei `from !== HAUSKONTO` aus, bevor der Ueberfallstopf geprueft wurde — ein Ueberfall auf das Portemonnaie (`simulateMugging` waehlt das groessere der beiden Konten) verschwand lautlos. Die Pruefung steht jetzt vor dem Quellkonto-Filter.

**Pruefungen.** Fail-First: `dirty-index.test.ts`, `economy-losses.test.ts` und `video-poker-ranks.test.ts` liefen zuerst mit 8 roten Tests (zwei fehlende Exporte, sechs falsche Ergebnisse), danach 9/9 gruen; der Hauskonto-Ueberfall war schon vorher gruen und bleibt die Baseline. `pnpm run typecheck` und `pnpm run lint` je Exit 0. Der volle `verify:all` folgt am Turn-Ende.

**Offen.** Fuer die Schichtreihenfolge gibt es keinen Unit-Test — PixiJS laesst sich in jsdom nicht sinnvoll aufbauen; sie ist ueber Typecheck, Build und einen Screenshot am Dev-Server geprueft. `mugging.ts` selbst bleibt unveraendert: die Wahl zwischen Kasse und Brieftasche ist Spielregel.

## 2026-11-02 - Governance-Quellen entdoppelt: ein Fehlerregister, eine Subsystemliste, eine Eskalationsleiter

**Ziel.** Governance-Quellen entdoppelt: ein Fehlerregister, eine Subsystemliste, eine Eskalationsleiter

**Umsetzung.** Vier Governance-Definitionen lagen mehrfach vor. `scripts/lib/error-codes.mjs` liest jetzt das Register `src/core/governance/error-codes.ts` selbst; `report.mjs` reicht `catalogCodes()` nur noch weiter, die Markdown-Tabelle ist Dokumentation statt Pruefgrundlage. Ursache des Umbaus war `ERR-1001`: `verify-test-quality.mjs` feuerte den Code, er stand in keinem Register, `line()` degradierte ihn still zu `ERR-0000` — der eine Zustand, der sofort blockiert. Der Code ist jetzt registriert. `issues.ts` und `transfer.ts` benutzen `ERROR_CODES.TRANSFER_INVALID.code`. `scripts/lib/subsystems.mjs` haelt Subsysteme (Prefix, Name, Katalogrolle, Impact-Doku, Invarianten) und die Ordnerregeln; Tree-Gate, Testkatalog, `subsystemOf` und die Impact-Bereiche leiten daraus ab. Die Eskalationsleiter steht als `src/Config/escalation-levels.json`; `escalation.mjs` liest die Datei, `issues.ts` traegt dieselbe Liste typisiert, ein Test vergleicht beide.

**Pruefungen.** `node -e` gegen die neue Bruecke meldet 30 registrierte Codes und `ERR-1001` als bekannt; die Leiter liest `AUTO_FIX -> LOCAL_GATE -> REMOTE_CI -> AGENT -> BLOCKED`; das Tree-Gate laeuft direkt mit PASS. `vitest run` auf `escalation.test.ts`, `dependency-governance.test.ts` und `transfer.test.ts` ergibt 10 gruene Tests. Der volle Lauf steht am Turn-Ende.

**Offen.** `verify-redundancy.mjs` liest `docs/ERROR_CATALOG.md` weiterhin direkt, um doppelte Eintraege zu finden — das gehoert zur Doku-Pruefung, nicht zur Codekenntnis, und bleibt bewusst so. Der TypeScript-Typ der Leiter kann aus JSON nicht abgeleitet werden; die Bindung leistet der Test, nicht der Compiler.

## 2026-11-01 - README-Onboarding und pnpm-CI nachgezogen

**Ziel.** Ein gemeinsamer Einstieg soll die Spielwelt satirisch eröffnen und neue Entwickler ohne Suche durch Werkzeuge und Verträge führen. Das README beschreibt den heutigen Stand, ohne endgültige Vision oder unveränderliche Mechaniken zu behaupten.

**Umsetzung.** README als längeres Onboarding neu geordnet: fiktionale Eröffnung, aktueller Spielstand, Screenshots und Versionsvergleich, Roadmap, Entwicklerstart, Zustandsverträge und FAQ. Das vom Nutzer gelieferte Pixel-Art-Banner ist als `docs/banner.jpg` eingebunden; drei eigene SVG-Trenner führen in Spielwelt, Werkstatt und Roadmap. Einen veralteten Startwert korrigiert: der Store vergibt 150 VC und den ersten Automaten kostenlos. PR #39 war konfliktfrei, seine CI scheiterte am fehlenden pnpm im Runner; alle acht betroffenen Workflow-Jobs installieren jetzt die deklarierte pnpm-Version vor Cache und Install-Schritten. Das Tree-Gate erlaubt JPEGs als Dokumentbeleg. Der erste Audit-Lauf fand die falsche npm-artige Override-Position; `pnpm.overrides` aktualisiert nun die gepatchten Versionen in der Lockfile.

**Pruefungen.** GitHub-Compare meldete vor dem PR einen Commit Vorsprung und keinen Rückstand auf main. Die CI-Diagnose lokalisierte den Fehler beim pnpm-Aufruf; die Reparatur verwendet die offizielle pnpm Action. Der erste lokale `pnpm run verify:all` Lauf hatte einen Audit-Fehler wegen falsch platzierter npm-artiger Overrides und einen Windows-Timeout im Prozess-Sweep-Test. Nach dem pnpm-spezifischen `pnpm.overrides`-Abschnitt sind Audit und zehn weitere Gates grün. Im zweiten vollen Lauf bestehen weiter 467 Tests und 2 sind übersprungen; derselbe Windows-Prozess-Sweep-Test erwartet bei `killTracked()` zwei Treffer und erhält einen. Keine Änderung am Prozess-Sweep-Code, da Ursache anhand dieses Umgebungsbefunds nicht gesichert ist. Die Linux-CI bleibt für den Merge entscheidend.

**Offen.** Lockfile aktualisieren, Pflichtpipeline ausführen, PR #39 aktualisieren und mergen. Anschließend lokale und entfernte WIP-Branches auf unintegrierte Arbeit prüfen.

## 2026-11-01 - Paketmanager von npm auf pnpm umgestellt

**Ziel.** Den Paketmanager auf pnpm umstellen, damit `pnpm-lock.yaml` das Lockfile ist und `package-lock.json` nicht mehr getrackt wird.

**Umsetzung.** `package.json` traegt `"packageManager": "pnpm@10.4.1"`; `package-lock.json` aus Git-Tracking entfernt (`git rm`), `pnpm-lock.yaml` bleibt trackt. `.npmrc` mit `allow-scripts=true` und `approved-builds=ffmpeg-static` beibehalten. Alle npm-Referenzen in Skripten (`scripts/*.mjs`, `scripts/lib/*.mjs`), GitHub Actions Workflows (`.github/workflows/*.yml`), `.githooks/pre-commit`, Pflichtdokumenten (`docs/*.md`) und `AGENTS.md` von `npm` auf `pnpm` umgestellt (`npm ci` → `pnpm install --frozen-lockfile`, `npm run` → `pnpm run`, `npm audit` → `pnpm audit`). `pnpm install` hat 293 Pakete installiert. Test `ci-gates.test.ts` erwartet `pnpm run test:perf` statt `npm run test:perf`.

**Pruefungen.** `typecheck` Exit 0; `lint` ohne Fehler; `verify:quick`: alle Doku-Gates (docs, tree, redundancy, assets, dead-code) PASS, typecheck/lint/check-loc/test-quality PASS. Ein pre-existing Test in `process-sweep.test.ts` (Abbruchpfad, SIGINT) schlaegt unabhaengig von der Migration fehl.

**Offen.** `verify:all` (inkl. Build, Audit, RTP/Balance/Soak) noch nicht lokal durchgelaufen; CI fuehrt es auf jedem Push aus.


**Ziel.** Zwei Befunde aus dem ersten Lauf von `agent:verify` beheben: ein sauberer Baum uebersprang das Testgate, und kein Gate traf den Cache.

**Umsetzung.** `agent-verify` setzt kein `skip` mehr, wenn der Diff keinen Testbezug hat — ohne Auswahl laeuft die Suite, und der Bericht nennt den Grund. `turn-push` ruft `doc-sync` jetzt vor `verify`; der Pre-Commit-Hook schrieb die Marker bisher danach und entwertete damit den Baum, der gerade geprueft wurde.

**Pruefungen.** Zweiter Lauf auf demselben Baum: `agent:verify` meldet `0s` und `[cached]` fuer die betroffenen Gates. `turn:finish` faehrt `verify:quick` mit bereits gesetzten Markern.

**Offen.** Der erste `--ci`-Lauf fuer die langen Nachweise steht aus.

## 2026-11-01 - Ein Prozess: Impact, Agentenkontext, Plan und Bericht

**Ziel.** Eine Aenderung einmal analysieren, einmal planen, einmal passend pruefen und zentral berichten — ohne zweite Pipeline und ohne doppelte Testlaeufe.

**Umsetzung.** `scripts/lib/impact.mjs` fuehrt zusammen, was schon existiert: `changedFiles`, `selectAffectedTests` (Importgraph inklusive dynamischer Importe und Re-Exports), Testkatalog mit Beweisklassen, `pipeline-plan` und `gate-cache`. `agent-context.mjs` gibt daraus kompakt aus, was ein Agent braucht; `agent-verify.mjs` plant dieselben Gates ueber `runGates`, laesst bei Impact-Auswahl nur betroffene Tests laufen (ohne Cache), delegiert lange Nachweise per `--ci` an Actions und schreibt `.verify-cache/reports/<Zeit>/agent-summary.json`. `turn-push` ruft statt des zweiten Testlaufs den Kontext; `test:ci` laeuft ueber `run-selected-tests.mjs`, damit eine Auswahl ueberhaupt adressierbar ist. Der Pre-Commit-Hook bricht ab, wenn Matrix oder Katalog nicht geschrieben wurden.

**Pruefungen.** `node --check` fuer alle geaenderten Skripte; `agent:context` nennt Systeme, Doku, Invarianten und die Delegationsgrenze; `verify:tree` PASS; `typecheck` Exit 0; neuer Nachweis `src/core/governance/__tests__/impact.test.ts` fuer Doku-ohne-Test, Config-alle-Tests, Graphtreffer und Proof-Trennung; `verify:quick` im Turn-Abschluss.

**Offen.** `agent:verify` ersetzt `verify:quick` fuer den Commit nicht; die volle Suite und die Release-Gates bleiben in CI. Der erste `--ci`-Delegationslauf ist noch nicht ausgefuehrt.

## 2026-11-01 - Config-Umzug nachgezogen: Capacitor-Datei wieder versioniert

**Ziel.** Der Umzug nach `src/Config/` darf keine Datei verlieren; die Pruefung zeigte, dass `capacitor.config.json` durch eine ungeankerte Ignore-Regel nie im Commit landete.

**Umsetzung.** `.gitignore` ignoriert nur noch die Laufzeit-Kopie in der Wurzel (`/capacitor.config.json`); `src/Config/capacitor.config.json` kommt aus der History zurueck. `prepare-android` kopiert sie waehrend des APK-Laufs und entfernt sie danach.

**Pruefungen.** `git check-ignore` prueft die Regel, `verify:tree` und `verify:docs` laufen im Turn-Abschluss, `verify:quick` deckt den Commit ab.

**Offen.** Der erste APK-Lauf mit der Kopie steht aus.

## 2026-11-01 - Review-Nachlauf: fatale Luecken der Promotion geschlossen

**Ziel.** Die Review fand zwei Luecken, die die Kette stillschweigend wirkungslos machen: ein Merge mit `GITHUB_TOKEN` startet keinen Workflow (kein CI auf `main`, kein Tag, kein APK), und `pr-cleanup` loescht die permanente Branch `integration`. Beides behoben, dazu die Wettlauf-Raender.

**Umsetzung.** `promote.mjs` waehlt `PROMOTE_TOKEN` als Merge-Token und stoesst ohne dieses Token `Auto Version & Release` an, das vor dem Tag `verify-commit-msg --head` ausfuehrt. `integration` ist in `pr-cleanup.yml` und `branch-prune.mjs` geschuetzt. `cancelled` ist kein Urteil, nur Push-Laeufe promoten, `gh pr update-branch` verhindert den Strict-Policy-Deadlock, der Integrations-Push wird begrenzt geschleift statt rekursiert. `verify-commit-msg --pr` weist einen leeren Body ab. Zusaetzlich kippte `narrative-start-pool` an einer Namenspruefung: `Rita Kern` ist eine moegliche Zufallskombination aus `NAMES` x `LAST_NAMES` in `src/core/sim/traits.ts`, die Zusicherung prueft jetzt das Profil (eine Visite, kein `START_POOL`-Fact) statt des Namens.

Dazu der Aufraeum-Umzug: die Werkzeug-Configs liegen jetzt in `src/Config/`, die Wurzel traegt keine Kopien mehr. `tsconfig.json` bekam `../src` als Include, `vite.config.ts` importiert den Harness ueber `../core/...`, und jeder Aufrufer bindet seinen Pfad explizit — sonst findet `vite`, `vitest`, `tsc`, `eslint`, die Dependency-Matrix, der Dead-Code-Gate oder der Gate-Cache die Datei nicht mehr. Capacitor sucht seine Konfiguration ausschliesslich im Arbeitsverzeichnis; `prepare-android` kopiert sie kurzzeitig in die Wurzel und entfernt sie nach dem Gradle-Lauf. `.mailmap` bleibt in der Wurzel, weil Git nur dort liest.

**Pruefungen.** `node --check` fuer beide Skripte; jede Ersetzung genau einmal angewandt (Skript bricht bei 0 oder 2 Treffern ab); `verify:quick` mit allen zehn Gates im Turn-Abschluss. Ein echter Merge in CI bleibt der offene Nachweis.

**Offen.** `PROMOTE_TOKEN` ist nicht gesetzt, der Anstoss-Pfad ist der aktive. Ob GitHub den Squash-Commit mit eigenem Token als Push wertet, zeigt der erste Lauf. Befund 3, 6 und 7 unveraendert.

## 2026-11-01 - Auto-Promotion: gruene Checks mergen, rote Staende auf die Integrationsbranch

**Ziel.** Der Weg von "Branch gepusht" bis "auf main" soll ohne Handgriff laufen: PR anlegen, Checks abwarten, bei Gruen mergen, bei Rot den Stand auf eine dauerhafte Integrationsbranch legen, damit dort repariert wird. Der Committer soll dabei immer der Eigentuemer sein, unabhaengig von Runner oder Sandbox.

**Umsetzung.** `scripts/promote.mjs` reagiert auf genau ein CI-Ergebnis. Gruen: PR suchen, sonst mit Titel und Pflichtsektionen anlegen, dann mit `--squash --subject --body-file` mergen — der Commit-Text traegt die drei Sektionen, weil `verify-commit-msg --head` sonst auf `main` rot wuerde. Rot: Label `integration/rot` setzen, alle so markierten offenen Branches einsammeln, `integration` aus `origin/main` aufsetzen (oder fortschreiben), jeden Stand per `git merge --no-ff` komponieren und pushen. Die Concurrency-Gruppe `promote` laesst genau einen Schreiber zu; ein abgelehnter Push wird mit `fetch` und `reset --hard` neu aufgesetzt und erneut gemergt, was idempotent ist. Identitaet: `scripts/lib/identity.mjs` als einzige Quelle, in `turn-push.mjs` fest an den Commit gebunden, im Workflow per `git config` gesetzt, dazu `.mailmap` fuer die Anzeige der History.

**Pruefungen.** `node --check scripts/promote.mjs` gruen; die beiden Patch-Ersetzungen in `promote.mjs` und `turn-push.mjs` je genau einmal angewandt (Skript bricht bei 0 oder 2 Treffern ab). `verify:quick` mit allen zehn Gates im Turn-Abschluss. Der erste `turn:finish`-Lauf war an `gate-runner.test.ts` rot (erwartete FAIL, bekam TIMEOUT bei paralleler Gate-Last); isoliert 4/4 gruen, danach der volle Lauf gruen — Lastkonkurrenz, kein Defekt am Stand; der Artefakt-Test der Gate-Auswertung laeuft jetzt mit 60 s Limit (30 s fuer die schnelle Probe), weil unter paralleler Gate-Last schon der Node-Start mehrere Sekunden braucht. Die Zusicherungen blieben unveraendert.

**Offen.** Der Promote-Workflow laeuft zum ersten Mal in CI; ein echter Merge und eine echte Integration sind damit noch nicht belegt. Der Verified-Badge haengt an GitHub-seitigen Merges: entweder `RBD_PROMOTE_AUTO_MERGE=1` mit der Repo-Vorgabe "PR-Titel und -Beschreibung" fuer Squash, oder ein Signaturschluessel. Befund 3, 6 und 7 stehen unveraendert.

## 2026-11-01 - Doku-Konsolidierung: Sortierung, Namensgleichheit und Repo-Hygiene

**Ziel.** Eine Doku, die man lesen kann, ohne zu raten: gleiche Namen, ein Ort pro Thema, keine Aussage, die einer anderen widerspricht. Dazu der lokale Repo-Zustand: Hooks aktiv, nichts Unsortiertes in der Wurzel.

**Umsetzung.** 16 Doku-Dateien liegen flach unter `docs/` und tragen Grossbuchstaben-Namen; `EVENT-NARRATIVE-ENGINE-TASKPLAN.md` und `CASINO-PIXEL-ASSET-PACK.md` ersetzen die beiden kebab-case-Ausreisser, `docs/assets/` entfaellt, `docs/ASSETS.md` verweist auf den neuen Pfad. Widersprueche korrigiert: Save v9 statt v8 in ARCHITECTURE und Inventar §8; "Narrative Engine ist noch nicht gebaut" ersetzt durch Stufe 1 gebaut / NAR-04+ nach Taskplan; Gate-Zaehlung und Gate-Reihenfolge in ARCHITECTURE, PRODUCT und AGENTS auf `scripts/lib/pipeline-plan.mjs` gezogen; Inventar-Kopf auf `main`/`c4e6e3b`/983 Dateien; §2, §3, §9–§13 auf Ist-Zahlen; Befund 5 und 42 als aufgeloest markiert, §17 auf umgesetzt. `docs/ERROR_CATALOG.md`: verschmolzene ERR-4013/ERR-4014-Zeile getrennt, Codes aufsteigend sortiert. Screenshot-README nennt wieder den echten Bestand. Repo-Hygiene: `pnpm run hooks:install` gesetzt (2 Hooks), Wurzel enthaelt nur `README.md` und `AGENTS.md` als Markdown. Beim Abschluss fiel der letzte Widerspruch auf: das Doku-Gate zaehlte `.turn-notes.md` als Wurzel-Doku und machte `turn:finish` rot, obwohl genau dieses Werkzeug die Datei anlegt; der Scan ueberspringt Dotfiles jetzt.

**Pruefungen.** `pnpm run inventory:build` regeneriert §18 (983 Dateien, 67 Ordner); `verify:docs`, `verify:tree`, `verify:redundancy` und `check:loc` gruen; danach `pnpm run verify:quick` mit allen zehn Gates gruen und Exit 0. Pre-Commit-Hook schreibt Matrix, Katalog und Marker, `turn:finish` bumpt auf 0.3.65, committet und pusht.

**Offen.** Befund 3 (ERR-4016 fuer das Asset-Gate), 6 (`opencode.json` mit Windows-Pfad) und 7 (Audit-Drift 373/323) bleiben stehen; `verify:all` mit Build und Audit laeuft in CI. `W3Champions/logs` ist fremde lokale Logware, bleibt gitignoriert und unangetastet.

## 2026-11-01 - Narrative Engine Stufe 1: Facts, Gedaechtnis, Start-Pool (NAR-00 bis NAR-03)

**Ziel.** Den Taskplan nicht nur beschreiben, sondern den ersten tragenden Schnitt
umsetzen — mit belegter Wirkung im Spiel, inklusive Start-Pool.

**Umsetzung.** Neuer Core-Bereich `src/core/sim/narrative/`: `types.ts` (Facts,
Erinnerungen, Grenzen), `facts.ts` (ID-Vergabe, Queue mit Deckel, idempotenter Drain),
`state.ts` (Startzustand, Start-Pool, sichere Normalisierung), `memory.ts`
(Fact→Erinnerung, deterministische Wirkung). `WorldState.narrative` ist der einzige
persistente Narrativ-Zustand; `Visitor.memories` haelt hoechstens sechs strukturierte
Erinnerungen. Facts entstehen an echten Uebergaengen: Spawn (erster Besuch /
Rueckkehr), Auszahlung (`VISIT_ENDED` aus `guest-service`) und neues Spiel
(`START_POOL` mit Startkapital). Save v9 traegt alles, v5–v8 werden normalisiert.

**Wirkung (nicht nur Speicherung).** `returnChance()` addiert den Erinnerungsbonus
(+4 Prozent je gutem, -6 je schlechtem Besuch, letzte doppelt, gedeckelt),
`spawnGuest()` gibt Rueckkehrern den Laune-Bonus mit. Konkret gemessen und in
`narrative-memory.test.ts` festgeschrieben: neutral 25 Prozent Rueckkehr, nach einem
guten Besuch 33, nach einem schlechten 13; die Spawn-Laune liegt genau um den
Erinnerungsbonus hoeher als in der Kontrollwelt mit identischem Seed. `seedStartPool()` setzt drei
bekannte Figuren und das Startkapital als Fact; die Rueckkehrer-Auswahl kann sie ab
Tick 0 treffen. Damit aendert sich messbar, wer wiederkommt und wie er ankommt.

**Nachweise (Vitest, am Turn-Ende).** `narrative-facts.test.ts` (IDs, einmalige
Verarbeitung, Queue-Deckel 48/12, JSON-Roundtrip, unbekannte Referenz, Flags ohne
Journal), `narrative-memory.test.ts` (Rueckkehr steigt/sinkt, letzte Erinnerung
doppelt, Deckel 6, Spawn-Laune differiert zur Kontrollwelt um genau den Bonus),
`narrative-start-pool.test.ts` (drei Figuren, Idempotenz, Rueckkehr ab Tick 0,
Kontrollwelt ohne Pool legt neues Profil an), `narrative-save.test.ts` (v9-Roundtrip,
v8-Defaults, zwei Welten nach 80 Ticks identisch).

**Offen.** NAR-04 bis NAR-17 (Beziehungen, Trigger, Scheduler, Event-Templates,
Command-DSL, Content-Compiler, Composer/LLM, UI, Rivalen, Soak) sind nicht umgesetzt.
Der Start-Pool ist bewusst nur im Store-Pfad fuer neue Spiele aktiv, nicht in
`createWorld()`, damit alte Saves ihre Besucherliste behalten.

## 2026-11-01 - Merge ohne PR-Body macht main rot (Vorfall und Reparatur)

**Ziel.** PR #32 mergen und `main` gruen halten.

**Vorfall.** Der Merge lief ueber die GitHub-API mit `commit_title`, aber ohne
`commit_message`. Der Merge-Commit `3c46ba6` trug damit nur den Klicktitel und
keine Pflichtsektionen. `verify-commit-msg --head` prueft auf `main` genau diesen
Commit und wurde rot: `[ERR-4006] Pflichtsektion fehlt: ### Changes (Was ist neu)`,
`### Technische Basis & Kausalitaet`, `### Ausblick (Naechste Schritte)`. Der Job
`Fail-Closed Gates` endete mit Exit 1; `Bump, tag, release` und der APK-Bau wurden
deshalb uebersprungen (conclusion `skipped`).

**Reparatur.** Kein Rewrite von `main`, kein Force-Push: Der Regeltext in
`AGENTS.md` nennt jetzt die API-Falle ausdruecklich (PR-Body gehoert in
`commit_message`), und dieser Doku-Commit traegt die drei Sektionen selbst. Damit
prueft `verify-commit-msg --head` wieder einen konformen HEAD, und die
Release-Kette laeuft erneut an.

**Lehre.** Ein gruener PR ist kein gruener `main`: Die Commit-Nachricht des
Merge-Commits ist Teil des Gates, nicht nur der PR-Body.

## 2026-11-01 - performance.now-Ausnahme auf Pacing verengt und als dicht belegt

**Ziel.** Beweisen, dass die Render-Ausnahme genau Pacing erlaubt und nicht mehr:
kein pauschales Datei-Allow, keine mitfreigestellten Identifier, und kein Weg
eines Wanduhr-Werts aus `src/render/**` in `src/core`, `src/store`, Composer/LLM
(A-10), Content-Compiler (A-11) oder die kuenftige Narrative Engine.

**Befund am Code.** `performance.now` kommt an genau fuenf Stellen vor, verteilt
auf drei Dateien: `src/render/floor-view.ts` (3), `src/render/music.ts` (2),
`src/render/floor-props.ts` (1). Die Sperre erlaubte sie trotzdem in **jeder**
Datei unter `src/render/**` — breiter als der Zweck. Zwei Uhr-Quellen fehlten
ausserdem komplett: `Date()` ohne `new` (liefert einen Wall-Clock-String) und
`performance.timeOrigin` (Epoch-Zeitstempel).

**Umsetzung.** `eslint.config.mjs` nennt die drei Pacing-Dateien jetzt namentlich;
alle anderen Render-Dateien fallen unter die strenge `src/**`-Regel und sind voll
gesperrt. `Date()` als Call (auch `globalThis.Date()`) und `performance.timeOrigin`
sind als Syntax-Selectoren ergaenzt; die Render-Ausnahme filtert weiterhin nur
`performance`-Selectoren heraus, `timeOrigin` bleibt also auch dort rot. Damit ist
in den drei Dateien genau ein Identifier erlaubt: `performance.now`.

**Proben (24, `npx eslint --stdin --stdin-filename <pfad>`).** Gruen nur:
`performance.now` in den drei Pacing-Dateien, der Alias `const p = performance; p.now()`
und `globalThis.performance.now()`. Rot in denselben Dateien: `Math.random`,
`Date.now`, `new Date()`, `Date()`, `performance.timeOrigin`, `getRandomValues`,
`randomUUID`, `globalThis.Math.random`, `window.Date.now`, `const { random } = Math`,
`Math["random"]`, `Date["now"]`. Rot ausserhalb der drei Dateien: `performance.now`
in `src/render/guest-art.ts`, `src/ui/Hud.tsx`, `src/core/sim/tick.ts` und in
`scripts/**` (dort zusaetzlich `Date.now`, `new Date`, `Math.random`).

**Rot/Gruen am echten Stand.** `Math.random()` an `src/render/music.ts` und
`Date.now()` an `src/render/floor-view.ts` angehaengt: `pnpm run lint` Exit 1 mit
vier Fehlern (`no-restricted-properties` und `no-restricted-syntax` je Quelle).
Nach `git checkout --` beider Dateien: Exit 0. `performance.now()` in einer
vierten Render-Datei (`guest-art.ts`): `npx eslint src/render/guest-art.ts` Exit 1,
zwei Fehler — die Ausnahme ist also nicht datei-pauschal.

**Datenfluss (gelesen, nicht geplant).** `src/core` und `src/store` importieren
nichts aus `src/render` (0 Treffer, Tree-Gate erzwingt Core-Importe nur aus
`src/core`). `src/render` importiert aus `src/store` ausschliesslich
`import type { GameView }` (7 Treffer, alle type-only) und ruft keinen Command.
`world.tick += 1` steht nur in `src/core/sim/tick.ts`; `tick`/`day` werden sonst
nur beim Laden (`migrate.ts`) und fuer fremde Etagen (`foreign-floor-tick.ts`,
`floor.day = world.day`) gesetzt. Kein Command nimmt `tick`/`day`/`time`; die
einzige Ausnahme `buyBarCmd(world, ledger, tick)` wird ausschliesslich von
`world-store` mit `this.#world.tick` aufgerufen und stempelt nur die Ledger-Zeile.
Composer/LLM und Content-Compiler existieren noch nicht; `scripts/**` ist bereits
gesperrt, damit sie die Uhr auch spaeter nicht lesen koennen.

**Pruefungen.** `lint`, `verify:test-quality`, `verify:docs`, `verify:tree`,
`verify:redundancy`, `check:loc`, `tsc --noEmit`, `inventory:build` lokal gruen;
Vitest und `verify:all` laufen in CI.

**Offen.** Innerhalb der drei Pacing-Dateien ist `performance.now` nicht auf eine
Codezeile festnagelbar — ESLint sieht keinen Zweck, nur den Identifier; die
Dateiliste ist die engste Grenze ohne neuen Produktivcode. `performance.timeOrigin`
und `Date()` sind jetzt ueberall rot, `performance.mark/measure` bleiben erlaubt
(reine Messmarken, kein lesbarer Uhrwert).

## 2026-11-01 - Determinismus-Sperre fail-closed gehaertet

**Ziel.** Beweisen, dass die Sperre haelt — nicht nur, dass sie dokumentiert ist.

**Befund (gemessen, 20 Proben gegen `npx eslint --stdin`).** Sieben Umwege kamen
durch: `globalThis.Math.random` und `window.Math.random`, `new globalThis.Date()`,
`crypto.getRandomValues` und `crypto.randomUUID` (standen nie in der Regelliste),
`eslint-disable-next-line`, der pauschal freigestellte `src/core/rng/streams.ts`
und **alle** `scripts/**`-Dateien — inklusive des kuenftigen Content-Compilers.
Zusaetzlich hatte `verify-test-quality` eine stille Kommentar-Ausnahme
(`@seed-initializer`), die eine Zufallsquelle in `src/core` und `src/store`
durchgelassen haette.

**Umsetzung.** `eslint.config.mjs` erfasst jetzt Namespace-Umwege
(`globalThis`/`window`), `new`-Umwege, computed Zugriffe, Krypto-Selectoren fuer
`getRandomValues`/`randomUUID` und `scripts/**` per Default. `linterOptions.noInlineConfig`
schaltet `eslint-disable` global ab, damit kein Kommentar die Sperre aufhebt.
`src/core/rng/streams.ts` verliert die Pauschal-Freistellung: dort ist nur noch
Krypto erlaubt, `Math.random` und Uhr bleiben verboten. Sieben Tooling-Skripte
(Zeitstempel, CI-Polling, Gate-Logs) sind namentlich und begruendet ausgenommen und
duerfen weiterhin keinen Zufall ziehen. Die `@seed-initializer`-Ausnahme in
`verify-test-quality` ist entfernt — sie war unbenutzt und damit nur eine Tuer.

**Rot/Gruen-Beleg.** `export const __determinismProbe = Math.random();` an
`src/core/sim/tick.ts` angehaengt: `pnpm run lint` endet mit Exit 1 und meldet
zwei Fehler in Zeile 140 (`no-restricted-properties` und `no-restricted-syntax`).
Nach `git checkout -- src/core/sim/tick.ts`: `pnpm run lint` Exit 0.

**Pruefungen.** `lint`, `verify:test-quality` (87 Testdateien),
`verify:tree`, `verify:redundancy`, `check:loc`, `tsc --noEmit`,
`inventory:build` (971/971) lokal gruen; `verify:docs` im Commit-Hook. Vitest und
`verify:all` laufen in CI.

**Offen.** `performance.now()` bleibt in `src/render/**` fuer Bild-/Ton-Pacing
erlaubt; dieser Wert beruehrt nie den Spielzustand. Kein neues Gate, keine neue
Abhaengigkeit.

## 2026-11-01 - Event-Engine-Taskplan adversarial gehaertet

**Ziel.** Den bestehenden 18-Task-Plan (NAR-00…NAR-17) gegen sich selbst
pruefen: keine Annahme ungeprueft, kein Task gestrichen, jede Erkenntnis mit
Gegenmassnahme und Systembezug.

**Befund.** Drei Planfehler sind am Code belegbar. Erstens war die Gate-Liste in
§3 veraltet: `deps-matrix` und `catalog` sind seit dem Hook-Umbau keine Gates
mehr, `docs`, `tree` und `redundancy` fehlten. Zweitens kannte der Pruefstand
`708d31c` die Determinismus-Sperre nicht, obwohl die Narrative Engine die
wahrscheinlichste Stelle fuer neues `Math.random` ist. Drittens setzte die
Reihenfolge NAR-12 (Tick-Integration) vor NAR-13 (Demand-Migration) und haette
damit fuer die Dauer der Umsetzung zwei aktive Event-Wahrheiten erzeugt. Dazu
kamen 17 weitere Angriffe, unter anderem Ledger-Index gegen Buchungs-`seq` beim
Fact-Cursor, `VISITOR_CAP = 40` mit `splice(oldest)` gegen laufende Stories,
halbe Beziehungskanten nach Archivierung, unbegrenzte Cooldowns, `FREEZE_TICK`
ohne Einheit, halb angewendete Command-Batches, LLM-Injection und Bundle-Wachstum.

**Umsetzung.** §9 (20 Angriffe mit Befund, Gegenmassnahme und Taskbezug), §10
(Systemmatrix ueber 20 Systeme), §11 (korrigierte Reihenfolge: NAR-13 vor NAR-12,
10 vor 11, 06 vor 07), §12 (Definition of Done je Task mit Pflicht-Gate) und §13
(Aenderungsprotokoll) ergaenzt. Kopf auf `7cca88a` aktualisiert, die Gate-Liste in
§3 an `scripts/lib/pipeline-plan.mjs` angeglichen, der Drift-Absatz praezisiert:
`poker-distribution` laeuft im Quick-Profil, `balance-operating` ist ohne
`RBD_BALANCE` inaktiv.

**Pruefungen.** `verify:docs`, `verify:tree`, `verify:redundancy`, `check:loc`,
`lint`, `typecheck` und `inventory:build` lokal; Vitest und `verify:all` laufen in
CI. Kein Produktivcode geaendert.

**Offen.** Der Plan bleibt ein Plan: keine NAR-Umsetzung, kein Save v9. Die
Reihenfolgekorrektur bindet die Umsetzung, nicht rueckwirkend gemergte Arbeit.

## 2026-11-01 - Determinismus: kein Math.random und keine Wanduhr im Spielzustand

**Ziel.** Kein `Math.random()` und keine vergleichbare Streuquelle im Spiel:
gleicher Seed und gleiche Ticks muessen denselben Zustand und denselben Export
ergeben.

**Befund.** `Math.random()` war seit der RNG-Trennung aus Renderer und Sound
verschwunden, aber drei Nebentueren blieben offen. `world-store` seedete den PRNG
mit `Date.now()` (Feld-Initialisierung und `newGame`), `exportGameData` stempelte
den Export mit `new Date().toISOString()`, und der Musik-Crossfade mass seine
Fadezeit an `Date.now()`. Gleicher Stand ergab damit nicht zwingend dieselben
Bytes.

**Umsetzung.** `entropySeed()` in `src/core/rng/streams.ts` ist jetzt der einzige
Entropie-Eingang (Krypto, ohne Fallback); `presentationSeed()` und beide
Seed-Stellen im Store ziehen nur noch daraus. Der Export traegt `Tag X, Tick Y`
aus der Welt statt eines Uhrzeitstempels. Der Musik-Fade nutzt `performance.now()`.
`eslint.config.mjs` verbietet in `src/**` `Math.random`, `Date.now`,
`performance.now` und `new Date()`; `src/render/**` darf `performance.now` fuer
Pacing lesen, `src/core/rng/streams.ts` ist die einzige Ausnahme fuer die
Krypto-Entropie. Neuer Test `src/store/__tests__/determinism.test.ts` faehrt zwei
Laeufe mit demselben Seed und vergleicht den vollstaendigen Export.

**Pruefungen.** `pnpm run lint` (neue Regel), ESLint-Probe per `--stdin` (vier
Treffer in `src/core`, kein Treffer fuer `performance.now` in `src/render`),
`tsc --noEmit`, `check:loc`, `verify:test-quality` (87 Testdateien),
`verify:dead-code` (775 Exporte), `verify:tree`, `verify:redundancy`. Vitest lief
nicht lokal; die neuen Tests und `verify:all` laufen in CI.

**Offen.** Die Start-Entropie bleibt echt zufaellig: Determinismus heisst
Wiederholbarkeit ab gespeichertem `prngState`, nicht ein fester Startseed.

## 2026-11-01 - RNG-Namespaces getrennt

**Ziel.** Gameplay und Darstellung duerfen nie denselben Zufallsstrom ziehen; sonst
verschiebt ein Partikeleffekt den naechsten Gegnerspawn.

**Befund.** Partikel (`src/render/fx/emitter.ts`) und Rauschen
(`src/render/sound-fx.ts`) nutzten `Math.random()` — getrennt vom Spielstrom,
aber unbenannt und nicht gegen kuenftige Vermischung geschuetzt. Poker zieht
bewusst einen Gameplay-Strom aus dem gedealten Seed, das bleibt Spielzustand.

**Umsetzung.** `Prng` traegt eine Rolle (`gameplay` | `presentation`).
`src/core/rng/streams.ts` liefert `presentationRng`, `presentationSeed` und
`assertGameplayRng`; `src/render/rng.ts` haelt den einen Darstellungs-Strom,
Emitter und Sound ziehen nur noch daraus. `tickWorld` und `playRound` rufen den
Guard auf und brechen bei einem presentation-Strom mit klarer Meldung ab.

**Pruefungen.** `tsc --noEmit`, ESLint, `check:loc`, `verify:docs`,
`verify:tree`, `verify:redundancy` lokal gruen. Vitest lief nicht lokal; die
neuen Tests (`streams.test.ts`) und `verify:all` laufen in CI.

**Offen.** Der Darstellungs-Seed ist absichtlich nicht im Save: visuelle
Wiederholbarkeit nach einem Reload ist kein Spielzustand.

## 2026-11-01 - main in den Inventar-Branch gemergt

**Ziel.** PR #27 mergebar machen, ohne die Asset-Arbeit von `main` zu verlieren.

**Umsetzung.** `main` (`ee882da`, drei Commits, +485 Zeilen in Renderer und UI)
in den Branch gemergt. Zwei Konflikte: `src/main.tsx` (Runtime-Art-Preload von
`main` plus `./styles/index.css` aus diesem Branch) und die generierte
Dependency-Matrix in `docs/ARCHITECTURE.md` (Zaehlungen beider Seiten, danach
vom Hook neu erzeugt).

**Pruefungen.** `verify:docs` inklusive Inventar-Abdeckung, `verify:tree`,
`verify:redundancy`, `check:loc`, ESLint und `tsc --noEmit` lokal gruen; die
neuen Renderer-Dateien und fuenf Screenshots stehen im regenerierten Abschnitt 18.
Vitest lief nicht lokal; der Beweis bleibt `verify:all` in CI.

## 2026-11-01 - Inventar-Generator idempotent gemacht

**Befund.** Bei der Verifikation der Auslieferung fiel auf: Nach einem testweise
entfernten Eintrag stellte `pnpm run inventory:build` den Block nicht byte-identisch
wieder her, der Arbeitsbaum blieb eine Zeile dirty. Ursache war der Selbsteintrag
von `docs/INVENTORY.md`: Er beschrieb seine eigene Zeilenzahl, die der Generator
beim Schreiben gerade veränderte — der Block hing damit von seinem eigenen
Vorzustand ab.

**Umsetzung.** Der Selbsteintrag trägt jetzt einen stabilen Status („gepflegt:
Marker und Abschnitt 18“) statt einer Zeilenzahl; alle anderen Einträge bleiben
messbar. Zwei Generatorläufe hintereinander ergeben denselben Hash.

**Prüfungen.** Datei-Eintrag entfernt → `verify:docs` Exit 1; Ordner-Eintrag
entfernt → Exit 1; nach `inventory:build` ist die Datei SHA-256-gleich zum
Ausgangsstand und das Gate grün. Vitest lief nicht lokal; der Beweis bleibt CI.

## 2026-11-01 - Vollständige Inventur mit erzwungener Abdeckung

**Ziel.** Nicht die interessanten Stellen, sondern jede getrackte Datei: eine
Zeile je Pfad, ein Eintrag je Ordner, und eine Prüfung, die eine Lücke rot macht.

**Umsetzung.** `scripts/build-inventory.mjs` liest `git ls-files`, öffnet jede
Datei und schreibt den Block zwischen `inventory:start` und `inventory:end` in
`docs/INVENTORY.md`. Textdateien liefern Zeilenzahl und Kopfkommentar,
PNG-Dateien ihre IHDR-Maße, OGG-Dateien ihre Signatur; Sammelzeilen gibt es
nicht. `verify:docs` vergleicht den Block mit dem Index, prüft die 64 Ordner
und die Abdeckungszahl. Der Pre-Commit-Hook baut die Liste vor dem Marker, die
Abdeckung kann also nicht stillschweigend veralten.

**Befunde beim Bauen.** Shell-Hooks ohne Endung wurden zunächst als Binärdatei
geführt — die Erkennung fragt jetzt nach NUL-Bytes statt nach der Endung. Der
Changelog trug `[0.3.65]`, während `package.json` und alle Marker `0.3.64`
sagten; die Überschrift ist auf `0.3.64` gezogen.

**Prüfungen.** Drei Rot-Tests gegen das Gate: eine entfernte Datei, ein
entfernter Ordner und eine falsche Abdeckungszahl brechen jeweils mit
`ERR-4017` ab; danach ist der Lauf wieder grün. `verify:tree`,
`verify:redundancy`, `check:loc`, ESLint und `tsc --noEmit` lokal grün. Vitest
lief nicht lokal; der Beweis bleibt `verify:all` in CI.

**Offen.** Der Lizenznachweis für die 552 Dateien unter `public/` liegt weiter
beim Betreiber; inhaltlich geprüft sind Signatur und Größe, nicht die Rechte.

## 2026-11-01 - Tree-Gate, Redundanz-Gate und Doc-Generierung

**Ziel.** Jede Datei am richtigen Ort, keine doppelte Wahrheit und ein Befehl,
der Changelog, Devtagebuch und Inventar mechanisch anlegt.

**Umsetzung.** `scripts/verify-tree.mjs` prueft Wurzel-Whitelist, erlaubte
Endungen je Ordner, Testablage in `__tests__` und die Importrichtung von
`src/core`. `scripts/verify-redundancy.mjs` vergleicht Dateiinhalte per
SHA-256, pnpm-Kommandos und Fehlercodes; Alias-Paare sind ausdruecklich erlaubt.
`scripts/doc-stub.mjs` schreibt die drei Pflichteintraege mit Datum, Version
und Uhrzeit. Beide Gates laufen im schnellen und im vollen Profil.

**Befunde beim ersten Lauf.** `src/index.css` lag neben `main.tsx` und wanderte
nach `src/styles/`; `eslint.config.mjs` und `opencode.json` fehlten in der
Wurzel-Whitelist; `scripts/init-github.sh` ist als Bootstrap-Shell erlaubt.
Der Umzug brach zunaechst die drei `@import`-Pfade; der CI-Build fand es, jetzt
sind sie relativ (`./tokens.css`, `./app.css`, `./popup.css`).

**Pruefungen.** `verify:tree`, `verify:redundancy`, `verify:docs`, ESLint,
`tsc --noEmit` und `check:loc` lokal gruen. Vitest lief nicht lokal; der Beweis
bleibt `verify:all` in CI.

**Bestaetigt.** Der CI-Lauf zu `37affc5` ist gruen: „Fail-Closed Gates“ und „Commit-Body in PR-Body heben“ stehen auf success; Tree- und Redundanz-Gate laufen dort mit. Vitest und Build liefen ausschliesslich in CI.

## 2026-11-01 - CI-Befund behoben (T12)

**Befund.** Lauf #110 (`CI Verify`, Commit `f2f46c7`) war rot: 438 Tests gruen,
zwei rot. `src/core/governance/__tests__/pipeline-modes.test.ts` verlangte noch
`GATES['deps-matrix'].args === ['--check']` und `quick` mit `deps-matrix`.

**Ursache.** Der Gate-Plan wurde bewusst geaendert, der Testvertrag nicht
mitgezogen. Der Test ist damit kein falscher Alarm, sondern eine echte
Nachweispflicht.

**Behebung.** Der Test prueft jetzt `GATES.docs` (Skript, keine Argumente) und
`quick` mit `docs` sowie ohne `deps-matrix`/`catalog`; die Regel "kein Gate
repariert" bleibt unveraendert. Kein Gate wurde wieder eingefuehrt.

**Pruefungen.** ESLint, Doc-Gate, Typecheck lokal; der Beweis laeuft im
naechsten `CI Verify`-Lauf.

## 2026-11-01 - Connector-Eskalation (T11)

**Ziel.** Agenten ohne `gh`-Token sollen den PR-Body trotzdem heben koennen.

**Umsetzung.** `scripts/lift-commit-body.mjs` kennt jetzt `--json` (und
`--connector`): Der Plan enthaelt `level`, `channel: github-connector`, `branch`,
`base`, `title`, `bodyFile` und `body`. CI nutzt weiter `gh`; scheitert das,
bleibt der Lauf gruen und der Plan ist die Uebergabe. Der Level stammt aus
`scripts/lib/escalation.mjs`, es entsteht keine zweite Klassifikation.

**Pruefungen.** ESLint ueber `scripts/`, Doc-Gate, JSON-Ausgabe im Trockenlauf.

**Offen.** Der Connector-Weg ist beschrieben, aber noch nicht in einem echten
Agentenlauf benutzt.

## 2026-11-01 - Governance, Eskalation und Import/Export

**Ziel.** Fehlschlaege sollen zuerst automatisch loesbar sein: reparieren, in CI
wiederholen, erst dann ein Agent. Dazu Pflichtdoku mit Version und Zeitstempel,
ein Doc-Gate mit Strukturvorgaben und ein sauberer Wurzelbaum.

**Umsetzung.**

- `scripts/lib/escalation.mjs`: eine Leiter fuer alle Befunde, Klassifikation
  ueber Regeln (Ledger/Geld blockiert, Doku/Format automatisch, Netz transient,
  Scope lokal, Rest Agent).
- `scripts/lib/doc-sync.mjs` plus `scripts/doc-sync.mjs`: Marker
  `<!-- rbd-doc: v0.3.125 | 2026-11-06 03:41 UTC -->` in sechs Pflichtdokumenten;
  `verify:docs` prueft Marker, Pflichtabschnitte, Wurzel-Whitelist und Doppelungen.
- `.githooks/pre-commit` schreibt Matrix, Katalog und Doku-Marker und prueft
  danach Doku und LOC; `.githooks/commit-msg` eskaliert statt zu blockieren.
- `pr-escalation.yml` hebt einen Commit ohne Pflichtsektionen in den PR-Body.
- Import/Export: `src/core/io/{issues,envelope,repair}.ts` und
  `src/store/transfer.ts`; die Oberflaeche sitzt im Pruefungs-Popup.
- Pipeline: `deps-matrix` und `catalog` sind keine Gates mehr, `docs` ersetzt sie.

**Pruefungen.** Statische Gates (Lint, Typecheck, LOC, Doc-Gate) liefen lokal;
Vitest wurde bewusst nicht gestartet, weil Tests laut Auftrag ausschliesslich
ueber GitHub Actions eskaliert und dort geloest werden. Der volle Beweis bleibt
`verify:all` in CI.

**Bewusst nicht getan.** Kein Save-Format-Wechsel (bleibt v8), keine Migration
der Narrativ-Engine (NAR-00..16 bleibt Plan), keine Aenderung an Geldpfaden.
