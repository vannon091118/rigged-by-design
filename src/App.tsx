// @loc-exception: App verdrahtet Popups, Tastaturpfad und Floor in genau einem Zustandsbaum; getrennt waeren Fokus und Popup-Routing doppelt.
import { useEffect, useRef, useState } from 'react';
import { canPlaceAt } from './core/sim/grid-zones';
import { getBuildDef, type BuildId } from './core/sim/offers';
import type { CarpetId, TemplateId } from './core/sim/types';
import { FloorStage, type FloorHandle } from './render/floor-stage';
import { useWorldStore, worldStore } from './store/use-world-store';
import type { GameView } from './store/types';
import { BuildPanel } from './ui/build-panel';
import { DiagnosticsPopup } from './ui/diagnostics-popup';
import { GamesPopup } from './ui/games-popup';
import { GuestPopup } from './ui/guest-popup';
import { HelpPopup } from './ui/help-popup';
import { Hud } from './ui/hud';
import { JournalPopup } from './ui/journal-popup';
import { LookPopup } from './ui/look-popup';
import { SoundPopup } from './ui/sound-popup';
import { MachinePopup } from './ui/machine-popup';
import { isMuted, playSfx } from './render/sound-fx';
import { armMusic, setMusicState } from './render/music';

type Popup =
  | { kind: 'guests'; guestId: number | null }
  | { kind: 'machine'; itemId: number }
  | { kind: 'games' }
  | { kind: 'journal' }
  | { kind: 'diagnostics' }
  | { kind: 'look' }
  | { kind: 'sound' }
  | { kind: 'help' }
  | null;

function fits(view: GameView, id: BuildId, x: number, y: number): boolean {
  const def = getBuildDef(id);
  const blockers = [view.player.position, ...view.guests.map((guest) => guest.position)];
  return canPlaceAt(view.size, view.furniture, blockers, x, y, def.w, def.h, def.seats > 0);
}

const MOVE_KEYS: Readonly<Record<string, readonly [number, number]>> = {
  arrowup: [0, -1], w: [0, -1],
  arrowdown: [0, 1], s: [0, 1],
  arrowleft: [-1, 0], a: [-1, 0],
  arrowright: [1, 0], d: [1, 0],
};

