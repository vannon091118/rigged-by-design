import { test as base } from '@playwright/test';
import { AppPage } from '../pages/app.page';
import { HudPage } from '../pages/hud.page';
import { FloorPage } from '../pages/floor.page';
import { GuestPopupPage } from '../pages/guest-popup.page';
import { MachinePopupPage } from '../pages/machine-popup.page';
import { GamesPopupPage } from '../pages/games-popup.page';
import { JournalPopupPage } from '../pages/journal-popup.page';
import { DiagnosticsPopupPage } from '../pages/diagnostics-popup.page';
import { BuildPanelPage } from '../pages/build-panel.page';
import { SmartphonePage } from '../pages/smartphone.page';
import { TransferPage } from '../pages/transfer.page';
import { setWorldSnapshot, clearStorage, captureCurrentState } from '../helpers/snapshots';
import { gameFlow } from '../helpers/game-flow';

type GameFixtures = {
  app: AppPage;
  hud: HudPage;
  floor: FloorPage;
  guestPopup: GuestPopupPage;
  machinePopup: MachinePopupPage;
  gamesPopup: GamesPopupPage;
  journalPopup: JournalPopupPage;
  diagnosticsPopup: DiagnosticsPopupPage;
  buildPanel: BuildPanelPage;
  smartphone: SmartphonePage;
  transfer: TransferPage;
  /** Setzt einen gespeicherten Spielzustand (Snapshot) vor dem Test. */
  setSnapshot: (name: string) => Promise<void>;
  /** Speichert den aktuellen Zustand als Snapshot unter einem Namen. */
  saveSnapshot: (name: string) => Promise<void>;
  /** Löscht LocalStorage/Cookies (kompletter Reset). */
  resetStorage: () => Promise<void>;
  /** GameFlow: kapselt mehrschrittige Spielabläufe (Slot spielen, bewegen, etc.) */
  flow: typeof gameFlow;
};

export const test = base.extend<GameFixtures>({
  app: async ({ page }, use) => {
    const app = new AppPage(page);
    await app.goto();
    await app.waitForReady();
    await use(app);
  },
  hud: async ({ page }, use) => {
    await use(new HudPage(page));
  },
  floor: async ({ page }, use) => {
    await use(new FloorPage(page));
  },
  guestPopup: async ({ page }, use) => {
    await use(new GuestPopupPage(page));
  },
  machinePopup: async ({ page }, use) => {
    await use(new MachinePopupPage(page));
  },
  gamesPopup: async ({ page }, use) => {
    await use(new GamesPopupPage(page));
  },
  journalPopup: async ({ page }, use) => {
    await use(new JournalPopupPage(page));
  },
  diagnosticsPopup: async ({ page }, use) => {
    await use(new DiagnosticsPopupPage(page));
  },
  buildPanel: async ({ page }, use) => {
    await use(new BuildPanelPage(page));
  },
  smartphone: async ({ page }, use) => {
    await use(new SmartphonePage(page));
  },
  transfer: async ({ page }, use) => {
    await use(new TransferPage(page));
  },
  setSnapshot: async ({ page }, use) => {
    await use(async (name: string) => {
      await setWorldSnapshot(page, name);
    });
  },
  saveSnapshot: async ({ page }, use) => {
    await use(async (name: string) => {
      await captureCurrentState(page, name);
    });
  },
  resetStorage: async ({ page }, use) => {
    await use(async () => {
      await clearStorage(page);
    });
  },
  flow: async ({ _unused }, use) => {
    await use(gameFlow);
  },
});

export { expect } from '@playwright/test';
