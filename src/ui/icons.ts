/** Icons aus dem Paket: ein Pfad-Helfer, damit UI und Renderer dieselbe Basis nutzen. */
import manifest from '../render/assets/manifest.json';

const assetUrl = (relative: string): string => `${manifest.base}${relative}`;

export const UI_ICON = {
  coin: assetUrl('ui/coin.png'),
  guests: assetUrl('ui/guest-cyan.png'),
  star: assetUrl('ui/loyalty-star.png'),
  warning: assetUrl('ui/warning.png'),
  check: assetUrl('ui/success-check.png'),
  help: assetUrl('ui/help.png'),
  close: assetUrl('ui/close.png'),
  chip: assetUrl('machines/table-games/poker-chip-single.png'),
  croupier: assetUrl('characters/head-02-01.png'),
} as const;

export const GAME_ICON: Readonly<Record<string, string>> = {
  SLOT: assetUrl('machines/slot-cabinet.png'),
  PLINKO: assetUrl('machines/plinko-cabinet.png'),
  ROULETTE: assetUrl('machines/roulette-table.png'),
  BLACKJACK: assetUrl('machines/blackjack-table.png'),
  POKER: assetUrl('machines/poker-table.png'),
  VIDEO_POKER: assetUrl('machines/video-poker-terminal.png'),
  SHELL: assetUrl('machines/table-games/shell-game-cups-and-pearl.png'),
  DICE: assetUrl('machines/dice-table.png'),
};
