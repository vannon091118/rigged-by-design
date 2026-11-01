import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import {
  preloadDecorTextures, preloadMachineTextures, preloadPlinkoTextures, preloadRuntimeArt, preloadSlotSymbols,
} from './render/assets/textures';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root-Element #root fehlt');

/**
 * Symbole, Maschinen, Deko, Plinko, Figuren, Karten, Teppich und Partikel vor
 * dem ersten Rendern holen. Die Buehnen zeigen dadurch sofort die echten Bilder
 * statt der gezeichneten Ersatzgrafik; der grosse Rest bleibt Sache der
 * Asset-Bibliothek und laedt lazy.
 */
async function boot(): Promise<void> {
  await Promise.all([
    preloadSlotSymbols(), preloadMachineTextures(), preloadDecorTextures(), preloadPlinkoTextures(), preloadRuntimeArt(),
  ]);
  createRoot(root!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void boot();
