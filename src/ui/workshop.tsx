/** Werkstatt: Charakter, Pruefung, Protokoll, Assets, Sound und Geraet hinter einer Tuer. */
import { useState } from 'react';
import { atlasTextureCount } from '../render/furniture-atlas';
import type { GameView } from '../store/types';
import { worldStore } from '../store/use-world-store';
import type { WorkshopTool } from './app-model';
import { AssetLibraryPopup } from './asset-library-popup';
import { DiagnosticsPopup } from './diagnostics-popup';
import { HelpPopup } from './help-popup';
import { JournalPopup } from './journal-popup';
import { LookPopup } from './look-popup';
import { PopupShell } from './popup-shell';
import { Smartphone } from './smartphone';
import { SoundPopup } from './sound-popup';

interface WorkshopProps {
  readonly view: GameView;
  readonly tool?: WorkshopTool;
  readonly onClose: () => void;
  readonly onGuest: (id: number) => void;
}

const TOOLS: readonly { readonly id: WorkshopTool; readonly label: string; readonly note: string }[] = [
  { id: 'look', label: 'Charakter', note: 'Aussehen der Spielfigur, reine Optik' },
  { id: 'journal', label: 'Protokoll', note: 'Jede Buchung mit Ursache und Folge' },
  { id: 'diagnostics', label: 'Pruefung', note: 'Buchhaltung, Personal, Lager, Nachfrage' },
  { id: 'assets', label: 'Assets', note: 'Alle Texturen, Emitter und Tonspuren' },
  { id: 'sound', label: 'Sound', note: 'Kanaele, Lautstaerke, Stumm' },
  { id: 'device', label: 'Geraet', note: 'Kaufen, servieren, putzen, reisen' },
  { id: 'help', label: 'Hilfe', note: 'Geld, Gaeste, Objekte, Steuerung' },
];

export function WorkshopPopup({ view, tool, onClose, onGuest }: WorkshopProps) {
  const [active, setActive] = useState<WorkshopTool | null>(tool ?? null);
  const back = (): void => setActive(null);

  if (active === 'look') return <LookPopup view={view} onClose={back} onLook={(patch) => worldStore.setLook(patch)} />;
  if (active === 'journal') return <JournalPopup view={view} onClose={back} onGuest={onGuest} />;
  if (active === 'diagnostics') return <DiagnosticsPopup view={view} onClose={back} onAudit={() => worldStore.auditLedger()} />;
  if (active === 'assets') return <AssetLibraryPopup onClose={back} />;
  if (active === 'sound') return <SoundPopup onClose={back} />;
  if (active === 'help') return <HelpPopup onClose={back} />;
  if (active === 'device') return <Smartphone view={view} onClose={back} />;

  return (
    <PopupShell eyebrow="DU & WERKSTATT" title="Alles hinter einer Tuer" onClose={onClose} wide>
      <p className="hint">
        Nichts davon gehoert auf den Floor. Charakter, Buchhaltung und Technik liegen hier – eine Tuer,
        kein eigener Tab. Auf der Buehne liegen aktuell {atlasTextureCount()} gebackene Korpustexturen.
      </p>
      <div className="workshop-grid">
        {TOOLS.map((entry) => (
          <button key={entry.id} type="button" className="workshop-tile" onClick={() => setActive(entry.id)}>
            <strong>{entry.label}</strong>
            <small>{entry.note}</small>
          </button>
        ))}
      </div>
    </PopupShell>
  );
}
