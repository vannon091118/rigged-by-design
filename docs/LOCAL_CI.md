# Local-first CI/CD: Ausführungskategorien und APK-Ablauf

**Zweck:** Diese Datei ist die Betriebsanleitung der Migration. Sie ordnet jede Aufgabe einer Kategorie zu, nennt die lokalen Befehle und beschreibt den APK-Build, ohne Qualitäts-Gates abzuschwächen. Die Gate-Wahrheit bleibt in [`CI.md`](CI.md).

## Grundsatz

- **Lokal ist der Standard** für Entwicklung, Tests, Build, Audit und APK.
- **Cloud ist die Ausnahme** für Repository-Verwaltung, Reviews, PR-Erzeugung und einen optionalen schnellen PR-Check.
- **Lange Nachweise** laufen nur auf ausdrückliche Anforderung.
- **Keine Doppelarbeit:** Ein Push auf eine Lane startet keinen zweiten Vollauf; der PR-Lauf prüft den exakten Kopf.
- **Keine stillen Erfolge:** Fehlende Gates, leere Matrizen und abgebrochene Läufe sind rot bzw. `REMOTE_CI`, nie grün.

## Ausführungskategorien

| Aufgabe | Kategorie | Ausführung |
| --- | --- | --- |
| Commit-Nachricht und PR-Body | LOCAL + CLOUD | lokal `turn:finish`/Hook; Cloud `CI Verify` prüft den PR-Kopf |
| TypeScript, ESLint, LOC, Doku-, Tree-, Redundanz-Gates | LOCAL | `pnpm run verify:light`; Cloud nur als optionaler PR-Check |
| Testqualität, betroffene Unit-Tests, schneller Build | LOCAL | `pnpm run verify:fast` |
| Vollständige Required-Suite inkl. Build | LOCAL + ON-DEMAND | `pnpm run verify:release`/`verify:all`; nicht pro PR |
| Vor-PR-Nachweis (Light, affected, Build) | LOCAL | `pnpm run verify:integration` (Fast) |
| Audit bei Dependency-Änderung | LOCAL + ON-DEMAND | Teil von `verify:integration`/`verify:release`; `--gate=audit` explizit |
| Lange Nachweise, Soak, Balance, Statistik, Benchmarks | ON-DEMAND | `pnpm run verify:long`; `long-checks.yml` nur per Dispatch |
| APK Debug/Release | LOCAL | `pnpm run android:apk` / `android:apk:release` |
| APK-Cloud-Fallback | MANUAL | `build-apk.yml` per `workflow_dispatch`, inkl. Release-Gates |
| Tag und GitHub-Release | MANUAL | `auto-version-release.yml` per `workflow_dispatch` nach `verify:release` |
| Merge nach `main` | MANUAL | nach lokalem `verify:integration`, Review und exaktem Kopf; der PR-Check ist optional |
| Promote-Status/Notausgang `integration` | MANUAL | `promote.yml` per Dispatch (`inspect`/`integrate`) |
| PR-Erzeugung bei Lane-Push | CLOUD | `ensure-pr.yml`; kein Testlauf |
| Branch-Cleanup und Post-Merge-Closeout | CLOUD | `pr-cleanup.yml` nach geschlossenem PR |
| Fehler-Issue bei rotem PR-Check | CLOUD | `pr-watcher.yml`; optional `auto-resolve.yml` per Repository-Variable |
| Release-Impact-Analyse | LOCAL | `release-impact.mjs` im manuellen Release |

**Nicht mehr automatisch:** Push-Vollauf auf `main`, 15er-Gate-Matrix, PR-Longruns, wöchentlicher Langlauf, Tag-getriebener APK-Build, Release als `workflow_run`-Folge, PR-Escalation-Push. Diese Aufgaben sind lokal, manuell oder on-demand erreichbar.

## Lokale Befehle

```bash
# Abhängigkeiten exakt aus dem Lockfile
pnpm install --frozen-lockfile

# schnelle Strukturprüfung (kein Test, kein Build)
pnpm run verify:light

# Standard vor dem Push: Light + Testqualität + betroffene Tests + Build
pnpm run verify:fast

# Vor-PR-Nachweis: Light + Testqualität + betroffene Tests + Build
pnpm run verify:integration

# vollständiger Release-Nachweis (15 Required + Audit)
pnpm run verify:release

# Audit explizit erzwingen (z. B. bei Dependency-Änderung)
RBD_VERIFY_AUDIT=1 pnpm run verify:integration

# lange Nachweise ausschließlich bei Bedarf
pnpm run verify:long
```

