/** Die Board-Reihenfolge kommt aus den Issues, nicht aus dem Register. */
import { readBoard } from './issue-claim.mjs';
import { ROOT } from './report.mjs';

export function runBoard({ branch, notes, warnings }) {
  const board = branch === 'main' ? { checked: true, items: [], total: 0 } : readBoard({ limit: 6, cwd: ROOT });
  if (board.items.length > 0) {
    notes.push(`Board-Reihenfolge: ${board.items.map((item) => `#${item.number} ${item.priority}${item.state ? `/${item.state.replace('zustand-', '')}` : ''}`).join(' -> ')}`);
  } else if (!board.checked) {
    warnings.push(`Board nicht lesbar (${board.error}); die Reihenfolge aus den Issues bleibt verbindlich`);
  }
  return board;
}
