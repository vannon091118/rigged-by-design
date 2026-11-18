#!/usr/bin/env node
/**
 * Gate: Vertragseinhaltung global.
 *
 * Die Vertragsliste kommt aus `docs/contracts/`, nicht aus einer zweiten Liste.
 * Geprueft wird jede Zeile: Datei vorhanden, Roster-Owner, Lane-Writer,
 * existierender Vertragstest mit `@test-target` und Contract-ID, Status-Zeile
 * in der Vertragsdatei und hoechstens ein schreibender offener Claim je
 * Contract. Ein neuer Vertrag ohne Test oder ohne Tabellenzeile ist rot.
 *
 * Exit 0 = alle Vertraege eingehalten, Exit 1 = mindestens ein Befund.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { captureConsole, compact } from './lib/compact.mjs';
import { checkContracts, contractIds, loadClaims, parseIndex } from './lib/contracts.mjs';
import { fail, ROOT } from './lib/report.mjs';

captureConsole({ label: 'verify-contracts' });

// Ein Vertrag, den git nicht ausfuehrt, ist Prosa: ohne `core.hooksPath` oder
// ohne Modus 100755 ueberspringt git den Hook still. Der Zustand kommt aus
// `install-hooks.mjs --check` — eine Quelle fuer Install, Bootstrap und Gate.
const hooks = spawnSync(process.execPath, [join(ROOT, 'scripts', 'install-hooks.mjs'), '--check'], {
  cwd: ROOT,
  encoding: 'utf8',
});
if (hooks.status !== 0) {
  console.error(
    compact({
      status: 'ROT',
      headline: 'Hooks nicht scharf; kein Gate wird ausgefuehrt',
      facts: [
        ['Bootstrap', 'node scripts/install-hooks.mjs'],
        ['Quelle', 'install-hooks.mjs --check'],
      ],
      findings: `${hooks.stdout ?? ''}${hooks.stderr ?? ''}`
        .trim()
        .split('\n')
        .filter(Boolean)
        .slice(0, 3),
    }),
  );
  fail(1, 'ERR-4018', 'contracts', 'Hooks nicht scharf; `node scripts/install-hooks.mjs` armen und erneut pruefen');
  process.exit(1);
}

const ids = contractIds(ROOT);
const rows = parseIndex(readFileSync(join(ROOT, 'docs', 'contracts', 'README.md'), 'utf8'));
const findings = checkContracts({ root: ROOT, ids, rows, claims: loadClaims(ROOT) });

if (findings.length > 0) {
  console.error(
    compact({
      status: 'ROT',
      headline: `${findings.length} Verstoss/Verstoesse gegen die Vertragseinhaltung`,
      facts: [
        ['Vertraege', `${ids.length} Dateien, ${rows.length} Tabellenzeilen`],
        ['Geprueft', 'Owner, Writer, Vertragstest, Status, Claim-Modus'],
      ],
      findings,
    }),
  );
  fail(1, 'ERR-4019', 'contracts', `${findings.length} Vertrag/Vertraege nicht mechanisch belegt`);
  process.exit(1);
}

console.log(
  compact({
    status: 'GRUEN',
    headline: 'alle Vertraege mechanisch belegt',
    facts: [
      ['Vertraege', `${ids.length} Dateien, ${rows.length} Tabellenzeilen`],
      ['Geprueft', 'Owner, Writer, Vertragstest, Status, Claim-Modus'],
      ['Quelle', 'docs/contracts/ — keine zweite Liste'],
    ],
  }),
);
process.exit(0);
