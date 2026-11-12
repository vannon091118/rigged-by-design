/** Paketpfade, die echte Renderer brauchen: Figuren, Tischdeko, Boden und Partikel. */
export const ASSET = {
  cardBack: 'machines/table-games/card-back.png',
  dealerButton: 'machines/table-games/dealer-button.png',
  chip: 'machines/table-games/poker-chip-single.png',
  coinSpin: 'fx/particles/coins/coin-spin-01.png',
  carpet: 'environment/tiles/casino-carpet-plum.png',
  lightPool: 'environment/fx/light-pool.svg',
  floors: {
    wood: 'environment/floor/wood-planks.svg',
    tile: 'environment/floor/tile-grid.svg',
    stone: 'environment/floor/stone-marble.svg',
    linoleum: 'environment/floor/linoleum-speckle.svg',
    concrete: 'environment/floor/concrete-slab.svg',
    apartmentRug: 'environment/floor/apartment-rug.svg',
  },
  dealer: 'characters/head-02-01.png',
  heads: [
    'characters/head-01-01.png',
    'characters/head-01-03.png',
    'characters/head-01-05.png',
    'characters/head-02-01.png',
    'characters/head-02-04.png',
    'characters/head-02-07.png',
  ],
} as const;

/** Genau das, was vor dem ersten Frame geladen sein muss; der Rest bleibt lazy. */
export const RUNTIME_ART: readonly string[] = [
  ASSET.cardBack,
  ASSET.dealerButton,
  ASSET.chip,
  ASSET.coinSpin,
  ASSET.carpet,
  ASSET.lightPool,
  ...Object.values(ASSET.floors),
  ...ASSET.heads,
  'fx/particles/sparks/spark-01.png',
  'fx/particles/sparks/spark-02.png',
  'fx/particles/glow/glow-01.png',
  'fx/impacts/plinko/peg-hit-01.png',
  'fx/impacts/plinko/peg-hit-02.png',
];
