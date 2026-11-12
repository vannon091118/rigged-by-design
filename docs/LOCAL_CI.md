# Local-first CI/CD: Ausführungskategorien und APK-Ablauf

**Zweck:** Diese Datei ist die Betriebsanleitung: jede Aufgabe, jeder lokale Befehl und der APK-Build. Die Gate-Wahrheit bleibt in [`CI.md`](CI.md).

## Grundsatz

- **Lokal ist der einzige Testpfad** für Entwicklung, Tests, Build, Audit und APK.
- **GitHub führt keine Tests, Gates, Builds oder APKs aus.** Drei Workflows bleiben ausschließlich für Repository-Verwaltung: PR anlegen, gemergte Branches aufräumen, Promotion manuell anstoßen.
- **Mechanik ist gezielt.** Statistik, Soak, Langlauf und Benchmarks laufen nur über `pnpm run test:mechanics`, nie in einem Regelprofil.
- **Keine stillen Erfolge:** Fehlende Gates, leere Auswahlen und abgebrochene Läufe sind rot, nie grün.

## Ausführungskategorien

| Aufgabe | Kategorie | Ausführung |
| --- | --- | --- |
| Commit-Nachricht | LOCAL | Hook; `--strict` prüft sie im Runner |
| TypeScript, ESLint, LOC, Doku-, Tree-, Redundanz-Gates | LOCAL | `pnpm run verify:light` |
| Testqualität, betroffene Unit-Tests, Build | LOCAL | `pnpm run verify:fast` |
| Vollständige Required-Suite inkl. Build | LOCAL | `pnpm run verify:all` |
| Vor-PR-Nachweis | LOCAL | `pnpm run ci:local` (= `verify:integration`) |
| Release-Nachweis mit Audit | LOCAL | `pnpm run ci:local --profile=release` |
| Mechanik, Soak, Balance, Statistik, Benchmarks | LOCAL + ON-DEMAND | `pnpm run test:mechanics` |
| APK Debug/Release | LOCAL | `pnpm run android:apk` / `android:apk:release` |
| Tag und GitHub-Release | LOCAL | `node scripts/ci-tag-release.mjs` nach `verify:release` |
| Merge nach `main` | MANUAL | nach lokalem Vor-PR-Nachweis, Review und exaktem Kopf |
| PR-Erzeugung bei Lane-Push | CLOUD (Verwaltung) | `ensure-pr.yml`; kein Testlauf |
| Branch-Cleanup und Post-Merge-Closeout | CLOUD (Verwaltung) | `pr-cleanup.yml` |

## Lokale Befehle

```bash
pnpm install --frozen-lockfile

pnpm run verify:light
pnpm run verify:fast
pnpm run ci:local
pnpm run ci:local --profile=full
pnpm run ci:local --profile=release
pnpm run test:mechanics
RBD_VERIFY_AUDIT=1 pnpm run verify:integration
```

Der Runner führt die frühere Workflow-Kette lokal aus (Commit-/Claim-/Freeze-Preflight optional mit `--strict`, danach die Testlinie und optional den APK-Build). Es gibt keinen Dispatch, kein Warten und keinen Remote-Status.

## APK lokal bauen und installieren

Voraussetzungen: Node 22, pnpm 10.4.1, JDK 21, Android SDK mit `platform-tools`, `platforms;android-36` und `build-tools;36.0.0`. Der Debug-Schlüssel liegt versioniert in `src/Config/android-signing.json`; Produktionsschlüssel kommen ausschließlich aus der Umgebung.

```bash
pnpm run ci:local --profile=apk
adb install -r artifacts/rigged-by-design-debug.apk

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
- Auf schwacher Hardware: zuerst `verify:light`, dann `verify:fast`; `verify:all` und `test:mechanics` bewusst starten.

## Vorher/Nachher

| Bereich | Vorher | Nachher |
| --- | --- | --- |
| Testausführung | 15 Matrix-Jobs plus PR-Job, Long-Matrix, Warteschlange | ein lokaler Runner, keine Cloud-Testmaschine |
| PR-Prüfung | optionaler Cloud-Job `Fail-Closed Gates` | `pnpm run ci:local` lokal; kein Required-Status |
| Lange Nachweise | eigener Workflow, Dispatch und Warten | `pnpm run test:mechanics`, direkt auf der Maschine |
| APK | Cloud-Fallback und Tag-Kette | `pnpm run ci:local --profile=apk` lokal |
| Mechanik im Regellauf | über Namensmuster ausgeschlossen, doppelt gepflegt | eine Manifest-Liste, Katalog prüft Deckungsgleichheit |
| Gate-Timeouts | 15-Minuten-Default, Force-Kill, Timeout-Code | kein Gate-Timeout; Abbruch nur per Signal |

## Verbleibende Cloud-Aufgaben

- **`ensure-pr.yml`:** Ein Lane-Push muss einen PR erzeugen; das ist Repository-Verwaltung, kein Build.
- **`pr-cleanup.yml`:** Branch löschen und Claim/Task nach dem Merge nachziehen.
- **`promote.yml`:** ausschließlich manuell; kein Auto-Merge.

## Validierung

```bash
pnpm run verify:light
pnpm run verify:fast
pnpm run ci:local --profile=full
pnpm run verify:docs
pnpm run verify:claims
```

Die Gates bleiben verbindlich: Commit-Konventionen, TypeScript ohne ignorierte Fehler, Vite-Build, ESLint, Lockfile-Konsistenz, Architektur-/Sicherheitsprüfungen und Release-Gates werden nicht abgeschaltet. Die Migration ändert nur den Ausführungsort: lokal, ohne Cloud.
