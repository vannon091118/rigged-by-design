#!/usr/bin/env node
/**
 * Claude-PreToolUse-Hook: Pflichtlektuere vor dem ersten Arbeitsschritt.
 *
 * Claude Code ruft den Hook mit dem Tool-Ereignis als JSON auf stdin auf. Die
 * Entscheidung selbst steht in `scripts/lib/agent-pretool.mjs` und ist ohne
 * diesen Prozess testbar. Exit 0 mit `permissionDecision: deny` blockiert das
 * Tool; ein erlaubtes Tool bekommt keine Ausgabe.
 */
import { pretoolDecision } from './lib/agent-pretool.mjs';

let raw = '';
for await (const chunk of process.stdin) raw += chunk;

let input;
try {
  input = JSON.parse(raw || '{}');
} catch {
  // Fail-closed: ein unlesbares Ereignis darf kein Arbeiten freigeben.
  process.stdout.write(
    `${JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: 'PreToolUse-Eingabe unlesbar; Pflichtlektuere nicht belegt.',
      },
    })}\n`,
  );
  process.exit(0);
}

const result = pretoolDecision({
  toolName: input.tool_name,
  toolInput: input.tool_input ?? {},
  root: process.env.RBD_GUARD_ROOT || input.cwd || process.cwd(),
});

if (result.decision === 'deny') {
  process.stdout.write(
    `${JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: result.reason,
      },
    })}\n`,
  );
}
process.exit(0);
