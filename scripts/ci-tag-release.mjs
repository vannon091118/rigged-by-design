#!/usr/bin/env node
/**
 * Tag und Release fuer die Version, die im gepushten Commit steht.
 *
 * Der Workflow committet nichts: die Version wird lokal im Turn gebumpt, damit
 * `main` nach dem Push stehen bleibt. Umgebungsprobleme laufen ueber die
 * Eskalationsleiter aus `lib/release-escalation.mjs`: wiederholen, dann ein
 * hinterlegtes Release-Token, zuletzt ein sichtbarer Block mit Anleitung.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { blockedReason, classifyFailure, escalate, MAX_RETRIES, tokenFor } from './lib/release-escalation.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const git = (argv) => execFileSync('git', argv, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const wait = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
if (typeof pkg.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(pkg.version)) {
  throw new Error(`Ungueltige Version in package.json: ${String(pkg.version)}`);
}
const tag = `v${pkg.version}`;

const outputAt = process.argv.indexOf('--github-output');
if (outputAt >= 0 && process.argv[outputAt + 1]) {
  appendFileSync(process.argv[outputAt + 1], `tag=${tag}\n`);
}

const repo = process.env.GITHUB_REPOSITORY
  ?? git(['remote', 'get-url', 'origin']).replace(/^.*github\.com[:/]/, '').replace(/\.git$/, '');
// workflow_run setzt GITHUB_SHA auf den Default-Branch, nicht auf den
// getriggerten Commit. RELEASE_SHA benennt den geprueften Commit explizit.
const sha = process.env.RELEASE_SHA ?? process.env.GITHUB_SHA ?? git(['rev-parse', 'HEAD']);

const gh = (args, token) => {
  const result = spawnSync('gh', args, { cwd: ROOT, encoding: 'utf8', env: { ...process.env, GH_TOKEN: token } });
  return { ok: result.status === 0, message: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim() };
};

/** Ein vollstaendiger Versuch: existiert das Release schon, ist das Ziel erreicht. */
function attempt(token) {
  if (gh(['release', 'view', tag, '--json', 'tagName'], token).ok) {
    return { ok: true, note: `${tag} existiert bereits; kein neues Release, main bleibt unveraendert.` };
  }
  const tagRef = gh(['api', `repos/${repo}/git/ref/tags/${tag}`], token);
  if (!tagRef.ok && classifyFailure(tagRef.message) !== 'EXISTS') {
    const created = gh(['api', '--method', 'POST', `repos/${repo}/git/refs`, '-f', `ref=refs/tags/${tag}`, '-f', `sha=${sha}`], token);
    if (!created.ok) return { ok: false, kind: classifyFailure(created.message), message: created.message };
  }
  const release = gh(['release', 'create', tag, '--generate-notes', '--title', tag], token);
  if (!release.ok) return { ok: false, kind: classifyFailure(release.message), message: release.message };
  return { ok: true, note: `Release ${tag} erstellt; kein Commit, main bleibt unveraendert.` };
}

const hasElevatedToken = Boolean(process.env.RELEASE_TOKEN);
let level = 'WORKFLOW_TOKEN';
let tries = 0;
let failure;

for (;;) {
  const token = tokenFor(level, process.env);
  if (!token) {
    failure = { kind: 'PERMISSION', message: `Stufe ${level} hat kein Token` };
    break;
  }
  const result = attempt(token);
  if (result.ok) {
    console.log(result.note);
    process.exit(0);
  }
  failure = result;
  const next = escalate(level, result.kind, { hasElevatedToken });
  if (next === 'DONE') {
    console.log(`${tag} existiert bereits; kein neues Release.`);
    process.exit(0);
  }
  if (next === level) {
    if (tries >= MAX_RETRIES) break;
    tries += 1;
    console.log(`release: ${result.kind}; Versuch ${tries}/${MAX_RETRIES} auf Stufe ${level}`);
    wait(1_000 * tries);
    continue;
  }
  if (next === 'BLOCKED') break;
  console.log(`release: Stufe ${level} reicht nicht (${result.kind}); weiter mit ${next}.`);
  level = next;
  tries = 0;
}

const reason = blockedReason(failure.kind);
console.error(`::error::Release ${tag} blockiert: ${reason}`);
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `## Release ${tag} blockiert\n\n${reason}\n\n### Letzte Meldung\n\n\`\`\`\n${failure.message}\n\`\`\`\n`,
  );
}
process.exit(1);
