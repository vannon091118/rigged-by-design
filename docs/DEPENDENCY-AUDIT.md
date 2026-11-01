# Dependency-Audit (Stand 31.10.2026)

Systematische Prüfung aller direkten und transitiven Abhängigkeiten. Grundlage sind
das echte Lockfile (`package-lock.json`, Lockfile-Version 3), die realen Imports im
Code, ein Production-Build, ein Lint-Lauf mit und ohne Typinformation sowie aktuelle
Paket- und Advisory-Daten. Die Entscheidungsmatrix steht in Abschnitt 6, die
Umsetzungsreihenfolge in Abschnitt 7.

## Methode und Grenzen

Gemessen wurde lokal (Windows, Node 26.12.1, 373 installierte Pakete):

- Imports über den TypeScript-AST aus `src/`, `scripts/`, `src/Config/vite.config.ts`, `src/Config/eslint.config.mjs`; keine Suche nach Namensgleichheit in Strings.
- Bundlegröße aus einem frischen `pnpm run build` (17,7 s), Größen roh und gzip Level 9.
- Lint-Zeit mit `eslint . --no-cache` gegen die echte Config und gegen eine Kopie ohne `projectService`.
- Installationsgröße je Paket rekursiv aus `node_modules`.

Grenzen, die dieser Bericht offenlegt statt verdeckt:

- `pnpm audit` meldet **0 Schwachstellen**. Das ist kein Sicherheitsnachweis: die Advisory-Datenbank deckt nicht jede Linie ab, und mehrere der unten genannten Lücken haben für Vite 6 gar keine gepatchte Version.
- Einige Advisory-Details (Fixed-Versionen von CVE-2026-112945/-112946/-112947, CVE-2026-118662, `glob`-CLI GHSA-5j98-mcp5-4vw2) waren nicht bis zur Detailseite verifizierbar; sie sind als offen markiert.
- Android-Verhalten (`cap sync`, Gradle) wurde nicht ausgeführt: lokal fehlt das SDK, der Nachweis läuft in CI.

## 1. Bestandsaufnahme

### 1.1 Umfang

| Kennzahl | Wert |
| --- | --- |
| Pakete im Lockfile (installiert) | 373 |
| davon Runtime (`dev: false`) | 15 |
| davon Entwicklung/Build/Test | 358 |
| `node_modules` gesamt | 216,2 MB |
| Direkte Dependencies | 3 Runtime, 19 Dev |
| Mehrfachversionen (gleicher Name, mehrere Versionen) | 12, davon relevant nur `semver` (6.3.1 und 7.8.5) |
| Installationsskripte | `esbuild@0.25.12`, `fsevents@2.3.3` |

Lizenzen (alle permissiv, keine Copyleft-Pflicht): MIT 298, ISC 22, Apache-2.0 19,
BlueOak-1.0.0 14 (`minimatch`, `glob`), BSD-2-Clause 8, BSD-3-Clause 5, MIT-0 2,
Unlicense 2, CC-BY-4.0 1 (`caniuse-lite`-Daten), CC0-1.0 1, 0BSD 1. Kein
Lizenzrisiko für die Distribution der Web-App oder der APK.

### 1.2 Direkte Dependencies mit realem Nutzungsnachweis

