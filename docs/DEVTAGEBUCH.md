# Devtagebuch

Chronologisch, ehrlich, mit offenen Enden. Jeder Eintrag nennt Datum, Ziel,
Umsetzung, Pruefungen und was bewusst nicht getan wurde.

## Regeln

- Ein Eintrag pro Arbeitstag oder pro abgeschlossenem Auftrag, neuester oben.
- Pruefungen werden woertlich benannt; "getestet" ohne Kommando ist kein Nachweis.
- Begruendungen gehoeren hierher, nicht in Commit-Titel.
- Offene Punkte bleiben stehen, bis sie erledigt oder verworfen sind.

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
  `<!-- rbd-doc: v0.3.64 | 2026-11-01 10:50 UTC -->` in sechs Pflichtdokumenten;
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
