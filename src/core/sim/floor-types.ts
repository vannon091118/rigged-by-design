import type { LayoutState } from './layout-types';
import type { Furniture, Guest, Point, RivalId, TemplateId, Zone } from './types-model';
import type { JobStationDef } from './job-types';

/** Fremdes Casino als besuchbarer Floor mit eigenem Plan und eigenem Zustrom. */
export interface ForeignFloorState {
  readonly id: number; readonly rivalId: RivalId; readonly size: number;
  zones: Zone[]; furniture: Furniture[];
  readonly jobStations: readonly JobStationDef[];
  /** Der fremde Floor traegt seinen eigenen Plan, nicht nur seine Groesse. */
  layout?: LayoutState; template?: TemplateId; guests?: Guest[];
  playerPosition: Point | null; playerPath: Point[]; playerPathIndex: number;
  playerCarrying: string; day: number; lastPaidDay: number;
}
