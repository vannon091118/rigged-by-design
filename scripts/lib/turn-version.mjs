/**
 * Versions-Bump vor dem Commit: genau einmal pro Aenderung, nicht pro
 * fehlgeschlagenem Lauf. Die Version bleibt Teil des Commits.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from './report.mjs';

export function announceVersion({ git, schmutz, bumpPatch }) {
  if (!schmutz) return;
  let headVersion = '';
  try {
    headVersion = JSON.parse(git(['show', 'HEAD:package.json'])).version ?? '';
  } catch {
    // Ohne package.json im HEAD wird gebumpt.
  }
  const treeVersion = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')).version;
  console.log(treeVersion === headVersion
    ? `turn:finish: Version ${bumpPatch()} gebumpt`
    : `turn:finish: Version ${treeVersion} bereits gebumpt (HEAD ${headVersion})`);
}
