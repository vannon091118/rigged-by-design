# Devtagebuch

Chronologisch, ehrlich, mit offenen Enden. Jeder Eintrag nennt Datum, Ziel,
Umsetzung, Pruefungen und was bewusst nicht getan wurde.

## Regeln

- Ein Eintrag pro Arbeitstag oder pro abgeschlossenem Auftrag, neuester oben.
- Pruefungen werden woertlich benannt; "getestet" ohne Kommando ist kein Nachweis.
- Begruendungen gehoeren hierher, nicht in Commit-Titel.
- Offene Punkte bleiben stehen, bis sie erledigt oder verworfen sind.

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
  `<!-- rbd-doc: v0.3.64 | 2026-11-01 11:28 UTC -->` in sechs Pflichtdokumenten;
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
