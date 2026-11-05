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
  setLoaderText('Rigged by Design — startet…');
  // Ein haengender Preload darf den Ladebildschirm nicht ewig stehen lassen.
  setTimeout(() => {
    if (loaderEl && loaderEl.style.display !== 'none') {
      setLoaderText('Laden dauert lange — Seite neu laden (Strg+Shift+R).');
    }
  }, 20000);
  try {
    // Hoechstens vier Sekunden warten: ein haengender Preload darf den Start nie blockieren.
    await Promise.race([
      Promise.all([
        preloadSlotSymbols(), preloadMachineTextures(), preloadDecorTextures(), preloadPlinkoTextures(), preloadRuntimeArt(),
      ]),
      new Promise((resolve) => setTimeout(resolve, 4000)),
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
  } catch (error) {
    // Sichtbarer Fehler statt endlosem Ladebalken.
    const message = error instanceof Error ? error.message : String(error);
    console.error('[boot]', error);
    setLoaderText(`Start fehlgeschlagen: ${message}. Seite neu laden (Strg+Shift+R).`);
  }
}

void boot();
