#!/usr/bin/env node
/**
 * verify:headless - `src/core/` darf keine UI-, Renderer-, Pixi-, React- oder
 * DOM-Abhaengigkeiten importieren. Der Scanner liest nur; jeder Verstoss ist
 * ein Gate-Fehler, kein Hinweis.
 */
import { scanHeadlessCore } from './lib/headless-core.mjs';
import { captureConsole } from './lib/compact.mjs';
// Sichtbare Antwort bleibt unter 500 Token; vollstaendig im Log.
captureConsole({ label: 'verify-headless-core' });

const result = scanHeadlessCore(process.cwd());
if (result.violations.length === 0) {
  console.log(`headless-core: PASS (${result.files} Core-Dateien, keine Grenzverletzung)`);
  process.exit(0);
}

console.error(`headless-core: ${result.violations.length} Grenzverletzung(en) in src/core`);
for (const violation of result.violations) {
  console.error(`  ${violation.file}: ${violation.reason} ('${violation.specifier}')`);
}
console.error('headless-core: Core bleibt headless; UI/Renderer/Pixi/React/DOM gehoeren nicht in src/core.');
process.exit(1);
