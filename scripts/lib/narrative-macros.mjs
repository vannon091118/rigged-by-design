/**
 * NAR-10 compile-time macro parser and validator.
 *
 * The syntax mirrors `src/core/sim/narrative/commands/parse-directives.ts`.
 * Content may only carry commands that the NAR-08 registry can execute and
 * that a later event template can allow; unknown IDs, unstable targets and
 * non-executable commands fail closed before the registry is written.
 */

export const MACRO_LIMITS = Object.freeze({
  directives: 8,
  directiveLength: 240,
  freezeTicks: 200,
  flagAbsolute: 1_000_000,
});

const NAME = /^[A-Za-z][A-Za-z0-9_]*/;
const KEY = /^[A-Za-z][A-Za-z0-9_]{0,31}$/;
const FLAG = /^[A-Za-z][A-Za-z0-9_]{0,31}$/;
const DIALOG = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const ACTOR = /^(?:player|visitor:[1-9]\d*|staff:[1-9]\d*|rival:[A-Z_]+)$/;
const DIMENSIONS = Object.freeze(['trust', 'sympathy', 'conflict', 'influence']);
const ALIASES = Object.freeze({
  FREEZETICK: 'FREEZE_TICK',
  TRIGGERDIALOG: 'TRIGGER_DIALOG',
  SETFLAG: 'SET_FLAG',
  ADJUSTRELATIONSHIP: 'ADJUST_RELATIONSHIP',
  COUNTERRIVAL: 'COUNTER_RIVAL',
});

const COMMAND_SPECS = Object.freeze({
  SET_FLAG: Object.freeze({ family: 'STORY', executable: true, singleton: false }),
  ADJUST_RELATIONSHIP: Object.freeze({ family: 'RELATIONSHIP', executable: true, singleton: false }),
  FREEZE_TICK: Object.freeze({ family: 'EVENT', executable: true, singleton: true }),
  TRIGGER_DIALOG: Object.freeze({ family: 'DIALOG', executable: true, singleton: true }),
  COUNTER_RIVAL: Object.freeze({ family: 'RIVAL', executable: true, singleton: false }),
});

/** Allowlist metadata used by the compiler and by the drift test. */
export const COMMAND_CONTRACTS = Object.freeze(Object.fromEntries(
  Object.entries(COMMAND_SPECS).map(([id, spec]) => [id, Object.freeze({ id, ...spec })]),
));
export const COMMAND_IDS = Object.freeze(Object.keys(COMMAND_CONTRACTS));

const normalizeCommandId = (raw) => {
  const normalized = raw.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/-/g, '_').toUpperCase();
  return ALIASES[normalized] ?? normalized;
};

const fail = (code, message, raw) => ({ ok: false, error: { code, message, raw } });
const integer = (value, min, max) => typeof value === 'number'
  && Number.isSafeInteger(value) && value >= min && value <= max;
const valueOf = (directive, key, index) => directive.named[key] ?? directive.positional[index];

function scalar(token) {
  if (token.length === 0 || token.length > 64) return null;
  if (token === 'true') return true;
  if (token === 'false') return false;
  if (/^-?\d+$/.test(token)) {
    const value = Number(token);
    return Number.isSafeInteger(value) ? value : null;
  }
  return token;
}

function tokenize(input) {
  const tokens = [];
  let index = 0;
  while (index < input.length) {
    while (index < input.length && /[\s,]/.test(input[index])) index += 1;
    if (index >= input.length) break;
    let token = '';
    const quote = input[index];
    if (quote === '"' || quote === "'") {
      index += 1;
      while (index < input.length && input[index] !== quote) {
        token += input[index];
        index += 1;
      }
      if (input[index] !== quote) return null;
      index += 1;
    } else {
      while (index < input.length && !/[\s,]/.test(input[index])) {
        token += input[index];
        index += 1;
      }
    }
    if (!token || token.length > 64) return null;
    tokens.push(token);
    if (tokens.length > MACRO_LIMITS.directives) return null;
  }
  return tokens;
}

