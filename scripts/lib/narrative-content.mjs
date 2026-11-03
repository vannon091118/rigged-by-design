/**
 * NAR-09 content contract: contributions, controlled vocabulary, turn manifest
 * and the derived registry are one read-only validation unit. The registry
 * builder uses the same normalisation as the verifier, so a green Assets gate
 * means the checked-in registry is byte-for-byte explainable from the inbox.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import {
  COMPOSER_SLOT_KINDS, RUNTIME_REGISTRY_PATH, SLOT_MAP_PATH, buildCompiledRegistry,
  validateCompiledRegistry, validateRuntimeRegistry, validateSlotMap,
} from './narrative-compiler.mjs';
import { MACRO_LIMITS } from './narrative-macros.mjs';

const CONTRIBUTION_FIELDS = [
  'agentId', 'turnId', 'contributionId', 'role', 'locale', 'slot', 'function',
  'contexts', 'tone', 'mood', 'relationship', 'personaRefs', 'flags', 'text', 'directives',
];
const MANIFEST_FIELDS = ['turnId', 'contributionId'];
const LIMITS = {
  agentId: 32,
  turnId: 96,
  contributionId: 80,
  role: 32,
  locale: 8,
  slot: 32,
  function: 32,
  tone: 32,
  mood: 32,
  relationship: 32,
  text: 800,
  flags: 12,
  contexts: 8,
  personaRefs: 4,
  directives: MACRO_LIMITS.directives,
  directive: MACRO_LIMITS.directiveLength,
};
const SLUG = /^[a-z0-9][a-z0-9-]*$/;
const TURN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z-[a-z0-9][a-z0-9-]*$/;
const FILE = /^\d{4}-\d{2}-\d{2}-[a-z0-9-]+\.json$/;
const DIRECTIVE = /^€[^\r\n]{1,239}$/u;

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const has = (record, key) => Object.prototype.hasOwnProperty.call(record, key);
const issue = (path, message) => ({ path, message });

function readJson(root, path) {
  try {
    const text = readFileSync(join(root, path), 'utf8');
    return { path, value: JSON.parse(text), text };
  } catch (error) {
    return { path, error: `${path}: ${error instanceof Error ? error.message : String(error)}` };
  }
}

function stringField(data, key, path, issues) {
  if (!has(data, key) || typeof data[key] !== 'string' || data[key].trim() === '') {
    issues.push(issue(path, `${key} fehlt oder ist kein nicht-leerer String`));
    return false;
  }
  if (data[key].length > LIMITS[key]) {
    issues.push(issue(path, `${key} ist laenger als ${LIMITS[key]} Zeichen`));
    return false;
  }
  return true;
}

function controlled(value, allowed, key, path, issues) {
  const known = Array.isArray(allowed) ? allowed.includes(value) : has(allowed, value);
  if (typeof value !== 'string' || !known) {
    issues.push(issue(path, `${key} ist nicht im kontrollierten Vokabular: ${String(value)}`));
    return false;
  }
  return true;
}

function controlledList(value, allowed, key, path, issues, { min = 1, max = 8 } = {}) {
  if (!Array.isArray(value) || value.length < min || value.length > max) {
    issues.push(issue(path, `${key} braucht ${min}..${max} Eintraege`));
    return false;
  }
  if (new Set(value).size !== value.length) {
    issues.push(issue(path, `${key} enthaelt Duplikate`));
    return false;
  }
  let ok = true;
  for (const entry of value) {
    if (typeof entry !== 'string' || !has(allowed, entry)) {
      issues.push(issue(path, `${key} enthaelt unbekannten Wert: ${String(entry)}`));
      ok = false;
    }
  }
  return ok;
}

function stringObject(value) {
  return isRecord(value) && Object.keys(value).length > 0
    && Object.values(value).every((entry) => typeof entry === 'string' && entry.trim() !== '');
}

function stringArray(value) {
  return Array.isArray(value) && value.length > 0
    && value.every((entry) => typeof entry === 'string' && entry.trim() !== '')
    && new Set(value).size === value.length;
}

function pairList(value, allowed, key, path, issues) {
  if (!Array.isArray(value)) {
    issues.push(issue(path, `${key} fehlt oder ist keine Liste`));
    return false;
  }
  const knownValue = (entry) => (Array.isArray(allowed) ? allowed.includes(entry) : has(allowed, entry));
  let ok = true;
  for (const pair of value) {
    if (!Array.isArray(pair) || pair.length !== 2 || pair[0] === pair[1]
      || !knownValue(pair[0]) || !knownValue(pair[1])) {
      issues.push(issue(path, `${key} enthaelt ein ungueltiges Paar`));
      ok = false;
    }
  }
  return ok;
}

function loadVocabulary(root) {
  const flagsResult = readJson(root, 'content/narrative/vocabulary/flags.json');
  const classResult = readJson(root, 'content/narrative/vocabulary/classification.json');
  const issues = [];
  if (flagsResult.error) issues.push(issue(flagsResult.path, flagsResult.error));
  if (classResult.error) issues.push(issue(classResult.path, classResult.error));
  const flagsDoc = isRecord(flagsResult.value) ? flagsResult.value : {};
  const classDoc = isRecord(classResult.value) ? classResult.value : {};

  if (flagsDoc.version !== 1) issues.push(issue(flagsResult.path, 'version muss 1 sein'));
  if (!stringArray(flagsDoc.roles)) issues.push(issue(flagsResult.path, 'roles fehlt oder ist ungueltig'));
  if (!stringArray(flagsDoc.locales)) issues.push(issue(flagsResult.path, 'locales fehlt oder ist ungueltig'));
  if (!stringObject(flagsDoc.flags)) issues.push(issue(flagsResult.path, 'flags fehlt oder ist ungueltig'));

  if (classDoc.version !== 1) issues.push(issue(classResult.path, 'version muss 1 sein'));
  const dimensions = ['slots', 'functions', 'contexts', 'tones', 'moods', 'relationships', 'personas'];
  for (const dimension of dimensions) {
    if (!stringObject(classDoc[dimension])) {
      issues.push(issue(classResult.path, `${dimension} fehlt oder ist ungueltig`));
    }
  }
  if (!isRecord(classDoc.slotFunctions)) {
    issues.push(issue(classResult.path, 'slotFunctions fehlt'));
  } else {
    for (const [slot, functions] of Object.entries(classDoc.slotFunctions)) {
      if (!has(classDoc.slots ?? {}, slot)) issues.push(issue(classResult.path, `slotFunctions nennt unbekannten Slot: ${slot}`));
      if (!stringArray(functions) || functions.some((entry) => !has(classDoc.functions ?? {}, entry))) {
        issues.push(issue(classResult.path, `slotFunctions fuer ${slot} ist ungueltig`));
      }
    }
  }

  // Jeder Vokabular-Slot gehoert genau einmal entweder in die Composer-Bruecke
  // oder auf die explizite Nicht-komponierbar-Liste; nichts bleibt still liegen.
  const composerSlots = classDoc.composerSlots;
  const nonComposable = classDoc.nonComposableSlots;
  const assigned = [];
  if (!isRecord(composerSlots)) {
    issues.push(issue(classResult.path, 'composerSlots fehlt oder ist ungueltig'));
  } else {
    for (const kind of COMPOSER_SLOT_KINDS) {
      if (!has(composerSlots, kind)) {
        issues.push(issue(classResult.path, `composerSlots fehlt fuer ${kind}`));
        continue;
      }
      const slots = composerSlots[kind];
      if (!stringArray(slots)) {
        issues.push(issue(classResult.path, `composerSlots fuer ${kind} ist ungueltig`));
        continue;
      }
      for (const slot of slots) {
        if (!has(classDoc.slots ?? {}, slot)) issues.push(issue(classResult.path, `composerSlots nennt unbekannten Slot: ${slot}`));
        assigned.push(slot);
      }
    }
    for (const kind of Object.keys(composerSlots)) {
      if (!COMPOSER_SLOT_KINDS.includes(kind)) issues.push(issue(classResult.path, `composerSlots nennt unbekannten Slot-Kind: ${kind}`));
    }
  }
  if (!stringArray(nonComposable)) {
    issues.push(issue(classResult.path, 'nonComposableSlots fehlt oder ist ungueltig'));
  } else {
    for (const slot of nonComposable) {
      if (!has(classDoc.slots ?? {}, slot)) issues.push(issue(classResult.path, `nonComposableSlots nennt unbekannten Slot: ${slot}`));
      assigned.push(slot);
    }
  }
  const counts = new Map();
  for (const slot of assigned) counts.set(slot, (counts.get(slot) ?? 0) + 1);
  for (const slot of Object.keys(classDoc.slots ?? {})) {
    const count = counts.get(slot) ?? 0;
    if (count !== 1) issues.push(issue(classResult.path, `Slot ${slot} ist ${count}-mal zugeordnet, erwartet genau einmal`));
  }

  const aliases = classDoc.personaAliases;
  if (!isRecord(aliases)) {
    issues.push(issue(classResult.path, 'personaAliases fehlt oder ist ungueltig'));
  } else {
    const aliasOwners = new Map();
    for (const persona of Object.keys(classDoc.personas ?? {})) {
      if (!has(aliases, persona)) issues.push(issue(classResult.path, `personaAliases fehlt fuer ${persona}`));
    }
    for (const [persona, names] of Object.entries(aliases)) {
      if (!has(classDoc.personas ?? {}, persona)) {
        issues.push(issue(classResult.path, `personaAliases nennt unbekannte Persona: ${persona}`));
      }
      if (!stringArray(names)) {
        issues.push(issue(classResult.path, `personaAliases fuer ${persona} ist ungueltig`));
        continue;
      }
      for (const alias of names) {
        const key = alias.toLocaleLowerCase('de');
        const owner = aliasOwners.get(key);
        if (owner && owner !== persona) issues.push(issue(classResult.path, `Alias ${alias} ist doppelt: ${owner}/${persona}`));
        aliasOwners.set(key, persona);
      }
    }
  }

  const conflicts = classDoc.conflicts;
  if (!isRecord(conflicts)) {
    issues.push(issue(classResult.path, 'conflicts fehlt oder ist ungueltig'));
  } else {
    pairList(conflicts.rolePairs, flagsDoc.roles ?? [], 'conflicts.rolePairs', classResult.path, issues);
    pairList(conflicts.moodPairs, classDoc.moods ?? {}, 'conflicts.moodPairs', classResult.path, issues);
    pairList(conflicts.flagPairs, flagsDoc.flags ?? {}, 'conflicts.flagPairs', classResult.path, issues);
  }

  return {
    issues,
    vocabulary: {
      roles: flagsDoc.roles ?? [],
      locales: flagsDoc.locales ?? [],
      flags: flagsDoc.flags ?? {},
      slots: classDoc.slots ?? {},
      functions: classDoc.functions ?? {},
      slotFunctions: classDoc.slotFunctions ?? {},
      composerSlots: classDoc.composerSlots ?? {},
      nonComposableSlots: classDoc.nonComposableSlots ?? [],
      contexts: classDoc.contexts ?? {},
      tones: classDoc.tones ?? {},
      moods: classDoc.moods ?? {},
      relationships: classDoc.relationships ?? {},
      personas: classDoc.personas ?? {},
      personaAliases: aliases ?? {},
      conflicts: conflicts ?? {},
    },
  };
}

/** Validate one contribution; exported for focused schema tests. */
export function validateContribution(data, vocabulary, sourcePath = '') {
  const issues = [];
  if (!isRecord(data)) {
    issues.push(issue(sourcePath || 'contribution', 'Beitrag ist kein Objekt'));
    return issues;
  }
  for (const key of Object.keys(data)) {
    if (!CONTRIBUTION_FIELDS.includes(key)) issues.push(issue(sourcePath, `unbekanntes Feld: ${key}`));
  }
  for (const key of ['agentId', 'turnId', 'contributionId', 'role', 'locale', 'slot', 'function', 'tone', 'mood', 'relationship', 'text']) {
    stringField(data, key, sourcePath, issues);
  }

  if (typeof data.agentId === 'string' && !SLUG.test(data.agentId)) issues.push(issue(sourcePath, 'agentId ist kein stabiler Slug'));
  if (typeof data.turnId === 'string' && !TURN.test(data.turnId)) issues.push(issue(sourcePath, 'turnId hat nicht das Format YYYY-MM-DDTHH:MMZ-slug'));
  if (typeof data.contributionId === 'string' && !SLUG.test(data.contributionId)) issues.push(issue(sourcePath, 'contributionId ist kein stabiler Slug'));

  controlled(data.role, vocabulary.roles, 'role', sourcePath, issues);
  controlled(data.locale, vocabulary.locales, 'locale', sourcePath, issues);
  controlled(data.slot, vocabulary.slots, 'slot', sourcePath, issues);
  controlled(data.function, vocabulary.functions, 'function', sourcePath, issues);
  controlled(data.tone, vocabulary.tones, 'tone', sourcePath, issues);
  controlled(data.mood, vocabulary.moods, 'mood', sourcePath, issues);
  controlled(data.relationship, vocabulary.relationships, 'relationship', sourcePath, issues);
  controlledList(data.contexts, vocabulary.contexts, 'contexts', sourcePath, issues, { min: 1, max: LIMITS.contexts });
  controlledList(data.flags, vocabulary.flags, 'flags', sourcePath, issues, { min: 1, max: LIMITS.flags });
  controlledList(data.personaRefs, vocabulary.personas, 'personaRefs', sourcePath, issues, { min: 0, max: LIMITS.personaRefs });
  if (Array.isArray(data.flags) && !data.flags.includes('narrativ')) issues.push(issue(sourcePath, 'flags muss narrativ enthalten'));

  const allowedFunctions = vocabulary.slotFunctions?.[data.slot];
  if (Array.isArray(allowedFunctions) && !allowedFunctions.includes(data.function)) {
    issues.push(issue(sourcePath, `function ${String(data.function)} passt nicht zu slot ${String(data.slot)}`));
  }

  if (typeof data.text === 'string' && data.text.includes('€')) {
    issues.push(issue(sourcePath, 'sichtbarer Text enthaelt ein €-Makro; Direktiven gehoeren in directives'));
  }

  if (!Array.isArray(data.directives) || data.directives.length > LIMITS.directives) {
    issues.push(issue(sourcePath, `directives braucht 0..${LIMITS.directives} Eintraege`));
  } else {
    for (const directive of data.directives) {
      if (typeof directive !== 'string' || !DIRECTIVE.test(directive) || directive.length > LIMITS.directive) {
        issues.push(issue(sourcePath, `directive ist ungueltig: ${String(directive)}`));
      }
    }
  }

  if (sourcePath) {
    const file = sourcePath.split('/').pop() ?? '';
    if (!FILE.test(file)) issues.push(issue(sourcePath, 'Dateiname folgt nicht dem Content-Muster'));
    else if (typeof data.turnId === 'string' && !data.turnId.startsWith(`${file.slice(0, 10)}T`)) {
      issues.push(issue(sourcePath, 'turnId-Datum passt nicht zum Dateinamen'));
    }
  }
  return issues;
}

