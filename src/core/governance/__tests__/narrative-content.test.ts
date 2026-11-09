/**
 * @test-target: scripts/lib/narrative-content.mjs
 * @error-code: ERR-4022
 *
 * NAR-09: Schema, kontrolliertes Vokabular, Turn-Manifest und die abgeleitete
 * Registry muessen zusammen eine einzige Wahrheit bilden. Die Tests pruefen
 * nicht nur den Happy Path, sondern auch fehlende Felder, unbekannte Werte,
 * doppelte IDs und Registry-Drift.
 */
import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildCompiledRegistry,
  canonical,
  renderRegistry,
  renderRuntimeRegistry,
  renderSlotMap,
} from '../../../../scripts/lib/narrative-compiler.mjs';
import {
  loadNarrativeContent,
  loadNarrativeSources,
  validateContribution,
  validateNarrativeData,
} from '../../../../scripts/lib/narrative-content.mjs';

const ROOT = resolve(process.cwd());
const report = loadNarrativeContent(ROOT);
const first = report.contributions[0];
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const messages = (issues: readonly { message: string }[]) => issues.map((entry) => entry.message).join(' | ');
const schema = (data: unknown, path: string = first.path) => validateContribution(data, report.vocabulary, path);
const fixture = () => {
  const root = mkdtempSync(join(tmpdir(), 'rbd-narrative-fixture-'));
  cpSync(join(ROOT, 'content/narrative'), join(root, 'content/narrative'), { recursive: true });
  const document = buildCompiledRegistry(report.contributions, report.vocabulary).document;
  const generated = join(root, 'src/core/sim/narrative/composer');
  mkdirSync(generated, { recursive: true });
  writeFileSync(join(root, 'content/narrative/registry/fragments.json'), renderRegistry(document));
  writeFileSync(join(generated, 'registry.generated.ts'), renderRuntimeRegistry(document));
  writeFileSync(join(generated, 'slot-map.generated.ts'), renderSlotMap(report.vocabulary));
  return root;
};

describe('Narrative Content Registry (NAR-09)', () => {
  it('akzeptiert Inbox, Manifest und Registry als konsistenten Bestand', () => {
    expect(report.ok).toBe(true);
    expect(report.issues).toEqual([]);
    expect(report.contributionCount).toBe(report.turnCount);
    expect(report.registryCount).toBe(report.contributionCount);
    expect(report.contributionCount).toBeGreaterThan(0);
  });

  it('akzeptiert eine vollstaendige Temp-Fixture mit generierten Bruecken', () => {
    const root = fixture();
    try {
      const result = loadNarrativeContent(root);
      expect(result.ok).toBe(true);
      expect(result.issues).toEqual([]);
      expect(result.contributionCount).toBe(report.contributionCount);
      expect(result.turnCount).toBe(report.turnCount);
      expect(result.registryCount).toBe(report.registryCount);
      expect(result.contentHash).toBe(report.contentHash);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('weist unregistrierte, schemafehlerhafte und unerlaubte Eintraege zurueck', () => {
    const root = fixture();
    const inbox = join(root, 'content/narrative/contributions');
    try {
      const unregistered = clone(first.data);
      unregistered.turnId = '2026-11-01T00:00Z-unregistriert';
      unregistered.contributionId = 'unregistriert';
      writeFileSync(join(inbox, '2026-11-01-unregistriert.json'), JSON.stringify(unregistered));
      expect(messages(loadNarrativeSources(root).issues)).toContain('nicht im Turn-Manifest registriert');
      rmSync(join(inbox, '2026-11-01-unregistriert.json'));

      const invalid = clone(first.data);
      delete invalid.text;
      writeFileSync(join(root, first.path), JSON.stringify(invalid));
      expect(messages(loadNarrativeSources(root).issues))
        .toContain('text fehlt oder ist kein nicht-leerer String');
      writeFileSync(join(root, first.path), JSON.stringify(first.data));

      writeFileSync(join(inbox, 'notizen.txt'), '');
      writeFileSync(join(inbox, 'notizen.md'), '');
      writeFileSync(join(inbox, 'draft.tmp'), '');
      writeFileSync(join(inbox, 'backup.bak'), '');
      writeFileSync(join(inbox, '.versteckt.json'), '{}');
      mkdirSync(join(inbox, 'unterordner'));
      let linked = false;
      try {
        symlinkSync(join(inbox, first.path.split('/').pop() ?? ''), join(inbox, 'verknuepfung.json'));
        linked = true;
      } catch {
        // Windows ohne Symlink-Recht: die uebrigen Eintraege decken den Pfad weiter ab.
      }
      const result = loadNarrativeSources(root);
      const text = messages(result.issues);
      expect(text).toContain('Nicht erlaubter Eintrag (Unterordner)');
      expect(text).toContain('Nicht erlaubter Eintrag (versteckter Name)');
      expect(text).toContain('Nicht erlaubter Eintrag (Dateiname folgt nicht dem Content-Muster)');
      if (linked) expect(text).toContain('Nicht erlaubter Eintrag (Symlink)');
      expect(result.contributions).toHaveLength(report.contributions.length);
      expect(result.ok).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 20_000);

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
    const document = buildCompiledRegistry(report.contributions, report.vocabulary).document;
    expect(document.fragments.length).toBe(report.registry.fragments.length);
    expect(canonical(document)).toBe(canonical(report.registry));
  });

  it('meldet eine fehlende Registry-Zuordnung', () => {
    const text = messages(validateNarrativeData({
      vocabulary: report.vocabulary,
      contributions: report.contributions,
      manifest: report.manifest,
      registry: {
        version: 2,
        compiler: 'nar-10',
        contentHash: report.contentHash,
        fragments: [],
      },
    }));
    expect(text).toContain('Registry fehlt Beitrag');
  });
});