| Paket | Version | Rolle | Realer Nachweis |
| --- | --- | --- | --- |
| `pixi.js` | 8.22.0 | Runtime, Rendering | 34 Dateien, u. a. `src/render/floor-view.ts`, `src/render/comic-bubbles.ts` |
| `react` | 19.3.1 | Runtime, UI | 30 Dateien, u. a. `src/App.tsx`, `src/render/floor-stage.tsx` |
| `react-dom` | 19.3.1 | Runtime, Mount | 1 Datei: `src/main.tsx` |
| `vite` | 6.4.5 | Build/Dev-Server | Konfiguration + `pnpm run dev`/`build` |
| `vitest` | 5.0.5 | Test | 87 Testdateien importieren `vitest` |
| `typescript` | 5.9.3 | Typen/Build | `tsc --noEmit`, `scripts/lib/ts-ast.mjs` |
| `eslint` | 10.13.0 | Lint | `src/Config/eslint.config.mjs`, `pnpm run lint` |
| `typescript-eslint` | 8.72.1 | Lint (TS-Parser) | `src/Config/eslint.config.mjs` |
| `@eslint/js` | 10.0.1 | Lint (Basisregeln) | `src/Config/eslint.config.mjs` |
| `globals` | 16.5.0 | Lint (Globals) | `src/Config/eslint.config.mjs` |
| `@vitejs/plugin-react` | 4.7.0 | Build (Fast Refresh/JSX) | `src/Config/vite.config.ts` |
| `jsdom` | 30.1.3 | Test-DOM | `@vitest-environment jsdom` in `src/ui/__tests__/ui.test.tsx` und `card-tables.test.tsx` |
| `@testing-library/react` | 16.3.3 | Test-UI | dieselben zwei UI-Tests |
| `yaml` | 2.9.1 | Test (Workflow-Struktur) | `src/core/governance/__tests__/ci-gates.test.ts` |
| `@types/node` | 26.6.6 | Typen | `src/Config/tsconfig.json` (`types`), Node-Builtins in `scripts/` |
| `@types/react`, `@types/react-dom` | 19.x | Typen | implizit über React-Imports |
| `@capacitor/cli` | 8.6.0 | Android-Build | `scripts/prepare-android.mjs` (`npx cap add/sync`) |
| `@capacitor/android` | 8.6.0 | Android-Plattform | `cap add android`, Gradle |
| `@capacitor/core` | 8.6.0 | Android-Bridge | **kein Import im Code**, nur als Peer der CLI gepinnt |

Damit ist die Matrix aus `docs/ARCHITECTURE.md` in einem Punkt zu optimistisch:
`@capacitor/core` wird von keiner Anwendungsdatei importiert. Es steht nur da, weil
`prepare-android.mjs` es als gepinnten Vertrag prüft und `cap sync` die Paketfamilie
erwartet. Ob die CLI ohne `core` läuft, ist **nicht belegt** und gehört in einen
eigenen Android-CI-Lauf, nicht in eine Vermutung.

### 1.3 Transitive Struktur und Overrides

Die beiden `overrides` sind keine Kosmetik, sondern erzwingen Majors gegen die
deklarierten Bereiche der Eltern:

| Override | Wer will was | Installiert | Bewertung |
| --- | --- | --- | --- |
| `minimatch: ^11.0.1` | `eslint` will `^10.2.5`, `@eslint/config-array` `^10.2.4`, `typescript-estree` `^10.2.2` | 11.0.3 | **außerhalb der Elternbereiche**. Sicherheitsgrund: GHSA-g3hv-75wg-m249 (globparts-Amplification) betrifft alle Versionen < 11.0.1, also auch 10.2.6. Der Override ist deshalb richtig, aber er ist ein bewusster Support-Verzicht und muss bei jedem ESLint-Upgrade neu geprüft werden. |
| `glob: ^14.0.3` | `@capacitor/cli → rimraf@6` will `^13.0.3` | 14.0.3 | **außerhalb des Elternbereichs**. Sicherheitsgrund: GHSA-3g3m-2fjr-6pw4 (AbortSignal-Bypass) ist erst ab 14.0.2 gefixt, 13.x ist betroffen. Genutzt nur beim Android-Sync; Risiko begrenzt, aber `rimraf` ist dann ungetestet gegen glob 14. |

Glob-Welten gibt es drei: `tinyglobby` (über Vite/Vitest/typescript-estree),
`glob`/`minimatch` (nur über Capacitor/rimraf/ESLint) und den eigenen `walk()` in
`scripts/lib/report.mjs` (10 Zeilen, ohne Pattern). Die eigenen Gates brauchen kein
Glob-Paket.

## 2. Sicherheit und Zuverlässigkeit

### 2.1 Advisories gegen die installierten Versionen

