/**
 * Eine Leiter fuer jeden Fehlschlag, in fester Reihenfolge:
 * erst automatisch reparieren, dann in CI wiederholen, erst danach ein Agent.
 * Fail-Closed bleibt fuer Geld, Ledger, Save-Integritaet und Rechte.
 */
import { readFileSync } from 'node:fs';
import { CATALOG } from './error-codes.mjs';

/** Die Leiter steht in src/Config/escalation-levels.json; issues.ts liest dieselbe Datei. */
export const LEVELS = Object.freeze(
  JSON.parse(readFileSync(new URL('../../src/Config/escalation-levels.json', import.meta.url), 'utf8')),
);

const KINDS = Object.freeze({
  BLOCKED: {
    level: 'BLOCKED',
    action: 'anhalten und Ursache beheben',
    hint: 'Geld, Ledger, RNG oder Save-Integritaet: kein Automatismus.',
  },
  AUTOFIXABLE: {
    level: 'AUTO_FIX',
    action: 'pnpm run fix',
    hint: 'Doku-Marker, Format, Matrix und Katalog werden automatisch geschrieben.',
  },
  TRANSIENT: {
    level: 'REMOTE_CI',
    action: 'CI erneut starten',
    hint: 'Netz, Registry oder Runner: lokal nicht reproduzierbar.',
  },
  SCOPE: {
    level: 'LOCAL_GATE',
    action: 'Befund als ausserhalb des Scopes verwerfen',
    hint: 'Kein Blocker fuer den Commit.',
  },
  STRUCTURE: {
    level: 'AGENT',
    action: 'AGENTS.md befolgen',
    hint: 'Struktur, Sektion, Balance oder Randfall: als Issue abholen, die Arbeit laeuft weiter.'
  },
});

const RULES = Object.freeze([
  // BLOCKED ist die Notarzt-Stufe, nicht die Werkstatt: nur echte
  // Invarianten und ein kaputter Start. Balance, ein schiefer Test, ein
  // Doku-Marker oder ein Randfall sind AGENT und werden ein Issue.
  { kind: 'BLOCKED', test: /ledger-?invariante|save-?integrit|(prng|rng)-?invariante|invariante verletzt|geldpfad|boot kaputt|app startet nicht|startet nicht mehr/i },
  { kind: 'AUTOFIXABLE', test: /err-0911|doku-marker|rbd-doc|nicht synchron|veraltet|testkatalog|dependency-matrix|eslint --fix/i },
  { kind: 'TRANSIENT', test: /econn|etimedout|enotfound|eai_again|rate limit|timeout|timed out|zeitlimit|cancel+ed|runner|flaky|sporadisch|502|503|504|registry|network/i },
  { kind: 'SCOPE', test: /ausserhalb des scopes|outside scope|not in scope|scope-fremd/i },
]);

export function classify(text) {
  const value = String(text ?? '');
  for (const rule of RULES) if (rule.test.test(value)) return rule.kind;
  return 'STRUCTURE';
}

/** Stufe aus dem Register: der Code entscheidet, Textmuster nur als Fallback. */
const KIND_BY_LEVEL = Object.freeze({
  BLOCKED: 'BLOCKED',
  AUTO_FIX: 'AUTOFIXABLE',
  REMOTE_CI: 'TRANSIENT',
  LOCAL_GATE: 'SCOPE',
  AGENT: 'STRUCTURE',
});

export function kindForCode(code) {
  const entry = CATALOG.get(code);
  return entry ? KIND_BY_LEVEL[entry.level] : undefined;
}

export function plan(text, code) {
  const kind = kindForCode(code) ?? classify(text);
  const entry = CATALOG.get(code);
  const scope = entry?.scope ?? (code === 'ERR-0000' || !entry ? 'triage' : kind === 'BLOCKED' ? 'lane' : kind === 'TRANSIENT' ? 'project' : 'advisory');
  return { kind, ...KINDS[kind], scope, code: code ?? null, reason: String(text ?? '').trim().slice(0, 160) };
}

export function describePlan(entry) {
  return `Eskalation ${entry.level}: ${entry.action} - ${entry.hint}`;
}
