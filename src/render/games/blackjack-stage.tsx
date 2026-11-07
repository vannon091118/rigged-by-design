/** React-Bruecke zum Blackjack-Tisch; die Runde kommt aus dem Kern, hier nur die Karten. */
import { Application } from 'pixi.js';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { BlackjackRound } from '../../core/games/engines/interactive-cards';
import { BlackjackCanvas } from './blackjack-canvas';

export interface BlackjackStageHandle {
  render: (round: BlackjackRound, onDone?: () => void) => void;
  reset: () => void;
}

export const BlackjackStage = forwardRef<BlackjackStageHandle, { readonly label: string }>(
  function BlackjackStage({ label }, ref) {
    const host = useRef<HTMLDivElement>(null);
    const table = useRef<BlackjackCanvas | null>(null);

    useImperativeHandle(ref, () => ({
      render: (round, onDone) => table.current?.render(round, onDone),
      reset: () => table.current?.reset(),
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
          table.current = new BlackjackCanvas(app);
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
  },
);
