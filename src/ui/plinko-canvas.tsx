/** Canvas zeigt das echte Brett und die aufgezeichneten Bahnen, nicht eine Wuerfelanimation. */
import { useEffect, useRef } from 'react';
import type { PegKind, PlinkoConfig, PlinkoDrop } from '../core/games/plinko-config';

const W = 380;
const H = 250;
const PAD = 16;
const PEG_COLORS: Record<PegKind, string> = {
  NORMAL_PEG: '#6f5b8c', BOUNCY_PEG: '#54e0ff', STICKY_PEG: '#ffd166',
  MAGNET_PEG: '#ff2e88', SPLIT_PEG: '#8ff0c6',
};
const TRACK_COLORS = ['#54e0ff', '#ff2e88', '#ffd166', '#8ff0c6', '#c79bff'];

function draw(ctx: CanvasRenderingContext2D, config: PlinkoConfig, rows: number, drop: PlinkoDrop | null, frame: number): void {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#05030a';
  ctx.fillRect(0, 0, W, H);
  const floorY = 120 + (rows - 8) * 11;
  const scaleX = (W - PAD * 2) / 100;
  const scaleY = (H - 38) / floorY;
  const sx = (x: number): number => PAD + x * scaleX;
  const sy = (y: number): number => 10 + y * scaleY;
  let edge = 0;
  config.pocketWidths.forEach((width, index) => {
    const left = sx(edge);
    edge += width;
    const right = sx(edge);
    ctx.fillStyle = index % 2 === 0 ? '#160d28' : '#1d1232';
    ctx.fillRect(left + 1, H - 28, Math.max(1, right - left - 2), 20);
    ctx.fillStyle = '#c8b6e4';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(String(index + 1), (left + right) / 2, H - 14);
  });
  const special = new Map(config.pegs.map((peg) => [`${peg.row}:${peg.column}`, peg.kind]));
  for (let row = 0; row < rows; row += 1) {
    const y = 26 + row * 11;
    const offset = row % 2 === 0 ? 0 : 5.5;
    for (let column = 0; column < 8; column += 1) {
      const x = 10 + offset + column * 11;
      const kind = special.get(`${row}:${column}`) ?? 'NORMAL_PEG';
      ctx.beginPath();
      ctx.arc(sx(x), sy(y), kind === 'NORMAL_PEG' ? 2 : 2.8, 0, Math.PI * 2);
      ctx.fillStyle = PEG_COLORS[kind];
      ctx.fill();
    }
  }
  if (!drop) {
    ctx.fillStyle = '#8b7aa5';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Noch kein Wurf — Testspin startet die Physik.', W / 2, 18);
    return;
  }
  const maxLength = Math.max(1, ...drop.tracks.map((track) => track.length));
  const visible = Math.min(frame, maxLength);
  drop.tracks.forEach((track, index) => {
    if (track.length < 2) return;
    const upto = Math.min(track.length, visible);
    ctx.beginPath();
    for (let point = 0; point < upto; point += 1) {
      const position = track[point]!;
      if (point === 0) ctx.moveTo(sx(position.x), sy(position.y));
      else ctx.lineTo(sx(position.x), sy(position.y));
    }
    ctx.strokeStyle = TRACK_COLORS[index % TRACK_COLORS.length]!;
    ctx.lineWidth = 2;
    ctx.stroke();
    const last = track[Math.max(0, upto - 1)]!;
    ctx.beginPath();
    ctx.arc(sx(last.x), sy(last.y), 3.2, 0, Math.PI * 2);
    ctx.fillStyle = TRACK_COLORS[index % TRACK_COLORS.length]!;
    ctx.fill();
  });
}

export function PlinkoCanvas({ config, rows, drop }: { config: PlinkoConfig; rows: number; drop: PlinkoDrop | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    let frame = 1;
    let animation = 0;
    const maxLength = drop ? Math.max(1, ...drop.tracks.map((track) => track.length)) : 1;
    const render = (): void => {
      draw(ctx, config, rows, drop, frame);
      if (frame < maxLength) {
        frame += 4;
        animation = window.requestAnimationFrame(render);
      }
    };
    if (typeof window.requestAnimationFrame === 'function') render();
    else draw(ctx, config, rows, drop, maxLength);
    return () => { if (typeof window.cancelAnimationFrame === 'function') window.cancelAnimationFrame(animation); };
  }, [config, drop, rows]);
  return <canvas ref={ref} className="plinko-canvas" width={W} height={H} role="img" aria-label="Plinko-Brett mit den letzten Ballbahnen" />;
}
