/**
 * Ruf hoert man: Der Gaeste-Ton folgt dem Ruf des Hauses, nicht dem Zufall.
 *
 * Die Narrative Engine liefert hier nur Text; die Auswahl ist ein reiner,
 * deterministischer Hash ueber Gast und Rufband. Kein Gameplay-PRNG, kein
 * Zustand, keine zweite Erzaehlmaschine: derselbe Gast im selben Band liest
 * denselben Satz, ein anderer Gast liest einen anderen.
 */
import type { Guest, WorldState } from '../types';
import { NARRATIVE_REGISTRY } from './composer/registry.generated';

type VoiceBand = 'LOW' | 'MID' | 'HIGH';

/** Ein Band je Slot: unter 40 spricht das Haus schlecht, ab 70 spricht es gut. */
export const VOICE_SLOT: Readonly<Record<VoiceBand, string>> = Object.freeze({
  LOW: 'guest-voice-low',
  MID: 'guest-voice-mid',
  HIGH: 'guest-voice-high',
});

export function voiceBand(reputation: number): VoiceBand {
  const bounded = Math.max(0, Math.min(100, Number.isFinite(reputation) ? reputation : 0));
  if (bounded < 40) return 'LOW';
  if (bounded < 70) return 'MID';
  return 'HIGH';
}

/** FNV-1a: stabiler Schluessel ohne Spiel-RNG, gleiche Eingabe gleiche Wahl. */
function hashOf(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/**
 * Die Stimme eines Gasts im aktuellen Rufband. `null` heisst: der Pool fehlt
 * (dann bleibt der mechanische Intent stehen) - nie ein stiller Fallback-Text,
 * der eine Figur behauptet, die es nicht gibt.
 */
export function guestVoice(world: WorldState, guest: Guest, reputation = world.reputation): string | null {
  const band = voiceBand(reputation);
  const slot = VOICE_SLOT[band];
  const candidates = NARRATIVE_REGISTRY.filter((fragment) => fragment.slot === slot && fragment.locale === 'de');
  if (candidates.length === 0) return null;
  const key = `${guest.visitorId ?? 0}:${guest.id}:${band}`;
  return candidates[hashOf(key) % candidates.length]?.text ?? null;
}

/** Intent plus Stimme: eine Zeile fuer die UI, keine zweite Datenwahrheit. */
export function voiceLine(world: WorldState, guest: Guest, base: string): string {
  const voice = guestVoice(world, guest);
  return voice ? `${base} ${voice}` : base;
}
