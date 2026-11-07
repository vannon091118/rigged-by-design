import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { GovernanceReporter } from '../core/governance/test-harness';

const moduleSep = '[\\/]';
/** Paketpfad mit posix- oder Windows-Trenner; als String, damit ESLint keine Regex-Escapes prueft. */
const vendorPath = (names: string): RegExp => new RegExp(`node_modules${moduleSep}(?:${names})${moduleSep}`);
const VENDOR_REACT = vendorPath('react|react-dom|scheduler');
const PREVIEW_HOST = process.env.RBD_PREVIEW_HOST;

export default defineConfig({
  plugins: [react()],
  server: {
    // Standard: nur loopback. 0.0.0.0 nur bewusst per RBD_DEV_HOST (z. B. Cloud-Preview);
    // `vite preview` erbt diesen Wert, weil kein eigener preview.host gesetzt ist.
    host: process.env.RBD_DEV_HOST || 'localhost',
    port: 3000,
  },
  preview: {
    port: 3000,
    // Exakt der vom Cloud-Preview vergebene Host, nie eine pauschale Domain.
    allowedHosts: PREVIEW_HOST ? [PREVIEW_HOST] : undefined,
  },
  build: {
    // Rolldown-Aequivalent zu manualChunks. React bekommt einen eigenen,
    // cachebaren Vendor-Chunk. Pixi bleibt absichtlich ungruppiert: ein
    // Sammelchunk fuer das Paket zog dessen intern dynamisch geladene Teile ins
    // Initial-Bundle (gemessen 1.301.681 B roh / 390.278 B gzip statt
    // 1.246.800 B / 380.841 B). Die Spiel-Engines haengen am lazy geladenen
    // GamesPopup (`src/ui/games-popup-lazy.tsx`) und laden erst beim Oeffnen.
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'vendor-react', test: VENDOR_REACT, priority: 20 },
            // Die HUD-Data-URIs bleiben in einem kleinen Start-Chunk. Ohne die
            // Grenze zog Rolldown sie in den geteilten Icons-Chunk und zuvor
            // in den 184.813-B-Plinko-Chunk, obwohl der HUD sie sofort braucht.
            { name: 'hud-icons', test: /src[\\/]ui[\\/]hud-icons\.ts$/, priority: 10 },
          ],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: configDefaults.exclude,
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
