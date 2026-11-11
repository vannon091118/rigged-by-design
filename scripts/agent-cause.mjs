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
 * Es gibt keine zweite Diagnose: die Befunde kommen aus `gate-diagnostics`,
 * der Tier aus `escalation`, der Gate-Name aus `repair-plan`. Dieses Skript
 * fuehrt sie nur zusammen und nennt den Repro-Befehl.
 *
 * Aufruf:
 *   pnpm run agent:cause                     # Kurzfassung
 *   pnpm run agent:cause --ci                # Befund aus dem letzten CI-Lauf
 *   pnpm run agent:cause --from-file=x.log   # ohne Netz und ohne gh
 *   pnpm run agent:cause --json              # maschinenlesbar
 *   pnpm run agent:cause --line              # Pfad | Gate | Code | Fix | Repro
 *   RBD_VERBOSE=1 pnpm run agent:cause       # mit Rohbefund je Gate
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compact, field, isVerbose } from './lib/compact.mjs';
import { plan as escalationPlan } from './lib/escalation.mjs';
import { diagnose } from './lib/gate-diagnostics.mjs';
import { loadClaims, selectClaim } from './lib/lane-claims.mjs';
import { GATES } from './lib/pipeline-plan.mjs';
import { gateOf } from './lib/repair-plan.mjs';
import { ROOT } from './lib/report.mjs';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
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

const CACHE_FILE = join(ROOT, '.verify-cache', 'ci-cause.json');

