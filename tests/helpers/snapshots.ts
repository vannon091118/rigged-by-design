import { Page } from '@playwright/test';

/**
 * Snapshot-Helfer für reproduzierbare Spielsituationen.
 *
 * Da das Spiel rein clientseitig ist (Vite + React + PixiJS, kein Backend),
 * werden Spielsituationen über LocalStorage (Save-Format v9) vorbereitet.
 *
 * Jeder Snapshot ist ein benannter Spielzustand, der vor einem Test geladen
 * werden kann, damit Mechanik-Änderungen in identischen Situationen verglichen
 * werden können.
 *
 * Strategie:
 * 1. captureCurrentState() – liest den aktuellen GameView aus dem WorldStore
 *    (wenn die App ihn global exponiert unter window.__worldStore)
 * 2. loadWorldSnapshot() – setzt LocalStorage und lädt die Seite neu
 * 3. clearStorage() – kompletter Reset für isolierte Tests
 */
export async function setWorldSnapshot(page: Page, name: string): Promise<void> {
  // Prüfen ob ein gespeicherter Snapshot existiert
  const raw = await page.evaluate(({ snapshotName }) => {
    return localStorage.getItem(`neon:snapshot:${snapshotName}`);
  }, { snapshotName: name });

  if (!raw) {
    throw new Error(`[snapshot] Snapshot '${name}' nicht im LocalStorage gefunden. Bitte zuerst mit saveSnapshot erstellen.`);
  }

  await page.evaluate(({ snapshotJson }) => {
    localStorage.setItem(`neon:snapshot:active`, snapshotJson);
  }, { snapshotJson: raw });

  await page.reload();
}

export async function loadWorldSnapshot(page: Page, name: string): Promise<void> {
  const raw = await page.evaluate(({ snapshotName }) => {
    return localStorage.getItem(`neon:snapshot:${snapshotName}`);
  }, { snapshotName: name });

  if (!raw) {
    throw new Error(`[snapshot] Snapshot '${name}' nicht im LocalStorage gefunden`);
  }

  await page.evaluate(({ snapshotJson }) => {
    localStorage.setItem(`neon:snapshot:active`, snapshotJson);
  }, { snapshotJson: raw });

  await page.reload();
}

export async function clearStorage(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

export async function captureCurrentState(page: Page, name: string): Promise<void> {
  await page.evaluate(({ snapshotName }) => {
    const store = (window as unknown as { __worldStore?: { getSnapshot?: () => unknown } }).__worldStore;
    if (store) {
      const snapshot = store.getSnapshot();
      localStorage.setItem(`neon:snapshot:${snapshotName}`, JSON.stringify(snapshot));
      localStorage.setItem(`neon:snapshot:active`, snapshotName);
      console.log(`[snapshot] '${snapshotName}' erfasst: Tag ${snapshot.day}, Tick ${snapshot.tick}, Haus ${snapshot.house}`);
    } else {
      // Fallback: Store nicht global, nur aktiven Zustand merken
      localStorage.setItem(`neon:snapshot:${snapshotName}`, JSON.stringify({ captured: new Date().toISOString() }));
      localStorage.setItem(`neon:snapshot:active`, snapshotName);
      console.warn(`[snapshot] Store nicht global erreichbar – Snapshot '${snapshotName}' nur als Platzhalter gespeichert`);
    }
  }, { snapshotName: name });
}
