/** Abbruchpfad der Pipeline: Signale beenden alle Gates und hinterlassen keine Waisen. */
import { abortGates } from './gate-runner.mjs';
import { releaseOwner } from './process-sweep.mjs';

export const EXIT_ABORTED = 130;

/** Stop-Funktion ohne Signal-Verdrahtung, damit sie testbar bleibt. */
export function createStop({ exit = process.exit, log = console.error } = {}) {
  return (signal) => {
    abortGates();
    releaseOwner();
    log(`verify:all: ${signal} empfangen, laufende Gates beendet`);
    exit(EXIT_ABORTED);
  };
}

export function installStopHandlers(options) {
  const stop = createStop(options);
  process.once('SIGINT', () => stop('SIGINT'));
  process.once('SIGTERM', () => stop('SIGTERM'));
  return stop;
}
