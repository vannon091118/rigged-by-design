import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { GovernanceReporter } from '../core/governance/test-harness';

// Messung 31.10.2026: RTP-, Balance- und Soak-Nachweise kosten 52,2 s von 72,5 s CPU-Zeit
// der ganzen Suite und damit 15 s der 33,6 s Gate-Wandzeit. Das schnelle Profil laesst sie
// weg und ist damit Entwicklungsfeedback, kein Freigabenachweis: `verify:all` und
// `verify:release` fahren sie immer mit.
const quickProfile = process.env.RBD_TEST_PROFILE === 'quick';
const quickExclude = [
  '**/round-rtp-*.test.ts',
  '**/soak.test.ts',
  '**/slot-session-rtp.test.ts',
  '**/poker-distribution.test.ts',
  '**/balance-operating.test.ts',
  '**/*.bench.ts',
];

const moduleSep = '[\\/]';
/** Paketpfad mit posix- oder Windows-Trenner; als String, damit ESLint keine Regex-Escapes prueft. */
const vendorPath = (names: string): RegExp => new RegExp(`node_modules${moduleSep}(?:${names})${moduleSep}`);
const VENDOR_REACT = vendorPath('react|react-dom|scheduler');

export default defineConfig({
  plugins: [react()],
  server: {
    // Standard: nur loopback. 0.0.0.0 nur bewusst per RBD_DEV_HOST (z. B. Cloud-Preview);
    // `vite preview` erbt diesen Wert, weil kein eigener preview.host gesetzt ist.
    host: process.env.RBD_DEV_HOST || 'localhost',
    port: 3000,
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
          ],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    ...(quickProfile ? { exclude: [...configDefaults.exclude, ...quickExclude] } : {}),
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