| Paket | Installiert | Lage | Einstufung |
| --- | --- | --- | --- |
| `vite` | 6.4.5 | 6.x bekommt nur noch Security-Backports; die späteren `server.fs.deny`-Bypässe sind in 7.3.2 / 8.0.5 gefixt. Für 6.x ist kein Fix veröffentlicht. | **Real ausnutzbar**, sobald der Dev-Server erreichbar ist (siehe 2.2) |
| `@vitejs/plugin-react` | 4.7.0 | Kein Advisory, aber Major 4 ist abgekündigt; Nachfolger 6 nutzt Oxc statt Babel. | Wartungsrisiko |
| `vitest` | 5.0.5 | Genau die Version, die CVE-2026-112948 (Server ignoriert `server.fs.deny`) schließt; ältere 5.0.x sind betroffen. | **Behoben**, aber am unteren Rand |
| `@capacitor/*` | 8.6.0 | CVE-2026-103922 (Critical, WebView-Navigation → Same-Origin-Script + Plugin-Zugriff) ist ab 8.5.1 gefixt. | **Behoben** |
| `yaml` | 2.9.1 | CVE-2026-33532 (Stack Overflow bei tiefer Verschachtelung) ist ab 2.8.3 gefixt. | **Behoben** (nur Testcode) |
| `minimatch` | 11.0.3 | Alle vier ReDoS-/Amplification-Advisories sind ab 11.0.1 geschlossen. | **Behoben** |
| `glob` | 14.0.3 | GHSA-3g3m-2fjr-6pw4 ab 14.0.2 geschlossen. | **Behoben** |
| `picomatch` | 4.0.7 | CVE-2026-33671 (ReDoS) ab 4.0.4 geschlossen. | **Behoben** |
| `brace-expansion` | 5.0.12 | Keine offene Lücke in dieser Linie. | unauffällig |
| `jsdom` | 30.1.3 | Keine bekannten Advisories. | unauffällig |
| `eslint` | 10.13.0 | CVE-2025-50537 wurde zurückgezogen (nur `RuleTester`); 10.14.0 hebt transitiv `minimatch` an. | Wartung, kein Risiko |

`pnpm audit --audit-level=low` bleibt grün, obwohl Vite 6 ungepatchte Bypässe hat. Das
ist der wichtigste Beleg dafür, dass ein grünes Audit-Gate kein Sicherheitsnachweis
ist: der Advisory-Bereich endet bei den gepatchten Majors.

### 2.2 Praktisch ausnutzbar: Dev-Server auf `0.0.0.0`

`src/Config/vite.config.ts` setzt `server.host: '0.0.0.0'`. Alle `server.fs`-Bypässe setzen
einen erreichbaren Dev-Server voraus. Auf einem Laptop im selben WLAN ist damit
`.env`, `/proc/*/environ` oder jeder Pfad außerhalb `server.fs.allow` lesbar — genau
die Dateien, die die Advisories beschreiben. Die Bindung ist für Cloud-Previews
bequem, aber sie ist der Unterschied zwischen „theoretisch" und „ausnutzbar".

Empfehlung: Standard `localhost`, Opt-in über `RBD_DEV_HOST=0.0.0.0` nur dort, wo
eine Preview den Zugriff braucht.

### 2.3 Übrige Risiken

- **Node-Drift:** `package.json` hat kein `engines` und keinen `packageManager`.
  CI nutzt Node 22, lokal läuft 26.12.1, `jsdom` 30 verlangt `^22.22.2 || ^24.15 || >=26`.
  Ohne `engines` ist das eine stille Annahme, kein Vertrag.
- **Typen vs. Laufzeit:** `@types/node` 26 beschreibt APIs, die auf Node 22 in CI
  fehlen können. Sauber wäre `@types/node` passend zur niedrigsten unterstützten
  Runtime (22) oder ein angehobenes CI-Minimum.
- **Supply Chain:** nur zwei Installationsskripte (`esbuild`, `fsevents`), beide
  etabliert. Kein `postinstall` im eigenen Paket, keine `curl | sh`-Muster.
- **Bus-Factor:** Vite/Rolldown, ESLint, Vitest und Capacitor sind alle
  Mehrpersonen-Projekte mit Firma dahinter. Das größte Einzelrisiko ist nicht ein
  Paket, sondern die **Kopplung** Vite ↔ Vitest ↔ typescript-eslint ↔ TypeScript.

## 3. Nutzen, Kosten und Konsolidierung

### 3.1 Gemessene Kosten

