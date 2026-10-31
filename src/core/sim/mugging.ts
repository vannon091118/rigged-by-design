/** Simulierter Überfall nach einer verlorenen Prügelei: Ziel wählen, greifen, fliehen. */
import type { Ledger } from '../economy/ledger';
import { toVCString, type VaCoinMicro } from '../economy/vacoin';
import type { Prng } from '../rng/prng';
import { buildDistribution, rollNumber } from '../rng/weighted';
import { HAUSKONTO, PORTEMONNAIE } from './money';
import { ROBBERY_ACCOUNT } from './penalty-pool';
import type { WorldState } from './types';

/** Was der Überfall vom Gegner braucht; das Duell reicht sein Profil hierher. */
interface MuggingProfile {
  readonly name: string;
  readonly archetype: string;
  readonly greed: number;
  readonly nerve: number;
}

export interface MuggingResult {
  readonly attempted: boolean;
  readonly stolen: VaCoinMicro;
  readonly caught: boolean;
  readonly target: 'KASSE' | 'PORTEMONNAIE' | 'KEINE';
}

const GUARD_COVER_RANGE = 6;
const GUARD_COVER = 25;
const AGENT_COVER = 8;
const BASE_ESCAPE = 30;
const NERVE_PER_POINT = 5;

const distance = (ax: number, ay: number, bx: number, by: number): number =>
  Math.abs(ax - bx) + Math.abs(ay - by);

/** Ein Guard in Reichweite deckt die Kasse; andere Angestellte stören nur. */
function coverAt(world: WorldState, x: number, y: number): number {
  let cover = 0;
  for (const agent of world.agents) {
    const range = distance(agent.x, agent.y, x, y);
    if (agent.role === 'guard' && range <= GUARD_COVER_RANGE) cover += GUARD_COVER;
    else if (range <= 2) cover += AGENT_COVER;
  }
  return cover;
}

/**
 * Erst wird ein Ziel gewählt, dann der Zugriff geprüft und zuletzt die Flucht;
 * nur eine gelungene Flucht bucht Geld, damit die Kasse nie doppelt zählt.
 */
export function simulateMugging(
  world: WorldState,
  ledger: Ledger,
  prng: Prng,
  profile: MuggingProfile,
): MuggingResult {
  const house = ledger.getBalance(HAUSKONTO);
  const wallet = ledger.getBalance(PORTEMONNAIE);
  const cashier = house >= wallet ? HAUSKONTO : PORTEMONNAIE;
  const target: MuggingResult['target'] = cashier === HAUSKONTO ? 'KASSE' : 'PORTEMONNAIE';
  const available = cashier === HAUSKONTO ? house : wallet;
  if (available <= 0) return { attempted: false, stolen: 0 as VaCoinMicro, caught: false, target: 'KEINE' };

  const percent = 10 + profile.greed * 3;
  const take = Math.floor((available * percent) / 100) as VaCoinMicro;
  if (take <= 0) return { attempted: true, stolen: 0 as VaCoinMicro, caught: false, target };

  const cover = coverAt(world, world.player.position.x, world.player.position.y);
  const escape = Math.max(5, Math.min(95, BASE_ESCAPE + profile.nerve * NERVE_PER_POINT - cover));
  const caught = rollNumber(prng, buildDistribution(1, 100)).value > escape;
  if (caught) {
    world.lastEvent = `${profile.name} wird beim Überfall gestellt, das Geld bleibt in der ${target === 'KASSE' ? 'Kasse' : 'Brieftasche'}.`;
    return { attempted: true, stolen: 0 as VaCoinMicro, caught, target };
  }
  ledger.transfer(cashier, ROBBERY_ACCOUNT, take, `Überfall: ${percent} % aus der ${target === 'KASSE' ? 'Kasse' : 'Brieftasche'}`, world.tick);
  world.lastEvent = `${profile.name} erbeutet ${percent} % aus der ${target === 'KASSE' ? 'Kasse' : 'Brieftasche'}.`;
  return { attempted: true, stolen: take, caught, target };
}

/** Für Protokoll und UI: was der Überfall am Ende bedeutet. */
export function describeMugging(result: MuggingResult): string {
  if (!result.attempted) return 'Der Überfall fand kein Ziel.';
  if (result.caught) return 'Der Überfall wurde gestellt, kein Geld verloren.';
  if (result.stolen <= 0) return 'Der Überfall blieb ohne Beute.';
  return `Überfall mit ${toVCString(result.stolen)} Beute.`;
}
