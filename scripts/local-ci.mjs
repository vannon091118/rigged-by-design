#!/usr/bin/env node
/**
 * Der lokale CI-Runner. Er ersetzt die frueheren GitHub-Workflows fuer
 * Verifikation, Build und APK: jeder Nachweis laeuft auf der Maschine, die
 * auch entwickelt. Es gibt keinen zweiten Testpfad und keine Cloud-Warteschlange.
 *
 * Profile:
 *   gate       Struktur-Gates, Testqualitaet, betroffene Tests, Build (Default)
 *   full       alle Required-Gates plus vollstaendige Suite ohne Mechanik
 *   release    wie full, Audit erzwungen
 *   mechanics  ausschliesslich Statistik-, Soak- und Langlauf-Nachweise
 *   apk        lokaler Debug-APK-Build (setzt den Web-Build voraus)
 *
 * `--strict` ergaenzt die frueheren Cloud-Preflight-Schritte (Commit-Nachricht,
 * Claim, Task-Vertrag, Freeze, optional PR-Body). Sie sind opt-in, weil der
 * lokale Lauf waehrend einer Lane ohne offenen PR stattfinden darf.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib/report.mjs';

const argv = process.argv.slice(2);
const value = (name, fallback) => {
  const hit = argv.find((entry) => entry.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  const at = argv.indexOf(`--${name}`);
  const next = at >= 0 ? argv[at + 1] : undefined;
  return next && !next.startsWith('--') ? next : fallback;
};
const profile = value('profile', 'gate');
const allowed = new Set(['gate', 'full', 'release', 'mechanics', 'apk']);
if (!allowed.has(profile)) {
  console.error(`ci:local: unbekanntes Profil '${profile}'; erlaubt sind ${[...allowed].join(', ')}`);
  process.exit(1);
}
const strict = argv.includes('--strict') || profile === 'release';
const withApk = argv.includes('--apk');

const node = process.execPath;
const step = (label, script, args = [], env = {}) => {
  console.log(`ci:local: ${label}`);
  const result = spawnSync(node, [join(ROOT, 'scripts', script), ...args], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  if (result.error) {
    console.error(`ci:local: ${label} konnte nicht gestartet werden: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
};

// Strict-Preflight ist der fruehere Cloud-Kopf: Er prueft den vorhandenen
// Commit und den lokalen Zustand, nicht einen zweiten Checkout.
if (strict) {
  step('Commit-Nachricht', 'verify-commit-msg.mjs', ['--head']);
  if (existsSync(join(ROOT, '.lane-claims', 'claims'))) step('Lane-Claims', 'verify-lane-claims.mjs', ['--ci']);
  if (existsSync(join(ROOT, '.lane-claims', 'tasks'))) step('Task-Vertrag', 'verify-task-contract.mjs');
  step('Governance-Freeze', 'verify-governance-freeze.mjs');
  if (process.env.PR_BODY) step('PR-Body', 'verify-pr-body.mjs');
}

const pipelineProfile = profile === 'gate' ? 'integration' : profile;
if (profile !== 'apk') {
  step(`Testlinie (${pipelineProfile})`, 'run-pipeline.mjs', [`--profile=${pipelineProfile}`]);
}
if (profile === 'apk' || withApk) {
  if (!existsSync(join(ROOT, 'dist', 'index.html'))) {
    step('Web-Build', 'run-pipeline.mjs', ['--profile=full', '--gate=build']);
  }
  step('Debug-APK', 'prepare-android.mjs');
}

console.log(`ci:local: PASS (${profile}${strict ? ', strict' : ''}${withApk ? ', apk' : ''}) - lokal, ohne Cloud-Runner`);