| Messung | Wert |
| --- | --- |
| Production-Build | 17,7 s, Bundle 1.145 kB roh / 351 kB gzip |
| Größter Chunk | `index-*.js` 856 kB roh / 274,5 kB gzip (Vite warnt > 500 kB) |
| Lint mit `projectService` | 18 s ohne Cache |
| Lint ohne `projectService` | 10 s ohne Cache |
| Installationsgröße `pixi.js` | 72,7 MB (größter Einzelposten) |
| `typescript` | 22,5 MB (Compiler + lib) |
| `esbuild`-Familie | 27 Pakete, 10,3 MB |
| `@babel`-Familie (nur `plugin-react` 4) | 20 Pakete, 8,1 MB |
| `jsdom`-Kette | 6 Pakete, 25,1 MB |
| `@capacitor`-Familie | 4 Pakete, 1,9 MB |

Befund zum Lint: `parserOptions.projectService: true` baut ein TypeScript-Programm
auf, aber die Config nutzt nur `tseslint.configs.recommended` — **keine einzige
typbewusste Regel** ist aktiv. Die 8 s Differenz sind reiner Aufwand ohne Gegenwert,
solange keine `recommendedTypeChecked`-Regeln laufen.

### 3.2 Konsolidierungsoptionen

| Option | Gewinn | Preis | Bewertung |
| --- | --- | --- | --- |
| Vite 6 → 8 (Rolldown + Oxc) | Build deutlich schneller (Herstellerangabe 10–30×), `esbuild` entfällt (−27 Pakete, −10,3 MB) | + Rolldown/Lightning CSS (~15 MB), `manualChunks` → `advancedChunks`, Plugin-Kompatibilität, 8 % größerer Bundle in einem offenen Issue | **Ja, in zwei Schritten** (7.3.2 → 8.3.5), nicht direkt 6 → 8 |
| `@vitejs/plugin-react` 4 → 6 | Babel-Familie entfällt (−20 Pakete, −8,1 MB), Oxc-Transform | Peer verlangt Vite 8; React-Compiler nur per Opt-in | **Ja, zusammen mit Vite 8** |
| Vitest 5 behalten | jsdom nativ, `vi.*`-API vollständig, `@vitest-environment` pro Datei | Keine | **Behalten**; nach Vite 8 auf Peer-Kompatibilität erneut prüfen |
| Oxlint + tsgolint statt ESLint | echte TS-Typen, 59/61 typbewusste Regeln, 12–18× schneller | verlangt TypeScript 7 (blockiert durch typescript-eslint), zusätzliches Go-Binary, `eslint-plugin-*`-Kompatibilität noch Alpha | **Prüfen, aber erst nach der TS-Frage** |
| Biome statt ESLint | sehr schnell, Formatter + Linter in einem | eigene Inference statt TS-Compiler, ~75 % Recall bei Floating Promises, `no-unsafe-*` fehlt, keine ESLint-Plugins | **Nein** als Vollersatz; höchstens Formatter |
| Bun als Paketmanager | schnellere Installation, `bun ci` fail-closed | neues Lockfile-Format, Downstream-Tools erwarten `package-lock.json` | **Nein** derzeit: CI, Actions-Cache und Gates hängen an pnpm |
| Bun als Testrunner | schneller Start | jsdom nicht offiziell (nur happy-dom), `vi.hoisted`/`importActual`/`stubEnv` fehlen, Mock-Leaks zwischen Dateien | **Nein**: 87 Testdateien, viele mit `vi`-Features |
| `jsdom` → `happy-dom` | kleinere Installation | Fidelity-Verlust bei CSS/Layout; die zwei UI-Tests prüfen echte DOM-Semantik | **Nein, höchstens später messen** |

## 4. Eigenimplementierung gegen externe Dependency

