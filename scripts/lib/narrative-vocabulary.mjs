/**
 * Laedt und validiert das kontrollierte Narrative-Vokabular. Jeder Slot ist
 * genau einmal entweder komponierbar oder ausdruecklich nicht komponierbar.
 */
import { COMPOSER_SLOT_KINDS } from './narrative-compiler.mjs';
import { has, isRecord, issue, pairList, readJson, stringArray, stringObject } from './narrative-schema.mjs';

export function loadVocabulary(root) {
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