const git = (list) => {
  try {
    return execFileSync('git', list, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
};

/** `gh` ist optional; ohne Installation oder Anmeldung bleibt es bei `null`. */
const gh = (list) => {
  try {
    return execFileSync('gh', list, {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 25_000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
};

/** Was ein Befund praktisch verlangt; bewusst knapp und kopierbar. */
const FIX = Object.freeze({
  lint: 'pnpm run lint:fix',
  'check:loc': 'Datei splitten (Budget: scripts/loc-budgets.mjs, Hot Zone = 4/7 des Caps)',
  typecheck: 'pnpm run typecheck; Fehler am genannten Pfad beheben',
  'test-quality': 'Test unter __tests__/ ablegen und @test-target im Kopf setzen',
  'dead-code': 'Import-/Re-Export-/Aufruferkette verfolgen, dann reparieren oder Export behalten',
  docs: 'node scripts/doc-sync.mjs && node scripts/build-inventory.mjs',
  tree: 'Datei in den erlaubten Ordner verschieben (scripts/lib/subsystems.mjs)',
  redundancy: 'beide Quellen vergleichen, besseres Verhalten zusammenfuehren',
  assets: 'pnpm run assets:manifest',
  capabilities: 'docs/capabilities.json um den registrierten Test ergaenzen',
  narrative: 'Baustein unter content/narrative/contributions/ + node scripts/compile-narrative-content.mjs --write',
  catalog: 'pnpm run catalog',
  tests: 'pnpm run test:affected',
  affected: 'pnpm run test:affected',
  build: 'pnpm run build',
  audit: 'pnpm audit; Dependency pinnen oder aktualisieren',
  claims: 'pnpm run claim:register list; Claim fuer diesen Branch pruefen',
});

const TIER = Object.freeze({
  BLOCKED: 'fail-closed',
  AUTO_FIX: 'escalate-repair',
  REMOTE_CI: 'remote-retry',
  LOCAL_GATE: 'outside-scope',
  AGENT: 'fail-open-with-issue',
});

const CODE = /(ERR-\d{4})/;
const PATH = /((?:src|scripts|content|docs|\.github)\/[^\s:]+)/;

/** Repo-Slug aus dem Remote; kein API-Aufruf noetig. */
function repoSlug() {
  const remote = git(['remote', 'get-url', 'origin']);
  const match = /github\.com[:/]([^/]+)\/([^/.]+)(?:\.git)?$/.exec(remote);
  return match ? `${match[1]}/${match[2]}` : '';
}

function clip(value, max = 240) {
  const text = String(value ?? '').trim();
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

/** Letzte Pipeline-Summary; `null`, wenn keine existiert. */
function latestSummary() {
  const base = join(ROOT, '.verify-cache', 'reports');
  if (!existsSync(base)) return null;
  const runs = readdirSync(base)
    .map((name) => join(base, name))
    .filter((dir) => {
      try {
        return statSync(dir).isDirectory();
      } catch {
        return false;
      }
    })
    .sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs);
  for (const dir of runs) {
    const file = join(dir, 'summary.md');
    if (existsSync(file)) return { dir, text: readFileSync(file, 'utf8') };
  }
  return null;
}

/** Lokale rote Gates aus `agent:verify` (bevorzugt) oder aus der Summary. */
function localFindings() {
  const agentFile = join(ROOT, '.verify-cache', 'reports', 'agent', 'agent-summary.json');
  if (existsSync(agentFile)) {
    try {
      const report = JSON.parse(readFileSync(agentFile, 'utf8'));
      const failed = Array.isArray(report.failed) ? report.failed : [];
      const open = Array.isArray(report.open) ? report.open : [];
      const known = new Set(failed);
      return [
        ...failed.map((name) => ({ source: 'lokal', gate: name, line: `Gate ${name} fehlgeschlagen`, detail: '' })),
        // Ein offener, aber nicht als fehlgeschlagen gemeldeter Befund ist ein
        // eigener Hinweis; er darf nicht als gruen durchgehen.
        ...open.filter((entry) => !known.has(entry)).map((entry) => ({ source: 'lokal', gate: null, line: entry, detail: '' })),
      ];
    } catch {
      // Unlesbarer Bericht ist kein Befund; die Summary entscheidet.
    }
  }
  const summary = latestSummary();
  if (!summary) return [];
  return summary.text
    .split(/\r?\n/)
    .filter((line) => /^\|\s*[a-z0-9:_-]+\s*\|/.test(line) && /\|\s*FAIL\s*\|/.test(line))
    .map((line) => {
      const cells = line.split('|').map((cell) => cell.trim()).filter(Boolean);
      return { source: 'lokal', gate: cells[0], line: `Gate ${cells[0]} FAIL`, detail: '' };
    });
}

/**
 * Gate-Name aus dem Befund: erst der Step ('Gate lint'), dann der Logpfad
 * ('pipeline/lint'), dann der Jobname. Ohne diesen Schritt bliebe der Fix
 * generisch, obwohl das Log den Namen nennt.
 */
function gateNameOf(failure) {
  // Nur Namen akzeptieren, die der Gate-Plan kennt. Ein Jobname wie 'Gate log'
  // wuerde sonst als Gate 'log' gelten und den Fix unbrauchbar machen.
  const fromStep = gateOf(failure);
  if (fromStep && GATES[fromStep]) return fromStep;
  // Logzeilen enden auf `pipeline/<gate>: <meldung>`. `check:loc` traegt selbst
  // einen Doppelpunkt, deshalb wird der laengste bekannte Name gewaehlt.
  const raw = /pipeline\/([a-z0-9:_-]+):/i.exec(String(failure.line ?? ''))?.[1];
  if (raw) {
    const parts = raw.split(':');
    for (let count = parts.length; count >= 1; count -= 1) {
      const candidate = parts.slice(0, count).join(':');
      if (GATES[candidate]) return candidate;
    }
  }
  const name = String(failure.gate ?? '').replace(/^Gate\s+/i, '').trim();
  return name && GATES[name] ? name : null;
}

/** Befund aus einem heruntergeladenen Gate-Log, ohne Netz und ohne gh. */
function findingsFromLog(text) {
  const job = { name: 'Log', conclusion: 'failure', steps: [], id: 1 };
  const result = diagnose({ jobs: [job], logs: new Map([[1, text]]) });
  return result.failures.map((failure) => ({
    source: 'log',
    gate: gateNameOf(failure),
    code: failure.code,
    line: failure.line,
    failedTest: failure.failedTest ?? null,
  }));
}

/** Letzter `CI Verify`-Lauf fuer genau diesen HEAD; `null` ohne gh. */
function ciRunForHead(head, slug) {
  const raw = gh(['run', 'list', '--workflow=CI Verify', '--limit', '20', '--json', 'databaseId,headSha,conclusion,status,url']);
  if (!raw) return { run: null, reason: 'gh nicht verfuegbar oder nicht angemeldet' };
  try {
    const runs = JSON.parse(raw).filter((entry) => entry.headSha === head);
    if (runs.length === 0) return { run: null, reason: `kein CI Verify-Lauf fuer ${head.slice(0, 7)}` };
    runs.sort((left, right) => Number(right.databaseId) - Number(left.databaseId));
    return { run: runs[0], reason: null, slug };
  } catch {
    return { run: null, reason: 'gh-Antwort nicht lesbar' };
  }
}

/**
 * Befunde eines CI-Laufs: Jobs und je fehlgeschlagenem Job dessen vollstaendiges
 * Log. Gefiltert wird nicht - `gate-diagnostics` liest den ersten echten
 * Fehlercode und den betroffenen Testpfad selbst.
 */
function ciFindings(run, slug) {
  if (!run?.databaseId || !slug) return { findings: [], reason: 'kein Lauf' };
  const jobsRaw = gh(['api', `repos/${slug}/actions/runs/${run.databaseId}/jobs`]);
  if (!jobsRaw) return { findings: [], reason: 'Jobs nicht lesbar' };
  let jobs;
  try {
    jobs = JSON.parse(jobsRaw).jobs ?? [];
  } catch {
    return { findings: [], reason: 'Job-Liste nicht lesbar' };
  }
  const logs = new Map();
  for (const job of jobs.filter((entry) => entry.conclusion === 'failure' || entry.conclusion === 'timed_out')) {
    const text = gh(['api', `repos/${slug}/actions/jobs/${job.id}/logs`]);
    if (text) logs.set(job.id, text);
  }
  const result = diagnose({ jobs, logs });
  return {
    reason: null,
    findings: result.failures.map((failure) => ({
      source: 'ci',
      gate: gateNameOf(failure),
      code: failure.code,
      line: failure.line,
      failedTest: failure.failedTest ?? null,
      url: failure.url ?? run.url ?? null,
    })),
  };
}

function readCache(head) {
  try {
    const record = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
    return record?.head === head ? record : null;
  } catch {
    return null;
  }
}

function writeCache(record) {
  try {
    mkdirSync(join(ROOT, '.verify-cache'), { recursive: true });
    writeFileSync(CACHE_FILE, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
  } catch {
    // Der Cache ist Komfort; der Befund haengt nicht daran.
  }
}

/**
 * Repro ohne Logsuche: erst der betroffene Test, sonst das Gate im
 * CI-Profil. `profile=full` ist Absicht - der Befund stammt aus der CI, ein
 * Light-Lauf koennte ihn nicht reproduzieren.
 */
function reproFor({ gate, failedTest }) {
  // `affected` steht nur im dev-Profil; ein full-Repro waere dort kein Gate.
  if (gate === 'affected') return { file: failedTest ?? null, command: 'pnpm run test:affected' };
  if (failedTest && /\.(test|bench)\.[cm]?[jt]sx?$/.test(failedTest)) {
    return {
      file: failedTest,
      command: `pnpm exec vitest run --config src/Config/vite.config.ts ${failedTest}`,
    };
  }
  if (gate && GATES[gate]) {
    return { file: failedTest ?? null, command: `node scripts/run-pipeline.mjs --profile=full --gate=${gate}` };
  }
  return { file: failedTest ?? null, command: 'pnpm run verify:light' };
}

function codeFor(entry) {
  if (entry.code) return entry.code;
  const direct = CODE.exec(`${entry.line ?? ''} ${entry.detail ?? ''}`);
  if (direct) return direct[1];
  return GATES[entry.gate]?.code ?? 'ERR-4019';
}

function enrich(entry) {
  const code = codeFor(entry);
  const tier = TIER[escalationPlan(entry.line, code).level] ?? 'fail-open-with-issue';
  const path = entry.failedTest ?? PATH.exec(`${entry.line} ${entry.detail ?? ''}`)?.[1] ?? null;
  const repro = reproFor({ gate: entry.gate, failedTest: path });
  return {
    source: entry.source,
    gate: entry.gate,
    code,
    tier,
    path,
    fix: FIX[entry.gate] ?? 'Befund reproduzieren und Ursache beheben',
    repro: repro.command,
    reproFile: repro.file,
    log: entry.url ?? null,
    detail: clip(entry.line, 220),
  };
}

/** Befunde eines Logs, angereichert; auch fuer Tests importierbar. */
export function diagnoseLog(text) {
  return findingsFromLog(text).map(enrich);
}

/** Ein Gate ohne Log: Fix und Repro kommen aus demselben Plan wie in der CI. */
export function causeForGate(gate, { source = 'lokal', failedTest = null } = {}) {
  return enrich({ source, gate, code: null, line: `Gate ${gate} fehlgeschlagen`, failedTest });
}

/** Rote Gates aus dem lokalen Verify-Bericht; offene Notizen sind kein Gate. */
export function localCauses() {
  return localFindings().map(enrich).filter((finding) => finding.gate !== null);
}

/** Die fuenf Felder eines Befunds; eine Quelle fuer Block und Zeile. */
function causeFields(finding) {
  return [
    finding.path ?? finding.reproFile ?? '(kein Pfad)',
    finding.gate ?? '(unbekannt)',
    finding.code,
    finding.fix,
    finding.repro,
  ];
}

/** Eine Zeile mit Pfad, Gate, Code, Fix und Repro. */
export function causeLine(finding) {
  return causeFields(finding).join(' | ');
}

/** Die Faktenzeilen des agent:cause-Blocks, ohne zweite Formatierung. */
export function causeFacts(findings) {
  const facts = [];
  for (const finding of findings) {
    const [path, gate, code, fix, repro] = causeFields(finding);
    facts.push(field('Pfad', path));
    facts.push(field('Gate', `${gate}${finding.tier ? ` · ${finding.tier}` : ''}`));
    facts.push(field('Code', code));
    facts.push(field('Fix', fix));
    facts.push(field('Repro', repro));
  }
  return facts.filter(Boolean);
}

/** Kompakter Block fuer Pretask/Turn-Finish; leer, wenn es nichts zu zeigen gibt. */
export function causeBlock(findings, headline = 'agent:cause') {
  if (!Array.isArray(findings) || findings.length === 0) return '';
  return compact({ status: 'ROT', headline, facts: causeFacts(findings) });
}

function build() {
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
  const head = git(['rev-parse', 'HEAD']);
  const claim = selectClaim(loadClaims(), branch);
  const blockers = [];
  try {
    const state = JSON.parse(readFileSync(join(ROOT, '.verify-cache', 'task-state.json'), 'utf8'));
    for (const blocker of state.blockers ?? []) blockers.push(blocker);
  } catch {
    // Ohne Pretask-Zustand bleibt nur der Gate-Befund.
  }

  const base = {
    branch,
    head,
    claim: claim ? { id: claim.id, owner: claim.owner, status: claim.status, paths: claim.pathAllowlist.length } : null,
    blockers,
    ci: null,
  };

  // 1. Explizites Log: offline, deterministisch, ohne gh.
  if (fileArg) {
    if (!existsSync(fileArg)) return { ...base, findings: [], error: `Log nicht lesbar: ${fileArg}` };
    return { ...base, findings: diagnoseLog(readFileSync(fileArg, 'utf8')) };
  }

  // 2. Lokaler Bericht - schnell und ohne Wartezeit.
  const local = localFindings();
  if (local.length > 0 && !forceCi) {
    return { ...base, findings: local.map(enrich), ci: { used: false, reason: 'lokaler Bericht vorhanden' } };
  }

  // 3. CI-Lauf fuer genau diesen HEAD; Cache verhindert wiederholte Abfragen.
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

/** CLI nur beim direkten Aufruf; Importe (Tests) bekommen die reinen Helfer. */
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
  // Startblocker nach dem Befund: die Ursache ist die wichtigere Zeile.
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
