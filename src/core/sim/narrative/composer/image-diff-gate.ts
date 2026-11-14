/**
 * @module image-diff-gate — Lokales Bild-Diff-Gate mit expliziten Toleranzen
 *
 * Vergleicht zwei RGBA-Bildpuffer pixelgenau und meldet ob der Unterschied
 * innerhalb einer tolerablen Schwelle liegt. Keine externen Abhaengigkeiten,
 * keine Netzwerkzugriffe, deterministisch.
 */

export interface ImageDiffResult {
  readonly equal: boolean;           // true wenn innerhalb der Toleranz
  readonly diffPixelCount: number;   // Anzahl geaenderter Pixel
  readonly totalPixelCount: number;  // Gesamtanzahl verglichener Pixel
  readonly changedRatio: number;     // diffPixelCount / totalPixelCount (0..1)
  readonly maxChannelDiff: number;   // Maximale Kanal-Differenz (0..255)
  readonly meanChannelDiff: number;  // Mittlere Kanal-Differenz ueber alle Pixel
  readonly tolerance: ImageDiffTolerance; // Verwendete Toleranzwerte
}

/**
 * Toleranzwerte fuer den Bild-Diff-Vergleich.
 */
export interface ImageDiffTolerance {
  /** Maximale erlaubt abweichende Pixel (0 = exakt gleich) */
  readonly maxChangedPixels: number;
  /** Maximal erlaubter Anteil geaenderter Pixel (0.0 = exakt gleich, 1.0 = alles darf sich aendern) */
  readonly maxChangedRatio: number;
  /** Maximale Farbkanal-Differenz pro Pixel (0..255) */
  readonly maxChannelDiff: number;
  /** Maximale mittlere Kanal-Differenz ueber alle Pixel (0..255) */
  readonly maxMeanChannelDiff: number;
}

/** Standard-Toleranz: kleine Farbschwankungen tolerieren, aber keine echten Aenderungen. */
export const DEFAULT_TOLERANCE: ImageDiffTolerance = {
  maxChangedPixels: 0,
  maxChangedRatio: 0,
  maxChannelDiff: 5,
  maxMeanChannelDiff: 1,
};

/** Strenge Toleranz: exakt gleiche Bilder erwartet. */
export const STRICT_TOLERANCE: ImageDiffTolerance = {
  maxChangedPixels: 0,
  maxChangedRatio: 0,
  maxChannelDiff: 0,
  maxMeanChannelDiff: 0,
};

/**
 * Vergleicht zwei RGBA-Bildpuffer pixelgenau.
 *
 * Beide Buffer muessen dieselben Dimensionen (width x height) haben und
 * im RGBA-Format vorliegen (4 Byte pro Pixel: R, G, B, A).
 *
 * @param a Erstes Bild (RGBA-Flacharray)
 * @param b Zweites Bild (RGBA-Flacharray)
 * @param width Bildbreite in Pixeln
 * @param height Bildhoehe in Pixeln
 * @param tolerance Toleranzwerte (Default: DEFAULT_TOLERANCE)
 * @return Ergebnis mit Diff-Statistik und ob die Toleranz eingehalten wurde
 */
export function imageDiffGate(
  a: Uint8Array,
  b: Uint8Array,
  width: number,
  height: number,
  tolerance: ImageDiffTolerance = DEFAULT_TOLERANCE,
): ImageDiffResult {
  const totalPixels = width * height;
  const expectedLength = width * height * 4;

  if (a.length !== expectedLength || b.length !== expectedLength) {
    return {
      equal: false,
      diffPixelCount: totalPixels,
      totalPixelCount: totalPixels,
      changedRatio: 1,
      maxChannelDiff: 255,
      meanChannelDiff: 255,
      tolerance,
    };
  }

  let diffPixelCount = 0;
  let maxChannelDiff = 0;
  let channelDiffSum = 0;

  for (let i = 0; i < expectedLength; i += 4) {
    const diffR = Math.abs(a[i] - b[i]);
    const diffG = Math.abs(a[i + 1] - b[i + 1]);
    const diffB = Math.abs(a[i + 2] - b[i + 2]);
    const diffA = Math.abs(a[i + 3] - b[i + 3]);

    const pixelDiff = Math.max(diffR, diffG, diffB, diffA);
    channelDiffSum += diffR + diffG + diffB + diffA;

    if (diffR > tolerance.maxChannelDiff ||
        diffG > tolerance.maxChannelDiff ||
        diffB > tolerance.maxChannelDiff ||
        diffA > tolerance.maxChannelDiff) {
      diffPixelCount += 1;
    }

    if (diffR > maxChannelDiff) maxChannelDiff = diffR;
    if (diffG > maxChannelDiff) maxChannelDiff = diffG;
    if (diffB > maxChannelDiff) maxChannelDiff = diffB;
    if (diffA > maxChannelDiff) maxChannelDiff = diffA;
  }

  const changedRatio = totalPixels > 0 ? diffPixelCount / totalPixels : 0;
  const meanChannelDiff = totalPixels > 0 ? channelDiffSum / (totalPixels * 4) : 0;

  const equal =
    diffPixelCount <= tolerance.maxChangedPixels &&
    changedRatio <= tolerance.maxChangedRatio &&
    maxChannelDiff <= tolerance.maxChannelDiff &&
    meanChannelDiff <= tolerance.maxMeanChannelDiff;

  return {
    equal,
    diffPixelCount,
    totalPixelCount: totalPixels,
    changedRatio,
    maxChannelDiff,
    meanChannelDiff,
    tolerance,
  };
}

/**
 * Prueft ob zwei Bilder "gleich genug" sind, um als identisch behandelt zu werden.
 * Wrapper um imageDiffGate mit booleschem Rueckgabewert.
 */
export function imagesAreEqual(
  a: Uint8Array,
  b: Uint8Array,
  width: number,
  height: number,
  tolerance: ImageDiffTolerance = DEFAULT_TOLERANCE,
): boolean {
  return imageDiffGate(a, b, width, height, tolerance).equal;
}
