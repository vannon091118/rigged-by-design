# Devtagebuch

Chronologisch, ehrlich, mit offenen Enden. Jeder Eintrag nennt Datum, Ziel,
Umsetzung, Pruefungen und was bewusst nicht getan wurde.

## Regeln

- Ein Eintrag pro Arbeitstag oder pro abgeschlossenem Auftrag, neuester oben.
- Pruefungen werden woertlich benannt; "getestet" ohne Kommando ist kein Nachweis.
- Begruendungen gehoeren hierher, nicht in Commit-Titel.
- Offene Punkte bleiben stehen, bis sie erledigt oder verworfen sind.

## 2026-11-01 - Tree-Gate, Redundanz-Gate und Doc-Generierung

**Ziel.** Tree-Gate, Redundanz-Gate und Doc-Generierung

**Umsetzung.** Offen.

**Pruefungen.** Offen.

**Offen.** Offen.

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
  `<!-- rbd-doc: v0.3.64 | 2026-11-01 09:35 UTC -->` in sechs Pflichtdokumenten;
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
