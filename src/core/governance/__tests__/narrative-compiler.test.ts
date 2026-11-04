/**
 * @test-target: scripts/lib/narrative-compiler.mjs
 * @error-code: ERR-4022
 *
 * NAR-10: Makros werden zu einem begrenzten AST, Konflikte werden vor dem
 * Schreiben erkannt, und dieselbe Inbox erzeugt byte-identische Registry-Daten.
 * Der Allowlist-Vergleich haelt den Compiler am NAR-08-Command-Vertrag.
 */
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COMMAND_SPECS } from '../../sim/narrative/commands/registry';
import {
  COMMAND_CONTRACTS,
  compileMacro,
  compileMacroBatch,
} from '../../../../scripts/lib/narrative-macros.mjs';
import {
  buildCompiledRegistry,
  renderRegistry,
  renderRuntimeRegistry,
  validateCompiledRegistry,
  validateRuntimeRegistry,
} from '../../../../scripts/lib/narrative-compiler.mjs';
import { loadNarrativeContent } from '../../../../scripts/lib/narrative-content.mjs';

const ROOT = resolve(process.cwd());
const report = loadNarrativeContent(ROOT);
const clone = (value) => JSON.parse(JSON.stringify(value));
const messages = (issues) => issues.map((entry) => entry.message).join(' | ');
const firstById = (id) => report.contributions.find((entry) => entry.data.contributionId === id);

