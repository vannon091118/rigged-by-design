/**
 * Smartphone: zentraler Zugangspunkt für alle Interaktionen.
 * Apps: BUILD, BUY, TRAVEL, CLEAN, SERVE (jede in eigener Datei).
 * Ersetzt das direkte BuildPanel und dient als einziger Menü-Einstieg.
 */

import React from 'react';
import type { GameView } from '../store/types';
import { SmartphoneBuild } from './smartphone-build';
import { SmartphoneBuy } from './smartphone-buy';
import { SmartphoneTravel } from './smartphone-travel';
import { SmartphoneClean } from './smartphone-clean';
import { SmartphoneServe } from './smartphone-serve';
import { BuildPanel } from './build-panel';
import { worldStore } from '../store/use-world-store';
import { vc } from './format';

type SmartphoneAppId = 'BUILD' | 'BUY' | 'TRAVEL' | 'CLEAN' | 'SERVE' | 'ADVANCED';

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
    { id: 'ADVANCED', label: 'Erweitert', icon: '⚙️' },
  ];

  if (openApp === null) {
    return (
      <div className="smartphone smartphone-home">
        <div className="smartphone-header">
          <h2>Smartphone</h2>
          <button type="button" className="btn close" onClick={onClose}>Schließen</button>
        </div>
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
    case 'ADVANCED':
      return <SmartphoneBuildPanel view={view} onClose={onClose} />;
    default:
      return null;
  }
}

function SmartphoneBuildPanel({ view, onClose }: { view: GameView; onClose: () => void }) {
  return (
    <BuildPanel
      view={view}
      onClose={onClose}
      onBuy={(id) => { worldStore.buy(id); }}
      onTemplate={() => {}}
      onHire={(role) => worldStore.hire(role)}
      onFire={(role) => worldStore.fire(role)}
      onPrice={(key, value) => worldStore.setPrice(key, value)}
      onCarpet={(id) => worldStore.setCarpet(id)}
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
  );
}
