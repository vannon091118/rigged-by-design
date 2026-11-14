/**
 * Versionierte Liste der oeffentlichen Gameplay-RNG-Grenzen (#625).
 *
 * Der Guard `assertGameplayRng()` steht an jeder Funktion, die von aussen
 * (Store, UI, Tests) mit einem `Prng` aufgerufen wird und dabei Spielzustand
 * oder eine Spielentscheidung bewegt. Interne Helfer sichern sich nicht
 * doppelt ab: sie laufen nur hinter einer dieser Grenzen.
 *
 * Wer eine neue oeffentliche Grenze baut, traegt sie hier ein. Der Test
 * `src/core/rng/__tests__/gameplay-entry-role.test.ts` liest die Grenzmodule
 * und schlaegt fehl, sobald eine exportierte Funktion mit `Prng`-Parameter
 * hier fehlt. Die Nummer steigt, wenn sich die Bedeutung einer Zeile aendert
 * (nicht bei reinen Umbenennungen im Kommentar).
 */
export const GAMEPLAY_RNG_ENTRY_POINTS_VERSION = 1;

/** Weltgrenzen bewegen den gespeicherten Zustand, Spielgrenzen eine Runde. */
export type GameplayRngBoundary = 'world' | 'game';

export interface GameplayRngEntryPoint {
  /** Stabiler Schluessel fuer Befunde und Kommentare. */
  readonly id: string;
  /** Repo-relativer Pfad des Grenzmoduls. */
  readonly module: string;
  /** Name des exportierten Symbols im Grenzmodul. */
  readonly symbol: string;
  readonly boundary: GameplayRngBoundary;
  /** Ein Satz, warum genau diese Funktion eine Grenze ist. */
  readonly note: string;
}

export const GAMEPLAY_RNG_ENTRY_POINTS: readonly GameplayRngEntryPoint[] = Object.freeze([
  Object.freeze({
    id: 'sim.tickWorld',
    module: 'src/core/sim/tick.ts',
    symbol: 'tickWorld',
    boundary: 'world',
    note: 'Ein Tick der Welt: Spawn, Wege, Service, Laune und Personal bewegen den gespeicherten Zustand.',
  }),
  Object.freeze({
    id: 'sim.advanceToNextDay',
    module: 'src/core/sim/tick.ts',
    symbol: 'advanceToNextDay',
    boundary: 'world',
    note: 'Springt bis zum Tageswechsel und laesst den Grenztick laufen; die Uhr ist Teil des Weltzustands.',
  }),
  Object.freeze({
    id: 'games.playRound',
    module: 'src/core/games/round.ts',
    symbol: 'playRound',
    boundary: 'game',
    note: 'Dispatcher jeder Spielrunde; die Engine zieht aus dem Gameplay-Strom, nie aus dem Darstellungsstrom.',
  }),
]);

/** Grenzmodule, deren Exporte der Test gegen die Liste prueft. */
export const GAMEPLAY_RNG_BOUNDARY_MODULES: readonly string[] = Object.freeze([
  ...new Set(GAMEPLAY_RNG_ENTRY_POINTS.map((entry) => entry.module)),
]);
