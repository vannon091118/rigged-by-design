#!/usr/bin/env node
/**
 * Testkatalog schreiben (`npm run catalog`) oder pruefen (`--check`).
 *
 * Der Katalog ist eine abgeleitete Tabelle: System aus `@test-target`,
 * Beweisklasse aus der Rolle der Datei. `--check` schreibt nichts und wird rot,
 * sobald eine Testdatei fehlt oder ihre Einordnung sich geaendert hat.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fail, ROOT } from './lib/report.mjs';
import { CATALOG_END, CATALOG_START, LONG_PROOF_CLASSES, catalogEntries, renderCatalog, testFiles } from './lib/test-catalog.mjs';

const docPath = join(ROOT, 'docs', 'TEST-CATALOG.md');
const checkOnly = process.argv.includes('--check');
const files = testFiles();
const entries = catalogEntries(files);
const block = renderCatalog(entries);

const header = [
  '# Testkatalog',
  '',
  'Abgeleitet aus `@test-target` (System) und der Rolle der Datei (Beweisklasse).',
  'Der Katalog wird von `npm run catalog` geschrieben und von `npm run verify:all`',
  'im `--check`-Modus geprueft: eine neue Testdatei ohne Eintrag macht den Lauf rot.',
  '',
  `Beweisklassen: ${['contract', 'integration', 'governance', 'statistics', 'performance'].join(', ')}.`,
  `Lokal laufen nur Vertrags-, Integrations- und Governance-Nachweise; ${LONG_PROOF_CLASSES.join(' und ')}`,
  'delegiert `npm run test:affected` an GitHub Actions (`npm run ci:long`).',
  '',
].join('\n');

// Git checkt auf Windows mit CRLF aus, der Generator schreibt LF. Ohne
// Normalisierung meldet das Gate sonst bei jedem frischen Checkout faelschlich
// "veraltet", obwohl der Inhalt identisch ist.
const current = existsSync(docPath) ? readFileSync(docPath, 'utf8').replaceAll('\r\n', '\n') : '';
const hasBlock = current.includes(CATALOG_START) && current.includes(CATALOG_END);
const next = hasBlock
  ? current.replace(new RegExp(`${CATALOG_START}[\\s\\S]*?${CATALOG_END}`), block)
  : `${header}${block}\n`;

const long = entries.filter((entry) => entry.long).length;
console.log(`test-catalog: ${entries.length} Dateien, ${entries.length - long} lokal, ${long} an CI delegiert`);

if (next === current) {
  console.log('test-catalog: PASS, Katalog aktuell');
  process.exit(0);
}
if (checkOnly) {
  fail(1, 'ERR-4015', 'test-catalog', 'Katalog ist veraltet; npm run catalog ausfuehren');
  process.exit(1);
}
mkdirSync(join(ROOT, 'docs'), { recursive: true });
writeFileSync(docPath, next);
console.log('[IDX-0001] [ERR-0911-AUTOFIXED] test-catalog: docs/TEST-CATALOG.md aktualisiert');
