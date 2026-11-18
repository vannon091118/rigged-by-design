/** @test-target: src/render/floor-camera.ts | @error-code: ERR-3001
 *
 *  Die echte Detail-Auswahl muss an der Schwelle ruhig bleiben: unterhalb des
 *  Bands fern, oberhalb Detail, im Band haelt jede Stufe, an beiden Kanten
 *  kippt nichts. Geprueft wird `nextDetail` — dieselbe Funktion, die
 *  `FloorCamera.detail` pro Frame aufruft — und der echte Kameraweg aus
 *  `resize`, `zoomStep` und `step`.
 */
import { describe, expect, it } from 'vitest';
import { FloorCamera, nextDetail } from '../floor-camera';

/** Dieselbe Buehne wie im Live-Beleg; der Fit kommt aus `resize`. */
const SCREEN = { width: 398, height: 344 };
const WORLD = 30;

function camera(): FloorCamera {
  const cam = new FloorCamera();
  cam.resize(SCREEN.width, SCREEN.height, WORLD, true);
  return cam;
}

interface Edge {
  /** Kleinster Zoom, ab dem die jeweilige Ausgangsstufe kippt. */
  readonly at: number;
  /** Letzter Zoom davor; dort haelt die Ausgangsstufe noch. */
  readonly before: number;
}

/** Kante, ab der die fern gestartete Auswahl auf Detail kippt. */
function enterEdge(fit: number): Edge {
  let before = fit;
  let at = fit * 2;
  expect(nextDetail(false, before, fit)).toBe(false);
  expect(nextDetail(false, at, fit)).toBe(true);
  for (let i = 0; i < 80; i += 1) {
    const mid = (before + at) / 2;
    if (nextDetail(false, mid, fit)) at = mid;
    else before = mid;
  }
  return { at, before };
}

/** Kante, ab der die detailgestartete Auswahl wieder fern wird. */
function exitEdge(fit: number): Edge {
  let before = fit;
  let at = fit * 2;
  expect(nextDetail(true, before, fit)).toBe(false);
  expect(nextDetail(true, at, fit)).toBe(true);
  for (let i = 0; i < 80; i += 1) {
    const mid = (before + at) / 2;
    if (nextDetail(true, mid, fit)) at = mid;
    else before = mid;
  }
  return { at, before };
}

interface Sample {
  readonly zoom: number;
  readonly detail: boolean;
}

/** Ein Frame wie im Rig: erst `step()`, dann `detail` lesen. */
function frames(cam: FloorCamera, max = 800): Sample[] {
  const out: Sample[] = [];
  for (let i = 0; i < max; i += 1) {
    const moving = cam.step();
    out.push({ zoom: cam.zoom, detail: cam.detail });
    if (!moving) break;
  }
  return out;
}

function flips(samples: Sample[]): number {
  let count = 0;
  for (let i = 1; i < samples.length; i += 1) {
    const before = samples[i - 1];
    const now = samples[i];
    if (before && now && now.detail !== before.detail) count += 1;
  }
  return count;
}

describe('FloorCamera: Detail-Hysterese an der Schwelle', () => {
  it('entdeckt ein echtes Band, dessen Kanten nicht zusammenfallen', () => {
    const fit = camera().fit;
    const enter = enterEdge(fit);
    const exit = exitEdge(fit);

    // enter und exit sind nicht vertauscht, und das Band ist breiter als eine
    // einzelne Schwelle (die haette hier Breite ~0).
    expect(exit.at).toBeLessThan(enter.at);
    expect((enter.at - exit.at) / fit).toBeGreaterThan(0.05);
    expect(enter.at / fit).toBeLessThan(1.6);
    expect(exit.at / fit).toBeGreaterThan(1);
  });

  it('haelt im Band jede Stufe und kippt an keiner Kante', () => {
    const fit = camera().fit;
    const enter = enterEdge(fit);
    const exit = exitEdge(fit);

    // Im offenen Band bleibt jede Ausgangsstufe stehen: kein Flip-Flop,
    // egal ob von fern oder von Detail kommend.
    for (let i = 1; i < 100; i += 1) {
      const zoom = exit.at + ((enter.at - exit.at) * i) / 100;
      expect(nextDetail(false, zoom, fit)).toBe(false);
      expect(nextDetail(true, zoom, fit)).toBe(true);
    }

    // Genau an den Kanten gelesen (wiederholt, wie in aufeinanderfolgenden
    // Frames): oben kippt nur fern -> Detail, unten nur Detail -> fern.
    for (let i = 0; i < 25; i += 1) {
      expect(nextDetail(false, enter.at, fit)).toBe(true);
      expect(nextDetail(true, enter.at, fit)).toBe(true);
      expect(nextDetail(false, enter.before, fit)).toBe(false);
      expect(nextDetail(true, exit.at, fit)).toBe(true);
      expect(nextDetail(false, exit.at, fit)).toBe(false);
      expect(nextDetail(true, exit.before, fit)).toBe(false);
    }
  });

  it('faehrt den echten Kameraweg ohne Flackern', () => {
    const cam = camera();
    const fit = cam.fit;
    const enter = enterEdge(fit).at;
    const exit = exitEdge(fit).at;
    const center = (enter + exit) / 2;

    // Start unterhalb des Bands: fern, auch ueber viele Frames.
    const below = frames(cam);
    expect(below.length).toBeGreaterThan(0);
    expect(below.every((sample) => !sample.detail)).toBe(true);
    expect(below.at(-1)?.zoom).toBeCloseTo(fit, 6);

    // Ueber die Eintrittsschwelle: genau ein Wechsel, erst oberhalb von enter.
    cam.zoomStep((enter + (enter - exit) / 2) / cam.zoom);
    const up = frames(cam);
    expect(flips(up)).toBe(1);
    const switchedOn = up.find((sample) => sample.detail);
    expect(switchedOn).toBeDefined();
    expect(switchedOn?.zoom).toBeGreaterThan(enter);
    expect(up.at(-1)?.detail).toBe(true);

    // Wackeln im Band: Ziel bleibt zwischen exit und enter, die Stufe haelt.
    cam.zoomStep(center / cam.zoom);
    frames(cam); // erst ins Band einschwingen, die Anfahrt zaehlt nicht zum Wackeln
    let wiggle: Sample[] = [];
    for (let i = 0; i < 10; i += 1) {
      cam.zoomStep(i % 2 === 0 ? 1.01 : 1 / 1.01);
      wiggle = wiggle.concat(frames(cam));
    }
    expect(wiggle.every((sample) => sample.detail)).toBe(true);
    expect(wiggle.every((sample) => sample.zoom > exit && sample.zoom < enter)).toBe(true);
    expect(flips(wiggle)).toBe(0);

    // Unter die Austrittsschwelle: genau ein Wechsel zurueck, erst unter exit.
    cam.zoomStep((exit * 0.97) / cam.zoom);
    const down = frames(cam);
    expect(flips(down)).toBe(1);
    const switchedOff = down.find((sample) => !sample.detail);
    expect(switchedOff).toBeDefined();
    expect(switchedOff?.zoom).toBeLessThan(exit);
    expect(down.at(-1)?.detail).toBe(false);

    // Und dort bleibt es fern.
    const hover = frames(cam);
    expect(hover.every((sample) => !sample.detail)).toBe(true);
  });
});
