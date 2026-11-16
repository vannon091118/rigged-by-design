# LOC-, Redundanz- und Sinnvollkeits-Audit 2026-11-16

Grundlage: `main` = `27abd7a5`, `verify:light` PASS. Gemessen mit den Repo-Gates,
einem eigenen Zeilen-/Ähnlichkeitsscan (`node /tmp/analyze.mjs`, Heuristik:
normalisierte Funktionsrümpfe + Zeilen-Jaccard) und manuellen Reads der größten
und verantwortungsgemischten Dateien.

## 1. Gemessene Ausgangslage

| Bereich | Dateien | Zeilen | Dateien >160 | Testanteil |
| --- | --- | --- | --- | --- |
| `src/` | 1085 | 102 953 | 142 | 43 748 (42 %) |
| `scripts/` | 150 | 23 038 | 44 | 0 |

Verteilung über `src/`: 48 Dateien ≤20 Zeilen, 239 mit 21–50, 401 mit 51–100,
361 mit 101–160, 186 über 160.

Gate-Stand:

| Gate | Ergebnis |
| --- | --- |
| `verify:light` | PASS |
| `verify:tree` | PASS |
| `verify:redundancy` | PASS (1269 Dateien, 90 Skripte, 37 Codes) |
| `verify:test-quality` | **7 Verstöße** |
| `check:loc` | PASS, **0** Dateien in der Hot Zone |

Wer das für „keine Redundanz" hält, irrt: `verify:redundancy` prüft Dateinamen,
Skript-Duplikate und Fehlercodes — **nicht** Codeähnlichkeit. Der eigene Scan
findet 257 Dateipaare mit Zeilenüberschneidung > 0,30.

## 2. Befunde

### F1 — Das LOC-Budget deckt nur `src/`, nicht `scripts/`

`scripts/loc-budgets.mjs` enthält 10 Einträge für `src/` und **null** für
`scripts/`. Damit ist der am schnellsten wachsende Teil des Repos ungebremst:

```
pretask.mjs        910
promote.mjs        699
agent-start.mjs    665
lane-claims.mjs    664
turn-push.mjs      586
claim-register.mjs 497
agent-cause.mjs    493
narrative-content  487
verify-lane-claims 457
claim-evidence.mjs 455
```

Das ist kein Nebenschauplatz: 23 038 Zeilen Governance-Tooling ohne Cap, ohne
Hot Zone und ohne Testanteil. Der Cap für `src/` ist damit eine halbe Regel.

### F2 — Acht Render-Stages sind Kopien desselben Bootstraps

`src/render/games/*-stage.tsx` (8 Dateien, je 40–55 Zeilen) enthalten identisch:

```
new Application() · WebGL-Probe · app.init({ resizeTo, antialias, ... })
ResizeObserver · cancelled-Flag · destroy-Pfad · div role="img"
```

Die Zeile `void app.init({ resizeTo: element, antialias: true, backgroundAlpha: 0,
resolution: Math.min(2, window.devicePixelRatio || 1), autoDensity: true })`
steht **achtmal wortgleich** im Repo. Jaccard zwischen den Paaren: 0,58–0,70.
Ein Fehler im Teardown muss heute achtmal gepatcht werden.

### F3 — Weitere Ähnlichkeitscluster

| Paar | Jaccard | Bewertung |
| --- | --- | --- |
| `smartphone-build.tsx` ~ `smartphone-buy.tsx` | 0,60 | gleiche Listen-/Kaufstruktur, zwei Zuständigkeiten |
| `round-rtp-high.test.ts` ~ `round-rtp-machines.test.ts` | 0,76 | Testaufbau doppelt |
| `anger-decay.test.ts` ~ `anger-patience.test.ts` | 0,65 | gleiche Fixture |
| `pretask-blocked-issues.test.ts` ~ `pretask-takeover.test.ts` | 0,60 | gleiche `gh`-Stubs |

### F4 — Identische Funktionsrümpfe in `scripts/lib`

`readIdentityFile` und `readDependencyFile` in `workspace-home.mjs` haben
byte-gleiche Rümpfe nach Normalisierung. Zwei Namen, eine Regel.

### F5 — `pretask.mjs` mischt elf Verantwortungen in einem Top-Level-Fluss

Der Read zeigt in einer Datei: Argumente parsen, Identität auflösen, Actor-Policy
laden, Git-Wrapper (`run`, `gitStrict`, `runOk`, `isAncestor`), Basis-Refresh,
Claim-Register laden, Issue-Board lesen, Impact-Plan bauen, Reconcile planen,
Worktrees aufräumen, Takeover/Isolation bewerten, Laufbudget prüfen, Worker-
Bootstrap, und drei Ausgabeformate (`--brief`, `--json`, Text). Nur drei
Funktionen sind ausgelagert (`reservedIdentity`, `readIssues`, `classifyIssue`).
Das ist genau die „gemischte Logik in einer Datei", die das Ziel ausschließt —
und sie liegt außerhalb jedes Gates.

