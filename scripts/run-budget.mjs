#!/usr/bin/env node
/**
 * run-budget — externer Stop-Vertrag für einen Lauf.
 *
 *   node scripts/run-budget.mjs --check [--base origin/main] [--head HEAD]
 *        [--iterations 1] [--issues 1] [--new-governance-issues 0]
 *   node scripts/run-budget.mjs --finding <datei.json>
 *
 * `--check` liest die Commits aus Git und die Grenzen aus `docs/run-budget.json`.
 * Exit 0 = CONTINUE, Exit 2 = STOP (Kill-Switch oder Budget erschoepft).
 * `--finding` validiert ein neues Finding vor dem Issue; Exit 0 nur mit Beleg,
 * aktuellem Main-SHA, Duplikatpruefung, Severity und Produkt-/Infra-Zuordnung.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ROOT } from './lib/report.mjs';
import { decideRunBudget, readRunBudget, validateFinding } from './lib/run-budget.mjs';

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) throw new Error(`unerwartetes Argument '${token}'`);
    const key = token.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      index += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function integerArg(args, key, fallback) {
  if (args[key] === undefined) return fallback;
  const value = Number(args[key]);
  if (!Number.isInteger(value) || value < 0) throw new Error(`--${key} muss eine nichtnegative Ganzzahl sein`);
  return value;
}

function commitCount(base, head) {
  const output = execFileSync('git', ['rev-list', '--count', `${base}..${head}`], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
  return Number(output);
}

try {
  const args = parseArgs(process.argv.slice(2));
  if (args.finding) {
    const file = resolve(ROOT, String(args.finding));
    const parsed = JSON.parse(readFileSync(file, 'utf8'));
    const result = validateFinding(parsed);
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.ok ? 0 : 1);
  }
  if (!args.check) throw new Error('--check oder --finding <datei.json> fehlt');
  const budgetFile = args.budget ? resolve(ROOT, String(args.budget)) : join(ROOT, 'docs/run-budget.json');
  const budget = readRunBudget(budgetFile);
  const base = String(args.base ?? 'origin/main');
  const head = String(args.head ?? 'HEAD');
  const result = decideRunBudget({
    commits: commitCount(base, head),
    iterations: integerArg(args, 'iterations', 1),
    issues: integerArg(args, 'issues', 1),
    newGovernanceIssues: integerArg(args, 'new-governance-issues', 0),
  }, budget);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.state === 'CONTINUE' ? 0 : 2);
} catch (error) {
  console.error(`[ERR-4019] run-budget: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
