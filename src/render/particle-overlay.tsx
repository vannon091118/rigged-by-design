/** Partikel-Overlay: hoert auf Spielereignisse und zeichnet visuelle Effekte ueber dem Floor.
 * Reine Darstellung: keine Spielmechanik, kein Zufall ausser dem Render-RNG.
 */
import { useEffect, useRef, useState } from 'react';
import { on } from '../core/sim/events';
import { presentation } from './rng';
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

interface Burst {
  readonly count: number;
  readonly x: number;
  readonly y: number;
  readonly speedMin: number;
  readonly speedMax: number;
  readonly lifeMin: number;
  readonly lifeMax: number;
  readonly color: () => string;
}

export function ParticleOverlay(): JSX.Element {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [shake, setShake] = useState(0);
  const [flash, setFlash] = useState(0);
  const nextId = useRef(0);

  useEffect(() => {
    const spawn = ({ count, x, y, speedMin, speedMax, lifeMin, lifeMax, color }: Burst): void => {
      const spawned: Particle[] = [];
      for (let index = 0; index < count; index += 1) {
        const angle = (index / count) * Math.PI * 2;
        const speed = speedMin + presentation.nextFloat() * (speedMax - speedMin);
        spawned.push({
          id: nextId.current++,
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0,
          maxLife: lifeMin + presentation.nextFloat() * (lifeMax - lifeMin),
          color: color(),
          size: 1 + presentation.nextFloat() * 3,
        });
      }
      setParticles((prev) => [...prev, ...spawned]);
    };
    const center = (): { x: number; y: number } => ({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });

    const unsubscribers = [
      on('slot:jackpot', () => {
        playSfx('win');
        setShake(8);
        setFlash(1);
        const { x, y } = center();
        spawn({ count: 30, x, y, speedMin: 2, speedMax: 6, lifeMin: 60, lifeMax: 100, color: () => '#ffd700' });
      }),
      on('slot:chargeDischarge', () => {
        playSfx('coin');
        setShake(4);
        setFlash(1);
        const { x, y } = center();
        spawn({ count: 15, x, y, speedMin: 3, speedMax: 6, lifeMin: 40, lifeMax: 60, color: () => '#00ffff' });
      }),
      on('plinko:drop', ({ pockets }: { pockets: number[] }) => {
        playPinRun(pockets.length);
        setShake(6);
        spawn({
          count: 20,
          x: window.innerWidth / 2,
          y: window.innerHeight / 3,
          speedMin: 1,
          speedMax: 3,
          lifeMin: 50,
          lifeMax: 80,
          color: () => `hsl(${presentation.nextFloat() * 360}, 100%, 50%)`,
        });
      }),
      on('dispute:start', ({ x, y }: { x: number; y: number }) => {
        playSfx('brawl');
        setShake(10);
        setFlash(1);
        spawn({
          count: 25,
          x: window.innerWidth / 2 + (x - 15) * 40,
          y: window.innerHeight / 2 + (y - 15) * 40,
          speedMin: 1,
          speedMax: 4,
          lifeMin: 30,
          lifeMax: 60,
          color: () => '#ff4d4d',
        });
      }),
      on('money:bigPayout', () => {
        playSfx('win');
        setShake(6);
        setFlash(1);
        const { x, y } = center();
        spawn({ count: 40, x, y, speedMin: 2, speedMax: 7, lifeMin: 70, lifeMax: 120, color: () => '#ffd700' });
      }),
    ];

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, []);

  useEffect(() => {
    if (particles.length === 0) return;
    const interval = setInterval(() => {
      setParticles((prev) =>
        prev
          .map((particle) => ({
            ...particle,
            life: particle.life + 1,
            x: particle.x + particle.vx,
            y: particle.y + particle.vy,
            vx: particle.vx * 0.95,
            vy: particle.vy * 0.95 + 0.1,
          }))
          .filter((particle) => particle.life < particle.maxLife)
      );
    }, 16);
    return () => clearInterval(interval);
  }, [particles]);

  useEffect(() => {
    if (shake <= 0) return;
    const interval = setInterval(() => {
      setShake((value) => (value <= 1 ? 0 : value - 1));
    }, 16);
    return () => clearInterval(interval);
  }, [shake]);

  useEffect(() => {
    if (flash <= 0) return;
    const interval = setInterval(() => {
      setFlash((value) => (value <= 1 ? 0 : value - 1));
    }, 16);
    return () => clearInterval(interval);
  }, [flash]);

  const jitter = (): number => presentation.nextFloat() * shake * 2 - shake;

  return (
    <div
      className="particle-overlay"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 60,
        transform: shake > 0 ? `translate(${jitter()}px, ${jitter()}px)` : 'none',
        opacity: flash > 0 ? 1 - flash * 0.15 : 1,
        transition: 'opacity 0.1s',
      }}
    >
      {particles.map((particle) => (
        <div
          key={particle.id}
          style={{
            position: 'absolute',
            left: particle.x,
            top: particle.y,
            width: particle.size,
            height: particle.size,
            backgroundColor: particle.color,
            borderRadius: '50%',
            opacity: 1 - particle.life / particle.maxLife,
            pointerEvents: 'none',
          }}
        />
      ))}
    </div>
  );
}
