/** Werkstatt: sechs Bereiche in einem Raster, erreichbar nur ueber Marke oder Tastatur. */
import { useState } from 'react';
import { activeEmitterCount } from '../render/fx/emitter';
import { atlasTextureCount } from '../render/furniture-atlas';
import { isMuted } from '../render/sound-fx';
import type { GameView } from '../store/types';
import { worldStore } from '../store/use-world-store';
import type { WorkshopTool } from './app-model';
import { AssetLibraryPanel } from './asset-library-popup';
import { DiagnosticsPanel } from './diagnostics-popup';
import { HelpPopup } from './help-popup';
import { JournalPanel } from './journal-popup';
import { PopupShell } from './popup-shell';
import { Smartphone } from './smartphone';
import { SoundPanel } from './sound-popup';
import { ControlsPanel, FpsPanel, useFps, WorkshopBack, WorkshopTile } from './workshop-parts';

interface WorkshopProps {
  readonly view: GameView;
  readonly tool?: WorkshopTool;
  readonly onClose: () => void;
  readonly onGuest: (id: number) => void;
}

const TITLE: Partial<Record<WorkshopTool, string>> = {
  diagnostics: 'Prüfung',
  journal: 'Protokoll',
  assets: 'Assets',
  sound: 'Sound',
  controls: 'Steuerung',
  fps: 'FPS',
  device: 'Gerät',
  help: 'Hilfe',
};

export function WorkshopPopup({ view, tool, onClose, onGuest }: WorkshopProps) {
  const [active, setActive] = useState<WorkshopTool | null>(tool ?? null);
  const fps = useFps();
  const back = (): void => setActive(null);

  if (active === 'device') return <Smartphone view={view} onClose={onClose} />;
  if (active === 'help') return <HelpPopup onClose={onClose} />;

  return (
    <PopupShell
      eyebrow={active ? 'WERKSTATT · EIN BEREICH' : 'DU & WERKSTATT'}
      title={active ? TITLE[active] ?? 'Werkstatt' : 'Werkstatt'}
      onClose={onClose}
      wide={active === null || active === 'journal' || active === 'diagnostics' || active === 'assets'}
      full={active === 'assets'}
      surface="overview"
    >
      {active !== null && <WorkshopBack onBack={back} />}

      {active === 'journal' && <JournalPanel view={view} onGuest={onGuest} />}
      {active === 'diagnostics' && <DiagnosticsPanel view={view} onAudit={() => worldStore.auditLedger()} />}
      {active === 'assets' && <AssetLibraryPanel />}
      {active === 'sound' && <SoundPanel />}
      {active === 'controls' && <ControlsPanel />}
      {active === 'fps' && <FpsPanel fps={fps} />}

      {active === null && (
        <>
          <p className="hint">
            Nichts davon gehört auf den Floor. Prüfung, Protokoll, Assets, Sound, Steuerung und
            Bildrate liegen hinter einer Tür – eine Werkstatt, kein eigener Tab.
          </p>
          <div className="workshop-grid">
            <WorkshopTile
              index="01" label="Prüfung"
              note="Buchhaltung, Personal, Lager und Nachfrage."
              meta={view.ledgerOk ? 'Ledger OK' : 'Ledger-Fehler'}
              onOpen={() => setActive('diagnostics')}
            />
            <WorkshopTile
              index="02" label="Protokoll"
              note="Jede Buchung mit Ursache und Folge."
              meta={`${view.journal.length} live · ${view.archive.length} Archiv`}
              onOpen={() => setActive('journal')}
            />
            <WorkshopTile
              index="03" label="Assets"
              note="Texturen, Frames, Emitter und Tonspuren."
              meta={`${atlasTextureCount()} Korpustexturen · ${activeEmitterCount()} Emitter`}
              onOpen={() => setActive('assets')}
            />
            <WorkshopTile
              index="04" label="Sound"
              note="Kanäle getrennt, Master und Stumm."
              meta={isMuted() ? 'stumm' : 'an'}
              onOpen={() => setActive('sound')}
            />
            <WorkshopTile
              index="05" label="Steuerung"
              note="Was Klick, Taste und Geste auslösen."
              meta="Tastatur · Maus · Touch"
              onOpen={() => setActive('controls')}
            />
            <WorkshopTile
              index="06" label="FPS"
              note="Live messen, ob das Bild mithält."
              meta={`${fps > 0 ? fps : '—'} fps live`}
              onOpen={() => setActive('fps')}
            />
          </div>
          <div className="workshop-footer">
            <span>Weitere Werkzeuge</span>
            <button type="button" className="btn tiny ghost" onClick={() => setActive('device')}>GERÄT</button>
            <button type="button" className="btn tiny ghost" onClick={() => setActive('help')}>HILFE</button>
          </div>
        </>
      )}
    </PopupShell>
  );
}
