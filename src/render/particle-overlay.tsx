/** Partikel-Overlay: hoert auf Spielereignisse und zeichnet visuelle Effekte ueber dem Floor.
 * Reine Darstellung: keine Spielmechanik, kein Zufall ausser dem Render-RNG.
 */
import { useEffect, useRef, useState } from 'react';
import { on } from '../core/sim/events';
import { playSfx, playPinRun } from './sound-fx';

interface Particle {
  readonly id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export function ParticleOverlay(): JSX.Element {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [shake, setShake] = useState(0);
  const [flash, setFlash] = useState(0);
  const nextId = useRef(0);

  useEffect(() => {
    const unsubscribers: (() => void)[] = [];

    unsubscribers.push(
      on('slot:jackpot', ({ itemId, stake, payout, multiplierBps }: { itemId: number; stake: number; payout: number; multiplierBps: number }) => {
        playSfx('win');
        setShake(8);
        setFlash(1);
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        const spawned: Particle[] = [];
        for (let i = 0; i < 30; i += 1) {
          const angle = (i / 30) * Math.PI * 2;
          const speed = 2 + Math.random() * 4;
          spawned.push({
            id: nextId.current++,
            x: cx,
            y: cy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 0,
            maxLife: 60 + Math.random() * 40,
            color: '#ffd700',
            size: 2 + Math.random() * 3,
          });
        }
        setParticles((prev) => [...prev, ...spawned]);
      })
    );

    unsubscribers.push(
      on('slot:chargeDischarge', ({ itemId, stake, payout }: { itemId: number; stake: number; payout: number }) => {
        playSfx('coin');
        setShake(4);
        setFlash(1);
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        const spawned: Particle[] = [];
        for (let i = 0; i < 15; i += 1) {
          const angle = (i / 15) * Math.PI * 2;
          const speed = 3 + Math.random() * 3;
          spawned.push({
            id: nextId.current++,
            x: cx,
            y: cy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 0,
            maxLife: 40 + Math.random() * 20,
            color: '#00ffff',
            size: 1 + Math.random() * 2,
          });
        }
        setParticles((prev) => [...prev, ...spawned]);
      })
    );

    unsubscribers.push(
      on('plinko:drop', ({ stake, payout, pockets, mode }: { stake: number; payout: number; pockets: number[]; mode: string }) => {
        playPinRun(pockets.length);
        setShake(6);
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 3;
        const spawned: Particle[] = [];
        for (let i = 0; i < 20; i += 1) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 1 + Math.random() * 2;
          spawned.push({
            id: nextId.current++,
            x: cx,
            y: cy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 0,
            maxLife: 50 + Math.random() * 30,
            color: `hsl(${Math.random() * 360}, 100%, 50%)`,
            size: 1 + Math.random() * 2,
          });
        }
        setParticles((prev) => [...prev, ...spawned]);
      })
    );

    unsubscribers.push(
      on('dispute:start', ({ disputeId, guestIds, x, y }: { disputeId: number; guestIds: number[]; x: number; y: number }) => {
        playSfx('brawl');
        setShake(10);
        setFlash(1);
        const cx = window.innerWidth / 2 + (x - 15) * 40;
        const cy = window.innerHeight / 2 + (y - 15) * 40;
        const spawned: Particle[] = [];
        for (let i = 0; i < 25; i += 1) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 1 + Math.random() * 3;
          spawned.push({
            id: nextId.current++,
            x: cx,
            y: cy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 0,
            maxLife: 30 + Math.random() * 30,
            color: '#ff4d4d',
            size: 1 + Math.random() * 2,
          });
        }
        setParticles((prev) => [...prev, ...spawned]);
      })
    );

    unsubscribers.push(
      on('money:bigPayout', ({ guestId, amount, covered, debt }: { guestId: number; amount: number; covered: number; debt: number }) => {
        playSfx('win');
        setShake(6);
        setFlash(1);
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        const spawned: Particle[] = [];
        for (let i = 0; i < 40; i += 1) {
          const angle = (i / 40) * Math.PI * 2;
          const speed = 2 + Math.random() * 5;
          spawned.push({
            id: nextId.current++,
            x: cx,
            y: cy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 0,
            maxLife: 70 + Math.random() * 50,
            color: '#ffd700',
            size: 2 + Math.random() * 4,
          });
        }
        setParticles((prev) => [...prev, ...spawned]);
      })
    );

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, []);

  useEffect(() => {
    if (particles.length === 0) return;
    const interval = setInterval(() => {
      setParticles((prev) =>
        prev
          .map((p) => ({
            ...p,
            life: p.life + 1,
            x: p.x + p.vx,
            y: p.y + p.vy,
            vx: p.vx * 0.95,
            vy: p.vy * 0.95 + 0.1,
          }))
          .filter((p) => p.life < p.maxLife)
      );
    }, 16);
    return () => clearInterval(interval);
  }, [particles]);

  useEffect(() => {
    if (shake <= 0) return;
    const interval = setInterval(() => {
      setShake((s) => (s <= 1 ? 0 : s - 1));
    }, 16);
    return () => clearInterval(interval);
  }, [shake]);

  useEffect(() => {
    if (flash <= 0) return;
    const interval = setInterval(() => {
      setFlash((f) => (f <= 1 ? 0 : f - 1));
    }, 16);
    return () => clearInterval(interval);
  }, [flash]);

  return (
    <div
      className="particle-overlay"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 60,
        transform: shake > 0 ? `translate(${Math.random() * shake * 2 - shake}px, ${Math.random() * shake * 2 - shake}px)` : 'none',
        opacity: flash > 0 ? 1 - flash * 0.15 : 1,
        transition: 'opacity 0.1s',
      }}
    >
      {particles.map((p) => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: p.x,
            top: p.y,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: '50%',
            opacity: 1 - p.life / p.maxLife,
            pointerEvents: 'none',
          }}
        />
      ))}
    </div>
  );
}
