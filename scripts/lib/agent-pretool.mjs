/**
 * Die Entscheidung des PreToolUse-Hooks, ohne Prozess und ohne Seiteneffekt.
 *
 * Vor dem ersten Arbeitsschritt muss der 10k-Lesepfad als Receipt belegt sein.
 * Erlaubt bleiben genau zwei Wege, ihn zu erzeugen: `rbd docs read` und das
 * direkte Lesen eines der sieben Kerne (damit ein Agent den Befehl findet).
 * Ist das Receipt gueltig, bleibt Arbeit frei; zusaetzlich wird eine Pipe
 * blockiert, die Gate-/Testausgabe durch `head`/`tail`/`grep` abschneidet und
 * damit den Exit-Status verschleiert.
 */
import { relative, resolve } from 'node:path';
import { READING_PATHS } from './doc-core.mjs';
import { LOSSY_PIPE, isDocReadCommand, receiptProblems } from './doc-read.mjs';

const GATE_COMMAND = /\b(?:pnpm|npm|rbd|vitest|node\s+scripts\/)/;

const norm = (path) => String(path ?? '').split('\\').join('/');

function isReadingDoc(file, root) {
  if (!file) return false;
  const path = norm(relative(root, resolve(root, file)));
  return READING_PATHS.includes(path);
}

export function pretoolDecision({ toolName = '', toolInput = {}, root = process.cwd() } = {}) {
  const command = typeof toolInput.command === 'string' ? toolInput.command : '';
  const problems = receiptProblems(root);

  if (problems.length === 0) {
    if (toolName === 'Bash' && GATE_COMMAND.test(command) && LOSSY_PIPE.test(command)) {
      return {
        decision: 'deny',
        reason:
          'Gate-/Testausgabe nicht durch head/tail/grep pipen: der Exit-Status geht verloren. ' +
          'Nutze `rbd ...` ohne Pipe und lies den gekuerzten Bericht.',
      };
    }
    return { decision: 'allow' };
  }

  // Der einzige erlaubte Arbeitsschritt ohne Receipt: den Lesepfad erzeugen.
  if (toolName === 'Bash' && isDocReadCommand(command)) return { decision: 'allow' };
  // Ein direktes Read eines Kerns ist kein Arbeiten; es hilft, den Befehl zu finden.
  if (toolName === 'Read' && isReadingDoc(toolInput.file_path, root)) return { decision: 'allow' };

  return {
    decision: 'deny',
    reason:
      `Pflichtlektuere fehlt oder ist veraltet. ${problems[0]} ` +
      'Fuehre `pnpm rbd docs read` aus (5 Kerne + Test-/Governance-Kern, <10k Token) und arbeite danach weiter.',
  };
}
