/** @test-target: src/core/sim/narrative/commands/parse-directives.ts | @error-code: ERR-2001 */
import { describe, expect, it } from 'vitest';
import { parseDirective, parseDirectives } from '../narrative/commands/parse-directives';

describe('Narrative Command DSL', () => {
  it('liest kanonische Makros als typisiertes AST', () => {
    const freeze = parseDirective('€FreezeTick:200');
    expect(freeze).toMatchObject({ commandId: 'FREEZE_TICK', positional: [200] });
    const flag = parseDirective('€SET_FLAG flag=asked delta=1');
    expect(flag?.named).toEqual({ flag: 'asked', delta: 1 });
    expect(flag?.raw).toBe('€SET_FLAG flag=asked delta=1');
  });

  it('liest Legacy-Dialog und kommaseparierte Parameter', () => {
    const dialog = parseDirective("€trigger Dialog 'VISITOR_RETURN'");
    expect(dialog?.commandId).toBe('TRIGGER_DIALOG');
    expect(dialog?.positional).toEqual(['VISITOR_RETURN']);
    const adjusted = parseDirective('€ADJUST_RELATIONSHIP from=@0,to=player,dimension=sympathy,delta=2');
    expect(adjusted?.named).toEqual({ from: '@0', to: 'player', dimension: 'sympathy', delta: 2 });
  });

  it('verwirft kaputte Direktiven fail-closed', () => {
    expect(parseDirective('FreezeTick:200')).toBeNull();
    expect(parseDirective('€FREEZE_TICK "unterminated')).toBeNull();
    expect(parseDirective('€')).toBeNull();
  });

  it('lehnt doppelte Argumente und zu grosse Batches ab', () => {
    const duplicate = parseDirectives(['€SET_FLAG flag=a flag=b']);
    expect(duplicate.directives).toEqual([]);
    expect(duplicate.errors[0]?.code).toBe('DUPLICATE_ARG');
    const tooMany = parseDirectives(Array.from({ length: 9 }, (_, index) => `€SET_FLAG flag=f${index}`));
    expect(tooMany.directives).toEqual([]);
    expect(tooMany.errors[0]?.code).toBe('TOO_MANY');
  });
});
