/**
 * Roter Stand auf `integration`: nur Meta-Konflikte (Marker/Version) werden
 * mechanisch geloest; ein Textkonflikt wird nicht erzwungen.
 */
import { readFileSync } from 'node:fs';
import { META_FILES } from './lane-claims.mjs';

/** Eine Zeile, die das System schreibt, nicht ein Mensch. */
const SYSTEM_LINE = /^(?:<!--\s*rbd-doc:.*-->|"version":\s*".*",?)$/;

export function createIntegration({
  git, gh, label, log, warn, subject, openPr,
  MAIN, INTEGRATION, RED_LABEL, CONFLICT_LABEL, branch, identity,
}) {
  const conflicted = () => (git(['diff', '--name-only', '--diff-filter=U']) ?? '').split(/\r?\n/).filter(Boolean);

  const resolveMetaConflicts = () => {
    for (const file of conflicted()) {
      if (!META_FILES.includes(file)) continue;
      let text;
      try {
        text = readFileSync(file, 'utf8');
      } catch {
        continue;
      }
      const blocks = [...text.matchAll(/^<{7}.*\n([\s\S]*?)^={7}.*\n([\s\S]*?)^>{7}.*$/gm)];
      if (blocks.length === 0) continue;
      const mechanical = blocks.every(([, ours, theirs]) =>
        [...ours.split('\n'), ...theirs.split('\n')]
          .map((line) => line.trim())
          .filter(Boolean)
          .every((line) => SYSTEM_LINE.test(line)),
      );
      if (!mechanical) continue;
      if (git(['checkout', '--ours', '--', file]) === null) continue;
      git(['add', '--', file]);
      log(`Meta-Konflikt in ${file} automatisch geloest (Marker/Version)`);
    }
    return conflicted();
  };

  const integrate = (name) => {
    const number = openPr(name);
    let merged = git(['merge', '--no-ff', `origin/${name}`, '-m', `Integration: ${subject(`origin/${name}`)}`]);
    if (merged === null) {
      const remaining = resolveMetaConflicts();
      if (remaining.length === 0) merged = git(['commit', '--no-edit']);
    }
    if (merged === null) {
      git(['merge', '--abort']);
      label(number, CONFLICT_LABEL, 'Textkonflikt mit der Integrationsbranch');
      gh(['pr', 'comment', number, '--body', `Die Integrationsbranch \`${INTEGRATION}\` steht mit \`${name}\` in Konflikt. Der Stand wurde nicht erzwungen; bitte \`git merge origin/${INTEGRATION}\` aufloesen.`]);
      warn(`${name} kollidiert mit ${INTEGRATION}; nichts ueberschrieben`);
      return;
    }
    if (git(['push', 'origin', `HEAD:${INTEGRATION}`]) !== null) {
      gh(['pr', 'edit', number, '--remove-label', RED_LABEL]);
      log(`roter Stand ${name} auf ${INTEGRATION} gelegt`);
      return;
    }
    git(['fetch', 'origin', `+refs/heads/${INTEGRATION}:refs/remotes/origin/${INTEGRATION}`]);
    warn(`${name}: Rueckstand nicht erzwungen; Integrationsbranch bleibt unveraendert`);
  };

  const redBranches = () => {
    const raw = gh(['pr', 'list', '--label', RED_LABEL, '--state', 'open', '--json', 'headRefName', '--jq', '.[].headRefName']) ?? '';
    const fromLabel = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    return [...new Set([...fromLabel, branch])].filter((name) => name && name !== MAIN);
  };

  const promoteRed = () => {
    git(['fetch', 'origin', `+refs/heads/${MAIN}:refs/remotes/origin/${MAIN}`]);
    const exists = git(['rev-parse', '--verify', `refs/remotes/origin/${INTEGRATION}`]) !== null;
    if (exists) git(['fetch', 'origin', `+refs/heads/${INTEGRATION}:refs/remotes/origin/${INTEGRATION}`]);
    git(['checkout', '-B', INTEGRATION, `origin/${exists ? INTEGRATION : MAIN}`]);
    git(['config', 'user.name', identity.name]);
    git(['config', 'user.email', identity.email]);
    for (const name of redBranches()) {
      git(['fetch', `+refs/heads/${name}:refs/remotes/origin/${name}`]);
      integrate(name);
    }
  };

  return { promoteRed, integrate, resolveMetaConflicts, redBranches };
}