| Funktion | Heute | Bewertung |
| --- | --- | --- |
| RNG (`Prng`), gewichtete Verteilung, Kartenschuh | eigen | **Richtig eigen.** Deterministische Spielbarkeit ist Kern der Simulation, ein generischer PRNG wäre nicht reproduzierbar über Save/Load. |
| Geld (Mikro-Einheiten), Ledger, Journal | eigen | **Richtig eigen.** Invarianten, Buchungslinien und Save-Migration sind projektspezifisch; keine Bibliothek modelliert „kein Geld außer über `EXTERNAL_WORLD`". |
| Physik (Bewegung, Pfadfindung, Grid) | eigen | **Richtig eigen.** Kleine, testbare Modelle ohne Kollisions-Engine; eine Physikbibliothek wäre größer als das Problem. |
| RTP-/Handverteilungs-Modelle | eigen | **Richtig eigen.** Das ist der fachliche Kern; hier wäre jede Fremdimplementierung ein Beweisverlust. |
| Bundler, Dev-Server, HMR | Vite | **Nicht eigen.** Ein eigener Bundler ist Monate Arbeit und ein Sicherheitsrisiko (siehe Dev-Server-Advisories). |
| Testrunner, DOM-Emulation, CSS-Selektor | Vitest, jsdom | **Nicht eigen.** jsdom ist Best-Effort, aber die einzige sinnvolle Wahl ohne echten Browser. |
| YAML-Parser für Workflow-Tests | `yaml` | **Nicht eigen.** Ein handgeschriebener YAML-Parser wäre genau die Fehlerquelle, die der Test finden soll. |
| Datei-Walk (`walk()`) | eigen, 10 Zeilen | **Richtig eigen.** Kein Pattern-Matching nötig; `tinyglobby`/`glob` wären mehr API als Nutzen. |
| Versionsbump, Commit-Gate, Dependency-Matrix, Testkatalog | eigen | **Richtig eigen.** Das sind Governance-Regeln dieses Repos, keine generischen Werkzeuge. |
| ESLint-Regelsatz | `@eslint/js` + `typescript-eslint` | **Nicht eigen.** Eigene Regeln wären Wartung ohne Nutzen; die vorhandenen Gates (`verify-test-quality`, `verify-dead-code`) decken die projektspezifischen Fälle bereits ab. |

Die Trennlinie ist konsistent: **Spiel- und Geld-Semantik eigen, Infrastruktur
zugekauft.** Der Audit fand keine Stelle, an der eine Bibliothek durch Eigencode
ersetzt werden sollte — und keine Eigenimplementierung, die eine Bibliothek ersetzt,
die sie nicht ersetzen kann.

## 5. Prüfbereiche im Detail

1. **Vite 6.4.5 / plugin-react 4.7.0:** Soft-EOL und abgekündigt. Migrationspfad
   6 → 7.3.2 → 8.3.5, plugin-react 4 → 5 → 6 (5 läuft noch mit Vite 8, 6 nutzt Oxc).
   Vite 8 verlangt Node ≥ 22.12, `manualChunks` ist deprecated.
2. **Vitest 5:** kompatibel mit Vite 6.4/7/8 (Peer `^6.4 || ^7 || ^8`). Nach dem
   Vite-Upgrade ist keine Vitest-Migration nötig; die 5.0.5-Untergrenze ist wegen
   CVE-2026-112948 Pflicht.
3. **`glob`/`minimatch`-Overrides:** siehe 1.3. Beide sind sicherheitsmotiviert und
   außerhalb der Elternbereiche; ESLint 10.14.0 verlangt `minimatch ^10.2.6`, was
   die globparts-Lücke **nicht** schließt — der Override bleibt also nötig.
4. **Dev-Server `0.0.0.0`:** siehe 2.2. Sicherheitsrelevant, nicht kosmetisch.
5. **Node 22 und `@types/node` 26:** Typen sind zwei Majors vor der CI-Runtime.
   Entweder CI auf 26 heben oder Typen auf 22 zurücknehmen; ohne `engines` ist beides
   unsichtbar.
6. **Capacitor:** 1,9 MB, vier Pakete, aktuell und gepatcht. `@capacitor/core` hat
   keinen Code-Import; die Abhängigkeit ist ein CLI-Vertrag, kein Runtime-Bedarf.
   Nutzen klar begrenzt auf APK-Bau, kein unnötiger Ballast.
7. **jsdom, Testing Library, Vitest:** keine Überschneidung. Testing Library ist die
   einzige sinnvolle Abstraktion über jsdom für React; Vitest liefert die Umgebung.
   Die Kette kostet 25,1 MB, davon der größte Teil CSS-Selektor und Parser — das ist
   der Preis für echte DOM-Tests ohne Browser.
8. **ESLint / typescript-eslint:** funktioniert, aber ohne typbewusste Regeln.
   Zwei ehrliche Optionen: `recommendedTypeChecked` aktivieren (mehr Nutzen, mehr
   Zeit) oder `projectService` entfernen (18 s → 10 s, gleiche Regeln). Beides
   zugleich ergibt keinen Sinn.

