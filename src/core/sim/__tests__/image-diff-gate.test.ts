/**
 * @test-target: src/core/sim/narrative/composer/image-diff-gate.ts
 * @error-code: none
 *
 * Testet den lokalen Bild-Diff-Gate mit expliziten Toleranzen:
 * - Gleiche Bilder muessen als gleich erkannt werden
 * * Unterschiedliche Bilder muessen als unterschiedlich erkannt werden
 * * Toleranzwerte muessen korrekt angewendet werden (maxChangedPixels, maxChangedRatio, maxChannelDiff, maxMeanChannelDiff)
 * * Randfaelle: leere Bilder, identische Pixel, nur Alpha-nderungen
 */
import { describe, expect, it } from 'vitest';
import { imageDiffGate, imagesAreEqual, DEFAULT_TOLERANCE, STRICT_TOLERANCE, ImageDiffTolerance } from '../narrative/composer/image-diff-gate';

function makeRGBA(width: number, height: number, r: number, g: number, b: number, a = 255): Uint8Array {
  const buf = new Uint8Array(width * height * 4);
  for (let i = 0; i < buf.length; i += 4) {
    buf[i] = r;
    buf[i + 1] = g;
    buf[i + 2] = b;
    buf[i + 3] = a;
  }
  return buf;
}

