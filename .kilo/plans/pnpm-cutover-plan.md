# Integrationsplan: npm → pnpm (Big-Bang-Cutover)

## Kontext & verifizierte Abweichungen vom Eingangsplan

Folgende Behauptungen im Eingangsplan wurden gegen den tatsächlichen Code geprüft:

| Behauptung | Tatsächlicher Stand | Konsequenz |
|---|---|---|
| AGENTS.md-Marker `v0.3.69` | Marker ist `v0.3.70 | 2026-11-01 21:25 UTC` (AGENTS.md:3), package.json `version: "0.3.70"` | `docs:sync` trotzdem ausführen (Zeitstempel auffrischen); Version bei Cutover auf `0.3.71` bumpen |
| 7 CI-Workflows existieren und werden gepatcht | `.github/workflows/` ist **leer** (keine `.yml`/`.yaml`-Dateien) | Phase 3 muss Workflows **anlegen** (ci-verify.yml, build-apk.yml, long-checks.yml, auto-version-release.yml); promote/pr-escalation/pr-cleanup existieren ebenfalls nicht |
| `.gitignore` bekommt `pnpm-lock.yaml` | Falsch: pnpm-lock.yaml muss **getrackt** werden (es ist das neue Lockfile); `.gitignore` darf es nicht enthalten | Kein `pnpm-lock.yaml` in `.gitignore` aufnehmen; stattdessen `pnpm-lock.yaml` tracken |
| `pnpm` bereits installiert | Konnte nicht verifiziert werden (Befehl in Sandbox blockiert) | Schritt 0: `pnpm` installieren + Version pinnen |

Alle Script-Zeilenangaben im Eingangsplan stimmen (pipeline-plan.mjs:15-17,60-63; gate-runner.mjs:60-61,68; run-pipeline.mjs:41; turn-push.mjs:13,33,52,77,198; version-bump.mjs:37-43; prepare-android.mjs:38,47,59-60; balance-run.mjs:30-31; bench-lowend.mjs:17-18; encode-audio.mjs:35).

## Entscheidungen

1. **pnpm-Version:** `pnpm@10.4.1` pinnen (`packageManager: "pnpm@10.4.1"`). Offene Frage: ggf. abweichende Version vereinbaren.
2. **`.npmrc`:** `allow-scripts=true` (für `ffmpeg-static` postinstall; pnpm ignoriert `allowScripts` in package.json). Keine weiteren Optionen vorerst.
3. **Lockfile:** `package-lock.json` aus Git-Tracking entfernen, `pnpm-lock.yaml` tracken. `package-lock.json` lokal löschen nach erfolgreichem `pnpm install`.
4. **Audit:** `pnpm audit` (strenger als `npm audit --audit-level=low`); lokal vorab ausführen, Schwachstellen sichten. `audit:gate`-Script in package.json auf `pnpm audit` stellen.
5. **Overrides:** `glob`/`minimatch`-Overrides in package.json bleiben; nach `pnpm install` neu validieren (Semantik kann abweichen).
6. **Workflows:** Neu anlegen mit `actions/setup-pnpm@v4`, `cache: pnpm`, `pnpm install --frozen-lockfile`, Cache-Key auf `pnpm-lock.yaml`.
7. **Doku:** `rbd-doc`-Marker über `npm run docs:sync` auffrischen (bereits v0.3.70, neuer UTC-Zeitstempel); alle 6 Pflichtdokumente + DEPENDENCY-AUDIT.md (pnpm-Bewertung ergänzen, Zeilen ~166-167, 241) im selben Commit.

## Aufgabenliste (implementierungsbereit)

### Phase 0 — Vorbereitung (lokal)
- [ ] `pnpm` installieren (`npm install -g pnpm@10.4.1` oder via Corepack), `pnpm --version` verifizieren
- [ ] `.npmrc` anlegen mit `allow-scripts=true`
- [ ] `package.json`: `"packageManager": "pnpm@10.4.1"` setzen; `"allowScripts`-Feld entfernen (gehört in `.npmrc`)
- [ ] `pnpm install` ausführen → `pnpm-lock.yaml` erzeugt
- [ ] `node_modules/` löschen (npm-Reste), erneut `pnpm install` für sauberen Stand

