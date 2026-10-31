/** React-Bruecke zur Pixi-Buehne; haelt keinen Spielzustand. */
import { Application } from 'pixi.js';
import { useEffect, useImperativeHandle, useRef, forwardRef } from 'react';
import type { GameView } from '../store/types';
import { FloorView } from './floor-view';

export interface FloorHandle {
  fit: () => void;
  cellAt: (clientX: number, clientY: number) => { x: number; y: number } | null;
}

interface Props {
  readonly view: GameView;
  readonly placing: string | null;
  readonly onGuest: (id: number) => void;
  readonly onFurniture: (id: number) => void;
  readonly onEmpty: (x: number, y: number) => void;
  readonly paused?: boolean;
}

export const FloorStage = forwardRef<FloorHandle, Props>(function FloorStage(props, ref) {
  const host = useRef<HTMLDivElement>(null);
  const app = useRef<Application | null>(null);
  const floor = useRef<FloorView | null>(null);
  const latest = useRef(props);

  latest.current = props;

  useImperativeHandle(ref, () => ({
    fit: () => floor.current?.fit(),
    cellAt: (clientX: number, clientY: number) => floor.current?.cellAt(clientX, clientY) ?? null,
  }), []);

  useEffect(() => {
    let cancelled = false;
    const element = host.current;
    if (!element) return;
    const instance = new Application();
    app.current = instance;
    void instance.init({
      resizeTo: element,
      antialias: true,
      background: 0x07040f,
      resolution: Math.min(2, window.devicePixelRatio || 1),
      autoDensity: true,
    }).then(() => {
      if (cancelled || !host.current) return;
      host.current.appendChild(instance.canvas);
      if (import.meta.env.DEV) (window as Window & { __pixiApp?: Application }).__pixiApp = instance;
      floor.current = new FloorView(instance, latest.current.view, {
        onGuest: (id) => latest.current.onGuest(id),
        onFurniture: (id) => latest.current.onFurniture(id),
        onEmpty: (x, y) => latest.current.onEmpty(x, y),
      });
      floor.current.setPlacing(latest.current.placing);
      floor.current.setRunning(!latest.current.paused);
    });

    const observer = new ResizeObserver(() => {
      if (!instance.renderer || !host.current) return;
      instance.renderer.resize(host.current.clientWidth, host.current.clientHeight);
      floor.current?.resize();
    });
    observer.observe(element);

    return () => {
      cancelled = true;
      observer.disconnect();
      floor.current?.destroy();
      floor.current = null;
      if (instance.renderer) instance.destroy(true);
      app.current = null;
    };
  }, []);

  useEffect(() => {
    floor.current?.update(props.view);
  }, [props.view]);

  useEffect(() => {
    floor.current?.setPlacing(props.placing);
  }, [props.placing]);

  useEffect(() => {
    floor.current?.setRunning(!props.paused);
  }, [props.paused]);

  return <div className="floor-stage" ref={host} aria-label="Casino-Floor" />;
});
