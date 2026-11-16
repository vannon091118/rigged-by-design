/**
 * Die globale Befehlsoberflaeche: `rbd <gruppe> <aktion> [flags]`.
 *
 * Drei Ebenen, ein Muster. Kein Agent soll sich mehr `node scripts/…` oder
 * `pnpm run x:y -- --flag` merken, und kein Befehl braucht eine Pipe, weil die
 * Antworten unter dem 500-Token-Budget bleiben.
 *
 * Diese Tabelle ist die einzige Wahrheit ueber die Routen. `bin/rbd.mjs` fuehrt
 * sie aus, der Test `cli-surface.test.ts` prueft, dass jede Governance-Skriptzeile
 * aus `package.json` genau eine Route hat — ein neuer Befehl ohne Route wird rot.
 *
 * `source` nennt die `package.json`-Namen, die auf dieselbe Route zeigen; sie
 * bleiben als Kompatibilitaetsaliase bestehen.
 */
export const COMMANDS = Object.freeze([
  { group: 'agent', verb: 'start', run: ['scripts/agent-start.mjs'], source: ['agent:start'], purpose: 'Der eine Einstieg: Board, Claim, Mechanik, naechster Befehl' },
  { group: 'agent', verb: 'pretask', run: ['scripts/pretask.mjs'], source: ['agent:pretask'], purpose: 'Arbeitsbaum, Impact, Task-Vertrag, Laufbudget' },
  { group: 'agent', verb: 'context', run: ['scripts/agent-context.mjs'], source: ['agent:context'], purpose: 'Systeme, Invarianten, Tests, Gate-Plan' },
  { group: 'agent', verb: 'cause', run: ['scripts/agent-cause.mjs'], source: ['agent:cause'], purpose: 'Gate, Fix und Repro zu einem roten Lauf' },
  { group: 'agent', verb: 'feedback', run: ['scripts/agent-feedback.mjs'], source: ['agent:feedback'], purpose: 'Rueckmeldung als Board-Eintrag erfassen' },
  { group: 'agent', verb: 'new', run: ['scripts/agent-new.mjs'], source: ['agent:new'], purpose: 'Neue Agenten-Identitaet anlegen' },
  { group: 'agent', verb: 'verify', run: ['scripts/agent-verify.mjs'], source: ['agent:verify'], purpose: 'Identitaet und Claim pruefen' },
  { group: 'board', verb: 'sync', run: ['scripts/sync-board-state.mjs'], source: ['board:sync'], purpose: 'Board-Snapshot nachziehen' },
  { group: 'board', verb: 'overview', run: ['scripts/board-overview.mjs'], source: ['board:overview'], purpose: 'Board-Uebersicht fuer den Maintainer' },
  { group: 'board', verb: 'verify', run: ['scripts/verify-board-usage.mjs'], source: ['verify:board'], purpose: 'Board-Gate: Claim, Kommentar, Nutzung' },
  { group: 'claim', verb: 'register', run: ['scripts/claim-register.mjs'], source: ['claim:register'], purpose: 'Lokale Sperre aus dem Issue-Claim spiegeln' },
  { group: 'claim', verb: 'hygiene', run: ['scripts/claim-hygiene.mjs', '--check'], source: ['claim:hygiene'], purpose: 'Offene Claims und belegte Abschluesse pruefen' },
  { group: 'claim', verb: 'reconcile', run: ['scripts/reconcile-claims.mjs'], source: ['reconcile:claims'], purpose: 'Register gegen den Remote-Zustand nachziehen' },
  { group: 'claim', verb: 'verify', run: ['scripts/verify-lane-claims.mjs'], source: ['verify:claims'], purpose: 'Claim- und Scope-Gate' },
  { group: 'verify', verb: 'light', run: ['scripts/run-pipeline.mjs', '--profile=light'], source: ['verify:light'], purpose: 'Standard-Gate-Lauf waehrend der Arbeit' },
  { group: 'verify', verb: 'fast', run: ['scripts/run-pipeline.mjs', '--profile=fast'], source: ['verify:fast'], purpose: 'Lokaler Standard vor dem Push' },
  { group: 'verify', verb: 'quick', run: ['scripts/run-pipeline.mjs', '--profile=quick'], source: ['verify:quick', 'verify'], purpose: 'Schnellster vollstaendiger Gate-Satz' },
  { group: 'verify', verb: 'dev', run: ['scripts/run-pipeline.mjs', '--profile=dev'], source: ['verify:dev'], purpose: 'Light plus betroffene Tests' },
  { group: 'verify', verb: 'integration', run: ['scripts/run-pipeline.mjs', '--profile=integration'], source: ['verify:integration'], purpose: 'Integrationsprofil' },
  { group: 'verify', verb: 'release', run: ['scripts/run-pipeline.mjs', '--profile=release'], source: ['verify:release'], purpose: 'Releaseprofil' },
  { group: 'verify', verb: 'all', run: ['scripts/run-pipeline.mjs', '--profile=full'], source: ['verify:all'], purpose: 'Vollnachweis: Required-Gates plus Audit' },
  { group: 'verify', verb: 'fix', run: ['scripts/run-pipeline.mjs', '--fix', '--profile=quick'], source: ['fix'], purpose: 'Gates reparieren, dann pruefen' },
  { group: 'verify', verb: 'fix-all', run: ['scripts/run-pipeline.mjs', '--fix', '--profile=full'], source: ['fix:all'], purpose: 'Alle Gates reparieren und pruefen' },
  { group: 'verify', verb: 'scope', run: ['scripts/verify-scope.mjs'], source: ['verify:scope'], purpose: 'Diff gegen die Claim-Allowlist' },
  { group: 'verify', verb: 'budget', run: ['scripts/verify-output-budget.mjs', '--probe'], source: ['verify:output-budget'], purpose: 'Ausgabe-Budget aller Pflicht-Einstiegspunkte' },
  { group: 'verify', verb: 'docs', run: ['scripts/verify-docs.mjs'], source: ['verify:docs'], purpose: 'Doku-Pflichtgate' },
  { group: 'verify', verb: 'tree', run: ['scripts/verify-tree.mjs'], source: ['verify:tree'], purpose: 'Baum- und Schichtregeln' },
  { group: 'verify', verb: 'redundancy', run: ['scripts/verify-redundancy.mjs'], source: ['verify:redundancy'], purpose: 'Doppelte Wahrheiten' },
  { group: 'verify', verb: 'capabilities', run: ['scripts/verify-capabilities.mjs'], source: ['verify:capabilities'], purpose: 'Capabilities gegen registrierte Tests' },
  { group: 'verify', verb: 'headless', run: ['scripts/verify-headless-core.mjs'], source: ['verify:headless'], purpose: 'Headless-Kern ohne UI-Importe' },
  { group: 'verify', verb: 'placement', run: ['scripts/verify-test-placement.mjs'], source: ['verify:test-placement'], purpose: 'Testplatzierung' },
  { group: 'verify', verb: 'impact', run: ['scripts/verify-impact-graph.mjs'], source: ['verify:impact-graph'], purpose: 'Impact-Graph aktuell' },
  { group: 'verify', verb: 'quality', run: ['scripts/verify-test-quality.mjs'], source: ['verify:test-quality'], purpose: 'Testqualitaet' },
  { group: 'verify', verb: 'dead-code', run: ['scripts/verify-dead-code.mjs'], source: ['verify:dead-code'], purpose: 'Tote Exporte' },
  { group: 'verify', verb: 'assets', run: ['scripts/verify-assets.mjs'], source: ['verify:assets'], purpose: 'Asset-Manifest und Lizenzen' },
  { group: 'verify', verb: 'commit-msg', run: ['scripts/verify-commit-msg.mjs', '--head'], source: ['verify:commit-msg'], purpose: 'Commit-Nachricht gegen die Pflichtsektionen' },
  { group: 'ci', verb: 'local', run: ['scripts/local-ci.mjs'], source: ['ci:local'], purpose: 'Lokaler Vor-PR-Nachweis' },
  { group: 'ci', verb: 'status', run: ['scripts/ci-status.mjs'], source: ['ci:status'], purpose: 'PR-, Check- und Merge-Status' },
  { group: 'ci', verb: 'long', run: ['scripts/local-ci.mjs', '--profile=mechanics'], source: ['ci:long'], purpose: 'Lange Mechanik-Nachweise' },
  { group: 'verify', verb: 'long', run: ['scripts/local-ci.mjs', '--profile=mechanics'], source: ['verify:long'], purpose: 'Lange Mechanik-Nachweise ueber die Verify-Gruppe' },
  { group: 'test', verb: 'mechanics', run: ['scripts/local-ci.mjs', '--profile=mechanics'], source: ['test:mechanics'], purpose: 'Statistik, Soak, Langlauf, Benchmarks' },
  { group: 'turn', verb: 'finish', run: ['scripts/turn-push.mjs'], source: ['turn:finish'], purpose: 'Phasenwechsel, Commit, Vertrag, Push' },
  { group: 'turn', verb: 'fast', run: ['scripts/turn-push.mjs', '--profile=fast'], source: ['turn:finish:fast'], purpose: 'Turn-Ende mit Fast-Profil' },
  { group: 'turn', verb: 'integration', run: ['scripts/turn-push.mjs', '--profile=integration'], source: ['turn:finish:integration'], purpose: 'Turn-Ende mit Integrationsprofil' },
  { group: 'turn', verb: 'full', run: ['scripts/turn-push.mjs', '--profile=full'], source: ['turn:finish:full'], purpose: 'Turn-Ende mit Vollprofil' },
  { group: 'docs', verb: 'sync', run: ['scripts/doc-sync.mjs'], source: ['docs:sync'], purpose: 'Fehlende Doku-Marker ergaenzen' },
  { group: 'docs', verb: 'stub', run: ['scripts/doc-stub.mjs'], source: ['docs:stub'], purpose: 'Doku-Stub anlegen' },
  { group: 'narrative', verb: 'check', run: ['scripts/verify-narrative-content.mjs'], source: ['narrative:check'], purpose: 'Narrative-Quellen gueltig' },
  { group: 'narrative', verb: 'blocks', run: ['scripts/verify-narrative-blocks.mjs'], source: ['narrative:blocks'], purpose: 'Mengenquoten der Narrative-Bloecke' },
  { group: 'narrative', verb: 'compile', run: ['scripts/compile-narrative-content.mjs', '--write'], source: ['narrative:compile'], purpose: 'Narrative-Quellen kompilieren' },
  { group: 'hooks', verb: 'install', run: ['scripts/install-hooks.mjs'], source: ['hooks:install', 'prepare'], purpose: 'Git-Hooks auf .githooks zeigen lassen' },
  { group: 'webhook', verb: 'receive', run: ['scripts/webhook-receiver.mjs'], source: ['webhook:receive'], purpose: 'GitHub-Delivery pruefen oder annehmen' },
  { group: 'webhook', verb: 'install', run: ['scripts/install-webhook.mjs'], source: ['webhook:install'], purpose: 'Repo-Webhook anlegen oder pruefen' },
  { group: 'task', verb: 'pause', run: ['scripts/task-state.mjs', 'pause'], source: ['task:pause'], purpose: 'Task-Vertrag pausieren' },
  { group: 'task', verb: 'status', run: ['scripts/task-state.mjs', 'status'], source: ['task:status'], purpose: 'Task-Vertrag anzeigen' },
  { group: 'task', verb: 'complete', run: ['scripts/task-state.mjs', 'complete'], source: ['task:complete'], purpose: 'Task-Vertrag abschliessen' },
  { group: 'gov', verb: 'precommit', run: ['scripts/precommit.mjs'], source: ['gov:precommit'], purpose: 'Pre-Commit-Kette ausfuehren' },
  { group: 'worker', verb: 'init', run: ['scripts/worker-init.mjs'], source: ['worker:init'], purpose: 'Worker-Arbeitsbaum initialisieren' },
  { group: 'run', verb: 'budget', run: ['scripts/run-budget.mjs'], source: ['run:budget'], purpose: 'Laufbudget anzeigen' },
  { group: 'escalation', verb: 'plan', run: ['scripts/escalation-plan.mjs'], source: ['escalation:plan'], purpose: 'Eskalationsstufe und naechster Schritt' },
  { group: 'pr', verb: 'lift', run: ['scripts/lift-commit-body.mjs'], source: ['pr:lift'], purpose: 'Commit-Body in den PR heben' },
  { group: 'branches', verb: 'prune', run: ['scripts/branch-cleanup.mjs'], source: ['branches:prune'], purpose: 'Gemergte Lane-Branches aufraeumen' },
  { group: 'inventory', verb: 'build', run: ['scripts/build-inventory.mjs'], source: ['inventory:build'], purpose: 'Inventur neu erzeugen' },
  { group: 'sync', verb: 'deps', run: ['scripts/sync-dependency-matrix.mjs'], source: ['sync:deps'], purpose: 'Dependency-Matrix neu erzeugen' },
  { group: 'catalog', verb: 'build', run: ['scripts/test-catalog.mjs'], source: ['catalog'], purpose: 'Testkatalog neu erzeugen' },
  { group: 'sync', verb: 'generated', run: ['scripts/sync-generated.mjs'], source: [], purpose: 'Inventur, Marker, Registry und Roadmap neu erzeugen' }
]);

