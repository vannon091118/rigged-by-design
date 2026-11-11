#!/usr/bin/env node
/**
 * Kompakter CI-Status fuer den aktuellen PR-Kopf.
 *
 * Standard: eine Zeile. Kein `gh run watch`, keine Job-Matrix, kein Warten.
 * Optional: --json fuer Maschinen, --pr <nummer> fuer einen bestimmten PR.
 */
import { execFileSync } from 'node:child_process';
import { ROOT } from './lib/report.mjs';

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const prAt = argv.indexOf('--pr');
const prNumber = prAt >= 0 ? argv[prAt + 1] : null;

const runGh = (args) =>
  execFileSync('gh', args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

const git = (args) => {
  try {
    return execFileSync('git', args, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
};

const head = git(['rev-parse', '--short=7', 'HEAD']);
let payload;
try {
  const pr = JSON.parse(
    runGh([
      'pr',
      'view',
      ...(prNumber ? [prNumber] : []),
      '--json',
      'number,url,headRefOid,statusCheckRollup',
    ]),
  );
  const checks = pr.statusCheckRollup ?? [];
  const failed = checks.filter((check) =>
    ['FAILURE', 'CANCELLED', 'TIMED_OUT', 'ACTION_REQUIRED', 'STARTUP_FAILURE'].includes(
      check.conclusion,
    ),
  ).length;
  const passed = checks.filter((check) => check.conclusion === 'SUCCESS').length;
  const pending = checks.filter((check) => check.status !== 'COMPLETED' && !check.conclusion).length;
  const aggregate = checks.find((check) => check.name === 'Fail-Closed Gates');
  payload = {
    pr: pr.number,
    head: pr.headRefOid?.slice(0, 7) ?? head,
    url: pr.url,
    checks: checks.length,
    passed,
    failed,
    pending,
    aggregate: aggregate
      ? aggregate.conclusion?.toLowerCase() ?? aggregate.status?.toLowerCase() ?? 'unknown'
      : 'missing',
  };
} catch (error) {
  const message = error instanceof Error ? error.message.split('\n')[0] : 'gh nicht verfuegbar';
  if (asJson) {
    console.log(JSON.stringify({ ok: false, head, error: message }));
  } else {
    console.error(`ci:status: ${message}`);
  }
  process.exit(1);
}

if (asJson) {
  console.log(JSON.stringify({ ok: payload.failed === 0 && payload.pending === 0, ...payload }));
} else {
  console.log(
    `PR #${payload.pr} · ${payload.head} · ${payload.checks} Checks · ` +
      `${payload.passed} pass / ${payload.pending} offen / ${payload.failed} rot · ` +
      `Fail-Closed Gates ${payload.aggregate} · ${payload.url}`,
  );
}
