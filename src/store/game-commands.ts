/** Game Commands: Spielautomaten, Plinko, Ausschluss. */
import type { Ledger } from '../core/economy/ledger';
import { fromVC } from '../core/economy/vacoin';
import { deployGate, type GateResult } from '../core/games/plinko-sandbox';
import { normalizePlinkoConfig, plinkoProgress, type PlinkoConfig, type PlinkoMode } from '../core/games/plinko-config';
import { honorExclusionPact, startExclusionPact } from '../core/sim/self-exclusion-bet';
import { testSpin } from '../core/sim/actions';
import type { WorldState } from '../core/sim/types';

export function spinTestCmd(world: WorldState, itemId: number): { result: import('../core/games/contracts').GameResult | null; notice: string } {
  const item = world.furniture.find((entry) => entry.id === itemId);
  if (!item) return { result: null, notice: '' };
  const result = testSpin(item, world);
  const notice = item.gameId === 'SLOT' ? 'Slot-Telemetrie aktualisiert.' : 'Plinko-Bahn gespielt.';
  return { result, notice };
}

export function deployPlinkoCmd(world: WorldState, input: PlinkoConfig): GateResult {
  const config = normalizePlinkoConfig(input);
  const gate = deployGate(config, plinkoProgress(world.totalPlinkoDrops, world.addictionScore, config).rows);
  if (gate.ok) world.plinko = config;
  return gate;
}

export function setPlinkoModeCmd(world: WorldState, mode: PlinkoMode): string {
  if (mode !== 'SINGLE' && plinkoProgress(world.totalPlinkoDrops, world.addictionScore, world.plinko).rows < (mode === 'TWIN' ? 9 : 12)) {
    throw new Error(`${mode} ist noch nicht freigeschaltet.`);
  }
  world.plinkoMode = mode;
  return `Plinko-Modus: ${mode}.`;
}

export function exclusionCmd(world: WorldState, ledger: Ledger, command: 'START' | 'HONOR', limitVC: number): string {
  const result = command === 'START'
    ? startExclusionPact(world, ledger, fromVC(limitVC), world.tick)
    : honorExclusionPact(world, ledger, world.tick);
  return result.notice;
}
