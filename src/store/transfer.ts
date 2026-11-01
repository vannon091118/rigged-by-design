/** Import und Export von Spielstaenden: Plan zuerst, Anwenden erst nach Pruefung. */
import { buildEnvelope, parseEnvelope, type TransferEnvelope } from '../core/io/envelope';
import { blocking, countIssues, type TransferIssue } from '../core/io/issues';
import { repairPayload } from '../core/io/repair';
import type { Ledger } from '../core/economy/ledger';
import type { WorldState } from '../core/sim/types';
import { replaySave, toSavedGame } from './save';

export interface TransferReport {
  readonly ok: boolean;
  readonly issues: readonly TransferIssue[];
  readonly fatal: number;
  readonly repairs: number;
  readonly ignored: number;
}

interface LoadedGame {
  readonly world: WorldState;
  readonly ledger: Ledger;
  readonly prngState: number;
}

function summarize(issues: readonly TransferIssue[]): TransferReport {
  const counts = countIssues(issues);
  return { ok: !blocking(issues), issues, fatal: counts.fatal, repairs: counts.repair, ignored: counts.ignored };
}

export function exportGameData(world: WorldState, ledger: Ledger, prngState: number, savedAt = new Date().toISOString()): string {
  return JSON.stringify(buildEnvelope(toSavedGame(world, ledger, prngState), savedAt), null, 2);
}

/** Trockenlauf und Anwendung in einem: liefert Befunde und, wenn sauber, den geladenen Stand. */
export function planImportData(raw: string): { report: TransferReport; loaded: LoadedGame | null } {
  const parsed = parseEnvelope(raw);
  const envelope: TransferEnvelope | null = parsed.envelope;
  if (!envelope) return { report: summarize(parsed.issues), loaded: null };
  const repaired = repairPayload(envelope.payload);
  const issues = [...parsed.issues, ...repaired.issues];
  if (blocking(issues)) return { report: summarize(issues), loaded: null };
  const loaded = replaySave(repaired.payload);
  if (!loaded) {
    issues.push({ code: 'ERR-5001', level: 'FATAL', path: 'world', message: 'Welt oder Ledger liessen sich nicht wiederherstellen.' });
    return { report: summarize(issues), loaded: null };
  }
  return { report: summarize(issues), loaded };
}
