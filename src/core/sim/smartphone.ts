/**
 * Smartphone-Logik (headless).
 * Zentraler Zugangspunkt für Bauen, Kaufen, Casino-Wechsel, Putzen und Servieren.
 * Die UI-Anbindung erfolgt in Phase C (RadialMenu, SmartphoneUI).
 */

import type { Ledger } from '../economy/ledger';
import type { WorldState } from './types';

export interface SmartphoneApp {
  readonly id: string;
  readonly label: string;
  readonly available: (world: WorldState) => boolean;
  readonly execute: (world: WorldState, ledger: Ledger, actionId: string) => void;
}

export interface SmartphoneState {
  readonly open: boolean;
  readonly activeApp: string | null;
}

export function createSmartphoneState(): SmartphoneState {
  return { open: false, activeApp: null };
}

export function openSmartphone(state: SmartphoneState): void {
  state.open = true;
  state.activeApp = null;
}

export function closeSmartphone(state: SmartphoneState): void {
  state.open = false;
  state.activeApp = null;
}

export function selectApp(state: SmartphoneState, appId: string): void {
  state.activeApp = appId;
}

/**
 * Prüft, ob eine App im aktuellen Zustand verfügbar ist.
 */
export function isAppAvailable(world: WorldState, app: SmartphoneApp): boolean {
  return app.available(world);
}
