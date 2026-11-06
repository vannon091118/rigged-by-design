/** React-Bruecke zur Pixi-Buehne; haelt keinen Spielzustand. */
import { Application } from 'pixi.js';
import type { EditorCursor } from './editor-overlay';
import { useEffect, useImperativeHandle, useRef, forwardRef } from 'react';
import type { GameView } from '../store/types';
import type { MenuAction } from './floor-actions';
import { FloorView } from './floor-view';
import { PerfGovernor, PERF_TIERS, type PerfTier } from './perf-governor';

export interface FloorHandle {
  fit: () => void;
  zoom: (factor: number) => void;
  cellAt: (clientX: number, clientY: number) => { x: number; y: number } | null;
  setEditor: (cursor: EditorCursor | null) => void;
}

interface Props {
  readonly view: GameView;
  readonly placing: string | null;
  readonly onGuest: (id: number) => void;
  readonly onFurniture: (id: number) => void;
  readonly onEmpty: (x: number, y: number) => void;
  readonly onInteract: (actionId: string, targetId?: number) => void;
  readonly onActions: (actions: MenuAction[]) => void;
  readonly onFirstFrame?: () => void;
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
    zoom: (factor: number) => floor.current?.zoom(factor),
    cellAt: (clientX: number, clientY: number) => floor.current?.cellAt(clientX, clientY) ?? null,
    setEditor: (cursor: EditorCursor | null) => floor.current?.setEditorCursor(cursor),
  }), []);

  useEffect(() => {
    let cancelled = false;
    let govern: (() => void) | null = null;
    const element = host.current;
    if (!element) return;
    const instance = new Application();
    app.current = instance;
    void instance.init({
      resizeTo: element,
      antialias: true,
      background: 0x07040f,
      resolution: Math.min(PERF_TIERS.high.dpr, window.devicePixelRatio || 1),
      autoDensity: true,
    }).then(() => {
      if (cancelled || !host.current) return;
      host.current.appendChild(instance.canvas);
      if (import.meta.env.DEV) (window as Window & { __pixiApp?: Application }).__pixiApp = instance;
      floor.current = new FloorView(instance, latest.current.view, {
        onGuest: (id) => latest.current.onGuest(id),
        onFurniture: (id) => latest.current.onFurniture(id),
        onEmpty: (x, y) => latest.current.onEmpty(x, y),
        onActions: (actions) => latest.current.onActions(actions),
      });
      const governor = new PerfGovernor();
      let tier: PerfTier = 'high';
      const applyTier = (next: PerfTier): void => {
        const budget = PERF_TIERS[next];
        instance.ticker.maxFPS = budget.fps;
        instance.renderer.resize(Math.max(1, element.clientWidth), Math.max(1, element.clientHeight),
          Math.min(budget.dpr, window.devicePixelRatio || 1));
        floor.current?.setBudget(budget.particles, budget.lights);
      };
      applyTier('high');
      govern = () => {
        const next = governor.update(instance.ticker.deltaMS);
        if (next === tier) return;
        tier = next;
        applyTier(next);
      };
      instance.ticker.add(govern);
      floor.current.setPlacing(latest.current.placing);
      floor.current.setRunning(!latest.current.paused);
      // Der Loader wartet auf diesen einen echten Renderer-Frame, nicht auf eine Uhr.
      instance.renderer.render(instance.stage);
      latest.current.onFirstFrame?.();
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
      if (govern) instance.ticker.remove(govern);
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