function readContributions(root) {
  const directory = join(root, 'content/narrative/contributions');
  if (!existsSync(directory)) return { contributions: [], issues: [issue('content/narrative/contributions', 'Verzeichnis fehlt')] };
  const issues = [];
  const contributions = [];
  for (const file of readdirSync(directory, { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.endsWith('.json')).sort((left, right) => left.name.localeCompare(right.name))) {
    const path = relative(root, join(directory, file.name)).split(/[\\/]/).join('/');
    try {
      contributions.push({ path, data: JSON.parse(readFileSync(join(directory, file.name), 'utf8')) });
    } catch (error) {
      issues.push(issue(path, error instanceof Error ? error.message : String(error)));
      contributions.push({ path, data: null });
    }
  }
  return { contributions, issues };
}

function validateManifest(manifest, contributions) {
  const path = 'content/narrative/turns/manifest.json';
  const issues = [];
  if (!isRecord(manifest) || manifest.version !== 1 || !Array.isArray(manifest.turns)) {
    issues.push(issue(path, 'Manifest braucht version 1 und turns[]'));
    return issues;
  }
  const turnIds = new Map();
  const contributionIds = new Map();
  const byTurn = new Map();
  for (const entry of contributions) {
    if (entry.data?.turnId) {
      if (!byTurn.has(entry.data.turnId)) byTurn.set(entry.data.turnId, []);
      byTurn.get(entry.data.turnId).push(entry);
    }
  }
  for (const entry of manifest.turns) {
    if (!isRecord(entry)) {
      issues.push(issue(path, 'Manifest-Eintrag ist kein Objekt'));
      continue;
    }
    for (const key of Object.keys(entry)) if (!MANIFEST_FIELDS.includes(key)) issues.push(issue(path, `unbekanntes Manifest-Feld: ${key}`));
    for (const key of MANIFEST_FIELDS) {
      if (typeof entry[key] !== 'string' || entry[key].trim() === '') issues.push(issue(path, `Manifest-Eintrag ohne ${key}`));
    }
    if (typeof entry.turnId === 'string' && !TURN.test(entry.turnId)) issues.push(issue(path, `ungueltige turnId: ${entry.turnId}`));
    if (typeof entry.turnId === 'string') {
      if (turnIds.has(entry.turnId)) issues.push(issue(path, `turnId doppelt registriert: ${entry.turnId}`));
      turnIds.set(entry.turnId, (turnIds.get(entry.turnId) ?? 0) + 1);
    }
    if (typeof entry.contributionId === 'string') {
      if (contributionIds.has(entry.contributionId)) issues.push(issue(path, `contributionId doppelt registriert: ${entry.contributionId}`));
      contributionIds.set(entry.contributionId, (contributionIds.get(entry.contributionId) ?? 0) + 1);
    }
    if (typeof entry.turnId === 'string') {
      const matches = byTurn.get(entry.turnId) ?? [];
      if (matches.length !== 1) issues.push(issue(path, `registrierter Turn braucht genau einen Beitrag: ${entry.turnId} (${matches.length})`));
      else if (matches[0].data.contributionId !== entry.contributionId) {
        issues.push(issue(path, `Manifest verweist fuer ${entry.turnId} auf ${entry.contributionId}, Beitrag traegt ${matches[0].data.contributionId}`));
      }
    }
  }
  for (const entry of contributions) {
    if (entry.data?.turnId && !turnIds.has(entry.data.turnId)) issues.push(issue(entry.path, `Beitrag ist nicht im Turn-Manifest registriert: ${entry.data.turnId}`));
  }
  if (manifest.turns.length !== contributions.length) {
    issues.push(issue(path, `Manifest zaehlt ${manifest.turns.length} Turns, Inbox enthaelt ${contributions.length} Beitraege`));
  }
  return issues;
}

/** Validate schema, duplicate IDs, manifest and compilation; registry is optional. */
export function validateNarrativeData({ vocabulary, contributions, manifest, registry, registryText = null, compiled = null }) {
  const issues = [];
  for (const entry of contributions) {
    if (entry.data === null) continue;
    issues.push(...validateContribution(entry.data, vocabulary, entry.path));
  }
  const contributionIds = new Map();
  const turnIds = new Map();
  for (const entry of contributions) {
    const id = entry.data?.contributionId;
    const turn = entry.data?.turnId;
    if (typeof id === 'string') {
      if (contributionIds.has(id)) issues.push(issue(entry.path, `contributionId doppelt: ${id}`));
      contributionIds.set(id, (contributionIds.get(id) ?? 0) + 1);
    }
    if (typeof turn === 'string') {
      if (turnIds.has(turn)) issues.push(issue(entry.path, `turnId doppelt: ${turn}`));
      turnIds.set(turn, (turnIds.get(turn) ?? 0) + 1);
    }
  }
  issues.push(...validateManifest(manifest, contributions));
  const compilation = compiled ?? buildCompiledRegistry(contributions, vocabulary);
  issues.push(...compilation.issues);
  if (registry !== undefined) {
    issues.push(...validateCompiledRegistry(registry, compilation.document, registryText));
  }
  return issues;
}

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
