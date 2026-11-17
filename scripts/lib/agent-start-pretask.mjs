/**
 * Der Pretask-Teil von agent:start: derselbe Vertrag wie `agent:pretask`,
 * aufgerufen ohne zweite Runde. Ein Blocker nennt den loesenden Befehl.
 */
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { ROOT } from './report.mjs';

export function summarizePretask(parsed) {
  const task = parsed?.taskState ?? {};
  return {
    mode: parsed?.mode ?? null,
    claimState: parsed?.claimState ?? null,
    phase: task.phase ?? null,
    status: task.status ?? null,
    blockers: Array.isArray(parsed?.blockers) ? parsed.blockers.slice(0, 3) : [],
    nextActions: Array.isArray(parsed?.nextActions) ? parsed.nextActions.slice(0, 2) : [],
  };
}

/** Ein pretask-Blocker nennt oft nur den Halter; hier kommt der Loesebefehl. */
export function withResolution(text) {
  const holder = /durch ([A-Za-z0-9_.-]+) geclaimt/.exec(String(text))?.[1];
  if (holder) return `${text}; wenn du diese Session bist: \`RBD_AGENT=${holder} pnpm run agent:start --brief\`, sonst RELEASE/HANDOFF abwarten`;
  return text;
}

export function runPretaskVerdict({ flag, value }) {
  if (flag('no-pretask')) return { ran: false, reason: '--no-pretask gesetzt' };
  const args = [join(ROOT, 'scripts', 'pretask.mjs'), '--json'];
  const budget = value('new-governance-issues', process.env.RBD_NEW_GOVERNANCE_ISSUES ?? '0');
  if (budget !== null && budget !== undefined) args.push('--new-governance-issues', String(budget));
  const options = { cwd: ROOT, encoding: 'utf8', timeout: 45000, stdio: ['ignore', 'pipe', 'pipe'] };
  try {
    return { ran: true, ...summarizePretask(JSON.parse(execFileSync(process.execPath, args, options))) };
  } catch (error) {
    try {
      return { ran: true, ...summarizePretask(JSON.parse(String(error?.stdout ?? ''))) };
    } catch {
      return { ran: false, reason: `pretask nicht auswertbar (${String(error?.message ?? error).split('\n')[0].slice(0, 120)}); Fallback: \`pnpm run agent:pretask --json\`` };
    }
  }
}