export const GROUP_ORDER = Object.freeze(['agent', 'board', 'claim', 'verify', 'ci', 'test', 'turn', 'docs', 'narrative', 'hooks', 'webhook', 'task', 'gov', 'worker', 'run', 'escalation', 'pr', 'branches', 'inventory', 'sync', 'catalog']);

/** Alle Routen einer Gruppe, in Tabellenreihenfolge. */
export function commandsOf(group) {
  return COMMANDS.filter((command) => command.group === group);
}

/** Die Route zu `gruppe aktion`, oder null. */
export function findCommand(group, verb) {
  return COMMANDS.find((command) => command.group === group && command.verb === verb) ?? null;
}

function distance(a, b) {
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j += 1) rows[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return rows[a.length][b.length];
}

/** Naechste Route fuer einen Tippfehler: gleiche Gruppe, Praefix oder kleine Distanz. */
export function suggestCommand(group, verb) {
  const pool = group ? commandsOf(group) : COMMANDS;
  const wanted = String(verb ?? '').toLowerCase();
  let best = null;
  for (const command of pool) {
    const score = distance(wanted, command.verb);
    if (best === null || score < best.score) best = { command, score };
  }
  if (best && best.score <= Math.max(2, Math.floor(wanted.length / 3))) return `${best.command.group} ${best.command.verb}`;
  const exactGroup = GROUP_ORDER.find((name) => name.startsWith(String(group ?? '').toLowerCase()));
  if (exactGroup && commandsOf(exactGroup).length > 0 && group !== exactGroup) return exactGroup;
  return 'help';
}
