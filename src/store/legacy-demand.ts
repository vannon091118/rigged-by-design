/** Legacy-Savefeld aus der Zeit vor NAR-13; nur noch fuer die Migration. */
import type { DemandEventKind } from '../core/sim/types';

export interface DemandEvent {
  kind: DemandEventKind;
  untilTick: number;
}
