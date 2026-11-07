// @loc-exception: App verdrahtet Popups, Tastaturpfad und Floor in genau einem Zustandsbaum; getrennt waeren Fokus und Popup-Routing doppelt.
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { getBuildDef, type BuildId } from './core/sim/offers';
import type { CarpetId, TemplateId } from './core/sim/types';
import type { MenuAction } from './render/floor-actions';
import { handleFloorInteract } from './render/floor-interact';
import { tapHaptic } from './render/haptics';
import { FloorStage, type FloorHandle } from './render/floor-stage';
import { armMusic, setMusicState } from './render/music';
import { ActionCard } from './ui/action-card';
import { playSfx } from './render/sound-fx';
import { useWorldStore, worldStore } from './store/use-world-store';
import { type Perspective, type Popup } from './ui/app-model';
import { BuildPanel } from './ui/build-panel';
import { Dock, useBrandTaps } from './ui/dock';
import { FloorRoleBar } from './ui/floor-role-bar';
import { Hud } from './ui/hud';
import { PopupRouter } from './ui/popup-router';
import { StageControls } from './ui/stage-controls';
import { useCrateActions } from './ui/use-crate-actions';
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
  const [actions, setActions] = useState<MenuAction[]>([]);
  const [placeError, setPlaceError] = useState('');
  const stage = useRef<FloorHandle>(null);
  const [editorOpen, setEditorOpen] = useState(() => editorEnabled(window.location.search));

  useEffect(() => {
    if (!view.notice) return;
    const id = window.setTimeout(() => worldStore.dismiss(), 6500);
    return () => window.clearTimeout(id);
  }, [view.notice]);

  // Kasse und Pruegelei sind Welt-Ereignisse: der Ton folgt dem Protokoll, nicht dem Klick.
  const seenJournal = useRef(-1);
  useEffect(() => {
    const latest = view.journal[view.journal.length - 1];
    if (!latest) return;
    if (seenJournal.current < 0) { seenJournal.current = latest.id; return; }
    const fresh = view.journal.filter((entry) => entry.id > seenJournal.current);
    seenJournal.current = latest.id;
    if (fresh.some((entry) => entry.kind === 'MONEY' && / (chips|fiat wechseln)$/.test(entry.subject))) playSfx('coin');
  }, [view.journal]);

  const disputes = useRef(view.disputes.length);
  useEffect(() => {
    if (view.disputes.length > disputes.current) playSfx('brawl');
    disputes.current = view.disputes.length;
  }, [view.disputes.length]);

  // Musik folgt dem Fenster, nicht dem Klick: Floor, Fremdhaus, eigenes Geraet.
  useEffect(() => {
    if (popup?.kind === 'games') { setMusicState('GAMES'); return; }
    if (popup?.kind === 'foreignMap' || popup?.kind === 'foreignFloor') { setMusicState('NIGHT'); return; }
    if (popup?.kind === 'workshop') { setMusicState('MENU'); return; }
    if (popup?.kind === 'guests' || popup?.kind === 'narrative' || popup?.kind === 'dialogue') {
      setMusicState('BACKGROUND');
      return;
    }
    if (popup?.kind === 'machine') {
      const item = view.furniture.find((entry) => entry.id === popup.itemId);
      setMusicState(item?.gameId === 'SLOT' ? 'SLOT' : 'GAMES');
      return;
    }
    setMusicState('FLOOR');
  }, [popup, view.furniture]);

  // Der Browser laesst Ton erst nach einer Geste zu; bis dahin bleibt es still.
  useEffect(() => armMusic(), []);

  // Kurze Haptik bei jedem Tipp; reduced motion schaltet sie in haptics.ts ab.
  useEffect(() => {
    const onPointerDown = (): void => tapHaptic();
    window.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true });
    return () => window.removeEventListener('pointerdown', onPointerDown, true);
  }, []);

  useStageKeys({
    enabled: popup === null && !buildOpen && !editorOpen,
    zoom: (factor) => stage.current?.zoom(factor),
    fit: () => stage.current?.fit(),
    onEscape: () => setBuildOpen(false),
  });

  const carryingCrate = view.player.carrying.startsWith('KRATE:');
  const ghostId = (() => {
    const match = /^KRATE:(\d+)$/.exec(view.player.carrying);
    const crate = match ? view.crates.find((entry) => entry.id === Number(match[1])) : undefined;
    return crate && crate.payload.kind === 'FURNITURE' ? crate.payload.buildId : null;
  })();

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

  const openPopup = (next: Popup): void => {
    setBuildOpen(false);
    setActions([]);
    setPopup(next);
  };

  const changePerspective = (next: Perspective): void => {
    if (next === perspective) return;
    setPopup(null);
    setBuildOpen(false);
    setActions([]);
    setPerspective(next);
  };
  const onBrandTap = useBrandTaps(() => openPopup({ kind: 'workshop' }));

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (!event.ctrlKey || !event.shiftKey || event.repeat || event.key.toLowerCase() !== 'd') return;
      event.preventDefault();
      setBuildOpen(false);
      setActions([]);
      setPopup({ kind: 'workshop' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const closeEditor = (): void => {
    setEditorOpen(false);
    stage.current?.setEditor(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('editor');
    window.history.replaceState(null, '', url);
  };

  return (
    <div className="app" data-perspective={perspective}>
      <Hud view={view} perspective={perspective} onPerspective={changePerspective} onSkill={(attribute) => worldStore.spendSkill(attribute)} onBrandTap={onBrandTap} />

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
          onGuest={(id) => { if (perspective === 'operator') openPopup({ kind: 'guests', guestId: id }); }}
          onFurniture={(id) => openPopup({ kind: 'machine', itemId: id })}
          onEmpty={(x, y) => {
            crates.tapFloor(x, y);
          }}
          onInteract={handleFloorInteract}
          onActions={(next) => setActions(perspective === 'operator' ? next : [])}
          onFirstFrame={onFirstFrame}
        />

        <FloorRoleBar perspective={perspective} />

        <ActionCard
          actions={actions}
          onPick={(action) => {
            if (action.id === 'SPIEGEL') { openPopup({ kind: 'look' }); return; }
            handleFloorInteract(action.id, action.targetId);
            setActions([]);
          }}
          onClose={() => setActions([])}
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

        <div className="live-region" role="status" aria-live="polite">
          {view.notice || view.lastEvent}
        </div>

        {view.lastEvent && !view.notice && <div className="event-line" aria-hidden="true">{view.lastEvent}</div>}

        {view.narrative.events.length > 0 && (
          <button type="button" className="narrative-chip"
            onClick={() => openPopup({ kind: 'narrative' })}
            title="Aktive Szenen und Figuren öffnen">
            STORY · {view.narrative.events.length}
          </button>
        )}

        <button type="button" className="narrative-chip dialogue-chip" title="Comic-Dialog oeffnen"
          onClick={() => openPopup({ kind: 'dialogue' })}>DIALOG</button>

        {view.notice && (
          <button type="button" className="toast" onClick={() => worldStore.dismiss()}>{view.notice}</button>
        )}

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
        onPlay={() => { setPopup(null); setBuildOpen(false); setActions([]); stage.current?.fit(); }}
        onBuild={() => setBuildOpen((open) => !open)}
        onClean={() => worldStore.clean()}
        onOpen={openPopup}
      />

      {buildOpen && (
        <BuildPanel
          view={view}
          onClose={() => setBuildOpen(false)}
          onBuy={buy}
          onTemplate={(id: TemplateId) => worldStore.setTemplate(id)}
          onHire={(role) => worldStore.hire(role)}
          onFire={(role) => worldStore.fire(role)}
          onPrice={(key, value) => worldStore.setPrice(key, value)}
          onCarpet={(id: CarpetId) => worldStore.setCarpet(id)}
          onRepair={(id) => worldStore.repair(id)}
          onClean={() => worldStore.clean()}
          onOrderDrinks={(count) => worldStore.orderDrinks(count)}
          onOrderParts={(count) => worldStore.orderParts(count)}
          onUpgradeBar={() => worldStore.upgradeBar()}
          onUpgradeWc={() => worldStore.upgradeWc()}
          onWall={(color) => worldStore.setWall(color)}
          onNeon={(color) => worldStore.setNeon(color)}
          onServeDesk={() => worldStore.serveDesk()}
          onCalm={(id) => worldStore.calm(id)}
        />
      )}

      <PopupRouter
        view={view}
        perspective={perspective}
        popup={popup}
        onClose={() => setPopup(null)}
        onOpen={openPopup}
        onStaff={() => { setPopup(null); setBuildOpen(true); }}
      />

      <div className="rotate-hint" role="note">Bitte das Gerät ins Hochformat drehen.</div>
    </div>
  );
}
