/** React-Bruecke zur Pixi-Buehne; haelt keinen Spielzustand. */
import { Application } from 'pixi.js';
import { useEffect, useImperativeHandle, useRef, forwardRef } from 'react';
import type { GameView } from '../store/types';
import { FloorView } from './floor-view';
import { CharacterView } from './character-view';

export interface FloorHandle {
  fit: () => void;
  zoom: (factor: number) => void;
  cellAt: (clientX: number, clientY: number) => { x: number; y: number } | null;
  openMenu: (actions: { id: string; label: string; enabled: boolean }[], x: number, y: number) => void;
  closeMenu: () => void;
}

interface Props {
  readonly view: GameView;
  readonly placing: string | null;
  readonly onGuest: (id: number) => void;
  readonly onFurniture: (id: number) => void;
  readonly onEmpty: (x: number, y: number) => void;
  readonly onInteract: (actionId: string, targetId?: number) => void;
  readonly paused?: boolean;
}

export const FloorStage = forwardRef<FloorHandle, Props>(function FloorStage(props, ref) {
  const host = useRef<HTMLDivElement>(null);
  const app = useRef<Application | null>(null);
  const floor = useRef<FloorView | null>(null);
  const character = useRef<CharacterView | null>(null);
  const latest = useRef(props);

  latest.current = props;

  useImperativeHandle(ref, () => ({
    fit: () => floor.current?.fit(),
    zoom: (factor: number) => floor.current?.zoom(factor),
    cellAt: (clientX: number, clientY: number) => floor.current?.cellAt(clientX, clientY) ?? null,
    openMenu: (actions, x, y) => character.current?.openMenu(actions, x, y),
    closeMenu: () => character.current?.closeMenu(),
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
      character.current = new CharacterView(instance.canvas, {
        onInteract: (actionId, targetId) => latest.current.onInteract(actionId, targetId),
        onMoveTo: (clientX, clientY) => {
          const cell = floor.current?.cellAt(clientX, clientY);
          if (cell) latest.current.onEmpty(cell.x, cell.y);
        },
      });
      instance.stage.addChild(character.current.root);
      floor.current = new FloorView(instance, latest.current.view, {
        onGuest: (id) => latest.current.onGuest(id),
        onFurniture: (id) => latest.current.onFurniture(id),
        onEmpty: (x, y) => latest.current.onEmpty(x, y),
        onOpenMenu: (actions, x, y) => character.current?.openMenu(actions, x, y),
        onCloseMenu: () => character.current?.closeMenu(),
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