export default function App() {
  const view = useWorldStore();
  const [popup, setPopup] = useState<Popup>(null);
  const [buildOpen, setBuildOpen] = useState(false);
  const [placeError, setPlaceError] = useState('');
  const [muted, setMutedState] = useState(isMuted);
  const stage = useRef<FloorHandle>(null);

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

  // Musik folgt dem Fenster, nicht dem Klick: Floor, Fremdhaus, eigenes Gerät.
  useEffect(() => {
    if (popup?.kind === 'games') { setMusicState('GAMES'); return; }
    if (popup?.kind === 'machine') {
      const item = view.furniture.find((entry) => entry.id === popup.itemId);
      setMusicState(item?.gameId === 'SLOT' ? 'SLOT' : 'GAMES');
      return;
    }
    setMusicState('FLOOR');
  }, [popup, view.furniture]);

  // Der Browser laesst Ton erst nach einer Geste zu; bis dahin bleibt es still.
  useEffect(() => armMusic(), []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && buildOpen) setBuildOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [buildOpen]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;
      if (popup !== null || buildOpen) return;
      const direction = MOVE_KEYS[event.key.toLowerCase()];
      if (direction) {
        event.preventDefault();
        worldStore.moveStep(direction[0], direction[1]);
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        worldStore.useCarriedHere();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [popup, buildOpen]);

  const carryingCrate = view.player.carrying.startsWith('KRATE:');
  const ghostId = (() => {
    const match = /^KRATE:(\d+)$/.exec(view.player.carrying);
    const crate = match ? view.crates.find((entry) => entry.id === Number(match[1])) : undefined;
    return crate && crate.payload.kind === 'FURNITURE' ? crate.payload.buildId : null;
  })();

  const buy = (id: BuildId): void => {
    if (view.house < getBuildDef(id).cost) { setPlaceError('Hauskonto zu niedrig – erst Geld verdienen, dann kaufen.'); return; }
    worldStore.buy(id);
    setPlaceError('');
  };

  const deployAt = (x: number, y: number): void => {
    const match = /^KRATE:(\d+)$/.exec(view.player.carrying);
    const crate = match ? view.crates.find((entry) => entry.id === Number(match[1])) : undefined;
    if (!crate || crate.payload.kind !== 'FURNITURE') return;
    if (!fits(view, crate.payload.buildId, x, y)) return;
    worldStore.deploy(x, y);
  };

  const active = popup?.kind === 'machine' ? view.furniture.find((item) => item.id === popup.itemId) ?? null : null;

  return (
    <div className="app">
      <Hud
        view={view}
        onBuild={() => { setPopup(null); setBuildOpen((open) => !open); }}
        onGuests={() => { setBuildOpen(false); setPopup({ kind: 'guests', guestId: null }); }}
        onVisit={() => { setBuildOpen(false); setPopup({ kind: 'games' }); }}
        onClean={() => worldStore.clean()}
        onOverview={() => stage.current?.fit()}
        onJournal={() => { setBuildOpen(false); setPopup({ kind: 'journal' }); }}
        onDiagnostics={() => { setBuildOpen(false); setPopup({ kind: 'diagnostics' }); }}
        onLook={() => { setBuildOpen(false); setPopup({ kind: 'look' }); }}
        onSkill={(attribute) => worldStore.spendSkill(attribute)}
        muted={muted}
        onToggleSound={() => { setBuildOpen(false); setPopup({ kind: 'sound' }); }}
        onHelp={() => { setBuildOpen(false); setPopup({ kind: 'help' }); }}
      />

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
          onGuest={(id) => { setBuildOpen(false); setPopup({ kind: 'guests', guestId: id }); }}
          onFurniture={(id) => { setBuildOpen(false); setPopup({ kind: 'machine', itemId: id }); }}
          onEmpty={(x, y) => {
            if (carryingCrate) { deployAt(x, y); return; }
            worldStore.moveTo({ x, y });
          }}
        />

        <div className="stage-legend">
          <span><b>KLICK</b> auf freie Fläche: hinlaufen</span>
          <span><b>GAST</b> Budget, Laune, Geduld</span>
          <span><b>OBJEKT</b> Zustand, Mods, Testspin</span>
          <span><b>MAUSRAD</b> zoomen</span>
          <span><b>PFEILE / WASD</b> laufen</span>
          <span><b>ENTER</b> Kiste aufstellen</span>
        </div>

        {carryingCrate && (
          <div className="place-hint">
            <b>Kiste tragen</b>
            <span>{placeError || 'Auf eine freie Fläche klicken – oder hinlaufen und Enter drücken.'}</span>
          </div>
        )}

        <div className="live-region" role="status" aria-live="polite">
          {view.notice || view.lastEvent}
        </div>

        {view.lastEvent && !view.notice && <div className="event-line" aria-hidden="true">{view.lastEvent}</div>}

        {view.notice && (
          <button type="button" className="toast" onClick={() => worldStore.dismiss()}>{view.notice}</button>
        )}
      </main>

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
          onPickup={(id) => worldStore.pickup(id)}
          onUnload={() => worldStore.unloadHere()}
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

      {popup?.kind === 'guests' && (
        <GuestPopup view={view} selectedId={popup.guestId} onClose={() => setPopup(null)} onPay={(id) => worldStore.pay(id)} onServe={(id) => worldStore.serveDrink(id)} onCalm={(id) => worldStore.calm(id)} onTalk={(id) => worldStore.talk(id)} onFight={(id) => worldStore.fightBrawl(id)} />
      )}

      {popup?.kind === 'games' && (
        <GamesPopup
          view={view}
          onClose={() => setPopup(null)}
          onPlay={(rivalId, machineIndex, betVC, options) => worldStore.playRival(rivalId, machineIndex, betVC, options)}
          onRisk={(rivalId, color, stakeVC) => worldStore.riskCard(rivalId, color, stakeVC)}
          onShellRound={() => worldStore.shellRound()}
          onCardSeed={() => worldStore.cardSeed()}
          onSettleCard={(rivalId, machineIndex, stakeVC, bps, label) => worldStore.settleCard(rivalId, machineIndex, stakeVC, bps, label)}
          onTakeHome={() => worldStore.takeHome(5)}
          onExclusion={(command, limitVC) => worldStore.exclusion(command, limitVC)}
        />
      )}

      {popup?.kind === 'journal' && (
        <JournalPopup
          view={view}
          onClose={() => setPopup(null)}
          onGuest={(id) => setPopup({ kind: 'guests', guestId: id })}
        />
      )}

      {popup?.kind === 'diagnostics' && (
        <DiagnosticsPopup view={view} onClose={() => setPopup(null)} onAudit={() => worldStore.auditLedger()} />
      )}

      {popup?.kind === 'look' && (
        <LookPopup view={view} onClose={() => setPopup(null)} onLook={(patch) => worldStore.setLook(patch)} />
      )}

      {popup?.kind === 'sound' && (
        <SoundPopup onClose={() => { setPopup(null); setMutedState(isMuted()); }} />
      )}

      {popup?.kind === 'help' && (
        <HelpPopup onClose={() => setPopup(null)} />
      )}

      {active && (
        <MachinePopup
          item={active}
          view={view}
          onClose={() => setPopup(null)}
          onTest={() => worldStore.spinTest(active.id)}
          onRepair={() => worldStore.repair(active.id)}
          onMod={(id) => worldStore.installMod(active.id, id)}
          onAddReel={() => worldStore.addReel(active.id)}
          onBet={(value) => worldStore.setBet(active.id, value)}
          onSlotOdds={(profile) => worldStore.setSlotOdds(active.id, profile)}
          onTakeDrink={() => worldStore.takeDrink()}
          onDeployPlinko={(config) => worldStore.deployPlinko(config)}
          onPlinkoMode={(mode) => worldStore.setPlinkoMode(mode)}
        />
      )}
    </div>
  );
}
