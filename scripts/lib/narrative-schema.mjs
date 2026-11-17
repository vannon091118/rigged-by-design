/**
 * Gemeinsame Narrative-Konstanten und Feldpruefungen. Keine Datei- oder
 * Registry-Logik; die liegt in den spezialisierten Modulen.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MACRO_LIMITS } from './narrative-macros.mjs';

export const CONTRIBUTION_FIELDS = [
  'agentId', 'turnId', 'contributionId', 'role', 'locale', 'slot', 'function',
  'contexts', 'tone', 'mood', 'relationship', 'personaRefs', 'flags', 'text', 'directives',
];
export const MANIFEST_FIELDS = ['turnId', 'contributionId'];
export const LIMITS = {
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
export const SLUG = /^[a-z0-9][a-z0-9-]*$/;
export const TURN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z-[a-z0-9][a-z0-9-]*$/;
export const FILE = /^\d{4}-\d{2}-\d{2}-[a-z0-9-]+\.json$/;
export const DIRECTIVE = /^€[^\r\n]{1,239}$/u;

export const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
export const has = (record, key) => Object.prototype.hasOwnProperty.call(record, key);
export const issue = (path, message) => ({ path, message });

export function readJson(root, path) {
  try {
    const text = readFileSync(join(root, path), 'utf8');
    return { path, value: JSON.parse(text), text };
  } catch (error) {
    return { path, error: `${path}: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export function stringField(data, key, path, issues) {
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

export function controlled(value, allowed, key, path, issues) {
  const known = Array.isArray(allowed) ? allowed.includes(value) : has(allowed, value);
  if (typeof value !== 'string' || !known) {
    issues.push(issue(path, `${key} ist nicht im kontrollierten Vokabular: ${String(value)}`));
    return false;
  }
  return true;
}

export function controlledList(value, allowed, key, path, issues, { min = 1, max = 8 } = {}) {
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

export function stringObject(value) {
  return isRecord(value) && Object.keys(value).length > 0
    && Object.values(value).every((entry) => typeof entry === 'string' && entry.trim() !== '');
}

export function stringArray(value) {
  return Array.isArray(value) && value.length > 0
    && value.every((entry) => typeof entry === 'string' && entry.trim() !== '')
    && new Set(value).size === value.length;
}

export function pairList(value, allowed, key, path, issues) {
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
