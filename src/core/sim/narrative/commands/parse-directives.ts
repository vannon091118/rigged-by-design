/** Parser fuer €-Direktiven: erzeugt ein strikt begrenztes AST, nie Code. */
import {
  COMMAND_LIMITS, type DirectiveParseError, type DirectiveParseResult,
  type DirectiveScalar, type ParsedDirective,
} from './types';

const NAME = /^[A-Za-z][A-Za-z0-9_]*/;
const KEY = /^[A-Za-z][A-Za-z0-9_]{0,31}$/;
const ALIASES: Readonly<Record<string, string>> = {
  FREEZETICK: 'FREEZE_TICK',
  TRIGGERDIALOG: 'TRIGGER_DIALOG',
  SETFLAG: 'SET_FLAG',
  ADJUSTRELATIONSHIP: 'ADJUST_RELATIONSHIP',
};

const normalizeCommandId = (raw: string): string => {
  const normalized = raw.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/-/g, '_').toUpperCase();
  return ALIASES[normalized] ?? normalized;
};

function scalar(token: string): DirectiveScalar | null {
  if (token.length === 0 || token.length > 64) return null;
  if (token === 'true') return true;
  if (token === 'false') return false;
  if (/^-?\d+$/.test(token)) {
    const value = Number(token);
    return Number.isSafeInteger(value) ? value : null;
  }
  return token;
}

function tokenize(input: string): string[] | null {
  const tokens: string[] = [];
  let index = 0;
  while (index < input.length) {
    while (index < input.length && /[\s,]/.test(input[index]!)) index += 1;
    if (index >= input.length) break;
    let token = '';
    const quote = input[index];
    if (quote === '"' || quote === "'") {
      index += 1;
      while (index < input.length && input[index] !== quote) {
        token += input[index]!;
        index += 1;
      }
      if (input[index] !== quote) return null;
      index += 1;
    } else {
      while (index < input.length && !/[\s,]/.test(input[index]!)) {
        token += input[index]!;
        index += 1;
      }
    }
    if (!token || token.length > 64) return null;
    tokens.push(token);
    if (tokens.length > COMMAND_LIMITS.directives) return null;
  }
  return tokens;
}

function parseOne(textValue: string): ParsedDirective | DirectiveParseError {
  const raw = textValue.slice(0, COMMAND_LIMITS.directiveLength);
  if (textValue.length > COMMAND_LIMITS.directiveLength) return { code: 'TOO_LONG', raw };
  if (!textValue.startsWith('€')) return { code: 'MALFORMED', raw };
  const body = textValue.slice(1).trim();
  const name = NAME.exec(body);
  if (!name) return { code: 'MALFORMED', raw };
  const remainder = body.slice(name[0].length).trim();
  const rest = remainder.startsWith(':') ? remainder.slice(1).trim() : remainder;
  const tokens = tokenize(rest);
  if (tokens === null) return { code: 'MALFORMED', raw };

  let commandId = normalizeCommandId(name[0]);
  if (commandId === 'TRIGGER' && tokens[0]?.toLowerCase() === 'dialog') {
    commandId = 'TRIGGER_DIALOG';
    tokens.shift();
  }

  const positional: DirectiveScalar[] = [];
  const named: Record<string, DirectiveScalar> = {};
  for (const token of tokens) {
    const equals = token.indexOf('=');
    if (equals > 0) {
      const key = token.slice(0, equals);
      const value = scalar(token.slice(equals + 1));
      if (!KEY.test(key) || value === null || Object.hasOwn(named, key)) {
        return { code: 'DUPLICATE_ARG', raw };
      }
      named[key] = value;
      continue;
    }
    const value = scalar(token);
    if (value === null) return { code: 'MALFORMED', raw };
    positional.push(value);
  }
  return { commandId, positional, named, raw: textValue };
}

/** Ein einzelner Makroausdruck; null bedeutet fail-closed ungueltig. */
export function parseDirective(textValue: string): ParsedDirective | null {
  const result = parseOne(textValue);
  return 'commandId' in result ? result : null;
}

/** Ein Batch wird ganz abgelehnt, sobald ein Eintrag ungueltig ist. */
export function parseDirectives(raw: unknown): DirectiveParseResult {
  if (!Array.isArray(raw)) {
    return { directives: [], errors: [{ code: 'MALFORMED', raw: String(raw).slice(0, 240) }] };
  }
  if (raw.length > COMMAND_LIMITS.directives) return { directives: [], errors: [{ code: 'TOO_MANY', raw: '' }] };
  const directives: ParsedDirective[] = [];
  const errors: DirectiveParseError[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'string') {
      errors.push({ code: 'MALFORMED', raw: String(entry).slice(0, 240) });
      continue;
    }
    const parsed = parseOne(entry);
    if ('commandId' in parsed) directives.push(parsed);
    else errors.push(parsed);
  }
  return { directives, errors };
}
