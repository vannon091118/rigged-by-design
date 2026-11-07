/**
 * Explizite Messung: feste Iterationszahl, ein Warmup, monotone Uhr.
 * Kein Schwellenwert und kein Gate; die Zahlen sind Indikatoren.
 */
export function measure(
  label: string,
  run: () => void,
  options: { iterations?: number; warmup?: number; note?: string } = {},
): { meanMs: number; minMs: number; maxMs: number } {
  const iterations = options.iterations ?? 10;
  const warmup = options.warmup ?? 1;
  if (!Number.isInteger(iterations) || iterations < 1) throw new Error('measure: iterations muss >= 1 sein');
  for (let index = 0; index < warmup; index += 1) run();
  const samples: number[] = [];
  for (let index = 0; index < iterations; index += 1) {
    const start = process.hrtime.bigint();
    run();
    samples.push(Number(process.hrtime.bigint() - start) / 1_000_000);
  }
  const meanMs = samples.reduce((sum, sample) => sum + sample, 0) / samples.length;
  const minMs = Math.min(...samples);
  const maxMs = Math.max(...samples);
  const note = options.note ? `  ${options.note}` : '';
  console.log(`${label.padEnd(26)} ${meanMs.toFixed(4)} ms/op${note} (${iterations} Läufe, min ${minMs.toFixed(4)}, max ${maxMs.toFixed(4)})`);
  return { meanMs, minMs, maxMs };
}
