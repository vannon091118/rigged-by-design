# CircleCI: Local-first mit 30.000 Credits/Monat

Diese Pipeline ersetzt die GitHub-Workflows funktional. Der lokale Nachweis
bleibt der Standard (`pnpm run verify:light`, `verify:fast`); CircleCI prueft
den Kopf, baut die APK und haelt den Release-Pfad korrekt.

## Was wann laeuft

| Ausloeser | Workflow | Job | Dauer (Docker small) | Credits |
| --- | --- | --- | --- | --- |
| Push auf einen Branch ausser `main` | `push-guard` | `guard`: Commit-Konvention + PR-Sync | ~1 min | ~5 |
| Push auf `main` | `main-integration` | `integration`: `verify:fast` + Freeze | ~8 min | ~40 |
| Tag `v*` | `release` | `release-gates`: `verify:release` (15 Gates + Audit) | ~20 min | ~200 (medium) |
| Tag `v*` | `release` | `apk`: Debug-/Release-APK + Release-Upload | ~12 min | ~120 (medium) |
| Montags 03:00 | `long-checks` | `long`: `verify:long` | ~45 min | ~450 (medium) |
| manuell (`run_apk`) | `manual-apk` | `apk` ohne Release-Upload | ~12 min | ~120 (medium) |
| manuell (`run_long`) | `manual-long` | `long` | ~45 min | ~450 (medium) |

**Budgetrechnung bei 100 Commits/Tag** (~3.000 Pushes/Monat):
`guard` 3.000 x ~5 = ~15.000 Credits, `main` ~1.200, Releases ~5.250,
`long` ~1.800 -> **~23.250 von 30.000**. Reserve ~6.750 Credits.
Wenn die Push-Zahl ueber ~3.500/Monat steigt, im Config den `push-guard`-Filter
auf `lane/**` verengen oder `guard` nur bei `[ci]`-Commits laufen lassen.

30.000 Credits = **6.000 Minuten Docker small** (5 Credits/Min). Medium kostet
10 Credits/Min; nur Release und APK nutzen medium, weil Gradle und die volle
Suite dort zuverlaessig durchlaufen.

## Einrichtung (einmalig)

1. **Projekt verbinden:** CircleCI -> Projects -> `vannon091118/rigged-by-design`
   -> Set Up Project -> Branch `main`, Config-Pfad `.circleci/config.yml`.
2. **Auto-cancel aktivieren:** Project Settings -> Advanced -> *Auto-cancel
   redundant workflows*. Ohne das kosten superseded Pushes zusaetzlich.
3. **Context `rbd-cloud` anlegen** (Organization Settings -> Contexts) mit:
   - `GH_TOKEN` — PAT mit `repo` (PR anlegen, Release/Assets schreiben).
   - `RBD_ANDROID_KEYSTORE_BASE64`, `RBD_ANDROID_KEYSTORE_PASSWORD`,
     `RBD_ANDROID_KEY_ALIAS`, `RBD_ANDROID_KEY_PASSWORD`,
     `RBD_ANDROID_RELEASE_SHA256` — nur fuer die Release-APK. Fehlen sie,
     entsteht keine Release-APK; die Debug-APK wird trotzdem gebaut.
4. **Required Status Check:** `ci/circleci: guard` im Branch-Schutz von `main`
   eintragen (so meldet CircleCI den Job an GitHub).
5. **GitHub Actions abschalten:** Settings -> Actions -> General -> *Disable
   actions*. Die Workflow-Dateien unter `.github/` sind eingefroren und koennen
   nicht in diesem Zug geloescht werden; das Abschalten in den Repository-
   Einstellungen stoppt die Doppel-Ausfuehrung sofort. Die Workflow-Dateien
   bleiben als Dokumentation liegen; ein Loeschen ist nicht noetig.

## Manuelle Laeufe

```bash
# APK ohne Tag (Artefakte bleiben in CircleCI)
curl -X POST https://circleci.com/api/v2/project/gh/vannon091118/rigged-by-design/pipeline \
  -H "Circle-Token: $CIRCLECI_TOKEN" -H "Content-Type: application/json" \
  -d '{"parameters":{"run_apk":true}}'

# Lange Nachweise on demand
curl -X POST https://circleci.com/api/v2/project/gh/vannon091118/rigged-by-design/pipeline \
  -H "Circle-Token: $CIRCLECI_TOKEN" -H "Content-Type: application/json" \
  -d '{"parameters":{"run_long":true}}'
```

Ein Release entsteht durch einen Tag `v<package.json-Version>`; der Job bricht
ab, wenn Tag und Version auseinanderlaufen.

## Was die Pipeline bewusst nicht tut

- Keine volle Suite pro Push: `verify:release` laeuft nur auf Tags, sonst waere
  das Budget nach wenigen Tagen aufgebraucht.
- Kein Cloud-Build pro PR-Kopf: `verify:fast` auf `main` und lokal reichen.
- Kein Gradle-Cache: Cache-Storage kostet zusaetzlich Credits; der Android-Build
  laedt seine Abhaengigkeiten in ~2 Minuten neu.
- Kein stiller Erfolg: fehlende Signatur, fehlendes Artefakt, falscher Tag und
  fehlendes `GH_TOKEN` erzeugen einen sichtbaren Befund.

## Grenzen

- `circleci config validate` ist lokal nicht verfuegbar (CLI nicht installiert).
  Die Struktur wurde per YAML-Parser geprueft (jobs, executors, requires,
  Pipeline-Parameter); vor dem ersten echten Lauf einmal
  `circleci config validate .circleci/config.yml` ausfuehren.
- `docs/CI.md` beschreibt noch die GitHub-Workflows. Die Datei ist eingefroren;
  die Aktualisierung braucht dieselbe Freeze-Freigabe wie das Loeschen der
  Workflows.
