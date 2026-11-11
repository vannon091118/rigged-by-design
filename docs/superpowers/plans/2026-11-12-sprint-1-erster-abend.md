# Sprint 1 — Der erste Abend (Umsetzung)

**Stand:** 2026-11-11 · **Basis:** `main` @ `698788d4` · **Rahmen:** Governance-Freeze aktiv
(`scripts/lib/governance-freeze.mjs`), gearbeitet wurde ausschließlich in `src/`, Tests und freien `docs/`.

## Ziel

Ein neuer Spieler startet in genau einem Modal, sieht den Raum ohne schwarze Fläche, hat ein
sichtbares Ziel — und der erste Gast ist nach 12 Ticks durch einen deterministischen Test belegt.

## Tickets und Ergebnis

| Ticket | Umsetzung | Nachweis |
|---|---|---|
| **T1 Messung** | Build, Preview, drei Messpunkte im Browser; Befund in `2026-11-12-first-run-messung.md` | Erster Gast nach 734 ms; G1 in der behaupteten Form widerlegt |
| **T2 Ein Startzustand** | `OnboardingStep` = `OPENING → CITY → CASINO → DONE`; `new-game.ts` startet mit `OPENING`; `OpeningGate` liest den Schritt statt Tick/Gäste/Historie; `finishOpening()` ist der einzige Weg nach `CITY` | `ui.test.tsx` (genau ein Modal je Schritt), `onboarding-save.test.ts` (Roundtrip, alte Saves `DONE`) |
| **T3 Kamera und Bühne** | `FloorCamera` trennt `fit` (contain, Übersicht) von `fill` (cover-Faktor); `FloorView` zeichnet einen gefliesten Bühnenhintergrund statt schwarzer Balken | `floor-camera.test.ts`; Sichtprüfung `sprint1-casino-mit-gast.png` |
| **T4 Ein sichtbares Ziel** | `src/ui/goal.ts` liefert **ein** Ziel aus dem Snapshot: `BARKAUF` (50 VC Portemonnaie), danach `MIETE` (500 VC Hauskonto); HUD zeigt Label und Balken in Stadt und Casino | `goal.test.ts` |
| **T5 Kettentest** | `first-evening.test.ts`: Eröffnung → Stadt → Casino → Automat aus der Starter-Kiste → Gast nach 12 Ticks → Spiel → Buchung → Tagesende, deterministischer Seed | 1 Test, ~0,9 s, grün |

## Gemessene Zahlen (T3)

- Canvas 828 × 717: Plan 688 px, Seitenfläche 140 px (17 %), davon **0 % schwarz** (geflieste Bühne).
- Canvas 1263 × 406: Plan 390 px; die Restfläche trägt der Hintergrund.
- Begründung: Der Plan ist quadratisch. Die Übersicht bleibt `contain`, damit kein Raumrand aus dem
  Bild fällt; die Fläche daneben ist Bühne, kein Loch. `fill` (cover) steht als Faktor bereit.

## Live-Nachweis nach dem Build

Nach einem Reload (Save mit `ensureStarter`) lief die Kette im Browser weiter: HUD „GÄSTE 3",
„GERÄTE 1/1", Hauskonto **148,40 VC** nach den ersten Spielen — Gäste wechseln, spielen und buchen,
ohne Eingriff. Der Screenshot `sprint1-casino-mit-gast.png` zeigt genau diesen Stand: geflieste Bühne
statt schwarzer Balken, ein sichtbares Ziel (`BARKAUF`), keine Startmodals.

## Befund: die zwei roten `impact-graph`-Tests

**Ursache (nicht der Sprint):** Die Fixture in `src/core/governance/__tests__/impact-graph.test.ts`
übergab dem geprüften Leser einen POSIX-Pfad, der Produktionscode ruft ihn aber mit einem
absoluten Pfad auf: `resolve('/', 'entry.mjs')` ist unter Windows **`D:\entry.mjs`**. Der
Fixture-Adapter `file.replace(/^\//, '')` fand den Eintrag dadurch nie, lieferte `[]` und der
Audit meldete folgerichtig `ok: true` statt der erwarteten Verstöße. Auf POSIX war der Test grün,
auf Windows nie.

**Beweis, dass es vorbestehend ist:** Detached-Worktree auf HEAD, ohne jede Sprint-Datei.
Der Worktree liegt im Repo, deshalb findet Node `node_modules` über den Elternpfad — kein
Link, kein Install, keine Kopie.

