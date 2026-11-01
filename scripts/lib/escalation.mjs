/**
 * Eine Leiter fuer jeden Fehlschlag, in fester Reihenfolge:
 * erst automatisch reparieren, dann in CI wiederholen, erst danach ein Agent.
 * Fail-Closed bleibt fuer Geld, Ledger, Save-Integritaet und Rechte.
 */
export const LEVELS = Object.freeze(['AUTO_FIX', 'LOCAL_GATE', 'REMOTE_CI', 'AGENT', 'BLOCKED']);

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
    hint: 'Struktur, Sektion oder Zustaendigkeit fehlt: Agent entscheidet.',
  },
});

const RULES = Object.freeze([
  { kind: 'BLOCKED', test: /ledger|vacoins?|save-?integrit|prng|\brng\b|geld|buchung|invariante/i },
  { kind: 'AUTOFIXABLE', test: /err-0911|doku-marker|rbd-doc|nicht synchron|veraltet|testkatalog|dependency-matrix|eslint --fix/i },
  { kind: 'TRANSIENT', test: /econn|etimedout|enotfound|eai_again|rate limit|502|503|504|registry|network/i },
  { kind: 'SCOPE', test: /ausserhalb des scopes|outside scope|not in scope|scope-fremd/i },
]);

export function classify(text) {
  const value = String(text ?? '');
  for (const rule of RULES) if (rule.test.test(value)) return rule.kind;
  return 'STRUCTURE';
}

export function plan(text) {
  const kind = classify(text);
  return { kind, ...KINDS[kind], reason: String(text ?? '').trim().slice(0, 160) };
}

export function describePlan(entry) {
  return `Eskalation ${entry.level}: ${entry.action} - ${entry.hint}`;
}
