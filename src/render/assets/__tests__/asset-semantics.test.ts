/**
 * @test-target: src/render/assets/asset-semantics.json
 * @error-code: ERR-4022
 *
 * Vertrag des Asset-Semantik-Katalogs. Der Test liest den Katalog als Daten,
 * vergleicht die Referenzen mit dem Manifest und prueft die Messfelder der in
 * diesem Slice angereicherten Kategorien (machines, decor).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import catalog from '../asset-semantics.json';
import manifest from '../manifest.json';

interface Bounds { readonly w: number; readonly h: number }
interface Point { readonly x: number; readonly y: number }
interface Entry {
  readonly category: string;
  readonly type: string;
  readonly depth: { readonly class: string; readonly layer: string; readonly order: number | string };
  readonly occlusion: string;
  readonly lod: string;
  readonly anchor: Point | 'unknown';
  readonly anchorKind?: string;
  readonly bounds: Bounds | 'unknown';
  readonly content?: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  readonly contentFill?: Point;
  readonly proportion?: string;
  readonly base?: string;
  readonly ground?: Point | 'none';
  readonly top?: Point | 'none';
  readonly transform?: string;
  readonly baked?: string;
  readonly notes?: readonly string[];
  readonly variants: readonly string[];
  readonly interactive: string;
  readonly usedBy: readonly string[];
  readonly evidence: string;
  readonly role: string;
  readonly world: string;
  readonly displayScale: number;
  readonly license: string;
}
interface Catalog {
  readonly enums: Readonly<Record<string, readonly string[]>>;
  readonly contract: {
    readonly commonRequired: readonly string[];
    readonly measured: { readonly appliesTo: readonly string[]; readonly required: readonly string[] };
  };
  readonly assets: Readonly<Record<string, Entry>>;
}
interface ManifestLike {
  readonly machines: Readonly<Record<string, string>>;
  readonly decor: Readonly<Record<string, string>>;
  readonly atlas: { readonly pages?: readonly { readonly frames: readonly { readonly path: string; readonly width: number; readonly height: number }[] }[] };
}

const data = catalog as unknown as Catalog;
const man = manifest as unknown as ManifestLike;
const entries = Object.entries(data.assets);
const measured = data.contract.measured.appliesTo;
const isMeasured = (entry: Entry): boolean => measured.includes(entry.category);
const atlasDims = new Map<string, Bounds>();
for (const page of man.atlas.pages ?? []) {
  for (const frame of page.frames) atlasDims.set(frame.path, { w: frame.width, h: frame.height });
}
const close = (a: number, b: number): boolean => Math.abs(a - b) <= 0.002;

describe('Asset-Semantik-Katalog: Referenzen und Messfelder', () => {
  it('deckt jede Manifest-Referenz der Kategorien machines und decor ab', () => {
    const expected = [...Object.keys(man.machines), ...Object.keys(man.decor)].sort();
    const present = entries.filter(([, entry]) => isMeasured(entry)).map(([ref]) => ref).sort();
    expect(present).toEqual(expected);
    expect(present).toHaveLength(82);
    const categories = entries.filter(([, entry]) => isMeasured(entry)).map(([, entry]) => entry.category);
    expect(categories.filter((cat) => cat === 'machines')).toHaveLength(54);
    expect(categories.filter((cat) => cat === 'decor')).toHaveLength(28);
  });

  it('fuehrt keine doppelte Asset-ID in der Datei', () => {
    const raw = readFileSync(new URL('../asset-semantics.json', import.meta.url), 'utf8');
    const block = raw.slice(raw.indexOf('"assets": {'), raw.indexOf('"ids": {'));
    const keys = [...block.matchAll(/^ {4}"([^"]+)": \{/gm)].map((match) => match[1] ?? '');
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const key of keys) {
      if (seen.has(key)) duplicates.push(key);
      else seen.add(key);
    }
    expect(duplicates).toEqual([]);
    expect(keys).toHaveLength(entries.length);
  });

  it('haelt Bounds, sichtbaren Inhalt und Anchors konsistent', () => {
    const broken: string[] = [];
    for (const [ref, entry] of entries) {
      if (!isMeasured(entry)) continue;
      const bounds = entry.bounds;
      if (bounds === 'unknown' || !entry.content || !entry.contentFill) { broken.push(`${ref}: Messfelder fehlen`); continue; }
      const atlas = atlasDims.get(ref);
      if (atlas && (atlas.w !== bounds.w || atlas.h !== bounds.h)) broken.push(`${ref}: bounds != Atlas`);
      const { x, y, w, h } = entry.content;
      if (x < 0 || y < 0 || w <= 0 || h <= 0 || x + w > bounds.w || y + h > bounds.h) broken.push(`${ref}: content ausserhalb bounds`);
      if (!close(entry.contentFill.x, Number((w / bounds.w).toFixed(3)))) broken.push(`${ref}: contentFill.x`);
      if (!close(entry.contentFill.y, Number((h / bounds.h).toFixed(3)))) broken.push(`${ref}: contentFill.y`);
      const groundY = Number(((y + h) / bounds.h).toFixed(3));
      const topY = Number((y / bounds.h).toFixed(3));
      if (entry.ground === 'none') {
        if (entry.base === 'floor-contact') broken.push(`${ref}: floor-contact ohne ground`);
      } else if (entry.ground && !close(entry.ground.y, groundY)) broken.push(`${ref}: ground.y != Inhaltsunterkante`);
      if (entry.top !== 'none' && entry.top && !close(entry.top.y, topY)) broken.push(`${ref}: top.y != Inhaltsoberkante`);
      if (entry.base === 'full-bleed' && entry.ground !== 'none') {
        if (x !== 0 || y !== 0 || w !== bounds.w || h !== bounds.h) broken.push(`${ref}: full-bleed ohne deckenden Inhalt`);
      }
      if (entry.anchorKind === 'sprite-center' && entry.anchor !== 'unknown') {
        if (!close(entry.anchor.x, 0.5) || !close(entry.anchor.y, 0.5)) broken.push(`${ref}: sprite-center != 0.5`);
      }
      if (entry.anchorKind === 'sprite-top-left' && entry.anchor !== 'unknown') {
        if (!close(entry.anchor.x, 0) || !close(entry.anchor.y, 0)) broken.push(`${ref}: sprite-top-left != 0/0`);
      }
    }
    expect(broken).toEqual([]);
  });

  it('akzeptiert nur gueltige Tiefenklassen, Ebenen und Aufzaehlungswerte', () => {
    const invalid: string[] = [];
    const check = (ref: string, field: string, value: string | number, allowed: readonly string[]): void => {
      if (!allowed.includes(String(value))) invalid.push(`${ref}: ${field}=${String(value)}`);
    };
    for (const [ref, entry] of entries) {
      check(ref, 'depth.class', entry.depth.class, data.enums.depthClass ?? []);
      check(ref, 'depth.layer', entry.depth.layer, data.enums.layer ?? []);
      if (entry.depth.order !== 'unknown' && !(typeof entry.depth.order === 'number' && entry.depth.order >= 1 && entry.depth.order <= 9)) {
        invalid.push(`${ref}: depth.order=${String(entry.depth.order)}`);
      }
      check(ref, 'occlusion', entry.occlusion, data.enums.occlusion ?? []);
      check(ref, 'lod', entry.lod, data.enums.lod ?? []);
      check(ref, 'type', entry.type, data.enums.type ?? []);
      check(ref, 'world', entry.world, data.enums.world ?? []);
      check(ref, 'license', entry.license, data.enums.license ?? []);
      if (!Number.isInteger(entry.displayScale) || entry.displayScale < 1) {
        invalid.push(`${ref}: displayScale=${String(entry.displayScale)}`);
      }
      if (!isMeasured(entry)) continue;
      check(ref, 'proportion', entry.proportion ?? '', data.enums.proportion ?? []);
      check(ref, 'base', entry.base ?? '', data.enums.base ?? []);
      check(ref, 'anchorKind', entry.anchorKind ?? '', data.enums.anchorKind ?? []);
      check(ref, 'transform', entry.transform ?? '', data.enums.transform ?? []);
      check(ref, 'baked', entry.baked ?? '', data.enums.baked ?? []);
    }
    expect(invalid).toEqual([]);
  });

  it('meldet fehlende und unvollstaendige Eintraege', () => {
    const incomplete: string[] = [];
    for (const [ref, entry] of entries) {
      for (const field of data.contract.commonRequired) {
        if (!(field in entry)) incomplete.push(`${ref}: ${field} fehlt`);
      }
      if (!entry.interactive && entry.interactive !== 'unknown') incomplete.push(`${ref}: interactive leer`);
      if (entry.evidence !== 'code' && entry.evidence !== 'category') incomplete.push(`${ref}: evidence=${entry.evidence}`);
      if (!Array.isArray(entry.variants) || !Array.isArray(entry.usedBy)) incomplete.push(`${ref}: Listen fehlen`);
      if (!entry.role) incomplete.push(`${ref}: role leer`);
      if (!isMeasured(entry)) continue;
      for (const field of data.contract.measured.required) {
        if (!(field in entry)) incomplete.push(`${ref}: ${field} fehlt (measured)`);
      }
      if (entry.notes && entry.notes.length > 0 && entry.notes.some((note) => note.trim() === '')) {
        incomplete.push(`${ref}: leere Notiz`);
      }
    }
    expect(incomplete).toEqual([]);
  });

  it('fuehrt Varianten nur mit identischer Leinwand und vorhandener Referenz', () => {
    const violations: string[] = [];
    for (const [ref, entry] of entries) {
      if (!isMeasured(entry) || entry.variants.length === 0) continue;
      const own = entry.bounds as Bounds;
      for (const peer of entry.variants) {
        const other = data.assets[peer];
        if (!other) { violations.push(`${ref}: Variante ${peer} fehlt`); continue; }
        const bounds = other.bounds as Bounds;
        if (bounds.w !== own.w || bounds.h !== own.h) violations.push(`${ref}: ${peer} andere Leinwand`);
        if (!other.variants.includes(ref)) violations.push(`${ref}: ${peer} nennt nicht zurueck`);
        if (other.category !== entry.category) violations.push(`${ref}: ${peer} andere Kategorie`);
      }
    }
    expect(violations).toEqual([]);
  });
});
