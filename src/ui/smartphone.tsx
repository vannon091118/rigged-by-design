/**
 * Gerät: optionale Abkürzungen für räumliche Handlungen.
 * Welt zuerst: Bauen, Putzen und Servieren bleiben auf dem Floor erreichbar;
 * das Gerät ist kein Pflichtweg und kein zweiter Einstieg in den Betrieb.
 */

import React from 'react';
import type { GameView } from '../store/types';
import { SmartphoneBuild } from './smartphone-build';
import { SmartphoneBuy } from './smartphone-buy';
import { SmartphoneTravel } from './smartphone-travel';
import { SmartphoneClean } from './smartphone-clean';
import { SmartphoneServe } from './smartphone-serve';
import { SmartphoneInbox } from './smartphone-inbox';
import { SmartphoneVitter } from './smartphone-vitter';
import { SmartphoneImmoluck } from './smartphone-immoluck';
import { vc } from './format';

type SmartphoneAppId = 'BUILD' | 'BUY' | 'TRAVEL' | 'CLEAN' | 'SERVE' | 'INBOX' | 'VITTER' | 'IMMOLUCK';

interface SmartphoneProps {
  readonly view: GameView;
  readonly onClose: () => void;
}

export function Smartphone({ view, onClose }: SmartphoneProps) {
  const [openApp, setOpenApp] = React.useState<SmartphoneAppId | null>(null);

  const apps: { id: SmartphoneAppId; label: string; icon: string }[] = [
    { id: 'BUILD', label: 'Bauen', icon: '🏗️' },
    { id: 'BUY', label: 'Kaufen', icon: '🛒' },
    { id: 'TRAVEL', label: 'Reisen', icon: '✈️' },
    { id: 'CLEAN', label: 'Putzen', icon: '🧹' },
    { id: 'SERVE', label: 'Servieren', icon: '🍸' },
    { id: 'INBOX', label: 'Inbox', icon: '📥' },
    { id: 'VITTER', label: 'Vitter', icon: '💬' },
    { id: 'IMMOLUCK', label: 'ImmoLuck', icon: '🏠' },
  ];

  if (openApp === null) {
    return (
      <div className="smartphone smartphone-home">
        <div className="smartphone-header">
          <h2>Smartphone</h2>
          <button type="button" className="btn close" onClick={onClose}>Schließen</button>
        </div>
        <p className="hint">
          Welt zuerst: Bauen, Putzen und Servieren funktionieren direkt auf dem Floor.
          Diese Apps sind nur Abkürzungen, kein Pflichtweg.
        </p>
        <div className="smartphone-grid">
          {apps.map((app) => (
            <button key={app.id} type="button" className="btn app-tile" onClick={() => setOpenApp(app.id)}>
              <span className="app-icon">{app.icon}</span>
              <span className="app-label">{app.label}</span>
            </button>
          ))}
        </div>
        <div className="smartphone-footer">
          <span className="smartphone-status">{view.day}. Tag · {vc(view.house)}</span>
        </div>
      </div>
    );
  }

  switch (openApp) {
    case 'BUILD':
      return <SmartphoneBuild view={view} onBack={() => setOpenApp(null)} onClose={onClose} />;
    case 'BUY':
      return <SmartphoneBuy view={view} onBack={() => setOpenApp(null)} onClose={onClose} />;
    case 'TRAVEL':
      return <SmartphoneTravel view={view} onBack={() => setOpenApp(null)} onClose={onClose} />;
    case 'CLEAN':
      return <SmartphoneClean view={view} onBack={() => setOpenApp(null)} onClose={onClose} />;
    case 'SERVE':
      return <SmartphoneServe view={view} onBack={() => setOpenApp(null)} onClose={onClose} />;
    case 'INBOX':
      return <SmartphoneInbox view={view} onBack={() => setOpenApp(null)} onClose={onClose} />;
    case 'VITTER':
      return <SmartphoneVitter view={view} onBack={() => setOpenApp(null)} onClose={onClose} />;
    case 'IMMOLUCK':
      return <SmartphoneImmoluck view={view} onBack={() => setOpenApp(null)} onClose={onClose} />;
    default:
      return null;
  }
}