/** Parse one macro into the bounded AST shape used by the NAR-08 runtime. */
export function parseMacro(raw) {
  if (typeof raw !== 'string') return fail('MALFORMED', 'Direktive ist kein String', String(raw));
  const display = raw.slice(0, MACRO_LIMITS.directiveLength);
  if (raw.length > MACRO_LIMITS.directiveLength) {
    return fail('TOO_LONG', `Direktive ist laenger als ${MACRO_LIMITS.directiveLength} Zeichen`, display);
  }
  if (!raw.startsWith('€')) return fail('MALFORMED', 'Direktive muss mit € beginnen', display);
  const body = raw.slice(1).trim();
  const name = NAME.exec(body);
  if (!name) return fail('MALFORMED', 'Direktive hat keinen Command-Namen', display);
  const remainder = body.slice(name[0].length).trim();
  const rest = remainder.startsWith(':') ? remainder.slice(1).trim() : remainder;
  const tokens = tokenize(rest);
  if (tokens === null) return fail('MALFORMED', 'Direktive hat ungueltige Argumente', display);

  let commandId = normalizeCommandId(name[0]);
  if (commandId === 'TRIGGER' && tokens[0]?.toLowerCase() === 'dialog') {
    commandId = 'TRIGGER_DIALOG';
    tokens.shift();
  }

  const positional = [];
  const named = {};
  for (const token of tokens) {
    const equals = token.indexOf('=');
    if (equals > 0) {
      const key = token.slice(0, equals);
      const value = scalar(token.slice(equals + 1));
      if (!KEY.test(key) || value === null || Object.hasOwn(named, key)) {
        return fail('DUPLICATE_ARG', 'Direktive hat ein doppeltes oder ungueltiges Argument', display);
      }
      named[key] = value;
      continue;
    }
    const value = scalar(token);
    if (value === null) return fail('MALFORMED', 'Direktive hat ein ungueltiges Argument', display);
    positional.push(value);
  }
  return { ok: true, directive: { commandId, positional, named, raw } };
}

function argumentsAllowed(directive, keys, maxPositional) {
  if (directive.positional.length > maxPositional) {
    return fail('INVALID_ARGS', 'Direktive hat zu viele Positionsargumente', directive.raw);
  }
  const unknown = Object.keys(directive.named).find((key) => !keys.includes(key));
  return unknown ? fail('INVALID_ARGS', `Unbekanntes Argument: ${unknown}`, directive.raw) : null;
}

function compileSetFlag(directive, flags) {
  const args = argumentsAllowed(directive, ['flag', 'delta'], 2);
  if (args) return args;
  const flag = valueOf(directive, 'flag', 0);
  if (typeof flag !== 'string' || !FLAG.test(flag)) {
    return fail('INVALID_ARGS', 'SET_FLAG braucht einen gueltigen Flag-Namen', directive.raw);
  }
  if (flags && !Object.hasOwn(flags, flag)) {
    return fail('UNKNOWN_FLAG', `SET_FLAG nennt kein kontrolliertes Flag: ${flag}`, directive.raw);
  }
  const delta = valueOf(directive, 'delta', 1) ?? 1;
  if (!integer(delta, -1_000, 1_000) || delta === 0) {
    return fail('INVALID_ARGS', 'SET_FLAG delta muss -1000..1000 ohne 0 sein', directive.raw);
  }
  return { ok: true, command: { id: 'SET_FLAG', flag, delta, raw: directive.raw } };
}

function compileRelationship(directive) {
  const args = argumentsAllowed(directive, ['from', 'to', 'dimension', 'delta'], 4);
  if (args) return args;
  const from = valueOf(directive, 'from', 0);
  const to = valueOf(directive, 'to', 1);
  const dimension = valueOf(directive, 'dimension', 2);
  const delta = valueOf(directive, 'delta', 3);
  if (typeof from !== 'string' || typeof to !== 'string' || !ACTOR.test(from) || !ACTOR.test(to)) {
    return fail('INVALID_TARGET', 'Content-Makros brauchen stabile ActorRefs, keine Teilnehmerindizes', directive.raw);
  }
  if (from === to) return fail('INVALID_TARGET', 'ADJUST_RELATIONSHIP braucht zwei verschiedene Ziele', directive.raw);
  if (typeof dimension !== 'string' || !DIMENSIONS.includes(dimension)) {
    return fail('INVALID_ARGS', 'ADJUST_RELATIONSHIP braucht eine gueltige Dimension', directive.raw);
  }
  if (!integer(delta, -10, 10) || delta === 0) {
    return fail('INVALID_ARGS', 'ADJUST_RELATIONSHIP delta muss -10..10 ohne 0 sein', directive.raw);
  }
  return {
    ok: true,
    command: { id: 'ADJUST_RELATIONSHIP', from, to, dimension, delta, raw: directive.raw },
  };
}

