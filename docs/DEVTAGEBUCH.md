# Devtagebuch

Chronologisch, ehrlich, mit offenen Enden. Jeder Eintrag nennt Datum, Ziel,
Umsetzung, Pruefungen und was bewusst nicht getan wurde.

## Regeln

- Ein Eintrag pro Arbeitstag oder pro abgeschlossenem Auftrag, neuester oben.
- Pruefungen werden woertlich benannt; "getestet" ohne Kommando ist kein Nachweis.
- Begruendungen gehoeren hierher, nicht in Commit-Titel.
- Offene Punkte bleiben stehen, bis sie erledigt oder verworfen sind.

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

**Umsetzung.** 16 Doku-Dateien liegen flach unter `docs/` und tragen Grossbuchstaben-Namen; `EVENT-NARRATIVE-ENGINE-TASKPLAN.md` und `CASINO-PIXEL-ASSET-PACK.md` ersetzen die beiden kebab-case-Ausreisser, `docs/assets/` entfaellt, `docs/ASSETS.md` verweist auf den neuen Pfad. Widersprueche korrigiert: Save v9 statt v8 in ARCHITECTURE und Inventar §8; "Narrative Engine ist noch nicht gebaut" ersetzt durch Stufe 1 gebaut / NAR-04+ nach Taskplan; Gate-Zaehlung und Gate-Reihenfolge in ARCHITECTURE, PRODUCT und AGENTS auf `scripts/lib/pipeline-plan.mjs` gezogen; Inventar-Kopf auf `main`/`c4e6e3b`/983 Dateien; §2, §3, §9–§13 auf Ist-Zahlen; Befund 5 und 42 als aufgeloest markiert, §17 auf umgesetzt. `docs/ERROR_CATALOG.md`: verschmolzene ERR-4013/ERR-4014-Zeile getrennt, Codes aufsteigend sortiert. Screenshot-README nennt wieder den echten Bestand. Repo-Hygiene: `npm run hooks:install` gesetzt (2 Hooks), Wurzel enthaelt nur `README.md` und `AGENTS.md` als Markdown. Beim Abschluss fiel der letzte Widerspruch auf: das Doku-Gate zaehlte `.turn-notes.md` als Wurzel-Doku und machte `turn:finish` rot, obwohl genau dieses Werkzeug die Datei anlegt; der Scan ueberspringt Dotfiles jetzt.

**Pruefungen.** `npm run inventory:build` regeneriert §18 (983 Dateien, 67 Ordner); `verify:docs`, `verify:tree`, `verify:redundancy` und `check:loc` gruen; danach `npm run verify:quick` mit allen zehn Gates gruen und Exit 0. Pre-Commit-Hook schreibt Matrix, Katalog und Marker, `turn:finish` bumpt auf 0.3.65, committet und pusht.

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
`Date.now()` an `src/render/floor-view.ts` angehaengt: `npm run lint` Exit 1 mit
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
`src/core/sim/tick.ts` angehaengt: `npm run lint` endet mit Exit 1 und meldet
zwei Fehler in Zeile 140 (`no-restricted-properties` und `no-restricted-syntax`).
Nach `git checkout -- src/core/sim/tick.ts`: `npm run lint` Exit 0.

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

**Pruefungen.** `npm run lint` (neue Regel), ESLint-Probe per `--stdin` (vier
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
entfernten Eintrag stellte `npm run inventory:build` den Block nicht byte-identisch
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
SHA-256, npm-Kommandos und Fehlercodes; Alias-Paare sind ausdruecklich erlaubt.
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
  `<!-- rbd-doc: v0.3.68 | 2026-11-01 20:56 UTC -->` in sechs Pflichtdokumenten;
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
