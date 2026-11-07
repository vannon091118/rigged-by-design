import { randomInt } from 'node:crypto';

/**
 * Frischer Seed pro Aufruf. Bewusst ohne Env-, CLI- oder Datei-Override:
 * ein Testlauf darf nicht auf einen vorab bekannten Zufallspfad einrasten.
 */
export function randomSeed(): number {
  return randomInt(0, 0x1_0000_0000);
}
