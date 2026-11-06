import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import {
  preloadAtlas, preloadDecorTextures, preloadMachineTextures, preloadPlinkoTextures, preloadRuntimeArt, preloadSlotSymbols,
} from './render/assets/textures';
import './styles/index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root-Element #root fehlt');
const loaderEl = document.getElementById('rbd-loader');
const loaderTextEl = document.getElementById('rbd-loader-text');
const setLoaderText = (text: string): void => { if (loaderTextEl) loaderTextEl.textContent = text; };
const hideLoader = (): void => { if (loaderEl) loaderEl.style.display = 'none'; };

let warming = false;
function warmRemainingArt(): void {
  if (warming) return;
  warming = true;
  void Promise.all([
    preloadSlotSymbols(), preloadPlinkoTextures(), preloadRuntimeArt(),
    preloadMachineTextures(), preloadDecorTextures(),
  ]);
}

async function boot(): Promise<void> {
  setLoaderText('Rigged by Design — startet…');
  setTimeout(() => {
    if (loaderEl && loaderEl.style.display !== 'none') setLoaderText('Laden dauert lange — Seite neu laden (Strg+Shift+R).');
  }, 20000);
  try {
    // Nur die Atlasseiten; nach vier Sekunden rendert der Floor auch ohne sie.
    await Promise.race([preloadAtlas(), new Promise((resolve) => setTimeout(resolve, 4000))]);
    setLoaderText('Baue Floor…');
    createRoot(root!).render(
      <StrictMode><App onFirstFrame={() => { hideLoader(); warmRemainingArt(); }} /></StrictMode>,
    );
  } catch (error) {
    console.error('[boot]', error);
    setLoaderText(`Start fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}. Seite neu laden (Strg+Shift+R).`);
  }
}

void boot();
