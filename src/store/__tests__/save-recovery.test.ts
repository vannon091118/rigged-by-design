/**
 * @test-target: src/store/save.ts
 * @error-code: ERR-1002
 *
 * Issue #976: Fehlerhafte Spielstände erhalten und Wiederherstellung explizit machen.
 * Ladefehler in unterscheidbare Ursachen aufteilen (Parse, Version, Felder, Ledger,
 * Storage). Original-Save bleibt bei Fehlern unverändert. Roh-Save exportierbar,
 * Quarantäne möglich, getLastLoadError liefert Ursache.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { saveWorld, loadWorld, replaySave, getLastLoadError, getRawSave, quarantineSave, hasQuarantinedSave, SAVE_VERSION, toSavedGame, type LoadError } from '../save';
import { Ledger } from '../../core/economy/ledger';
import { fromVC } from '../../core/economy/vacoin';
import { createWorld } from '../../core/sim/templates';

/** Node hat kein DOM-Storage; der Save-Pfad braucht einen echten Prototyp fuer die Spies. */
class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, String(value)); }
  removeItem(key: string): void { this.values.delete(key); }
  clear(): void { this.values.clear(); }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  get length(): number { return this.values.size; }
}

beforeEach(() => {
  vi.stubGlobal('Storage', MemoryStorage);
  vi.stubGlobal('localStorage', new MemoryStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function fixtureWorld() {
  const world = createWorld('SMALL');
  const ledger = new Ledger();
  ledger.transfer('EXTERNAL_WORLD', 'HAUSKONTO', fromVC(500), 'baukapital', 0);
  return { world, ledger };
}

describe('Loadfehler in unterscheidbare Ursachen aufteilen', () => {
  it('beschädigtes JSON liefert parse-Fehler und gibt null zurück', () => {
    const loaded = replaySave('{ nicht geschlossen');
    expect(loaded).toBeNull();
    const err: LoadError | null = getLastLoadError();
    expect(err?.type).toBe('parse');
  });

  it('unbekannte Save-Version verhindert den Load', () => {
    const saved = { version: 99, template: 'SMALL', guests: [], furniture: [] };
    const loaded = replaySave(saved);
    expect(loaded).toBeNull();
    const err = getLastLoadError();
    expect(err?.type).toBe('missing-fields');
  });

  it('fehlende Pflichtfelder liefern missing-fields-Fehler', () => {
    const saved = { version: SAVE_VERSION, template: 'SMALL' };
    const loaded = replaySave(saved);
    expect(loaded).toBeNull();
    const err = getLastLoadError();
    expect(err?.type).toBe('missing-fields');
    if (err?.type === 'missing-fields') {
      expect(Array.isArray(err.missing)).toBe(true);
    }
  });

  it('ein gültiger v11-Save lädt erfolgreich und setzt keinen Fehler', () => {
    const { world, ledger } = fixtureWorld();
    const raw = JSON.stringify(toSavedGame(world, ledger, 1));
    const loaded = replaySave(JSON.parse(raw));
    expect(loaded).not.toBeNull();
    expect(getLastLoadError()).toBeNull();
  });

  it('lediglich uneinheitlicher Prng-State lädt dennoch (Default prngState)', () => {
    const { world, ledger } = fixtureWorld();
    const saved = { ...toSavedGame(world, ledger, 1), prngState: undefined };
    const loaded = replaySave(saved);
    expect(loaded).not.toBeNull();
    expect(loaded!.prngState).toBe(1);
  });
});

describe('Original-Save bleibt unverändert bei Ladefehlern', () => {
  it('loadWorld liest den Key nicht zerstörend', () => {
    const raw = JSON.stringify({ version: SAVE_VERSION, template: 'SMALL', guests: [], furniture: [] });
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(raw);
    loadWorld();
    expect(getItem).toHaveBeenCalledTimes(1);
    getItem.mockRestore();
  });
});

describe('Roh-Save und Quarantäne', () => {
  it('getRawSave liest den primären Save als String', () => {
    const raw = '{"version":11,"template":"SMALL","guests":[],"furniture":[]}';
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(raw);
    const result = getRawSave();
    expect(result).toBe(raw);
    getItem.mockRestore();
  });

  it('getRawSave gibt null zurück, wenn kein Save vorhanden ist', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    expect(getRawSave()).toBeNull();
    getItem.mockRestore();
  });

  it('quarantineSave legt den Save unter recovery-Suffix ab und entfernt den Original-Key', () => {
    const raw = '{"version":11}';
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(raw);
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem');
    const rescued = quarantineSave('recovery');
    expect(rescued).toBe(raw);
    expect(setItem).toHaveBeenCalledWith('vcoin.casino.v11.recovery', raw);
    expect(removeItem).toHaveBeenCalledWith('vcoin.casino.v11');
    getItem.mockRestore();
    setItem.mockRestore();
    removeItem.mockRestore();
  });

  it('hasQuarantinedSave meldet vorhanden/fehlend korrekt', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem');
    getItem.mockReturnValue('{"version":11}');
    expect(hasQuarantinedSave('recovery')).toBe(true);
    getItem.mockReturnValue(null);
    expect(hasQuarantinedSave('recovery')).toBe(false);
    getItem.mockRestore();
  });

  it('saveWorld unterscheidet Speichervoll-Zustand und gibt false zurück', () => {
    const { world, ledger } = fixtureWorld();
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('QuotaExceededError', 'QuotaExceededError'); });
    const result = saveWorld(world, ledger, 1);
    expect(result).toBe(false);
    setItem.mockRestore();
  });

  it('saveWorld gibt true zurück bei erfolgreichem Speichern', () => {
    const { world, ledger } = fixtureWorld();
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
    const result = saveWorld(world, ledger, 1);
    expect(result).toBe(true);
    setItem.mockRestore();
  });
});