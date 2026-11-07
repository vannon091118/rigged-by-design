#!/usr/bin/env node
/**
 * Lokales Feedback aus dem echten Diff.
 *
 * Kein zweiter Selektor: die Auswahl kommt aus `scripts/lib/affected-tests.mjs`,
 * demselben Modul, das `test:affected` und der CI-Plan verwenden. Die Ausgabe
 * ist eine Zeile (oder `--json`), damit ein Agent den naechsten sinnvollen
 * Schritt kennt, ohne Logs zu lesen. Ausgefuehrt wird hier nichts.
 */
import { changedFiles, selectAffectedTests } from './lib/affected-tests.mjs';

const json = process.argv.includes('--json');
const changed = changedFiles();
const selection = selectAffectedTests(changed);
const next = selection.runAll
  ? 'pnpm run verify:quick'
  : selection.tests.length > 0
    ? 'pnpm run test:affected'
    : 'pnpm run verify:light';
const report = {
  changed,
  tests: selection.tests,
  runAll: selection.runAll,
  reason: selection.reason,
  next,
};

if (json) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  const scope = selection.runAll ? 'voller Lauf' : `${selection.tests.length} Test(s)`;
  const why = selection.reason ?? (selection.runAll ? 'konservativer Fallback' : 'gezielt');
  console.log(`feedback: ${changed.length} Datei(en) · ${scope} · ${why} · ${next}`);
}
