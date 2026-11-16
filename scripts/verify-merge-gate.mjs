#!/usr/bin/env node
/**
 * verify:merge-gate — ist der Merge nach `main` serverseitig gesperrt?
 *
 * Liest die klassische Branch-Protection und die Rulesets live ueber REST und
 * prueft: Pull-Request-Zwang, enforce_admins, blockierte Force-Pushes und
 * Loeschungen. Fehlende Status-Checks werden genannt, aber nicht als Verstoss
 * gezaehlt (FREEZE-0: es gibt keinen Cloud-Check).
 *
 * Aufruf:
 *   node scripts/verify-merge-gate.mjs
 *   pnpm rbd verify merge-gate
 *
 * Exit 0 = Schutz belegt, Exit 1 = Luecke mit Befund, Exit 2 = nicht abfragbar.
 */
import { rest } from './lib/github-rest.mjs';
import { mergeGateVerdict } from './lib/merge-gate.mjs';
import { captureConsole } from './lib/compact.mjs';

// Sichtbare Antwort bleibt unter 500 Token; vollstaendig im Log.
captureConsole({ label: 'verify-merge-gate' });

const protection = rest('protection');
const rulesets = rest('rulesets');
if (!protection.ok) {
  console.error(`ROT · main-Schutz nicht abfragbar (${protection.error})`);
  console.error('Benoetigt wird ein Token mit Leserecht auf Branch-Protection (Administration: read); GH_TOKEN setzen.');
  process.exit(2);
}
const verdict = mergeGateVerdict({
  protection: protection.data,
  rulesets: rulesets.ok ? rulesets.data : [],
  branch: 'main',
});
const f = verdict.facts;
console.log(`${verdict.ok ? 'GRUEN' : 'ROT'} · ${verdict.state === 'VERIFIED' ? 'main ist serverseitig geschuetzt' : 'main-Schutz unvollstaendig'}`);
console.log(`Schutz     ${f.protection ? 'vorhanden' : 'fehlt'} · PR-Zwang ${f.prRequired ? 'ja' : 'nein'} · Reviews ${f.approvals}`);
console.log(`Admins     ${f.enforceAdmins ? 'gebunden' : 'ausgenommen'} · Force-Push ${f.forcePushBlocked ? 'blockiert' : 'erlaubt'} · Loeschen ${f.deletionsBlocked ? 'blockiert' : 'erlaubt'}`);
console.log(`Checks     ${f.requiredChecks.length > 0 ? f.requiredChecks.join(',') : 'keine (FREEZE-0, dokumentiert)'} · Rulesets ${f.rulesets}`);
for (const finding of verdict.findings) console.log(finding);
if (verdict.step) console.log(`-> ${verdict.step}`);
process.exit(verdict.ok ? 0 : 1);