## 6. Entscheidungsmatrix

| Dependency / Funktion | Tatsächlicher Nutzen | Sicherheitslage | Wartungsrisiko | Kosten / Komplexität | Alternative | Entscheidung | Aufwand |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `pixi.js` 8.22 | Rendering-Kern, 34 Dateien | keine offenen Advisories | mittel (großer Umfang) | 72,7 MB install, 274 kB gzip im Hauptchunk | Canvas/WebGL selbst | **Behalten** | — |
| `react` / `react-dom` 19.3 | UI | unauffällig | niedrig | klein im Bundle | Preact/Solid | **Behalten** | — |
| `vite` 6.4.5 | Build/Dev | **ungepatchte fs-Bypässe** | hoch (Soft-EOL) | 17,7 s Build | Rolldown direkt | **Aktualisieren** (7.3.2 → 8.3.5) | migrationsintensiv |
| `@vitejs/plugin-react` 4.7 | JSX/Fast Refresh | kein Advisory | hoch (EOL) | 20 Babel-Pakete, 8,1 MB | Oxc-Plugin in v6 | **Aktualisieren** (→ 6.1.2 mit Vite 8) | migrationsintensiv |
| `vitest` 5.0.5 | 87 Testdateien | CVE-2026-112948 gefixt | niedrig | 90 s Suite | Bun test, Node test runner | **Behalten** (≥ 5.0.5) | — |
| `eslint` 10.13.0 | Lint-Gate | zurückgezogenes CVE | niedrig | 18 s | Oxlint, Biome | **Aktualisieren** (10.14.0) + `minimatch`-Override prüfen | sofort |
| `typescript-eslint` 8.72.1 | TS-Parser/Regeln | unauffällig | **blockiert TS 7** (< 6.1.0) | Teil der 18 s | Oxlint + tsgolint | **Behalten**, Neuprüfung bei TS 7 | sofort (prüfen) |
| `typescript` 5.9.3 | Typen | unauffällig | mittel (5.x ohne Fixes) | 22,5 MB | — | **Aktualisieren auf 6.0.x** (nicht 7, wegen ESLint) | migrationsintensiv |
| `projectService: true` | keine typbewussten Regeln aktiv | — | — | **+8 s ohne Gegenwert** | Oxlint typed | **Entscheiden**: Regeln aktivieren oder Option entfernen | sofort |
| `jsdom` 30.1.3 | 2 UI-Tests | keine Advisories | niedrig | 25,1 MB Kette | happy-dom | **Behalten** | — |
| `@testing-library/react` 16.3 | 2 UI-Tests | unauffällig | niedrig | klein | eigene Queries | **Behalten** | — |
| `yaml` 2.9.1 | Workflow-Struktur-Test | CVE-2026-33532 gefixt | niedrig | klein | eigener Parser | **Behalten** | — |
| `@capacitor/*` 8.6.0 | APK-Bau | CVE-2026-103922 gefixt (≥ 8.5.1) | niedrig | 1,9 MB | keins | **Behalten**; `core`-Notwendigkeit belegen | sofort (prüfen) |
| `glob` 14.0.3 (Override) | nur `rimraf`/Capacitor | Advisory gefixt (≥ 14.0.2) | **außerhalb rimraf-Bereich** | klein | rimraf ersetzen | **Behalten**, Android-Sync validieren | sofort (prüfen) |
| `minimatch` 11.0.3 (Override) | ESLint/tseslint | globparts gefixt (≥ 11.0.1) | **außerhalb Elternbereiche** | klein | warten auf ESLint-Unterstützung | **Behalten**, dokumentiert | sofort |
| `semver` 6.3.1 (via Babel) | nur plugin-react 4 | unauffällig | entfällt mit v6 | Duplikat | — | **Entfernen** mit plugin-react 6 | migrationsintensiv |
| `esbuild` 0.25.12 (transitiv) | Vite 6/Vitest 5 | kein eigenes Advisory belegt | entfällt mit Vite 8 | 27 Pakete, 10,3 MB | Oxc/Rolldown | **Ersetzen** über Vite 8 | migrationsintensiv |
| `@capacitor/core` | **kein Import** | unauffällig | — | 1 Paket | — | **Entfernen prüfen** (nur wenn `cap sync` ohne läuft) | sofort (prüfen) |
| Dev-Server `0.0.0.0` | Cloud-Preview | **macht fs-Bypässe ausnutzbar** | — | keine | `localhost` + Opt-in | **Ersetzen** (Default lokal, Env-Opt-in) | sofort |
| `engines` / `packageManager` | fehlt | — | Node-Drift 22 vs 26 | keine | — | **Eigenimplementierung prüfen** = nein, aber **ergänzen** | sofort |
| Bun (PM oder Testrunner) | Speed | — | — | Migration aller 87 Testdateien | — | **Entfernen aus der Diskussion** | wirtschaftlich nicht sinnvoll |
| Biome als ESLint-Ersatz | Speed | — | ~75 % Recall, keine Plugins | — | — | **Entfernen aus der Diskussion** | wirtschaftlich nicht sinnvoll |
| Eigener Bundler/Parser/DOM | — | — | hoch | — | Vite/yaml/jsdom | **Entfernen aus der Diskussion** | wirtschaftlich nicht sinnvoll |

