import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { preloadSlotSymbols } from './render/assets/textures';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root-Element #root fehlt');

/**
 * Die neun Symbol-Texturen sind rund 40 KB. Sie vor dem ersten Rendern zu
 * holen kostet kaum Zeit und sorgt dafuer, dass die Walzen von der ersten
 * Drehung an die echten Bilder zeigen statt auf die gezeichnete Ersatzgrafik.
 */
async function boot(): Promise<void> {
  await preloadSlotSymbols();
  createRoot(root!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void boot();
