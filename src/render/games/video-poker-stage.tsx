/** React-Bruecke zum Video-Poker-Schirm; Klicks auf Karten kommen als Index zurueck. */
import { Application } from 'pixi.js';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { Card } from '../../core/rng/shoe';
import type { VideoPokerHand } from '../../core/games/engines/interactive-cards';
import { VideoPokerCanvas } from './video-poker-canvas';

export interface VideoPokerStageHandle {
  render: (hand: readonly Card[], holds: readonly boolean[], highlight: VideoPokerHand | null, onDone?: () => void) => void;
}

interface Props {
  readonly label: string;
  readonly onCard: (index: number) => void;
}

export const VideoPokerStage = forwardRef<VideoPokerStageHandle, Props>(function VideoPokerStage({ label, onCard }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const machine = useRef<VideoPokerCanvas | null>(null);
  const cardClick = useRef(onCard);
  cardClick.current = onCard;

  useImperativeHandle(ref, () => ({
    render: (hand, holds, highlight, onDone) => machine.current?.render(hand, holds, highlight, onDone),
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
        const canvas = new VideoPokerCanvas(app);
        canvas.onCard = (index) => cardClick.current(index);
        machine.current = canvas;
      })
      .catch(() => { machine.current = null; });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
      if (!app.renderer || !host.current) return;
      app.renderer.resize(host.current.clientWidth, host.current.clientHeight);
      machine.current?.layout();
    });
    observer?.observe(element);
    return () => {
      cancelled = true;
      observer?.disconnect();
      machine.current?.destroy();
      machine.current = null;
      if (app.renderer) app.destroy(true);
    };
  }, []);

  return <div className="card-stage-live" ref={host} role="img" aria-label={label} />;
});
