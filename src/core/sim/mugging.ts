/** Simulierter Überfall nach einer verlorenen Prügelei: Ziel wählen, greifen, fliehen. */
import type { Ledger } from '../economy/ledger';
import { toVCString, type VaCoinMicro } from '../economy/vacoin';
import type { Prng } from '../rng/prng';
import { buildDistribution, rollNumber } from '../rng/weighted';
import { HAUSKONTO, PORTEMONNAIE } from './money';
import { ROBBERY_ACCOUNT } from './penalty-pool';
import { agentsInRange } from './staff-queries';
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

/** Ein Guard in Reichweite deckt die Kasse; andere Angestellte stören nur. */
function coverAt(world: WorldState, x: number, y: number): number {
  const point = { x, y };
  const guards = agentsInRange(world, point, GUARD_COVER_RANGE, 'guard');
  const others = agentsInRange(world, point, 2) - guards;
  return guards * GUARD_COVER + Math.max(0, others) * AGENT_COVER;
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
