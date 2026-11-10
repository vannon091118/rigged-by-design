import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { getBuildDef, type BuildId } from './core/sim/offers';
import type { ScreenAnchor } from './render/floor-hit';
import { FloorStage, type FloorHandle } from './render/floor-stage';
import { ActionCard } from './ui/action-card';
import { useWorldStore, worldStore } from './store/use-world-store';
import { type Perspective, type Popup } from './ui/app-model';
import { useArmMusic, useDisputeSfx, useJournalSfx, useNarrativePause, useNoticeDismiss, usePointerHaptics, useSceneMusic, useWorkshopShortcut } from './ui/app-effects';
import { closeEditorUrl, crateGhostId, isCarryingCrate, makeActionExecutor, openPopupWith, switchPerspective } from './ui/app-wiring';
import { ConnectedBuildPanel } from './ui/build-panel-connected';
import { ConnectedHud } from './ui/connected-hud';
import { Dock } from './ui/dock';
import { FloorFeedback } from './ui/floor-feedback';
import { FloorRoleBar } from './ui/floor-role-bar';
import { PopupRouter } from './ui/popup-router';
import { StageControls } from './ui/stage-controls';
import { useCrateActions } from './ui/use-crate-actions';
import { useFloorInteraction } from './ui/use-floor-interaction';
import { useStageKeys } from './ui/use-stage-keys';
import { editorEnabled } from './ui/editor-gate';

// Produktionsbuilds ersetzen DEV mit false: der dynamische Import und damit
// der Editor-Chunk verschwinden vollstaendig aus dem APK-/Web-Bundle.
const EDITOR_BUILD = import.meta.env.DEV && import.meta.env.VITE_RBD_EDITOR_MODE === '1';
const LayoutEditor = EDITOR_BUILD ? lazy(() => import('./ui/layout-editor')) : null;

interface AppProps {
  readonly onFirstFrame?: () => void;
}