`verify:integration` und `verify:release` sind absichtlich nicht Teil jedes Turns. Sie sind der Übergang zur Integration bzw. zum Release; `verify:light` und `verify:fast` bleiben die regelmäßigen lokalen Gates.

## APK lokal bauen und installieren

Voraussetzungen: Node 22, pnpm 10.4.1, JDK 21, Android SDK mit `platform-tools`, `platforms;android-36` und `build-tools;36.0.0`. Der Debug-Schlüssel liegt versioniert in `src/Config/android-signing.json`; Produktionsschlüssel kommen ausschließlich aus der Umgebung.

```bash
# 1. Produktions-Build erzeugen; prepare-android verlangt dist/index.html
pnpm run build

# 2. Debug-APK bauen (signiert, installierbar)
pnpm run android:apk

# 3. Auf einem verbundenen Gerät installieren
adb install -r artifacts/rigged-by-design-debug.apk

# 4. Release-APK nur mit Produktionssignatur
export RBD_ANDROID_KEYSTORE_BASE64="$(cat /sicherer/pfad/keystore.b64)"
export RBD_ANDROID_KEYSTORE_PASSWORD='…'
export RBD_ANDROID_KEY_ALIAS='rbd-release'
export RBD_ANDROID_KEY_PASSWORD='…'
export RBD_ANDROID_RELEASE_SHA256='…'
pnpm run android:apk:release
```

`prepare-android.mjs` prüft Signatur, Zertifikats-Digest, Paketname und `minSdk`, bevor `artifacts/` entsteht. Fehlt die Produktionssignatur, entsteht **keine** Release-APK; sie wird nie mit dem Debug-Schlüssel getarnt. Signaturwerte gehören nicht ins Repository und nicht in den Chat.

### Gradle und Ressourcen

- Gradle nutzt den lokalen Cache unter `~/.gradle`; der Build läuft mit `--no-daemon`, damit kein Hintergrundprozess die interaktive Entwicklung blockiert.
- `cap add`/`cap sync` erzeugen `android/` nur bei Bedarf; das Verzeichnis ist nicht Teil des Quellbaums.
- Auf schwacher Hardware: zuerst `verify:light`, dann `verify:fast`; `verify:integration` und `verify:long` bewusst starten, nicht parallel zu einer interaktiven Session.
- Keine APK bei jedem Commit. Der Cloud-APK-Workflow ist ein manueller Fallback.

## Vorher/Nachher

| Bereich | Vorher | Nachher |
| --- | --- | --- |
| PR-Prüfung | 15 Matrix-Jobs + Plan + Claims + Long-Matrix | ein optionaler PR-Job: `verify:light`, Debug-APK und Release-Bump |
| Push auf `main` | vollständiger zweiter Lauf | kein Cloud-Lauf; lokaler Integrationsnachweis |
| Lange Nachweise | wöchentlicher Schedule + PR-Impact | ausschließlich `workflow_dispatch`/`verify:long` |
| Release | automatisch nach `main`-Push | manuell nach `verify:release` |
| APK | automatisch aus Tag/Release | lokal; Cloud nur manueller Fallback |
| PR-Escalation | Push-Workflow mit Schreibrecht | entfernt; PR-Body im PR-Job/`ensure-pr` |
| Merge | automatisch durch `promote` | manuell durch Mensch/Agent nach lokalem `verify:integration`; PR-Check optional |

## Verbleibende Cloud-Aufgaben

- **`ensure-pr.yml`:** Ein Lane-Push muss einen PR erzeugen; das ist Repository-Verwaltung, kein Build.
- **`ci-verify.yml`:** Der PR-Job `Fail-Closed Gates` ist optional und läuft nur auf dem PR-Kopf. Er prüft die schnellen Gates und baut die Debug-APK; die vollständige Suite bleibt lokal.
- **`pr-watcher.yml` / `auto-resolve.yml`:** Fehler sichtbar machen und optional mechanisch reparieren; `auto-resolve` ist standardmäßig aus.
- **`pr-cleanup.yml`:** Branch löschen und Claim/Task nach dem Merge nachziehen.
- **`promote.yml`, `auto-version-release.yml`, `build-apk.yml`, `long-checks.yml`:** ausschließlich manuell/on-demand; keine automatischen Läufe.

## Validierung

```bash
pnpm run verify:light
pnpm run verify:fast
pnpm run verify:integration
pnpm run verify:docs
pnpm run verify:claims
```

Die Gates bleiben verbindlich: Commit-Konventionen, TypeScript ohne ignorierte Fehler, Vite-Build, ESLint, Lockfile-Konsistenz, Architektur-/Sicherheitsprüfungen und Release-Gates werden nicht abgeschaltet. Die Migration ändert nur den Ausführungsort und die Frequenz.
