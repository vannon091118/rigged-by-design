# Playwright E2E-Testkette — `tests/`

## Architektur

```
tests/
├── playwright.config.ts          # Playwright-Konfiguration (3 Projekte: headed, headless)
├── run-e2e.ps1                   # PowerShell-Skript: startet Dev-Server, führt Tests aus, beendet Server
├── fixtures/
│   └── game.ts                   # Zentrale Fixtures: alle Page Objects + Snapshot-Helfer + GameFlow
├── pages/
│   ├── app.page.ts               # App-Root + Bereitschaft (Canvas/PixiJS)
│   ├── hud.page.ts               # HUD (Geld, Gäste, Ruf, globale Buttons)
│   ├── floor.page.ts             # PixiJS-Floor (Tastatur WASD, Klicks, Zoom)
│   ├── guest-popup.page.ts       # Gäste-Popup (Pay, Serve, Calm, Talk, Fight)
│   ├── machine-popup.page.ts     # Automaten-Popup (Test, Reparatur, Mod, Reel, Bet)
│   ├── games-popup.page.ts       # Rivalen-Spiele-Popup (Blackjack, Risiko, Hütchenspiel)
│   ├── journal-popup.page.ts     # Journal / Archiv
│   ├── diagnostics-popup.page.ts # Diagnostik / Ledger-Audit
│   ├── build-panel.page.ts       # Bau-Panel (Kaufen, Einstellen, Reparieren, Upgrade)
│   ├── smartphone.page.ts        # Smartphone-Apps
│   └── transfer.page.ts          # Export/Import von Spielständen
└── helpers/
    ├── snapshots.ts              # Snapshot-Helfer (LocalStorage, reload-basiert)
    ├── store-helpers.ts          # Direkter WorldStore-Zugriff (falls global exponiert)
    └── game-flow.ts              # Mehrschrittige Spielabläufe (Slot, Gäste, Build, Transfer)
```

## Laufweise

**Voraussetzung:** Der Vite-Dev-Server muss auf `http://localhost:3000` laufen:

```bash
# Terminal 1: Dev-Server starten
pnpm run dev --config src/Config/vite.config.ts

# Terminal 2: Playwright-Tests ausführen (headed, sichtbar)
npx playwright test --project=chromium-headed --headed
```

Oder mit dem PowerShell-Helfer (startet Server, führt Tests aus, beendet Server):

```powershell
pwsh -File run-e2e.ps1 -TestPattern "tests/*.spec.ts" -WaitSeconds 20
```

## Konventionen (agenten-transparent)

Jede Test-Datei beginnt mit einem Header-Block:

```
/**
 * @test-target src/core/sim/money.ts (openHouse, admitFiat, ...)
 * @test-target src/core/economy/ledger.ts (Ledger-Buchungen)
 * @expected-behavior Was muss passieren? (natürliche Sprache)
 * @coverage Welche Pfade werden abgedeckt?
 * @missing-edge-case Was fehlt noch? (Lücken explizit machen)
 */
```

Tests folgen dem Muster **GIVEN → WHEN → THEN** (als Kommentare im Test):

```ts
test('Slot spielen → Testspin → Ergebnis → Schließen', async ({ app, floor, machinePopup, hud }) => {
  // GIVEN: Floor ist bereit, Automaten stehen auf dem Floor
  await floor.waitForReady();
  
  // WHEN: Auf einen Automaten geklickt, Testspin ausgeführt
  await floor.clickFurnitureAt(450, 320);
  await machinePopup.clickTest();
  
  // THEN: Ergebnis sichtbar, HUD-Geld prüfbar, Popup schließt sauber
  await expect(hud.houseMoney).toBeVisible();
  await machinePopup.close();
});
```

## Snapshot-System (reproduzierbare Spielsituationen)

`saveSnapshot(name)` speichert den aktuellen `GameView` aus dem WorldStore ins LocalStorage unter `neon:snapshot:<name>`.

`setSnapshot(name)` lädt einen gespeicherten Snapshot und lädt die Seite neu.

Damit können Mechanik-Änderungen in **identischen Spielsituationen** verglichen werden:

```ts
test('Mechanik-Änderung X in Situation Y', async ({ app, hud, setSnapshot, saveSnapshot }) => {
  // Situation Y vorbereiten und speichern
  await saveSnapshot('situation-y');
  
  // Mechanik-Änderung anwenden
  // ...
  
  // Wieder in Situation Y laden und testen
  await setSnapshot('situation-y');
  // ...
});
```

## Screenshots, Videos, Traces

- `screenshot: 'only-on-failure'` — automatisch bei jedem Test-Fehler
- `video: 'retain-on-failure'` — nur bei fehlgeschlagenen Tests behalten
- `trace: 'on-first-retry'` — Trace bei erstem Retry (CI)
- Trace öffnen: `npx playwright show-trace test-results/<test>/trace.zip`
- HTML-Report: `npx playwright show-report`

## Was getestet wird

| Datei | Ziel | Mechaniken |
|-------|------|------------|
| `balance.spec.ts` | Geld & Ledger | Startkapital, Hauskonto, Portemonnaie, Gäste-Zähler, Tag/Ruf |
| `guests.spec.ts` | Gäste | Pay, Serve, Calm, Talk, leerer Zustand, Mehrfach-Interaktionen |
| `machines.spec.ts` | Spielautomaten | Testspin, Reparatur, Zustand/Plätze, leerer Floor, Zoom, WASD |
| `games.spec.ts` | Rivalen-Spiele | Besuchen, Take Home, Selbstausschluss, schnelle Sequenzen |
| `build.spec.ts` | Bauen & Verwalten | Build-Panel, Reinigen, Einstellen/Entlassen, Upgrade Bar/WC |
| `narrative.spec.ts` | Narrativ-Engine | Start-Pool, Ticks, Ledger-Audit, Event-Behandlung |
| `transfer.spec.ts` | Transfer | Export, Import, Save-Roundtrip, korrupter Import |
| `edge-cases.spec.ts` | Edge Cases | Einsatz-Grenzwerte, leere Zustände, Race Conditions, Escape |