### Phase 1 — Interne Skripte auf pnpm umstellen
- [ ] `scripts/lib/pipeline-plan.mjs`: 7× `command: 'npm'` → `command: 'pnpm'` (Zeilen 15,16,17,60,61,62,63)
- [ ] `scripts/lib/gate-runner.mjs`: `step.command === 'pnpm'` → `'pnpm'`, `['run', step.script]`, `shell: command === 'pnpm' && process.platform === 'win32'` (Zeilen 60,61,68)
- [ ] `scripts/run-pipeline.mjs`: `depsChanged()` um `pnpm-lock.yaml` ergänzen (Zeile 41: `['package.json', 'package-lock.json', 'pnpm-lock.yaml']`)
- [ ] `scripts/turn-push.mjs`: `spawnSync('npm')` → `spawnSync('pnpm')` (npmRun-Hilfsfunktion, Zeile 13; Aufrufe Zeilen 52,77,198); `package-lock.json` → `pnpm-lock.yaml` im `git add` (Zeile 33)
- [ ] `scripts/version-bump.mjs`: `package-lock.json` (JSON) → `pnpm-lock.yaml` (YAML via `yaml`-Paket, bereits devDependency) (Zeilen 37-43)
- [ ] `scripts/prepare-android.mjs`: `npx cap` → `pnpm exec cap` (Zeilen 59-60); Fehlermeldungen `npm run` → `pnpm run` (Zeilen 38, 47)
- [ ] `scripts/balance-run.mjs`: `npx vitest` → `pnpm exec vitest` (Zeilen 30-31)
- [ ] `scripts/bench-lowend.mjs`: `npx vitest` → `pnpm exec vitest` (Zeilen 17-18)
- [ ] `scripts/encode-audio.mjs`: `npm rebuild ffmpeg-static` → `pnpm rebuild ffmpeg-static` (Zeile 35)
- [ ] `scripts/test-affected.mjs`: keine Änderung (Node-basiert, nur Kommentare erwähnen `npm run ci:long`)

### Phase 2 — CI-Workflows anlegen (existieren nicht)
- [ ] `.github/workflows/ci-verify.yml`: `setup-pnpm@v4`, `cache: pnpm`, `pnpm install --frozen-lockfile`, `pnpm run verify:all`, Cache-Key auf `pnpm-lock.yaml`
- [ ] `.github/workflows/build-apk.yml`: gleiches + `pnpm run verify:release`, `pnpm run build`, `pnpm run android:apk`, `pnpm run android:apk:release`
- [ ] `.github/workflows/long-checks.yml`: 5 Jobs, je `setup-pnpm@v4`, `pnpm install --frozen-lockfile`, `pnpm exec vitest`, `pnpm run test:perf`
- [ ] `.github/workflows/auto-version-release.yml`: `setup-pnpm@v4`, `pnpm install --frozen-lockfile`, `pnpm run verify:release`
- [ ] `promote.yml`, `pr-escalation.yml`, `pr-cleanup.yml`: existieren nicht — keine Änderung nötig (kein npm-Install)

### Phase 3 — package.json / .gitignore / package-lock
- [ ] `package.json`: `"audit:gate": "pnpm audit"` (statt `npm audit --audit-level=low`)
- [ ] `.gitignore`: `pnpm-lock.yaml` **nicht** aufnehmen (tracken!); `bunfig.toml` optional aufnehmen (bun nicht im Projekt, harmlos)
- [ ] `package-lock.json` aus Git-Tracking entfernen (`git rm --cached`), lokal löschen, erst nach grünem CI

### Phase 4 — Dokumentation (selber Commit wie der Cutover)
- [ ] `npm run docs:sync` ausführen (Marker auf v0.3.70 / aktueller UTC-Zeitstempel in allen 6 Pflichtdokumenten)
- [ ] `AGENTS.md`: alle `npm`-Erwähnungen auf `pnpm`; "Dev environment" auf pnpm umstellen
- [ ] `docs/ARCHITECTURE.md`: Profil-Tabelle, Cache-Schlüssel, `pnpm-lock.yaml`, `pnpm audit`
- [ ] `docs/CHANGELOG.md`: Neue Version, Eintrag "Paketmanager-Wechsel npm → pnpm"
- [ ] `docs/DEVTAGEBUCH.md`: Neuer Eintrag (Ziel, Umsetzung, Prüfungen, Offen)
- [ ] `docs/INVENTORY.md`: `pnpm-lock.yaml` statt `package-lock.json`, Abdeckungszahl anpassen
- [ ] `docs/ROADMAP.md`: Cutover als abgeschlossen markieren
- [ ] `docs/DEPENDENCY-AUDIT.md`: pnpm-Bewertung ergänzen (Zeilen ~166-167, 241; bislang nur Bun abgelehnt, pnpm gar nicht erwähnt)

