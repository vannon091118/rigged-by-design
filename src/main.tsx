import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { preloadDecorTextures, preloadMachineTextures, preloadPlinkoTextures, preloadSlotSymbols } from './render/assets/textures';
import './styles/index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root-Element #root fehlt');

/**
 * Symbole, Maschinen, Deko und Plinko-Texturen vor dem ersten Rendern holen.
 * Das sind rund 1,3 MB; die Buehne zeigt dadurch von der ersten Drehung an
 * die echten Bilder statt der gezeichneten Ersatzgrafik. Der grosse Rest
 * (Figuren, UI, FX) bleibt Sache der Asset-Bibliothek und laedt lazy.
 */
async function boot(): Promise<void> {
  await Promise.all([preloadSlotSymbols(), preloadMachineTextures(), preloadDecorTextures(), preloadPlinkoTextures()]);
  createRoot(root!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void boot();
