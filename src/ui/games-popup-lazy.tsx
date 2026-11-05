/**
 * Chunk-Grenze fuer das Spiel-Paket: Engines, Tische und Pixi-Buehnen der
 * Auswaertsspiele werden erst geladen, wenn das Popup wirklich geoeffnet wird.
 * Die Props sind die des echten Popups; die Shell steht als Ladeplatzhalter,
 * damit das Oeffnen nicht springt.
 */
import { lazy, Suspense, type ComponentProps, type ReactElement } from 'react';
import { PopupShell } from './popup-shell';

const GamesPopupInner = lazy(() => import('./games-popup').then((module) => ({ default: module.GamesPopup })));

type Props = ComponentProps<typeof GamesPopupInner>;

export function GamesPopup(props: Props): ReactElement {
  return (
    <Suspense
      fallback={(
        <PopupShell eyebrow="FREMDES HAUS" title="Spiele" onClose={props.onClose}>
          <p className="hint">Spieltische werden geladen …</p>
        </PopupShell>
      )}
    >
      <GamesPopupInner {...props} />
    </Suspense>
  );
}
