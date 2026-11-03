/** Kompiliert Direktiven und prueft sie gegen Registry, Argumente und Allowlist. */
import type { EventChoice } from '../events/template-types';
import { commandSpec } from './registry';
import { parseDirectives } from './parse-directives';
import type {
  CommandRejection, CommandRejectReason, DirectiveValidation, NarrativeCommand, ParsedDirective,
} from './types';

const rejection = (commandId: string, reason: CommandRejectReason, detail: string): CommandRejection => ({
  commandId, reason, detail,
});

export function compileDirective(directive: ParsedDirective, participantCount = 0): NarrativeCommand | null {
  return commandSpec(directive.commandId)?.compile(directive, participantCount) ?? null;
}

/** Direkte Choice-Effekte werden zu derselben typisierten Form wie Parser-ASTs. */
export function commandsForChoice(choice: EventChoice): NarrativeCommand[] {
  return choice.effects.map((effect): NarrativeCommand => {
    switch (effect.kind) {
      case 'SET_FLAG':
        return { id: 'SET_FLAG', flag: effect.flag, delta: effect.delta };
      case 'ADJUST_RELATIONSHIP':
        return {
          id: 'ADJUST_RELATIONSHIP', from: effect.from, to: effect.to,
          dimension: effect.dimension, delta: effect.delta,
        };
      case 'FREEZE_TICK':
        return { id: 'FREEZE_TICK', ticks: effect.ticks };
      case 'TRIGGER_DIALOG':
        return { id: 'TRIGGER_DIALOG', dialogId: effect.dialogId };
    }
  });
}

/** Kein Teilerfolg: ein einziger Fehler verwirft den ganzen Batch. */
export function compileDirectives(
  raw: unknown,
  allowlist: readonly string[],
  participantCount = 0,
): DirectiveValidation {
  const parsed = parseDirectives(raw);
  if (parsed.errors.length > 0) {
    return {
      commands: [],
      rejections: parsed.errors.map((error) => rejection('INVALID', 'INVALID_ARGS', error.code)),
    };
  }
  const commands: NarrativeCommand[] = [];
  const rejections: CommandRejection[] = [];
  for (const directive of parsed.directives) {
    const spec = commandSpec(directive.commandId);
    if (!spec) {
      rejections.push(rejection(directive.commandId, 'UNKNOWN_COMMAND', directive.raw));
      continue;
    }
    const command = spec.compile(directive, participantCount);
    if (!command) {
      rejections.push(rejection(directive.commandId, 'INVALID_ARGS', directive.raw));
      continue;
    }
    if (!allowlist.includes(command.id)) {
      rejections.push(rejection(command.id, 'COMMAND_NOT_ALLOWED', directive.raw));
      continue;
    }
    commands.push(command);
  }
  return rejections.length === 0 ? { commands, rejections: [] } : { commands: [], rejections };
}
