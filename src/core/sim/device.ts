/**
 * Geräteidentität und Spieltyp sind zwei verschiedene Fragen.
 *
 * `kind` sagt, was auf dem Floor steht: Kabinett, Tisch, Bar, Lager, Deko.
 * `gameId` sagt, welches Spiel darauf läuft. Dass ein Plinko-Kabinett die
 * Geräteidentität `SLOT` trägt, ist eine Katalogentscheidung und kein Spieltyp;
 * deshalb wird beides hier abgeleitet und nie aus dem anderen erraten.
 */
import { buildDefOf } from './offers';
import type { Furniture, GameId } from './types';

/** Spieltyp eines Geräts; Service und Deko haben keinen. */
export function gameOf(item: Pick<Furniture, 'gameId'>): GameId | null {
  return item.gameId ?? null;
}

/** Geräteidentität, die der Katalog für einen Spieltyp vorsieht. */
function deviceKindOf(game: GameId): Furniture['kind'] | null {
  return buildDefOf(game)?.kind ?? null;
}

/** Kabinett: Slot und Plinko stehen im selben Gehäuse. */
export function isCabinet(item: Pick<Furniture, 'kind'>): boolean {
  return item.kind === 'SLOT';
}

/** Katalogtreue: widersprechen sich Spieltyp und Geräteidentität? */
function identityMismatch(item: Pick<Furniture, 'kind' | 'gameId'>): boolean {
  if (!item.gameId) return false;
  return deviceKindOf(item.gameId) !== item.kind;
}

/**
 * Behebt alte Speicherstände: die Geräteidentität folgt dem Katalog, nie
 * umgekehrt. Ein Spieltyp, den der Katalog nicht kennt, wird still entfernt,
 * statt ein Gerät mit fremder Identität stehen zu lassen.
 */
export function repairDeviceIdentity(
  item: Pick<Furniture, 'kind' | 'gameId'>,
): { kind: Furniture['kind']; gameId: GameId | undefined } {
  if (!item.gameId || !identityMismatch(item)) return { kind: item.kind, gameId: item.gameId };
  const kind = deviceKindOf(item.gameId);
  return kind === null ? { kind: item.kind, gameId: undefined } : { kind, gameId: item.gameId };
}
