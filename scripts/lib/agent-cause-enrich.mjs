/**
 * Anreicherung eines Rohbefunds: Code, Tier, Pfad, Fix und Repro.
 *
 * Eine Quelle fuer die Sprache: `gate-diagnostics` liefert den Code,
 * `escalation` den Tier, `repair-plan` den Gate-Namen.
 */
import { plan as escalationPlan } from './escalation.mjs';
import { GATES } from './pipeline-plan.mjs';

export const FIX = Object.freeze({
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

export const TIER = Object.freeze({
  BLOCKED: 'fail-closed',
  AUTO_FIX: 'escalate-repair',
  REMOTE_CI: 'remote-retry',
  LOCAL_GATE: 'outside-scope',
  AGENT: 'fail-open-with-issue',
});

const CODE = /(ERR-\d{4})/;
const PATH = /((?:src|scripts|content|docs|\.github)\/[^\s:]+)/;

export function clip(value, max = 240) {
  const text = String(value ?? '').trim();
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

/**
 * Repro ohne Logsuche: erst der betroffene Test, sonst das Gate im
 * CI-Profil. `profile=full` ist Absicht - der Befund stammt aus der CI.
 */
export function reproFor({ gate, failedTest }) {
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

export function enrich(entry) {
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