## 7. Priorisierte Umsetzung

### Welle 0 — sofort, risikoarm, ohne Funktionsverlust

1. `eslint` 10.13.0 → 10.14.0 (`pnpm run lint` muss grün bleiben; der `minimatch`-Override bleibt bewusst bestehen).
2. `engines: { "node": ">=22.22.2" }` und `packageManager: "pnpm@<lokale Version>"` in `package.json`, CI nutzt dieselbe Untergrenze.
3. Dev-Server: `host` nur mit `RBD_DEV_HOST` öffnen, Standard `localhost`. Beseitigt die praktische Ausnutzbarkeit der Vite-Advisories.
4. Android-CI-Lauf, der belegt, ob `cap sync` ohne `@capacitor/core` und mit `glob` 14 über `rimraf` 6 funktioniert. Ergebnis entscheidet über zwei Zeilen in `package.json`.
5. `docs/ARCHITECTURE.md`-Matrix für `@capacitor/core` ehrlich stellen (kein Code-Import).
6. Entscheidung zu `projectService`: typed Regeln aktivieren **oder** Option entfernen (−8 s pro Lint).

### Welle 1 — migrationsintensiv, mit echtem Gewinn

7. Vite 6.4.5 → 7.3.2 (Zwischenschritt, gleiche API-Fläche), danach 8.3.5; `@vitejs/plugin-react` 4 → 6 zeitgleich mit 8. Entfernt 20 Babel-Pakete (−8,1 MB) und `esbuild` (−27 Pakete, −10,3 MB), bringt Rolldown/Lightning CSS (~+15 MB) und einen schnelleren Build. Vitest 5 bleibt, `manualChunks`-Konfiguration auf `advancedChunks` prüfen.
8. TypeScript 5.9 → 6.0.x (nicht 7): typescript-eslint 8.72.1 deckelt bei `< 6.1.0`. TS 7 erst, wenn das Lint-Tooling folgt — oder wenn Oxlint + tsgolint ESLint ersetzt (koppelt beide Entscheidungen).
9. Nach dem Vite-Upgrade: Bundle-Größe und Build-Zeit erneut messen (der offene Vite-8-Issue nennt +8 % Bundle, 53 % mehr Chunks) und den 500-kB-Chunk-Hinweis mit `manualChunks`/`advancedChunks` adressieren.

### Welle 2 — bewusst nicht

10. Kein Bun als Paketmanager oder Testrunner, kein Biome als ESLint-Vollersatz, kein eigener Bundler, Parser oder DOM. Die Zahlen und Lücken stehen in 3.2.

### Erwartete Einsparungen (belegt bzw. begründet)

| Änderung | Einsparung | Beleg |
| --- | --- | --- |
| plugin-react 6 statt 4 | 20 Pakete, 8,1 MB Installation, `semver`-Duplikat weg | Lockfile + `node_modules`-Messung |
| Vite 8 statt 6 | `esbuild`-Familie (27 Pakete, 10,3 MB) entfällt | Lockfile-Messung; Rolldown/Lightning CSS (~15 MB) kommt hinzu, netto also **kein** Installationsgewinn |
| `projectService` entfernen | 8 s pro Lint (18 s → 10 s, ungecacht) | eigener Messlauf |
| Dev-Server nur lokal | keine messbare Einsparung, aber die Vite-Advisories verlieren ihre Angriffsfläche | Advisory-Analyse |