```bash
git worktree add --detach .verify-cache/head-baseline HEAD
cd .verify-cache/head-baseline
node ../../node_modules/vitest/vitest.mjs run --config src/Config/vite.config.ts \
  src/core/governance/__tests__/impact-graph.test.ts
cd ../..
git worktree remove --force .verify-cache/head-baseline
```

Ausgabe des Baseline-Laufs (HEAD `698788d4`, `baseline_exit=1`):

```
HEAD 698788d4 Governance: Claim-Retention und Post-Merge-Closeout
 FAIL  src/core/governance/__tests__/impact-graph.test.ts > Impact-Graph-Gate > weist einen direkten Compiler-Import im Impact-Pfad ab
AssertionError: expected true to be false // Object.is equality
 FAIL  src/core/governance/__tests__/impact-graph.test.ts > Impact-Graph-Gate > findet den Compiler auch transitiv ueber ts-ast
AssertionError: expected true to be false // Object.is equality
 Test Files  1 failed (1)
      Tests  2 failed | 1 passed (3)
```

Derselbe Test im aktuellen Baum danach: `Test Files 1 passed (1)`, `Tests 3 passed (3)`,
`current_exit=0`.

**Reparatur (ohne Erwartung zu ändern):** Die Fixture keyt jetzt relativ zu einer
aufgelösten Wurzel (`relative(resolve('/'), file)`, Slashes normalisiert) statt nach
`basename` — damit kollidieren zwei gleichnamige Dateien in verschiedenen Verzeichnissen
nicht. Relative Importe werden gegen `dirname(from)` aufgelöst, also gegen das Verzeichnis
der lesenden Datei, exakt wie `imports.mjs`. Unter POSIX ist `resolve('/')` weiterhin `/`
und `relative('/', '/entry.mjs')` weiterhin `entry.mjs`; die Fixture bleibt dort streng.

Nachweis der Treue: `git diff -U0` zeigt nur den `node:path`-Import und den
`fixture`-Adapter; die 8 `expect(...)`-Zeilen sind per `diff` gegen `git show
HEAD:…impact-graph.test.ts` **byte-identisch**; kein `skip`, `only` oder `todo`.
Der Worktree wurde danach entfernt (`git worktree list` zeigt nur `main`).

**Ergebnis nach der Reparatur:** volle Suite **300 Testdateien bestanden | 4 übersprungen,
1652 Tests bestanden | 6 übersprungen, 0 Fehler**; `typecheck` 0; `verify:light` 9/9 Gates grün.

## Abschlusslauf (finaler Baum, diese Reihenfolge, ohne Edits dazwischen)

Baum eingefroren, dann in einem Durchgang:

```bash
pnpm run typecheck
pnpm run verify:light
pnpm test
pnpm run narrative:blocks
```

Tatsächliche Ausgabe dieses Laufs:

```
=== 1/4 typecheck ===
typecheck_exit=0
=== 2/4 verify:light ===
light_exit=0
verify:light: PASS (alle Gates gruen, verify-Modus)
=== 3/4 volle Suite ===
fulltests_exit=0
 Test Files  300 passed | 4 skipped (304)
      Tests  1652 passed | 6 skipped (1658)
FAIL-Zeilen: 0
=== 4/4 narrative:blocks ===
narrative_exit=0
[narrative-blocks] 1004/1500 Bausteine; Minimum 50; ...
[narrative-blocks] PASS
```

Hinweis zur Gate-Liste: `verify:light` bedient sich am Gate-Cache. In diesem Lauf meldet es
nur die Aggregatzeile `verify:light: PASS (alle Gates gruen, verify-Modus)`; die neun
Einzelzeilen `[gate] … PASS` (docs, check:loc, test-placement, catalog, tree, impact-graph,
redundancy, typecheck, lint) erschienen im unmittelbar davor liegenden, unveränderten Lauf.
Der Exit-Code und die Aggregatzeile sind die Wahrheit, nicht die Anwesenheit der Einzelzeilen.

Read-only-Prüfungen im Anschluss: `git status --short` nennt ausschließlich Sprint-Dateien,
die Prüfung gegen die eingefrorenen Pfade ist leer, `git log --oneline -1` bleibt
`698788d4 …`, `git worktree list` zeigt nur `main`. Kein Commit, kein Push, kein PR.

