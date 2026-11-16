import type { PlayerJobId, RivalId, JobTaskType } from './types-model';

export interface PlayerJobState {
  readonly jobId: PlayerJobId; readonly rivalId: RivalId; readonly stationId: string;
  currentTask: PlayerJobTask | null; workDays: number; lastPaidDay: number;
  lastWorkDay: number;
  careerRank: number;
  performanceHistory: number[];
  appliedTo: string | null;
  offeredBy: string | null;
}

export interface PlayerJobTask {
  readonly stationId: string; readonly taskType: JobTaskType;
  ticksElapsed: number; readonly ticksTotal: number;
}

export interface JobStationDef {
  readonly id: string; readonly jobId: PlayerJobId; readonly x: number; readonly y: number;
  readonly w: number; readonly h: number; readonly label: string; readonly description: string;
}
