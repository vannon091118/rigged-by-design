import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { GovernanceReporter } from './src/core/governance/test-harness';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    reporters: ['default', new GovernanceReporter()],
    testTimeout: 40_000,
    // Threads statt Prozess-Forks: sie sterben mit dem Runner, es bleiben keine
    // verwaisten Worker-Prozesse zurueck. Der Teardown wird hart begrenzt,
    // damit ein haengender Test den Lauf nicht blockiert.
    pool: 'threads',
    // Testdateien teilen keine mutierenden Singletons; Worker-Reuse spart pro Lauf
    // rund vier Sekunden Startzeit. Bei modulglobalem Zustand wieder anschalten.
    isolate: false,
    teardownTimeout: 2_000,
    hookTimeout: 10_000,
    maxConcurrency: 8,
  },
});
