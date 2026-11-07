/** React-Bruecke zum Wuerfeltisch; die Augen kommen aus dem Kern. */
import { Application } from 'pixi.js';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { DiceCanvas } from './dice-canvas';

export interface DiceStageHandle {
  roll: (dice: readonly [number, number], won: boolean, onDone: () => void) => void;
}

export const DiceStage = forwardRef<DiceStageHandle, { readonly label: string }>(function DiceStage({ label }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const table = useRef<DiceCanvas | null>(null);

  useImperativeHandle(ref, () => ({
    roll: (dice, won, onDone) => table.current?.roll(dice, won, onDone),
  }), []);

  useEffect(() => {
    let cancelled = false;
    const element = host.current;
    if (!element) return;
    const probe = document.createElement('canvas');
    if (!probe.getContext('webgl2') && !probe.getContext('webgl')) return;
    const app = new Application();
    void app.init({ resizeTo: element, antialias: true, backgroundAlpha: 0, resolution: Math.min(2, window.devicePixelRatio || 1), autoDensity: true })
      .then(() => {
        if (cancelled || !host.current) return;
        host.current.appendChild(app.canvas);
        table.current = new DiceCanvas(app);
        table.current.layout();
      })
      .catch(() => { table.current = null; });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
      if (!app.renderer || !host.current) return;
      app.renderer.resize(host.current.clientWidth, host.current.clientHeight);
      table.current?.layout();
    });
    observer?.observe(element);
    return () => {
      cancelled = true;
      observer?.disconnect();
      table.current?.destroy();
      table.current = null;
      if (app.renderer) app.destroy(true);
    };
  }, []);

  return <div className="dice-stage-live" ref={host} role="img" aria-label={label} />;
});
