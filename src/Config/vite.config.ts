import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { GovernanceReporter } from '../core/governance/test-harness';
import testLanes from './test-lanes.json';

// Eine Quelle fuer die Mechanik-Nachweise: `src/Config/test-lanes.json`.
// Statistik-, Soak- und Langlauf-Suiten laufen nie in einem regulaeren Gate;
// `pnpm run test:mechanics` startet sie gezielt. Das frueher doppelte
// Ausschlussmuster (hier und im Testkatalog) ist damit entfallen.
const MECHANICS = testLanes.mechanics;
const MECHANICS_ONLY = process.env.RBD_TEST_PROFILE === 'mechanics';
/** Nur fuer die Vorher/Nachher-Messung: Regellaue enthalten keine Mechanik. */
const INCLUDE_EVERYTHING = process.env.RBD_TEST_PROFILE === 'all';
const TEST_TIMEOUT = Number(process.env.RBD_TEST_TIMEOUT) || 15_000;
const HOOK_TIMEOUT = Number(process.env.RBD_TEST_HOOK_TIMEOUT) || 5_000;

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
    // Exakt der vom Cloud-Preview vergebene Host, nie eine pauschale Domain;
    // ohne RBD_PREVIEW_HOST bleibt es bei Vites Loopback-Schutz.
    allowedHosts: PREVIEW_HOST ? [PREVIEW_HOST] : undefined,
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
    // Mechanik ist ein eigener Aufruf, kein Bestandteil des Regellaufs.
    include: MECHANICS_ONLY ? MECHANICS : ['src/**/*.test.{ts,tsx}'],
    ...(MECHANICS_ONLY || INCLUDE_EVERYTHING
      ? {}
      : { exclude: [...configDefaults.exclude, ...MECHANICS] }),
    reporters: ['default', new GovernanceReporter()],
    // Ein haengender Test ist ein Befund, kein 40-Sekunden-Warteplatz. Die
    // Mechanik-Suiten koennen ihr Budget per Env bewusst erhoehen.
    testTimeout: TEST_TIMEOUT,
    pool: 'threads',
    // Testdateien teilen keine mutierenden Singletons; Worker-Reuse spart pro Lauf
    // rund vier Sekunden Startzeit. Die UI-Suiten setzen den Store vor jedem
    // Fall selbst zurueck; Isolation pro Datei kostete 60 s ohne Zusatznutzen.
    isolate: false,
    teardownTimeout: 1_000,
    hookTimeout: HOOK_TIMEOUT,
    maxConcurrency: 8,
  },
});
