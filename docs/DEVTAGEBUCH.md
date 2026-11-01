# Devtagebuch

Chronologisch, ehrlich, mit offenen Enden. Jeder Eintrag nennt Datum, Ziel,
Umsetzung, Pruefungen und was bewusst nicht getan wurde.

## Regeln

- Ein Eintrag pro Arbeitstag oder pro abgeschlossenem Auftrag, neuester oben.
- Pruefungen werden woertlich benannt; "getestet" ohne Kommando ist kein Nachweis.
- Begruendungen gehoeren hierher, nicht in Commit-Titel.
- Offene Punkte bleiben stehen, bis sie erledigt oder verworfen sind.

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
  `<!-- rbd-doc: v0.3.64 | 2026-11-01 10:02 UTC -->` in sechs Pflichtdokumenten;
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
