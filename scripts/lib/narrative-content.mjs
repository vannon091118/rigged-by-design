/**
 * NAR-09 content contract: contributions, controlled vocabulary, turn manifest
 * and the derived registry are one read-only validation unit. The registry
 * builder uses the same normalisation as the verifier, so a green Assets gate
 * means the checked-in registry is byte-for-byte explainable from the inbox.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  RUNTIME_REGISTRY_PATH, SLOT_MAP_PATH, buildCompiledRegistry,
  validateCompiledRegistry, validateRuntimeRegistry, validateSlotMap,
} from './narrative-compiler.mjs';
import { issue, readJson } from './narrative-schema.mjs';
import { loadVocabulary } from './narrative-vocabulary.mjs';
import { readContributions } from './narrative-contribution.mjs';
import { validateNarrativeData } from './narrative-manifest.mjs';

export { validateContribution } from './narrative-contribution.mjs';
export { validateManifest, validateNarrativeData } from './narrative-manifest.mjs';

export function loadNarrativeSources(root = resolve('.')) {
  const vocabularyResult = loadVocabulary(root);
  const readResult = readContributions(root);
  const manifestResult = readJson(root, 'content/narrative/turns/manifest.json');
  const issues = [...vocabularyResult.issues, ...readResult.issues, ...(manifestResult.error ? [issue(manifestResult.path, manifestResult.error)] : [])];
  const compiled = buildCompiledRegistry(readResult.contributions, vocabularyResult.vocabulary);
  if (!manifestResult.error) {
    issues.push(...validateNarrativeData({
      vocabulary: vocabularyResult.vocabulary,
      contributions: readResult.contributions,
      manifest: manifestResult.value,
      compiled,
    }));
  } else {
    issues.push(...compiled.issues);
  }
  return {
    ok: issues.length === 0,
    issues,
    vocabulary: vocabularyResult.vocabulary,
    contributions: readResult.contributions,
    manifest: manifestResult.value,
    compiled: compiled.document,
  };
}

export function loadNarrativeContent(root = resolve('.')) {
  const sources = loadNarrativeSources(root);
  const registryResult = readJson(root, 'content/narrative/registry/fragments.json');
  const issues = [...sources.issues];
  let runtimeRegistryText = null;
  let slotMapText = null;
  try {
    runtimeRegistryText = readFileSync(join(root, RUNTIME_REGISTRY_PATH), 'utf8');
  } catch (error) {
    issues.push(issue(RUNTIME_REGISTRY_PATH, error instanceof Error ? error.message : String(error)));
  }
  try {
    slotMapText = readFileSync(join(root, SLOT_MAP_PATH), 'utf8');
  } catch (error) {
    issues.push(issue(SLOT_MAP_PATH, error instanceof Error ? error.message : String(error)));
  }
  if (registryResult.error) issues.push(issue(registryResult.path, registryResult.error));
  else if (sources.issues.length === 0) {
    issues.push(...validateCompiledRegistry(registryResult.value, sources.compiled, registryResult.text));
    issues.push(...validateRuntimeRegistry(runtimeRegistryText, sources.compiled));
    issues.push(...validateSlotMap(slotMapText, sources.vocabulary));
  }
  return {
    ...sources,
    ok: issues.length === 0,
    issues,
    registry: registryResult.value,
    registryText: registryResult.text ?? null,
    runtimeRegistryText,
    contentHash: sources.compiled?.contentHash ?? null,
    contributionCount: sources.contributions.filter((entry) => entry.data).length,
    turnCount: Array.isArray(sources.manifest?.turns) ? sources.manifest.turns.length : 0,
    registryCount: Array.isArray(registryResult.value?.fragments) ? registryResult.value.fragments.length : 0,
  };
}
