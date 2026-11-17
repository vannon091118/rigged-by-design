#!/usr/bin/env node
/**
 * LOC-Guard fuer Produktcode und Werkzeuge.
 *
 * Geprueft werden `src/` und `scripts/`; die Budgets stehen in
 * `scripts/loc-budgets.mjs`. Die Hot Zone liegt bei 4/7 des Caps
 * (Tool: 260 -> 200). Reisst eine Datei ihre Grenze, muss sie bis unter die
 * Hot Zone reduziert werden, nicht nur knapp unter die Grenze.
 *
 * Gezaehlt werden nur Code-Zeilen: Kommentare und Leerzeilen zaehlen nicht,
 * ebenso wenig reine Textdaten (`registry.generated.ts`) und Event-Templates
 * (`events/definitions/`). Das Budget gilt der Logik, nicht der Prosa.
 *
 * Neue @loc-exception-Header sind verboten; nur die Legacy-Liste der Registry
 * darf noch eine 350er Grenze tragen, und diese Liste wird nur kuerzer.
 *
 * Exit-Code 1 bei Verstoessen, sonst 0.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fail } from './lib/report.mjs';
import { captureConsole, isVerbose } from './lib/compact.mjs';
import { scanLoc, SOURCE_ROOTS } from './lib/loc-guard.mjs';
// Sichtbare Antwort bleibt unter 500 Token; vollstaendig im Log.
captureConsole({ label: 'check-loc' });

const ROOT = fileURLToPath(new URL('..', import.meta.url));

for (const dirName of SOURCE_ROOTS) {
  const dir = join(ROOT, dirName);
  if (!existsSync(dir)) {
    console.error(`check:loc - Verzeichnis fehlt: ${dirName}`);
    process.exit(1);
  }
}

const { files, skipped, violations, hotFiles } = scanLoc({ root: ROOT });

// Kompakt: eine Zeile Uebersicht, der Rest nur mit RBD_VERBOSE=1. Ein
// Dateibestand ist kein Befund; die Verstoesse nennt `fail()` unten ohnehin.
console.log(`check:loc - ${files.length} Datei(en) unter ${SOURCE_ROOTS.join('/ und ')}/, ${skipped.length} ohne Logik-Budget, ${hotFiles.length} in der Hot Zone`);
if (isVerbose()) {
  for (const file of skipped) console.log(`  skip ${file.name} (${file.reason})`);
  for (const file of files) {
    const mark = violations.includes(file) ? 'FAIL' : file.hot ? 'HOT ' : ' ok ';
    const note = file.unauthorized
      ? ' (Ausnahme verboten)'
      : file.stale
        ? ' (Ausnahme ueberfluessig)'
        : ` [${file.budget}]${file.hot ? ` Hot Zone ab ${file.hotZone}` : ''}${file.hotChange ? ' | geaendert: modularisieren oder ASK_USER' : ''}`;
    console.log(`  ${mark} ${String(file.lines).padStart(4)}/${file.limit}${note}  ${file.name}`);
  }
}

if (violations.length > 0) {
  violations.forEach((file) => {
    const reason = file.unauthorized
      ? `${file.lines} LOC: Explizite Ausnahmen sind verboten. Header entfernen und auf hoechstens ${file.hotZone} LOC reduzieren.`
      : file.stale
        ? `${file.lines} LOC: Ausnahme ist ueberfluessig. Header entfernen; die Datei liegt schon unter ${file.hotZone}.`
        : file.hotChange
          ? `${file.lines} LOC: Hot Zone und in diesem Lauf geaendert. Modularisiere die Datei mit eigener Ownership und Pruefung. Wenn eine LOC-Erhoehung fachlich besser ist als die Extraktion, stelle ASK_USER mit Begruendung, warum die Erhoehung besser ist.`
          : `${file.lines} LOC (Grenze ${file.limit}). Reduziere auf hoechstens ${file.hotZone} LOC, um die Hot Zone zu verlassen.`;
    fail(violations.indexOf(file) + 1, 'ERR-4012', file.name, reason);
  });
  process.exit(1);
}

if (hotFiles.length > 0) {
  const changedHot = hotFiles.filter((file) => file.hotChange).length;
  console.log(`\ncheck:loc - ${hotFiles.length} Datei(en) in der Hot Zone, ${changedHot} in diesem Lauf geaendert. Aenderungen muessen modularisiert oder als ASK_USER begruendet werden.`);
}
console.log('\ncheck:loc - OK, alle Dateien innerhalb ihres Budgets');