### F6 — `world-store.ts` ist bereits entkernt, aber die Regel greift zu spät

Nach der 537-Integration liegt der Store bei 166 Zeilen mit Ein-Zeilen-
Delegationen (`setLook`, `buyClothing`, `businessWork`, `workBusiness`). Das ist
die richtige Form — aber sie entstand erst, als `check:loc` rot wurde. Die Regel
sanktioniert Umbau, statt ihn zu erzwingen.

### F7 — Testqualität ist rot, während alles andere grün ist

```
ERR-4001  merge-queue-next-action.test.ts · merge-queue.test.ts
          webhook-action.test.ts · webhook-receiver.test.ts
          webhook-signature.test.ts      → Code ERR-4029 nicht im Katalog
ERR-4002  webhook-receiver.test.ts       → kein Import aus scripts/webhook-receiver.mjs
ERR-4001  image-diff-gate.test.ts        → @error-code fehlt
```

Die Webhook-Tests sind mit dem Merge `27abd7a5` hereingekommen; `image-diff-gate`
ist meine eigene Wiederherstellung, deren Kopfzeile beim Verschieben unvollständig
blieb. `verify:light` fängt das nicht, weil `verify:test-quality` nicht dazugehört.

### F8 — Hot Zone ist eine Momentaufnahme, kein Trend

`check:loc` markiert nur Dateien, die **in diesem Lauf** geändert wurden und über
der Hot Zone liegen. Eine Datei darf also jahrelang bei 199/200 stehen, solange
niemand sie anfasst. Es gibt keine Wachstumsbremse und keinen Export-Cap:
`types-model.ts` führt 41 Exporte, `money.ts` 29, `world.ts`/`player-look.ts`/
`city-model.ts` je 17.

## 3. Neue Cap-Empfehlung

Prinzip: **Cap pro Verantwortung, nicht pro Ordner**, und Rollen auch für
`scripts/`. Hot Zone bei 60 % des Caps statt 4/7 (57 %), damit Umbau früher
beginnt.

| Rolle | Pfad | Cap | Hot Zone | Begründung |
| --- | --- | --- | --- | --- |
| `cli` | `scripts/*.mjs` | 120 | 72 | ein Einstieg, ein Ablauf |
| `pipeline` | `scripts/lib/*.mjs` | 250 | 150 | eine Regel, viele Aufrufer |
| `engine` | `src/core/**` | 200 | 120 | unverändert |
| `state` | `src/store/**` | 220 | 132 | unverändert |
| `render` | `src/render/**` | 200 | 120 | von 260 gesenkt: Stages sind Brücken |
| `ui` | `src/ui/**` | 200 | 120 | unverändert |
| `test` | `**/__tests__/**` | 240 | 144 | unverändert |
| `types` | `**/types*.ts` | 180 | 108 | **neu**: reine Typen, keine Logik |

Migrationsschuld statt Sofortbruch: Dateien über dem neuen Cap kommen mit
aktuellem Stand in eine `LEGACY_LOC`-Liste, die **nur schrumpfen darf**
(Gate: Eintrag entfernen, sobald Datei ≤ Hot Zone). Neue Einträge sind verboten —
dieselbe Mechanik, die `loc-budgets.mjs` heute schon für `src/` kennt.

Sofort betroffen (über neuem Cap, noch ohne Eintrag): die zehn Skripte aus F1.

## 4. Rearchitecture-Plan

Reihenfolge nach Risiko, nicht nach Größe. Jede Phase endet mit `verify:light`
grün und einer messbaren Zeilenzahl.

### P0 — Testqualität reparieren (sofort, ~30 min)

- `@error-code`-Kopf in `image-diff-gate.test.ts` ergänzen.
- `ERR-4029` im Fehlerkatalog registrieren oder die fünf Tests auf einen
  katalogisierten Code ziehen.
- `webhook-receiver.test.ts` importiert das Ziel aus `scripts/` — Import
  nachziehen oder Test in `scripts/`-Nähe verschieben.
- **Abnahme:** `verify:test-quality` PASS, `verify:light` PASS.

### P1 — Budgets auf `scripts/` ausdehnen (klein, hohe Wirkung)

- `loc-budgets.mjs`: Rollen `cli` und `pipeline` ergänzen, `check:loc` über
  `scripts/` laufen lassen.
- Alle 44 Dateien >160 als Migrationsschuld eintragen (Stand heute), Ziel: keiner
  dieser Einträge bleibt in 2026.
- **Abnahme:** `check:loc` prüft `scripts/`; kein neuer Eintrag möglich; Gate grün.

### P2 — `PixiStage`-Primitive (F2)

- Ein Hook `<PixiStage canvasFactory={...} layout={...}>` mit WebGL-Probe,
  ResizeObserver, Teardown.
