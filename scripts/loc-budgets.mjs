/**
 * LOC-Budgets pro Zustaendigkeit. Eine Datei gehoert genau zu einer Rolle:
 * Der erste Treffer gewinnt, damit keine zwei Wahrheiten ueber ihr Budget entstehen.
 *
 * cap     = harte Grenze der Zustaendigkeit
 * hotZone = ab hier ist die Datei zu gross fuer ihre Aufgabe; Aenderungen
 *           muessen bis unter diese Grenze reduzieren. Die Hot Zone wird je
 *           Zustaendigkeit bestimmt, nicht global. Legacy: 350 -> 200.
 */
export const LOC_BUDGETS = [
  { id: 'entry', cap: 60, hotZone: 45, matches: (name) => name === 'src/main.tsx' },
  { id: 'test', cap: 240, hotZone: 180, matches: (name) => name.includes('/__tests__/') || name.endsWith('.test.ts') || name.endsWith('.test.tsx') || name.endsWith('.bench.ts') },
  { id: 'engine', cap: 200, hotZone: 150, matches: (name) => name.startsWith('src/core/') },
  { id: 'state', cap: 220, hotZone: 165, matches: (name) => name.startsWith('src/store/') },
  { id: 'render', cap: 260, hotZone: 200, matches: (name) => name.startsWith('src/render/') },
  { id: 'ui', cap: 200, hotZone: 150, matches: (name) => name.startsWith('src/ui/') },
  { id: 'app', cap: 200, hotZone: 160, matches: (name) => name === 'src/App.tsx' },
];

export const DEFAULT_BUDGET = { id: 'utility', cap: 200, hotZone: 140 };

/**
 * Migrationsschuld: Dateien, die vor der Rollen-Registry schon eine 350er
 * Ausnahme trugen. Neue Eintraege sind verboten; ein Eintrag verschwindet,
 * sobald die Datei in ihre Zustaendigkeiten aufgeteilt ist.
 */
export const LEGACY_LOC = new Map([
  ['src/App.tsx', { cap: 350, hotZone: 200 }],
  ['src/core/economy/ledger.ts', { cap: 350, hotZone: 200 }],
  ['src/core/sim/staff.ts', { cap: 350, hotZone: 200 }],
  ['src/render/floor-view.ts', { cap: 350, hotZone: 200 }],
  ['src/render/guest-art.ts', { cap: 350, hotZone: 200 }],
  ['src/store/world-store.ts', { cap: 350, hotZone: 200 }],
]);

export function budgetFor(name) {
  return LOC_BUDGETS.find((budget) => budget.matches(name)) ?? DEFAULT_BUDGET;
}
