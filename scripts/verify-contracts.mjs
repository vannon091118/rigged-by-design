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
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { captureConsole, compact } from './lib/compact.mjs';
import { checkContracts, contractIds, loadClaims, parseIndex } from './lib/contracts.mjs';
import { fail, ROOT } from './lib/report.mjs';

captureConsole({ label: 'verify-contracts' });
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
