#!/usr/bin/env node
/**
 * E2E Test Runner – startet Playwright gegen den laufenden Dev-Server (localhost:3003).
 *
 * Vor dem Ausführen: `pnpm run dev -- --port 3003` starten.
 */
import { execSync } from 'node:child_process';

const port = process.env.E2E_PORT ?? '3003';

try {
  execSync(`npx playwright test --config tests/playwright.config.ts`, {
    stdio: 'inherit',
    env: { ...process.env, E2E_PORT: port },
  });
} catch {
  process.exit(1);
}
