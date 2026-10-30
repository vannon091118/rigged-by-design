/** React-Bruecke zum Huetchentisch; die Wahl des Spielers kommt als Klick zurueck. */
import { Application } from 'pixi.js';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { ShellMove } from '../../core/games/shell-round';
import { ShellCanvas } from './shell-canvas';

export interface ShellStageHandle {
  begin: (ballCup: number, moves: readonly ShellMove[], onReady: () => void) => void;
  reveal: (slot: number, onDone: () => void) => void;
}

interface Props {
  readonly label: string;
  readonly onPick: (slot: number) => void;
}

export const ShellStage = forwardRef<ShellStageHandle, Props>(function ShellStage({ label, onPick }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const table = useRef<ShellCanvas | null>(null);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;

  useImperativeHandle(ref, () => ({
    begin: (ballCup, moves, onReady) => table.current?.begin(ballCup, moves, onReady),
    reveal: (slot, onDone) => table.current?.reveal(slot, onDone),
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
        const canvas = new ShellCanvas(app);
        canvas.onPick = (slot) => pickRef.current(slot);
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

  return <div className="shell-stage-live" ref={host} role="img" aria-label={label} />;
});
