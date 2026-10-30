/** React-Bruecke zur Walzenbuehne; haelt keinen Spielzustand, nur die Animation. */
import { Application } from 'pixi.js';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { GameResult } from '../../core/games/contracts';
import type { RiskColor } from '../../core/games/risk-card';
import { SlotCanvas } from './slot-canvas';

export interface SlotStageHandle {
  spin: (result: GameResult, onDone: () => void) => void;
  gamble: (card: RiskColor, won: boolean) => void;
}

export const SlotStage = forwardRef<SlotStageHandle, { readonly label: string }>(function SlotStage({ label }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const stage = useRef<SlotCanvas | null>(null);

  useImperativeHandle(ref, () => ({
    spin: (result, onDone) => stage.current?.spin(result, onDone),
    gamble: (card, won) => stage.current?.gamble(card, won),
  }), []);

  useEffect(() => {
    let cancelled = false;
    const element = host.current;
    if (!element) return;
    // Ohne WebGL (jsdom, alte Rechner) bleibt die Buehne leer statt das Fenster zu sprengen.
    const probe = document.createElement('canvas');
    if (!probe.getContext('webgl2') && !probe.getContext('webgl')) return;
    const app = new Application();
    void app.init({ resizeTo: element, antialias: true, backgroundAlpha: 0, resolution: Math.min(2, window.devicePixelRatio || 1), autoDensity: true })
      .then(() => {
        if (cancelled || !host.current) return;
        host.current.appendChild(app.canvas);
        stage.current = new SlotCanvas(app);
        stage.current.layout();
      })
      .catch(() => { stage.current = null; });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
      if (!app.renderer || !host.current) return;
      app.renderer.resize(host.current.clientWidth, host.current.clientHeight);
      stage.current?.layout();
    });
    observer?.observe(element);
    return () => {
      cancelled = true;
      observer?.disconnect();
      stage.current?.destroy();
      stage.current = null;
      if (app.renderer) app.destroy(true);
    };
  }, []);

  return <div className="slot-stage-live" ref={host} role="img" aria-label={label} />;
});
