/**
 * Die Pflicht-Einstiegspunkte eines Agenten.
 *
 * Quelle ist nicht dieses Array, sondern der Repo-Vertrag: `AGENTS.md`
 * (Befehlstabelle, zehn Regeln), `docs/MECHANICS.md` (der eine Start, Hooks),
 * `package.json` (die Skriptnamen) und `.githooks/` (was Git erzwingt). Diese
 * Liste ist die ausfuehrbare Form davon: jeder Eintrag nennt den Pfad, den
 * Modus und den Grund, warum ein Agent ihn aufrufen muss.
 *
 * `json: true` markiert Werkzeugformat: es bleibt vollstaendig und wird nicht
 * gekappt. Alles andere laeuft durch `captureConsole` und bleibt unter
 * `TOKEN_BUDGET`; das vollstaendige Log steht unter `.verify-cache/output/`.
 *
 * `probe` ist der Befehl fuer die Messung im Gate. Nur Laeufe ohne Netz-,
 * Schreib- oder Commit-Wirkung sind erlaubt (`--json`, `--check`, `--help`-
 * freie Lesezugriffe); was nicht messbar ist, bleibt statisch geprueft.
 */
export const PCI = 'precommit';

/** Worker-Einstieg, Board, Commit, Verify, Turn-Ende — in dieser Reihenfolge. */
export const ENTRY_POINTS = Object.freeze([
  { id: 'agent:start', file: 'scripts/agent-start.mjs', phase: 'turn-start', why: 'Der eine Einstieg: Board, Claim, Mechanik, naechster Befehl.', json: false, probe: ['--brief'] },
  { id: 'agent:pretask', file: 'scripts/pretask.mjs', phase: 'turn-start', why: 'Arbeitsbaum, Impact, Task-Vertrag, Laufbudget.', json: false, probe: [] },
  { id: 'agent:context', file: 'scripts/agent-context.mjs', phase: 'turn-start', why: 'Systeme, Invarianten, betroffene Tests, Gate-Plan.', json: false, probe: [] },
  { id: 'claim:register', file: 'scripts/claim-register.mjs', phase: 'board', why: 'Lokale Kollisionssperre aus dem Issue-Claim spiegeln.', json: false, probe: [] },
  { id: 'board:sync', file: 'scripts/sync-board-state.mjs', phase: 'board', why: 'Board-Snapshot nachziehen.', json: false, probe: ['--check'] },
  { id: 'board:overview', file: 'scripts/board-overview.mjs', phase: 'board', why: 'Board-Uebersicht fuer den Maintainer-Lauf.', json: false, probe: [] },
  { id: 'verify:board', file: 'scripts/verify-board-usage.mjs', phase: 'board', why: 'Board-Gate im Pre-Push-Hook.', json: false, probe: [] },
  { id: 'verify:claims', file: 'scripts/verify-lane-claims.mjs', phase: 'commit', why: 'Claim- und Scope-Gate in Commit und Push.', json: false, probe: ['--ci'] },
  { id: 'reconcile:claims', file: 'scripts/reconcile-claims.mjs', phase: 'board', why: 'Register gegen den Remote-Zustand nachziehen.', json: false, probe: [] },
  { id: 'gov:precommit', file: 'scripts/precommit.mjs', phase: 'commit', why: 'Der Pre-Commit-Hook selbst.', json: false, probe: null },
  { id: 'verify:commit-msg', file: 'scripts/verify-commit-msg.mjs', phase: 'commit', why: 'Commit-Nachricht gegen die drei Pflichtsektionen.', json: false, probe: ['--help'] },
  { id: 'verify:scope', file: 'scripts/verify-scope.mjs', phase: 'commit', why: 'Diff gegen die Claim-Allowlist.', json: false, probe: [] },
  { id: 'verify:light', file: 'scripts/run-pipeline.mjs', phase: 'verify', why: 'Der Standard-Gate-Lauf waehrend der Arbeit.', json: false, probe: ['--profile=light'] },
  { id: 'ci:local', file: 'scripts/local-ci.mjs', phase: 'verify', why: 'Lokaler Vor-PR-Nachweis.', json: false, probe: ['--profile=mechanics', '--list'] },
  { id: 'verify:contracts', file: 'scripts/verify-contracts.mjs', phase: 'verify', why: 'Alle Vertraege: Owner, Writer, Test, Claim-Modus.', json: false, dynamic: true, probe: [] },
  { id: 'verify:merge-gate', file: 'scripts/verify-merge-gate.mjs', phase: 'verify', why: 'Serverseitiger Branch-Schutz von main, live gelesen.', json: false, dynamic: true, probe: [] },
  { id: 'verify:docs', file: 'scripts/verify-docs.mjs', phase: 'verify', why: 'Doku-Pflichtgate, einzeln aufrufbar.', json: false, dynamic: true, probe: [] },
  { id: 'verify:tree', file: 'scripts/verify-tree.mjs', phase: 'verify', why: 'Baum- und Schichtregeln.', json: false, dynamic: true, probe: [] },
  { id: 'verify:test-placement', file: 'scripts/verify-test-placement.mjs', phase: 'verify', why: 'Testplatzierung.', json: false, dynamic: true, probe: [] },
  { id: 'verify:redundancy', file: 'scripts/verify-redundancy.mjs', phase: 'verify', why: 'Doppelte Wahrheiten.', json: false, dynamic: true, probe: [] },
  { id: 'verify:impact-graph', file: 'scripts/verify-impact-graph.mjs', phase: 'verify', why: 'Impact-Graph aktuell.', json: false, dynamic: true, probe: [] },
  { id: 'narrative:check', file: 'scripts/verify-narrative-content.mjs', phase: 'verify', why: 'Narrative-Quellen gueltig.', json: false, dynamic: true, probe: [] },
  { id: 'narrative:blocks', file: 'scripts/verify-narrative-blocks.mjs', phase: 'verify', why: 'Mengenquoten der Narrative-Bloecke.', json: false, dynamic: true, probe: [] },
  { id: 'turn:finish', file: 'scripts/turn-push.mjs', phase: 'turn-end', why: 'Commit, Vertrag, Branch-Push.', json: false, probe: null },
  { id: 'agent:cause', file: 'scripts/agent-cause.mjs', phase: 'turn-end', why: 'Gate/Fix/Repro bei rotem Lauf.', json: false, probe: [] },
  { id: 'hooks:integrate', file: 'scripts/integrate.mjs', phase: 'hooks', why: 'Pre-Push-Integrationspruefung.', json: false, probe: ['--check', '--no-fetch'] },
  { id: 'hooks:post-merge', file: 'scripts/post-merge-closeout.mjs', phase: 'hooks', why: 'Generierte Artefakte nach dem Merge.', json: false, probe: null }
]);

/** Pfade, die als Werkzeugformat ungekuerzt bleiben (nur `--json`). */
export const JSON_ENTRY_POINTS = Object.freeze([
  { id: 'agent:start --json', file: 'scripts/agent-start.mjs', why: 'Werkzeugformat' },
  { id: 'agent:pretask --json', file: 'scripts/pretask.mjs', why: 'Werkzeugformat' },
  { id: 'agent:context --json', file: 'scripts/agent-context.mjs', why: 'Werkzeugformat' },
  { id: 'verify:board --json', file: 'scripts/verify-board-usage.mjs', why: 'Werkzeugformat' },
  { id: 'reconcile:claims --json', file: 'scripts/reconcile-claims.mjs', why: 'Werkzeugformat' }
]);
