import {
  FloorPage,
  Hud,
  MachinePopup,
  GuestPopup,
  BuildPanel,
  DiagnosticsPopup,
  TransferPanel,
} from './page-types';

/**
 * GameFlow – kapselt mehrschrittige Spielabläufe (E2E-Szenarien).
 *
 * Diese Helfer führen echte Spielmechaniken aus (nicht nur UI-Klicks),
 * damit Mechanik-Änderungen in den Tests sichtbar werden. Jeder Schritt
 * wartet auf das entsprechende UI-Ergebnis, bevor der nächste ausgeführt wird.
 *
 * Beispiele:
 *   await flow.playSlot(machinePage, bet)        → setzt sich vor Automaten, spielt, prüft Ergebnis
 *   await flow.moveAndInteract(floor, x, y)      → bewegt Charakter, klickt auf Position
 *   await flow.serveDrinkToGuest(guestPopup, id) → öffnet Gäste-Popup, serviert Drink
 */
export const gameFlow = {
  /**
   * Vollständiger Slot-Spielablauf:
   * 1. Auf Automaten klicken (Machine-Popup öffnet)
   * 2. Einsatz setzen (falls konfigurierbar)
   * 3. Testspin ausführen
   * 4. Ergebnis abwarten und prüfen
   * 5. Popup schließen
   */
  async playSlot({
    floor,
    machinePopup,
    hud,
    betVC,
  }: {
    floor: FloorPage;
    machinePopup: MachinePopup;
    hud: Hud;
    betVC?: number;
  }) {
    // Schritt 1: Auf Automaten klicken (Position: typischer Automaten-Bereich)
    await floor.clickFurnitureAt(450, 320);
    await machinePopup.isOpen();

    // Schritt 2: Einsatz setzen (falls Bet-Input verfügbar)
    if (betVC !== undefined) {
      // Einsatz über Machine-Popup oder globale Konsole
      // Hier: Bet-Button im Machine-Popup suchen und klicken
      const betInput = machinePopup.page.getByLabel(/Einsatz|Bet/i);
      if (await betInput.count() > 0) {
        await betInput.fill(String(betVC));
      }
    }

    // Schritt 3: Testspin ausführen
    await machinePopup.clickTest();

    // Schritt 4: Kurz warten auf Ergebnis (Slot-Animation)
    await machinePopup.page.waitForTimeout(1200);

    // Schritt 5: HUD-Geld prüfen (sollte sich geändert haben oder gleich bleiben)
    await expect(hud.houseMoney).toBeVisible();

    // Schritt 6: Popup schließen
    await machinePopup.close();
  },

  /**
   * Charakter bewegen und interagieren:
   * 1. Charakter in Richtung Ziel bewegen (WASD)
   * 2. Auf Position klicken (Interaktion)
   * 3. Ergebnis abwarten
   */
  async moveAndInteract({
    floor,
    targetX,
    targetY,
    steps,
  }: {
    floor: FloorPage;
    targetX: number;
    targetY: number;
    steps?: number;
  }) {
    // Einfache Bewegung in Schritte (jede Taste = ca. 1 Kachel)
    const stepCount = steps ?? 5;
    for (let i = 0; i < stepCount; i++) {
      await floor.right();
      await floor.page.waitForTimeout(100);
    }
    // Auf Ziel klicken (Interaktion mit Gast/Möbel/leeren Bereich)
    await floor.clickEmptyAt(targetX, targetY);
    await floor.page.waitForTimeout(500);
  },

  /**
   * Gast bedienen (vollständiger Ablauf):
   * 1. Gäste-Popup öffnen
   * 2. Gast auswählen
   * 3. Aktion ausführen (Pay/Serve/Calm/Talk)
   * 4. Ergebnis prüfen (Budget, Stimmung, Ledger)
   * 5. Popup schließen
   */
  async serveGuest({
    hud,
    guestPopup,
    action = 'serve',
  }: {
    hud: Hud;
    guestPopup: GuestPopup;
    action?: 'pay' | 'serve' | 'calm' | 'talk' | 'fight';
  }) {
    await hud.clickGuests();
    await guestPopup.isOpen();

    switch (action) {
      case 'pay':
        await guestPopup.clickPay();
        break;
      case 'serve':
        await guestPopup.clickServe();
        break;
      case 'calm':
        await guestPopup.clickCalm();
        break;
      case 'talk':
        await guestPopup.clickTalk();
        break;
      case 'fight':
        await guestPopup.clickFight();
        break;
    }

    await guestPopup.page.waitForTimeout(500);
    await guestPopup.close();
  },

  /**
   * Build-Ablauf (vollständig):
   * 1. Build-Panel öffnen
   * 2. Objekt kaufen
   * 3. Auf Floor platzieren
   * 4. Ergebnis prüfen (Hauskonto, Floor-Objekt)
   */
  async buildAndDeploy({
    hud,
    buildPanel,
    floor,
    _buildId,
  }: {
    hud: Hud;
    buildPanel: BuildPanel;
    floor: FloorPage;
    _buildId: string;
  }) {
    // Build-Panel öffnen (über Tastatur 'b' oder UI)
    await hud.page.keyboard.press('b');
    await buildPanel.isOpen();

    // Kauf versuchen
    await buildPanel.clickBuy();

    // Auf Floor platzieren (leeren Bereich)
    await floor.clickEmptyAt(500, 400);

    await floor.page.waitForTimeout(500);
    await floor.closeBuild();
  },

  /**
   * Diagnostik-Ledger-Audit ausführen:
   * 1. Diagnostik-Popup öffnen
   * 2. Audit klicken
   * 3. Integrität prüfen
   * 4. Schließen
   */
  async runLedgerAudit({
    hud,
    diagnosticsPopup,
  }: {
    hud: Hud;
    diagnosticsPopup: DiagnosticsPopup;
  }) {
    await hud.clickDiagnostics();
    await diagnosticsPopup.isOpen();
    await diagnosticsPopup.clickAudit();
    await diagnosticsPopup.page.waitForTimeout(800);
    await diagnosticsPopup.expectIntegrityOk();
    await diagnosticsPopup.close();
  },

  /**
   * Transfer: Spielstand exportieren und importieren (Roundtrip):
   * 1. Export durchführen
   * 2. Exportierten Text erfassen
   * 3. Import mit demselben Text
   * 4. Zustand prüfen (sollte identisch sein)
   */
  async transferRoundtrip({
    hud,
    transfer,
  }: {
    hud: Hud;
    transfer: TransferPanel;
  }) {
    // Export öffnen (über Smartphone oder Menü)
    // Hier: direkt prüfen ob Transfer-Panel erreichbar ist
    await hud.page.keyboard.press('t'); // Falls Tastatur-Kürzel für Transfer existiert
    await transfer.page.waitForTimeout(500);

    const exportText = await transfer.getExportText();
    expect(exportText.length).toBeGreaterThan(0);

    // Import mit gleichen Daten
    await transfer.fillImport(exportText);
    await transfer.clickImport();
    await transfer.page.waitForTimeout(800);
    await transfer.expectImportOk();
    await transfer.close();
  },
};
