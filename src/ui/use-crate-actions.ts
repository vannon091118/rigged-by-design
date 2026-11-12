/** Kisten am Floor: Ein Klick gibt das Ziel, der Charakter laeuft hin und hebt auf oder stellt ab. */
import { useEffect, useRef, useState } from 'react';
import type { GameView } from '../store/types';
import { worldStore } from '../store/use-world-store';
import { fits } from './app-model';

const HELD = /^KRATE:(\d+)$/;

type Point = { readonly x: number; readonly y: number };

/** Die Kiste in den Haenden, falls es eine ist. */
function heldCrate(view: GameView) {
  const match = HELD.exec(view.player.carrying);
  return match ? view.crates.find((entry) => entry.id === Number(match[1])) : undefined;
}

function distance(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function useCrateActions(
  view: GameView,
  options: { readonly canOperate: boolean; readonly blocked: boolean; readonly onError: (message: string) => void },
) {
  const latest = useRef({ view, ...options });
  latest.current = { view, ...options };
  const [pickupTarget, setPickupTarget] = useState<number | null>(null);
  const [placeTarget, setPlaceTarget] = useState<Point | null>(null);

  // Aufheben: Der Klick markiert die Kiste, der Charakter laeuft und greift in Reichweite zu.
  useEffect(() => {
    if (pickupTarget === null) return;
    const crate = view.crates.find((entry) => entry.id === pickupTarget);
    if (!crate || crate.carriedBy !== null || view.player.carrying !== '') { setPickupTarget(null); return; }
    if (distance(view.player.position, crate) > 2) return;
    setPickupTarget(null);
    worldStore.pickup(crate.id);
  }, [pickupTarget, view]);

  // Aufstellen: Der Charakter traegt die Kiste bis zum markierten Feld und stellt sie dort ab.
  useEffect(() => {
    if (!placeTarget) return;
    const crate = heldCrate(view);
    if (!crate || crate.payload.kind !== 'FURNITURE') { setPlaceTarget(null); return; }
    if (view.player.position.x !== placeTarget.x || view.player.position.y !== placeTarget.y) return;
    setPlaceTarget(null);
    worldStore.deploy(placeTarget.x, placeTarget.y);
  }, [placeTarget, view]);

  // Enter bleibt die Tastenalternative: in Reichweite aufheben, am eigenen Feld absetzen.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Enter' || event.repeat) return;
      const { view: current, blocked, canOperate } = latest.current;
      if (blocked || !canOperate || current.scene.kind !== 'OWN') return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;
      if (current.player.carrying.startsWith('KRATE:')) {
        event.preventDefault();
        worldStore.useCarriedHere();
        return;
      }
      if (current.player.carrying !== '') return;
      const crate = current.crates
        .filter((entry) => entry.carriedBy === null && distance(entry, current.player.position) <= 2)
        .sort((a, b) => distance(a, current.player.position) - distance(b, current.player.position))[0];
      if (!crate) return;
      event.preventDefault();
      worldStore.pickup(crate.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /** Floor-Klick: Kiste holen, Kiste absetzen oder einfach laufen. */
  const tapFloor = (x: number, y: number): void => {
    const { view: current, canOperate, onError } = latest.current;
    const crate = heldCrate(current);
    if (crate?.payload.kind === 'FURNITURE') {
      if (!canOperate) return;
      if (!fits(current, crate.payload.buildId, x, y)) {
        setPlaceTarget(null);
        onError('Da ist kein Platz.');
        return;
      }
      onError('');
      setPlaceTarget({ x, y });
      worldStore.moveTo({ x, y });
      return;
    }
    if (current.player.carrying !== '') return;
    setPlaceTarget(null);
    const target = current.crates.find((entry) => entry.carriedBy === null && entry.x === x && entry.y === y);
    if (!target) { setPickupTarget(null); worldStore.moveTo({ x, y }); return; }
    setPickupTarget(target.id);
    worldStore.moveTo({ x, y });
  };

  return { tapFloor, placeTarget };
}
