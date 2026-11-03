/** @test-target: src/core/sim/narrative/commands/validate.ts | @error-code: ERR-2001 */
import { describe, expect, it } from 'vitest';
import { compileDirectives } from '../narrative/commands/validate';
import { allowlistForChoice, commandSpec } from '../narrative/commands/registry';
import { templateFor } from '../narrative/events/definitions';

const template = templateFor('VISITOR_RETURN', 1)!;
const welcome = template.choices.find((choice) => choice.choiceId === 'WELCOME_BACK')!;
const ask = template.choices.find((choice) => choice.choiceId === 'ASK_ABOUT_LAST_VISIT')!;

describe('Narrative Command Allowlist', () => {
  it('kompiliert nur Commands aus dem Choice-Vertrag', () => {
    const allowed = compileDirectives([
      '€ADJUST_RELATIONSHIP from=@0 to=player dimension=sympathy delta=1',
    ], allowlistForChoice(welcome), 1);
    expect(allowed.rejections).toEqual([]);
    expect(allowed.commands).toEqual([{
      id: 'ADJUST_RELATIONSHIP', from: { participant: 0 }, to: 'player',
      dimension: 'sympathy', delta: 1,
    }]);
    const blocked = compileDirectives(['€FREEZE_TICK:10'], allowlistForChoice(ask), 1);
    expect(blocked.commands).toEqual([]);
    expect(blocked.rejections[0]?.reason).toBe('COMMAND_NOT_ALLOWED');
  });

  it('weist unbekannte Commands und ungueltige Argumente ab', () => {
    const unknown = compileDirectives(['€DELETE_WORLD:1'], allowlistForChoice(welcome), 1);
    expect(unknown.rejections[0]?.reason).toBe('UNKNOWN_COMMAND');
    const invalid = compileDirectives(['€SET_FLAG flag=asked delta=0'], allowlistForChoice(ask), 1);
    expect(invalid.commands).toEqual([]);
    expect(invalid.rejections[0]?.reason).toBe('INVALID_ARGS');
  });

  it('prueft Teilnehmerindizes gegen die aufgeloeste Rollenlaenge', () => {
    const outside = compileDirectives([
      '€ADJUST_RELATIONSHIP from=@2 to=player dimension=trust delta=1',
    ], allowlistForChoice(welcome), 1);
    expect(outside.commands).toEqual([]);
    expect(outside.rejections[0]?.reason).toBe('INVALID_ARGS');
    expect(commandSpec('TRIGGER_DIALOG')?.executable).toBe(false);
    expect(commandSpec('FREEZE_TICK')?.executable).toBe(true);
  });

  it('verwirft den ganzen Batch, wenn eine Direktive scheitert', () => {
    const mixed = compileDirectives([
      '€SET_FLAG flag=asked delta=1',
      '€UNKNOWN_COMMAND:1',
    ], allowlistForChoice(ask), 1);
    expect(mixed.commands).toEqual([]);
    expect(mixed.rejections).toHaveLength(1);
  });
});