### Neue Risiken der Migration

- Vite 8: Oxc statt Babel im React-Transform, React-Compiler nur per Opt-in, `manualChunks` deprecated, Plugin-Kompatibilität, +15 MB Installation, offener Issue zu +8 % Bundle.
- TypeScript 6: neue Compiler-Fehler sind zu erwarten; `verbatimModuleSyntax`/`isolatedModules` bleiben kompatibel, `@types/node` 26 kann mit TS 6 strenger werden.
- ESLint 10.14 + `minimatch`-Override: bleibt eine nicht unterstützte Kombination, bis ESLint minimatch 11 erlaubt.
- Android: `glob` 14 über `rimraf` 6 ist ungetestet; ein stiller Cleanup-Fehler würde alte Web-Assets in der APK lassen — deshalb Welle 0, Punkt 4 vor jedem Capacitor-Upgrade.

### Umsetzungsstand (31.10.2026)

| Punkt | Status | Nachweis |
| --- | --- | --- |
| Welle 0.1 eslint 10.14.0 | umgesetzt | `pnpm run lint` grün |
| Welle 0.2 engines/packageManager | umgesetzt | `engines.node >=22.22.2`, `packageManager pnpm@10.4.1` |
| Welle 0.3 Dev-Server nur localhost | umgesetzt | `src/Config/vite.config.ts`: `host: RBD_DEV_HOST || 'localhost'` |
| Welle 0.4 Android `cap add`/`cap sync` | lokal geprüft, Gradle-Nachweis via CI | `cap sync` mit `glob` 14 über `rimraf` 6 erfolgreich; `@capacitor/core` bleibt, weil `@capacitor/android` 8.6.0 es als Peer verlangt |
| Welle 0.5 projectService | entfernt | Lint ohne Cache 25,1 s → 18,3 s, grün |
| Welle 1.7 Vite | umgesetzt in zwei Schritten | Vite 7.3.7 mit plugin-react 5.2.0 geprüft; danach Vite 8.3.5 mit plugin-react 6.1.2; Build grün |
| Welle 1.8 TypeScript | umgesetzt | TypeScript 6.0.3, Typecheck und Lint grün, typescript-eslint 8.72.1 unverändert |
| Welle 1.9 manualChunks | nicht nötig | Projekt hat keine `manualChunks`-Konfiguration |
| Welle 2 Lockfile | gemessen | 373 → 311 Lockfile-Einträge; Babel/esbuild-Einträge 51 → 3 (nur `@babel/code-frame`, `helper-validator-identifier`, `runtime`); `semver` oberste Ebene entfallen |

Der Vite-8-Build meldet eine Warnung der nativen Config-Ladung zu einem extensionlosen Import (`src/Config/vite.config.ts` und `src/core/governance/test-harness.ts`). Sie ist nicht blockierend und offen.

## 8. Offene Punkte

- Der Android-Gradle-Build ist lokal nicht geprüft (kein Android-SDK); der Nachweis kommt aus `build-apk.yml` in CI.
- Die Installationsgröße von `node_modules` wurde nach der Migration mit Datei-Summen gemessen: 234,6 MB. Der Audit-Wert 216,2 MB stammt aus einer anderen Messung; ein Vorher-Nachher-Vergleich unter gleicher Methode steht aus. Die erwartete Netto-Einsparung wurde damit nicht belegt.
- Fixed-Versionen zu CVE-2026-112945/-112946/-112947 und CVE-2026-118662 (Vite, Okt. 2026) waren nicht bis zur Detailseite verifizierbar; sie ändern die Empfehlung nicht (Upgrade auf ≥ 7.3.2 / 8.0.5), aber die genaue Untergrenze muss beim Upgrade gegen `pnpm audit` und die Advisory-Seite geprüft werden.
- `pnpm install --frozen-lockfile`-Dauer wurde nicht gemessen (hätte `node_modules` zerstört); die Installationskosten sind über Paketanzahl und Größe belegt, nicht über Zeit.
