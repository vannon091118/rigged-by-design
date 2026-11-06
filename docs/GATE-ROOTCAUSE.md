# Gate-Rootcause-Analyse (konsolidiert)

Aus AGENTS.md ausgelagert. Diese Tabelle hält die bisherigen CI-Gate-Fehler und ihre Ursachen fest.

Alle CI Gate-Fehler seit dem Merge von `fix/narrative-review-findings` (NAR-13) hatten dieselbe Rootcause:
**Dateien wurden gelöscht, die noch von anderen Modulen importiert wurden, und neue Imports verwiesen auf nicht mehr existierende Module.**

| Gate | Code | Datei | Ursache | Fix |
|------|------|-------|---------|-----|
| check:loc | ERR-4012 | `src/store/migrate.ts` | 221 LOC, Hot Zone für state-Dateien ist 165 | Auf 116 LOC reduziert (Kommentare entfernt, Zuweisungen kombiniert) |
| verify:docs | ERR-4017 | `docs/INVENTORY.md` | Abdeckung 1140 ≠ 1149 getrackte Dateien (Merge hat Datei-Zählung verändert) | `inventory:build` neu generiert, 1147/1147 |
| build | ERR-1005 | `src/core/sim/tick.ts` | Importierte aus gelöschten `character.ts`, `stain.ts`, `smartphone.ts` | `tick.ts` auf alten Stand zurückgesetzt |
| build | ERR-1005 | `src/store/venue-commands.ts` | Importierte aus gelöschten `mop.ts`, `interaction.ts` | `mop.ts`, `interaction.ts` mit nur benötigten Exports wiederhergestellt |
| dead-code | ERR-4003 | `src/core/sim/{character,interaction,mop,smartphone,stain}.ts` | Exports (`MOP_USES`, `manhattanDistance`, `getStainInfluence`, `tickStains` u.a.) nicht importiert | Dateien gelöscht oder auf nur genutzte Exports reduziert |
| tests | ERR-2001 | `src/core/sim/{templates,disputes}.ts` | `Cannot find module './stain'` | `stain.ts` mit nur `spawnStain`/`removeStain` wiederhergestellt |
| verify-commit-msg | ERR-4006 | Commit-Body | Pflichtsektionen ohne echten Inhalt (platzhalterartig) | Commit-Body mit vollständigen Inhalten in allen drei Sektionen |

**Regel:** Vor jedem Löschen von Dateien aus `src/core/sim/` (oder jedem anderen Verzeichnis) muss ein Import-Grep über das gesamte Repository laufen (`rg <dateiname> src/`), um sicherzustellen, dass kein Modul das gelöschte Datei importiert. Niemals Module löschen, die noch referenziert werden. Falls ein Modul teilweise ungenutzte Exports hat, nur die genutzten Exports behalten statt das ganze Modul zu löschen.

## ERR-4006 beim Merge eines gruenen PR

| Gate | Code | Datei | Ursache | Fix |
|------|------|-------|---------|-----|
| verify-commit-msg | ERR-4006 | Merge-Commit `6f7a906` (PR #163) | Der Merge lief nur mit `commit_title`. GitHub schreibt dann den PR-Titel als Merge-Text; die drei Pflichtsektionen aus dem PR-Body fehlen, obwohl der PR selbst gruen war. `main` wurde rot, `Bump, tag, release` und der APK-Bau fielen aus. | Follow-up-PR von `main`, dessen Merge `commit_message` = vollstaendiger PR-Body traegt. |

**Regel:** Beim Merge ueber Connector oder REST-API gehoert der PR-Body immer in `commit_message`. `commit_title` allein genuegt nicht, auch wenn alle PR-Checks gruen sind: `verify-commit-msg --head` prueft auf `main` den Merge-Commit, nicht den PR-Body. Vor dem Merge beide Felder setzen und danach den neuen `main`-HEAD samt `Fail-Closed Gates` pruefen.
