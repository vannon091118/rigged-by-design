#!/usr/bin/env node
/**
 * Ein Befehl, eine Antwort: welches Gate ist rot, welcher Code, welcher Pfad,
 * welcher Tier, welcher Fix, welcher Repro-Befehl.
 *
 * Quellen in dieser Reihenfolge:
 *   1. `--from-file=<log>`  ein heruntergeladenes Gate-Log (offline, testbar)
 *   2. `--ci`               der letzte `CI Verify`-Lauf fuer genau diesen HEAD
 *   3. lokaler Bericht      `.verify-cache/reports/agent/agent-summary.json`
 *   4. Gate-Summary         `.verify-cache/reports/<lauf>/summary.md`
 *
 * Die Diagnose liegt in `gate-diagnostics`, der Tier in `escalation`, der
 * Gate-Name in `repair-plan`; diese Datei fuehrt nur zusammen und druckt.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { captureConsole, compact, field, isVerbose } from './lib/compact.mjs';
import { enrich } from './lib/agent-cause-enrich.mjs';
import {
  ciFindings,
  ciRunForHead,
  diagnoseLog,
  localFindings,
  repoSlug,
} from './lib/agent-cause-sources.mjs';
import { causeLine } from './lib/agent-cause-report.mjs';
import { loadClaims, selectClaim } from './lib/lane-claims.mjs';
import { ROOT } from './lib/report.mjs';
import { readSection, setSection, stateStamp } from './lib/verify-state.mjs';

export { causeBlock, causeFacts, causeLine } from './lib/agent-cause-report.mjs';
export { causeForGate, diagnoseLog, localCauses } from './lib/agent-cause-sources.mjs';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
captureConsole({ label: 'agent-cause', enabled: !asJson });
const oneLine = args.includes('--line') || args.includes('--one-line');
const forceCi = args.includes('--ci');
const offline = args.includes('--offline');
const fileArg = (() => {
  const inline = args.find((value) => value.startsWith('--from-file='));
  if (inline) return inline.slice('--from-file='.length);
  const index = args.indexOf('--from-file');
  const next = index >= 0 ? args[index + 1] : '';
  return next && !next.startsWith('--') ? next : '';
})();

const git = (list) => {
  try {
    return execFileSync('git', list, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
};

function readCache(head) {
  const record = readSection('cause');
  return record?.head === head ? record : null;
}

function writeCache(record) {
  setSection('cause', { ...record, at: stateStamp() });
}

function build() {
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
  const head = git(['rev-parse', 'HEAD']);
  const claim = selectClaim(loadClaims(), branch);
  const blockers = [];
  const state = readSection('task');
  for (const blocker of state.blockers ?? []) blockers.push(blocker);

  const base = {
    branch,
    head,
    claim: claim ? { id: claim.id, owner: claim.owner, status: claim.status, paths: claim.pathAllowlist.length } : null,
    blockers,
    ci: null,
  };

  if (fileArg) {
    if (!existsSync(fileArg)) return { ...base, findings: [], error: `Log nicht lesbar: ${fileArg}` };
    return { ...base, findings: diagnoseLog(readFileSync(fileArg, 'utf8')) };
  }

  const local = localFindings();
  if (local.length > 0 && !forceCi) {
    return { ...base, findings: local.map(enrich), ci: { used: false, reason: 'lokaler Bericht vorhanden' } };
  }

  if (offline) return { ...base, findings: local.map(enrich), ci: { used: false, reason: '--offline' } };
  const slug = repoSlug();
  const cached = forceCi ? null : readCache(head);
  if (cached) return { ...base, findings: cached.findings.map(enrich), ci: { used: true, cached: true, runId: cached.runId, url: cached.url } };

  const lookup = ciRunForHead(head, slug);
  if (!lookup.run) {
    return { ...base, findings: local.map(enrich), ci: { used: false, reason: lookup.reason } };
  }

  const result = ciFindings(lookup.run, slug);
  if (result.reason) {
    return { ...base, findings: local.map(enrich), ci: { used: false, reason: result.reason, runId: lookup.run.databaseId, url: lookup.run.url } };
  }
  const findings = result.findings.map(enrich);
  const record = {
    version: 1,
    head,
    runId: lookup.run.databaseId,
    url: lookup.run.url ?? null,
    conclusion: lookup.run.conclusion ?? null,
    findings,
  };
  writeCache(record);
  return {
    ...base,
    findings,
    ci: { used: true, cached: false, runId: record.runId, url: record.url, conclusion: record.conclusion },
  };
}

function main() {
  const result = build();
  const status = result.error || result.findings.length > 0 || result.blockers.length > 0 ? 'ROT' : 'GRUEN';

  if (oneLine) {
    if (result.error) {
      console.log(`ROT · - | - | ERR-4019 | ${result.error} | -`);
    } else if (result.findings.length === 0) {
      console.log(`${status} · keine Befunde${result.blockers.length > 0 ? ` · ${result.blockers.length} Startblocker` : ''}`);
    } else {
      for (const finding of result.findings) console.log(`${status} · ${causeLine(finding)}`);
    }
    process.exit(status === 'ROT' ? 1 : 0);
  }

  if (asJson) {
    process.stdout.write(`${JSON.stringify({ status, ...result }, null, 2)}\n`);
    process.exit(status === 'ROT' ? 1 : 0);
  }

  const headline = [
    result.branch || '(kein Branch)',
    result.head ? result.head.slice(0, 7) : '-',
    result.claim ? result.claim.id : 'kein Claim',
    result.error ? 'Log nicht lesbar' : result.findings.length > 0 ? `${result.findings.length} Befund(e)` : 'keine roten Gates',
  ].join(' · ');

  const facts = [];
  if (result.ci?.used) {
    facts.push(field('CI-Lauf', `${result.ci.runId}${result.ci.conclusion ? ` · ${result.ci.conclusion}` : ''}${result.ci.cached ? ' · Cache' : ''}`));
  } else if (result.ci?.reason) {
    facts.push(field('CI', result.ci.reason));
  }
  if (result.error) facts.push(field('Fehler', result.error));

  for (const finding of result.findings.slice(0, 3)) {
    facts.push(field('Gate', `${finding.gate ?? '(unbekannt)'} · ${finding.code} · ${finding.tier}`));
    if (finding.path) facts.push(field('Datei', finding.path));
    facts.push(field('Fix', finding.fix));
    facts.push(field('Repro', finding.repro));
    if (finding.log) facts.push(field('Log', finding.log));
  }
  if (result.findings.length > 3) facts.push(field('Weiter', `${result.findings.length - 3} weitere · --json`));
  if (result.blockers.length > 0) facts.push(field('Start', result.blockers[0]));
  if (result.findings.length === 0 && result.blockers.length === 0 && !result.error) {
    facts.push(field('Naechster', 'pnpm run agent:pretask --brief  (vor dem ersten Edit)'));
  }

  const details = result.findings.map((finding) => `${finding.gate ?? '?'}: ${finding.detail}`);
  if (isVerbose() && result.findings.some((finding) => finding.reproFile)) {
    details.push(`repro-file: ${result.findings.find((finding) => finding.reproFile).reproFile}`);
  }
  if (isVerbose()) details.push('volles Log: gh run download <id> -n gate-log-<gate> -D .verify-cache/ci');

  console.log(compact({ status, headline, facts, details }));
  process.exit(status === 'ROT' ? 1 : 0);
}

const invokedDirectly = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) main();