describe('Narrative Content Compiler (NAR-10)', () => {
  it('akzeptiert den kontrollierten Bestand und liefert einen Inhalts-Hash', () => {
    expect(report.ok).toBe(true);
    expect(report.registry.version).toBe(2);
    expect(report.registry.compiler).toBe('nar-10');
    expect(report.contentHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(report.registry.fragments).toHaveLength(26);
    expect(report.runtimeRegistryText).toContain('export const NARRATIVE_REGISTRY');
    expect(validateRuntimeRegistry(report.runtimeRegistryText, report.compiled)).toEqual([]);
  });

  it('parst Makros zu typisierten AST-Daten ohne Roh-Makro in der Registry', () => {
    const parsed = compileMacro('€FreezeTick:120');
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.command).toMatchObject({ id: 'FREEZE_TICK', ticks: 120 });

    const fragment = report.registry.fragments.find((entry) => entry.contributionId === 'content-compiler-01');
    expect(fragment?.directives).toEqual([{ id: 'FREEZE_TICK', ticks: 120 }]);
    expect(JSON.stringify(report.registry)).not.toContain('€');
  });

  it('weist ungueltige, unbekannte und nicht ausfuehrbare Makros zurueck', () => {
    expect(compileMacro('FreezeTick:1').error?.code).toBe('MALFORMED');
    expect(compileMacro('€FREEZE_TICK:201').error?.code).toBe('INVALID_ARGS');
    expect(compileMacro('€FREEZE_TICK:1,2').error?.code).toBe('INVALID_ARGS');
    expect(compileMacro('€UNKNOWN:1').error?.code).toBe('UNKNOWN_COMMAND');
    expect(compileMacro('€TRIGGER_DIALOG:NAR_10').error?.code).toBe('COMMAND_NOT_EXECUTABLE');
  });

  it('verlangt stabile ActorRefs und kontrollierte Flags', () => {
    expect(compileMacro('€ADJUST_RELATIONSHIP from=@0 to=@1 dimension=trust delta=1').error?.code)
      .toBe('INVALID_TARGET');
    expect(compileMacro('€SET_FLAG:unbekannt,1', { flags: report.vocabulary.flags }).error?.code)
      .toBe('UNKNOWN_FLAG');
    expect(compileMacro(
      '€ADJUST_RELATIONSHIP from=player to=staff:1 dimension=trust delta=1',
      { flags: report.vocabulary.flags },
    ).ok).toBe(true);
  });

  it('verwirft doppelte Singleton-Commands als unzulaessige Kombination', () => {
    const batch = compileMacroBatch(['€FREEZE_TICK:10', '€FREEZE_TICK:20']);
    expect(batch.commands).toEqual([]);
    expect(batch.issues[0]?.code).toBe('COMMAND_CONFLICT');
  });

  it('spiegelt die NAR-08-Allowlist exakt', () => {
    const compiler = Object.values(COMMAND_CONTRACTS)
      .map(({ id, family, executable }) => ({ id, family, executable }))
      .sort((left, right) => left.id.localeCompare(right.id));
    const runtime = COMMAND_SPECS
      .map(({ id, family, executable }) => ({ id, family, executable }))
      .sort((left, right) => left.id.localeCompare(right.id));
    expect(compiler).toEqual(runtime);
  });

  it('erzeugt aus derselben Inbox byte-identische Registry-Daten', () => {
    const forward = buildCompiledRegistry(report.contributions, report.vocabulary);
    const reverse = buildCompiledRegistry([...report.contributions].reverse(), report.vocabulary);
    expect(forward.issues).toEqual([]);
    expect(renderRegistry(forward.document)).toBe(renderRegistry(reverse.document));
    expect(renderRuntimeRegistry(forward.document)).toBe(renderRuntimeRegistry(reverse.document));
    expect(forward.document.contentHash).toBe(reverse.document.contentHash);
  });

  it('erkennt gegensaetzliche Sprecher und inkompatible Stimmung', () => {
    const speakerBase = clone(firstById('opening-inheritance-01'));
    const speaker = clone(speakerBase);
    speaker.path = 'content/narrative/contributions/2099-01-01-conflict-speaker.json';
    speaker.data.contributionId = 'conflict-speaker';
    speaker.data.turnId = '2099-01-01T00:00Z-conflict-speaker';
    speaker.data.role = 'SKEPTIKER';
    expect(messages(buildCompiledRegistry([speakerBase, speaker], report.vocabulary).issues))
      .toContain('gegensaetzliche Sprecher');

    const moodBase = clone(firstById('ledger-pages-01'));
    const mood = clone(moodBase);
    mood.path = 'content/narrative/contributions/2099-01-01-conflict-mood.json';
    mood.data.contributionId = 'conflict-mood';
    mood.data.turnId = '2099-01-01T00:00Z-conflict-mood';
    mood.data.mood = 'angespannt';
    expect(messages(buildCompiledRegistry([moodBase, mood], report.vocabulary).issues))
      .toContain('inkompatible Stimmung');
  });

  it('erkennt widerspruechliche Flags, fehlende Persona-Refs und Makro-Konflikte', () => {
    const flags = clone(firstById('start-pool-opening-01'));
    flags.data.flags = ['narrativ', 'startpool', 'rueckkehrer'];
    expect(messages(buildCompiledRegistry([flags], report.vocabulary).issues))
      .toContain('widerspruechliche Story-Flags');

    const persona = clone(firstById('opening-inheritance-01'));
    persona.data.personaRefs = [];
    expect(messages(buildCompiledRegistry([persona], report.vocabulary).issues))
      .toContain('personaRefs enthaelt rita-kern nicht');

    const commands = clone(firstById('content-compiler-01'));
    commands.data.directives = ['€FREEZE_TICK:10', '€FREEZE_TICK:20'];
    expect(messages(buildCompiledRegistry([commands], report.vocabulary).issues))
      .toContain('COMMAND_CONFLICT');
  });

  it('erkennt Hash-, Struktur- und Byte-Drift der generierten Registry', () => {
    const hashDrift = clone(report.registry);
    hashDrift.contentHash = `sha256:${'0'.repeat(64)}`;
    expect(messages(validateCompiledRegistry(hashDrift, report.compiled)))
      .toContain('contentHash');

    const textDrift = clone(report.registry);
    textDrift.fragments[0].text = `${textDrift.fragments[0].text} geaendert`;
    expect(messages(validateCompiledRegistry(textDrift, report.compiled)))
      .toContain('weicht vom Beitrag ab');

    const formatted = report.registryText.replace('"version": 2', '"version":  2');
    expect(messages(validateCompiledRegistry(report.registry, report.compiled, formatted)))
      .toContain('byte-identisch');

    const runtimeDrift = `${report.runtimeRegistryText}// drift\n`;
    expect(messages(validateRuntimeRegistry(runtimeDrift, report.compiled)))
      .toContain('byte-identisch');
  });
});
