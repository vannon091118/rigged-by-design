#!/usr/bin/env node
/**
 * Shell-Gate-CLI. Wird von `scripts/shell/guard.bash` vor dem eigentlichen
 * Werkzeug aufgerufen. Exit 2 blockiert die Zeile; der Grund steht auf stderr
 * und im maschinenlesbaren Guard-State.
 */
import { recordViolation, shellGuardDecision } from './lib/shell-guard.mjs';
import { ROOT } from './lib/report.mjs';

const raw = process.argv.slice(2);
const at = raw.indexOf('--command');
const command = at >= 0 ? (raw[at + 1] ?? '') : '';
const root = process.env.RBD_GUARD_ROOT || ROOT;

const result = shellGuardDecision({ command, root });
if (result.decision === 'allow') process.exit(0);

recordViolation({ root, command, reason: result.reason, code: result.code });
console.error(`[RBD-GATE:${result.code}] ${result.reason}`);
if (result.code === 'DOC_READ') {
  console.error('[RBD-GATE] Naechster Schritt: `pnpm rbd docs read`, dann den Befehl erneut.');
} else if (result.code === 'LOSSY_PIPE') {
  console.error('[RBD-GATE] Naechster Schritt: Befehl ohne Pipe erneut; Exit-Status bleibt sichtbar.');
} else {
  console.error('[RBD-GATE] Naechster Schritt: Befehl korrigieren; der Guard loggt den Versuch.');
}
process.exit(2);
