/**
 * Klassifiziert die gestagten Pfade einer Lane: erlaubt, Marker/Version,
 * generiert, von gemergten Lanes uebernommen, zurueckgegeben oder Verstoss.
 */
import {
  COORDINATION_FILES, META_FILES, isTaskContractPath,
} from './lane-claim-schema.mjs';
import { generatedOnlyDiff } from './generated-files.mjs';
import { diffLines, onlySystemLines } from './lane-claim-diff.mjs';

const HOOK_FILES = Object.freeze(['.githooks/pre-commit', '.githooks/commit-msg']);

export function classifyStaged({ claim, staged, deletedFiles, mergedClaims, allClaims, git, diffBase }) {
  const violations = [];
  const allowedBySystem = [];
  const generatedMeta = [];
  const inherited = [];
  const handedOver = [];
  const diff = (file) => diffLines(file, { git, diffBase });

  for (const file of staged) {
    if (COORDINATION_FILES.includes(file)) continue;
    if (isTaskContractPath(file)) continue;
    if (HOOK_FILES.includes(file)) {
      if (!claim.allowsPath(file)) violations.push(`${file} (Hook-Datei nur mit Claim)`);
      continue;
    }
    if (META_FILES.includes(file)) {
      if (generatedOnlyDiff(file, diff(file))) {
        generatedMeta.push(file);
        continue;
      }
      if (claim.allowsPath(file)) continue;
      if (onlySystemLines(file, { git, diffBase })) {
        allowedBySystem.push(file);
        continue;
      }
      violations.push(`${file} (Meta-Datei: nur Marker/Version; alles andere braucht einen Claim)`);
      continue;
    }
    if (claim.allowsPath(file)) continue;
    if (onlySystemLines(file, { git, diffBase })) {
      allowedBySystem.push(file);
      continue;
    }
    const mergedOwner = mergedClaims.find((c) => c.allowsPath(file));
    if (mergedOwner) {
      inherited.push(`${file} <- ${mergedOwner.id}`);
      continue;
    }
    if (deletedFiles.has(file)) {
      const owner = allClaims.find((c) => c !== claim && c.allowsPath(file));
      if (owner) {
        handedOver.push(`${file} -> ${owner.id}`);
        continue;
      }
    }
    violations.push(file);
  }
  return { violations, allowedBySystem, generatedMeta, inherited, handedOver };
}
