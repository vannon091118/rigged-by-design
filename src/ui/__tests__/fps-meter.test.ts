/**
 * @test-target: src/ui/fps-meter.ts
 * @error-code: ERR-3001
 *
 * Die Bildrate folgt den echten Frame-Zeitpunkten: bekannte Folgen ergeben
 * bekannte Werte, ein Tab-Wechsel erzeugt keinen kuenstlichen Einbruch.
 */
import { describe, expect, it } from 'vitest';
import { createFrameMeter } from '../fps-meter';

function feed(meter: ReturnType<typeof createFrameMeter>, start: number, stepMs: number, count: number): number[] {
  const readings: number[] = [];
  for (let frame = 0; frame < count; frame += 1) {
    const reading = meter(start + frame * stepMs);
    if (reading !== null) readings.push(reading);
  }
  return readings;
}

describe('FPS-Meter', () => {
  it('misst 60 FPS aus 16,67-ms-Frames', () => {
    const meter = createFrameMeter();
    const readings = feed(meter, 1_000, 1000 / 60, 61);
    expect(readings[0]).toBe(60);
  });

  it('misst 100 FPS aus 10-ms-Frames', () => {
    const meter = createFrameMeter();
    const readings = feed(meter, 5_000, 10, 101);
    expect(readings[0]).toBe(100);
  });

  it('liefert vor dem ersten vollen Fenster keinen Wert', () => {
    const meter = createFrameMeter();
    expect(meter(0)).toBeNull();
    expect(meter(16)).toBeNull();
    expect(meter(32)).toBeNull();
  });

  it('verwirft die Pause eines Tab-Wechsels statt einen Einbruch zu melden', () => {
    const meter = createFrameMeter();
    feed(meter, 0, 1000 / 60, 31);

    // 5 s Pause: der naechste Frame beginnt ein neues Fenster ohne Messwert.
    expect(meter(5_000)).toBeNull();
    const resumed = feed(meter, 5_000 + 1000 / 60, 1000 / 60, 31);
    expect(resumed[0]).toBe(60);
    expect(resumed.every((fps) => fps >= 55)).toBe(true);
  });
});