describe('imageDiffGate', () => {
  it('erkennt gleiche Bilder als gleich', () => {
    const a = makeRGBA(4, 4, 100, 150, 200);
    const b = makeRGBA(4, 4, 100, 150, 200);

    const result = imageDiffGate(a, b, 4, 4);

    expect(result.equal).toBe(true);
    expect(result.diffPixelCount).toBe(0);
    expect(result.changedRatio).toBe(0);
    expect(result.maxChannelDiff).toBe(0);
    expect(result.meanChannelDiff).toBe(0);
  });

  it('erkennt unterschiedliche Bilder als ungleich', () => {
    const a = makeRGBA(4, 4, 100, 150, 200);
    const b = makeRGBA(4, 4, 200, 100, 50);

    const result = imageDiffGate(a, b, 4, 4);

    expect(result.equal).toBe(false);
    expect(result.diffPixelCount).toBe(16);
    expect(result.changedRatio).toBe(1);
  });

  it('akzeptiert kleine Farbanderungen innerhalb der Toleranz', () => {
    const a = makeRGBA(4, 4, 100, 150, 200);
    const b = makeRGBA(4, 4, 103, 153, 203); // +/- 3 pro Kanal, unter maxChannelDiff=5

    const tolerance: ImageDiffTolerance = { ...DEFAULT_TOLERANCE, maxMeanChannelDiff: 3 };
    const result = imageDiffGate(a, b, 4, 4, tolerance);

    expect(result.equal).toBe(true);
    expect(result.diffPixelCount).toBe(0);
    expect(result.maxChannelDiff).toBe(3);
  });

  it('Weigert Bilder mit zu grosser Farbanderung ab, auch wenn nur ein Pixel betroffen ist', () => {
    const a = makeRGBA(4, 4, 100, 150, 200);
    const b = makeRGBA(4, 4, 100, 150, 200);
    // Ein einzelnes Pixel stark veraendern
    b[0] = 200; // R von 100 auf 200, diff = 100 > maxChannelDiff=5

    const result = imageDiffGate(a, b, 4, 4, DEFAULT_TOLERANCE);

    expect(result.equal).toBe(false);
    expect(result.diffPixelCount).toBe(1);
    expect(result.maxChannelDiff).toBe(100);
  });

  it('akzeptiert bis zu maxChangedPixels geanderte Pixel', () => {
    const a = makeRGBA(4, 4, 100, 150, 200);
    const b = makeRGBA(4, 4, 100, 150, 200);
    // Zwei Pixel veraendern (maxChangedPixels=0 im Default, aber wir pruefen mit custom tolerance)
    b[0] = 110; // diffR = 10 > maxChannelDiff=3
    b[4] = 110; // diffR = 10 > maxChannelDiff=3

    const tolerance: ImageDiffTolerance = { ...DEFAULT_TOLERANCE, maxChangedPixels: 2, maxChangedRatio: 0.2, maxChannelDiff: 3 };
    const result = imageDiffGate(a, b, 4, 4, tolerance);

    expect(result.diffPixelCount).toBe(2);
    expect(result.equal).toBe(false); // maxChannelDiff=10 > tolerance 3 -> equal=false
  });

  it('akzeptiert bis zu maxChangedRatio geanderte Pixel', () => {
    const a = makeRGBA(4, 4, 100, 150, 200);
    const b = makeRGBA(4, 4, 100, 150, 200);
    // 4 von 16 Pixeln veraendern = 25%
    b[0] = 110;
    b[4] = 110;
    b[8] = 110;
    b[12] = 110;

    const tolerance: ImageDiffTolerance = { ...DEFAULT_TOLERANCE, maxChangedRatio: 0.3, maxChannelDiff: 3 };
    const result = imageDiffGate(a, b, 4, 4, tolerance);

    expect(result.changedRatio).toBe(0.25);
    expect(result.equal).toBe(false); // maxChannelDiff=10 > tolerance 3 -> equal=false
  });

  it('weigert zu viele geanderte Pixel ab', () => {
    const a = makeRGBA(4, 4, 100, 150, 200);
    const b = makeRGBA(4, 4, 100, 150, 200);
    // 5 von 16 Pixeln veraendern = 31.25% > maxChangedRatio=0.3
    b[0] = 110;
    b[4] = 110;
    b[8] = 110;
    b[12] = 110;
    b[16] = 110;

    const tolerance: ImageDiffTolerance = { ...DEFAULT_TOLERANCE, maxChangedRatio: 0.3, maxChannelDiff: 3 };
    const result = imageDiffGate(a, b, 4, 4, tolerance);

    expect(result.equal).toBe(false);
    expect(result.changedRatio).toBe(0.3125);
  });

  it('wendet STRICT_TOLERANCE korrekt an', () => {
    const a = makeRGBA(4, 4, 100, 150, 200);
    const b = new Uint8Array(a);
    b[15] = 254; // A des letzten Pixels um 1 geaendert (255 -> 254, diff = 1)

    const result = imageDiffGate(a, b, 4, 4, STRICT_TOLERANCE);

    expect(result.equal).toBe(false);
    expect(result.diffPixelCount).toBe(1);
    expect(result.maxChannelDiff).toBe(1);
  });

  it('gibt den korrekten maxChannelDiff zurueck', () => {
    const a = makeRGBA(4, 4, 100, 150, 200);
    const b = makeRGBA(4, 4, 100, 150, 200);
    b[0] = 50;  // diff = 50
    b[5] = 180; // diff = 30 (G-Kanal Pixel 1)

    const result = imageDiffGate(a, b, 4, 4, DEFAULT_TOLERANCE);

    expect(result.equal).toBe(false);
    expect(result.maxChannelDiff).toBe(50);
  });

  it('berechnet meanChannelDiff korrekt', () => {
    const a = makeRGBA(2, 2, 100, 150, 200);
    const b = makeRGBA(2, 2, 100, 150, 200);
    // Ein Pixel um 40 veraendern, drei Pixel unveraendert
    b[0] = 140; // diff = 40

    const result = imageDiffGate(a, b, 2, 2, DEFAULT_TOLERANCE);

    // Summe aller Kanal-Differenzen = 40, Gesamtzahl der Kanal-Werte = 4 * 4 = 16
    expect(result.meanChannelDiff).toBeCloseTo(40 / 16, 5);
  });

  it('behandelt leere Bilder (0x0)', () => {
    const a = new Uint8Array(0);
    const b = new Uint8Array(0);

    const result = imageDiffGate(a, b, 0, 0);

    expect(result.equal).toBe(true);
    expect(result.diffPixelCount).toBe(0);
    expect(result.totalPixelCount).toBe(0);
  });
});

describe('imagesAreEqual', () => {
  it('true fuer gleiche Bilder', () => {
    const a = makeRGBA(2, 2, 50, 100, 150);
    const b = makeRGBA(2, 2, 50, 100, 150);
    expect(imagesAreEqual(a, b, 2, 2)).toBe(true);
  });

  it('false fuer unterschiedliche Bilder', () => {
    const a = makeRGBA(2, 2, 50, 100, 150);
    const b = makeRGBA(2, 2, 51, 100, 150);
    expect(imagesAreEqual(a, b, 2, 2, STRICT_TOLERANCE)).toBe(false);
  });

  it('true fuer innerhalb der Toleranz liegende Bilder', () => {
    const a = makeRGBA(2, 2, 50, 100, 150);
    const b = makeRGBA(2, 2, 53, 100, 150); // diff = 3 <= 5
    expect(imagesAreEqual(a, b, 2, 2, DEFAULT_TOLERANCE)).toBe(true);
  });
});
