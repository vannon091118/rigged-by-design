import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { GovernanceReporter } from './src/core/governance/test-harness';

// Messung 31.10.2026: RTP-, Balance- und Soak-Nachweise kosten 52,2 s von 72,5 s CPU-Zeit
// der ganzen Suite und damit 15 s der 33,6 s Gate-Wandzeit. Das schnelle Profil laesst sie
// weg und ist damit Entwicklungsfeedback, kein Freigabenachweis: `verify:all` und
// `verify:release` fahren sie immer mit.
const quickProfile = process.env.RBD_TEST_PROFILE === 'quick';
const quickExclude = ['**/round-rtp-*.test.ts', '**/soak.test.ts', '**/slot-session-rtp.test.ts'];

export default defineConfig({
  plugins: [react()],
  server: {
    // Standard: nur loopback. 0.0.0.0 nur bewusst per RBD_DEV_HOST (z. B. Cloud-Preview);
    // `vite preview` erbt diesen Wert, weil kein eigener preview.host gesetzt ist.
    host: process.env.RBD_DEV_HOST || 'localhost',
    port: 3000,
    // Ausschliesslich der Workspace wird bedient: die Positivliste steht im Code,
    // statt sich auf den Vite-Default (Workspace-Erkennung) zu verlassen.
    fs: { allow: ['.'] },
  },
  build: {
    // Audit 31.10.: Hauptchunk 856 kB (274 kB gzip), Hauptanteil pixi.js. Pixi in einen
    // eigenen, herabgestuften Ladeblock: Updates laden ihn aus dem Cache statt neu.
    // Die Warnschwelle gilt danach fuer den App-Rest und bleibt unter 300 kB sichtbar.
    chunkSizeWarningLimit: 300,
    rollupOptions: { output: { manualChunks: { pixi: ['pixi.js'] } } },
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