function compileFreeze(directive) {
  const args = argumentsAllowed(directive, ['ticks'], 1);
  if (args) return args;
  const ticks = valueOf(directive, 'ticks', 0);
  if (!integer(ticks, 1, MACRO_LIMITS.freezeTicks)) {
    return fail('INVALID_ARGS', `FREEZE_TICK braucht 1..${MACRO_LIMITS.freezeTicks} Ticks`, directive.raw);
  }
  return { ok: true, command: { id: 'FREEZE_TICK', ticks, raw: directive.raw } };
}

function compileCounter(directive) {
  const args = argumentsAllowed(directive, ['rival'], 1);
  if (args) return args;
  const rival = valueOf(directive, 'rival', 0);
  if (typeof rival !== 'string' || !ACTOR.test(rival) || !rival.startsWith('rival:')) {
    return fail('INVALID_TARGET', 'COUNTER_RIVAL braucht einen stabilen Rivalen-Ref', directive.raw);
  }
  return { ok: true, command: { id: 'COUNTER_RIVAL', rival, raw: directive.raw } };
}

function compileDialog(directive) {
  const args = argumentsAllowed(directive, ['dialogId'], 1);
  if (args) return args;
  const dialogId = valueOf(directive, 'dialogId', 0);
  if (typeof dialogId !== 'string' || !DIALOG.test(dialogId)) {
    return fail('INVALID_ARGS', 'TRIGGER_DIALOG braucht eine gueltige Dialog-ID', directive.raw);
  }
  return { ok: true, command: { id: 'TRIGGER_DIALOG', dialogId, raw: directive.raw } };
}

/** Compile one macro against the executable allowlist and controlled flags. */
export function compileMacro(raw, { flags = null } = {}) {
  const parsed = parseMacro(raw);
  if (!parsed.ok) return parsed;
  const commandId = parsed.directive.commandId;
  const spec = COMMAND_SPECS[commandId];
  if (!spec) return fail('UNKNOWN_COMMAND', `Unbekannter Command: ${commandId}`, parsed.directive.raw);
  if (!spec.executable) {
    return fail('COMMAND_NOT_EXECUTABLE', `${commandId} ist noch nicht ausfuehrbar`, parsed.directive.raw);
  }
  switch (commandId) {
    case 'SET_FLAG': return compileSetFlag(parsed.directive, flags);
    case 'ADJUST_RELATIONSHIP': return compileRelationship(parsed.directive);
    case 'FREEZE_TICK': return compileFreeze(parsed.directive);
    case 'TRIGGER_DIALOG': return compileDialog(parsed.directive);
    case 'COUNTER_RIVAL': return compileCounter(parsed.directive);
    default: return fail('UNKNOWN_COMMAND', `Unbekannter Command: ${commandId}`, parsed.directive.raw);
  }
}

/**
 * Compile a whole batch. One invalid macro or a duplicate singleton command
 * rejects the batch; the compiler never writes a partially valid registry.
 */
export function compileMacroBatch(raw, { flags = null } = {}) {
  if (!Array.isArray(raw)) {
    return { commands: [], issues: [{ code: 'MALFORMED', message: 'directives ist keine Liste', raw: String(raw) }] };
  }
  if (raw.length > MACRO_LIMITS.directives) {
    return {
      commands: [],
      issues: [{ code: 'TOO_MANY', message: `Mehr als ${MACRO_LIMITS.directives} Direktiven`, raw: '' }],
    };
  }
  const commands = [];
  const issues = [];
  const singletons = new Set();
  for (const entry of raw) {
    const result = compileMacro(entry, { flags });
    if (!result.ok) {
      issues.push(result.error);
      continue;
    }
    const spec = COMMAND_SPECS[result.command.id];
    if (spec?.singleton && singletons.has(result.command.id)) {
      issues.push({
        code: 'COMMAND_CONFLICT',
        message: `${result.command.id} darf pro Fragment nur einmal vorkommen`,
        raw: result.command.raw,
      });
      continue;
    }
    if (spec?.singleton) singletons.add(result.command.id);
    commands.push(result.command);
  }
  return issues.length === 0 ? { commands, issues: [] } : { commands: [], issues };
}
