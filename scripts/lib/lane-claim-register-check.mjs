/**
 * Registerstand gegen die vertrauenswuerdige Basis: Die erste Beruehrung des
 * Registers im PR zaehlt als Registrierung, damit eine Lane ihre Allowlist
 * nicht ueber mehrere Commits erweitern kann.
 */
import { execFileSync } from 'node:child_process';
import { auditRegisterAgainstBase } from './lane-claims.mjs';

function firstTouchCommit(range) {
  try {
    return (
      execFileSync('git', ['rev-list', '--reverse', range, '--', '.lane-claims'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      })
        .split(/\r?\n/)
        .find(Boolean) ?? ''
    );
  } catch {
    return '';
  }
}

/** Registerstand an einer Ref; `null` heisst: nicht lesbar (fail-closed). */
function registerAt(ref) {
  const entries = [];
  try {
    const data = JSON.parse(
      execFileSync('git', ['show', `${ref}:.lane-claims/claims.json`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }),
    );
    if (!Array.isArray(data)) return null;
    entries.push(...data);
  } catch {
    // Kein Legacy-Register an dieser Ref: Claim-Dateien koennen trotzdem existieren.
  }
  try {
    const names = execFileSync('git', ['ls-tree', '-r', '--name-only', ref, '--', '.lane-claims/claims'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).split(/\r?\n/).filter((name) => name.endsWith('.json'));
    for (const name of names) {
      const data = JSON.parse(
        execFileSync('git', ['show', `${ref}:${name}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }),
      );
      entries.push(...(Array.isArray(data) ? data : [data]));
    }
  } catch {
    // Kein Claim-Verzeichnis an dieser Ref.
  }
  return entries.length > 0 ? entries : null;
}

/**
 * Prueft das Register gegen die Basis. Ein nicht lesbares Basis-Register ist
 * in CI fail-closed, lokal nur eine Notiz; der Aufrufer entscheidet.
 */
export function auditRegisterBase({ baseRef, headRef, allClaims, branch }) {
  const baseRegister = registerAt(baseRef);
  if (!baseRegister) return { ok: true, audited: false, unreadable: true, violations: [] };
  const firstTouch = firstTouchCommit(`${baseRef}..${headRef}`);
  const firstRegister = firstTouch ? registerAt(firstTouch) : null;
  const audit = auditRegisterAgainstBase({
    baseClaims: baseRegister,
    registrationClaims: firstRegister ?? baseRegister,
    nextClaims: allClaims.map((entry) => entry.toJSON()),
    branch,
  });
  return { ok: audit.ok, audited: true, unreadable: false, violations: audit.violations };
}