### Phase 5 — Cutover (Big-Bang auf main)
- [ ] Alles in einem Commit auf Branch, dann PR gegen main
- [ ] Commit-Titel mit Pflichtsektionen (`### Changes`, `### Technische Basis & Kausalität`, `### Ausblick`)
- [ ] `pnpm run verify:all` lokal grün vor dem Push
- [ ] `package-lock.json` erst löschen, wenn `pnpm-lock.yaml` existiert und CI grün ist

## Risiken

| # | Risiko | Gegenmaßnahme |
|---|---|---|
| R1 | `pnpm audit` strenger (exit 1 bei jeder Schwachstelle) | Vorab lokal `pnpm audit` ausführen; Schwachstellen beheben oder akzeptieren |
| R2 | `version-bump.mjs` kann YAML-Lockfile nicht als JSON parsen | `yaml`-Paket verwenden (bereits devDependency) |
| R3 | Beide Lockfiles parallel → Redundanz-Gate ERR-4020 rot | Big-Bang: `package-lock.json` erst entfernen, wenn `pnpm-lock.yaml` existiert und CI grün |
| R4 | `ffmpeg-static` postinstall braucht `allow-scripts` | `.npmrc` mit `allow-scripts=true` |
| R5 | `packageManager` bleibt `npm@12.2.1` | Auf `pnpm@10.4.1` setzen |
| R6 | Cache-Key auf `package-lock.json` passt nicht | Auf `hashFiles('pnpm-lock.yaml', ...)` stellen |
| R7 | `verify-tree.mjs` ROOT_FILES enthält `package-lock.json`, nicht `pnpm-lock.yaml` | `pnpm-lock.yaml` zu ROOT_FILES hinzufügen |
| R8 | Lokales npm-`node_modules` mischt sich unter | `node_modules/` löschen, `pnpm install` erneut |

## Rollback (nummeriert)

1. `git rev-parse HEAD` (CUTOVER_COMMIT), `git rev-parse main` (MAIN_PRIOR) merken
2. `git checkout main`; `git reset --soft MAIN_PRIOR`
3. `git rm --cached pnpm-lock.yaml`; `rm -f pnpm-lock.yaml`; `git show MAIN_PRIOR:package-lock.json > package-lock.json`; `git add package-lock.json`
4. `git show MAIN_PRIOR:package.json > package.json`; `git add package.json`
5. `git checkout MAIN_PRIOR -- scripts/ .github/workflows/ AGENTS.md docs/`; `git add`
6. Version-Drift prüfen (package.json.version === package-lock.json.version === Marker)
7. Commit mit Pflichtsektionen (Rollback)

**Abbruchkriterium (BLOCKED):** Wenn Geld-, Ledger-, RNG- oder Save-Code im Cutover geändert wurde, ist Rollback blockiert und erfordert manuelle Prüfung.

## Definition of Done (vor Merge auf main)

- [ ] `pnpm install` erfolgreich, `pnpm-lock.yaml` erzeugt
- [ ] `pnpm run typecheck` grün
- [ ] `pnpm run lint` grün
- [ ] `pnpm run test` (Vitest) grün
- [ ] `pnpm run verify:quick` grün (alle Gates des Quick-Profils)
- [ ] `pnpm run verify:all` in CI grün (alle Gates, inkl. `pnpm audit`)
- [ ] `package-lock.json` aus Git-Tracking entfernt
- [ ] `pnpm-lock.yaml` getrackt
- [ ] Alle 6 Pflichtdokumente mit neuem `rbd-doc`-Marker im selben Commit
- [ ] `docs/DEPENDENCY-AUDIT.md` pnpm-Bewertung ergänzt

## Offene Fragen (vor erstem Commit zu klären)

1. **pnpm-Version:** Exakt `pnpm@10.4.1` oder abweichend?
2. **`.npmrc`:** Nur `allow-scripts=true`, oder auch `save-exact=true`, `strict-peer-dependencies=false`?
3. **Overrides:** `glob`/`minimatch`-Overrides nach `pnpm install` neu validiert?
4. **`pnpm audit` Severity:** Ohne `--audit-level` (strenger) akzeptiert, oder Wrapper-Skript bauen?
5. **Marker-Version:** Changelog auf `0.3.70` oder `0.3.71` bumpen? (package.json steht bereits auf `0.3.70`; Cutover-Commit sollte auf `0.3.71` bumpen.)
6. **Workflows:** Da keine existieren — sollen sie neu angelegt werden, oder wird CI extern/auf Org-Ebene betrieben?
