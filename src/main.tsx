import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import {
  preloadDecorTextures, preloadMachineTextures, preloadPlinkoTextures, preloadRuntimeArt, preloadSlotSymbols,
} from './render/assets/textures';
import './styles/index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root-Element #root fehlt');

/* HTML-Ladebalken (index.html) wahrend boot() sichtbar halten */
const loaderEl = document.getElementById('rbd-loader');
const loaderTextEl = document.getElementById('rbd-loader-text');
const setLoaderText = (text: string): void => { if (loaderTextEl) loaderTextEl.textContent = text; };
const hideLoader = (): void => { if (loaderEl) loaderEl.style.display = 'none'; };

/**
 * Symbole, Maschinen, Deko, Plinko, Figuren, Karten, Teppich und Partikel vor
 * dem ersten Rendern holen. Die Buhnen zeigen dadurch sofort die echten Bilder
 * statt der gezeichneten Ersatzgrafik; der grosse Rest bleibt Sache der
 * Asset-Bibliothek und ladet lazy.
 */
async function boot(): Promise<void> {
  setLoaderText('Lade Neon-Kasino…');
  await Promise.all([
    preloadSlotSymbols(), preloadMachineTextures(), preloadDecorTextures(), preloadPlinkoTextures(), preloadRuntimeArt(),
  ]);
  setLoaderText('Baue Floor…');
  await new Promise((resolve) => setTimeout(resolve, 250)); // kurzer sichtbarer Moment
  setLoaderText('Bereit.');
  createRoot(root!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  hideLoader();
}

void boot();
