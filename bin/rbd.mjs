#!/usr/bin/env node
/**
 * `rbd <gruppe> <aktion> [flags]` — die eine globale Befehlsoberflaeche.
 *
 * Drei Ebenen, immer dasselbe Muster: Praefix `rbd`, Gruppe, Aktion. Die Route
 * kommt aus `scripts/lib/command-surface.mjs`; Argumente werden unveraendert an
 * das Zielskript gegeben, Exit-Codes bleiben unveraendert. Eine Pipe braucht
 * niemand: die Antworten bleiben unter 500 Token, das Detail steht im Log.
 *
 * Exit 0 = ausgefuehrt oder Hilfe, Exit 2 = unbekannte Route.
 */
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GROUP_ORDER, commandsOf, findCommand, suggestCommand } from '../scripts/lib/command-surface.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const [group, verb, ...rest] = args;

/** Kurz halten: die Hilfe ist selbst Ausgabe und bleibt im Budget. */
function overview() {
  const lines = ['rbd <gruppe> <aktion> [flags]', ''];
  for (const name of GROUP_ORDER) {
    const verbs = commandsOf(name).map((command) => command.verb);
    lines.push(`${name.padEnd(11)} ${verbs.join(' ')}`);
  }
  lines.push('', 'Beispiel  rbd agent start --brief · rbd verify light · rbd turn finish');
  lines.push('Hilfe     rbd help <gruppe> · Vertrag: docs/MECHANICS.md');
  return lines.join('\n');
}

function groupHelp(name) {
  const commands = commandsOf(name);
  if (commands.length === 0) return null;
  const width = Math.max(...commands.map((command) => command.verb.length));
  return [`rbd ${name} <aktion>`, '', ...commands.map((command) => `  ${command.verb.padEnd(width)}  ${command.purpose}`), '', `Beispiel  rbd ${name} ${commands[0].verb}`].join('\n');
}

if (!group || group === 'help' || group === '--help' || group === '-h') {
  if (verb) {
    const help = groupHelp(verb);
    if (help) {
      console.log(help);
      process.exit(0);
    }
  }
  console.log(overview());
  process.exit(0);
}

if (!verb) {
  const help = groupHelp(group);
  if (help) {
    console.log(help);
    process.exit(2);
  }
}

const command = findCommand(group, verb ?? '');
if (!command) {
  const suggestion = suggestCommand(group, verb);
  console.error(`rbd: unbekannte Route "${[group, verb].filter(Boolean).join(' ')}" · naechste: rbd ${suggestion}`);
  console.error('Alle Routen: rbd help');
  process.exit(2);
}

const result = spawnSync(process.execPath, [join(ROOT, command.run[0]), ...command.run.slice(1), ...rest], {
  cwd: process.cwd(),
  stdio: 'inherit',
  env: process.env,
});
if (result.error) {
  console.error(`rbd: ${command.group} ${command.verb}: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
