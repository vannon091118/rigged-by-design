/** React-Bruecke zum Kessel; haelt nur die Animation, nie das Ergebnis. */
import { Application } from 'pixi.js';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { RouletteCanvas } from './roulette-canvas';

export interface RouletteStageHandle {
  spin: (number: number, onDone: () => void, won?: boolean) => void;
}

export const RouletteStage = forwardRef<RouletteStageHandle, { readonly label: string }>(
  function RouletteStage({ label }, ref) {
    const host = useRef<HTMLDivElement>(null);
    const wheel = useRef<RouletteCanvas | null>(null);

    useImperativeHandle(ref, () => ({
      spin: (number, onDone, won = false) => wheel.current?.spin(number, onDone, won),
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
          wheel.current = new RouletteCanvas(app);
        })
        .catch(() => { wheel.current = null; });
      const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
        if (!app.renderer || !host.current) return;
        app.renderer.resize(host.current.clientWidth, host.current.clientHeight);
        wheel.current?.layout();
      });
      observer?.observe(element);
      return () => {
        cancelled = true;
        observer?.disconnect();
        wheel.current?.destroy();
        wheel.current = null;
        if (app.renderer) app.destroy(true);
      };
    }, []);

    return <div className="roulette-stage-live" ref={host} role="img" aria-label={label} />;
  },
);