- Acht `*-stage.tsx` behalten nur ihren Handle-Typ und die Render-Delegation.
- **Abnahme:** `app.init(...)`-Zeile existiert einmal; 8 Dateien ≤ 25 Zeilen;
  `small-screen-acceptance` und die Stage-Tests bleiben grün.
- **Erwartete Einsparung:** ~250 Zeilen, 7 duplizierte Teardown-Pfade.

### P3 — `pretask.mjs` entflechten (F5)

Fünf Module, je eine Verantwortung:

| Modul | Inhalt | Zielgröße |
| --- | --- | --- |
| `lib/pretask-input.mjs` | argv, Env, Identität, Actor-Policy | ≤ 120 |
| `lib/pretask-board.mjs` | Issue-Lesen, Klassifikation, Follow-up | ≤ 200 |
| `lib/pretask-lane.mjs` | Claims, Task-Vertrag, Worktrees, Takeover, Isolation | ≤ 200 |
| `lib/pretask-budget.mjs` | Impact-Plan, Laufbudget, Worker-Bootstrap | ≤ 150 |
| `pretask.mjs` | Orchestrierung + drei Ausgabeformate | ≤ 150 |

- **Abnahme:** `pretask --json` liefert dasselbe Schema (Fixture-Vergleich vor/nach),
  `src/core/governance/__tests__/pretask-*.test.ts` grün.
- **Erwartete Einsparung:** ~910 → ≤ 820 gesamt, aber kein Block über 200.

### P4 — Governance-Skripte zweiter Stufe

`promote.mjs` (699) und `agent-start.mjs` (665) nach demselben Muster trennen:
Board-Lesen, Autorisation, Ausgabe. `lane-claims.mjs` (664) ist heute eine
Konstanten- und Regeldatei — in `lane-rules` (Konstanten) und `lane-eval`
(Prüfungen) teilen.

### P5 — Semantisches Duplikat-Gate

`verify:redundancy` um eine Ähnlichkeitsstufe erweitern:

- Zeilen-Jaccard pro Dateipaar, Schwelle 0,55 (heute höchster ungewollter Wert:
  0,76 bei Tests, 0,70 bei Stages).
- Baseline-Datei mit den heute akzeptierten Paaren; neue Paare schlagen fehl.
- Ausnahmen brauchen einen Grund im Baseline-Eintrag.

Das ist die Lücke aus F7/F2: ohne dieses Gate wächst Duplikation unbemerkt, weil
`verify:redundancy` heute nur Namen und Codes prüft.

### P6 — Export-Cap statt nur Zeilen-Cap

Neue Regel in `check:loc`: mehr als 20 Top-Level-Exporte pro Datei ⇒ Hinweis,
mehr als 30 ⇒ Verstoß. Betroffen: `types-model.ts` (41). Reine Typdateien sind
davon ausgenommen, wenn sie nur `type`/`interface` exportieren.

## 5. Was ich ausdrücklich nicht vorschlage

- **Kein Massen-Umbau der 186 Dateien >160.** Die Verteilung ist gesund: der
  Median liegt bei 51–100 Zeilen, und die 16 vormals heißen Dateien sind heute
  unter Budget.
- **Keine Zusammenlegung der kleinen `src/core/sim`-Dateien.** Viele davon sind
  Ein-Zweck-Module mit 7–20 Zeilen; Zusammenlegen würde Verantwortlichkeiten
  mischen — genau das Gegenteil des Ziels.
- **Kein Test-Zusammenbau über Clustergrenzen.** Die Ähnlichkeit in
  `__tests__` ist Fixture-Wiederholung; dort hilft eine gemeinsame Fixture,
  nicht das Löschen von Tests (42 % Testanteil ist kein Problem, sondern Polster).

## 6. Messbare Zielwerte nach dem Plan

| Kennzahl | heute | Ziel |
| --- | --- | --- |
| Dateien über ihrem Cap | 0 in `src`, 44 in `scripts` (unbudgetiert) | 0 in beiden |
| `pretask.mjs` | 910 | ≤ 150, Gesamtpaket ≤ 820 |
| `app.init(...)`-Vorkommen | 8 | 1 |
| Dateipaare > 0,55 Jaccard ohne Baseline-Eintrag | 257 ungeprüft | 0 ungeprüft |
| `verify:test-quality` | 7 Verstöße | 0 |
| Größte Datei in `src/render` | 200 (Cap 260) | ≤ 120 nach P2-Umbau der Stages |

## 7. Reproduktion

```bash
RBD_VERBOSE=1 node scripts/check-loc.mjs          # Verteilung, Hot Zone
pnpm run verify:redundancy                        # was das Gate heute prüft
pnpm run verify:test-quality                      # 7 Verstöße
node /tmp/analyze.mjs                             # Ähnlichkeitspaare, Buckets
git ls-files 'src/render/games/*-stage.tsx' | xargs grep -c "new Application()"
```
