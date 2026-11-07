/** Gemeinsame Klartext-Labels für Personalstatus in Panel und Diagnose. */
import type { StaffRole, StaffTask } from '../core/sim/types';

export const ROLE_LABEL: Readonly<Record<StaffRole, string>> = {
  guard: 'Türsteher', cleaner: 'Reinigung', bartender: 'Barkeeper', cashier: 'Kassierer', porter: 'Lagerträger',
};

export const TASK_LABEL: Readonly<Record<StaffTask, string>> = {
  idle: 'wartet',
  toCrate: 'geht zur Kiste',
  toBar: 'bringt Getränke',
  toStorage: 'bringt Ersatzteile',
  toGuest: 'geht zum Gast',
  toDispute: 'geht zum Streit',
  cleaning: 'putzt',
  cashier: 'bedient die Kasse',
  patrol: 'läuft Streife',
  serve: 'arbeitet am Platz',
};
