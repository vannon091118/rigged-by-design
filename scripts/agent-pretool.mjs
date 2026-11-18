#!/usr/bin/env node
/**
 * Claude-PreToolUse-Hook: Pflichtlektuere vor dem ersten Arbeitsschritt.
 *
 * Claude Code ruft den Hook mit dem Tool-Ereignis als JSON auf stdin auf. Die
 * Entscheidung selbst steht in `scripts/lib/agent-pretool.mjs` und ist ohne
 * diesen Prozess testbar. Exit 0 mit `permissionDecision: deny` blockiert das
 * Tool; ein erlaubtes Tool bekommt keine Ausgabe.
 *
 * Die Entscheidungs-Lib wird dynamisch geladen. Fehlt eine Abhaengigkeit
 * (frischer Klon vor `pnpm install`), ist die Pflichtlektuere nicht pruefbar;
 * dann sperrt der Hook. Ein Absturz mit Exit 1 waere fuer den Client ein
 * nicht blockierender Fehler - genau das stille Loch, das dieser Hook schliesst.
 */
const deny = (reason) => {
  process.stdout.write(
    `${JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      },
    })}\n`,
  );
  process.exit(0);
};

let pretoolDecision;
try {
  ({ pretoolDecision } = await import('./lib/agent-pretool.mjs'));
} catch (error) {
  deny(
    `Pflichtlektuere nicht pruefbar (${error?.code ?? 'Fehler'}): erst \`pnpm install\` ` +
      '(armt die Hooks und installiert den Tokenizer), dann `pnpm rbd docs read`.',
  );
}

let raw = '';
for await (const chunk of process.stdin) raw += chunk;

let input;
try {
  input = JSON.parse(raw || '{}');
} catch {
  // Fail-closed: ein unlesbares Ereignis darf kein Arbeiten freigeben.
  deny('PreToolUse-Eingabe unlesbar; Pflichtlektuere nicht belegt.');
}

const result = pretoolDecision({
  toolName: input.tool_name,
  toolInput: input.tool_input ?? {},
  root: process.env.RBD_GUARD_ROOT || input.cwd || process.cwd(),
});

if (result.decision === 'deny') deny(result.reason);
process.exit(0);
