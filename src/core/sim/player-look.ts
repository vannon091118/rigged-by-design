/** Der Look des Spielers: reine Daten, keine Gameplay-Wirkung. */

export type LookAccessory = 'NONE' | 'CAP' | 'GLASSES' | 'CHAIN';

export interface PlayerLook {
  readonly skin: string;
  readonly hair: string;
  readonly outfit: string;
  readonly accessory: LookAccessory;
}

export const LOOK_SKINS = ['#f2d3b3', '#e0b48c', '#b97c4b', '#8a5a36', '#d8a27a'] as const;
export const LOOK_HAIRS = ['#2a1a14', '#5a3a22', '#d9b35c', '#1a1020', '#9a5a2a'] as const;
export const LOOK_OUTFITS = ['#00ffcc', '#ff2e88', '#ffd166', '#b06bff', '#00c9a7'] as const;
export const LOOK_ACCESSORIES: readonly { id: LookAccessory; name: string }[] = [
  { id: 'NONE', name: 'Ohne' },
  { id: 'CAP', name: 'Cap' },
  { id: 'GLASSES', name: 'Brille' },
  { id: 'CHAIN', name: 'Kette' },
];

export const DEFAULT_LOOK: PlayerLook = {
  skin: LOOK_SKINS[0],
  hair: LOOK_HAIRS[0],
  outfit: LOOK_OUTFITS[0],
  accessory: 'NONE',
};

const isHex = (value: unknown): value is string =>
  typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);

/** Alte Saves und kaputte Eingaben fallen auf den Default zurueck. */
export function normalizeLook(raw: unknown): PlayerLook {
  if (!raw || typeof raw !== 'object') return DEFAULT_LOOK;
  const value = raw as Partial<PlayerLook>;
  const accessory = LOOK_ACCESSORIES.some((entry) => entry.id === value.accessory)
    ? value.accessory as LookAccessory
    : DEFAULT_LOOK.accessory;
  return {
    skin: isHex(value.skin) ? value.skin : DEFAULT_LOOK.skin,
    hair: isHex(value.hair) ? value.hair : DEFAULT_LOOK.hair,
    outfit: isHex(value.outfit) ? value.outfit : DEFAULT_LOOK.outfit,
    accessory,
  };
}

/** Nur echte Optionen sind erlaubt; die UI kann keinen freien Hex-Wert einschmuggeln. */
export function applyLook(current: PlayerLook, patch: Partial<PlayerLook>): PlayerLook {
  const next = normalizeLook({ ...current, ...patch });
  return {
    ...next,
    skin: (LOOK_SKINS as readonly string[]).includes(next.skin) ? next.skin : current.skin,
    hair: (LOOK_HAIRS as readonly string[]).includes(next.hair) ? next.hair : current.hair,
    outfit: (LOOK_OUTFITS as readonly string[]).includes(next.outfit) ? next.outfit : current.outfit,
  };
}
