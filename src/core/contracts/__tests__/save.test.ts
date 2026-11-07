/**
 * @test-target: src/core/contracts/save.ts
 * @error-code: ERR-1002
 *
 * Contract save v1.0: Save-Envelope, Versionierung und Migration.
 */
import { describe, expect, it } from 'vitest';
import type { SaveEnvelope, SaveId, SaveVersion } from '../save';
import { createSaveEnvelope, validateSaveEnvelope } from '../save';

describe('Contract: save v1.0', () => {
  it('erstellt eine valide Save-Envelope', () => {
    const env: SaveEnvelope = createSaveEnvelope(1, 'save_42', { foo: 'bar' });
    expect(env.version).toBe(1);
    expect(env.id).toBe('save_42');
    expect(env.timestamp).toBe(0);
    expect(env.data).toEqual({ foo: 'bar' });
  });

  it('validiert eine korrekte Envelope', () => {
    const env = createSaveEnvelope(3, 'save_7', [1, 2, 3]);
    expect(validateSaveEnvelope(env)).toBe(true);
  });

  it('lehnt ungültige version ab', () => {
    expect(() => createSaveEnvelope(0, 'save_1', {})).toThrow();
    expect(() => createSaveEnvelope(-1, 'save_1', {})).toThrow();
    expect(() => createSaveEnvelope(NaN, 'save_1', {})).toThrow();
    expect(() => createSaveEnvelope(1.5, 'save_1', {})).toThrow();
  });

  it('lehnt leere oder ungültige id ab', () => {
    expect(() => createSaveEnvelope(1, '', {})).toThrow();
    expect(() => createSaveEnvelope(1, undefined as unknown as SaveId, {})).toThrow();
    expect(() => createSaveEnvelope(1, null as unknown as SaveId, {})).toThrow();
  });

  it('lehnt data === undefined ab', () => {
    expect(() => createSaveEnvelope(1, 'save_1', undefined as unknown)).toThrow();
  });

  it('lehnt Envelope mit data === undefined ab', () => {
    const env = createSaveEnvelope(1, 'save_1', { x: 1 });
    expect(
      validateSaveEnvelope({ ...env, data: undefined as unknown }),
    ).toBe(false);
  });

  it('lehnt Envelope mit negativem timestamp ab', () => {
    const env = createSaveEnvelope(1, 'save_1', {});
    expect(validateSaveEnvelope({ ...env, timestamp: -1 })).toBe(false);
  });

  it('lehnt Envelope mit version < 1 ab', () => {
    const env = createSaveEnvelope(1, 'save_1', {});
    expect(validateSaveEnvelope({ ...env, version: 0 })).toBe(false);
    expect(validateSaveEnvelope({ ...env, version: -5 })).toBe(false);
  });

  it('produziert deterministische Envelope für gleiche Eingaben', () => {
    const e1 = createSaveEnvelope(2, 'save_det', { a: 1 });
    const e2 = createSaveEnvelope(2, 'save_det', { a: 1 });
    expect(e1.version).toBe(e2.version);
    expect(e1.id).toBe(e2.id);
    expect(e1.data).toEqual(e2.data);
  });

  it('rundtrippelt primitive und komplexe Daten', () => {
    const primitives: unknown[] = ['string', 42, true, null, [1, 2], { k: 'v' }];
    primitives.forEach((data) => {
      const env = createSaveEnvelope(1, 'save_prim', data);
      expect(validateSaveEnvelope(env)).toBe(true);
      expect(env.data).toEqual(data);
    });
  });

  it('SaveVersion-, SaveId- und SaveEnvelope-Typen sind importierbar', () => {
    const v: SaveVersion = 1;
    const id: SaveId = 'save_type';
    const env: SaveEnvelope = { version: v, id, timestamp: 0, data: {} };
    expect(env).toBeDefined();
    expect(env.version).toBe(v);
    expect(env.id).toBe(id);
  });
});