Zwei zwischenzeitliche Fehlschläge in einem voll gepackten Lauf (`machine-play.test.tsx`:
`WUERFELN` nicht gefunden; `narrative-content.test.ts`: Timeout nach 20 s) hatten eine konkrete
Ursache in zu engen Zeitbudgets des Testcodes, nicht im Sprint-Diff:

- `narrative-content.test.ts` baute seine Fixture (rekursives Kopieren von 1004
  Contribution-Dateien plus Registry-Build) in einem expliziten 20-s-Budget, obwohl global 40 s
  gelten. Isoliert braucht die Datei **13,4 s und 14,5 s**; unter acht parallelen Workern reißt
  das 20-s-Budget. Jetzt 60 s, Erwartungen unverändert.
  Das Anheben allein genügte nicht: `check:loc` führt Testdateien ab 180 LOC in der Hot Zone
  (Cap 240) und verbietet Änderungen daran ohne Modularisierung — die Datei lag bei 197 LOC.
  Deshalb sind `report`, `first`, `clone`, `messages`, `schema` und `fixture` nach
  `src/core/governance/__tests__/narrative-fixture.ts` extrahiert; die Testdatei fällt damit
  unter 180 LOC, erst danach war das 60-s-Budget zulässig. Im Abschlusslauf meldet `check:loc`
  „20 Datei(en) in der Hot Zone, 0 in diesem Lauf geaendert".
- `machine-play.test.tsx` wartete 15 s auf den lazy geladenen Spieltisch (`React.lazy` mit
  `Suspense`); das Fehler-DOM zeigt den fertigen Popup-Rahmen mit Ladehinweis, also den
  Suspense-Fallback. Isoliert laufen die vier Tests in **2,9 s**. Jetzt 30 s Wartebudget,
  Erwartungen unverändert.

Kein `skip`, kein `only`, keine gelöschte Zusicherung. Der zitierte Abschlusslauf ist damit
belastbar und nicht nur der glückliche von zwei Versuchen.

## Übernahme von `origin/main` (6e5ea00b)

Nach dem Sprint-Abschluss lag `lane/governance/local-first-ci` nicht mehr als Branch vor — die
Arbeit war als PR #466 („Local-first CI/CD: PR-only Pflichtjob mit Debug-APK und Release-Bump")
bereits gemergt. `origin/main` stand damit zwei Commits vor dem Sprint-Basisstand:
`698788d4` → `22586ba2` (#465 Actions-Speicher) → `6e5ea00b` (#466).

Übernahme ohne Commit: `git stash push -u`, `git merge --ff-only origin/main`, `git stash pop`.
Nur `docs/INVENTORY.md` überlappte; der Pop lief konfliktfrei, die Inventur wurde mit
`pnpm run catalog` neu erzeugt (311 Dateien, 297 lokal, 14 an CI delegiert). Die eingefrorenen
Pfade sind gegenüber dem neuen HEAD unverändert, weil ihre Änderungen aus dem gemergten
Upstream-Commit stammen und nicht aus diesem Arbeitsbaum.

Der übernommene Stand ersetzt den Cloud-Vollauf durch lokale Profile: `verify:fast`
(Light + Testqualität + betroffene Tests + Build) und `verify:integration` als Vor-PR-Nachweis,
`verify:long` nur auf Anforderung, dazu `docs/LOCAL_CI.md` und Version 0.3.229.

Verifikation auf `6e5ea00b`: `typecheck` 0, `verify:light` 9/9 Gates grün, volle Suite
**300 Dateien / 1652 Tests bestanden, 4 Dateien / 6 Tests übersprungen, 0 Fehler**,
`narrative:blocks` PASS, `verify:fast` PASS (`test-quality` 7,2 s, `build` 10,0 s,
`affected` 67,0 s). HEAD bleibt `6e5ea00b`; kein Commit, kein Push, kein PR.

## Bewusst nicht getan

- Keine Governance-Pfade angefasst (`scripts/`, `.github/`, `.lane-claims/`, Governancedokus).
- Keine Narrative-Löschung (Schrumpf-Schutz), kein Screenshot-Gate (Playwright nicht installiert,
  Skripte gesperrt), keine Merge Queue, keine Lanes auf Labels.
- Kein Commit, kein Push, kein PR: die Lieferung läuft über den normalen Lane-/Promote-Pfad.
  **Hinweis:** `verify-narrative-blocks --commit` verlangt für einen Commit mit `src/`-Änderung
  einen neuen Textbaustein; der ist hier noch nicht angelegt.
