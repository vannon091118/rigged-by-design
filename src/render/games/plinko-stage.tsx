/** React-Bruecke zum Plinko-Brett; haelt nur die Buehne, nie das Ergebnis. */
import { Application } from 'pixi.js';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { PlinkoConfig, PlinkoDrop } from '../../core/games/plinko-config';
import { PlinkoCanvas } from './plinko-canvas';

export interface PlinkoStageHandle {
  play: (drop: PlinkoDrop, onDone: () => void) => void;
}

interface Props {
  readonly config: PlinkoConfig;
  readonly rows: number;
  readonly label: string;
}

export const PlinkoStage = forwardRef<PlinkoStageHandle, Props>(function PlinkoStage({ config, rows, label }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const board = useRef<PlinkoCanvas | null>(null);

  useImperativeHandle(ref, () => ({
    play: (drop, onDone) => board.current?.play(drop, onDone),
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
        board.current = new PlinkoCanvas(app);
        board.current.build(config, rows);
      })
      .catch(() => { board.current = null; });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
      if (!app.renderer || !host.current) return;
      app.renderer.resize(host.current.clientWidth, host.current.clientHeight);
      board.current?.layout();
    });
    observer?.observe(element);
    return () => {
      cancelled = true;
      observer?.disconnect();
      board.current?.destroy();
      board.current = null;
      if (app.renderer) app.destroy(true);
    };
    // Das Brett wird nur einmal gebaut; Konfigurationswechsel laufen ueber build().
  }, []);

  useEffect(() => { board.current?.build(config, rows); }, [config, rows]);

  return <div className="plinko-stage-live" ref={host} role="img" aria-label={label} />;
});
