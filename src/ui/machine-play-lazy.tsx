/** Lazy-Grenze fuer die eigenen Spieltische: Pixi und Engines erst beim Gastmodus. */
import { lazy, Suspense, type ReactElement } from 'react';
import type { MachinePlayProps } from './machine-play';

const MachinePlayInner = lazy(() => import('./machine-play'));

export function MachinePlayLazy(props: MachinePlayProps): ReactElement {
  return (
    <Suspense fallback={<p className="hint">Der eigene Spieltisch wird geladen …</p>}>
      <MachinePlayInner {...props} />
    </Suspense>
  );
}
