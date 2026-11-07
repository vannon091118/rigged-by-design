/**
 * Eine Wahrheit fuer eine kleine, aber teure Frage: haben sich Abhaengigkeiten
 * wirklich geaendert?
 *
 * `pnpm audit` ist das einzige Gate, das die Registry braucht. Es lief bisher
 * in jedem vollen Lauf, obwohl der Turn-Versionsbump nur die `version`-Zeile
 * anfasst. Hier steht die Regel einmal; `run-pipeline` und die CI-Gate-Matrix
 * lesen beide daraus, statt sie je neu zu erfinden.
 */
import { execFileSync } from 'node:child_process';
import { ROOT } from './report.mjs';

const FILES = Object.freeze(['package.json', 'pnpm-lock.yaml']);

/** Der Versionsbump ist keine Dependency-Aenderung. */
const isDependencyLine = (line) =>
  /^[+-]/.test(line) && !/^(\+\+\+|---)/.test(line) && !/^[+-]\s*"version":/.test(line);

const PROBES = Object.freeze([
  ['diff', '--unified=0', 'HEAD'],
  ['diff', '--unified=0', 'HEAD~1', 'HEAD'],
  ['diff', '--unified=0', 'origin/main...HEAD'],
]);

/**
 * `true`, sobald irgendein Vergleich echte Aenderungen an Manifest oder
 * Lockfile zeigt. Ein nicht ausfuehrbarer Vergleich zaehlt als Aenderung:
 * Unklarheit heisst pruefen, nicht ueberspringen.
 */
export function dependencyChanged(probes = PROBES) {
  for (const probe of probes) {
    let out;
    try {
      out = execFileSync('git', [...probe, '--', ...FILES], { cwd: ROOT, encoding: 'utf8' });
    } catch {
      return true;
    }
    if (out.split(/\r?\n/).some(isDependencyLine)) return true;
  }
  return false;
}

/** Erzwungen (`RBD_VERIFY_AUDIT=1`) oder echte Aenderung: das Audit-Gate laeuft. */
export function auditRequired(env = process.env) {
  return env.RBD_VERIFY_AUDIT === '1' || dependencyChanged();
}
