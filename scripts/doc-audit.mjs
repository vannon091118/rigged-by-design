#!/usr/bin/env node
/**
 * Doku-Inventur und Budget-Nachweis.
 *
 * Aufruf:
 *   node scripts/doc-audit.mjs          # Tabelle + Befunde
 *   node scripts/doc-audit.mjs --json   # maschinenlesbar
 *   node scripts/doc-audit.mjs --check  # Exit 1 bei Befund
 */
import { captureConsole } from './lib/compact.mjs';
import { auditDocs } from './lib/doc-core.mjs';
import { RECEIPT_PATH, readingText, writeReceipt } from './lib/doc-read.mjs';

const args = process.argv.slice(2);
const json = args.includes('--json');
const check = args.includes('--check');
const read = args.includes('--read');

// Sichtbare Antwort bleibt unter 500 Token; `--json`, `--read` und
// RBD_OUTPUT_FULL=1 liefern absichtlich den vollstaendigen Inhalt.
captureConsole({ label: 'doc-audit', enabled: !json && !read });

if (read) {
  const text = readingText();
  process.stdout.write(text.endsWith('\n') ? text : `${text}\n`);
  const receipt = writeReceipt();
  if (!receipt.ok) {
    console.error(`doc-audit: Lesepfad ueber Budget oder unvollstaendig (${receipt.tokens}/${receipt.budget})`);
    process.exit(1);
  }
  console.log(`Receipt: ${RECEIPT_PATH} · ${receipt.tokens}/${receipt.budget} Token`);
  process.exit(0);
}

const report = auditDocs();

if (json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`Doku-Kern (Budget ${report.coreBudget} Token je Dokument, ${report.overviewBudget} gesamt)`);
  for (const doc of report.core) {
    const status = doc.ok ? 'ok' : 'ROT';
    console.log(`  ${status.padEnd(4)} ${String(doc.tokens).padStart(5)} Tok  ${doc.scope.padEnd(8)}  ${doc.path}`);
  }
  console.log(`  Lesepfad ${report.overviewTokens} Token (${report.overviewTokens}/${report.overviewBudget}) · ${report.reading.length} Dokumente`);
  console.log(`  Referenz: ${report.reference.length} Dateien, ${report.totals.markdownTokens} Token ausserhalb des Kerns`);
  if (report.problems.length > 0) {
    console.error(`  Befunde: ${report.problems.length}`);
    for (const problem of report.problems) console.error(`  - ${problem}`);
  } else {
    console.log('  Cross-Checks: PASS (Budget, Links, Ordner, Last Changes)');
  }
}

if (check && report.problems.length > 0) process.exit(1);
