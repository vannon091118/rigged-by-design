/**
 * Kurzlebige Kampf-Rueckmeldung: der Streit ist schon entschieden, der Floor zeigt
 * Treffer, Pose und Ausgang noch eine Weile an der Stelle, an der gekaempft wurde.
 */
export interface FightFx {
  readonly x: number;
  readonly y: number;
  readonly untilTick: number;
  readonly won: boolean;
  readonly rounds: number;
}