export default function App({ onFirstFrame }: AppProps = {}) {
  const view = useWorldStore();
  const [popup, setPopup] = useState<Popup>(null);
  const [perspective, setPerspective] = useState<Perspective>('operator');
  const [buildOpen, setBuildOpen] = useState(false);
  // Derselbe Anker fuer das Geraetepanel: der Automat ist sein eigenes Menue.
  const [popupAnchor, setPopupAnchor] = useState<ScreenAnchor | null>(null);
  const [placeError, setPlaceError] = useState('');
  const stage = useRef<FloorHandle>(null);
  const [editorOpen, setEditorOpen] = useState(() => editorEnabled(window.location.search));
  // Eine stabile Projektion: die Karte fragt pro Frame die Buehne, nicht React.
  const projectAnchor = useCallback(
    (worldX: number, worldY: number) => stage.current?.project(worldX, worldY) ?? null,
    [],
  );

  // Ton, Musik, Frist und Haptik folgen dem Zustand, nicht dem Klick.
  useNoticeDismiss(view.notice);
  useJournalSfx(view.journal);
  useDisputeSfx(view.disputes.length);
  useSceneMusic(popup, view.furniture);
  useNarrativePause(popup !== null || buildOpen || editorOpen);
  useArmMusic();
  usePointerHaptics();

  const carryingCrate = isCarryingCrate(view.player.carrying);
  const ghostId = crateGhostId(view.player.carrying, view.crates);

  // Kistenklick und Enter laufen ueber denselben Hook: Ziel setzen, Charakter laufen lassen, zugreifen.
  const crates = useCrateActions(view, {
    canOperate: perspective === 'operator',
    blocked: popup !== null || buildOpen || editorOpen,
    onError: setPlaceError,
  });

  const buy = (id: BuildId): void => {
    if (perspective === 'guest') return;
    if (view.house < getBuildDef(id).cost) { setPlaceError('Hauskonto zu niedrig – erst Geld verdienen, dann kaufen.'); return; }
    worldStore.buy(id);
    setPlaceError('');
  };

  const setters = { setPopup, setPopupAnchor, setBuildOpen, setPerspective };
  const openPopup = (next: Popup): void => openPopupWith(setters, next);
  const changePerspective = (next: Perspective): void => switchPerspective(setters, perspective, next);

  // Ein Pfad fuer alle Eingaenge: Ziel waehlen, laufen, in Reichweite handeln.
  const executeAction = makeActionExecutor(openPopup, setPopupAnchor);
  const interaction = useFloorInteraction({
    view,
    enabled: perspective === 'operator',
    blocked: popup !== null || buildOpen || editorOpen,
    onExecute: executeAction,
  });
  const closeInteraction = interaction.close;

  // Ein offenes Fenster beendet den Fokus; sonst tippt der naechste Klick ins Leere.
  useEffect(() => {
    if (popup !== null || buildOpen || editorOpen) closeInteraction();
  }, [popup, buildOpen, editorOpen, closeInteraction]);

  useStageKeys({
    enabled: popup === null && !buildOpen && !editorOpen,
    zoom: (factor) => stage.current?.zoom(factor),
    fit: () => stage.current?.fit(),
    onEscape: () => { if (!closeInteraction()) setBuildOpen(false); },
  });

  useWorkshopShortcut(() => {
    setBuildOpen(false);
    setPopup({ kind: 'workshop' });
  });

  const closeEditor = (): void => { setEditorOpen(false); stage.current?.setEditor(null); closeEditorUrl(); };

  return (
    <div className="app" data-perspective={perspective}>
      <ConnectedHud view={view} perspective={perspective} onPerspective={changePerspective} onOpen={openPopup} />

      <main
        className={`stage-wrap${carryingCrate ? ' is-placing' : ''}`}
        onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; }}
        onDrop={(event) => {
          event.preventDefault();
          const id = event.dataTransfer.getData('text/build') as BuildId;
          if (id) buy(id);
        }}
      >
        <FloorStage
          ref={stage}
          view={view}
          placing={ghostId}
          paused={popup?.kind === 'games' || popup?.kind === 'machine'}
          onTap={(tap) => {
            // Moebelkiste tragen: der Boden ist das Ablageziel. Sonst entscheidet der Trefferpfad.
            if (ghostId && tap.target.kind === 'floor') crates.tapFloor(tap.target.x, tap.target.y);
            else interaction.tap(tap);
          }}
          onFirstFrame={onFirstFrame}
        />

        <FloorRoleBar perspective={perspective} />

        <ActionCard
          actions={interaction.selection?.actions ?? []}
          anchor={interaction.selection?.anchor ?? null}
          project={projectAnchor}
          status={interaction.selection?.status ?? ''}
          blocked={interaction.selection?.blocked ?? false}
          onPick={interaction.pick}
          onClose={interaction.close}
        />

        <StageControls zoom={(factor) => stage.current?.zoom(factor)} overview={() => stage.current?.fit()} />

        {carryingCrate && (
          <div className="place-hint">
            <b>Kiste tragen</b>
            <span>{placeError || (crates.placeTarget
              ? 'Der Charakter trägt sie zum markierten Feld.'
              : 'Klick auf eine freie Fläche: der Charakter trägt sie hin. Enter stellt sie sofort am Feld ab.')}</span>
          </div>
        )}

        <FloorFeedback view={view} onOpen={openPopup} />

        {LayoutEditor && editorOpen && (
          <Suspense fallback={null}>
            <LayoutEditor
              cellAt={(x, y) => stage.current?.cellAt(x, y) ?? null}
              onCursor={(cursor) => stage.current?.setEditor(cursor)}
              onClose={closeEditor}
            />
          </Suspense>
        )}
      </main>

      <Dock
        view={view}
        perspective={perspective}
        onPlay={() => { setPopup(null); setBuildOpen(false); stage.current?.fit(); }}
        onBuild={() => setBuildOpen((open) => !open)}
        onClean={() => worldStore.clean()}
        onOpen={openPopup}
      />

      {buildOpen && <ConnectedBuildPanel view={view} onClose={() => setBuildOpen(false)} onBuy={buy} />}

      <PopupRouter
        view={view}
        perspective={perspective}
        popup={popup}
        anchor={popupAnchor}
        project={projectAnchor}
        onClose={() => { setPopup(null); setPopupAnchor(null); }}
        onOpen={openPopup}
        onStaff={() => { setPopup(null); setBuildOpen(true); }}
      />

      <div className="rotate-hint" role="note">Bitte das Gerät ins Hochformat drehen.</div>
    </div>
  );
}
