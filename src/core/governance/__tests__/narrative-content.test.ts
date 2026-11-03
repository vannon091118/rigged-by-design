/**
 * @test-target: scripts/lib/narrative-content.mjs
 * @error-code: ERR-4022
 *
 * NAR-09: Schema, kontrolliertes Vokabular, Turn-Manifest und die abgeleitete
 * Registry muessen zusammen eine einzige Wahrheit bilden. Die Tests pruefen
 * nicht nur den Happy Path, sondern auch fehlende Felder, unbekannte Werte,
 * doppelte IDs und Registry-Drift.
 */
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildRegistryDocument,
  canonical,
  loadNarrativeContent,
  validateContribution,
  validateNarrativeData,
} from '../../../../scripts/lib/narrative-content.mjs';

const ROOT = resolve(process.cwd());
const report = loadNarrativeContent(ROOT);
const first = report.contributions[0];
const clone = (value) => JSON.parse(JSON.stringify(value));
const messages = (issues) => issues.map((entry) => entry.message).join(' | ');
const schema = (data, path = first.path) => validateContribution(data, report.vocabulary, path);

describe('Narrative Content Registry (NAR-09)', () => {
  it('akzeptiert Inbox, Manifest und Registry als konsistenten Bestand', () => {
    expect(report.ok).toBe(true);
    expect(report.issues).toEqual([]);
    expect(report.contributionCount).toBe(report.turnCount);
    expect(report.registryCount).toBe(report.contributionCount);
    expect(report.contributionCount).toBeGreaterThan(0);
  });

  it('weist fehlende Pflichtfelder und unbekannte Felder zurueck', () => {
    const missing = clone(first.data);
    delete missing.role;
    delete missing.text;
    delete missing.directives;
    const missingText = messages(schema(missing));
    expect(missingText).toContain('role');
    expect(missingText).toContain('text');
    expect(missingText).toContain('directives');

    const extra = { ...clone(first.data), owner: 'unregistriert' };
    expect(messages(schema(extra))).toContain('unbekanntes Feld: owner');
  });

  it('weist unbekannte Rollen, Locales und Klassifizierungen zurueck', () => {
    const invalid = {
      ...clone(first.data),
      role: 'UNBEKANNT',
      locale: 'en',
      slot: 'unbekannt',
      contexts: ['start', 'unbekannt'],
      tone: 'laut',
      mood: 'wuetend',
      relationship: 'feind',
      personaRefs: ['unbekannt'],
      flags: ['narrativ', 'unbekannt'],
    };
    const text = messages(schema(invalid));
    for (const field of ['role', 'locale', 'slot', 'contexts', 'tone', 'mood', 'relationship', 'personaRefs', 'flags']) {
      expect(text).toContain(field);
    }
  });

  it('weist unpassende Slot-Funktionen und ungueltige Direktiven zurueck', () => {
    const mismatch = { ...clone(first.data), slot: 'opening', function: 'remember' };
    expect(messages(schema(mismatch))).toContain('passt nicht zu slot');

    const badDirective = { ...clone(first.data), directives: ['FreezeTick:10'] };
    expect(messages(schema(badDirective))).toContain('directive ist ungueltig');
  });

  it('erkennt doppelte Contribution- und Turn-IDs', () => {
    const duplicate = [
      first,
      { ...clone(first), path: 'content/narrative/contributions/2026-11-01-readme-opening-copy.json' },
    ];
    const text = messages(validateNarrativeData({
      vocabulary: report.vocabulary,
      contributions: duplicate,
      manifest: report.manifest,
      registry: report.registry,
    }));
    expect(text).toContain('contributionId doppelt');
    expect(text).toContain('turnId doppelt');
  });

  it('verlangt fuer jeden registrierten Turn genau einen Beitrag', () => {
    const text = messages(validateNarrativeData({
      vocabulary: report.vocabulary,
      contributions: [first],
      manifest: report.manifest,
      registry: report.registry,
    }));
    expect(text).toContain('registrierter Turn braucht genau einen Beitrag');
  });

  it('erkennt einen Manifest-Verweis auf den falschen Beitrag', () => {
    const manifest = clone(report.manifest);
    manifest.turns[0].contributionId = 'falscher-beitrag';
    const text = messages(validateNarrativeData({
      vocabulary: report.vocabulary,
      contributions: report.contributions,
      manifest,
      registry: report.registry,
    }));
    expect(text).toContain('Manifest verweist');
  });

  it('erkennt eine vom Beitrag abweichende Registry', () => {
    const registry = clone(report.registry);
    registry.fragments[0].text = `${registry.fragments[0].text} geaendert`;
    const text = messages(validateNarrativeData({
      vocabulary: report.vocabulary,
      contributions: report.contributions,
      manifest: report.manifest,
      registry,
    }));
    expect(text).toContain('weicht vom Beitrag ab');
  });

  it('baut die Registry deterministisch aus denselben Beitraegen', () => {
    const document = buildRegistryDocument(report.contributions);
    expect(document.fragments.length).toBe(report.registry.fragments.length);
    expect(canonical(document)).toBe(canonical(report.registry));
  });

  it('meldet eine fehlende Registry-Zuordnung', () => {
    const text = messages(validateNarrativeData({
      vocabulary: report.vocabulary,
      contributions: report.contributions,
      manifest: report.manifest,
      registry: { version: 1, fragments: [] },
    }));
    expect(text).toContain('Registry fehlt Beitrag');
  });
});
