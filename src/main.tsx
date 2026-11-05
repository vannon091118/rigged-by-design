import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import {
  preloadAtlas, preloadDecorTextures, preloadMachineTextures, preloadPlinkoTextures, preloadRuntimeArt, preloadSlotSymbols,
} from './render/assets/textures';
import './styles/index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root-Element #root fehlt');

/* HTML-Ladebalken (index.html) wahrend boot() sichtbar halten */
const loaderEl = document.getElementById('rbd-loader');
const loaderTextEl = document.getElementById('rbd-loader-text');
const setLoaderText = (text: string): void => { if (loaderTextEl) loaderTextEl.textContent = text; };
const hideLoader = (): void => { if (loaderEl) loaderEl.style.display = 'none'; };

/** Der erste Frame braucht nur die gepackten Seiten, nicht 153 Einzeldateien. */
let warming = false;
function warmRemainingArt(): void {
  if (warming) return;
  warming = true;
  // Nach dem ersten Frame; die Atlas-Figuren sind bereits da, Symbole und
  // Plinko folgen im Leerlauf und blockieren den sichtbaren Floor nicht.
  void Promise.all([
    preloadSlotSymbols(), preloadPlinkoTextures(), preloadRuntimeArt(),
    preloadMachineTextures(), preloadDecorTextures(),
  ]);
}

async function boot(): Promise<void> {
  setLoaderText('Lade Neon-Kasino…');
  await preloadAtlas();
  setLoaderText('Baue Floor…');
  // hideLoader laeuft erst, wenn die Pixi-Buehne wirklich einen Frame gezeichnet hat.
  createRoot(root!).render(
    <StrictMode>
      <App onFirstFrame={() => { hideLoader(); warmRemainingArt(); }} />
    </StrictMode>,
  );
}

void boot();
