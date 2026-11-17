/**
 * Formatierung der Ursachenanalyse: eine Zeile, Faktenblock, kompakter Block.
 * Keine zweite Datenquelle; die Befunde kommen bereits angereichert herein.
 */
import { compact, field } from './compact.mjs';

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
