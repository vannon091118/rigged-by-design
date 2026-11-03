/**
 * Minimale Page-Objekt-Typen für E2E-Test-Helfer.
 *
 * Vermeidet `any` in Test-Helfern, während die tatsächlichen Playwright
 * Page-Objekte weiterhin als Parameter durchgereicht werden.
 */

export interface FloorPage {
  clickFurnitureAt(x: number, y: number): Promise<void>;
  clickEmptyAt(x: number, y: number): Promise<void>;
  right(): Promise<void>;
  left(): Promise<void>;
  up(): Promise<void>;
  down(): Promise<void>;
  page: {
    keyboard: { press(key: string): void };
    waitForTimeout(ms: number): Promise<void>;
  };
  waitForReady(): Promise<void>;
  closeBuild(): Promise<void>;
  overview(): Promise<void>;
  zoomIn(): Promise<void>;
  zoomOut(): Promise<void>();
}

export interface MachinePopup {
  isOpen(): Promise<void>;
  clickTest(): Promise<void>;
  clickRepair(): Promise<void>;
  expectCondition(regex: RegExp): Promise<void>;
  expectSeats(regex: RegExp): Promise<void>;
  close(): Promise<void>;
  page: {
    getByLabel(regex: RegExp): { count(): Promise<number>; fill(text: string): Promise<void> };
    waitForTimeout(ms: number): Promise<void>;
  };
}

export interface Hud {
  houseMoney: { toBeVisible(): void };
  clickDiagnostics(): Promise<void>;
  clickGuests(): Promise<void>;
  page: { keyboard: { press(key: string): void }; waitForTimeout(ms: number): Promise<void> };
  expectHouseMoney(text: string | RegExp): Promise<void>;
}

export interface GuestPopup {
  isOpen(): Promise<void>;
  clickPay(): Promise<void>;
  clickServe(): Promise<void>;
  clickCalm(): Promise<void>;
  clickTalk(): Promise<void>;
  clickFight(): Promise<void>;
  close(): Promise<void>;
  page: { waitForTimeout(ms: number): Promise<void> };
}

export interface BuildPanel {
  isOpen(): Promise<void>;
  clickBuy(): Promise<void>;
}

export interface DiagnosticsPopup {
  isOpen(): Promise<void>;
  clickAudit(): Promise<void>;
  page: { waitForTimeout(ms: number): Promise<void> };
  expectIntegrityOk(): Promise<void>;
  close(): Promise<void>;
}

export interface TransferPanel {
  page: { waitForTimeout(ms: number): Promise<void> };
  getExportText(): Promise<string>;
  fillImport(text: string): Promise<void>;
  clickImport(): Promise<void>;
  expectImportOk(): Promise<void>;
  close(): Promise<void>;
}
