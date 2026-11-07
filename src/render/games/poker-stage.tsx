/** React-Bruecke zum Poker-Tisch; zeigt den Zustand der Runde in Pixi. */
import { Application } from 'pixi.js';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { PokerTable } from '../../core/games/poker-types';
import { PokerCanvas } from './poker-canvas';

export interface PokerStageHandle {
  render: (table: PokerTable | null) => void;
}

interface Props {
  readonly label: string;
}

export const PokerStage = forwardRef<PokerStageHandle, Props>(function PokerStage({ label }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const table = useRef<PokerCanvas | null>(null);
  const pending = useRef<PokerTable | null>(null);

  useImperativeHandle(ref, () => ({
    render: (next) => {
      pending.current = next;
      table.current?.render(next);
    },
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
        const canvas = new PokerCanvas(app);
        canvas.render(pending.current);
        table.current = canvas;
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

  return <div className="card-stage-live" ref={host} role="img" aria-label={label} />;
});
