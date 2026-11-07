/**
 * Deterministischer PNG-Atlas ohne neue Abhaengigkeit.
 * Alle Paket-PNGs sind 8-Bit-RGBA und nicht interlaced; der Codec prueft das
 * ausdruecklich, statt still falsche Pixel zu liefern.
 */
import { deflateSync, inflateSync } from 'node:zlib';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type, 'ascii');
  const body = Buffer.concat([name, data]);
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), 8 + data.length);
  return out;
}

/** Liest 8-Bit-RGBA (Color Type 6), nicht interlaced. */
export function readPng(file) {
  const png = readFileSync(file);
  if (!png.subarray(0, 8).equals(SIGNATURE)) throw new Error(`Kein PNG: ${file}`);
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  let interlace = 0;
  let bitDepth = 0;
  const parts = [];
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    const data = png.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'IDAT') parts.push(data);
    else if (type === 'IEND') break;
    offset += 12 + length;
  }
  if (bitDepth !== 8 || colorType !== 6 || interlace !== 0) {
    throw new Error(`Atlas erwartet 8-Bit-RGBA ohne Interlace: ${file}`);
  }
  const raw = inflateSync(Buffer.concat(parts));
  const stride = width * 4;
  const data = Buffer.alloc(stride * height);
  let pos = 0;
  let previous = Buffer.alloc(stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[pos];
    pos += 1;
    const line = raw.subarray(pos, pos + stride);
    pos += stride;
    const out = data.subarray(y * stride, (y + 1) * stride);
    for (let i = 0; i < stride; i += 1) {
      const left = i >= 4 ? out[i - 4] : 0;
      const up = previous[i];
      const upLeft = i >= 4 ? previous[i - 4] : 0;
      const value = filter === 1 ? line[i] + left
        : filter === 2 ? line[i] + up
          : filter === 3 ? line[i] + ((left + up) >> 1)
            : filter === 4 ? line[i] + paeth(left, up, upLeft)
              : line[i];
      out[i] = value & 0xff;
    }
    previous = out;
  }
  return { width, height, data };
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

export function encodePng(width, height, data) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    data.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([SIGNATURE, chunk('IHDR', header), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

function sortFrames(items) {
  return [...items].sort((a, b) => b.height - a.height || b.width - a.width
    || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

/** Gleicher Shelf-Plan wie src/render/assets/atlas.ts. */
export function shelfPack(frames, size, padding) {
  const pages = [];
  let page = [];
  let x = padding;
  let y = padding;
  let shelfHeight = 0;
  for (const frame of sortFrames(frames)) {
    if (frame.width + padding * 2 > size || frame.height + padding * 2 > size) {
      throw new Error(`Frame passt nicht auf die Atlasseite: ${frame.path}`);
    }
    if (x + frame.width + padding > size) {
      x = padding;
      y += shelfHeight + padding;
      shelfHeight = 0;
    }
    if (y + frame.height + padding > size) {
      if (page.length) pages.push(page);
      page = [];
      x = padding;
      y = padding;
      shelfHeight = 0;
    }
    page.push({ ...frame, x, y });
    x += frame.width + padding;
    shelfHeight = Math.max(shelfHeight, frame.height);
  }
  if (page.length) pages.push(page);
  return pages;
}

export function buildAtlasPages({ assetRoot, files, size, padding, outputDir }) {
  const items = files.map((path) => {
    const image = readPng(join(assetRoot, path));
    return { path, width: image.width, height: image.height, image };
  });
  const pages = shelfPack(items, size, padding);
  mkdirSync(outputDir, { recursive: true });
  for (const old of existsSync(outputDir) ? readdirSync(outputDir) : []) {
    if (/^atlas-\d+\.(png|webp)$/.test(old)) rmSync(join(outputDir, old));
  }
  return pages.map((frames, index) => {
    const pixels = Buffer.alloc(size * size * 4);
    for (const frame of frames) {
      const source = items.find((item) => item.path === frame.path).image;
      for (let row = 0; row < source.height; row += 1) {
        source.data.copy(
          pixels,
          ((frame.y + row) * size + frame.x) * 4,
          row * source.width * 4,
          (row + 1) * source.width * 4,
        );
      }
    }
    const source = `atlas/atlas-${index}.png`;
    writeFileSync(join(outputDir, `atlas-${index}.png`), encodePng(size, size, pixels));
    return {
      source,
      frames: frames.map(({ path, x, y, width, height }) => ({ path, x, y, width, height })),
    };
  });
}
