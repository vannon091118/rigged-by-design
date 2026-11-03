import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // wichtig: PixiJS-App braucht exklusiven Dev-Server-Zugriff
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // einzelner Worker für stabile headed-Ausführung
  reporter: process.env.CI ? 'dot' : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    headless: false, // immer sichtbar (headed) für lokale Entwicklung
    launchOptions: {
      headless: false,
      args: ['--autoplay-policy=no-user-gesture-required'], // Audio ohne Gesten erlauben
    },
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: 'chromium-headed',
      use: { ...devices['Desktop Chrome'], headless: false },
    },
  ],
  // Dev-Server wird NICHT hier gestartet (PixiJS-Canvas-Problematik).
  // Bitte separat starten: pnpm run dev --config src/Config/vite.config.ts
  // Dann: npx playwright test --project=chromium-headed
  webServer: undefined,
});
