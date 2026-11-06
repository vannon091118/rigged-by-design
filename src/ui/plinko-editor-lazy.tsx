/**
 * Chunk-Grenze fuer den Plinko-Editor: Der Editor zieht die 185-KB-Buehne
 * (`plinko-stage`) und wird erst geladen, wenn ein PLINKO-Geraet geoeffnet wird.
 * Die Props sind die des echten Editors; waehrend des Imports bleibt der
 * Editorbereich still, der Rest des Popups steht bereits.
 */
import { lazy, Suspense, type ComponentProps, type ReactElement } from 'react';

const PlinkoEditorInner = lazy(() => import('./plinko-editor'));

type Props = ComponentProps<typeof PlinkoEditorInner>;

export function PlinkoEditorLazy(props: Props): ReactElement {
  return (
    <Suspense fallback={null}>
      <PlinkoEditorInner {...props} />
    </Suspense>
  );
}
